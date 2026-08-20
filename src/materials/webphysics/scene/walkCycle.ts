import { StorageBufferAttribute } from 'three/webgpu';
import { assertStorageBufferBudget } from '../physics/gpu/bindingBudget';
import { qconj, qmul, qrot } from '../physics/gpu/quatUtils';
import { localId, storage, uniform, wgsl, wgslFn, workgroupId } from '../physics/gpu/tslCompat';
import type { RagdollSkeleton } from './ragdollFactory';

const WORKGROUP_SIZE = 64;

/** Per walker: pose, gait state, then the same pair from the previous frame for velocities. */
export const WALKER_STATE_VEC4S = 4;
export const WALKER_BODIES = 10;

export const WALKER_MODE_WALKING = 0;
export const WALKER_MODE_RAGDOLL = 1;

export type WalkCycleGait = {
  /** Hip height above the ground plane, as a fraction of full leg reach. */
  hipHeightFraction: number;
  bobAmplitude: number;
  swayAmplitude: number;
  rollAmplitude: number;
  leanPitch: number;
  footLift: number;
  /** Lateral foot placement as a fraction of hip separation; below 1 narrows the stance. */
  footTrack: number;
  armSwing: number;
  armSpread: number;
  elbowBend: number;
};

export const DEFAULT_WALK_GAIT: WalkCycleGait = {
  hipHeightFraction: 0.93,
  bobAmplitude: 0.035,
  swayAmplitude: 0.035,
  rollAmplitude: 0.05,
  leanPitch: 0.07,
  footLift: 0.17,
  footTrack: 0.82,
  armSwing: 0.42,
  armSpread: 0.17,
  elbowBend: 0.45,
};

/** Shortest arc from a limb's local -Y bone axis to a world direction. */
const quatFromDownToDir = wgsl(/* wgsl */`
  fn quatFromDownToDir(d: vec3f) -> vec4f {
    let w = 1.0 - d.y;
    if (w < 1.0e-5) { return vec4f(1.0, 0.0, 0.0, 0.0); }
    return normalize(vec4f(-d.z, 0.0, d.x, w));
  }
`);

const angularVelocityFromQuats = wgsl(/* wgsl */`
  fn angularVelocityFromQuats(qPrev: vec4f, qCur: vec4f, invDt: f32) -> vec3f {
    let hemisphere = select(-1.0, 1.0, dot(qPrev, qCur) >= 0.0);
    let dq = qmul(qCur * hemisphere, qconj(qPrev));
    return 2.0 * dq.xyz * invDt;
  }
`, [qmul, qconj]);

/**
 * Procedural walk cycle, evaluated on the GPU straight into the solver's pose buffers.
 *
 * One thread per walker expands `(ground position, heading, phase, stride)` into the ten limb
 * transforms of a ragdoll, following the same anchor chain `createRagdollFactory` builds its
 * joints from — so a walker's joints are already satisfied when it is handed to the solver.
 *
 * The whole cycle is evaluated twice, at this frame's state and the last, and the difference
 * becomes the bodies' linear and angular velocity. That is what makes the switch to ragdoll
 * continuous: the solver inherits the momentum the animation had, limb swing included.
 */
export class WalkCycleStage {
  private readonly kernel: any;

  constructor(args: {
    skeleton: RagdollSkeleton;
    gait: WalkCycleGait;
    walkerState: StorageBufferAttribute;
    walkerCapacity: number;
    positions: StorageBufferAttribute;
    quaternions: StorageBufferAttribute;
    velocities: StorageBufferAttribute;
    angularVelocities: StorageBufferAttribute;
    maxBodies: number;
  }) {
    const { skeleton, gait, walkerCapacity, maxBodies } = args;
    const legHalfY = skeleton.legHalfExtents[1];
    const armHalfY = skeleton.armHalfExtents[1];
    const legReach = 4.0 * legHalfY;
    const f = (value: number): string => value.toFixed(6);

    const shader = wgslFn(/* wgsl */`
      fn compute(
        walkerState: ptr<storage, array<vec4f>, read>,
        positions: ptr<storage, array<vec4f>, read_write>,
        quaternions: ptr<storage, array<vec4f>, read_write>,
        velocities: ptr<storage, array<vec4f>, read_write>,
        angularVelocities: ptr<storage, array<vec4f>, read_write>,
        walkerCount: u32,
        invDt: f32,
        workgroupId: vec3u,
        localId: vec3u,
      ) -> void {
        let gid = workgroupId.x * ${WORKGROUP_SIZE}u + localId.x;
        if (gid >= walkerCount) { return; }

        const PI = 3.14159265;
        const INV_TAU = 0.15915494;
        const LEG_HALF_Y = ${f(legHalfY)};
        const LEG_REACH = ${f(legReach)};
        const ARM_HALF_Y = ${f(armHalfY)};
        const SHOULDER_X = ${f(skeleton.shoulderAnchor[0])};
        const SHOULDER_Y = ${f(skeleton.shoulderAnchor[1])};
        const HIP_X = ${f(skeleton.hipAnchor[0])};
        const HIP_Y = ${f(skeleton.hipAnchor[1])};
        const HEAD_Y = ${f(skeleton.headAnchorY)};
        const HIP_HEIGHT = ${f(legReach * gait.hipHeightFraction)};
        const BOB = ${f(gait.bobAmplitude * skeleton.scale)};
        const SWAY = ${f(gait.swayAmplitude * skeleton.scale)};
        const ROLL = ${f(gait.rollAmplitude)};
        const LEAN = ${f(gait.leanPitch)};
        const FOOT_LIFT = ${f(gait.footLift * skeleton.scale)};
        const FOOT_TRACK = ${f(gait.footTrack)};
        const ARM_SWING = ${f(gait.armSwing)};
        const ARM_SPREAD = ${f(gait.armSpread)};
        const ELBOW_BEND = ${f(gait.elbowBend)};

        let stateBase = gid * ${WALKER_STATE_VEC4S}u;
        let gaitNow = walkerState[stateBase + 1u];
        if (gaitNow.z > 0.5) { return; }
        let bodyBase = u32(gaitNow.w);

        var limbPos: array<vec3f, ${WALKER_BODIES * 2}>;
        var limbRot: array<vec4f, ${WALKER_BODIES * 2}>;

        for (var sample = 0u; sample < 2u; sample++) {
          let pose = walkerState[stateBase + sample * 2u];
          let gaitState = walkerState[stateBase + 1u + sample * 2u];
          let ground = pose.xyz;
          let heading = pose.w;
          let phase = gaitState.x;
          let stride = gaitState.y;
          let out = sample * ${WALKER_BODIES}u;

          let fwd = vec3f(sin(heading), 0.0, cos(heading));
          let right = vec3f(cos(heading), 0.0, -sin(heading));
          let up = vec3f(0.0, 1.0, 0.0);

          let bob = BOB * cos(2.0 * phase);
          let sway = SWAY * sin(phase);
          let roll = ROLL * sin(phase);
          let qYaw = vec4f(0.0, sin(heading * 0.5), 0.0, cos(heading * 0.5));
          let qLean = vec4f(sin(LEAN * 0.5), 0.0, 0.0, cos(LEAN * 0.5));
          let qRoll = vec4f(0.0, 0.0, sin(roll * 0.5), cos(roll * 0.5));
          let qTrunk = normalize(qmul(qmul(qYaw, qLean), qRoll));

          let hipMid = ground + right * sway + vec3f(0.0, HIP_HEIGHT + bob, 0.0);
          let trunkCenter = hipMid - qrot(qTrunk, vec3f(0.0, HIP_Y, 0.0));
          limbPos[out] = trunkCenter;
          limbRot[out] = qTrunk;
          limbPos[out + 1u] = trunkCenter + qrot(qTrunk, vec3f(0.0, HEAD_Y, 0.0));
          limbRot[out + 1u] = qTrunk;

          for (var side = 0u; side < 2u; side++) {
            let sideSign = select(-1.0, 1.0, side == 1u);
            let limbPhase = phase + select(PI, 0.0, side == 1u);

            let armAngle = ARM_SWING * sin(limbPhase + PI);
            let shoulder = trunkCenter + qrot(qTrunk, vec3f(sideSign * SHOULDER_X, SHOULDER_Y, 0.0));
            let dirUpperArm = normalize(
              fwd * sin(armAngle) + right * (sideSign * ARM_SPREAD) - up * cos(armAngle)
            );
            let elbowAngle = armAngle + ELBOW_BEND;
            let dirForearm = normalize(
              fwd * sin(elbowAngle) + right * (sideSign * ARM_SPREAD * 0.5) - up * cos(elbowAngle)
            );
            let elbow = shoulder + dirUpperArm * (2.0 * ARM_HALF_Y);
            let armOut = out + 2u + side * 2u;
            limbPos[armOut] = shoulder + dirUpperArm * ARM_HALF_Y;
            limbRot[armOut] = quatFromDownToDir(dirUpperArm);
            limbPos[armOut + 1u] = elbow + dirForearm * ARM_HALF_Y;
            limbRot[armOut + 1u] = quatFromDownToDir(dirForearm);

            let cycle = fract(limbPhase * INV_TAU);
            var footForward: f32;
            var footLift: f32;
            if (cycle < 0.5) {
              // Stance: the planted foot tracks backward at exactly body speed, so it
              // covers one stride while the body advances one stride and never slides.
              footForward = stride * (0.5 - cycle * 2.0);
              footLift = 0.0;
            } else {
              let swing = cycle * 2.0 - 1.0;
              footForward = stride * (swing - 0.5);
              footLift = FOOT_LIFT * sin(PI * swing);
            }
            let foot = ground
              + right * (sideSign * HIP_X * FOOT_TRACK + sway * 0.35)
              + fwd * footForward
              + vec3f(0.0, footLift, 0.0);

            // Two equal-length bones put the knee on the perpendicular bisector of hip->foot,
            // so the cosine law collapses to one angle and the bend direction picks the side.
            let hip = trunkCenter + qrot(qTrunk, vec3f(sideSign * HIP_X, HIP_Y, 0.0));
            let toFoot = foot - hip;
            let reach = clamp(length(toFoot), 1.0e-3, LEG_REACH - 1.0e-3);
            let dirToFoot = toFoot / max(length(toFoot), 1.0e-6);
            let bendRaw = fwd - dirToFoot * dot(fwd, dirToFoot);
            let bendLen = length(bendRaw);
            let bend = select(right, bendRaw / max(bendLen, 1.0e-4), bendLen > 1.0e-4);
            let halfAngle = acos(clamp(reach / LEG_REACH, 0.0, 1.0));
            let knee = hip + (dirToFoot * cos(halfAngle) + bend * sin(halfAngle)) * (2.0 * LEG_HALF_Y);

            let dirUpperLeg = normalize(knee - hip);
            let dirLowerLeg = normalize(foot - knee);
            let legOut = out + 6u + side * 2u;
            limbPos[legOut] = hip + dirUpperLeg * LEG_HALF_Y;
            limbRot[legOut] = quatFromDownToDir(dirUpperLeg);
            limbPos[legOut + 1u] = knee + dirLowerLeg * LEG_HALF_Y;
            limbRot[legOut + 1u] = quatFromDownToDir(dirLowerLeg);
          }
        }

        for (var limb = 0u; limb < ${WALKER_BODIES}u; limb++) {
          let body = bodyBase + limb;
          let current = limbPos[limb];
          let previous = limbPos[limb + ${WALKER_BODIES}u];
          let qCurrent = limbRot[limb];
          // Walkers are kinematic while driven, so the inverse mass in .w stays zero.
          positions[body] = vec4f(current, 0.0);
          quaternions[body] = qCurrent;
          velocities[body] = vec4f((current - previous) * invDt, 0.0);
          angularVelocities[body] = vec4f(
            angularVelocityFromQuats(limbRot[limb + ${WALKER_BODIES}u], qCurrent, invDt),
            0.0,
          );
        }
      }
    `, [qmul, qrot, quatFromDownToDir, angularVelocityFromQuats]);

    this.kernel = shader({
      walkerState: storage(args.walkerState, 'vec4f', walkerCapacity * WALKER_STATE_VEC4S).toReadOnly(),
      positions: storage(args.positions, 'vec4f', maxBodies),
      quaternions: storage(args.quaternions, 'vec4f', maxBodies),
      velocities: storage(args.velocities, 'vec4f', maxBodies),
      angularVelocities: storage(args.angularVelocities, 'vec4f', maxBodies),
      walkerCount: uniform(0),
      invDt: uniform(60),
      workgroupId,
      localId,
    }).computeKernel([WORKGROUP_SIZE, 1, 1]).setName('Walk Cycle Pose');
    assertStorageBufferBudget('Walk Cycle Pose', 5);
  }

  dispatch(renderer: any, walkerCount: number, dt: number): void {
    if (walkerCount <= 0) return;
    this.kernel.computeNode.parameters.walkerCount.value = walkerCount;
    this.kernel.computeNode.parameters.invDt.value = 1.0 / Math.max(dt, 1e-4);
    renderer.compute(this.kernel, [Math.ceil(walkerCount / WORKGROUP_SIZE), 1, 1]);
  }
}
