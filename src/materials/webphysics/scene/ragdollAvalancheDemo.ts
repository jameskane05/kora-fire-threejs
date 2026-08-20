import * as THREE from 'three';
import { PhysicsEngine } from '../physics/PhysicsEngine';
import { AVBD_FRICTION_STATIC } from '../physics/avbdParams';
import type { TrackedSpringVisualSet } from './trackedSpringVisuals';
import { createRagdollFactory } from './ragdollFactory';
import type { AddStaticBoxWithVisual } from './springClothPatch';

export type RagdollAvalancheDemoResult = {
  trackedVisualSets: ReturnType<typeof createRagdollFactory>['trackedVisualSets'];
  trackedSpringVisualSets: TrackedSpringVisualSet[];
};

const COLLISION_GROUP_WORLD = 0x01;
const COLLISION_GROUP_RAGDOLL = 0x04;
const COLLISION_GROUP_OBSTACLE = 0x08;

// Doll-vs-static friction is 0.75 * sqrt(dollF * rampF); dolls are 0.62, so the ramp must be
// near-frictionless for them to slide from the 14.5-degree spawn segment unaided (icy ramp:
// effective mu ~0.13, holds only below ~7.5 degrees).
const RAMP_FRICTION = 0.05;
const RAGDOLL_SCALE = 1.03;
const SPAWN_COLS = 10;
const SPAWN_ROWS = 13;
const RAGDOLL_COUNT = SPAWN_COLS * SPAWN_ROWS;

const RAMP_START_X = -52.0;
const RAMP_START_Y = 72.0;
const RAMP_HALF_WIDTH = 28.0;
const RAMP_HALF_THICKNESS = 2.0;
const LEFT_TRACK_Z = -15.0;
const MIDDLE_TRACK_Z = 0.0;
const LANDING_RAMP_HORIZONTAL_RUN = 24.0;
const LANDING_RAMP_HALF_HEIGHT = 1.1;
const LANDING_RAMP_HALF_WIDTH = RAMP_HALF_WIDTH + 3.0;
const LANDING_RAMP_ANGLE = 0.31;
const REDIRECTOR_HALF_EXTENTS: [number, number, number] = [2.1, 0.42, 7.5];
const MINI_JUMP_HALF_EXTENTS: [number, number, number] = [1.6, 0.34, 3.2];
const MIDDLE_DEFLECTOR_HALF_EXTENTS: [number, number, number] = [1.35, 0.92, 8.4];
const MIDDLE_KICKER_HALF_EXTENTS: [number, number, number] = [1.25, 0.34, 4.2];

type RampSegmentSpec = {
  run: number;
  drop: number;
  color: number;
};

type RampSegment = RampSegmentSpec & {
  startX: number;
  endX: number;
  startY: number;
  endY: number;
  angle: number;
  slopeLength: number;
};

const RAMP_SEGMENT_SPECS: RampSegmentSpec[] = [
  { run: 34.0, drop: 8.8, color: 0x586370 },
  { run: 15.0, drop: 12.8, color: 0x505b67 },
  { run: 14.0, drop: 8.0, color: 0x5b6674 },
  { run: 18.0, drop: 13.0, color: 0x51606b },
  { run: 15.0, drop: 7.5, color: 0x5c6877 },
  { run: 17.0, drop: 12.5, color: 0x53606d },
  { run: 20.0, drop: 6.5, color: 0x5f6d7c },
];

function hash01(seed: number): number {
  const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453123;
  return x - Math.floor(x);
}

function quaternionFromEuler(x: number, y: number, z: number): [number, number, number, number] {
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(x, y, z, 'XYZ'));
  return [q.x, q.y, q.z, q.w];
}

function quaternionFromBasis(
  xAxis: THREE.Vector3,
  yAxis: THREE.Vector3,
  zAxis: THREE.Vector3,
): [number, number, number, number] {
  const basis = new THREE.Matrix4().makeBasis(
    xAxis.clone().normalize(),
    yAxis.clone().normalize(),
    zAxis.clone().normalize(),
  );
  const q = new THREE.Quaternion().setFromRotationMatrix(basis);
  return [q.x, q.y, q.z, q.w];
}

function multiplyQuaternions(
  a: [number, number, number, number],
  b: [number, number, number, number],
): [number, number, number, number] {
  const qa = new THREE.Quaternion(a[0], a[1], a[2], a[3]);
  const qb = new THREE.Quaternion(b[0], b[1], b[2], b[3]);
  qa.multiply(qb);
  return [qa.x, qa.y, qa.z, qa.w];
}

function rotateOffset(
  offset: [number, number, number],
  quaternion: [number, number, number, number],
): [number, number, number] {
  const v = new THREE.Vector3(offset[0], offset[1], offset[2]);
  v.applyQuaternion(new THREE.Quaternion(quaternion[0], quaternion[1], quaternion[2], quaternion[3]));
  return [v.x, v.y, v.z];
}

function buildRampSegments(): RampSegment[] {
  const segments: RampSegment[] = [];
  let startX = RAMP_START_X;
  let startY = RAMP_START_Y;
  for (const spec of RAMP_SEGMENT_SPECS) {
    const endX = startX + spec.run;
    const endY = startY - spec.drop;
    segments.push({
      ...spec,
      startX,
      endX,
      startY,
      endY,
      angle: Math.atan2(spec.drop, spec.run),
      slopeLength: Math.hypot(spec.run, spec.drop),
    });
    startX = endX;
    startY = endY;
  }
  return segments;
}

function sampleRampSurfaceY(segments: RampSegment[], x: number): number {
  const first = segments[0];
  if (x <= first.startX) return first.startY;
  for (const segment of segments) {
    if (x <= segment.endX) {
      const t = (x - segment.startX) / Math.max(segment.run, 1e-6);
      return segment.startY + (segment.endY - segment.startY) * t;
    }
  }
  return segments[segments.length - 1].endY;
}

export function buildRagdollAvalancheDemo(args: {
  scene: THREE.Object3D;
  physics: PhysicsEngine;
  addStaticBoxWithVisual: AddStaticBoxWithVisual;
}): RagdollAvalancheDemoResult {
  const { scene, physics, addStaticBoxWithVisual } = args;
  const trackedSpringVisualSets: TrackedSpringVisualSet[] = [];

  const ragdollFactory = createRagdollFactory({
    scene,
    physics,
    totalRagdolls: RAGDOLL_COUNT,
    collisionGroup: COLLISION_GROUP_RAGDOLL,
    collisionMask: COLLISION_GROUP_WORLD | COLLISION_GROUP_RAGDOLL | COLLISION_GROUP_OBSTACLE,
    colorBucketCount: 32,
    scale: RAGDOLL_SCALE,
    defaultPose: 'standing',
  });

  const rampSegments = buildRampSegments();
  const totalRampRun = rampSegments[rampSegments.length - 1].endX - rampSegments[0].startX;
  const rampCenterX = (rampSegments[0].startX + rampSegments[rampSegments.length - 1].endX) * 0.5;
  const topHeight = rampSegments[0].startY;
  const bottomY = rampSegments[rampSegments.length - 1].endY;

  for (const segment of rampSegments) {
    const segmentQuaternion = quaternionFromEuler(0.0, 0.0, -segment.angle);
    const topMidpoint: [number, number, number] = [
      segment.startX + segment.run * 0.5,
      segment.startY - segment.drop * 0.5,
      0.0,
    ];
    const topToCenterOffset = rotateOffset([0.0, RAMP_HALF_THICKNESS, 0.0], segmentQuaternion);
    addStaticBoxWithVisual(
      [
        topMidpoint[0] - topToCenterOffset[0],
        topMidpoint[1] - topToCenterOffset[1],
        0.0,
      ],
      [segment.slopeLength * 0.5, RAMP_HALF_THICKNESS, RAMP_HALF_WIDTH],
      {
        quaternion: segmentQuaternion,
        color: segment.color,
        friction: RAMP_FRICTION,
      },
    );
  }

  addStaticBoxWithVisual(
    [rampSegments[0].startX - 0.9, topHeight * 0.5 + 2.0, 0.0],
    [0.65, topHeight * 0.5 + 2.4, RAMP_HALF_WIDTH + 1.2],
    { color: 0x55606d },
  );

  const lastRampSegment = rampSegments[rampSegments.length - 1];
  const landingStartX = lastRampSegment.endX;
  const landingStartY = lastRampSegment.endY;
  const landingRun = LANDING_RAMP_HORIZONTAL_RUN;
  const landingRise = Math.tan(LANDING_RAMP_ANGLE) * landingRun;
  const landingSlopeLength = Math.hypot(landingRun, landingRise);
  const landingTopMidpoint: [number, number, number] = [
    landingStartX + landingRun * 0.5,
    landingStartY + landingRise * 0.5,
    0.0,
  ];
  const landingQuaternion = quaternionFromEuler(0.0, 0.0, LANDING_RAMP_ANGLE);
  const landingTopToCenterOffset = rotateOffset([0.0, LANDING_RAMP_HALF_HEIGHT, 0.0], landingQuaternion);
  addStaticBoxWithVisual(
    [
      landingTopMidpoint[0] - landingTopToCenterOffset[0],
      landingTopMidpoint[1] - landingTopToCenterOffset[1],
      0.0,
    ],
    [landingSlopeLength * 0.5, LANDING_RAMP_HALF_HEIGHT, LANDING_RAMP_HALF_WIDTH],
    {
      quaternion: landingQuaternion,
      color: 0x738290,
      friction: RAMP_FRICTION,
    },
  );

  for (let i = 1; i < rampSegments.length - 1; i++) {
    const segment = rampSegments[i];
    const redirectorX = segment.startX + segment.run * (i % 2 === 0 ? 0.34 : 0.62);
    const redirectorY = sampleRampSurfaceY(rampSegments, redirectorX);
    const redirectorZ = LEFT_TRACK_Z + (i % 2 === 0 ? 3.4 : -3.2);
    const redirectorYaw = i % 2 === 0 ? 0.48 : -0.48;
    const redirectorRoll = i % 2 === 0 ? 0.1 : -0.1;
    addStaticBoxWithVisual(
      [redirectorX, redirectorY + 0.42, redirectorZ],
      REDIRECTOR_HALF_EXTENTS,
      {
        quaternion: quaternionFromEuler(0.0, redirectorYaw, redirectorRoll),
        color: 0x7a5d52,
        friction: RAMP_FRICTION,
      },
    );

    const leftChannelRedirectorX = segment.startX + segment.run * (i % 2 === 0 ? 0.7 : 0.28);
    const leftChannelRedirectorY = sampleRampSurfaceY(rampSegments, leftChannelRedirectorX);
    addStaticBoxWithVisual(
      [leftChannelRedirectorX, leftChannelRedirectorY + 0.38, LEFT_TRACK_Z - (i % 2 === 0 ? 1.6 : -1.8)],
      [1.5, 0.38, 5.8],
      {
        quaternion: quaternionFromEuler(0.0, i % 2 === 0 ? -0.38 : 0.38, i % 2 === 0 ? -0.08 : 0.08),
        color: 0x71594a,
        friction: RAMP_FRICTION,
      },
    );

    const kickerAX = segment.startX + segment.run * (i % 2 === 0 ? 0.24 : 0.76);
    const kickerAY = sampleRampSurfaceY(rampSegments, kickerAX);
    addStaticBoxWithVisual(
      [kickerAX, kickerAY + 0.34, LEFT_TRACK_Z + (i % 2 === 0 ? 5.2 : -5.0)],
      MINI_JUMP_HALF_EXTENTS,
      {
        quaternion: quaternionFromEuler(0.0, i % 2 === 0 ? 0.18 : -0.18, i % 2 === 0 ? -0.24 : 0.24),
        color: 0x6c5a4d,
        friction: RAMP_FRICTION,
      },
    );

    const kickerBX = segment.startX + segment.run * (i % 2 === 0 ? 0.78 : 0.22);
    const kickerBY = sampleRampSurfaceY(rampSegments, kickerBX);
    addStaticBoxWithVisual(
      [kickerBX, kickerBY + 0.34, LEFT_TRACK_Z + (i % 2 === 0 ? -0.4 : 0.6)],
      [1.25, 0.3, 2.4],
      {
        quaternion: quaternionFromEuler(0.0, i % 2 === 0 ? -0.12 : 0.12, i % 2 === 0 ? 0.22 : -0.22),
        color: 0x806654,
        friction: RAMP_FRICTION,
      },
    );
    const middleDeflectorX = segment.startX + segment.run * (i % 2 === 0 ? 0.48 : 0.56);
    const middleDeflectorY = sampleRampSurfaceY(rampSegments, middleDeflectorX);
    const middleDeflectorZ = MIDDLE_TRACK_Z + (i % 2 === 0 ? 3.9 : -3.9);
    const rampTangent = new THREE.Vector3(segment.run, -segment.drop, 0.0).normalize();
    const rampNormal = new THREE.Vector3(Math.sin(segment.angle), Math.cos(segment.angle), 0.0).normalize();
    const rampSide = new THREE.Vector3(0.0, 0.0, 1.0);
    const rampFrameQuaternion = quaternionFromBasis(rampTangent, rampNormal, rampSide);
    const middleDeflectorYaw = quaternionFromEuler(
      0.0,
      i % 2 === 0 ? 0.56 : -0.56,
      0.0,
    );
    const middleDeflectorFinalQuaternion = multiplyQuaternions(rampFrameQuaternion, middleDeflectorYaw);
    const middleDeflectorOffset = rotateOffset([0.0, MIDDLE_DEFLECTOR_HALF_EXTENTS[1], 0.0], middleDeflectorFinalQuaternion);
    addStaticBoxWithVisual(
      [
        middleDeflectorX + middleDeflectorOffset[0],
        middleDeflectorY + middleDeflectorOffset[1],
        middleDeflectorZ + middleDeflectorOffset[2],
      ],
      MIDDLE_DEFLECTOR_HALF_EXTENTS,
      {
        quaternion: middleDeflectorFinalQuaternion,
        color: 0x8a6c58,
        friction: RAMP_FRICTION,
      },
    );

    const middleKickerX = segment.startX + segment.run * (i % 2 === 0 ? 0.76 : 0.26);
    const middleKickerY = sampleRampSurfaceY(rampSegments, middleKickerX);
    const middleKickerYaw = quaternionFromEuler(
      0.0,
      i % 2 === 0 ? -0.22 : 0.22,
      0.0,
    );
    const middleKickerFinalQuaternion = multiplyQuaternions(rampFrameQuaternion, middleKickerYaw);
    const middleKickerOffset = rotateOffset([0.0, MIDDLE_KICKER_HALF_EXTENTS[1], 0.0], middleKickerFinalQuaternion);
    addStaticBoxWithVisual(
      [
        middleKickerX + middleKickerOffset[0],
        middleKickerY + middleKickerOffset[1],
        MIDDLE_TRACK_Z + (i % 2 === 0 ? -6.2 : 6.2) + middleKickerOffset[2],
      ],
      MIDDLE_KICKER_HALF_EXTENTS,
      {
        quaternion: middleKickerFinalQuaternion,
        color: 0x7d644f,
        friction: RAMP_FRICTION,
      },
    );
  }

  // Spacing tracks RAGDOLL_SCALE (tuned at 0.65) so bigger dolls don't spawn interpenetrating.
  const spawnScale = RAGDOLL_SCALE / 0.65;
  const spawnSpacingX = 1.35 * spawnScale;
  const spawnSpacingZ = 1.28 * spawnScale;
  const spawnStartX = rampSegments[0].startX + 2.4;
  const spawnStartZ = -((SPAWN_COLS - 1) * spawnSpacingZ) * 0.5;
  const baseSpawnOffsetY = 1.18 * spawnScale;

  let index = 0;
  for (let row = 0; row < SPAWN_ROWS; row++) {
    for (let col = 0; col < SPAWN_COLS; col++) {
      const n0 = hash01(index * 13.1 + 0.3);
      const n1 = hash01(index * 17.7 + 1.9);
      const n2 = hash01(index * 23.3 + 5.1);
      const x = spawnStartX + row * spawnSpacingX + (n0 - 0.5) * 0.16;
      const surfaceY = sampleRampSurfaceY(rampSegments, x);
      const y = surfaceY + baseSpawnOffsetY + n1 * 0.16;
      const z = spawnStartZ + col * spawnSpacingZ + (n2 - 0.5) * 0.14;
      const yaw = (hash01(index * 29.9 + 7.0) - 0.5) * 0.8;
      const pitch = (hash01(index * 31.1 + 9.0) - 0.5) * 0.16;
      const roll = (hash01(index * 37.7 + 11.0) - 0.5) * 0.1;
      const vx = 0.7 + hash01(index * 41.3 + 3.0) * 0.35;
      const vz = (hash01(index * 43.7 + 13.0) - 0.5) * 0.18;
      ragdollFactory.addRagdoll({
        index,
        rootPosition: [x, y, z],
        rootQuaternion: quaternionFromEuler(pitch, yaw, roll),
        linearVelocity: [vx, 0.0, vz],
      });
      index++;
    }
  }

  return {
    trackedVisualSets: ragdollFactory.trackedVisualSets,
    trackedSpringVisualSets,
  };
}
