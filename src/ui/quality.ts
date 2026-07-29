/**
 * Quality tiers.
 *
 * The presets of §6 describe what a fire *is* — which fuel, how much of it, how it is lit and
 * how it is shaded. None of that should change when the frame budget does, so the two are kept
 * apart: a preset owns the look, a tier owns the cost, and a tier is applied after the preset.
 *
 * What each tier sets was chosen from measurement rather than taste. Profiling a 96^3 torch on an
 * M3 put 94% of the frame in the solver, and better than half of *that* in the pressure solve, so
 * the tiers move grid resolution and Jacobi iterations first and everything else second. The
 * raymarcher came in under 1.5 ms at 160 steps, which is why its step count barely moves until
 * the lowest tier — cutting it buys almost nothing and costs banding.
 */
import type { KoraParams } from '../sim/params';

export const QUALITY_TIERS = ['ultra', 'high', 'balanced', 'performance'] as const;
export type Quality = (typeof QUALITY_TIERS)[number];

export interface QualitySettings {
  /** grid is resolution^3; cost of every solver pass scales with it */
  resolution: number;
  /** Jacobi sweeps, the single largest line in the frame */
  pressureIterations: number;
  /** ECT bands, each costing three blur dispatches plus a noise fetch */
  energyCascadeBands: number;
  /** MacCormack costs a second advection and a limiter to keep detail off the dissipation */
  macCormack: boolean;
  raymarchSteps: number;
  /** render-target scale; the raymarcher is the only thing here that cares about pixels */
  pixelRatio: number;
  /**
   * Fraction of the headset's recommended eye resolution to render at.
   *
   * `pixelRatio` does nothing in a session — the projection layer's size comes from the
   * compositor, not from the canvas — so this is the tier's only pixel lever there, and it has to
   * be a far harsher one. A Vision Pro recommends 4851x3887 per eye, and there are two of them.
   */
  xrScale: number;
  note: string;
}

export const QUALITY: Record<Quality, QualitySettings> = {
  ultra: {
    resolution: 128,
    pressureIterations: 32,
    energyCascadeBands: 4,
    macCormack: true,
    raymarchSteps: 200,
    pixelRatio: 1.5,
    xrScale: 0.6,
    note: 'offline-ish: 2.1 M voxels, for stills and turntables',
  },
  high: {
    resolution: 96,
    pressureIterations: 24,
    energyCascadeBands: 4,
    macCormack: true,
    raymarchSteps: 160,
    pixelRatio: 1.5,
    xrScale: 0.5,
    note: 'the authored look; everything the paper describes, at full strength',
  },
  balanced: {
    resolution: 80,
    pressureIterations: 12,
    energyCascadeBands: 3,
    macCormack: true,
    raymarchSteps: 120,
    pixelRatio: 1.25,
    xrScale: 0.4,
    note: 'halves the solve and drops the coarsest turbulence band; reads the same in motion',
  },
  performance: {
    resolution: 64,
    pressureIterations: 8,
    energyCascadeBands: 2,
    macCormack: false,
    raymarchSteps: 80,
    pixelRatio: 1.0,
    xrScale: 0.3,
    note: 'game budget: softer plume and less fine detail, an order of magnitude cheaper',
  },
};

/**
 * Overwrites the cost parameters with the tier's, leaving everything about the look alone.
 *
 * The tiers hold absolute values rather than scale factors so that switching back and forth is
 * lossless — a multiplier applied to whatever happened to be there would compound every time.
 */
export function applyQuality(params: KoraParams, quality: Quality): KoraParams {
  const q = QUALITY[quality];

  params.quality = quality;
  params.resolution = q.resolution;
  params.pressureIterations = q.pressureIterations;
  params.energyCascadeBands = q.energyCascadeBands;
  params.macCormack = q.macCormack;
  params.raymarchSteps = q.raymarchSteps;

  return params;
}
