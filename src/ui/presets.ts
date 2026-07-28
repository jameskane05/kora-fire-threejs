import { Vector3 } from 'three/webgpu';
import { defaultParams, type KoraParams } from '../sim/params';

/**
 * Setups drawn from the production examples in Kora §6.
 *
 * The paper's point is that these are all the *same solver* with different sourcing and
 * art-direction settings — "Kora allowed a team of 100+ artists across 8 teams to create
 * consistent and physical results". None of these presets changes the combustion model.
 */
export interface Preset {
  name: string;
  note: string;
  params: Partial<KoraParams>;
  camera?: { position: [number, number, number]; target: [number, number, number] };
}

export const PRESETS: Preset[] = [
  {
    name: 'Torch',
    note: 'On-set reference case from §1: a small propane flame, lightly premixed so it stays sooty.',
    params: {
      fuel: 'propane',
      domainSize: 2.0,
      sourceAmount: 1.6,
      oxygenPremix: 0.3,
      sourceRadius: 0.06,
      sourceSpeed: 1.6,
      sourceTemperature: 1350,
      sourceLength: 0,
      sourcePosition: new Vector3(0, 0.2, 0),
      combustionRate: 24,
      sootFormationRate: 3.0,
      sootDissipationRate: 0.35,
      energyCascadeStrength: 1.0,
      coriolis: 0,
      updraftStrength: 0,
      guidingWeight: 0,
      adiabatic: false,
      expansionRelaxation: 0.02,
      exposure: 1.0,
      sootDensity: 30,
      hollowFlame: 0.9,
      koraCrust: 0.15,
      wind: new Vector3(0, 0, 0),
    },
    camera: { position: [1.5, 1.1, 1.9], target: [0, 0.7, 0] },
  },
  {
    name: 'Flame bar',
    note: 'A premixed line source. Raising the oxygen pre-mix ratio (§5.1.1, Fig. 10) gives the shorter, cleaner flames.',
    params: {
      fuel: 'methane',
      domainSize: 3.0,
      sourceAmount: 2.4,
      oxygenPremix: 0.85,
      sourceRadius: 0.05,
      sourceLength: 1.2,
      sourceDirection: new Vector3(0, 1, 0),
      sourcePosition: new Vector3(-0.6, 0.15, 0),
      sourceSpeed: 1.2,
      sourceTemperature: 1500,
      combustionRate: 40,
      sootFormationRate: 0.6,
      sootDissipationRate: 0.5,
      adiabatic: false,
      hollowFlame: 0.95,
      sootDensity: 14,
      exposure: 1.1,
    },
    camera: { position: [0.2, 1.4, 3.2], target: [0, 0.7, 0] },
  },
  {
    name: "Varang's flamethrower",
    note: 'A fast, fuel-rich acetylene jet fired sideways — §6. Liquid-fuel coupling is not ported, so this is the gaseous stand-in.',
    params: {
      fuel: 'acetylene',
      domainSize: 5.0,
      sourceAmount: 5.0,
      oxygenPremix: 0.12,
      sourceRadius: 0.13,
      sourceLength: 0.25,
      sourceDirection: new Vector3(1, 0.22, 0),
      sourcePosition: new Vector3(-1.9, 1.1, 0),
      sourceSpeed: 15.0,
      sourceTemperature: 1500,
      combustionRate: 16,
      flameSpeed: 1.55,
      sootFormationRate: 5.0,
      sootDissipationRate: 0.12,
      sootOxidationRate: 0.8,
      energyCascadeStrength: 1.4,
      adiabatic: false,
      exposure: 0.85,
      sootDensity: 26,
      hollowFlame: 0.6,
      koraCrust: 0.35,
    },
    camera: { position: [0.6, 2.4, 6.0], target: [0.2, 1.3, 0] },
  },
  {
    name: 'Explosion',
    note: 'The §4.4 scenario: stamp a large fuel charge at high temperature so p >> p_atm, and let the adiabatic regime convert it into expansion with cooling.',
    params: {
      fuel: 'diesel',
      domainSize: 8.0,
      sourceEnabled: false,
      sourceAmount: 0,
      oxygenPremix: 0.55,
      sourceRadius: 0.5,
      sourceLength: 0,
      sourcePosition: new Vector3(0, 2.0, 0),
      sourceTemperature: 2600,
      sourceSpeed: 0,
      combustionRate: 30,
      adiabatic: true,
      expansionRelaxation: 0.008,
      sootFormationRate: 4.5,
      sootDissipationRate: 0.1,
      sootOxidationRate: 2.0,
      energyCascadeStrength: 1.6,
      pressureIterations: 32,
      exposure: 0.8,
      sootDensity: 22,
      koraCrust: 0.75,
      koraDiffusion: 0.55,
      hollowFlame: 0.45,
    },
    camera: { position: [3.0, 4.2, 9.5], target: [0, 2.4, 0] },
  },
  {
    name: 'Fire tornado',
    note: 'Figure 12: a warped gravity field for the updraft along a tilted axis, plus the truncated Coriolis force of eq. (36) for rotation.',
    params: {
      fuel: 'diesel',
      domainSize: 7.0,
      sourceAmount: 4.5,
      oxygenPremix: 0.28,
      sourceRadius: 0.55,
      sourceLength: 0,
      sourcePosition: new Vector3(0, 0.3, 0),
      sourceSpeed: 1.5,
      sourceTemperature: 1600,
      combustionRate: 20,
      sootFormationRate: 3.4,
      sootDissipationRate: 0.16,
      updraftStrength: 0.85,
      updraftRadius: 0.9,
      updraftTilt: 0.1,
      coriolis: 4.5,
      coriolisRadialFalloff: 1.6,
      energyCascadeStrength: 1.2,
      adiabatic: false,
      exposure: 0.9,
      sootDensity: 20,
      hollowFlame: 0.6,
      koraCrust: 0.25,
    },
    camera: { position: [4.5, 4.0, 8.0], target: [0, 3.0, 0] },
  },
  {
    name: 'Oxygen starvation',
    note: 'Deliberately fuel-rich with almost no premixed oxygen, so the flame can only burn where ambient air entrains — the choking and pulsation of §4.5.1.',
    params: {
      fuel: 'propane',
      domainSize: 3.0,
      sourceAmount: 3.6,
      oxygenPremix: 0.04,
      sourceRadius: 0.14,
      sourceLength: 0,
      sourceSpeed: 2.2,
      sourcePosition: new Vector3(0, 0.25, 0),
      sourceTemperature: 1450,
      combustionRate: 34,
      sootFormationRate: 4.0,
      sootDissipationRate: 0.1,
      sootOxidationRate: 1.8,
      adiabatic: false,
      exposure: 0.95,
      sootDensity: 30,
      hollowFlame: 0.85,
      showFlameFront: false,
    },
    camera: { position: [1.8, 1.6, 2.6], target: [0, 1.0, 0] },
  },
];

export function applyPreset(target: KoraParams, preset: Preset): KoraParams {
  const base: KoraParams = {
    ...defaultParams,
    resolution: target.resolution,
    raymarchSteps: target.raymarchSteps,
    substeps: target.substeps,
    sourceDirection: defaultParams.sourceDirection.clone(),
    sourcePosition: defaultParams.sourcePosition.clone(),
    wind: defaultParams.wind.clone(),
    energyCascadeGain: [...defaultParams.energyCascadeGain],
  };

  Object.assign(base, preset.params);
  base.preset = preset.name;
  return base;
}
