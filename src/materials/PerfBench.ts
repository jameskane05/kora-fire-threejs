/**
 * Head-to-head timing: MLS-MPM goo (GPU) vs AVBD gel-cut (GPU via webphysics).
 *
 * Reports wall time around each step, plus GPU queue drain for MPM when available.
 */
import type { MlsMpm } from './MlsMpm';

export type AvbdBenchTarget = {
  setScene: (id: string) => boolean | void;
  prepareBench?: () => void;
  step: (dt: number, forces: []) => void;
  bodyCount: number;
  springCount: number;
  iterations: number;
};

export type BenchSample = {
  label: string;
  frames: number;
  avgMs: number;
  p95Ms: number;
  minMs: number;
  maxMs: number;
  /** Present for MPM when queue.onSubmittedWorkDone was awaited. */
  avgGpuDrainMs?: number;
  detail: string;
};

export type BenchReport = {
  startedAt: string;
  samples: BenchSample[];
  summary: string;
};

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const i = Math.min(sorted.length - 1, Math.floor(p * (sorted.length - 1)));
  return sorted[i];
}

function summarize(label: string, times: number[], detail: string, gpu?: number[]): BenchSample {
  const sorted = [...times].sort((a, b) => a - b);
  const sum = times.reduce((a, b) => a + b, 0);
  const sample: BenchSample = {
    label,
    frames: times.length,
    avgMs: sum / Math.max(times.length, 1),
    p95Ms: percentile(sorted, 0.95),
    minMs: sorted[0] ?? 0,
    maxMs: sorted[sorted.length - 1] ?? 0,
    detail,
  };
  if (gpu && gpu.length) {
    sample.avgGpuDrainMs = gpu.reduce((a, b) => a + b, 0) / gpu.length;
  }
  return sample;
}

export async function runGooVsAvbdBench(
  mpm: MlsMpm,
  avbd: AvbdBenchTarget,
  opts: { frames?: number; warmup?: number; dt?: number } = {},
): Promise<BenchReport> {
  const frames = opts.frames ?? 90;
  const warmup = opts.warmup ?? 20;
  const dt = opts.dt ?? 1 / 60;
  const device = mpm.gpuDevice;

  // --- MPM goo ---
  mpm.reset('goo');
  const mpmTimes: number[] = [];
  const mpmGpu: number[] = [];
  for (let i = 0; i < warmup + frames; i++) {
    const t0 = performance.now();
    mpm.step([]);
    if (device?.queue?.onSubmittedWorkDone) {
      const g0 = performance.now();
      await device.queue.onSubmittedWorkDone();
      if (i >= warmup) mpmGpu.push(performance.now() - g0);
    }
    const t1 = performance.now();
    if (i >= warmup) mpmTimes.push(t1 - t0);
  }

  // --- AVBD gel-cut (GPU) ---
  if (avbd.prepareBench) avbd.prepareBench();
  else avbd.setScene('gel-cut');
  const avbdTimes: number[] = [];
  for (let i = 0; i < warmup + frames; i++) {
    const t0 = performance.now();
    avbd.step(dt, []);
    if (device?.queue?.onSubmittedWorkDone) {
      await device.queue.onSubmittedWorkDone();
    }
    const t1 = performance.now();
    if (i >= warmup) avbdTimes.push(t1 - t0);
  }

  const mpmSample = summarize(
    'MLS-MPM goo',
    mpmTimes,
    `${mpm.particleCount} particles · ${mpm.gridN}³ · ${mpm.substeps} substeps (GPU)`,
    mpmGpu.length ? mpmGpu : undefined,
  );
  const avbdSample = summarize(
    'AVBD gel-cut',
    avbdTimes,
    `${avbd.bodyCount} bodies · ${avbd.springCount} springs · ${avbd.iterations} iters (GPU webphysics)`,
  );

  const ratio = avbdSample.avgMs / Math.max(mpmSample.avgMs, 1e-6);
  const summary =
    `MPM goo ${mpmSample.avgMs.toFixed(2)} ms/frame avg` +
    (mpmSample.avgGpuDrainMs !== undefined
      ? ` (GPU drain ${mpmSample.avgGpuDrainMs.toFixed(2)} ms)`
      : '') +
    ` · AVBD gel ${avbdSample.avgMs.toFixed(2)} ms/frame avg` +
    ` · AVBD/MPM = ${ratio.toFixed(2)}×`;

  return {
    startedAt: new Date().toISOString(),
    samples: [mpmSample, avbdSample],
    summary,
  };
}

export function formatBenchReport(report: BenchReport): string {
  const lines = [
    `Sandbox bench @ ${report.startedAt}`,
    report.summary,
    '',
    ...report.samples.map(
      (s) =>
        `${s.label}: avg ${s.avgMs.toFixed(2)} ms · p95 ${s.p95Ms.toFixed(2)} · ` +
        `min ${s.minMs.toFixed(2)} · max ${s.maxMs.toFixed(2)} · ${s.detail}`,
    ),
  ];
  return lines.join('\n');
}
