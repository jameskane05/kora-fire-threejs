/**
 * Algorithm 1, step 5 — the combustion reaction, Kora §4.5.1.
 *
 * This is the heart of the paper. Rather than driving flicker with noise or temporal modulation,
 * the solver tracks reactants explicitly and lets behaviour fall out of local availability:
 *
 *   "Fuel-rich conditions give rise to oxygen starvation, in which combustion becomes locally
 *    oxygen-limited and flame fronts intermittently ignite and extinguish as fresh oxygen is
 *    entrained from the surrounding flow. This naturally produces visual phenomena known as
 *    choked flames, pulsation, and flickering. Because the solver tracks chemicals and models
 *    reactions explicitly, these behaviors emerge directly from the local availability of
 *    reactants rather than from heuristic noise or temporal modulation."
 *
 * Reaction, eq. (21) generalised to CxHy:
 *   CxHy + (x + y/4) O2 -> x CO2 + (y/2) H2O + heat
 */
import { T, load, type N } from '../tsl';
import type { Ctx } from '../context';

const { float, vec4, exp, max, min, oneMinus, step, textureStore } = T;

/** Release of `moles` of fuel-equivalent per m^3 converted into a temperature rise. */
function heatRelease(ctx: Ctx, burnt: N, chem: N, soot: N): N {
  const { u, m } = ctx;
  const energy = burnt.mul(u.molarDensityAtm).mul(u.enthalpy); // J/m^3
  return energy.div(m.heatCapacity(chem, soot));
}

export function combustionPass(ctx: Ctx): N {
  const { g, f, u } = ctx;

  return g.kernel(() => {
    const c = g.coord();
    const chem = load(f.chem.read, c);
    const aux = load(f.aux.read, c);

    const fuel = chem.x.toVar();
    const oxygen = chem.y.toVar();
    const nitrogen = chem.z;
    const product = chem.w.toVar();
    const soot = aux.x.toVar();
    const temperature = aux.y.toVar();

    // The flame front (§4.5.2) is a signed distance field; combustion happens where it is inside.
    const burning = step(aux.w, float(0.0));

    // ---- fuel oxidation ------------------------------------------------------------------
    // Limited by whichever reactant runs out first — this single min() is what produces
    // oxygen starvation, choked flames and flicker.
    const limit = min(fuel, oxygen.div(u.stoichO2));
    const reacted = limit.mul(oneMinus(exp(u.combustionRate.negate().mul(u.dt)))).mul(burning).toVar();

    fuel.subAssign(reacted);
    oxygen.subAssign(reacted.mul(u.stoichO2));
    product.addAssign(reacted.mul(u.productMoles));

    const burnt = reacted.toVar();

    // ---- soot formation, §4.5.1 ------------------------------------------------------------
    // "When excess fuel remains after oxygen has been locally depleted, carbon-rich
    //  intermediates can nucleate into soot particles."
    //
    // Gated on heat rather than on the flame front. Inception is pyrolysis — fuel breaking down
    // thermally — and it wants a hot, oxygen-starved region, which is precisely a region the front
    // does not reach: the front only covers cells inside the flammability limits, and a rich core
    // sits above the rich limit by definition. Requiring both confined nucleation to the narrow
    // band where phi is between 1 and the rich limit, which is also the one place there is spare
    // oxygen to burn the soot straight back off, so almost none survived to become smoke.
    const pyrolysing = step(u.ignitionTemperature, temperature);
    const excessFuel = max(fuel.sub(oxygen.div(u.stoichO2)), float(0.0));
    // The hot emitter is restamped at atmospheric density every frame and then expanded by
    // ~T_atm/T, so a paper-literal first-order rate loses almost all new soot to dilution before
    // it can leave the source. The artist-facing rate is therefore applied with enough gain that
    // the useful 0–10 knob range actually builds a plume; without it, even "10" stays invisible.
    const nucleated = excessFuel
      .mul(oneMinus(exp(u.sootFormationRate.negate().mul(u.dt).mul(float(10.0)))))
      .mul(pyrolysing);
    fuel.subAssign(nucleated);
    soot.addAssign(nucleated);

    // ---- soot oxidation, §4.5.1 ------------------------------------------------------------
    // "In high-temperature, oxygen-rich regions—typically near flame cores—soot particles can
    //  be consumed through oxidation, converting them into gaseous combustion products."
    // Soot inherits the chemistry of the fuel it came from, so it burns by the same eq. (21).
    //
    // Only oxygen left after the fuel's stoichiometric claim counts as "oxygen-rich". Fuel
    // combustion is gated on the flame front, so a rich pyrolysing core still holds its premixed
    // O2; spending that O2 on soot would burn the smoke in the one place the paper says it forms.
    const hot = step(u.sootOxidationTemperature, temperature);
    const excessOxygen = max(oxygen.sub(fuel.mul(u.stoichO2)), float(0.0));
    const sootLimit = min(soot, excessOxygen.div(u.stoichO2));
    const oxidised = sootLimit
      .mul(oneMinus(exp(u.sootOxidationRate.negate().mul(u.dt))))
      .mul(hot)
      .toVar();

    soot.subAssign(oxidised);
    oxygen.subAssign(oxidised.mul(u.stoichO2));
    product.addAssign(oxidised.mul(u.productMoles));
    burnt.addAssign(oxidised);

    // ---- thermal response ------------------------------------------------------------------
    const newChem = vec4(fuel, oxygen, nitrogen, product);
    temperature.addAssign(heatRelease(ctx, burnt, newChem, soot));

    // The `heat` channel stores the enthalpy release rate; §5.4.1 uses it as flame alpha.
    // A short relaxation keeps a little of the previous release so thin flames read as
    // continuous ribbons rather than single-frame speckle.
    const releaseRate = burnt.mul(u.molarDensityAtm).mul(u.enthalpy).div(u.dt).mul(1e-6);
    const heat = max(aux.z.mul(exp(u.dt.negate().div(0.045))), releaseRate);

    textureStore(f.chem.write, c, newChem).toWriteOnly();
    textureStore(f.aux.write, c, vec4(soot, temperature, heat, aux.w)).toWriteOnly();
  });
}
