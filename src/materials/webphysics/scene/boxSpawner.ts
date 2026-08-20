import * as THREE from 'three';
import {
  MeshBasicNodeMaterial,
  MeshStandardNodeMaterial,
  StorageBufferAttribute,
  StorageInstancedBufferAttribute,
} from 'three/webgpu';
import { storage as computeStorage, uniform, wgslFn, workgroupId, localId } from '../physics/gpu/tslCompat';
import {
  normalLocal,
  positionLocal,
  transformNormalToView,
  varying,
} from 'three/tsl';
import { PhysicsEngine } from '../physics/PhysicsEngine';

const GATHER_WORKGROUP_SIZE = 64;

export interface EmitterRuntimeConfig {
  enabled: boolean;
  rate: number; // bodies per second
  x: number;
  y: number;
  z: number;
  randomRotation: boolean;
  rotationJitter: number;
}

export interface SpawnConfig {
  count: number; // capacity
  initialCount?: number;
  halfExtents: [number, number, number];
  layout?: 'random' | 'column' | 'pyramid' | 'pyramid-wall' | 'grid';
  spawnArea?: {
    x: [number, number];
    y: [number, number];
    z: [number, number];
  };
  column?: {
    x: number;
    z: number;
    startY: number;
    spacing: number;
    offsetXPerLevel?: number;
    offsetZPerLevel?: number;
  };
  pyramid?: {
    x: number;
    z: number;
    startY: number;
    layers: number;
    spacing: number;
  };
  pyramidWall?: {
    x: number;
    z: number;
    startY: number;
    layers: number;
    stepX?: number;
    stepY?: number;
  };
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
  randomRotation?: boolean;
  rotationJitter?: number;
  emitter?: {
    enabled?: boolean;
    rate?: number;
  };
}

export interface BoxSpawner {
  instancedMesh: THREE.InstancedMesh;
  syncVisuals(engine: PhysicsEngine, renderer?: any): void;
  update(dt: number): void;
  emit(requestedCount?: number): number;
  shoot(config: {
    position: [number, number, number];
    direction: [number, number, number];
    averageSpeed: number;
    speedJitter?: number;
    angularJitter?: number;
  }): boolean;
  getSpawnedCount(): number;
  getCapacity(): number;
  getEmitter(): EmitterRuntimeConfig;
  setEmitter(patch: Partial<EmitterRuntimeConfig>): void;
  dispose(): void;
}

export function createBoxSpawner(
  scene: THREE.Object3D,
  physics: PhysicsEngine,
  config: SpawnConfig,
): BoxSpawner {
  const { count, halfExtents } = config;
  const layout = config.layout ?? 'random';
  const spawnArea = config.spawnArea ?? {
    x: [-5, 5] as [number, number],
    y: [2, 20] as [number, number],
    z: [-5, 5] as [number, number],
  };
  const column = config.column ?? {
    x: 0,
    z: 0,
    startY: 2,
    spacing: halfExtents[1] * 2 + 0.05,
    offsetXPerLevel: 0,
    offsetZPerLevel: 0,
  };
  const pyramid = config.pyramid ?? {
    x: 0,
    z: 0,
    startY: halfExtents[1],
    layers: 6,
    spacing: 0.02,
  };
  const pyramidWall = config.pyramidWall ?? {
    x: 0,
    z: 0,
    startY: halfExtents[1],
    layers: 8,
    stepX: halfExtents[0] * 2 + 0.03,
    stepY: halfExtents[1] * 2 * 0.85,
  };
  const grid = config.grid ?? {
    x: 0,
    z: 0,
    startY: halfExtents[1],
    sizeX: 10,
    sizeY: 10,
    sizeZ: 10,
    spacing: 0.02,
    stacksX: 1,
    stacksZ: 1,
    stackSpacingX: 0.0,
    stackSpacingZ: 0.0,
  };
  const [hx, hy, hz] = halfExtents;
  const pyramidLayers = Math.max(1, Math.floor(pyramid.layers));
  const pyramidStepX = hx * 2 + pyramid.spacing;
  const pyramidStepZ = hz * 2 + pyramid.spacing;
  const pyramidLayerHeight = hy * 2 + pyramid.spacing;
  const pyramidWallLayers = Math.max(1, Math.floor(pyramidWall.layers));
  const pyramidWallStepX = pyramidWall.stepX ?? (hx * 2 + 0.03);
  const pyramidWallStepY = pyramidWall.stepY ?? (hy * 2 * 0.85);
  const gridSizeX = Math.max(1, Math.floor(grid.sizeX));
  const gridSizeY = Math.max(1, Math.floor(grid.sizeY));
  const gridSizeZ = Math.max(1, Math.floor(grid.sizeZ));
  const gridStepX = hx * 2 + grid.spacing;
  const gridStepY = hy * 2 + grid.spacing;
  const gridStepZ = hz * 2 + grid.spacing;
  const gridStacksX = Math.max(1, Math.floor(grid.stacksX ?? 1));
  const gridStacksZ = Math.max(1, Math.floor(grid.stacksZ ?? 1));
  const gridStackStepX = gridSizeX * gridStepX + (grid.stackSpacingX ?? 0.0);
  const gridStackStepZ = gridSizeZ * gridStepZ + (grid.stackSpacingZ ?? 0.0);
  const pyramidBaseCells = Math.floor(
    (pyramidLayers * (pyramidLayers + 1) * (2 * pyramidLayers + 1)) / 6,
  );
  const pyramidWallBaseCells = Math.floor((pyramidWallLayers * (pyramidWallLayers + 1)) / 2);
  const defaultRandomRotation = config.randomRotation ?? (layout === 'random');
  const defaultRotationJitter = Math.max(config.rotationJitter ?? 0.08, 0.0);
  const initialCount = Math.min(Math.max(config.initialCount ?? count, 0), count);

  const emitter: EmitterRuntimeConfig = {
    enabled: config.emitter?.enabled ?? false,
    rate: Math.max(config.emitter?.rate ?? 24.0, 0.0),
    x: column.x,
    y: column.startY,
    z: column.z,
    randomRotation: defaultRandomRotation,
    rotationJitter: defaultRotationJitter,
  };

  const geometry = new THREE.BoxGeometry(hx * 2, hy * 2, hz * 2);
  const material = new MeshStandardNodeMaterial();
  material.color.setHex(0xe07020);
  material.roughness = 0.6;
  material.metalness = 0.1;
  const instancedMesh = new THREE.InstancedMesh(geometry, material, count);
  instancedMesh.castShadow = true;
  instancedMesh.receiveShadow = true;
  // Physics bodies can move outside the original center bounds quickly.
  instancedMesh.frustumCulled = false;
  instancedMesh.count = 0;
  scene.add(instancedMesh);

  const outlineMaterial = new MeshBasicNodeMaterial();
  outlineMaterial.color.setHex(0x111111);
  outlineMaterial.wireframe = true;
  outlineMaterial.transparent = true;
  outlineMaterial.opacity = 0.55;
  outlineMaterial.depthWrite = false;
  const outlineMesh = new THREE.InstancedMesh(geometry, outlineMaterial, count);
  outlineMesh.frustumCulled = false;
  outlineMesh.count = 0;
  outlineMesh.renderOrder = 1;
  scene.add(outlineMesh);

  const bodyIndexData = new Float32Array(count * 4);
  const bodyIndexAttr = new StorageBufferAttribute(bodyIndexData, 4);
  const instancePosAttr = new StorageInstancedBufferAttribute(count, 4);
  const instanceQuatAttr = new StorageInstancedBufferAttribute(count, 4);
  let gatherKernel: any = null;
  const tmpQuat = new THREE.Quaternion();
  const euler = new THREE.Euler();
  const outlineScale = 1.002;

  let spawnedCount = 0;
  let emitterAccumulator = 0.0;
  let gpuVisualsBound = false;

  const spawnBody = (
    position: [number, number, number],
    quaternion: [number, number, number, number],
    linearVelocity?: [number, number, number],
    angularVelocity?: [number, number, number],
  ): boolean => {
    if (spawnedCount >= count || physics.getBodyCount() >= physics.config.maxBodies) {
      return false;
    }

    const bodyIndex = physics.addBody({
      position,
      quaternion,
      mass: 1.0,
      halfExtents: [hx, hy, hz],
      linearVelocity,
      angularVelocity,
    });

    bodyIndexData[spawnedCount * 4 + 0] = bodyIndex;
    bodyIndexAttr.needsUpdate = true;

    spawnedCount++;
    instancedMesh.count = spawnedCount;
    outlineMesh.count = spawnedCount;
    return true;
  };

  const makeSpawnQuaternion = (forEmitter: boolean): [number, number, number, number] => {
    if (emitter.randomRotation) {
      if (forEmitter || layout === 'column') {
        const jitter = Math.max(emitter.rotationJitter, 0.0);
        euler.set(
          THREE.MathUtils.randFloatSpread(jitter * 2),
          THREE.MathUtils.randFloatSpread(jitter * 2),
          THREE.MathUtils.randFloatSpread(jitter * 2),
        );
      } else {
        euler.set(
          Math.random() * Math.PI * 2,
          Math.random() * Math.PI * 2,
          Math.random() * Math.PI * 2,
        );
      }
      tmpQuat.setFromEuler(euler);
    } else {
      tmpQuat.set(0, 0, 0, 1);
    }
    return [tmpQuat.x, tmpQuat.y, tmpQuat.z, tmpQuat.w];
  };

  const spawnOneFromLayout = (): boolean => {
    let x = 0;
    let y = 0;
    let z = 0;

    if (layout === 'column') {
      const columnIndex = spawnedCount;
      const offsetXPerLevel = column.offsetXPerLevel ?? 0;
      const offsetZPerLevel = column.offsetZPerLevel ?? 0;
      x = column.x + columnIndex * offsetXPerLevel;
      y = column.startY + columnIndex * column.spacing;
      z = column.z + columnIndex * offsetZPerLevel;
    } else if (layout === 'pyramid') {
      let localIndex = spawnedCount;
      let layer = 0;
      let side = pyramidLayers;
      while (side > 0) {
        const layerCells = side * side;
        if (localIndex < layerCells) {
          break;
        }
        localIndex -= layerCells;
        layer++;
        side--;
      }

      if (side <= 0) {
        const overflow = spawnedCount - pyramidBaseCells;
        x = pyramid.x;
        z = pyramid.z;
        y = pyramid.startY + pyramidLayers * pyramidLayerHeight + overflow * pyramidLayerHeight;
      } else {
        const ix = localIndex % side;
        const iz = Math.floor(localIndex / side);
        const offset = (side - 1) * 0.5;
        x = pyramid.x + (ix - offset) * pyramidStepX;
        z = pyramid.z + (iz - offset) * pyramidStepZ;
        y = pyramid.startY + layer * pyramidLayerHeight;
      }
    } else if (layout === 'pyramid-wall') {
      let localIndex = spawnedCount;
      let layer = 0;
      let rowCount = pyramidWallLayers;
      while (rowCount > 0) {
        if (localIndex < rowCount) {
          break;
        }
        localIndex -= rowCount;
        layer++;
        rowCount--;
      }

      if (rowCount <= 0) {
        const overflow = spawnedCount - pyramidWallBaseCells;
        x = pyramidWall.x;
        z = pyramidWall.z;
        y = pyramidWall.startY + pyramidWallLayers * pyramidWallStepY + overflow * (hy * 2 + 0.03);
      } else {
        x = pyramidWall.x
          + localIndex * pyramidWallStepX
          + layer * (0.5 * pyramidWallStepX)
          - pyramidWallLayers * (0.5 * pyramidWallStepX);
        y = pyramidWall.startY + layer * pyramidWallStepY;
        z = pyramidWall.z;
      }
    } else if (layout === 'grid') {
      const gridBaseCells = gridSizeX * gridSizeY * gridSizeZ;
      const stacksPerBand = gridStacksX * gridStacksZ;
      const gridBandCells = gridBaseCells * stacksPerBand;
      const stackBand = Math.floor(spawnedCount / gridBandCells);
      const bandLocalIndex = spawnedCount - stackBand * gridBandCells;
      const stackIndex = Math.floor(bandLocalIndex / gridBaseCells);
      const localIndex = bandLocalIndex - stackIndex * gridBaseCells;
      const stackX = stackIndex % gridStacksX;
      const stackZ = Math.floor(stackIndex / gridStacksX);
      const plane = gridSizeX * gridSizeZ;
      const gy = Math.floor(localIndex / plane);
      const rem = localIndex - gy * plane;
      const gz = Math.floor(rem / gridSizeX);
      const gx = rem - gz * gridSizeX;
      const offsetX = (gridSizeX - 1) * 0.5;
      const offsetZ = (gridSizeZ - 1) * 0.5;
      const offsetStackX = (gridStacksX - 1) * 0.5;
      const offsetStackZ = (gridStacksZ - 1) * 0.5;
      x = grid.x
        + (stackX - offsetStackX) * gridStackStepX
        + (gx - offsetX) * gridStepX;
      z = grid.z
        + (stackZ - offsetStackZ) * gridStackStepZ
        + (gz - offsetZ) * gridStepZ;
      y = grid.startY + (stackBand * gridSizeY + gy) * gridStepY;
    } else {
      x = THREE.MathUtils.randFloat(spawnArea.x[0], spawnArea.x[1]);
      y = THREE.MathUtils.randFloat(spawnArea.y[0], spawnArea.y[1]);
      z = THREE.MathUtils.randFloat(spawnArea.z[0], spawnArea.z[1]);
    }

    const quat = makeSpawnQuaternion(false);
    return spawnBody([x, y, z], quat, undefined, undefined);
  };

  const spawnOneFromEmitter = (): boolean => {
    const quat = makeSpawnQuaternion(true);
    return spawnBody([emitter.x, emitter.y, emitter.z], quat, undefined, undefined);
  };

  const emitByLayout = (requestedCount = 1): number => {
    const toEmit = Math.max(0, Math.floor(requestedCount));
    let emitted = 0;
    for (let i = 0; i < toEmit; i++) {
      if (!spawnOneFromLayout()) {
        break;
      }
      emitted++;
    }
    return emitted;
  };

  const emitFromEmitter = (requestedCount = 1): number => {
    const toEmit = Math.max(0, Math.floor(requestedCount));
    let emitted = 0;
    for (let i = 0; i < toEmit; i++) {
      if (!spawnOneFromEmitter()) {
        break;
      }
      emitted++;
    }
    return emitted;
  };

  if (initialCount > 0) {
    emitByLayout(initialCount);
  }

  return {
    instancedMesh,

    syncVisuals(engine: PhysicsEngine, renderer?: any): void {
      const renderBuffers = engine.getRenderBuffers();
      if (!renderBuffers) return;

      if (!gpuVisualsBound) {
        const shader = wgslFn(/* wgsl */`
          fn compute(
            positions: ptr<storage, array<vec4f>, read>,
            quaternions: ptr<storage, array<vec4f>, read>,
            bodyIndices: ptr<storage, array<vec4f>, read>,
            outPositions: ptr<storage, array<vec4f>, read_write>,
            outQuaternions: ptr<storage, array<vec4f>, read_write>,
            instanceCount: u32,
            workgroupId: vec3u,
            localId: vec3u,
          ) -> void {
            let gid = workgroupId.x * ${GATHER_WORKGROUP_SIZE}u + localId.x;
            if (gid >= instanceCount) { return; }
            let body = u32(bodyIndices[gid].x);
            outPositions[gid] = positions[body];
            outQuaternions[gid] = quaternions[body];
          }
        `);

        gatherKernel = shader({
          positions: computeStorage(renderBuffers.positions, 'vec4f', engine.config.maxBodies).toReadOnly(),
          quaternions: computeStorage(renderBuffers.quaternions, 'vec4f', engine.config.maxBodies).toReadOnly(),
          bodyIndices: computeStorage(bodyIndexAttr, 'vec4f', count).toReadOnly(),
          outPositions: computeStorage(instancePosAttr, 'vec4f', count),
          outQuaternions: computeStorage(instanceQuatAttr, 'vec4f', count),
          instanceCount: uniform(0),
          workgroupId,
          localId,
        }).computeKernel([GATHER_WORKGROUP_SIZE, 1, 1]).setName('Box Spawner Pose Gather');

        const pos = computeStorage(instancePosAttr, 'vec4', count).toAttribute().xyz;
        const quat = computeStorage(instanceQuatAttr, 'vec4', count).toAttribute();
        const qv = quat.xyz;
        const qw = quat.w;

        const rotateByQuat = (v: any) => {
          const t = qv.cross(v).mul(2.0);
          return v.add(t.mul(qw)).add(qv.cross(t));
        };

        material.positionNode = rotateByQuat(positionLocal).add(pos);
        // NodeMaterial expects custom normalNode in view space.
        material.normalNode = varying(
          transformNormalToView(rotateByQuat(normalLocal)).normalize(),
          'vSpawnerBodyNormalView',
        );
        material.needsUpdate = true;

        outlineMaterial.positionNode = rotateByQuat(positionLocal.mul(outlineScale)).add(pos);
        outlineMaterial.needsUpdate = true;
        gpuVisualsBound = true;
      }

      if (!renderer || spawnedCount === 0) return;
      gatherKernel.computeNode.parameters.instanceCount.value = spawnedCount;
      renderer.compute(gatherKernel, [Math.ceil(spawnedCount / GATHER_WORKGROUP_SIZE), 1, 1]);
    },

    update(dt: number): void {
      if (!emitter.enabled || emitter.rate <= 0.0 || spawnedCount >= count) {
        return;
      }

      emitterAccumulator += Math.max(0.0, dt) * emitter.rate;
      const toEmit = Math.floor(emitterAccumulator);
      if (toEmit <= 0) {
        return;
      }

      emitterAccumulator -= toEmit;
      const emitted = emitFromEmitter(toEmit);
      if (emitted < toEmit || spawnedCount >= count) {
        emitter.enabled = false;
        emitterAccumulator = 0.0;
      }
    },

    emit(requestedCount = 1): number {
      return emitFromEmitter(requestedCount);
    },

    shoot(config): boolean {
      const dir = new THREE.Vector3(config.direction[0], config.direction[1], config.direction[2]);
      if (dir.lengthSq() < 1e-8) {
        return false;
      }

      dir.normalize();
      const speedJitter = Math.max(config.speedJitter ?? 0.0, 0.0);
      const averageSpeed = Math.max(config.averageSpeed, 0.0);
      const speed = Math.max(0.0, averageSpeed + THREE.MathUtils.randFloatSpread(speedJitter * 2));
      const velocity = dir.multiplyScalar(speed);
      const angularJitter = Math.max(config.angularJitter ?? 0.0, 0.0);
      const angularVelocity: [number, number, number] = [
        THREE.MathUtils.randFloatSpread(angularJitter * 2),
        THREE.MathUtils.randFloatSpread(angularJitter * 2),
        THREE.MathUtils.randFloatSpread(angularJitter * 2),
      ];

      return spawnBody(
        config.position,
        [0, 0, 0, 1],
        [velocity.x, velocity.y, velocity.z],
        angularVelocity,
      );
    },

    getSpawnedCount(): number {
      return spawnedCount;
    },

    getCapacity(): number {
      return count;
    },

    getEmitter(): EmitterRuntimeConfig {
      return { ...emitter };
    },

    setEmitter(patch: Partial<EmitterRuntimeConfig>): void {
      if (patch.enabled !== undefined) emitter.enabled = patch.enabled;
      if (patch.rate !== undefined) emitter.rate = Math.max(0.0, patch.rate);
      if (patch.x !== undefined) emitter.x = patch.x;
      if (patch.y !== undefined) emitter.y = patch.y;
      if (patch.z !== undefined) emitter.z = patch.z;
      if (patch.randomRotation !== undefined) emitter.randomRotation = patch.randomRotation;
      if (patch.rotationJitter !== undefined) emitter.rotationJitter = Math.max(0.0, patch.rotationJitter);
    },

    dispose(): void {
      scene.remove(instancedMesh);
      scene.remove(outlineMesh);
      instancedMesh.removeFromParent();
      outlineMesh.removeFromParent();
      instancedMesh.dispose();
      outlineMesh.dispose();
      geometry.dispose();
      material.dispose();
      outlineMaterial.dispose();
    },
  };
}
