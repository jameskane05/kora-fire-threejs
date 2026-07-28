/**
 * Spatial reference for the simulation domain: a floor grid, the world origin, and the bounds of
 * the voxel grid itself.
 *
 * The solver's domain is centred on the origin horizontally and sits on the floor, spanning
 * [-size/2, size/2] in x and z and [0, size] in y — the same box the raymarcher intersects. Seeing
 * it drawn makes it obvious where an emitter actually sits and how much headroom the plume has
 * before it reaches the open boundary.
 */
import { AxesHelper, Box3, Box3Helper, Color, GridHelper, Group, Vector3 } from 'three/webgpu';

/** Roughly one line every quarter metre, kept within a legible range. */
function divisionsFor(domainSize: number): number {
  return Math.max(4, Math.min(40, Math.round(domainSize / 0.25)));
}

export function createDomainHelper(domainSize: number): Group {
  const group = new Group();
  const half = domainSize / 2;

  const grid = new GridHelper(
    domainSize,
    divisionsFor(domainSize),
    new Color(0x4a5568),
    new Color(0x1e242e),
  );
  group.add(grid);

  const bounds = new Box3Helper(
    new Box3(new Vector3(-half, 0, -half), new Vector3(half, domainSize, half)),
    new Color(0x2b3444),
  );
  group.add(bounds);

  // Scaled to the domain so the origin stays readable at any zoom, but kept short enough that it
  // does not read as part of the fire.
  group.add(new AxesHelper(domainSize * 0.18));

  // Reference geometry must never occlude the volume, which draws after it without depth writes.
  group.traverse((o) => {
    o.renderOrder = -1;
  });

  return group;
}
