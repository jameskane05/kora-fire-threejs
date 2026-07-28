/**
 * Algorithm 1, step 15 — external forces, Kora §5.3.1.
 *
 * "Even when the forces themselves are supernatural, their application integrates smoothly with
 * the rest of the solve, preserving the natural turbulent character of the flow and producing
 * believable motion that fits seamlessly within the combustion processes."
 *
 * Two art-direction mechanisms from the paper are implemented here:
 *
 *  - Warped gravity for updrafts. Buoyancy is still purely a consequence of spatially varying
 *    density (§4.7.1), so bending the *gravity* field is what bends the plume, "without
 *    compromising its natural turbulent motion".
 *
 *    Gravity enters weighted by the density anomaly, g (rho - rho_atm) / rho, rather than
 *    uniformly. That is the same term the paper's hydrostatic Dirichlet boundary would produce
 *    through the projection, moved to where it can be evaluated exactly; see `projection.ts` for
 *    why the Jacobi solve here cannot be relied on to recover it. Ambient air feels nothing, hot
 *    gas rises, and soot-laden gas falls.
 *
 *  - The truncated Coriolis force of eq. (36), F = rho * omega x u, which "twists buoyant flows
 *    into spinning vortices, producing effects ranging from subtle spirals to full fire-tornado
 *    motion".
 *
 * Velocity is stored on a MAC grid, so each component is evaluated at its own face centre.
 */
import { T, load, sampleVelocity, type N } from '../tsl';
import { makeDensity } from './projection';
import type { Ctx } from '../context';

const { float, vec3, vec4, clamp, cross, exp, length, max, mix, oneMinus, textureStore } = T;

/**
 * Ceiling on the buoyancy weighting. A factor of -12 is roughly a 13:1 density ratio, well past
 * any flame temperature; the clamp only guards cells the density floor has driven near vacuum.
 */
const MAX_BUOYANCY = 12.0;

export function forcesPass(ctx: Ctx): N {
  const { g, f, u } = ctx;
  const density = makeDensity(ctx);

  return g.kernel(() => {
    const c = g.coord();
    const vel = load(f.vel.read, c);

    const acceleration = (axis: readonly [number, number, number], faceOffset: N) => {
      const local = vec3(c).add(faceOffset);
      const world = u.origin.add(local.mul(u.dx));

      const rho = density.face(c, axis);
      const buoyancy = clamp(oneMinus(u.rhoAtm.div(rho)), float(-MAX_BUOYANCY), float(1.0));

      // ---- warped gravity, giving a local updraft along a tilted axis ----
      const radial = length(world.sub(u.updraftAxis.mul(world.dot(u.updraftAxis))));
      const tube = exp(radial.div(max(u.updraftRadius, float(1e-3))).pow(2.0).negate());
      const warp = clamp(u.updraftStrength.mul(tube), 0.0, 1.0);
      const gravityMag = length(u.gravity);
      const gWarped = mix(u.gravity, u.updraftAxis.mul(gravityMag.negate()), warp);

      // ---- truncated Coriolis, eq. (36) ----
      const velocity = sampleVelocity(g, f.vel.read, local);
      const swirlFalloff = exp(radial.div(max(u.coriolisFalloff, float(1e-3))).pow(2.0).negate());
      const coriolis = cross(u.coriolis.mul(swirlFalloff), velocity);

      return gWarped.mul(buoyancy).add(coriolis);
    };

    const ax = acceleration([1, 0, 0], vec3(0.0, 0.5, 0.5)).x;
    const ay = acceleration([0, 1, 0], vec3(0.5, 0.0, 0.5)).y;
    const az = acceleration([0, 0, 1], vec3(0.5, 0.5, 0.0)).z;

    const updated = vec3(vel.x, vel.y, vel.z).add(vec3(ax, ay, az).mul(u.dt));

    textureStore(f.vel.write, c, vec4(updated, 0.0)).toWriteOnly();
  });
}
