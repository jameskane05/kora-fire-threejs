/**
 * Rasterises the displacement volumes onto the grid, and the accessors everything else reads
 * them back through.
 *
 * The convention throughout: the stored distance is signed, negative inside the solid, and taken
 * at the cell *centre*. A MAC face is judged solid by averaging the two cells it separates, which
 * puts the boundary on the face rather than half a cell to one side of it.
 */
import { T, load, worldPos, type N } from '../tsl';
import { sampleObstacles } from '../obstacles';
import type { Ctx } from '../context';

const { float, ivec3, vec3, vec4, clamp, textureStore } = T;

/** The stored distance is clamped to this many cells either side of the surface. */
const NARROW_BAND = 4.0;

export function solidBakePass(ctx: Ctx, count: number): N {
  const { g, f, u } = ctx;

  return g.kernel(() => {
    const c = g.coord();
    const solid = sampleObstacles(u.obstacles, count, worldPos(u, g.centre(c)));

    // Kept to a narrow band because the field is a half float: metres of empty domain would
    // spend all the mantissa far from the surface, where the value is not read for anything.
    const band = u.dx.mul(NARROW_BAND);
    const distance = clamp(solid.distance, band.negate(), band);

    textureStore(f.solid, c, vec4(solid.velocity, distance)).toWriteOnly();
  });
}

export interface Solid {
  /** Signed distance at a cell centre; positive when there is no solid. */
  at(c: N): N;
  /** True when the cell centre lies inside a solid. */
  inside(c: N): N;
  /** True when the MAC face between `c` and the cell behind it along `axis` is inside a solid. */
  face(c: N, axis: readonly [number, number, number]): N;
  /** Velocity the solid imposes on that face, as a scalar along the face's own axis. */
  faceVelocity(c: N, axis: readonly [number, number, number]): N;
  /** Velocity of the solid at a cell centre. */
  velocity(c: N): N;
}

/**
 * Binds the solid lookups to the buffers current *now*.
 *
 * Same rule as `makeDensity`: call this while building a pass, never from inside a kernel body.
 */
export function makeSolid(ctx: Ctx, count: number): Solid {
  const { g, f } = ctx;

  const at = (c: N): N => g.fetch(f.solid, c).w;
  const velocity = (c: N): N => g.fetch(f.solid, c).xyz;

  const inside = (c: N): N => at(c).lessThan(float(0.0));

  return {
    at,
    velocity,
    inside,

    // A face counts as solid when *either* of the cells it separates is, rather than when their
    // averaged distance is negative. Averaging leaves half-buried cells still coupled to their
    // fluid neighbours through the pressure, which is a hole in the boundary; the union version
    // decouples solid cells completely, at the cost of rounding the obstacle out to whole cells.
    face: (c, axis) => inside(c).or(inside(c.sub(ivec3(axis[0], axis[1], axis[2])))),

    faceVelocity: (c, axis) => {
      const back = c.sub(ivec3(axis[0], axis[1], axis[2]));
      const v = velocity(c).add(velocity(back)).mul(0.5);
      return axis[0] === 1 ? v.x : axis[1] === 1 ? v.y : v.z;
    },
  };
}

/**
 * Whether the face separating cell `c` from its neighbour at `step` is solid.
 *
 * Velocity is stored on the *lower* face of each cell, so the face between two cells belongs to
 * whichever of them is further along the axis. Getting this off by one cell would put the
 * boundary on the wrong side of the obstacle and leak flow through one of its walls.
 */
export function solidFace(solid: Solid, c: N, step: readonly [number, number, number]): N {
  const axis = [Math.abs(step[0]), Math.abs(step[1]), Math.abs(step[2])] as const;
  const forward = step[0] + step[1] + step[2] > 0;
  const cell = forward ? c.add(ivec3(step[0], step[1], step[2])) : c;
  return solid.face(cell, axis);
}

/**
 * Pins the MAC velocities of solid faces to the solid's own velocity.
 *
 * Run immediately before the divergence is taken, so the projection sees the obstacle's motion
 * as the boundary flux it has to work around. Doing it any earlier lets buoyancy put flux back
 * through the boundary in the same frame.
 */
export function solidVelocityPass(ctx: Ctx, count: number): N {
  const { g, f } = ctx;
  const solid = makeSolid(ctx, count);

  return g.kernel(() => {
    const c = g.coord();
    const vel = load(f.vel.read, c);

    const component = (axis: readonly [number, number, number], value: N) =>
      solid.face(c, axis).select(solid.faceVelocity(c, axis), value);

    const updated = vec3(
      component([1, 0, 0], vel.x),
      component([0, 1, 0], vel.y),
      component([0, 0, 1], vel.z),
    );

    textureStore(f.vel.write, c, vec4(updated, 0.0)).toWriteOnly();
  });
}
