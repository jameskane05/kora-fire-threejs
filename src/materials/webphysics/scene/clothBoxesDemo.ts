import * as THREE from 'three';
import { PhysicsEngine } from '../physics/PhysicsEngine';
import {
  createTrackedBodyVisualSet,
  type TrackedBodyVisualSet,
} from './trackedBodyVisuals';
import {
  buildSpringClothPatch,
  type AddStaticBoxWithVisual,
} from './springClothPatch';

export type ClothBoxesDemoResult = {
  clothBodyIds: number[];
  trackedVisualSets: TrackedBodyVisualSet[];
  trackedSpringVisualSets: [];
  syncedVisuals: Array<{
    syncVisuals: (engine: PhysicsEngine) => void;
    dispose: () => void;
  }>;
  update: (dt: number) => void;
  reset: () => void;
};

const COLLISION_GROUP_WORLD = 0x01;
const COLLISION_GROUP_CLOTH = 0x02;
const COLLISION_GROUP_PAYLOAD = 0x04;

const CLOTH_COLS = 18;
const CLOTH_ROWS = 12;
const CLOTH_NODE_SPACING = 0.42;
const CLOTH_Y = 8.25;
const CLOTH_NODE_HALF_EXTENTS: [number, number, number] = [0.31, 0.11, 0.31];
const CLOTH_NODE_MASS = 0.16;
const STRUCTURAL_STIFFNESS = 1100.0;
const SHEAR_STIFFNESS = 420.0;

const BOX_COUNT_X = 4;
const BOX_COUNT_Z = 4;
const BOX_COUNT_Y = 10;
const BOX_HALF_EXTENTS: [number, number, number] = [0.22, 0.22, 0.22];
const BOX_MASS = 0.18;

export function buildClothBoxesDemo(args: {
  scene: THREE.Object3D;
  physics: PhysicsEngine;
  addStaticBoxWithVisual: AddStaticBoxWithVisual;
}): ClothBoxesDemoResult {
  const { scene, physics, addStaticBoxWithVisual } = args;
  const trackedVisualSets: TrackedBodyVisualSet[] = [];

  const cloth = buildSpringClothPatch({
    scene,
    physics,
    addStaticBoxWithVisual,
    worldCollisionGroup: COLLISION_GROUP_WORLD,
    worldCollisionMask: COLLISION_GROUP_WORLD | COLLISION_GROUP_CLOTH | COLLISION_GROUP_PAYLOAD,
    clothCollisionGroup: COLLISION_GROUP_CLOTH,
    clothCollisionMask: COLLISION_GROUP_WORLD | COLLISION_GROUP_PAYLOAD,
    dims: {
      cols: CLOTH_COLS,
      rows: CLOTH_ROWS,
      nodeSpacing: CLOTH_NODE_SPACING,
    },
    clothY: CLOTH_Y,
    nodeHalfExtents: CLOTH_NODE_HALF_EXTENTS,
    nodeMass: CLOTH_NODE_MASS,
    structuralStiffness: STRUCTURAL_STIFFNESS,
    shearStiffness: SHEAR_STIFFNESS,
    clothColor: 0x8fc2f5,
    clothRenderSubdivisions: 4,
    drivenCorners: true,
  });

  const payloadVisuals = createTrackedBodyVisualSet(scene, physics, {
    capacity: BOX_COUNT_X * BOX_COUNT_Z * BOX_COUNT_Y,
    halfExtents: BOX_HALF_EXTENTS,
    color: 0xcf7440,
    roughness: 0.74,
    metalness: 0.05,
  });
  trackedVisualSets.push(payloadVisuals);

  const payloadStepX = BOX_HALF_EXTENTS[0] * 2.0 + 0.02;
  const payloadStepY = BOX_HALF_EXTENTS[1] * 2.0 + 0.02;
  const payloadStepZ = BOX_HALF_EXTENTS[2] * 2.0 + 0.02;
  for (let iy = 0; iy < BOX_COUNT_Y; iy++) {
    for (let iz = 0; iz < BOX_COUNT_Z; iz++) {
      for (let ix = 0; ix < BOX_COUNT_X; ix++) {
        const x = (ix - (BOX_COUNT_X - 1) * 0.5) * payloadStepX;
        const z = (iz - (BOX_COUNT_Z - 1) * 0.5) * payloadStepZ;
        const body = physics.addBody({
          position: [
            x,
            CLOTH_Y + 0.6 + BOX_HALF_EXTENTS[1] + iy * payloadStepY,
            z,
          ],
          halfExtents: BOX_HALF_EXTENTS,
          mass: BOX_MASS,
          friction: 0.64,
          collisionGroup: COLLISION_GROUP_PAYLOAD,
          collisionMask: COLLISION_GROUP_WORLD | COLLISION_GROUP_CLOTH | COLLISION_GROUP_PAYLOAD,
        });
        payloadVisuals.addBody(body);
      }
    }
  }

  return {
    clothBodyIds: cloth.clothBodyIds,
    trackedVisualSets,
    trackedSpringVisualSets: [],
    syncedVisuals: cloth.syncedVisuals,
    update: cloth.update,
    reset: cloth.reset,
  };
}
