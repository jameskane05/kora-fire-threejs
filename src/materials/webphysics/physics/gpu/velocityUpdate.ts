import { StorageBufferAttribute } from 'three/webgpu';
import { storage, uniform, workgroupId, localId, wgslFn } from './tslCompat';
import { qmul, qconj, qrot } from './quatUtils';

const WORKGROUP_SIZE = 256;

export class VelocityUpdateStage {
  private kernel: any;

  constructor(
    positions: StorageBufferAttribute,
    prevPositions: StorageBufferAttribute,
    velocities: StorageBufferAttribute,
    quaternions: StorageBufferAttribute,
    prevQuaternions: StorageBufferAttribute,
    angularVelocities: StorageBufferAttribute,
    shapes: StorageBufferAttribute,
    maxBodies: number,
  ) {
    const shader = wgslFn(/* wgsl */`
      fn compute(
        positions: ptr<storage, array<vec4f>, read>,
        prevPositions: ptr<storage, array<vec4f>, read>,
        velocities: ptr<storage, array<vec4f>, read_write>,
        quaternions: ptr<storage, array<vec4f>, read>,
        prevQuaternions: ptr<storage, array<vec4f>, read>,
        angularVelocities: ptr<storage, array<vec4f>, read_write>,
        shapes: ptr<storage, array<vec4f>, read>,
        dt: f32,
        damping: f32,
        groundY: f32,
        bodyCount: u32,
        workgroupId: vec3u,
        localId: vec3u,
      ) -> void {
        let gid = workgroupId.x * ${WORKGROUP_SIZE}u + localId.x;
        if (gid >= bodyCount) { return; }

        let invMass = positions[gid].w;
        if (invMass == 0.0) { return; }

        // Pre-solve velocities (solver only modifies positions/quaternions,
        // so these buffers still hold post-integration values)
        let preSolveVel = velocities[gid].xyz;
        let preSolveAngVel = angularVelocities[gid].xyz;

        // Standard XPBD: derive velocity from position change
        let pos = positions[gid].xyz;
        let prevPos = prevPositions[gid].xyz;
        let invDt = 1.0 / dt;
        var linVel = (pos - prevPos) * invDt * damping;

        // Derive angular velocity from quaternion change
        let q = quaternions[gid];
        let qPrev = prevQuaternions[gid];
        let dq = qmul(q, qconj(qPrev));
        var w = 2.0 * dq.xyz * invDt;
        if (dq.w < 0.0) {
          w = -w;
        }
        w *= damping;

        // --- Generic XPBD velocity correction along contact normal ---
        // Compute total solver correction from position difference.
        // Integration does pos = prevPos + preSolveVel * dt, so any
        // difference from that is the solver's work.
        let preSolvePos = prevPos + preSolveVel * dt;
        let totalCorr = pos - preSolvePos;
        let corrLen = length(totalCorr);

        if (corrLen > 1e-6) {
          let n = totalCorr / corrLen;
          let vn = dot(linVel, n);            // derived normal vel (includes artifact)
          let vnPre = dot(preSolveVel, n);    // incoming normal vel before solver

          // Jitter threshold: no restitution for slow contacts
          let jitterThresh = 2.0 * 9.81 * dt;
          var e = 0.3;
          if (abs(vnPre) < jitterThresh) {
            e = 0.0;
          }

          // XPBD correction: cancel artifact, add restitution for impacts
          // Target normal velocity: bounce for impacts, zero for resting
          let vnTarget = max(-e * vnPre, 0.0);
          let deltaVn = vnTarget - vn;
          linVel += n * deltaVn;

          // Angular: for contacts, cancel solver angular artifact along
          // correction axis, preserve pre-solve spin
          let wn = dot(w, n);
          let wnPre = dot(preSolveAngVel, n);
          if (abs(wnPre) < jitterThresh) {
            // Resting: cancel solver angular artifact along this axis
            w += n * (-wn);
          }
          // For impacts (wnPre above threshold): keep derived w (collision response)
        }

        // --- Ground contact: friction + angular settling ---
        let shp = shapes[gid];
        let half = vec3f(shp.y, shp.z, shp.w);
        var nearGround = false;
        let contactThresh = 0.01;

        for (var cx = -1.0; cx <= 1.0; cx += 2.0) {
          for (var cy = -1.0; cy <= 1.0; cy += 2.0) {
            for (var cz = -1.0; cz <= 1.0; cz += 2.0) {
              let lc = vec3f(cx * half.x, cy * half.y, cz * half.z);
              let wc = pos + qrot(q, lc);
              if (wc.y < groundY + contactThresh) {
                nearGround = true;
              }
            }
          }
        }

        if (nearGround) {
          // Coulomb friction on tangential velocity
          let mu = 0.5;
          let tanVel = vec2f(linVel.x, linVel.z);
          let tanSpeed = length(tanVel);
          if (tanSpeed > 1e-6) {
            let maxFrictionDv = mu * 9.81 * dt;
            let frictionScale = max(0.0, 1.0 - maxFrictionDv / tanSpeed);
            linVel.x *= frictionScale;
            linVel.z *= frictionScale;
          }

          // Angular damping at ground contact + settle threshold
          w *= 0.8;
          if (length(w) < 0.5) {
            w = vec3f(0.0);
          }
        }

        velocities[gid] = vec4f(linVel, 0.0);
        angularVelocities[gid] = vec4f(w, 0.0);
      }
    `, [qmul, qconj, qrot]);

    this.kernel = shader({
      positions: storage(positions, 'vec4f', maxBodies).toReadOnly(),
      prevPositions: storage(prevPositions, 'vec4f', maxBodies).toReadOnly(),
      velocities: storage(velocities, 'vec4f', maxBodies),
      quaternions: storage(quaternions, 'vec4f', maxBodies).toReadOnly(),
      prevQuaternions: storage(prevQuaternions, 'vec4f', maxBodies).toReadOnly(),
      angularVelocities: storage(angularVelocities, 'vec4f', maxBodies),
      shapes: storage(shapes, 'vec4f', maxBodies).toReadOnly(),
      dt: uniform(1 / 60 / 4),
      damping: uniform(0.98),
      groundY: uniform(0.0),
      bodyCount: uniform(0),
      workgroupId,
      localId,
    }).computeKernel([WORKGROUP_SIZE, 1, 1]);
  }

  dispatch(renderer: any, bodyCount: number, dt: number): void {
    this.kernel.computeNode.parameters.dt.value = dt;
    this.kernel.computeNode.parameters.bodyCount.value = bodyCount;
    const workgroups = Math.ceil(bodyCount / WORKGROUP_SIZE);
    renderer.compute(this.kernel, [workgroups, 1, 1]);
  }
}
