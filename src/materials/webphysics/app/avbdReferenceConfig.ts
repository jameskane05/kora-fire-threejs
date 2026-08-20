import type { PhysicsEngine } from '../physics/PhysicsEngine';

export const AVBD_REFERENCE_SUBSTEPS = 1;
export const AVBD_REFERENCE_SOLVER_ITERATIONS = 10;
export const AVBD_REFERENCE_DUAL_UPDATE_BETA = 10000.0;
export const AVBD_REFERENCE_REGULARIZATION_ALPHA = 0.95;
export const AVBD_REFERENCE_PENALTY_DECAY_GAMMA = 0.99;
export const AVBD_REFERENCE_PAIR_SWEEPS = 1;
export const AVBD_REFERENCE_PENALTY_FLOOR = 1.0;

export function applyReferenceAvbdConfig(physics: PhysicsEngine): void {
  physics.setSubsteps(AVBD_REFERENCE_SUBSTEPS);
  physics.setSolverIterations(AVBD_REFERENCE_SOLVER_ITERATIONS);
  physics.setAvbdDualUpdateBeta(AVBD_REFERENCE_DUAL_UPDATE_BETA);
  physics.setAvbdRegularizationAlpha(AVBD_REFERENCE_REGULARIZATION_ALPHA);
  physics.setAvbdPenaltyDecayGamma(AVBD_REFERENCE_PENALTY_DECAY_GAMMA);
  physics.setAvbdPairSweeps(AVBD_REFERENCE_PAIR_SWEEPS);
  physics.setAvbdPreventPenetratingNormalDropout(false);
  physics.setAvbdPenaltyFloor(AVBD_REFERENCE_PENALTY_FLOOR);
  physics.setAvbdBodySolveMode('colored');
}
