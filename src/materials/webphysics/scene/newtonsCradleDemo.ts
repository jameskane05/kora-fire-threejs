import * as THREE from 'three';
import { PhysicsEngine } from '../physics/PhysicsEngine';
import {
  createTrackedBodyVisualSet,
  type TrackedBodyVisualSet,
} from './trackedBodyVisuals';
import {
  createTrackedSpringVisualSet,
  type TrackedSpringVisualSet,
} from './trackedSpringVisuals';
import type { AddStaticBoxWithVisual } from './springClothPatch';

type NewtonsCradleDemoResult = {
  trackedVisualSets: TrackedBodyVisualSet[];
  trackedSpringVisualSets: TrackedSpringVisualSet[];
};

type CradleSpec = {
  ballCount: number;
  centerX: number;
  centerZ: number;
  beamY: number;
  ballRadius: number;
  stringLength: number;
  pullCount: number;
  pullAngleDeg: number;
  ballColor: number;
  frameColor: number;
};

const FRAME_POST_HALF_WIDTH = 0.18;
const FRAME_FOOT_HALF_HEIGHT = 0.16;
const FRAME_FOOT_DEPTH = 0.48;
const FRAME_RAIL_OVERLAP = 0.06;
const BALL_GAP_SCALE = 0.05;
const HANGER_SPREAD_SCALE = 0.7;
const BALL_FRICTION = 0.06;
const HANGER_STIFFNESS = 300000.0;

const CRADLE_SPECS: CradleSpec[] = [
  {
    ballCount: 3,
    centerX: -18.0,
    centerZ: 14.0,
    beamY: 12.8,
    ballRadius: 0.74,
    stringLength: 5.0,
    pullCount: 1,
    pullAngleDeg: 48.0,
    ballColor: 0x84c5ff,
    frameColor: 0x6b7f96,
  },
  {
    ballCount: 7,
    centerX: 16.5,
    centerZ: 14.0,
    beamY: 12.1,
    ballRadius: 0.56,
    stringLength: 4.5,
    pullCount: 1,
    pullAngleDeg: 46.0,
    ballColor: 0x82e0a5,
    frameColor: 0x6c8b7a,
  },
  {
    ballCount: 25,
    centerX: 0.0,
    centerZ: 2.2,
    beamY: 11.0,
    ballRadius: 0.34,
    stringLength: 4.1,
    pullCount: 1,
    pullAngleDeg: 42.0,
    ballColor: 0xf6b27a,
    frameColor: 0x90786c,
  },
  {
    ballCount: 100,
    centerX: 0.0,
    centerZ: -14.5,
    beamY: 9.6,
    ballRadius: 0.18,
    stringLength: 3.25,
    pullCount: 1,
    pullAngleDeg: 38.0,
    ballColor: 0xf1a0d7,
    frameColor: 0x8a6c86,
  },
];

function sphereMass(radius: number): number {
  return (4.0 / 3.0) * Math.PI * radius * radius * radius * 14.0;
}

function buildSphereGeometry(radius: number): THREE.SphereGeometry {
  const widthSegments = radius >= 0.5 ? 24 : radius >= 0.3 ? 20 : 16;
  const heightSegments = radius >= 0.5 ? 18 : radius >= 0.3 ? 16 : 12;
  return new THREE.SphereGeometry(radius, widthSegments, heightSegments);
}

function addCradleFrame(
  addStaticBoxWithVisual: AddStaticBoxWithVisual,
  centerX: number,
  centerZ: number,
  beamY: number,
  frameHalfWidth: number,
  hangerSpread: number,
  stringLength: number,
  pullAngle: number,
  ballRadius: number,
  frameColor: number,
): void {
  const maxSwingDx = Math.sin(pullAngle) * stringLength;
  const railZOffset = Math.max(hangerSpread * 1.55, ballRadius * 1.35);
  const postXOffset = frameHalfWidth + maxSwingDx + ballRadius * 1.35;
  const railHalfExtents: [number, number, number] = [
    postXOffset - FRAME_POST_HALF_WIDTH + FRAME_RAIL_OVERLAP,
    Math.max(0.10, ballRadius * 0.16),
    Math.max(0.10, ballRadius * 0.16),
  ];
  const sidePostHalfExtents: [number, number, number] = [
    FRAME_POST_HALF_WIDTH,
    beamY * 0.5,
    Math.max(0.10, ballRadius * 0.16),
  ];
  const footHalfExtents: [number, number, number] = [
    ballRadius * 1.05,
    FRAME_FOOT_HALF_HEIGHT,
    FRAME_FOOT_DEPTH,
  ];

  addStaticBoxWithVisual(
    [centerX, beamY, centerZ - railZOffset],
    railHalfExtents,
    { color: frameColor },
  );
  addStaticBoxWithVisual(
    [centerX, beamY, centerZ + railZOffset],
    railHalfExtents,
    { color: frameColor },
  );
  addStaticBoxWithVisual(
    [centerX - postXOffset, beamY * 0.5, centerZ - railZOffset],
    sidePostHalfExtents,
    { color: frameColor },
  );
  addStaticBoxWithVisual(
    [centerX - postXOffset, beamY * 0.5, centerZ + railZOffset],
    sidePostHalfExtents,
    { color: frameColor },
  );
  addStaticBoxWithVisual(
    [centerX + postXOffset, beamY * 0.5, centerZ - railZOffset],
    sidePostHalfExtents,
    { color: frameColor },
  );
  addStaticBoxWithVisual(
    [centerX + postXOffset, beamY * 0.5, centerZ + railZOffset],
    sidePostHalfExtents,
    { color: frameColor },
  );
  addStaticBoxWithVisual(
    [centerX - postXOffset, footHalfExtents[1], centerZ - railZOffset],
    footHalfExtents,
    { color: frameColor },
  );
  addStaticBoxWithVisual(
    [centerX - postXOffset, footHalfExtents[1], centerZ + railZOffset],
    footHalfExtents,
    { color: frameColor },
  );
  addStaticBoxWithVisual(
    [centerX + postXOffset, footHalfExtents[1], centerZ - railZOffset],
    footHalfExtents,
    { color: frameColor },
  );
  addStaticBoxWithVisual(
    [centerX + postXOffset, footHalfExtents[1], centerZ + railZOffset],
    footHalfExtents,
    { color: frameColor },
  );
}

export function buildNewtonsCradleDemo(args: {
  scene: THREE.Object3D;
  physics: PhysicsEngine;
  addStaticBoxWithVisual: AddStaticBoxWithVisual;
}): NewtonsCradleDemoResult {
  const { scene, physics, addStaticBoxWithVisual } = args;
  const trackedVisualSets: TrackedBodyVisualSet[] = [];
  const trackedSpringVisualSets: TrackedSpringVisualSet[] = [];

  for (const spec of CRADLE_SPECS) {
    const gap = spec.ballRadius * BALL_GAP_SCALE;
    const pitch = spec.ballRadius * 2.0 + gap;
    const frameHalfWidth = pitch * (spec.ballCount - 1) * 0.5 + spec.ballRadius;
    const hangerSpread = spec.ballRadius * HANGER_SPREAD_SCALE;
    const ballStartX = spec.centerX - pitch * (spec.ballCount - 1) * 0.5;
    const pullAngle = THREE.MathUtils.degToRad(spec.pullAngleDeg);

    addCradleFrame(
      addStaticBoxWithVisual,
      spec.centerX,
      spec.centerZ,
      spec.beamY,
      frameHalfWidth,
      hangerSpread,
      spec.stringLength,
      pullAngle,
      spec.ballRadius,
      spec.frameColor,
    );

    const ballVisuals = createTrackedBodyVisualSet(scene, physics, {
      capacity: spec.ballCount,
      geometry: buildSphereGeometry(spec.ballRadius),
      color: spec.ballColor,
      roughness: 0.24,
      metalness: 0.72,
      outlineScale: 1.01,
      showOutline: false,
    });
    trackedVisualSets.push(ballVisuals);

    const springVisuals = createTrackedSpringVisualSet(scene, {
      capacity: spec.ballCount * 2,
      color: 0xe5edf6,
      radius: Math.max(0.014, spec.ballRadius * 0.06),
    });
    trackedSpringVisualSets.push(springVisuals);

    for (let i = 0; i < spec.ballCount; i++) {
      const restX = ballStartX + pitch * i;
      const pulled = i < spec.pullCount;
      const dx = pulled ? -Math.sin(pullAngle) * spec.stringLength : 0.0;
      const dy = pulled ? spec.stringLength * (1.0 - Math.cos(pullAngle)) : 0.0;
      const ballPosition: [number, number, number] = [
        restX + dx,
        spec.beamY - spec.stringLength + dy,
        spec.centerZ,
      ];
      const ballBody = physics.addBody({
        position: ballPosition,
        shapeType: 'sphere',
        radius: spec.ballRadius,
        mass: sphereMass(spec.ballRadius),
        friction: BALL_FRICTION,
      });
      ballVisuals.addBody(ballBody);

      for (const side of [-1, 1] as const) {
        const spring = physics.addSpring(
          null,
          ballBody,
          [restX, spec.beamY, spec.centerZ + side * hangerSpread],
          [0.0, 0.0, side * hangerSpread],
          HANGER_STIFFNESS,
          spec.stringLength,
        );
        springVisuals.addSpring(spring);
      }
    }
  }

  return {
    trackedVisualSets,
    trackedSpringVisualSets,
  };
}
