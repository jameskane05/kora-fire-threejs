import * as THREE from 'three';
import { PhysicsEngine } from '../physics/PhysicsEngine';
import type { AddStaticBoxWithVisual } from './springClothPatch';
import type { TrackedSpringVisualSet } from './trackedSpringVisuals';
import { createWalkingCrowd, type WalkableRegion, type WalkingCrowd } from './walkingCrowd';

export type CliffPlateauDemoResult = {
  trackedVisualSets: WalkingCrowd['trackedVisualSets'];
  trackedSpringVisualSets: TrackedSpringVisualSet[];
  updateBeforeStep: (dt: number, renderer: any) => void;
  activateWalkerByRay: WalkingCrowd['activateWalkerByRay'];
  setImpactorRange: WalkingCrowd['setImpactorRange'];
  reset: () => void;
  statusText: () => string;
};

const COLLISION_GROUP_WORLD = 0x01;
const COLLISION_GROUP_RAGDOLL = 0x04;

const WALKER_COUNT = 130;
const WALKER_SCALE = 0.92;

const PLATEAU_TOP_Y = 18.0;
const PLATEAU_HALF_X = 23.0;
const PLATEAU_HALF_Z = 23.0;
/** Steering and the fall trigger use the top face; the walkable area stops just short of it. */
const PLATEAU_WALK_MARGIN = 0.6;

const LEDGE_HALF_THICKNESS = 0.7;
const CLIFF_FRICTION = 0.42;

function quaternionFromEuler(x: number, y: number, z: number): [number, number, number, number] {
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(x, y, z, 'XYZ'));
  return [q.x, q.y, q.z, q.w];
}

function createPlateauRegion(): WalkableRegion {
  const halfX = PLATEAU_HALF_X - PLATEAU_WALK_MARGIN;
  const halfZ = PLATEAU_HALF_Z - PLATEAU_WALK_MARGIN;
  return {
    groundY: PLATEAU_TOP_Y,
    distanceToEdge(x: number, z: number): number {
      return Math.min(halfX - Math.abs(x), halfZ - Math.abs(z));
    },
    inwardDirection(x: number, z: number, out: THREE.Vector2): void {
      // Push back along the nearest edge's normal rather than toward the centre, so a walker
      // skimming one rim is not dragged across the whole plateau.
      const toXEdge = halfX - Math.abs(x);
      const toZEdge = halfZ - Math.abs(z);
      if (toXEdge < toZEdge) out.set(x >= 0 ? -1 : 1, 0);
      else out.set(0, z >= 0 ? -1 : 1);
    },
    samplePoint(u1: number, u2: number, inset: number, out: THREE.Vector2): void {
      out.set((u1 * 2.0 - 1.0) * halfX * inset, (u2 * 2.0 - 1.0) * halfZ * inset);
    },
    samplePointBeyondEdge(u1: number, u2: number, out: THREE.Vector2): void {
      const along = (u2 * 2.0 - 1.0) * 0.85;
      const past = 1.25;
      const side = Math.min(3, Math.floor(u1 * 4.0));
      if (side === 0) out.set(halfX * past, halfZ * along);
      else if (side === 1) out.set(-halfX * past, halfZ * along);
      else if (side === 2) out.set(halfX * along, halfZ * past);
      else out.set(halfX * along, -halfZ * past);
    },
  };
}

/**
 * A mesa full of wandering ragdolls, with nothing but air past the rim.
 *
 * Everyone up top is kinematic and posed by a walk-cycle compute pass, so the solver only pays
 * for the ones currently falling. Walkers turn into ragdolls the moment they lose the ground:
 * over the edge, shoved by a grab, or hit hard enough by something already tumbling.
 */
export function buildCliffPlateauDemo(args: {
  scene: THREE.Object3D;
  physics: PhysicsEngine;
  addStaticBoxWithVisual: AddStaticBoxWithVisual;
}): CliffPlateauDemoResult {
  const { scene, physics, addStaticBoxWithVisual } = args;

  addStaticBoxWithVisual(
    [0.0, PLATEAU_TOP_Y - PLATEAU_HALF_Z * 0.5, 0.0],
    [PLATEAU_HALF_X, PLATEAU_HALF_Z * 0.5, PLATEAU_HALF_Z],
    { color: 0x6a7482, friction: CLIFF_FRICTION, markings: true },
  );

  // Ledges on the way down, to break long falls into a tumble.
  const ledges: Array<{ position: [number, number, number]; half: [number, number, number]; tilt: number }> = [
    { position: [PLATEAU_HALF_X + 3.4, 12.2, -6.0], half: [4.6, LEDGE_HALF_THICKNESS, 9.0], tilt: -0.24 },
    { position: [-PLATEAU_HALF_X - 4.0, 8.4, 7.5], half: [5.2, LEDGE_HALF_THICKNESS, 8.0], tilt: 0.28 },
    { position: [5.0, 6.6, PLATEAU_HALF_Z + 3.8], half: [9.5, LEDGE_HALF_THICKNESS, 4.4], tilt: 0.0 },
    { position: [-7.0, 11.0, -PLATEAU_HALF_Z - 3.2], half: [8.0, LEDGE_HALF_THICKNESS, 4.0], tilt: 0.0 },
  ];
  for (const ledge of ledges) {
    addStaticBoxWithVisual(ledge.position, ledge.half, {
      quaternion: quaternionFromEuler(0.0, 0.0, ledge.tilt),
      color: 0x5d6674,
      friction: CLIFF_FRICTION,
    });
  }

  const region = createPlateauRegion();
  const crowd = createWalkingCrowd({
    scene,
    physics,
    count: WALKER_COUNT,
    region,
    scale: WALKER_SCALE,
    colorBucketCount: 26,
    spawnRadius: Math.min(PLATEAU_HALF_X, PLATEAU_HALF_Z) - 2.5,
    ragdollCollisionGroup: COLLISION_GROUP_RAGDOLL,
    ragdollCollisionMask: COLLISION_GROUP_WORLD | COLLISION_GROUP_RAGDOLL,
  });

  return {
    trackedVisualSets: crowd.trackedVisualSets,
    trackedSpringVisualSets: [],
    updateBeforeStep: crowd.updateBeforeStep,
    activateWalkerByRay: crowd.activateWalkerByRay,
    setImpactorRange: crowd.setImpactorRange,
    reset: crowd.reset,
    statusText: crowd.statusText,
  };
}
