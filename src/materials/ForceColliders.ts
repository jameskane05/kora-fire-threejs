/**
 * Desktop MPM force colliders — same TransformControls UX as the fire demo's displacement volumes.
 * Each primitive becomes a ForcePoint for MlsMpm (sphere or oriented box).
 */
import {
  BoxGeometry,
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
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import type { GizmoMode } from '../sim/obstacles';
import { MAX_FORCES, type ForcePoint } from './MlsMpm';

export type ForceColliderKind = 'sphere' | 'box';

const MAX_COLLIDERS = 4;
const FILL = 0x1a3040;
const EDGE = 0x5ad0e0;
const _ax = new Vector3();
const _ay = new Vector3();
const _az = new Vector3();
const _q = new Quaternion();

interface Item {
  kind: ForceColliderKind;
  mesh: Mesh;
}

function geometryFor(kind: ForceColliderKind): BufferGeometry {
  return kind === 'sphere' ? new SphereGeometry(0.5, 24, 16) : new BoxGeometry(1, 1, 1);
}

function material(): MeshBasicNodeMaterial {
  return new MeshBasicNodeMaterial({
    color: FILL,
    transparent: true,
    opacity: 0.45,
    depthWrite: false,
  });
}

export class ForceColliders {
  readonly group = new Group();
  readonly gizmo: TransformControls;

  private readonly items: Item[] = [];
  private readonly raycaster = new Raycaster();
  private readonly pointer = new Vector2();
  private readonly forcePool: ForcePoint[] = [];
  private selected: number | null = null;
  private gizmoEnabled = true;
  private domain = 1;

  onModeChanged: (mode: GizmoMode) => void = () => {};

  constructor(
    private readonly camera: Camera,
    private readonly domElement: HTMLElement,
    onDragging: (dragging: boolean) => void,
  ) {
    this.gizmo = new TransformControls(camera, domElement);
    this.gizmo.addEventListener('dragging-changed', (event) => onDragging(event.value as boolean));
    this.gizmo.setMode('translate');
    this.gizmo.setSize(0.85);
    domElement.addEventListener('pointerdown', this.onPointerDown);

    for (let i = 0; i < MAX_COLLIDERS; i++) {
      this.forcePool.push({
        x: 0.5,
        y: 0.5,
        z: 0.5,
        strength: 0,
        radius: 0.08,
        isBox: false,
        hx: 0.05,
        hy: 0.05,
        hz: 0.05,
        ax: 1,
        ay: 0,
        az: 0,
        bx: 0,
        by: 1,
        bz: 0,
        cx: 0,
        cy: 0,
        cz: 1,
      });
    }
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

  get helper(): Object3D {
    return this.gizmo.getHelper();
  }

  setDomain(domain: number): void {
    this.domain = domain;
  }

  setGizmoEnabled(enabled: boolean): void {
    this.gizmoEnabled = enabled;
    this.syncGizmo();
  }

  setVisible(visible: boolean): void {
    this.group.visible = visible;
    this.syncGizmo();
  }

  add(kind: ForceColliderKind, at?: Vector3): boolean {
    if (this.items.length >= MAX_COLLIDERS) return false;
    const mesh = new Mesh(geometryFor(kind), material());
    mesh.position.copy(at ?? new Vector3(0, 0.2, 0));
    if (kind === 'sphere') mesh.scale.setScalar(0.14);
    else mesh.scale.set(0.12, 0.12, 0.12);
    (mesh.material as MeshBasicNodeMaterial).color.setHex(EDGE);
    this.group.add(mesh);
    this.items.push({ kind, mesh });
    this.select(this.items.length - 1);
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
    this.select(this.items.length > 0 ? Math.min(index, this.items.length - 1) : null);
  }

  clear(): void {
    while (this.items.length > 0) this.remove(this.items.length - 1);
  }

  select(index: number | null): void {
    this.selected = index;
    for (const [i, item] of this.items.entries()) {
      (item.mesh.material as MeshBasicNodeMaterial).color.setHex(i === index ? EDGE : FILL);
      (item.mesh.material as MeshBasicNodeMaterial).opacity = i === index ? 0.65 : 0.4;
    }
    this.syncGizmo();
  }

  /** Attach to the selection, or hide the helper so it does not sit at the scene origin. */
  private syncGizmo(): void {
    const mesh =
      this.gizmoEnabled && this.group.visible && this.selected !== null
        ? this.items[this.selected]?.mesh
        : undefined;
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

  /** Content-space meshes → sim-space ForcePoints. */
  toForces(strength: number): ForcePoint[] {
    const out: ForcePoint[] = [];
    const n = Math.min(this.items.length, MAX_FORCES, this.forcePool.length);
    for (let i = 0; i < n; i++) {
      const item = this.items[i];
      const f = this.forcePool[i];
      const p = item.mesh.position;
      f.x = Math.min(0.98, Math.max(0.02, p.x / this.domain + 0.5));
      f.y = Math.min(0.98, Math.max(0.02, p.y / this.domain));
      f.z = Math.min(0.98, Math.max(0.02, p.z / this.domain + 0.5));
      f.strength = strength;

      if (item.kind === 'sphere') {
        f.isBox = false;
        f.radius = Math.max(0.02, (Math.abs(item.mesh.scale.x) * 0.5) / this.domain);
      } else {
        f.isBox = true;
        _q.copy(item.mesh.quaternion);
        _ax.set(1, 0, 0).applyQuaternion(_q);
        _ay.set(0, 1, 0).applyQuaternion(_q);
        _az.set(0, 0, 1).applyQuaternion(_q);
        f.ax = _ax.x;
        f.ay = _ax.y;
        f.az = _ax.z;
        f.bx = _ay.x;
        f.by = _ay.y;
        f.bz = _ay.z;
        f.cx = _az.x;
        f.cy = _az.y;
        f.cz = _az.z;
        f.hx = Math.max(0.015, (Math.abs(item.mesh.scale.x) * 0.5) / this.domain);
        f.hy = Math.max(0.015, (Math.abs(item.mesh.scale.y) * 0.5) / this.domain);
        f.hz = Math.max(0.015, (Math.abs(item.mesh.scale.z) * 0.5) / this.domain);
        f.radius = f.hy;
      }
      out.push(f);
    }
    return out;
  }

  private onPointerDown = (event: PointerEvent): void => {
    if (!this.group.visible || this.gizmo.dragging || event.button !== 0) return;
    const rect = this.domElement.getBoundingClientRect();
    this.pointer.set(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1,
    );
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hit = this.raycaster.intersectObjects(
      this.items.map((i) => i.mesh),
      false,
    )[0];
    if (!hit) return;
    this.select(this.items.findIndex((i) => i.mesh === hit.object));
  };

  dispose(): void {
    this.domElement.removeEventListener('pointerdown', this.onPointerDown);
    this.gizmo.detach();
    this.gizmo.dispose();
    this.clear();
  }
}
