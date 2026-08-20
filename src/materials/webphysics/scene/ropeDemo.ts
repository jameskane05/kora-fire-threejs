import * as THREE from 'three';
import { debugParam } from '../../avbdDebugFlags';
import { PhysicsEngine } from '../physics/PhysicsEngine';
import {
  createTrackedBodyVisualSet,
  type TrackedBodyVisualSet,
} from './trackedBodyVisuals';
import { createTrackedRopeTube, type RopeKnot } from './trackedRopeTube';
import type { SyncedSceneVisual } from './springClothPatch';
import type { TrackedSpringVisualSet } from './trackedSpringVisuals';

export type RopeDemoVariant =
  | 'rope-demo'
  | 'heavy-rope-demo';

export type RopeDemoResult = {
  trackedVisualSets: TrackedBodyVisualSet[];
  trackedSpringVisualSets: TrackedSpringVisualSet[];
  syncedVisuals: SyncedSceneVisual[];
};

const ROPE_LINK_COUNT = 40;
const ROPE_Y = 20.0;
const HEAVY_ROPE_Y = 24.0;
const LINK_HALF_EXTENTS: [number, number, number] = [0.25, 0.2, 0.2];
const HEAVY_HALF_EXTENTS: [number, number, number] = [2.5, 2.5, 2.5];
const LINK_MASS = 0.25;
const DENSITY = 1.0;
const JOINT_STIFFNESS = Number.POSITIVE_INFINITY;
const TUBE_RADIUS = 0.17;

function boxMass(halfExtents: [number, number, number], density: number): number {
  const fullX = halfExtents[0] * 2.0;
  const fullY = halfExtents[1] * 2.0;
  const fullZ = halfExtents[2] * 2.0;
  return fullX * fullY * fullZ * density;
}

export function buildRopeDemo(args: {
  scene: THREE.Object3D;
  physics: PhysicsEngine;
  variant: RopeDemoVariant;
}): RopeDemoResult {
  const { scene, physics, variant } = args;
  const trackedVisualSets: TrackedBodyVisualSet[] = [];
  const trackedSpringVisualSets: TrackedSpringVisualSet[] = [];
  const syncedVisuals: SyncedSceneVisual[] = [];

  const isHeavyVariant = variant === 'heavy-rope-demo';
  const linkCount = isHeavyVariant ? ROPE_LINK_COUNT - 1 : ROPE_LINK_COUNT;
  const linkHalfLength = LINK_HALF_EXTENTS[0];
  const linkLength = linkHalfLength * 2.0;

  // `?ropeboxes=1` draws the collision links over the tube, for checking that the swept surface
  // actually tracks the chain rather than lagging or drifting off it.
  const showLinkBoxes = debugParam('ropeboxes') === '1';
  const linkVisuals = showLinkBoxes
    ? createTrackedBodyVisualSet(scene, physics, {
      capacity: linkCount,
      halfExtents: LINK_HALF_EXTENTS,
      color: 0xb7c4d6,
      roughness: 0.72,
      metalness: 0.04,
    })
    : null;
  if (linkVisuals) trackedVisualSets.push(linkVisuals);

  let heavyVisuals: TrackedBodyVisualSet | null = null;
  if (isHeavyVariant) {
    heavyVisuals = createTrackedBodyVisualSet(scene, physics, {
      capacity: 1,
      halfExtents: HEAVY_HALF_EXTENTS,
      color: 0xd5b06a,
      roughness: 0.76,
      metalness: 0.03,
    });
    trackedVisualSets.push(heavyVisuals);
  }

  const ropeY = isHeavyVariant ? HEAVY_ROPE_Y : ROPE_Y;
  const startX = (isHeavyVariant ? 7.75 : 10.0) - linkCount * linkLength + linkHalfLength;
  const linkBodies: number[] = [];
  let prevBody: number | null = null;

  for (let i = 0; i < linkCount; i++) {
    const isAnchor = i === 0;
    const body = physics.addBody({
      position: [startX + i * linkLength, ropeY, 0.0],
      halfExtents: LINK_HALF_EXTENTS,
      mass: isAnchor ? 0.0 : LINK_MASS,
      friction: 0.5,
    });
    linkBodies.push(body);
    linkVisuals?.addBody(body);

    if (prevBody !== null) {
      physics.addSphericalJoint(
        prevBody,
        body,
        [linkHalfLength, 0.0, 0.0],
        [-linkHalfLength, 0.0, 0.0],
        JOINT_STIFFNESS,
        true,
      );
    }
    prevBody = body;
  }

  const knots: RopeKnot[] = [{
    bodyA: linkBodies[0]!,
    offsetA: [-linkHalfLength, 0.0, 0.0],
  }];
  for (let i = 1; i < linkCount; i++) {
    knots.push({
      bodyA: linkBodies[i - 1]!,
      offsetA: [linkHalfLength, 0.0, 0.0],
      bodyB: linkBodies[i]!,
      offsetB: [-linkHalfLength, 0.0, 0.0],
    });
  }

  if (isHeavyVariant) {
    const heavyBody = physics.addBody({
      position: [startX + linkCount * linkLength - linkHalfLength + HEAVY_HALF_EXTENTS[0], ropeY, 0.0],
      halfExtents: HEAVY_HALF_EXTENTS,
      mass: boxMass(HEAVY_HALF_EXTENTS, DENSITY),
      friction: 0.5,
    });
    heavyVisuals!.addBody(heavyBody);
    physics.addSphericalJoint(
      prevBody!,
      heavyBody,
      [linkHalfLength, 0.0, 0.0],
      [-HEAVY_HALF_EXTENTS[0], 0.0, 0.0],
      JOINT_STIFFNESS,
      true,
    );
    // Last knot rides the joint into the weight, so the rope meets its face instead of
    // stopping short with a rounded tip floating beside it.
    knots.push({
      bodyA: linkBodies[linkCount - 1]!,
      offsetA: [linkHalfLength, 0.0, 0.0],
      bodyB: heavyBody,
      offsetB: [-HEAVY_HALF_EXTENTS[0], 0.0, 0.0],
    });
  } else {
    knots.push({
      bodyA: linkBodies[linkCount - 1]!,
      offsetA: [linkHalfLength, 0.0, 0.0],
    });
  }

  syncedVisuals.push(createTrackedRopeTube(scene, physics, {
    knots,
    radius: TUBE_RADIUS,
    color: 0xb7a07a,
    radialSegments: 20,
    segmentsPerSpan: 8,
    strands: 3,
    layDepth: 0.17,
    layTurnsPerSpan: 0.6,
    capStart: true,
    capEnd: !isHeavyVariant,
    roughness: 0.9,
    metalness: 0.0,
  }));

  return {
    trackedVisualSets,
    trackedSpringVisualSets,
    syncedVisuals,
  };
}
