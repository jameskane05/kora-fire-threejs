/**
 * AVBD sandbox exhibit — rigid stacks / springs / soft gel using Augmented Vertex Block Descent
 * (Giles, Diaz, Yuksel — SIGGRAPH 2025). Hands / desktop displacement volumes are kinematic
 * solid bodies in the solver (not MPM-style velocity impulses).
 *
 * https://graphics.cs.utah.edu/research/projects/avbd/
 */
import {
  BoxGeometry,
  Group,
  InstancedMesh,
  Mesh,
  MeshBasicNodeMaterial,
  Object3D,
  SphereGeometry,
  type BufferGeometry,
} from 'three/webgpu';
import { color, mix, normalLocal, uniform } from 'three/tsl';
import { Solver, Rigid, Spring, type V3, rotate, v3 } from './avbd';
import { severSpringsInKinematics } from './avbd/cut';
import type { PositionGoal } from './avbd/solver';
import {
  buildSoftGel,
  DEFAULT_SOFT_GEL,
  updateSoftShapeGoals,
} from './avbd/softGel';
import type { ForcePoint } from './MlsMpm';
import type { ImmersiveMode } from '../xr/ImmersiveMode';

export type AvbdSceneId = 'stack' | 'pyramid' | 'springs' | 'soft';

const DOMAIN = 1.0;
export const AVBD_PLACEMENT = {
  distance: 0.48,
  height: 0.88,
  framedSize: 0.42,
  turntable: false,
} as const;

const HAND_POOL = 48;
const COLLIDER_POOL = 8;
const _q = { x: 0, y: 0, z: 0, w: 1 };
const _dummy = new Object3D();

function bodyMaterial(hex: number, highlight = 0): MeshBasicNodeMaterial {
  const material = new MeshBasicNodeMaterial();
  const base = color(hex);
  const lit = mix(base, color(0xffffff), normalLocal.y.mul(0.18).add(0.06));
  material.colorNode = mix(lit, color(0xd4a574), uniform(highlight));
  material.depthWrite = true;
  return material;
}

type BodyVisual = {
  body: Rigid;
  mesh: Mesh;
  dynamic: boolean;
};

export class AvbdExhibit {
  readonly root = new Group();
  private readonly solver = new Solver();
  private readonly visuals: BodyVisual[] = [];
  private readonly handBodies: Rigid[] = [];
  private readonly colliderBodies: Rigid[] = [];
  private softNodes: Rigid[] = [];
  /** Dynamic beads only — pinned under-floor anchors are omitted from the mesh. */
  private softLiveNodes: Rigid[] = [];
  private softGoals: PositionGoal[] = [];
  private softRestCom = v3();
  private softInstances: InstancedMesh | null = null;
  private sceneId: AvbdSceneId = 'soft';
  private active = false;
  private ready = false;
  private floorMesh: Mesh | null = null;
  private _springCount = 0;
  /** Wall time of the last `step()` (ms). */
  lastStepMs = 0;
  /** Springs severed in the last soft step. */
  lastCutCount = 0;
  constructor(private readonly immersive: ImmersiveMode) {
    this.solver.iterations = 8;
    this.solver.gravity = -12;
  }

  get isReady(): boolean {
    return this.ready;
  }

  get isActive(): boolean {
    return this.active;
  }

  get bodyCount(): number {
    return this.sceneId === 'soft'
      ? this.softLiveNodes.length
      : this.solver.bodyList.filter((b) => b.mass > 0).length;
  }

  get springCount(): number {
    return this._springCount;
  }

  get iterations(): number {
    return this.solver.iterations;
  }

  get currentScene(): AvbdSceneId {
    return this.sceneId;
  }

  /** Live soft-gel center of mass (XZ drift diagnostics). */
  softCom(): { x: number; y: number; z: number } {
    const c = { x: 0, y: 0, z: 0 };
    const n = this.softLiveNodes.length;
    if (!n) return c;
    for (const b of this.softLiveNodes) {
      c.x += b.positionLin.x;
      c.y += b.positionLin.y;
      c.z += b.positionLin.z;
    }
    const inv = 1 / n;
    c.x *= inv;
    c.y *= inv;
    c.z *= inv;
    return c;
  }

  init(): void {
    if (this.ready) return;
    this.immersive.attach(this.root);
    this.root.visible = false;
    this.loadScene('soft');
    this.ready = true;
  }

  setActive(on: boolean): void {
    if (!this.ready) return;
    this.active = on;
    this.root.visible = on;
    if (on) {
      this.immersive.setDomainSize(DOMAIN);
      this.immersive.setPlacement({ ...AVBD_PLACEMENT });
    }
  }

  reset(): void {
    this.loadScene(this.sceneId);
  }

  setScene(id: AvbdSceneId): void {
    this.sceneId = id;
    this.loadScene(id);
  }

  cycleScene(): void {
    const order: AvbdSceneId[] = ['soft', 'stack', 'pyramid', 'springs'];
    const i = order.indexOf(this.sceneId);
    this.setScene(order[(i + 1) % order.length]);
  }

  /** Reset soft gel to a clean pose before a timed bench. */
  prepareBench(): void {
    this.setScene('soft');
    this.solver.iterations = 8;
  }

  /**
   * Advance AVBD. Hands / displacement volumes are kinematic solids; on soft gel
   * they also sever springs they pass through so cuts don't heal.
   */
  step(dt: number, forces: ForcePoint[]): void {
    const t0 = performance.now();
    this.solver.dt = Math.min(Math.max(dt, 1 / 240), 1 / 30);
    this.syncKinematicForces(forces);
    if (this.sceneId === 'soft') {
      if (this.softGoals.length) {
        updateSoftShapeGoals(this.softNodes, this.softGoals, this.softRestCom);
      }
      // Cut before the solve so broken links don't pull across the blade this frame.
      const blades = [...this.handBodies, ...this.colliderBodies];
      const cut = severSpringsInKinematics(this.solver, blades);
      this.lastCutCount = cut;
      if (cut > 0) this._springCount = Math.max(0, this._springCount - cut);
    } else {
      this.lastCutCount = 0;
    }
    this.solver.step();
    if (this.sceneId === 'soft') {
      this.separateSoftFromKinematics();
      this.clampSoftFloor();
    }
    if (this.active) this.syncMeshes();
    this.lastStepMs = performance.now() - t0;
  }

  /**
   * Push soft nodes out of active kinematic OBBs after the solve so a collider
   * always leaves a visible cavity (shape-match can't fully erase it).
   */
  private separateSoftFromKinematics(): void {
    const pushers = [...this.handBodies, ...this.colliderBodies].filter((b) => b.positionLin.y > -5);
    if (!pushers.length) return;

    for (const node of this.softNodes) {
      if (node.mass <= 0) continue;
      for (const k of pushers) {
        const q = k.positionAng;
        const qInv = { x: -q.x, y: -q.y, z: -q.z, w: q.w };
        const delta = v3(
          node.positionLin.x - k.positionLin.x,
          node.positionLin.y - k.positionLin.y,
          node.positionLin.z - k.positionLin.z,
        );
        const local = rotate(qInv, delta);
        const hx = k.size.x * 0.5 + node.size.x * 0.4;
        const hy = k.size.y * 0.5 + node.size.y * 0.4;
        const hz = k.size.z * 0.5 + node.size.z * 0.4;
        if (Math.abs(local.x) > hx || Math.abs(local.y) > hy || Math.abs(local.z) > hz) continue;

        const px = hx - Math.abs(local.x);
        const py = hy - Math.abs(local.y);
        const pz = hz - Math.abs(local.z);
        let localN = v3();
        let pen = 0;
        if (px <= py && px <= pz) {
          pen = px;
          localN = v3(Math.sign(local.x) || 1, 0, 0);
        } else if (py <= pz) {
          pen = py;
          localN = v3(0, Math.sign(local.y) || 1, 0);
        } else {
          pen = pz;
          localN = v3(0, 0, Math.sign(local.z) || 1);
        }
        const worldN = rotate(q, localN);
        const push = Math.min(pen, 0.045);
        node.positionLin.x += worldN.x * push;
        node.positionLin.y += worldN.y * push;
        node.positionLin.z += worldN.z * push;
        const vn =
          node.velocityLin.x * worldN.x +
          node.velocityLin.y * worldN.y +
          node.velocityLin.z * worldN.z;
        if (vn < 0) {
          node.velocityLin.x -= worldN.x * vn;
          node.velocityLin.y -= worldN.y * vn;
          node.velocityLin.z -= worldN.z * vn;
        }
      }
    }
  }

  /** Plane floor for soft gel — avoids thousands of OBB ground manifolds. */
  private clampSoftFloor(): void {
    const yFloor = Math.max(DEFAULT_SOFT_GEL.nodeSize * 0.5, DEFAULT_SOFT_GEL.y0 * 0.5);
    const yNear = yFloor + DEFAULT_SOFT_GEL.spacing * 0.85;
    for (const body of this.softLiveNodes) {
      if (body.positionLin.y < yFloor) {
        body.positionLin.y = yFloor;
        if (body.velocityLin.y < 0) body.velocityLin.y *= -0.05;
      }
      // Ground friction while resting near the floor (not only on penetration frames).
      if (body.positionLin.y <= yNear) {
        body.velocityLin.x *= 0.82;
        body.velocityLin.z *= 0.82;
        if (Math.abs(body.velocityLin.x) < 1e-4) body.velocityLin.x = 0;
        if (Math.abs(body.velocityLin.z) < 1e-4) body.velocityLin.z = 0;
      }
    }
  }

  dispose(): void {
    this.clearVisuals();
    this.solver.clear();
    this.root.removeFromParent();
    this.ready = false;
    this.active = false;
  }

  private loadScene(id: AvbdSceneId): void {
    this.clearVisuals();
    this.solver.clear();
    this.handBodies.length = 0;
    this.colliderBodies.length = 0;
    this.softNodes = [];
    this.softLiveNodes = [];
    this.softGoals = [];
    this.softRestCom = v3();
    this.clearSoftInstances();
    this.sceneId = id;
    this._springCount = 0;
    this.solver.softBodyMode = id === 'soft';
    this.solver.iterations = id === 'soft' ? 8 : 8;
    this.solver.gravity = id === 'soft' ? -6 : -12;

    // Soft gel uses a cheap y-clamp floor (3k OBB ground manifolds destroy frame time).
    if (id !== 'soft') {
      const ground = new Rigid(this.solver, v3(2.4, 0.08, 2.4), 0, 0.55, v3(0, -0.04, 0));
      this.attachVisual(ground, 0x2a3038, false, 'box');
    }
    this.ensureFloorProp();

    if (id === 'soft') {
      const gel = buildSoftGel(this.solver, DEFAULT_SOFT_GEL);
      this._springCount = gel.springCount;
      this.softNodes = gel.nodes;
      this.softLiveNodes = gel.nodes.filter((n) => n.mass > 0);
      this.softGoals = gel.goals;
      this.softRestCom = gel.restCom;
      this.buildSoftInstances(this.softLiveNodes);
    } else if (id === 'stack') {
      for (let i = 0; i < 8; i++) {
        const s = 0.12;
        const body = new Rigid(
          this.solver,
          v3(s, s, s),
          1.2,
          0.45,
          v3((i % 2) * 0.01, 0.06 + i * (s + 0.008), (i % 3) * 0.008),
        );
        this.attachVisual(body, 0xb8895a + i * 0x040200, true, 'box');
      }
    } else if (id === 'pyramid') {
      const SIZE = 5;
      const sx = 0.1;
      const sy = 0.06;
      const sz = 0.1;
      for (let y = 0; y < SIZE; y++) {
        for (let x = 0; x < SIZE - y; x++) {
          const body = new Rigid(
            this.solver,
            v3(sx, sy, sz),
            1.0,
            0.5,
            v3(x * (sx + 0.004) + y * sx * 0.5 - (SIZE * sx) / 2, sy * 0.5 + y * (sy + 0.004), 0),
          );
          this.attachVisual(body, 0x8a9bb0, true, 'box');
        }
      }
    } else {
      const anchor = new Rigid(this.solver, v3(0.08, 0.08, 0.08), 0, 0.5, v3(-0.25, 0.55, 0));
      this.attachVisual(anchor, 0x555b66, false, 'box');
      let prev = anchor;
      for (let i = 0; i < 6; i++) {
        const body = new Rigid(
          this.solver,
          v3(0.07, 0.07, 0.07),
          1.0,
          0.4,
          v3(-0.25 + (i + 1) * 0.09, 0.55, 0),
        );
        this.attachVisual(body, 0x6fa8c8, true, 'box');
        new Spring(this.solver, prev, body, v3(0.04, 0, 0), v3(-0.04, 0, 0), i % 2 === 0 ? 40 : 400, 0.09);
        this._springCount++;
        prev = body;
      }
      const heavy = new Rigid(this.solver, v3(0.16, 0.16, 0.16), 2.5, 0.4, v3(0.4, 0.55, 0));
      this.attachVisual(heavy, 0xc47b5a, true, 'box');
      new Spring(this.solver, prev, heavy, v3(0.04, 0, 0), v3(-0.08, 0, 0), 80, 0.12);
      this._springCount++;
    }

    for (let i = 0; i < HAND_POOL; i++) {
      const h = new Rigid(this.solver, v3(0.04, 0.04, 0.04), 0, 0.8, v3(0, -10, 0));
      h.kinematic = true;
      this.handBodies.push(h);
      this.attachVisual(h, 0xd4a574, false, 'box', true);
    }
    for (let i = 0; i < COLLIDER_POOL; i++) {
      const c = new Rigid(this.solver, v3(0.12, 0.12, 0.12), 0, 0.7, v3(0, -10, 0));
      c.kinematic = true;
      this.colliderBodies.push(c);
      this.attachVisual(c, 0x7a8494, false, 'box', true);
    }
  }

  private ensureFloorProp(): void {
    if (this.floorMesh) return;
    const mesh = new Mesh(new BoxGeometry(DOMAIN, 0.02, DOMAIN), bodyMaterial(0x1a1d24));
    mesh.position.set(0, -0.01, 0);
    this.root.add(mesh);
    this.floorMesh = mesh;
  }

  private attachVisual(
    body: Rigid,
    hex: number,
    dynamic: boolean,
    shape: 'box' | 'sphere',
    hidden = false,
  ): void {
    const geo: BufferGeometry =
      shape === 'sphere' ? new SphereGeometry(0.5, 14, 10) : new BoxGeometry(1, 1, 1);
    const mesh = new Mesh(geo, bodyMaterial(hex));
    mesh.scale.set(body.size.x, body.size.y, body.size.z);
    mesh.visible = !hidden;
    this.root.add(mesh);
    body.userData = mesh;
    this.visuals.push({ body, mesh, dynamic });
  }

  private buildSoftInstances(nodes: Rigid[]): void {
    const geo = new SphereGeometry(0.5, 8, 6);
    const mesh = new InstancedMesh(geo, bodyMaterial(0x3dba6e), nodes.length);
    mesh.frustumCulled = false;
    const s = DEFAULT_SOFT_GEL.nodeSize;
    for (let i = 0; i < nodes.length; i++) {
      const p = nodes[i].positionLin;
      _dummy.position.set(p.x, p.y, p.z);
      _dummy.scale.set(s, s, s);
      _dummy.quaternion.identity();
      _dummy.updateMatrix();
      mesh.setMatrixAt(i, _dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
    this.root.add(mesh);
    this.softInstances = mesh;
  }

  private clearSoftInstances(): void {
    if (!this.softInstances) return;
    this.root.remove(this.softInstances);
    this.softInstances.geometry.dispose();
    (this.softInstances.material as MeshBasicNodeMaterial).dispose();
    this.softInstances = null;
  }

  private clearVisuals(): void {
    this.clearSoftInstances();
    for (const v of this.visuals) {
      this.root.remove(v.mesh);
      v.mesh.geometry.dispose();
      (v.mesh.material as MeshBasicNodeMaterial).dispose();
    }
    this.visuals.length = 0;
  }

  private syncMeshes(): void {
    if (this.softInstances && this.softLiveNodes.length) {
      const mesh = this.softInstances;
      const s = DEFAULT_SOFT_GEL.nodeSize;
      for (let i = 0; i < this.softLiveNodes.length; i++) {
        const p = this.softLiveNodes[i].positionLin;
        _dummy.position.set(p.x, p.y, p.z);
        _dummy.scale.set(s, s, s);
        _dummy.quaternion.identity();
        _dummy.updateMatrix();
        mesh.setMatrixAt(i, _dummy.matrix);
      }
      mesh.instanceMatrix.needsUpdate = true;
    }
    for (const v of this.visuals) {
      const b = v.body;
      if (b.kinematic && b.positionLin.y < -5) {
        v.mesh.visible = false;
        continue;
      }
      v.mesh.visible = true;
      v.mesh.position.set(b.positionLin.x, b.positionLin.y, b.positionLin.z);
      v.mesh.quaternion.set(b.positionAng.x, b.positionAng.y, b.positionAng.z, b.positionAng.w);
      v.mesh.scale.set(b.size.x, b.size.y, b.size.z);
    }
  }

  private parkBody(body: Rigid): void {
    body.positionLin = v3(0, -10, 0);
    body.velocityLin = v3();
    body.prevVelocityLin = v3();
  }

  private forceToWorld(f: ForcePoint): { p: V3; size: V3; quat: { x: number; y: number; z: number; w: number } } {
    const p = v3((f.x - 0.5) * DOMAIN, f.y * DOMAIN, (f.z - 0.5) * DOMAIN);
    if (f.isCapsule) {
      const r = Math.max((f.radius > 0 ? f.radius : f.hy) * DOMAIN, 0.01);
      return {
        p,
        // OBB approx of capsule for gel-cut blades (no native capsule in CPU AVBD).
        size: v3(f.hx * 2 * DOMAIN, r * 2, r * 2),
        quat: basisToQuat(f),
      };
    }
    if (f.isBox) {
      return {
        p,
        size: v3(f.hx * 2 * DOMAIN, f.hy * 2 * DOMAIN, f.hz * 2 * DOMAIN),
        quat: basisToQuat(f),
      };
    }
    const d = Math.max(f.radius * 2 * DOMAIN, 0.03);
    return { p, size: v3(d, d, d), quat: { x: 0, y: 0, z: 0, w: 1 } };
  }

  /**
   * Map ForcePoints → kinematic OBBs. Preserves previous pose for velocity
   * (never park-before-read — that was injecting ~kilometre/s teleports).
   */
  private syncKinematicForces(forces: ForcePoint[]): void {
    const usedH = new Uint8Array(this.handBodies.length);
    const usedC = new Uint8Array(this.colliderBodies.length);
    let hi = 0;
    let ci = 0;
    const invDt = this.solver.dt > 1e-6 ? 1 / this.solver.dt : 0;
    const maxSpeed = 1.8;

    for (const f of forces) {
      if (f.strength === 0 && !f.isBox && !f.isCapsule && f.radius <= 0) continue;
      const { p, size, quat } = this.forceToWorld(f);
      const isHand = f.isBox || f.isCapsule;
      const pool = isHand ? this.handBodies : this.colliderBodies;
      const used = isHand ? usedH : usedC;
      const idx = isHand ? hi++ : ci++;
      if (idx >= pool.length) continue;
      const body = pool[idx];
      used[idx] = 1;
      const prev = body.positionLin;
      const wasParked = prev.y < -5;
      body.positionLin = p;
      body.positionAng = { ...quat };
      body.size = size;
      body.radius = Math.hypot(size.x, size.y, size.z) * 0.5;
      if (wasParked) {
        body.velocityLin = v3();
      } else {
        let vx = (p.x - prev.x) * invDt;
        let vy = (p.y - prev.y) * invDt;
        let vz = (p.z - prev.z) * invDt;
        const speed = Math.hypot(vx, vy, vz);
        if (speed > maxSpeed && speed > 1e-8) {
          const s = maxSpeed / speed;
          vx *= s;
          vy *= s;
          vz *= s;
        }
        body.velocityLin = v3(vx, vy, vz);
      }
      body.prevVelocityLin = { ...body.velocityLin };
    }

    for (let i = 0; i < this.handBodies.length; i++) {
      if (!usedH[i]) this.parkBody(this.handBodies[i]);
    }
    for (let i = 0; i < this.colliderBodies.length; i++) {
      if (!usedC[i]) this.parkBody(this.colliderBodies[i]);
    }
  }
}

function basisToQuat(f: ForcePoint): { x: number; y: number; z: number; w: number } {
  const m00 = f.ax, m01 = f.bx, m02 = f.cx;
  const m10 = f.ay, m11 = f.by, m12 = f.cy;
  const m20 = f.az, m21 = f.bz, m22 = f.cz;
  const tr = m00 + m11 + m22;
  if (tr > 0) {
    const s = Math.sqrt(tr + 1) * 2;
    _q.w = 0.25 * s;
    _q.x = (m21 - m12) / s;
    _q.y = (m02 - m20) / s;
    _q.z = (m10 - m01) / s;
  } else if (m00 > m11 && m00 > m22) {
    const s = Math.sqrt(1 + m00 - m11 - m22) * 2;
    _q.w = (m21 - m12) / s;
    _q.x = 0.25 * s;
    _q.y = (m01 + m10) / s;
    _q.z = (m02 + m20) / s;
  } else if (m11 > m22) {
    const s = Math.sqrt(1 + m11 - m00 - m22) * 2;
    _q.w = (m02 - m20) / s;
    _q.x = (m01 + m10) / s;
    _q.y = 0.25 * s;
    _q.z = (m12 + m21) / s;
  } else {
    const s = Math.sqrt(1 + m22 - m00 - m11) * 2;
    _q.w = (m10 - m01) / s;
    _q.x = (m02 + m20) / s;
    _q.y = (m12 + m21) / s;
    _q.z = 0.25 * s;
  }
  return { ..._q };
}
