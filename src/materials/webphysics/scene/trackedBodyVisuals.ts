import * as THREE from 'three';
import { MeshBasicNodeMaterial, StorageBufferAttribute, StorageInstancedBufferAttribute } from 'three/webgpu';
import {
  cameraPosition,
  color,
  float,
  max,
  mix,
  modelWorldMatrix,
  normalLocal,
  normalize,
  oneMinus,
  positionLocal,
  pow,
  varying,
  vec3,
  vec4,
} from 'three/tsl';
import { storage, uniform, wgslFn, workgroupId, localId } from '../physics/gpu/tslCompat';
import { PhysicsEngine } from '../physics/PhysicsEngine';

const GATHER_WORKGROUP_SIZE = 64;

/**
 * Studio rig baked into the shader. Pre-normalised so the vertex stage does not redo it.
 * Key is a warm overhead sun, fill is a cool bounce from behind-left, and the hemisphere keeps
 * downward faces off pure black without an ambient light object.
 */
const KEY_DIR = [0.5, 0.82, 0.28] as const;
const FILL_DIR = [-0.692, 0.353, -0.63] as const;
const SKY_COLOR = [0.42, 0.47, 0.58] as const;
const BOUNCE_COLOR = [0.2, 0.17, 0.15] as const;
const KEY_COLOR = [1.0, 0.96, 0.88] as const;
const FILL_COLOR = [0.35, 0.45, 0.62] as const;

/** Per-body overrides, only honoured by sets built with `perInstance`. */
export type TrackedBodyInstance = {
  halfExtents?: [number, number, number];
  color?: number;
};

export type TrackedBodyVisualSet = {
  addBody: (body: number, instance?: TrackedBodyInstance) => void;
  syncVisuals: (engine: PhysicsEngine, renderer?: any) => void;
  dispose: () => void;
};

export function createTrackedBodyVisualSet(
  scene: THREE.Object3D,
  physics: PhysicsEngine,
  options: {
    capacity: number;
    halfExtents?: [number, number, number];
    geometry?: THREE.BufferGeometry;
    color: number;
    roughness?: number;
    metalness?: number;
    outlineScale?: number;
    showOutline?: boolean;
    castShadow?: boolean;
    receiveShadow?: boolean;
    /**
     * Take colour from `addBody` rather than baking it into the material, and — unless an explicit
     * geometry is supplied — box size too. A scene of differently sized, differently coloured
     * boxes then costs one draw and one pipeline instead of one of each per size/colour pair.
     */
    perInstance?: boolean;
  },
): TrackedBodyVisualSet {
  const { capacity } = options;
  const outlineScale = options.outlineScale ?? 1.002;
  const showOutline = options.showOutline ?? true;
  const castShadow = options.castShadow ?? true;
  const receiveShadow = options.receiveShadow ?? true;
  const perInstance = options.perInstance === true;
  const ownsGeometry = options.geometry === undefined;
  // Only the box we generate ourselves can be a unit cube stretched per instance; a supplied
  // geometry (a sphere, say) keeps its own shape and takes the per-instance tint alone.
  const scalePerInstance = perInstance && ownsGeometry;
  const geometry = options.geometry
    ?? new THREE.BoxGeometry(
      scalePerInstance ? 1.0 : (options.halfExtents?.[0] ?? 0.5) * 2.0,
      scalePerInstance ? 1.0 : (options.halfExtents?.[1] ?? 0.5) * 2.0,
      scalePerInstance ? 1.0 : (options.halfExtents?.[2] ?? 0.5) * 2.0,
    );

  const roughness = options.roughness ?? 0.7;
  const metalness = options.metalness ?? 0.0;
  const gloss = 8 + (1 - roughness) ** 2 * 120;
  const specStrength = 0.05 + (1 - roughness) * 0.25;

  // Stays Basic: the shading below is hand-rolled in colorNode, so there are no light bindings,
  // no shadow maps and no IBL fetches. A lit material would also need normalNode fixing up,
  // since the per-instance quaternion lives in positionNode and three's normal matrix knows
  // nothing about it — every box would light as though it were unrotated.
  const material = new MeshBasicNodeMaterial();
  material.color.setHex(options.color);

  const instancedMesh = new THREE.InstancedMesh(geometry, material, capacity);
  instancedMesh.castShadow = castShadow;
  instancedMesh.receiveShadow = receiveShadow;
  instancedMesh.frustumCulled = false;
  instancedMesh.count = 0;
  scene.add(instancedMesh);

  const outlineMaterial = new MeshBasicNodeMaterial();
  outlineMaterial.color.setHex(0x111111);
  outlineMaterial.wireframe = true;
  outlineMaterial.transparent = true;
  outlineMaterial.opacity = 0.5;
  outlineMaterial.depthWrite = false;

  const outlineMesh = new THREE.InstancedMesh(geometry, outlineMaterial, capacity);
  outlineMesh.frustumCulled = false;
  outlineMesh.count = 0;
  outlineMesh.renderOrder = 1;
  if (showOutline) {
    scene.add(outlineMesh);
  }

  const bodyIndexData = new Float32Array(capacity * 4);
  const bodyIndexAttr = new StorageBufferAttribute(bodyIndexData, 4);
  // Gathered per-instance poses. Reading these as instanced attributes keeps the vertex stage free
  // of storage bindings, which some WebGPU devices (notably visionOS Safari) do not permit.
  const instancePosAttr = new StorageInstancedBufferAttribute(capacity, 4);
  const instanceQuatAttr = new StorageInstancedBufferAttribute(capacity, 4);
  const instanceExtentData = scalePerInstance ? new Float32Array(capacity * 4) : null;
  const instanceTintData = perInstance ? new Float32Array(capacity * 4) : null;
  const instanceExtentAttr = instanceExtentData
    ? new StorageInstancedBufferAttribute(instanceExtentData, 4)
    : null;
  const instanceTintAttr = instanceTintData
    ? new StorageInstancedBufferAttribute(instanceTintData, 4)
    : null;
  const tintScratch = new THREE.Color();
  let trackedCount = 0;
  let gpuVisualsBound = false;
  let gatherKernel: any = null;

  return {
    addBody(body: number, instance?: TrackedBodyInstance): void {
      if (trackedCount >= capacity) {
        throw new Error(`Tracked body visual capacity exceeded (${capacity})`);
      }
      bodyIndexData[trackedCount * 4 + 0] = body;
      bodyIndexAttr.needsUpdate = true;

      const base = trackedCount * 4;
      if (instanceExtentData) {
        const half = instance?.halfExtents ?? options.halfExtents ?? [0.5, 0.5, 0.5];
        instanceExtentData[base + 0] = half[0];
        instanceExtentData[base + 1] = half[1];
        instanceExtentData[base + 2] = half[2];
        instanceExtentAttr!.needsUpdate = true;
      }
      if (instanceTintData) {
        tintScratch.setHex(instance?.color ?? options.color);
        instanceTintData[base + 0] = tintScratch.r;
        instanceTintData[base + 1] = tintScratch.g;
        instanceTintData[base + 2] = tintScratch.b;
        instanceTintAttr!.needsUpdate = true;
      }

      trackedCount++;
      instancedMesh.count = trackedCount;
      if (showOutline) {
        outlineMesh.count = trackedCount;
      }
    },

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
          positions: storage(renderBuffers.positions, 'vec4f', physics.config.maxBodies).toReadOnly(),
          quaternions: storage(renderBuffers.quaternions, 'vec4f', physics.config.maxBodies).toReadOnly(),
          bodyIndices: storage(bodyIndexAttr, 'vec4f', capacity).toReadOnly(),
          outPositions: storage(instancePosAttr, 'vec4f', capacity),
          outQuaternions: storage(instanceQuatAttr, 'vec4f', capacity),
          instanceCount: uniform(0),
          workgroupId,
          localId,
        }).computeKernel([GATHER_WORKGROUP_SIZE, 1, 1]).setName('Tracked Body Pose Gather');

        const pos = storage(instancePosAttr, 'vec4', capacity).toAttribute().xyz;
        const quat = storage(instanceQuatAttr, 'vec4', capacity).toAttribute();
        const qv = quat.xyz;
        const qw = quat.w;

        const rotateByQuat = (v: any) => {
          const t = qv.cross(v).mul(2.0);
          return v.add(t.mul(qw)).add(qv.cross(t));
        };

        // Unit cube scaled per instance. Box normals are axis-aligned, so dividing by the
        // half-extents and renormalising is the exact inverse-transpose for this scale.
        const extent = instanceExtentAttr
          ? storage(instanceExtentAttr, 'vec4', capacity).toAttribute().xyz
          : null;
        const localPos = extent ? positionLocal.mul(extent.mul(2.0)) : positionLocal;
        const localNormal = extent ? normalize(normalLocal.div(extent)) : normalLocal;

        const objectPos = rotateByQuat(localPos).add(pos);
        material.positionNode = objectPos;

        // Built here rather than read from positionWorld / normalLocal in the fragment stage:
        // both derive from the untransformed geometry, and the instance pose only exists inside
        // these nodes.
        const worldPos = varying(modelWorldMatrix.mul(vec4(objectPos, 1)).xyz);
        const worldNormal = varying(
          normalize(modelWorldMatrix.mul(vec4(rotateByQuat(localNormal), 0)).xyz),
        );

        const base = instanceTintAttr
          ? storage(instanceTintAttr, 'vec4', capacity).toAttribute().xyz
          : color(options.color);
        const viewDir = normalize(cameraPosition.sub(worldPos));
        const keyDir = vec3(...KEY_DIR);

        const hemi = mix(vec3(...BOUNCE_COLOR), vec3(...SKY_COLOR), worldNormal.y.mul(0.5).add(0.5));
        const key = vec3(...KEY_COLOR).mul(max(worldNormal.dot(keyDir), float(0)));
        const fill = vec3(...FILL_COLOR).mul(max(worldNormal.dot(vec3(...FILL_DIR)), float(0)));
        const diffuse = base.mul(hemi.mul(0.65).add(key.mul(0.85)).add(fill.mul(0.4)));

        const halfway = normalize(keyDir.add(viewDir));
        const spec = pow(max(worldNormal.dot(halfway), float(0)), float(gloss)).mul(specStrength);
        const specTint = mix(vec3(1, 1, 1), base, metalness);
        // Keeps silhouettes off the dark backdrop, which the flat fill used to lose entirely.
        const rim = vec3(...SKY_COLOR).mul(
          pow(oneMinus(max(worldNormal.dot(viewDir), float(0))), float(3)).mul(0.14),
        );

        material.colorNode = diffuse.add(specTint.mul(spec)).add(rim);
        material.needsUpdate = true;

        if (showOutline) {
          outlineMaterial.positionNode = rotateByQuat(localPos.mul(outlineScale)).add(pos);
          outlineMaterial.needsUpdate = true;
        }
        gpuVisualsBound = true;
      }

      if (!renderer || trackedCount === 0) return;
      gatherKernel.computeNode.parameters.instanceCount.value = trackedCount;
      renderer.compute(gatherKernel, [Math.ceil(trackedCount / GATHER_WORKGROUP_SIZE), 1, 1]);
    },

    dispose(): void {
      scene.remove(instancedMesh);
      if (showOutline) {
        scene.remove(outlineMesh);
      }
      instancedMesh.dispose();
      outlineMesh.dispose();
      material.dispose();
      outlineMaterial.dispose();
      if (ownsGeometry) geometry.dispose();
    },
  };
}
