import * as THREE from 'three';
import { PhysicsEngine } from '../physics/PhysicsEngine';
import { AVBD_FRICTION_STATIC } from '../physics/avbdParams';
import {
  createTrackedBodyVisualSet,
  type TrackedBodyVisualSet,
} from './trackedBodyVisuals';
import type { TrackedSpringVisualSet } from './trackedSpringVisuals';
import type { AddStaticBoxWithVisual } from './springClothPatch';

export type DrivenSeatDemoResult = {
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
};

const COLLISION_GROUP_WORLD = 0x01;
const COLLISION_GROUP_RIDE = 0x08;

const HUB_Y = 14.0;
const HUB_HALF_EXTENTS: [number, number, number] = [1.1, 0.12, 1.1];
const BEAM_THICKNESS_HALF_EXTENTS: [number, number, number] = [1.0, 0.1, 0.16];
const HANGER_BAR_HALF_EXTENTS: [number, number, number] = [0.28, 0.05, 0.12];
const LINK_HALF_EXTENTS: [number, number, number] = [0.05, 0.24, 0.05];
const SEAT_BASE_HALF_EXTENTS: [number, number, number] = [0.52, 0.08, 0.42];
const SEAT_BACK_HALF_EXTENTS: [number, number, number] = [0.52, 0.44, 0.06];
const SEAT_SIDE_HALF_EXTENTS: [number, number, number] = [0.05, 0.42, 0.42];
const SEAT_FRONT_HALF_EXTENTS: [number, number, number] = [0.42, 0.16, 0.05];

const INNER_RADIUS = 0.72;
const ARM_LENGTH = 5.4;
const CHAIN_LINK_COUNT = 4;
const CHAIN_STIFFNESS = Number.POSITIVE_INFINITY;
const TOP_ANCHOR_LATERAL_OFFSET = 0.12;
const CHAIN_LENGTH = CHAIN_LINK_COUNT * LINK_HALF_EXTENTS[1] * 2.0;
const SEAT_BACK_RISE = 0.36;
const SEAT_BACK_INSET = 0.36;
const SEAT_SIDE_RISE = 0.30;
const SEAT_FRONT_RISE = 0.08;
const SEAT_FRONT_OFFSET = 0.37;
const REAR_HANGER_TANGENT_OFFSET = 0.24;
const FRONT_HANGER_TANGENT_OFFSET = 0.28;
const CHAIR_TOP_INSET = 0.02;
const BEAM_INNER_OVERLAP = 0.34;
const BEAM_OUTER_OVERHANG = 0.26;
const CHAIN_LINK_MASS = 0.22;
const SEAT_BASE_MASS = 2.8;
const SEAT_BACK_MASS = 2.0;
const SEAT_SIDE_MASS = 1.0;
const SEAT_FRONT_MASS = 0.7;
const SPIN_ACCELERATION = 0.06;
const MAX_SPIN_SPEED = 1.9;
const INITIAL_SPIN_SPEED = 0.0;

type MovingSupport = {
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

type BeamLayout = {
  ropeAnchorRadius: number;
  beamHalfExtents: [number, number, number];
  beamCenterRadius: number;
};

function computeBeamLayout(): BeamLayout {
  const ropeAnchorRadius = INNER_RADIUS + ARM_LENGTH - 0.06;
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

export function buildDrivenSeatDemo(args: {
  scene: THREE.Object3D;
  physics: PhysicsEngine;
  addStaticBoxWithVisual: AddStaticBoxWithVisual;
}): DrivenSeatDemoResult {
  const { scene, physics, addStaticBoxWithVisual } = args;

  const trackedVisualSets: TrackedBodyVisualSet[] = [];
  const trackedSpringVisualSets: TrackedSpringVisualSet[] = [];

  const beamLayout = computeBeamLayout();
  const chainVisuals = createTrackedBodyVisualSet(scene, physics, {
    capacity: CHAIN_LINK_COUNT * 4,
    halfExtents: LINK_HALF_EXTENTS,
    color: 0xc9d2dd,
    roughness: 0.46,
    metalness: 0.3,
  });
  const beamVisuals = createTrackedBodyVisualSet(scene, physics, {
    capacity: 1,
    halfExtents: beamLayout.beamHalfExtents,
    color: 0xe6c76f,
    roughness: 0.54,
    metalness: 0.18,
  });
  const hangerBarVisuals = createTrackedBodyVisualSet(scene, physics, {
    capacity: 2,
    halfExtents: HANGER_BAR_HALF_EXTENTS,
    color: 0xd1b65a,
    roughness: 0.52,
    metalness: 0.14,
  });
  const seatBaseVisuals = createTrackedBodyVisualSet(scene, physics, {
    capacity: 1,
    halfExtents: SEAT_BASE_HALF_EXTENTS,
    color: 0x2f7f9d,
    roughness: 0.78,
    metalness: 0.06,
  });
  const seatBackVisuals = createTrackedBodyVisualSet(scene, physics, {
    capacity: 1,
    halfExtents: SEAT_BACK_HALF_EXTENTS,
    color: 0x3e9ec1,
    roughness: 0.74,
    metalness: 0.06,
  });
  const seatSideVisuals = createTrackedBodyVisualSet(scene, physics, {
    capacity: 2,
    halfExtents: SEAT_SIDE_HALF_EXTENTS,
    color: 0x3e9ec1,
    roughness: 0.74,
    metalness: 0.06,
  });
  const seatFrontVisuals = createTrackedBodyVisualSet(scene, physics, {
    capacity: 1,
    halfExtents: SEAT_FRONT_HALF_EXTENTS,
    color: 0x51b3d9,
    roughness: 0.74,
    metalness: 0.06,
  });
  trackedVisualSets.push(
    beamVisuals,
    hangerBarVisuals,
    chainVisuals,
    seatBaseVisuals,
    seatBackVisuals,
    seatSideVisuals,
    seatFrontVisuals,
  );

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
      collisionMask: COLLISION_GROUP_WORLD,
      lockRotation: options.lockRotation,
    });
    visuals.addBody(body);
    return body;
  };

  addStaticBoxWithVisual([0.0, 12.9, 0.0], [0.65, 12.9, 0.65], {
    color: 0x6f7b87,
  });
  addStaticBoxWithVisual([0.0, 27.0, 0.0], [2.2, 0.4, 2.2], {
    color: 0x8d99a4,
  });
  addStaticBoxWithVisual([0.0, 0.9, 0.0], [3.4, 0.9, 3.4], {
    color: 0x5b6672,
  });
  addStaticBoxWithVisual([0.0, HUB_Y, 0.0], HUB_HALF_EXTENTS, {
    color: 0x74808d,
  });

  const angle = 0.0;
  const radial = new THREE.Vector3(Math.cos(angle), 0.0, Math.sin(angle));
  const tangent = new THREE.Vector3(-Math.sin(angle), 0.0, Math.cos(angle));
  const up = new THREE.Vector3(0.0, 1.0, 0.0);

  const beamQuaternion = quaternionFromBasis(radial, up, tangent);
  const beamCenter = new THREE.Vector3(
    radial.x * beamLayout.beamCenterRadius,
    HUB_Y,
    radial.z * beamLayout.beamCenterRadius,
  );
  const beamBody = addRideBody(
    [beamCenter.x, beamCenter.y, beamCenter.z],
    beamLayout.beamHalfExtents,
    beamVisuals,
    { mass: 0.0, quaternion: beamQuaternion, lockRotation: true },
  );

  const beamAnchorWorld = new THREE.Vector3(
    radial.x * beamLayout.ropeAnchorRadius,
    HUB_Y - beamLayout.beamHalfExtents[1],
    radial.z * beamLayout.ropeAnchorRadius,
  );
  const hangerY = HUB_Y - beamLayout.beamHalfExtents[1] - HANGER_BAR_HALF_EXTENTS[1];
  const rearHangerCenter = beamAnchorWorld.clone().setY(hangerY).addScaledVector(tangent, -REAR_HANGER_TANGENT_OFFSET);
  const frontHangerCenter = beamAnchorWorld.clone().setY(hangerY).addScaledVector(tangent, FRONT_HANGER_TANGENT_OFFSET);
  const hangerQuaternion = beamQuaternion;

  const rearHangerBar = addRideBody(
    [rearHangerCenter.x, rearHangerCenter.y, rearHangerCenter.z],
    HANGER_BAR_HALF_EXTENTS,
    hangerBarVisuals,
    { mass: 0.0, quaternion: hangerQuaternion, lockRotation: true },
  );
  const frontHangerBar = addRideBody(
    [frontHangerCenter.x, frontHangerCenter.y, frontHangerCenter.z],
    HANGER_BAR_HALF_EXTENTS,
    hangerBarVisuals,
    { mass: 0.0, quaternion: hangerQuaternion, lockRotation: true },
  );

  const seatCenter = beamAnchorWorld.clone().addScaledVector(up, -(CHAIN_LENGTH + SEAT_BASE_HALF_EXTENTS[1]));
  const seatQuaternion = quaternionFromBasis(radial, up, tangent);
  const seatBase = addRideBody(
    [seatCenter.x, seatCenter.y, seatCenter.z],
    SEAT_BASE_HALF_EXTENTS,
    seatBaseVisuals,
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
    seatBackVisuals,
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
      seatSideVisuals,
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

  const seatFrontCenter = seatCenter.clone()
    .addScaledVector(up, SEAT_FRONT_RISE)
    .addScaledVector(tangent, SEAT_FRONT_OFFSET);
  const seatFront = addRideBody(
    [seatFrontCenter.x, seatFrontCenter.y, seatFrontCenter.z],
    SEAT_FRONT_HALF_EXTENTS,
    seatFrontVisuals,
    {
      mass: SEAT_FRONT_MASS,
      quaternion: seatQuaternion,
      friction: 0.74,
    },
  );
  physics.addFixedJoint(
    seatBase,
    seatFront,
    [0.0, SEAT_FRONT_RISE, SEAT_FRONT_OFFSET],
    [0.0, 0.0, 0.0],
    Number.POSITIVE_INFINITY,
    true,
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

  const diagnosticJoints: DrivenSeatDemoResult['diagnostics']['joints'] = [];

  for (const chainSpec of chainSpecs) {
    const seatAnchorWorld = new THREE.Vector3(seatCenter.x, seatCenter.y, seatCenter.z);
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

    const topCenter = chainSpec.topBody === rearHangerBar ? rearHangerCenter : frontHangerCenter;
    const topAnchorWorld = topCenter.clone().addScaledVector(radial, chainSpec.topAnchor[0]);
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
        chainVisuals,
        {
          mass: CHAIN_LINK_MASS,
          friction: 0.55,
          quaternion: chainQuaternion,
        },
      );
      const jointIndex = physics.addSphericalJoint(
        previousBody,
        linkBody,
        previousAnchor,
        [0.0, -LINK_HALF_EXTENTS[1], 0.0],
        CHAIN_STIFFNESS,
        true,
      );
      if (linkIndex === 0) {
        diagnosticJoints.push({
          joint: jointIndex,
          label: chainSpec.topBody === rearHangerBar
            ? (chainSpec.topAnchor[0] < 0.0 ? 'rear-left' : 'rear-right')
            : (chainSpec.topAnchor[0] < 0.0 ? 'front-left' : 'front-right'),
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

  const movingSupports: MovingSupport[] = [
    {
      body: beamBody,
      radialOffset: beamLayout.beamCenterRadius,
      tangentOffset: 0.0,
      y: HUB_Y,
      angleOffset: 0.0,
    },
    {
      body: rearHangerBar,
      radialOffset: beamLayout.ropeAnchorRadius,
      tangentOffset: -REAR_HANGER_TANGENT_OFFSET,
      y: hangerY,
      angleOffset: 0.0,
    },
    {
      body: frontHangerBar,
      radialOffset: beamLayout.ropeAnchorRadius,
      tangentOffset: FRONT_HANGER_TANGENT_OFFSET,
      y: hangerY,
      angleOffset: 0.0,
    },
  ];

  let spinAngle = 0.0;
  let spinSpeed = INITIAL_SPIN_SPEED;

  return {
    trackedVisualSets,
    trackedSpringVisualSets,
    diagnostics: {
      joints: diagnosticJoints,
    },
    update(dt: number): void {
      spinSpeed = Math.min(MAX_SPIN_SPEED, spinSpeed + SPIN_ACCELERATION * dt);
      spinAngle += spinSpeed * dt;

      for (const support of movingSupports) {
        const angleNow = spinAngle + support.angleOffset;
        const radialNow = new THREE.Vector3(Math.cos(angleNow), 0.0, Math.sin(angleNow));
        const tangentNow = new THREE.Vector3(-Math.sin(angleNow), 0.0, Math.cos(angleNow));
        const upNow = new THREE.Vector3(0.0, 1.0, 0.0);
        const center = radialNow.clone().multiplyScalar(support.radialOffset)
          .addScaledVector(tangentNow, support.tangentOffset);
        const linearVelocity = tangentNow.clone().multiplyScalar(spinSpeed * support.radialOffset)
          .addScaledVector(radialNow, -spinSpeed * support.tangentOffset);
        const quaternion = quaternionFromBasis(radialNow, upNow, tangentNow);
        physics.setBodyPose(
          support.body,
          [center.x, support.y, center.z],
          quaternion,
          [linearVelocity.x, linearVelocity.y, linearVelocity.z],
          [0.0, spinSpeed, 0.0],
        );
      }
    },
  };
}
