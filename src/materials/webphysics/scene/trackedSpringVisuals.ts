import * as THREE from 'three';
import { MeshBasicNodeMaterial, StorageBufferAttribute } from 'three/webgpu';
import {
  float,
  floatBitsToUint,
  instanceIndex,
  positionLocal,
  select,
  storage,
  uint,
  vec3,
  vec4,
} from 'three/tsl';
import { PhysicsEngine } from '../physics/PhysicsEngine';
import {
  SPRING_RECORD_ANCHOR_A_OFFSET,
  SPRING_RECORD_ANCHOR_B_OFFSET,
  SPRING_RECORD_META_OFFSET,
  SPRING_RECORD_VEC4S,
} from '../physics/gpu/springRecord';

const WORLD_BODY_INDEX = 0xffffffff;

export type TrackedSpringVisualSet = {
  addSpring: (spring: number) => void;
  syncVisuals: (engine: PhysicsEngine) => void;
  dispose: () => void;
};

export function createTrackedSpringVisualSet(
  scene: THREE.Object3D,
  options: {
    capacity: number;
    color?: number;
    radius?: number;
  },
): TrackedSpringVisualSet {
  const capacity = Math.max(1, options.capacity);
  const radius = options.radius ?? 0.045;
  const geometry = new THREE.CylinderGeometry(1.0, 1.0, 1.0, 8, 1, true);

  const material = new MeshBasicNodeMaterial();
  material.color.setHex(options.color ?? 0xc9d1d9);
  material.transparent = true;
  material.opacity = 0.9;
  material.depthWrite = false;

  const mesh = new THREE.InstancedMesh(geometry, material, capacity);
  mesh.count = 0;
  mesh.frustumCulled = false;
  mesh.renderOrder = 2;
  scene.add(mesh);

  const springIndexData = new Uint32Array(capacity);
  const springIndexAttr = new StorageBufferAttribute(springIndexData, 1);
  let trackedCount = 0;
  let gpuVisualsBound = false;

  return {
    addSpring(spring: number): void {
      if (trackedCount >= capacity) {
        throw new Error(`Tracked spring visual capacity exceeded (${capacity})`);
      }
      springIndexData[trackedCount] = spring >>> 0;
      springIndexAttr.needsUpdate = true;
      trackedCount++;
      mesh.count = trackedCount;
    },

    syncVisuals(engine: PhysicsEngine): void {
      if (gpuVisualsBound) return;

      const renderBuffers = engine.getSpringRenderBuffers();
      if (!renderBuffers) return;

      const positions = storage(renderBuffers.positions, 'vec4', engine.config.maxBodies).toReadOnly();
      const quaternions = storage(renderBuffers.quaternions, 'vec4', engine.config.maxBodies).toReadOnly();
      const springRecords = storage(
        renderBuffers.springRecords,
        'vec4',
        renderBuffers.maxSprings * SPRING_RECORD_VEC4S,
      ).toReadOnly();
      const springIndices = storage(springIndexAttr, 'uint', capacity).toReadOnly();

      const idx = instanceIndex;
      const springIndex = springIndices.element(idx);
      const base = springIndex.mul(uint(SPRING_RECORD_VEC4S));

      const meta = springRecords.element(base.add(uint(SPRING_RECORD_META_OFFSET)));
      const anchorARest = springRecords.element(base.add(uint(SPRING_RECORD_ANCHOR_A_OFFSET)));
      const anchorBStiffness = springRecords.element(base.add(uint(SPRING_RECORD_ANCHOR_B_OFFSET)));

      const bodyAIndex = uint(floatBitsToUint(meta.x));
      const bodyBIndex = uint(floatBitsToUint(meta.y));
      const isActive = uint(floatBitsToUint(meta.z)).greaterThan(uint(0));
      const isWorldA = bodyAIndex.equal(uint(WORLD_BODY_INDEX));

      const safeBodyAIndex = select(isWorldA, uint(0), bodyAIndex);
      const posA = positions.element(safeBodyAIndex).xyz;
      const posB = positions.element(bodyBIndex).xyz;
      const quatA = select(isWorldA, vec4(0.0, 0.0, 0.0, 1.0), quaternions.element(safeBodyAIndex));
      const quatB = quaternions.element(bodyBIndex);

      const rotateByQuat = (value: any, quat: any) => {
        const qv = quat.xyz;
        const qw = quat.w;
        const t = qv.cross(value).mul(2.0);
        return value.add(t.mul(qw)).add(qv.cross(t));
      };

      const pointA = select(isWorldA, anchorARest.xyz, posA.add(rotateByQuat(anchorARest.xyz, quatA)));
      const pointB = posB.add(rotateByQuat(anchorBStiffness.xyz, quatB));

      const hiddenPoint = vec3(0.0, -1000000.0, 0.0);
      const segment = pointB.sub(pointA);
      const segmentLength = segment.length().max(float(1e-8));
      const segmentDir = segment.div(segmentLength);
      const refAxis = select(
        segmentDir.y.abs().greaterThan(float(0.95)),
        vec3(1.0, 0.0, 0.0),
        vec3(0.0, 1.0, 0.0),
      );
      const axisX = refAxis.cross(segmentDir).normalize();
      const axisZ = segmentDir.cross(axisX).normalize();
      const center = pointA.add(pointB).mul(0.5);
      const visibleRadius = select(isActive, float(radius), float(0.0));
      const cylinderY = positionLocal.y.mul(select(isActive, segmentLength, float(0.0)));
      const offset = axisX.mul(positionLocal.x.mul(visibleRadius))
        .add(segmentDir.mul(cylinderY))
        .add(axisZ.mul(positionLocal.z.mul(visibleRadius)));
      const worldPosition = select(isActive, center.add(offset), hiddenPoint);

      material.positionNode = worldPosition;
      material.needsUpdate = true;
      gpuVisualsBound = true;
    },

    dispose(): void {
      scene.remove(mesh);
      mesh.dispose();
      geometry.dispose();
      material.dispose();
    },
  };
}
