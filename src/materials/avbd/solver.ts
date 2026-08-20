/**
 * AVBD rigid-body solver — TypeScript port of solver.h/.cpp, rigid.cpp, force.cpp
 * from https://github.com/savant117/avbd-demo3d (MIT, Chris Giles / Utah Graphics).
 *
 * Paper: Giles, Diaz, Yuksel — Augmented Vertex Block Descent, SIGGRAPH 2025.
 * https://graphics.cs.utah.edu/research/projects/avbd/
 *
 * Coordinate note: the reference demo is Z-up. This port uses Y-up gravity so poses
 * map directly into the sandbox / three.js content frame.
 */
import {
  type Mat3, type Quat, type V3,
  addEqMat3, addEqV3, addQuatV3, addV3, clamp, clampV3, cross, diagonal,
  dot, identityMat3, lengthV2, lengthV3, mat3, mulMat3, mulMat3V3, outer,
  negV3, quat, rotate, scaleMat3, scaleV3, sign, solve, subQuat, subV3, transform,
  transpose, v2, v3, zeroMat3,
} from './maths';
import { collideObb } from './collide';

export const PENALTY_MIN = 1.0;
export const PENALTY_MAX = 1e10;
export const COLLISION_MARGIN = 0.01;
export const STICK_THRESH = 1e-5;

export abstract class Force {
  solver: Solver;
  bodyA: Rigid | null;
  bodyB: Rigid | null;
  nextA: Force | null = null;
  nextB: Force | null = null;
  next: Force | null = null;
  dead = false;

  constructor(solver: Solver, bodyA: Rigid | null, bodyB: Rigid | null) {
    this.solver = solver;
    this.bodyA = bodyA;
    this.bodyB = bodyB;
    this.next = solver.forces;
    solver.forces = this;
    if (bodyA) {
      this.nextA = bodyA.forces;
      bodyA.forces = this;
    }
    if (bodyB) {
      this.nextB = bodyB.forces;
      bodyB.forces = this;
    }
  }

  destroy(): void {
    this.dead = true;
    // unlink from solver
    let p: Force | null = this.solver.forces;
    let prev: Force | null = null;
    while (p) {
      if (p === this) {
        if (prev) prev.next = this.next;
        else this.solver.forces = this.next;
        break;
      }
      prev = p;
      p = p.next;
    }
    const unlinkBody = (body: Rigid | null, nextOnBody: Force | null) => {
      if (!body) return;
      let q: Force | null = body.forces;
      let qp: Force | null = null;
      while (q) {
        const step = q.bodyA === body ? q.nextA : q.nextB;
        if (q === this) {
          if (qp) {
            if (qp.bodyA === body) qp.nextA = nextOnBody;
            else qp.nextB = nextOnBody;
          } else body.forces = nextOnBody;
          return;
        }
        qp = q;
        q = step;
      }
    };
    unlinkBody(this.bodyA, this.nextA);
    unlinkBody(this.bodyB, this.nextB);
  }

  abstract initialize(): boolean;
  abstract updatePrimal(
    body: Rigid, alpha: number,
    lhsLin: Mat3, lhsAng: Mat3, lhsCross: Mat3,
    rhsLin: V3, rhsAng: V3,
  ): void;
  abstract updateDual(alpha: number): void;
}

export class Rigid {
  solver: Solver;
  forces: Force | null = null;
  next: Rigid | null = null;
  positionLin: V3;
  positionAng: Quat = quat();
  initialLin: V3 = v3();
  initialAng: Quat = quat();
  inertialLin: V3 = v3();
  inertialAng: Quat = quat();
  velocityLin: V3;
  velocityAng: V3 = v3();
  prevVelocityLin: V3;
  size: V3;
  mass: number;
  moment: V3;
  friction: number;
  radius: number;
  /** Kinematic hand / mouse proxies — mass 0 and pose written each frame. */
  kinematic = false;
  /** Soft-lattice node — when solver.softBodyMode, skips dynamic–dynamic contacts. */
  soft = false;
  /** Spawn pose for soft shape-matching (world). */
  restLin: V3 = v3();
  /** Optional mesh id for the exhibit layer. */
  userData: unknown = null;

  constructor(
    solver: Solver,
    size: V3,
    density: number,
    friction: number,
    position: V3,
    velocity: V3 = v3(),
  ) {
    this.solver = solver;
    this.size = size;
    this.friction = friction;
    this.positionLin = { ...position };
    this.restLin = { ...position };
    this.velocityLin = { ...velocity };
    this.prevVelocityLin = { ...velocity };
    this.mass = size.x * size.y * size.z * density;
    this.moment = v3(
      ((size.y * size.y + size.z * size.z) / 12) * this.mass,
      ((size.x * size.x + size.z * size.z) / 12) * this.mass,
      ((size.x * size.x + size.y * size.y) / 12) * this.mass,
    );
    this.radius = lengthV3(scaleV3(size, 0.5));
    this.next = solver.bodies;
    solver.bodies = this;
    solver.bodyList.push(this);
  }

  destroy(): void {
    while (this.forces) this.forces.destroy();
    let p: Rigid | null = this.solver.bodies;
    let prev: Rigid | null = null;
    while (p) {
      if (p === this) {
        if (prev) prev.next = this.next;
        else this.solver.bodies = this.next;
        break;
      }
      prev = p;
      p = p.next;
    }
    const i = this.solver.bodyList.indexOf(this);
    if (i >= 0) this.solver.bodyList.splice(i, 1);
  }

  constrainedTo(other: Rigid): boolean {
    let f: Force | null = this.forces;
    while (f) {
      if ((f.bodyA === this && f.bodyB === other) || (f.bodyA === other && f.bodyB === this)) return true;
      f = f.bodyA === this ? f.nextA : f.nextB;
    }
    return false;
  }
}

export type Contact = {
  featureKey: number;
  rA: V3;
  rB: V3;
  C0: V3;
  penalty: V3;
  lambda: V3;
  stick: boolean;
};

export class Manifold extends Force {
  contacts: Contact[] = [];
  numContacts = 0;
  basis: Mat3 = identityMat3();
  friction = 0.5;

  constructor(solver: Solver, bodyA: Rigid, bodyB: Rigid) {
    super(solver, bodyA, bodyB);
  }

  initialize(): boolean {
    const bodyA = this.bodyA!;
    const bodyB = this.bodyB!;
    this.friction = Math.sqrt(bodyA.friction * bodyB.friction);

    const newContacts: Contact[] = [];
    const basis = zeroMat3();
    const n = collideObb(bodyA, bodyB, newContacts, basis);
    if (n <= 0) return false;
    this.basis = basis;

    for (let i = 0; i < n; i++) {
      for (let j = 0; j < this.numContacts; j++) {
        if (newContacts[i].featureKey === this.contacts[j].featureKey) {
          const newRA = newContacts[i].rA;
          const newRB = newContacts[i].rB;
          newContacts[i] = { ...this.contacts[j] };
          if (!this.contacts[j].stick) {
            newContacts[i].rA = newRA;
            newContacts[i].rB = newRB;
          }
          break;
        }
      }
    }

    this.numContacts = n;
    this.contacts = newContacts;

    // Soft slime vs kinematic hand/collider: contact must outrank shape-match springs
    // (otherwise the lattice looks frozen when poked).
    const softKine =
      (bodyA.soft && bodyB.mass <= 0 && !bodyB.soft) ||
      (bodyB.soft && bodyA.mass <= 0 && !bodyA.soft);
    const minPenalty = softKine ? 400 : PENALTY_MIN;

    for (let i = 0; i < this.numContacts; i++) {
      const c = this.contacts[i];
      const xA = transform(bodyA.positionLin, bodyA.positionAng, c.rA);
      const xB = transform(bodyB.positionLin, bodyB.positionAng, c.rB);
      const d = mulMat3V3(this.basis, subV3(xA, xB));
      c.C0 = v3(d.x + COLLISION_MARGIN, d.y, d.z);
      c.lambda = scaleV3(c.lambda, this.solver.alpha * this.solver.gamma);
      c.penalty = clampV3(scaleV3(c.penalty, this.solver.gamma), minPenalty, PENALTY_MAX);
      if (softKine) {
        c.penalty.x = Math.max(c.penalty.x, minPenalty);
        c.penalty.y = Math.max(c.penalty.y, minPenalty);
        c.penalty.z = Math.max(c.penalty.z, minPenalty);
      }
    }
    return this.numContacts > 0;
  }

  updatePrimal(
    body: Rigid, alpha: number,
    lhsLin: Mat3, lhsAng: Mat3, lhsCross: Mat3,
    rhsLin: V3, rhsAng: V3,
  ): void {
    const bodyA = this.bodyA!;
    const bodyB = this.bodyB!;
    const dqALin = subV3(bodyA.positionLin, bodyA.initialLin);
    const dqAAng = subQuat(bodyA.positionAng, bodyA.initialAng);
    const dqBLin = subV3(bodyB.positionLin, bodyB.initialLin);
    const dqBAng = subQuat(bodyB.positionAng, bodyB.initialAng);

    for (let i = 0; i < this.numContacts; i++) {
      const c = this.contacts[i];
      const rAWorld = rotate(bodyA.positionAng, c.rA);
      const rBWorld = rotate(bodyB.positionAng, c.rB);
      const jALin = this.basis;
      const jBLin = mat3(negV3(this.basis.row[0]), negV3(this.basis.row[1]), negV3(this.basis.row[2]));
      const jAAng = mat3(cross(rAWorld, jALin.row[0]), cross(rAWorld, jALin.row[1]), cross(rAWorld, jALin.row[2]));
      const jBAng = mat3(cross(rBWorld, jBLin.row[0]), cross(rBWorld, jBLin.row[1]), cross(rBWorld, jBLin.row[2]));
      const K = diagonal(c.penalty.x, c.penalty.y, c.penalty.z);
      let C = scaleV3(c.C0, 1 - alpha);
      C = addV3(C, mulMat3V3(jALin, dqALin));
      C = addV3(C, mulMat3V3(jBLin, dqBLin));
      C = addV3(C, mulMat3V3(jAAng, dqAAng));
      C = addV3(C, mulMat3V3(jBAng, dqBAng));
      const F = addV3(mulMat3V3(K, C), c.lambda);
      F.x = Math.min(F.x, 0);
      const bounds = Math.abs(F.x) * this.friction;
      const frictionScale = lengthV2(v2(F.y, F.z));
      if (frictionScale > bounds && frictionScale > 0) {
        F.y *= bounds / frictionScale;
        F.z *= bounds / frictionScale;
      }
      const jLin = body === bodyA ? jALin : jBLin;
      const jAng = body === bodyA ? jAAng : jBAng;
      const jLinT = transpose(jLin);
      const jAngT = transpose(jAng);
      const jAngTk = mulMat3(jAngT, K);
      addEqMat3(lhsLin, mulMat3(mulMat3(jLinT, K), jLin));
      addEqMat3(lhsAng, mulMat3(jAngTk, jAng));
      addEqMat3(lhsCross, mulMat3(jAngTk, jLin));
      addEqV3(rhsLin, mulMat3V3(jLinT, F));
      addEqV3(rhsAng, mulMat3V3(jAngT, F));
    }
  }

  updateDual(alpha: number): void {
    const bodyA = this.bodyA!;
    const bodyB = this.bodyB!;
    const dqALin = subV3(bodyA.positionLin, bodyA.initialLin);
    const dqAAng = subQuat(bodyA.positionAng, bodyA.initialAng);
    const dqBLin = subV3(bodyB.positionLin, bodyB.initialLin);
    const dqBAng = subQuat(bodyB.positionAng, bodyB.initialAng);

    for (let i = 0; i < this.numContacts; i++) {
      const c = this.contacts[i];
      const rAWorld = rotate(bodyA.positionAng, c.rA);
      const rBWorld = rotate(bodyB.positionAng, c.rB);
      const jALin = this.basis;
      const jBLin = mat3(negV3(this.basis.row[0]), negV3(this.basis.row[1]), negV3(this.basis.row[2]));
      const jAAng = mat3(cross(rAWorld, jALin.row[0]), cross(rAWorld, jALin.row[1]), cross(rAWorld, jALin.row[2]));
      const jBAng = mat3(cross(rBWorld, jBLin.row[0]), cross(rBWorld, jBLin.row[1]), cross(rBWorld, jBLin.row[2]));
      const K = diagonal(c.penalty.x, c.penalty.y, c.penalty.z);
      let C = scaleV3(c.C0, 1 - alpha);
      C = addV3(C, mulMat3V3(jALin, dqALin));
      C = addV3(C, mulMat3V3(jBLin, dqBLin));
      C = addV3(C, mulMat3V3(jAAng, dqAAng));
      C = addV3(C, mulMat3V3(jBAng, dqBAng));
      const F = addV3(mulMat3V3(K, C), c.lambda);
      F.x = Math.min(F.x, 0);
      const bounds = Math.abs(F.x) * this.friction;
      const frictionScale = lengthV2(v2(F.y, F.z));
      if (frictionScale > bounds && frictionScale > 0) {
        F.y *= bounds / frictionScale;
        F.z *= bounds / frictionScale;
      }
      c.lambda = F;
      if (F.x < 0) c.penalty.x = Math.min(c.penalty.x + this.solver.betaLin * Math.abs(C.x), PENALTY_MAX);
      if (frictionScale <= bounds) {
        c.penalty.y = Math.min(c.penalty.y + this.solver.betaLin * Math.abs(C.y), PENALTY_MAX);
        c.penalty.z = Math.min(c.penalty.z + this.solver.betaLin * Math.abs(C.z), PENALTY_MAX);
        c.stick = lengthV2(v2(C.y, C.z)) < STICK_THRESH;
      }
    }
  }
}

export class Spring extends Force {
  /** Discriminator — prefer over `instanceof` (Vite can duplicate the class). */
  readonly kind = 'spring' as const;
  rA: V3;
  rB: V3;
  rest: number;
  stiffness: number;
  /** When > 0, spring is destroyed if length > rest × tearRatio (soft-gel cut). */
  tearRatio = 0;

  constructor(solver: Solver, bodyA: Rigid, bodyB: Rigid, rA: V3, rB: V3, stiffness: number, rest = -1) {
    super(solver, bodyA, bodyB);
    this.rA = rA;
    this.rB = rB;
    this.stiffness = stiffness;
    if (rest < 0) {
      const pA = transform(bodyA.positionLin, bodyA.positionAng, rA);
      const pB = transform(bodyB.positionLin, bodyB.positionAng, rB);
      this.rest = lengthV3(subV3(pA, pB));
    } else this.rest = rest;
  }

  initialize(): boolean {
    if (this.tearRatio <= 0) return true;
    const bodyA = this.bodyA!;
    const bodyB = this.bodyB!;
    const pA = transform(bodyA.positionLin, bodyA.positionAng, this.rA);
    const pB = transform(bodyB.positionLin, bodyB.positionAng, this.rB);
    const len = lengthV3(subV3(pA, pB));
    return len <= this.rest * this.tearRatio;
  }

  updatePrimal(
    body: Rigid, _alpha: number,
    lhsLin: Mat3, lhsAng: Mat3, lhsCross: Mat3,
    rhsLin: V3, rhsAng: V3,
  ): void {
    const bodyA = this.bodyA!;
    const bodyB = this.bodyB!;
    const pA = transform(bodyA.positionLin, bodyA.positionAng, this.rA);
    const pB = transform(bodyB.positionLin, bodyB.positionAng, this.rB);
    const d = subV3(pA, pB);
    let dLen = lengthV3(d);
    // Near-coincident nodes used to early-out and never recover (collapse death spiral).
    let n: V3;
    if (dLen <= 1e-5) {
      dLen = 1e-5;
      n = v3(1, 0, 0);
    } else {
      n = scaleV3(d, 1 / dLen);
    }
    const C = dLen - this.rest;
    const f = this.stiffness * C;
    let jLin: V3;
    let jAng: V3;
    if (body === bodyA) {
      const rWorld = rotate(bodyA.positionAng, this.rA);
      jLin = n;
      jAng = cross(rWorld, n);
    } else {
      const rWorld = rotate(bodyB.positionAng, this.rB);
      jLin = negV3(n);
      jAng = negV3(cross(rWorld, n));
    }
    const F = scaleV3(jLin, f);
    const Tau = scaleV3(jAng, f);
    addEqMat3(lhsLin, scaleMat3(outer(jLin, jLin), this.stiffness));
    addEqMat3(lhsAng, scaleMat3(outer(jAng, jAng), this.stiffness));
    addEqMat3(lhsCross, scaleMat3(outer(jAng, jLin), this.stiffness));
    addEqV3(rhsLin, F);
    addEqV3(rhsAng, Tau);
  }

  updateDual(_alpha: number): void {}
}

/**
 * Soft goal spring: pulls a body toward a world-space target (shape matching).
 * bodyB is unused (null).
 */
export class PositionGoal extends Force {
  readonly kind = 'goal' as const;
  goal: V3;
  stiffness: number;

  constructor(solver: Solver, body: Rigid, goal: V3, stiffness: number) {
    super(solver, body, null);
    this.goal = { ...goal };
    this.stiffness = stiffness;
  }

  initialize(): boolean {
    return this.bodyA !== null && this.bodyA.mass > 0;
  }

  updatePrimal(
    body: Rigid, _alpha: number,
    lhsLin: Mat3, _lhsAng: Mat3, _lhsCross: Mat3,
    rhsLin: V3, _rhsAng: V3,
  ): void {
    if (body !== this.bodyA) return;
    const d = subV3(body.positionLin, this.goal);
    const k = this.stiffness;
    addEqMat3(lhsLin, scaleMat3(identityMat3(), k));
    addEqV3(rhsLin, scaleV3(d, k));
  }

  updateDual(_alpha: number): void {}
}

export class IgnoreCollision extends Force {
  initialize(): boolean { return true; }
  updatePrimal(): void {}
  updateDual(): void {}
}

export class Solver {
  dt = 1 / 60;
  gravity = -10;
  iterations = 10;
  alpha = 0.99;
  betaLin = 10000;
  betaAng = 100;
  gamma = 0.999;
  /**
   * Soft gel lattices: only collide dynamics against kinematics (ground / hands).
   * Avoids O(n²) self-collision cost and spring–contact fighting inside the blob.
   */
  softBodyMode = false;
  bodies: Rigid | null = null;
  forces: Force | null = null;
  bodyList: Rigid[] = [];

  clear(): void {
    while (this.forces) this.forces.destroy();
    while (this.bodies) this.bodies.destroy();
    this.bodyList.length = 0;
  }

  step(): void {
    // Broadphase: create manifolds for overlapping pairs not already constrained.
    for (let i = 0; i < this.bodyList.length; i++) {
      const bodyA = this.bodyList[i];
      for (let j = i + 1; j < this.bodyList.length; j++) {
        const bodyB = this.bodyList[j];
        // Skip parked kinematics and kinematic–kinematic pairs (hands don't collide with each other).
        if (bodyA.mass <= 0 && bodyB.mass <= 0) continue;
        if (bodyA.positionLin.y < -5 || bodyB.positionLin.y < -5) continue;
        // Soft lattice: no soft–soft contacts (includes pinned floor nodes with mass 0).
        if (this.softBodyMode && bodyA.soft && bodyB.soft) continue;
        const dp = subV3(bodyA.positionLin, bodyB.positionLin);
        const r = bodyA.radius + bodyB.radius;
        if (dot(dp, dp) <= r * r && !bodyA.constrainedTo(bodyB)) {
          new Manifold(this, bodyA, bodyB);
        }
      }
    }

    // Initialize forces; drop inactive
    let force: Force | null = this.forces;
    while (force) {
      const next = force.next;
      if (!force.initialize()) force.destroy();
      force = next;
    }

    const g = v3(0, this.gravity, 0); // Y-up
    for (const body of this.bodyList) {
      body.inertialLin = addV3(body.positionLin, scaleV3(body.velocityLin, this.dt));
      if (body.mass > 0) body.inertialLin = addV3(body.inertialLin, scaleV3(g, this.dt * this.dt));
      body.inertialAng = addQuatV3(body.positionAng, scaleV3(body.velocityAng, this.dt));

      const accel = scaleV3(subV3(body.velocityLin, body.prevVelocityLin), 1 / this.dt);
      let accelWeight = clamp((accel.y * sign(this.gravity)) / Math.abs(this.gravity), 0, 1);
      if (!Number.isFinite(accelWeight)) accelWeight = 0;

      body.initialLin = { ...body.positionLin };
      body.initialAng = { ...body.positionAng };
      if (body.mass > 0) {
        body.positionLin = addV3(
          addV3(body.positionLin, scaleV3(body.velocityLin, this.dt)),
          scaleV3(g, accelWeight * this.dt * this.dt),
        );
        body.positionAng = addQuatV3(body.positionAng, scaleV3(body.velocityAng, this.dt));
      }
    }

    for (let it = 0; it < this.iterations; it++) {
      for (const body of this.bodyList) {
        if (body.mass <= 0) continue;
        const MLin = diagonal(body.mass, body.mass, body.mass);
        const MAng = diagonal(body.moment.x, body.moment.y, body.moment.z);
        const invDt2 = 1 / (this.dt * this.dt);
        const lhsLin = scaleMat3(MLin, invDt2);
        const lhsAng = scaleMat3(MAng, invDt2);
        const lhsCross = zeroMat3();
        const rhsLin = mulMat3V3(scaleMat3(MLin, invDt2), subV3(body.positionLin, body.inertialLin));
        const rhsAng = mulMat3V3(scaleMat3(MAng, invDt2), subQuat(body.positionAng, body.inertialAng));

        let f: Force | null = body.forces;
        while (f) {
          f.updatePrimal(body, this.alpha, lhsLin, lhsAng, lhsCross, rhsLin, rhsAng);
          f = f.bodyA === body ? f.nextA : f.nextB;
        }

        const dxLin = v3();
        const dxAng = v3();
        solve(lhsLin, lhsAng, lhsCross, negV3(rhsLin), negV3(rhsAng), dxLin, dxAng);
        body.positionLin = addV3(body.positionLin, dxLin);
        body.positionAng = addQuatV3(body.positionAng, dxAng);
      }

      force = this.forces;
      while (force) {
        force.updateDual(this.alpha);
        force = force.next;
      }
    }

    for (const body of this.bodyList) {
      body.prevVelocityLin = { ...body.velocityLin };
      if (body.mass > 0) {
        body.velocityLin = scaleV3(subV3(body.positionLin, body.initialLin), 1 / this.dt);
        body.velocityAng = scaleV3(subQuat(body.positionAng, body.initialAng), 1 / this.dt);
      }
    }
  }
}
