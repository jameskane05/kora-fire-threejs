/**
 * Cut soft-gel springs that pass through kinematic colliders (hands / displacement boxes).
 * Same idea as goo parting — break durable links so the cavity doesn't heal.
 */
import { type V3, rotate, transform, v3 } from './maths';
import { type Force, type Rigid, type Solver } from './solver';

/** Max springs destroyed per frame (keeps one swipe from shredding the whole mound). */
export const AVBD_MAX_CUTS_PER_FRAME = 144;

function isSpring(f: Force): f is Force & {
  kind: 'spring';
  rA: V3;
  rB: V3;
  bodyA: Rigid;
  bodyB: Rigid;
} {
  return (f as { kind?: string }).kind === 'spring';
}

/** True if world point is inside the kinematic OBB (optionally shrunk). */
function pointInsideKinematic(p: V3, k: Rigid, shrink = 0.002): boolean {
  const qInv = { x: -k.positionAng.x, y: -k.positionAng.y, z: -k.positionAng.z, w: k.positionAng.w };
  const local = rotate(
    qInv,
    v3(p.x - k.positionLin.x, p.y - k.positionLin.y, p.z - k.positionLin.z),
  );
  const hx = Math.max(k.size.x * 0.5 - shrink, 0.004);
  const hy = Math.max(k.size.y * 0.5 - shrink, 0.004);
  const hz = Math.max(k.size.z * 0.5 - shrink, 0.004);
  return Math.abs(local.x) <= hx && Math.abs(local.y) <= hy && Math.abs(local.z) <= hz;
}

/**
 * Destroy springs whose midpoint lies inside an active kinematic collider.
 * Returns how many springs were cut.
 */
export function severSpringsInKinematics(solver: Solver, kinematics: Rigid[]): number {
  const blades = kinematics.filter((k) => k.positionLin.y > -5);
  if (!blades.length) return 0;

  let cut = 0;
  let f: typeof solver.forces = solver.forces;
  while (f && cut < AVBD_MAX_CUTS_PER_FRAME) {
    const next = f.next;
    if (isSpring(f) && f.bodyA && f.bodyB) {
      const pA = transform(f.bodyA.positionLin, f.bodyA.positionAng, f.rA);
      const pB = transform(f.bodyB.positionLin, f.bodyB.positionAng, f.rB);
      const mid = v3((pA.x + pB.x) * 0.5, (pA.y + pB.y) * 0.5, (pA.z + pB.z) * 0.5);
      for (const k of blades) {
        if (pointInsideKinematic(mid, k)) {
          f.destroy();
          cut++;
          break;
        }
      }
    }
    f = next;
  }
  return cut;
}
