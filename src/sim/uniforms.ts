import { Vector3, Vector4 } from 'three/webgpu';
import { uniform } from 'three/tsl';
import {
  AIR_N2_FRACTION,
  AIR_N2_PER_O2,
  AIR_O2_FRACTION,
  FUELS,
  MOLAR_DENSITY_ATM,
  P_ATM,
  R_GAS,
  STEFAN_BOLTZMANN,
  T_ATM,
  speciesTable,
} from './constants';
import type { KoraParams } from './params';

/* eslint-disable @typescript-eslint/no-explicit-any */

export function createUniforms(params: KoraParams) {
  return {
    dt: uniform(1 / 60),
    dx: uniform(params.domainSize / params.resolution),
    time: uniform(0),
    /** world-space position of voxel (0,0,0)'s corner */
    origin: uniform(new Vector3()),

    // physical constants exposed so shaders read like the paper
    molarDensityAtm: uniform(MOLAR_DENSITY_ATM),
    pAtm: uniform(P_ATM),
    rGas: uniform(R_GAS),
    tAtm: uniform(T_ATM),
    sigma: uniform(STEFAN_BOLTZMANN),
    rhoAtm: uniform(0),
    ambientTemperature: uniform(params.ambientTemperature),
    /** Algorithm 1: 0 selects the isobaric regime (Cp), 1 the isochoric + adiabatic one (Cv) */
    adiabatic: uniform(1),

    // per-species molar properties: (fuel, O2, N2, product); soot reuses the fuel column (§4.5.1)
    molarMass: uniform(new Vector4()),
    cpMolar: uniform(new Vector4()),
    cvMolar: uniform(new Vector4()),
    /** relative mass diffusivity per species, Graham's law ~ 1/sqrt(M) */
    diffusivityScale: uniform(new Vector4()),

    // combustion, §4.5
    stoichO2: uniform(5),
    productMoles: uniform(7),
    enthalpy: uniform(2043.1e3),
    ignitionTemperature: uniform(743),
    flammabilityLean: uniform(0.51),
    flammabilityRich: uniform(2.5),
    combustionRate: uniform(params.combustionRate),
    flameSpeed: uniform(params.flameSpeed),
    sootFormationRate: uniform(params.sootFormationRate),
    sootOxidationRate: uniform(params.sootOxidationRate),
    sootOxidationTemperature: uniform(params.sootOxidationTemperature),
    sootDissipationRate: uniform(params.sootDissipationRate),
    fuelDissipationRate: uniform(params.fuelDissipationRate),

    // radiative cooling, §4.7.4
    emissivityAlpha: uniform(params.emissivityAlpha),
    emissivityBeta: uniform(params.emissivityBeta),

    // expansion, §4.3.3 / §4.4
    expansionRelaxation: uniform(params.expansionRelaxation),

    // diffusion, §4.7.2
    massDiffusivity: uniform(params.massDiffusivity),
    thermalDiffusivity: uniform(params.thermalDiffusivity),

    // sourcing, §5.1
    sourceP0: uniform(new Vector3()),
    sourceP1: uniform(new Vector3()),
    sourceRadius: uniform(params.sourceRadius),
    sourceVelocity: uniform(new Vector3()),
    sourceTemperature: uniform(params.sourceTemperature),
    /** premixed emission per second, as concentrations: (fuel, O2, N2, 0) */
    sourceMix: uniform(new Vector4()),
    /** one-shot charge multiplier, consumed on the frame it is set */
    sourceImpulse: uniform(0),

    // art direction, §5.3
    gravity: uniform(new Vector3(0, -9.80665, 0)),
    updraftStrength: uniform(0),
    updraftRadius: uniform(0.35),
    updraftAxis: uniform(new Vector3(0, 1, 0)),
    coriolis: uniform(new Vector3()),
    coriolisFalloff: uniform(0.5),
    wind: uniform(new Vector3()),
    windEnabled: uniform(0),
    guidingWeight: uniform(0),
    guidingSwirl: uniform(1),
    guidingRise: uniform(1),

    // energy cascade turbulence, §4.8
    ectStrength: uniform(1),
    /** Rturb(l) sampled per band, packed coarse-to-fine */
    ectGain: uniform(new Vector4(1, 1, 1, 1)),
    ectGain4: uniform(1),
  };
}

export type KoraUniforms = ReturnType<typeof createUniforms>;

/**
 * §5.1.1 pre-mixing. The artist gives a total emitted mixture amount and an oxygen pre-mixing
 * ratio; the source node turns that into absolute concentrations. Oxygen arrives as air, so it
 * drags 79/21 parts nitrogen with it — which is why raising the pre-mix ratio at a fixed total
 * mixture *reduces* the emitted fuel, and yields the shorter, cleaner flames of Figure 10.
 */
export function premix(totalAmount: number, oxygenPremixRatio: number, stoichO2: number) {
  const k = Math.max(oxygenPremixRatio, 0);
  const airPerFuel = k * stoichO2 * (1 + AIR_N2_PER_O2);
  const fuel = totalAmount / (1 + airPerFuel);
  const oxygen = k * stoichO2 * fuel;
  const nitrogen = oxygen * AIR_N2_PER_O2;
  return { fuel, oxygen, nitrogen };
}

export function syncUniforms(u: KoraUniforms, p: KoraParams): void {
  const fuel = FUELS[p.fuel];
  const s = speciesTable(fuel);

  u.dx.value = p.domainSize / p.resolution;
  u.ambientTemperature.value = p.ambientTemperature;
  u.adiabatic.value = p.adiabatic ? 1 : 0;
  u.rhoAtm.value =
    MOLAR_DENSITY_ATM * (AIR_O2_FRACTION * s.oxygen.M + AIR_N2_FRACTION * s.nitrogen.M);

  u.molarMass.value.set(s.fuel.M, s.oxygen.M, s.nitrogen.M, s.product.M);
  u.cpMolar.value.set(s.fuel.Cp, s.oxygen.Cp, s.nitrogen.Cp, s.product.Cp);
  u.cvMolar.value.set(s.fuel.Cv, s.oxygen.Cv, s.nitrogen.Cv, s.product.Cv);

  const ref = Math.sqrt(s.nitrogen.M);
  u.diffusivityScale.value.set(
    ref / Math.sqrt(s.fuel.M),
    ref / Math.sqrt(s.oxygen.M),
    1,
    ref / Math.sqrt(s.product.M),
  );

  u.stoichO2.value = fuel.stoichO2;
  u.productMoles.value = fuel.productMoles;
  u.enthalpy.value = fuel.enthalpy;
  u.ignitionTemperature.value = fuel.ignitionTemperature;
  u.flammabilityLean.value = fuel.flammabilityLean;
  u.flammabilityRich.value = fuel.flammabilityRich;

  u.combustionRate.value = p.combustionRate;
  u.flameSpeed.value = p.flameSpeed;
  u.sootFormationRate.value = p.sootFormationRate;
  u.sootOxidationRate.value = p.sootOxidationRate;
  u.sootOxidationTemperature.value = p.sootOxidationTemperature;
  u.sootDissipationRate.value = p.sootDissipationRate;
  u.fuelDissipationRate.value = p.fuelDissipationRate;

  u.emissivityAlpha.value = p.emissivityAlpha;
  u.emissivityBeta.value = p.emissivityBeta;
  u.expansionRelaxation.value = Math.max(p.expansionRelaxation, 1e-5);
  u.massDiffusivity.value = p.massDiffusivity;
  u.thermalDiffusivity.value = p.thermalDiffusivity;

  const dir = p.sourceDirection.clone().normalize();
  u.sourceP0.value.copy(p.sourcePosition);
  u.sourceP1.value.copy(p.sourcePosition).addScaledVector(dir, p.sourceLength);
  u.sourceRadius.value = p.sourceRadius;
  u.sourceVelocity.value.copy(dir).multiplyScalar(p.sourceSpeed);
  u.sourceTemperature.value = p.sourceTemperature;

  const mix = premix(p.sourceEnabled ? p.sourceAmount : 0, p.oxygenPremix, fuel.stoichO2);
  u.sourceMix.value.set(mix.fuel, mix.oxygen, mix.nitrogen, 0);

  u.gravity.value.set(0, -p.gravity, 0);
  u.updraftStrength.value = p.updraftStrength;
  u.updraftRadius.value = p.updraftRadius;
  u.updraftAxis.value
    .set(Math.sin(p.updraftTilt), Math.cos(p.updraftTilt), 0)
    .normalize();
  u.coriolis.value.set(0, p.coriolis, 0);
  u.coriolisFalloff.value = p.coriolisRadialFalloff;
  u.wind.value.copy(p.wind);
  u.windEnabled.value = p.wind.lengthSq() > 1e-8 ? 1 : 0;
  u.guidingWeight.value = p.guidingWeight;
  u.guidingSwirl.value = p.guidingSwirl;
  u.guidingRise.value = p.guidingRise;

  u.ectStrength.value = p.energyCascadeStrength;
  const g = p.energyCascadeGain;
  u.ectGain.value.set(g[0] ?? 1, g[1] ?? 1, g[2] ?? 1, g[3] ?? 1);
  u.ectGain4.value = g[4] ?? 1;

  const half = p.domainSize / 2;
  u.origin.value.set(-half, 0, -half);
}
