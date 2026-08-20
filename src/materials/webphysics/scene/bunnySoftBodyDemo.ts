import * as THREE from 'three';
import { PhysicsEngine } from '../physics/PhysicsEngine';
import { BUNNY_SOFT_BODY_FILLED_HEX, BUNNY_SOFT_BODY_GRID_DIMS } from './bunnySoftBodyData';
import {
  buildVoxelSoftBody,
  decodeFilledBitsetHex,
  type SoftBodyLatticeBuildResult,
} from './softBodyLattice';

const CELL_SIZE = 0.3;
const BASE_Y = 9.0;
const JOINT_STIFFNESS = 800.0;
const DENSITY = 0.85;
const BODY_FRICTION = 0.52;
const BUNNY_COLOR = 0x9f1d35;

export function buildBunnySoftBodyDemo(args: {
  scene: THREE.Object3D;
  physics: PhysicsEngine;
  addStaticBoxWithVisual: (
    position: [number, number, number],
    halfExtents: [number, number, number],
    options?: {
      quaternion?: [number, number, number, number];
      color?: number;
    },
  ) => void;
}): SoftBodyLatticeBuildResult {
  const { scene, physics, addStaticBoxWithVisual } = args;

  const floorHalfExtents: [number, number, number] = [18.0, 0.5, 18.0];
  const floorOffset = 14.0;
  addStaticBoxWithVisual([-floorOffset, -floorHalfExtents[1], -floorOffset], floorHalfExtents, { color: 0x495563 });
  addStaticBoxWithVisual([floorOffset, -floorHalfExtents[1], -floorOffset], floorHalfExtents, { color: 0x495563 });
  addStaticBoxWithVisual([-floorOffset, -floorHalfExtents[1], floorOffset], floorHalfExtents, { color: 0x495563 });
  addStaticBoxWithVisual([floorOffset, -floorHalfExtents[1], floorOffset], floorHalfExtents, { color: 0x495563 });

  const filledIndices = decodeFilledBitsetHex(BUNNY_SOFT_BODY_GRID_DIMS, BUNNY_SOFT_BODY_FILLED_HEX);
  return buildVoxelSoftBody({
    scene,
    physics,
    gridDims: BUNNY_SOFT_BODY_GRID_DIMS,
    filledIndices,
    cellSize: CELL_SIZE,
    basePosition: [0.0, BASE_Y, 0.0],
    color: BUNNY_COLOR,
    density: DENSITY,
    friction: BODY_FRICTION,
    jointStiffness: JOINT_STIFFNESS,
    roughness: 0.76,
    metalness: 0.02,
  });
}
