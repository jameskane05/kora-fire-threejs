export type AvbdBodySolveMode =
  | 'colored'
  | 'serial';

export type JointType =
  | 'spherical'
  | 'fixed';

export type RigidShapeType =
  | 'box'
  | 'sphere';

export interface SpringDesc {
  bodyA: number | null; // null = anchored to world-space anchorA
  bodyB: number;
  anchorA: [number, number, number];
  anchorB: [number, number, number];
  stiffness?: number;
  restLength?: number;
  disableCollision?: boolean;
}

export interface PhysicsConfig {
  maxBodies: number;
  gravity: [number, number, number];
  substeps: number;
  deltaTime: number;
  pairManifoldSlots?: number;
  solverIterations?: number;
  pairSolveColorCount?: number;
  avbdPairSweeps?: number;
  avbdDualUpdateBeta?: number;
  avbdRegularizationAlpha?: number;
  avbdPenaltyDecayGamma?: number;
  avbdBodySolveMode?: AvbdBodySolveMode;
  avbdFriction?: number;
  maxFixedStepsPerFrame?: number;
  maxPairsPerBodyBroadphase?: number;
  maxContactsPerBodySolver?: number;
  /** Soft lattices can exceed the default 12 springs/body gather budget. */
  maxSpringsPerBodySolver?: number;
  haltOnBroadphaseFallbackOverflow?: boolean;
  enableBvhBuild?: boolean;
  bvhBuildOnce?: boolean;
  bvhRebuildIntervalFrames?: number;
  bvhWaitForGpuCompletion?: boolean;
}

type CommonRigidBodyDesc = {
  position: [number, number, number];
  quaternion?: [number, number, number, number];
  linearVelocity?: [number, number, number];
  angularVelocity?: [number, number, number];
  lockRotation?: boolean;
  mass: number; // 0 = static
  friction?: number; // default 1.0; pair friction mixes as sqrt(fA * fB)
  collisionGroup?: number; // 8-bit group bitfield, default 0x01
  collisionMask?: number; // 8-bit mask bitfield, default 0xff
};

export type BoxBodyDesc = CommonRigidBodyDesc & {
  shapeType?: 'box';
  halfExtents: [number, number, number];
};

export type SphereBodyDesc = CommonRigidBodyDesc & {
  shapeType: 'sphere';
  radius: number;
};

export type RigidBodyDesc =
  | BoxBodyDesc
  | SphereBodyDesc;

export interface JointDesc {
  type: JointType;
  bodyA: number | null; // null = anchored to world-space anchorA
  bodyB: number;
  anchorA: [number, number, number];
  anchorB: [number, number, number];
  stiffness?: number;
  disableCollision?: boolean;
}

export interface PhysicsStats {
  bodyCount: number;
  frameCount: number;
  totalMs: number;
  integrationMs: number;
  broadPhaseMs: number;
  solverMs: number;
  velocityUpdateMs: number;
  broadPhaseReady: boolean;
  candidatePairsEnabled: boolean;
  pairDispatchTruncated: boolean;
}
