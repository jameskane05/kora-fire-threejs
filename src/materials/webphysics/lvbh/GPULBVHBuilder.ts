import { setupShaders } from './shaders/setupShaders';
import { radixSortShaders } from './shaders/radixSortShaders';
import {
  lbvhInitStateShader,
  lbvhBuildTopologyShader,
  lbvhSeedInternalShader,
  lbvhRefitWaveShader,
  lbvhUpdateDispatchShader,
  lbvhFinalizeShader,
} from './shaders/lbvhShaders';
import { OneSweepSorter } from './sorting/OneSweepSorter.js';

const BUILD_WORKGROUP_SIZE = 256;
const RADIX_PASSES = 4;
const RADIX_WORKGROUP_SIZE = 256;
const RADIX_SIZE = 256;
const LBVH_REFIT_MAX_ITERATION_FACTOR = 4;
const UNIFORM_BYTES = 16;
const UNIFORM_ALIGN = 256;
const UNIFORM_SETUP_OFFSET = 0 * UNIFORM_ALIGN;
const UNIFORM_MORTON_OFFSET = 1 * UNIFORM_ALIGN;
const UNIFORM_LBVH_OFFSET = 2 * UNIFORM_ALIGN;
const UNIFORM_RADIX_BASE_OFFSET = 3 * UNIFORM_ALIGN;
const UNIFORM_SLOT_COUNT = 3 + RADIX_PASSES;

export const LBVHSorterType = {
  BUILTIN: 'builtin',
  ONESWEEP: 'onesweep',
} as const;

export type LBVHSorterTypeValue = typeof LBVHSorterType[keyof typeof LBVHSorterType];

type BuildBuffers = {
  sceneBounds: GPUBuffer;
  mortonCodes: GPUBuffer;
  mortonCodesAlt: GPUBuffer;
  clusterIdx: GPUBuffer;
  clusterIdxAlt: GPUBuffer;
  hplocState: GPUBuffer;
  activeList: GPUBuffer;
  parentIdx: GPUBuffer;
  refitVisitCount: GPUBuffer;
  activeCount0: GPUBuffer;
  activeCount1: GPUBuffer;
  indirectDispatch: GPUBuffer;
  bvh2Nodes: GPUBuffer;
  nodeCounter: GPUBuffer;
  groupCounts: GPUBuffer;
  groupPrefix: GPUBuffer;
  globalDigitCount: GPUBuffer;
  digitOffsets: GPUBuffer;
  uniforms: GPUBuffer;
};

type Pipelines = {
  setupBounds: GPUComputePipeline;
  setupMorton: GPUComputePipeline;
  radixHistogram: GPUComputePipeline;
  radixWorkgroupScan: GPUComputePipeline;
  radixScan: GPUComputePipeline;
  radixScatter: GPUComputePipeline;
  lbvhInitState: GPUComputePipeline;
  lbvhBuildTopology: GPUComputePipeline;
  lbvhSeedInternal: GPUComputePipeline;
  lbvhRefitWave: GPUComputePipeline;
  lbvhUpdateDispatch: GPUComputePipeline;
  lbvhFinalize: GPUComputePipeline;
};

type BuildOptions = {
  positionBuffer: GPUBuffer;
  indexBuffer: GPUBuffer;
  primCount: number;
  positionStride?: number;
  useFlatten?: boolean;
  waitForGpuCompletion?: boolean;
};

export class GPULBVHBuilder {
  private readonly device: GPUDevice;
  private readonly requestedSorterType: LBVHSorterTypeValue;
  private warnedNoSubgroups = false;

  private sorter: any = null;
  private sorterCapacity = 0;

  private pipelines: Pipelines | null = null;
  private buildBuffers: BuildBuffers | null = null;
  private bufferCapacity = 0;
  private sorterInitPromise: Promise<void> | null = null;
  private prewarmPromise: Promise<void> | null = null;
  private staticBindGroups: {
    setupBounds: GPUBindGroup | null;
    setupMorton: GPUBindGroup | null;
    lbvhInitState: GPUBindGroup | null;
    lbvhBuildTopology: GPUBindGroup | null;
    lbvhSeedInternal: GPUBindGroup | null;
    lbvhRefitWave0to1: GPUBindGroup | null;
    lbvhRefitWave1to0: GPUBindGroup | null;
    lbvhUpdateDispatch0to1: GPUBindGroup | null;
    lbvhUpdateDispatch1to0: GPUBindGroup | null;
    lbvhFinalize: GPUBindGroup | null;
  } = {
    setupBounds: null,
    setupMorton: null,
    lbvhInitState: null,
    lbvhBuildTopology: null,
    lbvhSeedInternal: null,
    lbvhRefitWave0to1: null,
    lbvhRefitWave1to0: null,
    lbvhUpdateDispatch0to1: null,
    lbvhUpdateDispatch1to0: null,
    lbvhFinalize: null,
  };
  private staticBindGroupBuffers: {
    buildBuffers: BuildBuffers | null;
    position: GPUBuffer | null;
    index: GPUBuffer | null;
  } = {
    buildBuffers: null,
    position: null,
    index: null,
  };

  private positionBuffer: GPUBuffer | null = null;
  private indexBuffer: GPUBuffer | null = null;
  private primCount = 0;
  private positionStride = 3;

  constructor(device: GPUDevice, options: { sorterType?: LBVHSorterTypeValue } = {}) {
    this.device = device;
    this.requestedSorterType = options.sorterType ?? LBVHSorterType.ONESWEEP;
  }

  get bvh2Buffer(): GPUBuffer | null {
    return this.buildBuffers ? this.buildBuffers.bvh2Nodes : null;
  }

  get clusterIdxBuffer(): GPUBuffer | null {
    return this.buildBuffers ? this.buildBuffers.clusterIdx : null;
  }

  get maxNodeCount(): number {
    return this.primCount > 0 ? this.primCount * 2 : 0;
  }

  async prewarm(primCapacity: number): Promise<void> {
    if (this.prewarmPromise) {
      return this.prewarmPromise;
    }

    const target = Math.max(1, primCapacity | 0);
    this.prewarmPromise = (async () => {
      this.allocateBuffers(target);
      this.ensurePipelines();
      await this.ensureSorter(target);
    })().finally(() => {
      this.prewarmPromise = null;
    });

    return this.prewarmPromise;
  }

  async buildAsyncFromGPUBuffers(options: BuildOptions): Promise<void> {
    const {
      positionBuffer,
      indexBuffer,
      primCount,
      positionStride = 3,
      waitForGpuCompletion = true,
    } = options;

    this.positionBuffer = positionBuffer;
    this.indexBuffer = indexBuffer;
    this.primCount = Math.max(0, primCount | 0);
    this.positionStride = positionStride;

    if (this.prewarmPromise) {
      await this.prewarmPromise;
    }

    this.allocateBuffers(this.primCount);
    this.ensurePipelines();
    await this.ensureSorter(this.primCount);
    this.initBuildState();
    this.ensureStaticBindGroups();

    if (this.primCount === 0 || !this.buildBuffers || !this.pipelines) {
      if (waitForGpuCompletion) {
        await this.device.queue.onSubmittedWorkDone();
      }
      return;
    }

    const useOneSweep = this.shouldUseOneSweep();
    const encoder = this.device.createCommandEncoder({ label: 'LBVH Build Encoder' });
    this.recordSetupPass(encoder, this.primCount);
    if (useOneSweep) {
      this.recordOneSweepSort(encoder, this.primCount);
    } else {
      this.recordBuiltinRadixSort(encoder, this.primCount);
    }
    this.recordLBVHPass(encoder, this.primCount);
    this.device.queue.submit([encoder.finish()]);

    if (waitForGpuCompletion) {
      await this.device.queue.onSubmittedWorkDone();
    }
  }

  dispose(): void {
    if (this.sorter) {
      this.sorter.dispose();
      this.sorter = null;
    }

    if (this.buildBuffers) {
      const buffers = this.buildBuffers as Record<string, GPUBuffer>;
      for (const key of Object.keys(buffers)) {
        buffers[key].destroy();
      }
      this.buildBuffers = null;
    }

    this.pipelines = null;
    this.positionBuffer = null;
    this.indexBuffer = null;
    this.bufferCapacity = 0;
    this.sorterCapacity = 0;
    this.staticBindGroups.setupBounds = null;
    this.staticBindGroups.setupMorton = null;
    this.staticBindGroups.lbvhInitState = null;
    this.staticBindGroups.lbvhBuildTopology = null;
    this.staticBindGroups.lbvhSeedInternal = null;
    this.staticBindGroups.lbvhRefitWave0to1 = null;
    this.staticBindGroups.lbvhRefitWave1to0 = null;
    this.staticBindGroups.lbvhUpdateDispatch0to1 = null;
    this.staticBindGroups.lbvhUpdateDispatch1to0 = null;
    this.staticBindGroups.lbvhFinalize = null;
    this.staticBindGroupBuffers.buildBuffers = null;
    this.staticBindGroupBuffers.position = null;
    this.staticBindGroupBuffers.index = null;
  }

  private shouldUseOneSweep(): boolean {
    if (this.requestedSorterType !== LBVHSorterType.ONESWEEP) {
      return false;
    }

    const hasSubgroups = this.device.features.has('subgroups' as GPUFeatureName);
    if (!hasSubgroups && !this.warnedNoSubgroups) {
      this.warnedNoSubgroups = true;
      console.warn('GPULBVHBuilder: subgroups unavailable, falling back to builtin radix sort.');
    }
    return hasSubgroups;
  }

  private ensurePipelines(): void {
    if (this.pipelines) {
      return;
    }

    const hasSubgroups = this.device.features.has('subgroups' as GPUFeatureName);
    const setupBoundsShader = hasSubgroups ? setupShaders.computeBoundsSubgroup : setupShaders.computeBounds;

    const setupBoundsModule = this.device.createShaderModule({
      label: 'LBVH setupBounds',
      code: setupBoundsShader,
    });
    const setupMortonModule = this.device.createShaderModule({
      label: 'LBVH setupMorton',
      code: setupShaders.computeMorton,
    });

    const radixHistogramModule = this.device.createShaderModule({
      label: 'LBVH radixHistogram',
      code: radixSortShaders.histogram,
    });
    const radixWorkgroupScanModule = this.device.createShaderModule({
      label: 'LBVH radixWorkgroupScan',
      code: radixSortShaders.workgroupScan,
    });
    const radixScanModule = this.device.createShaderModule({
      label: 'LBVH radixScan',
      code: radixSortShaders.scan,
    });
    const radixScatterModule = this.device.createShaderModule({
      label: 'LBVH radixScatter',
      code: radixSortShaders.scatter,
    });

    const lbvhInitStateModule = this.device.createShaderModule({
      label: 'LBVH initState',
      code: lbvhInitStateShader,
    });
    const lbvhBuildTopologyModule = this.device.createShaderModule({
      label: 'LBVH buildTopology',
      code: lbvhBuildTopologyShader,
    });
    const lbvhSeedInternalModule = this.device.createShaderModule({
      label: 'LBVH seedInternal',
      code: lbvhSeedInternalShader,
    });
    const lbvhRefitWaveModule = this.device.createShaderModule({
      label: 'LBVH refitWave',
      code: lbvhRefitWaveShader,
    });
    const lbvhUpdateDispatchModule = this.device.createShaderModule({
      label: 'LBVH updateDispatch',
      code: lbvhUpdateDispatchShader,
    });
    const lbvhFinalizeModule = this.device.createShaderModule({
      label: 'LBVH finalize',
      code: lbvhFinalizeShader,
    });

    this.pipelines = {
      setupBounds: this.device.createComputePipeline({
        label: 'LBVH Setup Bounds',
        layout: 'auto',
        compute: { module: setupBoundsModule, entryPoint: 'computeBounds' },
      }),
      setupMorton: this.device.createComputePipeline({
        label: 'LBVH Setup Morton',
        layout: 'auto',
        compute: { module: setupMortonModule, entryPoint: 'computeMorton' },
      }),
      radixHistogram: this.device.createComputePipeline({
        label: 'LBVH Radix Histogram',
        layout: 'auto',
        compute: { module: radixHistogramModule, entryPoint: 'computeHistogram' },
      }),
      radixWorkgroupScan: this.device.createComputePipeline({
        label: 'LBVH Radix WorkgroupScan',
        layout: 'auto',
        compute: { module: radixWorkgroupScanModule, entryPoint: 'workgroupScan' },
      }),
      radixScan: this.device.createComputePipeline({
        label: 'LBVH Radix Scan',
        layout: 'auto',
        compute: { module: radixScanModule, entryPoint: 'prefixScan' },
      }),
      radixScatter: this.device.createComputePipeline({
        label: 'LBVH Radix Scatter',
        layout: 'auto',
        compute: { module: radixScatterModule, entryPoint: 'scatter' },
      }),
      lbvhInitState: this.device.createComputePipeline({
        label: 'LBVH Init State',
        layout: 'auto',
        compute: { module: lbvhInitStateModule, entryPoint: 'initState' },
      }),
      lbvhBuildTopology: this.device.createComputePipeline({
        label: 'LBVH Build Topology',
        layout: 'auto',
        compute: { module: lbvhBuildTopologyModule, entryPoint: 'buildTopology' },
      }),
      lbvhSeedInternal: this.device.createComputePipeline({
        label: 'LBVH Seed Internal',
        layout: 'auto',
        compute: { module: lbvhSeedInternalModule, entryPoint: 'seedInternal' },
      }),
      lbvhRefitWave: this.device.createComputePipeline({
        label: 'LBVH Refit Wave',
        layout: 'auto',
        compute: { module: lbvhRefitWaveModule, entryPoint: 'refitWave' },
      }),
      lbvhUpdateDispatch: this.device.createComputePipeline({
        label: 'LBVH Update Dispatch',
        layout: 'auto',
        compute: { module: lbvhUpdateDispatchModule, entryPoint: 'updateDispatch' },
      }),
      lbvhFinalize: this.device.createComputePipeline({
        label: 'LBVH Finalize',
        layout: 'auto',
        compute: { module: lbvhFinalizeModule, entryPoint: 'finalizeTree' },
      }),
    };
  }

  private async ensureSorter(primCount: number): Promise<void> {
    if (!this.shouldUseOneSweep()) {
      return;
    }

    if (!this.sorter) {
      this.sorter = new OneSweepSorter(this.device);
    }

    const targetCapacity = Math.max(primCount, 1);
    if (this.sorterInitPromise) {
      await this.sorterInitPromise;
    }
    if (this.sorterCapacity < targetCapacity) {
      this.sorterInitPromise = this.sorter.init(targetCapacity).then(() => {
        this.sorterCapacity = targetCapacity;
      }).finally(() => {
        this.sorterInitPromise = null;
      });
      await this.sorterInitPromise;
    }
  }

  private allocateBuffers(primCount: number): void {
    if (primCount <= this.bufferCapacity && this.buildBuffers) {
      return;
    }

    const newCapacity = Math.max(1024, this.nextPowerOf2(Math.max(1, primCount)));
    const workgroupCount = Math.max(1, Math.ceil(newCapacity / RADIX_WORKGROUP_SIZE));
    const maxNodes = Math.max(2, newCapacity * 2);

    if (this.buildBuffers) {
      const old = this.buildBuffers as Record<string, GPUBuffer>;
      for (const key of Object.keys(old)) {
        old[key].destroy();
      }
      this.staticBindGroups.setupBounds = null;
      this.staticBindGroups.setupMorton = null;
      this.staticBindGroups.lbvhInitState = null;
      this.staticBindGroups.lbvhBuildTopology = null;
      this.staticBindGroups.lbvhSeedInternal = null;
      this.staticBindGroups.lbvhRefitWave0to1 = null;
      this.staticBindGroups.lbvhRefitWave1to0 = null;
      this.staticBindGroups.lbvhUpdateDispatch0to1 = null;
      this.staticBindGroups.lbvhUpdateDispatch1to0 = null;
      this.staticBindGroups.lbvhFinalize = null;
      this.staticBindGroupBuffers.buildBuffers = null;
      this.staticBindGroupBuffers.position = null;
      this.staticBindGroupBuffers.index = null;
    }

    this.buildBuffers = {
      sceneBounds: this.device.createBuffer({
        label: 'LBVH Scene Bounds',
        size: 24,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
      }),
      mortonCodes: this.device.createBuffer({
        label: 'LBVH Morton',
        size: newCapacity * 4,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
      }),
      mortonCodesAlt: this.device.createBuffer({
        label: 'LBVH Morton Alt',
        size: newCapacity * 4,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
      }),
      clusterIdx: this.device.createBuffer({
        label: 'LBVH ClusterIdx',
        size: newCapacity * 4,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
      }),
      clusterIdxAlt: this.device.createBuffer({
        label: 'LBVH ClusterIdx Alt',
        size: newCapacity * 4,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
      }),
      hplocState: this.device.createBuffer({
        label: 'LBVH HplocState Scratch',
        size: newCapacity * 4 * 4,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
      }),
      activeList: this.device.createBuffer({
        label: 'LBVH ActiveList Scratch',
        size: newCapacity * 4,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
      }),
      parentIdx: this.device.createBuffer({
        label: 'LBVH ParentIdx',
        size: maxNodes * 4,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
      }),
      refitVisitCount: this.device.createBuffer({
        label: 'LBVH VisitCount',
        size: maxNodes * 4,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
      }),
      activeCount0: this.device.createBuffer({
        label: 'LBVH ActiveCount0',
        size: 4,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
      }),
      activeCount1: this.device.createBuffer({
        label: 'LBVH ActiveCount1',
        size: 4,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
      }),
      indirectDispatch: this.device.createBuffer({
        label: 'LBVH IndirectDispatch',
        size: 3 * 4,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.INDIRECT | GPUBufferUsage.COPY_DST,
      }),
      bvh2Nodes: this.device.createBuffer({
        label: 'LBVH Nodes',
        size: maxNodes * 32,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
      }),
      nodeCounter: this.device.createBuffer({
        label: 'LBVH NodeCounter',
        size: 4,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
      }),
      groupCounts: this.device.createBuffer({
        label: 'LBVH GroupCounts',
        size: workgroupCount * RADIX_SIZE * 4,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
      }),
      groupPrefix: this.device.createBuffer({
        label: 'LBVH GroupPrefix',
        size: workgroupCount * RADIX_SIZE * 4,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
      }),
      globalDigitCount: this.device.createBuffer({
        label: 'LBVH GlobalDigitCount',
        size: RADIX_SIZE * 4,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
      }),
      digitOffsets: this.device.createBuffer({
        label: 'LBVH DigitOffsets',
        size: RADIX_SIZE * 4,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
      }),
      uniforms: this.device.createBuffer({
        label: 'LBVH Uniforms',
        size: UNIFORM_ALIGN * UNIFORM_SLOT_COUNT,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      }),
    };

    this.bufferCapacity = newCapacity;
  }

  private ensureStaticBindGroups(): void {
    if (!this.buildBuffers || !this.pipelines || !this.positionBuffer || !this.indexBuffer) {
      return;
    }

    const needsRebuild =
      this.staticBindGroupBuffers.buildBuffers !== this.buildBuffers
      || this.staticBindGroupBuffers.position !== this.positionBuffer
      || this.staticBindGroupBuffers.index !== this.indexBuffer
      || !this.staticBindGroups.setupBounds
      || !this.staticBindGroups.setupMorton
      || !this.staticBindGroups.lbvhInitState
      || !this.staticBindGroups.lbvhBuildTopology
      || !this.staticBindGroups.lbvhSeedInternal
      || !this.staticBindGroups.lbvhRefitWave0to1
      || !this.staticBindGroups.lbvhRefitWave1to0
      || !this.staticBindGroups.lbvhUpdateDispatch0to1
      || !this.staticBindGroups.lbvhUpdateDispatch1to0
      || !this.staticBindGroups.lbvhFinalize;

    if (!needsRebuild) {
      return;
    }

    const b = this.buildBuffers;
    const p = this.pipelines;
    this.staticBindGroups.setupBounds = this.device.createBindGroup({
      layout: p.setupBounds.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: b.uniforms, offset: UNIFORM_SETUP_OFFSET, size: UNIFORM_BYTES } },
        { binding: 1, resource: { buffer: this.positionBuffer } },
        { binding: 2, resource: { buffer: this.indexBuffer } },
        { binding: 3, resource: { buffer: b.bvh2Nodes } },
        { binding: 4, resource: { buffer: b.clusterIdx } },
        { binding: 5, resource: { buffer: b.sceneBounds } },
        { binding: 6, resource: { buffer: b.parentIdx } },
        { binding: 7, resource: { buffer: b.hplocState } },
        { binding: 8, resource: { buffer: b.activeList } },
      ],
    });
    this.staticBindGroups.setupMorton = this.device.createBindGroup({
      layout: p.setupMorton.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: b.uniforms, offset: UNIFORM_MORTON_OFFSET, size: UNIFORM_BYTES } },
        { binding: 1, resource: { buffer: b.bvh2Nodes } },
        { binding: 2, resource: { buffer: b.sceneBounds } },
        { binding: 3, resource: { buffer: b.mortonCodes } },
      ],
    });
    this.staticBindGroups.lbvhInitState = this.device.createBindGroup({
      layout: p.lbvhInitState.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: b.uniforms, offset: UNIFORM_LBVH_OFFSET, size: UNIFORM_BYTES } },
        { binding: 1, resource: { buffer: b.parentIdx } },
        { binding: 2, resource: { buffer: b.refitVisitCount } },
      ],
    });
    this.staticBindGroups.lbvhBuildTopology = this.device.createBindGroup({
      layout: p.lbvhBuildTopology.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: b.uniforms, offset: UNIFORM_LBVH_OFFSET, size: UNIFORM_BYTES } },
        { binding: 1, resource: { buffer: b.mortonCodes } },
        { binding: 2, resource: { buffer: b.clusterIdx } },
        { binding: 3, resource: { buffer: b.bvh2Nodes } },
        { binding: 4, resource: { buffer: b.parentIdx } },
      ],
    });
    this.staticBindGroups.lbvhSeedInternal = this.device.createBindGroup({
      layout: p.lbvhSeedInternal.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: b.uniforms, offset: UNIFORM_LBVH_OFFSET, size: UNIFORM_BYTES } },
        { binding: 1, resource: { buffer: b.clusterIdx } },
        { binding: 2, resource: { buffer: b.parentIdx } },
        { binding: 3, resource: { buffer: b.refitVisitCount } },
        { binding: 4, resource: { buffer: b.activeList } },
        { binding: 5, resource: { buffer: b.activeCount0 } },
      ],
    });
    this.staticBindGroups.lbvhRefitWave0to1 = this.device.createBindGroup({
      layout: p.lbvhRefitWave.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: b.uniforms, offset: UNIFORM_LBVH_OFFSET, size: UNIFORM_BYTES } },
        { binding: 1, resource: { buffer: b.bvh2Nodes } },
        { binding: 2, resource: { buffer: b.parentIdx } },
        { binding: 3, resource: { buffer: b.refitVisitCount } },
        { binding: 4, resource: { buffer: b.activeList } },
        { binding: 5, resource: { buffer: b.clusterIdxAlt } },
        { binding: 6, resource: { buffer: b.activeCount0 } },
        { binding: 7, resource: { buffer: b.activeCount1 } },
      ],
    });
    this.staticBindGroups.lbvhRefitWave1to0 = this.device.createBindGroup({
      layout: p.lbvhRefitWave.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: b.uniforms, offset: UNIFORM_LBVH_OFFSET, size: UNIFORM_BYTES } },
        { binding: 1, resource: { buffer: b.bvh2Nodes } },
        { binding: 2, resource: { buffer: b.parentIdx } },
        { binding: 3, resource: { buffer: b.refitVisitCount } },
        { binding: 4, resource: { buffer: b.clusterIdxAlt } },
        { binding: 5, resource: { buffer: b.activeList } },
        { binding: 6, resource: { buffer: b.activeCount1 } },
        { binding: 7, resource: { buffer: b.activeCount0 } },
      ],
    });
    this.staticBindGroups.lbvhUpdateDispatch0to1 = this.device.createBindGroup({
      layout: p.lbvhUpdateDispatch.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: b.activeCount0 } },
        { binding: 1, resource: { buffer: b.indirectDispatch } },
        { binding: 2, resource: { buffer: b.activeCount1 } },
      ],
    });
    this.staticBindGroups.lbvhUpdateDispatch1to0 = this.device.createBindGroup({
      layout: p.lbvhUpdateDispatch.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: b.activeCount1 } },
        { binding: 1, resource: { buffer: b.indirectDispatch } },
        { binding: 2, resource: { buffer: b.activeCount0 } },
      ],
    });
    this.staticBindGroups.lbvhFinalize = this.device.createBindGroup({
      layout: p.lbvhFinalize.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: b.uniforms, offset: UNIFORM_LBVH_OFFSET, size: UNIFORM_BYTES } },
        { binding: 1, resource: { buffer: b.clusterIdx } },
        { binding: 2, resource: { buffer: b.nodeCounter } },
      ],
    });

    this.staticBindGroupBuffers.buildBuffers = this.buildBuffers;
    this.staticBindGroupBuffers.position = this.positionBuffer;
    this.staticBindGroupBuffers.index = this.indexBuffer;
  }

  private initBuildState(): void {
    if (!this.buildBuffers) {
      return;
    }

    // +Infinity for mins, -Infinity for maxs in sortable-u32 space
    const boundsInitU32 = new Uint32Array([
      0xFF800000, 0xFF800000, 0xFF800000,
      0x007FFFFF, 0x007FFFFF, 0x007FFFFF,
    ]);
    this.device.queue.writeBuffer(this.buildBuffers.sceneBounds, 0, boundsInitU32);
    this.device.queue.writeBuffer(this.buildBuffers.nodeCounter, 0, new Uint32Array([this.primCount]));
  }

  private recordSetupPass(commandEncoder: GPUCommandEncoder, primCount: number): void {
    if (!this.buildBuffers || !this.pipelines || !this.staticBindGroups.setupBounds || !this.staticBindGroups.setupMorton) {
      return;
    }

    const workgroupCount = Math.ceil(primCount / BUILD_WORKGROUP_SIZE);
    this.device.queue.writeBuffer(this.buildBuffers.uniforms, UNIFORM_SETUP_OFFSET, new Uint32Array([
      primCount,
      workgroupCount,
      this.positionStride,
      0,
    ]));
    this.device.queue.writeBuffer(this.buildBuffers.uniforms, UNIFORM_MORTON_OFFSET, new Uint32Array([
      primCount,
      workgroupCount,
      0,
      0,
    ]));

    const pass = commandEncoder.beginComputePass({ label: 'LBVH Setup Pass' });
    pass.setPipeline(this.pipelines.setupBounds);
    pass.setBindGroup(0, this.staticBindGroups.setupBounds);
    pass.dispatchWorkgroups(workgroupCount);
    pass.setPipeline(this.pipelines.setupMorton);
    pass.setBindGroup(0, this.staticBindGroups.setupMorton);
    pass.dispatchWorkgroups(workgroupCount);
    pass.end();
  }

  private recordOneSweepSort(commandEncoder: GPUCommandEncoder, primCount: number): void {
    if (!this.buildBuffers || !this.sorter) {
      return;
    }

    this.sorter.sort({
      commandEncoder,
      keysIn: this.buildBuffers.mortonCodes,
      keysOut: this.buildBuffers.mortonCodesAlt,
      valsIn: this.buildBuffers.clusterIdx,
      valsOut: this.buildBuffers.clusterIdxAlt,
      count: primCount,
    });
  }

  private recordBuiltinRadixSort(commandEncoder: GPUCommandEncoder, primCount: number): void {
    if (!this.buildBuffers || !this.pipelines) {
      return;
    }

    const workgroupCount = Math.ceil(primCount / RADIX_WORKGROUP_SIZE);
    commandEncoder.clearBuffer(this.buildBuffers.groupCounts);
    commandEncoder.clearBuffer(this.buildBuffers.groupPrefix);
    commandEncoder.clearBuffer(this.buildBuffers.digitOffsets);

    let keysIn = this.buildBuffers.mortonCodes;
    let keysOut = this.buildBuffers.mortonCodesAlt;
    let valsIn = this.buildBuffers.clusterIdx;
    let valsOut = this.buildBuffers.clusterIdxAlt;

    for (let passId = 0; passId < RADIX_PASSES; passId++) {
      const passUniformOffset = UNIFORM_RADIX_BASE_OFFSET + (passId * UNIFORM_ALIGN);
      this.device.queue.writeBuffer(
        this.buildBuffers.uniforms,
        passUniformOffset,
        new Uint32Array([primCount, passId * 8, workgroupCount, 0]),
      );

      commandEncoder.clearBuffer(this.buildBuffers.globalDigitCount);

      {
        const pass = commandEncoder.beginComputePass({ label: `LBVH Radix Histogram ${passId}` });
        const bindGroup = this.device.createBindGroup({
          layout: this.pipelines.radixHistogram.getBindGroupLayout(0),
          entries: [
            { binding: 0, resource: { buffer: this.buildBuffers.uniforms, offset: passUniformOffset, size: UNIFORM_BYTES } },
            { binding: 1, resource: { buffer: keysIn } },
            { binding: 2, resource: { buffer: this.buildBuffers.groupCounts } },
            { binding: 3, resource: { buffer: this.buildBuffers.globalDigitCount } },
          ],
        });
        pass.setPipeline(this.pipelines.radixHistogram);
        pass.setBindGroup(0, bindGroup);
        pass.dispatchWorkgroups(workgroupCount);
        pass.end();
      }

      {
        const pass = commandEncoder.beginComputePass({ label: `LBVH Radix WorkgroupScan ${passId}` });
        const bindGroup = this.device.createBindGroup({
          layout: this.pipelines.radixWorkgroupScan.getBindGroupLayout(0),
          entries: [
            { binding: 0, resource: { buffer: this.buildBuffers.uniforms, offset: passUniformOffset, size: UNIFORM_BYTES } },
            { binding: 1, resource: { buffer: this.buildBuffers.groupCounts } },
            { binding: 2, resource: { buffer: this.buildBuffers.groupPrefix } },
          ],
        });
        pass.setPipeline(this.pipelines.radixWorkgroupScan);
        pass.setBindGroup(0, bindGroup);
        pass.dispatchWorkgroups(1);
        pass.end();
      }

      {
        const pass = commandEncoder.beginComputePass({ label: `LBVH Radix Scan ${passId}` });
        const bindGroup = this.device.createBindGroup({
          layout: this.pipelines.radixScan.getBindGroupLayout(0),
          entries: [
            { binding: 1, resource: { buffer: this.buildBuffers.globalDigitCount } },
            { binding: 2, resource: { buffer: this.buildBuffers.digitOffsets } },
          ],
        });
        pass.setPipeline(this.pipelines.radixScan);
        pass.setBindGroup(0, bindGroup);
        pass.dispatchWorkgroups(1);
        pass.end();
      }

      {
        const pass = commandEncoder.beginComputePass({ label: `LBVH Radix Scatter ${passId}` });
        const bindGroup = this.device.createBindGroup({
          layout: this.pipelines.radixScatter.getBindGroupLayout(0),
          entries: [
            { binding: 0, resource: { buffer: this.buildBuffers.uniforms, offset: passUniformOffset, size: UNIFORM_BYTES } },
            { binding: 1, resource: { buffer: keysIn } },
            { binding: 2, resource: { buffer: keysOut } },
            { binding: 3, resource: { buffer: valsIn } },
            { binding: 4, resource: { buffer: valsOut } },
            { binding: 5, resource: { buffer: this.buildBuffers.groupPrefix } },
            { binding: 6, resource: { buffer: this.buildBuffers.digitOffsets } },
          ],
        });
        pass.setPipeline(this.pipelines.radixScatter);
        pass.setBindGroup(0, bindGroup);
        pass.dispatchWorkgroups(workgroupCount);
        pass.end();
      }
      [keysIn, keysOut] = [keysOut, keysIn];
      [valsIn, valsOut] = [valsOut, valsIn];
    }
  }

  private recordLBVHPass(commandEncoder: GPUCommandEncoder, primCount: number): void {
    if (
      !this.buildBuffers
      || !this.pipelines
      || !this.staticBindGroups.lbvhInitState
      || !this.staticBindGroups.lbvhBuildTopology
      || !this.staticBindGroups.lbvhSeedInternal
      || !this.staticBindGroups.lbvhRefitWave0to1
      || !this.staticBindGroups.lbvhRefitWave1to0
      || !this.staticBindGroups.lbvhUpdateDispatch0to1
      || !this.staticBindGroups.lbvhUpdateDispatch1to0
      || !this.staticBindGroups.lbvhFinalize
    ) {
      return;
    }

    this.device.queue.writeBuffer(
      this.buildBuffers.uniforms,
      UNIFORM_LBVH_OFFSET,
      new Uint32Array([primCount, 0, 0, 0]),
    );

    commandEncoder.clearBuffer(this.buildBuffers.activeCount0);
    commandEncoder.clearBuffer(this.buildBuffers.activeCount1);

    const pass = commandEncoder.beginComputePass({ label: 'LBVH Topology Pass' });

    pass.setPipeline(this.pipelines.lbvhInitState);
    pass.setBindGroup(0, this.staticBindGroups.lbvhInitState);
    pass.dispatchWorkgroups(Math.ceil((primCount * 2) / BUILD_WORKGROUP_SIZE));

    if (primCount > 1) {
      pass.setPipeline(this.pipelines.lbvhBuildTopology);
      pass.setBindGroup(0, this.staticBindGroups.lbvhBuildTopology);
      pass.dispatchWorkgroups(Math.ceil((primCount - 1) / BUILD_WORKGROUP_SIZE));

      pass.setPipeline(this.pipelines.lbvhSeedInternal);
      pass.setBindGroup(0, this.staticBindGroups.lbvhSeedInternal);
      pass.dispatchWorkgroups(Math.ceil(primCount / BUILD_WORKGROUP_SIZE));

      const maxIterations = this.getRefitMaxIterations(primCount);
      for (let iter = 0; iter < maxIterations; iter++) {
        const even = (iter & 1) === 0;
        pass.setPipeline(this.pipelines.lbvhUpdateDispatch);
        pass.setBindGroup(
          0,
          even ? this.staticBindGroups.lbvhUpdateDispatch0to1 : this.staticBindGroups.lbvhUpdateDispatch1to0,
        );
        pass.dispatchWorkgroups(1);

        pass.setPipeline(this.pipelines.lbvhRefitWave);
        pass.setBindGroup(
          0,
          even ? this.staticBindGroups.lbvhRefitWave0to1 : this.staticBindGroups.lbvhRefitWave1to0,
        );
        pass.dispatchWorkgroupsIndirect(this.buildBuffers.indirectDispatch, 0);
      }
    }

    pass.setPipeline(this.pipelines.lbvhFinalize);
    pass.setBindGroup(0, this.staticBindGroups.lbvhFinalize);
    pass.dispatchWorkgroups(1);

    pass.end();
  }

  private getRefitMaxIterations(primCount: number): number {
    if (primCount <= 1) {
      return 1;
    }
    return Math.max(1, Math.ceil(Math.log2(primCount) * LBVH_REFIT_MAX_ITERATION_FACTOR));
  }

  private nextPowerOf2(value: number): number {
    let v = Math.max(1, value | 0);
    v--;
    v |= v >> 1;
    v |= v >> 2;
    v |= v >> 4;
    v |= v >> 8;
    v |= v >> 16;
    v++;
    return v;
  }
}
