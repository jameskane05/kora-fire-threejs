/**
 * Algorithm 1, steps 9-14 — expansion, Kora §4.3 and §4.4.
 *
 * Kora's key departure from prior work: rather than substituting the differential form of the
 * ideal gas law into the density evolution equation, it *enforces the gas law as a constraint*.
 * "This allows for more precise mass tracking by avoiding error accumulation and subsequent
 * drift in the course of temporal integration. Additionally, this guarantees a robust response
 * to user interventions, when sudden, non-differentiable changes in simulation quantities — due
 * to mass or temperature stamping — are required artistically." (§4.3)
 *
 * Density scaling, eq. (17):     s = (1 / c_prev) * (T_atm / T)
 * Delayed expansion, eq. (19):   s = (1 + (c_prev T / T_atm - 1) exp(-dt/tau)) / (c_prev T / T_atm)
 * Adiabatic correction, §4.4:    s <- s^(1/gamma),  T <- T * s^(gamma-1)
 *
 * The resulting `s` feeds the divergence constraint of the pressure projection as -ln(s)/dt.
 */
import { T, load, type N } from '../tsl';
import type { Ctx } from '../context';

const { float, vec4, clamp, exp, max, mix, pow, textureStore } = T;

export function expansionPass(ctx: Ctx): N {
  const { g, f, u, m } = ctx;

  return g.kernel(() => {
    const c = g.coord();
    const chem = load(f.chem.read, c);
    const aux = load(f.aux.read, c);

    const temperature = aux.y.toVar();
    const cPrev = m.gasSum(chem);

    // q = c_prev * T / T_atm; the equilibrium state is q = 1, so s = 1/q with no relaxation.
    const q = max(cPrev.mul(temperature).div(u.tAtm), float(1e-4));
    const relaxed = float(1.0).add(q.sub(1.0).mul(exp(u.dt.negate().div(u.expansionRelaxation))));
    const s = clamp(relaxed.div(q), float(0.02), float(50.0)).toVar();

    // §4.4 — in the adiabatic regime the thermodynamics ran at constant volume, so a single
    // adiabatic expansion equalises the pressure and cools the gas doing the mechanical work.
    const gamma = m.gamma(chem, aux.x);
    const sAdiabatic = pow(s, float(1.0).div(gamma));
    const sFinal = mix(s, sAdiabatic, u.adiabatic).toVar();
    const cooled = mix(temperature, temperature.mul(pow(sFinal, gamma.sub(1.0))), u.adiabatic);

    textureStore(f.aux.write, c, vec4(aux.x, cooled, aux.z, aux.w)).toWriteOnly();
    textureStore(f.expansion, c, vec4(sFinal)).toWriteOnly();
  });
}

/**
 * Algorithm 1, step 18: "Multiply all concentrations by s to account for expansion."
 * Soot rides along so that mass is conserved even though it never contributed to `s`.
 */
export function applyExpansionPass(ctx: Ctx): N {
  const { g, f } = ctx;

  return g.kernel(() => {
    const c = g.coord();
    const chem = load(f.chem.read, c);
    const aux = load(f.aux.read, c);
    const s = load(f.expansion, c).x;

    textureStore(f.chem.write, c, chem.mul(s)).toWriteOnly();
    textureStore(f.aux.write, c, vec4(aux.x.mul(s), aux.y, aux.z, aux.w)).toWriteOnly();
  });
}
