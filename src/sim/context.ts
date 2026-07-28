import type { Data3DTexture } from 'three/webgpu';
import type { GridOps } from './tsl';
import type { FieldsView } from './Grid';
import type { KoraUniforms } from './uniforms';
import type { Mixture } from './mixture';

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
  /** tileable vector noise potential for the ECT curl-noise term (§4.8) */
  noise: Data3DTexture;
}
