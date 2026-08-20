import * as THREE from 'three';
import { PhysicsEngine } from '../physics/PhysicsEngine';
import {
  createTrackedBodyVisualSet,
  type TrackedBodyVisualSet,
} from './trackedBodyVisuals';
import type { TrackedSpringVisualSet } from './trackedSpringVisuals';

export type SoftBodyLatticeBuildResult = {
  trackedVisualSets: TrackedBodyVisualSet[];
  trackedSpringVisualSets: TrackedSpringVisualSet[];
};

export type VoxelSoftBodyBodyCreatedInfo = {
  filledIndex: number;
  body: number;
  position: [number, number, number];
  localPosition: [number, number, number];
  centeredLocalPosition: [number, number, number];
  grid: [number, number, number];
};

export function createFilledGridIndices(gridDims: readonly [number, number, number]): number[] {
  const [gridX, gridY, gridZ] = gridDims;
  const filled: number[] = [];
  for (let y = 0; y < gridY; y++) {
    for (let x = 0; x < gridX; x++) {
      for (let z = 0; z < gridZ; z++) {
        filled.push(x + gridX * (z + gridZ * y));
      }
    }
  }
  return filled;
}

export function createFilledSphereIndices(
  gridDims: readonly [number, number, number],
  radiusInCells: number,
): number[] {
  const [gridX, gridY, gridZ] = gridDims;
  const cx = (gridX - 1) * 0.5;
  const cy = (gridY - 1) * 0.5;
  const cz = (gridZ - 1) * 0.5;
  const radiusSq = radiusInCells * radiusInCells;
  const filled: number[] = [];
  for (let y = 0; y < gridY; y++) {
    for (let x = 0; x < gridX; x++) {
      for (let z = 0; z < gridZ; z++) {
        const dx = x - cx;
        const dy = y - cy;
        const dz = z - cz;
        if (dx * dx + dy * dy + dz * dz <= radiusSq) {
          filled.push(x + gridX * (z + gridZ * y));
        }
      }
    }
  }
  return filled;
}

export function decodeFilledBitsetHex(
  gridDims: readonly [number, number, number],
  hex: string,
): number[] {
  if (hex.length % 2 !== 0) {
    throw new Error('Invalid bunny soft body bitset hex length');
  }
  const bitset = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bitset[i >> 1] = Number.parseInt(hex.slice(i, i + 2), 16);
  }
  const total = gridDims[0] * gridDims[1] * gridDims[2];
  const filled: number[] = [];
  for (let index = 0; index < total; index++) {
    if ((bitset[index >> 3] & (1 << (index & 7))) !== 0) {
      filled.push(index);
    }
  }
  return filled;
}

function linearIndex(
  gridDims: readonly [number, number, number],
  x: number,
  y: number,
  z: number,
): number {
  return x + gridDims[0] * (z + gridDims[2] * y);
}

function bodyMass(cellSize: number, density: number): number {
  return cellSize * cellSize * cellSize * density;
}

export function buildVoxelSoftBody(args: {
  scene: THREE.Object3D;
  physics: PhysicsEngine;
  gridDims: readonly [number, number, number];
  filledIndices: readonly number[];
  cellSize: number;
  basePosition: [number, number, number];
  color: number;
  density: number;
  friction: number;
  jointStiffness: number;
  roughness?: number;
  metalness?: number;
  geometry?: THREE.BufferGeometry;
  showOutline?: boolean;
  castShadow?: boolean;
  receiveShadow?: boolean;
  onBodyCreated?: (info: VoxelSoftBodyBodyCreatedInfo) => void;
}): SoftBodyLatticeBuildResult {
  const {
    scene,
    physics,
    gridDims,
    filledIndices,
    cellSize,
    basePosition,
    color,
    density,
    friction,
    jointStiffness,
    roughness,
    metalness,
    geometry,
    showOutline,
    castShadow,
    receiveShadow,
    onBodyCreated,
  } = args;

  const [gridX, gridY, gridZ] = gridDims;
  const halfSize = cellSize * 0.5;
  const visuals = createTrackedBodyVisualSet(scene, physics, {
    capacity: filledIndices.length,
    halfExtents: [halfSize, halfSize, halfSize],
    ...(geometry ? { geometry } : {}),
    color,
    roughness: roughness ?? 0.78,
    metalness: metalness ?? 0.03,
    ...(showOutline !== undefined ? { showOutline } : {}),
    ...(castShadow !== undefined ? { castShadow } : {}),
    ...(receiveShadow !== undefined ? { receiveShadow } : {}),
  });

  const totalCells = gridX * gridY * gridZ;
  const bodyIds = new Int32Array(totalCells).fill(-1);
  const mass = bodyMass(cellSize, density);

  for (const filledIndex of filledIndices) {
    const x = filledIndex % gridX;
    const yz = Math.floor(filledIndex / gridX);
    const z = yz % gridZ;
    const y = Math.floor(yz / gridZ);
    const position: [number, number, number] = [
      basePosition[0] + (x - (gridX - 1) * 0.5) * cellSize,
      basePosition[1] + y * cellSize,
      basePosition[2] + (z - (gridZ - 1) * 0.5) * cellSize,
    ];
    const centeredLocalPosition: [number, number, number] = [
      (x - (gridX - 1) * 0.5) * cellSize,
      (y - (gridY - 1) * 0.5) * cellSize,
      (z - (gridZ - 1) * 0.5) * cellSize,
    ];
    const body = physics.addBody({
      position,
      halfExtents: [halfSize, halfSize, halfSize],
      mass,
      friction,
    });
    visuals.addBody(body);
    bodyIds[filledIndex] = body;
    onBodyCreated?.({
      filledIndex,
      body,
      position,
      localPosition: [
        (x - (gridX - 1) * 0.5) * cellSize,
        y * cellSize,
        (z - (gridZ - 1) * 0.5) * cellSize,
      ],
      centeredLocalPosition,
      grid: [x, y, z],
    });
  }

  for (const filledIndex of filledIndices) {
    const x = filledIndex % gridX;
    const yz = Math.floor(filledIndex / gridX);
    const z = yz % gridZ;
    const y = Math.floor(yz / gridZ);
    const body = bodyIds[filledIndex];
    if (body < 0) continue;

    if (x + 1 < gridX) {
      const neighbor = bodyIds[linearIndex(gridDims, x + 1, y, z)];
      if (neighbor >= 0) {
        physics.addFixedJoint(body, neighbor, [halfSize, 0.0, 0.0], [-halfSize, 0.0, 0.0], jointStiffness, true);
      }
    }
    if (y + 1 < gridY) {
      const neighbor = bodyIds[linearIndex(gridDims, x, y + 1, z)];
      if (neighbor >= 0) {
        physics.addFixedJoint(body, neighbor, [0.0, halfSize, 0.0], [0.0, -halfSize, 0.0], jointStiffness, true);
      }
    }
    if (z + 1 < gridZ) {
      const neighbor = bodyIds[linearIndex(gridDims, x, y, z + 1)];
      if (neighbor >= 0) {
        physics.addFixedJoint(body, neighbor, [0.0, 0.0, halfSize], [0.0, 0.0, -halfSize], jointStiffness, true);
      }
    }
  }

  for (let x = 0; x + 1 < gridX; x++) {
    for (let y = 0; y + 1 < gridY; y++) {
      for (let z = 0; z < gridZ; z++) {
        const a = bodyIds[linearIndex(gridDims, x, y, z)];
        const b = bodyIds[linearIndex(gridDims, x + 1, y + 1, z)];
        if (a >= 0 && b >= 0) {
          physics.setBodyPairCollisionIgnored(a, b, true);
        }
        const c = bodyIds[linearIndex(gridDims, x + 1, y, z)];
        const d = bodyIds[linearIndex(gridDims, x, y + 1, z)];
        if (c >= 0 && d >= 0) {
          physics.setBodyPairCollisionIgnored(c, d, true);
        }
      }
    }
  }

  for (let x = 0; x < gridX; x++) {
    for (let y = 0; y + 1 < gridY; y++) {
      for (let z = 0; z + 1 < gridZ; z++) {
        const a = bodyIds[linearIndex(gridDims, x, y, z)];
        const b = bodyIds[linearIndex(gridDims, x, y + 1, z + 1)];
        if (a >= 0 && b >= 0) {
          physics.setBodyPairCollisionIgnored(a, b, true);
        }
        const c = bodyIds[linearIndex(gridDims, x, y + 1, z)];
        const d = bodyIds[linearIndex(gridDims, x, y, z + 1)];
        if (c >= 0 && d >= 0) {
          physics.setBodyPairCollisionIgnored(c, d, true);
        }
      }
    }
  }

  for (let x = 0; x + 1 < gridX; x++) {
    for (let y = 0; y < gridY; y++) {
      for (let z = 0; z + 1 < gridZ; z++) {
        const a = bodyIds[linearIndex(gridDims, x, y, z)];
        const b = bodyIds[linearIndex(gridDims, x + 1, y, z + 1)];
        if (a >= 0 && b >= 0) {
          physics.setBodyPairCollisionIgnored(a, b, true);
        }
        const c = bodyIds[linearIndex(gridDims, x + 1, y, z)];
        const d = bodyIds[linearIndex(gridDims, x, y, z + 1)];
        if (c >= 0 && d >= 0) {
          physics.setBodyPairCollisionIgnored(c, d, true);
        }
      }
    }
  }

  return {
    trackedVisualSets: [visuals],
    trackedSpringVisualSets: [],
  };
}
