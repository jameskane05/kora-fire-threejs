/**
 * Flame front, Kora §4.5.2.
 *
 * "Flame front defines the region of space where the combustion reaction takes place, and we
 *  represent it using a signed distance field (SDF). It is initiated by voxels which meet both
 *  ignition criteria: (i) the temperature is greater or equal to the ignition temperature of the
 *  fuel; (ii) the equivalence ratio is within the flammability limits."
 *
 * The SDF then propagates along its normal at the flame speed nu (eq. 22), implemented as
 * dilation followed by re-normalisation, restricted to a 5-voxel narrowband.
 */
import { T, load, offset, NEIGHBOURS, type N } from '../tsl';
import type { Ctx } from '../context';

const { float, vec4, max, min, mix, step, textureStore } = T;

/** Ignition test: both criteria of §4.5.2 must hold. */
export function flammable(ctx: Ctx, chem: N): N {
  const { u, m } = ctx;
  const phi = m.equivalenceRatio(chem);
  return step(u.flammabilityLean, phi).mul(step(phi, u.flammabilityRich));
}

/** Seeds the front wherever a voxel newly satisfies both ignition criteria. */
export function ignitionPass(ctx: Ctx): N {
  const { g, f, u } = ctx;

  return g.kernel(() => {
    const c = g.coord();
    const chem = load(f.chem.read, c);
    const aux = load(f.aux.read, c);

    const hotEnough = step(u.ignitionTemperature, aux.y);
    const canBurn = hotEnough.mul(flammable(ctx, chem));

    const narrowband = u.dx.mul(5.0);
    const ignited = min(aux.w, u.dx.mul(-0.5));

    // Where the mixture cannot sustain a reaction the front is pushed back out, which is what
    // makes thin, oxygen-starved flames pulse instead of burning steadily.
    const sdf = mix(max(aux.w, narrowband), ignited, canBurn);

    textureStore(f.aux.write, c, vec4(aux.x, aux.y, aux.z, sdf)).toWriteOnly();
  });
}

/**
 * One dilation + re-normalisation iteration of eq. (22). The paper notes that "in order to
 * support large flame speeds, the dilation and re-normalization is done in multiple iterations";
 * the solver picks the iteration count from nu * dt / dx.
 */
export function flamePropagationPass(ctx: Ctx, iterations: number): N {
  const { g, f, u } = ctx;

  return g.kernel(() => {
    const c = g.coord();
    const aux = load(f.aux.read, c);
    const chem = load(f.chem.read, c);

    // dilate: move the interface outward by nu * dt
    const advance = u.flameSpeed.mul(u.dt).div(float(iterations));
    const dilated = aux.w.sub(advance).toVar();

    // Re-normalise against the 6-neighbourhood so the field stays a distance function: no voxel
    // may sit further than one dx from any neighbour, in either direction.
    const lo = dilated.toVar();
    const hi = dilated.toVar();
    for (const n of NEIGHBOURS) {
      const s = g.fetch(f.aux.read, c.add(offset(n))).w;
      lo.assign(min(lo, s.add(u.dx)));
      hi.assign(max(hi, s.sub(u.dx)));
    }

    // The lower bound is only valid outside the front. A voxel that has just ignited is a lone
    // negative cell among unburnt neighbours, so `hi` would read it as the erroneous one and pull
    // it straight back out — extinguishing every seed the frame it appears. Inside the front only
    // the upper bound applies, which is what lets the interface spread outwards.
    const inside = step(dilated, float(0.0));
    const bounded = min(dilated, lo);
    const renormalised = mix(max(bounded, hi), bounded, inside).toVar();

    // the front may only advance into a combustible mixture
    const narrowband = u.dx.mul(5.0);
    const canBurn = flammable(ctx, chem);
    const gated = mix(max(renormalised, u.dx.mul(0.5)), renormalised, canBurn);

    const clamped = max(min(gated, narrowband), narrowband.negate());

    textureStore(f.aux.write, c, vec4(aux.x, aux.y, aux.z, clamped)).toWriteOnly();
  });
}
