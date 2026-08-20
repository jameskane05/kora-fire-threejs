import { IndirectStorageBufferAttribute, StorageBufferAttribute } from 'three/webgpu';
import { INDIRECT_DISPATCH_DISABLED } from './indirectDispatch';
import { storage, uniform, workgroupId, localId, wgsl, wgslFn } from './tslCompat';
import { qrot, qconj, qmul } from './quatUtils';
import { AVBD_COLLISION_MARGIN, AVBD_FRICTION_DYNAMIC, AVBD_FRICTION_STATIC } from '../avbdParams';
import type { AvbdBodySolveMode } from '../types';
import { assertStorageBufferBudget } from './bindingBudget';
import {
  CONTACT_RECORD_ARM_A_OFFSET,
  CONTACT_RECORD_ARM_B_OFFSET,
  CONTACT_RECORD_CONSTRAINT_C0_OFFSET,
  CONTACT_RECORD_CACHE_OFFSET,
  CONTACT_RECORD_DUAL_OFFSET,
  CONTACT_RECORD_FLOATS,
  CONTACT_RECORD_META_OFFSET,
  CONTACT_RECORD_NORMAL_PEN_OFFSET,
  CONTACT_RECORD_PENALTY_OFFSET,
  CONTACT_RECORD_VEC4S,
  contactRecordHelpers,
  contactRecordVec4FloatIndex,
} from './contactRecord';
import {
  JOINT_RECORD_VEC4S,
  jointRecordHelpers,
} from './jointRecord';
import {
  SPRING_RECORD_VEC4S,
  springRecordHelpers,
} from './springRecord';

const WORKGROUP_SIZE = 64;
const AVBD_GAMMA = 0.99;
const AVBD_BETA = 10.0;
const AVBD_K_START = 1.0;
const AVBD_JOINT_PENALTY_MAX = 10000000000.0;
const AVBD_STICK_THRESHOLD = 1e-5;
const AVBD_REGULARIZATION_ALPHA_DEFAULT = 0.95;
const INERTIAL_POSE_VEC4S_PER_BODY = 4;
const BODY_COLOR_FALLBACK_FLAG = 0x01000000;
const BODY_COLOR_REPAIR_FLAG = 0x02000000;
const CONSTRAINT_REF_TAG_MASK = 0xc0000000;
const CONSTRAINT_REF_INDEX_MASK = 0x3fffffff;
const CONSTRAINT_REF_TAG_JOINT = 0x80000000;
const CONSTRAINT_REF_TAG_SPRING = 0xc0000000;
const BODY_COLOR_HARD_REPAIR_ROUNDS = 2;
const tangentBasisHelpers = wgsl(/* wgsl */`
      const TANGENT_BASIS_TWO_PI: f32 = 6.283185307179586;

      struct TangentBasis {
        t1: vec3f,
        t2: vec3f,
      };

      fn canonicalTangentBasis(n: vec3f) -> TangentBasis {
        let refAxis = select(vec3f(0.0, 1.0, 0.0), vec3f(1.0, 0.0, 0.0), abs(n.y) > 0.999);
        let t1Raw = cross(refAxis, n);
        let t1Len2 = dot(t1Raw, t1Raw);
        var t1 = vec3f(0.0, 0.0, 1.0);
        if (t1Len2 > 1e-12) {
          t1 = t1Raw * inverseSqrt(t1Len2);
        }
        let t2Raw = cross(n, t1);
        let t2Len2 = dot(t2Raw, t2Raw);
        var t2 = vec3f(1.0, 0.0, 0.0);
        if (t2Len2 > 1e-12) {
          t2 = t2Raw * inverseSqrt(t2Len2);
        }
        return TangentBasis(t1, t2);
      }

      fn tangentBasisFromPreferredT1(n: vec3f, preferredT1: vec3f) -> TangentBasis {
        let projected = preferredT1 - n * dot(preferredT1, n);
        let projectedLen2 = dot(projected, projected);
        if (projectedLen2 <= 1e-12) {
          return canonicalTangentBasis(n);
        }
        let t1 = projected * inverseSqrt(projectedLen2);
        let t2Raw = cross(n, t1);
        let t2Len2 = dot(t2Raw, t2Raw);
        if (t2Len2 <= 1e-12) {
          return canonicalTangentBasis(n);
        }
        let t2 = t2Raw * inverseSqrt(t2Len2);
        return TangentBasis(t1, t2);
      }

      fn tangentBasisFromAngle(n: vec3f, theta: f32) -> TangentBasis {
        let canonical = canonicalTangentBasis(n);
        let c = cos(theta);
        let s = sin(theta);
        let t1 = canonical.t1 * c + canonical.t2 * s;
        return tangentBasisFromPreferredT1(n, t1);
      }
`);

const contactStateHelpers = wgsl(/* wgsl */`
      struct AvbdContactShadow {
        packed: vec4f,
        lambdaN: f32,
        lambdaTB: vec2f,
        frictionScale: f32,
      };

      struct AvbdContactState {
        dual: vec4f,
        penalty: vec4f,
        lambdaN: f32,
        penaltyN: f32,
        frictionScale: f32,
      };

      struct AvbdContactRecord {
        state: AvbdContactState,
        shadow: AvbdContactShadow,
      };

      fn makeContactState(
        dual: vec4f,
        penalty: vec4f,
        fallbackFrictionScale: f32,
        kStart: f32,
      ) -> AvbdContactState {
        let dualN = min(dual.x, 0.0);
        let penaltyN = max(penalty.x, kStart);
        let penaltyFrictionScale = max(penalty.w, 0.0);
        let frictionScale = max(
          select(fallbackFrictionScale, penaltyFrictionScale, penaltyFrictionScale > 0.0),
          0.0,
        );
        return AvbdContactState(
          dual,
          vec4f(penaltyN, penalty.y, penalty.z, frictionScale),
          max(-dualN, 0.0),
          penaltyN,
          frictionScale,
        );
      }

      fn makeContactShadow(shadow: vec4f) -> AvbdContactShadow {
        let frictionScale = max(shadow.w, 0.0);
        let lambdaN = max(shadow.x, 0.0);
        return AvbdContactShadow(
          vec4f(lambdaN, shadow.y, shadow.z, frictionScale),
          lambdaN,
          shadow.yz,
          frictionScale,
        );
      }

      fn makeContactRecord(
        dual: vec4f,
        penalty: vec4f,
        shadow: vec4f,
        kStart: f32,
      ) -> AvbdContactRecord {
        let contactShadow = makeContactShadow(shadow);
        let contactState = makeContactState(
          dual,
          penalty,
          contactShadow.frictionScale,
          kStart,
        );
        return AvbdContactRecord(contactState, contactShadow);
      }

      // Hot solver passes only need live dual/penalty state. The friction scale is
      // mirrored into penalty.w during prepare/capture so they can avoid pulling
      // shadow/cache data from global memory on every contact touch.
      fn loadContactStateHot(
        pairContacts: ptr<storage, array<vec4f>, read_write>,
        p: u32,
        kStart: f32,
      ) -> AvbdContactState {
        let penalty = loadContactPenalty(pairContacts, p);
        return makeContactState(
          loadContactDual(pairContacts, p),
          penalty,
          max(penalty.w, 0.0),
          kStart,
        );
      }

      fn loadContactRecord(
        pairContacts: ptr<storage, array<vec4f>, read_write>,
        p: u32,
        kStart: f32,
      ) -> AvbdContactRecord {
        var record = makeContactRecord(
          loadContactDual(pairContacts, p),
          loadContactPenalty(pairContacts, p),
          loadContactShadow(pairContacts, p),
          kStart,
        );
        return record;
      }

      fn packContactPenalty(penaltyN: f32, penaltyTB: vec2f, frictionScale: f32, kStart: f32) -> vec4f {
        return vec4f(
          max(penaltyN, kStart),
          max(penaltyTB.x, kStart),
          max(penaltyTB.y, kStart),
          max(frictionScale, 0.0),
        );
      }

      fn packContactShadow(lambdaN: f32, lambdaTB: vec2f, frictionScale: f32) -> vec4f {
        return vec4f(max(lambdaN, 0.0), lambdaTB, max(frictionScale, 0.0));
      }

      fn storeContactRecord(
        pairContacts: ptr<storage, array<vec4f>, read_write>,
        p: u32,
        dual: vec4f,
        penaltyN: f32,
        penaltyTB: vec2f,
        lambdaN: f32,
        lambdaTB: vec2f,
        frictionScale: f32,
        kStart: f32,
      ) {
        storeContactDual(pairContacts, p, dual);
        storeContactPenalty(pairContacts, p, packContactPenalty(
          penaltyN,
          penaltyTB,
          frictionScale,
          kStart,
        ));
        storeContactShadow(pairContacts, p, packContactShadow(
          lambdaN,
          lambdaTB,
          frictionScale,
        ));
      }

      fn packSeedDualFromShadow(
        shadow: AvbdContactShadow,
        n: vec3f,
        t1: vec3f,
        t2: vec3f,
        useReferenceTangentialUpdate: u32,
      ) -> vec4f {
        let seedDualN = -shadow.lambdaN;
        let seedDualTWorld = t1 * shadow.lambdaTB.x + t2 * shadow.lambdaTB.y;
        return select(
          vec4f(seedDualN, seedDualTWorld),
          vec4f(seedDualN, shadow.lambdaTB, 0.0),
          useReferenceTangentialUpdate > 0u,
        );
      }

      fn contactStateDualTB(
        state: AvbdContactState,
        n: vec3f,
        t1: vec3f,
        t2: vec3f,
        useReferenceTangentialUpdate: u32,
      ) -> vec2f {
        let dualTWorldRaw = state.dual.yzw;
        let dualTWorld = dualTWorldRaw - n * dot(dualTWorldRaw, n);
        return select(
          vec2f(dot(dualTWorld, t1), dot(dualTWorld, t2)),
          state.dual.yz,
          useReferenceTangentialUpdate > 0u,
        );
      }
`);


const jointConstraintHelpers = wgsl(/* wgsl */`
      const WORLD_BODY_INDEX: u32 = 0xffffffffu;
      const JOINT_TYPE_SPHERICAL: u32 = 0u;
      const JOINT_TYPE_FIXED: u32 = 1u;

      struct JointPoseState {
        position: vec3f,
        rotation: vec4f,
      };

      fn isFiniteF32(value: f32) -> bool {
        return value == value && abs(value) <= 0x1.fffffep+127f;
      }

      fn integrateQuaternionBackByAngularVelocity(
        currentQ: vec4f,
        angularVelocity: vec3f,
        dt: f32,
      ) -> vec4f {
        let speed = length(angularVelocity);
        if (speed <= 1e-8 || dt <= 0.0) {
          return normalize(currentQ);
        }
        let axis = angularVelocity / speed;
        let halfAngle = 0.5 * speed * dt;
        let delta = vec4f(axis * sin(halfAngle), cos(halfAngle));
        return normalize(qmul(qconj(delta), normalize(currentQ)));
      }

      fn jointRegularizationPose(
        bodyIndex: u32,
        initialPose: ptr<storage, array<vec4f>, read>,
        positions: ptr<storage, array<vec4f>, read>,
        quaternions: ptr<storage, array<vec4f>, read>,
        velocities: ptr<storage, array<vec4f>, read>,
        angularVelocities: ptr<storage, array<vec4f>, read>,
        dt: f32,
      ) -> JointPoseState {
        if (bodyIndex == WORLD_BODY_INDEX) {
          return JointPoseState(vec3f(0.0), vec4f(0.0, 0.0, 0.0, 1.0));
        }

        let invMass = positions[bodyIndex].w;
        if (invMass == 0.0) {
          let currentPos = positions[bodyIndex].xyz;
          let currentQ = normalize(quaternions[bodyIndex]);
          let previousPos = currentPos - velocities[bodyIndex].xyz * dt;
          let previousQ = integrateQuaternionBackByAngularVelocity(
            currentQ,
            angularVelocities[bodyIndex].xyz,
            dt,
          );
          return JointPoseState(previousPos, previousQ);
        }

        let poseBase = bodyIndex * 2u;
        return JointPoseState(
          initialPose[poseBase].xyz,
          normalize(initialPose[poseBase + 1u]),
        );
      }

      fn jointWorldAnchor(
        bodyIndex: u32,
        anchorLocal: vec3f,
        position: vec3f,
        rotation: vec4f,
      ) -> vec3f {
        return select(position + qrot(rotation, anchorLocal), anchorLocal, bodyIndex == WORLD_BODY_INDEX);
      }

      fn jointFixedAngularConstraint(
        bodyA: u32,
        qA: vec4f,
        qB: vec4f,
        torqueArm: f32,
      ) -> vec3f {
        let worldQA = normalize(select(qA, vec4f(0.0, 0.0, 0.0, 1.0), bodyA == WORLD_BODY_INDEX));
        let delta = qmul(worldQA, qconj(normalize(qB)));
        return 2.0 * delta.xyz * torqueArm;
      }

      fn jointBallSocketGeometricDiagonal(r: vec3f, force: vec3f) -> vec3f {
        let col0 = vec3f(
          -force.y * r.y - force.z * r.z,
          force.x * r.y,
          force.x * r.z,
        );
        let col1 = vec3f(
          force.y * r.x,
          -force.x * r.x - force.z * r.z,
          force.y * r.z,
        );
        let col2 = vec3f(
          force.z * r.x,
          force.z * r.y,
          -force.x * r.x - force.y * r.y,
        );
        return vec3f(length(col0), length(col1), length(col2));
      }

      // NOTE: the 6x6 system matrix is stored flat (array<f32, 36>, row-major)
      // because WebKit's WGSL->Metal compiler miscompiles nested private arrays
      // accessed from multiple dynamic inner loops (stores get sunk/lost),
      // which NaN'd the whole solver on visionOS/macOS Safari.
      fn addDiagonalVectorConstraint(
        lhs: ptr<function, array<f32, 36>>,
        rhs: ptr<function, array<f32, 6>>,
        j0: array<f32, 6>,
        j1: array<f32, 6>,
        j2: array<f32, 6>,
        stiffness: vec3f,
        force: vec3f,
      ) {
        for (var axis = 0u; axis < 3u; axis++) {
          let k = max(stiffness[axis], 0.0);
          if (k <= 0.0) { continue; }
          let f = force[axis];
          var row = j0;
          if (axis == 1u) { row = j1; }
          if (axis == 2u) { row = j2; }
          for (var r = 0u; r < 6u; r++) {
            (*rhs)[r] += row[r] * f;
            for (var c = 0u; c < 6u; c++) {
              (*lhs)[r * 6u + c] += k * row[r] * row[c];
            }
          }
        }
      }

      fn addScalarConstraint(
        lhs: ptr<function, array<f32, 36>>,
        rhs: ptr<function, array<f32, 6>>,
        row: array<f32, 6>,
        stiffness: f32,
        force: f32,
      ) {
        let k = max(stiffness, 0.0);
        if (k <= 0.0) { return; }
        for (var r = 0u; r < 6u; r++) {
          (*rhs)[r] += row[r] * force;
          for (var c = 0u; c < 6u; c++) {
            (*lhs)[r * 6u + c] += k * row[r] * row[c];
          }
        }
      }
`);

type PrimalSolveTuning = {
  relaxation?: number;
  frictionRelaxation?: number;
  inertialDiagWeight?: number;
  maxLinearCorrection?: number;
  maxAngularCorrection?: number;
};

export class AvbdStateStage {
  private readonly buildContactDispatchArgsKernel: any;
  private readonly clearPhaseDebugCountersKernel: any;
  private readonly accumulatePhaseDebugCountersKernel: any;
  private readonly clearDebugCountersKernel: any;
  private readonly accumulateDebugCountersKernel: any;
  private readonly accumulateBodyColorDebugCountersKernel: any;
  private readonly prepareStateKernel: any;
  private readonly prepareJointStateKernel: any;
  private readonly buildSolverConstraintListsKernel: any;
  private readonly appendJointConstraintRefsKernel: any;
  private readonly appendSpringConstraintRefsKernel: any;
  private readonly greedyBodyColorsKernel: any;
  private readonly markHardColorConflictsKernel: any;
  private readonly repairHardBodyColorsKernel: any;
  private readonly primalBodySolveKernelGeneric: any;
  private readonly primalBodySolveKernelLocalDiag: any;
  private readonly primalBodySolveKernel: any;
  private readonly commitBodySolveKernel: any;
  private readonly capturePairDualStateKernel: any;
  private readonly captureJointDualStateKernel: any;
  private readonly finalizeVelocitiesKernel: any;

  private readonly contactDispatchIndirectAttr: IndirectStorageBufferAttribute;
  private readonly phaseDebugCountersAttr: StorageBufferAttribute;
  private readonly debugCountersAttr: StorageBufferAttribute;
  private readonly pairContactsAttr: StorageBufferAttribute;
  private readonly jointRecordsAttr: StorageBufferAttribute;
  private readonly springRecordsAttr: StorageBufferAttribute;
  private readonly positionsAttr: StorageBufferAttribute;
  private readonly initialPoseAttr: StorageBufferAttribute;
  private readonly quaternionsAttr: StorageBufferAttribute;
  private readonly pairActivityAttr: StorageBufferAttribute;
  private readonly bodySolveOutputPoseAttr: StorageBufferAttribute;
  private readonly maxPairContacts: number;
  private readonly maxJoints: number;
  private readonly maxSprings: number;
  private readonly maxActivePairContacts: number;
  private readonly pairActiveContactsOffset: number;
  private readonly contactKeySlotBitCount: number;
  private readonly useLocalDiagonalPrimalSolveFastPath = false;
  private debugEnabled = false;
  private debugReadbackInFlight = false;
  private separatingTraceReadbackInFlight = false;
  private separatingTraceArmed = true;
  private lastDebugLogFrame = -1;
  private debugEveryNFrames = 30;

  constructor(
    pairContacts: StorageBufferAttribute,
    jointRecords: StorageBufferAttribute,
    springRecords: StorageBufferAttribute,
    positions: StorageBufferAttribute,
    initialPose: StorageBufferAttribute,
    inertialPose: StorageBufferAttribute,
    quaternions: StorageBufferAttribute,
    velocities: StorageBufferAttribute,
    prevLinearVelocities: StorageBufferAttribute,
    angularVelocities: StorageBufferAttribute,
    inverseInertia: StorageBufferAttribute,
    derivedInvInertia: StorageBufferAttribute,
    bodyConstraintCounts: StorageBufferAttribute,
    bodyConstraintRefs: StorageBufferAttribute,
    pairBodyContactCounts: StorageBufferAttribute,
    pairBodyContactIndices: StorageBufferAttribute,
    bodyColorScratch: StorageBufferAttribute,
    pairActivity: StorageBufferAttribute,
    maxBodies: number,
    maxPairContacts: number,
    maxJoints: number,
    maxSprings: number,
    maxActivePairContacts: number,
    maxConstraintsPerBody: number,
    maxPairContactsPerBody: number,
    pairManifoldSlots: number,
    pairActiveContactsOffset: number,
    pairActivityWordCount: number,
  ) {
    this.pairContactsAttr = pairContacts;
    this.jointRecordsAttr = jointRecords;
    this.springRecordsAttr = springRecords;
    this.positionsAttr = positions;
    this.initialPoseAttr = initialPose;
    this.quaternionsAttr = quaternions;
    this.pairActivityAttr = pairActivity;
    this.bodySolveOutputPoseAttr = new StorageBufferAttribute(new Float32Array(maxBodies * 2 * 4), 4);
    this.bodySolveOutputPoseAttr.name = 'AVBD Body Solve Output Pose';
    this.maxPairContacts = maxPairContacts;
    this.maxJoints = maxJoints;
    this.maxSprings = maxSprings;
    this.maxActivePairContacts = maxActivePairContacts;
    this.pairActiveContactsOffset = pairActiveContactsOffset;
    const clampedPairManifoldSlots = Math.max(1, Math.min(8, Math.floor(pairManifoldSlots)));
    const contactKeySlotBitCount = Math.ceil(Math.log2(clampedPairManifoldSlots));
    this.contactKeySlotBitCount = contactKeySlotBitCount;
    const contactKeyFeatureBitCount = 9;
    const contactKeyBaseBitCount = Math.max(1, 31 - contactKeySlotBitCount);
    const contactKeyPairHashBitCount = Math.max(1, contactKeyBaseBitCount - contactKeyFeatureBitCount);
    const contactKeyPairHashMax = Math.max(1, (2 ** contactKeyPairHashBitCount) - 1);

    this.contactDispatchIndirectAttr = new IndirectStorageBufferAttribute(new Uint32Array([0, 1, 1]), 1);
    this.contactDispatchIndirectAttr.name = 'AVBD Contact Dispatch Indirect';
    // debugCounters layout:
    // 0 = scannedContacts
    // 1 = validNormals
    // 2 = frictionBoundedContacts
    // 3 = staticRegimeContacts
    // 4 = nearConeLimitContacts
    // 5 = tinyNormalForceContacts
    // 6 = normalYPositive
    // 7 = normalYNegative
    // 8 = coneBoundViolations
    // 9 = nearVerticalNormals
    // 10 = nearHorizontalNormals
    // 11 = constrainedBodies
    // 12 = fallbackColoredBodies
    // 13 = totalBodyConstraintRefs
    // 14 = saturatedBodyConstraintLists
    // 15 = maxBodyConstraintRefs
    // 16 = coloredConstraintEdges
    // 17 = sameColorConstraintEdges
    this.debugCountersAttr = new StorageBufferAttribute(new Uint32Array(18), 1);
    // phaseDebugCounters layout (9 counters per phase):
    // main phase [0..8], post phase [9..17]
    // 0 scanned
    // 1 frictionBounded
    // 2 nearCone
    // 3 tinyNormalApplied
    // 4 normalYPositive
    // 5 normalYNegative
    // 6 separatingCRegN
    // 7 coneClampApplied
    // 8 frictionSuppressedSeparated
    this.phaseDebugCountersAttr = new StorageBufferAttribute(new Uint32Array(18), 1);

    const buildContactDispatchArgsShader = wgslFn(/* wgsl */`
      fn compute(
        pairActivity: ptr<storage, array<u32>, read_write>,
        dispatchIndirect: ptr<storage, array<u32>, read_write>,
        pairDispatchCount: u32,
      ) -> void {
        let activeCount = min(min(pairActivity[${pairActiveContactsOffset}u], pairDispatchCount), ${maxActivePairContacts}u);
        let workgroups = (activeCount + ${WORKGROUP_SIZE}u - 1u) / ${WORKGROUP_SIZE}u;
        dispatchIndirect[0] = workgroups;
        dispatchIndirect[1] = 1u;
        dispatchIndirect[2] = 1u;
      }
    `);

    this.buildContactDispatchArgsKernel = buildContactDispatchArgsShader({
      pairActivity: storage(pairActivity, 'uint', pairActivityWordCount),
      dispatchIndirect: storage(this.contactDispatchIndirectAttr, 'uint', 3),
      pairDispatchCount: uniform(0),
    }).computeKernel([1, 1, 1]).setName('AVBD Build Contact Dispatch Args');

    const clearPhaseDebugCountersShader = wgslFn(/* wgsl */`
      fn compute(
        phaseDebugCounters: ptr<storage, array<atomic<u32>>, read_write>,
      ) -> void {
        for (var i = 0u; i < 18u; i++) {
          atomicStore(&phaseDebugCounters[i], 0u);
        }
      }
    `);

    this.clearPhaseDebugCountersKernel = clearPhaseDebugCountersShader({
      phaseDebugCounters: storage(this.phaseDebugCountersAttr, 'uint', 18).toAtomic(),
    }).computeKernel([1, 1, 1]).setName('AVBD Clear Phase Debug Counters');

    const accumulatePhaseDebugCountersShader = wgslFn(/* wgsl */`
      fn compute(
        positions: ptr<storage, array<vec4f>, read>,
        quaternions: ptr<storage, array<vec4f>, read>,
        initialPose: ptr<storage, array<vec4f>, read>,
        pairContacts: ptr<storage, array<vec4f>, read_write>,
        pairActivity: ptr<storage, array<u32>, read_write>,
        phaseDebugCounters: ptr<storage, array<atomic<u32>>, read_write>,
        pairDispatchCount: u32,
        regularizationAlpha: f32,
        tangentialRegularizationAlpha: f32,
        phaseOffset: u32,
        frictionSolveScale: f32,
        useReferenceTangentialUpdate: u32,
        frictionStatic: f32,
        frictionDynamic: f32,
        kStart: f32,
        dualForceMax: f32,
        enableNormalReleaseHeuristic: u32,
        useNormalContactMargin: u32,
        useLocalContactArms: u32,
        workgroupId: vec3u,
        localId: vec3u,
      ) -> void {
        let gid = workgroupId.x * ${WORKGROUP_SIZE}u + localId.x;
        let activeCount = min(min(pairActivity[${pairActiveContactsOffset}u], pairDispatchCount), ${maxActivePairContacts}u);
        if (gid >= activeCount) { return; }

        let p = pairActivity[${pairActiveContactsOffset}u + gid + 1u];
        if (p >= ${maxPairContacts}u) { return; }
        let base = min(phaseOffset, 9u);
        atomicAdd(&phaseDebugCounters[base + 0u], 1u);

        let n = loadContactNormalPen(pairContacts, p).xyz;
        if (dot(n, n) <= 1e-10) { return; }

        if (n.y >= 0.0) {
          atomicAdd(&phaseDebugCounters[base + 4u], 1u);
        } else {
          atomicAdd(&phaseDebugCounters[base + 5u], 1u);
        }

        let armA = loadContactArmA(pairContacts, p);
        let armB = loadContactArmB(pairContacts, p);
        let contactMeta = loadContactMeta(pairContacts, p);
        let i = u32(contactMeta.x + 0.5);
        let j = u32(contactMeta.y + 0.5);
        if (i >= ${maxBodies}u || j >= ${maxBodies}u || i == j) { return; }

        let raStored = armA.xyz;
        let rbStored = armB.xyz;
        let posA = positions[i].xyz;
        let posB = positions[j].xyz;
        let qA = normalize(quaternions[i]);
        let qB = normalize(quaternions[j]);
        let poseBaseA = i * 2u;
        let poseBaseB = j * 2u;
        let prevPosA = initialPose[poseBaseA].xyz;
        let prevPosB = initialPose[poseBaseB].xyz;
        let prevQA = normalize(initialPose[poseBaseA + 1u]);
        let prevQB = normalize(initialPose[poseBaseB + 1u]);
        let localContactArms = useLocalContactArms > 0u;
        let ra = select(raStored, qrot(qA, raStored), localContactArms);
        let rb = select(rbStored, qrot(qB, rbStored), localContactArms);
        let dqAraw = qmul(qA, qconj(prevQA));
        let dqBraw = qmul(qB, qconj(prevQB));
        let dqA = select(dqAraw, -dqAraw, dqAraw.w < 0.0);
        let dqB = select(dqBraw, -dqBraw, dqBraw.w < 0.0);
        let dThetaA = 2.0 * dqA.xyz;
        let dThetaB = 2.0 * dqB.xyz;
        let dPosA = posA - prevPosA;
        let dPosB = posB - prevPosB;

        let jAL = -n;
        let jBL = n;
        let jAA = -cross(ra, n);
        let jBA = cross(rb, n);

        let tangentBasis = tangentBasisFromAngle(n, armA.w);
        let t1 = tangentBasis.t1;
        let t2 = tangentBasis.t2;

        let jt1AL = -t1;
        let jt1BL = t1;
        let jt1AA = -cross(ra, t1);
        let jt1BA = cross(rb, t1);
        let jt2AL = -t2;
        let jt2BL = t2;
        let jt2AA = -cross(ra, t2);
        let jt2BA = cross(rb, t2);

        let penetration0 = max(loadContactNormalPen(pairContacts, p).w, 0.0);
        let cachedConstraintC0 = loadContactConstraintC0(pairContacts, p);
        let c0 = cachedConstraintC0.x;
        let cRegN = (1.0 - regularizationAlpha) * c0
          + dot(jAL, dPosA)
          + dot(jAA, dThetaA)
          + dot(jBL, dPosB)
          + dot(jBA, dThetaB);
        if (cRegN > 0.0) {
          atomicAdd(&phaseDebugCounters[base + 6u], 1u);
        }

        let c0T1 = cachedConstraintC0.y;
        let c0T2 = cachedConstraintC0.z;
        let cRegT1 = (1.0 - tangentialRegularizationAlpha) * c0T1
          + dot(jt1AL, dPosA)
          + dot(jt1AA, dThetaA)
          + dot(jt1BL, dPosB)
          + dot(jt1BA, dThetaB);
        let cRegT2 = (1.0 - tangentialRegularizationAlpha) * c0T2
          + dot(jt2AL, dPosA)
          + dot(jt2AA, dThetaA)
          + dot(jt2BL, dPosB)
          + dot(jt2BA, dThetaB);

        let contactState = loadContactStateHot(pairContacts, p, kStart);
        let dualState = contactState.dual;
        let dualN = clamp(dualState.x, -dualForceMax, 0.0);
        let penaltyN = max(contactState.penaltyN, kStart);
        let penaltyTB = max(contactState.penalty.yz, vec2f(kStart));
        let lambdaPlusN = dualN + penaltyN * cRegN;
        var lambdaAppliedN = clamp(lambdaPlusN, -dualForceMax, 0.0);
        let normalSupportThreshold = 1e-6;
        let normalReleaseTolerance = max(2e-5, 1.25 * penetration0);
        let normalReleaseDecayNear = 0.85;
        let normalReleaseDecayFar = 0.6;
        let normalReleaseMinSupport = -5e-4;
        if (
          enableNormalReleaseHeuristic > 0u &&
          penetration0 > 1e-6
          && dualN < -normalSupportThreshold
          && cRegN > 0.0
          && -lambdaAppliedN <= normalSupportThreshold
        ) {
          let releaseDecay = select(normalReleaseDecayFar, normalReleaseDecayNear, cRegN <= normalReleaseTolerance);
          lambdaAppliedN = min(dualN * releaseDecay, normalReleaseMinSupport);
        }
        if (-lambdaAppliedN <= normalSupportThreshold) {
          atomicAdd(&phaseDebugCounters[base + 3u], 1u);
        }
        let frictionSeparationTolerance = normalReleaseTolerance;
        let frictionOffSeparation = -lambdaAppliedN <= normalSupportThreshold
          || (enableNormalReleaseHeuristic > 0u && cRegN > frictionSeparationTolerance);

        let frictionScale = contactState.frictionScale;
        let muStatic = frictionStatic * frictionScale * frictionSolveScale;
        let muDynamic = frictionDynamic * frictionScale * frictionSolveScale;
        let dualTB = contactStateDualTB(contactState, n, t1, t2, useReferenceTangentialUpdate);
        let prevTMag = length(dualTB);
        let staticBoundPrev = muStatic * abs(dualN);
        let useStatic = prevTMag <= staticBoundPrev + 1e-6;
        let mu = select(muDynamic, muStatic, useStatic);
        let frictionBound = max(mu * (-dualN), 0.0);
        if (frictionOffSeparation && frictionBound > 1e-6) {
          atomicAdd(&phaseDebugCounters[base + 8u], 1u);
        }
        if (frictionBound > 1e-6) {
          atomicAdd(&phaseDebugCounters[base + 1u], 1u);
          let lambdaPlusTB = vec2f(
            penaltyTB.x * cRegT1 + dualTB.x,
            penaltyTB.y * cRegT2 + dualTB.y,
          );
          let lambdaPlusTBLen2 = dot(lambdaPlusTB, lambdaPlusTB);
          var lambdaAppliedTB = lambdaPlusTB;
          if (lambdaPlusTBLen2 > frictionBound * frictionBound && lambdaPlusTBLen2 > 1e-12) {
            lambdaAppliedTB *= frictionBound * inverseSqrt(lambdaPlusTBLen2);
            atomicAdd(&phaseDebugCounters[base + 7u], 1u);
          }
          let lambdaAppliedTBLen2 = dot(lambdaAppliedTB, lambdaAppliedTB);
          if (lambdaAppliedTBLen2 >= (0.95 * 0.95) * frictionBound * frictionBound) {
            atomicAdd(&phaseDebugCounters[base + 2u], 1u);
          }
        }
      }
    `, [qrot, qmul, qconj, tangentBasisHelpers, contactRecordHelpers, contactStateHelpers]);

    this.accumulatePhaseDebugCountersKernel = accumulatePhaseDebugCountersShader({
      positions: storage(positions, 'vec4f', maxBodies).toReadOnly(),
      quaternions: storage(quaternions, 'vec4f', maxBodies).toReadOnly(),
      initialPose: storage(initialPose, 'vec4f', maxBodies * 2).toReadOnly(),
      pairContacts: storage(pairContacts, 'vec4f', maxPairContacts * CONTACT_RECORD_VEC4S),
      pairActivity: storage(pairActivity, 'uint', pairActivityWordCount),
      phaseDebugCounters: storage(this.phaseDebugCountersAttr, 'uint', 18).toAtomic(),
      pairDispatchCount: uniform(0),
      regularizationAlpha: uniform(1.0),
      tangentialRegularizationAlpha: uniform(1.0),
      phaseOffset: uniform(0),
      frictionSolveScale: uniform(1.0),
      useReferenceTangentialUpdate: uniform(1),
      frictionStatic: uniform(AVBD_FRICTION_STATIC),
      frictionDynamic: uniform(AVBD_FRICTION_DYNAMIC),
      kStart: uniform(AVBD_K_START),
      dualForceMax: uniform(500000.0),
      enableNormalReleaseHeuristic: uniform(0),
      useNormalContactMargin: uniform(1),
      useLocalContactArms: uniform(1),
      workgroupId,
      localId,
    }).computeKernel([WORKGROUP_SIZE, 1, 1]).setName('AVBD Accumulate Phase Debug Counters');

    const clearDebugCountersShader = wgslFn(/* wgsl */`
      fn compute(
        debugCounters: ptr<storage, array<atomic<u32>>, read_write>,
      ) -> void {
        for (var i = 0u; i < 18u; i++) {
          atomicStore(&debugCounters[i], 0u);
        }
      }
    `);

    this.clearDebugCountersKernel = clearDebugCountersShader({
      debugCounters: storage(this.debugCountersAttr, 'uint', 18).toAtomic(),
    }).computeKernel([1, 1, 1]).setName('AVBD Clear Debug Counters');

    const accumulateDebugCountersShader = wgslFn(/* wgsl */`
      fn compute(
        pairActivity: ptr<storage, array<u32>, read_write>,
        pairContacts: ptr<storage, array<vec4f>, read_write>,
        debugCounters: ptr<storage, array<atomic<u32>>, read_write>,
        pairDispatchCount: u32,
        useReferenceTangentialUpdate: u32,
        frictionStatic: f32,
        frictionDynamic: f32,
        kStart: f32,
        workgroupId: vec3u,
        localId: vec3u,
      ) -> void {
        let gid = workgroupId.x * ${WORKGROUP_SIZE}u + localId.x;
        let activeCount = min(min(pairActivity[${pairActiveContactsOffset}u], pairDispatchCount), ${maxActivePairContacts}u);
        if (gid >= activeCount) { return; }

        let p = pairActivity[${pairActiveContactsOffset}u + gid + 1u];
        if (p >= ${maxPairContacts}u) { return; }
        atomicAdd(&debugCounters[0], 1u);

        let n = loadContactNormalPen(pairContacts, p).xyz;
        let nLen2 = dot(n, n);
        if (nLen2 <= 1e-10) { return; }
        atomicAdd(&debugCounters[1], 1u);

        if (n.y >= 0.0) {
          atomicAdd(&debugCounters[6], 1u);
        } else {
          atomicAdd(&debugCounters[7], 1u);
        }
        let absNy = abs(n.y);
        if (absNy > 0.9) {
          atomicAdd(&debugCounters[9], 1u);
        } else if (absNy < 0.2) {
          atomicAdd(&debugCounters[10], 1u);
        }

        let contactState = loadContactStateHot(pairContacts, p, kStart);
        let dualState = contactState.dual;
        let normalMag = contactState.lambdaN;
        if (normalMag <= 1e-6) {
          atomicAdd(&debugCounters[5], 1u);
        }

        let frictionScale = contactState.frictionScale;
        let muStatic = frictionStatic * frictionScale;
        let muDynamic = frictionDynamic * frictionScale;
        let dualTB = contactStateDualTB(contactState, n, vec3f(1.0, 0.0, 0.0), vec3f(0.0, 1.0, 0.0), 1u);
        let dualTWorldRaw = dualState.yzw;
        let dualTWorld = dualTWorldRaw - n * dot(dualTWorldRaw, n);
        let dualTMag = select(length(dualTWorld), length(dualTB), useReferenceTangentialUpdate > 0u);
        let staticBound = muStatic * normalMag;
        let useStatic = dualTMag <= staticBound + 1e-6;

        let mu = select(muDynamic, muStatic, useStatic);
        let frictionBound = max(mu * normalMag, 0.0);
        if (frictionBound > 1e-6) {
          atomicAdd(&debugCounters[2], 1u);
          if (useStatic) {
            atomicAdd(&debugCounters[3], 1u);
          }
          if (dualTMag >= 0.95 * frictionBound) {
            atomicAdd(&debugCounters[4], 1u);
          }
          // Strict violation against static-cone bound.
          if (dualTMag > staticBound + 1e-3) {
            atomicAdd(&debugCounters[8], 1u);
          }
        }
      }
    `, [tangentBasisHelpers, contactRecordHelpers, contactStateHelpers]);

    this.accumulateDebugCountersKernel = accumulateDebugCountersShader({
      pairActivity: storage(pairActivity, 'uint', pairActivityWordCount),
      pairContacts: storage(pairContacts, 'vec4f', maxPairContacts * CONTACT_RECORD_VEC4S),
      debugCounters: storage(this.debugCountersAttr, 'uint', 18).toAtomic(),
      pairDispatchCount: uniform(0),
      useReferenceTangentialUpdate: uniform(0),
      frictionStatic: uniform(AVBD_FRICTION_STATIC),
      frictionDynamic: uniform(AVBD_FRICTION_DYNAMIC),
      kStart: uniform(AVBD_K_START),
      workgroupId,
      localId,
    }).computeKernel([WORKGROUP_SIZE, 1, 1]).setName('AVBD Accumulate Debug Counters');

    const accumulateBodyColorDebugCountersShader = wgslFn(/* wgsl */`
      fn compute(
        bodyConstraintCounts: ptr<storage, array<u32>, read>,
        bodyConstraintRefs: ptr<storage, array<u32>, read>,
        pairContacts: ptr<storage, array<vec4f>, read_write>,
        jointRecords: ptr<storage, array<vec4f>, read_write>,
        springRecords: ptr<storage, array<vec4f>, read_write>,
        debugCounters: ptr<storage, array<atomic<u32>>, read_write>,
        bodyCount: u32,
        workgroupId: vec3u,
        localId: vec3u,
      ) -> void {
        let gid = workgroupId.x * ${WORKGROUP_SIZE}u + localId.x;
        if (gid >= bodyCount) { return; }

        let word = bodyConstraintCounts[gid];
        let constraintCount = min(word & 0xFFFFu, ${maxConstraintsPerBody}u);
        if (constraintCount == 0u) { return; }

        atomicAdd(&debugCounters[11], 1u);
        atomicAdd(&debugCounters[13], constraintCount);
        atomicMax(&debugCounters[15], constraintCount);
        if (constraintCount >= ${maxConstraintsPerBody}u) {
          atomicAdd(&debugCounters[14], 1u);
        }
        if ((word & ${BODY_COLOR_FALLBACK_FLAG}u) != 0u) {
          atomicAdd(&debugCounters[12], 1u);
        }

        let bodyColor = (word >> 16u) & 0xFFu;
        let base = gid * ${maxConstraintsPerBody}u;
        for (var k = 0u; k < ${maxConstraintsPerBody}u; k++) {
          if (k >= constraintCount) { break; }
          let constraintRef = bodyConstraintRefs[base + k];
          let constraintTag = constraintRef & ${CONSTRAINT_REF_TAG_MASK}u;
          let constraintIndex = constraintRef & ${CONSTRAINT_REF_INDEX_MASK}u;
          var other = debugConstraintOtherBodyForContact(gid, constraintRef, pairContacts);
          if (constraintTag == ${CONSTRAINT_REF_TAG_JOINT}u) {
            other = debugConstraintOtherBodyForJoint(gid, constraintIndex, jointRecords);
          } else if (constraintTag == ${CONSTRAINT_REF_TAG_SPRING}u) {
            other = debugConstraintOtherBodyForSpring(gid, constraintIndex, springRecords);
          }
          if (other >= bodyCount || other <= gid) { continue; }

          let otherWord = bodyConstraintCounts[other];
          let otherConstraintCount = min(otherWord & 0xFFFFu, ${maxConstraintsPerBody}u);
          if (otherConstraintCount == 0u) { continue; }

          atomicAdd(&debugCounters[16], 1u);
          let otherColor = (otherWord >> 16u) & 0xFFu;
          if (otherColor == bodyColor) {
            atomicAdd(&debugCounters[17], 1u);
          }
        }
      }

      fn debugConstraintOtherBodyForContact(
        body: u32,
        contactIndex: u32,
        pairContacts: ptr<storage, array<vec4f>, read_write>,
      ) -> u32 {
        if (contactIndex >= ${maxPairContacts}u) { return ${maxBodies}u; }
        let contactMeta = loadContactMeta(pairContacts, contactIndex);
        let i = u32(contactMeta.x + 0.5);
        let j = u32(contactMeta.y + 0.5);
        if (i == body) { return j; }
        if (j == body) { return i; }
        return ${maxBodies}u;
      }

      fn debugConstraintOtherBodyForJoint(
        body: u32,
        jointIndex: u32,
        jointRecords: ptr<storage, array<vec4f>, read_write>,
      ) -> u32 {
        if (jointIndex >= ${maxJoints}u) { return ${maxBodies}u; }
        let jointMeta = loadJointMetaWords(jointRecords, jointIndex);
        if (jointMeta.w == 0u) { return ${maxBodies}u; }
        if (jointMeta.x == body) { return jointMeta.y; }
        if (jointMeta.y == body) { return jointMeta.x; }
        return ${maxBodies}u;
      }

      fn debugConstraintOtherBodyForSpring(
        body: u32,
        springIndex: u32,
        springRecords: ptr<storage, array<vec4f>, read_write>,
      ) -> u32 {
        if (springIndex >= ${maxSprings}u) { return ${maxBodies}u; }
        let springMeta = loadSpringMetaWords(springRecords, springIndex);
        if (springMeta.z == 0u) { return ${maxBodies}u; }
        if (springMeta.x == body) { return springMeta.y; }
        if (springMeta.y == body) { return springMeta.x; }
        return ${maxBodies}u;
      }
    `, [contactRecordHelpers, jointRecordHelpers, springRecordHelpers]);

    this.accumulateBodyColorDebugCountersKernel = accumulateBodyColorDebugCountersShader({
      bodyConstraintCounts: storage(bodyConstraintCounts, 'uint', maxBodies).toReadOnly(),
      bodyConstraintRefs: storage(bodyConstraintRefs, 'uint', maxBodies * maxConstraintsPerBody).toReadOnly(),
      pairContacts: storage(pairContacts, 'vec4f', maxPairContacts * CONTACT_RECORD_VEC4S),
      jointRecords: storage(jointRecords, 'vec4f', maxJoints * JOINT_RECORD_VEC4S),
      springRecords: storage(springRecords, 'vec4f', maxSprings * SPRING_RECORD_VEC4S),
      debugCounters: storage(this.debugCountersAttr, 'uint', 18).toAtomic(),
      bodyCount: uniform(0),
      workgroupId,
      localId,
    }).computeKernel([WORKGROUP_SIZE, 1, 1]).setName('AVBD Accumulate Body Color Debug Counters');

    const prepareStateShader = wgslFn(/* wgsl */`
      fn compute(
        pairContacts: ptr<storage, array<vec4f>, read_write>,
        pairActivity: ptr<storage, array<u32>, read_write>,
        pairDispatchCount: u32,
        lambdaWarmstartScale: f32,
        softenWarmstartOnSlotChange: u32,
        useReferenceTangentialUpdate: u32,
        preserveTangentialPenaltyOnStick: u32,
        useIsotropicTangentialPenaltyOnStick: u32,
        tangentialPenaltyCapScale: f32,
        frictionStatic: f32,
        gamma: f32,
        kStart: f32,
        workgroupId: vec3u,
        localId: vec3u,
      ) -> void {
        let gid = workgroupId.x * ${WORKGROUP_SIZE}u + localId.x;
        let activeCount = min(min(pairActivity[${pairActiveContactsOffset}u], pairDispatchCount), ${maxActivePairContacts}u);
        if (gid >= activeCount) { return; }

        let p = pairActivity[${pairActiveContactsOffset}u + gid + 1u];
        if (p >= ${maxPairContacts}u) { return; }
        let prevContactRecord = loadContactRecord(pairContacts, p, kStart);
        let contactShadow = prevContactRecord.shadow.packed;
        let prevContactState = prevContactRecord.state;
        let frictionScale = prevContactState.frictionScale;

        let info = loadContactMeta(pairContacts, p);
        if (info.z < 0.5) {
          storeContactCacheWord(pairContacts, p, 0u);
          storeContactDual(pairContacts, p, vec4f(0.0));
          storeContactPenalty(pairContacts, p, packContactPenalty(kStart, vec2f(kStart), frictionScale, kStart));
          return;
        }

        var i = u32(info.x + 0.5);
        var j = u32(info.y + 0.5);
        if (i > j) {
          let t = i;
          i = j;
          j = t;
        }
        let encodedInfo = bitcast<u32>(info.w);
        let feature = encodedInfo & 0x1FFu;
        let preserveWarmstart = ((encodedInfo >> 16u) & 0x1u) != 0u;
        let stick = ((encodedInfo >> 17u) & 0x1u) != 0u;
        let warmstartReason = (encodedInfo >> 21u) & 0x7u;
        let exactFeatureWarmstart = warmstartReason == 1u;
        let localSlot = p % ${clampedPairManifoldSlots}u;
        let packedBodies = (i & 0xFFFFu) | ((j & 0xFFFFu) << 16u);
        // Build a structured key:
        // high identity bits = body-pair/contact identity, low slot bits = slot id.
        // This allows continuity across manifold slot remaps without letting
        // unrelated clipped contact points inherit the same dual state.
        // Preserve the exact geometric feature bits inside the continuity key.
        // The previous hash-only base could alias adjacent face ordinals
        // (for example 0xa9 and 0xaa), which made slot swaps look like valid
        // continuity holds. Match avbd-demo3d more closely by keeping the
        // feature exact and hashing only the body-pair portion.
        let pairHash = 1u + (((packedBodies * 2246822519u) ^ (packedBodies >> 16u) ^ (packedBodies << 7u)) % ${contactKeyPairHashMax}u);
        let keyBase = (pairHash << ${contactKeyFeatureBitCount}u) | feature;
        let key = (keyBase << ${contactKeySlotBitCount}u) | localSlot;

        let prevKeyPacked = loadContactCacheWord(pairContacts, p);
        let prevKey = prevKeyPacked & 0x7fffffffu;
        let prevBase = prevKey >> ${contactKeySlotBitCount}u;
        let continuityHeld = preserveWarmstart && prevKey != 0u && prevBase == keyBase;
        let slotChanged = prevKey != key;
        var prevDual = prevContactState.dual;
        var prevPenalty = prevContactState.penalty;
        let prevDualN = min(prevDual.x, 0.0);
        let prevLambdaN = prevContactState.lambdaN;
        let prevPenaltyN = prevContactState.penaltyN;
        // pairLambdas is a derived positive-magnitude shadow used for
        // heuristics/debug and one-step contact-generation seed transport.
        // Once prepare runs, avbdDualState becomes the authoritative record.
        let seedShadow = prevContactRecord.shadow;
        let matchedCarryN = seedShadow.lambdaN;
        if (!continuityHeld) {
          // Reference parity: unmatched rows start from zero lambda and
          // minimum penalty. Do not promote generation-time shadow seeds into
          // the live solver state on continuity miss.
          storeContactDual(pairContacts, p, vec4f(0.0));
          storeContactPenalty(
            pairContacts,
            p,
            packContactPenalty(kStart, vec2f(kStart), seedShadow.frictionScale, kStart),
          );
        } else {
          let slotWarmstartScale = 1.0;
          var warmDual = prevDual * lambdaWarmstartScale;
          var warmDualN = min(warmDual.x, 0.0);
          var warmStoredDual = vec4f(0.0);
          if (useReferenceTangentialUpdate > 0u) {
            // Reference parity: warmstart is a plain Eq.19-style decay.
            // Do not reclamp tangential dual against the friction cone during
            // prepare; the references leave cone enforcement to the dual
            // update/solve path.
            warmStoredDual = vec4f(warmDualN, warmDual.yz, 0.0);
          } else {
            var warmDualT = warmDual.yzw;
            let nRaw = loadContactNormalPen(pairContacts, p).xyz;
            let nLen2 = dot(nRaw, nRaw);
            if (nLen2 > 1e-10) {
              let nUnit = nRaw * inverseSqrt(nLen2);
              warmDualT -= nUnit * dot(warmDualT, nUnit);
            } else {
              warmDualT = vec3f(0.0);
            }
            warmStoredDual = vec4f(warmDualN, warmDualT);
          }
          var warmPenaltyN = max(prevPenalty.x * gamma, kStart);
          var warmPenaltyT1 = max(prevPenalty.y * gamma, kStart);
          var warmPenaltyT2 = max(prevPenalty.z * gamma, kStart);
          let holdTangentialPenalty = preserveTangentialPenaltyOnStick > 0u
            && useReferenceTangentialUpdate == 0u
            && stick
            && prevKey == key;
          if (holdTangentialPenalty) {
            warmPenaltyT1 = max(prevPenalty.y, kStart);
            warmPenaltyT2 = max(prevPenalty.z, kStart);
          }
          if (tangentialPenaltyCapScale > 0.0 && useReferenceTangentialUpdate == 0u) {
            let tangentialPenaltyCap = max(warmPenaltyN * tangentialPenaltyCapScale, kStart);
            warmPenaltyT1 = min(warmPenaltyT1, tangentialPenaltyCap);
            warmPenaltyT2 = min(warmPenaltyT2, tangentialPenaltyCap);
          }
          if (
            useIsotropicTangentialPenaltyOnStick > 0u
            && useReferenceTangentialUpdate == 0u
            && stick
            && prevKey == key
          ) {
            let sharedPenaltyT = max(0.5 * (warmPenaltyT1 + warmPenaltyT2), kStart);
            warmPenaltyT1 = sharedPenaltyT;
            warmPenaltyT2 = sharedPenaltyT;
          }
          storeContactDual(pairContacts, p, warmStoredDual);
          storeContactPenalty(pairContacts, p, packContactPenalty(
            warmPenaltyN,
            vec2f(warmPenaltyT1, warmPenaltyT2),
            frictionScale,
            kStart,
          ));
        }

        storeContactCacheWord(pairContacts, p, key | select(0u, 0x80000000u, continuityHeld));
      }
    `, [tangentBasisHelpers, contactRecordHelpers, contactStateHelpers]);

    this.prepareStateKernel = prepareStateShader({
      pairContacts: storage(pairContacts, 'vec4f', maxPairContacts * CONTACT_RECORD_VEC4S),
      pairActivity: storage(pairActivity, 'uint', pairActivityWordCount),
      pairDispatchCount: uniform(0),
      lambdaWarmstartScale: uniform(0.95 * AVBD_GAMMA),
      softenWarmstartOnSlotChange: uniform(0),
      useReferenceTangentialUpdate: uniform(1),
      preserveTangentialPenaltyOnStick: uniform(0),
      useIsotropicTangentialPenaltyOnStick: uniform(0),
      tangentialPenaltyCapScale: uniform(0.0),
      frictionStatic: uniform(AVBD_FRICTION_STATIC),
      gamma: uniform(AVBD_GAMMA),
      kStart: uniform(AVBD_K_START),
      workgroupId,
      localId,
    }).computeKernel([WORKGROUP_SIZE, 1, 1]).setName('AVBD Prepare Contact State');
    assertStorageBufferBudget('AVBD Prepare Contact State', 9);

    const prepareJointStateShader = wgslFn(/* wgsl */`
      fn compute(
        positions: ptr<storage, array<vec4f>, read>,
        quaternions: ptr<storage, array<vec4f>, read>,
        velocities: ptr<storage, array<vec4f>, read>,
        angularVelocities: ptr<storage, array<vec4f>, read>,
        initialPose: ptr<storage, array<vec4f>, read>,
        jointRecords: ptr<storage, array<vec4f>, read_write>,
        jointCount: u32,
        lambdaWarmstartScale: f32,
        gamma: f32,
        kStart: f32,
        dt: f32,
        workgroupId: vec3u,
        localId: vec3u,
      ) -> void {
        let gid = workgroupId.x * ${WORKGROUP_SIZE}u + localId.x;
        if (gid >= jointCount) { return; }

        let jointMetaWords = loadJointMetaWords(jointRecords, gid);
        if (jointMetaWords.w == 0u) { return; }

        let bodyA = jointMetaWords.x;
        let bodyB = jointMetaWords.y;
        let jointType = jointMetaWords.z;
        let anchorA = loadJointAnchorA(jointRecords, gid);
        let anchorB = loadJointAnchorB(jointRecords, gid);
        let torqueArm = max(anchorA.w, 1.0);

        var qA = vec4f(0.0, 0.0, 0.0, 1.0);
        var posA = anchorA.xyz;
        if (bodyA != WORLD_BODY_INDEX) {
          qA = normalize(initialPose[bodyA * 2u + 1u]);
          posA = initialPose[bodyA * 2u].xyz;
        }
        let qB = normalize(initialPose[bodyB * 2u + 1u]);
        let posB = initialPose[bodyB * 2u].xyz;
        let worldAnchorA = jointWorldAnchor(bodyA, anchorA.xyz, posA, qA);
        let worldAnchorB = posB + qrot(qB, anchorB.xyz);
        let regularizationPoseA = jointRegularizationPose(
          bodyA,
          initialPose,
          positions,
          quaternions,
          velocities,
          angularVelocities,
          dt,
        );
        let regularizationPoseB = jointRegularizationPose(
          bodyB,
          initialPose,
          positions,
          quaternions,
          velocities,
          angularVelocities,
          dt,
        );
        let regularizationAnchorA = jointWorldAnchor(
          bodyA,
          anchorA.xyz,
          regularizationPoseA.position,
          regularizationPoseA.rotation,
        );
        let regularizationAnchorB = jointWorldAnchor(
          bodyB,
          anchorB.xyz,
          regularizationPoseB.position,
          regularizationPoseB.rotation,
        );
        let c0Lin = regularizationAnchorA - regularizationAnchorB;
        storeJointC0Lin(jointRecords, gid, vec4f(c0Lin, 0.0));

        let c0Ang = select(
          vec3f(0.0),
          jointFixedAngularConstraint(
            bodyA,
            regularizationPoseA.rotation,
            regularizationPoseB.rotation,
            torqueArm,
          ),
          jointType == JOINT_TYPE_FIXED,
        );
        storeJointC0Ang(jointRecords, gid, vec4f(c0Ang, 0.0));

        let prevLambdaLin = loadJointLambdaLin(jointRecords, gid).xyz;
        let prevLambdaAng = loadJointLambdaAng(jointRecords, gid).xyz;
        let prevPenaltyLin = max(loadJointPenaltyLin(jointRecords, gid).xyz, vec3f(kStart));
        let stiffness = loadJointStiffness(jointRecords, gid);
        let rigidLinear = !isFiniteF32(stiffness.x);
        let angularEnabled = jointType == JOINT_TYPE_FIXED && stiffness.y > 0.0;
        let rigidAngular = angularEnabled && !isFiniteF32(stiffness.y);
        let minPenaltyAng = select(vec3f(0.0), vec3f(kStart), angularEnabled);
        let prevPenaltyAng = max(loadJointPenaltyAng(jointRecords, gid).xyz, minPenaltyAng);
        let maxPenaltyLin = vec3f(min(max(stiffness.x, kStart), ${AVBD_JOINT_PENALTY_MAX}));
        let maxPenaltyAng = vec3f(min(max(stiffness.y, 0.0), ${AVBD_JOINT_PENALTY_MAX}));

        storeJointLambdaLin(
          jointRecords,
          gid,
          vec4f(prevLambdaLin * lambdaWarmstartScale, 0.0),
        );
        storeJointLambdaAng(
          jointRecords,
          gid,
          vec4f(select(vec3f(0.0), prevLambdaAng * lambdaWarmstartScale, angularEnabled), 0.0),
        );
        storeJointPenaltyLin(
          jointRecords,
          gid,
          vec4f(min(max(prevPenaltyLin * gamma, vec3f(kStart)), maxPenaltyLin), 0.0),
        );
        storeJointPenaltyAng(
          jointRecords,
          gid,
          vec4f(min(max(prevPenaltyAng * gamma, minPenaltyAng), maxPenaltyAng), 0.0),
        );
      }
    `, [qrot, qmul, qconj, jointRecordHelpers, jointConstraintHelpers]);

    this.prepareJointStateKernel = prepareJointStateShader({
      positions: storage(positions, 'vec4f', maxBodies).toReadOnly(),
      quaternions: storage(quaternions, 'vec4f', maxBodies).toReadOnly(),
      velocities: storage(velocities, 'vec4f', maxBodies).toReadOnly(),
      angularVelocities: storage(angularVelocities, 'vec4f', maxBodies).toReadOnly(),
      initialPose: storage(initialPose, 'vec4f', maxBodies * 2).toReadOnly(),
      jointRecords: storage(jointRecords, 'vec4f', maxJoints * JOINT_RECORD_VEC4S),
      jointCount: uniform(0),
      lambdaWarmstartScale: uniform(0.95 * AVBD_GAMMA),
      gamma: uniform(AVBD_GAMMA),
      kStart: uniform(AVBD_K_START),
      dt: uniform(1 / 60 / 4),
      workgroupId,
      localId,
    }).computeKernel([WORKGROUP_SIZE, 1, 1]).setName('AVBD Prepare Joint State');
    assertStorageBufferBudget('AVBD Prepare Joint State', 6);

    const buildSolverConstraintListsShader = wgslFn(/* wgsl */`
      fn compute(
        pairBodyContactCounts: ptr<storage, array<u32>, read>,
        pairBodyContactIndices: ptr<storage, array<u32>, read>,
        bodyConstraintCounts: ptr<storage, array<u32>, read_write>,
        bodyConstraintRefs: ptr<storage, array<u32>, read_write>,
        bodyColorScratch: ptr<storage, array<u32>, read_write>,
        bodyCount: u32,
        workgroupId: vec3u,
        localId: vec3u,
      ) -> void {
        let gid = workgroupId.x * ${WORKGROUP_SIZE}u + localId.x;
        if (gid >= bodyCount) { return; }

        let previousColor = (bodyConstraintCounts[gid] >> 16u) & 0xFFu;
        bodyColorScratch[gid] = previousColor << 16u;
        let contactCount = min(pairBodyContactCounts[gid] & 0xFFFFu, ${maxPairContactsPerBody}u);
        let solverCount = min(contactCount, ${maxConstraintsPerBody}u);
        bodyConstraintCounts[gid] = solverCount;
        let srcBase = gid * ${maxPairContactsPerBody}u;
        let dstBase = gid * ${maxConstraintsPerBody}u;
        for (var k = 0u; k < ${maxConstraintsPerBody}u; k++) {
          if (k < solverCount) {
            bodyConstraintRefs[dstBase + k] = pairBodyContactIndices[srcBase + k];
          } else {
            bodyConstraintRefs[dstBase + k] = 0u;
          }
        }
      }
    `);

    this.buildSolverConstraintListsKernel = buildSolverConstraintListsShader({
      pairBodyContactCounts: storage(pairBodyContactCounts, 'uint', maxBodies).toReadOnly(),
      pairBodyContactIndices: storage(pairBodyContactIndices, 'uint', maxBodies * maxPairContactsPerBody).toReadOnly(),
      bodyConstraintCounts: storage(bodyConstraintCounts, 'uint', maxBodies),
      bodyConstraintRefs: storage(bodyConstraintRefs, 'uint', maxBodies * maxConstraintsPerBody),
      bodyColorScratch: storage(bodyColorScratch, 'uint', maxBodies),
      bodyCount: uniform(0),
      workgroupId,
      localId,
    }).computeKernel([WORKGROUP_SIZE, 1, 1]).setName('AVBD Build Solver Constraint Lists');
    assertStorageBufferBudget('AVBD Build Solver Constraint Lists', 5);

    const appendJointConstraintRefsShader = wgslFn(/* wgsl */`
      fn compute(
        positions: ptr<storage, array<vec4f>, read>,
        jointRecords: ptr<storage, array<vec4f>, read_write>,
        bodyConstraintCounts: ptr<storage, array<atomic<u32>>, read_write>,
        bodyConstraintRefs: ptr<storage, array<u32>, read_write>,
        jointCount: u32,
        workgroupId: vec3u,
        localId: vec3u,
      ) -> void {
        let gid = workgroupId.x * ${WORKGROUP_SIZE}u + localId.x;
        if (gid >= jointCount) { return; }

        let jointMetaWords = loadJointMetaWords(jointRecords, gid);
        if (jointMetaWords.w == 0u) { return; }

        let taggedRef = ${CONSTRAINT_REF_TAG_JOINT}u | gid;
        let bodyA = jointMetaWords.x;
        let bodyB = jointMetaWords.y;

        if (bodyA != 0xffffffffu && positions[bodyA].w > 0.0) {
          let slotA = atomicAdd(&bodyConstraintCounts[bodyA], 1u);
          if (slotA < ${maxConstraintsPerBody}u) {
            bodyConstraintRefs[bodyA * ${maxConstraintsPerBody}u + slotA] = taggedRef;
          }
        }
        if (positions[bodyB].w > 0.0) {
          let slotB = atomicAdd(&bodyConstraintCounts[bodyB], 1u);
          if (slotB < ${maxConstraintsPerBody}u) {
            bodyConstraintRefs[bodyB * ${maxConstraintsPerBody}u + slotB] = taggedRef;
          }
        }
      }
    `, [qrot, qmul, qconj, jointRecordHelpers, jointConstraintHelpers]);

    this.appendJointConstraintRefsKernel = appendJointConstraintRefsShader({
      positions: storage(positions, 'vec4f', maxBodies).toReadOnly(),
      jointRecords: storage(jointRecords, 'vec4f', maxJoints * JOINT_RECORD_VEC4S),
      bodyConstraintCounts: storage(bodyConstraintCounts, 'uint', maxBodies).toAtomic(),
      bodyConstraintRefs: storage(bodyConstraintRefs, 'uint', maxBodies * maxConstraintsPerBody),
      jointCount: uniform(0),
      workgroupId,
      localId,
    }).computeKernel([WORKGROUP_SIZE, 1, 1]).setName('AVBD Append Joint Constraint Refs');
    assertStorageBufferBudget('AVBD Append Joint Constraint Refs', 4);

    const appendSpringConstraintRefsShader = wgslFn(/* wgsl */`
      fn compute(
        positions: ptr<storage, array<vec4f>, read>,
        springRecords: ptr<storage, array<vec4f>, read_write>,
        bodyConstraintCounts: ptr<storage, array<atomic<u32>>, read_write>,
        bodyConstraintRefs: ptr<storage, array<u32>, read_write>,
        springCount: u32,
        workgroupId: vec3u,
        localId: vec3u,
      ) -> void {
        let gid = workgroupId.x * ${WORKGROUP_SIZE}u + localId.x;
        if (gid >= springCount) { return; }

        let springMetaWords = loadSpringMetaWords(springRecords, gid);
        if (springMetaWords.z == 0u) { return; }

        let taggedRef = ${CONSTRAINT_REF_TAG_SPRING}u | gid;
        let bodyA = springMetaWords.x;
        let bodyB = springMetaWords.y;

        if (bodyA != 0xffffffffu && positions[bodyA].w > 0.0) {
          let slotA = atomicAdd(&bodyConstraintCounts[bodyA], 1u);
          if (slotA < ${maxConstraintsPerBody}u) {
            bodyConstraintRefs[bodyA * ${maxConstraintsPerBody}u + slotA] = taggedRef;
          }
        }
        if (positions[bodyB].w > 0.0) {
          let slotB = atomicAdd(&bodyConstraintCounts[bodyB], 1u);
          if (slotB < ${maxConstraintsPerBody}u) {
            bodyConstraintRefs[bodyB * ${maxConstraintsPerBody}u + slotB] = taggedRef;
          }
        }
      }
    `, [springRecordHelpers]);

    this.appendSpringConstraintRefsKernel = appendSpringConstraintRefsShader({
      positions: storage(positions, 'vec4f', maxBodies).toReadOnly(),
      springRecords: storage(springRecords, 'vec4f', maxSprings * SPRING_RECORD_VEC4S),
      bodyConstraintCounts: storage(bodyConstraintCounts, 'uint', maxBodies).toAtomic(),
      bodyConstraintRefs: storage(bodyConstraintRefs, 'uint', maxBodies * maxConstraintsPerBody),
      springCount: uniform(0),
      workgroupId,
      localId,
    }).computeKernel([WORKGROUP_SIZE, 1, 1]).setName('AVBD Append Spring Constraint Refs');
    assertStorageBufferBudget('AVBD Append Spring Constraint Refs', 4);

    const greedyBodyColorsShader = wgslFn(/* wgsl */`
      fn compute(
        bodyConstraintCounts: ptr<storage, array<u32>, read_write>,
        bodyConstraintRefs: ptr<storage, array<u32>, read>,
        pairContacts: ptr<storage, array<vec4f>, read_write>,
        jointRecords: ptr<storage, array<vec4f>, read_write>,
        springRecords: ptr<storage, array<vec4f>, read_write>,
        bodyColorScratch: ptr<storage, array<u32>, read>,
        bodyCount: u32,
        colorCount: u32,
        workgroupId: vec3u,
        localId: vec3u,
      ) -> void {
        let gid = workgroupId.x * ${WORKGROUP_SIZE}u + localId.x;
        if (gid >= bodyCount) { return; }

        let word = bodyConstraintCounts[gid];
        let contactCount = min(word & 0xFFFFu, ${maxConstraintsPerBody}u);
        if (contactCount == 0u) {
          bodyConstraintCounts[gid] = 0u;
          return;
        }

        let colors = max(1u, min(colorCount, 32u));
        var usedMask = 0u;
        let base = gid * ${maxConstraintsPerBody}u;
        for (var k = 0u; k < ${maxConstraintsPerBody}u; k++) {
          if (k >= contactCount) { break; }
          let constraintRef = bodyConstraintRefs[base + k];
          let constraintTag = constraintRef & ${CONSTRAINT_REF_TAG_MASK}u;
          let constraintIndex = constraintRef & ${CONSTRAINT_REF_INDEX_MASK}u;
          var other = constraintOtherBodyForContact(gid, constraintRef, pairContacts);
          if (constraintTag == ${CONSTRAINT_REF_TAG_JOINT}u) {
            other = constraintOtherBodyForJoint(gid, constraintIndex, jointRecords);
          } else if (constraintTag == ${CONSTRAINT_REF_TAG_SPRING}u) {
            other = constraintOtherBodyForSpring(gid, constraintIndex, springRecords);
          }
          if (other >= bodyCount || other == gid) { continue; }
          if (other <= gid) { continue; }

          let otherPrevColor = (bodyColorScratch[other] >> 16u) & 0xFFu;
          if (otherPrevColor < colors) {
            usedMask |= 1u << otherPrevColor;
          }
        }

        var chosenColor = (bodyColorScratch[gid] >> 16u) & 0xFFu;
        var fallback = false;
        var needsNewColor = chosenColor >= colors;
        if (!needsNewColor) {
          needsNewColor = (usedMask & (1u << chosenColor)) != 0u;
        }
        if (needsNewColor) {
          fallback = true;
          var found = false;
          for (var color = 0u; color < 32u; color++) {
            if (color >= colors) { break; }
            if ((usedMask & (1u << color)) == 0u) {
              chosenColor = color;
              found = true;
              fallback = false;
              break;
            }
          }
          if (!found) {
            chosenColor = gid % colors;
          }
        }

        bodyConstraintCounts[gid] = (chosenColor << 16u) | contactCount | select(0u, ${BODY_COLOR_FALLBACK_FLAG}u, fallback);
      }
      
      fn constraintOtherBodyForContact(
        body: u32,
        contactIndex: u32,
        pairContacts: ptr<storage, array<vec4f>, read_write>,
      ) -> u32 {
        if (contactIndex >= ${maxPairContacts}u) { return ${maxBodies}u; }
        let contactMeta = loadContactMeta(pairContacts, contactIndex);
        let i = u32(contactMeta.x + 0.5);
        let j = u32(contactMeta.y + 0.5);
        if (i == body) { return j; }
        if (j == body) { return i; }
        return ${maxBodies}u;
      }

      fn constraintOtherBodyForJoint(
        body: u32,
        jointIndex: u32,
        jointRecords: ptr<storage, array<vec4f>, read_write>,
      ) -> u32 {
        if (jointIndex >= ${maxJoints}u) { return ${maxBodies}u; }
        let jointMetaWords = loadJointMetaWords(jointRecords, jointIndex);
        if (jointMetaWords.w == 0u) { return ${maxBodies}u; }
        if (jointMetaWords.x == body) { return jointMetaWords.y; }
        if (jointMetaWords.y == body) { return jointMetaWords.x; }
        return ${maxBodies}u;
      }

      fn constraintOtherBodyForSpring(
        body: u32,
        springIndex: u32,
        springRecords: ptr<storage, array<vec4f>, read_write>,
      ) -> u32 {
        if (springIndex >= ${maxSprings}u) { return ${maxBodies}u; }
        let springMetaWords = loadSpringMetaWords(springRecords, springIndex);
        if (springMetaWords.z == 0u) { return ${maxBodies}u; }
        if (springMetaWords.x == body) { return springMetaWords.y; }
        if (springMetaWords.y == body) { return springMetaWords.x; }
        return ${maxBodies}u;
      }
    `, [contactRecordHelpers, jointRecordHelpers, springRecordHelpers]);

    this.greedyBodyColorsKernel = greedyBodyColorsShader({
      bodyConstraintCounts: storage(bodyConstraintCounts, 'uint', maxBodies),
      bodyConstraintRefs: storage(bodyConstraintRefs, 'uint', maxBodies * maxConstraintsPerBody).toReadOnly(),
      pairContacts: storage(pairContacts, 'vec4f', maxPairContacts * CONTACT_RECORD_VEC4S),
      jointRecords: storage(jointRecords, 'vec4f', maxJoints * JOINT_RECORD_VEC4S),
      springRecords: storage(springRecords, 'vec4f', maxSprings * SPRING_RECORD_VEC4S),
      bodyColorScratch: storage(bodyColorScratch, 'uint', maxBodies).toReadOnly(),
      bodyCount: uniform(0),
      colorCount: uniform(1),
      workgroupId,
      localId,
    }).computeKernel([WORKGROUP_SIZE, 1, 1]).setName('AVBD Incremental Greedy Body Colors');
    assertStorageBufferBudget('AVBD Incremental Greedy Body Colors', 6);

    const markHardColorConflictsShader = wgslFn(/* wgsl */`
      fn compute(
        bodyConstraintCounts: ptr<storage, array<atomic<u32>>, read_write>,
        jointRecords: ptr<storage, array<vec4f>, read_write>,
        springRecords: ptr<storage, array<vec4f>, read_write>,
        bodyCount: u32,
        jointCount: u32,
        springCount: u32,
        workgroupId: vec3u,
        localId: vec3u,
      ) -> void {
        let gid = workgroupId.x * ${WORKGROUP_SIZE}u + localId.x;

        if (gid < jointCount) {
          let jointMetaWords = loadJointMetaWords(jointRecords, gid);
          if (jointMetaWords.w != 0u) {
            markHardColorConflictEdge(bodyConstraintCounts, bodyCount, jointMetaWords.x, jointMetaWords.y);
          }
        }

        if (gid < springCount) {
          let springMetaWords = loadSpringMetaWords(springRecords, gid);
          if (springMetaWords.z != 0u) {
            markHardColorConflictEdge(bodyConstraintCounts, bodyCount, springMetaWords.x, springMetaWords.y);
          }
        }
      }

      fn markHardColorConflictEdge(
        bodyConstraintCounts: ptr<storage, array<atomic<u32>>, read_write>,
        bodyCount: u32,
        bodyA: u32,
        bodyB: u32,
      ) {
        if (bodyA == 0xffffffffu || bodyB == 0xffffffffu) { return; }
        if (bodyA >= bodyCount || bodyB >= bodyCount || bodyA == bodyB) { return; }

        let wordA = atomicLoad(&bodyConstraintCounts[bodyA]);
        let wordB = atomicLoad(&bodyConstraintCounts[bodyB]);
        let countA = wordA & 0xFFFFu;
        let countB = wordB & 0xFFFFu;
        if (countA == 0u || countB == 0u) { return; }

        let colorA = (wordA >> 16u) & 0xFFu;
        let colorB = (wordB >> 16u) & 0xFFu;
        if (colorA != colorB) { return; }

        // Match the paper author's higher-id dependency orientation: lower-id
        // bodies adapt, higher-id bodies stay fixed for this repair round.
        let loser = min(bodyA, bodyB);
        atomicOr(&bodyConstraintCounts[loser], ${BODY_COLOR_REPAIR_FLAG}u);
      }
    `, [jointRecordHelpers, springRecordHelpers]);

    this.markHardColorConflictsKernel = markHardColorConflictsShader({
      bodyConstraintCounts: storage(bodyConstraintCounts, 'uint', maxBodies).toAtomic(),
      jointRecords: storage(jointRecords, 'vec4f', maxJoints * JOINT_RECORD_VEC4S),
      springRecords: storage(springRecords, 'vec4f', maxSprings * SPRING_RECORD_VEC4S),
      bodyCount: uniform(0),
      jointCount: uniform(0),
      springCount: uniform(0),
      workgroupId,
      localId,
    }).computeKernel([WORKGROUP_SIZE, 1, 1]).setName('AVBD Mark Hard Body Color Conflicts');
    assertStorageBufferBudget('AVBD Mark Hard Body Color Conflicts', 3);

    const repairHardBodyColorsShader = wgslFn(/* wgsl */`
      fn compute(
        bodyConstraintCounts: ptr<storage, array<u32>, read_write>,
        bodyConstraintRefs: ptr<storage, array<u32>, read>,
        jointRecords: ptr<storage, array<vec4f>, read_write>,
        springRecords: ptr<storage, array<vec4f>, read_write>,
        bodyCount: u32,
        colorCount: u32,
        workgroupId: vec3u,
        localId: vec3u,
      ) -> void {
        let gid = workgroupId.x * ${WORKGROUP_SIZE}u + localId.x;
        if (gid >= bodyCount) { return; }

        let word = bodyConstraintCounts[gid];
        if ((word & ${BODY_COLOR_REPAIR_FLAG}u) == 0u) { return; }

        let constraintCount = min(word & 0xFFFFu, ${maxConstraintsPerBody}u);
        if (constraintCount == 0u) {
          bodyConstraintCounts[gid] = 0u;
          return;
        }

        let colors = max(1u, min(colorCount, 32u));
        var usedMask = 0u;
        let base = gid * ${maxConstraintsPerBody}u;
        for (var k = 0u; k < ${maxConstraintsPerBody}u; k++) {
          if (k >= constraintCount) { break; }

          let constraintRef = bodyConstraintRefs[base + k];
          let constraintTag = constraintRef & ${CONSTRAINT_REF_TAG_MASK}u;
          let constraintIndex = constraintRef & ${CONSTRAINT_REF_INDEX_MASK}u;
          var other = ${maxBodies}u;
          if (constraintTag == ${CONSTRAINT_REF_TAG_JOINT}u) {
            other = repairConstraintOtherBodyForJoint(gid, constraintIndex, jointRecords);
          } else if (constraintTag == ${CONSTRAINT_REF_TAG_SPRING}u) {
            other = repairConstraintOtherBodyForSpring(gid, constraintIndex, springRecords);
          } else {
            continue;
          }
          if (other >= bodyCount || other == gid) { continue; }

          let otherWord = bodyConstraintCounts[other];
          let otherConstraintCount = min(otherWord & 0xFFFFu, ${maxConstraintsPerBody}u);
          if (otherConstraintCount == 0u) { continue; }

          let otherColor = (otherWord >> 16u) & 0xFFu;
          if (otherColor < colors) {
            usedMask |= 1u << otherColor;
          }
        }

        var chosenColor = (word >> 16u) & 0xFFu;
        var fallback = false;
        var needsNewColor = chosenColor >= colors;
        if (!needsNewColor) {
          needsNewColor = (usedMask & (1u << chosenColor)) != 0u;
        }
        if (needsNewColor) {
          var found = false;
          for (var color = 0u; color < 32u; color++) {
            if (color >= colors) { break; }
            if ((usedMask & (1u << color)) == 0u) {
              chosenColor = color;
              found = true;
              break;
            }
          }
          if (!found) {
            chosenColor = gid % colors;
            fallback = true;
          }
        }

        bodyConstraintCounts[gid] = (chosenColor << 16u) | constraintCount | select(0u, ${BODY_COLOR_FALLBACK_FLAG}u, fallback);
      }

      fn repairConstraintOtherBodyForJoint(
        body: u32,
        jointIndex: u32,
        jointRecords: ptr<storage, array<vec4f>, read_write>,
      ) -> u32 {
        if (jointIndex >= ${maxJoints}u) { return ${maxBodies}u; }
        let jointMetaWords = loadJointMetaWords(jointRecords, jointIndex);
        if (jointMetaWords.w == 0u) { return ${maxBodies}u; }
        if (jointMetaWords.x == body) { return jointMetaWords.y; }
        if (jointMetaWords.y == body) { return jointMetaWords.x; }
        return ${maxBodies}u;
      }

      fn repairConstraintOtherBodyForSpring(
        body: u32,
        springIndex: u32,
        springRecords: ptr<storage, array<vec4f>, read_write>,
      ) -> u32 {
        if (springIndex >= ${maxSprings}u) { return ${maxBodies}u; }
        let springMetaWords = loadSpringMetaWords(springRecords, springIndex);
        if (springMetaWords.z == 0u) { return ${maxBodies}u; }
        if (springMetaWords.x == body) { return springMetaWords.y; }
        if (springMetaWords.y == body) { return springMetaWords.x; }
        return ${maxBodies}u;
      }
    `, [jointRecordHelpers, springRecordHelpers]);

    this.repairHardBodyColorsKernel = repairHardBodyColorsShader({
      bodyConstraintCounts: storage(bodyConstraintCounts, 'uint', maxBodies),
      bodyConstraintRefs: storage(bodyConstraintRefs, 'uint', maxBodies * maxConstraintsPerBody).toReadOnly(),
      jointRecords: storage(jointRecords, 'vec4f', maxJoints * JOINT_RECORD_VEC4S),
      springRecords: storage(springRecords, 'vec4f', maxSprings * SPRING_RECORD_VEC4S),
      bodyCount: uniform(0),
      colorCount: uniform(1),
      workgroupId,
      localId,
    }).computeKernel([WORKGROUP_SIZE, 1, 1]).setName('AVBD Repair Hard Body Colors');
    assertStorageBufferBudget('AVBD Repair Hard Body Colors', 4);

    // Body-colored AVBD primal pass: each invocation stamps all incident
    // contacts for one body into a single 6x6 local system.
    const makePrimalBodySolveShader = (mode: 'generic' | 'localDiag') => {
      const inertiaParam = mode === 'localDiag'
        ? '        inverseInertia: ptr<storage, array<vec4f>, read>,\n'
        : '        derivedInvInertia: ptr<storage, array<vec4f>, read>,\n';
      const localDiagonalUniformParam = mode === 'generic'
        ? '        useLocalDiagonalInertia: u32,\n'
        : '';
      const inertiaSetup = mode === 'localDiag'
        ? /* wgsl */`
        let inv = inverseInertia[gid];
        let invMass = inv.w;
        let initialBase = gid * 2u;
        let poseBase = gid * ${INERTIAL_POSE_VEC4S_PER_BODY}u;
        let currentPose = inertialPose[poseBase + 2u];
        var pos = currentPose.xyz;
        var q = normalize(inertialPose[poseBase + 3u]);
        if (!(invMass > 0.0)) {
          bodySolveOutputPose[bodySolveOutputBase] = currentPose;
          bodySolveOutputPose[bodySolveOutputBase + 1u] = q;
          return;
        }
        let localInvI = vec3f(
          max(inv.x, 1e-8),
          max(inv.y, 1e-8),
          max(inv.z, 1e-8),
        );

        let initialPos = initialPose[initialBase].xyz;
        let initialQ = normalize(initialPose[initialBase + 1u]);
        let inertialPos = inertialPose[poseBase].xyz;
        let inertialQ = normalize(inertialPose[poseBase + 1u]);

        let dqConstraintRaw = qmul(q, qconj(initialQ));
        let dqConstraint = select(dqConstraintRaw, -dqConstraintRaw, dqConstraintRaw.w < 0.0);
        let dThetaConstraint = 2.0 * dqConstraint.xyz;
        let dqInertialRaw = qmul(q, qconj(inertialQ));
        let dqInertial = select(dqInertialRaw, -dqInertialRaw, dqInertialRaw.w < 0.0);
        let dThetaInertial = 2.0 * dqInertial.xyz;
        let dPosInertial = pos - inertialPos;
        let dPosConstraint = pos - initialPos;

        var A: array<f32, 36>;
        var b: array<f32, 6>;
        for (var r = 0u; r < 6u; r++) {
          b[r] = 0.0;
          for (var c = 0u; c < 6u; c++) {
            A[r * 6u + c] = 0.0;
          }
        }

        let invDt2 = 1.0 / max(dt * dt, 1e-8);
        let mass = 1.0 / max(invMass, 1e-8);
        let mOverDt2 = inertialDiagWeight * invDt2;
        let localIx = 1.0 / localInvI.x;
        let localIy = 1.0 / localInvI.y;
        let localIz = 1.0 / localInvI.z;
        let i00 = localIx;
        let i11 = localIy;
        let i22 = localIz;
        let i01 = 0.0;
        let i02 = 0.0;
        let i12 = 0.0;

        A[0u * 6u + 0u] = mOverDt2 * mass + 1e-4;
        A[1u * 6u + 1u] = mOverDt2 * mass + 1e-4;
        A[2u * 6u + 2u] = mOverDt2 * mass + 1e-4;
        A[3u * 6u + 3u] = mOverDt2 * i00 + 1e-4;
        A[4u * 6u + 4u] = mOverDt2 * i11 + 1e-4;
        A[5u * 6u + 5u] = mOverDt2 * i22 + 1e-4;
        b[0] = mOverDt2 * mass * dPosInertial.x;
        b[1] = mOverDt2 * mass * dPosInertial.y;
        b[2] = mOverDt2 * mass * dPosInertial.z;
        b[3] = mOverDt2 * (i00 * dThetaInertial.x);
        b[4] = mOverDt2 * (i11 * dThetaInertial.y);
        b[5] = mOverDt2 * (i22 * dThetaInertial.z);
`
        : /* wgsl */`
        let base = gid * 3u;
        let invIWorld0 = derivedInvInertia[base + 0u];
        let invIWorld1 = derivedInvInertia[base + 1u];
        let invIWorld2 = derivedInvInertia[base + 2u];
        let invMass = invIWorld0.w;
        let initialBase = gid * 2u;
        let poseBase = gid * ${INERTIAL_POSE_VEC4S_PER_BODY}u;
        let currentPose = inertialPose[poseBase + 2u];
        var pos = currentPose.xyz;
        var q = normalize(inertialPose[poseBase + 3u]);
        if (!(invMass > 0.0)) {
          bodySolveOutputPose[bodySolveOutputBase] = currentPose;
          bodySolveOutputPose[bodySolveOutputBase + 1u] = q;
          return;
        }
        let invIWorld = mat3x3f(
          vec3f(invIWorld0.x, invIWorld0.y, invIWorld0.z),
          vec3f(invIWorld0.y, invIWorld1.x, invIWorld1.y),
          vec3f(invIWorld0.z, invIWorld1.y, invIWorld2.x),
        );
        let localInvI = vec3f(
          max(invIWorld1.z, 1e-8),
          max(invIWorld1.w, 1e-8),
          max(invIWorld2.y, 1e-8),
        );

        let initialPos = initialPose[initialBase].xyz;
        let initialQ = normalize(initialPose[initialBase + 1u]);
        let inertialPos = inertialPose[poseBase].xyz;
        let inertialQ = normalize(inertialPose[poseBase + 1u]);

        let dqConstraintRaw = qmul(q, qconj(initialQ));
        let dqConstraint = select(dqConstraintRaw, -dqConstraintRaw, dqConstraintRaw.w < 0.0);
        let dThetaConstraint = 2.0 * dqConstraint.xyz;
        let dqInertialRaw = qmul(q, qconj(inertialQ));
        let dqInertial = select(dqInertialRaw, -dqInertialRaw, dqInertialRaw.w < 0.0);
        let dThetaInertial = 2.0 * dqInertial.xyz;
        let dPosInertial = pos - inertialPos;
        let dPosConstraint = pos - initialPos;

        var A: array<f32, 36>;
        var b: array<f32, 6>;
        for (var r = 0u; r < 6u; r++) {
          b[r] = 0.0;
          for (var c = 0u; c < 6u; c++) {
            A[r * 6u + c] = 0.0;
          }
        }

        let invDt2 = 1.0 / max(dt * dt, 1e-8);
        let mass = 1.0 / max(invMass, 1e-8);
        let mOverDt2 = inertialDiagWeight * invDt2;

        // Reconstruct world inertia tensor I_world from inv(I_world) and keep
        // it symmetric so the local 6x6 block stays close to SPD.
        let invICol0 = invIWorld[0];
        let invICol1 = invIWorld[1];
        let invICol2 = invIWorld[2];
        let cof0 = cross(invICol1, invICol2);
        let cof1 = cross(invICol2, invICol0);
        let cof2 = cross(invICol0, invICol1);
        let detInvI = dot(invICol0, cof0);
        let detOk = abs(detInvI) > 1e-10;

        let fallbackIx = 1.0 / max(abs(invICol0.x), 1e-8);
        let fallbackIy = 1.0 / max(abs(invICol1.y), 1e-8);
        let fallbackIz = 1.0 / max(abs(invICol2.z), 1e-8);
        let invDetInvI = select(0.0, 1.0 / detInvI, detOk);
        var inertiaCol0 = select(vec3f(fallbackIx, 0.0, 0.0), cof0 * invDetInvI, detOk);
        var inertiaCol1 = select(vec3f(0.0, fallbackIy, 0.0), cof1 * invDetInvI, detOk);
        var inertiaCol2 = select(vec3f(0.0, 0.0, fallbackIz), cof2 * invDetInvI, detOk);

        let useLocalDiag = useLocalDiagonalInertia > 0u;
        let localIx = 1.0 / localInvI.x;
        let localIy = 1.0 / localInvI.y;
        let localIz = 1.0 / localInvI.z;
        let i00 = select(max(inertiaCol0.x, 1e-8), localIx, useLocalDiag);
        let i11 = select(max(inertiaCol1.y, 1e-8), localIy, useLocalDiag);
        let i22 = select(max(inertiaCol2.z, 1e-8), localIz, useLocalDiag);
        let i01 = select(0.5 * (inertiaCol1.x + inertiaCol0.y), 0.0, useLocalDiag);
        let i02 = select(0.5 * (inertiaCol2.x + inertiaCol0.z), 0.0, useLocalDiag);
        let i12 = select(0.5 * (inertiaCol2.y + inertiaCol1.z), 0.0, useLocalDiag);

        A[0u * 6u + 0u] = mOverDt2 * mass + 1e-4;
        A[1u * 6u + 1u] = mOverDt2 * mass + 1e-4;
        A[2u * 6u + 2u] = mOverDt2 * mass + 1e-4;
        A[3u * 6u + 3u] = mOverDt2 * i00 + 1e-4;
        A[4u * 6u + 4u] = mOverDt2 * i11 + 1e-4;
        A[5u * 6u + 5u] = mOverDt2 * i22 + 1e-4;
        A[3u * 6u + 4u] = mOverDt2 * i01;
        A[4u * 6u + 3u] = A[3u * 6u + 4u];
        A[3u * 6u + 5u] = mOverDt2 * i02;
        A[5u * 6u + 3u] = A[3u * 6u + 5u];
        A[4u * 6u + 5u] = mOverDt2 * i12;
        A[5u * 6u + 4u] = A[4u * 6u + 5u];
        b[0] = mOverDt2 * mass * dPosInertial.x;
        b[1] = mOverDt2 * mass * dPosInertial.y;
        b[2] = mOverDt2 * mass * dPosInertial.z;
        b[3] = mOverDt2 * (i00 * dThetaInertial.x + i01 * dThetaInertial.y + i02 * dThetaInertial.z);
        b[4] = mOverDt2 * (i01 * dThetaInertial.x + i11 * dThetaInertial.y + i12 * dThetaInertial.z);
        b[5] = mOverDt2 * (i02 * dThetaInertial.x + i12 * dThetaInertial.y + i22 * dThetaInertial.z);
`;

      return wgslFn(/* wgsl */`
      fn compute(
        initialPose: ptr<storage, array<vec4f>, read>,
        inertialPose: ptr<storage, array<vec4f>, read>,
        bodySolveOutputPose: ptr<storage, array<vec4f>, read_write>,
${inertiaParam}        bodyConstraintCounts: ptr<storage, array<u32>, read>,
        bodyConstraintRefs: ptr<storage, array<u32>, read>,
        pairContacts: ptr<storage, array<vec4f>, read_write>,
        jointRecords: ptr<storage, array<vec4f>, read_write>,
        springRecords: ptr<storage, array<vec4f>, read_write>,
        bodyCount: u32,
        bodyIndexBase: u32,
        dispatchBodyCount: u32,
        bodySolveMode: u32,
        currentColor: u32,
        sweepOffset: u32,
        regularizationAlpha: f32,
        tangentialRegularizationAlpha: f32,
        relaxation: f32,
        frictionRelaxation: f32,
        frictionStatic: f32,
        frictionDynamic: f32,
        useReferenceTangentialUpdate: u32,
        frictionSolveScale: f32,
        kStart: f32,
        dualForceMax: f32,
        enableNormalReleaseHeuristic: u32,
        enableHessianRescaling: u32,
        dt: f32,
        inertialDiagWeight: f32,
        maxLinearCorrection: f32,
        maxAngularCorrection: f32,
${localDiagonalUniformParam}        useNormalContactMargin: u32,
        useLocalContactArms: u32,
        alwaysStampNormalHessian: u32,
        alwaysStampTangentialHessian: u32,
        workgroupId: vec3u,
        localId: vec3u,
      ) -> void {
        let localIndex = workgroupId.x * ${WORKGROUP_SIZE}u + localId.x;
        if (localIndex >= dispatchBodyCount) { return; }
        let gid = bodyIndexBase + localIndex;
        if (gid >= bodyCount) { return; }

        let countWord = bodyConstraintCounts[gid];
        let bodyColor = (countWord >> 16u) & 0xFFu;
        if (bodySolveMode == 0u && bodyColor != currentColor) { return; }
        let contactCount = min(countWord & 0xFFFFu, ${maxConstraintsPerBody}u);
        let bodySolveOutputBase = gid * 2u;

${inertiaSetup}

        let bodyBase = gid * ${maxConstraintsPerBody}u;
        for (var k = 0u; k < ${maxConstraintsPerBody}u; k++) {
          if (k >= contactCount) { break; }
          let contactIndex = (k + sweepOffset) % contactCount;
          let constraintRef = bodyConstraintRefs[bodyBase + contactIndex];
          let constraintTag = constraintRef & ${CONSTRAINT_REF_TAG_MASK}u;
          let constraintIndex = constraintRef & ${CONSTRAINT_REF_INDEX_MASK}u;
          if (constraintTag == ${CONSTRAINT_REF_TAG_JOINT}u) {
            let jointIndex = constraintIndex;
            if (jointIndex >= ${maxJoints}u) { continue; }
            let jointMeta = loadJointMetaWords(jointRecords, jointIndex);
            if (jointMeta.w == 0u) { continue; }
            let jointBodyA = jointMeta.x;
            let jointBodyB = jointMeta.y;
            let jointType = jointMeta.z;
            let isJointA = jointBodyA == gid;
            let isJointB = jointBodyB == gid;
            if (!isJointA && !isJointB) { continue; }

            let anchorA = loadJointAnchorA(jointRecords, jointIndex);
            let anchorB = loadJointAnchorB(jointRecords, jointIndex);
            let stiffness = loadJointStiffness(jointRecords, jointIndex);
            let penaltyLin = loadJointPenaltyLin(jointRecords, jointIndex).xyz;
            let penaltyAng = loadJointPenaltyAng(jointRecords, jointIndex).xyz;
            let lambdaLin = loadJointLambdaLin(jointRecords, jointIndex).xyz;
            let lambdaAng = loadJointLambdaAng(jointRecords, jointIndex).xyz;
            let c0Lin = loadJointC0Lin(jointRecords, jointIndex).xyz;
            let c0Ang = loadJointC0Ang(jointRecords, jointIndex).xyz;
            let torqueArm = max(anchorA.w, 1.0);

            var currentQA = vec4f(0.0, 0.0, 0.0, 1.0);
            var currentPosA = anchorA.xyz;
            if (jointBodyA != WORLD_BODY_INDEX) {
              currentQA = normalize(select(
                inertialPose[jointBodyA * ${INERTIAL_POSE_VEC4S_PER_BODY}u + 3u],
                q,
                jointBodyA == gid,
              ));
              currentPosA = select(
                inertialPose[jointBodyA * ${INERTIAL_POSE_VEC4S_PER_BODY}u + 2u].xyz,
                pos,
                jointBodyA == gid,
              );
            }
            let currentQB = normalize(select(
              inertialPose[jointBodyB * ${INERTIAL_POSE_VEC4S_PER_BODY}u + 3u],
              q,
              jointBodyB == gid,
            ));
            let currentPosB = select(
              inertialPose[jointBodyB * ${INERTIAL_POSE_VEC4S_PER_BODY}u + 2u].xyz,
              pos,
              jointBodyB == gid,
            );
            let rA = qrot(currentQA, anchorA.xyz);
            let rB = qrot(currentQB, anchorB.xyz);
            let worldAnchorA = jointWorldAnchor(jointBodyA, anchorA.xyz, currentPosA, currentQA);
            let worldAnchorB = currentPosB + rB;
            let rigidLinear = !isFiniteF32(stiffness.x);
            let linearConstraint = (worldAnchorA - worldAnchorB) - select(vec3f(0.0), c0Lin * regularizationAlpha, rigidLinear);
            let linearForce = penaltyLin * linearConstraint + lambdaLin;

            var linearRow0 = array<f32, 6>(0.0, 0.0, 0.0, 0.0, 0.0, 0.0);
            var linearRow1 = array<f32, 6>(0.0, 0.0, 0.0, 0.0, 0.0, 0.0);
            var linearRow2 = array<f32, 6>(0.0, 0.0, 0.0, 0.0, 0.0, 0.0);
            if (isJointA) {
              linearRow0 = array<f32, 6>(1.0, 0.0, 0.0, 0.0, rA.z, -rA.y);
              linearRow1 = array<f32, 6>(0.0, 1.0, 0.0, -rA.z, 0.0, rA.x);
              linearRow2 = array<f32, 6>(0.0, 0.0, 1.0, rA.y, -rA.x, 0.0);
            } else {
              linearRow0 = array<f32, 6>(-1.0, 0.0, 0.0, 0.0, -rB.z, rB.y);
              linearRow1 = array<f32, 6>(0.0, -1.0, 0.0, rB.z, 0.0, -rB.x);
              linearRow2 = array<f32, 6>(0.0, 0.0, -1.0, -rB.y, rB.x, 0.0);
            }
            let linearSign = select(-1.0, 1.0, isJointA);
            addDiagonalVectorConstraint(&A, &b, linearRow0, linearRow1, linearRow2, penaltyLin, linearForce);
            let rGeom = select(-rB, rA, isJointA);
            let jointGeomDiag = jointBallSocketGeometricDiagonal(rGeom, linearForce);
            A[3u * 6u + 3u] += jointGeomDiag.x;
            A[4u * 6u + 4u] += jointGeomDiag.y;
            A[5u * 6u + 5u] += jointGeomDiag.z;

            if (jointType == JOINT_TYPE_FIXED && stiffness.y > 0.0) {
              let rigidAngular = !isFiniteF32(stiffness.y);
              let angularConstraint = jointFixedAngularConstraint(jointBodyA, currentQA, currentQB, torqueArm) - select(vec3f(0.0), c0Ang * regularizationAlpha, rigidAngular);
              let angularForce = penaltyAng * angularConstraint + lambdaAng;
              let angularRow0 = array<f32, 6>(0.0, 0.0, 0.0, linearSign * torqueArm, 0.0, 0.0);
              let angularRow1 = array<f32, 6>(0.0, 0.0, 0.0, 0.0, linearSign * torqueArm, 0.0);
              let angularRow2 = array<f32, 6>(0.0, 0.0, 0.0, 0.0, 0.0, linearSign * torqueArm);
              addDiagonalVectorConstraint(&A, &b, angularRow0, angularRow1, angularRow2, penaltyAng, angularForce);
            }
            continue;
          }

          if (constraintTag == ${CONSTRAINT_REF_TAG_SPRING}u) {
            let springIndex = constraintIndex;
            if (springIndex >= ${maxSprings}u) { continue; }
            let springMeta = loadSpringMetaWords(springRecords, springIndex);
            if (springMeta.z == 0u) { continue; }
            let springBodyA = springMeta.x;
            let springBodyB = springMeta.y;
            let isSpringA = springBodyA == gid;
            let isSpringB = springBodyB == gid;
            if (!isSpringA && !isSpringB) { continue; }

            let anchorARest = loadSpringAnchorARest(springRecords, springIndex);
            let anchorBStiffness = loadSpringAnchorBStiffness(springRecords, springIndex);
            let restLength = max(anchorARest.w, 0.0);
            let springStiffness = max(anchorBStiffness.w, 0.0);
            if (springStiffness <= 0.0) { continue; }

            var currentSpringQA = vec4f(0.0, 0.0, 0.0, 1.0);
            var currentSpringPosA = anchorARest.xyz;
            if (springBodyA != WORLD_BODY_INDEX) {
              currentSpringQA = normalize(select(
                inertialPose[springBodyA * ${INERTIAL_POSE_VEC4S_PER_BODY}u + 3u],
                q,
                springBodyA == gid,
              ));
              currentSpringPosA = select(
                inertialPose[springBodyA * ${INERTIAL_POSE_VEC4S_PER_BODY}u + 2u].xyz,
                pos,
                springBodyA == gid,
              );
            }
            let currentSpringQB = normalize(select(
              inertialPose[springBodyB * ${INERTIAL_POSE_VEC4S_PER_BODY}u + 3u],
              q,
              springBodyB == gid,
            ));
            let currentSpringPosB = select(
              inertialPose[springBodyB * ${INERTIAL_POSE_VEC4S_PER_BODY}u + 2u].xyz,
              pos,
              springBodyB == gid,
            );
            let rSpringA = qrot(currentSpringQA, anchorARest.xyz);
            let rSpringB = qrot(currentSpringQB, anchorBStiffness.xyz);
            let worldSpringA = jointWorldAnchor(springBodyA, anchorARest.xyz, currentSpringPosA, currentSpringQA);
            let worldSpringB = currentSpringPosB + rSpringB;
            let springDelta = worldSpringA - worldSpringB;
            let springLength = length(springDelta);
            if (springLength <= 1e-6) { continue; }
            let springNormal = springDelta / springLength;
            let springConstraint = springLength - restLength;
            let springForce = springStiffness * springConstraint;
            let springJLin = select(-springNormal, springNormal, isSpringA);
            let springArm = select(rSpringB, rSpringA, isSpringA);
            let springJAng = select(-cross(springArm, springNormal), cross(springArm, springNormal), isSpringA);
            let springRow = array<f32, 6>(
              springJLin.x,
              springJLin.y,
              springJLin.z,
              springJAng.x,
              springJAng.y,
              springJAng.z,
            );
            addScalarConstraint(&A, &b, springRow, springStiffness, springForce);
            continue;
          }

          let p = constraintIndex;
          if (p >= ${maxPairContacts}u) { continue; }

          let n = loadContactNormalPen(pairContacts, p).xyz;
          if (dot(n, n) <= 1e-10) { continue; }

          let armA = loadContactArmA(pairContacts, p);
          let armB = loadContactArmB(pairContacts, p);
          let contactMeta = loadContactMeta(pairContacts, p);
          let i = u32(contactMeta.x + 0.5);
          let j = u32(contactMeta.y + 0.5);
          let isA = i == gid;
          let isB = j == gid;
          if (!isA && !isB) { continue; }
          let other = select(i, j, isA);
          if (other >= bodyCount || other == gid) { continue; }
          let raStored = armA.xyz;
          let rbStored = armB.xyz;
          let otherPoseBase = other * ${INERTIAL_POSE_VEC4S_PER_BODY}u;
          let otherPos = inertialPose[otherPoseBase + 2u].xyz;
          let otherQ = normalize(inertialPose[otherPoseBase + 3u]);
          let otherInitialBase = other * 2u;
          let initialOtherPos = initialPose[otherInitialBase].xyz;
          let initialOtherQ = normalize(initialPose[otherInitialBase + 1u]);
          let currentQA = select(otherQ, q, isA);
          let currentQB = select(q, otherQ, isA);
          let initialQA = select(initialOtherQ, initialQ, isA);
          let initialQB = select(initialQ, initialOtherQ, isA);
          let localContactArms = useLocalContactArms > 0u;
          let ra = select(raStored, qrot(currentQA, raStored), localContactArms);
          let rb = select(rbStored, qrot(currentQB, rbStored), localContactArms);
          let dqOtherConstraintRaw = qmul(otherQ, qconj(initialOtherQ));
          let dqOtherConstraint = select(dqOtherConstraintRaw, -dqOtherConstraintRaw, dqOtherConstraintRaw.w < 0.0);
          let dThetaOtherConstraint = 2.0 * dqOtherConstraint.xyz;
          let dPosOtherConstraint = otherPos - initialOtherPos;

          let dPosA = select(dPosOtherConstraint, dPosConstraint, isA);
          let dPosB = select(dPosConstraint, dPosOtherConstraint, isA);
          let dThetaA = select(dThetaOtherConstraint, dThetaConstraint, isA);
          let dThetaB = select(dThetaConstraint, dThetaOtherConstraint, isA);

          let jAL = -n;
          let jBL = n;
          let jAA = -cross(ra, n);
          let jBA = cross(rb, n);

          let tangentBasis = tangentBasisFromAngle(n, armA.w);
          let t1 = tangentBasis.t1;
          let t2 = tangentBasis.t2;

          let penetration0 = max(loadContactNormalPen(pairContacts, p).w, 0.0);
          let cachedConstraintC0 = loadContactConstraintC0(pairContacts, p);
          let c0 = cachedConstraintC0.x;
          let cRegN = (1.0 - regularizationAlpha) * c0
            + dot(jAL, dPosA)
            + dot(jAA, dThetaA)
            + dot(jBL, dPosB)
            + dot(jBA, dThetaB);
          let c0T1 = cachedConstraintC0.y;
          let c0T2 = cachedConstraintC0.z;

          let contactState = loadContactStateHot(pairContacts, p, kStart);
          let dualState = contactState.dual;
          let dualN = clamp(dualState.x, -dualForceMax, 0.0);
          let penaltyN = max(contactState.penaltyN, kStart);
          let penaltyTBRaw = max(contactState.penalty.yz, vec2f(kStart));
          let contactFrictionScale = contactState.frictionScale;
          let frictionStaticLocal = frictionStatic * contactFrictionScale * frictionSolveScale;
          let frictionDynamicLocal = frictionDynamic * contactFrictionScale * frictionSolveScale;
          let useReferenceTangential = useReferenceTangentialUpdate > 0u;
          let penaltyTB = penaltyTBRaw;
          var dualTB = contactStateDualTB(
            contactState,
            n,
            t1,
            t2,
            select(0u, 1u, useReferenceTangential),
          );
          let prevTMag = length(dualTB);
          let staticBoundPrev = frictionStaticLocal * abs(dualN);
          let useStatic = prevTMag <= staticBoundPrev + 1e-6;

          let bodyR = select(rb, ra, isA);
          let sign = select(1.0, -1.0, isA);
          let jNLinear = sign * n;
          let jNAngular = sign * cross(bodyR, n);

          let lambdaLower = -dualForceMax;
          let lambdaPlusN = dualN + penaltyN * cRegN;
          var lambdaAppliedN = clamp(lambdaPlusN, lambdaLower, 0.0);
          let normalSupportThreshold = 1e-6;
          let normalReleaseTolerance = max(2e-5, 1.25 * penetration0);
          let normalReleaseDecayNear = 0.85;
          let normalReleaseDecayFar = 0.6;
          let normalReleaseMinSupport = -5e-4;
          if (
            enableNormalReleaseHeuristic > 0u &&
            penetration0 > 1e-6
            && dualN < -normalSupportThreshold
            && cRegN > 0.0
            && -lambdaAppliedN <= normalSupportThreshold
          ) {
            let releaseDecay = select(normalReleaseDecayFar, normalReleaseDecayNear, cRegN <= normalReleaseTolerance);
            lambdaAppliedN = min(dualN * releaseDecay, normalReleaseMinSupport);
          }
          let frictionSeparationTolerance = normalReleaseTolerance;
          let frictionOffSeparation = -lambdaAppliedN <= normalSupportThreshold
            || (enableNormalReleaseHeuristic > 0u && cRegN > frictionSeparationTolerance);
          if (lambdaAppliedN < -1e-9 || alwaysStampNormalHessian > 0u) {
            var kHessN = penaltyN;
            if (
              lambdaAppliedN < -1e-9 &&
              enableHessianRescaling > 0u
              && abs(lambdaAppliedN - lambdaPlusN) > 1e-8
              && abs(cRegN) > 1e-8
            ) {
              // Eq.14-style stiffness rescaling for clamped multipliers.
              kHessN = max(abs((lambdaAppliedN - dualN) / cRegN), 1e-6);
            }
            var jNRhs: array<f32, 6>;
            jNRhs[0] = jNLinear.x; jNRhs[1] = jNLinear.y; jNRhs[2] = jNLinear.z;
            jNRhs[3] = jNAngular.x; jNRhs[4] = jNAngular.y; jNRhs[5] = jNAngular.z;
            var jNHess: array<f32, 6>;
            jNHess[0] = jNLinear.x; jNHess[1] = jNLinear.y; jNHess[2] = jNLinear.z;
            jNHess[3] = jNAngular.x; jNHess[4] = jNAngular.y; jNHess[5] = jNAngular.z;
            for (var r = 0u; r < 6u; r++) {
              b[r] += jNRhs[r] * lambdaAppliedN;
              for (var c = 0u; c < 6u; c++) {
                A[r * 6u + c] += kHessN * jNHess[r] * jNHess[c];
              }
            }
          }

          if (frictionStaticLocal > 1e-8 || frictionDynamicLocal > 1e-8) {
            let stampTangentialOnSeparating = frictionOffSeparation && alwaysStampTangentialHessian > 0u;
            // Default AVBD friction policy skips tangential rows when the
            // contact is separating. The full-hessian experiment keeps the
            // tangential stiffness in A while still clamping the RHS to zero.
            if (!useReferenceTangential && frictionOffSeparation && !stampTangentialOnSeparating) {
              continue;
            }
            if (useReferenceTangential && lambdaAppliedN >= -1e-9 && alwaysStampTangentialHessian == 0u) {
              continue;
            }
            let jt1AL = -t1;
            let jt1BL = t1;
            let jt1AA = -cross(ra, t1);
            let jt1BA = cross(rb, t1);
            let cRegT1 = (1.0 - tangentialRegularizationAlpha) * c0T1
              + dot(jt1AL, dPosA)
              + dot(jt1AA, dThetaA)
              + dot(jt1BL, dPosB)
              + dot(jt1BA, dThetaB);
            let jT1Linear = sign * t1;
            let jT1Angular = sign * cross(bodyR, t1);
            var jT1: array<f32, 6>;
            jT1[0] = jT1Linear.x; jT1[1] = jT1Linear.y; jT1[2] = jT1Linear.z;
            jT1[3] = jT1Angular.x; jT1[4] = jT1Angular.y; jT1[5] = jT1Angular.z;

            let jt2AL = -t2;
            let jt2BL = t2;
            let jt2AA = -cross(ra, t2);
            let jt2BA = cross(rb, t2);
            let cRegT2 = (1.0 - tangentialRegularizationAlpha) * c0T2
              + dot(jt2AL, dPosA)
              + dot(jt2AA, dThetaA)
              + dot(jt2BL, dPosB)
              + dot(jt2BA, dThetaB);
            // Couple tangential rows with a conical clamp in (t1,t2) space.
            // Independent axis clamps allow sqrt(2) overshoot and can cause
            // lateral breakout in stacked contacts.
            let lambdaPlusTB = vec2f(
              penaltyTB.x * cRegT1 + dualTB.x,
              penaltyTB.y * cRegT2 + dualTB.y,
            );
            var lambdaAppliedTB = lambdaPlusTB;
            var wT1 = penaltyTB.x * frictionRelaxation;
            var wT2 = penaltyTB.y * frictionRelaxation;
            if (useReferenceTangential) {
              let referenceBound = frictionStaticLocal * max(-lambdaAppliedN, 0.0);
              let lambdaAppliedTBLen2 = dot(lambdaAppliedTB, lambdaAppliedTB);
              if (lambdaAppliedTBLen2 > referenceBound * referenceBound && lambdaAppliedTBLen2 > 1e-12) {
                lambdaAppliedTB *= referenceBound * inverseSqrt(lambdaAppliedTBLen2);
              }
              if (referenceBound <= 1e-6) {
                lambdaAppliedTB = vec2f(0.0);
              }
            } else {
              // AVBD friction policy:
              // start in static mode only when previous dual was inside static cone.
              // if this iteration violates static cone, switch to dynamic cone.
              // In the primal stage, keep tangential bounds on the previous normal
              // dual state for this contact iteration. This matches the 2D reference
              // structure where tangential bounds are derived from persisted lambda_n
              // (updated in dual/capture), not from the row-local normal projection.
              let frictionSupportN = select(max(dualN, lambdaAppliedN), 0.0, stampTangentialOnSeparating);
              let staticBound = frictionStaticLocal * max(-frictionSupportN, 0.0);
              let dynamicBound = frictionDynamicLocal * max(-frictionSupportN, 0.0);
              let lambdaPlusTBlen2 = dot(lambdaAppliedTB, lambdaAppliedTB);
              var frictionBound = select(dynamicBound, staticBound, useStatic);
              if (useStatic && lambdaPlusTBlen2 > staticBound * staticBound + 1e-12) {
                frictionBound = dynamicBound;
              }
              frictionBound = max(frictionBound, 0.0);

              let lambdaAppliedTBLen2 = dot(lambdaAppliedTB, lambdaAppliedTB);
              if (lambdaAppliedTBLen2 > frictionBound * frictionBound && lambdaAppliedTBLen2 > 1e-12) {
                lambdaAppliedTB *= frictionBound * inverseSqrt(lambdaAppliedTBLen2);
              }
              // Eq.14-style tangential stiffness rescaling when cone projection
              // clamps the unconstrained lambda update.
              if (
                !stampTangentialOnSeparating &&
                enableHessianRescaling > 0u
                && abs(lambdaAppliedTB.x - lambdaPlusTB.x) > 1e-8
                && abs(cRegT1) > 1e-8
              ) {
                wT1 = max(abs((lambdaAppliedTB.x - dualTB.x) / cRegT1), 1e-6) * frictionRelaxation;
              }
              if (
                !stampTangentialOnSeparating &&
                enableHessianRescaling > 0u
                && abs(lambdaAppliedTB.y - lambdaPlusTB.y) > 1e-8
                && abs(cRegT2) > 1e-8
              ) {
                wT2 = max(abs((lambdaAppliedTB.y - dualTB.y) / cRegT2), 1e-6) * frictionRelaxation;
              }
            }
            let lambdaAppliedT1 = lambdaAppliedTB.x;
            let lambdaAppliedT2 = lambdaAppliedTB.y;

            let jT2Linear = sign * t2;
            let jT2Angular = sign * cross(bodyR, t2);
            var jT2: array<f32, 6>;
            jT2[0] = jT2Linear.x; jT2[1] = jT2Linear.y; jT2[2] = jT2Linear.z;
            jT2[3] = jT2Angular.x; jT2[4] = jT2Angular.y; jT2[5] = jT2Angular.z;
            for (var r = 0u; r < 6u; r++) {
              b[r] += jT1[r] * lambdaAppliedT1;
              for (var c = 0u; c < 6u; c++) {
                A[r * 6u + c] += wT1 * jT1[r] * jT1[c];
              }
            }
            for (var r = 0u; r < 6u; r++) {
              b[r] += jT2[r] * lambdaAppliedT2;
              for (var c = 0u; c < 6u; c++) {
                A[r * 6u + c] += wT2 * jT2[r] * jT2[c];
              }
            }
          }
        }

        // Re-symmetrize before solve to reduce drift from accumulation order.
        for (var r = 0u; r < 6u; r++) {
          for (var c = r + 1u; c < 6u; c++) {
            let s = 0.5 * (A[r * 6u + c] + A[c * 6u + r]);
            A[r * 6u + c] = s;
            A[c * 6u + r] = s;
          }
          A[r * 6u + r] = max(A[r * 6u + r], 1e-6);
        }

        // SPD-focused LDL^T factorization with diagonal regularization fallback.
        var L: array<f32, 36>;
        var D: array<f32, 6>;
        for (var r = 0u; r < 6u; r++) {
          D[r] = 0.0;
          for (var c = 0u; c < 6u; c++) {
            L[r * 6u + c] = 0.0;
          }
        }

        for (var i = 0u; i < 6u; i++) {
          for (var j = 0u; j < i; j++) {
            var sumL = A[i * 6u + j];
            for (var k = 0u; k < j; k++) {
              sumL -= L[i * 6u + k] * D[k] * L[j * 6u + k];
            }
            let d = select(1e-6, D[j], abs(D[j]) > 1e-6);
            L[i * 6u + j] = sumL / d;
          }

          var diag = A[i * 6u + i];
          for (var k = 0u; k < i; k++) {
            diag -= L[i * 6u + k] * L[i * 6u + k] * D[k];
          }
          D[i] = max(diag, 1e-6);
          L[i * 6u + i] = 1.0;
        }

        var y: array<f32, 6>;
        for (var i = 0u; i < 6u; i++) {
          var sumF = b[i];
          for (var k = 0u; k < i; k++) {
            sumF -= L[i * 6u + k] * y[k];
          }
          y[i] = sumF;
        }

        var z: array<f32, 6>;
        for (var i = 0u; i < 6u; i++) {
          z[i] = y[i] / D[i];
        }

        var x: array<f32, 6>;
        for (var i = 0u; i < 6u; i++) { x[i] = 0.0; }
        for (var rev = 0u; rev < 6u; rev++) {
          let row = 5u - rev;
          var sumB = z[row];
          for (var c = row + 1u; c < 6u; c++) {
            sumB -= L[c * 6u + row] * x[c];
          }
          x[row] = sumB;
        }

        var dPosSolve = vec3f(x[0], x[1], x[2]);
        var dThetaSolve = vec3f(x[3], x[4], x[5]);
        let linLen2 = dot(dPosSolve, dPosSolve);
        if (linLen2 > maxLinearCorrection * maxLinearCorrection && linLen2 > 1e-12) {
          dPosSolve *= maxLinearCorrection * inverseSqrt(linLen2);
        }
        let angLen2 = dot(dThetaSolve, dThetaSolve);
        if (angLen2 > maxAngularCorrection * maxAngularCorrection && angLen2 > 1e-12) {
          dThetaSolve *= maxAngularCorrection * inverseSqrt(angLen2);
        }

        let appliedDPos = -dPosSolve * relaxation;
        let appliedDTheta = -dThetaSolve * relaxation;
        pos += appliedDPos;
        q = normalize(q + 0.5 * qmul(vec4f(appliedDTheta, 0.0), q));

        bodySolveOutputPose[bodySolveOutputBase] = vec4f(pos, currentPose.w);
        bodySolveOutputPose[bodySolveOutputBase + 1u] = q;
      }
    `, [qrot, qmul, qconj, tangentBasisHelpers, contactRecordHelpers, contactStateHelpers, jointRecordHelpers, springRecordHelpers, jointConstraintHelpers]);
    };

    const primalBodySolveStorageBuffers = 9;
    assertStorageBufferBudget('AVBD Body Primal Solve', primalBodySolveStorageBuffers);

    const primalBodySolveShaderGeneric = makePrimalBodySolveShader('generic');
    const primalBodySolveShaderLocalDiag = makePrimalBodySolveShader('localDiag');

    this.primalBodySolveKernelGeneric = primalBodySolveShaderGeneric({
      initialPose: storage(initialPose, 'vec4f', maxBodies * 2).toReadOnly(),
      inertialPose: storage(inertialPose, 'vec4f', maxBodies * INERTIAL_POSE_VEC4S_PER_BODY).toReadOnly(),
      bodySolveOutputPose: storage(this.bodySolveOutputPoseAttr, 'vec4f', maxBodies * 2),
      derivedInvInertia: storage(derivedInvInertia, 'vec4f', maxBodies * 3).toReadOnly(),
      bodyConstraintCounts: storage(bodyConstraintCounts, 'uint', maxBodies).toReadOnly(),
      bodyConstraintRefs: storage(bodyConstraintRefs, 'uint', maxBodies * maxConstraintsPerBody).toReadOnly(),
      pairContacts: storage(pairContacts, 'vec4f', maxPairContacts * CONTACT_RECORD_VEC4S),
      jointRecords: storage(jointRecords, 'vec4f', maxJoints * JOINT_RECORD_VEC4S),
      springRecords: storage(springRecords, 'vec4f', maxSprings * SPRING_RECORD_VEC4S),
      bodyCount: uniform(0),
      bodyIndexBase: uniform(0),
      dispatchBodyCount: uniform(0),
      bodySolveMode: uniform(0),
      currentColor: uniform(0),
      sweepOffset: uniform(0),
      regularizationAlpha: uniform(AVBD_REGULARIZATION_ALPHA_DEFAULT),
      tangentialRegularizationAlpha: uniform(AVBD_REGULARIZATION_ALPHA_DEFAULT),
      relaxation: uniform(1.0),
      // Keep tangential rows numerically consistent with clamped-force RHS.
      // The 2D AVBD reference effectively uses 1.0 here.
      frictionRelaxation: uniform(1.0),
      frictionStatic: uniform(AVBD_FRICTION_STATIC),
      frictionDynamic: uniform(AVBD_FRICTION_DYNAMIC),
      useReferenceTangentialUpdate: uniform(1),
      frictionSolveScale: uniform(1.0),
      kStart: uniform(AVBD_K_START),
      dualForceMax: uniform(10000000000.0),
      enableNormalReleaseHeuristic: uniform(0),
      enableHessianRescaling: uniform(0),
      dt: uniform(1 / 60 / 4),
      inertialDiagWeight: uniform(1.0),
      maxLinearCorrection: uniform(1000000000.0),
      maxAngularCorrection: uniform(1000000000.0),
      useLocalDiagonalInertia: uniform(1),
      useNormalContactMargin: uniform(1),
      useLocalContactArms: uniform(1),
      alwaysStampNormalHessian: uniform(1),
      alwaysStampTangentialHessian: uniform(0),
      workgroupId,
      localId,
    }).computeKernel([WORKGROUP_SIZE, 1, 1]).setName('AVBD Body Primal Solve Generic');

    this.primalBodySolveKernelLocalDiag = primalBodySolveShaderLocalDiag({
      initialPose: storage(initialPose, 'vec4f', maxBodies * 2).toReadOnly(),
      inertialPose: storage(inertialPose, 'vec4f', maxBodies * INERTIAL_POSE_VEC4S_PER_BODY).toReadOnly(),
      bodySolveOutputPose: storage(this.bodySolveOutputPoseAttr, 'vec4f', maxBodies * 2),
      inverseInertia: storage(inverseInertia, 'vec4f', maxBodies).toReadOnly(),
      bodyConstraintCounts: storage(bodyConstraintCounts, 'uint', maxBodies).toReadOnly(),
      bodyConstraintRefs: storage(bodyConstraintRefs, 'uint', maxBodies * maxConstraintsPerBody).toReadOnly(),
      pairContacts: storage(pairContacts, 'vec4f', maxPairContacts * CONTACT_RECORD_VEC4S),
      jointRecords: storage(jointRecords, 'vec4f', maxJoints * JOINT_RECORD_VEC4S),
      springRecords: storage(springRecords, 'vec4f', maxSprings * SPRING_RECORD_VEC4S),
      bodyCount: uniform(0),
      bodyIndexBase: uniform(0),
      dispatchBodyCount: uniform(0),
      bodySolveMode: uniform(0),
      currentColor: uniform(0),
      sweepOffset: uniform(0),
      regularizationAlpha: uniform(AVBD_REGULARIZATION_ALPHA_DEFAULT),
      tangentialRegularizationAlpha: uniform(AVBD_REGULARIZATION_ALPHA_DEFAULT),
      relaxation: uniform(1.0),
      frictionRelaxation: uniform(1.0),
      frictionStatic: uniform(AVBD_FRICTION_STATIC),
      frictionDynamic: uniform(AVBD_FRICTION_DYNAMIC),
      useReferenceTangentialUpdate: uniform(1),
      frictionSolveScale: uniform(1.0),
      kStart: uniform(AVBD_K_START),
      dualForceMax: uniform(10000000000.0),
      enableNormalReleaseHeuristic: uniform(0),
      enableHessianRescaling: uniform(0),
      dt: uniform(1 / 60 / 4),
      inertialDiagWeight: uniform(1.0),
      maxLinearCorrection: uniform(1000000000.0),
      maxAngularCorrection: uniform(1000000000.0),
      useNormalContactMargin: uniform(1),
      useLocalContactArms: uniform(1),
      alwaysStampNormalHessian: uniform(1),
      alwaysStampTangentialHessian: uniform(0),
      workgroupId,
      localId,
    }).computeKernel([WORKGROUP_SIZE, 1, 1]).setName('AVBD Body Primal Solve Local Diag');

    this.primalBodySolveKernel = this.useLocalDiagonalPrimalSolveFastPath
      ? this.primalBodySolveKernelLocalDiag
      : this.primalBodySolveKernelGeneric;

    const commitBodySolveShader = wgslFn(/* wgsl */`
      fn compute(
        bodyConstraintCounts: ptr<storage, array<u32>, read>,
        bodySolveOutputPose: ptr<storage, array<vec4f>, read>,
        inertialPose: ptr<storage, array<vec4f>, read_write>,
        bodyCount: u32,
        bodyIndexBase: u32,
        dispatchBodyCount: u32,
        bodySolveMode: u32,
        currentColor: u32,
        workgroupId: vec3u,
        localId: vec3u,
      ) -> void {
        let localIndex = workgroupId.x * ${WORKGROUP_SIZE}u + localId.x;
        if (localIndex >= dispatchBodyCount) { return; }
        let gid = bodyIndexBase + localIndex;
        if (gid >= bodyCount) { return; }

        let countWord = bodyConstraintCounts[gid];
        let bodyColor = (countWord >> 16u) & 0xFFu;
        if (bodySolveMode == 0u && bodyColor != currentColor) { return; }

        let outputBase = gid * 2u;
        let poseBase = gid * ${INERTIAL_POSE_VEC4S_PER_BODY}u;
        inertialPose[poseBase + 2u] = bodySolveOutputPose[outputBase];
        inertialPose[poseBase + 3u] = normalize(bodySolveOutputPose[outputBase + 1u]);
      }
    `);

    this.commitBodySolveKernel = commitBodySolveShader({
      bodyConstraintCounts: storage(bodyConstraintCounts, 'uint', maxBodies).toReadOnly(),
      bodySolveOutputPose: storage(this.bodySolveOutputPoseAttr, 'vec4f', maxBodies * 2).toReadOnly(),
      inertialPose: storage(inertialPose, 'vec4f', maxBodies * INERTIAL_POSE_VEC4S_PER_BODY),
      bodyCount: uniform(0),
      bodyIndexBase: uniform(0),
      dispatchBodyCount: uniform(0),
      bodySolveMode: uniform(0),
      currentColor: uniform(0),
      workgroupId,
      localId,
    }).computeKernel([WORKGROUP_SIZE, 1, 1]).setName('AVBD Commit Body Solve');
    assertStorageBufferBudget('AVBD Commit Body Solve', 3);

    const capturePairDualStateShader = wgslFn(/* wgsl */`
      fn compute(
        inertialPose: ptr<storage, array<vec4f>, read>,
        initialPose: ptr<storage, array<vec4f>, read>,
        pairContacts: ptr<storage, array<vec4f>, read_write>,
        pairActivity: ptr<storage, array<u32>, read_write>,
        pairDispatchCount: u32,
        regularizationAlpha: f32,
        beta: f32,
        frictionStatic: f32,
        frictionDynamic: f32,
        kStart: f32,
        kMax: f32,
        lambdaMax: f32,
        preventPenetratingNormalDropout: u32,
        enableNormalReleaseHeuristic: u32,
        freezeTangentialPenaltyOnStick: u32,
        freezeTangentialPenaltyUpdates: u32,
        useIsotropicTangentialPenaltyOnStick: u32,
        rampTangentialPenaltyOnlyWhenNotSticking: u32,
        useReferenceTangentialUpdate: u32,
        stickExitThreshold: f32,
        tangentialPenaltyRampDeadzone: f32,
        tangentialPenaltySlipRampMaxDelta: f32,
        tangentialPenaltyCapScale: f32,
        useNormalContactMargin: u32,
        useLocalContactArms: u32,
        dt: f32,
        workgroupId: vec3u,
        localId: vec3u,
      ) -> void {
        let gid = workgroupId.x * ${WORKGROUP_SIZE}u + localId.x;
        let activeCount = min(min(pairActivity[${pairActiveContactsOffset}u], pairDispatchCount), ${maxActivePairContacts}u);
        if (gid >= activeCount) { return; }

        let p = pairActivity[${pairActiveContactsOffset}u + gid + 1u];
        if (p >= ${maxPairContacts}u) { return; }
        let prevContactStateSeed = loadContactStateHot(pairContacts, p, kStart);

        let n = loadContactNormalPen(pairContacts, p).xyz;
        if (dot(n, n) <= 1e-10) {
          storeContactRecord(
            pairContacts,
            p,
            vec4f(0.0),
            kStart,
            vec2f(kStart),
            0.0,
            vec2f(0.0),
            prevContactStateSeed.frictionScale,
            kStart,
          );
          return;
        }

        let contactMeta = loadContactMeta(pairContacts, p);
        let i = u32(contactMeta.x + 0.5);
        let j = u32(contactMeta.y + 0.5);
        if (i >= ${maxBodies}u || j >= ${maxBodies}u || i == j) {
          storeContactRecord(
            pairContacts,
            p,
            vec4f(0.0),
            kStart,
            vec2f(kStart),
            0.0,
            vec2f(0.0),
            prevContactStateSeed.frictionScale,
            kStart,
          );
          return;
        }

        let penetration0 = max(loadContactNormalPen(pairContacts, p).w, 0.0);
        let armA = loadContactArmA(pairContacts, p);
        let armB = loadContactArmB(pairContacts, p);
        let raStored = armA.xyz;
        let rbStored = armB.xyz;

        let solvePoseBaseA = i * ${INERTIAL_POSE_VEC4S_PER_BODY}u;
        let solvePoseBaseB = j * ${INERTIAL_POSE_VEC4S_PER_BODY}u;
        let posA = inertialPose[solvePoseBaseA + 2u].xyz;
        let posB = inertialPose[solvePoseBaseB + 2u].xyz;
        let qA = normalize(inertialPose[solvePoseBaseA + 3u]);
        let qB = normalize(inertialPose[solvePoseBaseB + 3u]);
        let poseBaseA = i * 2u;
        let poseBaseB = j * 2u;
        let prevPosA = initialPose[poseBaseA].xyz;
        let prevPosB = initialPose[poseBaseB].xyz;
        let prevQA = normalize(initialPose[poseBaseA + 1u]);
        let prevQB = normalize(initialPose[poseBaseB + 1u]);
        let localContactArms = useLocalContactArms > 0u;
        let ra = select(raStored, qrot(qA, raStored), localContactArms);
        let rb = select(rbStored, qrot(qB, rbStored), localContactArms);

        let dqAraw = qmul(qA, qconj(prevQA));
        let dqBraw = qmul(qB, qconj(prevQB));
        let dqA = select(dqAraw, -dqAraw, dqAraw.w < 0.0);
        let dqB = select(dqBraw, -dqBraw, dqBraw.w < 0.0);
        let dThetaA = 2.0 * dqA.xyz;
        let dThetaB = 2.0 * dqB.xyz;

        let dPosA = posA - prevPosA;
        let dPosB = posB - prevPosB;

        let jAL = -n;
        let jBL = n;
        let jAA = -cross(ra, n);
        let jBA = cross(rb, n);

        let tangentBasis = tangentBasisFromAngle(n, armA.w);
        let t1 = tangentBasis.t1;
        let t2 = tangentBasis.t2;

        let jt1AL = -t1;
        let jt1BL = t1;
        let jt1AA = -cross(ra, t1);
        let jt1BA = cross(rb, t1);

        let jt2AL = -t2;
        let jt2BL = t2;
        let jt2AA = -cross(ra, t2);
        let jt2BA = cross(rb, t2);

        let cachedConstraintC0 = loadContactConstraintC0(pairContacts, p);
        let c0 = cachedConstraintC0.x;
        let cRegN = (1.0 - regularizationAlpha) * c0
          + dot(jAL, dPosA)
          + dot(jAA, dThetaA)
          + dot(jBL, dPosB)
          + dot(jBA, dThetaB);
        let c0T1 = cachedConstraintC0.y;
        let c0T2 = cachedConstraintC0.z;
        let cRegT1 = (1.0 - regularizationAlpha) * c0T1
          + dot(jt1AL, dPosA)
          + dot(jt1AA, dThetaA)
          + dot(jt1BL, dPosB)
          + dot(jt1BA, dThetaB);
        let cRegT2 = (1.0 - regularizationAlpha) * c0T2
          + dot(jt2AL, dPosA)
          + dot(jt2AA, dThetaA)
          + dot(jt2BL, dPosB)
          + dot(jt2BA, dThetaB);
        let currentPointA = posA + ra;
        let currentPointB = posB + rb;
        let currentGap = -dot(currentPointA - currentPointB, n);
        let rawPenetration = -currentGap;
        let normalReleaseTolerance = max(2e-5, 1.25 * penetration0);
        let normalReleaseDecayNear = 0.85;
        let normalReleaseDecayFar = 0.6;
        let normalReleaseMinSupport = -5e-4;
        let normalSupportThreshold = 1e-6;
        let frictionSeparationTolerance = normalReleaseTolerance;
        let encodedMeta = bitcast<u32>(loadContactMeta(pairContacts, p).w);
        let featureKey = encodedMeta & 0x1FFu;
        let cooldown = (encodedMeta >> 9u) & 0x7Fu;
        let preserveWarmstart = (encodedMeta >> 16u) & 0x1u;
        let warmstartDebugReason = (encodedMeta >> 21u) & 0x7u;
        let prevStick = ((encodedMeta >> 17u) & 0x1u) != 0u;
        let stickAnchorReuse = (encodedMeta >> 18u) & 0x1u;

        let prevContactState = prevContactStateSeed;
        let prevDual = prevContactState.dual;
        let prevDualN = min(prevDual.x, 0.0);
        let prevDualTWorldRaw = prevDual.yzw;
        let prevDualTWorld = prevDualTWorldRaw - n * dot(prevDualTWorldRaw, n);
        let prevDualTB = select(
          vec2f(dot(prevDualTWorld, t1), dot(prevDualTWorld, t2)),
          prevDual.yz,
          useReferenceTangentialUpdate > 0u,
        );
        let prevPenalty = prevContactState.penalty;
        let prevPenaltyN = clamp(prevContactState.penaltyN, kStart, kMax);
        let prevPenaltyTBRaw = clamp(max(prevPenalty.yz, vec2f(kStart)), vec2f(kStart), vec2f(kMax));
        let prevPenaltyTB = prevPenaltyTBRaw;
        let frictionScale = prevContactState.frictionScale;
        let frictionStaticLocal = frictionStatic * frictionScale;
        let frictionDynamicLocal = frictionDynamic * frictionScale;
        var dualN = clamp(prevDualN + prevPenaltyN * cRegN, -lambdaMax, 0.0);
        // Diagnostic A/B: do not let the raw dual clamp drop all normal support
        // while the row is still geometrically penetrating.
        if (
          preventPenetratingNormalDropout > 0u
          && rawPenetration > 0.0
          && prevDualN < -normalSupportThreshold
          && dualN > -normalSupportThreshold
        ) {
          dualN = prevDualN;
        }
        if (
          enableNormalReleaseHeuristic > 0u &&
          penetration0 > 1e-6
          && prevDualN < -normalSupportThreshold
          && cRegN > 0.0
          && dualN > -normalSupportThreshold
        ) {
          let releaseDecay = select(normalReleaseDecayFar, normalReleaseDecayNear, cRegN <= normalReleaseTolerance);
          dualN = min(prevDualN * releaseDecay, normalReleaseMinSupport);
        }

        let prevTMag = length(prevDualTB);
        let staticBoundPrev = frictionStaticLocal * abs(prevDualN);
        let useStatic = prevTMag <= staticBoundPrev + 1e-6;
        let lambdaPlusTB = vec2f(
          prevDualTB.x + prevPenaltyTB.x * cRegT1,
          prevDualTB.y + prevPenaltyTB.y * cRegT2,
        );
        let frictionSupportN = max(prevDualN, dualN);
        let staticBound = frictionStaticLocal * max(-frictionSupportN, 0.0);
        let dynamicBound = frictionDynamicLocal * max(-frictionSupportN, 0.0);
        let lambdaPlusTBlen2 = dot(lambdaPlusTB, lambdaPlusTB);
        let noNormalSupportNow = dualN > -normalSupportThreshold;
        var penaltyN = prevPenaltyN;
        if (dualN < 0.0 && dualN > -lambdaMax) {
          penaltyN = clamp(prevPenaltyN + beta * abs(cRegN), kStart, kMax);
        }
        let tangentialError = length(vec2f(cRegT1, cRegT2));
        var penaltyTB = prevPenaltyTB;
        var dualTB = lambdaPlusTB;
        var stick = false;
        var tangentialInsideCone = false;
        var tangentialRampHappened = false;
        let freezeAllTangentialPenaltyUpdates = freezeTangentialPenaltyUpdates > 0u;
        if (useReferenceTangentialUpdate > 0u) {
          let referenceBound = frictionStaticLocal * max(-dualN, 0.0);
          let dualTBLen2 = dot(dualTB, dualTB);
          if (dualTBLen2 > referenceBound * referenceBound && dualTBLen2 > 1e-12) {
            dualTB *= referenceBound * inverseSqrt(dualTBLen2);
          }
          if (dualN >= 0.0 || referenceBound <= 1e-6) {
            dualTB = vec2f(0.0);
          }
          let tangentialClamped1 = abs(dualTB.x - lambdaPlusTB.x) > 1e-5;
          let tangentialClamped2 = abs(dualTB.y - lambdaPlusTB.y) > 1e-5;
          tangentialInsideCone = !tangentialClamped1 && !tangentialClamped2 && referenceBound > 1e-6;
          if (dualN < 0.0) {
            if (!freezeAllTangentialPenaltyUpdates) {
              let updatedPenaltyTB = min(
                prevPenaltyTB + beta * abs(vec2f(cRegT1, cRegT2)),
                vec2f(kMax),
              );
              penaltyTB = vec2f(
                select(updatedPenaltyTB.x, prevPenaltyTB.x, tangentialClamped1),
                select(updatedPenaltyTB.y, prevPenaltyTB.y, tangentialClamped2),
              );
              tangentialRampHappened = abs(penaltyTB.x - prevPenaltyTB.x) > 1e-6
                || abs(penaltyTB.y - prevPenaltyTB.y) > 1e-6;
            }
            stick = tangentialInsideCone && tangentialError < ${AVBD_STICK_THRESHOLD};
          } else {
            stick = false;
          }
        } else {
          var frictionBound = select(dynamicBound, staticBound, useStatic);
          if (useStatic && lambdaPlusTBlen2 > staticBound * staticBound + 1e-12) {
            frictionBound = dynamicBound;
          }
          frictionBound = max(frictionBound, 0.0);

          let dualTBLen2 = dot(dualTB, dualTB);
          if (dualTBLen2 > frictionBound * frictionBound && dualTBLen2 > 1e-12) {
            if (dualTBLen2 > frictionBound * frictionBound) {
              dualTB *= frictionBound * inverseSqrt(dualTBLen2);
            }
          }
          // If the normal row has no support (or contact is separating), drop
          // tangential memory so friction does not persist without contact.
          if (noNormalSupportNow || (enableNormalReleaseHeuristic > 0u && cRegN > frictionSeparationTolerance)) {
            dualTB = vec2f(0.0);
          }
          let stickThreshold = select(
            ${AVBD_STICK_THRESHOLD},
            max(stickExitThreshold, ${AVBD_STICK_THRESHOLD}),
            prevStick,
          );
          let insideStaticCone = staticBound > 1e-6
            && lambdaPlusTBlen2 <= staticBound * staticBound + 1e-12
            && !noNormalSupportNow;
          stick = insideStaticCone && tangentialError < stickThreshold;
          let freezeTangentialPenalty = freezeTangentialPenaltyOnStick > 0u && stick;
          let isInteriorCone = frictionBound > 1e-6
            && lambdaPlusTBlen2 < frictionBound * frictionBound - 1e-8;
          tangentialInsideCone = isInteriorCone;
          let tangentialRampActive = tangentialError > tangentialPenaltyRampDeadzone;
          let allowTangentialRamp = !freezeAllTangentialPenaltyUpdates
            && !freezeTangentialPenalty
            && (rampTangentialPenaltyOnlyWhenNotSticking == 0u || !stick);
          if (isInteriorCone && tangentialRampActive && allowTangentialRamp) {
            var tangentialRampT1 = beta * abs(cRegT1);
            var tangentialRampT2 = beta * abs(cRegT2);
            if (tangentialPenaltySlipRampMaxDelta > 0.0) {
              tangentialRampT1 = min(tangentialRampT1, tangentialPenaltySlipRampMaxDelta);
              tangentialRampT2 = min(tangentialRampT2, tangentialPenaltySlipRampMaxDelta);
            }
            penaltyTB.x = clamp(prevPenaltyTB.x + tangentialRampT1, kStart, kMax);
            penaltyTB.y = clamp(prevPenaltyTB.y + tangentialRampT2, kStart, kMax);
            tangentialRampHappened = true;
          }
          if (tangentialPenaltyCapScale > 0.0) {
            let tangentialPenaltyCap = max(penaltyN * tangentialPenaltyCapScale, kStart);
            penaltyTB = min(penaltyTB, vec2f(tangentialPenaltyCap));
          }
          if (useIsotropicTangentialPenaltyOnStick > 0u && stick) {
            let sharedPenaltyT = max(0.5 * (penaltyTB.x + penaltyTB.y), kStart);
            penaltyTB = vec2f(sharedPenaltyT);
          }
        }

        let storedDual = select(
          vec4f(dualN, t1 * dualTB.x + t2 * dualTB.y),
          vec4f(dualN, dualTB, 0.0),
          useReferenceTangentialUpdate > 0u,
        );
        let storedPenaltyTB = penaltyTB;
        let storedPenaltyN = penaltyN;
        // pairLambdas mirrors the live dual state in positive magnitudes for
        // debug/readback. It is derived state, not the
        // authoritative contact record.
        let pairLambdaTB = dualTB;
        let pairLambdaN = -dualN;
        storeContactRecord(
          pairContacts,
          p,
          storedDual,
          storedPenaltyN,
          storedPenaltyTB,
          pairLambdaN,
          pairLambdaTB,
          frictionScale,
          kStart,
        );

        let currentMeta = loadContactMeta(pairContacts, p);
        storeContactMeta(pairContacts, p, vec4f(
          currentMeta.x,
          currentMeta.y,
          currentMeta.z,
          bitcast<f32>(
          featureKey
          | (cooldown << 9u)
          | (preserveWarmstart << 16u)
          | (select(0u, 1u, stick) << 17u)
          | (stickAnchorReuse << 18u)
          | (select(0u, 1u, tangentialInsideCone) << 19u)
          | (select(0u, 1u, tangentialRampHappened) << 20u)
          | (warmstartDebugReason << 21u),
          ),
        ));
      }
    `, [qrot, qmul, qconj, tangentBasisHelpers, contactRecordHelpers, contactStateHelpers]);

    this.capturePairDualStateKernel = capturePairDualStateShader({
      inertialPose: storage(inertialPose, 'vec4f', maxBodies * INERTIAL_POSE_VEC4S_PER_BODY).toReadOnly(),
      initialPose: storage(initialPose, 'vec4f', maxBodies * 2).toReadOnly(),
      pairContacts: storage(pairContacts, 'vec4f', maxPairContacts * CONTACT_RECORD_VEC4S),
      pairActivity: storage(pairActivity, 'uint', pairActivityWordCount),
      pairDispatchCount: uniform(0),
      regularizationAlpha: uniform(AVBD_REGULARIZATION_ALPHA_DEFAULT),
      beta: uniform(AVBD_BETA),
      frictionStatic: uniform(AVBD_FRICTION_STATIC),
      frictionDynamic: uniform(AVBD_FRICTION_DYNAMIC),
      kStart: uniform(AVBD_K_START),
      kMax: uniform(10000000000.0),
      lambdaMax: uniform(10000000000.0),
      preventPenetratingNormalDropout: uniform(0),
      enableNormalReleaseHeuristic: uniform(0),
      freezeTangentialPenaltyOnStick: uniform(0),
      freezeTangentialPenaltyUpdates: uniform(0),
      useIsotropicTangentialPenaltyOnStick: uniform(0),
      rampTangentialPenaltyOnlyWhenNotSticking: uniform(0),
      useReferenceTangentialUpdate: uniform(1),
      stickExitThreshold: uniform(AVBD_STICK_THRESHOLD),
      tangentialPenaltyRampDeadzone: uniform(0.0),
      tangentialPenaltySlipRampMaxDelta: uniform(0.0),
      tangentialPenaltyCapScale: uniform(0.0),
      useNormalContactMargin: uniform(1),
      useLocalContactArms: uniform(1),
      dt: uniform(1 / 60 / 4),
      workgroupId,
      localId,
    }).computeKernel([WORKGROUP_SIZE, 1, 1]).setName('AVBD Capture Pair Dual');

    const captureJointDualStateShader = wgslFn(/* wgsl */`
      fn compute(
        inertialPose: ptr<storage, array<vec4f>, read>,
        jointRecords: ptr<storage, array<vec4f>, read_write>,
        jointCount: u32,
        regularizationAlpha: f32,
        beta: f32,
        betaAngular: f32,
        kStart: f32,
        lambdaMax: f32,
        workgroupId: vec3u,
        localId: vec3u,
      ) -> void {
        let gid = workgroupId.x * ${WORKGROUP_SIZE}u + localId.x;
        if (gid >= jointCount) { return; }

        let jointMetaWords = loadJointMetaWords(jointRecords, gid);
        if (jointMetaWords.w == 0u) { return; }

        let bodyA = jointMetaWords.x;
        let bodyB = jointMetaWords.y;
        let jointType = jointMetaWords.z;
        let anchorA = loadJointAnchorA(jointRecords, gid);
        let anchorB = loadJointAnchorB(jointRecords, gid);
        let torqueArm = max(anchorA.w, 1.0);
        var currentQA = vec4f(0.0, 0.0, 0.0, 1.0);
        var currentPosA = anchorA.xyz;
        if (bodyA != WORLD_BODY_INDEX) {
          let solvePoseBaseA = bodyA * ${INERTIAL_POSE_VEC4S_PER_BODY}u;
          currentQA = normalize(inertialPose[solvePoseBaseA + 3u]);
          currentPosA = inertialPose[solvePoseBaseA + 2u].xyz;
        }
        let solvePoseBaseB = bodyB * ${INERTIAL_POSE_VEC4S_PER_BODY}u;
        let currentQB = normalize(inertialPose[solvePoseBaseB + 3u]);
        let currentPosB = inertialPose[solvePoseBaseB + 2u].xyz;
        let worldAnchorA = jointWorldAnchor(bodyA, anchorA.xyz, currentPosA, currentQA);
        let worldAnchorB = currentPosB + qrot(currentQB, anchorB.xyz);

        let stiffness = loadJointStiffness(jointRecords, gid);
        let maxPenaltyLin = vec3f(min(max(stiffness.x, kStart), ${AVBD_JOINT_PENALTY_MAX}));
        let maxPenaltyAng = vec3f(min(max(stiffness.y, 0.0), ${AVBD_JOINT_PENALTY_MAX}));

        let prevLambdaLin = loadJointLambdaLin(jointRecords, gid).xyz;
        let prevLambdaAng = loadJointLambdaAng(jointRecords, gid).xyz;
        let prevPenaltyLin = max(loadJointPenaltyLin(jointRecords, gid).xyz, vec3f(kStart));
        let c0Lin = loadJointC0Lin(jointRecords, gid).xyz;
        let c0Ang = loadJointC0Ang(jointRecords, gid).xyz;

        let rigidLinear = !isFiniteF32(stiffness.x);
        let angularEnabled = jointType == JOINT_TYPE_FIXED && stiffness.y > 0.0;
        let rigidAngular = angularEnabled && !isFiniteF32(stiffness.y);
        let minPenaltyAng = select(vec3f(0.0), vec3f(kStart), angularEnabled);
        let prevPenaltyAng = max(loadJointPenaltyAng(jointRecords, gid).xyz, minPenaltyAng);
        let linearConstraint = (worldAnchorA - worldAnchorB) - select(vec3f(0.0), c0Lin * regularizationAlpha, rigidLinear);
        let penaltyLin = min(prevPenaltyLin + beta * abs(linearConstraint), maxPenaltyLin);
        let lambdaLin = clamp(prevLambdaLin + prevPenaltyLin * linearConstraint, vec3f(-lambdaMax), vec3f(lambdaMax));
        storeJointLambdaLin(
          jointRecords,
          gid,
          vec4f(select(prevLambdaLin, lambdaLin, rigidLinear), 0.0),
        );
        storeJointPenaltyLin(jointRecords, gid, vec4f(penaltyLin, 0.0));

        if (angularEnabled) {
          let angularConstraint = jointFixedAngularConstraint(bodyA, currentQA, currentQB, torqueArm) - select(vec3f(0.0), c0Ang * regularizationAlpha, rigidAngular);
          let lambdaAng = clamp(prevLambdaAng + prevPenaltyAng * angularConstraint, vec3f(-lambdaMax), vec3f(lambdaMax));
          let penaltyAng = min(prevPenaltyAng + betaAngular * abs(angularConstraint), maxPenaltyAng);
          storeJointLambdaAng(
            jointRecords,
            gid,
            vec4f(select(prevLambdaAng, lambdaAng, rigidAngular), 0.0),
          );
          storeJointPenaltyAng(jointRecords, gid, vec4f(penaltyAng, 0.0));
        } else {
          storeJointLambdaAng(jointRecords, gid, vec4f(0.0));
          storeJointPenaltyAng(jointRecords, gid, vec4f(0.0));
        }
      }
    `, [qrot, qmul, qconj, jointRecordHelpers, jointConstraintHelpers]);

    this.captureJointDualStateKernel = captureJointDualStateShader({
      inertialPose: storage(inertialPose, 'vec4f', maxBodies * INERTIAL_POSE_VEC4S_PER_BODY).toReadOnly(),
      jointRecords: storage(jointRecords, 'vec4f', maxJoints * JOINT_RECORD_VEC4S),
      jointCount: uniform(0),
      regularizationAlpha: uniform(AVBD_REGULARIZATION_ALPHA_DEFAULT),
      beta: uniform(AVBD_BETA),
      betaAngular: uniform(100.0),
      kStart: uniform(AVBD_K_START),
      lambdaMax: uniform(10000000000.0),
      workgroupId,
      localId,
    }).computeKernel([WORKGROUP_SIZE, 1, 1]).setName('AVBD Capture Joint Dual');
    assertStorageBufferBudget('AVBD Capture Joint Dual', 3);

    const finalizeVelocitiesShader = wgslFn(/* wgsl */`
      fn compute(
        inertialPose: ptr<storage, array<vec4f>, read>,
        initialPose: ptr<storage, array<vec4f>, read>,
        positions: ptr<storage, array<vec4f>, read_write>,
        quaternions: ptr<storage, array<vec4f>, read_write>,
        velocities: ptr<storage, array<vec4f>, read_write>,
        prevLinearVelocities: ptr<storage, array<vec4f>, read_write>,
        angularVelocities: ptr<storage, array<vec4f>, read_write>,
        dt: f32,
        bodyCount: u32,
        workgroupId: vec3u,
        localId: vec3u,
      ) -> void {
        let gid = workgroupId.x * ${WORKGROUP_SIZE}u + localId.x;
        if (gid >= bodyCount) { return; }

        let solvePoseBase = gid * ${INERTIAL_POSE_VEC4S_PER_BODY}u;
        let currentPose = inertialPose[solvePoseBase + 2u];
        let currentQ = normalize(inertialPose[solvePoseBase + 3u]);
        positions[gid] = currentPose;
        quaternions[gid] = currentQ;

        if (currentPose.w == 0.0) {
          // Keep CPU-authored kinematic velocities (hand colliders) intact so
          // the integrator can sweep them across the remaining substeps.
          return;
        }

        // Preserve the pre-finalize linear velocity for adaptive warmstarting.
        prevLinearVelocities[gid] = velocities[gid];

        let dtSafe = max(dt, 1e-6);
        let poseBase = gid * 2u;
        let prevPos = initialPose[poseBase].xyz;
        var v = (currentPose.xyz - prevPos) / dtSafe;

        let prevQ = normalize(initialPose[poseBase + 1u]);
        let dqRaw = qmul(currentQ, qconj(prevQ));
        let dq = select(dqRaw, -dqRaw, dqRaw.w < 0.0);
        let w = 2.0 * dq.xyz / dtSafe;

        velocities[gid] = vec4f(v, 0.0);
        angularVelocities[gid] = vec4f(w, 0.0);
      }
    `, [qmul, qconj]);

    this.finalizeVelocitiesKernel = finalizeVelocitiesShader({
      inertialPose: storage(inertialPose, 'vec4f', maxBodies * INERTIAL_POSE_VEC4S_PER_BODY).toReadOnly(),
      initialPose: storage(initialPose, 'vec4f', maxBodies * 2).toReadOnly(),
      positions: storage(positions, 'vec4f', maxBodies),
      quaternions: storage(quaternions, 'vec4f', maxBodies),
      velocities: storage(velocities, 'vec4f', maxBodies),
      prevLinearVelocities: storage(prevLinearVelocities, 'vec4f', maxBodies),
      angularVelocities: storage(angularVelocities, 'vec4f', maxBodies),
      dt: uniform(1 / 60 / 4),
      bodyCount: uniform(0),
      workgroupId,
      localId,
    }).computeKernel([WORKGROUP_SIZE, 1, 1]).setName('AVBD Finalize Velocities');
  }

  /** Indirect dispatch args, or a capacity-bounded direct dispatch when indirect is disabled. */
  private contactDispatch(boundedDispatch: number): IndirectStorageBufferAttribute | [number, number, number] {
    if (!INDIRECT_DISPATCH_DISABLED) return this.contactDispatchIndirectAttr;
    return [Math.ceil(boundedDispatch / WORKGROUP_SIZE), 1, 1];
  }

  prepare(
    renderer: any,
    bodyCount: number,
    pairDispatchCount: number,
    jointCount: number,
    springCount: number,
    bodyColorCount: number,
    lambdaWarmstartScale: number,
    dt: number,
    bodySolveMode: AvbdBodySolveMode = 'colored',
  ): void {
    const boundedDispatch = Math.min(pairDispatchCount, this.maxActivePairContacts);
    const warmstartScale = Math.max(0.0, Math.min(1.0, lambdaWarmstartScale));

    if (boundedDispatch > 0) {
      this.buildContactDispatchArgsKernel.computeNode.parameters.pairDispatchCount.value = boundedDispatch;
      this.prepareStateKernel.computeNode.parameters.pairDispatchCount.value = boundedDispatch;
      this.prepareStateKernel.computeNode.parameters.lambdaWarmstartScale.value = warmstartScale;
      renderer.compute(this.buildContactDispatchArgsKernel, [1, 1, 1]);
      renderer.compute(this.prepareStateKernel, this.contactDispatch(boundedDispatch));
    }

    if (jointCount > 0) {
      this.prepareJointStateKernel.computeNode.parameters.jointCount.value = jointCount;
      this.prepareJointStateKernel.computeNode.parameters.lambdaWarmstartScale.value = warmstartScale;
      this.prepareJointStateKernel.computeNode.parameters.dt.value = dt;
      renderer.compute(this.prepareJointStateKernel, [Math.ceil(jointCount / WORKGROUP_SIZE), 1, 1]);
    }

    if (bodyCount <= 0) {
      return;
    }

    const bodyWorkgroups = Math.ceil(bodyCount / WORKGROUP_SIZE);
    this.buildSolverConstraintListsKernel.computeNode.parameters.bodyCount.value = bodyCount;
    renderer.compute(this.buildSolverConstraintListsKernel, [bodyWorkgroups, 1, 1]);
    if (jointCount > 0) {
      this.appendJointConstraintRefsKernel.computeNode.parameters.jointCount.value = jointCount;
      renderer.compute(this.appendJointConstraintRefsKernel, [Math.ceil(jointCount / WORKGROUP_SIZE), 1, 1]);
    }
    if (springCount > 0) {
      this.appendSpringConstraintRefsKernel.computeNode.parameters.springCount.value = springCount;
      renderer.compute(this.appendSpringConstraintRefsKernel, [Math.ceil(springCount / WORKGROUP_SIZE), 1, 1]);
    }

    if (bodySolveMode === 'serial') {
      return;
    }

    const clampedColors = Math.max(1, Math.min(32, Math.floor(bodyColorCount)));
    this.greedyBodyColorsKernel.computeNode.parameters.bodyCount.value = bodyCount;
    this.greedyBodyColorsKernel.computeNode.parameters.colorCount.value = clampedColors;
    renderer.compute(this.greedyBodyColorsKernel, [bodyWorkgroups, 1, 1]);

    const hardConstraintCount = Math.max(jointCount, springCount);
    if (hardConstraintCount > 0) {
      this.markHardColorConflictsKernel.computeNode.parameters.bodyCount.value = bodyCount;
      this.markHardColorConflictsKernel.computeNode.parameters.jointCount.value = jointCount;
      this.markHardColorConflictsKernel.computeNode.parameters.springCount.value = springCount;
      this.repairHardBodyColorsKernel.computeNode.parameters.bodyCount.value = bodyCount;
      this.repairHardBodyColorsKernel.computeNode.parameters.colorCount.value = clampedColors;
      const hardConstraintWorkgroups = Math.ceil(hardConstraintCount / WORKGROUP_SIZE);
      for (let round = 0; round < BODY_COLOR_HARD_REPAIR_ROUNDS; round++) {
        renderer.compute(this.markHardColorConflictsKernel, [hardConstraintWorkgroups, 1, 1]);
        renderer.compute(this.repairHardBodyColorsKernel, [bodyWorkgroups, 1, 1]);
      }
    }
  }

  primalSolveBodies(
    renderer: any,
    bodyCount: number,
    sweepCount: number,
    bodyColorCount: number,
    regularizationAlpha: number,
    dt: number,
    frictionSolveScale = 1.0,
    tangentialRegularizationAlpha = regularizationAlpha,
    solveTuning?: PrimalSolveTuning,
    sweepStartOffset = 0,
    colorStart = 0,
    colorCountOverride?: number,
    bodySolveMode: AvbdBodySolveMode = 'colored',
  ): void {
    if (bodyCount <= 0 || sweepCount <= 0 || bodyColorCount <= 0) return;

    const bodyWorkgroups = Math.ceil(bodyCount / WORKGROUP_SIZE);
    const bodySolveModeValue = bodySolveMode === 'serial' ? 1 : 0;
    const solveParams = this.primalBodySolveKernel.computeNode.parameters;
    const commitParams = this.commitBodySolveKernel.computeNode.parameters;
    solveParams.bodyCount.value = bodyCount;
    solveParams.bodyIndexBase.value = 0;
    solveParams.dispatchBodyCount.value = bodyCount;
    solveParams.bodySolveMode.value = bodySolveModeValue;
    solveParams.regularizationAlpha.value = regularizationAlpha;
    solveParams.tangentialRegularizationAlpha.value = tangentialRegularizationAlpha;
    solveParams.dt.value = dt;
    solveParams.frictionSolveScale.value = frictionSolveScale;
    solveParams.relaxation.value = Math.max(0.0, solveTuning?.relaxation ?? 1.0);
    solveParams.frictionRelaxation.value = Math.max(0.0, solveTuning?.frictionRelaxation ?? 1.0);
    solveParams.inertialDiagWeight.value = Math.max(0.0, solveTuning?.inertialDiagWeight ?? 1.0);
    solveParams.maxLinearCorrection.value = Math.max(0.0, solveTuning?.maxLinearCorrection ?? 0.25);
    solveParams.maxAngularCorrection.value = Math.max(0.0, solveTuning?.maxAngularCorrection ?? 0.35);
    commitParams.bodyCount.value = bodyCount;
    commitParams.bodyIndexBase.value = 0;
    commitParams.dispatchBodyCount.value = bodyCount;
    commitParams.bodySolveMode.value = bodySolveModeValue;
    const clampedColors = Math.max(1, Math.min(32, Math.floor(bodyColorCount)));
    const clampedColorStart = Math.max(0, Math.min(clampedColors - 1, Math.floor(colorStart)));
    const requestedColorCount = colorCountOverride === undefined
      ? clampedColors - clampedColorStart
      : Math.max(0, Math.floor(colorCountOverride));
    const colorEnd = Math.min(clampedColors, clampedColorStart + requestedColorCount);
    if (colorEnd <= clampedColorStart) return;

    const sweepPasses = Math.max(1, Math.floor(sweepCount));
    if (bodySolveMode === 'serial') {
      solveParams.currentColor.value = 0;
      commitParams.currentColor.value = 0;
      for (let sweep = 0; sweep < sweepPasses; sweep++) {
        solveParams.sweepOffset.value = sweepStartOffset + sweep;
        for (let bodyIndex = 0; bodyIndex < bodyCount; bodyIndex++) {
          solveParams.bodyIndexBase.value = bodyIndex;
          solveParams.dispatchBodyCount.value = 1;
          commitParams.bodyIndexBase.value = bodyIndex;
          commitParams.dispatchBodyCount.value = 1;
          renderer.compute(this.primalBodySolveKernel, [1, 1, 1]);
          renderer.compute(this.commitBodySolveKernel, [1, 1, 1]);
        }
      }
      return;
    }

    for (let sweep = 0; sweep < sweepPasses; sweep++) {
      solveParams.sweepOffset.value = sweepStartOffset + sweep;
      for (let color = clampedColorStart; color < colorEnd; color++) {
        solveParams.currentColor.value = color;
        commitParams.currentColor.value = color;
        renderer.compute(this.primalBodySolveKernel, [bodyWorkgroups, 1, 1]);
        renderer.compute(this.commitBodySolveKernel, [bodyWorkgroups, 1, 1]);
      }
    }
  }

  usesDerivedInertiaInPrimalSolve(): boolean {
    return !this.useLocalDiagonalPrimalSolveFastPath;
  }

  captureFromSolve(
    renderer: any,
    pairDispatchCount: number,
    jointCount: number,
    dt: number,
    regularizationAlpha: number,
    captureIterationIndex = -1,
  ): void {
    const boundedDispatch = Math.min(pairDispatchCount, this.maxActivePairContacts);

    if (boundedDispatch > 0) {
      this.capturePairDualStateKernel.computeNode.parameters.pairDispatchCount.value = boundedDispatch;
      this.capturePairDualStateKernel.computeNode.parameters.regularizationAlpha.value = regularizationAlpha;
      this.capturePairDualStateKernel.computeNode.parameters.dt.value = dt;
      renderer.compute(this.capturePairDualStateKernel, this.contactDispatch(boundedDispatch));
    }

    if (jointCount > 0) {
      this.captureJointDualStateKernel.computeNode.parameters.jointCount.value = jointCount;
      this.captureJointDualStateKernel.computeNode.parameters.regularizationAlpha.value = regularizationAlpha;
      renderer.compute(this.captureJointDualStateKernel, [Math.ceil(jointCount / WORKGROUP_SIZE), 1, 1]);
    }
  }

  finalizeVelocities(renderer: any, bodyCount: number, dt: number): void {
    if (bodyCount <= 0) return;
    this.finalizeVelocitiesKernel.computeNode.parameters.bodyCount.value = bodyCount;
    this.finalizeVelocitiesKernel.computeNode.parameters.dt.value = dt;
    const workgroups = Math.ceil(bodyCount / WORKGROUP_SIZE);
    renderer.compute(this.finalizeVelocitiesKernel, [workgroups, 1, 1]);
  }

  clearPhaseDebugCounters(renderer: any): void {
    if (!this.debugEnabled) return;
    renderer.compute(this.clearPhaseDebugCountersKernel, [1, 1, 1]);
  }

  capturePhaseDebug(
    renderer: any,
    pairDispatchCount: number,
    regularizationAlpha: number,
    phaseOffset: 0 | 9,
    frictionSolveScale = 1.0,
    tangentialRegularizationAlpha = regularizationAlpha,
  ): void {
    if (!this.debugEnabled) return;
    const boundedDispatch = Math.min(pairDispatchCount, this.maxActivePairContacts);
    if (boundedDispatch <= 0) return;
    this.accumulatePhaseDebugCountersKernel.computeNode.parameters.pairDispatchCount.value = boundedDispatch;
    this.accumulatePhaseDebugCountersKernel.computeNode.parameters.regularizationAlpha.value = regularizationAlpha;
    this.accumulatePhaseDebugCountersKernel.computeNode.parameters.tangentialRegularizationAlpha.value = tangentialRegularizationAlpha;
    this.accumulatePhaseDebugCountersKernel.computeNode.parameters.phaseOffset.value = phaseOffset;
    this.accumulatePhaseDebugCountersKernel.computeNode.parameters.frictionSolveScale.value = frictionSolveScale;
    renderer.compute(this.accumulatePhaseDebugCountersKernel, this.contactDispatch(boundedDispatch));
  }

  setDebugEnabled(enabled: boolean): void {
    this.debugEnabled = enabled;
    this.debugReadbackInFlight = false;
    this.separatingTraceReadbackInFlight = false;
    this.separatingTraceArmed = true;
    this.lastDebugLogFrame = -1;
  }

  setDebugLogInterval(intervalFrames: number): void {
    this.debugEveryNFrames = Math.max(1, Math.floor(intervalFrames));
    this.lastDebugLogFrame = -1;
  }

  setFriction(staticFriction: number, dynamicFriction = staticFriction): void {
    const staticClamped = Math.max(0.0, staticFriction);
    const dynamicClamped = Math.max(0.0, dynamicFriction);

    this.primalBodySolveKernel.computeNode.parameters.frictionStatic.value = staticClamped;
    this.primalBodySolveKernel.computeNode.parameters.frictionDynamic.value = dynamicClamped;

    this.prepareStateKernel.computeNode.parameters.frictionStatic.value = staticClamped;

    this.capturePairDualStateKernel.computeNode.parameters.frictionStatic.value = staticClamped;
    this.capturePairDualStateKernel.computeNode.parameters.frictionDynamic.value = dynamicClamped;

    this.accumulatePhaseDebugCountersKernel.computeNode.parameters.frictionStatic.value = staticClamped;
    this.accumulatePhaseDebugCountersKernel.computeNode.parameters.frictionDynamic.value = dynamicClamped;

    this.accumulateDebugCountersKernel.computeNode.parameters.frictionStatic.value = staticClamped;
    this.accumulateDebugCountersKernel.computeNode.parameters.frictionDynamic.value = dynamicClamped;
  }

  setDualUpdateBeta(beta: number): void {
    const clamped = Math.max(0.0, beta);
    this.capturePairDualStateKernel.computeNode.parameters.beta.value = clamped;
    this.captureJointDualStateKernel.computeNode.parameters.beta.value = clamped;
    this.captureJointDualStateKernel.computeNode.parameters.betaAngular.value = Math.min(clamped, 100.0);
  }

  setPreventPenetratingNormalDropout(enabled: boolean): void {
    this.capturePairDualStateKernel.computeNode.parameters.preventPenetratingNormalDropout.value = enabled ? 1 : 0;
  }

  setFreezeTangentialPenaltyUpdates(enabled: boolean): void {
    this.capturePairDualStateKernel.computeNode.parameters.freezeTangentialPenaltyUpdates.value = enabled ? 1 : 0;
  }

  setPenaltyDecayGamma(gamma: number): void {
    const clamped = Math.max(0.0, Math.min(1.0, gamma));
    this.prepareStateKernel.computeNode.parameters.gamma.value = clamped;
    this.prepareJointStateKernel.computeNode.parameters.gamma.value = clamped;
  }

  setPenaltyFloor(kStart: number): void {
    const clamped = Math.max(1e-6, kStart);
    this.accumulatePhaseDebugCountersKernel.computeNode.parameters.kStart.value = clamped;
    this.accumulateDebugCountersKernel.computeNode.parameters.kStart.value = clamped;
    this.prepareStateKernel.computeNode.parameters.kStart.value = clamped;
    this.prepareJointStateKernel.computeNode.parameters.kStart.value = clamped;
    this.primalBodySolveKernel.computeNode.parameters.kStart.value = clamped;
    this.capturePairDualStateKernel.computeNode.parameters.kStart.value = clamped;
    this.captureJointDualStateKernel.computeNode.parameters.kStart.value = clamped;
  }

  private traceSeparatingContacts(
    renderer: any,
    frameId: number,
    mainSeparating: number,
    mainBounded: number,
  ): void {
    if (this.separatingTraceReadbackInFlight) return;
    if (!renderer || typeof renderer.getArrayBufferAsync !== 'function') return;

    this.separatingTraceReadbackInFlight = true;
    const regularizationAlpha = AVBD_REGULARIZATION_ALPHA_DEFAULT;
    const normalContactMargin = AVBD_COLLISION_MARGIN;
    const suspiciousGapThreshold = 2.0 * normalContactMargin + 1e-6;
    const keySlotMask = this.contactKeySlotBitCount > 0 ? ((1 << this.contactKeySlotBitCount) - 1) : 0;

    Promise.all([
      renderer.getArrayBufferAsync(this.pairActivityAttr),
      renderer.getArrayBufferAsync(this.pairContactsAttr),
      renderer.getArrayBufferAsync(this.initialPoseAttr),
      renderer.getArrayBufferAsync(this.quaternionsAttr),
      renderer.getArrayBufferAsync(this.positionsAttr),
    ]).then(([
      activityRaw,
      pairContactsRaw,
      initialPoseRaw,
      quaternionsRaw,
      positionsRaw,
    ]: ArrayBuffer[]) => {
      const activity = new Uint32Array(activityRaw);
      const pairContacts = new Float32Array(pairContactsRaw);
      const pairContactWords = new Uint32Array(pairContactsRaw);
      const initialPose = new Float32Array(initialPoseRaw);
      const quaternions = new Float32Array(quaternionsRaw);
      const positions = new Float32Array(positionsRaw);
      const contactMetaBase = (p: number): number => contactRecordVec4FloatIndex(p, CONTACT_RECORD_META_OFFSET);
      const contactNormalPenBase = (p: number): number =>
        contactRecordVec4FloatIndex(p, CONTACT_RECORD_NORMAL_PEN_OFFSET);
      const contactArmABase = (p: number): number => contactRecordVec4FloatIndex(p, CONTACT_RECORD_ARM_A_OFFSET);
      const contactArmBBase = (p: number): number => contactRecordVec4FloatIndex(p, CONTACT_RECORD_ARM_B_OFFSET);
      const contactConstraintC0Base = (p: number): number =>
        contactRecordVec4FloatIndex(p, CONTACT_RECORD_CONSTRAINT_C0_OFFSET);
      const contactDualBase = (p: number): number => contactRecordVec4FloatIndex(p, CONTACT_RECORD_DUAL_OFFSET);
      const contactPenaltyBase = (p: number): number => contactRecordVec4FloatIndex(p, CONTACT_RECORD_PENALTY_OFFSET);

      const dot3 = (ax: number, ay: number, az: number, bx: number, by: number, bz: number): number =>
        ax * bx + ay * by + az * bz;
      const cross3 = (
        ax: number, ay: number, az: number,
        bx: number, by: number, bz: number,
      ): [number, number, number] => [
        ay * bz - az * by,
        az * bx - ax * bz,
        ax * by - ay * bx,
      ];
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
      const buildCanonicalTangentBasis = (
        nx: number, ny: number, nz: number,
      ): { t1: [number, number, number]; t2: [number, number, number] } => {
        const refAxis = Math.abs(ny) > 0.999
          ? ([1.0, 0.0, 0.0] as const)
          : ([0.0, 1.0, 0.0] as const);
        const [t1RawX, t1RawY, t1RawZ] = cross3(refAxis[0], refAxis[1], refAxis[2], nx, ny, nz);
        const t1Len2 = dot3(t1RawX, t1RawY, t1RawZ, t1RawX, t1RawY, t1RawZ);
        const t1: [number, number, number] = t1Len2 > 1e-12
          ? [t1RawX / Math.sqrt(t1Len2), t1RawY / Math.sqrt(t1Len2), t1RawZ / Math.sqrt(t1Len2)]
          : [0.0, 0.0, 1.0];
        const [t2RawX, t2RawY, t2RawZ] = cross3(nx, ny, nz, t1[0], t1[1], t1[2]);
        const t2Len2 = dot3(t2RawX, t2RawY, t2RawZ, t2RawX, t2RawY, t2RawZ);
        const t2: [number, number, number] = t2Len2 > 1e-12
          ? [t2RawX / Math.sqrt(t2Len2), t2RawY / Math.sqrt(t2Len2), t2RawZ / Math.sqrt(t2Len2)]
          : [1.0, 0.0, 0.0];
        return { t1, t2 };
      };
      const buildTangentBasisFromPreferredT1 = (
        nx: number, ny: number, nz: number,
        preferredT1X: number, preferredT1Y: number, preferredT1Z: number,
      ): { t1: [number, number, number]; t2: [number, number, number] } => {
        const dotPreferred = preferredT1X * nx + preferredT1Y * ny + preferredT1Z * nz;
        const projectedX = preferredT1X - nx * dotPreferred;
        const projectedY = preferredT1Y - ny * dotPreferred;
        const projectedZ = preferredT1Z - nz * dotPreferred;
        const projectedLen2 = dot3(projectedX, projectedY, projectedZ, projectedX, projectedY, projectedZ);
        if (projectedLen2 <= 1e-12) {
          return buildCanonicalTangentBasis(nx, ny, nz);
        }
        const invProjectedLen = 1.0 / Math.sqrt(projectedLen2);
        const t1: [number, number, number] = [
          projectedX * invProjectedLen,
          projectedY * invProjectedLen,
          projectedZ * invProjectedLen,
        ];
        const [t2RawX, t2RawY, t2RawZ] = cross3(nx, ny, nz, t1[0], t1[1], t1[2]);
        const t2Len2 = dot3(t2RawX, t2RawY, t2RawZ, t2RawX, t2RawY, t2RawZ);
        if (t2Len2 <= 1e-12) {
          return buildCanonicalTangentBasis(nx, ny, nz);
        }
        const invT2Len = 1.0 / Math.sqrt(t2Len2);
        return {
          t1,
          t2: [t2RawX * invT2Len, t2RawY * invT2Len, t2RawZ * invT2Len],
        };
      };
      const buildTangentBasisFromAngle = (
        nx: number, ny: number, nz: number,
        theta: number,
      ): { t1: [number, number, number]; t2: [number, number, number] } => {
        const canonical = buildCanonicalTangentBasis(nx, ny, nz);
        const c = Math.cos(theta);
        const s = Math.sin(theta);
        const preferredT1X = canonical.t1[0] * c + canonical.t2[0] * s;
        const preferredT1Y = canonical.t1[1] * c + canonical.t2[1] * s;
        const preferredT1Z = canonical.t1[2] * c + canonical.t2[2] * s;
        return buildTangentBasisFromPreferredT1(nx, ny, nz, preferredT1X, preferredT1Y, preferredT1Z);
      };
      const formatWarmstartReason = (reason: number): string => {
        switch (reason) {
          case 1: return 'ex';
          case 2: return 'pr';
          case 3: return 'ng';
          case 4: return 'in';
          case 5: return 'rp';
          case 6: return 'mx';
          default: return '--';
        }
      };

      const activeContacts = activity.subarray(
        this.pairActiveContactsOffset,
        this.pairActiveContactsOffset + this.maxActivePairContacts + 1,
      );
      const activeListCount = Math.min(activeContacts[0] ?? 0, this.maxActivePairContacts);
      const offenders: Array<{
        p: number;
        i: number;
        j: number;
        keyBase: number;
        keySlot: number;
        featureKey: number;
        warmstartReason: number;
        preserveWarmstart: boolean;
        stick: boolean;
        reuse: boolean;
        penetration: number;
        rawPenetration: number;
        currentGap: number;
        c0: number;
        cRegN: number;
        dualN: number;
        penaltyN: number;
        clampedSeparated: boolean;
        reusedSeparated: boolean;
      }> = [];

      for (let k = 0; k < activeListCount; k++) {
        const p = activeContacts[k + 1] ?? this.maxPairContacts;
        if (p >= this.maxPairContacts) continue;

        const metaBase = contactMetaBase(p);
        if ((pairContacts[metaBase + 2] ?? 0.0) < 0.5) continue;

        const i = Math.round(pairContacts[metaBase] ?? -1);
        const j = Math.round(pairContacts[metaBase + 1] ?? -1);
        if (i < 0 || j < 0 || i === j) continue;

        const nBase = contactNormalPenBase(p);
        const nx = pairContacts[nBase] ?? 0.0;
        const ny = pairContacts[nBase + 1] ?? 0.0;
        const nz = pairContacts[nBase + 2] ?? 0.0;
        const penetration = pairContacts[nBase + 3] ?? 0.0;
        if (dot3(nx, ny, nz, nx, ny, nz) <= 1e-12) continue;

        const iBase = i * 4;
        const jBase = j * 4;
        const iPosX = positions[iBase] ?? 0.0;
        const iPosY = positions[iBase + 1] ?? 0.0;
        const iPosZ = positions[iBase + 2] ?? 0.0;
        const jPosX = positions[jBase] ?? 0.0;
        const jPosY = positions[jBase + 1] ?? 0.0;
        const jPosZ = positions[jBase + 2] ?? 0.0;
        const iInitBase = i * 8;
        const jInitBase = j * 8;
        const dPosIX = iPosX - (initialPose[iInitBase] ?? iPosX);
        const dPosIY = iPosY - (initialPose[iInitBase + 1] ?? iPosY);
        const dPosIZ = iPosZ - (initialPose[iInitBase + 2] ?? iPosZ);
        const dPosJX = jPosX - (initialPose[jInitBase] ?? jPosX);
        const dPosJY = jPosY - (initialPose[jInitBase + 1] ?? jPosY);
        const dPosJZ = jPosZ - (initialPose[jInitBase + 2] ?? jPosZ);

        const iQuatBase = i * 4;
        const jQuatBase = j * 4;
        const [currQIX, currQIY, currQIZ, currQIW] = normalizeQuat(
          quaternions[iQuatBase] ?? 0.0,
          quaternions[iQuatBase + 1] ?? 0.0,
          quaternions[iQuatBase + 2] ?? 0.0,
          quaternions[iQuatBase + 3] ?? 1.0,
        );
        const [currQJX, currQJY, currQJZ, currQJW] = normalizeQuat(
          quaternions[jQuatBase] ?? 0.0,
          quaternions[jQuatBase + 1] ?? 0.0,
          quaternions[jQuatBase + 2] ?? 0.0,
          quaternions[jQuatBase + 3] ?? 1.0,
        );
        const [initQIX, initQIY, initQIZ, initQIW] = normalizeQuat(
          initialPose[iInitBase + 4] ?? 0.0,
          initialPose[iInitBase + 5] ?? 0.0,
          initialPose[iInitBase + 6] ?? 0.0,
          initialPose[iInitBase + 7] ?? 1.0,
        );
        const [initQJX, initQJY, initQJZ, initQJW] = normalizeQuat(
          initialPose[jInitBase + 4] ?? 0.0,
          initialPose[jInitBase + 5] ?? 0.0,
          initialPose[jInitBase + 6] ?? 0.0,
          initialPose[jInitBase + 7] ?? 1.0,
        );

        const armABase = contactArmABase(p);
        const armBBase = contactArmBBase(p);
        const raStoredX = pairContacts[armABase] ?? 0.0;
        const raStoredY = pairContacts[armABase + 1] ?? 0.0;
        const raStoredZ = pairContacts[armABase + 2] ?? 0.0;
        const tangentAngle = pairContacts[armABase + 3] ?? 0.0;
        const rbStoredX = pairContacts[armBBase] ?? 0.0;
        const rbStoredY = pairContacts[armBBase + 1] ?? 0.0;
        const rbStoredZ = pairContacts[armBBase + 2] ?? 0.0;
        const [raX, raY, raZ] = rotateVecByQuat(currQIX, currQIY, currQIZ, currQIW, raStoredX, raStoredY, raStoredZ);
        const [rbX, rbY, rbZ] = rotateVecByQuat(currQJX, currQJY, currQJZ, currQJW, rbStoredX, rbStoredY, rbStoredZ);
        const [prevRaX, prevRaY, prevRaZ] = rotateVecByQuat(initQIX, initQIY, initQIZ, initQIW, raStoredX, raStoredY, raStoredZ);
        const [prevRbX, prevRbY, prevRbZ] = rotateVecByQuat(initQJX, initQJY, initQJZ, initQJW, rbStoredX, rbStoredY, rbStoredZ);

        const [crossRaN_X, crossRaN_Y, crossRaN_Z] = cross3(raX, raY, raZ, nx, ny, nz);
        const [crossRbN_X, crossRbN_Y, crossRbN_Z] = cross3(rbX, rbY, rbZ, nx, ny, nz);
        const tangentBasis = buildTangentBasisFromAngle(nx, ny, nz, tangentAngle);
        const [t1X, t1Y, t1Z] = tangentBasis.t1;
        const [t2X, t2Y, t2Z] = tangentBasis.t2;
        const dqArawX = currQIW * -initQIX + currQIX * initQIW + currQIY * -initQIZ - currQIZ * -initQIY;
        const dqArawY = currQIW * -initQIY - currQIX * -initQIZ + currQIY * initQIW + currQIZ * -initQIX;
        const dqArawZ = currQIW * -initQIZ + currQIX * -initQIY - currQIY * -initQIX + currQIZ * initQIW;
        const dqArawW = currQIW * initQIW - currQIX * -initQIX - currQIY * -initQIY - currQIZ * -initQIZ;
        const dqAX = dqArawW < 0.0 ? -dqArawX : dqArawX;
        const dqAY = dqArawW < 0.0 ? -dqArawY : dqArawY;
        const dqAZ = dqArawW < 0.0 ? -dqArawZ : dqArawZ;
        const dqBrawX = currQJW * -initQJX + currQJX * initQJW + currQJY * -initQJZ - currQJZ * -initQJY;
        const dqBrawY = currQJW * -initQJY - currQJX * -initQJZ + currQJY * initQJW + currQJZ * -initQJX;
        const dqBrawZ = currQJW * -initQJZ + currQJX * -initQJY - currQJY * -initQJX + currQJZ * initQJW;
        const dqBrawW = currQJW * initQJW - currQJX * -initQJX - currQJY * -initQJY - currQJZ * -initQJZ;
        const dqBX = dqBrawW < 0.0 ? -dqBrawX : dqBrawX;
        const dqBY = dqBrawW < 0.0 ? -dqBrawY : dqBrawY;
        const dqBZ = dqBrawW < 0.0 ? -dqBrawZ : dqBrawZ;
        const dThetaAX = 2.0 * dqAX;
        const dThetaAY = 2.0 * dqAY;
        const dThetaAZ = 2.0 * dqAZ;
        const dThetaBX = 2.0 * dqBX;
        const dThetaBY = 2.0 * dqBY;
        const dThetaBZ = 2.0 * dqBZ;

        const constraintC0Base = contactConstraintC0Base(p);
        const c0 = pairContacts[constraintC0Base] ?? 0.0;
        const anchorGap = c0 - normalContactMargin;
        const cRegN = (1.0 - regularizationAlpha) * c0
          + dot3(-nx, -ny, -nz, dPosIX, dPosIY, dPosIZ)
          + dot3(-crossRaN_X, -crossRaN_Y, -crossRaN_Z, dThetaAX, dThetaAY, dThetaAZ)
          + dot3(nx, ny, nz, dPosJX, dPosJY, dPosJZ)
          + dot3(crossRbN_X, crossRbN_Y, crossRbN_Z, dThetaBX, dThetaBY, dThetaBZ);
        if (cRegN <= 0.0) continue;

        const currentPointAX = iPosX + raX;
        const currentPointAY = iPosY + raY;
        const currentPointAZ = iPosZ + raZ;
        const currentPointBX = jPosX + rbX;
        const currentPointBY = jPosY + rbY;
        const currentPointBZ = jPosZ + rbZ;
        const currentGap = -dot3(
          currentPointAX - currentPointBX,
          currentPointAY - currentPointBY,
          currentPointAZ - currentPointBZ,
          nx,
          ny,
          nz,
        );
        const rawPenetration = -currentGap;

        const dualBase = contactDualBase(p);
        const penaltyBase = contactPenaltyBase(p);
        const dualN = Math.min(pairContacts[dualBase] ?? 0.0, 0.0);
        const penaltyN = Math.max(pairContacts[penaltyBase] ?? 0.0, 1e-6);

        const featureWord = pairContactWords[metaBase + 3] ?? 0;
        const preserveWarmstart = ((featureWord >>> 16) & 0x1) !== 0;
        const stick = ((featureWord >>> 17) & 0x1) !== 0;
        const reuse = ((featureWord >>> 18) & 0x1) !== 0;
        const warmstartReason = (featureWord >>> 21) & 0x7;
        const featureKey = featureWord & 0x1FF;
        const keyWord = pairContactWords[contactRecordVec4FloatIndex(p, CONTACT_RECORD_CACHE_OFFSET)] ?? 0;
        const key = keyWord & 0x7fffffff;
        const keyBase = this.contactKeySlotBitCount > 0 ? (key >>> this.contactKeySlotBitCount) : key;
        const keySlot = this.contactKeySlotBitCount > 0 ? (key & keySlotMask) : 0;
        const clampedSeparated = penetration <= 1e-6 && currentGap > suspiciousGapThreshold;
        const reusedSeparated = reuse && clampedSeparated;

        offenders.push({
          p,
          i,
          j,
          keyBase,
          keySlot,
          featureKey,
          warmstartReason,
          preserveWarmstart,
          stick,
          reuse,
          penetration,
          rawPenetration,
          currentGap,
          c0,
          cRegN,
          dualN,
          penaltyN,
          clampedSeparated,
          reusedSeparated,
        });
      }

      offenders.sort((a, b) =>
        (Number(b.reusedSeparated) - Number(a.reusedSeparated))
        || (Number(b.clampedSeparated) - Number(a.clampedSeparated))
        || (b.cRegN - a.cRegN)
        || (b.currentGap - a.currentGap)
        || (b.penaltyN - a.penaltyN)
      );

      const top = offenders.slice(0, 6).map((entry) =>
        `p=${entry.p} ij=${entry.i}/${entry.j} key=${entry.keyBase.toString(16)}:${entry.keySlot} `
        + `feat=0x${entry.featureKey.toString(16)} warm=${entry.preserveWarmstart ? 1 : 0} `
        + `wsrc=${formatWarmstartReason(entry.warmstartReason)} stick=${entry.stick ? 1 : 0} reuse=${entry.reuse ? 1 : 0} `
        + `pen=${entry.penetration.toFixed(4)} pRaw=${entry.rawPenetration.toFixed(4)} gNow=${entry.currentGap.toFixed(4)} `
        + `c0N=${entry.c0.toFixed(4)} cRegN=${entry.cRegN.toFixed(4)} dualN=${entry.dualN.toFixed(3)} `
        + `kN=${entry.penaltyN.toFixed(3)} clampSep=${entry.clampedSeparated ? 1 : 0} reuseSep=${entry.reusedSeparated ? 1 : 0}`,
      );

      console.log(
        `[AVBD Separating Trace] frame=${frameId} mainSep=${mainSeparating}/${mainBounded} `
        + `activeList=${activeListCount} offenders=${offenders.length} top=${top[0] ?? 'none'}`,
      );
      if (top.length > 0) {
        console.log(`[AVBD Separating Trace Dump] ${top.join(' ; ')}`);
      }
      if (offenders.length === 0) {
        console.log(
          `[AVBD Separating Trace] frame=${frameId} mismatch=1 `
          + `reason=reconstruction_found_no_positive_cRegN_rows`,
        );
      }
    }).catch((error: unknown) => {
      console.warn('AVBD separating trace readback failed:', error);
    }).finally(() => {
      this.separatingTraceReadbackInFlight = false;
    });
  }

  maybeLogDebug(renderer: any, frameId: number, pairDispatchCount: number, bodyCount: number): void {
    if (!this.debugEnabled) return;
    if (this.debugReadbackInFlight) return;
    if (this.lastDebugLogFrame === frameId) return;
    if (this.lastDebugLogFrame >= 0 && frameId - this.lastDebugLogFrame < this.debugEveryNFrames) return;
    if (!renderer || typeof renderer.getArrayBufferAsync !== 'function') return;

    const boundedDispatch = Math.min(pairDispatchCount, this.maxActivePairContacts);
    if (boundedDispatch <= 0) return;

    this.debugReadbackInFlight = true;
    this.lastDebugLogFrame = frameId;

    this.accumulateDebugCountersKernel.computeNode.parameters.pairDispatchCount.value = boundedDispatch;
    this.accumulateBodyColorDebugCountersKernel.computeNode.parameters.bodyCount.value = bodyCount;

    renderer.compute(this.clearDebugCountersKernel, [1, 1, 1]);
    renderer.compute(this.accumulateDebugCountersKernel, this.contactDispatch(boundedDispatch));
    renderer.compute(this.accumulateBodyColorDebugCountersKernel, [Math.ceil(bodyCount / WORKGROUP_SIZE), 1, 1]);

    Promise.all([
      renderer.getArrayBufferAsync(this.debugCountersAttr),
      renderer.getArrayBufferAsync(this.phaseDebugCountersAttr),
    ]).then(([dualRaw, phaseRaw]: [ArrayBuffer, ArrayBuffer]) => {
      const values = new Uint32Array(dualRaw);
      const scanned = values[0] ?? 0;
      const valid = values[1] ?? 0;
      const bounded = values[2] ?? 0;
      const staticRegime = values[3] ?? 0;
      const nearCone = values[4] ?? 0;
      const tinyNormal = values[5] ?? 0;
      const nyPos = values[6] ?? 0;
      const nyNeg = values[7] ?? 0;
      const boundViol = values[8] ?? 0;
      const nyVertical = values[9] ?? 0;
      const nyHorizontal = values[10] ?? 0;
      const constrainedBodies = values[11] ?? 0;
      const fallbackBodies = values[12] ?? 0;
      const totalBodyConstraintRefs = values[13] ?? 0;
      const saturatedBodyConstraintLists = values[14] ?? 0;
      const maxBodyConstraintRefs = values[15] ?? 0;
      const coloredConstraintEdges = values[16] ?? 0;
      const sameColorConstraintEdges = values[17] ?? 0;
      const staticPct = bounded > 0 ? (100 * staticRegime / bounded).toFixed(1) : '0.0';
      const nearConePct = bounded > 0 ? (100 * nearCone / bounded).toFixed(1) : '0.0';
      const fallbackPct = constrainedBodies > 0 ? (100 * fallbackBodies / constrainedBodies).toFixed(1) : '0.0';
      const avgBodyConstraintRefs = constrainedBodies > 0 ? (totalBodyConstraintRefs / constrainedBodies).toFixed(2) : '0.00';
      const colorConflictPct = coloredConstraintEdges > 0 ? (100 * sameColorConstraintEdges / coloredConstraintEdges).toFixed(2) : '0.00';
      console.log(
        `[AVBD Debug] frame=${frameId} scanned=${scanned} valid=${valid} bounded=${bounded} ` +
        `static=${staticRegime}(${staticPct}%) nearCone=${nearCone}(${nearConePct}%) ` +
        `tinyNormal=${tinyNormal} nyPos=${nyPos} nyNeg=${nyNeg} ` +
        `nyVertical=${nyVertical} nyHorizontal=${nyHorizontal} boundViol=${boundViol} ` +
        `colorFallback=${fallbackBodies}/${constrainedBodies}(${fallbackPct}%) ` +
        `bodyRefs=${totalBodyConstraintRefs} avgBodyRefs=${avgBodyConstraintRefs} ` +
        `maxBodyRefs=${maxBodyConstraintRefs} saturatedBodies=${saturatedBodyConstraintLists} ` +
        `colorConflicts=${sameColorConstraintEdges}/${coloredConstraintEdges}(${colorConflictPct}%)`,
      );

      const phase = new Uint32Array(phaseRaw);
      const mainScanned = phase[0] ?? 0;
      const mainBounded = phase[1] ?? 0;
      const mainNearCone = phase[2] ?? 0;
      const mainTinyNormal = phase[3] ?? 0;
      const mainNyPos = phase[4] ?? 0;
      const mainNyNeg = phase[5] ?? 0;
      const mainSeparating = phase[6] ?? 0;
      const mainConeClamp = phase[7] ?? 0;
      const mainFrictionSuppressed = phase[8] ?? 0;
      const postScanned = phase[9] ?? 0;
      const postBounded = phase[10] ?? 0;
      const postNearCone = phase[11] ?? 0;
      const postTinyNormal = phase[12] ?? 0;
      const postNyPos = phase[13] ?? 0;
      const postNyNeg = phase[14] ?? 0;
      const postSeparating = phase[15] ?? 0;
      const postConeClamp = phase[16] ?? 0;
      const postFrictionSuppressed = phase[17] ?? 0;
      const mainNearConePct = mainBounded > 0 ? (100 * mainNearCone / mainBounded).toFixed(1) : '0.0';
      const postNearConePct = postBounded > 0 ? (100 * postNearCone / postBounded).toFixed(1) : '0.0';
      console.log(
        `[AVBD Solve Phase Debug] frame=${frameId} ` +
        `main(scanned=${mainScanned} bounded=${mainBounded} nearCone=${mainNearCone}(${mainNearConePct}%) ` +
        `tinyN=${mainTinyNormal} ny+/-=${mainNyPos}/${mainNyNeg} sep=${mainSeparating} coneClamp=${mainConeClamp} fricOffSep=${mainFrictionSuppressed}) ` +
        `post(scanned=${postScanned} bounded=${postBounded} nearCone=${postNearCone}(${postNearConePct}%) ` +
        `tinyN=${postTinyNormal} ny+/-=${postNyPos}/${postNyNeg} sep=${postSeparating} coneClamp=${postConeClamp} fricOffSep=${postFrictionSuppressed})`,
      );

      if (mainSeparating > 0) {
        if (this.separatingTraceArmed) {
          this.traceSeparatingContacts(renderer, frameId, mainSeparating, mainBounded);
          this.separatingTraceArmed = false;
        }
      } else {
        this.separatingTraceArmed = true;
      }
    }).catch((error: unknown) => {
      console.warn('AVBD debug readback failed:', error);
    }).finally(() => {
      this.debugReadbackInFlight = false;
    });
  }
}
