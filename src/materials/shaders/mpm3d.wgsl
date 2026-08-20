// 3D MLS-MPM for the AVP materials lab.
// Clear → P2G → grid → G2P. Fixed-point atomics for WebGPU's integer-only atomics.
// Constitutive models avoid a full 3×3 SVD: neo-Hookean goo, weakly-compressible water,
// and a volume-clamp sand approximation with frictional grid damping.

const MAX_FORCES: u32 = 50u;

struct Params {
  grid_n: u32,
  num_particles: u32,
  dt: f32,
  dx: f32,
  inv_dx: f32,
  gravity: f32,
  mu0: f32,
  lambda0: f32,
  force_count: u32,
  material_paint: u32,
  _pad0: u32,
  _pad1: u32,
  // xyz = center in [0,1]^3, w = strength
  force_pos: array<vec4<f32>, 50>,
  // Orthonormal axes + extents. Sphere: force_y.w < 0 (radius = force_x.w).
  // Capsule: force_z.w < 0 (halfLen = force_x.w, radius = force_y.w). Else oriented box.
  force_x: array<vec4<f32>, 50>, // xyz = axis X (bone length), w = halfLength / radius
  force_y: array<vec4<f32>, 50>, // xyz = axis Y (width),     w = halfWidth / capsuleR (<0 ⇒ sphere)
  force_z: array<vec4<f32>, 50>, // xyz = axis Z (thickness), w = halfThick (<0 ⇒ capsule)
};

// Packed particle. F and C are column-major 3×3 stored as three vec3 + pad each...
// Use nine floats for F and nine for C (row-major) to keep layout obvious.
struct Particle {
  x: vec3<f32>,
  material: u32,       // 0 elastic/goo, 1 sand, 2 water
  v: vec3<f32>,
  jp: f32,             // plastic volume history
  // F / C row-major 3×3
  f: array<f32, 9>,
  c: array<f32, 9>,
  _pad: vec2<f32>,     // struct size multiple of 16
};

const MAT_GOO: u32 = 0u;
const MAT_SAND: u32 = 1u;
const MAT_WATER: u32 = 2u;
const FIXED_SCALE: f32 = 1.0e6;

@group(0) @binding(0) var<uniform> params: Params;
@group(0) @binding(1) var<storage, read_write> particles: array<Particle>;
// 4 atomics per node: mass, mx, my, mz
@group(0) @binding(2) var<storage, read_write> grid_acc: array<atomic<i32>>;
@group(0) @binding(3) var<storage, read_write> grid_vel: array<vec4<f32>>;
// Packed for rendering: xyz + material as f32
@group(0) @binding(4) var<storage, read_write> render_pos: array<vec4<f32>>;
// View stretch: xyz velocity (sim units / s), w unused
@group(0) @binding(5) var<storage, read_write> render_vel: array<vec4<f32>>;

fn mat_mul_vec(m: array<f32, 9>, v: vec3<f32>) -> vec3<f32> {
  return vec3<f32>(
    m[0] * v.x + m[1] * v.y + m[2] * v.z,
    m[3] * v.x + m[4] * v.y + m[5] * v.z,
    m[6] * v.x + m[7] * v.y + m[8] * v.z,
  );
}

fn mat_mul(a: array<f32, 9>, b: array<f32, 9>) -> array<f32, 9> {
  var o = array<f32, 9>(0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0);
  for (var r = 0; r < 3; r = r + 1) {
    for (var c = 0; c < 3; c = c + 1) {
      o[r * 3 + c] =
        a[r * 3 + 0] * b[0 * 3 + c] +
        a[r * 3 + 1] * b[1 * 3 + c] +
        a[r * 3 + 2] * b[2 * 3 + c];
    }
  }
  return o;
}

fn mat_transpose(a: array<f32, 9>) -> array<f32, 9> {
  return array<f32, 9>(
    a[0], a[3], a[6],
    a[1], a[4], a[7],
    a[2], a[5], a[8],
  );
}

fn mat_add(a: array<f32, 9>, b: array<f32, 9>) -> array<f32, 9> {
  var o = array<f32, 9>(0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0);
  for (var i = 0; i < 9; i = i + 1) { o[i] = a[i] + b[i]; }
  return o;
}

fn mat_scale(a: array<f32, 9>, s: f32) -> array<f32, 9> {
  var o = array<f32, 9>(0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0);
  for (var i = 0; i < 9; i = i + 1) { o[i] = a[i] * s; }
  return o;
}

fn mat_det(m: array<f32, 9>) -> f32 {
  return m[0] * (m[4] * m[8] - m[5] * m[7])
       - m[1] * (m[3] * m[8] - m[5] * m[6])
       + m[2] * (m[3] * m[7] - m[4] * m[6]);
}

fn mat_inverse(m: array<f32, 9>) -> array<f32, 9> {
  let det = mat_det(m);
  let inv = 1.0 / select(det, 1e-8, abs(det) < 1e-8);
  return array<f32, 9>(
    (m[4] * m[8] - m[5] * m[7]) * inv,
    (m[2] * m[7] - m[1] * m[8]) * inv,
    (m[1] * m[5] - m[2] * m[4]) * inv,
    (m[5] * m[6] - m[3] * m[8]) * inv,
    (m[0] * m[8] - m[2] * m[6]) * inv,
    (m[2] * m[3] - m[0] * m[5]) * inv,
    (m[3] * m[7] - m[4] * m[6]) * inv,
    (m[1] * m[6] - m[0] * m[7]) * inv,
    (m[0] * m[4] - m[1] * m[3]) * inv,
  );
}

fn weights1d(fx: f32) -> array<f32, 3> {
  return array<f32, 3>(
    0.5 * (1.5 - fx) * (1.5 - fx),
    0.75 - (fx - 1.0) * (fx - 1.0),
    0.5 * (fx - 0.5) * (fx - 0.5),
  );
}

fn node_index(n: i32, x: i32, y: i32, z: i32) -> u32 {
  return u32(x + n * (y + n * z));
}

fn scatter(n: i32, node: vec3<i32>, mass_w: f32, mom: vec3<f32>) {
  if (node.x < 0 || node.y < 0 || node.z < 0 || node.x >= n || node.y >= n || node.z >= n) {
    return;
  }
  let idx = node_index(n, node.x, node.y, node.z);
  // Cap momentum so i32 atomics cannot wrap (FIXED_SCALE=1e6 → |mom| ≲ 2e3).
  let mom_c = clamp(mom, vec3<f32>(-1800.0), vec3<f32>(1800.0));
  let mass_c = clamp(mass_w, 0.0, 1800.0);
  atomicAdd(&grid_acc[idx * 4u + 0u], i32(mass_c * FIXED_SCALE));
  atomicAdd(&grid_acc[idx * 4u + 1u], i32(mom_c.x * FIXED_SCALE));
  atomicAdd(&grid_acc[idx * 4u + 2u], i32(mom_c.y * FIXED_SCALE));
  atomicAdd(&grid_acc[idx * 4u + 3u], i32(mom_c.z * FIXED_SCALE));
}

// Neo-Hookean PK1 without polar decomposition: μ(F − F⁻ᵀ) + λ log(J) F⁻ᵀ
fn pk1_neohookean(f: array<f32, 9>, mu: f32, la: f32) -> array<f32, 9> {
  let j = clamp(mat_det(f), 1e-4, 1e3);
  let finv_t = mat_transpose(mat_inverse(f));
  // Bound volumetric stress — unbounded log(J) is what turns a hard poke into a detonation.
  let logj = clamp(log(j), -1.5, 1.5);
  var o = array<f32, 9>(0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0);
  for (var i = 0; i < 9; i = i + 1) {
    o[i] = mu * (f[i] - finv_t[i]) + la * logj * finv_t[i];
  }
  return o;
}

@compute @workgroup_size(64)
fn clear_grid(@builtin(global_invocation_id) gid: vec3<u32>) {
  let n = params.grid_n;
  let i = gid.x;
  let total = n * n * n;
  if (i >= total) { return; }
  atomicStore(&grid_acc[i * 4u + 0u], 0);
  atomicStore(&grid_acc[i * 4u + 1u], 0);
  atomicStore(&grid_acc[i * 4u + 2u], 0);
  atomicStore(&grid_acc[i * 4u + 3u], 0);
}

@compute @workgroup_size(64)
fn p2g(@builtin(global_invocation_id) gid: vec3<u32>) {
  let p = gid.x;
  if (p >= params.num_particles) { return; }
  var pt = particles[p];
  let n = i32(params.grid_n);
  let inv_dx = params.inv_dx;
  let cell = pt.x * inv_dx - 0.5;
  let base = vec3<i32>(floor(cell));
  let fx = pt.x * inv_dx - vec3<f32>(base);
  var wx = weights1d(fx.x);
  var wy = weights1d(fx.y);
  var wz = weights1d(fx.z);

  let j = max(mat_det(pt.f), 1e-6);
  var affine = pt.c;
  // MLS-MPM: affine += -4 Δt / dx² · σ  (σ = Cauchy). Same factor as the 88-line MPM.
  let k_stress = -params.dt * 4.0 * inv_dx * inv_dx;

  if (pt.material == MAT_WATER) {
    // Weakly compressible fluid — isotropic pressure only (88-line MPM form).
    let s = k_stress * params.lambda0 * (j - 1.0);
    affine[0] = affine[0] + s;
    affine[4] = affine[4] + s;
    affine[8] = affine[8] + s;
  } else if (pt.material == MAT_SAND) {
    // Cohesionless: resist compression only. Plasticity in G2P kills shear (no goo).
    if (j < 1.0) {
      let pk1 = pk1_neohookean(pt.f, params.mu0, params.lambda0);
      let ft = mat_transpose(pt.f);
      affine = mat_add(affine, mat_scale(mat_mul(pk1, ft), k_stress));
    }
  } else {
    let pk1 = pk1_neohookean(pt.f, params.mu0, params.lambda0);
    let ft = mat_transpose(pt.f);
    affine = mat_add(affine, mat_scale(mat_mul(pk1, ft), k_stress));
  }

  for (var i = 0; i < 3; i = i + 1) {
    for (var jj = 0; jj < 3; jj = jj + 1) {
      for (var k = 0; k < 3; k = k + 1) {
        let offs = vec3<i32>(i, jj, k);
        let dpos = (vec3<f32>(offs) - fx) * params.dx;
        let weight = wx[i] * wy[jj] * wz[k];
        let mom = weight * (pt.v + mat_mul_vec(affine, dpos));
        scatter(n, base + offs, weight, mom);
      }
    }
  }
}

@compute @workgroup_size(64)
fn grid_update(@builtin(global_invocation_id) gid: vec3<u32>) {
  let n = params.grid_n;
  let i = gid.x;
  let total = n * n * n;
  if (i >= total) { return; }

  let mass = f32(atomicLoad(&grid_acc[i * 4u + 0u])) / FIXED_SCALE;
  if (mass <= 1e-12) {
    grid_vel[i] = vec4<f32>(0.0);
    return;
  }
  var v = vec3<f32>(
    f32(atomicLoad(&grid_acc[i * 4u + 1u])) / FIXED_SCALE,
    f32(atomicLoad(&grid_acc[i * 4u + 2u])) / FIXED_SCALE,
    f32(atomicLoad(&grid_acc[i * 4u + 3u])) / FIXED_SCALE,
  ) / mass;

  v.y = v.y - params.dt * params.gravity;

  let ni = i32(n);
  let gx = i32(i) % ni;
  let gy = (i32(i) / ni) % ni;
  let gz = i32(i) / (ni * ni);
  let bound = 3;
  if (gx < bound && v.x < 0.0) { v.x = 0.0; }
  if (gx > ni - bound && v.x > 0.0) { v.x = 0.0; }
  if (gy < bound && v.y < 0.0) { v.y = 0.0; }
  if (gy > ni - bound && v.y > 0.0) { v.y = 0.0; }
  if (gz < bound && v.z < 0.0) { v.z = 0.0; }
  if (gz > ni - bound && v.z > 0.0) { v.z = 0.0; }

  // Coulomb floor friction — sand piles; water/goo keep sliding.
  if (params.material_paint == MAT_SAND && gy <= bound) {
    let vt = length(v.xz);
    if (vt > 1e-6) {
      let vn = max(-v.y, 0.0);
      let max_friction = 0.55 * vn + 0.08;
      let scale = max(0.0, 1.0 - max_friction / vt);
      v.x = v.x * scale;
      v.z = v.z * scale;
    } else {
      v.x = 0.0;
      v.z = 0.0;
    }
  }

  // Pillar collider — water pour only (matches the visible tank props).
  if (params.material_paint == MAT_WATER) {
    let px = (f32(gx) + 0.5) * params.dx;
    let py = (f32(gy) + 0.5) * params.dx;
    let pz = (f32(gz) + 0.5) * params.dx;
    let ddx = px - 0.62;
    let ddz = pz - 0.38;
    let rad = 0.11;
    if (ddx * ddx + ddz * ddz < rad * rad && py < 0.52) {
      let len = sqrt(ddx * ddx + ddz * ddz);
      if (len > 1e-4) {
        let nx = ddx / len;
        let nz = ddz / len;
        let vn = v.x * nx + v.z * nz;
        if (vn < 0.0) {
          v.x = v.x - vn * nx;
          v.z = v.z - vn * nz;
        }
      } else {
        v.x = 0.0;
        v.z = 0.0;
      }
      if (v.y < 0.0 && py < 0.08) { v.y = 0.0; }
    }
  }

  grid_vel[i] = vec4<f32>(v, mass);
}

fn box_sdf(local: vec3<f32>, half: vec3<f32>) -> f32 {
  let q = abs(local) - half;
  return length(max(q, vec3<f32>(0.0))) + min(max(q.x, max(q.y, q.z)), 0.0);
}

// Capsule along local +X: segment [-half_len, +half_len], radius r.
fn capsule_sdf(local: vec3<f32>, half_len: f32, r: f32) -> f32 {
  let px = clamp(local.x, -half_len, half_len);
  return length(local - vec3<f32>(px, 0.0, 0.0)) - r;
}

fn apply_forces(x: vec3<f32>, v: vec3<f32>) -> vec3<f32> {
  // Strength is a once-per-frame velocity impulse (CPU only sends forces on substep 0).
  var out_v = v;
  let n = min(params.force_count, MAX_FORCES);
  for (var i = 0u; i < n; i = i + 1u) {
    let center = params.force_pos[i].xyz;
    let strength = params.force_pos[i].w;
    let ax = params.force_x[i];
    let ay = params.force_y[i];
    let az = params.force_z[i];
    let d = x - center;

    var push = vec3<f32>(0.0);
    var weight = 0.0;

    if (ay.w < 0.0) {
      // Sphere (mouse / legacy): radius in force_x.w
      let r = max(ax.w, 1e-4);
      let dist = length(d);
      if (dist < r && dist > 1e-5) {
        weight = 1.0 - dist / r;
        push = normalize(d);
      }
    } else if (az.w < 0.0) {
      // Capsule along bone axis (fingertips).
      let axis_x = ax.xyz;
      let axis_y = ay.xyz;
      let axis_z = az.xyz;
      let half_len = max(ax.w, 1e-4);
      let r = max(ay.w, 1e-4);
      let local = vec3<f32>(dot(d, axis_x), dot(d, axis_y), dot(d, axis_z));
      let sdf = capsule_sdf(local, half_len, r);
      let shell = max(r * 0.85, 0.012);
      if (sdf < shell) {
        let e = 1e-3;
        let gx = capsule_sdf(local + vec3<f32>(e, 0.0, 0.0), half_len, r) - capsule_sdf(local - vec3<f32>(e, 0.0, 0.0), half_len, r);
        let gy = capsule_sdf(local + vec3<f32>(0.0, e, 0.0), half_len, r) - capsule_sdf(local - vec3<f32>(0.0, e, 0.0), half_len, r);
        let gz = capsule_sdf(local + vec3<f32>(0.0, 0.0, e), half_len, r) - capsule_sdf(local - vec3<f32>(0.0, 0.0, e), half_len, r);
        let grad_local = vec3<f32>(gx, gy, gz);
        let grad_len = length(grad_local);
        let n_local = select(vec3<f32>(1.0, 0.0, 0.0), grad_local / grad_len, grad_len > 1e-6);
        push = normalize(axis_x * n_local.x + axis_y * n_local.y + axis_z * n_local.z);
        weight = 1.0 - max(sdf, 0.0) / shell;
      }
    } else {
      // Oriented box (finger bones / palm). Soft shell outside the surface.
      let axis_x = ax.xyz;
      let axis_y = ay.xyz;
      let axis_z = az.xyz;
      let half = vec3<f32>(max(ax.w, 1e-4), max(ay.w, 1e-4), max(az.w, 1e-4));
      let local = vec3<f32>(dot(d, axis_x), dot(d, axis_y), dot(d, axis_z));
      let sdf = box_sdf(local, half);
      let shell = max(min(half.x, min(half.y, half.z)) * 0.85, 0.012);
      if (sdf < shell) {
        // Outward normal ≈ SDF gradient in world space.
        let e = 1e-3;
        let gx = box_sdf(local + vec3<f32>(e, 0.0, 0.0), half) - box_sdf(local - vec3<f32>(e, 0.0, 0.0), half);
        let gy = box_sdf(local + vec3<f32>(0.0, e, 0.0), half) - box_sdf(local - vec3<f32>(0.0, e, 0.0), half);
        let gz = box_sdf(local + vec3<f32>(0.0, 0.0, e), half) - box_sdf(local - vec3<f32>(0.0, 0.0, e), half);
        let grad_local = vec3<f32>(gx, gy, gz);
        let grad_len = length(grad_local);
        let n_local = select(vec3<f32>(1.0, 0.0, 0.0), grad_local / grad_len, grad_len > 1e-6);
        push = normalize(axis_x * n_local.x + axis_y * n_local.y + axis_z * n_local.z);
        // Full strength inside the bone; fall off across the outer shell.
        weight = 1.0 - max(sdf, 0.0) / shell;
      }
    }

    if (weight > 0.0) {
      out_v = out_v + push * strength * weight;
    }
  }
  return out_v;
}

fn frobenius_deviator(f: array<f32, 9>, j: f32) -> f32 {
  // ||F / J^{1/3} − I||_F — pure shape change.
  let s = pow(max(j, 1e-6), -1.0 / 3.0);
  var acc = 0.0;
  let id = array<f32, 9>(1.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 1.0);
  for (var i = 0; i < 9; i = i + 1) {
    let d = f[i] * s - id[i];
    acc = acc + d * d;
  }
  return sqrt(acc);
}

@compute @workgroup_size(64)
fn g2p(@builtin(global_invocation_id) gid: vec3<u32>) {
  let p = gid.x;
  if (p >= params.num_particles) { return; }
  var pt = particles[p];
  let n = i32(params.grid_n);
  let inv_dx = params.inv_dx;
  let cell = pt.x * inv_dx - 0.5;
  let base = vec3<i32>(floor(cell));
  let fx = pt.x * inv_dx - vec3<f32>(base);
  var wx = weights1d(fx.x);
  var wy = weights1d(fx.y);
  var wz = weights1d(fx.z);

  var new_v = vec3<f32>(0.0);
  var new_c = array<f32, 9>(0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0);

  for (var i = 0; i < 3; i = i + 1) {
    for (var jj = 0; jj < 3; jj = jj + 1) {
      for (var k = 0; k < 3; k = k + 1) {
        let offs = vec3<i32>(i, jj, k);
        let node = base + offs;
        if (node.x < 0 || node.y < 0 || node.z < 0 || node.x >= n || node.y >= n || node.z >= n) {
          continue;
        }
        let dpos = vec3<f32>(offs) - fx;
        let gv = grid_vel[node_index(n, node.x, node.y, node.z)].xyz;
        let weight = wx[i] * wy[jj] * wz[k];
        new_v = new_v + weight * gv;
        let s = 4.0 * inv_dx * weight;
        // C += s * outer(gv, dpos)
        new_c[0] = new_c[0] + s * gv.x * dpos.x;
        new_c[1] = new_c[1] + s * gv.x * dpos.y;
        new_c[2] = new_c[2] + s * gv.x * dpos.z;
        new_c[3] = new_c[3] + s * gv.y * dpos.x;
        new_c[4] = new_c[4] + s * gv.y * dpos.y;
        new_c[5] = new_c[5] + s * gv.y * dpos.z;
        new_c[6] = new_c[6] + s * gv.z * dpos.x;
        new_c[7] = new_c[7] + s * gv.z * dpos.y;
        new_c[8] = new_c[8] + s * gv.z * dpos.z;
      }
    }
  }

  new_v = apply_forces(pt.x, new_v);

  // Cap affine / velocity before F update — runaway C is the usual detonation fuse.
  for (var i = 0; i < 9; i = i + 1) {
    new_c[i] = clamp(new_c[i], -120.0, 120.0);
  }
  let spd0 = length(new_v);
  let vmax = select(40.0, 16.0, pt.material == MAT_GOO);
  if (spd0 > vmax) {
    new_v = new_v * (vmax / spd0);
  }

  pt.v = new_v;
  pt.c = new_c;
  pt.x = clamp(pt.x + params.dt * new_v, vec3<f32>(0.002), vec3<f32>(0.998));

  // F ← (I + dt C) F
  var id_dt_c = new_c;
  for (var i = 0; i < 9; i = i + 1) { id_dt_c[i] = new_c[i] * params.dt; }
  id_dt_c[0] = id_dt_c[0] + 1.0;
  id_dt_c[4] = id_dt_c[4] + 1.0;
  id_dt_c[8] = id_dt_c[8] + 1.0;
  var f_new = mat_mul(id_dt_c, pt.f);

  if (pt.material == MAT_WATER) {
    // Fluids track volume only (no elastic F). Use prior J from det(F)=s³.
    let j_old = max(mat_det(pt.f), 0.2);
    let div_v = new_c[0] + new_c[4] + new_c[8];
    let j = clamp(j_old * (1.0 + params.dt * div_v), 0.25, 1.6);
    let s = pow(j, 1.0 / 3.0);
    f_new = array<f32, 9>(s, 0.0, 0.0, 0.0, s, 0.0, 0.0, 0.0, s);
    // Light damping — keep pours lively without endless ringing.
    pt.v = pt.v * 0.998;
  } else if (pt.material == MAT_SAND) {
    var j = max(mat_det(f_new), 1e-4);
    // No tension: sand cannot pull itself together.
    if (j > 1.0) {
      j = 1.0;
    }
    j = max(j, 0.45);
    // Plastic flow: forget shear once distortion exceeds a small yield.
    let dist = frobenius_deviator(f_new, j);
    let yield_eps = 0.05;
    if (dist > yield_eps) {
      // Return toward the cone tip — isotropic packed state at volume j.
      let s = pow(j, 1.0 / 3.0);
      f_new = array<f32, 9>(s, 0.0, 0.0, 0.0, s, 0.0, 0.0, 0.0, s);
      pt.v = pt.v * 0.94;
    } else {
      let s = pow(j / max(mat_det(f_new), 1e-6), 1.0 / 3.0);
      f_new = mat_scale(f_new, s);
    }
  } else {
    // Goo: keep elastic shear for the soft-body feel, but shed energy when F goes pathological
    // so a hard poke cannot lock the blob into an irreversible explosion.
    var j = mat_det(f_new);
    if (j < 1e-4 || j != j) {
      f_new = array<f32, 9>(1.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 1.0);
      pt.v = pt.v * 0.35;
      pt.c = array<f32, 9>(0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0);
      j = 1.0;
    } else {
      let j_clamped = clamp(j, 0.4, 2.2);
      if (abs(j_clamped - j) > 1e-6) {
        let s = pow(j_clamped / j, 1.0 / 3.0);
        f_new = mat_scale(f_new, s);
        j = j_clamped;
      }
      // Soft plasticity: large shape change blends toward isotropic at the same volume.
      let dist = frobenius_deviator(f_new, j);
      let yield_soft = 0.55;
      if (dist > yield_soft) {
        let s = pow(j, 1.0 / 3.0);
        let iso = array<f32, 9>(s, 0.0, 0.0, 0.0, s, 0.0, 0.0, 0.0, s);
        let t = clamp((dist - yield_soft) / 1.2, 0.0, 0.85);
        for (var i = 0; i < 9; i = i + 1) {
          f_new[i] = mix(f_new[i], iso[i], t);
        }
        pt.v = pt.v * (1.0 - 0.28 * t);
      }
    }
  }

  pt.f = f_new;
  particles[p] = pt;

  // World offset: sim [0,1] → centered domain later on CPU/mesh; store sim pos + material.
  render_pos[p] = vec4<f32>(pt.x, f32(pt.material));
  render_vel[p] = vec4<f32>(pt.v, 0.0);
}
