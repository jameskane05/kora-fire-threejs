import { wgsl } from './tslCompat';

// Quaternion multiplication
export const qmul = wgsl(/* wgsl */`
  fn qmul(a: vec4f, b: vec4f) -> vec4f {
    return vec4f(
      a.w*b.x + a.x*b.w + a.y*b.z - a.z*b.y,
      a.w*b.y - a.x*b.z + a.y*b.w + a.z*b.x,
      a.w*b.z + a.x*b.y - a.y*b.x + a.z*b.w,
      a.w*b.w - a.x*b.x - a.y*b.y - a.z*b.z);
  }
`);

// Rotate vector by quaternion
export const qrot = wgsl(/* wgsl */`
  fn qrot(q: vec4f, v: vec3f) -> vec3f {
    let t = 2.0 * cross(q.xyz, v);
    return v + q.w * t + cross(q.xyz, t);
  }
`);

// Quaternion conjugate
export const qconj = wgsl(/* wgsl */`
  fn qconj(q: vec4f) -> vec4f {
    return vec4f(-q.xyz, q.w);
  }
`);

// OBB support point: vertex of the OBB furthest along dir
export const obbSupport = wgsl(/* wgsl */`
  fn obbSupport(pos: vec3f, q: vec4f, half: vec3f, dir: vec3f) -> vec3f {
    let localDir = qrot(qconj(q), dir);
    // Avoid WGSL sign(0.0) -> 0.0; always choose a corner for support.
    let s = vec3f(
      select(-1.0, 1.0, localDir.x >= 0.0),
      select(-1.0, 1.0, localDir.y >= 0.0),
      select(-1.0, 1.0, localDir.z >= 0.0)
    );
    return pos + qrot(q, s * half);
  }
`, [qrot, qconj]);

// World-space inverse inertia: R * diag(invI_local) * R^T
export const worldInvInertia = wgsl(/* wgsl */`
  fn worldInvInertia(q: vec4f, invI: vec3f) -> mat3x3f {
    let c0 = qrot(q, vec3f(1.0, 0.0, 0.0));
    let c1 = qrot(q, vec3f(0.0, 1.0, 0.0));
    let c2 = qrot(q, vec3f(0.0, 0.0, 1.0));
    return mat3x3f(c0 * invI.x, c1 * invI.y, c2 * invI.z) *
           transpose(mat3x3f(c0, c1, c2));
  }
`, [qrot]);
