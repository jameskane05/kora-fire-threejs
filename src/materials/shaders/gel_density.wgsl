// Density field for gelatin surface reconstruction from MLS-MPM particles.
// clear → splat (atomic) → resolve → optional smooth.

struct Params {
  grid_n: u32,
  num_particles: u32,
  splat_radius: f32,
  density_scale: f32,
};

@group(0) @binding(0) var<uniform> params: Params;
@group(0) @binding(1) var<storage, read> particles: array<vec4<f32>>; // xyz sim, w = material
@group(0) @binding(2) var<storage, read_write> density_i: array<atomic<i32>>;
@group(0) @binding(3) var<storage, read_write> density: array<f32>;
@group(0) @binding(4) var<storage, read_write> density_tmp: array<f32>;

const FIXED: f32 = 1000.0;
const MAT_GOO: f32 = 0.5; // material id 0 → w < 0.5

fn idx3(n: u32, x: i32, y: i32, z: i32) -> u32 {
  return u32(x) + u32(y) * n + u32(z) * n * n;
}

@compute @workgroup_size(64)
fn clear_density(@builtin(global_invocation_id) gid: vec3<u32>) {
  let i = gid.x;
  let n = params.grid_n;
  let total = n * n * n;
  if (i >= total) { return; }
  atomicStore(&density_i[i], 0);
  density[i] = 0.0;
  density_tmp[i] = 0.0;
}

@compute @workgroup_size(64)
fn splat_density(@builtin(global_invocation_id) gid: vec3<u32>) {
  let p = gid.x;
  if (p >= params.num_particles) { return; }
  let pt = particles[p];
  // Only goo particles contribute (material id 0).
  if (pt.w >= MAT_GOO) { return; }

  let n = i32(params.grid_n);
  let inv = f32(n);
  let gx = pt.x * inv;
  let gy = pt.y * inv;
  let gz = pt.z * inv;
  let r = params.splat_radius;
  let r_cells = i32(ceil(r));
  let ix0 = clamp(i32(floor(gx)) - r_cells, 0, n - 1);
  let iy0 = clamp(i32(floor(gy)) - r_cells, 0, n - 1);
  let iz0 = clamp(i32(floor(gz)) - r_cells, 0, n - 1);
  let ix1 = clamp(i32(floor(gx)) + r_cells, 0, n - 1);
  let iy1 = clamp(i32(floor(gy)) + r_cells, 0, n - 1);
  let iz1 = clamp(i32(floor(gz)) + r_cells, 0, n - 1);

  for (var z = iz0; z <= iz1; z = z + 1) {
    for (var y = iy0; y <= iy1; y = y + 1) {
      for (var x = ix0; x <= ix1; x = x + 1) {
        let dx = (f32(x) + 0.5) - gx;
        let dy = (f32(y) + 0.5) - gy;
        let dz = (f32(z) + 0.5) - gz;
        let d2 = dx * dx + dy * dy + dz * dz;
        let r2 = r * r;
        if (d2 < r2) {
          // Poly6-ish compact kernel.
          let t = 1.0 - d2 / r2;
          let w = t * t * t * params.density_scale;
          atomicAdd(&density_i[idx3(params.grid_n, x, y, z)], i32(w * FIXED));
        }
      }
    }
  }
}

@compute @workgroup_size(64)
fn resolve_density(@builtin(global_invocation_id) gid: vec3<u32>) {
  let i = gid.x;
  let n = params.grid_n;
  let total = n * n * n;
  if (i >= total) { return; }
  density[i] = f32(atomicLoad(&density_i[i])) / FIXED;
}

@compute @workgroup_size(64)
fn smooth_density(@builtin(global_invocation_id) gid: vec3<u32>) {
  let i = gid.x;
  let n = params.grid_n;
  let total = n * n * n;
  if (i >= total) { return; }
  let ni = i32(n);
  let x = i32(i) % ni;
  let y = (i32(i) / ni) % ni;
  let z = i32(i) / (ni * ni);

  var acc = density[i] * 6.0;
  var w = 6.0;
  if (x > 0) { acc = acc + density[idx3(n, x - 1, y, z)]; w = w + 1.0; }
  if (x < ni - 1) { acc = acc + density[idx3(n, x + 1, y, z)]; w = w + 1.0; }
  if (y > 0) { acc = acc + density[idx3(n, x, y - 1, z)]; w = w + 1.0; }
  if (y < ni - 1) { acc = acc + density[idx3(n, x, y + 1, z)]; w = w + 1.0; }
  if (z > 0) { acc = acc + density[idx3(n, x, y, z - 1)]; w = w + 1.0; }
  if (z < ni - 1) { acc = acc + density[idx3(n, x, y, z + 1)]; w = w + 1.0; }
  density_tmp[i] = acc / w;
}

@compute @workgroup_size(64)
fn copy_smooth(@builtin(global_invocation_id) gid: vec3<u32>) {
  let i = gid.x;
  let total = params.grid_n * params.grid_n * params.grid_n;
  if (i >= total) { return; }
  density[i] = density_tmp[i];
}
