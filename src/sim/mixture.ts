/**
 * Mixture thermodynamics — Kora §4.3.1 and §4.5.1.
 *
 * The state vector `chem` holds absolute concentrations (fuel, O2, N2, product) and `soot` is
 * carried separately because it is solid particulate: it contributes mass and heat capacity but
 * is *excluded from the equation of state*, so it cannot drive expansion (§4.5.1).
 */
import { T, type N } from './tsl';
import type { KoraUniforms } from './uniforms';

const { float, dot, max, mix, vec4 } = T;

const EPS = 1e-6;

export function makeMixture(u: KoraUniforms) {
  /** Per-species molar heat capacity for the active regime (Algorithm 1). */
  const molarC = () => mix(u.cpMolar, u.cvMolar, u.adiabatic);

  return {
    /**
     * Mixture density, eq. (15): rho = sum_i c_i rho_atm^i, with rho_atm^i = N0 * M_i.
     * Soot borrows the molar mass of the fuel it came from (§4.5.1).
     */
    density: (chem: N, soot: N): N =>
      u.molarDensityAtm.mul(dot(chem, u.molarMass).add(soot.mul(u.molarMass.x))),

    /** Volumetric heat capacity rho*C [J/(m^3 K)], the denominator of eq. (26). */
    heatCapacity: (chem: N, soot: N): N => {
      const c = molarC();
      return u.molarDensityAtm.mul(max(dot(chem, c).add(soot.mul(c.x)), float(EPS)));
    },

    /** Adiabatic index gamma = Cp/Cv of the local mixture (§4.4). */
    gamma: (chem: N, soot: N): N => {
      const w = vec4(chem.x.add(soot), chem.y, chem.z, chem.w);
      const cp = max(dot(w, u.cpMolar), float(EPS));
      const cv = max(dot(w, u.cvMolar), float(EPS));
      return max(cp.div(cv), float(1.01));
    },

    /**
     * Sum of gaseous concentrations — `c_prev` in Algorithm 1, line 9. Soot is deliberately
     * absent: "soot concentration is excluded from the equation of state" (§4.5.1).
     */
    gasSum: (chem: N): N => max(chem.x.add(chem.y).add(chem.z).add(chem.w), float(EPS)),

    /**
     * Equivalence ratio phi (§4.5.1): the actual fuel/oxygen mixture relative to stoichiometric.
     * phi < 1 is fuel-lean with excess oxygen, phi > 1 fuel-rich and oxygen-deficient.
     */
    equivalenceRatio: (chem: N): N =>
      chem.x.mul(u.stoichO2).div(max(chem.y, float(EPS))),
  };
}

export type Mixture = ReturnType<typeof makeMixture>;
