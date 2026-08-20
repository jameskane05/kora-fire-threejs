/**
 * Vendored webphysics stack presets (from jure/webphysics main.ts).
 * Plus kora gel-cut scene.
 */
import type { StackPreset as WebphysicsStackPreset } from './scene/emitterPanel';

export type StackPresetConfig = {
  maxBodies: number;
  initialCount: number;
  cameraPosition: [number, number, number];
  cameraLookAt: [number, number, number];
  physics: {
    maxPairsPerBodyBroadphase: number;
    maxContactsPerBodySolver?: number;
    maxPairSolveColorCount?: number;
    activePairSolveColorCount?: number;
  };
  layout: 'grid' | 'pyramid-wall';
  grid?: {
    x: number;
    z: number;
    startY: number;
    sizeX: number;
    sizeY: number;
    sizeZ: number;
    spacing: number;
    stacksX?: number;
    stacksZ?: number;
    stackSpacingX?: number;
    stackSpacingZ?: number;
  };
  pyramidWall?: {
    x: number;
    z: number;
    startY: number;
    layers: number;
    stepX?: number;
    stepY?: number;
  };
  label?: string;
  group?: PhysicsSceneGroup;
};

export type PhysicsSceneGroup =
  | 'Soft'
  | 'Rigid stacks'
  | 'Cloth / rope'
  | 'Ragdoll'
  | 'Domino'
  | 'Stress'
  | 'Other';

export type StackPreset = WebphysicsStackPreset | 'gel-cut';

const WEBP_STACK_PRESET_CONFIGS: Record<WebphysicsStackPreset, StackPresetConfig> = {
  'single-5': {
    maxBodies: 2048,
    initialCount: 5 * 5 * 5,
    cameraPosition: [0, 3.2, 10],
    cameraLookAt: [0, 1.5, 0],
    physics: {
      maxPairsPerBodyBroadphase: 48,
      maxContactsPerBodySolver: 128,
      maxPairSolveColorCount: 16,
    },
    layout: 'grid',
    grid: {
      x: 0,
      z: 0,
      startY: 0.3,
      sizeX: 5,
      sizeY: 5,
      sizeZ: 5,
      spacing: 0.01,
      stacksX: 1,
      stacksZ: 1,
      stackSpacingX: 0.0,
      stackSpacingZ: 0.0,
    },
  },
  'single-10': {
    maxBodies: 2048,
    initialCount: 10 * 10 * 10,
    cameraPosition: [0, 5.0, 16],
    cameraLookAt: [0, 3.0, 0],
    physics: {
      maxPairsPerBodyBroadphase: 32,
      maxContactsPerBodySolver: 128,
      maxPairSolveColorCount: 16,
    },
    layout: 'grid',
    grid: {
      x: 0,
      z: 0,
      startY: 0.3,
      sizeX: 10,
      sizeY: 10,
      sizeZ: 10,
      spacing: 0.01,
      stacksX: 1,
      stacksZ: 1,
      stackSpacingX: 0.0,
      stackSpacingZ: 0.0,
    },
  },
  'wall-10x10x1': {
    maxBodies: 1024,
    initialCount: 10 * 10 * 1,
    cameraPosition: [0, 4.0, 14.0],
    cameraLookAt: [0, 2.0, 0],
    physics: {
      maxPairsPerBodyBroadphase: 48,
      maxContactsPerBodySolver: 128,
      maxPairSolveColorCount: 16,
    },
    layout: 'grid',
    grid: {
      x: 0,
      z: 0,
      startY: 0.3,
      sizeX: 10,
      sizeY: 10,
      sizeZ: 1,
      spacing: 0.01,
      stacksX: 1,
      stacksZ: 1,
      stackSpacingX: 0.0,
      stackSpacingZ: 0.0,
    },
  },
  'line-2x1x1': {
    maxBodies: 256,
    initialCount: 2,
    cameraPosition: [0, 1.8, 5.0],
    cameraLookAt: [0, 0.9, 0],
    physics: {
      maxPairsPerBodyBroadphase: 16,
      maxContactsPerBodySolver: 64,
      maxPairSolveColorCount: 8,
    },
    layout: 'grid',
    grid: {
      x: 0,
      z: 0,
      startY: 0.3,
      sizeX: 1,
      sizeY: 2,
      sizeZ: 1,
      spacing: 0.01,
      stacksX: 1,
      stacksZ: 1,
      stackSpacingX: 0.0,
      stackSpacingZ: 0.0,
    },
  },
  'line-1x1x1': {
    maxBodies: 256,
    initialCount: 1,
    cameraPosition: [0, 1.4, 4.2],
    cameraLookAt: [0, 0.55, 0],
    physics: {
      maxPairsPerBodyBroadphase: 16,
      maxContactsPerBodySolver: 64,
      maxPairSolveColorCount: 8,
    },
    layout: 'grid',
    grid: {
      x: 0,
      z: 0,
      startY: 0.3,
      sizeX: 1,
      sizeY: 1,
      sizeZ: 1,
      spacing: 0.01,
      stacksX: 1,
      stacksZ: 1,
      stackSpacingX: 0.0,
      stackSpacingZ: 0.0,
    },
  },
  'line-3x1x1': {
    maxBodies: 256,
    initialCount: 3,
    cameraPosition: [0, 2.2, 5.5],
    cameraLookAt: [0, 1.2, 0],
    physics: {
      maxPairsPerBodyBroadphase: 16,
      maxContactsPerBodySolver: 64,
      maxPairSolveColorCount: 8,
    },
    layout: 'grid',
    grid: {
      x: 0,
      z: 0,
      startY: 0.3,
      sizeX: 1,
      sizeY: 3,
      sizeZ: 1,
      spacing: 0.01,
      stacksX: 1,
      stacksZ: 1,
      stackSpacingX: 0.0,
      stackSpacingZ: 0.0,
    },
  },
  'line-10x1x1': {
    maxBodies: 1024,
    initialCount: 10 * 1 * 1,
    cameraPosition: [0, 4.6, 9.0],
    cameraLookAt: [0, 2.7, 0],
    physics: {
      maxPairsPerBodyBroadphase: 32,
      maxContactsPerBodySolver: 128,
      maxPairSolveColorCount: 16,
    },
    layout: 'grid',
    grid: {
      x: 0,
      z: 0,
      startY: 0.3,
      sizeX: 1,
      sizeY: 10,
      sizeZ: 1,
      spacing: 0.01,
      stacksX: 1,
      stacksZ: 1,
      stackSpacingX: 0.0,
      stackSpacingZ: 0.0,
    },
  },
  'bridge-demo': {
    maxBodies: 1024,
    initialCount: 0,
    cameraPosition: [0, 16.0, 34.0],
    cameraLookAt: [0, 8.0, 0],
    physics: {
      maxPairsPerBodyBroadphase: 64,
      maxContactsPerBodySolver: 128,
      maxPairSolveColorCount: 16,
    },
    layout: 'grid',
    grid: {
      x: 0,
      z: 0,
      startY: 0.3,
      sizeX: 1,
      sizeY: 1,
      sizeZ: 1,
      spacing: 0.01,
      stacksX: 1,
      stacksZ: 1,
      stackSpacingX: 0.0,
      stackSpacingZ: 0.0,
    },
  },
  'bridge-demo-empty': {
    maxBodies: 1024,
    initialCount: 0,
    cameraPosition: [0, 16.0, 34.0],
    cameraLookAt: [0, 8.0, 0],
    physics: {
      maxPairsPerBodyBroadphase: 32,
      maxContactsPerBodySolver: 128,
      maxPairSolveColorCount: 16,
    },
    layout: 'grid',
    grid: {
      x: 0,
      z: 0,
      startY: 0.3,
      sizeX: 1,
      sizeY: 1,
      sizeZ: 1,
      spacing: 0.01,
      stacksX: 1,
      stacksZ: 1,
      stackSpacingX: 0.0,
      stackSpacingZ: 0.0,
    },
  },
  'bridge-demo-fixed': {
    maxBodies: 1024,
    initialCount: 0,
    cameraPosition: [0, 16.0, 34.0],
    cameraLookAt: [0, 8.0, 0],
    physics: {
      maxPairsPerBodyBroadphase: 64,
      maxContactsPerBodySolver: 128,
      maxPairSolveColorCount: 16,
    },
    layout: 'grid',
    grid: {
      x: 0,
      z: 0,
      startY: 0.3,
      sizeX: 1,
      sizeY: 1,
      sizeZ: 1,
      spacing: 0.01,
      stacksX: 1,
      stacksZ: 1,
      stackSpacingX: 0.0,
      stackSpacingZ: 0.0,
    },
  },
  'soft-body': {
    maxBodies: 1024,
    initialCount: 0,
    cameraPosition: [14.0, 18.0, 28.0],
    cameraLookAt: [0.0, 13.0, 0.0],
    physics: {
      maxPairsPerBodyBroadphase: 48,
      maxContactsPerBodySolver: 128,
      maxPairSolveColorCount: 16,
    },
    layout: 'grid',
    grid: {
      x: 0,
      z: 0,
      startY: 0.3,
      sizeX: 1,
      sizeY: 1,
      sizeZ: 1,
      spacing: 0.01,
      stacksX: 1,
      stacksZ: 1,
      stackSpacingX: 0.0,
      stackSpacingZ: 0.0,
    },
  },
  'bunny-soft-body': {
    maxBodies: 12288,
    initialCount: 0,
    cameraPosition: [14.0, 12.0, 22.0],
    cameraLookAt: [0.0, 7.0, 0.0],
    physics: {
      maxPairsPerBodyBroadphase: 96,
      maxContactsPerBodySolver: 192,
      maxPairSolveColorCount: 16,
    },
    layout: 'grid',
    grid: {
      x: 0,
      z: 0,
      startY: 0.3,
      sizeX: 1,
      sizeY: 1,
      sizeZ: 1,
      spacing: 0.01,
      stacksX: 1,
      stacksZ: 1,
      stackSpacingX: 0.0,
      stackSpacingZ: 0.0,
    },
  },
  'spring-demo': {
    maxBodies: 320,
    initialCount: 0,
    cameraPosition: [0, 28.0, 58.0],
    cameraLookAt: [0, 18.0, 0],
    physics: {
      maxPairsPerBodyBroadphase: 24,
      maxContactsPerBodySolver: 64,
      maxPairSolveColorCount: 8,
    },
    layout: 'grid',
    grid: {
      x: 0,
      z: 0,
      startY: 0.3,
      sizeX: 1,
      sizeY: 1,
      sizeZ: 1,
      spacing: 0.01,
      stacksX: 1,
      stacksZ: 1,
      stackSpacingX: 0.0,
      stackSpacingZ: 0.0,
    },
  },
  'spring-ratio': {
    maxBodies: 256,
    initialCount: 0,
    cameraPosition: [0, 17.5, 22.0],
    cameraLookAt: [0, 17.5, 0],
    physics: {
      maxPairsPerBodyBroadphase: 16,
      maxContactsPerBodySolver: 64,
      maxPairSolveColorCount: 8,
    },
    layout: 'grid',
    grid: {
      x: 0,
      z: 0,
      startY: 0.3,
      sizeX: 1,
      sizeY: 1,
      sizeZ: 1,
      spacing: 0.01,
      stacksX: 1,
      stacksZ: 1,
      stackSpacingX: 0.0,
      stackSpacingZ: 0.0,
    },
  },
  'rope-demo': {
    maxBodies: 256,
    initialCount: 0,
    cameraPosition: [0, 16.0, 28.0],
    cameraLookAt: [0, 12.0, 0],
    physics: {
      maxPairsPerBodyBroadphase: 24,
      maxContactsPerBodySolver: 96,
      maxPairSolveColorCount: 8,
    },
    layout: 'grid',
    grid: {
      x: 0,
      z: 0,
      startY: 0.3,
      sizeX: 1,
      sizeY: 1,
      sizeZ: 1,
      spacing: 0.01,
      stacksX: 1,
      stacksZ: 1,
      stackSpacingX: 0.0,
      stackSpacingZ: 0.0,
    },
  },
  'heavy-rope-demo': {
    maxBodies: 256,
    initialCount: 0,
    cameraPosition: [0, 19.0, 32.0],
    cameraLookAt: [0, 15.0, 0],
    physics: {
      maxPairsPerBodyBroadphase: 24,
      maxContactsPerBodySolver: 96,
      maxPairSolveColorCount: 8,
    },
    layout: 'grid',
    grid: {
      x: 0,
      z: 0,
      startY: 0.3,
      sizeX: 1,
      sizeY: 1,
      sizeZ: 1,
      spacing: 0.01,
      stacksX: 1,
      stacksZ: 1,
      stackSpacingX: 0.0,
      stackSpacingZ: 0.0,
    },
  },
  'sphere-demo': {
    maxBodies: 256,
    initialCount: 0,
    cameraPosition: [0, 7.0, 18.0],
    cameraLookAt: [0, 3.0, 0],
    physics: {
      maxPairsPerBodyBroadphase: 16,
      maxContactsPerBodySolver: 64,
      maxPairSolveColorCount: 8,
    },
    layout: 'grid',
    grid: {
      x: 0,
      z: 0,
      startY: 0.3,
      sizeX: 1,
      sizeY: 1,
      sizeZ: 1,
      spacing: 0.01,
      stacksX: 1,
      stacksZ: 1,
      stackSpacingX: 0.0,
      stackSpacingZ: 0.0,
    },
  },
  'ragdoll-cloth-demo': {
    maxBodies: 4096,
    initialCount: 0,
    cameraPosition: [0, 24.0, 46.0],
    cameraLookAt: [0, 12.0, 0],
    physics: {
      maxPairsPerBodyBroadphase: 48,
      maxContactsPerBodySolver: 128,
      maxPairSolveColorCount: 16,
    },
    layout: 'grid',
    grid: {
      x: 0,
      z: 0,
      startY: 0.3,
      sizeX: 1,
      sizeY: 1,
      sizeZ: 1,
      spacing: 0.01,
      stacksX: 1,
      stacksZ: 1,
      stackSpacingX: 0.0,
      stackSpacingZ: 0.0,
    },
  },
  'ragdoll-carousel-demo': {
    maxBodies: 4096,
    initialCount: 0,
    cameraPosition: [0, 22.0, 42.0],
    cameraLookAt: [0, 15.0, 0],
    physics: {
      maxPairsPerBodyBroadphase: 48,
      maxContactsPerBodySolver: 128,
      maxPairSolveColorCount: 16,
    },
    layout: 'grid',
    grid: {
      x: 0,
      z: 0,
      startY: 0.3,
      sizeX: 1,
      sizeY: 1,
      sizeZ: 1,
      spacing: 0.01,
      stacksX: 1,
      stacksZ: 1,
      stackSpacingX: 0.0,
      stackSpacingZ: 0.0,
    },
  },
  'jointed-sandbox-demo': {
    maxBodies: 1024,
    initialCount: 0,
    cameraPosition: [0, 12.0, 56.0],
    cameraLookAt: [0, 6.5, 0.0],
    physics: {
      maxPairsPerBodyBroadphase: 48,
      maxContactsPerBodySolver: 128,
      maxPairSolveColorCount: 16,
    },
    layout: 'grid',
    grid: {
      x: 0,
      z: 0,
      startY: 0.3,
      sizeX: 1,
      sizeY: 1,
      sizeZ: 1,
      spacing: 0.01,
      stacksX: 1,
      stacksZ: 1,
      stackSpacingX: 0.0,
      stackSpacingZ: 0.0,
    },
  },
  'cloth-boxes-demo': {
    maxBodies: 1024,
    initialCount: 0,
    cameraPosition: [0, 11.0, 18.0],
    cameraLookAt: [0, 7.0, 0],
    physics: {
      maxPairsPerBodyBroadphase: 32,
      maxContactsPerBodySolver: 128,
      maxPairSolveColorCount: 12,
    },
    layout: 'grid',
    grid: {
      x: 0,
      z: 0,
      startY: 0.3,
      sizeX: 1,
      sizeY: 1,
      sizeZ: 1,
      spacing: 0.01,
      stacksX: 1,
      stacksZ: 1,
      stackSpacingX: 0.0,
      stackSpacingZ: 0.0,
    },
  },
  'coliseum-12k': {
    maxBodies: 12288,
    initialCount: 0,
    cameraPosition: [34.0, 9.0, 34.0],
    cameraLookAt: [0.0, 3.5, 0.0],
    physics: {
      maxPairsPerBodyBroadphase: 12,
      maxContactsPerBodySolver: 64,
      maxPairSolveColorCount: 8,
    },
    layout: 'grid',
    grid: {
      x: 0.0,
      z: 0.0,
      startY: 0.3,
      sizeX: 1,
      sizeY: 1,
      sizeZ: 1,
      spacing: 0.01,
      stacksX: 1,
      stacksZ: 1,
      stackSpacingX: 0.0,
      stackSpacingZ: 0.0,
    },
  },
  'coliseum-50k': {
    maxBodies: 50688,
    initialCount: 0,
    cameraPosition: [48.0, 12.0, 48.0],
    cameraLookAt: [0.0, 5.0, 0.0],
    physics: {
      maxPairsPerBodyBroadphase: 12,
      maxContactsPerBodySolver: 64,
      maxPairSolveColorCount: 8,
    },
    layout: 'grid',
    grid: {
      x: 0.0,
      z: 0.0,
      startY: 0.3,
      sizeX: 1,
      sizeY: 1,
      sizeZ: 1,
      spacing: 0.01,
      stacksX: 1,
      stacksZ: 1,
      stackSpacingX: 0.0,
      stackSpacingZ: 0.0,
    },
  },
  'coliseum-64k': {
    maxBodies: 64512,
    initialCount: 0,
    cameraPosition: [52.0, 13.0, 52.0],
    cameraLookAt: [0.0, 5.5, 0.0],
    physics: {
      maxPairsPerBodyBroadphase: 12,
      maxContactsPerBodySolver: 64,
      maxPairSolveColorCount: 8,
    },
    layout: 'grid',
    grid: {
      x: 0.0,
      z: 0.0,
      startY: 0.3,
      sizeX: 1,
      sizeY: 1,
      sizeZ: 1,
      spacing: 0.01,
      stacksX: 1,
      stacksZ: 1,
      stackSpacingX: 0.0,
      stackSpacingZ: 0.0,
    },
  },
  'pyramid-8': {
    maxBodies: 2048,
    initialCount: (8 * 9) / 2,
    cameraPosition: [0, 3.8, 11.0],
    cameraLookAt: [0, 1.5, 0],
    physics: {
      maxPairsPerBodyBroadphase: 48,
      maxContactsPerBodySolver: 128,
      maxPairSolveColorCount: 16,
    },
    layout: 'pyramid-wall',
    pyramidWall: {
      x: 0,
      z: 0,
      startY: 0.3,
      layers: 8,
      stepX: 0.63,
      stepY: 0.51,
    },
  },
  'waterfall-gutter': {
    maxBodies: 8192,
    initialCount: 11 * 28 * 5,
    cameraPosition: [10.0, 30.0, 72.0],
    cameraLookAt: [8.0, 16.0, -8.0],
    physics: {
      maxPairsPerBodyBroadphase: 48,
      maxContactsPerBodySolver: 128,
      maxPairSolveColorCount: 16,
    },
    layout: 'grid',
    grid: {
      x: -7.0,
      z: 0.0,
      startY: 32.0,
      sizeX: 11,
      sizeY: 28,
      sizeZ: 5,
      spacing: 0.06,
      stacksX: 1,
      stacksZ: 1,
      stackSpacingX: 0.0,
      stackSpacingZ: 0.0,
    },
  },
  'grid-1000x10': {
    maxBodies: 12288,
    initialCount: 1000 * 10,
    cameraPosition: [0, 26.0, 70.0],
    cameraLookAt: [0, 8.0, 0],
    physics: {
      maxPairsPerBodyBroadphase: 12,
      maxContactsPerBodySolver: 64,
      maxPairSolveColorCount: 8,
    },
    layout: 'grid',
    grid: {
      x: 0,
      z: 0,
      startY: 0.3,
      sizeX: 1,
      sizeY: 10,
      sizeZ: 1,
      spacing: 0.01,
      stacksX: 25,
      stacksZ: 40,
      stackSpacingX: 0.5,
      stackSpacingZ: 0.5,
    },
  },
  'grid-64x10': {
    // 64000 bodies, and the engine's packed pair encoding caps total bodies (preset + the
    // kinematic hand/collider pools) at 65536.
    maxBodies: 64512,
    initialCount: 64 * 10 * 10 * 10,
    cameraPosition: [0, 12.0, 36.0],
    cameraLookAt: [0, 6.0, 0],
    physics: {
      maxPairsPerBodyBroadphase: 12,
      maxContactsPerBodySolver: 64,
      maxPairSolveColorCount: 8,
    },
    layout: 'grid',
    grid: {
      x: 0,
      z: 0,
      startY: 0.3,
      sizeX: 10,
      sizeY: 10,
      sizeZ: 10,
      spacing: 0.01,
      stacksX: 8,
      stacksZ: 8,
      stackSpacingX: 0.5,
      stackSpacingZ: 0.5,
    },
  },
  'dominoes-demo': {
    maxBodies: 4096,
    initialCount: 0,
    cameraPosition: [0.0, 19.0, 78.0],
    cameraLookAt: [0.0, 5.5, 4.0],
    physics: {
      maxPairsPerBodyBroadphase: 16,
      maxContactsPerBodySolver: 64,
      maxPairSolveColorCount: 8,
    },
    layout: 'grid',
    grid: {
      x: 0.0,
      z: 0.0,
      startY: 0.3,
      sizeX: 1,
      sizeY: 1,
      sizeZ: 1,
      spacing: 0.01,
      stacksX: 1,
      stacksZ: 1,
      stackSpacingX: 0.0,
      stackSpacingZ: 0.0,
    },
  },
  'dominoes-advanced-demo': {
    maxBodies: 2048,
    initialCount: 0,
    cameraPosition: [0.0, 18.0, 58.0],
    cameraLookAt: [0.0, 8.0, 5.0],
    physics: {
      maxPairsPerBodyBroadphase: 16,
      maxContactsPerBodySolver: 64,
      maxPairSolveColorCount: 8,
    },
    layout: 'grid',
    grid: {
      x: 0.0,
      z: 0.0,
      startY: 0.3,
      sizeX: 1,
      sizeY: 1,
      sizeZ: 1,
      spacing: 0.01,
      stacksX: 1,
      stacksZ: 1,
      stackSpacingX: 0.0,
      stackSpacingZ: 0.0,
    },
  },
  'newtons-cradles-demo': {
    maxBodies: 2048,
    initialCount: 0,
    cameraPosition: [0.0, 15.0, 68.0],
    cameraLookAt: [0.0, 7.5, -6.0],
    physics: {
      maxPairsPerBodyBroadphase: 24,
      maxContactsPerBodySolver: 48,
      maxPairSolveColorCount: 10,
    },
    layout: 'grid',
    grid: {
      x: 0.0,
      z: 0.0,
      startY: 0.3,
      sizeX: 1,
      sizeY: 1,
      sizeZ: 1,
      spacing: 0.01,
      stacksX: 1,
      stacksZ: 1,
      stackSpacingX: 0.0,
      stackSpacingZ: 0.0,
    },
  },
  'cliff-plateau-demo': {
    maxBodies: 2048,
    initialCount: 0,
    cameraPosition: [44.0, 30.0, 44.0],
    cameraLookAt: [0.0, 15.0, 0.0],
    physics: {
      maxPairsPerBodyBroadphase: 48,
      maxContactsPerBodySolver: 64,
      maxPairSolveColorCount: 16,
    },
    layout: 'grid',
    grid: {
      x: 0.0,
      z: 0.0,
      startY: 0.3,
      sizeX: 1,
      sizeY: 1,
      sizeZ: 1,
      spacing: 0.01,
      stacksX: 1,
      stacksZ: 1,
      stackSpacingX: 0.0,
      stackSpacingZ: 0.0,
    },
  },
  'ragdoll-avalanche-demo': {
    maxBodies: 2048,
    initialCount: 0,
    cameraPosition: [78.0, 48.0, 0.0],
    cameraLookAt: [6.0, 34.0, 0.0],
    physics: {
      maxPairsPerBodyBroadphase: 24,
      maxContactsPerBodySolver: 40,
    },
    layout: 'grid',
    grid: {
      x: 0.0,
      z: 0.0,
      startY: 0.3,
      sizeX: 1,
      sizeY: 1,
      sizeZ: 1,
      spacing: 0.01,
      stacksX: 1,
      stacksZ: 1,
      stackSpacingX: 0.0,
      stackSpacingZ: 0.0,
    },
  },
};


export const GEL_CUT_PRESET: StackPresetConfig = {
  maxBodies: 2048,
  initialCount: 0,
  cameraPosition: [0.9, 0.55, 1.35],
  cameraLookAt: [0, 0.12, 0],
  physics: {
    maxPairsPerBodyBroadphase: 32,
    maxContactsPerBodySolver: 32,
    maxPairSolveColorCount: 16,
  },
  layout: 'grid',
  grid: {
    x: 0, z: 0, startY: 0.3,
    sizeX: 1, sizeY: 1, sizeZ: 1, spacing: 0.01,
  },
  label: 'Gel cut (Kora)',
  group: 'Soft',
};

export const STACK_PRESET_CONFIGS: Record<StackPreset, StackPresetConfig> = {
  ...WEBP_STACK_PRESET_CONFIGS,
  'gel-cut': GEL_CUT_PRESET,
};

function isWebphysicsStackPreset(value: string | null): value is WebphysicsStackPreset {
  return value === 'single-5'
    || value === 'single-10'
    || value === 'wall-10x10x1'
    || value === 'line-1x1x1'
    || value === 'line-2x1x1'
    || value === 'line-3x1x1'
    || value === 'line-10x1x1'
    || value === 'bridge-demo'
    || value === 'bridge-demo-empty'
    || value === 'bridge-demo-fixed'
    || value === 'soft-body'
    || value === 'bunny-soft-body'
    || value === 'spring-demo'
    || value === 'spring-ratio'
    || value === 'rope-demo'
    || value === 'heavy-rope-demo'
    || value === 'sphere-demo'
    || value === 'ragdoll-cloth-demo'
    || value === 'ragdoll-carousel-demo'
    || value === 'jointed-sandbox-demo'
    || value === 'cloth-boxes-demo'
    || value === 'coliseum-12k'
    || value === 'coliseum-50k'
    || value === 'coliseum-64k'
    || value === 'pyramid-8'
    || value === 'waterfall-gutter'
    || value === 'grid-1000x10'
    || value === 'grid-64x10'
    || value === 'dominoes-demo'
    || value === 'dominoes-advanced-demo'
    || value === 'newtons-cradles-demo'
    || value === 'ragdoll-avalanche-demo'
    || value === 'cliff-plateau-demo';
}


export function isStackPreset(value: string | null): value is StackPreset {
  return value === 'gel-cut' || isWebphysicsStackPreset(value);
}

export const DEFAULT_STACK_PRESET: StackPreset = 'gel-cut';

const GROUP_ORDER: PhysicsSceneGroup[] = [
  'Soft', 'Rigid stacks', 'Cloth / rope', 'Ragdoll', 'Domino', 'Stress', 'Other',
];

/**
 * `desktopOnly` presets allocate 1.7–2.2 GB for their body budget, which a headset does not have
 * to spare — picking one loses the WebGPU device and with it the session. They stay in the
 * desktop picker, where the memory is affordable.
 */
const PRESET_META: Partial<
  Record<StackPreset, { label: string; group: PhysicsSceneGroup; desktopOnly?: boolean }>
> = {
  'gel-cut': { label: 'Gel cut (Kora)', group: 'Soft' },
  'soft-body': { label: 'Soft body cubes', group: 'Soft' },
  'bunny-soft-body': { label: 'Bunny soft body', group: 'Soft', desktopOnly: true },
  'cloth-boxes-demo': { label: 'Cloth + boxes', group: 'Cloth / rope' },
  'rope-demo': { label: 'Rope', group: 'Cloth / rope' },
  'heavy-rope-demo': { label: 'Heavy rope', group: 'Cloth / rope' },
  'spring-demo': { label: 'Springs', group: 'Cloth / rope' },
  'spring-ratio': { label: 'Spring ratio', group: 'Cloth / rope' },
  'ragdoll-cloth-demo': { label: 'Ragdoll cloth', group: 'Ragdoll' },
  'ragdoll-carousel-demo': { label: 'Ragdoll carousel', group: 'Ragdoll' },
  'ragdoll-avalanche-demo': { label: 'Ragdoll avalanche', group: 'Ragdoll' },
  'cliff-plateau-demo': { label: 'Cliff plateau crowd', group: 'Ragdoll' },
  'dominoes-demo': { label: 'Dominoes', group: 'Domino' },
  'dominoes-advanced-demo': { label: 'Dominoes advanced', group: 'Domino' },
  'single-5': { label: 'Stack 5', group: 'Rigid stacks' },
  'single-10': { label: 'Stack 10', group: 'Rigid stacks' },
  'wall-10x10x1': { label: 'Wall 10×10', group: 'Rigid stacks' },
  'pyramid-8': { label: 'Pyramid 8', group: 'Rigid stacks' },
  'bridge-demo': { label: 'Bridge', group: 'Rigid stacks' },
  'bridge-demo-empty': { label: 'Bridge empty', group: 'Rigid stacks' },
  'bridge-demo-fixed': { label: 'Bridge fixed', group: 'Rigid stacks' },
  'sphere-demo': { label: 'Spheres', group: 'Rigid stacks' },
  'jointed-sandbox-demo': { label: 'Jointed sandbox', group: 'Other' },
  'newtons-cradles-demo': { label: "Newton's cradles", group: 'Other' },
  'waterfall-gutter': { label: 'Waterfall gutter', group: 'Other' },
  'coliseum-12k': { label: 'Coliseum 12k', group: 'Stress' },
  'coliseum-50k': { label: 'Coliseum 50k', group: 'Stress', desktopOnly: true },
  'coliseum-64k': { label: 'Coliseum 64k', group: 'Stress', desktopOnly: true },
  'grid-1000x10': { label: 'Grid 1000×10', group: 'Stress' },
  'grid-64x10': { label: 'Grid 64×10', group: 'Stress', desktopOnly: true },
  'line-1x1x1': { label: 'Line 1', group: 'Rigid stacks' },
  'line-2x1x1': { label: 'Line 2', group: 'Rigid stacks' },
  'line-3x1x1': { label: 'Line 3', group: 'Rigid stacks' },
  'line-10x1x1': { label: 'Line 10', group: 'Rigid stacks' },
};

export function presetLabel(id: StackPreset): string {
  return PRESET_META[id]?.label ?? id;
}

export function presetGroup(id: StackPreset): PhysicsSceneGroup {
  return PRESET_META[id]?.group ?? 'Other';
}

export function presetIsDesktopOnly(id: StackPreset): boolean {
  return PRESET_META[id]?.desktopOnly === true;
}

export function presetsByGroup(
  options?: { skipDesktopOnly?: boolean },
): { group: PhysicsSceneGroup; ids: StackPreset[] }[] {
  const map = new Map<PhysicsSceneGroup, StackPreset[]>();
  for (const g of GROUP_ORDER) map.set(g, []);
  for (const id of Object.keys(STACK_PRESET_CONFIGS) as StackPreset[]) {
    if (options?.skipDesktopOnly && presetIsDesktopOnly(id)) continue;
    const g = presetGroup(id);
    map.get(g)!.push(id);
  }
  return GROUP_ORDER.map((group) => ({ group, ids: map.get(group)! })).filter((e) => e.ids.length);
}
