/**
 * GPU profiling for the solver and the raymarcher.
 *
 * Two things are measured, by two different means, because they answer different questions:
 *
 *  - *Attribution*, per solver pass, from WebGPU timestamp queries. The frame normally goes out
 *    as one compute group and so carries one pair of timestamps; to see inside it every pass is
 *    submitted as its own group for the duration of the run. That adds a command encoder per
 *    pass, so the per-pass figures sum to slightly more than a real frame — they are a breakdown,
 *    not a budget.
 *
 *  - *Budget*, per stage, by ablation: run the stage, then run the frame without it, and take the
 *    difference. This is what actually answers "how much would I get back", and it is measured on
 *    the batched path the application really uses.
 *
 * Where timestamp queries are unavailable the pass breakdown falls back to repeating a single
 * pass many times behind one queue fence, which costs one synchronisation instead of hundreds.
 */
import type { Renderer } from 'three/webgpu';
import type { KoraSolver } from '../sim/KoraSolver';

/* eslint-disable @typescript-eslint/no-explicit-any */
type N = any;

interface TimestampPool {
  timestamps: Map<string, number>;
}

interface ProfilerBackend {
  device: GPUDevice;
  trackTimestamp: boolean;
  timestampQueryPool: Record<string, TimestampPool | null>;
  getTimestampUID(context: unknown): string;
}

export interface PassRow {
  pass: string;
  ms: number;
  /** share of the summed pass time */
  pct: number;
  calls: number;
}

export interface StageRow {
  stage: string;
  ms: number;
  pct: number;
}

export interface ProfileResult {
  /** wall-clock milliseconds for a complete frame, GPU work included */
  frameMs: number;
  fps: number;
  passes: PassRow[];
  groups: PassRow[];
  stages: StageRow[];
  method: 'timestamp' | 'fence';
  notes: string[];
}

export interface ProfileTargets {
  renderer: Renderer;
  solver: KoraSolver;
  /** draws the frame exactly as the application does */
  render: () => void;
  /** hides or shows the volume mesh, for the raymarch ablation */
  setVolumeVisible: (visible: boolean) => void;
  /** sets bloom strength, for the post ablation */
  setBloom: (strength: number) => void;
  bloomStrength: number;
}

export interface ProfileOptions {
  /** measured frames per phase */
  frames?: number;
  /** frames run and discarded first, so pipeline compilation is not counted */
  warmup?: number;
  dt?: number;
}

function backendOf(renderer: Renderer): ProfilerBackend {
  return (renderer as unknown as { backend: ProfilerBackend }).backend;
}

/**
 * Whether the device can timestamp at all, decided once by three during initialisation.
 *
 * Tracking is left off outside a profiling run. The query pool holds 2048 entries and only
 * empties when something resolves it, so leaving it armed would silently exhaust it after a few
 * hundred frames and then quietly hand back nothing the next time a profile was asked for.
 */
let timestampsSupported: boolean | null = null;

export function disarmTimestamps(renderer: Renderer): void {
  const backend = backendOf(renderer);
  timestampsSupported = backend.trackTimestamp === true;
  backend.trackTimestamp = false;
}

/** Wall-clock milliseconds per iteration, with the GPU drained before the clock stops. */
async function timed(device: GPUDevice, iterations: number, work: () => void): Promise<number> {
  await device.queue.onSubmittedWorkDone();
  const start = performance.now();
  for (let i = 0; i < iterations; i++) work();
  await device.queue.onSubmittedWorkDone();
  return (performance.now() - start) / iterations;
}

/**
 * Passes are named `stage.detail` — `pressure.7`, `cascade.2.r0.x` — so the leading token
 * collapses the two dozen blur and Jacobi dispatches into the stage a reader can act on.
 */
function groupOf(label: string): string {
  const head = label.split('.')[0];
  return head === 'massDiffusion' || head === 'thermalConduction' ? 'diffusion' : head;
}

function tabulate(totals: Map<string, { ms: number; calls: number }>): PassRow[] {
  const sum = [...totals.values()].reduce((a, t) => a + t.ms, 0) || 1;
  return [...totals.entries()]
    .map(([pass, t]) => ({ pass, ms: t.ms, pct: (t.ms / sum) * 100, calls: t.calls }))
    .sort((a, b) => b.ms - a.ms);
}

function accumulate(
  totals: Map<string, { ms: number; calls: number }>,
  label: string,
  ms: number,
): void {
  const entry = totals.get(label) ?? { ms: 0, calls: 0 };
  entry.ms += ms;
  entry.calls += 1;
  totals.set(label, entry);
}

/** Per-pass GPU time from timestamp queries, one compute group per pass. */
async function passesByTimestamp(
  targets: ProfileTargets,
  frames: number,
  dt: number,
): Promise<Map<string, { ms: number; calls: number }>> {
  const { renderer, solver } = targets;
  const backend = backendOf(renderer);
  const totals = new Map<string, { ms: number; calls: number }>();

  for (let i = 0; i < frames; i++) {
    const dispatched: { label: string; uid: string }[] = [];

    solver.stepUnbatched(dt, (label, node: N) => {
      dispatched.push({ label, uid: backend.getTimestampUID(node) });
    });

    await renderer.resolveTimestampsAsync('compute');

    const pool = backend.timestampQueryPool.compute;
    if (!pool) break;

    for (const { label, uid } of dispatched) {
      const ms = pool.timestamps.get(uid);
      if (ms !== undefined) accumulate(totals, label, ms);
    }
  }

  for (const entry of totals.values()) entry.ms /= frames;
  return totals;
}

/**
 * Per-pass time without timestamp support: dispatch one pass `repeats` times behind a single
 * fence. The solver's kernels do no early-out, so repeating one is the same work every time.
 */
async function passesByFence(
  targets: ProfileTargets,
  repeats: number,
): Promise<Map<string, { ms: number; calls: number }>> {
  const { renderer, solver } = targets;
  const device = backendOf(renderer).device;
  const totals = new Map<string, { ms: number; calls: number }>();

  const empty = await timed(device, 1, () => {});

  for (const { label, node } of solver.framePasses(0)) {
    const ms = await timed(device, repeats, () => renderer.compute(node));
    accumulate(totals, label, Math.max(ms - empty, 0));
  }

  return totals;
}

/**
 * Measures the frame, then measures it again with one stage removed. Anything the ablation
 * cannot isolate is reported as the remainder rather than silently dropped.
 */
async function stageBudget(
  targets: ProfileTargets,
  frames: number,
  dt: number,
): Promise<{ stages: StageRow[]; frameMs: number }> {
  const { renderer, solver, render, setVolumeVisible, setBloom, bloomStrength } = targets;
  const device = backendOf(renderer).device;

  const frame = () => {
    solver.step(dt);
    render();
  };

  const frameMs = await timed(device, frames, frame);

  // Simulation, by running it with nothing drawn.
  const simOnly = await timed(device, frames, () => solver.step(dt));

  // Raymarch, as the difference the volume mesh makes to a frame that is otherwise identical.
  setVolumeVisible(false);
  const withoutVolume = await timed(device, frames, frame);
  setVolumeVisible(true);

  // Post, as the difference bloom makes.
  setBloom(0);
  const withoutBloom = await timed(device, frames, frame);
  setBloom(bloomStrength);

  const raymarch = Math.max(frameMs - withoutVolume, 0);
  const bloomMs = Math.max(frameMs - withoutBloom, 0);
  const rest = Math.max(frameMs - simOnly - raymarch - bloomMs, 0);

  const stages: StageRow[] = [
    { stage: 'simulation', ms: simOnly, pct: 0 },
    { stage: 'volume raymarch', ms: raymarch, pct: 0 },
    { stage: 'bloom + post', ms: bloomMs, pct: 0 },
    { stage: 'scene, present, other', ms: rest, pct: 0 },
  ];
  for (const s of stages) s.pct = (s.ms / (frameMs || 1)) * 100;

  return { stages: stages.sort((a, b) => b.ms - a.ms), frameMs };
}

export async function profile(
  targets: ProfileTargets,
  options: ProfileOptions = {},
): Promise<ProfileResult> {
  const { frames = 40, warmup = 30, dt = 1 / 60 } = options;
  const { renderer, solver, render } = targets;
  const backend = backendOf(renderer);
  const notes: string[] = [];

  for (let i = 0; i < warmup; i++) {
    solver.step(dt);
    render();
  }

  // The stage budget is wall-clock and wants the batched path untouched, so tracking stays off
  // for it and is armed only for the per-pass phase that actually reads the queries.
  const { stages, frameMs } = await stageBudget(targets, frames, dt);

  const canTimestamp = timestampsSupported ?? backend.trackTimestamp === true;
  let method: ProfileResult['method'] = 'timestamp';
  let totals: Map<string, { ms: number; calls: number }>;

  backend.trackTimestamp = canTimestamp;
  try {
    if (canTimestamp) {
      totals = await passesByTimestamp(targets, frames, dt);
      if (totals.size === 0) {
        notes.push('timestamp queries returned nothing; fell back to fenced timing');
        method = 'fence';
        totals = await passesByFence(targets, 200);
      }
    } else {
      notes.push('timestamp-query unavailable here; per-pass times are fenced estimates');
      method = 'fence';
      totals = await passesByFence(targets, 200);
    }
  } finally {
    backend.trackTimestamp = false;
  }

  const passes = tabulate(totals);

  const grouped = new Map<string, { ms: number; calls: number }>();
  for (const [label, t] of totals) {
    const key = groupOf(label);
    const entry = grouped.get(key) ?? { ms: 0, calls: 0 };
    entry.ms += t.ms;
    entry.calls += t.calls;
    grouped.set(key, entry);
  }

  notes.push(
    'per-pass figures come from unbatched dispatch and carry one command encoder each, so ' +
      'they oversum a real frame; use the stage table for what a cut would actually return',
  );

  return {
    frameMs,
    fps: 1000 / (frameMs || 1),
    passes,
    groups: tabulate(grouped),
    stages,
    method,
    notes,
  };
}

/** Prints a profile as three tables: stage budget, pass groups, then individual passes. */
export function printProfile(result: ProfileResult): void {
  const fixed = (rows: Record<string, number | string>[]) =>
    rows.map((r) =>
      Object.fromEntries(
        Object.entries(r).map(([k, v]) => [k, typeof v === 'number' ? Number(v.toFixed(3)) : v]),
      ),
    );

  console.group(
    `[kora] ${result.frameMs.toFixed(2)} ms/frame (${result.fps.toFixed(1)} fps) — ` +
      `pass times by ${result.method}`,
  );

  console.log('stage budget (ablation, batched path):');
  console.table(fixed(result.stages as unknown as Record<string, number | string>[]));

  console.log('solver passes, grouped:');
  console.table(fixed(result.groups as unknown as Record<string, number | string>[]));

  console.log('solver passes, individual:');
  console.table(fixed(result.passes as unknown as Record<string, number | string>[]));

  for (const note of result.notes) console.log(`note: ${note}`);
  console.groupEnd();
}
