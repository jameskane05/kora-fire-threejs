/**
 * Algorithm 1, step 8 — Energy Cascade Turbulence, Kora §4.8.
 *
 * This is the paper's novel turbulence model, and the most interesting thing in it to port.
 *
 * Curl noise needs per-shot amplitude/frequency tuning; vorticity confinement is not physically
 * grounded and artefacts badly when over-amplified; wavelet turbulence looks synthetic past an
 * octave or two. ECT sidesteps all three by asking a different question — not "how much noise
 * looks good" but "how much kinetic energy did the discretisation lose, and at which scale":
 *
 *   "ECT removes this tuning burden by estimating how much kinetic energy is missing at each
 *    scale and injecting only the amount of turbulence needed to restore a physically plausible
 *    energy distribution."
 *
 * Method:
 *   1. Decompose the velocity field into frequency bands by recursive smoothing, eq. (30)-(31).
 *   2. Per band, compare the local kinetic energy ratio E_i / E_{i+1} against the Kolmogorov
 *      falloff r_e = 2^(-5/3) implied by E(k) ~ k^(-5/3), eq. (29).
 *   3. Where the ratio falls short, inject divergence-free curl noise at that band's feature
 *      size with amplitude A_i = sqrt(2 r_e E_{i+1}) - sqrt(2 E_i), eq. (32)-(33).
 *
 * Deviation from the paper: eq. (30) applies a 3x3x3 box filter J exactly 2^i times per level,
 * which costs 31 full 3D convolutions for five bands. The default here is an a-trous filter —
 * a single 3-tap separable pass per axis with stride 2^i — which reproduces the paper's support
 * growth (radius 2^(i+1) - 1 after level i, so feature size l_i = 2^i dx as in eq. 32) at a
 * fraction of the cost. Set `exactCascadeFilter` to run eq. (30) verbatim instead.
 */
import { T, load, type N } from '../tsl';
import type { Ctx } from '../context';
import type { Storage3DTexture } from 'three/webgpu';

const { float, int, ivec3, vec3, vec4, dot, max, sqrt, texture3D, textureStore } = T;

/** Voxels spanned by one repeat of the noise volume at band 0. */
const NOISE_PERIOD = 8;

/** Kolmogorov falloff between adjacent bands, r_e = 2^(-5/3). */
export const KOLMOGOROV_FALLOFF = Math.pow(2, -5 / 3);

/**
 * One separable smoothing pass. `stride` is 1 for the exact box filter of eq. (30) and 2^i for
 * the a-trous approximation.
 */
export function smoothPass(
  ctx: Ctx,
  src: Storage3DTexture,
  dst: Storage3DTexture,
  axis: 0 | 1 | 2,
  stride: number,
): N {
  const { g } = ctx;
  const dir = ivec3(
    axis === 0 ? stride : 0,
    axis === 1 ? stride : 0,
    axis === 2 ? stride : 0,
  );

  return g.kernel(() => {
    const c = g.coord();
    const a = g.fetch(src, c.sub(dir));
    const b = load(src, c);
    const d = g.fetch(src, c.add(dir));
    textureStore(dst, c, a.add(b.mul(2.0)).add(d).mul(0.25)).toWriteOnly();
  });
}

/** Copies a field, used to seed the pyramid with u_0 = u. */
export function copyPass(ctx: Ctx, src: Storage3DTexture, dst: Storage3DTexture): N {
  const { g } = ctx;
  return g.kernel(() => {
    const c = g.coord();
    textureStore(dst, c, load(src, c)).toWriteOnly();
  });
}

/**
 * Curl noise at feature size `scale` voxels.
 * "The fundamental building block of ECT is curl noise [Bridson et al. 2007], which generates
 * incompressible velocity fields by applying the curl operator to a vector noise potential."
 *
 * The curl itself is baked into the volume (see `noise.ts`), so this is one fetch rather than the
 * six the central differences used to take. The result is O(1) at every band; the physical
 * magnitude comes entirely from the eq. (33) amplitude.
 */
function curlNoise(ctx: Ctx, p: N, scale: number, phase: number): N {
  const { noise, u } = ctx;
  const period = Math.max(scale, 1) * NOISE_PERIOD;

  // The noise volume tiles, so an arbitrary per-band offset keeps every band decorrelated
  // without seams. A slow drift keeps the injected detail from looking stapled to the grid.
  const offset = vec3(phase * 0.37, u.time.mul(0.09 * (1 + phase * 0.3)), phase * 0.71);
  const q = p.div(period).add(offset);

  return texture3D(noise.texture, q)
    .level(int(0))
    .xyz.sub(0.5)
    .mul(2.0 * noise.scale);
}

/**
 * Accumulates the turbulent acceleration of eq. (32)-(34) from all bands and applies it to the
 * velocity field. `pyramid[i]` holds u_i from eq. (30), so band i is pyramid[i] - pyramid[i+1].
 */
export function energyCascadePass(ctx: Ctx, pyramid: Storage3DTexture[], bands: number): N {
  const { g, f, u } = ctx;

  return g.kernel(() => {
    const c = g.coord();
    const vel = load(f.vel.read, c);
    const p = vec3(c).add(0.5);

    const acceleration = vec3(0.0).toVar();
    const gains = [u.ectGain.x, u.ectGain.y, u.ectGain.z, u.ectGain.w, u.ectGain4];

    for (let i = 0; i < bands; i++) {
      // eq. (31): band-limited velocity components
      const bandI = load(pyramid[i], c).xyz.sub(load(pyramid[i + 1], c).xyz);
      const bandNext = load(pyramid[i + 1], c).xyz.sub(load(pyramid[i + 2], c).xyz);

      const Ei = dot(bandI, bandI).mul(0.5);
      const Enext = dot(bandNext, bandNext).mul(0.5);

      // eq. (33): the amplitude needed to lift this band back onto the Kolmogorov spectrum
      const amplitude = max(
        sqrt(Enext.mul(2.0 * KOLMOGOROV_FALLOFF)).sub(sqrt(Ei.mul(2.0))),
        float(0.0),
      );

      // eq. (32): inject only where E_i / E_{i+1} < r_e, i.e. where the amplitude is positive
      const featureSize = Math.pow(2, i);
      const noise = curlNoise(ctx, p, featureSize, i);
      acceleration.addAssign(noise.mul(amplitude).mul(gains[i]).mul(u.ectStrength));
    }

    // eq. (34)
    const updated = vec3(vel.x, vel.y, vel.z).add(acceleration.mul(u.dt));
    textureStore(f.vel.write, c, vec4(updated, 0.0)).toWriteOnly();
  });
}
