import { StorageBufferAttribute } from 'three/webgpu';
import { storage, uniform, workgroupId, localId, wgslFn } from './tslCompat';
import {
  GPULBVHBuilder,
  LBVHSorterType,
} from '../../lvbh';

const WORKGROUP_SIZE = 256;
const CANDIDATE_WORKGROUP_SIZE = 64;
const PAIR_STACK_SIZE = 64;
const DEBUG_COUNTER_WORDS = 8;

type BroadphaseDebugSnapshot = {
  frame: number;
  bodies: number;
  candidates: number;
  rawCandidates: number;
  perBodyDrops: number;
  dedupDrops: number;
  writes: number;
  leafCandidates: number;
  visitBudgetDrops: number;
  capacityDrops: number;
  pairsPerBody: number;
};

type BvhBuildBackend = {
  buildAsyncFromGPUBuffers: (options: {
    positionBuffer: GPUBuffer;
    indexBuffer: GPUBuffer;
    primCount: number;
    positionStride?: number;
    useFlatten?: boolean;
    waitForGpuCompletion?: boolean;
  }) => Promise<void>;
  prewarm?: (primCapacity: number) => Promise<void>;
  readonly bvh2Buffer: GPUBuffer | null;
  readonly clusterIdxBuffer: GPUBuffer | null;
  dispose: () => void;
};

export class BroadPhaseStage {
  private readonly gpuBVHs: [BvhBuildBackend, BvhBuildBackend];
  private readonly enableBvhBuild: boolean;
  private readonly buildOnce: boolean;
  private readonly rebuildIntervalFrames: number;
  private readonly waitForGpuCompletion: boolean;
  private readonly device: GPUDevice;
  private readonly maxBodies: number;
  private readonly maxPairs: number;
  private readonly maxPairsPerBody: number;
  private readonly updateAabbKernel: any;
  private readonly bootstrapKernel: any;
  private readonly positionsAttr: StorageBufferAttribute;
  private readonly shapesAttr: StorageBufferAttribute;
  private readonly pairActivityAttr: StorageBufferAttribute;
  private readonly aabbPositionAttr: StorageBufferAttribute;
  private readonly aabbSnapshotBuffer: GPUBuffer;
  private readonly aabbIndexBuffer: GPUBuffer;
  private readonly pairCandidateIndicesAttr: StorageBufferAttribute;
  private readonly pairVisitedBitsAttr: StorageBufferAttribute;
  private readonly candidateUniformBuffer: GPUBuffer;
  private readonly candidateCounterBuffer: GPUBuffer;
  private readonly debugCountersBuffer: GPUBuffer;
  private readonly debugReadbackBuffer: GPUBuffer;
  private readonly candidateBindGroupLayout: GPUBindGroupLayout;
  private readonly clearCounterPipeline: GPUComputePipeline;
  private readonly clearVisitedPipeline: GPUComputePipeline;
  private readonly emitPairsPipeline: GPUComputePipeline;
  private readonly finalizeCounterPipeline: GPUComputePipeline;
  private candidateBindGroup: GPUBindGroup | null = null;
  private candidateBindGroupBuffers: {
    positions: GPUBuffer | null;
    aabbPosition: GPUBuffer | null;
    bvh: GPUBuffer | null;
    clusterIdx: GPUBuffer | null;
    pairCandidate: GPUBuffer | null;
    pairVisited: GPUBuffer | null;
    pairActivity: GPUBuffer | null;
    shapes: GPUBuffer | null;
  } = {
    positions: null,
    aabbPosition: null,
    bvh: null,
    clusterIdx: null,
    pairCandidate: null,
    pairVisited: null,
    pairActivity: null,
    shapes: null,
  };
  private buildInFlight: Promise<void> | null = null;
  private prewarmInFlight: Promise<void> | null = null;
  private buildInFlightStartFrame = -1;
  private activeBvhIndex = 0;
  private activeBvhSnapshotFrame = -1;
  private lastBuildMs = 0;
  private candidatePairsEnabled = false;
  private backendBuffersReady = false;
  private bvhBuffersReady = false;
  private storageBuffersInitialized = false;
  private storageInitWarned = false;
  private bootstrapDone = false;
  private lastBuildFrame = -1;
  private hasBuiltOnce = false;
  private buildGeneration = 0;
  private debugEnabled = false;
  private debugReadbackInFlight = false;
  private debugEveryNFrames = 30;
  private lastDebugLogFrame = -1;

  private getActiveBVH(): BvhBuildBackend {
    return this.gpuBVHs[this.activeBvhIndex];
  }

  private getBuildBVH(): BvhBuildBackend {
    return this.gpuBVHs[1 - this.activeBvhIndex];
  }

  private startBuild(
    aabbPositionBuffer: GPUBuffer,
    bodyCount: number,
    frameId: number,
  ): void {
    if (this.buildInFlight) {
      return;
    }

    const buildStart = performance.now();
    this.lastBuildFrame = frameId;
    this.buildInFlightStartFrame = frameId;
    const buildBVHIndex = 1 - this.activeBvhIndex;
    const buildBVH = this.getBuildBVH();
    const buildGeneration = this.buildGeneration;

    // Snapshot AABBs so traversal always reads from a fully-built BVH generated
    // from immutable input data.
    const copyBytes = Math.max(4, bodyCount * 9 * 4);
    const snapshotEncoder = this.device.createCommandEncoder({ label: 'Broadphase AABB Snapshot Copy' });
    snapshotEncoder.copyBufferToBuffer(aabbPositionBuffer, 0, this.aabbSnapshotBuffer, 0, copyBytes);
    this.device.queue.submit([snapshotEncoder.finish()]);

    this.buildInFlight = buildBVH.buildAsyncFromGPUBuffers({
      positionBuffer: this.aabbSnapshotBuffer,
      indexBuffer: this.aabbIndexBuffer,
      primCount: bodyCount,
      positionStride: 3,
      useFlatten: false,
      waitForGpuCompletion: this.waitForGpuCompletion,
    }).then(() => {
      if (buildGeneration !== this.buildGeneration) {
        return;
      }
      this.activeBvhIndex = buildBVHIndex;
      this.activeBvhSnapshotFrame = frameId;
      this.hasBuiltOnce = true;
      this.candidateBindGroup = null;
      this.candidateBindGroupBuffers.bvh = null;
      this.candidateBindGroupBuffers.clusterIdx = null;
      this.lastBuildMs = performance.now() - buildStart;
    }).catch((error) => {
      if (buildGeneration !== this.buildGeneration) {
        return;
      }
      this.lastBuildMs = 0;
      console.warn('BroadPhaseStage BVH build failed:', error);
    }).finally(() => {
      if (buildGeneration !== this.buildGeneration) {
        return;
      }
      this.buildInFlight = null;
      this.buildInFlightStartFrame = -1;
    });
  }

  constructor(
    device: GPUDevice,
    positions: StorageBufferAttribute,
    velocities: StorageBufferAttribute,
    quaternions: StorageBufferAttribute,
    shapes: StorageBufferAttribute,
    pairActivity: StorageBufferAttribute,
    pairCandidateIndices: StorageBufferAttribute,
    pairVisitedBits: StorageBufferAttribute,
    maxBodies: number,
    maxPairs: number,
    maxPairsPerBody: number,
    ignorePairBitsOffset: number,
    options?: {
      enableBvhBuild?: boolean;
      buildOnce?: boolean;
      rebuildIntervalFrames?: number;
      waitForGpuCompletion?: boolean;
    },
  ) {
    this.device = device;
    this.maxBodies = maxBodies;
    this.maxPairs = maxPairs;
    this.maxPairsPerBody = maxPairsPerBody;
    this.positionsAttr = positions;
    this.shapesAttr = shapes;
    this.pairActivityAttr = pairActivity;
    this.enableBvhBuild = options?.enableBvhBuild ?? true;
    this.buildOnce = options?.buildOnce ?? false;
    this.rebuildIntervalFrames = Math.max(1, Math.floor(options?.rebuildIntervalFrames ?? 1));
    this.waitForGpuCompletion = options?.waitForGpuCompletion ?? true;
    this.pairCandidateIndicesAttr = pairCandidateIndices;
    this.pairVisitedBitsAttr = pairVisitedBits;

    this.gpuBVHs = [
      new GPULBVHBuilder(device, {
        sorterType: LBVHSorterType.ONESWEEP,
      }),
      new GPULBVHBuilder(device, {
        sorterType: LBVHSorterType.ONESWEEP,
      }),
    ];

    const prewarmCapacity = Math.max(1, this.maxBodies);
    const prewarmPromises: Promise<void>[] = [];
    if (typeof this.gpuBVHs[0].prewarm === 'function') {
      prewarmPromises.push(this.gpuBVHs[0].prewarm(prewarmCapacity));
    }
    if (typeof this.gpuBVHs[1].prewarm === 'function') {
      prewarmPromises.push(this.gpuBVHs[1].prewarm(prewarmCapacity));
    }
    if (prewarmPromises.length > 0) {
      this.prewarmInFlight = Promise.all(prewarmPromises).then(() => undefined).catch((error) => {
        console.warn('BroadPhaseStage BVH prewarm failed:', error);
      }).finally(() => {
        this.prewarmInFlight = null;
      });
    }

    // 3 vertices x 3 floats (min corner, max corner, center) per body.
    this.aabbPositionAttr = new StorageBufferAttribute(new Float32Array(maxBodies * 9), 1);
    this.aabbSnapshotBuffer = this.device.createBuffer({
      label: 'Broadphase AABB Snapshot',
      size: maxBodies * 9 * 4,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });

    const indexData = new Uint32Array(maxBodies * 3);
    for (let i = 0; i < maxBodies; i++) {
      indexData[i * 3 + 0] = i * 3;
      indexData[i * 3 + 1] = i * 3 + 1;
      indexData[i * 3 + 2] = i * 3 + 2;
    }
    this.aabbIndexBuffer = this.device.createBuffer({
      size: indexData.byteLength,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });
    this.device.queue.writeBuffer(this.aabbIndexBuffer, 0, indexData);

    const updateAabbShader = wgslFn(/* wgsl */`
      fn compute(
        positions: ptr<storage, array<vec4f>, read>,
        velocities: ptr<storage, array<vec4f>, read>,
        quaternions: ptr<storage, array<vec4f>, read>,
        shapes: ptr<storage, array<vec4f>, read>,
        aabbPositions: ptr<storage, array<f32>, read_write>,
        bodyCount: u32,
        aabbMargin: f32,
        aabbVelocityHorizon: f32,
        workgroupId: vec3u,
        localId: vec3u,
      ) -> void {
        let gid = workgroupId.x * ${WORKGROUP_SIZE}u + localId.x;
        if (gid >= bodyCount) { return; }

        let pos = positions[gid].xyz;
        let vel = velocities[gid].xyz;
        let q = quaternions[gid];
        let shape = shapes[gid];
        let half = shape.yzw;
        let shapeType = decodeShapeType(shape.x);
        let base = gid * 9u;

        // Keep BVH input finite; invalid values can poison the builder.
        if (!isFinite3(pos) || !isFinite4(q) || !isFinite3(half)) {
          let safe = vec3f(0.0, -1e6, 0.0);
          aabbPositions[base + 0u] = safe.x;
          aabbPositions[base + 1u] = safe.y;
          aabbPositions[base + 2u] = safe.z;
          aabbPositions[base + 3u] = safe.x;
          aabbPositions[base + 4u] = safe.y;
          aabbPositions[base + 5u] = safe.z;
          aabbPositions[base + 6u] = safe.x;
          aabbPositions[base + 7u] = safe.y;
          aabbPositions[base + 8u] = safe.z;
          return;
        }

        let velPad = abs(vel) * aabbVelocityHorizon;
        var e = vec3f(0.0);
        if (shapeType == SHAPE_TYPE_SPHERE) {
          e = vec3f(max(half.x, 0.0)) + vec3f(aabbMargin) + velPad;
        } else {
          let ax0 = qrot(q, vec3f(1.0, 0.0, 0.0));
          let ax1 = qrot(q, vec3f(0.0, 1.0, 0.0));
          let ax2 = qrot(q, vec3f(0.0, 0.0, 1.0));

          let ex = abs(ax0.x) * half.x + abs(ax1.x) * half.y + abs(ax2.x) * half.z;
          let ey = abs(ax0.y) * half.x + abs(ax1.y) * half.y + abs(ax2.y) * half.z;
          let ez = abs(ax0.z) * half.x + abs(ax1.z) * half.y + abs(ax2.z) * half.z;
          e = vec3f(ex, ey, ez) + vec3f(aabbMargin) + velPad;
        }

        aabbPositions[base + 0u] = pos.x - e.x;
        aabbPositions[base + 1u] = pos.y - e.y;
        aabbPositions[base + 2u] = pos.z - e.z;

        aabbPositions[base + 3u] = pos.x + e.x;
        aabbPositions[base + 4u] = pos.y + e.y;
        aabbPositions[base + 5u] = pos.z + e.z;

        aabbPositions[base + 6u] = pos.x;
        aabbPositions[base + 7u] = pos.y;
        aabbPositions[base + 8u] = pos.z;
      }

      const SHAPE_TYPE_SHIFT: u32 = 14u;
      const SHAPE_TYPE_MASK: u32 = 0x3u;
      const SHAPE_TYPE_SPHERE: u32 = 1u;

      fn decodeShapeType(shapeMeta: f32) -> u32 {
        return (bitcast<u32>(shapeMeta) >> SHAPE_TYPE_SHIFT) & SHAPE_TYPE_MASK;
      }

      fn isFinite3(v: vec3f) -> bool {
        let nonNan = all(v == v);
        let bounded = all(abs(v) <= vec3f(1e20));
        return nonNan && bounded;
      }

      fn isFinite4(v: vec4f) -> bool {
        let nonNan = all(v == v);
        let bounded = all(abs(v) <= vec4f(1e20));
        return nonNan && bounded;
      }

      fn qrot(q: vec4f, v: vec3f) -> vec3f {
        let t = 2.0 * cross(q.xyz, v);
        return v + q.w * t + cross(q.xyz, t);
      }
    `);

    this.updateAabbKernel = updateAabbShader({
      positions: storage(positions, 'vec4f', maxBodies).toReadOnly(),
      velocities: storage(velocities, 'vec4f', maxBodies).toReadOnly(),
      quaternions: storage(quaternions, 'vec4f', maxBodies).toReadOnly(),
      shapes: storage(shapes, 'vec4f', maxBodies).toReadOnly(),
      aabbPositions: storage(this.aabbPositionAttr, 'float', maxBodies * 9),
      bodyCount: uniform(0),
      // Keep broadphase pairs alive across contact persistence/slop bands to
      // avoid frame-to-frame pair drop/re-add buzzing in resting stacks.
      aabbMargin: uniform(0.01),
      aabbVelocityHorizon: uniform(1.0 / 60.0),
      workgroupId,
      localId,
    }).computeKernel([WORKGROUP_SIZE, 1, 1]).setName('Broadphase Update AABBs');

    const bootstrapShader = wgslFn(/* wgsl */`
      fn compute(
        pairCandidateIndices: ptr<storage, array<u32>, read_write>,
        pairVisitedBits: ptr<storage, array<u32>, read_write>,
      ) -> void {
        // Force renderer-managed storage allocation for broadphase-only buffers.
        pairCandidateIndices[0] = pairCandidateIndices[0];
        pairVisitedBits[0] = pairVisitedBits[0];
      }
    `);

    this.bootstrapKernel = bootstrapShader({
      pairCandidateIndices: storage(pairCandidateIndices, 'uint', pairCandidateIndices.count),
      pairVisitedBits: storage(pairVisitedBits, 'uint', pairVisitedBits.count),
    }).computeKernel([1, 1, 1]).setName('Broadphase Bootstrap Buffers');

    this.candidateUniformBuffer = this.device.createBuffer({
      label: 'Broadphase Candidate Uniforms',
      size: 32,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    this.candidateCounterBuffer = this.device.createBuffer({
      label: 'Broadphase Candidate Counter',
      size: 4,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
    });
    this.debugCountersBuffer = this.device.createBuffer({
      label: 'Broadphase Debug Counters',
      size: DEBUG_COUNTER_WORDS * 4,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
    });
    this.debugReadbackBuffer = this.device.createBuffer({
      label: 'Broadphase Debug Readback',
      size: DEBUG_COUNTER_WORDS * 4,
      usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
    });

    this.candidateBindGroupLayout = this.device.createBindGroupLayout({
      label: 'Broadphase Candidate BindGroupLayout',
      entries: [
        { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'uniform' } },
        { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'read-only-storage' } },
        { binding: 2, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'read-only-storage' } },
        { binding: 3, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'read-only-storage' } },
        { binding: 4, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } },
        { binding: 5, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } },
        { binding: 6, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } },
        { binding: 7, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } },
        { binding: 8, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'read-only-storage' } },
        { binding: 9, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'read-only-storage' } },
      ],
    });

    const candidateShaderModule = this.device.createShaderModule({
      label: 'Broadphase Candidate Shader',
      code: `
struct Uniforms {
  bodyCount: u32,
  pairCapacity: u32,
  visitedWordCount: u32,
  pairsPerBody: u32,
  bvhNodeCapacity: u32,
  useVisitedDedup: u32,
  debugEnabled: u32,
};

struct BVH2Node {
  boundsMin: vec3f,
  leftChild: u32,
  boundsMax: vec3f,
  rightChild: u32,
};

@group(0) @binding(0) var<uniform> uniforms: Uniforms;
@group(0) @binding(1) var<storage, read> aabbPositions: array<f32>;
@group(0) @binding(2) var<storage, read> bvhNodes: array<BVH2Node>;
@group(0) @binding(3) var<storage, read> clusterIdx: array<u32>;
@group(0) @binding(4) var<storage, read_write> pairActivity: array<u32>;
@group(0) @binding(5) var<storage, read_write> pairVisitedBits: array<atomic<u32>>;
@group(0) @binding(6) var<storage, read_write> pairCounter: atomic<u32>;
@group(0) @binding(7) var<storage, read_write> debugCounters: array<atomic<u32>>;
@group(0) @binding(8) var<storage, read> positions: array<vec4f>;
@group(0) @binding(9) var<storage, read> shapes: array<vec4f>;

const INVALID_IDX: u32 = 0xFFFFFFFFu;
const INVALID_PAIR: u32 = 0xFFFFFFFFu;

fn overlaps(aMin: vec3f, aMax: vec3f, bMin: vec3f, bMax: vec3f) -> bool {
  return !(aMax.x < bMin.x || aMin.x > bMax.x ||
           aMax.y < bMin.y || aMin.y > bMax.y ||
           aMax.z < bMin.z || aMin.z > bMax.z);
}

fn pairIndex(i: u32, j: u32) -> u32 {
  return (j * (j - 1u)) / 2u + i;
}

fn isIgnoredPair(i: u32, j: u32) -> bool {
  let idx = pairIndex(i, j);
  let word = idx >> 5u;
  let bit = 1u << (idx & 31u);
  return (pairActivity[${ignorePairBitsOffset}u + word] & bit) != 0u;
}

fn decodeShapeCollisionGroup(shapeMeta: f32) -> u32 {
  return (bitcast<u32>(shapeMeta) >> 16u) & 0xffu;
}

fn decodeShapeCollisionMask(shapeMeta: f32) -> u32 {
  return (bitcast<u32>(shapeMeta) >> 24u) & 0xffu;
}

fn shapesCanCollide(shapeA: vec4f, shapeB: vec4f) -> bool {
  let groupA = decodeShapeCollisionGroup(shapeA.x);
  let groupB = decodeShapeCollisionGroup(shapeB.x);
  let maskA = decodeShapeCollisionMask(shapeA.x);
  let maskB = decodeShapeCollisionMask(shapeB.x);
  return (maskA & groupB) != 0u && (maskB & groupA) != 0u;
}

fn loadBodyMin(body: u32) -> vec3f {
  let base = body * 9u;
  return vec3f(
    aabbPositions[base + 0u],
    aabbPositions[base + 1u],
    aabbPositions[base + 2u]
  );
}

fn loadBodyMax(body: u32) -> vec3f {
  let base = body * 9u;
  return vec3f(
    aabbPositions[base + 3u],
    aabbPositions[base + 4u],
    aabbPositions[base + 5u]
  );
}

fn loadBodyCenter(body: u32) -> vec3f {
  let base = body * 9u;
  return vec3f(
    aabbPositions[base + 6u],
    aabbPositions[base + 7u],
    aabbPositions[base + 8u]
  );
}

@compute @workgroup_size(1)
fn clearCounter() {
  atomicStore(&pairCounter, 0u);
  pairActivity[0] = 0u;
  if (uniforms.debugEnabled > 0u) {
    for (var i = 0u; i < ${DEBUG_COUNTER_WORDS}u; i++) {
      atomicStore(&debugCounters[i], 0u);
    }
  }
}

@compute @workgroup_size(${CANDIDATE_WORKGROUP_SIZE})
fn clearVisited(@builtin(global_invocation_id) globalId: vec3u) {
  if (uniforms.useVisitedDedup == 0u) { return; }
  let idx = globalId.x;
  if (idx >= uniforms.visitedWordCount) { return; }
  atomicStore(&pairVisitedBits[idx], 0u);
}

@compute @workgroup_size(${CANDIDATE_WORKGROUP_SIZE})
fn emitPairs(@builtin(global_invocation_id) globalId: vec3u) {
  let body = globalId.x;
  if (body >= uniforms.bodyCount) { return; }

  let bodyBase = body * uniforms.pairsPerBody;
  if (bodyBase >= uniforms.pairCapacity) { return; }
  let maxBodySlots = min(uniforms.pairsPerBody, uniforms.pairCapacity - bodyBase);
  for (var clearIdx = 0u; clearIdx < maxBodySlots; clearIdx++) {
    pairActivity[bodyBase + clearIdx + 1u] = INVALID_PAIR;
  }

  // Static bodies do not own candidate emission. Dynamic bodies emit both
  // dynamic-dynamic and dynamic-static pairs (including static floor/terrain).
  if (positions[body].w == 0.0) {
    return;
  }

  let aabbMin = loadBodyMin(body);
  let aabbMax = loadBodyMax(body);
  let bodyCenter = loadBodyCenter(body);
  let maxNodes = uniforms.bvhNodeCapacity;

  var root = clusterIdx[0u];
  if (uniforms.bodyCount > 1u) {
    let expectedRoot = uniforms.bodyCount * 2u - 2u;
    if (expectedRoot < maxNodes) {
      if (root == INVALID_IDX || root >= maxNodes || bvhNodes[root].leftChild == INVALID_IDX) {
        root = expectedRoot;
      }
    }
  }

  var emittedForBody = 0u;
  var localPairs: array<u32, ${maxPairsPerBody}>;
  var localDist2: array<f32, ${maxPairsPerBody}>;
  var stack: array<u32, ${PAIR_STACK_SIZE}>;
  var sp = 0u;
  var visitCount = 0u;
  let visitBudget = max(128u, min(maxNodes * 4u, 4096u));

  if (root != INVALID_IDX && root < maxNodes) {
    stack[sp] = root;
    sp = 1u;
  }

  loop {
    if (sp == 0u || visitCount >= visitBudget) { break; }
    visitCount += 1u;
    sp -= 1u;

    let nodeIdx = stack[sp];
    if (nodeIdx >= maxNodes) {
      continue;
    }

    let node = bvhNodes[nodeIdx];
    if (!overlaps(aabbMin, aabbMax, node.boundsMin, node.boundsMax)) {
      continue;
    }

    if (node.leftChild == INVALID_IDX) {
      let other = node.rightChild;
      if (other == body || other >= uniforms.bodyCount) {
        continue;
      }
      let otherDynamic = positions[other].w > 0.0;
      if (otherDynamic && other <= body) {
        continue;
      }
      if (uniforms.debugEnabled > 0u) {
        atomicAdd(&debugCounters[4u], 1u);
      }

      let a = min(body, other);
      let b = max(body, other);
      if (!shapesCanCollide(shapes[a], shapes[b])) {
        continue;
      }
      if (isIgnoredPair(a, b)) {
        continue;
      }
      let pair = pairIndex(a, b);

      if (uniforms.useVisitedDedup != 0u) {
        let word = pair >> 5u;
        let bit = 1u << (pair & 31u);
        let previous = atomicOr(&pairVisitedBits[word], bit);
        if ((previous & bit) != 0u) {
          if (uniforms.debugEnabled > 0u) {
            atomicAdd(&debugCounters[1u], 1u);
          }
          continue;
        }
      }
      // Store candidates locally first so each body can emit a deterministic,
      // sorted fixed-size range in the global buffer.
      let packedPair = (a & 0xFFFFu) | ((b & 0xFFFFu) << 16u);
      let dc = loadBodyCenter(other) - bodyCenter;
      var d2 = dot(dc, dc);
      if (!otherDynamic) {
        // Keep static support contacts (e.g. floor) from being evicted by
        // dynamic neighbors in top-K pruning.
        d2 = -1.0;
      }

      if (emittedForBody < maxBodySlots) {
        localPairs[emittedForBody] = packedPair;
        localDist2[emittedForBody] = d2;
        emittedForBody += 1u;
      } else if (maxBodySlots > 0u) {
        if (uniforms.debugEnabled > 0u) {
          atomicAdd(&debugCounters[0u], 1u);
        }

        // Keep the top-K nearest neighbors for each body; this avoids
        // dropping physically relevant support contacts in dense stacks.
        var worstIdx = 0u;
        var worstD2 = localDist2[0];
        var worstPair = localPairs[0];
        for (var idx = 1u; idx < maxBodySlots; idx++) {
          let candD2 = localDist2[idx];
          let candPair = localPairs[idx];
          if (candD2 > worstD2 || (candD2 == worstD2 && candPair > worstPair)) {
            worstIdx = idx;
            worstD2 = candD2;
            worstPair = candPair;
          }
        }

        if (d2 < worstD2 || (d2 == worstD2 && packedPair < worstPair)) {
          localPairs[worstIdx] = packedPair;
          localDist2[worstIdx] = d2;
        }
      }
    } else {
      let left = node.leftChild;
      let right = node.rightChild;
      if (left == INVALID_IDX || right == INVALID_IDX || left == nodeIdx || right == nodeIdx) {
        continue;
      }
      if (sp + 2u <= ${PAIR_STACK_SIZE}u && left < maxNodes && right < maxNodes) {
        stack[sp] = left;
        sp += 1u;
        stack[sp] = right;
        sp += 1u;
      }
    }
  }

  if (uniforms.debugEnabled > 0u && visitCount >= visitBudget) {
    atomicAdd(&debugCounters[3u], 1u);
  }

  // Insertion-sort each body's local candidate list for deterministic manifold
  // indexing across frames (critical for persistent warmstart state).
  for (var sortI = 1u; sortI < emittedForBody; sortI++) {
    let key = localPairs[sortI];
    var sortJ = sortI;
    loop {
      if (sortJ == 0u) { break; }
      let prev = localPairs[sortJ - 1u];
      if (prev <= key) { break; }
      localPairs[sortJ] = prev;
      sortJ -= 1u;
    }
    localPairs[sortJ] = key;
  }

  for (var writeIdx = 0u; writeIdx < emittedForBody; writeIdx++) {
    pairActivity[bodyBase + writeIdx + 1u] = localPairs[writeIdx];
  }
  // Clear unused per-body candidate slots so contact generation does not
  // read stale pairs from previous frames.
  let invalidPacked = body | (body << 16u);
  for (var clearIdx = emittedForBody; clearIdx < uniforms.pairsPerBody; clearIdx++) {
    pairActivity[bodyBase + clearIdx + 1u] = invalidPacked;
  }

  atomicAdd(&pairCounter, emittedForBody);
  if (uniforms.debugEnabled > 0u) {
    atomicAdd(&debugCounters[2u], emittedForBody);
  }
}

@compute @workgroup_size(1)
fn finalizeCounter() {
  let rawCount = atomicLoad(&pairCounter);
  let dispatchSpan = min(uniforms.pairCapacity, uniforms.bodyCount * uniforms.pairsPerBody);
  pairActivity[0] = dispatchSpan;
  if (uniforms.debugEnabled > 0u) {
    // 5 = actual emitted candidates, 6 = dispatch span used by contact pass.
    atomicStore(&debugCounters[5u], rawCount);
    atomicStore(&debugCounters[6u], dispatchSpan);
  }
}
`,
    });

    const pipelineLayout = this.device.createPipelineLayout({
      bindGroupLayouts: [this.candidateBindGroupLayout],
    });

    this.clearCounterPipeline = this.device.createComputePipeline({
      label: 'Broadphase Clear Counter',
      layout: pipelineLayout,
      compute: { module: candidateShaderModule, entryPoint: 'clearCounter' },
    });
    this.clearVisitedPipeline = this.device.createComputePipeline({
      label: 'Broadphase Clear Visited',
      layout: pipelineLayout,
      compute: { module: candidateShaderModule, entryPoint: 'clearVisited' },
    });
    this.emitPairsPipeline = this.device.createComputePipeline({
      label: 'Broadphase Emit Pairs',
      layout: pipelineLayout,
      compute: { module: candidateShaderModule, entryPoint: 'emitPairs' },
    });
    this.finalizeCounterPipeline = this.device.createComputePipeline({
      label: 'Broadphase Finalize Counter',
      layout: pipelineLayout,
      compute: { module: candidateShaderModule, entryPoint: 'finalizeCounter' },
    });
  }

  dispatch(renderer: any, bodyCount: number, pairCount: number, frameId: number): void {
    if (bodyCount < 2 || pairCount == 0) {
      this.candidatePairsEnabled = false;
      this.backendBuffersReady = false;
      this.bvhBuffersReady = false;
      this.lastBuildMs = 0;
      this.logDebugState(frameId, bodyCount, 'insufficientBodiesOrPairs');
      return;
    }

    this.updateAabbKernel.computeNode.parameters.bodyCount.value = bodyCount;
    renderer.compute(this.updateAabbKernel, [Math.ceil(bodyCount / WORKGROUP_SIZE), 1, 1]);

    if (!this.bootstrapDone) {
      renderer.compute(this.bootstrapKernel, [1, 1, 1]);
      this.bootstrapDone = true;
    }

    const backend = (renderer as any).backend;
    if (!this.storageBuffersInitialized && backend?.createStorageAttribute) {
      try {
        backend.createStorageAttribute(this.aabbPositionAttr);
        backend.createStorageAttribute(this.pairActivityAttr);
        backend.createStorageAttribute(this.pairVisitedBitsAttr);
        this.storageBuffersInitialized = true;
      } catch (error) {
        if (!this.storageInitWarned) {
          console.warn('BroadPhaseStage failed to initialize storage attributes:', error);
          this.storageInitWarned = true;
        }
      }
    }

    const positionsBuffer = backend?.get?.(this.positionsAttr)?.buffer as GPUBuffer | undefined;
    const shapesBuffer = backend?.get?.(this.shapesAttr)?.buffer as GPUBuffer | undefined;
    const aabbPositionBuffer = backend?.get?.(this.aabbPositionAttr)?.buffer as GPUBuffer | undefined;
    const pairActivityBuffer = backend?.get?.(this.pairActivityAttr)?.buffer as GPUBuffer | undefined;
    const pairVisitedBuffer = backend?.get?.(this.pairVisitedBitsAttr)?.buffer as GPUBuffer | undefined;
    this.backendBuffersReady = Boolean(positionsBuffer && shapesBuffer && aabbPositionBuffer && pairActivityBuffer && pairVisitedBuffer);
    if (!positionsBuffer || !shapesBuffer || !aabbPositionBuffer || !pairActivityBuffer || !pairVisitedBuffer) {
      this.candidatePairsEnabled = false;
      this.bvhBuffersReady = false;
      this.logDebugState(frameId, bodyCount, 'missingBackendBuffers');
      return;
    }

    if (!this.enableBvhBuild) {
      this.candidatePairsEnabled = false;
      this.bvhBuffersReady = false;
      this.lastBuildMs = 0;
      this.logDebugState(frameId, bodyCount, 'bvhDisabled');
      return;
    }

    const periodicReady = this.lastBuildFrame < 0 || frameId - this.lastBuildFrame >= this.rebuildIntervalFrames;
    const onceReady = !this.buildOnce || !this.hasBuiltOnce;
    const prewarmReady = this.prewarmInFlight === null;
    const shouldStartBuild = periodicReady && onceReady && prewarmReady;

    if (!this.hasBuiltOnce) {
      if (shouldStartBuild) {
        this.startBuild(aabbPositionBuffer, bodyCount, frameId);
      }
      this.candidatePairsEnabled = false;
      this.bvhBuffersReady = false;
      this.logDebugState(frameId, bodyCount, prewarmReady ? 'waitingInitialBuild' : 'waitingPrewarm', shouldStartBuild);
      return;
    }

    const activeBVH = this.getActiveBVH();
    const bvhBuffer = activeBVH.bvh2Buffer;
    const clusterIdxBuffer = activeBVH.clusterIdxBuffer;
    this.bvhBuffersReady = Boolean(bvhBuffer && clusterIdxBuffer);
    if (!bvhBuffer || !clusterIdxBuffer) {
      this.candidatePairsEnabled = false;
      if (shouldStartBuild) {
        this.startBuild(aabbPositionBuffer, bodyCount, frameId);
      }
      this.logDebugState(frameId, bodyCount, 'missingBvhBuffers', shouldStartBuild);
      return;
    }

    const visitedWordCount = Math.ceil(pairCount / 32);
    const maxWorkgroupsPerDim = Math.max(1, Number(this.device.limits.maxComputeWorkgroupsPerDimension ?? 65535));
    const maxVisitedWordsPerDispatch = maxWorkgroupsPerDim * CANDIDATE_WORKGROUP_SIZE;
    const visitedWordCapacity = this.pairVisitedBitsAttr.count;
    const maxVisitedWordsUsable = Math.min(maxVisitedWordsPerDispatch, visitedWordCapacity);
    const useVisitedDedup = visitedWordCount <= maxVisitedWordsUsable ? 1 : 0;
    const clearVisitedWorkgroups = useVisitedDedup
      ? Math.max(1, Math.ceil(visitedWordCount / CANDIDATE_WORKGROUP_SIZE))
      : 0;

    const pairCapacity = Math.min(this.maxPairs, bodyCount * this.maxPairsPerBody);
    // Avoid WGSL arrayLength() on storage buffers here. Recent Chromium/Dawn
    // builds can lower that through immediate data paths that are not enabled
    // in standard WebGPU configurations.
    const bvhNodeCapacity = Math.max(1, bodyCount * 2);
    const uniforms = new Uint32Array([
      bodyCount,
      pairCapacity,
      visitedWordCount,
      this.maxPairsPerBody,
      bvhNodeCapacity,
      useVisitedDedup,
      this.debugEnabled ? 1 : 0,
    ]);
    this.device.queue.writeBuffer(this.candidateUniformBuffer, 0, uniforms);

    const needsBindGroupRebuild =
      !this.candidateBindGroup
      || this.candidateBindGroupBuffers.positions !== positionsBuffer
      || this.candidateBindGroupBuffers.aabbPosition !== aabbPositionBuffer
      || this.candidateBindGroupBuffers.bvh !== bvhBuffer
      || this.candidateBindGroupBuffers.clusterIdx !== clusterIdxBuffer
      || this.candidateBindGroupBuffers.pairCandidate !== pairActivityBuffer
      || this.candidateBindGroupBuffers.pairVisited !== pairVisitedBuffer
      || this.candidateBindGroupBuffers.pairActivity !== pairActivityBuffer
      || this.candidateBindGroupBuffers.shapes !== shapesBuffer;

    if (needsBindGroupRebuild) {
      this.candidateBindGroup = this.device.createBindGroup({
        label: 'Broadphase Candidate BindGroup',
        layout: this.candidateBindGroupLayout,
        entries: [
          { binding: 0, resource: { buffer: this.candidateUniformBuffer } },
          { binding: 1, resource: { buffer: aabbPositionBuffer } },
          { binding: 2, resource: { buffer: bvhBuffer } },
          { binding: 3, resource: { buffer: clusterIdxBuffer } },
          { binding: 4, resource: { buffer: pairActivityBuffer } },
          { binding: 5, resource: { buffer: pairVisitedBuffer } },
          { binding: 6, resource: { buffer: this.candidateCounterBuffer } },
          { binding: 7, resource: { buffer: this.debugCountersBuffer } },
          { binding: 8, resource: { buffer: positionsBuffer } },
          { binding: 9, resource: { buffer: shapesBuffer } },
        ],
      });
      this.candidateBindGroupBuffers.positions = positionsBuffer;
      this.candidateBindGroupBuffers.aabbPosition = aabbPositionBuffer;
      this.candidateBindGroupBuffers.bvh = bvhBuffer;
      this.candidateBindGroupBuffers.clusterIdx = clusterIdxBuffer;
      this.candidateBindGroupBuffers.pairCandidate = pairActivityBuffer;
      this.candidateBindGroupBuffers.pairVisited = pairVisitedBuffer;
      this.candidateBindGroupBuffers.pairActivity = pairActivityBuffer;
      this.candidateBindGroupBuffers.shapes = shapesBuffer;
    }

    const commandEncoder = this.device.createCommandEncoder({ label: 'Broadphase Encoder' });
    {
      const pass = commandEncoder.beginComputePass({ label: 'Broadphase Candidate Pass' });
      pass.setBindGroup(0, this.candidateBindGroup!);
      pass.setPipeline(this.clearCounterPipeline);
      pass.dispatchWorkgroups(1);
      if (clearVisitedWorkgroups > 0) {
        pass.setPipeline(this.clearVisitedPipeline);
        pass.dispatchWorkgroups(clearVisitedWorkgroups);
      }
      pass.setPipeline(this.emitPairsPipeline);
      pass.dispatchWorkgroups(Math.ceil(bodyCount / CANDIDATE_WORKGROUP_SIZE));
      pass.setPipeline(this.finalizeCounterPipeline);
      pass.dispatchWorkgroups(1);
      pass.end();
    }
    this.device.queue.submit([commandEncoder.finish()]);

    this.maybeReadDebugCounters(frameId, bodyCount);
    this.candidatePairsEnabled = true;

    // Queue rebuild after traversal so this frame consumes the last completed
    // BVH while the next build feeds subsequent frames.
    if (shouldStartBuild) {
      this.startBuild(aabbPositionBuffer, bodyCount, frameId);
    }

    this.logDebugState(frameId, bodyCount, 'ready', shouldStartBuild);
  }

  hasCandidatePairs(): boolean {
    return this.candidatePairsEnabled;
  }

  setDebugEnabled(enabled: boolean): void {
    this.debugEnabled = enabled;
    this.debugReadbackInFlight = false;
    this.lastDebugLogFrame = -1;
  }

  setDebugLogInterval(intervalFrames: number): void {
    this.debugEveryNFrames = Math.max(1, Math.floor(intervalFrames));
    this.lastDebugLogFrame = -1;
  }

  isReady(): boolean {
    return this.backendBuffersReady && this.bvhBuffersReady;
  }

  getLastBuildMs(): number {
    return this.lastBuildMs;
  }

  reset(): void {
    this.buildGeneration++;
    this.buildInFlight = null;
    this.buildInFlightStartFrame = -1;
    this.activeBvhIndex = 0;
    this.activeBvhSnapshotFrame = -1;
    this.lastBuildMs = 0;
    this.candidatePairsEnabled = false;
    this.backendBuffersReady = false;
    this.bvhBuffersReady = false;
    this.storageBuffersInitialized = false;
    this.storageInitWarned = false;
    this.bootstrapDone = false;
    this.lastBuildFrame = -1;
    this.hasBuiltOnce = false;
    this.debugReadbackInFlight = false;
    this.lastDebugLogFrame = -1;
    this.candidateBindGroup = null;
    this.candidateBindGroupBuffers.positions = null;
    this.candidateBindGroupBuffers.aabbPosition = null;
    this.candidateBindGroupBuffers.bvh = null;
    this.candidateBindGroupBuffers.clusterIdx = null;
    this.candidateBindGroupBuffers.pairCandidate = null;
    this.candidateBindGroupBuffers.pairVisited = null;
    this.candidateBindGroupBuffers.pairActivity = null;
    this.candidateBindGroupBuffers.shapes = null;
  }

  dispose(): void {
    this.candidateBindGroup = null;
    this.aabbSnapshotBuffer.destroy();
    this.aabbIndexBuffer.destroy();
    this.candidateUniformBuffer.destroy();
    this.candidateCounterBuffer.destroy();
    this.debugCountersBuffer.destroy();
    this.debugReadbackBuffer.destroy();
    this.gpuBVHs[0].dispose();
    this.gpuBVHs[1].dispose();
  }

  private maybeReadDebugCounters(frameId: number, bodyCount: number): void {
    if (!this.debugEnabled) return;
    if (this.debugReadbackInFlight) return;
    if (this.lastDebugLogFrame >= 0 && frameId - this.lastDebugLogFrame < this.debugEveryNFrames) return;

    this.debugReadbackInFlight = true;
    this.lastDebugLogFrame = frameId;

    const encoder = this.device.createCommandEncoder({ label: 'Broadphase Debug Readback' });
    encoder.copyBufferToBuffer(
      this.debugCountersBuffer,
      0,
      this.debugReadbackBuffer,
      0,
      DEBUG_COUNTER_WORDS * 4,
    );
    this.device.queue.submit([encoder.finish()]);

    this.debugReadbackBuffer.mapAsync(GPUMapMode.READ).then(() => {
      try {
        const mapped = this.debugReadbackBuffer.getMappedRange();
        const values = new Uint32Array(mapped.slice(0));
        const emittedCount = values[5] ?? 0;
        const dispatchSpan = values[6] ?? 0;
        const snapshot: BroadphaseDebugSnapshot = {
          frame: frameId,
          bodies: bodyCount,
          candidates: emittedCount,
          rawCandidates: dispatchSpan,
          perBodyDrops: values[0] ?? 0,
          dedupDrops: values[1] ?? 0,
          writes: values[2] ?? 0,
          leafCandidates: values[4] ?? 0,
          visitBudgetDrops: values[3] ?? 0,
          capacityDrops: Math.max(0, emittedCount - dispatchSpan),
          pairsPerBody: this.maxPairsPerBody,
        };
        console.info(
          `[Broadphase Debug] frame=${snapshot.frame} bodies=${snapshot.bodies} ` +
          `candidates=${snapshot.candidates} perBodyDrops=${snapshot.perBodyDrops} ` +
          `dedupDrops=${snapshot.dedupDrops} writes=${snapshot.writes} ` +
          `leafCandidates=${snapshot.leafCandidates} visitBudgetDrops=${snapshot.visitBudgetDrops} ` +
          `capacityDrops=${snapshot.capacityDrops} pairsPerBody=${snapshot.pairsPerBody} ` +
          `dispatchSpan=${snapshot.rawCandidates}`,
        );
      } finally {
        this.debugReadbackBuffer.unmap();
      }
    }).catch((error) => {
      console.warn('Broadphase debug readback failed:', error);
    }).finally(() => {
      this.debugReadbackInFlight = false;
    });
  }

  private logDebugState(
    frameId: number,
    bodyCount: number,
    reason: string,
    shouldStartBuild?: boolean,
  ): void {
    if (!this.debugEnabled) return;
    const activeAgeFrames =
      this.activeBvhSnapshotFrame >= 0 ? Math.max(0, frameId - this.activeBvhSnapshotFrame) : -1;
    const inflightAgeFrames =
      this.buildInFlight && this.buildInFlightStartFrame >= 0
        ? Math.max(0, frameId - this.buildInFlightStartFrame)
        : -1;
    const shouldBuildToken = shouldStartBuild === undefined ? '' : ` shouldStartBuild=${shouldStartBuild ? 1 : 0}`;
    console.info(
      `[Broadphase State] frame=${frameId} bodies=${bodyCount} reason=${reason} ` +
      `hasBuiltOnce=${this.hasBuiltOnce ? 1 : 0} buildInFlight=${this.buildInFlight ? 1 : 0} ` +
      `bvhBuffersReady=${this.bvhBuffersReady ? 1 : 0} activeBvhIndex=${this.activeBvhIndex} ` +
      `activeBvhSnapshotFrame=${this.activeBvhSnapshotFrame} activeBvhAge=${activeAgeFrames} ` +
      `buildInFlightStartFrame=${this.buildInFlightStartFrame} buildInFlightAge=${inflightAgeFrames} ` +
      `lastBuildMs=${this.lastBuildMs.toFixed(3)} ` +
      `prewarmInFlight=${this.prewarmInFlight ? 1 : 0} ` +
      `backendReady=${this.backendBuffersReady ? 1 : 0} candidatePairsEnabled=${this.candidatePairsEnabled ? 1 : 0}` +
      shouldBuildToken,
    );
  }
}
