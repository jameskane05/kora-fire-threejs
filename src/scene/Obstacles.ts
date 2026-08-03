/**
 * Displacement volumes as scene objects: a proxy mesh you can see, a gizmo you can drag, and the
 * per-frame bookkeeping that turns dragging into something the solver reacts to.
 *
 * The solver side of this lives in `sim/obstacles.ts` and `sim/passes/solids.ts`. All that has to
 * cross over is a handful of uniforms per primitive, which is why moving one costs nothing:
 * the shape is analytic and its transform is a uniform write. Only *adding* or *removing* one
 * changes the graph, because the primitives are unrolled into the kernels at build time.
 */
import {
  BoxGeometry,
  CapsuleGeometry,
  Group,
  Mesh,
  MeshBasicNodeMaterial,
  Quaternion,
  Raycaster,
  SphereGeometry,
  Vector2,
  Vector3,
  type BufferGeometry,
  type Camera,
  type Object3D,
} from 'three/webgpu';
import { abs, color, dot, mix, normalView, oneMinus, positionViewDirection, pow, uniform } from 'three/tsl';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import {
  MAX_SCENE_OBSTACLES,
  baseGeometry,
  type GizmoMode,
  type ObstacleKind,
} from '../sim/obstacles';
import type { KoraUniforms } from '../sim/uniforms';

/* eslint-disable @typescript-eslint/no-explicit-any */
type N = any;

export type { GizmoMode };

/** Slowest motion, in metres per second, that still counts as pushing the fluid. */
const MOTION_FLOOR = 1e-3;

/**
 * Deliberately dim, and deliberately tone-mapped.
 *
 * These sit inside a bloom pass built for blackbody radiance. Anything bright here, and the
 * selection tint especially, blooms into a glowing ball that reads as part of the fire rather
 * than as the thing blocking it.
 */
const FILL = 0x0c0e13;
const EDGE = 0x39424f;
const EDGE_SELECTED = 0x8a6534;

interface Item {
  kind: ObstacleKind;
  size: number;
  mesh: Mesh;
  highlight: { value: number };
  previous: { position: Vector3; quaternion: Quaternion };
}

function geometryFor(kind: ObstacleKind, size: number): BufferGeometry {
  switch (kind) {
    case 'sphere':
      return new SphereGeometry(size / 2, 32, 20);
    case 'capsule':
      return new CapsuleGeometry(size / 4, size, 8, 20);
    case 'box':
      return new BoxGeometry(size, size, size);
  }
}

/**
 * Unlit shading that still reads as a solid.
 *
 * There are no lights in this scene — everything else in it is either emissive or a helper — so a
 * lit material would come out black. Facing ratio stands in for shading: dark across the face,
 * brighter towards the silhouette, which is enough to tell a sphere from a disc.
 */
function obstacleMaterial(highlight: N): MeshBasicNodeMaterial {
  const material = new MeshBasicNodeMaterial();

  const rim = pow(oneMinus(abs(dot(normalView, positionViewDirection))), 3.5);
  const edge = mix(color(EDGE), color(EDGE_SELECTED), highlight);

  material.colorNode = mix(color(FILL), edge, rim);

  // Opaque, but writing depth would let the obstacle reject the volume's back faces and cut a
  // hole in the fire *in front of* it. Occlusion is the raymarch's job instead: it terminates
  // where the baked solid distance goes negative, which hides only what is genuinely behind.
  material.depthWrite = false;

  return material;
}

export class Obstacles {
  readonly group = new Group();
  readonly gizmo: TransformControls;

  private readonly items: Item[] = [];
  private readonly raycaster = new Raycaster();
  private readonly pointer = new Vector2();
  private uniforms: KoraUniforms;
  private selected: number | null = null;
  private gizmoEnabled = true;

  /** Raised when a primitive is added or removed, since that changes the compute graph. */
  onCountChanged: (count: number) => void = () => {};

  /**
   * Raised whenever the mode changes, wherever it came from.
   *
   * There are three ways in — the panel, the keyboard and the headset's button strip — and they
   * all have to agree, so they all go through `setMode` and everything else listens here.
   */
  onModeChanged: (mode: GizmoMode) => void = () => {};

  constructor(
    uniforms: KoraUniforms,
    private readonly camera: Camera,
    private readonly domElement: HTMLElement,
    onDragging: (dragging: boolean) => void,
    /** Caps user-placed primitives so reserved hand-solid slots stay free. */
    private readonly maxItems: number = MAX_SCENE_OBSTACLES,
  ) {
    this.uniforms = uniforms;

    this.gizmo = new TransformControls(camera, domElement);
    this.gizmo.addEventListener('dragging-changed', (event) => onDragging(event.value as boolean));
    this.gizmo.setMode('translate');

    domElement.addEventListener('pointerdown', this.onPointerDown);
  }

  get count(): number {
    return this.items.length;
  }

  get selection(): number | null {
    return this.selected;
  }

  get mode(): GizmoMode {
    return this.gizmo.mode as GizmoMode;
  }

  /** The proxy meshes, for picking. */
  targets(): Object3D[] {
    return this.items.map((i) => i.mesh);
  }

  /** Selection by object rather than by index, for pickers that only have the hit mesh. */
  selectObject(object: Object3D | null): void {
    if (object === null) {
      this.select(null);
      return;
    }
    const index = this.items.findIndex((i) => i.mesh === object);
    if (index >= 0) this.select(index);
  }

  /**
   * Hides the desktop gizmo without losing the selection.
   *
   * In a headset the primitives are grabbed directly, so the axis handles are both unusable and
   * in the way — but the highlight should stay, since that is what shows which one is being
   * manipulated.
   */
  setGizmoEnabled(enabled: boolean): void {
    this.gizmoEnabled = enabled;
    this.syncGizmo();
  }

  /** The helper object that actually draws the gizmo; three keeps it separate from the controls. */
  get helper(): Object3D {
    return this.gizmo.getHelper();
  }

  /** Re-points at a fresh uniform block. The solver makes new uniforms every time it rebuilds. */
  bind(uniforms: KoraUniforms): void {
    this.uniforms = uniforms;
    this.writeUniforms(0);
  }

  add(kind: ObstacleKind, at: Vector3): boolean {
    if (this.items.length >= this.maxItems) return false;

    const size = 0.5;
    const highlight = uniform(0);
    const mesh = new Mesh(geometryFor(kind, size), obstacleMaterial(highlight));
    mesh.position.copy(at);

    this.group.add(mesh);
    this.items.push({
      kind,
      size,
      mesh,
      highlight: highlight as unknown as { value: number },
      previous: { position: at.clone(), quaternion: new Quaternion() },
    });

    this.select(this.items.length - 1);
    this.onCountChanged(this.items.length);
    return true;
  }

  remove(index: number): void {
    const item = this.items[index];
    if (!item) return;

    if (this.selected === index) this.select(null);
    this.items.splice(index, 1);

    this.group.remove(item.mesh);
    item.mesh.geometry.dispose();
    (item.mesh.material as MeshBasicNodeMaterial).dispose();

    // Indices shift, and the gizmo holds a direct object reference, so re-resolve the selection.
    this.select(this.items.length > 0 ? Math.min(index, this.items.length - 1) : null);
    this.onCountChanged(this.items.length);
  }

  clear(): void {
    while (this.items.length > 0) this.remove(this.items.length - 1);
  }

  select(index: number | null): void {
    this.selected = index;

    for (const [i, item] of this.items.entries()) {
      item.highlight.value = i === index ? 1 : 0;
    }

    this.syncGizmo();
  }

  /** Attach to the selection, or hide the helper so a detached gizmo does not sit at the origin. */
  private syncGizmo(): void {
    const mesh =
      this.gizmoEnabled && this.selected !== null ? this.items[this.selected]?.mesh : undefined;
    if (mesh) {
      this.gizmo.attach(mesh);
      this.gizmo.getHelper().visible = true;
    } else {
      this.gizmo.detach();
      this.gizmo.getHelper().visible = false;
    }
  }

  setMode(mode: GizmoMode): void {
    if (this.mode === mode) return;
    this.gizmo.setMode(mode);
    this.onModeChanged(mode);
  }

  private onPointerDown = (event: PointerEvent): void => {
    // Leave clicks on the gizmo itself alone, or picking would fight the drag it just started.
    if (this.gizmo.dragging || event.button !== 0) return;

    const rect = this.domElement.getBoundingClientRect();
    this.pointer.set(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1,
    );

    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hit = this.raycaster.intersectObjects(this.items.map((i) => i.mesh), false)[0];
    if (!hit) return;

    this.select(this.items.findIndex((i) => i.mesh === hit.object));
  };

  /**
   * Pushes the current transforms to the solver, and works out how fast each primitive is moving.
   *
   * The velocity matters as much as the shape does: it is what the projection uses as the
   * boundary flux, so it is the difference between an obstacle the fire flows around and one that
   * can be swung through the plume to knock it sideways.
   */
  update(dt: number): void {
    this.writeUniforms(dt);
  }

  private writeUniforms(dt: number): void {
    const slots = this.uniforms.obstacles;
    const inverse = new Quaternion();
    const delta = new Quaternion();

    for (const [i, item] of this.items.entries()) {
      if (i >= slots.length) break;

      const slot = slots[i];
      const { mesh, previous } = item;
      mesh.updateMatrixWorld();

      // Local transforms, not world ones. The group shares a parent with the volume, so this is
      // the same space the domain is described in — which is what keeps the obstacles in the
      // right place when the immersive rig scales the whole thing down to tabletop size.

      const base = baseGeometry(item.kind, item.size);

      slot.centre.value.copy(mesh.position);
      slot.size.value.set(base.extents.x, base.extents.y, base.extents.z, base.round);

      // Handed over unbaked: the shader divides the sample point by this rather than stretching
      // the extents, which is the only way a sphere — all rounding radius, no extents — can
      // become an ellipsoid. Floored because the shader divides by it.
      slot.scale.value.set(
        Math.max(Math.abs(mesh.scale.x), 1e-3),
        Math.max(Math.abs(mesh.scale.y), 1e-3),
        Math.max(Math.abs(mesh.scale.z), 1e-3),
      );

      // The shader rotates the sample point into the primitive's frame, so it wants the inverse.
      inverse.copy(mesh.quaternion).invert();
      slot.rotation.value.set(inverse.x, inverse.y, inverse.z, inverse.w);

      if (dt > 0) {
        slot.velocity.value.subVectors(mesh.position, previous.position).divideScalar(dt);
        if (slot.velocity.value.lengthSq() < MOTION_FLOOR * MOTION_FLOOR) {
          slot.velocity.value.set(0, 0, 0);
        }

        // Angular velocity from the frame's rotation delta, as an axis-angle over dt.
        delta.copy(mesh.quaternion).multiply(previous.quaternion.clone().invert());
        const angle = 2 * Math.acos(Math.min(1, Math.abs(delta.w)));
        const axisLength = Math.hypot(delta.x, delta.y, delta.z);
        if (angle > 1e-4 && axisLength > 1e-6) {
          slot.spin.value
            .set(delta.x, delta.y, delta.z)
            .multiplyScalar((Math.sign(delta.w) * angle) / (axisLength * dt));
        } else {
          slot.spin.value.set(0, 0, 0);
        }
      }

      previous.position.copy(mesh.position);
      previous.quaternion.copy(mesh.quaternion);
    }
  }

  dispose(): void {
    this.domElement.removeEventListener('pointerdown', this.onPointerDown);
    this.gizmo.detach();
    this.gizmo.dispose();
    this.clear();
  }
}
