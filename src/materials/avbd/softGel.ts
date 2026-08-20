/**
 * Soft gel blob for AVBD — resting dome with stretch/shear springs and a pinned
 * anchor layer under the floor (not rendered). Kinematic colliders sever springs
 * (see cut.ts) so cuts don't heal.
 */
import { v3, type V3 } from './maths';
import { PositionGoal, Rigid, Solver, Spring } from './solver';

export type SoftGelSpec = {
  radiusX: number;
  radiusY: number;
  radiusZ: number;
  y0: number;
  spacing: number;
  nodeSize: number;
  density: number;
  stretchStiffness: number;
  shearStiffness: number;
  /**
   * COM-relative rest pull. Keep 0 when cutting is enabled — otherwise severed
   * chunks snap back into the original dome.
   */
  shapeStiffness: number;
  /** Overstretch tear backup (0 = off; kinematic OBB sever is the primary cut). */
  tearRatio: number;
  friction: number;
};

/**
 * ~1400-node dome: hidden pins + shear holds form; no shape-match so cuts persist.
 */
export const DEFAULT_SOFT_GEL: SoftGelSpec = {
  radiusX: 0.28,
  radiusY: 0.12,
  radiusZ: 0.28,
  y0: 0.04,
  spacing: 0.0254,
  nodeSize: 0.024,
  density: 550,
  stretchStiffness: 520,
  shearStiffness: 200,
  shapeStiffness: 0,
  tearRatio: 2.8,
  friction: 0.65,
};

export type SoftGelBuild = {
  nodes: Rigid[];
  goals: PositionGoal[];
  springs: Spring[];
  springCount: number;
  restCom: V3;
};

function insideDome(x: number, y: number, z: number, spec: SoftGelSpec): boolean {
  const u = x / spec.radiusX;
  const v = (y - spec.y0) / spec.radiusY;
  const w = z / spec.radiusZ;
  if (v < 0 || v > 1) return false;
  return u * u + w * w + v * v <= 1;
}

function cellKey(ix: number, iy: number, iz: number): number {
  return ((ix + 512) << 20) | ((iy + 512) << 10) | (iz + 512);
}

export function buildSoftGel(solver: Solver, spec: SoftGelSpec = DEFAULT_SOFT_GEL): SoftGelBuild {
  const { spacing, nodeSize, density, friction } = spec;
  const nodes: Rigid[] = [];

  const nx = Math.ceil((spec.radiusX * 2) / spacing);
  const ny = Math.ceil(spec.radiusY / spacing);
  const nz = Math.ceil((spec.radiusZ * 2) / spacing);

  for (let iz = 0; iz <= nz; iz++) {
    for (let iy = 0; iy <= ny; iy++) {
      for (let ix = 0; ix <= nx; ix++) {
        const x = -spec.radiusX + ix * spacing;
        const y = spec.y0 + iy * spacing;
        const z = -spec.radiusZ + iz * spacing;
        if (!insideDome(x, y, z, spec)) continue;
        const pinned = iy === 0;
        // Keep anchors on the lattice (same y as before) so stretch/shear links form.
        // They stay mass-0 / kinematic and are omitted from the instanced mesh.
        const body = new Rigid(
          solver,
          v3(nodeSize, nodeSize, nodeSize),
          pinned ? 0 : density,
          friction,
          v3(x, y, z),
        );
        body.soft = true;
        if (pinned) body.kinematic = true;
        nodes.push(body);
      }
    }
  }

  const restCom = v3();
  for (const n of nodes) {
    restCom.x += n.restLin.x;
    restCom.y += n.restLin.y;
    restCom.z += n.restLin.z;
  }
  const invN = 1 / Math.max(nodes.length, 1);
  restCom.x *= invN;
  restCom.y *= invN;
  restCom.z *= invN;

  const goals: PositionGoal[] = [];
  if (spec.shapeStiffness > 0) {
    for (const body of nodes) {
      if (body.mass <= 0) continue;
      goals.push(new PositionGoal(solver, body, { ...body.restLin }, spec.shapeStiffness));
    }
  }

  const springs: Spring[] = [];
  const stretchMax = spacing * 1.12;
  const shearMax = spacing * 1.75;
  const stretchMaxSq = stretchMax * stretchMax;
  const shearMaxSq = shearMax * shearMax;
  const invCell = 1 / spacing;
  const grid = new Map<number, number[]>();

  for (let i = 0; i < nodes.length; i++) {
    const p = nodes[i].positionLin;
    const key = cellKey(
      Math.floor(p.x * invCell),
      Math.floor(p.y * invCell),
      Math.floor(p.z * invCell),
    );
    let bucket = grid.get(key);
    if (!bucket) {
      bucket = [];
      grid.set(key, bucket);
    }
    bucket.push(i);
  }

  const linked = new Set<number>();
  const pairKey = (a: number, b: number) => (a < b ? a * 1_000_003 + b : b * 1_000_003 + a);

  for (let i = 0; i < nodes.length; i++) {
    const a = nodes[i];
    const ax = Math.floor(a.positionLin.x * invCell);
    const ay = Math.floor(a.positionLin.y * invCell);
    const az = Math.floor(a.positionLin.z * invCell);
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
            const dx = a.positionLin.x - b.positionLin.x;
            const dy = a.positionLin.y - b.positionLin.y;
            const dz = a.positionLin.z - b.positionLin.z;
            const d2 = dx * dx + dy * dy + dz * dz;
            if (d2 > shearMaxSq || d2 < 1e-10) continue;
            linked.add(pk);
            const rest = Math.sqrt(d2);
            const stiff = d2 <= stretchMaxSq ? spec.stretchStiffness : spec.shearStiffness;
            const spring = new Spring(solver, a, b, v3(), v3(), stiff, rest);
            spring.tearRatio = spec.tearRatio;
            springs.push(spring);
          }
        }
      }
    }
  }

  return { nodes, goals, springs, springCount: springs.length, restCom };
}

/** Update shape-match goals so rest offsets follow the live center of mass. */
export function updateSoftShapeGoals(nodes: Rigid[], goals: PositionGoal[], restCom: V3): void {
  if (!nodes.length || !goals.length) return;
  const com = v3();
  let nDyn = 0;
  for (const body of nodes) {
    if (body.mass <= 0) continue;
    com.x += body.positionLin.x;
    com.y += body.positionLin.y;
    com.z += body.positionLin.z;
    nDyn++;
  }
  if (nDyn === 0) return;
  const inv = 1 / nDyn;
  com.x *= inv;
  com.y *= inv;
  com.z *= inv;

  for (const goal of goals) {
    const body = goal.bodyA;
    if (!body) continue;
    goal.goal.x = com.x + (body.restLin.x - restCom.x);
    goal.goal.y = com.y + (body.restLin.y - restCom.y);
    goal.goal.z = com.z + (body.restLin.z - restCom.z);
  }
}

export function softGelOrigin(spec: SoftGelSpec = DEFAULT_SOFT_GEL): V3 {
  return v3(0, spec.y0 + spec.radiusY * 0.45, 0);
}
