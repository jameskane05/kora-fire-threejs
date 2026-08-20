import * as THREE from 'three';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import {
  bitAnd,
  float,
  instanceIndex,
  positionLocal,
  select,
  shiftRight,
  storage,
  uint,
  vec3,
} from 'three/tsl';
import type { PhysicsEngine } from '../physics/PhysicsEngine';
import {
  CONTACT_RECORD_ARM_A_OFFSET,
  CONTACT_RECORD_ARM_B_OFFSET,
  CONTACT_RECORD_META_OFFSET,
  CONTACT_RECORD_VEC4S,
} from '../physics/gpu/contactRecord';

export class ContactPointOverlay {
  private readonly pointAMesh: THREE.InstancedMesh;
  private readonly pointBMesh: THREE.InstancedMesh;
  private readonly connectorMesh: THREE.InstancedMesh;
  private readonly pointGeometry: THREE.SphereGeometry;
  private readonly connectorGeometry: THREE.CylinderGeometry;
  private readonly capacity: number;
  private readonly pointAMaterial: MeshBasicNodeMaterial;
  private readonly pointBMaterial: MeshBasicNodeMaterial;
  private readonly connectorMaterial: MeshBasicNodeMaterial;
  private enabled = false;
  private gpuVisualsBound = false;

  constructor(scene: THREE.Object3D, capacity: number) {
    this.capacity = Math.max(1, capacity);
    const pointGeometry = new THREE.SphereGeometry(1.0, 10, 10);
    const connectorGeometry = new THREE.CylinderGeometry(1.0, 1.0, 1.0, 8, 1, true);
    this.pointGeometry = pointGeometry;
    this.connectorGeometry = connectorGeometry;

    const pointAMaterial = new MeshBasicNodeMaterial();
    pointAMaterial.color.setHex(0xffcf56);
    pointAMaterial.transparent = true;
    pointAMaterial.opacity = 0.98;
    pointAMaterial.depthWrite = false;
    this.pointAMaterial = pointAMaterial;

    const pointBMaterial = new MeshBasicNodeMaterial();
    pointBMaterial.color.setHex(0xd62939);
    pointBMaterial.transparent = true;
    pointBMaterial.opacity = 0.98;
    pointBMaterial.depthWrite = false;
    this.pointBMaterial = pointBMaterial;

    const connectorMaterial = new MeshBasicNodeMaterial();
    connectorMaterial.color.setHex(0xff8c42);
    connectorMaterial.transparent = true;
    connectorMaterial.opacity = 0.32;
    connectorMaterial.depthWrite = false;
    this.connectorMaterial = connectorMaterial;

    this.connectorMesh = new THREE.InstancedMesh(connectorGeometry, connectorMaterial, this.capacity);
    this.connectorMesh.count = 0;
    this.connectorMesh.frustumCulled = false;
    this.connectorMesh.renderOrder = 3;
    this.connectorMesh.visible = false;
    scene.add(this.connectorMesh);

    this.pointAMesh = new THREE.InstancedMesh(pointGeometry, pointAMaterial, this.capacity);
    this.pointAMesh.count = 0;
    this.pointAMesh.frustumCulled = false;
    this.pointAMesh.renderOrder = 4;
    this.pointAMesh.visible = false;
    scene.add(this.pointAMesh);

    this.pointBMesh = new THREE.InstancedMesh(pointGeometry, pointBMaterial, this.capacity);
    this.pointBMesh.count = 0;
    this.pointBMesh.frustumCulled = false;
    this.pointBMesh.renderOrder = 5;
    this.pointBMesh.visible = false;
    scene.add(this.pointBMesh);
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) {
      this.clear();
      return;
    }
    this.connectorMesh.visible = true;
    this.pointAMesh.visible = true;
    this.pointBMesh.visible = true;
  }

  clear(): void {
    this.connectorMesh.visible = false;
    this.pointAMesh.visible = false;
    this.pointBMesh.visible = false;
  }

  requestUpdate(physics: PhysicsEngine): void {
    if (!this.enabled) return;
    if (!this.gpuVisualsBound) {
      const renderBuffers = physics.getContactRenderBuffers();
      if (!renderBuffers) return;

      const positions = storage(renderBuffers.positions, 'vec4', physics.config.maxBodies).toReadOnly();
      const quaternions = storage(renderBuffers.quaternions, 'vec4', physics.config.maxBodies).toReadOnly();
      const pairContacts = storage(
        renderBuffers.pairContacts,
        'vec4',
        renderBuffers.maxPairContacts * CONTACT_RECORD_VEC4S,
      ).toReadOnly();
      const pairActivity = storage(renderBuffers.pairActivity, 'uint', renderBuffers.pairActivityWordCount).toReadOnly();

      const idx = instanceIndex;
      const activeCount = pairActivity.element(uint(renderBuffers.pairActiveContactsOffset));
      const isListed = idx.lessThan(activeCount);
      const pairSlotWord = pairActivity.element(idx.add(uint(renderBuffers.pairActiveContactsOffset + 1)));
      const pairIndex = select(isListed, pairSlotWord, uint(0));

      const contactBase = pairIndex.mul(uint(CONTACT_RECORD_VEC4S));
      const meta = pairContacts.element(contactBase.add(uint(CONTACT_RECORD_META_OFFSET)));
      const rowActive = meta.z.greaterThanEqual(0.5);
      const isVisible = isListed.and(rowActive);

      const iIndex = uint(meta.x);
      const jIndex = uint(meta.y);
      const posA = positions.element(iIndex).xyz;
      const posB = positions.element(jIndex).xyz;
      const quatA = quaternions.element(iIndex);
      const quatB = quaternions.element(jIndex);

      const rotateByQuat = (v: any, quat: any) => {
        const qv = quat.xyz;
        const qw = quat.w;
        const t = qv.cross(v).mul(2.0);
        return v.add(t.mul(qw)).add(qv.cross(t));
      };

      const armA = pairContacts.element(contactBase.add(uint(CONTACT_RECORD_ARM_A_OFFSET))).xyz;
      const armB = pairContacts.element(contactBase.add(uint(CONTACT_RECORD_ARM_B_OFFSET))).xyz;
      const pointA = posA.add(rotateByQuat(armA, quatA));
      const pointB = posB.add(rotateByQuat(armB, quatB));

      const hiddenPoint = vec3(0.0, -1000000.0, 0.0);
      const dotScale = select(isVisible, float(0.06), float(0.0));
      const pointACenter = select(isVisible, pointA, hiddenPoint);
      const pointBCenter = select(isVisible, pointB, hiddenPoint);

      this.pointAMaterial.positionNode = positionLocal.mul(dotScale).add(pointACenter);
      this.pointAMaterial.needsUpdate = true;
      this.pointAMesh.count = this.capacity;

      this.pointBMaterial.positionNode = positionLocal.mul(dotScale).add(pointBCenter);
      this.pointBMaterial.needsUpdate = true;
      this.pointBMesh.count = this.capacity;

      const segment = pointB.sub(pointA);
      const segmentLength = segment.length().max(float(1e-8));
      const segmentDir = segment.div(segmentLength);
      const refAxis = select(segmentDir.y.abs().greaterThan(float(0.95)), vec3(1.0, 0.0, 0.0), vec3(0.0, 1.0, 0.0));
      const axisX = refAxis.cross(segmentDir).normalize();
      const axisZ = segmentDir.cross(axisX).normalize();
      const connectorCenter = pointA.add(pointB).mul(0.5);
      const connectorRadius = select(isVisible, float(0.009), float(0.0));
      const connectorY = positionLocal.y.mul(select(isVisible, segmentLength, float(0.0)));
      const connectorOffset = axisX.mul(positionLocal.x.mul(connectorRadius))
        .add(segmentDir.mul(connectorY))
        .add(axisZ.mul(positionLocal.z.mul(connectorRadius)));
      const connectorPosition = select(isVisible, connectorCenter.add(connectorOffset), hiddenPoint);

      this.connectorMaterial.positionNode = connectorPosition;
      this.connectorMaterial.needsUpdate = true;
      this.connectorMesh.count = this.capacity;
      this.gpuVisualsBound = true;
    }

    this.connectorMesh.visible = true;
    this.pointAMesh.visible = true;
    this.pointBMesh.visible = true;
  }

  dispose(): void {
    this.connectorMesh.removeFromParent();
    this.pointAMesh.removeFromParent();
    this.pointBMesh.removeFromParent();
    this.connectorMesh.dispose();
    this.pointAMesh.dispose();
    this.pointBMesh.dispose();
    this.connectorGeometry.dispose();
    this.pointGeometry.dispose();
    this.connectorMaterial.dispose();
    this.pointAMaterial.dispose();
    this.pointBMaterial.dispose();
  }
}
