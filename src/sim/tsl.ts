/**
 * Grid helpers shared by every compute kernel.
 *
 * Node-graph code is written against a loosely typed view of `three/tsl` — the shipped
 * declarations model the DSL closely enough for app code but fight hard against the
 * generic chaining that shader graphs are made of.
 */
import * as TSLTyped from 'three/tsl';
import type { Storage3DTexture } from 'three/webgpu';
import type { Res } from './Grid';

/* eslint-disable @typescript-eslint/no-explicit-any */
export const T = TSLTyped as any;

const { Fn, float, int, ivec3, vec3, texture3D, instanceIndex, max, min, floor } = T;

export type N = any;

/** Texel fetch, no filtering. */
export function load(tex: Storage3DTexture, coord: N): N {
  return texture3D(tex, coord).setSampler(false);
}

export interface GridOps {
  readonly res: Res;
  readonly count: number;
  /** Unpacks the flat compute invocation index into an ivec3 voxel coordinate. */
  coord(): N;
  /** Clamps a voxel coordinate into the domain (clamp-to-edge / zero-gradient). */
  clampCoord(c: N): N;
  /** Texel fetch with clamped coordinates. */
  fetch(tex: Storage3DTexture, c: N): N;
  /** Trilinear sample. `p` is in voxel units, where cell (i,j,k) has its centre at (i+.5, j+.5, k+.5). */
  sample(tex: Storage3DTexture, p: N): N;
  /** True when the voxel coordinate lies within the texture bounds. */
  inside(c: N): N;
  /**
   * True when the voxel is a solved cell rather than a ghost cell.
   *
   * The outer layer of voxels is reserved as the ambient boundary: it is where Kora's
   * hydrostatic Dirichlet condition and wind Neumann condition live (§4.7.1, §5.3.2). Keeping a
   * one-cell margin also means every MAC face of a solved cell exists in the texture.
   */
  interior(c: N): N;
  /** Cell-centre position in voxel units. */
  centre(c: N): N;
  /** Builds a compute node from a kernel body, dispatched once per voxel. */
  kernel(body: () => void): N;
}

export function gridOps(res: Res): GridOps {
  const [NX, NY, NZ] = res;
  const count = NX * NY * NZ;
  const resF = vec3(NX, NY, NZ);
  const maxCoord = ivec3(NX - 1, NY - 1, NZ - 1);

  const clampCoord = (c: N) => min(max(c, ivec3(0)), maxCoord);

  return {
    res,
    count,

    coord: () =>
      ivec3(
        int(instanceIndex.mod(NX)),
        int(instanceIndex.div(NX).mod(NY)),
        int(instanceIndex.div(NX * NY)),
      ),

    clampCoord,

    fetch: (tex, c) => load(tex, clampCoord(c)),

    sample: (tex, p) => texture3D(tex, p.div(resF)).level(int(0)),

    inside: (c: N) =>
      c.x
        .greaterThanEqual(int(0))
        .and(c.y.greaterThanEqual(int(0)))
        .and(c.z.greaterThanEqual(int(0)))
        .and(c.x.lessThan(int(NX)))
        .and(c.y.lessThan(int(NY)))
        .and(c.z.lessThan(int(NZ))),

    interior: (c: N) =>
      c.x
        .greaterThanEqual(int(1))
        .and(c.y.greaterThanEqual(int(1)))
        .and(c.z.greaterThanEqual(int(1)))
        .and(c.x.lessThan(int(NX - 1)))
        .and(c.y.lessThan(int(NY - 1)))
        .and(c.z.lessThan(int(NZ - 1))),

    centre: (c: N) => vec3(c).add(0.5),

    kernel: (body: () => void) => Fn(body)().compute(count),
  };
}

/**
 * Trilinear fetch of a staggered (MAC) component.
 *
 * Velocity lives on cell faces: the x component of texel (i,j,k) is the velocity through the
 * face at (i, j+0.5, k+0.5). Shifting the sample position by half a voxel along the component
 * axis lines that lattice up with texel centres, so hardware filtering does the rest.
 */
export function sampleFace(g: GridOps, tex: Storage3DTexture, p: N, axis: 0 | 1 | 2): N {
  const offset = axis === 0 ? vec3(0.5, 0, 0) : axis === 1 ? vec3(0, 0.5, 0) : vec3(0, 0, 0.5);
  const v = g.sample(tex, p.add(offset));
  return axis === 0 ? v.x : axis === 1 ? v.y : v.z;
}

/** Full MAC velocity at an arbitrary point, in voxel units. */
export function sampleVelocity(g: GridOps, tex: Storage3DTexture, p: N): N {
  return vec3(sampleFace(g, tex, p, 0), sampleFace(g, tex, p, 1), sampleFace(g, tex, p, 2));
}

/** Cell-centred velocity by averaging the two opposing faces of the cell. */
export function centredVelocity(g: GridOps, tex: Storage3DTexture, c: N): N {
  const self = g.fetch(tex, c);
  const px = g.fetch(tex, c.add(ivec3(1, 0, 0)));
  const py = g.fetch(tex, c.add(ivec3(0, 1, 0)));
  const pz = g.fetch(tex, c.add(ivec3(0, 0, 1)));
  return vec3(self.x.add(px.x), self.y.add(py.y), self.z.add(pz.z)).mul(0.5);
}

/** Shorthand for the six axis-aligned unit offsets, in the order -x +x -y +y -z +z. */
export const NEIGHBOURS = [
  [-1, 0, 0],
  [1, 0, 0],
  [0, -1, 0],
  [0, 1, 0],
  [0, 0, -1],
  [0, 0, 1],
] as const;

export function offset(o: readonly [number, number, number] | (typeof NEIGHBOURS)[number]): N {
  return ivec3(o[0], o[1], o[2]);
}

/**
 * World-space position of a point given in voxel units.
 *
 * Structurally typed on the two uniforms it reads rather than on the whole uniform block, so
 * that grid-to-world conversion can sit here without this module depending on the uniforms.
 */
export function worldPos(u: { origin: N; dx: N }, voxel: N): N {
  return u.origin.add(voxel.mul(u.dx));
}

/** floor() that returns an integer vector. */
export function ifloor(v: N): N {
  return ivec3(floor(v));
}

export { float, int, ivec3, vec3 };
