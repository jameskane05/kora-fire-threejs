/**
 * Lean fire cost budget for the AVP sandbox (and XR entry on fire.html).
 *
 * Stereo volume raymarch + ~55 Euler dispatches cannot match MPM fill. Sandbox fire always runs
 * this budget so selecting Fire from the toolbar is already at headset settings — not desktop
 * `performance` (64³ / 8 Jacobi / 80 steps) with a second cut only after Enter VR.
 */
import { applyQuality, type Quality } from './quality';
import type { KoraParams } from '../sim/params';

export const IMMERSIVE_FIRE_BUDGET = {
  quality: 'performance' as Quality,
  /** 64³→40³ is ~4× fewer voxels on every pass; soft but still a readable torch. */
  resolution: 40,
  /** Pressure dominates the solver profile. */
  pressureIterations: 2,
  /** Off in XR — cascade pyramid + inject are several full-grid blurs for wispy detail. */
  energyCascadeBands: 0,
  macCormack: false,
  /**
   * Dual-eye fill; stride stretches to cover the ray. Temporal jitter covers most banding.
   */
  raymarchSteps: 18,
  /** Skip Kora diffusion/crust look — also drops the render-blur pyramid in the solver. */
  koraDiffusion: 0,
  koraCrust: 0,
  sparksEnabled: false,
} as const;

/** Smaller framed domain in XR → fewer raymarched fragments. */
export const IMMERSIVE_FIRE_FRAMED_SIZE = 0.3;

/** Solve every Nth presented frame in XR (raymarch still every frame). */
export const IMMERSIVE_FIRE_SOLVE_INTERVAL = 3;

export type ImmersiveFireSnapshot = {
  quality: Quality;
  resolution: number;
  pressureIterations: number;
  energyCascadeBands: number;
  macCormack: boolean;
  raymarchSteps: number;
  koraDiffusion: number;
  koraCrust: number;
  sparksEnabled: boolean;
};

export function snapshotFireBudget(params: KoraParams): ImmersiveFireSnapshot {
  return {
    quality: params.quality,
    resolution: params.resolution,
    pressureIterations: params.pressureIterations,
    energyCascadeBands: params.energyCascadeBands,
    macCormack: params.macCormack,
    raymarchSteps: params.raymarchSteps,
    koraDiffusion: params.koraDiffusion,
    koraCrust: params.koraCrust,
    sparksEnabled: params.sparksEnabled,
  };
}

export function restoreFireBudget(params: KoraParams, snap: ImmersiveFireSnapshot): void {
  params.quality = snap.quality;
  params.resolution = snap.resolution;
  params.pressureIterations = snap.pressureIterations;
  params.energyCascadeBands = snap.energyCascadeBands;
  params.macCormack = snap.macCormack;
  params.raymarchSteps = snap.raymarchSteps;
  params.koraDiffusion = snap.koraDiffusion;
  params.koraCrust = snap.koraCrust;
  params.sparksEnabled = snap.sparksEnabled;
}

/**
 * Force the lean fire budget. Returns true when the compute graph must be rebuilt
 * (resolution / Jacobi / bands / MacCormack changed).
 */
export function applyImmersiveFireBudget(params: KoraParams): boolean {
  const before = snapshotFireBudget(params);
  applyQuality(params, IMMERSIVE_FIRE_BUDGET.quality);
  params.resolution = IMMERSIVE_FIRE_BUDGET.resolution;
  params.pressureIterations = IMMERSIVE_FIRE_BUDGET.pressureIterations;
  params.energyCascadeBands = IMMERSIVE_FIRE_BUDGET.energyCascadeBands;
  params.macCormack = IMMERSIVE_FIRE_BUDGET.macCormack;
  params.raymarchSteps = IMMERSIVE_FIRE_BUDGET.raymarchSteps;
  params.koraDiffusion = IMMERSIVE_FIRE_BUDGET.koraDiffusion;
  params.koraCrust = IMMERSIVE_FIRE_BUDGET.koraCrust;
  params.sparksEnabled = IMMERSIVE_FIRE_BUDGET.sparksEnabled;
  return (
    before.resolution !== params.resolution ||
    before.pressureIterations !== params.pressureIterations ||
    before.energyCascadeBands !== params.energyCascadeBands ||
    before.macCormack !== params.macCormack ||
    before.koraDiffusion !== params.koraDiffusion ||
    before.koraCrust !== params.koraCrust
  );
}
