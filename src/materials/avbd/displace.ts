/**
 * Softened displacement for AVBD soft nodes.
 * Uses the same ForcePoint volumes as MLS-MPM goo, but with a much lower impulse scale —
 * raw goo handForce (~160) explodes a mass–spring lattice.
 * Springs whose midpoint sits deep inside a force volume are severed (cut-through).
 */
import type { ForcePoint } from '../MlsMpm';
import { type V3, addEqV3, lengthV3, normalize, scaleV3, subV3, transform, v3 } from './maths';
import { type Force, type Rigid, type Solver } from './solver';

function isSpring(f: Force): f is Force & {
  kind: 'spring';
  rA: { x: number; y: number; z: number };
  rB: { x: number; y: number; z: number };
  bodyA: Rigid;
  bodyB: Rigid;
} {
  return (f as { kind?: string }).kind === 'spring';
}

/** Maps MPM handForce onto AVBD soft (goo default 160 → ~5.6). */
export const AVBD_FORCE_SCALE = 0.035;
/** Cap on per-force velocity impulse (content m/s added this frame). */
export const AVBD_MAX_IMPULSE = 0.4;
/** Max position correction per force per frame. */
export const AVBD_MAX_PUSH = 0.006;
/** Sever when midpoint is inside the volume by at least this much (content metres). */
export const AVBD_SEVER_DEPTH = 0.018;
/** Max springs destroyed per frame — avoids one poke shredding the whole blob. */
export const AVBD_MAX_CUTS_PER_FRAME = 48;

function boxSdf(local: V3, half: V3): number {
  const qx = Math.abs(local.x) - half.x;
  const qy = Math.abs(local.y) - half.y;
  const qz = Math.abs(local.z) - half.z;
  const outside = Math.hypot(Math.max(qx, 0), Math.max(qy, 0), Math.max(qz, 0));
  const inside = Math.min(Math.max(qx, Math.max(qy, qz)), 0);
  return outside + inside;
}

function capsuleSdf(local: V3, halfLen: number, r: number): number {
  const px = Math.min(halfLen, Math.max(-halfLen, local.x));
  return Math.hypot(local.x - px, local.y, local.z) - r;
}

type ForceHit = { push: V3; weight: number; sdf: number };

function sampleForce(x: V3, f: ForcePoint, domain: number): ForceHit | null {
  const cx = (f.x - 0.5) * domain;
  const cy = f.y * domain;
  const cz = (f.z - 0.5) * domain;
  const d = subV3(x, v3(cx, cy, cz));

  if (f.isCapsule) {
    const ax = v3(f.ax, f.ay, f.az);
    const ay = v3(f.bx, f.by, f.bz);
    const az = v3(f.cx, f.cy, f.cz);
    const halfLen = Math.max(f.hx * domain, 1e-4);
    const r = Math.max((f.radius > 0 ? f.radius : f.hy) * domain, 1e-4);
    const local = v3(
      d.x * ax.x + d.y * ax.y + d.z * ax.z,
      d.x * ay.x + d.y * ay.y + d.z * ay.z,
      d.x * az.x + d.y * az.y + d.z * az.z,
    );
    const sdf = capsuleSdf(local, halfLen, r);
    const shell = Math.max(r * 0.85, 0.012);
    if (sdf >= shell) return null;
    const e = 1e-3;
    const gx =
      capsuleSdf(v3(local.x + e, local.y, local.z), halfLen, r) -
      capsuleSdf(v3(local.x - e, local.y, local.z), halfLen, r);
    const gy =
      capsuleSdf(v3(local.x, local.y + e, local.z), halfLen, r) -
      capsuleSdf(v3(local.x, local.y - e, local.z), halfLen, r);
    const gz =
      capsuleSdf(v3(local.x, local.y, local.z + e), halfLen, r) -
      capsuleSdf(v3(local.x, local.y, local.z - e), halfLen, r);
    const gl = Math.hypot(gx, gy, gz);
    const nl = gl > 1e-6 ? v3(gx / gl, gy / gl, gz / gl) : v3(1, 0, 0);
    const push = normalize(
      v3(
        ax.x * nl.x + ay.x * nl.y + az.x * nl.z,
        ax.y * nl.x + ay.y * nl.y + az.y * nl.z,
        ax.z * nl.x + ay.z * nl.y + az.z * nl.z,
      ),
    );
    return { push, weight: 1 - Math.max(sdf, 0) / shell, sdf };
  }

  if (!f.isBox) {
    const r = Math.max(f.radius * domain, 1e-4);
    const dist = lengthV3(d);
    if (!Number.isFinite(dist) || dist >= r || dist <= 1e-5) return null;
    return { push: normalize(d), weight: 1 - dist / r, sdf: dist - r };
  }

  const ax = v3(f.ax, f.ay, f.az);
  const ay = v3(f.bx, f.by, f.bz);
  const az = v3(f.cx, f.cy, f.cz);
  const half = v3(
    Math.max(f.hx * domain, 1e-4),
    Math.max(f.hy * domain, 1e-4),
    Math.max(f.hz * domain, 1e-4),
  );
  const local = v3(
    d.x * ax.x + d.y * ax.y + d.z * ax.z,
    d.x * ay.x + d.y * ay.y + d.z * ay.z,
    d.x * az.x + d.y * az.y + d.z * az.z,
  );
  const sdf = boxSdf(local, half);
  const shell = Math.max(Math.min(half.x, half.y, half.z) * 0.85, 0.012);
  if (sdf >= shell) return null;
  const e = 1e-3;
  const gx =
    boxSdf(v3(local.x + e, local.y, local.z), half) -
    boxSdf(v3(local.x - e, local.y, local.z), half);
  const gy =
    boxSdf(v3(local.x, local.y + e, local.z), half) -
    boxSdf(v3(local.x, local.y - e, local.z), half);
  const gz =
    boxSdf(v3(local.x, local.y, local.z + e), half) -
    boxSdf(v3(local.x, local.y, local.z - e), half);
  const gl = Math.hypot(gx, gy, gz);
  const nl = gl > 1e-6 ? v3(gx / gl, gy / gl, gz / gl) : v3(1, 0, 0);
  const push = normalize(
    v3(
      ax.x * nl.x + ay.x * nl.y + az.x * nl.z,
      ax.y * nl.x + ay.y * nl.y + az.y * nl.z,
      ax.z * nl.x + ay.z * nl.y + az.z * nl.z,
    ),
  );
  return { push, weight: 1 - Math.max(sdf, 0) / shell, sdf };
}

/**
 * Apply velocity impulses (+ light penetration correction) from force volumes onto soft bodies.
 * `domain` is content size of the sim cube (usually 1); ForcePoint coords are in [0,1]³.
 */
function forceRadius(f: ForcePoint, domain: number): number {
  if (f.isCapsule) {
    const r = (f.radius > 0 ? f.radius : f.hy) * domain;
    return Math.max(f.hx * domain + r, 0.02) * 1.2;
  }
  if (!f.isBox) return Math.max(f.radius * domain, 0.02);
  return Math.max(f.hx, f.hy, f.hz) * domain * 1.8;
}

/** Cheap reject: force volume does not overlap the resting dome AABB. */
function forceNearDome(f: ForcePoint, domain: number): boolean {
  const cx = (f.x - 0.5) * domain;
  const cy = f.y * domain;
  const cz = (f.z - 0.5) * domain;
  const r = forceRadius(f, domain);
  return Math.hypot(cx, cz) < 0.32 + r && cy > -0.02 && cy < 0.22 + r;
}

export function applyDisplacementForces(
  nodes: Rigid[],
  forces: ForcePoint[],
  domain: number,
): void {
  if (!nodes.length || !forces.length) return;
  const active = forces.filter((f) => f.strength !== 0 && forceNearDome(f, domain));
  if (!active.length) return;

  for (const body of nodes) {
    if (body.mass <= 0 || !body.soft) continue;
    const x = body.positionLin;
    let hit = false;

    for (const f of active) {
      const sample = sampleForce(x, f, domain);
      if (!sample || sample.weight <= 0) continue;
      hit = true;
      const impulse = Math.min(
        Math.abs(f.strength) * sample.weight * AVBD_FORCE_SCALE,
        AVBD_MAX_IMPULSE,
      );
      const sign = f.strength >= 0 ? 1 : -1;
      addEqV3(body.velocityLin, scaleV3(sample.push, impulse * sign));
      if (sample.sdf < 0) {
        const push = Math.min(-sample.sdf * 0.25, AVBD_MAX_PUSH);
        addEqV3(body.positionLin, scaleV3(sample.push, push));
      }
    }
    if (hit) {
      // Kill residual blast energy — AVBD has no continuum dissipation.
      body.velocityLin.x *= 0.72;
      body.velocityLin.y *= 0.72;
      body.velocityLin.z *= 0.72;
      const speed = Math.hypot(body.velocityLin.x, body.velocityLin.y, body.velocityLin.z);
      const maxSpeed = 2.5;
      if (speed > maxSpeed) {
        const s = maxSpeed / speed;
        body.velocityLin.x *= s;
        body.velocityLin.y *= s;
        body.velocityLin.z *= s;
      }
    }
  }
}

/**
 * Cut: destroy springs whose midpoint lies deep inside a force volume.
 * Returns number of springs severed this call.
 */
export let lastSeverDebug = { active: 0, springs: 0, hits: 0, minSdf: Infinity, cut: 0 };

export function severSpringsInForces(
  solver: Solver,
  forces: ForcePoint[],
  domain: number,
): number {
  lastSeverDebug = { active: 0, springs: 0, hits: 0, minSdf: Infinity, cut: 0 };
  if (!forces.length) return 0;
  const active = forces.filter((fp) => fp.strength !== 0 && forceNearDome(fp, domain));
  lastSeverDebug.active = active.length;
  if (!active.length) return 0;
  let cut = 0;
  let f: typeof solver.forces = solver.forces;
  while (f && cut < AVBD_MAX_CUTS_PER_FRAME) {
    const next = f.next;
    if (isSpring(f) && f.bodyA && f.bodyB) {
      lastSeverDebug.springs++;
      const pA = transform(f.bodyA.positionLin, f.bodyA.positionAng, f.rA);
      const pB = transform(f.bodyB.positionLin, f.bodyB.positionAng, f.rB);
      const mid = v3((pA.x + pB.x) * 0.5, (pA.y + pB.y) * 0.5, (pA.z + pB.z) * 0.5);
      for (const fp of active) {
        const sample = sampleForce(mid, fp, domain);
        if (!sample) continue;
        lastSeverDebug.hits++;
        if (sample.sdf < lastSeverDebug.minSdf) lastSeverDebug.minSdf = sample.sdf;
        if (sample.sdf < -AVBD_SEVER_DEPTH) {
          f.destroy();
          cut++;
          break;
        }
      }
    }
    f = next;
  }
  lastSeverDebug.cut = cut;
  return cut;
}
