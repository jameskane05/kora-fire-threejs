import {
  ClampToEdgeWrapping,
  FloatType,
  HalfFloatType,
  LinearFilter,
  NearestFilter,
  RGBAFormat,
  RedFormat,
  Storage3DTexture,
} from 'three/webgpu';

export type Res = readonly [number, number, number];

export type TexKind = 'rgba16f' | 'r32f';

export function makeTexture(res: Res, kind: TexKind, name: string): Storage3DTexture {
  const tex = new Storage3DTexture(res[0], res[1], res[2]);
  tex.name = name;

  if (kind === 'rgba16f') {
    tex.format = RGBAFormat;
    tex.type = HalfFloatType;
    tex.minFilter = LinearFilter;
    tex.magFilter = LinearFilter;
  } else {
    // r32float is not a filterable format in WebGPU; these are only ever texelFetch'd.
    tex.format = RedFormat;
    tex.type = FloatType;
    tex.minFilter = NearestFilter;
    tex.magFilter = NearestFilter;
  }

  tex.wrapS = ClampToEdgeWrapping;
  tex.wrapT = ClampToEdgeWrapping;
  tex.wrapR = ClampToEdgeWrapping;
  tex.generateMipmaps = false;

  return tex;
}

/**
 * A double-buffered field. WebGPU core only permits read_write storage textures for a couple
 * of single-channel formats, so every pass reads from `read` (as a sampled texture) and writes
 * to `write` (as a write-only storage texture), then swaps.
 */
export class Field {
  private a: Storage3DTexture;
  private b: Storage3DTexture;

  constructor(res: Res, kind: TexKind, name: string) {
    this.a = makeTexture(res, kind, `${name}.a`);
    this.b = makeTexture(res, kind, `${name}.b`);
  }

  get read(): Storage3DTexture {
    return this.a;
  }

  get write(): Storage3DTexture {
    return this.b;
  }

  swap(): void {
    const t = this.a;
    this.a = this.b;
    this.b = t;
  }

  dispose(): void {
    this.a.dispose();
    this.b.dispose();
  }
}

/**
 * The simulation state.
 *
 * Kora tracks absolute chemical amounts as dimensionless *concentrations* (§4.3.1) rather than
 * relative fractions, "for improved mass tracking" (§3.1). Nitrogen and the lumped CO2 + H2O
 * products are inert but still carry concentration and heat capacity.
 *
 *   chem = (fuel, oxygen, nitrogen, product)
 *   aux  = (soot, temperature [K], released heat [MJ/m^3], flame-front SDF [m])
 *   vel  = (u, v, w, unused)
 */
export interface FieldView {
  read: Storage3DTexture;
  write: Storage3DTexture;
}

/** A snapshot of {@link SimFields} with the ping-pong buffers already resolved. */
export interface FieldsView {
  chem: FieldView;
  aux: FieldView;
  vel: FieldView;
  pressure: FieldView;
  divergence: Storage3DTexture;
  expansion: Storage3DTexture;
  poissonA: Storage3DTexture;
  poissonB: Storage3DTexture;
}

export class SimFields {
  readonly chem: Field;
  readonly aux: Field;
  readonly vel: Field;
  readonly pressure: Field;
  readonly divergence: Storage3DTexture;
  /** density scaling s of eq. (10), cached between the expansion pass and the concentration update */
  readonly expansion: Storage3DTexture;
  /**
   * Poisson stencil weights, held constant across the Jacobi sweeps.
   *
   * Density does not change during the projection, so the face weights 2 / (rho_self + rho_n),
   * the boundary mask and the Neumann wind faces are all frame constants. Recomputing them
   * inside each sweep meant a full mixture-density evaluation for seven cells per voxel per
   * iteration; caching them here turns a sweep into a plain weighted stencil.
   *
   *   poissonA = (w[-x], w[+x], w[-y], w[+y])
   *   poissonB = (w[-z], w[+z], 1 / sum(w), interior)
   */
  readonly poissonA: Storage3DTexture;
  readonly poissonB: Storage3DTexture;

  constructor(readonly res: Res) {
    this.chem = new Field(res, 'rgba16f', 'chem');
    this.aux = new Field(res, 'rgba16f', 'aux');
    this.vel = new Field(res, 'rgba16f', 'vel');
    this.pressure = new Field(res, 'r32f', 'pressure');
    this.divergence = makeTexture(res, 'r32f', 'divergence');
    this.expansion = makeTexture(res, 'r32f', 'expansion');
    this.poissonA = makeTexture(res, 'rgba16f', 'poissonA');
    this.poissonB = makeTexture(res, 'rgba16f', 'poissonB');
  }

  get count(): number {
    return this.res[0] * this.res[1] * this.res[2];
  }

  /**
   * The buffers as they stand right now, resolved to plain properties.
   *
   * Passes must be handed one of these rather than the live `SimFields`. A kernel body runs
   * lazily, when three.js builds the shader, by which point every swap in the frame has already
   * happened — so reading `field.read` from inside a kernel yields the end-of-frame buffer for
   * every pass alike. Snapshotting before the pass is built pins each one to its own buffers.
   */
  view(): FieldsView {
    return {
      chem: { read: this.chem.read, write: this.chem.write },
      aux: { read: this.aux.read, write: this.aux.write },
      vel: { read: this.vel.read, write: this.vel.write },
      pressure: { read: this.pressure.read, write: this.pressure.write },
      divergence: this.divergence,
      expansion: this.expansion,
      poissonA: this.poissonA,
      poissonB: this.poissonB,
    };
  }

  dispose(): void {
    this.chem.dispose();
    this.aux.dispose();
    this.vel.dispose();
    this.pressure.dispose();
    this.divergence.dispose();
    this.expansion.dispose();
    this.poissonA.dispose();
    this.poissonB.dispose();
  }
}
