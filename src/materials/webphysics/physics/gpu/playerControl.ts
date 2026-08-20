import * as THREE from 'three';
import { StorageBufferAttribute } from 'three/webgpu';
import { storage, uniform, wgslFn } from './tslCompat';
import {
  CONTACT_RECORD_META_OFFSET,
  CONTACT_RECORD_NORMAL_PEN_OFFSET,
  CONTACT_RECORD_VEC4S,
} from './contactRecord';

export type PlayerProbeState = {
  position: [number, number, number];
  velocity: [number, number, number];
  grounded: boolean;
};

export class PlayerControlStage {
  private readonly controlKernel: any;
  private readonly probeKernel: any;
  private readonly probeStateAttr: StorageBufferAttribute;

  constructor(
    positions: StorageBufferAttribute,
    velocities: StorageBufferAttribute,
    angularVelocities: StorageBufferAttribute,
    pairBodyContactCounts: StorageBufferAttribute,
    pairBodyContactIndices: StorageBufferAttribute,
    pairContacts: StorageBufferAttribute,
    maxBodies: number,
    maxPairContacts: number,
    maxPairContactsPerBody: number,
  ) {
    this.probeStateAttr = new StorageBufferAttribute(new Float32Array(8), 4);

    const controlShader = wgslFn(/* wgsl */`
      fn compute(
        velocities: ptr<storage, array<vec4f>, read_write>,
        angularVelocities: ptr<storage, array<vec4f>, read_write>,
        bodyCount: u32,
        bodyIndex: u32,
        targetVelocity: vec3f,
        moveGain: f32,
        jumpSpeed: f32,
        jumpRequest: u32,
        groundedHint: u32,
      ) -> void {
        if (bodyIndex >= bodyCount) { return; }

        var v = velocities[bodyIndex];
        let gain = clamp(moveGain, 0.0, 1.0);
        v.x = v.x + (targetVelocity.x - v.x) * gain;
        v.z = v.z + (targetVelocity.z - v.z) * gain;

        if (jumpRequest > 0u && groundedHint > 0u) {
          v.y = max(v.y, jumpSpeed);
        }

        velocities[bodyIndex] = vec4f(v.xyz, 0.0);
        angularVelocities[bodyIndex] = vec4f(0.0);
      }
    `);

    this.controlKernel = controlShader({
      velocities: storage(velocities, 'vec4f', maxBodies),
      angularVelocities: storage(angularVelocities, 'vec4f', maxBodies),
      bodyCount: uniform(0),
      bodyIndex: uniform(0),
      targetVelocity: uniform(new THREE.Vector3(0, 0, 0)),
      moveGain: uniform(0.4),
      jumpSpeed: uniform(6.0),
      jumpRequest: uniform(0),
      groundedHint: uniform(0),
    }).computeKernel([1, 1, 1]).setName('Player Control');

    const probeShader = wgslFn(/* wgsl */`
      fn compute(
        positions: ptr<storage, array<vec4f>, read>,
        velocities: ptr<storage, array<vec4f>, read>,
        pairBodyContactCounts: ptr<storage, array<u32>, read>,
        pairBodyContactIndices: ptr<storage, array<u32>, read>,
        pairContacts: ptr<storage, array<vec4f>, read_write>,
        probeState: ptr<storage, array<vec4f>, read_write>,
        bodyCount: u32,
        bodyIndex: u32,
      ) -> void {
        if (bodyIndex >= bodyCount) {
          probeState[0u] = vec4f(0.0);
          probeState[1u] = vec4f(0.0);
          return;
        }

        let pos = positions[bodyIndex].xyz;
        let vel = velocities[bodyIndex].xyz;

        var grounded = false;
        let contactCount = min(pairBodyContactCounts[bodyIndex] & 0xFFFFu, ${maxPairContactsPerBody}u);
        let bodyBase = bodyIndex * ${maxPairContactsPerBody}u;
        for (var k = 0u; k < ${maxPairContactsPerBody}u; k++) {
          if (k >= contactCount) { break; }
          let p = pairBodyContactIndices[bodyBase + k];
          if (p >= ${maxPairContacts}u) { continue; }

          let info = pairContacts[p * ${CONTACT_RECORD_VEC4S}u + ${CONTACT_RECORD_META_OFFSET}u];
          if (info.z < 0.5) { continue; }

          let i = u32(info.x + 0.5);
          let j = u32(info.y + 0.5);
          let ny = pairContacts[p * ${CONTACT_RECORD_VEC4S}u + ${CONTACT_RECORD_NORMAL_PEN_OFFSET}u].y;
          if ((i == bodyIndex && ny < -0.35) || (j == bodyIndex && ny > 0.35)) {
            grounded = true;
            break;
          }
        }

        let groundedF = select(0.0, 1.0, grounded);
        probeState[0u] = vec4f(pos, groundedF);
        probeState[1u] = vec4f(vel, 0.0);
      }
    `);

    this.probeKernel = probeShader({
      positions: storage(positions, 'vec4f', maxBodies).toReadOnly(),
      velocities: storage(velocities, 'vec4f', maxBodies).toReadOnly(),
      pairBodyContactCounts: storage(pairBodyContactCounts, 'uint', maxBodies).toReadOnly(),
      pairBodyContactIndices: storage(pairBodyContactIndices, 'uint', maxBodies * maxPairContactsPerBody).toReadOnly(),
      pairContacts: storage(pairContacts, 'vec4f', maxPairContacts * CONTACT_RECORD_VEC4S),
      probeState: storage(this.probeStateAttr, 'vec4f', 2),
      bodyCount: uniform(0),
      bodyIndex: uniform(0),
    }).computeKernel([1, 1, 1]).setName('Player Probe');
  }

  dispatchControl(
    renderer: any,
    bodyCount: number,
    bodyIndex: number,
    targetVelocity: [number, number, number],
    moveGain: number,
    jumpSpeed: number,
    jumpRequest: boolean,
    groundedHint: boolean,
  ): void {
    this.controlKernel.computeNode.parameters.bodyCount.value = bodyCount;
    this.controlKernel.computeNode.parameters.bodyIndex.value = bodyIndex;
    const target = this.controlKernel.computeNode.parameters.targetVelocity.value as THREE.Vector3;
    target.set(targetVelocity[0], targetVelocity[1], targetVelocity[2]);
    this.controlKernel.computeNode.parameters.moveGain.value = moveGain;
    this.controlKernel.computeNode.parameters.jumpSpeed.value = jumpSpeed;
    this.controlKernel.computeNode.parameters.jumpRequest.value = jumpRequest ? 1 : 0;
    this.controlKernel.computeNode.parameters.groundedHint.value = groundedHint ? 1 : 0;
    renderer.compute(this.controlKernel, [1, 1, 1]);
  }

  dispatchProbe(renderer: any, bodyCount: number, bodyIndex: number): void {
    this.probeKernel.computeNode.parameters.bodyCount.value = bodyCount;
    this.probeKernel.computeNode.parameters.bodyIndex.value = bodyIndex;
    renderer.compute(this.probeKernel, [1, 1, 1]);
  }

  getProbeAttribute(): StorageBufferAttribute {
    return this.probeStateAttr;
  }
}
