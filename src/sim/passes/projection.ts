/**
 * Algorithm 1, step 16 — pressure projection, Kora §4.7.1.
 *
 * Two details from the paper drive the whole look of the plume:
 *
 *  1. "Buoyancy arises from combining spatially varying density with hydrostatic pressure
 *     Dirichlet boundary conditions, enforced on the outer layer of voxels of the sparse domain."
 *
 *     Kora holds the boundary at p = rho_atm * (g . x) and applies gravity uniformly, so buoyancy
 *     falls out of the projection. That relies on a converged solve: the hydrostatic column is
 *     information that has to travel from the boundary to every interior cell. Kora uses
 *     multigrid-preconditioned CG, which delivers that; the Jacobi solve here propagates roughly
 *     one cell per iteration, so on a 96^3 grid the interior would never see the boundary and the
 *     whole field would simply free-fall at g.
 *
 *     So this port splits the hydrostatic part off analytically and solves for the deviation
 *     p' = p - rho_atm (g . x). Since grad p_hydro = rho_atm * g, the two formulations differ only
 *     in where the same term is evaluated: `forces.ts` applies g (rho - rho_atm) / rho instead of
 *     g, and the boundary condition on p' is homogeneous. Ambient air is then in exact discrete
 *     balance no matter how far the solve has converged, and only the density anomaly drives flow.
 *
 *  2. "The expansion term resulting from the updated concentrations and temperature is
 *     incorporated as a modifier to the divergence constraint" — the target divergence is
 *     -ln(s)/dt from eq. (9), not zero.
 *
 * Kora solves the variational form of [Batty et al. 2007] with a multigrid-preconditioned
 * conjugate gradient. This port uses Jacobi on the same variable-density Poisson system, which
 * is the main numerical shortcut taken here.
 *
 * Wind (§5.3.2) enters as a Neumann condition on the inflow faces of the outer voxel layer.
 */
import { T, load, type N } from '../tsl';
import type { Ctx } from '../context';

const { float, ivec3, vec3, vec4, dot, log, max, textureStore } = T;

const AXES = [
  [1, 0, 0],
  [0, 1, 0],
  [0, 0, 1],
] as const;

export interface Density {
  /** Mixture density of a cell. Ghost cells always hold quiescent ambient air. */
  at(c: N): N;
  /** Density on the MAC face between `c` and the cell behind it along `axis`. */
  face(c: N, axis: readonly [number, number, number]): N;
}

/**
 * Binds the density lookups to the buffers current *now*.
 *
 * Call this while building a pass, never from inside a kernel body: bodies run lazily at shader
 * build time, when `ctx.f` has already advanced to the end of the frame.
 */
export function makeDensity(ctx: Ctx): Density {
  const { g, f, m, u } = ctx;

  const at = (c: N): N => {
    const chem = g.fetch(f.chem.read, c);
    const soot = g.fetch(f.aux.read, c).x;
    const rho = max(m.density(chem, soot), u.rhoAtm.mul(0.02));
    return g.interior(c).select(rho, u.rhoAtm);
  };

  return {
    at,
    face: (c, axis) => at(c).add(at(c.sub(ivec3(axis[0], axis[1], axis[2])))).mul(0.5),
  };
}

/** Right-hand side of the Poisson system: div(u*) - D, with D = -ln(s)/dt from eq. (9). */
export function divergencePass(ctx: Ctx): N {
  const { g, f, u } = ctx;

  return g.kernel(() => {
    const c = g.coord();
    const self = load(f.vel.read, c);

    const px = g.fetch(f.vel.read, c.add(ivec3(1, 0, 0))).x;
    const py = g.fetch(f.vel.read, c.add(ivec3(0, 1, 0))).y;
    const pz = g.fetch(f.vel.read, c.add(ivec3(0, 0, 1))).z;

    const divU = px.sub(self.x).add(py.sub(self.y)).add(pz.sub(self.z)).div(u.dx);

    const s = load(f.expansion, c).x;
    const target = log(max(s, float(1e-4))).negate().div(u.dt);

    const rhs = g.interior(c).select(divU.sub(target), float(0.0));
    textureStore(f.divergence, c, vec4(rhs)).toWriteOnly();
  });
}

/**
 * One Jacobi sweep of div(beta grad p') = rhs with beta = dt / rho_face.
 * Ghost cells are pinned to zero: the hydrostatic column they would otherwise carry has been
 * folded into the buoyancy term in `forces.ts`, leaving an open boundary at ambient pressure.
 */
export function pressurePass(ctx: Ctx): N {
  const { g, f, u } = ctx;
  const density = makeDensity(ctx);

  return g.kernel(() => {
    const c = g.coord();
    const rhs = load(f.divergence, c).x;
    const rhoSelf = density.at(c);
    const dx2 = u.dx.mul(u.dx);

    const sum = float(0.0).toVar();
    const weight = float(0.0).toVar();

    for (const axis of AXES) {
      for (const sign of [-1, 1] as const) {
        const step = ivec3(axis[0] * sign, axis[1] * sign, axis[2] * sign);
        const n = c.add(step);

        const rhoFace = rhoSelf.add(density.at(n)).mul(0.5);
        const beta = u.dt.div(rhoFace).div(dx2);

        // Neumann on wind inflow faces: a prescribed flux means no pressure coupling.
        const inflow = dot(u.wind, vec3(step).negate()).greaterThan(float(0.0));
        const neumann = g
          .interior(n)
          .not()
          .and(inflow)
          .and(u.windEnabled.greaterThan(float(0.5)));
        const b = neumann.select(float(0.0), beta);

        sum.addAssign(b.mul(g.fetch(f.pressure.read, n).x));
        weight.addAssign(b);
      }
    }

    const solved = sum.sub(rhs).div(max(weight, float(1e-12)));
    const p = g.interior(c).select(solved, float(0.0));

    textureStore(f.pressure.write, c, vec4(p)).toWriteOnly();
  });
}

/** u <- u* - (dt / rho_face) grad p, evaluated on the MAC faces. */
export function pressureGradientPass(ctx: Ctx): N {
  const { g, f, u } = ctx;
  const density = makeDensity(ctx);

  return g.kernel(() => {
    const c = g.coord();
    const vel = load(f.vel.read, c);
    const pSelf = load(f.pressure.read, c).x;

    const component = (axis: readonly [number, number, number], value: N) => {
      const back = c.sub(ivec3(axis[0], axis[1], axis[2]));
      const pBack = g.fetch(f.pressure.read, back).x;
      const rhoFace = density.face(c, axis);

      const corrected = value.sub(u.dt.div(rhoFace).mul(pSelf.sub(pBack)).div(u.dx));

      // Prescribed wind on the inflow faces of the outer layer.
      const windComp = dot(u.wind, vec3(axis[0], axis[1], axis[2]));
      const inflow = windComp.greaterThan(float(0.0));
      const prescribe = g
        .interior(back)
        .not()
        .and(inflow)
        .and(u.windEnabled.greaterThan(float(0.5)));

      return prescribe.select(windComp, corrected);
    };

    const updated = vec3(
      component([1, 0, 0], vel.x),
      component([0, 1, 0], vel.y),
      component([0, 0, 1], vel.z),
    );

    textureStore(f.vel.write, c, vec4(updated, 0.0)).toWriteOnly();
  });
}
