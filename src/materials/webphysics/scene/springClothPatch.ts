import * as THREE from 'three';
import { MeshLambertNodeMaterial } from 'three/webgpu';
import {
  attribute,
  clamp,
  float,
  floor,
  mix,
  min,
  select,
  storage,
  transformNormalToView,
  uint,
  vec3,
  varying,
} from 'three/tsl';
import { PhysicsEngine } from '../physics/PhysicsEngine';
import { AVBD_FRICTION_STATIC } from '../physics/avbdParams';

export type AddStaticBoxWithVisual = (
  position: [number, number, number],
  halfExtents: [number, number, number],
  options?: {
    quaternion?: [number, number, number, number];
    color?: number;
    friction?: number;
    /** Paint a safety border on the top face. For decks that are walked on, not walls. */
    markings?: boolean;
  },
) => void;

export type SyncedSceneVisual = {
  syncVisuals: (engine: PhysicsEngine, renderer?: any) => void;
  dispose: () => void;
};

export type SpringClothPatchResult = {
  clothBodyIds: number[];
  clothWidth: number;
  clothDepth: number;
  clothY: number;
  syncedVisuals: SyncedSceneVisual[];
  update: (dt: number) => void;
  reset: () => void;
};

type ClothSupportMode = 'corners' | 'boundary';

type ClothDims = {
  cols: number;
  rows: number;
  nodeSpacing: number;
};

function clothIndex(ix: number, iz: number, cols: number): number {
  return iz * cols + ix;
}

function createTrackedClothSurface(args: {
  scene: THREE.Object3D;
  physics: PhysicsEngine;
  clothBodyIds: number[];
  dims: ClothDims;
  color: number;
  subdivisions: number;
}): SyncedSceneVisual {
  const { scene, physics, clothBodyIds, dims, color, subdivisions } = args;
  const { cols, rows } = dims;
  const renderCols = (cols - 1) * subdivisions + 1;
  const renderRows = (rows - 1) * subdivisions + 1;
  const renderIndex = (ix: number, iz: number): number => iz * renderCols + ix;
  const vertexCount = renderCols * renderRows;
  const positions = new Float32Array(vertexCount * 3);
  const normals = new Float32Array(vertexCount * 3);
  const uvs = new Float32Array(vertexCount * 2);
  const paramXAttr = new Float32Array(vertexCount);
  const paramZAttr = new Float32Array(vertexCount);
  const indices: number[] = [];

  for (let iz = 0; iz < renderRows; iz++) {
    for (let ix = 0; ix < renderCols; ix++) {
      const vertexIndex = renderIndex(ix, iz);
      const simX = ix / subdivisions;
      const simZ = iz / subdivisions;
      positions[vertexIndex * 3 + 0] = 0.0;
      positions[vertexIndex * 3 + 1] = 0.0;
      positions[vertexIndex * 3 + 2] = 0.0;
      normals[vertexIndex * 3 + 0] = 0.0;
      normals[vertexIndex * 3 + 1] = 1.0;
      normals[vertexIndex * 3 + 2] = 0.0;
      uvs[vertexIndex * 2 + 0] = ix / Math.max(1, renderCols - 1);
      uvs[vertexIndex * 2 + 1] = iz / Math.max(1, renderRows - 1);
      paramXAttr[vertexIndex] = simX;
      paramZAttr[vertexIndex] = simZ;
    }
  }

  for (let iz = 0; iz < renderRows - 1; iz++) {
    for (let ix = 0; ix < renderCols - 1; ix++) {
      const i00 = renderIndex(ix, iz);
      const i10 = renderIndex(ix + 1, iz);
      const i01 = renderIndex(ix, iz + 1);
      const i11 = renderIndex(ix + 1, iz + 1);
      indices.push(i00, i01, i10);
      indices.push(i10, i01, i11);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geometry.setAttribute('clothParamX', new THREE.BufferAttribute(paramXAttr, 1));
  geometry.setAttribute('clothParamZ', new THREE.BufferAttribute(paramZAttr, 1));
  geometry.setIndex(indices);

  const material = new MeshLambertNodeMaterial({
    color,
    side: THREE.DoubleSide,
  });
  material.transparent = false;
  material.opacity = 1.0;

  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  mesh.frustumCulled = false;
  scene.add(mesh);

  let gpuVisualsBound = false;

  return {
    syncVisuals(engine: PhysicsEngine): void {
      if (gpuVisualsBound) return;

      const renderBuffers = engine.getRenderBuffers();
      if (!renderBuffers) return;

      const positionsNode = storage(renderBuffers.positions, 'vec4', physics.config.maxBodies).toReadOnly();
      const clothBaseBody = float(clothBodyIds[0] ?? 0);
      const renderParamX = float(attribute('clothParamX', 'float'));
      const renderParamZ = float(attribute('clothParamZ', 'float'));
      const normalSampleStep = float(0.5);
      const maxCellX = float(cols - 1);
      const maxCellZ = float(rows - 1);
      const maxBaseX = float(cols - 2);
      const maxBaseZ = float(rows - 2);
      const rowStride = float(cols);

      const sampleClothPosition = (paramX: ReturnType<typeof float>, paramZ: ReturnType<typeof float>) => {
        const safeX = clamp(paramX, float(0.0), maxCellX);
        const safeZ = clamp(paramZ, float(0.0), maxCellZ);
        const baseX = min(floor(safeX), maxBaseX);
        const baseZ = min(floor(safeZ), maxBaseZ);
        const localU = safeX.sub(baseX);
        const localV = safeZ.sub(baseZ);
        const rowOffset = baseZ.mul(rowStride);
        const i00 = uint(clothBaseBody.add(rowOffset).add(baseX));
        const i10 = uint(clothBaseBody.add(rowOffset).add(baseX).add(float(1.0)));
        const i01 = uint(clothBaseBody.add(rowOffset).add(rowStride).add(baseX));
        const i11 = uint(clothBaseBody.add(rowOffset).add(rowStride).add(baseX).add(float(1.0)));
        const p00 = positionsNode.element(i00).xyz;
        const p10 = positionsNode.element(i10).xyz;
        const p01 = positionsNode.element(i01).xyz;
        const p11 = positionsNode.element(i11).xyz;
        const lowerPos = mix(p00, p10, localU);
        const upperPos = mix(p01, p11, localU);
        return mix(lowerPos, upperPos, localV);
      };

      const selfPos = sampleClothPosition(renderParamX, renderParamZ);
      const posLeft = sampleClothPosition(renderParamX.sub(normalSampleStep), renderParamZ);
      const posRight = sampleClothPosition(renderParamX.add(normalSampleStep), renderParamZ);
      const posDown = sampleClothPosition(renderParamX, renderParamZ.sub(normalSampleStep));
      const posUp = sampleClothPosition(renderParamX, renderParamZ.add(normalSampleStep));
      const tangentX = posRight.sub(posLeft);
      const tangentZ = posUp.sub(posDown);
      const rawNormal = tangentZ.cross(tangentX);
      const stableNormal = select(
        rawNormal.length().greaterThan(float(1e-6)),
        rawNormal.normalize(),
        vec3(0.0, 1.0, 0.0),
      );

      material.positionNode = selfPos;
      material.normalNode = varying(
        transformNormalToView(stableNormal).normalize(),
        'vSpringClothNormalView',
      );
      material.needsUpdate = true;
      gpuVisualsBound = true;
    },

    dispose(): void {
      scene.remove(mesh);
      mesh.removeFromParent();
      geometry.dispose();
      material.dispose();
    },
  };
}

export function buildSpringClothPatch(args: {
  scene: THREE.Object3D;
  physics: PhysicsEngine;
  addStaticBoxWithVisual: AddStaticBoxWithVisual;
  worldCollisionGroup: number;
  worldCollisionMask: number;
  clothCollisionGroup: number;
  clothCollisionMask: number;
  dims: ClothDims;
  clothY: number;
  nodeHalfExtents: [number, number, number];
  nodeMass: number;
  structuralStiffness: number;
  shearStiffness: number;
  bendingStiffness?: number;
  clothColor?: number;
  clothRenderSubdivisions?: number;
  drivenCorners?: boolean;
  supportMode?: ClothSupportMode;
}): SpringClothPatchResult {
  const {
    scene,
    physics,
    addStaticBoxWithVisual,
    worldCollisionGroup,
    worldCollisionMask,
    clothCollisionGroup,
    clothCollisionMask,
    dims,
    clothY,
    nodeHalfExtents,
    nodeMass,
    structuralStiffness,
    shearStiffness,
    bendingStiffness = 0.0,
    clothColor = 0x8fc2f5,
    clothRenderSubdivisions = 4,
    drivenCorners = true,
    supportMode = 'corners',
  } = args;
  const { cols, rows, nodeSpacing } = dims;

  const clothWidth = (cols - 1) * nodeSpacing;
  const clothDepth = (rows - 1) * nodeSpacing;
  const halfClothWidth = clothWidth * 0.5;
  const halfClothDepth = clothDepth * 0.5;
  const frameOffsetX = halfClothWidth + 0.55;
  const frameOffsetZ = halfClothDepth + 0.55;
  const framePostHalfExtentsXZ = 0.12;
  const frameRailThickness = 0.08;
  const frameBaseY = 0.2;
  const frameTopY = clothY + 0.08;
  const framePostHalfHeight = (frameTopY - frameBaseY) * 0.5;
  const framePostY = frameBaseY + framePostHalfHeight;
  const framePostHalfExtents: [number, number, number] = [
    framePostHalfExtentsXZ,
    framePostHalfHeight,
    framePostHalfExtentsXZ,
  ];
  const frameRailXHalfExtents: [number, number, number] = [
    frameOffsetX + framePostHalfExtentsXZ,
    frameRailThickness,
    frameRailThickness,
  ];
  const frameRailZHalfExtents: [number, number, number] = [
    frameRailThickness,
    frameRailThickness,
    frameOffsetZ + framePostHalfExtentsXZ,
  ];
  const clothBodyIds = new Array<number>(cols * rows);
  const cornerBasePositions = new Map<number, [number, number, number]>();
  const syncedVisuals: SyncedSceneVisual[] = [];
  const TWO_PI = Math.PI * 2.0;

  physics.setBodyCollisionFilter(0, worldCollisionGroup, worldCollisionMask);

  const addTrackedBox = (
    position: [number, number, number],
    halfExtents: [number, number, number],
    options: {
      mass: number;
      friction?: number;
      collisionGroup: number;
      collisionMask: number;
      linearVelocity?: [number, number, number];
      quaternion?: [number, number, number, number];
      lockRotation?: boolean;
    },
  ): number => physics.addBody({
    position,
    halfExtents,
    mass: options.mass,
    friction: options.friction ?? AVBD_FRICTION_STATIC,
    collisionGroup: options.collisionGroup,
    collisionMask: options.collisionMask,
    linearVelocity: options.linearVelocity,
    quaternion: options.quaternion,
    lockRotation: options.lockRotation,
  });

  const addFrame = (): void => {
    const postCenters: Array<[number, number, number]> = [
      [-frameOffsetX, framePostY, -frameOffsetZ],
      [frameOffsetX, framePostY, -frameOffsetZ],
      [-frameOffsetX, framePostY, frameOffsetZ],
      [frameOffsetX, framePostY, frameOffsetZ],
    ];
    for (const position of postCenters) {
      addStaticBoxWithVisual(position, framePostHalfExtents, { color: 0x485363 });
    }
    addStaticBoxWithVisual([0.0, frameTopY, -frameOffsetZ], frameRailXHalfExtents, { color: 0x60708a });
    addStaticBoxWithVisual([0.0, frameTopY, frameOffsetZ], frameRailXHalfExtents, { color: 0x60708a });
    addStaticBoxWithVisual([-frameOffsetX, frameTopY, 0.0], frameRailZHalfExtents, { color: 0x60708a });
    addStaticBoxWithVisual([frameOffsetX, frameTopY, 0.0], frameRailZHalfExtents, { color: 0x60708a });
  };

  addFrame();

  for (let iz = 0; iz < rows; iz++) {
    for (let ix = 0; ix < cols; ix++) {
      const x = (ix - (cols - 1) * 0.5) * nodeSpacing;
      const z = (iz - (rows - 1) * 0.5) * nodeSpacing;
      const isBoundary = ix === 0 || ix === cols - 1 || iz === 0 || iz === rows - 1;
      const isCorner =
        (ix === 0 || ix === cols - 1)
        && (iz === 0 || iz === rows - 1);
      const isPinned = supportMode === 'boundary' ? isBoundary : isCorner;
      const body = addTrackedBox(
        [x, clothY, z],
        nodeHalfExtents,
        {
          mass: isPinned ? 0.0 : nodeMass,
          friction: 0.96,
          collisionGroup: clothCollisionGroup,
          collisionMask: clothCollisionMask,
          lockRotation: true,
        },
      );
      clothBodyIds[clothIndex(ix, iz, cols)] = body;
      if (isCorner) {
        cornerBasePositions.set(body, [x, clothY, z]);
      }
    }
  }

  syncedVisuals.push(createTrackedClothSurface({
    scene,
    physics,
    clothBodyIds,
    dims,
    color: clothColor,
    subdivisions: clothRenderSubdivisions,
  }));

  const addSpringBetween = (
    ax: number,
    az: number,
    bx: number,
    bz: number,
    stiffness: number,
  ): void => {
    const bodyA = clothBodyIds[clothIndex(ax, az, cols)]!;
    const bodyB = clothBodyIds[clothIndex(bx, bz, cols)]!;
    const dx = bx - ax;
    const dz = bz - az;
    const restLength = Math.hypot(dx * nodeSpacing, dz * nodeSpacing);
    physics.addSpring(
      bodyA,
      bodyB,
      [0.0, 0.0, 0.0],
      [0.0, 0.0, 0.0],
      stiffness,
      restLength,
      true,
    );
  };

  for (let iz = 0; iz < rows; iz++) {
    for (let ix = 0; ix < cols; ix++) {
      if (ix + 1 < cols) addSpringBetween(ix, iz, ix + 1, iz, structuralStiffness);
      if (iz + 1 < rows) addSpringBetween(ix, iz, ix, iz + 1, structuralStiffness);
      if (ix + 1 < cols && iz + 1 < rows) {
        addSpringBetween(ix, iz, ix + 1, iz + 1, shearStiffness);
      }
      if (ix + 1 < cols && iz - 1 >= 0) {
        addSpringBetween(ix, iz, ix + 1, iz - 1, shearStiffness);
      }
      if (bendingStiffness > 0.0) {
        if (ix + 2 < cols) addSpringBetween(ix, iz, ix + 2, iz, bendingStiffness);
        if (iz + 2 < rows) addSpringBetween(ix, iz, ix, iz + 2, bendingStiffness);
      }
    }
  }

  const topLeft = clothBodyIds[clothIndex(0, 0, cols)]!;
  const topRight = clothBodyIds[clothIndex(cols - 1, 0, cols)]!;
  const bottomLeft = clothBodyIds[clothIndex(0, rows - 1, cols)]!;
  const bottomRight = clothBodyIds[clothIndex(cols - 1, rows - 1, cols)]!;
  let elapsedTime = 0.0;

  const applyDrivenCorners = (): void => {
    if (!drivenCorners) return;
    const leftBase = cornerBasePositions.get(topLeft);
    const rightBase = cornerBasePositions.get(topRight);
    const bottomLeftBase = cornerBasePositions.get(bottomLeft);
    const bottomRightBase = cornerBasePositions.get(bottomRight);
    if (leftBase) {
      physics.setBodyPose(topLeft, [
        leftBase[0],
        leftBase[1] + Math.sin((elapsedTime / 3.7) * TWO_PI) * 0.9,
        leftBase[2] + Math.sin((elapsedTime / 5.9) * TWO_PI) * 0.32,
      ]);
    }
    if (rightBase) {
      physics.setBodyPose(topRight, [
        rightBase[0],
        rightBase[1] + Math.sin((elapsedTime / 4.85) * TWO_PI + 1.1) * 0.82,
        rightBase[2] + Math.sin((elapsedTime / 7.3) * TWO_PI + 0.55) * 0.38,
      ]);
    }
    if (bottomLeftBase) {
      physics.setBodyPose(bottomLeft, [
        bottomLeftBase[0],
        bottomLeftBase[1] + Math.sin((elapsedTime / 6.2) * TWO_PI + 0.37) * 0.58,
        bottomLeftBase[2] + Math.sin((elapsedTime / 8.6) * TWO_PI + 0.91) * 0.24,
      ]);
    }
    if (bottomRightBase) {
      physics.setBodyPose(bottomRight, [
        bottomRightBase[0],
        bottomRightBase[1] + Math.sin((elapsedTime / 5.4) * TWO_PI + 1.73) * 0.68,
        bottomRightBase[2] + Math.sin((elapsedTime / 9.4) * TWO_PI + 0.22) * 0.28,
      ]);
    }
  };

  applyDrivenCorners();

  return {
    clothBodyIds,
    clothWidth,
    clothDepth,
    clothY,
    syncedVisuals,
    update(dt: number): void {
      elapsedTime += dt;
      applyDrivenCorners();
    },
    reset(): void {
      elapsedTime = 0.0;
      applyDrivenCorners();
    },
  };
}
