/**
 * Deduplicating reporter for uncaptured WebGPU errors.
 *
 * A single invalid pipeline re-reports itself on every frame, and each failure drags a cascade of
 * "invalid due to a previous error" messages along with it. Left alone that buries the one message
 * that matters and eventually takes the tab down with it. This logs each distinct error once, in
 * full, and thereafter only counts it.
 */
export interface GpuErrorReport {
  message: string;
  count: number;
  firstSeen: number;
}

const seen = new Map<string, GpuErrorReport>();

/** Collapses the parts of a validation message that vary per frame, so repeats match. */
function fingerprint(message: string): string {
  return message.replace(/_\d+/g, '_N').replace(/\s+/g, ' ').trim().slice(0, 400);
}

/** Cascade messages are consequences; the first distinct error is the one worth reading. */
function isCascade(message: string): boolean {
  return /is invalid( due to a previous error)?\.?$|due to a previous error/m.test(message);
}

export function installGpuErrorReporter(device: GPUDevice): Map<string, GpuErrorReport> {
  device.onuncapturederror = (event: GPUUncapturedErrorEvent) => {
    const message = event.error.message;
    const key = fingerprint(message);
    const existing = seen.get(key);

    if (existing) {
      existing.count++;
      if (existing.count === 50) {
        console.warn(
          `[kora] suppressing further repeats of a WebGPU error (seen 50x). ` +
            `Call kora.gpuErrors() for the full list.`,
        );
      }
      return;
    }

    seen.set(key, { message, count: 1, firstSeen: performance.now() });

    if (isCascade(message) && seen.size > 1) {
      console.warn('[kora] WebGPU follow-on error (a previous error is the real cause):', message);
    } else {
      console.error('[kora] WebGPU error:', message);
    }
  };

  return seen;
}

export function gpuErrorSummary(): GpuErrorReport[] {
  return [...seen.values()].sort((a, b) => a.firstSeen - b.firstSeen);
}
