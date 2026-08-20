import * as THREE from 'three';
import { PhysicsEngine } from '../physics/PhysicsEngine';
import { AVBD_FRICTION_STATIC } from '../physics/avbdParams';
import {
  createTrackedBodyVisualSet,
  type TrackedBodyVisualSet,
} from './trackedBodyVisuals';
import type { TrackedSpringVisualSet } from './trackedSpringVisuals';
import type { AddStaticBoxWithVisual } from './springClothPatch';

export type JointedSandboxDemoResult = {
  trackedVisualSets: TrackedBodyVisualSet[];
  trackedSpringVisualSets: TrackedSpringVisualSet[];
};

const COLLISION_GROUP_CONTRAPTION = 0x08;
const CONTRAPTION_MASK = 0xff;
const JOINT_STIFFNESS = Number.POSITIVE_INFINITY;
const STATION_XS = [-30.0, -15.0, 0.0, 15.0, 30.0] as const;

const AXLE_HALF_EXTENTS: [number, number, number] = [0.24, 0.24, 1.0];
const WINDMILL_PADDLE_X_HALF_EXTENTS: [number, number, number] = [2.75, 0.18, 1.35];
const WINDMILL_PADDLE_Y_HALF_EXTENTS: [number, number, number] = [0.18, 2.75, 1.35];
const WINDMILL_BLADE_GAP = 0.08;
const PENDULUM_LINK_HALF_EXTENTS: [number, number, number] = [0.12, 0.48, 0.12];
const CURTAIN_LINK_HALF_EXTENTS: [number, number, number] = [0.1, 0.42, 0.1];
const SEESAW_PLANK_HALF_EXTENTS: [number, number, number] = [5.4, 0.22, 0.8];
const GATE_PANEL_HALF_EXTENTS: [number, number, number] = [0.3, 3.4, 2.2];
const HAMMER_RADIUS = 1.0;

function quaternionFromEuler(x: number, y: number, z: number): [number, number, number, number] {
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(x, y, z, 'XYZ'));
  return [q.x, q.y, q.z, q.w];
}

function rotateOffset(
  offset: [number, number, number],
  quaternion: [number, number, number, number],
): [number, number, number] {
  const v = new THREE.Vector3(offset[0], offset[1], offset[2]);
  v.applyQuaternion(new THREE.Quaternion(quaternion[0], quaternion[1], quaternion[2], quaternion[3]));
  return [v.x, v.y, v.z];
}

export function buildJointedSandboxDemo(args: {
  scene: THREE.Object3D;
  physics: PhysicsEngine;
  addStaticBoxWithVisual: AddStaticBoxWithVisual;
}): JointedSandboxDemoResult {
  const { scene, physics, addStaticBoxWithVisual } = args;
  const trackedVisualSets: TrackedBodyVisualSet[] = [];
  const trackedSpringVisualSets: TrackedSpringVisualSet[] = [];

  const axleVisuals = createTrackedBodyVisualSet(scene, physics, {
    capacity: 8,
    halfExtents: AXLE_HALF_EXTENTS,
    color: 0x96a6b6,
    roughness: 0.42,
    metalness: 0.22,
  });
  const paddleXVisuals = createTrackedBodyVisualSet(scene, physics, {
    capacity: 2,
    halfExtents: WINDMILL_PADDLE_X_HALF_EXTENTS,
    color: 0xcf7d47,
    roughness: 0.72,
    metalness: 0.05,
  });
  const paddleYVisuals = createTrackedBodyVisualSet(scene, physics, {
    capacity: 2,
    halfExtents: WINDMILL_PADDLE_Y_HALF_EXTENTS,
    color: 0xe3a866,
    roughness: 0.72,
    metalness: 0.05,
  });
  const chainVisuals = createTrackedBodyVisualSet(scene, physics, {
    capacity: 48,
    halfExtents: PENDULUM_LINK_HALF_EXTENTS,
    color: 0xb9c5d3,
    roughness: 0.46,
    metalness: 0.28,
  });
  const curtainLinkVisuals = createTrackedBodyVisualSet(scene, physics, {
    capacity: 40,
    halfExtents: CURTAIN_LINK_HALF_EXTENTS,
    color: 0xaeb9c7,
    roughness: 0.48,
    metalness: 0.24,
  });
  const seesawVisuals = createTrackedBodyVisualSet(scene, physics, {
    capacity: 1,
    halfExtents: SEESAW_PLANK_HALF_EXTENTS,
    color: 0x7b5e45,
    roughness: 0.84,
    metalness: 0.05,
  });
  const gateVisuals = createTrackedBodyVisualSet(scene, physics, {
    capacity: 1,
    halfExtents: GATE_PANEL_HALF_EXTENTS,
    color: 0x6d8567,
    roughness: 0.82,
    metalness: 0.04,
  });
  const hammerBallVisuals = createTrackedBodyVisualSet(scene, physics, {
    capacity: 2,
    geometry: new THREE.SphereGeometry(HAMMER_RADIUS, 28, 18),
    color: 0xcd9d63,
    roughness: 0.7,
    metalness: 0.08,
  });
  trackedVisualSets.push(
    axleVisuals,
    paddleXVisuals,
    paddleYVisuals,
    chainVisuals,
    curtainLinkVisuals,
    seesawVisuals,
    gateVisuals,
    hammerBallVisuals,
  );

  const addDynamicBox = (
    position: [number, number, number],
    halfExtents: [number, number, number],
    visuals: TrackedBodyVisualSet,
    options: {
      mass: number;
      quaternion?: [number, number, number, number];
      friction?: number;
    },
  ): number => {
    const body = physics.addBody({
      position,
      halfExtents,
      mass: options.mass,
      quaternion: options.quaternion,
      friction: options.friction ?? AVBD_FRICTION_STATIC,
      collisionGroup: COLLISION_GROUP_CONTRAPTION,
      collisionMask: CONTRAPTION_MASK,
    });
    visuals.addBody(body);
    return body;
  };

  const addDynamicSphere = (
    position: [number, number, number],
    radius: number,
    visuals: TrackedBodyVisualSet,
    options: {
      mass: number;
      friction?: number;
    },
  ): number => {
    const body = physics.addBody({
      position,
      shapeType: 'sphere',
      radius,
      mass: options.mass,
      friction: options.friction ?? AVBD_FRICTION_STATIC,
      collisionGroup: COLLISION_GROUP_CONTRAPTION,
      collisionMask: CONTRAPTION_MASK,
    });
    visuals.addBody(body);
    return body;
  };

  const addPinnedAxle = (
    position: [number, number, number],
    quaternion: [number, number, number, number],
    mass: number,
  ): number => {
    const axle = addDynamicBox(position, AXLE_HALF_EXTENTS, axleVisuals, {
      mass,
      quaternion,
      friction: 0.58,
    });
    const anchorAOffset = rotateOffset([0.0, 0.0, -AXLE_HALF_EXTENTS[2]], quaternion);
    const anchorBOffset = rotateOffset([0.0, 0.0, AXLE_HALF_EXTENTS[2]], quaternion);
    physics.addSphericalJoint(
      null,
      axle,
      [position[0] + anchorAOffset[0], position[1] + anchorAOffset[1], position[2] + anchorAOffset[2]],
      [0.0, 0.0, -AXLE_HALF_EXTENTS[2]],
      JOINT_STIFFNESS,
      true,
    );
    physics.addSphericalJoint(
      null,
      axle,
      [position[0] + anchorBOffset[0], position[1] + anchorBOffset[1], position[2] + anchorBOffset[2]],
      [0.0, 0.0, AXLE_HALF_EXTENTS[2]],
      JOINT_STIFFNESS,
      true,
    );
    return axle;
  };

  const addChain = (
    topAnchor: [number, number, number],
    linkCount: number,
    linkHalfExtents: [number, number, number],
    visuals: TrackedBodyVisualSet,
    massPerLink: number,
  ): { lastBody: number; lastAnchor: [number, number, number] } => {
    let previousBody: number | null = null;
    let previousAnchor: [number, number, number] = topAnchor;
    let lastBody = -1;
    let lastAnchor: [number, number, number] = [0.0, linkHalfExtents[1], 0.0];
    for (let i = 0; i < linkCount; i++) {
      const y = topAnchor[1] - (i + 0.5) * linkHalfExtents[1] * 2.0;
      const body = addDynamicBox(
        [topAnchor[0], y, topAnchor[2]],
        linkHalfExtents,
        visuals,
        { mass: massPerLink, friction: 0.5 },
      );
      physics.addSphericalJoint(
        previousBody,
        body,
        previousAnchor,
        [0.0, -linkHalfExtents[1], 0.0],
        JOINT_STIFFNESS,
        true,
      );
      previousBody = body;
      previousAnchor = [0.0, linkHalfExtents[1], 0.0];
      lastBody = body;
      lastAnchor = previousAnchor;
    }
    return { lastBody, lastAnchor };
  };

  for (const x of STATION_XS) {
    addStaticBoxWithVisual([x, 0.15, 0.0], [6.5, 0.15, 6.5], { color: 0x525f6d });
  }

  {
    const x = STATION_XS[0];
    addStaticBoxWithVisual([x, 3.3, -2.6], [0.5, 3.3, 0.5], { color: 0x667585 });
    addStaticBoxWithVisual([x, 6.8, -2.05], [0.28, 0.28, 0.52], { color: 0x748291 });
    const axle = addPinnedAxle([x, 6.8, 0.0], [0.0, 0.0, 0.0, 1.0], 2.4);
    const horizontalOffset = AXLE_HALF_EXTENTS[0] + WINDMILL_PADDLE_X_HALF_EXTENTS[0] + WINDMILL_BLADE_GAP;
    const verticalOffset = AXLE_HALF_EXTENTS[1] + WINDMILL_PADDLE_Y_HALF_EXTENTS[1] + WINDMILL_BLADE_GAP;

    const leftPaddle = addDynamicBox([x - horizontalOffset, 6.8, 0.0], WINDMILL_PADDLE_X_HALF_EXTENTS, paddleXVisuals, {
      mass: 1.6,
      friction: 0.56,
    });
    const rightPaddle = addDynamicBox([x + horizontalOffset, 6.8, 0.0], WINDMILL_PADDLE_X_HALF_EXTENTS, paddleXVisuals, {
      mass: 1.6,
      friction: 0.56,
    });
    const lowerPaddle = addDynamicBox([x, 6.8 - verticalOffset, 0.0], WINDMILL_PADDLE_Y_HALF_EXTENTS, paddleYVisuals, {
      mass: 1.6,
      friction: 0.56,
    });
    const upperPaddle = addDynamicBox([x, 6.8 + verticalOffset, 0.0], WINDMILL_PADDLE_Y_HALF_EXTENTS, paddleYVisuals, {
      mass: 1.6,
      friction: 0.56,
    });
    physics.addFixedJoint(
      axle,
      leftPaddle,
      [-AXLE_HALF_EXTENTS[0], 0.0, 0.0],
      [WINDMILL_PADDLE_X_HALF_EXTENTS[0], 0.0, 0.0],
      JOINT_STIFFNESS,
      true,
    );
    physics.addFixedJoint(
      axle,
      rightPaddle,
      [AXLE_HALF_EXTENTS[0], 0.0, 0.0],
      [-WINDMILL_PADDLE_X_HALF_EXTENTS[0], 0.0, 0.0],
      JOINT_STIFFNESS,
      true,
    );
    physics.addFixedJoint(
      axle,
      lowerPaddle,
      [0.0, -AXLE_HALF_EXTENTS[1], 0.0],
      [0.0, WINDMILL_PADDLE_Y_HALF_EXTENTS[1], 0.0],
      JOINT_STIFFNESS,
      true,
    );
    physics.addFixedJoint(
      axle,
      upperPaddle,
      [0.0, AXLE_HALF_EXTENTS[1], 0.0],
      [0.0, -WINDMILL_PADDLE_Y_HALF_EXTENTS[1], 0.0],
      JOINT_STIFFNESS,
      true,
    );
  }

  {
    const x = STATION_XS[1];
    addStaticBoxWithVisual([x - 2.8, 5.7, 0.0], [0.24, 5.7, 0.24], { color: 0x697584 });
    addStaticBoxWithVisual([x + 2.8, 5.7, 0.0], [0.24, 5.7, 0.24], { color: 0x697584 });
    addStaticBoxWithVisual([x, 11.2, 0.0], [3.1, 0.18, 2.5], { color: 0x7a8797 });
    for (const z of [-2.3, 2.3] as const) {
      const chain = addChain([x, 10.9, z], 4, PENDULUM_LINK_HALF_EXTENTS, chainVisuals, 0.24);
      const ball = addDynamicSphere([x, 6.0, z], HAMMER_RADIUS, hammerBallVisuals, {
        mass: 4.5,
        friction: 0.62,
      });
      physics.addSphericalJoint(
        chain.lastBody,
        ball,
        chain.lastAnchor,
        [0.0, HAMMER_RADIUS, 0.0],
        JOINT_STIFFNESS,
        true,
      );
    }
  }

  {
    const x = STATION_XS[2];
    addStaticBoxWithVisual([x, 1.2, 0.0], [1.2, 1.2, 1.2], { color: 0x6a7684 });
    const axle = addPinnedAxle([x, 3.3, 0.0], [0.0, 0.0, 0.0, 1.0], 2.1);
    const plank = addDynamicBox([x, 3.3, 0.0], SEESAW_PLANK_HALF_EXTENTS, seesawVisuals, {
      mass: 3.0,
      friction: 0.68,
    });
    physics.addFixedJoint(axle, plank, [0.0, 0.0, 0.0], [0.0, 0.0, 0.0], JOINT_STIFFNESS, true);
  }

  {
    const x = STATION_XS[3];
    addStaticBoxWithVisual([x - 2.8, 5.5, 0.0], [0.22, 5.5, 0.22], { color: 0x667281 });
    addStaticBoxWithVisual([x + 2.8, 5.5, 0.0], [0.22, 5.5, 0.22], { color: 0x667281 });
    addStaticBoxWithVisual([x, 10.8, 0.0], [3.0, 0.16, 2.4], { color: 0x788494 });
    const curtainOffsets = [-2.2, -1.1, 0.0, 1.1, 2.2] as const;
    for (const offsetZ of curtainOffsets) {
      addChain([x, 10.5, offsetZ], 6, CURTAIN_LINK_HALF_EXTENTS, curtainLinkVisuals, 0.12);
    }
  }

  {
    const x = STATION_XS[4];
    addStaticBoxWithVisual([x - 2.2, 5.4, 0.0], [0.22, 5.4, 0.22], { color: 0x667281 });
    addStaticBoxWithVisual([x + 2.2, 5.4, 0.0], [0.22, 5.4, 0.22], { color: 0x667281 });
    addStaticBoxWithVisual([x, 10.6, 0.0], [2.5, 0.16, 0.22], { color: 0x7a8797 });
    const axleY = 10.1;
    const axle = addPinnedAxle([x, axleY, 0.0], [0.0, 0.0, 0.0, 1.0], 1.6);
    const gate = addDynamicBox([x, axleY - GATE_PANEL_HALF_EXTENTS[1] - 0.25, 0.0], GATE_PANEL_HALF_EXTENTS, gateVisuals, {
      mass: 2.6,
      friction: 0.62,
    });
    physics.addFixedJoint(
      axle,
      gate,
      [0.0, -0.25, 0.0],
      [0.0, GATE_PANEL_HALF_EXTENTS[1], 0.0],
      JOINT_STIFFNESS,
      true,
    );
  }

  return {
    trackedVisualSets,
    trackedSpringVisualSets,
  };
}
