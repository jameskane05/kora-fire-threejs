import { StorageBufferAttribute } from 'three/webgpu';
import { storage, uniform, workgroupId, localId, wgslFn } from './tslCompat';
import { qrot } from './quatUtils';

const WORKGROUP_SIZE = 256;

// Precompute world-space inverse inertia matrices once per substep.
// The packed layout also carries the local diagonal inverse inertia so the
// AVBD solve can optionally emulate the reference's simpler angular block.
export class DerivedInertiaStage {
  private kernel: any;

  constructor(
    quaternions: StorageBufferAttribute,
    inverseInertia: StorageBufferAttribute,
    derivedInvInertia: StorageBufferAttribute,
    maxBodies: number,
  ) {
    const shader = wgslFn(/* wgsl */`
      fn compute(
        quaternions: ptr<storage, array<vec4f>, read>,
        inverseInertia: ptr<storage, array<vec4f>, read>,
        derivedInvInertia: ptr<storage, array<vec4f>, read_write>,
        bodyCount: u32,
        workgroupId: vec3u,
        localId: vec3u,
      ) -> void {
        let gid = workgroupId.x * ${WORKGROUP_SIZE}u + localId.x;
        if (gid >= bodyCount) { return; }

        let q = quaternions[gid];
        let inv = inverseInertia[gid];
        let invI = inv.xyz;
        let invMass = inv.w;

        let c0 = qrot(q, vec3f(1.0, 0.0, 0.0));
        let c1 = qrot(q, vec3f(0.0, 1.0, 0.0));
        let c2 = qrot(q, vec3f(0.0, 0.0, 1.0));

        let m = mat3x3f(c0 * invI.x, c1 * invI.y, c2 * invI.z) *
                transpose(mat3x3f(c0, c1, c2));

        let base = gid * 3u;
        // Pack the symmetric world inverse inertia plus the local diagonal
        // inverse inertia into the existing 3xvec4 footprint.
        derivedInvInertia[base + 0u] = vec4f(m[0].x, m[0].y, m[0].z, invMass);
        derivedInvInertia[base + 1u] = vec4f(m[1].y, m[1].z, invI.x, invI.y);
        derivedInvInertia[base + 2u] = vec4f(m[2].z, invI.z, 0.0, 0.0);
      }
    `, [qrot]);

    this.kernel = shader({
      quaternions: storage(quaternions, 'vec4f', maxBodies).toReadOnly(),
      inverseInertia: storage(inverseInertia, 'vec4f', maxBodies).toReadOnly(),
      derivedInvInertia: storage(derivedInvInertia, 'vec4f', maxBodies * 3),
      bodyCount: uniform(0),
      workgroupId,
      localId,
    }).computeKernel([WORKGROUP_SIZE, 1, 1]).setName('Physics Derived Inertia');
  }

  dispatch(renderer: any, bodyCount: number): void {
    this.kernel.computeNode.parameters.bodyCount.value = bodyCount;
    if (bodyCount > 0) {
      const workgroups = Math.ceil(bodyCount / WORKGROUP_SIZE);
      renderer.compute(this.kernel, [workgroups, 1, 1]);
    }
  }
}
