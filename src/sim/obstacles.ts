/**
 * Solid displacement volumes.
 *
 * The paper does not cover collision objects — Kora inherits them from the host simulation
 * framework — but a fire that ignores the set is not much use, so this adds the standard
 * treatment: solids enter as a signed distance field, and the pressure projection sees their
 * faces as Neumann boundaries with a prescribed flux. That is what makes the plume go *around*
 * an obstacle instead of through it, and what lets a moving one shove the fire.
 *
 * Every primitive is a rounded box, which is not a compromise: with zero half-extents it is a
 * sphere, with zero rounding a box, and with extents along one axis a capsule. One SDF, no
 * branching per shape, and the gizmo's scale handles map onto the half-extents directly.
 */
import { Vector3, Vector4 } from 'three/webgpu';
import { uniform } from 'three/tsl';
import { T, type N } from './tsl';

const { float, vec3, cross, length, max, min } = T;

/**
 * How many primitives the shaders are willing to unroll.
 *
 * The count actually built into a frame is the number in use, not this — adding or removing one
 * recompiles the graph, so an unused slot costs nothing. This is only the ceiling.
 *
 * Scene gizmo colliders and tracked-hand palm boxes share this pool. Hand slots are reserved at
 * the end of the list so adding/removing a scene primitive does not stomp live hand poses.
 */
export const MAX_SCENE_OBSTACLES = 4;
export const MAX_HAND_SOLIDS = 2;
export const MAX_OBSTACLES = MAX_SCENE_OBSTACLES + MAX_HAND_SOLIDS;

export type ObstacleKind = 'sphere' | 'box' | 'capsule';

/**
 * What a drag does to the selected primitive. Lives here rather than with the scene objects so
 * that the parameter block can hold it without depending on three's transform controls.
 */
export type GizmoMode = 'translate' | 'rotate' | 'scale';

export interface ObstacleUniforms {
  /** world-space centre */
  centre: { value: Vector3 };
  /** half-extents (xyz) and rounding radius (w) of the rounded box, *before* scaling */
  size: { value: Vector4 };
  /** per-axis scale, applied to the sample point rather than to the extents — see below */
  scale: { value: Vector3 };
  /** *inverse* orientation, so the shader rotates the sample point into the primitive's frame */
  rotation: { value: Vector4 };
  /** linear velocity of the centre, m/s */
  velocity: { value: Vector3 };
  /** angular velocity, rad/s, about the centre */
  spin: { value: Vector3 };
}

export function createObstacleUniforms(): ObstacleUniforms[] {
  return Array.from({ length: MAX_OBSTACLES }, () => ({
    centre: uniform(new Vector3()),
    size: uniform(new Vector4(0, 0, 0, 0)),
    scale: uniform(new Vector3(1, 1, 1)),
    rotation: uniform(new Vector4(0, 0, 0, 1)),
    velocity: uniform(new Vector3()),
    spin: uniform(new Vector3()),
  })) as unknown as ObstacleUniforms[];
}

/** Rotates a vector by a quaternion: v + 2 q_xyz x (q_xyz x v + q_w v). */
function rotateByQuaternion(v: N, q: N): N {
  const t = cross(q.xyz, v).add(v.mul(q.w));
  return v.add(cross(q.xyz, t).mul(2.0));
}

/**
 * Signed distance to a rounded box, exact outside and a good approximation within the corners.
 * `b` are the half-extents before rounding and `r` the radius added back on all sides.
 */
function roundedBox(p: N, b: N, r: N): N {
  const q = T.abs(p).sub(b);
  const outside = length(max(q, vec3(0.0)));
  const inside = min(max(q.x, max(q.y, q.z)), float(0.0));
  return outside.add(inside).sub(r);
}

export interface SolidSample {
  /** signed distance to the nearest solid surface, negative inside */
  distance: N;
  /** velocity of the solid at this point — zero when nothing is near */
  velocity: N;
}

/**
 * Distance to the nearest primitive, and that primitive's velocity at the sample point.
 *
 * The velocity is taken from whichever solid is closest rather than blended, which is what you
 * want at a boundary: a face belongs to exactly one solid, and averaging two would prescribe a
 * flux neither of them is actually imposing.
 */
export function sampleObstacles(slots: ObstacleUniforms[], count: number, world: N): SolidSample {
  if (count === 0) {
    return { distance: float(1e3), velocity: vec3(0.0) };
  }

  let distance: N = float(1e3);
  let velocity: N = vec3(0.0);

  for (let i = 0; i < count; i++) {
    const o = slots[i];
    const offset = world.sub(o.centre);

    // Non-uniform scale is applied to the sample point, not to the shape's extents. Stretching
    // the extents cannot work for the degenerate cases the rounded box relies on: a sphere is
    // extents of zero and all of its size is in the rounding radius, which is a scalar, so no
    // amount of per-axis scaling would ever turn it into an ellipsoid. Dividing the point through
    // instead deforms every shape correctly and needs no special cases.
    //
    // The result is no longer a true distance — along a stretched axis it over-estimates — so it
    // is brought back with the smallest scale factor, which makes it a conservative bound. That
    // is enough because nothing reads the magnitude: every consumer only tests the sign, and the
    // zero level set this produces is exact.
    const local = rotateByQuaternion(offset, o.rotation).div(o.scale);
    const shrink = min(min(o.scale.x, o.scale.y), o.scale.z);
    const d = roundedBox(local, o.size.xyz, o.size.w).mul(shrink);

    const v = o.velocity.add(cross(o.spin, offset));

    const nearer = d.lessThan(distance);
    velocity = nearer.select(v, velocity);
    distance = min(d, distance);
  }

  return { distance, velocity };
}

/** Half-extents and rounding radius for a primitive of a given kind, before the gizmo's scale. */
export function baseGeometry(kind: ObstacleKind, size: number): { extents: Vector3; round: number } {
  const h = size / 2;
  switch (kind) {
    case 'sphere':
      return { extents: new Vector3(0, 0, 0), round: h };
    case 'capsule':
      return { extents: new Vector3(0, h, 0), round: h / 2 };
    case 'box':
      // A slight bevel rather than a true corner: an exactly square edge lands between voxel
      // centres and stairsteps, and the rounding is well under one cell at any usable resolution.
      return { extents: new Vector3(h, h, h), round: size * 0.04 };
  }
}
