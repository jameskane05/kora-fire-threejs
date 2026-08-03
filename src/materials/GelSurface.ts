/**
 * Gelatin isosurface from MLS-MPM goo particles: splat density → smooth → raymarch.
 * Bead impostors remain available via GooViewMode.
 */
import {
  BackSide,
  BoxGeometry,
  Mesh,
  NodeMaterial,
  StorageBufferAttribute,
  Vector3,
  type WebGPURenderer,
} from 'three/webgpu';
import {
  Break,
  Discard,
  Fn,
  If,
  Loop,
  cameraFar,
  cameraNear,
  cameraWorldMatrix,
  depth,
  exp,
  float,
  int,
  length,
  max,
  min,
  mix,
  modelViewMatrix,
  modelWorldMatrixInverse,
  normalize,
  oneMinus,
  positionLocal,
  pow,
  reflect,
  refract,
  screenUV,
  select,
  storage,
  uniform,
  vec3,
  vec4,
  viewZToPerspectiveDepth,
  viewportSafeUV,
  viewportSharedTexture,
} from 'three/tsl';
import densityShader from './shaders/gel_density.wgsl?raw';

export type GooViewMode = 'beads' | 'gel';

/* eslint-disable @typescript-eslint/no-explicit-any */
type N = any;

const PARAMS_SIZE = 16;
/** Hard loop cap — keep modest for stereo XR compile/runtime cost. */
const MAX_STEPS = 48;
/** Gelatin-ish IOR (~1.33–1.5). Incident ray is object-space view direction. */
const GEL_IOR = 1.42;

export type GelQuality = 'desktop' | 'immersive';

export class GelSurface {
  readonly mesh: Mesh;
  readonly densityAttr: StorageBufferAttribute;
  readonly gridN: number;

  private device!: GPUDevice;
  private particleCount = 0;
  private densityAtomic!: GPUBuffer;
  private densityFloat!: GPUBuffer;
  private densityTmp!: GPUBuffer;
  private paramsBuffer!: GPUBuffer;
  private pipelines!: {
    clear: GPUComputePipeline;
    splat: GPUComputePipeline;
    resolve: GPUComputePipeline;
    smooth: GPUComputePipeline;
    copy: GPUComputePipeline;
  };
  private bindGroup!: GPUBindGroup;
  private readonly paramsData = new ArrayBuffer(PARAMS_SIZE);
  private readonly paramsU32 = new Uint32Array(this.paramsData);
  private readonly paramsF32 = new Float32Array(this.paramsData);
  private readonly submitList: GPUCommandBuffer[] = [undefined!];
  private densityDest: GPUBuffer | null = null;
  private dispatchGrid = 0;
  private dispatchParticles = 0;

  private quality: GelQuality = 'desktop';

  private readonly u = {
    boxMin: uniform(new Vector3()),
    boxMax: uniform(new Vector3()),
    threshold: uniform(0.42),
    steps: uniform(48),
    /** 1 = XR path: no framebuffer fetch, no exit march, fewer steps. */
    immersive: uniform(0),
    /** Screen-space refraction strength. */
    refractScale: uniform(0.12),
    /** Beer–Lambert absorption scale (higher = deeper green). */
    absorb: uniform(6.5),
  };

  constructor(domain: number, gridN = 48) {
    this.gridN = gridN;
    const cells = gridN * gridN * gridN;
    this.densityAttr = new StorageBufferAttribute(cells, 1);

    const half = domain / 2;
    this.u.boxMin.value.set(-half, 0, -half);
    this.u.boxMax.value.set(half, domain, half);

    const geometry = new BoxGeometry(domain, domain, domain);
    geometry.translate(0, half, 0);

    const dens = storage(this.densityAttr, 'float', cells).toReadOnly();
    const n = float(gridN);
    const nInt = int(gridN);

    const at = (x: N, y: N, z: N) => dens.element(x.add(y.mul(nInt)).add(z.mul(nInt.mul(nInt))));

    // Nearest — trilinear was ~8× denser fetches per march step and hurt XR entry hard.
    const sample = (uvw: N): N => {
      const c = uvw.clamp(float(0), float(0.9999)).mul(n);
      return at(int(c.x), int(c.y), int(c.z));
    };

    const material = new NodeMaterial();
    material.side = BackSide;
    material.transparent = true;
    material.opacity = 1;
    material.depthWrite = true;
    material.depthTest = true;
    material.toneMapped = false;
    material.lights = false;

    material.fragmentNode = Fn(() => {
      // Object-space march — same XR-safe camera path as VolumeRenderer.
      const cameraWorld: N = (cameraWorldMatrix as N)[3];
      const origin = modelWorldMatrixInverse.mul(cameraWorld).xyz.toVar();
      const dir = normalize(positionLocal.sub(origin)).toVar();
      const invDir = vec3(1).div(dir);

      const t0 = this.u.boxMin.sub(origin).mul(invDir);
      const t1 = this.u.boxMax.sub(origin).mul(invDir);
      const tmin = min(t0, t1);
      const tmax = max(t0, t1);
      const tNear = max(max(tmin.x, tmin.y), tmin.z);
      const tFar = min(min(tmax.x, tmax.y), tmax.z);

      If(tFar.lessThanEqual(max(tNear, float(0))), () => {
        Discard();
      });

      const start = max(tNear, float(0)).toVar();
      const ds = tFar.sub(start).div(this.u.steps).toVar();
      const extent = this.u.boxMax.sub(this.u.boxMin);
      const t = start.add(ds.mul(0.5)).toVar();
      const hitT = float(-1).toVar();
      const prevD = float(0).toVar();
      const prevT = start.toVar();

      Loop(MAX_STEPS, () => {
        If(t.greaterThanEqual(tFar).or(ds.lessThanEqual(0)), () => {
          Break();
        });
        const p = origin.add(dir.mul(t));
        const d = sample(p.sub(this.u.boxMin).div(extent));
        If(d.greaterThanEqual(this.u.threshold), () => {
          const denom = max(d.sub(prevD), float(1e-5));
          const u = this.u.threshold.sub(prevD).div(denom).clamp(0, 1);
          hitT.assign(mix(prevT, t, u));
          Break();
        });
        prevD.assign(d);
        prevT.assign(t);
        t.addAssign(ds);
      });

      If(hitT.lessThan(0), () => {
        Discard();
      });

      const hitP = origin.add(dir.mul(hitT));

      // Raster depth is the domain back-face; rewrite to the isosurface so the floor can occlude.
      const viewZ = modelViewMatrix.mul(vec4(hitP, 1)).z;
      depth.assign(viewZToPerspectiveDepth(viewZ, cameraNear, cameraFar)).toStack();

      const uvw = hitP.sub(this.u.boxMin).div(extent);
      const eps = float(1.25).div(n);
      const grad = vec3(
        sample(uvw.add(vec3(eps, 0, 0))).sub(sample(uvw.sub(vec3(eps, 0, 0)))),
        sample(uvw.add(vec3(0, eps, 0))).sub(sample(uvw.sub(vec3(0, eps, 0)))),
        sample(uvw.add(vec3(0, 0, eps))).sub(sample(uvw.sub(vec3(0, 0, eps)))),
      );
      const gradLen = length(grad);
      const V = dir.negate();
      const Nrm = select(gradLen.greaterThan(1e-4), normalize(grad), V).toVar();
      If(Nrm.dot(V).lessThan(0), () => {
        Nrm.assign(Nrm.negate());
      });

      const ndv = max(Nrm.dot(V), float(0));
      const fresnel = pow(oneMinus(ndv), float(4.0)).mul(0.72).add(0.05);

      // Thickness: full exit march on desktop; view-dependent estimate in XR (half the cost).
      const thickness = mix(float(0.05), float(0.18), oneMinus(ndv)).toVar();
      If(this.u.immersive.lessThan(0.5), () => {
        const exitT = float(-1).toVar();
        t.assign(hitT.add(ds));
        prevD.assign(this.u.threshold);
        prevT.assign(hitT);
        Loop(MAX_STEPS, () => {
          If(t.greaterThanEqual(tFar).or(ds.lessThanEqual(0)), () => {
            Break();
          });
          const pExit = origin.add(dir.mul(t));
          const dExit = sample(pExit.sub(this.u.boxMin).div(extent));
          If(dExit.lessThan(this.u.threshold), () => {
            const denom = max(prevD.sub(dExit), float(1e-5));
            const u = prevD.sub(this.u.threshold).div(denom).clamp(0, 1);
            exitT.assign(mix(prevT, t, u));
            Break();
          });
          prevD.assign(dExit);
          prevT.assign(t);
          t.addAssign(ds);
        });
        If(exitT.greaterThan(hitT), () => {
          thickness.assign(exitT.sub(hitT).clamp(0.01, 0.55));
        });
      });

      // Screen-space refraction is expensive (and stall-prone) in stereo XR — skip the fetch.
      const sceneSample = vec3(0.07, 0.08, 0.1).toVar();
      If(this.u.immersive.lessThan(0.5), () => {
        const eta = float(1).div(GEL_IOR);
        const refrDir = refract(dir, Nrm, eta);
        const useReflect = length(refrDir).lessThan(1e-4);
        const bendDir = select(useReflect, reflect(dir, Nrm), normalize(refrDir));
        const nView = normalize(modelViewMatrix.mul(vec4(Nrm, 0)).xyz);
        const bendView = normalize(modelViewMatrix.mul(vec4(bendDir, 0)).xyz);
        const distort = nView.xy
          .mul(0.55)
          .add(bendView.xy.mul(0.45))
          .mul(this.u.refractScale.mul(thickness.mul(2.2).add(0.35)))
          .mul(oneMinus(ndv).mul(0.65).add(0.35));
        sceneSample.assign(viewportSharedTexture(viewportSafeUV(screenUV.add(distort))).rgb);
      });

      const sigma = vec3(0.55, 0.12, 0.4);
      const beer = exp(sigma.negate().mul(thickness.mul(this.u.absorb)));
      const tint = vec3(0.55, 0.95, 0.62);
      const gelBody = mix(vec3(0.05, 0.28, 0.14), vec3(0.16, 0.58, 0.32), ndv.mul(0.5).add(0.5));
      const transmitted = select(
        this.u.immersive.greaterThan(0.5),
        gelBody.mul(beer).mul(tint),
        sceneSample.mul(beer).mul(tint),
      );

      const L = normalize(vec3(0.35, 0.85, 0.4));
      const H = normalize(L.add(V));
      const spec = pow(max(Nrm.dot(H), float(0)), float(48)).mul(0.18);
      const rim = vec3(0.75, 0.98, 0.85).mul(fresnel.mul(0.4));

      const col = transmitted.mul(oneMinus(fresnel)).add(rim).add(vec3(spec));
      // XR: true alpha so the floor shows through without a framebuffer read.
      const alpha = select(this.u.immersive.greaterThan(0.5), mix(float(0.55), float(0.85), fresnel), float(1));
      return vec4(col, alpha);
    })();

    this.mesh = new Mesh(geometry, material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 6;
    this.mesh.visible = false;
  }

  async init(device: GPUDevice, particleBuffer: GPUBuffer, particleCount: number): Promise<void> {
    this.device = device;
    this.particleCount = particleCount;

    const module = device.createShaderModule({ code: densityShader, label: 'gel_density' });
    const info = await module.getCompilationInfo();
    const errors = info.messages.filter((m) => m.type === 'error');
    if (errors.length) {
      throw new Error(`gel_density WGSL:\n${errors.map((e) => `${e.lineNum}:${e.linePos} ${e.message}`).join('\n')}`);
    }

    const layout = device.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'uniform' } },
        { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'read-only-storage' } },
        { binding: 2, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } },
        { binding: 3, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } },
        { binding: 4, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } },
      ],
    });
    const pipelineLayout = device.createPipelineLayout({ bindGroupLayouts: [layout] });
    const make = (entryPoint: string) =>
      device.createComputePipeline({ layout: pipelineLayout, compute: { module, entryPoint } });

    this.pipelines = {
      clear: make('clear_density'),
      splat: make('splat_density'),
      resolve: make('resolve_density'),
      smooth: make('smooth_density'),
      copy: make('copy_smooth'),
    };

    const cells = this.gridN ** 3;
    this.paramsBuffer = device.createBuffer({
      size: PARAMS_SIZE,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    this.densityAtomic = device.createBuffer({ size: cells * 4, usage: GPUBufferUsage.STORAGE });
    this.densityFloat = device.createBuffer({
      size: cells * 4,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
    });
    this.densityTmp = device.createBuffer({ size: cells * 4, usage: GPUBufferUsage.STORAGE });

    this.bindGroup = device.createBindGroup({
      layout,
      entries: [
        { binding: 0, resource: { buffer: this.paramsBuffer } },
        { binding: 1, resource: { buffer: particleBuffer } },
        { binding: 2, resource: { buffer: this.densityAtomic } },
        { binding: 3, resource: { buffer: this.densityFloat } },
        { binding: 4, resource: { buffer: this.densityTmp } },
      ],
    });

    this.dispatchGrid = Math.ceil(cells / 64);
    this.dispatchParticles = Math.ceil(particleCount / 64);
  }

  setEnabled(on: boolean): void {
    this.mesh.visible = on;
  }

  setThreshold(t: number): void {
    this.u.threshold.value = t;
  }

  setQuality(quality: GelQuality): void {
    this.quality = quality;
    const immersive = quality === 'immersive';
    this.u.immersive.value = immersive ? 1 : 0;
    this.u.steps.value = immersive ? 28 : 48;
  }

  update(renderer: WebGPURenderer, opts?: { splatRadius?: number; densityScale?: number; smoothPasses?: number }): void {
    if (!this.mesh.visible) return;

    const immersive = this.quality === 'immersive';
    const splatRadius = opts?.splatRadius ?? (immersive ? 2.1 : 2.6);
    const densityScale = opts?.densityScale ?? 1.15;
    const smoothPasses = opts?.smoothPasses ?? (immersive ? 0 : 1);

    this.paramsU32[0] = this.gridN;
    this.paramsU32[1] = this.particleCount;
    this.paramsF32[2] = splatRadius;
    this.paramsF32[3] = densityScale;
    this.device.queue.writeBuffer(this.paramsBuffer, 0, this.paramsData);

    if (!this.densityDest) {
      const backend = (
        renderer as unknown as { backend: { get: (a: unknown) => { buffer?: GPUBuffer } } }
      ).backend;
      this.densityDest = backend.get(this.densityAttr)?.buffer ?? null;
    }

    const cells = this.gridN ** 3;
    const dg = this.dispatchGrid;
    const dp = this.dispatchParticles;
    const enc = this.device.createCommandEncoder();
    this.dispatch(enc, this.pipelines.clear, dg);
    this.dispatch(enc, this.pipelines.splat, dp);
    this.dispatch(enc, this.pipelines.resolve, dg);
    for (let i = 0; i < smoothPasses; i++) {
      this.dispatch(enc, this.pipelines.smooth, dg);
      this.dispatch(enc, this.pipelines.copy, dg);
    }

    if (this.densityDest) {
      enc.copyBufferToBuffer(this.densityFloat, 0, this.densityDest, 0, cells * 4);
    }
    this.submitList[0] = enc.finish();
    this.device.queue.submit(this.submitList);
  }

  private dispatch(enc: GPUCommandEncoder, pipeline: GPUComputePipeline, count: number): void {
    const p = enc.beginComputePass();
    p.setPipeline(pipeline);
    p.setBindGroup(0, this.bindGroup);
    p.dispatchWorkgroups(count);
    p.end();
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    (this.mesh.material as NodeMaterial).dispose();
    this.densityAtomic?.destroy();
    this.densityFloat?.destroy();
    this.densityTmp?.destroy();
    this.paramsBuffer?.destroy();
  }
}
