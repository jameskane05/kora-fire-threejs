export class OneSweepSorter {
  constructor(device: GPUDevice);
  init(maxKeys: number): Promise<void>;
  sort(params: {
    commandEncoder: GPUCommandEncoder;
    keysIn: GPUBuffer;
    keysOut: GPUBuffer;
    valsIn: GPUBuffer;
    valsOut: GPUBuffer;
    count: number;
    timing?: {
      querySet: GPUQuerySet;
      beginIndex?: number;
      endIndex?: number;
    };
  }): { keysResult: GPUBuffer; valsResult: GPUBuffer };
  dispose(): void;
}
