/**
 * Algorithm 1, step 17 — velocity-based guiding, Kora §5.3.2.
 *
 * Velocity-based control "gives artists complete creative control over the flow, [but] it wipes
 * out the solver's generated dynamics and tends to produce unnatural motion if applied
 * indiscriminately. For this reason, we use velocity-based control selectively — for example,
 * only at the domain boundaries or restricted to the low-frequency components."
 *
 * Frequency-domain guiding [Forootaninia and Narain 2020] separates macroscopic motion from
 * detail, blends only the low band with the guide field, and puts the high band back:
 *
 *   u_low  = [J o ... o J](u)        eq. (38)
 *   u_high = u - u_low               eq. (39)
 *   u      = Blend(u_low, u_guide) + u_high    eq. (40)
 *
 * Like Kora, the decomposition uses repeated convolution rather than a Fourier transform, since
 * the sparse grid has no global frequency basis to work with.
 */
import { T, load, type N } from '../tsl';
import type { Ctx } from '../context';
import type { Storage3DTexture } from 'three/webgpu';

const { float, vec3, vec4, cross, exp, length, max, mix, normalize, textureStore } = T;

/**
 * The guide field: a rising, swirling column. Standing in for the artist-authored velocity
 * caches a production setup would use, it is enough to demonstrate that low-frequency guiding
 * steers the plume without flattening the solver's own detail.
 */
function guideVelocity(ctx: Ctx, world: N): N {
  const { u } = ctx;
  const radial = vec3(world.x, 0.0, world.z);
  const r = max(length(radial), float(1e-3));
  const tangent = normalize(cross(vec3(0, 1, 0), radial.div(r)));
  const falloff = exp(r.div(max(u.updraftRadius.mul(2.0), float(1e-3))).pow(2.0).negate());
  return tangent.mul(u.guidingSwirl.mul(falloff)).add(vec3(0.0, u.guidingRise.mul(falloff), 0.0));
}

export function guidingPass(ctx: Ctx, low: Storage3DTexture): N {
  const { g, f, u } = ctx;

  return g.kernel(() => {
    const c = g.coord();
    const vel = load(f.vel.read, c).xyz;
    const uLow = load(low, c).xyz; // eq. (38)
    const uHigh = vel.sub(uLow); // eq. (39)

    const world = u.origin.add(vec3(c).add(0.5).mul(u.dx));
    const guide = guideVelocity(ctx, world);

    // eq. (40) — the guide is itself only applied to the low band, so detail survives.
    const blended = mix(uLow, guide, u.guidingWeight);

    textureStore(f.vel.write, c, vec4(blended.add(uHigh), 0.0)).toWriteOnly();
  });
}
