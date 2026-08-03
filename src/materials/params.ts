/**
 * Sandbox knobs for MLS-MPM exhibits. Desktop lil-gui and the XR world panel both bind here.
 * Domain is ~1 unit tall; gravity / forces are sim units, not SI.
 */
import type { MaterialKind } from './MlsMpm';

export interface MaterialTuning {
  /** Multiplier on baseline gravity. */
  gravityScale: number;
  /** Multiplier on baseline hand / mouse poke. */
  handForceScale: number;
  /** Shear stiffness (neo-Hookean μ). Water ignores this (0). */
  mu: number;
  /** Volume stiffness (λ). Water uses this as weakly-compressible bulk. */
  lambda: number;
}

export interface MaterialsParams {
  gravity: number;
  handForce: number;
  sand: MaterialTuning;
  goo: MaterialTuning;
  water: MaterialTuning;
  /** Solver substeps per displayed frame. */
  substeps: number;
  /** Fixed Δt per substep. */
  subDt: number;
  mouseRadius: number;
}

export function defaultMaterialsParams(): MaterialsParams {
  return {
    gravity: 100,
    handForce: 40,
    sand: { gravityScale: 2.0, handForceScale: 1.5, mu: 12, lambda: 120 },
    goo: { gravityScale: 1.0, handForceScale: 4.0, mu: 140, lambda: 500 },
    water: { gravityScale: 2.0, handForceScale: 2.0, mu: 0, lambda: 600 },
    substeps: 14,
    subDt: 2.4e-4,
    mouseRadius: 0.065,
  };
}

export function materialTuning(params: MaterialsParams, kind: MaterialKind): MaterialTuning {
  return params[kind];
}
