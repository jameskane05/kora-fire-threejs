/**
 * Algorithm 1, step 6 — radiative cooling, Kora §4.7.4.
 *
 * Full radiative transfer is non-local and far too expensive, so the paper keeps the
 * Stefan-Boltzmann temperature dependence (eq. 23) and lets emissivity vary with soot, giving
 * eq. (25):
 *
 *   Q = alpha * sigma * (T^4 - T_amb^4) * ||grad c_soot||  +  4 * beta * sigma * c_soot * T^3 * ||grad T||
 *
 * Splitting it in two lets an artist decide whether cooling reads off soot gradients or thermal
 * structure. The temperature update is the exponential form of eq. (27), which "offers improved
 * numerical stability for large timesteps and prevents overshooting".
 */
import { T, load, type N } from '../tsl';
import type { Ctx } from '../context';

const { float, ivec3, vec3, vec4, exp, length, max, textureStore } = T;

export function radiativeCoolingPass(ctx: Ctx): N {
  const { g, f, u, m } = ctx;

  return g.kernel(() => {
    const c = g.coord();
    const chem = load(f.chem.read, c);
    const aux = load(f.aux.read, c);

    const soot = aux.x;
    const temperature = aux.y.toVar();

    // central differences for both gradients
    const d = (o: N) => {
      const a = g.fetch(f.aux.read, c.add(o));
      const b = g.fetch(f.aux.read, c.sub(o));
      return vec3(a.x.sub(b.x), a.y.sub(b.y), 0.0).div(u.dx.mul(2.0));
    };
    const dx = d(ivec3(1, 0, 0));
    const dy = d(ivec3(0, 1, 0));
    const dz = d(ivec3(0, 0, 1));

    const gradSoot = length(vec3(dx.x, dy.x, dz.x));
    const gradTemp = length(vec3(dx.y, dy.y, dz.y));

    const tAmb = u.ambientTemperature;
    const t2 = temperature.mul(temperature);
    const t3 = t2.mul(temperature);
    const t4 = t2.mul(t2);
    const tAmb4 = tAmb.mul(tAmb).mul(tAmb).mul(tAmb);

    const Q = u.emissivityAlpha
      .mul(u.sigma)
      .mul(max(t4.sub(tAmb4), float(0.0)))
      .mul(gradSoot)
      .add(u.emissivityBeta.mul(4.0).mul(u.sigma).mul(soot).mul(t3).mul(gradTemp));

    // eq. (26): heat loss rate per unit volume divided by the volumetric heat capacity
    const rate = Q.div(m.heatCapacity(chem, soot));

    // eq. (27)
    const cooled = tAmb.add(
      temperature.sub(tAmb).mul(exp(rate.mul(u.dt).div(max(temperature, float(1.0))).negate())),
    );

    textureStore(f.aux.write, c, vec4(aux.x, cooled, aux.z, aux.w)).toWriteOnly();
  });
}
