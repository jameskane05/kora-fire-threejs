import * as THREE from 'three';
import { PhysicsEngine } from '../physics/PhysicsEngine';
import type { TrackedSpringVisualSet } from './trackedSpringVisuals';
import {
  buildSpringClothPatch,
  type AddStaticBoxWithVisual,
  type SyncedSceneVisual,
} from './springClothPatch';
import { createRagdollFactory } from './ragdollFactory';

export type RagdollClothDemoResult = {
  trackedVisualSets: ReturnType<typeof createRagdollFactory>['trackedVisualSets'];
  trackedSpringVisualSets: TrackedSpringVisualSet[];
  syncedVisuals: SyncedSceneVisual[];
  update: (dt: number) => void;
  reset: () => void;
};

const COLLISION_GROUP_WORLD = 0x01;
const COLLISION_GROUP_CLOTH = 0x02;
const COLLISION_GROUP_RAGDOLL = 0x04;

const CLOTH_COLS = 44;
const CLOTH_ROWS = 32;
const CLOTH_NODE_SPACING = 0.42;
const CLOTH_Y = 9.25;
const CLOTH_NODE_MASS = 0.16;
const CLOTH_NODE_HALF_EXTENTS: [number, number, number] = [0.31, 0.11, 0.31];
const STRUCTURAL_STIFFNESS = 6400.0;
const SHEAR_STIFFNESS = 2400.0;
const BENDING_STIFFNESS = 1600.0;

const RAGDOLL_COUNT = 100;
const RAGDOLL_GRID_X = 10;
const RAGDOLL_GRID_Z = 10;

export function buildRagdollClothDemo(args: {
  scene: THREE.Object3D;
  physics: PhysicsEngine;
  addStaticBoxWithVisual: AddStaticBoxWithVisual;
}): RagdollClothDemoResult {
  const { scene, physics, addStaticBoxWithVisual } = args;
  const trackedSpringVisualSets: TrackedSpringVisualSet[] = [];
  const cloth = buildSpringClothPatch({
    scene,
    physics,
    addStaticBoxWithVisual,
    worldCollisionGroup: COLLISION_GROUP_WORLD,
    worldCollisionMask: COLLISION_GROUP_WORLD | COLLISION_GROUP_CLOTH | COLLISION_GROUP_RAGDOLL,
    clothCollisionGroup: COLLISION_GROUP_CLOTH,
    clothCollisionMask: COLLISION_GROUP_WORLD | COLLISION_GROUP_RAGDOLL,
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
    bendingStiffness: BENDING_STIFFNESS,
    clothColor: 0x8fc2f5,
    clothRenderSubdivisions: 4,
    drivenCorners: false,
    supportMode: 'boundary',
  });
  const clothWidth = cloth.clothWidth;
  const clothDepth = cloth.clothDepth;
  const ragdollFactory = createRagdollFactory({
    scene,
    physics,
    totalRagdolls: RAGDOLL_COUNT,
    collisionGroup: COLLISION_GROUP_RAGDOLL,
    collisionMask: COLLISION_GROUP_WORLD | COLLISION_GROUP_CLOTH | COLLISION_GROUP_RAGDOLL,
  });

  const ragdollInsetX = 1.8;
  const ragdollInsetZ = 1.6;
  const ragdollSpanX = Math.max(1.0, clothWidth - ragdollInsetX * 2.0);
  const ragdollSpanZ = Math.max(1.0, clothDepth - ragdollInsetZ * 2.0);
  const ragdollSpacingX = ragdollSpanX / Math.max(1, RAGDOLL_GRID_X - 1);
  const ragdollSpacingZ = ragdollSpanZ / Math.max(1, RAGDOLL_GRID_Z - 1);
  const ragdollStartX = -ragdollSpanX * 0.5;
  const ragdollStartZ = -ragdollSpanZ * 0.5;
  const ragdollSpawns = new Array<{ position: [number, number, number]; velocity: [number, number, number] }>();
  for (let gz = 0; gz < RAGDOLL_GRID_Z; gz++) {
    for (let gx = 0; gx < RAGDOLL_GRID_X; gx++) {
      const index = gz * RAGDOLL_GRID_X + gx;
      const heightBand = index % 5;
      const lateralBand = (gx % 2 === 0 ? -1.0 : 1.0) * (0.04 + (gz % 3) * 0.02);
      const depthBand = (gz % 2 === 0 ? 1.0 : -1.0) * (0.03 + (gx % 4) * 0.015);
      ragdollSpawns.push({
        position: [
          ragdollStartX + gx * ragdollSpacingX,
          CLOTH_Y + 6.2 + heightBand * 1.05 + ((gx + gz) % 3) * 0.24,
          ragdollStartZ + gz * ragdollSpacingZ,
        ],
        velocity: [lateralBand, 0.0, depthBand],
      });
    }
  }
  ragdollSpawns.forEach((spawn, index) => {
    ragdollFactory.addRagdoll({
      index,
      rootPosition: spawn.position,
      linearVelocity: spawn.velocity,
    });
  });

  return {
    trackedVisualSets: ragdollFactory.trackedVisualSets,
    trackedSpringVisualSets,
    syncedVisuals: cloth.syncedVisuals,
    update: cloth.update,
    reset: cloth.reset,
  };
}
