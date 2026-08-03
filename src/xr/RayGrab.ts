/**
 * Holding a scene object during an XR pinch.
 *
 * Translate follows wrist travel (world delta), not the gaze ray tip — selection still uses the
 * ray, but once latched the object rides the hand. A second pinch scales from the ratio of
 * inter-hand distance to the distance when that second pinch began.
 *
 * Rotate / single-hand reach-scale keep the older ray signals for the mode panel.
 */
import { Matrix4, Object3D, Quaternion, Vector3 } from 'three/webgpu';
import type { GizmoMode } from '../scene/Obstacles';

export interface PointerRay {
  origin: Vector3;
  /** unit vector the pointer aims along */
  direction: Vector3;
  orientation: Quaternion;
}

/** Hand travel along the ray, in metres, for one e-fold of scale (single-hand reach mode). */
const REACH_SCALE_GAIN = 2.4;
const SCALE_RANGE = { min: 0.15, max: 4.0 };

/** Keeps a grab from latching onto something unreachably far away. */
const MAX_REACH = 12;

const worldPosition = new Vector3();
const worldQuaternion = new Quaternion();
const parentQuaternion = new Quaternion();
const parentInverse = new Matrix4();
const scratch = new Vector3();
const delta = new Quaternion();
const wristDelta = new Vector3();

type Interaction = 'wrist' | 'ray' | 'twoHand';

export class RayGrab {
  private object: Object3D | null = null;
  private mode: GizmoMode = 'translate';
  private interaction: Interaction = 'wrist';

  private readonly lastWrist = new Vector3();
  private readonly scaleStart = new Vector3();
  private scaleStartDist = 0;

  private readonly start = {
    origin: new Vector3(),
    direction: new Vector3(),
    orientation: new Quaternion(),
    quaternion: new Quaternion(),
    scale: new Vector3(),
    offset: new Vector3(),
    distance: 0,
  };

  get active(): boolean {
    return this.object !== null;
  }

  get held(): Object3D | null {
    return this.object;
  }

  get twoHand(): boolean {
    return this.interaction === 'twoHand';
  }

  begin(object: Object3D, ray: PointerRay, mode: GizmoMode, wrist: Vector3 | null): void {
    object.updateWorldMatrix(true, false);
    object.getWorldPosition(worldPosition);

    this.object = object;
    this.mode = mode;
    object.getWorldQuaternion(this.start.quaternion);
    this.start.scale.copy(object.scale);

    if (mode === 'translate' && wrist) {
      this.interaction = 'wrist';
      this.lastWrist.copy(wrist);
      return;
    }

    this.interaction = 'ray';
    const distance = Math.min(
      Math.max(scratch.subVectors(worldPosition, ray.origin).dot(ray.direction), 0),
      MAX_REACH,
    );

    this.start.origin.copy(ray.origin);
    this.start.direction.copy(ray.direction);
    this.start.orientation.copy(ray.orientation);
    this.start.distance = distance;
    this.start.offset
      .copy(worldPosition)
      .sub(scratch.copy(ray.direction).multiplyScalar(distance).add(ray.origin));
  }

  /** Re-anchor wrist tracking after a second hand leaves, so the object does not jump. */
  resumeWrist(wrist: Vector3): void {
    if (!this.object || this.mode !== 'translate') return;
    this.interaction = 'wrist';
    this.lastWrist.copy(wrist);
  }

  moveWrist(wrist: Vector3): void {
    const object = this.object;
    if (!object?.parent || this.interaction !== 'wrist') return;

    wristDelta.subVectors(wrist, this.lastWrist);
    this.lastWrist.copy(wrist);
    if (wristDelta.lengthSq() === 0) return;

    object.updateWorldMatrix(true, false);
    object.getWorldPosition(worldPosition).add(wristDelta);

    parentInverse.copy(object.parent.matrixWorld).invert();
    object.position.copy(worldPosition.applyMatrix4(parentInverse));
  }

  beginTwoHandScale(distance: number): void {
    if (!this.object) return;
    this.interaction = 'twoHand';
    this.scaleStartDist = Math.max(distance, 1e-4);
    this.scaleStart.copy(this.object.scale);
  }

  moveTwoHandScale(distance: number): void {
    const object = this.object;
    if (!object || this.interaction !== 'twoHand') return;

    const factor = Math.min(
      Math.max(distance / this.scaleStartDist, SCALE_RANGE.min),
      SCALE_RANGE.max,
    );
    object.scale.copy(this.scaleStart).multiplyScalar(factor);
  }

  move(ray: PointerRay): void {
    const object = this.object;
    if (!object?.parent || this.interaction !== 'ray') return;

    switch (this.mode) {
      case 'translate': {
        worldPosition
          .copy(ray.direction)
          .multiplyScalar(this.start.distance)
          .add(ray.origin)
          .add(this.start.offset);

        parentInverse.copy(object.parent.matrixWorld).invert();
        object.position.copy(worldPosition.applyMatrix4(parentInverse));
        break;
      }

      case 'rotate': {
        delta.copy(ray.orientation).multiply(this.start.orientation.clone().invert());
        worldQuaternion.copy(delta).multiply(this.start.quaternion);

        object.parent.getWorldQuaternion(parentQuaternion);
        object.quaternion.copy(parentQuaternion.invert()).multiply(worldQuaternion);
        break;
      }

      case 'scale': {
        const push = scratch.subVectors(ray.origin, this.start.origin).dot(this.start.direction);
        const factor = Math.min(
          Math.max(Math.exp(push * REACH_SCALE_GAIN), SCALE_RANGE.min),
          SCALE_RANGE.max,
        );
        object.scale.copy(this.start.scale).multiplyScalar(factor);
        break;
      }
    }
  }

  end(): void {
    this.object = null;
    this.interaction = 'wrist';
  }
}
