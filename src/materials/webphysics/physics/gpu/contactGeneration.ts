import { IndirectStorageBufferAttribute, StorageBufferAttribute } from 'three/webgpu';
import { INDIRECT_DISPATCH_DISABLED } from './indirectDispatch';
import { storage, uniform, workgroupId, localId, wgsl, wgslFn } from './tslCompat';
import { qrot, qconj, obbSupport } from './quatUtils';
import { AVBD_COLLISION_MARGIN, AVBD_FRICTION_STATIC } from '../avbdParams';
import { assertStorageBufferBudget } from './bindingBudget';
import {
  CONTACT_RECORD_META_OFFSET,
  CONTACT_RECORD_VEC4S,
  contactRecordBaseFloatIndex,
  contactRecordHelpers,
  contactRecordVec4FloatIndex,
} from './contactRecord';
import { shapeEncodingHelpers } from './shapeEncoding';

const WORKGROUP_SIZE = 256;
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

      fn tangentBasisAngleFromT1(n: vec3f, t1: vec3f) -> f32 {
        let canonical = canonicalTangentBasis(n);
        var theta = atan2(dot(t1, canonical.t2), dot(t1, canonical.t1));
        if (theta < 0.0) {
          theta += TANGENT_BASIS_TWO_PI;
        }
        return theta;
      }
`);

export class ContactGenerationStage {
  private pairKernel: any;
  private pairKernelDebug: any;
  private clearPairBodyCountsKernel: any;
  private clearDebugCountersKernel: any;
  private clearActiveCandidateSlotsKernel: any;
  private buildActiveCandidateSlotsKernel: any;
  private buildPairDispatchArgsKernel: any;
  private buildPairBodyListsKernel: any;
  private buildPairBodyListsKernelDebug: any;
  private finalizeDebugCountersKernel: any;
  private pairDispatchIndirectAttr: IndirectStorageBufferAttribute;
  private readonly debugCountersAttr: StorageBufferAttribute;
  private readonly pairContactsAttr: StorageBufferAttribute;
  private readonly maxPairContacts: number;
  private readonly pairManifoldSlots: number;
  private floorDebugBody = 0xffffffff;
  private debugEnabled = false;
  private debugReadbackInFlight = false;
  private lastDebugLogFrame = -1;
  private debugEveryNFrames = 30;

  constructor(
    positions: StorageBufferAttribute,
    quaternions: StorageBufferAttribute,
    shapes: StorageBufferAttribute,
    pairContacts: StorageBufferAttribute,
    pairActivity: StorageBufferAttribute,
    pairBodyContactCounts: StorageBufferAttribute,
    pairBodyContactIndices: StorageBufferAttribute,
    maxBodies: number,
    maxPairContacts: number,
    pairManifoldSlots: number,
    maxPairContactsPerBody: number,
    maxActivePairContacts: number,
    pairCandidateIndicesOffset: number,
    pairActiveCandidateSlotsOffset: number,
    pairActiveContactsOffset: number,
    pairIgnoredBitsOffset: number,
    pairActivityWordCount: number,
  ) {
    this.pairContactsAttr = pairContacts;
    this.maxPairContacts = maxPairContacts;
    this.pairManifoldSlots = pairManifoldSlots;
    const maxPairBodyContacts = maxBodies * maxPairContactsPerBody;
    const maxPairDispatchPairs = Math.floor(maxPairContacts / pairManifoldSlots);
    this.pairDispatchIndirectAttr = new IndirectStorageBufferAttribute(new Uint32Array([0, 1, 1]), 1);
    this.pairDispatchIndirectAttr.name = 'Contact Pair Dispatch Indirect';
    // debugCounters layout:
    // 0 = warmstartResets (slot identity mismatch)
    // 1 = activeManifolds
    // 2 = activeCandidateSlots
    // 3 = stalePrunedSlots
    // 4 = separatingKeptSlots
    // 5 = stickingAnchorReuses
    // 6 = sharedTangentSignFlips
    // 7 = floorPairCandidates
    // 8 = floorPairWarmstartResets
    // 9 = floorPairKeepRejected
    // 10 = floorPairDegenerateFallbacks
    // 11 = floorPairWriteZero
    // 12 = floorPairActive
    // 13 = floorPairSeparatedRejects
    // 14 = floorPairInactiveThresholdRejects
    // 15 = floorPairHysteresisRejects
    // 16..18 = floorPairSeparatedFaceA{0,1,2}
    // 19..21 = floorPairSeparatedFaceB{0,1,2}
    // 22 = floorPairSeparatedEdge
    // 23 = floorPairSeparatedOther
    // 24 = pairBodyListOverflowWrites
    // 25 = pairBodyListDroppedContacts
    // 26 = activeContactListOverflowWrites
    this.debugCountersAttr = new StorageBufferAttribute(new Uint32Array(27), 1);

    const pairShaderSource = /* wgsl */`
      fn compute(
        positions: ptr<storage, array<vec4f>, read>,
        quaternions: ptr<storage, array<vec4f>, read>,
        shapes: ptr<storage, array<vec4f>, read>,
        pairContacts: ptr<storage, array<vec4f>, read_write>,
        pairActivity: ptr<storage, array<u32>, read_write>,
        debugCounters: ptr<storage, array<atomic<u32>>, read_write>,
        debugEnabled: u32,
        bodyCount: u32,
        pairCount: u32,
        pairDispatchCount: u32,
        useCandidatePairs: u32,
        floorDebugBody: u32,
        contactSlop: f32,
        frictionStatic: f32,
        workgroupId: vec3u,
        localId: vec3u,
      ) -> void {
        let gid = workgroupId.x * ${WORKGROUP_SIZE}u + localId.x;
        if (gid >= pairDispatchCount) { return; }
        var manifold = gid;
        if (useCandidatePairs > 0u) {
          let activeCandidateCount = min(pairActivity[${pairActiveCandidateSlotsOffset}u], pairDispatchCount);
          if (gid >= activeCandidateCount) { return; }
          manifold = pairActivity[${pairActiveCandidateSlotsOffset}u + gid + 1u];
          if (manifold >= pairDispatchCount) { return; }
        }
        if (manifold >= ${maxPairDispatchPairs}u) { return; }
        let pairBase = manifold * ${pairManifoldSlots}u;

        var i = 0u;
        var j = 0u;
        if (useCandidatePairs > 0u) {
          let packedPair = pairActivity[${pairCandidateIndicesOffset}u + manifold + 1u];
          i = packedPair & 0xFFFFu;
          j = packedPair >> 16u;
          if (i >= j) {
            // Empty fixed candidate slots only need to be marked inactive.
            deactivateManifold(pairContacts, pairBase, 0.0, 0.0);
            return;
          }
        } else {
          var pairIndex = 0u;
          if (manifold >= pairCount || manifold >= ${maxPairDispatchPairs}u) { return; }
          pairIndex = manifold;
          if (pairIndex >= pairCount) { return; }

          // Brute-force fallback path (small-N only): decode triangular pair index.
          j = u32(floor((1.0 + sqrt(1.0 + 8.0 * f32(pairIndex))) * 0.5));
          if (j == 0u) { return; }
          var triangular = (j * (j - 1u)) / 2u;
          if (triangular > pairIndex) {
            j -= 1u;
            triangular = (j * (j - 1u)) / 2u;
          }
          i = pairIndex - triangular;
          if (i >= j) { return; }
        }

        let isFloorPair = floorDebugBody != 0xffffffffu && (i == floorDebugBody || j == floorDebugBody);
        if (isFloorPair && debugEnabled > 0u) {
          atomicAdd(&debugCounters[7], 1u);
        }

        let ignoredPairIndex = (j * (j - 1u)) / 2u + i;
        let ignoredPairWord = ignoredPairIndex >> 5u;
        let ignoredPairBit = 1u << (ignoredPairIndex & 31u);
        if ((pairActivity[${pairIgnoredBitsOffset}u + ignoredPairWord] & ignoredPairBit) != 0u) {
          deactivateManifold(pairContacts, pairBase, f32(i), f32(j));
          return;
        }

        let firstInfo = loadContactMeta(pairContacts, pairBase);
        let firstI = u32(firstInfo.x + 0.5);
        let firstJ = u32(firstInfo.y + 0.5);
        if (firstI != i || firstJ != j) {
          if (debugEnabled > 0u) {
            atomicAdd(&debugCounters[0], 1u);
            if (isFloorPair) {
              atomicAdd(&debugCounters[8], 1u);
            }
          }
          deactivateManifold(pairContacts, pairBase, f32(i), f32(j));
        }

        var wasActive = false;
        var prevPairFeature: i32 = -1;
        var prevPairNormal = vec3f(0.0);
        for (var s = 0u; s < ${pairManifoldSlots}u; s++) {
          let slot = pairBase + s;
          let slotInfo = loadContactMeta(pairContacts, slot);
          if (slotInfo.z > 0.5) {
            if (!wasActive) {
              prevPairFeature = i32(decodePackedBaseFeature(slotInfo.w));
              prevPairNormal = loadContactNormalPen(pairContacts, slot).xyz;
            }
            wasActive = true;
          }
        }

        let hysteresis = 0.35 * contactSlop;
        let sepSlop = contactSlop + select(0.0, hysteresis, wasActive);

        if (i >= bodyCount || j >= bodyCount) {
          deactivateManifold(pairContacts, pairBase, f32(i), f32(j));
          return;
        }

        let invMassA = positions[i].w;
        let invMassB = positions[j].w;
        if (invMassA + invMassB == 0.0) {
          deactivateManifold(pairContacts, pairBase, f32(i), f32(j));
          return;
        }

        let posA = positions[i].xyz;
        let posB = positions[j].xyz;
        let qA = quaternions[i];
        let qB = quaternions[j];
        let shpA = shapes[i];
        let shpB = shapes[j];
        if (!shapesCanCollide(shpA, shpB)) {
          deactivateManifold(pairContacts, pairBase, f32(i), f32(j));
          return;
        }
        let frictionScale = sqrt(max(decodeShapeFriction(shpA.x), 0.0) * max(decodeShapeFriction(shpB.x), 0.0));
        let shapeTypeA = decodeShapeType(shpA.x);
        let shapeTypeB = decodeShapeType(shpB.x);
        let isSphereA = shapeTypeA == SHAPE_TYPE_SPHERE;
        let isSphereB = shapeTypeB == SHAPE_TYPE_SPHERE;
        let specialPair = isSphereA || isSphereB;
        let halfA = vec3f(shpA.y, shpA.z, shpA.w);
        let halfB = vec3f(shpB.y, shpB.z, shpB.w);
        let radiusA = max(halfA.x, 0.0);
        let radiusB = max(halfB.x, 0.0);
        let e0 = vec3f(1.0, 0.0, 0.0);
        let e1 = vec3f(0.0, 1.0, 0.0);
        let e2 = vec3f(0.0, 0.0, 1.0);
        let axA0 = qrot(qA, e0);
        let axA1 = qrot(qA, e1);
        let axA2 = qrot(qA, e2);
        let axB0 = qrot(qB, e0);
        let axB1 = qrot(qB, e1);
        let axB2 = qrot(qB, e2);

        var penetration = 0.0;
        var keepContact = false;
        var specialPointA = vec3f(0.0);
        var specialPointB = vec3f(0.0);
        var specialRAWorld = vec3f(0.0);
        var specialRBWorld = vec3f(0.0);
        var specialContactKey = 0u;
        var specialRefIsA = false;
        var specialRefFeature = 0u;
        var specialIncFeature = 0u;
        var specialManifoldPreferredT1 = vec3f(0.0);
        var specialManifoldHasPreferredT1 = false;
        var bestNormal = vec3f(0.0);
        var bestFeature: i32 = -1;
        var keepRejectClass = 0u;
        var separatedFeature: i32 = -1;
        if (!specialPair) {
        let d = posB - posA;
        let eps = 1e-6;

        let R00 = dot(axA0, axB0); let R01 = dot(axA0, axB1); let R02 = dot(axA0, axB2);
        let R10 = dot(axA1, axB0); let R11 = dot(axA1, axB1); let R12 = dot(axA1, axB2);
        let R20 = dot(axA2, axB0); let R21 = dot(axA2, axB1); let R22 = dot(axA2, axB2);

        let aR00 = abs(R00) + eps; let aR01 = abs(R01) + eps; let aR02 = abs(R02) + eps;
        let aR10 = abs(R10) + eps; let aR11 = abs(R11) + eps; let aR12 = abs(R12) + eps;
        let aR20 = abs(R20) + eps; let aR21 = abs(R21) + eps; let aR22 = abs(R22) + eps;

        let tA = vec3f(dot(d, axA0), dot(d, axA1), dot(d, axA2));
        var minPen = 1e30;
        var faceMinPen = 1e30;
        var faceBestNormal = vec3f(0.0);
        var faceBestFeature: i32 = -1;
        var separated = false;

        // Face normals of A
        {
          let ra = halfA.x;
          let rb = aR00 * halfB.x + aR01 * halfB.y + aR02 * halfB.z;
          let s = abs(tA.x);
          let pen = ra + rb - s;
          if (pen < -sepSlop) { separated = true; separatedFeature = 0; }
          if (!separated && pen < faceMinPen) {
            faceMinPen = pen;
            faceBestNormal = select(axA0, -axA0, tA.x < 0.0);
            faceBestFeature = 0;
          }
          if (!separated && pen < minPen) {
            minPen = pen;
            bestNormal = select(axA0, -axA0, tA.x < 0.0);
            bestFeature = 0;
          }
        }
        if (!separated) {
          let ra = halfA.y;
          let rb = aR10 * halfB.x + aR11 * halfB.y + aR12 * halfB.z;
          let s = abs(tA.y);
          let pen = ra + rb - s;
          if (pen < -sepSlop) { separated = true; separatedFeature = 1; }
          if (!separated && pen < faceMinPen) {
            faceMinPen = pen;
            faceBestNormal = select(axA1, -axA1, tA.y < 0.0);
            faceBestFeature = 1;
          }
          if (!separated && pen < minPen) {
            minPen = pen;
            bestNormal = select(axA1, -axA1, tA.y < 0.0);
            bestFeature = 1;
          }
        }
        if (!separated) {
          let ra = halfA.z;
          let rb = aR20 * halfB.x + aR21 * halfB.y + aR22 * halfB.z;
          let s = abs(tA.z);
          let pen = ra + rb - s;
          if (pen < -sepSlop) { separated = true; separatedFeature = 2; }
          if (!separated && pen < faceMinPen) {
            faceMinPen = pen;
            faceBestNormal = select(axA2, -axA2, tA.z < 0.0);
            faceBestFeature = 2;
          }
          if (!separated && pen < minPen) {
            minPen = pen;
            bestNormal = select(axA2, -axA2, tA.z < 0.0);
            bestFeature = 2;
          }
        }

        // Face normals of B
        let tB = vec3f(dot(d, axB0), dot(d, axB1), dot(d, axB2));
        if (!separated) {
          let ra = aR00 * halfA.x + aR10 * halfA.y + aR20 * halfA.z;
          let rb = halfB.x;
          let s = abs(tB.x);
          let pen = ra + rb - s;
          if (pen < -sepSlop) { separated = true; separatedFeature = 3; }
          if (!separated && pen < faceMinPen) {
            faceMinPen = pen;
            faceBestNormal = select(axB0, -axB0, tB.x < 0.0);
            faceBestFeature = 3;
          }
          if (!separated && pen < minPen) {
            minPen = pen;
            bestNormal = select(axB0, -axB0, tB.x < 0.0);
            bestFeature = 3;
          }
        }
        if (!separated) {
          let ra = aR01 * halfA.x + aR11 * halfA.y + aR21 * halfA.z;
          let rb = halfB.y;
          let s = abs(tB.y);
          let pen = ra + rb - s;
          if (pen < -sepSlop) { separated = true; separatedFeature = 4; }
          if (!separated && pen < faceMinPen) {
            faceMinPen = pen;
            faceBestNormal = select(axB1, -axB1, tB.y < 0.0);
            faceBestFeature = 4;
          }
          if (!separated && pen < minPen) {
            minPen = pen;
            bestNormal = select(axB1, -axB1, tB.y < 0.0);
            bestFeature = 4;
          }
        }
        if (!separated) {
          let ra = aR02 * halfA.x + aR12 * halfA.y + aR22 * halfA.z;
          let rb = halfB.z;
          let s = abs(tB.z);
          let pen = ra + rb - s;
          if (pen < -sepSlop) { separated = true; separatedFeature = 5; }
          if (!separated && pen < faceMinPen) {
            faceMinPen = pen;
            faceBestNormal = select(axB2, -axB2, tB.z < 0.0);
            faceBestFeature = 5;
          }
          if (!separated && pen < minPen) {
            minPen = pen;
            bestNormal = select(axB2, -axB2, tB.z < 0.0);
            bestFeature = 5;
          }
        }

        // Edge-edge axes (9)
        if (!separated) {
          let axis = cross(axA0, axB0);
          let len2 = dot(axis, axis);
          if (len2 > 1e-6) {
            let invLen = inverseSqrt(len2);
            let n = axis * invLen;
            let ra = halfA.y * aR20 + halfA.z * aR10;
            let rb = halfB.y * aR02 + halfB.z * aR01;
            let s = abs(dot(d, n));
            let pen = (ra + rb) * invLen - s;
            if (pen < -sepSlop) { separated = true; separatedFeature = 6; }
            if (!separated && pen < minPen) {
              minPen = pen;
              bestNormal = select(n, -n, dot(d, n) < 0.0);
              bestFeature = 6;
            }
          }
        }
        if (!separated) {
          let axis = cross(axA0, axB1);
          let len2 = dot(axis, axis);
          if (len2 > 1e-6) {
            let invLen = inverseSqrt(len2);
            let n = axis * invLen;
            let ra = halfA.y * aR21 + halfA.z * aR11;
            let rb = halfB.x * aR02 + halfB.z * aR00;
            let s = abs(dot(d, n));
            let pen = (ra + rb) * invLen - s;
            if (pen < -sepSlop) { separated = true; separatedFeature = 7; }
            if (!separated && pen < minPen) {
              minPen = pen;
              bestNormal = select(n, -n, dot(d, n) < 0.0);
              bestFeature = 7;
            }
          }
        }
        if (!separated) {
          let axis = cross(axA0, axB2);
          let len2 = dot(axis, axis);
          if (len2 > 1e-6) {
            let invLen = inverseSqrt(len2);
            let n = axis * invLen;
            let ra = halfA.y * aR22 + halfA.z * aR12;
            let rb = halfB.x * aR01 + halfB.y * aR00;
            let s = abs(dot(d, n));
            let pen = (ra + rb) * invLen - s;
            if (pen < -sepSlop) { separated = true; separatedFeature = 8; }
            if (!separated && pen < minPen) {
              minPen = pen;
              bestNormal = select(n, -n, dot(d, n) < 0.0);
              bestFeature = 8;
            }
          }
        }
        if (!separated) {
          let axis = cross(axA1, axB0);
          let len2 = dot(axis, axis);
          if (len2 > 1e-6) {
            let invLen = inverseSqrt(len2);
            let n = axis * invLen;
            let ra = halfA.x * aR20 + halfA.z * aR00;
            let rb = halfB.y * aR12 + halfB.z * aR11;
            let s = abs(dot(d, n));
            let pen = (ra + rb) * invLen - s;
            if (pen < -sepSlop) { separated = true; separatedFeature = 9; }
            if (!separated && pen < minPen) {
              minPen = pen;
              bestNormal = select(n, -n, dot(d, n) < 0.0);
              bestFeature = 9;
            }
          }
        }
        if (!separated) {
          let axis = cross(axA1, axB1);
          let len2 = dot(axis, axis);
          if (len2 > 1e-6) {
            let invLen = inverseSqrt(len2);
            let n = axis * invLen;
            let ra = halfA.x * aR21 + halfA.z * aR01;
            let rb = halfB.x * aR12 + halfB.z * aR10;
            let s = abs(dot(d, n));
            let pen = (ra + rb) * invLen - s;
            if (pen < -sepSlop) { separated = true; separatedFeature = 10; }
            if (!separated && pen < minPen) {
              minPen = pen;
              bestNormal = select(n, -n, dot(d, n) < 0.0);
              bestFeature = 10;
            }
          }
        }
        if (!separated) {
          let axis = cross(axA1, axB2);
          let len2 = dot(axis, axis);
          if (len2 > 1e-6) {
            let invLen = inverseSqrt(len2);
            let n = axis * invLen;
            let ra = halfA.x * aR22 + halfA.z * aR02;
            let rb = halfB.x * aR11 + halfB.y * aR10;
            let s = abs(dot(d, n));
            let pen = (ra + rb) * invLen - s;
            if (pen < -sepSlop) { separated = true; separatedFeature = 11; }
            if (!separated && pen < minPen) {
              minPen = pen;
              bestNormal = select(n, -n, dot(d, n) < 0.0);
              bestFeature = 11;
            }
          }
        }
        if (!separated) {
          let axis = cross(axA2, axB0);
          let len2 = dot(axis, axis);
          if (len2 > 1e-6) {
            let invLen = inverseSqrt(len2);
            let n = axis * invLen;
            let ra = halfA.x * aR10 + halfA.y * aR00;
            let rb = halfB.y * aR22 + halfB.z * aR21;
            let s = abs(dot(d, n));
            let pen = (ra + rb) * invLen - s;
            if (pen < -sepSlop) { separated = true; separatedFeature = 12; }
            if (!separated && pen < minPen) {
              minPen = pen;
              bestNormal = select(n, -n, dot(d, n) < 0.0);
              bestFeature = 12;
            }
          }
        }
        if (!separated) {
          let axis = cross(axA2, axB1);
          let len2 = dot(axis, axis);
          if (len2 > 1e-6) {
            let invLen = inverseSqrt(len2);
            let n = axis * invLen;
            let ra = halfA.x * aR11 + halfA.y * aR01;
            let rb = halfB.x * aR22 + halfB.z * aR20;
            let s = abs(dot(d, n));
            let pen = (ra + rb) * invLen - s;
            if (pen < -sepSlop) { separated = true; separatedFeature = 13; }
            if (!separated && pen < minPen) {
              minPen = pen;
              bestNormal = select(n, -n, dot(d, n) < 0.0);
              bestFeature = 13;
            }
          }
        }
        if (!separated) {
          let axis = cross(axA2, axB2);
          let len2 = dot(axis, axis);
          if (len2 > 1e-6) {
            let invLen = inverseSqrt(len2);
            let n = axis * invLen;
            let ra = halfA.x * aR12 + halfA.y * aR02;
            let rb = halfB.x * aR21 + halfB.y * aR20;
            let s = abs(dot(d, n));
            let pen = (ra + rb) * invLen - s;
            if (pen < -sepSlop) { separated = true; separatedFeature = 14; }
            if (!separated && pen < minPen) {
              minPen = pen;
              bestNormal = select(n, -n, dot(d, n) < 0.0);
              bestFeature = 14;
            }
          }
        }

        // SAT winner hysteresis: if the previous active feature is still close in
        // penetration, keep it to avoid face/edge normal flicker on rotating boxes.
        if (!separated && wasActive && prevPairFeature >= 0) {
          let axisHysteresis = 0.5 * contactSlop;
          var prevPen = 1e30;
          var prevNormalEval = bestNormal;
          var prevValid = false;

          if (prevPairFeature == 0) {
            prevPen = halfA.x + (aR00 * halfB.x + aR01 * halfB.y + aR02 * halfB.z) - abs(tA.x);
            prevNormalEval = select(axA0, -axA0, tA.x < 0.0);
            prevValid = true;
          } else if (prevPairFeature == 1) {
            prevPen = halfA.y + (aR10 * halfB.x + aR11 * halfB.y + aR12 * halfB.z) - abs(tA.y);
            prevNormalEval = select(axA1, -axA1, tA.y < 0.0);
            prevValid = true;
          } else if (prevPairFeature == 2) {
            prevPen = halfA.z + (aR20 * halfB.x + aR21 * halfB.y + aR22 * halfB.z) - abs(tA.z);
            prevNormalEval = select(axA2, -axA2, tA.z < 0.0);
            prevValid = true;
          } else if (prevPairFeature == 3) {
            prevPen = (aR00 * halfA.x + aR10 * halfA.y + aR20 * halfA.z) + halfB.x - abs(tB.x);
            prevNormalEval = select(axB0, -axB0, tB.x < 0.0);
            prevValid = true;
          } else if (prevPairFeature == 4) {
            prevPen = (aR01 * halfA.x + aR11 * halfA.y + aR21 * halfA.z) + halfB.y - abs(tB.y);
            prevNormalEval = select(axB1, -axB1, tB.y < 0.0);
            prevValid = true;
          } else if (prevPairFeature == 5) {
            prevPen = (aR02 * halfA.x + aR12 * halfA.y + aR22 * halfA.z) + halfB.z - abs(tB.z);
            prevNormalEval = select(axB2, -axB2, tB.z < 0.0);
            prevValid = true;
          } else if (prevPairFeature == 6) {
            let axis = cross(axA0, axB0);
            let len2 = dot(axis, axis);
            if (len2 > 1e-6) {
              let invLen = inverseSqrt(len2);
              let n = axis * invLen;
              let ra = halfA.y * aR20 + halfA.z * aR10;
              let rb = halfB.y * aR02 + halfB.z * aR01;
              prevPen = (ra + rb) * invLen - abs(dot(d, n));
              prevNormalEval = select(n, -n, dot(d, n) < 0.0);
              prevValid = true;
            }
          } else if (prevPairFeature == 7) {
            let axis = cross(axA0, axB1);
            let len2 = dot(axis, axis);
            if (len2 > 1e-6) {
              let invLen = inverseSqrt(len2);
              let n = axis * invLen;
              let ra = halfA.y * aR21 + halfA.z * aR11;
              let rb = halfB.x * aR02 + halfB.z * aR00;
              prevPen = (ra + rb) * invLen - abs(dot(d, n));
              prevNormalEval = select(n, -n, dot(d, n) < 0.0);
              prevValid = true;
            }
          } else if (prevPairFeature == 8) {
            let axis = cross(axA0, axB2);
            let len2 = dot(axis, axis);
            if (len2 > 1e-6) {
              let invLen = inverseSqrt(len2);
              let n = axis * invLen;
              let ra = halfA.y * aR22 + halfA.z * aR12;
              let rb = halfB.x * aR01 + halfB.y * aR00;
              prevPen = (ra + rb) * invLen - abs(dot(d, n));
              prevNormalEval = select(n, -n, dot(d, n) < 0.0);
              prevValid = true;
            }
          } else if (prevPairFeature == 9) {
            let axis = cross(axA1, axB0);
            let len2 = dot(axis, axis);
            if (len2 > 1e-6) {
              let invLen = inverseSqrt(len2);
              let n = axis * invLen;
              let ra = halfA.x * aR20 + halfA.z * aR00;
              let rb = halfB.y * aR12 + halfB.z * aR11;
              prevPen = (ra + rb) * invLen - abs(dot(d, n));
              prevNormalEval = select(n, -n, dot(d, n) < 0.0);
              prevValid = true;
            }
          } else if (prevPairFeature == 10) {
            let axis = cross(axA1, axB1);
            let len2 = dot(axis, axis);
            if (len2 > 1e-6) {
              let invLen = inverseSqrt(len2);
              let n = axis * invLen;
              let ra = halfA.x * aR21 + halfA.z * aR01;
              let rb = halfB.x * aR12 + halfB.z * aR10;
              prevPen = (ra + rb) * invLen - abs(dot(d, n));
              prevNormalEval = select(n, -n, dot(d, n) < 0.0);
              prevValid = true;
            }
          } else if (prevPairFeature == 11) {
            let axis = cross(axA1, axB2);
            let len2 = dot(axis, axis);
            if (len2 > 1e-6) {
              let invLen = inverseSqrt(len2);
              let n = axis * invLen;
              let ra = halfA.x * aR22 + halfA.z * aR02;
              let rb = halfB.x * aR11 + halfB.y * aR10;
              prevPen = (ra + rb) * invLen - abs(dot(d, n));
              prevNormalEval = select(n, -n, dot(d, n) < 0.0);
              prevValid = true;
            }
          } else if (prevPairFeature == 12) {
            let axis = cross(axA2, axB0);
            let len2 = dot(axis, axis);
            if (len2 > 1e-6) {
              let invLen = inverseSqrt(len2);
              let n = axis * invLen;
              let ra = halfA.x * aR10 + halfA.y * aR00;
              let rb = halfB.y * aR22 + halfB.z * aR21;
              prevPen = (ra + rb) * invLen - abs(dot(d, n));
              prevNormalEval = select(n, -n, dot(d, n) < 0.0);
              prevValid = true;
            }
          } else if (prevPairFeature == 13) {
            let axis = cross(axA2, axB1);
            let len2 = dot(axis, axis);
            if (len2 > 1e-6) {
              let invLen = inverseSqrt(len2);
              let n = axis * invLen;
              let ra = halfA.x * aR11 + halfA.y * aR01;
              let rb = halfB.x * aR22 + halfB.z * aR20;
              prevPen = (ra + rb) * invLen - abs(dot(d, n));
              prevNormalEval = select(n, -n, dot(d, n) < 0.0);
              prevValid = true;
            }
          } else if (prevPairFeature == 14) {
            let axis = cross(axA2, axB2);
            let len2 = dot(axis, axis);
            if (len2 > 1e-6) {
              let invLen = inverseSqrt(len2);
              let n = axis * invLen;
              let ra = halfA.x * aR12 + halfA.y * aR02;
              let rb = halfB.x * aR21 + halfB.y * aR20;
              prevPen = (ra + rb) * invLen - abs(dot(d, n));
              prevNormalEval = select(n, -n, dot(d, n) < 0.0);
              prevValid = true;
            }
          }

          if (prevValid && prevPen > -sepSlop && prevPen <= minPen + axisHysteresis && dot(prevPairNormal, prevNormalEval) > 0.85) {
            minPen = prevPen;
            bestNormal = prevNormalEval;
            bestFeature = prevPairFeature;
          }
        }

        // Edge-edge axes are noisy near face-edge ties on rotating boxes.
        // Require a clear penetration advantage before choosing an edge axis.
        if (!separated && bestFeature >= 6 && faceBestFeature >= 0) {
          let edgeWinMargin = 0.5 * contactSlop;
          if (minPen >= faceMinPen - edgeWinMargin) {
            minPen = faceMinPen;
            bestNormal = faceBestNormal;
            bestFeature = faceBestFeature;
          }
        }

        penetration = minPen;
        keepContact = !separated
          && (penetration > -contactSlop || (wasActive && penetration > -(contactSlop + hysteresis)));
        if (!keepContact) {
          keepRejectClass = select(select(14u, 15u, wasActive), 13u, separated);
        }
        } else {
          if (isSphereA && isSphereB) {
            let centerDelta = posB - posA;
            let centerDist2 = dot(centerDelta, centerDelta);
            let rSum = radiusA + radiusB;
            if (centerDist2 > 1e-12) {
              let centerDist = sqrt(centerDist2);
              bestNormal = centerDelta / centerDist;
              penetration = rSum - centerDist;
            } else {
              bestNormal = select(prevPairNormal, vec3f(0.0, 1.0, 0.0), dot(prevPairNormal, prevPairNormal) < 1e-12);
              penetration = rSum;
            }
            bestFeature = 6;
            keepContact = penetration > -contactSlop || (wasActive && penetration > -(contactSlop + hysteresis));
            if (!keepContact) {
              keepRejectClass = select(14u, 15u, wasActive);
            }
            specialPointA = posA + bestNormal * radiusA;
            specialPointB = posB - bestNormal * radiusB;
            specialRAWorld = specialPointA - posA;
            specialRBWorld = specialPointB - posB;
            specialContactKey = packEdgeContactFeature(0u, 0u);
          } else if (isSphereA != isSphereB) {
            let sphereIsA = isSphereA;
            let sphereCenter = select(posB, posA, sphereIsA);
            let boxCenter = select(posA, posB, sphereIsA);
            let sphereRadius = select(radiusB, radiusA, sphereIsA);
            let halfBox = select(halfA, halfB, sphereIsA);
            let boxAx0 = select(axA0, axB0, sphereIsA);
            let boxAx1 = select(axA1, axB1, sphereIsA);
            let boxAx2 = select(axA2, axB2, sphereIsA);

            let rel = sphereCenter - boxCenter;
            let sphereLocal = vec3f(dot(rel, boxAx0), dot(rel, boxAx1), dot(rel, boxAx2));
            let clampedLocal = clamp(sphereLocal, -halfBox, halfBox);
            let deltaLocal = sphereLocal - clampedLocal;
            var boxPointLocal = clampedLocal;
            var faceAxis = 0u;
            var faceSign = 1.0;
            var boxOutwardNormal = boxAx0;
            let outsideDist2 = dot(deltaLocal, deltaLocal);

            if (outsideDist2 > 1e-12) {
              faceAxis = dominantAbsAxis3(deltaLocal);
              faceSign = sgnnz(axisValue3(deltaLocal, faceAxis));
              boxOutwardNormal = axisVector3(faceAxis, boxAx0, boxAx1, boxAx2) * faceSign;
              penetration = sphereRadius - sqrt(outsideDist2);
            } else {
              let faceGap = halfBox - abs(sphereLocal);
              faceAxis = leastAxis3(faceGap);
              faceSign = sgnnz(axisValue3(sphereLocal, faceAxis));
              if (faceAxis == 0u) {
                boxPointLocal = vec3f(faceSign * halfBox.x, sphereLocal.y, sphereLocal.z);
              } else if (faceAxis == 1u) {
                boxPointLocal = vec3f(sphereLocal.x, faceSign * halfBox.y, sphereLocal.z);
              } else {
                boxPointLocal = vec3f(sphereLocal.x, sphereLocal.y, faceSign * halfBox.z);
              }
              boxOutwardNormal = axisVector3(faceAxis, boxAx0, boxAx1, boxAx2) * faceSign;
              penetration = sphereRadius + axisValue3(faceGap, faceAxis);
            }

            keepContact = penetration > -contactSlop || (wasActive && penetration > -(contactSlop + hysteresis));
            if (!keepContact) {
              keepRejectClass = select(14u, 15u, wasActive);
            }
            let boxPointWorld = boxCenter
              + boxAx0 * boxPointLocal.x
              + boxAx1 * boxPointLocal.y
              + boxAx2 * boxPointLocal.z;
            let spherePointWorld = sphereCenter - boxOutwardNormal * sphereRadius;
            bestNormal = select(boxOutwardNormal, -boxOutwardNormal, sphereIsA);
            bestFeature = i32(faceAxis) + select(0, 3, sphereIsA);
            specialRefIsA = !sphereIsA;
            specialRefFeature = faceAxis;
            specialIncFeature = 0u;
            specialContactKey = packFaceContactFeature(!sphereIsA, faceAxis, 0u, 0u);
            specialPointA = select(boxPointWorld, spherePointWorld, sphereIsA);
            specialPointB = select(spherePointWorld, boxPointWorld, sphereIsA);
            specialRAWorld = specialPointA - posA;
            specialRBWorld = specialPointB - posB;
            specialManifoldHasPreferredT1 = true;
            specialManifoldPreferredT1 = select(
              axisVector3(0u, boxAx0, boxAx1, boxAx2),
              axisVector3(1u, boxAx0, boxAx1, boxAx2),
              faceAxis == 0u,
            );
            if (faceAxis == 1u) {
              specialManifoldPreferredT1 = boxAx2;
            } else if (faceAxis == 2u) {
              specialManifoldPreferredT1 = boxAx0;
            }
          }
        }
        if (!keepContact) {
          if (debugEnabled > 0u && isFloorPair) {
            atomicAdd(&debugCounters[9], 1u);
            if (keepRejectClass == 13u) {
              atomicAdd(&debugCounters[13], 1u);
              if (separatedFeature >= 0 && separatedFeature <= 2) {
                atomicAdd(&debugCounters[16u + u32(separatedFeature)], 1u);
              } else if (separatedFeature >= 3 && separatedFeature <= 5) {
                atomicAdd(&debugCounters[16u + u32(separatedFeature)], 1u);
              } else if (separatedFeature >= 6) {
                atomicAdd(&debugCounters[22], 1u);
              } else {
                atomicAdd(&debugCounters[23], 1u);
              }
            } else if (keepRejectClass == 15u) {
              atomicAdd(&debugCounters[15], 1u);
            } else {
              atomicAdd(&debugCounters[14], 1u);
            }
          }
          deactivateManifold(pairContacts, pairBase, f32(i), f32(j));
          return;
        }
        // A degenerate normal here means no SAT axis was ever selected (e.g.
        // NaN poses make every comparison false while keepContact stays true).
        // Without this, such pairs emit "valid" zero-normal contacts that
        // flood the constraint lists.
        if (!specialPair && dot(bestNormal, bestNormal) < 0.5) {
          deactivateManifold(pairContacts, pairBase, f32(i), f32(j));
          return;
        }
        let storedPenetration = max(penetration, 0.0);
        // Keep more temporary face candidates, then reduce to manifold slots by
        // spread (not only depth) for better torque stability.
        var candidatePointWorld: array<vec3f, 8>;
        var candidateRAWorld: array<vec3f, 8>;
        var candidateRBWorld: array<vec3f, 8>;
        var candidatePenetration: array<f32, 8>;
        var candidateContactKey: array<u32, 8>;
        var candidateCount = 0u;
        var manifoldPreferredT1 = specialManifoldPreferredT1;
        var manifoldHasPreferredT1 = specialManifoldHasPreferredT1;
        var refIsA = specialRefIsA;
        var refFeature = specialRefFeature;
        var incFeature = specialIncFeature;
        if (specialPair) {
          candidatePointWorld[0] = 0.5 * (specialPointA + specialPointB);
          candidateRAWorld[0] = specialRAWorld;
          candidateRBWorld[0] = specialRBWorld;
          candidatePenetration[0] = storedPenetration;
          candidateContactKey[0] = specialContactKey;
          candidateCount = 1u;
        } else if (bestFeature >= 6) {
          // Edge-edge: keep closest-segment single contact.
          let code = u32(bestFeature - 6);
          let k = code / 3u;
          let l = code - k * 3u;

          var uA = vec3f(0.0);
          var sA1 = vec3f(0.0);
          var sA2 = vec3f(0.0);
          var huA = 0.0;
          var hA1 = 0.0;
          var hA2 = 0.0;
          if (k == 0u) {
            uA = axA0; sA1 = axA1; sA2 = axA2;
            huA = halfA.x; hA1 = halfA.y; hA2 = halfA.z;
          } else if (k == 1u) {
            uA = axA1; sA1 = axA0; sA2 = axA2;
            huA = halfA.y; hA1 = halfA.x; hA2 = halfA.z;
          } else {
            uA = axA2; sA1 = axA0; sA2 = axA1;
            huA = halfA.z; hA1 = halfA.x; hA2 = halfA.y;
          }

          let sgnA1 = sgnnz(dot(sA1, bestNormal));
          let sgnA2 = sgnnz(dot(sA2, bestNormal));
          let cA = posA + sA1 * (sgnA1 * hA1) + sA2 * (sgnA2 * hA2);
          let pA0 = cA - uA * huA;
          let pA1 = cA + uA * huA;

          var uB = vec3f(0.0);
          var sB1 = vec3f(0.0);
          var sB2 = vec3f(0.0);
          var huB = 0.0;
          var hB1 = 0.0;
          var hB2 = 0.0;
          if (l == 0u) {
            uB = axB0; sB1 = axB1; sB2 = axB2;
            huB = halfB.x; hB1 = halfB.y; hB2 = halfB.z;
          } else if (l == 1u) {
            uB = axB1; sB1 = axB0; sB2 = axB2;
            huB = halfB.y; hB1 = halfB.x; hB2 = halfB.z;
          } else {
            uB = axB2; sB1 = axB0; sB2 = axB1;
            huB = halfB.z; hB1 = halfB.x; hB2 = halfB.y;
          }

          let sgnB1 = sgnnz(-dot(sB1, bestNormal));
          let sgnB2 = sgnnz(-dot(sB2, bestNormal));
          let cB = posB + sB1 * (sgnB1 * hB1) + sB2 * (sgnB2 * hB2);
          let pB0 = cB - uB * huB;
          let pB1 = cB + uB * huB;

          let seg = closestPointsSegments(pA0, pA1, pB0, pB1);
          let raWorld = seg.p - posA;
          let rbWorld = seg.q - posB;
          candidatePointWorld[0] = 0.5 * (seg.p + seg.q);
          candidateRAWorld[0] = raWorld;
          candidateRBWorld[0] = rbWorld;
          candidatePenetration[0] = storedPenetration;
          candidateContactKey[0] = packEdgeContactFeature(k, l);
          candidateCount = 1u;
          manifoldPreferredT1 = uA;
          manifoldHasPreferredT1 = true;
        } else {
          // Face features: generate up to 8 clipped candidates, then reduce.
          var refPos = vec3f(0.0);
          var refHalf = vec3f(0.0);
          var refX = vec3f(0.0);
          var refY = vec3f(0.0);
          var refZ = vec3f(0.0);
          var incPos = vec3f(0.0);
          var incHalf = vec3f(0.0);
          var incX = vec3f(0.0);
          var incY = vec3f(0.0);
          var incZ = vec3f(0.0);
          if (bestFeature < 3) {
            refPos = posA; refHalf = halfA; refX = axA0; refY = axA1; refZ = axA2;
            incPos = posB; incHalf = halfB; incX = axB0; incY = axB1; incZ = axB2;
            refFeature = u32(bestFeature);
          } else {
            refPos = posB; refHalf = halfB; refX = axB0; refY = axB1; refZ = axB2;
            incPos = posA; incHalf = halfA; incX = axA0; incY = axA1; incZ = axA2;
            refFeature = u32(bestFeature - 3);
          }

          var refAxis = vec3f(0.0);
          var refU = vec3f(0.0);
          var refV = vec3f(0.0);
          var refH = 0.0;
          var refHU = 0.0;
          var refHV = 0.0;
          if (refFeature == 0u) {
            refAxis = refX; refU = refY; refV = refZ;
            refH = refHalf.x; refHU = refHalf.y; refHV = refHalf.z;
          } else if (refFeature == 1u) {
            refAxis = refY; refU = refX; refV = refZ;
            refH = refHalf.y; refHU = refHalf.x; refHV = refHalf.z;
          } else {
            refAxis = refZ; refU = refX; refV = refY;
            refH = refHalf.z; refHU = refHalf.x; refHV = refHalf.y;
          }

          refIsA = bestFeature < 3;
          // Reference-face clipping uses the reference outward normal.
          let nRef = select(-bestNormal, bestNormal, refIsA);
          let refSign = sgnnz(dot(refAxis, nRef));
          let refCenter = refPos + refAxis * (refSign * refH);
          manifoldPreferredT1 = refU;
          manifoldHasPreferredT1 = true;

          let ad0 = abs(dot(incX, nRef));
          let ad1 = abs(dot(incY, nRef));
          let ad2 = abs(dot(incZ, nRef));
          incFeature = 0u;
          if (ad1 > ad0 && ad1 >= ad2) {
            incFeature = 1u;
          } else if (ad2 > ad0 && ad2 > ad1) {
            incFeature = 2u;
          }

          var incAxis = vec3f(0.0);
          var incU = vec3f(0.0);
          var incV = vec3f(0.0);
          var incH = 0.0;
          var incHU = 0.0;
          var incHV = 0.0;
          if (incFeature == 0u) {
            incAxis = incX; incU = incY; incV = incZ;
            incH = incHalf.x; incHU = incHalf.y; incHV = incHalf.z;
          } else if (incFeature == 1u) {
            incAxis = incY; incU = incX; incV = incZ;
            incH = incHalf.y; incHU = incHalf.x; incHV = incHalf.z;
          } else {
            incAxis = incZ; incU = incX; incV = incY;
            incH = incHalf.z; incHU = incHalf.x; incHV = incHalf.y;
          }

          // Incident face must oppose the reference normal.
          let incSign = select(1.0, -1.0, dot(incAxis, nRef) > 0.0);
          let incCenter = incPos + incAxis * (incSign * incH);

          var polyIn: array<vec3f, 8>;
          var polyOut: array<vec3f, 8>;
          polyIn[0] = incCenter + incU * incHU + incV * incHV;
          polyIn[1] = incCenter - incU * incHU + incV * incHV;
          polyIn[2] = incCenter - incU * incHU - incV * incHV;
          polyIn[3] = incCenter + incU * incHU - incV * incHV;
          var polyCount = 4u;

          for (var planeIdx = 0u; planeIdx < 4u; planeIdx++) {
            if (polyCount == 0u) { break; }

            var planeN = vec3f(0.0);
            var planeD = 0.0;
            if (planeIdx == 0u) {
              planeN = refU;
              planeD = dot(refU, refCenter) + refHU;
            } else if (planeIdx == 1u) {
              planeN = -refU;
              planeD = dot(-refU, refCenter) + refHU;
            } else if (planeIdx == 2u) {
              planeN = refV;
              planeD = dot(refV, refCenter) + refHV;
            } else {
              planeN = -refV;
              planeD = dot(-refV, refCenter) + refHV;
            }

            var outCount = 0u;
            for (var vi = 0u; vi < polyCount; vi++) {
              let a = polyIn[vi];
              let b = polyIn[(vi + 1u) % polyCount];
              let da = dot(planeN, a) - planeD;
              let db = dot(planeN, b) - planeD;
              let inA = da <= 0.0;
              let inB = db <= 0.0;

              if (inA && inB) {
                if (outCount < 8u) {
                  polyOut[outCount] = b;
                  outCount += 1u;
                }
              } else if (inA && !inB) {
                let denom = da - db;
                if (abs(denom) > 1e-6 && outCount < 8u) {
                  let t = da / denom;
                  polyOut[outCount] = a + (b - a) * t;
                  outCount += 1u;
                }
              } else if (!inA && inB) {
                let denom = da - db;
                if (abs(denom) > 1e-6 && outCount < 8u) {
                  let t = da / denom;
                  polyOut[outCount] = a + (b - a) * t;
                  outCount += 1u;
                }
                if (outCount < 8u) {
                  polyOut[outCount] = b;
                  outCount += 1u;
                }
              }
            }

            polyCount = outCount;
            for (var vi = 0u; vi < polyCount; vi++) {
              polyIn[vi] = polyOut[vi];
            }
          }

          for (var vi = 0u; vi < polyCount; vi++) {
            let p = polyIn[vi];
            // Signed distance to reference plane (outward normal = nRef).
            let dist = dot(nRef, p - refCenter);
            if (dist > contactSlop) { continue; }

            let pStored = max(-dist, 0.0);
            let pRef = p - nRef * dist;
            let xA = select(p, pRef, refIsA);
            let xB = select(pRef, p, refIsA);
            // Keep the manifold point at the midpoint for dedupe/reduction,
            // but store distinct surface anchors for A/B like the reference.
            let cp = 0.5 * (xA + xB);
            var duplicate = false;
            for (var c = 0u; c < candidateCount; c++) {
              let dd = cp - candidatePointWorld[c];
              if (dot(dd, dd) < 1e-6) {
                duplicate = true;
                if (pStored > candidatePenetration[c]) {
                  candidatePointWorld[c] = cp;
                  candidateRAWorld[c] = xA - posA;
                  candidateRBWorld[c] = xB - posB;
                  candidatePenetration[c] = pStored;
                }
              }
            }
            if (duplicate) { continue; }

            if (candidateCount < 8u) {
              candidatePointWorld[candidateCount] = cp;
              candidateRAWorld[candidateCount] = xA - posA;
              candidateRBWorld[candidateCount] = xB - posB;
              candidatePenetration[candidateCount] = pStored;
              candidateContactKey[candidateCount] = packFaceContactFeature(refIsA, refFeature, incFeature, min(vi, 7u));
              candidateCount += 1u;
            }
          }
        }

        if (candidateCount > ${pairManifoldSlots}u) {
          // 4-point manifold reduction heuristic:
          // 1) deepest, 2) farthest from deepest,
          // 3) max triangle area, 4) max min-distance from previous 3.
          var selectedIdx: array<u32, ${pairManifoldSlots}>;
          var selCount = 0u;

          var deepestIdx = 0u;
          var deepestPen = -1e30;
          for (var c = 0u; c < candidateCount; c++) {
            if (candidatePenetration[c] > deepestPen) {
              deepestPen = candidatePenetration[c];
              deepestIdx = c;
            }
          }
          selectedIdx[0] = deepestIdx;
          selCount = 1u;

          if (${pairManifoldSlots}u > 1u) {
            var farIdx = deepestIdx;
            var farD2 = -1.0;
            let p0 = candidatePointWorld[deepestIdx];
            for (var c = 0u; c < candidateCount; c++) {
              if (c == deepestIdx) { continue; }
              let dp = candidatePointWorld[c] - p0;
              let d2 = dot(dp, dp);
              if (d2 > farD2) {
                farD2 = d2;
                farIdx = c;
              }
            }
            selectedIdx[1] = farIdx;
            selCount = 2u;
          }

          if (${pairManifoldSlots}u > 2u) {
            var areaIdx = selectedIdx[0];
            var areaBest = -1.0;
            let p0 = candidatePointWorld[selectedIdx[0]];
            let p1 = candidatePointWorld[selectedIdx[1]];
            let base = p1 - p0;
            for (var c = 0u; c < candidateCount; c++) {
              if (c == selectedIdx[0] || c == selectedIdx[1]) { continue; }
              let v = candidatePointWorld[c] - p0;
              let cr = cross(base, v);
              let a2 = dot(cr, cr);
              if (a2 > areaBest) {
                areaBest = a2;
                areaIdx = c;
              }
            }
            selectedIdx[2] = areaIdx;
            selCount = 3u;
          }

          if (${pairManifoldSlots}u > 3u) {
            var spreadIdx = selectedIdx[0];
            var spreadBest = -1.0;
            for (var c = 0u; c < candidateCount; c++) {
              var used = false;
              for (var s = 0u; s < selCount; s++) {
                if (c == selectedIdx[s]) {
                  used = true;
                }
              }
              if (used) { continue; }

              var minD2 = 1e30;
              for (var s = 0u; s < selCount; s++) {
                let dp = candidatePointWorld[c] - candidatePointWorld[selectedIdx[s]];
                let d2 = dot(dp, dp);
                if (d2 < minD2) {
                  minD2 = d2;
                }
              }
              if (minD2 > spreadBest) {
                spreadBest = minD2;
                spreadIdx = c;
              }
            }
            selectedIdx[3] = spreadIdx;
            selCount = 4u;
          }

          var reducedPointWorld: array<vec3f, ${pairManifoldSlots}>;
          var reducedRAWorld: array<vec3f, ${pairManifoldSlots}>;
          var reducedRBWorld: array<vec3f, ${pairManifoldSlots}>;
          var reducedPenetration: array<f32, ${pairManifoldSlots}>;
          var reducedContactKey: array<u32, ${pairManifoldSlots}>;
          for (var s = 0u; s < ${pairManifoldSlots}u; s++) {
            let idx = selectedIdx[s];
            reducedPointWorld[s] = candidatePointWorld[idx];
            reducedRAWorld[s] = candidateRAWorld[idx];
            reducedRBWorld[s] = candidateRBWorld[idx];
            reducedPenetration[s] = candidatePenetration[idx];
            reducedContactKey[s] = candidateContactKey[idx];
          }
          for (var s = 0u; s < ${pairManifoldSlots}u; s++) {
            candidatePointWorld[s] = reducedPointWorld[s];
            candidateRAWorld[s] = reducedRAWorld[s];
            candidateRBWorld[s] = reducedRBWorld[s];
            candidatePenetration[s] = reducedPenetration[s];
            candidateContactKey[s] = reducedContactKey[s];
          }
          candidateCount = ${pairManifoldSlots}u;
        }

        if (candidateCount == 0u) {
          if (debugEnabled > 0u && isFloorPair) {
            atomicAdd(&debugCounters[10], 1u);
          }
          // Degenerate face clipping fallback.
          let pA = obbSupport(posA, qA, halfA, bestNormal);
          let pB = obbSupport(posB, qB, halfB, -bestNormal);
          candidatePointWorld[0] = 0.5 * (pA + pB);
          candidateRAWorld[0] = pA - posA;
          candidateRBWorld[0] = pB - posB;
          candidatePenetration[0] = storedPenetration;
          candidateContactKey[0] = packFaceContactFeature(refIsA, refFeature, incFeature, 0u);
          candidateCount = 1u;
        }

        // Match the reference demo's compact manifold behavior more closely by
        // removing duplicate contact samples before persistent slot assignment.
        // The fixed-slot GPU backing store still keeps up to pairManifoldSlots
        // contacts, but each physical contact should appear at most once.
        if (candidateCount > 1u) {
          var compactPointWorld: array<vec3f, 8>;
          var compactRAWorld: array<vec3f, 8>;
          var compactRBWorld: array<vec3f, 8>;
          var compactPenetration: array<f32, 8>;
          var compactContactKey: array<u32, 8>;
          var compactCount = 0u;

          for (var c = 0u; c < candidateCount; c++) {
            let candidatePoint = candidatePointWorld[c];
            let candidateRA = candidateRAWorld[c];
            let candidateRB = candidateRBWorld[c];
            let candidatePen = candidatePenetration[c];
            let candidateKey = candidateContactKey[c];

            var duplicateIdx = 0xffffffffu;
            for (var k = 0u; k < compactCount; k++) {
              let dp = candidatePoint - compactPointWorld[k];
              let d2 = dot(dp, dp);
              if (d2 < 1e-6) {
                duplicateIdx = k;
                break;
              }
            }

            if (duplicateIdx != 0xffffffffu) {
              // Match the reference addContact behavior: keep the first
              // clipped-polygon contact and ignore later near-duplicate rows
              // instead of replacing them with a deeper sample.
              continue;
            }

            compactPointWorld[compactCount] = candidatePoint;
            compactRAWorld[compactCount] = candidateRA;
            compactRBWorld[compactCount] = candidateRB;
            compactPenetration[compactCount] = candidatePen;
            compactContactKey[compactCount] = candidateKey;
            compactCount += 1u;
          }

          for (var c = 0u; c < compactCount; c++) {
            candidatePointWorld[c] = compactPointWorld[c];
            candidateRAWorld[c] = compactRAWorld[c];
            candidateRBWorld[c] = compactRBWorld[c];
            candidatePenetration[c] = compactPenetration[c];
            candidateContactKey[c] = compactContactKey[c];
          }
          candidateCount = compactCount;
        }

        if (candidateCount > 1u) {
          // Preserve a deterministic in-manifold ordinal closer to the reference
          // contact list semantics instead of the reduction-selection order.
          for (var passIdx = 0u; passIdx < 8u; passIdx++) {
            if (passIdx + 1u >= candidateCount) { break; }
            let last = candidateCount - 1u - passIdx;
            for (var idx = 0u; idx < 8u; idx++) {
              if (idx >= last) { break; }
              let next = idx + 1u;
              let leftKey = candidateContactKey[idx];
              let rightKey = candidateContactKey[next];
              var shouldSwap = leftKey > rightKey;
              if (!shouldSwap && leftKey == rightKey) {
                shouldSwap = candidatePenetration[idx] < candidatePenetration[next];
              }
              if (!shouldSwap) { continue; }

              let swapPoint = candidatePointWorld[idx];
              candidatePointWorld[idx] = candidatePointWorld[next];
              candidatePointWorld[next] = swapPoint;

              let swapRA = candidateRAWorld[idx];
              candidateRAWorld[idx] = candidateRAWorld[next];
              candidateRAWorld[next] = swapRA;

              let swapRB = candidateRBWorld[idx];
              candidateRBWorld[idx] = candidateRBWorld[next];
              candidateRBWorld[next] = swapRB;

              let swapPen = candidatePenetration[idx];
              candidatePenetration[idx] = candidatePenetration[next];
              candidatePenetration[next] = swapPen;

              let swapKey = candidateContactKey[idx];
              candidateContactKey[idx] = candidateContactKey[next];
              candidateContactKey[next] = swapKey;
            }
          }
        }

        if (bestFeature < 6 && candidateCount > 0u) {
          // Match avbd-demo3d contact identity more closely: assign the final
          // face-contact ordinal only after manifold reduction/compaction and
          // deterministic sorting, so each stored row gets a unique feature
          // key within the manifold.
          for (var c = 0u; c < candidateCount; c++) {
            candidateContactKey[c] = packFaceContactFeature(refIsA, refFeature, incFeature, c);
          }
        }

        let staleBand = contactSlop + hysteresis;
        let separatingKeepBand = 0.25 * staleBand;
        let separatingKeepMinNormal = 2.0;
        // Tangential drift pruning removes ghost contacts from rotating pairs.
        // Lower thresholds are safer but can look softer (more manifold churn).
        let maxDrift = max(3.5 * contactSlop, 0.016);
        let maxDrift2 = maxDrift * maxDrift;
        let normalThreshold = 0.95;
        let invalidSlot = 0xffffffffu;
        let warmstartReasonNone = 0u;
        let warmstartReasonExactFeature = 1u;
        let warmstartReasonNormalGate = 3u;
        let warmstartReasonInactiveSlot = 4u;
        let manifoldStickCooldown = 0u;
        var manifoldTangentBasis = canonicalTangentBasis(bestNormal);
        if (manifoldHasPreferredT1) {
          manifoldTangentBasis = tangentBasisFromPreferredT1(bestNormal, manifoldPreferredT1);
        }
        var manifoldTangentAngle = tangentBasisAngleFromT1(bestNormal, manifoldTangentBasis.t1);

        // Snapshot the previous manifold state so the new compact manifold can
        // exact-match against last frame without depending on slot continuity.
        var prevSlotActive: array<u32, ${pairManifoldSlots}>;
        var prevSlotMeta: array<vec4f, ${pairManifoldSlots}>;
        var prevSlotArmA: array<vec4f, ${pairManifoldSlots}>;
        var prevSlotArmB: array<vec4f, ${pairManifoldSlots}>;
        for (var s = 0u; s < ${pairManifoldSlots}u; s++) {
          let slot = pairBase + s;
          let slotInfo = loadContactMeta(pairContacts, slot);
          let slotActive = select(0u, 1u, slotInfo.z >= 0.5);
          prevSlotActive[s] = slotActive;
          prevSlotMeta[s] = slotInfo;
          if (slotActive > 0u) {
            prevSlotArmA[s] = loadContactArmA(pairContacts, slot);
            prevSlotArmB[s] = loadContactArmB(pairContacts, slot);
          }
        }

        var prevSlotMatched: array<u32, ${pairManifoldSlots}>;
        var candidatePrevSlot: array<u32, ${pairManifoldSlots}>;
        var candidateWarmstartReason: array<u32, ${pairManifoldSlots}>;
        for (var s = 0u; s < ${pairManifoldSlots}u; s++) {
          prevSlotMatched[s] = 0u;
          candidatePrevSlot[s] = invalidSlot;
          candidateWarmstartReason[s] = warmstartReasonNone;
        }

        for (var c = 0u; c < candidateCount; c++) {
          let candidatePoint = candidatePointWorld[c];
          let candidateFeatureKey = candidateContactKey[c];
          var bestSlot = invalidSlot;
          var bestD2 = 1e30;
          for (var s = 0u; s < ${pairManifoldSlots}u; s++) {
            if (prevSlotActive[s] == 0u || prevSlotMatched[s] != 0u) { continue; }
            if (decodePackedContactFeatureKey(prevSlotMeta[s].w) != candidateFeatureKey) { continue; }
            let oldRAStored = prevSlotArmA[s].xyz;
            let oldRBStored = prevSlotArmB[s].xyz;
            let oldRA = qrot(qA, oldRAStored);
            let oldRB = qrot(qB, oldRBStored);
            let oldPoint = 0.5 * ((posA + oldRA) + (posB + oldRB));
            let dp = candidatePoint - oldPoint;
            let d2 = dot(dp, dp);
            if (d2 < bestD2) {
              bestD2 = d2;
              bestSlot = s;
            }
          }
          if (bestSlot != invalidSlot) {
            prevSlotMatched[bestSlot] = 1u;
            candidatePrevSlot[c] = bestSlot;
            candidateWarmstartReason[c] = warmstartReasonExactFeature;
          }
        }

        var exactMatchPreferredT1 = vec3f(0.0);
        var exactMatchPreferredCount = 0u;
        for (var c = 0u; c < candidateCount; c++) {
          let matchedPrevSlot = candidatePrevSlot[c];
          if (matchedPrevSlot == invalidSlot) { continue; }
          if (candidateWarmstartReason[c] != warmstartReasonExactFeature) { continue; }
          let prevNormal = loadContactNormalPen(pairContacts, pairBase + matchedPrevSlot).xyz;
          let prevTangentAngle = prevSlotArmA[matchedPrevSlot].w;
          let prevBasis = tangentBasisFromAngle(prevNormal, prevTangentAngle);
          exactMatchPreferredT1 += prevBasis.t1;
          exactMatchPreferredCount += 1u;
        }
        // Preserve manifold-level tangent sign continuity for exact matched
        // manifolds without abandoning the shared-basis convention.
        if (
          exactMatchPreferredCount > 0u
          && dot(exactMatchPreferredT1, manifoldTangentBasis.t1) < 0.0
        ) {
          manifoldTangentBasis = TangentBasis(-manifoldTangentBasis.t1, -manifoldTangentBasis.t2);
          manifoldTangentAngle = tangentBasisAngleFromT1(bestNormal, manifoldTangentBasis.t1);
          if (debugEnabled > 0u) {
            atomicAdd(&debugCounters[6], 1u);
          }
        }

        var writeCount = 0u;
        for (var c = 0u; c < candidateCount; c++) {
          let candidatePoint = candidatePointWorld[c];
          let candidateFeatureKey = candidateContactKey[c];
          let raWorld = candidateRAWorld[c];
          let rbWorld = candidateRBWorld[c];
          var contactRAWorld = raWorld;
          var contactRBWorld = rbWorld;
          var candidateStoredPen = candidatePenetration[c];
          let matchedPrevSlot = candidatePrevSlot[c];
          let matchedPrevContact = pairBase + matchedPrevSlot;
          let preserveWarmstart = matchedPrevSlot != invalidSlot;
          var warmstartDebugReason = candidateWarmstartReason[c];
          var tangentBasis = manifoldTangentBasis;
          var useStickingPoint = false;
          var canWarmstart = false;
          var exactFeatureWarmstart = false;
          var carryStick = 0u;
          var carryStickAnchorReuse = 0u;
          var lambdaNKeep = 0.0;
          var lambdaT = vec2f(0.0, 0.0);
          var carriedC0T = vec2f(0.0, 0.0);
          var useCarriedC0T = false;
          var carriedShadow = vec4f(0.0);
          var carriedDual = vec4f(0.0);
          var carriedPenalty = vec4f(1.0, 1.0, 1.0, frictionScale);

          if (preserveWarmstart) {
            let prevInfo = prevSlotMeta[matchedPrevSlot];
            let prevNormalPen = loadContactNormalPen(pairContacts, matchedPrevContact);
            let prevNormal = prevNormalPen.xyz;
            let prevFeature = i32(decodePackedBaseFeature(prevInfo.w));
            let prevFeatureKey = decodePackedContactFeatureKey(prevInfo.w);
            let prevStick = decodePackedStick(prevInfo.w);
            let prevTangentAngle = prevSlotArmA[matchedPrevSlot].w;
            let sameFeature = prevFeatureKey == candidateFeatureKey;
            exactFeatureWarmstart = sameFeature;
            var matchNormalDot = dot(prevNormal, bestNormal);
            if ((prevFeature >= 6) != (bestFeature >= 6)) {
              matchNormalDot = -1.0;
            }

            // Exact-key matches reuse prior state like the reference compact
            // manifold merge, while still requiring normal agreement.
            canWarmstart = preserveWarmstart && select(
              matchNormalDot > normalThreshold,
              true,
              sameFeature,
            );
            if (!canWarmstart) {
              warmstartDebugReason = warmstartReasonNormalGate;
            }

            if (canWarmstart) {
              let oldRAStored = prevSlotArmA[matchedPrevSlot].xyz;
              let oldRBStored = prevSlotArmB[matchedPrevSlot].xyz;
              let oldRA = qrot(qA, oldRAStored);
              let oldRB = qrot(qB, oldRBStored);
              let oldPointA = posA + oldRA;
              let oldPointB = posB + oldRB;
              useStickingPoint = prevStick > 0u && sameFeature && !specialPair;
              if (useStickingPoint) {
                if (debugEnabled > 0u) {
                  atomicAdd(&debugCounters[5], 1u);
                }
                // avbd-demo3d parity: exact sticky matches keep the old
                // anchors; otherwise the matched contact keeps the new anchors
                // and C0 is recomputed from whichever anchors were chosen.
                contactRAWorld = oldRA;
                contactRBWorld = oldRB;
                candidateStoredPen = max(
                  -dot((posB + contactRBWorld) - (posA + contactRAWorld), bestNormal),
                  0.0,
                );
              }
              carryStick = select(0u, prevStick, sameFeature && !specialPair);
              carryStickAnchorReuse = select(0u, 1u, useStickingPoint);
              let prevShadow = loadContactShadow(pairContacts, matchedPrevContact);
              let prevDual = loadContactDual(pairContacts, matchedPrevContact);
              lambdaNKeep = max(prevShadow.x, 0.0);
              carriedShadow = prevShadow;
              carriedDual = prevDual;
              carriedPenalty = loadContactPenalty(pairContacts, matchedPrevContact);

              let warmFriction = frictionStatic * frictionScale;
              let prevNLen2 = dot(prevNormal, prevNormal);
              let writeTangentBasis = tangentBasisFromAngle(bestNormal, manifoldTangentAngle);
              if (prevNLen2 > 1e-10) {
                let prevBasis = tangentBasisFromAngle(prevNormal, prevTangentAngle);
                let jtWorld = prevBasis.t1 * prevShadow.y + prevBasis.t2 * prevShadow.z;
                lambdaT = vec2f(
                  dot(jtWorld, writeTangentBasis.t1),
                  dot(jtWorld, writeTangentBasis.t2),
                );
                let maxT = warmFriction * lambdaNKeep;
                let maxT2 = maxT * maxT;
                let lt2 = dot(lambdaT, lambdaT);
                if (lt2 > maxT2 && lt2 > 1e-12) {
                  lambdaT *= maxT * inverseSqrt(lt2);
                }
                carriedShadow = vec4f(lambdaNKeep, lambdaT.x, lambdaT.y, prevShadow.w);
                let prevC0TB = loadContactConstraintC0(pairContacts, matchedPrevContact).yz;
                let c0TWorld = prevBasis.t1 * prevC0TB.x + prevBasis.t2 * prevC0TB.y;
                carriedC0T = vec2f(
                  dot(c0TWorld, writeTangentBasis.t1),
                  dot(c0TWorld, writeTangentBasis.t2),
                );
                useCarriedC0T = sameFeature;
                let prevDualTB = prevDual.yz;
                let dualTWorld = prevBasis.t1 * prevDualTB.x + prevBasis.t2 * prevDualTB.y;
                let rotatedDualTB = vec2f(
                  dot(dualTWorld, writeTangentBasis.t1),
                    dot(dualTWorld, writeTangentBasis.t2),
                );
                carriedDual = vec4f(prevDual.x, rotatedDualTB, 0.0);
              }
            }
          } else {
            warmstartDebugReason = warmstartReasonInactiveSlot;
          }

          let finalPointA = posA + contactRAWorld;
          let finalPointB = posB + contactRBWorld;
          let finalRawPen = -dot(finalPointB - finalPointA, bestNormal);
          if (finalRawPen < 0.0) {
            if (debugEnabled > 0u && useStickingPoint) {
              atomicAdd(&debugCounters[4], 1u);
            }
            continue;
          }
          candidateStoredPen = max(finalRawPen, 0.0);

          let writeTangentBasis = tangentBasisFromAngle(bestNormal, manifoldTangentAngle);
          let tangentAngle = manifoldTangentAngle;
          let normalContactMargin = ${AVBD_COLLISION_MARGIN};
          let cachedC0Vec = finalPointA - finalPointB;
          let cachedC0N = -dot(cachedC0Vec, bestNormal) + normalContactMargin;
          var cachedC0T1 = dot(cachedC0Vec, writeTangentBasis.t1);
          var cachedC0T2 = dot(cachedC0Vec, writeTangentBasis.t2);
          if (canWarmstart && exactFeatureWarmstart && useCarriedC0T) {
            cachedC0T1 = carriedC0T.x;
            cachedC0T2 = carriedC0T.y;
          }
          let storedRA = qrot(qconj(qA), contactRAWorld);
          let storedRB = qrot(qconj(qB), contactRBWorld);
          let targetIndex = pairBase + writeCount;
          // Preserve the actual pair/manifold slot order seen by the contact
          // pipeline instead of reconstructing a synthetic rank from (i, j).
          let manifoldSequence = manifold;
          storeContactMeta(pairContacts, targetIndex, vec4f(
            f32(i),
            f32(j),
            f32(manifoldSequence + 1u),
            packContactInfo(
              candidateFeatureKey,
              manifoldStickCooldown,
              select(0u, 1u, canWarmstart),
              carryStick,
              carryStickAnchorReuse,
              warmstartDebugReason,
            ),
          ));
          storeContactNormalPen(pairContacts, targetIndex, vec4f(bestNormal, candidateStoredPen));
          storeContactArmA(pairContacts, targetIndex, vec4f(storedRA, tangentAngle));
          storeContactArmB(pairContacts, targetIndex, vec4f(storedRB, 0.0));
          storeContactConstraintC0(pairContacts, targetIndex, vec4f(cachedC0N, cachedC0T1, cachedC0T2, 0.0));
          if (canWarmstart && exactFeatureWarmstart && matchedPrevSlot != invalidSlot) {
            // avbd-demo3d parity: exact matches carry the previous contact
            // object into the new slot first, then geometry/C0 are refreshed
            // from the chosen anchors above.
            storeContactShadow(pairContacts, targetIndex, carriedShadow);
            storeContactDual(pairContacts, targetIndex, carriedDual);
            storeContactPenalty(pairContacts, targetIndex, carriedPenalty);
            storeContactCache(pairContacts, targetIndex, loadContactCache(pairContacts, matchedPrevContact));
          } else {
            // Unmatched rows start fresh; prepareState owns any
            // subsequent warmstart decision.
            storeContactShadow(pairContacts, targetIndex, select(
              vec4f(0.0, 0.0, 0.0, frictionScale),
              vec4f(lambdaNKeep, lambdaT.x, lambdaT.y, frictionScale),
              canWarmstart,
            ));
            storeContactDual(pairContacts, targetIndex, vec4f(0.0));
            storeContactPenalty(pairContacts, targetIndex, vec4f(1.0, 1.0, 1.0, frictionScale));
            storeContactCacheWord(pairContacts, targetIndex, 0u);
          }
          writeCount += 1u;
        }

        for (var s = writeCount; s < ${pairManifoldSlots}u; s++) {
          deactivateContactSlot(pairContacts, pairBase + s, f32(i), f32(j));
        }

        if (debugEnabled > 0u && isFloorPair) {
          if (writeCount == 0u) {
            atomicAdd(&debugCounters[11], 1u);
          } else {
            atomicAdd(&debugCounters[12], 1u);
          }
        }
      }

      fn deactivateContactSlot(
        pairContacts: ptr<storage, array<vec4f>, read_write>,
        slot: u32,
        pairI: f32,
        pairJ: f32,
      ) {
        storeContactMeta(pairContacts, slot, vec4f(pairI, pairJ, 0.0, 0.0));
        storeContactCacheWord(pairContacts, slot, 0u);
      }

      fn deactivateManifold(
        pairContacts: ptr<storage, array<vec4f>, read_write>,
        pairBase: u32,
        pairI: f32,
        pairJ: f32,
      ) {
        for (var s = 0u; s < ${pairManifoldSlots}u; s++) {
          deactivateContactSlot(pairContacts, pairBase + s, pairI, pairJ);
        }
      }

      fn packFaceContactFeature(referenceIsA: bool, referenceAxis: u32, incidentAxis: u32, ordinal: u32) -> u32 {
        let featureType = select(1u, 0u, referenceIsA);
        return (ordinal & 0x7u)
          | ((incidentAxis & 0x3u) << 3u)
          | ((referenceAxis & 0x3u) << 5u)
          | ((featureType & 0x3u) << 7u);
      }

      fn packEdgeContactFeature(axisA: u32, axisB: u32) -> u32 {
        return ((axisB & 0x3u) << 3u)
          | ((axisA & 0x3u) << 5u)
          | (2u << 7u);
      }

      fn axisValue3(v: vec3f, axis: u32) -> f32 {
        if (axis == 0u) { return v.x; }
        if (axis == 1u) { return v.y; }
        return v.z;
      }

      fn axisVector3(axis: u32, axis0: vec3f, axis1: vec3f, axis2: vec3f) -> vec3f {
        if (axis == 0u) { return axis0; }
        if (axis == 1u) { return axis1; }
        return axis2;
      }

      fn dominantAbsAxis3(v: vec3f) -> u32 {
        let av = abs(v);
        if (av.y > av.x && av.y >= av.z) { return 1u; }
        if (av.z > av.x && av.z > av.y) { return 2u; }
        return 0u;
      }

      fn leastAxis3(v: vec3f) -> u32 {
        if (v.y < v.x && v.y <= v.z) { return 1u; }
        if (v.z < v.x && v.z < v.y) { return 2u; }
        return 0u;
      }

      fn decodePackedContactFeatureKey(encoded: f32) -> u32 {
        return bitcast<u32>(encoded) & 0x1FFu;
      }

      fn decodePackedContactFeatureTypeKey(featureKey: u32) -> u32 {
        return (featureKey >> 7u) & 0x3u;
      }

      fn decodePackedBaseFeature(encoded: f32) -> u32 {
        let featureKey = decodePackedContactFeatureKey(encoded);
        let featureType = decodePackedContactFeatureTypeKey(featureKey);
        let referenceAxis = (featureKey >> 5u) & 0x3u;
        let incidentAxis = (featureKey >> 3u) & 0x3u;
        if (featureType == 0u) {
          return referenceAxis;
        }
        if (featureType == 1u) {
          return 3u + referenceAxis;
        }
        return 6u + referenceAxis * 3u + incidentAxis;
      }

      fn decodePackedCooldown(encoded: f32) -> u32 {
        return (bitcast<u32>(encoded) >> 9u) & 0x7Fu;
      }

      fn decodePackedStick(encoded: f32) -> u32 {
        return (bitcast<u32>(encoded) >> 17u) & 0x1u;
      }

	      fn decodePackedStickAnchorReuse(encoded: f32) -> u32 {
	        return (bitcast<u32>(encoded) >> 18u) & 0x1u;
	      }

	      fn decodePackedWarmstartDebugReason(encoded: f32) -> u32 {
	        return (bitcast<u32>(encoded) >> 21u) & 0x7u;
	      }

      fn packContactInfo(
        featureKey: u32,
        cooldown: u32,
        preserveWarmstart: u32,
        stick: u32,
        stickAnchorReuse: u32,
        warmstartDebugReason: u32,
      ) -> f32 {
        return bitcast<f32>(
          (featureKey & 0x1FFu)
          | ((cooldown & 0x7Fu) << 9u)
          | ((preserveWarmstart & 0x1u) << 16u)
          | ((stick & 0x1u) << 17u)
          | ((stickAnchorReuse & 0x1u) << 18u)
          | ((warmstartDebugReason & 0x7u) << 21u),
        );
      }

      struct SegResult {
        p: vec3f,
        q: vec3f,
      };

      fn sgnnz(x: f32) -> f32 {
        return select(1.0, -1.0, x < 0.0);
      }

      fn closestPointsSegments(p0: vec3f, p1: vec3f, q0: vec3f, q1: vec3f) -> SegResult {
        let u = p1 - p0;
        let v = q1 - q0;
        let w0 = p0 - q0;

        let a = dot(u, u);
        let b = dot(u, v);
        let c = dot(v, v);
        let d = dot(u, w0);
        let e = dot(v, w0);

        let D = a * c - b * b;
        let EPS = 1e-6;

        var sN: f32;
        var sD = D;
        var tN: f32;
        var tD = D;

        if (D < EPS) {
          sN = 0.0;
          sD = 1.0;
          tN = e;
          tD = c;
        } else {
          sN = b * e - c * d;
          tN = a * e - b * d;

          if (sN < 0.0) {
            sN = 0.0;
            tN = e;
            tD = c;
          } else if (sN > sD) {
            sN = sD;
            tN = e + b;
            tD = c;
          }
        }

        if (tN < 0.0) {
          tN = 0.0;
          if (-d < 0.0) {
            sN = 0.0;
          } else if (-d > a) {
            sN = sD;
          } else {
            sN = -d;
            sD = a;
          }
        } else if (tN > tD) {
          tN = tD;
          if (-d + b < 0.0) {
            sN = 0.0;
          } else if (-d + b > a) {
            sN = sD;
          } else {
            sN = -d + b;
            sD = a;
          }
        }

        let sc = select(0.0, sN / sD, abs(sN) > EPS);
        let tc = select(0.0, tN / tD, abs(tN) > EPS);

        let p = p0 + sc * u;
        let q = q0 + tc * v;
        return SegResult(p, q);
      }
    `;

    const pairShader = wgslFn(
      pairShaderSource,
      [qrot, qconj, obbSupport, tangentBasisHelpers, contactRecordHelpers, shapeEncodingHelpers],
    );

    const pairKernelStorageBuffers = 6;
    assertStorageBufferBudget('Contact Pair Generate', pairKernelStorageBuffers);

    this.pairKernel = pairShader({
      positions: storage(positions, 'vec4f', maxBodies).toReadOnly(),
      quaternions: storage(quaternions, 'vec4f', maxBodies).toReadOnly(),
      shapes: storage(shapes, 'vec4f', maxBodies).toReadOnly(),
      pairContacts: storage(pairContacts, 'vec4f', maxPairContacts * CONTACT_RECORD_VEC4S),
      pairActivity: storage(pairActivity, 'uint', pairActivityWordCount),
      debugCounters: storage(this.debugCountersAttr, 'uint', 27).toAtomic(),
      debugEnabled: uniform(0),
      bodyCount: uniform(0),
      pairCount: uniform(0),
      pairDispatchCount: uniform(0),
      useCandidatePairs: uniform(0),
      floorDebugBody: uniform(0xffffffff),
      contactSlop: uniform(0.005),
      frictionStatic: uniform(AVBD_FRICTION_STATIC),
      workgroupId,
      localId,
    }).computeKernel([WORKGROUP_SIZE, 1, 1]).setName('Contact Pair Generate');

    this.pairKernelDebug = pairShader({
      positions: storage(positions, 'vec4f', maxBodies).toReadOnly(),
      quaternions: storage(quaternions, 'vec4f', maxBodies).toReadOnly(),
      shapes: storage(shapes, 'vec4f', maxBodies).toReadOnly(),
      pairContacts: storage(pairContacts, 'vec4f', maxPairContacts * CONTACT_RECORD_VEC4S),
      pairActivity: storage(pairActivity, 'uint', pairActivityWordCount),
      debugCounters: storage(this.debugCountersAttr, 'uint', 27).toAtomic(),
      debugEnabled: uniform(0),
      bodyCount: uniform(0),
      pairCount: uniform(0),
      pairDispatchCount: uniform(0),
      useCandidatePairs: uniform(0),
      floorDebugBody: uniform(0xffffffff),
      contactSlop: uniform(0.005),
      frictionStatic: uniform(AVBD_FRICTION_STATIC),
      workgroupId,
      localId,
    }).computeKernel([WORKGROUP_SIZE, 1, 1]).setName('Contact Pair Generate');

    const clearPairBodyCountsShader = wgslFn(/* wgsl */`
      fn compute(
        pairBodyContactCounts: ptr<storage, array<atomic<u32>>, read_write>,
        pairActivity: ptr<storage, array<atomic<u32>>, read_write>,
        bodyCount: u32,
        workgroupId: vec3u,
        localId: vec3u,
      ) -> void {
        let gid = workgroupId.x * ${WORKGROUP_SIZE}u + localId.x;
        if (gid == 0u) {
          atomicStore(&pairActivity[${pairActiveContactsOffset}u], 0u);
        }
        if (gid >= bodyCount) { return; }
        atomicStore(&pairBodyContactCounts[gid], 0u);
      }
    `);

    this.clearPairBodyCountsKernel = clearPairBodyCountsShader({
      pairBodyContactCounts: storage(pairBodyContactCounts, 'uint', maxBodies).toAtomic(),
      pairActivity: storage(pairActivity, 'uint', pairActivityWordCount).toAtomic(),
      bodyCount: uniform(0),
      workgroupId,
      localId,
    }).computeKernel([WORKGROUP_SIZE, 1, 1]).setName('Contact Clear Body Counts');

    const clearDebugCountersShader = wgslFn(/* wgsl */`
      fn compute(
        debugCounters: ptr<storage, array<atomic<u32>>, read_write>,
        debugEnabled: u32,
      ) -> void {
        if (debugEnabled == 0u) { return; }
        for (var i = 0u; i < 27u; i++) {
          atomicStore(&debugCounters[i], 0u);
        }
      }
    `);

    this.clearDebugCountersKernel = clearDebugCountersShader({
      debugCounters: storage(this.debugCountersAttr, 'uint', 27).toAtomic(),
      debugEnabled: uniform(0),
    }).computeKernel([1, 1, 1]).setName('Contact Clear Debug Counters');

    const clearActiveCandidateSlotsShader = wgslFn(/* wgsl */`
      fn compute(
        pairActivity: ptr<storage, array<atomic<u32>>, read_write>,
      ) -> void {
        atomicStore(&pairActivity[${pairActiveCandidateSlotsOffset}u], 0u);
      }
    `);

    this.clearActiveCandidateSlotsKernel = clearActiveCandidateSlotsShader({
      pairActivity: storage(pairActivity, 'uint', pairActivityWordCount).toAtomic(),
    }).computeKernel([1, 1, 1]).setName('Contact Clear Active Candidate Slots');

    const buildActiveCandidateSlotsShader = wgslFn(/* wgsl */`
      fn compute(
        pairActivity: ptr<storage, array<atomic<u32>>, read_write>,
        pairCount: u32,
        pairDispatchCount: u32,
        useCandidatePairs: u32,
        workgroupId: vec3u,
        localId: vec3u,
      ) -> void {
        let gid = workgroupId.x * ${WORKGROUP_SIZE}u + localId.x;
        if (gid >= pairDispatchCount) { return; }

        var manifold = gid;
        if (useCandidatePairs > 0u) {
          let packedPair = atomicLoad(&pairActivity[${pairCandidateIndicesOffset}u + gid + 1u]);
          let i = packedPair & 0xFFFFu;
          let j = packedPair >> 16u;
          if (i >= j) { return; }
        } else {
          if (gid >= pairCount) { return; }
          if (gid >= ${maxPairDispatchPairs}u) { return; }
        }

        let outIndex = atomicAdd(&pairActivity[${pairActiveCandidateSlotsOffset}u], 1u);
        if (outIndex < ${maxPairDispatchPairs}u) {
          atomicStore(&pairActivity[${pairActiveCandidateSlotsOffset}u + outIndex + 1u], manifold);
        }
      }
    `);

    this.buildActiveCandidateSlotsKernel = buildActiveCandidateSlotsShader({
      pairActivity: storage(pairActivity, 'uint', pairActivityWordCount).toAtomic(),
      pairCount: uniform(0),
      pairDispatchCount: uniform(0),
      useCandidatePairs: uniform(0),
      workgroupId,
      localId,
    }).computeKernel([WORKGROUP_SIZE, 1, 1]).setName('Contact Build Active Candidate Slots');

    const buildPairDispatchArgsShader = wgslFn(/* wgsl */`
      fn compute(
        pairActivity: ptr<storage, array<u32>, read_write>,
        pairDispatchIndirect: ptr<storage, array<u32>, read_write>,
        pairDispatchCount: u32,
      ) -> void {
        let dispatchThreads = min(pairActivity[${pairActiveCandidateSlotsOffset}u], pairDispatchCount);

        let workgroups = (dispatchThreads + ${WORKGROUP_SIZE}u - 1u) / ${WORKGROUP_SIZE}u;
        pairDispatchIndirect[0] = workgroups;
        pairDispatchIndirect[1] = 1u;
        pairDispatchIndirect[2] = 1u;
      }
    `);

    this.buildPairDispatchArgsKernel = buildPairDispatchArgsShader({
      pairActivity: storage(pairActivity, 'uint', pairActivityWordCount),
      pairDispatchIndirect: storage(this.pairDispatchIndirectAttr, 'uint', 3),
      pairDispatchCount: uniform(0),
    }).computeKernel([1, 1, 1]).setName('Contact Build Dispatch Args');

    const buildPairBodyListsShaderSource = /* wgsl */`
      fn compute(
        pairContacts: ptr<storage, array<vec4f>, read_write>,
        positions: ptr<storage, array<vec4f>, read>,
        pairActivity: ptr<storage, array<atomic<u32>>, read_write>,
        pairBodyContactCounts: ptr<storage, array<atomic<u32>>, read_write>,
        pairBodyContactIndices: ptr<storage, array<u32>, read_write>,
        debugCounters: ptr<storage, array<atomic<u32>>, read_write>,
        bodyCount: u32,
        pairDispatchCount: u32,
        debugEnabled: u32,
        workgroupId: vec3u,
        localId: vec3u,
      ) -> void {
        let gid = workgroupId.x * ${WORKGROUP_SIZE}u + localId.x;
        let activeCandidateCount = min(atomicLoad(&pairActivity[${pairActiveCandidateSlotsOffset}u]), pairDispatchCount);
        if (gid >= activeCandidateCount) { return; }
        let manifold = atomicLoad(&pairActivity[${pairActiveCandidateSlotsOffset}u + gid + 1u]);
        if (manifold >= pairDispatchCount) { return; }

        let pairBase = manifold * ${pairManifoldSlots}u;
        var manifoldHasActive = false;
        for (var s = 0u; s < ${pairManifoldSlots}u; s++) {
          let p = pairBase + s;
          let pairInfo = loadContactMeta(pairContacts, p);
          if (pairInfo.z < 0.5) { continue; }
          manifoldHasActive = true;

          let i = u32(pairInfo.x);
          let j = u32(pairInfo.y);
          if (i >= bodyCount || j >= bodyCount) { continue; }
          let dynamicI = positions[i].w > 0.0;
          let dynamicJ = positions[j].w > 0.0;
          if (!dynamicI && !dynamicJ) { continue; }

          var wroteI = false;
          var slotI = 0u;
          if (dynamicI) {
            slotI = atomicAdd(&pairBodyContactCounts[i], 1u);
            if (slotI < ${maxPairContactsPerBody}u) {
              pairBodyContactIndices[i * ${maxPairContactsPerBody}u + slotI] = p;
              wroteI = true;
            }
            if (slotI >= ${maxPairContactsPerBody}u && debugEnabled > 0u) {
              atomicAdd(&debugCounters[24], 1u);
            }
          }

          var wroteJ = false;
          var slotJ = 0u;
          if (dynamicJ) {
            slotJ = atomicAdd(&pairBodyContactCounts[j], 1u);
            if (slotJ < ${maxPairContactsPerBody}u) {
              pairBodyContactIndices[j * ${maxPairContactsPerBody}u + slotJ] = p;
              wroteJ = true;
            }
            if (slotJ >= ${maxPairContactsPerBody}u && debugEnabled > 0u) {
              atomicAdd(&debugCounters[24], 1u);
            }
          }

          var keepContact = false;
          if (dynamicI && dynamicJ) {
            // Dynamic-dynamic contacts require both bodies to store the slot.
            keepContact = wroteI && wroteJ;
            if (!keepContact) {
              if (debugEnabled > 0u) {
                atomicAdd(&debugCounters[25], 1u);
              }
              if (wroteI) {
                pairBodyContactIndices[i * ${maxPairContactsPerBody}u + slotI] = ${maxPairContacts}u;
              }
              if (wroteJ) {
                pairBodyContactIndices[j * ${maxPairContactsPerBody}u + slotJ] = ${maxPairContacts}u;
              }
            }
          } else if (dynamicI) {
            // Static-dynamic contacts are solved by the dynamic body only.
            keepContact = wroteI;
          } else if (dynamicJ) {
            keepContact = wroteJ;
          }

          if (keepContact) {
            // Build a compact active-contact list consumed by solver kernels.
            let activeWrite = atomicAdd(&pairActivity[${pairActiveContactsOffset}u], 1u);
            if (activeWrite < ${maxActivePairContacts}u) {
              atomicStore(&pairActivity[${pairActiveContactsOffset}u + activeWrite + 1u], p);
            } else if (debugEnabled > 0u) {
              atomicAdd(&debugCounters[26], 1u);
            }
          }
        }

        if (manifoldHasActive) {
          if (debugEnabled > 0u) {
            atomicAdd(&debugCounters[1], 1u);
          }
        }
      }
    `;

    const buildPairBodyListsShaderReleaseSource = buildPairBodyListsShaderSource
      .replace(
        `        debugCounters: ptr<storage, array<atomic<u32>>, read_write>,\n`,
        '',
      )
      .replace(
        `        debugEnabled: u32,\n`,
        '',
      )
      .replace(
        `          if (debugEnabled > 0u) {\n            atomicAdd(&debugCounters[1], 1u);\n          }\n`,
        '',
      )
      .replace(
        `            if (slotI >= ${maxPairContactsPerBody}u && debugEnabled > 0u) {\n              atomicAdd(&debugCounters[24], 1u);\n            }\n`,
        '',
      )
      .replace(
        `            if (slotJ >= ${maxPairContactsPerBody}u && debugEnabled > 0u) {\n              atomicAdd(&debugCounters[24], 1u);\n            }\n`,
        '',
      )
      .replace(
        `              if (debugEnabled > 0u) {\n                atomicAdd(&debugCounters[25], 1u);\n              }\n`,
        '',
      )
      .replace(
        `            } else if (debugEnabled > 0u) {\n              atomicAdd(&debugCounters[26], 1u);\n            }\n`,
        `            }\n`,
      );

    const buildPairBodyListsShaderDebug = wgslFn(buildPairBodyListsShaderSource, [contactRecordHelpers]);
    const buildPairBodyListsShaderRelease = wgslFn(buildPairBodyListsShaderReleaseSource, [contactRecordHelpers]);

    this.buildPairBodyListsKernel = buildPairBodyListsShaderRelease({
      pairContacts: storage(pairContacts, 'vec4f', maxPairContacts * CONTACT_RECORD_VEC4S),
      positions: storage(positions, 'vec4f', maxBodies).toReadOnly(),
      pairActivity: storage(pairActivity, 'uint', pairActivityWordCount).toAtomic(),
      pairBodyContactCounts: storage(pairBodyContactCounts, 'uint', maxBodies).toAtomic(),
      pairBodyContactIndices: storage(pairBodyContactIndices, 'uint', maxPairBodyContacts),
      bodyCount: uniform(0),
      pairDispatchCount: uniform(0),
      workgroupId,
      localId,
    }).computeKernel([WORKGROUP_SIZE, 1, 1]).setName('Contact Build Body Lists');

    this.buildPairBodyListsKernelDebug = buildPairBodyListsShaderDebug({
      pairContacts: storage(pairContacts, 'vec4f', maxPairContacts * CONTACT_RECORD_VEC4S),
      positions: storage(positions, 'vec4f', maxBodies).toReadOnly(),
      pairActivity: storage(pairActivity, 'uint', pairActivityWordCount).toAtomic(),
      pairBodyContactCounts: storage(pairBodyContactCounts, 'uint', maxBodies).toAtomic(),
      pairBodyContactIndices: storage(pairBodyContactIndices, 'uint', maxPairBodyContacts),
      debugCounters: storage(this.debugCountersAttr, 'uint', 27).toAtomic(),
      bodyCount: uniform(0),
      pairDispatchCount: uniform(0),
      debugEnabled: uniform(0),
      workgroupId,
      localId,
    }).computeKernel([WORKGROUP_SIZE, 1, 1]).setName('Contact Build Body Lists');

    const finalizeDebugCountersShader = wgslFn(/* wgsl */`
      fn compute(
        pairActivity: ptr<storage, array<u32>, read_write>,
        debugCounters: ptr<storage, array<atomic<u32>>, read_write>,
        debugEnabled: u32,
      ) -> void {
        if (debugEnabled == 0u) { return; }
        atomicStore(&debugCounters[2], pairActivity[${pairActiveCandidateSlotsOffset}u]);
      }
    `);

    this.finalizeDebugCountersKernel = finalizeDebugCountersShader({
      pairActivity: storage(pairActivity, 'uint', pairActivityWordCount),
      debugCounters: storage(this.debugCountersAttr, 'uint', 27).toAtomic(),
      debugEnabled: uniform(0),
    }).computeKernel([1, 1, 1]).setName('Contact Finalize Debug Counters');
  }

  setFriction(staticFriction: number): void {
    const clamped = Math.max(0.0, staticFriction);
    this.pairKernel.computeNode.parameters.frictionStatic.value = clamped;
    this.pairKernelDebug.computeNode.parameters.frictionStatic.value = clamped;
  }

  setDebugLogInterval(intervalFrames: number): void {
    this.debugEveryNFrames = Math.max(1, Math.floor(intervalFrames));
    this.lastDebugLogFrame = -1;
  }

  setDebugEnabled(enabled: boolean): void {
    this.debugEnabled = enabled;
    this.debugReadbackInFlight = false;
    this.lastDebugLogFrame = -1;
  }

  setFloorDebugBody(bodyIndex: number): void {
    this.floorDebugBody = Number.isFinite(bodyIndex) && bodyIndex >= 0
      ? Math.floor(bodyIndex)
      : 0xffffffff;
  }

  dispatch(
    renderer: any,
    bodyCount: number,
    pairCount: number,
    pairDispatchCount: number,
    useCandidatePairs: boolean,
    frameId: number,
  ): void {
    this.dispatchPairKernelPhase(
      renderer,
      bodyCount,
      pairCount,
      pairDispatchCount,
      useCandidatePairs,
    );
    this.dispatchBodyListPhase(renderer, bodyCount, pairDispatchCount, frameId);
  }

  dispatchPairKernelPhase(
    renderer: any,
    bodyCount: number,
    pairCount: number,
    pairDispatchCount: number,
    useCandidatePairs: boolean,
  ): void {
    const candidateFlag = useCandidatePairs ? 1 : 0;
    const debugFlag = this.debugEnabled ? 1 : 0;
    const pairKernel = debugFlag ? this.pairKernelDebug : this.pairKernel;
    const buildPairBodyListsKernel = debugFlag ? this.buildPairBodyListsKernelDebug : this.buildPairBodyListsKernel;

    pairKernel.computeNode.parameters.bodyCount.value = bodyCount;
    pairKernel.computeNode.parameters.pairCount.value = pairCount;
    pairKernel.computeNode.parameters.pairDispatchCount.value = pairDispatchCount;
    pairKernel.computeNode.parameters.useCandidatePairs.value = candidateFlag;
    if (debugFlag) {
      pairKernel.computeNode.parameters.floorDebugBody.value = this.floorDebugBody >>> 0;
      pairKernel.computeNode.parameters.debugEnabled.value = debugFlag;
    }
    this.clearDebugCountersKernel.computeNode.parameters.debugEnabled.value = debugFlag;

    this.clearPairBodyCountsKernel.computeNode.parameters.bodyCount.value = bodyCount;
    if (bodyCount > 0) {
      const bodyWorkgroups = Math.ceil(bodyCount / WORKGROUP_SIZE);
      renderer.compute(this.clearPairBodyCountsKernel, [bodyWorkgroups, 1, 1]);
    }

    buildPairBodyListsKernel.computeNode.parameters.bodyCount.value = bodyCount;
    buildPairBodyListsKernel.computeNode.parameters.pairDispatchCount.value = pairDispatchCount;
    if (debugFlag) {
      buildPairBodyListsKernel.computeNode.parameters.debugEnabled.value = debugFlag;
    }
    this.buildActiveCandidateSlotsKernel.computeNode.parameters.pairCount.value = pairCount;
    this.buildActiveCandidateSlotsKernel.computeNode.parameters.pairDispatchCount.value = pairDispatchCount;
    this.buildActiveCandidateSlotsKernel.computeNode.parameters.useCandidatePairs.value = candidateFlag;
    this.buildPairDispatchArgsKernel.computeNode.parameters.pairDispatchCount.value = pairDispatchCount;
    this.finalizeDebugCountersKernel.computeNode.parameters.debugEnabled.value = debugFlag;
    if (debugFlag) {
      renderer.compute(this.clearDebugCountersKernel, [1, 1, 1]);
    }
    if (pairDispatchCount > 0) {
      const pairWorkgroups = Math.ceil(pairDispatchCount / WORKGROUP_SIZE);
      renderer.compute(this.clearActiveCandidateSlotsKernel, [1, 1, 1]);
      renderer.compute(this.buildActiveCandidateSlotsKernel, [pairWorkgroups, 1, 1]);
      renderer.compute(this.buildPairDispatchArgsKernel, [1, 1, 1]);
      renderer.compute(
        pairKernel,
        INDIRECT_DISPATCH_DISABLED ? [pairWorkgroups, 1, 1] : this.pairDispatchIndirectAttr,
      );
    }
  }

  dispatchBodyListPhase(
    renderer: any,
    bodyCount: number,
    pairDispatchCount: number,
    frameId: number,
  ): void {
    const debugFlag = this.debugEnabled ? 1 : 0;
    const buildPairBodyListsKernel = debugFlag ? this.buildPairBodyListsKernelDebug : this.buildPairBodyListsKernel;
    buildPairBodyListsKernel.computeNode.parameters.bodyCount.value = bodyCount;
    buildPairBodyListsKernel.computeNode.parameters.pairDispatchCount.value = pairDispatchCount;
    if (debugFlag) {
      buildPairBodyListsKernel.computeNode.parameters.debugEnabled.value = debugFlag;
    }
    this.finalizeDebugCountersKernel.computeNode.parameters.debugEnabled.value = debugFlag;

    if (pairDispatchCount > 0) {
      renderer.compute(
        buildPairBodyListsKernel,
        INDIRECT_DISPATCH_DISABLED
          ? [Math.ceil(pairDispatchCount / WORKGROUP_SIZE), 1, 1]
          : this.pairDispatchIndirectAttr,
      );
      if (debugFlag) {
        renderer.compute(this.finalizeDebugCountersKernel, [1, 1, 1]);
      }
    }
    this.maybeLogDebug(renderer, frameId, bodyCount, pairDispatchCount);
  }

  private maybeLogDebug(renderer: any, frameId: number, bodyCount: number, pairDispatchCount: number): void {
    if (!this.debugEnabled) return;
    if (!renderer || typeof renderer.getArrayBufferAsync !== 'function') return;
    if (this.debugReadbackInFlight) return;
    if (this.lastDebugLogFrame === frameId) return;
    if (this.lastDebugLogFrame >= 0 && frameId - this.lastDebugLogFrame < this.debugEveryNFrames) return;

    this.debugReadbackInFlight = true;
    this.lastDebugLogFrame = frameId;
    Promise.all([
      renderer.getArrayBufferAsync(this.debugCountersAttr),
      renderer.getArrayBufferAsync(this.pairContactsAttr),
    ]).then(([debugRaw, pairContactsRaw]: [ArrayBuffer, ArrayBuffer]) => {
      const values = new Uint32Array(debugRaw);
      const warmstartResets = values[0] ?? 0;
      const activeManifolds = values[1] ?? 0;
      const activeCandidateSlots = values[2] ?? 0;
      const stalePrunedSlots = values[3] ?? 0;
      const separatingKeptSlots = values[4] ?? 0;
      const stickingAnchorReuses = values[5] ?? 0;
      const sharedTangentSignFlips = values[6] ?? 0;
      const floorPairCandidates = values[7] ?? 0;
      const floorPairWarmstartResets = values[8] ?? 0;
      const floorPairKeepRejected = values[9] ?? 0;
      const floorPairDegenerateFallbacks = values[10] ?? 0;
      const floorPairWriteZero = values[11] ?? 0;
      const floorPairActive = values[12] ?? 0;
      const floorPairSeparatedRejects = values[13] ?? 0;
      const floorPairInactiveThresholdRejects = values[14] ?? 0;
      const floorPairHysteresisRejects = values[15] ?? 0;
      const floorPairSeparatedFaceA0 = values[16] ?? 0;
      const floorPairSeparatedFaceA1 = values[17] ?? 0;
      const floorPairSeparatedFaceA2 = values[18] ?? 0;
      const floorPairSeparatedFaceB0 = values[19] ?? 0;
      const floorPairSeparatedFaceB1 = values[20] ?? 0;
      const floorPairSeparatedFaceB2 = values[21] ?? 0;
      const floorPairSeparatedEdge = values[22] ?? 0;
      const floorPairSeparatedOther = values[23] ?? 0;
      const pairBodyListOverflowWrites = values[24] ?? 0;
      const pairBodyListDroppedContacts = values[25] ?? 0;
      const activeContactListOverflowWrites = values[26] ?? 0;
      console.info(
        `[Contact Debug] frame=${frameId} bodies=${bodyCount} pairDispatch=${pairDispatchCount} ` +
        `activeCandidates=${activeCandidateSlots} activeManifolds=${activeManifolds} ` +
        `warmstartResets=${warmstartResets} stalePruned=${stalePrunedSlots} ` +
        `separatingKept=${separatingKeptSlots} stickAnchorReuses=${stickingAnchorReuses} ` +
        `sharedTangentSignFlips=${sharedTangentSignFlips} ` +
        `floorPairs=${floorPairCandidates} floorWarmstartResets=${floorPairWarmstartResets} ` +
        `floorRejected=${floorPairKeepRejected} floorDegenerate=${floorPairDegenerateFallbacks} ` +
        `floorWriteZero=${floorPairWriteZero} floorActive=${floorPairActive} ` +
        `floorRejectSeparated=${floorPairSeparatedRejects} ` +
        `floorRejectInactiveGap=${floorPairInactiveThresholdRejects} ` +
        `floorRejectHysteresis=${floorPairHysteresisRejects} ` +
        `floorSepFaceA=(${floorPairSeparatedFaceA0},${floorPairSeparatedFaceA1},${floorPairSeparatedFaceA2}) ` +
        `floorSepFaceB=(${floorPairSeparatedFaceB0},${floorPairSeparatedFaceB1},${floorPairSeparatedFaceB2}) ` +
        `floorSepEdge=${floorPairSeparatedEdge} floorSepOther=${floorPairSeparatedOther} ` +
        `bodyListOverflowWrites=${pairBodyListOverflowWrites} bodyListDroppedContacts=${pairBodyListDroppedContacts} ` +
        `activeListOverflowWrites=${activeContactListOverflowWrites}`,
      );
      if (frameId <= 12 && activeManifolds > 0) {
        const contacts = new Float32Array(pairContactsRaw);
        const contactWords = new Uint32Array(pairContactsRaw);
        const groups = new Map<string, string[]>();
        for (let p = 0; p < this.maxPairContacts; p++) {
          const base = contactRecordVec4FloatIndex(p, CONTACT_RECORD_META_OFFSET);
          const i = Math.max(0, Math.round(contacts[base] ?? 0));
          const j = Math.max(0, Math.round(contacts[base + 1] ?? 0));
          const active = (contacts[base + 2] ?? 0) >= 0.5;
          if (!active) continue;
          const featureWord = contactWords[base + 3] ?? 0;
          const featureKey = featureWord & 0x1ff;
          const preserveWarmstart = ((featureWord >>> 16) & 0x1) !== 0;
          const warmstartReason = (featureWord >>> 21) & 0x7;
          const groupKey = `${i}/${j}`;
          const row = `p=${p} feat=0x${featureKey.toString(16)} warm=${preserveWarmstart ? 1 : 0} r=${warmstartReason}`;
          const rows = groups.get(groupKey) ?? [];
          rows.push(row);
          groups.set(groupKey, rows);
        }
        if (groups.size > 0) {
          const summary = Array.from(groups.entries())
            .sort((a, b) => a[0].localeCompare(b[0]))
            .map(([pair, rows]) => `${pair}[${rows.join(', ')}]`)
            .join(' | ');
          console.info(`[Contact Debug Rows] frame=${frameId} ${summary}`);
        }
      }
    }).catch((error: unknown) => {
      console.warn('Contact debug readback failed:', error);
    }).finally(() => {
      this.debugReadbackInFlight = false;
    });
  }
}
