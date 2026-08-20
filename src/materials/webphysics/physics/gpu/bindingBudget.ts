import { REQUESTED_MAX_STORAGE_BUFFERS_PER_SHADER_STAGE } from '../../gpuLimits';

export function assertStorageBufferBudget(kernelName: string, storageBufferCount: number): void {
  if (storageBufferCount > REQUESTED_MAX_STORAGE_BUFFERS_PER_SHADER_STAGE) {
    throw new Error(
      `[${kernelName}] uses ${storageBufferCount} storage buffers; limit is ` +
      `${REQUESTED_MAX_STORAGE_BUFFERS_PER_SHADER_STAGE}.`,
    );
  }
}

