/**
 * Hand joints as oriented boxes in an arbitrary object's local space.
 *
 * The MPM path wants normalized [0,1] domain coordinates, but the AVBD presets are authored in
 * metres at whatever scale the demo happens to use, so this returns boxes in the target's own
 * space and lets the rig scale do the unit conversion.
 */
import { Matrix4, Object3D, Quaternion, Vector3 } from 'three';

export type HandBone = { from: XRHandJoint; to: XRHandJoint; palm?: boolean };

/** Finger / palm bone segments — oriented boxes between consecutive joints. */
export const HAND_BONES: HandBone[] = [
  { from: 'thumb-metacarpal', to: 'thumb-phalanx-proximal' },
  { from: 'thumb-phalanx-proximal', to: 'thumb-phalanx-distal' },
  { from: 'thumb-phalanx-distal', to: 'thumb-tip' },
  { from: 'index-finger-metacarpal', to: 'index-finger-phalanx-proximal' },
  { from: 'index-finger-phalanx-proximal', to: 'index-finger-phalanx-intermediate' },
  { from: 'index-finger-phalanx-intermediate', to: 'index-finger-phalanx-distal' },
  { from: 'index-finger-phalanx-distal', to: 'index-finger-tip' },
  { from: 'middle-finger-metacarpal', to: 'middle-finger-phalanx-proximal' },
  { from: 'middle-finger-phalanx-proximal', to: 'middle-finger-phalanx-intermediate' },
  { from: 'middle-finger-phalanx-intermediate', to: 'middle-finger-phalanx-distal' },
  { from: 'middle-finger-phalanx-distal', to: 'middle-finger-tip' },
  { from: 'ring-finger-metacarpal', to: 'ring-finger-phalanx-proximal' },
  { from: 'ring-finger-phalanx-proximal', to: 'ring-finger-phalanx-intermediate' },
  { from: 'ring-finger-phalanx-intermediate', to: 'ring-finger-phalanx-distal' },
  { from: 'ring-finger-phalanx-distal', to: 'ring-finger-tip' },
  { from: 'pinky-finger-metacarpal', to: 'pinky-finger-phalanx-proximal' },
  { from: 'pinky-finger-phalanx-proximal', to: 'pinky-finger-phalanx-intermediate' },
  { from: 'pinky-finger-phalanx-intermediate', to: 'pinky-finger-phalanx-distal' },
  { from: 'pinky-finger-phalanx-distal', to: 'pinky-finger-tip' },
  { from: 'wrist', to: 'thumb-metacarpal', palm: true },
  { from: 'wrist', to: 'index-finger-metacarpal', palm: true },
  { from: 'wrist', to: 'middle-finger-metacarpal', palm: true },
  { from: 'wrist', to: 'ring-finger-metacarpal', palm: true },
  { from: 'wrist', to: 'pinky-finger-metacarpal', palm: true },
];

/** Two hands' worth of bone segments. */
export const MAX_HAND_OBBS = HAND_BONES.length * 2;

export type HandObb = {
  position: [number, number, number];
  halfExtents: [number, number, number];
  quaternion: [number, number, number, number];
};

/** Fallback half-width when the runtime does not report a joint radius, in metres. */
const FALLBACK_JOINT_RADIUS_M = 0.009;

const _from = new Vector3();
const _to = new Vector3();
const _mid = new Vector3();
const _axisX = new Vector3();
const _axisY = new Vector3();
const _axisZ = new Vector3();
const _scale = new Vector3();
const _jointQuat = new Quaternion();
const _basis = new Matrix4();
const _boneQuat = new Quaternion();
const _invTarget = new Matrix4();

function makeBoneBasis(axisX: Vector3, axisY: Vector3, axisZ: Vector3): void {
  axisY.addScaledVector(axisX, -axisY.dot(axisX));
  if (axisY.lengthSq() < 1e-8) {
    axisY.set(0, 1, 0);
    if (Math.abs(axisX.y) > 0.9) axisY.set(1, 0, 0);
    axisY.addScaledVector(axisX, -axisY.dot(axisX));
  }
  axisY.normalize();
  axisZ.crossVectors(axisX, axisY).normalize();
  axisY.crossVectors(axisZ, axisX).normalize();
}

function emptyObb(): HandObb {
  return {
    position: [0, 0, 0],
    halfExtents: [0.01, 0.01, 0.01],
    quaternion: [0, 0, 0, 1],
  };
}

const pool: HandObb[] = Array.from({ length: MAX_HAND_OBBS }, emptyObb);

function jointPose(
  hand: XRHand,
  name: XRHandJoint,
  frame: XRFrame,
  referenceSpace: XRReferenceSpace,
) {
  const space = hand.get(name);
  if (!space) return null;
  return frame.getJointPose?.(space, referenceSpace) ?? frame.getPose(space, referenceSpace) ?? null;
}

function poseRadiusM(pose: XRPose | XRJointPose): number | undefined {
  const radius = (pose as XRJointPose).radius;
  return typeof radius === 'number' ? radius : undefined;
}

/**
 * Tracked hand bones as oriented boxes in `target` local space.
 *
 * Returns a reused array — copy it if you need it past the next call.
 */
export function gatherHandObbs(args: {
  session: XRSession | null;
  referenceSpace: XRReferenceSpace | null;
  frame: XRFrame | null | undefined;
  target: Object3D;
}): HandObb[] {
  const { session, referenceSpace, frame, target } = args;
  const out: HandObb[] = [];
  if (!session || !referenceSpace || !frame) return out;

  target.updateMatrixWorld(true);
  target.getWorldScale(_scale);
  const worldScale = Math.max(_scale.x, 1e-6);
  const metresToLocal = 1 / worldScale;
  _invTarget.copy(target.matrixWorld).invert();

  for (const source of session.inputSources) {
    if ((source.handedness !== 'left' && source.handedness !== 'right') || !source.hand) continue;

    for (const bone of HAND_BONES) {
      if (out.length >= pool.length) return out;

      const fromPose = jointPose(source.hand, bone.from, frame, referenceSpace);
      const toPose = jointPose(source.hand, bone.to, frame, referenceSpace);
      if (!fromPose || !toPose) continue;

      const a = fromPose.transform.position;
      const b = toPose.transform.position;
      _from.set(a.x, a.y, a.z).applyMatrix4(_invTarget);
      _to.set(b.x, b.y, b.z).applyMatrix4(_invTarget);

      _axisX.subVectors(_to, _from);
      const boneLength = _axisX.length();
      if (boneLength < 1e-6) continue;
      _axisX.multiplyScalar(1 / boneLength);

      const o = fromPose.transform.orientation;
      _jointQuat.set(o.x, o.y, o.z, o.w);
      _axisY.set(0, 1, 0).applyQuaternion(_jointQuat).transformDirection(_invTarget);
      makeBoneBasis(_axisX, _axisY, _axisZ);

      const fromRadius = poseRadiusM(fromPose);
      const toRadius = poseRadiusM(toPose);
      const radiusM =
        fromRadius !== undefined && toRadius !== undefined
          ? (fromRadius + toRadius) * 0.5
          : FALLBACK_JOINT_RADIUS_M;
      const radius = radiusM * metresToLocal;

      // Slim finger sticks so adjacent bones do not weld into one slab; palms stay wider so a
      // flat hand still reads as a surface rather than five separate rods.
      const isTip = bone.to.endsWith('-tip');
      const widthScale = bone.palm ? 1.15 : isTip ? 0.85 : 0.6;
      const thickScale = bone.palm ? 0.8 : isTip ? 0.85 : 0.45;

      _mid.addVectors(_from, _to).multiplyScalar(0.5);
      _basis.makeBasis(_axisX, _axisY, _axisZ);
      _boneQuat.setFromRotationMatrix(_basis);

      const obb = pool[out.length]!;
      obb.position[0] = _mid.x;
      obb.position[1] = _mid.y;
      obb.position[2] = _mid.z;
      obb.halfExtents[0] = boneLength * 0.5;
      obb.halfExtents[1] = Math.max(radius * widthScale, 1e-4);
      obb.halfExtents[2] = Math.max(radius * thickScale, 1e-4);
      obb.quaternion[0] = _boneQuat.x;
      obb.quaternion[1] = _boneQuat.y;
      obb.quaternion[2] = _boneQuat.z;
      obb.quaternion[3] = _boneQuat.w;
      out.push(obb);
    }
  }

  return out;
}
