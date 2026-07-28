import type { GridOps } from './tsl';
import type { FieldsView } from './Grid';
import type { KoraUniforms } from './uniforms';
import type { Mixture } from './mixture';
import type { NoiseVolume } from './noise';

/**
 * Everything a compute pass needs: the grid, the fields, the uniforms and the mixture algebra.
 *
 * `f` is a snapshot rather than the live `SimFields`, and is refreshed between passes — see
 * `SimFields.view()` for why the distinction matters.
 */
export interface Ctx {
  g: GridOps;
  f: FieldsView;
  u: KoraUniforms;
  m: Mixture;
  /** tileable curl-noise volume for the ECT turbulence term (§4.8) */
  noise: NoiseVolume;
}
