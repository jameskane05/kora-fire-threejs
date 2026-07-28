/**
 * Algorithm 1, steps 4 and 7 — mass diffusion and thermal conduction, Kora §4.7.2.
 *
 * The paper first solved the heat equation (6) implicitly, like the pressure projection, but
 * "because the linear system needed to be solved for quantities discretized at twice the
 * resolution of the pressure grid, this approach proved too costly for production use. Instead,
 * we approximate the solution using convolution with Gaussian kernels."
 *
 * Here that convolution is a separable three-tap kernel [a, 1-2a, a] with a = D dt / dx^2, run
 * once per axis. Each chemical species gets its own diffusivity — the paper diffuses species
 * independently, and Graham's law (D ~ 1/sqrt(M)) supplies the relative rates.
 *
 * The flame-front SDF acts as a Dirichlet boundary: conduction is suppressed inside the reaction
 * zone so that thin flames are not smeared away.
 */
import { T, load, type N } from '../tsl';
import type { Ctx } from '../context';

const { float, ivec3, vec4, min, step, textureStore } = T;

export type DiffusionKind = 'mass' | 'thermal';

export function diffusionPass(ctx: Ctx, axis: 0 | 1 | 2, kind: DiffusionKind): N {
  const { g, f, u } = ctx;
  const dir = ivec3(axis === 0 ? 1 : 0, axis === 1 ? 1 : 0, axis === 2 ? 1 : 0);

  return g.kernel(() => {
    const c = g.coord();
    const invDx2 = float(1.0).div(u.dx.mul(u.dx));

    if (kind === 'mass') {
      const centre = load(f.chem.read, c);
      const a = g.fetch(f.chem.read, c.add(dir));
      const b = g.fetch(f.chem.read, c.sub(dir));

      // per-species stencil weight, clamped to the explicit stability limit
      const w = min(u.massDiffusivity.mul(u.diffusivityScale).mul(u.dt).mul(invDx2), float(0.25));
      const laplacian = a.add(b).sub(centre.mul(2.0));

      textureStore(f.chem.write, c, centre.add(laplacian.mul(w))).toWriteOnly();
    } else {
      const centre = load(f.aux.read, c);
      const a = g.fetch(f.aux.read, c.add(dir));
      const b = g.fetch(f.aux.read, c.sub(dir));

      const w = min(u.thermalDiffusivity.mul(u.dt).mul(invDx2), float(0.25));
      // Dirichlet on the reaction zone: no conduction where the front is inside.
      const outside = step(float(0.0), centre.w);
      const laplacian = a.y.add(b.y).sub(centre.y.mul(2.0));
      const temperature = centre.y.add(laplacian.mul(w).mul(outside));

      textureStore(f.aux.write, c, vec4(centre.x, temperature, centre.z, centre.w)).toWriteOnly();
    }
  });
}
