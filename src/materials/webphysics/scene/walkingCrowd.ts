import * as THREE from 'three';
import { StorageBufferAttribute } from 'three/webgpu';
import { PhysicsEngine } from '../physics/PhysicsEngine';
import { createRagdollFactory, createRagdollSkeleton, type RagdollInstance } from './ragdollFactory';
import type { TrackedBodyVisualSet } from './trackedBodyVisuals';
import { WalkerImpactProbeStage } from './walkerImpactProbe';
import {
  DEFAULT_WALK_GAIT,
  WALKER_BODIES,
  WALKER_MODE_RAGDOLL,
  WALKER_MODE_WALKING,
  WALKER_STATE_VEC4S,
  WalkCycleStage,
  type WalkCycleGait,
} from './walkCycle';

const TAU = Math.PI * 2.0;

/** Ground the crowd walks on, and the boundary past which a walker is in mid-air. */
export type WalkableRegion = {
  groundY: number;
  /** Distance to the walkable boundary; negative once a walker is past the edge. */
  distanceToEdge: (x: number, z: number) => number;
  /** Unit direction back toward safety at (x, z). */
  inwardDirection: (x: number, z: number, out: THREE.Vector2) => void;
  /** Map two unit randoms onto a point inside the region, `inset` scaling it about the centre. */
  samplePoint: (u1: number, u2: number, inset: number, out: THREE.Vector2) => void;
  /** Map two unit randoms onto a point past the boundary, for a walker who is going to step off. */
  samplePointBeyondEdge: (u1: number, u2: number, out: THREE.Vector2) => void;
};

export type WalkingCrowdConfig = {
  scene: THREE.Object3D;
  physics: PhysicsEngine;
  count: number;
  region: WalkableRegion;
  /** Radius of the initial scatter around the origin. */
  spawnRadius: number;
  scale?: number;
  colorBucketCount?: number;
  gait?: Partial<WalkCycleGait>;
  /** Group/mask applied once a walker becomes a real ragdoll. */
  ragdollCollisionGroup: number;
  ragdollCollisionMask: number;
};

export type WalkingCrowd = {
  trackedVisualSets: TrackedBodyVisualSet[];
  /** Advance the crowd and drive its poses. Must run before `PhysicsEngine.step`. */
  updateBeforeStep: (dt: number, renderer: any) => void;
  /** Ragdoll the first walker under a ray, so a grab can take hold of it. */
  activateWalkerByRay: (origin: [number, number, number], dir: [number, number, number]) => number | null;
  /** Consecutive kinematic bodies (hand / collider pools) that knock a walker down when swept. */
  setImpactorRange: (base: number, count: number) => void;
  reset: () => void;
  statusText: () => string;
  dispose: () => void;
};

/** Heading wobble around the straight line to the current goal, so paths are not ruler-straight. */
const WANDER_JITTER = 0.34;
const MAX_TURN_RATE = 1.9;
const SPEED_MIN = 0.35;
const SPEED_MAX = 1.85;
const SPEED_ACCEL = 1.4;
const CADENCE_BASE = 1.35;
const CADENCE_SPEED_GAIN = 0.55;
const CADENCE_MIN = 1.15;
const CADENCE_MAX = 2.7;
const EDGE_LOOK_AHEAD = 6.0;
const EDGE_STEER_WEIGHT = 3.2;
const SEPARATION_RADIUS = 1.5;
const SEPARATION_WEIGHT = 1.5;
const GOAL_ARRIVE_RADIUS = 1.8;
/** Give up on an unreachable goal — a walker pinned against the rim by edge steering, say. */
const GOAL_TIMEOUT = 24.0;
/** A walk to the rim can cross the whole plateau, so it gets a longer budget before being dropped. */
const DARING_GOAL_TIMEOUT = 70.0;
/** Fraction of the walkable extent ordinary goals are drawn from. */
const ROAM_GOAL_INSET = 0.82;
/** Chance a fresh goal is past the rim, which the walker then ignores the drop to reach. */
const DARING_GOAL_CHANCE = 0.02;
/** Pairwise separation is O(n^2); the crowd is small, but do not let it grow silently. */
const SEPARATION_MAX_COUNT = 512;
/** Fraction of a knock-down velocity handed to the limbs, the rest of the walker lagging behind. */
const KICK_LOWER_BODY_SHARE = 0.35;
/** Trunk spin, in rad/s, as a walker goes off their feet. */
const TOPPLE_RATE_MIN = 2.2;
const TOPPLE_RATE_MAX = 4.0;
/**
 * Per-limb speed, in m/s, along the direction a felled walker topples: the upper body goes with the
 * fall and the legs come out from under it.
 *
 * Without this a walker just melts. The joints carry no angular limits, so a limp skeleton folds
 * symmetrically and sinks straight down, and the trunk ends up parked on its own base — a box
 * standing on a face, which is stable, so it stays stood up indefinitely. Spinning the trunk alone
 * does not do it either: five infinitely stiff joints tie it to limbs that are not moving, and they
 * soak up the rotation. Sweeping the legs the other way rotates the whole skeleton at once.
 */
const TOPPLE_SWEEP = [1.4, 1.4, 0.7, 0.7, 0.7, 0.7, -2.2, -2.2, -2.2, -2.2];
/** Floor on the forward speed a walker carries over the rim, since the slow ones barely lean. */
const EDGE_TRIP_SPEED = 1.6;

function hash01(seed: number): number {
  const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453123;
  return x - Math.floor(x);
}

function wrapPi(angle: number): number {
  let wrapped = angle;
  while (wrapped > Math.PI) wrapped -= TAU;
  while (wrapped < -Math.PI) wrapped += TAU;
  return wrapped;
}

/**
 * A crowd of ragdolls that walk until something takes their feet out from under them.
 *
 * While walking, each body is kinematic: it emits no broadphase pairs and its joints pick up no
 * constraint rows, so the solver does no work for it at all. The pose comes from a single compute
 * dispatch (see `WalkCycleStage`), and the CPU only carries a handful of floats per walker.
 *
 * The handover to real physics is the interesting part. Restoring mass, inertia and the nine
 * joints is enough because the walk cycle already left the animation's velocities in the solver's
 * buffers and posed every limb on the joint anchors, so the ragdoll starts satisfied and moving.
 */
export function createWalkingCrowd(config: WalkingCrowdConfig): WalkingCrowd {
  const {
    scene,
    physics,
    count,
    region,
    spawnRadius,
    scale = 1.0,
    colorBucketCount = 24,
    ragdollCollisionGroup,
    ragdollCollisionMask,
  } = config;
  const gait: WalkCycleGait = { ...DEFAULT_WALK_GAIT, ...config.gait };
  const skeleton = createRagdollSkeleton(scale);

  const factory = createRagdollFactory({
    scene,
    physics,
    totalRagdolls: count,
    collisionGroup: ragdollCollisionGroup,
    collisionMask: ragdollCollisionMask,
    colorBucketCount,
    scale,
    defaultPose: 'standing',
    selfCollision: false,
  });

  const instances: RagdollInstance[] = [];
  const mode = new Uint8Array(count);
  const posX = new Float32Array(count);
  const posZ = new Float32Array(count);
  const heading = new Float32Array(count);
  const phase = new Float32Array(count);
  const stride = new Float32Array(count);
  const speed = new Float32Array(count);
  const prevPosX = new Float32Array(count);
  const prevPosZ = new Float32Array(count);
  const prevHeading = new Float32Array(count);
  const prevPhase = new Float32Array(count);
  const prevStride = new Float32Array(count);
  const spawnX = new Float32Array(count);
  const spawnZ = new Float32Array(count);
  const spawnHeading = new Float32Array(count);
  const seedA = new Float32Array(count);
  const seedC = new Float32Array(count);
  const steerX = new Float32Array(count);
  const steerZ = new Float32Array(count);
  const goalX = new Float32Array(count);
  const goalZ = new Float32Array(count);
  const goalAge = new Float32Array(count);
  const goalRoll = new Uint32Array(count);
  /** Set while chasing a goal past the rim: edge steering is off, so this walker will step off. */
  const daring = new Uint8Array(count);

  const stateData = new Float32Array(count * WALKER_STATE_VEC4S * 4);
  const stateAttr = new StorageBufferAttribute(stateData, 4);

  const hipHeight = skeleton.legHalfExtents[1] * 4.0 * gait.hipHeightFraction;
  const trunkCentreHeight = hipHeight - skeleton.hipAnchor[1];
  const walkerHeight = trunkCentreHeight + skeleton.headAnchorY + skeleton.headRadius;
  const grabHalfWidth = skeleton.trunkHalfExtents[0] + 0.2 * scale;
  const inward = new THREE.Vector2();
  const sampled = new THREE.Vector2();

  let walkStage: WalkCycleStage | null = null;
  let impactProbe: WalkerImpactProbeStage | null = null;
  let clock = 0;
  let fallenCount = 0;
  // The hand pool is allocated lazily by the exhibit, so the range can arrive before the probe.
  let impactorBase = 0;
  let impactorCount = 0;

  const writeWalkerState = (index: number): void => {
    const base = index * WALKER_STATE_VEC4S * 4;
    stateData[base + 0] = posX[index];
    stateData[base + 1] = region.groundY;
    stateData[base + 2] = posZ[index];
    stateData[base + 3] = heading[index];
    stateData[base + 4] = phase[index];
    stateData[base + 5] = stride[index];
    stateData[base + 6] = mode[index];
    stateData[base + 7] = instances[index].bodies[0];
    stateData[base + 8] = prevPosX[index];
    stateData[base + 9] = region.groundY;
    stateData[base + 10] = prevPosZ[index];
    stateData[base + 11] = prevHeading[index];
    stateData[base + 12] = prevPhase[index];
    stateData[base + 13] = prevStride[index];
  };

  const pickGoal = (index: number): void => {
    goalRoll[index] = (goalRoll[index] + 1) & 0xffff;
    const seed = index * 19.73 + goalRoll[index] * 7.31;
    const bold = hash01(seed + 0.13) < DARING_GOAL_CHANCE;
    daring[index] = bold ? 1 : 0;
    const u1 = hash01(seed + 1.77);
    const u2 = hash01(seed + 4.31);
    if (bold) region.samplePointBeyondEdge(u1, u2, sampled);
    else region.samplePoint(u1, u2, ROAM_GOAL_INSET, sampled);
    goalX[index] = sampled.x;
    goalZ[index] = sampled.y;
    goalAge[index] = 0.0;
  };

  const spawnWalker = (index: number, x: number, z: number, facing: number): void => {
    posX[index] = x;
    posZ[index] = z;
    heading[index] = facing;
    prevPosX[index] = x;
    prevPosZ[index] = z;
    prevHeading[index] = facing;
    phase[index] = hash01(index * 7.13 + 2.7) * TAU;
    prevPhase[index] = phase[index];
    speed[index] = SPEED_MIN + hash01(index * 11.7 + 5.1) * (SPEED_MAX - SPEED_MIN);
    stride[index] = 0.0;
    prevStride[index] = 0.0;
    mode[index] = WALKER_MODE_WALKING;
    pickGoal(index);
  };

  for (let index = 0; index < count; index++) {
    const angle = hash01(index * 3.7 + 1.1) * TAU;
    const spread = Math.sqrt(hash01(index * 5.3 + 0.4));
    // Scatter over the region by rejection-free polar placement around the centre, then nudge
    // anyone who landed past the boundary back inside.
    let x = Math.cos(angle) * spread * spawnRadius;
    let z = Math.sin(angle) * spread * spawnRadius;
    for (let attempt = 0; attempt < 8 && region.distanceToEdge(x, z) < 1.0; attempt++) {
      region.inwardDirection(x, z, inward);
      x += inward.x * 2.5;
      z += inward.y * 2.5;
    }
    spawnX[index] = x;
    spawnZ[index] = z;
    spawnHeading[index] = hash01(index * 17.3 + 9.4) * TAU;
    seedA[index] = hash01(index * 23.1 + 3.3) * TAU;
    seedC[index] = hash01(index * 31.9 + 12.1) * TAU;

    spawnWalker(index, x, z, spawnHeading[index]);
    const instance = factory.addRagdoll({
      index,
      rootPosition: [x, region.groundY + trunkCentreHeight, z],
      rootQuaternion: [0.0, Math.sin(spawnHeading[index] * 0.5), 0.0, Math.cos(spawnHeading[index] * 0.5)],
      kinematic: true,
    });
    if (instance.bodies.length !== WALKER_BODIES) {
      throw new Error(`Walking crowd expects ${WALKER_BODIES} bodies per ragdoll`);
    }
    for (let limb = 1; limb < instance.bodies.length; limb++) {
      if (instance.bodies[limb] !== instance.bodies[0] + limb) {
        throw new Error('Walking crowd requires consecutive ragdoll body indices');
      }
    }
    instances.push(instance);
    writeWalkerState(index);
  }
  stateAttr.needsUpdate = true;

  const activate = (index: number, kick?: [number, number, number]): void => {
    if (mode[index] !== WALKER_MODE_WALKING) return;
    mode[index] = WALKER_MODE_RAGDOLL;
    fallenCount++;
    const instance = instances[index];
    const [fallX, fallZ] = toppleDirection(index, kick);
    const spinRate = TOPPLE_RATE_MIN
      + hash01(index * 8.13 + clock * 0.19) * (TOPPLE_RATE_MAX - TOPPLE_RATE_MIN);
    for (let limb = 0; limb < instance.bodies.length; limb++) {
      const body = instance.bodies[limb];
      physics.setBodyMass(body, instance.masses[limb]);
      physics.setBodyCollisionFilter(body, ragdollCollisionGroup, ragdollCollisionMask);
      // The blow that felled this walker landed on a zero-mass body, so hand the momentum over
      // here. The upper body takes the full share, which is what tips the walker over rather than
      // sliding it along on its feet.
      const share = limb <= 1 ? 1.0 : KICK_LOWER_BODY_SHARE;
      const sweep = TOPPLE_SWEEP[limb]!;
      physics.setBodyVelocity(
        body,
        [
          (kick ? kick[0] * share : 0.0) + fallX * sweep,
          kick ? kick[1] * share : 0.0,
          (kick ? kick[2] * share : 0.0) + fallZ * sweep,
        ],
        // Every segment gets the same spin, so the skeleton pitches over as one piece and the
        // joints have nothing to resist. Spinning the trunk alone leaves the limbs behind, and the
        // joints tying them together simply cancel the rotation.
        [fallZ * spinRate, 0.0, -fallX * spinRate],
      );
    }
    for (const joint of instance.joints) physics.setJointEnabled(joint, true);
    writeWalkerState(index);
  };

  /** Horizontal direction the walker falls in: the way they were hit, or an arbitrary one. */
  const toppleDirection = (index: number, kick?: [number, number, number]): [number, number] => {
    const kickSpeed = kick ? Math.hypot(kick[0], kick[2]) : 0.0;
    if (kickSpeed > 0.2) return [kick![0] / kickSpeed, kick![2] / kickSpeed];
    const angle = hash01(index * 3.71 + clock * 0.37) * TAU;
    return [Math.sin(angle), Math.cos(angle)];
  };

  const deactivate = (index: number): void => {
    const instance = instances[index];
    for (let limb = 0; limb < instance.bodies.length; limb++) {
      physics.setBodyMass(instance.bodies[limb], 0.0);
      physics.setBodyCollisionFilter(instance.bodies[limb], ragdollCollisionGroup, 0);
    }
    for (const joint of instance.joints) physics.setJointEnabled(joint, false);
  };

  const accumulateSeparation = (): void => {
    if (count > SEPARATION_MAX_COUNT) return;
    for (let a = 0; a < count; a++) {
      if (mode[a] !== WALKER_MODE_WALKING) continue;
      for (let b = a + 1; b < count; b++) {
        if (mode[b] !== WALKER_MODE_WALKING) continue;
        const dx = posX[a] - posX[b];
        const dz = posZ[a] - posZ[b];
        const dist2 = dx * dx + dz * dz;
        if (dist2 > SEPARATION_RADIUS * SEPARATION_RADIUS || dist2 < 1e-6) continue;
        const dist = Math.sqrt(dist2);
        const push = (1.0 - dist / SEPARATION_RADIUS) / dist;
        steerX[a] += dx * push;
        steerZ[a] += dz * push;
        steerX[b] -= dx * push;
        steerZ[b] -= dz * push;
      }
    }
  };

  const stepWalkers = (dt: number): void => {
    clock += dt;
    steerX.fill(0.0);
    steerZ.fill(0.0);
    accumulateSeparation();

    for (let index = 0; index < count; index++) {
      if (mode[index] !== WALKER_MODE_WALKING) continue;

      prevPosX[index] = posX[index];
      prevPosZ[index] = posZ[index];
      prevHeading[index] = heading[index];
      prevPhase[index] = phase[index];
      prevStride[index] = stride[index];

      goalAge[index] += dt;
      const toGoalX = goalX[index] - posX[index];
      const toGoalZ = goalZ[index] - posZ[index];
      const goalTimeout = daring[index] === 1 ? DARING_GOAL_TIMEOUT : GOAL_TIMEOUT;
      if (
        toGoalX * toGoalX + toGoalZ * toGoalZ < GOAL_ARRIVE_RADIUS * GOAL_ARRIVE_RADIUS
        || goalAge[index] > goalTimeout
      ) {
        pickGoal(index);
      }

      const goalHeading = Math.atan2(toGoalX, toGoalZ)
        + WANDER_JITTER * Math.sin(clock * 0.53 + seedA[index]);
      let desiredX = Math.sin(goalHeading) + steerX[index] * SEPARATION_WEIGHT;
      let desiredZ = Math.cos(goalHeading) + steerZ[index] * SEPARATION_WEIGHT;

      const edgeDistance = region.distanceToEdge(posX[index], posZ[index]);
      if (daring[index] === 0 && edgeDistance < EDGE_LOOK_AHEAD) {
        region.inwardDirection(posX[index], posZ[index], inward);
        const urgency = EDGE_STEER_WEIGHT * (1.0 - Math.max(edgeDistance, 0.0) / EDGE_LOOK_AHEAD);
        desiredX += inward.x * urgency;
        desiredZ += inward.y * urgency;
      }

      if (desiredX * desiredX + desiredZ * desiredZ > 1e-8) {
        const diff = wrapPi(Math.atan2(desiredX, desiredZ) - heading[index]);
        const limit = MAX_TURN_RATE * dt;
        // Kept wrapped: an unbounded heading would make `wrapPi` spin and the walk kernel's
        // finite-difference angular velocity lose precision.
        heading[index] = wrapPi(heading[index] + Math.max(-limit, Math.min(limit, diff)));
      }

      const targetSpeed = SPEED_MIN
        + (SPEED_MAX - SPEED_MIN) * (0.5 + 0.5 * Math.sin(clock * 0.23 + seedC[index]));
      const speedDelta = targetSpeed - speed[index];
      const speedLimit = SPEED_ACCEL * dt;
      speed[index] += Math.max(-speedLimit, Math.min(speedLimit, speedDelta));

      const cadence = Math.max(
        CADENCE_MIN,
        Math.min(CADENCE_MAX, CADENCE_BASE + speed[index] * CADENCE_SPEED_GAIN),
      );
      // Stride follows cadence so the stance foot travels exactly as far as the body does.
      stride[index] = speed[index] / cadence;
      phase[index] = (phase[index] + Math.PI * cadence * dt) % TAU;

      posX[index] += Math.sin(heading[index]) * speed[index] * dt;
      posZ[index] += Math.cos(heading[index]) * speed[index] * dt;

      if (region.distanceToEdge(posX[index], posZ[index]) < 0.0) {
        // Trip in the direction of travel, so a walker who reaches the rim pitches out over it
        // rather than toppling whichever way and coming to rest on solid ground.
        const trip = Math.max(speed[index], EDGE_TRIP_SPEED);
        activate(index, [Math.sin(heading[index]) * trip, 0.0, Math.cos(heading[index]) * trip]);
      }
    }
  };

  return {
    trackedVisualSets: factory.trackedVisualSets,

    updateBeforeStep(dt: number, renderer: any): void {
      if (!renderer) return;
      if (!walkStage) {
        const buffers = physics.getKinematicDriveBuffers();
        if (!buffers) return;
        walkStage = new WalkCycleStage({
          skeleton,
          gait,
          walkerState: stateAttr,
          walkerCapacity: count,
          positions: buffers.positions,
          quaternions: buffers.quaternions,
          velocities: buffers.velocities,
          angularVelocities: buffers.angularVelocities,
          maxBodies: physics.config.maxBodies,
        });
        impactProbe = new WalkerImpactProbeStage({
          walkerState: stateAttr,
          walkerCapacity: count,
          positions: buffers.positions,
          velocities: buffers.velocities,
          maxBodies: physics.config.maxBodies,
          walkerCentreY: walkerHeight * 0.5,
          walkerHalfHeight: walkerHeight * 0.5 + 0.25,
          walkerRadius: grabHalfWidth + 0.25,
          walkerMass: instances[0].masses.reduce((sum, mass) => sum + mass, 0.0),
        });
        impactProbe.setImpactorRange(impactorBase, impactorCount);
      }

      stepWalkers(dt);

      const struck = impactProbe?.consumeHits();
      if (struck) {
        for (let index = 0; index < count; index++) {
          const base = index * 4;
          if (struck[base + 3]! > 0.5) {
            activate(index, [struck[base]!, struck[base + 1]!, struck[base + 2]!]);
          }
        }
      }

      for (let index = 0; index < count; index++) writeWalkerState(index);
      stateAttr.needsUpdate = true;

      walkStage.dispatch(renderer, count, dt);
      impactProbe?.dispatch(renderer, count, physics.getBodyCount());
      impactProbe?.requestHits(renderer);
    },

    setImpactorRange(base: number, count: number): void {
      impactorBase = base;
      impactorCount = count;
      impactProbe?.setImpactorRange(base, count);
    },

    activateWalkerByRay(origin, dir): number | null {
      const length = Math.hypot(dir[0], dir[1], dir[2]);
      if (length < 1e-6) return null;
      const dx = dir[0] / length;
      const dy = dir[1] / length;
      const dz = dir[2] / length;
      let bestT = Infinity;
      let bestIndex = -1;
      for (let index = 0; index < count; index++) {
        if (mode[index] !== WALKER_MODE_WALKING) continue;
        // Slab test against an upright box around the walker; the grab only has to identify who
        // was clicked, and the engine's own pick finds the exact limb once the ragdoll is awake.
        const min = [posX[index] - grabHalfWidth, region.groundY, posZ[index] - grabHalfWidth];
        const max = [posX[index] + grabHalfWidth, region.groundY + walkerHeight, posZ[index] + grabHalfWidth];
        const d = [dx, dy, dz];
        let enter = 0.0;
        let exit = Infinity;
        let hit = true;
        for (let axis = 0; axis < 3; axis++) {
          if (Math.abs(d[axis]) < 1e-6) {
            if (origin[axis] < min[axis] || origin[axis] > max[axis]) {
              hit = false;
              break;
            }
            continue;
          }
          const invD = 1.0 / d[axis];
          let t0 = (min[axis] - origin[axis]) * invD;
          let t1 = (max[axis] - origin[axis]) * invD;
          if (t0 > t1) {
            const swap = t0;
            t0 = t1;
            t1 = swap;
          }
          enter = Math.max(enter, t0);
          exit = Math.min(exit, t1);
          if (enter > exit) {
            hit = false;
            break;
          }
        }
        if (!hit || enter >= bestT) continue;
        bestT = enter;
        bestIndex = index;
      }
      if (bestIndex < 0) return null;
      const trunk = instances[bestIndex].bodies[0];
      activate(bestIndex);
      return trunk;
    },

    reset(): void {
      fallenCount = 0;
      clock = 0;
      impactProbe?.discardPending();
      for (let index = 0; index < count; index++) {
        if (mode[index] !== WALKER_MODE_WALKING) deactivate(index);
        spawnWalker(index, spawnX[index], spawnZ[index], spawnHeading[index]);
        writeWalkerState(index);
      }
      stateAttr.needsUpdate = true;
    },

    statusText(): string {
      return `crowd ${count - fallenCount} walking / ${fallenCount} ragdolled`;
    },

    dispose(): void {
      for (const visuals of factory.trackedVisualSets) visuals.dispose();
    },
  };
}
