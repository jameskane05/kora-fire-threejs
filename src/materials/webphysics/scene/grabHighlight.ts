import * as THREE from 'three';
import { MeshBasicNodeMaterial, StorageBufferAttribute, StorageInstancedBufferAttribute } from 'three/webgpu';
import { float, mix, positionLocal, uniform } from 'three/tsl';
import { localId, storage, wgslFn, workgroupId } from '../physics/gpu/tslCompat';
import { PhysicsEngine } from '../physics/PhysicsEngine';

const GATHER_WORKGROUP_SIZE = 64;
const IN_RATE = 22;
const OUT_RATE = 16;
const HULL_MIN = 1.03;
const HULL_MAX = 1.09;

export class GrabHighlight {
  private readonly boxMesh: THREE.InstancedMesh;
  private readonly sphereMesh: THREE.InstancedMesh;
  private readonly boxGeometry: THREE.BoxGeometry;
  private readonly sphereGeometry: THREE.SphereGeometry;
  private readonly material: MeshBasicNodeMaterial;
  private readonly amountUniform: ReturnType<typeof uniform>;
  private readonly sizeUniform: ReturnType<typeof uniform>;
  private readonly bodyIndexAttr: StorageBufferAttribute;
  private readonly instancePosAttr: StorageInstancedBufferAttribute;
  private readonly instanceQuatAttr: StorageInstancedBufferAttribute;
  private gatherKernel: any = null;
  private gpuBound = false;
  private body = -1;
  private shape: 'box' | 'sphere' = 'box';
  private amount = 0;
  private target = 0;

  constructor(private readonly scene: THREE.Object3D) {
    this.amountUniform = uniform(0);
    this.sizeUniform = uniform(new THREE.Vector3(1, 1, 1));

    this.material = new MeshBasicNodeMaterial();
    this.material.color.setHex(0x9ae7ff);
    this.material.side = THREE.BackSide;
    this.material.transparent = true;
    this.material.depthWrite = false;
    this.material.opacityNode = this.amountUniform.mul(0.7);
    this.material.forceSinglePass = true;

    this.boxGeometry = new THREE.BoxGeometry(1, 1, 1);
    this.sphereGeometry = new THREE.SphereGeometry(1, 20, 16);

    this.boxMesh = new THREE.InstancedMesh(this.boxGeometry, this.material, 1);
    this.sphereMesh = new THREE.InstancedMesh(this.sphereGeometry, this.material, 1);
    for (const mesh of [this.boxMesh, this.sphereMesh]) {
      mesh.frustumCulled = false;
      mesh.count = 1;
      mesh.renderOrder = 8;
      mesh.visible = false;
      scene.add(mesh);
    }

    this.bodyIndexAttr = new StorageBufferAttribute(new Float32Array(4), 4);
    this.instancePosAttr = new StorageInstancedBufferAttribute(1, 4);
    this.instanceQuatAttr = new StorageInstancedBufferAttribute(1, 4);
  }

  setBody(body: number | null, physics?: PhysicsEngine): void {
    if (body === null || body < 0 || !physics) {
      this.target = 0;
      return;
    }
    const pose = physics.getBodyPoseCpu(body);
    const shape = physics.getBodyShapeType(body);
    if (!pose || !shape) {
      this.target = 0;
      return;
    }
    this.body = body;
    this.shape = shape;
    this.target = 1;
    const [hx, hy, hz] = pose.halfExtents;
    if (shape === 'sphere') {
      const r = Math.max(hx, 1e-4);
      this.sizeUniform.value.set(r, r, r);
    } else {
      this.sizeUniform.value.set(Math.max(hx * 2, 1e-4), Math.max(hy * 2, 1e-4), Math.max(hz * 2, 1e-4));
    }
    const data = this.bodyIndexAttr.array as Float32Array;
    data[0] = body;
    this.bodyIndexAttr.needsUpdate = true;
  }

  sync(engine: PhysicsEngine, renderer: any, dt: number): void {
    const t = Math.min(Math.max(dt, 0), 0.05);
    const rate = this.target > this.amount ? IN_RATE : OUT_RATE;
    this.amount += (this.target - this.amount) * (1 - Math.exp(-rate * t));
    if (Math.abs(this.target - this.amount) < 0.004) this.amount = this.target;
    this.amountUniform.value = this.amount;

    const show = this.amount > 0.01 && this.body >= 0;
    this.boxMesh.visible = show && this.shape === 'box';
    this.sphereMesh.visible = show && this.shape === 'sphere';
    if (!show) {
      if (this.amount === 0) this.body = -1;
      return;
    }

    const renderBuffers = engine.getRenderBuffers();
    if (!renderBuffers) return;

    if (!this.gpuBound) {
      const shader = wgslFn(/* wgsl */`
        fn compute(
          positions: ptr<storage, array<vec4f>, read>,
          quaternions: ptr<storage, array<vec4f>, read>,
          bodyIndices: ptr<storage, array<vec4f>, read>,
          outPositions: ptr<storage, array<vec4f>, read_write>,
          outQuaternions: ptr<storage, array<vec4f>, read_write>,
          workgroupId: vec3u,
          localId: vec3u,
        ) -> void {
          let gid = workgroupId.x * ${GATHER_WORKGROUP_SIZE}u + localId.x;
          if (gid > 0u) { return; }
          let body = u32(bodyIndices[0].x);
          outPositions[0] = positions[body];
          outQuaternions[0] = quaternions[body];
        }
      `);

      this.gatherKernel = shader({
        positions: storage(renderBuffers.positions, 'vec4f', engine.config.maxBodies).toReadOnly(),
        quaternions: storage(renderBuffers.quaternions, 'vec4f', engine.config.maxBodies).toReadOnly(),
        bodyIndices: storage(this.bodyIndexAttr, 'vec4f', 1).toReadOnly(),
        outPositions: storage(this.instancePosAttr, 'vec4f', 1),
        outQuaternions: storage(this.instanceQuatAttr, 'vec4f', 1),
        workgroupId,
        localId,
      }).computeKernel([GATHER_WORKGROUP_SIZE, 1, 1]).setName('Grab Highlight Pose Gather');

      const pos = storage(this.instancePosAttr, 'vec4', 1).toAttribute().xyz;
      const quat = storage(this.instanceQuatAttr, 'vec4', 1).toAttribute();
      const qv = quat.xyz;
      const qw = quat.w;
      const rotateByQuat = (v: any) => {
        const tq = qv.cross(v).mul(2.0);
        return v.add(tq.mul(qw)).add(qv.cross(tq));
      };
      const hull = mix(float(HULL_MIN), float(HULL_MAX), this.amountUniform);
      this.material.positionNode = rotateByQuat(positionLocal.mul(this.sizeUniform).mul(hull)).add(pos);
      this.material.needsUpdate = true;
      this.gpuBound = true;
    }

    if (!renderer) return;
    renderer.compute(this.gatherKernel, [1, 1, 1]);
  }

  dispose(): void {
    this.scene.remove(this.boxMesh);
    this.scene.remove(this.sphereMesh);
    this.boxMesh.dispose();
    this.sphereMesh.dispose();
    this.boxGeometry.dispose();
    this.sphereGeometry.dispose();
    this.material.dispose();
  }
}
