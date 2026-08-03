import { Vector3 } from 'three/webgpu';
import type { FuelName } from './constants';
import type { DebugChannel } from '../render/VolumeRenderer';
import type { Quality } from '../ui/quality';
import type { GizmoMode } from './obstacles';
import { DEFAULT_INTENSITY, type EnvironmentName } from '../scene/Environment';

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
  /**
   * Density of the delivered mixture, relative to still air.
   *
   * The emitter is an inflow boundary rather than a deposit, so this is the state of the gas
   * inside it, not a rate. 1 is atmospheric; above that is the deliberate over-fill the 2023 talk
   * describes artists wanting, which expansion then resolves. How *much* fire there is comes from
   * the emitter's geometry and exit speed, and its character from the pre-mixing ratio.
   */
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

  /**
   * How many displacement volumes the solver is built for.
   *
   * A build-time constant rather than a uniform: the primitives are unrolled into the kernels, so
   * an unused slot is not merely cheap but absent, and a scene with no obstacles pays nothing at
   * all. Adding or removing one recompiles; moving, turning or resizing one is a uniform write.
   */
  obstacleCount: number;
  /** What a drag does to the selected primitive, on the desktop gizmo and in the headset alike. */
  gizmoMode: GizmoMode;

  // ---- sparks (a particle system beside the grid, not part of it) ----
  sparksEnabled: boolean;
  /** population cap; spawning fills it as fast as the reaction zone allows */
  sparkCount: number;
  /** released heat a cell must exceed before it throws embers at all */
  sparkSpawnHeat: number;
  /** probability a well-burning cell throws an ember, per candidate test */
  sparkSpawnRate: number;
  /** isotropic kick at birth, m/s, on top of the local gas velocity */
  sparkEjectSpeed: number;
  sparkLife: number;
  /** 1 / tau of the drag that pulls an ember onto the gas velocity */
  sparkDrag: number;
  /** grey-body cooling coefficient, 3 eps sigma / (rho c r) */
  sparkCooling: number;
  sparkSize: number;
  /** metres of motion streak per m/s */
  sparkStreak: number;
  sparkIntensity: number;

  // ---- backdrop ----
  /** Image-based backdrop. Soot is dark grey and reads as nothing against an empty void. */
  environment: EnvironmentName;
  backgroundIntensity: number;

  // ---- diagnostics ----
  /** Floor grid, world origin and simulation bounds, drawn behind the volume. */
  showGrid: boolean;
  debugView: DebugChannel;
  debugScale: number;
}

export const defaultParams: KoraParams = {
  preset: 'Torch',
  quality: 'performance',

  resolution: 96,
  domainSize: 4.0,
  substeps: 1,
  pressureIterations: 24,
  adiabatic: true,
  macCormack: true,

  fuel: 'propane',
  sourceAmount: 1.0,
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
  sootFormationRate: 6.5,
  sootDissipationRate: 0.12,
  sootOxidationRate: 1.0,
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
  sootDensity: 280.0,
  sootAlbedo: 0.28,
  smokeAmbient: 0.16,
  koraDiffusion: 0.35,
  koraCrust: 0.3,
  raymarchSteps: 160,
  bloom: 0.5,
  showFlameFront: false,

  // One by default. It costs a millisecond, and a solid sitting in the plume is the quickest way
  // to see that the obstacles are part of the solve rather than drawn over it.
  obstacleCount: 1,
  gizmoMode: 'translate',

  sparksEnabled: true,
  sparkCount: 24000,
  sparkSpawnHeat: 0.8,
  sparkSpawnRate: 0.1,
  sparkEjectSpeed: 0.4,
  sparkLife: 1.8,
  sparkDrag: 0.9,
  sparkCooling: 8e-11,
  sparkSize: 0.004,
  sparkStreak: 0.008,
  sparkIntensity: 5.0,

  environment: 'dusk',
  backgroundIntensity: DEFAULT_INTENSITY.dusk,

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
