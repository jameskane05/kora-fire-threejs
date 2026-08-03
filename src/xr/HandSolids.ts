/**
 * Tracked-hand → fire solid bridge.
 *
 * Writes one palm-shaped box per hand into reserved obstacle slots. Intended for XR only: those
 * slots must be counted in `obstacleCount` (rebuild) while presenting, then dropped on exit so
 * the desktop / flat sandbox path does not pay solid-bake cost for parked hands.
 */
import { Matrix4, Quaternion, Vector3, type Object3D, type WebGPURenderer } from 'three/webgpu';
import { MAX_HAND_SOLIDS, baseGeometry } from '../sim/obstacles';
import type { KoraUniforms } from '../sim/uniforms';

export { MAX_HAND_SOLIDS };

const MOTION_FLOOR = 1e-3;
/** Fallback palm width (metres) when joint span is unavailable. */
const PALM_WIDTH_FALLBACK_M = 0.09;
/** Palm thickness (metres) — flat box, not a ball sticking out of the hand. */
const PALM_THICKNESS_M = 0.028;
/** Bias from wrist toward the middle knuckle — centres the hitbox in the palm, not at the cuff. */
const PALM_CENTRE_T = 0.62;

const _world = new Vector3();
const _worldB = new Vector3();
const _worldC = new Vector3();
const _local = new Vector3();
const _localB = new Vector3();
const _indexLocal = new Vector3();
const _pinkyLocal = new Vector3();
const _mid = new Vector3();
const _scale = new Vector3();
const _axisX = new Vector3();
const _axisY = new Vector3();
const _axisZ = new Vector3();
const _mat = new Matrix4();
const _quat = new Quaternion();
const _inv = new Quaternion();

function parkSlot(uniforms: KoraUniforms, index: number): void {
  const slot = uniforms.obstacles[index];
  if (!slot) return;
  slot.centre.value.set(0, -100, 0);
  slot.size.value.set(0, 0, 0, 0);
  slot.scale.value.set(1, 1, 1);
  slot.rotation.value.set(0, 0, 0, 1);
  slot.velocity.value.set(0, 0, 0);
  slot.spin.value.set(0, 0, 0);
}

function jointPose(
  hand: XRHand,
  name: XRHandJoint,
  xrFrame: XRFrame,
  refSpace: XRReferenceSpace,
): XRPose | XRJointPose | null {
  const space = hand.get(name);
  if (!space) return null;
  return xrFrame.getJointPose?.(space, refSpace) ?? xrFrame.getPose(space, refSpace) ?? null;
}

export class HandSolids {
  private readonly prevCentre = Array.from({ length: MAX_HAND_SOLIDS }, () => new Vector3());
  private readonly hadPrev = Array.from({ length: MAX_HAND_SOLIDS }, () => false);
  private enabled = false;

  setEnabled(on: boolean): void {
    this.enabled = on;
    if (!on) {
      for (let i = 0; i < MAX_HAND_SOLIDS; i++) this.hadPrev[i] = false;
    }
  }

  get active(): boolean {
    return this.enabled;
  }

  /**
   * Write palm boxes into `uniforms.obstacles[baseIndex .. baseIndex+MAX_HAND_SOLIDS)`.
   * No-ops when disabled; parks slots when a hand pose is missing.
   */
  update(
    uniforms: KoraUniforms,
    baseIndex: number,
    content: Object3D | null,
    renderer: WebGPURenderer,
    xrFrame: XRFrame | undefined,
    dt: number,
  ): void {
    if (!this.enabled) return;

    const written = Array.from({ length: MAX_HAND_SOLIDS }, () => false);

    if (content && xrFrame && dt > 0) {
      const session = renderer.xr.getSession();
      const refSpace = renderer.xr.getReferenceSpace();
      if (session && refSpace) {
        content.updateMatrixWorld(true);
        content.getWorldScale(_scale);
        const worldScale = Math.max(_scale.x, 1e-4);

        let slot = 0;
        for (const source of session.inputSources) {
          if (slot >= MAX_HAND_SOLIDS) break;
          if ((source.handedness !== 'left' && source.handedness !== 'right') || !source.hand) {
            continue;
          }

          const wristPose = jointPose(source.hand, 'wrist', xrFrame, refSpace);
          const knucklePose =
            jointPose(source.hand, 'middle-finger-phalanx-proximal', xrFrame, refSpace) ??
            jointPose(source.hand, 'middle-finger-metacarpal', xrFrame, refSpace);
          const indexPose = jointPose(source.hand, 'index-finger-metacarpal', xrFrame, refSpace);
          const pinkyPose = jointPose(source.hand, 'pinky-finger-metacarpal', xrFrame, refSpace);
          if (!wristPose || !knucklePose) continue;

          const w = wristPose.transform.position;
          const k = knucklePose.transform.position;
          _world.set(w.x, w.y, w.z);
          _worldB.set(k.x, k.y, k.z);
          content.worldToLocal(_local.copy(_world));
          content.worldToLocal(_localB.copy(_worldB));
          _mid.lerpVectors(_local, _localB, PALM_CENTRE_T);

          let palmWidthM = PALM_WIDTH_FALLBACK_M;
          if (indexPose && pinkyPose) {
            const i = indexPose.transform.position;
            const p = pinkyPose.transform.position;
            _worldC.set(i.x, i.y, i.z);
            content.worldToLocal(_indexLocal.copy(_worldC));
            _worldC.set(p.x, p.y, p.z);
            content.worldToLocal(_pinkyLocal.copy(_worldC));
            palmWidthM = Math.max(
              _indexLocal.distanceTo(_pinkyLocal) * worldScale,
              PALM_WIDTH_FALLBACK_M * 0.75,
            );
          } else {
            _indexLocal.copy(_local);
            _pinkyLocal.copy(_local);
          }

          const lengthM = Math.max(_local.distanceTo(_localB) * worldScale, 0.055);
          const widthContent = (palmWidthM * 1.05) / worldScale;
          const lengthContent = (lengthM * 1.15) / worldScale;
          const thickContent = PALM_THICKNESS_M / worldScale;

          // Palm frame: X across (index→pinky), Y along fingers (wrist→knuckle), Z = palm normal.
          _axisY.subVectors(_localB, _local);
          if (_axisY.lengthSq() < 1e-10) continue;
          _axisY.normalize();
          _axisX.subVectors(_indexLocal, _pinkyLocal);
          if (_axisX.lengthSq() < 1e-10) {
            _axisZ.set(0, 1, 0);
            _axisX.crossVectors(_axisY, _axisZ);
            if (_axisX.lengthSq() < 1e-10) _axisX.set(1, 0, 0);
          }
          _axisX.normalize();
          _axisZ.crossVectors(_axisX, _axisY).normalize();
          _axisX.crossVectors(_axisY, _axisZ).normalize();
          _mat.makeBasis(_axisX, _axisY, _axisZ);
          _quat.setFromRotationMatrix(_mat);
          _inv.copy(_quat).invert();

          const base = baseGeometry('box', 1);

          const index = baseIndex + slot;
          const dest = uniforms.obstacles[index];
          if (!dest) break;

          dest.centre.value.copy(_mid);
          // Unit box × non-uniform scale (same path as gizmo boxes): full size ≈ palm W×L×T.
          dest.size.value.set(base.extents.x, base.extents.y, base.extents.z, base.round);
          dest.scale.value.set(
            Math.max(widthContent, 1e-3),
            Math.max(lengthContent, 1e-3),
            Math.max(thickContent, 1e-3),
          );
          dest.rotation.value.set(_inv.x, _inv.y, _inv.z, _inv.w);
          dest.spin.value.set(0, 0, 0);

          if (this.hadPrev[slot]) {
            dest.velocity.value.subVectors(_mid, this.prevCentre[slot]).divideScalar(dt);
            if (dest.velocity.value.lengthSq() < MOTION_FLOOR * MOTION_FLOOR) {
              dest.velocity.value.set(0, 0, 0);
            }
          } else {
            dest.velocity.value.set(0, 0, 0);
          }

          this.prevCentre[slot].copy(_mid);
          this.hadPrev[slot] = true;
          written[slot] = true;
          slot++;
        }
      }
    }

    for (let i = 0; i < MAX_HAND_SOLIDS; i++) {
      if (!written[i]) {
        parkSlot(uniforms, baseIndex + i);
        this.hadPrev[i] = false;
      }
    }
  }
}
