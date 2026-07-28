import { Vector3 } from 'three/webgpu';
import type { FuelName } from './constants';
import type { DebugChannel } from '../render/VolumeRenderer';
import type { Quality } from '../ui/quality';

/**
 * The artist-facing parameter set.
 *
 * Kora §5.2: "the full Loki solver graph contains hundreds of parameters, many correspond to
 * fixed physical constants or low-level numerical configuration choices that should remain
 * invariant across shots. Kora therefore exposes only those parameters which have a clear,
 * predictable impact on the visual character of fire and smoke." The named controls below are
 * the ones the paper calls out by name, plus the sourcing and art-direction knobs of §5.1/§5.3.
 */
export interface KoraParams {
  /** Name of the §6 preset last applied. Held here so it survives the GUI being rebuilt. */
  preset: string;
  /** Cost tier. Owns the solver's expensive knobs; the preset owns the look. */
  quality: Quality;

  // ---- solver / domain (expert; changing these rebuilds the solver) ----
  resolution: number;
  domainSize: number;
  substeps: number;
  pressureIterations: number;
  /** §4.4 — isobaric (eq. 5) vs. the hybrid isochoric + adiabatic expansion regime */
  adiabatic: boolean;
  /** §4.7.3 — semi-Lagrangian, optionally with a MacCormack error-correction pass */
  macCormack: boolean;

  // ---- sourcing, §5.1 ----
  fuel: FuelName;
  /** total emitted mixture concentration per second */
  sourceAmount: number;
  /** §5.1.1 — oxygen pre-mixing ratio, the inverse of the equivalence ratio */
  oxygenPremix: number;
  sourceTemperature: number;
  sourceRadius: number;
  sourceSpeed: number;
  sourceDirection: Vector3;
  sourcePosition: Vector3;
  /** length of the emission capsule; 0 gives a point source, >0 a jet */
  sourceLength: number;
  sourceEnabled: boolean;
  /** one-shot: dump a large hot fuel charge to detonate, exercising the adiabatic regime */
  detonationCharge: number;

  // ---- simulation control, §5.2 ----
  combustionRate: number;
  flameSpeed: number;
  emissivityAlpha: number;
  emissivityBeta: number;
  expansionRelaxation: number;
  massDiffusivity: number;
  thermalDiffusivity: number;
  energyCascadeStrength: number;
  energyCascadeBands: number;
  /** Rturb(l) of eq. (32) — per-band turbulence gain, coarse to fine */
  energyCascadeGain: number[];
  exactCascadeFilter: boolean;
  sootFormationRate: number;
  sootDissipationRate: number;
  sootOxidationRate: number;
  sootOxidationTemperature: number;
  fuelDissipationRate: number;
  ambientTemperature: number;

  // ---- art direction, §5.3 ----
  gravity: number;
  /** §5.3.1 — warped gravity producing a local updraft along a tilted axis */
  updraftStrength: number;
  updraftRadius: number;
  updraftTilt: number;
  /** §5.3.1 — truncated Coriolis force, eq. (36) */
  coriolis: number;
  coriolisRadialFalloff: number;
  wind: Vector3;
  /** §5.3.2 — frequency-domain guiding weight [Forootaninia and Narain 2020] */
  guidingWeight: number;
  guidingSwirl: number;
  guidingRise: number;

  // ---- rendering, §5.4 ----
  exposure: number;
  flameIntensity: number;
  /** §5.4.1 — hollow flame, eq. (41) */
  hollowFlame: number;
  sootDensity: number;
  sootAlbedo: number;
  smokeAmbient: number;
  /** §5.4.2 */
  koraDiffusion: number;
  koraCrust: number;
  raymarchSteps: number;
  bloom: number;
  showFlameFront: boolean;

  // ---- diagnostics ----
  /** Floor grid, world origin and simulation bounds, drawn behind the volume. */
  showGrid: boolean;
  debugView: DebugChannel;
  debugScale: number;
}

export const defaultParams: KoraParams = {
  preset: 'Torch',
  quality: 'high',

  resolution: 96,
  domainSize: 4.0,
  substeps: 1,
  pressureIterations: 24,
  adiabatic: true,
  macCormack: true,

  fuel: 'propane',
  sourceAmount: 2.2,
  oxygenPremix: 0.35,
  sourceTemperature: 1400,
  sourceRadius: 0.11,
  sourceSpeed: 3.0,
  sourceDirection: new Vector3(0, 1, 0),
  sourcePosition: new Vector3(0, 0.35, 0),
  sourceLength: 0.0,
  sourceEnabled: true,
  detonationCharge: 4.0,

  combustionRate: 26.0,
  flameSpeed: 0.45,
  emissivityAlpha: 0.55,
  emissivityBeta: 0.35,
  expansionRelaxation: 0.02,
  massDiffusivity: 2.2e-4,
  thermalDiffusivity: 3.0e-4,
  energyCascadeStrength: 1.0,
  energyCascadeBands: 4,
  energyCascadeGain: [0.6, 1.0, 1.0, 0.8, 0.5],
  exactCascadeFilter: false,
  sootFormationRate: 3.2,
  sootDissipationRate: 0.22,
  sootOxidationRate: 1.4,
  sootOxidationTemperature: 1350,
  fuelDissipationRate: 0.0,
  ambientTemperature: 288.15,

  gravity: 9.80665,
  updraftStrength: 0,
  updraftRadius: 0.35,
  updraftTilt: 0,
  coriolis: 0,
  coriolisRadialFalloff: 0.5,
  wind: new Vector3(0, 0, 0),
  guidingWeight: 0,
  guidingSwirl: 1.0,
  guidingRise: 1.0,

  exposure: 1.0,
  flameIntensity: 1.0,
  hollowFlame: 0.85,
  sootDensity: 26.0,
  sootAlbedo: 0.32,
  smokeAmbient: 0.06,
  koraDiffusion: 0.35,
  koraCrust: 0.3,
  raymarchSteps: 160,
  bloom: 0.5,
  showFlameFront: false,

  showGrid: true,
  debugView: 'off',
  debugScale: 1.0,
};

export function cloneParams(p: KoraParams): KoraParams {
  return {
    ...p,
    sourceDirection: p.sourceDirection.clone(),
    sourcePosition: p.sourcePosition.clone(),
    wind: p.wind.clone(),
    energyCascadeGain: [...p.energyCascadeGain],
  };
}
