/**
 * Scene builders extracted from jure/webphysics main.ts (MIT).
 */
import * as THREE from 'three';
import { PhysicsEngine } from './physics/PhysicsEngine';
import { createBoxSpawner, type BoxSpawner, type EmitterRuntimeConfig } from './scene/boxSpawner';
import { createTrackedBodyVisualSet } from './scene/trackedBodyVisuals';
import { createLabSurfaceMaterial } from './scene/labSurface';
import { createTrackedSpringVisualSet } from './scene/trackedSpringVisuals';
import { buildClothBoxesDemo } from './scene/clothBoxesDemo';
import { buildBunnySoftBodyDemo } from './scene/bunnySoftBodyDemo';
import { buildCliffPlateauDemo } from './scene/cliffPlateauDemo';
import { buildColiseumDemo, isColiseumDemoVariant } from './scene/coliseumDemo';
import { buildDominoAdvancedDemo, buildDominoDemo } from './scene/dominoDemo';
import { buildJointedSandboxDemo } from './scene/jointedSandboxDemo';
import { buildNewtonsCradleDemo } from './scene/newtonsCradleDemo';
import { buildRagdollAvalancheDemo } from './scene/ragdollAvalancheDemo';
import { buildRagdollCarouselDemo } from './scene/ragdollCarouselDemo';
import { buildRagdollClothDemo } from './scene/ragdollClothDemo';
import { buildRopeDemo } from './scene/ropeDemo';
import { buildSoftBodyDemo } from './scene/softBodyDemo';
import { ContactPointOverlay } from './scene/contactPointOverlay';
import { AVBD_FRICTION_STATIC } from './physics/avbdParams';
import type { StackPreset, StackPresetConfig } from './presets';

export type SyncedSceneVisual = {
  syncVisuals: (engine: PhysicsEngine) => void;
  dispose: () => void;
};

export type ProjectileShootConfig = {
  position: [number, number, number];
  direction: [number, number, number];
  averageSpeed: number;
  speedJitter?: number;
  angularJitter?: number;
};

type MiniBridgeJointDescriptor = {
  joint: number;
  label: string;
  bodyA: number | null;
  bodyB: number;
  anchorA: [number, number, number];
  anchorB: [number, number, number];
};

type MiniBridgeDiagnosticsConfig = {
  preset: 'bridge-demo' | 'bridge-demo-empty' | 'bridge-demo-fixed';
  centerBody: number;
  joints: MiniBridgeJointDescriptor[];
};

type CarouselDiagnosticsConfig = {
  joints: MiniBridgeJointDescriptor[];
};

export type SceneRuntime = {
  sceneRoot: THREE.Group;
  spawner: BoxSpawner;
  defaultEmitter: EmitterRuntimeConfig;
  trackedVisualSets: Array<ReturnType<typeof createTrackedBodyVisualSet>>;
  trackedSpringVisualSets: Array<ReturnType<typeof createTrackedSpringVisualSet>>;
  syncedSceneVisuals: SyncedSceneVisual[];
  sceneUpdateCallbacks: Array<(dt: number) => void>;
  /** Runs before `PhysicsEngine.step`, for scenes that drive kinematic bodies themselves. */
  scenePreStepCallbacks: Array<(dt: number, renderer: any) => void>;
  /** Restores scene-owned state that a pose-only simulation reset cannot know about. */
  sceneResetCallbacks: Array<() => void>;
  /**
   * Wake a kinematic body under a ray so a grab can take hold of it. Returns the body a pick
   * should land on, or null. Kinematic bodies are invisible to `pickDynamicBody`.
   */
  pickKinematicBody: ((origin: [number, number, number], dir: [number, number, number]) => number | null) | null;
  /**
   * Tell the scene which consecutive kinematic bodies are user-driven pushers (the hand and
   * force-collider pools), for scenes whose bodies are filtered out of the solver and so have to
   * detect a shove themselves.
   */
  setKinematicImpactors: ((base: number, count: number) => void) | null;
  contactPointOverlay: ContactPointOverlay;
  /** Bodies a pointer must not pick up — dragging one cloth node hauls the whole sheet. */
  nonGrabbableBodies: Set<number>;
  bridgeMiniDiagnostics: MiniBridgeDiagnosticsConfig | null;
  carouselDiagnostics: CarouselDiagnosticsConfig | null;
  sceneStatusText: (() => string | null) | null;
  shootProjectileOverride: ((config: ProjectileShootConfig) => boolean) | null;
  dispose: () => void;
};

export type BuildPresetSceneArgs = {
  parent: THREE.Object3D;
  physics: PhysicsEngine;
  stackPreset: StackPreset;
  stackConfig: StackPresetConfig;
};

function emptyRuntime(parent: THREE.Object3D, physics: PhysicsEngine): SceneRuntime {
  const sceneRoot = new THREE.Group();
  parent.add(sceneRoot);
  const spawner = createBoxSpawner(sceneRoot, physics, {
    count: 1,
    initialCount: 0,
    halfExtents: [0.3, 0.3, 0.3],
    layout: 'grid',
    emitter: { enabled: false, rate: 1 },
    randomRotation: false,
    rotationJitter: 0,
  });
  const contactPointOverlay = new ContactPointOverlay(sceneRoot, physics.getMaxActiveContactDebugPoints());
  return {
    sceneRoot,
    spawner,
    defaultEmitter: spawner.getEmitter(),
    trackedVisualSets: [],
    trackedSpringVisualSets: [],
    syncedSceneVisuals: [],
    sceneUpdateCallbacks: [],
    scenePreStepCallbacks: [],
    sceneResetCallbacks: [],
    pickKinematicBody: null,
    setKinematicImpactors: null,
    contactPointOverlay,
    nonGrabbableBodies: new Set<number>(),
    bridgeMiniDiagnostics: null,
    carouselDiagnostics: null,
    sceneStatusText: null,
    shootProjectileOverride: null,
    dispose(): void {
      contactPointOverlay.dispose();
      spawner.dispose();
      sceneRoot.removeFromParent();
    },
  };
}

export function buildPresetScene(args: BuildPresetSceneArgs): SceneRuntime {
  const { parent, physics, stackPreset, stackConfig } = args;
  if (stackPreset === 'gel-cut') {
    return emptyRuntime(parent, physics);
  }
  const MAX_BODIES = stackConfig.maxBodies;
  const floorHalfExtents: [number, number, number] = [100.0, 0.5, 100.0];

  const sceneRoot = new THREE.Group();
  parent.add(sceneRoot);

  const staticVisuals: THREE.Mesh[] = [];
  const trackedVisualSets: Array<ReturnType<typeof createTrackedBodyVisualSet>> = [];
  const trackedSpringVisualSets: Array<ReturnType<typeof createTrackedSpringVisualSet>> = [];
  const syncedSceneVisuals: SyncedSceneVisual[] = [];
  const sceneUpdateCallbacks: Array<(dt: number) => void> = [];
  const scenePreStepCallbacks: Array<(dt: number, renderer: any) => void> = [];
  const sceneResetCallbacks: Array<() => void> = [];
  let pickKinematicBody: SceneRuntime['pickKinematicBody'] = null;
  let setKinematicImpactors: SceneRuntime['setKinematicImpactors'] = null;
  const nonGrabbableBodies = new Set<number>();
  let bridgeMiniDiagnostics: MiniBridgeDiagnosticsConfig | null = null;
  let carouselDiagnostics: CarouselDiagnosticsConfig | null = null;
  let shootProjectileOverride: ((config: ProjectileShootConfig) => boolean) | null = null;
  let sceneStatusText: (() => string | null) | null = null;

  const boxCapacity = Math.max(0, MAX_BODIES - 1);
  const spawner = createBoxSpawner(sceneRoot, physics, {
    count: boxCapacity,
    initialCount: Math.min(stackConfig.initialCount, boxCapacity),
    halfExtents: [0.3, 0.3, 0.3],
    layout: stackConfig.layout,
    ...(stackConfig.grid ? { grid: stackConfig.grid } : {}),
    ...(stackConfig.pyramidWall ? { pyramidWall: stackConfig.pyramidWall } : {}),
    emitter: {
      enabled: false,
      rate: 24.0,
    },
    randomRotation: false,
    rotationJitter: 0.04,
  });
  const defaultEmitter = spawner.getEmitter();

  /**
   * One concrete shader per distinct colour. Every NodeMaterial instance is its own shader
   * compile, and the rigs frame themselves out of dozens of identically coloured slabs — Newton's
   * cradles alone was spending a third of a second building the same shader over and over.
   */
  const labSurfaceCache = new Map<number, ReturnType<typeof createLabSurfaceMaterial>>();
  const labSurfaceMaterial = (
    halfExtents: [number, number, number],
    color: number | undefined,
    markings: boolean,
  ) => {
    const build = () => createLabSurfaceMaterial({
      halfExtents,
      ...(color !== undefined ? { color } : {}),
      ...(markings ? { markings: true } : {}),
    });
    // The painted border is the only part that reads the box dimensions, so it is also the only
    // one that cannot share.
    if (markings) return build();
    const key = color ?? -1;
    let material = labSurfaceCache.get(key);
    if (!material) {
      material = build();
      labSurfaceCache.set(key, material);
    }
    return material;
  };

  const addStaticBoxWithVisual = (
    position: [number, number, number],
    halfExtents: [number, number, number],
    options?: {
      quaternion?: [number, number, number, number];
      color?: number;
      friction?: number;
      markings?: boolean;
    },
  ): void => {
    physics.addBody({
      position,
      mass: 0.0,
      halfExtents,
      ...(options?.quaternion ? { quaternion: options.quaternion } : {}),
      ...(options?.friction !== undefined ? { friction: options.friction } : {}),
      lockRotation: true,
    });

    const visual = new THREE.Mesh(
      new THREE.BoxGeometry(halfExtents[0] * 2, halfExtents[1] * 2, halfExtents[2] * 2),
      labSurfaceMaterial(halfExtents, options?.color, options?.markings === true),
    );
    visual.position.set(position[0], position[1], position[2]);
    if (options?.quaternion) {
      visual.quaternion.set(
        options.quaternion[0],
        options.quaternion[1],
        options.quaternion[2],
        options.quaternion[3],
      );
    }
    visual.castShadow = true;
    visual.receiveShadow = true;
    sceneRoot.add(visual);
    staticVisuals.push(visual);
  };

  const addStaticCylinderWithVisual = (
    position: [number, number, number],
    radius: number,
    halfHeight: number,
    options?: {
      color?: number;
    },
  ): void => {
    physics.addBody({
      position,
      mass: 0.0,
      halfExtents: [radius, halfHeight, radius],
      lockRotation: true,
    });

    const visual = new THREE.Mesh(
      new THREE.CylinderGeometry(radius, radius, halfHeight * 2, 28),
      new THREE.MeshStandardMaterial({
        color: options?.color ?? 0x586474,
        roughness: 0.85,
        metalness: 0.05,
      }),
    );
    visual.position.set(position[0], position[1], position[2]);
    visual.castShadow = true;
    visual.receiveShadow = true;
    sceneRoot.add(visual);
    staticVisuals.push(visual);
  };

  const addDynamicBoxWithTrackedVisual = (
    position: [number, number, number],
    halfExtents: [number, number, number],
    trackedVisuals: ReturnType<typeof createTrackedBodyVisualSet>,
    options?: {
      mass?: number;
      friction?: number;
      quaternion?: [number, number, number, number];
      linearVelocity?: [number, number, number];
      collisionGroup?: number;
      collisionMask?: number;
    },
  ): number => {
    const body = physics.addBody({
      position,
      mass: options?.mass ?? 1.0,
      halfExtents,
      friction: options?.friction ?? AVBD_FRICTION_STATIC,
      quaternion: options?.quaternion,
      linearVelocity: options?.linearVelocity,
      collisionGroup: options?.collisionGroup,
      collisionMask: options?.collisionMask,
    });
    trackedVisuals.addBody(body);
    return body;
  };

  const addDynamicSphereWithTrackedVisual = (
    position: [number, number, number],
    radius: number,
    trackedVisuals: ReturnType<typeof createTrackedBodyVisualSet>,
    options?: {
      mass?: number;
      friction?: number;
      quaternion?: [number, number, number, number];
      linearVelocity?: [number, number, number];
      collisionGroup?: number;
      collisionMask?: number;
    },
  ): number => {
    const body = physics.addBody({
      position,
      shapeType: 'sphere',
      radius,
      mass: options?.mass ?? 1.0,
      friction: options?.friction ?? AVBD_FRICTION_STATIC,
      quaternion: options?.quaternion,
      linearVelocity: options?.linearVelocity,
      collisionGroup: options?.collisionGroup,
      collisionMask: options?.collisionMask,
    });
    trackedVisuals.addBody(body);
    return body;
  };

  const isBridgePreset =
    stackPreset === 'bridge-demo'
    || stackPreset === 'bridge-demo-empty'
    || stackPreset === 'bridge-demo-fixed';
  const isSpringPreset =
    stackPreset === 'spring-demo'
    || stackPreset === 'spring-ratio';
  const isSpherePreset = stackPreset === 'sphere-demo';

  if (
    stackPreset !== 'waterfall-gutter'
    && stackPreset !== 'dominoes-advanced-demo'
    && stackPreset !== 'bunny-soft-body'
    && !isBridgePreset
    && !isSpringPreset
  ) {
    addStaticBoxWithVisual(
      [0.0, -floorHalfExtents[1], 0.0],
      floorHalfExtents,
      { color: 0x495563 },
    );
  }

  if (stackPreset === 'waterfall-gutter') {
    const gutterTilt = -0.18;
    const gutterFloorHalfExtents: [number, number, number] = [11.0, 0.45, 3.2];
    const gutterWallHalfExtents: [number, number, number] = [11.0, 1.1, 0.35];
    const gutterWallZ = 3.55;
    const gutterLiftY = 1.05;

    const slopeRatio = Math.tan(Math.abs(gutterTilt));
    const up = new THREE.Vector3(0.0, 1.0, 0.0);
    const makeGutterOrientation = (horizontalFlow: THREE.Vector3): THREE.Quaternion => {
      const flow = horizontalFlow.clone().setY(0).normalize();
      const xAxis = new THREE.Vector3(flow.x, -slopeRatio, flow.z).normalize();
      const zAxis = new THREE.Vector3().crossVectors(up, xAxis).normalize();
      const yAxis = new THREE.Vector3().crossVectors(zAxis, xAxis).normalize();
      const basis = new THREE.Matrix4().makeBasis(xAxis, yAxis, zAxis);
      return new THREE.Quaternion().setFromRotationMatrix(basis);
    };

    const gutterOrientations = [
      makeGutterOrientation(new THREE.Vector3(1.0, 0.0, 0.0)),
      makeGutterOrientation(new THREE.Vector3(0.0, 0.0, 1.0)),
      makeGutterOrientation(new THREE.Vector3(-1.0, 0.0, 0.0)),
      makeGutterOrientation(new THREE.Vector3(0.0, 0.0, -1.0)),
      makeGutterOrientation(new THREE.Vector3(1.0, 0.0, 0.0)),
    ];

    const segmentCenters: THREE.Vector3[] = [new THREE.Vector3(0.0, 22.0, 0.0)];
    const segmentHalfLength = gutterFloorHalfExtents[0];
    const dropPerJoin = 5.8;
    const joinLocalOffsets: Array<[number, number, number]> = [
      [5.0, dropPerJoin, 3.0],
      [5.0, dropPerJoin, 3.0],
      [5.0, dropPerJoin, 3.0],
      [5.0, dropPerJoin, 3.0],
    ];
    for (let i = 1; i < gutterOrientations.length; i++) {
      const prevCenter = segmentCenters[i - 1];
      const prevOrientation = gutterOrientations[i - 1];
      const prevDir = new THREE.Vector3(1.0, 0.0, 0.0).applyQuaternion(gutterOrientations[i - 1]).normalize();
      const nextDir = new THREE.Vector3(1.0, 0.0, 0.0).applyQuaternion(gutterOrientations[i]).normalize();
      const prevLowEnd = prevCenter.clone().addScaledVector(prevDir, segmentHalfLength);
      const localOffset = joinLocalOffsets[i - 1] ?? [0.0, -dropPerJoin, 0.0];
      const offsetWorld = new THREE.Vector3(localOffset[0], localOffset[1], localOffset[2])
        .applyQuaternion(prevOrientation);
      const nextHighEnd = prevLowEnd.clone().add(offsetWorld);
      segmentCenters.push(nextHighEnd.addScaledVector(nextDir, segmentHalfLength));
    }

    const addGutterSegment = (center: THREE.Vector3, orientation: THREE.Quaternion): void => {
      const q: [number, number, number, number] = [orientation.x, orientation.y, orientation.z, orientation.w];
      addStaticBoxWithVisual([center.x, center.y, center.z], gutterFloorHalfExtents, {
        quaternion: q,
        color: 0x4a5563,
      });

      const wallSide = new THREE.Vector3(0.0, 0.0, 1.0).applyQuaternion(orientation).normalize();
      const wallLift = new THREE.Vector3(0.0, gutterLiftY, 0.0);
      const wallA = center.clone().add(wallLift).addScaledVector(wallSide, gutterWallZ);
      const wallB = center.clone().add(wallLift).addScaledVector(wallSide, -gutterWallZ);
      addStaticBoxWithVisual([wallA.x, wallA.y, wallA.z], gutterWallHalfExtents, {
        quaternion: q,
        color: 0x6a7689,
      });
      addStaticBoxWithVisual([wallB.x, wallB.y, wallB.z], gutterWallHalfExtents, {
        quaternion: q,
        color: 0x6a7689,
      });
    };

    for (let i = 0; i < segmentCenters.length; i++) {
      addGutterSegment(segmentCenters[i], gutterOrientations[i]);
    }

    const firstCenter = segmentCenters[0];
    const firstDir = new THREE.Vector3(1.0, 0.0, 0.0).applyQuaternion(gutterOrientations[0]).normalize();
    const firstHighEnd = firstCenter.clone().addScaledVector(firstDir, -segmentHalfLength);
    const capCenter = firstHighEnd.clone().addScaledVector(firstDir, -0.7);
    const firstQ = gutterOrientations[0];
    addStaticBoxWithVisual([capCenter.x, capCenter.y, capCenter.z], [0.55, 2.6, 3.2], {
      quaternion: [firstQ.x, firstQ.y, firstQ.z, firstQ.w],
      color: 0x73839a,
    });
  }

  if (isBridgePreset) {
    const COLLISION_GROUP_WORLD = 0x01;
    const COLLISION_GROUP_PLANK = 0x02;
    const COLLISION_GROUP_LOAD = 0x04;
    const rigidJointStiffness = Number.POSITIVE_INFINITY;
    const useFixedBridgeJoints = stackPreset === 'bridge-demo-fixed';
    const spawnBridgeLoads = stackPreset === 'bridge-demo';
    const plankCount = 40;
    const plankHalfExtents: [number, number, number] = [0.5, 0.25, 2.0];
    const plankHalfLength = plankHalfExtents[0];
    const plankHalfWidth = plankHalfExtents[2];
    const bridgeY = 10.0;
    const plankDensity = 1.0;
    const loadHalfExtents: [number, number, number] = [0.5, 0.5, 0.5];
    const boxMassFromDensity = (halfExtents: [number, number, number], density: number): number => {
      const volume = halfExtents[0] * 2.0 * halfExtents[1] * 2.0 * halfExtents[2] * 2.0;
      return volume * density;
    };
    const plankMass = boxMassFromDensity(plankHalfExtents, plankDensity);
    const loadMass = boxMassFromDensity(loadHalfExtents, 1.0);
    const worldFilter: CollisionFilterOptions = {
      collisionGroup: COLLISION_GROUP_WORLD,
      collisionMask: COLLISION_GROUP_PLANK | COLLISION_GROUP_LOAD,
    };
    const plankFilter: CollisionFilterOptions = {
      collisionGroup: COLLISION_GROUP_PLANK,
      collisionMask: COLLISION_GROUP_WORLD | COLLISION_GROUP_PLANK | COLLISION_GROUP_LOAD,
    };
    const loadFilter: CollisionFilterOptions = {
      collisionGroup: COLLISION_GROUP_LOAD,
      collisionMask: COLLISION_GROUP_WORLD | COLLISION_GROUP_PLANK | COLLISION_GROUP_LOAD,
    };

    addStaticBoxWithVisual(
      [0.0, -floorHalfExtents[1], 0.0],
      floorHalfExtents,
      { color: 0x495563 },
    );
    physics.setBodyCollisionFilter(0, worldFilter.collisionGroup ?? 0x01, worldFilter.collisionMask ?? 0xff);

    const loadCols = Math.max(1, Math.floor(plankCount / 4));
    const loadRows = Math.max(1, Math.floor(plankCount / 8));
    const plankVisuals = createTrackedBodyVisualSet(sceneRoot, physics, {
      capacity: plankCount,
      halfExtents: plankHalfExtents,
      color: 0x8f6737,
      roughness: 0.82,
      metalness: 0.04,
    });
    trackedVisualSets.push(plankVisuals);
    const loadVisuals = spawnBridgeLoads ? createTrackedBodyVisualSet(sceneRoot, physics, {
      capacity: loadCols * loadRows,
      halfExtents: loadHalfExtents,
      color: 0xb24c3f,
      roughness: 0.7,
      metalness: 0.08,
    }) : null;
    if (loadVisuals) {
      trackedVisualSets.push(loadVisuals);
    }

    const plankIds: number[] = [];
    for (let i = 0; i < plankCount; i++) {
      const mass = (i === 0 || i === plankCount - 1) ? 0.0 : plankMass;
      plankIds.push(addDynamicBoxWithTrackedVisual(
        [i - plankCount * 0.5, bridgeY, 0.0],
        plankHalfExtents,
        plankVisuals,
        {
          mass,
          friction: 0.5,
          collisionGroup: plankFilter.collisionGroup,
          collisionMask: plankFilter.collisionMask,
        },
      ));
    }
    for (let i = 1; i < plankCount; i++) {
      physics.setBodyPairCollisionIgnored(plankIds[i - 1]!, plankIds[i]!, true);
      if (useFixedBridgeJoints) {
        const joint = physics.addFixedJoint(
          plankIds[i - 1]!,
          plankIds[i]!,
          [plankHalfLength, 0.0, 0.0],
          [-plankHalfLength, 0.0, 0.0],
          rigidJointStiffness,
          true,
        );
      } else {
        physics.addSphericalJoint(
          plankIds[i - 1]!,
          plankIds[i]!,
          [plankHalfLength, 0.0, plankHalfWidth],
          [-plankHalfLength, 0.0, plankHalfWidth],
          rigidJointStiffness,
          true,
        );
        physics.addSphericalJoint(
          plankIds[i - 1]!,
          plankIds[i]!,
          [plankHalfLength, 0.0, -plankHalfWidth],
          [-plankHalfLength, 0.0, -plankHalfWidth],
          rigidJointStiffness,
          true,
        );
      }
    }
    if (loadVisuals) {
      for (let x = 0; x < loadCols; x++) {
        for (let y = 0; y < loadRows; y++) {
          addDynamicBoxWithTrackedVisual(
            [x - plankCount / 8.0, y + 12.0, 0.0],
            loadHalfExtents,
            loadVisuals,
            {
              mass: loadMass,
              friction: 0.5,
              collisionGroup: loadFilter.collisionGroup,
              collisionMask: loadFilter.collisionMask,
            },
          );
        }
      }
    }
  }

  if (isSpringPreset) {
    const springSceneHeightOffset = 9.5;
    const springGroundHalfExtents: [number, number, number] = [100.0, 0.5, 100.0];
    addStaticBoxWithVisual(
      [0.0, -springGroundHalfExtents[1], 0.0],
      springGroundHalfExtents,
      { color: 0x495563 },
    );

    if (stackPreset === 'spring-demo') {
      const springGridCols = 10;
      const springGridRows = 10;
      const springCellSpacingX = 5.0;
      const springCellSpacingZ = 5.0;
      const springAnchorY = 14.0 + springSceneHeightOffset;
      const springBlockY = 8.0 + springSceneHeightOffset;
      const springCount = springGridCols * springGridRows;
      const springSeed01 = (index: number, salt: number): number => {
        const value = Math.sin(index * 12.9898 + salt * 78.233) * 43758.5453123;
        return value - Math.floor(value);
      };
      const springLines = createTrackedSpringVisualSet(sceneRoot, {
        capacity: springCount,
        color: 0x9fd0ff,
      });
      trackedSpringVisualSets.push(springLines);
      const anchorVisuals = createTrackedBodyVisualSet(sceneRoot, physics, {
        capacity: springCount,
        halfExtents: [0.5, 0.5, 0.5],
        color: 0x7f5d36,
        roughness: 0.82,
        metalness: 0.04,
        showOutline: false,
      });
      const blockVisuals = createTrackedBodyVisualSet(sceneRoot, physics, {
        capacity: springCount,
        halfExtents: [1.0, 1.0, 1.0],
        color: 0x7f5d36,
        roughness: 0.82,
        metalness: 0.04,
        showOutline: false,
      });
      trackedVisualSets.push(anchorVisuals, blockVisuals);

      for (let row = 0; row < springGridRows; row++) {
        for (let col = 0; col < springGridCols; col++) {
          const springIndex = row * springGridCols + col;
          const baseX = (col - (springGridCols - 1) * 0.5) * springCellSpacingX;
          const baseZ = (row - (springGridRows - 1) * 0.5) * springCellSpacingZ;
          const blockMass = THREE.MathUtils.lerp(0.6, 2.4, springSeed01(springIndex, 0.19));
          const springStiffness = THREE.MathUtils.lerp(55.0, 220.0, springSeed01(springIndex, 0.47));
          const lateralOffset = THREE.MathUtils.lerp(-1.1, 1.1, springSeed01(springIndex, 0.83));

          const anchor = addDynamicBoxWithTrackedVisual(
            [baseX, springAnchorY, baseZ],
            [0.5, 0.5, 0.5],
            anchorVisuals,
            { mass: 0.0, friction: 0.5 },
          );
          const block = addDynamicBoxWithTrackedVisual(
            [baseX + lateralOffset, springBlockY, baseZ],
            [1.0, 1.0, 1.0],
            blockVisuals,
            { mass: blockMass, friction: 0.5 },
          );
          const spring = physics.addSpring(
            anchor,
            block,
            [0.0, 0.0, 0.0],
            [0.0, 0.0, 0.0],
            springStiffness,
            4.0,
          );
          springLines.addSpring(spring);
        }
      }
    } else {
      const springLines = createTrackedSpringVisualSet(sceneRoot, {
        capacity: 7,
        color: 0x9fd0ff,
      });
      trackedSpringVisualSets.push(springLines);
      const springVisuals = createTrackedBodyVisualSet(sceneRoot, physics, {
        capacity: 8,
        halfExtents: [0.5, 0.375, 0.375],
        color: 0x7f5d36,
        roughness: 0.82,
        metalness: 0.04,
      });
      trackedVisualSets.push(springVisuals);

      const bodies: number[] = [];
      const springCount = 8;
      for (let i = 0; i < springCount; i++) {
        const x = (i - (springCount - 1) * 0.5) * 3.0;
        bodies.push(addDynamicBoxWithTrackedVisual(
          [x, 12.0 + springSceneHeightOffset, 0.0],
          [0.5, 0.375, 0.375],
          springVisuals,
          { mass: (i === 0 || i === springCount - 1) ? 0.0 : 1.0, friction: 0.5 },
        ));
        if (i > 0) {
          const spring = physics.addSpring(
            bodies[i - 1]!,
            bodies[i]!,
            [0.5, 0.0, 0.0],
            [-0.5, 0.0, 0.0],
            i % 2 === 0 ? 10.0 : 10000.0,
            3.0,
          );
          springLines.addSpring(spring);
        }
      }
    }
  }

  if (isSpherePreset) {
    const largeSphereVisuals = createTrackedBodyVisualSet(sceneRoot, physics, {
      capacity: 1,
      geometry: new THREE.SphereGeometry(1.0, 28, 20),
      color: 0x9fd0ff,
      roughness: 0.58,
      metalness: 0.08,
    });
    const smallSphereVisuals = createTrackedBodyVisualSet(sceneRoot, physics, {
      capacity: 2,
      geometry: new THREE.SphereGeometry(0.75, 24, 18),
      color: 0x9fd0ff,
      roughness: 0.58,
      metalness: 0.08,
    });
    trackedVisualSets.push(largeSphereVisuals, smallSphereVisuals);

    addStaticBoxWithVisual(
      [-4.0, 1.0, 0.0],
      [2.0, 1.0, 2.0],
      { color: 0x586474 },
    );

    addDynamicSphereWithTrackedVisual(
      [-4.0, 4.6, 0.0],
      1.0,
      largeSphereVisuals,
      { mass: 2.5, friction: 0.6 },
    );
    addDynamicSphereWithTrackedVisual(
      [2.5, 1.35, 0.0],
      0.75,
      smallSphereVisuals,
      { mass: 1.5, friction: 0.6 },
    );
    addDynamicSphereWithTrackedVisual(
      [2.5, 4.6, 0.0],
      0.75,
      smallSphereVisuals,
      { mass: 1.5, friction: 0.6 },
    );
  }

  if (stackPreset === 'ragdoll-cloth-demo') {
    const ragdollClothScene = buildRagdollClothDemo({
      scene: sceneRoot,
      physics,
      addStaticBoxWithVisual,
    });
    trackedVisualSets.push(...ragdollClothScene.trackedVisualSets);
    trackedSpringVisualSets.push(...ragdollClothScene.trackedSpringVisualSets);
    syncedSceneVisuals.push(...ragdollClothScene.syncedVisuals);
    sceneUpdateCallbacks.push(ragdollClothScene.update);
  }

  if (stackPreset === 'ragdoll-carousel-demo') {
    const ragdollCarouselScene = buildRagdollCarouselDemo({
      scene: sceneRoot,
      physics,
      addStaticBoxWithVisual,
      addStaticCylinderWithVisual,
    });
    trackedVisualSets.push(...ragdollCarouselScene.trackedVisualSets);
    trackedSpringVisualSets.push(...ragdollCarouselScene.trackedSpringVisualSets);
    sceneStatusText = ragdollCarouselScene.getStatusText;
    if (ragdollCarouselScene.diagnostics.joints.length > 0) {
      carouselDiagnostics = {
        joints: ragdollCarouselScene.diagnostics.joints,
      };
    }
    sceneUpdateCallbacks.push(ragdollCarouselScene.update);
  }

  if (stackPreset === 'jointed-sandbox-demo') {
    const jointedSandboxScene = buildJointedSandboxDemo({
      scene: sceneRoot,
      physics,
      addStaticBoxWithVisual,
    });
    trackedVisualSets.push(...jointedSandboxScene.trackedVisualSets);
    trackedSpringVisualSets.push(...jointedSandboxScene.trackedSpringVisualSets);
  }

  if (stackPreset === 'soft-body') {
    const softBodyScene = buildSoftBodyDemo({
      scene: sceneRoot,
      physics,
    });
    trackedVisualSets.push(...softBodyScene.trackedVisualSets);
    trackedSpringVisualSets.push(...softBodyScene.trackedSpringVisualSets);
  }

  if (stackPreset === 'bunny-soft-body') {
    const bunnySoftBodyScene = buildBunnySoftBodyDemo({
      scene: sceneRoot,
      physics,
      addStaticBoxWithVisual,
    });
    trackedVisualSets.push(...bunnySoftBodyScene.trackedVisualSets);
    trackedSpringVisualSets.push(...bunnySoftBodyScene.trackedSpringVisualSets);
  }

  if (stackPreset === 'cloth-boxes-demo') {
    const clothBoxesScene = buildClothBoxesDemo({
      scene: sceneRoot,
      physics,
      addStaticBoxWithVisual,
    });
    trackedVisualSets.push(...clothBoxesScene.trackedVisualSets);
    trackedSpringVisualSets.push(...clothBoxesScene.trackedSpringVisualSets);
    syncedSceneVisuals.push(...clothBoxesScene.syncedVisuals);
    sceneUpdateCallbacks.push(clothBoxesScene.update);
    for (const body of clothBoxesScene.clothBodyIds) nonGrabbableBodies.add(body);
  }

  if (stackPreset === 'rope-demo' || stackPreset === 'heavy-rope-demo') {
    const ropeScene = buildRopeDemo({
      scene: sceneRoot,
      physics,
      variant: stackPreset,
    });
    trackedVisualSets.push(...ropeScene.trackedVisualSets);
    trackedSpringVisualSets.push(...ropeScene.trackedSpringVisualSets);
    syncedSceneVisuals.push(...ropeScene.syncedVisuals);
  }

  if (isColiseumDemoVariant(stackPreset)) {
    const coliseumScene = buildColiseumDemo({
      scene: sceneRoot,
      physics,
      variant: stackPreset,
    });
    trackedVisualSets.push(...coliseumScene.trackedVisualSets);
    trackedSpringVisualSets.push(...coliseumScene.trackedSpringVisualSets);
    shootProjectileOverride = coliseumScene.shootProjectile;
  }

  if (stackPreset === 'dominoes-demo') {
    const dominoScene = buildDominoDemo({
      scene: sceneRoot,
      physics,
    });
    trackedVisualSets.push(...dominoScene.trackedVisualSets);
    trackedSpringVisualSets.push(...dominoScene.trackedSpringVisualSets);
  }

  if (stackPreset === 'dominoes-advanced-demo') {
    const dominoScene = buildDominoAdvancedDemo({
      scene: sceneRoot,
      physics,
    });
    trackedVisualSets.push(...dominoScene.trackedVisualSets);
    trackedSpringVisualSets.push(...dominoScene.trackedSpringVisualSets);
  }

  if (stackPreset === 'newtons-cradles-demo') {
    const newtonsCradleScene = buildNewtonsCradleDemo({
      scene: sceneRoot,
      physics,
      addStaticBoxWithVisual,
    });
    trackedVisualSets.push(...newtonsCradleScene.trackedVisualSets);
    trackedSpringVisualSets.push(...newtonsCradleScene.trackedSpringVisualSets);
  }

  if (stackPreset === 'ragdoll-avalanche-demo') {
    const avalancheScene = buildRagdollAvalancheDemo({
      scene: sceneRoot,
      physics,
      addStaticBoxWithVisual,
    });
    trackedVisualSets.push(...avalancheScene.trackedVisualSets);
    trackedSpringVisualSets.push(...avalancheScene.trackedSpringVisualSets);
  }

  if (stackPreset === 'cliff-plateau-demo') {
    const cliffScene = buildCliffPlateauDemo({
      scene: sceneRoot,
      physics,
      addStaticBoxWithVisual,
    });
    trackedVisualSets.push(...cliffScene.trackedVisualSets);
    trackedSpringVisualSets.push(...cliffScene.trackedSpringVisualSets);
    scenePreStepCallbacks.push(cliffScene.updateBeforeStep);
    sceneResetCallbacks.push(cliffScene.reset);
    pickKinematicBody = cliffScene.activateWalkerByRay;
    setKinematicImpactors = cliffScene.setImpactorRange;
    sceneStatusText = cliffScene.statusText;
  }


  const contactPointOverlay = new ContactPointOverlay(sceneRoot, physics.getMaxActiveContactDebugPoints());

  return {
    sceneRoot,
    spawner,
    defaultEmitter,
    trackedVisualSets,
    trackedSpringVisualSets,
    syncedSceneVisuals,
    sceneUpdateCallbacks,
    scenePreStepCallbacks,
    sceneResetCallbacks,
    pickKinematicBody,
    setKinematicImpactors,
    contactPointOverlay,
    nonGrabbableBodies,
    bridgeMiniDiagnostics,
    carouselDiagnostics,
    sceneStatusText,
    shootProjectileOverride,
    dispose(): void {
      contactPointOverlay.dispose();
      for (const syncedVisuals of syncedSceneVisuals) syncedVisuals.dispose();
      for (const trackedSpringVisuals of trackedSpringVisualSets) trackedSpringVisuals.dispose();
      for (const trackedVisuals of trackedVisualSets) trackedVisuals.dispose();
      spawner.dispose();
      // Concrete materials are shared between slabs, so collect before disposing.
      const staticMaterials = new Set<THREE.Material>();
      for (const visual of staticVisuals) {
        visual.removeFromParent();
        if (visual.geometry) visual.geometry.dispose();
        const material = visual.material;
        if (Array.isArray(material)) for (const entry of material) staticMaterials.add(entry);
        else staticMaterials.add(material);
      }
      for (const material of staticMaterials) material.dispose();
      sceneRoot.removeFromParent();
    },
  };
}
