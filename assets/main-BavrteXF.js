import{t as e}from"./lil-gui.esm-BsdZdNnU.js";import{a as t,c as n,f as r,i,l as a,n as o,r as s,s as c,t as l}from"./solver-D9IA81Pz.js";import{a as u,c as d,d as f,i as p,l as m,n as h,o as g,r as _,s as v,u as y}from"./math-BRI2IDP5.js";var b=`// Goo-only MLS-MPM. Same constitutive model, clamps and fixed-point scale as
// src/materials/shaders/mpm3d.wgsl, restructured for throughput:
//  - P2G accumulates into a workgroup tile and flushes once per node, instead of 27×4 global
//    atomics per particle. It relies on particles being spatially sorted (sort.wgsl); a workgroup
//    whose footprint does not fit the tile falls back to direct global atomics.
//  - Only nodes that received mass are visited: scatter_global appends a node the first time its
//    mass goes non-zero, and grid_update walks that list, zeroing the accumulators as it reads them.

const MAX_FORCES: u32 = 50u;
const FIXED_SCALE: f32 = 1.0e6;
const P2G_WG: u32 = 128u;
const TILE_NODES: i32 = 1000;
const TILE_ATOMS: u32 = 4000u;

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
  grid_y: u32,
  grid_z: u32,
  vessel_count: u32,
  force_pos: array<vec4f, 50>,
  force_x: array<vec4f, 50>,
  force_y: array<vec4f, 50>,
  force_z: array<vec4f, 50>,
  // (velocity, couple): the volume's own motion and how strongly it drags particles inside it.
  force_v: array<vec4f, 50>,
  // Per vessel v < MAX_VESSELS: [2v] = (cx, cz, half thickness, point count), [2v + 1] = (reach ρ, top y, 0, 0).
  // Profile points (ρ, y), two per vec4, from 2 × MAX_VESSELS + v × 4.
  vessels: array<vec4f, 24>,
  // Per ice body k, five vec4: (centre, half extent), three axis columns with the linear
  // velocity component in w, then (ω, 0). Sim space.
  ice: array<vec4f, 80>,
  // x = ice body count, y = 1 + index of the vessel that moves as the cup (0: none)
  ice_info: vec4u,
  // The cup's frame: (base origin, 0), axis columns with the linear velocity in w, then (?, 0). Sim space.
  cup: array<vec4f, 5>,
  // x = sim y of the counter top, yz = round hole centre (sim xz), w = hole radius
  counter: vec4f,
};

const MAX_VESSELS: u32 = 4u;
const WATER_STIFFNESS: f32 = 1.5;
const WATER_TENSION: f32 = 0.2;
const VESSEL_POINTS: u32 = 8u;
const MAX_ICE: u32 = 16u;
// Momentum the grid hands each ice body, accumulated over a frame's substeps.
const IMPULSE_SCALE: f32 = 1000.0;
const ICE_FRICTION: f32 = 0.15;

struct Particle {
  x: vec4f,
  v: vec4f,
  f: mat3x3f,
  c: mat3x3f,
};

@group(0) @binding(0) var<uniform> params: Params;
@group(0) @binding(1) var<storage, read_write> particles: array<Particle>;
@group(0) @binding(2) var<storage, read_write> grid_acc: array<atomic<i32>>;
@group(0) @binding(3) var<storage, read_write> grid_vel: array<vec4f>;
// Per ice body: linear then angular momentum ×IMPULSE_SCALE.
@group(0) @binding(6) var<storage, read_write> ice_impulse: array<atomic<i32>>;

// Two node lists that alternate per substep. Header: [0] append count, [1] half being appended,
// [2] length of the list grid_update walks, [3] length of the list before it (whose grid_vel the
// clear pass zeroes). Half h starts at ACTIVE_HEADER + h × node count.
@group(0) @binding(4) var<storage, read_write> live: array<atomic<u32>>;
// Indirect args: grid_update at 0, active_clear at 3.
@group(1) @binding(0) var<storage, read_write> dispatch_args: array<u32, 6>;
const ACTIVE_HEADER: u32 = 4u;

var<workgroup> tile: array<atomic<i32>, TILE_ATOMS>;
var<workgroup> wg_min: array<atomic<i32>, 3>;
var<workgroup> wg_max: array<atomic<i32>, 3>;
var<workgroup> tile_origin: vec4<i32>;
var<workgroup> tile_ext: vec4<i32>;

fn weights1d(fx: f32) -> vec3f {
  return vec3f(
    0.5 * (1.5 - fx) * (1.5 - fx),
    0.75 - (fx - 1.0) * (fx - 1.0),
    0.5 * (fx - 0.5) * (fx - 0.5),
  );
}

fn grid_n() -> vec3<i32> {
  return vec3<i32>(i32(params.grid_n), i32(params.grid_y), i32(params.grid_z));
}

fn node_index(p: vec3<i32>) -> u32 {
  let n = grid_n();
  return u32(p.x + n.x * (p.y + n.y * p.z));
}

fn in_grid(p: vec3<i32>) -> bool {
  let n = grid_n();
  return all(p >= vec3<i32>(0)) && all(p < n);
}

// M⁻ᵀ via cofactors; singular guard matches the original mat_inverse.
fn inverse_transpose(m: mat3x3f) -> mat3x3f {
  let det = determinant(m);
  let inv = 1.0 / select(det, 1e-8, abs(det) < 1e-8);
  return mat3x3f(cross(m[1], m[2]), cross(m[2], m[0]), cross(m[0], m[1])) * inv;
}

// Neo-Hookean PK1 without polar decomposition: μ(F − F⁻ᵀ) + λ log(J) F⁻ᵀ
fn pk1_neohookean(f: mat3x3f, mu: f32, la: f32) -> mat3x3f {
  let j = clamp(determinant(f), 1e-4, 1e3);
  let finv_t = inverse_transpose(f);
  let logj = clamp(log(j), -1.5, 1.5);
  return (f - finv_t) * mu + finv_t * (la * logj);
}

// Sand is cohesionless: pressure under compression, no shear, and nothing at all in tension.
// Beer is weakly compressible: pressure from volume change only, with a little tension so a
// pour holds together as a stream instead of misting.
fn pushed_affine(pt: Particle, k_stress: f32) -> mat3x3f {
  if (pt.x.w > 1.5) {
    let j = determinant(pt.f);
    let p = params.lambda0 * WATER_STIFFNESS * (j - 1.0) * select(1.0, WATER_TENSION, j > 1.0);
    return pt.c + mat3x3f(vec3f(p, 0.0, 0.0), vec3f(0.0, p, 0.0), vec3f(0.0, 0.0, p)) * (k_stress * j);
  }
  let sand = pt.x.w > 0.5;
  if (sand && determinant(pt.f) >= 1.0) { return pt.c; }
  let mu = select(params.mu0, 0.0, sand);
  let pk1 = pk1_neohookean(pt.f, mu, params.lambda0);
  return pt.c + (pk1 * transpose(pt.f)) * k_stress;
}

fn fixed_contrib(weight: f32, mom: vec3f) -> vec4<i32> {
  // Cap so i32 atomics cannot wrap (FIXED_SCALE=1e6 → |mom| ≲ 2e3).
  let mom_c = clamp(mom, vec3f(-1800.0), vec3f(1800.0));
  let mass_c = clamp(weight, 0.0, 1800.0);
  return vec4<i32>(vec4f(mass_c, mom_c) * FIXED_SCALE);
}

fn node_count() -> u32 {
  return params.grid_n * params.grid_y * params.grid_z;
}

fn scatter_global(node: vec3<i32>, q: vec4<i32>) {
  if (!in_grid(node)) { return; }
  let ni = node_index(node);
  let idx = ni * 4u;
  if (atomicAdd(&grid_acc[idx + 0u], q.x) == 0 && q.x > 0) {
    let slot = atomicAdd(&live[0], 1u);
    atomicStore(&live[ACTIVE_HEADER + atomicLoad(&live[1]) * node_count() + slot], ni);
  }
  atomicAdd(&grid_acc[idx + 1u], q.y);
  atomicAdd(&grid_acc[idx + 2u], q.z);
  atomicAdd(&grid_acc[idx + 3u], q.w);
}

// Must be reached in uniform control flow: it synchronises the workgroup.
fn p2g_accumulate(pt: Particle, valid: bool, lid: u32) {
  let inv_dx = params.inv_dx;

  if (lid < 3u) {
    atomicStore(&wg_min[lid], 1 << 30);
    atomicStore(&wg_max[lid], -(1 << 30));
  }
  workgroupBarrier();

  var base = vec3<i32>(0);
  var fx = vec3f(0.0);
  if (valid) {
    base = vec3<i32>(floor(pt.x.xyz * inv_dx - 0.5));
    fx = pt.x.xyz * inv_dx - vec3f(base);
    atomicMin(&wg_min[0], base.x);
    atomicMin(&wg_min[1], base.y);
    atomicMin(&wg_min[2], base.z);
    atomicMax(&wg_max[0], base.x);
    atomicMax(&wg_max[1], base.y);
    atomicMax(&wg_max[2], base.z);
  }
  workgroupBarrier();

  if (lid == 0u) {
    let o = vec3<i32>(atomicLoad(&wg_min[0]), atomicLoad(&wg_min[1]), atomicLoad(&wg_min[2]));
    let hi = vec3<i32>(atomicLoad(&wg_max[0]), atomicLoad(&wg_max[1]), atomicLoad(&wg_max[2]));
    let e = max(hi - o + 3, vec3<i32>(0));
    let vol = e.x * e.y * e.z;
    let fits = vol > 0 && vol <= TILE_NODES && all(e < vec3<i32>(64));
    tile_origin = vec4<i32>(o, select(0, 1, fits));
    tile_ext = vec4<i32>(e, vol);
  }
  let origin = workgroupUniformLoad(&tile_origin);
  let ext = workgroupUniformLoad(&tile_ext);
  let use_tile = origin.w == 1;

  if (valid) {
    let wx = weights1d(fx.x);
    let wy = weights1d(fx.y);
    let wz = weights1d(fx.z);
    // MLS-MPM: affine += -4 Δt / dx² · σ  (σ = Cauchy). Same factor as the 88-line MPM.
    let k_stress = -params.dt * 4.0 * inv_dx * inv_dx;
    let affine = pushed_affine(pt, k_stress);
    let v = pt.v.xyz;

    for (var k = 0; k < 3; k++) {
      for (var jj = 0; jj < 3; jj++) {
        for (var i = 0; i < 3; i++) {
          let offs = vec3<i32>(i, jj, k);
          let dpos = (vec3f(offs) - fx) * params.dx;
          let weight = wx[i] * wy[jj] * wz[k];
          let q = fixed_contrib(weight, weight * (v + affine * dpos));
          let node = base + offs;
          if (use_tile) {
            let l = node - origin.xyz;
            let li = u32(l.x + ext.x * (l.y + ext.y * l.z)) * 4u;
            atomicAdd(&tile[li + 0u], q.x);
            atomicAdd(&tile[li + 1u], q.y);
            atomicAdd(&tile[li + 2u], q.z);
            atomicAdd(&tile[li + 3u], q.w);
          } else {
            scatter_global(node, q);
          }
        }
      }
    }
  }

  workgroupBarrier();
  if (use_tile) {
    for (var li = i32(lid); li < ext.w; li += i32(P2G_WG)) {
      let t = u32(li) * 4u;
      let q = vec4<i32>(
        atomicLoad(&tile[t + 0u]),
        atomicLoad(&tile[t + 1u]),
        atomicLoad(&tile[t + 2u]),
        atomicLoad(&tile[t + 3u]),
      );
      if (all(q == vec4<i32>(0))) { continue; }
      let node = origin.xyz + vec3<i32>(li % ext.x, (li / ext.x) % ext.y, li / (ext.x * ext.y));
      scatter_global(node, q);
    }
  }
}

// Direct global atomics, no workgroup memory: cheaper where L2 reductions are fast (NVIDIA).
fn p2g_direct_scatter(pt: Particle) {
  if (pt.x.w > 3.5) { return; }
  let inv_dx = params.inv_dx;
  let base = vec3<i32>(floor(pt.x.xyz * inv_dx - 0.5));
  let fx = pt.x.xyz * inv_dx - vec3f(base);
  let wx = weights1d(fx.x);
  let wy = weights1d(fx.y);
  let wz = weights1d(fx.z);
  let k_stress = -params.dt * 4.0 * inv_dx * inv_dx;
  let affine = pushed_affine(pt, k_stress);
  let v = pt.v.xyz;
  for (var k = 0; k < 3; k++) {
    for (var jj = 0; jj < 3; jj++) {
      for (var i = 0; i < 3; i++) {
        let offs = vec3<i32>(i, jj, k);
        let dpos = (vec3f(offs) - fx) * params.dx;
        let weight = wx[i] * wy[jj] * wz[k];
        scatter_global(base + offs, fixed_contrib(weight, weight * (v + affine * dpos)));
      }
    }
  }
}

@compute @workgroup_size(P2G_WG)
fn p2g_direct(@builtin(global_invocation_id) gid: vec3<u32>) {
  if (gid.x >= params.num_particles) { return; }
  p2g_direct_scatter(particles[gid.x]);
}

@compute @workgroup_size(P2G_WG)
fn g2p2g_direct(@builtin(global_invocation_id) gid: vec3<u32>) {
  if (gid.x >= params.num_particles) { return; }
  let src = particles[gid.x];
  if (src.x.w > 3.5) { return; }
  let pt = g2p_update(src);
  particles[gid.x] = pt;
  p2g_direct_scatter(pt);
}

@compute @workgroup_size(P2G_WG)
fn p2g(@builtin(global_invocation_id) gid: vec3<u32>, @builtin(local_invocation_index) lid: u32) {
  let in_range = gid.x < params.num_particles;
  var pt: Particle;
  var valid = false;
  if (in_range) {
    pt = particles[gid.x];
    valid = pt.x.w < 3.5;
  }
  p2g_accumulate(pt, valid, lid);
}

@compute @workgroup_size(P2G_WG)
fn g2p(@builtin(global_invocation_id) gid: vec3<u32>) {
  if (gid.x < params.num_particles && particles[gid.x].x.w < 3.5) {
    particles[gid.x] = g2p_update(particles[gid.x]);
  }
}

// After each P2G: the appended list becomes grid_update's, the one before it gets cleared.
@compute @workgroup_size(1)
fn active_finish() {
  let appended = atomicLoad(&live[0]);
  let previous = atomicLoad(&live[2]);
  atomicStore(&live[3], previous);
  atomicStore(&live[2], appended);
  atomicStore(&live[0], 0u);
  atomicStore(&live[1], 1u - atomicLoad(&live[1]));
  dispatch_args[0] = (appended + 63u) / 64u;
  dispatch_args[1] = 1u;
  dispatch_args[2] = 1u;
  dispatch_args[3] = (previous + 63u) / 64u;
  dispatch_args[4] = 1u;
  dispatch_args[5] = 1u;
}

@compute @workgroup_size(64)
fn active_clear(@builtin(global_invocation_id) gid: vec3<u32>) {
  if (gid.x >= atomicLoad(&live[3])) { return; }
  grid_vel[atomicLoad(&live[ACTIVE_HEADER + atomicLoad(&live[1]) * node_count() + gid.x])] = vec4f(0.0);
}

// One substep's G2P followed by the next substep's P2G, sharing the particle in registers.
@compute @workgroup_size(P2G_WG)
fn g2p2g(@builtin(global_invocation_id) gid: vec3<u32>, @builtin(local_invocation_index) lid: u32) {
  let in_range = gid.x < params.num_particles;
  var pt: Particle;
  var valid = false;
  if (in_range) {
    pt = particles[gid.x];
    valid = pt.x.w < 3.5;
    if (valid) {
      pt = g2p_update(pt);
      particles[gid.x] = pt;
    }
  }
  p2g_accumulate(pt, valid, lid);
}

@compute @workgroup_size(64)
fn grid_update(@builtin(global_invocation_id) gid: vec3<u32>) {
  if (gid.x >= atomicLoad(&live[2])) { return; }
  let n = grid_n();
  let i = atomicLoad(&live[ACTIVE_HEADER + (1u - atomicLoad(&live[1])) * node_count() + gid.x]);
  let rg = vec3<i32>(i32(i % params.grid_n), i32((i / params.grid_n) % params.grid_y), i32(i / (params.grid_n * params.grid_y)));

  let m = atomicExchange(&grid_acc[i * 4u + 0u], 0);
  let mx = atomicExchange(&grid_acc[i * 4u + 1u], 0);
  let my = atomicExchange(&grid_acc[i * 4u + 2u], 0);
  let mz = atomicExchange(&grid_acc[i * 4u + 3u], 0);
  let mass = f32(m) / FIXED_SCALE;
  if (mass <= 1e-12) {
    grid_vel[i] = vec4f(0.0);
    return;
  }
  var v = vec3f(f32(mx), f32(my), f32(mz)) / FIXED_SCALE / mass;
  v.y = v.y - params.dt * params.gravity;

  let g = rg;
  let bound = 3;
  if (g.x < bound && v.x < 0.0) { v.x = 0.0; }
  if (g.x > n.x - bound && v.x > 0.0) { v.x = 0.0; }
  if (g.y < bound && v.y < 0.0) { v.y = 0.0; }
  if (g.y > n.y - bound && v.y > 0.0) { v.y = 0.0; }
  if (g.z < bound && v.z < 0.0) { v.z = 0.0; }
  if (g.z > n.z - bound && v.z > 0.0) { v.z = 0.0; }
  if (v.y < 0.0 && g.y < i32(round(params.counter.x * params.inv_dx)) + bound && on_counter(vec3f(g) * params.dx)) { v.y = 0.0; }

  if (params.vessel_count > 0u) {
    let s = vessel_sdf(vec3f(g) * params.dx);
    if (s.w < 0.25 * params.dx) {
      let vn = dot(v, s.xyz);
      if (vn < 0.0) {
        let vt = v - vn * s.xyz;
        let lt = length(vt);
        v = vt * max(0.0, 1.0 - 0.35 * (-vn) / max(lt, 1e-6));
      }
    }
  }

  if (params.ice_info.x > 0u) {
    v = ice_boundary(vec3f(g) * params.dx, v, mass);
  }
  if (params.ice_info.y > 0u) {
    v = cup_boundary(vec3f(g) * params.dx, v);
  }

  grid_vel[i] = vec4f(v, mass);
}

fn on_counter(p: vec3f) -> bool {
  return distance(p.xz, params.counter.yz) > params.counter.w;
}

// The grid boundary alone lets particles creep inside a resting cube until it drops through.
fn ice_push(x: vec3f) -> vec3f {
  var p = x;
  for (var k = 0u; k < min(params.ice_info.x, MAX_ICE); k++) {
    let c = params.ice[k * 5u];
    let d = p - c.xyz;
    if (dot(d, d) > 3.0 * c.w * c.w) { continue; }
    let ax = params.ice[k * 5u + 1u].xyz;
    let ay = params.ice[k * 5u + 2u].xyz;
    let az = params.ice[k * 5u + 3u].xyz;
    let lp = vec3f(dot(d, ax), dot(d, ay), dot(d, az));
    let q = abs(lp) - vec3f(c.w);
    if (max(q.x, max(q.y, q.z)) >= 0.0) { continue; }
    let sg = select(vec3f(-1.0), vec3f(1.0), lp >= vec3f(0.0));
    if (q.x >= q.y && q.x >= q.z) {
      p -= ax * sg.x * q.x;
    } else if (q.y >= q.z) {
      p -= ay * sg.y * q.y;
    } else {
      p -= az * sg.z * q.z;
    }
  }
  return p;
}

fn add_impulse(slot: u32, value: f32) {
  atomicAdd(&ice_impulse[slot], i32(clamp(value * IMPULSE_SCALE, -2.0e6, 2.0e6)));
}

// Ice bodies are moving solid boxes: remove the grid's approach velocity relative to the surface
// and hand the momentum that took back to the body.
fn ice_boundary(p: vec3f, v_in: vec3f, mass: f32) -> vec3f {
  var v = v_in;
  for (var k = 0u; k < min(params.ice_info.x, MAX_ICE); k++) {
    let c = params.ice[k * 5u];
    let d = p - c.xyz;
    if (dot(d, d) > (c.w * 1.8 + params.dx) * (c.w * 1.8 + params.dx)) { continue; }
    let ax = params.ice[k * 5u + 1u];
    let ay = params.ice[k * 5u + 2u];
    let az = params.ice[k * 5u + 3u];
    let w = params.ice[k * 5u + 4u].xyz;
    let lp = vec3f(dot(d, ax.xyz), dot(d, ay.xyz), dot(d, az.xyz));
    let q = abs(lp) - vec3f(c.w);
    let outside = length(max(q, vec3f(0.0)));
    let sd = outside + min(max(q.x, max(q.y, q.z)), 0.0);
    if (sd > 0.5 * params.dx) { continue; }
    let sg = select(vec3f(-1.0), vec3f(1.0), lp >= vec3f(0.0));
    var ln: vec3f;
    if (outside > 1e-6) {
      ln = max(q, vec3f(0.0)) / outside * sg;
    } else if (q.x >= q.y && q.x >= q.z) {
      ln = vec3f(sg.x, 0.0, 0.0);
    } else if (q.y >= q.z) {
      ln = vec3f(0.0, sg.y, 0.0);
    } else {
      ln = vec3f(0.0, 0.0, sg.z);
    }
    let n = ax.xyz * ln.x + ay.xyz * ln.y + az.xyz * ln.z;
    let u = vec3f(ax.w, ay.w, az.w) + cross(w, d);
    let rel = v - u;
    let vn = dot(rel, n);
    if (vn >= 0.0) { continue; }
    let vt = rel - vn * n;
    let lt = length(vt);
    let v_new = u + vt * max(0.0, 1.0 - ICE_FRICTION * (-vn) / max(lt, 1e-6));
    let dp = (v - v_new) * mass;
    let dl = cross(d, dp);
    add_impulse(k * 6u + 0u, dp.x);
    add_impulse(k * 6u + 1u, dp.y);
    add_impulse(k * 6u + 2u, dp.z);
    add_impulse(k * 6u + 3u, dl.x);
    add_impulse(k * 6u + 4u, dl.y);
    add_impulse(k * 6u + 5u, dl.z);
    v = v_new;
  }
  return v;
}

fn vessel_point(v: u32, k: u32) -> vec2f {
  let e = params.vessels[2u * MAX_VESSELS + v * 4u + k / 2u];
  return select(e.xy, e.zw, (k & 1u) == 1u);
}

// Lathe shells: the solid is everything within half-thickness of the (ρ, y) profile polyline.
// xyz = outward normal, w = signed distance to the nearest shell.
fn vessel_sdf(p: vec3f) -> vec4f {
  var best = vec4f(0.0, 1.0, 0.0, 1e9);
  for (var v = 0u; v < min(params.vessel_count, MAX_VESSELS); v++) {
    if (v + 1u == params.ice_info.y) { continue; }
    let s = lathe_sdf(v, p.xz - params.vessels[2u * v].xy, p.y - params.counter.x);
    if (s.w < best.w) { best = s; }
  }
  return best;
}

// One lathe about its own axis: rel is the horizontal offset from the axis, y the height.
fn lathe_sdf(v: u32, rel: vec2f, y: f32) -> vec4f {
  let h = params.vessels[2u * v];
  let b = params.vessels[2u * v + 1u];
  let rho = length(rel);
  if (rho > b.x || y > b.y || y < -b.x) { return vec4f(0.0, 1.0, 0.0, 1e9); }
  let q = vec2f(rho, y);
  var dmin = 1e9;
  var near = q;
  let count = min(u32(h.w), VESSEL_POINTS);
  var a = vessel_point(v, 0u);
  for (var k = 1u; k < count; k++) {
    let c = vessel_point(v, k);
    let ab = c - a;
    let t = clamp(dot(q - a, ab) / max(dot(ab, ab), 1e-10), 0.0, 1.0);
    let on = a + ab * t;
    let d = distance(q, on);
    if (d < dmin) { dmin = d; near = on; }
    a = c;
  }
  let g2 = select(vec2f(0.0, 1.0), (q - near) / dmin, dmin > 1e-6);
  let radial = select(vec2f(1.0, 0.0), rel / rho, rho > 1e-6);
  return vec4f(radial.x * g2.x, g2.y, radial.y * g2.x, dmin - h.z);
}

struct CupHit {
  n: vec3f,
  sd: f32,
  // Offset from the cup origin, for the wall velocity.
  d: vec3f,
};

fn cup_hit(p: vec3f) -> CupHit {
  let d = p - params.cup[0].xyz;
  let ax = params.cup[1].xyz;
  let ay = params.cup[2].xyz;
  let az = params.cup[3].xyz;
  let s = lathe_sdf(params.ice_info.y - 1u, vec2f(dot(d, ax), dot(d, az)), dot(d, ay));
  var o: CupHit;
  o.n = ax * s.x + ay * s.y + az * s.z;
  o.sd = s.w;
  o.d = d;
  return o;
}

// The cup is kinematic: remove approach velocity relative to its moving wall, so it carries what it holds.
fn cup_boundary(p: vec3f, v: vec3f) -> vec3f {
  let hit = cup_hit(p);
  if (hit.sd >= 0.25 * params.dx) { return v; }
  let u = vec3f(params.cup[1].w, params.cup[2].w, params.cup[3].w) + cross(params.cup[4].xyz, hit.d);
  let rel = v - u;
  let vn = dot(rel, hit.n);
  if (vn >= 0.0) { return v; }
  let vt = rel - vn * hit.n;
  let lt = length(vt);
  return u + vt * max(0.0, 1.0 - 0.35 * (-vn) / max(lt, 1e-6));
}

// A tilted or fast-moving wall is only ~1.5 cells thick; project particles that end up inside it.
fn cup_push(x: vec3f) -> vec3f {
  let hit = cup_hit(x);
  if (hit.sd >= 0.0) { return x; }
  return x - hit.n * hit.sd;
}

fn box_sdf(local: vec3f, half: vec3f) -> f32 {
  let q = abs(local) - half;
  return length(max(q, vec3f(0.0))) + min(max(q.x, max(q.y, q.z)), 0.0);
}

// Capsule along local +X: segment [-half_len, +half_len], radius r.
fn capsule_sdf(local: vec3f, half_len: f32, r: f32) -> f32 {
  let px = clamp(local.x, -half_len, half_len);
  return length(local - vec3f(px, 0.0, 0.0)) - r;
}

fn apply_forces(x: vec3f, v: vec3f) -> vec3f {
  var out_v = v;
  let count = min(params.force_count, MAX_FORCES);
  for (var i = 0u; i < count; i++) {
    let center = params.force_pos[i].xyz;
    let strength = params.force_pos[i].w;
    let ax = params.force_x[i];
    let ay = params.force_y[i];
    let az = params.force_z[i];
    let fv = params.force_v[i];
    let d = x - center;

    var push = vec3f(0.0);
    var weight = 0.0;

    if (ay.w < 0.0) {
      let r = max(ax.w, 1e-4);
      let dist = length(d);
      if (az.w < 0.0) {
        if (dist < r) {
          let w = 1.0 - dist / r;
          out_v = mix(out_v, fv.xyz, clamp(fv.w * w * (2.0 - w), 0.0, 1.0));
        }
        continue;
      }
      if (dist < r && dist > 1e-5) {
        weight = 1.0 - dist / r;
        push = normalize(d);
      }
    } else if (az.w < 0.0) {
      let half_len = max(ax.w, 1e-4);
      let r = max(ay.w, 1e-4);
      let local = vec3f(dot(d, ax.xyz), dot(d, ay.xyz), dot(d, az.xyz));
      let sdf = capsule_sdf(local, half_len, r);
      let shell = max(r * 0.85, 0.012);
      if (sdf < shell) {
        let e = 1e-3;
        let grad_local = vec3f(
          capsule_sdf(local + vec3f(e, 0.0, 0.0), half_len, r) - capsule_sdf(local - vec3f(e, 0.0, 0.0), half_len, r),
          capsule_sdf(local + vec3f(0.0, e, 0.0), half_len, r) - capsule_sdf(local - vec3f(0.0, e, 0.0), half_len, r),
          capsule_sdf(local + vec3f(0.0, 0.0, e), half_len, r) - capsule_sdf(local - vec3f(0.0, 0.0, e), half_len, r),
        );
        let grad_len = length(grad_local);
        let n_local = select(vec3f(1.0, 0.0, 0.0), grad_local / grad_len, grad_len > 1e-6);
        push = normalize(ax.xyz * n_local.x + ay.xyz * n_local.y + az.xyz * n_local.z);
        weight = 1.0 - max(sdf, 0.0) / shell;
      }
    } else {
      let half = vec3f(max(ax.w, 1e-4), max(ay.w, 1e-4), max(az.w, 1e-4));
      let local = vec3f(dot(d, ax.xyz), dot(d, ay.xyz), dot(d, az.xyz));
      let sdf = box_sdf(local, half);
      let shell = max(min(half.x, min(half.y, half.z)) * 0.85, 0.012);
      if (sdf < shell) {
        let e = 1e-3;
        let grad_local = vec3f(
          box_sdf(local + vec3f(e, 0.0, 0.0), half) - box_sdf(local - vec3f(e, 0.0, 0.0), half),
          box_sdf(local + vec3f(0.0, e, 0.0), half) - box_sdf(local - vec3f(0.0, e, 0.0), half),
          box_sdf(local + vec3f(0.0, 0.0, e), half) - box_sdf(local - vec3f(0.0, 0.0, e), half),
        );
        let grad_len = length(grad_local);
        let n_local = select(vec3f(1.0, 0.0, 0.0), grad_local / grad_len, grad_len > 1e-6);
        push = normalize(ax.xyz * n_local.x + ay.xyz * n_local.y + az.xyz * n_local.z);
        weight = 1.0 - max(sdf, 0.0) / shell;
      }
    }

    if (weight > 0.0) {
      if (fv.w > 0.0) {
        // In the bone's frame: no velocity into it, and tangential slip damped toward its motion.
        var rel = out_v - fv.xyz;
        let vn = dot(rel, push);
        rel -= push * min(vn, 0.0) * min(1.0, weight * 2.0);
        let slip = rel - push * dot(rel, push);
        rel -= slip * clamp(fv.w * weight, 0.0, 1.0);
        out_v = fv.xyz + rel;
      }
      out_v = out_v + push * strength * weight;
    }
  }
  return out_v;
}

fn frobenius_deviator(f: mat3x3f, j: f32) -> f32 {
  // ||F / J^{1/3} − I||_F — pure shape change.
  let s = pow(max(j, 1e-6), -1.0 / 3.0);
  let d0 = f[0] * s - vec3f(1.0, 0.0, 0.0);
  let d1 = f[1] * s - vec3f(0.0, 1.0, 0.0);
  let d2 = f[2] * s - vec3f(0.0, 0.0, 1.0);
  return sqrt(dot(d0, d0) + dot(d1, d1) + dot(d2, d2));
}

fn clamp_mat(m: mat3x3f, lo: f32, hi: f32) -> mat3x3f {
  return mat3x3f(clamp(m[0], vec3f(lo), vec3f(hi)), clamp(m[1], vec3f(lo), vec3f(hi)), clamp(m[2], vec3f(lo), vec3f(hi)));
}

fn g2p_update(pt_in: Particle) -> Particle {
  var pt = pt_in;
  let inv_dx = params.inv_dx;
  let base = vec3<i32>(floor(pt.x.xyz * inv_dx - 0.5));
  let fx = pt.x.xyz * inv_dx - vec3f(base);
  let wx = weights1d(fx.x);
  let wy = weights1d(fx.y);
  let wz = weights1d(fx.z);

  var new_v = vec3f(0.0);
  var c0 = vec3f(0.0);
  var c1 = vec3f(0.0);
  var c2 = vec3f(0.0);

  for (var k = 0; k < 3; k++) {
    for (var jj = 0; jj < 3; jj++) {
      for (var i = 0; i < 3; i++) {
        let offs = vec3<i32>(i, jj, k);
        let node = base + offs;
        if (!in_grid(node)) { continue; }
        let dpos = vec3f(offs) - fx;
        let gv = grid_vel[node_index(node)].xyz;
        let weight = wx[i] * wy[jj] * wz[k];
        new_v += weight * gv;
        // C += s · gv ⊗ dpos, accumulated by column.
        let sg = (4.0 * inv_dx * weight) * gv;
        c0 += sg * dpos.x;
        c1 += sg * dpos.y;
        c2 += sg * dpos.z;
      }
    }
  }

  if (params.force_count > 0u) {
    new_v = apply_forces(pt.x.xyz, new_v);
  }

  // Cap affine / velocity before F update — runaway C is the usual detonation fuse.
  let new_c = clamp_mat(mat3x3f(c0, c1, c2), -120.0, 120.0);
  let spd0 = length(new_v);
  let vmax = 16.0;
  if (spd0 > vmax) {
    new_v = new_v * (vmax / spd0);
  }

  var v_out = new_v;
  var c_out = new_c;
  let sand = abs(pt.x.w - 1.0) < 0.5;
  let water = pt.x.w > 1.5;
  let solid_below = on_counter(pt.x.xyz);
  let floor_y = select(0.0, params.counter.x, solid_below);
  if (sand && pt.x.y < floor_y + params.dx * 4.0) {
    let vt = length(v_out.xz);
    if (vt > 1e-6) {
      let max_friction = 0.55 * max(-v_out.y, 0.0) + 0.08;
      let scale = max(0.0, 1.0 - max_friction / vt);
      v_out.x = v_out.x * scale;
      v_out.z = v_out.z * scale;
    } else {
      v_out.x = 0.0;
      v_out.z = 0.0;
    }
  }
  var x_out = clamp(pt.x.xyz + params.dt * v_out, vec3f(0.002), vec3f(grid_n()) * params.dx - 0.002);
  if (solid_below && pt.x.y >= params.counter.x) { x_out.y = max(x_out.y, params.counter.x + 0.002); }
  if (params.ice_info.x > 0u) {
    x_out = ice_push(x_out);
  }
  if (params.ice_info.y > 0u) {
    x_out = cup_push(x_out);
  }

  let ident = mat3x3f(1.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 1.0);
  var f_new = (ident + new_c * params.dt) * pt.f;

  if (water) {
    let wj = clamp((1.0 + params.dt * (new_c[0][0] + new_c[1][1] + new_c[2][2])) * determinant(pt.f), 0.6, 1.4);
    let s = pow(wj, 1.0 / 3.0);
    f_new = mat3x3f(vec3f(s, 0.0, 0.0), vec3f(0.0, s, 0.0), vec3f(0.0, 0.0, s));
    c_out = c_out * 0.985;
  } else if (sand) {
    var sj = max(determinant(f_new), 1e-4);
    if (sj > 1.0) { sj = 1.0; }
    sj = max(sj, 0.45);
    let dist = frobenius_deviator(f_new, sj);
    if (dist > 0.05) {
      let s = pow(sj, 1.0 / 3.0);
      f_new = mat3x3f(vec3f(s, 0.0, 0.0), vec3f(0.0, s, 0.0), vec3f(0.0, 0.0, s));
      v_out = v_out * 0.94;
    } else {
      f_new = f_new * pow(sj / max(determinant(f_new), 1e-6), 1.0 / 3.0);
    }
  } else {
  // Keep elastic shear for the soft-body feel, but shed energy when F goes pathological
  // so a hard poke cannot lock the blob into an irreversible explosion.
  var j = determinant(f_new);
  if (j < 1e-4 || j != j) {
    f_new = ident;
    v_out = v_out * 0.35;
    c_out = mat3x3f(vec3f(0.0), vec3f(0.0), vec3f(0.0));
  } else {
    let j_clamped = clamp(j, 0.4, 2.2);
    if (abs(j_clamped - j) > 1e-6) {
      f_new = f_new * pow(j_clamped / j, 1.0 / 3.0);
      j = j_clamped;
    }
    // Soft plasticity: large shape change blends toward isotropic at the same volume.
    let dist = frobenius_deviator(f_new, j);
    let yield_soft = 0.55;
    if (dist > yield_soft) {
      let s = pow(j, 1.0 / 3.0);
      let t = clamp((dist - yield_soft) / 1.2, 0.0, 0.85);
      f_new = mat3x3f(
        mix(f_new[0], vec3f(s, 0.0, 0.0), t),
        mix(f_new[1], vec3f(0.0, s, 0.0), t),
        mix(f_new[2], vec3f(0.0, 0.0, s), t),
      );
      v_out = v_out * (1.0 - 0.28 * t);
    }
  }
  }

  pt.x = vec4f(x_out, pt.x.w);
  pt.v = vec4f(v_out, 0.0);
  pt.f = f_new;
  pt.c = c_out;
  return pt;
}
`,x=`// Counting sort of particles into 4³-cell blocks, so that each P2G workgroup covers a compact\r
// footprint that fits its shared tile. Order within a block is arbitrary.\r
\r
const SCAN_WG: u32 = 256u;\r
\r
struct SortParams {\r
  num_particles: u32,\r
  grid_x: u32,\r
  num_slots: u32,\r
  inv_dx: f32,\r
  grid_y: u32,\r
  grid_z: u32,\r
  _pad0: u32,\r
  _pad1: u32,\r
};\r
\r
struct Particle {\r
  x: vec4f,\r
  v: vec4f,\r
  f: mat3x3f,\r
  c: mat3x3f,\r
};\r
\r
@group(0) @binding(0) var<uniform> sp: SortParams;\r
@group(0) @binding(1) var<storage, read> src: array<Particle>;\r
@group(0) @binding(2) var<storage, read_write> dst: array<Particle>;\r
@group(0) @binding(3) var<storage, read_write> counts: array<atomic<u32>>;\r
@group(0) @binding(4) var<storage, read_write> offsets: array<u32>;\r
@group(0) @binding(5) var<storage, read_write> keys: array<vec2u>;\r
\r
var<workgroup> partial: array<u32, SCAN_WG>;\r
\r
fn block_slot(x: vec3f) -> u32 {\r
  let n = vec3<i32>(i32(sp.grid_x), i32(sp.grid_y), i32(sp.grid_z));\r
  let cell = clamp(vec3<i32>(floor(x * sp.inv_dx - 0.5)), vec3<i32>(0), n - 1);\r
  let b = vec3u(cell / 4);\r
  let nb = (vec3u(n) + 3u) / 4u;\r
  return b.x + nb.x * (b.y + nb.y * b.z);\r
}\r
\r
@compute @workgroup_size(128)\r
fn sort_count(@builtin(global_invocation_id) gid: vec3<u32>) {\r
  let p = gid.x;\r
  if (p >= sp.num_particles) { return; }\r
  let slot = block_slot(src[p].x.xyz);\r
  keys[p] = vec2u(slot, atomicAdd(&counts[slot], 1u));\r
}\r
\r
// One workgroup: exclusive scan of the slot counts, then zero them for the next frame.\r
@compute @workgroup_size(SCAN_WG)\r
fn sort_scan(@builtin(local_invocation_index) lid: u32) {\r
  let per = (sp.num_slots + SCAN_WG - 1u) / SCAN_WG;\r
  let begin = lid * per;\r
  let end = min(begin + per, sp.num_slots);\r
  var sum = 0u;\r
  for (var i = begin; i < end; i++) {\r
    sum += atomicLoad(&counts[i]);\r
  }\r
  partial[lid] = sum;\r
  workgroupBarrier();\r
  for (var stride = 1u; stride < SCAN_WG; stride <<= 1u) {\r
    var add = 0u;\r
    if (lid >= stride) { add = partial[lid - stride]; }\r
    workgroupBarrier();\r
    partial[lid] += add;\r
    workgroupBarrier();\r
  }\r
  var run = partial[lid] - sum;\r
  for (var i = begin; i < end; i++) {\r
    let c = atomicLoad(&counts[i]);\r
    offsets[i] = run;\r
    run += c;\r
    atomicStore(&counts[i], 0u);\r
  }\r
}\r
\r
@compute @workgroup_size(128)\r
fn sort_scatter(@builtin(global_invocation_id) gid: vec3<u32>) {\r
  let p = gid.x;\r
  if (p >= sp.num_particles) { return; }\r
  let k = keys[p];\r
  dst[offsets[k.x] + k.y] = src[p];\r
}\r
`,S=`// Gel density from goo particles: splat (atomic) → resolve (+ clear) → optional smooth.
// Same kernel and scale as src/materials/shaders/gel_density.wgsl; the result lands in a
// filterable 3D texture so the raymarch gets hardware trilinear instead of eight buffer loads.
// The splat also reduces the particle AABB so the march can skip the empty part of the domain.

struct GelParams {
  grid_n: u32,
  num_particles: u32,
  splat_radius: f32,
  density_scale: f32,
  smooth_pass: u32,
  // Grid source: kernel integral of the splat it stands in for.
  mass_scale: f32,
  dx: f32,
  _pad2: u32,
  // Grid source: 6 separable taps from node i - 2 to i + 3 onto cell centre i + 0.5.
  taps_a: vec4f,
  taps_b: vec4f,
  grid_y: u32,
  grid_z: u32,
  _pad3: u32,
  _pad4: u32,
};

fn dims() -> vec3<i32> {
  return vec3<i32>(i32(gp.grid_n), i32(gp.grid_y), i32(gp.grid_z));
}

fn idx3(p: vec3<i32>) -> u32 {
  let n = dims();
  return u32(p.x + n.x * (p.y + n.y * p.z));
}

fn coord_of(i: u32) -> vec3<i32> {
  let n = dims();
  let x = i32(i) % n.x;
  let yz = i32(i) / n.x;
  return vec3<i32>(x, yz % n.y, yz / n.y);
}

fn volume() -> u32 {
  let n = dims();
  return u32(n.x * n.y * n.z);
}

@group(0) @binding(0) var<uniform> gp: GelParams;
// Particle is 8 vec4s; position is the first.
@group(0) @binding(1) var<storage, read> particles: array<vec4f>;
@group(0) @binding(2) var<storage, read_write> density_i: array<atomic<i32>>;
@group(0) @binding(3) var<storage, read_write> density: array<f32>;
@group(0) @binding(4) var density_tex: texture_storage_3d<rgba16float, write>;
// Two boxes: [0..6) gel, [6..12) beer.
@group(0) @binding(5) var<storage, read_write> bounds_i: array<atomic<i32>, 12>;
// [0..4) the two march boxes (lo, hi), [4] region origin, [5] region extent.
@group(0) @binding(6) var<storage, read_write> bounds_out: array<vec4f, 6>;
// MPM grid (xyz velocity, w mass) after the frame's last grid_update.
@group(0) @binding(7) var<storage, read> grid_vel: array<vec4f>;
@group(0) @binding(8) var<storage, read_write> density_tmp: array<f32>;
// Cells resolve and smooth visit: the union of both march boxes plus REGION_MARGIN. Texels outside
// keep stale density, which the march never reaches.
@group(1) @binding(0) var<storage, read_write> region_args: array<u32, 3>;
const REGION_MARGIN: f32 = 3.0;

const FIXED: f32 = 1000.0;
const BOUNDS_FIXED: f32 = 65536.0;
const PARTICLE_VEC4S: u32 = 8u;
// Beer splats tighter than gel so a pour stays a thin stream rather than a column.
const WATER_SPLAT: f32 = 0.55;

var<workgroup> wg_lo: array<atomic<i32>, 6>;
var<workgroup> wg_hi: array<atomic<i32>, 6>;

// Density channel per material (x.w 0 gel, 2 lager, 3 stout), or -1 for sand and parked.
fn channel_of(m: f32) -> i32 {
  if (m < 0.5) { return 0; }
  if (m > 1.5 && m < 3.5) { return i32(m + 0.5) - 1; }
  return -1;
}

fn reduce_bounds(lid: u32) {
  workgroupBarrier();
  if (lid < 6u) {
    let b = (lid / 3u) * 6u + lid % 3u;
    atomicMin(&bounds_i[b], atomicLoad(&wg_lo[lid]));
    atomicMax(&bounds_i[b + 3u], atomicLoad(&wg_hi[lid]));
  }
}

@compute @workgroup_size(64)
fn splat_density(@builtin(global_invocation_id) gid: vec3<u32>, @builtin(local_invocation_index) lid: u32) {
  let p = gid.x;
  let valid = p < gp.num_particles;
  if (lid < 6u) {
    atomicStore(&wg_lo[lid], 1 << 30);
    atomicStore(&wg_hi[lid], -(1 << 30));
  }
  workgroupBarrier();

  let ch = select(-1, channel_of(particles[p * PARTICLE_VEC4S].w), valid);
  if (ch >= 0) {
    let pos = particles[p * PARTICLE_VEC4S].xyz;
    let q = vec3<i32>(pos * BOUNDS_FIXED);
    let b = select(0u, 3u, ch > 0);
    atomicMin(&wg_lo[b], q.x);
    atomicMin(&wg_lo[b + 1u], q.y);
    atomicMin(&wg_lo[b + 2u], q.z);
    atomicMax(&wg_hi[b], q.x);
    atomicMax(&wg_hi[b + 1u], q.y);
    atomicMax(&wg_hi[b + 2u], q.z);
    let base = u32(ch) * volume();

    let n = dims();
    let g = pos / gp.dx;
    let r = select(gp.splat_radius, max(gp.splat_radius * WATER_SPLAT, 1.2), ch > 0);
    let r2 = r * r;
    let r_cells = i32(ceil(r));
    let c = vec3<i32>(floor(g));
    let lo = clamp(c - r_cells, vec3<i32>(0), n - 1);
    let hi = clamp(c + r_cells, vec3<i32>(0), n - 1);
    for (var z = lo.z; z <= hi.z; z++) {
      for (var y = lo.y; y <= hi.y; y++) {
        for (var x = lo.x; x <= hi.x; x++) {
          let d = vec3f(f32(x), f32(y), f32(z)) + 0.5 - g;
          let d2 = dot(d, d);
          if (d2 < r2) {
            // Poly6-ish compact kernel.
            let t = 1.0 - d2 / r2;
            let w = t * t * t * gp.density_scale;
            atomicAdd(&density_i[base + idx3(vec3<i32>(x, y, z))], i32(w * FIXED));
          }
        }
      }
    }
  }
  reduce_bounds(lid);
}

fn region_cell(li: u32) -> vec3<i32> {
  let e = vec3<i32>(bounds_out[5].xyz);
  let l = i32(li);
  return vec3<i32>(bounds_out[4].xyz) + vec3<i32>(l % e.x, (l / e.x) % e.y, l / (e.x * e.y));
}

fn region_volume() -> u32 {
  return u32(bounds_out[5].w);
}

@compute @workgroup_size(64)
fn resolve_density(@builtin(global_invocation_id) gid: vec3<u32>) {
  if (gid.x >= region_volume()) { return; }
  let c = region_cell(gid.x);
  let i = idx3(c);
  let n = volume();
  var d = vec3f(0.0);
  for (var c = 0u; c < 3u; c++) {
    d[c] = f32(atomicExchange(&density_i[c * n + i], 0)) / FIXED;
    density[c * n + i] = d[c];
  }
  if (gp.smooth_pass == 0u) {
    textureStore(density_tex, vec3u(c), vec4f(d, 0.0));
  }
}

fn blurred(c: vec3<i32>, n: vec3<i32>, base: u32) -> f32 {
  var acc = density[base + idx3(c)] * 6.0;
  var w = 6.0;
  if (c.x > 0) { acc += density[base + idx3(c + vec3<i32>(-1, 0, 0))]; w += 1.0; }
  if (c.x < n.x - 1) { acc += density[base + idx3(c + vec3<i32>(1, 0, 0))]; w += 1.0; }
  if (c.y > 0) { acc += density[base + idx3(c + vec3<i32>(0, -1, 0))]; w += 1.0; }
  if (c.y < n.y - 1) { acc += density[base + idx3(c + vec3<i32>(0, 1, 0))]; w += 1.0; }
  if (c.z > 0) { acc += density[base + idx3(c + vec3<i32>(0, 0, -1))]; w += 1.0; }
  if (c.z < n.z - 1) { acc += density[base + idx3(c + vec3<i32>(0, 0, 1))]; w += 1.0; }
  return acc / w;
}

@compute @workgroup_size(64)
fn smooth_density(@builtin(global_invocation_id) gid: vec3<u32>) {
  if (gid.x >= region_volume()) { return; }
  let n = dims();
  let c = region_cell(gid.x);
  let v = volume();
  textureStore(density_tex, vec3u(c), vec4f(blurred(c, n, 0u), blurred(c, n, v), blurred(c, n, 2u * v), 0.0));
}

// Grid source: the march-box AABB without the splat.
@compute @workgroup_size(64)
fn particle_bounds(@builtin(global_invocation_id) gid: vec3<u32>, @builtin(local_invocation_index) lid: u32) {
  if (lid < 6u) {
    atomicStore(&wg_lo[lid], 1 << 30);
    atomicStore(&wg_hi[lid], -(1 << 30));
  }
  workgroupBarrier();
  // Grid mass has no material, so beer is drawn as gel here.
  if (gid.x < gp.num_particles && channel_of(particles[gid.x * PARTICLE_VEC4S].w) >= 0) {
    let q = vec3<i32>(particles[gid.x * PARTICLE_VEC4S].xyz * BOUNDS_FIXED);
    atomicMin(&wg_lo[0], q.x);
    atomicMin(&wg_lo[1], q.y);
    atomicMin(&wg_lo[2], q.z);
    atomicMax(&wg_hi[0], q.x);
    atomicMax(&wg_hi[1], q.y);
    atomicMax(&wg_hi[2], q.z);
  }
  reduce_bounds(lid);
}

fn tap(k: i32) -> f32 {
  return select(gp.taps_b[max(k - 4, 0)], gp.taps_a[min(k, 3)], k < 4);
}

// Grid source, one axis per pass: node mass (quadratic B-spline P2G) convolved with a Gaussian
// sized so the total spread matches the splat kernel + smooth pass. Needs no atomics, which is
// what the splat spends most of its time on on Adreno.
@compute @workgroup_size(64)
fn mass_blur_x(@builtin(global_invocation_id) gid: vec3<u32>) {
  if (gid.x >= volume()) { return; }
  let n = dims();
  let c = coord_of(gid.x);
  var acc = 0.0;
  for (var k = 0; k < 6; k++) {
    let x = c.x - 2 + k;
    if (x >= 0 && x < n.x) { acc += tap(k) * grid_vel[idx3(vec3<i32>(x, c.y, c.z))].w; }
  }
  density[gid.x] = acc;
}

@compute @workgroup_size(64)
fn mass_blur_y(@builtin(global_invocation_id) gid: vec3<u32>) {
  if (gid.x >= volume()) { return; }
  let n = dims();
  let c = coord_of(gid.x);
  var acc = 0.0;
  for (var k = 0; k < 6; k++) {
    let y = c.y - 2 + k;
    if (y >= 0 && y < n.y) { acc += tap(k) * density[idx3(vec3<i32>(c.x, y, c.z))]; }
  }
  density_tmp[gid.x] = acc;
}

@compute @workgroup_size(64)
fn mass_blur_z(@builtin(global_invocation_id) gid: vec3<u32>) {
  if (gid.x >= volume()) { return; }
  let n = dims();
  let c = coord_of(gid.x);
  var acc = 0.0;
  for (var k = 0; k < 6; k++) {
    let z = c.z - 2 + k;
    if (z >= 0 && z < n.z) { acc += tap(k) * density_tmp[idx3(vec3<i32>(c.x, c.y, z))]; }
  }
  textureStore(density_tex, vec3u(c), vec4f(acc * gp.mass_scale, 0.0, 0.0, 0.0));
}

// Particle AABB → march box in sim units, padded by the kernel reach. Resets for the next splat.
@compute @workgroup_size(1)
fn finish_bounds() {
  let pad = (gp.splat_radius + f32(gp.smooth_pass) + 1.0) * gp.dx;
  let domain = vec3f(dims()) * gp.dx;
  var u_lo = domain;
  var u_hi = vec3f(0.0);
  for (var g = 0u; g < 2u; g++) {
    let b = g * 6u;
    let lo = vec3f(f32(atomicLoad(&bounds_i[b])), f32(atomicLoad(&bounds_i[b + 1u])), f32(atomicLoad(&bounds_i[b + 2u]))) / BOUNDS_FIXED;
    let hi = vec3f(f32(atomicLoad(&bounds_i[b + 3u])), f32(atomicLoad(&bounds_i[b + 4u])), f32(atomicLoad(&bounds_i[b + 5u]))) / BOUNDS_FIXED;
    if (all(hi >= lo)) {
      bounds_out[g * 2u] = vec4f(clamp(lo - pad, vec3f(0.0), domain), 1.0);
      bounds_out[g * 2u + 1u] = vec4f(clamp(hi + pad, vec3f(0.0), domain), 1.0);
      u_lo = min(u_lo, lo - pad);
      u_hi = max(u_hi, hi + pad);
    } else {
      bounds_out[g * 2u] = vec4f(0.0);
      bounds_out[g * 2u + 1u] = vec4f(0.0);
    }
    for (var k = 0u; k < 3u; k++) {
      atomicStore(&bounds_i[b + k], 1 << 30);
      atomicStore(&bounds_i[b + k + 3u], -(1 << 30));
    }
  }
  let n = dims();
  let lo_c = clamp(vec3<i32>(floor(u_lo / gp.dx - REGION_MARGIN)), vec3<i32>(0), n);
  let hi_c = clamp(vec3<i32>(ceil(u_hi / gp.dx + REGION_MARGIN)), vec3<i32>(0), n);
  let ext = max(hi_c - lo_c, vec3<i32>(0));
  let vol = ext.x * ext.y * ext.z;
  region_args[0] = u32(vol + 63) / 64u;
  region_args[1] = 1u;
  region_args[2] = 1u;
  bounds_out[4] = vec4f(vec3f(lo_c), 0.0);
  bounds_out[5] = vec4f(vec3f(ext), f32(vol));
}
`,C=`// Revive parked particles at the faucet (gel) and the beer taps (water), and retire what has
// fallen through the sink drain or the drip tray.
// x.w: 0 gel, 1 sand, 2 lager, 3 stout, 4 parked. Parked particles sit at y = -1 so the MPM
// kernels can skip them.

struct Particle {
  x: vec4f,
  v: vec4f,
  f: mat3x3f,
  c: mat3x3f,
};

struct Flow {
  num_particles: u32,
  spawn_count: u32,
  seed: u32,
  lager_count: u32,
  // xyz = faucet, w = jitter radius
  origin: vec4f,
  velocity: vec4f,
  // x = sim x, y = sim z, z = retire below this y, w = drain radius
  drain: vec4f,
  stout_count: u32,
  tray_hz: f32,
  _pad1: u32,
  _pad2: u32,
  lager_origin: vec4f,
  stout_origin: vec4f,
  tap_velocity: vec4f,
  // x = sim x, y = sim z, z = grate height, w = tray half width (x); tray_hz is its half depth
  tap_drain: vec4f,
};

const PARKED: f32 = 4.0;

@group(0) @binding(0) var<uniform> flow: Flow;
@group(0) @binding(1) var<storage, read_write> particles: array<Particle>;
@group(0) @binding(2) var<storage, read_write> cursor: atomic<u32>;

fn urand(i: u32) -> f32 {
  var x = i * 747796405u + 2891336453u;
  x = ((x >> ((x >> 28u) + 4u)) ^ x) * 277803737u;
  x = (x >> 22u) ^ x;
  return f32(x) * (1.0 / 4294967296.0);
}

fn park(p: u32, at: vec2f) {
  var pt: Particle;
  pt.x = vec4f(at.x, -1.0, at.y, PARKED);
  pt.v = vec4f(0.0);
  pt.f = mat3x3f(vec3f(1.0, 0.0, 0.0), vec3f(0.0, 1.0, 0.0), vec3f(0.0, 0.0, 1.0));
  pt.c = mat3x3f(vec3f(0.0), vec3f(0.0), vec3f(0.0));
  particles[p] = pt;
}

fn spawn(p: u32, ticket: u32, origin: vec4f, velocity: vec3f, material: f32) {
  let a = urand(ticket + flow.seed) * 6.2831853;
  let r = sqrt(urand(ticket * 3u + flow.seed + 19u)) * origin.w;
  var pt: Particle;
  pt.x = vec4f(origin.x + cos(a) * r, origin.y, origin.z + sin(a) * r, material);
  pt.v = vec4f(velocity, 0.0);
  pt.f = mat3x3f(vec3f(1.0, 0.0, 0.0), vec3f(0.0, 1.0, 0.0), vec3f(0.0, 0.0, 1.0));
  pt.c = mat3x3f(vec3f(0.0), vec3f(0.0), vec3f(0.0));
  particles[p] = pt;
}

@compute @workgroup_size(64)
fn flow_particles(@builtin(global_invocation_id) gid: vec3<u32>) {
  let p = gid.x;
  if (p >= flow.num_particles) { return; }
  let pt = particles[p];
  let m = pt.x.w;
  if (m < 0.5) {
    let dx = pt.x.x - flow.drain.x;
    let dz = pt.x.z - flow.drain.y;
    let r2 = dx * dx + dz * dz;
    let through = pt.x.y < flow.drain.z && r2 < 0.16 * 0.16;
    // Gel is too elastic to squeeze through the hole on its own; sip from what rests on it.
    let sipped = pt.x.y < flow.drain.z + 0.08 && r2 < 3.0 * flow.drain.w * flow.drain.w && urand(p * 9781u + flow.seed * 6271u) < 0.08;
    if (through || sipped) { park(p, flow.drain.xy); }
    return;
  }
  if (m > 1.5 && m < 3.5) {
    let dx = pt.x.x - flow.tap_drain.x;
    let dz = pt.x.z - flow.tap_drain.y;
    let in_tray = abs(dx) < flow.tap_drain.w && abs(dz) < flow.tray_hz;
    // The grate takes a share of what reaches it each frame, so a splash can pool for a moment.
    let grate = in_tray && pt.x.y < flow.tap_drain.z && urand(p * 7919u + flow.seed * 104729u) < 0.35;
    // Anything that ends up under the counter lip has gone over the edge.
    if (grate || pt.x.y < 0.004) { park(p, flow.tap_drain.xy); }
    return;
  }
  if (m < PARKED - 0.5) { return; }
  let gel = flow.spawn_count;
  let lager = flow.lager_count;
  let total = gel + lager + flow.stout_count;
  if (total == 0u) { return; }
  let ticket = atomicAdd(&cursor, 1u);
  if (ticket < gel) {
    spawn(p, ticket, flow.origin, flow.velocity.xyz, 0.0);
  } else if (ticket < gel + lager) {
    spawn(p, ticket, flow.lager_origin, flow.tap_velocity.xyz, 2.0);
  } else if (ticket < total) {
    spawn(p, ticket, flow.stout_origin, flow.tap_velocity.xyz, 3.0);
  }
}
`,w=.62,T={x:-.62,z:0,thickness:.036,profile:[[0,.03],[.16,.03],[.185,.06],[.2,.19],[.218,.235]]},E={x:0,z:0,thickness:.032,profile:[[0,.045],[.115,.045],[.125,.07],[.155,.42]]},D={x:w,z:0,thickness:.036,profile:[[.068,-.23],[.1,-.22],[.16,-.2],[.2,-.15],[.215,-.04],[.26,-.02]]},O=.235,k=D.profile[0][1]-.02,ee=1/3,A=-.07,te=[w,.545,A],ne=[w,.42,-.36],re=.15,j={radius:.022,top:.66},ie=-1.08,ae=-.3,oe=-.14,se=.1,ce=.2,le={x:ie,z:-.07,hx:.2,hz:.13,height:.06,wall:.014},M=.05,ue=[-1,1].map(e=>({outlet:[ie+e*se,.49,oe],pivot:[ie+e*se,.64,oe-.01]})),de={hx:.028,hy:.09,hz:.013},fe=[0,.172,.022],pe={x:0,y:.256,z:.01,w:.05,h:.14,d:.046},N={x0:1.12,x1:1.68,z0:-.28,z1:.28,depth:.2,wall:.02},P={count:16,size:.075,bevel:.014},me={x:0,z:-.72,width:.52,height:.38,thickness:.028,lean:.64};function he(){let{x:e,z:t,height:n,thickness:r,lean:i}=me,a=[0,Math.cos(i),-Math.sin(i)],o=[0,Math.sin(i),Math.cos(i)];return{centre:[e,a[1]*n/2+o[1]*r/2,t+a[2]*n/2+o[2]*r/2],u:[1,0,0],v:a,n:o}}function ge(e,t,n){let r=1/0,i=e.profile;for(let e=0;e+1<i.length;e++){let[a,o]=i[e],[s,c]=i[e+1],l=s-a,u=c-o,d=Math.min(1,Math.max(0,((t-a)*l+(n-o)*u)/(l*l+u*u)));r=Math.min(r,Math.hypot(t-a-l*d,n-o-u*d))}return r-e.thickness/2}function _e(e,t,n){let r=ge(T,Math.hypot(e-T.x,n-T.z),t),i=Math.hypot(e-D.x,n-D.z);return i<.235?Math.min(r,ge(D,i,t)):e>N.x0&&e<N.x1&&n>N.z0&&n<N.z1?Math.min(r,t+N.depth):Math.min(r,t)}function F(e,t){let n=[...new Set([e[2],e[3],...t.flatMap(e=>[e[2],e[3]])])].filter(t=>t>=e[2]&&t<=e[3]).sort((e,t)=>e-t),r=[];for(let i=0;i+1<n.length;i++){let a=n[i],o=n[i+1],s=(a+o)/2,c=t.filter(e=>e[2]<s&&e[3]>s).map(e=>[e[0],e[1]]).sort((e,t)=>e[0]-t[0]),l=e[0];for(let[t,n]of c)t>l&&r.push([l,Math.min(t,e[1]),a,o]),l=Math.max(l,n);l<e[1]&&r.push([l,e[1],a,o])}return r}function ve(e,t,n,r){return Array.from({length:r},(i,a)=>{let o=t-n+2*n*a/r,s=t-n+2*n*(a+1)/r,c=Math.max(Math.abs(o-t),Math.abs(s-t)),l=Math.sqrt(Math.max(0,n*n-c*c));return[e-l,e+l,o,s]}).filter(e=>e[1]>e[0])}function ye(e){return[T,E,D].map(t=>({cx:t.x+e.x/2,cz:t.z+e.z/2,halfThickness:t.thickness/2,profile:t.profile}))}var I=class{part;data=[];constructor(e=0){this.part=e}tri(e,t,n,r,i,a,o){let s=[t[0]-e[0],t[1]-e[1],t[2]-e[2]],c=[n[0]-e[0],n[1]-e[1],n[2]-e[2]],l=[s[1]*c[2]-s[2]*c[1],s[2]*c[0]-s[0]*c[2],s[0]*c[1]-s[1]*c[0]],u=l[0]*(r[0]+i[0]+a[0])+l[1]*(r[1]+i[1]+a[1])+l[2]*(r[2]+i[2]+a[2])<0?[[e,r],[n,a],[t,i]]:[[e,r],[t,i],[n,a]];for(let[e,t]of u)this.data.push(e[0],e[1],e[2],t[0],t[1],t[2],o[0],o[1],o[2],o[3],this.part)}revolve(e,t,n,r,i,a=40){for(let o=0;o<n.length;o++){let s=n[o],c=n[(o+1)%n.length],l=r[o];if(!(Math.hypot(c[0]-s[0],c[1]-s[1])<1e-6))for(let n=0;n<a;n++){let r=n/a*Math.PI*2,o=(n+1)/a*Math.PI*2,u=(n,r)=>[e+n[0]*Math.cos(r),n[1],t+n[0]*Math.sin(r)],d=e=>[l[0]*Math.cos(e),l[1],l[0]*Math.sin(e)],f=u(s,r),p=u(s,o),m=u(c,r),h=u(c,o);s[0]>1e-6&&this.tri(f,p,h,d(r),d(o),d(o),i),c[0]>1e-6&&this.tri(f,h,m,d(r),d(o),d(r),i)}}}box(e,t,n,r){for(let i=0;i<3;i++){let a=t[(i+1)%3],o=t[(i+2)%3],s=n[(i+1)%3],c=n[(i+2)%3];for(let l of[-1,1]){let u=t[i].map(e=>e*l),d=(t,r)=>e.map((e,l)=>e+u[l]*n[i]+a[l]*s*t+o[l]*c*r),f=d(-1,-1),p=d(1,-1),m=d(1,1),h=d(-1,1);this.tri(f,p,m,u,u,u,r),this.tri(f,m,h,u,u,u,r)}}}roundedCube(e,t,n,r=7){let i=e-t,a=e=>{let n=e.map(e=>Math.max(-i,Math.min(i,e))),r=e.map((e,t)=>e-n[t]),a=Math.hypot(r[0],r[1],r[2])||1,o=r.map(e=>e/a);return{p:n.map((e,n)=>e+o[n]*t),n:o}},o=t=>{let n=t/r*2-1;return Math.sign(n)*Math.abs(n)**.6*e};for(let t=0;t<3;t++)for(let i of[-1,1]){let s=(n,r)=>{let s=[0,0,0];return s[t]=i*e,s[(t+1)%3]=o(n),s[(t+2)%3]=o(r),a(s)};for(let e=0;e<r;e++)for(let t=0;t<r;t++){let r=s(e,t),i=s(e+1,t),a=s(e+1,t+1),o=s(e,t+1);this.tri(r.p,i.p,a.p,r.n,i.n,a.n,n),this.tri(r.p,a.p,o.p,r.n,a.n,o.n,n)}}}shell(e,t,n=40){let{outline:r,normals:i}=be(e.profile,e.thickness/2);this.revolve(e.x,e.z,r,i,t,n)}tube(e,t,n,r=16){let i=e.map((t,n)=>{let r=e[Math.max(0,n-1)],i=e[Math.min(e.length-1,n+1)],a=[i[0]-r[0],i[1]-r[1],i[2]-r[2]],o=Math.hypot(a[0],a[1],a[2])||1,s=[a[0]/o,a[1]/o,a[2]/o],c=[1,0,0];Math.abs(s[0])>.9&&(c=[0,0,1]);let l=[s[1]*c[2]-s[2]*c[1],s[2]*c[0]-s[0]*c[2],s[0]*c[1]-s[1]*c[0]],u=Math.hypot(l[0],l[1],l[2]),d=[l[0]/u,l[1]/u,l[2]/u];return{p:t,T:s,N:d,B:[d[1]*s[2]-d[2]*s[1],d[2]*s[0]-d[0]*s[2],d[0]*s[1]-d[1]*s[0]]}}),a=(e,n)=>{let i=n/r*Math.PI*2,a=[e.N[0]*Math.cos(i)+e.B[0]*Math.sin(i),e.N[1]*Math.cos(i)+e.B[1]*Math.sin(i),e.N[2]*Math.cos(i)+e.B[2]*Math.sin(i)];return{p:[e.p[0]+a[0]*t,e.p[1]+a[1]*t,e.p[2]+a[2]*t],n:a}};for(let e=0;e+1<i.length;e++)for(let t=0;t<r;t++){let r=a(i[e],t),o=a(i[e],t+1),s=a(i[e+1],t+1),c=a(i[e+1],t);this.tri(r.p,o.p,s.p,r.n,o.n,s.n,n),this.tri(r.p,s.p,c.p,r.n,s.n,c.n,n)}for(let[e,t]of[[i[0],-1],[i[i.length-1],1]]){let i=[e.T[0]*t,e.T[1]*t,e.T[2]*t];for(let t=0;t<r;t++)this.tri(e.p,a(e,t).p,a(e,t+1).p,i,i,i,n)}}};function be(e,t){let n=e.length,r=t=>{let n=e[t],r=e[t+1],i=r[0]-n[0],a=r[1]-n[1],o=Math.hypot(i,a);return[-a/o,i/o]},i=i=>e.map((e,a)=>{let o=r(a>0?a-1:0),s=a<n-1?r(a):r(n-2),c=o[0]+s[0],l=o[1]+s[1],u=Math.hypot(c,l)||1;c/=u,l/=u;let d=t/Math.max(.3,c*s[0]+l*s[1]);return[e[0]+i*c*d,e[1]+i*l*d]}),a=i(1),o=i(-1),s=(e,n,r=6)=>{let i=Math.atan2(n[1]-e[1],n[0]-e[0]);return Array.from({length:r-1},(n,a)=>{let o=i-Math.PI*(a+1)/r;return[e[0]+Math.cos(o)*t,e[1]+Math.sin(o)*t]})},c=[...a,...s(e[n-1],a[n-1]),...o.slice().reverse()];return e[0][0]>1e-6&&c.push(...s(e[0],o[0])),{outline:c,normals:c.map((t,n)=>{let r=c[(n+1)%c.length],i=r[0]-t[0],a=r[1]-t[1],o=Math.hypot(i,a)||1,s=a/o,l=-i/o;return xe(e,[(t[0]+r[0])/2+s*.001,(t[1]+r[1])/2+l*.001])<xe(e,[(t[0]+r[0])/2,(t[1]+r[1])/2])&&(s=-s,l=-l),[s,l]})}}function xe(e,t){let n=1/0;for(let r=0;r+1<e.length;r++){let i=e[r],a=e[r+1],o=a[0]-i[0],s=a[1]-i[1],c=Math.min(1,Math.max(0,((t[0]-i[0])*o+(t[1]-i[1])*s)/(o*o+s*s)));n=Math.min(n,Math.hypot(t[0]-i[0]-o*c,t[1]-i[1]-s*c))}return n}var L=[.86,.88,.92,1],R=[.62,.65,.7,.85],Se=[.08,.085,.1,.6],Ce=[.85,.2,.12,.1],we=[.07,.075,.09,.35],Te=[.82,.94,1.08,.4],z=[1,0,0],B=[0,1,0],V=[0,0,1];function Ee(){let e=new I;e.shell(T,[.72,.92,.84,1]),e.revolve(T.x,T.z,[[.198,.2],[.226,.2],[.226,.216],[.198,.216]],[[0,-1],[1,0],[0,1],[-1,0]],[.72,.92,.84,1]);let t=new I(18);t.shell({...E,x:0,z:0},[.86,.92,1,1]),e.data.push(...t.data);let n=new I;n.shell(D,R,48);let r=D.x,i=D.z,a=k-.02;n.revolve(r,i,[[0,a],[.075,a],[.075,a+.01],[0,a+.01]],[[0,-1],[1,0],[0,1],[-1,0]],Se,24);let[o,,s]=ne;n.revolve(o,s,[[0,0],[.06,0],[.06,.015],[.035,.03],[0,.03]],[[0,-1],[1,0],[.5,1],[0,1],[0,1]],L,24);let c=.66,l=(A-s)/2,u=s+l,d=[[o,.02,s],[o,c,s]];for(let e=1;e<=14;e++){let t=Math.PI-Math.PI*e/14;d.push([o,c+Math.sin(t)*l,u+Math.cos(t)*l])}d.push([o,te[1]+.012,A]),n.tube(d,.022,L),n.revolve(o,A,[[.012,te[1]],[.027,te[1]],[.027,te[1]+.03],[.012,te[1]+.03]],[[0,-1],[1,0],[0,1],[-1,0]],L,20),n.revolve(o,A,[[0,te[1]+.004],[.012,te[1]+.004]],[[0,-1],[0,-1]],Se,20),n.tube([[o,ne[1]-.03,s],[o,ne[1]+.03,s]],.034,L,20);let f=N,p=(f.x0+f.x1)/2,m=(f.z0+f.z1)/2,h=(f.x1-f.x0)/2,g=(f.z1-f.z0)/2,_=f.wall/2;n.box([p,-f.depth-_,m],[z,B,V],[h,_,g],R),n.box([f.x0+_,-f.depth/2,m],[z,B,V],[_,f.depth/2,g],R),n.box([f.x1-_,-f.depth/2,m],[z,B,V],[_,f.depth/2,g],R),n.box([p,-f.depth/2,f.z0+_],[z,B,V],[h,f.depth/2,_],R),n.box([p,-f.depth/2,f.z1-_],[z,B,V],[h,f.depth/2,_],R);let v=.03,y=.006;n.box([p,y/2-.004,f.z0-v/2],[z,B,V],[h+v,.007,v/2],L),n.box([p,y/2-.004,f.z1+v/2],[z,B,V],[h+v,.007,v/2],L),n.box([f.x0-v/2,y/2-.004,m],[z,B,V],[v/2,.007,g],L),n.box([f.x1+v/2,y/2-.004,m],[z,B,V],[v/2,.007,g],L);let b=he();n.box(b.centre,[b.u,b.v,b.n],[me.width/2,me.height/2,me.thickness/2],we);let x=[me.x,.012,me.z+.05];n.box(x,[z,B,V],[me.width*.3,.012,.05],we);let S=new I;for(let e=0;e<P.count;e++){let t=new I(2+e);t.roundedCube(P.size/2,P.bevel,Te),S.data.push(...t.data)}let C=new I(1);C.tube([[0,.02,0],[0,.035,re*.5],[0,.045,re]],.011,L,12),C.tube([[0,.018,0],[0,.042,0]],.03,L,16),C.revolve(0,re,Oe(.022,.045),ke(),Ce,16);{let e=le,t=e.wall/2,r=e.height/2;n.box([e.x,t,e.z],[z,B,V],[e.hx,t,e.hz],R),n.box([e.x-e.hx+t,r,e.z],[z,B,V],[t,r,e.hz],R),n.box([e.x+e.hx-t,r,e.z],[z,B,V],[t,r,e.hz],R),n.box([e.x,r,e.z-e.hz+t],[z,B,V],[e.hx-e.wall,r,t],R),n.box([e.x,r,e.z+e.hz-t],[z,B,V],[e.hx-e.wall,r,t],R);let i=e.hx-e.wall-.008,a=e.hz-e.wall-.008;for(let t=0;t<9;t++){let r=e.z-a+(t+.5)/9*2*a;n.box([e.x,M-.006,r],[z,B,V],[i,.004,a/9*.55],L)}n.box([e.x,e.wall+.002,e.z],[z,B,V],[i,.002,a],Se)}n.revolve(ie,ae,[[0,0],[.085,0],[.085,.02],[.05,.045],[0,.045]],[[0,-1],[1,0],[.6,1],[0,1],[0,1]],L,28),n.tube([[ie,.02,ae],[ie,.6,ae]],.045,L,24),n.tube([[ie-.17,.615,ae],[-.91,.615,ae]],.055,L,24);for(let e of ue){let[t,r]=e.outlet;n.tube([[t,.61,ae],[t,.61,oe]],.022,L,16),n.revolve(t,oe,[[.01,r],[.018,r],[.03,r+.05],[.03,.635],[0,.635]],[[0,-1],[1,-.25],[1,0],[0,1],[0,1]],L,20),n.revolve(t,oe,[[0,r+.004],[.01,r+.004]],[[0,-1],[0,-1]],Se,16)}let w=[[.95,.66,.14,.25],[.12,.07,.045,.3]];ue.forEach((e,t)=>{let n=new I(20+t),r=ce;n.tube([[0,-.005,0],[0,.03,0]],.02,L,16),n.revolve(0,0,[[0,.03],[.014,.03],[.02,.07],[.026,r-.025],[.022,r-.01],[0,r-.01]],[[0,-1],[1,-.15],[1,-.05],[1,.4],[0,1],[0,1]],w[t],20),n.revolve(0,0,[[0,r-.012],[.023,r-.012],[.02,.20400000000000001],[0,.20800000000000002]],[[0,-1],[1,.3],[.3,1],[0,1]],L,20),C.data.push(...n.data)});let O=de,ee=new I(19);ee.box([0,O.hy,0],[z,B,V],[O.hx,O.hy,O.hz],[.16,.15,.14,.78]),ee.box([0,O.hy*2-.011,.001],[z,B,V],[O.hx*.76,.01,O.hz*.7],L),ee.box([0,O.hy*2-.007,O.hz*.2],[z,B,V],[.007,.004,.003],Se),ee.box([0,fe[1]-.006,O.hz],[z,B,V],[.012,.005,.005],L);let j=new I(22),se=.013,pe=.007;return j.revolve(0,0,[[0,-.007],[se,-.007],[se*1.08,0],[se,pe],[0,pe]],[[0,-1],[1,-.3],[1,.3],[0,1],[-1,0]],L,20),n.data.push(...ee.data,...j.data),{opaque:new Float32Array(n.data),glass:new Float32Array(e.data),handle:new Float32Array(C.data),ice:new Float32Array(S.data)}}var De=8;function Oe(e,t){return Array.from({length:9},(n,r)=>{let i=-Math.PI/2+Math.PI*r/De;return[Math.cos(i)*e,t+Math.sin(i)*e]})}function ke(){return Array.from({length:9},(e,t)=>{let n=-Math.PI/2+Math.PI*(t+.5)/De;return[Math.cos(n),Math.sin(n)]})}var Ae={gel:0,sand:1,lager:2,stout:3,parked:4},je=144;function Me(){return{x:0,y:0,z:0,strength:0,radius:.05,isBox:!1,isCapsule:!1,hx:.05,hy:.05,hz:.05,ax:1,ay:0,az:0,bx:0,by:1,bz:0,cx:0,cy:0,cz:1,vx:0,vy:0,vz:0,couple:0,attract:!1}}function Ne(){return{gravity:100,handForce:40,gravityScale:1,handForceScale:4,mu:140,lambda:500,substeps:14,subDt:24e-5}}var Pe=128,Fe=4048,Ie=4,Le=8,Re=24,ze=4432,Be=5712,Ve=5728,He=5808,Ue=5824,We=384,Ge=1e3,Ke=class{p2gWorkgroup;tileNodes;grid;count;params=Ne();tiled=!0;sortDirect=!1;sortInterval=1;framesSinceSort=1/0;splitPasses=!1;fuse=!0;densityTexture;boundsUniform;device;particles;cur=0;paramsForce;paramsIdle;gelParams;boundsI;boundsOut;pipes;mpmGroups;sortGroups;gelGroups;flowGroups;flowUniform;flowCursor;flowData=new ArrayBuffer(je);flowSpawn=0;tapSpawn=[0,0];argsGroup;activeArgs;gelArgs;gelArgsGroup;iceImpulse;iceStaging=[];iceCopied=null;iceResult=null;paramsData=new ArrayBuffer(Ue);paramsF32=new Float32Array(this.paramsData);paramsU32=new Uint32Array(this.paramsData);gelData=new ArrayBuffer(80);gelKey=``;size;floor;start=`bar`;blockSlots;constructor(e=48,t=24576,n=128,r=1e3,i=1,a=i*2,o=0){this.p2gWorkgroup=n,this.tileNodes=r;let s=t=>Math.max(1,Math.round(e*t)),c=Math.round(e*o);this.grid={x:s(a),y:s(i)+c,z:s(i)},this.size={x:this.grid.x/e,y:this.grid.y/e,z:this.grid.z/e},this.floor=c/e,this.count=t;let l=e=>Math.ceil(e/4);this.blockSlots=l(this.grid.x)*l(this.grid.y)*l(this.grid.z)}get dx(){return this.size.x/this.grid.x}get nodeCount(){return this.grid.x*this.grid.y*this.grid.z}get particleBuffers(){return this.particles}get current(){return this.cur}async init(e){this.device=e;let t=this.nodeCount,n=GPUBufferUsage.STORAGE,r=async(t,n)=>{let r=e.createShaderModule({code:t,label:n}),i=(await r.getCompilationInfo()).messages.filter(e=>e.type===`error`);if(i.length)throw Error(`${n} WGSL:\n${i.map(e=>`${e.lineNum}:${e.linePos} ${e.message}`).join(`
`)}`);return r},i=this.p2gWorkgroup>>>0,a=this.tileNodes|0,o=b.replace(`const P2G_WG: u32 = 128u;`,`const P2G_WG: u32 = ${i}u;`).replace(`const TILE_NODES: i32 = 1000;`,`const TILE_NODES: i32 = ${a};`).replace(`const TILE_ATOMS: u32 = 4000u;`,`const TILE_ATOMS: u32 = ${a*4}u;`),[s,c,l,u]=await Promise.all([r(o,`goo-mpm`),r(x,`goo-sort`),r(S,`goo-gel`),r(C,`goo-flow`)]),d=(e,t)=>({binding:e,visibility:GPUShaderStage.COMPUTE,buffer:{type:t}}),f=e.createBindGroupLayout({entries:[d(0,`uniform`),d(1,`storage`),d(2,`storage`),d(3,`storage`),d(4,`storage`),d(6,`storage`)]}),p=e.createBindGroupLayout({entries:[d(0,`storage`)]}),m=e.createBindGroupLayout({entries:[d(0,`uniform`),d(1,`read-only-storage`),d(2,`storage`),d(3,`storage`),d(4,`storage`),d(5,`storage`)]}),h=e.createBindGroupLayout({entries:[d(0,`uniform`),d(1,`read-only-storage`),d(2,`storage`),d(3,`storage`),{binding:4,visibility:GPUShaderStage.COMPUTE,storageTexture:{access:`write-only`,format:`rgba16float`,viewDimension:`3d`}},d(5,`storage`),d(6,`storage`),d(7,`read-only-storage`),d(8,`storage`)]}),g=(t,n,r)=>e.createComputePipelineAsync({label:r,layout:e.createPipelineLayout({bindGroupLayouts:Array.isArray(n)?n:[n]}),compute:{module:t,entryPoint:r}}),_=e.createBindGroupLayout({entries:[d(0,`uniform`),d(1,`storage`),d(2,`storage`)]}),[v,y,w,T,E,D,O,k,ee,A,te,ne,re,j,ie,ae,oe,se,ce,le]=await Promise.all([g(s,f,`p2g`),g(s,f,`grid_update`),g(s,f,`g2p`),g(s,f,`g2p2g`),g(s,f,`p2g_direct`),g(s,f,`g2p2g_direct`),g(s,[f,p],`active_finish`),g(s,f,`active_clear`),g(c,m,`sort_count`),g(c,m,`sort_scan`),g(c,m,`sort_scatter`),g(l,h,`splat_density`),g(l,h,`resolve_density`),g(l,h,`smooth_density`),g(l,[h,p],`finish_bounds`),g(l,h,`particle_bounds`),g(l,h,`mass_blur_x`),g(l,h,`mass_blur_y`),g(l,h,`mass_blur_z`),g(u,_,`flow_particles`)]);this.pipes={p2g:v,grid:y,g2p:w,g2p2g:T,p2gDirect:E,g2p2gDirect:D,activeFinish:O,activeClear:k,count:ee,scan:A,scatter:te,splat:ne,resolve:re,smooth:j,bounds:ie,particleBounds:ae,blurX:oe,blurY:se,blurZ:ce,flow:le};let M=(t,n,r)=>e.createBuffer({size:t,usage:n,label:r});this.particles=[M(this.count*Pe,n|GPUBufferUsage.COPY_DST,`goo-particles-a`),M(this.count*Pe,n|GPUBufferUsage.COPY_DST,`goo-particles-b`)];let ue=M(t*16,n,`goo-grid-acc`),de=M(t*16,n,`goo-grid-vel`),fe=M((4+2*t)*4,n,`goo-active-nodes`);this.activeArgs=M(24,n|GPUBufferUsage.INDIRECT,`goo-active-args`),this.paramsForce=M(Ue,GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST,`goo-params-force`),this.paramsIdle=M(Ue,GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST,`goo-params-idle`);let pe=M(32,GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST,`goo-sort-params`),N=new ArrayBuffer(32),P=new Uint32Array(N);P[0]=this.count,P[1]=this.grid.x,P[2]=this.blockSlots,new Float32Array(N)[3]=1/this.dx,P[4]=this.grid.y,P[5]=this.grid.z,e.queue.writeBuffer(pe,0,N);let me=M(this.blockSlots*4,n,`goo-sort-counts`),he=M(this.blockSlots*4,n,`goo-sort-offsets`),ge=M(this.count*8,n,`goo-sort-keys`);this.gelParams=M(80,GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST,`goo-gel-params`);let _e=M(t*12,n,`goo-density-i`),F=M(t*12,n,`goo-density`),ve=M(t*4,n,`goo-density-tmp`);this.gelArgs=M(12,n|GPUBufferUsage.INDIRECT,`goo-gel-args`),this.boundsI=M(48,n|GPUBufferUsage.COPY_DST,`goo-bounds-i`),e.queue.writeBuffer(this.boundsI,0,new Int32Array([0,1].flatMap(()=>[1<<30,1<<30,1<<30,-1073741824,-1073741824,-1073741824]))),this.boundsOut=M(96,n|GPUBufferUsage.COPY_SRC,`goo-bounds-out`),this.boundsUniform=M(64,GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST,`goo-bounds`),this.densityTexture=e.createTexture({label:`goo-density`,size:[this.grid.x,this.grid.y,this.grid.z],dimension:`3d`,format:`rgba16float`,usage:GPUTextureUsage.STORAGE_BINDING|GPUTextureUsage.TEXTURE_BINDING});let ye=(t,n)=>e.createBindGroup({layout:t,entries:n.flatMap((e,t)=>e?[{binding:t,resource:e instanceof GPUBuffer?{buffer:e}:e}]:[])});this.iceImpulse=M(We,n|GPUBufferUsage.COPY_SRC|GPUBufferUsage.COPY_DST,`goo-ice-impulse`);for(let e=0;e<3;e++)this.iceStaging.push({buffer:M(We,GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST,`goo-ice-readback-${e}`),busy:!1});this.mpmGroups=this.particles.map(e=>[ye(f,[this.paramsForce,e,ue,de,fe,null,this.iceImpulse]),ye(f,[this.paramsIdle,e,ue,de,fe,null,this.iceImpulse])]),this.argsGroup=ye(p,[this.activeArgs]),this.sortGroups=[0,1].map(e=>ye(m,[pe,this.particles[e],this.particles[1-e],me,he,ge]));let I=this.densityTexture.createView();this.gelGroups=this.particles.map(e=>ye(h,[this.gelParams,e,_e,F,I,this.boundsI,this.boundsOut,de,ve])),this.gelArgsGroup=ye(p,[this.gelArgs]),this.flowUniform=M(je,GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST,`goo-flow`),this.flowCursor=M(4,n|GPUBufferUsage.COPY_DST,`goo-flow-cursor`),this.flowGroups=this.particles.map(e=>ye(_,[this.flowUniform,e,this.flowCursor])),this.reset()}reset(){let e=this.count,t=new ArrayBuffer(e*Pe),n=new Float32Array(t),r=Pe/4,i=0,a=(t,a,o,s)=>{if(i>=e)return;let c=i*r;n[c]=t,n[c+1]=a,n[c+2]=o,n[c+3]=s,n[c+8]=1,n[c+13]=1,n[c+18]=1,i++},o=e=>{let t=Math.sin(e*127.1)*43758.5453;return t-Math.floor(t)},s=(t,n,r)=>{let s=this.size.z/2,c=Math.min(e,i+n),l=Math.ceil(Math.cbrt(n*1.15));for(let e=0;e<l&&i<c;e++)for(let n=0;n<l&&i<c;n++){let u=n/l-.5,d=e/l-.5,f=Math.hypot(u,d);if(f>.5)continue;let p=Math.max(1,Math.floor((.5-f)/.5*l*.28));for(let e=0;e<p&&i<c;e++){let n=i*3+1;a(t+u*r*2+(o(n)-.5)*.008,this.floor+.05+e/p*.08+(o(n+1)-.5)*.004,s+d*r*2+(o(n+2)-.5)*.008,1)}}for(;i<c;){let e=o(i)*Math.PI*2,n=Math.sqrt(o(i+17))*r*.9,c=o(i+29)*.05*(1-n/r);a(t+Math.cos(e)*n,this.floor+.045+c,s+Math.sin(e)*n,1)}};if(this.start===`block`){let t=this.size.x/2,n=this.size.z/2,r=this.floor+.045,o=Math.ceil(Math.cbrt(e*1.35));for(let s=0;s<o&&i<e;s++)for(let c=0;c<o&&i<e;c++)for(let l=0;l<o&&i<e;l++){let e=(l+.5)/o*2-1,i=(c+.5)/o,u=(s+.5)/o*2-1;e*e+u*u+i*i>1||a(t+e*.3,r+i*.155,n+u*.3,Ae.gel)}for(let o=0;i<e;o++){let i=o/e,s=i*Math.PI*2*17,c=i*7.13%1*.18,l=i*3.71%1*.1;a(t+Math.cos(s)*c,r+l,n+Math.sin(s)*c,Ae.gel)}}else s(this.size.x/2+T.x,Math.floor(e/3),.1);for(;i<e;)a(this.size.x*.5,-1,this.size.z*.5,Ae.parked);this.cur=0,this.device.queue.writeBuffer(this.particles[0],0,t),this.writeParams([],1);let c=this.device.createCommandEncoder(),l=c.beginComputePass();for(let e=0;e<36;e++)this.encodeSteps(l,8,!1);l.end(),this.device.queue.submit([c.finish()])}encode(e,t,n,r,i,a){this.writeParams(n,r),this.device.queue.writeBuffer(this.flowUniform,0,this.flowData),this.device.queue.writeBuffer(this.flowCursor,0,new Uint32Array([0]));let o=e=>{this.dispatch(e,this.pipes.flow,this.flowGroups[this.cur],Math.ceil(this.count/64))};if(this.splitPasses)o(e),t>0&&this.encodeSteps(e,t,n.length>0),i&&this.encodeGel(e,i);else{let r=e.beginComputePass(a?{timestampWrites:a}:void 0);o(r),t>0&&this.encodeSteps(r,t,n.length>0),i&&this.encodeGel(r,i),r.end()}i&&e.copyBufferToBuffer(this.boundsOut,0,this.boundsUniform,0,64);let s=this.iceStaging.find(e=>!e.busy);s&&this.paramsU32[Be/4]>0&&(e.copyBufferToBuffer(this.iceImpulse,0,s.buffer,0,We),e.clearBuffer(this.iceImpulse),s.busy=!0,this.iceCopied=s.buffer)}afterSubmit(){let e=this.iceCopied;if(!e)return;this.iceCopied=null;let t=this.iceStaging.find(t=>t.buffer===e);e.mapAsync(GPUMapMode.READ).then(()=>{let n=new Int32Array(e.getMappedRange()),r=this.iceResult??new Float32Array(n.length);for(let e=0;e<n.length;e++)r[e]=(this.iceResult?r[e]:0)+n[e]/Ge;this.iceResult=r,e.unmap(),t.busy=!1},()=>{t.busy=!1})}takeIceImpulses(){let e=this.iceResult;return this.iceResult=null,e}setCup(e,t){this.paramsU32[1429]=e+1,new Float32Array(this.paramsData,Ve,20).set(t.subarray(0,20))}setIce(e,t){let n=Math.min(t,16);new Float32Array(this.paramsData,ze,n*20).set(e.subarray(0,n*20)),this.paramsU32[Be/4]=n;for(let e of[this.paramsIdle,this.paramsForce])this.device.queue.writeBuffer(e,ze,this.paramsData,ze,Ue-ze)}setFlow(e,t,n,r){this.flowSpawn=Math.max(0,e|0);let i=new Uint32Array(this.flowData),a=new Float32Array(this.flowData);i[0]=this.count,i[1]=this.flowSpawn,i[2]=i[2]+1>>>0,a[4]=t[0],a[5]=t[1],a[6]=t[2],a[7]=.012,a[8]=n[0],a[9]=n[1],a[10]=n[2],a[12]=r[0],a[13]=r[1],a[14]=r[2],a[15]=r[3]}setTaps(e,t,n,r){this.tapSpawn=[Math.max(0,e[0]|0),Math.max(0,e[1]|0)];let i=new Uint32Array(this.flowData),a=new Float32Array(this.flowData);i[3]=this.tapSpawn[0],i[16]=this.tapSpawn[1],t.forEach((e,t)=>a.set([e[0],e[1],e[2],.01],20+t*4)),a.set([n[0],n[1],n[2],0],28),a.set(r.slice(0,4),32),a[17]=r[4]}setCounterHole(e,t,n){new Float32Array(this.paramsData,He,4).set([this.floor,e,t,n])}setVessels(e){let t=e.slice(0,Ie);this.paramsU32[11]=t.length;let n=new Float32Array(this.paramsData,Fe,Re*4);n.fill(0),t.forEach((e,t)=>{let r=e.profile.slice(0,Le),i=Math.max(...r.map(e=>e[0]))+e.halfThickness+2*this.dx,a=Math.max(...r.map(e=>e[1]))+e.halfThickness+2*this.dx;n.set([e.cx,e.cz,e.halfThickness,r.length],t*8),n.set([i,a,0,0],t*8+4),r.forEach((e,r)=>n.set(e,(2*Ie+t*4)*4+r*2))});for(let e of[this.paramsIdle,this.paramsForce])this.device.queue.writeBuffer(e,0,this.paramsData)}dispatch(e,t,n,r,i,a=0){let o=e instanceof GPUCommandEncoder,s=o?e.beginComputePass():e;s.setBindGroup(0,n),i&&s.setBindGroup(1,i),s.setPipeline(t),typeof r==`number`?s.dispatchWorkgroups(r):s.dispatchWorkgroupsIndirect(r,a),o&&s.end()}encodeSteps(e,t,n){let r=this.count;if((this.tiled||this.sortDirect)&&++this.framesSinceSort>=this.sortInterval){this.framesSinceSort=0;let t=this.sortGroups[this.cur];this.dispatch(e,this.pipes.count,t,Math.ceil(r/128)),this.dispatch(e,this.pipes.scan,t,1),this.dispatch(e,this.pipes.scatter,t,Math.ceil(r/128)),this.cur=1-this.cur}let i=this.activeArgs,a=Math.ceil(r/this.p2gWorkgroup),o=this.mpmGroups[this.cur],s=e=>o[e===0&&n?0:1],c=this.tiled?this.pipes.p2g:this.pipes.p2gDirect,l=this.tiled?this.pipes.g2p2g:this.pipes.g2p2gDirect,u=()=>{this.dispatch(e,this.pipes.activeFinish,o[1],1,this.argsGroup),this.dispatch(e,this.pipes.activeClear,o[1],i,void 0,12),this.dispatch(e,this.pipes.grid,o[1],i)};if(this.fuse){this.dispatch(e,c,o[1],a),u();for(let n=0;n<t-1;n++)this.dispatch(e,l,s(n),a),u();this.dispatch(e,this.pipes.g2p,s(t-1),a)}else for(let n=0;n<t;n++)this.dispatch(e,c,o[1],a),u(),this.dispatch(e,this.pipes.g2p,s(n),a)}encodeGel(e,t){let n=t.source===`grid`,r=`${t.splatRadius}|${t.smooth}|${n}`;if(r!==this.gelKey){this.gelKey=r;let e=new Uint32Array(this.gelData),n=new Float32Array(this.gelData),i=1.15;e[0]=this.grid.x,e[16]=this.grid.y,e[17]=this.grid.z,e[1]=this.count,n[2]=t.splatRadius,n[3]=i,e[4]=+!!t.smooth,n[6]=this.dx;let a=t.splatRadius;n[5]=.6381*a**3*i;let o=Math.max(a*a/11+(t.smooth?1/6:0)-.25,.05),s=[-2.5,-1.5,-.5,.5,1.5,2.5].map(e=>Math.exp(-e*e/(2*o))),c=s.reduce((e,t)=>e+t,0);n.set(s.map(e=>e/c),8),this.device.queue.writeBuffer(this.gelParams,0,this.gelData)}let i=Math.ceil(this.nodeCount/64),a=this.gelGroups[this.cur];n?(this.dispatch(e,this.pipes.particleBounds,a,Math.ceil(this.count/64)),this.dispatch(e,this.pipes.blurX,a,i),this.dispatch(e,this.pipes.blurY,a,i),this.dispatch(e,this.pipes.blurZ,a,i),this.dispatch(e,this.pipes.bounds,a,1,this.gelArgsGroup)):(this.dispatch(e,this.pipes.splat,a,Math.ceil(this.count/64)),this.dispatch(e,this.pipes.bounds,a,1,this.gelArgsGroup),this.dispatch(e,this.pipes.resolve,a,this.gelArgs),t.smooth&&this.dispatch(e,this.pipes.smooth,a,this.gelArgs))}writeParams(e,t){let n=this.params,r=this.dx,i=this.paramsU32,a=this.paramsF32;if(i[0]=this.grid.x,i[9]=this.grid.y,i[10]=this.grid.z,i[1]=this.count,a[2]=n.subDt,a[3]=r,a[4]=1/r,a[5]=n.gravity*n.gravityScale,a[6]=n.mu,a[7]=n.lambda,i[8]=0,this.device.queue.writeBuffer(this.paramsIdle,0,this.paramsData,0,48),e.length===0)return;let o=Math.min(50,e.length);i[8]=o;for(let n=0;n<o;n++){let r=e[n],i=12+n*4,o=212+n*4,s=412+n*4,c=612+n*4,l=812+n*4;a[i]=r.x,a[i+1]=r.y,a[i+2]=r.z,a[i+3]=r.strength*t,a[l]=r.vx,a[l+1]=r.vy,a[l+2]=r.vz,a[l+3]=r.couple,r.isCapsule?(a.set([r.ax,r.ay,r.az,r.hx],o),a.set([r.bx,r.by,r.bz,r.radius>0?r.radius:r.hy],s),a.set([r.cx,r.cy,r.cz,-1],c)):r.isBox?(a.set([r.ax,r.ay,r.az,r.hx],o),a.set([r.bx,r.by,r.bz,r.hy],s),a.set([r.cx,r.cy,r.cz,r.hz],c)):(a.set([1,0,0,r.radius],o),a.set([0,1,0,-1],s),a.set([0,0,1,r.attract?-1:r.radius],c))}let s=(812+o*4)*4;this.device.queue.writeBuffer(this.paramsForce,0,this.paramsData,0,s)}},qe=`// Scene passes for goo.html. Colour handling mirrors three's WebGPURenderer: lit materials are
// ACES-filmic tone mapped, then written linear to an -srgb target or sRGB-encoded in shader.

struct View {
  view_proj: mat4x4f,
  content_mvp: mat4x4f,
  view: mat4x4f,
  content_view: mat4x4f,
  proj: mat4x4f,
  // clip (ndc, 0, 1) → world-space ray direction, camera at the origin
  bg_dir: mat4x4f,
  // xyz = camera in content space, w = world metres per content unit
  cam_content: vec4f,
  cam_world: vec4f,
  // x = background intensity, y = encode sRGB in shader, z = tone map "unlit" materials, w = exposure
  output: vec4f,
};

struct Box {
  model: mat4x4f,
  color: vec4f,
};

struct Frame {
  boxes: array<Box, 24>,
  // x = threshold, y = absorb, z = step length (content units), w = max steps
  gel: vec4f,
  // xyz = left wrist world, w = visible
  wrist_l: vec4f,
  wrist_r: vec4f,
  // x = bead size, yzw = sim size (width, height, depth)
  beads: vec4f,
  // unit sphere (r = 0.5) → world, per hand; zero when untracked
  forearms: array<mat4x4f, 2>,
  // x = sim y of content y = 0
  sim_floor: vec4f,
};

struct GelBounds {
  lo: vec4f,
  hi: vec4f,
  water_lo: vec4f,
  water_hi: vec4f,
};

@group(0) @binding(0) var<uniform> view: View;
@group(0) @binding(1) var<uniform> frame: Frame;
@group(0) @binding(2) var<uniform> gel_bounds: GelBounds;
@group(0) @binding(3) var density_tex: texture_3d<f32>;
@group(0) @binding(4) var lin_clamp: sampler;
@group(0) @binding(5) var env_cube: texture_cube<f32>;

// Real-world depth with matchDepthView false: the buffer is the sensor's, not the eye's.
// depth_from_eye takes eye space into the depth camera. Normalized view is top-left, +Y down.
struct Occlusion {
  depth_from_eye: mat4x4f,
  depth_proj: mat4x4f,
  uv_from_view: mat4x4f,
  // x = rawValueToMeters, y = 0 off / 1 float32 / 2 unsigned-short, zw = depth size
  params: vec4f,
  // x = depth-camera near plane, metres. Raw texels are distance from that plane.
  extra: vec4f,
};

@group(2) @binding(0) var<uniform> occ: Occlusion;
@group(2) @binding(1) var depth_f32: texture_2d<f32>;
@group(2) @binding(2) var depth_u16: texture_2d<u32>;

fn real_occludes(p_eye: vec4f) -> bool {
  let kind = occ.params.y;
  if (kind < 0.5) { return false; }
  let p_depth = occ.depth_from_eye * p_eye;
  let clip = occ.depth_proj * p_depth;
  if (clip.w <= 0.0) { return false; }
  let ndc = clip.xy / clip.w;
  let view_uv = vec2f(ndc.x * 0.5 + 0.5, 0.5 - ndc.y * 0.5);
  let duv = (occ.uv_from_view * vec4f(view_uv, 0.0, 1.0)).xy;
  if (duv.x < 0.0 || duv.y < 0.0 || duv.x >= 1.0 || duv.y >= 1.0) { return false; }
  let px = vec2i(duv * occ.params.zw);
  var raw = 0.0;
  if (kind > 1.5) {
    raw = f32(textureLoad(depth_u16, px, 0).r);
  } else {
    raw = textureLoad(depth_f32, px, 0).r;
  }
  let meters = raw * occ.params.x;
  return meters > 0.0 && meters + 0.02 < -p_depth.z - occ.extra.x;
}

// Look transition. axis.xyz is content-space, axis.w is the front.
// params.x > 0 discards the positive side; y enables; z is the glow width; w enables the glow.
struct Wipe {
  axis: vec4f,
  params: vec4f,
};

@group(3) @binding(0) var<uniform> wipe: Wipe;

fn wipe_discard(content: vec3f) -> bool {
  if (wipe.params.y < 0.5) { return false; }
  return (dot(content, wipe.axis.xyz) - wipe.axis.w) * wipe.params.x > 0.0;
}

fn wipe_glow(content: vec3f) -> f32 {
  if (wipe.params.w < 0.5) { return 0.0; }
  let d = abs(dot(content, wipe.axis.xyz) - wipe.axis.w);
  return 1.0 - smoothstep(0.0, wipe.params.z, d);
}

// ---------------------------------------------------------------------------------------------
// Output

fn aces(color_in: vec3f) -> vec3f {
  let input_mat = mat3x3f(
    vec3f(0.59719, 0.07600, 0.02840),
    vec3f(0.35458, 0.90834, 0.13383),
    vec3f(0.04823, 0.01566, 0.83777),
  );
  let output_mat = mat3x3f(
    vec3f(1.60475, -0.10208, -0.00327),
    vec3f(-0.53108, 1.10813, -0.07276),
    vec3f(-0.07367, -0.00605, 1.07602),
  );
  var c = input_mat * (color_in * view.output.w / 0.6);
  let a = c * (c + 0.0245786) - 0.000090537;
  let b = c * (0.983729 * c + 0.4329510) + 0.238081;
  c = output_mat * (a / b);
  return clamp(c, vec3f(0.0), vec3f(1.0));
}

fn encode(c: vec3f) -> vec3f {
  if (view.output.y < 0.5) { return c; }
  let lo = c * 12.92;
  let hi = 1.055 * pow(max(c, vec3f(0.0)), vec3f(1.0 / 2.4)) - 0.055;
  return select(hi, lo, c <= vec3f(0.0031308));
}

fn out_lit(c: vec3f) -> vec3f {
  return encode(aces(c));
}

fn out_unlit(c: vec3f) -> vec3f {
  return encode(select(c, aces(c), view.output.z > 0.5));
}

fn content_of_sim(p: vec3f) -> vec3f {
  return vec3f(p.x - 0.5 * frame.beads.y, p.y - frame.sim_floor.x, p.z - 0.5 * frame.beads.w);
}

// ---------------------------------------------------------------------------------------------
// Background: the equirect HDR pre-baked (tone mapped) into env_cube by env_bake.wgsl.

struct BgOut {
  @builtin(position) pos: vec4f,
  @location(0) dir: vec4f,
};

@vertex fn vs_bg(@builtin(vertex_index) i: u32) -> BgOut {
  let uv = vec2f(f32((i << 1u) & 2u), f32(i & 2u));
  let ndc = uv * 2.0 - 1.0;
  var o: BgOut;
  o.pos = vec4f(ndc, 0.0, 1.0);
  o.dir = view.bg_dir * vec4f(ndc, 0.0, 1.0);
  return o;
}

@fragment fn fs_bg(in: BgOut) -> @location(0) vec4f {
  let c = textureSampleLevel(env_cube, lin_clamp, in.dir.xyz / in.dir.w, 0.0).rgb;
  return vec4f(encode(c), 1.0);
}

// The backdrop is tone-mapped and linear, the same size as the target.
@fragment fn fs_composite(in: BgOut) -> @location(0) vec4f {
  let c = textureLoad(scene_tex, vec2i(in.pos.xy), 0);
  return vec4f(encode(c.rgb), c.a);
}

// ---------------------------------------------------------------------------------------------
// Flat unlit boxes (basin, force colliders). Instance index picks the Frame box.

struct FlatOut {
  @builtin(position) pos: vec4f,
  @location(0) @interpolate(flat) color: vec4f,
  @location(1) eye: vec3f,
};

@vertex fn vs_flat(@location(0) p: vec3f, @builtin(instance_index) ii: u32) -> FlatOut {
  let b = frame.boxes[ii];
  let content = b.model * vec4f(p, 1.0);
  var o: FlatOut;
  o.pos = view.content_mvp * content;
  o.color = b.color;
  o.eye = (view.content_view * content).xyz;
  return o;
}

@fragment fn fs_flat(in: FlatOut) -> @location(0) vec4f {
  if (real_occludes(vec4f(in.eye, 1.0))) { discard; }
  return vec4f(out_lit(in.color.rgb), in.color.a);
}

// ---------------------------------------------------------------------------------------------
// Vessels: lathed glassware, the sink and faucet. Part 0 is static content space, part 1 the lever.

@group(1) @binding(6) var<uniform> vessel_parts: array<mat4x4f, 24>;

struct VesselOut {
  @builtin(position) pos: vec4f,
  @location(0) content: vec3f,
  @location(1) nrm: vec3f,
  @location(2) color: vec4f,
  @location(3) eye: vec3f,
};

@vertex fn vs_vessel(@location(0) p: vec3f, @location(1) n: vec3f, @location(2) c: vec4f, @location(3) part: f32) -> VesselOut {
  let m = vessel_parts[u32(part + 0.5)];
  let content = (m * vec4f(p, 1.0)).xyz;
  var o: VesselOut;
  o.pos = view.content_mvp * vec4f(content, 1.0);
  o.content = content;
  o.nrm = (m * vec4f(n, 0.0)).xyz;
  o.color = c;
  o.eye = (view.content_view * vec4f(content, 1.0)).xyz;
  return o;
}

fn vessel_env(content: vec3f, nrm: vec3f) -> vec3f {
  return textureSampleLevel(env_cube, lin_clamp, world_reflect(content, nrm), 0.0).rgb;
}

// color.a is metalness: 0 is painted/ceramic, 1 chrome.
@fragment fn fs_vessel(in: VesselOut, @builtin(front_facing) front: bool) -> @location(0) vec4f {
  if (real_occludes(vec4f(in.eye, 1.0))) { discard; }
  var n = normalize(in.nrm);
  if (!front) { n = -n; }
  let v = normalize(view.cam_content.xyz - in.content);
  let ndv = clamp(dot(n, v), 0.0, 1.0);
  let l = normalize(vec3f(0.35, 0.85, 0.4));
  let h = normalize(l + v);
  let metal = in.color.a;
  let albedo = in.color.rgb;
  let ambient = mix(vec3f(0.05, 0.05, 0.07), vec3f(0.16, 0.18, 0.24), n.y * 0.5 + 0.5);
  let diffuse = albedo * (ambient + vec3f(1.0, 0.95, 0.9) * max(dot(n, l), 0.0) * 0.9) * (1.0 - metal * 0.85);
  let spec = pow(max(dot(n, h), 0.0), mix(24.0, 120.0, metal)) * mix(0.25, 1.4, metal);
  let F = mix(0.04, 1.0, metal) + (1.0 - mix(0.04, 1.0, metal)) * pow(1.0 - ndv, 5.0);
  let env = vessel_env(in.content, n) * mix(vec3f(1.0), albedo, metal) * F;
  return vec4f(encode(aces(diffuse + vec3f(spec)) + env), 1.0);
}

@fragment fn fs_vessel_glass(in: VesselOut, @builtin(front_facing) front: bool) -> @location(0) vec4f {
  if (real_occludes(vec4f(in.eye, 1.0))) { discard; }
  var n = normalize(in.nrm);
  if (!front) { n = -n; }
  let v = normalize(view.cam_content.xyz - in.content);
  let ndv = abs(dot(n, v));
  let F = 0.04 + 0.96 * pow(1.0 - ndv, 5.0);
  let edge = pow(1.0 - ndv, 2.0);
  let l = normalize(vec3f(0.35, 0.85, 0.4));
  let spec = pow(max(dot(n, normalize(l + v)), 0.0), 140.0) * 1.2;
  let env = vessel_env(in.content, n);
  // color.a below 1 is frost (ice): a milky, lit body instead of clear glass.
  let frost = 1.0 - in.color.a;
  let lit = 0.35 + 0.65 * max(dot(n, l), 0.0);
  let body = in.color.rgb * (0.22 + frost * 0.6 * lit);
  let col = mix(body, env * in.color.rgb, clamp(F + edge * 0.35, 0.0, 1.0)) + aces(vec3f(spec));
  let alpha = clamp(0.07 + frost * 0.35 + edge * (0.45 + frost * 0.3) + F * 0.6 + spec, 0.0, 0.95);
  return vec4f(encode(col), alpha);
}

// ---------------------------------------------------------------------------------------------
// Lines (grid helper, collider axes) in content space.

struct LineOut {
  @builtin(position) pos: vec4f,
  @location(0) color: vec3f,
  @location(1) eye: vec3f,
};

@vertex fn vs_line(@location(0) p: vec3f, @location(1) c: vec3f) -> LineOut {
  var o: LineOut;
  o.pos = view.content_mvp * vec4f(p, 1.0);
  o.eye = (view.content_view * vec4f(p, 1.0)).xyz;
  o.color = c;
  return o;
}

@fragment fn fs_line(in: LineOut) -> @location(0) vec4f {
  if (real_occludes(vec4f(in.eye, 1.0))) { discard; }
  return vec4f(out_lit(in.color), 1.0);
}

// ---------------------------------------------------------------------------------------------
// Bead impostors — the lit sphere sprites from GooMaterial.ts (goo branch).

@group(1) @binding(0) var<storage, read> particles: array<vec4f>;

override SAND_ONLY: f32 = 0.0;

struct BeadOut {
  @builtin(position) pos: vec4f,
  @location(0) uv: vec2f,
  @location(1) eye: vec3f,
  @location(2) @interpolate(flat) content: vec3f,
  @location(3) @interpolate(flat) mat: f32,
};

@vertex fn vs_bead(@builtin(vertex_index) vi: u32, @builtin(instance_index) ii: u32) -> BeadOut {
  let corners = array<vec2f, 6>(
    vec2f(-0.5, -0.5), vec2f(0.5, -0.5), vec2f(0.5, 0.5),
    vec2f(-0.5, -0.5), vec2f(0.5, 0.5), vec2f(-0.5, 0.5),
  );
  let corner = corners[vi];
  let particle = particles[ii * 8u];
  let p = content_of_sim(particle.xyz);
  let center = view.content_view * vec4f(p, 1.0);
  let grain = select(1.0, 0.32, particle.w > 0.5);
  let size = frame.beads.x * grain * view.cam_content.w;
  var o: BeadOut;
  o.pos = view.proj * (center + vec4f(corner * size, 0.0, 0.0));
  o.uv = corner + 0.5;
  o.eye = center.xyz;
  o.content = p;
  o.mat = particle.w;
  return o;
}

@fragment fn fs_bead(in: BeadOut) -> @location(0) vec4f {
  if (in.mat > 3.5) { discard; }
  if (SAND_ONLY > 0.5 && abs(in.mat - 1.0) > 0.5) { discard; }
  if (wipe_discard(in.content)) { discard; }
  let puv = in.uv * 2.0 - 1.0;
  let r2 = dot(puv, puv);
  if (r2 >= 1.0) { discard; }
  let nz = sqrt(max(0.0, 1.0 - r2));
  let n = normalize(vec3f(puv, nz));
  let l = normalize(vec3f(0.4, 0.75, 0.55));
  let ndl = max(dot(n, l), 0.0);
  let wrap = ndl * 0.55 + 0.45;
  let fresnel = pow(1.0 - max(n.z, 0.0), 2.8);
  let h = normalize(l + vec3f(0.0, 0.0, 1.0));
  let spec = pow(max(dot(n, h), 0.0), 56.0);
  // Gel is green. Sand is a warm grain. Same wrap lighting on both.
  let albedo = select(
    vec3f(0.006995, 0.0865, 0.02624),
    vec3f(0.31, 0.16, 0.05),
    in.mat > 0.5,
  );
  let lit = select(vec3f(0.1221, 0.7454, 0.1946), vec3f(0.78, 0.55, 0.24), in.mat > 0.5);
  let sand = in.mat > 0.5;
  let rim = select(vec3f(0.5647, 1.0, 0.7454), vec3f(1.0, 0.82, 0.48), sand);
  let shade = select(vec3f(0.02843, 0.1470, 0.05951), vec3f(0.14, 0.07, 0.02), sand);
  var goo = mix(albedo, lit, wrap) + rim * (fresnel * 0.55) + vec3f(spec * 0.45) + shade * ((1.0 - wrap) * 0.15);
  if (in.mat > 1.5) {
    let beer = select(vec3f(0.85, 0.45, 0.06), vec3f(0.06, 0.03, 0.015), in.mat > 2.5);
    goo = beer * wrap + vec3f(spec * 0.6) + vec3f(fresnel * 0.2);
  }
  let grain = select(1.0, 0.32, in.mat > 0.5);
  let surface = in.eye + vec3f(puv, nz) * (frame.beads.x * grain * view.cam_content.w);
  if (real_occludes(vec4f(surface, 1.0))) { discard; }
  return vec4f(out_lit(goo + vec3f(wipe_glow(in.content))), 1.0);
}

// ---------------------------------------------------------------------------------------------
// Gel isosurface — the GelSurface.ts march, over the goo's own bounding box.

struct GelOut {
  @builtin(position) pos: vec4f,
  @location(0) local: vec3f,
};

struct GelFrag {
  @location(0) color: vec4f,
  @builtin(frag_depth) depth: f32,
};

struct GelMarch {
  hit: f32,
  p: vec3f,
  nrm: vec3f,
  v: vec3f,
  ndv: f32,
  thickness: f32,
  clip: vec4f,
};

// Backdrop captured before the gel, sampled only by fs_gel_glass.
// Binding 4: group 1 bindings 0–3 belong to beads, hands, and the panel.
@group(1) @binding(4) var scene_tex: texture_2d<f32>;

// Corners come from the unit-cube vertex buffer: on Adreno (Quest 3) with MSAA, varyings from a
// vertex shader that indexes a constant array by vertex_index arrive as garbage.
fn box_vertex(corner: vec3f, lo_sim: vec3f, hi_sim: vec3f) -> GelOut {
  let p = mix(content_of_sim(lo_sim), content_of_sim(hi_sim), corner + 0.5);
  var o: GelOut;
  o.pos = view.content_mvp * vec4f(p, 1.0);
  o.local = p;
  return o;
}

@vertex fn vs_gel(@location(0) corner: vec3f) -> GelOut {
  return box_vertex(corner, gel_bounds.lo.xyz, gel_bounds.hi.xyz);
}

@vertex fn vs_water(@location(0) corner: vec3f) -> GelOut {
  return box_vertex(corner, gel_bounds.water_lo.xyz, gel_bounds.water_hi.xyz);
}

// r = gel, g = lager, b = stout.
fn density_rgb(p: vec3f) -> vec3f {
  let size = vec3f(frame.beads.y, frame.beads.z, frame.beads.w);
  let sim = vec3f(p.x + 0.5 * size.x, p.y + frame.sim_floor.x, p.z + 0.5 * size.z);
  return textureSampleLevel(density_tex, lin_clamp, sim / size, 0.0).rgb;
}

fn density_at(p: vec3f, mask: vec3f) -> f32 {
  return dot(density_rgb(p), mask);
}

fn march_gel(local: vec3f) -> GelMarch {
  return march_volume(local, vec3f(1.0, 0.0, 0.0), gel_bounds.lo.xyz, gel_bounds.hi.xyz);
}

// Below 1 the isosurface sits closer to the particles: a pour is a thin line of them.
const WATER_WEIGHT: f32 = 0.7;

fn march_water(local: vec3f) -> GelMarch {
  return march_volume(local, vec3f(0.0, WATER_WEIGHT, WATER_WEIGHT), gel_bounds.water_lo.xyz, gel_bounds.water_hi.xyz);
}

fn march_volume(local: vec3f, mask: vec3f, lo_sim: vec3f, hi_sim: vec3f) -> GelMarch {
  let origin = view.cam_content.xyz;
  let dir = normalize(local - origin);
  let inv_dir = 1.0 / dir;
  let box_lo = content_of_sim(lo_sim);
  let box_hi = content_of_sim(hi_sim);
  let t0 = (box_lo - origin) * inv_dir;
  let t1 = (box_hi - origin) * inv_dir;
  let tmin = min(t0, t1);
  let tmax = max(t0, t1);
  let t_near = max(max(tmin.x, tmin.y), tmin.z);
  let t_far = min(min(tmax.x, tmax.y), tmax.z);

  let threshold = frame.gel.x;
  let max_steps = i32(frame.gel.w);
  let start = max(t_near, 0.0);
  let span = max(t_far - start, 0.0);
  let ds = max(frame.gel.z, span / f32(max_steps));

  // Branch-free march with a single discard at the end: Adreno (Quest 3) silently drops every
  // hit at full resolution when this loop breaks / samples under divergent branches or follows
  // an early discard.
  var hit_a = -1.0;
  var hit_b = -1.0;
  var da = 0.0;
  var db = 0.0;
  var exit_t = -1.0;
  var prev_d = 0.0;
  var prev_t = start;
  let n_steps = min(max_steps, i32(ceil(span / ds)));
  for (var s = 0; s < n_steps; s++) {
    let t = min(start + ds * (f32(s) + 0.5), t_far);
    let d = density_at(origin + dir * t, mask);
    let entering = hit_a < 0.0 && d >= threshold;
    let leaving = hit_a >= 0.0 && exit_t < 0.0 && d < threshold;
    hit_a = select(hit_a, prev_t, entering);
    hit_b = select(hit_b, t, entering);
    da = select(da, prev_d, entering);
    db = select(db, d, entering);
    let u = clamp((prev_d - threshold) / max(prev_d - d, 1e-5), 0.0, 1.0);
    exit_t = select(exit_t, mix(prev_t, t, u), leaving);
    prev_d = d;
    prev_t = t;
  }
  let hit = hit_a >= 0.0;

  // Bisect the bracketing interval, then interpolate: a smooth silhouette at coarse steps.
  var a = hit_a;
  var b = hit_b;
  for (var r = 0; r < 4; r++) {
    let m = 0.5 * (a + b);
    let dm = density_at(origin + dir * m, mask);
    let inside = dm >= threshold;
    b = select(b, m, inside);
    db = select(db, dm, inside);
    a = select(m, a, inside);
    da = select(dm, da, inside);
  }
  let hit_t = mix(a, b, clamp((threshold - da) / max(db - da, 1e-5), 0.0, 1.0));

  let hit_p = origin + dir * hit_t;
  let clip = view.content_mvp * vec4f(hit_p, 1.0);

  let eps = 1.25 * frame.beads.y / f32(textureDimensions(density_tex).x);
  let grad = vec3f(
    density_at(hit_p + vec3f(eps, 0.0, 0.0), mask) - density_at(hit_p - vec3f(eps, 0.0, 0.0), mask),
    density_at(hit_p + vec3f(0.0, eps, 0.0), mask) - density_at(hit_p - vec3f(0.0, eps, 0.0), mask),
    density_at(hit_p + vec3f(0.0, 0.0, eps), mask) - density_at(hit_p - vec3f(0.0, 0.0, eps), mask),
  );
  let grad_len = length(grad);
  let v = -dir;
  var nrm = select(v, grad / max(grad_len, 1e-4), grad_len > 1e-4);
  if (dot(nrm, v) < 0.0) { nrm = -nrm; }

  var o: GelMarch;
  o.hit = select(0.0, 1.0, hit);
  o.p = hit_p;
  o.nrm = nrm;
  o.v = v;
  o.ndv = max(dot(nrm, v), 0.0);
  // No exit crossing means the blob runs to the far wall of the box.
  o.thickness = clamp(select(t_far - hit_t, exit_t - hit_t, exit_t > hit_t), 0.01, 0.55);
  o.clip = clip;
  return o;
}

@fragment fn fs_gel(in: GelOut) -> GelFrag {
  let m = march_gel(in.local);
  if (m.hit < 0.5 || wipe_discard(m.p)) { discard; }
  let ndv = m.ndv;
  let thickness = m.thickness;
  let absorb = frame.gel.y;
  let fresnel = pow(1.0 - ndv, 4.0) * 0.72 + 0.05;

  let sigma = vec3f(0.55, 0.12, 0.4);
  let beer = exp(-sigma * (thickness * absorb));
  let tint = vec3f(0.55, 0.95, 0.62);
  let gel_body = mix(vec3f(0.05, 0.28, 0.14), vec3f(0.16, 0.58, 0.32), ndv * 0.5 + 0.5);
  let transmitted = gel_body * beer * tint;

  let l = normalize(vec3f(0.35, 0.85, 0.4));
  let h = normalize(l + m.v);
  let spec = pow(max(dot(m.nrm, h), 0.0), 48.0) * 0.18;
  let rim = vec3f(0.75, 0.98, 0.85) * (fresnel * 0.4);

  let col = transmitted * (1.0 - fresnel) + rim + vec3f(spec) + vec3f(wipe_glow(m.p));
  // Nothing behind the gel is sampled, so coverage carries the optical depth.
  let optical_depth = 1.0 - exp(-thickness * absorb);
  let alpha = clamp(mix(optical_depth, 1.0, fresnel), 0.12, 1.0);
  if (real_occludes(view.content_view * vec4f(m.p, 1.0))) { discard; }

  var o: GelFrag;
  o.color = vec4f(out_unlit(col), alpha);
  o.depth = m.clip.z / m.clip.w;
  return o;
}

fn backdrop_uv(p: vec3f) -> vec2f {
  let c = view.content_mvp * vec4f(p, 1.0);
  let ndc = c.xy / c.w;
  return vec2f(ndc.x * 0.5 + 0.5, 0.5 - ndc.y * 0.5);
}

fn world_reflect(hit_p: vec3f, nrm: vec3f) -> vec3f {
  let n_view = normalize((view.content_view * vec4f(nrm, 0.0)).xyz);
  let p_view = (view.content_view * vec4f(hit_p, 1.0)).xyz;
  let r_view = reflect(normalize(p_view), n_view);
  let rot = mat3x3f(view.view[0].xyz, view.view[1].xyz, view.view[2].xyz);
  return transpose(rot) * r_view;
}

// Refractive slime. The backdrop is already tone-mapped and stored linear, so the transmitted
// scene is only encode()'d — a second ACES pass would crush the floor and the environment.
@fragment fn fs_gel_glass(in: GelOut) -> GelFrag {
  let m = march_gel(in.local);
  if (m.hit < 0.5 || wipe_discard(m.p)) { discard; }

  let ior = 1.25;
  var bent = refract(-m.v, m.nrm, 1.0 / ior);
  if (dot(bent, bent) < 1e-6) { bent = -m.v; }
  let exit_p = m.p + normalize(bent) * m.thickness;
  let uv = backdrop_uv(exit_p);
  let rad = 0.0025 + m.thickness * 0.01;
  let taps = array<vec2f, 5>(
    vec2f(0.0, 0.0),
    vec2f(rad, 0.0),
    vec2f(-rad, 0.0),
    vec2f(0.0, rad),
    vec2f(0.0, -rad),
  );
  var sample_rgb = vec3f(0.0);
  var sample_a = 0.0;
  for (var i = 0; i < 5; i++) {
    let s = textureSampleLevel(scene_tex, lin_clamp, uv + taps[i], 0.0);
    sample_rgb += s.rgb;
    sample_a += s.a;
  }
  sample_rgb /= 5.0;
  sample_a /= 5.0;
  let edge = pow(1.0 - m.ndv, 2.0) * 0.02;
  let chroma_r = textureSampleLevel(scene_tex, lin_clamp, uv + vec2f(edge, edge * 0.35), 0.0).r;
  let chroma_b = textureSampleLevel(scene_tex, lin_clamp, uv - vec2f(edge, edge * 0.35), 0.0).b;
  sample_rgb = vec3f(mix(sample_rgb.r, chroma_r, 0.8), sample_rgb.g, mix(sample_rgb.b, chroma_b, 0.8));

  // #c9ffa1, the gelatinous-cube albedo, with beer so the belly goes deep green.
  let albedo = vec3f(0.582, 1.0, 0.356);
  let jelly = aces(vec3f(0.06, 0.36, 0.11));
  let beer = exp(-vec3f(1.1, 0.35, 1.4) * m.thickness * 3.5);
  let warped = mix(jelly, sample_rgb * albedo, sample_a) * beer;
  // Jelly lift keeps the volume luminous in the night HDR; beer lets the backdrop through.
  let transmitted = warped + jelly * (0.62 + 0.38 * (1.0 - beer));

  let F = 0.02 + 0.98 * pow(1.0 - m.ndv, 5.0);
  let rim = pow(1.0 - m.ndv, 3.0);
  let fresnel = clamp(F + rim * 0.2, 0.0, 1.0);
  let phase = rim * 7.5 + m.thickness * 6.0;
  let irid = 0.5 + 0.5 * cos(vec3f(phase, phase + 2.094395, phase + 4.188790));
  let refl_tint = mix(vec3f(0.90, 0.95, 1.0), irid, 0.65);
  let env = textureSampleLevel(env_cube, lin_clamp, world_reflect(m.p, m.nrm), 0.0).rgb;

  let l = normalize(vec3f(0.35, 0.85, 0.4));
  let h = normalize(l + m.v);
  let spec = pow(max(dot(m.nrm, h), 0.0), 80.0) * 0.55;

  let col = transmitted * (1.0 - fresnel) + env * refl_tint * fresnel + aces(vec3f(spec)) + vec3f(wipe_glow(m.p));
  // sample_a is 1 on the opaque desktop backdrop, so this replaces the pixel. In passthrough
  // the empty backdrop is clear and alpha falls back to optical depth.
  let optical = 1.0 - exp(-m.thickness * frame.gel.y);
  let alpha = max(sample_a, clamp(optical, 0.25, 0.9));
  if (real_occludes(view.content_view * vec4f(m.p, 1.0))) { discard; }

  var o: GelFrag;
  o.color = vec4f(encode(col), alpha);
  o.depth = m.clip.z / m.clip.w;
  return o;
}

struct Beer {
  sigma: vec3f,
  glow: vec3f,
  foam: vec3f,
};

// Just under the surface, so a stout poured into lager reads as a black-and-tan layer.
fn beer_at(m: GelMarch) -> Beer {
  let d = density_rgb(m.p - m.nrm * 0.01);
  let stout = clamp(d.b / max(d.g + d.b, 1e-4), 0.0, 1.0);
  var b: Beer;
  b.sigma = mix(vec3f(0.35, 1.7, 7.0), vec3f(10.0, 13.0, 16.0), stout);
  b.glow = mix(vec3f(0.9, 0.45, 0.05), vec3f(0.035, 0.016, 0.006), stout);
  b.foam = mix(vec3f(0.93, 0.88, 0.74), vec3f(0.8, 0.64, 0.45), stout);
  return b;
}

// A real pour is lit through and reads gold even when thin; the floor keeps the stream coloured.
fn beer_depth(m: GelMarch) -> f32 {
  return (0.05 + m.thickness) * 2.5;
}

fn beer_head(m: GelMarch) -> f32 {
  return smoothstep(0.8, 0.98, m.nrm.y) * smoothstep(0.03, 0.12, m.thickness) * 0.75;
}

@fragment fn fs_water(in: GelOut) -> GelFrag {
  let m = march_water(in.local);
  if (m.hit < 0.5 || wipe_discard(m.p)) { discard; }
  let b = beer_at(m);
  let trans = exp(-b.sigma * beer_depth(m));
  let F = 0.02 + 0.98 * pow(1.0 - m.ndv, 5.0);
  let l = normalize(vec3f(0.35, 0.85, 0.4));
  let spec = pow(max(dot(m.nrm, normalize(l + m.v)), 0.0), 90.0) * 0.6;
  let body = mix(b.glow * (1.0 - trans) * 1.4, b.foam, beer_head(m));
  let col = body * (1.0 - F) + vec3f(0.8, 0.85, 0.9) * F + vec3f(spec);
  let alpha = clamp(mix(1.0 - dot(trans, vec3f(0.333)), 1.0, max(F, beer_head(m))), 0.2, 1.0);
  if (real_occludes(view.content_view * vec4f(m.p, 1.0))) { discard; }

  var o: GelFrag;
  o.color = vec4f(out_unlit(col), alpha);
  o.depth = m.clip.z / m.clip.w;
  return o;
}

@fragment fn fs_water_glass(in: GelOut) -> GelFrag {
  let m = march_water(in.local);
  if (m.hit < 0.5 || wipe_discard(m.p)) { discard; }

  var bent = refract(-m.v, m.nrm, 1.0 / 1.33);
  if (dot(bent, bent) < 1e-6) { bent = -m.v; }
  let uv = backdrop_uv(m.p + normalize(bent) * m.thickness);
  let rad = 0.0015 + m.thickness * 0.006;
  let s = (textureSampleLevel(scene_tex, lin_clamp, uv, 0.0) * 2.0
    + textureSampleLevel(scene_tex, lin_clamp, uv + vec2f(rad, rad * 0.5), 0.0)
    + textureSampleLevel(scene_tex, lin_clamp, uv - vec2f(rad, rad * 0.5), 0.0)) * 0.25;

  let b = beer_at(m);
  let trans = exp(-b.sigma * beer_depth(m));
  let lit = aces(b.glow * 0.9);
  let transmitted = mix(lit, s.rgb, s.a) * trans + lit * (1.0 - trans) + lit * 0.25;
  let head = beer_head(m);

  let F = 0.02 + 0.98 * pow(1.0 - m.ndv, 5.0);
  let env = textureSampleLevel(env_cube, lin_clamp, world_reflect(m.p, m.nrm), 0.0).rgb;
  let l = normalize(vec3f(0.35, 0.85, 0.4));
  let spec = pow(max(dot(m.nrm, normalize(l + m.v)), 0.0), 120.0) * 0.9;
  let body = mix(transmitted, aces(b.foam * 0.8), head);
  let col = body * (1.0 - F) + env * F + aces(vec3f(spec)) + vec3f(wipe_glow(m.p));
  let alpha = max(s.a, clamp(max(1.0 - dot(trans, vec3f(0.333)), head), 0.2, 0.95));
  if (real_occludes(view.content_view * vec4f(m.p, 1.0))) { discard; }

  var o: GelFrag;
  o.color = vec4f(encode(col), alpha);
  o.depth = m.clip.z / m.clip.w;
  return o;
}

// ---------------------------------------------------------------------------------------------
// Tracked hands — skinned glass shell from Hands.ts.

@group(1) @binding(1) var<uniform> skin: array<mat4x4f, 50>;

struct HandIn {
  @location(0) position: vec3f,
  @location(1) normal: vec3f,
  @location(2) joints: vec4u,
  @location(3) weights: vec4f,
};

struct HandOut {
  @builtin(position) pos: vec4f,
  @location(0) world: vec3f,
  @location(1) normal: vec3f,
  @location(2) @interpolate(flat) hand: u32,
};

@vertex fn vs_hand(in: HandIn, @builtin(instance_index) hand: u32) -> HandOut {
  let b = hand * 25u;
  let m = skin[b + in.joints.x] * in.weights.x
    + skin[b + in.joints.y] * in.weights.y
    + skin[b + in.joints.z] * in.weights.z
    + skin[b + in.joints.w] * in.weights.w;
  let world = m * vec4f(in.position, 1.0);
  var o: HandOut;
  o.pos = view.view_proj * world;
  o.world = world.xyz;
  o.normal = (m * vec4f(in.normal, 0.0)).xyz;
  o.hand = hand;
  return o;
}

// Passthrough occluders: depth only, so real hands and forearms show through virtual content.
// Inflated to cover tracking latency and the gap between the mesh and the real skin.
@vertex fn vs_hand_occluder(in: HandIn, @builtin(instance_index) hand: u32) -> @builtin(position) vec4f {
  let b = hand * 25u;
  let m = skin[b + in.joints.x] * in.weights.x
    + skin[b + in.joints.y] * in.weights.y
    + skin[b + in.joints.z] * in.weights.z
    + skin[b + in.joints.w] * in.weights.w;
  return view.view_proj * (m * vec4f(in.position + normalize(in.normal) * 0.002, 1.0));
}

@vertex fn vs_forearm(@location(0) p: vec3f, @builtin(instance_index) ii: u32) -> @builtin(position) vec4f {
  return view.view_proj * (frame.forearms[ii] * vec4f(p, 1.0));
}

@fragment fn fs_occluder() -> @location(0) vec4f {
  return vec4f(0.0);
}

@fragment fn fs_hand(in: HandOut) -> @location(0) vec4f {
  let n_view = normalize((view.view * vec4f(in.normal, 0.0)).xyz);
  let p_view = (view.view * vec4f(in.world, 1.0)).xyz;
  let facing = abs(dot(n_view, normalize(-p_view)));
  let rim = pow(1.0 - facing, 2.5);
  let wrist = select(frame.wrist_l.xyz, frame.wrist_r.xyz, in.hand == 1u);
  let stump = smoothstep(0.02, 0.1, distance(in.world, wrist));
  // CORE_COLOR 0x2a3f55, RIM_COLOR 0xbfe4ff in linear.
  let color = mix(vec3f(0.02315, 0.04971, 0.09084), vec3f(0.5210, 0.7758, 1.0), rim);
  return vec4f(out_unlit(color), (rim * 0.8 + 0.05) * stump);
}

// ---------------------------------------------------------------------------------------------
// XR panel: textured quads in world space.

@group(1) @binding(2) var<uniform> panel: array<mat4x4f, 1>;
@group(1) @binding(3) var panel_tex: texture_2d<f32>;

struct PanelOut {
  @builtin(position) pos: vec4f,
  @location(0) uv: vec2f,
  @location(1) eye: vec3f,
};

@vertex fn vs_panel(@builtin(vertex_index) vi: u32) -> PanelOut {
  // Bit tests, not a const-array index: Adreno drops those varyings (same failure as the gel box).
  let c = vec2f(
    select(-0.5, 0.5, vi == 1u || vi == 2u || vi == 4u),
    select(-0.5, 0.5, vi == 2u || vi == 4u || vi == 5u),
  );
  let world = panel[0] * vec4f(c, 0.0, 1.0);
  var o: PanelOut;
  o.pos = view.view_proj * world;
  o.uv = vec2f(c.x + 0.5, 0.5 - c.y);
  o.eye = (view.view * world).xyz;
  return o;
}

@fragment fn fs_panel(in: PanelOut) -> @location(0) vec4f {
  if (real_occludes(vec4f(in.eye, 1.0))) { discard; }
  let c = textureSampleLevel(panel_tex, lin_clamp, in.uv, 0.0);
  return vec4f(encode(c.rgb), c.a);
}

// ---------------------------------------------------------------------------------------------
// Hand UI: button glow, cursor rings and pointer rays, world-space triangles.

struct UiOut {
  @builtin(position) pos: vec4f,
  @location(0) color: vec4f,
  @location(1) eye: vec3f,
};

@vertex fn vs_ui(@location(0) p: vec3f, @location(1) c: vec4f) -> UiOut {
  var o: UiOut;
  o.pos = view.view_proj * vec4f(p, 1.0);
  o.eye = (view.view * vec4f(p, 1.0)).xyz;
  o.color = c;
  return o;
}

@fragment fn fs_ui(in: UiOut) -> @location(0) vec4f {
  if (real_occludes(vec4f(in.eye, 1.0))) { discard; }
  return vec4f(encode(in.color.rgb), in.color.a);
}
`,Je=`// Equirect HDR → tone-mapped cube faces, so the per-pixel background is one cube fetch instead of\r
// atan2/asin + ACES (≈1 ms per eye on Quest 3). Same mapping and ACES fit as scene.wgsl.\r
\r
struct Bake {\r
  intensity: f32,\r
  exposure: f32,\r
};\r
\r
@group(0) @binding(0) var<uniform> bake: Bake;\r
@group(0) @binding(1) var env_tex: texture_2d<f32>;\r
@group(0) @binding(2) var lin_clamp: sampler;\r
\r
fn aces(color_in: vec3f) -> vec3f {\r
  let input_mat = mat3x3f(\r
    vec3f(0.59719, 0.07600, 0.02840),\r
    vec3f(0.35458, 0.90834, 0.13383),\r
    vec3f(0.04823, 0.01566, 0.83777),\r
  );\r
  let output_mat = mat3x3f(\r
    vec3f(1.60475, -0.10208, -0.00327),\r
    vec3f(-0.53108, 1.10813, -0.07276),\r
    vec3f(-0.07367, -0.00605, 1.07602),\r
  );\r
  var c = input_mat * (color_in * bake.exposure / 0.6);\r
  let a = c * (c + 0.0245786) - 0.000090537;\r
  let b = c * (0.983729 * c + 0.4329510) + 0.238081;\r
  c = output_mat * (a / b);\r
  return clamp(c, vec3f(0.0), vec3f(1.0));\r
}\r
\r
struct BakeOut {\r
  @builtin(position) pos: vec4f,\r
  @location(0) ndc: vec2f,\r
  @location(1) @interpolate(flat) face: u32,\r
};\r
\r
@vertex fn vs_bake(@builtin(vertex_index) i: u32, @builtin(instance_index) face: u32) -> BakeOut {\r
  let ndc = vec2f(f32((i << 1u) & 2u), f32(i & 2u)) * 2.0 - 1.0;\r
  var o: BakeOut;\r
  o.pos = vec4f(ndc, 0.0, 1.0);\r
  o.ndc = ndc;\r
  o.face = face;\r
  return o;\r
}\r
\r
@fragment fn fs_bake(in: BakeOut) -> @location(0) vec4f {\r
  // Cube face orientation (s right, t down in texel space).\r
  let s = in.ndc.x;\r
  let t = -in.ndc.y;\r
  var d: vec3f;\r
  switch in.face {\r
    case 0u: { d = vec3f(1.0, -t, -s); }\r
    case 1u: { d = vec3f(-1.0, -t, s); }\r
    case 2u: { d = vec3f(s, 1.0, t); }\r
    case 3u: { d = vec3f(s, -1.0, -t); }\r
    case 4u: { d = vec3f(s, -t, 1.0); }\r
    default: { d = vec3f(-s, -t, -1.0); }\r
  }\r
  d = normalize(d);\r
  let u = atan2(d.z, d.x) * (0.5 / 3.14159265) + 0.5;\r
  let v = asin(clamp(d.y, -1.0, 1.0)) * (1.0 / 3.14159265) + 0.5;\r
  let c = textureSampleLevel(env_tex, lin_clamp, vec2f(u, 1.0 - v), 0.0).rgb;\r
  return vec4f(aces(c * bake.intensity), 1.0);\r
}\r
\r
// Paint the current Quest camera into the cube. Directions outside the camera frustum discard,\r
// so a load keeps whatever was already there (the HDR, until the wearer has looked that way).\r
struct Capture {\r
  view: mat4x4f,\r
  proj: mat4x4f,\r
  // 1 = camera bytes are sRGB and must be decoded; the cube target encodes on store.\r
  decode: f32,\r
};\r
\r
@group(0) @binding(3) var<uniform> capture: Capture;\r
@group(0) @binding(4) var cam_tex: texture_2d<f32>;\r
\r
fn srgb_to_linear(c: vec3f) -> vec3f {\r
  let lo = c / 12.92;\r
  let hi = pow((c + 0.055) / 1.055, vec3f(2.4));\r
  return select(hi, lo, c <= vec3f(0.04045));\r
}\r
\r
fn cube_dir(ndc: vec2f, face: u32) -> vec3f {\r
  let s = ndc.x;\r
  let t = -ndc.y;\r
  switch face {\r
    case 0u: { return vec3f(1.0, -t, -s); }\r
    case 1u: { return vec3f(-1.0, -t, s); }\r
    case 2u: { return vec3f(s, 1.0, t); }\r
    case 3u: { return vec3f(s, -1.0, -t); }\r
    case 4u: { return vec3f(s, -t, 1.0); }\r
    default: { return vec3f(-s, -t, -1.0); }\r
  }\r
}\r
\r
@fragment fn fs_capture(in: BakeOut) -> @location(0) vec4f {\r
  let world_dir = normalize(cube_dir(in.ndc, in.face));\r
  let view_dir = (capture.view * vec4f(world_dir, 0.0)).xyz;\r
  let clip = capture.proj * vec4f(view_dir, 1.0);\r
  let ndc = clip.xy / clip.w;\r
  if (view_dir.z >= 0.0 || clip.w <= 0.0 || abs(ndc.x) > 1.0 || abs(ndc.y) > 1.0) { discard; }\r
  let uv = vec2f(ndc.x * 0.5 + 0.5, 0.5 - ndc.y * 0.5);\r
  var c = textureSampleLevel(cam_tex, lin_clamp, uv, 0.0).rgb;\r
  if (capture.decode > 0.5) { c = srgb_to_linear(c); }\r
  return vec4f(c, 1.0);\r
}\r
`;async function Ye(e){let t=new Uint8Array(await(await fetch(e)).arrayBuffer()),n=0,r=()=>{let e=``;for(;n<t.length&&t[n]!==10;)e+=String.fromCharCode(t[n++]);return n++,e},i=r();for(;i.length;)i=r();let a=/-Y (\d+) \+X (\d+)/.exec(r());if(!a)throw Error(`${e}: unsupported HDR orientation`);let o=Number(a[1]),s=Number(a[2]),c=new Uint16Array(s*o*4),l=new Uint8Array(s*4);for(let r=0;r<o;r++){if(t[n]!==2||t[n+1]!==2||(t[n+2]<<8|t[n+3])!==s)throw Error(`${e}: only RLE scanlines are supported`);n+=4;for(let e=0;e<4;e++){let r=0;for(;r<s;){let i=t[n++];if(i>128){i-=128;let a=t[n++];for(;i--;)l[r++*4+e]=a}else for(;i--;)l[r++*4+e]=t[n++]}}for(let e=0;e<s;e++){let t=l[e*4+3],n=t?2**(t-128)/255:0,i=(r*s+e)*4;c[i]=Qe(Math.min(l[e*4]*n,65504)),c[i+1]=Qe(Math.min(l[e*4+1]*n,65504)),c[i+2]=Qe(Math.min(l[e*4+2]*n,65504)),c[i+3]=15360}}return{width:s,height:o,data:c}}var Xe=new Float32Array(1),Ze=new Uint32Array(Xe.buffer);function Qe(e){Xe[0]=e;let t=Ze[0],n=t>>>16&32768,r=(t>>>23&255)-127+15,i=t&8388607;if(r<=0)return r<-10?n:n|((i|8388608)>>1-r)+4096>>13;if(r>=31)return n|31744;let a=n|r<<10|i>>13;return i&4096?a+1:a}function $e(e){return e.look?e.look:e.solid?`solid`:`beads`}var et=432,tt=2128,H=24,nt=600,U=24,rt=`depth24plus`;function it(e){let t=e[10];if(Math.abs(t)<1e-8)return 0;let n=e[14]/t;return n>0&&n<10?n:0}function W(e,t,n){return n?`${e}|${t}`:`${e}|${t}|z`}var at=`rgba8unorm-srgb`,ot=512,G={color:{srcFactor:`src-alpha`,dstFactor:`one-minus-src-alpha`},alpha:{srcFactor:`one`,dstFactor:`one-minus-src-alpha`}};function st(){let e=[1,3,7,1,7,5,0,4,6,0,6,2,2,6,7,2,7,3,0,1,5,0,5,4,4,5,7,4,7,6,0,2,3,0,3,1],t=new Float32Array(e.length*3);return e.forEach((e,n)=>{t[n*3]=(e&1)-.5,t[n*3+1]=(e>>1&1)-.5,t[n*3+2]=(e>>2&1)-.5}),t}function ct(){let e=(e,t)=>{let n=e/24,r=t/16,i=n*Math.PI*2,a=r*Math.PI;return[-.5*Math.cos(i)*Math.sin(a),.5*Math.cos(a),.5*Math.sin(i)*Math.sin(a)]},t=[];for(let n=0;n<16;n++)for(let r=0;r<24;r++){let i=e(r+1,n),a=e(r,n),o=e(r,n+1),s=e(r+1,n+1);n!==0&&t.push(...i,...a,...s),n!==15&&t.push(...a,...o,...s)}return new Float32Array(t)}function lt(e,t){let n=m(4473936),r=m(2763314),i=[],a=e/2,o=t/2,s=Math.max(2,Math.round(e*5)),c=Math.max(2,Math.round(t*5));for(let e=0;e<=c;e++){let s=-o+e*t/c,l=e===c/2?n:r;i.push(-a,.02,s,...l,a,.02,s,...l)}for(let t=0;t<=s;t++){let c=-a+t*e/s,l=t===s/2?n:r;i.push(c,.02,-o,...l,c,.02,o,...l)}return new Float32Array(i)}var ut=class{device;module;layout0;layouts;vesselGroup;vesselParts;vesselOpaque=null;vesselGlass=null;sceneLayout;sceneGroup;sceneGroups=[];emptyGroup;backdrops=[];backdropDepths=[];backdropViews=[];beadLayout;handLayout;panelLayout;pipelines=new Map;ready=new Map;slots=[];frameBuffer;frameData=new Float32Array(tt/4);viewData=new Float32Array(et/4);sampler;envView;envCube=null;envFaces=[];capturePipeline;captureParams;captureData=new Float32Array(36);captureGroup=null;captureTex=null;envLive=!1;bakePipeline;sim;cube;sphere;sphereCount=0;grid;gridCount=0;gizmo;gizmoData=new Float32Array(36);beadGroups;skinBuffer;skinData=new Float32Array(800);handGroup;hands=[null,null];panelBuffer;uiBuffer;uiCount=0;uiData=new Float32Array(nt*7);panelTexture=null;panelGroup=null;recipeBuffer=null;recipeGroup=null;occLayout;flameDraw=null;occFloat;occUint;occBuf=[];occData=[];occGroup=[];occTex=[];occLayer=[];wipeLayout;wipeBuf=[];wipeData=[];wipeGroup=[];wipeLive=!1;backgroundIntensity=1.6;exposure=1;m0=new Float32Array(16);m1=new Float32Array(16);m2=new Float32Array(16);async init(e,t){this.device=e,this.sim=t,this.module=e.createShaderModule({code:qe,label:`goo-scene`});let n=(await this.module.getCompilationInfo()).messages.filter(e=>e.type===`error`);if(n.length)throw Error(`scene WGSL:\n${n.map(e=>`${e.lineNum}:${e.linePos} ${e.message}`).join(`
`)}`);let r=GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT;this.layout0=e.createBindGroupLayout({label:`goo-scene-0`,entries:[{binding:0,visibility:r,buffer:{type:`uniform`}},{binding:1,visibility:r,buffer:{type:`uniform`}},{binding:2,visibility:r,buffer:{type:`uniform`}},{binding:3,visibility:GPUShaderStage.FRAGMENT,texture:{viewDimension:`3d`,sampleType:`float`}},{binding:4,visibility:GPUShaderStage.FRAGMENT,sampler:{type:`filtering`}},{binding:5,visibility:GPUShaderStage.FRAGMENT,texture:{sampleType:`float`,viewDimension:`cube`}}]}),this.beadLayout=e.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.VERTEX,buffer:{type:`read-only-storage`}}]}),this.handLayout=e.createBindGroupLayout({entries:[{binding:1,visibility:GPUShaderStage.VERTEX,buffer:{type:`uniform`}}]}),this.panelLayout=e.createBindGroupLayout({entries:[{binding:2,visibility:GPUShaderStage.VERTEX,buffer:{type:`uniform`}},{binding:3,visibility:GPUShaderStage.FRAGMENT,texture:{sampleType:`float`}}]});let i=t=>e.createPipelineLayout({bindGroupLayouts:t});this.sceneLayout=e.createBindGroupLayout({entries:[{binding:4,visibility:GPUShaderStage.FRAGMENT,texture:{sampleType:`float`}}]});let a=e.createBindGroupLayout({label:`goo-empty`,entries:[]});this.emptyGroup=e.createBindGroup({layout:a,entries:[]}),this.occLayout=e.createBindGroupLayout({label:`goo-occ`,entries:[{binding:0,visibility:GPUShaderStage.FRAGMENT,buffer:{type:`uniform`}},{binding:1,visibility:GPUShaderStage.FRAGMENT,texture:{sampleType:`unfilterable-float`}},{binding:2,visibility:GPUShaderStage.FRAGMENT,texture:{sampleType:`uint`}}]}),this.wipeLayout=e.createBindGroupLayout({label:`goo-wipe`,entries:[{binding:0,visibility:GPUShaderStage.FRAGMENT,buffer:{type:`uniform`}}]});let o=e.createBindGroupLayout({entries:[{binding:6,visibility:GPUShaderStage.VERTEX,buffer:{type:`uniform`}}]});this.vesselParts=e.createBuffer({size:U*64,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST,label:`goo-vessel-parts`});let s=new Float32Array(U*16);for(let e=0;e<U;e++)s.set(u(),e*16);e.queue.writeBuffer(this.vesselParts,0,s),this.vesselGroup=e.createBindGroup({layout:o,entries:[{binding:6,resource:{buffer:this.vesselParts}}]});let c=e=>i([this.layout0,e,this.occLayout,this.wipeLayout]);this.layouts={none:c(a),bead:c(this.beadLayout),hand:c(this.handLayout),panel:c(this.panelLayout),glass:c(this.sceneLayout),vessel:c(o)},this.occFloat=e.createTexture({label:`goo-occ-f32`,size:[1,1],format:`r32float`,usage:GPUTextureUsage.TEXTURE_BINDING}),this.occUint=e.createTexture({label:`goo-occ-u16`,size:[1,1],format:`r16uint`,usage:GPUTextureUsage.TEXTURE_BINDING}),this.ensureOcc(0);for(let t=0;t<2;t++){let n=e.createBuffer({size:32,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST,mappedAtCreation:!0,label:`goo-wipe-${t}`});new Float32Array(n.getMappedRange()).fill(0),n.unmap(),this.wipeBuf.push(n),this.wipeData.push(new Float32Array(8)),this.wipeGroup.push(e.createBindGroup({layout:this.wipeLayout,entries:[{binding:0,resource:{buffer:n}}]}))}let l=e.createTexture({label:`goo-backdrop-placeholder`,size:[1,1],format:`rgba16float`,usage:GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.RENDER_ATTACHMENT});this.sceneGroup=e.createBindGroup({layout:this.sceneLayout,entries:[{binding:4,resource:l.createView()}]});let d=(t,n,r=0)=>{let i=e.createBuffer({size:t.byteLength,usage:GPUBufferUsage.VERTEX|r,label:n,mappedAtCreation:!0});return new Float32Array(i.getMappedRange()).set(t),i.unmap(),i};this.cube=d(st(),`goo-cube`);let f=ct();this.sphere=d(f,`goo-sphere`),this.sphereCount=f.length/3;let p=lt(t.size.x,t.size.z);this.grid=d(p,`goo-grid`),this.gridCount=p.length/6,this.gizmo=d(this.gizmoData,`goo-gizmo`,GPUBufferUsage.COPY_DST),this.frameBuffer=e.createBuffer({size:tt,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST,label:`goo-frame`}),this.skinBuffer=e.createBuffer({size:this.skinData.byteLength,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST,label:`goo-skin`}),this.panelBuffer=e.createBuffer({size:64,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST,label:`goo-panel`}),this.uiBuffer=e.createBuffer({size:nt*28,usage:GPUBufferUsage.VERTEX|GPUBufferUsage.COPY_DST,label:`goo-ui`}),this.sampler=e.createSampler({magFilter:`linear`,minFilter:`linear`,addressModeU:`clamp-to-edge`,addressModeV:`clamp-to-edge`,addressModeW:`clamp-to-edge`});let m=e.createShaderModule({code:Je,label:`goo-env-bake`});this.bakePipeline=e.createRenderPipeline({label:`goo-env-bake`,layout:`auto`,vertex:{module:m,entryPoint:`vs_bake`},fragment:{module:m,entryPoint:`fs_bake`,targets:[{format:at}]}}),this.capturePipeline=e.createRenderPipeline({label:`goo-env-capture`,layout:`auto`,vertex:{module:m,entryPoint:`vs_bake`},fragment:{module:m,entryPoint:`fs_capture`,targets:[{format:at}]}}),this.captureParams=e.createBuffer({label:`goo-env-capture-params`,size:this.captureData.byteLength,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});let h=e.createTexture({size:[1,1],format:`rgba16float`,usage:GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_DST});e.queue.writeTexture({texture:h},new Uint16Array([Qe(.01),Qe(.012),Qe(.02),Qe(1)]),{bytesPerRow:8},[1,1]),this.envView=this.bakeEnvironment(h,1),h.destroy(),this.beadGroups=t.particleBuffers.map(t=>e.createBindGroup({layout:this.beadLayout,entries:[{binding:0,resource:{buffer:t}}]})),this.handGroup=e.createBindGroup({layout:this.handLayout,entries:[{binding:1,resource:{buffer:this.skinBuffer}}]})}setEnvironment(e,t,n){let r=this.device.createTexture({label:`goo-env`,size:[e,t],format:`rgba16float`,usage:GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_DST});this.device.queue.writeTexture({texture:r},n,{bytesPerRow:e*8},[e,t]),this.envCube?.destroy(),this.envLive=!1,this.envView=this.bakeEnvironment(r,ot),r.destroy();for(let e of this.slots)e.group=this.makeGroup0(e.buffer)}bakeEnvironment(e,t){let n=this.device,r=n.createTexture({label:`goo-env-cube`,size:[t,t,6],format:at,usage:GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.RENDER_ATTACHMENT}),i=n.createBuffer({size:16,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});n.queue.writeBuffer(i,0,new Float32Array([this.backgroundIntensity,this.exposure,0,0]));let a=n.createBindGroup({layout:this.bakePipeline.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:i}},{binding:1,resource:e.createView()},{binding:2,resource:this.sampler}]}),o=n.createCommandEncoder();for(let e=0;e<6;e++){let t=o.beginRenderPass({colorAttachments:[{view:r.createView({dimension:`2d`,baseArrayLayer:e,arrayLayerCount:1}),loadOp:`clear`,storeOp:`store`,clearValue:[0,0,0,1]}]});t.setPipeline(this.bakePipeline),t.setBindGroup(0,a),t.draw(3,1,0,e),t.end()}return n.queue.submit([o.finish()]),i.destroy(),this.envCube=r,this.envFaces=Array.from({length:6},(e,t)=>r.createView({dimension:`2d`,baseArrayLayer:t,arrayLayerCount:1})),r.createView({dimension:`cube`})}captureEnv(e,t,n,r,i){let a=this.envCube;if(!a||a.width<16||this.envFaces.length!==6)return;if(this.captureTex!==t){this.captureTex=t;try{this.captureGroup=this.device.createBindGroup({layout:this.capturePipeline.getBindGroupLayout(0),entries:[{binding:2,resource:this.sampler},{binding:3,resource:{buffer:this.captureParams}},{binding:4,resource:t.createView()}]})}catch(e){this.captureGroup=null,console.warn(`[goo] camera image is not a sampleable GPUTexture`,e);return}}if(!this.captureGroup)return;let o=this.captureData;for(let e=0;e<16;e++)o[e]=n[e],o[16+e]=r[e];o[32]=+!!i,this.device.queue.writeBuffer(this.captureParams,0,o);let s=!this.envLive;for(let t=0;t<6;t++){let n=e.beginRenderPass({colorAttachments:[{view:this.envFaces[t],loadOp:s?`clear`:`load`,storeOp:`store`,clearValue:[.22,.22,.22,1]}]});n.setPipeline(this.capturePipeline),n.setBindGroup(0,this.captureGroup),n.draw(3,1,0,t),n.end()}this.envLive=!0}setHandMesh(e,t){let n=this.device,r=(e,t)=>{let r=Math.ceil(e.byteLength/4)*4,i=n.createBuffer({size:r,usage:t,mappedAtCreation:!0});return new Uint8Array(i.getMappedRange()).set(new Uint8Array(e.buffer,e.byteOffset,e.byteLength)),i.unmap(),i},i=GPUBufferUsage.VERTEX;this.hands[e]={vb:[r(t.position,i),r(t.normal,i),r(t.joints,i),r(t.weights,i)],ib:r(t.indices,GPUBufferUsage.INDEX),count:t.indices.length}}setPanelTexture(e){this.panelTexture=e,this.panelGroup=this.device.createBindGroup({layout:this.panelLayout,entries:[{binding:2,resource:{buffer:this.panelBuffer}},{binding:3,resource:e.createView()}]})}writePanel(e){this.device.queue.writeBuffer(this.panelBuffer,0,e)}writeUi(e){this.uiCount=Math.min(e,nt),this.uiCount&&this.device.queue.writeBuffer(this.uiBuffer,0,this.uiData,0,this.uiCount*7)}writeSkin(){this.device.queue.writeBuffer(this.skinBuffer,0,this.skinData)}bindLayouts(){return{view:this.layout0,occ:this.occLayout,wipe:this.wipeLayout}}setFlameDraw(e){this.flameDraw=e}prepare(e,t,n=!0){let r=W(e,t,n),i=this.pipelines.get(r);return i||(i=this.build(e,t,n).then(e=>(this.ready.set(r,e),e)),this.pipelines.set(r,i)),i}async build(e,t,n=!0){let r=this.device,i=this.module,a=(a,o,s,c,l)=>r.createRenderPipelineAsync({label:a,layout:o,vertex:{module:i,entryPoint:s,buffers:l.buffers??[]},fragment:{module:i,entryPoint:c,constants:l.constants,targets:[{format:e,blend:l.blend?G:void 0,writeMask:l.depthOnly||!n?0:GPUColorWrite.ALL}]},primitive:{topology:l.topology??`triangle-list`,cullMode:l.cull??`none`},depthStencil:{format:rt,depthWriteEnabled:l.depthWrite??!0,depthCompare:l.depthCompare??`less-equal`},multisample:{count:t}}),o={arrayStride:12,attributes:[{shaderLocation:0,offset:0,format:`float32x3`}]},s={arrayStride:24,attributes:[{shaderLocation:0,offset:0,format:`float32x3`},{shaderLocation:1,offset:12,format:`float32x3`}]},c=[{arrayStride:12,attributes:[{shaderLocation:0,offset:0,format:`float32x3`}]},{arrayStride:12,attributes:[{shaderLocation:1,offset:0,format:`float32x3`}]},{arrayStride:4,attributes:[{shaderLocation:2,offset:0,format:`uint8x4`}]},{arrayStride:16,attributes:[{shaderLocation:3,offset:0,format:`float32x4`}]}],l=[{arrayStride:44,attributes:[{shaderLocation:0,offset:0,format:`float32x3`},{shaderLocation:1,offset:12,format:`float32x3`},{shaderLocation:2,offset:24,format:`float32x4`},{shaderLocation:3,offset:40,format:`float32`}]}],u=this.layouts,[d,f,p]=await Promise.all([a(`vessel`,u.vessel,`vs_vessel`,`fs_vessel`,{buffers:l,cull:`back`}),a(`vessel-glass-back`,u.vessel,`vs_vessel`,`fs_vessel_glass`,{buffers:l,cull:`front`,blend:!0,depthWrite:!1}),a(`vessel-glass-front`,u.vessel,`vs_vessel`,`fs_vessel_glass`,{buffers:l,cull:`back`,blend:!0,depthWrite:!1})]),[m,h,g,_,v,y,b,x,S,C,w,T,E,D,O,k,ee]=await Promise.all([a(`bg`,u.none,`vs_bg`,`fs_bg`,{depthWrite:!1,depthCompare:`always`}),a(`composite`,u.glass,`vs_bg`,`fs_composite`,{depthWrite:!1,depthCompare:`always`}),a(`flat`,u.none,`vs_flat`,`fs_flat`,{buffers:[o],cull:`back`}),a(`flat-blend`,u.none,`vs_flat`,`fs_flat`,{buffers:[o],cull:`back`,blend:!0,depthWrite:!1}),a(`line`,u.none,`vs_line`,`fs_line`,{buffers:[s],topology:`line-list`}),a(`overlay`,u.none,`vs_line`,`fs_line`,{buffers:[s],topology:`line-list`,depthWrite:!1,depthCompare:`always`}),a(`bead`,u.bead,`vs_bead`,`fs_bead`,{}),a(`sand`,u.bead,`vs_bead`,`fs_bead`,{constants:{SAND_ONLY:1}}),a(`gel`,u.none,`vs_gel`,`fs_gel`,{buffers:[o],cull:`front`,blend:!0}),a(`gel-glass`,u.glass,`vs_gel`,`fs_gel_glass`,{buffers:[o],cull:`front`,blend:!0}),a(`water`,u.none,`vs_water`,`fs_water`,{buffers:[o],cull:`front`,blend:!0}),a(`water-glass`,u.glass,`vs_water`,`fs_water_glass`,{buffers:[o],cull:`front`,blend:!0}),a(`hand`,u.hand,`vs_hand`,`fs_hand`,{buffers:c,cull:`back`,blend:!0,depthWrite:!1}),a(`panel`,u.panel,`vs_panel`,`fs_panel`,{blend:!0,depthWrite:!1}),a(`hand-occluder`,u.hand,`vs_hand_occluder`,`fs_occluder`,{buffers:c,cull:`back`,depthOnly:!0}),a(`forearm`,u.none,`vs_forearm`,`fs_occluder`,{buffers:[o],cull:`back`,depthOnly:!0}),a(`ui`,u.none,`vs_ui`,`fs_ui`,{buffers:[{arrayStride:28,attributes:[{shaderLocation:0,offset:0,format:`float32x3`},{shaderLocation:1,offset:12,format:`float32x4`}]}],blend:!0,depthWrite:!1})]);return{bg:m,composite:h,flat:g,flatBlend:_,line:v,overlay:y,bead:b,sand:x,gel:S,gelGlass:C,water:w,waterGlass:T,hand:E,panel:D,handOccluder:O,forearm:k,ui:ee,vessel:d,vesselGlassBack:f,vesselGlassFront:p}}setVessels(e){let t=(e,t)=>{let n=this.device.createBuffer({size:Math.max(4,e.byteLength),usage:GPUBufferUsage.VERTEX,mappedAtCreation:!0,label:t});return new Float32Array(n.getMappedRange()).set(e),n.unmap(),{vb:n,count:e.length/11}},n=new Float32Array(e.opaque.length+e.handle.length);n.set(e.opaque),n.set(e.handle,e.opaque.length),this.vesselOpaque=t(n,`goo-vessel-opaque`);let r=new Float32Array(e.glass.length+e.ice.length);r.set(e.glass),r.set(e.ice,e.glass.length),this.vesselGlass=t(r,`goo-vessel-glass`)}setVesselHandle(e){this.device.queue.writeBuffer(this.vesselParts,64,e)}setVesselParts(e,t){let n=Math.min(t.length/16,U-e);this.device.queue.writeBuffer(this.vesselParts,e*64,t,0,n*16)}setIceMatrices(e){let t=Math.min(e.length/16,U-2);this.device.queue.writeBuffer(this.vesselParts,128,e,0,t*16)}setRecipe(e){this.recipeBuffer??=this.device.createBuffer({size:64,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST,label:`goo-recipe`}),this.recipeGroup=this.device.createBindGroup({layout:this.panelLayout,entries:[{binding:2,resource:{buffer:this.recipeBuffer}},{binding:3,resource:e.createView()}]})}writeRecipe(e){this.recipeBuffer&&this.device.queue.writeBuffer(this.recipeBuffer,0,e)}drawRecipe(e,t){this.recipeGroup&&(e.setPipeline(t.panel),e.setBindGroup(1,this.recipeGroup),e.draw(6),e.setBindGroup(1,this.emptyGroup))}drawVessels(e,t,n){let r=this.vesselOpaque,i=this.vesselGlass;!r||!i||(e.setBindGroup(1,this.vesselGroup),n!==`over`&&(e.setPipeline(t.vessel),e.setVertexBuffer(0,r.vb),e.draw(r.count),e.setPipeline(t.vesselGlassBack),e.setVertexBuffer(0,i.vb),e.draw(i.count)),n!==`under`&&(e.setPipeline(t.vesselGlassFront),e.setVertexBuffer(0,i.vb),e.draw(i.count)),e.setBindGroup(1,this.emptyGroup))}makeGroup0(e){return this.device.createBindGroup({layout:this.layout0,entries:[{binding:0,resource:{buffer:e}},{binding:1,resource:{buffer:this.frameBuffer}},{binding:2,resource:{buffer:this.sim.boundsUniform}},{binding:3,resource:this.sim.densityTexture.createView()},{binding:4,resource:this.sampler},{binding:5,resource:this.envView}]})}slot(e){for(;this.slots.length<=e;){let e=this.device.createBuffer({size:et,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST,label:`goo-view-${this.slots.length}`});this.slots.push({buffer:e,group:this.makeGroup0(e)})}return this.slots[e]}writeView(e,t){let n=this.viewData,{m0:r,m1:i,m2:a}=this;g(r,t.proj,t.view),n.set(r,0),g(i,t.view,t.content),g(a,t.proj,i),n.set(a,16),n.set(t.view,32),n.set(i,48),n.set(t.proj,64),_(a,i),n[96]=a[12],n[97]=a[13],n[98]=a[14],n[99]=t.contentScale;for(let e=0;e<16;e++)i[e]=t.view[e];_(r,i),n[100]=r[12],n[101]=r[13],n[102]=r[14],n[103]=1,i[12]=i[13]=i[14]=0,g(a,t.proj,i),_(r,a),n.set(r,80),n[104]=this.backgroundIntensity,n[105]=+!!t.encodeSRGB,n[106]=+!!t.toneMapUnlit,n[107]=this.exposure,this.device.queue.writeBuffer(this.slot(e).buffer,0,n)}writeFrame(e){let t=this.frameData;t.fill(0);let{x:n,z:r}=this.sim.size;t[0]=n,t[5]=.02,t[10]=r,t[13]=.01,t[15]=1;let i=m(2763314);t[16]=i[0],t[17]=i[1],t[18]=i[2],t[19]=1;let a=m(5951712),o=m(1716288),s=Math.min(e.colliders.length,H-1);for(let n=0;n<s;n++){let r=(n+1)*20;t.set(e.colliders[n].model,r);let i=e.colliders[n].color,s=i??(n===e.selected?a:o);t[r+16]=s[0],t[r+17]=s[1],t[r+18]=s[2],t[r+19]=i?i[3]:n===e.selected?.65:.4}let c=H*20;t[c]=e.gel.threshold,t[481]=e.gel.absorb,t[482]=e.gel.stepLen,t[483]=e.gel.maxSteps;for(let n=0;n<2;n++){let r=e.wrists[n],i=484+n*4;r&&(t[i]=r[0],t[i+1]=r[1],t[i+2]=r[2],t[i+3]=1)}t[492]=e.beadSize,t[493]=this.sim.size.x,t[494]=this.sim.size.y,t[495]=this.sim.size.z;for(let n=0;n<2;n++){let r=e.forearms?.[n];r&&t.set(r,496+n*16)}t[528]=this.sim.floor,this.device.queue.writeBuffer(this.frameBuffer,0,t)}writeGizmo(e,t){let n=this.gizmoData,r=[[1,.1,.1],[.1,1,.1],[.15,.3,1]];for(let i=0;i<3;i++)for(let a=0;a<2;a++){let o=(i*2+a)*6;n[o]=e[0],n[o+1]=e[1],n[o+2]=e[2],a&&(n[o+i]+=t),n[o+3]=r[i][0],n[o+4]=r[i][1],n[o+5]=r[i][2]}this.device.queue.writeBuffer(this.gizmo,0,n)}isReady(e,t,n=!0){return this.ready.has(W(e,t,n))}ensureBackdrop(e,t,n){let r=this.backdrops[e],i=this.backdropDepths[e],a=this.backdropViews[e];if((!r||!i||!a||r.width!==t||r.height!==n)&&(r?.destroy(),i?.destroy(),r=this.device.createTexture({label:`goo-backdrop-${e}`,size:[t,n],format:`rgba16float`,usage:GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.TEXTURE_BINDING}),i=this.device.createTexture({label:`goo-backdrop-depth-${e}`,size:[t,n],format:rt,usage:GPUTextureUsage.RENDER_ATTACHMENT}),a={color:r.createView(),depth:i.createView()},this.backdrops[e]=r,this.backdropDepths[e]=i,this.backdropViews[e]=a,this.sceneGroups[e]=this.device.createBindGroup({layout:this.sceneLayout,entries:[{binding:4,resource:a.color}]})),!r||!a)throw Error(`backdrop`);return this.sceneGroup=this.sceneGroups[e],a}setOcclusion(e,t){this.ensureOcc(e);let n=this.occData[e];if(!t){(n[49]!==0||this.occTex[e])&&(n[49]=0,this.device.queue.writeBuffer(this.occBuf[e],0,n),this.occTex[e]&&(this.occTex[e]=null,this.occGroup[e]=this.makeOccGroup(this.occBuf[e],null,`float`)));return}for(let e=0;e<16;e++)n[e]=t.depthFromEye[e],n[16+e]=t.depthProj[e],n[32+e]=t.uvFromView[e];n[48]=t.rawValueToMeters,n[49]=t.kind===`float`?1:2,n[50]=t.width,n[51]=t.height,n[52]=it(t.depthProj),this.device.queue.writeBuffer(this.occBuf[e],0,n);let r=t.view?.baseArrayLayer??0;(this.occTex[e]!==t.texture||this.occLayer[e]!==r)&&(this.occTex[e]=t.texture,this.occLayer[e]=r,this.occGroup[e]=this.makeOccGroup(this.occBuf[e],t.texture,t.kind,t.view))}ensureOcc(e){for(;this.occBuf.length<=e;){let e=this.occBuf.length,t=this.device.createBuffer({size:256,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST,label:`goo-occ-${e}`});this.occBuf.push(t),this.occData.push(new Float32Array(64)),this.occGroup.push(this.makeOccGroup(t,null,`float`)),this.occTex.push(null),this.occLayer.push(-1)}}makeOccGroup(e,t,n,r){let i=t&&n===`float`?t.createView(r):this.occFloat.createView(),a=t&&n===`uint`?t.createView(r):this.occUint.createView();return this.device.createBindGroup({layout:this.occLayout,entries:[{binding:0,resource:{buffer:e}},{binding:1,resource:i},{binding:2,resource:a}]})}setWipe(e){if(!e&&!this.wipeLive)return;this.wipeLive=!!e;let t=(t,n,r,i)=>{let a=this.wipeData[t];e&&(a[0]=e[0],a[1]=e[1],a[2]=e[2],a[3]=e[3]),a[4]=n,a[5]=i,a[6]=.04,a[7]=r,this.device.queue.writeBuffer(this.wipeBuf[t],0,a)};if(!e){t(0,0,0,0),t(1,0,0,0);return}t(0,-1,0,1),t(1,1,1,1)}drawGoo(e,t,n,r){if(e.setBindGroup(3,this.wipeGroup[r]),n===`beads`){e.setPipeline(t.bead),e.setBindGroup(1,this.beadGroups[this.sim.current]),e.draw(6,this.sim.count);return}e.setPipeline(n===`glass`?t.gelGlass:t.gel),n===`glass`&&e.setBindGroup(1,this.sceneGroup),e.setVertexBuffer(0,this.cube),e.draw(36),e.setPipeline(n===`glass`?t.waterGlass:t.water),e.draw(36),e.setPipeline(t.sand),e.setBindGroup(1,this.beadGroups[this.sim.current]),e.draw(6,this.sim.count)}drawScene(e,t,n,r=t){n(e),e.setBindGroup(0,this.slot(t).group),e.setBindGroup(1,this.emptyGroup),this.bindOcclusion(e,r),e.setBindGroup(3,this.wipeGroup[0])}bindOcclusion(e,t){this.ensureOcc(t),e.setBindGroup(2,this.occGroup[t])}drawBackdrop(e,t,n){let r=this.ready.get(`rgba16float|1`);if(!r)return;let i=n.eye??t;e.setBindGroup(0,this.slot(t).group),this.bindOcclusion(e,i),e.setBindGroup(3,this.wipeGroup[0]),n.background!==!1&&(e.setPipeline(r.bg),e.draw(3)),n.scene&&this.drawScene(e,t,n.scene,i),n.floor!==!1&&(e.setPipeline(r.flat),e.setVertexBuffer(0,this.cube),e.draw(36,1,0,0),e.setPipeline(r.line),e.setVertexBuffer(0,this.grid),e.draw(this.gridCount)),this.drawVessels(e,r,`under`),this.drawRecipe(e,r);let a=Math.min(n.colliders.length,H-1);if(a){e.setPipeline(r.flatBlend);for(let t=0;t<a;t++){if(n.colliders[t].hidden)continue;let r=n.colliders[t].kind===`sphere`;e.setVertexBuffer(0,r?this.sphere:this.cube),e.draw(r?this.sphereCount:36,1,0,t+1)}}e.setPipeline(r.sand),e.setBindGroup(1,this.beadGroups[this.sim.current]),e.draw(6,this.sim.count)}draw(e,t,n,r,i,a=!0){let o=this.ready.get(W(n,r,a));if(!o)return;if(e.setBindGroup(0,this.slot(t).group),this.bindOcclusion(e,t),e.setBindGroup(3,this.wipeGroup[0]),i.composite?(e.setPipeline(o.composite),e.setBindGroup(1,this.sceneGroup),e.draw(3),e.setBindGroup(1,this.emptyGroup)):(i.background!==!1&&(e.setPipeline(o.bg),e.draw(3)),i.scene&&this.drawScene(e,t,i.scene)),i.occluders&&(i.occluders[0]||i.occluders[1])){e.setPipeline(o.forearm),e.setVertexBuffer(0,this.sphere);for(let t=0;t<2;t++)i.occluders[t]&&e.draw(this.sphereCount,1,0,t);e.setPipeline(o.handOccluder),e.setBindGroup(1,this.handGroup);for(let t=0;t<2;t++){let n=this.hands[t];if(!(!n||!i.occluders[t])){for(let t=0;t<4;t++)e.setVertexBuffer(t,n.vb[t]);e.setIndexBuffer(n.ib,`uint16`),e.drawIndexed(n.count,1,0,0,t)}}}i.floor!==!1&&!i.composite&&(e.setPipeline(o.flat),e.setVertexBuffer(0,this.cube),e.draw(36,1,0,0),e.setPipeline(o.line),e.setVertexBuffer(0,this.grid),e.draw(this.gridCount)),i.composite||this.drawVessels(e,o,`under`);let s=$e(i);!i.wipe&&s===`beads`&&this.drawGoo(e,o,`beads`,0);let c=i.composite?0:Math.min(i.colliders.length,H-1);if(c){e.setPipeline(o.flatBlend);for(let t=0;t<c;t++){if(i.colliders[t].hidden)continue;let n=i.colliders[t].kind===`sphere`;e.setVertexBuffer(0,n?this.sphere:this.cube),e.draw(n?this.sphereCount:36,1,0,t+1)}}if(i.wipe?(this.drawGoo(e,o,i.wipe.from,0),this.drawGoo(e,o,i.wipe.to,1)):(s===`solid`||s===`glass`)&&this.drawGoo(e,o,s,0),this.drawVessels(e,o,`over`),a&&this.flameDraw&&this.flameDraw(e,n,r),i.composite||this.drawRecipe(e,o),i.hands[0]||i.hands[1]){e.setPipeline(o.hand),e.setBindGroup(1,this.handGroup);for(let t=0;t<2;t++){let n=this.hands[t];if(!(!n||!i.hands[t])){for(let t=0;t<4;t++)e.setVertexBuffer(t,n.vb[t]);e.setIndexBuffer(n.ib,`uint16`),e.drawIndexed(n.count,1,0,0,t)}}}i.panel&&this.panelGroup&&this.panelTexture&&(e.setPipeline(o.panel),e.setBindGroup(1,this.panelGroup),e.draw(6)),i.ui&&this.uiCount&&(e.setPipeline(o.ui),e.setVertexBuffer(0,this.uiBuffer),e.draw(this.uiCount)),i.gizmo&&(e.setPipeline(o.overlay),e.setVertexBuffer(0,this.gizmo),e.draw(6))}},dt=class{mid;width;minMs;on=!1;since=-1;constructor(e,t,n=22){this.mid=e,this.width=t,this.minMs=n}update(e,t){let n=this.on?e>this.mid-this.width/2:e>=this.mid+this.width/2;return n===this.on?(this.since=-1,this.on):(this.since<0&&(this.since=t),t-this.since>=this.minMs&&(this.on=n,this.since=-1),this.on)}reset(){this.on=!1,this.since=-1}},K=[5,10,15,20],ft=.004,pt=.045,mt=.025,ht=.095,q=.015,gt=.022;function _t(){return{tracked:!1,confident:!1,size:ht,pinchStrength:new Float32Array(4),palmStrength:new Float32Array(4),thumbCurl:0,pinching:[!1,!1,!1,!1],wasPinching:[!1,!1,!1,!1],curled:[!1,!1,!1,!1],wasCurled:[!1,!1,!1,!1],pinchFinger:0,pinchPoint:[0,0,0],palmPoint:[0,0,0],palmNormal:[0,-1,0],pointer:{valid:!1,origin:[0,0,0],dir:[0,0,-1]}}}function vt(e,t=0){return e.pinching[t]&&!e.wasPinching[t]}function yt(e,t,n,r){let i=e[n*16+12]-e[t*16+12],a=e[n*16+13]-e[t*16+13],o=e[n*16+14]-e[t*16+14],s=e[r*16+12]-e[n*16+12],c=e[r*16+13]-e[n*16+13],l=e[r*16+14]-e[n*16+14],u=Math.hypot(i,a,o)*Math.hypot(s,c,l);return u>1e-10?Math.acos(Math.max(-1,Math.min(1,(i*s+a*c+o*l)/u))):0}function bt(e,t,n){return Math.hypot(e[t*16+12]-e[n*16+12],e[t*16+13]-e[n*16+13],e[t*16+14]-e[n*16+14])}function xt(e,t,n,r){let i=e[n*16+12],a=e[n*16+13],o=e[n*16+14],s=e[r*16+12]-i,c=e[r*16+13]-a,l=e[r*16+14]-o,u=e[t*16+12]-i,d=e[t*16+13]-a,f=e[t*16+14]-o,p=Math.max(0,Math.min(1,(u*s+d*c+f*l)/(s*s+c*c+l*l||1)));return Math.hypot(u-s*p,d-c*p,f-l*p)}var St=e=>Math.max(0,Math.min(1,e)),Ct=class{input=_t();pinchState=[0,1,2,3].map(()=>new dt(.8,.2));curlState=[0,1,2,3].map(()=>new dt(.55,.2));reset(){let e=this.input;e.tracked=e.confident=!1;for(let t=0;t<4;t++)this.pinchState[t].reset(),this.curlState[t].reset(),e.pinching[t]=e.wasPinching[t]=e.curled[t]=e.wasCurled[t]=!1,e.pinchStrength[t]=e.palmStrength[t]=0;e.pointer.valid=!1}update(e,t,n,r,i){let a=this.input;a.tracked=!0,a.confident=n&&r>.5;for(let e=0;e<4;e++)a.wasPinching[e]=a.pinching[e],a.wasCurled[e]=a.curled[e];if(!n)return;a.size=Math.max(.06,Math.min(.13,bt(e,0,11)));let o=a.size/ht,s=0,c=-1;for(let n=0;n<4;n++){let r=K[n],l=r+4,u=1-St((bt(e,4,l)-t[4]-t[l]-ft*o)/((pt-ft)*o));if(n===0){let n=xt(e,4,r+2,r+3)-t[4]-t[r+2];u=Math.max(u,1-St((n-ft*o)/((mt-ft)*o)))}a.pinchStrength[n]=u,a.pinching[n]=this.pinchState[n].update(u,i),u>c&&(c=u,s=n);let d=yt(e,r,r+1,r+2)+yt(e,r+1,r+2,r+3)+yt(e,r+2,r+3,r+4);a.palmStrength[n]=St((d-.6)/3),a.curled[n]=this.curlState[n].update(a.palmStrength[n],i)}a.thumbCurl=St((yt(e,1,2,3)+yt(e,2,3,4)-.3)/1.4),a.pinchFinger=c>.2?s:0;let l=(K[a.pinchFinger]+4)*16,u=e[l+12]-e[76],d=e[l+13]-e[77],f=e[l+14]-e[78],p=Math.hypot(u,d,f)/2,m=Math.min(p,q*o)/(p||1)/2;u*=m,d*=m,f*=m,a.pinchPoint[0]=e[76]+u,a.pinchPoint[1]=e[77]+d,a.pinchPoint[2]=e[78]+f;let h=Math.hypot(e[4],e[5],e[6])||1;a.palmNormal[0]=-e[4]/h,a.palmNormal[1]=-e[5]/h,a.palmNormal[2]=-e[6]/h;for(let t=0;t<3;t++)a.palmPoint[t]=(e[172+t]+e[188+t])/2+a.palmNormal[t]*gt*o}},wt=(e,t)=>1/(1+1/(2*Math.PI*e*t)),Tt=class{n;p;value;prev;deriv;primed=!1;constructor(e,t){this.n=e,this.p=t,this.value=new Float32Array(e),this.prev=new Float32Array(e),this.deriv=new Float32Array(e)}reset(){this.primed=!1}filter(e,t){let{value:n,prev:r,deriv:i,n:a}=this;if(!this.primed||t<=0){for(let t=0;t<a;t++)n[t]=r[t]=e[t];return i.fill(0),this.primed=!0,n}let o=wt(this.p.dCutoff,t),s=0;for(let n=0;n<a;n++)i[n]+=((e[n]-r[n])/t-i[n])*o,s+=i[n]*i[n];let c=wt(this.p.minCutoff+this.p.beta*Math.sqrt(s),t);for(let t=0;t<a;t++)n[t]+=(e[t]-n[t])*c,r[t]=e[t];return n}},Et={wristPosition:{minCutoff:1.6,beta:28,dCutoff:1},wristRotation:{minCutoff:1.6,beta:6,dCutoff:1},fingerPosition:{minCutoff:2.4,beta:40,dCutoff:1},fingerRotation:{minCutoff:2.4,beta:8,dCutoff:1}},Dt=25;function Ot(e,t,n,r=0){let i=e[t],a=e[t+1],o=e[t+2],s=e[t+4],c=e[t+5],l=e[t+6],u=e[t+8],d=e[t+9],f=e[t+10],p=i+c+f,m,h,g,_;if(p>0){let e=Math.sqrt(p+1)*2;_=.25*e,m=(l-d)/e,h=(u-o)/e,g=(a-s)/e}else if(i>c&&i>f){let e=Math.sqrt(1+i-c-f)*2;_=(l-d)/e,m=.25*e,h=(s+a)/e,g=(u+o)/e}else if(c>f){let e=Math.sqrt(1+c-i-f)*2;_=(u-o)/e,m=(s+a)/e,h=.25*e,g=(d+l)/e}else{let e=Math.sqrt(1+f-i-c)*2;_=(a-s)/e,m=(u+o)/e,h=(d+l)/e,g=.25*e}n[r]=m,n[r+1]=h,n[r+2]=g,n[r+3]=_}function kt(e,t,n,r,i,a,o){let s=e[t],c=e[t+1],l=e[t+2],u=e[t+3],d=Math.hypot(s,c,l,u)||1;s/=d,c/=d,l/=d,u/=d,a[o]=1-2*(c*c+l*l),a[o+1]=2*(s*c+l*u),a[o+2]=2*(s*l-c*u),a[o+3]=0,a[o+4]=2*(s*c-l*u),a[o+5]=1-2*(s*s+l*l),a[o+6]=2*(c*l+s*u),a[o+7]=0,a[o+8]=2*(s*l+c*u),a[o+9]=2*(c*l-s*u),a[o+10]=1-2*(s*s+c*c),a[o+11]=0,a[o+12]=n,a[o+13]=r,a[o+14]=i,a[o+15]=1}function At(e,t,n,r,i,a){let o=e[t],s=e[t+1],c=e[t+2],l=e[t+3],u=n[r],d=n[r+1],f=n[r+2],p=n[r+3];i[a]=l*u+o*p+s*f-c*d,i[a+1]=l*d-o*f+s*p+c*u,i[a+2]=l*f+o*d-s*u+c*p,i[a+3]=l*p-o*u-s*d-c*f}var jt=class{wristPos;wristRot;jointPos;jointRot;q=new Float32Array(Dt*4);local=new Float32Array(7);lastRot=new Float32Array(Dt*4);tmp=new Float32Array(4);inv=new Float32Array(4);fw=new Float32Array(4);enabled=!0;constructor(e=Et){this.wristPos=new Tt(3,e.wristPosition),this.wristRot=new Tt(4,e.wristRotation),this.jointPos=Array.from({length:Dt},()=>new Tt(3,e.fingerPosition)),this.jointRot=Array.from({length:Dt},()=>new Tt(4,e.fingerRotation))}reset(){this.wristPos.reset(),this.wristRot.reset();for(let e of this.jointPos)e.reset();for(let e of this.jointRot)e.reset();this.lastRot.fill(0)}continuous(e,t,n){let r=this.lastRot;r[n*4]*e[t]+r[n*4+1]*e[t+1]+r[n*4+2]*e[t+2]+r[n*4+3]*e[t+3]<0&&(e[t]=-e[t],e[t+1]=-e[t+1],e[t+2]=-e[t+2],e[t+3]=-e[t+3])}apply(e,t,n){if(!this.enabled){t.set(e);return}let r=this.q;for(let t=0;t<Dt;t++)Ot(e,t*16,r,t*4);this.continuous(r,0,0);let i=this.wristPos.filter(e.subarray(12,15),n),a=this.wristRot.filter(r.subarray(0,4),n);this.lastRot.set(a,0),kt(a,0,i[0],i[1],i[2],t,0);let o=Math.hypot(a[0],a[1],a[2],a[3])||1,s=this.fw;for(let e=0;e<4;e++)s[e]=a[e]/o;let c=this.inv;c[0]=-r[0],c[1]=-r[1],c[2]=-r[2],c[3]=r[3];let l=e,u=this.local,d=this.tmp;for(let e=1;e<Dt;e++){let a=e*16,o=l[a+12]-l[12],f=l[a+13]-l[13],p=l[a+14]-l[14];u[0]=l[0]*o+l[1]*f+l[2]*p,u[1]=l[4]*o+l[5]*f+l[6]*p,u[2]=l[8]*o+l[9]*f+l[10]*p,At(c,0,r,e*4,u,3);let m=u.subarray(3,7);this.continuous(m,0,e);let h=this.jointPos[e].filter(u,n),g=this.jointRot[e].filter(m,n);this.lastRot.set(g,e*4);let _=t,v=i[0]+_[0]*h[0]+_[4]*h[1]+_[8]*h[2],y=i[1]+_[1]*h[0]+_[5]*h[1]+_[9]*h[2],b=i[2]+_[2]*h[0]+_[6]*h[1]+_[10]*h[2];At(s,0,g,0,d,0),kt(d,0,v,y,b,t,a)}}},Mt=[{from:`thumb-metacarpal`,to:`thumb-phalanx-proximal`},{from:`thumb-phalanx-proximal`,to:`thumb-phalanx-distal`},{from:`thumb-phalanx-distal`,to:`thumb-tip`},{from:`index-finger-metacarpal`,to:`index-finger-phalanx-proximal`},{from:`index-finger-phalanx-proximal`,to:`index-finger-phalanx-intermediate`},{from:`index-finger-phalanx-intermediate`,to:`index-finger-phalanx-distal`},{from:`index-finger-phalanx-distal`,to:`index-finger-tip`},{from:`middle-finger-metacarpal`,to:`middle-finger-phalanx-proximal`},{from:`middle-finger-phalanx-proximal`,to:`middle-finger-phalanx-intermediate`},{from:`middle-finger-phalanx-intermediate`,to:`middle-finger-phalanx-distal`},{from:`middle-finger-phalanx-distal`,to:`middle-finger-tip`},{from:`ring-finger-metacarpal`,to:`ring-finger-phalanx-proximal`},{from:`ring-finger-phalanx-proximal`,to:`ring-finger-phalanx-intermediate`},{from:`ring-finger-phalanx-intermediate`,to:`ring-finger-phalanx-distal`},{from:`ring-finger-phalanx-distal`,to:`ring-finger-tip`},{from:`pinky-finger-metacarpal`,to:`pinky-finger-phalanx-proximal`},{from:`pinky-finger-phalanx-proximal`,to:`pinky-finger-phalanx-intermediate`},{from:`pinky-finger-phalanx-intermediate`,to:`pinky-finger-phalanx-distal`},{from:`pinky-finger-phalanx-distal`,to:`pinky-finger-tip`},{from:`wrist`,to:`thumb-metacarpal`,palm:!0},{from:`wrist`,to:`index-finger-metacarpal`,palm:!0},{from:`wrist`,to:`middle-finger-metacarpal`,palm:!0},{from:`wrist`,to:`ring-finger-metacarpal`,palm:!0},{from:`wrist`,to:`pinky-finger-metacarpal`,palm:!0}],Nt=[`wrist`,`thumb-metacarpal`,`thumb-phalanx-proximal`,`thumb-phalanx-distal`,`thumb-tip`,`index-finger-metacarpal`,`index-finger-phalanx-proximal`,`index-finger-phalanx-intermediate`,`index-finger-phalanx-distal`,`index-finger-tip`,`middle-finger-metacarpal`,`middle-finger-phalanx-proximal`,`middle-finger-phalanx-intermediate`,`middle-finger-phalanx-distal`,`middle-finger-tip`,`ring-finger-metacarpal`,`ring-finger-phalanx-proximal`,`ring-finger-phalanx-intermediate`,`ring-finger-phalanx-distal`,`ring-finger-tip`,`pinky-finger-metacarpal`,`pinky-finger-phalanx-proximal`,`pinky-finger-phalanx-intermediate`,`pinky-finger-phalanx-distal`,`pinky-finger-tip`],Pt=new Map(Nt.map((e,t)=>[e,t])),Ft=Mt.map(e=>({from:Pt.get(e.from),to:Pt.get(e.to),palm:!!e.palm,tip:e.to.endsWith(`-tip`)}));async function It(e){let t=await(await fetch(e)).arrayBuffer(),n=new DataView(t).getUint32(12,!0),r=JSON.parse(new TextDecoder().decode(new Uint8Array(t,20,n))),i=20+n+8,a=(e,n,a)=>{let o=r.accessors[e],s=r.bufferViews[o.bufferView],c=i+(s.byteOffset??0)+(o.byteOffset??0);return new n(t.slice(c,c+o.count*a*n.BYTES_PER_ELEMENT),0,o.count*a)},o=r.meshes[0].primitives[0],s=r.skins[0],c=new Uint8Array(s.joints.map(e=>{let t=Pt.get(r.nodes[e].name);if(t===void 0)throw Error(`hand joint ${r.nodes[e].name} not in WebXR set`);return t}));return{position:a(o.attributes.POSITION,Float32Array,3),normal:a(o.attributes.NORMAL,Float32Array,3),joints:a(o.attributes.JOINTS_0,Uint8Array,4),weights:a(o.attributes.WEIGHTS_0,Float32Array,4),indices:a(o.indices,Uint16Array,1),jointMap:c,inverseBind:a(s.inverseBindMatrices,Float32Array,16)}}var Lt=150,Rt=250,zt=[9,14,19,24];function Bt(){return{visible:!1,fresh:!1,thumb:[0,0,0],tips:zt.map(()=>[0,0,0]),radii:[0,0,0,0,0],origin:[0,0,0],axes:[[1,0,0],[0,1,0],[0,0,1]],perMetre:1,pinchPoint:[0,0,0],palmPoint:[0,0,0],input:_t()}}var Vt={length:.32,overlap:.03,width:.036,thickness:.03};function Ht(e,t){if(!e.visible)return!1;let n=e.poses,r=(e,t)=>n[e*16+12+t],i=[r(0,0),r(0,1),r(0,2)],a=[0,1,2].map(e=>i[e]-r(11,e)),o=Math.hypot(a[0],a[1],a[2]);if(o<1e-4)return!1;for(let e=0;e<3;e++)a[e]/=o;let s=[0,1,2].map(e=>r(20,e)-r(5,e)),c=s[0]*a[0]+s[1]*a[1]+s[2]*a[2];for(let e=0;e<3;e++)s[e]-=c*a[e];let l=Math.hypot(s[0],s[1],s[2]);if(l<1e-4)return!1;for(let e=0;e<3;e++)s[e]/=l;let u=[a[1]*s[2]-a[2]*s[1],a[2]*s[0]-a[0]*s[2],a[0]*s[1]-a[1]*s[0]],d=Vt.length/2-Vt.overlap;t.fill(0);for(let e=0;e<3;e++)t[e]=s[e]*2*Vt.width,t[4+e]=u[e]*2*Vt.thickness,t[8+e]=a[e]*Vt.length,t[12+e]=i[e]+a[e]*d;return t[15]=1,!0}function Ut(e,t,n,r){let i;try{i=e.getPose(t.targetRaySpace,n)??void 0}catch{return}if(!i)return;let a=i.transform.position,o=i.transform.orientation,s=r.pointer;s.origin[0]=a.x,s.origin[1]=a.y,s.origin[2]=a.z,s.dir[0]=-(2*(o.x*o.z+o.w*o.y)),s.dir[1]=-(2*(o.y*o.z-o.w*o.x)),s.dir[2]=-(1-2*(o.x*o.x+o.y*o.y)),s.valid=!0}function Wt(e){return{visible:!1,fresh:!1,weight:0,seenAt:-1/0,poses:new Float32Array(400),raw:new Float32Array(400),visual:new Float32Array(400),radii:new Float32Array(25),wrist:[0,0,0],input:e.input}}var Gt=class{apis=[new Ct,new Ct];filters=[new jt,new jt];left=Wt(this.apis[0]);right=Wt(this.apis[1]);spaces=[];scratch=[0,1].map(()=>({poses:new Float32Array(400),radii:new Float32Array(25)}));lastUpdate=0;set filtering(e){for(let t of this.filters)t.enabled=e}settle(e,t){let n=this.lastUpdate?Math.min(100,e-this.lastUpdate):0;this.lastUpdate=e,[this.left,this.right].forEach((r,i)=>{let a=t.find(([e])=>e===r),o=this.apis[i];a?(r.visible||this.filters[i].reset(),r.raw.set(a[1]),this.filters[i].apply(r.raw,r.poses,n/1e3),r.visual.set(r.poses),r.radii.set(a[2]),r.weight=r.visible?Math.min(1,r.weight+n/Rt):0,r.visible=r.fresh=!0,r.seenAt=e,r.wrist[0]=r.poses[12],r.wrist[1]=r.poses[13],r.wrist[2]=r.poses[14],o.update(r.poses,r.radii,!0,r.weight,e)):(r.fresh=!1,r.visible=e-r.seenAt<Lt,r.visible?o.update(r.poses,r.radii,!1,r.weight,e):(r.weight=0,o.reset()))})}replay(e,t,n){let r=[];for(let[e,i]of[[this.left,t],[this.right,n]]){if(!i)continue;let t=this.scratch[e===this.left?0:1];t.poses.set(i.poses),t.radii.set(i.radii),r.push([e,t.poses,t.radii])}this.settle(e,r)}update(e,t,n,r=performance.now()){let i=[];this.left.input.pointer.valid=this.right.input.pointer.valid=!1;for(let r of n.inputSources){if(!r.hand||r.handedness!==`left`&&r.handedness!==`right`)continue;let n=r.handedness===`left`?this.left:this.right;Ut(e,r,t,n.input),this.spaces.length=0;let a=!0;for(let e of Nt){let t=r.hand.get(e);if(!t){a=!1;break}this.spaces.push(t)}if(!a)continue;let o=this.scratch[n===this.left?0:1],s=e.fillPoses,c=e.fillJointRadii;if(s&&c){if(!s.call(e,this.spaces,t,o.poses)||!c.call(e,this.spaces,o.radii))continue}else{for(let n=0;n<25;n++){let r=e.getJointPose?.(this.spaces[n],t);if(!r){a=!1;break}o.poses.set(r.transform.matrix,n*16),o.radii[n]=r.radius}if(!a)continue}i.push([n,o.poses,o.radii])}this.settle(r,i)}grip(e,t,n,r){let i=e===0?this.right:this.left;if(r.visible=i.visible,r.fresh=i.fresh,r.input=i.input,!i.visible)return;let a=i.poses,o=1/t.scale;r.perMetre=o;let s=(e,r)=>h((a[e*16+12]-t.x)*o,(a[e*16+13]-t.y)*o+.5,(a[e*16+14]-t.z)*o,n,r),c=(e,r)=>h((e[0]-t.x)*o,(e[1]-t.y)*o+.5,(e[2]-t.z)*o,n,r);s(4,r.thumb),zt.forEach((e,t)=>s(e,r.tips[t])),c(i.input.pinchPoint,r.pinchPoint),c(i.input.palmPoint,r.palmPoint),r.radii[0]=i.radii[4]*o,zt.forEach((e,t)=>{r.radii[t+1]=i.radii[e]*o}),s(0,r.origin);for(let e=0;e<3;e++){let t=h(a[e*4],a[e*4+1],a[e*4+2],n,r.axes[e]),i=Math.hypot(t[0],t[1],t[2])||1;t[0]/=i,t[1]/=i,t[2]/=i}}writeSkin(e,t,n=!0){let r=[this.left,this.right];for(let i=0;i<2;i++){let a=t[i],o=r[i];if(!a||!o.visible)continue;let s=n?o.visual:o.poses;for(let t=0;t<a.jointMap.length;t++){let n=a.jointMap[t];g(e.subarray((i*25+t)*16,(i*25+t+1)*16),s.subarray(n*16,n*16+16),a.inverseBind.subarray(t*16,t*16+16))}}}eachBone(e,t,n){let r=1/e.scale,i=this.box,a=[0,0,0],o=(e,n,r)=>h(e,n,r,t,a);[this.right,this.left].forEach((t,a)=>{if(!t.visible)return;let s=t.poses;Ft.forEach((c,l)=>{let u=c.from*16,d=c.to*16,f=o((s[u+12]-e.x)*r,(s[u+13]-e.y)*r+.5,(s[u+14]-e.z)*r),p=f[0],m=f[1],h=f[2],g=o((s[d+12]-e.x)*r,(s[d+13]-e.y)*r+.5,(s[d+14]-e.z)*r),_=g[0],v=g[1],y=g[2],b=_-p,x=v-m,S=y-h,C=Math.hypot(b,x,S);if(C<1e-5)return;b/=C,x/=C,S/=C;let w=o(s[u+4],s[u+5],s[u+6]),T=w[0],E=w[1],D=w[2],O=T*b+E*x+D*S;T-=b*O,E-=x*O,D-=S*O,T*T+E*E+D*D<1e-8&&([T,E,D]=Math.abs(x)>.9?[1,0,0]:[0,1,0],O=T*b+E*x+D*S,T-=b*O,E-=x*O,D-=S*O);let k=Math.hypot(T,E,D);T/=k,E/=k,D/=k;let ee=x*D-S*E,A=S*T-b*D,te=b*E-x*T,ne=Math.hypot(ee,A,te);ee/=ne,A/=ne,te/=ne,T=A*S-te*x,E=te*b-ee*S,D=ee*x-A*b,k=Math.hypot(T,E,D),T/=k,E/=k,D/=k;let re=(t.radii[c.from]+t.radii[c.to])*.5*r,j=Math.max(re*(c.palm?1.15:c.tip?.7:.55),.0035);i.c[0]=(p+_)*.5,i.c[1]=(m+v)*.5,i.c[2]=(h+y)*.5,i.a[0]=b,i.a[1]=x,i.a[2]=S,i.b[0]=T,i.b[1]=E,i.b[2]=D,i.n[0]=ee,i.n[1]=A,i.n[2]=te,i.half[0]=Math.max(C*.5,.005),i.half[1]=j,i.half[2]=c.tip?j:Math.max(re*(c.palm?.75:.4),.0028),i.palm=c.palm,i.tip=c.tip,i.weight=t.weight,n(i,a*Ft.length+l)})})}box={c:[0,0,0],a:[1,0,0],b:[0,1,0],n:[0,0,1],half:[0,0,0],palm:!1,tip:!1,weight:1};gatherForces(e,t,n,r,i,a,o=0,s=0){let c=this.bonePrev,l=this.boneSeen,u=this.boneLive.fill(0);this.eachBone(n,a,(n,a)=>{let d=n.c[0]+i.x/2,f=n.c[1]+o,p=n.c[2]+i.z/2,m=a*3,h=0,g=0,_=0;if(l[a]&&s>0){h=(d-c[m])/s,g=(f-c[m+1])/s,_=(p-c[m+2])/s;let e=Math.hypot(h,g,_);e>Kt&&(h*=Kt/e,g*=Kt/e,_*=Kt/e)}if((s>0||!l[a])&&(c[m]=d,c[m+1]=f,c[m+2]=p),u[a]=1,e.length>=t.length||d<-.12||d>i.x+.12||f<-.12||f>i.y+.12||p<-.12||p>i.z+.12)return;let v=t[e.length];v.x=Math.min(i.x-.02,Math.max(.02,d)),v.y=Math.min(i.y-.02,Math.max(.02,f)),v.z=Math.min(i.z-.02,Math.max(.02,p)),v.strength=r*n.weight*(n.palm?.85:n.tip?1:.95),v.isCapsule=n.tip,v.isBox=!n.tip,v.radius=n.half[1],v.hx=n.half[0],v.hy=n.half[1],v.hz=n.half[2],v.ax=n.a[0],v.ay=n.a[1],v.az=n.a[2],v.bx=n.b[0],v.by=n.b[1],v.bz=n.b[2],v.cx=n.n[0],v.cy=n.n[1],v.cz=n.n[2],v.vx=h,v.vy=g,v.vz=_,v.couple=qt*n.weight,v.attract=!1,e.push(v)}),l.set(u)}bonePrev=new Float32Array(2*Ft.length*3);boneSeen=new Uint8Array(2*Ft.length);boneLive=new Uint8Array(2*Ft.length)},Kt=16,qt=.2,Jt=Ft.length,Yt=8100,Xt=e=>Math.round(e*1e5)/1e5,Zt=class{frames=[];start=0;scale=1;inv=u();tmp=u();capture(e,t,n,r,i){if(this.frames.length>=Yt)return;this.frames.length||(this.start=e),this.scale=n,_(this.inv,t);let a=e=>{if(!e.fresh)return null;let t=[];for(let n=0;n<25;n++){g(this.tmp,this.inv,e.raw.subarray(n*16,n*16+16));for(let e=0;e<16;e++)t.push(Xt(this.tmp[e]))}return{p:t,r:Array.from(e.radii,e=>Xt(e/n))}};this.frames.push({t:Math.round(e-this.start),l:a(r),r:a(i)})}get length(){return this.frames.length}async save(){if(!this.frames.length)return null;let e=await fetch(`/__handrec`,{method:`POST`,body:JSON.stringify({scale:this.scale,frames:this.frames})});return this.frames.length=0,e.ok?e.text():null}},Qt=class e{take;poses=[new Float32Array(400),new Float32Array(400)];radii=[new Float32Array(25),new Float32Array(25)];duration;start=-1;cursor=0;constructor(e){this.take=e,this.duration=e.frames.length?e.frames[e.frames.length-1].t+1:1}get scale(){return this.take.scale||1}static async load(t){return new e(await(await fetch(t)).json())}sample(e,t){let n=this.take.frames;if(!n.length)return[null,null];this.start<0&&(this.start=e);let r=(e-this.start)%this.duration;for(r<n[this.cursor].t&&(this.cursor=0);this.cursor+1<n.length&&n[this.cursor+1].t<=r;)this.cursor++;let i=n[this.cursor];return[i.l,i.r].map((e,n)=>{if(!e)return null;for(let r=0;r<25;r++)g(this.poses[n].subarray(r*16,r*16+16),t,e.p.slice(r*16,r*16+16));return this.radii[n].set(e.r),{poses:this.poses[n],radii:this.radii[n]}})}},$t={distance:.48,height:.88,framedSize:.42},J={min:.14,max:.95},en=1.5,tn=30,nn=1.15,rn={x:1,y:1.4,z:.8},an={w:.16,h:.06,hint:.04},on=[{x:-an.w/4,y:0,hw:an.w/4-.003,hh:an.h/2-.003},{x:an.w/4,y:0,hw:an.w/4-.003,hh:an.h/2-.003}],sn=class e{device;hooks;session;binding;layer;refSpace;colorFormat;floor;handTracking;passthrough;cameraAccess;spaceWarp;depthSensing;rig={x:0,y:0,z:0,scale:$t.framedSize};contentYaw=0;get anchored(){return!this.pendingAnchor}panel={x:0,y:0,z:0,yaw:0};framedSize=$t.framedSize;anchor=[0,0,0];hudBase=[0,0,0];pan=[0,0,0];pendingAnchor=!0;framesSeen=0;drags=new Map;scaleGesture=null;spinAngle=null;depth=[];depthFromEye=new Float32Array(16);constructor(e,t,n,r,i,a,o,s,c,l){this.device=c,this.hooks=l,this.session=e,this.binding=t,this.layer=n,this.refSpace=r,this.colorFormat=i,this.floor=a,this.handTracking=!!e.enabledFeatures?.includes(`hand-tracking`),this.passthrough=e.environmentBlendMode===`alpha-blend`||e.environmentBlendMode===`additive`,this.cameraAccess=!!e.enabledFeatures?.includes(`camera-access`),this.spaceWarp=o,this.depthSensing=s,this.layout(),e.addEventListener(`selectstart`,e=>this.onSelectStart(e)),e.addEventListener(`selectend`,e=>this.onSelectEnd(e))}static async diagnose(e){return navigator.xr?await navigator.xr.isSessionSupported(e).catch(()=>!1)?`XRGPUBinding`in globalThis?null:`no WebXR/WebGPU binding (XRGPUBinding)`:`${e} not supported`:`no WebXR (navigator.xr)`}static preferHands=!0;static async start(t,n,r,i=!1){let a=[`local-floor`,`bounded-floor`,`layers`];e.preferHands&&a.push(`hand-tracking`),r===`immersive-ar`&&a.push(`camera-access`,`depth-sensing`),i&&a.push(`space-warp`);let o={requiredFeatures:[`webgpu`],optionalFeatures:a};r===`immersive-ar`&&(o.depthSensing={usagePreference:[`gpu-optimized`],dataFormatPreference:[`float32`,`unsigned-short`],matchDepthView:!1});let s;try{s=await ln(r,o,6e3)}catch(t){throw e.preferHands=!1,t}try{let r=new XRGPUBinding(s,t),a=r.getPreferredColorFormat?.()??navigator.gpu.getPreferredCanvasFormat(),o=i&&!!s.enabledFeatures?.includes(`space-warp`),c=r.createProjectionLayer({colorFormat:a,scaleFactor:Number(new URLSearchParams(location.search).get(`xrscale`)??1),...o?{depthStencilFormat:`depth24plus`}:{}});s.updateRenderState({layers:[c]});let l=!!s.enabledFeatures?.includes(`local-floor`),u=await s.requestReferenceSpace(l?`local-floor`:`local`),d=e.depthFormat(s);return d&&console.info(`[goo] depth occlusion: ${d}, matchDepthView false`),new e(s,r,c,u,a,l,o,d!==null,t,n)}catch(e){throw s.end().catch(()=>{}),e}}cameraFor(e){let t=e.camera;if(!t)return null;let n=null;try{n=this.binding.getCameraTexture?.(t)??this.binding.getCameraImage?.(t)??null}catch{return null}if(!n||typeof n.createView!=`function`)return null;let r=n.format??``;return{texture:n,encodedSrgb:!r.endsWith(`-srgb`)}}attachmentView(e,t){let n={...t.getViewDescriptor?.()??{}};return delete n.format,e.createView(n)}occlusionFor(e){if(!this.depthSensing)return null;let t=null;try{t=this.binding.getDepthInformation(e)}catch{return null}if(!t?.texture)return null;let n=t.texture.format,r=n===`r32float`?`float`:n===`r16uint`?`uint`:null;if(!r)return null;g(this.depthFromEye,t.transform.inverse.matrix,e.transform.matrix);let i=t.getViewDescriptor?.(),a;return i&&(a={...i},delete a.format,a.baseArrayLayer!==void 0&&(a.dimension=`2d`)),{depthFromEye:this.depthFromEye,depthProj:t.projectionMatrix,uvFromView:t.normDepthBufferFromNormView.matrix,rawValueToMeters:t.rawValueToMeters,width:t.width,height:t.height,texture:t.texture,kind:r,view:a}}static depthFormat(e){if(!e.enabledFeatures?.includes(`depth-sensing`))return null;try{let t=e.depthDataFormat;if(t===`float32`||t===`unsigned-short`)return t;t&&console.warn(`[goo] depth-sensing format ${t} has no WebGPU texture; keeping hand occluders.`)}catch{}return null}depthFor(e,t,n){let r=this.depth[e];return(!r||r.width!==t||r.height!==n)&&(r?.destroy(),r=this.device.createTexture({size:[t,n],format:`depth24plus`,usage:GPUTextureUsage.RENDER_ATTACHMENT,label:`goo-xr-depth-${e}`}),this.depth[e]=r),r}destroy(){for(let e of this.depth)e.destroy();this.depth=[]}update(e,t){this.framesSeen++,this.pendingAnchor&&t&&(!t.emulatedPosition||this.framesSeen>tn)&&(this.anchorFromViewer(t),this.pendingAnchor=!1);for(let[t,n]of this.drags)n.kind===`pending`&&this.resolvePick(t,e,n);let n=[];for(let e of this.drags)e[1].kind===`stage`&&n.push(e);let r=n.length>=2,i=[0,0,0],a=0,o=0,s=0,c=0;for(let[t,n]of this.drags)if(!(n.kind===`button`||n.kind===`pending`)){if(n.kind===`collider`){if(!this.readPoint(t,n,e,i))continue;if(n.started){let e=1/this.rig.scale;this.hooks.moveCollider(n.collider,(i[0]-n.last[0])*e,(i[1]-n.last[1])*e,(i[2]-n.last[2])*e)}n.started=!0,n.last=[i[0],i[1],i[2]];continue}if(!r){n.started=!1;continue}if(!this.readPoint(t,n,e,i)){let n=e.getPose(t.targetRaySpace,this.refSpace);if(!n)continue;i[0]=n.transform.position.x,i[1]=n.transform.position.y,i[2]=n.transform.position.z}n.started&&(a+=i[0]-n.last[0],o+=i[1]-n.last[1],s+=i[2]-n.last[2],c++),n.started=!0,n.last=[i[0],i[1],i[2]]}if(r&&c>0){let t=nn/c;this.pan[0]=cn(this.pan[0]+a*t,-rn.x,rn.x),this.pan[1]=cn(this.pan[1]+o*t,-rn.y,rn.y),this.pan[2]=cn(this.pan[2]+s*t,-rn.z,rn.z),this.syncScale(e,n[0],n[1]),this.syncSpin(e,n[0],n[1]),this.layout()}else r||(this.scaleGesture=null,this.spinAngle=null)}syncScale(e,t,n){let r=[0,0,0],i=[0,0,0];if(!this.readPoint(t[0],t[1],e,r)||!this.readPoint(n[0],n[1],e,i))return;let a=Math.hypot(r[0]-i[0],r[1]-i[1],r[2]-i[2]);if(!(a<1e-4)){if(!this.scaleGesture){this.scaleGesture={startDist:a,startFramed:this.framedSize};return}this.framedSize=cn(this.scaleGesture.startFramed*(a/this.scaleGesture.startDist),J.min,J.max)}}syncSpin(e,t,n){let r=[0,0,0],i=[0,0,0];if(!this.readPoint(t[0],t[1],e,r)||!this.readPoint(n[0],n[1],e,i))return;let a=Math.atan2(i[0]-r[0],i[2]-r[2]);if(this.spinAngle===null){this.spinAngle=a;return}let o=Math.atan2(Math.sin(a-this.spinAngle),Math.cos(a-this.spinAngle));this.contentYaw+=o,this.spinAngle=a}anchorFromViewer(e){let t=e.transform.position,n=e.transform.orientation,r=-(2*(n.x*n.z+n.w*n.y)),i=-(1-2*(n.x*n.x+n.y*n.y)),a=Math.hypot(r,i);a<1e-4?(r=0,i=-1):(r/=a,i/=a);let o=this.floor?$t.height:t.y+($t.height-en);this.anchor=[t.x+r*$t.distance,o,t.z+i*$t.distance],this.hudBase=[t.x,this.floor?0:t.y-en,t.z],this.panel.yaw=Math.atan2(-r,-i),this.contentYaw=this.panel.yaw,this.pan=[0,0,0],this.layout()}layout(){this.pendingAnchor&&(this.anchor=[0,this.floor?$t.height:$t.height-en,-$t.distance],this.hudBase=[0,this.floor?0:-1.5,0]),this.rig.scale=this.framedSize,this.rig.x=this.anchor[0]+this.pan[0],this.rig.y=this.anchor[1]+this.pan[1],this.rig.z=this.anchor[2]+this.pan[2];let e=Math.sin(this.panel.yaw),t=Math.cos(this.panel.yaw),n=-.3,r=-.34;this.panel.x=this.hudBase[0]+this.pan[0]+t*n+e*r,this.panel.y=this.anchor[1]+this.pan[1]-.02,this.panel.z=this.hudBase[2]+this.pan[2]-e*n+t*r}panelMatrix(e){let t=Math.sin(this.panel.yaw),n=Math.cos(this.panel.yaw);return e.fill(0),e[0]=n*an.w,e[2]=-t*an.w,e[5]=an.h+an.hint,e[8]=t,e[10]=n,e[12]=this.panel.x,e[13]=this.panel.y-an.hint/2,e[14]=this.panel.z,e[15]=1,e}readRay(e,t,n,r){let i;try{i=t.getPose(e.targetRaySpace,this.refSpace)??void 0}catch{return!1}if(!i)return!1;let a=i.transform.position,o=i.transform.orientation;return n[0]=a.x,n[1]=a.y,n[2]=a.z,r[0]=-(2*(o.x*o.z+o.w*o.y)),r[1]=-(2*(o.y*o.z-o.w*o.x)),r[2]=-(1-2*(o.x*o.x+o.y*o.y)),!0}readPoint(e,t,n,r){return t.point?(r[0]=t.point[0],r[1]=t.point[1],r[2]=t.point[2],!0):this.readWrist(e,n,r)}panelFrame(){let e=Math.sin(this.panel.yaw),t=Math.cos(this.panel.yaw);return{centre:[this.panel.x,this.panel.y,this.panel.z],right:[t,0,-e],up:[0,1,0],normal:[e,0,t]}}updateHands(e){for(let t of e){let e=[...this.session.inputSources].find(e=>e.hand&&e.handedness===t.handedness);if(!e)continue;let n=this.drags.get(e);if(n&&!t.pinching){this.endDrag(e);continue}if(n){if(n.point)for(let e=0;e<3;e++)n.point[e]=t.point[e];continue}if(!t.start)continue;let r={kind:`pending`,started:!1,collider:-1,last:[0,0,0],point:[...t.point]};this.drags.set(e,r);let i=1/this.rig.scale,a=t.ray.valid?t.ray.origin:t.point,o=t.ray.valid?t.ray.dir:[0,0,-1],s=[(a[0]-this.rig.x)*i,(a[1]-this.rig.y)*i+.5,(a[2]-this.rig.z)*i],c=t.ray.valid?this.hooks.pickCollider(s,o):-1;if(this.hooks.selectCollider(c>=0?c:null),c>=0)r.kind=`collider`,r.collider=c;else{r.kind=`stage`,this.scaleGesture=null;for(let e of this.drags.values())e.kind===`stage`&&(e.started=!1)}}}get panning(){for(let e of this.drags.values())if(e.kind===`stage`)return!0;return!1}readWrist(e,t,n){let r=e.hand?.get(`wrist`),i=e=>{if(!e)return!1;let r=t.getJointPose?.(e,this.refSpace)??t.getPose(e,this.refSpace);return r?(n[0]=r.transform.position.x,n[1]=r.transform.position.y,n[2]=r.transform.position.z,!0):!1};if(i(r)||e.gripSpace&&i(e.gripSpace))return!0;let a=[0,0,0],o=[0,0,0];if(!this.readRay(e,t,a,o))return!1;let s=1/0,c=[0,0,0],l=!1;for(let r of this.session.inputSources){if(!r.hand||e.handedness!==`none`&&r.handedness!==`none`&&r.handedness!==e.handedness)continue;let i=r.hand.get(`wrist`),u=i&&(t.getJointPose?.(i,this.refSpace)??t.getPose(i,this.refSpace));if(!u)continue;c[0]=u.transform.position.x-a[0],c[1]=u.transform.position.y-a[1],c[2]=u.transform.position.z-a[2];let d=c[0]*o[0]+c[1]*o[1]+c[2]*o[2],f=(c[0]-o[0]*d)**2+(c[1]-o[1]*d)**2+(c[2]-o[2]*d)**2;f<s&&(s=f,n[0]=u.transform.position.x,n[1]=u.transform.position.y,n[2]=u.transform.position.z,l=!0)}return l}panelButtonAt(e,t){let n=Math.sin(this.panel.yaw),r=Math.cos(this.panel.yaw),i=e[0]-this.panel.x,a=e[1]-this.panel.y,o=e[2]-this.panel.z,s=i*r-o*n,c=i*n+o*r,l=.012;return Math.abs(c)>t||Math.abs(s)>an.w*.5+l||Math.abs(a)>an.h*.5+l?null:s<0?0:1}pickPanel(e,t){let n=this.panelButtonAt(e,.035);if(n!==null)return n;let r=Math.sin(this.panel.yaw),i=Math.cos(this.panel.yaw),a=t[0]*r+t[2]*i;if(Math.abs(a)<1e-5)return null;let o=((this.panel.x-e[0])*r+(this.panel.z-e[2])*i)/a;return o<-.04?null:this.panelButtonAt([e[0]+t[0]*o,e[1]+t[1]*o,e[2]+t[2]*o],.01)}jointPosition(e,t,n){let r=e.hand?.get(n);if(!r)return null;try{let e=t.getJointPose?.(r,this.refSpace)??t.getPose(r,this.refSpace);if(!e)return null;let n=e.transform.position;return[n.x,n.y,n.z]}catch{return null}}resolvePick(e,t,n){let r=this.jointPosition(e,t,`index-finger-tip`);if(r){let e=this.panelButtonAt(r,.035);if(e!==null){this.hooks.panelButton(e),n.kind=`button`;return}}let i=[0,0,0],a=[0,0,0];if(!this.readRay(e,t,i,a))return;let o=this.pickPanel(i,a);if(o!==null){this.hooks.panelButton(o),n.kind=`button`;return}let s=1/this.rig.scale,c=[(i[0]-this.rig.x)*s,(i[1]-this.rig.y)*s+.5,(i[2]-this.rig.z)*s],l=this.hooks.pickCollider(c,a);if(this.hooks.selectCollider(l>=0?l:null),l>=0){n.kind=`collider`,n.collider=l;return}n.kind=`stage`,this.scaleGesture=null;for(let e of this.drags.values())e.kind===`stage`&&(e.started=!1)}onSelectStart(e){e.inputSource.hand||this.drags.set(e.inputSource,{kind:`pending`,started:!1,collider:-1,last:[0,0,0]})}onSelectEnd(e){e.inputSource.hand||this.endDrag(e.inputSource)}endDrag(e){this.drags.delete(e),this.scaleGesture=null;for(let e of this.drags.values())e.kind===`stage`&&(e.started=!1)}};function cn(e,t,n){return Math.max(t,Math.min(n,e))}function ln(e,t,n){return new Promise((r,i)=>{let a=!1,o=window.setTimeout(()=>{a||(a=!0,i(Error(`requestSession timed out after ${n}ms`)))},n);navigator.xr.requestSession(e,t).then(e=>{if(a){e.end();return}a=!0,window.clearTimeout(o),r(e)},e=>{a||(a=!0,window.clearTimeout(o),i(e))})})}var un=.05,dn=.08,fn=.015,pn=.025,mn=.04,hn=.1;function gn(e,t){let n=[],r=!1;for(let i=0;i<4;i++){let a=t.fingers[i];if(a!==`ignored`){if(a===`required`&&(r=!0,!e[i]))return null;e[i]&&n.push(i)}}return n.length||r?n:null}function _n(e,t,n){return n===`any`?t.some(t=>!e[t]):t.every(t=>!e[t])}function vn(e,t){let n=e.tips[t];return Math.hypot(n[0]-e.thumb[0],n[1]-e.thumb[1],n[2]-e.thumb[2])}var yn=new Float32Array(16),bn=[0,0,0,0];function xn(e){for(let t=0;t<3;t++)yn.set(e.axes[t],t*4);return Ot(yn,0,bn),a(bn[0],bn[1],bn[2],bn[3])}function Sn(e,t){let r=n(n(e,a(t[0],t[1],t[2],0)),c(e));return[r.x,r.y,r.z]}var Cn=e=>e<=0?0:e>=1?1:e*e*(3-2*e),wn=class{grabbables=[];held=[null,null];hovered=[null,null];add(...e){this.grabbables.push(...e)}heldBy(e){return this.held[e]?.target??null}hover(e){return this.hovered[e]}busy(e){return!!this.held[e]||!!this.hovered[e]}origin(e,t){return t===`pinch`?e.pinchPoint:t===`palm`?e.palmPoint:e.origin}update(e,t){e.forEach((e,n)=>{let r=this.held[n];if(r){e.visible?e.fresh&&this.letGo(r,e,t)?this.drop(n,!0):this.follow(n,r,e,t):this.drop(n,!0);return}this.updateHover(n,e),e.visible&&e.fresh&&this.trySelect(n,e,t)})}updateHover(e,t){if(!t.visible){this.hovered[e]=null;return}let n=1/t.perMetre,r=null,i=1/0,a=1/0,o=this.hovered[e];for(let s of this.grabbables){if(!s.canGrab(e))continue;let c=Math.min(s.distance(t.pinchPoint),s.distance(t.palmPoint))*n;s===o&&(a=c),c<i&&(i=c,r=s)}o&&a<dn&&!(r!==o&&i<a-fn)||(this.hovered[e]=r&&i<un?r:null)}trySelect(e,t,n){let r=t.input,i=null,a=[],o=1/0;for(let n of this.grabbables){if(!n.touch||!n.contacts||!n.canGrab(e))continue;let r=n.contacts(t,n.touch.slack*t.perMetre);if(!r||r.length<n.touch.need)continue;let s=n.distance(t.thumb);s<o&&(o=s,i=n,a=r)}if(i){this.begin(e,t,i,`touch`,a,n);return}let s=this.hovered[e];if(!s)return;let c=1/t.perMetre;if(s.pinch&&s.distance(t.pinchPoint)*c<pn){let i=gn(r.pinching,s.pinch);if(i&&!gn(r.wasPinching,s.pinch)){this.begin(e,t,s,`pinch`,i,n);return}}if(s.palm&&s.distance(t.palmPoint)*c<mn){let i=gn(r.curled,s.palm);i&&!gn(r.wasCurled,s.palm)&&this.begin(e,t,s,`palm`,i,n)}}begin(e,t,r,i,a,o){let s=this.origin(t,i),l=xn(t),u=r.pose(),d=Sn(c(l),[u.pos[0]-s[0],u.pos[1]-s[1],u.pos[2]-s[2]]),f=null;if(i===`pinch`&&r.snap!==void 0){let e=Math.hypot(d[0],d[1],d[2]);e>r.snap&&(f=d.map(t=>t*r.snap/e))}r.select(e,i),this.held[e]={target:r,kind:i,fingers:a,spans:a.map(e=>vn(t,e)),offset:d,snapTo:f,rel:n(c(l),u.q),at:o,openSince:null},this.hovered[e]=null}letGo(e,t,n){let r=e.target;if(e.kind===`pinch`)return _n(t.input.pinching,e.fingers,r.pinch.unselect);if(e.kind===`palm`)return _n(t.input.curled,e.fingers,r.palm.unselect);let i=r.touch,a=e.fingers.map((n,r)=>vn(t,n)>e.spans[r]+i.open*t.perMetre);return(i.unselect===`any`?a.some(Boolean):a.every(Boolean))?(e.openSince??=n,n-e.openSince>i.ms):(e.openSince=null,!1)}follow(e,t,r,i){let a=this.origin(r,t.kind),o=xn(r),s=t.offset;if(t.snapTo){let e=Cn((i-t.at)/1e3/hn);s=s.map((n,r)=>n+(t.snapTo[r]-n)*e),e>=1&&(t.offset=t.snapTo,t.snapTo=null)}let c=Sn(o,s),l={pos:[a[0]+c[0],a[1]+c[1],a[2]+c[2]],q:n(o,t.rel)};t.target.move(e,l,r.input.confident)===!1&&this.drop(e,!1)}drop(e,t){let n=this.held[e];n&&(this.held[e]=null,n.target.release(e,t))}reset(){this.drop(0,!1),this.drop(1,!1)}},Tn=class{target=null;offset=[0,0,0];get active(){return this.target}start(e,t){if(!e.canGrab(-1))return!1;this.end(!1);let n=e.pose().pos;return this.offset=[n[0]-t[0],n[1]-t[1],n[2]-t[2]],this.target=e,e.select(-1,`pointer`),!0}drag(e){let t=this.target;if(!t)return;let n={pos:[e[0]+this.offset[0],e[1]+this.offset[1],e[2]+this.offset[2]],q:t.pose().q};t.move(-1,n,!0)===!1&&this.end(!1)}end(e=!0){let t=this.target;t&&(this.target=null,t.release(-1,e))}},En=null;function Dn(e){try{En??=new AudioContext,En.state===`suspended`&&En.resume();let t=En.currentTime,n=En.createOscillator(),r=En.createGain();n.type=`triangle`,n.frequency.setValueAtTime(e?1800:1100,t),n.frequency.exponentialRampToValueAtTime(e?900:600,t+.03),r.gain.setValueAtTime(1e-4,t),r.gain.exponentialRampToValueAtTime(.25,t+.003),r.gain.exponentialRampToValueAtTime(1e-4,t+.05),n.connect(r).connect(En.destination),n.start(t),n.stop(t+.06)}catch{}}var On={enter:.03,exit:.05,below:.04,margin:.004,keepMargin:.012,recoil:.012,reenter:.008,drag:.02,travel:.008},kn=.006,An=class{buttons;onClick;poke=[0,1].map(()=>({hover:-1,selected:!1,recoiled:!1,cancelled:!1,deepest:0,shallowest:0,start:[0,0],prevZ:1,depth:0}));ray=[0,1].map(()=>({hover:-1,selected:-1,hit:null}));cursors=[0,1].map(()=>({visible:!1,pos:[0,0,0],radius:.006,selecting:!1,origin:[0,0,0],ray:!1}));hover;press;constructor(e,t){this.buttons=e,this.onClick=t,this.hover=e.map(()=>0),this.press=e.map(()=>0)}owns(e){let t=this.poke[e],n=this.ray[e];return t.hover>=0||t.selected||n.hover>=0||n.selected>=0}limit(e){let t=this.poke[e];return t.selected||t.recoiled?Math.max(0,-t.prevZ):0}inside(e,t,n,r){return Math.abs(t-e.x)<=e.hw+r&&Math.abs(n-e.y)<=e.hh+r}buttonAt(e,t,n){return this.buttons.findIndex(r=>this.inside(r,e,t,n))}update(e,t){let n=this.buttons.map(()=>0),r=this.buttons.map(()=>0);t.forEach((t,i)=>{this.updatePoke(e,t,i),this.updateRay(e,t,i);let a=this.poke[i],o=this.ray[i];a.hover>=0&&(n[a.hover]=Math.max(n[a.hover],1-Math.max(0,a.prevZ)/On.exit),r[a.hover]=Math.max(r[a.hover],a.selected?Math.min(1,-a.deepest/On.travel+.35):0));let s=o.selected>=0?o.selected:o.hover;s>=0&&(n[s]=Math.max(n[s],.8),r[s]=Math.max(r[s],o.selected>=0?1:t.input.pinchStrength[0]*.5))}),this.buttons.forEach((e,t)=>{this.hover[t]+=(n[t]-this.hover[t])*.35,this.press[t]=r[t]>0?r[t]:this.press[t]<.02?0:this.press[t]*.75})}local(e,t){let n=[t[0]-e.centre[0],t[1]-e.centre[1],t[2]-e.centre[2]],r=e=>n[0]*e[0]+n[1]*e[1]+n[2]*e[2];return[r(e.right),r(e.up),r(e.normal)]}updatePoke(e,t,n){let r=this.poke[n];if(!t.tracked){Object.assign(r,{hover:-1,selected:!1,recoiled:!1,cancelled:!1,prevZ:1});return}let[i,a,o]=this.local(e,t.tip),s=o-t.tipRadius;if(r.selected){r.deepest=Math.min(r.deepest,s);let e=Math.hypot(i-r.start[0],a-r.start[1]);if(e>On.drag&&e>-r.deepest*1.5)r.selected=!1,r.cancelled=!0;else if(s>0||s-r.deepest>On.recoil){r.selected=!1;let e=r.hover;e>=0&&this.inside(this.buttons[e],i,a,On.keepMargin)&&(Dn(!1),this.onClick(e)),r.recoiled=s<=0,r.shallowest=s}}else{if(r.hover>=0){let e=this.buttons[r.hover];(!this.inside(e,i,a,On.keepMargin)||s>On.exit||s<-On.below)&&(r.hover=-1,r.recoiled=!1)}r.hover<0&&s>-.002&&s<On.enter&&(r.hover=this.buttonAt(i,a,On.margin)),s>0&&(r.recoiled=r.cancelled=!1),r.recoiled&&(r.shallowest=Math.max(r.shallowest,s));let e=r.prevZ>0&&s<=0,t=r.recoiled&&s<r.shallowest-On.reenter;r.hover>=0&&!r.cancelled&&(e||t)&&(r.selected=!0,r.recoiled=!1,r.deepest=s,r.start=[i,a],Dn(!0))}r.prevZ=s}updateRay(e,t,n){let r=this.ray[n],i=this.cursors[n],a=t.input.pointer,o=this.poke[n].hover>=0||this.poke[n].selected;if(i.visible=!1,!t.tracked||!a.valid||o||!t.free&&r.selected<0){r.hover=-1,r.selected=-1,o&&t.tracked&&this.pokeCursor(e,t,n);return}let s=e.normal,c=a.origin,l=a.dir,u=l[0]*s[0]+l[1]*s[1]+l[2]*s[2],d=null;if(u<-1e-4){let t=((e.centre[0]-c[0])*s[0]+(e.centre[1]-c[1])*s[1]+(e.centre[2]-c[2])*s[2])/u;t>0&&(d=[c[0]+l[0]*t,c[1]+l[1]*t,c[2]+l[2]*t])}let[f,p]=d?this.local(e,d):[1/0,1/0];if(r.hover=d?this.buttonAt(f,p,r.hover>=0?kn*2:kn):-1,r.selected<0&&r.hover>=0&&t.free&&vt(t.input)?(r.selected=r.hover,Dn(!0)):r.selected>=0&&!t.input.pinching[0]&&(r.hover===r.selected&&(Dn(!1),this.onClick(r.selected)),r.selected=-1),!d||r.hover<0&&r.selected<0)return;let m=Math.hypot(d[0]-c[0],d[1]-c[1],d[2]-c[2]),h=r.selected>=0?1:t.input.pinchStrength[0];i.visible=!0,i.ray=!0,i.selecting=r.selected>=0,i.pos=[d[0]+s[0]*.002,d[1]+s[1]*.002,d[2]+s[2]*.002],i.origin=[c[0],c[1],c[2]],i.radius=m*.012*(1-.17*h)}writeGeometry(e,t,n){let r=0,i=(e,t)=>{r*7+7>n.length||(n.set([e[0],e[1],e[2],t[0],t[1],t[2],t[3]],r*7),r++)},{right:a,up:o,normal:s,centre:c}=e,l=(e,t,n)=>[0,1,2].map(r=>c[r]+a[r]*e+o[r]*t+s[r]*n);this.buttons.forEach((e,t)=>{let n=this.hover[t],r=this.press[t];if(n<.02&&r<.02)return;let a=.0015-.004*r,o=[.3+.5*r,.75+.2*r,.95,.1+.16*n+.22*r],s=l(e.x-e.hw,e.y-e.hh,a),c=l(e.x+e.hw,e.y-e.hh,a),u=l(e.x+e.hw,e.y+e.hh,a),d=l(e.x-e.hw,e.y+e.hh,a);for(let e of[s,c,u,s,u,d])i(e,o)});for(let e of this.cursors){if(!e.visible)continue;let n=e.selecting?[.25,.55,1,.95]:[1,1,1,.85],r=e.radius,s=r*.62;for(let t=0;t<20;t++){let c=t/20*Math.PI*2,l=(t+1)/20*Math.PI*2,u=(t,n)=>[0,1,2].map(r=>e.pos[r]+(a[r]*Math.cos(t)+o[r]*Math.sin(t))*n),d=u(c,s),f=u(c,r),p=u(l,s),m=u(l,r);for(let e of[d,f,m,d,m,p])i(e,n)}if(!e.ray)continue;let c=[e.pos[0]-e.origin[0],e.pos[1]-e.origin[1],e.pos[2]-e.origin[2]],l=Math.hypot(c[0],c[1],c[2]);if(l<.08)continue;let u=c.map(e=>e/l),d=[0,1,2].map(t=>e.origin[t]+u[t]*.06),f=[0,1,2].map(t=>(d[t]+e.pos[t])/2),p=[t[0]-f[0],t[1]-f[1],t[2]-f[2]],m=[u[1]*p[2]-u[2]*p[1],u[2]*p[0]-u[0]*p[2],u[0]*p[1]-u[1]*p[0]],h=Math.hypot(m[0],m[1],m[2])||1;m=m.map(e=>e/h*.0012);let g=[n[0],n[1],n[2],0],_=[n[0],n[1],n[2],.45],v=d.map((e,t)=>e-m[t]),y=d.map((e,t)=>e+m[t]),b=e.pos.map((e,t)=>e+m[t]),x=e.pos.map((e,t)=>e-m[t]);i(v,g),i(y,g),i(b,_),i(v,g),i(b,_),i(x,_)}return r}pokeCursor(e,t,n){let r=this.cursors[n],i=e.normal,a=this.poke[n],o=Math.max(0,a.prevZ),[s,c]=this.local(e,t.tip),l=e;r.visible=!0,r.ray=!1,r.selecting=a.selected;for(let e=0;e<3;e++)r.pos[e]=l.centre[e]+l.right[e]*s+l.up[e]*c+i[e]*.002;r.radius=.003+o*.25}},jn=[[2,3,4],...K.map(e=>[e+1,e+2,e+3,e+4])],Mn=1.3,Nn=.003,Pn=.03,Fn=.15,In=.05;function Ln(e,t,n,r){let i=(t[0]*e[0]+t[1]*e[1]+t[2]*e[2])*(1-n),a=e[0]*n+(t[1]*e[2]-t[2]*e[1])*r+t[0]*i,o=e[1]*n+(t[2]*e[0]-t[0]*e[2])*r+t[1]*i,s=e[2]*n+(t[0]*e[1]-t[1]*e[0])*r+t[2]*i;e[0]=a,e[1]=o,e[2]=s}var Rn=class{push=0;normal=[0,0,1];bend=new Float32Array(jn.length);axis=jn.map(()=>[0,0,1]);v=[0,0,0];g=[0,0,0];reset(){this.push=0,this.bend.fill(0)}apply(e,t,n,r,i,a){n.set(e);let o=i?.depth??0;if(i&&o>0&&(this.normal[0]=i.normal[0],this.normal[1]=i.normal[1],this.normal[2]=i.normal[2]),this.push=o>=this.push?o:this.push+(o-this.push)*(1-Math.exp(-r/In)),this.push>1e-5)for(let e=0;e<25;e++)n[e*16+12]+=this.normal[0]*this.push,n[e*16+13]+=this.normal[1]*this.push,n[e*16+14]+=this.normal[2]*this.push;jn.forEach((e,i)=>{let o=a?this.solve(n,t,e,a,this.axis[i]):0,s=o>this.bend[i]?Pn:Fn;this.bend[i]+=(o-this.bend[i])*(1-Math.exp(-r/s)),this.bend[i]>.001&&this.bendChain(n,e,this.axis[i],this.bend[i])})}solve(e,t,n,r,i){let a=n[0]*16+12,o=n[n.length-1]*16+12,s=t[n[n.length-1]]||.008,c=e[o],l=e[o+1],u=e[o+2],d=r(c,l,u)-s;if(d>=0||d<-.035)return 0;let f=this.g;f[0]=r(c+Nn,l,u)-r(c-Nn,l,u),f[1]=r(c,l+Nn,u)-r(c,l-Nn,u),f[2]=r(c,l,u+Nn)-r(c,l,u-Nn);let p=Math.hypot(f[0],f[1],f[2]);if(p<1e-9)return 0;f[0]/=p,f[1]/=p,f[2]/=p;let m=c-e[a],h=l-e[a+1],g=u-e[a+2],_=h*f[2]-g*f[1],v=g*f[0]-m*f[2],y=m*f[1]-h*f[0],b=Math.hypot(_,v,y);if(b<.2*Math.hypot(m,h,g))return 0;i[0]=_/b,i[1]=v/b,i[2]=y/b;let x=0,S=this.v;for(let t=0;t<4&&d<0&&x<Mn;t++){let t=Math.min(Mn,x-d/b);S[0]=m,S[1]=h,S[2]=g,Ln(S,i,Math.cos(t),Math.sin(t));let n=r(e[a]+S[0],e[a+1]+S[1],e[a+2]+S[2])-s;if(n<=d)break;x=t,d=n}return x}bendChain(e,t,n,r){let i=Math.cos(r),a=Math.sin(r),o=t[0]*16,s=this.v;for(let r=0;r<t.length;r++){let c=t[r]*16;for(let t=0;t<3;t++)s[0]=e[c+t*4],s[1]=e[c+t*4+1],s[2]=e[c+t*4+2],Ln(s,n,i,a),e[c+t*4]=s[0],e[c+t*4+1]=s[1],e[c+t*4+2]=s[2];r!==0&&(s[0]=e[c+12]-e[o+12],s[1]=e[c+13]-e[o+13],s[2]=e[c+14]-e[o+14],Ln(s,n,i,a),e[c+12]=e[o+12]+s[0],e[c+13]=e[o+13]+s[1],e[c+14]=e[o+14]+s[2])}}},zn=Math.PI/2,Bn={fingers:[`optional`,`optional`,`ignored`,`ignored`],unselect:`any`},Vn={fingers:[`optional`,`optional`,`optional`,`optional`],unselect:`all`},Hn=.014,Un=.8,Wn=class{pinch=Bn;palm=Vn;holder=null;get grabbed(){return this.holder!==null}canGrab(e){return this.holder===null||this.holder===e}select(e){this.holder=e}move(e,t){this.holder===e&&this.aim(t.pos)}release(e){this.holder===e&&(this.holder=null)}},Gn=class extends Wn{pivot;length;yaw=0;constructor(e,t=.16){super(),this.pivot={x:e.x,y:e.y,z:e.z},this.length=t}get openness(){return this.yaw/zn}setYaw(e){this.yaw=Math.min(zn,Math.max(0,e))}nudge(e){this.setYaw(this.yaw+e)}distance(e){return this.distanceToHandle(e[0],e[1],e[2])-Hn}pose(){let e=this.length*Un;return{pos:[this.pivot.x+Math.sin(this.yaw)*e,this.pivot.y,this.pivot.z+Math.cos(this.yaw)*e],q:a()}}aim(e){let t=Math.atan2(e[0]-this.pivot.x,e[2]-this.pivot.z);Number.isFinite(t)&&this.setYaw(t)}step(e,t,n,r){if(this.grabbed)return;let i=1/0,a=this.yaw;for(let e=0;e<n;e++){let n=t[e];if(!n.isBox&&!n.isCapsule)continue;let o=n.x-r.x,s=n.y-r.y,c=n.z-r.z,l=Math.max(n.hx,n.hy,n.hz,n.radius)+.04,u=this.distanceToHandle(o,s,c);if(u>l||u>=i)continue;let d=Math.atan2(o-this.pivot.x,c-this.pivot.z);Number.isFinite(d)&&(i=u,a=d)}if(i===1/0)return;let o=9*Math.max(1/120,e);this.setYaw(Math.min(this.yaw+o,Math.max(this.yaw-o,a)))}distanceToHandle(e,t,n){let r=Math.sin(this.yaw)*this.length,i=Math.cos(this.yaw)*this.length,a=e-this.pivot.x,o=t-this.pivot.y,s=n-this.pivot.z,c=r*r+i*i||1,l=Math.min(1,Math.max(0,(a*r+s*i)/c)),u=this.pivot.x+r*l,d=this.pivot.z+i*l;return Math.hypot(e-u,o,n-d)}},Kn=.8,qn=class extends Wn{pivot;length;pitch=0;constructor(e,t){super(),this.pivot={x:e[0],y:e[1],z:e[2]},this.length=t}get openness(){return this.pitch/Kn}setPitch(e){this.pitch=Math.min(Kn,Math.max(0,e))}model(e,t=0){let n=Math.cos(this.pitch),r=Math.sin(this.pitch);e.set([1,0,0,0,0,n,r,0,0,-r,n,0,this.pivot.x,this.pivot.y,this.pivot.z,1],t)}gripDistance(e,t,n){let r=Math.cos(this.pitch),i=Math.sin(this.pitch),a=e-this.pivot.x,o=t-this.pivot.y,s=n-this.pivot.z,c=(o*r+s*i)/this.length;if(c<.3)return 1/0;let l=Math.min(1,c)*this.length;return Math.hypot(a,o-r*l,s-i*l)}distance(e){return this.gripDistance(e[0],e[1],e[2])-Hn}pose(){let e=this.length*Un;return{pos:[this.pivot.x,this.pivot.y+Math.cos(this.pitch)*e,this.pivot.z+Math.sin(this.pitch)*e],q:a()}}aim(e){this.setPitch(this.aimAt(e[1],e[2]))}aimAt(e,t){return Math.atan2(t-this.pivot.z,e-this.pivot.y)}step(e,t,n,r){if(this.grabbed)return;let i=1/0,a=this.pitch;for(let e=0;e<n;e++){let n=t[e];if(!n.isBox&&!n.isCapsule)continue;let o=n.x-r.x,s=n.y-r.y,c=n.z-r.z,l=this.gripDistance(o,s,c);l>Math.max(n.hx,n.hy,n.hz,n.radius)+.03||l>=i||(i=l,a=this.aimAt(s,c))}if(i===1/0)return;let o=7*Math.max(1/120,e);this.setPitch(Math.min(this.pitch+o,Math.max(this.pitch-o,a)))}},Jn=10,Yn=.4,Xn=.35;function Zn(e,t,n,r){let i=t.w*-e.x+t.x*e.w+t.y*-e.z-t.z*-e.y,a=t.w*-e.y-t.x*-e.z+t.y*e.w+t.z*-e.x,o=t.w*-e.z+t.x*-e.y-t.y*-e.x+t.z*e.w,s=t.w*e.w-t.x*-e.x-t.y*-e.y-t.z*-e.z;s<0&&(i=-i,a=-a,o=-o,s=-s);let c=Math.hypot(i,a,o),l=c>1e-7?2*Math.atan2(c,s)/c/n:0;return r[0]=i*l,r[1]=a*l,r[2]=o*l,r}var Qn=class{ring=[];head=0;reset(){this.ring.length=0,this.head=0}push(e,t,n,r){if(!r)return;let i=this.ring.length?this.ring[(this.head+this.ring.length-1)%Jn]:null;if(i&&n<=i.t)return;let a={t:n,p:[e[0],e[1],e[2]],q:{x:t.x,y:t.y,z:t.z,w:t.w}};this.ring.length<Jn?this.ring.push(a):(this.ring[this.head]=a,this.head=(this.head+1)%Jn)}estimate(){let e=this.ring.length;if(e<2)return null;let t=Array.from({length:e},(e,t)=>this.ring[(this.head+t)%Jn]),n=t[e-1].t-t[0].t,r=[];for(let i=0;i<e;i++)for(let a=i+1;a<e;a++){let o=t[a].t-t[i].t;if(o<n*Yn&&e>3)continue;let s=[(t[a].p[0]-t[i].p[0])/o,(t[a].p[1]-t[i].p[1])/o,(t[a].p[2]-t[i].p[2])/o];r.push({v:s,w:Zn(t[i].q,t[a].q,o,[0,0,0])})}if(!r.length)return null;let i=r[0],a=-1;for(let e of r){let t=Xn*Math.max(Math.hypot(e.v[0],e.v[1],e.v[2]),.05),n=0;for(let i of r)Math.hypot(i.v[0]-e.v[0],i.v[1]-e.v[1],i.v[2]-e.v[2])<=t&&n++;n>a&&(a=n,i=e)}let o=Xn*Math.max(Math.hypot(i.v[0],i.v[1],i.v[2]),.05),s=[0,0,0],c=[0,0,0],l=0;for(let e of r)if(!(Math.hypot(e.v[0]-i.v[0],e.v[1]-i.v[1],e.v[2]-i.v[2])>o)){for(let t=0;t<3;t++)s[t]+=e.v[t],c[t]+=e.w[t];l++}for(let e=0;e<3;e++)s[e]/=l,c[e]/=l;return{v:s,w:c}}},Y=12,$n=5,er=3e6/Y**3,tr=.6,nr=.2,rr=16,ir=.3,ar=2*Jt,or={need:1,slack:.008,open:.024,ms:60,unselect:`any`},sr={fingers:[`optional`,`optional`,`ignored`,`ignored`],unselect:`any`},cr=.028,lr=1.2;function ur(e,t){let n=e.tips[t];return Math.hypot(n[0]-e.thumb[0],n[1]-e.thumb[1],n[2]-e.thumb[2])}function dr(e,t,n){let r=e[0],i=e[1],o=e[2],s=t[0],c=t[1],l=t[2],u=n[0],d=n[1],f=n[2],p=r+c+f,m,h,g,_;if(p>0){let e=Math.sqrt(p+1)*2;_=.25*e,m=(l-d)/e,h=(u-o)/e,g=(i-s)/e}else if(r>c&&r>f){let e=Math.sqrt(1+r-c-f)*2;_=(l-d)/e,m=.25*e,h=(s+i)/e,g=(u+o)/e}else if(c>f){let e=Math.sqrt(1+c-r-f)*2;_=(u-o)/e,m=(s+i)/e,h=.25*e,g=(d+l)/e}else{let e=Math.sqrt(1+f-r-c)*2;_=(i-s)/e,m=(u+o)/e,h=(d+l)/e,g=.25*e}let v=Math.hypot(m,h,g,_)||1;return a(m/v,h/v,g/v,_/v)}function fr(e,t){let n=Math.hypot(e.x,e.y,e.z);return n>t?r(e.x*t/n,e.y*t/n,e.z*t/n):e}function pr(e,t,n=0){let{x:r,y:i,z:a,w:o}=e;t[n]=1-2*(i*i+a*a),t[n+1]=2*(r*i+a*o),t[n+2]=2*(r*a-i*o),t[n+4]=2*(r*i-a*o),t[n+5]=1-2*(r*r+a*a),t[n+6]=2*(i*a+r*o),t[n+8]=2*(r*a+i*o),t[n+9]=2*(i*a-r*o),t[n+10]=1-2*(r*r+i*i)}var mr=class{solver=new t;cubes=[];hands=[];handUsed=new Uint8Array(ar);ghost=new Uint8Array(ar);grabs=new Map;rot=new Float32Array(16);cupWalls=[];grabbables=[];clock=0;constructor(){this.solver.iterations=8;for(let e of[T,D])this.lathe(e);this.lathe({...E,x:0,z:0},this.cupWalls),this.setCup([E.x,0,E.z],a()),this.counter();let[e,,t]=ne;this.fixed([e,j.top/2,t],a(),[j.radius,j.top/2,j.radius]);let n=he();this.fixed(n.centre,dr(n.u,n.v,n.n),[me.width/2,me.height/2,me.thickness/2]);let o=P.size*Y;for(let e=0;e<P.count;e++){let t=new i(this.solver,r(o,o,o),tr,.3,r());this.cubes.push(t),this.respawn(t,e),this.grabbables.push(this.grabbable(t))}for(let e=0;e<ar;e++){let e=new i(this.solver,r(.1,.1,.1),0,.9,r(0,-100,0));e.kinematic=!0,this.hands.push(e)}}fixed(e,t,n,a=.4){let o=new i(this.solver,r(n[0]*2*Y,n[1]*2*Y,n[2]*2*Y),0,a,r(e[0]*Y,e[1]*Y,e[2]*Y));return o.positionAng=t,o}lathe(e,t){let n=e.thickness/2;for(let i=0;i+1<e.profile.length;i++){let[a,o]=e.profile[i],[s,c]=e.profile[i+1],l=Math.hypot(s-a,c-o);if(l<1e-6)continue;let u=(s-a)/l,d=(c-o)/l,f=(a+s)/2,p=(o+c)/2,m=Math.max(a,s)*Math.tan(Math.PI/rr)*1.08+.004;for(let i=0;i<rr;i++){let a=(i+.5)/rr*Math.PI*2,o=Math.cos(a),s=Math.sin(a),c=[u*o,d,u*s],h=[-s,0,o],g=dr(c,[h[1]*c[2]-h[2]*c[1],h[2]*c[0]-h[0]*c[2],h[0]*c[1]-h[1]*c[0]],h),_=this.fixed([e.x+f*o,p,e.z+f*s],g,[l/2+n*.5,n,m]);t&&(_.kinematic=!0,t.push({body:_,c:r((e.x+f*o)*Y,p*Y,(e.z+f*s)*Y),q:g}))}}}counter(){let e=N,t=a(),n=[[e.x0,e.x1,e.z0,e.z1],...ve(D.x,D.z,O,8)];for(let[e,r,i,a]of F([-1.9,1.9,-.74,.74],n))this.fixed([(e+r)/2,-.1,(i+a)/2],t,[(r-e)/2,.1,(a-i)/2]);let r=(e.x0+e.x1)/2,i=(e.z0+e.z1)/2,o=(e.x1-e.x0)/2,s=(e.z1-e.z0)/2,c=e.wall/2,l=e.depth/2;this.fixed([r,-e.depth-c,i],t,[o,c,s],.2),this.fixed([e.x0+c,-l,i],t,[c,l,s],.2),this.fixed([e.x1-c,-l,i],t,[c,l,s],.2),this.fixed([r,-l,e.z0+c],t,[o,l,c],.2),this.fixed([r,-l,e.z1-c],t,[o,l,c],.2)}respawn(e,t){let n=N,i=t%4,o=Math.floor(t/4)%2,s=Math.floor(t/8),c=(n.x0+n.x1)/2+(i-1.5)*.115+(o?.02:-.02),l=(n.z0+n.z1)/2+(o-.5)*.16,u=-n.depth+P.size*.6+s*P.size*1.2;e.positionLin=r(c*Y,u*Y,l*Y);let d=t*2.39996%(Math.PI*2);e.positionAng=a(0,Math.sin(d/2),0,Math.cos(d/2)),e.velocityLin=r(),e.prevVelocityLin=r(),e.velocityAng=r()}setCup(e,t){let i=this.solver.dt>1e-6?1/this.solver.dt:0;pr(t,this.rot);let a=this.rot;for(let o of this.cupWalls){let s=o.c,c=r(e[0]*Y+a[0]*s.x+a[4]*s.y+a[8]*s.z,e[1]*Y+a[1]*s.x+a[5]*s.y+a[9]*s.z,e[2]*Y+a[2]*s.x+a[6]*s.y+a[10]*s.z),l=o.body,u=n(t,o.q),d=Math.hypot(c.x-l.positionLin.x,c.y-l.positionLin.y,c.z-l.positionLin.z)>ir*Y;l.velocityLin=d?r():fr(r((c.x-l.positionLin.x)*i,(c.y-l.positionLin.y)*i,(c.z-l.positionLin.z)*i),80),l.prevVelocityLin={...l.velocityLin},d?(l.positionLin=c,l.positionAng=u,l.kinematicTarget=null):l.kinematicTarget={lin:c,ang:u}}}setHands(e){this.handUsed.fill(0);let t=this.solver.dt>1e-6?1/this.solver.dt:0;e((e,n)=>{if(n>=ar)return;let i=this.hands[n],a=r(e.c[0]*Y,e.c[1]*Y,e.c[2]*Y),o=i.positionLin.y<-5;if(o||this.ghost[n]){let t=Math.hypot(e.half[0],e.half[1],e.half[2])*Y,r=this.grabs.get(Math.floor(n/Jt))?.body,i=this.cubes.some(e=>{if(e===r)return!1;let n=e.positionLin.x-a.x,i=e.positionLin.y-a.y,o=e.positionLin.z-a.z;return Math.hypot(n,i,o)<e.radius+t});if(this.ghost[n]=+!!i,i)return}this.handUsed[n]=1,i.velocityLin=o?r():r((a.x-i.positionLin.x)*t,(a.y-i.positionLin.y)*t,(a.z-i.positionLin.z)*t),i.prevVelocityLin={...i.velocityLin},i.positionLin=a,i.positionAng=dr(e.a,e.b,e.n),i.size=r(e.half[0]*2*Y,e.half[1]*2*Y,e.half[2]*2*Y),i.radius=Math.hypot(i.size.x,i.size.y,i.size.z)/2}),this.hands.forEach((e,t)=>{this.handUsed[t]||(e.positionLin=r(0,-100,0),e.velocityLin=r())})}step(e,t,n){if(e<=0)return;let r=this.solver;r.dt=e*$n,r.gravity=-t*Y/($n*$n),this.clock+=r.dt,n&&this.applyGoo(n,-r.gravity*r.dt);for(let e of this.grabs.values())this.drive(e,r.dt);r.step(),this.cubes.forEach((e,t)=>{let n=e.positionLin;if(n.y<-3*Y||Math.abs(n.x)>6*Y||Math.abs(n.z)>6*Y){for(let[t,n]of this.grabs)n.body===e&&this.release(t);this.respawn(e,t)}})}drive(e,t){let i=e.body,o=i.velocityLin,s=i.velocityAng;e.goal.stiffness=.4*i.mass/(t*t);let l=e.target??e.goal.goal;if(e.throws.push([l.x,l.y,l.z],e.targetAng??i.positionAng,this.clock,e.confident),!e.target||!e.targetAng){o.x*=.85,o.y*=.85,o.z*=.85,s.x*=.8,s.y*=.8,s.z*=.8;return}let u=e.target,d=i.positionLin;e.prev={...u},e.goal.goal={...u},i.velocityLin=fr(r((u.x-d.x)/t,(u.y-d.y)/t,(u.z-d.z)/t),80);let f=n(e.targetAng,c(i.positionAng));f.w<0&&(f=a(-f.x,-f.y,-f.z,-f.w));let p=Math.hypot(f.x,f.y,f.z),m=2*Math.atan2(p,f.w),h=p>1e-6?m/p*.6/t:0;i.velocityAng=fr(r(f.x*h,f.y*h,f.z*h),40)}grabbable(e){let t=this;return{touch:or,pinch:sr,snap:P.size*.45,distance:t=>this.surface(e,t),pose:()=>({pos:[e.positionLin.x/Y,e.positionLin.y/Y,e.positionLin.z/Y],q:{...e.positionAng}}),contacts:(t,n)=>this.contacts(e,t,n),canGrab(n){for(let[r,i]of t.grabs)if(i.body===e&&r!==n)return!1;return!t.grabs.has(n)||t.grabs.get(n).body===e},select:(t,n)=>this.grasp(t,e,n),move:(t,n,r)=>this.follow(t,e,n,r),release:(t,n)=>{this.grabs.get(t)?.body===e&&this.release(t,n)}}}surface(e,t){pr(e.positionAng,this.rot);let n=this.rot,r=P.size/2,i=[t[0]-e.positionLin.x/Y,t[1]-e.positionLin.y/Y,t[2]-e.positionLin.z/Y],a=[0,1,2].map(e=>Math.abs(i[0]*n[e*4]+i[1]*n[e*4+1]+i[2]*n[e*4+2])-r);return Math.hypot(Math.max(a[0],0),Math.max(a[1],0),Math.max(a[2],0))+Math.min(Math.max(a[0],a[1],a[2]),0)}nearest(e){let t=1/0;for(let n of this.cubes)t=Math.min(t,this.surface(n,e));return t}contacts(e,t,n){if(this.surface(e,t.thumb)>t.radii[0]+n)return null;let r=e.positionLin.x/Y,i=e.positionLin.y/Y,a=e.positionLin.z/Y,o=t.thumb[0]-r,s=t.thumb[1]-i,c=t.thumb[2]-a,l=Math.hypot(o,s,c)||1,u=[];return t.tips.forEach((d,f)=>{if(this.surface(e,d)>t.radii[f+1]+n)return;let p=d[0]-r,m=d[1]-i,h=d[2]-a;((o*p+s*m+c*h)/(l*(Math.hypot(p,m,h)||1))<-.2||f===0&&ur(t,0)<cr*t.perMetre)&&u.push(f)}),u}grasp(e,t,n){this.release(e);let r=[];if(e!==-1){let n=this.hands.slice(e*Jt,(e+1)*Jt);for(let e=t.forces;e;){let r=e.bodyA===t?e.nextA:e.nextB;e instanceof o&&n.includes(e.bodyA===t?e.bodyB:e.bodyA)&&e.destroy(),e=r}r=n.map(e=>new l(this.solver,t,e))}this.grabs.set(e,{body:t,goal:new s(this.solver,t,t.positionLin,1),ignores:r,throws:new Qn,confident:!0})}follow(e,t,n,i){let a=this.grabs.get(e);if(a?.body!==t)return!1;a.confident=i;let o=r(n.pos[0]*Y,n.pos[1]*Y,n.pos[2]*Y);if(e===-1)return a.goal.goal=o,!0;let s=a.target,c=t.positionLin;if(s){let e=Math.hypot(o.x-s.x,o.y-s.y,o.z-s.z);if(Math.hypot(s.x-c.x,s.y-c.y,s.z-c.z)>lr*P.size*Y+2*e)return!1}return a.target=o,a.targetAng=n.q,!0}applyGoo(e,t){let n=Y/$n/er,i=Y*Y/$n/er,a=this.rot;this.cubes.forEach((o,s)=>{let c=s*6;if(c+5>=e.length)return;let l=[e[c]*n/o.mass,e[c+1]*n/o.mass,e[c+2]*n/o.mass],u=Math.hypot(l[0],l[1],l[2]),d=u>4?4/u:1,f=1-nr*Math.min(1,u/Math.max(t,1e-6)),p=o.velocityLin;o.velocityLin=r((p.x+l[0]*d)*f,(p.y+l[1]*d)*f,(p.z+l[2]*d)*f),pr(o.positionAng,a);let m=[e[c+3]*i,e[c+4]*i,e[c+5]*i],h=[0,1,2].map(e=>a[e*4]*m[0]+a[e*4+1]*m[1]+a[e*4+2]*m[2]),g=[h[0]/o.moment.x,h[1]/o.moment.y,h[2]/o.moment.z],_=[0,1,2].map(e=>a[e]*g[0]+a[4+e]*g[1]+a[8+e]*g[2]),v=Math.hypot(_[0],_[1],_[2]),y=v>6?6/v:1;o.velocityAng=r(o.velocityAng.x+_[0]*y,o.velocityAng.y+_[1]*y,o.velocityAng.z+_[2]*y)})}writeSim(e,t,n){let r=this.rot,i=Math.min(this.cubes.length,16);for(let a=0;a<i;a++){let i=this.cubes[a],o=a*5*4;pr(i.positionAng,r);let s=$n/Y;e[o]=i.positionLin.x/Y+t.x/2,e[o+1]=i.positionLin.y/Y+n,e[o+2]=i.positionLin.z/Y+t.z/2,e[o+3]=P.size/2;let c=[i.velocityLin.x*s,i.velocityLin.y*s,i.velocityLin.z*s];for(let t=0;t<3;t++)e[o+4+t*4]=r[t*4],e[o+5+t*4]=r[t*4+1],e[o+6+t*4]=r[t*4+2],e[o+7+t*4]=c[t];e[o+16]=i.velocityAng.x*$n,e[o+17]=i.velocityAng.y*$n,e[o+18]=i.velocityAng.z*$n,e[o+19]=0}return i}writeMatrices(e){this.cubes.forEach((t,n)=>{let r=n*16;pr(t.positionAng,e,r),e[r+3]=0,e[r+7]=0,e[r+11]=0,e[r+12]=t.positionLin.x/Y,e[r+13]=t.positionLin.y/Y,e[r+14]=t.positionLin.z/Y,e[r+15]=1})}pick(e,t){let n=this.rot,r=P.size/2*1.35,i=null;return this.cubes.forEach((a,o)=>{pr(a.positionAng,n);let s=[e[0]-a.positionLin.x/Y,e[1]-a.positionLin.y/Y,e[2]-a.positionLin.z/Y],c=-1/0,l=1/0;for(let e=0;e<3;e++){let i=[n[e*4],n[e*4+1],n[e*4+2]],a=s[0]*i[0]+s[1]*i[1]+s[2]*i[2],o=t[0]*i[0]+t[1]*i[1]+t[2]*i[2];if(Math.abs(o)<1e-9){if(Math.abs(a)>r)return;continue}let u=(-r-a)/o,d=(r-a)/o;u>d&&([u,d]=[d,u]),c=Math.max(c,u),l=Math.min(l,d)}l>=Math.max(c,0)&&c>0&&(!i||c<i.t)&&(i={index:o,t:c})}),i}position(e){let t=this.cubes[e].positionLin;return[t.x/Y,t.y/Y,t.z/Y]}release(e=-1,t=!1){let n=this.grabs.get(e);if(!n)return;n.goal.destroy();for(let e of n.ignores)e.destroy();let i=t?n.throws.estimate():null;i&&(n.body.velocityLin=fr(r(i.v[0],i.v[1],i.v[2]),40),n.body.velocityAng=fr(r(i.w[0],i.w[1],i.w[2]),30)),this.grabs.delete(e)}heldBy(e){let t=this.grabs.get(e);return t?this.cubes.indexOf(t.body):-1}reset(){for(let e of[...this.grabs.keys()])this.release(e);this.cubes.forEach((e,t)=>this.respawn(e,t))}},hr=-.2,gr={need:2,slack:.014,open:.02,ms:180,unselect:`all`},_r={fingers:[`optional`,`optional`,`optional`,`optional`],unselect:`all`},vr={x0:-1.9,x1:1.9,z0:-.74,z1:.74},yr=[E.x,0,E.z],br=12,xr=E.thickness/2,Sr=E.profile[0][1]-xr,Cr=E.profile[1][0]+xr,wr=E.profile[E.profile.length-1],Tr=D.profile[1][1]+D.thickness/2;function Er(e){let t=Math.hypot(e.x,e.y,e.z,e.w)||1;return a(e.x/t,e.y/t,e.z/t,e.w/t)}function Dr(e,t,n){let r=e.x*t.x+e.y*t.y+e.z*t.z+e.w*t.w<0?-1:1;return Er(a(e.x+(t.x*r-e.x)*n,e.y+(t.y*r-e.y)*n,e.z+(t.z*r-e.z)*n,e.w+(t.w*r-e.w)*n))}function Or(e){let t=[];pr(e,t);let n=Math.atan2(t[8],t[10]);return a(0,Math.sin(n/2),0,Math.cos(n/2))}var kr=class{touch=gr;palm=_r;pos=[...yr];q=a();vel=[0,0,0];ang=[0,0,0];prevPos=[...yr];prevQ=a();holder=null;confident=!0;clock=0;throws=new Qn;resting=!0;desktopTarget=null;R=[];get heldBy(){return this.holder}local(e){pr(this.q,this.R);let t=this.R,n=[e[0]-this.pos[0],e[1]-this.pos[1],e[2]-this.pos[2]],r=n[0]*t[0]+n[1]*t[1]+n[2]*t[2],i=n[0]*t[4]+n[1]*t[5]+n[2]*t[6],a=n[0]*t[8]+n[1]*t[9]+n[2]*t[10],o=Math.hypot(r,a);return{rho:o,y:i,dir:o>1e-6?[r/o,a/o]:[1,0]}}distance(e){let{rho:t,y:n}=this.local(e),r=1/0,i=E.profile;for(let e=0;e+1<i.length;e++){let[a,o]=i[e],[s,c]=i[e+1],l=s-a,u=c-o,d=Math.min(1,Math.max(0,((t-a)*l+(n-o)*u)/(l*l+u*u)));r=Math.min(r,Math.hypot(t-a-l*d,n-o-u*d))}return r-xr}pose(){return{pos:[...this.pos],q:{...this.q}}}contacts(e,t){if(this.distance(e.thumb)-e.radii[0]>t)return null;let n=this.local(e.thumb).dir,r=[];return e.tips.forEach((i,a)=>{if(this.distance(i)-e.radii[a+1]>t)return;let o=this.local(i).dir;o[0]*n[0]+o[1]*n[1]<hr&&r.push(a)}),r}canGrab(e){return this.holder===null||this.holder===e}select(e){this.holder=e,this.throws.reset(),this.resting=!1}move(e,t,n){if(this.holder===e){if(this.confident=n,e===-1){this.desktopTarget=[...t.pos];return}this.pos=[...t.pos],this.q=Er(t.q)}}release(e,t=!1){if(this.holder!==e)return;this.holder=null,this.desktopTarget=null;let n=t?this.throws.estimate():null;this.vel=n?n.v.map(e=>Math.max(-6,Math.min(6,e))):[0,0,0],this.ang=[0,0,0],this.resting=!1}pick(e,t){let n=wr[0]+xr+.02;for(let r=.05;r<6;r+=.005){let i=this.local([e[0]+t[0]*r,e[1]+t[1]*r,e[2]+t[2]*r]);if(i.rho<n&&i.y>Sr&&i.y<wr[1]+xr)return r}return null}reset(){this.holder=null,this.desktopTarget=null,this.pos=[...yr],this.prevPos=[...yr],this.q=a(),this.prevQ=a(),this.vel=[0,0,0],this.ang=[0,0,0],this.resting=!0}step(e,t){if(!(e<=0)){if(this.clock+=e,this.desktopTarget){let e=this.desktopTarget;for(let t=0;t<3;t++)this.pos[t]+=(e[t]-this.pos[t])*.5;this.q=Dr(this.q,Or(this.q),.3)}if(this.holder!==null){this.throws.push(this.pos,this.q,this.clock,this.confident);let t=[0,1,2].map(t=>(this.pos[t]-this.prevPos[t])/e);this.vel=t.map(e=>Math.max(-30,Math.min(30,e)));let r=n(this.q,c(this.prevQ));r.w<0&&(r=a(-r.x,-r.y,-r.z,-r.w));let i=Math.hypot(r.x,r.y,r.z),o=i>1e-6?2*Math.atan2(i,r.w)/i/e:0;this.ang=[r.x*o,r.y*o,r.z*o]}else this.resting?(this.vel=[0,0,0],this.ang=[0,0,0]):this.fall(e,t);this.prevPos=[...this.pos],this.prevQ={...this.q},this.pos[1]<-2&&this.reset()}}fall(e,t){let n=this.q;this.vel[1]-=t*e;for(let t=0;t<3;t++)this.pos[t]+=this.vel[t]*e;let r=1/0,i=this.pos;pr(this.q,this.R);let a=this.R;for(let[e,t]of[[Cr,Sr],[wr[0]+xr,wr[1]]])for(let n=0;n<br;n++){let o=n/br*Math.PI*2,s=Math.cos(o)*e,c=Math.sin(o)*e,l=[0,1,2].map(e=>this.pos[e]+a[e]*s+a[4+e]*t+a[8+e]*c);l[1]<r&&(r=l[1],i=l)}let o=i[0]>vr.x0&&i[0]<vr.x1&&i[2]>vr.z0&&i[2]<vr.z1,s=i[0]>N.x0&&i[0]<N.x1&&i[2]>N.z0&&i[2]<N.z1,c=Math.hypot(i[0]-D.x,i[2]-D.z)<O,l=o?(s?-N.depth:c?Tr:0)+Sr:-1/0;if(r>=l)return;this.pos[1]+=l-r,this.vel[1]<0&&(this.vel[1]=0),this.vel[0]*=.6,this.vel[2]*=.6,this.q=Dr(n,Or(n),.35);let u=Or(this.q);1-Math.abs(this.q.x*u.x+this.q.y*u.y+this.q.z*u.z+this.q.w*u.w)<1e-4&&Math.hypot(this.vel[0],this.vel[2])<.05&&(this.q=u,this.resting=!0)}writeSim(e,t,n){pr(this.q,this.R);let r=this.R;e.set([this.pos[0]+t.x/2,this.pos[1]+n,this.pos[2]+t.z/2,0],0);for(let t=0;t<3;t++)e.set([r[t*4],r[t*4+1],r[t*4+2],this.vel[t]],4+t*4);e.set([this.ang[0],this.ang[1],this.ang[2],0],16)}writeMatrix(e){pr(this.q,e,0),e[3]=0,e[7]=0,e[11]=0,e[12]=this.pos[0],e[13]=this.pos[1],e[14]=this.pos[2],e[15]=1}},Ar={need:1,slack:.012,open:.018,ms:140,unselect:`all`},jr={fingers:[`optional`,`optional`,`optional`,`optional`],unselect:`all`},Mr={x0:-1.9,x1:1.9,z0:-.74,z1:.74},Nr=[.34,0,.22],{hx:Pr,hy:Fr,hz:Ir}=de,Lr=D.profile[1][1]+D.thickness/2,Rr=2.4,zr=.055;function Br(e){let t=Math.hypot(e.x,e.y,e.z,e.w)||1;return a(e.x/t,e.y/t,e.z/t,e.w/t)}function Vr(e,t,n){let r=e.x*t.x+e.y*t.y+e.z*t.z+e.w*t.w<0?-1:1;return Br(a(e.x+(t.x*r-e.x)*n,e.y+(t.y*r-e.y)*n,e.z+(t.z*r-e.z)*n,e.w+(t.w*r-e.w)*n))}function Hr(e){let t=[];pr(e,t);let n=Math.atan2(t[8],t[10]);return a(0,Math.sin(n/2),0,Math.cos(n/2))}function Ur(e,t,n,r,i,a){let o=Math.abs(e)-r,s=Math.abs(t)-i,c=Math.abs(n)-a;return Math.hypot(Math.max(o,0),Math.max(s,0),Math.max(c,0))+Math.min(Math.max(o,s,c),0)}var Wr=class{touch=Ar;palm=jr;pos=[...Nr];q=a();lit=!1;boost=0;vel=[0,0,0];prevPos=[...Nr];prevQ=a();holder=null;confident=!0;clock=0;throws=new Qn;resting=!0;desktopTarget=null;R=[];heldAt=0;struckAt=0;prevThumb=null;wheelAngle=0;wheelSpeed=0;body=u();placed=u();spin=u();tilt=u();axle=u();local=u();flame=u();wheel=u();get heldBy(){return this.holder}basis(){pr(this.q,this.R)}into(e){this.basis();let t=this.R,n=e[0]-this.pos[0],r=e[1]-this.pos[1],i=e[2]-this.pos[2];return[n*t[0]+r*t[1]+i*t[2],n*t[4]+r*t[5]+i*t[6],n*t[8]+r*t[9]+i*t[10]]}intoDir(e){this.basis();let t=this.R;return[e[0]*t[0]+e[1]*t[1]+e[2]*t[2],e[0]*t[4]+e[1]*t[5]+e[2]*t[6],e[0]*t[8]+e[1]*t[9]+e[2]*t[10]]}distance(e){let t=this.into(e),n=Ur(t[0],t[1]-Fr,t[2],Pr,Fr,Ir),r=fe,i=Math.hypot(t[0]-r[0],t[1]-r[1],t[2]-r[2])-.016;return Math.min(n,i)}pose(){return{pos:[...this.pos],q:{...this.q}}}contacts(e,t){if(this.distance(e.thumb)-e.radii[0]>t)return null;let n=[];return e.tips.forEach((r,i)=>{this.distance(r)-e.radii[i+1]<=t&&n.push(i)}),n}canGrab(e){return this.holder===null||this.holder===e}select(e){this.holder=e,this.throws.reset(),this.resting=!1,this.heldAt=performance.now(),this.prevThumb=null}move(e,t,n){if(this.holder===e){if(this.confident=n,e===-1){this.desktopTarget=[...t.pos];return}this.pos=[...t.pos],this.q=Br(t.q)}}release(e,t=!1){if(this.holder!==e)return;this.holder=null,this.desktopTarget=null,this.prevThumb=null;let n=t?this.throws.estimate():null;this.vel=n?n.v.map(e=>Math.max(-6,Math.min(6,e))):[0,0,0],this.resting=!1}ignite(){this.lit=!0,this.wheelSpeed=62,this.boost=1,this.struckAt=performance.now()}strike(){this.holder!==null&&(performance.now()-this.struckAt<350||this.ignite())}consider(e,t){if(this.holder===null||this.holder<0||!e?.visible||!e.fresh||t<=0||t>.1){this.prevThumb=null;return}let n=this.into(e.thumb),r=this.prevThumb;if(this.prevThumb=n,!r||performance.now()-this.heldAt<180)return;let i=(n[1]-r[1])/t,a=fe;(Math.hypot(n[0]-a[0],n[1]-a[1],n[2]-a[2])<zr||Math.hypot(r[0]-a[0],r[1]-a[1],r[2]-a[2])<zr)&&i>Rr&&this.strike()}tick(e){e<=0||(this.wheelAngle=(this.wheelAngle+this.wheelSpeed*e)%(Math.PI*2),this.wheelSpeed*=Math.exp(-e*8),this.boost=Math.max(0,this.boost-e*5))}pick(e,t){let n=this.into(e),r=this.intoDir(t),i=[0,Fr,0],a=[Pr,Fr,Ir+.02],o=0,s=8;for(let e=0;e<3;e++){let t=1/(Math.abs(r[e])<1e-8?1e-8*Math.sign(r[e]||1):r[e]),c=(i[e]-a[e]-n[e])*t,l=(i[e]+a[e]-n[e])*t;if(c>l){let e=c;c=l,l=e}o=Math.max(o,c),s=Math.min(s,l)}if(s<o||s<0)return null;let c=o>.02?o:s;return c<6?c:null}reset(){this.holder=null,this.desktopTarget=null,this.prevThumb=null,this.pos=[...Nr],this.prevPos=[...Nr],this.q=a(),this.prevQ=a(),this.vel=[0,0,0],this.resting=!0,this.lit=!1,this.boost=0,this.wheelSpeed=0}step(e,t){if(!(e<=0)){if(this.clock+=e,this.desktopTarget){let e=this.desktopTarget;for(let t=0;t<3;t++)this.pos[t]+=(e[t]-this.pos[t])*.5;this.q=Vr(this.q,Hr(this.q),.3)}if(this.holder!==null){this.throws.push(this.pos,this.q,this.clock,this.confident);let t=[0,1,2].map(t=>(this.pos[t]-this.prevPos[t])/e);this.vel=t.map(e=>Math.max(-30,Math.min(30,e)))}else this.resting?this.vel=[0,0,0]:this.fall(e,t);this.prevPos=[...this.pos],this.prevQ={...this.q},this.pos[1]<-2&&this.reset()}}fall(e,t){let n=this.q;this.vel[1]-=t*e;for(let t=0;t<3;t++)this.pos[t]+=this.vel[t]*e;this.basis();let r=this.R,i=1/0,a=this.pos;for(let e of[-Pr,Pr])for(let t of[0,Fr*2])for(let n of[-Ir,Ir]){let o=[this.pos[0]+r[0]*e+r[4]*t+r[8]*n,this.pos[1]+r[1]*e+r[5]*t+r[9]*n,this.pos[2]+r[2]*e+r[6]*t+r[10]*n];o[1]<i&&(i=o[1],a=o)}let o=a[0]>Mr.x0&&a[0]<Mr.x1&&a[2]>Mr.z0&&a[2]<Mr.z1,s=a[0]>N.x0&&a[0]<N.x1&&a[2]>N.z0&&a[2]<N.z1,c=Math.hypot(a[0]-D.x,a[2]-D.z)<O,l=o?s?-N.depth:c?Lr:0:-1/0;if(i>=l)return;this.pos[1]+=l-i,this.vel[1]<0&&(this.vel[1]=0),this.vel[0]*=.6,this.vel[2]*=.6,this.q=Vr(n,Hr(n),.35);let u=Hr(this.q);1-Math.abs(this.q.x*u.x+this.q.y*u.y+this.q.z*u.z+this.q.w*u.w)<1e-4&&Math.hypot(this.vel[0],this.vel[2])<.05&&(this.q=u,this.resting=!0)}writeBody(e){pr(this.q,e),e[3]=0,e[7]=0,e[11]=0,e[12]=this.pos[0],e[13]=this.pos[1],e[14]=this.pos[2],e[15]=1}writeWheel(e){this.writeBody(this.body);let t=Math.sin(this.wheelAngle),n=Math.cos(this.wheelAngle),r=this.spin,i=this.tilt,a=this.axle;r.fill(0),r[0]=n,r[2]=-t,r[5]=1,r[8]=t,r[10]=n,r[15]=1,i.fill(0),i[1]=-1,i[4]=1,i[10]=1,i[15]=1,a.fill(0),a[0]=a[5]=a[10]=a[15]=1,a[12]=fe[0],a[13]=fe[1],a[14]=fe[2],g(this.placed,i,r),g(e,a,this.placed),g(this.placed,this.body,e),e.set(this.placed)}writeFlame(e){this.writeBody(this.body);let t=this.local;t.fill(0);let n=pe;t[0]=n.w,t[5]=n.h,t[10]=n.d,t[15]=1,t[12]=n.x,t[13]=n.y,t[14]=n.z,g(e,this.body,t)}},Gr=`// Temperature grid for the lighter flame. Group 0 is this pass only; the raymarch lives in flame.wgsl.\r
\r
const NX: i32 = 16;\r
const NY: i32 = 48;\r
const NZ: i32 = 16;\r
\r
struct StepU {\r
  // x = time, y = substep dt, z = lit, w = strike boost\r
  state: vec4f,\r
};\r
\r
@group(0) @binding(0) var src_tex: texture_3d<f32>;\r
@group(0) @binding(1) var dst_tex: texture_storage_3d<rgba16float, write>;\r
@group(0) @binding(2) var<uniform> step_u: StepU;\r
\r
fn dims() -> vec3f {\r
  return vec3f(f32(NX), f32(NY), f32(NZ));\r
}\r
\r
fn clamp_cell(i: vec3i) -> vec3i {\r
  return clamp(i, vec3i(0), vec3i(NX - 1, NY - 1, NZ - 1));\r
}\r
\r
fn load_temp(i: vec3i) -> f32 {\r
  return textureLoad(src_tex, clamp_cell(i), 0).r;\r
}\r
\r
fn sample_temp(p: vec3f) -> f32 {\r
  let c = clamp(p, vec3f(0.0), dims() - vec3f(1.0));\r
  let i = vec3i(floor(c));\r
  let f = fract(c);\r
  let c00 = mix(load_temp(i), load_temp(i + vec3i(1, 0, 0)), f.x);\r
  let c10 = mix(load_temp(i + vec3i(0, 1, 0)), load_temp(i + vec3i(1, 1, 0)), f.x);\r
  let c01 = mix(load_temp(i + vec3i(0, 0, 1)), load_temp(i + vec3i(1, 0, 1)), f.x);\r
  let c11 = mix(load_temp(i + vec3i(0, 1, 1)), load_temp(i + vec3i(1, 1, 1)), f.x);\r
  return mix(mix(c00, c10, f.y), mix(c01, c11, f.y), f.z);\r
}\r
\r
@compute @workgroup_size(4, 4, 4)\r
fn cs_clear(@builtin(global_invocation_id) gid: vec3u) {\r
  if (any(gid >= vec3u(u32(NX), u32(NY), u32(NZ)))) { return; }\r
  textureStore(dst_tex, gid, vec4f(0.0));\r
}\r
\r
@compute @workgroup_size(4, 4, 4)\r
fn cs_flame(@builtin(global_invocation_id) gid: vec3u) {\r
  if (any(gid >= vec3u(u32(NX), u32(NY), u32(NZ)))) { return; }\r
  let u = step_u.state;\r
  let uv = (vec3f(gid) + 0.5) / dims();\r
  let temp0 = load_temp(vec3i(gid));\r
  let n = sin(uv.y * 28.0 + u.x * 9.0) * cos(uv.x * 17.0 + u.x * 5.0);\r
  let vel = vec3f(n * 11.0, 34.0 + temp0 * 88.0, cos(uv.y * 22.0 - u.x * 7.0) * 11.0);\r
  var temp = sample_temp(vec3f(gid) + 0.5 - vel * u.y - 0.5);\r
  var blur = 0.0;\r
  blur += load_temp(vec3i(gid) + vec3i(1, 0, 0));\r
  blur += load_temp(vec3i(gid) + vec3i(-1, 0, 0));\r
  blur += load_temp(vec3i(gid) + vec3i(0, 1, 0));\r
  blur += load_temp(vec3i(gid) + vec3i(0, -1, 0));\r
  blur += load_temp(vec3i(gid) + vec3i(0, 0, 1));\r
  blur += load_temp(vec3i(gid) + vec3i(0, 0, -1));\r
  temp = mix(temp, blur / 6.0, 0.22);\r
  let radial = length(uv.xz - vec2f(0.5));\r
  temp *= exp(-u.y * (1.35 + uv.y * 3.6 + radial * radial * 7.0));\r
  if (u.z > 0.5 && gid.y < 5u) {\r
    let dx = f32(gid.x) - (f32(NX) - 1.0) * 0.5;\r
    let dz = f32(gid.z) - (f32(NZ) - 1.0) * 0.5;\r
    let wick = exp(-(dx * dx + dz * dz) / 5.5);\r
    temp = max(temp, wick * (1.25 + u.w));\r
  }\r
  textureStore(dst_tex, gid, vec4f(clamp(temp, 0.0, 2.0), 0.0, 0.0, 1.0));\r
}\r
`,Kr=`// Raymarch of the lighter's temperature volume. The grid itself is flame_step.wgsl.\r
\r
struct View {\r
  view_proj: mat4x4f,\r
  content_mvp: mat4x4f,\r
  view: mat4x4f,\r
  content_view: mat4x4f,\r
  proj: mat4x4f,\r
  bg_dir: mat4x4f,\r
  cam_content: vec4f,\r
  cam_world: vec4f,\r
  output: vec4f,\r
};\r
\r
struct Occlusion {\r
  depth_from_eye: mat4x4f,\r
  depth_proj: mat4x4f,\r
  uv_from_view: mat4x4f,\r
  params: vec4f,\r
  extra: vec4f,\r
};\r
\r
struct FlameU {\r
  model: mat4x4f,\r
  inv: mat4x4f,\r
  state: vec4f,\r
};\r
\r
@group(0) @binding(0) var<uniform> view: View;\r
\r
@group(1) @binding(0) var<uniform> flame_u: FlameU;\r
@group(1) @binding(1) var flame_tex: texture_3d<f32>;\r
@group(1) @binding(2) var flame_samp: sampler;\r
\r
@group(2) @binding(0) var<uniform> occ: Occlusion;\r
@group(2) @binding(1) var depth_f32: texture_2d<f32>;\r
@group(2) @binding(2) var depth_u16: texture_2d<u32>;\r
\r
fn real_occludes(p_eye: vec4f) -> bool {\r
  let kind = occ.params.y;\r
  if (kind < 0.5) { return false; }\r
  let p_depth = occ.depth_from_eye * p_eye;\r
  let clip = occ.depth_proj * p_depth;\r
  if (clip.w <= 0.0) { return false; }\r
  let ndc = clip.xy / clip.w;\r
  let view_uv = vec2f(ndc.x * 0.5 + 0.5, 0.5 - ndc.y * 0.5);\r
  let duv = (occ.uv_from_view * vec4f(view_uv, 0.0, 1.0)).xy;\r
  if (duv.x < 0.0 || duv.y < 0.0 || duv.x >= 1.0 || duv.y >= 1.0) { return false; }\r
  let px = vec2i(duv * occ.params.zw);\r
  var raw = 0.0;\r
  if (kind > 1.5) {\r
    raw = f32(textureLoad(depth_u16, px, 0).r);\r
  } else {\r
    raw = textureLoad(depth_f32, px, 0).r;\r
  }\r
  let meters = raw * occ.params.x;\r
  return meters > 0.0 && meters + 0.02 < -p_depth.z - occ.extra.x;\r
}\r
\r
fn aces(color_in: vec3f) -> vec3f {\r
  let input_mat = mat3x3f(\r
    vec3f(0.59719, 0.07600, 0.02840),\r
    vec3f(0.35458, 0.90834, 0.13383),\r
    vec3f(0.04823, 0.01566, 0.83777),\r
  );\r
  let output_mat = mat3x3f(\r
    vec3f(1.60475, -0.10208, -0.00327),\r
    vec3f(-0.53108, 1.10813, -0.07276),\r
    vec3f(-0.07367, -0.00605, 1.07602),\r
  );\r
  var c = input_mat * (color_in * view.output.w / 0.6);\r
  let a = c * (c + 0.0245786) - 0.000090537;\r
  let b = c * (0.983729 * c + 0.4329510) + 0.238081;\r
  c = output_mat * (a / b);\r
  return clamp(c, vec3f(0.0), vec3f(1.0));\r
}\r
\r
fn encode(c: vec3f) -> vec3f {\r
  if (view.output.y < 0.5) { return c; }\r
  let lo = c * 12.92;\r
  let hi = 1.055 * pow(max(c, vec3f(0.0)), vec3f(1.0 / 2.4)) - 0.055;\r
  return select(hi, lo, c <= vec3f(0.0031308));\r
}\r
\r
struct FlameOut {\r
  @builtin(position) pos: vec4f,\r
  @location(0) local: vec3f,\r
  @location(1) content: vec3f,\r
  @location(2) eye: vec3f,\r
};\r
\r
@vertex fn vs_flame(@location(0) p: vec3f) -> FlameOut {\r
  let content = (flame_u.model * vec4f(p, 1.0)).xyz;\r
  var o: FlameOut;\r
  o.pos = view.content_mvp * vec4f(content, 1.0);\r
  o.local = p;\r
  o.content = content;\r
  o.eye = (view.content_view * vec4f(content, 1.0)).xyz;\r
  return o;\r
}\r
\r
fn box_hit(ro: vec3f, rd: vec3f) -> vec2f {\r
  let inv = 1.0 / rd;\r
  let t0 = (-vec3f(0.5) - ro) * inv;\r
  let t1 = (vec3f(0.5) - ro) * inv;\r
  let tmin = min(t0, t1);\r
  let tmax = max(t0, t1);\r
  return vec2f(max(max(tmin.x, tmin.y), tmin.z), min(min(tmax.x, tmax.y), tmax.z));\r
}\r
\r
fn blackbody(t: f32) -> vec3f {\r
  let x = clamp(t, 0.0, 1.6);\r
  var c = mix(vec3f(0.15, 0.35, 1.0), vec3f(1.0, 0.22, 0.02), smoothstep(0.0, 0.28, x));\r
  c = mix(c, vec3f(1.0, 0.62, 0.08), smoothstep(0.22, 0.62, x));\r
  c = mix(c, vec3f(1.0, 0.94, 0.78), smoothstep(0.58, 1.15, x));\r
  return c * x;\r
}\r
\r
@fragment fn fs_flame(in: FlameOut) -> @location(0) vec4f {\r
  if (real_occludes(vec4f(in.eye, 1.0))) { discard; }\r
  let ro = (flame_u.inv * vec4f(view.cam_content.xyz, 1.0)).xyz;\r
  let rd = normalize(in.local - ro);\r
  let hit = box_hit(ro, rd);\r
  if (hit.y <= max(hit.x, 0.0)) { discard; }\r
  let t0 = max(hit.x, 0.0);\r
  let t1 = hit.y;\r
  let steps = 22.0;\r
  let dt = (t1 - t0) / steps;\r
  var accum = vec3f(0.0);\r
  var trans = 1.0;\r
  let time = flame_u.state.x;\r
  for (var s = 0.0; s < steps; s += 1.0) {\r
    let p = ro + rd * (t0 + (s + 0.5) * dt);\r
    let uv = p + vec3f(0.5);\r
    if (uv.x < 0.0 || uv.y < 0.0 || uv.z < 0.0 || uv.x > 1.0 || uv.y > 1.0 || uv.z > 1.0) { continue; }\r
    let warp = vec3f(sin(uv.y * 16.0 + time * 6.0), 0.0, cos(uv.y * 14.0 - time * 5.0)) * (0.018 * uv.y);\r
    let temp = textureSampleLevel(flame_tex, flame_samp, clamp(uv + warp, vec3f(0.0), vec3f(1.0)), 0.0).r;\r
    let dens = smoothstep(0.04, 0.55, temp) * (1.0 - smoothstep(0.82, 1.05, uv.y));\r
    let a = 1.0 - exp(-dens * 6.0 * dt);\r
    accum += trans * a * blackbody(temp) * 3.0;\r
    trans *= 1.0 - a;\r
  }\r
  let alpha = 1.0 - trans;\r
  if (alpha < 0.02) { discard; }\r
  return vec4f(encode(aces(accum)) * alpha, alpha);\r
}\r
`,qr=16,Jr=48,Yr=16,Xr=2,Zr={color:{srcFactor:`one`,dstFactor:`one-minus-src-alpha`},alpha:{srcFactor:`one`,dstFactor:`one-minus-src-alpha`}};function Qr(){let e=[1,3,7,1,7,5,0,4,6,0,6,2,2,6,7,2,7,3,0,1,5,0,5,4,4,5,7,4,7,6,0,2,3,0,3,1],t=new Float32Array(e.length*3);return e.forEach((e,n)=>{t[n*3]=(e&1)-.5,t[n*3+1]=(e>>1&1)-.5,t[n*3+2]=(e>>2&1)-.5}),t}var $r=class{device;stepPipe;clearPipe;stepGroup=[];clearGroup=[];drawGroup=[];pipes=new Map;pending=new Map;stepBuf;drawBuf;stepData=new Float32Array(4);drawData=new Float32Array(36);inv=new Float32Array(16);vb;drawLayout;renderModule;layouts;front=0;time=0;lit=!1;async init(e){this.device=e;let t=e.createShaderModule({code:Gr,label:`goo-flame-step`});this.renderModule=e.createShaderModule({code:Kr,label:`goo-flame`});let n=(await Promise.all([t.getCompilationInfo(),this.renderModule.getCompilationInfo()])).flatMap(e=>e.messages.filter(e=>e.type===`error`));if(n.length)throw Error(`flame WGSL:\n${n.map(e=>`${e.lineNum}:${e.linePos} ${e.message}`).join(`
`)}`);let r=t=>e.createTexture({label:t,size:[qr,Jr,Yr],dimension:`3d`,format:`rgba16float`,usage:GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.STORAGE_BINDING}),i=[r(`goo-flame-0`),r(`goo-flame-1`)],a=e.createBindGroupLayout({label:`goo-flame-compute`,entries:[{binding:0,visibility:GPUShaderStage.COMPUTE,texture:{viewDimension:`3d`,sampleType:`float`}},{binding:1,visibility:GPUShaderStage.COMPUTE,storageTexture:{access:`write-only`,format:`rgba16float`,viewDimension:`3d`}},{binding:2,visibility:GPUShaderStage.COMPUTE,buffer:{type:`uniform`}}]});this.stepBuf=e.createBuffer({size:16,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST,label:`goo-flame-step`});let o=e.createPipelineLayout({bindGroupLayouts:[a]});this.stepPipe=e.createComputePipeline({label:`goo-flame-step`,layout:o,compute:{module:t,entryPoint:`cs_flame`}}),this.clearPipe=e.createComputePipeline({label:`goo-flame-clear`,layout:o,compute:{module:t,entryPoint:`cs_clear`}});let s=(t,n)=>e.createBindGroup({layout:a,entries:[{binding:0,resource:i[t].createView()},{binding:1,resource:i[n].createView()},{binding:2,resource:{buffer:this.stepBuf}}]});for(let e=0;e<2;e++)this.stepGroup[e]=s(e,1-e),this.clearGroup[e]=s(1-e,e);this.drawBuf=e.createBuffer({size:this.drawData.byteLength,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST,label:`goo-flame-draw`});let c=e.createSampler({magFilter:`linear`,minFilter:`linear`});this.drawLayout=e.createBindGroupLayout({label:`goo-flame-draw`,entries:[{binding:0,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,buffer:{type:`uniform`}},{binding:1,visibility:GPUShaderStage.FRAGMENT,texture:{viewDimension:`3d`,sampleType:`float`}},{binding:2,visibility:GPUShaderStage.FRAGMENT,sampler:{type:`filtering`}}]});for(let t=0;t<2;t++)this.drawGroup[t]=e.createBindGroup({layout:this.drawLayout,entries:[{binding:0,resource:{buffer:this.drawBuf}},{binding:1,resource:i[t].createView()},{binding:2,resource:c}]});let l=Qr();this.vb=e.createBuffer({size:l.byteLength,usage:GPUBufferUsage.VERTEX|GPUBufferUsage.COPY_DST,label:`goo-flame-cube`}),e.queue.writeBuffer(this.vb,0,l);let u=e.createCommandEncoder();this.encodeClear(u),e.queue.submit([u.finish()])}sync(e,t,n,r){this.lit=t,this.time+=r,this.drawData.set(e,0),_(this.inv,e),this.drawData.set(this.inv,16),this.drawData[32]=this.time,this.stepData[0]=this.time,this.stepData[1]=Math.min(Math.max(r,0),.05)/Xr,this.stepData[2]=+!!t,this.stepData[3]=n,this.device.queue.writeBuffer(this.stepBuf,0,this.stepData),this.device.queue.writeBuffer(this.drawBuf,0,this.drawData)}encode(e){if(!this.lit)return;let t=e.beginComputePass();t.setPipeline(this.stepPipe);for(let e=0;e<Xr;e++){let e=this.front;t.setBindGroup(0,this.stepGroup[e]),t.dispatchWorkgroups(qr/4,Jr/4,Yr/4),this.front=1-e}t.end()}reset(){this.lit=!1,this.front=0;let e=this.device.createCommandEncoder();this.encodeClear(e),this.device.queue.submit([e.finish()])}encodeClear(e){let t=e.beginComputePass();t.setPipeline(this.clearPipe);for(let e of this.clearGroup)t.setBindGroup(0,e),t.dispatchWorkgroups(qr/4,Jr/4,Yr/4);t.end()}prepare(e,t,n){this.layouts=n;let r=`${e}|${t}`;if(this.pipes.has(r))return Promise.resolve();let i=this.pending.get(r);return i||(i=this.build(e,t).then(e=>{this.pipes.set(r,e)}),this.pending.set(r,i)),i}draw(e,t,n){if(!this.lit)return;let r=this.pipes.get(`${t}|${n}`);r&&(e.setPipeline(r),e.setBindGroup(1,this.drawGroup[this.front]),e.setVertexBuffer(0,this.vb),e.draw(36))}build(e,t){let{view:n,occ:r,wipe:i}=this.layouts;return this.device.createRenderPipelineAsync({label:`goo-flame-${e}-${t}`,layout:this.device.createPipelineLayout({bindGroupLayouts:[n,this.drawLayout,r,i]}),vertex:{module:this.renderModule,entryPoint:`vs_flame`,buffers:[{arrayStride:12,attributes:[{shaderLocation:0,offset:0,format:`float32x3`}]}]},fragment:{module:this.renderModule,entryPoint:`fs_flame`,targets:[{format:e,blend:Zr}]},primitive:{topology:`triangle-list`,cullMode:`back`},depthStencil:{format:rt,depthWriteEnabled:!1,depthCompare:`less`},multisample:{count:t}})}},ei=`system-ui, "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif`,ti=[[`🧊`,`Ice`,`Drop 3 cubes from the well into the glass`],[`🟢`,`Goo`,`Run the tap, scoop goo in until it’s half full`],[`🏜️`,`Sand`,`Pinch some from the jar, sprinkle on top`],[`🥄`,`Serve`,`Swirl once, slide it to the nearest alien 👽`]];function ni(e){let t=1024,n=new OffscreenCanvas(t,748),r=n.getContext(`2d`),i=r.createLinearGradient(0,0,t,748);i.addColorStop(0,`#1a1036`),i.addColorStop(.55,`#0c1a33`),i.addColorStop(1,`#062a2e`),r.fillStyle=i,r.fillRect(0,0,t,748);for(let e=0;e<90;e++){let n=e*283.7%t,i=(e*151.3+e%7*37)%748;r.fillStyle=`rgba(200, 230, 255, ${.08+e%5*.05})`,r.fillRect(n,i,2+e%3,2+e%3)}r.textBaseline=`middle`,r.fillStyle=`#7ef9ff`,r.font=`600 30px ${ei}`,r.fillText(`TONIGHT’S SPECIAL`,56,64),r.fillStyle=`#ffffff`,r.font=`800 64px ${ei}`,r.fillText(`🌌 Nebula Sludge`,52,128),r.fillStyle=`#ff8ae2`,r.font=`600 34px ${ei}`,r.fillText(`on the rocks, with a sandy rim`,58,184),r.textAlign=`right`,r.font=`700 34px ${ei}`,r.fillStyle=`#ffe07a`,r.fillText(`⭐⭐⭐⭐⭐  4 ✦cr`,t-52,64),r.textAlign=`left`,ti.forEach(([e,n,i],a)=>{let o=236+a*104;r.fillStyle=a%2?`rgba(255, 255, 255, 0.05)`:`rgba(126, 249, 255, 0.07)`,r.beginPath(),r.roundRect(40,o,t-80,90,22),r.fill(),r.font=`64px ${ei}`,r.fillStyle=`#ffffff`,r.fillText(e,64,o+90/2+4),r.fillStyle=`#7ef9ff`,r.font=`700 26px ${ei}`,r.fillText(`${a+1} · ${n.toUpperCase()}`,164,o+28),r.fillStyle=`#eef6ff`,r.font=`500 36px ${ei}`,r.fillText(i,164,o+64)}),r.fillStyle=`rgba(238, 246, 255, 0.55)`,r.font=`500 28px ${ei}`,r.textAlign=`center`,r.fillText(`🫙 sand    ·    🥃 glass    ·    🚰 goo    ·    🧊 ice`,t/2,706);let a=e.createTexture({size:[t,748],format:`rgba8unorm-srgb`,usage:GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_DST|GPUTextureUsage.RENDER_ATTACHMENT});return e.queue.copyExternalImageToTexture({source:n},{texture:a,colorSpace:`srgb`,premultipliedAlpha:!1},[t,748]),a}var ri=`// The bar set and its crowd. Lighting runs in set space (metres, floor at y = 0); set_to_world\r
// places that frame under the goo tray. Tone mapping and encode match scene.wgsl.\r
\r
const LIGHTS: u32 = 10u;\r
\r
struct View {\r
  view_proj: mat4x4f,\r
  set_to_world: mat4x4f,\r
  // xyz = camera in set space\r
  cam: vec4f,\r
  // x = seconds, y = encode sRGB in shader, w = exposure\r
  output: vec4f,\r
  sky: vec4f,\r
  ground: vec4f,\r
  // xyz = set-space position, w = radius\r
  light_pos: array<vec4f, LIGHTS>,\r
  // rgb = colour × intensity\r
  light_color: array<vec4f, LIGHTS>,\r
  // towards the sun, set space\r
  sun_dir: vec4f,\r
  sun_color: vec4f,\r
};\r
\r
struct Instance {\r
  model: mat4x4f,\r
  // rgb multiplies the albedo, w = rim strength\r
  tint: vec4f,\r
  // x = first palette slot\r
  base: vec4u,\r
};\r
\r
@group(0) @binding(0) var<uniform> view: View;\r
@group(1) @binding(0) var<storage, read> palette: array<mat4x4f>;\r
@group(1) @binding(1) var<storage, read> instances: array<Instance>;\r
\r
struct VIn {\r
  @location(0) pos: vec3f,\r
  @location(1) nrm: vec3f,\r
  @location(2) color: vec4f,\r
  @location(3) joints: vec4u,\r
  @location(4) weights: vec4f,\r
};\r
\r
struct VOut {\r
  @builtin(position) clip: vec4f,\r
  @location(0) p: vec3f,\r
  @location(1) n: vec3f,\r
  @location(2) albedo: vec3f,\r
  @location(3) @interpolate(flat) glow: f32,\r
  @location(4) @interpolate(flat) rim: f32,\r
};\r
\r
fn decode(c: vec3f) -> vec3f {\r
  let lo = c / 12.92;\r
  let hi = pow((c + 0.055) / 1.055, vec3f(2.4));\r
  return select(hi, lo, c <= vec3f(0.04045));\r
}\r
\r
@vertex fn vs(in: VIn, @builtin(instance_index) ii: u32) -> VOut {\r
  let inst = instances[ii];\r
  let b = inst.base.x;\r
  let skin = palette[b + in.joints.x] * in.weights.x\r
    + palette[b + in.joints.y] * in.weights.y\r
    + palette[b + in.joints.z] * in.weights.z\r
    + palette[b + in.joints.w] * in.weights.w;\r
  let m = inst.model * skin;\r
  let p = m * vec4f(in.pos, 1.0);\r
  var o: VOut;\r
  o.clip = view.view_proj * (view.set_to_world * p);\r
  o.p = p.xyz;\r
  o.n = (m * vec4f(in.nrm, 0.0)).xyz;\r
  o.albedo = decode(in.color.rgb) * inst.tint.rgb;\r
  o.glow = in.color.a;\r
  o.rim = inst.tint.w;\r
  return o;\r
}\r
\r
fn aces(color_in: vec3f) -> vec3f {\r
  let input_mat = mat3x3f(\r
    vec3f(0.59719, 0.07600, 0.02840),\r
    vec3f(0.35458, 0.90834, 0.13383),\r
    vec3f(0.04823, 0.01566, 0.83777),\r
  );\r
  let output_mat = mat3x3f(\r
    vec3f(1.60475, -0.10208, -0.00327),\r
    vec3f(-0.53108, 1.10813, -0.07276),\r
    vec3f(-0.07367, -0.00605, 1.07602),\r
  );\r
  var c = input_mat * (color_in * view.output.w / 0.6);\r
  let a = c * (c + 0.0245786) - 0.000090537;\r
  let b = c * (0.983729 * c + 0.4329510) + 0.238081;\r
  c = output_mat * (a / b);\r
  return clamp(c, vec3f(0.0), vec3f(1.0));\r
}\r
\r
fn encode(c: vec3f) -> vec3f {\r
  if (view.output.y < 0.5) { return c; }\r
  let lo = c * 12.92;\r
  let hi = 1.055 * pow(max(c, vec3f(0.0)), vec3f(1.0 / 2.4)) - 0.055;\r
  return select(hi, lo, c <= vec3f(0.0031308));\r
}\r
\r
@fragment fn fs(in: VOut) -> @location(0) vec4f {\r
  var n = normalize(in.n);\r
  let v = normalize(view.cam.xyz - in.p);\r
  if (dot(n, v) < 0.0) { n = -n; }\r
  var light = mix(view.ground.rgb, view.sky.rgb, n.y * 0.5 + 0.5);\r
  light += view.sun_color.rgb * saturate(dot(n, view.sun_dir.xyz));\r
  for (var i = 0u; i < LIGHTS; i++) {\r
    let lp = view.light_pos[i];\r
    if (lp.w <= 0.0) { continue; }\r
    let d = lp.xyz - in.p;\r
    let dist2 = dot(d, d);\r
    let l = d * inverseSqrt(max(dist2, 1e-4));\r
    let window = saturate(1.0 - dist2 / (lp.w * lp.w));\r
    let wrap = saturate((dot(n, l) + 0.25) / 1.25);\r
    light += view.light_color[i].rgb * wrap * window * window / (1.0 + dist2);\r
  }\r
  let rim = pow(1.0 - saturate(dot(n, v)), 3.0) * in.rim;\r
  var c = in.albedo * light + vec3f(0.35, 0.75, 1.0) * rim;\r
  c += in.albedo * in.glow * 6.0;\r
  return vec4f(encode(aces(c)), 1.0);\r
}\r
\r
// Distance to the nearest edge of a pointy-top hex cell, in cell units (0 on the edge).\r
fn hex_edge(p: vec2f) -> vec2f {\r
  let r = vec2f(1.0, 1.7320508);\r
  let h = r * 0.5;\r
  let a = (p - r * floor(p / r)) - h;\r
  let b = (p - h - r * floor((p - h) / r)) - h;\r
  let g = select(b, a, dot(a, a) < dot(b, b));\r
  let q = abs(g);\r
  let d = 0.5 - max(dot(q, normalize(vec2f(1.0, 1.7320508))), q.x);\r
  return vec2f(d, dot(p - g, vec2f(0.37, 0.61)));\r
}\r
\r
// Force-field pane, additive. albedo is the field colour (tint × vertex colour).\r
@fragment fn fs_field(in: VOut) -> @location(0) vec4f {\r
  let n = normalize(in.n);\r
  let v = normalize(view.cam.xyz - in.p);\r
  let an = abs(n);\r
  var uv = in.p.xz;\r
  if (an.x > 0.5) { uv = in.p.zy; } else if (an.z > 0.5) { uv = in.p.xy; }\r
  let t = view.output.x;\r
  let hx = hex_edge(uv * 1.4);\r
  let edge = 1.0 - smoothstep(0.0, 0.04, hx.x);\r
  let cell = fract(sin(hx.y * 12.9898) * 43758.5453);\r
  let flicker = pow(0.5 + 0.5 * sin(t * (0.6 + cell * 1.4) + cell * 40.0), 12.0);\r
  let sweep = pow(0.5 + 0.5 * sin(in.p.y * 3.0 - t * 1.6 + uv.x * 0.4), 24.0);\r
  let graze = pow(1.0 - saturate(abs(dot(n, v))), 2.0);\r
  let near = saturate(1.0 - length(view.cam.xyz - in.p) / 2.5);\r
  let k = 0.008 + edge * (0.025 + 0.1 * graze + 0.25 * near) + flicker * 0.025 + sweep * 0.025;\r
  return vec4f(encode(aces(in.albedo * k * 3.0)), 0.0);\r
}\r
`,ii={SCALAR:1,VEC2:2,VEC3:3,VEC4:4,MAT4:16};async function ai(e){let t=await createImageBitmap(e,{colorSpaceConversion:`none`,premultiplyAlpha:`none`}),n=new OffscreenCanvas(t.width,t.height).getContext(`2d`,{willReadFrequently:!0});n.drawImage(t,0,0);let r=n.getImageData(0,0,t.width,t.height);return t.close(),{width:r.width,height:r.height,data:r.data}}var oi=e=>e<=.04045?e/12.92:((e+.055)/1.055)**2.4,si=e=>e<=.0031308?e*12.92:1.055*e**(1/2.4)-.055;function ci(e,t,n,r,i=Math.cos(65*Math.PI/180)){let a=t=>`${Math.round(e[t*3]*1e4)},${Math.round(e[t*3+1]*1e4)},${Math.round(e[t*3+2]*1e4)}`,o=e.length/3,s=new Map,c=new Int32Array(o);for(let e=0;e<o;e++){let t=a(e),n=s.get(t);n===void 0&&(n=s.size,s.set(t,n)),c[e]=n}let l=new Float32Array(s.size*3);for(let t=0;t+2<n.length;t+=3){let i=n[t]-r,a=n[t+1]-r,o=n[t+2]-r,s=e[a*3]-e[i*3],u=e[a*3+1]-e[i*3+1],d=e[a*3+2]-e[i*3+2],f=e[o*3]-e[i*3],p=e[o*3+1]-e[i*3+1],m=e[o*3+2]-e[i*3+2],h=u*m-d*p,g=d*f-s*m,_=s*p-u*f;for(let e of[i,a,o]){let t=c[e]*3;l[t]+=h,l[t+1]+=g,l[t+2]+=_}}let u=new Float32Array(t);for(let e=0;e<o;e++){let n=c[e]*3,r=Math.hypot(l[n],l[n+1],l[n+2]);if(r<1e-12)continue;let a=l[n]/r,o=l[n+1]/r,s=l[n+2]/r;a*t[e*3]+o*t[e*3+1]+s*t[e*3+2]<i||(u[e*3]=a,u[e*3+1]=o,u[e*3+2]=s)}return u}async function li(e,t=e,n,r=!1){let i=await fetch(e);if(!i.ok)throw Error(`${e}: ${i.status}`);let a=await i.arrayBuffer(),o=new DataView(a);if(o.getUint32(0,!0)!==1179937895)throw Error(`${e}: not a GLB`);let s=o.getUint32(12,!0),c=JSON.parse(new TextDecoder().decode(new Uint8Array(a,20,s))),l=20+s+8,u=e=>{let t=c.accessors[e],n=ii[t.type],r=new Float32Array(t.count*n);if(t.bufferView===void 0)return{data:r,comps:n};let i=c.bufferViews[t.bufferView],a=t.componentType===5126||t.componentType===5125?4:t.componentType===5122||t.componentType===5123?2:1,s=i.byteStride||a*n,u=l+(i.byteOffset??0)+(t.byteOffset??0);for(let e=0;e<t.count;e++)for(let i=0;i<n;i++){let c=u+e*s+i*a,l;switch(t.componentType){case 5126:l=o.getFloat32(c,!0);break;case 5125:l=o.getUint32(c,!0);break;case 5123:l=o.getUint16(c,!0),t.normalized&&(l/=65535);break;case 5122:l=o.getInt16(c,!0),t.normalized&&(l=Math.max(l/32767,-1));break;case 5121:l=o.getUint8(c),t.normalized&&(l/=255);break;default:l=o.getInt8(c),t.normalized&&(l=Math.max(l/127,-1));break}r[e*n+i]=l}return{data:r,comps:n}},d=new Map,f=t=>{let n=d.get(t);if(!n){let r=c.images?.[t];n=(async()=>{if(!r)return null;if(r.bufferView!==void 0){let e=c.bufferViews[r.bufferView],t=new Uint8Array(a,l+(e.byteOffset??0),e.byteLength);return ai(new Blob([t.slice()],{type:r.mimeType??`image/png`}))}if(r.uri){let t=await fetch(new URL(r.uri,new URL(e,location.href)));return t.ok?ai(await t.blob()):null}return null})().catch(n=>(console.warn(`[bar] ${e} image ${t}`,n),null)),d.set(t,n)}return n},p=c.nodes??[],m=new Int32Array(p.length).fill(-1);p.forEach((e,t)=>e.children?.forEach(e=>{m[e]=t}));let h=c.scenes?.[c.scene??0]?.nodes??p.map((e,t)=>t).filter(e=>m[e]<0);for(let e of h)m[e]=-1;let g=[],_=e=>{g.push(e),p[e].children?.forEach(_)};h.forEach(_);let v=new Float32Array(p.length*10);p.forEach((e,t)=>{let n=t*10;if(e.matrix){let t=e.matrix,r=Math.hypot(t[0],t[1],t[2]),i=Math.hypot(t[4],t[5],t[6]),a=Math.hypot(t[8],t[9],t[10]),o=di(t[0]/r,t[1]/r,t[2]/r,t[4]/i,t[5]/i,t[6]/i,t[8]/a,t[9]/a,t[10]/a);v.set([t[12],t[13],t[14],o[0],o[1],o[2],o[3],r,i,a],n)}else{let t=e.translation??[0,0,0],r=e.rotation??[0,0,0,1],i=e.scale??[1,1,1];v.set([t[0],t[1],t[2],r[0],r[1],r[2],r[3],i[0],i[1],i[2]],n)}});let y=[],b=[],x=new Map,S=e=>{let t=x.get(e);if(t)return t;let n=c.skins[e],r=n.inverseBindMatrices===void 0?null:u(n.inverseBindMatrices).data;return t=n.joints.map((e,t)=>{y.push(e);for(let e=0;e<16;e++)b.push(r?r[t*16+e]:+(e%5==0));return y.length-1}),x.set(e,t),t},C=e=>{y.push(e);for(let e=0;e<16;e++)b.push(+(e%5==0));return y.length-1},w=[],T=0;for(let e of g){let t=p[e];if(t.mesh===void 0)continue;let i=t.skin!==void 0,a=i?S(t.skin):null,o=i?-1:C(e);for(let e of c.meshes[t.mesh].primitives){if((e.mode??4)!==4||e.attributes.POSITION===void 0)continue;let t=u(e.attributes.POSITION).data,s=t.length/3,l=e.attributes.NORMAL===void 0?null:u(e.attributes.NORMAL).data,d=e.material===void 0?void 0:c.materials?.[e.material],p=d?.pbrMetallicRoughness?.baseColorFactor??[1,1,1,1],m=d?.pbrMetallicRoughness?.baseColorTexture,h=d?.emissiveFactor??[0,0,0],g=d?.extensions?.KHR_materials_emissive_strength?.emissiveStrength??1,_=Math.max(h[0],h[1],h[2])*g,v=e.attributes.COLOR_0===void 0?null:u(e.attributes.COLOR_0),y=null,b=null,x={ox:0,oy:0,sx:1,sy:1,r:0};if(m&&c.textures?.[m.index]?.source!==void 0){let t=m.extensions?.KHR_texture_transform,n=t?.texCoord??m.texCoord??0,r=e.attributes[`TEXCOORD_${n}`];r!==void 0&&(y=await f(c.textures[m.index].source),b=u(r).data,x={ox:t?.offset?.[0]??0,oy:t?.offset?.[1]??0,sx:t?.scale?.[0]??1,sy:t?.scale?.[1]??1,r:t?.rotation??0})}let S=new Uint8Array(s*4),C=Math.cos(x.r),E=Math.sin(x.r);for(let e=0;e<s;e++){let t=p[0],r=p[1],i=p[2];if(v){let n=v.comps;t*=v.data[e*n],r*=v.data[e*n+1],i*=v.data[e*n+2]}if(y&&b){let n=b[e*2]*x.sx,a=b[e*2+1]*x.sy,o=C*n+E*a+x.ox,s=-E*n+C*a+x.oy,c=(Math.floor(o*y.width)%y.width+y.width)%y.width,l=((Math.floor(s*y.height)%y.height+y.height)%y.height*y.width+c)*4;t*=oi(y.data[l]/255),r*=oi(y.data[l+1]/255),i*=oi(y.data[l+2]/255)}let a=0;_>.05&&(t=Math.max(t,h[0]),r=Math.max(r,h[1]),i=Math.max(i,h[2]),a=Math.min(1,_*.5)),n&&([t,r,i]=n([t,r,i])),S[e*4]=Math.round(si(Math.min(1,t))*255),S[e*4+1]=Math.round(si(Math.min(1,r))*255),S[e*4+2]=Math.round(si(Math.min(1,i))*255),S[e*4+3]=Math.round(a*255)}let D=new Uint8Array(s*4),O=new Uint8Array(s*4);if(a&&e.attributes.JOINTS_0!==void 0&&e.attributes.WEIGHTS_0!==void 0){let t=u(e.attributes.JOINTS_0).data,n=u(e.attributes.WEIGHTS_0).data;for(let e=0;e<s;e++){let r=n[e*4]+n[e*4+1]+n[e*4+2]+n[e*4+3]||1,i=0;for(let o=0;o<4;o++){D[e*4+o]=a[t[e*4+o]]??0;let s=o<3?Math.round(n[e*4+o]/r*255):255-i;O[e*4+o]=Math.max(0,s),i+=s}}}else{let e=i?a[0]:o;for(let t=0;t<s;t++)D[t*4]=e,O[t*4]=255}let k;if(e.indices!==void 0){let t=u(e.indices).data;k=new Uint32Array(t.length);for(let e=0;e<t.length;e++)k[e]=t[e]+T}else{k=new Uint32Array(s);for(let e=0;e<s;e++)k[e]=e+T}let ee=l??ui(t,k,T);w.push({pos:t,nrm:r?ci(t,ee,k,T):ee,col:S,jnt:D,wgt:O,idx:k}),T+=s}}if(y.length>255)throw Error(`${e}: ${y.length} palette slots`);let E=new Uint8Array(T*36),D=new Float32Array(E.buffer),O=0,k=0;for(let e of w){let t=e.pos.length/3;for(let n=0;n<t;n++){let t=(O+n)*36,r=t/4;D[r]=e.pos[n*3],D[r+1]=e.pos[n*3+1],D[r+2]=e.pos[n*3+2],D[r+3]=e.nrm[n*3],D[r+4]=e.nrm[n*3+1],D[r+5]=e.nrm[n*3+2],E.set(e.col.subarray(n*4,n*4+4),t+24),E.set(e.jnt.subarray(n*4,n*4+4),t+28),E.set(e.wgt.subarray(n*4,n*4+4),t+32)}O+=t,k+=e.idx.length}let ee=new Uint32Array(k),A=0;for(let e of w)ee.set(e.idx,A),A+=e.idx.length;let te=(c.animations??[]).map((e,t)=>{let n=0,r=[];for(let t of e.channels){let i=t.target.path===`translation`?0:t.target.path===`rotation`?1:t.target.path===`scale`?2:-1;if(i<0||t.target.node===void 0)continue;let a=e.samplers[t.sampler],o=u(a.input).data,s=u(a.output).data,c=i===1?4:3;if(a.interpolation===`CUBICSPLINE`){let e=new Float32Array(o.length*c);for(let t=0;t<o.length;t++)e.set(s.subarray((t*3+1)*c,(t*3+2)*c),t*c);s=e}n=Math.max(n,o[o.length-1]??0),r.push({node:t.target.node,path:i,times:o,values:s,step:a.interpolation===`STEP`})}return{name:e.name??`clip${t}`,duration:n,channels:r}});return{name:t,vertices:E,indices:ee,vertexCount:T,slotNode:new Int32Array(y),slotBind:new Float32Array(b),parent:m,nodeNames:p.map(e=>e.name??``),order:new Int32Array(g),rest:v,clips:te}}function ui(e,t,n){let r=new Float32Array(e.length);for(let i=0;i+2<t.length;i+=3){let a=(t[i]-n)*3,o=(t[i+1]-n)*3,s=(t[i+2]-n)*3,c=e[o]-e[a],l=e[o+1]-e[a+1],u=e[o+2]-e[a+2],d=e[s]-e[a],f=e[s+1]-e[a+1],p=e[s+2]-e[a+2],m=l*p-u*f,h=u*d-c*p,g=c*f-l*d;for(let e of[a,o,s])r[e]+=m,r[e+1]+=h,r[e+2]+=g}for(let e=0;e<r.length;e+=3){let t=Math.hypot(r[e],r[e+1],r[e+2])||1;r[e]/=t,r[e+1]/=t,r[e+2]/=t}return r}function di(e,t,n,r,i,a,o,s,c){let l=e+i+c;if(l>0){let e=Math.sqrt(l+1)*2;return[(a-s)/e,(o-n)/e,(t-r)/e,.25*e]}if(e>i&&e>c){let l=Math.sqrt(1+e-i-c)*2;return[.25*l,(r+t)/l,(o+n)/l,(a-s)/l]}if(i>c){let l=Math.sqrt(1+i-e-c)*2;return[(r+t)/l,.25*l,(s+a)/l,(o-n)/l]}let u=Math.sqrt(1+c-e-i)*2;return[(o+n)/u,(s+a)/u,.25*u,(t-r)/u]}function fi(e,...t){for(let n of t){let t=e.clips.find(e=>n.test(e.name));if(t)return t}return null}function pi(e,t,n,r){if(r.set(e.rest),!t)return;let i=t.duration>0?(n%t.duration+t.duration)%t.duration:0;for(let e of t.channels){let t=e.times,n=e.path===1?4:3,a=e.node*10+(e.path===0?0:e.path===1?3:7),o=t.length-1;if(o<0)continue;if(i<=t[0]||o===0){for(let t=0;t<n;t++)r[a+t]=e.values[t];continue}if(i>=t[o]){for(let t=0;t<n;t++)r[a+t]=e.values[o*n+t];continue}let s=0,c=o;for(;c-s>1;){let e=s+c>>1;t[e]<=i?s=e:c=e}let l=e.step?0:(i-t[s])/(t[c]-t[s]||1),u=s*n,d=c*n;if(n===4)mi(r,a,e.values,u,d,l);else for(let t=0;t<3;t++)r[a+t]=e.values[u+t]+(e.values[d+t]-e.values[u+t])*l}}function mi(e,t,n,r,i,a){let o=n[i],s=n[i+1],c=n[i+2],l=n[i+3],u=n[r],d=n[r+1],f=n[r+2],p=n[r+3],m=u*o+d*s+f*c+p*l;m<0&&(m=-m,o=-o,s=-s,c=-c,l=-l);let h=u+(o-u)*a,g=d+(s-d)*a,_=f+(c-f)*a,v=p+(l-p)*a,y=Math.hypot(h,g,_,v)||1;h/=y,g/=y,_/=y,v/=y,e[t]=h,e[t+1]=g,e[t+2]=_,e[t+3]=v}function hi(e,t,n,r){for(let i=0;i<e.length;i+=10)if(!(r&&!r[i/10])){for(let r=0;r<3;r++)e[i+r]+=(t[i+r]-e[i+r])*n;for(let r=7;r<10;r++)e[i+r]+=(t[i+r]-e[i+r])*n;gi(e,i+3,t,n)}}function gi(e,t,n,r){let i=n[t],a=n[t+1],o=n[t+2],s=n[t+3];e[t]*i+e[t+1]*a+e[t+2]*o+e[t+3]*s<0&&(i=-i,a=-a,o=-o,s=-s);let c=e[t]+(i-e[t])*r,l=e[t+1]+(a-e[t+1])*r,u=e[t+2]+(o-e[t+2])*r,d=e[t+3]+(s-e[t+3])*r,f=Math.hypot(c,l,u,d)||1;e[t]=c/f,e[t+1]=l/f,e[t+2]=u/f,e[t+3]=d/f}function _i(e,t,n,r,i){let a=vi;for(let r=0;r<e.order.length;r++){let i=e.order[r],o=i*10;yi(a,t[o],t[o+1],t[o+2],t[o+3],t[o+4],t[o+5],t[o+6],t[o+7],t[o+8],t[o+9]);let s=e.parent[i];s<0?n.set(a,i*16):g(n.subarray(i*16,i*16+16),n.subarray(s*16,s*16+16),a)}for(let t=0;t<e.slotNode.length;t++){let a=e.slotNode[t];g(r.subarray(i+t*16,i+t*16+16),n.subarray(a*16,a*16+16),e.slotBind.subarray(t*16,t*16+16))}}var vi=u();function yi(e,t,n,r,i,a,o,s,c,l,u){let d=i+i,f=a+a,p=o+o,m=i*d,h=i*f,g=i*p,_=a*f,v=a*p,y=o*p,b=s*d,x=s*f,S=s*p;e[0]=(1-(_+y))*c,e[1]=(h+S)*c,e[2]=(g-x)*c,e[3]=0,e[4]=(h-S)*l,e[5]=(1-(m+y))*l,e[6]=(v+b)*l,e[7]=0,e[8]=(g+x)*u,e[9]=(v-b)*u,e[10]=(1-(m+_))*u,e[11]=0,e[12]=t,e[13]=n,e[14]=r,e[15]=1}function bi(e,t,n=0){let r=[1/0,1/0,1/0],i=[-1/0,-1/0,-1/0],a=new Float32Array(e.vertices.buffer,e.vertices.byteOffset,e.vertices.byteLength/4),o=[0,0,0];for(let s=0;s<e.vertexCount;s++){let c=s*36,l=c/4,u=a[l],d=a[l+1],f=a[l+2];o[0]=o[1]=o[2]=0;for(let r=0;r<4;r++){let i=e.vertices[c+32+r]/255;if(!i)continue;let a=n+e.vertices[c+28+r]*16;o[0]+=i*(t[a]*u+t[a+4]*d+t[a+8]*f+t[a+12]),o[1]+=i*(t[a+1]*u+t[a+5]*d+t[a+9]*f+t[a+13]),o[2]+=i*(t[a+2]*u+t[a+6]*d+t[a+10]*f+t[a+14])}for(let e=0;e<3;e++)o[e]<r[e]&&(r[e]=o[e]),o[e]>i[e]&&(i[e]=o[e])}return{min:r,max:i}}function xi(e,t,n,r,i){let a=new Float32Array(e.vertices.buffer,e.vertices.byteOffset,e.vertices.byteLength/4),o=u(),s=r.pos.length/3,c=u();for(let s=0;s<e.vertexCount;s++){let l=s*36,u=l/4;o.fill(0);for(let n=0;n<4;n++){let r=e.vertices[l+32+n]/255;if(!r)continue;let i=e.vertices[l+28+n]*16;for(let e=0;e<16;e++)o[e]+=r*t[i+e]}g(c,n,o);let d=a[u],f=a[u+1],p=a[u+2];r.pos.push(c[0]*d+c[4]*f+c[8]*p+c[12],c[1]*d+c[5]*f+c[9]*p+c[13],c[2]*d+c[6]*f+c[10]*p+c[14]);let m=a[u+3],h=a[u+4],v=a[u+5];_(o,c);let y=o[0]*m+o[1]*h+o[2]*v,b=o[4]*m+o[5]*h+o[6]*v,x=o[8]*m+o[9]*h+o[10]*v,S=Math.hypot(y,b,x)||1;r.nrm.push(y/S,b/S,x/S);let C=e.vertices.subarray(l+24,l+28);i?r.col.push(Math.round(Math.min(255,C[0]*i[0])),Math.round(Math.min(255,C[1]*i[1])),Math.round(Math.min(255,C[2]*i[2])),Math.max(C[3],Math.round(i[3]*255))):r.col.push(C[0],C[1],C[2],C[3])}for(let t=0;t<e.indices.length;t++)r.idx.push(e.indices[t]+s)}var Si=u(),Ci=new Float32Array(4),wi=new Float32Array(4),Ti=new Float32Array(4),Ei=new Float32Array(4),Di=new Float32Array(4),Oi=new Float32Array(4),ki=new Float32Array(3),Ai=new Float32Array(3);function ji(e){let t=-1;for(let n=0;n<e.nodeNames.length;n++){if(!/^head$/i.test(e.nodeNames[n]))continue;let r=e.parent[n];if(r>=0&&/^neck$/i.test(e.nodeNames[r]))return n;t<0&&(t=n)}return t}function Mi(e,t,n){let r=e.parent[n>=0?n:t];for(;r>=0;){let t=e.nodeNames[r];if(/hip|pelvis|^body$|^root$|armature/i.test(t))break;if(/torso|abdomen|chest|spine/i.test(t))return r;r=e.parent[r]}return-1}function Ni(e,t,n,r){let i=n*10,a=e[i],o=e[i+1],s=e[i+2],c=e[i+3],l=e[i+4],u=e[i+5],d=e[i+6],f=e[i+7],p=e[i+8],m=e[i+9],h=c+c,_=l+l,v=u+u,y=c*h,b=c*_,x=c*v,S=l*_,C=l*v,w=u*v,T=d*h,E=d*_,D=d*v,O=Si;O[0]=(1-(S+w))*f,O[1]=(b+D)*f,O[2]=(x-E)*f,O[3]=0,O[4]=(b-D)*p,O[5]=(1-(y+w))*p,O[6]=(C+T)*p,O[7]=0,O[8]=(x+E)*m,O[9]=(C-T)*m,O[10]=(1-(y+S))*m,O[11]=0,O[12]=a,O[13]=o,O[14]=s,O[15]=1;let k=t.subarray(n*16,n*16+16);r<0?k.set(O):g(k,t.subarray(r*16,r*16+16),O)}function Pi(e,t){let n=t*4;return Math.hypot(e[n],e[n+1],e[n+2])||1}function Fi(e,t){let n=Pi(e,0),r=Pi(e,1),i=Pi(e,2);t[0]=e[2]/n,t[1]=e[6]/r,t[2]=e[10]/i}function Ii(e,t,n,r,i){let a=Pi(e,0),o=Pi(e,1),s=Pi(e,2);i[0]=e[0]*t/a+e[4]*n/o+e[8]*r/s,i[1]=e[1]*t/a+e[5]*n/o+e[9]*r/s,i[2]=e[2]*t/a+e[6]*n/o+e[10]*r/s}function Li(e,t){let n=Pi(e,0),r=Pi(e,1),i=Pi(e,2),a=e[0]/n,o=e[1]/n,s=e[2]/n,c=e[4]/r,l=e[5]/r,u=e[6]/r,d=e[8]/i,f=e[9]/i,p=e[10]/i,m=a+l+p;if(m>0){let e=Math.sqrt(m+1)*2;t[0]=(u-f)/e,t[1]=(d-s)/e,t[2]=(o-c)/e,t[3]=.25*e}else if(a>l&&a>p){let e=Math.sqrt(1+a-l-p)*2;t[0]=.25*e,t[1]=(c+o)/e,t[2]=(d+s)/e,t[3]=(u-f)/e}else if(l>p){let e=Math.sqrt(1+l-a-p)*2;t[0]=(c+o)/e,t[1]=.25*e,t[2]=(f+u)/e,t[3]=(d-s)/e}else{let e=Math.sqrt(1+p-a-l)*2;t[0]=(d+s)/e,t[1]=(f+u)/e,t[2]=.25*e,t[3]=(o-c)/e}}function Ri(e,t,n){let r=e[0],i=e[1],a=e[2],o=e[3],s=t[0],c=t[1],l=t[2],u=t[3];n[0]=r*u+o*s+i*l-a*c,n[1]=i*u+o*c+a*s-r*l,n[2]=a*u+o*l+r*c-i*s,n[3]=o*u-r*s-i*c-a*l}function zi(e,t,n,r,i,a,o){let s=t*a-n*i,c=n*r-e*a,l=e*i-t*r,u=e*r+t*i+n*a;if(u>.9999){o[0]=o[1]=o[2]=0,o[3]=1;return}if(u<-.9999){let r=+(Math.abs(e)<.9),i=+(r===0),a=t*0-n*i,s=n*r-e*0,c=e*i-t*r,l=Math.hypot(a,s,c)||1;o[0]=a/l,o[1]=s/l,o[2]=c/l,o[3]=0;return}o[0]=s,o[1]=c,o[2]=l,o[3]=1+u;let d=Math.hypot(o[0],o[1],o[2],o[3]);o[0]/=d,o[1]/=d,o[2]/=d,o[3]/=d}function Bi(e,t,n){let r=e[0],i=e[1],a=e[2],o=e[3];o<0&&(r=-r,i=-i,a=-a,o=-o);let s=Math.hypot(r,i,a);if(s<1e-8||t<=0){n[0]=n[1]=n[2]=0,n[3]=1;return}if(t>=.999){n[0]=r,n[1]=i,n[2]=a,n[3]=o;return}let c=Math.atan2(s,Math.min(1,o))*t,l=Math.sin(c)/s;n[0]=r*l,n[1]=i*l,n[2]=a*l,n[3]=Math.cos(c)}function Vi(e,t,n,r){let i=e*.5,a=t*-.5,o=n*.5,s=Math.sin(i),c=Math.cos(i),l=Math.sin(a),u=Math.cos(a),d=Math.sin(o),f=Math.cos(o),p=c*l,m=s*u,h=-s*l,g=c*u;r[0]=p*f+m*d,r[1]=m*f-p*d,r[2]=h*f+g*d,r[3]=g*f-h*d}function Hi(e,t,n,r){let i=t*10+3;Ti[0]=e[i],Ti[1]=e[i+1],Ti[2]=e[i+2],Ti[3]=e[i+3],n?(Li(n,Ei),Di[0]=-Ei[0],Di[1]=-Ei[1],Di[2]=-Ei[2],Di[3]=Ei[3],Ri(Ei,Ti,Oi),Ri(r,Oi,Ti),Ri(Di,Ti,Oi)):Ri(r,Ti,Oi);let a=Math.hypot(Oi[0],Oi[1],Oi[2],Oi[3])||1;e[i]=Oi[0]/a,e[i+1]=Oi[1]/a,e[i+2]=Oi[2]/a,e[i+3]=Oi[3]/a}function Ui(e,t,n,r,i){i[0]=e[0]*t+e[4]*n+e[8]*r+e[12],i[1]=e[1]*t+e[5]*n+e[9]*r+e[13],i[2]=e[2]*t+e[6]*n+e[10]*r+e[14]}function Wi(e,t){let n=ji(e);if(n<0)return null;let r=e.parent[n],i=r>=0&&/^neck$/i.test(e.nodeNames[r])?r:-1,a=Mi(e,n,i),o=[];for(let t=n;t>=0;t=e.parent[t])o.push(t);let s=new Int16Array(o.length);for(let e=0;e<o.length;e++)s[e]=o[o.length-1-e];let c=[],l=[];a>=0&&(c.push(a),l.push(.18)),i>=0&&(c.push(i),l.push(.34)),c.push(n),l.push(a<0&&i<0?1:.48);let d=0;for(let e of l)d+=e;let f=new Int16Array(c.length),p=new Float32Array(c.length);for(let e=0;e<c.length;e++)f[e]=c[e],p[e]=l[e]/d;let m=new Float32Array(e.parent.length*16);for(let t=0;t<s.length;t++){let n=s[t];Ni(e.rest,m,n,e.parent[n])}let h=new Float32Array(3);Fi(m.subarray(n*16,n*16+16),h);let g=u();_(g,t);let v=new Float32Array(3),y=new Float32Array(3),b=new Float32Array(3),x=n*16;Ui(t,m[x+12],m[x+13],m[x+14],v),v[0]+=t[4]*.12,v[1]+=t[5]*.12,v[2]+=t[6]*.12;let S=Math.hypot(t[8],t[10])||1;return b[0]=v[0]+t[8]/S*2.4,b[1]=v[1]+.05,b[2]=v[2]+t[10]/S*2.4,y.set(b),{chain:s,aim:f,weight:p,life:a>=0?a:n,head:n,forward:h,placeInv:g,at:v,gaze:y,goal:b,until:0,rate:2.4,kind:2,peer:-1,seed:Math.random()*10,live:!1}}function Gi(e,t,n){let r=n[0]-t[0],i=n[1]-t[1],a=n[2]-t[2],o=Math.hypot(r,i,a);if(o>6.5||o<.15)return-1;let s=Math.hypot(e[8],e[10])||1,c=Math.hypot(r,a)||1;return e[8]/s*(r/c)+e[10]/s*(a/c)<(o<1.6?-.15:.12)||i>2.4?-1:o}function Ki(e,t){let n=t[e],r=n.gaze;if(!r)return-1;let i=-1,a=0;for(let o=0;o<t.length;o++){if(o===e)continue;let s=t[o].gaze;if(!s)continue;let c=s.at[0]-r.at[0],l=s.at[1]-r.at[1],u=s.at[2]-r.at[2],d=Math.hypot(c,l,u);if(d>4.2||d<.08)continue;let f=Math.hypot(n.place[8],n.place[10])||1,p=Math.hypot(c,u)||1,m=n.place[8]/f*(c/p)+n.place[10]/f*(u/p),h=(Math.random()+.3)/(d+.35);m>.25?h*=1.45:m<-.15&&(h*=.3),Math.abs(l)>1.5&&(h*=.45),h>a&&(a=h,i=o)}return i}function qi(e,t,n,r,i,a,o,s){e.goal[0]=t,e.goal[1]=n,e.goal[2]=r,e.kind=i,e.peer=a,e.until=o,e.rate=s}function Ji(e,t,n,r,i){let a=i?Gi(n[t].place,e.at,i):-1,o=Math.random();if(a>=0&&o<(a<3.2?.36:.22)&&i){let t=Math.random()<.28;qi(e,i[0],i[1],i[2],0,-1,r+(t?.35+Math.random()*.4:1.2+Math.random()*2.1),t?7.5:4.4);return}if(o<.58){let i=Ki(t,n);if(i>=0){let a=n[i].gaze;qi(e,a.at[0],a.at[1],a.at[2],1,i,r+1.8+Math.random()*3.2,3.3),Math.random()<.45&&!(a.kind===0&&r<a.until-.6)&&qi(a,e.at[0],e.at[1],e.at[2],1,t,r+1.8+Math.random()*2.6,3.3);return}}let s=n[t].place,c=(Math.random()-.5)*2.1,l=3.5+Math.random()*5.5,u=Math.cos(c),d=Math.sin(c),f=Math.hypot(s[8],s[10])||1,p=Math.hypot(s[0],s[2])||1,m=s[8]/f*u+s[0]/p*d,h=s[10]/f*u+s[2]/p*d;qi(e,e.at[0]+m*l,e.at[1]+.1+Math.random()*1.15,e.at[2]+h*l,2,-1,r+2.4+Math.random()*4,1.7)}function Yi(e,t,n,r){for(let i=0;i<e.length;i++){let a=e[i].gaze;if(!a)continue;if(!a.live)a.live=!0,a.until=t+.25+Math.random()*1.7;else if(a.kind===0&&r)a.goal[0]=r[0],a.goal[1]=r[1],a.goal[2]=r[2];else if(a.kind===1&&a.peer>=0){let t=e[a.peer]?.gaze;t&&(a.goal[0]=t.at[0],a.goal[1]=t.at[1],a.goal[2]=t.at[2])}t>=a.until&&Ji(a,i,e,t,r);let o=a.kind===2?.34:a.kind===1?.09:.045,s=Math.sin(t*.67+a.seed)*o,c=(Math.sin(t*.41+a.seed*1.3)*.7+Math.sin(t*.19+a.seed)*.3)*o,l=Math.cos(t*.53+a.seed*.8)*o,u=n>0?1-Math.exp(-n*a.rate):0;a.gaze[0]+=(a.goal[0]+s-a.gaze[0])*u,a.gaze[1]+=(a.goal[1]+c-a.gaze[1])*u,a.gaze[2]+=(a.goal[2]+l-a.gaze[2])*u}}function Xi(e,t,n,r,i,a,o,s,c,l){let u=i.chain;for(let r=0;r<u.length;r++){let i=u[r];Ni(t,n,i,e.parent[i])}let d=i.head*16,f=n[d+12],p=n[d+13],m=n[d+14];Ui(i.placeInv,i.gaze[0],i.gaze[1],i.gaze[2],Ai);let h=Ai[0]-f,g=Ai[1]-p,_=Ai[2]-m,v=Math.hypot(h,g,_),y=i.aim.length>1?1.28:1.15;if(v>.001&&s>.001){Ii(n.subarray(d,d+16),i.forward[0],i.forward[1],i.forward[2],ki);let e=Math.hypot(ki[0],ki[1],ki[2])||1;h/=v,g/=v,_/=v;let t=Math.atan2(h,_),r=Math.max(-.42,Math.min(.55,Math.atan2(g,Math.hypot(h,_)))),a=Math.cos(r);zi(ki[0]/e,ki[1]/e,ki[2]/e,Math.sin(t)*a,Math.sin(r),Math.cos(t)*a,Ci);let o=Ci[0],c=Ci[1],l=Ci[2],u=Ci[3];u<0&&(o=-o,c=-c,l=-l,u=-u);let f=2*Math.atan2(Math.hypot(o,c,l),Math.min(1,u)),p=Math.min(y,f*s);Bi(Ci,f>1e-4?p/f:0,Ci)}else Ci[0]=Ci[1]=Ci[2]=0,Ci[3]=1;let b=l*(.4+.6*s),x=Math.sin(o*(1.15+a%1*.5)+a)*.042*b,S=Math.sin(o*.28+a*1.4)*.02*b,C=Math.sin(o*.21+a*.8)*.016*b,w=!1;for(let r=0;r<u.length;r++){let a=u[r],o=e.parent[a],c=o>=0?n.subarray(o*16,o*16+16):null,l=!1;if(s>.001)for(let e=0;e<i.aim.length;e++)i.aim[e]!==a||i.weight[e]<1e-4||(Bi(Ci,i.weight[e],wi),wi[0]*wi[0]+wi[1]*wi[1]+wi[2]*wi[2]>1e-8&&(Hi(t,a,c,wi),l=!0));a===i.life&&b>.02&&(Vi(S,x,C,wi),Hi(t,a,c,wi),l=!0),(l||w)&&(Ni(t,n,a,o),w=!0)}f=n[d+12],p=n[d+13],m=n[d+14],Ui(r,f,p,m,i.at),i.at[0]+=r[4]*.12,i.at[1]+=r[5]*.12+c,i.at[2]+=r[6]*.12}var Zi=10,Qi=136,$i={color:{srcFactor:`one`,dstFactor:`one`},alpha:{srcFactor:`zero`,dstFactor:`one`}},ea=96,ta=96,na=4096,ra=class{device;module;viewLayout;dataLayout;layout;pipelines=new Map;fieldPipelines=new Map;building=new Map;fields=[];time=0;sun={dir:[0,1,0],color:[0,0,0]};views=[];viewData=new Float32Array(Qi);paletteBuffer;instanceBuffer;dataGroup;palette=new Float32Array(na*16);instanceData=new ArrayBuffer(ta*ea);slotsUsed=0;statics=[];actors=[];lights=[];sky=[.05,.06,.1];ground=[.02,.015,.03];setInv=u();viewer=new Float32Array(3);timed=!1;async init(e){this.device=e,this.module=e.createShaderModule({code:ri,label:`bar`});let t=(await this.module.getCompilationInfo()).messages.filter(e=>e.type===`error`);if(t.length)throw Error(`bar WGSL:\n${t.map(e=>`${e.lineNum}:${e.linePos} ${e.message}`).join(`
`)}`);this.viewLayout=e.createBindGroupLayout({label:`bar-view`,entries:[{binding:0,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,buffer:{type:`uniform`}}]}),this.dataLayout=e.createBindGroupLayout({label:`bar-data`,entries:[{binding:0,visibility:GPUShaderStage.VERTEX,buffer:{type:`read-only-storage`}},{binding:1,visibility:GPUShaderStage.VERTEX,buffer:{type:`read-only-storage`}}]}),this.layout=e.createPipelineLayout({bindGroupLayouts:[this.viewLayout,this.dataLayout]}),this.paletteBuffer=e.createBuffer({label:`bar-palette`,size:this.palette.byteLength,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST}),this.instanceBuffer=e.createBuffer({label:`bar-instances`,size:this.instanceData.byteLength,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST}),this.dataGroup=e.createBindGroup({layout:this.dataLayout,entries:[{binding:0,resource:{buffer:this.paletteBuffer}},{binding:1,resource:{buffer:this.instanceBuffer}}]}),this.palette.set(u(),0),this.slotsUsed=1}prepare(e,t,n=!0){let r=`${e}|${t}|${n?`c`:`z`}`,i=this.building.get(r);if(!i){let a=i=>this.device.createRenderPipelineAsync({label:`bar-${i?`field-`:``}${r}`,layout:this.layout,vertex:{module:this.module,entryPoint:`vs`,buffers:[{arrayStride:36,attributes:[{shaderLocation:0,offset:0,format:`float32x3`},{shaderLocation:1,offset:12,format:`float32x3`},{shaderLocation:2,offset:24,format:`unorm8x4`},{shaderLocation:3,offset:28,format:`uint8x4`},{shaderLocation:4,offset:32,format:`unorm8x4`}]}]},fragment:{module:this.module,entryPoint:i?`fs_field`:`fs`,targets:[{format:e,writeMask:n?GPUColorWrite.ALL:0,blend:i?$i:void 0}]},primitive:{topology:`triangle-list`,cullMode:`none`},depthStencil:{format:rt,depthWriteEnabled:!i,depthCompare:`less-equal`},multisample:{count:t}});i=Promise.all([a(!1),a(!0)]).then(([e,t])=>{this.pipelines.set(r,e),this.fieldPipelines.set(r,t)}),this.building.set(r,i)}return i}upload(e,t){let n=this.device,r=n.createBuffer({size:Math.max(4,e.byteLength),usage:GPUBufferUsage.VERTEX,mappedAtCreation:!0});new Uint8Array(r.getMappedRange()).set(e),r.unmap();let i=n.createBuffer({size:Math.max(4,t.byteLength),usage:GPUBufferUsage.INDEX,mappedAtCreation:!0});return new Uint32Array(i.getMappedRange()).set(t),i.unmap(),{vb:r,ib:i,count:t.length}}addStatic(e,t=u(),n=[1,1,1,0],r){let i={gpu:e,place:t,tint:n,animate:r};return this.statics.push(i),i}addField(e,t){this.fields.push({gpu:e,place:u(),tint:t})}addActor(e,t,n,r,i={}){if(this.slotsUsed+e.slotNode.length>na||this.statics.length+this.actors.length>=ta)return null;let a={model:e,gpu:t,place:n,tint:i.tint??[1,1,1,.35],clips:r,phase:i.phase??Math.random()*10,speed:i.speed??1,every:i.every??0,bob:i.bob,gesture:null,gestureStart:0,nextGesture:(i.every??0)*(.3+Math.random()),paletteBase:this.slotsUsed,local:new Float32Array(e.rest.length),other:new Float32Array(e.rest.length),world:new Float32Array(e.parent.length*16),gaze:Wi(e,n)};return this.slotsUsed+=e.slotNode.length,this.actors.push(a),a}update(e,t=null,n=null){let r=this.timed?Math.min(.05,Math.max(0,e-this.time)):0;this.timed=!0,this.time=e;let i=null;if(t&&n){_(this.setInv,t);let e=this.setInv;this.viewer[0]=e[0]*n[0]+e[4]*n[1]+e[8]*n[2]+e[12],this.viewer[1]=e[1]*n[0]+e[5]*n[1]+e[9]*n[2]+e[13],this.viewer[2]=e[2]*n[0]+e[6]*n[1]+e[10]*n[2]+e[14],i=this.viewer}Yi(this.actors,e,r,i);let a=.3;for(let t of this.actors){let n=t.clips.holdAt??e*t.speed+t.phase;pi(t.model,t.clips.base,n,t.local);let r=1;if(t.every>0&&t.clips.gestures.length&&(!t.gesture&&e>=t.nextGesture&&(t.gesture=t.clips.gestures[Math.floor(Math.random()*t.clips.gestures.length)],t.gestureStart=e),t.gesture)){let n=(e-t.gestureStart)*t.speed,i=t.gesture.duration;if(n>=i)t.gesture=null,t.nextGesture=e+t.every*(.6+Math.random()*.8);else{pi(t.model,t.gesture,n,t.other);let e=Math.min(1,n/a,(i-n)/a);r=1-Math.max(0,e)*.82,hi(t.local,t.other,Math.max(0,e),t.clips.gestureMask)}}if(t.gaze){let n=t.bob?Math.sin(e*t.bob.rate+t.phase)*t.bob.amp:0;Xi(t.model,t.local,t.world,t.place,t.gaze,t.phase,e,r,n,t.clips.holdAt===void 0?.4:1)}_i(t.model,t.local,t.world,this.palette,t.paletteBase*16)}this.device.queue.writeBuffer(this.paletteBuffer,0,this.palette.buffer,0,this.slotsUsed*64);let o=new Float32Array(this.instanceData),s=new Uint32Array(this.instanceData),c=0,l=(e,t,n,r=0)=>{let i=ea/4*c;o.set(e,i),r&&(o[i+13]+=r),o[i+16]=t[0],o[i+17]=t[1],o[i+18]=t[2],o[i+19]=t[3],s[i+20]=n,c++};for(let t of this.statics)t.animate?.(e,t.place),l(t.place,t.tint,0);for(let t of this.actors)l(t.place,t.tint,t.paletteBase,t.bob?Math.sin(e*t.bob.rate+t.phase)*t.bob.amp:0);for(let e of this.fields)l(e.place,e.tint,0);this.device.queue.writeBuffer(this.instanceBuffer,0,this.instanceData,0,c*ea)}writeView(e,t,n,r,i,a){for(;this.views.length<=e;){let e=this.device.createBuffer({size:Qi*4,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST,label:`bar-view-${this.views.length}`});this.views.push({buffer:e,group:this.device.createBindGroup({layout:this.viewLayout,entries:[{binding:0,resource:{buffer:e}}]})})}let o=this.viewData;o.fill(0),o.set(t,0),o.set(n,16),_(this.setInv,n);let s=this.setInv;o[32]=s[0]*r[0]+s[4]*r[1]+s[8]*r[2]+s[12],o[33]=s[1]*r[0]+s[5]*r[1]+s[9]*r[2]+s[13],o[34]=s[2]*r[0]+s[6]*r[1]+s[10]*r[2]+s[14],o[36]=this.time,o[37]=+!!i,o.set(this.sun.dir,128),o.set(this.sun.color,132),o[39]=a,o.set(this.sky,40),o.set(this.ground,44);for(let e=0;e<Math.min(Zi,this.lights.length);e++){let t=this.lights[e];o.set([t.pos[0],t.pos[1],t.pos[2],t.radius],48+e*4),o.set([t.color[0]*t.intensity,t.color[1]*t.intensity,t.color[2]*t.intensity,0],88+e*4)}this.device.queue.writeBuffer(this.views[e].buffer,0,o)}draw(e,t,n,r,i=!0){let a=this.pipelines.get(`${n}|${r}|${i?`c`:`z`}`),o=this.views[t];if(!a||!o)return;e.setPipeline(a),e.setBindGroup(0,o.group),e.setBindGroup(1,this.dataGroup);let s=0,c=t=>{e.setVertexBuffer(0,t.vb),e.setIndexBuffer(t.ib,`uint32`),e.drawIndexed(t.count,1,0,0,s++)};for(let e of this.statics)c(e.gpu);for(let e of this.actors)c(e.gpu);let l=this.fieldPipelines.get(`${n}|${r}|${i?`c`:`z`}`);if(!(!l||!this.fields.length)){e.setPipeline(l);for(let e of this.fields)c(e.gpu)}}},ia=-9,aa=-84,X=10;function oa(e,t,n,r,i,a,o=0){let s=Math.cos(i),c=Math.sin(i),l=Math.cos(o),u=Math.sin(o);e[0]=s*l*a,e[1]=u*a,e[2]=-c*l*a,e[3]=0,e[4]=-s*u*a,e[5]=l*a,e[6]=c*u*a,e[7]=0,e[8]=c*a,e[9]=0,e[10]=s*a,e[11]=0,e[12]=t,e[13]=n,e[14]=r,e[15]=1}function sa(e){for(let t=-2;t<=2;t++)for(let n=-2;n<=1;n++)e.add(`port/platform_large`,t*2*X,ia,aa+n*2*X,0,{s:X});let t=(t,n,r,i)=>e.box(t,ia-1.4,n,r,-8.6,i,2764346);t(-5*X,aa-5*X,5*X,-133.4),t(-5*X,-54.6,5*X,-54),t(-5*X,aa-5*X,-49.4,-54),t(5*X-.6,aa-5*X,5*X,-54);for(let t of[-4.5*X,4.5*X])for(let n=aa-4.5*X;n<=-59;n+=8)e.box(t-.4,-8.6,n-.4,t+.4,-8.3,n+.4,16757575,1);for(let t=-54;t>=aa-5*X;t-=6)e.box(-5*X,-8.6,t-.2,5*X,-8.55,t+.2,3991295,.5);let n=(t,n,r,i)=>{e.box(t-r,-8.58,n-.25,t+r,-8.5,n+.25,i,1),e.box(t-.25,-8.58,n-r,t+.25,-8.5,n+r,i,1);for(let[a,o]of[[-r,-r],[r,-r],[-r,r],[r,r]])e.box(t+a-.5,-8.58,n+o-.5,t+a+.5,-8.1,n+o+.5,i,1)};n(-16,-72,9,16732120),n(14,-78,9,3991295),e.add(`port/hangar_largeA`,-30,ia,aa-24,0,{s:X}),e.add(`port/hangar_largeB`,-4,ia,aa-36,0,{s:X}),e.add(`port/hangar_roundGlass`,28,ia,aa-28,0,{s:X}),e.add(`port/craft_cargoA`,-16,-8.5,-72,.6,{s:8}),e.add(`port/craft_miner`,14,-8.5,-78,-.4,{s:7}),e.add(`port/satelliteDish_large`,-42,ia,-66,.5,{s:14}),e.add(`port/structure_detailed`,42,ia,-62,0,{s:6}),e.add(`port/structure_detailed`,42,-3,-62,0,{s:6}),e.add(`port/machine_wireless`,42,3,-62,.3,{s:6},[1,1,1,.1]),e.add(`port/turret_double`,-46,ia,aa-44,.8,{s:6}),e.add(`port/turret_double`,46,ia,aa-44,-.8,{s:6});let r=aa-2,i=[[`rocket_baseA`,1.6],[`rocket_fuelA`,.5],[`rocket_fuelA`,.5],[`rocket_sidesA`,1],[`rocket_topA`,.8]],a=ia;for(let[t,n]of i)e.add(`port/${t}`,34,a,r,0,{s:6}),a+=n*6;e.add(`port/rocket_finsA`,34,-8.8,r,.4,{s:6}),e.add(`port/supports_high`,27,ia,r,0,{s:12});for(let t=-120;t<=120;t+=4)e.add(`port/monorail_trackStraight`,t,8,-32,Math.PI/2,{s:4}),t%40==20&&(e.box(t-.25,ia-20,-32.25,t+.25,8,-31.75,2764346),e.box(t-.3,7.4,-32.3,t+.3,7.55,-31.7,16732120,1));[`port/monorail_trainFront`,`port/monorail_trainPassenger`,`port/monorail_trainPassenger`,`port/monorail_trainPassenger`].forEach((t,n)=>{e.mover(t,(e,t)=>{oa(t,((e*9+60-n*4.2)%240+240)%240-240/2,8.5,-32,Math.PI/2,4)})});let o=(t,n,r,i,a,o,s,c,l=0)=>e.mover(t,(e,t)=>{let u=e*s+c,d=r+Math.sin(u)*o,f=a+Math.cos(u)*o,p=u+(s>0?Math.PI/2:-Math.PI/2);oa(t,d,i+Math.sin(e*.4+c)*l,f,p,n,s>0?-.35:.35)});o(`port/craft_speederB`,3,0,4,aa,50,.12,0,3),o(`port/craft_speederC`,3,0,9,aa-10,70,-.08,2,4),o(`port/craft_racer`,3,10,2,-80,34,.2,4,2),o(`port/craft_speederD`,4,-20,10,aa-40,110,.05,1,6),e.mover(`port/craft_cargoB`,(e,t)=>{oa(t,e*6%600-600/2,22,-230,Math.PI/2,14)}),e.mover(`port/craft_cargoA`,(e,t)=>{let n=e*.03%1;oa(t,160-n*60,-30+n*90,-180+n*40,-2.2,10,.1)}),e.add(`port/gate_complex`,-60,-40,-290,.25,{s:70},[.9,1,1.2,.08]);let s=11,c=()=>(s=s*16807%2147483647,s/2147483647);for(let t=0;t<18;t++){let t=c()*Math.PI*2,n=70+c()*220,r=Math.sin(t)*n,i=Math.cos(t)*n-60;if(i>-20&&Math.abs(r)<40)continue;let a=3+c()*14,o=-50+c()*90,s=(c()-.5)*.2,l=c()*6;e.mover(c()>.5?`port/meteor_detailed`:`port/rock_largeA`,(e,t)=>oa(t,r,o+Math.sin(e*.1+l)*1.5,i,e*s+l,a,.4))}}var ca={width:1.6,depth:.62},la=.95;function ua(e){let t=new Uint8Array(e.nodeNames.length);e.nodeNames.forEach((e,n)=>{/(^|[._:|-])(neck|shoulder|clavicle|arm|head)/i.test(e)&&(t[n]=1)});for(let n=0;n<32;n++)for(let n=0;n<t.length;n++)!t[n]&&e.parent[n]>=0&&t[e.parent[n]]&&(t[n]=1);return t}function da(e,t,n=0){let r=new Float32Array(e.rest.length),i=new Float32Array(e.parent.length*16),a=new Float32Array(e.slotNode.length*16);pi(e,t,n,r),_i(e,r,i,a,0);let{min:o,max:s}=bi(e,a);return{palette:a,world:i,min:o,max:s}}function fa(e,t,n,r,i,a,o=e.min[1]){let s=(e.min[0]+e.max[0])/2,c=(e.min[2]+e.max[2])/2,l=u();d(l,n,r,i,a,t);let f=y(u(),-s,-o,-c,1);return g(u(),l,f)}function Z(e,t,n,r,i,a,o,s,c=0){let l=[[[1,0,0],[[i,n,r],[i,a,r],[i,a,o],[i,n,o]]],[[-1,0,0],[[t,n,o],[t,a,o],[t,a,r],[t,n,r]]],[[0,1,0],[[t,a,r],[t,a,o],[i,a,o],[i,a,r]]],[[0,-1,0],[[t,n,o],[t,n,r],[i,n,r],[i,n,o]]],[[0,0,1],[[i,n,o],[i,a,o],[t,a,o],[t,n,o]]],[[0,0,-1],[[t,n,r],[t,a,r],[i,a,r],[i,n,r]]]];for(let[t,n]of l){let r=e.pos.length/3;for(let r of n)e.pos.push(r[0],r[1],r[2]),e.nrm.push(t[0],t[1],t[2]),e.col.push(s[0],s[1],s[2],Math.round(c*255));e.idx.push(r,r+1,r+2,r,r+2,r+3)}}function pa(e,t,n,r=48){let i=(t,r)=>(e.pos.push(t[0],t[1],t[2]),e.nrm.push(r[0],r[1],r[2]),e.col.push(n[0],n[1],n[2],0),e.pos.length/3-1),a=(t,n,r,a,o)=>{let s=[n[0]-t[0],n[1]-t[1],n[2]-t[2]],c=[r[0]-t[0],r[1]-t[1],r[2]-t[2]],l=[s[1]*c[2]-s[2]*c[1],s[2]*c[0]-s[0]*c[2],s[0]*c[1]-s[1]*c[0]],u=[t,n,r,a].map(e=>i(e,o));l[0]*o[0]+l[1]*o[1]+l[2]*o[2]>=0?e.idx.push(u[0],u[1],u[2],u[0],u[2],u[3]):e.idx.push(u[0],u[2],u[1],u[0],u[3],u[2])},o=e=>{let n=e/r*Math.PI*2,i=Math.cos(n),a=Math.sin(n),o=.5/Math.max(Math.abs(i),Math.abs(a));return{c:i,s:a,hole:[.5+t*i,.5+t*a],edge:[.5+o*i,.5+o*a]}};for(let e=0;e<r;e++){let t=o(e),n=o(e+1);a([t.hole[0],1,t.hole[1]],[t.edge[0],1,t.edge[1]],[n.edge[0],1,n.edge[1]],[n.hole[0],1,n.hole[1]],[0,1,0]);let r=-(t.c+n.c)/2,i=-(t.s+n.s)/2,s=Math.hypot(r,i);a([t.hole[0],0,t.hole[1]],[n.hole[0],0,n.hole[1]],[n.hole[0],1,n.hole[1]],[t.hole[0],1,t.hole[1]],[r/s,0,i/s])}}function ma(e){let t=e.pos.length/3,n=new Uint8Array(t*36),r=new Float32Array(n.buffer);for(let i=0;i<t;i++){let t=i*36,a=t/4;r[a]=e.pos[i*3],r[a+1]=e.pos[i*3+1],r[a+2]=e.pos[i*3+2],r[a+3]=e.nrm[i*3],r[a+4]=e.nrm[i*3+1],r[a+5]=e.nrm[i*3+2],n[t+24]=e.col[i*4],n[t+25]=e.col[i*4+1],n[t+26]=e.col[i*4+2],n[t+27]=e.col[i*4+3],n[t+32]=255}return{vertices:n,indices:new Uint32Array(e.idx)}}function ha(e){let t=e=>e<=.0031308?e*12.92:1.055*e**(1/2.4)-.055;return([n,r,i])=>{let a=t(n),o=t(r),s=t(i),c=Math.max(a,o,s),l=Math.min(a,o,s),u=c>0?(c-l)/c:0,d=c===l?0:c===a?60*(o-s)/(c-l):-1;if(c<.5||u<.12||u>.7||d<5||d>45)return[n,r,i];let f=c/.85;return[e[0]*f,e[1]*f,e[2]*f]}}var Q=e=>[e>>16&255,e>>8&255,e&255],ga=[/Sitting$/i,/^sit$/i],_a=[/(^|[|_])Idle$/i,/^idle$/i,/Standing$/i],va=[/Flying_Idle$/i,/Bat_Flying$/i,/(^|[|_])Idle$/i],ya=[/Wave$/i,/(^|[|_])Yes$/i,/(^|[|_])No$/i,/Clapping$/i,/ThumbsUp$/i,/Hello$/i,/emote-yes/i,/emote-no/i],ba=-1.3,xa=.74,Sa=.72,Ca=4.6,wa=[-4,-2.9,-1.8,-.7,.5,1.6,2.7,3.9],Ta=[[-4.2,-4.2],[-.4,-4.6],[3.6,-4],[-2.3,-7.4],[2,-7.6]],Ea=[0,-9.4],Da=(e,t,n=.62)=>[Ta[e][0]+Math.sin(t)*n,0,Ta[e][1]+Math.cos(t)*n],Oa=e=>Ta[e],ka=[{file:`kenney-female-a`,at:[wa[0],0,ba],yaw:.3,height:1.6,base:ga,gestures:ya,every:7,sit:xa,skin:[.18,.62,.3]},{file:`kenney-male-b`,at:[wa[2],0,ba],yaw:-.2,height:1.72,base:ga,gestures:ya,every:9,sit:xa,skin:[.35,.28,.75]},{file:`robot`,at:[wa[3],0,ba],yaw:.35,height:1.3,base:ga,gestures:[/ThumbsUp$/i,/Wave$/i,/Yes$/i],every:8,sit:xa,smooth:!0},{file:`alien-grey`,at:[wa[4],0,ba],yaw:0,height:1.5,base:ga,gestures:[/Clapping$/i],every:10,sit:xa,smooth:!0},{file:`goblin`,at:[wa[5],xa,ba],yaw:.2,height:.75,base:_a,gestures:[/Jump$/i],every:11},{file:`kenney-male-d`,at:[wa[7],0,ba],yaw:-.5,height:1.75,base:ga,gestures:ya,every:8,sit:xa,skin:[.72,.3,.55]},{file:`orc`,at:[-2.35,0,-1.55],yaw:.25,height:2.1,base:_a,gestures:ya,every:9},{file:`demon-blue`,at:[3.3,0,-1.6],yaw:-.3,height:2,base:_a,gestures:ya,every:10},{file:`blob`,at:[2.2,1.08,-.72],yaw:-.3,height:.22,base:_a,gestures:[/Dance$/i,/Yes$/i],every:5},{file:`mushnub`,at:[-3.4,1.08,-.72],yaw:.4,height:.24,base:_a,gestures:[/Dance$/i,/No$/i],every:6},{file:`frog`,at:Da(0,.4),face:Oa(0),height:1.75,base:_a,gestures:ya,every:5},{file:`kenney-female-c`,at:Da(0,2.6),face:Oa(0),height:1.62,base:_a,gestures:ya,every:6,skin:[.2,.55,.8]},{file:`crab`,at:Da(0,-1.9,.7),face:Oa(0),height:.35,base:_a,gestures:[/Dance$/i],every:7},{file:`alien-tall`,at:Da(1,-.5),face:Oa(1),height:2.5,base:_a,gestures:ya,every:7},{file:`mushroom-king`,at:Da(1,3.6),face:Oa(1),height:1.1,base:_a,gestures:ya,every:9},{file:`brute`,at:Da(2,.9),face:Oa(2),height:1.6,base:_a,gestures:ya,every:10},{file:`kenney-male-f`,at:Da(2,-2.2),face:Oa(2),height:1.8,base:_a,gestures:ya,every:6,skin:[.25,.45,.9]},{file:`dino`,at:Da(3,1.2),face:Oa(3),height:1.2,base:_a,gestures:ya,every:8},{file:`yeti`,at:Da(3,-1.8,.75),face:Oa(3),height:1.7,base:_a,gestures:ya,every:12},{file:`giant`,at:Da(4,2.4,.8),face:Oa(4),height:2.3,base:_a,gestures:ya,every:14},{file:`mech`,at:[Ea[0]+.9,0,Ea[1]],yaw:-.4,height:1.9,base:[/Dance$/i],speed:.9},{file:`blob-spiky`,at:[Ea[0]-.8,0,Ea[1]+.3],yaw:.6,height:.55,base:[/Dance$/i,/(^|[|_])Idle$/i]},{file:`biter`,at:[Ea[0]-.1,0,Ea[1]+1],yaw:3,height:.6,base:[/Dance$/i,/(^|[|_])Idle$/i]},{file:`squidle`,at:[-2.2,2.3,-2.6],yaw:.2,height:.5,base:va,bob:.08},{file:`flyer`,at:[3,2.4,-5.4],yaw:-.4,height:.6,base:va,bob:.1},{file:`flyer-small`,at:[.9,2.45,-2.4],yaw:.1,height:.35,base:va,bob:.06},{file:`hywirl`,at:[-4.8,2.2,-6],yaw:.7,height:.6,base:va,bob:.09},{file:`glub`,at:[5.2,1.9,-2.4],yaw:-.8,height:.55,base:va,bob:.07},{file:`alpaking`,at:[-.6,2.4,-7],yaw:0,height:.7,base:va,bob:.1},{file:`ghost`,at:[5.4,1.5,-8.8],yaw:-.9,height:.7,base:va,bob:.12}],Aa=[{pos:[-3,2.4,-1.15],radius:3.2,color:[1,.62,.3],intensity:3.2},{pos:[0,2.4,-1.15],radius:3.2,color:[1,.62,.3],intensity:3.2},{pos:[3,2.4,-1.15],radius:3.2,color:[1,.62,.3],intensity:3.2},{pos:[0,.9,-1.2],radius:4,color:[.1,.85,1],intensity:3},{pos:[0,1.6,1.3],radius:4,color:[1,.15,.7],intensity:2.6},{pos:[0,2.2,.55],radius:2.4,color:[.6,.7,1],intensity:1.2},{pos:[-4,2.5,-4.6],radius:5,color:[.5,.2,1],intensity:5},{pos:[3.8,2.5,-4.4],radius:5,color:[.15,.45,1],intensity:5},{pos:[0,2.6,-9.2],radius:5.5,color:[1,.15,.65],intensity:9},{pos:[0,2.3,-6.8],radius:5,color:[.25,.25,1],intensity:3}];async function ja(e,t,n=()=>{}){let r=`${t}bar/`,i=new Map,a=(e,t,n=e,a=!1)=>{let o=i.get(n);return o||(o=li(`${r}${e}.glb`,e,t,a),i.set(n,o)),o},o={pos:[],nrm:[],col:[],idx:[]},s=async(e,t,n,r,i,s,c)=>{let l=await a(e),u=da(l,null),d=s.s??(s.h?s.h/(u.max[1]-u.min[1]):s.w/(u.max[0]-u.min[0]));xi(l,u.palette,fa(u,d,t,n,r,i),o,c)},c=[],l=(...e)=>c.push(s(...e)),d=1.5,f=5*d,p=2.1,m=p-9*d,h=Ca;for(let e=-7;e<=7;e++)for(let t=-11;t<=2;t++){let n=Math.hypot(e-Ea[0],t-Ea[1])<1.8;l(n||(e+t)%3==0?`station/floor-detail`:Math.abs(e)<=5&&t>=-2?`station/floor-panel`:`station/floor`,e,-.3,t,0,{s:1},n?[1.2,.6,1.5,e+t&1?.5:.15]:void 0)}let g=-2.2,_=.32,v=Q(2764348),b=Q(3991295),x={pos:[],nrm:[],col:[],idx:[]};Z(o,-7.8,-1.4,m-.3,7.8,-.3,2.4,Q(1711142)),Z(o,-7.6,3,g,7.6,3.14,2.2,Q(1315612)),Z(o,-7.6,2.97,g-.06,7.6,3,g,b,1);for(let e of[-1.2,.8])Z(o,-6,2.97,e-.05,6,3,e+.05,Q(12118271),1);for(let e=-7.5;e<=7.501;e+=d)Z(o,e-.07,2.98,m,e+.07,3.14,g,v);for(let e=g;e>=m-.001;e-=d*1.5)Z(o,-7.5,2.98,e-.07,f,3.14,e+.07,v);Z(x,-7.5,3.06,m,f,3.07,g,[255,255,255]);let S=(e,t,n,r)=>{let i=t===r,a=i?n-e:r-t,s=Math.round(a/d),c=.08,l=i?[0,c]:[c,0];Z(o,Math.min(e,n)-l[0],0,Math.min(t,r)-l[1],Math.max(e,n)+l[0],_,Math.max(t,r)+l[1],v),Z(o,Math.min(e,n)-l[0],_,Math.min(t,r)-l[1],Math.max(e,n)+l[0],.34500000000000003,Math.max(t,r)+l[1],b,1),Z(o,Math.min(e,n)-l[0],2.84,Math.min(t,r)-l[1],Math.max(e,n)+l[0],3.14,Math.max(t,r)+l[1],v);for(let i=0;i<=s;i++){let a=e+(n-e)*i/s,c=t+(r-t)*i/s;Z(o,a-.06,0,c-.06,a+.06,3,c+.06,v),Z(o,a-.075,_,c-.075,a+.075,2.84,c+.075,i%2?b:Q(16732120),.35)}Z(x,Math.min(e,n)-(i?0:.005),_,Math.min(t,r)-(i?.005:0),Math.max(e,n)+(i?0:.005),2.84,Math.max(t,r)+(i?.005:0),[255,255,255])};S(-7.5,m,f,m),S(-7.5,m,-7.5,p),S(f,m,f,p);for(let e=0;e<10;e++){let t=-7.5+d*(e+.5);l(`station/wall`,t,0,p,Math.PI,{s:d}),l(e%3==0?`station/wall-banner`:`station/wall`,t,d,p,Math.PI,{s:d})}for(let[e,t]of[[-7.5,p],[f,p],[-7.5,m],[f,m]])l(`station/wall-pillar`,e,0,t,0,{h:3});Z(o,-4.6,1.02,-1,h,1.08,-.4,Q(2767954)),Z(o,-4.55,0,-.97,h-.05,1.02,-.9,Q(1841708)),Z(o,-4.55,.1,-.985,h-.05,.13,-.97,Q(16727240),1),Z(o,-4.6,.99,-1.012,h,1.015,-.998,Q(3991295),1),Z(o,-4.6,0,-.97,-4.52,1.02,-.4,Q(1841708)),Z(o,h-.08,0,-.97,h,1.02,-.4,Q(1841708)),Z(o,-4.55,0,-.45,h-.05,1.02,-.4,Q(1447454)),Z(o,-4.55,.18,-1.2,h-.05,.21,-1.14,Q(9080736)),Z(o,-3.6,0,1.4,3.6,.95,1.9,Q(2367288)),Z(o,-3.65,.95,1.35,3.65,1,1.9,Q(3820134)),Z(o,-3.6,1.15,1.95,3.6,2.55,2,Q(3807846),.35);let C=[1.35,1.72,2.09];C.forEach((e,t)=>{Z(o,-3.5,e-.03,1.66,3.5,e,1.94,Q(5922928)),Z(o,-3.5,e-.05,1.66,3.5,e-.035,1.68,t%2?Q(3991295):Q(16732120),1)});let w=[`food/wine-red`,`food/wine-white`,`food/soda-bottle`,`food/bottle-oil`,`food/soda-can`,`food/wine-red`],T=[[1,.5,1.3,.2],[.5,1.4,1.2,.25],[1.4,1.1,.4,.15],[.6,.8,1.6,.3],[1.5,.6,.5,.15],[1,1,1,0]],E=3,D=()=>(E=E*16807%2147483647,E/2147483647);for(let e of[1,...C])for(let t=-3.35;t<=3.35;t+=.3+D()*.08)e===1&&Math.abs(t)<.9||l(w[Math.floor(D()*w.length)],t,e,1.8+D()*.06,D()*6.28,{h:.24+D()*.1},T[Math.floor(D()*T.length)]);l(`furniture/kitchenCoffeeMachine`,-.55,1,1.62,Math.PI,{h:.42}),l(`furniture/kitchenBlender`,.1,1,1.62,Math.PI,{h:.34}),l(`space/machine_barrel`,.6,1,1.62,0,{h:.34}),l(`furniture/radio`,-.1,1,1.62,Math.PI,{h:.2});for(let e of wa)l(`furniture/stoolBar`,e,0,ba,0,{h:xa});let O=[`food/cocktail`,`food/soda-can`,`food/soda-glass`,`food/frappe`,`food/mug`,`food/cocktail`,`food/soda-glass`];[...wa,-2.35,3.3].forEach((e,t)=>{e===wa[1]||e===wa[6]||l(O[t%O.length],e+(D()-.5)*.1,1.08,-.72+(D()-.5)*.1,D()*6.28,{h:.14+D()*.06},T[t%T.length])});let k=.82;Ta.forEach(([e,t],n)=>{Z(o,e-.05,0,t-.05,e+.05,k,t+.05,Q(3817298)),Z(o,e-.28,0,t-.28,e+.28,.03,t+.28,Q(2764090)),Z(o,e-.34,k,t-.34,e+.34,.86,t+.34,Q(2767954)),Z(o,e-.345,.825,t-.345,e+.345,.84,t+.345,n%2?Q(3991295):Q(16732120),1);for(let r=0;r<3;r++){let i=D()*6.28,a=.12+D()*.12;l(O[(n+r)%O.length],e+Math.sin(i)*a,.86,t+Math.cos(i)*a,D()*6.28,{h:.14+D()*.06},T[(n+r)%T.length])}}),Z(o,Ea[0]-1.6,2.9,Ea[1]-.05,Ea[0]+1.6,2.94,Ea[1]+.05,Q(16732120),1),Z(o,Ea[0]-.05,2.9,Ea[1]-1.6,Ea[0]+.05,2.94,Ea[1]+1.6,Q(3991295),1),l(`furniture/speaker`,Ea[0]-2.4,0,Ea[1]-.8,.5,{h:1.3}),l(`furniture/speaker`,Ea[0]+2.4,0,Ea[1]-.8,-.5,{h:1.3}),l(`furniture/loungeSofa`,-5.6,0,-10.5,0,{w:2.2}),l(`furniture/loungeSofaCorner`,5.8,0,-10.3,-Math.PI/2,{w:1.6}),l(`furniture/tableRound`,-5.6,0,-9.4,0,{h:.45}),l(`food/cocktail`,-5.5,.45,-9.4,.4,{h:.18},T[1]),l(`station/table-display-planet`,-4.6,0,-1.9,0,{w:1.4}),l(`station/computer-wide`,-4.4,0,1.5,Math.PI,{w:1.1}),l(`station/container-tall`,f-1.1,0,1.3,.3,{h:1.3}),l(`station/container`,f-1,0,.3,-.2,{h:.8}),l(`space/machine_generator`,-6.5,0,-.4,Math.PI/2,{w:1.3}),l(`space/barrels`,f-1,0,-1.3,.7,{h:.8}),l(`space/rock_crystals`,-6.6,0,-5.8,.5,{h:1},[.8,1.2,1.6,.6]),l(`space/rock_crystals`,f-.9,0,-6.2,2.2,{h:1.2},[1.5,.7,1.4,.6]),l(`furniture/pottedPlant`,-6.7,0,1.6,0,{h:1.2},[.7,1.2,1.3,.1]),l(`furniture/pottedPlant`,f-.8,0,-9,0,{h:1.1},[.7,1.2,1.3,.1]),l(`space/craft_speederA`,3.2,2.35,-10.200000000000001,-.3,{w:1.4});let ee=new Map,A=async(t,n,r)=>{let i=ee.get(t);i||(i=a(t).then(t=>{let n=da(t,null),r={pos:[],nrm:[],col:[],idx:[]};xi(t,n.palette,fa(n,1,0,0,0,0),r);let i=ma(r);return e.upload(i.vertices,i.indices)}),ee.set(t,i));let o=u();n(0,o),e.addStatic(await i,o,r??te,n)},te=[.5,.55,.68,0];sa({add:(e,t,n,r,i,a,o)=>l(e,t,n,r,i,a,o??te),box:(e,t,n,r,i,a,s,c)=>Z(o,e,t,n,r,i,a,Q(s),c),mover:(...e)=>void c.push(A(...e))}),await Promise.all(c);let ne=ma(o);e.addStatic(e.upload(ne.vertices,ne.indices));let re=ma(x);e.addField(e.upload(re.vertices,re.indices),[.25,.7,1,0]);let j=Math.hypot(.6,.5,.45);e.sun={dir:[.6/j,.5/j,.45/j],color:[.06,.05,.1]},e.sky=[.012,.012,.026],e.ground=[.006,.003,.01],n(`set ${ne.indices.length/3} tris`);let ie=(t,n)=>{let r={pos:[],nrm:[],col:[],idx:[]};Z(r,0,0,0,1,1,1,t,n);let i=ma(r);return e.upload(i.vertices,i.indices)},ae=ie(Q(3027008)),oe=ie(Q(4804710)),se=ie(Q(3991295),1),ce=Array.from({length:16},()=>e.addStatic(ae).place),le=Array.from({length:16},()=>e.addStatic(oe).place),M=Array.from({length:2},()=>e.addStatic(ae).place),ue={pos:[],nrm:[],col:[],idx:[]};pa(ue,.5,Q(4804710));let de=ma(ue),fe=Array.from({length:2},()=>e.addStatic(e.upload(de.vertices,de.indices)).place),pe=e.addStatic(se).place,N=(e,[t,n,r,i],a,o)=>n-t>1e-4&&i-r>1e-4&&o>a?y(e,t,a,r,n-t,o-a,i-r):y(e,0,-50,0,0),P=(e,t,n,r)=>e.forEach((e,i)=>N(e,t[i]??[0,0,0,0],n,r)),me=(e,t=[])=>{let n=e-.006,r=ca.width/2,i=ca.depth/2,a=.02*ca.width,o=.985*n,s=t.slice(0,2).map(e=>({c:e,rect:[Math.max(e.x0,-r+.01),Math.min(e.x1,r-.01),Math.max(e.z0,-i+.01),Math.min(e.z1,i-.01)]})),c=s.map(e=>e.rect);P(ce,F([-r,r,-i,i],c),0,o),P(le,F([-r-a,r+a,-i-.02*ca.depth,i+.02*ca.depth],c),o,n);for(let e=0;e<2;e++){let t=s[e];N(M[e],t?.rect??[0,0,0,0],0,t?Math.min(t.c.bottom,o):0),N(fe[e],t?.c.round?t.rect:[0,0,0,0],o,n)}N(pe,[-r,r,i,i+.01*ca.depth],.9*n,.95*n)};me(la);let he=0,ge=new Map;return await Promise.all(ka.map(async t=>{let n=`${t.file}${t.skin?`#${t.skin.join(`,`)}`:``}${t.smooth?`~`:``}`,r;try{r=await a(`aliens/${t.file}`,t.skin?ha(t.skin):void 0,n,t.smooth)}catch(e){console.warn(`[bar] ${t.file}`,e);return}let i=ge.get(n);i||(i=e.upload(r.vertices,r.indices),ge.set(n,i));let o=fi(r,...t.base),s=fi(r,..._a)??o,c=da(r,s),l=t.height*Sa,u=l/Math.max(.001,c.max[1]-c.min[1]),d=t.sit!==void 0,f=d&&o?o.duration*.999:void 0,p=d?da(r,o,f):c,m=p.min[1],h=t.at[1];if(d){let e=r.nodeNames.findIndex(e=>/hips?$|pelvis/i.test(e));e>=0?(m=p.world[e*16+13],h=t.sit+.08*l):h=t.sit-.3*l}let g=t.face?Math.atan2(t.face[0]-t.at[0],t.face[1]-t.at[2]):t.yaw??0,_=fa(p,u,t.at[0],h,t.at[2],g,m),v=(t.gestures??[]).map(e=>fi(r,e)).filter(e=>!!e);e.addActor(r,i,_,{base:o,gestures:v,holdAt:f,gestureMask:d?ua(r):void 0},{every:t.every??0,speed:t.speed??.9+Math.random()*.2,tint:[1,1,1,t.rim??.35],bob:t.bob?{amp:t.bob,rate:1.3+Math.random()*.6,y:0}:void 0})&&he++})),n(`crowd ${he}/${ka.length}`),e.lights=Aa,{setCounterHeight:me,actors:he}}function Ma(e=2048,t=1024,n=7){let r=n>>>0,i=()=>(r=r*1664525+1013904223>>>0,r/4294967296),a=new Float32Array(4096);for(let e=0;e<a.length;e++)a[e]=i();let o=(e,t,n)=>a[(e*73856093^t*19349663^n*83492791)&4095],s=(e,t,n)=>{let r=Math.floor(e),i=Math.floor(t),a=Math.floor(n),s=e-r,c=t-i,l=n-a,u=s*s*(3-2*s),d=c*c*(3-2*c),f=l*l*(3-2*l),p=(e,t,n)=>e+(t-e)*n;return p(p(p(o(r,i,a),o(r+1,i,a),u),p(o(r,i+1,a),o(r+1,i+1,a),u),d),p(p(o(r,i,a+1),o(r+1,i,a+1),u),p(o(r,i+1,a+1),o(r+1,i+1,a+1),u),d),f)},c=(e,t,n)=>{let r=.5,i=1,a=0;for(let o=0;o<5;o++)a+=r*s(e*i,t*i,n*i),i*=2.03,r*=.5;return a},l=(e,t)=>{let n=(e-.5)*Math.PI*2,r=t*Math.PI;return[Math.sin(r)*Math.sin(n),Math.cos(r),-Math.sin(r)*Math.cos(n)]},u=new Float32Array(256*128*3);for(let e=0;e<128;e++)for(let t=0;t<256;t++){let[n,r,i]=l((t+.5)/256,(e+.5)/128),a=Math.exp(-(((r*.9+n*.35-.1)/.45)**2)),o=c(n*2.2+11,r*2.2,i*2.2),s=c(n*3.1-7,r*3.1+3,i*3.1),d=(Math.max(0,o-.38)*2.2)**2.2*(.35+a),f=(Math.max(0,s-.42)*2.4)**2.4*(.25+a*.8),p=(e*256+t)*3;u[p]=.004+d*.55+f*.05,u[p+1]=.005+d*.08+f*.32,u[p+2]=.012+d*.42+f*.48}let d=new Float32Array(e*t*3);for(let n=0;n<t;n++){let r=(n+.5)/t*128-.5,i=Math.max(0,Math.floor(r)),a=Math.min(127,i+1),o=Math.min(1,Math.max(0,r-i));for(let t=0;t<e;t++){let r=(t+.5)/e*256-.5,s=(Math.floor(r)%256+256)%256,c=(s+1)%256,l=r-Math.floor(r),f=(n*e+t)*3;for(let e=0;e<3;e++){let t=u[(i*256+s)*3+e]+(u[(i*256+c)*3+e]-u[(i*256+s)*3+e])*l,n=u[(a*256+s)*3+e]+(u[(a*256+c)*3+e]-u[(a*256+s)*3+e])*l;d[f+e]=t+(n-t)*o}}}let f={dir:Na([-.55,.18,-.82]),radius:.28},p=Na([.8,.35,-.2]);for(let n=0;n<t;n++)for(let r=0;r<e;r++){let i=l((r+.5)/e,(n+.5)/t),a=i[0]*f.dir[0]+i[1]*f.dir[1]+i[2]*f.dir[2],o=Math.acos(Math.min(1,a));if(o>f.radius*1.9)continue;let s=(n*e+r)*3,u=o/f.radius;if(u<1){let e=Na(Pa([0,1,0],f.dir)),t=Pa(f.dir,e),n=(i[0]*e[0]+i[1]*e[1]+i[2]*e[2])/Math.sin(f.radius),r=(i[0]*t[0]+i[1]*t[1]+i[2]*t[2])/Math.sin(f.radius),a=Math.sqrt(Math.max(0,1-n*n-r*r)),o=e[0]*n+t[0]*r-f.dir[0]*a,l=e[1]*n+t[1]*r-f.dir[1]*a,u=e[2]*n+t[2]*r-f.dir[2]*a,m=Math.max(0,-(o*p[0]+l*p[1]+u*p[2]))*.9+.02,h=.5+.5*Math.sin(r*22+c(n*3,r*14,2)*5);d[s]=m*(.55+h*.35),d[s+1]=m*(.32+h*.2),d[s+2]=m*(.22+h*.1)}else{let e=Math.exp(-(((u-1)*9)**2))*.12;d[s]+=e*.7,d[s+1]+=e*.5,d[s+2]+=e}}let m=Math.round(e*t*.0028);for(let n=0;n<m;n++){let n=i(),r=i()*2-1,a=Math.floor(n*e),o=Math.min(t-1,Math.floor(Math.acos(r)/Math.PI*t)),s=i()**9*26+.25+i()*.4,c=i(),l=c>.7?1:c>.3?.85:.65,u=c>.7?.82:.9,f=c>.7?.6:1,p=(o*e+a)*3;if(d[p]+=s*l,d[p+1]+=s*u,d[p+2]+=s*f,s>6){let n=s*.12;for(let[r,i]of[[1,0],[-1,0],[0,1],[0,-1]]){let s=(a+r+e)%e,c=(Math.min(t-1,Math.max(0,o+i))*e+s)*3;d[c]+=n*l,d[c+1]+=n*u,d[c+2]+=n*f}}}let h=new Uint16Array(e*t*4);for(let n=0;n<e*t;n++)h[n*4]=Qe(d[n*3]),h[n*4+1]=Qe(d[n*3+1]),h[n*4+2]=Qe(d[n*3+2]),h[n*4+3]=15360;return{width:e,height:t,data:h}}function Na(e){let t=Math.hypot(e[0],e[1],e[2])||1;return[e[0]/t,e[1]/t,e[2]/t]}function Pa(e,t){return[e[1]*t[2]-e[2]*t[1],e[2]*t[0]-e[0]*t[2],e[0]*t[1]-e[1]*t[0]]}var $=new URLSearchParams(location.search),Fa=$.has(`fixed`),Ia=$.get(`msaa`)===`0`?1:4,La=$.has(`quest`)?$.get(`quest`)!==`0`:/OculusBrowser/.test(navigator.userAgent),Ra=La?8:24,za=(La?9216:18432)*(document.body.dataset.app===`bartender`?1:2),Ba=6,Va=La?1.25:1,Ha=document.body.dataset.app===`bartender`,Ua=document.getElementById(`status`),Wa=document.getElementById(`hud`);async function Ga(){if(!navigator.gpu)throw Error(`WebGPU is not available in this browser.`);let t=await navigator.gpu.requestAdapter({powerPreference:`high-performance`,xrCompatible:!0});if(!t)throw Error(`No WebGPU adapter.`);let n=t.features.has(`timestamp-query`)&&!navigator.webdriver,r=await t.requestDevice({requiredFeatures:n?[`timestamp-query`]:[]});r.lost.then(e=>{Ua.textContent=`GPU device lost: ${e.message}`});let i=new Set;r.addEventListener(`uncapturederror`,e=>{let t=e.error.message;i.size>=3||i.has(t)||(i.add(t),console.error(t),Ua.textContent=[...i].join(`
`))});let a=document.getElementById(`app`),o=a.getContext(`webgpu`),s=navigator.gpu.getPreferredCanvasFormat(),c=`${s}-srgb`;o.configure({device:r,format:s,viewFormats:[c],alphaMode:`opaque`});let l=Number($.get(`domain`)??1),m=new Ke(48,za,Number($.get(`wg`)??128),Number($.get(`tilen`)??1e3),l,Ha?l*8/3:l,Ha?ee:0);m.start=Ha?`bar`:`block`;let _=m.size,b=m.floor,x={x:_.x/2,y:b,z:_.z/2},S=Math.max(_.x,_.z)/2+.2;m.splitPasses=$.has(`split`),m.fuse=$.get(`fuse`)!==`0`,m.tiled=$.get(`tile`)!==`0`,m.sortDirect=$.get(`sort`)===`1`,m.sortInterval=Number($.get(`sortevery`)??1);let C=new ut;await m.init(r),await C.init(r,m),await C.prepare(c,Ia),await C.prepare(`rgba16float`,1);let w=Ha?new $r:null;if(w){await w.init(r);let e=C.bindLayouts();await Promise.all([w.prepare(c,Ia,e),w.prepare(`rgba16float`,1,e)]),C.setFlameDraw((e,t,n)=>w.draw(e,t,n))}let T=`/kora-fire-threejs/`,E=Ha&&$.get(`bar`)!==`0`;if(E&&$.get(`env`)!==`night`){let e=Ma();C.setEnvironment(e.width,e.height,e.data)}else Ye(`${T}env/dikhololo_night.hdr`).then(({width:e,height:t,data:n})=>C.setEnvironment(e,t,n),e=>console.warn(`[goo] environment failed to load`,e));let A=new ra,j=null;E&&(await A.init(r),await Promise.all([A.prepare(c,Ia),A.prepare(`rgba16float`,1)]),ja(A,T,e=>console.info(`[bar] ${e}`)).then(e=>{j=e},e=>console.warn(`[goo] bar failed to load`,e)));let ie=u(),ae=u(),oe=[0,0,0],se=.42,de=(e,t,n,r=!0)=>j?i=>A.draw(i,e,t,n,r):void 0,fe=[null,null];Promise.all([It(`${T}hands/left.glb`),It(`${T}hands/right.glb`)]).then(([e,t])=>{fe[0]=e,fe[1]=t,C.setHandMesh(0,e),C.setHandMesh(1,t)},e=>console.warn(`[goo] hand meshes failed to load`,e));let pe=[`beads`,`solid`,`glass`],P=$.get(`look`),ge=P===`beads`||P===`solid`||P===`glass`?P:$.get(`gel`)===`0`?`beads`:`glass`,F={look:ge,solid:ge!==`beads`},ve=ge,I=null,be=new Float32Array(4),xe=e=>{if(F.look=e,F.solid=e!==`beads`,e===ve)return;let t=I?(performance.now()-I.start)/700:1,n=I&&t<.5?I.from:ve;if(e===n){I=null,ve=e;return}I={from:n,to:e,start:performance.now(),axis:[0,0,0]},ve=e},L=e=>{if(!I)return null;let t=(performance.now()-I.start)/700;if(t>=1)return I=null,null;let n=_.x*.5+.12,r=t*t*(3-2*t);return be[0]=1,be[1]=0,be[2]=0,be[3]=-n+2*n*r,{from:I.from,to:I.to,plane:be}},R=[],Se=null,Ce=(e,t=[0,.2,0])=>{if(R.filter(e=>!e.fixed).length>=4)return;let n=e===`sphere`?.14:.12;R.push({kind:e,pos:[...t],size:n,model:u()}),Se=R.length-1};Ha&&m.setCounterHole(D.x+x.x,D.z+x.z,O),m.setVessels(Ha?ye(_):[]),m.reset(),Ha&&C.setVessels(Ee());let we=new mr,Te=new Float32Array(320),z=new Float32Array(we.cubes.length*16),B=new kr,V=Ha?new Wr:null;V&&$.has(`lit`)&&V.ignite();let De=new Float32Array(20),Oe=new Float32Array(16),ke=new Float32Array(16),Ae=new Float32Array(16),je=new Float32Array(16),Ne=1/60,Pe=u(),Fe=u();{let{centre:e,u:t,v:n,n:r}=he(),i=me.width-.04,a=me.height-.04,o=me.thickness/2+.002;Pe.set([t[0]*i,t[1]*i,t[2]*i,0,n[0]*a,n[1]*a,n[2]*a,0,r[0],r[1],r[2],0,e[0]+r[0]*o,e[1]+r[1]*o,e[2]+r[2]*o,1])}Ha&&C.setRecipe(ni(r));let Ie=[Bt(),Bt()],Le={x:0,y:.5,z:0,scale:1},Re=null,ze=$.get(`handreplay`);ze&&Qt.load(`${T}handrec/${ze}.json`).then(e=>{Re=e},e=>console.warn(`[goo] hand replay failed`,e));let Be=$.has(`handrec`)?new Zt:null,Ve=(e,t)=>[{x0:N.x0*e,x1:N.x1*e,z0:N.z0*e,z1:N.z1*e,bottom:t-(N.depth+N.wall)*e},{x0:(D.x-O)*e,x1:(D.x+O)*e,z0:(D.z-O)*e,z1:(D.z+O)*e,bottom:t+(k-.04)*e,round:!0}],He={kind:`box`,pos:[...ne],size:re,sx:.028,sy:.028,sz:re,model:u(),fixed:!0,visual:!0,lever:!0,hidden:!0,yaw:0};Ha&&R.push(He);let Ue=new Gn({x:He.pos[0],y:He.pos[1],z:He.pos[2]},re),We=u(),Ge=[te[0]+_.x/2,te[1]-.01+b,te[2]+_.z/2],qe=D.x+_.x/2,Je=D.z+_.z/2,Xe=ue.map(e=>new qn(e.pivot,ce)),Ze=new Float32Array(Xe.length*16),Qe=new wn;Ha&&V&&Qe.add(B,V,...we.grabbables,Ue,...Xe);let $e=ue.map(e=>[e.outlet[0]+_.x/2,e.outlet[1]-.01+b,e.outlet[2]+_.z/2]),et=[le.x+_.x/2,le.z+_.z/2,M+b,le.hx-le.wall,le.hz-le.wall],tt=Array.from({length:50},Me),H=[],nt=e=>{for(let t of R){if(t.visual)continue;if(H.length>=50)return;let n=tt[H.length];Object.assign(n,Me());let r=t.sx??t.size,i=t.sy??t.size,a=t.sz??t.size;n.x=Ka(t.pos[0]+_.x/2,.02,_.x-.02),n.y=Ka(t.pos[1]+b,.02,_.y-.02),n.z=Ka(t.pos[2]+_.z/2,.02,_.z-.02),n.strength=t.strength??e,t.kind===`sphere`?n.radius=Math.max(.02,t.size*.5):(n.isBox=!0,n.hx=Math.max(.015,r*.5),n.hy=Math.max(.015,i*.5),n.hz=Math.max(.015,a*.5),n.radius=n.hy),H.push(n)}},U={target:[0,E?.7:.35,0],radius:0,theta:0,phi:0,dTheta:0,dPhi:0,dScale:1,pan:[0,0,0]};{let e=Math.min(_.x,2)*.85,t=E?[.06*e,.55*e,1.6*e]:[1.6*e,.85*e,1.6*e];U.radius=Math.hypot(t[0],t[1],t[2]),U.theta=Math.atan2(t[0],t[2]),U.phi=Math.acos(t[1]/U.radius)}let it=[0,0,0],W=u(),at=u(),ot=u(),G=0,st=!1,ct=()=>{let e=.05;U.theta+=U.dTheta*e,U.phi=Math.min(Math.PI-.001,Math.max(.001,U.phi+U.dPhi*e)),U.radius=Math.min(20,Math.max(.2,U.radius*U.dScale));for(let t=0;t<3;t++)U.target[t]+=U.pan[t]*e;U.dTheta*=1-e,U.dPhi*=1-e;for(let t=0;t<3;t++)U.pan[t]*=1-e;U.dScale=1;let t=Math.sin(U.phi);it[0]=U.target[0]+U.radius*t*Math.sin(U.theta),it[1]=U.target[1]+U.radius*Math.cos(U.phi),it[2]=U.target[2]+U.radius*t*Math.cos(U.theta),p(W,it,U.target)},lt=e=>{let t=a.getBoundingClientRect(),n=(e.clientX-t.left)/t.width*2-1,r=1-(e.clientY-t.top)/t.height*2,i=Math.tan(45*Math.PI/360),o=n*(i*(t.width/t.height)),s=r*i,c=[W[0]*o+W[1]*s-W[2],W[4]*o+W[5]*s-W[6],W[8]*o+W[9]*s-W[10]],l=Math.hypot(c[0],c[1],c[2]);return{o:[...it],d:[c[0]/l,c[1]/l,c[2]/l]}},dt=(e,t)=>{let n=[0,0,0],r=[0,0,0];h(e[0],e[1],e[2],G,n),h(t[0],t[1],t[2],G,r);let i=1/0,a=-1;return R.forEach((e,t)=>{if(e.lever){let o=e.yaw??0,s=e.sz??e.size,c=Math.sin(o),l=Math.cos(o);for(let o=0;o<=4;o++){let u=o/4,d=e.pos[0]+c*s*u,f=e.pos[1],p=e.pos[2]+l*s*u,m=n[0]-d,h=n[1]-f,g=n[2]-p,_=m*r[0]+h*r[1]+g*r[2],v=.09,y=_*_-(m*m+h*h+g*g-v*v);if(y<0)continue;let b=-_-Math.sqrt(y);b>0&&b<i&&(i=b,a=t)}return}if(e.fixed)return;let o=[(e.sx??e.size)*.5,(e.sy??e.size)*.5,(e.sz??e.size)*.5],s=1/0;if(e.kind===`sphere`){let t=n[0]-e.pos[0],i=n[1]-e.pos[1],a=n[2]-e.pos[2],c=t*r[0]+i*r[1]+a*r[2],l=o[0],u=c*c-(t*t+i*i+a*a-l*l);u>=0&&(s=-c-Math.sqrt(u))}else{let t=-1/0,i=1/0;for(let a=0;a<3;a++){let s=1/r[a],c=(e.pos[a]-o[a]-n[a])*s,l=(e.pos[a]+o[a]-n[a])*s;c>l&&([c,l]=[l,c]),t=Math.max(t,c),i=Math.min(i,l)}i>=Math.max(t,0)&&(s=t)}s>0&&s<i&&(i=s,a=t)}),a},K=null,ft=new Tn,pt=(e,t)=>{let n=null;return Xe.forEach((r,i)=>{for(let a=.05;a<4;a+=.004){if(n&&a>=n.t)return;if(r.gripDistance(e[0]+t[0]*a,e[1]+t[1]*a,e[2]+t[2]*a)<.03){n={index:i,t:a};return}}}),n},mt=(e,t)=>{let n=[0,0,0],r=[0,0,0];return h(e[0],e[1],e[2],G,n),h(t[0],t[1],t[2],G,r),{co:n,cd:r}};a.addEventListener(`contextmenu`,e=>e.preventDefault()),a.addEventListener(`pointerdown`,e=>{if(!(K||Yt)){if(a.setPointerCapture(e.pointerId),e.button===0){let{o:t,d:n}=lt(e),{co:r,cd:i}=mt(t,n),a=e=>[r[0]+i[0]*e,r[1]+i[1]*e,r[2]+i[2]*e],o=()=>{let e=[0,0,0];h(W[2],0,W[10],G,e);let t=Math.hypot(e[0],e[2])||1;return e[0]/=t,e[2]/=t,e},s=(t,n,r)=>!n||!ft.start(t,n)?!1:(K={id:e.pointerId,mode:`grab`,x:e.clientX,y:e.clientY,plane:{n:r,p:n,grab:[0,0,0]}},!0);if(Ha&&V){let e=we.pick(r,i),t=B.pick(r,i),n=V.pick(r,i),c=pt(r,i),l=[];if(t!==null&&l.push({t,run:()=>s(B,a(t),o())}),e&&l.push({t:e.t,run:()=>s(we.grabbables[e.index],a(e.t),o())}),n!==null&&l.push({t:n,run:()=>s(V,a(n),o())}),c&&l.push({t:c.t,run:()=>s(Xe[c.index],a(c.t),[1,0,0])}),l.sort((e,t)=>e.t-t.t),l.length&&l[0].run())return}let c=dt(t,n);if(c>=0&&R[c].lever&&s(Ue,qa(r,i,[0,1,0],He.pos),[0,1,0]))return;if(c>=0){Se=c;let r=R[c],i=[0,0,0];e.shiftKey?h(W[2],0,W[10],G,i):i[1]=1;let a=Math.hypot(i[0],i[1],i[2])||1;i[0]/=a,i[1]/=a,i[2]/=a;let o=[0,0,0],s=[0,0,0];h(t[0],t[1],t[2],G,o),h(n[0],n[1],n[2],G,s);let l=qa(o,s,i,r.pos);if(l){K={id:e.pointerId,mode:`drag`,x:e.clientX,y:e.clientY,plane:{n:i,p:[...r.pos],grab:[l[0]-r.pos[0],l[1]-r.pos[1],l[2]-r.pos[2]]}};return}}}K={id:e.pointerId,mode:e.button===0&&!e.ctrlKey?`orbit`:`pan`,x:e.clientX,y:e.clientY}}}),a.addEventListener(`pointermove`,e=>{if(!K||K.id!==e.pointerId)return;let t=e.clientX-K.x,n=e.clientY-K.y;K.x=e.clientX,K.y=e.clientY;let r=a.clientHeight||1;if(K.mode===`orbit`)U.dTheta-=2*Math.PI*t/r,U.dPhi-=2*Math.PI*n/r;else if(K.mode===`pan`){let e=U.radius*Math.tan(45*Math.PI/360)*2/r;for(let r=0;r<3;r++)U.pan[r]+=(-t*W[r*4]+n*W[r*4+1])*e}else if(K.mode===`grab`&&K.plane){n<-40&&V?.heldBy===POINTER&&V.strike();let t=lt(e),{co:r,cd:i}=mt(t.o,t.d),a=qa(r,i,K.plane.n,K.plane.p);a&&ft.drag([Ka(a[0],-2,2),Ka(a[1],-.25,_.y+.4),Ka(a[2],-.8,.8)])}else if(K.plane&&Se!==null){let t=lt(e),n=[0,0,0],r=[0,0,0];h(t.o[0],t.o[1],t.o[2],G,n),h(t.d[0],t.d[1],t.d[2],G,r);let i=qa(n,r,K.plane.n,K.plane.p);if(!i)return;let a=R[Se];a.pos[0]=Ka(i[0]-K.plane.grab[0],-S,S),a.pos[1]=Ka(i[1]-K.plane.grab[1],0,_.y+.2),a.pos[2]=Ka(i[2]-K.plane.grab[2],-S,S)}});let ht=e=>{K?.id===e.pointerId&&(K.mode===`grab`&&ft.end(!0),K=null)};a.addEventListener(`pointerup`,ht),a.addEventListener(`pointercancel`,ht),window.addEventListener(`keydown`,e=>{e.repeat||e.target instanceof HTMLInputElement||e.target instanceof HTMLTextAreaElement||(e.key===`f`||e.key===`F`)&&V?.heldBy!==null&&V?.heldBy!==void 0&&V.strike()}),a.addEventListener(`wheel`,e=>{e.preventDefault(),U.dScale*=e.deltaY>0?1/.95:.95},{passive:!1});let q=m.params;La&&(q.subDt=q.substeps*q.subDt/8,q.substeps=8);let gt=Ya(r,F.look),_t=new e({title:`MLS-MPM goo · WebGPU`}),vt=()=>{Qe.reset(),ft.end(!1),m.reset(),we.reset(),B.reset(),V?.reset(),w?.reset()},yt=e=>{e===0?vt():xe(pe[(pe.indexOf(F.look)+1)%pe.length]),gt.draw(F.look)};_t.add({reset:vt},`reset`),_t.add(F,`look`,pe).name(`look`).onChange(e=>{xe(e),gt.draw(e)}),_t.add(q,`gravity`,10,250,1),_t.add(q,`handForce`,5,120,1).name(`hand force`);let bt=_t.addFolder(`Force colliders`);bt.add({sphere:()=>Ce(`sphere`)},`sphere`).name(`add sphere`),bt.add({box:()=>Ce(`box`)},`box`).name(`add box`),bt.add({remove:()=>{Se===null||R[Se].fixed||(R.splice(Se,1),Se=R.length?Math.min(Se,R.length-1):null)}},`remove`).name(`remove selected`);let xt=_t.addFolder(`Solver`);xt.add(q,`substeps`,4,24,1).name(`substeps (per 60 Hz)`),xt.add(q,`subDt`,1e-4,5e-4,1e-5),xt.add(m,`tiled`).name(`sorted + tiled P2G`);let St=_t.addFolder(`Goo`);St.add(q,`gravityScale`,.2,4,.05).name(`gravity ×`),St.add(q,`handForceScale`,.2,8,.05).name(`hand force ×`),St.add(q,`mu`,0,400,1).name(`μ (shear)`),St.add(q,`lambda`,20,1200,5).name(`λ (bulk)`),xt.close();let Ct=n?Ja(r):null,wt=0,Tt=performance.now(),Et=``,Dt=0,Ot=e=>{if(wt++,e-Tt<500)return;let t=wt*1e3/(e-Tt);wt=0,Tt=e;let n=Ct?.read();Et=`${t.toFixed(0)} fps · ${Dt} substeps/frame`+(n?` · GPU sim ${n[0].toFixed(2)} ms · draw ${n[1].toFixed(2)} ms`:``),Wa.textContent=Et+(Yt?` · XR`:``)},kt=0,At=0,jt=Number($.get(`march`)??64),Mt=$.get(`gelsrc`)??`splat`,Nt={splatRadius:2.6*Va,smooth:!0,source:Mt},Pt={splatRadius:2.6*Va,smooth:!0,source:Mt},Ft=(e,t)=>{if(Fa)return q.substeps;kt+=Math.min(e,.1)*q.substeps*t;let n=Math.floor(kt);return kt-=n,n>Ra&&(n=Ra,kt=0),n},Lt=()=>R.map(e=>{let t=e.sx??e.size,n=e.sy??e.size,r=e.sz??e.size;if(e.lever){let i=e.yaw??0,a=Math.sin(i),o=Math.cos(i),s=r*.5,c=e.model;c[0]=o*t,c[1]=0,c[2]=-a*t,c[3]=0,c[4]=0,c[5]=n,c[6]=0,c[7]=0,c[8]=a*r,c[9]=0,c[10]=o*r,c[11]=0,c[12]=e.pos[0]+a*s,c[13]=e.pos[1],c[14]=e.pos[2]+o*s,c[15]=1}else y(e.model,e.pos[0],e.pos[1],e.pos[2],t,n,r);return{kind:e.kind,model:e.model,color:e.color,hidden:e.hidden}}),Rt=e=>{if(Ha&&(B.step(e*q.subDt,q.gravity*q.gravityScale),we.setCup(B.pos,B.q),B.writeSim(De,_,b),m.setCup(1,De),B.writeMatrix(Oe),C.setVesselParts(18,Oe),we.step(e*q.subDt,q.gravity*q.gravityScale,m.takeIceImpulses()),m.setIce(Te,we.writeSim(Te,_,b)),we.writeMatrices(z),C.setIceMatrices(z),C.writeRecipe(g(Fe,ot,Pe)),V&&w)){V.step(e*q.subDt,q.gravity*q.gravityScale);let t=V.heldBy;V.consider(t===0||t===1?Ie[t]:null,Ne),V.tick(Ne),V.writeBody(ke),V.writeWheel(Ae),V.writeFlame(je),C.setVesselParts(19,ke),C.setVesselParts(22,Ae),w.sync(je,V.lit,V.boost,Ne)}},zt=(e,t=e.scale)=>{Ha&&we.setHands(t=>J.eachBone(e,G,t));for(let n of[0,1])J.grip(n,e,G,Ie[n]),Ie[n].perMetre=1/t;Ha&&Qe.update(Ie,performance.now())},Vt=(e,t)=>{if(!Ha)return;Ue.step(e,H,t,x),He.yaw=Ue.yaw,d(We,ne[0],ne[1],ne[2],Ue.yaw,1),C.setVesselHandle(We);let n=Ue.openness;m.setFlow(Math.floor(n*28),Ge,[0,-.6,0],[qe,Je,k+b,.07]),Xe.forEach((n,r)=>{n.step(e,H,t,x),n.model(Ze,r*16)}),C.setVesselParts(20,Ze),m.setTaps([Math.floor(Xe[0].openness*Ba),Math.floor(Xe[1].openness*Ba)],$e,[0,-1.2,0],et)},Ut=(e,t,n,r,i)=>C.writeFrame({colliders:e,selected:Se,gel:{threshold:.42,absorb:6.5,stepLen:t,maxSteps:n},wrists:r,beadSize:.022*Va,forearms:i}),Wt=null,Kt=null,qt=()=>{let e=Math.min(devicePixelRatio,2)*Number($.get(`scale`)??1),t=Math.max(1,Math.round(a.clientWidth*e)),n=Math.max(1,Math.round(a.clientHeight*e));(a.width!==t||a.height!==n||!Wt)&&(a.width=t,a.height=n,Wt?.destroy(),Kt?.destroy(),Wt=r.createTexture({size:[t,n],format:rt,sampleCount:Ia,usage:GPUTextureUsage.RENDER_ATTACHMENT}),Kt=Ia>1?r.createTexture({size:[t,n],format:c,sampleCount:Ia,usage:GPUTextureUsage.RENDER_ATTACHMENT}):null)},Jt=e=>{if(Yt)return;requestAnimationFrame(Jt);let t=At?(e-At)/1e3:1/60;Ne=t,At=e,qt(),ct(),v(at,45*Math.PI/180,a.width/a.height,.05,1e3);let n=Ft(t,60);if(Dt=n,st||=(G=f(it[0],it[2]),!0),d(ot,0,0,0,G,1),H.length=0,Re){let[r,i]=Re.sample(e,ot);J.replay(e,r,i),fn(Le,t,null),J.writeSkin(C.skinData,fe),C.writeSkin(),J.gatherForces(H,tt,Le,q.handForce*q.handForceScale,_,G,b,n*q.subDt),zt(Le,Re.scale)}let i=H.length;Re&&(vn(Le),yn(Le,n*q.subDt,!1)),nt(q.handForce*q.handForceScale),Vt(t,i);let s=Lt();if(Se!==null&&R[Se]&&C.writeGizmo(R[Se].pos,.12),Rt(n),C.writeView(0,{view:W,proj:at,content:ot,contentScale:1,encodeSRGB:!1,toneMapUnlit:!0}),j){let t=1/se;d(ie,0,-la*t,0,G,t),j.setCounterHeight(la,Ve(se,la)),A.update(e/1e3,ie,it),g(ae,at,W),A.writeView(0,ae,ie,it,!1,C.exposure)}Ut(s,1/jt,2*jt,[null,null]);let l=L(W),u=F.look===`glass`||l?.from===`glass`,p=F.look!==`beads`||!!l&&l.from!==`beads`;C.setWipe(l?.plane??null);let h=r.createCommandEncoder();if(w?.encode(h),m.encode(h,n,H,Fa?1:n/q.substeps,p&&n>0?Nt:null,Ct?.compute()),u){let e=C.ensureBackdrop(0,a.width,a.height),t=h.beginRenderPass({colorAttachments:[{view:e.color,loadOp:`clear`,storeOp:`store`,clearValue:{r:0,g:0,b:0,a:1}}],depthStencilAttachment:{view:e.depth,depthLoadOp:`clear`,depthStoreOp:`discard`,depthClearValue:1},timestampWrites:Ct?.renderStart()});C.drawBackdrop(t,0,{floor:!j,colliders:s,scene:de(0,`rgba16float`,1)}),t.end()}let y=o.getCurrentTexture().createView({format:c}),x=h.beginRenderPass({colorAttachments:[{view:Kt?Kt.createView():y,resolveTarget:Kt?y:void 0,loadOp:`clear`,storeOp:Kt?`discard`:`store`,clearValue:{r:0,g:0,b:0,a:1}}],depthStencilAttachment:{view:Wt.createView(),depthLoadOp:`clear`,depthStoreOp:`discard`,depthClearValue:1},timestampWrites:u?Ct?.renderEnd():Ct?.render()});C.draw(x,0,c,Ia,{look:F.look,solid:F.solid,floor:!j,hands:[!!Re&&J.left.visible&&!!fe[0],!!Re&&J.right.visible&&!!fe[1]],panel:!1,gizmo:Se!==null,colliders:s,wipe:l??void 0,scene:de(0,c,Ia)}),x.end(),Ct?.resolve(h),r.queue.submit([h.finish()]),m.afterSubmit(),Ct?.after(),Ot(e)};requestAnimationFrame(Jt);let Yt=null,Xt=0,$t=!1,J=new Gt;J.filtering=$.get(`handfilter`)!==`0`;let en=new An(on,yt),tn=[J.right,J.left].map(e=>({input:e.input,tip:[0,0,0],tipRadius:.008,tracked:!1,free:!0})),nn=[`right`,`left`].map((e,t)=>({handedness:e,pinching:!1,start:!1,point:tn[t].input.pinchPoint,ray:tn[t].input.pointer})),rn=e=>{[J.right,J.left].forEach((e,t)=>{let n=tn[t];n.tracked=e.visible&&e.fresh,n.tip[0]=e.poses[156],n.tip[1]=e.poses[157],n.tip[2]=e.poses[158],n.tipRadius=e.radii[9]||.008,n.free=!Qe.busy(t)}),en.update(e.panelFrame(),tn),vn(e.rig),nn.forEach((e,t)=>{let n=tn[t];e.pinching=n.input.pinching[0],e.start=n.free&&n.tracked&&!mn[t]&&!en.owns(t)&&n.input.pinching[0]&&!n.input.wasPinching[0]}),e.updateHands(nn)},an=[new Rn,new Rn],cn={x:0,y:0,z:0,scale:1},ln=[0,0,0],un=(e,t,n)=>{let r=1/cn.scale;return h((e-cn.x)*r,(t-cn.y)*r,(n-cn.z)*r,G,ln),ln[1]+=.5,Math.min(B.distance(ln),we.nearest(ln),_e(ln[0],ln[1],ln[2]))*cn.scale},dn=[0,0,1],fn=(e,t,n)=>{if(Object.assign(cn,{x:e.x,y:e.y,z:e.z,scale:e.scale}),n){let e=n.panelFrame().normal;dn[0]=e[0],dn[1]=e[1],dn[2]=e[2]}[J.right,J.left].forEach((e,r)=>{if(!e.visible){an[r].reset();return}let i=n?en.limit(r):0;an[r].apply(e.poses,e.radii,e.visual,t,{depth:i,normal:dn},Ha?un:null)})},pn={radius:.05,couple:.35,vmax:16},mn=[!1,!1],hn=[[0,0,0],[0,0,0]],gn=[0,0,0],_n=(e,t,n)=>{let r=1/t.scale;return h((e[0]-t.x)*r,(e[1]-t.y)*r,(e[2]-t.z)*r,G,n),n[0]+=_.x/2,n[1]+=.5+b,n[2]+=_.z/2,n[0]>0&&n[0]<_.x&&n[1]>0&&n[1]<_.y&&n[2]>0&&n[2]<_.z},vn=e=>{[J.right,J.left].forEach((t,n)=>{let r=t.input;if(!t.visible||!r.pinching[0]){mn[n]=!1;return}mn[n]||r.wasPinching[0]||Qe.busy(n)||en.owns(n)||(mn[n]=_n(r.pinchPoint,e,hn[n]))})},yn=(e,t,n)=>{[J.right,J.left].forEach((r,i)=>{if(!mn[i])return;let a=_n(r.input.pinchPoint,e,gn),o=hn[i],s=0,c=0,l=0;if(t>0){s=(gn[0]-o[0])/t,c=(gn[1]-o[1])/t,l=(gn[2]-o[2])/t;let e=Math.hypot(s,c,l);e>pn.vmax&&(s*=pn.vmax/e,c*=pn.vmax/e,l*=pn.vmax/e),o[0]=gn[0],o[1]=gn[1],o[2]=gn[2]}if(!a||n||H.length>=50)return;let u=tt[H.length];Object.assign(u,Me()),u.x=gn[0],u.y=gn[1],u.z=gn[2],u.radius=pn.radius,u.vx=s,u.vy=c,u.vz=l,u.couple=pn.couple*r.weight,u.attract=!0,H.push(u)})};C.setPanelTexture(gt.texture);let bn=u(),xn=[u(),u()],Sn=[{mode:`immersive-vr`,label:`VR`,button:document.getElementById(`xr-vr`)},{mode:`immersive-ar`,label:`MR`,button:document.getElementById(`xr-ar`)}],Cn=/OculusBrowser/i.test(navigator.userAgent),En=document.getElementById(`xr-warp`),Dn=document.getElementById(`xr-warp-input`),On=!1,kn=await Promise.all(Sn.map(e=>sn.diagnose(e.mode))),jn=kn.every(Boolean)?kn[0]:null;jn&&(Ua.textContent=`VR unavailable: ${jn}`),Cn&&kn.some(e=>!e)&&(En.hidden=!1),Sn.forEach(({mode:e,label:t,button:n},i)=>{if(kn[i])return;let a=Sn.filter(e=>e.button!==n&&!kn[Sn.indexOf(e)]),o=()=>{n.textContent=`Enter ${t}`;for(let e of a)e.button.hidden=!1;Cn&&(En.hidden=!1)};n.hidden=!1,n.addEventListener(`click`,async()=>{if(Yt){await Yt.session.end();return}n.disabled=!0,n.textContent=`Starting…`;for(let e of a)e.button.hidden=!0;En.hidden=!0;let i=Cn&&Dn.checked;try{navigator.xr?.enableSpaceWarp?.(i)}catch(e){console.warn(`[goo] enableSpaceWarp failed`,e)}try{let a=await sn.start(r,{pickCollider:dt,moveCollider:(e,t,n,r)=>{let i=R[e];if(!i||i.fixed||i.lever)return;let a=[0,0,0];h(t,n,r,G,a),i.pos[0]=Ka(i.pos[0]+a[0],-S,S),i.pos[1]=Ka(i.pos[1]+a[1],0,_.y+.2),i.pos[2]=Ka(i.pos[2]+a[2],-S,S)},selectCollider:e=>{Se=e},panelButton:yt},e,i);i&&!a.spaceWarp&&console.warn(`[goo] Space Warp was requested, but this browser did not enable space-warp.`),await C.prepare(a.colorFormat,1),a.spaceWarp&&await C.prepare(`rgba16float`,1,!1),w&&(await w.prepare(a.colorFormat,1,C.bindLayouts()),a.spaceWarp&&await w.prepare(`rgba16float`,1,C.bindLayouts())),E&&(await A.prepare(a.colorFormat,1),a.spaceWarp&&await A.prepare(`rgba16float`,1,!1)),Yt=a,kt=0,At=0,gt.draw(F.look),a.session.addEventListener(`end`,()=>{Be?.save().then(e=>{e&&(Ua.textContent=`hand take saved: ?handreplay=${e}`)},e=>console.warn(`[goo] hand take upload failed`,e)),C.setOcclusion(0,null),C.setOcclusion(1,null),a.destroy(),Yt=null,o(),At=0,requestAnimationFrame(Jt)}),a.session.requestAnimationFrame(Mn),n.textContent=`Exit ${t}`}catch(e){console.error(`[goo] could not start an immersive session:`,e),Ua.textContent=`XR failed: ${e instanceof Error?e.message:e}`,o()}finally{n.disabled=!1}})});let Mn=(e,t)=>{let n=Yt;if(!n)return;n.session.requestAnimationFrame(Mn);let i=At?(e-At)/1e3:1/90;Ne=i,At=e;let a=t.getViewerPose(n.refSpace);J.update(t,n.refSpace,n.session),rn(n),n.update(t,a);let o=Ft(i,60);if(Dt=o,H.length=0,a){let e=a.transform.position,t=e.x-n.rig.x,r=e.z-n.rig.z;n.anchored?G=n.contentYaw:t*t+r*r>1e-4&&(G=f(t,r))}let s=n.rig.scale;d(ot,n.rig.x,n.rig.y-.5*s,n.rig.z,G,s),n.passthrough||fn(n.rig,i,n),J.writeSkin(C.skinData,fe,!n.passthrough),C.writeSkin();let c=H.length;J.gatherForces(H,tt,n.rig,q.handForce*q.handForceScale,_,G,b,o*q.subDt);let l=H.length;yn(n.rig,o*q.subDt,n.panning),nt(q.handForce*q.handForceScale),Vt(i,l-c),zt(n.rig),Be?.capture(e,ot,s,J.left,J.right),Rt(o);let u=Lt();if(C.writePanel(n.panelMatrix(bn)),a){let e=a.transform.position;oe[0]=e.x,oe[1]=e.y,oe[2]=e.z,C.writeUi(en.writeGeometry(n.panelFrame(),oe,C.uiData))}let p=n.passthrough?[Ht(J.left,xn[0]),Ht(J.right,xn[1])]:[!1,!1];Ut(u,1/48,40,[J.left.visible?J.left.wrist:null,J.right.visible?J.right.wrist:null],[p[0]?xn[0]:null,p[1]?xn[1]:null]);let h=L(a?.views[0]?.transform.inverse.matrix??null),v=F.look===`glass`||h?.from===`glass`,y=F.look!==`beads`||!!h&&h.from!==`beads`;C.setWipe(h?.plane??null);let x=r.createCommandEncoder();if(w?.encode(x),m.encode(x,o,H,Fa?1:o/q.substeps,y&&o>0?Pt:null),a&&n.passthrough){let e=!1;for(let t of a.views){let r=n.cameraFor(t);if(r){C.captureEnv(x,r.texture,t.transform.inverse.matrix,t.projectionMatrix,r.encodedSrgb),e=!0;break}}!e&&n.cameraAccess&&!$t&&++Xt===90&&($t=!0,console.warn(`[goo] camera-access is granted, but this browser did not return a GPUTexture. Reflections keep the HDR.`))}let S=!!j&&!n.passthrough;if(S&&j){let t=n.rig.y-.5*s,r=Math.max(.5,Math.min(1.3,t));d(ie,n.rig.x,t-r,n.rig.z,G,1),j.setCounterHeight(r,Ve(s,r));let i=a?.transform.position;i&&(oe[0]=i.x,oe[1]=i.y,oe[2]=i.z),A.update(e/1e3,ie,i?oe:null)}if(a){let e=!n.colorFormat.endsWith(`-srgb`);a.views.forEach((t,r)=>{if(C.setOcclusion(r,n.occlusionFor(t)),S){let n=t.transform.position;g(ae,t.projectionMatrix,t.transform.inverse.matrix),A.writeView(r,ae,ie,[n.x,n.y,n.z],e,C.exposure),v&&A.writeView(r+2,ae,ie,[n.x,n.y,n.z],!1,C.exposure)}let i=n.binding.getViewSubImage(n.layer,t),a=i.colorTexture,o={view:t.transform.inverse.matrix,proj:t.projectionMatrix,content:ot,contentScale:s,toneMapUnlit:!1},c=n.spaceWarp?i.depthStencilTexture:null,l=!!c&&c.width===a.width&&c.height===a.height;n.spaceWarp&&c&&!l&&!On&&(On=!0,console.warn(`[goo] Space Warp depth is ${c.width}×${c.height}, colour is ${a.width}×${a.height}; keeping the private depth buffer.`));let d=v&&!l,f=null;if(v){C.writeView(r+2,{...o,encodeSRGB:!1});let e=C.ensureBackdrop(r,a.width,a.height),t=x.beginRenderPass({colorAttachments:[{view:e.color,loadOp:`clear`,storeOp:`store`,clearValue:{r:0,g:0,b:0,a:+!n.passthrough}}],depthStencilAttachment:{view:e.depth,depthLoadOp:`clear`,depthStoreOp:d?`store`:`discard`,depthClearValue:1}});C.drawBackdrop(t,r+2,{eye:r,background:!n.passthrough,floor:!n.passthrough&&!S,colliders:u,scene:S?de(r+2,`rgba16float`,1):void 0}),t.end(),f=e.depth}C.writeView(r,{...o,encodeSRGB:e});let m=d&&f?f:l&&c?n.attachmentView(c,i):n.depthFor(r,a.width,a.height).createView(),_=x.beginRenderPass({colorAttachments:[{view:a.createView(i.getViewDescriptor?.()??{}),loadOp:`clear`,storeOp:`store`,clearValue:{r:0,g:0,b:0,a:+!n.passthrough}}],depthStencilAttachment:{view:m,depthLoadOp:d?`load`:`clear`,depthStoreOp:l?`store`:`discard`,depthClearValue:1}});C.draw(_,r,n.colorFormat,1,{look:F.look,solid:F.solid,background:!n.passthrough,floor:!n.passthrough&&!S,occluders:p,hands:n.passthrough?[!1,!1]:[J.left.visible&&!!fe[0],J.right.visible&&!!fe[1]],panel:!0,ui:!0,gizmo:!1,colliders:u,wipe:h??void 0,scene:S?de(r,n.colorFormat,1):void 0,composite:d}),_.end();let y=n.spaceWarp?i.motionVectorTexture:null,b=n.spaceWarp?i.depthStencilTexture:null;if(y&&b&&!l&&y.width===b.width&&y.height===b.height&&y.format===`rgba16float`&&C.isReady(`rgba16float`,1,!1)){let e=x.beginRenderPass({colorAttachments:[{view:n.attachmentView(y,i),loadOp:`clear`,storeOp:`store`,clearValue:{r:0,g:0,b:0,a:0}}],depthStencilAttachment:{view:n.attachmentView(b,i),depthLoadOp:`clear`,depthStoreOp:`store`,depthClearValue:1}});C.draw(e,r,`rgba16float`,1,{look:F.look,solid:F.solid,background:!n.passthrough,floor:!n.passthrough&&!S,occluders:p,hands:n.passthrough?[!1,!1]:[J.left.visible&&!!fe[0],J.right.visible&&!!fe[1]],panel:!0,gizmo:!1,colliders:u,wipe:h??void 0,scene:S?de(r,`rgba16float`,1,!1):void 0},!1),e.end()}else y&&x.beginRenderPass({colorAttachments:[{view:n.attachmentView(y,i),loadOp:`clear`,storeOp:`store`,clearValue:{r:0,g:0,b:0,a:0}}]}).end()})}r.queue.submit([x.finish()]),m.afterSubmit(),Ot(performance.now())};!jn&&!i.size&&(Ua.textContent=``),window.goo={sim:m,renderer:C,colliders:R,view:F,gelDesktop:Nt,gelXR:Pt,lever:Ue,taps:Xe,ice:we,cup:B,orbit:U,bar:A,P:q,hands:J,grabber:Qe,panelUI:en,synthetic:an,scooping:mn,get xr(){return Yt}}}function Ka(e,t,n){return Math.max(t,Math.min(n,e))}function qa(e,t,n,r){let i=t[0]*n[0]+t[1]*n[1]+t[2]*n[2];if(Math.abs(i)<1e-5)return null;let a=((r[0]-e[0])*n[0]+(r[1]-e[1])*n[1]+(r[2]-e[2])*n[2])/i;return a<0?null:[e[0]+t[0]*a,e[1]+t[1]*a,e[2]+t[2]*a]}function Ja(e){let t=e.createQuerySet({type:`timestamp`,count:4}),n=e.createBuffer({size:32,usage:GPUBufferUsage.QUERY_RESOLVE|GPUBufferUsage.COPY_SRC}),r=[0,1,2].map(()=>({buf:e.createBuffer({size:32,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST}),busy:!1})),i=null,a=[0,0],o=0;return{compute:()=>({querySet:t,beginningOfPassWriteIndex:0,endOfPassWriteIndex:1}),render:()=>({querySet:t,beginningOfPassWriteIndex:2,endOfPassWriteIndex:3}),renderStart:()=>({querySet:t,beginningOfPassWriteIndex:2}),renderEnd:()=>({querySet:t,endOfPassWriteIndex:3}),resolve(e){e.resolveQuerySet(t,0,4,n,0),i=r.find(e=>!e.busy)??null,i&&e.copyBufferToBuffer(n,0,i.buf,0,32)},after(){let e=i;e&&(e.busy=!0,e.buf.mapAsync(GPUMapMode.READ).then(()=>{let t=new BigInt64Array(e.buf.getMappedRange()),n=Number(t[1]-t[0])/1e6,r=Number(t[3]-t[2])/1e6;n>=0&&n<1e3&&r>=0&&r<1e3&&(a[0]+=n,a[1]+=r,o++),e.buf.unmap(),e.busy=!1},()=>{e.busy=!1}))},read(){if(!o)return null;let e=[a[0]/o,a[1]/o];return a[0]=a[1]=0,o=0,e}}}function Ya(e,t){let n=new OffscreenCanvas(512,320),r=n.getContext(`2d`),i=e.createTexture({size:[512,320],format:`rgba8unorm-srgb`,usage:GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_DST|GPUTextureUsage.RENDER_ATTACHMENT}),a=t=>{r.clearRect(0,0,512,320),[`Reset`,{beads:`Beads`,solid:`Solid`,glass:`Glass`}[t]].forEach((e,t)=>{let n=512/2*t+10;r.fillStyle=`rgba(12, 18, 28, 0.82)`,r.beginPath(),r.roundRect(n,10,512/2-20,172,28),r.fill(),r.strokeStyle=`rgba(90, 208, 224, 0.9)`,r.lineWidth=4,r.stroke(),r.fillStyle=`#e8f6ff`,r.font=`600 64px system-ui, sans-serif`,r.textAlign=`center`,r.textBaseline=`middle`,r.fillText(e,n+(512/2-20)/2,192/2)}),r.fillStyle=`rgba(12, 18, 28, 0.82)`,r.beginPath(),r.roundRect(10,192,492,118,20),r.fill(),r.fillStyle=`#e8f6ff`,r.font=`500 34px system-ui, sans-serif`,r.fillText(`Pinch with both hands to move`,512/2,230.4),r.fillText(`and scale the simulation space`,512/2,276.48),e.queue.copyExternalImageToTexture({source:n},{texture:i,colorSpace:`srgb`,premultipliedAlpha:!1},[512,320])};return a(t),{texture:i,draw:a}}Ga().catch(e=>{console.error(e),Ua.textContent=e instanceof Error?e.message:String(e)});