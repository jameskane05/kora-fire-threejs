/**
 * 3D MLS-MPM on WebGPU: sand / goo / water with optional hand/mouse force fields.
 * Particle positions are packed each substep into `renderBuffer` for three.js to draw.
 */
import shaderSource from './shaders/mpm3d.wgsl?raw';
import audioStatsSource from './shaders/mpm_audio_stats.wgsl?raw';
import { defaultMaterialsParams, materialTuning, type MaterialsParams } from './params';

export type MaterialKind = 'goo' | 'sand' | 'water';

/** Compact particle-velocity aggregates for procedural water audio. */
export interface MotionStats {
  meanSpeed: number;
  maxSpeed: number;
  highSpeedFraction: number;
  samples: number;
}

const MAT_ID: Record<MaterialKind, number> = { goo: 0, sand: 1, water: 2 };

/** Base goo budget. Sand/water use 2× (see {@link MlsMpm.activeCountFor}). */
export const BASE_PARTICLE_COUNT = 24576;
/** Sand/water: denser. */
export const SAND_PARTICLE_COUNT = BASE_PARTICLE_COUNT * 2;

export interface ForcePoint {
  /** Center in sim space [0,1]^3 */
  x: number;
  y: number;
  z: number;
  /** Push strength (negative gathers) */
  strength: number;
  /**
   * Sphere / capsule radius.
   * Unused for boxes (half-extents live in hx/hy/hz).
   */
  radius: number;
  /** Oriented bone box (finger segments). Sphere when false (unless capsule). */
  isBox: boolean;
  /** Capsule along ax: half-length hx, radius `radius`. Takes priority over isBox. */
  isCapsule: boolean;
  /** Box half-extents along ax / ay / az (sim units). Capsule uses hx as half-length. */
  hx: number;
  hy: number;
  hz: number;
  /** Orthonormal axes in sim space (ax = bone length direction). */
  ax: number;
  ay: number;
  az: number;
  bx: number;
  by: number;
  bz: number;
  cx: number;
  cy: number;
  cz: number;
}

export interface MlsMpmOptions {
  gridN?: number;
  particleCount?: number;
  substeps?: number;
  subDt?: number;
}

// Must match WGSL Particle (bytes).
const PARTICLE_STRIDE = 112;
/** Two hands × ~24 bone segments. Must match mpm3d.wgsl Params force arrays. */
export const MAX_FORCES = 50;
const PARAMS_SIZE = 48 + MAX_FORCES * 16 * 4;

export class MlsMpm {
  readonly gridN: number;
  /** GPU buffer capacity (sized for water = 2× base). */
  readonly capacity: number;
  /** Particles currently simulated / drawn (goo = base, sand/water = 2×). */
  private liveCount: number;
  /** Mutable — desktop / XR GUI write these live. */
  substeps: number;
  subDt: number;
  readonly domainSize = 1.0;

  /** Active particle count for stats / draw. */
  get particleCount(): number {
    return this.liveCount;
  }

  static activeCountFor(kind: MaterialKind, capacity: number): number {
    if (kind === 'goo') return Math.min(BASE_PARTICLE_COUNT, capacity);
    return Math.min(SAND_PARTICLE_COUNT, capacity);
  }

  private device!: GPUDevice;
  /** Exposed for perf benches that await queue drain. */
  get gpuDevice(): GPUDevice {
    return this.device;
  }
  private particleBuffer!: GPUBuffer;
  private gridAcc!: GPUBuffer;
  private gridVel!: GPUBuffer;
  /** Uniforms for substep 0 (may carry forces). */
  private paramsBufferForce!: GPUBuffer;
  /** Uniforms for later substeps (force_count = 0). */
  private paramsBufferIdle!: GPUBuffer;
  /** vec4 per particle: xyz sim pos, w = material id */
  renderBuffer!: GPUBuffer;
  /** vec4 per particle: xyz velocity (sim units), w unused */
  renderVelBuffer!: GPUBuffer;

  private pipelines!: {
    clear: GPUComputePipeline;
    p2g: GPUComputePipeline;
    grid: GPUComputePipeline;
    g2p: GPUComputePipeline;
  };
  private bindGroupForce!: GPUBindGroup;
  private bindGroupIdle!: GPUBindGroup;
  private bindLayout!: GPUBindGroupLayout;

  private audioStatsPipeline: GPUComputePipeline | null = null;
  private audioStatsBindLayout: GPUBindGroupLayout | null = null;
  private audioStatsParamsBuffer: GPUBuffer | null = null;
  private audioStatsBuffer: GPUBuffer | null = null;
  private audioStatsStaging: GPUBuffer | null = null;
  private audioStatsBusy = false;
  private readonly audioStatsParamsData = new ArrayBuffer(16);
  private readonly audioStatsParamsU32 = new Uint32Array(this.audioStatsParamsData);
  private readonly audioStatsParamsF32 = new Float32Array(this.audioStatsParamsData);
  private readonly audioStatsZero = new Uint32Array(4);

  private readonly paramsData = new ArrayBuffer(PARAMS_SIZE);
  private readonly paramsF32 = new Float32Array(this.paramsData);
  private readonly paramsU32 = new Uint32Array(this.paramsData);
  /** Reused CPU staging for reset() so material switches do not allocate ~2.6 MB each time. */
  private resetScratch: ArrayBuffer | null = null;
  /** Reused submit list so step() does not allocate a new array every frame. */
  private readonly submitList: GPUCommandBuffer[] = [undefined!];

  private material: MaterialKind = 'sand';
  private gravity = 100;
  private tuning: MaterialsParams = defaultMaterialsParams();

  /** Test/diagnostics: command buffers submitted by the last `step()`. */
  lastSubmitCount = 0;
  /** Test/diagnostics: encoders created by the last `step()`. */
  lastEncoderCount = 0;

  constructor(opts: MlsMpmOptions = {}) {
    this.gridN = opts.gridN ?? 48;
    // Capacity must cover sand/water (2× base). Default = 2× base.
    this.capacity = opts.particleCount ?? SAND_PARTICLE_COUNT;
    this.liveCount = MlsMpm.activeCountFor('sand', this.capacity);
    this.substeps = opts.substeps ?? 14;
    this.subDt = opts.subDt ?? 2.4e-4;
  }

  /** Bind the shared params object (GUI + XR panel mutate it in place). */
  bindParams(params: MaterialsParams): void {
    this.tuning = params;
    this.substeps = params.substeps;
    this.subDt = params.subDt;
  }

  async init(device: GPUDevice): Promise<void> {
    this.device = device;
    const module = device.createShaderModule({ code: shaderSource, label: 'mpm3d' });
    const info = await module.getCompilationInfo();
    const errors = info.messages.filter((m) => m.type === 'error');
    if (errors.length) {
      throw new Error(`mpm3d WGSL:\n${errors.map((e) => `${e.lineNum}:${e.linePos} ${e.message}`).join('\n')}`);
    }

    this.bindLayout = device.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'uniform' } },
        { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } },
        { binding: 2, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } },
        { binding: 3, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } },
        { binding: 4, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } },
        { binding: 5, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } },
      ],
    });
    const pipelineLayout = device.createPipelineLayout({ bindGroupLayouts: [this.bindLayout] });

    const make = (entryPoint: string) =>
      device.createComputePipeline({
        layout: pipelineLayout,
        compute: { module, entryPoint },
      });

    this.pipelines = {
      clear: make('clear_grid'),
      p2g: make('p2g'),
      grid: make('grid_update'),
      g2p: make('g2p'),
    };

    const n = this.gridN;
    const nodes = n * n * n;

    this.particleBuffer = device.createBuffer({
      size: this.capacity * PARTICLE_STRIDE,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });
    this.gridAcc = device.createBuffer({
      size: nodes * 4 * 4,
      usage: GPUBufferUsage.STORAGE,
    });
    this.gridVel = device.createBuffer({
      size: nodes * 16,
      usage: GPUBufferUsage.STORAGE,
    });
    this.paramsBufferForce = device.createBuffer({
      size: PARAMS_SIZE,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      label: 'mpm-params-force',
    });
    this.paramsBufferIdle = device.createBuffer({
      size: PARAMS_SIZE,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      label: 'mpm-params-idle',
    });
    this.renderBuffer = device.createBuffer({
      size: this.capacity * 16,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
    });
    this.renderVelBuffer = device.createBuffer({
      size: this.capacity * 16,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
    });

    const shared = [
      { binding: 1, resource: { buffer: this.particleBuffer } },
      { binding: 2, resource: { buffer: this.gridAcc } },
      { binding: 3, resource: { buffer: this.gridVel } },
      { binding: 4, resource: { buffer: this.renderBuffer } },
      { binding: 5, resource: { buffer: this.renderVelBuffer } },
    ];
    this.bindGroupForce = device.createBindGroup({
      layout: this.bindLayout,
      entries: [{ binding: 0, resource: { buffer: this.paramsBufferForce } }, ...shared],
    });
    this.bindGroupIdle = device.createBindGroup({
      layout: this.bindLayout,
      entries: [{ binding: 0, resource: { buffer: this.paramsBufferIdle } }, ...shared],
    });

    this.initAudioStats(device);
    this.reset(this.material);
  }

  private initAudioStats(device: GPUDevice): void {
    const module = device.createShaderModule({ code: audioStatsSource, label: 'mpm-audio-stats' });
    this.audioStatsBindLayout = device.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'uniform' } },
        { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'read-only-storage' } },
        { binding: 2, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } },
      ],
    });
    this.audioStatsPipeline = device.createComputePipeline({
      layout: device.createPipelineLayout({ bindGroupLayouts: [this.audioStatsBindLayout] }),
      compute: { module, entryPoint: 'reduce_vel' },
    });
    this.audioStatsParamsBuffer = device.createBuffer({
      size: 16,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      label: 'mpm-audio-stats-params',
    });
    this.audioStatsBuffer = device.createBuffer({
      size: 16,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
      label: 'mpm-audio-stats',
    });
    this.audioStatsStaging = device.createBuffer({
      size: 16,
      usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
      label: 'mpm-audio-stats-staging',
    });
  }

  /**
   * Subsample `renderVelBuffer` into mean/max speed for the water audio bus.
   * Safe to call while the sim keeps stepping; overlaps are ignored.
   */
  async readMotionStats(stride = 16): Promise<MotionStats | null> {
    if (
      !this.audioStatsPipeline ||
      !this.audioStatsBindLayout ||
      !this.audioStatsParamsBuffer ||
      !this.audioStatsBuffer ||
      !this.audioStatsStaging ||
      this.audioStatsBusy
    ) {
      return null;
    }
    this.audioStatsBusy = true;
    try {
      const n = this.liveCount;
      const step = Math.max(1, stride | 0);
      this.audioStatsParamsU32[0] = n;
      this.audioStatsParamsU32[1] = step;
      this.audioStatsParamsF32[2] = 1.5;
      this.audioStatsParamsF32[3] = 0;
      this.device.queue.writeBuffer(this.audioStatsParamsBuffer, 0, this.audioStatsParamsData);
      this.device.queue.writeBuffer(this.audioStatsBuffer, 0, this.audioStatsZero);

      const bindGroup = this.device.createBindGroup({
        layout: this.audioStatsBindLayout,
        entries: [
          { binding: 0, resource: { buffer: this.audioStatsParamsBuffer } },
          { binding: 1, resource: { buffer: this.renderVelBuffer } },
          { binding: 2, resource: { buffer: this.audioStatsBuffer } },
        ],
      });

      const samples = Math.ceil(n / step);
      const enc = this.device.createCommandEncoder();
      const pass = enc.beginComputePass();
      pass.setPipeline(this.audioStatsPipeline);
      pass.setBindGroup(0, bindGroup);
      pass.dispatchWorkgroups(Math.ceil(samples / 64));
      pass.end();
      enc.copyBufferToBuffer(this.audioStatsBuffer, 0, this.audioStatsStaging, 0, 16);
      this.device.queue.submit([enc.finish()]);

      await this.audioStatsStaging.mapAsync(GPUMapMode.READ);
      const u32 = new Uint32Array(this.audioStatsStaging.getMappedRange().slice(0));
      this.audioStatsStaging.unmap();

      const count = u32[2] || 0;
      const sumSpeed = u32[0] / 1024;
      const maxSpeed = new Float32Array(new Uint32Array([u32[1]]).buffer)[0] || 0;
      const highCount = u32[3] || 0;
      return {
        meanSpeed: count > 0 ? sumSpeed / count : 0,
        maxSpeed,
        highSpeedFraction: count > 0 ? highCount / count : 0,
        samples: count,
      };
    } finally {
      this.audioStatsBusy = false;
    }
  }

  dispose(): void {
    this.particleBuffer?.destroy();
    this.gridAcc?.destroy();
    this.gridVel?.destroy();
    this.paramsBufferForce?.destroy();
    this.paramsBufferIdle?.destroy();
    this.renderBuffer?.destroy();
    this.renderVelBuffer?.destroy();
    this.audioStatsParamsBuffer?.destroy();
    this.audioStatsBuffer?.destroy();
    this.audioStatsStaging?.destroy();
    this.audioStatsParamsBuffer = null;
    this.audioStatsBuffer = null;
    this.audioStatsStaging = null;
    this.audioStatsPipeline = null;
    this.audioStatsBindLayout = null;
    this.resetScratch = null;
  }

  setMaterial(kind: MaterialKind): void {
    this.material = kind;
  }

  getMaterial(): MaterialKind {
    return this.material;
  }

  reset(kind: MaterialKind = this.material): void {
    this.material = kind;
    this.liveCount = MlsMpm.activeCountFor(kind, this.capacity);
    const bytes = this.capacity * PARTICLE_STRIDE;
    if (!this.resetScratch || this.resetScratch.byteLength !== bytes) {
      this.resetScratch = new ArrayBuffer(bytes);
    }
    const data = this.resetScratch;
    const f32 = new Float32Array(data);
    const u32 = new Uint32Array(data);
    const mat = MAT_ID[kind];
    const strideF = PARTICLE_STRIDE / 4;
    const n = this.liveCount;

    let i = 0;
    const side = Math.ceil(Math.cbrt(n * 1.15));

    const writeParticle = (
      px: number,
      py: number,
      pz: number,
      vx = 0,
      vy = 0,
      vz = 0,
    ) => {
      if (i >= n) return;
      const base = i * strideF;
      f32[base + 0] = px;
      f32[base + 1] = py;
      f32[base + 2] = pz;
      u32[base + 3] = mat;
      f32[base + 4] = vx;
      f32[base + 5] = vy;
      f32[base + 6] = vz;
      f32[base + 7] = 1;
      f32[base + 8] = 1;
      f32[base + 9] = 0;
      f32[base + 10] = 0;
      f32[base + 11] = 0;
      f32[base + 12] = 1;
      f32[base + 13] = 0;
      f32[base + 14] = 0;
      f32[base + 15] = 0;
      f32[base + 16] = 1;
      for (let k = 17; k <= 25; k++) f32[base + k] = 0;
      i++;
    };

    if (kind === 'water') {
      // Tap stream: tall thin cylinder pouring toward the pillar, with jitter so it doesn't read as a lattice.
      const tapX = 0.28;
      const tapZ = 0.32;
      const yTop = 0.92;
      const yBot = 0.48;
      const radius = 0.045;
      // Aim slightly toward the pillar at (0.62, *, 0.38).
      const leanX = 0.35;
      const leanZ = 0.12;
      while (i < n) {
        const t = Math.random();
        const y = yBot + t * (yTop - yBot);
        // Uniform disk (sqrt radius) + angular noise.
        const ang = Math.random() * Math.PI * 2;
        const rad = Math.sqrt(Math.random()) * radius * (0.75 + Math.random() * 0.35);
        const along = (y - yBot) / (yTop - yBot);
        const px =
          tapX +
          Math.cos(ang) * rad +
          along * leanX * 0.08 +
          (Math.random() - 0.5) * 0.012;
        const pz =
          tapZ +
          Math.sin(ang) * rad +
          along * leanZ * 0.08 +
          (Math.random() - 0.5) * 0.012;
        // Faster near the nozzle, a bit of break-up noise lower in the column.
        const speed = 2.4 + along * 1.4 + (Math.random() - 0.5) * 0.6;
        const vx = leanX * speed * 0.55 + (Math.random() - 0.5) * 0.45;
        const vy = -speed + (Math.random() - 0.5) * 0.35;
        const vz = leanZ * speed * 0.55 + (Math.random() - 0.5) * 0.45;
        writeParticle(
          Math.min(0.96, Math.max(0.04, px)),
          Math.min(0.96, Math.max(0.04, y + (Math.random() - 0.5) * 0.01)),
          Math.min(0.96, Math.max(0.04, pz)),
          vx,
          vy,
          vz,
        );
      }
    } else if (kind === 'sand') {
      // Wide shallow mound already near rest height (avoids visible init squash).
      for (let z = 0; z < side && i < n; z++) {
        for (let x = 0; x < side && i < n; x++) {
          const u = x / side - 0.5;
          const w = z / side - 0.5;
          const r = Math.hypot(u, w);
          if (r > 0.5) continue;
          const height = Math.max(1, Math.floor((0.5 - r) / 0.5 * side * 0.28));
          for (let y = 0; y < height && i < n; y++) {
            writeParticle(
              0.5 + u * 0.85 + (Math.random() - 0.5) * 0.003,
              0.055 + (y / Math.max(height, 1)) * 0.14 + (Math.random() - 0.5) * 0.002,
              0.5 + w * 0.85 + (Math.random() - 0.5) * 0.003,
            );
          }
        }
      }
      while (i < n) {
        const ang = Math.random() * Math.PI * 2;
        const rad = Math.random() * 0.28;
        writeParticle(
          0.5 + Math.cos(ang) * rad,
          0.055 + Math.random() * 0.08,
          0.5 + Math.sin(ang) * rad,
        );
      }
    } else {
      // Goo: low resting dome on the floor (near hydrostatic shape — avoids cube collapse jiggle).
      const cx = 0.5;
      const cz = 0.5;
      const rx = 0.3;
      const rz = 0.3;
      const ry = 0.155;
      const y0 = 0.045;
      const nSide = Math.ceil(Math.cbrt(n * 1.35));
      for (let z = 0; z < nSide && i < n; z++) {
        for (let y = 0; y < nSide && i < n; y++) {
          for (let x = 0; x < nSide && i < n; x++) {
            const u = (x + 0.5) / nSide * 2 - 1;
            const v = (y + 0.5) / nSide;
            const w = (z + 0.5) / nSide * 2 - 1;
            if (u * u + w * w + v * v > 1) continue;
            writeParticle(cx + u * rx, y0 + v * ry, cz + w * rz);
          }
        }
      }
      while (i < n) {
        const t = i / n;
        const ang = t * Math.PI * 2 * 17.0;
        const rad = (t * 7.13) % 1 * 0.18;
        const h = (t * 3.71) % 1 * 0.1;
        writeParticle(cx + Math.cos(ang) * rad, y0 + h, cz + Math.sin(ang) * rad);
      }
    }

    this.device.queue.writeBuffer(this.particleBuffer, 0, data);

    // Let goo damp to rest before the first displayed frame (sand/water have their own init).
    if (kind === 'goo') {
      this.settle(36, 8);
    }
  }

  /**
   * Advance the sim without presenting — used after goo reset so the blob starts near rest.
   */
  settle(frames: number, substeps = 8): void {
    for (let i = 0; i < frames; i++) {
      this.step([], substeps);
    }
  }

  /**
   * Advance the sim. Optional render copies fold particle→attribute uploads into the same submit
   * (avoids a second encoder/submit per frame).
   */
  step(
    forces: ForcePoint[] = [],
    substeps?: number,
    copyPos?: GPUBuffer,
    copyVel?: GPUBuffer,
  ): void {
    this.substeps = this.tuning.substeps;
    this.subDt = this.tuning.subDt;
    const mat = materialTuning(this.tuning, this.material);
    this.gravity = this.tuning.gravity * mat.gravityScale;
    const steps = substeps ?? this.substeps;

    // Two uniform buffers: forces only on substep 0. One encoder + one submit for the whole frame
    // — the old per-substep submit path could backlog ~15 command buffers/frame.
    this.fillParams(forces);
    this.device.queue.writeBuffer(this.paramsBufferForce, 0, this.paramsData);
    this.fillParams([]);
    this.device.queue.writeBuffer(this.paramsBufferIdle, 0, this.paramsData);

    const enc = this.device.createCommandEncoder();
    this.lastEncoderCount = 1;
    const nodes = this.gridN * this.gridN * this.gridN;
    const dispatchParticles = Math.ceil(this.liveCount / 64);
    const dispatchNodes = Math.ceil(nodes / 64);

    for (let s = 0; s < steps; s++) {
      const bindGroup = s === 0 ? this.bindGroupForce : this.bindGroupIdle;
      this.dispatch(enc, this.pipelines.clear, bindGroup, dispatchNodes);
      this.dispatch(enc, this.pipelines.p2g, bindGroup, dispatchParticles);
      this.dispatch(enc, this.pipelines.grid, bindGroup, dispatchNodes);
      this.dispatch(enc, this.pipelines.g2p, bindGroup, dispatchParticles);
    }

    const bytes = this.liveCount * 16;
    if (copyPos) enc.copyBufferToBuffer(this.renderBuffer, 0, copyPos, 0, bytes);
    if (copyVel) enc.copyBufferToBuffer(this.renderVelBuffer, 0, copyVel, 0, bytes);

    this.submitList[0] = enc.finish();
    this.device.queue.submit(this.submitList);
    this.lastSubmitCount = 1;
  }

  private dispatch(
    enc: GPUCommandEncoder,
    pipeline: GPUComputePipeline,
    bindGroup: GPUBindGroup,
    count: number,
  ): void {
    const p = enc.beginComputePass();
    p.setPipeline(pipeline);
    p.setBindGroup(0, bindGroup);
    p.dispatchWorkgroups(count);
    p.end();
  }

  private fillParams(forces: ForcePoint[]): void {
    const dx = 1 / this.gridN;
    const mat = materialTuning(this.tuning, this.material);
    const mu = mat.mu;
    const lambda = mat.lambda;
    this.paramsU32[0] = this.gridN;
    this.paramsU32[1] = this.liveCount;
    this.paramsF32[2] = this.subDt;
    this.paramsF32[3] = dx;
    this.paramsF32[4] = 1 / dx;
    this.paramsF32[5] = this.gravity;
    this.paramsF32[6] = mu;
    this.paramsF32[7] = lambda;
    const nForces = Math.min(MAX_FORCES, forces.length);
    this.paramsU32[8] = nForces;
    this.paramsU32[9] = MAT_ID[this.material];

    const posBase = 12;
    const xBase = posBase + MAX_FORCES * 4;
    const yBase = xBase + MAX_FORCES * 4;
    const zBase = yBase + MAX_FORCES * 4;
    for (let i = 0; i < MAX_FORCES; i++) {
      const f = i < nForces ? forces[i] : undefined;
      const po = posBase + i * 4;
      const xo = xBase + i * 4;
      const yo = yBase + i * 4;
      const zo = zBase + i * 4;
      this.paramsF32[po] = f?.x ?? 0;
      this.paramsF32[po + 1] = f?.y ?? 0;
      this.paramsF32[po + 2] = f?.z ?? 0;
      this.paramsF32[po + 3] = f?.strength ?? 0;

      if (f?.isCapsule) {
        // Capsule along ax: halfLen in force_x.w, radius in force_y.w, force_z.w < 0 flags capsule.
        const r = f.radius > 0 ? f.radius : f.hy;
        this.paramsF32[xo] = f.ax;
        this.paramsF32[xo + 1] = f.ay;
        this.paramsF32[xo + 2] = f.az;
        this.paramsF32[xo + 3] = f.hx;
        this.paramsF32[yo] = f.bx;
        this.paramsF32[yo + 1] = f.by;
        this.paramsF32[yo + 2] = f.bz;
        this.paramsF32[yo + 3] = r;
        this.paramsF32[zo] = f.cx;
        this.paramsF32[zo + 1] = f.cy;
        this.paramsF32[zo + 2] = f.cz;
        this.paramsF32[zo + 3] = -1;
      } else if (f?.isBox) {
        this.paramsF32[xo] = f.ax;
        this.paramsF32[xo + 1] = f.ay;
        this.paramsF32[xo + 2] = f.az;
        this.paramsF32[xo + 3] = f.hx;
        this.paramsF32[yo] = f.bx;
        this.paramsF32[yo + 1] = f.by;
        this.paramsF32[yo + 2] = f.bz;
        this.paramsF32[yo + 3] = f.hy;
        this.paramsF32[zo] = f.cx;
        this.paramsF32[zo + 1] = f.cy;
        this.paramsF32[zo + 2] = f.cz;
        this.paramsF32[zo + 3] = f.hz;
      } else {
        // Sphere: radius in force_x.w, force_y.w < 0 flags sphere mode.
        const r = f?.radius ?? 0.05;
        this.paramsF32[xo] = 1;
        this.paramsF32[xo + 1] = 0;
        this.paramsF32[xo + 2] = 0;
        this.paramsF32[xo + 3] = r;
        this.paramsF32[yo] = 0;
        this.paramsF32[yo + 1] = 1;
        this.paramsF32[yo + 2] = 0;
        this.paramsF32[yo + 3] = -1;
        this.paramsF32[zo] = 0;
        this.paramsF32[zo + 1] = 0;
        this.paramsF32[zo + 2] = 1;
        this.paramsF32[zo + 3] = r;
      }
    }
  }
}
