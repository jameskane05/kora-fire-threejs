/**
 * Sparks and embers, as a particle system alongside the grid rather than on it.
 *
 * Both Weta papers keep these separate from the volume. Kora §5.1.3 layers particle systems over
 * the combustion solve, and the 2023 talk's flamethrower does the same thing at greater length:
 * FLIP fuel splits into a spray system, which is "two-way coupled to the surrounding combustion
 * volume via a drag force" before being rasterised back into the fuel channel. Neither describes
 * sparks specifically, and neither gives equations for the particles, so the physics below is the
 * standard small-body-in-a-flow model rather than anything from the papers:
 *
 *   - drag pulls each ember toward the local gas velocity with a relaxation time tau
 *   - gravity acts on the ember directly; the buoyancy that lifts it acts on the *gas*, and
 *     reaches the ember through the drag term, which is why sparks rise with the plume and then
 *     arc over as they cool and the plume slows
 *   - it radiates as a grey body, so it cools by Stefan-Boltzmann, the same law the volume uses
 *     for §4.7.4
 *   - its colour is the blackbody colour of its own temperature, from the same LUT as the flame
 *
 * The coupling is one-way. An ember is light enough that the momentum it returns to the gas is
 * nothing next to the buoyancy already there, so unlike the paper's fuel spray it does not push
 * back on the volume.
 *
 * Everything lives on the GPU: two storage buffers of particle state, one compute pass that both
 * spawns and integrates, and instanced sprites that read the buffers as attributes. Nothing is
 * ever read back.
 */
import {
  AdditiveBlending,
  InstancedMesh,
  PlaneGeometry,
  Sphere,
  SpriteNodeMaterial,
  type DataTexture,
  type Storage3DTexture,
} from 'three/webgpu';
import { BLACKBODY_MAX_K, BLACKBODY_MIN_K } from '../render/blackbody';
import { gridOps, sampleVelocity, worldPos, type GridOps, type N } from '../sim/tsl';
import type { KoraUniforms } from '../sim/uniforms';
import type { KoraParams } from '../sim/params';
import type { Res } from '../sim/Grid';
import * as TSLTyped from 'three/tsl';

/* eslint-disable @typescript-eslint/no-explicit-any */
const T = TSLTyped as any;
const {
  Break,
  Fn,
  If,
  Loop,
  clamp,
  exp,
  float,
  hash,
  instanceIndex,
  instancedArray,
  int,
  ivec3,
  max,
  modelViewMatrix,
  oneMinus,
  pow,
  smoothstep,
  sqrt,
  texture,
  uniform,
  uv,
  vec2,
  vec3,
  vec4,
} = T;

/**
 * Candidate cells a dead ember tests per frame before giving up until the next one.
 *
 * Spawning is rejection sampling: a free particle picks cells at random and takes the first that
 * is burning. That keeps the spawn distribution proportional to the reaction volume with no
 * bookkeeping, and needs no special case for a torch versus an explosion — but the reaction zone
 * is a thin sheet, so a single sample per frame would refill the population too slowly to hold it
 * at the cap.
 *
 * The cost is self-limiting in the right direction: only free particles search, so a fire that is
 * burning well keeps the population alive and almost nobody pays, while a fire that has gone out
 * has the whole buffer searching and finding nothing, which is the cheap case anyway.
 */
const SPAWN_ATTEMPTS = 16;

/** Restitution of a bounce off a displacement volume. Embers are not elastic. */
const BOUNCE = 0.3;

export interface SparkInputs {
  /** (temperature, released heat, soot, equivalence ratio) — the reaction zone to spawn from */
  render: Storage3DTexture;
  /** (solid velocity, signed distance) */
  solid: Storage3DTexture;
  /** MAC velocity, one entry per solver parity */
  velocity: Storage3DTexture[];
  /** the flame's own blackbody table, so an ember at flame temperature is the flame's colour */
  lut: DataTexture;
}

export class Sparks {
  readonly mesh: InstancedMesh;
  readonly count: number;

  /** (position xyz, age). A negative age means the slot is free. */
  private readonly state: N;
  /** (velocity xyz, temperature K) */
  private readonly motion: N;

  private readonly u = {
    dt: uniform(1 / 60),
    /** decorrelates the random streams frame to frame */
    seed: uniform(0),

    /** released heat a cell must exceed before it throws anything at all */
    spawnHeat: uniform(0.8),
    /** probability a well-burning cell throws an ember, per candidate test */
    spawnChance: uniform(0.1),
    /** isotropic kick at birth, on top of the local gas velocity */
    ejectSpeed: uniform(0.4),
    life: uniform(1.8),

    /**
     * 1 / tau, the rate at which drag pulls an ember onto the gas velocity.
     *
     * For a sphere in Stokes flow tau = rho_p d^2 / (18 mu), so this is really a mass control:
     * a large value is a mote that traces the flow exactly, a small one is a heavy cinder that
     * keeps its own momentum. It wants to be small. Lofting is not a single kick at birth but the
     * updraft pushing continuously through this term, so a light ember is dragged the whole
     * height of the plume and shoots out of the top; a heavy one takes an initial push, decouples
     * and arcs over under gravity, which is what an ember thrown off a fire actually does.
     */
    dragRate: uniform(0.9),

    /**
     * 3 eps sigma / (rho_p c_p r), the grey-body cooling coefficient.
     *
     * From m c dT/dt = -eps sigma A (T^4 - T_amb^4) for a sphere. Carbon at rho_p = 1800,
     * c_p = 700, eps ~ 1 and r = 1.7 mm gives 8e-11, which takes an ember from 2000 K to about
     * 1400 K in a second and 1100 K by the end of its life. The radius is what sets the look and
     * it has to be a firebrand rather than a mote: at a quarter of a millimetre the same law puts
     * it below visible red inside a second, which is correct for a spark that small and is why
     * the ones that carry are the big ones.
     */
    cooling: uniform(8e-11),

    gravity: uniform(9.80665),
    size: uniform(0.004),
    /** metres of streak per m/s of speed, standing in for the camera's exposure time */
    streak: uniform(0.008),
    /**
     * An ember is genuinely far dimmer than the flame it came from — a thousand degrees down is
     * a factor of sixteen in T^4 — so it needs a gain of its own to register beside one.
     */
    intensity: uniform(5.0),
    obstacles: uniform(0),
  };

  private readonly initNode: N;
  /** One integrate/spawn graph per solver parity, since each bakes in a velocity texture. */
  private readonly stepNodes: N[] = [];

  constructor(
    inputs: SparkInputs,
    sim: KoraUniforms,
    res: Res,
    domainSize: number,
    count: number,
  ) {
    this.count = count;
    this.state = instancedArray(count, 'vec4');
    this.motion = instancedArray(count, 'vec4');

    const g = gridOps(res);

    this.initNode = Fn(() => {
      // A negative age is the free-slot marker, so the whole population starts dead and the
      // first frames fill it from wherever the fire happens to be burning.
      this.state.element(instanceIndex).assign(vec4(0.0, -1.0, 0.0, -1.0));
      this.motion.element(instanceIndex).assign(vec4(0.0));
    })().compute(count);

    for (const parity of [0, 1]) {
      this.stepNodes[parity] = this.buildStep(inputs, sim, g, res, parity);
    }

    this.mesh = this.buildMesh(inputs.lut, domainSize, count);
  }

  private buildStep(
    inputs: SparkInputs,
    sim: KoraUniforms,
    g: GridOps,
    res: Res,
    parity: number,
  ): N {
    const u = this.u;
    const vel = inputs.velocity[parity];
    const resF = vec3(res[0], res[1], res[2]);

    return Fn(() => {
      const state = this.state.element(instanceIndex);
      const motion = this.motion.element(instanceIndex);

      const position = state.xyz.toVar();
      const age = state.w.toVar();
      const velocity = motion.xyz.toVar();
      const temperature = motion.w.toVar();

      // A counter run through a PCG hash: consecutive seeds decorrelate, so a stream is just
      // successive integers offset per particle and per frame.
      const seed = int(instanceIndex).mul(int(9781)).add(int(u.seed)).toVar();
      const rand = (): N => {
        seed.addAssign(int(1));
        return hash(seed);
      };

      const dt = u.dt;

      If(age.lessThan(float(0.0)), () => {
        Loop(SPAWN_ATTEMPTS, () => {
          // Uniform over the interior in voxel units; the outer layer is the ghost boundary.
          const p = vec3(rand(), rand(), rand())
            .mul(resF.sub(vec3(2.0)))
            .add(vec3(1.0));
          const cell = g.sample(inputs.render, p);

          // A hard floor and then a soft ramp that saturates, rather than either alone.
          //
          // The floor is what keeps the domain from filling: the heat channel is advected and
          // diffused, so a trace of it reaches everywhere, and any threshold low enough to catch
          // the reaction zone catches the whole box too — which it duly did. The ramp above it is
          // because heat spans more than two orders of magnitude inside the flame, and anything
          // linear in it is either a fountain or nothing at all with almost no ground between.
          // Saturating means `spawnChance` reads as the probability a well-burning cell throws an
          // ember, which is a number worth having a slider for.
          const vigour = smoothstep(u.spawnHeat, u.spawnHeat.mul(3.0), cell.y).mul(u.spawnChance);

          If(rand().lessThan(vigour), () => {
            position.assign(worldPos(sim, p));

            // Born on the gas, plus an isotropic kick: an ember leaves the fuel bed with its own
            // momentum, which is what lets it break out of the plume instead of riding it.
            const z = rand().mul(2.0).sub(1.0);
            const a = rand().mul(Math.PI * 2);
            const r = sqrt(max(oneMinus(z.mul(z)), float(0.0)));
            const dir = vec3(r.mul(T.cos(a)), r.mul(T.sin(a)), z);

            velocity.assign(sampleVelocity(g, vel, p).add(dir.mul(u.ejectSpeed)));
            temperature.assign(cell.x);
            age.assign(float(0.0));
            Break();
          });
        });
      }).Else(() => {
        const voxel = position.sub(sim.origin).div(sim.dx);
        const gas = sampleVelocity(g, vel, voxel);

        // Exponential rather than explicit Euler, so a large dt or a stiff drag cannot overshoot
        // the gas velocity and oscillate.
        const alpha = oneMinus(exp(u.dragRate.mul(dt).negate()));
        velocity.addAssign(gas.sub(velocity).mul(alpha));
        velocity.y.subAssign(u.gravity.mul(dt));
        position.addAssign(velocity.mul(dt));

        const excess = pow(temperature, float(4.0)).sub(pow(sim.ambientTemperature, float(4.0)));
        temperature.assign(
          max(temperature.sub(u.cooling.mul(excess).mul(dt)), sim.ambientTemperature),
        );

        age.addAssign(dt);

        If(u.obstacles.greaterThan(float(0.5)), () => {
          const c = ivec3(voxel);
          const d = g.fetch(inputs.solid, c).w;
          If(d.lessThan(float(0.0)), () => {
            // Central differences on the baked SDF. Only valid within the narrow band, which is
            // where a particle that just crossed the surface necessarily is.
            const grad = vec3(
              g.fetch(inputs.solid, c.add(ivec3(1, 0, 0))).w.sub(
                g.fetch(inputs.solid, c.sub(ivec3(1, 0, 0))).w,
              ),
              g.fetch(inputs.solid, c.add(ivec3(0, 1, 0))).w.sub(
                g.fetch(inputs.solid, c.sub(ivec3(0, 1, 0))).w,
              ),
              g.fetch(inputs.solid, c.add(ivec3(0, 0, 1))).w.sub(
                g.fetch(inputs.solid, c.sub(ivec3(0, 0, 1))).w,
              ),
            );
            const n = T.normalize(grad.add(vec3(0.0, 1e-6, 0.0)));
            position.assign(position.sub(n.mul(d)));
            velocity.assign(T.reflect(velocity, n).mul(BOUNCE));
          });
        });

        // Retired on age, on landing, or on leaving the neighbourhood entirely. Embers are
        // deliberately not confined to the simulation domain: past its walls there is no gas to
        // sample, the drag term goes quiet and they simply finish the arc ballistically, which is
        // where most of the ones worth looking at end up. The ceiling is only there because an
        // ember that does escape upward has nothing left to slow it and would otherwise streak
        // out of frame at constant speed forever.
        const extent = sim.dx.mul(float(res[0]));
        const gone = position.y
          .lessThan(float(0.0))
          .or(position.y.greaterThan(extent.mul(1.4)))
          .or(T.length(position.xz).greaterThan(extent.mul(1.5)));
        If(age.greaterThan(u.life).or(gone), () => {
          age.assign(float(-1.0));
        });
      });

      state.assign(vec4(position, age));
      motion.assign(vec4(velocity, temperature));
    })().compute(this.count);
  }

  private buildMesh(lut: DataTexture, domainSize: number, count: number): InstancedMesh {
    const u = this.u;
    const state = this.state.toAttribute();
    const motion = this.motion.toAttribute();

    const age = state.w;
    const velocity = motion.xyz;
    const temperature = motion.w;
    const alive = age.greaterThanEqual(float(0.0));

    const material = new SpriteNodeMaterial();
    material.positionNode = state.xyz;

    // Streaks, not dots. A spark on a real plate is a smear because it moves during the exposure,
    // and without it a field of embers reads as static confetti. The sprite is stretched along the
    // screen-space velocity, so the smear points where the ember is actually going.
    const viewVelocity = modelViewMatrix.mul(vec4(velocity, 0.0)).xyz;
    material.rotationNode = T.atan(viewVelocity.y, viewVelocity.x);

    const stretch = u.size.add(T.length(velocity).mul(u.streak));
    material.scaleNode = alive.select(vec2(stretch, u.size), vec2(0.0));

    const t = clamp(
      temperature.sub(BLACKBODY_MIN_K).div(BLACKBODY_MAX_K - BLACKBODY_MIN_K),
      float(0.0),
      float(1.0),
    );
    // The same normalised chromaticity and T^4 intensity the volume uses, so an ember leaving the
    // flame is exactly the colour of the flame it left, and dims on its own as it cools. No
    // separate fade curve: Stefan-Boltzmann is steep enough to be one.
    const chroma = texture(lut, vec2(t, 0.5)).rgb;
    const glow = pow(temperature.div(2200.0), float(4.0));

    // Only to stop a still-hot ember from popping out at the end of its life. Both smoothsteps
    // here run low edge first and are inverted rather than passed reversed edges, which WGSL
    // leaves undefined.
    const retire = oneMinus(smoothstep(u.life.mul(0.75), u.life, age));
    material.colorNode = chroma.mul(glow).mul(u.intensity);

    const mask = oneMinus(smoothstep(float(0.15), float(0.5), T.length(uv().sub(0.5))));
    material.opacityNode = mask.mul(retire).mul(alive.select(float(1.0), float(0.0)));

    material.transparent = true;
    material.depthWrite = false;
    material.blending = AdditiveBlending;

    const mesh = new InstancedMesh(new PlaneGeometry(1, 1), material, count);
    // Positions only exist on the GPU, so nothing on the CPU can bound them.
    mesh.frustumCulled = false;
    mesh.boundingSphere = new Sphere(undefined, domainSize * 4);
    // After the volume (10) and before the hands (20). Additive and depth-write free, so an ember
    // behind the plume still shows through it — wrong, but they are small and bright enough that
    // sorting them properly would cost more than it reads.
    mesh.renderOrder = 15;
    return mesh;
  }

  /** Fills the buffers with dead particles. */
  reset(renderer: { compute(node: N): void }): void {
    renderer.compute(this.initNode);
  }

  /** One update for the whole frame, run after the solver so it reads the state just produced. */
  step(renderer: { compute(node: N): void }, parity: number, dt: number, frame: number): void {
    this.u.dt.value = Math.min(dt, 1 / 30);
    this.u.seed.value = frame % 1_000_003;
    renderer.compute(this.stepNodes[parity]);
  }

  update(params: KoraParams): void {
    const u = this.u;
    u.spawnHeat.value = params.sparkSpawnHeat;
    u.spawnChance.value = params.sparkSpawnRate;
    u.ejectSpeed.value = params.sparkEjectSpeed;
    u.life.value = params.sparkLife;
    u.dragRate.value = params.sparkDrag;
    u.cooling.value = params.sparkCooling;
    u.gravity.value = params.gravity;
    u.size.value = params.sparkSize;
    u.streak.value = params.sparkStreak;
    u.intensity.value = params.sparkIntensity;
    u.obstacles.value = params.obstacleCount > 0 ? 1 : 0;

    this.mesh.visible = params.sparksEnabled;
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    (this.mesh.material as SpriteNodeMaterial).dispose();
  }
}
