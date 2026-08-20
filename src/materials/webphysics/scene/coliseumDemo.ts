import * as THREE from 'three';
import { PhysicsEngine } from '../physics/PhysicsEngine';
import {
  createTrackedBodyVisualSet,
  type TrackedBodyVisualSet,
} from './trackedBodyVisuals';
import type { TrackedSpringVisualSet } from './trackedSpringVisuals';

export type ColiseumDemoVariant = 'coliseum-12k' | 'coliseum-50k' | 'coliseum-64k';

export function isColiseumDemoVariant(value: string): value is ColiseumDemoVariant {
  return value === 'coliseum-12k' || value === 'coliseum-50k' || value === 'coliseum-64k';
}

type ColiseumVariantConfig = {
  expectedBrickCount: number;
  bottomUnits: number;
  baseInnerRadius: number;
  tangentialPitch: number;
  capPitch: number;
};

export type ColiseumDemoResult = {
  trackedVisualSets: TrackedBodyVisualSet[];
  trackedSpringVisualSets: TrackedSpringVisualSet[];
  brickCount: number;
  shootProjectile: (config: {
    position: [number, number, number];
    direction: [number, number, number];
    averageSpeed: number;
    speedJitter?: number;
    angularJitter?: number;
  }) => boolean;
};

const BRICK_HALF_EXTENTS: [number, number, number] = [0.5, 1.0 / 12.0, 1.0 / 6.0];
const BRICK_MASS = 0.5;
const BRICK_FRICTION = 0.72;
const TIER_GAP = 0.003;
const BRICK_LENGTH = BRICK_HALF_EXTENTS[0] * 2.0;
const BRICK_WIDTH = BRICK_HALF_EXTENTS[2] * 2.0;
const COURSES_PER_LEVEL = 3;
const SUPPORT_ROW_OFFSETS = [0, 2] as const;
const WALL_UNIT_WIDTH = BRICK_LENGTH;
const OUTER_STEPBACK_PER_LEVEL = 0.35;
const INNER_STEPBACK_PER_LEVEL = WALL_UNIT_WIDTH - OUTER_STEPBACK_PER_LEVEL;
const PROJECTILE_RADIUS = 2.0;
const PROJECTILE_MASS = 240.0;
const PROJECTILE_FRICTION = 0.55;
const PROJECTILE_CAPACITY = 96;

const VARIANT_CONFIGS: Record<ColiseumDemoVariant, ColiseumVariantConfig> = {
  'coliseum-12k': {
    expectedBrickCount: 11977,
    bottomUnits: 5,
    baseInnerRadius: 13.7,
    tangentialPitch: 1.1,
    capPitch: 0.43,
  },
  'coliseum-50k': {
    expectedBrickCount: 50224,
    bottomUnits: 9,
    baseInnerRadius: 18.0,
    tangentialPitch: 1.1,
    capPitch: 0.43,
  },
  'coliseum-64k': {
    expectedBrickCount: 64312,
    bottomUnits: 11,
    baseInnerRadius: 14.0,
    tangentialPitch: 1.1,
    capPitch: 0.43,
  },
};

function levelCount(config: ColiseumVariantConfig): number {
  return config.bottomUnits;
}

function levelUnitCount(config: ColiseumVariantConfig, level: number): number {
  return config.bottomUnits - level;
}

function levelInnerRadius(config: ColiseumVariantConfig, level: number): number {
  return config.baseInnerRadius + level * INNER_STEPBACK_PER_LEVEL;
}

function tangentialBrickCount(config: ColiseumVariantConfig, radius: number): number {
  return Math.max(1, Math.floor((2.0 * Math.PI * radius) / config.tangentialPitch));
}

function radialCapBrickCount(config: ColiseumVariantConfig, radius: number): number {
  return Math.max(1, Math.floor((2.0 * Math.PI * radius) / config.capPitch));
}

function coliseumBrickCount(config: ColiseumVariantConfig): number {
  let total = 0;
  const levels = levelCount(config);
  for (let level = 0; level < levels; level++) {
    const unitCount = levelUnitCount(config, level);
    const innerRadius = levelInnerRadius(config, level);
    for (let course = 0; course < COURSES_PER_LEVEL; course++) {
      for (let unit = 0; unit < unitCount; unit++) {
        for (const rowOffset of SUPPORT_ROW_OFFSETS) {
          const radius = innerRadius + BRICK_WIDTH * 0.5 + (unit * 3 + rowOffset) * BRICK_WIDTH;
          total += tangentialBrickCount(config, radius);
        }
      }
    }
    for (let unit = 0; unit < unitCount; unit++) {
      total += radialCapBrickCount(config, innerRadius + (unit + 0.5) * WALL_UNIT_WIDTH);
    }
  }
  return total;
}

export function buildColiseumDemo(args: {
  scene: THREE.Object3D;
  physics: PhysicsEngine;
  variant: ColiseumDemoVariant;
}): ColiseumDemoResult {
  const { scene, physics, variant } = args;
  const config = VARIANT_CONFIGS[variant];
  const trackedVisualSets: TrackedBodyVisualSet[] = [];
  const trackedSpringVisualSets: TrackedSpringVisualSet[] = [];

  const brickCount = coliseumBrickCount(config);
  if (brickCount !== config.expectedBrickCount) {
    throw new Error(
      `[ColiseumDemo] ${variant} expected ${config.expectedBrickCount} bricks, got ${brickCount}.`,
    );
  }

  const brickVisuals = createTrackedBodyVisualSet(scene, physics, {
    capacity: brickCount,
    halfExtents: BRICK_HALF_EXTENTS,
    color: 0xbd7b3b,
    roughness: 0.94,
    metalness: 0.02,
    showOutline: false,
    castShadow: false,
    receiveShadow: true,
  });
  trackedVisualSets.push(brickVisuals);
  const projectileVisuals = createTrackedBodyVisualSet(scene, physics, {
    capacity: PROJECTILE_CAPACITY,
    geometry: new THREE.SphereGeometry(PROJECTILE_RADIUS, 28, 20),
    color: 0x8d97a6,
    roughness: 0.52,
    metalness: 0.14,
    showOutline: false,
    castShadow: true,
    receiveShadow: true,
  });
  trackedVisualSets.push(projectileVisuals);
  let projectileCount = 0;

  const capHeight = BRICK_HALF_EXTENTS[1] * 2.0;
  const supportHalfHeight = BRICK_HALF_EXTENTS[2];
  const supportHeight = supportHalfHeight * 2.0;
  const levelVerticalStep = COURSES_PER_LEVEL * supportHeight + capHeight + 4.0 * TIER_GAP;
  const yawQuaternion = (angle: number): THREE.Quaternion => {
    return new THREE.Quaternion().setFromAxisAngle(
      new THREE.Vector3(0.0, 1.0, 0.0),
      -(angle + Math.PI * 0.5),
    );
  };
  const supportQuaternion = (angle: number): [number, number, number, number] => {
    const upright = new THREE.Quaternion().setFromAxisAngle(
      new THREE.Vector3(1.0, 0.0, 0.0),
      Math.PI * 0.5,
    );
    const q = yawQuaternion(angle).multiply(upright);
    return [q.x, q.y, q.z, q.w];
  };
  const capQuaternion = (angle: number): [number, number, number, number] => {
    const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0.0, 1.0, 0.0), -angle);
    return [q.x, q.y, q.z, q.w];
  };
  const addRingCourse = (
    radius: number,
    y: number,
    phaseScale: number,
    uprightSupport: boolean,
  ): void => {
    const bricksInRing = uprightSupport
      ? tangentialBrickCount(config, radius)
      : radialCapBrickCount(config, radius);
    const angleStep = (2.0 * Math.PI) / bricksInRing;
    const phase = phaseScale * angleStep;
    for (let brick = 0; brick < bricksInRing; brick++) {
      const angle = brick * angleStep + phase;
      const body = physics.addBody({
        position: [Math.cos(angle) * radius, y, Math.sin(angle) * radius],
        halfExtents: BRICK_HALF_EXTENTS,
        quaternion: uprightSupport ? supportQuaternion(angle) : capQuaternion(angle),
        mass: BRICK_MASS,
        friction: BRICK_FRICTION,
      });
      brickVisuals.addBody(body);
    }
  };

  const levels = levelCount(config);
  for (let level = 0; level < levels; level++) {
    const levelBaseY = supportHalfHeight + 0.001 + level * levelVerticalStep;
    const innerRadius = levelInnerRadius(config, level);
    const unitCount = levelUnitCount(config, level);

    for (let course = 0; course < COURSES_PER_LEVEL; course++) {
      const y = levelBaseY + course * (supportHeight + TIER_GAP);
      for (let unit = 0; unit < unitCount; unit++) {
        for (let supportIndex = 0; supportIndex < SUPPORT_ROW_OFFSETS.length; supportIndex++) {
          const rowOffset = SUPPORT_ROW_OFFSETS[supportIndex];
          const radius = innerRadius + BRICK_WIDTH * 0.5 + (unit * 3 + rowOffset) * BRICK_WIDTH;
          const phaseScale = ((course + unit + supportIndex) & 1) === 0 ? 0.0 : 0.5;
          addRingCourse(radius, y, phaseScale, true);
        }
      }
    }

    const capY = levelBaseY
      + (COURSES_PER_LEVEL - 1) * (supportHeight + TIER_GAP)
      + supportHalfHeight
      + TIER_GAP
      + BRICK_HALF_EXTENTS[1];
    for (let unit = 0; unit < unitCount; unit++) {
      const radius = innerRadius + (unit + 0.5) * WALL_UNIT_WIDTH;
      const phaseScale = ((level + unit) & 1) === 0 ? 0.0 : 0.5;
      addRingCourse(radius, capY, phaseScale, false);
    }
  }

  console.log(`[ColiseumDemo] ${variant} built ${brickCount} bricks.`);

  return {
    trackedVisualSets,
    trackedSpringVisualSets,
    brickCount,
    shootProjectile: (config) => {
      if (projectileCount >= PROJECTILE_CAPACITY || physics.getBodyCount() >= physics.config.maxBodies) {
        return false;
      }
      const dir = new THREE.Vector3(config.direction[0], config.direction[1], config.direction[2]);
      if (dir.lengthSq() < 1e-8) {
        return false;
      }
      dir.normalize();
      const speedJitter = Math.max(config.speedJitter ?? 0.0, 0.0);
      const averageSpeed = Math.max(config.averageSpeed, 0.0);
      const speed = Math.max(0.0, averageSpeed + THREE.MathUtils.randFloatSpread(speedJitter * 2.0));
      const velocity = dir.multiplyScalar(speed);
      const angularJitter = Math.max(config.angularJitter ?? 0.0, 0.0) * 0.25;
      const body = physics.addBody({
        position: config.position,
        shapeType: 'sphere',
        radius: PROJECTILE_RADIUS,
        mass: PROJECTILE_MASS,
        friction: PROJECTILE_FRICTION,
        linearVelocity: [velocity.x, velocity.y, velocity.z],
        angularVelocity: [
          THREE.MathUtils.randFloatSpread(angularJitter * 2.0),
          THREE.MathUtils.randFloatSpread(angularJitter * 2.0),
          THREE.MathUtils.randFloatSpread(angularJitter * 2.0),
        ],
      });
      projectileVisuals.addBody(body);
      projectileCount++;
      return true;
    },
  };
}
