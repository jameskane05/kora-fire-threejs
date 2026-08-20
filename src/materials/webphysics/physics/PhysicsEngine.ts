import { BufferAttribute, StorageBufferAttribute } from 'three/webgpu';
import type {
  AvbdBodySolveMode,
  JointDesc,
  PhysicsConfig,
  RigidBodyDesc,
  PhysicsStats,
  SpringDesc,
} from './types';
import { IntegrationStage } from './gpu/integration';
import { ContactGenerationStage } from './gpu/contactGeneration';
import { AvbdStateStage } from './gpu/avbdState';
import { BroadPhaseStage } from './gpu/broadPhase';
import { DerivedInertiaStage } from './gpu/derivedInertia';
import { PlayerControlStage, type PlayerProbeState } from './gpu/playerControl';
import {
  CONTACT_RECORD_ARM_A_OFFSET,
  CONTACT_RECORD_ARM_B_OFFSET,
  CONTACT_RECORD_CACHE_OFFSET,
  CONTACT_RECORD_CONSTRAINT_C0_OFFSET,
  CONTACT_RECORD_DUAL_OFFSET,
  CONTACT_RECORD_FLOATS,
  CONTACT_RECORD_META_OFFSET,
  CONTACT_RECORD_NORMAL_PEN_OFFSET,
  CONTACT_RECORD_PENALTY_OFFSET,
  CONTACT_RECORD_SHADOW_OFFSET,
  CONTACT_RECORD_VEC4S,
  contactRecordVec4FloatIndex,
} from './gpu/contactRecord';
import {
  JOINT_RECORD_ANCHOR_A_OFFSET,
  JOINT_RECORD_ANCHOR_B_OFFSET,
  JOINT_RECORD_C0_ANG_OFFSET,
  JOINT_RECORD_C0_LIN_OFFSET,
  JOINT_RECORD_FLOATS,
  JOINT_RECORD_LAMBDA_ANG_OFFSET,
  JOINT_RECORD_LAMBDA_LIN_OFFSET,
  JOINT_RECORD_META_OFFSET,
  JOINT_RECORD_PENALTY_ANG_OFFSET,
  JOINT_RECORD_PENALTY_LIN_OFFSET,
  JOINT_RECORD_REST_RELATIVE_ROTATION_OFFSET,
  JOINT_RECORD_STIFFNESS_OFFSET,
  JOINT_RECORD_VEC4S,
  jointRecordVec4FloatIndex,
} from './gpu/jointRecord';
import {
  SPRING_RECORD_ANCHOR_A_OFFSET,
  SPRING_RECORD_ANCHOR_B_OFFSET,
  SPRING_RECORD_FLOATS,
  SPRING_RECORD_META_OFFSET,
  SPRING_RECORD_VEC4S,
  springRecordVec4FloatIndex,
} from './gpu/springRecord';
import {
  DEFAULT_COLLISION_GROUP,
  DEFAULT_COLLISION_MASK,
  SHAPE_TYPE_BOX,
  SHAPE_TYPE_SPHERE,
  clampCollisionFilterWord,
  clampShapeFriction,
  decodeShapeFrictionWord,
  decodeShapeTypeWord,
  packShapeMetaWord,
} from './gpu/shapeEncoding';
import { AVBD_COLLISION_MARGIN, AVBD_FRICTION_DYNAMIC, AVBD_FRICTION_STATIC } from './avbdParams';

const CANDIDATE_LIST_HEADER_WORDS = 1;
const AVBD_K_START = 1.0;
const AVBD_REGULARIZATION_ALPHA = 0.95;
const INERTIAL_POSE_VEC4S_PER_BODY = 4;
const INERTIAL_POSE_FLOATS_PER_BODY = INERTIAL_POSE_VEC4S_PER_BODY * 4;
const WORLD_BODY_INDEX = 0xffffffff;
const DEFAULT_MAX_JOINTS_PER_BODY_SOLVER = 8;
const DEFAULT_MAX_SPRINGS_PER_BODY_SOLVER = 12;
function pairIndexForBodies(i: number, j: number): number {
  const a = Math.min(i, j);
  const b = Math.max(i, j);
  if (!Number.isFinite(a) || !Number.isFinite(b) || a < 0 || b <= a) {
    return -1;
  }
  return Math.floor((b * (b - 1)) / 2 + a);
}

function pairReferenceSequence(i: number, j: number, bodyCount: number): number {
  const a = Math.min(i, j);
  const b = Math.max(i, j);
  if (!Number.isFinite(a) || !Number.isFinite(b) || a < 0 || b <= a || b >= bodyCount) {
    return 0;
  }
  return Math.floor((a * (2 * bodyCount - a - 1)) / 2 + (b - a - 1));
}

function normalizeQuat(q: [number, number, number, number]): [number, number, number, number] {
  const len = Math.hypot(q[0], q[1], q[2], q[3]);
  if (len <= 1e-12) return [0, 0, 0, 1];
  return [q[0] / len, q[1] / len, q[2] / len, q[3] / len];
}

function conjugateQuat(q: [number, number, number, number]): [number, number, number, number] {
  return [-q[0], -q[1], -q[2], q[3]];
}

function multiplyQuat(
  a: [number, number, number, number],
  b: [number, number, number, number],
): [number, number, number, number] {
  return [
    a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
    a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
    a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
    a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2],
  ];
}

function rotateVector(
  q: [number, number, number, number],
  v: [number, number, number],
): [number, number, number] {
  const rotated = multiplyQuat(multiplyQuat(normalizeQuat(q), [v[0], v[1], v[2], 0]), conjugateQuat(normalizeQuat(q)));
  return [rotated[0], rotated[1], rotated[2]];
}

type DecodedAvbdContactState = {
  dualX: number;
  dualY: number;
  dualZ: number;
  dualW: number;
  dualN: number;
  lambdaN: number;
  penaltyN: number;
  penaltyT1: number;
  penaltyT2: number;
  frictionScale: number;
  shadowLambdaN: number;
  shadowT1: number;
  shadowT2: number;
  shadowFrictionScale: number;
};

function decodeAvbdContactState(
  pairContacts: Float32Array,
  p: number,
  kStart = AVBD_K_START,
): DecodedAvbdContactState {
  const dualBase = contactRecordVec4FloatIndex(p, CONTACT_RECORD_DUAL_OFFSET);
  const penaltyBase = contactRecordVec4FloatIndex(p, CONTACT_RECORD_PENALTY_OFFSET);
  const shadowBase = contactRecordVec4FloatIndex(p, CONTACT_RECORD_SHADOW_OFFSET);
  const dualX = pairContacts[dualBase] ?? 0.0;
  const dualY = pairContacts[dualBase + 1] ?? 0.0;
  const dualZ = pairContacts[dualBase + 2] ?? 0.0;
  const dualW = pairContacts[dualBase + 3] ?? 0.0;
  const penaltyX = pairContacts[penaltyBase] ?? 0.0;
  const penaltyY = pairContacts[penaltyBase + 1] ?? 0.0;
  const penaltyZ = pairContacts[penaltyBase + 2] ?? 0.0;
  const penaltyW = pairContacts[penaltyBase + 3] ?? 0.0;
  const shadowLambdaN = Math.max(pairContacts[shadowBase] ?? 0.0, 0.0);
  const shadowT1 = pairContacts[shadowBase + 1] ?? 0.0;
  const shadowT2 = pairContacts[shadowBase + 2] ?? 0.0;
  const shadowFrictionScale = Math.max(pairContacts[shadowBase + 3] ?? 0.0, 0.0);
  const penaltyFrictionScale = Math.max(penaltyW, 0.0);
  const frictionScale = Math.max(
    penaltyFrictionScale > 0.0 ? penaltyFrictionScale : shadowFrictionScale,
    0.0,
  );
  const dualN = Math.min(dualX, 0.0);
  return {
    dualX,
    dualY,
    dualZ,
    dualW,
    dualN,
    lambdaN: Math.max(-dualN, 0.0),
    penaltyN: Math.max(penaltyX, kStart),
    penaltyT1: Math.max(penaltyY, kStart),
    penaltyT2: Math.max(penaltyZ, kStart),
    frictionScale,
    shadowLambdaN,
    shadowT1,
    shadowT2,
    shadowFrictionScale,
  };
}

type DecodedPairContactViews = {
  meta: Float32Array;
  metaWords: Uint32Array;
  cacheWords: Uint32Array;
  normalPen: Float32Array;
  arms: Float32Array;
  armWords: Uint32Array;
  constraintC0: Float32Array;
  pairLambdas: Float32Array;
  dual: Float32Array;
  pairContacts: Float32Array;
  pairContactWords: Uint32Array;
};

function decodePairContactViews(pairContactsRaw: ArrayBuffer, maxPairContacts: number): DecodedPairContactViews {
  const pairContacts = new Float32Array(pairContactsRaw);
  const pairContactWords = new Uint32Array(pairContactsRaw);
  const meta = new Float32Array(maxPairContacts * 4);
  const metaWords = new Uint32Array(meta.buffer);
  const normalPen = new Float32Array(maxPairContacts * 4);
  const arms = new Float32Array(maxPairContacts * 8);
  const armWords = new Uint32Array(arms.buffer);
  const constraintC0 = new Float32Array(maxPairContacts * 4);
  const pairLambdas = new Float32Array(maxPairContacts * 4);
  const dual = new Float32Array(maxPairContacts * 8);
  const cacheWords = new Uint32Array(maxPairContacts);

  for (let p = 0; p < maxPairContacts; p++) {
    const metaBase = contactRecordVec4FloatIndex(p, CONTACT_RECORD_META_OFFSET);
    const normalBase = contactRecordVec4FloatIndex(p, CONTACT_RECORD_NORMAL_PEN_OFFSET);
    const armABase = contactRecordVec4FloatIndex(p, CONTACT_RECORD_ARM_A_OFFSET);
    const armBBase = contactRecordVec4FloatIndex(p, CONTACT_RECORD_ARM_B_OFFSET);
    const c0Base = contactRecordVec4FloatIndex(p, CONTACT_RECORD_CONSTRAINT_C0_OFFSET);
    const shadowBase = contactRecordVec4FloatIndex(p, CONTACT_RECORD_SHADOW_OFFSET);
    const dualBase = contactRecordVec4FloatIndex(p, CONTACT_RECORD_DUAL_OFFSET);
    const penaltyBase = contactRecordVec4FloatIndex(p, CONTACT_RECORD_PENALTY_OFFSET);
    const cacheBase = contactRecordVec4FloatIndex(p, CONTACT_RECORD_CACHE_OFFSET);

    meta.set(pairContacts.subarray(metaBase, metaBase + 4), p * 4);
    metaWords[p * 4 + 3] = pairContactWords[metaBase + 3] ?? 0;
    normalPen.set(pairContacts.subarray(normalBase, normalBase + 4), p * 4);
    arms.set(pairContacts.subarray(armABase, armABase + 4), p * 8);
    arms.set(pairContacts.subarray(armBBase, armBBase + 4), p * 8 + 4);
    armWords[p * 8 + 3] = pairContactWords[armABase + 3] ?? 0;
    armWords[p * 8 + 7] = pairContactWords[armBBase + 3] ?? 0;
    constraintC0.set(pairContacts.subarray(c0Base, c0Base + 4), p * 4);
    pairLambdas.set(pairContacts.subarray(shadowBase, shadowBase + 4), p * 4);
    dual.set(pairContacts.subarray(dualBase, dualBase + 4), p * 8);
    dual.set(pairContacts.subarray(penaltyBase, penaltyBase + 4), p * 8 + 4);
    cacheWords[p] = pairContactWords[cacheBase] ?? 0;
  }

  return {
    meta,
    metaWords,
    cacheWords,
    normalPen,
    arms,
    armWords,
    constraintC0,
    pairLambdas,
    dual,
    pairContacts,
    pairContactWords,
  };
}

type AvbdPrimalSolveTuning = {
  relaxation?: number;
  frictionRelaxation?: number;
  inertialDiagWeight?: number;
  maxLinearCorrection?: number;
  maxAngularCorrection?: number;
};

export type DebugContactPoint = {
  x: number;
  y: number;
  z: number;
};

export type RigidBodyReadbackState = {
  body: number;
  position: [number, number, number];
  initialPosition: [number, number, number];
  quaternion: [number, number, number, number];
  velocity: [number, number, number];
  angularVelocity: [number, number, number];
  inverseMass: number;
};

export type JointReadbackState = {
  joint: number;
  bodyA: number | null;
  bodyB: number;
  type: 'spherical' | 'fixed';
  anchorA: [number, number, number];
  anchorB: [number, number, number];
  torqueArm: number;
  restRelative: [number, number, number, number];
  stiffnessLin: number;
  stiffnessAng: number;
  c0Lin: [number, number, number];
  c0Ang: [number, number, number];
  lambdaLin: [number, number, number];
  lambdaAng: [number, number, number];
  penaltyLin: [number, number, number];
  penaltyAng: [number, number, number];
};

export type ContactRenderBuffers = {
  positions: StorageBufferAttribute;
  quaternions: StorageBufferAttribute;
  pairContacts: StorageBufferAttribute;
  pairActivity: StorageBufferAttribute;
  maxPairContacts: number;
  maxActivePairContacts: number;
  pairActivityWordCount: number;
  pairActiveContactsOffset: number;
};

export type SpringRenderBuffers = {
  positions: StorageBufferAttribute;
  quaternions: StorageBufferAttribute;
  springRecords: StorageBufferAttribute;
  maxSprings: number;
};

export class PhysicsEngine {
  readonly config: PhysicsConfig;
  readonly device: GPUDevice;

  private bodyCount = 0;
  private accumulator = 0;
  private initialized = false;
  private readonly maxPairs: number;
  private readonly maxCandidatePairs: number;
  private readonly maxPairContacts: number;
  private readonly pairManifoldSlots: number;
  private readonly maxPairsPerBodyBroadphase: number;
  private readonly maxContactsPerBodySolver: number;
  private readonly maxJoints: number;
  private readonly maxJointsPerBodySolver: number;
  private readonly maxSprings: number;
  private readonly maxSpringsPerBodySolver: number;
  private readonly maxConstraintsPerBodySolver: number;
  private readonly bruteForceMaxBodies: number;
  private readonly maxActivePairContacts: number;
  private readonly haltOnBroadphaseFallbackOverflow: boolean;
  private maxFixedStepsPerFrame: number;
  private readonly enableBvhBuild: boolean;
  private readonly bvhBuildOnce: boolean;
  private readonly bvhRebuildIntervalFrames: number;
  private readonly bvhWaitForGpuCompletion: boolean;
  private avbdPairSweeps: number;
  private solverIterations: number;
  private readonly maxPairSolveColorCount: number;
  private activePairSolveColorCount: number;
  private avbdFrictionStatic: number;
  private avbdDualUpdateBeta: number;
  private avbdRegularizationAlpha: number;
  private avbdPenaltyDecayGamma: number;
  private avbdBodySolveMode: AvbdBodySolveMode = 'colored';
  private avbdPreventPenetratingNormalDropout = false;
  private avbdPenaltyFloor = AVBD_K_START;
  private jointCount = 0;
  private springCount = 0;

  // CPU-side body data arrays (SoA, vec4f per body)
  private positionsData: Float32Array;      // (x, y, z, inverseMass)
  private initialPoseData: Float32Array;    // [initial position vec4, initial quaternion vec4] per body
  private initialLinearVelData: Float32Array; // initial linear velocity vec4 per body
  private initialAngularVelData: Float32Array; // initial angular velocity vec4 per body
  private inertialPoseData: Float32Array;   // [inertial pose, current solve pose] as 4 vec4s per body
  private velocitiesData: Float32Array;     // (vx, vy, vz, 0)
  private prevLinearVelData: Float32Array;  // previous-step linear velocity for adaptive warmstart
  private shapesData: Float32Array;         // (packed friction/group/mask/type, sizeX, sizeY, sizeZ)
  private shapesWordData: Uint32Array;
  private quaternionsData: Float32Array;    // (qx, qy, qz, qw)
  private angularVelData: Float32Array;     // (wx, wy, wz, 0)
  private inverseInertiaData: Float32Array; // (Ixx⁻¹, Iyy⁻¹, Izz⁻¹, 0)
  private derivedInvInertiaData: Float32Array; // 3x vec4 per body: symmetric world inv inertia + local diagonal inv inertia + inverse mass

  // Packed pair contact buffer (contact + cache object in one physical store).
  /**
   * Bumped whenever the CPU mirror is rewritten wholesale, so a pose readback that was already in
   * flight can tell that its snapshot is stale and drop it.
   */
  private poseEpoch = 0;
  private pairContactsData: Float32Array;
  private jointRecordsData: Float32Array;
  private springRecordsData: Float32Array;
  private pairActivityData: Uint32Array;
  private readonly pairCandidateIndicesOffset: number;
  private readonly pairActiveCandidateSlotsOffset: number;
  private readonly pairActiveContactsOffset: number;
  private readonly pairIgnoredBitsOffset: number;
  private readonly pairActivityWordCount: number;
  private pairCandidateIndicesData: Uint32Array; // [count, packedPair0, packedPair1, ...] (a | (b << 16))
  private pairVisitedBitsData: Uint32Array; // bitset over pair indices
  private pairBodyContactCountsData: Uint32Array;  // contacts per body
  private pairBodyContactIndicesData: Uint32Array; // flat contact list indices
  private bodyConstraintCountsData: Uint32Array;   // generic solver constraint count per body
  private bodyConstraintRefsData: Uint32Array;     // tagged contact/joint/spring refs per body
  private pairActiveCandidateSlotsData: Uint32Array; // [count, candidateSlot0, ...]
  private pairActiveContactsData: Uint32Array;       // [count, contactIdx0, contactIdx1, ...]
  private pairIgnoredBitsData: Uint32Array;          // pair-index bitset for collision filtering
  private pairColorBodyClaimsData: Uint32Array;    // temporary body claims for coloring

  // GPU storage buffers
  private positionsAttr!: StorageBufferAttribute;
  private initialPoseAttr!: StorageBufferAttribute;
  private inertialPoseAttr!: StorageBufferAttribute;
  private velocitiesAttr!: StorageBufferAttribute;
  private prevLinearVelAttr!: StorageBufferAttribute;
  private shapesAttr!: StorageBufferAttribute;
  private quaternionsAttr!: StorageBufferAttribute;
  private angularVelAttr!: StorageBufferAttribute;
  private inverseInertiaAttr!: StorageBufferAttribute;
  private derivedInvInertiaAttr!: StorageBufferAttribute;

  private pairContactsAttr!: StorageBufferAttribute;
  private jointRecordsAttr!: StorageBufferAttribute;
  private springRecordsAttr!: StorageBufferAttribute;
  private pairActivityAttr!: StorageBufferAttribute;
  private pairCandidateIndicesAttr!: StorageBufferAttribute;
  private pairVisitedBitsAttr!: StorageBufferAttribute;
  private pairBodyContactCountsAttr!: StorageBufferAttribute;
  private pairBodyContactIndicesAttr!: StorageBufferAttribute;
  private bodyConstraintCountsAttr!: StorageBufferAttribute;
  private bodyConstraintRefsAttr!: StorageBufferAttribute;
  private pairActiveCandidateSlotsAttr!: StorageBufferAttribute;
  private pairActiveContactsAttr!: StorageBufferAttribute;
  private pairColorBodyClaimsAttr!: StorageBufferAttribute;

  // Pipeline stages
  private integration!: IntegrationStage;
  private broadPhase!: BroadPhaseStage;
  private derivedInertia!: DerivedInertiaStage;
  private contactGeneration!: ContactGenerationStage;
  private avbdState!: AvbdStateStage;
  private playerControl?: PlayerControlStage;
  private pairDispatchTruncationWarned = false;
  private waitingForInitialCandidatePairs = true;
  private frameId = 0;
  private debugBehaviorEnabled = false;
  private debugLogEveryNFrames = 30;
  private supportDebugReadbackInFlight = false;
  private lastSupportDebugLogFrame = -1;
  private supportDebugEveryNFrames = 30;
  private prevSupportBodyCount = -1;
  private prevCandidatePairsForChurn: Set<number> | null = null;
  private prevFloorCandidatePairsForChurn: Set<number> | null = null;

  stats: PhysicsStats = {
    bodyCount: 0,
    frameCount: 0,
    totalMs: 0,
    integrationMs: 0,
    broadPhaseMs: 0,
    solverMs: 0,
    velocityUpdateMs: 0,
    broadPhaseReady: false,
    candidatePairsEnabled: false,
    pairDispatchTruncated: false,
  };

  constructor(device: GPUDevice, config: PhysicsConfig) {
    this.device = device;
    this.config = config;
    this.solverIterations = config.solverIterations ?? 8;
    this.maxPairSolveColorCount = Math.max(1, Math.floor(config.pairSolveColorCount ?? 64));
    this.activePairSolveColorCount = Math.min(this.maxPairSolveColorCount, 8);
    this.maxPairsPerBodyBroadphase = Math.max(1, Math.floor(config.maxPairsPerBodyBroadphase ?? 64));
    this.maxContactsPerBodySolver = Math.max(1, Math.floor(config.maxContactsPerBodySolver ?? 128));
    this.maxJointsPerBodySolver = DEFAULT_MAX_JOINTS_PER_BODY_SOLVER;
    this.maxSpringsPerBodySolver = Math.max(
      1,
      Math.floor(config.maxSpringsPerBodySolver ?? DEFAULT_MAX_SPRINGS_PER_BODY_SOLVER),
    );
    this.maxConstraintsPerBodySolver = (
      this.maxContactsPerBodySolver
      + this.maxJointsPerBodySolver
      + this.maxSpringsPerBodySolver
    );
    this.haltOnBroadphaseFallbackOverflow = config.haltOnBroadphaseFallbackOverflow ?? true;
    this.maxFixedStepsPerFrame = Math.max(1, Math.floor(config.maxFixedStepsPerFrame ?? 2));
    this.enableBvhBuild = config.enableBvhBuild ?? true;
    this.bvhBuildOnce = config.bvhBuildOnce ?? false;
    this.bvhRebuildIntervalFrames = Math.max(1, Math.floor(config.bvhRebuildIntervalFrames ?? 1));
    this.bvhWaitForGpuCompletion = config.bvhWaitForGpuCompletion ?? false;
    this.avbdPairSweeps = Math.max(1, Math.min(4, Math.floor(config.avbdPairSweeps ?? 2)));
    this.avbdFrictionStatic = Math.max(0.0, config.avbdFriction ?? AVBD_FRICTION_STATIC);
    this.avbdDualUpdateBeta = Math.max(0.0, config.avbdDualUpdateBeta ?? 10000.0);
    this.avbdRegularizationAlpha = Math.max(0.0, Math.min(1.0, config.avbdRegularizationAlpha ?? AVBD_REGULARIZATION_ALPHA));
    this.avbdPenaltyDecayGamma = Math.max(0.0, Math.min(1.0, config.avbdPenaltyDecayGamma ?? 0.99));
    this.avbdBodySolveMode = config.avbdBodySolveMode ?? 'colored';

    const n = config.maxBodies;
    if (n > 65536) {
      throw new Error('maxBodies > 65536 is not supported by packed candidate-pair encoding.');
    }
    this.pairManifoldSlots = Math.max(1, Math.min(8, Math.floor(config.pairManifoldSlots ?? 4)));
    const candidateWorkgroupSize = 64;
    const maxWorkgroupsPerDim = Math.max(1, Number(device.limits.maxComputeWorkgroupsPerDimension ?? 65535));
    const maxVisitedWordsPerDispatch = maxWorkgroupsPerDim * candidateWorkgroupSize;
    this.maxPairs = (n * (n - 1)) / 2;
    this.maxActivePairContacts = n * this.maxContactsPerBodySolver;
    // Keep sparse pair storage with a fixed per-body budget. The broadphase
    // candidate buffer is laid out as body-major fixed slots, so capacity must
    // cover all body buckets (not triangular pairCount for small N).
    const maxStoredPairSlots = n * this.maxPairsPerBodyBroadphase;
    this.maxCandidatePairs = maxStoredPairSlots;
    this.maxPairContacts = maxStoredPairSlots * this.pairManifoldSlots;
    this.maxJoints = n * this.maxJointsPerBodySolver;
    this.maxSprings = n * this.maxSpringsPerBodySolver;
    this.bruteForceMaxBodies = Math.floor((1 + Math.sqrt(1 + 8 * this.maxCandidatePairs)) * 0.5);
    const candidateListWords = this.maxCandidatePairs + CANDIDATE_LIST_HEADER_WORDS;
    const activeContactsWords = this.maxActivePairContacts + CANDIDATE_LIST_HEADER_WORDS;
    const ignoredPairWords = Math.ceil(this.maxPairs / 32);
    this.pairCandidateIndicesOffset = 0;
    this.pairActiveCandidateSlotsOffset = this.pairCandidateIndicesOffset + candidateListWords;
    this.pairActiveContactsOffset = this.pairActiveCandidateSlotsOffset + candidateListWords;
    this.pairIgnoredBitsOffset = this.pairActiveContactsOffset + activeContactsWords;
    this.pairActivityWordCount = this.pairIgnoredBitsOffset + ignoredPairWords;

    this.positionsData = new Float32Array(n * 4);
    this.initialPoseData = new Float32Array(n * 8);
    this.initialLinearVelData = new Float32Array(n * 4);
    this.initialAngularVelData = new Float32Array(n * 4);
    this.inertialPoseData = new Float32Array(n * INERTIAL_POSE_FLOATS_PER_BODY);
    this.velocitiesData = new Float32Array(n * 4);
    this.prevLinearVelData = new Float32Array(n * 4);
    this.shapesData = new Float32Array(n * 4);
    this.shapesWordData = new Uint32Array(this.shapesData.buffer);
    this.quaternionsData = new Float32Array(n * 4);
    this.angularVelData = new Float32Array(n * 4);
    this.inverseInertiaData = new Float32Array(n * 4);
    this.derivedInvInertiaData = new Float32Array(n * 12);

    this.pairContactsData = new Float32Array(this.maxPairContacts * CONTACT_RECORD_FLOATS);
    this.jointRecordsData = new Float32Array(this.maxJoints * JOINT_RECORD_FLOATS);
    this.springRecordsData = new Float32Array(this.maxSprings * SPRING_RECORD_FLOATS);
    this.pairActivityData = new Uint32Array(this.pairActivityWordCount);
    this.pairCandidateIndicesData = this.pairActivityData.subarray(
      this.pairCandidateIndicesOffset,
      this.pairCandidateIndicesOffset + candidateListWords,
    );
    // Visited-bit dedup only needs as many words as we can clear/dispatch in one
    // broadphase pass. Capping avoids huge allocations at high maxBodies.
    this.pairVisitedBitsData = new Uint32Array(
      Math.min(Math.ceil(this.maxPairs / 32), maxVisitedWordsPerDispatch),
    );
    this.pairBodyContactCountsData = new Uint32Array(n);
    this.pairBodyContactIndicesData = new Uint32Array(n * this.maxContactsPerBodySolver);
    this.bodyConstraintCountsData = new Uint32Array(n);
    this.bodyConstraintRefsData = new Uint32Array(n * this.maxConstraintsPerBodySolver);
    this.pairActiveCandidateSlotsData = this.pairActivityData.subarray(
      this.pairActiveCandidateSlotsOffset,
      this.pairActiveCandidateSlotsOffset + candidateListWords,
    );
    this.pairActiveContactsData = this.pairActivityData.subarray(
      this.pairActiveContactsOffset,
      this.pairActiveContactsOffset + activeContactsWords,
    );
    this.pairIgnoredBitsData = this.pairActivityData.subarray(
      this.pairIgnoredBitsOffset,
      this.pairIgnoredBitsOffset + ignoredPairWords,
    );
    this.pairColorBodyClaimsData = new Uint32Array(n);

    this.initPairTable();
  }

  private initPairTable(): void {
    // Sparse pair-contact buffers start empty; contact generation fills body ids.
    this.pairContactsData.fill(0);
    this.jointRecordsData.fill(0);
    this.springRecordsData.fill(0);
  }

  addBody(desc: RigidBodyDesc): number {
    if (this.bodyCount >= this.config.maxBodies) {
      throw new Error(`Exceeded maxBodies=${this.config.maxBodies}`);
    }

    const i = this.bodyCount++;
    const invMass = desc.mass > 0 ? 1.0 / desc.mass : 0;

    this.positionsData[i * 4 + 0] = desc.position[0];
    this.positionsData[i * 4 + 1] = desc.position[1];
    this.positionsData[i * 4 + 2] = desc.position[2];
    this.positionsData[i * 4 + 3] = invMass;
    this.initialPoseData[i * 8 + 0] = desc.position[0];
    this.initialPoseData[i * 8 + 1] = desc.position[1];
    this.initialPoseData[i * 8 + 2] = desc.position[2];
    this.initialPoseData[i * 8 + 3] = invMass;

    const inertialBase = i * INERTIAL_POSE_FLOATS_PER_BODY;
    this.inertialPoseData[inertialBase + 0] = desc.position[0];
    this.inertialPoseData[inertialBase + 1] = desc.position[1];
    this.inertialPoseData[inertialBase + 2] = desc.position[2];
    this.inertialPoseData[inertialBase + 3] = invMass;

    if (desc.linearVelocity) {
      this.velocitiesData[i * 4 + 0] = desc.linearVelocity[0];
      this.velocitiesData[i * 4 + 1] = desc.linearVelocity[1];
      this.velocitiesData[i * 4 + 2] = desc.linearVelocity[2];
      this.prevLinearVelData[i * 4 + 0] = desc.linearVelocity[0];
      this.prevLinearVelData[i * 4 + 1] = desc.linearVelocity[1];
      this.prevLinearVelData[i * 4 + 2] = desc.linearVelocity[2];
      this.initialLinearVelData[i * 4 + 0] = desc.linearVelocity[0];
      this.initialLinearVelData[i * 4 + 1] = desc.linearVelocity[1];
      this.initialLinearVelData[i * 4 + 2] = desc.linearVelocity[2];
    }

    const shapeType = desc.shapeType === 'sphere' ? SHAPE_TYPE_SPHERE : SHAPE_TYPE_BOX;
    const halfExtents = desc.shapeType === 'sphere'
      ? [desc.radius, desc.radius, desc.radius] as const
      : desc.halfExtents;

    this.shapesWordData[i * 4 + 0] = packShapeMetaWord(
      clampShapeFriction(desc.friction ?? 1.0),
      clampCollisionFilterWord(desc.collisionGroup ?? DEFAULT_COLLISION_GROUP, DEFAULT_COLLISION_GROUP),
      clampCollisionFilterWord(desc.collisionMask ?? DEFAULT_COLLISION_MASK, DEFAULT_COLLISION_MASK),
      shapeType,
    );
    this.shapesData[i * 4 + 1] = halfExtents[0];
    this.shapesData[i * 4 + 2] = halfExtents[1];
    this.shapesData[i * 4 + 3] = halfExtents[2];

    const q = desc.quaternion ?? [0, 0, 0, 1];
    this.quaternionsData[i * 4 + 0] = q[0];
    this.quaternionsData[i * 4 + 1] = q[1];
    this.quaternionsData[i * 4 + 2] = q[2];
    this.quaternionsData[i * 4 + 3] = q[3];
    this.initialPoseData[i * 8 + 4] = q[0];
    this.initialPoseData[i * 8 + 5] = q[1];
    this.initialPoseData[i * 8 + 6] = q[2];
    this.initialPoseData[i * 8 + 7] = q[3];

    this.inertialPoseData[inertialBase + 4] = q[0];
    this.inertialPoseData[inertialBase + 5] = q[1];
    this.inertialPoseData[inertialBase + 6] = q[2];
    this.inertialPoseData[inertialBase + 7] = q[3];
    this.inertialPoseData[inertialBase + 8] = desc.position[0];
    this.inertialPoseData[inertialBase + 9] = desc.position[1];
    this.inertialPoseData[inertialBase + 10] = desc.position[2];
    this.inertialPoseData[inertialBase + 11] = invMass;
    this.inertialPoseData[inertialBase + 12] = q[0];
    this.inertialPoseData[inertialBase + 13] = q[1];
    this.inertialPoseData[inertialBase + 14] = q[2];
    this.inertialPoseData[inertialBase + 15] = q[3];

    if (desc.angularVelocity) {
      this.angularVelData[i * 4 + 0] = desc.angularVelocity[0];
      this.angularVelData[i * 4 + 1] = desc.angularVelocity[1];
      this.angularVelData[i * 4 + 2] = desc.angularVelocity[2];
      this.initialAngularVelData[i * 4 + 0] = desc.angularVelocity[0];
      this.initialAngularVelData[i * 4 + 1] = desc.angularVelocity[1];
      this.initialAngularVelData[i * 4 + 2] = desc.angularVelocity[2];
    }

    // Keep inverse mass in inverseInertia.w so solver kernels don't need positions.
    this.inverseInertiaData[i * 4 + 3] = invMass;

    if (desc.mass > 0) {
      if (desc.lockRotation) {
        this.inverseInertiaData[i * 4 + 0] = 0;
        this.inverseInertiaData[i * 4 + 1] = 0;
        this.inverseInertiaData[i * 4 + 2] = 0;
      } else {
        const m = desc.mass;
        let ixx = 0.0;
        let iyy = 0.0;
        let izz = 0.0;
        if (desc.shapeType === 'sphere') {
          const sphereInertia = 0.4 * m * desc.radius * desc.radius;
          ixx = sphereInertia;
          iyy = sphereInertia;
          izz = sphereInertia;
        } else {
          const [hx, hy, hz] = desc.halfExtents;
          ixx = (m / 3) * (hy * hy + hz * hz);
          iyy = (m / 3) * (hx * hx + hz * hz);
          izz = (m / 3) * (hx * hx + hy * hy);
        }
        this.inverseInertiaData[i * 4 + 0] = 1.0 / ixx;
        this.inverseInertiaData[i * 4 + 1] = 1.0 / iyy;
        this.inverseInertiaData[i * 4 + 2] = 1.0 / izz;
      }
    }

    // Support runtime spawning after GPU init.
    if (this.initialized) {
      const vec4Start = i * 4;
      const vec4Count = 4;
      const initialPoseStart = i * 8;
      const initialPoseCount = 8;
      const inertialPoseStart = i * INERTIAL_POSE_FLOATS_PER_BODY;
      const inertialPoseCount = INERTIAL_POSE_FLOATS_PER_BODY;

      this.positionsAttr.addUpdateRange(vec4Start, vec4Count);
      this.initialPoseAttr.addUpdateRange(initialPoseStart, initialPoseCount);
      this.inertialPoseAttr.addUpdateRange(inertialPoseStart, inertialPoseCount);
      this.velocitiesAttr.addUpdateRange(vec4Start, vec4Count);
      this.prevLinearVelAttr.addUpdateRange(vec4Start, vec4Count);
      this.shapesAttr.addUpdateRange(vec4Start, vec4Count);
      this.quaternionsAttr.addUpdateRange(vec4Start, vec4Count);
      this.angularVelAttr.addUpdateRange(vec4Start, vec4Count);
      this.inverseInertiaAttr.addUpdateRange(vec4Start, vec4Count);

      this.positionsAttr.needsUpdate = true;
      this.initialPoseAttr.needsUpdate = true;
      this.inertialPoseAttr.needsUpdate = true;
      this.velocitiesAttr.needsUpdate = true;
      this.prevLinearVelAttr.needsUpdate = true;
      this.shapesAttr.needsUpdate = true;
      this.quaternionsAttr.needsUpdate = true;
      this.angularVelAttr.needsUpdate = true;
      this.inverseInertiaAttr.needsUpdate = true;
    }

    this.waitingForInitialCandidatePairs = this.enableBvhBuild && this.bodyCount > this.bruteForceMaxBodies;

    return i;
  }

  private getBodyQuaternion(body: number): [number, number, number, number] {
    return normalizeQuat([
      this.quaternionsData[body * 4 + 0] ?? 0.0,
      this.quaternionsData[body * 4 + 1] ?? 0.0,
      this.quaternionsData[body * 4 + 2] ?? 0.0,
      this.quaternionsData[body * 4 + 3] ?? 1.0,
    ]);
  }

  private getBodySize(body: number): [number, number, number] {
    return [
      (this.shapesData[body * 4 + 1] ?? 0.0) * 2.0,
      (this.shapesData[body * 4 + 2] ?? 0.0) * 2.0,
      (this.shapesData[body * 4 + 3] ?? 0.0) * 2.0,
    ];
  }

  private getBodyPosition(body: number): [number, number, number] {
    return [
      this.positionsData[body * 4 + 0] ?? 0.0,
      this.positionsData[body * 4 + 1] ?? 0.0,
      this.positionsData[body * 4 + 2] ?? 0.0,
    ];
  }

  getBodyPoseCpu(body: number): {
    position: [number, number, number];
    quaternion: [number, number, number, number];
    halfExtents: [number, number, number];
  } | null {
    if (body < 0 || body >= this.bodyCount) return null;
    return {
      position: this.getBodyPosition(body),
      quaternion: this.getBodyQuaternion(body),
      halfExtents: [
        this.shapesData[body * 4 + 1] ?? 0.0,
        this.shapesData[body * 4 + 2] ?? 0.0,
        this.shapesData[body * 4 + 3] ?? 0.0,
      ],
    };
  }

  getBodyShapeType(body: number): 'box' | 'sphere' | null {
    if (body < 0 || body >= this.bodyCount) return null;
    return decodeShapeTypeWord(this.shapesWordData[body * 4] ?? 0) === SHAPE_TYPE_SPHERE
      ? 'sphere'
      : 'box';
  }

  /**
   * Pull latest GPU positions/quaternions into the CPU mirror (for picking).
   * Shapes stay on CPU (authored once).
   */
  async syncPosesFromGpuAsync(renderer: { getArrayBufferAsync?: (attr: unknown) => Promise<ArrayBuffer> }): Promise<boolean> {
    if (!this.initialized) return false;
    if (!renderer || typeof renderer.getArrayBufferAsync !== 'function') return false;
    const epoch = this.poseEpoch;
    let positionsRaw: ArrayBuffer;
    let quaternionsRaw: ArrayBuffer;
    try {
      positionsRaw = await renderer.getArrayBufferAsync(this.positionsAttr);
      quaternionsRaw = await renderer.getArrayBufferAsync(this.quaternionsAttr);
    } catch {
      return false;
    }
    // A reset landed while this was in flight. The mirror is now the authoritative copy and is
    // waiting to be uploaded, so writing this snapshot over it would upload the pre-reset poses
    // and quietly undo the reset.
    if (epoch !== this.poseEpoch) return false;
    this.positionsData.set(new Float32Array(positionsRaw));
    this.quaternionsData.set(new Float32Array(quaternionsRaw));
    return true;
  }

  /**
   * Debug snapshot of one body's solver-internal GPU state. Distinguishes "integration never ran"
   * (inertial target still equals the authored pose) from "solve chain dead" (solve pose untouched)
   * from "derived inertia broken" (invMass not positive, which the body solve treats as static).
   */
  async readBodySolverStateAsync(renderer: any, body: number): Promise<string | null> {
    if (!this.initialized || body < 0 || body >= this.bodyCount) return null;
    if (!renderer || typeof renderer.getArrayBufferAsync !== 'function') return null;
    let inertialRaw: ArrayBuffer;
    let velRaw: ArrayBuffer;
    let inertiaRaw: ArrayBuffer;
    let countsRaw: ArrayBuffer;
    try {
      [inertialRaw, velRaw, inertiaRaw, countsRaw] = await Promise.all([
        renderer.getArrayBufferAsync(this.inertialPoseAttr),
        renderer.getArrayBufferAsync(this.velocitiesAttr),
        renderer.getArrayBufferAsync(this.derivedInvInertiaAttr),
        renderer.getArrayBufferAsync(this.bodyConstraintCountsAttr),
      ]);
    } catch (error) {
      return `solver state readback failed: ${error instanceof Error ? error.message : String(error)}`;
    }
    const inertial = new Float32Array(inertialRaw);
    const vel = new Float32Array(velRaw);
    const inertia = new Float32Array(inertiaRaw);
    const counts = new Uint32Array(countsRaw);
    const ib = body * INERTIAL_POSE_FLOATS_PER_BODY;
    const db = body * 12;
    const countWord = counts[body] ?? 0;
    const v3 = (a: Float32Array, o: number) => `[${a[o]}, ${a[o + 1]}, ${a[o + 2]}]`;
    const v4 = (a: Float32Array, o: number) => `[${a[o]}, ${a[o + 1]}, ${a[o + 2]}, ${a[o + 3]}]`;
    return (
      `body ${body}: inertialPos=${v3(inertial, ib)} inertialQ=${v4(inertial, ib + 4)} `
      + `solvePos=${v3(inertial, ib + 8)} solveQ=${v4(inertial, ib + 12)} `
      + `vel=${v3(vel, body * 4)} invMass=${inertia[db + 3]} `
      + `localInvI=[${inertia[db + 6]}, ${inertia[db + 7]}, ${inertia[db + 9]}] `
      + `constraints=${countWord & 0xffff} color=${(countWord >> 16) & 0xff}`
    );
  }

  /**
   * Debug summary of the active contact list, plus samples involving one body. Garbage here
   * (non-finite normals, absurd penetrations, a corner box touching dozens of partners) convicts
   * broadphase/contact generation; clean records shift blame to the solver.
   */
  async readContactDiagnosticsAsync(renderer: any, body: number, maxSamples = 8): Promise<string | null> {
    if (!this.initialized) return null;
    if (!renderer || typeof renderer.getArrayBufferAsync !== 'function') return null;
    let activityRaw: ArrayBuffer;
    let contactsRaw: ArrayBuffer;
    try {
      [activityRaw, contactsRaw] = await Promise.all([
        renderer.getArrayBufferAsync(this.pairActivityAttr),
        renderer.getArrayBufferAsync(this.pairContactsAttr),
      ]);
    } catch (error) {
      return `contact readback failed: ${error instanceof Error ? error.message : String(error)}`;
    }
    const activity = new Uint32Array(activityRaw);
    const contacts = new Float32Array(contactsRaw);
    const listBase = this.pairActiveContactsOffset;
    const activeCount = Math.min(activity[listBase] ?? 0, this.maxActivePairContacts);
    let valid = 0;
    let involvingBody = 0;
    let nonFiniteNormals = 0;
    let minPen = Infinity;
    let maxPen = -Infinity;
    const samples: string[] = [];
    for (let k = 0; k < activeCount; k++) {
      const p = activity[listBase + k + 1] ?? this.maxPairContacts;
      if (p >= this.maxPairContacts) continue;
      const base = p * CONTACT_RECORD_FLOATS;
      if ((contacts[base + 2] ?? 0) < 0.5) continue;
      valid++;
      const i = Math.round(contacts[base] ?? -1);
      const j = Math.round(contacts[base + 1] ?? -1);
      const nx = contacts[base + 4] ?? 0;
      const ny = contacts[base + 5] ?? 0;
      const nz = contacts[base + 6] ?? 0;
      const pen = contacts[base + 7] ?? 0;
      if (!Number.isFinite(nx) || !Number.isFinite(ny) || !Number.isFinite(nz) || !Number.isFinite(pen)) {
        nonFiniteNormals++;
      } else {
        minPen = Math.min(minPen, pen);
        maxPen = Math.max(maxPen, pen);
      }
      if (i !== body && j !== body) continue;
      involvingBody++;
      if (samples.length < maxSamples) {
        samples.push(`{${i}-${j} n=[${nx}, ${ny}, ${nz}] pen=${pen}}`);
      }
    }
    return (
      `contacts: active=${activeCount} valid=${valid} nonFiniteN=${nonFiniteNormals} `
      + `pen=[${minPen}, ${maxPen}] involving body ${body}: ${involvingBody}\n`
      + samples.join(' ')
    );
  }

  /**
   * Raycast dynamic bodies (inverseMass > 0). Boxes use OBB; spheres use sphere test.
   * Matches Utah avbd-demo3d Solver::pick.
   */
  pickDynamicBody(
    origin: [number, number, number],
    dir: [number, number, number],
    options?: { skip?: (body: number) => boolean },
  ): {
    body: number;
    localHit: [number, number, number];
    worldHit: [number, number, number];
    t: number;
  } | null {
    const skip = options?.skip;
    const epsilon = 1e-6;
    let bestT = Infinity;
    let bestBody = -1;
    let bestLocal: [number, number, number] = [0, 0, 0];

    const dirLen = Math.hypot(dir[0], dir[1], dir[2]);
    if (dirLen < epsilon) return null;
    const dWorld: [number, number, number] = [dir[0] / dirLen, dir[1] / dirLen, dir[2] / dirLen];

    for (let body = 0; body < this.bodyCount; body++) {
      const invMass = this.positionsData[body * 4 + 3] ?? 0;
      if (invMass <= 0) continue;
      if (skip?.(body)) continue;

      const pos = this.getBodyPosition(body);
      const quat = this.getBodyQuaternion(body);
      const invQuat = conjugateQuat(quat);
      const oLocal = rotateVector(invQuat, [origin[0] - pos[0], origin[1] - pos[1], origin[2] - pos[2]]);
      const dLocal = rotateVector(invQuat, dWorld);

      const shapeType = decodeShapeTypeWord(this.shapesWordData[body * 4] ?? 0);
      const hx = this.shapesData[body * 4 + 1] ?? 0;
      const hy = this.shapesData[body * 4 + 2] ?? 0;
      const hz = this.shapesData[body * 4 + 3] ?? 0;

      let tHit = -1;
      let localHit: [number, number, number] | null = null;

      if (shapeType === SHAPE_TYPE_SPHERE) {
        const r = hx;
        const b = oLocal[0] * dLocal[0] + oLocal[1] * dLocal[1] + oLocal[2] * dLocal[2];
        const c = oLocal[0] * oLocal[0] + oLocal[1] * oLocal[1] + oLocal[2] * oLocal[2] - r * r;
        const disc = b * b - c;
        if (disc >= 0) {
          const s = Math.sqrt(disc);
          const t0 = -b - s;
          const t1 = -b + s;
          tHit = t0 >= 0 ? t0 : t1;
          if (tHit >= 0) {
            localHit = [
              oLocal[0] + dLocal[0] * tHit,
              oLocal[1] + dLocal[1] * tHit,
              oLocal[2] + dLocal[2] * tHit,
            ];
          }
        }
      } else {
        const half: [number, number, number] = [hx, hy, hz];
        let tEnter = 0;
        let tExit = Infinity;
        let hit = true;
        for (let i = 0; i < 3; i++) {
          const oi = oLocal[i]!;
          const di = dLocal[i]!;
          const h = half[i]!;
          if (Math.abs(di) < epsilon) {
            if (oi < -h || oi > h) {
              hit = false;
              break;
            }
            continue;
          }
          const invD = 1 / di;
          let t0 = (-h - oi) * invD;
          let t1 = (h - oi) * invD;
          if (t0 > t1) {
            const tmp = t0;
            t0 = t1;
            t1 = tmp;
          }
          tEnter = Math.max(tEnter, t0);
          tExit = Math.min(tExit, t1);
          if (tEnter > tExit) {
            hit = false;
            break;
          }
        }
        if (hit) {
          tHit = tEnter >= 0 ? tEnter : tExit;
          if (tHit >= 0) {
            localHit = [
              oLocal[0] + dLocal[0] * tHit,
              oLocal[1] + dLocal[1] * tHit,
              oLocal[2] + dLocal[2] * tHit,
            ];
          }
        }
      }

      if (tHit < 0 || !localHit || tHit >= bestT) continue;
      bestT = tHit;
      bestBody = body;
      bestLocal = localHit;
    }

    if (bestBody < 0) return null;
    const worldOffset = rotateVector(this.getBodyQuaternion(bestBody), bestLocal);
    const pos = this.getBodyPosition(bestBody);
    return {
      body: bestBody,
      localHit: bestLocal,
      worldHit: [pos[0] + worldOffset[0], pos[1] + worldOffset[1], pos[2] + worldOffset[2]],
      t: bestT,
    };
  }

  /** Move world-space anchorA of a spherical/fixed joint (bodyA = world). */
  setJointAnchorA(jointIndex: number, anchorA: [number, number, number]): boolean {
    if (jointIndex < 0 || jointIndex >= this.jointCount) return false;
    const base = jointRecordVec4FloatIndex(jointIndex, JOINT_RECORD_ANCHOR_A_OFFSET);
    this.jointRecordsData[base + 0] = anchorA[0];
    this.jointRecordsData[base + 1] = anchorA[1];
    this.jointRecordsData[base + 2] = anchorA[2];
    if (this.initialized) {
      this.jointRecordsAttr.addUpdateRange(base, 3);
      this.jointRecordsAttr.needsUpdate = true;
    }
    return true;
  }

  disableJoint(jointIndex: number): boolean {
    return this.setJointEnabled(jointIndex, false);
  }

  setJointEnabled(jointIndex: number, enabled: boolean): boolean {
    if (jointIndex < 0 || jointIndex >= this.jointCount) return false;
    const metaBase = jointRecordVec4FloatIndex(jointIndex, JOINT_RECORD_META_OFFSET);
    const metaWords = new Uint32Array(this.jointRecordsData.buffer, metaBase * 4, 4);
    const target = enabled ? 1 : 0;
    if (metaWords[3] === target) return false;
    metaWords[3] = target;
    if (this.initialized) {
      const vec4Start = jointIndex * JOINT_RECORD_VEC4S * 4;
      this.jointRecordsAttr.addUpdateRange(vec4Start, JOINT_RECORD_VEC4S * 4);
      this.jointRecordsAttr.needsUpdate = true;
    }
    return true;
  }

  /**
   * Configure (or create) a world→body spherical drag joint and activate it.
   * Reuses `reuseIndex` when provided so repeated grabs don't exhaust maxJoints.
   */
  setDragJoint(
    body: number,
    worldAnchor: [number, number, number],
    localAnchor: [number, number, number],
    stiffness: number,
    reuseIndex: number | null = null,
  ): number {
    if (reuseIndex !== null && reuseIndex >= 0 && reuseIndex < this.jointCount) {
      const jointIndex = reuseIndex;
      const bodyBSize = this.getBodySize(body);
      const torqueArm =
        bodyBSize[0] * bodyBSize[0] + bodyBSize[1] * bodyBSize[1] + bodyBSize[2] * bodyBSize[2];
      const metaBase = jointRecordVec4FloatIndex(jointIndex, JOINT_RECORD_META_OFFSET);
      const metaWords = new Uint32Array(this.jointRecordsData.buffer, metaBase * 4, 4);
      metaWords[0] = WORLD_BODY_INDEX >>> 0;
      metaWords[1] = body >>> 0;
      metaWords[2] = 0; // spherical
      metaWords[3] = 1; // active

      const anchorABase = jointRecordVec4FloatIndex(jointIndex, JOINT_RECORD_ANCHOR_A_OFFSET);
      this.jointRecordsData[anchorABase + 0] = worldAnchor[0];
      this.jointRecordsData[anchorABase + 1] = worldAnchor[1];
      this.jointRecordsData[anchorABase + 2] = worldAnchor[2];
      this.jointRecordsData[anchorABase + 3] = torqueArm;

      const anchorBBase = jointRecordVec4FloatIndex(jointIndex, JOINT_RECORD_ANCHOR_B_OFFSET);
      this.jointRecordsData[anchorBBase + 0] = localAnchor[0];
      this.jointRecordsData[anchorBBase + 1] = localAnchor[1];
      this.jointRecordsData[anchorBBase + 2] = localAnchor[2];
      this.jointRecordsData[anchorBBase + 3] = 0;

      const restBase = jointRecordVec4FloatIndex(jointIndex, JOINT_RECORD_REST_RELATIVE_ROTATION_OFFSET);
      const qB = this.getBodyQuaternion(body);
      this.jointRecordsData[restBase + 0] = qB[0];
      this.jointRecordsData[restBase + 1] = qB[1];
      this.jointRecordsData[restBase + 2] = qB[2];
      this.jointRecordsData[restBase + 3] = qB[3];

      const stiffnessBase = jointRecordVec4FloatIndex(jointIndex, JOINT_RECORD_STIFFNESS_OFFSET);
      const k = Math.max(stiffness, AVBD_K_START);
      this.jointRecordsData[stiffnessBase + 0] = k;
      this.jointRecordsData[stiffnessBase + 1] = 0;
      this.jointRecordsData[stiffnessBase + 2] = 0;
      this.jointRecordsData[stiffnessBase + 3] = 0;

      for (const off of [
        JOINT_RECORD_C0_LIN_OFFSET,
        JOINT_RECORD_C0_ANG_OFFSET,
        JOINT_RECORD_LAMBDA_LIN_OFFSET,
        JOINT_RECORD_LAMBDA_ANG_OFFSET,
        JOINT_RECORD_PENALTY_LIN_OFFSET,
        JOINT_RECORD_PENALTY_ANG_OFFSET,
      ]) {
        const b = jointRecordVec4FloatIndex(jointIndex, off);
        this.jointRecordsData.fill(0, b, b + 4);
      }

      if (this.initialized) {
        const vec4Start = jointIndex * JOINT_RECORD_VEC4S * 4;
        this.jointRecordsAttr.addUpdateRange(vec4Start, JOINT_RECORD_VEC4S * 4);
        this.jointRecordsAttr.needsUpdate = true;
      }
      return jointIndex;
    }

    return this.addSphericalJoint(null, body, worldAnchor, localAnchor, stiffness, false);
  }

  setBodyShapeHalfExtents(body: number, halfExtents: [number, number, number]): void {
    if (body < 0 || body >= this.bodyCount) return;
    this.shapesData[body * 4 + 1] = halfExtents[0];
    this.shapesData[body * 4 + 2] = halfExtents[1];
    this.shapesData[body * 4 + 3] = halfExtents[2];
    if (this.initialized) {
      this.shapesAttr.addUpdateRange(body * 4, 4);
      this.shapesAttr.needsUpdate = true;
    }
  }

  /**
   * Overwrite a body's velocity, leaving its pose alone.
   *
   * Unlike `setBodyPose`, this is safe on a body whose pose lives on the GPU: the CPU pose mirror
   * is stale for those, and writing it back would teleport them.
   */
  setBodyVelocity(
    body: number,
    linearVelocity: [number, number, number] | null,
    angularVelocity?: [number, number, number],
  ): void {
    if (body < 0 || body >= this.bodyCount) return;
    const bodyBase = body * 4;
    for (let axis = 0; axis < 3; axis++) {
      if (linearVelocity) {
        this.velocitiesData[bodyBase + axis] = linearVelocity[axis]!;
        this.prevLinearVelData[bodyBase + axis] = linearVelocity[axis]!;
      }
      if (angularVelocity) this.angularVelData[bodyBase + axis] = angularVelocity[axis]!;
    }
    if (!this.initialized) return;
    if (linearVelocity) {
      this.velocitiesAttr.addUpdateRange(bodyBase, 3);
      this.velocitiesAttr.needsUpdate = true;
      this.prevLinearVelAttr.addUpdateRange(bodyBase, 3);
      this.prevLinearVelAttr.needsUpdate = true;
    }
    if (angularVelocity) {
      this.angularVelAttr.addUpdateRange(bodyBase, 3);
      this.angularVelAttr.needsUpdate = true;
    }
  }

  setBodyPose(
    body: number,
    position: [number, number, number],
    quaternion?: [number, number, number, number],
    linearVelocity?: [number, number, number],
    angularVelocity?: [number, number, number],
  ): void {
    if (body < 0 || body >= this.bodyCount) return;

    const bodyBase = body * 4;
    const poseBase = body * 8;
    const inertialBase = body * INERTIAL_POSE_FLOATS_PER_BODY;
    this.positionsData[bodyBase + 0] = position[0];
    this.positionsData[bodyBase + 1] = position[1];
    this.positionsData[bodyBase + 2] = position[2];
    this.initialPoseData[poseBase + 0] = position[0];
    this.initialPoseData[poseBase + 1] = position[1];
    this.initialPoseData[poseBase + 2] = position[2];

    this.inertialPoseData[inertialBase + 0] = position[0];
    this.inertialPoseData[inertialBase + 1] = position[1];
    this.inertialPoseData[inertialBase + 2] = position[2];
    this.inertialPoseData[inertialBase + 8] = position[0];
    this.inertialPoseData[inertialBase + 9] = position[1];
    this.inertialPoseData[inertialBase + 10] = position[2];

    if (quaternion) {
      const q = normalizeQuat(quaternion);
      this.quaternionsData[bodyBase + 0] = q[0];
      this.quaternionsData[bodyBase + 1] = q[1];
      this.quaternionsData[bodyBase + 2] = q[2];
      this.quaternionsData[bodyBase + 3] = q[3];
      this.initialPoseData[poseBase + 4] = q[0];
      this.initialPoseData[poseBase + 5] = q[1];
      this.initialPoseData[poseBase + 6] = q[2];
      this.initialPoseData[poseBase + 7] = q[3];
      this.inertialPoseData[inertialBase + 4] = q[0];
      this.inertialPoseData[inertialBase + 5] = q[1];
      this.inertialPoseData[inertialBase + 6] = q[2];
      this.inertialPoseData[inertialBase + 7] = q[3];
      this.inertialPoseData[inertialBase + 12] = q[0];
      this.inertialPoseData[inertialBase + 13] = q[1];
      this.inertialPoseData[inertialBase + 14] = q[2];
      this.inertialPoseData[inertialBase + 15] = q[3];
    }

    if (linearVelocity) {
      this.velocitiesData[bodyBase + 0] = linearVelocity[0];
      this.velocitiesData[bodyBase + 1] = linearVelocity[1];
      this.velocitiesData[bodyBase + 2] = linearVelocity[2];
      this.prevLinearVelData[bodyBase + 0] = linearVelocity[0];
      this.prevLinearVelData[bodyBase + 1] = linearVelocity[1];
      this.prevLinearVelData[bodyBase + 2] = linearVelocity[2];
    }

    if (angularVelocity) {
      this.angularVelData[bodyBase + 0] = angularVelocity[0];
      this.angularVelData[bodyBase + 1] = angularVelocity[1];
      this.angularVelData[bodyBase + 2] = angularVelocity[2];
    }
    if (this.initialized) {
      this.positionsAttr.addUpdateRange(bodyBase, 4);
      this.positionsAttr.needsUpdate = true;
      this.initialPoseAttr.addUpdateRange(poseBase, 8);
      this.initialPoseAttr.needsUpdate = true;
      this.inertialPoseAttr.addUpdateRange(inertialBase, INERTIAL_POSE_FLOATS_PER_BODY);
      this.inertialPoseAttr.needsUpdate = true;
      if (quaternion) {
        this.quaternionsAttr.addUpdateRange(bodyBase, 4);
        this.quaternionsAttr.needsUpdate = true;
      }
      if (linearVelocity) {
        this.velocitiesAttr.addUpdateRange(bodyBase, 4);
        this.velocitiesAttr.needsUpdate = true;
        this.prevLinearVelAttr.addUpdateRange(bodyBase, 4);
        this.prevLinearVelAttr.needsUpdate = true;
      }
      if (angularVelocity) {
        this.angularVelAttr.addUpdateRange(bodyBase, 4);
        this.angularVelAttr.needsUpdate = true;
      }
    }
  }

  private appendJoint(desc: JointDesc): number {
    if (this.jointCount >= this.maxJoints) {
      throw new Error(`Exceeded maxJoints=${this.maxJoints}`);
    }
    if (desc.bodyB < 0 || desc.bodyB >= this.bodyCount) {
      throw new Error(`Invalid joint bodyB=${desc.bodyB}`);
    }
    if (desc.bodyA !== null && (desc.bodyA < 0 || desc.bodyA >= this.bodyCount)) {
      throw new Error(`Invalid joint bodyA=${desc.bodyA}`);
    }

    const jointIndex = this.jointCount++;
    const bodyA = desc.bodyA ?? WORLD_BODY_INDEX;
    const bodyB = desc.bodyB;
    const type = desc.type === 'fixed' ? 1 : 0;
    const stiffness = Math.max(desc.stiffness ?? 1.0e6, AVBD_K_START);
    const bodyASize = desc.bodyA === null ? [0.0, 0.0, 0.0] : this.getBodySize(desc.bodyA);
    const bodyBSize = this.getBodySize(bodyB);
    const torqueArm = (
      (bodyASize[0] + bodyBSize[0]) * (bodyASize[0] + bodyBSize[0]) +
      (bodyASize[1] + bodyBSize[1]) * (bodyASize[1] + bodyBSize[1]) +
      (bodyASize[2] + bodyBSize[2]) * (bodyASize[2] + bodyBSize[2])
    );

    const qA = desc.bodyA === null ? [0, 0, 0, 1] as [number, number, number, number] : this.getBodyQuaternion(desc.bodyA);
    const qB = this.getBodyQuaternion(bodyB);
    const restRelative = normalizeQuat(multiplyQuat(conjugateQuat(qA), qB));

    const metaBase = jointRecordVec4FloatIndex(jointIndex, JOINT_RECORD_META_OFFSET);
    const metaWords = new Uint32Array(this.jointRecordsData.buffer, metaBase * 4, 4);
    metaWords[0] = bodyA >>> 0;
    metaWords[1] = bodyB >>> 0;
    metaWords[2] = type >>> 0;
    metaWords[3] = 1;

    const anchorABase = jointRecordVec4FloatIndex(jointIndex, JOINT_RECORD_ANCHOR_A_OFFSET);
    this.jointRecordsData[anchorABase + 0] = desc.anchorA[0];
    this.jointRecordsData[anchorABase + 1] = desc.anchorA[1];
    this.jointRecordsData[anchorABase + 2] = desc.anchorA[2];
    this.jointRecordsData[anchorABase + 3] = torqueArm;

    const anchorBBase = jointRecordVec4FloatIndex(jointIndex, JOINT_RECORD_ANCHOR_B_OFFSET);
    this.jointRecordsData[anchorBBase + 0] = desc.anchorB[0];
    this.jointRecordsData[anchorBBase + 1] = desc.anchorB[1];
    this.jointRecordsData[anchorBBase + 2] = desc.anchorB[2];
    this.jointRecordsData[anchorBBase + 3] = 0.0;

    const restBase = jointRecordVec4FloatIndex(jointIndex, JOINT_RECORD_REST_RELATIVE_ROTATION_OFFSET);
    this.jointRecordsData[restBase + 0] = restRelative[0];
    this.jointRecordsData[restBase + 1] = restRelative[1];
    this.jointRecordsData[restBase + 2] = restRelative[2];
    this.jointRecordsData[restBase + 3] = restRelative[3];

    const stiffnessBase = jointRecordVec4FloatIndex(jointIndex, JOINT_RECORD_STIFFNESS_OFFSET);
    this.jointRecordsData[stiffnessBase + 0] = stiffness;
    this.jointRecordsData[stiffnessBase + 1] = type === 1 ? stiffness : 0.0;
    this.jointRecordsData[stiffnessBase + 2] = 0.0;
    this.jointRecordsData[stiffnessBase + 3] = 0.0;

    const c0LinBase = jointRecordVec4FloatIndex(jointIndex, JOINT_RECORD_C0_LIN_OFFSET);
    const c0AngBase = jointRecordVec4FloatIndex(jointIndex, JOINT_RECORD_C0_ANG_OFFSET);
    const lambdaLinBase = jointRecordVec4FloatIndex(jointIndex, JOINT_RECORD_LAMBDA_LIN_OFFSET);
    const lambdaAngBase = jointRecordVec4FloatIndex(jointIndex, JOINT_RECORD_LAMBDA_ANG_OFFSET);
    const penaltyLinBase = jointRecordVec4FloatIndex(jointIndex, JOINT_RECORD_PENALTY_LIN_OFFSET);
    const penaltyAngBase = jointRecordVec4FloatIndex(jointIndex, JOINT_RECORD_PENALTY_ANG_OFFSET);
    this.jointRecordsData.fill(0.0, c0LinBase, c0LinBase + 4);
    this.jointRecordsData.fill(0.0, c0AngBase, c0AngBase + 4);
    this.jointRecordsData.fill(0.0, lambdaLinBase, lambdaLinBase + 4);
    this.jointRecordsData.fill(0.0, lambdaAngBase, lambdaAngBase + 4);
    this.jointRecordsData.fill(0.0, penaltyLinBase, penaltyLinBase + 4);
    this.jointRecordsData.fill(0.0, penaltyAngBase, penaltyAngBase + 4);

    if (this.initialized) {
      const vec4Start = jointIndex * JOINT_RECORD_VEC4S * 4;
      const vec4Count = JOINT_RECORD_VEC4S * 4;
      this.jointRecordsAttr.addUpdateRange(vec4Start, vec4Count);
      this.jointRecordsAttr.needsUpdate = true;
    }

    if ((desc.disableCollision ?? true) && desc.bodyA !== null && desc.bodyA !== desc.bodyB) {
      this.setPairCollisionIgnored(desc.bodyA, desc.bodyB, true);
    }

    return jointIndex;
  }

  private appendSpring(desc: SpringDesc): number {
    if (this.springCount >= this.maxSprings) {
      throw new Error(`Exceeded maxSprings=${this.maxSprings}`);
    }
    if (desc.bodyB < 0 || desc.bodyB >= this.bodyCount) {
      throw new Error(`Invalid spring bodyB=${desc.bodyB}`);
    }
    if (desc.bodyA !== null && (desc.bodyA < 0 || desc.bodyA >= this.bodyCount)) {
      throw new Error(`Invalid spring bodyA=${desc.bodyA}`);
    }

    const springIndex = this.springCount++;
    const bodyA = desc.bodyA ?? WORLD_BODY_INDEX;
    const bodyB = desc.bodyB;
    const stiffness = Math.max(desc.stiffness ?? 100.0, 0.0);

    const qA = desc.bodyA === null ? [0, 0, 0, 1] as [number, number, number, number] : this.getBodyQuaternion(desc.bodyA);
    const qB = this.getBodyQuaternion(bodyB);
    const posA = desc.bodyA === null ? desc.anchorA : this.getBodyPosition(desc.bodyA);
    const posB = this.getBodyPosition(bodyB);
    const worldAnchorA = desc.bodyA === null
      ? desc.anchorA
      : (() => {
        const offset = rotateVector(qA, desc.anchorA);
        return [
          posA[0] + offset[0],
          posA[1] + offset[1],
          posA[2] + offset[2],
        ] as [number, number, number];
      })();
    const worldAnchorB = (() => {
      const offset = rotateVector(qB, desc.anchorB);
      return [
        posB[0] + offset[0],
        posB[1] + offset[1],
        posB[2] + offset[2],
      ] as [number, number, number];
    })();
    const restLength = Math.max(
      desc.restLength ?? Math.hypot(
        worldAnchorA[0] - worldAnchorB[0],
        worldAnchorA[1] - worldAnchorB[1],
        worldAnchorA[2] - worldAnchorB[2],
      ),
      0.0,
    );

    const metaBase = springRecordVec4FloatIndex(springIndex, SPRING_RECORD_META_OFFSET);
    const metaWords = new Uint32Array(this.springRecordsData.buffer, metaBase * 4, 4);
    metaWords[0] = bodyA >>> 0;
    metaWords[1] = bodyB >>> 0;
    metaWords[2] = 1;
    metaWords[3] = 0;

    const anchorABase = springRecordVec4FloatIndex(springIndex, SPRING_RECORD_ANCHOR_A_OFFSET);
    this.springRecordsData[anchorABase + 0] = desc.anchorA[0];
    this.springRecordsData[anchorABase + 1] = desc.anchorA[1];
    this.springRecordsData[anchorABase + 2] = desc.anchorA[2];
    this.springRecordsData[anchorABase + 3] = restLength;

    const anchorBBase = springRecordVec4FloatIndex(springIndex, SPRING_RECORD_ANCHOR_B_OFFSET);
    this.springRecordsData[anchorBBase + 0] = desc.anchorB[0];
    this.springRecordsData[anchorBBase + 1] = desc.anchorB[1];
    this.springRecordsData[anchorBBase + 2] = desc.anchorB[2];
    this.springRecordsData[anchorBBase + 3] = stiffness;

    if (this.initialized) {
      const vec4Start = springIndex * SPRING_RECORD_VEC4S * 4;
      const vec4Count = SPRING_RECORD_VEC4S * 4;
      this.springRecordsAttr.addUpdateRange(vec4Start, vec4Count);
      this.springRecordsAttr.needsUpdate = true;
    }

    if ((desc.disableCollision ?? false) && desc.bodyA !== null && desc.bodyA !== desc.bodyB) {
      this.setPairCollisionIgnored(desc.bodyA, desc.bodyB, true);
    }

    return springIndex;
  }

  getSpringCount(): number {
    return this.springCount;
  }

  /** Deactivate a spring (meta.z = 0) so the GPU solver skips it permanently. */
  disableSpring(springIndex: number): boolean {
    if (springIndex < 0 || springIndex >= this.springCount) return false;
    const metaBase = springRecordVec4FloatIndex(springIndex, SPRING_RECORD_META_OFFSET);
    const metaWords = new Uint32Array(this.springRecordsData.buffer, metaBase * 4, 4);
    if (metaWords[2] === 0) return false;
    metaWords[2] = 0;
    if (this.initialized) {
      const vec4Start = springIndex * SPRING_RECORD_VEC4S * 4;
      this.springRecordsAttr.addUpdateRange(vec4Start, SPRING_RECORD_VEC4S * 4);
      this.springRecordsAttr.needsUpdate = true;
    }
    return true;
  }

  private setPairCollisionIgnored(bodyA: number, bodyB: number, ignored: boolean): void {
    const pairIndex = pairIndexForBodies(bodyA, bodyB);
    if (pairIndex < 0 || pairIndex >= this.maxPairs) return;
    const wordIndex = pairIndex >> 5;
    const bit = 1 << (pairIndex & 31);
    if (wordIndex >= this.pairIgnoredBitsData.length) return;
    if (ignored) {
      this.pairIgnoredBitsData[wordIndex] = (this.pairIgnoredBitsData[wordIndex] ?? 0) | bit;
    } else {
      this.pairIgnoredBitsData[wordIndex] = (this.pairIgnoredBitsData[wordIndex] ?? 0) & ~bit;
    }
    if (this.initialized) {
      this.pairActivityAttr.addUpdateRange(this.pairIgnoredBitsOffset + wordIndex, 1);
      this.pairActivityAttr.needsUpdate = true;
    }
  }

  setBodyPairCollisionIgnored(bodyA: number, bodyB: number, ignored = true): void {
    if (bodyA < 0 || bodyA >= this.bodyCount) return;
    if (bodyB < 0 || bodyB >= this.bodyCount) return;
    if (bodyA === bodyB) return;
    this.setPairCollisionIgnored(bodyA, bodyB, ignored);
  }

  setBodyCollisionFilter(body: number, collisionGroup: number, collisionMask: number): void {
    if (body < 0 || body >= this.bodyCount) return;
    const base = body * 4;
    const currentMeta = this.shapesWordData[base] ?? 0;
    const currentFriction = decodeShapeFrictionWord(currentMeta);
    const currentShapeType = decodeShapeTypeWord(currentMeta);
    this.shapesWordData[base] = packShapeMetaWord(
      currentFriction,
      clampCollisionFilterWord(collisionGroup, DEFAULT_COLLISION_GROUP),
      clampCollisionFilterWord(collisionMask, DEFAULT_COLLISION_MASK),
      currentShapeType,
    );
    if (this.initialized) {
      this.shapesAttr.addUpdateRange(base, 1);
      this.shapesAttr.needsUpdate = true;
    }
  }

  /**
   * Flip a body between kinematic (mass 0) and dynamic after the scene is built.
   *
   * `initialPose` deliberately keeps the mass `addBody` authored, so resetting the simulation
   * restores what the scene spawned with instead of whatever state a body was in when reset ran.
   * Scenes that flip masses are responsible for restoring their own side state on reset.
   */
  setBodyMass(body: number, mass: number, options?: { lockRotation?: boolean }): void {
    if (body < 0 || body >= this.bodyCount) return;

    const invMass = mass > 0 ? 1.0 / mass : 0.0;
    const bodyBase = body * 4;
    const inertialBase = body * INERTIAL_POSE_FLOATS_PER_BODY;
    this.positionsData[bodyBase + 3] = invMass;
    this.inertialPoseData[inertialBase + 3] = invMass;
    this.inertialPoseData[inertialBase + 11] = invMass;
    this.inverseInertiaData[bodyBase + 3] = invMass;

    let invIxx = 0.0;
    let invIyy = 0.0;
    let invIzz = 0.0;
    if (mass > 0 && !options?.lockRotation) {
      const hx = this.shapesData[bodyBase + 1] ?? 0.0;
      const hy = this.shapesData[bodyBase + 2] ?? 0.0;
      const hz = this.shapesData[bodyBase + 3] ?? 0.0;
      let ixx: number;
      let iyy: number;
      let izz: number;
      if (decodeShapeTypeWord(this.shapesWordData[bodyBase] ?? 0) === SHAPE_TYPE_SPHERE) {
        ixx = 0.4 * mass * hx * hx;
        iyy = ixx;
        izz = ixx;
      } else {
        ixx = (mass / 3) * (hy * hy + hz * hz);
        iyy = (mass / 3) * (hx * hx + hz * hz);
        izz = (mass / 3) * (hx * hx + hy * hy);
      }
      invIxx = ixx > 0 ? 1.0 / ixx : 0.0;
      invIyy = iyy > 0 ? 1.0 / iyy : 0.0;
      invIzz = izz > 0 ? 1.0 / izz : 0.0;
    }
    this.inverseInertiaData[bodyBase + 0] = invIxx;
    this.inverseInertiaData[bodyBase + 1] = invIyy;
    this.inverseInertiaData[bodyBase + 2] = invIzz;

    if (this.initialized) {
      // Upload the mass fields alone. A body whose pose is driven on the GPU has a stale CPU
      // pose mirror, and a whole-vec4 upload here would drag it back to wherever the CPU last
      // thought the body was.
      this.positionsAttr.addUpdateRange(bodyBase + 3, 1);
      this.positionsAttr.needsUpdate = true;
      this.inertialPoseAttr.addUpdateRange(inertialBase + 3, 1);
      this.inertialPoseAttr.addUpdateRange(inertialBase + 11, 1);
      this.inertialPoseAttr.needsUpdate = true;
      this.inverseInertiaAttr.addUpdateRange(bodyBase, 4);
      this.inverseInertiaAttr.needsUpdate = true;
    }
  }

  /**
   * Storage buffers a scene-owned compute kernel may write to drive kinematic bodies.
   *
   * These are the live solver buffers; dispatch before `step()` so integration picks the writes
   * up in the same frame. Velocities matter even for pose-driven bodies: the integrator sweeps
   * kinematics with them, and `finalizeVelocities` preserves them, so a body handed over to the
   * dynamic solver already carries the animation's momentum.
   */
  getKinematicDriveBuffers(): {
    positions: StorageBufferAttribute;
    quaternions: StorageBufferAttribute;
    velocities: StorageBufferAttribute;
    angularVelocities: StorageBufferAttribute;
  } | null {
    if (!this.initialized) return null;
    return {
      positions: this.positionsAttr,
      quaternions: this.quaternionsAttr,
      velocities: this.velocitiesAttr,
      angularVelocities: this.angularVelAttr,
    };
  }

  addSphericalJoint(
    bodyA: number | null,
    bodyB: number,
    anchorA: [number, number, number],
    anchorB: [number, number, number],
    stiffness = 1.0e6,
    disableCollision = true,
  ): number {
    return this.appendJoint({
      type: 'spherical',
      bodyA,
      bodyB,
      anchorA,
      anchorB,
      stiffness,
      disableCollision,
    });
  }

  addFixedJoint(
    bodyA: number | null,
    bodyB: number,
    anchorA: [number, number, number],
    anchorB: [number, number, number],
    stiffness = 1.0e6,
    disableCollision = true,
  ): number {
    return this.appendJoint({
      type: 'fixed',
      bodyA,
      bodyB,
      anchorA,
      anchorB,
      stiffness,
      disableCollision,
    });
  }

  addSpring(
    bodyA: number | null,
    bodyB: number,
    anchorA: [number, number, number],
    anchorB: [number, number, number],
    stiffness = 100.0,
    restLength?: number,
    disableCollision = true,
  ): number {
    return this.appendSpring({
      bodyA,
      bodyB,
      anchorA,
      anchorB,
      stiffness,
      restLength,
      disableCollision,
    });
  }

  private initGPU(): void {
    if (this.initialized) return;
    this.initialized = true;

    const n = this.config.maxBodies;

    this.positionsAttr = new StorageBufferAttribute(this.positionsData, 4);
    this.initialPoseAttr = new StorageBufferAttribute(this.initialPoseData, 4);
    this.inertialPoseAttr = new StorageBufferAttribute(this.inertialPoseData, 4);
    this.velocitiesAttr = new StorageBufferAttribute(this.velocitiesData, 4);
    this.prevLinearVelAttr = new StorageBufferAttribute(this.prevLinearVelData, 4);
    this.shapesAttr = new StorageBufferAttribute(this.shapesData, 4);
    this.quaternionsAttr = new StorageBufferAttribute(this.quaternionsData, 4);
    this.angularVelAttr = new StorageBufferAttribute(this.angularVelData, 4);
    this.inverseInertiaAttr = new StorageBufferAttribute(this.inverseInertiaData, 4);
    this.derivedInvInertiaAttr = new StorageBufferAttribute(this.derivedInvInertiaData, 4);

    this.pairContactsAttr = new StorageBufferAttribute(this.pairContactsData, 4);
    this.jointRecordsAttr = new StorageBufferAttribute(this.jointRecordsData, 4);
    this.springRecordsAttr = new StorageBufferAttribute(this.springRecordsData, 4);
    this.pairActivityAttr = new StorageBufferAttribute(this.pairActivityData, 1);
    this.pairCandidateIndicesAttr = this.pairActivityAttr;
    this.pairVisitedBitsAttr = new StorageBufferAttribute(this.pairVisitedBitsData, 1);
    this.pairBodyContactCountsAttr = new StorageBufferAttribute(this.pairBodyContactCountsData, 1);
    this.pairBodyContactIndicesAttr = new StorageBufferAttribute(this.pairBodyContactIndicesData, 1);
    this.bodyConstraintCountsAttr = new StorageBufferAttribute(this.bodyConstraintCountsData, 1);
    this.bodyConstraintRefsAttr = new StorageBufferAttribute(this.bodyConstraintRefsData, 1);
    this.pairActiveCandidateSlotsAttr = this.pairActivityAttr;
    this.pairActiveContactsAttr = this.pairActivityAttr;
    this.pairColorBodyClaimsAttr = new StorageBufferAttribute(this.pairColorBodyClaimsData, 1);

    this.integration = new IntegrationStage(
      this.positionsAttr,
      this.initialPoseAttr,
      this.inertialPoseAttr,
      this.velocitiesAttr,
      this.prevLinearVelAttr,
      this.quaternionsAttr,
      this.angularVelAttr,
      this.config.gravity,
      n,
    );

    this.derivedInertia = new DerivedInertiaStage(
      this.quaternionsAttr,
      this.inverseInertiaAttr,
      this.derivedInvInertiaAttr,
      n,
    );

    this.contactGeneration = new ContactGenerationStage(
      this.positionsAttr,
      this.quaternionsAttr,
      this.shapesAttr,
      this.pairContactsAttr,
      this.pairActivityAttr,
      this.pairBodyContactCountsAttr,
      this.pairBodyContactIndicesAttr,
      n,
      this.maxPairContacts,
      this.pairManifoldSlots,
      this.maxContactsPerBodySolver,
      this.maxActivePairContacts,
      this.pairCandidateIndicesOffset,
      this.pairActiveCandidateSlotsOffset,
      this.pairActiveContactsOffset,
      this.pairIgnoredBitsOffset,
      this.pairActivityWordCount,
    );
    this.contactGeneration.setDebugEnabled(this.debugBehaviorEnabled);
    this.contactGeneration.setDebugLogInterval(this.debugLogEveryNFrames);

    this.broadPhase = new BroadPhaseStage(
      this.device,
      this.positionsAttr,
      this.velocitiesAttr,
      this.quaternionsAttr,
      this.shapesAttr,
      this.pairActivityAttr,
      this.pairCandidateIndicesAttr,
      this.pairVisitedBitsAttr,
      n,
      this.maxCandidatePairs,
      this.maxPairsPerBodyBroadphase,
      this.pairIgnoredBitsOffset,
      {
        enableBvhBuild: this.enableBvhBuild,
        buildOnce: this.bvhBuildOnce,
        rebuildIntervalFrames: this.bvhRebuildIntervalFrames,
        waitForGpuCompletion: this.bvhWaitForGpuCompletion,
      },
    );
    this.broadPhase.setDebugEnabled(this.debugBehaviorEnabled);
    this.broadPhase.setDebugLogInterval(this.debugLogEveryNFrames);

    this.avbdState = new AvbdStateStage(
      this.pairContactsAttr,
      this.jointRecordsAttr,
      this.springRecordsAttr,
      this.positionsAttr,
      this.initialPoseAttr,
      this.inertialPoseAttr,
      this.quaternionsAttr,
      this.velocitiesAttr,
      this.prevLinearVelAttr,
      this.angularVelAttr,
      this.inverseInertiaAttr,
      this.derivedInvInertiaAttr,
      this.bodyConstraintCountsAttr,
      this.bodyConstraintRefsAttr,
      this.pairBodyContactCountsAttr,
      this.pairBodyContactIndicesAttr,
      this.pairColorBodyClaimsAttr,
      this.pairActivityAttr,
      n,
      this.maxPairContacts,
      this.maxJoints,
      this.maxSprings,
      this.maxActivePairContacts,
      this.maxConstraintsPerBodySolver,
      this.maxContactsPerBodySolver,
      this.pairManifoldSlots,
      this.pairActiveContactsOffset,
      this.pairActivityWordCount,
    );
    this.avbdState.setDebugEnabled(this.debugBehaviorEnabled);
    this.avbdState.setDebugLogInterval(this.debugLogEveryNFrames);
    this.avbdState.setFriction(this.avbdFrictionStatic, this.avbdFrictionStatic);
    this.avbdState.setDualUpdateBeta(this.avbdDualUpdateBeta);
    this.avbdState.setPenaltyDecayGamma(this.avbdPenaltyDecayGamma);
    this.avbdState.setPenaltyFloor(this.avbdPenaltyFloor);
    this.avbdState.setPreventPenetratingNormalDropout(this.avbdPreventPenetratingNormalDropout);
    this.contactGeneration.setFriction(this.avbdFrictionStatic);

    this.playerControl = new PlayerControlStage(
      this.positionsAttr,
      this.velocitiesAttr,
      this.angularVelAttr,
      this.pairBodyContactCountsAttr,
      this.pairBodyContactIndicesAttr,
      this.pairContactsAttr,
      n,
      this.maxPairContacts,
      this.maxContactsPerBodySolver,
    );
  }

  step(realDt: number, renderer: any): void {
    if (this.bodyCount === 0) return;
    this.frameId++;
    this.stats.frameCount = this.frameId;

    const firstFrame = !this.initialized;
    this.initGPU();

    if (firstFrame) {
      this.positionsAttr.needsUpdate = true;
      this.initialPoseAttr.needsUpdate = true;
      this.inertialPoseAttr.needsUpdate = true;
      this.velocitiesAttr.needsUpdate = true;
      this.prevLinearVelAttr.needsUpdate = true;
      this.shapesAttr.needsUpdate = true;
      this.quaternionsAttr.needsUpdate = true;
      this.angularVelAttr.needsUpdate = true;
      this.inverseInertiaAttr.needsUpdate = true;
      this.derivedInvInertiaAttr.needsUpdate = true;

      this.pairContactsAttr.needsUpdate = true;
      this.jointRecordsAttr.needsUpdate = true;
      this.pairActivityAttr.needsUpdate = true;
      this.pairCandidateIndicesAttr.needsUpdate = true;
      this.pairVisitedBitsAttr.needsUpdate = true;
      this.pairBodyContactCountsAttr.needsUpdate = true;
      this.pairBodyContactIndicesAttr.needsUpdate = true;
      this.bodyConstraintCountsAttr.needsUpdate = true;
      this.bodyConstraintRefsAttr.needsUpdate = true;
      this.pairActiveCandidateSlotsAttr.needsUpdate = true;
      this.pairActiveContactsAttr.needsUpdate = true;
      this.pairColorBodyClaimsAttr.needsUpdate = true;
    }

    this.accumulator += Math.min(realDt, 0.05);
    const start = performance.now();

    const stepsAvailable = Math.floor(this.accumulator / this.config.deltaTime);
    const stepsToRun = Math.min(stepsAvailable, this.maxFixedStepsPerFrame);

    let advancedSimulation = false;
    if (stepsToRun > 0) {
      const pairCount = (this.bodyCount * (this.bodyCount - 1)) / 2;
      let pairGenerationDispatchCount = Math.min(pairCount, this.maxCandidatePairs);
      let pairManifoldDispatchCount = pairGenerationDispatchCount;
      // Contact solve/warmstart run over a compact active-contact list. The
      // list is bounded by the per-body contact list capacity.
      const pairWarmStartDispatchCount = Math.min(
        pairCount * this.pairManifoldSlots,
        this.bodyCount * this.maxContactsPerBodySolver,
      );

      let t0 = performance.now();
      this.broadPhase.dispatch(renderer, this.bodyCount, pairCount, this.frameId);
      this.stats.broadPhaseMs = Math.max(
        performance.now() - t0,
        this.broadPhase.getLastBuildMs(),
      );
      const candidatePairsAvailable = this.broadPhase.hasCandidatePairs();
      const broadPhaseReady = this.broadPhase.isReady();
      const requiresCandidatePairs = this.enableBvhBuild && this.bodyCount > this.bruteForceMaxBodies;
      const useCandidatePairs = candidatePairsAvailable && requiresCandidatePairs;
      const pairDispatchTruncated = !useCandidatePairs && this.bodyCount > this.bruteForceMaxBodies;
      if (this.waitingForInitialCandidatePairs && requiresCandidatePairs) {
        if (!candidatePairsAvailable) {
          this.stats.broadPhaseReady = broadPhaseReady;
          this.stats.candidatePairsEnabled = useCandidatePairs;
          this.stats.pairDispatchTruncated = pairDispatchTruncated;
          this.accumulator = 0;
          this.stats.totalMs = performance.now() - start;
          this.stats.bodyCount = this.bodyCount;
          this.stats.frameCount = this.frameId;
          return;
        }
        this.waitingForInitialCandidatePairs = false;
      } else if (!requiresCandidatePairs) {
        this.waitingForInitialCandidatePairs = false;
      }

      const waitingForBroadphase = !broadPhaseReady && this.enableBvhBuild;
      if (pairDispatchTruncated && !this.pairDispatchTruncationWarned) {
        if (waitingForBroadphase) {
          console.warn(
            `Broadphase BVH is still building at bodyCount=${this.bodyCount}. ` +
            `Pausing physics until candidate pairs become available (brute-force safe limit=${this.bruteForceMaxBodies}).`,
          );
        } else {
          console.error(
            `Broadphase candidate pairs are disabled and bodyCount (${this.bodyCount}) exceeds brute-force safe limit (${this.bruteForceMaxBodies}). ` +
            'Pausing physics to avoid incomplete collisions.',
          );
        }
        this.pairDispatchTruncationWarned = true;
      } else if (!pairDispatchTruncated) {
        this.pairDispatchTruncationWarned = false;
      }
      this.stats.broadPhaseReady = broadPhaseReady;
      this.stats.candidatePairsEnabled = useCandidatePairs;
      this.stats.pairDispatchTruncated = pairDispatchTruncated;
      if (pairDispatchTruncated && this.haltOnBroadphaseFallbackOverflow) {
        this.accumulator = 0;
        this.stats.totalMs = performance.now() - start;
        this.stats.bodyCount = this.bodyCount;
        this.stats.frameCount = this.frameId;
        return;
      }

      if (useCandidatePairs) {
        // Candidate mode uses a fixed per-body slot span in pairCandidateIndices;
        // dispatch must cover that span (not triangular pairCount) so all slots
        // participate in manifold persistence.
        const candidateDispatchSpan = Math.min(
          this.maxCandidatePairs,
          this.bodyCount * this.maxPairsPerBodyBroadphase,
        );
        pairGenerationDispatchCount = candidateDispatchSpan;
        pairManifoldDispatchCount = candidateDispatchSpan;
      }

      const subDt = this.config.deltaTime / this.config.substeps;
      for (let stepIndex = 0; stepIndex < stepsToRun; stepIndex++) {
        for (let s = 0; s < this.config.substeps; s++) {
          advancedSimulation = true;
          this.substep(
            subDt,
            renderer,
            pairCount,
            pairGenerationDispatchCount,
            pairManifoldDispatchCount,
            pairWarmStartDispatchCount,
            useCandidatePairs,
          );
        }
        this.accumulator -= this.config.deltaTime;
      }
    }

    if (stepsAvailable > stepsToRun) {
      // Clamp backlog to avoid runaway catch-up and repeated heavy broadphase work.
      this.accumulator = Math.min(this.accumulator, this.config.deltaTime);
    }

    this.stats.totalMs = performance.now() - start;
    this.stats.bodyCount = this.bodyCount;
    if (advancedSimulation) {
      this.logSupportDiagnostics(renderer);
    }
  }

  private substep(
    dt: number,
    renderer: any,
    pairCount: number,
    pairGenerationDispatchCount: number,
    pairManifoldDispatchCount: number,
    pairWarmStartDispatchCount: number,
    candidatePairsEnabled: boolean,
  ): void {
    let t0: number;
    t0 = performance.now();
    this.integration.dispatch(renderer, this.bodyCount, dt);
    this.stats.integrationMs = performance.now() - t0;

    t0 = performance.now();
    this.contactGeneration.setFloorDebugBody(
      this.debugBehaviorEnabled ? this.findSupportFloorBody(this.positionsData, this.shapesData).body : -1,
    );
    this.contactGeneration.dispatchPairKernelPhase(
      renderer,
      this.bodyCount,
      pairCount,
      pairGenerationDispatchCount,
      candidatePairsEnabled,
    );
    this.contactGeneration.dispatchBodyListPhase(
      renderer,
      this.bodyCount,
      pairGenerationDispatchCount,
      this.frameId,
    );
    // The fused integration pass snapshots x^t and seeds the AVBD primal guess
    // toward x^(t+1) before narrowphase; contact generation still reads x^t
    // from the current position/quaternion buffers.
    const solveAlpha = this.avbdRegularizationAlpha;
    const mainTangentialAlpha = solveAlpha;
    const mainPairSweeps = this.avbdPairSweeps;
    const mainIterations = this.solverIterations;
    const mainSolveTuning = {
      relaxation: 1.0,
      maxLinearCorrection: 1.0e9,
      maxAngularCorrection: 1.0e9,
    };
    const dualUpdateBeta = this.avbdDualUpdateBeta;
    const warmstartScale = solveAlpha * this.avbdPenaltyDecayGamma;
    this.avbdState.prepare(
      renderer,
      this.bodyCount,
      pairWarmStartDispatchCount,
      this.jointCount,
      this.springCount,
      this.activePairSolveColorCount,
      warmstartScale,
      dt,
      this.avbdBodySolveMode,
    );
    this.avbdState.setDualUpdateBeta(dualUpdateBeta);
    this.avbdState.clearPhaseDebugCounters(renderer);
    const needsDerivedInertia = this.avbdState.usesDerivedInertiaInPrimalSolve();
    for (let i = 0; i < mainIterations; i++) {
      if (needsDerivedInertia) {
        // With full rotational inertial blocks in AVBD local solves, refresh
        // world-space inverse inertia every iteration to avoid stale coupling.
        this.derivedInertia.dispatch(renderer, this.bodyCount);
      }
      this.avbdState.primalSolveBodies(
        renderer,
        this.bodyCount,
        mainPairSweeps,
        this.activePairSolveColorCount,
        solveAlpha,
        dt,
        1.0,
        mainTangentialAlpha,
        mainSolveTuning,
        0,
        0,
        undefined,
        this.avbdBodySolveMode,
      );
      this.avbdState.captureFromSolve(
        renderer,
        pairWarmStartDispatchCount,
        this.jointCount,
        dt,
        solveAlpha,
        i,
      );
    }
    this.avbdState.finalizeVelocities(renderer, this.bodyCount, dt);
    this.avbdState.capturePhaseDebug(
      renderer,
      pairWarmStartDispatchCount,
      solveAlpha,
      0,
      1.0,
      mainTangentialAlpha,
    );
    this.avbdState.maybeLogDebug(renderer, this.frameId, pairWarmStartDispatchCount, this.bodyCount);
    this.stats.solverMs = performance.now() - t0;
    this.stats.velocityUpdateMs = 0;
  }

  getBodyCount(): number {
    return this.bodyCount;
  }

  /**
   * Hand every GPU allocation back, for an engine that is being thrown away.
   *
   * Dropping the reference is not enough: three only frees a storage attribute's GPUBuffer when
   * it is told to, so the VRAM stays held until the JS wrapper happens to be collected. These
   * buffers are sized off maxBodies and run to hundreds of megabytes, and a scene switch builds a
   * whole new engine before the old one is collectable — which is how switching scenes in a
   * headset ends up losing the device and with it the XR session.
   */
  dispose(renderer: { _attributes?: { delete(attribute: BufferAttribute): unknown } }): void {
    this.broadPhase?.dispose?.();
    const attributes = renderer._attributes;
    // Found by reflection rather than a hand-written list, which would silently rot back into a
    // leak the first time someone adds an attribute.
    if (attributes) {
      for (const value of Object.values(this)) {
        if (value instanceof BufferAttribute) attributes.delete(value);
      }
    }
    this.initialized = false;
  }

  clearScene(): void {
    this.poseEpoch++;
    this.broadPhase?.reset?.();

    this.bodyCount = 0;
    this.jointCount = 0;
    this.springCount = 0;

    this.pairContactsData.fill(0.0);
    this.jointRecordsData.fill(0.0);
    this.springRecordsData.fill(0.0);
    this.pairActivityData.fill(0);
    this.pairVisitedBitsData.fill(0);
    this.pairBodyContactCountsData.fill(0);
    this.pairBodyContactIndicesData.fill(0);
    this.bodyConstraintCountsData.fill(0);
    this.bodyConstraintRefsData.fill(0);
    this.pairColorBodyClaimsData.fill(0);

    this.accumulator = 0.0;
    this.frameId = 0;
    this.pairDispatchTruncationWarned = false;
    this.waitingForInitialCandidatePairs = false;
    this.supportDebugReadbackInFlight = false;
    this.lastSupportDebugLogFrame = -1;
    this.prevSupportBodyCount = -1;
    this.prevCandidatePairsForChurn = null;
    this.prevFloorCandidatePairsForChurn = null;

    this.stats.bodyCount = 0;
    this.stats.frameCount = 0;
    this.stats.totalMs = 0;
    this.stats.integrationMs = 0;
    this.stats.broadPhaseMs = 0;
    this.stats.solverMs = 0;
    this.stats.velocityUpdateMs = 0;
    this.stats.broadPhaseReady = false;
    this.stats.candidatePairsEnabled = false;
    this.stats.pairDispatchTruncated = false;

    if (!this.initialized) return;

    this.pairContactsAttr.needsUpdate = true;
    this.jointRecordsAttr.needsUpdate = true;
    this.springRecordsAttr.needsUpdate = true;
    this.pairActivityAttr.needsUpdate = true;
    this.pairVisitedBitsAttr.needsUpdate = true;
    this.pairBodyContactCountsAttr.needsUpdate = true;
    this.pairBodyContactIndicesAttr.needsUpdate = true;
    this.bodyConstraintCountsAttr.needsUpdate = true;
    this.bodyConstraintRefsAttr.needsUpdate = true;
    this.pairColorBodyClaimsAttr.needsUpdate = true;
  }

  resetSimulationToInitialPose(): void {
    if (this.bodyCount <= 0) return;
    this.poseEpoch++;

    for (let i = 0; i < this.bodyCount; i++) {
      const bodyBase = i * 4;
      const poseBase = i * 8;
      const inertialBase = i * INERTIAL_POSE_FLOATS_PER_BODY;

      this.positionsData[bodyBase + 0] = this.initialPoseData[poseBase + 0];
      this.positionsData[bodyBase + 1] = this.initialPoseData[poseBase + 1];
      this.positionsData[bodyBase + 2] = this.initialPoseData[poseBase + 2];
      this.positionsData[bodyBase + 3] = this.initialPoseData[poseBase + 3];

      this.inertialPoseData[inertialBase + 0] = this.initialPoseData[poseBase + 0];
      this.inertialPoseData[inertialBase + 1] = this.initialPoseData[poseBase + 1];
      this.inertialPoseData[inertialBase + 2] = this.initialPoseData[poseBase + 2];
      this.inertialPoseData[inertialBase + 3] = this.initialPoseData[poseBase + 3];

      this.quaternionsData[bodyBase + 0] = this.initialPoseData[poseBase + 4];
      this.quaternionsData[bodyBase + 1] = this.initialPoseData[poseBase + 5];
      this.quaternionsData[bodyBase + 2] = this.initialPoseData[poseBase + 6];
      this.quaternionsData[bodyBase + 3] = this.initialPoseData[poseBase + 7];

      this.inertialPoseData[inertialBase + 4] = this.initialPoseData[poseBase + 4];
      this.inertialPoseData[inertialBase + 5] = this.initialPoseData[poseBase + 5];
      this.inertialPoseData[inertialBase + 6] = this.initialPoseData[poseBase + 6];
      this.inertialPoseData[inertialBase + 7] = this.initialPoseData[poseBase + 7];
      this.inertialPoseData[inertialBase + 8] = this.initialPoseData[poseBase + 0];
      this.inertialPoseData[inertialBase + 9] = this.initialPoseData[poseBase + 1];
      this.inertialPoseData[inertialBase + 10] = this.initialPoseData[poseBase + 2];
      this.inertialPoseData[inertialBase + 11] = this.initialPoseData[poseBase + 3];
      this.inertialPoseData[inertialBase + 12] = this.initialPoseData[poseBase + 4];
      this.inertialPoseData[inertialBase + 13] = this.initialPoseData[poseBase + 5];
      this.inertialPoseData[inertialBase + 14] = this.initialPoseData[poseBase + 6];
      this.inertialPoseData[inertialBase + 15] = this.initialPoseData[poseBase + 7];

      this.velocitiesData[bodyBase + 0] = this.initialLinearVelData[bodyBase + 0];
      this.velocitiesData[bodyBase + 1] = this.initialLinearVelData[bodyBase + 1];
      this.velocitiesData[bodyBase + 2] = this.initialLinearVelData[bodyBase + 2];
      this.velocitiesData[bodyBase + 3] = this.initialLinearVelData[bodyBase + 3];

      this.prevLinearVelData[bodyBase + 0] = this.initialLinearVelData[bodyBase + 0];
      this.prevLinearVelData[bodyBase + 1] = this.initialLinearVelData[bodyBase + 1];
      this.prevLinearVelData[bodyBase + 2] = this.initialLinearVelData[bodyBase + 2];
      this.prevLinearVelData[bodyBase + 3] = this.initialLinearVelData[bodyBase + 3];

      this.angularVelData[bodyBase + 0] = this.initialAngularVelData[bodyBase + 0];
      this.angularVelData[bodyBase + 1] = this.initialAngularVelData[bodyBase + 1];
      this.angularVelData[bodyBase + 2] = this.initialAngularVelData[bodyBase + 2];
      this.angularVelData[bodyBase + 3] = this.initialAngularVelData[bodyBase + 3];
    }

    // Clear warmstart/contact caches so a reset starts from a clean constraint state.
    this.pairContactsData.fill(0.0);
    for (let jointIndex = 0; jointIndex < this.jointCount; jointIndex++) {
      const c0LinBase = jointRecordVec4FloatIndex(jointIndex, JOINT_RECORD_C0_LIN_OFFSET);
      const c0AngBase = jointRecordVec4FloatIndex(jointIndex, JOINT_RECORD_C0_ANG_OFFSET);
      const lambdaLinBase = jointRecordVec4FloatIndex(jointIndex, JOINT_RECORD_LAMBDA_LIN_OFFSET);
      const lambdaAngBase = jointRecordVec4FloatIndex(jointIndex, JOINT_RECORD_LAMBDA_ANG_OFFSET);
      const penaltyLinBase = jointRecordVec4FloatIndex(jointIndex, JOINT_RECORD_PENALTY_LIN_OFFSET);
      const penaltyAngBase = jointRecordVec4FloatIndex(jointIndex, JOINT_RECORD_PENALTY_ANG_OFFSET);
      this.jointRecordsData.fill(0.0, c0LinBase, c0LinBase + 4);
      this.jointRecordsData.fill(0.0, c0AngBase, c0AngBase + 4);
      this.jointRecordsData.fill(0.0, lambdaLinBase, lambdaLinBase + 4);
      this.jointRecordsData.fill(0.0, lambdaAngBase, lambdaAngBase + 4);
      this.jointRecordsData.fill(0.0, penaltyLinBase, penaltyLinBase + 4);
      this.jointRecordsData.fill(0.0, penaltyAngBase, penaltyAngBase + 4);
    }
    this.pairCandidateIndicesData.fill(0);
    this.pairActiveCandidateSlotsData.fill(0);
    this.pairActiveContactsData.fill(0);
    this.pairVisitedBitsData.fill(0);
    this.pairBodyContactCountsData.fill(0);
    this.pairBodyContactIndicesData.fill(0);
    this.bodyConstraintCountsData.fill(0);
    this.bodyConstraintRefsData.fill(0);
    this.pairColorBodyClaimsData.fill(0);
    this.accumulator = 0.0;
    this.frameId = 0;
    this.pairDispatchTruncationWarned = false;
    this.waitingForInitialCandidatePairs = this.enableBvhBuild && this.bodyCount > this.bruteForceMaxBodies;
    this.supportDebugReadbackInFlight = false;
    this.lastSupportDebugLogFrame = -1;
    this.prevSupportBodyCount = -1;
    this.prevCandidatePairsForChurn = null;
    this.prevFloorCandidatePairsForChurn = null;

    this.stats.totalMs = 0;
    this.stats.frameCount = 0;
    this.stats.integrationMs = 0;
    this.stats.broadPhaseMs = 0;
    this.stats.solverMs = 0;
    this.stats.velocityUpdateMs = 0;
    this.stats.broadPhaseReady = false;
    this.stats.candidatePairsEnabled = false;
    this.stats.pairDispatchTruncated = false;

    if (!this.initialized) return;

    this.positionsAttr.needsUpdate = true;
    this.inertialPoseAttr.needsUpdate = true;
    this.velocitiesAttr.needsUpdate = true;
    this.prevLinearVelAttr.needsUpdate = true;
    this.quaternionsAttr.needsUpdate = true;
    this.angularVelAttr.needsUpdate = true;

    this.pairContactsAttr.needsUpdate = true;
    this.jointRecordsAttr.needsUpdate = true;
    this.pairActivityAttr.needsUpdate = true;
    this.pairVisitedBitsAttr.needsUpdate = true;
    this.pairBodyContactCountsAttr.needsUpdate = true;
    this.pairBodyContactIndicesAttr.needsUpdate = true;
    this.bodyConstraintCountsAttr.needsUpdate = true;
    this.bodyConstraintRefsAttr.needsUpdate = true;
    this.pairColorBodyClaimsAttr.needsUpdate = true;
  }

  setDeltaTime(deltaTime: number): void {
    const clamped = Math.max(1 / 500, Math.min(1 / 10, deltaTime));
    this.config.deltaTime = clamped;
    this.accumulator = Math.min(this.accumulator, clamped);
  }

  setSubsteps(substeps: number): void {
    const clamped = Math.max(1, Math.min(8, Math.floor(substeps)));
    this.config.substeps = clamped;
  }

  getSubsteps(): number {
    return this.config.substeps;
  }

  getPairManifoldSlots(): number {
    return this.pairManifoldSlots;
  }

  setAvbdPairSweeps(sweeps: number): void {
    this.avbdPairSweeps = Math.max(1, Math.min(4, Math.floor(sweeps)));
  }

  getAvbdPairSweeps(): number {
    return this.avbdPairSweeps;
  }

  setPairSolveColorCount(colorCount: number): void {
    const clamped = Math.max(1, Math.min(this.maxPairSolveColorCount, Math.floor(colorCount)));
    this.activePairSolveColorCount = clamped;
  }

  setSolverIterations(iterations: number): void {
    const clamped = Math.max(1, Math.min(64, Math.floor(iterations)));
    this.solverIterations = clamped;
  }

  getSolverIterations(): number {
    return this.solverIterations;
  }

  setAvbdDualUpdateBeta(beta: number): void {
    const clamped = Math.max(0.0, beta);
    this.avbdDualUpdateBeta = clamped;
    this.avbdState?.setDualUpdateBeta?.(clamped);
  }

  getAvbdDualUpdateBeta(): number {
    return this.avbdDualUpdateBeta;
  }

  setAvbdPreventPenetratingNormalDropout(enabled: boolean): void {
    this.avbdPreventPenetratingNormalDropout = Boolean(enabled);
    this.avbdState?.setPreventPenetratingNormalDropout?.(this.avbdPreventPenetratingNormalDropout);
  }

  getAvbdPreventPenetratingNormalDropout(): boolean {
    return this.avbdPreventPenetratingNormalDropout;
  }

  setAvbdBodySolveMode(mode: AvbdBodySolveMode): void {
    this.avbdBodySolveMode = mode;
  }

  getAvbdBodySolveMode(): AvbdBodySolveMode {
    return this.avbdBodySolveMode;
  }

  setAvbdPenaltyDecayGamma(gamma: number): void {
    const clamped = Math.max(0.0, Math.min(1.0, gamma));
    this.avbdPenaltyDecayGamma = clamped;
    this.avbdState?.setPenaltyDecayGamma?.(clamped);
  }

  getAvbdPenaltyDecayGamma(): number {
    return this.avbdPenaltyDecayGamma;
  }

  setAvbdPenaltyFloor(kStart: number): void {
    const clamped = Math.max(1e-6, kStart);
    this.avbdPenaltyFloor = clamped;
    this.avbdState?.setPenaltyFloor?.(clamped);
  }

  getAvbdPenaltyFloor(): number {
    return this.avbdPenaltyFloor;
  }

  setAvbdRegularizationAlpha(alpha: number): void {
    this.avbdRegularizationAlpha = Math.max(0.0, Math.min(1.0, alpha));
  }

  getAvbdRegularizationAlpha(): number {
    return this.avbdRegularizationAlpha;
  }

  setAvbdFriction(friction: number): void {
    const clamped = Math.max(0.0, Math.min(2.0, friction));
    this.avbdFrictionStatic = clamped;
    this.contactGeneration?.setFriction?.(clamped);
    this.avbdState?.setFriction?.(clamped, clamped);
  }

  getAvbdFriction(): number {
    return this.avbdFrictionStatic;
  }

  getRenderBuffers(): { positions: StorageBufferAttribute; quaternions: StorageBufferAttribute } | null {
    if (!this.initialized) return null;

    return {
      positions: this.positionsAttr,
      quaternions: this.quaternionsAttr,
    };
  }

  getContactRenderBuffers(): ContactRenderBuffers | null {
    if (!this.initialized) return null;

    return {
      positions: this.positionsAttr,
      quaternions: this.quaternionsAttr,
      pairContacts: this.pairContactsAttr,
      pairActivity: this.pairActivityAttr,
      maxPairContacts: this.maxPairContacts,
      maxActivePairContacts: this.maxActivePairContacts,
      pairActivityWordCount: this.pairActivityWordCount,
      pairActiveContactsOffset: this.pairActiveContactsOffset,
    };
  }

  getSpringRenderBuffers(): SpringRenderBuffers | null {
    if (!this.initialized) return null;

    return {
      positions: this.positionsAttr,
      quaternions: this.quaternionsAttr,
      springRecords: this.springRecordsAttr,
      maxSprings: this.maxSprings,
    };
  }

  getMaxActiveContactDebugPoints(): number {
    return this.maxActivePairContacts;
  }

  setDebugBehaviorEnabled(enabled: boolean): void {
    this.debugBehaviorEnabled = enabled;
    this.broadPhase?.setDebugEnabled?.(enabled);
    this.contactGeneration?.setDebugEnabled?.(enabled);
    this.avbdState?.setDebugEnabled?.(enabled);
    this.supportDebugReadbackInFlight = false;
    this.lastSupportDebugLogFrame = -1;
    this.prevSupportBodyCount = -1;
    this.prevCandidatePairsForChurn = null;
    this.prevFloorCandidatePairsForChurn = null;
  }

  setDebugEnabled(enabled: boolean): void {
    this.setDebugBehaviorEnabled(enabled);
  }

  setDebugLogEveryFrame(enabled: boolean): void {
    const interval = enabled ? 1 : 30;
    this.debugLogEveryNFrames = interval;
    this.supportDebugEveryNFrames = interval;
    this.lastSupportDebugLogFrame = -1;
    this.broadPhase?.setDebugLogInterval?.(interval);
    this.contactGeneration?.setDebugLogInterval?.(interval);
    this.avbdState?.setDebugLogInterval?.(interval);
  }

  applyPlayerControl(
    renderer: any,
    config: {
      bodyIndex: number;
      targetVelocity: [number, number, number];
      moveGain?: number;
      jumpSpeed?: number;
      jumpRequested?: boolean;
      groundedHint?: boolean;
    },
  ): void {
    if (!this.initialized || !this.playerControl) return;
    if (config.bodyIndex < 0 || config.bodyIndex >= this.bodyCount) return;

    this.playerControl.dispatchControl(
      renderer,
      this.bodyCount,
      config.bodyIndex,
      config.targetVelocity,
      config.moveGain ?? 0.4,
      config.jumpSpeed ?? 6.0,
      config.jumpRequested ?? false,
      config.groundedHint ?? false,
    );
  }

  async readPlayerStateAsync(renderer: any, bodyIndex: number): Promise<PlayerProbeState | null> {
    if (!this.initialized || !this.playerControl) return null;
    if (bodyIndex < 0 || bodyIndex >= this.bodyCount) return null;
    if (!renderer || typeof renderer.getArrayBufferAsync !== 'function') return null;

    this.playerControl.dispatchProbe(renderer, this.bodyCount, bodyIndex);

    const rawBuffer = await renderer.getArrayBufferAsync(this.playerControl.getProbeAttribute());
    const values = new Float32Array(rawBuffer);
    if (values.length < 8) return null;

    return {
      position: [values[0], values[1], values[2]],
      velocity: [values[4], values[5], values[6]],
      grounded: values[3] > 0.5,
    };
  }

  async readRigidBodyStatesAsync(renderer: any): Promise<RigidBodyReadbackState[] | null> {
    if (!this.initialized) return null;
    if (!renderer || typeof renderer.getArrayBufferAsync !== 'function') return null;

    let positionsRaw: ArrayBuffer;
    let quaternionsRaw: ArrayBuffer;
    let velocitiesRaw: ArrayBuffer;
    let angularVelocitiesRaw: ArrayBuffer;
    try {
      positionsRaw = await renderer.getArrayBufferAsync(this.positionsAttr);
    } catch (error) {
      throw new Error(`positions readback failed: ${error instanceof Error ? error.message : String(error)}`);
    }
    try {
      quaternionsRaw = await renderer.getArrayBufferAsync(this.quaternionsAttr);
    } catch (error) {
      throw new Error(`quaternions readback failed: ${error instanceof Error ? error.message : String(error)}`);
    }
    try {
      velocitiesRaw = await renderer.getArrayBufferAsync(this.velocitiesAttr);
    } catch (error) {
      throw new Error(`velocities readback failed: ${error instanceof Error ? error.message : String(error)}`);
    }
    try {
      angularVelocitiesRaw = await renderer.getArrayBufferAsync(this.angularVelAttr);
    } catch (error) {
      throw new Error(`angular velocities readback failed: ${error instanceof Error ? error.message : String(error)}`);
    }

    const positions = new Float32Array(positionsRaw);
    const quaternions = new Float32Array(quaternionsRaw);
    const velocities = new Float32Array(velocitiesRaw);
    const angularVelocities = new Float32Array(angularVelocitiesRaw);
    const states: RigidBodyReadbackState[] = [];

    for (let body = 0; body < this.bodyCount; body++) {
      const bodyBase = body * 4;
      const poseBase = body * 8;
      states.push({
        body,
        position: [
          positions[bodyBase] ?? 0.0,
          positions[bodyBase + 1] ?? 0.0,
          positions[bodyBase + 2] ?? 0.0,
        ],
        initialPosition: [
          this.initialPoseData[poseBase] ?? 0.0,
          this.initialPoseData[poseBase + 1] ?? 0.0,
          this.initialPoseData[poseBase + 2] ?? 0.0,
        ],
        quaternion: [
          quaternions[bodyBase] ?? 0.0,
          quaternions[bodyBase + 1] ?? 0.0,
          quaternions[bodyBase + 2] ?? 0.0,
          quaternions[bodyBase + 3] ?? 1.0,
        ],
        velocity: [
          velocities[bodyBase] ?? 0.0,
          velocities[bodyBase + 1] ?? 0.0,
          velocities[bodyBase + 2] ?? 0.0,
        ],
        angularVelocity: [
          angularVelocities[bodyBase] ?? 0.0,
          angularVelocities[bodyBase + 1] ?? 0.0,
          angularVelocities[bodyBase + 2] ?? 0.0,
        ],
        inverseMass: positions[bodyBase + 3] ?? 0.0,
      });
    }

    return states;
  }

  async readJointStatesAsync(renderer: any, jointIndices?: readonly number[]): Promise<JointReadbackState[] | null> {
    if (!this.initialized) return null;
    if (!renderer || typeof renderer.getArrayBufferAsync !== 'function') return null;

    let jointRecordsRaw: ArrayBuffer;
    try {
      jointRecordsRaw = await renderer.getArrayBufferAsync(this.jointRecordsAttr);
    } catch (error) {
      throw new Error(`joint records readback failed: ${error instanceof Error ? error.message : String(error)}`);
    }

    const jointRecords = new Float32Array(jointRecordsRaw);
    const jointWords = new Uint32Array(jointRecordsRaw);
    const requested = jointIndices ?? Array.from({ length: this.jointCount }, (_, index) => index);
    const states: JointReadbackState[] = [];

    for (const jointIndex of requested) {
      if (jointIndex < 0 || jointIndex >= this.jointCount) continue;

      const metaBase = jointRecordVec4FloatIndex(jointIndex, JOINT_RECORD_META_OFFSET);
      if ((jointWords[metaBase + 3] ?? 0) === 0) continue;

      const bodyAWord = jointWords[metaBase] ?? WORLD_BODY_INDEX;
      const bodyBWord = jointWords[metaBase + 1] ?? 0;
      const jointTypeWord = jointWords[metaBase + 2] ?? 0;

      const anchorABase = jointRecordVec4FloatIndex(jointIndex, JOINT_RECORD_ANCHOR_A_OFFSET);
      const anchorBBase = jointRecordVec4FloatIndex(jointIndex, JOINT_RECORD_ANCHOR_B_OFFSET);
      const restBase = jointRecordVec4FloatIndex(jointIndex, JOINT_RECORD_REST_RELATIVE_ROTATION_OFFSET);
      const stiffnessBase = jointRecordVec4FloatIndex(jointIndex, JOINT_RECORD_STIFFNESS_OFFSET);
      const c0LinBase = jointRecordVec4FloatIndex(jointIndex, JOINT_RECORD_C0_LIN_OFFSET);
      const c0AngBase = jointRecordVec4FloatIndex(jointIndex, JOINT_RECORD_C0_ANG_OFFSET);
      const lambdaLinBase = jointRecordVec4FloatIndex(jointIndex, JOINT_RECORD_LAMBDA_LIN_OFFSET);
      const lambdaAngBase = jointRecordVec4FloatIndex(jointIndex, JOINT_RECORD_LAMBDA_ANG_OFFSET);
      const penaltyLinBase = jointRecordVec4FloatIndex(jointIndex, JOINT_RECORD_PENALTY_LIN_OFFSET);
      const penaltyAngBase = jointRecordVec4FloatIndex(jointIndex, JOINT_RECORD_PENALTY_ANG_OFFSET);

      states.push({
        joint: jointIndex,
        bodyA: bodyAWord === WORLD_BODY_INDEX ? null : bodyAWord,
        bodyB: bodyBWord,
        type: jointTypeWord === 1 ? 'fixed' : 'spherical',
        anchorA: [
          jointRecords[anchorABase] ?? 0.0,
          jointRecords[anchorABase + 1] ?? 0.0,
          jointRecords[anchorABase + 2] ?? 0.0,
        ],
        anchorB: [
          jointRecords[anchorBBase] ?? 0.0,
          jointRecords[anchorBBase + 1] ?? 0.0,
          jointRecords[anchorBBase + 2] ?? 0.0,
        ],
        torqueArm: jointRecords[anchorABase + 3] ?? 0.0,
        restRelative: [
          jointRecords[restBase] ?? 0.0,
          jointRecords[restBase + 1] ?? 0.0,
          jointRecords[restBase + 2] ?? 0.0,
          jointRecords[restBase + 3] ?? 1.0,
        ],
        stiffnessLin: jointRecords[stiffnessBase] ?? 0.0,
        stiffnessAng: jointRecords[stiffnessBase + 1] ?? 0.0,
        c0Lin: [
          jointRecords[c0LinBase] ?? 0.0,
          jointRecords[c0LinBase + 1] ?? 0.0,
          jointRecords[c0LinBase + 2] ?? 0.0,
        ],
        c0Ang: [
          jointRecords[c0AngBase] ?? 0.0,
          jointRecords[c0AngBase + 1] ?? 0.0,
          jointRecords[c0AngBase + 2] ?? 0.0,
        ],
        lambdaLin: [
          jointRecords[lambdaLinBase] ?? 0.0,
          jointRecords[lambdaLinBase + 1] ?? 0.0,
          jointRecords[lambdaLinBase + 2] ?? 0.0,
        ],
        lambdaAng: [
          jointRecords[lambdaAngBase] ?? 0.0,
          jointRecords[lambdaAngBase + 1] ?? 0.0,
          jointRecords[lambdaAngBase + 2] ?? 0.0,
        ],
        penaltyLin: [
          jointRecords[penaltyLinBase] ?? 0.0,
          jointRecords[penaltyLinBase + 1] ?? 0.0,
          jointRecords[penaltyLinBase + 2] ?? 0.0,
        ],
        penaltyAng: [
          jointRecords[penaltyAngBase] ?? 0.0,
          jointRecords[penaltyAngBase + 1] ?? 0.0,
          jointRecords[penaltyAngBase + 2] ?? 0.0,
        ],
      });
    }

    return states;
  }

  async readActiveContactPointsAsync(renderer: any): Promise<DebugContactPoint[] | null> {
    if (!this.initialized) return null;
    if (!renderer || typeof renderer.getArrayBufferAsync !== 'function') return null;

    const [
      activityRaw,
      pairContactsRaw,
      quaternionsRaw,
      positionsRaw,
    ] = await Promise.all([
      renderer.getArrayBufferAsync(this.pairActivityAttr),
      renderer.getArrayBufferAsync(this.pairContactsAttr),
      renderer.getArrayBufferAsync(this.quaternionsAttr),
      renderer.getArrayBufferAsync(this.positionsAttr),
    ]);

    const activity = new Uint32Array(activityRaw);
    const activeContacts = activity.subarray(
      this.pairActiveContactsOffset,
      this.pairActiveContactsOffset + this.maxActivePairContacts + CANDIDATE_LIST_HEADER_WORDS,
    );
    const { meta, arms } = decodePairContactViews(pairContactsRaw, this.maxPairContacts);
    const quaternions = new Float32Array(quaternionsRaw);
    const positions = new Float32Array(positionsRaw);

    const normalizeQuat = (x: number, y: number, z: number, w: number): [number, number, number, number] => {
      const len = Math.hypot(x, y, z, w);
      if (len <= 1e-12) return [0.0, 0.0, 0.0, 1.0];
      const inv = 1.0 / len;
      return [x * inv, y * inv, z * inv, w * inv];
    };
    const rotateVecByQuat = (
      qx: number, qy: number, qz: number, qw: number,
      vx: number, vy: number, vz: number,
    ): [number, number, number] => {
      const tx = 2.0 * (qy * vz - qz * vy);
      const ty = 2.0 * (qz * vx - qx * vz);
      const tz = 2.0 * (qx * vy - qy * vx);
      return [
        vx + qw * tx + (qy * tz - qz * ty),
        vy + qw * ty + (qz * tx - qx * tz),
        vz + qw * tz + (qx * ty - qy * tx),
      ];
    };

    const activeListCount = Math.min(activeContacts[0] ?? 0, this.maxActivePairContacts);
    const points: DebugContactPoint[] = [];
    for (let k = 0; k < activeListCount; k++) {
      const p = activeContacts[k + 1] ?? this.maxPairContacts;
      if (p >= this.maxPairContacts) continue;

      const metaBase = p * 4;
      if ((meta[metaBase + 2] ?? 0.0) < 0.5) continue;

      const i = Math.round(meta[metaBase] ?? -1);
      const j = Math.round(meta[metaBase + 1] ?? -1);
      if (i < 0 || j < 0) continue;

      const iBase = i * 4;
      const jBase = j * 4;
      const iPosX = positions[iBase] ?? 0.0;
      const iPosY = positions[iBase + 1] ?? 0.0;
      const iPosZ = positions[iBase + 2] ?? 0.0;
      const jPosX = positions[jBase] ?? 0.0;
      const jPosY = positions[jBase + 1] ?? 0.0;
      const jPosZ = positions[jBase + 2] ?? 0.0;

      const iQuatBase = i * 4;
      const jQuatBase = j * 4;
      const [iQx, iQy, iQz, iQw] = normalizeQuat(
        quaternions[iQuatBase] ?? 0.0,
        quaternions[iQuatBase + 1] ?? 0.0,
        quaternions[iQuatBase + 2] ?? 0.0,
        quaternions[iQuatBase + 3] ?? 1.0,
      );
      const [jQx, jQy, jQz, jQw] = normalizeQuat(
        quaternions[jQuatBase] ?? 0.0,
        quaternions[jQuatBase + 1] ?? 0.0,
        quaternions[jQuatBase + 2] ?? 0.0,
        quaternions[jQuatBase + 3] ?? 1.0,
      );

      const armBase = p * 8;
      const [raX, raY, raZ] = rotateVecByQuat(
        iQx,
        iQy,
        iQz,
        iQw,
        arms[armBase] ?? 0.0,
        arms[armBase + 1] ?? 0.0,
        arms[armBase + 2] ?? 0.0,
      );
      const [rbX, rbY, rbZ] = rotateVecByQuat(
        jQx,
        jQy,
        jQz,
        jQw,
        arms[armBase + 4] ?? 0.0,
        arms[armBase + 5] ?? 0.0,
        arms[armBase + 6] ?? 0.0,
      );

      const pointAX = iPosX + raX;
      const pointAY = iPosY + raY;
      const pointAZ = iPosZ + raZ;
      const pointBX = jPosX + rbX;
      const pointBY = jPosY + rbY;
      const pointBZ = jPosZ + rbZ;

      points.push({
        x: 0.5 * (pointAX + pointBX),
        y: 0.5 * (pointAY + pointBY),
        z: 0.5 * (pointAZ + pointBZ),
      });
    }

    return points;
  }

  private findSupportFloorBody(
    positions: Float32Array,
    shapes: Float32Array,
  ): { body: number; topY: number } {
    let floorBody = -1;
    let floorFootprint = -1.0;
    let floorCenterY = Number.POSITIVE_INFINITY;
    let floorTopY = Number.NEGATIVE_INFINITY;

    for (let body = 0; body < this.bodyCount; body++) {
      const base = body * 4;
      const inverseMass = positions[base + 3] ?? 0.0;
      if (inverseMass !== 0.0) continue;

      const centerY = positions[base + 1] ?? 0.0;
      const halfX = Math.max(0.0, shapes[base + 1] ?? 0.0);
      const halfY = Math.max(0.0, shapes[base + 2] ?? 0.0);
      const halfZ = Math.max(0.0, shapes[base + 3] ?? 0.0);
      const footprint = halfX * halfZ;
      const largerFootprint = footprint > floorFootprint * 1.05;
      const tieButLower = Math.abs(footprint - floorFootprint) <= 1e-6 && centerY < floorCenterY;
      if (floorBody < 0 || largerFootprint || tieButLower) {
        floorBody = body;
        floorFootprint = footprint;
        floorCenterY = centerY;
        floorTopY = centerY + halfY;
      }
    }

    return { body: floorBody, topY: floorTopY };
  }

  private logSupportDiagnostics(renderer: any): void {
    if (!this.debugBehaviorEnabled) return;
    if (!renderer || typeof renderer.getArrayBufferAsync !== 'function') return;
    if (this.supportDebugReadbackInFlight) return;
    if (
      this.lastSupportDebugLogFrame >= 0
      && this.frameId - this.lastSupportDebugLogFrame < this.supportDebugEveryNFrames
    ) {
      return;
    }

    const sampledFrame = this.frameId;
    this.supportDebugReadbackInFlight = true;
    this.lastSupportDebugLogFrame = sampledFrame;

    Promise.all([
      renderer.getArrayBufferAsync(this.pairActivityAttr),
      renderer.getArrayBufferAsync(this.pairContactsAttr),
      renderer.getArrayBufferAsync(this.positionsAttr),
      renderer.getArrayBufferAsync(this.shapesAttr),
    ]).then(([activityRaw, pairContactsRaw, positionsRaw, shapesRaw]: ArrayBuffer[]) => {
      const activity = new Uint32Array(activityRaw);
      const { meta } = decodePairContactViews(pairContactsRaw, this.maxPairContacts);
      const positions = new Float32Array(positionsRaw);
      const shapes = new Float32Array(shapesRaw);

      if (this.prevSupportBodyCount !== this.bodyCount) {
        this.prevSupportBodyCount = this.bodyCount;
        this.prevCandidatePairsForChurn = null;
        this.prevFloorCandidatePairsForChurn = null;
      }

      const { body: floorBody, topY: floorTopY } = this.findSupportFloorBody(positions, shapes);

      if (floorBody < 0) {
        this.prevCandidatePairsForChurn = null;
        this.prevFloorCandidatePairsForChurn = null;
        return;
      }

      const nearFloorDynamicBodies = new Set<number>();
      const nearFloorBand = 0.12;
      const lowerBand = -0.75;
      for (let body = 0; body < this.bodyCount; body++) {
        if (body === floorBody) continue;
        const base = body * 4;
        const inverseMass = positions[base + 3] ?? 0.0;
        if (inverseMass <= 0.0) continue;
        const centerY = positions[base + 1] ?? 0.0;
        const halfY = Math.max(0.0, shapes[base + 2] ?? 0.0);
        const bottomGap = (centerY - halfY) - floorTopY;
        if (bottomGap <= nearFloorBand && bottomGap >= lowerBand) {
          nearFloorDynamicBodies.add(body);
        }
      }

      const candidateSpan = Math.min(
        activity[this.pairCandidateIndicesOffset] ?? 0,
        this.maxCandidatePairs,
      );
      const candidatePairs = new Set<number>();
      const floorCandidatePairs = new Set<number>();
      const floorCandidateBodies = new Set<number>();
      for (let slot = 0; slot < candidateSpan; slot++) {
        const packed = activity[this.pairCandidateIndicesOffset + 1 + slot] ?? 0xFFFFFFFF;
        const i = packed & 0xFFFF;
        const j = packed >>> 16;
        if (i >= j || j >= this.bodyCount) continue;
        candidatePairs.add(packed);
        if (i === floorBody || j === floorBody) {
          floorCandidatePairs.add(packed);
          floorCandidateBodies.add(i === floorBody ? j : i);
        }
      }

      const activeContactCount = Math.min(
        activity[this.pairActiveContactsOffset] ?? 0,
        this.maxActivePairContacts,
      );
      const floorActiveBodies = new Set<number>();
      for (let idx = 0; idx < activeContactCount; idx++) {
        const contact = activity[this.pairActiveContactsOffset + 1 + idx] ?? this.maxPairContacts;
        if (contact >= this.maxPairContacts) continue;
        const metaBase = contact * 4;
        const i = Math.round(meta[metaBase] ?? -1);
        const j = Math.round(meta[metaBase + 1] ?? -1);
        if (i < 0 || j < 0 || i >= j || j >= this.bodyCount) continue;
        if (i === floorBody || j === floorBody) {
          floorActiveBodies.add(i === floorBody ? j : i);
        }
      }

      let candidateSupported = 0;
      let activeSupported = 0;
      for (const body of nearFloorDynamicBodies) {
        if (floorCandidateBodies.has(body)) candidateSupported++;
        if (floorActiveBodies.has(body)) activeSupported++;
      }

      const nearFloorCount = nearFloorDynamicBodies.size;
      const candidateRecall = nearFloorCount > 0 ? candidateSupported / nearFloorCount : 1.0;
      const activeRecall = nearFloorCount > 0 ? activeSupported / nearFloorCount : 1.0;
      const broadphaseLost = Math.max(0, nearFloorCount - candidateSupported);
      const contactRejected = Math.max(0, candidateSupported - activeSupported);

      const previousCandidate = this.prevCandidatePairsForChurn;
      const previousFloorCandidate = this.prevFloorCandidatePairsForChurn;
      let jaccard = 1.0;
      let added = 0;
      let removed = 0;
      if (previousCandidate) {
        let intersection = 0;
        for (const pair of candidatePairs) {
          if (previousCandidate.has(pair)) intersection++;
          else added++;
        }
        for (const pair of previousCandidate) {
          if (!candidatePairs.has(pair)) removed++;
        }
        const union = candidatePairs.size + previousCandidate.size - intersection;
        jaccard = union > 0 ? intersection / union : 1.0;
      }

      let floorJaccard = 1.0;
      if (previousFloorCandidate) {
        let floorIntersection = 0;
        for (const pair of floorCandidatePairs) {
          if (previousFloorCandidate.has(pair)) floorIntersection++;
        }
        const floorUnion = floorCandidatePairs.size + previousFloorCandidate.size - floorIntersection;
        floorJaccard = floorUnion > 0 ? floorIntersection / floorUnion : 1.0;
      }

      this.prevCandidatePairsForChurn = candidatePairs;
      this.prevFloorCandidatePairsForChurn = floorCandidatePairs;

      console.info(
        `[Support Debug] frame=${sampledFrame} floor=${floorBody} nearFloor=${nearFloorCount} ` +
        `candSupport=${candidateSupported}(${(100.0 * candidateRecall).toFixed(1)}%) ` +
        `activeSupport=${activeSupported}(${(100.0 * activeRecall).toFixed(1)}%) ` +
        `broadphaseLost=${broadphaseLost} contactRejected=${contactRejected} ` +
        `pairs=${candidatePairs.size} floorPairs=${floorCandidatePairs.size} ` +
        `jaccard=${jaccard.toFixed(3)} floorJaccard=${floorJaccard.toFixed(3)} ` +
        `added=${added} removed=${removed}`,
      );
    }).catch((error: unknown) => {
      console.warn('Support debug readback failed:', error);
    }).finally(() => {
      this.supportDebugReadbackInFlight = false;
    });
  }

}
