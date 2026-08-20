import * as THREE from 'three';
import { PhysicsEngine } from '../physics/PhysicsEngine';
import { AVBD_FRICTION_STATIC } from '../physics/avbdParams';
import {
  createTrackedBodyVisualSet,
  type TrackedBodyVisualSet,
} from './trackedBodyVisuals';
import type { TrackedSpringVisualSet } from './trackedSpringVisuals';
import { createRagdollFactory } from './ragdollFactory';
import type { AddStaticBoxWithVisual } from './springClothPatch';

type AddStaticCylinderWithVisual = (
  position: [number, number, number],
  radius: number,
  halfHeight: number,
  options?: {
    color?: number;
  },
) => void;

export type RagdollCarouselDemoResult = {
  trackedVisualSets: TrackedBodyVisualSet[];
  trackedSpringVisualSets: TrackedSpringVisualSet[];
  diagnostics: {
    joints: Array<{
      joint: number;
      label: string;
      bodyA: number | null;
      bodyB: number;
      anchorA: [number, number, number];
      anchorB: [number, number, number];
    }>;
  };
  update: (dt: number) => void;
  getStatusText: () => string | null;
};

const COLLISION_GROUP_WORLD = 0x01;
const COLLISION_GROUP_RAGDOLL = 0x04;
const COLLISION_GROUP_RIDE = 0x08;
const BUILD_CAROUSEL_RIDE = true;

const LEVEL_BASE_Y = 14.0;
const LEVEL_GAP = 3.7;

const LEVELS = [
  { y: LEVEL_BASE_Y - LEVEL_GAP * 2, innerRadius: 0.72, armLength: 7.2, seats: 16 },
  { y: LEVEL_BASE_Y - LEVEL_GAP * 1, innerRadius: 0.72, armLength: 6.5, seats: 14 },
  { y: LEVEL_BASE_Y + LEVEL_GAP * 0, innerRadius: 0.72, armLength: 5.8, seats: 12 },
  { y: LEVEL_BASE_Y + LEVEL_GAP * 1, innerRadius: 0.72, armLength: 5.1, seats: 10 },
  { y: LEVEL_BASE_Y + LEVEL_GAP * 2, innerRadius: 0.72, armLength: 4.4, seats: 8 },
  { y: LEVEL_BASE_Y + LEVEL_GAP * 3, innerRadius: 0.72, armLength: 3.8, seats: 6 },
] as const;

const TOTAL_SEATS = LEVELS.reduce((sum, level) => sum + level.seats, 0);

const HUB_HALF_EXTENTS: [number, number, number] = [1.16, 0.11, 1.16];
const BEAM_THICKNESS_HALF_EXTENTS: [number, number, number] = [1.0, 0.1, 0.16];
const HANGER_BAR_HALF_EXTENTS: [number, number, number] = [0.28, 0.05, 0.12];
const LINK_HALF_EXTENTS: [number, number, number] = [0.05, 0.24, 0.05];
const SEAT_BASE_HALF_EXTENTS: [number, number, number] = [0.52, 0.08, 0.42];
const SEAT_BACK_HALF_EXTENTS: [number, number, number] = [0.52, 0.44, 0.06];
const SEAT_SIDE_HALF_EXTENTS: [number, number, number] = [0.05, 0.42, 0.30];

const CHAIN_LINK_COUNT = 4;
const CHAIN_STIFFNESS = Number.POSITIVE_INFINITY;
const CHAIN_LATERAL_OFFSET = 0.36;
const TOP_ANCHOR_LATERAL_OFFSET = 0.12;
const CHAIN_LENGTH = CHAIN_LINK_COUNT * LINK_HALF_EXTENTS[1] * 2.0;
const SEAT_BACK_RISE = SEAT_BASE_HALF_EXTENTS[1] + SEAT_BACK_HALF_EXTENTS[1];
const SEAT_BACK_INSET = 0.36;
const SEAT_SIDE_RISE = SEAT_BASE_HALF_EXTENTS[1] + SEAT_SIDE_HALF_EXTENTS[1];
const REAR_HANGER_TANGENT_OFFSET = 0.24;
const FRONT_HANGER_TANGENT_OFFSET = 0.28;
const CHAIR_TOP_INSET = 0.02;
const BEAM_INNER_OVERLAP = 0.34;
const BEAM_OUTER_OVERHANG = 0.26;
const CHAIN_LINK_MASS = 0.22;
const SEAT_BASE_MASS = 3.5;
const SEAT_BACK_MASS = 2.0;
const SEAT_SIDE_MASS = 1.0;
const CAROUSEL_RAGDOLL_SCALE = 0.74;
const LOWER_LEG_HALF_WIDTH = 0.14 * CAROUSEL_RAGDOLL_SCALE;
const RAGDOLL_SEAT_FORWARD_SHIFT = LOWER_LEG_HALF_WIDTH * 2.0 * 1.2;
const MAX_SPIN_SPEED = 1.9;
const INITIAL_SPIN_SPEED = 0.0;
const ACCELERATION_PHASE_SECONDS = 10.0;
const ACCELERATION_EASE_POWER = 2.2;
const BRAKING_PHASE_SECONDS = 1.2;
const STOPPED_PHASE_SECONDS = 3.0;
const CHAIR_SPEED_INCREMENT_KMH = 15.0;

type RotatingBeam = {
  body: number;
  radialOffset: number;
  tangentOffset: number;
  y: number;
  angleOffset: number;
};

type SeatCornerChainSpec = {
  topBody: number;
  topAnchor: [number, number, number];
  body: number;
  localAnchor: [number, number, number];
};

type CarouselBeamLayout = {
  ropeAnchorRadius: number;
  beamHalfExtents: [number, number, number];
  beamCenterRadius: number;
};

function computeSeatDropFromChainGeometry(): number {
  const rearHorizontal = Math.hypot(
    (SEAT_BACK_HALF_EXTENTS[0] - CHAIR_TOP_INSET) - TOP_ANCHOR_LATERAL_OFFSET,
    (-SEAT_BACK_INSET) - (-REAR_HANGER_TANGENT_OFFSET),
  );
  const frontHorizontal = Math.hypot(
    (SEAT_BASE_HALF_EXTENTS[0] - SEAT_SIDE_HALF_EXTENTS[0]) - TOP_ANCHOR_LATERAL_OFFSET,
    (SEAT_SIDE_HALF_EXTENTS[2] - CHAIR_TOP_INSET) - FRONT_HANGER_TANGENT_OFFSET,
  );
  const rearVertical = Math.sqrt(Math.max(0.0, CHAIN_LENGTH * CHAIN_LENGTH - rearHorizontal * rearHorizontal));
  const frontVertical = Math.sqrt(Math.max(0.0, CHAIN_LENGTH * CHAIN_LENGTH - frontHorizontal * frontHorizontal));
  const rearSeatDrop = rearVertical - (-HANGER_BAR_HALF_EXTENTS[1]) + (SEAT_BACK_RISE + SEAT_BACK_HALF_EXTENTS[1] - CHAIR_TOP_INSET);
  const frontSeatDrop = frontVertical - (-HANGER_BAR_HALF_EXTENTS[1]) + (SEAT_SIDE_RISE + SEAT_SIDE_HALF_EXTENTS[1] - CHAIR_TOP_INSET);
  return Math.max(rearSeatDrop, frontSeatDrop) + 0.02;
}

function computeBeamLayout(level: (typeof LEVELS)[number]): CarouselBeamLayout {
  const ropeAnchorRadius = level.innerRadius + level.armLength - 0.06;
  const beamInnerRadius = HUB_HALF_EXTENTS[0] - BEAM_INNER_OVERLAP;
  const beamOuterRadius = ropeAnchorRadius + BEAM_OUTER_OVERHANG;
  return {
    ropeAnchorRadius,
    beamHalfExtents: [
      (beamOuterRadius - beamInnerRadius) * 0.5,
      BEAM_THICKNESS_HALF_EXTENTS[1],
      BEAM_THICKNESS_HALF_EXTENTS[2],
    ],
    beamCenterRadius: (beamInnerRadius + beamOuterRadius) * 0.5,
  };
}

function quaternionFromBasis(
  xAxis: THREE.Vector3,
  yAxis: THREE.Vector3,
  zAxis: THREE.Vector3,
): [number, number, number, number] {
  const matrix = new THREE.Matrix4().makeBasis(
    xAxis.clone().normalize(),
    yAxis.clone().normalize(),
    zAxis.clone().normalize(),
  );
  const quaternion = new THREE.Quaternion().setFromRotationMatrix(matrix).normalize();
  return [quaternion.x, quaternion.y, quaternion.z, quaternion.w];
}

export function buildRagdollCarouselDemo(args: {
  scene: THREE.Object3D;
  physics: PhysicsEngine;
  addStaticBoxWithVisual: AddStaticBoxWithVisual;
  addStaticCylinderWithVisual: AddStaticCylinderWithVisual;
}): RagdollCarouselDemoResult {
  const { scene, physics, addStaticBoxWithVisual, addStaticCylinderWithVisual } = args;
  const rideVisualRoot = new THREE.Group();
  rideVisualRoot.visible = BUILD_CAROUSEL_RIDE;
  scene.add(rideVisualRoot);

  const trackedVisualSets: TrackedBodyVisualSet[] = [];
  const trackedSpringVisualSets: TrackedSpringVisualSet[] = [];
  const diagnosticJoints: RagdollCarouselDemoResult['diagnostics']['joints'] = [];
  const chainVisuals = BUILD_CAROUSEL_RIDE ? createTrackedBodyVisualSet(rideVisualRoot, physics, {
    capacity: TOTAL_SEATS * CHAIN_LINK_COUNT * 4,
    halfExtents: LINK_HALF_EXTENTS,
    color: 0xc9d2dd,
    roughness: 0.46,
    metalness: 0.3,
  }) : null;
  const seatBaseVisuals = BUILD_CAROUSEL_RIDE ? createTrackedBodyVisualSet(rideVisualRoot, physics, {
    capacity: TOTAL_SEATS,
    halfExtents: SEAT_BASE_HALF_EXTENTS,
    color: 0x2f7f9d,
    roughness: 0.78,
    metalness: 0.06,
  }) : null;
  const seatBackVisuals = BUILD_CAROUSEL_RIDE ? createTrackedBodyVisualSet(rideVisualRoot, physics, {
    capacity: TOTAL_SEATS,
    halfExtents: SEAT_BACK_HALF_EXTENTS,
    color: 0x3e9ec1,
    roughness: 0.74,
    metalness: 0.06,
  }) : null;
  const seatSideVisuals = BUILD_CAROUSEL_RIDE ? createTrackedBodyVisualSet(rideVisualRoot, physics, {
    capacity: TOTAL_SEATS * 2,
    halfExtents: SEAT_SIDE_HALF_EXTENTS,
    color: 0x3e9ec1,
    roughness: 0.74,
    metalness: 0.06,
  }) : null;
  const hangerBarVisuals = BUILD_CAROUSEL_RIDE ? createTrackedBodyVisualSet(rideVisualRoot, physics, {
    capacity: TOTAL_SEATS * 2,
    halfExtents: HANGER_BAR_HALF_EXTENTS,
    color: 0xd1b65a,
    roughness: 0.52,
    metalness: 0.14,
  }) : null;
  if (chainVisuals && seatBaseVisuals && seatBackVisuals && seatSideVisuals && hangerBarVisuals) {
    trackedVisualSets.push(
      chainVisuals,
      hangerBarVisuals,
      seatBaseVisuals,
      seatBackVisuals,
      seatSideVisuals,
    );
  }

  const ragdollFactory = createRagdollFactory({
    scene,
    physics,
    totalRagdolls: TOTAL_SEATS,
    collisionGroup: COLLISION_GROUP_RAGDOLL,
    collisionMask: COLLISION_GROUP_WORLD | COLLISION_GROUP_RAGDOLL | COLLISION_GROUP_RIDE,
    colorBucketCount: 18,
    scale: CAROUSEL_RAGDOLL_SCALE,
    defaultPose: 'seated',
  });
  trackedVisualSets.push(...ragdollFactory.trackedVisualSets);

  const addRideBody = (
    position: [number, number, number],
    halfExtents: [number, number, number],
    visuals: TrackedBodyVisualSet,
    options: {
      mass: number;
      quaternion?: [number, number, number, number];
      friction?: number;
      lockRotation?: boolean;
    },
  ): number => {
    const body = physics.addBody({
      position,
      halfExtents,
      quaternion: options.quaternion,
      mass: options.mass,
      friction: options.friction ?? AVBD_FRICTION_STATIC,
      collisionGroup: COLLISION_GROUP_RIDE,
      collisionMask: COLLISION_GROUP_WORLD | COLLISION_GROUP_RAGDOLL,
      lockRotation: options.lockRotation,
    });
    visuals.addBody(body);
    return body;
  };

  if (BUILD_CAROUSEL_RIDE) {
    addStaticBoxWithVisual([0.0, 12.9, 0.0], [0.65, 12.9, 0.65], {
      color: 0x6f7b87,
    });
    addStaticBoxWithVisual([0.0, 27.0, 0.0], [2.2, 0.4, 2.2], {
      color: 0x8d99a4,
    });
    addStaticBoxWithVisual([0.0, 0.9, 0.0], [3.4, 0.9, 3.4], {
      color: 0x5b6672,
    });

    for (const level of LEVELS) {
      addStaticCylinderWithVisual([0.0, level.y, 0.0], HUB_HALF_EXTENTS[0], HUB_HALF_EXTENTS[1], {
        color: 0xe6c76f,
      });
    }
  }

  const rotatingBeams: RotatingBeam[] = [];
  let ragdollIndex = 0;

  for (const level of LEVELS) {
    const beamLayout = computeBeamLayout(level);
    const beamVisuals = BUILD_CAROUSEL_RIDE ? createTrackedBodyVisualSet(rideVisualRoot, physics, {
      capacity: level.seats,
      halfExtents: beamLayout.beamHalfExtents,
      color: 0xe6c76f,
      roughness: 0.54,
      metalness: 0.18,
    }) : null;
    if (beamVisuals) trackedVisualSets.push(beamVisuals);
    const seatAngleStep = (Math.PI * 2.0) / level.seats;
    const { ropeAnchorRadius, beamHalfExtents, beamCenterRadius } = beamLayout;

    for (let seatIndex = 0; seatIndex < level.seats; seatIndex++) {
      const angle = seatIndex * seatAngleStep;
      const radial = new THREE.Vector3(Math.cos(angle), 0.0, Math.sin(angle));
      const tangent = new THREE.Vector3(-Math.sin(angle), 0.0, Math.cos(angle));
      const up = new THREE.Vector3(0.0, 1.0, 0.0);

      const beamAnchorWorld = new THREE.Vector3(
        radial.x * ropeAnchorRadius,
        level.y - beamHalfExtents[1],
        radial.z * ropeAnchorRadius,
      );
      const seatDrop = computeSeatDropFromChainGeometry();
      const seatCenter = beamAnchorWorld.clone().addScaledVector(up, -seatDrop);
      const seatQuaternion = quaternionFromBasis(radial, up, tangent);
      if (BUILD_CAROUSEL_RIDE) {
        const beamQuaternion = quaternionFromBasis(radial, up, tangent);
        const beamCenter = new THREE.Vector3(
          radial.x * beamCenterRadius,
          level.y,
          radial.z * beamCenterRadius,
        );
        const beamBody = addRideBody(
          [beamCenter.x, level.y, beamCenter.z],
          beamHalfExtents,
          beamVisuals!,
          { mass: 0.0, quaternion: beamQuaternion, lockRotation: true },
        );
        rotatingBeams.push({
          body: beamBody,
          radialOffset: beamCenterRadius,
          tangentOffset: 0.0,
          y: level.y,
          angleOffset: angle,
        });

        const seatBase = addRideBody(
          [seatCenter.x, seatCenter.y, seatCenter.z],
          SEAT_BASE_HALF_EXTENTS,
          seatBaseVisuals!,
          {
            mass: SEAT_BASE_MASS,
            quaternion: seatQuaternion,
            friction: 0.74,
          },
        );

        const seatBackCenter = seatCenter.clone()
          .addScaledVector(up, SEAT_BACK_RISE)
          .addScaledVector(tangent, -SEAT_BACK_INSET);
        const seatBack = addRideBody(
          [seatBackCenter.x, seatBackCenter.y, seatBackCenter.z],
          SEAT_BACK_HALF_EXTENTS,
          seatBackVisuals!,
          {
            mass: SEAT_BACK_MASS,
            quaternion: seatQuaternion,
            friction: 0.74,
          },
        );
        physics.addFixedJoint(
          seatBase,
          seatBack,
          [0.0, SEAT_BACK_RISE, -SEAT_BACK_INSET],
          [0.0, 0.0, 0.0],
          Number.POSITIVE_INFINITY,
          true,
        );
        const sideBodies: Record<-1 | 1, number> = { [-1]: -1, [1]: -1 };
        for (const side of [-1, 1] as const) {
          const seatSideCenter = seatCenter.clone()
            .addScaledVector(up, SEAT_SIDE_RISE)
            .addScaledVector(radial, side * (SEAT_BASE_HALF_EXTENTS[0] - SEAT_SIDE_HALF_EXTENTS[0]));
          const seatSide = addRideBody(
            [seatSideCenter.x, seatSideCenter.y, seatSideCenter.z],
            SEAT_SIDE_HALF_EXTENTS,
            seatSideVisuals!,
            {
              mass: SEAT_SIDE_MASS,
              quaternion: seatQuaternion,
              friction: 0.74,
            },
          );
          sideBodies[side] = seatSide;
          physics.addFixedJoint(
            seatBase,
            seatSide,
            [side * (SEAT_BASE_HALF_EXTENTS[0] - SEAT_SIDE_HALF_EXTENTS[0]), SEAT_SIDE_RISE, 0.0],
            [0.0, 0.0, 0.0],
            Number.POSITIVE_INFINITY,
            true,
          );
        }
        const hangerY = level.y - beamHalfExtents[1] - HANGER_BAR_HALF_EXTENTS[1];
        const rearHangerCenter = beamAnchorWorld.clone()
          .setY(hangerY)
          .addScaledVector(tangent, -REAR_HANGER_TANGENT_OFFSET);
        const frontHangerCenter = beamAnchorWorld.clone()
          .setY(hangerY)
          .addScaledVector(tangent, FRONT_HANGER_TANGENT_OFFSET);
        const hangerQuaternion = seatQuaternion;
        const rearHangerBar = addRideBody(
          [rearHangerCenter.x, rearHangerCenter.y, rearHangerCenter.z],
          HANGER_BAR_HALF_EXTENTS,
          hangerBarVisuals!,
          { mass: 0.0, quaternion: hangerQuaternion, lockRotation: true },
        );
        const frontHangerBar = addRideBody(
          [frontHangerCenter.x, frontHangerCenter.y, frontHangerCenter.z],
          HANGER_BAR_HALF_EXTENTS,
          hangerBarVisuals!,
          { mass: 0.0, quaternion: hangerQuaternion, lockRotation: true },
        );
        rotatingBeams.push(
          {
            body: rearHangerBar,
            radialOffset: ropeAnchorRadius,
            tangentOffset: -REAR_HANGER_TANGENT_OFFSET,
            y: hangerY,
            angleOffset: angle,
          },
          {
            body: frontHangerBar,
            radialOffset: ropeAnchorRadius,
            tangentOffset: FRONT_HANGER_TANGENT_OFFSET,
            y: hangerY,
            angleOffset: angle,
          },
        );

        const chainSpecs: SeatCornerChainSpec[] = [
          {
            topBody: rearHangerBar,
            topAnchor: [-TOP_ANCHOR_LATERAL_OFFSET, 0.0, 0.0],
            body: seatBack,
            localAnchor: [
              -(SEAT_BACK_HALF_EXTENTS[0] - CHAIR_TOP_INSET),
              SEAT_BACK_HALF_EXTENTS[1] - CHAIR_TOP_INSET,
              0.0,
            ],
          },
          {
            topBody: rearHangerBar,
            topAnchor: [TOP_ANCHOR_LATERAL_OFFSET, 0.0, 0.0],
            body: seatBack,
            localAnchor: [
              SEAT_BACK_HALF_EXTENTS[0] - CHAIR_TOP_INSET,
              SEAT_BACK_HALF_EXTENTS[1] - CHAIR_TOP_INSET,
              0.0,
            ],
          },
          {
            topBody: frontHangerBar,
            topAnchor: [-TOP_ANCHOR_LATERAL_OFFSET, 0.0, 0.0],
            body: sideBodies[-1],
            localAnchor: [
              0.0,
              SEAT_SIDE_HALF_EXTENTS[1] - CHAIR_TOP_INSET,
              SEAT_SIDE_HALF_EXTENTS[2] - CHAIR_TOP_INSET,
            ],
          },
          {
            topBody: frontHangerBar,
            topAnchor: [TOP_ANCHOR_LATERAL_OFFSET, 0.0, 0.0],
            body: sideBodies[1],
            localAnchor: [
              0.0,
              SEAT_SIDE_HALF_EXTENTS[1] - CHAIR_TOP_INSET,
              SEAT_SIDE_HALF_EXTENTS[2] - CHAIR_TOP_INSET,
            ],
          },
        ];

        for (const chainSpec of chainSpecs) {
          const seatAnchorWorld = new THREE.Vector3(
            seatCenter.x,
            seatCenter.y,
            seatCenter.z,
          );
          if (chainSpec.body === seatBack) {
            seatAnchorWorld.addScaledVector(up, SEAT_BACK_RISE)
              .addScaledVector(tangent, -SEAT_BACK_INSET)
              .addScaledVector(radial, chainSpec.localAnchor[0])
              .addScaledVector(up, chainSpec.localAnchor[1]);
          } else {
            const side = chainSpec.body === sideBodies[-1] ? -1.0 : 1.0;
            seatAnchorWorld.addScaledVector(up, SEAT_SIDE_RISE)
              .addScaledVector(radial, side * (SEAT_BASE_HALF_EXTENTS[0] - SEAT_SIDE_HALF_EXTENTS[0]))
              .addScaledVector(up, chainSpec.localAnchor[1])
              .addScaledVector(tangent, chainSpec.localAnchor[2]);
          }
          const topAnchorWorld = (chainSpec.topBody === rearHangerBar ? rearHangerCenter : frontHangerCenter).clone()
            .addScaledVector(radial, chainSpec.topAnchor[0]);
          const chainDirection = seatAnchorWorld.clone().sub(topAnchorWorld).normalize();
          const chainXAxis = radial.clone().normalize();
          const chainZAxis = chainXAxis.clone().cross(chainDirection).normalize();
          const chainQuaternion = quaternionFromBasis(chainXAxis, chainDirection, chainZAxis);
          let previousBody = chainSpec.topBody;
          let previousAnchor: [number, number, number] = chainSpec.topAnchor;

          for (let linkIndex = 0; linkIndex < CHAIN_LINK_COUNT; linkIndex++) {
            const t = (linkIndex + 0.5) / CHAIN_LINK_COUNT;
            const linkPosition = topAnchorWorld.clone().lerp(seatAnchorWorld, t);
            const linkBody = addRideBody(
              [linkPosition.x, linkPosition.y, linkPosition.z],
              LINK_HALF_EXTENTS,
              chainVisuals!,
              {
                mass: CHAIN_LINK_MASS,
                friction: 0.55,
                quaternion: chainQuaternion,
              },
            );
            const joint = physics.addSphericalJoint(
              previousBody,
              linkBody,
              previousAnchor,
              [0.0, -LINK_HALF_EXTENTS[1], 0.0],
              CHAIN_STIFFNESS,
              true,
            );
            if (linkIndex === 0) {
              diagnosticJoints.push({
                joint,
                label: `L${LEVELS.indexOf(level)}-S${seatIndex}-${chainSpec.topBody === rearHangerBar ? 'rear' : 'front'}-${chainSpec.topAnchor[0] < 0.0 ? 'left' : 'right'}`,
                bodyA: previousBody,
                bodyB: linkBody,
                anchorA: previousAnchor,
                anchorB: [0.0, -LINK_HALF_EXTENTS[1], 0.0],
              });
            }
            previousBody = linkBody;
            previousAnchor = [0.0, LINK_HALF_EXTENTS[1], 0.0];
          }

          physics.addSphericalJoint(
            previousBody,
            chainSpec.body,
            previousAnchor,
            chainSpec.localAnchor,
            CHAIN_STIFFNESS,
            true,
          );
        }
      }

      const ragdollRoot = seatCenter.clone()
        .addScaledVector(up, 0.62)
        .addScaledVector(tangent, -0.2 + RAGDOLL_SEAT_FORWARD_SHIFT);
      ragdollFactory.addRagdoll({
        index: ragdollIndex,
        rootPosition: [ragdollRoot.x, ragdollRoot.y, ragdollRoot.z],
        linearVelocity: [0.0, 0.0, 0.0],
        rootQuaternion: seatQuaternion,
        pose: 'seated',
      });
      ragdollIndex++;
    }
  }

  let spinAngle = 0.0;
  let spinSpeed = INITIAL_SPIN_SPEED;
  let cyclePhase: 'accelerating' | 'braking' | 'stopped' = 'accelerating';
  let cyclePhaseElapsed = 0.0;
  const maxChairRadius = Math.max(...LEVELS.map((level) => level.innerRadius + level.armLength - 0.06));
  const cyclePeakSpinSpeedIncrement = CHAIR_SPEED_INCREMENT_KMH / (maxChairRadius * 3.6);
  let cyclePeakSpinSpeed = Math.min(MAX_SPIN_SPEED, cyclePeakSpinSpeedIncrement);

  return {
    trackedVisualSets,
    trackedSpringVisualSets,
    diagnostics: {
      joints: diagnosticJoints,
    },
    getStatusText(): string | null {
      const chairSpeedKmh = maxChairRadius * spinSpeed * 3.6;
      const peakChairSpeedKmh = maxChairRadius * cyclePeakSpinSpeed * 3.6;
      if (cyclePhase === 'accelerating') {
        const remaining = Math.max(1, Math.ceil(ACCELERATION_PHASE_SECONDS - cyclePhaseElapsed));
        return `Carousel: chair going ${chairSpeedKmh.toFixed(0)} km/h, accelerating to ${peakChairSpeedKmh.toFixed(0)} km/h in ${remaining}s`;
      }
      if (cyclePhase === 'braking') {
        const remaining = Math.max(1, Math.ceil(BRAKING_PHASE_SECONDS - cyclePhaseElapsed));
        return `Carousel: chair going ${chairSpeedKmh.toFixed(0)} km/h, braking from ${peakChairSpeedKmh.toFixed(0)} km/h for ${remaining}s`;
      }
      const remaining = Math.max(1, Math.ceil(STOPPED_PHASE_SECONDS - cyclePhaseElapsed));
      return `Carousel has stopped. Restarting in ${remaining}s`;
    },
    update(dt: number): void {
      if (!BUILD_CAROUSEL_RIDE) {
        return;
      }
      cyclePhaseElapsed += dt;
      if (cyclePhase === 'accelerating') {
        const t = Math.min(cyclePhaseElapsed / ACCELERATION_PHASE_SECONDS, 1.0);
        spinSpeed = cyclePeakSpinSpeed * Math.pow(t, ACCELERATION_EASE_POWER);
        if (cyclePhaseElapsed >= ACCELERATION_PHASE_SECONDS) {
          cyclePhase = 'braking';
          cyclePhaseElapsed = 0.0;
        }
      } else if (cyclePhase === 'braking') {
        const t = Math.min(cyclePhaseElapsed / BRAKING_PHASE_SECONDS, 1.0);
        spinSpeed = cyclePeakSpinSpeed * (1.0 - t);
        if (cyclePhaseElapsed >= BRAKING_PHASE_SECONDS) {
          cyclePhase = 'stopped';
          cyclePhaseElapsed = 0.0;
          spinSpeed = 0.0;
        }
      } else {
        spinSpeed = 0.0;
        if (cyclePhaseElapsed >= STOPPED_PHASE_SECONDS) {
          cyclePhase = 'accelerating';
          cyclePhaseElapsed = 0.0;
          spinSpeed = INITIAL_SPIN_SPEED;
          cyclePeakSpinSpeed = Math.min(MAX_SPIN_SPEED, cyclePeakSpinSpeed + cyclePeakSpinSpeedIncrement);
        }
      }
      spinAngle += spinSpeed * dt;

      for (const beam of rotatingBeams) {
        const angle = spinAngle + beam.angleOffset;
        const radial = new THREE.Vector3(Math.cos(angle), 0.0, Math.sin(angle));
        const tangent = new THREE.Vector3(-Math.sin(angle), 0.0, Math.cos(angle));
        const up = new THREE.Vector3(0.0, 1.0, 0.0);
        const center = radial.clone().multiplyScalar(beam.radialOffset)
          .addScaledVector(tangent, beam.tangentOffset);
        const linearVelocity = tangent.clone().multiplyScalar(spinSpeed * beam.radialOffset)
          .addScaledVector(radial, -spinSpeed * beam.tangentOffset);
        const quaternion = quaternionFromBasis(radial, up, tangent);
        physics.setBodyPose(
          beam.body,
          [center.x, beam.y, center.z],
          quaternion,
          [linearVelocity.x, linearVelocity.y, linearVelocity.z],
          [0.0, spinSpeed, 0.0],
        );
      }
    },
  };
}
