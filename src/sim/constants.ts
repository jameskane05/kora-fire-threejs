/**
 * Physical constants and the fuel database.
 *
 * Kora §4.5: "italicized quantities introduced in this section correspond to established
 * physical and chemical concepts documented in the literature and are exposed as solver
 * parameters with real-world default values taken from [NIST 2025]."
 *
 * Everything here is in SI. The solver works in the paper's dimensionless *concentration*
 * (§4.3.1) rather than density, so most of these constants exist to convert back and forth.
 */

export const R_GAS = 8.314462618; // J/(mol K)
export const P_ATM = 101325; // Pa
export const T_ATM = 288.15; // K   (paper's room temperature, §4.3.1)
export const STEFAN_BOLTZMANN = 5.670374419e-8; // W/(m^2 K^4)
export const GRAVITY = 9.80665; // m/s^2

/**
 * Moles per cubic metre of an ideal gas at (P_ATM, T_ATM).
 *
 * Kora eq. (14): c = rho R T_atm / (p_atm M), i.e. concentration is moles per unit volume
 * scaled by R T_atm / p_atm. So moles/m^3 = c * MOLAR_DENSITY_ATM.
 */
export const MOLAR_DENSITY_ATM = P_ATM / (R_GAS * T_ATM); // ~42.29 mol/m^3

/** Volume fractions of dry air, used for fuel/air premixing (§5.1.1). */
export const AIR_O2_FRACTION = 0.21;
export const AIR_N2_FRACTION = 0.79;
export const AIR_N2_PER_O2 = AIR_N2_FRACTION / AIR_O2_FRACTION; // 3.762

interface Species {
  /** kg/mol */
  M: number;
  /** isobaric molar heat capacity, J/(mol K) */
  Cp: number;
  /** isochoric molar heat capacity, J/(mol K) */
  Cv: number;
}

const N2: Species = { M: 0.0280134, Cp: 29.12, Cv: 20.8 };
const O2: Species = { M: 0.0319988, Cp: 29.38, Cv: 21.07 };
const CO2: Species = { M: 0.0440095, Cp: 37.13, Cv: 28.82 };
const H2O: Species = { M: 0.0180153, Cp: 33.58, Cv: 25.27 };

/**
 * Soot is solid particulate. Kora §4.5.1: "Since soot represents solid particulate matter
 * rather than a gas, it does not add pressure to the system. Accordingly, soot concentration
 * is excluded from the equation of state." It still carries mass and heat capacity.
 */
const SOOT: Species = { M: 0.012011, Cp: 8.53, Cv: 8.53 };

export interface Fuel {
  name: string;
  /** carbon count in CxHy */
  carbon: number;
  /** hydrogen count in CxHy */
  hydrogen: number;
  M: number;
  Cp: number;
  Cv: number;
  /** moles of O2 per mole of fuel for complete combustion — the *stoichiometric ratio* (§4.5.1) */
  stoichO2: number;
  /** moles of lumped product per mole of fuel */
  productMoles: number;
  /** enthalpy of combustion, J/mol (lower heating value) */
  enthalpy: number;
  /** autoignition temperature, K — ignition criterion (i) of §4.5.2 */
  ignitionTemperature: number;
  /** flammability limits expressed as equivalence ratio — ignition criterion (ii) of §4.5.2 */
  flammabilityLean: number;
  flammabilityRich: number;
  /** laminar flame speed nu, m/s (eq. 22) */
  flameSpeed: number;
  /** lumped CO2 + H2O product pseudo-species */
  product: Species;
}

/** CxHy + (x + y/4) O2 -> x CO2 + (y/2) H2O + heat   (Kora eq. 21 for propane) */
function makeFuel(
  name: string,
  carbon: number,
  hydrogen: number,
  Cp: number,
  Cv: number,
  enthalpy: number,
  ignitionTemperature: number,
  flammabilityLean: number,
  flammabilityRich: number,
  flameSpeed: number,
): Fuel {
  const nCO2 = carbon;
  const nH2O = hydrogen / 2;
  const productMoles = nCO2 + nH2O;
  const w = (a: number, b: number) => (nCO2 * a + nH2O * b) / productMoles;

  return {
    name,
    carbon,
    hydrogen,
    M: carbon * 0.0120107 + hydrogen * 0.00100794,
    Cp,
    Cv,
    stoichO2: carbon + hydrogen / 4,
    productMoles,
    enthalpy,
    ignitionTemperature,
    flammabilityLean,
    flammabilityRich,
    flameSpeed,
    product: { M: w(CO2.M, H2O.M), Cp: w(CO2.Cp, H2O.Cp), Cv: w(CO2.Cv, H2O.Cv) },
  };
}

export const FUELS: Record<string, Fuel> = {
  // CH4 + 2 O2 -> CO2 + 2 H2O
  methane: makeFuel('methane', 1, 4, 35.69, 27.38, 802.3e3, 810, 0.5, 1.7, 0.38),
  // C3H8 + 5 O2 -> 3 CO2 + 4 H2O   (the paper's worked example, eq. 21)
  propane: makeFuel('propane', 3, 8, 73.6, 65.29, 2043.1e3, 743, 0.51, 2.5, 0.45),
  // C2H2 + 2.5 O2 -> 2 CO2 + H2O   — very sooty, very fast; good for flamethrower looks
  acetylene: makeFuel('acetylene', 2, 2, 44.04, 35.73, 1256.0e3, 578, 0.31, 6.0, 1.55),
  // C12H23 — the paper explicitly calls out diesel as a supported "complex compound"
  diesel: makeFuel('diesel', 12, 23, 380.0, 371.7, 7300.0e3, 483, 0.4, 4.0, 0.35),
};

export type FuelName = keyof typeof FUELS;

/**
 * The solver tracks four gaseous channels plus soot. Nitrogen and combustion products are
 * chemically inert and "participate only thermomechanically by means of added concentration
 * and heat capacity" (§4.5.1).
 */
export function speciesTable(fuel: Fuel) {
  return {
    fuel: { M: fuel.M, Cp: fuel.Cp, Cv: fuel.Cv },
    oxygen: O2,
    nitrogen: N2,
    product: fuel.product,
    soot: SOOT,
  };
}

/** rho_atm^i for each species (kg/m^3), Kora eq. (13). Used by the mixture density, eq. (15). */
export function equilibriumDensities(fuel: Fuel) {
  const t = speciesTable(fuel);
  return {
    fuel: MOLAR_DENSITY_ATM * t.fuel.M,
    oxygen: MOLAR_DENSITY_ATM * t.oxygen.M,
    nitrogen: MOLAR_DENSITY_ATM * t.nitrogen.M,
    product: MOLAR_DENSITY_ATM * t.product.M,
    soot: MOLAR_DENSITY_ATM * t.soot.M,
  };
}
