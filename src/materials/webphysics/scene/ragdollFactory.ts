import * as THREE from 'three';
import { PhysicsEngine } from '../physics/PhysicsEngine';
import { AVBD_FRICTION_STATIC } from '../physics/avbdParams';
import {
  createTrackedBodyVisualSet,
  type TrackedBodyVisualSet,
} from './trackedBodyVisuals';

export type RagdollFactory = {
  trackedVisualSets: TrackedBodyVisualSet[];
  addRagdoll: (args: {
    index: number;
    rootPosition: [number, number, number];
    linearVelocity?: [number, number, number];
    rootQuaternion?: [number, number, number, number];
    pose?: RagdollPose;
    /**
     * Spawn inert: zero mass, collision-filtered out, joints disabled. The bodies still render,
     * so an externally driven pose (a walk cycle) costs nothing in the solver until
     * `RagdollInstance.masses` are handed back through `setBodyMass` to wake the ragdoll.
     */
    kinematic?: boolean;
  }) => RagdollInstance;
};

/** Body indices are allocated consecutively, so `bodies[0]` doubles as a base index. */
export type RagdollInstance = {
  bodies: number[];
  joints: number[];
  /** Dynamic mass per entry of `bodies`, for waking a ragdoll spawned kinematic. */
  masses: number[];
};

export type RagdollPose =
  | 'standing'
  | 'seated';

const TRUNK_HALF_EXTENTS: [number, number, number] = [0.38, 0.64, 0.16];
const ARM_SEGMENT_HALF_EXTENTS: [number, number, number] = [0.1, 0.28, 0.1];
const LEG_SEGMENT_HALF_EXTENTS: [number, number, number] = [0.14, 0.38, 0.14];
const HEAD_RADIUS = 0.22;

/**
 * Scaled segment sizes and trunk-local joint anchors.
 *
 * Anything posing a ragdoll from outside the solver has to reproduce this anchor chain exactly,
 * or the joints start the frame violated and the ragdoll explodes the moment it goes dynamic.
 */
export type RagdollSkeleton = {
  scale: number;
  trunkHalfExtents: [number, number, number];
  armHalfExtents: [number, number, number];
  legHalfExtents: [number, number, number];
  headRadius: number;
  /** Trunk-local shoulder anchor; x is mirrored per side. */
  shoulderAnchor: [number, number];
  /** Trunk-local hip anchor; x is mirrored per side. */
  hipAnchor: [number, number];
  headAnchorY: number;
};

export function createRagdollSkeleton(scale = 1.0): RagdollSkeleton {
  const scaleVec3 = (value: [number, number, number]): [number, number, number] => [
    value[0] * scale,
    value[1] * scale,
    value[2] * scale,
  ];
  const trunkHalfExtents = scaleVec3(TRUNK_HALF_EXTENTS);
  const headRadius = HEAD_RADIUS * scale;
  return {
    scale,
    trunkHalfExtents,
    armHalfExtents: scaleVec3(ARM_SEGMENT_HALF_EXTENTS),
    legHalfExtents: scaleVec3(LEG_SEGMENT_HALF_EXTENTS),
    headRadius,
    shoulderAnchor: [trunkHalfExtents[0] + 0.06 * scale, trunkHalfExtents[1] * 0.58],
    hipAnchor: [0.17 * scale, -trunkHalfExtents[1] + 0.22 * scale],
    headAnchorY: trunkHalfExtents[1] + headRadius - 0.02 * scale,
  };
}

export function createRagdollFactory(args: {
  scene: THREE.Object3D;
  physics: PhysicsEngine;
  totalRagdolls: number;
  collisionGroup: number;
  collisionMask: number;
  colorBucketCount?: number;
  scale?: number;
  defaultPose?: RagdollPose;
  /**
   * Whether a ragdoll's own segments collide with each other.
   *
   * The ball joints carry no angular limits, so self-collision is the only thing keeping a forearm
   * out of the chest — worth having for a ragdoll dropped in mid-air. It is the wrong trade for one
   * that goes dynamic while standing: the legs buckle, the shins and forearms wedge against the
   * trunk, and the contact network braces the whole skeleton into a rigid crouch that never falls.
   */
  selfCollision?: boolean;
}): RagdollFactory {
  const {
    scene,
    physics,
    totalRagdolls,
    collisionGroup,
    collisionMask,
    colorBucketCount = 20,
    scale = 1.0,
    defaultPose = 'standing',
    selfCollision = true,
  } = args;
  const skeleton = createRagdollSkeleton(scale);
  const { trunkHalfExtents, armHalfExtents, legHalfExtents, headRadius } = skeleton;
  const massScale = scale * scale * scale;

  const trackedVisualSets: TrackedBodyVisualSet[] = [];
  const ragdollVisualBucketCount = Math.min(colorBucketCount, totalRagdolls);
  const ragdollHeadGeometry = new THREE.SphereGeometry(headRadius, 22, 16);

  // One palette entry per bucket as before, but the colour now rides on the instance rather than
  // on its own material: a bucket per colour meant 4 instanced meshes and 4 pipelines each, and
  // compiling 80 of them is most of the stall when one of these scenes loads.
  const palette = Array.from({ length: ragdollVisualBucketCount }, (_, bucketIndex) =>
    new THREE.Color().setHSL(
      ((bucketIndex / Math.max(1, ragdollVisualBucketCount)) * 0.86 + 0.02) % 1.0,
      0.68,
      0.58,
    ).getHex());

  const LIMBS_PER_RAGDOLL = 9; // trunk + 4 arm segments + 4 leg segments
  const limbVisuals = createTrackedBodyVisualSet(scene, physics, {
    capacity: Math.max(1, totalRagdolls * LIMBS_PER_RAGDOLL),
    perInstance: true,
    color: palette[0] ?? 0xffffff,
    roughness: 0.78,
    metalness: 0.04,
  });
  const headVisuals = createTrackedBodyVisualSet(scene, physics, {
    capacity: Math.max(1, totalRagdolls),
    perInstance: true,
    geometry: ragdollHeadGeometry,
    color: palette[0] ?? 0xffffff,
    roughness: 0.74,
    metalness: 0.03,
  });
  trackedVisualSets.push(limbVisuals, headVisuals);

  /** Colour for the ragdoll currently being built, picked up by registerBody. */
  let spawnTint = palette[0] ?? 0xffffff;

  let spawnInert = false;
  const spawnMasses: number[] = [];
  const spawnBodies: number[] = [];
  const spawnJoints: number[] = [];

  const registerBody = (
    body: number,
    mass: number,
    visuals: TrackedBodyVisualSet,
    halfExtents?: [number, number, number],
  ): number => {
    visuals.addBody(body, { color: spawnTint, ...(halfExtents ? { halfExtents } : {}) });
    spawnBodies.push(body);
    spawnMasses.push(mass);
    return body;
  };

  const addTrackedBox = (
    position: [number, number, number],
    halfExtents: [number, number, number],
    visuals: TrackedBodyVisualSet,
    options: {
      mass: number;
      friction?: number;
      linearVelocity?: [number, number, number];
      quaternion?: [number, number, number, number];
    },
  ): number => {
    const body = physics.addBody({
      position,
      halfExtents,
      mass: spawnInert ? 0.0 : options.mass,
      friction: options.friction ?? AVBD_FRICTION_STATIC,
      collisionGroup,
      collisionMask: spawnInert ? 0 : collisionMask,
      linearVelocity: options.linearVelocity,
      quaternion: options.quaternion,
    });
    return registerBody(body, options.mass, visuals, halfExtents);
  };

  const addTrackedSphere = (
    position: [number, number, number],
    radius: number,
    visuals: TrackedBodyVisualSet,
    options: {
      mass: number;
      friction?: number;
      linearVelocity?: [number, number, number];
      quaternion?: [number, number, number, number];
    },
  ): number => {
    const body = physics.addBody({
      position,
      shapeType: 'sphere',
      radius,
      mass: spawnInert ? 0.0 : options.mass,
      friction: options.friction ?? AVBD_FRICTION_STATIC,
      collisionGroup,
      collisionMask: spawnInert ? 0 : collisionMask,
      linearVelocity: options.linearVelocity,
      quaternion: options.quaternion,
    });
    return registerBody(body, options.mass, visuals);
  };

  return {
    trackedVisualSets,

    addRagdoll(args): RagdollInstance {
      const {
        index,
        rootPosition,
        linearVelocity = [0.0, 0.0, 0.0],
        rootQuaternion = [0.0, 0.0, 0.0, 1.0],
        pose = defaultPose,
        kinematic = false,
      } = args;
      spawnInert = kinematic;
      spawnBodies.length = 0;
      spawnMasses.length = 0;
      spawnJoints.length = 0;
      spawnTint = palette[index % ragdollVisualBucketCount]!;
      const trunkVisuals = limbVisuals;
      const armVisuals = limbVisuals;
      const legVisuals = limbVisuals;

      const toQuatTuple = (q: THREE.Quaternion): [number, number, number, number] => [q.x, q.y, q.z, q.w];
      const quatFromEuler = (x: number, y: number, z: number): [number, number, number, number] => {
        const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(x, y, z, 'XYZ'));
        return toQuatTuple(q);
      };
      const multiplyQuatTuple = (
        a: [number, number, number, number],
        b: [number, number, number, number],
      ): [number, number, number, number] => {
        const qa = new THREE.Quaternion(a[0], a[1], a[2], a[3]);
        const qb = new THREE.Quaternion(b[0], b[1], b[2], b[3]);
        qa.multiply(qb).normalize();
        return [qa.x, qa.y, qa.z, qa.w];
      };
      const normalizedRootQuat = toQuatTuple(new THREE.Quaternion(
        rootQuaternion[0],
        rootQuaternion[1],
        rootQuaternion[2],
        rootQuaternion[3],
      ).normalize());
      const rotateLocal = (
        local: [number, number, number],
        quaternion: [number, number, number, number],
      ): [number, number, number] => {
        const rotated = new THREE.Vector3(local[0], local[1], local[2]).applyQuaternion(
          new THREE.Quaternion(quaternion[0], quaternion[1], quaternion[2], quaternion[3]),
        );
        return [rotated.x, rotated.y, rotated.z];
      };
      const centerFromAnchor = (
        anchorWorld: [number, number, number],
        localAnchor: [number, number, number],
        quaternion: [number, number, number, number],
      ): [number, number, number] => {
        const offset = rotateLocal(localAnchor, quaternion);
        return [
          anchorWorld[0] - offset[0],
          anchorWorld[1] - offset[1],
          anchorWorld[2] - offset[2],
        ];
      };
      const anchorFromCenter = (
        centerWorld: [number, number, number],
        localAnchor: [number, number, number],
        quaternion: [number, number, number, number],
      ): [number, number, number] => {
        const offset = rotateLocal(localAnchor, quaternion);
        return [
          centerWorld[0] + offset[0],
          centerWorld[1] + offset[1],
          centerWorld[2] + offset[2],
        ];
      };

      const [x, y, z] = rootPosition;
      const trunkLocalQuat = pose === 'seated'
        ? quatFromEuler(0.05, 0.0, 0.0)
        : quatFromEuler(0.0, 0.0, 0.0);
      const trunkQuat = multiplyQuatTuple(normalizedRootQuat, trunkLocalQuat);
      const trunk = addTrackedBox(
        [x, y, z],
        trunkHalfExtents,
        trunkVisuals,
        {
          mass: 2.85 * massScale,
          friction: 0.62,
          linearVelocity,
          quaternion: trunkQuat,
        },
      );

      const leftUpperArmLocalQuat = pose === 'seated'
        ? quatFromEuler(-0.42, 0.0, -0.08)
        : quatFromEuler(0.08, 0.0, -0.58);
      const leftForearmLocalQuat = pose === 'seated'
        ? quatFromEuler(-1.16, 0.0, -0.02)
        : quatFromEuler(-0.38, 0.0, -0.24);
      const rightUpperArmLocalQuat = pose === 'seated'
        ? quatFromEuler(-0.42, 0.0, 0.08)
        : quatFromEuler(-0.08, 0.0, 0.58);
      const rightForearmLocalQuat = pose === 'seated'
        ? quatFromEuler(-1.16, 0.0, 0.02)
        : quatFromEuler(-0.38, 0.0, 0.24);
      const leftUpperLegLocalQuat = pose === 'seated'
        ? quatFromEuler(-1.4, 0.0, -0.04)
        : quatFromEuler(-0.14, 0.0, -0.16);
      const leftLowerLegLocalQuat = pose === 'seated'
        ? quatFromEuler(0.12, 0.0, -0.01)
        : quatFromEuler(0.24, 0.0, -0.04);
      const rightUpperLegLocalQuat = pose === 'seated'
        ? quatFromEuler(-1.4, 0.0, 0.04)
        : quatFromEuler(-0.14, 0.0, 0.16);
      const rightLowerLegLocalQuat = pose === 'seated'
        ? quatFromEuler(0.12, 0.0, 0.01)
        : quatFromEuler(0.24, 0.0, 0.04);

      const leftUpperArmQuat = multiplyQuatTuple(normalizedRootQuat, leftUpperArmLocalQuat);
      const leftForearmQuat = multiplyQuatTuple(normalizedRootQuat, leftForearmLocalQuat);
      const rightUpperArmQuat = multiplyQuatTuple(normalizedRootQuat, rightUpperArmLocalQuat);
      const rightForearmQuat = multiplyQuatTuple(normalizedRootQuat, rightForearmLocalQuat);
      const leftUpperLegQuat = multiplyQuatTuple(normalizedRootQuat, leftUpperLegLocalQuat);
      const leftLowerLegQuat = multiplyQuatTuple(normalizedRootQuat, leftLowerLegLocalQuat);
      const rightUpperLegQuat = multiplyQuatTuple(normalizedRootQuat, rightUpperLegLocalQuat);
      const rightLowerLegQuat = multiplyQuatTuple(normalizedRootQuat, rightLowerLegLocalQuat);

      const [shoulderAnchorX, shoulderAnchorY] = skeleton.shoulderAnchor;
      const [hipAnchorX, hipAnchorY] = skeleton.hipAnchor;
      const seatedShoulderAnchorX = trunkHalfExtents[0];
      const leftShoulderTrunkLocalAnchor: [number, number, number] = pose === 'seated'
        ? [-seatedShoulderAnchorX, shoulderAnchorY, 0.0]
        : [-shoulderAnchorX, shoulderAnchorY, 0.0];
      const rightShoulderTrunkLocalAnchor: [number, number, number] = pose === 'seated'
        ? [seatedShoulderAnchorX, shoulderAnchorY, 0.0]
        : [shoulderAnchorX, shoulderAnchorY, 0.0];
      const leftHipTrunkLocalAnchor: [number, number, number] = [-hipAnchorX, hipAnchorY, 0.0];
      const rightHipTrunkLocalAnchor: [number, number, number] = [hipAnchorX, hipAnchorY, 0.0];

      const shoulderRightOffset = rotateLocal(rightShoulderTrunkLocalAnchor, trunkQuat);
      const shoulderLeftOffset = rotateLocal(leftShoulderTrunkLocalAnchor, trunkQuat);
      const hipLeftOffset = rotateLocal(leftHipTrunkLocalAnchor, trunkQuat);
      const hipRightOffset = rotateLocal(rightHipTrunkLocalAnchor, trunkQuat);

      const leftShoulderAnchor: [number, number, number] = [x + shoulderLeftOffset[0], y + shoulderLeftOffset[1], z + shoulderLeftOffset[2]];
      const rightShoulderAnchor: [number, number, number] = [x + shoulderRightOffset[0], y + shoulderRightOffset[1], z + shoulderRightOffset[2]];
      const leftHipAnchor: [number, number, number] = [x + hipLeftOffset[0], y + hipLeftOffset[1], z + hipLeftOffset[2]];
      const rightHipAnchor: [number, number, number] = [x + hipRightOffset[0], y + hipRightOffset[1], z + hipRightOffset[2]];

      const leftUpperArmCenter = centerFromAnchor(
        leftShoulderAnchor,
        [0.0, armHalfExtents[1], 0.0],
        leftUpperArmQuat,
      );
      const rightUpperArmCenter = centerFromAnchor(
        rightShoulderAnchor,
        [0.0, armHalfExtents[1], 0.0],
        rightUpperArmQuat,
      );
      const leftElbowAnchor = anchorFromCenter(
        leftUpperArmCenter,
        [0.0, -armHalfExtents[1], 0.0],
        leftUpperArmQuat,
      );
      const rightElbowAnchor = anchorFromCenter(
        rightUpperArmCenter,
        [0.0, -armHalfExtents[1], 0.0],
        rightUpperArmQuat,
      );
      const leftForearmCenter = centerFromAnchor(
        leftElbowAnchor,
        [0.0, armHalfExtents[1], 0.0],
        leftForearmQuat,
      );
      const rightForearmCenter = centerFromAnchor(
        rightElbowAnchor,
        [0.0, armHalfExtents[1], 0.0],
        rightForearmQuat,
      );

      const leftUpperLegCenter = centerFromAnchor(
        leftHipAnchor,
        [0.0, legHalfExtents[1], 0.0],
        leftUpperLegQuat,
      );
      const rightUpperLegCenter = centerFromAnchor(
        rightHipAnchor,
        [0.0, legHalfExtents[1], 0.0],
        rightUpperLegQuat,
      );
      const leftKneeAnchor = anchorFromCenter(
        leftUpperLegCenter,
        [0.0, -legHalfExtents[1], 0.0],
        leftUpperLegQuat,
      );
      const rightKneeAnchor = anchorFromCenter(
        rightUpperLegCenter,
        [0.0, -legHalfExtents[1], 0.0],
        rightUpperLegQuat,
      );
      const leftLowerLegCenter = centerFromAnchor(
        leftKneeAnchor,
        [0.0, legHalfExtents[1], 0.0],
        leftLowerLegQuat,
      );
      const rightLowerLegCenter = centerFromAnchor(
        rightKneeAnchor,
        [0.0, legHalfExtents[1], 0.0],
        rightLowerLegQuat,
      );

      const headOffset = rotateLocal([0.0, skeleton.headAnchorY, 0.0], trunkQuat);
      const head = addTrackedSphere(
        [x + headOffset[0], y + headOffset[1], z + headOffset[2]],
        headRadius,
        headVisuals,
        {
          mass: 0.6 * massScale,
          friction: 0.55,
          linearVelocity,
          quaternion: trunkQuat,
        },
      );
      const leftUpperArm = addTrackedBox(
        leftUpperArmCenter,
        armHalfExtents,
        armVisuals,
        {
          mass: 0.45 * massScale,
          friction: 0.62,
          linearVelocity,
          quaternion: leftUpperArmQuat,
        },
      );
      const leftForearm = addTrackedBox(
        leftForearmCenter,
        armHalfExtents,
        armVisuals,
        {
          mass: 0.38 * massScale,
          friction: 0.62,
          linearVelocity,
          quaternion: leftForearmQuat,
        },
      );
      const rightUpperArm = addTrackedBox(
        rightUpperArmCenter,
        armHalfExtents,
        armVisuals,
        {
          mass: 0.45 * massScale,
          friction: 0.62,
          linearVelocity,
          quaternion: rightUpperArmQuat,
        },
      );
      const rightForearm = addTrackedBox(
        rightForearmCenter,
        armHalfExtents,
        armVisuals,
        {
          mass: 0.38 * massScale,
          friction: 0.62,
          linearVelocity,
          quaternion: rightForearmQuat,
        },
      );
      const leftUpperLeg = addTrackedBox(
        leftUpperLegCenter,
        legHalfExtents,
        legVisuals,
        {
          mass: 0.82 * massScale,
          friction: 0.62,
          linearVelocity,
          quaternion: leftUpperLegQuat,
        },
      );
      const leftLowerLeg = addTrackedBox(
        leftLowerLegCenter,
        legHalfExtents,
        legVisuals,
        {
          mass: 0.7 * massScale,
          friction: 0.62,
          linearVelocity,
          quaternion: leftLowerLegQuat,
        },
      );
      const rightUpperLeg = addTrackedBox(
        rightUpperLegCenter,
        legHalfExtents,
        legVisuals,
        {
          mass: 0.82 * massScale,
          friction: 0.62,
          linearVelocity,
          quaternion: rightUpperLegQuat,
        },
      );
      const rightLowerLeg = addTrackedBox(
        rightLowerLegCenter,
        legHalfExtents,
        legVisuals,
        {
          mass: 0.7 * massScale,
          friction: 0.62,
          linearVelocity,
          quaternion: rightLowerLegQuat,
        },
      );

      spawnJoints.push(physics.addFixedJoint(
        trunk,
        head,
        [0.0, trunkHalfExtents[1], 0.0],
        [0.0, -headRadius, 0.0],
        Number.POSITIVE_INFINITY,
        true,
      ));
      spawnJoints.push(physics.addSphericalJoint(
        trunk,
        leftUpperArm,
        leftShoulderTrunkLocalAnchor,
        [0.0, armHalfExtents[1], 0.0],
        Number.POSITIVE_INFINITY,
        true,
      ));
      spawnJoints.push(physics.addSphericalJoint(
        trunk,
        rightUpperArm,
        rightShoulderTrunkLocalAnchor,
        [0.0, armHalfExtents[1], 0.0],
        Number.POSITIVE_INFINITY,
        true,
      ));
      spawnJoints.push(physics.addSphericalJoint(
        leftUpperArm,
        leftForearm,
        [0.0, -armHalfExtents[1], 0.0],
        [0.0, armHalfExtents[1], 0.0],
        Number.POSITIVE_INFINITY,
        true,
      ));
      spawnJoints.push(physics.addSphericalJoint(
        rightUpperArm,
        rightForearm,
        [0.0, -armHalfExtents[1], 0.0],
        [0.0, armHalfExtents[1], 0.0],
        Number.POSITIVE_INFINITY,
        true,
      ));
      spawnJoints.push(physics.addSphericalJoint(
        trunk,
        leftUpperLeg,
        leftHipTrunkLocalAnchor,
        [0.0, legHalfExtents[1], 0.0],
        Number.POSITIVE_INFINITY,
        true,
      ));
      spawnJoints.push(physics.addSphericalJoint(
        trunk,
        rightUpperLeg,
        rightHipTrunkLocalAnchor,
        [0.0, legHalfExtents[1], 0.0],
        Number.POSITIVE_INFINITY,
        true,
      ));
      spawnJoints.push(physics.addSphericalJoint(
        leftUpperLeg,
        leftLowerLeg,
        [0.0, -legHalfExtents[1], 0.0],
        [0.0, legHalfExtents[1], 0.0],
        Number.POSITIVE_INFINITY,
        true,
      ));
      spawnJoints.push(physics.addSphericalJoint(
        rightUpperLeg,
        rightLowerLeg,
        [0.0, -legHalfExtents[1], 0.0],
        [0.0, legHalfExtents[1], 0.0],
        Number.POSITIVE_INFINITY,
        true,
      ));

      const bodies = [
        trunk,
        head,
        leftUpperArm,
        leftForearm,
        rightUpperArm,
        rightForearm,
        leftUpperLeg,
        leftLowerLeg,
        rightUpperLeg,
        rightLowerLeg,
      ];
      if (!selfCollision) {
        for (let a = 0; a < bodies.length; a++) {
          for (let b = a + 1; b < bodies.length; b++) {
            physics.setBodyPairCollisionIgnored(bodies[a]!, bodies[b]!, true);
          }
        }
      }

      const masses = bodies.map((body) => spawnMasses[spawnBodies.indexOf(body)] ?? 1.0);
      const joints = spawnJoints.slice();
      if (kinematic) {
        for (const joint of joints) physics.disableJoint(joint);
      }
      spawnInert = false;

      return { bodies, joints, masses };
    },
  };
}
