/**
 * Algorithm 1, step 19 — advection, Kora §4.7.3.
 *
 * "The convection terms are handled using a standard semi-Lagrangian approach, applied uniformly
 * to all advected quantities, including chemical species, temperature, the flame-front SDF, and
 * velocity. The solver supports multiple combinations of integration schemes [...] These can be
 * augmented with error-correction techniques such as MacCormack [Selle et al. 2008], BFECC and
 * advection-reflection. The different combinations yield subtly different visual characteristics
 * and expose a trade-off between numerical accuracy, visual fidelity, and computational cost."
 *
 * Implemented here: RK2 backtrace with trilinear interpolation, optionally corrected in a single
 * pass by MacCormack with a local extremum limiter. Outside the domain a backtrace picks up
 * ambient air moving at the artist's wind velocity — the "out-of-domain advection backtraces"
 * of §5.3.2.
 */
import { T, load, ifloor, sampleVelocity, type N } from '../tsl';
import type { Ctx } from '../context';

const { float, ivec3, vec3, vec4, clamp, length, max, min, textureStore } = T;

const CORNERS = [
  [0, 0, 0],
  [1, 0, 0],
  [0, 1, 0],
  [1, 1, 0],
  [0, 0, 1],
  [1, 0, 1],
  [0, 1, 1],
  [1, 1, 1],
] as const;

export function advectionPass(ctx: Ctx, macCormack: boolean): N {
  const { g, f, u } = ctx;

  // Everything below closes over `velocity` rather than reaching back through `ctx` — kernel
  // bodies run at shader-build time, when `ctx.f` has already advanced past this pass and
  // `vel.read` names the very texture this pass writes. Binding the same texture for reading and
  // writing in one kernel makes it a sampled binding, and the store then fails to compile.
  const velocity = f.vel.read;

  const amb = {
    chem: vec4(0.0, 0.21, 0.79, 0.0),
    aux: vec4(0.0, u.ambientTemperature, 0.0, u.dx.mul(5.0)),
  };

  /** RK2 trace from `p` (voxel units) through the MAC velocity field. `sign` flips direction. */
  const trace = (p: N, sign: number): N => {
    const scale = u.dt.div(u.dx).mul(sign);
    const v0 = sampleVelocity(g, velocity, p);
    const mid = p.add(v0.mul(scale.mul(0.5)));
    const v1 = sampleVelocity(g, velocity, mid);
    return p.add(v1.mul(scale));
  };

  const [nx, ny, nz] = g.res;
  const clampToDomain = (p: N) => {
    const clamped = clamp(p, vec3(0.5), vec3(nx - 0.5, ny - 0.5, nz - 0.5));
    return { clamped, escaped: length(clamped.sub(p)).greaterThan(float(1e-4)) };
  };

  /** Min/max over the eight texels of the trilinear stencil around `p`. */
  const stencilBounds = (tex: N, p: N) => {
    const base = ifloor(p.sub(0.5));
    const lo = g.fetch(tex, base).toVar();
    const hi = lo.toVar();
    for (const o of CORNERS.slice(1)) {
      const s = g.fetch(tex, base.add(ivec3(o[0], o[1], o[2])));
      lo.assign(min(lo, s));
      hi.assign(max(hi, s));
    }
    return { lo, hi };
  };

  return g.kernel(() => {
    const c = g.coord();
    const centre = g.centre(c);

    const back = clampToDomain(trace(centre, -1));

    /**
     * Single-pass MacCormack. The forward trace of the backward-traced field is evaluated by
     * chaining the two traces, so the intermediate field never has to be materialised:
     *   phi_hat   = phi^n(x_back)
     *   phi_tilde = phi_hat(x_fwd) = phi^n(backtrace(forwardtrace(x)))
     *   phi^{n+1} = phi_hat + (phi^n(x) - phi_tilde) / 2
     */
    const roundTrip = macCormack
      ? clampToDomain(trace(clampToDomain(trace(centre, 1)).clamped, -1))
      : null;

    const advect = (tex: N, self: N, fallback: N) => {
      const hat = g.sample(tex, back.clamped);
      if (!roundTrip) return back.escaped.select(fallback, hat);

      const tilde = g.sample(tex, roundTrip.clamped);
      const corrected = hat.add(self.sub(tilde).mul(0.5));
      const b = stencilBounds(tex, back.clamped);
      const limited = clamp(corrected, b.lo, b.hi);
      return back.escaped.select(fallback, limited);
    };

    const chem = advect(f.chem.read, load(f.chem.read, c), amb.chem);
    const aux = advect(f.aux.read, load(f.aux.read, c), amb.aux);

    // Velocity self-advects at its own face positions; plain semi-Lagrangian is enough there
    // because the projection immediately follows.
    const face = (o: N) => {
      const q = clampToDomain(trace(vec3(c).add(o), -1));
      return { v: sampleVelocity(g, velocity, q.clamped), escaped: q.escaped };
    };
    const fx = face(vec3(0.0, 0.5, 0.5));
    const fy = face(vec3(0.5, 0.0, 0.5));
    const fz = face(vec3(0.5, 0.5, 0.0));

    const vel = vec3(
      fx.escaped.select(u.wind.x, fx.v.x),
      fy.escaped.select(u.wind.y, fy.v.y),
      fz.escaped.select(u.wind.z, fz.v.z),
    );

    textureStore(f.chem.write, c, chem).toWriteOnly();
    textureStore(f.aux.write, c, aux).toWriteOnly();
    textureStore(f.vel.write, c, vec4(vel, 0.0)).toWriteOnly();
  });
}
