/**
 * `?avbdnoindirect=1` replaces GPU-driven indirect dispatches with conservative direct dispatches
 * at maximum capacity. The indirectly launched kernels all bound their thread id against the
 * GPU-side active count, so overdispatch is safe, just wasteful — this isolates whether a device
 * mishandles dispatchWorkgroupsIndirect (suspected on visionOS Safari, where the solve chain
 * silently freezes while the same code runs on macOS).
 */
import { debugParam } from '../../../avbdDebugFlags';

export const INDIRECT_DISPATCH_DISABLED: boolean = debugParam('avbdnoindirect') === '1';
