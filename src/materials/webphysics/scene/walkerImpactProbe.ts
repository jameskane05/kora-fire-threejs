import { StorageBufferAttribute } from 'three/webgpu';
import { assertStorageBufferBudget } from '../physics/gpu/bindingBudget';
import { localId, storage, uniform, wgsl, wgslFn, workgroupId } from '../physics/gpu/tslCompat';
import { WALKER_STATE_VEC4S } from './walkCycle';

const WORKGROUP_SIZE = 64;

/**
 * How hard a body is bearing down on a walker's midline: xyz is the push direction, w the closing
 * speed along it, or -1 in w when the body is nowhere near the walker.
 */
const walkerClosingSpeed = wgsl(/* wgsl */`
  fn walkerClosingSpeed(
    centre: vec3f,
    bodyPosition: vec3f,
    velocity: vec3f,
    halfHeight: f32,
    radiusSq: f32,
  ) -> vec4f {
    let delta = centre - bodyPosition;
    if (abs(delta.y) > halfHeight) { return vec4f(0.0, 0.0, 0.0, -1.0); }
    if (delta.x * delta.x + delta.z * delta.z > radiusSq) { return vec4f(0.0, 0.0, 0.0, -1.0); }
    let distance = length(delta);
    if (distance <= 1.0e-3) { return vec4f(normalize(velocity + vec3f(0.0, 1.0e-6, 0.0)), length(velocity)); }
    let dir = delta / distance;
    return vec4f(dir, dot(velocity, dir));
  }
`);

/**
 * Notices when something is about to knock a walker off its feet.
 *
 * Walkers are collision-filtered out of the solver while they walk, which is what makes them
 * cheap, but it also means they never receive a contact. This probe recovers the one bit that
 * matters — "was I just hit hard enough?" — as a geometric test, in two flavours:
 *
 * - every dynamic body, weighted by momentum, so a resting pile is ignored and a thrown box is not;
 * - the kinematic hand/collider pool, weighted by speed alone, because a hand has infinite mass
 *   and would otherwise either never register or always register.
 *
 * The result also carries the velocity the walker should leave with, because the blow itself landed
 * on an infinite-mass body and was thrown away. Without it a felled walker only sags under gravity,
 * and a limp skeleton that sinks straight down tends to find something to stand on — its own folded
 * shins, or the trunk on its flat base — and stops there looking like a statue.
 *
 * The result is read back asynchronously. Arriving a frame or two late is invisible: the walker
 * turns into a real ragdoll and the solver takes the impact from there.
 */
export class WalkerImpactProbeStage {
  private readonly kernel: any;
  private readonly hitsAttr: StorageBufferAttribute;
  private readonly walkerCapacity: number;
  private latestHits: Float32Array | null = null;
  private readbackInFlight = false;
  /** Bumped on reset so a readback issued against the old crowd is thrown away when it lands. */
  private generation = 0;
  private impactorBase = 0;
  private impactorCount = 0;

  constructor(args: {
    walkerState: StorageBufferAttribute;
    walkerCapacity: number;
    positions: StorageBufferAttribute;
    velocities: StorageBufferAttribute;
    maxBodies: number;
    walkerCentreY: number;
    walkerRadius?: number;
    walkerHalfHeight?: number;
    /** Minimum incoming momentum, in kg m/s, that takes a walker down. */
    momentumThreshold?: number;
    /** Minimum closing speed, in m/s, at which a hand or user-driven collider shoves a walker. */
    shoveSpeedThreshold?: number;
    /** Total mass of one walker, for turning incoming momentum into a departure velocity. */
    walkerMass: number;
    /** Cap on that departure velocity, so a fast crate does not fire a walker off the map. */
    maxKickSpeed?: number;
  }) {
    const { walkerCapacity, maxBodies } = args;
    this.walkerCapacity = walkerCapacity;
    this.hitsAttr = new StorageBufferAttribute(new Float32Array(walkerCapacity * 4), 4);

    const radius = args.walkerRadius ?? 0.7;
    const halfHeight = args.walkerHalfHeight ?? args.walkerCentreY;
    const momentum = args.momentumThreshold ?? 2.2;
    // Above a walker's own top speed, so drifting a hand through the crowd does not fell it.
    const shove = args.shoveSpeedThreshold ?? 2.0;
    const invWalkerMass = 1.0 / Math.max(args.walkerMass, 1.0e-3);
    const maxKick = args.maxKickSpeed ?? 9.0;
    const f = (value: number): string => value.toFixed(6);

    const shader = wgslFn(/* wgsl */`
      fn compute(
        walkerState: ptr<storage, array<vec4f>, read>,
        positions: ptr<storage, array<vec4f>, read>,
        velocities: ptr<storage, array<vec4f>, read>,
        hits: ptr<storage, array<vec4f>, read_write>,
        walkerCount: u32,
        bodyCount: u32,
        impactorBase: u32,
        impactorCount: u32,
        workgroupId: vec3u,
        localId: vec3u,
      ) -> void {
        let gid = workgroupId.x * ${WORKGROUP_SIZE}u + localId.x;
        if (gid >= walkerCount) { return; }

        const RADIUS_SQ = ${f(radius * radius)};
        const HALF_HEIGHT = ${f(halfHeight)};
        const CENTRE_Y = ${f(args.walkerCentreY)};
        const MOMENTUM = ${f(momentum)};
        const SHOVE = ${f(shove)};
        const INV_WALKER_MASS = ${f(invWalkerMass)};
        const MAX_KICK = ${f(maxKick)};

        let stateBase = gid * ${WALKER_STATE_VEC4S}u;
        let gaitNow = walkerState[stateBase + 1u];
        if (gaitNow.z > 0.5) {
          hits[gid] = vec4f(0.0);
          return;
        }
        let pose = walkerState[stateBase];
        let centre = pose.xyz + vec3f(0.0, CENTRE_Y, 0.0);
        let bodyBase = u32(gaitNow.w);

        var struck = 0.0;
        var kick = vec3f(0.0);
        var kickSpeed = 0.0;
        for (var body = 0u; body < bodyCount; body++) {
          if (body >= bodyBase && body < bodyBase + 10u) { continue; }
          let bodyPose = positions[body];
          // Zero inverse mass is scenery, a hand or another walker. Hands get their own pass
          // below; the rest cannot impart an impulse.
          if (bodyPose.w <= 0.0) { continue; }
          let probe = walkerClosingSpeed(
            centre, bodyPose.xyz, velocities[body].xyz, HALF_HEIGHT, RADIUS_SQ,
          );
          if (probe.w / bodyPose.w <= MOMENTUM) { continue; }
          struck = 1.0;
          let speed = min((probe.w / bodyPose.w) * INV_WALKER_MASS, MAX_KICK);
          if (speed > kickSpeed) {
            kickSpeed = speed;
            kick = probe.xyz * speed;
          }
        }

        for (var slot = 0u; slot < impactorCount; slot++) {
          let body = impactorBase + slot;
          let probe = walkerClosingSpeed(
            centre, positions[body].xyz, velocities[body].xyz, HALF_HEIGHT, RADIUS_SQ,
          );
          if (probe.w <= SHOVE) { continue; }
          struck = 1.0;
          // A hand has no mass to trade, so it simply hands over its own speed.
          let speed = min(probe.w, MAX_KICK);
          if (speed > kickSpeed) {
            kickSpeed = speed;
            kick = probe.xyz * speed;
          }
        }
        hits[gid] = vec4f(kick, struck);
      }
    `, [walkerClosingSpeed]);

    this.kernel = shader({
      walkerState: storage(args.walkerState, 'vec4f', walkerCapacity * WALKER_STATE_VEC4S).toReadOnly(),
      positions: storage(args.positions, 'vec4f', maxBodies).toReadOnly(),
      velocities: storage(args.velocities, 'vec4f', maxBodies).toReadOnly(),
      hits: storage(this.hitsAttr, 'vec4f', walkerCapacity),
      walkerCount: uniform(0),
      bodyCount: uniform(0),
      impactorBase: uniform(0),
      impactorCount: uniform(0),
      workgroupId,
      localId,
    }).computeKernel([WORKGROUP_SIZE, 1, 1]).setName('Walker Impact Probe');
    assertStorageBufferBudget('Walker Impact Probe', 4);
  }

  /**
   * Consecutive kinematic bodies — the hand and force-collider pools — that shove on speed alone.
   */
  setImpactorRange(base: number, count: number): void {
    this.impactorBase = Math.max(0, base);
    this.impactorCount = Math.max(0, count);
  }

  dispatch(renderer: any, walkerCount: number, bodyCount: number): void {
    if (walkerCount <= 0) return;
    this.kernel.computeNode.parameters.walkerCount.value = walkerCount;
    this.kernel.computeNode.parameters.bodyCount.value = bodyCount;
    this.kernel.computeNode.parameters.impactorBase.value = this.impactorBase;
    this.kernel.computeNode.parameters.impactorCount.value = this.impactorCount;
    renderer.compute(this.kernel, [Math.ceil(walkerCount / WORKGROUP_SIZE), 1, 1]);
  }

  /**
   * Latest completed probe result, if one has landed since it was last taken: one vec4 per walker,
   * xyz the velocity it should leave with and w non-zero when it was struck.
   */
  consumeHits(): Float32Array | null {
    const hits = this.latestHits;
    this.latestHits = null;
    return hits;
  }

  /** Drop the pending and last results, for when the crowd no longer matches what was probed. */
  discardPending(): void {
    this.generation++;
    this.latestHits = null;
  }

  requestHits(renderer: { getArrayBufferAsync?: (attr: unknown) => Promise<ArrayBuffer> }): void {
    if (this.readbackInFlight || typeof renderer?.getArrayBufferAsync !== 'function') return;
    this.readbackInFlight = true;
    const issued = this.generation;
    void renderer
      .getArrayBufferAsync(this.hitsAttr)
      .then((raw) => {
        if (issued !== this.generation) return;
        this.latestHits = new Float32Array(raw, 0, this.walkerCapacity * 4);
      })
      .catch(() => undefined)
      .finally(() => {
        this.readbackInFlight = false;
      });
  }
}
