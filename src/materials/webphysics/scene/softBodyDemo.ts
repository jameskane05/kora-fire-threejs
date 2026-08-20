import * as THREE from 'three';
import { PhysicsEngine } from '../physics/PhysicsEngine';
import {
  buildVoxelSoftBody,
  createFilledGridIndices,
  type SoftBodyLatticeBuildResult,
} from './softBodyLattice';

const GRID_DIMS = [4, 4, 4] as const;
const STACK_COUNT = 3;
const BODY_SIZE = 0.8;
const BASE_Y = 8.0;
const STACK_GAP = 2.0;
const JOINT_STIFFNESS = 800.0;
const DENSITY = 1.0;
const BODY_FRICTION = 0.5;
const STACK_COLORS = [0x7db3e8, 0xd9a35f, 0x88c26f] as const;
const STACK_POSITION_OFFSETS: ReadonlyArray<readonly [number, number]> = [
  [0.0, 0.0],
  [0.28, -0.16],
  [-0.22, 0.2],
] as const;

export type SoftBodyDemoResult = SoftBodyLatticeBuildResult;

export function buildSoftBodyDemo(args: {
  scene: THREE.Object3D;
  physics: PhysicsEngine;
}): SoftBodyDemoResult {
  const { scene, physics } = args;
  const filledIndices = createFilledGridIndices(GRID_DIMS);
  const trackedVisualSets: SoftBodyDemoResult['trackedVisualSets'] = [];
  const trackedSpringVisualSets: SoftBodyDemoResult['trackedSpringVisualSets'] = [];

  for (let stackIndex = 0; stackIndex < STACK_COUNT; stackIndex++) {
    const stackYOffset = stackIndex * (GRID_DIMS[1] * BODY_SIZE + STACK_GAP);
    const [offsetX, offsetZ] = STACK_POSITION_OFFSETS[stackIndex] ?? [0.0, 0.0];
    const stack = buildVoxelSoftBody({
      scene,
      physics,
      gridDims: GRID_DIMS,
      filledIndices,
      cellSize: BODY_SIZE,
      basePosition: [offsetX, BASE_Y + stackYOffset, offsetZ],
      color: STACK_COLORS[stackIndex % STACK_COLORS.length]!,
      density: DENSITY,
      friction: BODY_FRICTION,
      jointStiffness: JOINT_STIFFNESS,
    });
    trackedVisualSets.push(...stack.trackedVisualSets);
    trackedSpringVisualSets.push(...stack.trackedSpringVisualSets);
  }

  return {
    trackedVisualSets,
    trackedSpringVisualSets,
  };
}
