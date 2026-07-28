/**
 * The solver loop, following Kora's Algorithm 1 step for step.
 *
 *   1  Dissipation                §4.7.5
 *   2  Emission                   §5.1
 *   3  Update domain buckets and load balance (MPI)   — not ported, see README
 *   4  Mass diffusion             §4.7.2
 *   5  Combustion reaction        §4.5
 *   6  Radiative cooling          §4.7.4
 *   7  Thermal conduction         §4.7.2
 *   8  Energy cascade turbulence  §4.8
 *   9  Compute the sum c_prev of all chemical concentrations
 *  10  Compute s from c_prev, T and T_atm, using equation (17)
 *  11-14  Adiabatic expansion correction and cooling  §4.4
 *  15  Apply external forces      §5.3.1
 *  16  Pressure projection with divergence -ln(s)/dt  §4.7.1
 *  17  Velocity-based guiding     §5.3.2
 *  18  Multiply all concentrations by s
 *  19  Advection                  §4.7.3
 *
 * Compute graphs bake in the texture they read and write, so the whole frame is built twice —
 * once per ping-pong parity — and the two versions alternate.
 */
import type { Renderer, Storage3DTexture } from 'three/webgpu';
import { Field, SimFields, makeTexture, type Res } from './Grid';
import { gridOps, T, load, type N } from './tsl';
import { makeMixture } from './mixture';
import { createUniforms, syncUniforms, type KoraUniforms } from './uniforms';
import type { KoraParams } from './params';
import type { Ctx } from './context';
import type { NoiseVolume } from './noise';

import { sourcingPass, sourceMask, sourceSdf } from './passes/sourcing';
import type { ProbeChannel, ProbeTextures } from './probe';
import { diffusionPass } from './passes/diffusion';
import { ignitionPass, flamePropagationPass, flammable } from './passes/flameFront';
import { combustionPass } from './passes/combustion';
import { radiativeCoolingPass } from './passes/radiativeCooling';
import { copyPass, energyCascadePass, smoothPass } from './passes/turbulence';
import { expansionPass, applyExpansionPass } from './passes/expansion';
import { forcesPass } from './passes/forces';
import {
  divergencePass,
  pressureCoefficientsPass,
  pressurePass,
  pressureGradientPass,
} from './passes/projection';
import { guidingPass } from './passes/guiding';
import { advectionPass } from './passes/advection';

const { float, vec4, max, length, textureStore } = T;

/** Iterations of the flame-front dilate/renormalise cycle, §4.5.2. */
const FLAME_ITERATIONS = 2;

/** Records a compute node together with a name, so a failing pass can be identified. */
type Push = (label: string, node: N) => void;

/**
 * Once the graphs are built, `ctx.f` no longer means anything: kernel bodies do not run until
 * three.js compiles them, long after the ping-pong buffers have advanced. A pass that reads
 * `ctx.f` from inside its body gets whichever buffers happened to be current last, which shows up
 * as a texture bound for both reading and writing and a WGSL compile failure. Poisoning the field
 * turns that mistake into an immediate, named exception instead.
 */
function poisonedFields(): FieldsView {
  return new Proxy({} as FieldsView, {
    get(_target, key) {
      throw new Error(
        `ctx.f.${String(key)} was read after the compute graphs were built. Capture the fields ` +
          `at pass-build time (const { f } = ctx) instead of reaching through ctx inside a kernel.`,
      );
    },
  });
}

export interface FrameStart {
  chem: Storage3DTexture;
  aux: Storage3DTexture;
  vel: Storage3DTexture;
  pressure: Storage3DTexture;
}

export class KoraSolver {
  readonly uniforms: KoraUniforms;
  readonly fields: SimFields;
  /** (temperature, released heat, soot, equivalence ratio) — everything the shader reads */
  readonly renderField: Storage3DTexture;
  /** (blurred temperature, blurred soot) for the render-time operations of §5.4.2 */
  readonly renderBlur: Storage3DTexture;

  readonly res: Res;

  private readonly ctx: Ctx;
  private readonly pyramid: Storage3DTexture[] = [];
  private readonly scratch: Storage3DTexture[] = [];
  private readonly frames: N[][] = [[], []];
  private readonly frameLabels: string[][] = [];
  private readonly initNodes: N[][] = [];
  private readonly endTextures: FrameStart[] = [];
  private parity = 0;
  private elapsed = 0;

  constructor(
    private readonly renderer: Renderer,
    readonly params: KoraParams,
    noise: NoiseVolume,
  ) {
    const r = params.resolution;
    this.res = [r, r, r];

    this.fields = new SimFields(this.res);
    this.uniforms = createUniforms(params);
    this.renderField = makeTexture(this.res, 'rgba16f', 'render');
    this.renderBlur = makeTexture(this.res, 'rgba16f', 'renderBlur');

    const bands = params.energyCascadeBands;
    for (let i = 0; i < bands + 2; i++) {
      this.pyramid.push(makeTexture(this.res, 'rgba16f', `ectBand${i}`));
    }
    for (let i = 0; i < 2; i++) {
      this.scratch.push(makeTexture(this.res, 'rgba16f', `scratch${i}`));
    }

    this.ctx = {
      g: gridOps(this.res),
      f: this.fields.view(),
      u: this.uniforms,
      m: makeMixture(this.uniforms),
      noise,
    };

    for (const p of [0, 1]) {
      const start = this.captureStart();
      this.ctx.f = this.fields.view();
      this.initNodes[p] = this.buildInit(start);
      this.frames[p] = this.buildFrame();
      this.endTextures[p] = this.captureStart();
    }

    this.ctx.f = poisonedFields();
    syncUniforms(this.uniforms, params);
  }

  private captureStart(): FrameStart {
    const f = this.fields;
    return {
      chem: f.chem.read,
      aux: f.aux.read,
      vel: f.vel.read,
      pressure: f.pressure.read,
    };
  }

  /**
   * Fills the domain with still air, writing straight into the buffers this parity reads from.
   *
   * Split across several kernels because WebGPU only guarantees four storage textures per shader
   * stage, and this touches eight.
   */
  private buildInit(start: FrameStart): N[] {
    const { g, u, f } = this.ctx;

    const write = (targets: () => void) => g.kernel(targets);

    return [
      write(() => {
        const c = g.coord();
        textureStore(start.chem, c, vec4(0.0, 0.21, 0.79, 0.0)).toWriteOnly();
        textureStore(
          start.aux,
          c,
          vec4(0.0, u.ambientTemperature, 0.0, u.dx.mul(5.0)),
        ).toWriteOnly();
        textureStore(start.vel, c, vec4(0.0)).toWriteOnly();
      }),
      write(() => {
        const c = g.coord();
        textureStore(start.pressure, c, vec4(0.0)).toWriteOnly();
        textureStore(f.expansion, c, vec4(1.0)).toWriteOnly();
        textureStore(f.divergence, c, vec4(0.0)).toWriteOnly();
      }),
      write(() => {
        const c = g.coord();
        textureStore(this.renderField, c, vec4(0.0)).toWriteOnly();
        textureStore(this.renderBlur, c, vec4(0.0)).toWriteOnly();
      }),
    ];
  }

  private buildFrame(): N[] {
    const ctx = this.ctx;
    const f = this.fields;
    const p = this.params;
    const nodes: N[] = [];
    const labels: string[] = [];

    ctx.f = f.view();

    const push = (label: string, node: N) => {
      nodes.push(node);
      labels.push(label);
    };

    // Each pass is built against the buffers current at the time of its call, then the fields it
    // wrote are swapped and the snapshot refreshed for whichever pass comes next.
    const run = (label: string, node: N, ...swap: Field[]) => {
      push(label, node);
      for (const s of swap) s.swap();
      ctx.f = f.view();
    };

    // 1-2 — dissipation and emission
    run('sourcing', sourcingPass(ctx), f.chem, f.aux, f.vel);

    // 4 — mass diffusion
    for (const axis of [0, 1, 2] as const) {
      run(`massDiffusion.${axis}`, diffusionPass(ctx, axis, 'mass'), f.chem);
    }

    // 5 — flame front then the combustion reaction
    run('ignition', ignitionPass(ctx), f.aux);
    for (let i = 0; i < FLAME_ITERATIONS; i++) {
      run(`flamePropagation.${i}`, flamePropagationPass(ctx, FLAME_ITERATIONS), f.aux);
    }
    run('combustion', combustionPass(ctx), f.chem, f.aux);

    // 6 — radiative cooling
    run('radiativeCooling', radiativeCoolingPass(ctx), f.aux);

    // 7 — thermal conduction
    for (const axis of [0, 1, 2] as const) {
      run(`thermalConduction.${axis}`, diffusionPass(ctx, axis, 'thermal'), f.aux);
    }

    // 8 — energy cascade turbulence
    this.buildCascade(push);
    run('energyCascade', energyCascadePass(ctx, this.pyramid, p.energyCascadeBands), f.vel);

    // 9-14 — expansion and adiabatic cooling
    run('expansion', expansionPass(ctx), f.aux);

    // 15 — external forces
    run('forces', forcesPass(ctx), f.vel);

    // 16 — pressure projection
    push('divergence', divergencePass(ctx));
    push('poissonCoefficients', pressureCoefficientsPass(ctx));
    for (let i = 0; i < p.pressureIterations; i++) {
      run(`pressure.${i}`, pressurePass(ctx), f.pressure);
    }
    run('pressureGradient', pressureGradientPass(ctx), f.vel);

    // 17 — frequency-domain guiding
    if (p.guidingWeight > 0) {
      this.buildLowPass(push, 'guideBlur', f.vel.read, this.scratch[0], 3, 4);
      run('guiding', guidingPass(ctx, this.scratch[0]), f.vel);
    }

    // 18 — apply the expansion to the concentrations
    run('applyExpansion', applyExpansionPass(ctx), f.chem, f.aux);

    // 19 — advection
    run('advection', advectionPass(ctx, p.macCormack), f.chem, f.aux, f.vel);

    // shading inputs, §5.4
    push('renderField', this.buildRenderField());
    this.buildLowPass(push, 'renderBlur.a', this.renderField, this.renderBlur, 1, 1);
    this.buildLowPass(push, 'renderBlur.b', this.renderBlur, this.renderBlur, 2, 1);

    this.frameLabels.push(labels);
    return nodes;
  }

  /**
   * Eq. (30): u_0 = u, then successively smoothed levels. The a-trous variant runs one
   * separable pass per level at stride 2^i; the exact variant applies the 3x3x3 box filter J
   * exactly 2^i times, which is what the paper specifies and what costs 31 convolutions.
   */
  private buildCascade(push: Push): void {
    const bands = this.params.energyCascadeBands;
    const exact = this.params.exactCascadeFilter;

    push('cascade.copy', copyPass(this.ctx, this.fields.vel.read, this.pyramid[0]));

    for (let level = 0; level < bands + 1; level++) {
      const repeats = exact ? Math.pow(2, level) : 1;
      const stride = exact ? 1 : Math.pow(2, level);
      this.buildSeparable(
        push,
        `cascade.${level}`,
        this.pyramid[level],
        this.pyramid[level + 1],
        stride,
        repeats,
      );
    }
  }

  /** Separable smoothing of `src` into `dst`, used for guiding (eq. 38) and the render blurs. */
  private buildLowPass(
    push: Push,
    label: string,
    src: Storage3DTexture,
    dst: Storage3DTexture,
    stride: number,
    repeats: number,
  ): void {
    this.buildSeparable(push, label, src, dst, stride, repeats);
  }

  /**
   * Three axis passes per repeat, bouncing through scratch buffers.
   *
   * A repeat must not read and write the same texture: three.js binds a texture used both ways
   * in one kernel as sampled, and the store then fails to compile. So repeats alternate between
   * the two scratch buffers rather than feeding scratch[0] back into itself.
   */
  private buildSeparable(
    push: Push,
    label: string,
    src: Storage3DTexture,
    dst: Storage3DTexture,
    stride: number,
    repeats: number,
  ): void {
    const ctx = this.ctx;
    let from = src;

    for (let r = 0; r < repeats; r++) {
      const last = r === repeats - 1;
      const target = last ? dst : this.scratch[r % 2];
      const [a, b] = r % 2 === 0 ? [this.scratch[0], this.scratch[1]] : [this.scratch[1], this.scratch[0]];

      push(`${label}.r${r}.x`, smoothPass(ctx, from, a, 0, stride));
      push(`${label}.r${r}.y`, smoothPass(ctx, a, b, 1, stride));
      push(`${label}.r${r}.z`, smoothPass(ctx, b, target, 2, stride));
      from = target;
    }
  }

  /** Packs the channels §5.4.1 shades with into a single texture the render pass can sample. */
  private buildRenderField(): N {
    const { g, f, m } = this.ctx;

    return g.kernel(() => {
      const c = g.coord();
      const chem = load(f.chem.read, c);
      const aux = load(f.aux.read, c);

      const temperature = max(aux.y, float(0.0));
      const heat = max(aux.z, float(0.0));
      const soot = max(aux.x, float(0.0));
      const phi = m.equivalenceRatio(chem);

      textureStore(this.renderField, c, vec4(temperature, heat, soot, phi)).toWriteOnly();
    });
  }

  /** The buffers holding the state each parity leaves behind, for readback and inspection. */
  get snapshots(): FrameStart[] {
    return this.endTextures;
  }

  /** The textures a probe should read for a given ping-pong parity. */
  probeTextures(parity: number): ProbeTextures {
    const s = this.endTextures[parity];
    return {
      chem: s.chem,
      aux: s.aux,
      vel: s.vel,
      render: this.renderField,
      pressure: s.pressure,
      expansion: this.fields.expansion,
    };
  }

  /**
   * Scalar expressions for the field probe: field extremes plus the emission mask, the ignition
   * predicate and the uniforms feeding them, so a silent solver can be traced back to its input.
   */
  probeChannels(): ProbeChannel[] {
    const u = this.uniforms;
    const g = this.ctx.g;
    const ctx = this.ctx;

    return [
      { label: 'maxFuel', value: (s) => s.chem.x },
      { label: 'maxOxygen', value: (s) => s.chem.y },
      { label: 'maxProduct', value: (s) => s.chem.w },
      { label: 'maxSoot', value: (s) => s.aux.x },
      { label: 'maxTemperature', value: (s) => s.aux.y },
      { label: 'maxHeat', value: (s) => s.aux.z },
      { label: 'minFlameSdf', value: (s) => s.aux.w, min: true },
      { label: 'maxSpeed', value: (s) => length(s.vel.xyz) },
      { label: 'maxRenderHeat', value: (s) => s.render.y },
      { label: 'maxSourceMask', value: (s) => sourceMask(u, g.centre(s.coord)) },
      { label: 'minSourceSdf', value: (s) => sourceSdf(u, g.centre(s.coord)), min: true },

      // The ignition predicate itself, so a stalled flame front can be attributed to temperature
      // or to the flammability window rather than guessed at.
      { label: 'maxPhi', value: (s) => ctx.m.equivalenceRatio(s.chem) },
      { label: 'maxHotEnough', value: (s) => T.step(u.ignitionTemperature, s.aux.y) },
      {
        label: 'maxIgnitable',
        value: (s) => T.step(u.ignitionTemperature, s.aux.y).mul(flammable(ctx, s.chem)),
      },

      { label: 'maxPressure', value: (s) => s.pressure.x },
      { label: 'minPressure', value: (s) => s.pressure.x, min: true },
      { label: 'minExpansion', value: (s) => s.expansion.x, min: true },
      { label: 'maxExpansion', value: (s) => s.expansion.x },

      { label: 'u.dx', value: () => u.dx, constant: true },
      { label: 'u.sourceMixFuel', value: () => u.sourceMix.x, constant: true },
      { label: 'u.sourceTemperature', value: () => u.sourceTemperature, constant: true },
    ];
  }

  /** The frame's passes in dispatch order, paired with their names. */
  framePasses(parity: number): { label: string; node: N }[] {
    return this.frames[parity].map((node, i) => ({
      label: this.frameLabels[parity][i],
      node,
    }));
  }

  /** The frame's passes, paired with their names, for isolating a failing kernel. */
  passes(parity = 0): { label: string; node: N }[] {
    const init = this.initNodes[parity].map((node, i) => ({ label: `init.${i}`, node }));
    const frame = this.frames[parity].map((node, i) => ({
      label: this.frameLabels[parity][i],
      node,
    }));
    return [...init, ...frame, { label: 'probe', node: null }].filter((p) => p.node);
  }

  /** Which parity's snapshot holds the most recently completed frame. */
  get lastParity(): number {
    return this.parity ^ 1;
  }

  reset(): void {
    this.elapsed = 0;
    this.renderer.compute(this.initNodes[this.parity]);
  }

  /** Advances the simulation. Returns the timestep actually taken. */
  step(dt: number): number {
    return this.advance(dt, (parity) => this.renderer.compute(this.frames[parity]));
  }

  /**
   * A step with every pass submitted as its own compute group, so each carries its own timestamp
   * query. `after` runs immediately following each dispatch, while the pass's query id is still
   * the current one. Measurement only: the batched path shares a command encoder and is faster.
   */
  stepUnbatched(dt: number, after: (label: string, node: N) => void): number {
    return this.advance(dt, (parity) => {
      for (const { label, node } of this.framePasses(parity)) {
        this.renderer.compute(node);
        after(label, node);
      }
    });
  }

  private advance(dt: number, dispatch: (parity: number) => void): number {
    const p = this.params;
    const sub = Math.max(1, Math.floor(p.substeps));
    const h = Math.min(dt, 1 / 30) / sub;

    syncUniforms(this.uniforms, p);

    for (let i = 0; i < sub; i++) {
      this.elapsed += h;
      this.uniforms.dt.value = h;
      this.uniforms.time.value = this.elapsed;

      dispatch(this.parity);
      this.parity ^= 1;

      // A detonation charge is a one-shot stamp, consumed by the frame that saw it.
      this.uniforms.sourceImpulse.value = 0;
    }

    return h * sub;
  }

  /** Queues a one-shot high-temperature fuel charge — the §4.4 explosion scenario. */
  detonate(strength: number): void {
    this.uniforms.sourceImpulse.value = strength;
  }

  dispose(): void {
    this.fields.dispose();
    this.renderField.dispose();
    this.renderBlur.dispose();
    for (const t of this.pyramid) t.dispose();
    for (const t of this.scratch) t.dispose();
  }
}
