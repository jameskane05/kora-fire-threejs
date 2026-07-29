/**
 * Holding an object on the end of a pointer ray.
 *
 * All three modes work from the same two signals — where the ray points and where its origin has
 * moved to — because that is all a transient pointer gives you. There are no thumbsticks, no
 * trigger axis and no second button, so the mode has to say what a drag means rather than the
 * input distinguishing it.
 *
 * Everything is computed in world space and converted back through the object's parent on the way
 * out, since the primitives hang off a rig that is both scaled and rotated.
 */
import { Matrix4, Object3D, Quaternion, Vector3 } from 'three/webgpu';
import type { GizmoMode } from '../scene/Obstacles';

export interface PointerRay {
  origin: Vector3;
  /** unit vector the pointer aims along */
  direction: Vector3;
  orientation: Quaternion;
}

/** Hand travel along the ray, in metres, for one e-fold of scale. */
const SCALE_GAIN = 2.4;
const SCALE_RANGE = { min: 0.15, max: 4.0 };

/** Keeps a grab from latching onto something unreachably far away. */
const MAX_REACH = 12;

const worldPosition = new Vector3();
const worldQuaternion = new Quaternion();
const parentQuaternion = new Quaternion();
const parentInverse = new Matrix4();
const scratch = new Vector3();
const delta = new Quaternion();

export class RayGrab {
  private object: Object3D | null = null;
  private mode: GizmoMode = 'translate';

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

  begin(object: Object3D, ray: PointerRay, mode: GizmoMode): void {
    object.updateWorldMatrix(true, false);
    object.getWorldPosition(worldPosition);

    // The object is carried at the depth it was picked at rather than pulled to the hand, so a
    // pinch never yanks it across the domain before the drag has even started.
    const distance = Math.min(
      Math.max(scratch.subVectors(worldPosition, ray.origin).dot(ray.direction), 0),
      MAX_REACH,
    );

    this.object = object;
    this.mode = mode;
    this.start.origin.copy(ray.origin);
    this.start.direction.copy(ray.direction);
    this.start.orientation.copy(ray.orientation);
    this.start.distance = distance;
    this.start.offset
      .copy(worldPosition)
      .sub(scratch.copy(ray.direction).multiplyScalar(distance).add(ray.origin));
    object.getWorldQuaternion(this.start.quaternion);
    this.start.scale.copy(object.scale);
  }

  move(ray: PointerRay): void {
    const object = this.object;
    if (!object?.parent) return;

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
        // Reach, not aim: pushing the hand away along the ray it started on grows the primitive.
        // Using the ray's current direction instead would couple size to where you are pointing,
        // and the object would swell every time you glanced off to one side.
        const push = scratch.subVectors(ray.origin, this.start.origin).dot(this.start.direction);
        const factor = Math.min(
          Math.max(Math.exp(push * SCALE_GAIN), SCALE_RANGE.min),
          SCALE_RANGE.max,
        );
        object.scale.copy(this.start.scale).multiplyScalar(factor);
        break;
      }
    }
  }

  end(): void {
    this.object = null;
  }
}
