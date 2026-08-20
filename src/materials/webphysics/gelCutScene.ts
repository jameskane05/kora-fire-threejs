/**
 * Kora soft-gel dome on the GPU AVBD engine — springs + pinned anchors + cut.
 */
import * as THREE from 'three';
import { PhysicsEngine } from './physics/PhysicsEngine';
import { createTrackedBodyVisualSet, type TrackedBodyVisualSet } from './scene/trackedBodyVisuals';

export const GEL_COLLISION_GROUP = 0x02;
export const KINEMATIC_COLLISION_GROUP = 0x01;

const SPEC = {
  radiusX: 0.28,
  radiusY: 0.12,
  radiusZ: 0.28,
  y0: 0.04,
  spacing: 0.032,
  nodeHalf: 0.014,
  density: 550,
  stretchStiffness: 520,
  shearStiffness: 200,
  friction: 0.65,
};

export type GelSpring = {
  index: number;
  bodyA: number;
  bodyB: number;
  mid: [number, number, number];
  active: boolean;
};

export type GelCutBuild = {
  liveBodies: number[];
  pinnedBodies: number[];
  springs: GelSpring[];
  visuals: TrackedBodyVisualSet;
  springCount: number;
};

function insideDome(x: number, y: number, z: number): boolean {
  const u = x / SPEC.radiusX;
  const v = (y - SPEC.y0) / SPEC.radiusY;
  const w = z / SPEC.radiusZ;
  if (v < 0 || v > 1) return false;
  return u * u + w * w + v * v <= 1;
}

function cellKey(ix: number, iy: number, iz: number): number {
  return ((ix + 512) << 20) | ((iy + 512) << 10) | (iz + 512);
}

export function buildGelCutScene(args: {
  scene: THREE.Object3D;
  physics: PhysicsEngine;
}): GelCutBuild {
  const { scene, physics } = args;
  const { spacing, nodeHalf, density, friction } = SPEC;

  // Small floor for the materials-scale dome.
  physics.addBody({
    position: [0, -0.02, 0],
    mass: 0,
    halfExtents: [0.6, 0.02, 0.6],
    friction: 0.9,
    lockRotation: true,
    collisionGroup: KINEMATIC_COLLISION_GROUP,
    collisionMask: 0xff,
  });

  type Node = { body: number; x: number; y: number; z: number; pinned: boolean };
  const nodes: Node[] = [];
  const nx = Math.ceil((SPEC.radiusX * 2) / spacing);
  const ny = Math.ceil(SPEC.radiusY / spacing);
  const nz = Math.ceil((SPEC.radiusZ * 2) / spacing);

  for (let iz = 0; iz <= nz; iz++) {
    for (let iy = 0; iy <= ny; iy++) {
      for (let ix = 0; ix <= nx; ix++) {
        const x = -SPEC.radiusX + ix * spacing;
        const y = SPEC.y0 + iy * spacing;
        const z = -SPEC.radiusZ + iz * spacing;
        if (!insideDome(x, y, z)) continue;
        const pinned = iy === 0;
        const mass = pinned ? 0 : density * (nodeHalf * 2) ** 3;
        const body = physics.addBody({
          position: [x, y, z],
          shapeType: 'sphere',
          radius: nodeHalf,
          mass,
          friction,
          lockRotation: true,
          collisionGroup: GEL_COLLISION_GROUP,
          // Live beads collide with floor/hands only — not each other.
          collisionMask: KINEMATIC_COLLISION_GROUP,
        });
        nodes.push({ body, x, y, z, pinned });
      }
    }
  }

  const liveBodies = nodes.filter((n) => !n.pinned).map((n) => n.body);
  const pinnedBodies = nodes.filter((n) => n.pinned).map((n) => n.body);

  const visuals = createTrackedBodyVisualSet(scene, physics, {
    capacity: Math.max(liveBodies.length, 1),
    geometry: new THREE.SphereGeometry(nodeHalf, 10, 8),
    color: 0x3dba6e,
    roughness: 0.45,
    metalness: 0.05,
    showOutline: false,
    castShadow: false,
    receiveShadow: false,
  });
  for (const body of liveBodies) visuals.addBody(body);

  const stretchMax = spacing * 1.12;
  const shearMax = spacing * 1.75;
  const stretchMaxSq = stretchMax * stretchMax;
  const shearMaxSq = shearMax * shearMax;
  const invCell = 1 / spacing;
  const grid = new Map<number, number[]>();
  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i];
    const key = cellKey(
      Math.floor(n.x * invCell),
      Math.floor(n.y * invCell),
      Math.floor(n.z * invCell),
    );
    let bucket = grid.get(key);
    if (!bucket) {
      bucket = [];
      grid.set(key, bucket);
    }
    bucket.push(i);
  }

  const springs: GelSpring[] = [];
  const linked = new Set<number>();
  const pairKey = (a: number, b: number) => (a < b ? a * 1_000_003 + b : b * 1_000_003 + a);

  for (let i = 0; i < nodes.length; i++) {
    const a = nodes[i];
    const ax = Math.floor(a.x * invCell);
    const ay = Math.floor(a.y * invCell);
    const az = Math.floor(a.z * invCell);
    for (let oz = -1; oz <= 1; oz++) {
      for (let oy = -1; oy <= 1; oy++) {
        for (let ox = -1; ox <= 1; ox++) {
          const bucket = grid.get(cellKey(ax + ox, ay + oy, az + oz));
          if (!bucket) continue;
          for (const j of bucket) {
            if (j <= i) continue;
            const pk = pairKey(i, j);
            if (linked.has(pk)) continue;
            const b = nodes[j];
            const dx = a.x - b.x;
            const dy = a.y - b.y;
            const dz = a.z - b.z;
            const d2 = dx * dx + dy * dy + dz * dz;
            if (d2 > shearMaxSq || d2 < 1e-10) continue;
            linked.add(pk);
            const rest = Math.sqrt(d2);
            const stiff = d2 <= stretchMaxSq ? SPEC.stretchStiffness : SPEC.shearStiffness;
            const index = physics.addSpring(
              a.body,
              b.body,
              [0, 0, 0],
              [0, 0, 0],
              stiff,
              rest,
              true,
            );
            springs.push({
              index,
              bodyA: a.body,
              bodyB: b.body,
              mid: [(a.x + b.x) * 0.5, (a.y + b.y) * 0.5, (a.z + b.z) * 0.5],
              active: true,
            });
          }
        }
      }
    }
  }

  return {
    liveBodies,
    pinnedBodies,
    springs,
    visuals,
    springCount: springs.length,
  };
}

const MAX_CUTS_PER_FRAME = 144;

/** Sever springs whose rest midpoint lies inside an oriented box (kinematic blade). */
export function severGelSpringsInObbs(
  physics: PhysicsEngine,
  springs: GelSpring[],
  blades: Array<{
    position: [number, number, number];
    halfExtents: [number, number, number];
    quaternion: [number, number, number, number];
  }>,
): number {
  if (!blades.length) return 0;
  let cut = 0;
  for (const s of springs) {
    if (!s.active || cut >= MAX_CUTS_PER_FRAME) continue;
    for (const b of blades) {
      if (pointInObb(s.mid, b.position, b.halfExtents, b.quaternion)) {
        if (physics.disableSpring(s.index)) {
          s.active = false;
          cut++;
        }
        break;
      }
    }
  }
  return cut;
}

function pointInObb(
  p: [number, number, number],
  center: [number, number, number],
  half: [number, number, number],
  q: [number, number, number, number],
): boolean {
  const qx = -q[0];
  const qy = -q[1];
  const qz = -q[2];
  const qw = q[3];
  const vx = p[0] - center[0];
  const vy = p[1] - center[1];
  const vz = p[2] - center[2];
  const ix = qw * vx + qy * vz - qz * vy;
  const iy = qw * vy + qz * vx - qx * vz;
  const iz = qw * vz + qx * vy - qy * vx;
  const iw = -qx * vx - qy * vy - qz * vz;
  const lx = ix * qw + iw * -qx + iy * -qz - iz * -qy;
  const ly = iy * qw + iw * -qy + iz * -qx - ix * -qz;
  const lz = iz * qw + iw * -qz + ix * -qy - iy * -qx;
  return Math.abs(lx) <= half[0] && Math.abs(ly) <= half[1] && Math.abs(lz) <= half[2];
}
