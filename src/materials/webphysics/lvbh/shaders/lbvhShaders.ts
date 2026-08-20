const WORKGROUP_SIZE = 256;

export const lbvhInitStateShader = /* wgsl */`
struct Uniforms {
  primCount: u32,
  _pad0: u32,
  _pad1: u32,
  _pad2: u32,
};

@group(0) @binding(0) var<uniform> uniforms: Uniforms;
@group(0) @binding(1) var<storage, read_write> parentIdx: array<u32>;
@group(0) @binding(2) var<storage, read_write> visitCount: array<atomic<u32>>;

const INVALID_IDX: u32 = 0xFFFFFFFFu;

@compute @workgroup_size(${WORKGROUP_SIZE})
fn initState(@builtin(global_invocation_id) globalId: vec3u) {
  let idx = globalId.x;
  let maxNodes = uniforms.primCount * 2u;
  if (idx >= maxNodes) {
    return;
  }

  parentIdx[idx] = INVALID_IDX;
  atomicStore(&visitCount[idx], 0u);
}
`;

export const lbvhBuildTopologyShader = /* wgsl */`
struct Uniforms {
  primCount: u32,
  _pad0: u32,
  _pad1: u32,
  _pad2: u32,
};

struct BVH2Node {
  boundsMin: vec3f,
  leftChild: u32,
  boundsMax: vec3f,
  rightChild: u32,
};

@group(0) @binding(0) var<uniform> uniforms: Uniforms;
@group(0) @binding(1) var<storage, read> mortonCodes: array<u32>;
@group(0) @binding(2) var<storage, read> clusterIdx: array<u32>;
@group(0) @binding(3) var<storage, read_write> bvh2Nodes: array<BVH2Node>;
@group(0) @binding(4) var<storage, read_write> parentIdx: array<u32>;

const INVALID_IDX: u32 = 0xFFFFFFFFu;

fn delta(idx: i32, other: i32, n: i32) -> i32 {
  if (other < 0 || other >= n) {
    return -1;
  }

  let a = u32(idx);
  let b = u32(other);
  let ka = mortonCodes[a];
  let kb = mortonCodes[b];

  if (ka == kb) {
    return 32 + i32(countLeadingZeros(a ^ b));
  }

  return i32(countLeadingZeros(ka ^ kb));
}

fn determineRange(idx: i32, n: i32) -> vec2i {
  if (idx == 0) {
    return vec2i(0, n - 1);
  }

  let deltaLeft = delta(idx, idx - 1, n);
  let deltaRight = delta(idx, idx + 1, n);
  let direction = select(-1, 1, deltaRight > deltaLeft);

  let deltaMin = delta(idx, idx - direction, n);
  var lMax = 2;
  loop {
    let nextIdx = idx + lMax * direction;
    if (delta(idx, nextIdx, n) <= deltaMin) {
      break;
    }
    lMax = lMax * 2;
  }

  var length = 0;
  var t = lMax / 2;
  loop {
    if (t <= 0) {
      break;
    }

    let nextLength = length + t;
    let nextIdx = idx + nextLength * direction;
    if (delta(idx, nextIdx, n) > deltaMin) {
      length = nextLength;
    }

    t = t / 2;
  }

  let j = idx + length * direction;
  if (direction < 0) {
    return vec2i(j, idx);
  }

  return vec2i(idx, j);
}

fn findSplit(first: i32, last: i32, n: i32) -> i32 {
  let commonPrefix = delta(first, last, n);
  var split = first;
  var step = last - first;

  loop {
    step = (step + 1) / 2;
    if (step <= 0) {
      break;
    }

    let candidate = split + step;
    if (candidate < last && delta(first, candidate, n) > commonPrefix) {
      split = candidate;
    }

    if (step == 1) {
      break;
    }
  }

  return split;
}

@compute @workgroup_size(${WORKGROUP_SIZE})
fn buildTopology(@builtin(global_invocation_id) globalId: vec3u) {
  let internalId = globalId.x;
  if (uniforms.primCount <= 1u || internalId >= uniforms.primCount - 1u) {
    return;
  }

  let n = i32(uniforms.primCount);
  let idx = i32(internalId);
  let range = determineRange(idx, n);
  let split = findSplit(range.x, range.y, n);

  let nodeIdx = uniforms.primCount + internalId;

  var leftChild = INVALID_IDX;
  if (split == range.x) {
    leftChild = clusterIdx[u32(split)];
  } else {
    leftChild = uniforms.primCount + u32(split);
  }

  var rightChild = INVALID_IDX;
  if (split + 1 == range.y) {
    rightChild = clusterIdx[u32(split + 1)];
  } else {
    rightChild = uniforms.primCount + u32(split + 1);
  }

  var node = bvh2Nodes[nodeIdx];
  node.leftChild = leftChild;
  node.rightChild = rightChild;
  bvh2Nodes[nodeIdx] = node;

  parentIdx[leftChild] = nodeIdx;
  parentIdx[rightChild] = nodeIdx;
}
`;

export const lbvhSeedInternalShader = /* wgsl */`
struct Uniforms {
  primCount: u32,
  _pad0: u32,
  _pad1: u32,
  _pad2: u32,
};

struct BVH2Node {
  boundsMin: vec3f,
  leftChild: u32,
  boundsMax: vec3f,
  rightChild: u32,
};

@group(0) @binding(0) var<uniform> uniforms: Uniforms;
@group(0) @binding(1) var<storage, read> clusterIdx: array<u32>;
@group(0) @binding(2) var<storage, read> parentIdx: array<u32>;
@group(0) @binding(3) var<storage, read_write> visitCount: array<atomic<u32>>;
@group(0) @binding(4) var<storage, read_write> activeListOut: array<u32>;
@group(0) @binding(5) var<storage, read_write> activeCountOut: atomic<u32>;

const INVALID_IDX: u32 = 0xFFFFFFFFu;

@compute @workgroup_size(${WORKGROUP_SIZE})
fn seedInternal(@builtin(global_invocation_id) globalId: vec3u) {
  let sortedLeafIdx = globalId.x;
  if (sortedLeafIdx >= uniforms.primCount) {
    return;
  }

  let leafNodeIdx = clusterIdx[sortedLeafIdx];
  let parent = parentIdx[leafNodeIdx];
  if (parent == INVALID_IDX) {
    return;
  }

  // First child arrival stores 0 -> 1, second stores 1 -> 2.
  // Only second arrival can enqueue this internal node as ready.
  let previous = atomicAdd(&visitCount[parent], 1u);
  if (previous == 1u) {
    let writeIdx = atomicAdd(&activeCountOut, 1u);
    activeListOut[writeIdx] = parent;
  }
}
`;

export const lbvhRefitWaveShader = /* wgsl */`
struct Uniforms {
  primCount: u32,
  _pad0: u32,
  _pad1: u32,
  _pad2: u32,
};

struct BVH2Node {
  boundsMin: vec3f,
  leftChild: u32,
  boundsMax: vec3f,
  rightChild: u32,
};

@group(0) @binding(0) var<uniform> uniforms: Uniforms;
@group(0) @binding(1) var<storage, read_write> bvh2Nodes: array<BVH2Node>;
@group(0) @binding(2) var<storage, read> parentIdx: array<u32>;
@group(0) @binding(3) var<storage, read_write> visitCount: array<atomic<u32>>;
@group(0) @binding(4) var<storage, read> activeListIn: array<u32>;
@group(0) @binding(5) var<storage, read_write> activeListOut: array<u32>;
@group(0) @binding(6) var<storage, read_write> activeCountIn: atomic<u32>;
@group(0) @binding(7) var<storage, read_write> activeCountOut: atomic<u32>;

const INVALID_IDX: u32 = 0xFFFFFFFFu;

@compute @workgroup_size(${WORKGROUP_SIZE})
fn refitWave(@builtin(global_invocation_id) globalId: vec3u) {
  // Keep the uniform binding live in auto-layout.
  if (uniforms.primCount == 0u) {
    return;
  }

  let idx = globalId.x;
  let activeCount = atomicLoad(&activeCountIn);
  if (idx >= activeCount) {
    return;
  }

  let nodeIdx = activeListIn[idx];
  if (nodeIdx == INVALID_IDX) {
    return;
  }

  let node = bvh2Nodes[nodeIdx];
  let c0 = node.leftChild;
  let c1 = node.rightChild;
  if (c0 == INVALID_IDX || c1 == INVALID_IDX) {
    return;
  }

  let mergedMin = min(bvh2Nodes[c0].boundsMin, bvh2Nodes[c1].boundsMin);
  let mergedMax = max(bvh2Nodes[c0].boundsMax, bvh2Nodes[c1].boundsMax);
  bvh2Nodes[nodeIdx].boundsMin = mergedMin;
  bvh2Nodes[nodeIdx].boundsMax = mergedMax;

  let parent = parentIdx[nodeIdx];
  if (parent == INVALID_IDX) {
    return;
  }

  let previous = atomicAdd(&visitCount[parent], 1u);
  if (previous == 1u) {
    let writeIdx = atomicAdd(&activeCountOut, 1u);
    activeListOut[writeIdx] = parent;
  }
}
`;

export const lbvhUpdateDispatchShader = /* wgsl */`
@group(0) @binding(0) var<storage, read_write> activeCountIn: atomic<u32>;
@group(0) @binding(1) var<storage, read_write> indirectDispatch: array<u32>;
@group(0) @binding(2) var<storage, read_write> activeCountOut: atomic<u32>;

const WORKGROUP_SIZE: u32 = ${WORKGROUP_SIZE}u;

@compute @workgroup_size(1)
fn updateDispatch() {
  let count = atomicLoad(&activeCountIn);
  let workgroups = (count + WORKGROUP_SIZE - 1u) / WORKGROUP_SIZE;
  indirectDispatch[0] = workgroups;
  indirectDispatch[1] = 1u;
  indirectDispatch[2] = 1u;
  atomicStore(&activeCountOut, 0u);
}
`;

export const lbvhFinalizeShader = /* wgsl */`
struct Uniforms {
  primCount: u32,
  _pad0: u32,
  _pad1: u32,
  _pad2: u32,
};

@group(0) @binding(0) var<uniform> uniforms: Uniforms;
@group(0) @binding(1) var<storage, read_write> clusterIdx: array<u32>;
@group(0) @binding(2) var<storage, read_write> nodeCounter: atomic<u32>;

@compute @workgroup_size(1)
fn finalizeTree() {
  if (uniforms.primCount == 0u) {
    atomicStore(&nodeCounter, 0u);
    return;
  }

  let rootIdx = select(0u, uniforms.primCount, uniforms.primCount > 1u);
  clusterIdx[0] = rootIdx;
  atomicStore(&nodeCounter, uniforms.primCount * 2u - 1u);
}
`;
