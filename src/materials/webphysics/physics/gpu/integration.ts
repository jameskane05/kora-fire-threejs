import * as THREE from 'three';
import { StorageBufferAttribute } from 'three/webgpu';
import { storage, uniform, workgroupId, localId, wgslFn } from './tslCompat';
import { qmul } from './quatUtils';
import { assertStorageBufferBudget } from './bindingBudget';

const WORKGROUP_SIZE = 256;
const INERTIAL_POSE_VEC4S_PER_BODY = 4;

export class IntegrationStage {
  private kernel: any;

  constructor(
    positions: StorageBufferAttribute,
    initialPose: StorageBufferAttribute,
    inertialPose: StorageBufferAttribute,
    velocities: StorageBufferAttribute,
    prevLinearVelocities: StorageBufferAttribute,
    quaternions: StorageBufferAttribute,
    angularVelocities: StorageBufferAttribute,
    gravity: [number, number, number],
    maxBodies: number,
  ) {
    const shader = wgslFn(/* wgsl */`
      fn compute(
        positions: ptr<storage, array<vec4f>, read>,
        initialPose: ptr<storage, array<vec4f>, read_write>,
        inertialPose: ptr<storage, array<vec4f>, read_write>,
        velocities: ptr<storage, array<vec4f>, read>,
        prevLinearVelocities: ptr<storage, array<vec4f>, read>,
        quaternions: ptr<storage, array<vec4f>, read>,
        angularVelocities: ptr<storage, array<vec4f>, read>,
        gravity: vec3f,
        dt: f32,
        bodyCount: u32,
        workgroupId: vec3u,
        localId: vec3u,
      ) -> void {
        let gid = workgroupId.x * ${WORKGROUP_SIZE}u + localId.x;
        if (gid >= bodyCount) { return; }

        let poseBase = gid * 2u;
        let currentPos4 = positions[gid];
        let currentPos = currentPos4.xyz;
        let invMass = currentPos4.w;
        let currentQ = normalize(quaternions[gid]);
        initialPose[poseBase] = currentPos4;
        initialPose[poseBase + 1u] = currentQ;

        let inertialBase = gid * ${INERTIAL_POSE_VEC4S_PER_BODY}u;
        if (invMass == 0.0) {
          // Kinematic sweep: zero-mass bodies with authored velocities (hand
          // colliders) advance through each substep instead of teleporting
          // once per render frame, so contacts see their motion and fast
          // hands stop tunneling. Static bodies have zero velocity and are
          // unaffected.
          let vKin = velocities[gid].xyz;
          let wKin = angularVelocities[gid].xyz;
          let kinPos = currentPos + vKin * dt;
          let dqKin = 0.5 * qmul(vec4f(wKin, 0.0), currentQ);
          let kinQ = normalize(currentQ + dqKin * dt);
          inertialPose[inertialBase] = vec4f(kinPos, invMass);
          inertialPose[inertialBase + 1u] = kinQ;
          inertialPose[inertialBase + 2u] = vec4f(kinPos, invMass);
          inertialPose[inertialBase + 3u] = kinQ;
          return;
        }

        let v = velocities[gid].xyz;
        let prevV = prevLinearVelocities[gid].xyz;
        let w = angularVelocities[gid].xyz;
        let gravityScale = 1.0;
        let gravityLen = length(gravity);

        let inertialPos = currentPos + v * dt + gravity * (gravityScale * dt * dt);
        let dq = 0.5 * qmul(vec4f(w, 0.0), currentQ);
        let inertialQNow = normalize(currentQ + dq * dt);
        let accel = (v - prevV) / max(dt, 1e-6);
        let gravityDir = select(vec3f(0.0), gravity / gravityLen, gravityLen > 1e-6);
        let accelExt = dot(accel, gravityDir);
        let accelWeightRaw = select(0.0, accelExt / gravityLen, gravityLen > 1e-6);
        let accelWeight = clamp(accelWeightRaw, 0.0, 1.0);
        let guessPos = currentPos + v * dt + gravity * (gravityScale * accelWeight * dt * dt);

        inertialPose[inertialBase] = vec4f(inertialPos, invMass);
        inertialPose[inertialBase + 1u] = inertialQNow;
        inertialPose[inertialBase + 2u] = vec4f(guessPos, invMass);
        inertialPose[inertialBase + 3u] = inertialQNow;
      }
    `, [qmul]);

    this.kernel = shader({
      positions: storage(positions, 'vec4f', maxBodies).toReadOnly(),
      initialPose: storage(initialPose, 'vec4f', maxBodies * 2),
      inertialPose: storage(inertialPose, 'vec4f', maxBodies * INERTIAL_POSE_VEC4S_PER_BODY),
      velocities: storage(velocities, 'vec4f', maxBodies).toReadOnly(),
      prevLinearVelocities: storage(prevLinearVelocities, 'vec4f', maxBodies).toReadOnly(),
      quaternions: storage(quaternions, 'vec4f', maxBodies).toReadOnly(),
      angularVelocities: storage(angularVelocities, 'vec4f', maxBodies).toReadOnly(),
      gravity: uniform(new THREE.Vector3(...gravity)),
      dt: uniform(1 / 60 / 4),
      bodyCount: uniform(0),
      workgroupId,
      localId,
    }).computeKernel([WORKGROUP_SIZE, 1, 1]).setName('Physics Integrate + AVBD Initialize Primal Guess');
    assertStorageBufferBudget('Physics Integrate + AVBD Initialize Primal Guess', 7);
  }

  dispatch(renderer: any, bodyCount: number, dt: number): void {
    this.kernel.computeNode.parameters.bodyCount.value = bodyCount;
    this.kernel.computeNode.parameters.dt.value = dt;
    const workgroups = Math.ceil(bodyCount / WORKGROUP_SIZE);
    renderer.compute(this.kernel, [workgroups, 1, 1]);
  }
}
