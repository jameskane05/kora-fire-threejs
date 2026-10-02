import{$ as e,A as t,At as n,B as r,C as i,Ct as a,D as o,Dt as s,F as c,Ft as l,G as u,H as d,I as f,It as p,J as m,M as h,Mt as g,N as _,Nt as v,Ot as y,P as b,Pt as x,Q as S,S as C,T as w,Tt as T,U as E,V as D,W as O,X as k,Y as A,Z as j,_ as M,_t as N,at as P,b as F,bt as I,c as L,ct as R,d as z,dt as B,et as V,ft as H,g as ee,gt as te,h as ne,i as re,it as U,j as ie,jt as ae,k as oe,kt as se,l as ce,lt as le,m as ue,n as de,nt as W,o as fe,ot as G,pt as pe,q as me,r as he,s as ge,st as _e,t as ve,tt as ye,u as be,v as xe,vt as Se,w as Ce,wt as K,x as we,xt as Te,yt as Ee,z as De}from"./platform-TEiS3og3.js";import"./modulepreload-polyfill-Dezn_h7o.js";import{C as Oe,Ct as ke,E as Ae,Et as je,Ht as Me,J as Ne,Kt as Pe,L as Fe,M as Ie,Nt as Le,Ot as Re,Rt as ze,T as Be,U as Ve,Ut as He,W as Ue,_ as We,_t as Ge,a as Ke,en as qe,f as q,ft as J,g as Je,ht as Ye,i as Xe,k as Ze,mt as Qe,n as $e,p as et,pt as tt,qt as nt,r as rt,t as it,tn as Y,u as at,w as ot,z as st}from"./three.webgpu-B9ZdZD-M.js";import{t as ct}from"./lil-gui.esm-BsdZdNnU.js";import{a as lt,d as ut,f as X,i as dt,o as ft,r as pt,u as mt}from"./solver-D9IA81Pz.js";var ht=[{from:`thumb-metacarpal`,to:`thumb-phalanx-proximal`},{from:`thumb-phalanx-proximal`,to:`thumb-phalanx-distal`},{from:`thumb-phalanx-distal`,to:`thumb-tip`},{from:`index-finger-metacarpal`,to:`index-finger-phalanx-proximal`},{from:`index-finger-phalanx-proximal`,to:`index-finger-phalanx-intermediate`},{from:`index-finger-phalanx-intermediate`,to:`index-finger-phalanx-distal`},{from:`index-finger-phalanx-distal`,to:`index-finger-tip`},{from:`middle-finger-metacarpal`,to:`middle-finger-phalanx-proximal`},{from:`middle-finger-phalanx-proximal`,to:`middle-finger-phalanx-intermediate`},{from:`middle-finger-phalanx-intermediate`,to:`middle-finger-phalanx-distal`},{from:`middle-finger-phalanx-distal`,to:`middle-finger-tip`},{from:`ring-finger-metacarpal`,to:`ring-finger-phalanx-proximal`},{from:`ring-finger-phalanx-proximal`,to:`ring-finger-phalanx-intermediate`},{from:`ring-finger-phalanx-intermediate`,to:`ring-finger-phalanx-distal`},{from:`ring-finger-phalanx-distal`,to:`ring-finger-tip`},{from:`pinky-finger-metacarpal`,to:`pinky-finger-phalanx-proximal`},{from:`pinky-finger-phalanx-proximal`,to:`pinky-finger-phalanx-intermediate`},{from:`pinky-finger-phalanx-intermediate`,to:`pinky-finger-phalanx-distal`},{from:`pinky-finger-phalanx-distal`,to:`pinky-finger-tip`},{from:`wrist`,to:`thumb-metacarpal`,palm:!0},{from:`wrist`,to:`index-finger-metacarpal`,palm:!0},{from:`wrist`,to:`middle-finger-metacarpal`,palm:!0},{from:`wrist`,to:`ring-finger-metacarpal`,palm:!0},{from:`wrist`,to:`pinky-finger-metacarpal`,palm:!0}],gt=ht.length*2,_t=.009,vt=new Y,yt=new Y,bt=new Y,xt=new Y,St=new Y,Ct=new Y,wt=new Y,Tt=new Le,Et=new tt,Dt=new Le,Ot=new tt;function kt(e,t,n){t.addScaledVector(e,-t.dot(e)),t.lengthSq()<1e-8&&(t.set(0,1,0),Math.abs(e.y)>.9&&t.set(1,0,0),t.addScaledVector(e,-t.dot(e))),t.normalize(),n.crossVectors(e,t).normalize(),t.crossVectors(n,e).normalize()}function At(){return{position:[0,0,0],halfExtents:[.01,.01,.01],quaternion:[0,0,0,1]}}var jt=Array.from({length:gt},At);function Mt(e,t,n,r){let i=e.get(t);return i?n.getJointPose?.(i,r)??n.getPose(i,r)??null:null}function Nt(e){let t=e.radius;return typeof t==`number`?t:void 0}function Pt(e){let{session:t,referenceSpace:n,frame:r,target:i}=e,a=[];if(!t||!n||!r)return a;i.updateMatrixWorld(!0),i.getWorldScale(wt);let o=1/Math.max(wt.x,1e-6);Ot.copy(i.matrixWorld).invert();for(let e of t.inputSources)if(!(e.handedness!==`left`&&e.handedness!==`right`||!e.hand))for(let t of ht){if(a.length>=jt.length)return a;let i=Mt(e.hand,t.from,r,n),s=Mt(e.hand,t.to,r,n);if(!i||!s)continue;let c=i.transform.position,l=s.transform.position;vt.set(c.x,c.y,c.z).applyMatrix4(Ot),yt.set(l.x,l.y,l.z).applyMatrix4(Ot),xt.subVectors(yt,vt);let u=xt.length();if(u<1e-6)continue;xt.multiplyScalar(1/u);let d=i.transform.orientation;Tt.set(d.x,d.y,d.z,d.w),St.set(0,1,0).applyQuaternion(Tt).transformDirection(Ot),kt(xt,St,Ct);let f=Nt(i),p=Nt(s),m=(f!==void 0&&p!==void 0?(f+p)*.5:_t)*o,h=t.to.endsWith(`-tip`),g=t.palm?1.15:h?.85:.6,_=t.palm?.8:h?.85:.45;bt.addVectors(vt,yt).multiplyScalar(.5),Et.makeBasis(xt,St,Ct),Dt.setFromRotationMatrix(Et);let v=jt[a.length];v.position[0]=bt.x,v.position[1]=bt.y,v.position[2]=bt.z,v.halfExtents[0]=u*.5,v.halfExtents[1]=Math.max(m*g,1e-4),v.halfExtents[2]=Math.max(m*_,1e-4),v.quaternion[0]=Dt.x,v.quaternion[1]=Dt.y,v.quaternion[2]=Dt.z,v.quaternion[3]=Dt.w,a.push(v)}return a}var Ft=`// 3D MLS-MPM for the AVP materials lab.\r
// Clear → P2G → grid → G2P. Fixed-point atomics for WebGPU's integer-only atomics.\r
// Constitutive models avoid a full 3×3 SVD: neo-Hookean goo, weakly-compressible water,\r
// and a volume-clamp sand approximation with frictional grid damping.\r
\r
const MAX_FORCES: u32 = 50u;\r
\r
struct Params {\r
  grid_n: u32,\r
  num_particles: u32,\r
  dt: f32,\r
  dx: f32,\r
  inv_dx: f32,\r
  gravity: f32,\r
  mu0: f32,\r
  lambda0: f32,\r
  force_count: u32,\r
  material_paint: u32,\r
  _pad0: u32,\r
  _pad1: u32,\r
  // xyz = center in [0,1]^3, w = strength\r
  force_pos: array<vec4<f32>, 50>,\r
  // Orthonormal axes + extents. Sphere: force_y.w < 0 (radius = force_x.w).\r
  // Capsule: force_z.w < 0 (halfLen = force_x.w, radius = force_y.w). Else oriented box.\r
  force_x: array<vec4<f32>, 50>, // xyz = axis X (bone length), w = halfLength / radius\r
  force_y: array<vec4<f32>, 50>, // xyz = axis Y (width),     w = halfWidth / capsuleR (<0 ⇒ sphere)\r
  force_z: array<vec4<f32>, 50>, // xyz = axis Z (thickness), w = halfThick (<0 ⇒ capsule)\r
};\r
\r
// Packed particle. F and C are column-major 3×3 stored as three vec3 + pad each...\r
// Use nine floats for F and nine for C (row-major) to keep layout obvious.\r
struct Particle {\r
  x: vec3<f32>,\r
  material: u32,       // 0 elastic/goo, 1 sand, 2 water\r
  v: vec3<f32>,\r
  jp: f32,             // plastic volume history\r
  // F / C row-major 3×3\r
  f: array<f32, 9>,\r
  c: array<f32, 9>,\r
  _pad: vec2<f32>,     // struct size multiple of 16\r
};\r
\r
const MAT_GOO: u32 = 0u;\r
const MAT_SAND: u32 = 1u;\r
const MAT_WATER: u32 = 2u;\r
const FIXED_SCALE: f32 = 1.0e6;\r
\r
@group(0) @binding(0) var<uniform> params: Params;\r
@group(0) @binding(1) var<storage, read_write> particles: array<Particle>;\r
// 4 atomics per node: mass, mx, my, mz\r
@group(0) @binding(2) var<storage, read_write> grid_acc: array<atomic<i32>>;\r
@group(0) @binding(3) var<storage, read_write> grid_vel: array<vec4<f32>>;\r
// Packed for rendering: xyz + material as f32\r
@group(0) @binding(4) var<storage, read_write> render_pos: array<vec4<f32>>;\r
// View stretch: xyz velocity (sim units / s), w unused\r
@group(0) @binding(5) var<storage, read_write> render_vel: array<vec4<f32>>;\r
\r
fn mat_mul_vec(m: array<f32, 9>, v: vec3<f32>) -> vec3<f32> {\r
  return vec3<f32>(\r
    m[0] * v.x + m[1] * v.y + m[2] * v.z,\r
    m[3] * v.x + m[4] * v.y + m[5] * v.z,\r
    m[6] * v.x + m[7] * v.y + m[8] * v.z,\r
  );\r
}\r
\r
fn mat_mul(a: array<f32, 9>, b: array<f32, 9>) -> array<f32, 9> {\r
  var o = array<f32, 9>(0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0);\r
  for (var r = 0; r < 3; r = r + 1) {\r
    for (var c = 0; c < 3; c = c + 1) {\r
      o[r * 3 + c] =\r
        a[r * 3 + 0] * b[0 * 3 + c] +\r
        a[r * 3 + 1] * b[1 * 3 + c] +\r
        a[r * 3 + 2] * b[2 * 3 + c];\r
    }\r
  }\r
  return o;\r
}\r
\r
fn mat_transpose(a: array<f32, 9>) -> array<f32, 9> {\r
  return array<f32, 9>(\r
    a[0], a[3], a[6],\r
    a[1], a[4], a[7],\r
    a[2], a[5], a[8],\r
  );\r
}\r
\r
fn mat_add(a: array<f32, 9>, b: array<f32, 9>) -> array<f32, 9> {\r
  var o = array<f32, 9>(0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0);\r
  for (var i = 0; i < 9; i = i + 1) { o[i] = a[i] + b[i]; }\r
  return o;\r
}\r
\r
fn mat_scale(a: array<f32, 9>, s: f32) -> array<f32, 9> {\r
  var o = array<f32, 9>(0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0);\r
  for (var i = 0; i < 9; i = i + 1) { o[i] = a[i] * s; }\r
  return o;\r
}\r
\r
fn mat_det(m: array<f32, 9>) -> f32 {\r
  return m[0] * (m[4] * m[8] - m[5] * m[7])\r
       - m[1] * (m[3] * m[8] - m[5] * m[6])\r
       + m[2] * (m[3] * m[7] - m[4] * m[6]);\r
}\r
\r
fn mat_inverse(m: array<f32, 9>) -> array<f32, 9> {\r
  let det = mat_det(m);\r
  let inv = 1.0 / select(det, 1e-8, abs(det) < 1e-8);\r
  return array<f32, 9>(\r
    (m[4] * m[8] - m[5] * m[7]) * inv,\r
    (m[2] * m[7] - m[1] * m[8]) * inv,\r
    (m[1] * m[5] - m[2] * m[4]) * inv,\r
    (m[5] * m[6] - m[3] * m[8]) * inv,\r
    (m[0] * m[8] - m[2] * m[6]) * inv,\r
    (m[2] * m[3] - m[0] * m[5]) * inv,\r
    (m[3] * m[7] - m[4] * m[6]) * inv,\r
    (m[1] * m[6] - m[0] * m[7]) * inv,\r
    (m[0] * m[4] - m[1] * m[3]) * inv,\r
  );\r
}\r
\r
fn weights1d(fx: f32) -> array<f32, 3> {\r
  return array<f32, 3>(\r
    0.5 * (1.5 - fx) * (1.5 - fx),\r
    0.75 - (fx - 1.0) * (fx - 1.0),\r
    0.5 * (fx - 0.5) * (fx - 0.5),\r
  );\r
}\r
\r
fn node_index(n: i32, x: i32, y: i32, z: i32) -> u32 {\r
  return u32(x + n * (y + n * z));\r
}\r
\r
fn scatter(n: i32, node: vec3<i32>, mass_w: f32, mom: vec3<f32>) {\r
  if (node.x < 0 || node.y < 0 || node.z < 0 || node.x >= n || node.y >= n || node.z >= n) {\r
    return;\r
  }\r
  let idx = node_index(n, node.x, node.y, node.z);\r
  // Cap momentum so i32 atomics cannot wrap (FIXED_SCALE=1e6 → |mom| ≲ 2e3).\r
  let mom_c = clamp(mom, vec3<f32>(-1800.0), vec3<f32>(1800.0));\r
  let mass_c = clamp(mass_w, 0.0, 1800.0);\r
  atomicAdd(&grid_acc[idx * 4u + 0u], i32(mass_c * FIXED_SCALE));\r
  atomicAdd(&grid_acc[idx * 4u + 1u], i32(mom_c.x * FIXED_SCALE));\r
  atomicAdd(&grid_acc[idx * 4u + 2u], i32(mom_c.y * FIXED_SCALE));\r
  atomicAdd(&grid_acc[idx * 4u + 3u], i32(mom_c.z * FIXED_SCALE));\r
}\r
\r
// Neo-Hookean PK1 without polar decomposition: μ(F − F⁻ᵀ) + λ log(J) F⁻ᵀ\r
fn pk1_neohookean(f: array<f32, 9>, mu: f32, la: f32) -> array<f32, 9> {\r
  let j = clamp(mat_det(f), 1e-4, 1e3);\r
  let finv_t = mat_transpose(mat_inverse(f));\r
  // Bound volumetric stress — unbounded log(J) is what turns a hard poke into a detonation.\r
  let logj = clamp(log(j), -1.5, 1.5);\r
  var o = array<f32, 9>(0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0);\r
  for (var i = 0; i < 9; i = i + 1) {\r
    o[i] = mu * (f[i] - finv_t[i]) + la * logj * finv_t[i];\r
  }\r
  return o;\r
}\r
\r
@compute @workgroup_size(64)\r
fn clear_grid(@builtin(global_invocation_id) gid: vec3<u32>) {\r
  let n = params.grid_n;\r
  let i = gid.x;\r
  let total = n * n * n;\r
  if (i >= total) { return; }\r
  atomicStore(&grid_acc[i * 4u + 0u], 0);\r
  atomicStore(&grid_acc[i * 4u + 1u], 0);\r
  atomicStore(&grid_acc[i * 4u + 2u], 0);\r
  atomicStore(&grid_acc[i * 4u + 3u], 0);\r
}\r
\r
@compute @workgroup_size(64)\r
fn p2g(@builtin(global_invocation_id) gid: vec3<u32>) {\r
  let p = gid.x;\r
  if (p >= params.num_particles) { return; }\r
  var pt = particles[p];\r
  let n = i32(params.grid_n);\r
  let inv_dx = params.inv_dx;\r
  let cell = pt.x * inv_dx - 0.5;\r
  let base = vec3<i32>(floor(cell));\r
  let fx = pt.x * inv_dx - vec3<f32>(base);\r
  var wx = weights1d(fx.x);\r
  var wy = weights1d(fx.y);\r
  var wz = weights1d(fx.z);\r
\r
  let j = max(mat_det(pt.f), 1e-6);\r
  var affine = pt.c;\r
  // MLS-MPM: affine += -4 Δt / dx² · σ  (σ = Cauchy). Same factor as the 88-line MPM.\r
  let k_stress = -params.dt * 4.0 * inv_dx * inv_dx;\r
\r
  if (pt.material == MAT_WATER) {\r
    // Weakly compressible fluid — isotropic pressure only (88-line MPM form).\r
    let s = k_stress * params.lambda0 * (j - 1.0);\r
    affine[0] = affine[0] + s;\r
    affine[4] = affine[4] + s;\r
    affine[8] = affine[8] + s;\r
  } else if (pt.material == MAT_SAND) {\r
    // Cohesionless: resist compression only. Plasticity in G2P kills shear (no goo).\r
    if (j < 1.0) {\r
      let pk1 = pk1_neohookean(pt.f, params.mu0, params.lambda0);\r
      let ft = mat_transpose(pt.f);\r
      affine = mat_add(affine, mat_scale(mat_mul(pk1, ft), k_stress));\r
    }\r
  } else {\r
    let pk1 = pk1_neohookean(pt.f, params.mu0, params.lambda0);\r
    let ft = mat_transpose(pt.f);\r
    affine = mat_add(affine, mat_scale(mat_mul(pk1, ft), k_stress));\r
  }\r
\r
  for (var i = 0; i < 3; i = i + 1) {\r
    for (var jj = 0; jj < 3; jj = jj + 1) {\r
      for (var k = 0; k < 3; k = k + 1) {\r
        let offs = vec3<i32>(i, jj, k);\r
        let dpos = (vec3<f32>(offs) - fx) * params.dx;\r
        let weight = wx[i] * wy[jj] * wz[k];\r
        let mom = weight * (pt.v + mat_mul_vec(affine, dpos));\r
        scatter(n, base + offs, weight, mom);\r
      }\r
    }\r
  }\r
}\r
\r
@compute @workgroup_size(64)\r
fn grid_update(@builtin(global_invocation_id) gid: vec3<u32>) {\r
  let n = params.grid_n;\r
  let i = gid.x;\r
  let total = n * n * n;\r
  if (i >= total) { return; }\r
\r
  let mass = f32(atomicLoad(&grid_acc[i * 4u + 0u])) / FIXED_SCALE;\r
  if (mass <= 1e-12) {\r
    grid_vel[i] = vec4<f32>(0.0);\r
    return;\r
  }\r
  var v = vec3<f32>(\r
    f32(atomicLoad(&grid_acc[i * 4u + 1u])) / FIXED_SCALE,\r
    f32(atomicLoad(&grid_acc[i * 4u + 2u])) / FIXED_SCALE,\r
    f32(atomicLoad(&grid_acc[i * 4u + 3u])) / FIXED_SCALE,\r
  ) / mass;\r
\r
  v.y = v.y - params.dt * params.gravity;\r
\r
  let ni = i32(n);\r
  let gx = i32(i) % ni;\r
  let gy = (i32(i) / ni) % ni;\r
  let gz = i32(i) / (ni * ni);\r
  let bound = 3;\r
  if (gx < bound && v.x < 0.0) { v.x = 0.0; }\r
  if (gx > ni - bound && v.x > 0.0) { v.x = 0.0; }\r
  if (gy < bound && v.y < 0.0) { v.y = 0.0; }\r
  if (gy > ni - bound && v.y > 0.0) { v.y = 0.0; }\r
  if (gz < bound && v.z < 0.0) { v.z = 0.0; }\r
  if (gz > ni - bound && v.z > 0.0) { v.z = 0.0; }\r
\r
  // Coulomb floor friction — sand piles; water/goo keep sliding.\r
  if (params.material_paint == MAT_SAND && gy <= bound) {\r
    let vt = length(v.xz);\r
    if (vt > 1e-6) {\r
      let vn = max(-v.y, 0.0);\r
      let max_friction = 0.55 * vn + 0.08;\r
      let scale = max(0.0, 1.0 - max_friction / vt);\r
      v.x = v.x * scale;\r
      v.z = v.z * scale;\r
    } else {\r
      v.x = 0.0;\r
      v.z = 0.0;\r
    }\r
  }\r
\r
  // Pillar collider — water pour only (matches the visible tank props).\r
  if (params.material_paint == MAT_WATER) {\r
    let px = (f32(gx) + 0.5) * params.dx;\r
    let py = (f32(gy) + 0.5) * params.dx;\r
    let pz = (f32(gz) + 0.5) * params.dx;\r
    let ddx = px - 0.62;\r
    let ddz = pz - 0.38;\r
    let rad = 0.11;\r
    if (ddx * ddx + ddz * ddz < rad * rad && py < 0.52) {\r
      let len = sqrt(ddx * ddx + ddz * ddz);\r
      if (len > 1e-4) {\r
        let nx = ddx / len;\r
        let nz = ddz / len;\r
        let vn = v.x * nx + v.z * nz;\r
        if (vn < 0.0) {\r
          v.x = v.x - vn * nx;\r
          v.z = v.z - vn * nz;\r
        }\r
      } else {\r
        v.x = 0.0;\r
        v.z = 0.0;\r
      }\r
      if (v.y < 0.0 && py < 0.08) { v.y = 0.0; }\r
    }\r
  }\r
\r
  grid_vel[i] = vec4<f32>(v, mass);\r
}\r
\r
fn box_sdf(local: vec3<f32>, half: vec3<f32>) -> f32 {\r
  let q = abs(local) - half;\r
  return length(max(q, vec3<f32>(0.0))) + min(max(q.x, max(q.y, q.z)), 0.0);\r
}\r
\r
// Capsule along local +X: segment [-half_len, +half_len], radius r.\r
fn capsule_sdf(local: vec3<f32>, half_len: f32, r: f32) -> f32 {\r
  let px = clamp(local.x, -half_len, half_len);\r
  return length(local - vec3<f32>(px, 0.0, 0.0)) - r;\r
}\r
\r
fn apply_forces(x: vec3<f32>, v: vec3<f32>) -> vec3<f32> {\r
  // Strength is a once-per-frame velocity impulse (CPU only sends forces on substep 0).\r
  var out_v = v;\r
  let n = min(params.force_count, MAX_FORCES);\r
  for (var i = 0u; i < n; i = i + 1u) {\r
    let center = params.force_pos[i].xyz;\r
    let strength = params.force_pos[i].w;\r
    let ax = params.force_x[i];\r
    let ay = params.force_y[i];\r
    let az = params.force_z[i];\r
    let d = x - center;\r
\r
    var push = vec3<f32>(0.0);\r
    var weight = 0.0;\r
\r
    if (ay.w < 0.0) {\r
      // Sphere (mouse / legacy): radius in force_x.w\r
      let r = max(ax.w, 1e-4);\r
      let dist = length(d);\r
      if (dist < r && dist > 1e-5) {\r
        weight = 1.0 - dist / r;\r
        push = normalize(d);\r
      }\r
    } else if (az.w < 0.0) {\r
      // Capsule along bone axis (fingertips).\r
      let axis_x = ax.xyz;\r
      let axis_y = ay.xyz;\r
      let axis_z = az.xyz;\r
      let half_len = max(ax.w, 1e-4);\r
      let r = max(ay.w, 1e-4);\r
      let local = vec3<f32>(dot(d, axis_x), dot(d, axis_y), dot(d, axis_z));\r
      let sdf = capsule_sdf(local, half_len, r);\r
      let shell = max(r * 0.85, 0.012);\r
      if (sdf < shell) {\r
        let e = 1e-3;\r
        let gx = capsule_sdf(local + vec3<f32>(e, 0.0, 0.0), half_len, r) - capsule_sdf(local - vec3<f32>(e, 0.0, 0.0), half_len, r);\r
        let gy = capsule_sdf(local + vec3<f32>(0.0, e, 0.0), half_len, r) - capsule_sdf(local - vec3<f32>(0.0, e, 0.0), half_len, r);\r
        let gz = capsule_sdf(local + vec3<f32>(0.0, 0.0, e), half_len, r) - capsule_sdf(local - vec3<f32>(0.0, 0.0, e), half_len, r);\r
        let grad_local = vec3<f32>(gx, gy, gz);\r
        let grad_len = length(grad_local);\r
        let n_local = select(vec3<f32>(1.0, 0.0, 0.0), grad_local / grad_len, grad_len > 1e-6);\r
        push = normalize(axis_x * n_local.x + axis_y * n_local.y + axis_z * n_local.z);\r
        weight = 1.0 - max(sdf, 0.0) / shell;\r
      }\r
    } else {\r
      // Oriented box (finger bones / palm). Soft shell outside the surface.\r
      let axis_x = ax.xyz;\r
      let axis_y = ay.xyz;\r
      let axis_z = az.xyz;\r
      let half = vec3<f32>(max(ax.w, 1e-4), max(ay.w, 1e-4), max(az.w, 1e-4));\r
      let local = vec3<f32>(dot(d, axis_x), dot(d, axis_y), dot(d, axis_z));\r
      let sdf = box_sdf(local, half);\r
      let shell = max(min(half.x, min(half.y, half.z)) * 0.85, 0.012);\r
      if (sdf < shell) {\r
        // Outward normal ≈ SDF gradient in world space.\r
        let e = 1e-3;\r
        let gx = box_sdf(local + vec3<f32>(e, 0.0, 0.0), half) - box_sdf(local - vec3<f32>(e, 0.0, 0.0), half);\r
        let gy = box_sdf(local + vec3<f32>(0.0, e, 0.0), half) - box_sdf(local - vec3<f32>(0.0, e, 0.0), half);\r
        let gz = box_sdf(local + vec3<f32>(0.0, 0.0, e), half) - box_sdf(local - vec3<f32>(0.0, 0.0, e), half);\r
        let grad_local = vec3<f32>(gx, gy, gz);\r
        let grad_len = length(grad_local);\r
        let n_local = select(vec3<f32>(1.0, 0.0, 0.0), grad_local / grad_len, grad_len > 1e-6);\r
        push = normalize(axis_x * n_local.x + axis_y * n_local.y + axis_z * n_local.z);\r
        // Full strength inside the bone; fall off across the outer shell.\r
        weight = 1.0 - max(sdf, 0.0) / shell;\r
      }\r
    }\r
\r
    if (weight > 0.0) {\r
      out_v = out_v + push * strength * weight;\r
    }\r
  }\r
  return out_v;\r
}\r
\r
fn frobenius_deviator(f: array<f32, 9>, j: f32) -> f32 {\r
  // ||F / J^{1/3} − I||_F — pure shape change.\r
  let s = pow(max(j, 1e-6), -1.0 / 3.0);\r
  var acc = 0.0;\r
  let id = array<f32, 9>(1.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 1.0);\r
  for (var i = 0; i < 9; i = i + 1) {\r
    let d = f[i] * s - id[i];\r
    acc = acc + d * d;\r
  }\r
  return sqrt(acc);\r
}\r
\r
@compute @workgroup_size(64)\r
fn g2p(@builtin(global_invocation_id) gid: vec3<u32>) {\r
  let p = gid.x;\r
  if (p >= params.num_particles) { return; }\r
  var pt = particles[p];\r
  let n = i32(params.grid_n);\r
  let inv_dx = params.inv_dx;\r
  let cell = pt.x * inv_dx - 0.5;\r
  let base = vec3<i32>(floor(cell));\r
  let fx = pt.x * inv_dx - vec3<f32>(base);\r
  var wx = weights1d(fx.x);\r
  var wy = weights1d(fx.y);\r
  var wz = weights1d(fx.z);\r
\r
  var new_v = vec3<f32>(0.0);\r
  var new_c = array<f32, 9>(0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0);\r
\r
  for (var i = 0; i < 3; i = i + 1) {\r
    for (var jj = 0; jj < 3; jj = jj + 1) {\r
      for (var k = 0; k < 3; k = k + 1) {\r
        let offs = vec3<i32>(i, jj, k);\r
        let node = base + offs;\r
        if (node.x < 0 || node.y < 0 || node.z < 0 || node.x >= n || node.y >= n || node.z >= n) {\r
          continue;\r
        }\r
        let dpos = vec3<f32>(offs) - fx;\r
        let gv = grid_vel[node_index(n, node.x, node.y, node.z)].xyz;\r
        let weight = wx[i] * wy[jj] * wz[k];\r
        new_v = new_v + weight * gv;\r
        let s = 4.0 * inv_dx * weight;\r
        // C += s * outer(gv, dpos)\r
        new_c[0] = new_c[0] + s * gv.x * dpos.x;\r
        new_c[1] = new_c[1] + s * gv.x * dpos.y;\r
        new_c[2] = new_c[2] + s * gv.x * dpos.z;\r
        new_c[3] = new_c[3] + s * gv.y * dpos.x;\r
        new_c[4] = new_c[4] + s * gv.y * dpos.y;\r
        new_c[5] = new_c[5] + s * gv.y * dpos.z;\r
        new_c[6] = new_c[6] + s * gv.z * dpos.x;\r
        new_c[7] = new_c[7] + s * gv.z * dpos.y;\r
        new_c[8] = new_c[8] + s * gv.z * dpos.z;\r
      }\r
    }\r
  }\r
\r
  new_v = apply_forces(pt.x, new_v);\r
\r
  // Cap affine / velocity before F update — runaway C is the usual detonation fuse.\r
  for (var i = 0; i < 9; i = i + 1) {\r
    new_c[i] = clamp(new_c[i], -120.0, 120.0);\r
  }\r
  let spd0 = length(new_v);\r
  let vmax = select(40.0, 16.0, pt.material == MAT_GOO);\r
  if (spd0 > vmax) {\r
    new_v = new_v * (vmax / spd0);\r
  }\r
\r
  pt.v = new_v;\r
  pt.c = new_c;\r
  pt.x = clamp(pt.x + params.dt * new_v, vec3<f32>(0.002), vec3<f32>(0.998));\r
\r
  // F ← (I + dt C) F\r
  var id_dt_c = new_c;\r
  for (var i = 0; i < 9; i = i + 1) { id_dt_c[i] = new_c[i] * params.dt; }\r
  id_dt_c[0] = id_dt_c[0] + 1.0;\r
  id_dt_c[4] = id_dt_c[4] + 1.0;\r
  id_dt_c[8] = id_dt_c[8] + 1.0;\r
  var f_new = mat_mul(id_dt_c, pt.f);\r
\r
  if (pt.material == MAT_WATER) {\r
    // Fluids track volume only (no elastic F). Use prior J from det(F)=s³.\r
    let j_old = max(mat_det(pt.f), 0.2);\r
    let div_v = new_c[0] + new_c[4] + new_c[8];\r
    let j = clamp(j_old * (1.0 + params.dt * div_v), 0.25, 1.6);\r
    let s = pow(j, 1.0 / 3.0);\r
    f_new = array<f32, 9>(s, 0.0, 0.0, 0.0, s, 0.0, 0.0, 0.0, s);\r
    // Light damping — keep pours lively without endless ringing.\r
    pt.v = pt.v * 0.998;\r
  } else if (pt.material == MAT_SAND) {\r
    var j = max(mat_det(f_new), 1e-4);\r
    // No tension: sand cannot pull itself together.\r
    if (j > 1.0) {\r
      j = 1.0;\r
    }\r
    j = max(j, 0.45);\r
    // Plastic flow: forget shear once distortion exceeds a small yield.\r
    let dist = frobenius_deviator(f_new, j);\r
    let yield_eps = 0.05;\r
    if (dist > yield_eps) {\r
      // Return toward the cone tip — isotropic packed state at volume j.\r
      let s = pow(j, 1.0 / 3.0);\r
      f_new = array<f32, 9>(s, 0.0, 0.0, 0.0, s, 0.0, 0.0, 0.0, s);\r
      pt.v = pt.v * 0.94;\r
    } else {\r
      let s = pow(j / max(mat_det(f_new), 1e-6), 1.0 / 3.0);\r
      f_new = mat_scale(f_new, s);\r
    }\r
  } else {\r
    // Goo: keep elastic shear for the soft-body feel, but shed energy when F goes pathological\r
    // so a hard poke cannot lock the blob into an irreversible explosion.\r
    var j = mat_det(f_new);\r
    if (j < 1e-4 || j != j) {\r
      f_new = array<f32, 9>(1.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 1.0);\r
      pt.v = pt.v * 0.35;\r
      pt.c = array<f32, 9>(0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0);\r
      j = 1.0;\r
    } else {\r
      let j_clamped = clamp(j, 0.4, 2.2);\r
      if (abs(j_clamped - j) > 1e-6) {\r
        let s = pow(j_clamped / j, 1.0 / 3.0);\r
        f_new = mat_scale(f_new, s);\r
        j = j_clamped;\r
      }\r
      // Soft plasticity: large shape change blends toward isotropic at the same volume.\r
      let dist = frobenius_deviator(f_new, j);\r
      let yield_soft = 0.55;\r
      if (dist > yield_soft) {\r
        let s = pow(j, 1.0 / 3.0);\r
        let iso = array<f32, 9>(s, 0.0, 0.0, 0.0, s, 0.0, 0.0, 0.0, s);\r
        let t = clamp((dist - yield_soft) / 1.2, 0.0, 0.85);\r
        for (var i = 0; i < 9; i = i + 1) {\r
          f_new[i] = mix(f_new[i], iso[i], t);\r
        }\r
        pt.v = pt.v * (1.0 - 0.28 * t);\r
      }\r
    }\r
  }\r
\r
  pt.f = f_new;\r
  particles[p] = pt;\r
\r
  // World offset: sim [0,1] → centered domain later on CPU/mesh; store sim pos + material.\r
  render_pos[p] = vec4<f32>(pt.x, f32(pt.material));\r
  render_vel[p] = vec4<f32>(pt.v, 0.0);\r
}\r
`,It=`// Subsample particle velocities into compact motion stats for procedural water audio.\r
// Binding layout is independent of the main MLS-MPM pass.\r
\r
struct StatsParams {\r
  num_particles: u32,\r
  stride: u32,\r
  high_speed: f32,\r
  _pad: f32,\r
}\r
\r
struct StatsOut {\r
  // Fixed-point sum of speed * 1024\r
  sum_speed: atomic<u32>,\r
  // Bit pattern of max speed (non-negative f32 — bit order matches magnitude)\r
  max_speed_bits: atomic<u32>,\r
  count: atomic<u32>,\r
  high_count: atomic<u32>,\r
}\r
\r
@group(0) @binding(0) var<uniform> params: StatsParams;\r
@group(0) @binding(1) var<storage, read> render_vel: array<vec4<f32>>;\r
@group(0) @binding(2) var<storage, read_write> stats: StatsOut;\r
\r
@compute @workgroup_size(64)\r
fn reduce_vel(@builtin(global_invocation_id) gid: vec3<u32>) {\r
  let sample = gid.x;\r
  let i = sample * params.stride;\r
  if (i >= params.num_particles) { return; }\r
  let s = length(render_vel[i].xyz);\r
  atomicAdd(&stats.sum_speed, u32(s * 1024.0));\r
  atomicAdd(&stats.count, 1u);\r
  if (s > params.high_speed) {\r
    atomicAdd(&stats.high_count, 1u);\r
  }\r
  // Atomic max on IEEE-754 bits works for non-negative floats.\r
  let bits = bitcast<u32>(s);\r
  atomicMax(&stats.max_speed_bits, bits);\r
}\r
`;function Lt(){return{gravity:100,handForce:40,sand:{gravityScale:2,handForceScale:1.5,mu:12,lambda:120},goo:{gravityScale:1,handForceScale:4,mu:140,lambda:500},water:{gravityScale:2,handForceScale:2,mu:0,lambda:600},substeps:14,subDt:24e-5,mouseRadius:.065}}function Rt(e,t){return e[t]}var zt={goo:0,sand:1,water:2},Bt=24576,Vt=Bt*2,Ht=112,Ut=3248,Wt=class e{gridN;capacity;liveCount;substeps;subDt;domainSize=1;get particleCount(){return this.liveCount}static activeCountFor(e,t){return Math.min(e===`goo`?Bt:Vt,t)}device;get gpuDevice(){return this.device}particleBuffer;gridAcc;gridVel;paramsBufferForce;paramsBufferIdle;renderBuffer;renderVelBuffer;pipelines;bindGroupForce;bindGroupIdle;bindLayout;audioStatsPipeline=null;audioStatsBindLayout=null;audioStatsParamsBuffer=null;audioStatsBuffer=null;audioStatsStaging=null;audioStatsBusy=!1;audioStatsParamsData=new ArrayBuffer(16);audioStatsParamsU32=new Uint32Array(this.audioStatsParamsData);audioStatsParamsF32=new Float32Array(this.audioStatsParamsData);audioStatsZero=new Uint32Array(4);paramsData=new ArrayBuffer(Ut);paramsF32=new Float32Array(this.paramsData);paramsU32=new Uint32Array(this.paramsData);resetScratch=null;submitList=[void 0];material=`sand`;gravity=100;tuning=Lt();lastSubmitCount=0;lastEncoderCount=0;constructor(t={}){this.gridN=t.gridN??48,this.capacity=t.particleCount??49152,this.liveCount=e.activeCountFor(`sand`,this.capacity),this.substeps=t.substeps??14,this.subDt=t.subDt??24e-5}bindParams(e){this.tuning=e,this.substeps=e.substeps,this.subDt=e.subDt}async init(e){this.device=e;let t=e.createShaderModule({code:Ft,label:`mpm3d`}),n=(await t.getCompilationInfo()).messages.filter(e=>e.type===`error`);if(n.length)throw Error(`mpm3d WGSL:\n${n.map(e=>`${e.lineNum}:${e.linePos} ${e.message}`).join(`
`)}`);this.bindLayout=e.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.COMPUTE,buffer:{type:`uniform`}},{binding:1,visibility:GPUShaderStage.COMPUTE,buffer:{type:`storage`}},{binding:2,visibility:GPUShaderStage.COMPUTE,buffer:{type:`storage`}},{binding:3,visibility:GPUShaderStage.COMPUTE,buffer:{type:`storage`}},{binding:4,visibility:GPUShaderStage.COMPUTE,buffer:{type:`storage`}},{binding:5,visibility:GPUShaderStage.COMPUTE,buffer:{type:`storage`}}]});let r=e.createPipelineLayout({bindGroupLayouts:[this.bindLayout]}),i=n=>e.createComputePipeline({layout:r,compute:{module:t,entryPoint:n}});this.pipelines={clear:i(`clear_grid`),p2g:i(`p2g`),grid:i(`grid_update`),g2p:i(`g2p`)};let a=this.gridN,o=a*a*a;this.particleBuffer=e.createBuffer({size:this.capacity*Ht,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST}),this.gridAcc=e.createBuffer({size:o*4*4,usage:GPUBufferUsage.STORAGE}),this.gridVel=e.createBuffer({size:o*16,usage:GPUBufferUsage.STORAGE}),this.paramsBufferForce=e.createBuffer({size:Ut,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST,label:`mpm-params-force`}),this.paramsBufferIdle=e.createBuffer({size:Ut,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST,label:`mpm-params-idle`}),this.renderBuffer=e.createBuffer({size:this.capacity*16,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC}),this.renderVelBuffer=e.createBuffer({size:this.capacity*16,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC});let s=[{binding:1,resource:{buffer:this.particleBuffer}},{binding:2,resource:{buffer:this.gridAcc}},{binding:3,resource:{buffer:this.gridVel}},{binding:4,resource:{buffer:this.renderBuffer}},{binding:5,resource:{buffer:this.renderVelBuffer}}];this.bindGroupForce=e.createBindGroup({layout:this.bindLayout,entries:[{binding:0,resource:{buffer:this.paramsBufferForce}},...s]}),this.bindGroupIdle=e.createBindGroup({layout:this.bindLayout,entries:[{binding:0,resource:{buffer:this.paramsBufferIdle}},...s]}),this.initAudioStats(e),this.reset(this.material)}initAudioStats(e){let t=e.createShaderModule({code:It,label:`mpm-audio-stats`});this.audioStatsBindLayout=e.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.COMPUTE,buffer:{type:`uniform`}},{binding:1,visibility:GPUShaderStage.COMPUTE,buffer:{type:`read-only-storage`}},{binding:2,visibility:GPUShaderStage.COMPUTE,buffer:{type:`storage`}}]}),this.audioStatsPipeline=e.createComputePipeline({layout:e.createPipelineLayout({bindGroupLayouts:[this.audioStatsBindLayout]}),compute:{module:t,entryPoint:`reduce_vel`}}),this.audioStatsParamsBuffer=e.createBuffer({size:16,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST,label:`mpm-audio-stats-params`}),this.audioStatsBuffer=e.createBuffer({size:16,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST|GPUBufferUsage.COPY_SRC,label:`mpm-audio-stats`}),this.audioStatsStaging=e.createBuffer({size:16,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST,label:`mpm-audio-stats-staging`})}async readMotionStats(e=16){if(!this.audioStatsPipeline||!this.audioStatsBindLayout||!this.audioStatsParamsBuffer||!this.audioStatsBuffer||!this.audioStatsStaging||this.audioStatsBusy)return null;this.audioStatsBusy=!0;try{let t=this.liveCount,n=Math.max(1,e|0);this.audioStatsParamsU32[0]=t,this.audioStatsParamsU32[1]=n,this.audioStatsParamsF32[2]=1.5,this.audioStatsParamsF32[3]=0,this.device.queue.writeBuffer(this.audioStatsParamsBuffer,0,this.audioStatsParamsData),this.device.queue.writeBuffer(this.audioStatsBuffer,0,this.audioStatsZero);let r=this.device.createBindGroup({layout:this.audioStatsBindLayout,entries:[{binding:0,resource:{buffer:this.audioStatsParamsBuffer}},{binding:1,resource:{buffer:this.renderVelBuffer}},{binding:2,resource:{buffer:this.audioStatsBuffer}}]}),i=Math.ceil(t/n),a=this.device.createCommandEncoder(),o=a.beginComputePass();o.setPipeline(this.audioStatsPipeline),o.setBindGroup(0,r),o.dispatchWorkgroups(Math.ceil(i/64)),o.end(),a.copyBufferToBuffer(this.audioStatsBuffer,0,this.audioStatsStaging,0,16),this.device.queue.submit([a.finish()]),await this.audioStatsStaging.mapAsync(GPUMapMode.READ);let s=new Uint32Array(this.audioStatsStaging.getMappedRange().slice(0));this.audioStatsStaging.unmap();let c=s[2]||0,l=s[0]/1024,u=new Float32Array(new Uint32Array([s[1]]).buffer)[0]||0,d=s[3]||0;return{meanSpeed:c>0?l/c:0,maxSpeed:u,highSpeedFraction:c>0?d/c:0,samples:c}}finally{this.audioStatsBusy=!1}}dispose(){this.particleBuffer?.destroy(),this.gridAcc?.destroy(),this.gridVel?.destroy(),this.paramsBufferForce?.destroy(),this.paramsBufferIdle?.destroy(),this.renderBuffer?.destroy(),this.renderVelBuffer?.destroy(),this.audioStatsParamsBuffer?.destroy(),this.audioStatsBuffer?.destroy(),this.audioStatsStaging?.destroy(),this.audioStatsParamsBuffer=null,this.audioStatsBuffer=null,this.audioStatsStaging=null,this.audioStatsPipeline=null,this.audioStatsBindLayout=null,this.resetScratch=null}setMaterial(e){this.material=e}getMaterial(){return this.material}reset(t=this.material){this.material=t,this.liveCount=e.activeCountFor(t,this.capacity);let n=this.capacity*Ht;(!this.resetScratch||this.resetScratch.byteLength!==n)&&(this.resetScratch=new ArrayBuffer(n));let r=this.resetScratch,i=new Float32Array(r),a=new Uint32Array(r),o=zt[t],s=Ht/4,c=this.liveCount,l=0,u=Math.ceil(Math.cbrt(c*1.15)),d=(e,t,n,r=0,u=0,d=0)=>{if(l>=c)return;let f=l*s;i[f+0]=e,i[f+1]=t,i[f+2]=n,a[f+3]=o,i[f+4]=r,i[f+5]=u,i[f+6]=d,i[f+7]=1,i[f+8]=1,i[f+9]=0,i[f+10]=0,i[f+11]=0,i[f+12]=1,i[f+13]=0,i[f+14]=0,i[f+15]=0,i[f+16]=1;for(let e=17;e<=25;e++)i[f+e]=0;l++};if(t===`water`){let e=.92,t=.48,n=.35,r=.12;for(;l<c;){let i=t+Math.random()*(e-t),a=Math.random()*Math.PI*2,o=Math.sqrt(Math.random())*.045*(.75+Math.random()*.35),s=(i-t)/(e-t),c=.28+Math.cos(a)*o+s*n*.08+(Math.random()-.5)*.012,l=.32+Math.sin(a)*o+s*r*.08+(Math.random()-.5)*.012,u=2.4+s*1.4+(Math.random()-.5)*.6,f=n*u*.55+(Math.random()-.5)*.45,p=-u+(Math.random()-.5)*.35,m=r*u*.55+(Math.random()-.5)*.45;d(Math.min(.96,Math.max(.04,c)),Math.min(.96,Math.max(.04,i+(Math.random()-.5)*.01)),Math.min(.96,Math.max(.04,l)),f,p,m)}}else if(t===`sand`){for(let e=0;e<u&&l<c;e++)for(let t=0;t<u&&l<c;t++){let n=t/u-.5,r=e/u-.5,i=Math.hypot(n,r);if(i>.5)continue;let a=Math.max(1,Math.floor((.5-i)/.5*u*.28));for(let e=0;e<a&&l<c;e++)d(.5+n*.85+(Math.random()-.5)*.003,.055+e/Math.max(a,1)*.14+(Math.random()-.5)*.002,.5+r*.85+(Math.random()-.5)*.003)}for(;l<c;){let e=Math.random()*Math.PI*2,t=Math.random()*.28;d(.5+Math.cos(e)*t,.055+Math.random()*.08,.5+Math.sin(e)*t)}}else{let e=.5,t=.5,n=.045,r=Math.ceil(Math.cbrt(c*1.35));for(let i=0;i<r&&l<c;i++)for(let a=0;a<r&&l<c;a++)for(let o=0;o<r&&l<c;o++){let s=(o+.5)/r*2-1,c=(a+.5)/r,l=(i+.5)/r*2-1;s*s+l*l+c*c>1||d(e+s*.3,n+c*.155,t+l*.3)}for(;l<c;){let r=l/c,i=r*Math.PI*2*17,a=r*7.13%1*.18,o=r*3.71%1*.1;d(e+Math.cos(i)*a,n+o,t+Math.sin(i)*a)}}this.device.queue.writeBuffer(this.particleBuffer,0,r),t===`goo`&&this.settle(36,8)}settle(e,t=8){for(let n=0;n<e;n++)this.step([],t)}step(e=[],t,n,r){this.substeps=this.tuning.substeps,this.subDt=this.tuning.subDt;let i=Rt(this.tuning,this.material);this.gravity=this.tuning.gravity*i.gravityScale;let a=t??this.substeps;this.fillParams(e),this.device.queue.writeBuffer(this.paramsBufferForce,0,this.paramsData),this.fillParams([]),this.device.queue.writeBuffer(this.paramsBufferIdle,0,this.paramsData);let o=this.device.createCommandEncoder();this.lastEncoderCount=1;let s=this.gridN*this.gridN*this.gridN,c=Math.ceil(this.liveCount/64),l=Math.ceil(s/64);for(let e=0;e<a;e++){let t=e===0?this.bindGroupForce:this.bindGroupIdle;this.dispatch(o,this.pipelines.clear,t,l),this.dispatch(o,this.pipelines.p2g,t,c),this.dispatch(o,this.pipelines.grid,t,l),this.dispatch(o,this.pipelines.g2p,t,c)}let u=this.liveCount*16;n&&o.copyBufferToBuffer(this.renderBuffer,0,n,0,u),r&&o.copyBufferToBuffer(this.renderVelBuffer,0,r,0,u),this.submitList[0]=o.finish(),this.device.queue.submit(this.submitList),this.lastSubmitCount=1}dispatch(e,t,n,r){let i=e.beginComputePass();i.setPipeline(t),i.setBindGroup(0,n),i.dispatchWorkgroups(r),i.end()}fillParams(e){let t=1/this.gridN,n=Rt(this.tuning,this.material),r=n.mu,i=n.lambda;this.paramsU32[0]=this.gridN,this.paramsU32[1]=this.liveCount,this.paramsF32[2]=this.subDt,this.paramsF32[3]=t,this.paramsF32[4]=1/t,this.paramsF32[5]=this.gravity,this.paramsF32[6]=r,this.paramsF32[7]=i;let a=Math.min(50,e.length);this.paramsU32[8]=a,this.paramsU32[9]=zt[this.material];for(let t=0;t<50;t++){let n=t<a?e[t]:void 0,r=12+t*4,i=212+t*4,o=412+t*4,s=612+t*4;if(this.paramsF32[r]=n?.x??0,this.paramsF32[r+1]=n?.y??0,this.paramsF32[r+2]=n?.z??0,this.paramsF32[r+3]=n?.strength??0,n?.isCapsule){let e=n.radius>0?n.radius:n.hy;this.paramsF32[i]=n.ax,this.paramsF32[i+1]=n.ay,this.paramsF32[i+2]=n.az,this.paramsF32[i+3]=n.hx,this.paramsF32[o]=n.bx,this.paramsF32[o+1]=n.by,this.paramsF32[o+2]=n.bz,this.paramsF32[o+3]=e,this.paramsF32[s]=n.cx,this.paramsF32[s+1]=n.cy,this.paramsF32[s+2]=n.cz,this.paramsF32[s+3]=-1}else if(n?.isBox)this.paramsF32[i]=n.ax,this.paramsF32[i+1]=n.ay,this.paramsF32[i+2]=n.az,this.paramsF32[i+3]=n.hx,this.paramsF32[o]=n.bx,this.paramsF32[o+1]=n.by,this.paramsF32[o+2]=n.bz,this.paramsF32[o+3]=n.hy,this.paramsF32[s]=n.cx,this.paramsF32[s+1]=n.cy,this.paramsF32[s+2]=n.cz,this.paramsF32[s+3]=n.hz;else{let e=n?.radius??.05;this.paramsF32[i]=1,this.paramsF32[i+1]=0,this.paramsF32[i+2]=0,this.paramsF32[i+3]=e,this.paramsF32[o]=0,this.paramsF32[o+1]=1,this.paramsF32[o+2]=0,this.paramsF32[o+3]=-1,this.paramsF32[s]=0,this.paramsF32[s+1]=0,this.paramsF32[s+2]=1,this.paramsF32[s+3]=e}}}},Gt={goo:0,sand:1,water:2};function Kt(e,t,r,i){let a=Te(r,`vec4`,e).toAttribute(),o=T(Gt.sand),c=new at;c.positionNode=a.xyz.sub(.5).mul(t).add(n(0,t*.5,0)),c.scaleNode=_(()=>Se(o.lessThan(.5),A(.022),Se(o.greaterThan(1.5),A(.018),A(.007))))(),c.colorNode=_(()=>{let e=s().mul(2).sub(1),t=e.dot(e);b(t.greaterThanEqual(1),()=>{h()});let r=I(U(A(0),A(1).sub(t))),i=H(n(e.x,e.y,r)),a=H(n(.4,.75,.55)),c=U(i.dot(a),A(0)).mul(.55).add(.45),l=N(pe(U(i.z,A(0))),A(2.8)),d=H(a.add(n(0,0,1))),f=N(U(i.dot(d),A(0)),A(56)),p=G(u(1332013),u(6479994),c).add(u(13041632).mul(l.mul(.55))).add(n(1,1,1).mul(f.mul(.5))).add(u(3107653).mul(pe(c).mul(.15))),m=u(13935988).mul(c.mul(.45).add(.55)),g=u(5088255).mul(c.mul(.35).add(.65)).add(u(16777215).mul(l.mul(.35))).add(n(1,1,1).mul(f.mul(.25)));return Se(o.lessThan(.5),p,Se(o.greaterThan(1.5),g,m))})(),c.transparent=!1,c.depthWrite=!0,c.depthTest=!0,c.toneMapped=!0;let l=new Ne(new Re(1,1),c,e);return l.frustumCulled=!1,l.boundingSphere=new Pe(void 0,t*2),l.renderOrder=5,{mesh:l,setKind:e=>{o.value=Gt[e]}}}var qt=`// Density field for gelatin surface reconstruction from MLS-MPM particles.\r
// clear → splat (atomic) → resolve → optional smooth.\r
\r
struct Params {\r
  grid_n: u32,\r
  num_particles: u32,\r
  splat_radius: f32,\r
  density_scale: f32,\r
};\r
\r
@group(0) @binding(0) var<uniform> params: Params;\r
@group(0) @binding(1) var<storage, read> particles: array<vec4<f32>>; // xyz sim, w = material\r
@group(0) @binding(2) var<storage, read_write> density_i: array<atomic<i32>>;\r
@group(0) @binding(3) var<storage, read_write> density: array<f32>;\r
@group(0) @binding(4) var<storage, read_write> density_tmp: array<f32>;\r
\r
const FIXED: f32 = 1000.0;\r
const MAT_GOO: f32 = 0.5; // material id 0 → w < 0.5\r
\r
fn idx3(n: u32, x: i32, y: i32, z: i32) -> u32 {\r
  return u32(x) + u32(y) * n + u32(z) * n * n;\r
}\r
\r
@compute @workgroup_size(64)\r
fn clear_density(@builtin(global_invocation_id) gid: vec3<u32>) {\r
  let i = gid.x;\r
  let n = params.grid_n;\r
  let total = n * n * n;\r
  if (i >= total) { return; }\r
  atomicStore(&density_i[i], 0);\r
  density[i] = 0.0;\r
  density_tmp[i] = 0.0;\r
}\r
\r
@compute @workgroup_size(64)\r
fn splat_density(@builtin(global_invocation_id) gid: vec3<u32>) {\r
  let p = gid.x;\r
  if (p >= params.num_particles) { return; }\r
  let pt = particles[p];\r
  // Only goo particles contribute (material id 0).\r
  if (pt.w >= MAT_GOO) { return; }\r
\r
  let n = i32(params.grid_n);\r
  let inv = f32(n);\r
  let gx = pt.x * inv;\r
  let gy = pt.y * inv;\r
  let gz = pt.z * inv;\r
  let r = params.splat_radius;\r
  let r_cells = i32(ceil(r));\r
  let ix0 = clamp(i32(floor(gx)) - r_cells, 0, n - 1);\r
  let iy0 = clamp(i32(floor(gy)) - r_cells, 0, n - 1);\r
  let iz0 = clamp(i32(floor(gz)) - r_cells, 0, n - 1);\r
  let ix1 = clamp(i32(floor(gx)) + r_cells, 0, n - 1);\r
  let iy1 = clamp(i32(floor(gy)) + r_cells, 0, n - 1);\r
  let iz1 = clamp(i32(floor(gz)) + r_cells, 0, n - 1);\r
\r
  for (var z = iz0; z <= iz1; z = z + 1) {\r
    for (var y = iy0; y <= iy1; y = y + 1) {\r
      for (var x = ix0; x <= ix1; x = x + 1) {\r
        let dx = (f32(x) + 0.5) - gx;\r
        let dy = (f32(y) + 0.5) - gy;\r
        let dz = (f32(z) + 0.5) - gz;\r
        let d2 = dx * dx + dy * dy + dz * dz;\r
        let r2 = r * r;\r
        if (d2 < r2) {\r
          // Poly6-ish compact kernel.\r
          let t = 1.0 - d2 / r2;\r
          let w = t * t * t * params.density_scale;\r
          atomicAdd(&density_i[idx3(params.grid_n, x, y, z)], i32(w * FIXED));\r
        }\r
      }\r
    }\r
  }\r
}\r
\r
@compute @workgroup_size(64)\r
fn resolve_density(@builtin(global_invocation_id) gid: vec3<u32>) {\r
  let i = gid.x;\r
  let n = params.grid_n;\r
  let total = n * n * n;\r
  if (i >= total) { return; }\r
  density[i] = f32(atomicLoad(&density_i[i])) / FIXED;\r
}\r
\r
@compute @workgroup_size(64)\r
fn smooth_density(@builtin(global_invocation_id) gid: vec3<u32>) {\r
  let i = gid.x;\r
  let n = params.grid_n;\r
  let total = n * n * n;\r
  if (i >= total) { return; }\r
  let ni = i32(n);\r
  let x = i32(i) % ni;\r
  let y = (i32(i) / ni) % ni;\r
  let z = i32(i) / (ni * ni);\r
\r
  var acc = density[i] * 6.0;\r
  var w = 6.0;\r
  if (x > 0) { acc = acc + density[idx3(n, x - 1, y, z)]; w = w + 1.0; }\r
  if (x < ni - 1) { acc = acc + density[idx3(n, x + 1, y, z)]; w = w + 1.0; }\r
  if (y > 0) { acc = acc + density[idx3(n, x, y - 1, z)]; w = w + 1.0; }\r
  if (y < ni - 1) { acc = acc + density[idx3(n, x, y + 1, z)]; w = w + 1.0; }\r
  if (z > 0) { acc = acc + density[idx3(n, x, y, z - 1)]; w = w + 1.0; }\r
  if (z < ni - 1) { acc = acc + density[idx3(n, x, y, z + 1)]; w = w + 1.0; }\r
  density_tmp[i] = acc / w;\r
}\r
\r
@compute @workgroup_size(64)\r
fn copy_smooth(@builtin(global_invocation_id) gid: vec3<u32>) {\r
  let i = gid.x;\r
  let total = params.grid_n * params.grid_n * params.grid_n;\r
  if (i >= total) { return; }\r
  density[i] = density_tmp[i];\r
}\r
`,Jt=16,Yt=48,Xt=class{mesh;densityAttr;gridN;device;particleCount=0;densityAtomic;densityFloat;densityTmp;paramsBuffer;pipelines;bindGroup;paramsData=new ArrayBuffer(Jt);paramsU32=new Uint32Array(this.paramsData);paramsF32=new Float32Array(this.paramsData);submitList=[void 0];densityDest=null;dispatchGrid=0;dispatchParticles=0;quality=`desktop`;u={boxMin:T(new Y),boxMax:T(new Y),threshold:T(.42),steps:T(48),absorb:T(6.5)};constructor(e,t=48){this.gridN=t;let i=t*t*t;this.densityAttr=new q(i,1);let a=e/2;this.u.boxMin.value.set(-a,0,-a),this.u.boxMax.value.set(a,e,a);let o=new Oe(e,e,e);o.translate(0,a,0);let s=Te(this.densityAttr,`float`,i).toReadOnly(),l=A(t),u=V(t),d=(e,t,n)=>s.element(e.add(t.mul(u)).add(n.mul(u.mul(u)))),f=l.sub(1),p=e=>{let t=e.clamp(A(0),A(1)).mul(l).sub(.5),r=n(t.x.floor(),t.y.floor(),t.z.floor()),i=t.sub(r).clamp(0,1),a=V(r.x.clamp(0,f)),o=V(r.y.clamp(0,f)),s=V(r.z.clamp(0,f)),c=V(r.x.add(1).clamp(0,f)),u=V(r.y.add(1).clamp(0,f)),p=V(r.z.add(1).clamp(0,f)),m=G(d(a,o,s),d(c,o,s),i.x),h=G(d(a,u,s),d(c,u,s),i.x),g=G(d(a,o,p),d(c,o,p),i.x),_=G(d(a,u,p),d(c,u,p),i.x);return G(G(m,h,i.y),G(g,_,i.y),i.z)},g=new Ke;g.side=1,g.transparent=!0,g.opacity=1,g.depthWrite=!0,g.depthTest=!0,g.toneMapped=!1,g.lights=!1,g.fragmentNode=_(()=>{let e=E[3],t=le.mul(e).xyz.toVar(),i=H(te.sub(t)).toVar(),a=n(1).div(i),o=this.u.boxMin.sub(t).mul(a),s=this.u.boxMax.sub(t).mul(a),u=P(o,s),d=U(o,s),f=U(U(u.x,u.y),u.z),g=P(P(d.x,d.y),d.z);b(g.lessThanEqual(U(f,A(0))),()=>{h()});let _=U(f,A(0)).toVar(),y=g.sub(_).div(this.u.steps).toVar(),x=this.u.boxMax.sub(this.u.boxMin),S=_.add(y.mul(.5)).toVar(),C=A(-1).toVar(),w=A(-1).toVar(),T=A(0).toVar(),O=_.toVar();c(Yt,()=>{b(S.greaterThanEqual(g).or(y.lessThanEqual(0)),()=>{ie()});let e=t.add(i.mul(S)),n=p(e.sub(this.u.boxMin).div(x));b(C.lessThan(0),()=>{b(n.greaterThanEqual(this.u.threshold),()=>{let e=U(n.sub(T),A(1e-5)),t=this.u.threshold.sub(T).div(e).clamp(0,1);C.assign(G(O,S,t))})}).Else(()=>{b(n.lessThan(this.u.threshold),()=>{let e=U(T.sub(n),A(1e-5)),t=T.sub(this.u.threshold).div(e).clamp(0,1);w.assign(G(O,S,t)),ie()})}),T.assign(n),O.assign(S),S.addAssign(y)}),b(C.lessThan(0),()=>{h()});let k=t.add(i.mul(C)),j=_e.mul(ae(k,1)).z;me.assign(v(j,D,r)).toStack();let M=k.sub(this.u.boxMin).div(x),F=A(1.25).div(l),I=n(p(M.add(n(F,0,0))).sub(p(M.sub(n(F,0,0)))),p(M.add(n(0,F,0))).sub(p(M.sub(n(0,F,0)))),p(M.add(n(0,0,F))).sub(p(M.sub(n(0,0,F))))),L=ye(I),R=i.negate(),z=Se(L.greaterThan(1e-4),H(I),R).toVar();b(z.dot(R).lessThan(0),()=>{z.assign(z.negate())});let B=U(z.dot(R),A(0)),V=N(pe(B),A(4)).mul(.72).add(.05),ee=Se(w.greaterThan(C),w.sub(C),g.sub(C)).clamp(.01,.55),ne=m(n(.55,.12,.4).negate().mul(ee.mul(this.u.absorb))),re=n(.55,.95,.62),oe=G(n(.05,.28,.14),n(.16,.58,.32),B.mul(.5).add(.5)).mul(ne).mul(re),se=H(H(n(.35,.85,.4)).add(R)),ce=N(U(z.dot(se),A(0)),A(48)).mul(.18),ue=n(.75,.98,.85).mul(V.mul(.4));return ae(oe.mul(pe(V)).add(ue).add(n(ce)),G(pe(m(ee.mul(this.u.absorb).negate())),A(1),V).clamp(.12,1))})(),this.mesh=new Qe(o,g),this.mesh.frustumCulled=!1,this.mesh.renderOrder=6,this.mesh.visible=!1}async init(e,t,n){this.device=e,this.particleCount=n;let r=e.createShaderModule({code:qt,label:`gel_density`}),i=(await r.getCompilationInfo()).messages.filter(e=>e.type===`error`);if(i.length)throw Error(`gel_density WGSL:\n${i.map(e=>`${e.lineNum}:${e.linePos} ${e.message}`).join(`
`)}`);let a=e.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.COMPUTE,buffer:{type:`uniform`}},{binding:1,visibility:GPUShaderStage.COMPUTE,buffer:{type:`read-only-storage`}},{binding:2,visibility:GPUShaderStage.COMPUTE,buffer:{type:`storage`}},{binding:3,visibility:GPUShaderStage.COMPUTE,buffer:{type:`storage`}},{binding:4,visibility:GPUShaderStage.COMPUTE,buffer:{type:`storage`}}]}),o=e.createPipelineLayout({bindGroupLayouts:[a]}),s=t=>e.createComputePipeline({layout:o,compute:{module:r,entryPoint:t}});this.pipelines={clear:s(`clear_density`),splat:s(`splat_density`),resolve:s(`resolve_density`),smooth:s(`smooth_density`),copy:s(`copy_smooth`)};let c=this.gridN**3;this.paramsBuffer=e.createBuffer({size:Jt,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}),this.densityAtomic=e.createBuffer({size:c*4,usage:GPUBufferUsage.STORAGE}),this.densityFloat=e.createBuffer({size:c*4,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC}),this.densityTmp=e.createBuffer({size:c*4,usage:GPUBufferUsage.STORAGE}),this.bindGroup=e.createBindGroup({layout:a,entries:[{binding:0,resource:{buffer:this.paramsBuffer}},{binding:1,resource:{buffer:t}},{binding:2,resource:{buffer:this.densityAtomic}},{binding:3,resource:{buffer:this.densityFloat}},{binding:4,resource:{buffer:this.densityTmp}}]}),this.dispatchGrid=Math.ceil(c/64),this.dispatchParticles=Math.ceil(n/64)}setEnabled(e){this.mesh.visible=e}setThreshold(e){this.u.threshold.value=e}setQuality(e){this.quality=e,this.u.steps.value=e===`immersive`?28:48}update(e,t){if(!this.mesh.visible)return;let n=this.quality===`immersive`,r=t?.splatRadius??(n?2.1:2.6),i=t?.densityScale??1.15,a=t?.smoothPasses??+!n;if(this.paramsU32[0]=this.gridN,this.paramsU32[1]=this.particleCount,this.paramsF32[2]=r,this.paramsF32[3]=i,this.device.queue.writeBuffer(this.paramsBuffer,0,this.paramsData),!this.densityDest){let t=e.backend;this.densityDest=t.get(this.densityAttr)?.buffer??null}let o=this.gridN**3,s=this.dispatchGrid,c=this.dispatchParticles,l=this.device.createCommandEncoder();this.dispatch(l,this.pipelines.clear,s),this.dispatch(l,this.pipelines.splat,c),this.dispatch(l,this.pipelines.resolve,s);for(let e=0;e<a;e++)this.dispatch(l,this.pipelines.smooth,s),this.dispatch(l,this.pipelines.copy,s);this.densityDest&&l.copyBufferToBuffer(this.densityFloat,0,this.densityDest,0,o*4),this.submitList[0]=l.finish(),this.device.queue.submit(this.submitList)}dispatch(e,t,n){let r=e.beginComputePass();r.setPipeline(t),r.setBindGroup(0,this.bindGroup),r.dispatchWorkgroups(n),r.end()}dispose(){this.mesh.geometry.dispose(),this.mesh.material.dispose(),this.densityAtomic?.destroy(),this.densityFloat?.destroy(),this.densityTmp?.destroy(),this.paramsBuffer?.destroy()}};function Zt(e,t){return e+(t?2:0)}var Qt={distance:.48,height:.88,framedSize:.42,turntable:!1},$t=class{renderer;immersive;environment;scene;camera;onGizmoDrag;solver=null;volume=null;sparks=null;noise=null;obstacles=null;handSolids=new he;audio=new oe;audioProbes=null;audioProbeBusy=!1;audioProbeAge=0;params=(()=>{let e=M({...we},ee[0]);return z(e),e.environment=`night`,e.backgroundIntensity=C.night,e.obstacleCount=Zt(+!ve(),!1),e})();gui=null;frame=0;active=!1;ready=!1;onKeyDown=e=>{if(!this.active||e.target instanceof HTMLInputElement||e.target instanceof HTMLTextAreaElement)return;e.key===` `&&(e.preventDefault(),this.solver?.detonate(1));let t={w:`translate`,e:`rotate`,r:`scale`}[e.key.toLowerCase()];t&&this.obstacles?.setMode(t),e.key===`Escape`&&this.obstacles?.select(null)};constructor(e,t,n,r,i,a){this.renderer=e,this.immersive=t,this.environment=n,this.scene=r,this.camera=i,this.onGizmoDrag=a}get isReady(){return this.ready}get isActive(){return this.active}get domainSize(){return this.params.domainSize}get koraParams(){return this.params}onWorldUiChange=()=>{};setGizmoMode(e){this.params.gizmoMode=e,this.obstacles?.setMode(e),this.immersive.showMode(e),this.onWorldUiChange()}refreshDesktopGui(){this.gui&&ne(this.gui)}async init(){this.ready||=(this.noise=w(32),this.buildSolver(),this.mountGui(),this.setGuiVisible(!1),this.setVisible(!1),window.addEventListener(`keydown`,this.onKeyDown),!0)}setActive(e){this.ready&&(this.active=e,this.setVisible(e),this.setGuiVisible(e),this.audio.setEnabled(e),e?(this.enforceLeanBudget()?this.rebuild():this.gui&&ne(this.gui),this.immersive.setDomainSize(this.params.domainSize),this.immersive.setPlacement(this.placementForSession()),this.environment.setIntensity(this.params.backgroundIntensity),this.environment.set(this.params.environment),this.obstacles?.setGizmoEnabled(!this.immersive.active),this.obstacles&&this.immersive.setManipulator(this.obstacles),this.audio.resume()):this.obstacles?.setGizmoEnabled(!1))}resumeAudio(){this.audio.resume()}reset(){!this.solver||!this.sparks||(this.solver.reset(),this.sparks.reset(this.renderer),this.frame=0)}enterImmersive(){if(!this.volume)return;this.obstacles?.setGizmoEnabled(!1);let e=this.setHandSlots(!0);this.enforceLeanBudget()||e?(this.rebuild(),this.gui&&ne(this.gui)):(this.volume.update(this.params,this.frame),this.gui&&ne(this.gui)),this.immersive.setPlacement({...Qt,framedSize:be}),this.sparks&&(this.sparks.mesh.visible=!1),this.audio.resume()}exitImmersive(){this.active&&this.obstacles?.setGizmoEnabled(!0),this.setHandSlots(!1)&&this.rebuild(),this.immersive.setPlacement({...Qt}),this.sparks&&(this.sparks.mesh.visible=this.active&&this.params.sparksEnabled)}step(e,t){!this.active||!this.solver||!this.volume||!this.sparks||(this.obstacles?.update(e),this.obstacles&&this.handSolids.update(this.solver.uniforms,this.obstacles.count,this.immersive.contentRoot,this.renderer,this.immersive.active?t:void 0,e),(!this.immersive.active||this.frame%3==0)&&this.solver.step(this.immersive.active?e*3:e),this.volume.update(this.params,this.frame),this.params.sparksEnabled&&!this.immersive.active&&this.sparks.step(this.renderer,this.solver.currentParity,e,this.frame),this.tickAudio(e),this.frame++)}dispose(){window.removeEventListener(`keydown`,this.onKeyDown),this.gui?.destroy(),this.gui=null,this.audio.dispose(),this.teardownSolver(),this.noise=null,this.ready=!1,this.active=!1}mountGui(){this.gui?.destroy(),this.gui=ue(this.params,this.callbacks(),{omitDiagnosticsTools:!0}),this.active||this.setGuiVisible(!1)}callbacks(){return{onStructuralChange:()=>{this.enforceLeanBudget(),this.rebuild(),this.gui&&ne(this.gui)},onPreset:e=>{let t=this.obstacles?.count??1;this.params=M(this.params,e),this.enforceLeanBudget(),this.params.environment=`night`,this.params.backgroundIntensity=C.night,this.params.obstacleCount=Zt(t,this.handSolids.active),this.rebuild(),this.mountGui(),this.environment.set(`night`),this.environment.setIntensity(C.night),ne(this.gui)},onReset:()=>{this.enforceLeanBudget(),this.rebuild(),this.gui&&ne(this.gui)},onDetonate:()=>this.solver?.detonate(1),onProbe:()=>void 0,onProfile:()=>void 0,onQuality:e=>{this.enforceLeanBudget(),this.renderer.setPixelRatio(Math.min(window.devicePixelRatio,xe[ce.quality].pixelRatio)),this.rebuild(),ne(this.gui)},onShowGrid:()=>{},onAddObstacle:e=>this.addObstacle(e),onRemoveObstacle:()=>{this.obstacles?.selection!==null&&this.obstacles&&this.obstacles.remove(this.obstacles.selection)},onGizmoMode:e=>this.setGizmoMode(e),onEnvironment:e=>{this.params.backgroundIntensity=C[e],this.environment.setIntensity(this.params.backgroundIntensity),this.environment.set(e),ne(this.gui)}}}addObstacle(e){if(!this.obstacles)return;let t=this.params.sourcePosition.clone();t.y+=this.params.sourceLength+.45,this.obstacles.add(e,t)}enforceLeanBudget(){return z(this.params)}setHandSlots(e){return this.handSolids.active===e?!1:(this.handSolids.setEnabled(e),this.params.obstacleCount=Zt(this.obstacles?.count??1,e),!0)}placementForSession(){return{...Qt,framedSize:this.immersive.active?be:Qt.framedSize}}rebuild(){let e=this.active;this.enforceLeanBudget(),this.teardownSolver(),this.buildSolver(),this.setVisible(e),e&&(this.immersive.setDomainSize(this.params.domainSize),this.immersive.setPlacement(this.placementForSession()),this.obstacles&&this.immersive.setManipulator(this.obstacles))}buildSolver(){if(this.noise||=w(32),this.enforceLeanBudget(),this.solver=new o(this.renderer,this.params,this.noise),this.volume=new F({field:this.solver.renderField,blur:this.solver.renderBlur,solid:this.solver.fields.solid},this.params.domainSize),this.sparks=new fe({render:this.solver.renderField,solid:this.solver.fields.solid,velocity:[this.solver.state[0].vel,this.solver.state[1].vel],lut:this.volume.lut},this.solver.uniforms,this.solver.res,this.params.domainSize,Math.max(1,Math.round(this.params.sparkCount))),this.obstacles)this.obstacles.bind(this.solver.uniforms);else{if(this.obstacles=new ge(this.solver.uniforms,this.camera,this.renderer.domElement,this.onGizmoDrag,4),this.immersive.attach(this.obstacles.group),this.scene.add(this.obstacles.helper),!ve()){this.addObstacle(`sphere`);let e=this.obstacles.targets()[0];e&&(e.scale.setScalar(.6),e.position.x+=.1)}this.obstacles.setMode(this.params.gizmoMode),this.params.obstacleCount=Zt(this.obstacles.count,this.handSolids.active),this.obstacles.onCountChanged=e=>{this.params.obstacleCount=Zt(e,this.handSolids.active),this.rebuild(),this.gui&&ne(this.gui)},this.obstacles.onModeChanged=e=>{this.params.gizmoMode=e,this.gui&&ne(this.gui),this.onWorldUiChange()}}this.immersive.attach(this.volume.mesh),this.immersive.attach(this.sparks.mesh),this.audioProbes=null,this.solver.reset(),this.sparks.reset(this.renderer),this.frame=0}teardownSolver(){this.volume?.mesh.removeFromParent(),this.sparks?.mesh.removeFromParent(),this.sparks?.dispose(),this.solver?.dispose(),this.volume?.dispose(),this.solver=null,this.volume=null,this.sparks=null,this.audioProbes=null}tickAudio(e){}setGuiVisible(e){this.gui&&(this.gui.domElement.style.display=e?``:`none`)}setVisible(e){this.volume&&(this.volume.mesh.visible=e),this.sparks&&(this.sparks.mesh.visible=e&&this.params.sparksEnabled&&!this.immersive.active),this.obstacles&&(this.obstacles.group.visible=e,e||(this.obstacles.helper.visible=!1))}};function en(e){return e.kind===`spring`}function tn(e,t,n=.002){let r=mt({x:-t.positionAng.x,y:-t.positionAng.y,z:-t.positionAng.z,w:t.positionAng.w},X(e.x-t.positionLin.x,e.y-t.positionLin.y,e.z-t.positionLin.z)),i=Math.max(t.size.x*.5-n,.004),a=Math.max(t.size.y*.5-n,.004),o=Math.max(t.size.z*.5-n,.004);return Math.abs(r.x)<=i&&Math.abs(r.y)<=a&&Math.abs(r.z)<=o}function nn(e,t){let n=t.filter(e=>e.positionLin.y>-5);if(!n.length)return 0;let r=0,i=e.forces;for(;i&&r<144;){let e=i.next;if(en(i)&&i.bodyA&&i.bodyB){let e=ut(i.bodyA.positionLin,i.bodyA.positionAng,i.rA),t=ut(i.bodyB.positionLin,i.bodyB.positionAng,i.rB),a=X((e.x+t.x)*.5,(e.y+t.y)*.5,(e.z+t.z)*.5);for(let e of n)if(tn(a,e)){i.destroy(),r++;break}}i=e}return r}var rn={radiusX:.28,radiusY:.12,radiusZ:.28,y0:.04,spacing:.0254,nodeSize:.024,density:550,stretchStiffness:520,shearStiffness:200,shapeStiffness:0,tearRatio:2.8,friction:.65};function an(e,t,n,r){let i=e/r.radiusX,a=(t-r.y0)/r.radiusY,o=n/r.radiusZ;return a<0||a>1?!1:i*i+o*o+a*a<=1}function on(e,t,n){return e+512<<20|t+512<<10|n+512}function sn(e,t=rn){let{spacing:n,nodeSize:r,density:i,friction:a}=t,o=[],s=Math.ceil(t.radiusX*2/n),c=Math.ceil(t.radiusY/n),l=Math.ceil(t.radiusZ*2/n);for(let u=0;u<=l;u++)for(let l=0;l<=c;l++)for(let c=0;c<=s;c++){let s=-t.radiusX+c*n,d=t.y0+l*n,f=-t.radiusZ+u*n;if(!an(s,d,f,t))continue;let p=l===0,m=new dt(e,X(r,r,r),p?0:i,a,X(s,d,f));m.soft=!0,p&&(m.kinematic=!0),o.push(m)}let u=X();for(let e of o)u.x+=e.restLin.x,u.y+=e.restLin.y,u.z+=e.restLin.z;let d=1/Math.max(o.length,1);u.x*=d,u.y*=d,u.z*=d;let f=[];if(t.shapeStiffness>0)for(let n of o)n.mass<=0||f.push(new pt(e,n,{...n.restLin},t.shapeStiffness));let p=[],m=n*1.12,h=n*1.75,g=m*m,_=h*h,v=1/n,y=new Map;for(let e=0;e<o.length;e++){let t=o[e].positionLin,n=on(Math.floor(t.x*v),Math.floor(t.y*v),Math.floor(t.z*v)),r=y.get(n);r||(r=[],y.set(n,r)),r.push(e)}let b=new Set,x=(e,t)=>e<t?e*1000003+t:t*1000003+e;for(let n=0;n<o.length;n++){let r=o[n],i=Math.floor(r.positionLin.x*v),a=Math.floor(r.positionLin.y*v),s=Math.floor(r.positionLin.z*v);for(let c=-1;c<=1;c++)for(let l=-1;l<=1;l++)for(let u=-1;u<=1;u++){let d=y.get(on(i+u,a+l,s+c));if(d)for(let i of d){if(i<=n)continue;let a=x(n,i);if(b.has(a))continue;let s=o[i],c=r.positionLin.x-s.positionLin.x,l=r.positionLin.y-s.positionLin.y,u=r.positionLin.z-s.positionLin.z,d=c*c+l*l+u*u;if(d>_||d<1e-10)continue;b.add(a);let f=Math.sqrt(d),m=d<=g?t.stretchStiffness:t.shearStiffness,h=new ft(e,r,s,X(),X(),m,f);h.tearRatio=t.tearRatio,p.push(h)}}}return{nodes:o,goals:f,springs:p,springCount:p.length,restCom:u}}function cn(e,t,n){if(!e.length||!t.length)return;let r=X(),i=0;for(let t of e)t.mass<=0||(r.x+=t.positionLin.x,r.y+=t.positionLin.y,r.z+=t.positionLin.z,i++);if(i===0)return;let a=1/i;r.x*=a,r.y*=a,r.z*=a;for(let e of t){let t=e.bodyA;t&&(e.goal.x=r.x+(t.restLin.x-n.x),e.goal.y=r.y+(t.restLin.y-n.y),e.goal.z=r.z+(t.restLin.z-n.z))}}var ln=1,un={distance:.48,height:.88,framedSize:.42,turntable:!1},dn=48,fn=8,pn={x:0,y:0,z:0,w:1},mn=new ke;function hn(e,t=0){let n=new $e;return n.colorNode=G(G(u(e),u(16777215),B.y.mul(.18).add(.06)),u(13935988),T(t)),n.depthWrite=!0,n}var gn=class{immersive;root=new Ue;solver=new lt;visuals=[];handBodies=[];colliderBodies=[];softNodes=[];softLiveNodes=[];softGoals=[];softRestCom=X();softInstances=null;sceneId=`soft`;active=!1;ready=!1;floorMesh=null;_springCount=0;lastStepMs=0;lastCutCount=0;constructor(e){this.immersive=e,this.solver.iterations=8,this.solver.gravity=-12}get isReady(){return this.ready}get isActive(){return this.active}get bodyCount(){return this.sceneId===`soft`?this.softLiveNodes.length:this.solver.bodyList.filter(e=>e.mass>0).length}get springCount(){return this._springCount}get iterations(){return this.solver.iterations}get currentScene(){return this.sceneId}softCom(){let e={x:0,y:0,z:0},t=this.softLiveNodes.length;if(!t)return e;for(let t of this.softLiveNodes)e.x+=t.positionLin.x,e.y+=t.positionLin.y,e.z+=t.positionLin.z;let n=1/t;return e.x*=n,e.y*=n,e.z*=n,e}init(){this.ready||=(this.immersive.attach(this.root),this.root.visible=!1,this.loadScene(`soft`),!0)}setActive(e){this.ready&&(this.active=e,this.root.visible=e,e&&(this.immersive.setDomainSize(ln),this.immersive.setPlacement({...un})))}reset(){this.loadScene(this.sceneId)}setScene(e){this.sceneId=e,this.loadScene(e)}cycleScene(){let e=[`soft`,`stack`,`pyramid`,`springs`],t=e.indexOf(this.sceneId);this.setScene(e[(t+1)%e.length])}prepareBench(){this.setScene(`soft`),this.solver.iterations=8}step(e,t){let n=performance.now();if(this.solver.dt=Math.min(Math.max(e,1/240),1/30),this.syncKinematicForces(t),this.sceneId===`soft`){this.softGoals.length&&cn(this.softNodes,this.softGoals,this.softRestCom);let e=[...this.handBodies,...this.colliderBodies],t=nn(this.solver,e);this.lastCutCount=t,t>0&&(this._springCount=Math.max(0,this._springCount-t))}else this.lastCutCount=0;this.solver.step(),this.sceneId===`soft`&&(this.separateSoftFromKinematics(),this.clampSoftFloor()),this.active&&this.syncMeshes(),this.lastStepMs=performance.now()-n}separateSoftFromKinematics(){let e=[...this.handBodies,...this.colliderBodies].filter(e=>e.positionLin.y>-5);if(e.length){for(let t of this.softNodes)if(!(t.mass<=0))for(let n of e){let e=n.positionAng,r=mt({x:-e.x,y:-e.y,z:-e.z,w:e.w},X(t.positionLin.x-n.positionLin.x,t.positionLin.y-n.positionLin.y,t.positionLin.z-n.positionLin.z)),i=n.size.x*.5+t.size.x*.4,a=n.size.y*.5+t.size.y*.4,o=n.size.z*.5+t.size.z*.4;if(Math.abs(r.x)>i||Math.abs(r.y)>a||Math.abs(r.z)>o)continue;let s=i-Math.abs(r.x),c=a-Math.abs(r.y),l=o-Math.abs(r.z),u=X(),d=0;s<=c&&s<=l?(d=s,u=X(Math.sign(r.x)||1,0,0)):c<=l?(d=c,u=X(0,Math.sign(r.y)||1,0)):(d=l,u=X(0,0,Math.sign(r.z)||1));let f=mt(e,u),p=Math.min(d,.045);t.positionLin.x+=f.x*p,t.positionLin.y+=f.y*p,t.positionLin.z+=f.z*p;let m=t.velocityLin.x*f.x+t.velocityLin.y*f.y+t.velocityLin.z*f.z;m<0&&(t.velocityLin.x-=f.x*m,t.velocityLin.y-=f.y*m,t.velocityLin.z-=f.z*m)}}}clampSoftFloor(){let e=Math.max(rn.nodeSize*.5,rn.y0*.5),t=e+rn.spacing*.85;for(let n of this.softLiveNodes)n.positionLin.y<e&&(n.positionLin.y=e,n.velocityLin.y<0&&(n.velocityLin.y*=-.05)),n.positionLin.y<=t&&(n.velocityLin.x*=.82,n.velocityLin.z*=.82,Math.abs(n.velocityLin.x)<1e-4&&(n.velocityLin.x=0),Math.abs(n.velocityLin.z)<1e-4&&(n.velocityLin.z=0))}dispose(){this.clearVisuals(),this.solver.clear(),this.root.removeFromParent(),this.ready=!1,this.active=!1}loadScene(e){if(this.clearVisuals(),this.solver.clear(),this.handBodies.length=0,this.colliderBodies.length=0,this.softNodes=[],this.softLiveNodes=[],this.softGoals=[],this.softRestCom=X(),this.clearSoftInstances(),this.sceneId=e,this._springCount=0,this.solver.softBodyMode=e===`soft`,this.solver.iterations=8,this.solver.gravity=e===`soft`?-6:-12,e!==`soft`){let e=new dt(this.solver,X(2.4,.08,2.4),0,.55,X(0,-.04,0));this.attachVisual(e,2764856,!1,`box`)}if(this.ensureFloorProp(),e===`soft`){let e=sn(this.solver,rn);this._springCount=e.springCount,this.softNodes=e.nodes,this.softLiveNodes=e.nodes.filter(e=>e.mass>0),this.softGoals=e.goals,this.softRestCom=e.restCom,this.buildSoftInstances(this.softLiveNodes)}else if(e===`stack`)for(let e=0;e<8;e++){let t=.12,n=new dt(this.solver,X(t,t,t),1.2,.45,X(e%2*.01,.06+e*.128,e%3*.008));this.attachVisual(n,12093786+e*262656,!0,`box`)}else if(e===`pyramid`){let e=.1,t=.06;for(let n=0;n<5;n++)for(let r=0;r<5-n;r++){let i=new dt(this.solver,X(e,t,.1),1,.5,X(r*.10400000000000001+n*e*.5-5*e/2,t*.5+n*.064,0));this.attachVisual(i,9083824,!0,`box`)}}else{let e=new dt(this.solver,X(.08,.08,.08),0,.5,X(-.25,.55,0));this.attachVisual(e,5593958,!1,`box`);let t=e;for(let e=0;e<6;e++){let n=new dt(this.solver,X(.07,.07,.07),1,.4,X(-.25+(e+1)*.09,.55,0));this.attachVisual(n,7317704,!0,`box`),new ft(this.solver,t,n,X(.04,0,0),X(-.04,0,0),e%2==0?40:400,.09),this._springCount++,t=n}let n=new dt(this.solver,X(.16,.16,.16),2.5,.4,X(.4,.55,0));this.attachVisual(n,12876634,!0,`box`),new ft(this.solver,t,n,X(.04,0,0),X(-.08,0,0),80,.12),this._springCount++}for(let e=0;e<dn;e++){let e=new dt(this.solver,X(.04,.04,.04),0,.8,X(0,-10,0));e.kinematic=!0,this.handBodies.push(e),this.attachVisual(e,13935988,!1,`box`,!0)}for(let e=0;e<fn;e++){let e=new dt(this.solver,X(.12,.12,.12),0,.7,X(0,-10,0));e.kinematic=!0,this.colliderBodies.push(e),this.attachVisual(e,8029332,!1,`box`,!0)}}ensureFloorProp(){if(this.floorMesh)return;let e=new Qe(new Oe(ln,.02,ln),hn(1711396));e.position.set(0,-.01,0),this.root.add(e),this.floorMesh=e}attachVisual(e,t,n,r,i=!1){let a=new Qe(r===`sphere`?new nt(.5,14,10):new Oe(1,1,1),hn(t));a.scale.set(e.size.x,e.size.y,e.size.z),a.visible=!i,this.root.add(a),e.userData=a,this.visuals.push({body:e,mesh:a,dynamic:n})}buildSoftInstances(e){let t=new Ne(new nt(.5,8,6),hn(4045422),e.length);t.frustumCulled=!1;let n=rn.nodeSize;for(let r=0;r<e.length;r++){let i=e[r].positionLin;mn.position.set(i.x,i.y,i.z),mn.scale.set(n,n,n),mn.quaternion.identity(),mn.updateMatrix(),t.setMatrixAt(r,mn.matrix)}t.instanceMatrix.needsUpdate=!0,this.root.add(t),this.softInstances=t}clearSoftInstances(){this.softInstances&&=(this.root.remove(this.softInstances),this.softInstances.geometry.dispose(),this.softInstances.material.dispose(),null)}clearVisuals(){this.clearSoftInstances();for(let e of this.visuals)this.root.remove(e.mesh),e.mesh.geometry.dispose(),e.mesh.material.dispose();this.visuals.length=0}syncMeshes(){if(this.softInstances&&this.softLiveNodes.length){let e=this.softInstances,t=rn.nodeSize;for(let n=0;n<this.softLiveNodes.length;n++){let r=this.softLiveNodes[n].positionLin;mn.position.set(r.x,r.y,r.z),mn.scale.set(t,t,t),mn.quaternion.identity(),mn.updateMatrix(),e.setMatrixAt(n,mn.matrix)}e.instanceMatrix.needsUpdate=!0}for(let e of this.visuals){let t=e.body;if(t.kinematic&&t.positionLin.y<-5){e.mesh.visible=!1;continue}e.mesh.visible=!0,e.mesh.position.set(t.positionLin.x,t.positionLin.y,t.positionLin.z),e.mesh.quaternion.set(t.positionAng.x,t.positionAng.y,t.positionAng.z,t.positionAng.w),e.mesh.scale.set(t.size.x,t.size.y,t.size.z)}}parkBody(e){e.positionLin=X(0,-10,0),e.velocityLin=X(),e.prevVelocityLin=X()}forceToWorld(e){let t=X((e.x-.5)*ln,e.y*ln,(e.z-.5)*ln);if(e.isCapsule){let n=Math.max((e.radius>0?e.radius:e.hy)*ln,.01);return{p:t,size:X(e.hx*2*ln,n*2,n*2),quat:_n(e)}}if(e.isBox)return{p:t,size:X(e.hx*2*ln,e.hy*2*ln,e.hz*2*ln),quat:_n(e)};let n=Math.max(e.radius*2*ln,.03);return{p:t,size:X(n,n,n),quat:{x:0,y:0,z:0,w:1}}}syncKinematicForces(e){let t=new Uint8Array(this.handBodies.length),n=new Uint8Array(this.colliderBodies.length),r=0,i=0,a=this.solver.dt>1e-6?1/this.solver.dt:0,o=1.8;for(let s of e){if(s.strength===0&&!s.isBox&&!s.isCapsule&&s.radius<=0)continue;let{p:e,size:c,quat:l}=this.forceToWorld(s),u=s.isBox||s.isCapsule,d=u?this.handBodies:this.colliderBodies,f=u?t:n,p=u?r++:i++;if(p>=d.length)continue;let m=d[p];f[p]=1;let h=m.positionLin,g=h.y<-5;if(m.positionLin=e,m.positionAng={...l},m.size=c,m.radius=Math.hypot(c.x,c.y,c.z)*.5,g)m.velocityLin=X();else{let t=(e.x-h.x)*a,n=(e.y-h.y)*a,r=(e.z-h.z)*a,i=Math.hypot(t,n,r);if(i>o&&i>1e-8){let e=o/i;t*=e,n*=e,r*=e}m.velocityLin=X(t,n,r)}m.prevVelocityLin={...m.velocityLin}}for(let e=0;e<this.handBodies.length;e++)t[e]||this.parkBody(this.handBodies[e]);for(let e=0;e<this.colliderBodies.length;e++)n[e]||this.parkBody(this.colliderBodies[e])}};function _n(e){let t=e.ax,n=e.bx,r=e.cx,i=e.ay,a=e.by,o=e.cy,s=e.az,c=e.bz,l=e.cz,u=t+a+l;if(u>0){let e=Math.sqrt(u+1)*2;pn.w=.25*e,pn.x=(c-o)/e,pn.y=(r-s)/e,pn.z=(i-n)/e}else if(t>a&&t>l){let e=Math.sqrt(1+t-a-l)*2;pn.w=(c-o)/e,pn.x=.25*e,pn.y=(n+i)/e,pn.z=(r+s)/e}else if(a>l){let e=Math.sqrt(1+a-t-l)*2;pn.w=(r-s)/e,pn.x=(n+i)/e,pn.y=.25*e,pn.z=(o+c)/e}else{let e=Math.sqrt(1+l-t-a)*2;pn.w=(i-n)/e,pn.x=(r+s)/e,pn.y=(o+c)/e,pn.z=.25*e}return{...pn}}var vn=`kora.debug.avbd`;if(typeof window<`u`)try{localStorage.removeItem(vn)}catch{}function yn(e){return typeof window>`u`?null:new URLSearchParams(window.location.search).get(e)}var bn=1e4,xn=.95,Sn=.99;function Cn(e){e.setSubsteps(1),e.setSolverIterations(10),e.setAvbdDualUpdateBeta(bn),e.setAvbdRegularizationAlpha(xn),e.setAvbdPenaltyDecayGamma(Sn),e.setAvbdPairSweeps(1),e.setAvbdPreventPenetratingNormalDropout(!1),e.setAvbdPenaltyFloor(1),e.setAvbdBodySolveMode(`colored`)}var Z=((e,t,n)=>Te(e,t,n)),wn=64;function Tn(e,t,n){let{count:r,halfExtents:i}=n,o=n.layout??`random`,s=n.spawnArea??{x:[-5,5],y:[2,20],z:[-5,5]},c=n.column??{x:0,z:0,startY:2,spacing:i[1]*2+.05,offsetXPerLevel:0,offsetZPerLevel:0},u=n.pyramid??{x:0,z:0,startY:i[1],layers:6,spacing:.02},d=n.pyramidWall??{x:0,z:0,startY:i[1],layers:8,stepX:i[0]*2+.03,stepY:i[1]*2*.85},f=n.grid??{x:0,z:0,startY:i[1],sizeX:10,sizeY:10,sizeZ:10,spacing:.02,stacksX:1,stacksZ:1,stackSpacingX:0,stackSpacingZ:0},[m,h,g]=i,_=Math.max(1,Math.floor(u.layers)),v=m*2+u.spacing,b=g*2+u.spacing,x=h*2+u.spacing,S=Math.max(1,Math.floor(d.layers)),C=d.stepX??m*2+.03,w=d.stepY??h*2*.85,E=Math.max(1,Math.floor(f.sizeX)),D=Math.max(1,Math.floor(f.sizeY)),O=Math.max(1,Math.floor(f.sizeZ)),k=m*2+f.spacing,A=h*2+f.spacing,j=g*2+f.spacing,M=Math.max(1,Math.floor(f.stacksX??1)),N=Math.max(1,Math.floor(f.stacksZ??1)),P=E*k+(f.stackSpacingX??0),F=O*j+(f.stackSpacingZ??0),I=Math.floor(_*(_+1)*(2*_+1)/6),L=Math.floor(S*(S+1)/2),R=n.randomRotation??o===`random`,z=Math.max(n.rotationJitter??.08,0),V=Math.min(Math.max(n.initialCount??r,0),r),H={enabled:n.emitter?.enabled??!1,rate:Math.max(n.emitter?.rate??24,0),x:c.x,y:c.startY,z:c.z,randomRotation:R,rotationJitter:z},ee=new Oe(m*2,h*2,g*2),ne=new Xe;ne.color.setHex(14708768),ne.roughness=.6,ne.metalness=.1;let re=new Ne(ee,ne,r);re.castShadow=!0,re.receiveShadow=!0,re.frustumCulled=!1,re.count=0,e.add(re);let U=new $e;U.color.setHex(1118481),U.wireframe=!0,U.transparent=!0,U.opacity=.55,U.depthWrite=!1;let ie=new Ne(ee,U,r);ie.frustumCulled=!1,ie.count=0,ie.renderOrder=1,e.add(ie);let ae=new Float32Array(r*4),oe=new q(ae,4),se=new et(r,4),ce=new et(r,4),le=null,ue=new Le,de=new st,fe=0,G=0,pe=!1,me=(e,n,i,a)=>{if(fe>=r||t.getBodyCount()>=t.config.maxBodies)return!1;let o=t.addBody({position:e,quaternion:n,mass:1,halfExtents:[m,h,g],linearVelocity:i,angularVelocity:a});return ae[fe*4+0]=o,oe.needsUpdate=!0,fe++,re.count=fe,ie.count=fe,!0},he=e=>{if(H.randomRotation){if(e||o===`column`){let e=Math.max(H.rotationJitter,0);de.set(J.randFloatSpread(e*2),J.randFloatSpread(e*2),J.randFloatSpread(e*2))}else de.set(Math.random()*Math.PI*2,Math.random()*Math.PI*2,Math.random()*Math.PI*2);ue.setFromEuler(de)}else ue.set(0,0,0,1);return[ue.x,ue.y,ue.z,ue.w]},ge=()=>{let e=0,t=0,n=0;if(o===`column`){let r=fe,i=c.offsetXPerLevel??0,a=c.offsetZPerLevel??0;e=c.x+r*i,t=c.startY+r*c.spacing,n=c.z+r*a}else if(o===`pyramid`){let r=fe,i=0,a=_;for(;a>0;){let e=a*a;if(r<e)break;r-=e,i++,a--}if(a<=0){let r=fe-I;e=u.x,n=u.z,t=u.startY+_*x+r*x}else{let o=r%a,s=Math.floor(r/a),c=(a-1)*.5;e=u.x+(o-c)*v,n=u.z+(s-c)*b,t=u.startY+i*x}}else if(o===`pyramid-wall`){let r=fe,i=0,a=S;for(;a>0&&!(r<a);)r-=a,i++,a--;if(a<=0){let r=fe-L;e=d.x,n=d.z,t=d.startY+S*w+r*(h*2+.03)}else e=d.x+r*C+.5*C*i-.5*C*S,t=d.startY+i*w,n=d.z}else if(o===`grid`){let r=E*D*O,i=M*N*r,a=Math.floor(fe/i),o=fe-a*i,s=Math.floor(o/r),c=o-s*r,l=s%M,u=Math.floor(s/M),d=E*O,p=Math.floor(c/d),m=c-p*d,h=Math.floor(m/E),g=m-h*E,_=(E-1)*.5,v=(O-1)*.5,y=(M-1)*.5,b=(N-1)*.5;e=f.x+(l-y)*P+(g-_)*k,n=f.z+(u-b)*F+(h-v)*j,t=f.startY+(a*D+p)*A}else e=J.randFloat(s.x[0],s.x[1]),t=J.randFloat(s.y[0],s.y[1]),n=J.randFloat(s.z[0],s.z[1]);let r=he(!1);return me([e,t,n],r,void 0,void 0)},_e=()=>{let e=he(!0);return me([H.x,H.y,H.z],e,void 0,void 0)},ve=(e=1)=>{let t=Math.max(0,Math.floor(e)),n=0;for(let e=0;e<t&&ge();e++)n++;return n},ye=(e=1)=>{let t=Math.max(0,Math.floor(e)),n=0;for(let e=0;e<t&&_e();e++)n++;return n};return V>0&&ve(V),{instancedMesh:re,syncVisuals(e,t){let n=e.getRenderBuffers();if(n){if(!pe){le=l(`
          fn compute(
            positions: ptr<storage, array<vec4f>, read>,
            quaternions: ptr<storage, array<vec4f>, read>,
            bodyIndices: ptr<storage, array<vec4f>, read>,
            outPositions: ptr<storage, array<vec4f>, read_write>,
            outQuaternions: ptr<storage, array<vec4f>, read_write>,
            instanceCount: u32,
            workgroupId: vec3u,
            localId: vec3u,
          ) -> void {
            let gid = workgroupId.x * ${wn}u + localId.x;
            if (gid >= instanceCount) { return; }
            let body = u32(bodyIndices[gid].x);
            outPositions[gid] = positions[body];
            outQuaternions[gid] = quaternions[body];
          }
        `)({positions:Z(n.positions,`vec4f`,e.config.maxBodies).toReadOnly(),quaternions:Z(n.quaternions,`vec4f`,e.config.maxBodies).toReadOnly(),bodyIndices:Z(oe,`vec4f`,r).toReadOnly(),outPositions:Z(se,`vec4f`,r),outQuaternions:Z(ce,`vec4f`,r),instanceCount:T(0),workgroupId:p,localId:W}).computeKernel([wn,1,1]).setName(`Box Spawner Pose Gather`);let t=Z(se,`vec4`,r).toAttribute().xyz,i=Z(ce,`vec4`,r).toAttribute(),o=i.xyz,s=i.w,c=e=>{let t=o.cross(e).mul(2);return e.add(t.mul(s)).add(o.cross(t))};ne.positionNode=c(te).add(t),ne.normalNode=y(a(c(B)).normalize(),`vSpawnerBodyNormalView`),ne.needsUpdate=!0,U.positionNode=c(te.mul(1.002)).add(t),U.needsUpdate=!0,pe=!0}!t||fe===0||(le.computeNode.parameters.instanceCount.value=fe,t.compute(le,[Math.ceil(fe/wn),1,1]))}},update(e){if(!H.enabled||H.rate<=0||fe>=r)return;G+=Math.max(0,e)*H.rate;let t=Math.floor(G);t<=0||(G-=t,(ye(t)<t||fe>=r)&&(H.enabled=!1,G=0))},emit(e=1){return ye(e)},shoot(e){let t=new Y(e.direction[0],e.direction[1],e.direction[2]);if(t.lengthSq()<1e-8)return!1;t.normalize();let n=Math.max(e.speedJitter??0,0),r=Math.max(e.averageSpeed,0),i=Math.max(0,r+J.randFloatSpread(n*2)),a=t.multiplyScalar(i),o=Math.max(e.angularJitter??0,0),s=[J.randFloatSpread(o*2),J.randFloatSpread(o*2),J.randFloatSpread(o*2)];return me(e.position,[0,0,0,1],[a.x,a.y,a.z],s)},getSpawnedCount(){return fe},getCapacity(){return r},getEmitter(){return{...H}},setEmitter(e){e.enabled!==void 0&&(H.enabled=e.enabled),e.rate!==void 0&&(H.rate=Math.max(0,e.rate)),e.x!==void 0&&(H.x=e.x),e.y!==void 0&&(H.y=e.y),e.z!==void 0&&(H.z=e.z),e.randomRotation!==void 0&&(H.randomRotation=e.randomRotation),e.rotationJitter!==void 0&&(H.rotationJitter=Math.max(0,e.rotationJitter))},dispose(){e.remove(re),e.remove(ie),re.removeFromParent(),ie.removeFromParent(),re.dispose(),ie.dispose(),ee.dispose(),ne.dispose(),U.dispose()}}}var En=64,Dn=[.5,.82,.28],On=[-.692,.353,-.63],kn=[.42,.47,.58],An=[.2,.17,.15],jn=[1,.96,.88],Mn=[.35,.45,.62];function Nn(e,t,r){let{capacity:i}=r,a=r.outlineScale??1.002,o=r.showOutline??!0,s=r.castShadow??!0,c=r.receiveShadow??!0,f=r.perInstance===!0,m=r.geometry===void 0,h=f&&m,g=r.geometry??new Oe(h?1:(r.halfExtents?.[0]??.5)*2,h?1:(r.halfExtents?.[1]??.5)*2,h?1:(r.halfExtents?.[2]??.5)*2),_=r.roughness??.7,v=r.metalness??0,b=8+(1-_)**2*120,x=.05+(1-_)*.25,S=new $e;S.color.setHex(r.color);let C=new Ne(g,S,i);C.castShadow=s,C.receiveShadow=c,C.frustumCulled=!1,C.count=0,e.add(C);let w=new $e;w.color.setHex(1118481),w.wireframe=!0,w.transparent=!0,w.opacity=.5,w.depthWrite=!1;let E=new Ne(g,w,i);E.frustumCulled=!1,E.count=0,E.renderOrder=1,o&&e.add(E);let D=new Float32Array(i*4),O=new q(D,4),k=new et(i,4),j=new et(i,4),M=h?new Float32Array(i*4):null,P=f?new Float32Array(i*4):null,F=M?new et(M,4):null,I=P?new et(P,4):null,L=new Ze,z=0,V=!1,ee=null;return{addBody(e,t){if(z>=i)throw Error(`Tracked body visual capacity exceeded (${i})`);D[z*4+0]=e,O.needsUpdate=!0;let n=z*4;if(M){let e=t?.halfExtents??r.halfExtents??[.5,.5,.5];M[n+0]=e[0],M[n+1]=e[1],M[n+2]=e[2],F.needsUpdate=!0}P&&(L.setHex(t?.color??r.color),P[n+0]=L.r,P[n+1]=L.g,P[n+2]=L.b,I.needsUpdate=!0),z++,C.count=z,o&&(E.count=z)},syncVisuals(e,s){let c=e.getRenderBuffers();if(c){if(!V){ee=l(`
          fn compute(
            positions: ptr<storage, array<vec4f>, read>,
            quaternions: ptr<storage, array<vec4f>, read>,
            bodyIndices: ptr<storage, array<vec4f>, read>,
            outPositions: ptr<storage, array<vec4f>, read_write>,
            outQuaternions: ptr<storage, array<vec4f>, read_write>,
            instanceCount: u32,
            workgroupId: vec3u,
            localId: vec3u,
          ) -> void {
            let gid = workgroupId.x * ${En}u + localId.x;
            if (gid >= instanceCount) { return; }
            let body = u32(bodyIndices[gid].x);
            outPositions[gid] = positions[body];
            outQuaternions[gid] = quaternions[body];
          }
        `)({positions:Z(c.positions,`vec4f`,t.config.maxBodies).toReadOnly(),quaternions:Z(c.quaternions,`vec4f`,t.config.maxBodies).toReadOnly(),bodyIndices:Z(O,`vec4f`,i).toReadOnly(),outPositions:Z(k,`vec4f`,i),outQuaternions:Z(j,`vec4f`,i),instanceCount:T(0),workgroupId:p,localId:W}).computeKernel([En,1,1]).setName(`Tracked Body Pose Gather`);let e=Z(k,`vec4`,i).toAttribute().xyz,s=Z(j,`vec4`,i).toAttribute(),f=s.xyz,m=s.w,h=e=>{let t=f.cross(e).mul(2);return e.add(t.mul(m)).add(f.cross(t))},g=F?Z(F,`vec4`,i).toAttribute().xyz:null,_=g?te.mul(g.mul(2)):te,C=g?H(B.div(g)):B,E=h(_).add(e);S.positionNode=E;let D=y(R.mul(ae(E,1)).xyz),M=y(H(R.mul(ae(h(C),0)).xyz)),P=I?Z(I,`vec4`,i).toAttribute().xyz:u(r.color),L=H(d.sub(D)),z=n(...Dn),ne=G(n(...An),n(...kn),M.y.mul(.5).add(.5)),re=n(...jn).mul(U(M.dot(z),A(0))),ie=n(...Mn).mul(U(M.dot(n(...On)),A(0))),oe=P.mul(ne.mul(.65).add(re.mul(.85)).add(ie.mul(.4))),se=H(z.add(L)),ce=N(U(M.dot(se),A(0)),A(b)).mul(x),le=G(n(1,1,1),P,v),ue=n(...kn).mul(N(pe(U(M.dot(L),A(0))),A(3)).mul(.14));S.colorNode=oe.add(le.mul(ce)).add(ue),S.needsUpdate=!0,o&&(w.positionNode=h(_.mul(a)).add(e),w.needsUpdate=!0),V=!0}!s||z===0||(ee.computeNode.parameters.instanceCount.value=z,s.compute(ee,[Math.ceil(z/En),1,1]))}},dispose(){e.remove(C),o&&e.remove(E),C.dispose(),E.dispose(),S.dispose(),w.dispose(),m&&g.dispose()}}}var Pn=_(([e])=>e.dot(se(127.1,311.7)).sin().mul(43758.5453).fract()),Fn=_(([e])=>{let t=se(e.x.floor(),e.y.floor()),n=S(e),r=n.mul(n).mul(n.mul(-2).add(3));return G(G(Pn(t),Pn(t.add(se(1,0))),r.x),G(Pn(t.add(se(0,1))),Pn(t.add(se(1,1))),r.x),r.y)}),In=_(([e])=>Fn(e).mul(.55).add(Fn(e.mul(2.3)).mul(.28)).add(Fn(e.mul(5.7)).mul(.17)));function Ln(e,t,n){let r=e.div(t).add(.5).fract().sub(.5).abs().mul(t);return pe(Ee(A(0),A(n),r))}function Rn(e,t){let n=[(e>>16&255)/255,(e>>8&255)/255,(e&255)/255],r=Math.max(...n,.001);return n.map(e=>1-t+t*e/r)}function zn(e){let t=new Xe,[r,,i]=e.halfExtents,a=n(...Rn(e.color??16777215,.3)),o=te,s=Ee(A(.4),A(.9),B.y),c=In(se(o.x,o.z).mul(.9)),l=G(In(se(o.x.add(o.z),o.y).mul(1.4)),c,s),u=U(Ln(o.x,4,.05),Ln(o.z,4,.05)),d=G(Ln(o.y,1.6,.04),u,s),p=n(.84,.84,.82),m=G(n(.52,.52,.51),p,l).mul(a);m=m.mul(pe(d.mul(.35)));let h=G(A(.95),A(.78),l);if(e.markings){let e=P(A(r).sub(f(o.x)),A(i).sub(f(o.z))),t=Ee(A(.45),A(.6),e).mul(pe(Ee(A(1),A(1.15),e))).mul(s);m=G(m,n(.85,.68,.13),t.mul(.85)),h=G(h,A(.5),t)}return t.colorNode=m,t.roughnessNode=h,t.metalnessNode=A(0),t}var Bn=x(`
      const SPRING_RECORD_META_OFFSET: u32 = 0u;
      const SPRING_RECORD_ANCHOR_A_OFFSET: u32 = 1u;
      const SPRING_RECORD_ANCHOR_B_OFFSET: u32 = 2u;
      const SPRING_RECORD_VEC4S: u32 = 3u;

      fn springRecordBase(springIndex: u32) -> u32 {
        return springIndex * SPRING_RECORD_VEC4S;
      }

      fn loadSpringMetaWords(
        springRecords: ptr<storage, array<vec4f>, read_write>,
        springIndex: u32,
      ) -> vec4u {
        return bitcast<vec4u>(springRecords[springRecordBase(springIndex) + SPRING_RECORD_META_OFFSET]);
      }

      fn storeSpringMetaWords(
        springRecords: ptr<storage, array<vec4f>, read_write>,
        springIndex: u32,
        value: vec4u,
      ) {
        springRecords[springRecordBase(springIndex) + SPRING_RECORD_META_OFFSET] = bitcast<vec4f>(value);
      }

      fn loadSpringAnchorARest(
        springRecords: ptr<storage, array<vec4f>, read_write>,
        springIndex: u32,
      ) -> vec4f {
        return springRecords[springRecordBase(springIndex) + SPRING_RECORD_ANCHOR_A_OFFSET];
      }

      fn storeSpringAnchorARest(
        springRecords: ptr<storage, array<vec4f>, read_write>,
        springIndex: u32,
        value: vec4f,
      ) {
        springRecords[springRecordBase(springIndex) + SPRING_RECORD_ANCHOR_A_OFFSET] = value;
      }

      fn loadSpringAnchorBStiffness(
        springRecords: ptr<storage, array<vec4f>, read_write>,
        springIndex: u32,
      ) -> vec4f {
        return springRecords[springRecordBase(springIndex) + SPRING_RECORD_ANCHOR_B_OFFSET];
      }

      fn storeSpringAnchorBStiffness(
        springRecords: ptr<storage, array<vec4f>, read_write>,
        springIndex: u32,
        value: vec4f,
      ) {
        springRecords[springRecordBase(springIndex) + SPRING_RECORD_ANCHOR_B_OFFSET] = value;
      }
`);function Vn(e){return e*12}function Hn(e,t){return Vn(e)+t*4}var Un=4294967295;function Wn(t,r){let i=Math.max(1,r.capacity),a=r.radius??.045,o=new Ie(1,1,1,8,1,!0),s=new $e;s.color.setHex(r.color??13226457),s.transparent=!0,s.opacity=.9,s.depthWrite=!1;let c=new Ne(o,s,i);c.count=0,c.frustumCulled=!1,c.renderOrder=2,t.add(c);let l=new Uint32Array(i),u=new q(l,1),d=0,f=!1;return{addSpring(e){if(d>=i)throw Error(`Tracked spring visual capacity exceeded (${i})`);l[d]=e>>>0,u.needsUpdate=!0,d++,c.count=d},syncVisuals(t){if(f)return;let r=t.getSpringRenderBuffers();if(!r)return;let o=Te(r.positions,`vec4`,t.config.maxBodies).toReadOnly(),c=Te(r.quaternions,`vec4`,t.config.maxBodies).toReadOnly(),l=Te(r.springRecords,`vec4`,r.maxSprings*3).toReadOnly(),d=Te(u,`uint`,i).toReadOnly(),p=e,m=d.element(p).mul(K(3)),h=l.element(m.add(K(0))),g=l.element(m.add(K(1))),_=l.element(m.add(K(2))),v=K(k(h.x)),y=K(k(h.y)),b=K(k(h.z)).greaterThan(K(0)),x=v.equal(K(Un)),S=Se(x,K(0),v),C=o.element(S).xyz,w=o.element(y).xyz,T=Se(x,ae(0,0,0,1),c.element(S)),E=c.element(y),D=(e,t)=>{let n=t.xyz,r=t.w,i=n.cross(e).mul(2);return e.add(i.mul(r)).add(n.cross(i))},O=Se(x,g.xyz,C.add(D(g.xyz,T))),j=w.add(D(_.xyz,E)),M=n(0,-1e6,0),N=j.sub(O),P=N.length().max(A(1e-8)),F=N.div(P),I=Se(F.y.abs().greaterThan(A(.95)),n(1,0,0),n(0,1,0)).cross(F).normalize(),L=F.cross(I).normalize(),R=O.add(j).mul(.5),z=Se(b,A(a),A(0)),B=te.y.mul(Se(b,P,A(0))),V=I.mul(te.x.mul(z)).add(F.mul(B)).add(L.mul(te.z.mul(z))),H=Se(b,R.add(V),M);s.positionNode=H,s.needsUpdate=!0,f=!0},dispose(){t.remove(c),c.dispose(),o.dispose(),s.dispose()}}}var Gn=.75,Kn=.75,qn=5e-4;function Jn(e,t,n){return t*n+e}function Yn(e){let{scene:t,physics:r,clothBodyIds:i,dims:o,color:s,subdivisions:c}=e,{cols:l,rows:u}=o,d=(l-1)*c+1,f=(u-1)*c+1,p=(e,t)=>t*d+e,m=d*f,h=new Float32Array(m*3),g=new Float32Array(m*3),_=new Float32Array(m*2),v=new Float32Array(m),b=new Float32Array(m),x=[];for(let e=0;e<f;e++)for(let t=0;t<d;t++){let n=p(t,e),r=t/c,i=e/c;h[n*3+0]=0,h[n*3+1]=0,h[n*3+2]=0,g[n*3+0]=0,g[n*3+1]=1,g[n*3+2]=0,_[n*2+0]=t/Math.max(1,d-1),_[n*2+1]=e/Math.max(1,f-1),v[n]=r,b[n]=i}for(let e=0;e<f-1;e++)for(let t=0;t<d-1;t++){let n=p(t,e),r=p(t+1,e),i=p(t,e+1),a=p(t+1,e+1);x.push(n,i,r),x.push(r,i,a)}let S=new Be;S.setAttribute(`position`,new ot(h,3)),S.setAttribute(`normal`,new ot(g,3)),S.setAttribute(`uv`,new ot(_,2)),S.setAttribute(`clothParamX`,new ot(v,1)),S.setAttribute(`clothParamZ`,new ot(b,1)),S.setIndex(x);let C=new rt({color:s,side:2});C.transparent=!1,C.opacity=1;let w=new Qe(S,C);w.castShadow=!1,w.receiveShadow=!1,w.frustumCulled=!1,t.add(w);let T=!1;return{syncVisuals(e){if(T)return;let t=e.getRenderBuffers();if(!t)return;let o=Te(t.positions,`vec4`,r.config.maxBodies).toReadOnly(),s=A(i[0]??0),c=A(De(`clothParamX`,`float`)),d=A(De(`clothParamZ`,`float`)),f=A(.5),p=A(l-1),m=A(u-1),h=A(l-2),g=A(u-2),_=A(l),v=(e,t)=>{let n=O(e,A(0),p),r=O(t,A(0),m),i=P(j(n),h),a=P(j(r),g),c=n.sub(i),l=r.sub(a),u=a.mul(_),d=K(s.add(u).add(i)),f=K(s.add(u).add(i).add(A(1))),v=K(s.add(u).add(_).add(i)),y=K(s.add(u).add(_).add(i).add(A(1))),b=o.element(d).xyz,x=o.element(f).xyz,S=o.element(v).xyz,C=o.element(y).xyz;return G(G(b,x,c),G(S,C,c),l)},b=v(c,d),x=v(c.sub(f),d),S=v(c.add(f),d),w=v(c,d.sub(f)),E=v(c,d.add(f)),D=S.sub(x),k=E.sub(w).cross(D),M=Se(k.length().greaterThan(A(1e-6)),k.normalize(),n(0,1,0));C.positionNode=b,C.normalNode=y(a(M).normalize(),`vSpringClothNormalView`),C.needsUpdate=!0,T=!0},dispose(){t.remove(w),w.removeFromParent(),S.dispose(),C.dispose()}}}function Xn(e){let{scene:t,physics:n,addStaticBoxWithVisual:r,worldCollisionGroup:i,worldCollisionMask:a,clothCollisionGroup:o,clothCollisionMask:s,dims:c,clothY:l,nodeHalfExtents:u,nodeMass:d,structuralStiffness:f,shearStiffness:p,bendingStiffness:m=0,clothColor:h=9421557,clothRenderSubdivisions:g=4,drivenCorners:_=!0,supportMode:v=`corners`}=e,{cols:y,rows:b,nodeSpacing:x}=c,S=(y-1)*x,C=(b-1)*x,w=S*.5,T=C*.5,E=w+.55,D=T+.55,O=.12,k=.08,A=.2,j=l+.08,M=(j-A)*.5,N=A+M,P=[O,M,O],F=[E+O,k,k],I=[k,k,D+O],L=Array(y*b),R=new Map,z=[],B=Math.PI*2;n.setBodyCollisionFilter(0,i,a);let V=(e,t,r)=>n.addBody({position:e,halfExtents:t,mass:r.mass,friction:r.friction??.75,collisionGroup:r.collisionGroup,collisionMask:r.collisionMask,linearVelocity:r.linearVelocity,quaternion:r.quaternion,lockRotation:r.lockRotation});(()=>{let e=[[-E,N,-D],[E,N,-D],[-E,N,D],[E,N,D]];for(let t of e)r(t,P,{color:4739939});r([0,j,-D],F,{color:6320266}),r([0,j,D],F,{color:6320266}),r([-E,j,0],I,{color:6320266}),r([E,j,0],I,{color:6320266})})();for(let e=0;e<b;e++)for(let t=0;t<y;t++){let n=(t-(y-1)*.5)*x,r=(e-(b-1)*.5)*x,i=t===0||t===y-1||e===0||e===b-1,a=(t===0||t===y-1)&&(e===0||e===b-1),c=V([n,l,r],u,{mass:(v===`boundary`?i:a)?0:d,friction:.96,collisionGroup:o,collisionMask:s,lockRotation:!0});L[Jn(t,e,y)]=c,a&&R.set(c,[n,l,r])}z.push(Yn({scene:t,physics:n,clothBodyIds:L,dims:c,color:h,subdivisions:g}));let H=(e,t,r,i,a)=>{let o=L[Jn(e,t,y)],s=L[Jn(r,i,y)],c=r-e,l=i-t,u=Math.hypot(c*x,l*x);n.addSpring(o,s,[0,0,0],[0,0,0],a,u,!0)};for(let e=0;e<b;e++)for(let t=0;t<y;t++)t+1<y&&H(t,e,t+1,e,f),e+1<b&&H(t,e,t,e+1,f),t+1<y&&e+1<b&&H(t,e,t+1,e+1,p),t+1<y&&e-1>=0&&H(t,e,t+1,e-1,p),m>0&&(t+2<y&&H(t,e,t+2,e,m),e+2<b&&H(t,e,t,e+2,m));let ee=L[Jn(0,0,y)],te=L[Jn(y-1,0,y)],ne=L[Jn(0,b-1,y)],re=L[Jn(y-1,b-1,y)],U=0,ie=()=>{if(!_)return;let e=R.get(ee),t=R.get(te),r=R.get(ne),i=R.get(re);e&&n.setBodyPose(ee,[e[0],e[1]+Math.sin(U/3.7*B)*.9,e[2]+Math.sin(U/5.9*B)*.32]),t&&n.setBodyPose(te,[t[0],t[1]+Math.sin(U/4.85*B+1.1)*.82,t[2]+Math.sin(U/7.3*B+.55)*.38]),r&&n.setBodyPose(ne,[r[0],r[1]+Math.sin(U/6.2*B+.37)*.58,r[2]+Math.sin(U/8.6*B+.91)*.24]),i&&n.setBodyPose(re,[i[0],i[1]+Math.sin(U/5.4*B+1.73)*.68,i[2]+Math.sin(U/9.4*B+.22)*.28])};return ie(),{clothBodyIds:L,clothWidth:S,clothDepth:C,clothY:l,syncedVisuals:z,update(e){U+=e,ie()},reset(){U=0,ie()}}}var Zn=1,Qn=2,$n=4,er=18,tr=12,nr=.42,rr=8.25,ir=[.31,.11,.31],ar=.16,or=1100,sr=420,cr=4,lr=4,ur=10,dr=[.22,.22,.22],fr=.18;function pr(e){let{scene:t,physics:n,addStaticBoxWithVisual:r}=e,i=[],a=Xn({scene:t,physics:n,addStaticBoxWithVisual:r,worldCollisionGroup:Zn,worldCollisionMask:7,clothCollisionGroup:Qn,clothCollisionMask:5,dims:{cols:er,rows:tr,nodeSpacing:nr},clothY:rr,nodeHalfExtents:ir,nodeMass:ar,structuralStiffness:or,shearStiffness:sr,clothColor:9421557,clothRenderSubdivisions:4,drivenCorners:!0}),o=Nn(t,n,{capacity:cr*lr*ur,halfExtents:dr,color:13595712,roughness:.74,metalness:.05});i.push(o);let s=dr[0]*2+.02,c=dr[1]*2+.02,l=dr[2]*2+.02;for(let e=0;e<ur;e++)for(let t=0;t<lr;t++)for(let r=0;r<cr;r++){let i=(r-(cr-1)*.5)*s,a=(t-(lr-1)*.5)*l,u=n.addBody({position:[i,8.85+dr[1]+e*c,a],halfExtents:dr,mass:fr,friction:.64,collisionGroup:$n,collisionMask:7});o.addBody(u)}return{clothBodyIds:a.clothBodyIds,trackedVisualSets:i,trackedSpringVisualSets:[],syncedVisuals:a.syncedVisuals,update:a.update,reset:a.reset}}var mr=[32,32,25],hr=`00000000000000000000000000000000000000000000000000fc000000fc3f0000feff0000feff00c0fff700e0fff701f0ffff07f0ffff0ff0ffff0fe0ffff0fe0ffff0fc0ffff07e0ffff03e0ffff01e0ffff01c0ffff0080fb3f0000f003000000000000000000000000000000000000000000000000000000000000f8000000fc7f0000feff0000feff01c0ffff01e0ffff0ff0ffff1ff0ffff3ff0ffff3fe0ffff3fc0ffff3fc0ffff1fe0ffff1fe0ffff03e0ffff01c0ffff0180fb3f0000f003000000000000000000000000000000000000000000000000000000000000f81f0000fcff0000fcff0100fcff0300ffff03c0ffff1fe0ffff3fe0ffff7fe0ffff7fe0ffff7f80ffff7fc0ffff7fc0ffff3fc0ffff1fc0ffff03c0ffff0180f17f0000f01b000000000000000000000000000000000000000000000000000000030000c07f0000f0ff0100f8ff0300f8ff0300feff0780ffff3f80ffff7f80ffffff80ffffff80ffffff00ffffff00ffffff80ffff7f80ffff3f80ffff0700f1ff0100e0ff0000c03f0000000000000000000000000000000000000000000000000000800f0000e0ff0000e0ff0100e0ff0300f0ff0700ffff0f00ffff7f80ffffff80ffffff80ffffff80ffffff80ffffff00ffffff00ffff7f00ffff3f00feff0700c0ff0300c0ff0100807f0000000000000000000000000000000000000000000000000000c01f0000e0ff0000e0ff0100f0ff0700f4ff0700ffff0fc0ffff7fe0ffffffe0fffffff0fffffff0ffffffe0ffffffe0ffffffc0ffffff00ffff3f00feff0f00dcff0700c0ff0100807f0000003e00000000000000000000000000000000000080010000e01f0000e0ff0000f0ff0100f0ff0700feff0fc0ffff0fe0ffff1ff0fffffff8fffffff8fffffff8fffffff0fffffff0fffffff0ffffffe0ffff0f80ffff0f00fcff0700c0ff010080ff0000003f000000000000000000000000000000000000c0030000e03f0000f0ff0000f0ff0300f0ff07e0ffff0ff0ffff0ff8ffff1ff8ffff7ffcfffffffcfffffffcfffffffcfffffff8fffffff8ffff7ff0ffff0fe0ffff0f00feff0700c0ff0100c0ff0000803f000000000000000000000000000000000000c0070000e03f0000f0ff0000f0ff03c0ffff07f0ffff0ff8ffff0ffcffff1ffcffff1ffcffff7ffcfffffffcfffffffcfffffffcffff7ffcffff1ff8ffff0ff0ffff0fe0ffff0700e0ff0300c0ff0000803f000000000000000000000000000000000000c0070000e03f0000f0ff0000f0ff03e0ffff07f0ffff0ff8ffff0ffcffff1ffcffff1ffeffff1ffeffff3ffeffff3ffeffff1ffeffff1ffcffff1ffcffff1ff8ffff0ff0ffff0700e0ff0300e0ff0100c03f000000000000000000000000000000000000c0070000e03f0000f0ff0000f8ff03e0ffff07f8ffff0ffcffff1ffcffff1ffeffff1ffeffff1ffeffff1ffeffff1ffeffff1ffeffff1ffeffff1ffcffff1ff8ffff0ff0ffff0700e3ff0300e0ff0100c03f000000000000000000000000000000000000c0030000e03f0000f0ff0000fcff01e0ffff07f8ffff0ffcffff1ffeffff1ffeffff1ffeffff1ffeffff1ffeffff1ffeffff1ffeffff1ffeffff1ffcffff0ff8ffff0ff0ffff07c0e3ff0300c0ff0000c03f00000000000000000000000000000000000000000000c01f0000e07f0000fcff01e0ffff07f8ffff0ffcffff0ffeffff1ffeffff1ffeffff1ffeffff1ffeffff1ffeffff1ffeffff1ffeffff1ffcffff0ff8ffff0ff0ffff07c0e1ff0300c07f0000801f0000000000000000000000000000000000000000000000000000801f0000f8ff00c0ffff03f8ffff07fcffff0ffcffff1ffeffff1ffeffff1ffeffff1ffeffff1ffeffff1ffeffff1ffeffff1ffcffff0ff8ffff07f0ffff0700c0ff0100803f00000000000000000000000000000000000000000000000000000000000000000000e00f00c0ffff01f0ffff07f8ffff0ffcffff0ffeffff1ffeffff1ffeffff1ffeffff1ffeffff1ffeffff0ffeffff0ffcffff0ff8ffff07e0ffff030000fe000000000000000000000000000000000000000000000000000000000000000000000000000000000080ff7f00e0ffff03f8ffff07fcffff0ffcffff0ffeffff0ffeffff0ffeffff0ffeffff0ffeffff0ffcffff0ffeffff07feffff03bce7ff00180000000000000000000000000000000000000000000000000000000000000000000000000000000000000000ff7f00c0ffff01f0ffff03fcffff07feffff07ffffff0fffffff0fffffff0fffffff0fffffff0fffffff07ffffff07ffffff037f803f007e000000380000000000000000000000000000000000000000000000000000000000000000000000000000000000180080ffff00f0ffff01fcffff03feffff07ffffff07ffffff07ffffff07ffffff07ffffff07ffffff07ffffff03ffc1ff00ff000c007f000000780000000000000000000000000000000000000000000000000000000000000000000000000000000000000000003800f0ffff00fcffff01feffff03ffffff03ffffff03ffffff03ffffff03ffffff03ffffff01ffc3ff01ff013f00ff0000007f0000007c000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000070000600fc1f7f00fedfff00ffffff01ffffff01ffffff01ffffff01ffdfff01ff83ff00ff037e00ff010000ff0000007e0000003c000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000070000000fc010000fe031800ff073c00ff077e00ff077e00ff077e00ff073c00ff030000ff030000ff0100007f0000003e0000003c000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000020000000fc010000fe030000fe030000ff030000ff030000ff030000ff030000ff030000ff010000ff0000007e0000003e0000001c000000000000000000000000000000000000000000000000000000000000000000000000000000300000007000000070000000fc000000fc030000fe030000fe030000ff030000ff030000ff010000ff010000fe010000fe0000007e0000003c00000000000000000000000000000000000000000000000000000030000000300000007000000070000000780000007800000078000000f80e0000fc0f0000fe0f0000fe070000ff030000ff010000ff010000ff010000fe010000fe0000003c00000000000000000000000000000000000000000000003000000070000000700000007000000070000000780000007800000078000000781c0000783f0000fc3f0000fe1f0000fe0f0000ff030000ff010000ff010000fe010000fe000000fc000000000000000000000000000000000000000000000060000000700000007000000070000000700000007000000078000000780000007800000078fc000078ff0000b87f0000f83f0000fc0f0000fc010000fc010000fc000000f800000000000000000000000000000000000000000000000000000060000000600000007000000070000000700000007800000078000000780000007800010078f8030038fe010030ff0100807f0000803f00008007000000000000000000000000000000000000000000000000000000000000000000000000000000000000600000006000000070000000780000007800000078000000780000007800030078e0030030f8030000fc0100007e0000001f0000000f00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000600000007000000078000000780000007800000078000000380002003080030000e0030000f8030000fc0000003e0000001e0000000c00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000700000007800000078000000380000003800000000000000000003000080030000e0030000f00100007800000078000000380000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000700000007800000038000000000000000000000000000000000003000080030000c0010000e0000000f000000070000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000080010000c0010000c0000000c000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000`;function gr(e){let[t,n,r]=e,i=[];for(let e=0;e<n;e++)for(let n=0;n<t;n++)for(let a=0;a<r;a++)i.push(n+t*(a+r*e));return i}function _r(e,t){if(t.length%2!=0)throw Error(`Invalid bunny soft body bitset hex length`);let n=new Uint8Array(t.length/2);for(let e=0;e<t.length;e+=2)n[e>>1]=Number.parseInt(t.slice(e,e+2),16);let r=e[0]*e[1]*e[2],i=[];for(let e=0;e<r;e++)n[e>>3]&1<<(e&7)&&i.push(e);return i}function vr(e,t,n,r){return t+e[0]*(r+e[2]*n)}function yr(e,t){return e*e*e*t}function br(e){let{scene:t,physics:n,gridDims:r,filledIndices:i,cellSize:a,basePosition:o,color:s,density:c,friction:l,jointStiffness:u,roughness:d,metalness:f,geometry:p,showOutline:m,castShadow:h,receiveShadow:g,onBodyCreated:_}=e,[v,y,b]=r,x=a*.5,S=Nn(t,n,{capacity:i.length,halfExtents:[x,x,x],...p?{geometry:p}:{},color:s,roughness:d??.78,metalness:f??.03,...m===void 0?{}:{showOutline:m},...h===void 0?{}:{castShadow:h},...g===void 0?{}:{receiveShadow:g}}),C=v*y*b,w=new Int32Array(C).fill(-1),T=yr(a,c);for(let e of i){let t=e%v,r=Math.floor(e/v),i=r%b,s=Math.floor(r/b),c=[o[0]+(t-(v-1)*.5)*a,o[1]+s*a,o[2]+(i-(b-1)*.5)*a],u=[(t-(v-1)*.5)*a,(s-(y-1)*.5)*a,(i-(b-1)*.5)*a],d=n.addBody({position:c,halfExtents:[x,x,x],mass:T,friction:l});S.addBody(d),w[e]=d,_?.({filledIndex:e,body:d,position:c,localPosition:[(t-(v-1)*.5)*a,s*a,(i-(b-1)*.5)*a],centeredLocalPosition:u,grid:[t,s,i]})}for(let e of i){let t=e%v,i=Math.floor(e/v),a=i%b,o=Math.floor(i/b),s=w[e];if(!(s<0)){if(t+1<v){let e=w[vr(r,t+1,o,a)];e>=0&&n.addFixedJoint(s,e,[x,0,0],[-x,0,0],u,!0)}if(o+1<y){let e=w[vr(r,t,o+1,a)];e>=0&&n.addFixedJoint(s,e,[0,x,0],[0,-x,0],u,!0)}if(a+1<b){let e=w[vr(r,t,o,a+1)];e>=0&&n.addFixedJoint(s,e,[0,0,x],[0,0,-x],u,!0)}}}for(let e=0;e+1<v;e++)for(let t=0;t+1<y;t++)for(let i=0;i<b;i++){let a=w[vr(r,e,t,i)],o=w[vr(r,e+1,t+1,i)];a>=0&&o>=0&&n.setBodyPairCollisionIgnored(a,o,!0);let s=w[vr(r,e+1,t,i)],c=w[vr(r,e,t+1,i)];s>=0&&c>=0&&n.setBodyPairCollisionIgnored(s,c,!0)}for(let e=0;e<v;e++)for(let t=0;t+1<y;t++)for(let i=0;i+1<b;i++){let a=w[vr(r,e,t,i)],o=w[vr(r,e,t+1,i+1)];a>=0&&o>=0&&n.setBodyPairCollisionIgnored(a,o,!0);let s=w[vr(r,e,t+1,i)],c=w[vr(r,e,t,i+1)];s>=0&&c>=0&&n.setBodyPairCollisionIgnored(s,c,!0)}for(let e=0;e+1<v;e++)for(let t=0;t<y;t++)for(let i=0;i+1<b;i++){let a=w[vr(r,e,t,i)],o=w[vr(r,e+1,t,i+1)];a>=0&&o>=0&&n.setBodyPairCollisionIgnored(a,o,!0);let s=w[vr(r,e+1,t,i)],c=w[vr(r,e,t,i+1)];s>=0&&c>=0&&n.setBodyPairCollisionIgnored(s,c,!0)}return{trackedVisualSets:[S],trackedSpringVisualSets:[]}}var xr=.3,Sr=9,Cr=800,wr=.85,Tr=.52,Er=10427701;function Dr(e){let{scene:t,physics:n,addStaticBoxWithVisual:r}=e,i=[18,.5,18];return r([-14,-i[1],-14],i,{color:4805987}),r([14,-i[1],-14],i,{color:4805987}),r([-14,-i[1],14],i,{color:4805987}),r([14,-i[1],14],i,{color:4805987}),br({scene:t,physics:n,gridDims:mr,filledIndices:_r(mr,hr),cellSize:xr,basePosition:[0,Sr,0],color:Er,density:wr,friction:Tr,jointStiffness:Cr,roughness:.76,metalness:.02})}var Or=[.38,.64,.16],kr=[.1,.28,.1],Ar=[.14,.38,.14],jr=.22;function Mr(e=1){let t=t=>[t[0]*e,t[1]*e,t[2]*e],n=t(Or),r=jr*e;return{scale:e,trunkHalfExtents:n,armHalfExtents:t(kr),legHalfExtents:t(Ar),headRadius:r,shoulderAnchor:[n[0]+.06*e,n[1]*.58],hipAnchor:[.17*e,-n[1]+.22*e],headAnchorY:n[1]+r-.02*e}}function Nr(e){let{scene:t,physics:n,totalRagdolls:r,collisionGroup:i,collisionMask:a,colorBucketCount:o=20,scale:s=1,defaultPose:c=`standing`,selfCollision:l=!0}=e,u=Mr(s),{trunkHalfExtents:d,armHalfExtents:f,legHalfExtents:p,headRadius:m}=u,h=s*s*s,g=[],_=Math.min(o,r),v=new nt(m,22,16),y=Array.from({length:_},(e,t)=>new Ze().setHSL((t/Math.max(1,_)*.86+.02)%1,.68,.58).getHex()),b=Nn(t,n,{capacity:Math.max(1,r*9),perInstance:!0,color:y[0]??16777215,roughness:.78,metalness:.04}),x=Nn(t,n,{capacity:Math.max(1,r),perInstance:!0,geometry:v,color:y[0]??16777215,roughness:.74,metalness:.03});g.push(b,x);let S=y[0]??16777215,C=!1,w=[],T=[],E=[],D=(e,t,n,r)=>(n.addBody(e,{color:S,...r?{halfExtents:r}:{}}),T.push(e),w.push(t),e),O=(e,t,r,o)=>{let s=n.addBody({position:e,halfExtents:t,mass:C?0:o.mass,friction:o.friction??.75,collisionGroup:i,collisionMask:C?0:a,linearVelocity:o.linearVelocity,quaternion:o.quaternion});return D(s,o.mass,r,t)},k=(e,t,r,o)=>{let s=n.addBody({position:e,shapeType:`sphere`,radius:t,mass:C?0:o.mass,friction:o.friction??.75,collisionGroup:i,collisionMask:C?0:a,linearVelocity:o.linearVelocity,quaternion:o.quaternion});return D(s,o.mass,r)};return{trackedVisualSets:g,addRagdoll(e){let{index:t,rootPosition:r,linearVelocity:i=[0,0,0],rootQuaternion:a=[0,0,0,1],pose:o=c,kinematic:s=!1}=e;C=s,T.length=0,w.length=0,E.length=0,S=y[t%_];let g=b,v=b,D=b,A=e=>[e.x,e.y,e.z,e.w],j=(e,t,n)=>{let r=new Le().setFromEuler(new st(e,t,n,`XYZ`));return A(r)},M=(e,t)=>{let n=new Le(e[0],e[1],e[2],e[3]),r=new Le(t[0],t[1],t[2],t[3]);return n.multiply(r).normalize(),[n.x,n.y,n.z,n.w]},N=A(new Le(a[0],a[1],a[2],a[3]).normalize()),P=(e,t)=>{let n=new Y(e[0],e[1],e[2]).applyQuaternion(new Le(t[0],t[1],t[2],t[3]));return[n.x,n.y,n.z]},F=(e,t,n)=>{let r=P(t,n);return[e[0]-r[0],e[1]-r[1],e[2]-r[2]]},I=(e,t,n)=>{let r=P(t,n);return[e[0]+r[0],e[1]+r[1],e[2]+r[2]]},[L,R,z]=r,B=M(N,j(o===`seated`?.05:0,0,0)),V=O([L,R,z],d,g,{mass:2.85*h,friction:.62,linearVelocity:i,quaternion:B}),H=o===`seated`?j(-.42,0,-.08):j(.08,0,-.58),ee=o===`seated`?j(-1.16,0,-.02):j(-.38,0,-.24),te=o===`seated`?j(-.42,0,.08):j(-.08,0,.58),ne=o===`seated`?j(-1.16,0,.02):j(-.38,0,.24),re=o===`seated`?j(-1.4,0,-.04):j(-.14,0,-.16),U=o===`seated`?j(.12,0,-.01):j(.24,0,-.04),ie=o===`seated`?j(-1.4,0,.04):j(-.14,0,.16),ae=o===`seated`?j(.12,0,.01):j(.24,0,.04),oe=M(N,H),se=M(N,ee),ce=M(N,te),le=M(N,ne),ue=M(N,re),de=M(N,U),W=M(N,ie),fe=M(N,ae),[G,pe]=u.shoulderAnchor,[me,he]=u.hipAnchor,ge=d[0],_e=o===`seated`?[-ge,pe,0]:[-G,pe,0],ve=o===`seated`?[ge,pe,0]:[G,pe,0],ye=[-me,he,0],be=[me,he,0],xe=P(ve,B),Se=P(_e,B),Ce=P(ye,B),K=P(be,B),we=[L+Se[0],R+Se[1],z+Se[2]],Te=[L+xe[0],R+xe[1],z+xe[2]],Ee=[L+Ce[0],R+Ce[1],z+Ce[2]],De=[L+K[0],R+K[1],z+K[2]],Oe=F(we,[0,f[1],0],oe),ke=F(Te,[0,f[1],0],ce),Ae=I(Oe,[0,-f[1],0],oe),je=I(ke,[0,-f[1],0],ce),Me=F(Ae,[0,f[1],0],se),Ne=F(je,[0,f[1],0],le),Pe=F(Ee,[0,p[1],0],ue),Fe=F(De,[0,p[1],0],W),Ie=I(Pe,[0,-p[1],0],ue),Re=I(Fe,[0,-p[1],0],W),ze=F(Ie,[0,p[1],0],de),Be=F(Re,[0,p[1],0],fe),Ve=P([0,u.headAnchorY,0],B),He=k([L+Ve[0],R+Ve[1],z+Ve[2]],m,x,{mass:.6*h,friction:.55,linearVelocity:i,quaternion:B}),Ue=O(Oe,f,v,{mass:.45*h,friction:.62,linearVelocity:i,quaternion:oe}),We=O(Me,f,v,{mass:.38*h,friction:.62,linearVelocity:i,quaternion:se}),Ge=O(ke,f,v,{mass:.45*h,friction:.62,linearVelocity:i,quaternion:ce}),Ke=O(Ne,f,v,{mass:.38*h,friction:.62,linearVelocity:i,quaternion:le}),qe=O(Pe,p,D,{mass:.82*h,friction:.62,linearVelocity:i,quaternion:ue}),q=O(ze,p,D,{mass:.7*h,friction:.62,linearVelocity:i,quaternion:de}),J=O(Fe,p,D,{mass:.82*h,friction:.62,linearVelocity:i,quaternion:W}),Je=O(Be,p,D,{mass:.7*h,friction:.62,linearVelocity:i,quaternion:fe});E.push(n.addFixedJoint(V,He,[0,d[1],0],[0,-m,0],1/0,!0)),E.push(n.addSphericalJoint(V,Ue,_e,[0,f[1],0],1/0,!0)),E.push(n.addSphericalJoint(V,Ge,ve,[0,f[1],0],1/0,!0)),E.push(n.addSphericalJoint(Ue,We,[0,-f[1],0],[0,f[1],0],1/0,!0)),E.push(n.addSphericalJoint(Ge,Ke,[0,-f[1],0],[0,f[1],0],1/0,!0)),E.push(n.addSphericalJoint(V,qe,ye,[0,p[1],0],1/0,!0)),E.push(n.addSphericalJoint(V,J,be,[0,p[1],0],1/0,!0)),E.push(n.addSphericalJoint(qe,q,[0,-p[1],0],[0,p[1],0],1/0,!0)),E.push(n.addSphericalJoint(J,Je,[0,-p[1],0],[0,p[1],0],1/0,!0));let Ye=[V,He,Ue,We,Ge,Ke,qe,q,J,Je];if(!l)for(let e=0;e<Ye.length;e++)for(let t=e+1;t<Ye.length;t++)n.setBodyPairCollisionIgnored(Ye[e],Ye[t],!0);let Xe=Ye.map(e=>w[T.indexOf(e)]??1),Ze=E.slice();if(s)for(let e of Ze)n.disableJoint(e);return C=!1,{bodies:Ye,joints:Ze,masses:Xe}}}}function Pr(e,t){if(t>10)throw Error(`[${e}] uses ${t} storage buffers; limit is 10.`)}var Fr=x(`
  fn qmul(a: vec4f, b: vec4f) -> vec4f {
    return vec4f(
      a.w*b.x + a.x*b.w + a.y*b.z - a.z*b.y,
      a.w*b.y - a.x*b.z + a.y*b.w + a.z*b.x,
      a.w*b.z + a.x*b.y - a.y*b.x + a.z*b.w,
      a.w*b.w - a.x*b.x - a.y*b.y - a.z*b.z);
  }
`),Ir=x(`
  fn qrot(q: vec4f, v: vec3f) -> vec3f {
    let t = 2.0 * cross(q.xyz, v);
    return v + q.w * t + cross(q.xyz, t);
  }
`),Lr=x(`
  fn qconj(q: vec4f) -> vec4f {
    return vec4f(-q.xyz, q.w);
  }
`),Rr=x(`
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
`,[Ir,Lr]);x(`
  fn worldInvInertia(q: vec4f, invI: vec3f) -> mat3x3f {
    let c0 = qrot(q, vec3f(1.0, 0.0, 0.0));
    let c1 = qrot(q, vec3f(0.0, 1.0, 0.0));
    let c2 = qrot(q, vec3f(0.0, 0.0, 1.0));
    return mat3x3f(c0 * invI.x, c1 * invI.y, c2 * invI.z) *
           transpose(mat3x3f(c0, c1, c2));
  }
`,[Ir]);var zr=64,Br={hipHeightFraction:.93,bobAmplitude:.035,swayAmplitude:.035,rollAmplitude:.05,leanPitch:.07,footLift:.17,footTrack:.82,armSwing:.42,armSpread:.17,elbowBend:.45},Vr=x(`
  fn quatFromDownToDir(d: vec3f) -> vec4f {
    let w = 1.0 - d.y;
    if (w < 1.0e-5) { return vec4f(1.0, 0.0, 0.0, 0.0); }
    return normalize(vec4f(-d.z, 0.0, d.x, w));
  }
`),Hr=x(`
  fn angularVelocityFromQuats(qPrev: vec4f, qCur: vec4f, invDt: f32) -> vec3f {
    let hemisphere = select(-1.0, 1.0, dot(qPrev, qCur) >= 0.0);
    let dq = qmul(qCur * hemisphere, qconj(qPrev));
    return 2.0 * dq.xyz * invDt;
  }
`,[Fr,Lr]),Ur=class{kernel;constructor(e){let{skeleton:t,gait:n,walkerCapacity:r,maxBodies:i}=e,a=t.legHalfExtents[1],o=t.armHalfExtents[1],s=4*a,c=e=>e.toFixed(6),u=l(`
      fn compute(
        walkerState: ptr<storage, array<vec4f>, read>,
        positions: ptr<storage, array<vec4f>, read_write>,
        quaternions: ptr<storage, array<vec4f>, read_write>,
        velocities: ptr<storage, array<vec4f>, read_write>,
        angularVelocities: ptr<storage, array<vec4f>, read_write>,
        walkerCount: u32,
        invDt: f32,
        workgroupId: vec3u,
        localId: vec3u,
      ) -> void {
        let gid = workgroupId.x * ${zr}u + localId.x;
        if (gid >= walkerCount) { return; }

        const PI = 3.14159265;
        const INV_TAU = 0.15915494;
        const LEG_HALF_Y = ${c(a)};
        const LEG_REACH = ${c(s)};
        const ARM_HALF_Y = ${c(o)};
        const SHOULDER_X = ${c(t.shoulderAnchor[0])};
        const SHOULDER_Y = ${c(t.shoulderAnchor[1])};
        const HIP_X = ${c(t.hipAnchor[0])};
        const HIP_Y = ${c(t.hipAnchor[1])};
        const HEAD_Y = ${c(t.headAnchorY)};
        const HIP_HEIGHT = ${c(s*n.hipHeightFraction)};
        const BOB = ${c(n.bobAmplitude*t.scale)};
        const SWAY = ${c(n.swayAmplitude*t.scale)};
        const ROLL = ${c(n.rollAmplitude)};
        const LEAN = ${c(n.leanPitch)};
        const FOOT_LIFT = ${c(n.footLift*t.scale)};
        const FOOT_TRACK = ${c(n.footTrack)};
        const ARM_SWING = ${c(n.armSwing)};
        const ARM_SPREAD = ${c(n.armSpread)};
        const ELBOW_BEND = ${c(n.elbowBend)};

        let stateBase = gid * 4u;
        let gaitNow = walkerState[stateBase + 1u];
        if (gaitNow.z > 0.5) { return; }
        let bodyBase = u32(gaitNow.w);

        var limbPos: array<vec3f, 20>;
        var limbRot: array<vec4f, 20>;

        for (var sample = 0u; sample < 2u; sample++) {
          let pose = walkerState[stateBase + sample * 2u];
          let gaitState = walkerState[stateBase + 1u + sample * 2u];
          let ground = pose.xyz;
          let heading = pose.w;
          let phase = gaitState.x;
          let stride = gaitState.y;
          let out = sample * 10u;

          let fwd = vec3f(sin(heading), 0.0, cos(heading));
          let right = vec3f(cos(heading), 0.0, -sin(heading));
          let up = vec3f(0.0, 1.0, 0.0);

          let bob = BOB * cos(2.0 * phase);
          let sway = SWAY * sin(phase);
          let roll = ROLL * sin(phase);
          let qYaw = vec4f(0.0, sin(heading * 0.5), 0.0, cos(heading * 0.5));
          let qLean = vec4f(sin(LEAN * 0.5), 0.0, 0.0, cos(LEAN * 0.5));
          let qRoll = vec4f(0.0, 0.0, sin(roll * 0.5), cos(roll * 0.5));
          let qTrunk = normalize(qmul(qmul(qYaw, qLean), qRoll));

          let hipMid = ground + right * sway + vec3f(0.0, HIP_HEIGHT + bob, 0.0);
          let trunkCenter = hipMid - qrot(qTrunk, vec3f(0.0, HIP_Y, 0.0));
          limbPos[out] = trunkCenter;
          limbRot[out] = qTrunk;
          limbPos[out + 1u] = trunkCenter + qrot(qTrunk, vec3f(0.0, HEAD_Y, 0.0));
          limbRot[out + 1u] = qTrunk;

          for (var side = 0u; side < 2u; side++) {
            let sideSign = select(-1.0, 1.0, side == 1u);
            let limbPhase = phase + select(PI, 0.0, side == 1u);

            let armAngle = ARM_SWING * sin(limbPhase + PI);
            let shoulder = trunkCenter + qrot(qTrunk, vec3f(sideSign * SHOULDER_X, SHOULDER_Y, 0.0));
            let dirUpperArm = normalize(
              fwd * sin(armAngle) + right * (sideSign * ARM_SPREAD) - up * cos(armAngle)
            );
            let elbowAngle = armAngle + ELBOW_BEND;
            let dirForearm = normalize(
              fwd * sin(elbowAngle) + right * (sideSign * ARM_SPREAD * 0.5) - up * cos(elbowAngle)
            );
            let elbow = shoulder + dirUpperArm * (2.0 * ARM_HALF_Y);
            let armOut = out + 2u + side * 2u;
            limbPos[armOut] = shoulder + dirUpperArm * ARM_HALF_Y;
            limbRot[armOut] = quatFromDownToDir(dirUpperArm);
            limbPos[armOut + 1u] = elbow + dirForearm * ARM_HALF_Y;
            limbRot[armOut + 1u] = quatFromDownToDir(dirForearm);

            let cycle = fract(limbPhase * INV_TAU);
            var footForward: f32;
            var footLift: f32;
            if (cycle < 0.5) {
              // Stance: the planted foot tracks backward at exactly body speed, so it
              // covers one stride while the body advances one stride and never slides.
              footForward = stride * (0.5 - cycle * 2.0);
              footLift = 0.0;
            } else {
              let swing = cycle * 2.0 - 1.0;
              footForward = stride * (swing - 0.5);
              footLift = FOOT_LIFT * sin(PI * swing);
            }
            let foot = ground
              + right * (sideSign * HIP_X * FOOT_TRACK + sway * 0.35)
              + fwd * footForward
              + vec3f(0.0, footLift, 0.0);

            // Two equal-length bones put the knee on the perpendicular bisector of hip->foot,
            // so the cosine law collapses to one angle and the bend direction picks the side.
            let hip = trunkCenter + qrot(qTrunk, vec3f(sideSign * HIP_X, HIP_Y, 0.0));
            let toFoot = foot - hip;
            let reach = clamp(length(toFoot), 1.0e-3, LEG_REACH - 1.0e-3);
            let dirToFoot = toFoot / max(length(toFoot), 1.0e-6);
            let bendRaw = fwd - dirToFoot * dot(fwd, dirToFoot);
            let bendLen = length(bendRaw);
            let bend = select(right, bendRaw / max(bendLen, 1.0e-4), bendLen > 1.0e-4);
            let halfAngle = acos(clamp(reach / LEG_REACH, 0.0, 1.0));
            let knee = hip + (dirToFoot * cos(halfAngle) + bend * sin(halfAngle)) * (2.0 * LEG_HALF_Y);

            let dirUpperLeg = normalize(knee - hip);
            let dirLowerLeg = normalize(foot - knee);
            let legOut = out + 6u + side * 2u;
            limbPos[legOut] = hip + dirUpperLeg * LEG_HALF_Y;
            limbRot[legOut] = quatFromDownToDir(dirUpperLeg);
            limbPos[legOut + 1u] = knee + dirLowerLeg * LEG_HALF_Y;
            limbRot[legOut + 1u] = quatFromDownToDir(dirLowerLeg);
          }
        }

        for (var limb = 0u; limb < 10u; limb++) {
          let body = bodyBase + limb;
          let current = limbPos[limb];
          let previous = limbPos[limb + 10u];
          let qCurrent = limbRot[limb];
          // Walkers are kinematic while driven, so the inverse mass in .w stays zero.
          positions[body] = vec4f(current, 0.0);
          quaternions[body] = qCurrent;
          velocities[body] = vec4f((current - previous) * invDt, 0.0);
          angularVelocities[body] = vec4f(
            angularVelocityFromQuats(limbRot[limb + 10u], qCurrent, invDt),
            0.0,
          );
        }
      }
    `,[Fr,Ir,Vr,Hr]);this.kernel=u({walkerState:Z(e.walkerState,`vec4f`,r*4).toReadOnly(),positions:Z(e.positions,`vec4f`,i),quaternions:Z(e.quaternions,`vec4f`,i),velocities:Z(e.velocities,`vec4f`,i),angularVelocities:Z(e.angularVelocities,`vec4f`,i),walkerCount:T(0),invDt:T(60),workgroupId:p,localId:W}).computeKernel([zr,1,1]).setName(`Walk Cycle Pose`),Pr(`Walk Cycle Pose`,5)}dispatch(e,t,n){t<=0||(this.kernel.computeNode.parameters.walkerCount.value=t,this.kernel.computeNode.parameters.invDt.value=1/Math.max(n,1e-4),e.compute(this.kernel,[Math.ceil(t/zr),1,1]))}},Wr=64,Gr=x(`
  fn walkerClosingSpeed(
    centre: vec3f,
    bodyPosition: vec3f,
    velocity: vec3f,
    halfHeight: f32,
    radiusSq: f32,
  ) -> vec4f {
    let delta = centre - bodyPosition;
    if (abs(delta.y) > halfHeight) { return vec4f(0.0, 0.0, 0.0, -1.0); }
    if (delta.x * delta.x + delta.z * delta.z > radiusSq) { return vec4f(0.0, 0.0, 0.0, -1.0); }
    let distance = length(delta);
    if (distance <= 1.0e-3) { return vec4f(normalize(velocity + vec3f(0.0, 1.0e-6, 0.0)), length(velocity)); }
    let dir = delta / distance;
    return vec4f(dir, dot(velocity, dir));
  }
`),Kr=class{kernel;hitsAttr;walkerCapacity;latestHits=null;readbackInFlight=!1;generation=0;impactorBase=0;impactorCount=0;constructor(e){let{walkerCapacity:t,maxBodies:n}=e;this.walkerCapacity=t,this.hitsAttr=new q(new Float32Array(t*4),4);let r=e.walkerRadius??.7,i=e.walkerHalfHeight??e.walkerCentreY,a=e.momentumThreshold??2.2,o=e.shoveSpeedThreshold??2,s=1/Math.max(e.walkerMass,.001),c=e.maxKickSpeed??9,u=e=>e.toFixed(6),d=l(`
      fn compute(
        walkerState: ptr<storage, array<vec4f>, read>,
        positions: ptr<storage, array<vec4f>, read>,
        velocities: ptr<storage, array<vec4f>, read>,
        hits: ptr<storage, array<vec4f>, read_write>,
        walkerCount: u32,
        bodyCount: u32,
        impactorBase: u32,
        impactorCount: u32,
        workgroupId: vec3u,
        localId: vec3u,
      ) -> void {
        let gid = workgroupId.x * ${Wr}u + localId.x;
        if (gid >= walkerCount) { return; }

        const RADIUS_SQ = ${u(r*r)};
        const HALF_HEIGHT = ${u(i)};
        const CENTRE_Y = ${u(e.walkerCentreY)};
        const MOMENTUM = ${u(a)};
        const SHOVE = ${u(o)};
        const INV_WALKER_MASS = ${u(s)};
        const MAX_KICK = ${u(c)};

        let stateBase = gid * 4u;
        let gaitNow = walkerState[stateBase + 1u];
        if (gaitNow.z > 0.5) {
          hits[gid] = vec4f(0.0);
          return;
        }
        let pose = walkerState[stateBase];
        let centre = pose.xyz + vec3f(0.0, CENTRE_Y, 0.0);
        let bodyBase = u32(gaitNow.w);

        var struck = 0.0;
        var kick = vec3f(0.0);
        var kickSpeed = 0.0;
        for (var body = 0u; body < bodyCount; body++) {
          if (body >= bodyBase && body < bodyBase + 10u) { continue; }
          let bodyPose = positions[body];
          // Zero inverse mass is scenery, a hand or another walker. Hands get their own pass
          // below; the rest cannot impart an impulse.
          if (bodyPose.w <= 0.0) { continue; }
          let probe = walkerClosingSpeed(
            centre, bodyPose.xyz, velocities[body].xyz, HALF_HEIGHT, RADIUS_SQ,
          );
          if (probe.w / bodyPose.w <= MOMENTUM) { continue; }
          struck = 1.0;
          let speed = min((probe.w / bodyPose.w) * INV_WALKER_MASS, MAX_KICK);
          if (speed > kickSpeed) {
            kickSpeed = speed;
            kick = probe.xyz * speed;
          }
        }

        for (var slot = 0u; slot < impactorCount; slot++) {
          let body = impactorBase + slot;
          let probe = walkerClosingSpeed(
            centre, positions[body].xyz, velocities[body].xyz, HALF_HEIGHT, RADIUS_SQ,
          );
          if (probe.w <= SHOVE) { continue; }
          struck = 1.0;
          // A hand has no mass to trade, so it simply hands over its own speed.
          let speed = min(probe.w, MAX_KICK);
          if (speed > kickSpeed) {
            kickSpeed = speed;
            kick = probe.xyz * speed;
          }
        }
        hits[gid] = vec4f(kick, struck);
      }
    `,[Gr]);this.kernel=d({walkerState:Z(e.walkerState,`vec4f`,t*4).toReadOnly(),positions:Z(e.positions,`vec4f`,n).toReadOnly(),velocities:Z(e.velocities,`vec4f`,n).toReadOnly(),hits:Z(this.hitsAttr,`vec4f`,t),walkerCount:T(0),bodyCount:T(0),impactorBase:T(0),impactorCount:T(0),workgroupId:p,localId:W}).computeKernel([Wr,1,1]).setName(`Walker Impact Probe`),Pr(`Walker Impact Probe`,4)}setImpactorRange(e,t){this.impactorBase=Math.max(0,e),this.impactorCount=Math.max(0,t)}dispatch(e,t,n){t<=0||(this.kernel.computeNode.parameters.walkerCount.value=t,this.kernel.computeNode.parameters.bodyCount.value=n,this.kernel.computeNode.parameters.impactorBase.value=this.impactorBase,this.kernel.computeNode.parameters.impactorCount.value=this.impactorCount,e.compute(this.kernel,[Math.ceil(t/Wr),1,1]))}consumeHits(){let e=this.latestHits;return this.latestHits=null,e}discardPending(){this.generation++,this.latestHits=null}requestHits(e){if(this.readbackInFlight||typeof e?.getArrayBufferAsync!=`function`)return;this.readbackInFlight=!0;let t=this.generation;e.getArrayBufferAsync(this.hitsAttr).then(e=>{t===this.generation&&(this.latestHits=new Float32Array(e,0,this.walkerCapacity*4))}).catch(()=>void 0).finally(()=>{this.readbackInFlight=!1})}},qr=Math.PI*2,Jr=.34,Yr=1.9,Xr=.35,Zr=1.85,Qr=1.4,$r=1.35,ei=.55,ti=1.15,ni=2.7,ri=6,ii=3.2,ai=1.5,oi=1.5,si=1.8,ci=24,li=70,ui=.82,di=.02,fi=512,pi=.35,mi=2.2,hi=4,gi=[1.4,1.4,.7,.7,.7,.7,-2.2,-2.2,-2.2,-2.2],_i=1.6;function vi(e){let t=Math.sin(e*12.9898+78.233)*43758.5453123;return t-Math.floor(t)}function yi(e){let t=e;for(;t>Math.PI;)t-=qr;for(;t<-Math.PI;)t+=qr;return t}function bi(e){let{scene:t,physics:n,count:r,region:i,spawnRadius:a,scale:o=1,colorBucketCount:s=24,ragdollCollisionGroup:c,ragdollCollisionMask:l}=e,u={...Br,...e.gait},d=Mr(o),f=Nr({scene:t,physics:n,totalRagdolls:r,collisionGroup:c,collisionMask:l,colorBucketCount:s,scale:o,defaultPose:`standing`,selfCollision:!1}),p=[],m=new Uint8Array(r),h=new Float32Array(r),g=new Float32Array(r),_=new Float32Array(r),v=new Float32Array(r),y=new Float32Array(r),b=new Float32Array(r),x=new Float32Array(r),S=new Float32Array(r),C=new Float32Array(r),w=new Float32Array(r),T=new Float32Array(r),E=new Float32Array(r),D=new Float32Array(r),O=new Float32Array(r),k=new Float32Array(r),A=new Float32Array(r),j=new Float32Array(r),M=new Float32Array(r),N=new Float32Array(r),P=new Float32Array(r),F=new Float32Array(r),I=new Uint32Array(r),L=new Uint8Array(r),R=new Float32Array(r*4*4),z=new q(R,4),B=d.legHalfExtents[1]*4*u.hipHeightFraction-d.hipAnchor[1],V=B+d.headAnchorY+d.headRadius,H=d.trunkHalfExtents[0]+.2*o,ee=new qe,te=new qe,ne=null,re=null,U=0,ie=0,ae=0,oe=0,se=e=>{let t=e*4*4;R[t+0]=h[e],R[t+1]=i.groundY,R[t+2]=g[e],R[t+3]=_[e],R[t+4]=v[e],R[t+5]=y[e],R[t+6]=m[e],R[t+7]=p[e].bodies[0],R[t+8]=x[e],R[t+9]=i.groundY,R[t+10]=S[e],R[t+11]=C[e],R[t+12]=w[e],R[t+13]=T[e]},ce=e=>{I[e]=I[e]+1&65535;let t=e*19.73+I[e]*7.31,n=vi(t+.13)<di;L[e]=+!!n;let r=vi(t+1.77),a=vi(t+4.31);n?i.samplePointBeyondEdge(r,a,te):i.samplePoint(r,a,ui,te),N[e]=te.x,P[e]=te.y,F[e]=0},le=(e,t,n,r)=>{h[e]=t,g[e]=n,_[e]=r,x[e]=t,S[e]=n,C[e]=r,v[e]=vi(e*7.13+2.7)*qr,w[e]=v[e],b[e]=Xr+vi(e*11.7+5.1)*(Zr-Xr),y[e]=0,T[e]=0,m[e]=0,ce(e)};for(let e=0;e<r;e++){let t=vi(e*3.7+1.1)*qr,n=Math.sqrt(vi(e*5.3+.4)),r=Math.cos(t)*n*a,o=Math.sin(t)*n*a;for(let e=0;e<8&&i.distanceToEdge(r,o)<1;e++)i.inwardDirection(r,o,ee),r+=ee.x*2.5,o+=ee.y*2.5;E[e]=r,D[e]=o,O[e]=vi(e*17.3+9.4)*qr,k[e]=vi(e*23.1+3.3)*qr,A[e]=vi(e*31.9+12.1)*qr,le(e,r,o,O[e]);let s=f.addRagdoll({index:e,rootPosition:[r,i.groundY+B,o],rootQuaternion:[0,Math.sin(O[e]*.5),0,Math.cos(O[e]*.5)],kinematic:!0});if(s.bodies.length!==10)throw Error(`Walking crowd expects 10 bodies per ragdoll`);for(let e=1;e<s.bodies.length;e++)if(s.bodies[e]!==s.bodies[0]+e)throw Error(`Walking crowd requires consecutive ragdoll body indices`);p.push(s),se(e)}z.needsUpdate=!0;let ue=(e,t)=>{if(m[e]!==0)return;m[e]=1,ie++;let r=p[e],[i,a]=de(e,t),o=mi+vi(e*8.13+U*.19)*(hi-mi);for(let e=0;e<r.bodies.length;e++){let s=r.bodies[e];n.setBodyMass(s,r.masses[e]),n.setBodyCollisionFilter(s,c,l);let u=e<=1?1:pi,d=gi[e];n.setBodyVelocity(s,[(t?t[0]*u:0)+i*d,t?t[1]*u:0,(t?t[2]*u:0)+a*d],[a*o,0,-i*o])}for(let e of r.joints)n.setJointEnabled(e,!0);se(e)},de=(e,t)=>{let n=t?Math.hypot(t[0],t[2]):0;if(n>.2)return[t[0]/n,t[2]/n];let r=vi(e*3.71+U*.37)*qr;return[Math.sin(r),Math.cos(r)]},W=e=>{let t=p[e];for(let e=0;e<t.bodies.length;e++)n.setBodyMass(t.bodies[e],0),n.setBodyCollisionFilter(t.bodies[e],c,0);for(let e of t.joints)n.setJointEnabled(e,!1)},fe=()=>{if(!(r>fi)){for(let e=0;e<r;e++)if(m[e]===0)for(let t=e+1;t<r;t++){if(m[t]!==0)continue;let n=h[e]-h[t],r=g[e]-g[t],i=n*n+r*r;if(i>ai*ai||i<1e-6)continue;let a=Math.sqrt(i),o=(1-a/ai)/a;j[e]+=n*o,M[e]+=r*o,j[t]-=n*o,M[t]-=r*o}}},G=e=>{U+=e,j.fill(0),M.fill(0),fe();for(let t=0;t<r;t++){if(m[t]!==0)continue;x[t]=h[t],S[t]=g[t],C[t]=_[t],w[t]=v[t],T[t]=y[t],F[t]+=e;let n=N[t]-h[t],r=P[t]-g[t],a=L[t]===1?li:ci;(n*n+r*r<si*si||F[t]>a)&&ce(t);let o=Math.atan2(n,r)+Jr*Math.sin(U*.53+k[t]),s=Math.sin(o)+j[t]*oi,c=Math.cos(o)+M[t]*oi,l=i.distanceToEdge(h[t],g[t]);if(L[t]===0&&l<ri){i.inwardDirection(h[t],g[t],ee);let e=ii*(1-Math.max(l,0)/ri);s+=ee.x*e,c+=ee.y*e}if(s*s+c*c>1e-8){let n=yi(Math.atan2(s,c)-_[t]),r=Yr*e;_[t]=yi(_[t]+Math.max(-r,Math.min(r,n)))}let u=Xr+(Zr-Xr)*(.5+.5*Math.sin(U*.23+A[t]))-b[t],d=Qr*e;b[t]+=Math.max(-d,Math.min(d,u));let f=Math.max(ti,Math.min(ni,$r+b[t]*ei));if(y[t]=b[t]/f,v[t]=(v[t]+Math.PI*f*e)%qr,h[t]+=Math.sin(_[t])*b[t]*e,g[t]+=Math.cos(_[t])*b[t]*e,i.distanceToEdge(h[t],g[t])<0){let e=Math.max(b[t],_i);ue(t,[Math.sin(_[t])*e,0,Math.cos(_[t])*e])}}};return{trackedVisualSets:f.trackedVisualSets,updateBeforeStep(e,t){if(!t)return;if(!ne){let e=n.getKinematicDriveBuffers();if(!e)return;ne=new Ur({skeleton:d,gait:u,walkerState:z,walkerCapacity:r,positions:e.positions,quaternions:e.quaternions,velocities:e.velocities,angularVelocities:e.angularVelocities,maxBodies:n.config.maxBodies}),re=new Kr({walkerState:z,walkerCapacity:r,positions:e.positions,velocities:e.velocities,maxBodies:n.config.maxBodies,walkerCentreY:V*.5,walkerHalfHeight:V*.5+.25,walkerRadius:H+.25,walkerMass:p[0].masses.reduce((e,t)=>e+t,0)}),re.setImpactorRange(ae,oe)}G(e);let i=re?.consumeHits();if(i)for(let e=0;e<r;e++){let t=e*4;i[t+3]>.5&&ue(e,[i[t],i[t+1],i[t+2]])}for(let e=0;e<r;e++)se(e);z.needsUpdate=!0,ne.dispatch(t,r,e),re?.dispatch(t,r,n.getBodyCount()),re?.requestHits(t)},setImpactorRange(e,t){ae=e,oe=t,re?.setImpactorRange(e,t)},activateWalkerByRay(e,t){let n=Math.hypot(t[0],t[1],t[2]);if(n<1e-6)return null;let a=t[0]/n,o=t[1]/n,s=t[2]/n,c=1/0,l=-1;for(let t=0;t<r;t++){if(m[t]!==0)continue;let n=[h[t]-H,i.groundY,g[t]-H],r=[h[t]+H,i.groundY+V,g[t]+H],u=[a,o,s],d=0,f=1/0,p=!0;for(let t=0;t<3;t++){if(Math.abs(u[t])<1e-6){if(e[t]<n[t]||e[t]>r[t]){p=!1;break}continue}let i=1/u[t],a=(n[t]-e[t])*i,o=(r[t]-e[t])*i;if(a>o){let e=a;a=o,o=e}if(d=Math.max(d,a),f=Math.min(f,o),d>f){p=!1;break}}!p||d>=c||(c=d,l=t)}if(l<0)return null;let u=p[l].bodies[0];return ue(l),u},reset(){ie=0,U=0,re?.discardPending();for(let e=0;e<r;e++)m[e]!==0&&W(e),le(e,E[e],D[e],O[e]),se(e);z.needsUpdate=!0},statusText(){return`crowd ${r-ie} walking / ${ie} ragdolled`},dispose(){for(let e of f.trackedVisualSets)e.dispose()}}}var xi=4,Si=130,Ci=.92,wi=18,Ti=23,Ei=23,Di=.6,Oi=.7,ki=.42;function Ai(e,t,n){let r=new Le().setFromEuler(new st(e,t,n,`XYZ`));return[r.x,r.y,r.z,r.w]}function ji(){let e=Ti-Di,t=Ei-Di;return{groundY:wi,distanceToEdge(n,r){return Math.min(e-Math.abs(n),t-Math.abs(r))},inwardDirection(n,r,i){e-Math.abs(n)<t-Math.abs(r)?i.set(n>=0?-1:1,0):i.set(0,r>=0?-1:1)},samplePoint(n,r,i,a){a.set((n*2-1)*e*i,(r*2-1)*t*i)},samplePointBeyondEdge(n,r,i){let a=(r*2-1)*.85,o=1.25,s=Math.min(3,Math.floor(n*4));s===0?i.set(e*o,t*a):s===1?i.set(-22.4*o,t*a):s===2?i.set(e*a,t*o):i.set(e*a,-22.4*o)}}}function Mi(e){let{scene:t,physics:n,addStaticBoxWithVisual:r}=e;r([0,wi-Ei*.5,0],[Ti,Ei*.5,Ei],{color:6976642,friction:ki,markings:!0});let i=[{position:[26.4,12.2,-6],half:[4.6,Oi,9],tilt:-.24},{position:[-27,8.4,7.5],half:[5.2,Oi,8],tilt:.28},{position:[5,6.6,26.8],half:[9.5,Oi,4.4],tilt:0},{position:[-7,11,-26.2],half:[8,Oi,4],tilt:0}];for(let e of i)r(e.position,e.half,{quaternion:Ai(0,0,e.tilt),color:6121076,friction:ki});let a=bi({scene:t,physics:n,count:Si,region:ji(),scale:Ci,colorBucketCount:26,spawnRadius:Math.min(Ti,Ei)-2.5,ragdollCollisionGroup:xi,ragdollCollisionMask:5});return{trackedVisualSets:a.trackedVisualSets,trackedSpringVisualSets:[],updateBeforeStep:a.updateBeforeStep,activateWalkerByRay:a.activateWalkerByRay,setImpactorRange:a.setImpactorRange,reset:a.reset,statusText:a.statusText}}function Ni(e){return e===`coliseum-12k`||e===`coliseum-50k`||e===`coliseum-64k`}var Pi=[.5,1/12,1/6],Fi=.5,Ii=.72,Li=.003,Ri=Pi[0]*2,zi=Pi[2]*2,Bi=3,Vi=[0,2],Hi=Ri,Ui=Hi-.35,Wi=2,Gi=240,Ki=.55,qi=96,Ji={"coliseum-12k":{expectedBrickCount:11977,bottomUnits:5,baseInnerRadius:13.7,tangentialPitch:1.1,capPitch:.43},"coliseum-50k":{expectedBrickCount:50224,bottomUnits:9,baseInnerRadius:18,tangentialPitch:1.1,capPitch:.43},"coliseum-64k":{expectedBrickCount:64312,bottomUnits:11,baseInnerRadius:14,tangentialPitch:1.1,capPitch:.43}};function Yi(e){return e.bottomUnits}function Xi(e,t){return e.bottomUnits-t}function Zi(e,t){return e.baseInnerRadius+t*Ui}function Qi(e,t){return Math.max(1,Math.floor(2*Math.PI*t/e.tangentialPitch))}function $i(e,t){return Math.max(1,Math.floor(2*Math.PI*t/e.capPitch))}function ea(e){let t=0,n=Yi(e);for(let r=0;r<n;r++){let n=Xi(e,r),i=Zi(e,r);for(let r=0;r<Bi;r++)for(let r=0;r<n;r++)for(let n of Vi){let a=i+zi*.5+(r*3+n)*zi;t+=Qi(e,a)}for(let r=0;r<n;r++)t+=$i(e,i+(r+.5)*Hi)}return t}function ta(e){let{scene:t,physics:n,variant:r}=e,i=Ji[r],a=[],o=[],s=ea(i);if(s!==i.expectedBrickCount)throw Error(`[ColiseumDemo] ${r} expected ${i.expectedBrickCount} bricks, got ${s}.`);let c=Nn(t,n,{capacity:s,halfExtents:Pi,color:12417851,roughness:.94,metalness:.02,showOutline:!1,castShadow:!1,receiveShadow:!0});a.push(c);let l=Nn(t,n,{capacity:qi,geometry:new nt(Wi,28,20),color:9279398,roughness:.52,metalness:.14,showOutline:!1,castShadow:!0,receiveShadow:!0});a.push(l);let u=0,d=Pi[1]*2,f=Pi[2],p=f*2,m=Bi*p+d+4*Li,h=e=>new Le().setFromAxisAngle(new Y(0,1,0),-(e+Math.PI*.5)),g=e=>{let t=new Le().setFromAxisAngle(new Y(1,0,0),Math.PI*.5),n=h(e).multiply(t);return[n.x,n.y,n.z,n.w]},_=e=>{let t=new Le().setFromAxisAngle(new Y(0,1,0),-e);return[t.x,t.y,t.z,t.w]},v=(e,t,r,a)=>{let o=a?Qi(i,e):$i(i,e),s=2*Math.PI/o,l=r*s;for(let r=0;r<o;r++){let i=r*s+l,o=n.addBody({position:[Math.cos(i)*e,t,Math.sin(i)*e],halfExtents:Pi,quaternion:a?g(i):_(i),mass:Fi,friction:Ii});c.addBody(o)}},y=Yi(i);for(let e=0;e<y;e++){let t=f+.001+e*m,n=Zi(i,e),r=Xi(i,e);for(let e=0;e<Bi;e++){let i=t+e*(p+Li);for(let t=0;t<r;t++)for(let r=0;r<Vi.length;r++){let a=Vi[r];v(n+zi*.5+(t*3+a)*zi,i,e+t+r&1?.5:0,!0)}}let a=t+(Bi-1)*(p+Li)+f+Li+Pi[1];for(let t=0;t<r;t++)v(n+(t+.5)*Hi,a,e+t&1?.5:0,!1)}return console.log(`[ColiseumDemo] ${r} built ${s} bricks.`),{trackedVisualSets:a,trackedSpringVisualSets:o,brickCount:s,shootProjectile:e=>{if(u>=qi||n.getBodyCount()>=n.config.maxBodies)return!1;let t=new Y(e.direction[0],e.direction[1],e.direction[2]);if(t.lengthSq()<1e-8)return!1;t.normalize();let r=Math.max(e.speedJitter??0,0),i=Math.max(e.averageSpeed,0),a=Math.max(0,i+J.randFloatSpread(r*2)),o=t.multiplyScalar(a),s=Math.max(e.angularJitter??0,0)*.25,c=n.addBody({position:e.position,shapeType:`sphere`,radius:Wi,mass:Gi,friction:Ki,linearVelocity:[o.x,o.y,o.z],angularVelocity:[J.randFloatSpread(s*2),J.randFloatSpread(s*2),J.randFloatSpread(s*2)]});return l.addBody(c),u++,!0}}}var na=[{slug:`straight-line`,top_extract:{blocks:[{x:1724,y:567.5,w:53,h:18,angle:-90},{x:1884.5,y:567.5,w:53,h:19,angle:-90},{x:26.5,y:568,w:52,h:17,angle:-90},{x:58.5,y:568,w:52,h:17,angle:-90},{x:90.5,y:568,w:52,h:17,angle:-90},{x:122.5,y:568,w:52,h:17,angle:-90},{x:154.5,y:568,w:52,h:17,angle:-90},{x:187.5,y:568,w:52,h:17,angle:-90},{x:219.5,y:568,w:52,h:17,angle:-90},{x:251.5,y:568,w:52,h:17,angle:-90},{x:283.5,y:568,w:52,h:17,angle:-90},{x:315.5,y:568,w:52,h:17,angle:-90},{x:347.5,y:568,w:52,h:17,angle:-90},{x:379.5,y:568,w:52,h:17,angle:-90},{x:411.5,y:568,w:52,h:17,angle:-90},{x:443.5,y:568,w:52,h:17,angle:-90},{x:475.5,y:568,w:52,h:17,angle:-90},{x:507.5,y:568,w:52,h:17,angle:-90},{x:539.5,y:568,w:52,h:17,angle:-90},{x:571.5,y:568,w:52,h:17,angle:-90},{x:603.5,y:568,w:52,h:17,angle:-90},{x:635.5,y:568,w:52,h:17,angle:-90},{x:667.5,y:568,w:52,h:17,angle:-90},{x:699.5,y:568,w:52,h:17,angle:-90},{x:731.5,y:568,w:52,h:17,angle:-90},{x:763.5,y:568,w:52,h:17,angle:-90},{x:795.5,y:568,w:52,h:17,angle:-90},{x:827.5,y:568,w:52,h:17,angle:-90},{x:859.5,y:568,w:52,h:17,angle:-90},{x:891.5,y:568,w:52,h:17,angle:-90},{x:923.5,y:568,w:52,h:17,angle:-90},{x:955.5,y:568,w:52,h:17,angle:-90},{x:987.5,y:568,w:52,h:17,angle:-90},{x:1019.5,y:568,w:52,h:17,angle:-90},{x:1051.5,y:568,w:52,h:17,angle:-90},{x:1083.5,y:568,w:52,h:17,angle:-90},{x:1115.5,y:568,w:52,h:17,angle:-90},{x:1147.5,y:568,w:52,h:17,angle:-90},{x:1180,y:568,w:52,h:18,angle:-90},{x:1211.5,y:568,w:52,h:17,angle:-90},{x:1243.5,y:568,w:52,h:17,angle:-90},{x:1275.5,y:568,w:52,h:17,angle:-90},{x:1307.5,y:568,w:52,h:17,angle:-90},{x:1339.5,y:568,w:52,h:17,angle:-90},{x:1371.5,y:568,w:52,h:17,angle:-90},{x:1404,y:568,w:52,h:18,angle:-90},{x:1436,y:568,w:52,h:18,angle:-90},{x:1468,y:568,w:52,h:18,angle:-90},{x:1499.5,y:568,w:52,h:17,angle:-90},{x:1532,y:568,w:52,h:18,angle:-90},{x:1564,y:568,w:52,h:18,angle:-90},{x:1596,y:568,w:52,h:18,angle:-90},{x:1628,y:568,w:52,h:18,angle:-90},{x:1660,y:568,w:52,h:18,angle:-90},{x:1692,y:568,w:52,h:18,angle:-90},{x:1756,y:568,w:52,h:18,angle:-90},{x:1788.5,y:568,w:52,h:19,angle:-90},{x:1820.5,y:568,w:52,h:19,angle:-90},{x:1852.5,y:568,w:52,h:19,angle:-90},{x:1913,y:568,w:52,h:12,angle:-90}]},connection_blocks:[`min_x`,`max_x`]},{slug:`straight-double-line`,top_extract:{blocks:[{x:533,y:497.5,w:53,h:18,angle:-90},{x:20.5,y:517,w:52,h:17,angle:-90},{x:52.5,y:517,w:52,h:17,angle:-90},{x:84.5,y:517,w:52,h:17,angle:-90},{x:116.5,y:517,w:52,h:17,angle:-90},{x:148.5,y:517,w:52,h:17,angle:-90},{x:181,y:517,w:52,h:18,angle:-90},{x:213,y:517,w:52,h:18,angle:-90},{x:244.5,y:517,w:52,h:17,angle:-90},{x:277,y:517,w:52,h:18,angle:-90},{x:308.5,y:517,w:52,h:17,angle:-90},{x:341,y:517,w:52,h:18,angle:-90},{x:372.5,y:517,w:52,h:17,angle:-90},{x:404.5,y:517,w:52,h:17,angle:-90},{x:437,y:517,w:52,h:18,angle:-90},{x:468.5,y:517,w:52,h:17,angle:-90},{x:501,y:517,w:52,h:18,angle:-90},{x:565,y:517,w:52,h:18,angle:-90},{x:597,y:517,w:52,h:18,angle:-90},{x:629,y:517,w:52,h:18,angle:-90},{x:660.5,y:517,w:52,h:17,angle:-90},{x:693,y:517,w:52,h:18,angle:-90},{x:725,y:517,w:52,h:18,angle:-90},{x:757,y:517,w:52,h:18,angle:-90},{x:789,y:517,w:52,h:18,angle:-90},{x:821,y:517,w:52,h:18,angle:-90},{x:853,y:517,w:52,h:18,angle:-90},{x:885,y:517,w:52,h:18,angle:-90},{x:917,y:517,w:52,h:18,angle:-90},{x:949,y:517,w:52,h:18,angle:-90},{x:981,y:517,w:52,h:18,angle:-90},{x:1013,y:517,w:52,h:18,angle:-90},{x:1045,y:517,w:52,h:18,angle:-90},{x:1077,y:517,w:52,h:18,angle:-90},{x:1109,y:517,w:52,h:18,angle:-90},{x:1141,y:517,w:52,h:18,angle:-90},{x:1173,y:517,w:52,h:18,angle:-90},{x:1205,y:517,w:52,h:18,angle:-90},{x:1236.5,y:517,w:52,h:17,angle:-90},{x:1269,y:517,w:52,h:18,angle:-90},{x:1301,y:517,w:52,h:18,angle:-90},{x:1333,y:517,w:52,h:18,angle:-90},{x:1365,y:517,w:52,h:18,angle:-90},{x:1397,y:517,w:52,h:18,angle:-90},{x:1429,y:517,w:52,h:18,angle:-90},{x:1461,y:517,w:52,h:18,angle:-90},{x:1493,y:517,w:52,h:18,angle:-90},{x:1525,y:517,w:52,h:18,angle:-90},{x:1557,y:517,w:52,h:18,angle:-90},{x:1589,y:517,w:52,h:18,angle:-90},{x:1621,y:517,w:52,h:18,angle:-90},{x:1653,y:517,w:52,h:18,angle:-90},{x:1685,y:517,w:52,h:18,angle:-90},{x:1716,y:517,w:52,h:22,angle:-90},{x:1749.5,y:517.5,w:53,h:19,angle:-90},{x:1785,y:517.5,w:53,h:24,angle:-90},{x:1817,y:517.5,w:53,h:28,angle:-90},{x:1849,y:517.5,w:53,h:28,angle:-90},{x:1881,y:517.5,w:53,h:28,angle:-90},{x:1908.5,y:517.5,w:53,h:21,angle:-90},{x:533,y:550.5,w:53,h:18,angle:-90},{x:1749.5,y:583.5,w:53,h:19,angle:-90},{x:1786,y:583.5,w:53,h:26,angle:-90},{x:1849,y:583.5,w:53,h:28,angle:-90},{x:1893,y:583.5,w:53,h:52,angle:-90},{x:20.5,y:584,w:52,h:17,angle:-90},{x:52.5,y:584,w:52,h:17,angle:-90},{x:84.5,y:584,w:52,h:17,angle:-90},{x:116.5,y:584,w:52,h:17,angle:-90},{x:148.5,y:584,w:52,h:17,angle:-90},{x:181,y:584,w:52,h:18,angle:-90},{x:212.5,y:584,w:52,h:17,angle:-90},{x:245,y:584,w:52,h:18,angle:-90},{x:276.5,y:584,w:52,h:17,angle:-90},{x:308.5,y:584,w:52,h:17,angle:-90},{x:340.5,y:584,w:52,h:17,angle:-90},{x:373,y:584,w:52,h:18,angle:-90},{x:405,y:584,w:52,h:18,angle:-90},{x:436.5,y:584,w:52,h:17,angle:-90},{x:468.5,y:584,w:52,h:17,angle:-90},{x:501,y:584,w:52,h:18,angle:-90},{x:565,y:584,w:52,h:18,angle:-90},{x:597,y:584,w:52,h:18,angle:-90},{x:628.5,y:584,w:52,h:17,angle:-90},{x:660.5,y:584,w:52,h:17,angle:-90},{x:693,y:584,w:52,h:18,angle:-90},{x:725,y:584,w:52,h:18,angle:-90},{x:757,y:584,w:52,h:18,angle:-90},{x:789,y:584,w:52,h:18,angle:-90},{x:821,y:584,w:52,h:18,angle:-90},{x:853,y:584,w:52,h:18,angle:-90},{x:885,y:584,w:52,h:18,angle:-90},{x:917,y:584,w:52,h:18,angle:-90},{x:949,y:584,w:52,h:18,angle:-90},{x:981,y:584,w:52,h:18,angle:-90},{x:1013,y:584,w:52,h:18,angle:-90},{x:1045,y:584,w:52,h:18,angle:-90},{x:1077,y:584,w:52,h:18,angle:-90},{x:1109,y:584,w:52,h:18,angle:-90},{x:1141,y:584,w:52,h:18,angle:-90},{x:1173,y:584,w:52,h:18,angle:-90},{x:1205,y:584,w:52,h:18,angle:-90},{x:1236.5,y:584,w:52,h:17,angle:-90},{x:1269,y:584,w:52,h:18,angle:-90},{x:1301,y:584,w:52,h:18,angle:-90},{x:1333,y:584,w:52,h:18,angle:-90},{x:1365,y:584,w:52,h:18,angle:-90},{x:1397,y:584,w:52,h:18,angle:-90},{x:1429,y:584,w:52,h:18,angle:-90},{x:1461,y:584,w:52,h:18,angle:-90},{x:1493,y:584,w:52,h:18,angle:-90},{x:1525,y:584,w:52,h:18,angle:-90},{x:1557,y:584,w:52,h:18,angle:-90},{x:1589,y:584,w:52,h:18,angle:-90},{x:1621,y:584,w:52,h:18,angle:-90},{x:1653,y:584,w:52,h:18,angle:-90},{x:1685,y:584,w:52,h:18,angle:-90},{x:1717.5,y:584,w:52,h:19,angle:-90},{x:1817,y:584,w:52,h:28,angle:-90},{x:533,y:603.5,w:53,h:18,angle:-90}]},connection_blocks:[1,65,59,64]},{slug:`curve`,top_extract:{blocks:[{x:8.5,y:490,w:52,h:17,angle:-90},{x:40,y:490,w:52,h:18,angle:-90},{x:72,y:490,w:52,h:18,angle:-90},{x:104,y:490,w:52,h:18,angle:-90},{x:136,y:490,w:52,h:18,angle:-90},{x:168,y:490,w:52,h:18,angle:-90},{x:200,y:490,w:52,h:18,angle:-90},{x:232,y:490,w:52,h:18,angle:-90},{x:265.5,y:490,w:52,h:17,angle:-90},{x:297.5,y:490,w:52,h:17,angle:-90},{x:329.5,y:490,w:52,h:17,angle:-90},{x:361.5,y:490,w:52,h:17,angle:-90},{x:393.5,y:490,w:52,h:17,angle:-90},{x:425.5,y:490,w:52,h:17,angle:-90},{x:457.5,y:490,w:52,h:17,angle:-90},{x:489.5,y:490,w:52,h:17,angle:-90},{x:521.5,y:490,w:52,h:17,angle:-90},{x:553.5,y:490,w:52,h:17,angle:-90},{x:585.5,y:490,w:52,h:17,angle:-90},{x:617.5,y:490,w:52,h:17,angle:-90},{x:649.5,y:490,w:52,h:17,angle:-90},{x:681.5,y:490,w:52,h:17,angle:-90},{x:714.5,y:490,w:52,h:17,angle:-90},{x:746.5,y:490,w:52,h:17,angle:-90},{x:780.1,y:493,w:53.2,h:18.2,angle:-81.9},{x:813.3,y:500.1,w:53,h:18.3,angle:-73.7},{x:845.3,y:512.1,w:53.1,h:18.5,angle:-65.6},{x:875.1,y:528.4,w:53.2,h:18.4,angle:-56.9},{x:902.6,y:549,w:53.2,h:19,angle:-49},{x:926.4,y:572.7,w:53,h:19.1,angle:-40.6},{x:946.8,y:600.2,w:53.1,h:18.6,angle:-32.7},{x:963.2,y:630,w:53.2,h:18.5,angle:-24.1},{x:975.2,y:661.8,w:53.4,h:18.4,angle:-16.5},{x:982.3,y:695.1,w:53.2,h:18.3,angle:-8.5},{x:985,y:729,w:52,h:18,angle:0},{x:985,y:759.5,w:52,h:17,angle:0},{x:985,y:791.5,w:52,h:17,angle:0},{x:985,y:823.5,w:52,h:17,angle:0},{x:985,y:855.5,w:52,h:17,angle:0},{x:985,y:887.5,w:52,h:17,angle:0},{x:985,y:919.5,w:52,h:17,angle:0},{x:985,y:951.5,w:52,h:17,angle:0},{x:985,y:983.5,w:52,h:17,angle:0},{x:985,y:1015.5,w:52,h:17,angle:0},{x:985,y:1047.5,w:52,h:17,angle:0},{x:985,y:1075,w:52,h:8,angle:0}]}},{slug:`double-curve`,top_extract:{blocks:[{x:681.5,y:403.5,w:53,h:17,angle:-90},{x:649.5,y:422.5,w:53,h:17,angle:-90},{x:8.5,y:423,w:52,h:17,angle:-90},{x:40,y:423,w:52,h:18,angle:-90},{x:72,y:423,w:52,h:18,angle:-90},{x:104,y:423,w:52,h:18,angle:-90},{x:136,y:423,w:52,h:18,angle:-90},{x:168,y:423,w:52,h:18,angle:-90},{x:200,y:423,w:52,h:18,angle:-90},{x:232,y:423,w:52,h:18,angle:-90},{x:265.5,y:423,w:52,h:17,angle:-90},{x:297.5,y:423,w:52,h:17,angle:-90},{x:329.5,y:423,w:52,h:17,angle:-90},{x:361.5,y:423,w:52,h:17,angle:-90},{x:393.5,y:423,w:52,h:17,angle:-90},{x:425.5,y:423,w:52,h:17,angle:-90},{x:457.5,y:423,w:52,h:17,angle:-90},{x:489.5,y:423,w:52,h:17,angle:-90},{x:521.5,y:423,w:52,h:17,angle:-90},{x:553.5,y:423,w:52,h:17,angle:-90},{x:585.5,y:423,w:52,h:17,angle:-90},{x:617.5,y:423,w:52,h:17,angle:-90},{x:714.5,y:423,w:52,h:17,angle:-90},{x:746.5,y:423,w:52,h:17,angle:-90},{x:778.3,y:425.1,w:53.3,h:18.4,angle:-84.1},{x:809.8,y:430.2,w:53.2,h:18.3,angle:-77.9},{x:840.8,y:438.3,w:53.2,h:18.5,angle:-72.1},{x:870.5,y:449.8,w:53.5,h:19,angle:-65.6},{x:681.5,y:456.5,w:53,h:17,angle:-90},{x:899.1,y:464.5,w:53.4,h:19,angle:-60.9},{x:925.9,y:481.9,w:53.4,h:18.6,angle:-54.2},{x:8.5,y:490,w:52,h:17,angle:-90},{x:40,y:490,w:52,h:18,angle:-90},{x:72,y:490,w:52,h:18,angle:-90},{x:104,y:490,w:52,h:18,angle:-90},{x:136,y:490,w:52,h:18,angle:-90},{x:168,y:490,w:52,h:18,angle:-90},{x:200,y:490,w:52,h:18,angle:-90},{x:232,y:490,w:52,h:18,angle:-90},{x:265.5,y:490,w:52,h:17,angle:-90},{x:297.5,y:490,w:52,h:17,angle:-90},{x:329.5,y:490,w:52,h:17,angle:-90},{x:361.5,y:490,w:52,h:17,angle:-90},{x:393.5,y:490,w:52,h:17,angle:-90},{x:425.5,y:490,w:52,h:17,angle:-90},{x:457.5,y:490,w:52,h:17,angle:-90},{x:489.5,y:490,w:52,h:17,angle:-90},{x:521.5,y:490,w:52,h:17,angle:-90},{x:553.5,y:490,w:52,h:17,angle:-90},{x:585.5,y:490,w:52,h:17,angle:-90},{x:617.5,y:490,w:52,h:17,angle:-90},{x:649.5,y:490,w:52,h:17,angle:-90},{x:714.5,y:490,w:52,h:17,angle:-90},{x:746.5,y:490,w:52,h:17,angle:-90},{x:780.1,y:492.9,w:53.5,h:18.5,angle:-81.9},{x:813.4,y:500,w:53.3,h:18.7,angle:-73.6},{x:950.7,y:502,w:53.8,h:18.7,angle:-47.5},{x:681.5,y:509.5,w:53,h:17,angle:-90},{x:845.5,y:512,w:53.4,h:18.8,angle:-65.7},{x:973.5,y:524.7,w:53.3,h:18.9,angle:-41.6},{x:875.2,y:528.3,w:53.3,h:18.8,angle:-57.8},{x:902.8,y:548.8,w:53.7,h:19,angle:-49.8},{x:993.2,y:549.4,w:54.1,h:19.6,angle:-35.2},{x:926.5,y:572.5,w:53.6,h:19,angle:-40.2},{x:1010.8,y:576.2,w:53.3,h:19.1,angle:-29.7},{x:947,y:600,w:53.8,h:19,angle:-32.3},{x:1025.5,y:604.9,w:53.7,h:18.8,angle:-23.5},{x:963.3,y:629.9,w:53.4,h:18.6,angle:-25.2},{x:1036.9,y:634.7,w:53.1,h:19,angle:-18.4},{x:975.1,y:661.7,w:53.4,h:18.5,angle:-15.9},{x:1045.1,y:665.4,w:53.3,h:19.2,angle:-13.6},{x:982.4,y:695.1,w:53.2,h:18.4,angle:-8.4},{x:1050.1,y:697.2,w:53.4,h:18.7,angle:-6},{x:985,y:729,w:52,h:18,angle:0},{x:1052,y:729,w:52,h:18,angle:0},{x:985,y:759.5,w:52,h:17,angle:0},{x:1052,y:759.5,w:52,h:17,angle:0},{x:965.5,y:791.5,w:53,h:17,angle:0},{x:1018.5,y:791.5,w:53,h:17,angle:0},{x:1071.5,y:791.5,w:53,h:17,angle:0},{x:985,y:823.5,w:52,h:17,angle:0},{x:1052,y:823.5,w:52,h:17,angle:0},{x:985,y:855.5,w:52,h:17,angle:0},{x:1052,y:855.5,w:52,h:17,angle:0},{x:985,y:887.5,w:52,h:17,angle:0},{x:1052,y:887.5,w:52,h:17,angle:0},{x:985,y:919.5,w:52,h:17,angle:0},{x:1052,y:919.5,w:52,h:17,angle:0},{x:985,y:951.5,w:52,h:17,angle:0},{x:1052,y:951.5,w:52,h:17,angle:0},{x:985,y:983.5,w:52,h:17,angle:0},{x:1052,y:983.5,w:52,h:17,angle:0},{x:985,y:1015.5,w:52,h:17,angle:0},{x:1052,y:1015.5,w:52,h:17,angle:0},{x:985,y:1047.5,w:52,h:17,angle:0},{x:1052,y:1047.5,w:52,h:17,angle:0},{x:985,y:1075,w:52,h:8,angle:0},{x:1052,y:1075,w:52,h:8,angle:0}]}},{slug:`split`,top_extract:{blocks:[{x:903,y:21,w:52,h:18,angle:0},{x:903,y:53,w:52,h:18,angle:0},{x:903,y:85,w:52,h:18,angle:0},{x:903,y:117,w:52,h:18,angle:0},{x:903,y:149,w:52,h:18,angle:0},{x:903.5,y:181,w:53,h:18,angle:0},{x:903.5,y:213,w:53,h:18,angle:0},{x:903,y:244.5,w:52,h:17,angle:0},{x:901.1,y:274.7,w:53,h:18.4,angle:8.1},{x:894.7,y:304.5,w:53.3,h:18.7,angle:17.1},{x:884.1,y:333,w:53.3,h:18.8,angle:25},{x:869.5,y:359.5,w:53.2,h:18.9,angle:31.8},{x:851.4,y:383.6,w:53.5,h:18.7,angle:40.6},{x:830.1,y:405.2,w:53.2,h:18.8,angle:48.8},{x:805.4,y:423.5,w:53.3,h:18.8,angle:57.3},{x:778.9,y:438.1,w:53.1,h:18.7,angle:65.4},{x:750.6,y:448.6,w:53.2,h:18.6,angle:73.3},{x:720.8,y:455.1,w:53.4,h:18.4,angle:82.4},{x:658.5,y:457,w:52,h:17,angle:-90},{x:690.5,y:457,w:52,h:17,angle:-90},{x:626.5,y:471.5,w:53,h:17,angle:-90},{x:594.5,y:498.2,w:52.5,h:17,angle:-90},{x:17,y:524,w:52,h:18,angle:-90},{x:49,y:524,w:52,h:18,angle:-90},{x:81,y:524,w:52,h:18,angle:-90},{x:113,y:524,w:52,h:18,angle:-90},{x:146.5,y:524,w:52,h:17,angle:-90},{x:178.5,y:524,w:52,h:17,angle:-90},{x:210.5,y:524,w:52,h:17,angle:-90},{x:242.5,y:524,w:52,h:17,angle:-90},{x:274.5,y:524,w:52,h:17,angle:-90},{x:306.5,y:524,w:52,h:17,angle:-90},{x:338.5,y:524,w:52,h:17,angle:-90},{x:370.5,y:524,w:52,h:17,angle:-90},{x:402.5,y:524,w:52,h:17,angle:-90},{x:434.5,y:524,w:52,h:17,angle:-90},{x:466.5,y:524,w:52,h:17,angle:-90},{x:498.5,y:524,w:52,h:17,angle:-90},{x:530.5,y:524,w:52,h:17,angle:-90},{x:562.5,y:524,w:52,h:17,angle:-90},{x:690.5,y:524,w:52,h:17,angle:-90},{x:722.5,y:524,w:52,h:17,angle:-90},{x:754.5,y:524,w:52,h:17,angle:-90},{x:786.5,y:524,w:52,h:17,angle:-90},{x:818.5,y:524,w:52,h:17,angle:-90},{x:850.5,y:524,w:52,h:17,angle:-90},{x:882.5,y:524,w:52,h:17,angle:-90},{x:914.5,y:524,w:52,h:17,angle:-90},{x:946.5,y:524,w:52,h:17,angle:-90},{x:978.5,y:524,w:52,h:17,angle:-90},{x:1010.5,y:524,w:52,h:17,angle:-90},{x:1042.5,y:524,w:52,h:17,angle:-90},{x:1074.5,y:524,w:52,h:17,angle:-90},{x:1106.5,y:524,w:52,h:17,angle:-90},{x:1138.5,y:524,w:52,h:17,angle:-90},{x:1170.5,y:524,w:52,h:17,angle:-90},{x:1202.5,y:524,w:52,h:17,angle:-90},{x:1234.5,y:524,w:52,h:17,angle:-90},{x:1266.5,y:524,w:52,h:17,angle:-90},{x:1298.5,y:524,w:52,h:17,angle:-90},{x:1330.5,y:524,w:52,h:17,angle:-90},{x:1362.5,y:524,w:52,h:17,angle:-90},{x:1394.5,y:524,w:52,h:17,angle:-90},{x:1426.5,y:524,w:52,h:17,angle:-90},{x:1458.5,y:524,w:52,h:17,angle:-90},{x:1490.5,y:524,w:52,h:17,angle:-90},{x:1522.5,y:524,w:52,h:17,angle:-90},{x:1554.5,y:524,w:52,h:17,angle:-90},{x:1586.5,y:524,w:52,h:17,angle:-90},{x:1618.5,y:524,w:52,h:17,angle:-90},{x:1650,y:524,w:52,h:18,angle:-90},{x:1682,y:524,w:52,h:18,angle:-90},{x:1714.5,y:524,w:52,h:17,angle:-90},{x:1748,y:524,w:52,h:18,angle:-90},{x:1779.5,y:524,w:52,h:19,angle:-90},{x:1811.5,y:524,w:52,h:19,angle:-90},{x:1843.5,y:524,w:52,h:19,angle:-90},{x:1875.5,y:524,w:52,h:19,angle:-90},{x:1907.5,y:524,w:52,h:19,angle:-90},{x:626.5,y:524.5,w:53,h:17,angle:-90},{x:658.5,y:524.5,w:53,h:17,angle:-90},{x:594.5,y:550.8,w:52.5,h:17,angle:-90},{x:626.5,y:577.5,w:53,h:17,angle:-90},{x:658.5,y:591,w:52,h:17,angle:-90},{x:690.5,y:592,w:52,h:17,angle:-90},{x:720.8,y:594,w:53.2,h:18.5,angle:-81.9},{x:750.4,y:600.3,w:53.2,h:18.6,angle:-73.7},{x:778.8,y:610.9,w:53.2,h:18.6,angle:-65.2},{x:805.7,y:625.6,w:53.3,h:18.7,angle:-57.1},{x:830,y:643.9,w:53.3,h:18.7,angle:-48.8},{x:851.3,y:665.3,w:53.2,h:18.5,angle:-41.2},{x:869.5,y:689.6,w:53.2,h:18.7,angle:-32.5},{x:884.2,y:716.3,w:53.2,h:18.7,angle:-24.8},{x:894.7,y:744.6,w:53.1,h:18.5,angle:-16.3},{x:901.2,y:774.3,w:53.2,h:18.4,angle:-8.1},{x:903,y:804.5,w:52,h:17,angle:0},{x:903,y:835.5,w:52,h:17,angle:0},{x:903,y:867.5,w:52,h:17,angle:0},{x:903,y:899.5,w:52,h:17,angle:0},{x:903,y:931.5,w:52,h:17,angle:0},{x:903,y:963.5,w:52,h:17,angle:0},{x:903.5,y:995.5,w:53,h:17,angle:0},{x:903.5,y:1027.5,w:53,h:17,angle:0},{x:903.5,y:1059.5,w:53,h:17,angle:0}]},connection_blocks:[`min_x`,`max_x`,`min_y`,`max_y`]},{slug:`double-split`,top_extract:{blocks:[{x:919,y:26.5,w:52,h:17,angle:0},{x:986,y:27,w:52,h:18,angle:0},{x:919,y:58.5,w:52,h:17,angle:0},{x:986,y:58.5,w:52,h:17,angle:0},{x:919,y:91,w:52,h:18,angle:0},{x:986,y:91,w:52,h:18,angle:0},{x:899,y:123,w:54,h:18,angle:0},{x:953,y:123,w:54,h:18,angle:0},{x:1007,y:123,w:54,h:18,angle:0},{x:918.5,y:153,w:53,h:18,angle:0},{x:985,y:153.5,w:52,h:17,angle:0},{x:986,y:182.6,w:53.4,h:19.2,angle:5},{x:915.8,y:186,w:53.5,h:18.5,angle:8.1},{x:981.3,y:212.1,w:53.6,h:18.9,angle:11.7},{x:909.5,y:215.9,w:53.6,h:18.8,angle:15.9},{x:973.8,y:240.8,w:53.1,h:18.7,angle:18.4},{x:898.9,y:244.4,w:53.7,h:19,angle:23.6},{x:963,y:268,w:53.3,h:18.3,angle:23.8},{x:884.2,y:270.8,w:53.8,h:18.9,angle:33.7},{x:949.8,y:294.5,w:53.2,h:18.6,angle:30.3},{x:866.2,y:295.3,w:53.7,h:19,angle:40.2},{x:844.6,y:316.6,w:53.5,h:18.3,angle:49.4},{x:933.4,y:319.3,w:53.4,h:19.1,angle:35.2},{x:820.4,y:334.8,w:53.6,h:19.1,angle:58},{x:914.8,y:342.2,w:53.6,h:18.6,angle:41.6},{x:793.6,y:349.6,w:53.9,h:19,angle:66},{x:765.1,y:360,w:53.4,h:18.5,angle:73.7},{x:894.1,y:363.1,w:53.7,h:19,angle:47.6},{x:735.6,y:366.6,w:53.3,h:18.5,angle:81.9},{x:705,y:368.5,w:53,h:18,angle:-90},{x:673,y:376.5,w:53,h:18,angle:-90},{x:871.2,y:381.7,w:53.4,h:19.1,angle:54.5},{x:846.4,y:397.6,w:53.7,h:19,angle:59.5},{x:641.5,y:403.6,w:53.2,h:17,angle:-90},{x:820,y:411.3,w:53.5,h:19.2,angle:66},{x:792.3,y:421.9,w:53.2,h:18.8,angle:72.2},{x:673,y:429.5,w:53,h:18,angle:-90},{x:763.8,y:429.6,w:53.5,h:18.5,angle:78.1},{x:734.8,y:434.2,w:53.3,h:18.2,angle:84.4},{x:705,y:435.5,w:53,h:18,angle:-90},{x:609.5,y:436,w:52,h:17,angle:-90},{x:577.5,y:456.6,w:53.2,h:17,angle:-90},{x:641.5,y:456.8,w:53.2,h:17,angle:-90},{x:545.5,y:483.5,w:53,h:17,angle:-90},{x:4.5,y:503,w:52,h:9,angle:-90},{x:32.5,y:503,w:52,h:17,angle:-90},{x:64.5,y:503,w:52,h:17,angle:-90},{x:96.5,y:503,w:52,h:17,angle:-90},{x:128.5,y:503,w:52,h:17,angle:-90},{x:160.5,y:503,w:52,h:17,angle:-90},{x:193.5,y:503,w:52,h:17,angle:-90},{x:225.5,y:503,w:52,h:17,angle:-90},{x:257.5,y:503,w:52,h:17,angle:-90},{x:289.5,y:503,w:52,h:17,angle:-90},{x:321.5,y:503,w:52,h:17,angle:-90},{x:353.5,y:503,w:52,h:17,angle:-90},{x:385.5,y:503,w:52,h:17,angle:-90},{x:417.5,y:503,w:52,h:17,angle:-90},{x:449.5,y:503,w:52,h:17,angle:-90},{x:481.5,y:503,w:52,h:17,angle:-90},{x:513.5,y:503,w:52,h:17,angle:-90},{x:609.5,y:503,w:52,h:17,angle:-90},{x:673.5,y:503,w:52,h:17,angle:-90},{x:705.5,y:503,w:52,h:17,angle:-90},{x:737.5,y:503,w:52,h:17,angle:-90},{x:769.5,y:503,w:52,h:17,angle:-90},{x:801.5,y:503,w:52,h:17,angle:-90},{x:833.5,y:503,w:52,h:17,angle:-90},{x:865.5,y:503,w:52,h:17,angle:-90},{x:897.5,y:503,w:52,h:17,angle:-90},{x:929.5,y:503,w:52,h:17,angle:-90},{x:961.5,y:503,w:52,h:17,angle:-90},{x:993.5,y:503,w:52,h:17,angle:-90},{x:1025.5,y:503,w:52,h:17,angle:-90},{x:1057.5,y:503,w:52,h:17,angle:-90},{x:1089.5,y:503,w:52,h:17,angle:-90},{x:1121.5,y:503,w:52,h:17,angle:-90},{x:1153.5,y:503,w:52,h:17,angle:-90},{x:1185.5,y:503,w:52,h:17,angle:-90},{x:1217.5,y:503,w:52,h:17,angle:-90},{x:1249.5,y:503,w:52,h:17,angle:-90},{x:1281.5,y:503,w:52,h:17,angle:-90},{x:1313.5,y:503,w:52,h:17,angle:-90},{x:1345.5,y:503,w:52,h:17,angle:-90},{x:1377.5,y:503,w:52,h:17,angle:-90},{x:1409,y:503,w:52,h:18,angle:-90},{x:1441,y:503,w:52,h:18,angle:-90},{x:1473,y:503,w:52,h:18,angle:-90},{x:1537,y:503,w:52,h:18,angle:-90},{x:1505,y:503.5,w:53,h:18,angle:-90},{x:1569,y:503.5,w:53,h:18,angle:-90},{x:1601.5,y:503.5,w:53,h:19,angle:-90},{x:1633.5,y:503.5,w:53,h:19,angle:-90},{x:1665.5,y:503.5,w:53,h:19,angle:-90},{x:1697.5,y:503.5,w:53,h:19,angle:-90},{x:1729.5,y:503.5,w:53,h:19,angle:-90},{x:1762,y:503.5,w:53,h:20,angle:-90},{x:1792,y:503.5,w:53,h:18,angle:-90},{x:1823.5,y:503.5,w:53,h:19,angle:-90},{x:1855,y:503.5,w:53,h:20,angle:-90},{x:1887,y:503.5,w:53,h:22,angle:-90},{x:1914,y:504,w:54,h:10,angle:-90},{x:577.5,y:509.9,w:53.2,h:17,angle:-90},{x:641.5,y:509.9,w:53.2,h:17,angle:-90},{x:545.5,y:536.5,w:53,h:17,angle:-90},{x:577.5,y:563.1,w:53.2,h:17,angle:-90},{x:641.5,y:563.1,w:53.2,h:17,angle:-90},{x:4.5,y:570,w:52,h:9,angle:-90},{x:32.5,y:570,w:52,h:17,angle:-90},{x:64.5,y:570,w:52,h:17,angle:-90},{x:96.5,y:570,w:52,h:17,angle:-90},{x:128.5,y:570,w:52,h:17,angle:-90},{x:160.5,y:570,w:52,h:17,angle:-90},{x:193.5,y:570,w:52,h:17,angle:-90},{x:225.5,y:570,w:52,h:17,angle:-90},{x:257.5,y:570,w:52,h:17,angle:-90},{x:289.5,y:570,w:52,h:17,angle:-90},{x:321.5,y:570,w:52,h:17,angle:-90},{x:353.5,y:570,w:52,h:17,angle:-90},{x:385.5,y:570,w:52,h:17,angle:-90},{x:417.5,y:570,w:52,h:17,angle:-90},{x:449.5,y:570,w:52,h:17,angle:-90},{x:481.5,y:570,w:52,h:17,angle:-90},{x:513.5,y:570,w:52,h:17,angle:-90},{x:609.5,y:570,w:52,h:17,angle:-90},{x:673.5,y:570,w:52,h:17,angle:-90},{x:705.5,y:570,w:52,h:17,angle:-90},{x:737.5,y:570,w:52,h:17,angle:-90},{x:769.5,y:570,w:52,h:17,angle:-90},{x:801.5,y:570,w:52,h:17,angle:-90},{x:833.5,y:570,w:52,h:17,angle:-90},{x:865.5,y:570,w:52,h:17,angle:-90},{x:897.5,y:570,w:52,h:17,angle:-90},{x:929.5,y:570,w:52,h:17,angle:-90},{x:961.5,y:570,w:52,h:17,angle:-90},{x:993.5,y:570,w:52,h:17,angle:-90},{x:1025.5,y:570,w:52,h:17,angle:-90},{x:1057.5,y:570,w:52,h:17,angle:-90},{x:1089.5,y:570,w:52,h:17,angle:-90},{x:1121.5,y:570,w:52,h:17,angle:-90},{x:1153.5,y:570,w:52,h:17,angle:-90},{x:1185.5,y:570,w:52,h:17,angle:-90},{x:1217.5,y:570,w:52,h:17,angle:-90},{x:1249.5,y:570,w:52,h:17,angle:-90},{x:1281.5,y:570,w:52,h:17,angle:-90},{x:1313.5,y:570,w:52,h:17,angle:-90},{x:1345.5,y:570,w:52,h:17,angle:-90},{x:1377,y:570,w:52,h:18,angle:-90},{x:1409.5,y:570,w:52,h:17,angle:-90},{x:1441.5,y:570,w:52,h:17,angle:-90},{x:1473,y:570,w:52,h:18,angle:-90},{x:1505,y:570,w:52,h:18,angle:-90},{x:1537,y:570,w:52,h:18,angle:-90},{x:1569,y:570,w:52,h:18,angle:-90},{x:1601,y:570,w:52,h:18,angle:-90},{x:1633.5,y:570,w:52,h:19,angle:-90},{x:1665.5,y:570,w:52,h:19,angle:-90},{x:1697.5,y:570,w:52,h:19,angle:-90},{x:1729.5,y:570,w:52,h:19,angle:-90},{x:1761.5,y:570,w:52,h:19,angle:-90},{x:1792,y:570,w:52,h:18,angle:-90},{x:1823,y:570,w:52,h:20,angle:-90},{x:1855.5,y:570,w:52,h:21,angle:-90},{x:1887,y:570,w:52,h:20,angle:-90},{x:1913.5,y:570,w:52,h:11,angle:-90},{x:545.5,y:589.5,w:53,h:17,angle:-90},{x:641.5,y:616.2,w:53.2,h:17,angle:-90},{x:577.5,y:616.4,w:53.2,h:17,angle:-90},{x:735,y:636.8,w:53.5,h:18.2,angle:-84.6},{x:609.5,y:637.5,w:53,h:17,angle:-90},{x:705.5,y:637.5,w:53,h:17,angle:-90},{x:764.1,y:641.4,w:53.4,h:18.8,angle:-78.2},{x:673,y:644.5,w:53,h:18,angle:-90},{x:792.5,y:649,w:53.4,h:18.7,angle:-71.6},{x:820.2,y:659.6,w:53.3,h:19,angle:-65.6},{x:641.5,y:669.4,w:53.2,h:17,angle:-90},{x:846.6,y:673.3,w:53.6,h:18.9,angle:-59.9},{x:871.1,y:689,w:53.2,h:18.8,angle:-54},{x:673,y:697.5,w:53,h:18,angle:-90},{x:705.5,y:704.5,w:53,h:17,angle:-90},{x:738,y:706.9,w:53.4,h:18.6,angle:-81.3},{x:894.4,y:707.9,w:53.2,h:19.2,angle:-46.7},{x:767.8,y:713.5,w:53.4,h:18.4,angle:-73.7},{x:796.1,y:723.9,w:53.5,h:18.9,angle:-65.8},{x:915.2,y:728.8,w:53.3,h:19.2,angle:-42.3},{x:822.9,y:738.7,w:53.6,h:18.7,angle:-57.4},{x:933.9,y:751.7,w:53.4,h:19,angle:-36.9},{x:847.2,y:756.8,w:53.3,h:19,angle:-49.8},{x:949.9,y:776.4,w:53.2,h:19,angle:-29.7},{x:868.7,y:778.4,w:53.6,h:18.9,angle:-40.6},{x:886.8,y:802.4,w:53.5,h:18.5,angle:-32.9},{x:963.3,y:802.7,w:53.5,h:18.7,angle:-25},{x:901.4,y:829.3,w:53.2,h:18.5,angle:-24.4},{x:974,y:830.4,w:53.4,h:18.3,angle:-18.4},{x:912.1,y:858,w:53.4,h:19.1,angle:-17.1},{x:981.5,y:858.9,w:53.4,h:18.6,angle:-12.3},{x:918.5,y:887.4,w:53.2,h:18.4,angle:-8.1},{x:986.1,y:888.2,w:53.3,h:18.3,angle:-5.7},{x:920.5,y:917.5,w:53,h:17,angle:0},{x:987.5,y:917.5,w:53,h:17,angle:0},{x:899,y:949.5,w:54,h:17,angle:0},{x:953,y:949.5,w:54,h:17,angle:0},{x:1007,y:949.5,w:54,h:17,angle:0},{x:920.5,y:981.5,w:53,h:17,angle:0},{x:987.5,y:981.5,w:53,h:17,angle:0},{x:920.5,y:1013.5,w:53,h:17,angle:0},{x:987.5,y:1013.5,w:53,h:17,angle:0},{x:920.5,y:1045.5,w:53,h:17,angle:0},{x:987.5,y:1045.5,w:53,h:17,angle:0},{x:920.5,y:1074,w:53,h:10,angle:0},{x:987.5,y:1074,w:53,h:10,angle:0}]},connection_blocks:[0,1,44,107,101,164,209,210]},{slug:`field-starter`,top_extract:{blocks:[{x:706,y:50.5,w:47,h:16,angle:-90},{x:763.5,y:50.5,w:47,h:15,angle:-90},{x:850,y:50.5,w:47,h:16,angle:-90},{x:907.5,y:50.5,w:47,h:15,angle:-90},{x:994,y:50.5,w:47,h:16,angle:-90},{x:1080.5,y:50.5,w:47,h:15,angle:-90},{x:1108.5,y:50.5,w:47,h:13,angle:-90},{x:1138,y:50.5,w:47,h:16,angle:-90},{x:1167.5,y:50.5,w:47,h:13,angle:-90},{x:1195.5,y:50.5,w:47,h:15,angle:-90},{x:1224.5,y:50.5,w:47,h:15,angle:-90},{x:1253,y:50.5,w:47,h:14,angle:-90},{x:1282,y:50.5,w:47,h:16,angle:-90},{x:1311.5,y:50.5,w:47,h:13,angle:-90},{x:1339.5,y:50.5,w:47,h:15,angle:-90},{x:1368.5,y:50.5,w:47,h:15,angle:-90},{x:532.5,y:51,w:46,h:13,angle:-90},{x:562,y:51,w:46,h:16,angle:-90},{x:591.5,y:51,w:46,h:13,angle:-90},{x:619.5,y:51,w:46,h:15,angle:-90},{x:648.5,y:51,w:46,h:15,angle:-90},{x:676.5,y:51,w:46,h:13,angle:-90},{x:735.5,y:51,w:46,h:13,angle:-90},{x:792.5,y:51,w:46,h:15,angle:-90},{x:820.5,y:51,w:46,h:13,angle:-90},{x:879.5,y:51,w:46,h:13,angle:-90},{x:936.5,y:51,w:46,h:15,angle:-90},{x:964.5,y:51,w:46,h:13,angle:-90},{x:1023.5,y:51,w:46,h:13,angle:-90},{x:1051.5,y:51,w:46,h:15,angle:-90},{x:533,y:110.5,w:45,h:14,angle:-90},{x:591,y:110.5,w:45,h:14,angle:-90},{x:676.5,y:110.5,w:45,h:13,angle:-90},{x:706,y:110.5,w:45,h:16,angle:-90},{x:735,y:110.5,w:45,h:14,angle:-90},{x:763.5,y:110.5,w:45,h:15,angle:-90},{x:850,y:110.5,w:45,h:16,angle:-90},{x:879,y:110.5,w:45,h:14,angle:-90},{x:907.5,y:110.5,w:45,h:15,angle:-90},{x:964.5,y:110.5,w:45,h:13,angle:-90},{x:1023,y:110.5,w:45,h:14,angle:-90},{x:1108.5,y:110.5,w:45,h:13,angle:-90},{x:1195.5,y:110.5,w:45,h:15,angle:-90},{x:1224.5,y:110.5,w:45,h:15,angle:-90},{x:1253,y:110.5,w:45,h:14,angle:-90},{x:1310.5,y:110.5,w:45,h:15,angle:-90},{x:562,y:111,w:46,h:16,angle:-90},{x:619.5,y:111,w:46,h:15,angle:-90},{x:994,y:111,w:46,h:16,angle:-90},{x:1166.5,y:111,w:46,h:15,angle:-90},{x:648.5,y:111.5,w:47,h:15,angle:-90},{x:792.5,y:111.5,w:47,h:15,angle:-90},{x:821,y:111.5,w:47,h:16,angle:-90},{x:936.5,y:111.5,w:47,h:15,angle:-90},{x:1051.5,y:111.5,w:47,h:15,angle:-90},{x:1080.5,y:111.5,w:47,h:15,angle:-90},{x:1138,y:111.5,w:47,h:16,angle:-90},{x:1282,y:111.5,w:47,h:16,angle:-90},{x:1339.5,y:111.5,w:47,h:15,angle:-90},{x:1368.5,y:111.5,w:47,h:15,angle:-90},{x:533,y:171.5,w:47,h:14,angle:-90},{x:562,y:171.5,w:47,h:16,angle:-90},{x:591.5,y:171.5,w:47,h:13,angle:-90},{x:619.5,y:171.5,w:47,h:15,angle:-90},{x:648.5,y:171.5,w:47,h:15,angle:-90},{x:677,y:171.5,w:47,h:14,angle:-90},{x:706,y:171.5,w:47,h:16,angle:-90},{x:735,y:171.5,w:47,h:14,angle:-90},{x:763.5,y:171.5,w:47,h:15,angle:-90},{x:792.5,y:171.5,w:47,h:15,angle:-90},{x:878.5,y:171.5,w:47,h:15,angle:-90},{x:907.5,y:171.5,w:47,h:15,angle:-90},{x:936.5,y:171.5,w:47,h:15,angle:-90},{x:965,y:171.5,w:47,h:14,angle:-90},{x:994,y:171.5,w:47,h:16,angle:-90},{x:1023,y:171.5,w:47,h:14,angle:-90},{x:1051.5,y:171.5,w:47,h:15,angle:-90},{x:1080.5,y:171.5,w:47,h:15,angle:-90},{x:1195.5,y:171.5,w:47,h:15,angle:-90},{x:1224.5,y:171.5,w:47,h:15,angle:-90},{x:1253,y:171.5,w:47,h:14,angle:-90},{x:1282,y:171.5,w:47,h:16,angle:-90},{x:1310.5,y:171.5,w:47,h:15,angle:-90},{x:1339.5,y:171.5,w:47,h:15,angle:-90},{x:1368.5,y:171.5,w:47,h:15,angle:-90},{x:821,y:172,w:48,h:16,angle:-90},{x:850,y:172,w:48,h:16,angle:-90},{x:1109,y:172,w:48,h:16,angle:-90},{x:1138,y:172,w:48,h:16,angle:-90},{x:1167,y:172,w:48,h:16,angle:-90},{x:532.5,y:232.5,w:47,h:13,angle:-90},{x:562,y:232.5,w:47,h:16,angle:-90},{x:591.5,y:232.5,w:47,h:13,angle:-90},{x:619.5,y:232.5,w:47,h:15,angle:-90},{x:648.5,y:232.5,w:47,h:15,angle:-90},{x:676.5,y:232.5,w:47,h:13,angle:-90},{x:706,y:232.5,w:47,h:16,angle:-90},{x:735.5,y:232.5,w:47,h:15,angle:-90},{x:763.5,y:232.5,w:47,h:15,angle:-90},{x:792.5,y:232.5,w:47,h:15,angle:-90},{x:821,y:232.5,w:47,h:16,angle:-90},{x:850,y:232.5,w:47,h:16,angle:-90},{x:879,y:232.5,w:47,h:16,angle:-90},{x:907.5,y:232.5,w:47,h:15,angle:-90},{x:936.5,y:232.5,w:47,h:15,angle:-90},{x:964.5,y:232.5,w:47,h:13,angle:-90},{x:994,y:232.5,w:47,h:16,angle:-90},{x:1023,y:232.5,w:47,h:14,angle:-90},{x:1052,y:232.5,w:47,h:16,angle:-90},{x:1080.5,y:232.5,w:47,h:15,angle:-90},{x:1109,y:232.5,w:47,h:16,angle:-90},{x:1138,y:232.5,w:47,h:16,angle:-90},{x:1167,y:232.5,w:47,h:16,angle:-90},{x:1195.5,y:232.5,w:47,h:15,angle:-90},{x:1224.5,y:232.5,w:47,h:15,angle:-90},{x:1253,y:232.5,w:47,h:16,angle:-90},{x:1282,y:232.5,w:47,h:16,angle:-90},{x:1311.7,y:232.5,w:47.3,h:14.4,angle:-88.7},{x:1339.5,y:232.5,w:47,h:15,angle:-90},{x:1368.5,y:232.5,w:47,h:15,angle:-90},{x:508,y:284.5,w:485,h:28,angle:-90},{x:9.5,y:287.5,w:47,h:15,angle:-90},{x:38,y:287.5,w:47,h:16,angle:-90},{x:67,y:287.5,w:47,h:16,angle:-90},{x:95.5,y:287.5,w:47,h:15,angle:-90},{x:124,y:287.5,w:47,h:16,angle:-90},{x:153,y:287.5,w:47,h:16,angle:-90},{x:182,y:287.5,w:47,h:16,angle:-90},{x:211,y:287.5,w:47,h:16,angle:-90},{x:239.5,y:287.5,w:47,h:15,angle:-90},{x:268,y:287.5,w:47,h:16,angle:-90},{x:297,y:287.5,w:47,h:16,angle:-90},{x:326,y:287.5,w:47,h:16,angle:-90},{x:355,y:287.5,w:47,h:16,angle:-90},{x:383.5,y:287.5,w:47,h:15,angle:-90},{x:412,y:287.5,w:47,h:16,angle:-90},{x:441,y:287.5,w:47,h:16,angle:-90},{x:469.5,y:287.5,w:47,h:15,angle:-90},{x:532.5,y:292.5,w:47,h:13,angle:-90},{x:562,y:292.5,w:47,h:16,angle:-90},{x:591.5,y:292.5,w:47,h:13,angle:-90},{x:619.5,y:292.5,w:47,h:15,angle:-90},{x:648.5,y:292.5,w:47,h:15,angle:-90},{x:676.5,y:292.5,w:47,h:13,angle:-90},{x:706,y:292.5,w:47,h:16,angle:-90},{x:763.5,y:292.5,w:47,h:15,angle:-90},{x:792.5,y:292.5,w:47,h:15,angle:-90},{x:821,y:292.5,w:47,h:16,angle:-90},{x:850,y:292.5,w:47,h:16,angle:-90},{x:879,y:292.5,w:47,h:16,angle:-90},{x:907.5,y:292.5,w:47,h:15,angle:-90},{x:936.5,y:292.5,w:47,h:15,angle:-90},{x:965,y:292.5,w:47,h:14,angle:-90},{x:994,y:292.5,w:47,h:16,angle:-90},{x:1252,y:292.5,w:47,h:14,angle:-90},{x:1282,y:292.5,w:47,h:16,angle:-90},{x:1310.5,y:292.5,w:47,h:15,angle:-90},{x:1339.5,y:292.5,w:47,h:15,angle:-90},{x:1368.5,y:292.5,w:47,h:15,angle:-90},{x:735,y:293,w:48,h:16,angle:-90},{x:1023,y:293,w:48,h:16,angle:-90},{x:1052,y:293,w:48,h:16,angle:-90},{x:1080.5,y:293,w:48,h:15,angle:-90},{x:1109,y:293,w:48,h:16,angle:-90},{x:1138,y:293,w:48,h:16,angle:-90},{x:1167,y:293,w:48,h:16,angle:-90},{x:1196,y:293,w:48,h:16,angle:-90},{x:1224,y:293,w:48,h:16,angle:-90},{x:1109,y:353,w:48,h:16,angle:-90},{x:1196,y:353,w:48,h:16,angle:-90},{x:1224,y:353,w:48,h:16,angle:-90},{x:533.5,y:353.5,w:47,h:15,angle:-90},{x:562,y:353.5,w:47,h:16,angle:-90},{x:591,y:353.5,w:47,h:14,angle:-90},{x:619.5,y:353.5,w:47,h:15,angle:-90},{x:648.5,y:353.5,w:47,h:15,angle:-90},{x:676.5,y:353.5,w:47,h:13,angle:-90},{x:706,y:353.5,w:47,h:16,angle:-90},{x:735,y:353.5,w:47,h:16,angle:-90},{x:763.5,y:353.5,w:47,h:15,angle:-90},{x:792.5,y:353.5,w:47,h:15,angle:-90},{x:821,y:353.5,w:47,h:16,angle:-90},{x:850,y:353.5,w:47,h:16,angle:-90},{x:879,y:353.5,w:47,h:16,angle:-90},{x:907.5,y:353.5,w:47,h:15,angle:-90},{x:936.5,y:353.5,w:47,h:15,angle:-90},{x:965.5,y:353.5,w:47,h:15,angle:-90},{x:994,y:353.5,w:47,h:16,angle:-90},{x:1023,y:353.5,w:47,h:16,angle:-90},{x:1051.5,y:353.5,w:47,h:15,angle:-90},{x:1080.5,y:353.5,w:47,h:15,angle:-90},{x:1138,y:353.5,w:47,h:16,angle:-90},{x:1167,y:353.5,w:47,h:16,angle:-90},{x:1252.5,y:353.5,w:47,h:15,angle:-90},{x:1282,y:353.5,w:47,h:16,angle:-90},{x:1310.5,y:353.5,w:47,h:15,angle:-90},{x:1339.5,y:353.5,w:47,h:15,angle:-90},{x:1368.5,y:353.5,w:47,h:15,angle:-90},{x:532.5,y:413.5,w:47,h:13,angle:-90},{x:562,y:413.5,w:47,h:16,angle:-90},{x:590.5,y:413.5,w:47,h:15,angle:-90},{x:619.5,y:413.5,w:47,h:15,angle:-90},{x:648.5,y:413.5,w:47,h:15,angle:-90},{x:676.5,y:413.5,w:47,h:13,angle:-90},{x:706,y:413.5,w:47,h:16,angle:-90},{x:735,y:413.5,w:47,h:16,angle:-90},{x:763.5,y:413.5,w:47,h:15,angle:-90},{x:792.5,y:413.5,w:47,h:15,angle:-90},{x:821,y:413.5,w:47,h:16,angle:-90},{x:850,y:413.5,w:47,h:16,angle:-90},{x:936,y:413.5,w:47,h:16,angle:-90},{x:1023,y:413.5,w:47,h:16,angle:-90},{x:1080,y:413.5,w:47,h:16,angle:-90},{x:1167,y:413.5,w:47,h:16,angle:-90},{x:1253,y:413.5,w:47,h:16,angle:-90},{x:1282,y:413.5,w:47,h:16,angle:-90},{x:1310.5,y:413.5,w:47,h:15,angle:-90},{x:1339.5,y:413.5,w:47,h:15,angle:-90},{x:1368.5,y:413.5,w:47,h:15,angle:-90},{x:879,y:414,w:48,h:16,angle:-90},{x:907.5,y:414,w:48,h:15,angle:-90},{x:965.5,y:414,w:48,h:15,angle:-90},{x:994,y:414,w:48,h:16,angle:-90},{x:1051.5,y:414,w:48,h:15,angle:-90},{x:1109,y:414,w:48,h:16,angle:-90},{x:1138,y:414,w:48,h:16,angle:-90},{x:1196,y:414,w:48,h:16,angle:-90},{x:1224,y:414,w:48,h:16,angle:-90},{x:1023,y:474,w:48,h:16,angle:-90},{x:1052,y:474,w:48,h:16,angle:-90},{x:1109,y:474,w:48,h:16,angle:-90},{x:1138,y:474,w:48,h:16,angle:-90},{x:1167,y:474,w:48,h:16,angle:-90},{x:1196,y:474,w:48,h:16,angle:-90},{x:1224,y:474,w:48,h:16,angle:-90},{x:532.5,y:474.5,w:47,h:13,angle:-90},{x:562,y:474.5,w:47,h:16,angle:-90},{x:591,y:474.5,w:47,h:14,angle:-90},{x:619.5,y:474.5,w:47,h:15,angle:-90},{x:648.5,y:474.5,w:47,h:15,angle:-90},{x:677,y:474.5,w:47,h:16,angle:-90},{x:706,y:474.5,w:47,h:16,angle:-90},{x:735,y:474.5,w:47,h:16,angle:-90},{x:763.5,y:474.5,w:47,h:15,angle:-90},{x:792.5,y:474.5,w:47,h:15,angle:-90},{x:821,y:474.5,w:47,h:16,angle:-90},{x:850,y:474.5,w:47,h:16,angle:-90},{x:879,y:474.5,w:47,h:16,angle:-90},{x:908,y:474.5,w:47,h:16,angle:-90},{x:936,y:474.5,w:47,h:16,angle:-90},{x:965.5,y:474.5,w:47,h:15,angle:-90},{x:994,y:474.5,w:47,h:16,angle:-90},{x:1080,y:474.5,w:47,h:16,angle:-90},{x:1253,y:474.5,w:47,h:16,angle:-90},{x:1282,y:474.5,w:47,h:16,angle:-90},{x:1311,y:474.5,w:47,h:14,angle:-90},{x:1339.5,y:474.5,w:47,h:15,angle:-90},{x:1368.5,y:474.5,w:47,h:15,angle:-90},{x:533,y:534.5,w:47,h:14,angle:-90},{x:562,y:534.5,w:47,h:16,angle:-90},{x:591.5,y:534.5,w:47,h:13,angle:-90},{x:619.5,y:534.5,w:47,h:15,angle:-90},{x:648.5,y:534.5,w:47,h:15,angle:-90},{x:677,y:534.5,w:47,h:16,angle:-90},{x:706,y:534.5,w:47,h:16,angle:-90},{x:735,y:534.5,w:47,h:16,angle:-90},{x:792.5,y:534.5,w:47,h:15,angle:-90},{x:821,y:534.5,w:47,h:16,angle:-90},{x:850,y:534.5,w:47,h:16,angle:-90},{x:879,y:534.5,w:47,h:16,angle:-90},{x:908,y:534.5,w:47,h:16,angle:-90},{x:936,y:534.5,w:47,h:16,angle:-90},{x:965.5,y:534.5,w:47,h:15,angle:-90},{x:994,y:534.5,w:47,h:16,angle:-90},{x:1080,y:534.5,w:47,h:16,angle:-90},{x:1109,y:534.5,w:47,h:16,angle:-90},{x:1138,y:534.5,w:47,h:16,angle:-90},{x:1311,y:534.5,w:47,h:16,angle:-90},{x:1339.5,y:534.5,w:47,h:15,angle:-90},{x:1368.5,y:534.5,w:47,h:15,angle:-90},{x:764,y:535,w:48,h:16,angle:-90},{x:1023,y:535,w:48,h:16,angle:-90},{x:1052,y:535,w:48,h:16,angle:-90},{x:1167,y:535,w:48,h:16,angle:-90},{x:1196,y:535,w:48,h:16,angle:-90},{x:1224.5,y:535,w:48,h:17,angle:-90},{x:1253,y:535,w:48,h:16,angle:-90},{x:1282,y:535,w:48,h:16,angle:-90},{x:879,y:595,w:48,h:16,angle:-90},{x:936.5,y:595,w:48,h:15,angle:-90},{x:994,y:595,w:48,h:16,angle:-90},{x:1023,y:595,w:48,h:16,angle:-90},{x:1052,y:595,w:48,h:16,angle:-90},{x:1080,y:595,w:48,h:16,angle:-90},{x:1109,y:595,w:48,h:16,angle:-90},{x:1138,y:595,w:48,h:16,angle:-90},{x:1167,y:595,w:48,h:16,angle:-90},{x:1196,y:595,w:48,h:16,angle:-90},{x:1224,y:595,w:48,h:16,angle:-90},{x:1253,y:595,w:48,h:16,angle:-90},{x:1282,y:595,w:48,h:16,angle:-90},{x:1311,y:595,w:48,h:16,angle:-90},{x:1339.5,y:595,w:48,h:17,angle:-90},{x:532,y:595.5,w:47,h:14,angle:-90},{x:562,y:595.5,w:47,h:16,angle:-90},{x:591.5,y:595.5,w:47,h:15,angle:-90},{x:619.5,y:595.5,w:47,h:15,angle:-90},{x:648.5,y:595.5,w:47,h:15,angle:-90},{x:677,y:595.5,w:47,h:16,angle:-90},{x:706,y:595.5,w:47,h:16,angle:-90},{x:735,y:595.5,w:47,h:16,angle:-90},{x:764,y:595.5,w:47,h:16,angle:-90},{x:792,y:595.5,w:47,h:16,angle:-90},{x:821,y:595.5,w:47,h:16,angle:-90},{x:850,y:595.5,w:47,h:16,angle:-90},{x:907.5,y:595.5,w:47,h:15,angle:-90},{x:965.5,y:595.5,w:47,h:15,angle:-90},{x:1368.5,y:595.5,w:47,h:15,angle:-90},{x:532.5,y:655.5,w:47,h:13,angle:-90},{x:562,y:655.5,w:47,h:16,angle:-90},{x:591,y:655.5,w:47,h:14,angle:-90},{x:619.5,y:655.5,w:47,h:15,angle:-90},{x:648.5,y:655.5,w:47,h:15,angle:-90},{x:677,y:655.5,w:47,h:16,angle:-90},{x:706,y:655.5,w:47,h:16,angle:-90},{x:735,y:655.5,w:47,h:16,angle:-90},{x:763.5,y:655.5,w:47,h:15,angle:-90},{x:792,y:655.5,w:47,h:16,angle:-90},{x:821,y:655.5,w:47,h:16,angle:-90},{x:850,y:655.5,w:47,h:16,angle:-90},{x:879,y:655.5,w:47,h:16,angle:-90},{x:908,y:655.5,w:47,h:16,angle:-90},{x:936,y:655.5,w:47,h:16,angle:-90},{x:965.5,y:655.5,w:47,h:15,angle:-90},{x:994,y:655.5,w:47,h:16,angle:-90},{x:1023,y:655.5,w:47,h:16,angle:-90},{x:1052,y:655.5,w:47,h:16,angle:-90},{x:1080,y:655.5,w:47,h:16,angle:-90},{x:1109,y:655.5,w:47,h:16,angle:-90},{x:1138,y:655.5,w:47,h:16,angle:-90},{x:1167,y:655.5,w:47,h:16,angle:-90},{x:1282,y:655.5,w:47,h:16,angle:-90},{x:1311,y:655.5,w:47,h:16,angle:-90},{x:1339.5,y:655.5,w:47,h:15,angle:-90},{x:1368.5,y:655.5,w:47,h:15,angle:-90},{x:1196,y:656,w:48,h:16,angle:-90},{x:1224.5,y:656,w:48,h:17,angle:-90},{x:1253,y:656,w:48,h:16,angle:-90},{x:648.5,y:716,w:48,h:15,angle:-90},{x:677,y:716,w:48,h:16,angle:-90},{x:706,y:716,w:48,h:16,angle:-90},{x:735,y:716,w:48,h:16,angle:-90},{x:764,y:716,w:48,h:16,angle:-90},{x:792,y:716,w:48,h:16,angle:-90},{x:821,y:716,w:48,h:16,angle:-90},{x:850,y:716,w:48,h:16,angle:-90},{x:879,y:716,w:48,h:16,angle:-90},{x:908,y:716,w:48,h:16,angle:-90},{x:936,y:716,w:48,h:16,angle:-90},{x:965.5,y:716,w:48,h:15,angle:-90},{x:994,y:716,w:48,h:16,angle:-90},{x:1023,y:716,w:48,h:16,angle:-90},{x:1052,y:716,w:48,h:16,angle:-90},{x:1080,y:716,w:48,h:16,angle:-90},{x:1109,y:716,w:48,h:16,angle:-90},{x:1138,y:716,w:48,h:16,angle:-90},{x:1167,y:716,w:48,h:16,angle:-90},{x:1195.5,y:716,w:48,h:17,angle:-90},{x:1224,y:716,w:48,h:16,angle:-90},{x:1252.5,y:716,w:48,h:17,angle:-90},{x:1282,y:716,w:48,h:16,angle:-90},{x:1311,y:716,w:48,h:16,angle:-90},{x:1339.5,y:716,w:48,h:17,angle:-90},{x:532,y:716.5,w:47,h:14,angle:-90},{x:562,y:716.5,w:47,h:16,angle:-90},{x:591.5,y:716.5,w:47,h:15,angle:-90},{x:620,y:716.5,w:47,h:16,angle:-90},{x:1368,y:716.5,w:47,h:16,angle:-90},{x:648.5,y:776.5,w:47,h:15,angle:-90},{x:735,y:776.5,w:47,h:16,angle:-90},{x:764,y:776.5,w:47,h:16,angle:-90},{x:821,y:776.5,w:47,h:16,angle:-90},{x:879,y:776.5,w:47,h:16,angle:-90},{x:1080.5,y:776.5,w:47,h:17,angle:-90},{x:1167,y:776.5,w:47,h:16,angle:-90},{x:1195.5,y:776.5,w:47,h:15,angle:-90},{x:1282,y:776.5,w:47,h:16,angle:-90},{x:1339.5,y:776.5,w:47,h:15,angle:-90},{x:1368.5,y:776.5,w:47,h:15,angle:-90},{x:619.5,y:777,w:46,h:15,angle:-90},{x:706,y:777,w:46,h:16,angle:-90},{x:792,y:777,w:48,h:16,angle:-90},{x:850,y:777,w:48,h:16,angle:-90},{x:908,y:777,w:48,h:16,angle:-90},{x:936,y:777,w:48,h:16,angle:-90},{x:965.5,y:777,w:48,h:15,angle:-90},{x:994,y:777,w:48,h:16,angle:-90},{x:1023,y:777,w:48,h:16,angle:-90},{x:1052,y:777,w:48,h:16,angle:-90},{x:1109,y:777,w:48,h:16,angle:-90},{x:1137.5,y:777,w:48,h:17,angle:-90},{x:1311.7,y:777,w:46.7,h:15.5,angle:-87.1},{x:532.3,y:777.5,w:45.3,h:14.5,angle:88.7},{x:562,y:777.5,w:45,h:16,angle:-90},{x:590.5,y:777.5,w:45,h:15,angle:-90},{x:677.5,y:777.5,w:45,h:15,angle:-90},{x:1224.5,y:777.5,w:45,h:15,angle:-90},{x:1253,y:777.5,w:45,h:16,angle:-90},{x:508,y:782,w:480,h:28,angle:-90},{x:8.5,y:787.5,w:47,h:17,angle:-90},{x:38,y:787.5,w:47,h:16,angle:-90},{x:67,y:787.5,w:47,h:16,angle:-90},{x:95.5,y:787.5,w:47,h:15,angle:-90},{x:124,y:787.5,w:47,h:16,angle:-90},{x:153,y:787.5,w:47,h:16,angle:-90},{x:182,y:787.5,w:47,h:16,angle:-90},{x:211,y:787.5,w:47,h:16,angle:-90},{x:239.5,y:787.5,w:47,h:15,angle:-90},{x:268,y:787.5,w:47,h:16,angle:-90},{x:297,y:787.5,w:47,h:16,angle:-90},{x:326,y:787.5,w:47,h:16,angle:-90},{x:355,y:787.5,w:47,h:16,angle:-90},{x:383.5,y:787.5,w:47,h:15,angle:-90},{x:412,y:787.5,w:47,h:16,angle:-90},{x:441,y:787.5,w:47,h:16,angle:-90},{x:469.5,y:787.5,w:47,h:15,angle:-90},{x:764,y:837,w:48,h:16,angle:-90},{x:792,y:837,w:48,h:16,angle:-90},{x:821,y:837,w:48,h:16,angle:-90},{x:850,y:837,w:48,h:16,angle:-90},{x:879,y:837,w:48,h:16,angle:-90},{x:908,y:837,w:48,h:16,angle:-90},{x:936,y:837,w:48,h:16,angle:-90},{x:965.5,y:837,w:48,h:15,angle:-90},{x:994,y:837,w:48,h:16,angle:-90},{x:1023,y:837,w:48,h:16,angle:-90},{x:1052,y:837,w:48,h:16,angle:-90},{x:1080.5,y:837,w:48,h:17,angle:-90},{x:1109,y:837,w:48,h:16,angle:-90},{x:1137.5,y:837,w:48,h:17,angle:-90},{x:1167,y:837,w:48,h:16,angle:-90},{x:1195.5,y:837,w:48,h:15,angle:-90},{x:532,y:837.5,w:47,h:14,angle:-90},{x:562,y:837.5,w:47,h:16,angle:-90},{x:591.5,y:837.5,w:47,h:13,angle:-90},{x:619.5,y:837.5,w:47,h:15,angle:-90},{x:648.5,y:837.5,w:47,h:15,angle:-90},{x:676.5,y:837.5,w:47,h:13,angle:-90},{x:706,y:837.5,w:47,h:16,angle:-90},{x:736,y:837.5,w:47,h:14,angle:-90},{x:1224.5,y:837.5,w:47,h:15,angle:-90},{x:1252,y:837.5,w:47,h:14,angle:-90},{x:1282,y:837.5,w:47,h:16,angle:-90},{x:1311.4,y:837.5,w:47.6,h:15.1,angle:-87.7},{x:1339.5,y:837.5,w:47,h:15,angle:-90},{x:1368.5,y:837.5,w:47,h:15,angle:-90},{x:792,y:897.5,w:47,h:16,angle:-90},{x:821,y:897.5,w:47,h:16,angle:-90},{x:850,y:897.5,w:47,h:16,angle:-90},{x:879,y:897.5,w:47,h:16,angle:-90},{x:936,y:897.5,w:47,h:16,angle:-90},{x:965.5,y:897.5,w:47,h:15,angle:-90},{x:994,y:897.5,w:47,h:16,angle:-90},{x:1023,y:897.5,w:47,h:16,angle:-90},{x:1080,y:897.5,w:47,h:16,angle:-90},{x:1138,y:897.5,w:47,h:16,angle:-90},{x:908,y:898,w:48,h:16,angle:-90},{x:1052,y:898,w:48,h:16,angle:-90},{x:1167,y:898,w:46.4,h:15,angle:-88.6},{x:1282,y:898,w:46,h:16,angle:-90},{x:532,y:898.5,w:45,h:14,angle:-90},{x:562,y:898.5,w:45,h:16,angle:-90},{x:591.5,y:898.5,w:45,h:13,angle:-90},{x:619.5,y:898.5,w:45,h:15,angle:-90},{x:648.5,y:898.5,w:45,h:15,angle:-90},{x:676.5,y:898.5,w:45,h:13,angle:-90},{x:706,y:898.5,w:45,h:16,angle:-90},{x:736,y:898.5,w:45,h:14,angle:-90},{x:764,y:898.5,w:45,h:16,angle:-90},{x:1108,y:898.5,w:45,h:14,angle:-90},{x:1195.5,y:898.5,w:45,h:15,angle:-90},{x:1224.5,y:898.5,w:45,h:15,angle:-90},{x:1252,y:898.5,w:45,h:14,angle:-90},{x:1311,y:898.5,w:45,h:16,angle:-90},{x:1339.5,y:898.5,w:45,h:15,angle:-90},{x:1368.5,y:898.5,w:45,h:15,angle:-90},{x:764,y:958,w:48,h:16,angle:-90},{x:792.5,y:958,w:48,h:17,angle:-90},{x:821,y:958,w:48,h:16,angle:-90},{x:850,y:958,w:48,h:16,angle:-90},{x:879,y:958,w:48,h:16,angle:-90},{x:908,y:958,w:48,h:16,angle:-90},{x:936.5,y:958,w:48,h:17,angle:-90},{x:965.5,y:958,w:48,h:15,angle:-90},{x:994,y:958,w:48,h:16,angle:-90},{x:1023,y:958,w:48,h:16,angle:-90},{x:1051.5,y:958,w:48,h:17,angle:-90},{x:1080.5,y:958,w:48,h:17,angle:-90},{x:1109,y:958,w:48,h:16,angle:-90},{x:1138,y:958,w:48,h:16,angle:-90},{x:1167,y:958,w:48,h:16,angle:-90},{x:1311,y:958,w:48,h:16,angle:-90},{x:1368.5,y:958,w:48,h:15,angle:-90},{x:532.1,y:958.5,w:47.3,h:14.9,angle:88.7},{x:562,y:958.5,w:47,h:16,angle:-90},{x:591,y:958.5,w:47,h:14,angle:-90},{x:619.5,y:958.5,w:47,h:15,angle:-90},{x:648.5,y:958.5,w:47,h:15,angle:-90},{x:677,y:958.5,w:47,h:14,angle:-90},{x:706,y:958.5,w:47,h:16,angle:-90},{x:735,y:958.5,w:47,h:16,angle:-90},{x:1195.5,y:958.5,w:47,h:15,angle:-90},{x:1224.5,y:958.5,w:47,h:15,angle:-90},{x:1253,y:958.5,w:47,h:16,angle:-90},{x:1282,y:958.5,w:47,h:16,angle:-90},{x:1339.5,y:958.5,w:47,h:15,angle:-90},{x:677,y:1018.5,w:47,h:16,angle:-90},{x:706,y:1018.5,w:47,h:16,angle:-90},{x:735,y:1018.5,w:47,h:16,angle:-90},{x:764,y:1018.5,w:47,h:16,angle:-90},{x:792,y:1018.5,w:47,h:16,angle:-90},{x:821,y:1018.5,w:47,h:16,angle:-90},{x:850,y:1018.5,w:47,h:16,angle:-90},{x:879,y:1018.5,w:47,h:16,angle:-90},{x:908,y:1018.5,w:47,h:16,angle:-90},{x:936.5,y:1018.5,w:47,h:17,angle:-90},{x:965.5,y:1018.5,w:47,h:15,angle:-90},{x:994,y:1018.5,w:47,h:16,angle:-90},{x:1023,y:1018.5,w:47,h:16,angle:-90},{x:1052,y:1018.5,w:47,h:16,angle:-90},{x:1080.5,y:1018.5,w:47,h:17,angle:-90},{x:1109,y:1018.5,w:47,h:16,angle:-90},{x:1137.5,y:1018.5,w:47,h:17,angle:-90},{x:1167,y:1018.5,w:47,h:16,angle:-90},{x:1196,y:1018.5,w:47,h:16,angle:-90},{x:1224.5,y:1018.5,w:47,h:17,angle:-90},{x:1253,y:1018.5,w:47,h:16,angle:-90},{x:532.5,y:1019.5,w:45,h:13,angle:-90},{x:562,y:1019.5,w:45,h:16,angle:-90},{x:591.5,y:1019.5,w:45,h:13,angle:-90},{x:619.5,y:1019.5,w:45,h:15,angle:-90},{x:648.5,y:1019.5,w:45,h:15,angle:-90},{x:1282,y:1019.5,w:45,h:16,angle:-90},{x:1312,y:1019.5,w:45,h:14,angle:-90},{x:1339.5,y:1019.5,w:45,h:15,angle:-90},{x:1368.5,y:1019.5,w:45,h:15,angle:-90}]}},{slug:`triangle`,top_extract:{blocks:[{x:853.5,y:50.5,w:47,h:15,angle:-90},{x:1026.5,y:50.5,w:47,h:15,angle:-90},{x:1141.5,y:50.5,w:47,h:15,angle:-90},{x:1170.5,y:50.5,w:47,h:15,angle:-90},{x:1227.5,y:50.5,w:47,h:13,angle:-90},{x:1257,y:50.5,w:47,h:16,angle:-90},{x:1286,y:50.5,w:47,h:16,angle:-90},{x:1401,y:50.5,w:47,h:16,angle:-90},{x:1430,y:50.5,w:47,h:16,angle:-90},{x:1458.5,y:50.5,w:47,h:15,angle:-90},{x:1487.5,y:50.5,w:47,h:15,angle:-90},{x:1516,y:50.5,w:47,h:14,angle:-90},{x:681,y:51,w:46,h:16,angle:-90},{x:709.5,y:51,w:46,h:15,angle:-90},{x:738.5,y:51,w:46,h:15,angle:-90},{x:767.5,y:51,w:46,h:15,angle:-90},{x:795.5,y:51,w:46,h:13,angle:-90},{x:825.5,y:51,w:46,h:15,angle:-90},{x:882.5,y:51,w:46,h:15,angle:-90},{x:911.5,y:51,w:46,h:15,angle:-90},{x:939.5,y:51,w:46,h:13,angle:-90},{x:969.5,y:51,w:46,h:15,angle:-90},{x:997.5,y:51,w:46,h:15,angle:-90},{x:1055.5,y:51,w:46,h:15,angle:-90},{x:1083.5,y:51,w:46,h:13,angle:-90},{x:1113.5,y:51,w:46,h:15,angle:-90},{x:1199.5,y:51,w:46,h:15,angle:-90},{x:1314.5,y:51,w:46,h:15,angle:-90},{x:1343.5,y:51,w:46,h:15,angle:-90},{x:1371.5,y:51,w:46,h:13,angle:-90},{x:651.5,y:61.7,w:47.4,h:17,angle:-90},{x:623,y:86.6,w:47.2,h:16,angle:-90},{x:651.5,y:109.1,w:47.4,h:17,angle:-90},{x:594,y:110.4,w:44.8,h:16,angle:-90},{x:681,y:110.5,w:45,h:16,angle:-90},{x:709.5,y:110.5,w:45,h:15,angle:-90},{x:738.5,y:110.5,w:45,h:15,angle:-90},{x:795.5,y:110.5,w:45,h:13,angle:-90},{x:825.5,y:110.5,w:45,h:15,angle:-90},{x:853.5,y:110.5,w:45,h:15,angle:-90},{x:882.5,y:110.5,w:45,h:15,angle:-90},{x:911.5,y:110.5,w:45,h:15,angle:-90},{x:939.5,y:110.5,w:45,h:13,angle:-90},{x:997.5,y:110.5,w:45,h:15,angle:-90},{x:1026.5,y:110.5,w:45,h:15,angle:-90},{x:1055.5,y:110.5,w:45,h:15,angle:-90},{x:1083.5,y:110.5,w:45,h:13,angle:-90},{x:1141.5,y:110.5,w:45,h:15,angle:-90},{x:1170.5,y:110.5,w:45,h:15,angle:-90},{x:1199.5,y:110.5,w:45,h:15,angle:-90},{x:1227.5,y:110.5,w:45,h:13,angle:-90},{x:1257,y:110.5,w:45,h:16,angle:-90},{x:1314.5,y:110.5,w:45,h:15,angle:-90},{x:1343.5,y:110.5,w:45,h:15,angle:-90},{x:1371.5,y:110.5,w:45,h:13,angle:-90},{x:1458.5,y:110.5,w:45,h:15,angle:-90},{x:1487.5,y:110.5,w:45,h:15,angle:-90},{x:1515.5,y:110.5,w:45,h:13,angle:-90},{x:767.5,y:111,w:46,h:15,angle:-90},{x:1113.5,y:111,w:46,h:15,angle:-90},{x:1401,y:111,w:46,h:16,angle:-90},{x:1430,y:111,w:46,h:16,angle:-90},{x:969,y:111.5,w:47,h:16,angle:-90},{x:1286,y:111.5,w:47,h:16,angle:-90},{x:623,y:133.9,w:47.2,h:16,angle:-90},{x:564.3,y:136.5,w:46.9,h:17,angle:89.9},{x:594,y:155.1,w:44.8,h:16,angle:-90},{x:651.5,y:156.5,w:47.4,h:17,angle:-90},{x:537,y:161.4,w:46.8,h:16,angle:-90},{x:681,y:171.5,w:47,h:16,angle:-90},{x:709.5,y:171.5,w:47,h:15,angle:-90},{x:738.5,y:171.5,w:47,h:15,angle:-90},{x:767.5,y:171.5,w:47,h:15,angle:-90},{x:795.5,y:171.5,w:47,h:13,angle:-90},{x:825,y:171.5,w:47,h:16,angle:-90},{x:853.5,y:171.5,w:47,h:15,angle:-90},{x:882.5,y:171.5,w:47,h:15,angle:-90},{x:911.5,y:171.5,w:47,h:15,angle:-90},{x:940.5,y:171.5,w:47,h:15,angle:-90},{x:998,y:171.5,w:47,h:16,angle:-90},{x:1026.5,y:171.5,w:47,h:15,angle:-90},{x:1055.5,y:171.5,w:47,h:15,angle:-90},{x:1083.5,y:171.5,w:47,h:13,angle:-90},{x:1113.5,y:171.5,w:47,h:15,angle:-90},{x:1141.5,y:171.5,w:47,h:15,angle:-90},{x:1170.5,y:171.5,w:47,h:15,angle:-90},{x:1199.5,y:171.5,w:47,h:15,angle:-90},{x:1227.5,y:171.5,w:47,h:13,angle:-90},{x:1343.5,y:171.5,w:47,h:15,angle:-90},{x:1371.5,y:171.5,w:47,h:13,angle:-90},{x:1401,y:171.5,w:47,h:16,angle:-90},{x:1430,y:171.5,w:47,h:16,angle:-90},{x:1458.5,y:171.5,w:47,h:15,angle:-90},{x:1487.5,y:171.5,w:47,h:15,angle:-90},{x:1515.5,y:171.5,w:47,h:13,angle:-90},{x:969,y:172,w:48,h:16,angle:-90},{x:1257,y:172,w:48,h:16,angle:-90},{x:1286,y:172,w:48,h:16,angle:-90},{x:1314.5,y:172,w:48,h:15,angle:-90},{x:623,y:181.1,w:47.2,h:16,angle:-90},{x:564.4,y:183.4,w:46.9,h:17,angle:89.9},{x:508,y:186.3,w:46.6,h:16,angle:-90},{x:594,y:199.9,w:44.8,h:16,angle:-90},{x:651.5,y:203.8,w:47.4,h:17,angle:-90},{x:537,y:208.1,w:46.8,h:16,angle:-90},{x:479,y:211.2,w:46.3,h:16,angle:-90},{x:623,y:228.4,w:47.2,h:16,angle:-90},{x:564.5,y:230.4,w:46.9,h:17,angle:89.9},{x:681,y:232.5,w:47,h:16,angle:-90},{x:709.5,y:232.5,w:47,h:15,angle:-90},{x:738.5,y:232.5,w:47,h:15,angle:-90},{x:767.5,y:232.5,w:47,h:15,angle:-90},{x:795.5,y:232.5,w:47,h:13,angle:-90},{x:825.5,y:232.5,w:47,h:15,angle:-90},{x:853.5,y:232.5,w:47,h:15,angle:-90},{x:882.5,y:232.5,w:47,h:15,angle:-90},{x:911.5,y:232.5,w:47,h:15,angle:-90},{x:940,y:232.5,w:47,h:16,angle:-90},{x:969,y:232.5,w:47,h:16,angle:-90},{x:998,y:232.5,w:47,h:16,angle:-90},{x:1026.5,y:232.5,w:47,h:15,angle:-90},{x:1055.5,y:232.5,w:47,h:15,angle:-90},{x:1083.5,y:232.5,w:47,h:13,angle:-90},{x:1113.5,y:232.5,w:47,h:15,angle:-90},{x:1141.5,y:232.5,w:47,h:15,angle:-90},{x:1170.5,y:232.5,w:47,h:15,angle:-90},{x:1199.5,y:232.5,w:47,h:15,angle:-90},{x:1228,y:232.5,w:47,h:16,angle:-90},{x:1257,y:232.5,w:47,h:16,angle:-90},{x:1286,y:232.5,w:47,h:16,angle:-90},{x:1315,y:232.5,w:47,h:16,angle:-90},{x:1343.5,y:232.5,w:47,h:15,angle:-90},{x:1371,y:232.5,w:47,h:14,angle:-90},{x:1401,y:232.5,w:47,h:16,angle:-90},{x:1430,y:232.5,w:47,h:16,angle:-90},{x:1458.5,y:232.5,w:47,h:15,angle:-90},{x:1487.5,y:232.5,w:47,h:15,angle:-90},{x:1515.5,y:232.5,w:47,h:13,angle:-90},{x:508,y:232.8,w:46.6,h:16,angle:-90},{x:450,y:236.1,w:46.1,h:16,angle:-90},{x:594,y:244.6,w:44.8,h:16,angle:-90},{x:651.5,y:251.2,w:47.4,h:17,angle:-90},{x:537,y:254.9,w:46.8,h:16,angle:-90},{x:479,y:257.5,w:46.3,h:16,angle:-90},{x:421,y:260.9,w:45.8,h:16,angle:-90},{x:623,y:275.6,w:47.2,h:16,angle:-90},{x:564.5,y:277.3,w:46.9,h:17,angle:89.9},{x:508,y:279.4,w:46.6,h:16,angle:-90},{x:450,y:282.2,w:46.1,h:16,angle:-90},{x:393,y:284.8,w:45.6,h:16,angle:-90},{x:594,y:289.4,w:44.8,h:16,angle:-90},{x:681,y:292.5,w:47,h:16,angle:-90},{x:709.5,y:292.5,w:47,h:15,angle:-90},{x:738.5,y:292.5,w:47,h:15,angle:-90},{x:767.5,y:292.5,w:47,h:15,angle:-90},{x:795.5,y:292.5,w:47,h:13,angle:-90},{x:825.5,y:292.5,w:47,h:15,angle:-90},{x:854,y:292.5,w:47,h:16,angle:-90},{x:882.5,y:292.5,w:47,h:15,angle:-90},{x:940,y:292.5,w:47,h:16,angle:-90},{x:969,y:292.5,w:47,h:16,angle:-90},{x:998,y:292.5,w:47,h:16,angle:-90},{x:1027,y:292.5,w:47,h:16,angle:-90},{x:1055.5,y:292.5,w:47,h:15,angle:-90},{x:1083,y:292.5,w:47,h:14,angle:-90},{x:1113.5,y:292.5,w:47,h:15,angle:-90},{x:1142,y:292.5,w:47,h:16,angle:-90},{x:1228,y:292.5,w:47,h:16,angle:-90},{x:1372,y:292.5,w:47,h:16,angle:-90},{x:1401,y:292.5,w:47,h:16,angle:-90},{x:1430,y:292.5,w:47,h:16,angle:-90},{x:1458.5,y:292.5,w:47,h:15,angle:-90},{x:1487.5,y:292.5,w:47,h:15,angle:-90},{x:1515.5,y:292.5,w:47,h:13,angle:-90},{x:911.5,y:293,w:48,h:15,angle:-90},{x:1171,y:293,w:48,h:16,angle:-90},{x:1199.5,y:293,w:48,h:15,angle:-90},{x:1257,y:293,w:48,h:16,angle:-90},{x:1286,y:293,w:48,h:16,angle:-90},{x:1315,y:293,w:48,h:16,angle:-90},{x:1343.5,y:293,w:48,h:15,angle:-90},{x:651.5,y:298.6,w:47.4,h:17,angle:-90},{x:537,y:301.7,w:46.8,h:16,angle:-90},{x:479,y:303.8,w:46.3,h:16,angle:-90},{x:421,y:306.8,w:45.8,h:16,angle:-90},{x:364,y:309.6,w:45.2,h:16,angle:-90},{x:623,y:322.9,w:47.2,h:16,angle:-90},{x:564.6,y:324.3,w:46.9,h:17,angle:89.9},{x:508,y:326,w:46.6,h:16,angle:-90},{x:450,y:328.4,w:46.1,h:16,angle:-90},{x:393,y:330.4,w:45.6,h:16,angle:-90},{x:594,y:334.1,w:44.8,h:16,angle:-90},{x:335,y:334.4,w:44.7,h:16,angle:-90},{x:651.5,y:346,w:47.4,h:17,angle:-90},{x:537,y:348.4,w:46.8,h:16,angle:-90},{x:479,y:350.2,w:46.3,h:16,angle:-90},{x:421,y:352.6,w:45.8,h:16,angle:-90},{x:1286,y:353,w:48,h:16,angle:-90},{x:1343.5,y:353,w:48,h:15,angle:-90},{x:681,y:353.5,w:47,h:16,angle:-90},{x:709.5,y:353.5,w:47,h:15,angle:-90},{x:738.5,y:353.5,w:47,h:15,angle:-90},{x:767.5,y:353.5,w:47,h:15,angle:-90},{x:795.5,y:353.5,w:47,h:13,angle:-90},{x:825,y:353.5,w:47,h:16,angle:-90},{x:854,y:353.5,w:47,h:16,angle:-90},{x:882.5,y:353.5,w:47,h:15,angle:-90},{x:911.5,y:353.5,w:47,h:15,angle:-90},{x:940,y:353.5,w:47,h:16,angle:-90},{x:969,y:353.5,w:47,h:16,angle:-90},{x:998,y:353.5,w:47,h:16,angle:-90},{x:1026.5,y:353.5,w:47,h:15,angle:-90},{x:1055.5,y:353.5,w:47,h:15,angle:-90},{x:1084,y:353.5,w:47,h:16,angle:-90},{x:1113,y:353.5,w:47,h:16,angle:-90},{x:1142,y:353.5,w:47,h:16,angle:-90},{x:1171,y:353.5,w:47,h:16,angle:-90},{x:1199.5,y:353.5,w:47,h:15,angle:-90},{x:1228,y:353.5,w:47,h:16,angle:-90},{x:1257,y:353.5,w:47,h:16,angle:-90},{x:1315,y:353.5,w:47,h:16,angle:-90},{x:1372,y:353.5,w:47,h:16,angle:-90},{x:1401,y:353.5,w:47,h:16,angle:-90},{x:1430,y:353.5,w:47,h:16,angle:-90},{x:1458.5,y:353.5,w:47,h:15,angle:-90},{x:1487.5,y:353.5,w:47,h:15,angle:-90},{x:1515.5,y:353.5,w:47,h:13,angle:-90},{x:364,y:354.8,w:45.2,h:16,angle:-90},{x:306,y:359.1,w:44.1,h:16,angle:-90},{x:623,y:370.1,w:47.2,h:16,angle:-90},{x:564.7,y:371.2,w:46.9,h:17,angle:89.9},{x:508,y:372.5,w:46.6,h:16,angle:-90},{x:450,y:374.5,w:46.1,h:16,angle:-90},{x:393,y:376,w:45.6,h:16,angle:-90},{x:594,y:378.9,w:44.8,h:16,angle:-90},{x:335,y:379,w:44.7,h:16,angle:-90},{x:277,y:386.8,w:49.6,h:16,angle:-90},{x:651.5,y:393.4,w:47.4,h:17,angle:-90},{x:537,y:395.2,w:46.8,h:16,angle:-90},{x:479,y:396.5,w:46.3,h:16,angle:-90},{x:421,y:398.5,w:45.8,h:16,angle:-90},{x:364,y:400,w:45.2,h:16,angle:-90},{x:306,y:403.2,w:44.1,h:16,angle:-90},{x:249,y:411.8,w:49.5,h:16,angle:-90},{x:681,y:413.5,w:47,h:16,angle:-90},{x:709.5,y:413.5,w:47,h:15,angle:-90},{x:738.5,y:413.5,w:47,h:15,angle:-90},{x:767.5,y:413.5,w:47,h:15,angle:-90},{x:795.5,y:413.5,w:47,h:13,angle:-90},{x:825,y:413.5,w:47,h:16,angle:-90},{x:854,y:413.5,w:47,h:16,angle:-90},{x:883,y:413.5,w:47,h:16,angle:-90},{x:911.5,y:413.5,w:47,h:15,angle:-90},{x:940,y:413.5,w:47,h:16,angle:-90},{x:969,y:413.5,w:47,h:16,angle:-90},{x:998,y:413.5,w:47,h:16,angle:-90},{x:1027,y:413.5,w:47,h:16,angle:-90},{x:1055.5,y:413.5,w:47,h:15,angle:-90},{x:1084,y:413.5,w:47,h:16,angle:-90},{x:1113,y:413.5,w:47,h:16,angle:-90},{x:1171,y:413.5,w:47,h:16,angle:-90},{x:1199.5,y:413.5,w:47,h:15,angle:-90},{x:1286,y:413.5,w:47,h:16,angle:-90},{x:1343.5,y:413.5,w:47,h:15,angle:-90},{x:1401,y:413.5,w:47,h:16,angle:-90},{x:1430,y:413.5,w:47,h:16,angle:-90},{x:1458.5,y:413.5,w:47,h:15,angle:-90},{x:1487.5,y:413.5,w:47,h:15,angle:-90},{x:1515.5,y:413.5,w:47,h:13,angle:-90},{x:1142,y:414,w:48,h:16,angle:-90},{x:1228,y:414,w:48,h:16,angle:-90},{x:1257,y:414,w:48,h:16,angle:-90},{x:1315,y:414,w:48,h:16,angle:-90},{x:1372,y:414,w:48,h:16,angle:-90},{x:623,y:417.4,w:47.2,h:16,angle:-90},{x:564.8,y:418.1,w:46.9,h:17,angle:89.9},{x:508,y:419.1,w:46.6,h:16,angle:-90},{x:450,y:420.6,w:46.1,h:16,angle:-90},{x:393,y:421.5,w:45.6,h:16,angle:-90},{x:594,y:423.6,w:44.8,h:16,angle:-90},{x:335,y:423.8,w:44.7,h:16,angle:-90},{x:277,y:436.4,w:49.6,h:16,angle:-90},{x:220,y:436.7,w:49.4,h:16,angle:-90},{x:651.5,y:440.7,w:47.4,h:17,angle:-90},{x:537,y:442,w:46.8,h:16,angle:-90},{x:479,y:442.8,w:46.3,h:16,angle:-90},{x:421,y:444.3,w:45.8,h:16,angle:-90},{x:364,y:445.1,w:45.2,h:16,angle:-90},{x:306,y:447.3,w:44.1,h:16,angle:-90},{x:249,y:461.2,w:49.5,h:16,angle:-90},{x:191,y:461.6,w:49.2,h:16,angle:-90},{x:623,y:464.6,w:47.2,h:16,angle:-90},{x:564.9,y:465.1,w:46.9,h:17,angle:89.9},{x:508,y:465.7,w:46.6,h:16,angle:-90},{x:450,y:466.8,w:46.1,h:16,angle:-90},{x:393,y:467.1,w:45.6,h:16,angle:-90},{x:335,y:468.4,w:44.7,h:16,angle:-90},{x:594,y:468.4,w:44.8,h:16,angle:-90},{x:1199.5,y:474,w:48,h:15,angle:-90},{x:1343.5,y:474,w:48,h:15,angle:-90},{x:1372,y:474,w:48,h:16,angle:-90},{x:681,y:474.5,w:47,h:16,angle:-90},{x:709.5,y:474.5,w:47,h:15,angle:-90},{x:738.5,y:474.5,w:47,h:15,angle:-90},{x:767.5,y:474.5,w:47,h:15,angle:-90},{x:795.5,y:474.5,w:47,h:13,angle:-90},{x:825,y:474.5,w:47,h:16,angle:-90},{x:854,y:474.5,w:47,h:16,angle:-90},{x:882.5,y:474.5,w:47,h:15,angle:-90},{x:911.5,y:474.5,w:47,h:15,angle:-90},{x:940,y:474.5,w:47,h:16,angle:-90},{x:969,y:474.5,w:47,h:16,angle:-90},{x:998,y:474.5,w:47,h:16,angle:-90},{x:1027,y:474.5,w:47,h:16,angle:-90},{x:1055.5,y:474.5,w:47,h:15,angle:-90},{x:1084,y:474.5,w:47,h:16,angle:-90},{x:1113,y:474.5,w:47,h:16,angle:-90},{x:1142,y:474.5,w:47,h:16,angle:-90},{x:1171,y:474.5,w:47,h:16,angle:-90},{x:1228,y:474.5,w:47,h:16,angle:-90},{x:1257,y:474.5,w:47,h:16,angle:-90},{x:1286,y:474.5,w:47,h:16,angle:-90},{x:1315,y:474.5,w:47,h:16,angle:-90},{x:1401,y:474.5,w:47,h:16,angle:-90},{x:1430,y:474.5,w:47,h:16,angle:-90},{x:1458.5,y:474.5,w:47,h:15,angle:-90},{x:1487.5,y:474.5,w:47,h:15,angle:-90},{x:1515.5,y:474.5,w:47,h:13,angle:-90},{x:277,y:485.9,w:49.6,h:16,angle:-90},{x:220,y:486.1,w:49.4,h:16,angle:-90},{x:162.5,y:486.5,w:49,h:15,angle:-90},{x:651.5,y:488.1,w:47.4,h:17,angle:-90},{x:537,y:488.7,w:46.8,h:16,angle:-90},{x:479,y:489.2,w:46.3,h:16,angle:-90},{x:421,y:490.2,w:45.8,h:16,angle:-90},{x:364,y:490.3,w:45.2,h:16,angle:-90},{x:306,y:491.4,w:44.1,h:16,angle:-90},{x:249,y:510.8,w:49.5,h:16,angle:-90},{x:191,y:510.9,w:49.2,h:16,angle:-90},{x:133.5,y:511.2,w:48.5,h:15,angle:-90},{x:623,y:511.9,w:47.2,h:16,angle:-90},{x:565,y:512,w:46.9,h:17,angle:89.9},{x:508,y:512.2,w:46.6,h:16,angle:-90},{x:393,y:512.7,w:45.6,h:16,angle:-90},{x:450,y:512.9,w:46.1,h:16,angle:-90},{x:335,y:513.1,w:44.7,h:16,angle:-90},{x:594,y:513.1,w:44.8,h:16,angle:-90},{x:681,y:534.5,w:47,h:16,angle:-90},{x:709.5,y:534.5,w:47,h:15,angle:-90},{x:738.5,y:534.5,w:47,h:15,angle:-90},{x:767.5,y:534.5,w:47,h:15,angle:-90},{x:795.5,y:534.5,w:47,h:13,angle:-90},{x:825,y:534.5,w:47,h:16,angle:-90},{x:854,y:534.5,w:47,h:16,angle:-90},{x:883,y:534.5,w:47,h:16,angle:-90},{x:911.5,y:534.5,w:47,h:15,angle:-90},{x:940,y:534.5,w:47,h:16,angle:-90},{x:969,y:534.5,w:47,h:16,angle:-90},{x:998,y:534.5,w:47,h:16,angle:-90},{x:1027,y:534.5,w:47,h:16,angle:-90},{x:1055.5,y:534.5,w:47,h:15,angle:-90},{x:1084,y:534.5,w:47,h:16,angle:-90},{x:1113,y:534.5,w:47,h:16,angle:-90},{x:1142,y:534.5,w:47,h:16,angle:-90},{x:1171,y:534.5,w:47,h:16,angle:-90},{x:1199.5,y:534.5,w:47,h:15,angle:-90},{x:1228,y:534.5,w:47,h:16,angle:-90},{x:1257,y:534.5,w:47,h:16,angle:-90},{x:1286,y:534.5,w:47,h:16,angle:-90},{x:1315,y:534.5,w:47,h:16,angle:-90},{x:1343.5,y:534.5,w:47,h:15,angle:-90},{x:1458.5,y:534.5,w:47,h:15,angle:-90},{x:1487.5,y:534.5,w:47,h:15,angle:-90},{x:1515.5,y:534.5,w:47,h:13,angle:-90},{x:1372,y:535,w:48,h:16,angle:-90},{x:1401,y:535,w:48,h:16,angle:-90},{x:1430,y:535,w:48,h:16,angle:-90},{x:18,y:535.5,w:47,h:16,angle:-90},{x:47,y:535.5,w:47,h:16,angle:-90},{x:76,y:535.5,w:47,h:16,angle:-90},{x:105,y:535.5,w:47,h:16,angle:-90},{x:162.5,y:535.5,w:49,h:15,angle:-90},{x:220,y:535.5,w:49.4,h:16,angle:-90},{x:277,y:535.5,w:49.6,h:16,angle:-90},{x:306,y:535.5,w:44.1,h:16,angle:-90},{x:364,y:535.5,w:45.2,h:16,angle:-90},{x:479,y:535.5,w:46.3,h:16,angle:-90},{x:537,y:535.5,w:46.8,h:16,angle:-90},{x:651.5,y:535.5,w:47.4,h:17,angle:-90},{x:421,y:536,w:45.8,h:16,angle:-90},{x:335,y:557.9,w:44.7,h:16,angle:-90},{x:594,y:557.9,w:44.8,h:16,angle:-90},{x:393,y:558.3,w:45.6,h:16,angle:-90},{x:508,y:558.8,w:46.6,h:16,angle:-90},{x:565,y:559,w:46.9,h:17,angle:89.9},{x:450,y:559.1,w:46.1,h:16,angle:-90},{x:623,y:559.1,w:47.2,h:16,angle:-90},{x:133.5,y:559.8,w:48.5,h:15,angle:-90},{x:191,y:560.1,w:49.2,h:16,angle:-90},{x:249,y:560.2,w:49.5,h:16,angle:-90},{x:306,y:579.6,w:44.1,h:16,angle:-90},{x:364,y:580.7,w:45.2,h:16,angle:-90},{x:421,y:581.8,w:45.8,h:16,angle:-90},{x:479,y:581.8,w:46.3,h:16,angle:-90},{x:537,y:582.3,w:46.8,h:16,angle:-90},{x:651.5,y:582.9,w:47.4,h:17,angle:-90},{x:162.5,y:584.5,w:49,h:15,angle:-90},{x:220,y:584.9,w:49.4,h:16,angle:-90},{x:277,y:585.1,w:49.6,h:16,angle:-90},{x:883,y:595,w:48,h:16,angle:-90},{x:911.5,y:595,w:48,h:15,angle:-90},{x:1171,y:595,w:48,h:16,angle:-90},{x:1199.5,y:595,w:48,h:15,angle:-90},{x:1257,y:595,w:48,h:16,angle:-90},{x:1315,y:595,w:48,h:16,angle:-90},{x:1343.5,y:595,w:48,h:17,angle:-90},{x:1372.5,y:595,w:48,h:17,angle:-90},{x:1401,y:595,w:48,h:16,angle:-90},{x:1430,y:595,w:48,h:16,angle:-90},{x:1459,y:595,w:48,h:16,angle:-90},{x:1487,y:595,w:48,h:16,angle:-90},{x:681,y:595.5,w:47,h:16,angle:-90},{x:709.5,y:595.5,w:47,h:15,angle:-90},{x:738.5,y:595.5,w:47,h:15,angle:-90},{x:767.5,y:595.5,w:47,h:15,angle:-90},{x:796,y:595.5,w:47,h:16,angle:-90},{x:825,y:595.5,w:47,h:16,angle:-90},{x:854,y:595.5,w:47,h:16,angle:-90},{x:940,y:595.5,w:47,h:16,angle:-90},{x:969,y:595.5,w:47,h:16,angle:-90},{x:998,y:595.5,w:47,h:16,angle:-90},{x:1027,y:595.5,w:47,h:16,angle:-90},{x:1055.5,y:595.5,w:47,h:15,angle:-90},{x:1084,y:595.5,w:47,h:16,angle:-90},{x:1113,y:595.5,w:47,h:16,angle:-90},{x:1142,y:595.5,w:47,h:16,angle:-90},{x:1228,y:595.5,w:47,h:16,angle:-90},{x:1286,y:595.5,w:47,h:16,angle:-90},{x:1515,y:595.5,w:47,h:14,angle:-90},{x:335,y:602.5,w:44.7,h:16,angle:-90},{x:594,y:602.6,w:44.8,h:16,angle:-90},{x:393,y:603.9,w:45.6,h:16,angle:-90},{x:450,y:605.2,w:46.1,h:16,angle:-90},{x:508,y:605.3,w:46.6,h:16,angle:-90},{x:565.1,y:605.9,w:46.9,h:17,angle:89.9},{x:623,y:606.4,w:47.2,h:16,angle:-90},{x:191,y:609.4,w:49.2,h:16,angle:-90},{x:249,y:609.8,w:49.5,h:16,angle:-90},{x:306,y:623.7,w:44.1,h:16,angle:-90},{x:364,y:625.9,w:45.2,h:16,angle:-90},{x:421,y:627.7,w:45.8,h:16,angle:-90},{x:479,y:628.2,w:46.3,h:16,angle:-90},{x:537,y:629,w:46.8,h:16,angle:-90},{x:651.5,y:630.3,w:47.4,h:17,angle:-90},{x:220,y:634.3,w:49.4,h:16,angle:-90},{x:277,y:634.6,w:49.6,h:16,angle:-90},{x:335,y:647.2,w:44.7,h:16,angle:-90},{x:594,y:647.4,w:44.8,h:16,angle:-90},{x:393,y:649.5,w:45.6,h:16,angle:-90},{x:450,y:651.4,w:46.1,h:16,angle:-90},{x:508,y:651.9,w:46.6,h:16,angle:-90},{x:565.2,y:652.9,w:46.9,h:17,angle:89.9},{x:623,y:653.6,w:47.2,h:16,angle:-90},{x:681,y:655.5,w:47,h:16,angle:-90},{x:709.5,y:655.5,w:47,h:15,angle:-90},{x:738.5,y:655.5,w:47,h:15,angle:-90},{x:767.5,y:655.5,w:47,h:15,angle:-90},{x:795.5,y:655.5,w:47,h:13,angle:-90},{x:825,y:655.5,w:47,h:16,angle:-90},{x:854,y:655.5,w:47,h:16,angle:-90},{x:883,y:655.5,w:47,h:16,angle:-90},{x:911.5,y:655.5,w:47,h:15,angle:-90},{x:940,y:655.5,w:47,h:16,angle:-90},{x:969,y:655.5,w:47,h:16,angle:-90},{x:998,y:655.5,w:47,h:16,angle:-90},{x:1027,y:655.5,w:47,h:16,angle:-90},{x:1055.5,y:655.5,w:47,h:15,angle:-90},{x:1084,y:655.5,w:47,h:16,angle:-90},{x:1113,y:655.5,w:47,h:16,angle:-90},{x:1142,y:655.5,w:47,h:16,angle:-90},{x:1171,y:655.5,w:47,h:16,angle:-90},{x:1199,y:655.5,w:47,h:16,angle:-90},{x:1228,y:655.5,w:47,h:16,angle:-90},{x:1257,y:655.5,w:47,h:16,angle:-90},{x:1286,y:655.5,w:47,h:16,angle:-90},{x:1315,y:655.5,w:47,h:16,angle:-90},{x:1343.5,y:655.5,w:47,h:15,angle:-90},{x:1372,y:655.5,w:47,h:16,angle:-90},{x:1401,y:655.5,w:47,h:16,angle:-90},{x:1430,y:655.5,w:47,h:16,angle:-90},{x:1458.5,y:655.5,w:47,h:15,angle:-90},{x:1487.5,y:655.5,w:47,h:15,angle:-90},{x:1515.5,y:655.5,w:47,h:13,angle:-90},{x:249,y:659.2,w:49.5,h:16,angle:-90},{x:306,y:667.8,w:44.1,h:16,angle:-90},{x:364,y:671,w:45.2,h:16,angle:-90},{x:421,y:673.5,w:45.8,h:16,angle:-90},{x:479,y:674.5,w:46.3,h:16,angle:-90},{x:537,y:675.8,w:46.8,h:16,angle:-90},{x:651.5,y:677.6,w:47.4,h:17,angle:-90},{x:277,y:684.2,w:49.6,h:16,angle:-90},{x:335,y:692,w:44.7,h:16,angle:-90},{x:594,y:692.1,w:44.8,h:16,angle:-90},{x:393,y:695,w:45.6,h:16,angle:-90},{x:450,y:697.5,w:46.1,h:16,angle:-90},{x:508,y:698.5,w:46.6,h:16,angle:-90},{x:565.3,y:699.8,w:46.9,h:17,angle:89.9},{x:623,y:700.9,w:47.2,h:16,angle:-90},{x:306,y:711.9,w:44.1,h:16,angle:-90},{x:825,y:716,w:48,h:16,angle:-90},{x:854,y:716,w:48,h:16,angle:-90},{x:883,y:716,w:48,h:16,angle:-90},{x:911.5,y:716,w:48,h:15,angle:-90},{x:940,y:716,w:48,h:16,angle:-90},{x:1027,y:716,w:48,h:16,angle:-90},{x:1055.5,y:716,w:48,h:15,angle:-90},{x:1084,y:716,w:48,h:16,angle:-90},{x:1142,y:716,w:48,h:16,angle:-90},{x:1171,y:716,w:48,h:16,angle:-90},{x:1199.5,y:716,w:48,h:15,angle:-90},{x:1228,y:716,w:48,h:16,angle:-90},{x:1257,y:716,w:48,h:16,angle:-90},{x:1286,y:716,w:48,h:16,angle:-90},{x:1315,y:716,w:48,h:16,angle:-90},{x:1343.5,y:716,w:48,h:17,angle:-90},{x:1372,y:716,w:48,h:16,angle:-90},{x:1401,y:716,w:48,h:16,angle:-90},{x:1430,y:716,w:48,h:16,angle:-90},{x:1459,y:716,w:48,h:16,angle:-90},{x:1487,y:716,w:48,h:16,angle:-90},{x:364,y:716.2,w:45.2,h:16,angle:-90},{x:681,y:716.5,w:47,h:16,angle:-90},{x:709.5,y:716.5,w:47,h:15,angle:-90},{x:738.5,y:716.5,w:47,h:15,angle:-90},{x:767.5,y:716.5,w:47,h:15,angle:-90},{x:796,y:716.5,w:47,h:16,angle:-90},{x:969,y:716.5,w:47,h:16,angle:-90},{x:998,y:716.5,w:47,h:16,angle:-90},{x:1113,y:716.5,w:47,h:16,angle:-90},{x:1515,y:716.5,w:47,h:14,angle:-90},{x:421,y:719.4,w:45.8,h:16,angle:-90},{x:479,y:720.8,w:46.3,h:16,angle:-90},{x:537,y:722.6,w:46.8,h:16,angle:-90},{x:651.5,y:725,w:47.4,h:17,angle:-90},{x:335,y:736.6,w:44.7,h:16,angle:-90},{x:594,y:736.9,w:44.8,h:16,angle:-90},{x:393,y:740.6,w:45.6,h:16,angle:-90},{x:450,y:743.6,w:46.1,h:16,angle:-90},{x:508,y:745,w:46.6,h:16,angle:-90},{x:565.4,y:746.7,w:46.9,h:17,angle:89.9},{x:623,y:748.1,w:47.2,h:16,angle:-90},{x:364,y:761.4,w:45.2,h:16,angle:-90},{x:421,y:765.2,w:45.8,h:16,angle:-90},{x:479,y:767.2,w:46.3,h:16,angle:-90},{x:537,y:769.3,w:46.8,h:16,angle:-90},{x:651.5,y:772.4,w:47.4,h:17,angle:-90},{x:883,y:776.5,w:47,h:16,angle:-90},{x:911.5,y:776.5,w:47,h:15,angle:-90},{x:940,y:776.5,w:47,h:16,angle:-90},{x:969,y:776.5,w:47,h:16,angle:-90},{x:998,y:776.5,w:47,h:16,angle:-90},{x:1027,y:776.5,w:47,h:16,angle:-90},{x:1055.5,y:776.5,w:47,h:15,angle:-90},{x:1084,y:776.5,w:47,h:16,angle:-90},{x:1113,y:776.5,w:47,h:16,angle:-90},{x:1142,y:776.5,w:47,h:16,angle:-90},{x:1171,y:776.5,w:47,h:16,angle:-90},{x:1199.5,y:776.5,w:47,h:15,angle:-90},{x:1315,y:776.5,w:47,h:16,angle:-90},{x:1343.5,y:776.5,w:47,h:15,angle:-90},{x:795.5,y:777,w:46,h:13,angle:-90},{x:825,y:777,w:46,h:16,angle:-90},{x:854,y:777,w:46,h:16,angle:-90},{x:1228,y:777,w:48,h:16,angle:-90},{x:1257,y:777,w:48,h:16,angle:-90},{x:1286,y:777,w:48,h:16,angle:-90},{x:1401,y:777,w:46,h:16,angle:-90},{x:1430,y:777,w:46,h:16,angle:-90},{x:681,y:777.5,w:45,h:16,angle:-90},{x:709.5,y:777.5,w:45,h:15,angle:-90},{x:738.5,y:777.5,w:45,h:15,angle:-90},{x:767.5,y:777.5,w:45,h:15,angle:-90},{x:1371,y:777.5,w:45,h:14,angle:-90},{x:1458.5,y:777.5,w:45,h:15,angle:-90},{x:1487.5,y:777.5,w:45,h:15,angle:-90},{x:1515.5,y:777.5,w:45,h:13,angle:-90},{x:594,y:781.6,w:44.8,h:16,angle:-90},{x:393,y:786.2,w:45.6,h:16,angle:-90},{x:450,y:789.8,w:46.1,h:16,angle:-90},{x:508,y:791.6,w:46.6,h:16,angle:-90},{x:565.5,y:793.7,w:46.9,h:17,angle:89.9},{x:623,y:795.4,w:47.2,h:16,angle:-90},{x:421,y:811.1,w:45.8,h:16,angle:-90},{x:479,y:813.5,w:46.3,h:16,angle:-90},{x:537,y:816.1,w:46.8,h:16,angle:-90},{x:651.5,y:819.8,w:47.4,h:17,angle:-90},{x:594,y:826.4,w:44.8,h:16,angle:-90},{x:450,y:835.9,w:46.1,h:16,angle:-90},{x:911.5,y:837,w:48,h:15,angle:-90},{x:940,y:837,w:48,h:16,angle:-90},{x:969,y:837,w:48,h:16,angle:-90},{x:998,y:837,w:48,h:16,angle:-90},{x:1027,y:837,w:48,h:16,angle:-90},{x:1055.5,y:837,w:48,h:15,angle:-90},{x:1084,y:837,w:48,h:16,angle:-90},{x:1113,y:837,w:48,h:16,angle:-90},{x:1142,y:837,w:48,h:16,angle:-90},{x:1171,y:837,w:48,h:16,angle:-90},{x:1199.5,y:837,w:48,h:15,angle:-90},{x:1228,y:837,w:48,h:16,angle:-90},{x:1257,y:837,w:48,h:16,angle:-90},{x:1286,y:837,w:48,h:16,angle:-90},{x:1314.5,y:837,w:48,h:15,angle:-90},{x:1343.5,y:837,w:48,h:15,angle:-90},{x:681,y:837.5,w:47,h:16,angle:-90},{x:709.5,y:837.5,w:47,h:15,angle:-90},{x:738.5,y:837.5,w:47,h:15,angle:-90},{x:767.5,y:837.5,w:47,h:15,angle:-90},{x:795.5,y:837.5,w:47,h:13,angle:-90},{x:825,y:837.5,w:47,h:16,angle:-90},{x:854,y:837.5,w:47,h:16,angle:-90},{x:882.5,y:837.5,w:47,h:15,angle:-90},{x:1371.5,y:837.5,w:47,h:13,angle:-90},{x:1401,y:837.5,w:47,h:16,angle:-90},{x:1430,y:837.5,w:47,h:16,angle:-90},{x:1458.5,y:837.5,w:47,h:15,angle:-90},{x:1487.5,y:837.5,w:47,h:15,angle:-90},{x:1515.5,y:837.5,w:47,h:13,angle:-90},{x:508,y:838.2,w:46.6,h:16,angle:-90},{x:565.5,y:840.6,w:46.9,h:17,angle:89.9},{x:623,y:842.6,w:47.2,h:16,angle:-90},{x:479,y:859.8,w:46.3,h:16,angle:-90},{x:537,y:862.9,w:46.8,h:16,angle:-90},{x:651.5,y:867.2,w:47.4,h:17,angle:-90},{x:594,y:871.1,w:44.8,h:16,angle:-90},{x:508,y:884.7,w:46.6,h:16,angle:-90},{x:565.6,y:887.6,w:46.9,h:17,angle:89.9},{x:623,y:889.9,w:47.2,h:16,angle:-90},{x:940,y:897.5,w:47,h:16,angle:-90},{x:969,y:897.5,w:47,h:16,angle:-90},{x:998,y:897.5,w:47,h:16,angle:-90},{x:1027,y:897.5,w:47,h:16,angle:-90},{x:1055.5,y:897.5,w:47,h:15,angle:-90},{x:1084,y:897.5,w:47,h:16,angle:-90},{x:1113,y:897.5,w:47,h:16,angle:-90},{x:1142,y:897.5,w:47,h:16,angle:-90},{x:1171,y:897.5,w:47,h:16,angle:-90},{x:1199,y:897.5,w:47,h:16,angle:-90},{x:1228,y:897.5,w:47,h:16,angle:-90},{x:681,y:898.5,w:45,h:16,angle:-90},{x:709.5,y:898.5,w:45,h:15,angle:-90},{x:738.5,y:898.5,w:45,h:15,angle:-90},{x:767.5,y:898.5,w:45,h:15,angle:-90},{x:795.5,y:898.5,w:45,h:13,angle:-90},{x:825,y:898.5,w:45,h:16,angle:-90},{x:853.5,y:898.5,w:45,h:15,angle:-90},{x:882.5,y:898.5,w:45,h:15,angle:-90},{x:911.5,y:898.5,w:45,h:15,angle:-90},{x:1257,y:898.5,w:45,h:16,angle:-90},{x:1286,y:898.5,w:45,h:16,angle:-90},{x:1314.5,y:898.5,w:45,h:15,angle:-90},{x:1343.5,y:898.5,w:45,h:15,angle:-90},{x:1371.5,y:898.5,w:45,h:13,angle:-90},{x:1401,y:898.5,w:45,h:16,angle:-90},{x:1430,y:898.5,w:45,h:16,angle:-90},{x:1458.5,y:898.5,w:45,h:15,angle:-90},{x:1487.5,y:898.5,w:45,h:15,angle:-90},{x:1515.5,y:898.5,w:45,h:13,angle:-90},{x:537,y:909.6,w:46.8,h:16,angle:-90},{x:651.5,y:914.5,w:47.4,h:17,angle:-90},{x:594,y:915.9,w:44.8,h:16,angle:-90},{x:565.7,y:934.5,w:46.9,h:17,angle:89.9},{x:623,y:937.1,w:47.2,h:16,angle:-90},{x:911.5,y:958,w:48,h:15,angle:-90},{x:940,y:958,w:48,h:16,angle:-90},{x:969,y:958,w:48,h:16,angle:-90},{x:998,y:958,w:48,h:16,angle:-90},{x:1027,y:958,w:48,h:16,angle:-90},{x:1055,y:958,w:48,h:16,angle:-90},{x:1084,y:958,w:48,h:16,angle:-90},{x:1113,y:958,w:48,h:16,angle:-90},{x:1142,y:958,w:48,h:16,angle:-90},{x:1171,y:958,w:48,h:16,angle:-90},{x:1199.5,y:958,w:48,h:17,angle:-90},{x:1228,y:958,w:48,h:16,angle:-90},{x:1257,y:958,w:48,h:16,angle:-90},{x:681,y:958.5,w:47,h:16,angle:-90},{x:709.5,y:958.5,w:47,h:15,angle:-90},{x:738.5,y:958.5,w:47,h:15,angle:-90},{x:767.5,y:958.5,w:47,h:15,angle:-90},{x:795.5,y:958.5,w:47,h:13,angle:-90},{x:825,y:958.5,w:47,h:16,angle:-90},{x:854,y:958.5,w:47,h:16,angle:-90},{x:883,y:958.5,w:47,h:16,angle:-90},{x:1286,y:958.5,w:47,h:16,angle:-90},{x:1314.5,y:958.5,w:47,h:15,angle:-90},{x:1343.5,y:958.5,w:47,h:15,angle:-90},{x:1371.5,y:958.5,w:47,h:13,angle:-90},{x:1401,y:958.5,w:47,h:16,angle:-90},{x:1430,y:958.5,w:47,h:16,angle:-90},{x:1458.5,y:958.5,w:47,h:15,angle:-90},{x:1487.5,y:958.5,w:47,h:15,angle:-90},{x:1515.5,y:958.5,w:47,h:13,angle:-90},{x:594,y:960.6,w:44.8,h:16,angle:-90},{x:651.5,y:961.9,w:47.4,h:17,angle:-90},{x:623,y:984.4,w:47.2,h:16,angle:-90},{x:651.5,y:1009.3,w:47.4,h:17,angle:-90},{x:825,y:1018.5,w:47,h:16,angle:-90},{x:854,y:1018.5,w:47,h:16,angle:-90},{x:883,y:1018.5,w:47,h:16,angle:-90},{x:911.5,y:1018.5,w:47,h:15,angle:-90},{x:940,y:1018.5,w:47,h:16,angle:-90},{x:969,y:1018.5,w:47,h:16,angle:-90},{x:998,y:1018.5,w:47,h:16,angle:-90},{x:1027,y:1018.5,w:47,h:16,angle:-90},{x:1055.5,y:1018.5,w:47,h:15,angle:-90},{x:1084,y:1018.5,w:47,h:16,angle:-90},{x:1113,y:1018.5,w:47,h:16,angle:-90},{x:1142,y:1018.5,w:47,h:16,angle:-90},{x:1171,y:1018.5,w:47,h:16,angle:-90},{x:1199.5,y:1018.5,w:47,h:15,angle:-90},{x:1228,y:1018.5,w:47,h:16,angle:-90},{x:1257,y:1018.5,w:47,h:16,angle:-90},{x:1286,y:1018.5,w:47,h:16,angle:-90},{x:1315,y:1018.5,w:47,h:16,angle:-90},{x:1343.5,y:1018.5,w:47,h:17,angle:-90},{x:1372,y:1018.5,w:47,h:16,angle:-90},{x:1401,y:1018.5,w:47,h:16,angle:-90},{x:681,y:1019.5,w:45,h:16,angle:-90},{x:709.5,y:1019.5,w:45,h:15,angle:-90},{x:738.5,y:1019.5,w:45,h:15,angle:-90},{x:767.5,y:1019.5,w:45,h:15,angle:-90},{x:795.5,y:1019.5,w:45,h:13,angle:-90},{x:1430,y:1019.5,w:45,h:16,angle:-90},{x:1459.5,y:1019.5,w:45,h:13,angle:-90},{x:1487.5,y:1019.5,w:45,h:15,angle:-90},{x:1515.5,y:1019.5,w:45,h:13,angle:-90}]},connection_blocks:[`min_x`]},{slug:`spiral`,top_extract:{blocks:[{x:939,y:51.5,w:43,h:14,angle:-90},{x:967.1,y:51.8,w:43.9,h:15.4,angle:-86.2},{x:910.9,y:52.9,w:43.9,h:15,angle:87.1},{x:994.9,y:53.8,w:44,h:15.5,angle:-82.1},{x:883,y:55.9,w:43.9,h:15.4,angle:84.3},{x:1022.5,y:57.4,w:43.7,h:15.4,angle:-79.2},{x:855.4,y:60.6,w:43.7,h:15.3,angle:80.5},{x:1050.1,y:62.8,w:43.7,h:15.9,angle:-76.5},{x:827.7,y:67.2,w:43.9,h:15.4,angle:77},{x:1076.8,y:69.6,w:43.8,h:15.7,angle:-72.5},{x:800.6,y:75.3,w:43.7,h:15.5,angle:74.1},{x:1103.1,y:78,w:43.9,h:15.7,angle:-69},{x:774,y:84.8,w:43.9,h:15.8,angle:70.2},{x:1128.9,y:88.2,w:43.9,h:15.6,angle:-66},{x:747.8,y:96.3,w:43.8,h:15.9,angle:67.6},{x:1154,y:99.8,w:44.4,h:15.8,angle:-61.9},{x:722.3,y:109.1,w:43.4,h:15.7,angle:63.4},{x:1178.2,y:112.6,w:43.7,h:16.1,angle:-59},{x:697.9,y:123.6,w:44.2,h:15.9,angle:59.5},{x:1201.5,y:127,w:44.1,h:15.5,angle:-54.8},{x:674,y:139.5,w:43.5,h:15.5,angle:56.3},{x:1223.8,y:142.6,w:43.9,h:16.1,angle:-52.1},{x:651,y:156.9,w:43.8,h:15.4,angle:53.1},{x:1245.4,y:159.8,w:44,h:15.7,angle:-48.2},{x:937,y:161.5,w:43,h:14,angle:-90},{x:965.5,y:161.5,w:43.7,h:15.3,angle:-84.8},{x:908.2,y:163.3,w:43.5,h:15,angle:86.4},{x:993.9,y:164,w:43.8,h:15.4,angle:-80},{x:879.8,y:167.5,w:44,h:15.3,angle:81.3},{x:1021.9,y:168.7,w:43.7,h:15.3,angle:-76},{x:851.8,y:174.2,w:43.9,h:15.5,angle:76},{x:629.4,y:175.6,w:43.7,h:15.5,angle:49.9},{x:1049.2,y:175.8,w:43.6,h:15.5,angle:-71.6},{x:1265.8,y:177.8,w:43.8,h:14.8,angle:-45},{x:824,y:183,w:43.6,h:15.2,angle:71.6},{x:1075.8,y:184.8,w:44.1,h:15.5,angle:-66.4},{x:797.1,y:194.2,w:43.8,h:15.3,angle:67.4},{x:608.8,y:195.8,w:43.1,h:15.6,angle:45},{x:1101.6,y:196.1,w:44,h:15.4,angle:-61.7},{x:1284.8,y:197.3,w:44,h:15.9,angle:-39.8},{x:771.1,y:207.4,w:43.9,h:15.6,angle:64.3},{x:1126.2,y:209.3,w:44.1,h:15.5,angle:-56.3},{x:589.2,y:216.9,w:43.9,h:15.7,angle:42.4},{x:1302.6,y:217.7,w:44,h:15.6,angle:-38.7},{x:746.1,y:222.9,w:43.6,h:15.5,angle:58.4},{x:1149.8,y:224.3,w:44,h:15.9,angle:-52.4},{x:1319,y:239,w:43.8,h:16.6,angle:-33.7},{x:571,y:239.5,w:43.7,h:15.5,angle:38.7},{x:722.3,y:240.5,w:44,h:15.4,angle:53.1},{x:1171.8,y:241.1,w:44.2,h:15.8,angle:-48},{x:1192.5,y:259.5,w:43.8,h:15.6,angle:-45},{x:699.8,y:259.8,w:43.9,h:15.6,angle:48},{x:1334.4,y:261.6,w:43.6,h:16.1,angle:-31},{x:554,y:263.2,w:43.7,h:15.8,angle:35.5},{x:949.9,y:270.5,w:43.9,h:15.4,angle:-86.4},{x:922.5,y:271.5,w:43,h:15,angle:-90},{x:976.9,y:272.2,w:43.9,h:15.4,angle:-80},{x:895.2,y:276.2,w:43.7,h:15.4,angle:81},{x:1003.7,y:276.8,w:43.9,h:15.7,angle:-72.9},{x:1211.3,y:279.3,w:44.1,h:15.4,angle:-38.3},{x:679.3,y:280.8,w:43.8,h:14.8,angle:45},{x:868.2,y:283.6,w:43.8,h:15.7,angle:74.1},{x:1029.3,y:284.3,w:44,h:15.4,angle:-67.8},{x:1348.2,y:284.5,w:43.7,h:15.6,angle:-27.8},{x:538.6,y:287.7,w:43.9,h:15.5,angle:31.8},{x:842.3,y:293.9,w:43.8,h:15.4,angle:68.2},{x:1053.9,y:294.5,w:43.9,h:15.8,angle:-60.5},{x:1228.2,y:300.5,w:43.5,h:15.5,angle:-33.7},{x:659.7,y:303.7,w:43.8,h:15.2,angle:39.8},{x:817.4,y:307.2,w:43.8,h:15.5,angle:62.1},{x:1076.9,y:307.3,w:44.1,h:15.5,angle:-53.7},{x:1360.6,y:308.5,w:44.1,h:15.5,angle:-24.1},{x:524.6,y:313.3,w:44.1,h:15.4,angle:28.6},{x:793.8,y:323.2,w:43.8,h:15.4,angle:55.7},{x:1243.8,y:323.2,w:43.9,h:15.6,angle:-29.4},{x:1100.2,y:324,w:43.9,h:15.7,angle:-47.3},{x:644.6,y:325,w:43.7,h:15.5,angle:35.8},{x:1371.7,y:333,w:43.7,h:16.1,angle:-22.2},{x:512.2,y:339.7,w:43.5,h:15.2,angle:24.9},{x:772.1,y:342,w:44,h:15.3,angle:49.4},{x:1121,y:343,w:43.8,h:15.4,angle:-40.9},{x:1257.3,y:346.6,w:43.9,h:15.3,angle:-25.7},{x:630.8,y:347.3,w:43.8,h:15.4,angle:32.7},{x:1380.8,y:358.2,w:43.8,h:15.5,angle:-16.3},{x:754,y:361,w:43.8,h:15.6,angle:45},{x:1139.2,y:364.3,w:43.8,h:15.8,angle:-33.7},{x:501.4,y:367,w:43.8,h:15.2,angle:21.8},{x:618.4,y:370.8,w:43.6,h:15.5,angle:28.1},{x:1268.7,y:371.2,w:43.9,h:15.5,angle:-20.2},{x:961.8,y:380.3,w:44,h:15.4,angle:-78.2},{x:935,y:380.5,w:43,h:14,angle:-90},{x:738.1,y:382.1,w:43.8,h:15.7,angle:37.4},{x:1388.7,y:383.5,w:43.9,h:15.4,angle:-13.4},{x:908.3,y:385.3,w:43.6,h:15,angle:79.1},{x:988.7,y:385.9,w:43.8,h:15.5,angle:-66},{x:1154.6,y:387.3,w:43.9,h:15.5,angle:-27.3},{x:492.1,y:394.7,w:43.7,h:15.6,angle:17.9},{x:608,y:394.8,w:43.7,h:15.5,angle:23.6},{x:884,y:395.1,w:43.6,h:15.6,angle:68.2},{x:1278,y:396.3,w:43.8,h:15.5,angle:-15.9},{x:1013.3,y:396.5,w:43.8,h:15.9,angle:-55.3},{x:724,y:404.8,w:43.8,h:15.3,angle:31.8},{x:1395,y:409.4,w:43.9,h:15.6,angle:-9.8},{x:861.2,y:409.5,w:43.9,h:15.9,angle:59},{x:1167,y:411.7,w:43.9,h:15.7,angle:-20},{x:1035.3,y:412,w:43.9,h:15.6,angle:-42.7},{x:599.1,y:419.7,w:43.6,h:15.8,angle:18.4},{x:1285.6,y:422.3,w:43.7,h:15.7,angle:-11.3},{x:484.5,y:423.1,w:43.7,h:15.2,angle:14.6},{x:840.8,y:427.9,w:43.7,h:15.5,angle:47.7},{x:712.4,y:428.7,w:43.4,h:15.2,angle:26.6},{x:1053.1,y:431.5,w:44,h:15.7,angle:-30.1},{x:1399.7,y:435.5,w:43.9,h:15.4,angle:-6.7},{x:1176.3,y:437.6,w:43.8,h:15.4,angle:-12.8},{x:591.8,y:445.5,w:43.7,h:15.4,angle:15.9},{x:1290.9,y:448.3,w:43.8,h:15.5,angle:-6.3},{x:824.6,y:449.2,w:43.7,h:15.8,angle:37.7},{x:478.7,y:452,w:43.7,h:15.1,angle:11.3},{x:703,y:454.2,w:43.7,h:15.5,angle:19.7},{x:1066.7,y:454.9,w:44.3,h:15.6,angle:-16.7},{x:1402.6,y:461.9,w:43.6,h:15.5,angle:-3.6},{x:1182.4,y:463.9,w:43.8,h:15.3,angle:-6},{x:586.6,y:471.7,w:43.7,h:15.3,angle:11.3},{x:812.4,y:473,w:43.9,h:15.4,angle:27.6},{x:1293.5,y:474.5,w:43,h:15,angle:0},{x:696.4,y:480.4,w:43.7,h:15.3,angle:14.6},{x:1074.6,y:480.8,w:43.6,h:15.3,angle:-3.4},{x:474.6,y:481.3,w:43.7,h:15.1,angle:8.1},{x:1404.5,y:488.5,w:43,h:15,angle:0},{x:1185.5,y:490.5,w:43,h:15,angle:0},{x:582.9,y:498.2,w:43.7,h:15.3,angle:7.6},{x:804,y:499.2,w:43.7,h:15.5,angle:17.4},{x:1294.6,y:501.2,w:43.4,h:15.4,angle:2.5},{x:1076.3,y:507,w:43.8,h:15.5,angle:10.8},{x:692,y:507.5,w:43.7,h:15.4,angle:9},{x:472.3,y:510.7,w:43.7,h:15.2,angle:4.1},{x:1404.2,y:514.8,w:43.8,h:15.8,angle:3.8},{x:1184.8,y:517,w:43.7,h:15.6,angle:8.1},{x:581.3,y:525.1,w:43.6,h:15.2,angle:3.6},{x:800.2,y:525.3,w:43.8,h:15.3,angle:8.1},{x:1293.8,y:527.5,w:43.9,h:15.3,angle:7.1},{x:1071.4,y:533.1,w:43.8,h:15.6,angle:25.2},{x:690.6,y:534.9,w:43.5,h:15.2,angle:2.9},{x:471.5,y:540.5,w:43,h:15,angle:0},{x:1402.5,y:540.9,w:43.9,h:15.5,angle:6.7},{x:1181.4,y:542.9,w:43.9,h:15.8,angle:14.9},{x:581.5,y:552,w:43,h:14,angle:0},{x:800.5,y:552,w:43,h:14,angle:0},{x:910.9,y:552.8,w:43.8,h:15.1,angle:-4.8},{x:1290.6,y:553.5,w:43.9,h:15.6,angle:12.3},{x:1060.4,y:557.3,w:44,h:15.5,angle:39.8},{x:692,y:562.5,w:44,h:15,angle:0},{x:1399.4,y:566.9,w:43.9,h:15.5,angle:10.6},{x:472.6,y:570.2,w:43.3,h:15.2,angle:-2},{x:1174,y:570.3,w:43.6,h:15.8,angle:21.8},{x:923.9,y:575.9,w:43.9,h:15.4,angle:-29.1},{x:1043.5,y:577.6,w:43.9,h:15.4,angle:55.3},{x:805.8,y:578.8,w:43.7,h:15.3,angle:-10.6},{x:583.7,y:579,w:43.8,h:15.2,angle:-4.4},{x:1284.4,y:582.4,w:44,h:15.4,angle:17.1},{x:696.1,y:590,w:43.8,h:15.3,angle:-8.1},{x:944.6,y:592.3,w:44,h:15.5,angle:-50.7},{x:1021.8,y:592.4,w:43.7,h:15.4,angle:72.1},{x:1163.3,y:596.1,w:43.9,h:15.6,angle:30.6},{x:1393.7,y:597,w:43.8,h:15.5,angle:15.3},{x:475.8,y:599.7,w:43.7,h:15.2,angle:-5.2},{x:996.5,y:600.5,w:43,h:15,angle:-90},{x:970.4,y:601,w:44,h:15.8,angle:-72.3},{x:815.2,y:604.9,w:43.7,h:15.5,angle:-20.2},{x:587.7,y:605.8,w:43.8,h:15.3,angle:-8.1},{x:1275.9,y:610.4,w:44.1,h:16.1,angle:20.9},{x:703,y:617.1,w:43.7,h:15.3,angle:-14},{x:1149.5,y:620,w:43.9,h:15.5,angle:38.2},{x:1385.9,y:626.3,w:44.3,h:15.8,angle:18.4},{x:827.8,y:628.1,w:43.9,h:15.4,angle:-29.1},{x:480.7,y:629.1,w:43.7,h:15.1,angle:-9.2},{x:593.6,y:632.3,w:43.6,h:15.4,angle:-12.3},{x:1264.8,y:637.4,w:43.8,h:15.2,angle:26.6},{x:1132.5,y:641.5,w:43.8,h:15.6,angle:45},{x:712.7,y:643.6,w:44,h:15.6,angle:-19.8},{x:844,y:649.2,w:43.8,h:15.6,angle:-36.9},{x:1376.3,y:655.1,w:43.7,h:15.9,angle:22.2},{x:487.1,y:658.3,w:43.7,h:15.2,angle:-12.7},{x:601.5,y:658.6,w:43.9,h:15.4,angle:-16.7},{x:1113.9,y:660.7,w:43.8,h:15.4,angle:53.1},{x:1251.5,y:662.7,w:43.9,h:15.9,angle:32.7},{x:864,y:668,w:43.8,h:15.6,angle:-45},{x:725,y:669,w:43.8,h:15.2,angle:-26.6},{x:1092.6,y:676.9,w:43.8,h:15.7,angle:59.9},{x:1364.2,y:683.1,w:43.4,h:15.2,angle:26.6},{x:886,y:684.1,w:43.8,h:15.4,angle:-55},{x:611,y:684.2,w:43.6,h:15.3,angle:-20.8},{x:495.4,y:686.9,w:43.7,h:15.4,angle:-15.6},{x:1235.9,y:687.2,w:43.8,h:15.5,angle:37.6},{x:1069.7,y:690.1,w:43.9,h:15.5,angle:67.6},{x:739.9,y:693.4,w:43.8,h:15.6,angle:-32},{x:910.7,y:696.6,w:43.4,h:15.2,angle:-63.4},{x:1043.7,y:700.8,w:43.7,h:15.5,angle:76},{x:936.3,y:704.6,w:44,h:15.5,angle:-71.6},{x:1016.8,y:707.5,w:43.7,h:15.3,angle:83.7},{x:622.4,y:709.2,w:43.5,h:15.5,angle:-24.6},{x:962.4,y:709.4,w:43.8,h:15.3,angle:-80},{x:1218.4,y:710.1,w:43.4,h:15.6,angle:43.6},{x:1350.8,y:710.1,w:44.1,h:15.3,angle:31.3},{x:989.5,y:710.5,w:43,h:15,angle:-90},{x:505.5,y:715.3,w:43.5,h:15.3,angle:-19.7},{x:757.4,y:716.2,w:44,h:15.5,angle:-37.6},{x:1198.9,y:730.9,w:43.8,h:15.8,angle:48.4},{x:635.6,y:733.2,w:43.7,h:15.3,angle:-28.6},{x:1335.1,y:736,w:43.7,h:15.7,angle:35.5},{x:777.2,y:737.4,w:43.8,h:15.5,angle:-42.3},{x:517.1,y:742.9,w:43.6,h:15.6,angle:-22.6},{x:1177.8,y:749.9,w:44,h:15.8,angle:53.1},{x:798.9,y:756.5,w:43.8,h:15.5,angle:-49.4},{x:650.6,y:756.6,w:43.5,h:15.5,angle:-33.7},{x:1318.1,y:760.5,w:43.9,h:15.5,angle:39},{x:1155.1,y:766.6,w:43.6,h:15.8,angle:58},{x:530.8,y:770.1,w:43.4,h:15.2,angle:-26.6},{x:820.5,y:771.9,w:43.9,h:15.3,angle:-54.5},{x:667,y:778.9,w:43.8,h:15.4,angle:-36.9},{x:1131.2,y:781.4,w:43.8,h:15.2,angle:63.4},{x:1299.3,y:783.8,w:43.8,h:15.3,angle:43},{x:1434.4,y:783.9,w:43.8,h:15.2,angle:33.2},{x:843.1,y:785.4,w:43.7,h:15.3,angle:-59},{x:1106.2,y:793.8,w:43.8,h:15.5,angle:68.7},{x:545.7,y:796.3,w:43.6,h:15.4,angle:-29.1},{x:867.2,y:796.6,w:43.8,h:15.3,angle:-64.5},{x:685.1,y:800,w:43.6,h:15.4,angle:-40.2},{x:1080.2,y:804,w:43.5,h:15.4,angle:74.1},{x:892.1,y:805.9,w:43.8,h:15.6,angle:-69.4},{x:1279,y:806,w:43.8,h:15.6,angle:45},{x:1420,y:806.6,w:44,h:15.4,angle:36},{x:1053.4,y:811.6,w:43.7,h:15.4,angle:79.4},{x:918.2,y:812.9,w:43.6,h:15.3,angle:-74.7},{x:1026.5,y:816.8,w:43.8,h:15.3,angle:84.3},{x:944.8,y:817.5,w:43.8,h:15.4,angle:-80},{x:999,y:819.5,w:43,h:14,angle:-90},{x:971.8,y:819.7,w:43.7,h:15.3,angle:-85.6},{x:704.8,y:819.8,w:43.8,h:14.8,angle:-45},{x:562.2,y:821.5,w:43.5,h:15.5,angle:-33.7},{x:1257.2,y:826,w:43.9,h:15.3,angle:51.3},{x:1404.3,y:828.2,w:44,h:16,angle:39.5},{x:725.9,y:838.2,w:43.9,h:15.5,angle:-48.4},{x:1234.1,y:844.9,w:43.8,h:15.8,angle:56.3},{x:580.4,y:845.8,w:43.6,h:15.4,angle:-36.9},{x:1387.3,y:849.5,w:43.9,h:15.7,angle:42},{x:748.4,y:855.5,w:44,h:15.9,angle:-52.4},{x:1209.9,y:861.9,w:43.9,h:15.8,angle:59},{x:600,y:869,w:43.7,h:15.6,angle:-39.8},{x:1370,y:869.5,w:43.1,h:16.3,angle:45},{x:771.7,y:870.7,w:43.5,h:15.3,angle:-56.3},{x:1184.6,y:877.2,w:43.8,h:15.2,angle:63.4},{x:796.3,y:884.5,w:43.7,h:15.7,angle:-60.6},{x:1350.8,y:888.7,w:44.5,h:15.8,angle:47},{x:1158.4,y:890.3,w:44.1,h:15.4,angle:67.1},{x:621.1,y:891.2,w:43.8,h:15.3,angle:-43.5},{x:821.9,y:896.6,w:43.8,h:15.5,angle:-65.1},{x:1131.5,y:901.9,w:43.6,h:15.5,angle:71.6},{x:1331.5,y:906.7,w:43.8,h:15.7,angle:50.2},{x:848.4,y:906.9,w:43.7,h:15.5,angle:-68.6},{x:1103.7,y:911.5,w:43.9,h:15.5,angle:75.4},{x:643.4,y:911.9,w:43.5,h:15.5,angle:-47},{x:875.7,y:915.4,w:44,h:15.5,angle:-71.6},{x:1075.5,y:918.9,w:44,h:15.6,angle:78.3},{x:903.6,y:921.7,w:43.7,h:15.2,angle:-77.2},{x:1310.9,y:924,w:43.9,h:15.6,angle:53.6},{x:1047,y:924.4,w:43.8,h:15.3,angle:82.9},{x:931.8,y:926.3,w:43.7,h:15.5,angle:-80.5},{x:1018.3,y:928,w:43.8,h:15.3,angle:87.3},{x:960.5,y:928.8,w:43.6,h:15.2,angle:-85},{x:989.5,y:929.5,w:43,h:15,angle:-90},{x:667.1,y:931.6,w:43.8,h:15.7,angle:-50.2},{x:1289.8,y:940,w:44.1,h:15.8,angle:56.3},{x:691.7,y:949.4,w:43.8,h:15.5,angle:-53.6},{x:1267.5,y:955.1,w:43.9,h:15.9,angle:59},{x:717.7,y:966,w:43.7,h:15.4,angle:-57.4},{x:1245.2,y:968.7,w:44.1,h:15.6,angle:61.4},{x:744.2,y:980.9,w:43.8,h:15.6,angle:-61.4},{x:1221.5,y:981.5,w:43.6,h:15.8,angle:65},{x:1197.7,y:993,w:44,h:15.8,angle:68.2},{x:772.3,y:994.5,w:43.8,h:15.6,angle:-64.7},{x:1173.5,y:1002.9,w:44.2,h:15.9,angle:69.8},{x:801,y:1006.2,w:43.8,h:15.6,angle:-67.8},{x:1148.6,y:1012.1,w:43.7,h:15.6,angle:72.6},{x:830,y:1016,w:43.6,h:15.2,angle:-71.6},{x:1123.3,y:1019.8,w:43.9,h:15.3,angle:76},{x:860,y:1024.3,w:43.8,h:15.2,angle:-74.1},{x:1097.8,y:1026.2,w:43.9,h:15.5,angle:78.7},{x:890.4,y:1030.8,w:43.8,h:15.2,angle:-78.1},{x:1072.2,y:1031.3,w:44,h:15.6,angle:81.9},{x:1046.2,y:1035.2,w:43.8,h:15.3,angle:84.3},{x:921.3,y:1035.4,w:43.6,h:15.1,angle:-81.3},{x:952.3,y:1038.2,w:43.7,h:15.2,angle:-84.8},{x:1014.9,y:1038.3,w:43.2,h:15.2,angle:88.2},{x:983.5,y:1039.5,w:43,h:15,angle:-90}]},connection_blocks:[148,222]},{slug:`double-spiral`,top_extract:{blocks:[{x:909,y:37,w:18,h:6,angle:-90},{x:924,y:37,w:18,h:6,angle:-90},{x:894,y:37.5,w:17,h:6,angle:-90},{x:940,y:37.5,w:17,h:6,angle:-90},{x:954.6,y:38,w:18.4,h:6.7,angle:-83.7},{x:878.7,y:38.5,w:17.4,h:6.7,angle:85.6},{x:969.5,y:39.5,w:17,h:7,angle:-90},{x:863.5,y:40.1,w:18.2,h:6.7,angle:83.7},{x:984.6,y:41,w:18.2,h:6.6,angle:-81.9},{x:848.3,y:42.2,w:18.2,h:6.8,angle:81.9},{x:999.7,y:43.2,w:18.2,h:6.9,angle:-78.7},{x:833.2,y:44.6,w:17.9,h:6.8,angle:81.3},{x:1014.3,y:45.7,w:18,h:6.7,angle:-78.7},{x:817.9,y:47.4,w:18,h:6.7,angle:79.7},{x:1028.9,y:48.9,w:18.2,h:6.5,angle:-76},{x:802.9,y:50.8,w:17.9,h:6.8,angle:76},{x:1043.5,y:52.2,w:18.3,h:6.6,angle:-74.1},{x:788,y:54.4,w:18.2,h:6.5,angle:76},{x:1057.9,y:56,w:18.4,h:6.7,angle:-73.3},{x:773,y:58.9,w:18.3,h:6.7,angle:74.1},{x:1072.3,y:60.6,w:18,h:6.6,angle:-71.6},{x:758.3,y:63.4,w:18,h:6.6,angle:71.6},{x:1086.3,y:65.2,w:18,h:6.8,angle:-69.4},{x:743.6,y:68.7,w:18,h:6.7,angle:70},{x:1100.1,y:70.3,w:18.4,h:6.7,angle:-68.2},{x:729.1,y:74.3,w:17.8,h:6.6,angle:69.4},{x:1113.8,y:75.9,w:17.9,h:6.7,angle:-63.4},{x:714.8,y:80.4,w:18.4,h:6.7,angle:68.2},{x:1127.4,y:81.7,w:17.9,h:6.7,angle:-63.4},{x:700.4,y:87,w:18.4,h:6.7,angle:66},{x:1140.6,y:88.3,w:17.9,h:6.7,angle:-63.4},{x:686.4,y:93.8,w:17.9,h:6.3,angle:63.4},{x:1153.8,y:94.9,w:17.9,h:6.7,angle:-63.4},{x:672.4,y:101.3,w:17.9,h:6.7,angle:63.4},{x:1166.5,y:102,w:18.4,h:6.7,angle:-59},{x:658.9,y:109.1,w:18.1,h:6.7,angle:60.3},{x:1179.2,y:109.3,w:18,h:6.7,angle:-56.3},{x:1191.3,y:117.2,w:18.3,h:6.9,angle:-56.3},{x:645.3,y:117.4,w:18.2,h:6.7,angle:59},{x:1203.5,y:125.3,w:17.8,h:6.8,angle:-53.1},{x:632.3,y:126,w:18,h:6.7,angle:56.3},{x:1215.3,y:133.9,w:18.2,h:6.8,angle:-53.1},{x:619.3,y:135,w:18,h:6.8,angle:55},{x:1226.6,y:142.7,w:18.1,h:6.9,angle:-51.3},{x:606.6,y:144.4,w:18.1,h:7.1,angle:54.5},{x:911,y:148.5,w:17,h:6,angle:-90},{x:923,y:148.5,w:17,h:6,angle:-90},{x:934.6,y:148.5,w:17.4,h:6.5,angle:-85.9},{x:899,y:149,w:18,h:6,angle:-90},{x:887,y:149.5,w:17,h:6,angle:-90},{x:946.4,y:149.5,w:17.6,h:6.7,angle:-84.8},{x:958.2,y:150.4,w:17.6,h:6.6,angle:-83.7},{x:875.2,y:150.9,w:18.2,h:6.8,angle:83.7},{x:969.9,y:151.4,w:17.9,h:6.7,angle:-80.5},{x:1237.9,y:151.9,w:18.2,h:6.8,angle:-48.8},{x:863.3,y:152.5,w:17.8,h:6.6,angle:81.9},{x:981.5,y:153.1,w:18.1,h:6.6,angle:-80.5},{x:594.1,y:154.5,w:18,h:6.7,angle:51.3},{x:851.4,y:154.5,w:17.9,h:6.6,angle:80.5},{x:993,y:155.1,w:18.2,h:6.7,angle:-78.7},{x:839.5,y:156.7,w:18,h:6.7,angle:78.7},{x:1004.4,y:157.5,w:18.2,h:6.8,angle:-76},{x:827.7,y:159.4,w:18.2,h:6.5,angle:76},{x:1015.9,y:160.1,w:18.2,h:6.5,angle:-76},{x:1248.8,y:161.2,w:17.7,h:7.1,angle:-45},{x:816,y:162.4,w:18.2,h:6.5,angle:76},{x:1027,y:163.2,w:18,h:6.8,angle:-72.9},{x:581.8,y:164.7,w:17.9,h:6.6,angle:48.4},{x:804.3,y:165.8,w:17.9,h:6.8,angle:73.3},{x:1038,y:166.5,w:18,h:6.6,angle:-71.6},{x:792.7,y:169.6,w:18,h:6.6,angle:71.6},{x:1048.9,y:170.2,w:18.1,h:6.7,angle:-70},{x:1259.5,y:171,w:17.7,h:6.4,angle:-45},{x:781.2,y:173.6,w:17.8,h:6.6,angle:70},{x:1059.8,y:174.1,w:18.2,h:6.7,angle:-68.2},{x:570,y:175.5,w:17.7,h:6.4,angle:45},{x:769.6,y:178.1,w:18.4,h:6.7,angle:68.2},{x:1070.4,y:178.5,w:18.3,h:6.6,angle:-66.8},{x:1269.8,y:181.2,w:17.7,h:7.1,angle:-45},{x:758.4,y:182.8,w:17.9,h:6.6,angle:66.8},{x:1080.8,y:182.9,w:17.9,h:6.7,angle:-63.4},{x:747.3,y:188.1,w:18.3,h:6.7,angle:63.4},{x:1091.2,y:188.1,w:17.9,h:6.7,angle:-63.4},{x:1279.6,y:191.6,w:18.3,h:6.8,angle:-42},{x:1101.4,y:193.2,w:18.1,h:6.9,angle:-60.9},{x:736.1,y:193.7,w:18.3,h:6.7,angle:63.4},{x:1111.1,y:198.6,w:18,h:6.7,angle:-59},{x:725.2,y:199.4,w:17.9,h:6.3,angle:63.4},{x:1289.1,y:202.2,w:18.2,h:6.6,angle:-39.3},{x:1120.9,y:204.4,w:18,h:6.8,angle:-58},{x:714.6,y:205.8,w:18,h:6.7,angle:59},{x:1130.4,y:210.4,w:18,h:6.7,angle:-56.3},{x:703.8,y:212.3,w:18,h:6.7,angle:56.3},{x:1298.5,y:213.1,w:18,h:6.7,angle:-38.7},{x:1139.7,y:216.7,w:18.2,h:6.8,angle:-53.1},{x:693.5,y:219.2,w:18,h:6.7,angle:56.3},{x:1148.8,y:223.3,w:18,h:6.8,angle:-53.1},{x:1307.3,y:224.3,w:18.2,h:6.8,angle:-36.9},{x:683.2,y:226.4,w:18,h:6.6,angle:54.5},{x:1157.7,y:230.1,w:18.2,h:6.8,angle:-53.1},{x:673.3,y:233.9,w:17.8,h:6.6,angle:53.1},{x:1315.9,y:235.5,w:18,h:6.7,angle:-35.5},{x:1166.4,y:237,w:17.9,h:6.8,angle:-50.2},{x:663.6,y:242,w:18.1,h:6.6,angle:51.3},{x:1174.7,y:244.5,w:18.4,h:6.9,angle:-48.4},{x:1323.9,y:247.2,w:18,h:7.2,angle:-35.5},{x:653.7,y:249.8,w:17.8,h:6.7,angle:50.2},{x:1182.5,y:252,w:17.7,h:6.4,angle:-45},{x:644.4,y:258.5,w:18.4,h:6.5,angle:47.7},{x:1331.8,y:258.9,w:18,h:6.9,angle:-31},{x:909,y:259.5,w:17,h:6,angle:-90},{x:920,y:259.5,w:17,h:6,angle:-90},{x:932,y:259.5,w:17,h:6,angle:-90},{x:1190.8,y:259.7,w:18.4,h:6.4,angle:-45},{x:897.5,y:260.5,w:17.5,h:6.6,angle:84.8},{x:943.1,y:260.5,w:17.6,h:6.5,angle:-84.3},{x:885.9,y:261.5,w:17.5,h:6.7,angle:84.3},{x:954.3,y:261.5,w:17.8,h:6.6,angle:-81.9},{x:965.4,y:263,w:18.2,h:6.7,angle:-80.5},{x:874.3,y:263.1,w:18.1,h:6.5,angle:81.9},{x:976.4,y:265,w:18.2,h:6.7,angle:-77},{x:862.8,y:265.4,w:17.8,h:6.9,angle:81.9},{x:635.3,y:267.2,w:17.7,h:5.7,angle:45},{x:987.4,y:267.5,w:18.2,h:6.8,angle:-76},{x:1198.3,y:267.8,w:17.9,h:6.7,angle:-40.6},{x:851.4,y:268,w:18.2,h:6.5,angle:77.5},{x:998.1,y:270.2,w:18,h:6.6,angle:-71.6},{x:1339,y:271,w:18,h:6.8,angle:-29.1},{x:840.1,y:271.1,w:17.7,h:6.5,angle:76},{x:1008.7,y:273.6,w:17.7,h:6.6,angle:-71.6},{x:828.7,y:274.6,w:18,h:6.6,angle:71.6},{x:626.5,y:276,w:17.7,h:6.4,angle:45},{x:1205.6,y:276,w:17.8,h:6.7,angle:-39.8},{x:1018.8,y:277.4,w:18,h:6.7,angle:-69.4},{x:817.4,y:278.7,w:18,h:6.6,angle:71.6},{x:1028.9,y:281.4,w:18,h:6.6,angle:-66},{x:806.4,y:283.2,w:17.8,h:6.7,angle:70},{x:1346.1,y:283.2,w:17.9,h:6.7,angle:-26.6},{x:1212.7,y:284.3,w:18,h:6.7,angle:-38.7},{x:617.8,y:285.7,w:17.8,h:6.6,angle:42.3},{x:1038.8,y:285.9,w:17.9,h:6.7,angle:-63.4},{x:795.6,y:288.2,w:17.9,h:6.3,angle:63.4},{x:1048.4,y:290.7,w:17.9,h:6.7,angle:-63.4},{x:1219.5,y:292.8,w:17.8,h:6.6,angle:-36.9},{x:784.6,y:293.7,w:17.9,h:6.7,angle:63.4},{x:609.3,y:295.2,w:17.9,h:6.5,angle:41.6},{x:1352.8,y:295.6,w:17.9,h:6.3,angle:-26.6},{x:1057.9,y:295.8,w:18,h:6.5,angle:-59},{x:774.1,y:299.5,w:18,h:6.5,angle:60.9},{x:1226.2,y:301.5,w:18,h:6.7,angle:-33.7},{x:1069.1,y:302.9,w:18,h:6.7,angle:-56.3},{x:601.3,y:305.2,w:18,h:6.6,angle:38.7},{x:763.9,y:306,w:18,h:6.7,angle:59},{x:1359.1,y:308.2,w:17.9,h:6.7,angle:-26.6},{x:1232.4,y:310.4,w:18,h:6.7,angle:-33.7},{x:1080.1,y:310.5,w:17.8,h:6.4,angle:-53.1},{x:753.4,y:312.7,w:17.7,h:6.6,angle:58},{x:593.3,y:315.4,w:17.8,h:6.6,angle:36.9},{x:1090.5,y:318.5,w:17.2,h:6.6,angle:-49.4},{x:1238.3,y:319.4,w:18.2,h:6.9,angle:-31},{x:743.6,y:320,w:18,h:6.6,angle:53.1},{x:1364.8,y:320.9,w:18,h:6.7,angle:-21.8},{x:585.9,y:325.8,w:18,h:6.6,angle:36.9},{x:1100.5,y:327,w:17.7,h:6.4,angle:-45},{x:733.8,y:327.6,w:18,h:6.5,angle:52.1},{x:1243.9,y:328.7,w:18,h:6.8,angle:-29.7},{x:1370.4,y:333.7,w:18.1,h:6.7,angle:-20.6},{x:1110,y:335.5,w:17.7,h:6.4,angle:-45},{x:724.6,y:335.9,w:17.9,h:6.5,angle:49.4},{x:578.6,y:336.6,w:17.8,h:6.6,angle:35},{x:1249.4,y:337.9,w:17.9,h:6.6,angle:-28.3},{x:715.2,y:344.2,w:17.7,h:5.7,angle:45},{x:1118.8,y:345.3,w:17.8,h:6.6,angle:-41.2},{x:1375.4,y:346.5,w:18,h:7,angle:-18.4},{x:571.7,y:347.5,w:18.3,h:6.7,angle:33.7},{x:1254.3,y:347.6,w:17.9,h:6.7,angle:-26.6},{x:706.5,y:353,w:17.7,h:6.4,angle:45},{x:1127.2,y:354.8,w:18.2,h:6.7,angle:-37.9},{x:1259,y:357.1,w:17.9,h:6.7,angle:-24},{x:565.2,y:358.7,w:18.2,h:6.5,angle:31},{x:1380.1,y:359.8,w:18,h:6.9,angle:-16.7},{x:698,y:362.5,w:17.7,h:6.4,angle:45},{x:1135.1,y:364.9,w:18,h:6.9,angle:-35.5},{x:1263.5,y:366.7,w:18.2,h:6.9,angle:-21.8},{x:914.5,y:369.5,w:17,h:5,angle:-90},{x:925,y:369.5,w:17,h:6,angle:-90},{x:558.9,y:370.2,w:17.9,h:6.7,angle:26.6},{x:904,y:370.5,w:17,h:6,angle:-90},{x:937.6,y:370.5,w:17.8,h:6.5,angle:-81.9},{x:892.9,y:372,w:18.1,h:6.6,angle:81.9},{x:949.7,y:372.2,w:17.8,h:6.5,angle:-78.7},{x:690.1,y:372.4,w:17.8,h:6.7,angle:41.2},{x:1384.5,y:372.9,w:18,h:6.9,angle:-15.9},{x:882,y:374.1,w:18.2,h:6.4,angle:79.7},{x:961.4,y:374.6,w:18,h:6.4,angle:-74.7},{x:1142.3,y:375.2,w:18,h:6.5,angle:-32.5},{x:871.1,y:377.1,w:18.2,h:6.5,angle:76},{x:972.8,y:377.7,w:18.1,h:6.6,angle:-70},{x:1269,y:379.9,w:17.8,h:6.6,angle:-20.6},{x:860.4,y:380.7,w:18,h:6.6,angle:71.6},{x:553.1,y:381.8,w:17.9,h:6.7,angle:26.6},{x:983.7,y:381.9,w:17.9,h:6.7,angle:-66.8},{x:682.1,y:382.3,w:18.2,h:6.4,angle:36.9},{x:849.8,y:385,w:18.4,h:6.4,angle:69.4},{x:1148.9,y:385.8,w:17.9,h:6.7,angle:-26.6},{x:1388.3,y:386.2,w:17.9,h:6.8,angle:-14},{x:994.2,y:386.6,w:17.9,h:6.3,angle:-63.4},{x:839.4,y:389.8,w:17.9,h:6.3,angle:63.4},{x:1004.2,y:392,w:18,h:6.6,angle:-57.5},{x:674.9,y:392.8,w:18,h:6.5,angle:35.5},{x:1273.9,y:393.2,w:18,h:6.6,angle:-18.4},{x:547.5,y:393.4,w:18.3,h:6.7,angle:23.2},{x:829,y:395.5,w:18,h:6.6,angle:60.9},{x:1154.9,y:396.8,w:17.9,h:6.7,angle:-26.6},{x:1013.4,y:398.1,w:18,h:6.4,angle:-53.1},{x:1391.6,y:399.6,w:17.9,h:6.8,angle:-12.5},{x:819,y:401.8,w:18,h:6.4,angle:56.3},{x:667.8,y:403.5,w:18,h:6.7,angle:33.7},{x:1022.3,y:404.7,w:17.9,h:6.6,angle:-48.4},{x:542.1,y:405.4,w:18.4,h:6.6,angle:24},{x:1278.4,y:406.5,w:18,h:6.7,angle:-15.9},{x:1160.4,y:407.8,w:18,h:6.7,angle:-21.8},{x:809.4,y:408.9,w:18,h:6.4,angle:53.1},{x:1030.5,y:412,w:17.7,h:6.4,angle:-45},{x:1394.6,y:413.1,w:17.9,h:6.9,angle:-9.5},{x:661.4,y:414.5,w:18,h:6.7,angle:31},{x:800.1,y:416.5,w:17.8,h:6.5,angle:50.7},{x:537.3,y:417.5,w:18,h:6.7,angle:20.6},{x:1165.4,y:419.2,w:17.8,h:6.7,angle:-20.6},{x:1282,y:419.9,w:17.9,h:6.5,angle:-14},{x:1038.9,y:420.4,w:17.9,h:6.5,angle:-40.6},{x:791.3,y:424.8,w:17,h:6.4,angle:45},{x:655,y:425.9,w:18.1,h:6.6,angle:29.1},{x:1397.5,y:426.4,w:17.8,h:6.6,angle:-8.1},{x:1046.3,y:429.8,w:18,h:6.7,angle:-33.7},{x:532.8,y:429.9,w:18.1,h:6.6,angle:20.6},{x:1169.5,y:430.5,w:17.7,h:6.6,angle:-16.7},{x:1285.4,y:433.6,w:17.9,h:6.6,angle:-9.5},{x:782.5,y:434,w:17.7,h:6.4,angle:45},{x:649.4,y:437.7,w:17.4,h:6.3,angle:26.6},{x:1053.1,y:439.3,w:18,h:6.5,angle:-29.1},{x:1399.6,y:440,w:17.7,h:6.8,angle:-7.1},{x:1173.3,y:442.1,w:17.9,h:6.5,angle:-14},{x:528.4,y:442.5,w:18,h:6.6,angle:16.7},{x:774.8,y:443.5,w:17.8,h:6.4,angle:39.8},{x:1288,y:447.2,w:18.2,h:6.6,angle:-8.1},{x:1058.7,y:449.4,w:17.9,h:6.7,angle:-26.6},{x:644.2,y:449.6,w:18,h:6.7,angle:24.4},{x:1401.5,y:453.5,w:17,h:7,angle:0},{x:767.1,y:453.6,w:17.8,h:6.6,angle:37.9},{x:1176.2,y:453.8,w:17.9,h:6.8,angle:-12.5},{x:524.8,y:455.1,w:18,h:6.6,angle:18.4},{x:1063.4,y:459.6,w:18.1,h:6.7,angle:-19.7},{x:1290.4,y:460.7,w:17.4,h:6.4,angle:-6.3},{x:639.3,y:461.8,w:18.2,h:6.5,angle:21.8},{x:760.4,y:464.2,w:18,h:6.4,angle:32},{x:1178.5,y:465.4,w:17.8,h:6.5,angle:-8.1},{x:1402.5,y:467,w:17,h:6,angle:0},{x:521.3,y:467.7,w:17.9,h:6.5,angle:14},{x:1067.2,y:469.9,w:18,h:6.5,angle:-15.9},{x:755.2,y:473.6,w:17.9,h:6.3,angle:26.6},{x:635.1,y:474.4,w:18,h:6.3,angle:18.4},{x:1291.5,y:474.6,w:17.3,h:6.4,angle:-4.4},{x:922.3,y:476.5,w:17.4,h:6.5,angle:-86.2},{x:933.3,y:476.7,w:17.7,h:6.3,angle:-76},{x:1180.5,y:477,w:17.6,h:6.7,angle:-5.7},{x:911.7,y:477.4,w:17.5,h:6.4,angle:84.8},{x:944.2,y:479.6,w:17.9,h:6.3,angle:-63.4},{x:900.7,y:480.2,w:17.7,h:6.5,angle:76},{x:1070,y:480.3,w:17.9,h:6.6,angle:-9.5},{x:518.3,y:480.8,w:17.9,h:6.3,angle:14},{x:1403.5,y:480.8,w:17.4,h:6.8,angle:-4.1},{x:750.2,y:483.1,w:17.4,h:6.3,angle:26.6},{x:954.4,y:484,w:18,h:6.6,angle:-53.1},{x:890.6,y:484.3,w:17.8,h:6.5,angle:68.2},{x:631.3,y:486.8,w:18,h:6.4,angle:16.7},{x:1292.5,y:488,w:17,h:6,angle:0},{x:1181.5,y:489,w:17,h:6,angle:0},{x:880.8,y:490.3,w:18,h:6.5,angle:59},{x:963.1,y:490.6,w:17.9,h:6.4,angle:-39.8},{x:1072,y:492,w:18,h:6,angle:0},{x:745.9,y:493.2,w:17.9,h:6.6,angle:23.2},{x:515.5,y:494,w:17.8,h:6.6,angle:10.3},{x:1404,y:494,w:18,h:6,angle:0},{x:872.3,y:497,w:18,h:6.4,angle:53.1},{x:970.1,y:498.7,w:18.3,h:6.7,angle:-26.6},{x:628,y:499.6,w:18.2,h:6.5,angle:14},{x:1182,y:500.5,w:18,h:5,angle:0},{x:1293,y:502,w:18,h:6,angle:0},{x:742,y:503.5,w:18.1,h:6.6,angle:20.6},{x:1073,y:504,w:18,h:6,angle:0},{x:864.5,y:505,w:17.7,h:6.4,angle:45},{x:513.3,y:507.1,w:17.8,h:6.6,angle:9.5},{x:1404.5,y:508,w:17,h:6,angle:0},{x:974.5,y:508.5,w:17.7,h:6.6,angle:-6.3},{x:1182,y:512,w:18,h:6,angle:0},{x:625.3,y:512.7,w:17.7,h:6.7,angle:11.3},{x:738.7,y:513.9,w:17.7,h:6.5,angle:17.1},{x:857.2,y:514.4,w:18,h:6.4,angle:36.9},{x:1072.6,y:515,w:17.7,h:6.5,angle:6.3},{x:1292.5,y:515.6,w:17.4,h:6.4,angle:4.4},{x:975.5,y:519,w:17.9,h:6.5,angle:0},{x:511.5,y:520.2,w:17.8,h:6.6,angle:9.5},{x:1404,y:521,w:18,h:6,angle:0},{x:1181.5,y:523.5,w:17,h:7,angle:0},{x:851.4,y:523.8,w:17.7,h:6.7,angle:31},{x:735.8,y:524.8,w:17.9,h:6.5,angle:14},{x:622.7,y:525.9,w:17.8,h:6.4,angle:9.5},{x:1071.3,y:526.1,w:17.8,h:6.7,angle:11.3},{x:1292.5,y:529,w:17,h:6,angle:0},{x:973,y:529.5,w:17.9,h:6.5,angle:45},{x:509.5,y:533.6,w:17.6,h:6.5,angle:6.3},{x:846.9,y:534.1,w:17.8,h:6.6,angle:24},{x:1403.5,y:534.7,w:17.5,h:6.7,angle:4.8},{x:1180.4,y:534.9,w:17.9,h:6.6,angle:9.5},{x:733.4,y:535.8,w:18,h:6.5,angle:11.3},{x:965,y:536.5,w:18,h:6.6,angle:53.1},{x:1069,y:536.5,w:18,h:6.6,angle:18.4},{x:621.4,y:539.3,w:17.4,h:6.5,angle:6.3},{x:955.8,y:541.1,w:17.9,h:6.6,angle:66.8},{x:1290.9,y:542.5,w:18.1,h:6.4,angle:7.1},{x:843.1,y:545.3,w:18,h:6.3,angle:18.4},{x:947.3,y:545.6,w:17.4,h:6.3,angle:63.4},{x:1178.5,y:545.9,w:18.2,h:6.7,angle:11.3},{x:731.6,y:546.9,w:17.9,h:6.6,angle:9.5},{x:508.5,y:547,w:17,h:6,angle:0},{x:1065.2,y:547.6,w:17.9,h:6.3,angle:26.6},{x:1402.1,y:548.2,w:18.2,h:6.7,angle:5.7},{x:938.7,y:552,w:17.9,h:6.5,angle:38.7},{x:619.5,y:552.7,w:17.5,h:6.5,angle:5.2},{x:840.8,y:555.8,w:17.9,h:6.6,angle:12.5},{x:1289.4,y:555.9,w:17.8,h:6.6,angle:9.5},{x:1176.3,y:556.9,w:17.9,h:6.5,angle:14},{x:1060.5,y:557.9,w:18,h:6.5,angle:31},{x:730.5,y:558.3,w:17.7,h:6.6,angle:7.1},{x:508.1,y:560.5,w:18.2,h:6.5,angle:5.2},{x:1400.6,y:561.4,w:17.7,h:6.6,angle:8.1},{x:936,y:562.5,w:17.9,h:6.5,angle:0},{x:619.5,y:566,w:17,h:6,angle:0},{x:839.5,y:566.8,w:17.7,h:6.4,angle:7.1},{x:1054.9,y:567.5,w:18,h:6.7,angle:38.7},{x:1173.3,y:567.6,w:18,h:6.6,angle:18.4},{x:1286.9,y:569.1,w:18.2,h:6.5,angle:14},{x:730,y:570,w:18,h:6,angle:0},{x:937.5,y:573.4,w:17.6,h:6.4,angle:-6.3},{x:507.5,y:574,w:17,h:6,angle:0},{x:1398.6,y:574.7,w:17.9,h:6.7,angle:9.5},{x:1047.8,y:576.8,w:17.7,h:5.7,angle:45},{x:839.5,y:578,w:17,h:6,angle:0},{x:1170.1,y:578.3,w:18.1,h:6.6,angle:20.6},{x:619,y:580,w:18,h:6,angle:0},{x:730,y:581,w:18,h:6,angle:0},{x:1284.1,y:582,w:18.2,h:6.7,angle:15.3},{x:942,y:583.1,w:17.9,h:6.5,angle:-24},{x:1039.8,y:584.7,w:18,h:6.6,angle:52.1},{x:508,y:587.5,w:18,h:5,angle:0},{x:1396.5,y:587.9,w:18.2,h:6.7,angle:11.3},{x:1166.3,y:588.5,w:18,h:6.7,angle:21.8},{x:840,y:589.6,w:18.1,h:6.5,angle:-4.4},{x:948.8,y:591.4,w:17.9,h:6.5,angle:-39.8},{x:1031.2,y:591.4,w:18,h:6.5,angle:59},{x:730.5,y:593,w:17,h:6,angle:0},{x:619.5,y:593.5,w:17,h:5,angle:0},{x:1280.8,y:594.9,w:18,h:6.8,angle:16.7},{x:1021.4,y:597.3,w:18,h:6.5,angle:68.2},{x:957.6,y:597.8,w:17.8,h:6.4,angle:-53.1},{x:1161.8,y:598.4,w:17.9,h:6.3,angle:26.6},{x:508.5,y:601,w:17,h:6,angle:0},{x:1393.9,y:601,w:18.2,h:6.8,angle:14},{x:842.1,y:601.4,w:18.1,h:6.4,angle:-9.5},{x:1011.3,y:601.6,w:18.2,h:6.5,angle:76},{x:967.8,y:602.4,w:17.9,h:6.3,angle:-63.4},{x:1000.4,y:604.5,w:17.6,h:6.6,angle:83.7},{x:731.6,y:604.7,w:17.5,h:6.5,angle:-5.7},{x:978.6,y:604.7,w:17.7,h:6.5,angle:-77.5},{x:990,y:605.5,w:17,h:6,angle:-90},{x:620.5,y:607,w:17,h:6,angle:0},{x:1277,y:607.5,w:18,h:6.6,angle:18.4},{x:1157,y:608.1,w:18.1,h:6.6,angle:29.1},{x:844.9,y:611.9,w:17.7,h:6.5,angle:-15.3},{x:1390.8,y:613.7,w:17.9,h:6.8,angle:14},{x:509.5,y:614.7,w:17.4,h:6.6,angle:-4.8},{x:733.5,y:616.4,w:17.8,h:6.5,angle:-8.1},{x:1151.8,y:617.5,w:18,h:6.6,angle:32},{x:1272.6,y:620,w:17.8,h:6.7,angle:21.8},{x:622,y:620.9,w:18.2,h:6.5,angle:-6.3},{x:848.7,y:622.1,w:17.7,h:6.3,angle:-18.4},{x:1387.5,y:626.7,w:18.3,h:6.6,angle:18.4},{x:735.7,y:628.1,w:17.8,h:6.5,angle:-10.3},{x:510.9,y:628.2,w:18.2,h:6.5,angle:-5.2},{x:1145,y:628.2,w:17.8,h:6.4,angle:36.9},{x:1267.9,y:632.2,w:17.9,h:6.7,angle:23.2},{x:853.2,y:632.4,w:17.9,h:6.3,angle:-26.6},{x:624.1,y:634.6,w:18.1,h:6.5,angle:-8.1},{x:1137.3,y:638.2,w:17.9,h:6.4,angle:39.8},{x:1383.6,y:639.4,w:17.7,h:6.6,angle:18.4},{x:738.9,y:639.6,w:17.9,h:6.5,angle:-14},{x:512.5,y:641.7,w:17.7,h:6.5,angle:-6.3},{x:859,y:642.4,w:17.7,h:6.5,angle:-31},{x:1262.5,y:644.1,w:17.9,h:6.6,angle:23.2},{x:1129.5,y:648,w:17.7,h:6.4,angle:45},{x:626.6,y:648.2,w:17.9,h:6.6,angle:-9.5},{x:742.5,y:651.4,w:18.3,h:6.3,angle:-16.7},{x:1379.5,y:651.9,w:18,h:6.7,angle:20.6},{x:865.7,y:652,w:17.8,h:6.4,angle:-33.7},{x:514.6,y:655.3,w:17.9,h:6.5,angle:-8.7},{x:1257.1,y:655.8,w:17.9,h:6.7,angle:26.6},{x:1121,y:657,w:17,h:5.7,angle:45},{x:873.2,y:661.2,w:18.2,h:6.4,angle:-39.3},{x:630,y:661.9,w:17.9,h:6.5,angle:-14},{x:746.7,y:662.7,w:18,h:6.6,angle:-20},{x:1374.8,y:664.1,w:18,h:6.7,angle:21.8},{x:1112.1,y:665.3,w:17.8,h:6.4,angle:50.2},{x:1250.9,y:667.2,w:18.2,h:6.7,angle:31},{x:517.5,y:668.8,w:17.8,h:6.6,angle:-10.3},{x:881.5,y:670,w:17.7,h:6.4,angle:-45},{x:1102.7,y:672.9,w:18.3,h:6.6,angle:54.5},{x:751.5,y:673.9,w:17.9,h:6.5,angle:-24},{x:633.9,y:675.3,w:18,h:6.5,angle:-15.9},{x:1369.9,y:676.3,w:17.9,h:6.6,angle:24},{x:889.8,y:677.3,w:17.9,h:6.6,angle:-48.8},{x:1244.3,y:678.2,w:18,h:6.7,angle:33.7},{x:1093,y:679.9,w:18,h:6.5,angle:59},{x:520.4,y:682.1,w:18,h:6.7,angle:-11.3},{x:898.6,y:683.6,w:18.2,h:6.4,angle:-53.1},{x:757,y:685,w:17.9,h:6.3,angle:-26.6},{x:1083.1,y:686.2,w:17.6,h:6.6,angle:61.4},{x:1364.8,y:688.3,w:17.9,h:6.9,angle:24.4},{x:638.1,y:688.7,w:18,h:6.3,angle:-18.4},{x:1237.1,y:689.1,w:18,h:6.7,angle:33.7},{x:908,y:689.7,w:17.7,h:6.6,angle:-58},{x:1072.8,y:691.9,w:17.5,h:6.5,angle:65.6},{x:918,y:695,w:17.9,h:6.3,angle:-63.4},{x:524,y:695.4,w:18.2,h:6.5,angle:-14},{x:763,y:696,w:18.1,h:6.4,angle:-30.3},{x:1062.2,y:696.8,w:18,h:6.5,angle:68.2},{x:1230,y:699.5,w:18.2,h:6.7,angle:37.9},{x:928.4,y:699.8,w:17.9,h:6.5,angle:-66},{x:1359.2,y:700.1,w:18.3,h:6.3,angle:26.6},{x:1051.6,y:701.2,w:17.7,h:6.6,angle:71.6},{x:642.9,y:702.1,w:18,h:6.7,angle:-20},{x:939.4,y:703.8,w:17.8,h:6.5,angle:-68.2},{x:1040.8,y:704.8,w:17.9,h:6.5,angle:76},{x:769.8,y:706.5,w:18,h:6.7,angle:-33.7},{x:950.7,y:707.1,w:18,h:6.6,angle:-74.1},{x:1030,y:707.4,w:18,h:6.5,angle:78.7},{x:527.8,y:708.9,w:18,h:6.7,angle:-16.7},{x:1222.1,y:709.5,w:17.9,h:6.5,angle:39.8},{x:962.4,y:709.6,w:17.8,h:6.5,angle:-78.7},{x:1019.1,y:709.6,w:17.7,h:6.4,angle:82.9},{x:974.4,y:711.3,w:17.5,h:6.5,angle:-81.9},{x:997.5,y:711.5,w:17,h:5,angle:-90},{x:1008,y:711.5,w:17,h:6,angle:-90},{x:1353.3,y:711.9,w:18.3,h:6.7,angle:26.6},{x:987,y:712,w:18,h:6,angle:-90},{x:648.5,y:715.1,w:18,h:6.5,angle:-21.8},{x:777,y:717,w:17.7,h:6.4,angle:-35.5},{x:1214,y:719.5,w:17.7,h:6.4,angle:45},{x:531.9,y:722,w:18,h:6.3,angle:-18.4},{x:1346.9,y:723.1,w:18.1,h:6.6,angle:30.3},{x:652.8,y:724.6,w:17.9,h:6.7,angle:-24},{x:784.9,y:726.9,w:18,h:6.6,angle:-36.9},{x:1206,y:728.5,w:17.7,h:6.4,angle:45},{x:657.7,y:734.4,w:17.9,h:6.7,angle:-26.6},{x:1340.3,y:734.4,w:18,h:6.7,angle:32},{x:536.5,y:735.1,w:18,h:6.3,angle:-18.4},{x:793.1,y:736.6,w:17.9,h:6.5,angle:-40.6},{x:1197,y:737.5,w:17.7,h:6.4,angle:45},{x:662.9,y:743.8,w:17.9,h:6.7,angle:-26.6},{x:1333.3,y:745.2,w:18,h:6.7,angle:33.7},{x:1187.5,y:745.9,w:17.9,h:6.6,angle:49.4},{x:802.5,y:746,w:17.7,h:6.4,angle:-45},{x:541.6,y:748.1,w:17.8,h:6.5,angle:-21.8},{x:668.1,y:753.2,w:17.9,h:6.7,angle:-26.6},{x:1178.3,y:754.1,w:18.1,h:6.6,angle:51.3},{x:811.5,y:755,w:17.7,h:6.4,angle:-45},{x:1326.2,y:755.9,w:18.1,h:6.7,angle:35},{x:547,y:760.9,w:17.9,h:6.7,angle:-23.2},{x:1168.5,y:761.9,w:18,h:6.6,angle:53.1},{x:673.6,y:762.2,w:18,h:6.5,angle:-31},{x:821.6,y:763.3,w:17.8,h:6.5,angle:-49.4},{x:1318.8,y:766.5,w:17.8,h:6.9,angle:37.9},{x:1158.7,y:769,w:18,h:6.7,angle:56.3},{x:679.7,y:771.3,w:18,h:6.4,angle:-33.7},{x:831.8,y:771.4,w:18,h:6.6,angle:-53.1},{x:552.8,y:773.6,w:17.9,h:6.6,angle:-24.4},{x:1148.4,y:775.9,w:18,h:6.7,angle:59},{x:1310.9,y:776.6,w:17.9,h:6.7,angle:40.6},{x:842.9,y:778.9,w:18.3,h:6.4,angle:-56.3},{x:686,y:780.2,w:18,h:6.6,angle:-35.5},{x:1137.9,y:782.1,w:18,h:6.6,angle:60.9},{x:854.1,y:786,w:18,h:6.6,angle:-58},{x:559.1,y:786.2,w:17.9,h:6.7,angle:-26.6},{x:1302.9,y:786.5,w:17.9,h:6.8,angle:41.2},{x:1127.4,y:788.3,w:17.9,h:6.7,angle:63.4},{x:692.4,y:788.9,w:18,h:6.6,angle:-37.9},{x:863.8,y:790.9,w:17.9,h:6.7,angle:-63.4},{x:1116.7,y:793.6,w:18,h:6.6,angle:66},{x:873.3,y:795.9,w:17.4,h:6.7,angle:-63.4},{x:1294.5,y:796,w:17.7,h:6.4,angle:45},{x:699.4,y:797.4,w:18.3,h:6.7,angle:-38.7},{x:1105.6,y:798.6,w:18.2,h:6.7,angle:68.2},{x:565.9,y:798.8,w:17.9,h:6.7,angle:-26.6},{x:883.1,y:800.3,w:17.5,h:6.4,angle:-66},{x:1094.5,y:803,w:18,h:6.6,angle:71.6},{x:893.2,y:804.4,w:18.1,h:6.6,angle:-67.4},{x:1285.8,y:805.3,w:18.4,h:6.4,angle:45},{x:706.4,y:805.8,w:17.9,h:6.5,angle:-40.6},{x:1083.2,y:807.1,w:18,h:6.6,angle:71.6},{x:903.6,y:808.2,w:17.7,h:6.3,angle:-71.6},{x:1072.1,y:810.7,w:17.9,h:6.5,angle:76},{x:572.9,y:810.8,w:17.9,h:6.7,angle:-26.6},{x:914,y:811.4,w:17.7,h:6.6,angle:-71.6},{x:1060.7,y:813.8,w:17.9,h:6.6,angle:77.5},{x:713.5,y:814,w:17.7,h:6.4,angle:-45},{x:924.8,y:814.2,w:18,h:6.5,angle:-74.7},{x:1277,y:814.5,w:17.7,h:6.4,angle:45},{x:1049.1,y:816.5,w:17.8,h:6.7,angle:78.7},{x:935.4,y:816.7,w:17.7,h:6.5,angle:-76},{x:946.5,y:818.5,w:17,h:7,angle:-90},{x:1037.7,y:818.5,w:17.9,h:6.6,angle:80.5},{x:957.7,y:820.4,w:17.8,h:6.6,angle:-81.9},{x:1026,y:820.5,w:17,h:6,angle:-90},{x:969,y:821.5,w:17,h:6,angle:-90},{x:1014.7,y:821.5,w:17.5,h:6.6,angle:85.6},{x:721.5,y:822,w:17.7,h:6.4,angle:-45},{x:980,y:822.5,w:17,h:6,angle:-90},{x:992,y:822.5,w:17,h:6,angle:-90},{x:1003,y:822.5,w:17,h:6,angle:-90},{x:580.4,y:822.8,w:18,h:6.5,angle:-31},{x:1267.5,y:823,w:17.7,h:6.4,angle:45},{x:729.2,y:829.8,w:17.7,h:5.7,angle:-45},{x:1258.4,y:832,w:17.9,h:6.7,angle:49.4},{x:588.2,y:834.5,w:18,h:6.7,angle:-33.7},{x:737.5,y:837,w:17.7,h:6.4,angle:-45},{x:1248.6,y:839.9,w:18.1,h:6.7,angle:51.3},{x:745.8,y:844.3,w:17.9,h:6.6,angle:-48.4},{x:596.3,y:846.2,w:18,h:6.7,angle:-33.7},{x:1238.9,y:847.8,w:18,h:6.8,angle:53.1},{x:754.3,y:851.7,w:17.9,h:6.5,angle:-50.2},{x:1228.8,y:855.5,w:17.8,h:6.6,angle:54.5},{x:604.8,y:857.5,w:17.8,h:6.6,angle:-36.9},{x:763.2,y:858.5,w:17.8,h:6.6,angle:-53.1},{x:1218.7,y:862.5,w:18.3,h:6.7,angle:56.3},{x:772.3,y:865,w:18,h:6.4,angle:-53.1},{x:613.6,y:868.7,w:18.3,h:6.6,angle:-38.7},{x:1208.1,y:869.5,w:18,h:6.9,angle:59},{x:781.7,y:871.2,w:18.3,h:6.4,angle:-56.3},{x:1197.6,y:876.2,w:18.1,h:6.7,angle:60.9},{x:791.2,y:877.3,w:18,h:6.7,angle:-56.3},{x:623,y:879.6,w:17.9,h:6.5,angle:-39.8},{x:1186.8,y:882.1,w:17.9,h:6.7,angle:63.4},{x:800.9,y:883,w:18,h:6.7,angle:-59},{x:1175.8,y:888.1,w:17.9,h:6.7,angle:63.4},{x:810.8,y:888.6,w:17.6,h:6.6,angle:-60.9},{x:632.5,y:890,w:17.7,h:6.4,angle:-45},{x:1164.8,y:893.6,w:18,h:6.6,angle:65.6},{x:820.9,y:893.7,w:18.3,h:6.7,angle:-63.4},{x:831.2,y:898.6,w:17.9,h:6.6,angle:-65.2},{x:1153.6,y:898.7,w:17.9,h:6.7,angle:63.4},{x:642.2,y:900.3,w:18.4,h:6.4,angle:-45},{x:841.7,y:903.4,w:18,h:6.6,angle:-66.8},{x:1142.2,y:903.6,w:17.8,h:6.7,angle:70},{x:1342.1,y:906.4,w:17.9,h:6.8,angle:48.8},{x:852.3,y:907.6,w:18,h:6.7,angle:-68.2},{x:1130.9,y:908,w:18.3,h:6.6,angle:69.4},{x:653,y:910.5,w:17.7,h:6.4,angle:-45},{x:863.2,y:911.6,w:18,h:6.7,angle:-70},{x:1119.5,y:912.4,w:18,h:6.3,angle:71.6},{x:874.1,y:915.2,w:18,h:6.6,angle:-71.6},{x:1107.8,y:915.8,w:18,h:6.6,angle:74.1},{x:1330.1,y:917,w:18.3,h:7,angle:51.3},{x:885.1,y:918.4,w:18.3,h:6.7,angle:-72.9},{x:1096.1,y:919.2,w:18,h:6.7,angle:74.7},{x:663,y:920.5,w:17.7,h:6.4,angle:-45},{x:896.3,y:921.6,w:18,h:6.5,angle:-74.7},{x:1084.4,y:922.4,w:17.9,h:6.6,angle:77.5},{x:907.6,y:924.4,w:17.9,h:6.7,angle:-77.5},{x:1072.5,y:925,w:18.2,h:6.5,angle:78.7},{x:919.1,y:926.6,w:18,h:6.7,angle:-78.7},{x:1318.1,y:927.4,w:17.9,h:6.8,angle:50.2},{x:1060.7,y:927.5,w:17.8,h:6.6,angle:81.9},{x:930.6,y:928.5,w:17.9,h:6.6,angle:-80.5},{x:1048.8,y:929.4,w:17.6,h:6.7,angle:82.9},{x:674.3,y:929.8,w:17.9,h:6.6,angle:-48.4},{x:942.1,y:930.4,w:17.8,h:6.6,angle:-81.9},{x:1036.9,y:930.5,w:17.5,h:6.7,angle:84.8},{x:953.9,y:931.6,w:17.7,h:6.7,angle:-82.9},{x:1025,y:932,w:18,h:6,angle:-90},{x:965.6,y:932.5,w:17.5,h:6.6,angle:-84.8},{x:1013,y:932.5,w:17,h:6,angle:-90},{x:977.4,y:933.1,w:18.2,h:6.6,angle:-85.2},{x:989,y:933.5,w:17,h:6,angle:-90},{x:1001,y:933.5,w:17,h:6,angle:-90},{x:1305.5,y:937,w:18.2,h:6.8,angle:53.1},{x:685.3,y:939,w:17.9,h:6.5,angle:-50.7},{x:1292.9,y:946.6,w:18,h:6.7,angle:54.5},{x:696.9,y:948,w:17.8,h:6.6,angle:-53.1},{x:1279.8,y:955.8,w:18.3,h:6.7,angle:56.3},{x:708.7,y:956.3,w:18,h:6.6,angle:-53.1},{x:1266.6,y:964.3,w:18,h:6.9,angle:59},{x:720.6,y:964.6,w:18,h:6.7,angle:-56.3},{x:733,y:972.5,w:18,h:6.7,angle:-56.3},{x:1253,y:972.5,w:17.9,h:6.7,angle:63.4},{x:745.6,y:979.8,w:18.1,h:6.8,angle:-60.9},{x:1239.5,y:980.5,w:18.3,h:6.7,angle:63.4},{x:758.3,y:986.9,w:17.4,h:6.7,angle:-63.4},{x:1225.6,y:987.7,w:17.9,h:6.7,angle:63.4},{x:771.4,y:993.7,w:18,h:6.5,angle:-60.9},{x:1211.6,y:994.7,w:17.9,h:6.7,angle:63.4},{x:784.7,y:999.9,w:17.9,h:6.5,angle:-65.6},{x:1197.4,y:1001.3,w:18,h:6.7,angle:67.4},{x:798.3,y:1005.7,w:17.8,h:6.5,angle:-67.4},{x:1183.1,y:1007.5,w:18,h:6.7,angle:69.4},{x:811.9,y:1011.5,w:18,h:6.5,angle:-68.2},{x:1168.5,y:1013,w:18,h:6.6,angle:71.6},{x:825.9,y:1016.5,w:18,h:6.6,angle:-70},{x:1153.9,y:1018.2,w:18,h:6.6,angle:71.6},{x:840.1,y:1021.2,w:18,h:6.6,angle:-71.6},{x:1139,y:1022.8,w:18,h:6.7,angle:74.1},{x:854.3,y:1025.6,w:18,h:6.6,angle:-71.6},{x:1124.2,y:1027.2,w:17.9,h:6.5,angle:76},{x:868.6,y:1029.5,w:18.3,h:6.6,angle:-74.1},{x:1109.1,y:1031,w:18,h:6.5,angle:78.7},{x:883.1,y:1033,w:17.9,h:6.5,angle:-76},{x:1094.1,y:1034.4,w:18,h:6.7,angle:78.7},{x:897.8,y:1036,w:18,h:6.7,angle:-78.7},{x:1079,y:1037.4,w:17.9,h:6.7,angle:80.5},{x:912.6,y:1038.5,w:17.9,h:6.6,angle:-80.5},{x:1063.7,y:1039.5,w:17.7,h:6.6,angle:82.9},{x:927.5,y:1040.6,w:17.7,h:6.5,angle:-81.9},{x:1048.6,y:1041.5,w:17.7,h:6.6,angle:83.7},{x:942.4,y:1042.5,w:17.7,h:6.6,angle:-82.9},{x:1033.4,y:1043,w:18.4,h:6.7,angle:84.8},{x:957.5,y:1043.5,w:17.6,h:6.6,angle:-84.3},{x:1018,y:1044,w:18,h:6,angle:-90},{x:972.6,y:1044.5,w:17.3,h:6.5,angle:-85.9},{x:988,y:1044.5,w:17,h:6,angle:-90},{x:1003,y:1044.5,w:17,h:6,angle:-90}]},connection_blocks:[75,563]},{slug:`elegant-splitting`,top_extract:{blocks:[{x:1024,y:4.5,w:52,h:9,angle:0},{x:1024,y:32.5,w:52,h:17,angle:0},{x:1024,y:64.5,w:52,h:17,angle:0},{x:1024,y:96.5,w:52,h:17,angle:0},{x:1024,y:128.5,w:52,h:17,angle:0},{x:1024,y:160.5,w:52,h:17,angle:0},{x:1024,y:192.5,w:52,h:17,angle:0},{x:1024,y:224.5,w:52,h:17,angle:0},{x:1024,y:256.5,w:52,h:17,angle:0},{x:1024,y:288.5,w:52,h:17,angle:0},{x:1024,y:320.5,w:52,h:17,angle:0},{x:1024,y:352.5,w:52,h:17,angle:0},{x:1024,y:384.5,w:52,h:17,angle:0},{x:1024,y:416.5,w:52,h:17,angle:0},{x:11.5,y:510.5,w:53,h:17,angle:-90},{x:43,y:510.5,w:53,h:18,angle:-90},{x:75,y:510.5,w:53,h:18,angle:-90},{x:107,y:510.5,w:53,h:18,angle:-90},{x:139,y:510.5,w:53,h:18,angle:-90},{x:171,y:510.5,w:53,h:18,angle:-90},{x:203,y:510.5,w:53,h:18,angle:-90},{x:235,y:510.5,w:53,h:18,angle:-90},{x:267,y:510.5,w:53,h:18,angle:-90},{x:299,y:510.5,w:53,h:18,angle:-90},{x:331,y:510.5,w:53,h:18,angle:-90},{x:363,y:510.5,w:53,h:18,angle:-90},{x:395,y:510.5,w:53,h:18,angle:-90},{x:427,y:510.5,w:53,h:18,angle:-90},{x:459,y:510.5,w:53,h:18,angle:-90},{x:492.5,y:510.5,w:53,h:17,angle:-90},{x:524.5,y:510.5,w:53,h:17,angle:-90},{x:556.5,y:510.5,w:53,h:17,angle:-90},{x:588.5,y:510.5,w:53,h:17,angle:-90},{x:620.5,y:510.5,w:53,h:17,angle:-90},{x:652.5,y:510.5,w:53,h:17,angle:-90},{x:684.5,y:510.5,w:53,h:17,angle:-90},{x:716.5,y:510.5,w:53,h:17,angle:-90},{x:748.5,y:510.5,w:53,h:17,angle:-90},{x:780.5,y:510.5,w:53,h:17,angle:-90},{x:812.5,y:510.5,w:53,h:17,angle:-90},{x:844.5,y:510.5,w:53,h:17,angle:-90},{x:876.5,y:510.5,w:53,h:17,angle:-90},{x:908.5,y:510.5,w:53,h:17,angle:-90},{x:990,y:511,w:142,h:120,angle:-90},{x:1024,y:605.5,w:52,h:17,angle:0},{x:1024,y:637.5,w:52,h:17,angle:0},{x:1024,y:669.5,w:52,h:17,angle:0},{x:1024,y:701.5,w:52,h:17,angle:0},{x:1024,y:733.5,w:52,h:17,angle:0},{x:1024,y:765.5,w:52,h:17,angle:0},{x:1024,y:797.5,w:52,h:17,angle:0},{x:1024,y:829.5,w:52,h:17,angle:0},{x:1024,y:861.5,w:52,h:17,angle:0},{x:1024,y:893.5,w:52,h:17,angle:0},{x:1024,y:925.5,w:52,h:17,angle:0},{x:1024,y:957.5,w:52,h:17,angle:0},{x:1024,y:989.5,w:52,h:17,angle:0},{x:1024,y:1021.5,w:52,h:17,angle:0},{x:1024,y:1053.5,w:52,h:17,angle:0}]}},{slug:`split-ends`,top_extract:{blocks:[{x:1118.5,y:59.5,w:21,h:13,angle:-90},{x:1407.5,y:86.5,w:91,h:27,angle:-90},{x:547,y:107,w:34,h:18,angle:-90},{x:837,y:107,w:34,h:18,angle:-90},{x:1121,y:107,w:34,h:18,angle:-90},{x:1144.5,y:107,w:21,h:14,angle:0},{x:1177.5,y:107,w:21,h:14,angle:0},{x:1218.5,y:107,w:21,h:14,angle:0},{x:1301.5,y:107,w:29,h:14,angle:0},{x:1342.5,y:107,w:29,h:14,angle:0},{x:1375.5,y:107,w:29,h:14,angle:0},{x:1250.5,y:108.5,w:21,h:13,angle:0},{x:692,y:109,w:34,h:18,angle:0},{x:1271.5,y:109,w:21,h:13,angle:0},{x:1266.5,y:140.5,w:21,h:13,angle:-90},{x:1414,y:150.5,w:29,h:14,angle:-90},{x:1266.5,y:173.5,w:21,h:13,angle:-90},{x:1266.5,y:206.5,w:21,h:13,angle:-90},{x:1262.5,y:249.2,w:21,h:13,angle:-72.6},{x:694.8,y:253.4,w:33.4,h:18.7,angle:88},{x:1158.5,y:253.5,w:21,h:13,angle:0},{x:1232.5,y:253.5,w:21,h:13,angle:0},{x:958,y:254.5,w:21,h:13,angle:0},{x:983.9,y:257.5,w:21,h:13,angle:-16.4},{x:1265,y:275,w:21,h:13,angle:-90},{x:1266.5,y:317.5,w:21,h:13,angle:-90},{x:1414,y:336.5,w:21,h:14,angle:-90},{x:1266.5,y:350.5,w:21,h:13,angle:-90},{x:1414,y:378,w:21,h:13,angle:-90},{x:1267,y:391.5,w:21,h:13,angle:0},{x:1125.5,y:392,w:21,h:13,angle:0},{x:696.5,y:394,w:21,h:13,angle:-90},{x:1403.6,y:398.4,w:21,h:13,angle:-24.8},{x:676.5,y:399.5,w:21,h:13,angle:0},{x:547,y:400.5,w:33,h:18,angle:-90},{x:837.5,y:400.5,w:33,h:19,angle:-90},{x:1169.5,y:400.5,w:21,h:13,angle:0},{x:1244,y:400.5,w:21,h:13,angle:0},{x:1289,y:400.5,w:21,h:13,angle:0},{x:1363.5,y:400.5,w:21,h:13,angle:0},{x:1125.6,y:408.2,w:21,h:13,angle:-6.3},{x:1412.3,y:410.2,w:21,h:13,angle:70.3},{x:1414,y:431.5,w:21,h:14,angle:-90},{x:1414,y:464.5,w:21,h:14,angle:-90},{x:977,y:540.5,w:33,h:18,angle:-90},{x:1414,y:616.5,w:21,h:14,angle:-90},{x:1414,y:649.5,w:21,h:14,angle:-90},{x:545.5,y:664.5,w:21,h:13,angle:-90},{x:838,y:664.5,w:21,h:13,angle:-90},{x:1407.5,y:672,w:21,h:13,angle:0},{x:1121,y:680.5,w:33,h:18,angle:-90},{x:1177.5,y:680.5,w:21,h:13,angle:0},{x:1297.5,y:680.5,w:21,h:13,angle:0},{x:1338.5,y:680.5,w:21,h:13,angle:0},{x:1371.5,y:680.5,w:21,h:13,angle:0},{x:1250.4,y:680.9,w:21,h:13,angle:7.6},{x:692,y:683,w:34,h:18,angle:0},{x:547,y:685.5,w:21,h:13,angle:-90},{x:837,y:685.5,w:21,h:13,angle:-90},{x:1271,y:687,w:21,h:13,angle:-90},{x:1407.5,y:688,w:21,h:13,angle:0},{x:1414,y:711.5,w:21,h:14,angle:-90},{x:1414,y:744.5,w:21,h:14,angle:-90},{x:1266.5,y:759.5,w:29,h:13,angle:-90},{x:1266.5,y:796.5,w:21,h:13,angle:-90},{x:693.9,y:816.8,w:21,h:13,angle:63.4},{x:984.5,y:825,w:21,h:13,angle:0},{x:963.5,y:825.5,w:21,h:13,angle:0},{x:1051.5,y:827.5,w:21,h:13,angle:0},{x:1125.5,y:827.5,w:21,h:13,angle:0},{x:1158.5,y:827.5,w:21,h:13,angle:0},{x:1199.5,y:827.5,w:21,h:13,angle:0},{x:1232.5,y:827.5,w:21,h:13,angle:0},{x:1264,y:827.5,w:33,h:18,angle:-90},{x:699.6,y:834.1,w:21,h:13,angle:-21.8},{x:1266.5,y:866.5,w:21,h:13,angle:-90},{x:1266.5,y:903.5,w:29,h:13,angle:-90},{x:1414,y:909.2,w:18.5,h:14,angle:-90},{x:1119,y:918.5,w:21,h:14,angle:-90},{x:1414,y:927.8,w:18.5,h:14,angle:-90},{x:1266.5,y:940.5,w:21,h:13,angle:-90},{x:838.9,y:958.1,w:21,h:13,angle:-81.9},{x:546,y:958.5,w:21,h:13,angle:-90},{x:1129.5,y:970,w:42,h:35,angle:-90},{x:1262.3,y:970.5,w:21,h:13,angle:-16.4},{x:697.5,y:972,w:21,h:13,angle:0},{x:676.5,y:973,w:21,h:13,angle:0},{x:1288,y:973,w:21,h:13,angle:0},{x:570.5,y:974.5,w:21,h:13,angle:0},{x:797.5,y:974.5,w:21,h:13,angle:0},{x:1169.5,y:974.5,w:21,h:13,angle:0},{x:1202.5,y:974.5,w:21,h:13,angle:0},{x:1235.5,y:974.5,w:21,h:13,angle:0},{x:1326.5,y:974.5,w:29,h:13,angle:0},{x:1359.5,y:974.5,w:29,h:13,angle:0},{x:837,y:979.5,w:21,h:13,angle:-90},{x:548.3,y:979.7,w:21,h:13,angle:-73.6},{x:1399.5,y:986.5,w:91,h:43,angle:-90},{x:840,y:1013.5,w:21,h:14,angle:-90},{x:1119,y:1013.5,w:21,h:14,angle:-90}]}},{slug:`small-triangles`,top_extract:{blocks:[{x:728.5,y:489.5,w:79,h:69,angle:-90},{x:1054,y:489.5,w:79,h:70,angle:-90},{x:841,y:490.5,w:79,h:70,angle:-90},{x:1166.5,y:490.5,w:79,h:69,angle:-90},{x:683,y:583.5,w:79,h:70,angle:-90},{x:891.5,y:583.5,w:79,h:69,angle:-90},{x:1217,y:583.5,w:79,h:70,angle:-90},{x:17,y:584,w:52,h:18,angle:-90},{x:48.5,y:584,w:52,h:17,angle:-90},{x:81,y:584,w:52,h:18,angle:-90},{x:112.5,y:584,w:52,h:17,angle:-90},{x:144.5,y:584,w:52,h:17,angle:-90},{x:176.5,y:584,w:52,h:17,angle:-90},{x:208.5,y:584,w:52,h:17,angle:-90},{x:240.5,y:584,w:52,h:17,angle:-90},{x:272.5,y:584,w:52,h:17,angle:-90},{x:304.5,y:584,w:52,h:17,angle:-90},{x:336.5,y:584,w:52,h:17,angle:-90},{x:368.5,y:584,w:52,h:17,angle:-90},{x:400.5,y:584,w:52,h:17,angle:-90},{x:432.5,y:584,w:52,h:17,angle:-90},{x:464.5,y:584,w:52,h:17,angle:-90},{x:496.5,y:584,w:52,h:17,angle:-90},{x:528.5,y:584,w:52,h:17,angle:-90},{x:560.5,y:584,w:52,h:17,angle:-90},{x:592.5,y:584,w:52,h:17,angle:-90},{x:624.5,y:584,w:52,h:17,angle:-90},{x:1008,y:584,w:78,h:70,angle:-90},{x:1273,y:584,w:52,h:18,angle:-90},{x:1305,y:584,w:52,h:18,angle:-90},{x:1337,y:584,w:52,h:18,angle:-90},{x:1369,y:584,w:52,h:18,angle:-90},{x:1401,y:584,w:52,h:18,angle:-90},{x:1433,y:584,w:52,h:18,angle:-90},{x:1465,y:584,w:52,h:18,angle:-90},{x:1497,y:584,w:52,h:18,angle:-90},{x:1529,y:584,w:52,h:18,angle:-90},{x:1561,y:584,w:52,h:18,angle:-90},{x:1593,y:584,w:52,h:18,angle:-90},{x:1625,y:584,w:52,h:18,angle:-90},{x:1657,y:584,w:52,h:18,angle:-90},{x:1688.5,y:584,w:52,h:17,angle:-90},{x:1721,y:584,w:52,h:18,angle:-90},{x:1753,y:584,w:52,h:18,angle:-90},{x:1785,y:584,w:52,h:18,angle:-90},{x:1817,y:584,w:52,h:18,angle:-90},{x:1849,y:584,w:52,h:18,angle:-90},{x:1881,y:584,w:52,h:18,angle:-90},{x:1911.5,y:584,w:52,h:15,angle:-90}]}},{slug:`speed-wall`,top_extract:{blocks:[{x:10.5,y:543.5,w:47,h:17,angle:-90},{x:40.5,y:543.5,w:47,h:19,angle:-90},{x:68.5,y:543.5,w:47,h:19,angle:-90},{x:96.5,y:543.5,w:47,h:19,angle:-90},{x:127,y:543.5,w:47,h:20,angle:-90},{x:970,y:543.5,w:1650,h:47,angle:0}]},three_boxes:{manual_boxes:[{count:31,x_cm:-87.286,step_x_cm:1.444,z_cm:0,y_cm:2.4,yaw_deg:90,pose:`upright`,material:`domino`},{count:11,x_cm:-42.513,step_x_cm:8.0976,z_cm:0,y_cm:2.4,yaw_deg:90,pose:`upright`,material:`domino`},{count:11,x_cm:-38.463,step_x_cm:8.0976,z_cm:0,y_cm:2.4,yaw_deg:90,pose:`upright`,material:`domino`},{count:11,x_cm:-40.488,step_x_cm:8.0976,z_cm:0,y_cm:5.175,yaw_deg:0,pose:`flat`,material:`domino`},{count:10,x_cm:-38.4642,step_x_cm:8.0976,z_cm:0,y_cm:7.951,yaw_deg:90,pose:`upright`,material:`domino`},{count:10,x_cm:-34.4142,step_x_cm:8.0976,z_cm:0,y_cm:7.951,yaw_deg:90,pose:`upright`,material:`domino`},{count:10,x_cm:-36.4392,step_x_cm:8.0976,z_cm:0,y_cm:10.726,yaw_deg:0,pose:`flat`,material:`domino`},{count:9,x_cm:-34.4154,step_x_cm:8.0976,z_cm:0,y_cm:13.502,yaw_deg:90,pose:`upright`,material:`domino`},{count:9,x_cm:-30.3654,step_x_cm:8.0976,z_cm:0,y_cm:13.502,yaw_deg:90,pose:`upright`,material:`domino`},{count:9,x_cm:-32.3904,step_x_cm:8.0976,z_cm:0,y_cm:16.277,yaw_deg:0,pose:`flat`,material:`domino`},{count:8,x_cm:-30.3666,step_x_cm:8.0976,z_cm:0,y_cm:19.053,yaw_deg:90,pose:`upright`,material:`domino`},{count:8,x_cm:-26.3166,step_x_cm:8.0976,z_cm:0,y_cm:19.053,yaw_deg:90,pose:`upright`,material:`domino`},{count:8,x_cm:-28.3416,step_x_cm:8.0976,z_cm:0,y_cm:21.828,yaw_deg:0,pose:`flat`,material:`domino`},{count:7,x_cm:-26.3178,step_x_cm:8.0976,z_cm:0,y_cm:24.604,yaw_deg:90,pose:`upright`,material:`domino`},{count:7,x_cm:-22.2678,step_x_cm:8.0976,z_cm:0,y_cm:24.604,yaw_deg:90,pose:`upright`,material:`domino`},{count:7,x_cm:-24.2928,step_x_cm:8.0976,z_cm:0,y_cm:27.379,yaw_deg:0,pose:`flat`,material:`domino`},{count:6,x_cm:-22.269,step_x_cm:8.0976,z_cm:0,y_cm:30.155,yaw_deg:90,pose:`upright`,material:`domino`},{count:6,x_cm:-18.219,step_x_cm:8.0976,z_cm:0,y_cm:30.155,yaw_deg:90,pose:`upright`,material:`domino`},{count:6,x_cm:-20.244,step_x_cm:8.0976,z_cm:0,y_cm:32.93,yaw_deg:0,pose:`flat`,material:`domino`},{count:5,x_cm:-18.2202,step_x_cm:8.0976,z_cm:0,y_cm:35.706,yaw_deg:90,pose:`upright`,material:`domino`},{count:5,x_cm:-14.1702,step_x_cm:8.0976,z_cm:0,y_cm:35.706,yaw_deg:90,pose:`upright`,material:`domino`},{count:5,x_cm:-16.1952,step_x_cm:8.0976,z_cm:0,y_cm:38.481,yaw_deg:0,pose:`flat`,material:`domino`}]}}],ra={"2d-pyramid":[[-2.458,1.2,-2.025,.75,4.8,2.4,-.5,.5,.5,.5],[4.05,1.2,0,.75,4.8,2.4,-.707107,0,0,.707107],[8.1,1.2,0,.75,4.8,2.4,-.707107,0,0,.707107],[12.15,1.2,0,.75,4.8,2.4,-.707107,0,0,.707107],[16.2,1.2,0,.75,4.8,2.4,-.707107,0,0,.707107],[20.25,1.2,0,.75,4.8,2.4,-.707107,0,0,.707107],[24.3,1.2,0,.75,4.8,2.4,-.707107,0,0,.707107],[28.35,1.2,0,.75,4.8,2.4,-.707107,0,0,.707107],[32.4,1.2,0,.75,4.8,2.4,-.707107,0,0,.707107],[36.45,1.2,0,.75,4.8,2.4,-.707107,0,0,.707107],[40.5,1.2,0,.75,4.8,2.4,-.707107,0,0,.707107],[44.55,1.2,0,.75,4.8,2.4,-.707107,0,0,.707107],[48.6,1.2,0,.75,4.8,2.4,-.707107,0,0,.707107],[52.65,1.2,0,.75,4.8,2.4,-.707107,0,0,.707107],[56.7,1.2,0,.75,4.8,2.4,-.707107,0,0,.707107],[60.75,1.2,0,.75,4.8,2.4,-.707107,0,0,.707107],[64.8,1.2,0,.75,4.8,2.4,-.707107,0,0,.707107],[68.85,1.2,0,.75,4.8,2.4,-.707107,0,0,.707107],[72.9,1.2,0,.75,4.8,2.4,-.707107,0,0,.707107],[76.95,1.2,0,.75,4.8,2.4,-.707107,0,0,.707107],[2.025,3.601,-2.025,.75,4.8,2.4,-.5,.5,.5,.5],[6.075,3.601,2.025,.75,4.8,2.4,-.5,.5,.5,.5],[10.125,3.601,-2.025,.75,4.8,2.4,-.5,.5,.5,.5],[14.175,3.601,2.025,.75,4.8,2.4,-.5,.5,.5,.5],[18.225,3.601,-2.025,.75,4.8,2.4,-.5,.5,.5,.5],[22.275,3.601,2.025,.75,4.8,2.4,-.5,.5,.5,.5],[26.325,3.601,-2.025,.75,4.8,2.4,-.5,.5,.5,.5],[30.375,3.601,2.025,.75,4.8,2.4,-.5,.5,.5,.5],[34.425,3.601,-2.025,.75,4.8,2.4,-.5,.5,.5,.5],[38.475,3.601,2.025,.75,4.8,2.4,-.5,.5,.5,.5],[42.525,3.601,-2.025,.75,4.8,2.4,-.5,.5,.5,.5],[46.575,3.601,2.025,.75,4.8,2.4,-.5,.5,.5,.5],[50.625,3.601,-2.025,.75,4.8,2.4,-.5,.5,.5,.5],[54.675,3.601,2.025,.75,4.8,2.4,-.5,.5,.5,.5],[58.725,3.601,-2.025,.75,4.8,2.4,-.5,.5,.5,.5],[62.775,3.601,2.025,.75,4.8,2.4,-.5,.5,.5,.5],[66.825,3.601,-2.025,.75,4.8,2.4,-.5,.5,.5,.5],[70.875,3.601,2.025,.75,4.8,2.4,-.5,.5,.5,.5],[74.925,3.601,-2.025,.75,4.8,2.4,-.5,.5,.5,.5],[4.05,6.002,0,.75,4.8,2.4,-.707107,0,0,.707107],[8.1,6.002,0,.75,4.8,2.4,-.707107,0,0,.707107],[12.15,6.002,0,.75,4.8,2.4,-.707107,0,0,.707107],[16.2,6.002,0,.75,4.8,2.4,-.707107,0,0,.707107],[20.25,6.002,0,.75,4.8,2.4,-.707107,0,0,.707107],[24.3,6.002,0,.75,4.8,2.4,-.707107,0,0,.707107],[28.35,6.002,0,.75,4.8,2.4,-.707107,0,0,.707107],[32.4,6.002,0,.75,4.8,2.4,-.707107,0,0,.707107],[36.45,6.002,0,.75,4.8,2.4,-.707107,0,0,.707107],[40.5,6.002,0,.75,4.8,2.4,-.707107,0,0,.707107],[44.55,6.002,0,.75,4.8,2.4,-.707107,0,0,.707107],[48.6,6.002,0,.75,4.8,2.4,-.707107,0,0,.707107],[52.65,6.002,0,.75,4.8,2.4,-.707107,0,0,.707107],[56.7,6.002,0,.75,4.8,2.4,-.707107,0,0,.707107],[60.75,6.002,0,.75,4.8,2.4,-.707107,0,0,.707107],[64.8,6.002,0,.75,4.8,2.4,-.707107,0,0,.707107],[68.85,6.002,0,.75,4.8,2.4,-.707107,0,0,.707107],[72.9,6.002,0,.75,4.8,2.4,-.707107,0,0,.707107],[6.075,8.403,-2.025,.75,4.8,2.4,-.5,.5,.5,.5],[10.125,8.403,2.025,.75,4.8,2.4,-.5,.5,.5,.5],[14.175,8.403,-2.025,.75,4.8,2.4,-.5,.5,.5,.5],[18.225,8.403,2.025,.75,4.8,2.4,-.5,.5,.5,.5],[22.275,8.403,-2.025,.75,4.8,2.4,-.5,.5,.5,.5],[26.325,8.403,2.025,.75,4.8,2.4,-.5,.5,.5,.5],[30.375,8.403,-2.025,.75,4.8,2.4,-.5,.5,.5,.5],[34.425,8.403,2.025,.75,4.8,2.4,-.5,.5,.5,.5],[38.475,8.403,-2.025,.75,4.8,2.4,-.5,.5,.5,.5],[42.525,8.403,2.025,.75,4.8,2.4,-.5,.5,.5,.5],[46.575,8.403,-2.025,.75,4.8,2.4,-.5,.5,.5,.5],[50.625,8.403,2.025,.75,4.8,2.4,-.5,.5,.5,.5],[54.675,8.403,-2.025,.75,4.8,2.4,-.5,.5,.5,.5],[58.725,8.403,2.025,.75,4.8,2.4,-.5,.5,.5,.5],[62.775,8.403,-2.025,.75,4.8,2.4,-.5,.5,.5,.5],[66.825,8.403,2.025,.75,4.8,2.4,-.5,.5,.5,.5],[70.875,8.403,-2.025,.75,4.8,2.4,-.5,.5,.5,.5],[8.1,10.804,0,.75,4.8,2.4,-.707107,0,0,.707107],[12.15,10.804,0,.75,4.8,2.4,-.707107,0,0,.707107],[16.2,10.804,0,.75,4.8,2.4,-.707107,0,0,.707107],[20.25,10.804,0,.75,4.8,2.4,-.707107,0,0,.707107],[24.3,10.804,0,.75,4.8,2.4,-.707107,0,0,.707107],[28.35,10.804,0,.75,4.8,2.4,-.707107,0,0,.707107],[32.4,10.804,0,.75,4.8,2.4,-.707107,0,0,.707107],[36.45,10.804,0,.75,4.8,2.4,-.707107,0,0,.707107],[40.5,10.804,0,.75,4.8,2.4,-.707107,0,0,.707107],[44.55,10.804,0,.75,4.8,2.4,-.707107,0,0,.707107],[48.6,10.804,0,.75,4.8,2.4,-.707107,0,0,.707107],[52.65,10.804,0,.75,4.8,2.4,-.707107,0,0,.707107],[56.7,10.804,0,.75,4.8,2.4,-.707107,0,0,.707107],[60.75,10.804,0,.75,4.8,2.4,-.707107,0,0,.707107],[64.8,10.804,0,.75,4.8,2.4,-.707107,0,0,.707107],[68.85,10.804,0,.75,4.8,2.4,-.707107,0,0,.707107],[10.125,13.205,-2.025,.75,4.8,2.4,-.5,.5,.5,.5],[14.175,13.205,2.025,.75,4.8,2.4,-.5,.5,.5,.5],[18.225,13.205,-2.025,.75,4.8,2.4,-.5,.5,.5,.5],[22.275,13.205,2.025,.75,4.8,2.4,-.5,.5,.5,.5],[26.325,13.205,-2.025,.75,4.8,2.4,-.5,.5,.5,.5],[30.375,13.205,2.025,.75,4.8,2.4,-.5,.5,.5,.5],[34.425,13.205,-2.025,.75,4.8,2.4,-.5,.5,.5,.5],[38.475,13.205,2.025,.75,4.8,2.4,-.5,.5,.5,.5],[42.525,13.205,-2.025,.75,4.8,2.4,-.5,.5,.5,.5],[46.575,13.205,2.025,.75,4.8,2.4,-.5,.5,.5,.5],[50.625,13.205,-2.025,.75,4.8,2.4,-.5,.5,.5,.5],[54.675,13.205,2.025,.75,4.8,2.4,-.5,.5,.5,.5],[58.725,13.205,-2.025,.75,4.8,2.4,-.5,.5,.5,.5],[62.775,13.205,2.025,.75,4.8,2.4,-.5,.5,.5,.5],[66.825,13.205,-2.025,.75,4.8,2.4,-.5,.5,.5,.5],[12.15,15.606,0,.75,4.8,2.4,-.707107,0,0,.707107],[16.2,15.606,0,.75,4.8,2.4,-.707107,0,0,.707107],[20.25,15.606,0,.75,4.8,2.4,-.707107,0,0,.707107],[24.3,15.606,0,.75,4.8,2.4,-.707107,0,0,.707107],[28.35,15.606,0,.75,4.8,2.4,-.707107,0,0,.707107],[32.4,15.606,0,.75,4.8,2.4,-.707107,0,0,.707107],[36.45,15.606,0,.75,4.8,2.4,-.707107,0,0,.707107],[40.5,15.606,0,.75,4.8,2.4,-.707107,0,0,.707107],[44.55,15.606,0,.75,4.8,2.4,-.707107,0,0,.707107],[48.6,15.606,0,.75,4.8,2.4,-.707107,0,0,.707107],[52.65,15.606,0,.75,4.8,2.4,-.707107,0,0,.707107],[56.7,15.606,0,.75,4.8,2.4,-.707107,0,0,.707107],[60.75,15.606,0,.75,4.8,2.4,-.707107,0,0,.707107],[64.8,15.606,0,.75,4.8,2.4,-.707107,0,0,.707107],[14.175,18.007,-2.025,.75,4.8,2.4,-.5,.5,.5,.5],[18.225,18.007,2.025,.75,4.8,2.4,-.5,.5,.5,.5],[22.275,18.007,-2.025,.75,4.8,2.4,-.5,.5,.5,.5],[26.325,18.007,2.025,.75,4.8,2.4,-.5,.5,.5,.5],[30.375,18.007,-2.025,.75,4.8,2.4,-.5,.5,.5,.5],[34.425,18.007,2.025,.75,4.8,2.4,-.5,.5,.5,.5],[38.475,18.007,-2.025,.75,4.8,2.4,-.5,.5,.5,.5],[42.525,18.007,2.025,.75,4.8,2.4,-.5,.5,.5,.5],[46.575,18.007,-2.025,.75,4.8,2.4,-.5,.5,.5,.5],[50.625,18.007,2.025,.75,4.8,2.4,-.5,.5,.5,.5],[54.675,18.007,-2.025,.75,4.8,2.4,-.5,.5,.5,.5],[58.725,18.007,2.025,.75,4.8,2.4,-.5,.5,.5,.5],[62.775,18.007,-2.025,.75,4.8,2.4,-.5,.5,.5,.5],[16.2,20.408,0,.75,4.8,2.4,-.707107,0,0,.707107],[20.25,20.408,0,.75,4.8,2.4,-.707107,0,0,.707107],[24.3,20.408,0,.75,4.8,2.4,-.707107,0,0,.707107],[28.35,20.408,0,.75,4.8,2.4,-.707107,0,0,.707107],[32.4,20.408,0,.75,4.8,2.4,-.707107,0,0,.707107],[36.45,20.408,0,.75,4.8,2.4,-.707107,0,0,.707107],[40.5,20.408,0,.75,4.8,2.4,-.707107,0,0,.707107],[44.55,20.408,0,.75,4.8,2.4,-.707107,0,0,.707107],[48.6,20.408,0,.75,4.8,2.4,-.707107,0,0,.707107],[52.65,20.408,0,.75,4.8,2.4,-.707107,0,0,.707107],[56.7,20.408,0,.75,4.8,2.4,-.707107,0,0,.707107],[60.75,20.408,0,.75,4.8,2.4,-.707107,0,0,.707107],[18.225,22.809,-2.025,.75,4.8,2.4,-.5,.5,.5,.5],[22.275,22.809,2.025,.75,4.8,2.4,-.5,.5,.5,.5],[26.325,22.809,-2.025,.75,4.8,2.4,-.5,.5,.5,.5],[30.375,22.809,2.025,.75,4.8,2.4,-.5,.5,.5,.5],[34.425,22.809,-2.025,.75,4.8,2.4,-.5,.5,.5,.5],[38.475,22.809,2.025,.75,4.8,2.4,-.5,.5,.5,.5],[42.525,22.809,-2.025,.75,4.8,2.4,-.5,.5,.5,.5],[46.575,22.809,2.025,.75,4.8,2.4,-.5,.5,.5,.5],[50.625,22.809,-2.025,.75,4.8,2.4,-.5,.5,.5,.5],[54.675,22.809,2.025,.75,4.8,2.4,-.5,.5,.5,.5],[58.725,22.809,-2.025,.75,4.8,2.4,-.5,.5,.5,.5],[20.25,25.21,0,.75,4.8,2.4,-.707107,0,0,.707107],[24.3,25.21,0,.75,4.8,2.4,-.707107,0,0,.707107],[28.35,25.21,0,.75,4.8,2.4,-.707107,0,0,.707107],[32.4,25.21,0,.75,4.8,2.4,-.707107,0,0,.707107],[36.45,25.21,0,.75,4.8,2.4,-.707107,0,0,.707107],[40.5,25.21,0,.75,4.8,2.4,-.707107,0,0,.707107],[44.55,25.21,0,.75,4.8,2.4,-.707107,0,0,.707107],[48.6,25.21,0,.75,4.8,2.4,-.707107,0,0,.707107],[52.65,25.21,0,.75,4.8,2.4,-.707107,0,0,.707107],[56.7,25.21,0,.75,4.8,2.4,-.707107,0,0,.707107],[22.275,27.611,-2.025,.75,4.8,2.4,-.5,.5,.5,.5],[26.325,27.611,2.025,.75,4.8,2.4,-.5,.5,.5,.5],[30.375,27.611,-2.025,.75,4.8,2.4,-.5,.5,.5,.5],[34.425,27.611,2.025,.75,4.8,2.4,-.5,.5,.5,.5],[38.475,27.611,-2.025,.75,4.8,2.4,-.5,.5,.5,.5],[42.525,27.611,2.025,.75,4.8,2.4,-.5,.5,.5,.5],[46.575,27.611,-2.025,.75,4.8,2.4,-.5,.5,.5,.5],[50.625,27.611,2.025,.75,4.8,2.4,-.5,.5,.5,.5],[54.675,27.611,-2.025,.75,4.8,2.4,-.5,.5,.5,.5],[24.3,30.012,0,.75,4.8,2.4,-.707107,0,0,.707107],[28.35,30.012,0,.75,4.8,2.4,-.707107,0,0,.707107],[32.4,30.012,0,.75,4.8,2.4,-.707107,0,0,.707107],[36.45,30.012,0,.75,4.8,2.4,-.707107,0,0,.707107],[40.5,30.012,0,.75,4.8,2.4,-.707107,0,0,.707107],[44.55,30.012,0,.75,4.8,2.4,-.707107,0,0,.707107],[48.6,30.012,0,.75,4.8,2.4,-.707107,0,0,.707107],[52.65,30.012,0,.75,4.8,2.4,-.707107,0,0,.707107],[26.325,32.413,-2.025,.75,4.8,2.4,-.5,.5,.5,.5],[30.375,32.413,2.025,.75,4.8,2.4,-.5,.5,.5,.5],[34.425,32.413,-2.025,.75,4.8,2.4,-.5,.5,.5,.5],[38.475,32.413,2.025,.75,4.8,2.4,-.5,.5,.5,.5],[42.525,32.413,-2.025,.75,4.8,2.4,-.5,.5,.5,.5],[46.575,32.413,2.025,.75,4.8,2.4,-.5,.5,.5,.5],[50.625,32.413,-2.025,.75,4.8,2.4,-.5,.5,.5,.5],[28.35,34.814,0,.75,4.8,2.4,-.707107,0,0,.707107],[32.4,34.814,0,.75,4.8,2.4,-.707107,0,0,.707107],[36.45,34.814,0,.75,4.8,2.4,-.707107,0,0,.707107],[40.5,34.814,0,.75,4.8,2.4,-.707107,0,0,.707107],[44.55,34.814,0,.75,4.8,2.4,-.707107,0,0,.707107],[48.6,34.814,0,.75,4.8,2.4,-.707107,0,0,.707107],[30.375,37.215,-2.025,.75,4.8,2.4,-.5,.5,.5,.5],[34.425,37.215,2.025,.75,4.8,2.4,-.5,.5,.5,.5],[38.475,37.215,-2.025,.75,4.8,2.4,-.5,.5,.5,.5],[42.525,37.215,2.025,.75,4.8,2.4,-.5,.5,.5,.5],[46.575,37.215,-2.025,.75,4.8,2.4,-.5,.5,.5,.5],[32.4,39.616,0,.75,4.8,2.4,-.707107,0,0,.707107],[36.45,39.616,0,.75,4.8,2.4,-.707107,0,0,.707107],[40.5,39.616,0,.75,4.8,2.4,-.707107,0,0,.707107],[44.55,39.616,0,.75,4.8,2.4,-.707107,0,0,.707107],[34.425,42.017,-2.025,.75,4.8,2.4,-.5,.5,.5,.5],[38.475,42.017,2.025,.75,4.8,2.4,-.5,.5,.5,.5],[42.525,42.017,-2.025,.75,4.8,2.4,-.5,.5,.5,.5],[36.45,44.418,0,.75,4.8,2.4,-.707107,0,0,.707107],[40.5,44.418,0,.75,4.8,2.4,-.707107,0,0,.707107],[38.475,46.819,-2.025,.75,4.8,2.4,-.5,.5,.5,.5],[-2.458,2.402,-.45,.75,4.8,2.4,0,.707107,0,.707107],[-2.458,2.402,1.05,.75,4.8,2.4,0,.707107,0,.707107],[-2.458,2.402,2.55,.75,4.8,2.4,0,.707107,0,.707107],[-2.458,2.402,4.05,.75,4.8,2.4,0,.707107,0,.707107],[-2.458,2.402,5.55,.75,4.8,2.4,0,.707107,0,.707107],[-2.458,2.402,7.05,.75,4.8,2.4,0,.707107,0,.707107],[-2.458,2.402,8.55,.75,4.8,2.4,0,.707107,0,.707107],[-2.458,2.402,10.05,.75,4.8,2.4,0,.707107,0,.707107],[-2.458,2.402,11.55,.75,4.8,2.4,0,.707107,0,.707107],[-2.458,2.402,13.05,.75,4.8,2.4,0,.707107,0,.707107],[-2.458,2.402,14.55,.75,4.8,2.4,0,.707107,0,.707107],[-2.458,2.402,16.05,.75,4.8,2.4,0,.707107,0,.707107],[-2.458,2.402,17.55,.75,4.8,2.4,0,.707107,0,.707107],[-2.458,2.402,19.05,.75,4.8,2.4,0,.707107,0,.707107],[-2.458,2.402,20.55,.75,4.8,2.4,0,.707107,0,.707107],[-2.458,2.402,22.05,.75,4.8,2.4,0,.707107,0,.707107],[-2.458,2.402,23.55,.75,4.8,2.4,0,.707107,0,.707107],[-2.458,2.402,25.05,.75,4.8,2.4,0,.707107,0,.707107],[-2.458,2.402,26.55,.75,4.8,2.4,0,.707107,0,.707107],[-2.458,2.402,28.05,.75,4.8,2.4,0,.707107,0,.707107],[-2.458,2.402,29.55,.75,4.8,2.4,0,.707107,0,.707107]],"3d-pyramid":[[-75.1672,1.2,-5.8976,.75,4.8,2.4,-.707107,0,0,.707107],[-79.2172,1.2,-1.8476,.75,4.8,2.4,-.707107,0,0,.707107],[-83.2672,1.2,2.2024,.75,4.8,2.4,-.707107,0,0,.707107],[-87.3172,1.2,6.2524,.75,4.8,2.4,-.707107,0,0,.707107],[-58.9672,1.2,-13.9976,.75,4.8,2.4,-.707107,0,0,.707107],[-63.0172,1.2,-9.9476,.75,4.8,2.4,-.707107,0,0,.707107],[-67.0672,1.2,-5.8976,.75,4.8,2.4,-.707107,0,0,.707107],[-71.1172,1.2,-1.8476,.75,4.8,2.4,-.707107,0,0,.707107],[-75.1672,1.2,2.2024,.75,4.8,2.4,-.707107,0,0,.707107],[-79.2172,1.2,6.2524,.75,4.8,2.4,-.707107,0,0,.707107],[-83.2672,1.2,10.3024,.75,4.8,2.4,-.707107,0,0,.707107],[-54.9172,1.2,-9.9476,.75,4.8,2.4,-.707107,0,0,.707107],[-58.9672,1.2,-5.8976,.75,4.8,2.4,-.707107,0,0,.707107],[-63.0172,1.2,-1.8476,.75,4.8,2.4,-.707107,0,0,.707107],[-67.0672,1.2,2.2024,.75,4.8,2.4,-.707107,0,0,.707107],[-71.1172,1.2,6.2524,.75,4.8,2.4,-.707107,0,0,.707107],[-75.1672,1.2,10.3024,.75,4.8,2.4,-.707107,0,0,.707107],[-79.2172,1.2,14.3524,.75,4.8,2.4,-.707107,0,0,.707107],[-50.8672,1.2,-5.8976,.75,4.8,2.4,-.707107,0,0,.707107],[-54.9172,1.2,-1.8476,.75,4.8,2.4,-.707107,0,0,.707107],[-58.9672,1.2,2.2024,.75,4.8,2.4,-.707107,0,0,.707107],[-71.1172,1.2,22.4524,.75,4.8,2.4,-.707107,0,0,.707107],[-67.0672,1.2,18.4024,.75,4.8,2.4,-.707107,0,0,.707107],[-63.0172,1.2,14.3524,.75,4.8,2.4,-.707107,0,0,.707107],[-58.9672,1.2,10.3024,.75,4.8,2.4,-.707107,0,0,.707107],[-54.9172,1.2,6.2524,.75,4.8,2.4,-.707107,0,0,.707107],[-50.8672,1.2,2.2024,.75,4.8,2.4,-.707107,0,0,.707107],[-46.8172,1.2,-1.8476,.75,4.8,2.4,-.707107,0,0,.707107],[-75.1672,1.2,18.4024,.75,4.8,2.4,-.707107,0,0,.707107],[-71.1172,1.2,14.3524,.75,4.8,2.4,-.707107,0,0,.707107],[-67.0672,1.2,10.3024,.75,4.8,2.4,-.707107,0,0,.707107],[-63.0172,1.2,6.2524,.75,4.8,2.4,-.707107,0,0,.707107],[-71.1172,1.2,-9.9476,.75,4.8,2.4,-.707107,0,0,.707107],[-67.0672,1.2,-13.9976,.75,4.8,2.4,-.707107,0,0,.707107],[-63.0172,1.2,-18.0476,.75,4.8,2.4,-.707107,0,0,.707107],[-91.3672,1.2,2.2024,.75,4.8,2.4,-.707107,0,0,.707107],[-87.3172,1.2,-1.8476,.75,4.8,2.4,-.707107,0,0,.707107],[-83.2672,1.2,-5.8976,.75,4.8,2.4,-.707107,0,0,.707107],[-79.2172,1.2,-9.9476,.75,4.8,2.4,-.707107,0,0,.707107],[-75.1672,1.2,-13.9976,.75,4.8,2.4,-.707107,0,0,.707107],[-71.1172,1.2,-18.0476,.75,4.8,2.4,-.707107,0,0,.707107],[-67.0672,1.2,-22.0976,.75,4.8,2.4,-.707107,0,0,.707107],[-97.4827,1.2,-3.8768,.75,4.8,2.4,-.5,.5,.5,.5],[-91.3672,1.2,-5.8976,.75,4.8,2.4,-.707107,0,0,.707107],[-87.3172,1.2,-9.9476,.75,4.8,2.4,-.707107,0,0,.707107],[-83.2672,1.2,-13.9976,.75,4.8,2.4,-.707107,0,0,.707107],[-79.2172,1.2,-18.0476,.75,4.8,2.4,-.707107,0,0,.707107],[-75.1672,1.2,-22.0976,.75,4.8,2.4,-.707107,0,0,.707107],[-71.1172,1.2,-26.1476,.75,4.8,2.4,-.707107,0,0,.707107],[-69.0922,3.601,20.4274,.75,4.8,2.4,-.5,.5,.5,.5],[-65.0422,3.601,16.3774,.75,4.8,2.4,-.5,.5,.5,.5],[-60.9922,3.601,12.3274,.75,4.8,2.4,-.5,.5,.5,.5],[-56.9422,3.601,8.2774,.75,4.8,2.4,-.5,.5,.5,.5],[-52.8922,3.601,4.2274,.75,4.8,2.4,-.5,.5,.5,.5],[-48.8422,3.601,.1774,.75,4.8,2.4,-.5,.5,.5,.5],[-73.1422,3.601,16.3774,.75,4.8,2.4,-.5,.5,.5,.5],[-69.0922,3.601,12.3274,.75,4.8,2.4,-.5,.5,.5,.5],[-65.0422,3.601,8.2774,.75,4.8,2.4,-.5,.5,.5,.5],[-60.9922,3.601,4.2274,.75,4.8,2.4,-.5,.5,.5,.5],[-56.9422,3.601,.1774,.75,4.8,2.4,-.5,.5,.5,.5],[-52.8922,3.601,-3.8726,.75,4.8,2.4,-.5,.5,.5,.5],[-77.1922,3.601,12.3274,.75,4.8,2.4,-.5,.5,.5,.5],[-73.1422,3.601,8.2774,.75,4.8,2.4,-.5,.5,.5,.5],[-69.0922,3.601,4.2274,.75,4.8,2.4,-.5,.5,.5,.5],[-65.0422,3.601,.1774,.75,4.8,2.4,-.5,.5,.5,.5],[-60.9922,3.601,-3.8726,.75,4.8,2.4,-.5,.5,.5,.5],[-56.9422,3.601,-7.9226,.75,4.8,2.4,-.5,.5,.5,.5],[-81.2422,3.601,8.2774,.75,4.8,2.4,-.5,.5,.5,.5],[-77.1922,3.601,4.2274,.75,4.8,2.4,-.5,.5,.5,.5],[-73.1422,3.601,.1774,.75,4.8,2.4,-.5,.5,.5,.5],[-69.0922,3.601,-3.8726,.75,4.8,2.4,-.5,.5,.5,.5],[-65.0422,3.601,-7.9226,.75,4.8,2.4,-.5,.5,.5,.5],[-60.9922,3.601,-11.9726,.75,4.8,2.4,-.5,.5,.5,.5],[-85.2922,3.601,4.2274,.75,4.8,2.4,-.5,.5,.5,.5],[-81.2422,3.601,.1774,.75,4.8,2.4,-.5,.5,.5,.5],[-77.1922,3.601,-3.8726,.75,4.8,2.4,-.5,.5,.5,.5],[-73.1422,3.601,-7.9226,.75,4.8,2.4,-.5,.5,.5,.5],[-69.0922,3.601,-11.9726,.75,4.8,2.4,-.5,.5,.5,.5],[-65.0422,3.601,-16.0226,.75,4.8,2.4,-.5,.5,.5,.5],[-89.3422,3.601,.1774,.75,4.8,2.4,-.5,.5,.5,.5],[-85.2922,3.601,-3.8726,.75,4.8,2.4,-.5,.5,.5,.5],[-81.2422,3.601,-7.9226,.75,4.8,2.4,-.5,.5,.5,.5],[-77.1922,3.601,-11.9726,.75,4.8,2.4,-.5,.5,.5,.5],[-73.1422,3.601,-16.0226,.75,4.8,2.4,-.5,.5,.5,.5],[-69.0922,3.601,-20.0726,.75,4.8,2.4,-.5,.5,.5,.5],[-93.3922,3.601,-3.8726,.75,4.8,2.4,-.5,.5,.5,.5],[-89.3422,3.601,-7.9226,.75,4.8,2.4,-.5,.5,.5,.5],[-85.2922,3.601,-11.9726,.75,4.8,2.4,-.5,.5,.5,.5],[-81.2422,3.601,-16.0226,.75,4.8,2.4,-.5,.5,.5,.5],[-77.1922,3.601,-20.0726,.75,4.8,2.4,-.5,.5,.5,.5],[-73.1422,3.601,-24.1226,.75,4.8,2.4,-.5,.5,.5,.5],[-71.1172,6.002,18.4024,.75,4.8,2.4,-.707107,0,0,.707107],[-67.0672,6.002,14.3524,.75,4.8,2.4,-.707107,0,0,.707107],[-63.0172,6.002,10.3024,.75,4.8,2.4,-.707107,0,0,.707107],[-58.9672,6.002,6.2524,.75,4.8,2.4,-.707107,0,0,.707107],[-54.9172,6.002,2.2024,.75,4.8,2.4,-.707107,0,0,.707107],[-50.8672,6.002,-1.8476,.75,4.8,2.4,-.707107,0,0,.707107],[-75.1672,6.002,14.3524,.75,4.8,2.4,-.707107,0,0,.707107],[-71.1172,6.002,10.3024,.75,4.8,2.4,-.707107,0,0,.707107],[-67.0672,6.002,6.2524,.75,4.8,2.4,-.707107,0,0,.707107],[-63.0172,6.002,2.2024,.75,4.8,2.4,-.707107,0,0,.707107],[-58.9672,6.002,-1.8476,.75,4.8,2.4,-.707107,0,0,.707107],[-54.9172,6.002,-5.8976,.75,4.8,2.4,-.707107,0,0,.707107],[-79.2172,6.002,10.3024,.75,4.8,2.4,-.707107,0,0,.707107],[-75.1672,6.002,6.2524,.75,4.8,2.4,-.707107,0,0,.707107],[-71.1172,6.002,2.2024,.75,4.8,2.4,-.707107,0,0,.707107],[-67.0672,6.002,-1.8476,.75,4.8,2.4,-.707107,0,0,.707107],[-63.0172,6.002,-5.8976,.75,4.8,2.4,-.707107,0,0,.707107],[-58.9672,6.002,-9.9476,.75,4.8,2.4,-.707107,0,0,.707107],[-83.2672,6.002,6.2524,.75,4.8,2.4,-.707107,0,0,.707107],[-79.2172,6.002,2.2024,.75,4.8,2.4,-.707107,0,0,.707107],[-75.1672,6.002,-1.8476,.75,4.8,2.4,-.707107,0,0,.707107],[-71.1172,6.002,-5.8976,.75,4.8,2.4,-.707107,0,0,.707107],[-67.0672,6.002,-9.9476,.75,4.8,2.4,-.707107,0,0,.707107],[-63.0172,6.002,-13.9976,.75,4.8,2.4,-.707107,0,0,.707107],[-87.3172,6.002,2.2024,.75,4.8,2.4,-.707107,0,0,.707107],[-83.2672,6.002,-1.8476,.75,4.8,2.4,-.707107,0,0,.707107],[-79.2172,6.002,-5.8976,.75,4.8,2.4,-.707107,0,0,.707107],[-75.1672,6.002,-9.9476,.75,4.8,2.4,-.707107,0,0,.707107],[-71.1172,6.002,-13.9976,.75,4.8,2.4,-.707107,0,0,.707107],[-67.0672,6.002,-18.0476,.75,4.8,2.4,-.707107,0,0,.707107],[-91.3672,6.002,-1.8476,.75,4.8,2.4,-.707107,0,0,.707107],[-87.3172,6.002,-5.8976,.75,4.8,2.4,-.707107,0,0,.707107],[-83.2672,6.002,-9.9476,.75,4.8,2.4,-.707107,0,0,.707107],[-79.2172,6.002,-13.9976,.75,4.8,2.4,-.707107,0,0,.707107],[-75.1672,6.002,-18.0476,.75,4.8,2.4,-.707107,0,0,.707107],[-71.1172,6.002,-22.0976,.75,4.8,2.4,-.707107,0,0,.707107],[-69.0922,8.403,16.3774,.75,4.8,2.4,-.5,.5,.5,.5],[-65.0422,8.403,12.3274,.75,4.8,2.4,-.5,.5,.5,.5],[-60.9922,8.403,8.2774,.75,4.8,2.4,-.5,.5,.5,.5],[-56.9422,8.403,4.2274,.75,4.8,2.4,-.5,.5,.5,.5],[-52.8922,8.403,.1774,.75,4.8,2.4,-.5,.5,.5,.5],[-73.1422,8.403,12.3274,.75,4.8,2.4,-.5,.5,.5,.5],[-69.0922,8.403,8.2774,.75,4.8,2.4,-.5,.5,.5,.5],[-65.0422,8.403,4.2274,.75,4.8,2.4,-.5,.5,.5,.5],[-60.9922,8.403,.1774,.75,4.8,2.4,-.5,.5,.5,.5],[-56.9422,8.403,-3.8726,.75,4.8,2.4,-.5,.5,.5,.5],[-77.1922,8.403,8.2774,.75,4.8,2.4,-.5,.5,.5,.5],[-73.1422,8.403,4.2274,.75,4.8,2.4,-.5,.5,.5,.5],[-69.0922,8.403,.1774,.75,4.8,2.4,-.5,.5,.5,.5],[-65.0422,8.403,-3.8726,.75,4.8,2.4,-.5,.5,.5,.5],[-60.9922,8.403,-7.9226,.75,4.8,2.4,-.5,.5,.5,.5],[-81.2422,8.403,4.2274,.75,4.8,2.4,-.5,.5,.5,.5],[-77.1922,8.403,.1774,.75,4.8,2.4,-.5,.5,.5,.5],[-73.1422,8.403,-3.8726,.75,4.8,2.4,-.5,.5,.5,.5],[-69.0922,8.403,-7.9226,.75,4.8,2.4,-.5,.5,.5,.5],[-65.0422,8.403,-11.9726,.75,4.8,2.4,-.5,.5,.5,.5],[-85.2922,8.403,.1774,.75,4.8,2.4,-.5,.5,.5,.5],[-81.2422,8.403,-3.8726,.75,4.8,2.4,-.5,.5,.5,.5],[-77.1922,8.403,-7.9226,.75,4.8,2.4,-.5,.5,.5,.5],[-73.1422,8.403,-11.9726,.75,4.8,2.4,-.5,.5,.5,.5],[-69.0922,8.403,-16.0226,.75,4.8,2.4,-.5,.5,.5,.5],[-89.3422,8.403,-3.8726,.75,4.8,2.4,-.5,.5,.5,.5],[-85.2922,8.403,-7.9226,.75,4.8,2.4,-.5,.5,.5,.5],[-81.2422,8.403,-11.9726,.75,4.8,2.4,-.5,.5,.5,.5],[-77.1922,8.403,-16.0226,.75,4.8,2.4,-.5,.5,.5,.5],[-73.1422,8.403,-20.0726,.75,4.8,2.4,-.5,.5,.5,.5],[-71.1172,10.804,14.3524,.75,4.8,2.4,-.707107,0,0,.707107],[-67.0672,10.804,10.3024,.75,4.8,2.4,-.707107,0,0,.707107],[-63.0172,10.804,6.2524,.75,4.8,2.4,-.707107,0,0,.707107],[-58.9672,10.804,2.2024,.75,4.8,2.4,-.707107,0,0,.707107],[-54.9172,10.804,-1.8476,.75,4.8,2.4,-.707107,0,0,.707107],[-75.1672,10.804,10.3024,.75,4.8,2.4,-.707107,0,0,.707107],[-71.1172,10.804,6.2524,.75,4.8,2.4,-.707107,0,0,.707107],[-67.0672,10.804,2.2024,.75,4.8,2.4,-.707107,0,0,.707107],[-63.0172,10.804,-1.8476,.75,4.8,2.4,-.707107,0,0,.707107],[-58.9672,10.804,-5.8976,.75,4.8,2.4,-.707107,0,0,.707107],[-79.2172,10.804,6.2524,.75,4.8,2.4,-.707107,0,0,.707107],[-75.1672,10.804,2.2024,.75,4.8,2.4,-.707107,0,0,.707107],[-71.1172,10.804,-1.8476,.75,4.8,2.4,-.707107,0,0,.707107],[-67.0672,10.804,-5.8976,.75,4.8,2.4,-.707107,0,0,.707107],[-63.0172,10.804,-9.9476,.75,4.8,2.4,-.707107,0,0,.707107],[-83.2672,10.804,2.2024,.75,4.8,2.4,-.707107,0,0,.707107],[-79.2172,10.804,-1.8476,.75,4.8,2.4,-.707107,0,0,.707107],[-75.1672,10.804,-5.8976,.75,4.8,2.4,-.707107,0,0,.707107],[-71.1172,10.804,-9.9476,.75,4.8,2.4,-.707107,0,0,.707107],[-67.0672,10.804,-13.9976,.75,4.8,2.4,-.707107,0,0,.707107],[-87.3172,10.804,-1.8476,.75,4.8,2.4,-.707107,0,0,.707107],[-83.2672,10.804,-5.8976,.75,4.8,2.4,-.707107,0,0,.707107],[-79.2172,10.804,-9.9476,.75,4.8,2.4,-.707107,0,0,.707107],[-75.1672,10.804,-13.9976,.75,4.8,2.4,-.707107,0,0,.707107],[-71.1172,10.804,-18.0476,.75,4.8,2.4,-.707107,0,0,.707107],[-69.0922,13.205,12.3274,.75,4.8,2.4,-.5,.5,.5,.5],[-65.0422,13.205,8.2774,.75,4.8,2.4,-.5,.5,.5,.5],[-60.9922,13.205,4.2274,.75,4.8,2.4,-.5,.5,.5,.5],[-56.9422,13.205,.1774,.75,4.8,2.4,-.5,.5,.5,.5],[-73.1422,13.205,8.2774,.75,4.8,2.4,-.5,.5,.5,.5],[-69.0922,13.205,4.2274,.75,4.8,2.4,-.5,.5,.5,.5],[-65.0422,13.205,.1774,.75,4.8,2.4,-.5,.5,.5,.5],[-60.9922,13.205,-3.8726,.75,4.8,2.4,-.5,.5,.5,.5],[-77.1922,13.205,4.2274,.75,4.8,2.4,-.5,.5,.5,.5],[-73.1422,13.205,.1774,.75,4.8,2.4,-.5,.5,.5,.5],[-69.0922,13.205,-3.8726,.75,4.8,2.4,-.5,.5,.5,.5],[-65.0422,13.205,-7.9226,.75,4.8,2.4,-.5,.5,.5,.5],[-81.2422,13.205,.1774,.75,4.8,2.4,-.5,.5,.5,.5],[-77.1922,13.205,-3.8726,.75,4.8,2.4,-.5,.5,.5,.5],[-73.1422,13.205,-7.9226,.75,4.8,2.4,-.5,.5,.5,.5],[-69.0922,13.205,-11.9726,.75,4.8,2.4,-.5,.5,.5,.5],[-85.2922,13.205,-3.8726,.75,4.8,2.4,-.5,.5,.5,.5],[-81.2422,13.205,-7.9226,.75,4.8,2.4,-.5,.5,.5,.5],[-77.1922,13.205,-11.9726,.75,4.8,2.4,-.5,.5,.5,.5],[-73.1422,13.205,-16.0226,.75,4.8,2.4,-.5,.5,.5,.5],[-71.1172,15.606,10.3024,.75,4.8,2.4,-.707107,0,0,.707107],[-67.0672,15.606,6.2524,.75,4.8,2.4,-.707107,0,0,.707107],[-63.0172,15.606,2.2024,.75,4.8,2.4,-.707107,0,0,.707107],[-58.9672,15.606,-1.8476,.75,4.8,2.4,-.707107,0,0,.707107],[-75.1672,15.606,6.2524,.75,4.8,2.4,-.707107,0,0,.707107],[-71.1172,15.606,2.2024,.75,4.8,2.4,-.707107,0,0,.707107],[-67.0672,15.606,-1.8476,.75,4.8,2.4,-.707107,0,0,.707107],[-63.0172,15.606,-5.8976,.75,4.8,2.4,-.707107,0,0,.707107],[-79.2172,15.606,2.2024,.75,4.8,2.4,-.707107,0,0,.707107],[-75.1672,15.606,-1.8476,.75,4.8,2.4,-.707107,0,0,.707107],[-71.1172,15.606,-5.8976,.75,4.8,2.4,-.707107,0,0,.707107],[-67.0672,15.606,-9.9476,.75,4.8,2.4,-.707107,0,0,.707107],[-83.2672,15.606,-1.8476,.75,4.8,2.4,-.707107,0,0,.707107],[-79.2172,15.606,-5.8976,.75,4.8,2.4,-.707107,0,0,.707107],[-75.1672,15.606,-9.9476,.75,4.8,2.4,-.707107,0,0,.707107],[-71.1172,15.606,-13.9976,.75,4.8,2.4,-.707107,0,0,.707107],[-69.0922,18.007,8.2774,.75,4.8,2.4,-.5,.5,.5,.5],[-65.0422,18.007,4.2274,.75,4.8,2.4,-.5,.5,.5,.5],[-60.9922,18.007,.1774,.75,4.8,2.4,-.5,.5,.5,.5],[-73.1422,18.007,4.2274,.75,4.8,2.4,-.5,.5,.5,.5],[-69.0922,18.007,.1774,.75,4.8,2.4,-.5,.5,.5,.5],[-65.0422,18.007,-3.8726,.75,4.8,2.4,-.5,.5,.5,.5],[-77.1922,18.007,.1774,.75,4.8,2.4,-.5,.5,.5,.5],[-73.1422,18.007,-3.8726,.75,4.8,2.4,-.5,.5,.5,.5],[-69.0922,18.007,-7.9226,.75,4.8,2.4,-.5,.5,.5,.5],[-81.2422,18.007,-3.8726,.75,4.8,2.4,-.5,.5,.5,.5],[-77.1922,18.007,-7.9226,.75,4.8,2.4,-.5,.5,.5,.5],[-73.1422,18.007,-11.9726,.75,4.8,2.4,-.5,.5,.5,.5],[-71.1172,20.408,6.2524,.75,4.8,2.4,-.707107,0,0,.707107],[-67.0672,20.408,2.2024,.75,4.8,2.4,-.707107,0,0,.707107],[-63.0172,20.408,-1.8476,.75,4.8,2.4,-.707107,0,0,.707107],[-75.1672,20.408,2.2024,.75,4.8,2.4,-.707107,0,0,.707107],[-71.1172,20.408,-1.8476,.75,4.8,2.4,-.707107,0,0,.707107],[-67.0672,20.408,-5.8976,.75,4.8,2.4,-.707107,0,0,.707107],[-79.2172,20.408,-1.8476,.75,4.8,2.4,-.707107,0,0,.707107],[-75.1672,20.408,-5.8976,.75,4.8,2.4,-.707107,0,0,.707107],[-71.1172,20.408,-9.9476,.75,4.8,2.4,-.707107,0,0,.707107],[-69.0922,22.809,4.2274,.75,4.8,2.4,-.5,.5,.5,.5],[-65.0422,22.809,.1774,.75,4.8,2.4,-.5,.5,.5,.5],[-73.1422,22.809,.1774,.75,4.8,2.4,-.5,.5,.5,.5],[-69.0922,22.809,-3.8726,.75,4.8,2.4,-.5,.5,.5,.5],[-77.1922,22.809,-3.8726,.75,4.8,2.4,-.5,.5,.5,.5],[-73.1422,22.809,-7.9226,.75,4.8,2.4,-.5,.5,.5,.5],[-71.1172,25.21,2.2024,.75,4.8,2.4,-.707107,0,0,.707107],[-67.0672,25.21,-1.8476,.75,4.8,2.4,-.707107,0,0,.707107],[-75.1672,25.21,-1.8476,.75,4.8,2.4,-.707107,0,0,.707107],[-71.1172,25.21,-5.8976,.75,4.8,2.4,-.707107,0,0,.707107],[-69.0922,27.611,.1774,.75,4.8,2.4,-.5,.5,.5,.5],[-73.1422,27.611,-3.8726,.75,4.8,2.4,-.5,.5,.5,.5],[-71.1172,30.012,-1.8476,.75,4.8,2.4,-.707107,0,0,.707107],[-97.4827,2.402,26.1232,.75,4.8,2.4,0,.707107,0,.707107],[-97.4827,2.402,24.6232,.75,4.8,2.4,0,.707107,0,.707107],[-97.4827,2.402,23.1232,.75,4.8,2.4,0,.707107,0,.707107],[-97.4827,2.402,21.6232,.75,4.8,2.4,0,.707107,0,.707107],[-97.4827,2.402,20.1232,.75,4.8,2.4,0,.707107,0,.707107],[-97.4827,2.402,18.6232,.75,4.8,2.4,0,.707107,0,.707107],[-97.4827,2.402,17.1232,.75,4.8,2.4,0,.707107,0,.707107],[-97.4827,2.402,15.6232,.75,4.8,2.4,0,.707107,0,.707107],[-97.4827,2.402,14.1232,.75,4.8,2.4,0,.707107,0,.707107],[-97.4827,2.402,12.6232,.75,4.8,2.4,0,.707107,0,.707107],[-97.4827,2.402,11.1232,.75,4.8,2.4,0,.707107,0,.707107],[-97.4827,2.402,9.6232,.75,4.8,2.4,0,.707107,0,.707107],[-97.4827,2.402,8.1232,.75,4.8,2.4,0,.707107,0,.707107],[-97.4827,2.402,6.6232,.75,4.8,2.4,0,.707107,0,.707107],[-97.4827,2.402,5.1232,.75,4.8,2.4,0,.707107,0,.707107],[-97.4827,2.402,3.6232,.75,4.8,2.4,0,.707107,0,.707107],[-97.4827,2.402,2.1232,.75,4.8,2.4,0,.707107,0,.707107],[-97.4827,2.402,.6232,.75,4.8,2.4,0,.707107,0,.707107],[-97.4827,2.402,-.8768,.75,4.8,2.4,0,.707107,0,.707107],[-97.4827,2.402,-2.3768,.75,4.8,2.4,0,.707107,0,.707107]]},ia={large:{halfExtents:[.085,.66,.3],mass:.34,friction:.66,spacing:.34},standard:{halfExtents:[.065,.52,.24],mass:.22,friction:.62,spacing:.26},small:{halfExtents:[.045,.34,.17],mass:.1,friction:.58,spacing:.2}},aa=[`straight-line`,`straight-double-line`,`curve`,`double-curve`,`split`,`double-split`,`field-starter`,`triangle`,`spiral`,`double-spiral`,`elegant-splitting`,`split-ends`,`small-triangles`],oa=ia.standard.halfExtents[2]*2.35,sa=8884635,ca=13382451,la=[23196,26288,30412,34536,37887],ua={minX:24.74,maxX:686.991,minY:87,maxY:504},da=ia.standard.halfExtents[2]*2/2.4,fa=ia.standard.halfExtents[1]*2/4.8,pa=ia.standard.halfExtents[1]*2/4.8,ma=new Y(1,0,0),ha=new Y(0,1,0),ga=new Y(0,0,1),_a=new Le,va=new Y,ya=new Y;function ba(e,t){return{x:e,z:t}}function xa(e,t,n){return e+(t-e)*n}function Sa(e,t,n){return{x:xa(e.x,t.x,n),z:xa(e.z,t.z,n)}}function Ca(e,t){return{x:e.x+t.x,z:e.z+t.z}}function wa(e,t){return{x:e.x*t,z:e.z*t}}function Ta(e){return Math.atan2(e.z,e.x)}function Ea(e,t){return e.x*t.x+e.z*t.z}function Da(e,t){let n=Math.cos(t),r=Math.sin(t);return{x:e.x*n-e.z*r,z:e.x*r+e.z*n}}function Oa(e){return typeof e==`number`?ba(e,e):e}function ka(e,t,n,r){let i=Oa(r),a=Da(ba(e.x*i.x,e.z*i.z),n);return{x:t.x+a.x,z:t.z+a.z}}function Aa(e,t){return Da(e,t)}function ja(e,t,n){return new Ze().setHSL(e,t,n).getHex()}function Ma(e,t,n=.78,r=.58){return i=>ja(xa(e,t,i),n,r)}function Na(e,t,n){return`${Math.round(e*20)}:${Math.round(t*20)}:${Math.round(n*10)}`}function Pa(e,t,n){let r=Math.hypot(t.x-e.x,t.z-e.z),i=Math.max(1,Math.ceil(r/n)),a=[];for(let n=0;n<=i;n++)a.push(Sa(e,t,n/i));return a}function Fa(e,t){return{minX:e.minX-t,maxX:e.maxX+t,minZ:e.minZ-t,maxZ:e.maxZ+t}}function Ia(e,t,n,r){let i=[ka(ba(e.minX,e.minZ),t,n,r),ka(ba(e.maxX,e.minZ),t,n,r),ka(ba(e.maxX,e.maxZ),t,n,r),ka(ba(e.minX,e.maxZ),t,n,r)],a=1/0,o=-1/0,s=1/0,c=-1/0;for(let e of i)a=Math.min(a,e.x),o=Math.max(o,e.x),s=Math.min(s,e.z),c=Math.max(c,e.z);return{minX:a,maxX:o,minZ:s,maxZ:c}}function La(e,t){let[n,r,i]=t,a=(e.x-r.x)*(n.y-r.y)-(n.x-r.x)*(e.y-r.y),o=(e.x-i.x)*(r.y-i.y)-(r.x-i.x)*(e.y-i.y),s=(e.x-n.x)*(i.y-n.y)-(i.x-n.x)*(e.y-n.y);return!((a<0||o<0||s<0)&&(a>0||o>0||s>0))}function Ra(e,t){let n={x:xa(ua.minX,ua.maxX,J.clamp(e,0,1)),y:xa(ua.minY,ua.maxY,J.clamp(t,0,1))},r=[{color:la[0],triangle:[{x:265.5,y:504},{x:24.74,y:87},{x:506.25,y:87}]},{color:la[1],triangle:[{x:506.26,y:87},{x:385.88,y:295.5},{x:626.64,y:295.498}]},{color:la[2],triangle:[{x:506.26,y:504},{x:385.88,y:295.5},{x:626.64,y:295.498}]},{color:la[3],triangle:[{x:626.63,y:295.5},{x:566.441,y:191.25},{x:686.991,y:191.25}]},{color:la[4],triangle:[{x:626.63,y:87.001},{x:566.441,y:191.251},{x:686.991,y:191.251}]}];for(let e of r)if(La(n,e.triangle))return e.color;return sa}function za(e,t=0){return({block:n,module:r})=>{let i=r.bounds.width>1e-6?(n.x-r.bounds.minX)/r.bounds.width:.5,a=J.clamp(i,0,1),o=r.bounds.depth>1e-6?(r.bounds.maxZ-n.z)/r.bounds.depth:.5,s=e>1?Math.round(J.clamp(o,0,1)*(e-1))/(e-1):.5;return a<=t?sa:Ra(1-(t<1?J.clamp((a-t)/(1-t),0,1):1),s)}}function Ba(e,t,n,r){if(e.length<2)return[];let i=ia[t],a=[],o=0,s=e[0],c=new Y;for(let l=1;l<e.length;l++){let u=e[l],d=u.x-s.x,f=u.z-s.z,p=Math.hypot(d,f);if(p<1e-6){s=u;continue}c.set(d/p,0,f/p);let m=o;for(;m<=p;){let e=m/p,o=xa(s.x,u.x,e),l=xa(s.z,u.z,e);_a.setFromUnitVectors(ma,c);let d=r.length+a.length;a.push({position:[o,i.halfExtents[1]+.002,l],quaternion:[_a.x,_a.y,_a.z,_a.w],variant:t,color:typeof n==`function`?n(d):n}),m+=i.spacing}o=m-p,s=u}return r.push(...a),a}function Va(e){let t=new Set,n=[];for(let r of e){let e=Na(r.position[0],r.position[2],r.position[1]);t.has(e)||(t.add(e),n.push(r))}return n}var Ha=na;function Ua(){let e={};for(let t of aa){let n=Ha.find(e=>e.slug===t),r=n?.top_extract?.blocks;if(!r||r.length===0)throw Error(`Missing extracted domino layout for technique: ${t}`);let i=r.map(e=>Math.max(e.w,e.h)).sort((e,t)=>e-t),a=oa/(i[Math.floor(i.length*.5)]??52),o=1/0,s=-1/0,c=1/0,l=-1/0;for(let e of r)o=Math.min(o,e.x),s=Math.max(s,e.x),c=Math.min(c,e.y),l=Math.max(l,e.y);let u=(o+s)*.5,d=(c+l)*.5,f=r.map(e=>({x:(e.x-u)*a,z:-(e.y-d)*a,yaw:J.degToRad(e.angle-90)})),p=1/0,m=-1/0,h=1/0,g=-1/0;for(let e of f)p=Math.min(p,e.x),m=Math.max(m,e.x),h=Math.min(h,e.z),g=Math.max(g,e.z);let _=new Set,v={},y=new Set;for(let e of n.connection_blocks??[]){if(typeof e==`number`){e>=0&&e<f.length&&y.add(e);continue}let t=0;e===`min_x`?t=o:e===`max_x`?t=s:e===`min_y`?t=c:e===`max_y`&&(t=l);for(let n=0;n<r.length;n++){let i=r[n],a=e===`min_x`||e===`max_x`?i.x:i.y;Math.abs(a-t)<=.001&&y.add(n)}}let b={};for(let e of y){_.add(e);let t=f[e],n=[[`west`,Math.abs(t.x-p)],[`east`,Math.abs(t.x-m)],[`north`,Math.abs(t.z-g)],[`south`,Math.abs(t.z-h)]];n.sort((e,t)=>e[1]-t[1]);let r=n[0]?.[0]??`north`;(b[r]??=[]).push(e)}let x={north:ba(0,1),south:ba(0,-1),east:ba(1,0),west:ba(-1,0)};for(let e of Object.keys(b)){let t=b[e]??[];if(t.length===0)continue;let n=0,r=0;for(let e of t)n+=f[e].x,r+=f[e].z;n/=t.length,r/=t.length,v[e]=[{position:ba(n,r),normal:x[e]}]}e[t]={slug:t,blocks:f,connectionBlockIndices:_,explicitConnectors:v,bounds:{minX:p,maxX:m,minZ:h,maxZ:g,width:m-p,depth:g-h}}}return e}var Wa=Ua();function Ga(e,t,n,r=1.15){let i=e.explicitConnectors[t];if(i&&i.length>0)return i.map(e=>({position:Ca(e.position,wa(e.normal,r)),normal:e.normal}));let a=t===`north`||t===`south`,o=t===`north`?e.bounds.maxZ:t===`south`?e.bounds.minZ:t===`east`?e.bounds.maxX:e.bounds.minX,s=Math.max(a?e.bounds.depth*.12:e.bounds.width*.12,.9),c=e.blocks.filter(e=>t===`north`?e.z>=o-s:t===`south`?e.z<=o+s:t===`east`?e.x>=o-s:e.x<=o+s);c.length===0&&(c=[...e.blocks]),c.sort((e,t)=>a?e.x-t.x:e.z-t.z);let l=t===`north`?ba(0,1):t===`south`?ba(0,-1):ba(t===`east`?1:-1,0),u=[];for(let i=0;i<n;i++){let a=Math.floor(i*c.length/n),o=Math.max(a+1,Math.floor((i+1)*c.length/n)),s=c.slice(a,o),d=0,f=0;for(let e of s)d+=e.x,f+=e.z;d/=s.length,f/=s.length,t===`north`&&(f=e.bounds.maxZ+r),t===`south`&&(f=e.bounds.minZ-r),t===`east`&&(d=e.bounds.maxX+r),t===`west`&&(d=e.bounds.minX-r),u.push({position:{x:d,z:f},normal:l})}return u}function Ka(e,t,n){let r=Wa[e],i=t.scale??1,a=t.rotation??0;for(let e=0;e<r.blocks.length;e++){let o=r.blocks[e],s=ka(o,t.origin,a,i);_a.setFromAxisAngle(new Y(0,1,0),o.yaw+a);let c=r.blocks.length<=1?0:e/(r.blocks.length-1);n.push({position:[s.x,ia[t.variant].halfExtents[1]+.002,s.z],quaternion:[_a.x,_a.y,_a.z,_a.w],variant:t.variant,color:r.connectionBlockIndices.has(e)?ca:t.blockColor?t.blockColor({block:o,module:r,index:e,normalizedT:c}):t.colorer(c)})}let o=ia[t.variant].spacing*2.2,s=Fa(Ia(r.bounds,t.origin,a,i),o),c=t.entry?(()=>{let e=Ga(r,t.entry.side,t.entry.groups,t.entry.offset)[0];return e?{position:ka(e.position,t.origin,a,i),normal:Aa(e.normal,a)}:null})():null,l=t.exits?Ga(r,t.exits.side,t.exits.groups,t.exits.offset).map(e=>({position:ka(e.position,t.origin,a,i),normal:Aa(e.normal,a)})):[];return l.sort((e,t)=>e.position.x-t.position.x||t.position.z-e.position.z),{entry:c,exits:l,reservedBounds:s}}function qa(e,t){let n=ia.large,r=ia.standard,i=ia.small;for(let a=5;a<Math.min(110,e.length);a+=4){let o=e[a];t.push({position:[o.position[0],n.halfExtents[1]*2+r.halfExtents[1]+.004,o.position[2]],quaternion:o.quaternion,variant:`standard`,color:o.color}),a%8==1&&t.push({position:[o.position[0],n.halfExtents[1]*2+r.halfExtents[1]*2+i.halfExtents[1]+.006,o.position[2]],quaternion:o.quaternion,variant:`small`,color:o.color})}}function Ja(e,t){let n=Wa[e];return Ga(n,t,1,0)[0]??{position:ba(0,0),normal:t===`north`?ba(0,1):t===`south`?ba(0,-1):ba(t===`east`?1:-1,0)}}function Ya(e,t,n,r,i){let a=Ja(e,t),o=Oa(i),s=Da(ba(a.position.x*o.x,a.position.z*o.z),r);return ba(n.x-s.x,n.z-s.z)}function Xa(e,t,n,r,i){let a=Ja(e,t);return{position:ka(a.position,n,r,i),normal:Aa(a.normal,r)}}function Za(e,t){let n=e[0],r=-1/0;for(let i of e){let e=Ea(i.normal,t);e>r&&(r=e,n=i)}return n}function Qa(e){return e===`north`?`south`:e===`south`?`north`:e===`east`?`west`:`east`}function $a(e,t,n,r=0){let i=Ja(e,t);return Ta(n)-Ta(i.normal)+r}function eo(e,t,n,r=0){let i=Ja(e,t);return Ta(wa(n,-1))-Ta(i.normal)+r}var to=ra;function no(e){return _a.set(e.quaternion[0],e.quaternion[1],e.quaternion[2],e.quaternion[3]).normalize()}function ro(e){let t=to[e]??[];if(t.length===0)throw Error(`Missing imported blender three-box data for ${e}`);let n=t.map(e=>({x:Number(e[0]??0),y:Number(e[1]??0),z:Number(e[2]??0),w:Number(e[3]??0),h:Number(e[4]??0),d:Number(e[5]??0),quaternion:[Number(e[6]??0),Number(e[7]??0),Number(e[8]??0),Number(e[9]??1)]})),r=1/0,i=-1/0,a=1/0,o=-1/0;for(let e of n){let t=no(e),n=e.w*.5,s=e.h*.5,c=e.d*.5;va.set(e.x,e.y,e.z);for(let e of[-1,1])for(let l of[-1,1])for(let u of[-1,1])ya.set(e*n,l*s,u*c).applyQuaternion(t).add(va),r=Math.min(r,ya.x),i=Math.max(i,ya.x),a=Math.min(a,ya.z),o=Math.max(o,ya.z)}let s=(r+i)*.5,c=(a+o)*.5;return n.map(e=>({...e,x:e.x-s,z:e.z-c}))}function io(e,t,n,r,i){let a=ro(e),o=new Le().setFromAxisAngle(ha,n);for(let e=0;e<a.length;e++){let s=a[e],c=a.length<=1?0:e/(a.length-1),l=ka(ba(s.x*pa,s.z*pa),t,n,1),u=new Le(s.quaternion[0],s.quaternion[1],s.quaternion[2],s.quaternion[3]).normalize(),d=o.clone().multiply(u),f=[s.w*pa*.5,s.h*pa*.5,s.d*pa*.5];i.push({position:[l.x,s.y*pa,l.z],quaternion:[d.x,d.y,d.z,d.w],variant:`standard`,halfExtents:f,color:r(c)})}}function ao(e,t,n,r){let i=Ha.find(e=>e.slug===`speed-wall`)?.three_boxes?.manual_boxes??[];if(i.length===0)throw Error(`Missing manual domino layout for speed-wall`);let a=[];for(let e of i){let t=Math.max(0,Math.floor(e.count??0)),n=Number(e.step_x_cm??0),r=Number(e.x_cm??0),i=Number(e.y_cm??0),o=Number(e.z_cm??0),s=e.pose===`flat`?`flat`:`upright`;for(let e=0;e<t;e++)a.push({xCm:r+e*n,yCm:i,zCm:o,pose:s})}let o=1/0,s=-1/0,c=1/0,l=-1/0;for(let e of a){let t=e.pose===`flat`?2.4:.375,n=(e.pose,1.2);o=Math.min(o,e.xCm-t),s=Math.max(s,e.xCm+t),c=Math.min(c,e.zCm-n),l=Math.max(l,e.zCm+n)}let u=(o+s)*.5,d=(c+l)*.5,f=new Le().setFromAxisAngle(ha,t),p=new Le,m=new Le().setFromAxisAngle(ga,-Math.PI*.5);for(let i=0;i<a.length;i++){let o=a[i],s=a.length<=1?0:i/(a.length-1),c=ka(ba((o.xCm-u)*da,(o.zCm-d)*da),e,t,1),l=o.pose===`flat`?m:p,h=f.clone().multiply(l);r.push({position:[c.x,o.yCm*fa,c.z],quaternion:[h.x,h.y,h.z,h.w],variant:`standard`,color:n(s)})}}function oo(e){let t=[],n=Ma(.02,.09,.8,.62),r=Ma(.56,.66,.76,.6),i=Ma(.12,.18,.74,.56);if(e===`advanced`)return io(`2d-pyramid`,ba(-32,2.5),0,n,t),ao(ba(0,10),Math.PI*.5,i,t),io(`3d-pyramid`,ba(30,2),0,r,t),Va(t);let a=Ma(.53,.58,.76,.6),o=Ma(.11,.16,.8,.62),s=Ma(.86,.96,.82,.6),c=Ma(.58,.7,.78,.6),l=Ma(.06,.1,.84,.64),u=(e,n,r)=>Ka(n,r,t),d=ia.standard.spacing*1.25,f=ba(0,14),p=1.14;u(`root-double-split`,`double-split`,{origin:f,rotation:0,scale:p,variant:`standard`,colorer:a});let m=Xa(`double-split`,`north`,f,0,p),h=Xa(`double-split`,`west`,f,0,p),g=Xa(`double-split`,`east`,f,0,p),_=Xa(`double-split`,`south`,f,0,p),v=1.1,y=Math.PI*.5,b=Ya(`straight-line`,`west`,Ca(m.position,wa(m.normal,d)),y,v);u(`starter-line`,`straight-line`,{origin:b,rotation:y,scale:v,variant:`large`,colorer:l});let x=Xa(`straight-line`,`east`,b,y,v);qa(Ba(Pa(Ca(x.position,wa(x.normal,ia.large.spacing*18)),x.position,.07),`large`,l,t),t);let S=1.28,C=Ya(`straight-line`,`east`,Ca(h.position,wa(h.normal,d)),0,S);u(`west-line`,`straight-line`,{origin:C,rotation:0,scale:S,variant:`standard`,colorer:o});let w=Xa(`straight-line`,`west`,C,0,S),T=1.28,E=Ya(`straight-line`,`west`,Ca(g.position,wa(g.normal,d)),0,T);u(`east-line`,`straight-line`,{origin:E,rotation:0,scale:T,variant:`standard`,colorer:o});let D=Xa(`straight-line`,`east`,E,0,T),O=.78,k=Math.PI*.5,A=Ya(`straight-line`,`east`,Ca(_.position,wa(_.normal,d)),k,O);u(`south-line`,`straight-line`,{origin:A,rotation:k,scale:O,variant:`standard`,colorer:o});let j=Xa(`straight-line`,`west`,A,k,O),M=.94,N=eo(`split`,`south`,j.normal,Math.PI*.5),P=[`west`,`east`,`north`,`south`],F=P.reduce((e,t)=>{let n=Ea(Aa(Ja(`split`,e).normal,N),ba(0,1));return Ea(Aa(Ja(`split`,t).normal,N),ba(0,1))>n?t:e},`west`),I=Qa(F),L=$a(`split`,F,ba(0,1)),R=Ya(`split`,F,Ca(j.position,wa(j.normal,d)),L,M);u(`south-split`,`split`,{origin:R,rotation:L,scale:M,variant:`standard`,colorer:o});let z={west:Xa(`split`,`west`,R,L,M),east:Xa(`split`,`east`,R,L,M),north:Xa(`split`,`north`,R,L,M),south:Xa(`split`,`south`,R,L,M)},B=P.filter(e=>e!==F&&e!==I).map(e=>z[e]),V=Za(B,ba(-1,0)),H=Za(B,ba(1,0)),ee=z[I],te=ia.standard.spacing*3,ne=1.14,re=eo(`spiral`,`east`,w.normal);u(`west-spiral`,`spiral`,{origin:Ya(`spiral`,`east`,Ca(w.position,wa(w.normal,d)),re,ne),rotation:re,scale:ne,variant:`small`,colorer:s});let U=1.14,ie=eo(`spiral`,`east`,D.normal);u(`east-spiral`,`spiral`,{origin:Ya(`spiral`,`east`,Ca(D.position,wa(D.normal,d)),ie,U),rotation:ie,scale:U,variant:`small`,colorer:c});let ae=1.08,oe=eo(`spiral`,`east`,V.normal);u(`south-branch-spiral`,`spiral`,{origin:Ya(`spiral`,`east`,Ca(V.position,wa(V.normal,te)),oe,ae),rotation:oe,scale:ae,variant:`small`,colorer:Ma(.28,.4,.76,.58)});let se=ba(1.42,.96),ce=eo(`triangle`,`west`,ee.normal);u(`south-logo-triangle`,`triangle`,{origin:Ya(`triangle`,`west`,Ca(ee.position,wa(ee.normal,te)),ce,se),rotation:ce,scale:se,variant:`standard`,colorer:()=>sa,blockColor:za(24,.44)});let le=1.08,ue=eo(`spiral`,`east`,H.normal);return u(`south-free-spiral`,`spiral`,{origin:Ya(`spiral`,`east`,Ca(H.position,wa(H.normal,te)),ue,le),rotation:ue,scale:le,variant:`small`,colorer:Ma(.72,.84,.78,.6)}),Va(t)}function so(e,t){let{scene:n,physics:r}=t,i=[],a=[];if(e===`advanced`){let e=[50.5,.5,50.5],t=[[-50,-e[1],-50],[50,-e[1],-50],[-50,-e[1],50],[50,-e[1],50]],a=Nn(n,r,{capacity:t.length,halfExtents:e,color:4805987,roughness:.85,metalness:.05,showOutline:!1,castShadow:!0,receiveShadow:!0});i.push(a);for(let n of t){let t=r.addBody({position:n,mass:0,halfExtents:e,lockRotation:!0});a.addBody(t)}}let o=oo(e),s=Nn(n,r,{capacity:Math.max(o.length,1),perInstance:!0,color:sa,roughness:.68,metalness:.02,showOutline:!1,castShadow:!0,receiveShadow:!0});i.push(s);for(let e of o){let t=ia[e.variant],n=e.halfExtents??t.halfExtents,i=ia.standard.halfExtents[0]*2*ia.standard.halfExtents[1]*2*ia.standard.halfExtents[2]*2,a=n[0]*2*n[1]*2*n[2]*2,o=r.addBody({position:e.position,halfExtents:n,quaternion:e.quaternion,mass:t.mass*(a/i),friction:t.friction});s.addBody(o,{halfExtents:n,color:e.color})}return console.log(`[DominoDemo] built ${o.length} dominoes with technique grammar (${e}).`),{trackedVisualSets:i,trackedSpringVisualSets:a,dominoCount:o.length}}function co(e){return so(`base`,e)}function lo(e){return so(`advanced`,e)}var uo=8,fo=255,po=1/0,mo=[-30,-15,0,15,30],ho=[.24,.24,1],go=[2.75,.18,1.35],_o=[.18,2.75,1.35],vo=.08,yo=[.12,.48,.12],bo=[.1,.42,.1],xo=[5.4,.22,.8],So=[.3,3.4,2.2],Co=1;function wo(e,t){let n=new Y(e[0],e[1],e[2]);return n.applyQuaternion(new Le(t[0],t[1],t[2],t[3])),[n.x,n.y,n.z]}function To(e){let{scene:t,physics:n,addStaticBoxWithVisual:r}=e,i=[],a=[],o=Nn(t,n,{capacity:8,halfExtents:ho,color:9873078,roughness:.42,metalness:.22}),s=Nn(t,n,{capacity:2,halfExtents:go,color:13598023,roughness:.72,metalness:.05}),c=Nn(t,n,{capacity:2,halfExtents:_o,color:14919782,roughness:.72,metalness:.05}),l=Nn(t,n,{capacity:48,halfExtents:yo,color:12174803,roughness:.46,metalness:.28}),u=Nn(t,n,{capacity:40,halfExtents:bo,color:11450823,roughness:.48,metalness:.24}),d=Nn(t,n,{capacity:1,halfExtents:xo,color:8085061,roughness:.84,metalness:.05}),f=Nn(t,n,{capacity:1,halfExtents:So,color:7177575,roughness:.82,metalness:.04}),p=Nn(t,n,{capacity:2,geometry:new nt(Co,28,18),color:13475171,roughness:.7,metalness:.08});i.push(o,s,c,l,u,d,f,p);let m=(e,t,r,i)=>{let a=n.addBody({position:e,halfExtents:t,mass:i.mass,quaternion:i.quaternion,friction:i.friction??.75,collisionGroup:uo,collisionMask:fo});return r.addBody(a),a},h=(e,t,r,i)=>{let a=n.addBody({position:e,shapeType:`sphere`,radius:t,mass:i.mass,friction:i.friction??.75,collisionGroup:uo,collisionMask:fo});return r.addBody(a),a},g=(e,t,r)=>{let i=m(e,ho,o,{mass:r,quaternion:t,friction:.58}),a=wo([0,0,-ho[2]],t),s=wo([0,0,ho[2]],t);return n.addSphericalJoint(null,i,[e[0]+a[0],e[1]+a[1],e[2]+a[2]],[0,0,-ho[2]],po,!0),n.addSphericalJoint(null,i,[e[0]+s[0],e[1]+s[1],e[2]+s[2]],[0,0,ho[2]],po,!0),i},_=(e,t,r,i,a)=>{let o=null,s=e,c=-1,l=[0,r[1],0];for(let u=0;u<t;u++){let t=e[1]-(u+.5)*r[1]*2,d=m([e[0],t,e[2]],r,i,{mass:a,friction:.5});n.addSphericalJoint(o,d,s,[0,-r[1],0],po,!0),o=d,s=[0,r[1],0],c=d,l=s}return{lastBody:c,lastAnchor:l}};for(let e of mo)r([e,.15,0],[6.5,.15,6.5],{color:5398381});{let e=mo[0];r([e,3.3,-2.6],[.5,3.3,.5],{color:6714757}),r([e,6.8,-2.05],[.28,.28,.52],{color:7635601});let t=g([e,6.8,0],[0,0,0,1],2.4),i=ho[0]+go[0]+vo,a=ho[1]+_o[1]+vo,o=m([e-i,6.8,0],go,s,{mass:1.6,friction:.56}),l=m([e+i,6.8,0],go,s,{mass:1.6,friction:.56}),u=m([e,6.8-a,0],_o,c,{mass:1.6,friction:.56}),d=m([e,6.8+a,0],_o,c,{mass:1.6,friction:.56});n.addFixedJoint(t,o,[-ho[0],0,0],[go[0],0,0],po,!0),n.addFixedJoint(t,l,[ho[0],0,0],[-go[0],0,0],po,!0),n.addFixedJoint(t,u,[0,-ho[1],0],[0,_o[1],0],po,!0),n.addFixedJoint(t,d,[0,ho[1],0],[0,-_o[1],0],po,!0)}{let e=mo[1];r([e-2.8,5.7,0],[.24,5.7,.24],{color:6911364}),r([e+2.8,5.7,0],[.24,5.7,.24],{color:6911364}),r([e,11.2,0],[3.1,.18,2.5],{color:8030103});for(let t of[-2.3,2.3]){let r=_([e,10.9,t],4,yo,l,.24),i=h([e,6,t],Co,p,{mass:4.5,friction:.62});n.addSphericalJoint(r.lastBody,i,r.lastAnchor,[0,Co,0],po,!0)}}{let e=mo[2];r([e,1.2,0],[1.2,1.2,1.2],{color:6977156});let t=g([e,3.3,0],[0,0,0,1],2.1),i=m([e,3.3,0],xo,d,{mass:3,friction:.68});n.addFixedJoint(t,i,[0,0,0],[0,0,0],po,!0)}{let e=mo[3];r([e-2.8,5.5,0],[.22,5.5,.22],{color:6713985}),r([e+2.8,5.5,0],[.22,5.5,.22],{color:6713985}),r([e,10.8,0],[3,.16,2.4],{color:7898260});for(let t of[-2.2,-1.1,0,1.1,2.2])_([e,10.5,t],6,bo,u,.12)}{let e=mo[4];r([e-2.2,5.4,0],[.22,5.4,.22],{color:6713985}),r([e+2.2,5.4,0],[.22,5.4,.22],{color:6713985}),r([e,10.6,0],[2.5,.16,.22],{color:8030103});let t=10.1,i=g([e,t,0],[0,0,0,1],1.6),a=m([e,t-So[1]-.25,0],So,f,{mass:2.6,friction:.62});n.addFixedJoint(i,a,[0,-.25,0],[0,So[1],0],po,!0)}return{trackedVisualSets:i,trackedSpringVisualSets:a}}var Eo=.18,Do=.16,Oo=.48,ko=.06,Ao=.05,jo=.7,Mo=.06,No=3e5,Po=[{ballCount:3,centerX:-18,centerZ:14,beamY:12.8,ballRadius:.74,stringLength:5,pullCount:1,pullAngleDeg:48,ballColor:8701439,frameColor:7045014},{ballCount:7,centerX:16.5,centerZ:14,beamY:12.1,ballRadius:.56,stringLength:4.5,pullCount:1,pullAngleDeg:46,ballColor:8577189,frameColor:7113594},{ballCount:25,centerX:0,centerZ:2.2,beamY:11,ballRadius:.34,stringLength:4.1,pullCount:1,pullAngleDeg:42,ballColor:16167546,frameColor:9468012},{ballCount:100,centerX:0,centerZ:-14.5,beamY:9.6,ballRadius:.18,stringLength:3.25,pullCount:1,pullAngleDeg:38,ballColor:15835351,frameColor:9071750}];function Fo(e){return 4/3*Math.PI*e*e*e*14}function Io(e){return new nt(e,e>=.5?24:e>=.3?20:16,e>=.5?18:e>=.3?16:12)}function Lo(e,t,n,r,i,a,o,s,c,l){let u=Math.sin(s)*o,d=Math.max(a*1.55,c*1.35),f=i+u+c*1.35,p=[f-Eo+ko,Math.max(.1,c*.16),Math.max(.1,c*.16)],m=[Eo,r*.5,Math.max(.1,c*.16)],h=[c*1.05,Do,Oo];e([t,r,n-d],p,{color:l}),e([t,r,n+d],p,{color:l}),e([t-f,r*.5,n-d],m,{color:l}),e([t-f,r*.5,n+d],m,{color:l}),e([t+f,r*.5,n-d],m,{color:l}),e([t+f,r*.5,n+d],m,{color:l}),e([t-f,h[1],n-d],h,{color:l}),e([t-f,h[1],n+d],h,{color:l}),e([t+f,h[1],n-d],h,{color:l}),e([t+f,h[1],n+d],h,{color:l})}function Ro(e){let{scene:t,physics:n,addStaticBoxWithVisual:r}=e,i=[],a=[];for(let e of Po){let o=e.ballRadius*Ao,s=e.ballRadius*2+o,c=s*(e.ballCount-1)*.5+e.ballRadius,l=e.ballRadius*jo,u=e.centerX-s*(e.ballCount-1)*.5,d=J.degToRad(e.pullAngleDeg);Lo(r,e.centerX,e.centerZ,e.beamY,c,l,e.stringLength,d,e.ballRadius,e.frameColor);let f=Nn(t,n,{capacity:e.ballCount,geometry:Io(e.ballRadius),color:e.ballColor,roughness:.24,metalness:.72,outlineScale:1.01,showOutline:!1});i.push(f);let p=Wn(t,{capacity:e.ballCount*2,color:15068662,radius:Math.max(.014,e.ballRadius*.06)});a.push(p);for(let t=0;t<e.ballCount;t++){let r=u+s*t,i=t<e.pullCount,a=i?-Math.sin(d)*e.stringLength:0,o=i?e.stringLength*(1-Math.cos(d)):0,c=[r+a,e.beamY-e.stringLength+o,e.centerZ],m=n.addBody({position:c,shapeType:`sphere`,radius:e.ballRadius,mass:Fo(e.ballRadius),friction:Mo});f.addBody(m);for(let t of[-1,1]){let i=n.addSpring(null,m,[r,e.beamY,e.centerZ+t*l],[0,0,t*l],No,e.stringLength);p.addSpring(i)}}}return{trackedVisualSets:i,trackedSpringVisualSets:a}}var zo=4,Bo=.05,Vo=1.03,Ho=10,Uo=13,Wo=Ho*Uo,Go=-52,Ko=72,qo=28,Jo=2,Yo=-15,Xo=0,Zo=24,Qo=1.1,$o=31,es=.31,ts=[2.1,.42,7.5],ns=[1.6,.34,3.2],rs=[1.35,.92,8.4],is=[1.25,.34,4.2],as=[{run:34,drop:8.8,color:5792624},{run:15,drop:12.8,color:5266279},{run:14,drop:8,color:5990004},{run:18,drop:13,color:5333099},{run:15,drop:7.5,color:6056055},{run:17,drop:12.5,color:5464173},{run:20,drop:6.5,color:6253948}];function os(e){let t=Math.sin(e*12.9898+78.233)*43758.5453123;return t-Math.floor(t)}function ss(e,t,n){let r=new Le().setFromEuler(new st(e,t,n,`XYZ`));return[r.x,r.y,r.z,r.w]}function cs(e,t,n){let r=new tt().makeBasis(e.clone().normalize(),t.clone().normalize(),n.clone().normalize()),i=new Le().setFromRotationMatrix(r);return[i.x,i.y,i.z,i.w]}function ls(e,t){let n=new Le(e[0],e[1],e[2],e[3]),r=new Le(t[0],t[1],t[2],t[3]);return n.multiply(r),[n.x,n.y,n.z,n.w]}function us(e,t){let n=new Y(e[0],e[1],e[2]);return n.applyQuaternion(new Le(t[0],t[1],t[2],t[3])),[n.x,n.y,n.z]}function ds(){let e=[],t=Go,n=Ko;for(let r of as){let i=t+r.run,a=n-r.drop;e.push({...r,startX:t,endX:i,startY:n,endY:a,angle:Math.atan2(r.drop,r.run),slopeLength:Math.hypot(r.run,r.drop)}),t=i,n=a}return e}function fs(e,t){let n=e[0];if(t<=n.startX)return n.startY;for(let n of e)if(t<=n.endX){let e=(t-n.startX)/Math.max(n.run,1e-6);return n.startY+(n.endY-n.startY)*e}return e[e.length-1].endY}function ps(e){let{scene:t,physics:n,addStaticBoxWithVisual:r}=e,i=[],a=Nr({scene:t,physics:n,totalRagdolls:Wo,collisionGroup:zo,collisionMask:13,colorBucketCount:32,scale:Vo,defaultPose:`standing`}),o=ds();o[o.length-1].endX-o[0].startX,(o[0].startX+o[o.length-1].endX)*.5;let s=o[0].startY;o[o.length-1].endY;for(let e of o){let t=ss(0,0,-e.angle),n=[e.startX+e.run*.5,e.startY-e.drop*.5,0],i=us([0,Jo,0],t);r([n[0]-i[0],n[1]-i[1],0],[e.slopeLength*.5,Jo,qo],{quaternion:t,color:e.color,friction:Bo})}r([o[0].startX-.9,s*.5+2,0],[.65,s*.5+2.4,29.2],{color:5595245});let c=o[o.length-1],l=c.endX,u=c.endY,d=Zo,f=Math.tan(es)*d,p=Math.hypot(d,f),m=[l+d*.5,u+f*.5,0],h=ss(0,0,es),g=us([0,Qo,0],h);r([m[0]-g[0],m[1]-g[1],0],[p*.5,Qo,$o],{quaternion:h,color:7570064,friction:Bo});for(let e=1;e<o.length-1;e++){let t=o[e],n=t.startX+t.run*(e%2==0?.34:.62),i=fs(o,n),a=Yo+(e%2==0?3.4:-3.2),s=e%2==0?.48:-.48,c=e%2==0?.1:-.1;r([n,i+.42,a],ts,{quaternion:ss(0,s,c),color:8019282,friction:Bo});let l=t.startX+t.run*(e%2==0?.7:.28);r([l,fs(o,l)+.38,Yo-(e%2==0?1.6:-1.8)],[1.5,.38,5.8],{quaternion:ss(0,e%2==0?-.38:.38,e%2==0?-.08:.08),color:7428426,friction:Bo});let u=t.startX+t.run*(e%2==0?.24:.76);r([u,fs(o,u)+.34,Yo+(e%2==0?5.2:-5)],ns,{quaternion:ss(0,e%2==0?.18:-.18,e%2==0?-.24:.24),color:7101005,friction:Bo});let d=t.startX+t.run*(e%2==0?.78:.22);r([d,fs(o,d)+.34,Yo+(e%2==0?-.4:.6)],[1.25,.3,2.4],{quaternion:ss(0,e%2==0?-.12:.12,e%2==0?.22:-.22),color:8414804,friction:Bo});let f=t.startX+t.run*(e%2==0?.48:.56),p=fs(o,f),m=Xo+(e%2==0?3.9:-3.9),h=cs(new Y(t.run,-t.drop,0).normalize(),new Y(Math.sin(t.angle),Math.cos(t.angle),0).normalize(),new Y(0,0,1)),g=ls(h,ss(0,e%2==0?.56:-.56,0)),_=us([0,rs[1],0],g);r([f+_[0],p+_[1],m+_[2]],rs,{quaternion:g,color:9071704,friction:Bo});let v=t.startX+t.run*(e%2==0?.76:.26),y=fs(o,v),b=ls(h,ss(0,e%2==0?-.22:.22,0)),x=us([0,is[1],0],b);r([v+x[0],y+x[1],Xo+(e%2==0?-6.2:6.2)+x[2]],is,{quaternion:b,color:8217679,friction:Bo})}let _=Vo/.65,v=1.35*_,y=1.28*_,b=o[0].startX+2.4,x=1.18*_,S=0;for(let e=0;e<Uo;e++)for(let t=0;t<Ho;t++){let n=os(S*13.1+.3),r=os(S*17.7+1.9),i=os(S*23.3+5.1),s=b+e*v+(n-.5)*.16,c=fs(o,s)+x+r*.16,l=-9.127384615384615+t*y+(i-.5)*.14,u=(os(S*29.9+7)-.5)*.8,d=(os(S*31.1+9)-.5)*.16,f=(os(S*37.7+11)-.5)*.1,p=.7+os(S*41.3+3)*.35,m=(os(S*43.7+13)-.5)*.18;a.addRagdoll({index:S,rootPosition:[s,c,l],rootQuaternion:ss(d,u,f),linearVelocity:[p,0,m]}),S++}return{trackedVisualSets:a.trackedVisualSets,trackedSpringVisualSets:i}}var ms=4,hs=8,gs=!0,_s=14,vs=3.7,ys=[{y:_s-vs*2,innerRadius:.72,armLength:7.2,seats:16},{y:_s-vs*1,innerRadius:.72,armLength:6.5,seats:14},{y:14,innerRadius:.72,armLength:5.8,seats:12},{y:17.7,innerRadius:.72,armLength:5.1,seats:10},{y:21.4,innerRadius:.72,armLength:4.4,seats:8},{y:25.1,innerRadius:.72,armLength:3.8,seats:6}],bs=ys.reduce((e,t)=>e+t.seats,0),xs=[1.16,.11,1.16],Ss=[1,.1,.16],Cs=[.28,.05,.12],ws=[.05,.24,.05],Ts=[.52,.08,.42],Es=[.52,.44,.06],Ds=[.05,.42,.3],Os=4,ks=1/0,As=.12,js=Os*ws[1]*2,Ms=Ts[1]+Es[1],Ns=Ts[1]+Ds[1],Ps=.28,Fs=.02,Is=.34,Ls=.26,Rs=.22,zs=3.5,Bs=2,Vs=1,Hs=.74,Us=1.9,Ws=0,Gs=10,Ks=2.2,qs=1.2,Js=3,Ys=15;function Xs(){let e=Math.hypot(Es[0]-Fs-As,-.12),t=Math.hypot(Ts[0]-Ds[0]-As,Ds[2]-Fs-Ps),n=Math.sqrt(Math.max(0,js*js-e*e)),r=Math.sqrt(Math.max(0,js*js-t*t)),i=n- -Cs[1]+(Ms+Es[1]-Fs),a=r- -Cs[1]+(Ns+Ds[1]-Fs);return Math.max(i,a)+.02}function Zs(e){let t=e.innerRadius+e.armLength-.06,n=xs[0]-Is,r=t+Ls;return{ropeAnchorRadius:t,beamHalfExtents:[(r-n)*.5,Ss[1],Ss[2]],beamCenterRadius:(n+r)*.5}}function Qs(e,t,n){let r=new tt().makeBasis(e.clone().normalize(),t.clone().normalize(),n.clone().normalize()),i=new Le().setFromRotationMatrix(r).normalize();return[i.x,i.y,i.z,i.w]}function $s(e){let{scene:t,physics:n,addStaticBoxWithVisual:r,addStaticCylinderWithVisual:i}=e,a=new Ue;a.visible=gs,t.add(a);let o=[],s=[],c=[],l=Nn(a,n,{capacity:bs*Os*4,halfExtents:ws,color:13226717,roughness:.46,metalness:.3}),u=Nn(a,n,{capacity:bs,halfExtents:Ts,color:3112861,roughness:.78,metalness:.06}),d=Nn(a,n,{capacity:bs,halfExtents:Es,color:4103873,roughness:.74,metalness:.06}),f=Nn(a,n,{capacity:bs*2,halfExtents:Ds,color:4103873,roughness:.74,metalness:.06}),p=Nn(a,n,{capacity:bs*2,halfExtents:Cs,color:13743706,roughness:.52,metalness:.14});l&&u&&d&&f&&p&&o.push(l,p,u,d,f);let m=Nr({scene:t,physics:n,totalRagdolls:bs,collisionGroup:ms,collisionMask:13,colorBucketCount:18,scale:Hs,defaultPose:`seated`});o.push(...m.trackedVisualSets);let h=(e,t,r,i)=>{let a=n.addBody({position:e,halfExtents:t,quaternion:i.quaternion,mass:i.mass,friction:i.friction??.75,collisionGroup:hs,collisionMask:5,lockRotation:i.lockRotation});return r.addBody(a),a};r([0,12.9,0],[.65,12.9,.65],{color:7306119}),r([0,27,0],[2.2,.4,2.2],{color:9279908}),r([0,.9,0],[3.4,.9,3.4],{color:5990002});for(let e of ys)i([0,e.y,0],xs[0],xs[1],{color:15124335});let g=[],_=0;for(let e of ys){let t=Zs(e),r=Nn(a,n,{capacity:e.seats,halfExtents:t.beamHalfExtents,color:15124335,roughness:.54,metalness:.18});r&&o.push(r);let i=Math.PI*2/e.seats,{ropeAnchorRadius:s,beamHalfExtents:v,beamCenterRadius:y}=t;for(let t=0;t<e.seats;t++){let a=t*i,o=new Y(Math.cos(a),0,Math.sin(a)),b=new Y(-Math.sin(a),0,Math.cos(a)),x=new Y(0,1,0),S=new Y(o.x*s,e.y-v[1],o.z*s),C=Xs(),w=S.clone().addScaledVector(x,-C),T=Qs(o,x,b);{let i=Qs(o,x,b),m=new Y(o.x*y,e.y,o.z*y),_=h([m.x,e.y,m.z],v,r,{mass:0,quaternion:i,lockRotation:!0});g.push({body:_,radialOffset:y,tangentOffset:0,y:e.y,angleOffset:a});let C=h([w.x,w.y,w.z],Ts,u,{mass:zs,quaternion:T,friction:.74}),E=w.clone().addScaledVector(x,Ms).addScaledVector(b,-.36),D=h([E.x,E.y,E.z],Es,d,{mass:Bs,quaternion:T,friction:.74});n.addFixedJoint(C,D,[0,Ms,-.36],[0,0,0],1/0,!0);let O={[-1]:-1,1:-1};for(let e of[-1,1]){let t=w.clone().addScaledVector(x,Ns).addScaledVector(o,e*(Ts[0]-Ds[0])),r=h([t.x,t.y,t.z],Ds,f,{mass:Vs,quaternion:T,friction:.74});O[e]=r,n.addFixedJoint(C,r,[e*(Ts[0]-Ds[0]),Ns,0],[0,0,0],1/0,!0)}let k=e.y-v[1]-Cs[1],A=S.clone().setY(k).addScaledVector(b,-.24),j=S.clone().setY(k).addScaledVector(b,Ps),M=T,N=h([A.x,A.y,A.z],Cs,p,{mass:0,quaternion:M,lockRotation:!0}),P=h([j.x,j.y,j.z],Cs,p,{mass:0,quaternion:M,lockRotation:!0});g.push({body:N,radialOffset:s,tangentOffset:-.24,y:k,angleOffset:a},{body:P,radialOffset:s,tangentOffset:Ps,y:k,angleOffset:a});let F=[{topBody:N,topAnchor:[-.12,0,0],body:D,localAnchor:[-(Es[0]-Fs),Es[1]-Fs,0]},{topBody:N,topAnchor:[As,0,0],body:D,localAnchor:[Es[0]-Fs,Es[1]-Fs,0]},{topBody:P,topAnchor:[-.12,0,0],body:O[-1],localAnchor:[0,Ds[1]-Fs,Ds[2]-Fs]},{topBody:P,topAnchor:[As,0,0],body:O[1],localAnchor:[0,Ds[1]-Fs,Ds[2]-Fs]}];for(let r of F){let i=new Y(w.x,w.y,w.z);if(r.body===D)i.addScaledVector(x,Ms).addScaledVector(b,-.36).addScaledVector(o,r.localAnchor[0]).addScaledVector(x,r.localAnchor[1]);else{let e=r.body===O[-1]?-1:1;i.addScaledVector(x,Ns).addScaledVector(o,e*(Ts[0]-Ds[0])).addScaledVector(x,r.localAnchor[1]).addScaledVector(b,r.localAnchor[2])}let a=(r.topBody===N?A:j).clone().addScaledVector(o,r.topAnchor[0]),s=i.clone().sub(a).normalize(),u=o.clone().normalize(),d=Qs(u,s,u.clone().cross(s).normalize()),f=r.topBody,p=r.topAnchor;for(let o=0;o<Os;o++){let s=(o+.5)/Os,u=a.clone().lerp(i,s),m=h([u.x,u.y,u.z],ws,l,{mass:Rs,friction:.55,quaternion:d}),g=n.addSphericalJoint(f,m,p,[0,-ws[1],0],ks,!0);o===0&&c.push({joint:g,label:`L${ys.indexOf(e)}-S${t}-${r.topBody===N?`rear`:`front`}-${r.topAnchor[0]<0?`left`:`right`}`,bodyA:f,bodyB:m,anchorA:p,anchorB:[0,-ws[1],0]}),f=m,p=[0,ws[1],0]}n.addSphericalJoint(f,r.body,p,r.localAnchor,ks,!0)}}let E=w.clone().addScaledVector(x,.62).addScaledVector(b,.04864000000000002);m.addRagdoll({index:_,rootPosition:[E.x,E.y,E.z],linearVelocity:[0,0,0],rootQuaternion:T,pose:`seated`}),_++}}let v=0,y=Ws,b=`accelerating`,x=0,S=Math.max(...ys.map(e=>e.innerRadius+e.armLength-.06)),C=Ys/(S*3.6),w=Math.min(Us,C);return{trackedVisualSets:o,trackedSpringVisualSets:s,diagnostics:{joints:c},getStatusText(){let e=S*y*3.6,t=S*w*3.6;if(b===`accelerating`){let n=Math.max(1,Math.ceil(Gs-x));return`Carousel: chair going ${e.toFixed(0)} km/h, accelerating to ${t.toFixed(0)} km/h in ${n}s`}if(b===`braking`){let n=Math.max(1,Math.ceil(qs-x));return`Carousel: chair going ${e.toFixed(0)} km/h, braking from ${t.toFixed(0)} km/h for ${n}s`}return`Carousel has stopped. Restarting in ${Math.max(1,Math.ceil(Js-x))}s`},update(e){if(x+=e,b===`accelerating`){let e=Math.min(x/Gs,1);y=w*e**+Ks,x>=Gs&&(b=`braking`,x=0)}else if(b===`braking`){let e=Math.min(x/qs,1);y=w*(1-e),x>=qs&&(b=`stopped`,x=0,y=0)}else y=0,x>=Js&&(b=`accelerating`,x=0,y=Ws,w=Math.min(Us,w+C));v+=y*e;for(let e of g){let t=v+e.angleOffset,r=new Y(Math.cos(t),0,Math.sin(t)),i=new Y(-Math.sin(t),0,Math.cos(t)),a=new Y(0,1,0),o=r.clone().multiplyScalar(e.radialOffset).addScaledVector(i,e.tangentOffset),s=i.clone().multiplyScalar(y*e.radialOffset).addScaledVector(r,-y*e.tangentOffset),c=Qs(r,a,i);n.setBodyPose(e.body,[o.x,e.y,o.z],c,[s.x,s.y,s.z],[0,y,0])}}}}var ec=1,tc=2,nc=4,rc=44,ic=32,ac=.42,oc=9.25,sc=.16,cc=[.31,.11,.31],lc=6400,uc=2400,dc=1600,fc=100,pc=10,mc=10;function hc(e){let{scene:t,physics:n,addStaticBoxWithVisual:r}=e,i=[],a=Xn({scene:t,physics:n,addStaticBoxWithVisual:r,worldCollisionGroup:ec,worldCollisionMask:7,clothCollisionGroup:tc,clothCollisionMask:5,dims:{cols:rc,rows:ic,nodeSpacing:ac},clothY:oc,nodeHalfExtents:cc,nodeMass:sc,structuralStiffness:lc,shearStiffness:uc,bendingStiffness:dc,clothColor:9421557,clothRenderSubdivisions:4,drivenCorners:!1,supportMode:`boundary`}),o=a.clothWidth,s=a.clothDepth,c=Nr({scene:t,physics:n,totalRagdolls:fc,collisionGroup:nc,collisionMask:7}),l=Math.max(1,o-1.8*2),u=Math.max(1,s-1.6*2),d=l/Math.max(1,pc-1),f=u/Math.max(1,mc-1),p=-l*.5,m=-u*.5,h=[];for(let e=0;e<mc;e++)for(let t=0;t<pc;t++){let n=(e*pc+t)%5,r=(t%2==0?-1:1)*(.04+e%3*.02),i=(e%2==0?1:-1)*(.03+t%4*.015);h.push({position:[p+t*d,15.45+n*1.05+(t+e)%3*.24,m+e*f],velocity:[r,0,i]})}return h.forEach((e,t)=>{c.addRagdoll({index:t,rootPosition:e.position,linearVelocity:e.velocity})}),{trackedVisualSets:c.trackedVisualSets,trackedSpringVisualSets:i,syncedVisuals:a.syncedVisuals,update:a.update,reset:a.reset}}var gc=64;function _c(e){return Number.isInteger(e)?`${e}.0`:`${e}`}function vc(e,t,n){let r=n.knots,i=r.length;if(i<2)throw Error(`Rope tube needs at least two knots`);let o=Math.max(3,n.radialSegments??10),s=Math.max(1,n.segmentsPerSpan??6),c=n.strands??3,u=n.layDepth??.17,d=n.layTurnsPerSpan??.5,f=n.capStart??!0,m=n.capEnd??!0,h=i-1,_=h*s+1,v=_*o,b=[];for(let e=0;e<_-1;e++)for(let t=0;t<o;t++){let n=(t+1)%o,r=e*o+t,i=e*o+n,a=(e+1)*o+t,s=(e+1)*o+n;b.push(r,i,s),b.push(r,s,a)}let x=new Float32Array(i*8);for(let e=0;e<i;e++){let t=r[e];x[e*8+0]=t.bodyA,x[e*8+1]=t.offsetA[0],x[e*8+2]=t.offsetA[1],x[e*8+3]=t.offsetA[2],x[e*8+4]=t.bodyB??-1,x[e*8+5]=t.offsetB?.[0]??0,x[e*8+6]=t.offsetB?.[1]??0,x[e*8+7]=t.offsetB?.[2]??0}let S=new q(x,4),C=new q(new Float32Array(i*4),4),w=new q(new Float32Array(i*4),4),T=new q(new Float32Array(v*4),4),E=new q(new Float32Array(v*4),4),D=new Be;D.setAttribute(`position`,new ot(new Float32Array(v*3),3)),D.setIndex(b),D.boundingSphere=new Pe(new Y,1e4);let O=new Xe;O.color.setHex(n.color),O.roughness=n.roughness??.85,O.metalness=n.metalness??0;let k=Z(T,`vec4`,v).toReadOnly(),A=Z(E,`vec4`,v).toReadOnly();O.positionNode=k.element(g).xyz,O.normalNode=y(a(A.element(g).xyz).normalize(),`vRopeTubeNormalView`);let j=new Qe(D,O);j.frustumCulled=!1,j.visible=!1,e.add(j);let M=null,N=null,P=null,F=e=>{let r=e.getRenderBuffers();if(!r)return!1;M=l(`
      fn compute(
        positions: ptr<storage, array<vec4f>, read>,
        quaternions: ptr<storage, array<vec4f>, read>,
        knotSpecs: ptr<storage, array<vec4f>, read>,
        outKnotPos: ptr<storage, array<vec4f>, read_write>,
        workgroupId: vec3u,
        localId: vec3u,
      ) -> void {
        let gid = workgroupId.x * ${gc}u + localId.x;
        if (gid >= ${i}u) { return; }

        let specA = knotSpecs[gid * 2u];
        let specB = knotSpecs[gid * 2u + 1u];

        let ia = u32(specA.x);
        let qa = quaternions[ia];
        let ta = cross(qa.xyz, specA.yzw) * 2.0;
        var point = positions[ia].xyz + specA.yzw + ta * qa.w + cross(qa.xyz, ta);

        if (specB.x >= 0.0) {
          let ib = u32(specB.x);
          let qb = quaternions[ib];
          let tb = cross(qb.xyz, specB.yzw) * 2.0;
          let pointB = positions[ib].xyz + specB.yzw + tb * qb.w + cross(qb.xyz, tb);
          point = (point + pointB) * 0.5;
        }

        outKnotPos[gid] = vec4f(point, 0.0);
      }
    `)({positions:Z(r.positions,`vec4f`,t.config.maxBodies).toReadOnly(),quaternions:Z(r.quaternions,`vec4f`,t.config.maxBodies).toReadOnly(),knotSpecs:Z(S,`vec4f`,i*2).toReadOnly(),outKnotPos:Z(C,`vec4f`,i),workgroupId:p,localId:W}).computeKernel([gc,1,1]).setName(`Rope Knot Resolve`),N=l(`
      fn compute(
        knotPos: ptr<storage, array<vec4f>, read>,
        outKnotFrame: ptr<storage, array<vec4f>, read_write>,
        workgroupId: vec3u,
        localId: vec3u,
      ) -> void {
        if (workgroupId.x != 0u || localId.x != 0u) { return; }

        let count = ${i}u;
        var tangentPrev = normalize(knotPos[1u].xyz - knotPos[0u].xyz);
        let seedAxis = select(vec3f(0.0, 1.0, 0.0), vec3f(1.0, 0.0, 0.0), abs(tangentPrev.y) > 0.9);
        var framePrev = normalize(seedAxis - tangentPrev * dot(seedAxis, tangentPrev));
        outKnotFrame[0u] = vec4f(framePrev, 0.0);

        for (var i = 1u; i < count; i = i + 1u) {
          let pointPrev = knotPos[i - 1u].xyz;
          let pointCur = knotPos[i].xyz;
          let ahead = min(i + 1u, count - 1u);
          let behind = select(i - 1u, i, ahead == i);

          var tangentCur = knotPos[ahead].xyz - knotPos[behind].xyz;
          let tangentLength = length(tangentCur);
          tangentCur = select(tangentPrev, tangentCur / max(tangentLength, 1e-9), tangentLength > 1e-9);

          var frameCur = framePrev;
          let v1 = pointCur - pointPrev;
          let c1 = dot(v1, v1);
          if (c1 > 1e-12) {
            let reflectedFrame = framePrev - v1 * (2.0 / c1 * dot(v1, framePrev));
            let reflectedTangent = tangentPrev - v1 * (2.0 / c1 * dot(v1, tangentPrev));
            let v2 = tangentCur - reflectedTangent;
            let c2 = dot(v2, v2);
            frameCur = select(
              reflectedFrame,
              reflectedFrame - v2 * (2.0 / c2 * dot(v2, reflectedFrame)),
              c2 > 1e-12,
            );
          }

          frameCur = frameCur - tangentCur * dot(frameCur, tangentCur);
          let frameLength = length(frameCur);
          let fallbackAxis = select(vec3f(0.0, 1.0, 0.0), vec3f(1.0, 0.0, 0.0), abs(tangentCur.y) > 0.9);
          let fallback = normalize(fallbackAxis - tangentCur * dot(fallbackAxis, tangentCur));
          frameCur = select(fallback, frameCur / max(frameLength, 1e-9), frameLength > 1e-6);

          outKnotFrame[i] = vec4f(frameCur, 0.0);
          framePrev = frameCur;
          tangentPrev = tangentCur;
        }
      }
    `)({knotPos:Z(C,`vec4f`,i).toReadOnly(),outKnotFrame:Z(w,`vec4f`,i),workgroupId:p,localId:W}).computeKernel([1,1,1]).setName(`Rope Frame Transport`);let a=f?`capDistance = min(capDistance, distanceFromStart);`:``,g=m?`capDistance = min(capDistance, distanceFromEnd);`:``;return P=l(`
      fn compute(
        knotPos: ptr<storage, array<vec4f>, read>,
        knotFrame: ptr<storage, array<vec4f>, read>,
        outPosition: ptr<storage, array<vec4f>, read_write>,
        outNormal: ptr<storage, array<vec4f>, read_write>,
        workgroupId: vec3u,
        localId: vec3u,
      ) -> void {
        let gid = workgroupId.x * ${gc}u + localId.x;
        if (gid >= ${v}u) { return; }

        let ring = gid / ${o}u;
        let slot = gid % ${o}u;

        let maxSpan = ${_c(h)};
        let s = f32(ring) / ${_c(s)};
        let baseSpan = clamp(floor(s), 0.0, maxSpan - 1.0);
        let t = s - baseSpan;

        let i1 = u32(baseSpan);
        let i2 = i1 + 1u;
        let i0 = u32(max(i32(i1) - 1, 0));
        let i3 = min(i2 + 1u, ${i-1}u);

        let p0 = knotPos[i0].xyz;
        let p1 = knotPos[i1].xyz;
        let p2 = knotPos[i2].xyz;
        let p3 = knotPos[i3].xyz;

        let c0 = p1 * 2.0;
        let c1 = p2 - p0;
        let c2 = p0 * 2.0 - p1 * 5.0 + p2 * 4.0 - p3;
        let c3 = p1 * 3.0 - p0 - p2 * 3.0 + p3;
        let centre = (c0 + c1 * t + c2 * (t * t) + c3 * (t * t * t)) * 0.5;
        let derivative = (c1 + c2 * (2.0 * t) + c3 * (3.0 * t * t)) * 0.5;

        let speed = max(length(derivative), 1e-6);
        let tangent = derivative / speed;

        let rolled = mix(knotFrame[i1].xyz, knotFrame[i2].xyz, t);
        var axisU = rolled - tangent * dot(rolled, tangent);
        if (length(axisU) < 1e-4) {
          let fallback = select(vec3f(1.0, 0.0, 0.0), vec3f(0.0, 0.0, 1.0), abs(tangent.x) > 0.9);
          axisU = fallback - tangent * dot(fallback, tangent);
        }
        axisU = normalize(axisU);
        let axisV = cross(tangent, axisU);

        let theta = f32(slot) * ${_c(Math.PI*2/o)};
        let radial = axisU * cos(theta) + axisV * sin(theta);
        let tangential = axisU * -sin(theta) + axisV * cos(theta);

        let distanceFromStart = s;
        let distanceFromEnd = maxSpan - s;
        var capDistance = 1e9;
        ${a}
        ${g}
        let capU = clamp(capDistance / ${_c(.6)}, 0.0, 1.0);
        let cap = sqrt(max(1.0 - (1.0 - capU) * (1.0 - capU), 0.0));

        let layAmplitude = ${_c(u)} * cap;
        let layTwist = ${_c(d*Math.PI*2)};
        let phase = ${_c(c)} * theta + layTwist * s;
        let scaledRadius = ${_c(n.radius)} * cap;
        let r = scaledRadius * (1.0 + layAmplitude * cos(phase));
        let drdTheta = scaledRadius * layAmplitude * ${_c(c)} * -sin(phase);
        let drdS = scaledRadius * layAmplitude * layTwist * -sin(phase);

        let position = centre + radial * r;

        let rawNormal = (radial * r - tangential * drdTheta) * speed - tangent * (r * drdS);
        let rawLength = length(rawNormal);
        let geometricNormal = select(radial, rawNormal / max(rawLength, 1e-9), rawLength > 1e-9);
        let axialSign = select(1.0, -1.0, distanceFromStart < distanceFromEnd);
        let towardTip = (1.0 - cap) * (1.0 - cap);
        let normal = normalize(mix(geometricNormal, tangent * axialSign, towardTip));

        outPosition[gid] = vec4f(position, 1.0);
        outNormal[gid] = vec4f(normal, 0.0);
      }
    `)({knotPos:Z(C,`vec4f`,i).toReadOnly(),knotFrame:Z(w,`vec4f`,i).toReadOnly(),outPosition:Z(T,`vec4f`,v),outNormal:Z(E,`vec4f`,v),workgroupId:p,localId:W}).computeKernel([gc,1,1]).setName(`Rope Tube Build`),!0};return{syncVisuals(e,t){t&&(!P&&!F(e)||(t.compute(M,[Math.ceil(i/gc),1,1]),t.compute(N,[1,1,1]),t.compute(P,[Math.ceil(v/gc),1,1]),j.visible=!0))},dispose(){e.remove(j),j.removeFromParent(),D.dispose(),O.dispose()}}}var yc=40,bc=20,xc=24,Sc=[.25,.2,.2],Cc=[2.5,2.5,2.5],wc=.25,Tc=1,Ec=1/0,Dc=.17;function Oc(e,t){let n=e[0]*2,r=e[1]*2,i=e[2]*2;return n*r*i*t}function kc(e){let{scene:t,physics:n,variant:r}=e,i=[],a=[],o=[],s=r===`heavy-rope-demo`,c=s?yc-1:yc,l=Sc[0],u=l*2,d=yn(`ropeboxes`)===`1`?Nn(t,n,{capacity:c,halfExtents:Sc,color:12043478,roughness:.72,metalness:.04}):null;d&&i.push(d);let f=null;s&&(f=Nn(t,n,{capacity:1,halfExtents:Cc,color:14004330,roughness:.76,metalness:.03}),i.push(f));let p=s?xc:bc,m=(s?7.75:10)-c*u+l,h=[],g=null;for(let e=0;e<c;e++){let t=e===0,r=n.addBody({position:[m+e*u,p,0],halfExtents:Sc,mass:t?0:wc,friction:.5});h.push(r),d?.addBody(r),g!==null&&n.addSphericalJoint(g,r,[l,0,0],[-l,0,0],Ec,!0),g=r}let _=[{bodyA:h[0],offsetA:[-l,0,0]}];for(let e=1;e<c;e++)_.push({bodyA:h[e-1],offsetA:[l,0,0],bodyB:h[e],offsetB:[-l,0,0]});if(s){let e=n.addBody({position:[m+c*u-l+Cc[0],p,0],halfExtents:Cc,mass:Oc(Cc,Tc),friction:.5});f.addBody(e),n.addSphericalJoint(g,e,[l,0,0],[-Cc[0],0,0],Ec,!0),_.push({bodyA:h[c-1],offsetA:[l,0,0],bodyB:e,offsetB:[-Cc[0],0,0]})}else _.push({bodyA:h[c-1],offsetA:[l,0,0]});return o.push(vc(t,n,{knots:_,radius:Dc,color:12034170,radialSegments:20,segmentsPerSpan:8,strands:3,layDepth:.17,layTurnsPerSpan:.6,capStart:!0,capEnd:!s,roughness:.9,metalness:0})),{trackedVisualSets:i,trackedSpringVisualSets:a,syncedVisuals:o}}var Ac=[4,4,4],jc=3,Mc=.8,Nc=8,Pc=2,Fc=800,Ic=1,Lc=.5,Rc=[8238056,14263135,8962671],zc=[[0,0],[.28,-.16],[-.22,.2]];function Bc(e){let{scene:t,physics:n}=e,r=gr(Ac),i=[],a=[];for(let e=0;e<jc;e++){let o=e*(Ac[1]*Mc+Pc),[s,c]=zc[e]??[0,0],l=br({scene:t,physics:n,gridDims:Ac,filledIndices:r,cellSize:Mc,basePosition:[s,Nc+o,c],color:Rc[e%Rc.length],density:Ic,friction:Lc,jointStiffness:Fc});i.push(...l.trackedVisualSets),a.push(...l.trackedSpringVisualSets)}return{trackedVisualSets:i,trackedSpringVisualSets:a}}var Vc=x(`
      const CONTACT_RECORD_META_OFFSET: u32 = 0u;
      const CONTACT_RECORD_NORMAL_PEN_OFFSET: u32 = 1u;
      const CONTACT_RECORD_ARM_A_OFFSET: u32 = 2u;
      const CONTACT_RECORD_ARM_B_OFFSET: u32 = 3u;
      const CONTACT_RECORD_CONSTRAINT_C0_OFFSET: u32 = 4u;
      const CONTACT_RECORD_SHADOW_OFFSET: u32 = 5u;
      const CONTACT_RECORD_DUAL_OFFSET: u32 = 6u;
      const CONTACT_RECORD_PENALTY_OFFSET: u32 = 7u;
      const CONTACT_RECORD_CACHE_OFFSET: u32 = 8u;
      const CONTACT_RECORD_VEC4S: u32 = 9u;

      fn contactRecordBase(p: u32) -> u32 {
        return p * CONTACT_RECORD_VEC4S;
      }

      fn loadContactMeta(pairContacts: ptr<storage, array<vec4f>, read_write>, p: u32) -> vec4f {
        return pairContacts[contactRecordBase(p) + CONTACT_RECORD_META_OFFSET];
      }

      fn storeContactMeta(
        pairContacts: ptr<storage, array<vec4f>, read_write>,
        p: u32,
        value: vec4f,
      ) {
        pairContacts[contactRecordBase(p) + CONTACT_RECORD_META_OFFSET] = value;
      }

      fn loadContactNormalPen(pairContacts: ptr<storage, array<vec4f>, read_write>, p: u32) -> vec4f {
        return pairContacts[contactRecordBase(p) + CONTACT_RECORD_NORMAL_PEN_OFFSET];
      }

      fn storeContactNormalPen(
        pairContacts: ptr<storage, array<vec4f>, read_write>,
        p: u32,
        value: vec4f,
      ) {
        pairContacts[contactRecordBase(p) + CONTACT_RECORD_NORMAL_PEN_OFFSET] = value;
      }

      fn loadContactArmA(pairContacts: ptr<storage, array<vec4f>, read_write>, p: u32) -> vec4f {
        return pairContacts[contactRecordBase(p) + CONTACT_RECORD_ARM_A_OFFSET];
      }

      fn storeContactArmA(
        pairContacts: ptr<storage, array<vec4f>, read_write>,
        p: u32,
        value: vec4f,
      ) {
        pairContacts[contactRecordBase(p) + CONTACT_RECORD_ARM_A_OFFSET] = value;
      }

      fn loadContactArmB(pairContacts: ptr<storage, array<vec4f>, read_write>, p: u32) -> vec4f {
        return pairContacts[contactRecordBase(p) + CONTACT_RECORD_ARM_B_OFFSET];
      }

      fn storeContactArmB(
        pairContacts: ptr<storage, array<vec4f>, read_write>,
        p: u32,
        value: vec4f,
      ) {
        pairContacts[contactRecordBase(p) + CONTACT_RECORD_ARM_B_OFFSET] = value;
      }

      fn loadContactConstraintC0(pairContacts: ptr<storage, array<vec4f>, read_write>, p: u32) -> vec4f {
        return pairContacts[contactRecordBase(p) + CONTACT_RECORD_CONSTRAINT_C0_OFFSET];
      }

      fn storeContactConstraintC0(
        pairContacts: ptr<storage, array<vec4f>, read_write>,
        p: u32,
        value: vec4f,
      ) {
        pairContacts[contactRecordBase(p) + CONTACT_RECORD_CONSTRAINT_C0_OFFSET] = value;
      }

      fn loadContactShadow(pairContacts: ptr<storage, array<vec4f>, read_write>, p: u32) -> vec4f {
        return pairContacts[contactRecordBase(p) + CONTACT_RECORD_SHADOW_OFFSET];
      }

      fn storeContactShadow(
        pairContacts: ptr<storage, array<vec4f>, read_write>,
        p: u32,
        value: vec4f,
      ) {
        pairContacts[contactRecordBase(p) + CONTACT_RECORD_SHADOW_OFFSET] = value;
      }

      fn loadContactDual(pairContacts: ptr<storage, array<vec4f>, read_write>, p: u32) -> vec4f {
        return pairContacts[contactRecordBase(p) + CONTACT_RECORD_DUAL_OFFSET];
      }

      fn storeContactDual(
        pairContacts: ptr<storage, array<vec4f>, read_write>,
        p: u32,
        value: vec4f,
      ) {
        pairContacts[contactRecordBase(p) + CONTACT_RECORD_DUAL_OFFSET] = value;
      }

      fn loadContactPenalty(pairContacts: ptr<storage, array<vec4f>, read_write>, p: u32) -> vec4f {
        return pairContacts[contactRecordBase(p) + CONTACT_RECORD_PENALTY_OFFSET];
      }

      fn storeContactPenalty(
        pairContacts: ptr<storage, array<vec4f>, read_write>,
        p: u32,
        value: vec4f,
      ) {
        pairContacts[contactRecordBase(p) + CONTACT_RECORD_PENALTY_OFFSET] = value;
      }

      fn loadContactCache(pairContacts: ptr<storage, array<vec4f>, read_write>, p: u32) -> vec4u {
        return bitcast<vec4u>(pairContacts[contactRecordBase(p) + CONTACT_RECORD_CACHE_OFFSET]);
      }

      fn storeContactCache(
        pairContacts: ptr<storage, array<vec4f>, read_write>,
        p: u32,
        value: vec4u,
      ) {
        pairContacts[contactRecordBase(p) + CONTACT_RECORD_CACHE_OFFSET] = bitcast<vec4f>(value);
      }

      fn loadContactCacheWord(pairContacts: ptr<storage, array<vec4f>, read_write>, p: u32) -> u32 {
        return loadContactCache(pairContacts, p).x;
      }

      fn storeContactCacheWord(
        pairContacts: ptr<storage, array<vec4f>, read_write>,
        p: u32,
        value: u32,
      ) {
        let cache = loadContactCache(pairContacts, p);
        storeContactCache(pairContacts, p, vec4u(value, cache.y, cache.z, cache.w));
      }
`);function Hc(e){return e*36}function Uc(e,t){return Hc(e)+t*4}var Wc=class{pointAMesh;pointBMesh;connectorMesh;pointGeometry;connectorGeometry;capacity;pointAMaterial;pointBMaterial;connectorMaterial;enabled=!1;gpuVisualsBound=!1;constructor(e,t){this.capacity=Math.max(1,t);let n=new nt(1,10,10),r=new Ie(1,1,1,8,1,!0);this.pointGeometry=n,this.connectorGeometry=r;let i=new $e;i.color.setHex(16764758),i.transparent=!0,i.opacity=.98,i.depthWrite=!1,this.pointAMaterial=i;let a=new $e;a.color.setHex(14035257),a.transparent=!0,a.opacity=.98,a.depthWrite=!1,this.pointBMaterial=a;let o=new $e;o.color.setHex(16747586),o.transparent=!0,o.opacity=.32,o.depthWrite=!1,this.connectorMaterial=o,this.connectorMesh=new Ne(r,o,this.capacity),this.connectorMesh.count=0,this.connectorMesh.frustumCulled=!1,this.connectorMesh.renderOrder=3,this.connectorMesh.visible=!1,e.add(this.connectorMesh),this.pointAMesh=new Ne(n,i,this.capacity),this.pointAMesh.count=0,this.pointAMesh.frustumCulled=!1,this.pointAMesh.renderOrder=4,this.pointAMesh.visible=!1,e.add(this.pointAMesh),this.pointBMesh=new Ne(n,a,this.capacity),this.pointBMesh.count=0,this.pointBMesh.frustumCulled=!1,this.pointBMesh.renderOrder=5,this.pointBMesh.visible=!1,e.add(this.pointBMesh)}setEnabled(e){if(this.enabled=e,!e){this.clear();return}this.connectorMesh.visible=!0,this.pointAMesh.visible=!0,this.pointBMesh.visible=!0}clear(){this.connectorMesh.visible=!1,this.pointAMesh.visible=!1,this.pointBMesh.visible=!1}requestUpdate(t){if(this.enabled){if(!this.gpuVisualsBound){let r=t.getContactRenderBuffers();if(!r)return;let i=Te(r.positions,`vec4`,t.config.maxBodies).toReadOnly(),a=Te(r.quaternions,`vec4`,t.config.maxBodies).toReadOnly(),o=Te(r.pairContacts,`vec4`,r.maxPairContacts*9).toReadOnly(),s=Te(r.pairActivity,`uint`,r.pairActivityWordCount).toReadOnly(),c=e,l=s.element(K(r.pairActiveContactsOffset)),u=c.lessThan(l),d=Se(u,s.element(c.add(K(r.pairActiveContactsOffset+1))),K(0)).mul(K(9)),f=o.element(d.add(K(0))),p=f.z.greaterThanEqual(.5),m=u.and(p),h=K(f.x),g=K(f.y),_=i.element(h).xyz,v=i.element(g).xyz,y=a.element(h),b=a.element(g),x=(e,t)=>{let n=t.xyz,r=t.w,i=n.cross(e).mul(2);return e.add(i.mul(r)).add(n.cross(i))},S=o.element(d.add(K(2))).xyz,C=o.element(d.add(K(3))).xyz,w=_.add(x(S,y)),T=v.add(x(C,b)),E=n(0,-1e6,0),D=Se(m,A(.06),A(0)),O=Se(m,w,E),k=Se(m,T,E);this.pointAMaterial.positionNode=te.mul(D).add(O),this.pointAMaterial.needsUpdate=!0,this.pointAMesh.count=this.capacity,this.pointBMaterial.positionNode=te.mul(D).add(k),this.pointBMaterial.needsUpdate=!0,this.pointBMesh.count=this.capacity;let j=T.sub(w),M=j.length().max(A(1e-8)),N=j.div(M),P=Se(N.y.abs().greaterThan(A(.95)),n(1,0,0),n(0,1,0)).cross(N).normalize(),F=N.cross(P).normalize(),I=w.add(T).mul(.5),L=Se(m,A(.009),A(0)),R=te.y.mul(Se(m,M,A(0))),z=P.mul(te.x.mul(L)).add(N.mul(R)).add(F.mul(te.z.mul(L))),B=Se(m,I.add(z),E);this.connectorMaterial.positionNode=B,this.connectorMaterial.needsUpdate=!0,this.connectorMesh.count=this.capacity,this.gpuVisualsBound=!0}this.connectorMesh.visible=!0,this.pointAMesh.visible=!0,this.pointBMesh.visible=!0}}dispose(){this.connectorMesh.removeFromParent(),this.pointAMesh.removeFromParent(),this.pointBMesh.removeFromParent(),this.connectorMesh.dispose(),this.pointAMesh.dispose(),this.pointBMesh.dispose(),this.connectorGeometry.dispose(),this.pointGeometry.dispose(),this.connectorMaterial.dispose(),this.pointAMaterial.dispose(),this.pointBMaterial.dispose()}};function Gc(e,t){let n=new Ue;e.add(n);let r=Tn(n,t,{count:1,initialCount:0,halfExtents:[.3,.3,.3],layout:`grid`,emitter:{enabled:!1,rate:1},randomRotation:!1,rotationJitter:0}),i=new Wc(n,t.getMaxActiveContactDebugPoints());return{sceneRoot:n,spawner:r,defaultEmitter:r.getEmitter(),trackedVisualSets:[],trackedSpringVisualSets:[],syncedSceneVisuals:[],sceneUpdateCallbacks:[],scenePreStepCallbacks:[],sceneResetCallbacks:[],pickKinematicBody:null,setKinematicImpactors:null,contactPointOverlay:i,nonGrabbableBodies:new Set,bridgeMiniDiagnostics:null,carouselDiagnostics:null,sceneStatusText:null,shootProjectileOverride:null,dispose(){i.dispose(),r.dispose(),n.removeFromParent()}}}function Kc(e){let{parent:t,physics:n,stackPreset:r,stackConfig:i}=e;if(r===`gel-cut`)return Gc(t,n);let a=i.maxBodies,o=[100,.5,100],s=new Ue;t.add(s);let c=[],l=[],u=[],d=[],f=[],p=[],m=[],h=null,g=null,_=new Set,v=null,y=null,b=null,x=Math.max(0,a-1),S=Tn(s,n,{count:x,initialCount:Math.min(i.initialCount,x),halfExtents:[.3,.3,.3],layout:i.layout,...i.grid?{grid:i.grid}:{},...i.pyramidWall?{pyramidWall:i.pyramidWall}:{},emitter:{enabled:!1,rate:24},randomRotation:!1,rotationJitter:.04}),C=S.getEmitter(),w=new Map,T=(e,t,n)=>{let r=()=>zn({halfExtents:e,...t===void 0?{}:{color:t},...n?{markings:!0}:{}});if(n)return r();let i=t??-1,a=w.get(i);return a||(a=r(),w.set(i,a)),a},E=(e,t,r)=>{n.addBody({position:e,mass:0,halfExtents:t,...r?.quaternion?{quaternion:r.quaternion}:{},...r?.friction===void 0?{}:{friction:r.friction},lockRotation:!0});let i=new Qe(new Oe(t[0]*2,t[1]*2,t[2]*2),T(t,r?.color,r?.markings===!0));i.position.set(e[0],e[1],e[2]),r?.quaternion&&i.quaternion.set(r.quaternion[0],r.quaternion[1],r.quaternion[2],r.quaternion[3]),i.castShadow=!0,i.receiveShadow=!0,s.add(i),c.push(i)},D=(e,t,r,i)=>{n.addBody({position:e,mass:0,halfExtents:[t,r,t],lockRotation:!0});let a=new Qe(new Ie(t,t,r*2,28),new Ge({color:i?.color??5792884,roughness:.85,metalness:.05}));a.position.set(e[0],e[1],e[2]),a.castShadow=!0,a.receiveShadow=!0,s.add(a),c.push(a)},O=(e,t,r,i)=>{let a=n.addBody({position:e,mass:i?.mass??1,halfExtents:t,friction:i?.friction??.75,quaternion:i?.quaternion,linearVelocity:i?.linearVelocity,collisionGroup:i?.collisionGroup,collisionMask:i?.collisionMask});return r.addBody(a),a},k=(e,t,r,i)=>{let a=n.addBody({position:e,shapeType:`sphere`,radius:t,mass:i?.mass??1,friction:i?.friction??.75,quaternion:i?.quaternion,linearVelocity:i?.linearVelocity,collisionGroup:i?.collisionGroup,collisionMask:i?.collisionMask});return r.addBody(a),a},A=r===`bridge-demo`||r===`bridge-demo-empty`||r===`bridge-demo-fixed`,j=r===`spring-demo`||r===`spring-ratio`,M=r===`sphere-demo`;if(r!==`waterfall-gutter`&&r!==`dominoes-advanced-demo`&&r!==`bunny-soft-body`&&!A&&!j&&E([0,-o[1],0],o,{color:4805987}),r===`waterfall-gutter`){let e=[11,.45,3.2],t=[11,1.1,.35],n=Math.tan(.18),r=new Y(0,1,0),i=e=>{let t=e.clone().setY(0).normalize(),i=new Y(t.x,-n,t.z).normalize(),a=new Y().crossVectors(r,i).normalize(),o=new Y().crossVectors(a,i).normalize(),s=new tt().makeBasis(i,o,a);return new Le().setFromRotationMatrix(s)},a=[i(new Y(1,0,0)),i(new Y(0,0,1)),i(new Y(-1,0,0)),i(new Y(0,0,-1)),i(new Y(1,0,0))],o=[new Y(0,22,0)],s=e[0],c=5.8,l=[[5,c,3],[5,c,3],[5,c,3],[5,c,3]];for(let e=1;e<a.length;e++){let t=o[e-1],n=a[e-1],r=new Y(1,0,0).applyQuaternion(a[e-1]).normalize(),i=new Y(1,0,0).applyQuaternion(a[e]).normalize(),c=t.clone().addScaledVector(r,s),u=l[e-1]??[0,-5.8,0],d=new Y(u[0],u[1],u[2]).applyQuaternion(n),f=c.clone().add(d);o.push(f.addScaledVector(i,s))}let u=(n,r)=>{let i=[r.x,r.y,r.z,r.w];E([n.x,n.y,n.z],e,{quaternion:i,color:4871523});let a=new Y(0,0,1).applyQuaternion(r).normalize(),o=new Y(0,1.05,0),s=n.clone().add(o).addScaledVector(a,3.55),c=n.clone().add(o).addScaledVector(a,-3.55);E([s.x,s.y,s.z],t,{quaternion:i,color:6977161}),E([c.x,c.y,c.z],t,{quaternion:i,color:6977161})};for(let e=0;e<o.length;e++)u(o[e],a[e]);let d=o[0],f=new Y(1,0,0).applyQuaternion(a[0]).normalize(),p=d.clone().addScaledVector(f,-s).clone().addScaledVector(f,-.7),m=a[0];E([p.x,p.y,p.z],[.55,2.6,3.2],{quaternion:[m.x,m.y,m.z,m.w],color:7570330})}if(A){let e=1/0,t=r===`bridge-demo-fixed`,i=r===`bridge-demo`,a=[.5,.25,2],c=a[0],u=a[2],d=[.5,.5,.5],f=(e,t)=>e[0]*2*e[1]*2*e[2]*2*t,p=f(a,1),m=f(d,1),h={collisionGroup:1,collisionMask:6},g={collisionGroup:2,collisionMask:7},_={collisionGroup:4,collisionMask:7};E([0,-o[1],0],o,{color:4805987}),n.setBodyCollisionFilter(0,h.collisionGroup??1,h.collisionMask??255);let v=Nn(s,n,{capacity:40,halfExtents:a,color:9398071,roughness:.82,metalness:.04});l.push(v);let y=i?Nn(s,n,{capacity:50,halfExtents:d,color:11684927,roughness:.7,metalness:.08}):null;y&&l.push(y);let b=[];for(let e=0;e<40;e++){let t=e===0||e===39?0:p;b.push(O([e-40*.5,10,0],a,v,{mass:t,friction:.5,collisionGroup:g.collisionGroup,collisionMask:g.collisionMask}))}for(let r=1;r<40;r++)n.setBodyPairCollisionIgnored(b[r-1],b[r],!0),t?n.addFixedJoint(b[r-1],b[r],[c,0,0],[-c,0,0],e,!0):(n.addSphericalJoint(b[r-1],b[r],[c,0,u],[-c,0,u],e,!0),n.addSphericalJoint(b[r-1],b[r],[c,0,-u],[-c,0,-u],e,!0));if(y)for(let e=0;e<10;e++)for(let t=0;t<5;t++)O([e-40/8,t+12,0],d,y,{mass:m,friction:.5,collisionGroup:_.collisionGroup,collisionMask:_.collisionMask})}if(j){let e=[100,.5,100];if(E([0,-e[1],0],e,{color:4805987}),r===`spring-demo`){let e=(e,t)=>{let n=Math.sin(e*12.9898+t*78.233)*43758.5453123;return n-Math.floor(n)},t=Wn(s,{capacity:100,color:10473727});u.push(t);let r=Nn(s,n,{capacity:100,halfExtents:[.5,.5,.5],color:8346934,roughness:.82,metalness:.04,showOutline:!1}),i=Nn(s,n,{capacity:100,halfExtents:[1,1,1],color:8346934,roughness:.82,metalness:.04,showOutline:!1});l.push(r,i);for(let a=0;a<10;a++)for(let o=0;o<10;o++){let s=a*10+o,c=(o-9*.5)*5,l=(a-9*.5)*5,u=J.lerp(.6,2.4,e(s,.19)),d=J.lerp(55,220,e(s,.47)),f=J.lerp(-1.1,1.1,e(s,.83)),p=O([c,23.5,l],[.5,.5,.5],r,{mass:0,friction:.5}),m=O([c+f,17.5,l],[1,1,1],i,{mass:u,friction:.5}),h=n.addSpring(p,m,[0,0,0],[0,0,0],d,4);t.addSpring(h)}}else{let e=Wn(s,{capacity:7,color:10473727});u.push(e);let t=Nn(s,n,{capacity:8,halfExtents:[.5,.375,.375],color:8346934,roughness:.82,metalness:.04});l.push(t);let r=[];for(let i=0;i<8;i++){let a=(i-7*.5)*3;if(r.push(O([a,21.5,0],[.5,.375,.375],t,{mass:i===0||i===7?0:1,friction:.5})),i>0){let t=n.addSpring(r[i-1],r[i],[.5,0,0],[-.5,0,0],i%2==0?10:1e4,3);e.addSpring(t)}}}}if(M){let e=Nn(s,n,{capacity:1,geometry:new nt(1,28,20),color:10473727,roughness:.58,metalness:.08}),t=Nn(s,n,{capacity:2,geometry:new nt(.75,24,18),color:10473727,roughness:.58,metalness:.08});l.push(e,t),E([-4,1,0],[2,1,2],{color:5792884}),k([-4,4.6,0],1,e,{mass:2.5,friction:.6}),k([2.5,1.35,0],.75,t,{mass:1.5,friction:.6}),k([2.5,4.6,0],.75,t,{mass:1.5,friction:.6})}if(r===`ragdoll-cloth-demo`){let e=hc({scene:s,physics:n,addStaticBoxWithVisual:E});l.push(...e.trackedVisualSets),u.push(...e.trackedSpringVisualSets),d.push(...e.syncedVisuals),f.push(e.update)}if(r===`ragdoll-carousel-demo`){let e=$s({scene:s,physics:n,addStaticBoxWithVisual:E,addStaticCylinderWithVisual:D});l.push(...e.trackedVisualSets),u.push(...e.trackedSpringVisualSets),b=e.getStatusText,e.diagnostics.joints.length>0&&(v={joints:e.diagnostics.joints}),f.push(e.update)}if(r===`jointed-sandbox-demo`){let e=To({scene:s,physics:n,addStaticBoxWithVisual:E});l.push(...e.trackedVisualSets),u.push(...e.trackedSpringVisualSets)}if(r===`soft-body`){let e=Bc({scene:s,physics:n});l.push(...e.trackedVisualSets),u.push(...e.trackedSpringVisualSets)}if(r===`bunny-soft-body`){let e=Dr({scene:s,physics:n,addStaticBoxWithVisual:E});l.push(...e.trackedVisualSets),u.push(...e.trackedSpringVisualSets)}if(r===`cloth-boxes-demo`){let e=pr({scene:s,physics:n,addStaticBoxWithVisual:E});l.push(...e.trackedVisualSets),u.push(...e.trackedSpringVisualSets),d.push(...e.syncedVisuals),f.push(e.update);for(let t of e.clothBodyIds)_.add(t)}if(r===`rope-demo`||r===`heavy-rope-demo`){let e=kc({scene:s,physics:n,variant:r});l.push(...e.trackedVisualSets),u.push(...e.trackedSpringVisualSets),d.push(...e.syncedVisuals)}if(Ni(r)){let e=ta({scene:s,physics:n,variant:r});l.push(...e.trackedVisualSets),u.push(...e.trackedSpringVisualSets),y=e.shootProjectile}if(r===`dominoes-demo`){let e=co({scene:s,physics:n});l.push(...e.trackedVisualSets),u.push(...e.trackedSpringVisualSets)}if(r===`dominoes-advanced-demo`){let e=lo({scene:s,physics:n});l.push(...e.trackedVisualSets),u.push(...e.trackedSpringVisualSets)}if(r===`newtons-cradles-demo`){let e=Ro({scene:s,physics:n,addStaticBoxWithVisual:E});l.push(...e.trackedVisualSets),u.push(...e.trackedSpringVisualSets)}if(r===`ragdoll-avalanche-demo`){let e=ps({scene:s,physics:n,addStaticBoxWithVisual:E});l.push(...e.trackedVisualSets),u.push(...e.trackedSpringVisualSets)}if(r===`cliff-plateau-demo`){let e=Mi({scene:s,physics:n,addStaticBoxWithVisual:E});l.push(...e.trackedVisualSets),u.push(...e.trackedSpringVisualSets),p.push(e.updateBeforeStep),m.push(e.reset),h=e.activateWalkerByRay,g=e.setImpactorRange,b=e.statusText}let N=new Wc(s,n.getMaxActiveContactDebugPoints());return{sceneRoot:s,spawner:S,defaultEmitter:C,trackedVisualSets:l,trackedSpringVisualSets:u,syncedSceneVisuals:d,sceneUpdateCallbacks:f,scenePreStepCallbacks:p,sceneResetCallbacks:m,pickKinematicBody:h,setKinematicImpactors:g,contactPointOverlay:N,nonGrabbableBodies:_,bridgeMiniDiagnostics:null,carouselDiagnostics:v,sceneStatusText:b,shootProjectileOverride:y,dispose(){N.dispose();for(let e of d)e.dispose();for(let e of u)e.dispose();for(let e of l)e.dispose();S.dispose();let e=new Set;for(let t of c){t.removeFromParent(),t.geometry&&t.geometry.dispose();let n=t.material;if(Array.isArray(n))for(let t of n)e.add(t);else e.add(n)}for(let t of e)t.dispose();s.removeFromParent()}}}var qc={radiusX:.28,radiusY:.12,radiusZ:.28,y0:.04,spacing:.032,nodeHalf:.014,density:550,stretchStiffness:520,shearStiffness:200,friction:.65};function Jc(e,t,n){let r=e/qc.radiusX,i=(t-qc.y0)/qc.radiusY,a=n/qc.radiusZ;return i<0||i>1?!1:r*r+a*a+i*i<=1}function Yc(e,t,n){return e+512<<20|t+512<<10|n+512}function Xc(e){let{scene:t,physics:n}=e,{spacing:r,nodeHalf:i,density:a,friction:o}=qc;n.addBody({position:[0,-.02,0],mass:0,halfExtents:[.6,.02,.6],friction:.9,lockRotation:!0,collisionGroup:1,collisionMask:255});let s=[],c=Math.ceil(qc.radiusX*2/r),l=Math.ceil(qc.radiusY/r),u=Math.ceil(qc.radiusZ*2/r);for(let e=0;e<=u;e++)for(let t=0;t<=l;t++)for(let l=0;l<=c;l++){let c=-qc.radiusX+l*r,u=qc.y0+t*r,d=-qc.radiusZ+e*r;if(!Jc(c,u,d))continue;let f=t===0,p=f?0:a*(i*2)**3,m=n.addBody({position:[c,u,d],shapeType:`sphere`,radius:i,mass:p,friction:o,lockRotation:!0,collisionGroup:2,collisionMask:1});s.push({body:m,x:c,y:u,z:d,pinned:f})}let d=s.filter(e=>!e.pinned).map(e=>e.body),f=s.filter(e=>e.pinned).map(e=>e.body),p=Nn(t,n,{capacity:Math.max(d.length,1),geometry:new nt(i,10,8),color:4045422,roughness:.45,metalness:.05,showOutline:!1,castShadow:!1,receiveShadow:!1});for(let e of d)p.addBody(e);let m=r*1.12,h=r*1.75,g=m*m,_=h*h,v=1/r,y=new Map;for(let e=0;e<s.length;e++){let t=s[e],n=Yc(Math.floor(t.x*v),Math.floor(t.y*v),Math.floor(t.z*v)),r=y.get(n);r||(r=[],y.set(n,r)),r.push(e)}let b=[],x=new Set,S=(e,t)=>e<t?e*1000003+t:t*1000003+e;for(let e=0;e<s.length;e++){let t=s[e],r=Math.floor(t.x*v),i=Math.floor(t.y*v),a=Math.floor(t.z*v);for(let o=-1;o<=1;o++)for(let c=-1;c<=1;c++)for(let l=-1;l<=1;l++){let u=y.get(Yc(r+l,i+c,a+o));if(u)for(let r of u){if(r<=e)continue;let i=S(e,r);if(x.has(i))continue;let a=s[r],o=t.x-a.x,c=t.y-a.y,l=t.z-a.z,u=o*o+c*c+l*l;if(u>_||u<1e-10)continue;x.add(i);let d=Math.sqrt(u),f=u<=g?qc.stretchStiffness:qc.shearStiffness,p=n.addSpring(t.body,a.body,[0,0,0],[0,0,0],f,d,!0);b.push({index:p,bodyA:t.body,bodyB:a.body,mid:[(t.x+a.x)*.5,(t.y+a.y)*.5,(t.z+a.z)*.5],active:!0})}}}return{liveBodies:d,pinnedBodies:f,springs:b,visuals:p,springCount:b.length}}var Zc=144;function Qc(e,t,n){if(!n.length)return 0;let r=0;for(let i of t)if(!(!i.active||r>=Zc)){for(let t of n)if($c(i.mid,t.position,t.halfExtents,t.quaternion)){e.disableSpring(i.index)&&(i.active=!1,r++);break}}return r}function $c(e,t,n,r){let i=-r[0],a=-r[1],o=-r[2],s=r[3],c=e[0]-t[0],l=e[1]-t[1],u=e[2]-t[2],d=s*c+a*u-o*l,f=s*l+o*c-i*u,p=s*u+i*l-a*c,m=-i*c-a*l-o*u,h=d*s+m*-i+f*-o-p*-a,g=f*s+m*-a+p*-i-d*-o,_=p*s+m*-o+d*-a-f*-i;return Math.abs(h)<=n[0]&&Math.abs(g)<=n[1]&&Math.abs(_)<=n[2]}var el=256,tl=4,nl=class{kernel;constructor(e,t,n,r,i,a,o,s,c){let u=l(`
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
        let gid = workgroupId.x * ${el}u + localId.x;
        if (gid >= bodyCount) { return; }

        let poseBase = gid * 2u;
        let currentPos4 = positions[gid];
        let currentPos = currentPos4.xyz;
        let invMass = currentPos4.w;
        let currentQ = normalize(quaternions[gid]);
        initialPose[poseBase] = currentPos4;
        initialPose[poseBase + 1u] = currentQ;

        let inertialBase = gid * ${tl}u;
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
    `,[Fr]);this.kernel=u({positions:Z(e,`vec4f`,c).toReadOnly(),initialPose:Z(t,`vec4f`,c*2),inertialPose:Z(n,`vec4f`,c*tl),velocities:Z(r,`vec4f`,c).toReadOnly(),prevLinearVelocities:Z(i,`vec4f`,c).toReadOnly(),quaternions:Z(a,`vec4f`,c).toReadOnly(),angularVelocities:Z(o,`vec4f`,c).toReadOnly(),gravity:T(new Y(...s)),dt:T(1/60/4),bodyCount:T(0),workgroupId:p,localId:W}).computeKernel([el,1,1]).setName(`Physics Integrate + AVBD Initialize Primal Guess`),Pr(`Physics Integrate + AVBD Initialize Primal Guess`,7)}dispatch(e,t,n){this.kernel.computeNode.parameters.bodyCount.value=t,this.kernel.computeNode.parameters.dt.value=n;let r=Math.ceil(t/el);e.compute(this.kernel,[r,1,1])}},rl=yn(`avbdnoindirect`)===`1`,il=16383;function al(e){return Math.max(0,Math.min(2,e))}function ol(e,t){return Number.isFinite(e)?Math.max(0,Math.min(255,Math.floor(e))):t}function sl(e,t=1,n=255,r=0){let i=al(e),a=Math.round(i/2*il)&il,o=ol(t,1)&255,s=ol(n,255)&255;return(a|(r&3)<<14|o<<16|s<<24)>>>0}function cl(e){return(e&il)/il*2}function ll(e){return e>>14&3}var ul=x(`
      const SHAPE_FRICTION_MAX: f32 = 2.0;
      const SHAPE_FRICTION_WORD_SCALE: f32 = 2.0 / 16383.0;
      const SHAPE_TYPE_SHIFT: u32 = 14u;
      const SHAPE_TYPE_MASK: u32 = 3u;
      const SHAPE_TYPE_BOX: u32 = 0u;
      const SHAPE_TYPE_SPHERE: u32 = 1u;

      fn decodeShapeMetaWord(shapeMeta: f32) -> u32 {
        return bitcast<u32>(shapeMeta);
      }

      fn decodeShapeFriction(shapeMeta: f32) -> f32 {
        return f32(decodeShapeMetaWord(shapeMeta) & 0xffffu) * SHAPE_FRICTION_WORD_SCALE;
      }

      fn decodeShapeCollisionGroup(shapeMeta: f32) -> u32 {
        return (decodeShapeMetaWord(shapeMeta) >> 16u) & 0xffu;
      }

      fn decodeShapeCollisionMask(shapeMeta: f32) -> u32 {
        return (decodeShapeMetaWord(shapeMeta) >> 24u) & 0xffu;
      }

      fn decodeShapeType(shapeMeta: f32) -> u32 {
        return (decodeShapeMetaWord(shapeMeta) >> SHAPE_TYPE_SHIFT) & SHAPE_TYPE_MASK;
      }

      fn shapesCanCollide(shapeA: vec4f, shapeB: vec4f) -> bool {
        let groupA = decodeShapeCollisionGroup(shapeA.x);
        let groupB = decodeShapeCollisionGroup(shapeB.x);
        let maskA = decodeShapeCollisionMask(shapeA.x);
        let maskB = decodeShapeCollisionMask(shapeB.x);
        return (maskA & groupB) != 0u && (maskB & groupA) != 0u;
      }
    `),dl=256,fl=x(`
      const TANGENT_BASIS_TWO_PI: f32 = 6.283185307179586;

      struct TangentBasis {
        t1: vec3f,
        t2: vec3f,
      };

      fn canonicalTangentBasis(n: vec3f) -> TangentBasis {
        let refAxis = select(vec3f(0.0, 1.0, 0.0), vec3f(1.0, 0.0, 0.0), abs(n.y) > 0.999);
        let t1Raw = cross(refAxis, n);
        let t1Len2 = dot(t1Raw, t1Raw);
        var t1 = vec3f(0.0, 0.0, 1.0);
        if (t1Len2 > 1e-12) {
          t1 = t1Raw * inverseSqrt(t1Len2);
        }
        let t2Raw = cross(n, t1);
        let t2Len2 = dot(t2Raw, t2Raw);
        var t2 = vec3f(1.0, 0.0, 0.0);
        if (t2Len2 > 1e-12) {
          t2 = t2Raw * inverseSqrt(t2Len2);
        }
        return TangentBasis(t1, t2);
      }

      fn tangentBasisFromPreferredT1(n: vec3f, preferredT1: vec3f) -> TangentBasis {
        let projected = preferredT1 - n * dot(preferredT1, n);
        let projectedLen2 = dot(projected, projected);
        if (projectedLen2 <= 1e-12) {
          return canonicalTangentBasis(n);
        }
        let t1 = projected * inverseSqrt(projectedLen2);
        let t2Raw = cross(n, t1);
        let t2Len2 = dot(t2Raw, t2Raw);
        if (t2Len2 <= 1e-12) {
          return canonicalTangentBasis(n);
        }
        let t2 = t2Raw * inverseSqrt(t2Len2);
        return TangentBasis(t1, t2);
      }

      fn tangentBasisFromAngle(n: vec3f, theta: f32) -> TangentBasis {
        let canonical = canonicalTangentBasis(n);
        let c = cos(theta);
        let s = sin(theta);
        let t1 = canonical.t1 * c + canonical.t2 * s;
        return tangentBasisFromPreferredT1(n, t1);
      }

      fn tangentBasisAngleFromT1(n: vec3f, t1: vec3f) -> f32 {
        let canonical = canonicalTangentBasis(n);
        var theta = atan2(dot(t1, canonical.t2), dot(t1, canonical.t1));
        if (theta < 0.0) {
          theta += TANGENT_BASIS_TWO_PI;
        }
        return theta;
      }
`),pl=class{pairKernel;pairKernelDebug;clearPairBodyCountsKernel;clearDebugCountersKernel;clearActiveCandidateSlotsKernel;buildActiveCandidateSlotsKernel;buildPairDispatchArgsKernel;buildPairBodyListsKernel;buildPairBodyListsKernelDebug;finalizeDebugCountersKernel;pairDispatchIndirectAttr;debugCountersAttr;pairContactsAttr;maxPairContacts;pairManifoldSlots;floorDebugBody=4294967295;debugEnabled=!1;debugReadbackInFlight=!1;lastDebugLogFrame=-1;debugEveryNFrames=30;constructor(e,t,n,r,i,a,o,s,c,u,d,f,m,h,g,_,v){this.pairContactsAttr=r,this.maxPairContacts=c,this.pairManifoldSlots=u;let y=s*d,b=Math.floor(c/u);this.pairDispatchIndirectAttr=new it(new Uint32Array([0,1,1]),1),this.pairDispatchIndirectAttr.name=`Contact Pair Dispatch Indirect`,this.debugCountersAttr=new q(new Uint32Array(27),1);let x=l(`
      fn compute(
        positions: ptr<storage, array<vec4f>, read>,
        quaternions: ptr<storage, array<vec4f>, read>,
        shapes: ptr<storage, array<vec4f>, read>,
        pairContacts: ptr<storage, array<vec4f>, read_write>,
        pairActivity: ptr<storage, array<u32>, read_write>,
        debugCounters: ptr<storage, array<atomic<u32>>, read_write>,
        debugEnabled: u32,
        bodyCount: u32,
        pairCount: u32,
        pairDispatchCount: u32,
        useCandidatePairs: u32,
        floorDebugBody: u32,
        contactSlop: f32,
        frictionStatic: f32,
        workgroupId: vec3u,
        localId: vec3u,
      ) -> void {
        let gid = workgroupId.x * ${dl}u + localId.x;
        if (gid >= pairDispatchCount) { return; }
        var manifold = gid;
        if (useCandidatePairs > 0u) {
          let activeCandidateCount = min(pairActivity[${h}u], pairDispatchCount);
          if (gid >= activeCandidateCount) { return; }
          manifold = pairActivity[${h}u + gid + 1u];
          if (manifold >= pairDispatchCount) { return; }
        }
        if (manifold >= ${b}u) { return; }
        let pairBase = manifold * ${u}u;

        var i = 0u;
        var j = 0u;
        if (useCandidatePairs > 0u) {
          let packedPair = pairActivity[${m}u + manifold + 1u];
          i = packedPair & 0xFFFFu;
          j = packedPair >> 16u;
          if (i >= j) {
            // Empty fixed candidate slots only need to be marked inactive.
            deactivateManifold(pairContacts, pairBase, 0.0, 0.0);
            return;
          }
        } else {
          var pairIndex = 0u;
          if (manifold >= pairCount || manifold >= ${b}u) { return; }
          pairIndex = manifold;
          if (pairIndex >= pairCount) { return; }

          // Brute-force fallback path (small-N only): decode triangular pair index.
          j = u32(floor((1.0 + sqrt(1.0 + 8.0 * f32(pairIndex))) * 0.5));
          if (j == 0u) { return; }
          var triangular = (j * (j - 1u)) / 2u;
          if (triangular > pairIndex) {
            j -= 1u;
            triangular = (j * (j - 1u)) / 2u;
          }
          i = pairIndex - triangular;
          if (i >= j) { return; }
        }

        let isFloorPair = floorDebugBody != 0xffffffffu && (i == floorDebugBody || j == floorDebugBody);
        if (isFloorPair && debugEnabled > 0u) {
          atomicAdd(&debugCounters[7], 1u);
        }

        let ignoredPairIndex = (j * (j - 1u)) / 2u + i;
        let ignoredPairWord = ignoredPairIndex >> 5u;
        let ignoredPairBit = 1u << (ignoredPairIndex & 31u);
        if ((pairActivity[${_}u + ignoredPairWord] & ignoredPairBit) != 0u) {
          deactivateManifold(pairContacts, pairBase, f32(i), f32(j));
          return;
        }

        let firstInfo = loadContactMeta(pairContacts, pairBase);
        let firstI = u32(firstInfo.x + 0.5);
        let firstJ = u32(firstInfo.y + 0.5);
        if (firstI != i || firstJ != j) {
          if (debugEnabled > 0u) {
            atomicAdd(&debugCounters[0], 1u);
            if (isFloorPair) {
              atomicAdd(&debugCounters[8], 1u);
            }
          }
          deactivateManifold(pairContacts, pairBase, f32(i), f32(j));
        }

        var wasActive = false;
        var prevPairFeature: i32 = -1;
        var prevPairNormal = vec3f(0.0);
        for (var s = 0u; s < ${u}u; s++) {
          let slot = pairBase + s;
          let slotInfo = loadContactMeta(pairContacts, slot);
          if (slotInfo.z > 0.5) {
            if (!wasActive) {
              prevPairFeature = i32(decodePackedBaseFeature(slotInfo.w));
              prevPairNormal = loadContactNormalPen(pairContacts, slot).xyz;
            }
            wasActive = true;
          }
        }

        let hysteresis = 0.35 * contactSlop;
        let sepSlop = contactSlop + select(0.0, hysteresis, wasActive);

        if (i >= bodyCount || j >= bodyCount) {
          deactivateManifold(pairContacts, pairBase, f32(i), f32(j));
          return;
        }

        let invMassA = positions[i].w;
        let invMassB = positions[j].w;
        if (invMassA + invMassB == 0.0) {
          deactivateManifold(pairContacts, pairBase, f32(i), f32(j));
          return;
        }

        let posA = positions[i].xyz;
        let posB = positions[j].xyz;
        let qA = quaternions[i];
        let qB = quaternions[j];
        let shpA = shapes[i];
        let shpB = shapes[j];
        if (!shapesCanCollide(shpA, shpB)) {
          deactivateManifold(pairContacts, pairBase, f32(i), f32(j));
          return;
        }
        let frictionScale = sqrt(max(decodeShapeFriction(shpA.x), 0.0) * max(decodeShapeFriction(shpB.x), 0.0));
        let shapeTypeA = decodeShapeType(shpA.x);
        let shapeTypeB = decodeShapeType(shpB.x);
        let isSphereA = shapeTypeA == SHAPE_TYPE_SPHERE;
        let isSphereB = shapeTypeB == SHAPE_TYPE_SPHERE;
        let specialPair = isSphereA || isSphereB;
        let halfA = vec3f(shpA.y, shpA.z, shpA.w);
        let halfB = vec3f(shpB.y, shpB.z, shpB.w);
        let radiusA = max(halfA.x, 0.0);
        let radiusB = max(halfB.x, 0.0);
        let e0 = vec3f(1.0, 0.0, 0.0);
        let e1 = vec3f(0.0, 1.0, 0.0);
        let e2 = vec3f(0.0, 0.0, 1.0);
        let axA0 = qrot(qA, e0);
        let axA1 = qrot(qA, e1);
        let axA2 = qrot(qA, e2);
        let axB0 = qrot(qB, e0);
        let axB1 = qrot(qB, e1);
        let axB2 = qrot(qB, e2);

        var penetration = 0.0;
        var keepContact = false;
        var specialPointA = vec3f(0.0);
        var specialPointB = vec3f(0.0);
        var specialRAWorld = vec3f(0.0);
        var specialRBWorld = vec3f(0.0);
        var specialContactKey = 0u;
        var specialRefIsA = false;
        var specialRefFeature = 0u;
        var specialIncFeature = 0u;
        var specialManifoldPreferredT1 = vec3f(0.0);
        var specialManifoldHasPreferredT1 = false;
        var bestNormal = vec3f(0.0);
        var bestFeature: i32 = -1;
        var keepRejectClass = 0u;
        var separatedFeature: i32 = -1;
        if (!specialPair) {
        let d = posB - posA;
        let eps = 1e-6;

        let R00 = dot(axA0, axB0); let R01 = dot(axA0, axB1); let R02 = dot(axA0, axB2);
        let R10 = dot(axA1, axB0); let R11 = dot(axA1, axB1); let R12 = dot(axA1, axB2);
        let R20 = dot(axA2, axB0); let R21 = dot(axA2, axB1); let R22 = dot(axA2, axB2);

        let aR00 = abs(R00) + eps; let aR01 = abs(R01) + eps; let aR02 = abs(R02) + eps;
        let aR10 = abs(R10) + eps; let aR11 = abs(R11) + eps; let aR12 = abs(R12) + eps;
        let aR20 = abs(R20) + eps; let aR21 = abs(R21) + eps; let aR22 = abs(R22) + eps;

        let tA = vec3f(dot(d, axA0), dot(d, axA1), dot(d, axA2));
        var minPen = 1e30;
        var faceMinPen = 1e30;
        var faceBestNormal = vec3f(0.0);
        var faceBestFeature: i32 = -1;
        var separated = false;

        // Face normals of A
        {
          let ra = halfA.x;
          let rb = aR00 * halfB.x + aR01 * halfB.y + aR02 * halfB.z;
          let s = abs(tA.x);
          let pen = ra + rb - s;
          if (pen < -sepSlop) { separated = true; separatedFeature = 0; }
          if (!separated && pen < faceMinPen) {
            faceMinPen = pen;
            faceBestNormal = select(axA0, -axA0, tA.x < 0.0);
            faceBestFeature = 0;
          }
          if (!separated && pen < minPen) {
            minPen = pen;
            bestNormal = select(axA0, -axA0, tA.x < 0.0);
            bestFeature = 0;
          }
        }
        if (!separated) {
          let ra = halfA.y;
          let rb = aR10 * halfB.x + aR11 * halfB.y + aR12 * halfB.z;
          let s = abs(tA.y);
          let pen = ra + rb - s;
          if (pen < -sepSlop) { separated = true; separatedFeature = 1; }
          if (!separated && pen < faceMinPen) {
            faceMinPen = pen;
            faceBestNormal = select(axA1, -axA1, tA.y < 0.0);
            faceBestFeature = 1;
          }
          if (!separated && pen < minPen) {
            minPen = pen;
            bestNormal = select(axA1, -axA1, tA.y < 0.0);
            bestFeature = 1;
          }
        }
        if (!separated) {
          let ra = halfA.z;
          let rb = aR20 * halfB.x + aR21 * halfB.y + aR22 * halfB.z;
          let s = abs(tA.z);
          let pen = ra + rb - s;
          if (pen < -sepSlop) { separated = true; separatedFeature = 2; }
          if (!separated && pen < faceMinPen) {
            faceMinPen = pen;
            faceBestNormal = select(axA2, -axA2, tA.z < 0.0);
            faceBestFeature = 2;
          }
          if (!separated && pen < minPen) {
            minPen = pen;
            bestNormal = select(axA2, -axA2, tA.z < 0.0);
            bestFeature = 2;
          }
        }

        // Face normals of B
        let tB = vec3f(dot(d, axB0), dot(d, axB1), dot(d, axB2));
        if (!separated) {
          let ra = aR00 * halfA.x + aR10 * halfA.y + aR20 * halfA.z;
          let rb = halfB.x;
          let s = abs(tB.x);
          let pen = ra + rb - s;
          if (pen < -sepSlop) { separated = true; separatedFeature = 3; }
          if (!separated && pen < faceMinPen) {
            faceMinPen = pen;
            faceBestNormal = select(axB0, -axB0, tB.x < 0.0);
            faceBestFeature = 3;
          }
          if (!separated && pen < minPen) {
            minPen = pen;
            bestNormal = select(axB0, -axB0, tB.x < 0.0);
            bestFeature = 3;
          }
        }
        if (!separated) {
          let ra = aR01 * halfA.x + aR11 * halfA.y + aR21 * halfA.z;
          let rb = halfB.y;
          let s = abs(tB.y);
          let pen = ra + rb - s;
          if (pen < -sepSlop) { separated = true; separatedFeature = 4; }
          if (!separated && pen < faceMinPen) {
            faceMinPen = pen;
            faceBestNormal = select(axB1, -axB1, tB.y < 0.0);
            faceBestFeature = 4;
          }
          if (!separated && pen < minPen) {
            minPen = pen;
            bestNormal = select(axB1, -axB1, tB.y < 0.0);
            bestFeature = 4;
          }
        }
        if (!separated) {
          let ra = aR02 * halfA.x + aR12 * halfA.y + aR22 * halfA.z;
          let rb = halfB.z;
          let s = abs(tB.z);
          let pen = ra + rb - s;
          if (pen < -sepSlop) { separated = true; separatedFeature = 5; }
          if (!separated && pen < faceMinPen) {
            faceMinPen = pen;
            faceBestNormal = select(axB2, -axB2, tB.z < 0.0);
            faceBestFeature = 5;
          }
          if (!separated && pen < minPen) {
            minPen = pen;
            bestNormal = select(axB2, -axB2, tB.z < 0.0);
            bestFeature = 5;
          }
        }

        // Edge-edge axes (9)
        if (!separated) {
          let axis = cross(axA0, axB0);
          let len2 = dot(axis, axis);
          if (len2 > 1e-6) {
            let invLen = inverseSqrt(len2);
            let n = axis * invLen;
            let ra = halfA.y * aR20 + halfA.z * aR10;
            let rb = halfB.y * aR02 + halfB.z * aR01;
            let s = abs(dot(d, n));
            let pen = (ra + rb) * invLen - s;
            if (pen < -sepSlop) { separated = true; separatedFeature = 6; }
            if (!separated && pen < minPen) {
              minPen = pen;
              bestNormal = select(n, -n, dot(d, n) < 0.0);
              bestFeature = 6;
            }
          }
        }
        if (!separated) {
          let axis = cross(axA0, axB1);
          let len2 = dot(axis, axis);
          if (len2 > 1e-6) {
            let invLen = inverseSqrt(len2);
            let n = axis * invLen;
            let ra = halfA.y * aR21 + halfA.z * aR11;
            let rb = halfB.x * aR02 + halfB.z * aR00;
            let s = abs(dot(d, n));
            let pen = (ra + rb) * invLen - s;
            if (pen < -sepSlop) { separated = true; separatedFeature = 7; }
            if (!separated && pen < minPen) {
              minPen = pen;
              bestNormal = select(n, -n, dot(d, n) < 0.0);
              bestFeature = 7;
            }
          }
        }
        if (!separated) {
          let axis = cross(axA0, axB2);
          let len2 = dot(axis, axis);
          if (len2 > 1e-6) {
            let invLen = inverseSqrt(len2);
            let n = axis * invLen;
            let ra = halfA.y * aR22 + halfA.z * aR12;
            let rb = halfB.x * aR01 + halfB.y * aR00;
            let s = abs(dot(d, n));
            let pen = (ra + rb) * invLen - s;
            if (pen < -sepSlop) { separated = true; separatedFeature = 8; }
            if (!separated && pen < minPen) {
              minPen = pen;
              bestNormal = select(n, -n, dot(d, n) < 0.0);
              bestFeature = 8;
            }
          }
        }
        if (!separated) {
          let axis = cross(axA1, axB0);
          let len2 = dot(axis, axis);
          if (len2 > 1e-6) {
            let invLen = inverseSqrt(len2);
            let n = axis * invLen;
            let ra = halfA.x * aR20 + halfA.z * aR00;
            let rb = halfB.y * aR12 + halfB.z * aR11;
            let s = abs(dot(d, n));
            let pen = (ra + rb) * invLen - s;
            if (pen < -sepSlop) { separated = true; separatedFeature = 9; }
            if (!separated && pen < minPen) {
              minPen = pen;
              bestNormal = select(n, -n, dot(d, n) < 0.0);
              bestFeature = 9;
            }
          }
        }
        if (!separated) {
          let axis = cross(axA1, axB1);
          let len2 = dot(axis, axis);
          if (len2 > 1e-6) {
            let invLen = inverseSqrt(len2);
            let n = axis * invLen;
            let ra = halfA.x * aR21 + halfA.z * aR01;
            let rb = halfB.x * aR12 + halfB.z * aR10;
            let s = abs(dot(d, n));
            let pen = (ra + rb) * invLen - s;
            if (pen < -sepSlop) { separated = true; separatedFeature = 10; }
            if (!separated && pen < minPen) {
              minPen = pen;
              bestNormal = select(n, -n, dot(d, n) < 0.0);
              bestFeature = 10;
            }
          }
        }
        if (!separated) {
          let axis = cross(axA1, axB2);
          let len2 = dot(axis, axis);
          if (len2 > 1e-6) {
            let invLen = inverseSqrt(len2);
            let n = axis * invLen;
            let ra = halfA.x * aR22 + halfA.z * aR02;
            let rb = halfB.x * aR11 + halfB.y * aR10;
            let s = abs(dot(d, n));
            let pen = (ra + rb) * invLen - s;
            if (pen < -sepSlop) { separated = true; separatedFeature = 11; }
            if (!separated && pen < minPen) {
              minPen = pen;
              bestNormal = select(n, -n, dot(d, n) < 0.0);
              bestFeature = 11;
            }
          }
        }
        if (!separated) {
          let axis = cross(axA2, axB0);
          let len2 = dot(axis, axis);
          if (len2 > 1e-6) {
            let invLen = inverseSqrt(len2);
            let n = axis * invLen;
            let ra = halfA.x * aR10 + halfA.y * aR00;
            let rb = halfB.y * aR22 + halfB.z * aR21;
            let s = abs(dot(d, n));
            let pen = (ra + rb) * invLen - s;
            if (pen < -sepSlop) { separated = true; separatedFeature = 12; }
            if (!separated && pen < minPen) {
              minPen = pen;
              bestNormal = select(n, -n, dot(d, n) < 0.0);
              bestFeature = 12;
            }
          }
        }
        if (!separated) {
          let axis = cross(axA2, axB1);
          let len2 = dot(axis, axis);
          if (len2 > 1e-6) {
            let invLen = inverseSqrt(len2);
            let n = axis * invLen;
            let ra = halfA.x * aR11 + halfA.y * aR01;
            let rb = halfB.x * aR22 + halfB.z * aR20;
            let s = abs(dot(d, n));
            let pen = (ra + rb) * invLen - s;
            if (pen < -sepSlop) { separated = true; separatedFeature = 13; }
            if (!separated && pen < minPen) {
              minPen = pen;
              bestNormal = select(n, -n, dot(d, n) < 0.0);
              bestFeature = 13;
            }
          }
        }
        if (!separated) {
          let axis = cross(axA2, axB2);
          let len2 = dot(axis, axis);
          if (len2 > 1e-6) {
            let invLen = inverseSqrt(len2);
            let n = axis * invLen;
            let ra = halfA.x * aR12 + halfA.y * aR02;
            let rb = halfB.x * aR21 + halfB.y * aR20;
            let s = abs(dot(d, n));
            let pen = (ra + rb) * invLen - s;
            if (pen < -sepSlop) { separated = true; separatedFeature = 14; }
            if (!separated && pen < minPen) {
              minPen = pen;
              bestNormal = select(n, -n, dot(d, n) < 0.0);
              bestFeature = 14;
            }
          }
        }

        // SAT winner hysteresis: if the previous active feature is still close in
        // penetration, keep it to avoid face/edge normal flicker on rotating boxes.
        if (!separated && wasActive && prevPairFeature >= 0) {
          let axisHysteresis = 0.5 * contactSlop;
          var prevPen = 1e30;
          var prevNormalEval = bestNormal;
          var prevValid = false;

          if (prevPairFeature == 0) {
            prevPen = halfA.x + (aR00 * halfB.x + aR01 * halfB.y + aR02 * halfB.z) - abs(tA.x);
            prevNormalEval = select(axA0, -axA0, tA.x < 0.0);
            prevValid = true;
          } else if (prevPairFeature == 1) {
            prevPen = halfA.y + (aR10 * halfB.x + aR11 * halfB.y + aR12 * halfB.z) - abs(tA.y);
            prevNormalEval = select(axA1, -axA1, tA.y < 0.0);
            prevValid = true;
          } else if (prevPairFeature == 2) {
            prevPen = halfA.z + (aR20 * halfB.x + aR21 * halfB.y + aR22 * halfB.z) - abs(tA.z);
            prevNormalEval = select(axA2, -axA2, tA.z < 0.0);
            prevValid = true;
          } else if (prevPairFeature == 3) {
            prevPen = (aR00 * halfA.x + aR10 * halfA.y + aR20 * halfA.z) + halfB.x - abs(tB.x);
            prevNormalEval = select(axB0, -axB0, tB.x < 0.0);
            prevValid = true;
          } else if (prevPairFeature == 4) {
            prevPen = (aR01 * halfA.x + aR11 * halfA.y + aR21 * halfA.z) + halfB.y - abs(tB.y);
            prevNormalEval = select(axB1, -axB1, tB.y < 0.0);
            prevValid = true;
          } else if (prevPairFeature == 5) {
            prevPen = (aR02 * halfA.x + aR12 * halfA.y + aR22 * halfA.z) + halfB.z - abs(tB.z);
            prevNormalEval = select(axB2, -axB2, tB.z < 0.0);
            prevValid = true;
          } else if (prevPairFeature == 6) {
            let axis = cross(axA0, axB0);
            let len2 = dot(axis, axis);
            if (len2 > 1e-6) {
              let invLen = inverseSqrt(len2);
              let n = axis * invLen;
              let ra = halfA.y * aR20 + halfA.z * aR10;
              let rb = halfB.y * aR02 + halfB.z * aR01;
              prevPen = (ra + rb) * invLen - abs(dot(d, n));
              prevNormalEval = select(n, -n, dot(d, n) < 0.0);
              prevValid = true;
            }
          } else if (prevPairFeature == 7) {
            let axis = cross(axA0, axB1);
            let len2 = dot(axis, axis);
            if (len2 > 1e-6) {
              let invLen = inverseSqrt(len2);
              let n = axis * invLen;
              let ra = halfA.y * aR21 + halfA.z * aR11;
              let rb = halfB.x * aR02 + halfB.z * aR00;
              prevPen = (ra + rb) * invLen - abs(dot(d, n));
              prevNormalEval = select(n, -n, dot(d, n) < 0.0);
              prevValid = true;
            }
          } else if (prevPairFeature == 8) {
            let axis = cross(axA0, axB2);
            let len2 = dot(axis, axis);
            if (len2 > 1e-6) {
              let invLen = inverseSqrt(len2);
              let n = axis * invLen;
              let ra = halfA.y * aR22 + halfA.z * aR12;
              let rb = halfB.x * aR01 + halfB.y * aR00;
              prevPen = (ra + rb) * invLen - abs(dot(d, n));
              prevNormalEval = select(n, -n, dot(d, n) < 0.0);
              prevValid = true;
            }
          } else if (prevPairFeature == 9) {
            let axis = cross(axA1, axB0);
            let len2 = dot(axis, axis);
            if (len2 > 1e-6) {
              let invLen = inverseSqrt(len2);
              let n = axis * invLen;
              let ra = halfA.x * aR20 + halfA.z * aR00;
              let rb = halfB.y * aR12 + halfB.z * aR11;
              prevPen = (ra + rb) * invLen - abs(dot(d, n));
              prevNormalEval = select(n, -n, dot(d, n) < 0.0);
              prevValid = true;
            }
          } else if (prevPairFeature == 10) {
            let axis = cross(axA1, axB1);
            let len2 = dot(axis, axis);
            if (len2 > 1e-6) {
              let invLen = inverseSqrt(len2);
              let n = axis * invLen;
              let ra = halfA.x * aR21 + halfA.z * aR01;
              let rb = halfB.x * aR12 + halfB.z * aR10;
              prevPen = (ra + rb) * invLen - abs(dot(d, n));
              prevNormalEval = select(n, -n, dot(d, n) < 0.0);
              prevValid = true;
            }
          } else if (prevPairFeature == 11) {
            let axis = cross(axA1, axB2);
            let len2 = dot(axis, axis);
            if (len2 > 1e-6) {
              let invLen = inverseSqrt(len2);
              let n = axis * invLen;
              let ra = halfA.x * aR22 + halfA.z * aR02;
              let rb = halfB.x * aR11 + halfB.y * aR10;
              prevPen = (ra + rb) * invLen - abs(dot(d, n));
              prevNormalEval = select(n, -n, dot(d, n) < 0.0);
              prevValid = true;
            }
          } else if (prevPairFeature == 12) {
            let axis = cross(axA2, axB0);
            let len2 = dot(axis, axis);
            if (len2 > 1e-6) {
              let invLen = inverseSqrt(len2);
              let n = axis * invLen;
              let ra = halfA.x * aR10 + halfA.y * aR00;
              let rb = halfB.y * aR22 + halfB.z * aR21;
              prevPen = (ra + rb) * invLen - abs(dot(d, n));
              prevNormalEval = select(n, -n, dot(d, n) < 0.0);
              prevValid = true;
            }
          } else if (prevPairFeature == 13) {
            let axis = cross(axA2, axB1);
            let len2 = dot(axis, axis);
            if (len2 > 1e-6) {
              let invLen = inverseSqrt(len2);
              let n = axis * invLen;
              let ra = halfA.x * aR11 + halfA.y * aR01;
              let rb = halfB.x * aR22 + halfB.z * aR20;
              prevPen = (ra + rb) * invLen - abs(dot(d, n));
              prevNormalEval = select(n, -n, dot(d, n) < 0.0);
              prevValid = true;
            }
          } else if (prevPairFeature == 14) {
            let axis = cross(axA2, axB2);
            let len2 = dot(axis, axis);
            if (len2 > 1e-6) {
              let invLen = inverseSqrt(len2);
              let n = axis * invLen;
              let ra = halfA.x * aR12 + halfA.y * aR02;
              let rb = halfB.x * aR21 + halfB.y * aR20;
              prevPen = (ra + rb) * invLen - abs(dot(d, n));
              prevNormalEval = select(n, -n, dot(d, n) < 0.0);
              prevValid = true;
            }
          }

          if (prevValid && prevPen > -sepSlop && prevPen <= minPen + axisHysteresis && dot(prevPairNormal, prevNormalEval) > 0.85) {
            minPen = prevPen;
            bestNormal = prevNormalEval;
            bestFeature = prevPairFeature;
          }
        }

        // Edge-edge axes are noisy near face-edge ties on rotating boxes.
        // Require a clear penetration advantage before choosing an edge axis.
        if (!separated && bestFeature >= 6 && faceBestFeature >= 0) {
          let edgeWinMargin = 0.5 * contactSlop;
          if (minPen >= faceMinPen - edgeWinMargin) {
            minPen = faceMinPen;
            bestNormal = faceBestNormal;
            bestFeature = faceBestFeature;
          }
        }

        penetration = minPen;
        keepContact = !separated
          && (penetration > -contactSlop || (wasActive && penetration > -(contactSlop + hysteresis)));
        if (!keepContact) {
          keepRejectClass = select(select(14u, 15u, wasActive), 13u, separated);
        }
        } else {
          if (isSphereA && isSphereB) {
            let centerDelta = posB - posA;
            let centerDist2 = dot(centerDelta, centerDelta);
            let rSum = radiusA + radiusB;
            if (centerDist2 > 1e-12) {
              let centerDist = sqrt(centerDist2);
              bestNormal = centerDelta / centerDist;
              penetration = rSum - centerDist;
            } else {
              bestNormal = select(prevPairNormal, vec3f(0.0, 1.0, 0.0), dot(prevPairNormal, prevPairNormal) < 1e-12);
              penetration = rSum;
            }
            bestFeature = 6;
            keepContact = penetration > -contactSlop || (wasActive && penetration > -(contactSlop + hysteresis));
            if (!keepContact) {
              keepRejectClass = select(14u, 15u, wasActive);
            }
            specialPointA = posA + bestNormal * radiusA;
            specialPointB = posB - bestNormal * radiusB;
            specialRAWorld = specialPointA - posA;
            specialRBWorld = specialPointB - posB;
            specialContactKey = packEdgeContactFeature(0u, 0u);
          } else if (isSphereA != isSphereB) {
            let sphereIsA = isSphereA;
            let sphereCenter = select(posB, posA, sphereIsA);
            let boxCenter = select(posA, posB, sphereIsA);
            let sphereRadius = select(radiusB, radiusA, sphereIsA);
            let halfBox = select(halfA, halfB, sphereIsA);
            let boxAx0 = select(axA0, axB0, sphereIsA);
            let boxAx1 = select(axA1, axB1, sphereIsA);
            let boxAx2 = select(axA2, axB2, sphereIsA);

            let rel = sphereCenter - boxCenter;
            let sphereLocal = vec3f(dot(rel, boxAx0), dot(rel, boxAx1), dot(rel, boxAx2));
            let clampedLocal = clamp(sphereLocal, -halfBox, halfBox);
            let deltaLocal = sphereLocal - clampedLocal;
            var boxPointLocal = clampedLocal;
            var faceAxis = 0u;
            var faceSign = 1.0;
            var boxOutwardNormal = boxAx0;
            let outsideDist2 = dot(deltaLocal, deltaLocal);

            if (outsideDist2 > 1e-12) {
              faceAxis = dominantAbsAxis3(deltaLocal);
              faceSign = sgnnz(axisValue3(deltaLocal, faceAxis));
              boxOutwardNormal = axisVector3(faceAxis, boxAx0, boxAx1, boxAx2) * faceSign;
              penetration = sphereRadius - sqrt(outsideDist2);
            } else {
              let faceGap = halfBox - abs(sphereLocal);
              faceAxis = leastAxis3(faceGap);
              faceSign = sgnnz(axisValue3(sphereLocal, faceAxis));
              if (faceAxis == 0u) {
                boxPointLocal = vec3f(faceSign * halfBox.x, sphereLocal.y, sphereLocal.z);
              } else if (faceAxis == 1u) {
                boxPointLocal = vec3f(sphereLocal.x, faceSign * halfBox.y, sphereLocal.z);
              } else {
                boxPointLocal = vec3f(sphereLocal.x, sphereLocal.y, faceSign * halfBox.z);
              }
              boxOutwardNormal = axisVector3(faceAxis, boxAx0, boxAx1, boxAx2) * faceSign;
              penetration = sphereRadius + axisValue3(faceGap, faceAxis);
            }

            keepContact = penetration > -contactSlop || (wasActive && penetration > -(contactSlop + hysteresis));
            if (!keepContact) {
              keepRejectClass = select(14u, 15u, wasActive);
            }
            let boxPointWorld = boxCenter
              + boxAx0 * boxPointLocal.x
              + boxAx1 * boxPointLocal.y
              + boxAx2 * boxPointLocal.z;
            let spherePointWorld = sphereCenter - boxOutwardNormal * sphereRadius;
            bestNormal = select(boxOutwardNormal, -boxOutwardNormal, sphereIsA);
            bestFeature = i32(faceAxis) + select(0, 3, sphereIsA);
            specialRefIsA = !sphereIsA;
            specialRefFeature = faceAxis;
            specialIncFeature = 0u;
            specialContactKey = packFaceContactFeature(!sphereIsA, faceAxis, 0u, 0u);
            specialPointA = select(boxPointWorld, spherePointWorld, sphereIsA);
            specialPointB = select(spherePointWorld, boxPointWorld, sphereIsA);
            specialRAWorld = specialPointA - posA;
            specialRBWorld = specialPointB - posB;
            specialManifoldHasPreferredT1 = true;
            specialManifoldPreferredT1 = select(
              axisVector3(0u, boxAx0, boxAx1, boxAx2),
              axisVector3(1u, boxAx0, boxAx1, boxAx2),
              faceAxis == 0u,
            );
            if (faceAxis == 1u) {
              specialManifoldPreferredT1 = boxAx2;
            } else if (faceAxis == 2u) {
              specialManifoldPreferredT1 = boxAx0;
            }
          }
        }
        if (!keepContact) {
          if (debugEnabled > 0u && isFloorPair) {
            atomicAdd(&debugCounters[9], 1u);
            if (keepRejectClass == 13u) {
              atomicAdd(&debugCounters[13], 1u);
              if (separatedFeature >= 0 && separatedFeature <= 2) {
                atomicAdd(&debugCounters[16u + u32(separatedFeature)], 1u);
              } else if (separatedFeature >= 3 && separatedFeature <= 5) {
                atomicAdd(&debugCounters[16u + u32(separatedFeature)], 1u);
              } else if (separatedFeature >= 6) {
                atomicAdd(&debugCounters[22], 1u);
              } else {
                atomicAdd(&debugCounters[23], 1u);
              }
            } else if (keepRejectClass == 15u) {
              atomicAdd(&debugCounters[15], 1u);
            } else {
              atomicAdd(&debugCounters[14], 1u);
            }
          }
          deactivateManifold(pairContacts, pairBase, f32(i), f32(j));
          return;
        }
        // A degenerate normal here means no SAT axis was ever selected (e.g.
        // NaN poses make every comparison false while keepContact stays true).
        // Without this, such pairs emit "valid" zero-normal contacts that
        // flood the constraint lists.
        if (!specialPair && dot(bestNormal, bestNormal) < 0.5) {
          deactivateManifold(pairContacts, pairBase, f32(i), f32(j));
          return;
        }
        let storedPenetration = max(penetration, 0.0);
        // Keep more temporary face candidates, then reduce to manifold slots by
        // spread (not only depth) for better torque stability.
        var candidatePointWorld: array<vec3f, 8>;
        var candidateRAWorld: array<vec3f, 8>;
        var candidateRBWorld: array<vec3f, 8>;
        var candidatePenetration: array<f32, 8>;
        var candidateContactKey: array<u32, 8>;
        var candidateCount = 0u;
        var manifoldPreferredT1 = specialManifoldPreferredT1;
        var manifoldHasPreferredT1 = specialManifoldHasPreferredT1;
        var refIsA = specialRefIsA;
        var refFeature = specialRefFeature;
        var incFeature = specialIncFeature;
        if (specialPair) {
          candidatePointWorld[0] = 0.5 * (specialPointA + specialPointB);
          candidateRAWorld[0] = specialRAWorld;
          candidateRBWorld[0] = specialRBWorld;
          candidatePenetration[0] = storedPenetration;
          candidateContactKey[0] = specialContactKey;
          candidateCount = 1u;
        } else if (bestFeature >= 6) {
          // Edge-edge: keep closest-segment single contact.
          let code = u32(bestFeature - 6);
          let k = code / 3u;
          let l = code - k * 3u;

          var uA = vec3f(0.0);
          var sA1 = vec3f(0.0);
          var sA2 = vec3f(0.0);
          var huA = 0.0;
          var hA1 = 0.0;
          var hA2 = 0.0;
          if (k == 0u) {
            uA = axA0; sA1 = axA1; sA2 = axA2;
            huA = halfA.x; hA1 = halfA.y; hA2 = halfA.z;
          } else if (k == 1u) {
            uA = axA1; sA1 = axA0; sA2 = axA2;
            huA = halfA.y; hA1 = halfA.x; hA2 = halfA.z;
          } else {
            uA = axA2; sA1 = axA0; sA2 = axA1;
            huA = halfA.z; hA1 = halfA.x; hA2 = halfA.y;
          }

          let sgnA1 = sgnnz(dot(sA1, bestNormal));
          let sgnA2 = sgnnz(dot(sA2, bestNormal));
          let cA = posA + sA1 * (sgnA1 * hA1) + sA2 * (sgnA2 * hA2);
          let pA0 = cA - uA * huA;
          let pA1 = cA + uA * huA;

          var uB = vec3f(0.0);
          var sB1 = vec3f(0.0);
          var sB2 = vec3f(0.0);
          var huB = 0.0;
          var hB1 = 0.0;
          var hB2 = 0.0;
          if (l == 0u) {
            uB = axB0; sB1 = axB1; sB2 = axB2;
            huB = halfB.x; hB1 = halfB.y; hB2 = halfB.z;
          } else if (l == 1u) {
            uB = axB1; sB1 = axB0; sB2 = axB2;
            huB = halfB.y; hB1 = halfB.x; hB2 = halfB.z;
          } else {
            uB = axB2; sB1 = axB0; sB2 = axB1;
            huB = halfB.z; hB1 = halfB.x; hB2 = halfB.y;
          }

          let sgnB1 = sgnnz(-dot(sB1, bestNormal));
          let sgnB2 = sgnnz(-dot(sB2, bestNormal));
          let cB = posB + sB1 * (sgnB1 * hB1) + sB2 * (sgnB2 * hB2);
          let pB0 = cB - uB * huB;
          let pB1 = cB + uB * huB;

          let seg = closestPointsSegments(pA0, pA1, pB0, pB1);
          let raWorld = seg.p - posA;
          let rbWorld = seg.q - posB;
          candidatePointWorld[0] = 0.5 * (seg.p + seg.q);
          candidateRAWorld[0] = raWorld;
          candidateRBWorld[0] = rbWorld;
          candidatePenetration[0] = storedPenetration;
          candidateContactKey[0] = packEdgeContactFeature(k, l);
          candidateCount = 1u;
          manifoldPreferredT1 = uA;
          manifoldHasPreferredT1 = true;
        } else {
          // Face features: generate up to 8 clipped candidates, then reduce.
          var refPos = vec3f(0.0);
          var refHalf = vec3f(0.0);
          var refX = vec3f(0.0);
          var refY = vec3f(0.0);
          var refZ = vec3f(0.0);
          var incPos = vec3f(0.0);
          var incHalf = vec3f(0.0);
          var incX = vec3f(0.0);
          var incY = vec3f(0.0);
          var incZ = vec3f(0.0);
          if (bestFeature < 3) {
            refPos = posA; refHalf = halfA; refX = axA0; refY = axA1; refZ = axA2;
            incPos = posB; incHalf = halfB; incX = axB0; incY = axB1; incZ = axB2;
            refFeature = u32(bestFeature);
          } else {
            refPos = posB; refHalf = halfB; refX = axB0; refY = axB1; refZ = axB2;
            incPos = posA; incHalf = halfA; incX = axA0; incY = axA1; incZ = axA2;
            refFeature = u32(bestFeature - 3);
          }

          var refAxis = vec3f(0.0);
          var refU = vec3f(0.0);
          var refV = vec3f(0.0);
          var refH = 0.0;
          var refHU = 0.0;
          var refHV = 0.0;
          if (refFeature == 0u) {
            refAxis = refX; refU = refY; refV = refZ;
            refH = refHalf.x; refHU = refHalf.y; refHV = refHalf.z;
          } else if (refFeature == 1u) {
            refAxis = refY; refU = refX; refV = refZ;
            refH = refHalf.y; refHU = refHalf.x; refHV = refHalf.z;
          } else {
            refAxis = refZ; refU = refX; refV = refY;
            refH = refHalf.z; refHU = refHalf.x; refHV = refHalf.y;
          }

          refIsA = bestFeature < 3;
          // Reference-face clipping uses the reference outward normal.
          let nRef = select(-bestNormal, bestNormal, refIsA);
          let refSign = sgnnz(dot(refAxis, nRef));
          let refCenter = refPos + refAxis * (refSign * refH);
          manifoldPreferredT1 = refU;
          manifoldHasPreferredT1 = true;

          let ad0 = abs(dot(incX, nRef));
          let ad1 = abs(dot(incY, nRef));
          let ad2 = abs(dot(incZ, nRef));
          incFeature = 0u;
          if (ad1 > ad0 && ad1 >= ad2) {
            incFeature = 1u;
          } else if (ad2 > ad0 && ad2 > ad1) {
            incFeature = 2u;
          }

          var incAxis = vec3f(0.0);
          var incU = vec3f(0.0);
          var incV = vec3f(0.0);
          var incH = 0.0;
          var incHU = 0.0;
          var incHV = 0.0;
          if (incFeature == 0u) {
            incAxis = incX; incU = incY; incV = incZ;
            incH = incHalf.x; incHU = incHalf.y; incHV = incHalf.z;
          } else if (incFeature == 1u) {
            incAxis = incY; incU = incX; incV = incZ;
            incH = incHalf.y; incHU = incHalf.x; incHV = incHalf.z;
          } else {
            incAxis = incZ; incU = incX; incV = incY;
            incH = incHalf.z; incHU = incHalf.x; incHV = incHalf.y;
          }

          // Incident face must oppose the reference normal.
          let incSign = select(1.0, -1.0, dot(incAxis, nRef) > 0.0);
          let incCenter = incPos + incAxis * (incSign * incH);

          var polyIn: array<vec3f, 8>;
          var polyOut: array<vec3f, 8>;
          polyIn[0] = incCenter + incU * incHU + incV * incHV;
          polyIn[1] = incCenter - incU * incHU + incV * incHV;
          polyIn[2] = incCenter - incU * incHU - incV * incHV;
          polyIn[3] = incCenter + incU * incHU - incV * incHV;
          var polyCount = 4u;

          for (var planeIdx = 0u; planeIdx < 4u; planeIdx++) {
            if (polyCount == 0u) { break; }

            var planeN = vec3f(0.0);
            var planeD = 0.0;
            if (planeIdx == 0u) {
              planeN = refU;
              planeD = dot(refU, refCenter) + refHU;
            } else if (planeIdx == 1u) {
              planeN = -refU;
              planeD = dot(-refU, refCenter) + refHU;
            } else if (planeIdx == 2u) {
              planeN = refV;
              planeD = dot(refV, refCenter) + refHV;
            } else {
              planeN = -refV;
              planeD = dot(-refV, refCenter) + refHV;
            }

            var outCount = 0u;
            for (var vi = 0u; vi < polyCount; vi++) {
              let a = polyIn[vi];
              let b = polyIn[(vi + 1u) % polyCount];
              let da = dot(planeN, a) - planeD;
              let db = dot(planeN, b) - planeD;
              let inA = da <= 0.0;
              let inB = db <= 0.0;

              if (inA && inB) {
                if (outCount < 8u) {
                  polyOut[outCount] = b;
                  outCount += 1u;
                }
              } else if (inA && !inB) {
                let denom = da - db;
                if (abs(denom) > 1e-6 && outCount < 8u) {
                  let t = da / denom;
                  polyOut[outCount] = a + (b - a) * t;
                  outCount += 1u;
                }
              } else if (!inA && inB) {
                let denom = da - db;
                if (abs(denom) > 1e-6 && outCount < 8u) {
                  let t = da / denom;
                  polyOut[outCount] = a + (b - a) * t;
                  outCount += 1u;
                }
                if (outCount < 8u) {
                  polyOut[outCount] = b;
                  outCount += 1u;
                }
              }
            }

            polyCount = outCount;
            for (var vi = 0u; vi < polyCount; vi++) {
              polyIn[vi] = polyOut[vi];
            }
          }

          for (var vi = 0u; vi < polyCount; vi++) {
            let p = polyIn[vi];
            // Signed distance to reference plane (outward normal = nRef).
            let dist = dot(nRef, p - refCenter);
            if (dist > contactSlop) { continue; }

            let pStored = max(-dist, 0.0);
            let pRef = p - nRef * dist;
            let xA = select(p, pRef, refIsA);
            let xB = select(pRef, p, refIsA);
            // Keep the manifold point at the midpoint for dedupe/reduction,
            // but store distinct surface anchors for A/B like the reference.
            let cp = 0.5 * (xA + xB);
            var duplicate = false;
            for (var c = 0u; c < candidateCount; c++) {
              let dd = cp - candidatePointWorld[c];
              if (dot(dd, dd) < 1e-6) {
                duplicate = true;
                if (pStored > candidatePenetration[c]) {
                  candidatePointWorld[c] = cp;
                  candidateRAWorld[c] = xA - posA;
                  candidateRBWorld[c] = xB - posB;
                  candidatePenetration[c] = pStored;
                }
              }
            }
            if (duplicate) { continue; }

            if (candidateCount < 8u) {
              candidatePointWorld[candidateCount] = cp;
              candidateRAWorld[candidateCount] = xA - posA;
              candidateRBWorld[candidateCount] = xB - posB;
              candidatePenetration[candidateCount] = pStored;
              candidateContactKey[candidateCount] = packFaceContactFeature(refIsA, refFeature, incFeature, min(vi, 7u));
              candidateCount += 1u;
            }
          }
        }

        if (candidateCount > ${u}u) {
          // 4-point manifold reduction heuristic:
          // 1) deepest, 2) farthest from deepest,
          // 3) max triangle area, 4) max min-distance from previous 3.
          var selectedIdx: array<u32, ${u}>;
          var selCount = 0u;

          var deepestIdx = 0u;
          var deepestPen = -1e30;
          for (var c = 0u; c < candidateCount; c++) {
            if (candidatePenetration[c] > deepestPen) {
              deepestPen = candidatePenetration[c];
              deepestIdx = c;
            }
          }
          selectedIdx[0] = deepestIdx;
          selCount = 1u;

          if (${u}u > 1u) {
            var farIdx = deepestIdx;
            var farD2 = -1.0;
            let p0 = candidatePointWorld[deepestIdx];
            for (var c = 0u; c < candidateCount; c++) {
              if (c == deepestIdx) { continue; }
              let dp = candidatePointWorld[c] - p0;
              let d2 = dot(dp, dp);
              if (d2 > farD2) {
                farD2 = d2;
                farIdx = c;
              }
            }
            selectedIdx[1] = farIdx;
            selCount = 2u;
          }

          if (${u}u > 2u) {
            var areaIdx = selectedIdx[0];
            var areaBest = -1.0;
            let p0 = candidatePointWorld[selectedIdx[0]];
            let p1 = candidatePointWorld[selectedIdx[1]];
            let base = p1 - p0;
            for (var c = 0u; c < candidateCount; c++) {
              if (c == selectedIdx[0] || c == selectedIdx[1]) { continue; }
              let v = candidatePointWorld[c] - p0;
              let cr = cross(base, v);
              let a2 = dot(cr, cr);
              if (a2 > areaBest) {
                areaBest = a2;
                areaIdx = c;
              }
            }
            selectedIdx[2] = areaIdx;
            selCount = 3u;
          }

          if (${u}u > 3u) {
            var spreadIdx = selectedIdx[0];
            var spreadBest = -1.0;
            for (var c = 0u; c < candidateCount; c++) {
              var used = false;
              for (var s = 0u; s < selCount; s++) {
                if (c == selectedIdx[s]) {
                  used = true;
                }
              }
              if (used) { continue; }

              var minD2 = 1e30;
              for (var s = 0u; s < selCount; s++) {
                let dp = candidatePointWorld[c] - candidatePointWorld[selectedIdx[s]];
                let d2 = dot(dp, dp);
                if (d2 < minD2) {
                  minD2 = d2;
                }
              }
              if (minD2 > spreadBest) {
                spreadBest = minD2;
                spreadIdx = c;
              }
            }
            selectedIdx[3] = spreadIdx;
            selCount = 4u;
          }

          var reducedPointWorld: array<vec3f, ${u}>;
          var reducedRAWorld: array<vec3f, ${u}>;
          var reducedRBWorld: array<vec3f, ${u}>;
          var reducedPenetration: array<f32, ${u}>;
          var reducedContactKey: array<u32, ${u}>;
          for (var s = 0u; s < ${u}u; s++) {
            let idx = selectedIdx[s];
            reducedPointWorld[s] = candidatePointWorld[idx];
            reducedRAWorld[s] = candidateRAWorld[idx];
            reducedRBWorld[s] = candidateRBWorld[idx];
            reducedPenetration[s] = candidatePenetration[idx];
            reducedContactKey[s] = candidateContactKey[idx];
          }
          for (var s = 0u; s < ${u}u; s++) {
            candidatePointWorld[s] = reducedPointWorld[s];
            candidateRAWorld[s] = reducedRAWorld[s];
            candidateRBWorld[s] = reducedRBWorld[s];
            candidatePenetration[s] = reducedPenetration[s];
            candidateContactKey[s] = reducedContactKey[s];
          }
          candidateCount = ${u}u;
        }

        if (candidateCount == 0u) {
          if (debugEnabled > 0u && isFloorPair) {
            atomicAdd(&debugCounters[10], 1u);
          }
          // Degenerate face clipping fallback.
          let pA = obbSupport(posA, qA, halfA, bestNormal);
          let pB = obbSupport(posB, qB, halfB, -bestNormal);
          candidatePointWorld[0] = 0.5 * (pA + pB);
          candidateRAWorld[0] = pA - posA;
          candidateRBWorld[0] = pB - posB;
          candidatePenetration[0] = storedPenetration;
          candidateContactKey[0] = packFaceContactFeature(refIsA, refFeature, incFeature, 0u);
          candidateCount = 1u;
        }

        // Match the reference demo's compact manifold behavior more closely by
        // removing duplicate contact samples before persistent slot assignment.
        // The fixed-slot GPU backing store still keeps up to pairManifoldSlots
        // contacts, but each physical contact should appear at most once.
        if (candidateCount > 1u) {
          var compactPointWorld: array<vec3f, 8>;
          var compactRAWorld: array<vec3f, 8>;
          var compactRBWorld: array<vec3f, 8>;
          var compactPenetration: array<f32, 8>;
          var compactContactKey: array<u32, 8>;
          var compactCount = 0u;

          for (var c = 0u; c < candidateCount; c++) {
            let candidatePoint = candidatePointWorld[c];
            let candidateRA = candidateRAWorld[c];
            let candidateRB = candidateRBWorld[c];
            let candidatePen = candidatePenetration[c];
            let candidateKey = candidateContactKey[c];

            var duplicateIdx = 0xffffffffu;
            for (var k = 0u; k < compactCount; k++) {
              let dp = candidatePoint - compactPointWorld[k];
              let d2 = dot(dp, dp);
              if (d2 < 1e-6) {
                duplicateIdx = k;
                break;
              }
            }

            if (duplicateIdx != 0xffffffffu) {
              // Match the reference addContact behavior: keep the first
              // clipped-polygon contact and ignore later near-duplicate rows
              // instead of replacing them with a deeper sample.
              continue;
            }

            compactPointWorld[compactCount] = candidatePoint;
            compactRAWorld[compactCount] = candidateRA;
            compactRBWorld[compactCount] = candidateRB;
            compactPenetration[compactCount] = candidatePen;
            compactContactKey[compactCount] = candidateKey;
            compactCount += 1u;
          }

          for (var c = 0u; c < compactCount; c++) {
            candidatePointWorld[c] = compactPointWorld[c];
            candidateRAWorld[c] = compactRAWorld[c];
            candidateRBWorld[c] = compactRBWorld[c];
            candidatePenetration[c] = compactPenetration[c];
            candidateContactKey[c] = compactContactKey[c];
          }
          candidateCount = compactCount;
        }

        if (candidateCount > 1u) {
          // Preserve a deterministic in-manifold ordinal closer to the reference
          // contact list semantics instead of the reduction-selection order.
          for (var passIdx = 0u; passIdx < 8u; passIdx++) {
            if (passIdx + 1u >= candidateCount) { break; }
            let last = candidateCount - 1u - passIdx;
            for (var idx = 0u; idx < 8u; idx++) {
              if (idx >= last) { break; }
              let next = idx + 1u;
              let leftKey = candidateContactKey[idx];
              let rightKey = candidateContactKey[next];
              var shouldSwap = leftKey > rightKey;
              if (!shouldSwap && leftKey == rightKey) {
                shouldSwap = candidatePenetration[idx] < candidatePenetration[next];
              }
              if (!shouldSwap) { continue; }

              let swapPoint = candidatePointWorld[idx];
              candidatePointWorld[idx] = candidatePointWorld[next];
              candidatePointWorld[next] = swapPoint;

              let swapRA = candidateRAWorld[idx];
              candidateRAWorld[idx] = candidateRAWorld[next];
              candidateRAWorld[next] = swapRA;

              let swapRB = candidateRBWorld[idx];
              candidateRBWorld[idx] = candidateRBWorld[next];
              candidateRBWorld[next] = swapRB;

              let swapPen = candidatePenetration[idx];
              candidatePenetration[idx] = candidatePenetration[next];
              candidatePenetration[next] = swapPen;

              let swapKey = candidateContactKey[idx];
              candidateContactKey[idx] = candidateContactKey[next];
              candidateContactKey[next] = swapKey;
            }
          }
        }

        if (bestFeature < 6 && candidateCount > 0u) {
          // Match avbd-demo3d contact identity more closely: assign the final
          // face-contact ordinal only after manifold reduction/compaction and
          // deterministic sorting, so each stored row gets a unique feature
          // key within the manifold.
          for (var c = 0u; c < candidateCount; c++) {
            candidateContactKey[c] = packFaceContactFeature(refIsA, refFeature, incFeature, c);
          }
        }

        let staleBand = contactSlop + hysteresis;
        let separatingKeepBand = 0.25 * staleBand;
        let separatingKeepMinNormal = 2.0;
        // Tangential drift pruning removes ghost contacts from rotating pairs.
        // Lower thresholds are safer but can look softer (more manifold churn).
        let maxDrift = max(3.5 * contactSlop, 0.016);
        let maxDrift2 = maxDrift * maxDrift;
        let normalThreshold = 0.95;
        let invalidSlot = 0xffffffffu;
        let warmstartReasonNone = 0u;
        let warmstartReasonExactFeature = 1u;
        let warmstartReasonNormalGate = 3u;
        let warmstartReasonInactiveSlot = 4u;
        let manifoldStickCooldown = 0u;
        var manifoldTangentBasis = canonicalTangentBasis(bestNormal);
        if (manifoldHasPreferredT1) {
          manifoldTangentBasis = tangentBasisFromPreferredT1(bestNormal, manifoldPreferredT1);
        }
        var manifoldTangentAngle = tangentBasisAngleFromT1(bestNormal, manifoldTangentBasis.t1);

        // Snapshot the previous manifold state so the new compact manifold can
        // exact-match against last frame without depending on slot continuity.
        var prevSlotActive: array<u32, ${u}>;
        var prevSlotMeta: array<vec4f, ${u}>;
        var prevSlotArmA: array<vec4f, ${u}>;
        var prevSlotArmB: array<vec4f, ${u}>;
        for (var s = 0u; s < ${u}u; s++) {
          let slot = pairBase + s;
          let slotInfo = loadContactMeta(pairContacts, slot);
          let slotActive = select(0u, 1u, slotInfo.z >= 0.5);
          prevSlotActive[s] = slotActive;
          prevSlotMeta[s] = slotInfo;
          if (slotActive > 0u) {
            prevSlotArmA[s] = loadContactArmA(pairContacts, slot);
            prevSlotArmB[s] = loadContactArmB(pairContacts, slot);
          }
        }

        var prevSlotMatched: array<u32, ${u}>;
        var candidatePrevSlot: array<u32, ${u}>;
        var candidateWarmstartReason: array<u32, ${u}>;
        for (var s = 0u; s < ${u}u; s++) {
          prevSlotMatched[s] = 0u;
          candidatePrevSlot[s] = invalidSlot;
          candidateWarmstartReason[s] = warmstartReasonNone;
        }

        for (var c = 0u; c < candidateCount; c++) {
          let candidatePoint = candidatePointWorld[c];
          let candidateFeatureKey = candidateContactKey[c];
          var bestSlot = invalidSlot;
          var bestD2 = 1e30;
          for (var s = 0u; s < ${u}u; s++) {
            if (prevSlotActive[s] == 0u || prevSlotMatched[s] != 0u) { continue; }
            if (decodePackedContactFeatureKey(prevSlotMeta[s].w) != candidateFeatureKey) { continue; }
            let oldRAStored = prevSlotArmA[s].xyz;
            let oldRBStored = prevSlotArmB[s].xyz;
            let oldRA = qrot(qA, oldRAStored);
            let oldRB = qrot(qB, oldRBStored);
            let oldPoint = 0.5 * ((posA + oldRA) + (posB + oldRB));
            let dp = candidatePoint - oldPoint;
            let d2 = dot(dp, dp);
            if (d2 < bestD2) {
              bestD2 = d2;
              bestSlot = s;
            }
          }
          if (bestSlot != invalidSlot) {
            prevSlotMatched[bestSlot] = 1u;
            candidatePrevSlot[c] = bestSlot;
            candidateWarmstartReason[c] = warmstartReasonExactFeature;
          }
        }

        var exactMatchPreferredT1 = vec3f(0.0);
        var exactMatchPreferredCount = 0u;
        for (var c = 0u; c < candidateCount; c++) {
          let matchedPrevSlot = candidatePrevSlot[c];
          if (matchedPrevSlot == invalidSlot) { continue; }
          if (candidateWarmstartReason[c] != warmstartReasonExactFeature) { continue; }
          let prevNormal = loadContactNormalPen(pairContacts, pairBase + matchedPrevSlot).xyz;
          let prevTangentAngle = prevSlotArmA[matchedPrevSlot].w;
          let prevBasis = tangentBasisFromAngle(prevNormal, prevTangentAngle);
          exactMatchPreferredT1 += prevBasis.t1;
          exactMatchPreferredCount += 1u;
        }
        // Preserve manifold-level tangent sign continuity for exact matched
        // manifolds without abandoning the shared-basis convention.
        if (
          exactMatchPreferredCount > 0u
          && dot(exactMatchPreferredT1, manifoldTangentBasis.t1) < 0.0
        ) {
          manifoldTangentBasis = TangentBasis(-manifoldTangentBasis.t1, -manifoldTangentBasis.t2);
          manifoldTangentAngle = tangentBasisAngleFromT1(bestNormal, manifoldTangentBasis.t1);
          if (debugEnabled > 0u) {
            atomicAdd(&debugCounters[6], 1u);
          }
        }

        var writeCount = 0u;
        for (var c = 0u; c < candidateCount; c++) {
          let candidatePoint = candidatePointWorld[c];
          let candidateFeatureKey = candidateContactKey[c];
          let raWorld = candidateRAWorld[c];
          let rbWorld = candidateRBWorld[c];
          var contactRAWorld = raWorld;
          var contactRBWorld = rbWorld;
          var candidateStoredPen = candidatePenetration[c];
          let matchedPrevSlot = candidatePrevSlot[c];
          let matchedPrevContact = pairBase + matchedPrevSlot;
          let preserveWarmstart = matchedPrevSlot != invalidSlot;
          var warmstartDebugReason = candidateWarmstartReason[c];
          var tangentBasis = manifoldTangentBasis;
          var useStickingPoint = false;
          var canWarmstart = false;
          var exactFeatureWarmstart = false;
          var carryStick = 0u;
          var carryStickAnchorReuse = 0u;
          var lambdaNKeep = 0.0;
          var lambdaT = vec2f(0.0, 0.0);
          var carriedC0T = vec2f(0.0, 0.0);
          var useCarriedC0T = false;
          var carriedShadow = vec4f(0.0);
          var carriedDual = vec4f(0.0);
          var carriedPenalty = vec4f(1.0, 1.0, 1.0, frictionScale);

          if (preserveWarmstart) {
            let prevInfo = prevSlotMeta[matchedPrevSlot];
            let prevNormalPen = loadContactNormalPen(pairContacts, matchedPrevContact);
            let prevNormal = prevNormalPen.xyz;
            let prevFeature = i32(decodePackedBaseFeature(prevInfo.w));
            let prevFeatureKey = decodePackedContactFeatureKey(prevInfo.w);
            let prevStick = decodePackedStick(prevInfo.w);
            let prevTangentAngle = prevSlotArmA[matchedPrevSlot].w;
            let sameFeature = prevFeatureKey == candidateFeatureKey;
            exactFeatureWarmstart = sameFeature;
            var matchNormalDot = dot(prevNormal, bestNormal);
            if ((prevFeature >= 6) != (bestFeature >= 6)) {
              matchNormalDot = -1.0;
            }

            // Exact-key matches reuse prior state like the reference compact
            // manifold merge, while still requiring normal agreement.
            canWarmstart = preserveWarmstart && select(
              matchNormalDot > normalThreshold,
              true,
              sameFeature,
            );
            if (!canWarmstart) {
              warmstartDebugReason = warmstartReasonNormalGate;
            }

            if (canWarmstart) {
              let oldRAStored = prevSlotArmA[matchedPrevSlot].xyz;
              let oldRBStored = prevSlotArmB[matchedPrevSlot].xyz;
              let oldRA = qrot(qA, oldRAStored);
              let oldRB = qrot(qB, oldRBStored);
              let oldPointA = posA + oldRA;
              let oldPointB = posB + oldRB;
              useStickingPoint = prevStick > 0u && sameFeature && !specialPair;
              if (useStickingPoint) {
                if (debugEnabled > 0u) {
                  atomicAdd(&debugCounters[5], 1u);
                }
                // avbd-demo3d parity: exact sticky matches keep the old
                // anchors; otherwise the matched contact keeps the new anchors
                // and C0 is recomputed from whichever anchors were chosen.
                contactRAWorld = oldRA;
                contactRBWorld = oldRB;
                candidateStoredPen = max(
                  -dot((posB + contactRBWorld) - (posA + contactRAWorld), bestNormal),
                  0.0,
                );
              }
              carryStick = select(0u, prevStick, sameFeature && !specialPair);
              carryStickAnchorReuse = select(0u, 1u, useStickingPoint);
              let prevShadow = loadContactShadow(pairContacts, matchedPrevContact);
              let prevDual = loadContactDual(pairContacts, matchedPrevContact);
              lambdaNKeep = max(prevShadow.x, 0.0);
              carriedShadow = prevShadow;
              carriedDual = prevDual;
              carriedPenalty = loadContactPenalty(pairContacts, matchedPrevContact);

              let warmFriction = frictionStatic * frictionScale;
              let prevNLen2 = dot(prevNormal, prevNormal);
              let writeTangentBasis = tangentBasisFromAngle(bestNormal, manifoldTangentAngle);
              if (prevNLen2 > 1e-10) {
                let prevBasis = tangentBasisFromAngle(prevNormal, prevTangentAngle);
                let jtWorld = prevBasis.t1 * prevShadow.y + prevBasis.t2 * prevShadow.z;
                lambdaT = vec2f(
                  dot(jtWorld, writeTangentBasis.t1),
                  dot(jtWorld, writeTangentBasis.t2),
                );
                let maxT = warmFriction * lambdaNKeep;
                let maxT2 = maxT * maxT;
                let lt2 = dot(lambdaT, lambdaT);
                if (lt2 > maxT2 && lt2 > 1e-12) {
                  lambdaT *= maxT * inverseSqrt(lt2);
                }
                carriedShadow = vec4f(lambdaNKeep, lambdaT.x, lambdaT.y, prevShadow.w);
                let prevC0TB = loadContactConstraintC0(pairContacts, matchedPrevContact).yz;
                let c0TWorld = prevBasis.t1 * prevC0TB.x + prevBasis.t2 * prevC0TB.y;
                carriedC0T = vec2f(
                  dot(c0TWorld, writeTangentBasis.t1),
                  dot(c0TWorld, writeTangentBasis.t2),
                );
                useCarriedC0T = sameFeature;
                let prevDualTB = prevDual.yz;
                let dualTWorld = prevBasis.t1 * prevDualTB.x + prevBasis.t2 * prevDualTB.y;
                let rotatedDualTB = vec2f(
                  dot(dualTWorld, writeTangentBasis.t1),
                    dot(dualTWorld, writeTangentBasis.t2),
                );
                carriedDual = vec4f(prevDual.x, rotatedDualTB, 0.0);
              }
            }
          } else {
            warmstartDebugReason = warmstartReasonInactiveSlot;
          }

          let finalPointA = posA + contactRAWorld;
          let finalPointB = posB + contactRBWorld;
          let finalRawPen = -dot(finalPointB - finalPointA, bestNormal);
          if (finalRawPen < 0.0) {
            if (debugEnabled > 0u && useStickingPoint) {
              atomicAdd(&debugCounters[4], 1u);
            }
            continue;
          }
          candidateStoredPen = max(finalRawPen, 0.0);

          let writeTangentBasis = tangentBasisFromAngle(bestNormal, manifoldTangentAngle);
          let tangentAngle = manifoldTangentAngle;
          let normalContactMargin = ${qn};
          let cachedC0Vec = finalPointA - finalPointB;
          let cachedC0N = -dot(cachedC0Vec, bestNormal) + normalContactMargin;
          var cachedC0T1 = dot(cachedC0Vec, writeTangentBasis.t1);
          var cachedC0T2 = dot(cachedC0Vec, writeTangentBasis.t2);
          if (canWarmstart && exactFeatureWarmstart && useCarriedC0T) {
            cachedC0T1 = carriedC0T.x;
            cachedC0T2 = carriedC0T.y;
          }
          let storedRA = qrot(qconj(qA), contactRAWorld);
          let storedRB = qrot(qconj(qB), contactRBWorld);
          let targetIndex = pairBase + writeCount;
          // Preserve the actual pair/manifold slot order seen by the contact
          // pipeline instead of reconstructing a synthetic rank from (i, j).
          let manifoldSequence = manifold;
          storeContactMeta(pairContacts, targetIndex, vec4f(
            f32(i),
            f32(j),
            f32(manifoldSequence + 1u),
            packContactInfo(
              candidateFeatureKey,
              manifoldStickCooldown,
              select(0u, 1u, canWarmstart),
              carryStick,
              carryStickAnchorReuse,
              warmstartDebugReason,
            ),
          ));
          storeContactNormalPen(pairContacts, targetIndex, vec4f(bestNormal, candidateStoredPen));
          storeContactArmA(pairContacts, targetIndex, vec4f(storedRA, tangentAngle));
          storeContactArmB(pairContacts, targetIndex, vec4f(storedRB, 0.0));
          storeContactConstraintC0(pairContacts, targetIndex, vec4f(cachedC0N, cachedC0T1, cachedC0T2, 0.0));
          if (canWarmstart && exactFeatureWarmstart && matchedPrevSlot != invalidSlot) {
            // avbd-demo3d parity: exact matches carry the previous contact
            // object into the new slot first, then geometry/C0 are refreshed
            // from the chosen anchors above.
            storeContactShadow(pairContacts, targetIndex, carriedShadow);
            storeContactDual(pairContacts, targetIndex, carriedDual);
            storeContactPenalty(pairContacts, targetIndex, carriedPenalty);
            storeContactCache(pairContacts, targetIndex, loadContactCache(pairContacts, matchedPrevContact));
          } else {
            // Unmatched rows start fresh; prepareState owns any
            // subsequent warmstart decision.
            storeContactShadow(pairContacts, targetIndex, select(
              vec4f(0.0, 0.0, 0.0, frictionScale),
              vec4f(lambdaNKeep, lambdaT.x, lambdaT.y, frictionScale),
              canWarmstart,
            ));
            storeContactDual(pairContacts, targetIndex, vec4f(0.0));
            storeContactPenalty(pairContacts, targetIndex, vec4f(1.0, 1.0, 1.0, frictionScale));
            storeContactCacheWord(pairContacts, targetIndex, 0u);
          }
          writeCount += 1u;
        }

        for (var s = writeCount; s < ${u}u; s++) {
          deactivateContactSlot(pairContacts, pairBase + s, f32(i), f32(j));
        }

        if (debugEnabled > 0u && isFloorPair) {
          if (writeCount == 0u) {
            atomicAdd(&debugCounters[11], 1u);
          } else {
            atomicAdd(&debugCounters[12], 1u);
          }
        }
      }

      fn deactivateContactSlot(
        pairContacts: ptr<storage, array<vec4f>, read_write>,
        slot: u32,
        pairI: f32,
        pairJ: f32,
      ) {
        storeContactMeta(pairContacts, slot, vec4f(pairI, pairJ, 0.0, 0.0));
        storeContactCacheWord(pairContacts, slot, 0u);
      }

      fn deactivateManifold(
        pairContacts: ptr<storage, array<vec4f>, read_write>,
        pairBase: u32,
        pairI: f32,
        pairJ: f32,
      ) {
        for (var s = 0u; s < ${u}u; s++) {
          deactivateContactSlot(pairContacts, pairBase + s, pairI, pairJ);
        }
      }

      fn packFaceContactFeature(referenceIsA: bool, referenceAxis: u32, incidentAxis: u32, ordinal: u32) -> u32 {
        let featureType = select(1u, 0u, referenceIsA);
        return (ordinal & 0x7u)
          | ((incidentAxis & 0x3u) << 3u)
          | ((referenceAxis & 0x3u) << 5u)
          | ((featureType & 0x3u) << 7u);
      }

      fn packEdgeContactFeature(axisA: u32, axisB: u32) -> u32 {
        return ((axisB & 0x3u) << 3u)
          | ((axisA & 0x3u) << 5u)
          | (2u << 7u);
      }

      fn axisValue3(v: vec3f, axis: u32) -> f32 {
        if (axis == 0u) { return v.x; }
        if (axis == 1u) { return v.y; }
        return v.z;
      }

      fn axisVector3(axis: u32, axis0: vec3f, axis1: vec3f, axis2: vec3f) -> vec3f {
        if (axis == 0u) { return axis0; }
        if (axis == 1u) { return axis1; }
        return axis2;
      }

      fn dominantAbsAxis3(v: vec3f) -> u32 {
        let av = abs(v);
        if (av.y > av.x && av.y >= av.z) { return 1u; }
        if (av.z > av.x && av.z > av.y) { return 2u; }
        return 0u;
      }

      fn leastAxis3(v: vec3f) -> u32 {
        if (v.y < v.x && v.y <= v.z) { return 1u; }
        if (v.z < v.x && v.z < v.y) { return 2u; }
        return 0u;
      }

      fn decodePackedContactFeatureKey(encoded: f32) -> u32 {
        return bitcast<u32>(encoded) & 0x1FFu;
      }

      fn decodePackedContactFeatureTypeKey(featureKey: u32) -> u32 {
        return (featureKey >> 7u) & 0x3u;
      }

      fn decodePackedBaseFeature(encoded: f32) -> u32 {
        let featureKey = decodePackedContactFeatureKey(encoded);
        let featureType = decodePackedContactFeatureTypeKey(featureKey);
        let referenceAxis = (featureKey >> 5u) & 0x3u;
        let incidentAxis = (featureKey >> 3u) & 0x3u;
        if (featureType == 0u) {
          return referenceAxis;
        }
        if (featureType == 1u) {
          return 3u + referenceAxis;
        }
        return 6u + referenceAxis * 3u + incidentAxis;
      }

      fn decodePackedCooldown(encoded: f32) -> u32 {
        return (bitcast<u32>(encoded) >> 9u) & 0x7Fu;
      }

      fn decodePackedStick(encoded: f32) -> u32 {
        return (bitcast<u32>(encoded) >> 17u) & 0x1u;
      }

	      fn decodePackedStickAnchorReuse(encoded: f32) -> u32 {
	        return (bitcast<u32>(encoded) >> 18u) & 0x1u;
	      }

	      fn decodePackedWarmstartDebugReason(encoded: f32) -> u32 {
	        return (bitcast<u32>(encoded) >> 21u) & 0x7u;
	      }

      fn packContactInfo(
        featureKey: u32,
        cooldown: u32,
        preserveWarmstart: u32,
        stick: u32,
        stickAnchorReuse: u32,
        warmstartDebugReason: u32,
      ) -> f32 {
        return bitcast<f32>(
          (featureKey & 0x1FFu)
          | ((cooldown & 0x7Fu) << 9u)
          | ((preserveWarmstart & 0x1u) << 16u)
          | ((stick & 0x1u) << 17u)
          | ((stickAnchorReuse & 0x1u) << 18u)
          | ((warmstartDebugReason & 0x7u) << 21u),
        );
      }

      struct SegResult {
        p: vec3f,
        q: vec3f,
      };

      fn sgnnz(x: f32) -> f32 {
        return select(1.0, -1.0, x < 0.0);
      }

      fn closestPointsSegments(p0: vec3f, p1: vec3f, q0: vec3f, q1: vec3f) -> SegResult {
        let u = p1 - p0;
        let v = q1 - q0;
        let w0 = p0 - q0;

        let a = dot(u, u);
        let b = dot(u, v);
        let c = dot(v, v);
        let d = dot(u, w0);
        let e = dot(v, w0);

        let D = a * c - b * b;
        let EPS = 1e-6;

        var sN: f32;
        var sD = D;
        var tN: f32;
        var tD = D;

        if (D < EPS) {
          sN = 0.0;
          sD = 1.0;
          tN = e;
          tD = c;
        } else {
          sN = b * e - c * d;
          tN = a * e - b * d;

          if (sN < 0.0) {
            sN = 0.0;
            tN = e;
            tD = c;
          } else if (sN > sD) {
            sN = sD;
            tN = e + b;
            tD = c;
          }
        }

        if (tN < 0.0) {
          tN = 0.0;
          if (-d < 0.0) {
            sN = 0.0;
          } else if (-d > a) {
            sN = sD;
          } else {
            sN = -d;
            sD = a;
          }
        } else if (tN > tD) {
          tN = tD;
          if (-d + b < 0.0) {
            sN = 0.0;
          } else if (-d + b > a) {
            sN = sD;
          } else {
            sN = -d + b;
            sD = a;
          }
        }

        let sc = select(0.0, sN / sD, abs(sN) > EPS);
        let tc = select(0.0, tN / tD, abs(tN) > EPS);

        let p = p0 + sc * u;
        let q = q0 + tc * v;
        return SegResult(p, q);
      }
    `,[Ir,Lr,Rr,fl,Vc,ul]);Pr(`Contact Pair Generate`,6),this.pairKernel=x({positions:Z(e,`vec4f`,s).toReadOnly(),quaternions:Z(t,`vec4f`,s).toReadOnly(),shapes:Z(n,`vec4f`,s).toReadOnly(),pairContacts:Z(r,`vec4f`,c*9),pairActivity:Z(i,`uint`,v),debugCounters:Z(this.debugCountersAttr,`uint`,27).toAtomic(),debugEnabled:T(0),bodyCount:T(0),pairCount:T(0),pairDispatchCount:T(0),useCandidatePairs:T(0),floorDebugBody:T(4294967295),contactSlop:T(.005),frictionStatic:T(Gn),workgroupId:p,localId:W}).computeKernel([dl,1,1]).setName(`Contact Pair Generate`),this.pairKernelDebug=x({positions:Z(e,`vec4f`,s).toReadOnly(),quaternions:Z(t,`vec4f`,s).toReadOnly(),shapes:Z(n,`vec4f`,s).toReadOnly(),pairContacts:Z(r,`vec4f`,c*9),pairActivity:Z(i,`uint`,v),debugCounters:Z(this.debugCountersAttr,`uint`,27).toAtomic(),debugEnabled:T(0),bodyCount:T(0),pairCount:T(0),pairDispatchCount:T(0),useCandidatePairs:T(0),floorDebugBody:T(4294967295),contactSlop:T(.005),frictionStatic:T(Gn),workgroupId:p,localId:W}).computeKernel([dl,1,1]).setName(`Contact Pair Generate`);let S=l(`
      fn compute(
        pairBodyContactCounts: ptr<storage, array<atomic<u32>>, read_write>,
        pairActivity: ptr<storage, array<atomic<u32>>, read_write>,
        bodyCount: u32,
        workgroupId: vec3u,
        localId: vec3u,
      ) -> void {
        let gid = workgroupId.x * ${dl}u + localId.x;
        if (gid == 0u) {
          atomicStore(&pairActivity[${g}u], 0u);
        }
        if (gid >= bodyCount) { return; }
        atomicStore(&pairBodyContactCounts[gid], 0u);
      }
    `);this.clearPairBodyCountsKernel=S({pairBodyContactCounts:Z(a,`uint`,s).toAtomic(),pairActivity:Z(i,`uint`,v).toAtomic(),bodyCount:T(0),workgroupId:p,localId:W}).computeKernel([dl,1,1]).setName(`Contact Clear Body Counts`);let C=l(`
      fn compute(
        debugCounters: ptr<storage, array<atomic<u32>>, read_write>,
        debugEnabled: u32,
      ) -> void {
        if (debugEnabled == 0u) { return; }
        for (var i = 0u; i < 27u; i++) {
          atomicStore(&debugCounters[i], 0u);
        }
      }
    `);this.clearDebugCountersKernel=C({debugCounters:Z(this.debugCountersAttr,`uint`,27).toAtomic(),debugEnabled:T(0)}).computeKernel([1,1,1]).setName(`Contact Clear Debug Counters`);let w=l(`
      fn compute(
        pairActivity: ptr<storage, array<atomic<u32>>, read_write>,
      ) -> void {
        atomicStore(&pairActivity[${h}u], 0u);
      }
    `);this.clearActiveCandidateSlotsKernel=w({pairActivity:Z(i,`uint`,v).toAtomic()}).computeKernel([1,1,1]).setName(`Contact Clear Active Candidate Slots`);let E=l(`
      fn compute(
        pairActivity: ptr<storage, array<atomic<u32>>, read_write>,
        pairCount: u32,
        pairDispatchCount: u32,
        useCandidatePairs: u32,
        workgroupId: vec3u,
        localId: vec3u,
      ) -> void {
        let gid = workgroupId.x * ${dl}u + localId.x;
        if (gid >= pairDispatchCount) { return; }

        var manifold = gid;
        if (useCandidatePairs > 0u) {
          let packedPair = atomicLoad(&pairActivity[${m}u + gid + 1u]);
          let i = packedPair & 0xFFFFu;
          let j = packedPair >> 16u;
          if (i >= j) { return; }
        } else {
          if (gid >= pairCount) { return; }
          if (gid >= ${b}u) { return; }
        }

        let outIndex = atomicAdd(&pairActivity[${h}u], 1u);
        if (outIndex < ${b}u) {
          atomicStore(&pairActivity[${h}u + outIndex + 1u], manifold);
        }
      }
    `);this.buildActiveCandidateSlotsKernel=E({pairActivity:Z(i,`uint`,v).toAtomic(),pairCount:T(0),pairDispatchCount:T(0),useCandidatePairs:T(0),workgroupId:p,localId:W}).computeKernel([dl,1,1]).setName(`Contact Build Active Candidate Slots`);let D=l(`
      fn compute(
        pairActivity: ptr<storage, array<u32>, read_write>,
        pairDispatchIndirect: ptr<storage, array<u32>, read_write>,
        pairDispatchCount: u32,
      ) -> void {
        let dispatchThreads = min(pairActivity[${h}u], pairDispatchCount);

        let workgroups = (dispatchThreads + ${dl}u - 1u) / ${dl}u;
        pairDispatchIndirect[0] = workgroups;
        pairDispatchIndirect[1] = 1u;
        pairDispatchIndirect[2] = 1u;
      }
    `);this.buildPairDispatchArgsKernel=D({pairActivity:Z(i,`uint`,v),pairDispatchIndirect:Z(this.pairDispatchIndirectAttr,`uint`,3),pairDispatchCount:T(0)}).computeKernel([1,1,1]).setName(`Contact Build Dispatch Args`);let O=`
      fn compute(
        pairContacts: ptr<storage, array<vec4f>, read_write>,
        positions: ptr<storage, array<vec4f>, read>,
        pairActivity: ptr<storage, array<atomic<u32>>, read_write>,
        pairBodyContactCounts: ptr<storage, array<atomic<u32>>, read_write>,
        pairBodyContactIndices: ptr<storage, array<u32>, read_write>,
        debugCounters: ptr<storage, array<atomic<u32>>, read_write>,
        bodyCount: u32,
        pairDispatchCount: u32,
        debugEnabled: u32,
        workgroupId: vec3u,
        localId: vec3u,
      ) -> void {
        let gid = workgroupId.x * ${dl}u + localId.x;
        let activeCandidateCount = min(atomicLoad(&pairActivity[${h}u]), pairDispatchCount);
        if (gid >= activeCandidateCount) { return; }
        let manifold = atomicLoad(&pairActivity[${h}u + gid + 1u]);
        if (manifold >= pairDispatchCount) { return; }

        let pairBase = manifold * ${u}u;
        var manifoldHasActive = false;
        for (var s = 0u; s < ${u}u; s++) {
          let p = pairBase + s;
          let pairInfo = loadContactMeta(pairContacts, p);
          if (pairInfo.z < 0.5) { continue; }
          manifoldHasActive = true;

          let i = u32(pairInfo.x);
          let j = u32(pairInfo.y);
          if (i >= bodyCount || j >= bodyCount) { continue; }
          let dynamicI = positions[i].w > 0.0;
          let dynamicJ = positions[j].w > 0.0;
          if (!dynamicI && !dynamicJ) { continue; }

          var wroteI = false;
          var slotI = 0u;
          if (dynamicI) {
            slotI = atomicAdd(&pairBodyContactCounts[i], 1u);
            if (slotI < ${d}u) {
              pairBodyContactIndices[i * ${d}u + slotI] = p;
              wroteI = true;
            }
            if (slotI >= ${d}u && debugEnabled > 0u) {
              atomicAdd(&debugCounters[24], 1u);
            }
          }

          var wroteJ = false;
          var slotJ = 0u;
          if (dynamicJ) {
            slotJ = atomicAdd(&pairBodyContactCounts[j], 1u);
            if (slotJ < ${d}u) {
              pairBodyContactIndices[j * ${d}u + slotJ] = p;
              wroteJ = true;
            }
            if (slotJ >= ${d}u && debugEnabled > 0u) {
              atomicAdd(&debugCounters[24], 1u);
            }
          }

          var keepContact = false;
          if (dynamicI && dynamicJ) {
            // Dynamic-dynamic contacts require both bodies to store the slot.
            keepContact = wroteI && wroteJ;
            if (!keepContact) {
              if (debugEnabled > 0u) {
                atomicAdd(&debugCounters[25], 1u);
              }
              if (wroteI) {
                pairBodyContactIndices[i * ${d}u + slotI] = ${c}u;
              }
              if (wroteJ) {
                pairBodyContactIndices[j * ${d}u + slotJ] = ${c}u;
              }
            }
          } else if (dynamicI) {
            // Static-dynamic contacts are solved by the dynamic body only.
            keepContact = wroteI;
          } else if (dynamicJ) {
            keepContact = wroteJ;
          }

          if (keepContact) {
            // Build a compact active-contact list consumed by solver kernels.
            let activeWrite = atomicAdd(&pairActivity[${g}u], 1u);
            if (activeWrite < ${f}u) {
              atomicStore(&pairActivity[${g}u + activeWrite + 1u], p);
            } else if (debugEnabled > 0u) {
              atomicAdd(&debugCounters[26], 1u);
            }
          }
        }

        if (manifoldHasActive) {
          if (debugEnabled > 0u) {
            atomicAdd(&debugCounters[1], 1u);
          }
        }
      }
    `,k=O.replace(`        debugCounters: ptr<storage, array<atomic<u32>>, read_write>,
`,``).replace(`        debugEnabled: u32,
`,``).replace(`          if (debugEnabled > 0u) {
            atomicAdd(&debugCounters[1], 1u);
          }
`,``).replace(`            if (slotI >= ${d}u && debugEnabled > 0u) {\n              atomicAdd(&debugCounters[24], 1u);\n            }\n`,``).replace(`            if (slotJ >= ${d}u && debugEnabled > 0u) {\n              atomicAdd(&debugCounters[24], 1u);\n            }\n`,``).replace(`              if (debugEnabled > 0u) {
                atomicAdd(&debugCounters[25], 1u);
              }
`,``).replace(`            } else if (debugEnabled > 0u) {
              atomicAdd(&debugCounters[26], 1u);
            }
`,`            }
`),A=l(O,[Vc]),j=l(k,[Vc]);this.buildPairBodyListsKernel=j({pairContacts:Z(r,`vec4f`,c*9),positions:Z(e,`vec4f`,s).toReadOnly(),pairActivity:Z(i,`uint`,v).toAtomic(),pairBodyContactCounts:Z(a,`uint`,s).toAtomic(),pairBodyContactIndices:Z(o,`uint`,y),bodyCount:T(0),pairDispatchCount:T(0),workgroupId:p,localId:W}).computeKernel([dl,1,1]).setName(`Contact Build Body Lists`),this.buildPairBodyListsKernelDebug=A({pairContacts:Z(r,`vec4f`,c*9),positions:Z(e,`vec4f`,s).toReadOnly(),pairActivity:Z(i,`uint`,v).toAtomic(),pairBodyContactCounts:Z(a,`uint`,s).toAtomic(),pairBodyContactIndices:Z(o,`uint`,y),debugCounters:Z(this.debugCountersAttr,`uint`,27).toAtomic(),bodyCount:T(0),pairDispatchCount:T(0),debugEnabled:T(0),workgroupId:p,localId:W}).computeKernel([dl,1,1]).setName(`Contact Build Body Lists`);let M=l(`
      fn compute(
        pairActivity: ptr<storage, array<u32>, read_write>,
        debugCounters: ptr<storage, array<atomic<u32>>, read_write>,
        debugEnabled: u32,
      ) -> void {
        if (debugEnabled == 0u) { return; }
        atomicStore(&debugCounters[2], pairActivity[${h}u]);
      }
    `);this.finalizeDebugCountersKernel=M({pairActivity:Z(i,`uint`,v),debugCounters:Z(this.debugCountersAttr,`uint`,27).toAtomic(),debugEnabled:T(0)}).computeKernel([1,1,1]).setName(`Contact Finalize Debug Counters`)}setFriction(e){let t=Math.max(0,e);this.pairKernel.computeNode.parameters.frictionStatic.value=t,this.pairKernelDebug.computeNode.parameters.frictionStatic.value=t}setDebugLogInterval(e){this.debugEveryNFrames=Math.max(1,Math.floor(e)),this.lastDebugLogFrame=-1}setDebugEnabled(e){this.debugEnabled=e,this.debugReadbackInFlight=!1,this.lastDebugLogFrame=-1}setFloorDebugBody(e){this.floorDebugBody=Number.isFinite(e)&&e>=0?Math.floor(e):4294967295}dispatch(e,t,n,r,i,a){this.dispatchPairKernelPhase(e,t,n,r,i),this.dispatchBodyListPhase(e,t,r,a)}dispatchPairKernelPhase(e,t,n,r,i){let a=+!!i,o=+!!this.debugEnabled,s=o?this.pairKernelDebug:this.pairKernel,c=o?this.buildPairBodyListsKernelDebug:this.buildPairBodyListsKernel;if(s.computeNode.parameters.bodyCount.value=t,s.computeNode.parameters.pairCount.value=n,s.computeNode.parameters.pairDispatchCount.value=r,s.computeNode.parameters.useCandidatePairs.value=a,o&&(s.computeNode.parameters.floorDebugBody.value=this.floorDebugBody>>>0,s.computeNode.parameters.debugEnabled.value=o),this.clearDebugCountersKernel.computeNode.parameters.debugEnabled.value=o,this.clearPairBodyCountsKernel.computeNode.parameters.bodyCount.value=t,t>0){let n=Math.ceil(t/dl);e.compute(this.clearPairBodyCountsKernel,[n,1,1])}if(c.computeNode.parameters.bodyCount.value=t,c.computeNode.parameters.pairDispatchCount.value=r,o&&(c.computeNode.parameters.debugEnabled.value=o),this.buildActiveCandidateSlotsKernel.computeNode.parameters.pairCount.value=n,this.buildActiveCandidateSlotsKernel.computeNode.parameters.pairDispatchCount.value=r,this.buildActiveCandidateSlotsKernel.computeNode.parameters.useCandidatePairs.value=a,this.buildPairDispatchArgsKernel.computeNode.parameters.pairDispatchCount.value=r,this.finalizeDebugCountersKernel.computeNode.parameters.debugEnabled.value=o,o&&e.compute(this.clearDebugCountersKernel,[1,1,1]),r>0){let t=Math.ceil(r/dl);e.compute(this.clearActiveCandidateSlotsKernel,[1,1,1]),e.compute(this.buildActiveCandidateSlotsKernel,[t,1,1]),e.compute(this.buildPairDispatchArgsKernel,[1,1,1]),e.compute(s,rl?[t,1,1]:this.pairDispatchIndirectAttr)}}dispatchBodyListPhase(e,t,n,r){let i=+!!this.debugEnabled,a=i?this.buildPairBodyListsKernelDebug:this.buildPairBodyListsKernel;a.computeNode.parameters.bodyCount.value=t,a.computeNode.parameters.pairDispatchCount.value=n,i&&(a.computeNode.parameters.debugEnabled.value=i),this.finalizeDebugCountersKernel.computeNode.parameters.debugEnabled.value=i,n>0&&(e.compute(a,rl?[Math.ceil(n/dl),1,1]:this.pairDispatchIndirectAttr),i&&e.compute(this.finalizeDebugCountersKernel,[1,1,1])),this.maybeLogDebug(e,r,t,n)}maybeLogDebug(e,t,n,r){this.debugEnabled&&(!e||typeof e.getArrayBufferAsync!=`function`||this.debugReadbackInFlight||this.lastDebugLogFrame!==t&&(this.lastDebugLogFrame>=0&&t-this.lastDebugLogFrame<this.debugEveryNFrames||(this.debugReadbackInFlight=!0,this.lastDebugLogFrame=t,Promise.all([e.getArrayBufferAsync(this.debugCountersAttr),e.getArrayBufferAsync(this.pairContactsAttr)]).then(([e,i])=>{let a=new Uint32Array(e),o=a[0]??0,s=a[1]??0,c=a[2]??0,l=a[3]??0,u=a[4]??0,d=a[5]??0,f=a[6]??0,p=a[7]??0,m=a[8]??0,h=a[9]??0,g=a[10]??0,_=a[11]??0,v=a[12]??0,y=a[13]??0,b=a[14]??0,x=a[15]??0,S=a[16]??0,C=a[17]??0,w=a[18]??0,T=a[19]??0,E=a[20]??0,D=a[21]??0,O=a[22]??0,k=a[23]??0,A=a[24]??0,j=a[25]??0,M=a[26]??0;if(console.info(`[Contact Debug] frame=${t} bodies=${n} pairDispatch=${r} activeCandidates=${c} activeManifolds=${s} warmstartResets=${o} stalePruned=${l} separatingKept=${u} stickAnchorReuses=${d} sharedTangentSignFlips=${f} floorPairs=${p} floorWarmstartResets=${m} floorRejected=${h} floorDegenerate=${g} floorWriteZero=${_} floorActive=${v} floorRejectSeparated=${y} floorRejectInactiveGap=${b} floorRejectHysteresis=${x} floorSepFaceA=(${S},${C},${w}) floorSepFaceB=(${T},${E},${D}) floorSepEdge=${O} floorSepOther=${k} bodyListOverflowWrites=${A} bodyListDroppedContacts=${j} activeListOverflowWrites=${M}`),t<=12&&s>0){let e=new Float32Array(i),n=new Uint32Array(i),r=new Map;for(let t=0;t<this.maxPairContacts;t++){let i=Uc(t,0),a=Math.max(0,Math.round(e[i]??0)),o=Math.max(0,Math.round(e[i+1]??0));if(!((e[i+2]??0)>=.5))continue;let s=n[i+3]??0,c=s&511,l=(s>>>16&1)!=0,u=s>>>21&7,d=`${a}/${o}`,f=`p=${t} feat=0x${c.toString(16)} warm=${+!!l} r=${u}`,p=r.get(d)??[];p.push(f),r.set(d,p)}if(r.size>0){let e=Array.from(r.entries()).sort((e,t)=>e[0].localeCompare(t[0])).map(([e,t])=>`${e}[${t.join(`, `)}]`).join(` | `);console.info(`[Contact Debug Rows] frame=${t} ${e}`)}}}).catch(e=>{console.warn(`Contact debug readback failed:`,e)}).finally(()=>{this.debugReadbackInFlight=!1}))))}},ml=x(`
      const JOINT_RECORD_META_OFFSET: u32 = 0u;
      const JOINT_RECORD_ANCHOR_A_OFFSET: u32 = 1u;
      const JOINT_RECORD_ANCHOR_B_OFFSET: u32 = 2u;
      const JOINT_RECORD_REST_RELATIVE_ROTATION_OFFSET: u32 = 3u;
      const JOINT_RECORD_STIFFNESS_OFFSET: u32 = 4u;
      const JOINT_RECORD_C0_LIN_OFFSET: u32 = 5u;
      const JOINT_RECORD_C0_ANG_OFFSET: u32 = 6u;
      const JOINT_RECORD_LAMBDA_LIN_OFFSET: u32 = 7u;
      const JOINT_RECORD_LAMBDA_ANG_OFFSET: u32 = 8u;
      const JOINT_RECORD_PENALTY_LIN_OFFSET: u32 = 9u;
      const JOINT_RECORD_PENALTY_ANG_OFFSET: u32 = 10u;
      const JOINT_RECORD_VEC4S: u32 = 11u;

      fn jointRecordBase(jointIndex: u32) -> u32 {
        return jointIndex * JOINT_RECORD_VEC4S;
      }

      fn loadJointMetaWords(jointRecords: ptr<storage, array<vec4f>, read_write>, jointIndex: u32) -> vec4u {
        return bitcast<vec4u>(jointRecords[jointRecordBase(jointIndex) + JOINT_RECORD_META_OFFSET]);
      }

      fn storeJointMetaWords(
        jointRecords: ptr<storage, array<vec4f>, read_write>,
        jointIndex: u32,
        value: vec4u,
      ) {
        jointRecords[jointRecordBase(jointIndex) + JOINT_RECORD_META_OFFSET] = bitcast<vec4f>(value);
      }

      fn loadJointAnchorA(jointRecords: ptr<storage, array<vec4f>, read_write>, jointIndex: u32) -> vec4f {
        return jointRecords[jointRecordBase(jointIndex) + JOINT_RECORD_ANCHOR_A_OFFSET];
      }

      fn storeJointAnchorA(
        jointRecords: ptr<storage, array<vec4f>, read_write>,
        jointIndex: u32,
        value: vec4f,
      ) {
        jointRecords[jointRecordBase(jointIndex) + JOINT_RECORD_ANCHOR_A_OFFSET] = value;
      }

      fn loadJointAnchorB(jointRecords: ptr<storage, array<vec4f>, read_write>, jointIndex: u32) -> vec4f {
        return jointRecords[jointRecordBase(jointIndex) + JOINT_RECORD_ANCHOR_B_OFFSET];
      }

      fn storeJointAnchorB(
        jointRecords: ptr<storage, array<vec4f>, read_write>,
        jointIndex: u32,
        value: vec4f,
      ) {
        jointRecords[jointRecordBase(jointIndex) + JOINT_RECORD_ANCHOR_B_OFFSET] = value;
      }

      fn loadJointRestRelativeRotation(
        jointRecords: ptr<storage, array<vec4f>, read_write>,
        jointIndex: u32,
      ) -> vec4f {
        return jointRecords[jointRecordBase(jointIndex) + JOINT_RECORD_REST_RELATIVE_ROTATION_OFFSET];
      }

      fn storeJointRestRelativeRotation(
        jointRecords: ptr<storage, array<vec4f>, read_write>,
        jointIndex: u32,
        value: vec4f,
      ) {
        jointRecords[jointRecordBase(jointIndex) + JOINT_RECORD_REST_RELATIVE_ROTATION_OFFSET] = value;
      }

      fn loadJointStiffness(jointRecords: ptr<storage, array<vec4f>, read_write>, jointIndex: u32) -> vec4f {
        return jointRecords[jointRecordBase(jointIndex) + JOINT_RECORD_STIFFNESS_OFFSET];
      }

      fn storeJointStiffness(
        jointRecords: ptr<storage, array<vec4f>, read_write>,
        jointIndex: u32,
        value: vec4f,
      ) {
        jointRecords[jointRecordBase(jointIndex) + JOINT_RECORD_STIFFNESS_OFFSET] = value;
      }

      fn loadJointC0Lin(jointRecords: ptr<storage, array<vec4f>, read_write>, jointIndex: u32) -> vec4f {
        return jointRecords[jointRecordBase(jointIndex) + JOINT_RECORD_C0_LIN_OFFSET];
      }

      fn storeJointC0Lin(
        jointRecords: ptr<storage, array<vec4f>, read_write>,
        jointIndex: u32,
        value: vec4f,
      ) {
        jointRecords[jointRecordBase(jointIndex) + JOINT_RECORD_C0_LIN_OFFSET] = value;
      }

      fn loadJointC0Ang(jointRecords: ptr<storage, array<vec4f>, read_write>, jointIndex: u32) -> vec4f {
        return jointRecords[jointRecordBase(jointIndex) + JOINT_RECORD_C0_ANG_OFFSET];
      }

      fn storeJointC0Ang(
        jointRecords: ptr<storage, array<vec4f>, read_write>,
        jointIndex: u32,
        value: vec4f,
      ) {
        jointRecords[jointRecordBase(jointIndex) + JOINT_RECORD_C0_ANG_OFFSET] = value;
      }

      fn loadJointLambdaLin(jointRecords: ptr<storage, array<vec4f>, read_write>, jointIndex: u32) -> vec4f {
        return jointRecords[jointRecordBase(jointIndex) + JOINT_RECORD_LAMBDA_LIN_OFFSET];
      }

      fn storeJointLambdaLin(
        jointRecords: ptr<storage, array<vec4f>, read_write>,
        jointIndex: u32,
        value: vec4f,
      ) {
        jointRecords[jointRecordBase(jointIndex) + JOINT_RECORD_LAMBDA_LIN_OFFSET] = value;
      }

      fn loadJointLambdaAng(jointRecords: ptr<storage, array<vec4f>, read_write>, jointIndex: u32) -> vec4f {
        return jointRecords[jointRecordBase(jointIndex) + JOINT_RECORD_LAMBDA_ANG_OFFSET];
      }

      fn storeJointLambdaAng(
        jointRecords: ptr<storage, array<vec4f>, read_write>,
        jointIndex: u32,
        value: vec4f,
      ) {
        jointRecords[jointRecordBase(jointIndex) + JOINT_RECORD_LAMBDA_ANG_OFFSET] = value;
      }

      fn loadJointPenaltyLin(jointRecords: ptr<storage, array<vec4f>, read_write>, jointIndex: u32) -> vec4f {
        return jointRecords[jointRecordBase(jointIndex) + JOINT_RECORD_PENALTY_LIN_OFFSET];
      }

      fn storeJointPenaltyLin(
        jointRecords: ptr<storage, array<vec4f>, read_write>,
        jointIndex: u32,
        value: vec4f,
      ) {
        jointRecords[jointRecordBase(jointIndex) + JOINT_RECORD_PENALTY_LIN_OFFSET] = value;
      }

      fn loadJointPenaltyAng(jointRecords: ptr<storage, array<vec4f>, read_write>, jointIndex: u32) -> vec4f {
        return jointRecords[jointRecordBase(jointIndex) + JOINT_RECORD_PENALTY_ANG_OFFSET];
      }

      fn storeJointPenaltyAng(
        jointRecords: ptr<storage, array<vec4f>, read_write>,
        jointIndex: u32,
        value: vec4f,
      ) {
        jointRecords[jointRecordBase(jointIndex) + JOINT_RECORD_PENALTY_ANG_OFFSET] = value;
      }
`);function hl(e){return e*44}function Q(e,t){return hl(e)+t*4}var $=64,gl=.99,_l=10,vl=1,yl=1e10,bl=1e-5,xl=.95,Sl=4,Cl=16777216,wl=33554432,Tl=3221225472,El=1073741823,Dl=2147483648,Ol=3221225472,kl=2,Al=x(`
      const TANGENT_BASIS_TWO_PI: f32 = 6.283185307179586;

      struct TangentBasis {
        t1: vec3f,
        t2: vec3f,
      };

      fn canonicalTangentBasis(n: vec3f) -> TangentBasis {
        let refAxis = select(vec3f(0.0, 1.0, 0.0), vec3f(1.0, 0.0, 0.0), abs(n.y) > 0.999);
        let t1Raw = cross(refAxis, n);
        let t1Len2 = dot(t1Raw, t1Raw);
        var t1 = vec3f(0.0, 0.0, 1.0);
        if (t1Len2 > 1e-12) {
          t1 = t1Raw * inverseSqrt(t1Len2);
        }
        let t2Raw = cross(n, t1);
        let t2Len2 = dot(t2Raw, t2Raw);
        var t2 = vec3f(1.0, 0.0, 0.0);
        if (t2Len2 > 1e-12) {
          t2 = t2Raw * inverseSqrt(t2Len2);
        }
        return TangentBasis(t1, t2);
      }

      fn tangentBasisFromPreferredT1(n: vec3f, preferredT1: vec3f) -> TangentBasis {
        let projected = preferredT1 - n * dot(preferredT1, n);
        let projectedLen2 = dot(projected, projected);
        if (projectedLen2 <= 1e-12) {
          return canonicalTangentBasis(n);
        }
        let t1 = projected * inverseSqrt(projectedLen2);
        let t2Raw = cross(n, t1);
        let t2Len2 = dot(t2Raw, t2Raw);
        if (t2Len2 <= 1e-12) {
          return canonicalTangentBasis(n);
        }
        let t2 = t2Raw * inverseSqrt(t2Len2);
        return TangentBasis(t1, t2);
      }

      fn tangentBasisFromAngle(n: vec3f, theta: f32) -> TangentBasis {
        let canonical = canonicalTangentBasis(n);
        let c = cos(theta);
        let s = sin(theta);
        let t1 = canonical.t1 * c + canonical.t2 * s;
        return tangentBasisFromPreferredT1(n, t1);
      }
`),jl=x(`
      struct AvbdContactShadow {
        packed: vec4f,
        lambdaN: f32,
        lambdaTB: vec2f,
        frictionScale: f32,
      };

      struct AvbdContactState {
        dual: vec4f,
        penalty: vec4f,
        lambdaN: f32,
        penaltyN: f32,
        frictionScale: f32,
      };

      struct AvbdContactRecord {
        state: AvbdContactState,
        shadow: AvbdContactShadow,
      };

      fn makeContactState(
        dual: vec4f,
        penalty: vec4f,
        fallbackFrictionScale: f32,
        kStart: f32,
      ) -> AvbdContactState {
        let dualN = min(dual.x, 0.0);
        let penaltyN = max(penalty.x, kStart);
        let penaltyFrictionScale = max(penalty.w, 0.0);
        let frictionScale = max(
          select(fallbackFrictionScale, penaltyFrictionScale, penaltyFrictionScale > 0.0),
          0.0,
        );
        return AvbdContactState(
          dual,
          vec4f(penaltyN, penalty.y, penalty.z, frictionScale),
          max(-dualN, 0.0),
          penaltyN,
          frictionScale,
        );
      }

      fn makeContactShadow(shadow: vec4f) -> AvbdContactShadow {
        let frictionScale = max(shadow.w, 0.0);
        let lambdaN = max(shadow.x, 0.0);
        return AvbdContactShadow(
          vec4f(lambdaN, shadow.y, shadow.z, frictionScale),
          lambdaN,
          shadow.yz,
          frictionScale,
        );
      }

      fn makeContactRecord(
        dual: vec4f,
        penalty: vec4f,
        shadow: vec4f,
        kStart: f32,
      ) -> AvbdContactRecord {
        let contactShadow = makeContactShadow(shadow);
        let contactState = makeContactState(
          dual,
          penalty,
          contactShadow.frictionScale,
          kStart,
        );
        return AvbdContactRecord(contactState, contactShadow);
      }

      // Hot solver passes only need live dual/penalty state. The friction scale is
      // mirrored into penalty.w during prepare/capture so they can avoid pulling
      // shadow/cache data from global memory on every contact touch.
      fn loadContactStateHot(
        pairContacts: ptr<storage, array<vec4f>, read_write>,
        p: u32,
        kStart: f32,
      ) -> AvbdContactState {
        let penalty = loadContactPenalty(pairContacts, p);
        return makeContactState(
          loadContactDual(pairContacts, p),
          penalty,
          max(penalty.w, 0.0),
          kStart,
        );
      }

      fn loadContactRecord(
        pairContacts: ptr<storage, array<vec4f>, read_write>,
        p: u32,
        kStart: f32,
      ) -> AvbdContactRecord {
        var record = makeContactRecord(
          loadContactDual(pairContacts, p),
          loadContactPenalty(pairContacts, p),
          loadContactShadow(pairContacts, p),
          kStart,
        );
        return record;
      }

      fn packContactPenalty(penaltyN: f32, penaltyTB: vec2f, frictionScale: f32, kStart: f32) -> vec4f {
        return vec4f(
          max(penaltyN, kStart),
          max(penaltyTB.x, kStart),
          max(penaltyTB.y, kStart),
          max(frictionScale, 0.0),
        );
      }

      fn packContactShadow(lambdaN: f32, lambdaTB: vec2f, frictionScale: f32) -> vec4f {
        return vec4f(max(lambdaN, 0.0), lambdaTB, max(frictionScale, 0.0));
      }

      fn storeContactRecord(
        pairContacts: ptr<storage, array<vec4f>, read_write>,
        p: u32,
        dual: vec4f,
        penaltyN: f32,
        penaltyTB: vec2f,
        lambdaN: f32,
        lambdaTB: vec2f,
        frictionScale: f32,
        kStart: f32,
      ) {
        storeContactDual(pairContacts, p, dual);
        storeContactPenalty(pairContacts, p, packContactPenalty(
          penaltyN,
          penaltyTB,
          frictionScale,
          kStart,
        ));
        storeContactShadow(pairContacts, p, packContactShadow(
          lambdaN,
          lambdaTB,
          frictionScale,
        ));
      }

      fn packSeedDualFromShadow(
        shadow: AvbdContactShadow,
        n: vec3f,
        t1: vec3f,
        t2: vec3f,
        useReferenceTangentialUpdate: u32,
      ) -> vec4f {
        let seedDualN = -shadow.lambdaN;
        let seedDualTWorld = t1 * shadow.lambdaTB.x + t2 * shadow.lambdaTB.y;
        return select(
          vec4f(seedDualN, seedDualTWorld),
          vec4f(seedDualN, shadow.lambdaTB, 0.0),
          useReferenceTangentialUpdate > 0u,
        );
      }

      fn contactStateDualTB(
        state: AvbdContactState,
        n: vec3f,
        t1: vec3f,
        t2: vec3f,
        useReferenceTangentialUpdate: u32,
      ) -> vec2f {
        let dualTWorldRaw = state.dual.yzw;
        let dualTWorld = dualTWorldRaw - n * dot(dualTWorldRaw, n);
        return select(
          vec2f(dot(dualTWorld, t1), dot(dualTWorld, t2)),
          state.dual.yz,
          useReferenceTangentialUpdate > 0u,
        );
      }
`),Ml=x(`
      const WORLD_BODY_INDEX: u32 = 0xffffffffu;
      const JOINT_TYPE_SPHERICAL: u32 = 0u;
      const JOINT_TYPE_FIXED: u32 = 1u;

      struct JointPoseState {
        position: vec3f,
        rotation: vec4f,
      };

      fn isFiniteF32(value: f32) -> bool {
        return value == value && abs(value) <= 0x1.fffffep+127f;
      }

      fn integrateQuaternionBackByAngularVelocity(
        currentQ: vec4f,
        angularVelocity: vec3f,
        dt: f32,
      ) -> vec4f {
        let speed = length(angularVelocity);
        if (speed <= 1e-8 || dt <= 0.0) {
          return normalize(currentQ);
        }
        let axis = angularVelocity / speed;
        let halfAngle = 0.5 * speed * dt;
        let delta = vec4f(axis * sin(halfAngle), cos(halfAngle));
        return normalize(qmul(qconj(delta), normalize(currentQ)));
      }

      fn jointRegularizationPose(
        bodyIndex: u32,
        initialPose: ptr<storage, array<vec4f>, read>,
        positions: ptr<storage, array<vec4f>, read>,
        quaternions: ptr<storage, array<vec4f>, read>,
        velocities: ptr<storage, array<vec4f>, read>,
        angularVelocities: ptr<storage, array<vec4f>, read>,
        dt: f32,
      ) -> JointPoseState {
        if (bodyIndex == WORLD_BODY_INDEX) {
          return JointPoseState(vec3f(0.0), vec4f(0.0, 0.0, 0.0, 1.0));
        }

        let invMass = positions[bodyIndex].w;
        if (invMass == 0.0) {
          let currentPos = positions[bodyIndex].xyz;
          let currentQ = normalize(quaternions[bodyIndex]);
          let previousPos = currentPos - velocities[bodyIndex].xyz * dt;
          let previousQ = integrateQuaternionBackByAngularVelocity(
            currentQ,
            angularVelocities[bodyIndex].xyz,
            dt,
          );
          return JointPoseState(previousPos, previousQ);
        }

        let poseBase = bodyIndex * 2u;
        return JointPoseState(
          initialPose[poseBase].xyz,
          normalize(initialPose[poseBase + 1u]),
        );
      }

      fn jointWorldAnchor(
        bodyIndex: u32,
        anchorLocal: vec3f,
        position: vec3f,
        rotation: vec4f,
      ) -> vec3f {
        return select(position + qrot(rotation, anchorLocal), anchorLocal, bodyIndex == WORLD_BODY_INDEX);
      }

      fn jointFixedAngularConstraint(
        bodyA: u32,
        qA: vec4f,
        qB: vec4f,
        torqueArm: f32,
      ) -> vec3f {
        let worldQA = normalize(select(qA, vec4f(0.0, 0.0, 0.0, 1.0), bodyA == WORLD_BODY_INDEX));
        let delta = qmul(worldQA, qconj(normalize(qB)));
        return 2.0 * delta.xyz * torqueArm;
      }

      fn jointBallSocketGeometricDiagonal(r: vec3f, force: vec3f) -> vec3f {
        let col0 = vec3f(
          -force.y * r.y - force.z * r.z,
          force.x * r.y,
          force.x * r.z,
        );
        let col1 = vec3f(
          force.y * r.x,
          -force.x * r.x - force.z * r.z,
          force.y * r.z,
        );
        let col2 = vec3f(
          force.z * r.x,
          force.z * r.y,
          -force.x * r.x - force.y * r.y,
        );
        return vec3f(length(col0), length(col1), length(col2));
      }

      // NOTE: the 6x6 system matrix is stored flat (array<f32, 36>, row-major)
      // because WebKit's WGSL->Metal compiler miscompiles nested private arrays
      // accessed from multiple dynamic inner loops (stores get sunk/lost),
      // which NaN'd the whole solver on visionOS/macOS Safari.
      fn addDiagonalVectorConstraint(
        lhs: ptr<function, array<f32, 36>>,
        rhs: ptr<function, array<f32, 6>>,
        j0: array<f32, 6>,
        j1: array<f32, 6>,
        j2: array<f32, 6>,
        stiffness: vec3f,
        force: vec3f,
      ) {
        for (var axis = 0u; axis < 3u; axis++) {
          let k = max(stiffness[axis], 0.0);
          if (k <= 0.0) { continue; }
          let f = force[axis];
          var row = j0;
          if (axis == 1u) { row = j1; }
          if (axis == 2u) { row = j2; }
          for (var r = 0u; r < 6u; r++) {
            (*rhs)[r] += row[r] * f;
            for (var c = 0u; c < 6u; c++) {
              (*lhs)[r * 6u + c] += k * row[r] * row[c];
            }
          }
        }
      }

      fn addScalarConstraint(
        lhs: ptr<function, array<f32, 36>>,
        rhs: ptr<function, array<f32, 6>>,
        row: array<f32, 6>,
        stiffness: f32,
        force: f32,
      ) {
        let k = max(stiffness, 0.0);
        if (k <= 0.0) { return; }
        for (var r = 0u; r < 6u; r++) {
          (*rhs)[r] += row[r] * force;
          for (var c = 0u; c < 6u; c++) {
            (*lhs)[r * 6u + c] += k * row[r] * row[c];
          }
        }
      }
`),Nl=class{buildContactDispatchArgsKernel;clearPhaseDebugCountersKernel;accumulatePhaseDebugCountersKernel;clearDebugCountersKernel;accumulateDebugCountersKernel;accumulateBodyColorDebugCountersKernel;prepareStateKernel;prepareJointStateKernel;buildSolverConstraintListsKernel;appendJointConstraintRefsKernel;appendSpringConstraintRefsKernel;greedyBodyColorsKernel;markHardColorConflictsKernel;repairHardBodyColorsKernel;primalBodySolveKernelGeneric;primalBodySolveKernelLocalDiag;primalBodySolveKernel;commitBodySolveKernel;capturePairDualStateKernel;captureJointDualStateKernel;finalizeVelocitiesKernel;contactDispatchIndirectAttr;phaseDebugCountersAttr;debugCountersAttr;pairContactsAttr;jointRecordsAttr;springRecordsAttr;positionsAttr;initialPoseAttr;quaternionsAttr;pairActivityAttr;bodySolveOutputPoseAttr;maxPairContacts;maxJoints;maxSprings;maxActivePairContacts;pairActiveContactsOffset;contactKeySlotBitCount;useLocalDiagonalPrimalSolveFastPath=!1;debugEnabled=!1;debugReadbackInFlight=!1;separatingTraceReadbackInFlight=!1;separatingTraceArmed=!0;lastDebugLogFrame=-1;debugEveryNFrames=30;constructor(e,t,n,r,i,a,o,s,c,u,d,f,m,h,g,_,v,y,b,x,S,C,w,E,D,O,k,A){this.pairContactsAttr=e,this.jointRecordsAttr=t,this.springRecordsAttr=n,this.positionsAttr=r,this.initialPoseAttr=i,this.quaternionsAttr=o,this.pairActivityAttr=y,this.bodySolveOutputPoseAttr=new q(new Float32Array(b*2*4),4),this.bodySolveOutputPoseAttr.name=`AVBD Body Solve Output Pose`,this.maxPairContacts=x,this.maxJoints=S,this.maxSprings=C,this.maxActivePairContacts=w,this.pairActiveContactsOffset=k;let j=Math.max(1,Math.min(8,Math.floor(O))),M=Math.ceil(Math.log2(j));this.contactKeySlotBitCount=M;let N=Math.max(1,31-M),P=Math.max(1,N-9),F=Math.max(1,2**P-1);this.contactDispatchIndirectAttr=new it(new Uint32Array([0,1,1]),1),this.contactDispatchIndirectAttr.name=`AVBD Contact Dispatch Indirect`,this.debugCountersAttr=new q(new Uint32Array(18),1),this.phaseDebugCountersAttr=new q(new Uint32Array(18),1);let I=l(`
      fn compute(
        pairActivity: ptr<storage, array<u32>, read_write>,
        dispatchIndirect: ptr<storage, array<u32>, read_write>,
        pairDispatchCount: u32,
      ) -> void {
        let activeCount = min(min(pairActivity[${k}u], pairDispatchCount), ${w}u);
        let workgroups = (activeCount + ${$}u - 1u) / ${$}u;
        dispatchIndirect[0] = workgroups;
        dispatchIndirect[1] = 1u;
        dispatchIndirect[2] = 1u;
      }
    `);this.buildContactDispatchArgsKernel=I({pairActivity:Z(y,`uint`,A),dispatchIndirect:Z(this.contactDispatchIndirectAttr,`uint`,3),pairDispatchCount:T(0)}).computeKernel([1,1,1]).setName(`AVBD Build Contact Dispatch Args`);let L=l(`
      fn compute(
        phaseDebugCounters: ptr<storage, array<atomic<u32>>, read_write>,
      ) -> void {
        for (var i = 0u; i < 18u; i++) {
          atomicStore(&phaseDebugCounters[i], 0u);
        }
      }
    `);this.clearPhaseDebugCountersKernel=L({phaseDebugCounters:Z(this.phaseDebugCountersAttr,`uint`,18).toAtomic()}).computeKernel([1,1,1]).setName(`AVBD Clear Phase Debug Counters`);let R=l(`
      fn compute(
        positions: ptr<storage, array<vec4f>, read>,
        quaternions: ptr<storage, array<vec4f>, read>,
        initialPose: ptr<storage, array<vec4f>, read>,
        pairContacts: ptr<storage, array<vec4f>, read_write>,
        pairActivity: ptr<storage, array<u32>, read_write>,
        phaseDebugCounters: ptr<storage, array<atomic<u32>>, read_write>,
        pairDispatchCount: u32,
        regularizationAlpha: f32,
        tangentialRegularizationAlpha: f32,
        phaseOffset: u32,
        frictionSolveScale: f32,
        useReferenceTangentialUpdate: u32,
        frictionStatic: f32,
        frictionDynamic: f32,
        kStart: f32,
        dualForceMax: f32,
        enableNormalReleaseHeuristic: u32,
        useNormalContactMargin: u32,
        useLocalContactArms: u32,
        workgroupId: vec3u,
        localId: vec3u,
      ) -> void {
        let gid = workgroupId.x * ${$}u + localId.x;
        let activeCount = min(min(pairActivity[${k}u], pairDispatchCount), ${w}u);
        if (gid >= activeCount) { return; }

        let p = pairActivity[${k}u + gid + 1u];
        if (p >= ${x}u) { return; }
        let base = min(phaseOffset, 9u);
        atomicAdd(&phaseDebugCounters[base + 0u], 1u);

        let n = loadContactNormalPen(pairContacts, p).xyz;
        if (dot(n, n) <= 1e-10) { return; }

        if (n.y >= 0.0) {
          atomicAdd(&phaseDebugCounters[base + 4u], 1u);
        } else {
          atomicAdd(&phaseDebugCounters[base + 5u], 1u);
        }

        let armA = loadContactArmA(pairContacts, p);
        let armB = loadContactArmB(pairContacts, p);
        let contactMeta = loadContactMeta(pairContacts, p);
        let i = u32(contactMeta.x + 0.5);
        let j = u32(contactMeta.y + 0.5);
        if (i >= ${b}u || j >= ${b}u || i == j) { return; }

        let raStored = armA.xyz;
        let rbStored = armB.xyz;
        let posA = positions[i].xyz;
        let posB = positions[j].xyz;
        let qA = normalize(quaternions[i]);
        let qB = normalize(quaternions[j]);
        let poseBaseA = i * 2u;
        let poseBaseB = j * 2u;
        let prevPosA = initialPose[poseBaseA].xyz;
        let prevPosB = initialPose[poseBaseB].xyz;
        let prevQA = normalize(initialPose[poseBaseA + 1u]);
        let prevQB = normalize(initialPose[poseBaseB + 1u]);
        let localContactArms = useLocalContactArms > 0u;
        let ra = select(raStored, qrot(qA, raStored), localContactArms);
        let rb = select(rbStored, qrot(qB, rbStored), localContactArms);
        let dqAraw = qmul(qA, qconj(prevQA));
        let dqBraw = qmul(qB, qconj(prevQB));
        let dqA = select(dqAraw, -dqAraw, dqAraw.w < 0.0);
        let dqB = select(dqBraw, -dqBraw, dqBraw.w < 0.0);
        let dThetaA = 2.0 * dqA.xyz;
        let dThetaB = 2.0 * dqB.xyz;
        let dPosA = posA - prevPosA;
        let dPosB = posB - prevPosB;

        let jAL = -n;
        let jBL = n;
        let jAA = -cross(ra, n);
        let jBA = cross(rb, n);

        let tangentBasis = tangentBasisFromAngle(n, armA.w);
        let t1 = tangentBasis.t1;
        let t2 = tangentBasis.t2;

        let jt1AL = -t1;
        let jt1BL = t1;
        let jt1AA = -cross(ra, t1);
        let jt1BA = cross(rb, t1);
        let jt2AL = -t2;
        let jt2BL = t2;
        let jt2AA = -cross(ra, t2);
        let jt2BA = cross(rb, t2);

        let penetration0 = max(loadContactNormalPen(pairContacts, p).w, 0.0);
        let cachedConstraintC0 = loadContactConstraintC0(pairContacts, p);
        let c0 = cachedConstraintC0.x;
        let cRegN = (1.0 - regularizationAlpha) * c0
          + dot(jAL, dPosA)
          + dot(jAA, dThetaA)
          + dot(jBL, dPosB)
          + dot(jBA, dThetaB);
        if (cRegN > 0.0) {
          atomicAdd(&phaseDebugCounters[base + 6u], 1u);
        }

        let c0T1 = cachedConstraintC0.y;
        let c0T2 = cachedConstraintC0.z;
        let cRegT1 = (1.0 - tangentialRegularizationAlpha) * c0T1
          + dot(jt1AL, dPosA)
          + dot(jt1AA, dThetaA)
          + dot(jt1BL, dPosB)
          + dot(jt1BA, dThetaB);
        let cRegT2 = (1.0 - tangentialRegularizationAlpha) * c0T2
          + dot(jt2AL, dPosA)
          + dot(jt2AA, dThetaA)
          + dot(jt2BL, dPosB)
          + dot(jt2BA, dThetaB);

        let contactState = loadContactStateHot(pairContacts, p, kStart);
        let dualState = contactState.dual;
        let dualN = clamp(dualState.x, -dualForceMax, 0.0);
        let penaltyN = max(contactState.penaltyN, kStart);
        let penaltyTB = max(contactState.penalty.yz, vec2f(kStart));
        let lambdaPlusN = dualN + penaltyN * cRegN;
        var lambdaAppliedN = clamp(lambdaPlusN, -dualForceMax, 0.0);
        let normalSupportThreshold = 1e-6;
        let normalReleaseTolerance = max(2e-5, 1.25 * penetration0);
        let normalReleaseDecayNear = 0.85;
        let normalReleaseDecayFar = 0.6;
        let normalReleaseMinSupport = -5e-4;
        if (
          enableNormalReleaseHeuristic > 0u &&
          penetration0 > 1e-6
          && dualN < -normalSupportThreshold
          && cRegN > 0.0
          && -lambdaAppliedN <= normalSupportThreshold
        ) {
          let releaseDecay = select(normalReleaseDecayFar, normalReleaseDecayNear, cRegN <= normalReleaseTolerance);
          lambdaAppliedN = min(dualN * releaseDecay, normalReleaseMinSupport);
        }
        if (-lambdaAppliedN <= normalSupportThreshold) {
          atomicAdd(&phaseDebugCounters[base + 3u], 1u);
        }
        let frictionSeparationTolerance = normalReleaseTolerance;
        let frictionOffSeparation = -lambdaAppliedN <= normalSupportThreshold
          || (enableNormalReleaseHeuristic > 0u && cRegN > frictionSeparationTolerance);

        let frictionScale = contactState.frictionScale;
        let muStatic = frictionStatic * frictionScale * frictionSolveScale;
        let muDynamic = frictionDynamic * frictionScale * frictionSolveScale;
        let dualTB = contactStateDualTB(contactState, n, t1, t2, useReferenceTangentialUpdate);
        let prevTMag = length(dualTB);
        let staticBoundPrev = muStatic * abs(dualN);
        let useStatic = prevTMag <= staticBoundPrev + 1e-6;
        let mu = select(muDynamic, muStatic, useStatic);
        let frictionBound = max(mu * (-dualN), 0.0);
        if (frictionOffSeparation && frictionBound > 1e-6) {
          atomicAdd(&phaseDebugCounters[base + 8u], 1u);
        }
        if (frictionBound > 1e-6) {
          atomicAdd(&phaseDebugCounters[base + 1u], 1u);
          let lambdaPlusTB = vec2f(
            penaltyTB.x * cRegT1 + dualTB.x,
            penaltyTB.y * cRegT2 + dualTB.y,
          );
          let lambdaPlusTBLen2 = dot(lambdaPlusTB, lambdaPlusTB);
          var lambdaAppliedTB = lambdaPlusTB;
          if (lambdaPlusTBLen2 > frictionBound * frictionBound && lambdaPlusTBLen2 > 1e-12) {
            lambdaAppliedTB *= frictionBound * inverseSqrt(lambdaPlusTBLen2);
            atomicAdd(&phaseDebugCounters[base + 7u], 1u);
          }
          let lambdaAppliedTBLen2 = dot(lambdaAppliedTB, lambdaAppliedTB);
          if (lambdaAppliedTBLen2 >= (0.95 * 0.95) * frictionBound * frictionBound) {
            atomicAdd(&phaseDebugCounters[base + 2u], 1u);
          }
        }
      }
    `,[Ir,Fr,Lr,Al,Vc,jl]);this.accumulatePhaseDebugCountersKernel=R({positions:Z(r,`vec4f`,b).toReadOnly(),quaternions:Z(o,`vec4f`,b).toReadOnly(),initialPose:Z(i,`vec4f`,b*2).toReadOnly(),pairContacts:Z(e,`vec4f`,x*9),pairActivity:Z(y,`uint`,A),phaseDebugCounters:Z(this.phaseDebugCountersAttr,`uint`,18).toAtomic(),pairDispatchCount:T(0),regularizationAlpha:T(1),tangentialRegularizationAlpha:T(1),phaseOffset:T(0),frictionSolveScale:T(1),useReferenceTangentialUpdate:T(1),frictionStatic:T(Gn),frictionDynamic:T(Kn),kStart:T(vl),dualForceMax:T(5e5),enableNormalReleaseHeuristic:T(0),useNormalContactMargin:T(1),useLocalContactArms:T(1),workgroupId:p,localId:W}).computeKernel([$,1,1]).setName(`AVBD Accumulate Phase Debug Counters`);let z=l(`
      fn compute(
        debugCounters: ptr<storage, array<atomic<u32>>, read_write>,
      ) -> void {
        for (var i = 0u; i < 18u; i++) {
          atomicStore(&debugCounters[i], 0u);
        }
      }
    `);this.clearDebugCountersKernel=z({debugCounters:Z(this.debugCountersAttr,`uint`,18).toAtomic()}).computeKernel([1,1,1]).setName(`AVBD Clear Debug Counters`);let B=l(`
      fn compute(
        pairActivity: ptr<storage, array<u32>, read_write>,
        pairContacts: ptr<storage, array<vec4f>, read_write>,
        debugCounters: ptr<storage, array<atomic<u32>>, read_write>,
        pairDispatchCount: u32,
        useReferenceTangentialUpdate: u32,
        frictionStatic: f32,
        frictionDynamic: f32,
        kStart: f32,
        workgroupId: vec3u,
        localId: vec3u,
      ) -> void {
        let gid = workgroupId.x * ${$}u + localId.x;
        let activeCount = min(min(pairActivity[${k}u], pairDispatchCount), ${w}u);
        if (gid >= activeCount) { return; }

        let p = pairActivity[${k}u + gid + 1u];
        if (p >= ${x}u) { return; }
        atomicAdd(&debugCounters[0], 1u);

        let n = loadContactNormalPen(pairContacts, p).xyz;
        let nLen2 = dot(n, n);
        if (nLen2 <= 1e-10) { return; }
        atomicAdd(&debugCounters[1], 1u);

        if (n.y >= 0.0) {
          atomicAdd(&debugCounters[6], 1u);
        } else {
          atomicAdd(&debugCounters[7], 1u);
        }
        let absNy = abs(n.y);
        if (absNy > 0.9) {
          atomicAdd(&debugCounters[9], 1u);
        } else if (absNy < 0.2) {
          atomicAdd(&debugCounters[10], 1u);
        }

        let contactState = loadContactStateHot(pairContacts, p, kStart);
        let dualState = contactState.dual;
        let normalMag = contactState.lambdaN;
        if (normalMag <= 1e-6) {
          atomicAdd(&debugCounters[5], 1u);
        }

        let frictionScale = contactState.frictionScale;
        let muStatic = frictionStatic * frictionScale;
        let muDynamic = frictionDynamic * frictionScale;
        let dualTB = contactStateDualTB(contactState, n, vec3f(1.0, 0.0, 0.0), vec3f(0.0, 1.0, 0.0), 1u);
        let dualTWorldRaw = dualState.yzw;
        let dualTWorld = dualTWorldRaw - n * dot(dualTWorldRaw, n);
        let dualTMag = select(length(dualTWorld), length(dualTB), useReferenceTangentialUpdate > 0u);
        let staticBound = muStatic * normalMag;
        let useStatic = dualTMag <= staticBound + 1e-6;

        let mu = select(muDynamic, muStatic, useStatic);
        let frictionBound = max(mu * normalMag, 0.0);
        if (frictionBound > 1e-6) {
          atomicAdd(&debugCounters[2], 1u);
          if (useStatic) {
            atomicAdd(&debugCounters[3], 1u);
          }
          if (dualTMag >= 0.95 * frictionBound) {
            atomicAdd(&debugCounters[4], 1u);
          }
          // Strict violation against static-cone bound.
          if (dualTMag > staticBound + 1e-3) {
            atomicAdd(&debugCounters[8], 1u);
          }
        }
      }
    `,[Al,Vc,jl]);this.accumulateDebugCountersKernel=B({pairActivity:Z(y,`uint`,A),pairContacts:Z(e,`vec4f`,x*9),debugCounters:Z(this.debugCountersAttr,`uint`,18).toAtomic(),pairDispatchCount:T(0),useReferenceTangentialUpdate:T(0),frictionStatic:T(Gn),frictionDynamic:T(Kn),kStart:T(vl),workgroupId:p,localId:W}).computeKernel([$,1,1]).setName(`AVBD Accumulate Debug Counters`);let V=l(`
      fn compute(
        bodyConstraintCounts: ptr<storage, array<u32>, read>,
        bodyConstraintRefs: ptr<storage, array<u32>, read>,
        pairContacts: ptr<storage, array<vec4f>, read_write>,
        jointRecords: ptr<storage, array<vec4f>, read_write>,
        springRecords: ptr<storage, array<vec4f>, read_write>,
        debugCounters: ptr<storage, array<atomic<u32>>, read_write>,
        bodyCount: u32,
        workgroupId: vec3u,
        localId: vec3u,
      ) -> void {
        let gid = workgroupId.x * ${$}u + localId.x;
        if (gid >= bodyCount) { return; }

        let word = bodyConstraintCounts[gid];
        let constraintCount = min(word & 0xFFFFu, ${E}u);
        if (constraintCount == 0u) { return; }

        atomicAdd(&debugCounters[11], 1u);
        atomicAdd(&debugCounters[13], constraintCount);
        atomicMax(&debugCounters[15], constraintCount);
        if (constraintCount >= ${E}u) {
          atomicAdd(&debugCounters[14], 1u);
        }
        if ((word & ${Cl}u) != 0u) {
          atomicAdd(&debugCounters[12], 1u);
        }

        let bodyColor = (word >> 16u) & 0xFFu;
        let base = gid * ${E}u;
        for (var k = 0u; k < ${E}u; k++) {
          if (k >= constraintCount) { break; }
          let constraintRef = bodyConstraintRefs[base + k];
          let constraintTag = constraintRef & ${Tl}u;
          let constraintIndex = constraintRef & ${El}u;
          var other = debugConstraintOtherBodyForContact(gid, constraintRef, pairContacts);
          if (constraintTag == ${Dl}u) {
            other = debugConstraintOtherBodyForJoint(gid, constraintIndex, jointRecords);
          } else if (constraintTag == ${Ol}u) {
            other = debugConstraintOtherBodyForSpring(gid, constraintIndex, springRecords);
          }
          if (other >= bodyCount || other <= gid) { continue; }

          let otherWord = bodyConstraintCounts[other];
          let otherConstraintCount = min(otherWord & 0xFFFFu, ${E}u);
          if (otherConstraintCount == 0u) { continue; }

          atomicAdd(&debugCounters[16], 1u);
          let otherColor = (otherWord >> 16u) & 0xFFu;
          if (otherColor == bodyColor) {
            atomicAdd(&debugCounters[17], 1u);
          }
        }
      }

      fn debugConstraintOtherBodyForContact(
        body: u32,
        contactIndex: u32,
        pairContacts: ptr<storage, array<vec4f>, read_write>,
      ) -> u32 {
        if (contactIndex >= ${x}u) { return ${b}u; }
        let contactMeta = loadContactMeta(pairContacts, contactIndex);
        let i = u32(contactMeta.x + 0.5);
        let j = u32(contactMeta.y + 0.5);
        if (i == body) { return j; }
        if (j == body) { return i; }
        return ${b}u;
      }

      fn debugConstraintOtherBodyForJoint(
        body: u32,
        jointIndex: u32,
        jointRecords: ptr<storage, array<vec4f>, read_write>,
      ) -> u32 {
        if (jointIndex >= ${S}u) { return ${b}u; }
        let jointMeta = loadJointMetaWords(jointRecords, jointIndex);
        if (jointMeta.w == 0u) { return ${b}u; }
        if (jointMeta.x == body) { return jointMeta.y; }
        if (jointMeta.y == body) { return jointMeta.x; }
        return ${b}u;
      }

      fn debugConstraintOtherBodyForSpring(
        body: u32,
        springIndex: u32,
        springRecords: ptr<storage, array<vec4f>, read_write>,
      ) -> u32 {
        if (springIndex >= ${C}u) { return ${b}u; }
        let springMeta = loadSpringMetaWords(springRecords, springIndex);
        if (springMeta.z == 0u) { return ${b}u; }
        if (springMeta.x == body) { return springMeta.y; }
        if (springMeta.y == body) { return springMeta.x; }
        return ${b}u;
      }
    `,[Vc,ml,Bn]);this.accumulateBodyColorDebugCountersKernel=V({bodyConstraintCounts:Z(m,`uint`,b).toReadOnly(),bodyConstraintRefs:Z(h,`uint`,b*E).toReadOnly(),pairContacts:Z(e,`vec4f`,x*9),jointRecords:Z(t,`vec4f`,S*11),springRecords:Z(n,`vec4f`,C*3),debugCounters:Z(this.debugCountersAttr,`uint`,18).toAtomic(),bodyCount:T(0),workgroupId:p,localId:W}).computeKernel([$,1,1]).setName(`AVBD Accumulate Body Color Debug Counters`);let H=l(`
      fn compute(
        pairContacts: ptr<storage, array<vec4f>, read_write>,
        pairActivity: ptr<storage, array<u32>, read_write>,
        pairDispatchCount: u32,
        lambdaWarmstartScale: f32,
        softenWarmstartOnSlotChange: u32,
        useReferenceTangentialUpdate: u32,
        preserveTangentialPenaltyOnStick: u32,
        useIsotropicTangentialPenaltyOnStick: u32,
        tangentialPenaltyCapScale: f32,
        frictionStatic: f32,
        gamma: f32,
        kStart: f32,
        workgroupId: vec3u,
        localId: vec3u,
      ) -> void {
        let gid = workgroupId.x * ${$}u + localId.x;
        let activeCount = min(min(pairActivity[${k}u], pairDispatchCount), ${w}u);
        if (gid >= activeCount) { return; }

        let p = pairActivity[${k}u + gid + 1u];
        if (p >= ${x}u) { return; }
        let prevContactRecord = loadContactRecord(pairContacts, p, kStart);
        let contactShadow = prevContactRecord.shadow.packed;
        let prevContactState = prevContactRecord.state;
        let frictionScale = prevContactState.frictionScale;

        let info = loadContactMeta(pairContacts, p);
        if (info.z < 0.5) {
          storeContactCacheWord(pairContacts, p, 0u);
          storeContactDual(pairContacts, p, vec4f(0.0));
          storeContactPenalty(pairContacts, p, packContactPenalty(kStart, vec2f(kStart), frictionScale, kStart));
          return;
        }

        var i = u32(info.x + 0.5);
        var j = u32(info.y + 0.5);
        if (i > j) {
          let t = i;
          i = j;
          j = t;
        }
        let encodedInfo = bitcast<u32>(info.w);
        let feature = encodedInfo & 0x1FFu;
        let preserveWarmstart = ((encodedInfo >> 16u) & 0x1u) != 0u;
        let stick = ((encodedInfo >> 17u) & 0x1u) != 0u;
        let warmstartReason = (encodedInfo >> 21u) & 0x7u;
        let exactFeatureWarmstart = warmstartReason == 1u;
        let localSlot = p % ${j}u;
        let packedBodies = (i & 0xFFFFu) | ((j & 0xFFFFu) << 16u);
        // Build a structured key:
        // high identity bits = body-pair/contact identity, low slot bits = slot id.
        // This allows continuity across manifold slot remaps without letting
        // unrelated clipped contact points inherit the same dual state.
        // Preserve the exact geometric feature bits inside the continuity key.
        // The previous hash-only base could alias adjacent face ordinals
        // (for example 0xa9 and 0xaa), which made slot swaps look like valid
        // continuity holds. Match avbd-demo3d more closely by keeping the
        // feature exact and hashing only the body-pair portion.
        let pairHash = 1u + (((packedBodies * 2246822519u) ^ (packedBodies >> 16u) ^ (packedBodies << 7u)) % ${F}u);
        let keyBase = (pairHash << 9u) | feature;
        let key = (keyBase << ${M}u) | localSlot;

        let prevKeyPacked = loadContactCacheWord(pairContacts, p);
        let prevKey = prevKeyPacked & 0x7fffffffu;
        let prevBase = prevKey >> ${M}u;
        let continuityHeld = preserveWarmstart && prevKey != 0u && prevBase == keyBase;
        let slotChanged = prevKey != key;
        var prevDual = prevContactState.dual;
        var prevPenalty = prevContactState.penalty;
        let prevDualN = min(prevDual.x, 0.0);
        let prevLambdaN = prevContactState.lambdaN;
        let prevPenaltyN = prevContactState.penaltyN;
        // pairLambdas is a derived positive-magnitude shadow used for
        // heuristics/debug and one-step contact-generation seed transport.
        // Once prepare runs, avbdDualState becomes the authoritative record.
        let seedShadow = prevContactRecord.shadow;
        let matchedCarryN = seedShadow.lambdaN;
        if (!continuityHeld) {
          // Reference parity: unmatched rows start from zero lambda and
          // minimum penalty. Do not promote generation-time shadow seeds into
          // the live solver state on continuity miss.
          storeContactDual(pairContacts, p, vec4f(0.0));
          storeContactPenalty(
            pairContacts,
            p,
            packContactPenalty(kStart, vec2f(kStart), seedShadow.frictionScale, kStart),
          );
        } else {
          let slotWarmstartScale = 1.0;
          var warmDual = prevDual * lambdaWarmstartScale;
          var warmDualN = min(warmDual.x, 0.0);
          var warmStoredDual = vec4f(0.0);
          if (useReferenceTangentialUpdate > 0u) {
            // Reference parity: warmstart is a plain Eq.19-style decay.
            // Do not reclamp tangential dual against the friction cone during
            // prepare; the references leave cone enforcement to the dual
            // update/solve path.
            warmStoredDual = vec4f(warmDualN, warmDual.yz, 0.0);
          } else {
            var warmDualT = warmDual.yzw;
            let nRaw = loadContactNormalPen(pairContacts, p).xyz;
            let nLen2 = dot(nRaw, nRaw);
            if (nLen2 > 1e-10) {
              let nUnit = nRaw * inverseSqrt(nLen2);
              warmDualT -= nUnit * dot(warmDualT, nUnit);
            } else {
              warmDualT = vec3f(0.0);
            }
            warmStoredDual = vec4f(warmDualN, warmDualT);
          }
          var warmPenaltyN = max(prevPenalty.x * gamma, kStart);
          var warmPenaltyT1 = max(prevPenalty.y * gamma, kStart);
          var warmPenaltyT2 = max(prevPenalty.z * gamma, kStart);
          let holdTangentialPenalty = preserveTangentialPenaltyOnStick > 0u
            && useReferenceTangentialUpdate == 0u
            && stick
            && prevKey == key;
          if (holdTangentialPenalty) {
            warmPenaltyT1 = max(prevPenalty.y, kStart);
            warmPenaltyT2 = max(prevPenalty.z, kStart);
          }
          if (tangentialPenaltyCapScale > 0.0 && useReferenceTangentialUpdate == 0u) {
            let tangentialPenaltyCap = max(warmPenaltyN * tangentialPenaltyCapScale, kStart);
            warmPenaltyT1 = min(warmPenaltyT1, tangentialPenaltyCap);
            warmPenaltyT2 = min(warmPenaltyT2, tangentialPenaltyCap);
          }
          if (
            useIsotropicTangentialPenaltyOnStick > 0u
            && useReferenceTangentialUpdate == 0u
            && stick
            && prevKey == key
          ) {
            let sharedPenaltyT = max(0.5 * (warmPenaltyT1 + warmPenaltyT2), kStart);
            warmPenaltyT1 = sharedPenaltyT;
            warmPenaltyT2 = sharedPenaltyT;
          }
          storeContactDual(pairContacts, p, warmStoredDual);
          storeContactPenalty(pairContacts, p, packContactPenalty(
            warmPenaltyN,
            vec2f(warmPenaltyT1, warmPenaltyT2),
            frictionScale,
            kStart,
          ));
        }

        storeContactCacheWord(pairContacts, p, key | select(0u, 0x80000000u, continuityHeld));
      }
    `,[Al,Vc,jl]);this.prepareStateKernel=H({pairContacts:Z(e,`vec4f`,x*9),pairActivity:Z(y,`uint`,A),pairDispatchCount:T(0),lambdaWarmstartScale:T(.95*gl),softenWarmstartOnSlotChange:T(0),useReferenceTangentialUpdate:T(1),preserveTangentialPenaltyOnStick:T(0),useIsotropicTangentialPenaltyOnStick:T(0),tangentialPenaltyCapScale:T(0),frictionStatic:T(Gn),gamma:T(gl),kStart:T(vl),workgroupId:p,localId:W}).computeKernel([$,1,1]).setName(`AVBD Prepare Contact State`),Pr(`AVBD Prepare Contact State`,9);let ee=l(`
      fn compute(
        positions: ptr<storage, array<vec4f>, read>,
        quaternions: ptr<storage, array<vec4f>, read>,
        velocities: ptr<storage, array<vec4f>, read>,
        angularVelocities: ptr<storage, array<vec4f>, read>,
        initialPose: ptr<storage, array<vec4f>, read>,
        jointRecords: ptr<storage, array<vec4f>, read_write>,
        jointCount: u32,
        lambdaWarmstartScale: f32,
        gamma: f32,
        kStart: f32,
        dt: f32,
        workgroupId: vec3u,
        localId: vec3u,
      ) -> void {
        let gid = workgroupId.x * ${$}u + localId.x;
        if (gid >= jointCount) { return; }

        let jointMetaWords = loadJointMetaWords(jointRecords, gid);
        if (jointMetaWords.w == 0u) { return; }

        let bodyA = jointMetaWords.x;
        let bodyB = jointMetaWords.y;
        let jointType = jointMetaWords.z;
        let anchorA = loadJointAnchorA(jointRecords, gid);
        let anchorB = loadJointAnchorB(jointRecords, gid);
        let torqueArm = max(anchorA.w, 1.0);

        var qA = vec4f(0.0, 0.0, 0.0, 1.0);
        var posA = anchorA.xyz;
        if (bodyA != WORLD_BODY_INDEX) {
          qA = normalize(initialPose[bodyA * 2u + 1u]);
          posA = initialPose[bodyA * 2u].xyz;
        }
        let qB = normalize(initialPose[bodyB * 2u + 1u]);
        let posB = initialPose[bodyB * 2u].xyz;
        let worldAnchorA = jointWorldAnchor(bodyA, anchorA.xyz, posA, qA);
        let worldAnchorB = posB + qrot(qB, anchorB.xyz);
        let regularizationPoseA = jointRegularizationPose(
          bodyA,
          initialPose,
          positions,
          quaternions,
          velocities,
          angularVelocities,
          dt,
        );
        let regularizationPoseB = jointRegularizationPose(
          bodyB,
          initialPose,
          positions,
          quaternions,
          velocities,
          angularVelocities,
          dt,
        );
        let regularizationAnchorA = jointWorldAnchor(
          bodyA,
          anchorA.xyz,
          regularizationPoseA.position,
          regularizationPoseA.rotation,
        );
        let regularizationAnchorB = jointWorldAnchor(
          bodyB,
          anchorB.xyz,
          regularizationPoseB.position,
          regularizationPoseB.rotation,
        );
        let c0Lin = regularizationAnchorA - regularizationAnchorB;
        storeJointC0Lin(jointRecords, gid, vec4f(c0Lin, 0.0));

        let c0Ang = select(
          vec3f(0.0),
          jointFixedAngularConstraint(
            bodyA,
            regularizationPoseA.rotation,
            regularizationPoseB.rotation,
            torqueArm,
          ),
          jointType == JOINT_TYPE_FIXED,
        );
        storeJointC0Ang(jointRecords, gid, vec4f(c0Ang, 0.0));

        let prevLambdaLin = loadJointLambdaLin(jointRecords, gid).xyz;
        let prevLambdaAng = loadJointLambdaAng(jointRecords, gid).xyz;
        let prevPenaltyLin = max(loadJointPenaltyLin(jointRecords, gid).xyz, vec3f(kStart));
        let stiffness = loadJointStiffness(jointRecords, gid);
        let rigidLinear = !isFiniteF32(stiffness.x);
        let angularEnabled = jointType == JOINT_TYPE_FIXED && stiffness.y > 0.0;
        let rigidAngular = angularEnabled && !isFiniteF32(stiffness.y);
        let minPenaltyAng = select(vec3f(0.0), vec3f(kStart), angularEnabled);
        let prevPenaltyAng = max(loadJointPenaltyAng(jointRecords, gid).xyz, minPenaltyAng);
        let maxPenaltyLin = vec3f(min(max(stiffness.x, kStart), ${yl}));
        let maxPenaltyAng = vec3f(min(max(stiffness.y, 0.0), ${yl}));

        storeJointLambdaLin(
          jointRecords,
          gid,
          vec4f(prevLambdaLin * lambdaWarmstartScale, 0.0),
        );
        storeJointLambdaAng(
          jointRecords,
          gid,
          vec4f(select(vec3f(0.0), prevLambdaAng * lambdaWarmstartScale, angularEnabled), 0.0),
        );
        storeJointPenaltyLin(
          jointRecords,
          gid,
          vec4f(min(max(prevPenaltyLin * gamma, vec3f(kStart)), maxPenaltyLin), 0.0),
        );
        storeJointPenaltyAng(
          jointRecords,
          gid,
          vec4f(min(max(prevPenaltyAng * gamma, minPenaltyAng), maxPenaltyAng), 0.0),
        );
      }
    `,[Ir,Fr,Lr,ml,Ml]);this.prepareJointStateKernel=ee({positions:Z(r,`vec4f`,b).toReadOnly(),quaternions:Z(o,`vec4f`,b).toReadOnly(),velocities:Z(s,`vec4f`,b).toReadOnly(),angularVelocities:Z(u,`vec4f`,b).toReadOnly(),initialPose:Z(i,`vec4f`,b*2).toReadOnly(),jointRecords:Z(t,`vec4f`,S*11),jointCount:T(0),lambdaWarmstartScale:T(.95*gl),gamma:T(gl),kStart:T(vl),dt:T(1/60/4),workgroupId:p,localId:W}).computeKernel([$,1,1]).setName(`AVBD Prepare Joint State`),Pr(`AVBD Prepare Joint State`,6);let te=l(`
      fn compute(
        pairBodyContactCounts: ptr<storage, array<u32>, read>,
        pairBodyContactIndices: ptr<storage, array<u32>, read>,
        bodyConstraintCounts: ptr<storage, array<u32>, read_write>,
        bodyConstraintRefs: ptr<storage, array<u32>, read_write>,
        bodyColorScratch: ptr<storage, array<u32>, read_write>,
        bodyCount: u32,
        workgroupId: vec3u,
        localId: vec3u,
      ) -> void {
        let gid = workgroupId.x * ${$}u + localId.x;
        if (gid >= bodyCount) { return; }

        let previousColor = (bodyConstraintCounts[gid] >> 16u) & 0xFFu;
        bodyColorScratch[gid] = previousColor << 16u;
        let contactCount = min(pairBodyContactCounts[gid] & 0xFFFFu, ${D}u);
        let solverCount = min(contactCount, ${E}u);
        bodyConstraintCounts[gid] = solverCount;
        let srcBase = gid * ${D}u;
        let dstBase = gid * ${E}u;
        for (var k = 0u; k < ${E}u; k++) {
          if (k < solverCount) {
            bodyConstraintRefs[dstBase + k] = pairBodyContactIndices[srcBase + k];
          } else {
            bodyConstraintRefs[dstBase + k] = 0u;
          }
        }
      }
    `);this.buildSolverConstraintListsKernel=te({pairBodyContactCounts:Z(g,`uint`,b).toReadOnly(),pairBodyContactIndices:Z(_,`uint`,b*D).toReadOnly(),bodyConstraintCounts:Z(m,`uint`,b),bodyConstraintRefs:Z(h,`uint`,b*E),bodyColorScratch:Z(v,`uint`,b),bodyCount:T(0),workgroupId:p,localId:W}).computeKernel([$,1,1]).setName(`AVBD Build Solver Constraint Lists`),Pr(`AVBD Build Solver Constraint Lists`,5);let ne=l(`
      fn compute(
        positions: ptr<storage, array<vec4f>, read>,
        jointRecords: ptr<storage, array<vec4f>, read_write>,
        bodyConstraintCounts: ptr<storage, array<atomic<u32>>, read_write>,
        bodyConstraintRefs: ptr<storage, array<u32>, read_write>,
        jointCount: u32,
        workgroupId: vec3u,
        localId: vec3u,
      ) -> void {
        let gid = workgroupId.x * ${$}u + localId.x;
        if (gid >= jointCount) { return; }

        let jointMetaWords = loadJointMetaWords(jointRecords, gid);
        if (jointMetaWords.w == 0u) { return; }

        let taggedRef = ${Dl}u | gid;
        let bodyA = jointMetaWords.x;
        let bodyB = jointMetaWords.y;

        if (bodyA != 0xffffffffu && positions[bodyA].w > 0.0) {
          let slotA = atomicAdd(&bodyConstraintCounts[bodyA], 1u);
          if (slotA < ${E}u) {
            bodyConstraintRefs[bodyA * ${E}u + slotA] = taggedRef;
          }
        }
        if (positions[bodyB].w > 0.0) {
          let slotB = atomicAdd(&bodyConstraintCounts[bodyB], 1u);
          if (slotB < ${E}u) {
            bodyConstraintRefs[bodyB * ${E}u + slotB] = taggedRef;
          }
        }
      }
    `,[Ir,Fr,Lr,ml,Ml]);this.appendJointConstraintRefsKernel=ne({positions:Z(r,`vec4f`,b).toReadOnly(),jointRecords:Z(t,`vec4f`,S*11),bodyConstraintCounts:Z(m,`uint`,b).toAtomic(),bodyConstraintRefs:Z(h,`uint`,b*E),jointCount:T(0),workgroupId:p,localId:W}).computeKernel([$,1,1]).setName(`AVBD Append Joint Constraint Refs`),Pr(`AVBD Append Joint Constraint Refs`,4);let re=l(`
      fn compute(
        positions: ptr<storage, array<vec4f>, read>,
        springRecords: ptr<storage, array<vec4f>, read_write>,
        bodyConstraintCounts: ptr<storage, array<atomic<u32>>, read_write>,
        bodyConstraintRefs: ptr<storage, array<u32>, read_write>,
        springCount: u32,
        workgroupId: vec3u,
        localId: vec3u,
      ) -> void {
        let gid = workgroupId.x * ${$}u + localId.x;
        if (gid >= springCount) { return; }

        let springMetaWords = loadSpringMetaWords(springRecords, gid);
        if (springMetaWords.z == 0u) { return; }

        let taggedRef = ${Ol}u | gid;
        let bodyA = springMetaWords.x;
        let bodyB = springMetaWords.y;

        if (bodyA != 0xffffffffu && positions[bodyA].w > 0.0) {
          let slotA = atomicAdd(&bodyConstraintCounts[bodyA], 1u);
          if (slotA < ${E}u) {
            bodyConstraintRefs[bodyA * ${E}u + slotA] = taggedRef;
          }
        }
        if (positions[bodyB].w > 0.0) {
          let slotB = atomicAdd(&bodyConstraintCounts[bodyB], 1u);
          if (slotB < ${E}u) {
            bodyConstraintRefs[bodyB * ${E}u + slotB] = taggedRef;
          }
        }
      }
    `,[Bn]);this.appendSpringConstraintRefsKernel=re({positions:Z(r,`vec4f`,b).toReadOnly(),springRecords:Z(n,`vec4f`,C*3),bodyConstraintCounts:Z(m,`uint`,b).toAtomic(),bodyConstraintRefs:Z(h,`uint`,b*E),springCount:T(0),workgroupId:p,localId:W}).computeKernel([$,1,1]).setName(`AVBD Append Spring Constraint Refs`),Pr(`AVBD Append Spring Constraint Refs`,4);let U=l(`
      fn compute(
        bodyConstraintCounts: ptr<storage, array<u32>, read_write>,
        bodyConstraintRefs: ptr<storage, array<u32>, read>,
        pairContacts: ptr<storage, array<vec4f>, read_write>,
        jointRecords: ptr<storage, array<vec4f>, read_write>,
        springRecords: ptr<storage, array<vec4f>, read_write>,
        bodyColorScratch: ptr<storage, array<u32>, read>,
        bodyCount: u32,
        colorCount: u32,
        workgroupId: vec3u,
        localId: vec3u,
      ) -> void {
        let gid = workgroupId.x * ${$}u + localId.x;
        if (gid >= bodyCount) { return; }

        let word = bodyConstraintCounts[gid];
        let contactCount = min(word & 0xFFFFu, ${E}u);
        if (contactCount == 0u) {
          bodyConstraintCounts[gid] = 0u;
          return;
        }

        let colors = max(1u, min(colorCount, 32u));
        var usedMask = 0u;
        let base = gid * ${E}u;
        for (var k = 0u; k < ${E}u; k++) {
          if (k >= contactCount) { break; }
          let constraintRef = bodyConstraintRefs[base + k];
          let constraintTag = constraintRef & ${Tl}u;
          let constraintIndex = constraintRef & ${El}u;
          var other = constraintOtherBodyForContact(gid, constraintRef, pairContacts);
          if (constraintTag == ${Dl}u) {
            other = constraintOtherBodyForJoint(gid, constraintIndex, jointRecords);
          } else if (constraintTag == ${Ol}u) {
            other = constraintOtherBodyForSpring(gid, constraintIndex, springRecords);
          }
          if (other >= bodyCount || other == gid) { continue; }
          if (other <= gid) { continue; }

          let otherPrevColor = (bodyColorScratch[other] >> 16u) & 0xFFu;
          if (otherPrevColor < colors) {
            usedMask |= 1u << otherPrevColor;
          }
        }

        var chosenColor = (bodyColorScratch[gid] >> 16u) & 0xFFu;
        var fallback = false;
        var needsNewColor = chosenColor >= colors;
        if (!needsNewColor) {
          needsNewColor = (usedMask & (1u << chosenColor)) != 0u;
        }
        if (needsNewColor) {
          fallback = true;
          var found = false;
          for (var color = 0u; color < 32u; color++) {
            if (color >= colors) { break; }
            if ((usedMask & (1u << color)) == 0u) {
              chosenColor = color;
              found = true;
              fallback = false;
              break;
            }
          }
          if (!found) {
            chosenColor = gid % colors;
          }
        }

        bodyConstraintCounts[gid] = (chosenColor << 16u) | contactCount | select(0u, ${Cl}u, fallback);
      }
      
      fn constraintOtherBodyForContact(
        body: u32,
        contactIndex: u32,
        pairContacts: ptr<storage, array<vec4f>, read_write>,
      ) -> u32 {
        if (contactIndex >= ${x}u) { return ${b}u; }
        let contactMeta = loadContactMeta(pairContacts, contactIndex);
        let i = u32(contactMeta.x + 0.5);
        let j = u32(contactMeta.y + 0.5);
        if (i == body) { return j; }
        if (j == body) { return i; }
        return ${b}u;
      }

      fn constraintOtherBodyForJoint(
        body: u32,
        jointIndex: u32,
        jointRecords: ptr<storage, array<vec4f>, read_write>,
      ) -> u32 {
        if (jointIndex >= ${S}u) { return ${b}u; }
        let jointMetaWords = loadJointMetaWords(jointRecords, jointIndex);
        if (jointMetaWords.w == 0u) { return ${b}u; }
        if (jointMetaWords.x == body) { return jointMetaWords.y; }
        if (jointMetaWords.y == body) { return jointMetaWords.x; }
        return ${b}u;
      }

      fn constraintOtherBodyForSpring(
        body: u32,
        springIndex: u32,
        springRecords: ptr<storage, array<vec4f>, read_write>,
      ) -> u32 {
        if (springIndex >= ${C}u) { return ${b}u; }
        let springMetaWords = loadSpringMetaWords(springRecords, springIndex);
        if (springMetaWords.z == 0u) { return ${b}u; }
        if (springMetaWords.x == body) { return springMetaWords.y; }
        if (springMetaWords.y == body) { return springMetaWords.x; }
        return ${b}u;
      }
    `,[Vc,ml,Bn]);this.greedyBodyColorsKernel=U({bodyConstraintCounts:Z(m,`uint`,b),bodyConstraintRefs:Z(h,`uint`,b*E).toReadOnly(),pairContacts:Z(e,`vec4f`,x*9),jointRecords:Z(t,`vec4f`,S*11),springRecords:Z(n,`vec4f`,C*3),bodyColorScratch:Z(v,`uint`,b).toReadOnly(),bodyCount:T(0),colorCount:T(1),workgroupId:p,localId:W}).computeKernel([$,1,1]).setName(`AVBD Incremental Greedy Body Colors`),Pr(`AVBD Incremental Greedy Body Colors`,6);let ie=l(`
      fn compute(
        bodyConstraintCounts: ptr<storage, array<atomic<u32>>, read_write>,
        jointRecords: ptr<storage, array<vec4f>, read_write>,
        springRecords: ptr<storage, array<vec4f>, read_write>,
        bodyCount: u32,
        jointCount: u32,
        springCount: u32,
        workgroupId: vec3u,
        localId: vec3u,
      ) -> void {
        let gid = workgroupId.x * ${$}u + localId.x;

        if (gid < jointCount) {
          let jointMetaWords = loadJointMetaWords(jointRecords, gid);
          if (jointMetaWords.w != 0u) {
            markHardColorConflictEdge(bodyConstraintCounts, bodyCount, jointMetaWords.x, jointMetaWords.y);
          }
        }

        if (gid < springCount) {
          let springMetaWords = loadSpringMetaWords(springRecords, gid);
          if (springMetaWords.z != 0u) {
            markHardColorConflictEdge(bodyConstraintCounts, bodyCount, springMetaWords.x, springMetaWords.y);
          }
        }
      }

      fn markHardColorConflictEdge(
        bodyConstraintCounts: ptr<storage, array<atomic<u32>>, read_write>,
        bodyCount: u32,
        bodyA: u32,
        bodyB: u32,
      ) {
        if (bodyA == 0xffffffffu || bodyB == 0xffffffffu) { return; }
        if (bodyA >= bodyCount || bodyB >= bodyCount || bodyA == bodyB) { return; }

        let wordA = atomicLoad(&bodyConstraintCounts[bodyA]);
        let wordB = atomicLoad(&bodyConstraintCounts[bodyB]);
        let countA = wordA & 0xFFFFu;
        let countB = wordB & 0xFFFFu;
        if (countA == 0u || countB == 0u) { return; }

        let colorA = (wordA >> 16u) & 0xFFu;
        let colorB = (wordB >> 16u) & 0xFFu;
        if (colorA != colorB) { return; }

        // Match the paper author's higher-id dependency orientation: lower-id
        // bodies adapt, higher-id bodies stay fixed for this repair round.
        let loser = min(bodyA, bodyB);
        atomicOr(&bodyConstraintCounts[loser], ${wl}u);
      }
    `,[ml,Bn]);this.markHardColorConflictsKernel=ie({bodyConstraintCounts:Z(m,`uint`,b).toAtomic(),jointRecords:Z(t,`vec4f`,S*11),springRecords:Z(n,`vec4f`,C*3),bodyCount:T(0),jointCount:T(0),springCount:T(0),workgroupId:p,localId:W}).computeKernel([$,1,1]).setName(`AVBD Mark Hard Body Color Conflicts`),Pr(`AVBD Mark Hard Body Color Conflicts`,3);let ae=l(`
      fn compute(
        bodyConstraintCounts: ptr<storage, array<u32>, read_write>,
        bodyConstraintRefs: ptr<storage, array<u32>, read>,
        jointRecords: ptr<storage, array<vec4f>, read_write>,
        springRecords: ptr<storage, array<vec4f>, read_write>,
        bodyCount: u32,
        colorCount: u32,
        workgroupId: vec3u,
        localId: vec3u,
      ) -> void {
        let gid = workgroupId.x * ${$}u + localId.x;
        if (gid >= bodyCount) { return; }

        let word = bodyConstraintCounts[gid];
        if ((word & ${wl}u) == 0u) { return; }

        let constraintCount = min(word & 0xFFFFu, ${E}u);
        if (constraintCount == 0u) {
          bodyConstraintCounts[gid] = 0u;
          return;
        }

        let colors = max(1u, min(colorCount, 32u));
        var usedMask = 0u;
        let base = gid * ${E}u;
        for (var k = 0u; k < ${E}u; k++) {
          if (k >= constraintCount) { break; }

          let constraintRef = bodyConstraintRefs[base + k];
          let constraintTag = constraintRef & ${Tl}u;
          let constraintIndex = constraintRef & ${El}u;
          var other = ${b}u;
          if (constraintTag == ${Dl}u) {
            other = repairConstraintOtherBodyForJoint(gid, constraintIndex, jointRecords);
          } else if (constraintTag == ${Ol}u) {
            other = repairConstraintOtherBodyForSpring(gid, constraintIndex, springRecords);
          } else {
            continue;
          }
          if (other >= bodyCount || other == gid) { continue; }

          let otherWord = bodyConstraintCounts[other];
          let otherConstraintCount = min(otherWord & 0xFFFFu, ${E}u);
          if (otherConstraintCount == 0u) { continue; }

          let otherColor = (otherWord >> 16u) & 0xFFu;
          if (otherColor < colors) {
            usedMask |= 1u << otherColor;
          }
        }

        var chosenColor = (word >> 16u) & 0xFFu;
        var fallback = false;
        var needsNewColor = chosenColor >= colors;
        if (!needsNewColor) {
          needsNewColor = (usedMask & (1u << chosenColor)) != 0u;
        }
        if (needsNewColor) {
          var found = false;
          for (var color = 0u; color < 32u; color++) {
            if (color >= colors) { break; }
            if ((usedMask & (1u << color)) == 0u) {
              chosenColor = color;
              found = true;
              break;
            }
          }
          if (!found) {
            chosenColor = gid % colors;
            fallback = true;
          }
        }

        bodyConstraintCounts[gid] = (chosenColor << 16u) | constraintCount | select(0u, ${Cl}u, fallback);
      }

      fn repairConstraintOtherBodyForJoint(
        body: u32,
        jointIndex: u32,
        jointRecords: ptr<storage, array<vec4f>, read_write>,
      ) -> u32 {
        if (jointIndex >= ${S}u) { return ${b}u; }
        let jointMetaWords = loadJointMetaWords(jointRecords, jointIndex);
        if (jointMetaWords.w == 0u) { return ${b}u; }
        if (jointMetaWords.x == body) { return jointMetaWords.y; }
        if (jointMetaWords.y == body) { return jointMetaWords.x; }
        return ${b}u;
      }

      fn repairConstraintOtherBodyForSpring(
        body: u32,
        springIndex: u32,
        springRecords: ptr<storage, array<vec4f>, read_write>,
      ) -> u32 {
        if (springIndex >= ${C}u) { return ${b}u; }
        let springMetaWords = loadSpringMetaWords(springRecords, springIndex);
        if (springMetaWords.z == 0u) { return ${b}u; }
        if (springMetaWords.x == body) { return springMetaWords.y; }
        if (springMetaWords.y == body) { return springMetaWords.x; }
        return ${b}u;
      }
    `,[ml,Bn]);this.repairHardBodyColorsKernel=ae({bodyConstraintCounts:Z(m,`uint`,b),bodyConstraintRefs:Z(h,`uint`,b*E).toReadOnly(),jointRecords:Z(t,`vec4f`,S*11),springRecords:Z(n,`vec4f`,C*3),bodyCount:T(0),colorCount:T(1),workgroupId:p,localId:W}).computeKernel([$,1,1]).setName(`AVBD Repair Hard Body Colors`),Pr(`AVBD Repair Hard Body Colors`,4);let oe=e=>l(`
      fn compute(
        initialPose: ptr<storage, array<vec4f>, read>,
        inertialPose: ptr<storage, array<vec4f>, read>,
        bodySolveOutputPose: ptr<storage, array<vec4f>, read_write>,
${e===`localDiag`?`        inverseInertia: ptr<storage, array<vec4f>, read>,
`:`        derivedInvInertia: ptr<storage, array<vec4f>, read>,
`}        bodyConstraintCounts: ptr<storage, array<u32>, read>,
        bodyConstraintRefs: ptr<storage, array<u32>, read>,
        pairContacts: ptr<storage, array<vec4f>, read_write>,
        jointRecords: ptr<storage, array<vec4f>, read_write>,
        springRecords: ptr<storage, array<vec4f>, read_write>,
        bodyCount: u32,
        bodyIndexBase: u32,
        dispatchBodyCount: u32,
        bodySolveMode: u32,
        currentColor: u32,
        sweepOffset: u32,
        regularizationAlpha: f32,
        tangentialRegularizationAlpha: f32,
        relaxation: f32,
        frictionRelaxation: f32,
        frictionStatic: f32,
        frictionDynamic: f32,
        useReferenceTangentialUpdate: u32,
        frictionSolveScale: f32,
        kStart: f32,
        dualForceMax: f32,
        enableNormalReleaseHeuristic: u32,
        enableHessianRescaling: u32,
        dt: f32,
        inertialDiagWeight: f32,
        maxLinearCorrection: f32,
        maxAngularCorrection: f32,
${e===`generic`?`        useLocalDiagonalInertia: u32,
`:``}        useNormalContactMargin: u32,
        useLocalContactArms: u32,
        alwaysStampNormalHessian: u32,
        alwaysStampTangentialHessian: u32,
        workgroupId: vec3u,
        localId: vec3u,
      ) -> void {
        let localIndex = workgroupId.x * ${$}u + localId.x;
        if (localIndex >= dispatchBodyCount) { return; }
        let gid = bodyIndexBase + localIndex;
        if (gid >= bodyCount) { return; }

        let countWord = bodyConstraintCounts[gid];
        let bodyColor = (countWord >> 16u) & 0xFFu;
        if (bodySolveMode == 0u && bodyColor != currentColor) { return; }
        let contactCount = min(countWord & 0xFFFFu, ${E}u);
        let bodySolveOutputBase = gid * 2u;

${e===`localDiag`?`
        let inv = inverseInertia[gid];
        let invMass = inv.w;
        let initialBase = gid * 2u;
        let poseBase = gid * ${Sl}u;
        let currentPose = inertialPose[poseBase + 2u];
        var pos = currentPose.xyz;
        var q = normalize(inertialPose[poseBase + 3u]);
        if (!(invMass > 0.0)) {
          bodySolveOutputPose[bodySolveOutputBase] = currentPose;
          bodySolveOutputPose[bodySolveOutputBase + 1u] = q;
          return;
        }
        let localInvI = vec3f(
          max(inv.x, 1e-8),
          max(inv.y, 1e-8),
          max(inv.z, 1e-8),
        );

        let initialPos = initialPose[initialBase].xyz;
        let initialQ = normalize(initialPose[initialBase + 1u]);
        let inertialPos = inertialPose[poseBase].xyz;
        let inertialQ = normalize(inertialPose[poseBase + 1u]);

        let dqConstraintRaw = qmul(q, qconj(initialQ));
        let dqConstraint = select(dqConstraintRaw, -dqConstraintRaw, dqConstraintRaw.w < 0.0);
        let dThetaConstraint = 2.0 * dqConstraint.xyz;
        let dqInertialRaw = qmul(q, qconj(inertialQ));
        let dqInertial = select(dqInertialRaw, -dqInertialRaw, dqInertialRaw.w < 0.0);
        let dThetaInertial = 2.0 * dqInertial.xyz;
        let dPosInertial = pos - inertialPos;
        let dPosConstraint = pos - initialPos;

        var A: array<f32, 36>;
        var b: array<f32, 6>;
        for (var r = 0u; r < 6u; r++) {
          b[r] = 0.0;
          for (var c = 0u; c < 6u; c++) {
            A[r * 6u + c] = 0.0;
          }
        }

        let invDt2 = 1.0 / max(dt * dt, 1e-8);
        let mass = 1.0 / max(invMass, 1e-8);
        let mOverDt2 = inertialDiagWeight * invDt2;
        let localIx = 1.0 / localInvI.x;
        let localIy = 1.0 / localInvI.y;
        let localIz = 1.0 / localInvI.z;
        let i00 = localIx;
        let i11 = localIy;
        let i22 = localIz;
        let i01 = 0.0;
        let i02 = 0.0;
        let i12 = 0.0;

        A[0u * 6u + 0u] = mOverDt2 * mass + 1e-4;
        A[1u * 6u + 1u] = mOverDt2 * mass + 1e-4;
        A[2u * 6u + 2u] = mOverDt2 * mass + 1e-4;
        A[3u * 6u + 3u] = mOverDt2 * i00 + 1e-4;
        A[4u * 6u + 4u] = mOverDt2 * i11 + 1e-4;
        A[5u * 6u + 5u] = mOverDt2 * i22 + 1e-4;
        b[0] = mOverDt2 * mass * dPosInertial.x;
        b[1] = mOverDt2 * mass * dPosInertial.y;
        b[2] = mOverDt2 * mass * dPosInertial.z;
        b[3] = mOverDt2 * (i00 * dThetaInertial.x);
        b[4] = mOverDt2 * (i11 * dThetaInertial.y);
        b[5] = mOverDt2 * (i22 * dThetaInertial.z);
`:`
        let base = gid * 3u;
        let invIWorld0 = derivedInvInertia[base + 0u];
        let invIWorld1 = derivedInvInertia[base + 1u];
        let invIWorld2 = derivedInvInertia[base + 2u];
        let invMass = invIWorld0.w;
        let initialBase = gid * 2u;
        let poseBase = gid * ${Sl}u;
        let currentPose = inertialPose[poseBase + 2u];
        var pos = currentPose.xyz;
        var q = normalize(inertialPose[poseBase + 3u]);
        if (!(invMass > 0.0)) {
          bodySolveOutputPose[bodySolveOutputBase] = currentPose;
          bodySolveOutputPose[bodySolveOutputBase + 1u] = q;
          return;
        }
        let invIWorld = mat3x3f(
          vec3f(invIWorld0.x, invIWorld0.y, invIWorld0.z),
          vec3f(invIWorld0.y, invIWorld1.x, invIWorld1.y),
          vec3f(invIWorld0.z, invIWorld1.y, invIWorld2.x),
        );
        let localInvI = vec3f(
          max(invIWorld1.z, 1e-8),
          max(invIWorld1.w, 1e-8),
          max(invIWorld2.y, 1e-8),
        );

        let initialPos = initialPose[initialBase].xyz;
        let initialQ = normalize(initialPose[initialBase + 1u]);
        let inertialPos = inertialPose[poseBase].xyz;
        let inertialQ = normalize(inertialPose[poseBase + 1u]);

        let dqConstraintRaw = qmul(q, qconj(initialQ));
        let dqConstraint = select(dqConstraintRaw, -dqConstraintRaw, dqConstraintRaw.w < 0.0);
        let dThetaConstraint = 2.0 * dqConstraint.xyz;
        let dqInertialRaw = qmul(q, qconj(inertialQ));
        let dqInertial = select(dqInertialRaw, -dqInertialRaw, dqInertialRaw.w < 0.0);
        let dThetaInertial = 2.0 * dqInertial.xyz;
        let dPosInertial = pos - inertialPos;
        let dPosConstraint = pos - initialPos;

        var A: array<f32, 36>;
        var b: array<f32, 6>;
        for (var r = 0u; r < 6u; r++) {
          b[r] = 0.0;
          for (var c = 0u; c < 6u; c++) {
            A[r * 6u + c] = 0.0;
          }
        }

        let invDt2 = 1.0 / max(dt * dt, 1e-8);
        let mass = 1.0 / max(invMass, 1e-8);
        let mOverDt2 = inertialDiagWeight * invDt2;

        // Reconstruct world inertia tensor I_world from inv(I_world) and keep
        // it symmetric so the local 6x6 block stays close to SPD.
        let invICol0 = invIWorld[0];
        let invICol1 = invIWorld[1];
        let invICol2 = invIWorld[2];
        let cof0 = cross(invICol1, invICol2);
        let cof1 = cross(invICol2, invICol0);
        let cof2 = cross(invICol0, invICol1);
        let detInvI = dot(invICol0, cof0);
        let detOk = abs(detInvI) > 1e-10;

        let fallbackIx = 1.0 / max(abs(invICol0.x), 1e-8);
        let fallbackIy = 1.0 / max(abs(invICol1.y), 1e-8);
        let fallbackIz = 1.0 / max(abs(invICol2.z), 1e-8);
        let invDetInvI = select(0.0, 1.0 / detInvI, detOk);
        var inertiaCol0 = select(vec3f(fallbackIx, 0.0, 0.0), cof0 * invDetInvI, detOk);
        var inertiaCol1 = select(vec3f(0.0, fallbackIy, 0.0), cof1 * invDetInvI, detOk);
        var inertiaCol2 = select(vec3f(0.0, 0.0, fallbackIz), cof2 * invDetInvI, detOk);

        let useLocalDiag = useLocalDiagonalInertia > 0u;
        let localIx = 1.0 / localInvI.x;
        let localIy = 1.0 / localInvI.y;
        let localIz = 1.0 / localInvI.z;
        let i00 = select(max(inertiaCol0.x, 1e-8), localIx, useLocalDiag);
        let i11 = select(max(inertiaCol1.y, 1e-8), localIy, useLocalDiag);
        let i22 = select(max(inertiaCol2.z, 1e-8), localIz, useLocalDiag);
        let i01 = select(0.5 * (inertiaCol1.x + inertiaCol0.y), 0.0, useLocalDiag);
        let i02 = select(0.5 * (inertiaCol2.x + inertiaCol0.z), 0.0, useLocalDiag);
        let i12 = select(0.5 * (inertiaCol2.y + inertiaCol1.z), 0.0, useLocalDiag);

        A[0u * 6u + 0u] = mOverDt2 * mass + 1e-4;
        A[1u * 6u + 1u] = mOverDt2 * mass + 1e-4;
        A[2u * 6u + 2u] = mOverDt2 * mass + 1e-4;
        A[3u * 6u + 3u] = mOverDt2 * i00 + 1e-4;
        A[4u * 6u + 4u] = mOverDt2 * i11 + 1e-4;
        A[5u * 6u + 5u] = mOverDt2 * i22 + 1e-4;
        A[3u * 6u + 4u] = mOverDt2 * i01;
        A[4u * 6u + 3u] = A[3u * 6u + 4u];
        A[3u * 6u + 5u] = mOverDt2 * i02;
        A[5u * 6u + 3u] = A[3u * 6u + 5u];
        A[4u * 6u + 5u] = mOverDt2 * i12;
        A[5u * 6u + 4u] = A[4u * 6u + 5u];
        b[0] = mOverDt2 * mass * dPosInertial.x;
        b[1] = mOverDt2 * mass * dPosInertial.y;
        b[2] = mOverDt2 * mass * dPosInertial.z;
        b[3] = mOverDt2 * (i00 * dThetaInertial.x + i01 * dThetaInertial.y + i02 * dThetaInertial.z);
        b[4] = mOverDt2 * (i01 * dThetaInertial.x + i11 * dThetaInertial.y + i12 * dThetaInertial.z);
        b[5] = mOverDt2 * (i02 * dThetaInertial.x + i12 * dThetaInertial.y + i22 * dThetaInertial.z);
`}

        let bodyBase = gid * ${E}u;
        for (var k = 0u; k < ${E}u; k++) {
          if (k >= contactCount) { break; }
          let contactIndex = (k + sweepOffset) % contactCount;
          let constraintRef = bodyConstraintRefs[bodyBase + contactIndex];
          let constraintTag = constraintRef & ${Tl}u;
          let constraintIndex = constraintRef & ${El}u;
          if (constraintTag == ${Dl}u) {
            let jointIndex = constraintIndex;
            if (jointIndex >= ${S}u) { continue; }
            let jointMeta = loadJointMetaWords(jointRecords, jointIndex);
            if (jointMeta.w == 0u) { continue; }
            let jointBodyA = jointMeta.x;
            let jointBodyB = jointMeta.y;
            let jointType = jointMeta.z;
            let isJointA = jointBodyA == gid;
            let isJointB = jointBodyB == gid;
            if (!isJointA && !isJointB) { continue; }

            let anchorA = loadJointAnchorA(jointRecords, jointIndex);
            let anchorB = loadJointAnchorB(jointRecords, jointIndex);
            let stiffness = loadJointStiffness(jointRecords, jointIndex);
            let penaltyLin = loadJointPenaltyLin(jointRecords, jointIndex).xyz;
            let penaltyAng = loadJointPenaltyAng(jointRecords, jointIndex).xyz;
            let lambdaLin = loadJointLambdaLin(jointRecords, jointIndex).xyz;
            let lambdaAng = loadJointLambdaAng(jointRecords, jointIndex).xyz;
            let c0Lin = loadJointC0Lin(jointRecords, jointIndex).xyz;
            let c0Ang = loadJointC0Ang(jointRecords, jointIndex).xyz;
            let torqueArm = max(anchorA.w, 1.0);

            var currentQA = vec4f(0.0, 0.0, 0.0, 1.0);
            var currentPosA = anchorA.xyz;
            if (jointBodyA != WORLD_BODY_INDEX) {
              currentQA = normalize(select(
                inertialPose[jointBodyA * ${Sl}u + 3u],
                q,
                jointBodyA == gid,
              ));
              currentPosA = select(
                inertialPose[jointBodyA * ${Sl}u + 2u].xyz,
                pos,
                jointBodyA == gid,
              );
            }
            let currentQB = normalize(select(
              inertialPose[jointBodyB * ${Sl}u + 3u],
              q,
              jointBodyB == gid,
            ));
            let currentPosB = select(
              inertialPose[jointBodyB * ${Sl}u + 2u].xyz,
              pos,
              jointBodyB == gid,
            );
            let rA = qrot(currentQA, anchorA.xyz);
            let rB = qrot(currentQB, anchorB.xyz);
            let worldAnchorA = jointWorldAnchor(jointBodyA, anchorA.xyz, currentPosA, currentQA);
            let worldAnchorB = currentPosB + rB;
            let rigidLinear = !isFiniteF32(stiffness.x);
            let linearConstraint = (worldAnchorA - worldAnchorB) - select(vec3f(0.0), c0Lin * regularizationAlpha, rigidLinear);
            let linearForce = penaltyLin * linearConstraint + lambdaLin;

            var linearRow0 = array<f32, 6>(0.0, 0.0, 0.0, 0.0, 0.0, 0.0);
            var linearRow1 = array<f32, 6>(0.0, 0.0, 0.0, 0.0, 0.0, 0.0);
            var linearRow2 = array<f32, 6>(0.0, 0.0, 0.0, 0.0, 0.0, 0.0);
            if (isJointA) {
              linearRow0 = array<f32, 6>(1.0, 0.0, 0.0, 0.0, rA.z, -rA.y);
              linearRow1 = array<f32, 6>(0.0, 1.0, 0.0, -rA.z, 0.0, rA.x);
              linearRow2 = array<f32, 6>(0.0, 0.0, 1.0, rA.y, -rA.x, 0.0);
            } else {
              linearRow0 = array<f32, 6>(-1.0, 0.0, 0.0, 0.0, -rB.z, rB.y);
              linearRow1 = array<f32, 6>(0.0, -1.0, 0.0, rB.z, 0.0, -rB.x);
              linearRow2 = array<f32, 6>(0.0, 0.0, -1.0, -rB.y, rB.x, 0.0);
            }
            let linearSign = select(-1.0, 1.0, isJointA);
            addDiagonalVectorConstraint(&A, &b, linearRow0, linearRow1, linearRow2, penaltyLin, linearForce);
            let rGeom = select(-rB, rA, isJointA);
            let jointGeomDiag = jointBallSocketGeometricDiagonal(rGeom, linearForce);
            A[3u * 6u + 3u] += jointGeomDiag.x;
            A[4u * 6u + 4u] += jointGeomDiag.y;
            A[5u * 6u + 5u] += jointGeomDiag.z;

            if (jointType == JOINT_TYPE_FIXED && stiffness.y > 0.0) {
              let rigidAngular = !isFiniteF32(stiffness.y);
              let angularConstraint = jointFixedAngularConstraint(jointBodyA, currentQA, currentQB, torqueArm) - select(vec3f(0.0), c0Ang * regularizationAlpha, rigidAngular);
              let angularForce = penaltyAng * angularConstraint + lambdaAng;
              let angularRow0 = array<f32, 6>(0.0, 0.0, 0.0, linearSign * torqueArm, 0.0, 0.0);
              let angularRow1 = array<f32, 6>(0.0, 0.0, 0.0, 0.0, linearSign * torqueArm, 0.0);
              let angularRow2 = array<f32, 6>(0.0, 0.0, 0.0, 0.0, 0.0, linearSign * torqueArm);
              addDiagonalVectorConstraint(&A, &b, angularRow0, angularRow1, angularRow2, penaltyAng, angularForce);
            }
            continue;
          }

          if (constraintTag == ${Ol}u) {
            let springIndex = constraintIndex;
            if (springIndex >= ${C}u) { continue; }
            let springMeta = loadSpringMetaWords(springRecords, springIndex);
            if (springMeta.z == 0u) { continue; }
            let springBodyA = springMeta.x;
            let springBodyB = springMeta.y;
            let isSpringA = springBodyA == gid;
            let isSpringB = springBodyB == gid;
            if (!isSpringA && !isSpringB) { continue; }

            let anchorARest = loadSpringAnchorARest(springRecords, springIndex);
            let anchorBStiffness = loadSpringAnchorBStiffness(springRecords, springIndex);
            let restLength = max(anchorARest.w, 0.0);
            let springStiffness = max(anchorBStiffness.w, 0.0);
            if (springStiffness <= 0.0) { continue; }

            var currentSpringQA = vec4f(0.0, 0.0, 0.0, 1.0);
            var currentSpringPosA = anchorARest.xyz;
            if (springBodyA != WORLD_BODY_INDEX) {
              currentSpringQA = normalize(select(
                inertialPose[springBodyA * ${Sl}u + 3u],
                q,
                springBodyA == gid,
              ));
              currentSpringPosA = select(
                inertialPose[springBodyA * ${Sl}u + 2u].xyz,
                pos,
                springBodyA == gid,
              );
            }
            let currentSpringQB = normalize(select(
              inertialPose[springBodyB * ${Sl}u + 3u],
              q,
              springBodyB == gid,
            ));
            let currentSpringPosB = select(
              inertialPose[springBodyB * ${Sl}u + 2u].xyz,
              pos,
              springBodyB == gid,
            );
            let rSpringA = qrot(currentSpringQA, anchorARest.xyz);
            let rSpringB = qrot(currentSpringQB, anchorBStiffness.xyz);
            let worldSpringA = jointWorldAnchor(springBodyA, anchorARest.xyz, currentSpringPosA, currentSpringQA);
            let worldSpringB = currentSpringPosB + rSpringB;
            let springDelta = worldSpringA - worldSpringB;
            let springLength = length(springDelta);
            if (springLength <= 1e-6) { continue; }
            let springNormal = springDelta / springLength;
            let springConstraint = springLength - restLength;
            let springForce = springStiffness * springConstraint;
            let springJLin = select(-springNormal, springNormal, isSpringA);
            let springArm = select(rSpringB, rSpringA, isSpringA);
            let springJAng = select(-cross(springArm, springNormal), cross(springArm, springNormal), isSpringA);
            let springRow = array<f32, 6>(
              springJLin.x,
              springJLin.y,
              springJLin.z,
              springJAng.x,
              springJAng.y,
              springJAng.z,
            );
            addScalarConstraint(&A, &b, springRow, springStiffness, springForce);
            continue;
          }

          let p = constraintIndex;
          if (p >= ${x}u) { continue; }

          let n = loadContactNormalPen(pairContacts, p).xyz;
          if (dot(n, n) <= 1e-10) { continue; }

          let armA = loadContactArmA(pairContacts, p);
          let armB = loadContactArmB(pairContacts, p);
          let contactMeta = loadContactMeta(pairContacts, p);
          let i = u32(contactMeta.x + 0.5);
          let j = u32(contactMeta.y + 0.5);
          let isA = i == gid;
          let isB = j == gid;
          if (!isA && !isB) { continue; }
          let other = select(i, j, isA);
          if (other >= bodyCount || other == gid) { continue; }
          let raStored = armA.xyz;
          let rbStored = armB.xyz;
          let otherPoseBase = other * ${Sl}u;
          let otherPos = inertialPose[otherPoseBase + 2u].xyz;
          let otherQ = normalize(inertialPose[otherPoseBase + 3u]);
          let otherInitialBase = other * 2u;
          let initialOtherPos = initialPose[otherInitialBase].xyz;
          let initialOtherQ = normalize(initialPose[otherInitialBase + 1u]);
          let currentQA = select(otherQ, q, isA);
          let currentQB = select(q, otherQ, isA);
          let initialQA = select(initialOtherQ, initialQ, isA);
          let initialQB = select(initialQ, initialOtherQ, isA);
          let localContactArms = useLocalContactArms > 0u;
          let ra = select(raStored, qrot(currentQA, raStored), localContactArms);
          let rb = select(rbStored, qrot(currentQB, rbStored), localContactArms);
          let dqOtherConstraintRaw = qmul(otherQ, qconj(initialOtherQ));
          let dqOtherConstraint = select(dqOtherConstraintRaw, -dqOtherConstraintRaw, dqOtherConstraintRaw.w < 0.0);
          let dThetaOtherConstraint = 2.0 * dqOtherConstraint.xyz;
          let dPosOtherConstraint = otherPos - initialOtherPos;

          let dPosA = select(dPosOtherConstraint, dPosConstraint, isA);
          let dPosB = select(dPosConstraint, dPosOtherConstraint, isA);
          let dThetaA = select(dThetaOtherConstraint, dThetaConstraint, isA);
          let dThetaB = select(dThetaConstraint, dThetaOtherConstraint, isA);

          let jAL = -n;
          let jBL = n;
          let jAA = -cross(ra, n);
          let jBA = cross(rb, n);

          let tangentBasis = tangentBasisFromAngle(n, armA.w);
          let t1 = tangentBasis.t1;
          let t2 = tangentBasis.t2;

          let penetration0 = max(loadContactNormalPen(pairContacts, p).w, 0.0);
          let cachedConstraintC0 = loadContactConstraintC0(pairContacts, p);
          let c0 = cachedConstraintC0.x;
          let cRegN = (1.0 - regularizationAlpha) * c0
            + dot(jAL, dPosA)
            + dot(jAA, dThetaA)
            + dot(jBL, dPosB)
            + dot(jBA, dThetaB);
          let c0T1 = cachedConstraintC0.y;
          let c0T2 = cachedConstraintC0.z;

          let contactState = loadContactStateHot(pairContacts, p, kStart);
          let dualState = contactState.dual;
          let dualN = clamp(dualState.x, -dualForceMax, 0.0);
          let penaltyN = max(contactState.penaltyN, kStart);
          let penaltyTBRaw = max(contactState.penalty.yz, vec2f(kStart));
          let contactFrictionScale = contactState.frictionScale;
          let frictionStaticLocal = frictionStatic * contactFrictionScale * frictionSolveScale;
          let frictionDynamicLocal = frictionDynamic * contactFrictionScale * frictionSolveScale;
          let useReferenceTangential = useReferenceTangentialUpdate > 0u;
          let penaltyTB = penaltyTBRaw;
          var dualTB = contactStateDualTB(
            contactState,
            n,
            t1,
            t2,
            select(0u, 1u, useReferenceTangential),
          );
          let prevTMag = length(dualTB);
          let staticBoundPrev = frictionStaticLocal * abs(dualN);
          let useStatic = prevTMag <= staticBoundPrev + 1e-6;

          let bodyR = select(rb, ra, isA);
          let sign = select(1.0, -1.0, isA);
          let jNLinear = sign * n;
          let jNAngular = sign * cross(bodyR, n);

          let lambdaLower = -dualForceMax;
          let lambdaPlusN = dualN + penaltyN * cRegN;
          var lambdaAppliedN = clamp(lambdaPlusN, lambdaLower, 0.0);
          let normalSupportThreshold = 1e-6;
          let normalReleaseTolerance = max(2e-5, 1.25 * penetration0);
          let normalReleaseDecayNear = 0.85;
          let normalReleaseDecayFar = 0.6;
          let normalReleaseMinSupport = -5e-4;
          if (
            enableNormalReleaseHeuristic > 0u &&
            penetration0 > 1e-6
            && dualN < -normalSupportThreshold
            && cRegN > 0.0
            && -lambdaAppliedN <= normalSupportThreshold
          ) {
            let releaseDecay = select(normalReleaseDecayFar, normalReleaseDecayNear, cRegN <= normalReleaseTolerance);
            lambdaAppliedN = min(dualN * releaseDecay, normalReleaseMinSupport);
          }
          let frictionSeparationTolerance = normalReleaseTolerance;
          let frictionOffSeparation = -lambdaAppliedN <= normalSupportThreshold
            || (enableNormalReleaseHeuristic > 0u && cRegN > frictionSeparationTolerance);
          if (lambdaAppliedN < -1e-9 || alwaysStampNormalHessian > 0u) {
            var kHessN = penaltyN;
            if (
              lambdaAppliedN < -1e-9 &&
              enableHessianRescaling > 0u
              && abs(lambdaAppliedN - lambdaPlusN) > 1e-8
              && abs(cRegN) > 1e-8
            ) {
              // Eq.14-style stiffness rescaling for clamped multipliers.
              kHessN = max(abs((lambdaAppliedN - dualN) / cRegN), 1e-6);
            }
            var jNRhs: array<f32, 6>;
            jNRhs[0] = jNLinear.x; jNRhs[1] = jNLinear.y; jNRhs[2] = jNLinear.z;
            jNRhs[3] = jNAngular.x; jNRhs[4] = jNAngular.y; jNRhs[5] = jNAngular.z;
            var jNHess: array<f32, 6>;
            jNHess[0] = jNLinear.x; jNHess[1] = jNLinear.y; jNHess[2] = jNLinear.z;
            jNHess[3] = jNAngular.x; jNHess[4] = jNAngular.y; jNHess[5] = jNAngular.z;
            for (var r = 0u; r < 6u; r++) {
              b[r] += jNRhs[r] * lambdaAppliedN;
              for (var c = 0u; c < 6u; c++) {
                A[r * 6u + c] += kHessN * jNHess[r] * jNHess[c];
              }
            }
          }

          if (frictionStaticLocal > 1e-8 || frictionDynamicLocal > 1e-8) {
            let stampTangentialOnSeparating = frictionOffSeparation && alwaysStampTangentialHessian > 0u;
            // Default AVBD friction policy skips tangential rows when the
            // contact is separating. The full-hessian experiment keeps the
            // tangential stiffness in A while still clamping the RHS to zero.
            if (!useReferenceTangential && frictionOffSeparation && !stampTangentialOnSeparating) {
              continue;
            }
            if (useReferenceTangential && lambdaAppliedN >= -1e-9 && alwaysStampTangentialHessian == 0u) {
              continue;
            }
            let jt1AL = -t1;
            let jt1BL = t1;
            let jt1AA = -cross(ra, t1);
            let jt1BA = cross(rb, t1);
            let cRegT1 = (1.0 - tangentialRegularizationAlpha) * c0T1
              + dot(jt1AL, dPosA)
              + dot(jt1AA, dThetaA)
              + dot(jt1BL, dPosB)
              + dot(jt1BA, dThetaB);
            let jT1Linear = sign * t1;
            let jT1Angular = sign * cross(bodyR, t1);
            var jT1: array<f32, 6>;
            jT1[0] = jT1Linear.x; jT1[1] = jT1Linear.y; jT1[2] = jT1Linear.z;
            jT1[3] = jT1Angular.x; jT1[4] = jT1Angular.y; jT1[5] = jT1Angular.z;

            let jt2AL = -t2;
            let jt2BL = t2;
            let jt2AA = -cross(ra, t2);
            let jt2BA = cross(rb, t2);
            let cRegT2 = (1.0 - tangentialRegularizationAlpha) * c0T2
              + dot(jt2AL, dPosA)
              + dot(jt2AA, dThetaA)
              + dot(jt2BL, dPosB)
              + dot(jt2BA, dThetaB);
            // Couple tangential rows with a conical clamp in (t1,t2) space.
            // Independent axis clamps allow sqrt(2) overshoot and can cause
            // lateral breakout in stacked contacts.
            let lambdaPlusTB = vec2f(
              penaltyTB.x * cRegT1 + dualTB.x,
              penaltyTB.y * cRegT2 + dualTB.y,
            );
            var lambdaAppliedTB = lambdaPlusTB;
            var wT1 = penaltyTB.x * frictionRelaxation;
            var wT2 = penaltyTB.y * frictionRelaxation;
            if (useReferenceTangential) {
              let referenceBound = frictionStaticLocal * max(-lambdaAppliedN, 0.0);
              let lambdaAppliedTBLen2 = dot(lambdaAppliedTB, lambdaAppliedTB);
              if (lambdaAppliedTBLen2 > referenceBound * referenceBound && lambdaAppliedTBLen2 > 1e-12) {
                lambdaAppliedTB *= referenceBound * inverseSqrt(lambdaAppliedTBLen2);
              }
              if (referenceBound <= 1e-6) {
                lambdaAppliedTB = vec2f(0.0);
              }
            } else {
              // AVBD friction policy:
              // start in static mode only when previous dual was inside static cone.
              // if this iteration violates static cone, switch to dynamic cone.
              // In the primal stage, keep tangential bounds on the previous normal
              // dual state for this contact iteration. This matches the 2D reference
              // structure where tangential bounds are derived from persisted lambda_n
              // (updated in dual/capture), not from the row-local normal projection.
              let frictionSupportN = select(max(dualN, lambdaAppliedN), 0.0, stampTangentialOnSeparating);
              let staticBound = frictionStaticLocal * max(-frictionSupportN, 0.0);
              let dynamicBound = frictionDynamicLocal * max(-frictionSupportN, 0.0);
              let lambdaPlusTBlen2 = dot(lambdaAppliedTB, lambdaAppliedTB);
              var frictionBound = select(dynamicBound, staticBound, useStatic);
              if (useStatic && lambdaPlusTBlen2 > staticBound * staticBound + 1e-12) {
                frictionBound = dynamicBound;
              }
              frictionBound = max(frictionBound, 0.0);

              let lambdaAppliedTBLen2 = dot(lambdaAppliedTB, lambdaAppliedTB);
              if (lambdaAppliedTBLen2 > frictionBound * frictionBound && lambdaAppliedTBLen2 > 1e-12) {
                lambdaAppliedTB *= frictionBound * inverseSqrt(lambdaAppliedTBLen2);
              }
              // Eq.14-style tangential stiffness rescaling when cone projection
              // clamps the unconstrained lambda update.
              if (
                !stampTangentialOnSeparating &&
                enableHessianRescaling > 0u
                && abs(lambdaAppliedTB.x - lambdaPlusTB.x) > 1e-8
                && abs(cRegT1) > 1e-8
              ) {
                wT1 = max(abs((lambdaAppliedTB.x - dualTB.x) / cRegT1), 1e-6) * frictionRelaxation;
              }
              if (
                !stampTangentialOnSeparating &&
                enableHessianRescaling > 0u
                && abs(lambdaAppliedTB.y - lambdaPlusTB.y) > 1e-8
                && abs(cRegT2) > 1e-8
              ) {
                wT2 = max(abs((lambdaAppliedTB.y - dualTB.y) / cRegT2), 1e-6) * frictionRelaxation;
              }
            }
            let lambdaAppliedT1 = lambdaAppliedTB.x;
            let lambdaAppliedT2 = lambdaAppliedTB.y;

            let jT2Linear = sign * t2;
            let jT2Angular = sign * cross(bodyR, t2);
            var jT2: array<f32, 6>;
            jT2[0] = jT2Linear.x; jT2[1] = jT2Linear.y; jT2[2] = jT2Linear.z;
            jT2[3] = jT2Angular.x; jT2[4] = jT2Angular.y; jT2[5] = jT2Angular.z;
            for (var r = 0u; r < 6u; r++) {
              b[r] += jT1[r] * lambdaAppliedT1;
              for (var c = 0u; c < 6u; c++) {
                A[r * 6u + c] += wT1 * jT1[r] * jT1[c];
              }
            }
            for (var r = 0u; r < 6u; r++) {
              b[r] += jT2[r] * lambdaAppliedT2;
              for (var c = 0u; c < 6u; c++) {
                A[r * 6u + c] += wT2 * jT2[r] * jT2[c];
              }
            }
          }
        }

        // Re-symmetrize before solve to reduce drift from accumulation order.
        for (var r = 0u; r < 6u; r++) {
          for (var c = r + 1u; c < 6u; c++) {
            let s = 0.5 * (A[r * 6u + c] + A[c * 6u + r]);
            A[r * 6u + c] = s;
            A[c * 6u + r] = s;
          }
          A[r * 6u + r] = max(A[r * 6u + r], 1e-6);
        }

        // SPD-focused LDL^T factorization with diagonal regularization fallback.
        var L: array<f32, 36>;
        var D: array<f32, 6>;
        for (var r = 0u; r < 6u; r++) {
          D[r] = 0.0;
          for (var c = 0u; c < 6u; c++) {
            L[r * 6u + c] = 0.0;
          }
        }

        for (var i = 0u; i < 6u; i++) {
          for (var j = 0u; j < i; j++) {
            var sumL = A[i * 6u + j];
            for (var k = 0u; k < j; k++) {
              sumL -= L[i * 6u + k] * D[k] * L[j * 6u + k];
            }
            let d = select(1e-6, D[j], abs(D[j]) > 1e-6);
            L[i * 6u + j] = sumL / d;
          }

          var diag = A[i * 6u + i];
          for (var k = 0u; k < i; k++) {
            diag -= L[i * 6u + k] * L[i * 6u + k] * D[k];
          }
          D[i] = max(diag, 1e-6);
          L[i * 6u + i] = 1.0;
        }

        var y: array<f32, 6>;
        for (var i = 0u; i < 6u; i++) {
          var sumF = b[i];
          for (var k = 0u; k < i; k++) {
            sumF -= L[i * 6u + k] * y[k];
          }
          y[i] = sumF;
        }

        var z: array<f32, 6>;
        for (var i = 0u; i < 6u; i++) {
          z[i] = y[i] / D[i];
        }

        var x: array<f32, 6>;
        for (var i = 0u; i < 6u; i++) { x[i] = 0.0; }
        for (var rev = 0u; rev < 6u; rev++) {
          let row = 5u - rev;
          var sumB = z[row];
          for (var c = row + 1u; c < 6u; c++) {
            sumB -= L[c * 6u + row] * x[c];
          }
          x[row] = sumB;
        }

        var dPosSolve = vec3f(x[0], x[1], x[2]);
        var dThetaSolve = vec3f(x[3], x[4], x[5]);
        let linLen2 = dot(dPosSolve, dPosSolve);
        if (linLen2 > maxLinearCorrection * maxLinearCorrection && linLen2 > 1e-12) {
          dPosSolve *= maxLinearCorrection * inverseSqrt(linLen2);
        }
        let angLen2 = dot(dThetaSolve, dThetaSolve);
        if (angLen2 > maxAngularCorrection * maxAngularCorrection && angLen2 > 1e-12) {
          dThetaSolve *= maxAngularCorrection * inverseSqrt(angLen2);
        }

        let appliedDPos = -dPosSolve * relaxation;
        let appliedDTheta = -dThetaSolve * relaxation;
        pos += appliedDPos;
        q = normalize(q + 0.5 * qmul(vec4f(appliedDTheta, 0.0), q));

        bodySolveOutputPose[bodySolveOutputBase] = vec4f(pos, currentPose.w);
        bodySolveOutputPose[bodySolveOutputBase + 1u] = q;
      }
    `,[Ir,Fr,Lr,Al,Vc,jl,ml,Bn,Ml]);Pr(`AVBD Body Primal Solve`,9);let se=oe(`generic`),ce=oe(`localDiag`);this.primalBodySolveKernelGeneric=se({initialPose:Z(i,`vec4f`,b*2).toReadOnly(),inertialPose:Z(a,`vec4f`,b*Sl).toReadOnly(),bodySolveOutputPose:Z(this.bodySolveOutputPoseAttr,`vec4f`,b*2),derivedInvInertia:Z(f,`vec4f`,b*3).toReadOnly(),bodyConstraintCounts:Z(m,`uint`,b).toReadOnly(),bodyConstraintRefs:Z(h,`uint`,b*E).toReadOnly(),pairContacts:Z(e,`vec4f`,x*9),jointRecords:Z(t,`vec4f`,S*11),springRecords:Z(n,`vec4f`,C*3),bodyCount:T(0),bodyIndexBase:T(0),dispatchBodyCount:T(0),bodySolveMode:T(0),currentColor:T(0),sweepOffset:T(0),regularizationAlpha:T(xl),tangentialRegularizationAlpha:T(xl),relaxation:T(1),frictionRelaxation:T(1),frictionStatic:T(Gn),frictionDynamic:T(Kn),useReferenceTangentialUpdate:T(1),frictionSolveScale:T(1),kStart:T(vl),dualForceMax:T(1e10),enableNormalReleaseHeuristic:T(0),enableHessianRescaling:T(0),dt:T(1/60/4),inertialDiagWeight:T(1),maxLinearCorrection:T(1e9),maxAngularCorrection:T(1e9),useLocalDiagonalInertia:T(1),useNormalContactMargin:T(1),useLocalContactArms:T(1),alwaysStampNormalHessian:T(1),alwaysStampTangentialHessian:T(0),workgroupId:p,localId:W}).computeKernel([$,1,1]).setName(`AVBD Body Primal Solve Generic`),this.primalBodySolveKernelLocalDiag=ce({initialPose:Z(i,`vec4f`,b*2).toReadOnly(),inertialPose:Z(a,`vec4f`,b*Sl).toReadOnly(),bodySolveOutputPose:Z(this.bodySolveOutputPoseAttr,`vec4f`,b*2),inverseInertia:Z(d,`vec4f`,b).toReadOnly(),bodyConstraintCounts:Z(m,`uint`,b).toReadOnly(),bodyConstraintRefs:Z(h,`uint`,b*E).toReadOnly(),pairContacts:Z(e,`vec4f`,x*9),jointRecords:Z(t,`vec4f`,S*11),springRecords:Z(n,`vec4f`,C*3),bodyCount:T(0),bodyIndexBase:T(0),dispatchBodyCount:T(0),bodySolveMode:T(0),currentColor:T(0),sweepOffset:T(0),regularizationAlpha:T(xl),tangentialRegularizationAlpha:T(xl),relaxation:T(1),frictionRelaxation:T(1),frictionStatic:T(Gn),frictionDynamic:T(Kn),useReferenceTangentialUpdate:T(1),frictionSolveScale:T(1),kStart:T(vl),dualForceMax:T(1e10),enableNormalReleaseHeuristic:T(0),enableHessianRescaling:T(0),dt:T(1/60/4),inertialDiagWeight:T(1),maxLinearCorrection:T(1e9),maxAngularCorrection:T(1e9),useNormalContactMargin:T(1),useLocalContactArms:T(1),alwaysStampNormalHessian:T(1),alwaysStampTangentialHessian:T(0),workgroupId:p,localId:W}).computeKernel([$,1,1]).setName(`AVBD Body Primal Solve Local Diag`),this.primalBodySolveKernel=this.useLocalDiagonalPrimalSolveFastPath?this.primalBodySolveKernelLocalDiag:this.primalBodySolveKernelGeneric;let le=l(`
      fn compute(
        bodyConstraintCounts: ptr<storage, array<u32>, read>,
        bodySolveOutputPose: ptr<storage, array<vec4f>, read>,
        inertialPose: ptr<storage, array<vec4f>, read_write>,
        bodyCount: u32,
        bodyIndexBase: u32,
        dispatchBodyCount: u32,
        bodySolveMode: u32,
        currentColor: u32,
        workgroupId: vec3u,
        localId: vec3u,
      ) -> void {
        let localIndex = workgroupId.x * ${$}u + localId.x;
        if (localIndex >= dispatchBodyCount) { return; }
        let gid = bodyIndexBase + localIndex;
        if (gid >= bodyCount) { return; }

        let countWord = bodyConstraintCounts[gid];
        let bodyColor = (countWord >> 16u) & 0xFFu;
        if (bodySolveMode == 0u && bodyColor != currentColor) { return; }

        let outputBase = gid * 2u;
        let poseBase = gid * ${Sl}u;
        inertialPose[poseBase + 2u] = bodySolveOutputPose[outputBase];
        inertialPose[poseBase + 3u] = normalize(bodySolveOutputPose[outputBase + 1u]);
      }
    `);this.commitBodySolveKernel=le({bodyConstraintCounts:Z(m,`uint`,b).toReadOnly(),bodySolveOutputPose:Z(this.bodySolveOutputPoseAttr,`vec4f`,b*2).toReadOnly(),inertialPose:Z(a,`vec4f`,b*Sl),bodyCount:T(0),bodyIndexBase:T(0),dispatchBodyCount:T(0),bodySolveMode:T(0),currentColor:T(0),workgroupId:p,localId:W}).computeKernel([$,1,1]).setName(`AVBD Commit Body Solve`),Pr(`AVBD Commit Body Solve`,3);let ue=l(`
      fn compute(
        inertialPose: ptr<storage, array<vec4f>, read>,
        initialPose: ptr<storage, array<vec4f>, read>,
        pairContacts: ptr<storage, array<vec4f>, read_write>,
        pairActivity: ptr<storage, array<u32>, read_write>,
        pairDispatchCount: u32,
        regularizationAlpha: f32,
        beta: f32,
        frictionStatic: f32,
        frictionDynamic: f32,
        kStart: f32,
        kMax: f32,
        lambdaMax: f32,
        preventPenetratingNormalDropout: u32,
        enableNormalReleaseHeuristic: u32,
        freezeTangentialPenaltyOnStick: u32,
        freezeTangentialPenaltyUpdates: u32,
        useIsotropicTangentialPenaltyOnStick: u32,
        rampTangentialPenaltyOnlyWhenNotSticking: u32,
        useReferenceTangentialUpdate: u32,
        stickExitThreshold: f32,
        tangentialPenaltyRampDeadzone: f32,
        tangentialPenaltySlipRampMaxDelta: f32,
        tangentialPenaltyCapScale: f32,
        useNormalContactMargin: u32,
        useLocalContactArms: u32,
        dt: f32,
        workgroupId: vec3u,
        localId: vec3u,
      ) -> void {
        let gid = workgroupId.x * ${$}u + localId.x;
        let activeCount = min(min(pairActivity[${k}u], pairDispatchCount), ${w}u);
        if (gid >= activeCount) { return; }

        let p = pairActivity[${k}u + gid + 1u];
        if (p >= ${x}u) { return; }
        let prevContactStateSeed = loadContactStateHot(pairContacts, p, kStart);

        let n = loadContactNormalPen(pairContacts, p).xyz;
        if (dot(n, n) <= 1e-10) {
          storeContactRecord(
            pairContacts,
            p,
            vec4f(0.0),
            kStart,
            vec2f(kStart),
            0.0,
            vec2f(0.0),
            prevContactStateSeed.frictionScale,
            kStart,
          );
          return;
        }

        let contactMeta = loadContactMeta(pairContacts, p);
        let i = u32(contactMeta.x + 0.5);
        let j = u32(contactMeta.y + 0.5);
        if (i >= ${b}u || j >= ${b}u || i == j) {
          storeContactRecord(
            pairContacts,
            p,
            vec4f(0.0),
            kStart,
            vec2f(kStart),
            0.0,
            vec2f(0.0),
            prevContactStateSeed.frictionScale,
            kStart,
          );
          return;
        }

        let penetration0 = max(loadContactNormalPen(pairContacts, p).w, 0.0);
        let armA = loadContactArmA(pairContacts, p);
        let armB = loadContactArmB(pairContacts, p);
        let raStored = armA.xyz;
        let rbStored = armB.xyz;

        let solvePoseBaseA = i * ${Sl}u;
        let solvePoseBaseB = j * ${Sl}u;
        let posA = inertialPose[solvePoseBaseA + 2u].xyz;
        let posB = inertialPose[solvePoseBaseB + 2u].xyz;
        let qA = normalize(inertialPose[solvePoseBaseA + 3u]);
        let qB = normalize(inertialPose[solvePoseBaseB + 3u]);
        let poseBaseA = i * 2u;
        let poseBaseB = j * 2u;
        let prevPosA = initialPose[poseBaseA].xyz;
        let prevPosB = initialPose[poseBaseB].xyz;
        let prevQA = normalize(initialPose[poseBaseA + 1u]);
        let prevQB = normalize(initialPose[poseBaseB + 1u]);
        let localContactArms = useLocalContactArms > 0u;
        let ra = select(raStored, qrot(qA, raStored), localContactArms);
        let rb = select(rbStored, qrot(qB, rbStored), localContactArms);

        let dqAraw = qmul(qA, qconj(prevQA));
        let dqBraw = qmul(qB, qconj(prevQB));
        let dqA = select(dqAraw, -dqAraw, dqAraw.w < 0.0);
        let dqB = select(dqBraw, -dqBraw, dqBraw.w < 0.0);
        let dThetaA = 2.0 * dqA.xyz;
        let dThetaB = 2.0 * dqB.xyz;

        let dPosA = posA - prevPosA;
        let dPosB = posB - prevPosB;

        let jAL = -n;
        let jBL = n;
        let jAA = -cross(ra, n);
        let jBA = cross(rb, n);

        let tangentBasis = tangentBasisFromAngle(n, armA.w);
        let t1 = tangentBasis.t1;
        let t2 = tangentBasis.t2;

        let jt1AL = -t1;
        let jt1BL = t1;
        let jt1AA = -cross(ra, t1);
        let jt1BA = cross(rb, t1);

        let jt2AL = -t2;
        let jt2BL = t2;
        let jt2AA = -cross(ra, t2);
        let jt2BA = cross(rb, t2);

        let cachedConstraintC0 = loadContactConstraintC0(pairContacts, p);
        let c0 = cachedConstraintC0.x;
        let cRegN = (1.0 - regularizationAlpha) * c0
          + dot(jAL, dPosA)
          + dot(jAA, dThetaA)
          + dot(jBL, dPosB)
          + dot(jBA, dThetaB);
        let c0T1 = cachedConstraintC0.y;
        let c0T2 = cachedConstraintC0.z;
        let cRegT1 = (1.0 - regularizationAlpha) * c0T1
          + dot(jt1AL, dPosA)
          + dot(jt1AA, dThetaA)
          + dot(jt1BL, dPosB)
          + dot(jt1BA, dThetaB);
        let cRegT2 = (1.0 - regularizationAlpha) * c0T2
          + dot(jt2AL, dPosA)
          + dot(jt2AA, dThetaA)
          + dot(jt2BL, dPosB)
          + dot(jt2BA, dThetaB);
        let currentPointA = posA + ra;
        let currentPointB = posB + rb;
        let currentGap = -dot(currentPointA - currentPointB, n);
        let rawPenetration = -currentGap;
        let normalReleaseTolerance = max(2e-5, 1.25 * penetration0);
        let normalReleaseDecayNear = 0.85;
        let normalReleaseDecayFar = 0.6;
        let normalReleaseMinSupport = -5e-4;
        let normalSupportThreshold = 1e-6;
        let frictionSeparationTolerance = normalReleaseTolerance;
        let encodedMeta = bitcast<u32>(loadContactMeta(pairContacts, p).w);
        let featureKey = encodedMeta & 0x1FFu;
        let cooldown = (encodedMeta >> 9u) & 0x7Fu;
        let preserveWarmstart = (encodedMeta >> 16u) & 0x1u;
        let warmstartDebugReason = (encodedMeta >> 21u) & 0x7u;
        let prevStick = ((encodedMeta >> 17u) & 0x1u) != 0u;
        let stickAnchorReuse = (encodedMeta >> 18u) & 0x1u;

        let prevContactState = prevContactStateSeed;
        let prevDual = prevContactState.dual;
        let prevDualN = min(prevDual.x, 0.0);
        let prevDualTWorldRaw = prevDual.yzw;
        let prevDualTWorld = prevDualTWorldRaw - n * dot(prevDualTWorldRaw, n);
        let prevDualTB = select(
          vec2f(dot(prevDualTWorld, t1), dot(prevDualTWorld, t2)),
          prevDual.yz,
          useReferenceTangentialUpdate > 0u,
        );
        let prevPenalty = prevContactState.penalty;
        let prevPenaltyN = clamp(prevContactState.penaltyN, kStart, kMax);
        let prevPenaltyTBRaw = clamp(max(prevPenalty.yz, vec2f(kStart)), vec2f(kStart), vec2f(kMax));
        let prevPenaltyTB = prevPenaltyTBRaw;
        let frictionScale = prevContactState.frictionScale;
        let frictionStaticLocal = frictionStatic * frictionScale;
        let frictionDynamicLocal = frictionDynamic * frictionScale;
        var dualN = clamp(prevDualN + prevPenaltyN * cRegN, -lambdaMax, 0.0);
        // Diagnostic A/B: do not let the raw dual clamp drop all normal support
        // while the row is still geometrically penetrating.
        if (
          preventPenetratingNormalDropout > 0u
          && rawPenetration > 0.0
          && prevDualN < -normalSupportThreshold
          && dualN > -normalSupportThreshold
        ) {
          dualN = prevDualN;
        }
        if (
          enableNormalReleaseHeuristic > 0u &&
          penetration0 > 1e-6
          && prevDualN < -normalSupportThreshold
          && cRegN > 0.0
          && dualN > -normalSupportThreshold
        ) {
          let releaseDecay = select(normalReleaseDecayFar, normalReleaseDecayNear, cRegN <= normalReleaseTolerance);
          dualN = min(prevDualN * releaseDecay, normalReleaseMinSupport);
        }

        let prevTMag = length(prevDualTB);
        let staticBoundPrev = frictionStaticLocal * abs(prevDualN);
        let useStatic = prevTMag <= staticBoundPrev + 1e-6;
        let lambdaPlusTB = vec2f(
          prevDualTB.x + prevPenaltyTB.x * cRegT1,
          prevDualTB.y + prevPenaltyTB.y * cRegT2,
        );
        let frictionSupportN = max(prevDualN, dualN);
        let staticBound = frictionStaticLocal * max(-frictionSupportN, 0.0);
        let dynamicBound = frictionDynamicLocal * max(-frictionSupportN, 0.0);
        let lambdaPlusTBlen2 = dot(lambdaPlusTB, lambdaPlusTB);
        let noNormalSupportNow = dualN > -normalSupportThreshold;
        var penaltyN = prevPenaltyN;
        if (dualN < 0.0 && dualN > -lambdaMax) {
          penaltyN = clamp(prevPenaltyN + beta * abs(cRegN), kStart, kMax);
        }
        let tangentialError = length(vec2f(cRegT1, cRegT2));
        var penaltyTB = prevPenaltyTB;
        var dualTB = lambdaPlusTB;
        var stick = false;
        var tangentialInsideCone = false;
        var tangentialRampHappened = false;
        let freezeAllTangentialPenaltyUpdates = freezeTangentialPenaltyUpdates > 0u;
        if (useReferenceTangentialUpdate > 0u) {
          let referenceBound = frictionStaticLocal * max(-dualN, 0.0);
          let dualTBLen2 = dot(dualTB, dualTB);
          if (dualTBLen2 > referenceBound * referenceBound && dualTBLen2 > 1e-12) {
            dualTB *= referenceBound * inverseSqrt(dualTBLen2);
          }
          if (dualN >= 0.0 || referenceBound <= 1e-6) {
            dualTB = vec2f(0.0);
          }
          let tangentialClamped1 = abs(dualTB.x - lambdaPlusTB.x) > 1e-5;
          let tangentialClamped2 = abs(dualTB.y - lambdaPlusTB.y) > 1e-5;
          tangentialInsideCone = !tangentialClamped1 && !tangentialClamped2 && referenceBound > 1e-6;
          if (dualN < 0.0) {
            if (!freezeAllTangentialPenaltyUpdates) {
              let updatedPenaltyTB = min(
                prevPenaltyTB + beta * abs(vec2f(cRegT1, cRegT2)),
                vec2f(kMax),
              );
              penaltyTB = vec2f(
                select(updatedPenaltyTB.x, prevPenaltyTB.x, tangentialClamped1),
                select(updatedPenaltyTB.y, prevPenaltyTB.y, tangentialClamped2),
              );
              tangentialRampHappened = abs(penaltyTB.x - prevPenaltyTB.x) > 1e-6
                || abs(penaltyTB.y - prevPenaltyTB.y) > 1e-6;
            }
            stick = tangentialInsideCone && tangentialError < ${bl};
          } else {
            stick = false;
          }
        } else {
          var frictionBound = select(dynamicBound, staticBound, useStatic);
          if (useStatic && lambdaPlusTBlen2 > staticBound * staticBound + 1e-12) {
            frictionBound = dynamicBound;
          }
          frictionBound = max(frictionBound, 0.0);

          let dualTBLen2 = dot(dualTB, dualTB);
          if (dualTBLen2 > frictionBound * frictionBound && dualTBLen2 > 1e-12) {
            if (dualTBLen2 > frictionBound * frictionBound) {
              dualTB *= frictionBound * inverseSqrt(dualTBLen2);
            }
          }
          // If the normal row has no support (or contact is separating), drop
          // tangential memory so friction does not persist without contact.
          if (noNormalSupportNow || (enableNormalReleaseHeuristic > 0u && cRegN > frictionSeparationTolerance)) {
            dualTB = vec2f(0.0);
          }
          let stickThreshold = select(
            ${bl},
            max(stickExitThreshold, ${bl}),
            prevStick,
          );
          let insideStaticCone = staticBound > 1e-6
            && lambdaPlusTBlen2 <= staticBound * staticBound + 1e-12
            && !noNormalSupportNow;
          stick = insideStaticCone && tangentialError < stickThreshold;
          let freezeTangentialPenalty = freezeTangentialPenaltyOnStick > 0u && stick;
          let isInteriorCone = frictionBound > 1e-6
            && lambdaPlusTBlen2 < frictionBound * frictionBound - 1e-8;
          tangentialInsideCone = isInteriorCone;
          let tangentialRampActive = tangentialError > tangentialPenaltyRampDeadzone;
          let allowTangentialRamp = !freezeAllTangentialPenaltyUpdates
            && !freezeTangentialPenalty
            && (rampTangentialPenaltyOnlyWhenNotSticking == 0u || !stick);
          if (isInteriorCone && tangentialRampActive && allowTangentialRamp) {
            var tangentialRampT1 = beta * abs(cRegT1);
            var tangentialRampT2 = beta * abs(cRegT2);
            if (tangentialPenaltySlipRampMaxDelta > 0.0) {
              tangentialRampT1 = min(tangentialRampT1, tangentialPenaltySlipRampMaxDelta);
              tangentialRampT2 = min(tangentialRampT2, tangentialPenaltySlipRampMaxDelta);
            }
            penaltyTB.x = clamp(prevPenaltyTB.x + tangentialRampT1, kStart, kMax);
            penaltyTB.y = clamp(prevPenaltyTB.y + tangentialRampT2, kStart, kMax);
            tangentialRampHappened = true;
          }
          if (tangentialPenaltyCapScale > 0.0) {
            let tangentialPenaltyCap = max(penaltyN * tangentialPenaltyCapScale, kStart);
            penaltyTB = min(penaltyTB, vec2f(tangentialPenaltyCap));
          }
          if (useIsotropicTangentialPenaltyOnStick > 0u && stick) {
            let sharedPenaltyT = max(0.5 * (penaltyTB.x + penaltyTB.y), kStart);
            penaltyTB = vec2f(sharedPenaltyT);
          }
        }

        let storedDual = select(
          vec4f(dualN, t1 * dualTB.x + t2 * dualTB.y),
          vec4f(dualN, dualTB, 0.0),
          useReferenceTangentialUpdate > 0u,
        );
        let storedPenaltyTB = penaltyTB;
        let storedPenaltyN = penaltyN;
        // pairLambdas mirrors the live dual state in positive magnitudes for
        // debug/readback. It is derived state, not the
        // authoritative contact record.
        let pairLambdaTB = dualTB;
        let pairLambdaN = -dualN;
        storeContactRecord(
          pairContacts,
          p,
          storedDual,
          storedPenaltyN,
          storedPenaltyTB,
          pairLambdaN,
          pairLambdaTB,
          frictionScale,
          kStart,
        );

        let currentMeta = loadContactMeta(pairContacts, p);
        storeContactMeta(pairContacts, p, vec4f(
          currentMeta.x,
          currentMeta.y,
          currentMeta.z,
          bitcast<f32>(
          featureKey
          | (cooldown << 9u)
          | (preserveWarmstart << 16u)
          | (select(0u, 1u, stick) << 17u)
          | (stickAnchorReuse << 18u)
          | (select(0u, 1u, tangentialInsideCone) << 19u)
          | (select(0u, 1u, tangentialRampHappened) << 20u)
          | (warmstartDebugReason << 21u),
          ),
        ));
      }
    `,[Ir,Fr,Lr,Al,Vc,jl]);this.capturePairDualStateKernel=ue({inertialPose:Z(a,`vec4f`,b*Sl).toReadOnly(),initialPose:Z(i,`vec4f`,b*2).toReadOnly(),pairContacts:Z(e,`vec4f`,x*9),pairActivity:Z(y,`uint`,A),pairDispatchCount:T(0),regularizationAlpha:T(xl),beta:T(_l),frictionStatic:T(Gn),frictionDynamic:T(Kn),kStart:T(vl),kMax:T(1e10),lambdaMax:T(1e10),preventPenetratingNormalDropout:T(0),enableNormalReleaseHeuristic:T(0),freezeTangentialPenaltyOnStick:T(0),freezeTangentialPenaltyUpdates:T(0),useIsotropicTangentialPenaltyOnStick:T(0),rampTangentialPenaltyOnlyWhenNotSticking:T(0),useReferenceTangentialUpdate:T(1),stickExitThreshold:T(bl),tangentialPenaltyRampDeadzone:T(0),tangentialPenaltySlipRampMaxDelta:T(0),tangentialPenaltyCapScale:T(0),useNormalContactMargin:T(1),useLocalContactArms:T(1),dt:T(1/60/4),workgroupId:p,localId:W}).computeKernel([$,1,1]).setName(`AVBD Capture Pair Dual`);let de=l(`
      fn compute(
        inertialPose: ptr<storage, array<vec4f>, read>,
        jointRecords: ptr<storage, array<vec4f>, read_write>,
        jointCount: u32,
        regularizationAlpha: f32,
        beta: f32,
        betaAngular: f32,
        kStart: f32,
        lambdaMax: f32,
        workgroupId: vec3u,
        localId: vec3u,
      ) -> void {
        let gid = workgroupId.x * ${$}u + localId.x;
        if (gid >= jointCount) { return; }

        let jointMetaWords = loadJointMetaWords(jointRecords, gid);
        if (jointMetaWords.w == 0u) { return; }

        let bodyA = jointMetaWords.x;
        let bodyB = jointMetaWords.y;
        let jointType = jointMetaWords.z;
        let anchorA = loadJointAnchorA(jointRecords, gid);
        let anchorB = loadJointAnchorB(jointRecords, gid);
        let torqueArm = max(anchorA.w, 1.0);
        var currentQA = vec4f(0.0, 0.0, 0.0, 1.0);
        var currentPosA = anchorA.xyz;
        if (bodyA != WORLD_BODY_INDEX) {
          let solvePoseBaseA = bodyA * ${Sl}u;
          currentQA = normalize(inertialPose[solvePoseBaseA + 3u]);
          currentPosA = inertialPose[solvePoseBaseA + 2u].xyz;
        }
        let solvePoseBaseB = bodyB * ${Sl}u;
        let currentQB = normalize(inertialPose[solvePoseBaseB + 3u]);
        let currentPosB = inertialPose[solvePoseBaseB + 2u].xyz;
        let worldAnchorA = jointWorldAnchor(bodyA, anchorA.xyz, currentPosA, currentQA);
        let worldAnchorB = currentPosB + qrot(currentQB, anchorB.xyz);

        let stiffness = loadJointStiffness(jointRecords, gid);
        let maxPenaltyLin = vec3f(min(max(stiffness.x, kStart), ${yl}));
        let maxPenaltyAng = vec3f(min(max(stiffness.y, 0.0), ${yl}));

        let prevLambdaLin = loadJointLambdaLin(jointRecords, gid).xyz;
        let prevLambdaAng = loadJointLambdaAng(jointRecords, gid).xyz;
        let prevPenaltyLin = max(loadJointPenaltyLin(jointRecords, gid).xyz, vec3f(kStart));
        let c0Lin = loadJointC0Lin(jointRecords, gid).xyz;
        let c0Ang = loadJointC0Ang(jointRecords, gid).xyz;

        let rigidLinear = !isFiniteF32(stiffness.x);
        let angularEnabled = jointType == JOINT_TYPE_FIXED && stiffness.y > 0.0;
        let rigidAngular = angularEnabled && !isFiniteF32(stiffness.y);
        let minPenaltyAng = select(vec3f(0.0), vec3f(kStart), angularEnabled);
        let prevPenaltyAng = max(loadJointPenaltyAng(jointRecords, gid).xyz, minPenaltyAng);
        let linearConstraint = (worldAnchorA - worldAnchorB) - select(vec3f(0.0), c0Lin * regularizationAlpha, rigidLinear);
        let penaltyLin = min(prevPenaltyLin + beta * abs(linearConstraint), maxPenaltyLin);
        let lambdaLin = clamp(prevLambdaLin + prevPenaltyLin * linearConstraint, vec3f(-lambdaMax), vec3f(lambdaMax));
        storeJointLambdaLin(
          jointRecords,
          gid,
          vec4f(select(prevLambdaLin, lambdaLin, rigidLinear), 0.0),
        );
        storeJointPenaltyLin(jointRecords, gid, vec4f(penaltyLin, 0.0));

        if (angularEnabled) {
          let angularConstraint = jointFixedAngularConstraint(bodyA, currentQA, currentQB, torqueArm) - select(vec3f(0.0), c0Ang * regularizationAlpha, rigidAngular);
          let lambdaAng = clamp(prevLambdaAng + prevPenaltyAng * angularConstraint, vec3f(-lambdaMax), vec3f(lambdaMax));
          let penaltyAng = min(prevPenaltyAng + betaAngular * abs(angularConstraint), maxPenaltyAng);
          storeJointLambdaAng(
            jointRecords,
            gid,
            vec4f(select(prevLambdaAng, lambdaAng, rigidAngular), 0.0),
          );
          storeJointPenaltyAng(jointRecords, gid, vec4f(penaltyAng, 0.0));
        } else {
          storeJointLambdaAng(jointRecords, gid, vec4f(0.0));
          storeJointPenaltyAng(jointRecords, gid, vec4f(0.0));
        }
      }
    `,[Ir,Fr,Lr,ml,Ml]);this.captureJointDualStateKernel=de({inertialPose:Z(a,`vec4f`,b*Sl).toReadOnly(),jointRecords:Z(t,`vec4f`,S*11),jointCount:T(0),regularizationAlpha:T(xl),beta:T(_l),betaAngular:T(100),kStart:T(vl),lambdaMax:T(1e10),workgroupId:p,localId:W}).computeKernel([$,1,1]).setName(`AVBD Capture Joint Dual`),Pr(`AVBD Capture Joint Dual`,3);let fe=l(`
      fn compute(
        inertialPose: ptr<storage, array<vec4f>, read>,
        initialPose: ptr<storage, array<vec4f>, read>,
        positions: ptr<storage, array<vec4f>, read_write>,
        quaternions: ptr<storage, array<vec4f>, read_write>,
        velocities: ptr<storage, array<vec4f>, read_write>,
        prevLinearVelocities: ptr<storage, array<vec4f>, read_write>,
        angularVelocities: ptr<storage, array<vec4f>, read_write>,
        dt: f32,
        bodyCount: u32,
        workgroupId: vec3u,
        localId: vec3u,
      ) -> void {
        let gid = workgroupId.x * ${$}u + localId.x;
        if (gid >= bodyCount) { return; }

        let solvePoseBase = gid * ${Sl}u;
        let currentPose = inertialPose[solvePoseBase + 2u];
        let currentQ = normalize(inertialPose[solvePoseBase + 3u]);
        positions[gid] = currentPose;
        quaternions[gid] = currentQ;

        if (currentPose.w == 0.0) {
          // Keep CPU-authored kinematic velocities (hand colliders) intact so
          // the integrator can sweep them across the remaining substeps.
          return;
        }

        // Preserve the pre-finalize linear velocity for adaptive warmstarting.
        prevLinearVelocities[gid] = velocities[gid];

        let dtSafe = max(dt, 1e-6);
        let poseBase = gid * 2u;
        let prevPos = initialPose[poseBase].xyz;
        var v = (currentPose.xyz - prevPos) / dtSafe;

        let prevQ = normalize(initialPose[poseBase + 1u]);
        let dqRaw = qmul(currentQ, qconj(prevQ));
        let dq = select(dqRaw, -dqRaw, dqRaw.w < 0.0);
        let w = 2.0 * dq.xyz / dtSafe;

        velocities[gid] = vec4f(v, 0.0);
        angularVelocities[gid] = vec4f(w, 0.0);
      }
    `,[Fr,Lr]);this.finalizeVelocitiesKernel=fe({inertialPose:Z(a,`vec4f`,b*Sl).toReadOnly(),initialPose:Z(i,`vec4f`,b*2).toReadOnly(),positions:Z(r,`vec4f`,b),quaternions:Z(o,`vec4f`,b),velocities:Z(s,`vec4f`,b),prevLinearVelocities:Z(c,`vec4f`,b),angularVelocities:Z(u,`vec4f`,b),dt:T(1/60/4),bodyCount:T(0),workgroupId:p,localId:W}).computeKernel([$,1,1]).setName(`AVBD Finalize Velocities`)}contactDispatch(e){return rl?[Math.ceil(e/$),1,1]:this.contactDispatchIndirectAttr}prepare(e,t,n,r,i,a,o,s,c=`colored`){let l=Math.min(n,this.maxActivePairContacts),u=Math.max(0,Math.min(1,o));if(l>0&&(this.buildContactDispatchArgsKernel.computeNode.parameters.pairDispatchCount.value=l,this.prepareStateKernel.computeNode.parameters.pairDispatchCount.value=l,this.prepareStateKernel.computeNode.parameters.lambdaWarmstartScale.value=u,e.compute(this.buildContactDispatchArgsKernel,[1,1,1]),e.compute(this.prepareStateKernel,this.contactDispatch(l))),r>0&&(this.prepareJointStateKernel.computeNode.parameters.jointCount.value=r,this.prepareJointStateKernel.computeNode.parameters.lambdaWarmstartScale.value=u,this.prepareJointStateKernel.computeNode.parameters.dt.value=s,e.compute(this.prepareJointStateKernel,[Math.ceil(r/$),1,1])),t<=0)return;let d=Math.ceil(t/$);if(this.buildSolverConstraintListsKernel.computeNode.parameters.bodyCount.value=t,e.compute(this.buildSolverConstraintListsKernel,[d,1,1]),r>0&&(this.appendJointConstraintRefsKernel.computeNode.parameters.jointCount.value=r,e.compute(this.appendJointConstraintRefsKernel,[Math.ceil(r/$),1,1])),i>0&&(this.appendSpringConstraintRefsKernel.computeNode.parameters.springCount.value=i,e.compute(this.appendSpringConstraintRefsKernel,[Math.ceil(i/$),1,1])),c===`serial`)return;let f=Math.max(1,Math.min(32,Math.floor(a)));this.greedyBodyColorsKernel.computeNode.parameters.bodyCount.value=t,this.greedyBodyColorsKernel.computeNode.parameters.colorCount.value=f,e.compute(this.greedyBodyColorsKernel,[d,1,1]);let p=Math.max(r,i);if(p>0){this.markHardColorConflictsKernel.computeNode.parameters.bodyCount.value=t,this.markHardColorConflictsKernel.computeNode.parameters.jointCount.value=r,this.markHardColorConflictsKernel.computeNode.parameters.springCount.value=i,this.repairHardBodyColorsKernel.computeNode.parameters.bodyCount.value=t,this.repairHardBodyColorsKernel.computeNode.parameters.colorCount.value=f;let n=Math.ceil(p/$);for(let t=0;t<kl;t++)e.compute(this.markHardColorConflictsKernel,[n,1,1]),e.compute(this.repairHardBodyColorsKernel,[d,1,1])}}primalSolveBodies(e,t,n,r,i,a,o=1,s=i,c,l=0,u=0,d,f=`colored`){if(t<=0||n<=0||r<=0)return;let p=Math.ceil(t/$),m=+(f===`serial`),h=this.primalBodySolveKernel.computeNode.parameters,g=this.commitBodySolveKernel.computeNode.parameters;h.bodyCount.value=t,h.bodyIndexBase.value=0,h.dispatchBodyCount.value=t,h.bodySolveMode.value=m,h.regularizationAlpha.value=i,h.tangentialRegularizationAlpha.value=s,h.dt.value=a,h.frictionSolveScale.value=o,h.relaxation.value=Math.max(0,c?.relaxation??1),h.frictionRelaxation.value=Math.max(0,c?.frictionRelaxation??1),h.inertialDiagWeight.value=Math.max(0,c?.inertialDiagWeight??1),h.maxLinearCorrection.value=Math.max(0,c?.maxLinearCorrection??.25),h.maxAngularCorrection.value=Math.max(0,c?.maxAngularCorrection??.35),g.bodyCount.value=t,g.bodyIndexBase.value=0,g.dispatchBodyCount.value=t,g.bodySolveMode.value=m;let _=Math.max(1,Math.min(32,Math.floor(r))),v=Math.max(0,Math.min(_-1,Math.floor(u))),y=d===void 0?_-v:Math.max(0,Math.floor(d)),b=Math.min(_,v+y);if(b<=v)return;let x=Math.max(1,Math.floor(n));if(f===`serial`){h.currentColor.value=0,g.currentColor.value=0;for(let n=0;n<x;n++){h.sweepOffset.value=l+n;for(let n=0;n<t;n++)h.bodyIndexBase.value=n,h.dispatchBodyCount.value=1,g.bodyIndexBase.value=n,g.dispatchBodyCount.value=1,e.compute(this.primalBodySolveKernel,[1,1,1]),e.compute(this.commitBodySolveKernel,[1,1,1])}return}for(let t=0;t<x;t++){h.sweepOffset.value=l+t;for(let t=v;t<b;t++)h.currentColor.value=t,g.currentColor.value=t,e.compute(this.primalBodySolveKernel,[p,1,1]),e.compute(this.commitBodySolveKernel,[p,1,1])}}usesDerivedInertiaInPrimalSolve(){return!this.useLocalDiagonalPrimalSolveFastPath}captureFromSolve(e,t,n,r,i,a=-1){let o=Math.min(t,this.maxActivePairContacts);o>0&&(this.capturePairDualStateKernel.computeNode.parameters.pairDispatchCount.value=o,this.capturePairDualStateKernel.computeNode.parameters.regularizationAlpha.value=i,this.capturePairDualStateKernel.computeNode.parameters.dt.value=r,e.compute(this.capturePairDualStateKernel,this.contactDispatch(o))),n>0&&(this.captureJointDualStateKernel.computeNode.parameters.jointCount.value=n,this.captureJointDualStateKernel.computeNode.parameters.regularizationAlpha.value=i,e.compute(this.captureJointDualStateKernel,[Math.ceil(n/$),1,1]))}finalizeVelocities(e,t,n){if(t<=0)return;this.finalizeVelocitiesKernel.computeNode.parameters.bodyCount.value=t,this.finalizeVelocitiesKernel.computeNode.parameters.dt.value=n;let r=Math.ceil(t/$);e.compute(this.finalizeVelocitiesKernel,[r,1,1])}clearPhaseDebugCounters(e){this.debugEnabled&&e.compute(this.clearPhaseDebugCountersKernel,[1,1,1])}capturePhaseDebug(e,t,n,r,i=1,a=n){if(!this.debugEnabled)return;let o=Math.min(t,this.maxActivePairContacts);o<=0||(this.accumulatePhaseDebugCountersKernel.computeNode.parameters.pairDispatchCount.value=o,this.accumulatePhaseDebugCountersKernel.computeNode.parameters.regularizationAlpha.value=n,this.accumulatePhaseDebugCountersKernel.computeNode.parameters.tangentialRegularizationAlpha.value=a,this.accumulatePhaseDebugCountersKernel.computeNode.parameters.phaseOffset.value=r,this.accumulatePhaseDebugCountersKernel.computeNode.parameters.frictionSolveScale.value=i,e.compute(this.accumulatePhaseDebugCountersKernel,this.contactDispatch(o)))}setDebugEnabled(e){this.debugEnabled=e,this.debugReadbackInFlight=!1,this.separatingTraceReadbackInFlight=!1,this.separatingTraceArmed=!0,this.lastDebugLogFrame=-1}setDebugLogInterval(e){this.debugEveryNFrames=Math.max(1,Math.floor(e)),this.lastDebugLogFrame=-1}setFriction(e,t=e){let n=Math.max(0,e),r=Math.max(0,t);this.primalBodySolveKernel.computeNode.parameters.frictionStatic.value=n,this.primalBodySolveKernel.computeNode.parameters.frictionDynamic.value=r,this.prepareStateKernel.computeNode.parameters.frictionStatic.value=n,this.capturePairDualStateKernel.computeNode.parameters.frictionStatic.value=n,this.capturePairDualStateKernel.computeNode.parameters.frictionDynamic.value=r,this.accumulatePhaseDebugCountersKernel.computeNode.parameters.frictionStatic.value=n,this.accumulatePhaseDebugCountersKernel.computeNode.parameters.frictionDynamic.value=r,this.accumulateDebugCountersKernel.computeNode.parameters.frictionStatic.value=n,this.accumulateDebugCountersKernel.computeNode.parameters.frictionDynamic.value=r}setDualUpdateBeta(e){let t=Math.max(0,e);this.capturePairDualStateKernel.computeNode.parameters.beta.value=t,this.captureJointDualStateKernel.computeNode.parameters.beta.value=t,this.captureJointDualStateKernel.computeNode.parameters.betaAngular.value=Math.min(t,100)}setPreventPenetratingNormalDropout(e){this.capturePairDualStateKernel.computeNode.parameters.preventPenetratingNormalDropout.value=+!!e}setFreezeTangentialPenaltyUpdates(e){this.capturePairDualStateKernel.computeNode.parameters.freezeTangentialPenaltyUpdates.value=+!!e}setPenaltyDecayGamma(e){let t=Math.max(0,Math.min(1,e));this.prepareStateKernel.computeNode.parameters.gamma.value=t,this.prepareJointStateKernel.computeNode.parameters.gamma.value=t}setPenaltyFloor(e){let t=Math.max(1e-6,e);this.accumulatePhaseDebugCountersKernel.computeNode.parameters.kStart.value=t,this.accumulateDebugCountersKernel.computeNode.parameters.kStart.value=t,this.prepareStateKernel.computeNode.parameters.kStart.value=t,this.prepareJointStateKernel.computeNode.parameters.kStart.value=t,this.primalBodySolveKernel.computeNode.parameters.kStart.value=t,this.capturePairDualStateKernel.computeNode.parameters.kStart.value=t,this.captureJointDualStateKernel.computeNode.parameters.kStart.value=t}traceSeparatingContacts(e,t,n,r){if(this.separatingTraceReadbackInFlight||!e||typeof e.getArrayBufferAsync!=`function`)return;this.separatingTraceReadbackInFlight=!0;let i=xl,a=qn,o=2*a+1e-6,s=this.contactKeySlotBitCount>0?(1<<this.contactKeySlotBitCount)-1:0;Promise.all([e.getArrayBufferAsync(this.pairActivityAttr),e.getArrayBufferAsync(this.pairContactsAttr),e.getArrayBufferAsync(this.initialPoseAttr),e.getArrayBufferAsync(this.quaternionsAttr),e.getArrayBufferAsync(this.positionsAttr)]).then(([e,c,l,u,d])=>{let f=new Uint32Array(e),p=new Float32Array(c),m=new Uint32Array(c),h=new Float32Array(l),g=new Float32Array(u),_=new Float32Array(d),v=e=>Uc(e,0),y=e=>Uc(e,1),b=e=>Uc(e,2),x=e=>Uc(e,3),S=e=>Uc(e,4),C=e=>Uc(e,6),w=e=>Uc(e,7),T=(e,t,n,r,i,a)=>e*r+t*i+n*a,E=(e,t,n,r,i,a)=>[t*a-n*i,n*r-e*a,e*i-t*r],D=(e,t,n,r)=>{let i=Math.hypot(e,t,n,r);if(i<=1e-12)return[0,0,0,1];let a=1/i;return[e*a,t*a,n*a,r*a]},O=(e,t,n,r,i,a,o)=>{let s=2*(t*o-n*a),c=2*(n*i-e*o),l=2*(e*a-t*i);return[i+r*s+(t*l-n*c),a+r*c+(n*s-e*l),o+r*l+(e*c-t*s)]},k=(e,t,n)=>{let r=Math.abs(t)>.999?[1,0,0]:[0,1,0],[i,a,o]=E(r[0],r[1],r[2],e,t,n),s=T(i,a,o,i,a,o),c=s>1e-12?[i/Math.sqrt(s),a/Math.sqrt(s),o/Math.sqrt(s)]:[0,0,1],[l,u,d]=E(e,t,n,c[0],c[1],c[2]),f=T(l,u,d,l,u,d);return{t1:c,t2:f>1e-12?[l/Math.sqrt(f),u/Math.sqrt(f),d/Math.sqrt(f)]:[1,0,0]}},A=(e,t,n,r,i,a)=>{let o=r*e+i*t+a*n,s=r-e*o,c=i-t*o,l=a-n*o,u=T(s,c,l,s,c,l);if(u<=1e-12)return k(e,t,n);let d=1/Math.sqrt(u),f=[s*d,c*d,l*d],[p,m,h]=E(e,t,n,f[0],f[1],f[2]),g=T(p,m,h,p,m,h);if(g<=1e-12)return k(e,t,n);let _=1/Math.sqrt(g);return{t1:f,t2:[p*_,m*_,h*_]}},j=(e,t,n,r)=>{let i=k(e,t,n),a=Math.cos(r),o=Math.sin(r),s=i.t1[0]*a+i.t2[0]*o,c=i.t1[1]*a+i.t2[1]*o,l=i.t1[2]*a+i.t2[2]*o;return A(e,t,n,s,c,l)},M=e=>{switch(e){case 1:return`ex`;case 2:return`pr`;case 3:return`ng`;case 4:return`in`;case 5:return`rp`;case 6:return`mx`;default:return`--`}},N=f.subarray(this.pairActiveContactsOffset,this.pairActiveContactsOffset+this.maxActivePairContacts+1),P=Math.min(N[0]??0,this.maxActivePairContacts),F=[];for(let e=0;e<P;e++){let t=N[e+1]??this.maxPairContacts;if(t>=this.maxPairContacts)continue;let n=v(t);if((p[n+2]??0)<.5)continue;let r=Math.round(p[n]??-1),c=Math.round(p[n+1]??-1);if(r<0||c<0||r===c)continue;let l=y(t),u=p[l]??0,d=p[l+1]??0,f=p[l+2]??0,k=p[l+3]??0;if(T(u,d,f,u,d,f)<=1e-12)continue;let A=r*4,M=c*4,P=_[A]??0,I=_[A+1]??0,L=_[A+2]??0,R=_[M]??0,z=_[M+1]??0,B=_[M+2]??0,V=r*8,H=c*8,ee=P-(h[V]??P),te=I-(h[V+1]??I),ne=L-(h[V+2]??L),re=R-(h[H]??R),U=z-(h[H+1]??z),ie=B-(h[H+2]??B),ae=r*4,oe=c*4,[se,ce,le,ue]=D(g[ae]??0,g[ae+1]??0,g[ae+2]??0,g[ae+3]??1),[de,W,fe,G]=D(g[oe]??0,g[oe+1]??0,g[oe+2]??0,g[oe+3]??1),[pe,me,he,ge]=D(h[V+4]??0,h[V+5]??0,h[V+6]??0,h[V+7]??1),[_e,ve,ye,be]=D(h[H+4]??0,h[H+5]??0,h[H+6]??0,h[H+7]??1),xe=b(t),Se=x(t),Ce=p[xe]??0,K=p[xe+1]??0,we=p[xe+2]??0,Te=p[xe+3]??0,Ee=p[Se]??0,De=p[Se+1]??0,Oe=p[Se+2]??0,[ke,Ae,je]=O(se,ce,le,ue,Ce,K,we),[Me,Ne,Pe]=O(de,W,fe,G,Ee,De,Oe),[Fe,Ie,Le]=O(pe,me,he,ge,Ce,K,we),[Re,ze,Be]=O(_e,ve,ye,be,Ee,De,Oe),[Ve,He,Ue]=E(ke,Ae,je,u,d,f),[We,Ge,Ke]=E(Me,Ne,Pe,u,d,f),qe=j(u,d,f,Te),[q,J,Je]=qe.t1,[Ye,Xe,Ze]=qe.t2,Qe=ue*-pe+se*ge+ce*-he-le*-me,$e=ue*-me-se*-he+ce*ge+le*-pe,et=ue*-he+se*-me-ce*-pe+le*ge,tt=ue*ge-se*-pe-ce*-me-le*-he,nt=tt<0?-Qe:Qe,rt=tt<0?-$e:$e,it=tt<0?-et:et,Y=G*-_e+de*be+W*-ye-fe*-ve,at=G*-ve-de*-ye+W*be+fe*-_e,ot=G*-ye+de*-ve-W*-_e+fe*be,st=G*be-de*-_e-W*-ve-fe*-ye,ct=st<0?-Y:Y,lt=st<0?-at:at,ut=st<0?-ot:ot,X=2*nt,dt=2*rt,ft=2*it,pt=2*ct,mt=2*lt,ht=2*ut,gt=p[S(t)]??0;gt-a;let _t=(1-i)*gt+T(-u,-d,-f,ee,te,ne)+T(-Ve,-He,-Ue,X,dt,ft)+T(u,d,f,re,U,ie)+T(We,Ge,Ke,pt,mt,ht);if(_t<=0)continue;let vt=P+ke,yt=I+Ae,bt=L+je,xt=R+Me,St=z+Ne,Ct=B+Pe,wt=-T(vt-xt,yt-St,bt-Ct,u,d,f),Tt=-wt,Et=C(t),Dt=w(t),Ot=Math.min(p[Et]??0,0),kt=Math.max(p[Dt]??0,1e-6),At=m[n+3]??0,jt=(At>>>16&1)!=0,Mt=(At>>>17&1)!=0,Nt=(At>>>18&1)!=0,Pt=At>>>21&7,Ft=At&511,It=(m[Uc(t,8)]??0)&2147483647,Lt=this.contactKeySlotBitCount>0?It>>>this.contactKeySlotBitCount:It,Rt=this.contactKeySlotBitCount>0?It&s:0,zt=k<=1e-6&&wt>o,Bt=Nt&&zt;F.push({p:t,i:r,j:c,keyBase:Lt,keySlot:Rt,featureKey:Ft,warmstartReason:Pt,preserveWarmstart:jt,stick:Mt,reuse:Nt,penetration:k,rawPenetration:Tt,currentGap:wt,c0:gt,cRegN:_t,dualN:Ot,penaltyN:kt,clampedSeparated:zt,reusedSeparated:Bt})}F.sort((e,t)=>Number(t.reusedSeparated)-Number(e.reusedSeparated)||Number(t.clampedSeparated)-Number(e.clampedSeparated)||t.cRegN-e.cRegN||t.currentGap-e.currentGap||t.penaltyN-e.penaltyN);let I=F.slice(0,6).map(e=>`p=${e.p} ij=${e.i}/${e.j} key=${e.keyBase.toString(16)}:${e.keySlot} feat=0x${e.featureKey.toString(16)} warm=${+!!e.preserveWarmstart} wsrc=${M(e.warmstartReason)} stick=${+!!e.stick} reuse=${+!!e.reuse} pen=${e.penetration.toFixed(4)} pRaw=${e.rawPenetration.toFixed(4)} gNow=${e.currentGap.toFixed(4)} c0N=${e.c0.toFixed(4)} cRegN=${e.cRegN.toFixed(4)} dualN=${e.dualN.toFixed(3)} kN=${e.penaltyN.toFixed(3)} clampSep=${+!!e.clampedSeparated} reuseSep=${+!!e.reusedSeparated}`);console.log(`[AVBD Separating Trace] frame=${t} mainSep=${n}/${r} activeList=${P} offenders=${F.length} top=${I[0]??`none`}`),I.length>0&&console.log(`[AVBD Separating Trace Dump] ${I.join(` ; `)}`),F.length===0&&console.log(`[AVBD Separating Trace] frame=${t} mismatch=1 reason=reconstruction_found_no_positive_cRegN_rows`)}).catch(e=>{console.warn(`AVBD separating trace readback failed:`,e)}).finally(()=>{this.separatingTraceReadbackInFlight=!1})}maybeLogDebug(e,t,n,r){if(!this.debugEnabled||this.debugReadbackInFlight||this.lastDebugLogFrame===t||this.lastDebugLogFrame>=0&&t-this.lastDebugLogFrame<this.debugEveryNFrames||!e||typeof e.getArrayBufferAsync!=`function`)return;let i=Math.min(n,this.maxActivePairContacts);i<=0||(this.debugReadbackInFlight=!0,this.lastDebugLogFrame=t,this.accumulateDebugCountersKernel.computeNode.parameters.pairDispatchCount.value=i,this.accumulateBodyColorDebugCountersKernel.computeNode.parameters.bodyCount.value=r,e.compute(this.clearDebugCountersKernel,[1,1,1]),e.compute(this.accumulateDebugCountersKernel,this.contactDispatch(i)),e.compute(this.accumulateBodyColorDebugCountersKernel,[Math.ceil(r/$),1,1]),Promise.all([e.getArrayBufferAsync(this.debugCountersAttr),e.getArrayBufferAsync(this.phaseDebugCountersAttr)]).then(([n,r])=>{let i=new Uint32Array(n),a=i[0]??0,o=i[1]??0,s=i[2]??0,c=i[3]??0,l=i[4]??0,u=i[5]??0,d=i[6]??0,f=i[7]??0,p=i[8]??0,m=i[9]??0,h=i[10]??0,g=i[11]??0,_=i[12]??0,v=i[13]??0,y=i[14]??0,b=i[15]??0,x=i[16]??0,S=i[17]??0,C=s>0?(100*c/s).toFixed(1):`0.0`,w=s>0?(100*l/s).toFixed(1):`0.0`,T=g>0?(100*_/g).toFixed(1):`0.0`,E=g>0?(v/g).toFixed(2):`0.00`,D=x>0?(100*S/x).toFixed(2):`0.00`;console.log(`[AVBD Debug] frame=${t} scanned=${a} valid=${o} bounded=${s} static=${c}(${C}%) nearCone=${l}(${w}%) tinyNormal=${u} nyPos=${d} nyNeg=${f} nyVertical=${m} nyHorizontal=${h} boundViol=${p} colorFallback=${_}/${g}(${T}%) bodyRefs=${v} avgBodyRefs=${E} maxBodyRefs=${b} saturatedBodies=${y} colorConflicts=${S}/${x}(${D}%)`);let O=new Uint32Array(r),k=O[0]??0,A=O[1]??0,j=O[2]??0,M=O[3]??0,N=O[4]??0,P=O[5]??0,F=O[6]??0,I=O[7]??0,L=O[8]??0,R=O[9]??0,z=O[10]??0,B=O[11]??0,V=O[12]??0,H=O[13]??0,ee=O[14]??0,te=O[15]??0,ne=O[16]??0,re=O[17]??0,U=A>0?(100*j/A).toFixed(1):`0.0`,ie=z>0?(100*B/z).toFixed(1):`0.0`;console.log(`[AVBD Solve Phase Debug] frame=${t} main(scanned=${k} bounded=${A} nearCone=${j}(${U}%) tinyN=${M} ny+/-=${N}/${P} sep=${F} coneClamp=${I} fricOffSep=${L}) post(scanned=${R} bounded=${z} nearCone=${B}(${ie}%) tinyN=${V} ny+/-=${H}/${ee} sep=${te} coneClamp=${ne} fricOffSep=${re})`),F>0?this.separatingTraceArmed&&=(this.traceSeparatingContacts(e,t,F,A),!1):this.separatingTraceArmed=!0}).catch(e=>{console.warn(`AVBD debug readback failed:`,e)}).finally(()=>{this.debugReadbackInFlight=!1}))}},Pl={computeBounds:`

struct Uniforms {
	primCount: u32,
	workgroupCount: u32,
	positionStride: u32,
	pad1: u32,
};

struct BVH2Node {
	boundsMin: vec3f,
	leftChild: u32,
	boundsMax: vec3f,
	rightChild: u32,
};

struct Bounds {
	min: vec3f,
	max: vec3f,
};

@group(0) @binding(0) var<uniform> uniforms: Uniforms;
// Zero-copy: read packed f32/u32 arrays directly (no vec4 padding)
@group(0) @binding(1) var<storage, read> positions: array<f32>;
@group(0) @binding(2) var<storage, read> indices: array<u32>;
@group(0) @binding(3) var<storage, read_write> bvh2Nodes: array<BVH2Node>;
// Phase 1 optimization: plain u32 instead of atomic - no contention on initial write
@group(0) @binding(4) var<storage, read_write> clusterIdx: array<u32>;
// Atomic scene bounds in sortable-u32 format:
// [minX, minY, minZ, maxX, maxY, maxZ]
@group(0) @binding(5) var<storage, read_write> atomicSceneBounds: array<atomic<u32>, 6>;
// GPU-side initialization: moved from CPU
@group(0) @binding(6) var<storage, read_write> parentIdx: array<u32>;
@group(0) @binding(7) var<storage, read_write> hplocState: array<vec4u>;
@group(0) @binding(8) var<storage, read_write> activeList: array<u32>;

const INVALID_IDX: u32 = 0xFFFFFFFFu;
const WORKGROUP_SIZE: u32 = 256u;

var<workgroup> sharedMin: array<vec3f, WORKGROUP_SIZE>;
var<workgroup> sharedMax: array<vec3f, WORKGROUP_SIZE>;

// Map f32 to sortable u32 so unsigned integer order matches float order.
// Negative values: invert all bits. Non-negative values: set sign bit.
fn f32ToOrderedU32(val: f32) -> u32 {
	let bits = bitcast<u32>(val);
	return select(bits | 0x80000000u, ~bits, (bits & 0x80000000u) != 0u);
}

// Atomic min for f32 via native atomicMin on sortable-u32
fn atomicMinF32(idx: u32, val: f32) {
	atomicMin(&atomicSceneBounds[idx], f32ToOrderedU32(val));
}

// Atomic max for f32 via native atomicMax on sortable-u32
fn atomicMaxF32(idx: u32, val: f32) {
	atomicMax(&atomicSceneBounds[idx], f32ToOrderedU32(val));
}

// Load position from packed f32 array (configurable stride: 3 for vec3, 4 for vec4)
fn loadPosition(vertexIdx: u32) -> vec3f {
	let base = vertexIdx * uniforms.positionStride;
	return vec3f(positions[base], positions[base + 1u], positions[base + 2u]);
}

fn computeTriangleBounds(primIdx: u32) -> Bounds {
	// Load indices from packed u32 array (stride 3)
	let base = primIdx * 3u;
	let i0 = indices[base];
	let i1 = indices[base + 1u];
	let i2 = indices[base + 2u];

	let v0 = loadPosition(i0);
	let v1 = loadPosition(i1);
	let v2 = loadPosition(i2);

	var bounds: Bounds;
	bounds.min = min(min(v0, v1), v2);
	bounds.max = max(max(v0, v1), v2);
	return bounds;
}

@compute @workgroup_size(256)
fn computeBounds(
	@builtin(global_invocation_id) globalId: vec3u,
	@builtin(local_invocation_id) localId: vec3u,
	@builtin(workgroup_id) workgroupId: vec3u
) {
	let primIdx = globalId.x;
	let localIdx = localId.x;

	var localMin = vec3f(1e30);
	var localMax = vec3f(-1e30);

	if (primIdx < uniforms.primCount) {
		let bounds = computeTriangleBounds(primIdx);

		// Store as leaf node
		var node: BVH2Node;
		node.boundsMin = bounds.min;
		node.boundsMax = bounds.max;
		node.leftChild = INVALID_IDX;
		node.rightChild = primIdx;
		bvh2Nodes[primIdx] = node;

		// Initialize cluster index (plain store - no atomic needed)
		clusterIdx[primIdx] = primIdx;

		// GPU-side initialization (moved from CPU)
		parentIdx[primIdx] = INVALID_IDX;

		// hplocState: vec4u(left, right, split, active) - single vectorized write
		hplocState[primIdx] = vec4u(primIdx, primIdx, 0u, 1u);

		// Initialize active list (folded from separate initActiveList dispatch)
		activeList[primIdx] = primIdx;

		localMin = bounds.min;
		localMax = bounds.max;
	}

	sharedMin[localIdx] = localMin;
	sharedMax[localIdx] = localMax;

	workgroupBarrier();

	// Workgroup reduction
	for (var stride = WORKGROUP_SIZE / 2u; stride > 0u; stride = stride >> 1u) {
		if (localIdx < stride) {
			sharedMin[localIdx] = min(sharedMin[localIdx], sharedMin[localIdx + stride]);
			sharedMax[localIdx] = max(sharedMax[localIdx], sharedMax[localIdx + stride]);
		}
		workgroupBarrier();
	}

	// Thread 0 atomically updates global scene bounds (eliminates reduction passes!)
	if (localIdx == 0u) {
		let wgMin = sharedMin[0];
		let wgMax = sharedMax[0];

		// Atomic min for each component of min bounds
		atomicMinF32(0u, wgMin.x);
		atomicMinF32(1u, wgMin.y);
		atomicMinF32(2u, wgMin.z);

		// Atomic max for each component of max bounds
		atomicMaxF32(3u, wgMax.x);
		atomicMaxF32(4u, wgMax.y);
		atomicMaxF32(5u, wgMax.z);
	}
}
`,computeBoundsSubgroup:`
enable subgroups;

struct Uniforms {
	primCount: u32,
	workgroupCount: u32,
	positionStride: u32,
	pad1: u32,
};

struct BVH2Node {
	boundsMin: vec3f,
	leftChild: u32,
	boundsMax: vec3f,
	rightChild: u32,
};

struct Bounds {
	min: vec3f,
	max: vec3f,
};

@group(0) @binding(0) var<uniform> uniforms: Uniforms;
@group(0) @binding(1) var<storage, read> positions: array<f32>;
@group(0) @binding(2) var<storage, read> indices: array<u32>;
@group(0) @binding(3) var<storage, read_write> bvh2Nodes: array<BVH2Node>;
@group(0) @binding(4) var<storage, read_write> clusterIdx: array<u32>;
@group(0) @binding(5) var<storage, read_write> atomicSceneBounds: array<atomic<u32>, 6>;
@group(0) @binding(6) var<storage, read_write> parentIdx: array<u32>;
@group(0) @binding(7) var<storage, read_write> hplocState: array<vec4u>;
@group(0) @binding(8) var<storage, read_write> activeList: array<u32>;

const INVALID_IDX: u32 = 0xFFFFFFFFu;
const WORKGROUP_SIZE: u32 = 256u;

// Shared memory sized for worst case (subgroupSize=1 means 256 subgroups)
// Most GPUs have subgroupSize=32, so only 8 slots used, but we need to be safe
var<workgroup> sharedMin: array<vec3f, WORKGROUP_SIZE>;
var<workgroup> sharedMax: array<vec3f, WORKGROUP_SIZE>;

fn f32ToOrderedU32(val: f32) -> u32 {
	let bits = bitcast<u32>(val);
	return select(bits | 0x80000000u, ~bits, (bits & 0x80000000u) != 0u);
}

fn atomicMinF32(idx: u32, val: f32) {
	atomicMin(&atomicSceneBounds[idx], f32ToOrderedU32(val));
}

fn atomicMaxF32(idx: u32, val: f32) {
	atomicMax(&atomicSceneBounds[idx], f32ToOrderedU32(val));
}

fn loadPosition(vertexIdx: u32) -> vec3f {
	let base = vertexIdx * uniforms.positionStride;
	return vec3f(positions[base], positions[base + 1u], positions[base + 2u]);
}

fn computeTriangleBounds(primIdx: u32) -> Bounds {
	let base = primIdx * 3u;
	let i0 = indices[base];
	let i1 = indices[base + 1u];
	let i2 = indices[base + 2u];

	let v0 = loadPosition(i0);
	let v1 = loadPosition(i1);
	let v2 = loadPosition(i2);

	var bounds: Bounds;
	bounds.min = min(min(v0, v1), v2);
	bounds.max = max(max(v0, v1), v2);
	return bounds;
}

@compute @workgroup_size(256)
fn computeBounds(
	@builtin(global_invocation_id) globalId: vec3u,
	@builtin(local_invocation_id) localId: vec3u,
	@builtin(subgroup_invocation_id) subgroupInvocationId: u32,
	@builtin(subgroup_size) subgroupSize: u32
) {
	let primIdx = globalId.x;
	let localIdx = localId.x;
	let subgroupIdx = localIdx / subgroupSize;

	var localMin = vec3f(1e30);
	var localMax = vec3f(-1e30);

	if (primIdx < uniforms.primCount) {
		let bounds = computeTriangleBounds(primIdx);

		// Store as leaf node
		var node: BVH2Node;
		node.boundsMin = bounds.min;
		node.boundsMax = bounds.max;
		node.leftChild = INVALID_IDX;
		node.rightChild = primIdx;
		bvh2Nodes[primIdx] = node;

		// Initialize cluster index
		clusterIdx[primIdx] = primIdx;

		// GPU-side initialization
		parentIdx[primIdx] = INVALID_IDX;

		// hplocState: vec4u(left, right, split, active) - single vectorized write
		hplocState[primIdx] = vec4u(primIdx, primIdx, 0u, 1u);

		// Initialize active list (folded from separate initActiveList dispatch)
		activeList[primIdx] = primIdx;

		localMin = bounds.min;
		localMax = bounds.max;
	}

	// Subgroup reduction - no barrier needed, hardware handles it
	let sgMinX = subgroupMin(localMin.x);
	let sgMinY = subgroupMin(localMin.y);
	let sgMinZ = subgroupMin(localMin.z);
	let sgMaxX = subgroupMax(localMax.x);
	let sgMaxY = subgroupMax(localMax.y);
	let sgMaxZ = subgroupMax(localMax.z);

	// subgroupSize is uniform within workgroup, so this is uniform (no barrier needed)
	let subgroupCount = WORKGROUP_SIZE / subgroupSize;

	// First thread of each subgroup writes to shared memory
	if (subgroupInvocationId == 0u) {
		sharedMin[subgroupIdx] = vec3f(sgMinX, sgMinY, sgMinZ);
		sharedMax[subgroupIdx] = vec3f(sgMaxX, sgMaxY, sgMaxZ);
	}

	workgroupBarrier();

	// Final reduction: tree reduction across subgroup results
	// Use fixed iteration count for uniform control flow (8 iterations covers up to 256 subgroups)
	// Each iteration halves the active range until only element 0 remains
	for (var s = 128u; s > 0u; s = s >> 1u) {
		// Only reduce if this stride is within our subgroup count
		if (s < subgroupCount && localIdx < s) {
			sharedMin[localIdx] = min(sharedMin[localIdx], sharedMin[localIdx + s]);
			sharedMax[localIdx] = max(sharedMax[localIdx], sharedMax[localIdx + s]);
		}
		workgroupBarrier();
	}

	// Thread 0 atomically updates global scene bounds
	if (localIdx == 0u) {
		let wgMin = sharedMin[0];
		let wgMax = sharedMax[0];
		atomicMinF32(0u, wgMin.x);
		atomicMinF32(1u, wgMin.y);
		atomicMinF32(2u, wgMin.z);
		atomicMaxF32(3u, wgMax.x);
		atomicMaxF32(4u, wgMax.y);
		atomicMaxF32(5u, wgMax.z);
	}
}
`,reduceBounds:`

struct Uniforms {
	primCount: u32,
	workgroupCount: u32,
	pad0: u32,
	pad1: u32,
};

struct SceneBounds {
	min: vec3f,
	pad0: f32,
	max: vec3f,
	pad1: f32,
};

@group(0) @binding(0) var<uniform> uniforms: Uniforms;
@group(0) @binding(1) var<storage, read> partialBoundsMin: array<vec4f>;
@group(0) @binding(2) var<storage, read> partialBoundsMax: array<vec4f>;
@group(0) @binding(3) var<storage, read_write> sceneBounds: SceneBounds;

const WORKGROUP_SIZE: u32 = 256u;

var<workgroup> sharedMin: array<vec3f, WORKGROUP_SIZE>;
var<workgroup> sharedMax: array<vec3f, WORKGROUP_SIZE>;

@compute @workgroup_size(256)
fn reduceBounds(
	@builtin(local_invocation_id) localId: vec3u
) {
	let localIdx = localId.x;

	var localMin = vec3f(1e30);
	var localMax = vec3f(-1e30);

	// Load partial results
	if (localIdx < uniforms.workgroupCount) {
		localMin = partialBoundsMin[localIdx].xyz;
		localMax = partialBoundsMax[localIdx].xyz;
	}

	sharedMin[localIdx] = localMin;
	sharedMax[localIdx] = localMax;

	workgroupBarrier();

	// Reduction
	for (var stride = WORKGROUP_SIZE / 2u; stride > 0u; stride = stride >> 1u) {
		if (localIdx < stride) {
			sharedMin[localIdx] = min(sharedMin[localIdx], sharedMin[localIdx + stride]);
			sharedMax[localIdx] = max(sharedMax[localIdx], sharedMax[localIdx + stride]);
		}
		workgroupBarrier();
	}

	// Write final result
	if (localIdx == 0u) {
		sceneBounds.min = sharedMin[0];
		sceneBounds.max = sharedMax[0];
	}
}
`,reduceBoundsToPartial:`

struct Uniforms {
	primCount: u32,
	workgroupCount: u32,
	pad0: u32,
	pad1: u32,
};

@group(0) @binding(0) var<uniform> uniforms: Uniforms;
@group(0) @binding(1) var<storage, read> partialBoundsMinIn: array<vec4f>;
@group(0) @binding(2) var<storage, read> partialBoundsMaxIn: array<vec4f>;
@group(0) @binding(3) var<storage, read_write> partialBoundsMinOut: array<vec4f>;
@group(0) @binding(4) var<storage, read_write> partialBoundsMaxOut: array<vec4f>;

const WORKGROUP_SIZE: u32 = 256u;

var<workgroup> sharedMin: array<vec3f, WORKGROUP_SIZE>;
var<workgroup> sharedMax: array<vec3f, WORKGROUP_SIZE>;

@compute @workgroup_size(256)
fn reduceBoundsToPartial(
	@builtin(local_invocation_id) localId: vec3u,
	@builtin(workgroup_id) workgroupId: vec3u
) {
	let localIdx = localId.x;
	let base = workgroupId.x * WORKGROUP_SIZE;
	let idx = base + localIdx;

	var localMin = vec3f(1e30);
	var localMax = vec3f(-1e30);

	// Load partial results
	if (idx < uniforms.workgroupCount) {
		localMin = partialBoundsMinIn[idx].xyz;
		localMax = partialBoundsMaxIn[idx].xyz;
	}

	sharedMin[localIdx] = localMin;
	sharedMax[localIdx] = localMax;

	workgroupBarrier();

	// Reduction
	for (var stride = WORKGROUP_SIZE / 2u; stride > 0u; stride = stride >> 1u) {
		if (localIdx < stride) {
			sharedMin[localIdx] = min(sharedMin[localIdx], sharedMin[localIdx + stride]);
			sharedMax[localIdx] = max(sharedMax[localIdx], sharedMax[localIdx + stride]);
		}
		workgroupBarrier();
	}

	// Write reduced result
	if (localIdx == 0u) {
		partialBoundsMinOut[workgroupId.x] = vec4f(sharedMin[0], 0.0);
		partialBoundsMaxOut[workgroupId.x] = vec4f(sharedMax[0], 0.0);
	}
}
`,computeMorton:`

struct Uniforms {
	primCount: u32,
	workgroupCount: u32,
	pad0: u32,
	pad1: u32,
};

struct BVH2Node {
	boundsMin: vec3f,
	leftChild: u32,
	boundsMax: vec3f,
	rightChild: u32,
};

@group(0) @binding(0) var<uniform> uniforms: Uniforms;
@group(0) @binding(1) var<storage, read> bvh2Nodes: array<BVH2Node>;
// Atomic scene bounds in sortable-u32 format:
// [minX, minY, minZ, maxX, maxY, maxZ]
@group(0) @binding(2) var<storage, read> atomicSceneBounds: array<u32, 6>;
@group(0) @binding(3) var<storage, read_write> mortonCodes: array<u32>;

fn orderedU32ToF32(key: u32) -> f32 {
	let bits = select(key & 0x7FFFFFFFu, ~key, (key & 0x80000000u) == 0u);
	return bitcast<f32>(bits);
}

fn expandBits(v: u32) -> u32 {
	var x = v & 0x3FFu;
	x = (x | (x << 16u)) & 0x030000FFu;
	x = (x | (x << 8u)) & 0x0300F00Fu;
	x = (x | (x << 4u)) & 0x030C30C3u;
	x = (x | (x << 2u)) & 0x09249249u;
	return x;
}

fn computeMortonCode(normalizedPos: vec3f) -> u32 {
	let clamped = clamp(normalizedPos, vec3f(0.0), vec3f(1.0));
	let scaled = vec3u(clamped * 1023.0);

	let xx = expandBits(scaled.x);
	let yy = expandBits(scaled.y);
	let zz = expandBits(scaled.z);

	return (xx << 2u) | (yy << 1u) | zz;
}

@compute @workgroup_size(256)
fn computeMorton(
	@builtin(global_invocation_id) globalId: vec3u
) {
	let primIdx = globalId.x;

	if (primIdx >= uniforms.primCount) {
		return;
	}

	let node = bvh2Nodes[primIdx];
	let centroid = (node.boundsMin + node.boundsMax) * 0.5;

	// Decode scene bounds from sortable-u32 format.
	let sceneMin = vec3f(
		orderedU32ToF32(atomicSceneBounds[0]),
		orderedU32ToF32(atomicSceneBounds[1]),
		orderedU32ToF32(atomicSceneBounds[2])
	);
	let sceneMax = vec3f(
		orderedU32ToF32(atomicSceneBounds[3]),
		orderedU32ToF32(atomicSceneBounds[4]),
		orderedU32ToF32(atomicSceneBounds[5])
	);

	let sceneExtent = sceneMax - sceneMin;
	let safeExtent = select(sceneExtent, vec3f(1.0), sceneExtent == vec3f(0.0));

	let normalized = (centroid - sceneMin) / safeExtent;
	mortonCodes[primIdx] = computeMortonCode(normalized);
}
`},Fl={histogram:`

struct Uniforms {
	primCount: u32,
	bitOffset: u32,
	workgroupCount: u32,
	pad1: u32,
};

@group(0) @binding(0) var<uniform> uniforms: Uniforms;
@group(0) @binding(1) var<storage, read> keys: array<u32>;
@group(0) @binding(2) var<storage, read_write> groupCounts: array<u32>;
@group(0) @binding(3) var<storage, read_write> globalDigitCount: array<atomic<u32>>;

const WORKGROUP_SIZE: u32 = 256u;
const RADIX_SIZE: u32 = 256u;

var<workgroup> localHistogram: array<atomic<u32>, RADIX_SIZE>;

@compute @workgroup_size(256)
fn computeHistogram(
	@builtin(global_invocation_id) globalId: vec3u,
	@builtin(local_invocation_id) localId: vec3u,
	@builtin(workgroup_id) workgroupId: vec3u
) {
	let idx = globalId.x;
	let localIdx = localId.x;

	// Initialize local histogram
	if (localIdx < RADIX_SIZE) {
		atomicStore(&localHistogram[localIdx], 0u);
	}

	workgroupBarrier();

	// Count local occurrences
	if (idx < uniforms.primCount) {
		let key = keys[idx];
		let digit = (key >> uniforms.bitOffset) & 0xFFu;
		atomicAdd(&localHistogram[digit], 1u);
	}

	workgroupBarrier();

	// Store per-workgroup counts (not reservations - that was non-deterministic!)
	// Also accumulate global totals for digit base offset calculation
	if (localIdx < RADIX_SIZE) {
		let count = atomicLoad(&localHistogram[localIdx]);
		// Store count for workgroup scan to process in deterministic order
		groupCounts[workgroupId.x * RADIX_SIZE + localIdx] = count;
		// Accumulate global total for this digit
		atomicAdd(&globalDigitCount[localIdx], count);
	}
}
`,workgroupScan:`

struct Uniforms {
	primCount: u32,
	bitOffset: u32,
	workgroupCount: u32,
	pad1: u32,
};

@group(0) @binding(0) var<uniform> uniforms: Uniforms;
@group(0) @binding(1) var<storage, read> groupCounts: array<u32>;
@group(0) @binding(2) var<storage, read_write> groupPrefix: array<u32>;

const RADIX_SIZE: u32 = 256u;

@compute @workgroup_size(256)
fn workgroupScan(
	@builtin(local_invocation_id) localId: vec3u
) {
	let digit = localId.x;  // Each thread handles one digit (256 threads = 256 digits)

	// Compute exclusive prefix sum across all workgroups for this digit
	// This is O(workgroupCount) per thread, but ensures deterministic ordering
	var sum = 0u;
	for (var wg = 0u; wg < uniforms.workgroupCount; wg++) {
		let count = groupCounts[wg * RADIX_SIZE + digit];
		groupPrefix[wg * RADIX_SIZE + digit] = sum;  // Exclusive prefix
		sum += count;
	}
}
`,scan:`

@group(0) @binding(1) var<storage, read> globalDigitCount: array<u32>;
@group(0) @binding(2) var<storage, read_write> digitOffsets: array<u32>;

const RADIX_SIZE: u32 = 256u;

var<workgroup> sharedScan: array<u32, RADIX_SIZE>;

@compute @workgroup_size(256)
fn prefixScan(
	@builtin(local_invocation_id) localId: vec3u
) {
	let idx = localId.x;

	// Load digit counts
	sharedScan[idx] = globalDigitCount[idx];
	workgroupBarrier();

	// Hillis-Steele inclusive prefix sum (log2(256) = 8 iterations)
	for (var stride = 1u; stride < RADIX_SIZE; stride = stride * 2u) {
		var addVal = 0u;
		if (idx >= stride) {
			addVal = sharedScan[idx - stride];
		}
		workgroupBarrier();
		sharedScan[idx] = sharedScan[idx] + addVal;
		workgroupBarrier();
	}

	// Convert inclusive to exclusive prefix sum and store
	if (idx == 0u) {
		digitOffsets[0] = 0u;
	} else {
		digitOffsets[idx] = sharedScan[idx - 1u];
	}
}
`,scatter:`

struct Uniforms {
	primCount: u32,
	bitOffset: u32,
	workgroupCount: u32,
	pad1: u32,
};

@group(0) @binding(0) var<uniform> uniforms: Uniforms;
@group(0) @binding(1) var<storage, read> keysIn: array<u32>;
@group(0) @binding(2) var<storage, read_write> keysOut: array<u32>;
@group(0) @binding(3) var<storage, read> valsIn: array<u32>;
@group(0) @binding(4) var<storage, read_write> valsOut: array<u32>;
@group(0) @binding(5) var<storage, read> groupPrefix: array<u32>;
@group(0) @binding(6) var<storage, read> digitOffsets: array<u32>;

const WORKGROUP_SIZE: u32 = 256u;
const RADIX_SIZE: u32 = 256u;

var<workgroup> sharedDigits: array<u32, WORKGROUP_SIZE>;
var<workgroup> sharedRanks: array<u32, WORKGROUP_SIZE>;
var<workgroup> digitCounts: array<u32, RADIX_SIZE>;

@compute @workgroup_size(256)
fn scatter(
	@builtin(global_invocation_id) globalId: vec3u,
	@builtin(local_invocation_id) localId: vec3u,
	@builtin(workgroup_id) workgroupId: vec3u
) {
	let idx = globalId.x;
	let localIdx = localId.x;
	let valid = idx < uniforms.primCount;

	var digit = 0xFFFFFFFFu;
	if (valid) {
		let key = keysIn[idx];
		digit = (key >> uniforms.bitOffset) & 0xFFu;
	}

	sharedDigits[localIdx] = digit;
	workgroupBarrier();

	// Thread 0 computes all ranks in single O(n) pass
	// This maintains stability: threads are processed in order
	if (localIdx == 0u) {
		// Zero digit counts
		for (var d = 0u; d < RADIX_SIZE; d = d + 1u) {
			digitCounts[d] = 0u;
		}
		// Assign ranks in thread order (stable)
		for (var i = 0u; i < WORKGROUP_SIZE; i = i + 1u) {
			let d = sharedDigits[i];
			if (d < RADIX_SIZE) {
				sharedRanks[i] = digitCounts[d];
				digitCounts[d] = digitCounts[d] + 1u;
			} else {
				sharedRanks[i] = 0u;
			}
		}
	}
	workgroupBarrier();

	if (!valid) {
		return;
	}

	let localRank = sharedRanks[localIdx];
	let key = keysIn[idx];
	let val = valsIn[idx];
	let groupOffset = groupPrefix[workgroupId.x * RADIX_SIZE + digit];
	let baseOffset = digitOffsets[digit];
	let destIdx = baseOffset + groupOffset + localRank;

	keysOut[destIdx] = key;
	valsOut[destIdx] = val;
}
`},Il=256,Ll=`
struct Uniforms {
  primCount: u32,
  _pad0: u32,
  _pad1: u32,
  _pad2: u32,
};

@group(0) @binding(0) var<uniform> uniforms: Uniforms;
@group(0) @binding(1) var<storage, read_write> parentIdx: array<u32>;
@group(0) @binding(2) var<storage, read_write> visitCount: array<atomic<u32>>;

const INVALID_IDX: u32 = 0xFFFFFFFFu;

@compute @workgroup_size(${Il})
fn initState(@builtin(global_invocation_id) globalId: vec3u) {
  let idx = globalId.x;
  let maxNodes = uniforms.primCount * 2u;
  if (idx >= maxNodes) {
    return;
  }

  parentIdx[idx] = INVALID_IDX;
  atomicStore(&visitCount[idx], 0u);
}
`,Rl=`
struct Uniforms {
  primCount: u32,
  _pad0: u32,
  _pad1: u32,
  _pad2: u32,
};

struct BVH2Node {
  boundsMin: vec3f,
  leftChild: u32,
  boundsMax: vec3f,
  rightChild: u32,
};

@group(0) @binding(0) var<uniform> uniforms: Uniforms;
@group(0) @binding(1) var<storage, read> mortonCodes: array<u32>;
@group(0) @binding(2) var<storage, read> clusterIdx: array<u32>;
@group(0) @binding(3) var<storage, read_write> bvh2Nodes: array<BVH2Node>;
@group(0) @binding(4) var<storage, read_write> parentIdx: array<u32>;

const INVALID_IDX: u32 = 0xFFFFFFFFu;

fn delta(idx: i32, other: i32, n: i32) -> i32 {
  if (other < 0 || other >= n) {
    return -1;
  }

  let a = u32(idx);
  let b = u32(other);
  let ka = mortonCodes[a];
  let kb = mortonCodes[b];

  if (ka == kb) {
    return 32 + i32(countLeadingZeros(a ^ b));
  }

  return i32(countLeadingZeros(ka ^ kb));
}

fn determineRange(idx: i32, n: i32) -> vec2i {
  if (idx == 0) {
    return vec2i(0, n - 1);
  }

  let deltaLeft = delta(idx, idx - 1, n);
  let deltaRight = delta(idx, idx + 1, n);
  let direction = select(-1, 1, deltaRight > deltaLeft);

  let deltaMin = delta(idx, idx - direction, n);
  var lMax = 2;
  loop {
    let nextIdx = idx + lMax * direction;
    if (delta(idx, nextIdx, n) <= deltaMin) {
      break;
    }
    lMax = lMax * 2;
  }

  var length = 0;
  var t = lMax / 2;
  loop {
    if (t <= 0) {
      break;
    }

    let nextLength = length + t;
    let nextIdx = idx + nextLength * direction;
    if (delta(idx, nextIdx, n) > deltaMin) {
      length = nextLength;
    }

    t = t / 2;
  }

  let j = idx + length * direction;
  if (direction < 0) {
    return vec2i(j, idx);
  }

  return vec2i(idx, j);
}

fn findSplit(first: i32, last: i32, n: i32) -> i32 {
  let commonPrefix = delta(first, last, n);
  var split = first;
  var step = last - first;

  loop {
    step = (step + 1) / 2;
    if (step <= 0) {
      break;
    }

    let candidate = split + step;
    if (candidate < last && delta(first, candidate, n) > commonPrefix) {
      split = candidate;
    }

    if (step == 1) {
      break;
    }
  }

  return split;
}

@compute @workgroup_size(${Il})
fn buildTopology(@builtin(global_invocation_id) globalId: vec3u) {
  let internalId = globalId.x;
  if (uniforms.primCount <= 1u || internalId >= uniforms.primCount - 1u) {
    return;
  }

  let n = i32(uniforms.primCount);
  let idx = i32(internalId);
  let range = determineRange(idx, n);
  let split = findSplit(range.x, range.y, n);

  let nodeIdx = uniforms.primCount + internalId;

  var leftChild = INVALID_IDX;
  if (split == range.x) {
    leftChild = clusterIdx[u32(split)];
  } else {
    leftChild = uniforms.primCount + u32(split);
  }

  var rightChild = INVALID_IDX;
  if (split + 1 == range.y) {
    rightChild = clusterIdx[u32(split + 1)];
  } else {
    rightChild = uniforms.primCount + u32(split + 1);
  }

  var node = bvh2Nodes[nodeIdx];
  node.leftChild = leftChild;
  node.rightChild = rightChild;
  bvh2Nodes[nodeIdx] = node;

  parentIdx[leftChild] = nodeIdx;
  parentIdx[rightChild] = nodeIdx;
}
`,zl=`
struct Uniforms {
  primCount: u32,
  _pad0: u32,
  _pad1: u32,
  _pad2: u32,
};

struct BVH2Node {
  boundsMin: vec3f,
  leftChild: u32,
  boundsMax: vec3f,
  rightChild: u32,
};

@group(0) @binding(0) var<uniform> uniforms: Uniforms;
@group(0) @binding(1) var<storage, read> clusterIdx: array<u32>;
@group(0) @binding(2) var<storage, read> parentIdx: array<u32>;
@group(0) @binding(3) var<storage, read_write> visitCount: array<atomic<u32>>;
@group(0) @binding(4) var<storage, read_write> activeListOut: array<u32>;
@group(0) @binding(5) var<storage, read_write> activeCountOut: atomic<u32>;

const INVALID_IDX: u32 = 0xFFFFFFFFu;

@compute @workgroup_size(${Il})
fn seedInternal(@builtin(global_invocation_id) globalId: vec3u) {
  let sortedLeafIdx = globalId.x;
  if (sortedLeafIdx >= uniforms.primCount) {
    return;
  }

  let leafNodeIdx = clusterIdx[sortedLeafIdx];
  let parent = parentIdx[leafNodeIdx];
  if (parent == INVALID_IDX) {
    return;
  }

  // First child arrival stores 0 -> 1, second stores 1 -> 2.
  // Only second arrival can enqueue this internal node as ready.
  let previous = atomicAdd(&visitCount[parent], 1u);
  if (previous == 1u) {
    let writeIdx = atomicAdd(&activeCountOut, 1u);
    activeListOut[writeIdx] = parent;
  }
}
`,Bl=`
struct Uniforms {
  primCount: u32,
  _pad0: u32,
  _pad1: u32,
  _pad2: u32,
};

struct BVH2Node {
  boundsMin: vec3f,
  leftChild: u32,
  boundsMax: vec3f,
  rightChild: u32,
};

@group(0) @binding(0) var<uniform> uniforms: Uniforms;
@group(0) @binding(1) var<storage, read_write> bvh2Nodes: array<BVH2Node>;
@group(0) @binding(2) var<storage, read> parentIdx: array<u32>;
@group(0) @binding(3) var<storage, read_write> visitCount: array<atomic<u32>>;
@group(0) @binding(4) var<storage, read> activeListIn: array<u32>;
@group(0) @binding(5) var<storage, read_write> activeListOut: array<u32>;
@group(0) @binding(6) var<storage, read_write> activeCountIn: atomic<u32>;
@group(0) @binding(7) var<storage, read_write> activeCountOut: atomic<u32>;

const INVALID_IDX: u32 = 0xFFFFFFFFu;

@compute @workgroup_size(${Il})
fn refitWave(@builtin(global_invocation_id) globalId: vec3u) {
  // Keep the uniform binding live in auto-layout.
  if (uniforms.primCount == 0u) {
    return;
  }

  let idx = globalId.x;
  let activeCount = atomicLoad(&activeCountIn);
  if (idx >= activeCount) {
    return;
  }

  let nodeIdx = activeListIn[idx];
  if (nodeIdx == INVALID_IDX) {
    return;
  }

  let node = bvh2Nodes[nodeIdx];
  let c0 = node.leftChild;
  let c1 = node.rightChild;
  if (c0 == INVALID_IDX || c1 == INVALID_IDX) {
    return;
  }

  let mergedMin = min(bvh2Nodes[c0].boundsMin, bvh2Nodes[c1].boundsMin);
  let mergedMax = max(bvh2Nodes[c0].boundsMax, bvh2Nodes[c1].boundsMax);
  bvh2Nodes[nodeIdx].boundsMin = mergedMin;
  bvh2Nodes[nodeIdx].boundsMax = mergedMax;

  let parent = parentIdx[nodeIdx];
  if (parent == INVALID_IDX) {
    return;
  }

  let previous = atomicAdd(&visitCount[parent], 1u);
  if (previous == 1u) {
    let writeIdx = atomicAdd(&activeCountOut, 1u);
    activeListOut[writeIdx] = parent;
  }
}
`,Vl=`
@group(0) @binding(0) var<storage, read_write> activeCountIn: atomic<u32>;
@group(0) @binding(1) var<storage, read_write> indirectDispatch: array<u32>;
@group(0) @binding(2) var<storage, read_write> activeCountOut: atomic<u32>;

const WORKGROUP_SIZE: u32 = ${Il}u;

@compute @workgroup_size(1)
fn updateDispatch() {
  let count = atomicLoad(&activeCountIn);
  let workgroups = (count + WORKGROUP_SIZE - 1u) / WORKGROUP_SIZE;
  indirectDispatch[0] = workgroups;
  indirectDispatch[1] = 1u;
  indirectDispatch[2] = 1u;
  atomicStore(&activeCountOut, 0u);
}
`,Hl=`
struct Uniforms {
  primCount: u32,
  _pad0: u32,
  _pad1: u32,
  _pad2: u32,
};

@group(0) @binding(0) var<uniform> uniforms: Uniforms;
@group(0) @binding(1) var<storage, read_write> clusterIdx: array<u32>;
@group(0) @binding(2) var<storage, read_write> nodeCounter: atomic<u32>;

@compute @workgroup_size(1)
fn finalizeTree() {
  if (uniforms.primCount == 0u) {
    atomicStore(&nodeCounter, 0u);
    return;
  }

  let rootIdx = select(0u, uniforms.primCount, uniforms.primCount > 1u);
  clusterIdx[0] = rootIdx;
  atomicStore(&nodeCounter, uniforms.primCount * 2u - 1u);
}
`,Ul=class{constructor(e){this.device=e,this.name=`BaseSorter`,this._initialized=!1}async init(e){throw Error(`BaseSorter.init() must be implemented by subclass`)}sort(e){throw Error(`BaseSorter.sort() must be implemented by subclass`)}dispose(){}getTimings(){return null}},Wl=`
//****************************************************************************
// GPUSorting
// OneSweep - WaveSize 16-32 variant
//
// SPDX-License-Identifier: MIT
// Copyright Thomas Smith 12/7/2024
// https://github.com/b0nes164/GPUSorting
//
// Modified for WGSL compatibility and variable subgroup sizes by Dino Metarapi, 2025
// Based on original work by Thomas Smith
//
// NOTE: This shader uses ballot.x (32 bits) for peer masks, so it only works
// for lane_count <= 32. For lane_count > 32, use the wave64 variant.
//****************************************************************************

enable subgroups;

@diagnostic(off, subgroup_uniformity)
fn unsafeSubgroupInclusiveAdd(x: u32) -> u32 { return subgroupInclusiveAdd(x); }

@diagnostic(off, subgroup_uniformity)
fn unsafeSubgroupExclusiveAdd(x: u32) -> u32 { return subgroupExclusiveAdd(x); }

@diagnostic(off, subgroup_uniformity)
fn unsafeSubgroupShuffle(x: u32, source: u32) -> u32 { return subgroupShuffle(x, source); }

@diagnostic(off, subgroup_uniformity)
fn unsafeSubgroupBallot(pred: bool) -> vec4<u32> { return subgroupBallot(pred); }

@diagnostic(off, subgroup_uniformity)
fn unsafeSubgroupAdd(x: u32) -> u32 { return subgroupAdd(x); }

struct InfoStruct
{
    size: u32,
    shift: u32,
    thread_blocks: u32,
    seed: u32,
};

@group(0) @binding(0)
var<uniform> info : InfoStruct;

@group(0) @binding(1)
var<storage, read_write> bump: array<atomic<u32>>;

@group(0) @binding(2)
var<storage, read_write> sort: array<u32>;

@group(0) @binding(3)
var<storage, read_write> alt: array<u32>;

@group(0) @binding(4)
var<storage, read_write> payload: array<u32>;

@group(0) @binding(5)
var<storage, read_write> alt_payload: array<u32>;

@group(0) @binding(6)
var<storage, read_write> hist: array<atomic<u32>>;

@group(0) @binding(7)
var<storage, read_write> pass_hist: array<atomic<u32>>;

@group(0) @binding(8)
var<storage, read_write> status: array<u32>;

const SORT_PASSES = 4u;
const BLOCK_DIM = 256u;
const MIN_SUBGROUP_SIZE = 16u;
const MAX_SUBGROUP_SIZE_W16 = 32u;  // ballot.x is only 32 bits - wave16 max
const MAX_REDUCE_SIZE = BLOCK_DIM / MIN_SUBGROUP_SIZE;

const STATUS_ERR_GLOBAL_HIST = 0u;
const STATUS_ERR_SCAN = 1u;
const STATUS_ERR_PASS = 2u;
const STATUS_ERR_LANE_COUNT = 3u;

const FLAG_NOT_READY = 0u;
const FLAG_REDUCTION = 1u;
const FLAG_INCLUSIVE = 2u;
const FLAG_MASK = 3u;

const RADIX = 256u;
const ALL_RADIX = RADIX * SORT_PASSES;
const RADIX_MASK = 255u;
const RADIX_LOG = 8u;

const KEYS_PER_THREAD = 15u;
const PART_SIZE = KEYS_PER_THREAD * BLOCK_DIM;

const REDUCE_BLOCK_DIM = 128u;
const REDUCE_KEYS_PER_THREAD = 30u;
const REDUCE_HIST_SIZE = REDUCE_BLOCK_DIM / MIN_SUBGROUP_SIZE * ALL_RADIX;
const REDUCE_PART_SIZE = REDUCE_KEYS_PER_THREAD * REDUCE_BLOCK_DIM;

const MAX_SUBGROUPS_PER_BLOCK = BLOCK_DIM / MIN_SUBGROUP_SIZE;
const WARP_HIST_CAPACITY = MAX_SUBGROUPS_PER_BLOCK * RADIX;

var<workgroup> wg_globalHist: array<atomic<u32>, REDUCE_HIST_SIZE>;

@compute @workgroup_size(REDUCE_BLOCK_DIM, 1, 1)
fn global_hist(
    @builtin(local_invocation_id) threadid: vec3<u32>,
    @builtin(subgroup_invocation_id) laneid: u32,
    @builtin(subgroup_size) lane_count: u32,
    @builtin(workgroup_id) wgid: vec3<u32>) {

    if (lane_count < MIN_SUBGROUP_SIZE || (REDUCE_BLOCK_DIM % lane_count) != 0u) {
        if (threadid.x == 0u) {
            status[STATUS_ERR_GLOBAL_HIST] = 0xDEAD0001u;
        }
        return;
    }

    let sid = threadid.x / lane_count;

    //Clear shared memory
    for (var i = threadid.x; i < REDUCE_HIST_SIZE; i += REDUCE_BLOCK_DIM) {
        atomicStore(&wg_globalHist[i], 0u);
    }
    workgroupBarrier();

    let radix_shift = info.shift;
    let hist_offset = sid * ALL_RADIX;
    {
        var i = threadid.x + wgid.x * REDUCE_PART_SIZE;
        if(wgid.x < info.thread_blocks - 1) {
            for (var k = 0u; k < REDUCE_KEYS_PER_THREAD; k += 1u) {
                let key = sort[i];
                atomicAdd(&wg_globalHist[(key & RADIX_MASK) + hist_offset], 1u);
                atomicAdd(&wg_globalHist[((key >> 8u) & RADIX_MASK) + hist_offset + 256u], 1u);
                atomicAdd(&wg_globalHist[((key >> 16u) & RADIX_MASK) + hist_offset + 512u], 1u);
                atomicAdd(&wg_globalHist[((key >> 24u) & RADIX_MASK) + hist_offset + 768u], 1u);
                i += REDUCE_BLOCK_DIM;
            }
        }

        if(wgid.x == info.thread_blocks - 1) {
            for (var k = 0u; k < REDUCE_KEYS_PER_THREAD; k += 1u) {
                if (i < info.size) {
                    let key = sort[i];
                    atomicAdd(&wg_globalHist[(key & RADIX_MASK) + hist_offset], 1u);
                    atomicAdd(&wg_globalHist[((key >> 8u) & RADIX_MASK) + hist_offset + 256u], 1u);
                    atomicAdd(&wg_globalHist[((key >> 16u) & RADIX_MASK) + hist_offset + 512u], 1u);
                    atomicAdd(&wg_globalHist[((key >> 24u) & RADIX_MASK) + hist_offset + 768u], 1u);
                }
                i += REDUCE_BLOCK_DIM;
            }
        }
    }
    workgroupBarrier();

    // Merge subgroup histograms
    let subgroup_histograms = REDUCE_BLOCK_DIM / lane_count;
    for(var i = threadid.x; i < RADIX; i += REDUCE_BLOCK_DIM) {
        var reduction0 = atomicLoad(&wg_globalHist[i]);
        var reduction1 = atomicLoad(&wg_globalHist[i + 256u]);
        var reduction2 = atomicLoad(&wg_globalHist[i + 512u]);
        var reduction3 = atomicLoad(&wg_globalHist[i + 768u]);

        for (var h = 1u; h < subgroup_histograms; h += 1u) {
            let idx = h * ALL_RADIX;
            reduction0 += atomicLoad(&wg_globalHist[i + idx]);
            reduction1 += atomicLoad(&wg_globalHist[i + 256u + idx]);
            reduction2 += atomicLoad(&wg_globalHist[i + 512u + idx]);
            reduction3 += atomicLoad(&wg_globalHist[i + 768u + idx]);
        }

        atomicAdd(&hist[i], reduction0);
        atomicAdd(&hist[i + 256u], reduction1);
        atomicAdd(&hist[i + 512u], reduction2);
        atomicAdd(&hist[i + 768u], reduction3);
    }
}

//Assumes block dim 256
const SCAN_MEM_SIZE = RADIX / MIN_SUBGROUP_SIZE;
var<workgroup> wg_scan: array<u32, SCAN_MEM_SIZE>;
@compute @workgroup_size(BLOCK_DIM, 1, 1)
fn onesweep_scan(
    @builtin(local_invocation_id) threadid: vec3<u32>,
    @builtin(subgroup_invocation_id) laneid: u32,
    @builtin(subgroup_size) lane_count: u32,
    @builtin(workgroup_id) wgid: vec3<u32>) {

    if (lane_count < MIN_SUBGROUP_SIZE || (BLOCK_DIM % lane_count) != 0u) {
        if (threadid.x == 0u) {
            status[STATUS_ERR_SCAN] = 0xDEAD0002u;
        }
        return;
    }

    let sid = threadid.x / lane_count;
    let pass_plane = info.shift >> 3u;
    let hist_index = threadid.x + pass_plane * RADIX;
    let scan = atomicLoad(&hist[hist_index]);
    let red = unsafeSubgroupAdd(scan);
    if(laneid == 0u){
        wg_scan[sid] = red;
    }
    workgroupBarrier();

    //Non-divergent subgroup agnostic inclusive scan across subgroup reductions
    {
        var offset0 = 0u;
        var offset1 = 0u;
        let lane_log = u32(countTrailingZeros(lane_count));
        let spine_size = BLOCK_DIM >> lane_log;
        let aligned_size = 1u << ((u32(countTrailingZeros(spine_size)) + lane_log - 1u) / lane_log * lane_log);
        for(var j = lane_count; j <= aligned_size; j <<= lane_log){
            let i0 = ((threadid.x + offset0) << offset1) - select(0u, 1u, j != lane_count);
            let pred0 = i0 < spine_size;
            let t0 = unsafeSubgroupInclusiveAdd(select(0u, wg_scan[i0], pred0));
            if(pred0){
                wg_scan[i0] = t0;
            }
            workgroupBarrier();

            if(j != lane_count){
                let rshift = j >> lane_log;
                let i1 = threadid.x + rshift;
                if ((i1 & (j - 1u)) >= rshift){
                    let pred1 = i1 < spine_size;
                    let t1 = select(0u, wg_scan[((i1 >> offset1) << offset1) - 1u], pred1);
                    if(pred1 && ((i1 + 1u) & (rshift - 1u)) != 0u){
                        wg_scan[i1] += t1;
                    }
                }
            } else {
                offset0 += 1u;
            }
            offset1 += lane_log;
        }
    }
    workgroupBarrier();

    if (wgid.x != 0u) {
        return;
    }

    let plane_stride = info.thread_blocks * RADIX;
    let pass_index = threadid.x + pass_plane * plane_stride;
    let subgroup_prefix = unsafeSubgroupExclusiveAdd(scan);
    var spine_prefix = 0u;
    if (sid > 0u) {
        spine_prefix = wg_scan[sid - 1u];
    }
    atomicStore(&pass_hist[pass_index], ((subgroup_prefix + spine_prefix) << 2u) | FLAG_INCLUSIVE);
}

var<workgroup> wg_subgroupHist: array<atomic<u32>, WARP_HIST_CAPACITY>;
var<workgroup> wg_localHist: array<u32, RADIX>;
var<workgroup> wg_broadcast: u32;

// Wave16 WLMS: uses ballot.x (32 bits) - only valid for lane_count <= 32
fn WLMS(key: u32, shift: u32, laneid: u32, lane_count: u32, lane_mask_lt: u32, s_offset: u32, key_valid: bool) -> u32 {
    // FIX: Compute valid_mask FIRST to exclude invalid lanes from peer groups.
    // Without this, invalid lanes (key_valid=false) look like "bit=0" lanes during ballot,
    // allowing them to join peer groups with valid keys. If an invalid lane becomes
    // highest_rank_peer, the atomicAdd is skipped (gated by key_valid), causing missing
    // histogram increments → offset collisions → duplicates/missing elements.
    let valid_mask = unsafeSubgroupBallot(key_valid).x;

    var eq_mask = 0xffffffffu;
    for (var k = 0u; k < RADIX_LOG; k += 1u) {
        let curr_bit = 1u << (k + shift);
        let pred = key_valid && ((key & curr_bit) != 0u);
        let ballot = unsafeSubgroupBallot(pred);
        eq_mask &= select(~ballot.x, ballot.x, pred);
    }

    // Remove invalid lanes from the peer group (critical fix for partial last partitions)
    eq_mask &= valid_mask;

    var subgroup_mask = 0xffffffffu;
    if (lane_count != 32u) {
        subgroup_mask = (1u << lane_count) - 1u;
    }
    eq_mask &= subgroup_mask;

    if (!key_valid) {
        eq_mask = 0u;
    }
    var out = countOneBits(eq_mask & lane_mask_lt);
    let highest_rank_peer = select(lane_count - 1u, 31u - countLeadingZeros(eq_mask), eq_mask != 0u);
    var pre_inc = 0u;
    if (key_valid && eq_mask != 0u && laneid == highest_rank_peer) {
        pre_inc = atomicAdd(&wg_subgroupHist[((key >> shift) & RADIX_MASK) + s_offset], out + 1u);
    }
    workgroupBarrier();
    // Call shuffle unconditionally to maintain uniform control flow across subgroup.
    // Divergent subgroup ops (when some lanes skip due to keyValid=false) cause undefined behavior.
    let bcast = unsafeSubgroupShuffle(pre_inc, highest_rank_peer);
    // Only apply it for real keys / real peer groups
    out += select(0u, bcast, eq_mask != 0u);
    return select(0u, out, key_valid);
}

fn fake_wlms(key: u32, shift: u32, laneid: u32, lane_count: u32, lane_mask_lt: u32, s_offset: u32) -> u32 {
    return 0u;
}

@compute @workgroup_size(BLOCK_DIM, 1, 1)
fn onesweep_pass(
    @builtin(local_invocation_id) threadid: vec3<u32>,
    @builtin(subgroup_invocation_id) laneid: u32,
    @builtin(subgroup_size) lane_count: u32) {

    let shift = info.shift;
    let sid = threadid.x / lane_count;

    // CRITICAL: This wave16 shader uses ballot.x (32 bits only) for peer masks.
    // If lane_count > 32, the ballot mask would miss lanes 32+, causing corruption.
    // Also lane_mask_lt = (1u << laneid) - 1u overflows for laneid >= 32.
    if (lane_count > MAX_SUBGROUP_SIZE_W16) {
        if (threadid.x == 0u) {
            status[STATUS_ERR_LANE_COUNT] = 0xDEAD0016u | (lane_count << 16u);
        }
        return;
    }

    let subgroup_hist_size = (BLOCK_DIM / lane_count) * RADIX;
    if (subgroup_hist_size > WARP_HIST_CAPACITY) {
        if (threadid.x == 0u) {
            status[STATUS_ERR_PASS] = 0xDEAD0004u;
        }
        return;
    }

    for (var i = threadid.x; i < subgroup_hist_size; i += BLOCK_DIM) {
        atomicStore(&wg_subgroupHist[i], 0u);
    }
    workgroupBarrier();

    if (threadid.x == 0u) {
        wg_broadcast = atomicAdd(&bump[shift >> 3u], 1u);
    }
    // Explicit barrier to ensure wg_broadcast is visible to all threads
    workgroupBarrier();
    let partid = wg_broadcast;

    var keys = array<u32, KEYS_PER_THREAD>();
    var values = array<u32, KEYS_PER_THREAD>();
    var keyValid = array<bool, KEYS_PER_THREAD>();
    {
        let dev_offset = partid * PART_SIZE;
        let lane_stride = sid * lane_count * KEYS_PER_THREAD;
        var idx = laneid + lane_stride + dev_offset;
        if (partid < info.thread_blocks - 1u) {
            for (var k = 0u; k < KEYS_PER_THREAD; k += 1u) {
                keys[k] = sort[idx];
                values[k] = payload[idx];
                keyValid[k] = true;
                idx += lane_count;
            }
        } else {
            for (var k = 0u; k < KEYS_PER_THREAD; k += 1u) {
                if (idx < info.size) {
                    keys[k] = sort[idx];
                    values[k] = payload[idx];
                    keyValid[k] = true;
                } else {
                    keys[k] = 0xffffffffu;
                    values[k] = 0xffffffffu;
                    keyValid[k] = false;
                }
                idx += lane_count;
            }
        }
    }

    var offsets = array<u32, KEYS_PER_THREAD>();
    {
        let lane_mask_lt = (1u << laneid) - 1u;
        let hist_offset = sid * RADIX;
        for (var k = 0u; k < KEYS_PER_THREAD; k += 1u) {
            offsets[k] = WLMS(keys[k], shift, laneid, lane_count, lane_mask_lt, hist_offset, keyValid[k]);
        }
    }
    workgroupBarrier();

    var local_reduction = 0u;
    if (threadid.x < RADIX) {
        local_reduction = atomicLoad(&wg_subgroupHist[threadid.x]);
        var subtotal = local_reduction;
        for (var i = threadid.x + RADIX; i < subgroup_hist_size; i += RADIX) {
            let current = atomicLoad(&wg_subgroupHist[i]);
            atomicStore(&wg_subgroupHist[i], subtotal);
            subtotal += current;
        }
        local_reduction = subtotal;

        if (partid < info.thread_blocks - 1u) {
            let pass_plane = shift >> 3u;
            let pass_index = threadid.x + pass_plane * info.thread_blocks * RADIX + (partid + 1u) * RADIX;
            atomicStore(&pass_hist[pass_index], (local_reduction << 2u) | FLAG_REDUCTION);
        }

        let lane_mask = lane_count - 1u;
        let circular_lane_shift = (laneid + lane_mask) & lane_mask;
        let t = unsafeSubgroupInclusiveAdd(local_reduction);
        wg_localHist[threadid.x] = unsafeSubgroupShuffle(t, circular_lane_shift);
    }
    workgroupBarrier();

    if (threadid.x < lane_count) {
        let pred = threadid.x < RADIX / lane_count;
        let t = unsafeSubgroupExclusiveAdd(select(0u, wg_localHist[threadid.x * lane_count], pred));
        if (pred) {
            wg_localHist[threadid.x * lane_count] = t;
        }
    }
    workgroupBarrier();

    if (threadid.x < RADIX && laneid != 0u) {
        wg_localHist[threadid.x] += wg_localHist[(threadid.x / lane_count) * lane_count];
    }
    workgroupBarrier();

    for (var k = 0u; k < KEYS_PER_THREAD; k += 1u) {
        if (keyValid[k]) {
            let digit = (keys[k] >> shift) & RADIX_MASK;
            let block_prefix = wg_localHist[digit];
            if (sid == 0u) {
                offsets[k] += block_prefix;
            } else {
                let subgroup_prefix = atomicLoad(&wg_subgroupHist[digit + sid * RADIX]);
                offsets[k] += block_prefix + subgroup_prefix;
            }
        }
    }
    workgroupBarrier();

    if (threadid.x < RADIX) {
        let pass_plane = shift >> 3u;
        let base_plane = pass_plane * info.thread_blocks * RADIX;
        let bin = threadid.x;
        let block_prefix = wg_localHist[bin];
        var prev_reduction = 0u;
        var lookbackid = partid;
        loop {
            let flag_payload = atomicLoad(&pass_hist[bin + base_plane + lookbackid * RADIX]);
            if ((flag_payload & FLAG_MASK) > FLAG_NOT_READY) {
                prev_reduction += flag_payload >> 2u;
                if ((flag_payload & FLAG_MASK) == FLAG_INCLUSIVE) {
                    if (partid < info.thread_blocks - 1u) {
                        let next_idx = bin + base_plane + (partid + 1u) * RADIX;
                        atomicStore(&pass_hist[next_idx], ((prev_reduction + local_reduction) << 2u) | FLAG_INCLUSIVE);
                    }
                    wg_localHist[bin] = prev_reduction - block_prefix;
                    break;
                } else {
                    lookbackid -= 1u;
                }
            }
        }
    }
    workgroupBarrier();

    for (var k = 0u; k < KEYS_PER_THREAD; k += 1u) {
        if (keyValid[k]) {
            let digit = (keys[k] >> shift) & RADIX_MASK;
            let global_offset = wg_localHist[digit] + offsets[k];
            if (global_offset < info.size) {
                alt[global_offset] = keys[k];
                alt_payload[global_offset] = values[k];
            }
        }
    }
}
`,Gl=`
//****************************************************************************
// GPUSorting
// OneSweep - WaveSize 32 variant
//
// SPDX-License-Identifier: MIT
// Copyright Thomas Smith 12/7/2024
// https://github.com/b0nes164/GPUSorting
//
// Modified for WGSL compatibility and variable subgroup sizes by Dino Metarapi, 2025
// Based on original work by Thomas Smith
//****************************************************************************

enable subgroups;

@diagnostic(off, subgroup_uniformity)
fn unsafeSubgroupInclusiveAdd(x: u32) -> u32 { return subgroupInclusiveAdd(x); }

@diagnostic(off, subgroup_uniformity)
fn unsafeSubgroupExclusiveAdd(x: u32) -> u32 { return subgroupExclusiveAdd(x); }

@diagnostic(off, subgroup_uniformity)
fn unsafeSubgroupShuffle(x: u32, source: u32) -> u32 { return subgroupShuffle(x, source); }

@diagnostic(off, subgroup_uniformity)
fn unsafeSubgroupBallot(pred: bool) -> vec4<u32> { return subgroupBallot(pred); }

@diagnostic(off, subgroup_uniformity)
fn unsafeSubgroupAdd(x: u32) -> u32 { return subgroupAdd(x); }

struct InfoStruct
{
    size: u32,
    shift: u32,
    thread_blocks: u32,
    seed: u32,
};

@group(0) @binding(0)
var<uniform> info : InfoStruct;

@group(0) @binding(1)
var<storage, read_write> bump: array<atomic<u32>>;

@group(0) @binding(2)
var<storage, read_write> sort: array<u32>;

@group(0) @binding(3)
var<storage, read_write> alt: array<u32>;

@group(0) @binding(4)
var<storage, read_write> payload: array<u32>;

@group(0) @binding(5)
var<storage, read_write> alt_payload: array<u32>;

@group(0) @binding(6)
var<storage, read_write> hist: array<atomic<u32>>;

@group(0) @binding(7)
var<storage, read_write> pass_hist: array<atomic<u32>>;

@group(0) @binding(8)
var<storage, read_write> status: array<u32>;

const SORT_PASSES = 4u;
const BLOCK_DIM = 256u;
const MIN_SUBGROUP_SIZE = 32u;
const MAX_SUBGROUP_SIZE_W32 = 32u;  // ballot.x is only 32 bits - wave32 max
const MAX_REDUCE_SIZE = BLOCK_DIM / MIN_SUBGROUP_SIZE;

const STATUS_ERR_GLOBAL_HIST = 0u;
const STATUS_ERR_SCAN = 1u;
const STATUS_ERR_PASS = 2u;
const STATUS_ERR_LANE_COUNT = 3u;

const FLAG_NOT_READY = 0u;
const FLAG_REDUCTION = 1u;
const FLAG_INCLUSIVE = 2u;
const FLAG_MASK = 3u;

const RADIX = 256u;
const ALL_RADIX = RADIX * SORT_PASSES;
const RADIX_MASK = 255u;
const RADIX_LOG = 8u;

const KEYS_PER_THREAD = 15u;
const PART_SIZE = KEYS_PER_THREAD * BLOCK_DIM;

const REDUCE_BLOCK_DIM = 128u;
const REDUCE_KEYS_PER_THREAD = 30u;
const REDUCE_HIST_SIZE = REDUCE_BLOCK_DIM / MIN_SUBGROUP_SIZE * ALL_RADIX;
const REDUCE_PART_SIZE = REDUCE_KEYS_PER_THREAD * REDUCE_BLOCK_DIM;

const MAX_SUBGROUPS_PER_BLOCK = BLOCK_DIM / MIN_SUBGROUP_SIZE;
const WARP_HIST_CAPACITY = MAX_SUBGROUPS_PER_BLOCK * RADIX;

var<workgroup> wg_globalHist: array<atomic<u32>, REDUCE_HIST_SIZE>;

@compute @workgroup_size(REDUCE_BLOCK_DIM, 1, 1)
fn global_hist(
    @builtin(local_invocation_id) threadid: vec3<u32>,
    @builtin(subgroup_invocation_id) laneid: u32,
    @builtin(subgroup_size) lane_count: u32,
    @builtin(workgroup_id) wgid: vec3<u32>) {

    if (lane_count < MIN_SUBGROUP_SIZE || (REDUCE_BLOCK_DIM % lane_count) != 0u) {
        if (threadid.x == 0u) {
            status[STATUS_ERR_GLOBAL_HIST] = 0xDEAD0001u;
        }
        return;
    }

    let sid = threadid.x / lane_count;

    //Clear shared memory
    for (var i = threadid.x; i < REDUCE_HIST_SIZE; i += REDUCE_BLOCK_DIM) {
        atomicStore(&wg_globalHist[i], 0u);
    }
    workgroupBarrier();

    let radix_shift = info.shift;
    let hist_offset = sid * ALL_RADIX;
    {
        var i = threadid.x + wgid.x * REDUCE_PART_SIZE;
        if(wgid.x < info.thread_blocks - 1) {
            for (var k = 0u; k < REDUCE_KEYS_PER_THREAD; k += 1u) {
                let key = sort[i];
                atomicAdd(&wg_globalHist[(key & RADIX_MASK) + hist_offset], 1u);
                atomicAdd(&wg_globalHist[((key >> 8u) & RADIX_MASK) + hist_offset + 256u], 1u);
                atomicAdd(&wg_globalHist[((key >> 16u) & RADIX_MASK) + hist_offset + 512u], 1u);
                atomicAdd(&wg_globalHist[((key >> 24u) & RADIX_MASK) + hist_offset + 768u], 1u);
                i += REDUCE_BLOCK_DIM;
            }
        }

        if(wgid.x == info.thread_blocks - 1) {
            for (var k = 0u; k < REDUCE_KEYS_PER_THREAD; k += 1u) {
                if (i < info.size) {
                    let key = sort[i];
                    atomicAdd(&wg_globalHist[(key & RADIX_MASK) + hist_offset], 1u);
                    atomicAdd(&wg_globalHist[((key >> 8u) & RADIX_MASK) + hist_offset + 256u], 1u);
                    atomicAdd(&wg_globalHist[((key >> 16u) & RADIX_MASK) + hist_offset + 512u], 1u);
                    atomicAdd(&wg_globalHist[((key >> 24u) & RADIX_MASK) + hist_offset + 768u], 1u);
                }
                i += REDUCE_BLOCK_DIM;
            }
        }
    }
    workgroupBarrier();

    // Merge subgroup histograms
    let subgroup_histograms = REDUCE_BLOCK_DIM / lane_count;
    for(var i = threadid.x; i < RADIX; i += REDUCE_BLOCK_DIM) {
        var reduction0 = atomicLoad(&wg_globalHist[i]);
        var reduction1 = atomicLoad(&wg_globalHist[i + 256u]);
        var reduction2 = atomicLoad(&wg_globalHist[i + 512u]);
        var reduction3 = atomicLoad(&wg_globalHist[i + 768u]);

        for (var h = 1u; h < subgroup_histograms; h += 1u) {
            let idx = h * ALL_RADIX;
            reduction0 += atomicLoad(&wg_globalHist[i + idx]);
            reduction1 += atomicLoad(&wg_globalHist[i + 256u + idx]);
            reduction2 += atomicLoad(&wg_globalHist[i + 512u + idx]);
            reduction3 += atomicLoad(&wg_globalHist[i + 768u + idx]);
        }

        atomicAdd(&hist[i], reduction0);
        atomicAdd(&hist[i + 256u], reduction1);
        atomicAdd(&hist[i + 512u], reduction2);
        atomicAdd(&hist[i + 768u], reduction3);
    }
}

//Assumes block dim 256
const SCAN_MEM_SIZE = RADIX / MIN_SUBGROUP_SIZE;
var<workgroup> wg_scan: array<u32, SCAN_MEM_SIZE>;
@compute @workgroup_size(BLOCK_DIM, 1, 1)
fn onesweep_scan(
    @builtin(local_invocation_id) threadid: vec3<u32>,
    @builtin(subgroup_invocation_id) laneid: u32,
    @builtin(subgroup_size) lane_count: u32,
    @builtin(workgroup_id) wgid: vec3<u32>) {

    if (lane_count < MIN_SUBGROUP_SIZE || (BLOCK_DIM % lane_count) != 0u) {
        if (threadid.x == 0u) {
            status[STATUS_ERR_SCAN] = 0xDEAD0002u;
        }
        return;
    }

    let sid = threadid.x / lane_count;
    let pass_plane = info.shift >> 3u;
    let hist_index = threadid.x + pass_plane * RADIX;
    let scan = atomicLoad(&hist[hist_index]);
    let red = unsafeSubgroupAdd(scan);
    if(laneid == 0u){
        wg_scan[sid] = red;
    }
    workgroupBarrier();

    //Non-divergent subgroup agnostic inclusive scan across subgroup reductions
    {
        var offset0 = 0u;
        var offset1 = 0u;
        let lane_log = u32(countTrailingZeros(lane_count));
        let spine_size = BLOCK_DIM >> lane_log;
        let aligned_size = 1u << ((u32(countTrailingZeros(spine_size)) + lane_log - 1u) / lane_log * lane_log);
        for(var j = lane_count; j <= aligned_size; j <<= lane_log){
            let i0 = ((threadid.x + offset0) << offset1) - select(0u, 1u, j != lane_count);
            let pred0 = i0 < spine_size;
            let t0 = unsafeSubgroupInclusiveAdd(select(0u, wg_scan[i0], pred0));
            if(pred0){
                wg_scan[i0] = t0;
            }
            workgroupBarrier();

            if(j != lane_count){
                let rshift = j >> lane_log;
                let i1 = threadid.x + rshift;
                if ((i1 & (j - 1u)) >= rshift){
                    let pred1 = i1 < spine_size;
                    let t1 = select(0u, wg_scan[((i1 >> offset1) << offset1) - 1u], pred1);
                    if(pred1 && ((i1 + 1u) & (rshift - 1u)) != 0u){
                        wg_scan[i1] += t1;
                    }
                }
            } else {
                offset0 += 1u;
            }
            offset1 += lane_log;
        }
    }
    workgroupBarrier();

    if (wgid.x != 0u) {
        return;
    }

    let plane_stride = info.thread_blocks * RADIX;
    let pass_index = threadid.x + pass_plane * plane_stride;
    let subgroup_prefix = unsafeSubgroupExclusiveAdd(scan);
    var spine_prefix = 0u;
    if (sid > 0u) {
        spine_prefix = wg_scan[sid - 1u];
    }
    atomicStore(&pass_hist[pass_index], ((subgroup_prefix + spine_prefix) << 2u) | FLAG_INCLUSIVE);
}

var<workgroup> wg_subgroupHist: array<atomic<u32>, WARP_HIST_CAPACITY>;
var<workgroup> wg_localHist: array<u32, RADIX>;
var<workgroup> wg_broadcast: u32;

// Wave32 WLMS: uses ballot.x (32 bits) - only valid for lane_count <= 32
fn WLMS(key: u32, shift: u32, laneid: u32, lane_count: u32, lane_mask_lt: u32, s_offset: u32, key_valid: bool) -> u32 {
    // FIX: Compute valid_mask FIRST to exclude invalid lanes from peer groups.
    // Without this, invalid lanes (key_valid=false) look like "bit=0" lanes during ballot,
    // allowing them to join peer groups with valid keys. If an invalid lane becomes
    // highest_rank_peer, the atomicAdd is skipped (gated by key_valid), causing missing
    // histogram increments → offset collisions → duplicates/missing elements.
    let valid_mask = unsafeSubgroupBallot(key_valid).x;

    var eq_mask = 0xffffffffu;
    for (var k = 0u; k < RADIX_LOG; k += 1u) {
        let curr_bit = 1u << (k + shift);
        let pred = key_valid && ((key & curr_bit) != 0u);
        let ballot = unsafeSubgroupBallot(pred);
        eq_mask &= select(~ballot.x, ballot.x, pred);
    }

    // Remove invalid lanes from the peer group (critical fix for partial last partitions)
    eq_mask &= valid_mask;

    var subgroup_mask = 0xffffffffu;
    if (lane_count != 32u) {
        subgroup_mask = (1u << lane_count) - 1u;
    }
    eq_mask &= subgroup_mask;

    if (!key_valid) {
        eq_mask = 0u;
    }
    var out = countOneBits(eq_mask & lane_mask_lt);
    let highest_rank_peer = select(lane_count - 1u, 31u - countLeadingZeros(eq_mask), eq_mask != 0u);
    var pre_inc = 0u;
    if (key_valid && eq_mask != 0u && laneid == highest_rank_peer) {
        pre_inc = atomicAdd(&wg_subgroupHist[((key >> shift) & RADIX_MASK) + s_offset], out + 1u);
    }
    workgroupBarrier();
    // Call shuffle unconditionally to maintain uniform control flow across subgroup.
    // Divergent subgroup ops (when some lanes skip due to keyValid=false) cause undefined behavior.
    let bcast = unsafeSubgroupShuffle(pre_inc, highest_rank_peer);
    // Only apply it for real keys / real peer groups
    out += select(0u, bcast, eq_mask != 0u);
    return select(0u, out, key_valid);
}

fn fake_wlms(key: u32, shift: u32, laneid: u32, lane_count: u32, lane_mask_lt: u32, s_offset: u32) -> u32 {
    return 0u;
}

@compute @workgroup_size(BLOCK_DIM, 1, 1)
fn onesweep_pass(
    @builtin(local_invocation_id) threadid: vec3<u32>,
    @builtin(subgroup_invocation_id) laneid: u32,
    @builtin(subgroup_size) lane_count: u32) {

    let shift = info.shift;
    let sid = threadid.x / lane_count;

    // CRITICAL: This wave32 shader uses ballot.x (32 bits only) for peer masks.
    // If lane_count > 32, the ballot mask would miss lanes 32+, causing corruption.
    // Also lane_mask_lt = (1u << laneid) - 1u overflows for laneid >= 32.
    if (lane_count > MAX_SUBGROUP_SIZE_W32) {
        if (threadid.x == 0u) {
            status[STATUS_ERR_LANE_COUNT] = 0xDEAD0032u | (lane_count << 16u);
        }
        return;
    }

    let subgroup_hist_size = (BLOCK_DIM / lane_count) * RADIX;
    if (subgroup_hist_size > WARP_HIST_CAPACITY) {
        if (threadid.x == 0u) {
            status[STATUS_ERR_PASS] = 0xDEAD0004u;
        }
        return;
    }

    for (var i = threadid.x; i < subgroup_hist_size; i += BLOCK_DIM) {
        atomicStore(&wg_subgroupHist[i], 0u);
    }
    workgroupBarrier();

    if (threadid.x == 0u) {
        wg_broadcast = atomicAdd(&bump[shift >> 3u], 1u);
    }
    // Explicit barrier to ensure wg_broadcast is visible to all threads
    workgroupBarrier();
    let partid = wg_broadcast;

    var keys = array<u32, KEYS_PER_THREAD>();
    var values = array<u32, KEYS_PER_THREAD>();
    var keyValid = array<bool, KEYS_PER_THREAD>();
    {
        let dev_offset = partid * PART_SIZE;
        let lane_stride = sid * lane_count * KEYS_PER_THREAD;
        var idx = laneid + lane_stride + dev_offset;
        if (partid < info.thread_blocks - 1u) {
            for (var k = 0u; k < KEYS_PER_THREAD; k += 1u) {
                keys[k] = sort[idx];
                values[k] = payload[idx];
                keyValid[k] = true;
                idx += lane_count;
            }
        } else {
            for (var k = 0u; k < KEYS_PER_THREAD; k += 1u) {
                if (idx < info.size) {
                    keys[k] = sort[idx];
                    values[k] = payload[idx];
                    keyValid[k] = true;
                } else {
                    keys[k] = 0xffffffffu;
                    values[k] = 0xffffffffu;
                    keyValid[k] = false;
                }
                idx += lane_count;
            }
        }
    }

    var offsets = array<u32, KEYS_PER_THREAD>();
    {
        let lane_mask_lt = (1u << laneid) - 1u;
        let hist_offset = sid * RADIX;
        for (var k = 0u; k < KEYS_PER_THREAD; k += 1u) {
            offsets[k] = WLMS(keys[k], shift, laneid, lane_count, lane_mask_lt, hist_offset, keyValid[k]);
        }
    }
    workgroupBarrier();

    var local_reduction = 0u;
    if (threadid.x < RADIX) {
        local_reduction = atomicLoad(&wg_subgroupHist[threadid.x]);
        var subtotal = local_reduction;
        for (var i = threadid.x + RADIX; i < subgroup_hist_size; i += RADIX) {
            let current = atomicLoad(&wg_subgroupHist[i]);
            atomicStore(&wg_subgroupHist[i], subtotal);
            subtotal += current;
        }
        local_reduction = subtotal;

        if (partid < info.thread_blocks - 1u) {
            let pass_plane = shift >> 3u;
            let pass_index = threadid.x + pass_plane * info.thread_blocks * RADIX + (partid + 1u) * RADIX;
            atomicStore(&pass_hist[pass_index], (local_reduction << 2u) | FLAG_REDUCTION);
        }

        let lane_mask = lane_count - 1u;
        let circular_lane_shift = (laneid + lane_mask) & lane_mask;
        let t = unsafeSubgroupInclusiveAdd(local_reduction);
        wg_localHist[threadid.x] = unsafeSubgroupShuffle(t, circular_lane_shift);
    }
    workgroupBarrier();

    if (threadid.x < lane_count) {
        let pred = threadid.x < RADIX / lane_count;
        let t = unsafeSubgroupExclusiveAdd(select(0u, wg_localHist[threadid.x * lane_count], pred));
        if (pred) {
            wg_localHist[threadid.x * lane_count] = t;
        }
    }
    workgroupBarrier();

    if (threadid.x < RADIX && laneid != 0u) {
        wg_localHist[threadid.x] += wg_localHist[(threadid.x / lane_count) * lane_count];
    }
    workgroupBarrier();

    for (var k = 0u; k < KEYS_PER_THREAD; k += 1u) {
        if (keyValid[k]) {
            let digit = (keys[k] >> shift) & RADIX_MASK;
            let block_prefix = wg_localHist[digit];
            if (sid == 0u) {
                offsets[k] += block_prefix;
            } else {
                let subgroup_prefix = atomicLoad(&wg_subgroupHist[digit + sid * RADIX]);
                offsets[k] += block_prefix + subgroup_prefix;
            }
        }
    }
    workgroupBarrier();

    if (threadid.x < RADIX) {
        let pass_plane = shift >> 3u;
        let base_plane = pass_plane * info.thread_blocks * RADIX;
        let bin = threadid.x;
        let block_prefix = wg_localHist[bin];
        var prev_reduction = 0u;
        var lookbackid = partid;
        loop {
            let flag_payload = atomicLoad(&pass_hist[bin + base_plane + lookbackid * RADIX]);
            if ((flag_payload & FLAG_MASK) > FLAG_NOT_READY) {
                prev_reduction += flag_payload >> 2u;
                if ((flag_payload & FLAG_MASK) == FLAG_INCLUSIVE) {
                    if (partid < info.thread_blocks - 1u) {
                        let next_idx = bin + base_plane + (partid + 1u) * RADIX;
                        atomicStore(&pass_hist[next_idx], ((prev_reduction + local_reduction) << 2u) | FLAG_INCLUSIVE);
                    }
                    wg_localHist[bin] = prev_reduction - block_prefix;
                    break;
                } else {
                    lookbackid -= 1u;
                }
            }
        }
    }
    workgroupBarrier();

    for (var k = 0u; k < KEYS_PER_THREAD; k += 1u) {
        if (keyValid[k]) {
            let digit = (keys[k] >> shift) & RADIX_MASK;
            let global_offset = wg_localHist[digit] + offsets[k];
            if (global_offset < info.size) {
                alt[global_offset] = keys[k];
                alt_payload[global_offset] = values[k];
            }
        }
    }
}
`,Kl=`
//****************************************************************************
// GPUSorting
// OneSweep - WaveSize 64 variant
//
// SPDX-License-Identifier: MIT
// Copyright Thomas Smith 12/7/2024
// https://github.com/b0nes164/GPUSorting
//
// Modified for WGSL compatibility and variable subgroup sizes by Dino Metarapi, 2025
// Based on original work by Thomas Smith
//****************************************************************************

enable subgroups;

@diagnostic(off, subgroup_uniformity)
fn unsafeSubgroupInclusiveAdd(x: u32) -> u32 { return subgroupInclusiveAdd(x); }

@diagnostic(off, subgroup_uniformity)
fn unsafeSubgroupExclusiveAdd(x: u32) -> u32 { return subgroupExclusiveAdd(x); }

@diagnostic(off, subgroup_uniformity)
fn unsafeSubgroupShuffle(x: u32, source: u32) -> u32 { return subgroupShuffle(x, source); }

@diagnostic(off, subgroup_uniformity)
fn unsafeSubgroupBallot(pred: bool) -> vec4<u32> { return subgroupBallot(pred); }

@diagnostic(off, subgroup_uniformity)
fn unsafeSubgroupAdd(x: u32) -> u32 { return subgroupAdd(x); }

struct InfoStruct
{
    size: u32,
    shift: u32,
    thread_blocks: u32,
    seed: u32,
};

@group(0) @binding(0)
var<uniform> info : InfoStruct;

@group(0) @binding(1)
var<storage, read_write> bump: array<atomic<u32>>;

@group(0) @binding(2)
var<storage, read_write> sort: array<u32>;

@group(0) @binding(3)
var<storage, read_write> alt: array<u32>;

@group(0) @binding(4)
var<storage, read_write> payload: array<u32>;

@group(0) @binding(5)
var<storage, read_write> alt_payload: array<u32>;

@group(0) @binding(6)
var<storage, read_write> hist: array<atomic<u32>>;

@group(0) @binding(7)
var<storage, read_write> pass_hist: array<atomic<u32>>;

@group(0) @binding(8)
var<storage, read_write> status: array<u32>;

const SORT_PASSES = 4u;
const BLOCK_DIM = 256u;
const MIN_SUBGROUP_SIZE = 64u;
const MAX_REDUCE_SIZE = BLOCK_DIM / MIN_SUBGROUP_SIZE;

const STATUS_ERR_GLOBAL_HIST = 0u;
const STATUS_ERR_SCAN = 1u;
const STATUS_ERR_PASS = 2u;

const FLAG_NOT_READY = 0u;
const FLAG_REDUCTION = 1u;
const FLAG_INCLUSIVE = 2u;
const FLAG_MASK = 3u;

const RADIX = 256u;
const ALL_RADIX = RADIX * SORT_PASSES;
const RADIX_MASK = 255u;
const RADIX_LOG = 8u;

const KEYS_PER_THREAD = 15u;
const PART_SIZE = KEYS_PER_THREAD * BLOCK_DIM;

const REDUCE_BLOCK_DIM = 128u;
const REDUCE_KEYS_PER_THREAD = 30u;
const REDUCE_HIST_SIZE = REDUCE_BLOCK_DIM / MIN_SUBGROUP_SIZE * ALL_RADIX;
const REDUCE_PART_SIZE = REDUCE_KEYS_PER_THREAD * REDUCE_BLOCK_DIM;

const MAX_SUBGROUPS_PER_BLOCK = BLOCK_DIM / MIN_SUBGROUP_SIZE;
const WARP_HIST_CAPACITY = MAX_SUBGROUPS_PER_BLOCK * RADIX;

var<workgroup> wg_globalHist: array<atomic<u32>, REDUCE_HIST_SIZE>;

@compute @workgroup_size(REDUCE_BLOCK_DIM, 1, 1)
fn global_hist(
    @builtin(local_invocation_id) threadid: vec3<u32>,
    @builtin(subgroup_invocation_id) laneid: u32,
    @builtin(subgroup_size) lane_count: u32,
    @builtin(workgroup_id) wgid: vec3<u32>) {

    if (lane_count < MIN_SUBGROUP_SIZE || (REDUCE_BLOCK_DIM % lane_count) != 0u) {
        if (threadid.x == 0u) {
            status[STATUS_ERR_GLOBAL_HIST] = 0xDEAD0001u;
        }
        return;
    }

    let sid = threadid.x / lane_count;

    //Clear shared memory
    for (var i = threadid.x; i < REDUCE_HIST_SIZE; i += REDUCE_BLOCK_DIM) {
        atomicStore(&wg_globalHist[i], 0u);
    }
    workgroupBarrier();

    let radix_shift = info.shift;
    let hist_offset = sid * ALL_RADIX;
    {
        var i = threadid.x + wgid.x * REDUCE_PART_SIZE;
        if(wgid.x < info.thread_blocks - 1u) {
            for (var k = 0u; k < REDUCE_KEYS_PER_THREAD; k += 1u) {
                let key = sort[i];
                atomicAdd(&wg_globalHist[(key & RADIX_MASK) + hist_offset], 1u);
                atomicAdd(&wg_globalHist[((key >> 8u) & RADIX_MASK) + hist_offset + 256u], 1u);
                atomicAdd(&wg_globalHist[((key >> 16u) & RADIX_MASK) + hist_offset + 512u], 1u);
                atomicAdd(&wg_globalHist[((key >> 24u) & RADIX_MASK) + hist_offset + 768u], 1u);
                i += REDUCE_BLOCK_DIM;
            }
        }

        if(wgid.x == info.thread_blocks - 1u) {
            for (var k = 0u; k < REDUCE_KEYS_PER_THREAD; k += 1u) {
                if (i < info.size) {
                    let key = sort[i];
                    atomicAdd(&wg_globalHist[(key & RADIX_MASK) + hist_offset], 1u);
                    atomicAdd(&wg_globalHist[((key >> 8u) & RADIX_MASK) + hist_offset + 256u], 1u);
                    atomicAdd(&wg_globalHist[((key >> 16u) & RADIX_MASK) + hist_offset + 512u], 1u);
                    atomicAdd(&wg_globalHist[((key >> 24u) & RADIX_MASK) + hist_offset + 768u], 1u);
                }
                i += REDUCE_BLOCK_DIM;
            }
        }
    }
    workgroupBarrier();

    // Merge subgroup histograms
    let subgroup_histograms = REDUCE_BLOCK_DIM / lane_count;
    for(var i = threadid.x; i < RADIX; i += REDUCE_BLOCK_DIM) {
        var reduction0 = atomicLoad(&wg_globalHist[i]);
        var reduction1 = atomicLoad(&wg_globalHist[i + 256u]);
        var reduction2 = atomicLoad(&wg_globalHist[i + 512u]);
        var reduction3 = atomicLoad(&wg_globalHist[i + 768u]);

        for (var h = 1u; h < subgroup_histograms; h += 1u) {
            let idx = h * ALL_RADIX;
            reduction0 += atomicLoad(&wg_globalHist[i + idx]);
            reduction1 += atomicLoad(&wg_globalHist[i + 256u + idx]);
            reduction2 += atomicLoad(&wg_globalHist[i + 512u + idx]);
            reduction3 += atomicLoad(&wg_globalHist[i + 768u + idx]);
        }

        atomicAdd(&hist[i], reduction0);
        atomicAdd(&hist[i + 256u], reduction1);
        atomicAdd(&hist[i + 512u], reduction2);
        atomicAdd(&hist[i + 768u], reduction3);
    }
}

//Assumes block dim 256
const SCAN_MEM_SIZE = RADIX / MIN_SUBGROUP_SIZE;
var<workgroup> wg_scan: array<u32, SCAN_MEM_SIZE>;
@compute @workgroup_size(BLOCK_DIM, 1, 1)
fn onesweep_scan(
    @builtin(local_invocation_id) threadid: vec3<u32>,
    @builtin(subgroup_invocation_id) laneid: u32,
    @builtin(subgroup_size) lane_count: u32,
    @builtin(workgroup_id) wgid: vec3<u32>) {

    if (lane_count < MIN_SUBGROUP_SIZE || (BLOCK_DIM % lane_count) != 0u) {
        if (threadid.x == 0u) {
            status[STATUS_ERR_SCAN] = 0xDEAD0002u;
        }
        return;
    }

    let sid = threadid.x / lane_count;
    let pass_plane = info.shift >> 3u;
    let hist_index = threadid.x + pass_plane * RADIX;
    let scan = atomicLoad(&hist[hist_index]);
    let red = unsafeSubgroupAdd(scan);
    if(laneid == 0u){
        wg_scan[sid] = red;
    }
    workgroupBarrier();

    //Non-divergent subgroup agnostic inclusive scan across subgroup reductions
    {
        var offset0 = 0u;
        var offset1 = 0u;
        let lane_log = u32(countTrailingZeros(lane_count));
        let spine_size = BLOCK_DIM >> lane_log;
        let aligned_size = 1u << ((u32(countTrailingZeros(spine_size)) + lane_log - 1u) / lane_log * lane_log);
        for(var j = lane_count; j <= aligned_size; j <<= lane_log){
            let i0 = ((threadid.x + offset0) << offset1) - select(0u, 1u, j != lane_count);
            let pred0 = i0 < spine_size;
            let t0 = unsafeSubgroupInclusiveAdd(select(0u, wg_scan[i0], pred0));
            if(pred0){
                wg_scan[i0] = t0;
            }
            workgroupBarrier();

            if(j != lane_count){
                let rshift = j >> lane_log;
                let i1 = threadid.x + rshift;
                if ((i1 & (j - 1u)) >= rshift){
                    let pred1 = i1 < spine_size;
                    let t1 = select(0u, wg_scan[((i1 >> offset1) << offset1) - 1u], pred1);
                    if(pred1 && ((i1 + 1u) & (rshift - 1u)) != 0u){
                        wg_scan[i1] += t1;
                    }
                }
            } else {
                offset0 += 1u;
            }
            offset1 += lane_log;
        }
    }
    workgroupBarrier();

    if (wgid.x != 0u) {
        return;
    }

    let plane_stride = info.thread_blocks * RADIX;
    let pass_index = threadid.x + pass_plane * plane_stride;
    let subgroup_prefix = unsafeSubgroupExclusiveAdd(scan);
    var spine_prefix = 0u;
    if (sid > 0u) {
        spine_prefix = wg_scan[sid - 1u];
    }
    atomicStore(&pass_hist[pass_index], ((subgroup_prefix + spine_prefix) << 2u) | FLAG_INCLUSIVE);
}

var<workgroup> wg_subgroupHist: array<atomic<u32>, WARP_HIST_CAPACITY>;
var<workgroup> wg_localHist: array<u32, RADIX>;
var<workgroup> wg_broadcast: u32;

fn lowMask(bits: u32) -> u32 {
    if (bits == 0u) {
        return 0u;
    }
    if (bits >= 32u) {
        return 0xffffffffu;
    }
    return (1u << bits) - 1u;
}

fn laneMaskLessThan(laneid: u32) -> vec4<u32> {
    if (laneid >= 32u) {
        return vec4<u32>(0xffffffffu, lowMask(laneid - 32u), 0u, 0u);
    }
    return vec4<u32>(lowMask(laneid), 0u, 0u, 0u);
}

fn subgroupMaskForSize(size: u32) -> vec4<u32> {
    if (size <= 32u) {
        return vec4<u32>(lowMask(size), 0u, 0u, 0u);
    }
    return vec4<u32>(0xffffffffu, lowMask(size - 32u), 0u, 0u);
}

fn maskAnd(a: vec4<u32>, b: vec4<u32>) -> vec4<u32> {
    return vec4<u32>(a.x & b.x, a.y & b.y, 0u, 0u);
}

fn maskFilter(ballot: vec4<u32>, pred: bool) -> vec4<u32> {
    let keep = vec4<u32>(ballot.x, ballot.y, 0u, 0u);
    let reject = vec4<u32>(~ballot.x, ~ballot.y, 0u, 0u);
    let cond = vec4<bool>(pred, pred, pred, pred);
    return select(reject, keep, cond);
}

fn maskBitCount(mask: vec4<u32>) -> u32 {
    return countOneBits(mask.x) + countOneBits(mask.y);
}

fn maskHasBits(mask: vec4<u32>) -> bool {
    return (mask.x | mask.y) != 0u;
}

fn maskHighestLane(mask: vec4<u32>) -> u32 {
    if (mask.y != 0u) {
        return 32u + (31u - countLeadingZeros(mask.y));
    }
    return 31u - countLeadingZeros(mask.x);
}

fn WLMS(key: u32, shift: u32, laneid: u32, lane_count: u32, s_offset: u32, key_valid: bool) -> u32 {
    // FIX: Compute valid_mask FIRST to exclude invalid lanes from peer groups.
    // Without this, invalid lanes (key_valid=false) look like "bit=0" lanes during ballot,
    // allowing them to join peer groups with valid keys. If an invalid lane becomes
    // highest_rank_peer, the atomicAdd is skipped (gated by key_valid), causing missing
    // histogram increments → offset collisions → duplicates/missing elements.
    let valid_ballot = unsafeSubgroupBallot(key_valid);
    let valid_mask = vec4<u32>(valid_ballot.x, valid_ballot.y, 0u, 0u);

    var eq_mask = vec4<u32>(0xffffffffu, 0xffffffffu, 0u, 0u);
    for (var k = 0u; k < RADIX_LOG; k += 1u) {
        let curr_bit = 1u << (k + shift);
        let pred = key_valid && ((key & curr_bit) != 0u);
        let ballot = unsafeSubgroupBallot(pred);
        eq_mask = maskAnd(eq_mask, maskFilter(ballot, pred));
    }

    // Remove invalid lanes from the peer group (critical fix for partial last partitions)
    eq_mask = maskAnd(eq_mask, valid_mask);

    if (!key_valid) {
        eq_mask = vec4<u32>(0u);
    }
    eq_mask = maskAnd(eq_mask, subgroupMaskForSize(lane_count));
    let lane_mask_lt = laneMaskLessThan(laneid);
    var out = maskBitCount(maskAnd(eq_mask, lane_mask_lt));
    let has_peers = maskHasBits(eq_mask);
    let highest_rank_peer = select(lane_count - 1u, maskHighestLane(eq_mask), has_peers);
    var pre_inc = 0u;
    if (key_valid && has_peers && laneid == highest_rank_peer) {
        pre_inc = atomicAdd(&wg_subgroupHist[((key >> shift) & RADIX_MASK) + s_offset], out + 1u);
    }
    workgroupBarrier();
    // Call shuffle unconditionally to maintain uniform control flow across subgroup.
    // Divergent subgroup ops (when some lanes skip due to keyValid=false) cause undefined behavior.
    let bcast = unsafeSubgroupShuffle(pre_inc, highest_rank_peer);
    // Only apply it for real keys / real peer groups
    out += select(0u, bcast, has_peers);
    return select(0u, out, key_valid);
}

fn fake_wlms(key: u32, shift: u32, laneid: u32, lane_count: u32, s_offset: u32) -> u32 {
    return 0u;
}

@compute @workgroup_size(BLOCK_DIM, 1, 1)
fn onesweep_pass(
    @builtin(local_invocation_id) threadid: vec3<u32>,
    @builtin(subgroup_invocation_id) laneid: u32,
    @builtin(subgroup_size) lane_count: u32) {

    let shift = info.shift;
    let sid = threadid.x / lane_count;

    let subgroup_hist_size = (BLOCK_DIM / lane_count) * RADIX;
    if (subgroup_hist_size > WARP_HIST_CAPACITY) {
        if (threadid.x == 0u) {
            status[STATUS_ERR_PASS] = 0xDEAD0004u;
        }
        return;
    }

    for (var i = threadid.x; i < subgroup_hist_size; i += BLOCK_DIM) {
        atomicStore(&wg_subgroupHist[i], 0u);
    }
    workgroupBarrier();

    if (threadid.x == 0u) {
        wg_broadcast = atomicAdd(&bump[shift >> 3u], 1u);
    }
    // Explicit barrier to ensure wg_broadcast is visible to all threads
    workgroupBarrier();
    let partid = wg_broadcast;

    var keys = array<u32, KEYS_PER_THREAD>();
    var values = array<u32, KEYS_PER_THREAD>();
    var keyValid = array<bool, KEYS_PER_THREAD>();
    {
        let dev_offset = partid * PART_SIZE;
        let lane_stride = sid * lane_count * KEYS_PER_THREAD;
        var idx = laneid + lane_stride + dev_offset;
        if (partid < info.thread_blocks - 1u) {
            for (var k = 0u; k < KEYS_PER_THREAD; k += 1u) {
                keys[k] = sort[idx];
                values[k] = payload[idx];
                keyValid[k] = true;
                idx += lane_count;
            }
        } else {
            for (var k = 0u; k < KEYS_PER_THREAD; k += 1u) {
                if (idx < info.size) {
                    keys[k] = sort[idx];
                    values[k] = payload[idx];
                    keyValid[k] = true;
                } else {
                    keys[k] = 0xffffffffu;
                    values[k] = 0xffffffffu;
                    keyValid[k] = false;
                }
                idx += lane_count;
            }
        }
    }

    var offsets = array<u32, KEYS_PER_THREAD>();
    {
        let hist_offset = sid * RADIX;
        for (var k = 0u; k < KEYS_PER_THREAD; k += 1u) {
            offsets[k] = WLMS(keys[k], shift, laneid, lane_count, hist_offset, keyValid[k]);
        }
    }
    workgroupBarrier();

    var local_reduction = 0u;
    if (threadid.x < RADIX) {
        local_reduction = atomicLoad(&wg_subgroupHist[threadid.x]);
        var subtotal = local_reduction;
        for (var i = threadid.x + RADIX; i < subgroup_hist_size; i += RADIX) {
            let current = atomicLoad(&wg_subgroupHist[i]);
            atomicStore(&wg_subgroupHist[i], subtotal);
            subtotal += current;
        }
        local_reduction = subtotal;

        if (partid < info.thread_blocks - 1u) {
            let pass_plane = shift >> 3u;
            let pass_index = threadid.x + pass_plane * info.thread_blocks * RADIX + (partid + 1u) * RADIX;
            atomicStore(&pass_hist[pass_index], (local_reduction << 2u) | FLAG_REDUCTION);
        }

        let lane_mask = lane_count - 1u;
        let circular_lane_shift = (laneid + lane_mask) & lane_mask;
        let t = unsafeSubgroupInclusiveAdd(local_reduction);
        wg_localHist[threadid.x] = unsafeSubgroupShuffle(t, circular_lane_shift);
    }
    workgroupBarrier();

    if (threadid.x < lane_count) {
        let pred = threadid.x < RADIX / lane_count;
        let t = unsafeSubgroupExclusiveAdd(select(0u, wg_localHist[threadid.x * lane_count], pred));
        if (pred) {
            wg_localHist[threadid.x * lane_count] = t;
        }
    }
    workgroupBarrier();

    if (threadid.x < RADIX && laneid != 0u) {
        wg_localHist[threadid.x] += wg_localHist[(threadid.x / lane_count) * lane_count];
    }
    workgroupBarrier();

    for (var k = 0u; k < KEYS_PER_THREAD; k += 1u) {
        if (keyValid[k]) {
            let digit = (keys[k] >> shift) & RADIX_MASK;
            let block_prefix = wg_localHist[digit];
            if (sid == 0u) {
                offsets[k] += block_prefix;
            } else {
                let subgroup_prefix = atomicLoad(&wg_subgroupHist[digit + sid * RADIX]);
                offsets[k] += block_prefix + subgroup_prefix;
            }
        }
    }
    workgroupBarrier();

    if (threadid.x < RADIX) {
        let pass_plane = shift >> 3u;
        let base_plane = pass_plane * info.thread_blocks * RADIX;
        let bin = threadid.x;
        let block_prefix = wg_localHist[bin];
        var prev_reduction = 0u;
        var lookbackid = partid;
        loop {
            let flag_payload = atomicLoad(&pass_hist[bin + base_plane + lookbackid * RADIX]);
            if ((flag_payload & FLAG_MASK) > FLAG_NOT_READY) {
                prev_reduction += flag_payload >> 2u;
                if ((flag_payload & FLAG_MASK) == FLAG_INCLUSIVE) {
                    if (partid < info.thread_blocks - 1u) {
                        let next_idx = bin + base_plane + (partid + 1u) * RADIX;
                        atomicStore(&pass_hist[next_idx], ((prev_reduction + local_reduction) << 2u) | FLAG_INCLUSIVE);
                    }
                    wg_localHist[bin] = prev_reduction - block_prefix;
                    break;
                } else {
                    lookbackid -= 1u;
                }
            }
        }
    }
    workgroupBarrier();

    for (var k = 0u; k < KEYS_PER_THREAD; k += 1u) {
        if (keyValid[k]) {
            let digit = (keys[k] >> shift) & RADIX_MASK;
            let global_offset = wg_localHist[digit] + offsets[k];
            if (global_offset < info.size) {
                alt[global_offset] = keys[k];
                alt_payload[global_offset] = values[k];
            }
        }
    }
}
`,ql=`
enable subgroups;

@group(0) @binding(0)
var<storage, read_write> outSize : array<u32, 1>;

@compute @workgroup_size(1)
fn main(@builtin(subgroup_size) subgroupSize : u32) {
    outSize[0] = subgroupSize;
}
`,Jl=4,Yl=256,Xl=256,Zl=8,Ql=15,$l=128,eu=30,tu=4,nu=class extends Ul{constructor(e){super(e),this.name=`OneSweep`,this._pipelines=null,this._buffers=null,this._bindGroupLayout=null,this._maxKeys=0,this._subgroupSize=0,this._shaderVariantLabel=``,this._sortBindGroups={even:null,odd:null,keysIn:null,valsIn:null},this.blockDim=Yl,this.reduceBlockDim=$l,this.partSize=this.blockDim*Ql,this.reducePartSize=this.reduceBlockDim*eu,this._flagInclusiveBlock=new Uint32Array(Xl),this._flagInclusiveBlock.fill(2),this._infoUploadData=new Uint32Array(Jl*4)}async init(e){this._maxKeys=e;let t=this.device,n=await this._detectSubgroupSize(),{shaderSource:r,label:i}=this._selectShaderVariant(n);this._shaderVariantLabel=i;let a=t.createShaderModule({label:`OneSweep Shader (${i})`,code:r}),o=await a.getCompilationInfo();for(let e of o.messages)if(e.type===`error`)throw Error(`OneSweep shader compilation error: ${e.message} at line ${e.lineNum}`);this._bindGroupLayout=t.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.COMPUTE,buffer:{type:`uniform`}},{binding:1,visibility:GPUShaderStage.COMPUTE,buffer:{type:`storage`}},{binding:2,visibility:GPUShaderStage.COMPUTE,buffer:{type:`storage`}},{binding:3,visibility:GPUShaderStage.COMPUTE,buffer:{type:`storage`}},{binding:4,visibility:GPUShaderStage.COMPUTE,buffer:{type:`storage`}},{binding:5,visibility:GPUShaderStage.COMPUTE,buffer:{type:`storage`}},{binding:6,visibility:GPUShaderStage.COMPUTE,buffer:{type:`storage`}},{binding:7,visibility:GPUShaderStage.COMPUTE,buffer:{type:`storage`}},{binding:8,visibility:GPUShaderStage.COMPUTE,buffer:{type:`storage`}}]});let s=t.createPipelineLayout({bindGroupLayouts:[this._bindGroupLayout]});this._pipelines={globalHist:t.createComputePipeline({layout:s,compute:{module:a,entryPoint:`global_hist`}}),scan:t.createComputePipeline({layout:s,compute:{module:a,entryPoint:`onesweep_scan`}}),pass:t.createComputePipeline({layout:s,compute:{module:a,entryPoint:`onesweep_pass`}})},this._createBuffers(e),this._initialized=!0}_createBuffers(e){let t=this.device,n=Math.ceil(e/this.partSize);if(this._buffers)for(let e in this._buffers)this._buffers[e]?.destroy();this._buffers={altKeys:t.createBuffer({label:`LBVH OneSweep AltKeys`,size:Math.max(16,e*4),usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST|GPUBufferUsage.COPY_SRC}),altVals:t.createBuffer({label:`LBVH OneSweep AltVals`,size:Math.max(16,e*4),usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST|GPUBufferUsage.COPY_SRC}),bump:t.createBuffer({label:`LBVH OneSweep Bump`,size:20,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST}),hist:t.createBuffer({label:`LBVH OneSweep Hist`,size:Xl*Jl*4,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST}),passHist:t.createBuffer({label:`LBVH OneSweep PassHist`,size:n*Xl*Jl*4,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST}),status:t.createBuffer({label:`LBVH OneSweep Status`,size:tu*4,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC|GPUBufferUsage.COPY_DST}),info:t.createBuffer({label:`LBVH OneSweep Info`,size:16,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}),infoUpload:t.createBuffer({label:`LBVH OneSweep InfoUpload`,size:16*Jl,usage:GPUBufferUsage.COPY_SRC|GPUBufferUsage.COPY_DST}),flagInclusiveStaging:t.createBuffer({label:`LBVH OneSweep FlagInclusiveStaging`,size:Xl*Jl*4,usage:GPUBufferUsage.COPY_SRC|GPUBufferUsage.COPY_DST})};let r=Xl*4;for(let e=0;e<Jl;e++)t.queue.writeBuffer(this._buffers.flagInclusiveStaging,e*r,this._flagInclusiveBlock);this._sortBindGroups.even=null,this._sortBindGroups.odd=null,this._sortBindGroups.keysIn=null,this._sortBindGroups.valsIn=null}sort(e){let{commandEncoder:t,keysIn:n,valsIn:r,count:i,timing:a}=e,o=this.device;i>this._maxKeys&&(this._maxKeys=i,this._createBuffers(i));let s=Math.ceil(i/this.partSize);t.clearBuffer(this._buffers.bump),t.clearBuffer(this._buffers.hist),t.clearBuffer(this._buffers.status),t.clearBuffer(this._buffers.passHist);let c=s*Xl*4,l=Xl*4;for(let e=0;e<Jl;e++)t.copyBufferToBuffer(this._buffers.flagInclusiveStaging,e*l,this._buffers.passHist,e*c,l);for(let e=0;e<Jl;e++){let t=e*4;this._infoUploadData[t+0]=i,this._infoUploadData[t+1]=e*Zl,this._infoUploadData[t+2]=s,this._infoUploadData[t+3]=0}o.queue.writeBuffer(this._buffers.infoUpload,0,this._infoUploadData),this._ensureSortBindGroups(n,r);for(let e=0;e<Jl;e++){t.copyBufferToBuffer(this._buffers.infoUpload,e*16,this._buffers.info,0,16);let n=e%2==0?this._sortBindGroups.even:this._sortBindGroups.odd,r={},o=e===0,c=e===Jl-1;a&&(o&&a.beginIndex!==void 0||c&&a.endIndex!==void 0)&&(r.timestampWrites={querySet:a.querySet},o&&a.beginIndex!==void 0&&(r.timestampWrites.beginningOfPassWriteIndex=a.beginIndex),c&&a.endIndex!==void 0&&(r.timestampWrites.endOfPassWriteIndex=a.endIndex));let l=t.beginComputePass(r);if(e===0){l.setPipeline(this._pipelines.globalHist),l.setBindGroup(0,n);let e=Math.ceil(i/this.reducePartSize);l.dispatchWorkgroups(e)}l.setPipeline(this._pipelines.scan),l.setBindGroup(0,n),l.dispatchWorkgroups(1),l.setPipeline(this._pipelines.pass),l.setBindGroup(0,n),l.dispatchWorkgroups(s),l.end()}return{keysResult:n,valsResult:r}}_ensureSortBindGroups(e,t){this._sortBindGroups.even&&this._sortBindGroups.odd&&this._sortBindGroups.keysIn===e&&this._sortBindGroups.valsIn===t||(this._sortBindGroups.even=this.device.createBindGroup({layout:this._bindGroupLayout,entries:[{binding:0,resource:{buffer:this._buffers.info}},{binding:1,resource:{buffer:this._buffers.bump}},{binding:2,resource:{buffer:e}},{binding:3,resource:{buffer:this._buffers.altKeys}},{binding:4,resource:{buffer:t}},{binding:5,resource:{buffer:this._buffers.altVals}},{binding:6,resource:{buffer:this._buffers.hist}},{binding:7,resource:{buffer:this._buffers.passHist}},{binding:8,resource:{buffer:this._buffers.status}}]}),this._sortBindGroups.odd=this.device.createBindGroup({layout:this._bindGroupLayout,entries:[{binding:0,resource:{buffer:this._buffers.info}},{binding:1,resource:{buffer:this._buffers.bump}},{binding:2,resource:{buffer:this._buffers.altKeys}},{binding:3,resource:{buffer:e}},{binding:4,resource:{buffer:this._buffers.altVals}},{binding:5,resource:{buffer:t}},{binding:6,resource:{buffer:this._buffers.hist}},{binding:7,resource:{buffer:this._buffers.passHist}},{binding:8,resource:{buffer:this._buffers.status}}]}),this._sortBindGroups.keysIn=e,this._sortBindGroups.valsIn=t)}async _detectSubgroupSize(){if(this._subgroupSize>0)return this._subgroupSize;let e=this.device,t=e.createShaderModule({label:`Subgroup Probe`,code:ql}),n=e.createComputePipeline({layout:`auto`,compute:{module:t,entryPoint:`main`}}),r=e.createBuffer({label:`LBVH OneSweep SubgroupProbeOut`,size:4,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC|GPUBufferUsage.COPY_DST}),i=e.createBuffer({label:`LBVH OneSweep SubgroupProbeReadback`,size:4,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ}),a=e.createBindGroup({layout:n.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:r}}]}),o=e.createCommandEncoder(),s=o.beginComputePass();s.setPipeline(n),s.setBindGroup(0,a),s.dispatchWorkgroups(1),s.end(),o.copyBufferToBuffer(r,0,i,0,4),e.queue.submit([o.finish()]),await e.queue.onSubmittedWorkDone();try{await i.mapAsync(GPUMapMode.READ);let e=new Uint32Array(i.getMappedRange())[0];i.unmap(),this._subgroupSize=e===0?16:e}finally{i.destroy(),r.destroy()}return this._subgroupSize}_selectShaderVariant(e){return e>32?{shaderSource:Kl,label:`wave64`}:e===32?{shaderSource:Gl,label:`wave32`}:e>=16?{shaderSource:Wl,label:`wave16`}:(console.warn(`OneSweepSorter: detected subgroup size ${e}, below minimum (16). Forcing wave16.`),{shaderSource:Wl,label:`wave16 (forced)`})}dispose(){if(this._buffers){for(let e in this._buffers)this._buffers[e]?.destroy();this._buffers=null}}get subgroupSize(){return this._subgroupSize}get shaderVariant(){return this._shaderVariantLabel}},ru=256,iu=4,au=256,ou=256,su=4,cu=16,lu=256,uu=0*lu,du=1*lu,fu=2*lu,pu=3*lu,mu=7,hu={BUILTIN:`builtin`,ONESWEEP:`onesweep`},gu=class{device;requestedSorterType;warnedNoSubgroups=!1;sorter=null;sorterCapacity=0;pipelines=null;buildBuffers=null;bufferCapacity=0;sorterInitPromise=null;prewarmPromise=null;staticBindGroups={setupBounds:null,setupMorton:null,lbvhInitState:null,lbvhBuildTopology:null,lbvhSeedInternal:null,lbvhRefitWave0to1:null,lbvhRefitWave1to0:null,lbvhUpdateDispatch0to1:null,lbvhUpdateDispatch1to0:null,lbvhFinalize:null};staticBindGroupBuffers={buildBuffers:null,position:null,index:null};positionBuffer=null;indexBuffer=null;primCount=0;positionStride=3;constructor(e,t={}){this.device=e,this.requestedSorterType=t.sorterType??hu.ONESWEEP}get bvh2Buffer(){return this.buildBuffers?this.buildBuffers.bvh2Nodes:null}get clusterIdxBuffer(){return this.buildBuffers?this.buildBuffers.clusterIdx:null}get maxNodeCount(){return this.primCount>0?this.primCount*2:0}async prewarm(e){if(this.prewarmPromise)return this.prewarmPromise;let t=Math.max(1,e|0);return this.prewarmPromise=(async()=>{this.allocateBuffers(t),this.ensurePipelines(),await this.ensureSorter(t)})().finally(()=>{this.prewarmPromise=null}),this.prewarmPromise}async buildAsyncFromGPUBuffers(e){let{positionBuffer:t,indexBuffer:n,primCount:r,positionStride:i=3,waitForGpuCompletion:a=!0}=e;if(this.positionBuffer=t,this.indexBuffer=n,this.primCount=Math.max(0,r|0),this.positionStride=i,this.prewarmPromise&&await this.prewarmPromise,this.allocateBuffers(this.primCount),this.ensurePipelines(),await this.ensureSorter(this.primCount),this.initBuildState(),this.ensureStaticBindGroups(),this.primCount===0||!this.buildBuffers||!this.pipelines){a&&await this.device.queue.onSubmittedWorkDone();return}let o=this.shouldUseOneSweep(),s=this.device.createCommandEncoder({label:`LBVH Build Encoder`});this.recordSetupPass(s,this.primCount),o?this.recordOneSweepSort(s,this.primCount):this.recordBuiltinRadixSort(s,this.primCount),this.recordLBVHPass(s,this.primCount),this.device.queue.submit([s.finish()]),a&&await this.device.queue.onSubmittedWorkDone()}dispose(){if(this.sorter&&=(this.sorter.dispose(),null),this.buildBuffers){let e=this.buildBuffers;for(let t of Object.keys(e))e[t].destroy();this.buildBuffers=null}this.pipelines=null,this.positionBuffer=null,this.indexBuffer=null,this.bufferCapacity=0,this.sorterCapacity=0,this.staticBindGroups.setupBounds=null,this.staticBindGroups.setupMorton=null,this.staticBindGroups.lbvhInitState=null,this.staticBindGroups.lbvhBuildTopology=null,this.staticBindGroups.lbvhSeedInternal=null,this.staticBindGroups.lbvhRefitWave0to1=null,this.staticBindGroups.lbvhRefitWave1to0=null,this.staticBindGroups.lbvhUpdateDispatch0to1=null,this.staticBindGroups.lbvhUpdateDispatch1to0=null,this.staticBindGroups.lbvhFinalize=null,this.staticBindGroupBuffers.buildBuffers=null,this.staticBindGroupBuffers.position=null,this.staticBindGroupBuffers.index=null}shouldUseOneSweep(){if(this.requestedSorterType!==hu.ONESWEEP)return!1;let e=this.device.features.has(`subgroups`);return!e&&!this.warnedNoSubgroups&&(this.warnedNoSubgroups=!0,console.warn(`GPULBVHBuilder: subgroups unavailable, falling back to builtin radix sort.`)),e}ensurePipelines(){if(this.pipelines)return;let e=this.device.features.has(`subgroups`)?Pl.computeBoundsSubgroup:Pl.computeBounds,t=this.device.createShaderModule({label:`LBVH setupBounds`,code:e}),n=this.device.createShaderModule({label:`LBVH setupMorton`,code:Pl.computeMorton}),r=this.device.createShaderModule({label:`LBVH radixHistogram`,code:Fl.histogram}),i=this.device.createShaderModule({label:`LBVH radixWorkgroupScan`,code:Fl.workgroupScan}),a=this.device.createShaderModule({label:`LBVH radixScan`,code:Fl.scan}),o=this.device.createShaderModule({label:`LBVH radixScatter`,code:Fl.scatter}),s=this.device.createShaderModule({label:`LBVH initState`,code:Ll}),c=this.device.createShaderModule({label:`LBVH buildTopology`,code:Rl}),l=this.device.createShaderModule({label:`LBVH seedInternal`,code:zl}),u=this.device.createShaderModule({label:`LBVH refitWave`,code:Bl}),d=this.device.createShaderModule({label:`LBVH updateDispatch`,code:Vl}),f=this.device.createShaderModule({label:`LBVH finalize`,code:Hl});this.pipelines={setupBounds:this.device.createComputePipeline({label:`LBVH Setup Bounds`,layout:`auto`,compute:{module:t,entryPoint:`computeBounds`}}),setupMorton:this.device.createComputePipeline({label:`LBVH Setup Morton`,layout:`auto`,compute:{module:n,entryPoint:`computeMorton`}}),radixHistogram:this.device.createComputePipeline({label:`LBVH Radix Histogram`,layout:`auto`,compute:{module:r,entryPoint:`computeHistogram`}}),radixWorkgroupScan:this.device.createComputePipeline({label:`LBVH Radix WorkgroupScan`,layout:`auto`,compute:{module:i,entryPoint:`workgroupScan`}}),radixScan:this.device.createComputePipeline({label:`LBVH Radix Scan`,layout:`auto`,compute:{module:a,entryPoint:`prefixScan`}}),radixScatter:this.device.createComputePipeline({label:`LBVH Radix Scatter`,layout:`auto`,compute:{module:o,entryPoint:`scatter`}}),lbvhInitState:this.device.createComputePipeline({label:`LBVH Init State`,layout:`auto`,compute:{module:s,entryPoint:`initState`}}),lbvhBuildTopology:this.device.createComputePipeline({label:`LBVH Build Topology`,layout:`auto`,compute:{module:c,entryPoint:`buildTopology`}}),lbvhSeedInternal:this.device.createComputePipeline({label:`LBVH Seed Internal`,layout:`auto`,compute:{module:l,entryPoint:`seedInternal`}}),lbvhRefitWave:this.device.createComputePipeline({label:`LBVH Refit Wave`,layout:`auto`,compute:{module:u,entryPoint:`refitWave`}}),lbvhUpdateDispatch:this.device.createComputePipeline({label:`LBVH Update Dispatch`,layout:`auto`,compute:{module:d,entryPoint:`updateDispatch`}}),lbvhFinalize:this.device.createComputePipeline({label:`LBVH Finalize`,layout:`auto`,compute:{module:f,entryPoint:`finalizeTree`}})}}async ensureSorter(e){if(!this.shouldUseOneSweep())return;this.sorter||=new nu(this.device);let t=Math.max(e,1);this.sorterInitPromise&&await this.sorterInitPromise,this.sorterCapacity<t&&(this.sorterInitPromise=this.sorter.init(t).then(()=>{this.sorterCapacity=t}).finally(()=>{this.sorterInitPromise=null}),await this.sorterInitPromise)}allocateBuffers(e){if(e<=this.bufferCapacity&&this.buildBuffers)return;let t=Math.max(1024,this.nextPowerOf2(Math.max(1,e))),n=Math.max(1,Math.ceil(t/au)),r=Math.max(2,t*2);if(this.buildBuffers){let e=this.buildBuffers;for(let t of Object.keys(e))e[t].destroy();this.staticBindGroups.setupBounds=null,this.staticBindGroups.setupMorton=null,this.staticBindGroups.lbvhInitState=null,this.staticBindGroups.lbvhBuildTopology=null,this.staticBindGroups.lbvhSeedInternal=null,this.staticBindGroups.lbvhRefitWave0to1=null,this.staticBindGroups.lbvhRefitWave1to0=null,this.staticBindGroups.lbvhUpdateDispatch0to1=null,this.staticBindGroups.lbvhUpdateDispatch1to0=null,this.staticBindGroups.lbvhFinalize=null,this.staticBindGroupBuffers.buildBuffers=null,this.staticBindGroupBuffers.position=null,this.staticBindGroupBuffers.index=null}this.buildBuffers={sceneBounds:this.device.createBuffer({label:`LBVH Scene Bounds`,size:24,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST}),mortonCodes:this.device.createBuffer({label:`LBVH Morton`,size:t*4,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST}),mortonCodesAlt:this.device.createBuffer({label:`LBVH Morton Alt`,size:t*4,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST}),clusterIdx:this.device.createBuffer({label:`LBVH ClusterIdx`,size:t*4,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST}),clusterIdxAlt:this.device.createBuffer({label:`LBVH ClusterIdx Alt`,size:t*4,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST}),hplocState:this.device.createBuffer({label:`LBVH HplocState Scratch`,size:t*4*4,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST}),activeList:this.device.createBuffer({label:`LBVH ActiveList Scratch`,size:t*4,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST}),parentIdx:this.device.createBuffer({label:`LBVH ParentIdx`,size:r*4,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST}),refitVisitCount:this.device.createBuffer({label:`LBVH VisitCount`,size:r*4,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST}),activeCount0:this.device.createBuffer({label:`LBVH ActiveCount0`,size:4,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST}),activeCount1:this.device.createBuffer({label:`LBVH ActiveCount1`,size:4,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST}),indirectDispatch:this.device.createBuffer({label:`LBVH IndirectDispatch`,size:12,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.INDIRECT|GPUBufferUsage.COPY_DST}),bvh2Nodes:this.device.createBuffer({label:`LBVH Nodes`,size:r*32,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST}),nodeCounter:this.device.createBuffer({label:`LBVH NodeCounter`,size:4,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST}),groupCounts:this.device.createBuffer({label:`LBVH GroupCounts`,size:n*ou*4,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST}),groupPrefix:this.device.createBuffer({label:`LBVH GroupPrefix`,size:n*ou*4,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST}),globalDigitCount:this.device.createBuffer({label:`LBVH GlobalDigitCount`,size:ou*4,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST}),digitOffsets:this.device.createBuffer({label:`LBVH DigitOffsets`,size:ou*4,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST}),uniforms:this.device.createBuffer({label:`LBVH Uniforms`,size:lu*mu,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST})},this.bufferCapacity=t}ensureStaticBindGroups(){if(!this.buildBuffers||!this.pipelines||!this.positionBuffer||!this.indexBuffer||!(this.staticBindGroupBuffers.buildBuffers!==this.buildBuffers||this.staticBindGroupBuffers.position!==this.positionBuffer||this.staticBindGroupBuffers.index!==this.indexBuffer||!this.staticBindGroups.setupBounds||!this.staticBindGroups.setupMorton||!this.staticBindGroups.lbvhInitState||!this.staticBindGroups.lbvhBuildTopology||!this.staticBindGroups.lbvhSeedInternal||!this.staticBindGroups.lbvhRefitWave0to1||!this.staticBindGroups.lbvhRefitWave1to0||!this.staticBindGroups.lbvhUpdateDispatch0to1||!this.staticBindGroups.lbvhUpdateDispatch1to0||!this.staticBindGroups.lbvhFinalize))return;let e=this.buildBuffers,t=this.pipelines;this.staticBindGroups.setupBounds=this.device.createBindGroup({layout:t.setupBounds.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:e.uniforms,offset:uu,size:cu}},{binding:1,resource:{buffer:this.positionBuffer}},{binding:2,resource:{buffer:this.indexBuffer}},{binding:3,resource:{buffer:e.bvh2Nodes}},{binding:4,resource:{buffer:e.clusterIdx}},{binding:5,resource:{buffer:e.sceneBounds}},{binding:6,resource:{buffer:e.parentIdx}},{binding:7,resource:{buffer:e.hplocState}},{binding:8,resource:{buffer:e.activeList}}]}),this.staticBindGroups.setupMorton=this.device.createBindGroup({layout:t.setupMorton.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:e.uniforms,offset:du,size:cu}},{binding:1,resource:{buffer:e.bvh2Nodes}},{binding:2,resource:{buffer:e.sceneBounds}},{binding:3,resource:{buffer:e.mortonCodes}}]}),this.staticBindGroups.lbvhInitState=this.device.createBindGroup({layout:t.lbvhInitState.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:e.uniforms,offset:fu,size:cu}},{binding:1,resource:{buffer:e.parentIdx}},{binding:2,resource:{buffer:e.refitVisitCount}}]}),this.staticBindGroups.lbvhBuildTopology=this.device.createBindGroup({layout:t.lbvhBuildTopology.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:e.uniforms,offset:fu,size:cu}},{binding:1,resource:{buffer:e.mortonCodes}},{binding:2,resource:{buffer:e.clusterIdx}},{binding:3,resource:{buffer:e.bvh2Nodes}},{binding:4,resource:{buffer:e.parentIdx}}]}),this.staticBindGroups.lbvhSeedInternal=this.device.createBindGroup({layout:t.lbvhSeedInternal.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:e.uniforms,offset:fu,size:cu}},{binding:1,resource:{buffer:e.clusterIdx}},{binding:2,resource:{buffer:e.parentIdx}},{binding:3,resource:{buffer:e.refitVisitCount}},{binding:4,resource:{buffer:e.activeList}},{binding:5,resource:{buffer:e.activeCount0}}]}),this.staticBindGroups.lbvhRefitWave0to1=this.device.createBindGroup({layout:t.lbvhRefitWave.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:e.uniforms,offset:fu,size:cu}},{binding:1,resource:{buffer:e.bvh2Nodes}},{binding:2,resource:{buffer:e.parentIdx}},{binding:3,resource:{buffer:e.refitVisitCount}},{binding:4,resource:{buffer:e.activeList}},{binding:5,resource:{buffer:e.clusterIdxAlt}},{binding:6,resource:{buffer:e.activeCount0}},{binding:7,resource:{buffer:e.activeCount1}}]}),this.staticBindGroups.lbvhRefitWave1to0=this.device.createBindGroup({layout:t.lbvhRefitWave.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:e.uniforms,offset:fu,size:cu}},{binding:1,resource:{buffer:e.bvh2Nodes}},{binding:2,resource:{buffer:e.parentIdx}},{binding:3,resource:{buffer:e.refitVisitCount}},{binding:4,resource:{buffer:e.clusterIdxAlt}},{binding:5,resource:{buffer:e.activeList}},{binding:6,resource:{buffer:e.activeCount1}},{binding:7,resource:{buffer:e.activeCount0}}]}),this.staticBindGroups.lbvhUpdateDispatch0to1=this.device.createBindGroup({layout:t.lbvhUpdateDispatch.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:e.activeCount0}},{binding:1,resource:{buffer:e.indirectDispatch}},{binding:2,resource:{buffer:e.activeCount1}}]}),this.staticBindGroups.lbvhUpdateDispatch1to0=this.device.createBindGroup({layout:t.lbvhUpdateDispatch.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:e.activeCount1}},{binding:1,resource:{buffer:e.indirectDispatch}},{binding:2,resource:{buffer:e.activeCount0}}]}),this.staticBindGroups.lbvhFinalize=this.device.createBindGroup({layout:t.lbvhFinalize.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:e.uniforms,offset:fu,size:cu}},{binding:1,resource:{buffer:e.clusterIdx}},{binding:2,resource:{buffer:e.nodeCounter}}]}),this.staticBindGroupBuffers.buildBuffers=this.buildBuffers,this.staticBindGroupBuffers.position=this.positionBuffer,this.staticBindGroupBuffers.index=this.indexBuffer}initBuildState(){if(!this.buildBuffers)return;let e=new Uint32Array([4286578688,4286578688,4286578688,8388607,8388607,8388607]);this.device.queue.writeBuffer(this.buildBuffers.sceneBounds,0,e),this.device.queue.writeBuffer(this.buildBuffers.nodeCounter,0,new Uint32Array([this.primCount]))}recordSetupPass(e,t){if(!this.buildBuffers||!this.pipelines||!this.staticBindGroups.setupBounds||!this.staticBindGroups.setupMorton)return;let n=Math.ceil(t/ru);this.device.queue.writeBuffer(this.buildBuffers.uniforms,uu,new Uint32Array([t,n,this.positionStride,0])),this.device.queue.writeBuffer(this.buildBuffers.uniforms,du,new Uint32Array([t,n,0,0]));let r=e.beginComputePass({label:`LBVH Setup Pass`});r.setPipeline(this.pipelines.setupBounds),r.setBindGroup(0,this.staticBindGroups.setupBounds),r.dispatchWorkgroups(n),r.setPipeline(this.pipelines.setupMorton),r.setBindGroup(0,this.staticBindGroups.setupMorton),r.dispatchWorkgroups(n),r.end()}recordOneSweepSort(e,t){!this.buildBuffers||!this.sorter||this.sorter.sort({commandEncoder:e,keysIn:this.buildBuffers.mortonCodes,keysOut:this.buildBuffers.mortonCodesAlt,valsIn:this.buildBuffers.clusterIdx,valsOut:this.buildBuffers.clusterIdxAlt,count:t})}recordBuiltinRadixSort(e,t){if(!this.buildBuffers||!this.pipelines)return;let n=Math.ceil(t/au);e.clearBuffer(this.buildBuffers.groupCounts),e.clearBuffer(this.buildBuffers.groupPrefix),e.clearBuffer(this.buildBuffers.digitOffsets);let r=this.buildBuffers.mortonCodes,i=this.buildBuffers.mortonCodesAlt,a=this.buildBuffers.clusterIdx,o=this.buildBuffers.clusterIdxAlt;for(let s=0;s<iu;s++){let c=pu+s*lu;this.device.queue.writeBuffer(this.buildBuffers.uniforms,c,new Uint32Array([t,s*8,n,0])),e.clearBuffer(this.buildBuffers.globalDigitCount);{let t=e.beginComputePass({label:`LBVH Radix Histogram ${s}`}),i=this.device.createBindGroup({layout:this.pipelines.radixHistogram.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:this.buildBuffers.uniforms,offset:c,size:cu}},{binding:1,resource:{buffer:r}},{binding:2,resource:{buffer:this.buildBuffers.groupCounts}},{binding:3,resource:{buffer:this.buildBuffers.globalDigitCount}}]});t.setPipeline(this.pipelines.radixHistogram),t.setBindGroup(0,i),t.dispatchWorkgroups(n),t.end()}{let t=e.beginComputePass({label:`LBVH Radix WorkgroupScan ${s}`}),n=this.device.createBindGroup({layout:this.pipelines.radixWorkgroupScan.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:this.buildBuffers.uniforms,offset:c,size:cu}},{binding:1,resource:{buffer:this.buildBuffers.groupCounts}},{binding:2,resource:{buffer:this.buildBuffers.groupPrefix}}]});t.setPipeline(this.pipelines.radixWorkgroupScan),t.setBindGroup(0,n),t.dispatchWorkgroups(1),t.end()}{let t=e.beginComputePass({label:`LBVH Radix Scan ${s}`}),n=this.device.createBindGroup({layout:this.pipelines.radixScan.getBindGroupLayout(0),entries:[{binding:1,resource:{buffer:this.buildBuffers.globalDigitCount}},{binding:2,resource:{buffer:this.buildBuffers.digitOffsets}}]});t.setPipeline(this.pipelines.radixScan),t.setBindGroup(0,n),t.dispatchWorkgroups(1),t.end()}{let t=e.beginComputePass({label:`LBVH Radix Scatter ${s}`}),l=this.device.createBindGroup({layout:this.pipelines.radixScatter.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:this.buildBuffers.uniforms,offset:c,size:cu}},{binding:1,resource:{buffer:r}},{binding:2,resource:{buffer:i}},{binding:3,resource:{buffer:a}},{binding:4,resource:{buffer:o}},{binding:5,resource:{buffer:this.buildBuffers.groupPrefix}},{binding:6,resource:{buffer:this.buildBuffers.digitOffsets}}]});t.setPipeline(this.pipelines.radixScatter),t.setBindGroup(0,l),t.dispatchWorkgroups(n),t.end()}[r,i]=[i,r],[a,o]=[o,a]}}recordLBVHPass(e,t){if(!this.buildBuffers||!this.pipelines||!this.staticBindGroups.lbvhInitState||!this.staticBindGroups.lbvhBuildTopology||!this.staticBindGroups.lbvhSeedInternal||!this.staticBindGroups.lbvhRefitWave0to1||!this.staticBindGroups.lbvhRefitWave1to0||!this.staticBindGroups.lbvhUpdateDispatch0to1||!this.staticBindGroups.lbvhUpdateDispatch1to0||!this.staticBindGroups.lbvhFinalize)return;this.device.queue.writeBuffer(this.buildBuffers.uniforms,fu,new Uint32Array([t,0,0,0])),e.clearBuffer(this.buildBuffers.activeCount0),e.clearBuffer(this.buildBuffers.activeCount1);let n=e.beginComputePass({label:`LBVH Topology Pass`});if(n.setPipeline(this.pipelines.lbvhInitState),n.setBindGroup(0,this.staticBindGroups.lbvhInitState),n.dispatchWorkgroups(Math.ceil(t*2/ru)),t>1){n.setPipeline(this.pipelines.lbvhBuildTopology),n.setBindGroup(0,this.staticBindGroups.lbvhBuildTopology),n.dispatchWorkgroups(Math.ceil((t-1)/ru)),n.setPipeline(this.pipelines.lbvhSeedInternal),n.setBindGroup(0,this.staticBindGroups.lbvhSeedInternal),n.dispatchWorkgroups(Math.ceil(t/ru));let e=this.getRefitMaxIterations(t);for(let t=0;t<e;t++){let e=(t&1)==0;n.setPipeline(this.pipelines.lbvhUpdateDispatch),n.setBindGroup(0,e?this.staticBindGroups.lbvhUpdateDispatch0to1:this.staticBindGroups.lbvhUpdateDispatch1to0),n.dispatchWorkgroups(1),n.setPipeline(this.pipelines.lbvhRefitWave),n.setBindGroup(0,e?this.staticBindGroups.lbvhRefitWave0to1:this.staticBindGroups.lbvhRefitWave1to0),n.dispatchWorkgroupsIndirect(this.buildBuffers.indirectDispatch,0)}}n.setPipeline(this.pipelines.lbvhFinalize),n.setBindGroup(0,this.staticBindGroups.lbvhFinalize),n.dispatchWorkgroups(1),n.end()}getRefitMaxIterations(e){return e<=1?1:Math.max(1,Math.ceil(Math.log2(e)*su))}nextPowerOf2(e){let t=Math.max(1,e|0);return t--,t|=t>>1,t|=t>>2,t|=t>>4,t|=t>>8,t|=t>>16,t++,t}},_u=256,vu=64,yu=64,bu=8,xu=class{gpuBVHs;enableBvhBuild;buildOnce;rebuildIntervalFrames;waitForGpuCompletion;device;maxBodies;maxPairs;maxPairsPerBody;updateAabbKernel;bootstrapKernel;positionsAttr;shapesAttr;pairActivityAttr;aabbPositionAttr;aabbSnapshotBuffer;aabbIndexBuffer;pairCandidateIndicesAttr;pairVisitedBitsAttr;candidateUniformBuffer;candidateCounterBuffer;debugCountersBuffer;debugReadbackBuffer;candidateBindGroupLayout;clearCounterPipeline;clearVisitedPipeline;emitPairsPipeline;finalizeCounterPipeline;candidateBindGroup=null;candidateBindGroupBuffers={positions:null,aabbPosition:null,bvh:null,clusterIdx:null,pairCandidate:null,pairVisited:null,pairActivity:null,shapes:null};buildInFlight=null;prewarmInFlight=null;buildInFlightStartFrame=-1;activeBvhIndex=0;activeBvhSnapshotFrame=-1;lastBuildMs=0;candidatePairsEnabled=!1;backendBuffersReady=!1;bvhBuffersReady=!1;storageBuffersInitialized=!1;storageInitWarned=!1;bootstrapDone=!1;lastBuildFrame=-1;hasBuiltOnce=!1;buildGeneration=0;debugEnabled=!1;debugReadbackInFlight=!1;debugEveryNFrames=30;lastDebugLogFrame=-1;getActiveBVH(){return this.gpuBVHs[this.activeBvhIndex]}getBuildBVH(){return this.gpuBVHs[1-this.activeBvhIndex]}startBuild(e,t,n){if(this.buildInFlight)return;let r=performance.now();this.lastBuildFrame=n,this.buildInFlightStartFrame=n;let i=1-this.activeBvhIndex,a=this.getBuildBVH(),o=this.buildGeneration,s=Math.max(4,t*9*4),c=this.device.createCommandEncoder({label:`Broadphase AABB Snapshot Copy`});c.copyBufferToBuffer(e,0,this.aabbSnapshotBuffer,0,s),this.device.queue.submit([c.finish()]),this.buildInFlight=a.buildAsyncFromGPUBuffers({positionBuffer:this.aabbSnapshotBuffer,indexBuffer:this.aabbIndexBuffer,primCount:t,positionStride:3,useFlatten:!1,waitForGpuCompletion:this.waitForGpuCompletion}).then(()=>{o===this.buildGeneration&&(this.activeBvhIndex=i,this.activeBvhSnapshotFrame=n,this.hasBuiltOnce=!0,this.candidateBindGroup=null,this.candidateBindGroupBuffers.bvh=null,this.candidateBindGroupBuffers.clusterIdx=null,this.lastBuildMs=performance.now()-r)}).catch(e=>{o===this.buildGeneration&&(this.lastBuildMs=0,console.warn(`BroadPhaseStage BVH build failed:`,e))}).finally(()=>{o===this.buildGeneration&&(this.buildInFlight=null,this.buildInFlightStartFrame=-1)})}constructor(e,t,n,r,i,a,o,s,c,u,d,f,m){this.device=e,this.maxBodies=c,this.maxPairs=u,this.maxPairsPerBody=d,this.positionsAttr=t,this.shapesAttr=i,this.pairActivityAttr=a,this.enableBvhBuild=m?.enableBvhBuild??!0,this.buildOnce=m?.buildOnce??!1,this.rebuildIntervalFrames=Math.max(1,Math.floor(m?.rebuildIntervalFrames??1)),this.waitForGpuCompletion=m?.waitForGpuCompletion??!0,this.pairCandidateIndicesAttr=o,this.pairVisitedBitsAttr=s,this.gpuBVHs=[new gu(e,{sorterType:hu.ONESWEEP}),new gu(e,{sorterType:hu.ONESWEEP})];let h=Math.max(1,this.maxBodies),g=[];typeof this.gpuBVHs[0].prewarm==`function`&&g.push(this.gpuBVHs[0].prewarm(h)),typeof this.gpuBVHs[1].prewarm==`function`&&g.push(this.gpuBVHs[1].prewarm(h)),g.length>0&&(this.prewarmInFlight=Promise.all(g).then(()=>void 0).catch(e=>{console.warn(`BroadPhaseStage BVH prewarm failed:`,e)}).finally(()=>{this.prewarmInFlight=null})),this.aabbPositionAttr=new q(new Float32Array(c*9),1),this.aabbSnapshotBuffer=this.device.createBuffer({label:`Broadphase AABB Snapshot`,size:c*9*4,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST});let _=new Uint32Array(c*3);for(let e=0;e<c;e++)_[e*3+0]=e*3,_[e*3+1]=e*3+1,_[e*3+2]=e*3+2;this.aabbIndexBuffer=this.device.createBuffer({size:_.byteLength,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST}),this.device.queue.writeBuffer(this.aabbIndexBuffer,0,_);let v=l(`
      fn compute(
        positions: ptr<storage, array<vec4f>, read>,
        velocities: ptr<storage, array<vec4f>, read>,
        quaternions: ptr<storage, array<vec4f>, read>,
        shapes: ptr<storage, array<vec4f>, read>,
        aabbPositions: ptr<storage, array<f32>, read_write>,
        bodyCount: u32,
        aabbMargin: f32,
        aabbVelocityHorizon: f32,
        workgroupId: vec3u,
        localId: vec3u,
      ) -> void {
        let gid = workgroupId.x * ${_u}u + localId.x;
        if (gid >= bodyCount) { return; }

        let pos = positions[gid].xyz;
        let vel = velocities[gid].xyz;
        let q = quaternions[gid];
        let shape = shapes[gid];
        let half = shape.yzw;
        let shapeType = decodeShapeType(shape.x);
        let base = gid * 9u;

        // Keep BVH input finite; invalid values can poison the builder.
        if (!isFinite3(pos) || !isFinite4(q) || !isFinite3(half)) {
          let safe = vec3f(0.0, -1e6, 0.0);
          aabbPositions[base + 0u] = safe.x;
          aabbPositions[base + 1u] = safe.y;
          aabbPositions[base + 2u] = safe.z;
          aabbPositions[base + 3u] = safe.x;
          aabbPositions[base + 4u] = safe.y;
          aabbPositions[base + 5u] = safe.z;
          aabbPositions[base + 6u] = safe.x;
          aabbPositions[base + 7u] = safe.y;
          aabbPositions[base + 8u] = safe.z;
          return;
        }

        let velPad = abs(vel) * aabbVelocityHorizon;
        var e = vec3f(0.0);
        if (shapeType == SHAPE_TYPE_SPHERE) {
          e = vec3f(max(half.x, 0.0)) + vec3f(aabbMargin) + velPad;
        } else {
          let ax0 = qrot(q, vec3f(1.0, 0.0, 0.0));
          let ax1 = qrot(q, vec3f(0.0, 1.0, 0.0));
          let ax2 = qrot(q, vec3f(0.0, 0.0, 1.0));

          let ex = abs(ax0.x) * half.x + abs(ax1.x) * half.y + abs(ax2.x) * half.z;
          let ey = abs(ax0.y) * half.x + abs(ax1.y) * half.y + abs(ax2.y) * half.z;
          let ez = abs(ax0.z) * half.x + abs(ax1.z) * half.y + abs(ax2.z) * half.z;
          e = vec3f(ex, ey, ez) + vec3f(aabbMargin) + velPad;
        }

        aabbPositions[base + 0u] = pos.x - e.x;
        aabbPositions[base + 1u] = pos.y - e.y;
        aabbPositions[base + 2u] = pos.z - e.z;

        aabbPositions[base + 3u] = pos.x + e.x;
        aabbPositions[base + 4u] = pos.y + e.y;
        aabbPositions[base + 5u] = pos.z + e.z;

        aabbPositions[base + 6u] = pos.x;
        aabbPositions[base + 7u] = pos.y;
        aabbPositions[base + 8u] = pos.z;
      }

      const SHAPE_TYPE_SHIFT: u32 = 14u;
      const SHAPE_TYPE_MASK: u32 = 0x3u;
      const SHAPE_TYPE_SPHERE: u32 = 1u;

      fn decodeShapeType(shapeMeta: f32) -> u32 {
        return (bitcast<u32>(shapeMeta) >> SHAPE_TYPE_SHIFT) & SHAPE_TYPE_MASK;
      }

      fn isFinite3(v: vec3f) -> bool {
        let nonNan = all(v == v);
        let bounded = all(abs(v) <= vec3f(1e20));
        return nonNan && bounded;
      }

      fn isFinite4(v: vec4f) -> bool {
        let nonNan = all(v == v);
        let bounded = all(abs(v) <= vec4f(1e20));
        return nonNan && bounded;
      }

      fn qrot(q: vec4f, v: vec3f) -> vec3f {
        let t = 2.0 * cross(q.xyz, v);
        return v + q.w * t + cross(q.xyz, t);
      }
    `);this.updateAabbKernel=v({positions:Z(t,`vec4f`,c).toReadOnly(),velocities:Z(n,`vec4f`,c).toReadOnly(),quaternions:Z(r,`vec4f`,c).toReadOnly(),shapes:Z(i,`vec4f`,c).toReadOnly(),aabbPositions:Z(this.aabbPositionAttr,`float`,c*9),bodyCount:T(0),aabbMargin:T(.01),aabbVelocityHorizon:T(1/60),workgroupId:p,localId:W}).computeKernel([_u,1,1]).setName(`Broadphase Update AABBs`);let y=l(`
      fn compute(
        pairCandidateIndices: ptr<storage, array<u32>, read_write>,
        pairVisitedBits: ptr<storage, array<u32>, read_write>,
      ) -> void {
        // Force renderer-managed storage allocation for broadphase-only buffers.
        pairCandidateIndices[0] = pairCandidateIndices[0];
        pairVisitedBits[0] = pairVisitedBits[0];
      }
    `);this.bootstrapKernel=y({pairCandidateIndices:Z(o,`uint`,o.count),pairVisitedBits:Z(s,`uint`,s.count)}).computeKernel([1,1,1]).setName(`Broadphase Bootstrap Buffers`),this.candidateUniformBuffer=this.device.createBuffer({label:`Broadphase Candidate Uniforms`,size:32,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}),this.candidateCounterBuffer=this.device.createBuffer({label:`Broadphase Candidate Counter`,size:4,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST|GPUBufferUsage.COPY_SRC}),this.debugCountersBuffer=this.device.createBuffer({label:`Broadphase Debug Counters`,size:bu*4,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC}),this.debugReadbackBuffer=this.device.createBuffer({label:`Broadphase Debug Readback`,size:bu*4,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ}),this.candidateBindGroupLayout=this.device.createBindGroupLayout({label:`Broadphase Candidate BindGroupLayout`,entries:[{binding:0,visibility:GPUShaderStage.COMPUTE,buffer:{type:`uniform`}},{binding:1,visibility:GPUShaderStage.COMPUTE,buffer:{type:`read-only-storage`}},{binding:2,visibility:GPUShaderStage.COMPUTE,buffer:{type:`read-only-storage`}},{binding:3,visibility:GPUShaderStage.COMPUTE,buffer:{type:`read-only-storage`}},{binding:4,visibility:GPUShaderStage.COMPUTE,buffer:{type:`storage`}},{binding:5,visibility:GPUShaderStage.COMPUTE,buffer:{type:`storage`}},{binding:6,visibility:GPUShaderStage.COMPUTE,buffer:{type:`storage`}},{binding:7,visibility:GPUShaderStage.COMPUTE,buffer:{type:`storage`}},{binding:8,visibility:GPUShaderStage.COMPUTE,buffer:{type:`read-only-storage`}},{binding:9,visibility:GPUShaderStage.COMPUTE,buffer:{type:`read-only-storage`}}]});let b=this.device.createShaderModule({label:`Broadphase Candidate Shader`,code:`
struct Uniforms {
  bodyCount: u32,
  pairCapacity: u32,
  visitedWordCount: u32,
  pairsPerBody: u32,
  bvhNodeCapacity: u32,
  useVisitedDedup: u32,
  debugEnabled: u32,
};

struct BVH2Node {
  boundsMin: vec3f,
  leftChild: u32,
  boundsMax: vec3f,
  rightChild: u32,
};

@group(0) @binding(0) var<uniform> uniforms: Uniforms;
@group(0) @binding(1) var<storage, read> aabbPositions: array<f32>;
@group(0) @binding(2) var<storage, read> bvhNodes: array<BVH2Node>;
@group(0) @binding(3) var<storage, read> clusterIdx: array<u32>;
@group(0) @binding(4) var<storage, read_write> pairActivity: array<u32>;
@group(0) @binding(5) var<storage, read_write> pairVisitedBits: array<atomic<u32>>;
@group(0) @binding(6) var<storage, read_write> pairCounter: atomic<u32>;
@group(0) @binding(7) var<storage, read_write> debugCounters: array<atomic<u32>>;
@group(0) @binding(8) var<storage, read> positions: array<vec4f>;
@group(0) @binding(9) var<storage, read> shapes: array<vec4f>;

const INVALID_IDX: u32 = 0xFFFFFFFFu;
const INVALID_PAIR: u32 = 0xFFFFFFFFu;

fn overlaps(aMin: vec3f, aMax: vec3f, bMin: vec3f, bMax: vec3f) -> bool {
  return !(aMax.x < bMin.x || aMin.x > bMax.x ||
           aMax.y < bMin.y || aMin.y > bMax.y ||
           aMax.z < bMin.z || aMin.z > bMax.z);
}

fn pairIndex(i: u32, j: u32) -> u32 {
  return (j * (j - 1u)) / 2u + i;
}

fn isIgnoredPair(i: u32, j: u32) -> bool {
  let idx = pairIndex(i, j);
  let word = idx >> 5u;
  let bit = 1u << (idx & 31u);
  return (pairActivity[${f}u + word] & bit) != 0u;
}

fn decodeShapeCollisionGroup(shapeMeta: f32) -> u32 {
  return (bitcast<u32>(shapeMeta) >> 16u) & 0xffu;
}

fn decodeShapeCollisionMask(shapeMeta: f32) -> u32 {
  return (bitcast<u32>(shapeMeta) >> 24u) & 0xffu;
}

fn shapesCanCollide(shapeA: vec4f, shapeB: vec4f) -> bool {
  let groupA = decodeShapeCollisionGroup(shapeA.x);
  let groupB = decodeShapeCollisionGroup(shapeB.x);
  let maskA = decodeShapeCollisionMask(shapeA.x);
  let maskB = decodeShapeCollisionMask(shapeB.x);
  return (maskA & groupB) != 0u && (maskB & groupA) != 0u;
}

fn loadBodyMin(body: u32) -> vec3f {
  let base = body * 9u;
  return vec3f(
    aabbPositions[base + 0u],
    aabbPositions[base + 1u],
    aabbPositions[base + 2u]
  );
}

fn loadBodyMax(body: u32) -> vec3f {
  let base = body * 9u;
  return vec3f(
    aabbPositions[base + 3u],
    aabbPositions[base + 4u],
    aabbPositions[base + 5u]
  );
}

fn loadBodyCenter(body: u32) -> vec3f {
  let base = body * 9u;
  return vec3f(
    aabbPositions[base + 6u],
    aabbPositions[base + 7u],
    aabbPositions[base + 8u]
  );
}

@compute @workgroup_size(1)
fn clearCounter() {
  atomicStore(&pairCounter, 0u);
  pairActivity[0] = 0u;
  if (uniforms.debugEnabled > 0u) {
    for (var i = 0u; i < ${bu}u; i++) {
      atomicStore(&debugCounters[i], 0u);
    }
  }
}

@compute @workgroup_size(${vu})
fn clearVisited(@builtin(global_invocation_id) globalId: vec3u) {
  if (uniforms.useVisitedDedup == 0u) { return; }
  let idx = globalId.x;
  if (idx >= uniforms.visitedWordCount) { return; }
  atomicStore(&pairVisitedBits[idx], 0u);
}

@compute @workgroup_size(${vu})
fn emitPairs(@builtin(global_invocation_id) globalId: vec3u) {
  let body = globalId.x;
  if (body >= uniforms.bodyCount) { return; }

  let bodyBase = body * uniforms.pairsPerBody;
  if (bodyBase >= uniforms.pairCapacity) { return; }
  let maxBodySlots = min(uniforms.pairsPerBody, uniforms.pairCapacity - bodyBase);
  for (var clearIdx = 0u; clearIdx < maxBodySlots; clearIdx++) {
    pairActivity[bodyBase + clearIdx + 1u] = INVALID_PAIR;
  }

  // Static bodies do not own candidate emission. Dynamic bodies emit both
  // dynamic-dynamic and dynamic-static pairs (including static floor/terrain).
  if (positions[body].w == 0.0) {
    return;
  }

  let aabbMin = loadBodyMin(body);
  let aabbMax = loadBodyMax(body);
  let bodyCenter = loadBodyCenter(body);
  let maxNodes = uniforms.bvhNodeCapacity;

  var root = clusterIdx[0u];
  if (uniforms.bodyCount > 1u) {
    let expectedRoot = uniforms.bodyCount * 2u - 2u;
    if (expectedRoot < maxNodes) {
      if (root == INVALID_IDX || root >= maxNodes || bvhNodes[root].leftChild == INVALID_IDX) {
        root = expectedRoot;
      }
    }
  }

  var emittedForBody = 0u;
  var localPairs: array<u32, ${d}>;
  var localDist2: array<f32, ${d}>;
  var stack: array<u32, ${yu}>;
  var sp = 0u;
  var visitCount = 0u;
  let visitBudget = max(128u, min(maxNodes * 4u, 4096u));

  if (root != INVALID_IDX && root < maxNodes) {
    stack[sp] = root;
    sp = 1u;
  }

  loop {
    if (sp == 0u || visitCount >= visitBudget) { break; }
    visitCount += 1u;
    sp -= 1u;

    let nodeIdx = stack[sp];
    if (nodeIdx >= maxNodes) {
      continue;
    }

    let node = bvhNodes[nodeIdx];
    if (!overlaps(aabbMin, aabbMax, node.boundsMin, node.boundsMax)) {
      continue;
    }

    if (node.leftChild == INVALID_IDX) {
      let other = node.rightChild;
      if (other == body || other >= uniforms.bodyCount) {
        continue;
      }
      let otherDynamic = positions[other].w > 0.0;
      if (otherDynamic && other <= body) {
        continue;
      }
      if (uniforms.debugEnabled > 0u) {
        atomicAdd(&debugCounters[4u], 1u);
      }

      let a = min(body, other);
      let b = max(body, other);
      if (!shapesCanCollide(shapes[a], shapes[b])) {
        continue;
      }
      if (isIgnoredPair(a, b)) {
        continue;
      }
      let pair = pairIndex(a, b);

      if (uniforms.useVisitedDedup != 0u) {
        let word = pair >> 5u;
        let bit = 1u << (pair & 31u);
        let previous = atomicOr(&pairVisitedBits[word], bit);
        if ((previous & bit) != 0u) {
          if (uniforms.debugEnabled > 0u) {
            atomicAdd(&debugCounters[1u], 1u);
          }
          continue;
        }
      }
      // Store candidates locally first so each body can emit a deterministic,
      // sorted fixed-size range in the global buffer.
      let packedPair = (a & 0xFFFFu) | ((b & 0xFFFFu) << 16u);
      let dc = loadBodyCenter(other) - bodyCenter;
      var d2 = dot(dc, dc);
      if (!otherDynamic) {
        // Keep static support contacts (e.g. floor) from being evicted by
        // dynamic neighbors in top-K pruning.
        d2 = -1.0;
      }

      if (emittedForBody < maxBodySlots) {
        localPairs[emittedForBody] = packedPair;
        localDist2[emittedForBody] = d2;
        emittedForBody += 1u;
      } else if (maxBodySlots > 0u) {
        if (uniforms.debugEnabled > 0u) {
          atomicAdd(&debugCounters[0u], 1u);
        }

        // Keep the top-K nearest neighbors for each body; this avoids
        // dropping physically relevant support contacts in dense stacks.
        var worstIdx = 0u;
        var worstD2 = localDist2[0];
        var worstPair = localPairs[0];
        for (var idx = 1u; idx < maxBodySlots; idx++) {
          let candD2 = localDist2[idx];
          let candPair = localPairs[idx];
          if (candD2 > worstD2 || (candD2 == worstD2 && candPair > worstPair)) {
            worstIdx = idx;
            worstD2 = candD2;
            worstPair = candPair;
          }
        }

        if (d2 < worstD2 || (d2 == worstD2 && packedPair < worstPair)) {
          localPairs[worstIdx] = packedPair;
          localDist2[worstIdx] = d2;
        }
      }
    } else {
      let left = node.leftChild;
      let right = node.rightChild;
      if (left == INVALID_IDX || right == INVALID_IDX || left == nodeIdx || right == nodeIdx) {
        continue;
      }
      if (sp + 2u <= ${yu}u && left < maxNodes && right < maxNodes) {
        stack[sp] = left;
        sp += 1u;
        stack[sp] = right;
        sp += 1u;
      }
    }
  }

  if (uniforms.debugEnabled > 0u && visitCount >= visitBudget) {
    atomicAdd(&debugCounters[3u], 1u);
  }

  // Insertion-sort each body's local candidate list for deterministic manifold
  // indexing across frames (critical for persistent warmstart state).
  for (var sortI = 1u; sortI < emittedForBody; sortI++) {
    let key = localPairs[sortI];
    var sortJ = sortI;
    loop {
      if (sortJ == 0u) { break; }
      let prev = localPairs[sortJ - 1u];
      if (prev <= key) { break; }
      localPairs[sortJ] = prev;
      sortJ -= 1u;
    }
    localPairs[sortJ] = key;
  }

  for (var writeIdx = 0u; writeIdx < emittedForBody; writeIdx++) {
    pairActivity[bodyBase + writeIdx + 1u] = localPairs[writeIdx];
  }
  // Clear unused per-body candidate slots so contact generation does not
  // read stale pairs from previous frames.
  let invalidPacked = body | (body << 16u);
  for (var clearIdx = emittedForBody; clearIdx < uniforms.pairsPerBody; clearIdx++) {
    pairActivity[bodyBase + clearIdx + 1u] = invalidPacked;
  }

  atomicAdd(&pairCounter, emittedForBody);
  if (uniforms.debugEnabled > 0u) {
    atomicAdd(&debugCounters[2u], emittedForBody);
  }
}

@compute @workgroup_size(1)
fn finalizeCounter() {
  let rawCount = atomicLoad(&pairCounter);
  let dispatchSpan = min(uniforms.pairCapacity, uniforms.bodyCount * uniforms.pairsPerBody);
  pairActivity[0] = dispatchSpan;
  if (uniforms.debugEnabled > 0u) {
    // 5 = actual emitted candidates, 6 = dispatch span used by contact pass.
    atomicStore(&debugCounters[5u], rawCount);
    atomicStore(&debugCounters[6u], dispatchSpan);
  }
}
`}),x=this.device.createPipelineLayout({bindGroupLayouts:[this.candidateBindGroupLayout]});this.clearCounterPipeline=this.device.createComputePipeline({label:`Broadphase Clear Counter`,layout:x,compute:{module:b,entryPoint:`clearCounter`}}),this.clearVisitedPipeline=this.device.createComputePipeline({label:`Broadphase Clear Visited`,layout:x,compute:{module:b,entryPoint:`clearVisited`}}),this.emitPairsPipeline=this.device.createComputePipeline({label:`Broadphase Emit Pairs`,layout:x,compute:{module:b,entryPoint:`emitPairs`}}),this.finalizeCounterPipeline=this.device.createComputePipeline({label:`Broadphase Finalize Counter`,layout:x,compute:{module:b,entryPoint:`finalizeCounter`}})}dispatch(e,t,n,r){if(t<2||n==0){this.candidatePairsEnabled=!1,this.backendBuffersReady=!1,this.bvhBuffersReady=!1,this.lastBuildMs=0,this.logDebugState(r,t,`insufficientBodiesOrPairs`);return}this.updateAabbKernel.computeNode.parameters.bodyCount.value=t,e.compute(this.updateAabbKernel,[Math.ceil(t/_u),1,1]),this.bootstrapDone||=(e.compute(this.bootstrapKernel,[1,1,1]),!0);let i=e.backend;if(!this.storageBuffersInitialized&&i?.createStorageAttribute)try{i.createStorageAttribute(this.aabbPositionAttr),i.createStorageAttribute(this.pairActivityAttr),i.createStorageAttribute(this.pairVisitedBitsAttr),this.storageBuffersInitialized=!0}catch(e){this.storageInitWarned||=(console.warn(`BroadPhaseStage failed to initialize storage attributes:`,e),!0)}let a=i?.get?.(this.positionsAttr)?.buffer,o=i?.get?.(this.shapesAttr)?.buffer,s=i?.get?.(this.aabbPositionAttr)?.buffer,c=i?.get?.(this.pairActivityAttr)?.buffer,l=i?.get?.(this.pairVisitedBitsAttr)?.buffer;if(this.backendBuffersReady=!!(a&&o&&s&&c&&l),!a||!o||!s||!c||!l){this.candidatePairsEnabled=!1,this.bvhBuffersReady=!1,this.logDebugState(r,t,`missingBackendBuffers`);return}if(!this.enableBvhBuild){this.candidatePairsEnabled=!1,this.bvhBuffersReady=!1,this.lastBuildMs=0,this.logDebugState(r,t,`bvhDisabled`);return}let u=this.lastBuildFrame<0||r-this.lastBuildFrame>=this.rebuildIntervalFrames,d=!this.buildOnce||!this.hasBuiltOnce,f=this.prewarmInFlight===null,p=u&&d&&f;if(!this.hasBuiltOnce){p&&this.startBuild(s,t,r),this.candidatePairsEnabled=!1,this.bvhBuffersReady=!1,this.logDebugState(r,t,f?`waitingInitialBuild`:`waitingPrewarm`,p);return}let m=this.getActiveBVH(),h=m.bvh2Buffer,g=m.clusterIdxBuffer;if(this.bvhBuffersReady=!!(h&&g),!h||!g){this.candidatePairsEnabled=!1,p&&this.startBuild(s,t,r),this.logDebugState(r,t,`missingBvhBuffers`,p);return}let _=Math.ceil(n/32),v=Math.max(1,Number(this.device.limits.maxComputeWorkgroupsPerDimension??65535))*vu,y=this.pairVisitedBitsAttr.count,b=+(_<=Math.min(v,y)),x=b?Math.max(1,Math.ceil(_/vu)):0,S=Math.min(this.maxPairs,t*this.maxPairsPerBody),C=Math.max(1,t*2),w=new Uint32Array([t,S,_,this.maxPairsPerBody,C,b,+!!this.debugEnabled]);this.device.queue.writeBuffer(this.candidateUniformBuffer,0,w),(!this.candidateBindGroup||this.candidateBindGroupBuffers.positions!==a||this.candidateBindGroupBuffers.aabbPosition!==s||this.candidateBindGroupBuffers.bvh!==h||this.candidateBindGroupBuffers.clusterIdx!==g||this.candidateBindGroupBuffers.pairCandidate!==c||this.candidateBindGroupBuffers.pairVisited!==l||this.candidateBindGroupBuffers.pairActivity!==c||this.candidateBindGroupBuffers.shapes!==o)&&(this.candidateBindGroup=this.device.createBindGroup({label:`Broadphase Candidate BindGroup`,layout:this.candidateBindGroupLayout,entries:[{binding:0,resource:{buffer:this.candidateUniformBuffer}},{binding:1,resource:{buffer:s}},{binding:2,resource:{buffer:h}},{binding:3,resource:{buffer:g}},{binding:4,resource:{buffer:c}},{binding:5,resource:{buffer:l}},{binding:6,resource:{buffer:this.candidateCounterBuffer}},{binding:7,resource:{buffer:this.debugCountersBuffer}},{binding:8,resource:{buffer:a}},{binding:9,resource:{buffer:o}}]}),this.candidateBindGroupBuffers.positions=a,this.candidateBindGroupBuffers.aabbPosition=s,this.candidateBindGroupBuffers.bvh=h,this.candidateBindGroupBuffers.clusterIdx=g,this.candidateBindGroupBuffers.pairCandidate=c,this.candidateBindGroupBuffers.pairVisited=l,this.candidateBindGroupBuffers.pairActivity=c,this.candidateBindGroupBuffers.shapes=o);let T=this.device.createCommandEncoder({label:`Broadphase Encoder`});{let e=T.beginComputePass({label:`Broadphase Candidate Pass`});e.setBindGroup(0,this.candidateBindGroup),e.setPipeline(this.clearCounterPipeline),e.dispatchWorkgroups(1),x>0&&(e.setPipeline(this.clearVisitedPipeline),e.dispatchWorkgroups(x)),e.setPipeline(this.emitPairsPipeline),e.dispatchWorkgroups(Math.ceil(t/vu)),e.setPipeline(this.finalizeCounterPipeline),e.dispatchWorkgroups(1),e.end()}this.device.queue.submit([T.finish()]),this.maybeReadDebugCounters(r,t),this.candidatePairsEnabled=!0,p&&this.startBuild(s,t,r),this.logDebugState(r,t,`ready`,p)}hasCandidatePairs(){return this.candidatePairsEnabled}setDebugEnabled(e){this.debugEnabled=e,this.debugReadbackInFlight=!1,this.lastDebugLogFrame=-1}setDebugLogInterval(e){this.debugEveryNFrames=Math.max(1,Math.floor(e)),this.lastDebugLogFrame=-1}isReady(){return this.backendBuffersReady&&this.bvhBuffersReady}getLastBuildMs(){return this.lastBuildMs}reset(){this.buildGeneration++,this.buildInFlight=null,this.buildInFlightStartFrame=-1,this.activeBvhIndex=0,this.activeBvhSnapshotFrame=-1,this.lastBuildMs=0,this.candidatePairsEnabled=!1,this.backendBuffersReady=!1,this.bvhBuffersReady=!1,this.storageBuffersInitialized=!1,this.storageInitWarned=!1,this.bootstrapDone=!1,this.lastBuildFrame=-1,this.hasBuiltOnce=!1,this.debugReadbackInFlight=!1,this.lastDebugLogFrame=-1,this.candidateBindGroup=null,this.candidateBindGroupBuffers.positions=null,this.candidateBindGroupBuffers.aabbPosition=null,this.candidateBindGroupBuffers.bvh=null,this.candidateBindGroupBuffers.clusterIdx=null,this.candidateBindGroupBuffers.pairCandidate=null,this.candidateBindGroupBuffers.pairVisited=null,this.candidateBindGroupBuffers.pairActivity=null,this.candidateBindGroupBuffers.shapes=null}dispose(){this.candidateBindGroup=null,this.aabbSnapshotBuffer.destroy(),this.aabbIndexBuffer.destroy(),this.candidateUniformBuffer.destroy(),this.candidateCounterBuffer.destroy(),this.debugCountersBuffer.destroy(),this.debugReadbackBuffer.destroy(),this.gpuBVHs[0].dispose(),this.gpuBVHs[1].dispose()}maybeReadDebugCounters(e,t){if(!this.debugEnabled||this.debugReadbackInFlight||this.lastDebugLogFrame>=0&&e-this.lastDebugLogFrame<this.debugEveryNFrames)return;this.debugReadbackInFlight=!0,this.lastDebugLogFrame=e;let n=this.device.createCommandEncoder({label:`Broadphase Debug Readback`});n.copyBufferToBuffer(this.debugCountersBuffer,0,this.debugReadbackBuffer,0,bu*4),this.device.queue.submit([n.finish()]),this.debugReadbackBuffer.mapAsync(GPUMapMode.READ).then(()=>{try{let n=this.debugReadbackBuffer.getMappedRange(),r=new Uint32Array(n.slice(0)),i=r[5]??0,a=r[6]??0,o={frame:e,bodies:t,candidates:i,rawCandidates:a,perBodyDrops:r[0]??0,dedupDrops:r[1]??0,writes:r[2]??0,leafCandidates:r[4]??0,visitBudgetDrops:r[3]??0,capacityDrops:Math.max(0,i-a),pairsPerBody:this.maxPairsPerBody};console.info(`[Broadphase Debug] frame=${o.frame} bodies=${o.bodies} candidates=${o.candidates} perBodyDrops=${o.perBodyDrops} dedupDrops=${o.dedupDrops} writes=${o.writes} leafCandidates=${o.leafCandidates} visitBudgetDrops=${o.visitBudgetDrops} capacityDrops=${o.capacityDrops} pairsPerBody=${o.pairsPerBody} dispatchSpan=${o.rawCandidates}`)}finally{this.debugReadbackBuffer.unmap()}}).catch(e=>{console.warn(`Broadphase debug readback failed:`,e)}).finally(()=>{this.debugReadbackInFlight=!1})}logDebugState(e,t,n,r){if(!this.debugEnabled)return;let i=this.activeBvhSnapshotFrame>=0?Math.max(0,e-this.activeBvhSnapshotFrame):-1,a=this.buildInFlight&&this.buildInFlightStartFrame>=0?Math.max(0,e-this.buildInFlightStartFrame):-1,o=r===void 0?``:` shouldStartBuild=${+!!r}`;console.info(`[Broadphase State] frame=${e} bodies=${t} reason=${n} hasBuiltOnce=${+!!this.hasBuiltOnce} buildInFlight=${+!!this.buildInFlight} bvhBuffersReady=${+!!this.bvhBuffersReady} activeBvhIndex=${this.activeBvhIndex} activeBvhSnapshotFrame=${this.activeBvhSnapshotFrame} activeBvhAge=${i} buildInFlightStartFrame=${this.buildInFlightStartFrame} buildInFlightAge=${a} lastBuildMs=${this.lastBuildMs.toFixed(3)} prewarmInFlight=${+!!this.prewarmInFlight} backendReady=${+!!this.backendBuffersReady} candidatePairsEnabled=${+!!this.candidatePairsEnabled}`+o)}},Su=256,Cu=class{kernel;constructor(e,t,n,r){let i=l(`
      fn compute(
        quaternions: ptr<storage, array<vec4f>, read>,
        inverseInertia: ptr<storage, array<vec4f>, read>,
        derivedInvInertia: ptr<storage, array<vec4f>, read_write>,
        bodyCount: u32,
        workgroupId: vec3u,
        localId: vec3u,
      ) -> void {
        let gid = workgroupId.x * ${Su}u + localId.x;
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
    `,[Ir]);this.kernel=i({quaternions:Z(e,`vec4f`,r).toReadOnly(),inverseInertia:Z(t,`vec4f`,r).toReadOnly(),derivedInvInertia:Z(n,`vec4f`,r*3),bodyCount:T(0),workgroupId:p,localId:W}).computeKernel([Su,1,1]).setName(`Physics Derived Inertia`)}dispatch(e,t){if(this.kernel.computeNode.parameters.bodyCount.value=t,t>0){let n=Math.ceil(t/Su);e.compute(this.kernel,[n,1,1])}}},wu=class{controlKernel;probeKernel;probeStateAttr;constructor(e,t,n,r,i,a,o,s,c){this.probeStateAttr=new q(new Float32Array(8),4);let u=l(`
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
    `);this.controlKernel=u({velocities:Z(t,`vec4f`,o),angularVelocities:Z(n,`vec4f`,o),bodyCount:T(0),bodyIndex:T(0),targetVelocity:T(new Y(0,0,0)),moveGain:T(.4),jumpSpeed:T(6),jumpRequest:T(0),groundedHint:T(0)}).computeKernel([1,1,1]).setName(`Player Control`);let d=l(`
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
        let contactCount = min(pairBodyContactCounts[bodyIndex] & 0xFFFFu, ${c}u);
        let bodyBase = bodyIndex * ${c}u;
        for (var k = 0u; k < ${c}u; k++) {
          if (k >= contactCount) { break; }
          let p = pairBodyContactIndices[bodyBase + k];
          if (p >= ${s}u) { continue; }

          let info = pairContacts[p * 9u + 0u];
          if (info.z < 0.5) { continue; }

          let i = u32(info.x + 0.5);
          let j = u32(info.y + 0.5);
          let ny = pairContacts[p * 9u + 1u].y;
          if ((i == bodyIndex && ny < -0.35) || (j == bodyIndex && ny > 0.35)) {
            grounded = true;
            break;
          }
        }

        let groundedF = select(0.0, 1.0, grounded);
        probeState[0u] = vec4f(pos, groundedF);
        probeState[1u] = vec4f(vel, 0.0);
      }
    `);this.probeKernel=d({positions:Z(e,`vec4f`,o).toReadOnly(),velocities:Z(t,`vec4f`,o).toReadOnly(),pairBodyContactCounts:Z(r,`uint`,o).toReadOnly(),pairBodyContactIndices:Z(i,`uint`,o*c).toReadOnly(),pairContacts:Z(a,`vec4f`,s*9),probeState:Z(this.probeStateAttr,`vec4f`,2),bodyCount:T(0),bodyIndex:T(0)}).computeKernel([1,1,1]).setName(`Player Probe`)}dispatchControl(e,t,n,r,i,a,o,s){this.controlKernel.computeNode.parameters.bodyCount.value=t,this.controlKernel.computeNode.parameters.bodyIndex.value=n,this.controlKernel.computeNode.parameters.targetVelocity.value.set(r[0],r[1],r[2]),this.controlKernel.computeNode.parameters.moveGain.value=i,this.controlKernel.computeNode.parameters.jumpSpeed.value=a,this.controlKernel.computeNode.parameters.jumpRequest.value=+!!o,this.controlKernel.computeNode.parameters.groundedHint.value=+!!s,e.compute(this.controlKernel,[1,1,1])}dispatchProbe(e,t,n){this.probeKernel.computeNode.parameters.bodyCount.value=t,this.probeKernel.computeNode.parameters.bodyIndex.value=n,e.compute(this.probeKernel,[1,1,1])}getProbeAttribute(){return this.probeStateAttr}},Tu=1,Eu=1,Du=.95,Ou=16,ku=4294967295,Au=8,ju=12;function Mu(e,t){let n=Math.min(e,t),r=Math.max(e,t);return!Number.isFinite(n)||!Number.isFinite(r)||n<0||r<=n?-1:Math.floor(r*(r-1)/2+n)}function Nu(e){let t=Math.hypot(e[0],e[1],e[2],e[3]);return t<=1e-12?[0,0,0,1]:[e[0]/t,e[1]/t,e[2]/t,e[3]/t]}function Pu(e){return[-e[0],-e[1],-e[2],e[3]]}function Fu(e,t){return[e[3]*t[0]+e[0]*t[3]+e[1]*t[2]-e[2]*t[1],e[3]*t[1]-e[0]*t[2]+e[1]*t[3]+e[2]*t[0],e[3]*t[2]+e[0]*t[1]-e[1]*t[0]+e[2]*t[3],e[3]*t[3]-e[0]*t[0]-e[1]*t[1]-e[2]*t[2]]}function Iu(e,t){let n=Fu(Fu(Nu(e),[t[0],t[1],t[2],0]),Pu(Nu(e)));return[n[0],n[1],n[2]]}function Lu(e,t){let n=new Float32Array(e),r=new Uint32Array(e),i=new Float32Array(t*4),a=new Uint32Array(i.buffer),o=new Float32Array(t*4),s=new Float32Array(t*8),c=new Uint32Array(s.buffer),l=new Float32Array(t*4),u=new Float32Array(t*4),d=new Float32Array(t*8),f=new Uint32Array(t);for(let e=0;e<t;e++){let t=Uc(e,0),p=Uc(e,1),m=Uc(e,2),h=Uc(e,3),g=Uc(e,4),_=Uc(e,5),v=Uc(e,6),y=Uc(e,7),b=Uc(e,8);i.set(n.subarray(t,t+4),e*4),a[e*4+3]=r[t+3]??0,o.set(n.subarray(p,p+4),e*4),s.set(n.subarray(m,m+4),e*8),s.set(n.subarray(h,h+4),e*8+4),c[e*8+3]=r[m+3]??0,c[e*8+7]=r[h+3]??0,l.set(n.subarray(g,g+4),e*4),u.set(n.subarray(_,_+4),e*4),d.set(n.subarray(v,v+4),e*8),d.set(n.subarray(y,y+4),e*8+4),f[e]=r[b]??0}return{meta:i,metaWords:a,cacheWords:f,normalPen:o,arms:s,armWords:c,constraintC0:l,pairLambdas:u,dual:d,pairContacts:n,pairContactWords:r}}var Ru=class{config;device;bodyCount=0;accumulator=0;initialized=!1;maxPairs;maxCandidatePairs;maxPairContacts;pairManifoldSlots;maxPairsPerBodyBroadphase;maxContactsPerBodySolver;maxJoints;maxJointsPerBodySolver;maxSprings;maxSpringsPerBodySolver;maxConstraintsPerBodySolver;bruteForceMaxBodies;maxActivePairContacts;haltOnBroadphaseFallbackOverflow;maxFixedStepsPerFrame;enableBvhBuild;bvhBuildOnce;bvhRebuildIntervalFrames;bvhWaitForGpuCompletion;avbdPairSweeps;solverIterations;maxPairSolveColorCount;activePairSolveColorCount;avbdFrictionStatic;avbdDualUpdateBeta;avbdRegularizationAlpha;avbdPenaltyDecayGamma;avbdBodySolveMode=`colored`;avbdPreventPenetratingNormalDropout=!1;avbdPenaltyFloor=Eu;jointCount=0;springCount=0;positionsData;initialPoseData;initialLinearVelData;initialAngularVelData;inertialPoseData;velocitiesData;prevLinearVelData;shapesData;shapesWordData;quaternionsData;angularVelData;inverseInertiaData;derivedInvInertiaData;poseEpoch=0;pairContactsData;jointRecordsData;springRecordsData;pairActivityData;pairCandidateIndicesOffset;pairActiveCandidateSlotsOffset;pairActiveContactsOffset;pairIgnoredBitsOffset;pairActivityWordCount;pairCandidateIndicesData;pairVisitedBitsData;pairBodyContactCountsData;pairBodyContactIndicesData;bodyConstraintCountsData;bodyConstraintRefsData;pairActiveCandidateSlotsData;pairActiveContactsData;pairIgnoredBitsData;pairColorBodyClaimsData;positionsAttr;initialPoseAttr;inertialPoseAttr;velocitiesAttr;prevLinearVelAttr;shapesAttr;quaternionsAttr;angularVelAttr;inverseInertiaAttr;derivedInvInertiaAttr;pairContactsAttr;jointRecordsAttr;springRecordsAttr;pairActivityAttr;pairCandidateIndicesAttr;pairVisitedBitsAttr;pairBodyContactCountsAttr;pairBodyContactIndicesAttr;bodyConstraintCountsAttr;bodyConstraintRefsAttr;pairActiveCandidateSlotsAttr;pairActiveContactsAttr;pairColorBodyClaimsAttr;integration;broadPhase;derivedInertia;contactGeneration;avbdState;playerControl;pairDispatchTruncationWarned=!1;waitingForInitialCandidatePairs=!0;frameId=0;debugBehaviorEnabled=!1;debugLogEveryNFrames=30;supportDebugReadbackInFlight=!1;lastSupportDebugLogFrame=-1;supportDebugEveryNFrames=30;prevSupportBodyCount=-1;prevCandidatePairsForChurn=null;prevFloorCandidatePairsForChurn=null;stats={bodyCount:0,frameCount:0,totalMs:0,integrationMs:0,broadPhaseMs:0,solverMs:0,velocityUpdateMs:0,broadPhaseReady:!1,candidatePairsEnabled:!1,pairDispatchTruncated:!1};constructor(e,t){this.device=e,this.config=t,this.solverIterations=t.solverIterations??8,this.maxPairSolveColorCount=Math.max(1,Math.floor(t.pairSolveColorCount??64)),this.activePairSolveColorCount=Math.min(this.maxPairSolveColorCount,8),this.maxPairsPerBodyBroadphase=Math.max(1,Math.floor(t.maxPairsPerBodyBroadphase??64)),this.maxContactsPerBodySolver=Math.max(1,Math.floor(t.maxContactsPerBodySolver??128)),this.maxJointsPerBodySolver=Au,this.maxSpringsPerBodySolver=Math.max(1,Math.floor(t.maxSpringsPerBodySolver??ju)),this.maxConstraintsPerBodySolver=this.maxContactsPerBodySolver+this.maxJointsPerBodySolver+this.maxSpringsPerBodySolver,this.haltOnBroadphaseFallbackOverflow=t.haltOnBroadphaseFallbackOverflow??!0,this.maxFixedStepsPerFrame=Math.max(1,Math.floor(t.maxFixedStepsPerFrame??2)),this.enableBvhBuild=t.enableBvhBuild??!0,this.bvhBuildOnce=t.bvhBuildOnce??!1,this.bvhRebuildIntervalFrames=Math.max(1,Math.floor(t.bvhRebuildIntervalFrames??1)),this.bvhWaitForGpuCompletion=t.bvhWaitForGpuCompletion??!1,this.avbdPairSweeps=Math.max(1,Math.min(4,Math.floor(t.avbdPairSweeps??2))),this.avbdFrictionStatic=Math.max(0,t.avbdFriction??.75),this.avbdDualUpdateBeta=Math.max(0,t.avbdDualUpdateBeta??1e4),this.avbdRegularizationAlpha=Math.max(0,Math.min(1,t.avbdRegularizationAlpha??Du)),this.avbdPenaltyDecayGamma=Math.max(0,Math.min(1,t.avbdPenaltyDecayGamma??.99)),this.avbdBodySolveMode=t.avbdBodySolveMode??`colored`;let n=t.maxBodies;if(n>65536)throw Error(`maxBodies > 65536 is not supported by packed candidate-pair encoding.`);this.pairManifoldSlots=Math.max(1,Math.min(8,Math.floor(t.pairManifoldSlots??4)));let r=Math.max(1,Number(e.limits.maxComputeWorkgroupsPerDimension??65535))*64;this.maxPairs=n*(n-1)/2,this.maxActivePairContacts=n*this.maxContactsPerBodySolver;let i=n*this.maxPairsPerBodyBroadphase;this.maxCandidatePairs=i,this.maxPairContacts=i*this.pairManifoldSlots,this.maxJoints=n*this.maxJointsPerBodySolver,this.maxSprings=n*this.maxSpringsPerBodySolver,this.bruteForceMaxBodies=Math.floor((1+Math.sqrt(1+8*this.maxCandidatePairs))*.5);let a=this.maxCandidatePairs+Tu,o=this.maxActivePairContacts+Tu,s=Math.ceil(this.maxPairs/32);this.pairCandidateIndicesOffset=0,this.pairActiveCandidateSlotsOffset=this.pairCandidateIndicesOffset+a,this.pairActiveContactsOffset=this.pairActiveCandidateSlotsOffset+a,this.pairIgnoredBitsOffset=this.pairActiveContactsOffset+o,this.pairActivityWordCount=this.pairIgnoredBitsOffset+s,this.positionsData=new Float32Array(n*4),this.initialPoseData=new Float32Array(n*8),this.initialLinearVelData=new Float32Array(n*4),this.initialAngularVelData=new Float32Array(n*4),this.inertialPoseData=new Float32Array(n*Ou),this.velocitiesData=new Float32Array(n*4),this.prevLinearVelData=new Float32Array(n*4),this.shapesData=new Float32Array(n*4),this.shapesWordData=new Uint32Array(this.shapesData.buffer),this.quaternionsData=new Float32Array(n*4),this.angularVelData=new Float32Array(n*4),this.inverseInertiaData=new Float32Array(n*4),this.derivedInvInertiaData=new Float32Array(n*12),this.pairContactsData=new Float32Array(this.maxPairContacts*36),this.jointRecordsData=new Float32Array(this.maxJoints*44),this.springRecordsData=new Float32Array(this.maxSprings*12),this.pairActivityData=new Uint32Array(this.pairActivityWordCount),this.pairCandidateIndicesData=this.pairActivityData.subarray(this.pairCandidateIndicesOffset,this.pairCandidateIndicesOffset+a),this.pairVisitedBitsData=new Uint32Array(Math.min(Math.ceil(this.maxPairs/32),r)),this.pairBodyContactCountsData=new Uint32Array(n),this.pairBodyContactIndicesData=new Uint32Array(n*this.maxContactsPerBodySolver),this.bodyConstraintCountsData=new Uint32Array(n),this.bodyConstraintRefsData=new Uint32Array(n*this.maxConstraintsPerBodySolver),this.pairActiveCandidateSlotsData=this.pairActivityData.subarray(this.pairActiveCandidateSlotsOffset,this.pairActiveCandidateSlotsOffset+a),this.pairActiveContactsData=this.pairActivityData.subarray(this.pairActiveContactsOffset,this.pairActiveContactsOffset+o),this.pairIgnoredBitsData=this.pairActivityData.subarray(this.pairIgnoredBitsOffset,this.pairIgnoredBitsOffset+s),this.pairColorBodyClaimsData=new Uint32Array(n),this.initPairTable()}initPairTable(){this.pairContactsData.fill(0),this.jointRecordsData.fill(0),this.springRecordsData.fill(0)}addBody(e){if(this.bodyCount>=this.config.maxBodies)throw Error(`Exceeded maxBodies=${this.config.maxBodies}`);let t=this.bodyCount++,n=e.mass>0?1/e.mass:0;this.positionsData[t*4+0]=e.position[0],this.positionsData[t*4+1]=e.position[1],this.positionsData[t*4+2]=e.position[2],this.positionsData[t*4+3]=n,this.initialPoseData[t*8+0]=e.position[0],this.initialPoseData[t*8+1]=e.position[1],this.initialPoseData[t*8+2]=e.position[2],this.initialPoseData[t*8+3]=n;let r=t*Ou;this.inertialPoseData[r+0]=e.position[0],this.inertialPoseData[r+1]=e.position[1],this.inertialPoseData[r+2]=e.position[2],this.inertialPoseData[r+3]=n,e.linearVelocity&&(this.velocitiesData[t*4+0]=e.linearVelocity[0],this.velocitiesData[t*4+1]=e.linearVelocity[1],this.velocitiesData[t*4+2]=e.linearVelocity[2],this.prevLinearVelData[t*4+0]=e.linearVelocity[0],this.prevLinearVelData[t*4+1]=e.linearVelocity[1],this.prevLinearVelData[t*4+2]=e.linearVelocity[2],this.initialLinearVelData[t*4+0]=e.linearVelocity[0],this.initialLinearVelData[t*4+1]=e.linearVelocity[1],this.initialLinearVelData[t*4+2]=e.linearVelocity[2]);let i=+(e.shapeType===`sphere`),a=e.shapeType===`sphere`?[e.radius,e.radius,e.radius]:e.halfExtents;this.shapesWordData[t*4+0]=sl(al(e.friction??1),ol(e.collisionGroup??1,1),ol(e.collisionMask??255,255),i),this.shapesData[t*4+1]=a[0],this.shapesData[t*4+2]=a[1],this.shapesData[t*4+3]=a[2];let o=e.quaternion??[0,0,0,1];if(this.quaternionsData[t*4+0]=o[0],this.quaternionsData[t*4+1]=o[1],this.quaternionsData[t*4+2]=o[2],this.quaternionsData[t*4+3]=o[3],this.initialPoseData[t*8+4]=o[0],this.initialPoseData[t*8+5]=o[1],this.initialPoseData[t*8+6]=o[2],this.initialPoseData[t*8+7]=o[3],this.inertialPoseData[r+4]=o[0],this.inertialPoseData[r+5]=o[1],this.inertialPoseData[r+6]=o[2],this.inertialPoseData[r+7]=o[3],this.inertialPoseData[r+8]=e.position[0],this.inertialPoseData[r+9]=e.position[1],this.inertialPoseData[r+10]=e.position[2],this.inertialPoseData[r+11]=n,this.inertialPoseData[r+12]=o[0],this.inertialPoseData[r+13]=o[1],this.inertialPoseData[r+14]=o[2],this.inertialPoseData[r+15]=o[3],e.angularVelocity&&(this.angularVelData[t*4+0]=e.angularVelocity[0],this.angularVelData[t*4+1]=e.angularVelocity[1],this.angularVelData[t*4+2]=e.angularVelocity[2],this.initialAngularVelData[t*4+0]=e.angularVelocity[0],this.initialAngularVelData[t*4+1]=e.angularVelocity[1],this.initialAngularVelData[t*4+2]=e.angularVelocity[2]),this.inverseInertiaData[t*4+3]=n,e.mass>0)if(e.lockRotation)this.inverseInertiaData[t*4+0]=0,this.inverseInertiaData[t*4+1]=0,this.inverseInertiaData[t*4+2]=0;else{let n=e.mass,r=0,i=0,a=0;if(e.shapeType===`sphere`){let t=.4*n*e.radius*e.radius;r=t,i=t,a=t}else{let[t,o,s]=e.halfExtents;r=n/3*(o*o+s*s),i=n/3*(t*t+s*s),a=n/3*(t*t+o*o)}this.inverseInertiaData[t*4+0]=1/r,this.inverseInertiaData[t*4+1]=1/i,this.inverseInertiaData[t*4+2]=1/a}if(this.initialized){let e=t*4,n=t*8,r=t*Ou,i=Ou;this.positionsAttr.addUpdateRange(e,4),this.initialPoseAttr.addUpdateRange(n,8),this.inertialPoseAttr.addUpdateRange(r,i),this.velocitiesAttr.addUpdateRange(e,4),this.prevLinearVelAttr.addUpdateRange(e,4),this.shapesAttr.addUpdateRange(e,4),this.quaternionsAttr.addUpdateRange(e,4),this.angularVelAttr.addUpdateRange(e,4),this.inverseInertiaAttr.addUpdateRange(e,4),this.positionsAttr.needsUpdate=!0,this.initialPoseAttr.needsUpdate=!0,this.inertialPoseAttr.needsUpdate=!0,this.velocitiesAttr.needsUpdate=!0,this.prevLinearVelAttr.needsUpdate=!0,this.shapesAttr.needsUpdate=!0,this.quaternionsAttr.needsUpdate=!0,this.angularVelAttr.needsUpdate=!0,this.inverseInertiaAttr.needsUpdate=!0}return this.waitingForInitialCandidatePairs=this.enableBvhBuild&&this.bodyCount>this.bruteForceMaxBodies,t}getBodyQuaternion(e){return Nu([this.quaternionsData[e*4+0]??0,this.quaternionsData[e*4+1]??0,this.quaternionsData[e*4+2]??0,this.quaternionsData[e*4+3]??1])}getBodySize(e){return[(this.shapesData[e*4+1]??0)*2,(this.shapesData[e*4+2]??0)*2,(this.shapesData[e*4+3]??0)*2]}getBodyPosition(e){return[this.positionsData[e*4+0]??0,this.positionsData[e*4+1]??0,this.positionsData[e*4+2]??0]}getBodyPoseCpu(e){return e<0||e>=this.bodyCount?null:{position:this.getBodyPosition(e),quaternion:this.getBodyQuaternion(e),halfExtents:[this.shapesData[e*4+1]??0,this.shapesData[e*4+2]??0,this.shapesData[e*4+3]??0]}}getBodyShapeType(e){return e<0||e>=this.bodyCount?null:ll(this.shapesWordData[e*4]??0)===1?`sphere`:`box`}async syncPosesFromGpuAsync(e){if(!this.initialized||!e||typeof e.getArrayBufferAsync!=`function`)return!1;let t=this.poseEpoch,n,r;try{n=await e.getArrayBufferAsync(this.positionsAttr),r=await e.getArrayBufferAsync(this.quaternionsAttr)}catch{return!1}return t===this.poseEpoch?(this.positionsData.set(new Float32Array(n)),this.quaternionsData.set(new Float32Array(r)),!0):!1}async readBodySolverStateAsync(e,t){if(!this.initialized||t<0||t>=this.bodyCount||!e||typeof e.getArrayBufferAsync!=`function`)return null;let n,r,i,a;try{[n,r,i,a]=await Promise.all([e.getArrayBufferAsync(this.inertialPoseAttr),e.getArrayBufferAsync(this.velocitiesAttr),e.getArrayBufferAsync(this.derivedInvInertiaAttr),e.getArrayBufferAsync(this.bodyConstraintCountsAttr)])}catch(e){return`solver state readback failed: ${e instanceof Error?e.message:String(e)}`}let o=new Float32Array(n),s=new Float32Array(r),c=new Float32Array(i),l=new Uint32Array(a),u=t*Ou,d=t*12,f=l[t]??0,p=(e,t)=>`[${e[t]}, ${e[t+1]}, ${e[t+2]}]`,m=(e,t)=>`[${e[t]}, ${e[t+1]}, ${e[t+2]}, ${e[t+3]}]`;return`body ${t}: inertialPos=${p(o,u)} inertialQ=${m(o,u+4)} solvePos=${p(o,u+8)} solveQ=${m(o,u+12)} vel=${p(s,t*4)} invMass=${c[d+3]} localInvI=[${c[d+6]}, ${c[d+7]}, ${c[d+9]}] constraints=${f&65535} color=${f>>16&255}`}async readContactDiagnosticsAsync(e,t,n=8){if(!this.initialized||!e||typeof e.getArrayBufferAsync!=`function`)return null;let r,i;try{[r,i]=await Promise.all([e.getArrayBufferAsync(this.pairActivityAttr),e.getArrayBufferAsync(this.pairContactsAttr)])}catch(e){return`contact readback failed: ${e instanceof Error?e.message:String(e)}`}let a=new Uint32Array(r),o=new Float32Array(i),s=this.pairActiveContactsOffset,c=Math.min(a[s]??0,this.maxActivePairContacts),l=0,u=0,d=0,f=1/0,p=-1/0,m=[];for(let e=0;e<c;e++){let r=a[s+e+1]??this.maxPairContacts;if(r>=this.maxPairContacts)continue;let i=r*36;if((o[i+2]??0)<.5)continue;l++;let c=Math.round(o[i]??-1),h=Math.round(o[i+1]??-1),g=o[i+4]??0,_=o[i+5]??0,v=o[i+6]??0,y=o[i+7]??0;!Number.isFinite(g)||!Number.isFinite(_)||!Number.isFinite(v)||!Number.isFinite(y)?d++:(f=Math.min(f,y),p=Math.max(p,y)),!(c!==t&&h!==t)&&(u++,m.length<n&&m.push(`{${c}-${h} n=[${g}, ${_}, ${v}] pen=${y}}`))}return`contacts: active=${c} valid=${l} nonFiniteN=${d} pen=[${f}, ${p}] involving body ${t}: ${u}\n`+m.join(` `)}pickDynamicBody(e,t,n){let r=n?.skip,i=1e-6,a=1/0,o=-1,s=[0,0,0],c=Math.hypot(t[0],t[1],t[2]);if(c<i)return null;let l=[t[0]/c,t[1]/c,t[2]/c];for(let t=0;t<this.bodyCount;t++){if((this.positionsData[t*4+3]??0)<=0||r?.(t))continue;let n=this.getBodyPosition(t),c=Pu(this.getBodyQuaternion(t)),u=Iu(c,[e[0]-n[0],e[1]-n[1],e[2]-n[2]]),d=Iu(c,l),f=ll(this.shapesWordData[t*4]??0),p=this.shapesData[t*4+1]??0,m=this.shapesData[t*4+2]??0,h=this.shapesData[t*4+3]??0,g=-1,_=null;if(f===1){let e=p,t=u[0]*d[0]+u[1]*d[1]+u[2]*d[2],n=u[0]*u[0]+u[1]*u[1]+u[2]*u[2]-e*e,r=t*t-n;if(r>=0){let e=Math.sqrt(r),n=-t-e,i=-t+e;g=n>=0?n:i,g>=0&&(_=[u[0]+d[0]*g,u[1]+d[1]*g,u[2]+d[2]*g])}}else{let e=[p,m,h],t=0,n=1/0,r=!0;for(let a=0;a<3;a++){let o=u[a],s=d[a],c=e[a];if(Math.abs(s)<i){if(o<-c||o>c){r=!1;break}continue}let l=1/s,f=(-c-o)*l,p=(c-o)*l;if(f>p){let e=f;f=p,p=e}if(t=Math.max(t,f),n=Math.min(n,p),t>n){r=!1;break}}r&&(g=t>=0?t:n,g>=0&&(_=[u[0]+d[0]*g,u[1]+d[1]*g,u[2]+d[2]*g]))}g<0||!_||g>=a||(a=g,o=t,s=_)}if(o<0)return null;let u=Iu(this.getBodyQuaternion(o),s),d=this.getBodyPosition(o);return{body:o,localHit:s,worldHit:[d[0]+u[0],d[1]+u[1],d[2]+u[2]],t:a}}setJointAnchorA(e,t){if(e<0||e>=this.jointCount)return!1;let n=Q(e,1);return this.jointRecordsData[n+0]=t[0],this.jointRecordsData[n+1]=t[1],this.jointRecordsData[n+2]=t[2],this.initialized&&(this.jointRecordsAttr.addUpdateRange(n,3),this.jointRecordsAttr.needsUpdate=!0),!0}disableJoint(e){return this.setJointEnabled(e,!1)}setJointEnabled(e,t){if(e<0||e>=this.jointCount)return!1;let n=Q(e,0),r=new Uint32Array(this.jointRecordsData.buffer,n*4,4),i=+!!t;if(r[3]===i)return!1;if(r[3]=i,this.initialized){let t=e*11*4;this.jointRecordsAttr.addUpdateRange(t,44),this.jointRecordsAttr.needsUpdate=!0}return!0}setDragJoint(e,t,n,r,i=null){if(i!==null&&i>=0&&i<this.jointCount){let a=i,o=this.getBodySize(e),s=o[0]*o[0]+o[1]*o[1]+o[2]*o[2],c=Q(a,0),l=new Uint32Array(this.jointRecordsData.buffer,c*4,4);l[0]=ku>>>0,l[1]=e>>>0,l[2]=0,l[3]=1;let u=Q(a,1);this.jointRecordsData[u+0]=t[0],this.jointRecordsData[u+1]=t[1],this.jointRecordsData[u+2]=t[2],this.jointRecordsData[u+3]=s;let d=Q(a,2);this.jointRecordsData[d+0]=n[0],this.jointRecordsData[d+1]=n[1],this.jointRecordsData[d+2]=n[2],this.jointRecordsData[d+3]=0;let f=Q(a,3),p=this.getBodyQuaternion(e);this.jointRecordsData[f+0]=p[0],this.jointRecordsData[f+1]=p[1],this.jointRecordsData[f+2]=p[2],this.jointRecordsData[f+3]=p[3];let m=Q(a,4),h=Math.max(r,Eu);this.jointRecordsData[m+0]=h,this.jointRecordsData[m+1]=0,this.jointRecordsData[m+2]=0,this.jointRecordsData[m+3]=0;for(let e of[5,6,7,8,9,10]){let t=Q(a,e);this.jointRecordsData.fill(0,t,t+4)}if(this.initialized){let e=a*11*4;this.jointRecordsAttr.addUpdateRange(e,44),this.jointRecordsAttr.needsUpdate=!0}return a}return this.addSphericalJoint(null,e,t,n,r,!1)}setBodyShapeHalfExtents(e,t){e<0||e>=this.bodyCount||(this.shapesData[e*4+1]=t[0],this.shapesData[e*4+2]=t[1],this.shapesData[e*4+3]=t[2],this.initialized&&(this.shapesAttr.addUpdateRange(e*4,4),this.shapesAttr.needsUpdate=!0))}setBodyVelocity(e,t,n){if(e<0||e>=this.bodyCount)return;let r=e*4;for(let e=0;e<3;e++)t&&(this.velocitiesData[r+e]=t[e],this.prevLinearVelData[r+e]=t[e]),n&&(this.angularVelData[r+e]=n[e]);this.initialized&&(t&&(this.velocitiesAttr.addUpdateRange(r,3),this.velocitiesAttr.needsUpdate=!0,this.prevLinearVelAttr.addUpdateRange(r,3),this.prevLinearVelAttr.needsUpdate=!0),n&&(this.angularVelAttr.addUpdateRange(r,3),this.angularVelAttr.needsUpdate=!0))}setBodyPose(e,t,n,r,i){if(e<0||e>=this.bodyCount)return;let a=e*4,o=e*8,s=e*Ou;if(this.positionsData[a+0]=t[0],this.positionsData[a+1]=t[1],this.positionsData[a+2]=t[2],this.initialPoseData[o+0]=t[0],this.initialPoseData[o+1]=t[1],this.initialPoseData[o+2]=t[2],this.inertialPoseData[s+0]=t[0],this.inertialPoseData[s+1]=t[1],this.inertialPoseData[s+2]=t[2],this.inertialPoseData[s+8]=t[0],this.inertialPoseData[s+9]=t[1],this.inertialPoseData[s+10]=t[2],n){let e=Nu(n);this.quaternionsData[a+0]=e[0],this.quaternionsData[a+1]=e[1],this.quaternionsData[a+2]=e[2],this.quaternionsData[a+3]=e[3],this.initialPoseData[o+4]=e[0],this.initialPoseData[o+5]=e[1],this.initialPoseData[o+6]=e[2],this.initialPoseData[o+7]=e[3],this.inertialPoseData[s+4]=e[0],this.inertialPoseData[s+5]=e[1],this.inertialPoseData[s+6]=e[2],this.inertialPoseData[s+7]=e[3],this.inertialPoseData[s+12]=e[0],this.inertialPoseData[s+13]=e[1],this.inertialPoseData[s+14]=e[2],this.inertialPoseData[s+15]=e[3]}r&&(this.velocitiesData[a+0]=r[0],this.velocitiesData[a+1]=r[1],this.velocitiesData[a+2]=r[2],this.prevLinearVelData[a+0]=r[0],this.prevLinearVelData[a+1]=r[1],this.prevLinearVelData[a+2]=r[2]),i&&(this.angularVelData[a+0]=i[0],this.angularVelData[a+1]=i[1],this.angularVelData[a+2]=i[2]),this.initialized&&(this.positionsAttr.addUpdateRange(a,4),this.positionsAttr.needsUpdate=!0,this.initialPoseAttr.addUpdateRange(o,8),this.initialPoseAttr.needsUpdate=!0,this.inertialPoseAttr.addUpdateRange(s,Ou),this.inertialPoseAttr.needsUpdate=!0,n&&(this.quaternionsAttr.addUpdateRange(a,4),this.quaternionsAttr.needsUpdate=!0),r&&(this.velocitiesAttr.addUpdateRange(a,4),this.velocitiesAttr.needsUpdate=!0,this.prevLinearVelAttr.addUpdateRange(a,4),this.prevLinearVelAttr.needsUpdate=!0),i&&(this.angularVelAttr.addUpdateRange(a,4),this.angularVelAttr.needsUpdate=!0))}appendJoint(e){if(this.jointCount>=this.maxJoints)throw Error(`Exceeded maxJoints=${this.maxJoints}`);if(e.bodyB<0||e.bodyB>=this.bodyCount)throw Error(`Invalid joint bodyB=${e.bodyB}`);if(e.bodyA!==null&&(e.bodyA<0||e.bodyA>=this.bodyCount))throw Error(`Invalid joint bodyA=${e.bodyA}`);let t=this.jointCount++,n=e.bodyA??ku,r=e.bodyB,i=+(e.type===`fixed`),a=Math.max(e.stiffness??1e6,Eu),o=e.bodyA===null?[0,0,0]:this.getBodySize(e.bodyA),s=this.getBodySize(r),c=(o[0]+s[0])*(o[0]+s[0])+(o[1]+s[1])*(o[1]+s[1])+(o[2]+s[2])*(o[2]+s[2]),l=e.bodyA===null?[0,0,0,1]:this.getBodyQuaternion(e.bodyA),u=this.getBodyQuaternion(r),d=Nu(Fu(Pu(l),u)),f=Q(t,0),p=new Uint32Array(this.jointRecordsData.buffer,f*4,4);p[0]=n>>>0,p[1]=r>>>0,p[2]=i>>>0,p[3]=1;let m=Q(t,1);this.jointRecordsData[m+0]=e.anchorA[0],this.jointRecordsData[m+1]=e.anchorA[1],this.jointRecordsData[m+2]=e.anchorA[2],this.jointRecordsData[m+3]=c;let h=Q(t,2);this.jointRecordsData[h+0]=e.anchorB[0],this.jointRecordsData[h+1]=e.anchorB[1],this.jointRecordsData[h+2]=e.anchorB[2],this.jointRecordsData[h+3]=0;let g=Q(t,3);this.jointRecordsData[g+0]=d[0],this.jointRecordsData[g+1]=d[1],this.jointRecordsData[g+2]=d[2],this.jointRecordsData[g+3]=d[3];let _=Q(t,4);this.jointRecordsData[_+0]=a,this.jointRecordsData[_+1]=i===1?a:0,this.jointRecordsData[_+2]=0,this.jointRecordsData[_+3]=0;let v=Q(t,5),y=Q(t,6),b=Q(t,7),x=Q(t,8),S=Q(t,9),C=Q(t,10);if(this.jointRecordsData.fill(0,v,v+4),this.jointRecordsData.fill(0,y,y+4),this.jointRecordsData.fill(0,b,b+4),this.jointRecordsData.fill(0,x,x+4),this.jointRecordsData.fill(0,S,S+4),this.jointRecordsData.fill(0,C,C+4),this.initialized){let e=t*11*4;this.jointRecordsAttr.addUpdateRange(e,44),this.jointRecordsAttr.needsUpdate=!0}return(e.disableCollision??!0)&&e.bodyA!==null&&e.bodyA!==e.bodyB&&this.setPairCollisionIgnored(e.bodyA,e.bodyB,!0),t}appendSpring(e){if(this.springCount>=this.maxSprings)throw Error(`Exceeded maxSprings=${this.maxSprings}`);if(e.bodyB<0||e.bodyB>=this.bodyCount)throw Error(`Invalid spring bodyB=${e.bodyB}`);if(e.bodyA!==null&&(e.bodyA<0||e.bodyA>=this.bodyCount))throw Error(`Invalid spring bodyA=${e.bodyA}`);let t=this.springCount++,n=e.bodyA??ku,r=e.bodyB,i=Math.max(e.stiffness??100,0),a=e.bodyA===null?[0,0,0,1]:this.getBodyQuaternion(e.bodyA),o=this.getBodyQuaternion(r),s=e.bodyA===null?e.anchorA:this.getBodyPosition(e.bodyA),c=this.getBodyPosition(r),l=e.bodyA===null?e.anchorA:(()=>{let t=Iu(a,e.anchorA);return[s[0]+t[0],s[1]+t[1],s[2]+t[2]]})(),u=(()=>{let t=Iu(o,e.anchorB);return[c[0]+t[0],c[1]+t[1],c[2]+t[2]]})(),d=Math.max(e.restLength??Math.hypot(l[0]-u[0],l[1]-u[1],l[2]-u[2]),0),f=Hn(t,0),p=new Uint32Array(this.springRecordsData.buffer,f*4,4);p[0]=n>>>0,p[1]=r>>>0,p[2]=1,p[3]=0;let m=Hn(t,1);this.springRecordsData[m+0]=e.anchorA[0],this.springRecordsData[m+1]=e.anchorA[1],this.springRecordsData[m+2]=e.anchorA[2],this.springRecordsData[m+3]=d;let h=Hn(t,2);if(this.springRecordsData[h+0]=e.anchorB[0],this.springRecordsData[h+1]=e.anchorB[1],this.springRecordsData[h+2]=e.anchorB[2],this.springRecordsData[h+3]=i,this.initialized){let e=t*3*4;this.springRecordsAttr.addUpdateRange(e,12),this.springRecordsAttr.needsUpdate=!0}return(e.disableCollision??!1)&&e.bodyA!==null&&e.bodyA!==e.bodyB&&this.setPairCollisionIgnored(e.bodyA,e.bodyB,!0),t}getSpringCount(){return this.springCount}disableSpring(e){if(e<0||e>=this.springCount)return!1;let t=Hn(e,0),n=new Uint32Array(this.springRecordsData.buffer,t*4,4);if(n[2]===0)return!1;if(n[2]=0,this.initialized){let t=e*3*4;this.springRecordsAttr.addUpdateRange(t,12),this.springRecordsAttr.needsUpdate=!0}return!0}setPairCollisionIgnored(e,t,n){let r=Mu(e,t);if(r<0||r>=this.maxPairs)return;let i=r>>5,a=1<<(r&31);i>=this.pairIgnoredBitsData.length||(n?this.pairIgnoredBitsData[i]=(this.pairIgnoredBitsData[i]??0)|a:this.pairIgnoredBitsData[i]=(this.pairIgnoredBitsData[i]??0)&~a,this.initialized&&(this.pairActivityAttr.addUpdateRange(this.pairIgnoredBitsOffset+i,1),this.pairActivityAttr.needsUpdate=!0))}setBodyPairCollisionIgnored(e,t,n=!0){e<0||e>=this.bodyCount||t<0||t>=this.bodyCount||e!==t&&this.setPairCollisionIgnored(e,t,n)}setBodyCollisionFilter(e,t,n){if(e<0||e>=this.bodyCount)return;let r=e*4,i=this.shapesWordData[r]??0,a=cl(i),o=ll(i);this.shapesWordData[r]=sl(a,ol(t,1),ol(n,255),o),this.initialized&&(this.shapesAttr.addUpdateRange(r,1),this.shapesAttr.needsUpdate=!0)}setBodyMass(e,t,n){if(e<0||e>=this.bodyCount)return;let r=t>0?1/t:0,i=e*4,a=e*Ou;this.positionsData[i+3]=r,this.inertialPoseData[a+3]=r,this.inertialPoseData[a+11]=r,this.inverseInertiaData[i+3]=r;let o=0,s=0,c=0;if(t>0&&!n?.lockRotation){let e=this.shapesData[i+1]??0,n=this.shapesData[i+2]??0,r=this.shapesData[i+3]??0,a,l,u;ll(this.shapesWordData[i]??0)===1?(a=.4*t*e*e,l=a,u=a):(a=t/3*(n*n+r*r),l=t/3*(e*e+r*r),u=t/3*(e*e+n*n)),o=a>0?1/a:0,s=l>0?1/l:0,c=u>0?1/u:0}this.inverseInertiaData[i+0]=o,this.inverseInertiaData[i+1]=s,this.inverseInertiaData[i+2]=c,this.initialized&&(this.positionsAttr.addUpdateRange(i+3,1),this.positionsAttr.needsUpdate=!0,this.inertialPoseAttr.addUpdateRange(a+3,1),this.inertialPoseAttr.addUpdateRange(a+11,1),this.inertialPoseAttr.needsUpdate=!0,this.inverseInertiaAttr.addUpdateRange(i,4),this.inverseInertiaAttr.needsUpdate=!0)}getKinematicDriveBuffers(){return this.initialized?{positions:this.positionsAttr,quaternions:this.quaternionsAttr,velocities:this.velocitiesAttr,angularVelocities:this.angularVelAttr}:null}addSphericalJoint(e,t,n,r,i=1e6,a=!0){return this.appendJoint({type:`spherical`,bodyA:e,bodyB:t,anchorA:n,anchorB:r,stiffness:i,disableCollision:a})}addFixedJoint(e,t,n,r,i=1e6,a=!0){return this.appendJoint({type:`fixed`,bodyA:e,bodyB:t,anchorA:n,anchorB:r,stiffness:i,disableCollision:a})}addSpring(e,t,n,r,i=100,a,o=!0){return this.appendSpring({bodyA:e,bodyB:t,anchorA:n,anchorB:r,stiffness:i,restLength:a,disableCollision:o})}initGPU(){if(this.initialized)return;this.initialized=!0;let e=this.config.maxBodies;this.positionsAttr=new q(this.positionsData,4),this.initialPoseAttr=new q(this.initialPoseData,4),this.inertialPoseAttr=new q(this.inertialPoseData,4),this.velocitiesAttr=new q(this.velocitiesData,4),this.prevLinearVelAttr=new q(this.prevLinearVelData,4),this.shapesAttr=new q(this.shapesData,4),this.quaternionsAttr=new q(this.quaternionsData,4),this.angularVelAttr=new q(this.angularVelData,4),this.inverseInertiaAttr=new q(this.inverseInertiaData,4),this.derivedInvInertiaAttr=new q(this.derivedInvInertiaData,4),this.pairContactsAttr=new q(this.pairContactsData,4),this.jointRecordsAttr=new q(this.jointRecordsData,4),this.springRecordsAttr=new q(this.springRecordsData,4),this.pairActivityAttr=new q(this.pairActivityData,1),this.pairCandidateIndicesAttr=this.pairActivityAttr,this.pairVisitedBitsAttr=new q(this.pairVisitedBitsData,1),this.pairBodyContactCountsAttr=new q(this.pairBodyContactCountsData,1),this.pairBodyContactIndicesAttr=new q(this.pairBodyContactIndicesData,1),this.bodyConstraintCountsAttr=new q(this.bodyConstraintCountsData,1),this.bodyConstraintRefsAttr=new q(this.bodyConstraintRefsData,1),this.pairActiveCandidateSlotsAttr=this.pairActivityAttr,this.pairActiveContactsAttr=this.pairActivityAttr,this.pairColorBodyClaimsAttr=new q(this.pairColorBodyClaimsData,1),this.integration=new nl(this.positionsAttr,this.initialPoseAttr,this.inertialPoseAttr,this.velocitiesAttr,this.prevLinearVelAttr,this.quaternionsAttr,this.angularVelAttr,this.config.gravity,e),this.derivedInertia=new Cu(this.quaternionsAttr,this.inverseInertiaAttr,this.derivedInvInertiaAttr,e),this.contactGeneration=new pl(this.positionsAttr,this.quaternionsAttr,this.shapesAttr,this.pairContactsAttr,this.pairActivityAttr,this.pairBodyContactCountsAttr,this.pairBodyContactIndicesAttr,e,this.maxPairContacts,this.pairManifoldSlots,this.maxContactsPerBodySolver,this.maxActivePairContacts,this.pairCandidateIndicesOffset,this.pairActiveCandidateSlotsOffset,this.pairActiveContactsOffset,this.pairIgnoredBitsOffset,this.pairActivityWordCount),this.contactGeneration.setDebugEnabled(this.debugBehaviorEnabled),this.contactGeneration.setDebugLogInterval(this.debugLogEveryNFrames),this.broadPhase=new xu(this.device,this.positionsAttr,this.velocitiesAttr,this.quaternionsAttr,this.shapesAttr,this.pairActivityAttr,this.pairCandidateIndicesAttr,this.pairVisitedBitsAttr,e,this.maxCandidatePairs,this.maxPairsPerBodyBroadphase,this.pairIgnoredBitsOffset,{enableBvhBuild:this.enableBvhBuild,buildOnce:this.bvhBuildOnce,rebuildIntervalFrames:this.bvhRebuildIntervalFrames,waitForGpuCompletion:this.bvhWaitForGpuCompletion}),this.broadPhase.setDebugEnabled(this.debugBehaviorEnabled),this.broadPhase.setDebugLogInterval(this.debugLogEveryNFrames),this.avbdState=new Nl(this.pairContactsAttr,this.jointRecordsAttr,this.springRecordsAttr,this.positionsAttr,this.initialPoseAttr,this.inertialPoseAttr,this.quaternionsAttr,this.velocitiesAttr,this.prevLinearVelAttr,this.angularVelAttr,this.inverseInertiaAttr,this.derivedInvInertiaAttr,this.bodyConstraintCountsAttr,this.bodyConstraintRefsAttr,this.pairBodyContactCountsAttr,this.pairBodyContactIndicesAttr,this.pairColorBodyClaimsAttr,this.pairActivityAttr,e,this.maxPairContacts,this.maxJoints,this.maxSprings,this.maxActivePairContacts,this.maxConstraintsPerBodySolver,this.maxContactsPerBodySolver,this.pairManifoldSlots,this.pairActiveContactsOffset,this.pairActivityWordCount),this.avbdState.setDebugEnabled(this.debugBehaviorEnabled),this.avbdState.setDebugLogInterval(this.debugLogEveryNFrames),this.avbdState.setFriction(this.avbdFrictionStatic,this.avbdFrictionStatic),this.avbdState.setDualUpdateBeta(this.avbdDualUpdateBeta),this.avbdState.setPenaltyDecayGamma(this.avbdPenaltyDecayGamma),this.avbdState.setPenaltyFloor(this.avbdPenaltyFloor),this.avbdState.setPreventPenetratingNormalDropout(this.avbdPreventPenetratingNormalDropout),this.contactGeneration.setFriction(this.avbdFrictionStatic),this.playerControl=new wu(this.positionsAttr,this.velocitiesAttr,this.angularVelAttr,this.pairBodyContactCountsAttr,this.pairBodyContactIndicesAttr,this.pairContactsAttr,e,this.maxPairContacts,this.maxContactsPerBodySolver)}step(e,t){if(this.bodyCount===0)return;this.frameId++,this.stats.frameCount=this.frameId;let n=!this.initialized;this.initGPU(),n&&(this.positionsAttr.needsUpdate=!0,this.initialPoseAttr.needsUpdate=!0,this.inertialPoseAttr.needsUpdate=!0,this.velocitiesAttr.needsUpdate=!0,this.prevLinearVelAttr.needsUpdate=!0,this.shapesAttr.needsUpdate=!0,this.quaternionsAttr.needsUpdate=!0,this.angularVelAttr.needsUpdate=!0,this.inverseInertiaAttr.needsUpdate=!0,this.derivedInvInertiaAttr.needsUpdate=!0,this.pairContactsAttr.needsUpdate=!0,this.jointRecordsAttr.needsUpdate=!0,this.pairActivityAttr.needsUpdate=!0,this.pairCandidateIndicesAttr.needsUpdate=!0,this.pairVisitedBitsAttr.needsUpdate=!0,this.pairBodyContactCountsAttr.needsUpdate=!0,this.pairBodyContactIndicesAttr.needsUpdate=!0,this.bodyConstraintCountsAttr.needsUpdate=!0,this.bodyConstraintRefsAttr.needsUpdate=!0,this.pairActiveCandidateSlotsAttr.needsUpdate=!0,this.pairActiveContactsAttr.needsUpdate=!0,this.pairColorBodyClaimsAttr.needsUpdate=!0),this.accumulator+=Math.min(e,.05);let r=performance.now(),i=Math.floor(this.accumulator/this.config.deltaTime),a=Math.min(i,this.maxFixedStepsPerFrame),o=!1;if(a>0){let e=this.bodyCount*(this.bodyCount-1)/2,n=Math.min(e,this.maxCandidatePairs),i=n,s=Math.min(e*this.pairManifoldSlots,this.bodyCount*this.maxContactsPerBodySolver),c=performance.now();this.broadPhase.dispatch(t,this.bodyCount,e,this.frameId),this.stats.broadPhaseMs=Math.max(performance.now()-c,this.broadPhase.getLastBuildMs());let l=this.broadPhase.hasCandidatePairs(),u=this.broadPhase.isReady(),d=this.enableBvhBuild&&this.bodyCount>this.bruteForceMaxBodies,f=l&&d,p=!f&&this.bodyCount>this.bruteForceMaxBodies;if(this.waitingForInitialCandidatePairs&&d){if(!l){this.stats.broadPhaseReady=u,this.stats.candidatePairsEnabled=f,this.stats.pairDispatchTruncated=p,this.accumulator=0,this.stats.totalMs=performance.now()-r,this.stats.bodyCount=this.bodyCount,this.stats.frameCount=this.frameId;return}this.waitingForInitialCandidatePairs=!1}else d||(this.waitingForInitialCandidatePairs=!1);let m=!u&&this.enableBvhBuild;if(p&&!this.pairDispatchTruncationWarned?(m?console.warn(`Broadphase BVH is still building at bodyCount=${this.bodyCount}. Pausing physics until candidate pairs become available (brute-force safe limit=${this.bruteForceMaxBodies}).`):console.error(`Broadphase candidate pairs are disabled and bodyCount (${this.bodyCount}) exceeds brute-force safe limit (${this.bruteForceMaxBodies}). Pausing physics to avoid incomplete collisions.`),this.pairDispatchTruncationWarned=!0):p||(this.pairDispatchTruncationWarned=!1),this.stats.broadPhaseReady=u,this.stats.candidatePairsEnabled=f,this.stats.pairDispatchTruncated=p,p&&this.haltOnBroadphaseFallbackOverflow){this.accumulator=0,this.stats.totalMs=performance.now()-r,this.stats.bodyCount=this.bodyCount,this.stats.frameCount=this.frameId;return}if(f){let e=Math.min(this.maxCandidatePairs,this.bodyCount*this.maxPairsPerBodyBroadphase);n=e,i=e}let h=this.config.deltaTime/this.config.substeps;for(let r=0;r<a;r++){for(let r=0;r<this.config.substeps;r++)o=!0,this.substep(h,t,e,n,i,s,f);this.accumulator-=this.config.deltaTime}}i>a&&(this.accumulator=Math.min(this.accumulator,this.config.deltaTime)),this.stats.totalMs=performance.now()-r,this.stats.bodyCount=this.bodyCount,o&&this.logSupportDiagnostics(t)}substep(e,t,n,r,i,a,o){let s;s=performance.now(),this.integration.dispatch(t,this.bodyCount,e),this.stats.integrationMs=performance.now()-s,s=performance.now(),this.contactGeneration.setFloorDebugBody(this.debugBehaviorEnabled?this.findSupportFloorBody(this.positionsData,this.shapesData).body:-1),this.contactGeneration.dispatchPairKernelPhase(t,this.bodyCount,n,r,o),this.contactGeneration.dispatchBodyListPhase(t,this.bodyCount,r,this.frameId);let c=this.avbdRegularizationAlpha,l=c,u=this.avbdPairSweeps,d=this.solverIterations,f={relaxation:1,maxLinearCorrection:1e9,maxAngularCorrection:1e9},p=this.avbdDualUpdateBeta,m=c*this.avbdPenaltyDecayGamma;this.avbdState.prepare(t,this.bodyCount,a,this.jointCount,this.springCount,this.activePairSolveColorCount,m,e,this.avbdBodySolveMode),this.avbdState.setDualUpdateBeta(p),this.avbdState.clearPhaseDebugCounters(t);let h=this.avbdState.usesDerivedInertiaInPrimalSolve();for(let n=0;n<d;n++)h&&this.derivedInertia.dispatch(t,this.bodyCount),this.avbdState.primalSolveBodies(t,this.bodyCount,u,this.activePairSolveColorCount,c,e,1,l,f,0,0,void 0,this.avbdBodySolveMode),this.avbdState.captureFromSolve(t,a,this.jointCount,e,c,n);this.avbdState.finalizeVelocities(t,this.bodyCount,e),this.avbdState.capturePhaseDebug(t,a,c,0,1,l),this.avbdState.maybeLogDebug(t,this.frameId,a,this.bodyCount),this.stats.solverMs=performance.now()-s,this.stats.velocityUpdateMs=0}getBodyCount(){return this.bodyCount}dispose(e){this.broadPhase?.dispose?.();let t=e._attributes;if(t)for(let e of Object.values(this))e instanceof ot&&t.delete(e);this.initialized=!1}clearScene(){this.poseEpoch++,this.broadPhase?.reset?.(),this.bodyCount=0,this.jointCount=0,this.springCount=0,this.pairContactsData.fill(0),this.jointRecordsData.fill(0),this.springRecordsData.fill(0),this.pairActivityData.fill(0),this.pairVisitedBitsData.fill(0),this.pairBodyContactCountsData.fill(0),this.pairBodyContactIndicesData.fill(0),this.bodyConstraintCountsData.fill(0),this.bodyConstraintRefsData.fill(0),this.pairColorBodyClaimsData.fill(0),this.accumulator=0,this.frameId=0,this.pairDispatchTruncationWarned=!1,this.waitingForInitialCandidatePairs=!1,this.supportDebugReadbackInFlight=!1,this.lastSupportDebugLogFrame=-1,this.prevSupportBodyCount=-1,this.prevCandidatePairsForChurn=null,this.prevFloorCandidatePairsForChurn=null,this.stats.bodyCount=0,this.stats.frameCount=0,this.stats.totalMs=0,this.stats.integrationMs=0,this.stats.broadPhaseMs=0,this.stats.solverMs=0,this.stats.velocityUpdateMs=0,this.stats.broadPhaseReady=!1,this.stats.candidatePairsEnabled=!1,this.stats.pairDispatchTruncated=!1,this.initialized&&(this.pairContactsAttr.needsUpdate=!0,this.jointRecordsAttr.needsUpdate=!0,this.springRecordsAttr.needsUpdate=!0,this.pairActivityAttr.needsUpdate=!0,this.pairVisitedBitsAttr.needsUpdate=!0,this.pairBodyContactCountsAttr.needsUpdate=!0,this.pairBodyContactIndicesAttr.needsUpdate=!0,this.bodyConstraintCountsAttr.needsUpdate=!0,this.bodyConstraintRefsAttr.needsUpdate=!0,this.pairColorBodyClaimsAttr.needsUpdate=!0)}resetSimulationToInitialPose(){if(!(this.bodyCount<=0)){this.poseEpoch++;for(let e=0;e<this.bodyCount;e++){let t=e*4,n=e*8,r=e*Ou;this.positionsData[t+0]=this.initialPoseData[n+0],this.positionsData[t+1]=this.initialPoseData[n+1],this.positionsData[t+2]=this.initialPoseData[n+2],this.positionsData[t+3]=this.initialPoseData[n+3],this.inertialPoseData[r+0]=this.initialPoseData[n+0],this.inertialPoseData[r+1]=this.initialPoseData[n+1],this.inertialPoseData[r+2]=this.initialPoseData[n+2],this.inertialPoseData[r+3]=this.initialPoseData[n+3],this.quaternionsData[t+0]=this.initialPoseData[n+4],this.quaternionsData[t+1]=this.initialPoseData[n+5],this.quaternionsData[t+2]=this.initialPoseData[n+6],this.quaternionsData[t+3]=this.initialPoseData[n+7],this.inertialPoseData[r+4]=this.initialPoseData[n+4],this.inertialPoseData[r+5]=this.initialPoseData[n+5],this.inertialPoseData[r+6]=this.initialPoseData[n+6],this.inertialPoseData[r+7]=this.initialPoseData[n+7],this.inertialPoseData[r+8]=this.initialPoseData[n+0],this.inertialPoseData[r+9]=this.initialPoseData[n+1],this.inertialPoseData[r+10]=this.initialPoseData[n+2],this.inertialPoseData[r+11]=this.initialPoseData[n+3],this.inertialPoseData[r+12]=this.initialPoseData[n+4],this.inertialPoseData[r+13]=this.initialPoseData[n+5],this.inertialPoseData[r+14]=this.initialPoseData[n+6],this.inertialPoseData[r+15]=this.initialPoseData[n+7],this.velocitiesData[t+0]=this.initialLinearVelData[t+0],this.velocitiesData[t+1]=this.initialLinearVelData[t+1],this.velocitiesData[t+2]=this.initialLinearVelData[t+2],this.velocitiesData[t+3]=this.initialLinearVelData[t+3],this.prevLinearVelData[t+0]=this.initialLinearVelData[t+0],this.prevLinearVelData[t+1]=this.initialLinearVelData[t+1],this.prevLinearVelData[t+2]=this.initialLinearVelData[t+2],this.prevLinearVelData[t+3]=this.initialLinearVelData[t+3],this.angularVelData[t+0]=this.initialAngularVelData[t+0],this.angularVelData[t+1]=this.initialAngularVelData[t+1],this.angularVelData[t+2]=this.initialAngularVelData[t+2],this.angularVelData[t+3]=this.initialAngularVelData[t+3]}this.pairContactsData.fill(0);for(let e=0;e<this.jointCount;e++){let t=Q(e,5),n=Q(e,6),r=Q(e,7),i=Q(e,8),a=Q(e,9),o=Q(e,10);this.jointRecordsData.fill(0,t,t+4),this.jointRecordsData.fill(0,n,n+4),this.jointRecordsData.fill(0,r,r+4),this.jointRecordsData.fill(0,i,i+4),this.jointRecordsData.fill(0,a,a+4),this.jointRecordsData.fill(0,o,o+4)}this.pairCandidateIndicesData.fill(0),this.pairActiveCandidateSlotsData.fill(0),this.pairActiveContactsData.fill(0),this.pairVisitedBitsData.fill(0),this.pairBodyContactCountsData.fill(0),this.pairBodyContactIndicesData.fill(0),this.bodyConstraintCountsData.fill(0),this.bodyConstraintRefsData.fill(0),this.pairColorBodyClaimsData.fill(0),this.accumulator=0,this.frameId=0,this.pairDispatchTruncationWarned=!1,this.waitingForInitialCandidatePairs=this.enableBvhBuild&&this.bodyCount>this.bruteForceMaxBodies,this.supportDebugReadbackInFlight=!1,this.lastSupportDebugLogFrame=-1,this.prevSupportBodyCount=-1,this.prevCandidatePairsForChurn=null,this.prevFloorCandidatePairsForChurn=null,this.stats.totalMs=0,this.stats.frameCount=0,this.stats.integrationMs=0,this.stats.broadPhaseMs=0,this.stats.solverMs=0,this.stats.velocityUpdateMs=0,this.stats.broadPhaseReady=!1,this.stats.candidatePairsEnabled=!1,this.stats.pairDispatchTruncated=!1,this.initialized&&(this.positionsAttr.needsUpdate=!0,this.inertialPoseAttr.needsUpdate=!0,this.velocitiesAttr.needsUpdate=!0,this.prevLinearVelAttr.needsUpdate=!0,this.quaternionsAttr.needsUpdate=!0,this.angularVelAttr.needsUpdate=!0,this.pairContactsAttr.needsUpdate=!0,this.jointRecordsAttr.needsUpdate=!0,this.pairActivityAttr.needsUpdate=!0,this.pairVisitedBitsAttr.needsUpdate=!0,this.pairBodyContactCountsAttr.needsUpdate=!0,this.pairBodyContactIndicesAttr.needsUpdate=!0,this.bodyConstraintCountsAttr.needsUpdate=!0,this.bodyConstraintRefsAttr.needsUpdate=!0,this.pairColorBodyClaimsAttr.needsUpdate=!0)}}setDeltaTime(e){let t=Math.max(1/500,Math.min(1/10,e));this.config.deltaTime=t,this.accumulator=Math.min(this.accumulator,t)}setSubsteps(e){let t=Math.max(1,Math.min(8,Math.floor(e)));this.config.substeps=t}getSubsteps(){return this.config.substeps}getPairManifoldSlots(){return this.pairManifoldSlots}setAvbdPairSweeps(e){this.avbdPairSweeps=Math.max(1,Math.min(4,Math.floor(e)))}getAvbdPairSweeps(){return this.avbdPairSweeps}setPairSolveColorCount(e){let t=Math.max(1,Math.min(this.maxPairSolveColorCount,Math.floor(e)));this.activePairSolveColorCount=t}setSolverIterations(e){let t=Math.max(1,Math.min(64,Math.floor(e)));this.solverIterations=t}getSolverIterations(){return this.solverIterations}setAvbdDualUpdateBeta(e){let t=Math.max(0,e);this.avbdDualUpdateBeta=t,this.avbdState?.setDualUpdateBeta?.(t)}getAvbdDualUpdateBeta(){return this.avbdDualUpdateBeta}setAvbdPreventPenetratingNormalDropout(e){this.avbdPreventPenetratingNormalDropout=!!e,this.avbdState?.setPreventPenetratingNormalDropout?.(this.avbdPreventPenetratingNormalDropout)}getAvbdPreventPenetratingNormalDropout(){return this.avbdPreventPenetratingNormalDropout}setAvbdBodySolveMode(e){this.avbdBodySolveMode=e}getAvbdBodySolveMode(){return this.avbdBodySolveMode}setAvbdPenaltyDecayGamma(e){let t=Math.max(0,Math.min(1,e));this.avbdPenaltyDecayGamma=t,this.avbdState?.setPenaltyDecayGamma?.(t)}getAvbdPenaltyDecayGamma(){return this.avbdPenaltyDecayGamma}setAvbdPenaltyFloor(e){let t=Math.max(1e-6,e);this.avbdPenaltyFloor=t,this.avbdState?.setPenaltyFloor?.(t)}getAvbdPenaltyFloor(){return this.avbdPenaltyFloor}setAvbdRegularizationAlpha(e){this.avbdRegularizationAlpha=Math.max(0,Math.min(1,e))}getAvbdRegularizationAlpha(){return this.avbdRegularizationAlpha}setAvbdFriction(e){let t=Math.max(0,Math.min(2,e));this.avbdFrictionStatic=t,this.contactGeneration?.setFriction?.(t),this.avbdState?.setFriction?.(t,t)}getAvbdFriction(){return this.avbdFrictionStatic}getRenderBuffers(){return this.initialized?{positions:this.positionsAttr,quaternions:this.quaternionsAttr}:null}getContactRenderBuffers(){return this.initialized?{positions:this.positionsAttr,quaternions:this.quaternionsAttr,pairContacts:this.pairContactsAttr,pairActivity:this.pairActivityAttr,maxPairContacts:this.maxPairContacts,maxActivePairContacts:this.maxActivePairContacts,pairActivityWordCount:this.pairActivityWordCount,pairActiveContactsOffset:this.pairActiveContactsOffset}:null}getSpringRenderBuffers(){return this.initialized?{positions:this.positionsAttr,quaternions:this.quaternionsAttr,springRecords:this.springRecordsAttr,maxSprings:this.maxSprings}:null}getMaxActiveContactDebugPoints(){return this.maxActivePairContacts}setDebugBehaviorEnabled(e){this.debugBehaviorEnabled=e,this.broadPhase?.setDebugEnabled?.(e),this.contactGeneration?.setDebugEnabled?.(e),this.avbdState?.setDebugEnabled?.(e),this.supportDebugReadbackInFlight=!1,this.lastSupportDebugLogFrame=-1,this.prevSupportBodyCount=-1,this.prevCandidatePairsForChurn=null,this.prevFloorCandidatePairsForChurn=null}setDebugEnabled(e){this.setDebugBehaviorEnabled(e)}setDebugLogEveryFrame(e){let t=e?1:30;this.debugLogEveryNFrames=t,this.supportDebugEveryNFrames=t,this.lastSupportDebugLogFrame=-1,this.broadPhase?.setDebugLogInterval?.(t),this.contactGeneration?.setDebugLogInterval?.(t),this.avbdState?.setDebugLogInterval?.(t)}applyPlayerControl(e,t){!this.initialized||!this.playerControl||t.bodyIndex<0||t.bodyIndex>=this.bodyCount||this.playerControl.dispatchControl(e,this.bodyCount,t.bodyIndex,t.targetVelocity,t.moveGain??.4,t.jumpSpeed??6,t.jumpRequested??!1,t.groundedHint??!1)}async readPlayerStateAsync(e,t){if(!this.initialized||!this.playerControl||t<0||t>=this.bodyCount||!e||typeof e.getArrayBufferAsync!=`function`)return null;this.playerControl.dispatchProbe(e,this.bodyCount,t);let n=await e.getArrayBufferAsync(this.playerControl.getProbeAttribute()),r=new Float32Array(n);return r.length<8?null:{position:[r[0],r[1],r[2]],velocity:[r[4],r[5],r[6]],grounded:r[3]>.5}}async readRigidBodyStatesAsync(e){if(!this.initialized||!e||typeof e.getArrayBufferAsync!=`function`)return null;let t,n,r,i;try{t=await e.getArrayBufferAsync(this.positionsAttr)}catch(e){throw Error(`positions readback failed: ${e instanceof Error?e.message:String(e)}`)}try{n=await e.getArrayBufferAsync(this.quaternionsAttr)}catch(e){throw Error(`quaternions readback failed: ${e instanceof Error?e.message:String(e)}`)}try{r=await e.getArrayBufferAsync(this.velocitiesAttr)}catch(e){throw Error(`velocities readback failed: ${e instanceof Error?e.message:String(e)}`)}try{i=await e.getArrayBufferAsync(this.angularVelAttr)}catch(e){throw Error(`angular velocities readback failed: ${e instanceof Error?e.message:String(e)}`)}let a=new Float32Array(t),o=new Float32Array(n),s=new Float32Array(r),c=new Float32Array(i),l=[];for(let e=0;e<this.bodyCount;e++){let t=e*4,n=e*8;l.push({body:e,position:[a[t]??0,a[t+1]??0,a[t+2]??0],initialPosition:[this.initialPoseData[n]??0,this.initialPoseData[n+1]??0,this.initialPoseData[n+2]??0],quaternion:[o[t]??0,o[t+1]??0,o[t+2]??0,o[t+3]??1],velocity:[s[t]??0,s[t+1]??0,s[t+2]??0],angularVelocity:[c[t]??0,c[t+1]??0,c[t+2]??0],inverseMass:a[t+3]??0})}return l}async readJointStatesAsync(e,t){if(!this.initialized||!e||typeof e.getArrayBufferAsync!=`function`)return null;let n;try{n=await e.getArrayBufferAsync(this.jointRecordsAttr)}catch(e){throw Error(`joint records readback failed: ${e instanceof Error?e.message:String(e)}`)}let r=new Float32Array(n),i=new Uint32Array(n),a=t??Array.from({length:this.jointCount},(e,t)=>t),o=[];for(let e of a){if(e<0||e>=this.jointCount)continue;let t=Q(e,0);if((i[t+3]??0)===0)continue;let n=i[t]??ku,a=i[t+1]??0,s=i[t+2]??0,c=Q(e,1),l=Q(e,2),u=Q(e,3),d=Q(e,4),f=Q(e,5),p=Q(e,6),m=Q(e,7),h=Q(e,8),g=Q(e,9),_=Q(e,10);o.push({joint:e,bodyA:n===ku?null:n,bodyB:a,type:s===1?`fixed`:`spherical`,anchorA:[r[c]??0,r[c+1]??0,r[c+2]??0],anchorB:[r[l]??0,r[l+1]??0,r[l+2]??0],torqueArm:r[c+3]??0,restRelative:[r[u]??0,r[u+1]??0,r[u+2]??0,r[u+3]??1],stiffnessLin:r[d]??0,stiffnessAng:r[d+1]??0,c0Lin:[r[f]??0,r[f+1]??0,r[f+2]??0],c0Ang:[r[p]??0,r[p+1]??0,r[p+2]??0],lambdaLin:[r[m]??0,r[m+1]??0,r[m+2]??0],lambdaAng:[r[h]??0,r[h+1]??0,r[h+2]??0],penaltyLin:[r[g]??0,r[g+1]??0,r[g+2]??0],penaltyAng:[r[_]??0,r[_+1]??0,r[_+2]??0]})}return o}async readActiveContactPointsAsync(e){if(!this.initialized||!e||typeof e.getArrayBufferAsync!=`function`)return null;let[t,n,r,i]=await Promise.all([e.getArrayBufferAsync(this.pairActivityAttr),e.getArrayBufferAsync(this.pairContactsAttr),e.getArrayBufferAsync(this.quaternionsAttr),e.getArrayBufferAsync(this.positionsAttr)]),a=new Uint32Array(t).subarray(this.pairActiveContactsOffset,this.pairActiveContactsOffset+this.maxActivePairContacts+Tu),{meta:o,arms:s}=Lu(n,this.maxPairContacts),c=new Float32Array(r),l=new Float32Array(i),u=(e,t,n,r)=>{let i=Math.hypot(e,t,n,r);if(i<=1e-12)return[0,0,0,1];let a=1/i;return[e*a,t*a,n*a,r*a]},d=(e,t,n,r,i,a,o)=>{let s=2*(t*o-n*a),c=2*(n*i-e*o),l=2*(e*a-t*i);return[i+r*s+(t*l-n*c),a+r*c+(n*s-e*l),o+r*l+(e*c-t*s)]},f=Math.min(a[0]??0,this.maxActivePairContacts),p=[];for(let e=0;e<f;e++){let t=a[e+1]??this.maxPairContacts;if(t>=this.maxPairContacts)continue;let n=t*4;if((o[n+2]??0)<.5)continue;let r=Math.round(o[n]??-1),i=Math.round(o[n+1]??-1);if(r<0||i<0)continue;let f=r*4,m=i*4,h=l[f]??0,g=l[f+1]??0,_=l[f+2]??0,v=l[m]??0,y=l[m+1]??0,b=l[m+2]??0,x=r*4,S=i*4,[C,w,T,E]=u(c[x]??0,c[x+1]??0,c[x+2]??0,c[x+3]??1),[D,O,k,A]=u(c[S]??0,c[S+1]??0,c[S+2]??0,c[S+3]??1),j=t*8,[M,N,P]=d(C,w,T,E,s[j]??0,s[j+1]??0,s[j+2]??0),[F,I,L]=d(D,O,k,A,s[j+4]??0,s[j+5]??0,s[j+6]??0),R=h+M,z=g+N,B=_+P,V=v+F,H=y+I,ee=b+L;p.push({x:.5*(R+V),y:.5*(z+H),z:.5*(B+ee)})}return p}findSupportFloorBody(e,t){let n=-1,r=-1,i=1/0,a=-1/0;for(let o=0;o<this.bodyCount;o++){let s=o*4;if((e[s+3]??0)!==0)continue;let c=e[s+1]??0,l=Math.max(0,t[s+1]??0),u=Math.max(0,t[s+2]??0),d=l*Math.max(0,t[s+3]??0),f=d>r*1.05,p=Math.abs(d-r)<=1e-6&&c<i;(n<0||f||p)&&(n=o,r=d,i=c,a=c+u)}return{body:n,topY:a}}logSupportDiagnostics(e){if(!this.debugBehaviorEnabled||!e||typeof e.getArrayBufferAsync!=`function`||this.supportDebugReadbackInFlight||this.lastSupportDebugLogFrame>=0&&this.frameId-this.lastSupportDebugLogFrame<this.supportDebugEveryNFrames)return;let t=this.frameId;this.supportDebugReadbackInFlight=!0,this.lastSupportDebugLogFrame=t,Promise.all([e.getArrayBufferAsync(this.pairActivityAttr),e.getArrayBufferAsync(this.pairContactsAttr),e.getArrayBufferAsync(this.positionsAttr),e.getArrayBufferAsync(this.shapesAttr)]).then(([e,n,r,i])=>{let a=new Uint32Array(e),{meta:o}=Lu(n,this.maxPairContacts),s=new Float32Array(r),c=new Float32Array(i);this.prevSupportBodyCount!==this.bodyCount&&(this.prevSupportBodyCount=this.bodyCount,this.prevCandidatePairsForChurn=null,this.prevFloorCandidatePairsForChurn=null);let{body:l,topY:u}=this.findSupportFloorBody(s,c);if(l<0){this.prevCandidatePairsForChurn=null,this.prevFloorCandidatePairsForChurn=null;return}let d=new Set;for(let e=0;e<this.bodyCount;e++){if(e===l)continue;let t=e*4;if((s[t+3]??0)<=0)continue;let n=(s[t+1]??0)-Math.max(0,c[t+2]??0)-u;n<=.12&&n>=-.75&&d.add(e)}let f=Math.min(a[this.pairCandidateIndicesOffset]??0,this.maxCandidatePairs),p=new Set,m=new Set,h=new Set;for(let e=0;e<f;e++){let t=a[this.pairCandidateIndicesOffset+1+e]??4294967295,n=t&65535,r=t>>>16;n>=r||r>=this.bodyCount||(p.add(t),(n===l||r===l)&&(m.add(t),h.add(n===l?r:n)))}let g=Math.min(a[this.pairActiveContactsOffset]??0,this.maxActivePairContacts),_=new Set;for(let e=0;e<g;e++){let t=a[this.pairActiveContactsOffset+1+e]??this.maxPairContacts;if(t>=this.maxPairContacts)continue;let n=t*4,r=Math.round(o[n]??-1),i=Math.round(o[n+1]??-1);r<0||i<0||r>=i||i>=this.bodyCount||(r===l||i===l)&&_.add(r===l?i:r)}let v=0,y=0;for(let e of d)h.has(e)&&v++,_.has(e)&&y++;let b=d.size,x=b>0?v/b:1,S=b>0?y/b:1,C=Math.max(0,b-v),w=Math.max(0,v-y),T=this.prevCandidatePairsForChurn,E=this.prevFloorCandidatePairsForChurn,D=1,O=0,k=0;if(T){let e=0;for(let t of p)T.has(t)?e++:O++;for(let e of T)p.has(e)||k++;let t=p.size+T.size-e;D=t>0?e/t:1}let A=1;if(E){let e=0;for(let t of m)E.has(t)&&e++;let t=m.size+E.size-e;A=t>0?e/t:1}this.prevCandidatePairsForChurn=p,this.prevFloorCandidatePairsForChurn=m,console.info(`[Support Debug] frame=${t} floor=${l} nearFloor=${b} candSupport=${v}(${(100*x).toFixed(1)}%) activeSupport=${y}(${(100*S).toFixed(1)}%) broadphaseLost=${C} contactRejected=${w} pairs=${p.size} floorPairs=${m.size} jaccard=${D.toFixed(3)} floorJaccard=${A.toFixed(3)} added=${O} removed=${k}`)}).catch(e=>{console.warn(`Support debug readback failed:`,e)}).finally(()=>{this.supportDebugReadbackInFlight=!1})}},zu={"single-5":{maxBodies:2048,initialCount:125,cameraPosition:[0,3.2,10],cameraLookAt:[0,1.5,0],physics:{maxPairsPerBodyBroadphase:48,maxContactsPerBodySolver:128,maxPairSolveColorCount:16},layout:`grid`,grid:{x:0,z:0,startY:.3,sizeX:5,sizeY:5,sizeZ:5,spacing:.01,stacksX:1,stacksZ:1,stackSpacingX:0,stackSpacingZ:0}},"single-10":{maxBodies:2048,initialCount:1e3,cameraPosition:[0,5,16],cameraLookAt:[0,3,0],physics:{maxPairsPerBodyBroadphase:32,maxContactsPerBodySolver:128,maxPairSolveColorCount:16},layout:`grid`,grid:{x:0,z:0,startY:.3,sizeX:10,sizeY:10,sizeZ:10,spacing:.01,stacksX:1,stacksZ:1,stackSpacingX:0,stackSpacingZ:0}},"wall-10x10x1":{maxBodies:1024,initialCount:100,cameraPosition:[0,4,14],cameraLookAt:[0,2,0],physics:{maxPairsPerBodyBroadphase:48,maxContactsPerBodySolver:128,maxPairSolveColorCount:16},layout:`grid`,grid:{x:0,z:0,startY:.3,sizeX:10,sizeY:10,sizeZ:1,spacing:.01,stacksX:1,stacksZ:1,stackSpacingX:0,stackSpacingZ:0}},"line-2x1x1":{maxBodies:256,initialCount:2,cameraPosition:[0,1.8,5],cameraLookAt:[0,.9,0],physics:{maxPairsPerBodyBroadphase:16,maxContactsPerBodySolver:64,maxPairSolveColorCount:8},layout:`grid`,grid:{x:0,z:0,startY:.3,sizeX:1,sizeY:2,sizeZ:1,spacing:.01,stacksX:1,stacksZ:1,stackSpacingX:0,stackSpacingZ:0}},"line-1x1x1":{maxBodies:256,initialCount:1,cameraPosition:[0,1.4,4.2],cameraLookAt:[0,.55,0],physics:{maxPairsPerBodyBroadphase:16,maxContactsPerBodySolver:64,maxPairSolveColorCount:8},layout:`grid`,grid:{x:0,z:0,startY:.3,sizeX:1,sizeY:1,sizeZ:1,spacing:.01,stacksX:1,stacksZ:1,stackSpacingX:0,stackSpacingZ:0}},"line-3x1x1":{maxBodies:256,initialCount:3,cameraPosition:[0,2.2,5.5],cameraLookAt:[0,1.2,0],physics:{maxPairsPerBodyBroadphase:16,maxContactsPerBodySolver:64,maxPairSolveColorCount:8},layout:`grid`,grid:{x:0,z:0,startY:.3,sizeX:1,sizeY:3,sizeZ:1,spacing:.01,stacksX:1,stacksZ:1,stackSpacingX:0,stackSpacingZ:0}},"line-10x1x1":{maxBodies:1024,initialCount:10,cameraPosition:[0,4.6,9],cameraLookAt:[0,2.7,0],physics:{maxPairsPerBodyBroadphase:32,maxContactsPerBodySolver:128,maxPairSolveColorCount:16},layout:`grid`,grid:{x:0,z:0,startY:.3,sizeX:1,sizeY:10,sizeZ:1,spacing:.01,stacksX:1,stacksZ:1,stackSpacingX:0,stackSpacingZ:0}},"bridge-demo":{maxBodies:1024,initialCount:0,cameraPosition:[0,16,34],cameraLookAt:[0,8,0],physics:{maxPairsPerBodyBroadphase:64,maxContactsPerBodySolver:128,maxPairSolveColorCount:16},layout:`grid`,grid:{x:0,z:0,startY:.3,sizeX:1,sizeY:1,sizeZ:1,spacing:.01,stacksX:1,stacksZ:1,stackSpacingX:0,stackSpacingZ:0}},"bridge-demo-empty":{maxBodies:1024,initialCount:0,cameraPosition:[0,16,34],cameraLookAt:[0,8,0],physics:{maxPairsPerBodyBroadphase:32,maxContactsPerBodySolver:128,maxPairSolveColorCount:16},layout:`grid`,grid:{x:0,z:0,startY:.3,sizeX:1,sizeY:1,sizeZ:1,spacing:.01,stacksX:1,stacksZ:1,stackSpacingX:0,stackSpacingZ:0}},"bridge-demo-fixed":{maxBodies:1024,initialCount:0,cameraPosition:[0,16,34],cameraLookAt:[0,8,0],physics:{maxPairsPerBodyBroadphase:64,maxContactsPerBodySolver:128,maxPairSolveColorCount:16},layout:`grid`,grid:{x:0,z:0,startY:.3,sizeX:1,sizeY:1,sizeZ:1,spacing:.01,stacksX:1,stacksZ:1,stackSpacingX:0,stackSpacingZ:0}},"soft-body":{maxBodies:1024,initialCount:0,cameraPosition:[14,18,28],cameraLookAt:[0,13,0],physics:{maxPairsPerBodyBroadphase:48,maxContactsPerBodySolver:128,maxPairSolveColorCount:16},layout:`grid`,grid:{x:0,z:0,startY:.3,sizeX:1,sizeY:1,sizeZ:1,spacing:.01,stacksX:1,stacksZ:1,stackSpacingX:0,stackSpacingZ:0}},"bunny-soft-body":{maxBodies:12288,initialCount:0,cameraPosition:[14,12,22],cameraLookAt:[0,7,0],physics:{maxPairsPerBodyBroadphase:96,maxContactsPerBodySolver:192,maxPairSolveColorCount:16},layout:`grid`,grid:{x:0,z:0,startY:.3,sizeX:1,sizeY:1,sizeZ:1,spacing:.01,stacksX:1,stacksZ:1,stackSpacingX:0,stackSpacingZ:0}},"spring-demo":{maxBodies:320,initialCount:0,cameraPosition:[0,28,58],cameraLookAt:[0,18,0],physics:{maxPairsPerBodyBroadphase:24,maxContactsPerBodySolver:64,maxPairSolveColorCount:8},layout:`grid`,grid:{x:0,z:0,startY:.3,sizeX:1,sizeY:1,sizeZ:1,spacing:.01,stacksX:1,stacksZ:1,stackSpacingX:0,stackSpacingZ:0}},"spring-ratio":{maxBodies:256,initialCount:0,cameraPosition:[0,17.5,22],cameraLookAt:[0,17.5,0],physics:{maxPairsPerBodyBroadphase:16,maxContactsPerBodySolver:64,maxPairSolveColorCount:8},layout:`grid`,grid:{x:0,z:0,startY:.3,sizeX:1,sizeY:1,sizeZ:1,spacing:.01,stacksX:1,stacksZ:1,stackSpacingX:0,stackSpacingZ:0}},"rope-demo":{maxBodies:256,initialCount:0,cameraPosition:[0,16,28],cameraLookAt:[0,12,0],physics:{maxPairsPerBodyBroadphase:24,maxContactsPerBodySolver:96,maxPairSolveColorCount:8},layout:`grid`,grid:{x:0,z:0,startY:.3,sizeX:1,sizeY:1,sizeZ:1,spacing:.01,stacksX:1,stacksZ:1,stackSpacingX:0,stackSpacingZ:0}},"heavy-rope-demo":{maxBodies:256,initialCount:0,cameraPosition:[0,19,32],cameraLookAt:[0,15,0],physics:{maxPairsPerBodyBroadphase:24,maxContactsPerBodySolver:96,maxPairSolveColorCount:8},layout:`grid`,grid:{x:0,z:0,startY:.3,sizeX:1,sizeY:1,sizeZ:1,spacing:.01,stacksX:1,stacksZ:1,stackSpacingX:0,stackSpacingZ:0}},"sphere-demo":{maxBodies:256,initialCount:0,cameraPosition:[0,7,18],cameraLookAt:[0,3,0],physics:{maxPairsPerBodyBroadphase:16,maxContactsPerBodySolver:64,maxPairSolveColorCount:8},layout:`grid`,grid:{x:0,z:0,startY:.3,sizeX:1,sizeY:1,sizeZ:1,spacing:.01,stacksX:1,stacksZ:1,stackSpacingX:0,stackSpacingZ:0}},"ragdoll-cloth-demo":{maxBodies:4096,initialCount:0,cameraPosition:[0,24,46],cameraLookAt:[0,12,0],physics:{maxPairsPerBodyBroadphase:48,maxContactsPerBodySolver:128,maxPairSolveColorCount:16},layout:`grid`,grid:{x:0,z:0,startY:.3,sizeX:1,sizeY:1,sizeZ:1,spacing:.01,stacksX:1,stacksZ:1,stackSpacingX:0,stackSpacingZ:0}},"ragdoll-carousel-demo":{maxBodies:4096,initialCount:0,cameraPosition:[0,22,42],cameraLookAt:[0,15,0],physics:{maxPairsPerBodyBroadphase:48,maxContactsPerBodySolver:128,maxPairSolveColorCount:16},layout:`grid`,grid:{x:0,z:0,startY:.3,sizeX:1,sizeY:1,sizeZ:1,spacing:.01,stacksX:1,stacksZ:1,stackSpacingX:0,stackSpacingZ:0}},"jointed-sandbox-demo":{maxBodies:1024,initialCount:0,cameraPosition:[0,12,56],cameraLookAt:[0,6.5,0],physics:{maxPairsPerBodyBroadphase:48,maxContactsPerBodySolver:128,maxPairSolveColorCount:16},layout:`grid`,grid:{x:0,z:0,startY:.3,sizeX:1,sizeY:1,sizeZ:1,spacing:.01,stacksX:1,stacksZ:1,stackSpacingX:0,stackSpacingZ:0}},"cloth-boxes-demo":{maxBodies:1024,initialCount:0,cameraPosition:[0,11,18],cameraLookAt:[0,7,0],physics:{maxPairsPerBodyBroadphase:32,maxContactsPerBodySolver:128,maxPairSolveColorCount:12},layout:`grid`,grid:{x:0,z:0,startY:.3,sizeX:1,sizeY:1,sizeZ:1,spacing:.01,stacksX:1,stacksZ:1,stackSpacingX:0,stackSpacingZ:0}},"coliseum-12k":{maxBodies:12288,initialCount:0,cameraPosition:[34,9,34],cameraLookAt:[0,3.5,0],physics:{maxPairsPerBodyBroadphase:12,maxContactsPerBodySolver:64,maxPairSolveColorCount:8},layout:`grid`,grid:{x:0,z:0,startY:.3,sizeX:1,sizeY:1,sizeZ:1,spacing:.01,stacksX:1,stacksZ:1,stackSpacingX:0,stackSpacingZ:0}},"coliseum-50k":{maxBodies:50688,initialCount:0,cameraPosition:[48,12,48],cameraLookAt:[0,5,0],physics:{maxPairsPerBodyBroadphase:12,maxContactsPerBodySolver:64,maxPairSolveColorCount:8},layout:`grid`,grid:{x:0,z:0,startY:.3,sizeX:1,sizeY:1,sizeZ:1,spacing:.01,stacksX:1,stacksZ:1,stackSpacingX:0,stackSpacingZ:0}},"coliseum-64k":{maxBodies:64512,initialCount:0,cameraPosition:[52,13,52],cameraLookAt:[0,5.5,0],physics:{maxPairsPerBodyBroadphase:12,maxContactsPerBodySolver:64,maxPairSolveColorCount:8},layout:`grid`,grid:{x:0,z:0,startY:.3,sizeX:1,sizeY:1,sizeZ:1,spacing:.01,stacksX:1,stacksZ:1,stackSpacingX:0,stackSpacingZ:0}},"pyramid-8":{maxBodies:2048,initialCount:72/2,cameraPosition:[0,3.8,11],cameraLookAt:[0,1.5,0],physics:{maxPairsPerBodyBroadphase:48,maxContactsPerBodySolver:128,maxPairSolveColorCount:16},layout:`pyramid-wall`,pyramidWall:{x:0,z:0,startY:.3,layers:8,stepX:.63,stepY:.51}},"waterfall-gutter":{maxBodies:8192,initialCount:308*5,cameraPosition:[10,30,72],cameraLookAt:[8,16,-8],physics:{maxPairsPerBodyBroadphase:48,maxContactsPerBodySolver:128,maxPairSolveColorCount:16},layout:`grid`,grid:{x:-7,z:0,startY:32,sizeX:11,sizeY:28,sizeZ:5,spacing:.06,stacksX:1,stacksZ:1,stackSpacingX:0,stackSpacingZ:0}},"grid-1000x10":{maxBodies:12288,initialCount:1e3*10,cameraPosition:[0,26,70],cameraLookAt:[0,8,0],physics:{maxPairsPerBodyBroadphase:12,maxContactsPerBodySolver:64,maxPairSolveColorCount:8},layout:`grid`,grid:{x:0,z:0,startY:.3,sizeX:1,sizeY:10,sizeZ:1,spacing:.01,stacksX:25,stacksZ:40,stackSpacingX:.5,stackSpacingZ:.5}},"grid-64x10":{maxBodies:64512,initialCount:640*10*10,cameraPosition:[0,12,36],cameraLookAt:[0,6,0],physics:{maxPairsPerBodyBroadphase:12,maxContactsPerBodySolver:64,maxPairSolveColorCount:8},layout:`grid`,grid:{x:0,z:0,startY:.3,sizeX:10,sizeY:10,sizeZ:10,spacing:.01,stacksX:8,stacksZ:8,stackSpacingX:.5,stackSpacingZ:.5}},"dominoes-demo":{maxBodies:4096,initialCount:0,cameraPosition:[0,19,78],cameraLookAt:[0,5.5,4],physics:{maxPairsPerBodyBroadphase:16,maxContactsPerBodySolver:64,maxPairSolveColorCount:8},layout:`grid`,grid:{x:0,z:0,startY:.3,sizeX:1,sizeY:1,sizeZ:1,spacing:.01,stacksX:1,stacksZ:1,stackSpacingX:0,stackSpacingZ:0}},"dominoes-advanced-demo":{maxBodies:2048,initialCount:0,cameraPosition:[0,18,58],cameraLookAt:[0,8,5],physics:{maxPairsPerBodyBroadphase:16,maxContactsPerBodySolver:64,maxPairSolveColorCount:8},layout:`grid`,grid:{x:0,z:0,startY:.3,sizeX:1,sizeY:1,sizeZ:1,spacing:.01,stacksX:1,stacksZ:1,stackSpacingX:0,stackSpacingZ:0}},"newtons-cradles-demo":{maxBodies:2048,initialCount:0,cameraPosition:[0,15,68],cameraLookAt:[0,7.5,-6],physics:{maxPairsPerBodyBroadphase:24,maxContactsPerBodySolver:48,maxPairSolveColorCount:10},layout:`grid`,grid:{x:0,z:0,startY:.3,sizeX:1,sizeY:1,sizeZ:1,spacing:.01,stacksX:1,stacksZ:1,stackSpacingX:0,stackSpacingZ:0}},"cliff-plateau-demo":{maxBodies:2048,initialCount:0,cameraPosition:[44,30,44],cameraLookAt:[0,15,0],physics:{maxPairsPerBodyBroadphase:48,maxContactsPerBodySolver:64,maxPairSolveColorCount:16},layout:`grid`,grid:{x:0,z:0,startY:.3,sizeX:1,sizeY:1,sizeZ:1,spacing:.01,stacksX:1,stacksZ:1,stackSpacingX:0,stackSpacingZ:0}},"ragdoll-avalanche-demo":{maxBodies:2048,initialCount:0,cameraPosition:[78,48,0],cameraLookAt:[6,34,0],physics:{maxPairsPerBodyBroadphase:24,maxContactsPerBodySolver:40},layout:`grid`,grid:{x:0,z:0,startY:.3,sizeX:1,sizeY:1,sizeZ:1,spacing:.01,stacksX:1,stacksZ:1,stackSpacingX:0,stackSpacingZ:0}}},Bu={maxBodies:2048,initialCount:0,cameraPosition:[.9,.55,1.35],cameraLookAt:[0,.12,0],physics:{maxPairsPerBodyBroadphase:32,maxContactsPerBodySolver:32,maxPairSolveColorCount:16},layout:`grid`,grid:{x:0,z:0,startY:.3,sizeX:1,sizeY:1,sizeZ:1,spacing:.01},label:`Gel cut (Kora)`,group:`Soft`},Vu={...zu,"gel-cut":Bu};function Hu(e){return e===`single-5`||e===`single-10`||e===`wall-10x10x1`||e===`line-1x1x1`||e===`line-2x1x1`||e===`line-3x1x1`||e===`line-10x1x1`||e===`bridge-demo`||e===`bridge-demo-empty`||e===`bridge-demo-fixed`||e===`soft-body`||e===`bunny-soft-body`||e===`spring-demo`||e===`spring-ratio`||e===`rope-demo`||e===`heavy-rope-demo`||e===`sphere-demo`||e===`ragdoll-cloth-demo`||e===`ragdoll-carousel-demo`||e===`jointed-sandbox-demo`||e===`cloth-boxes-demo`||e===`coliseum-12k`||e===`coliseum-50k`||e===`coliseum-64k`||e===`pyramid-8`||e===`waterfall-gutter`||e===`grid-1000x10`||e===`grid-64x10`||e===`dominoes-demo`||e===`dominoes-advanced-demo`||e===`newtons-cradles-demo`||e===`ragdoll-avalanche-demo`||e===`cliff-plateau-demo`}function Uu(e){return e===`gel-cut`||Hu(e)}var Wu=`gel-cut`,Gu=[`Soft`,`Rigid stacks`,`Cloth / rope`,`Ragdoll`,`Domino`,`Stress`,`Other`],Ku={"gel-cut":{label:`Gel cut (Kora)`,group:`Soft`},"soft-body":{label:`Soft body cubes`,group:`Soft`},"bunny-soft-body":{label:`Bunny soft body`,group:`Soft`,desktopOnly:!0},"cloth-boxes-demo":{label:`Cloth + boxes`,group:`Cloth / rope`},"rope-demo":{label:`Rope`,group:`Cloth / rope`},"heavy-rope-demo":{label:`Heavy rope`,group:`Cloth / rope`},"spring-demo":{label:`Springs`,group:`Cloth / rope`},"spring-ratio":{label:`Spring ratio`,group:`Cloth / rope`},"ragdoll-cloth-demo":{label:`Ragdoll cloth`,group:`Ragdoll`},"ragdoll-carousel-demo":{label:`Ragdoll carousel`,group:`Ragdoll`},"ragdoll-avalanche-demo":{label:`Ragdoll avalanche`,group:`Ragdoll`},"cliff-plateau-demo":{label:`Cliff plateau crowd`,group:`Ragdoll`},"dominoes-demo":{label:`Dominoes`,group:`Domino`},"dominoes-advanced-demo":{label:`Dominoes advanced`,group:`Domino`},"single-5":{label:`Stack 5`,group:`Rigid stacks`},"single-10":{label:`Stack 10`,group:`Rigid stacks`},"wall-10x10x1":{label:`Wall 10×10`,group:`Rigid stacks`},"pyramid-8":{label:`Pyramid 8`,group:`Rigid stacks`},"bridge-demo":{label:`Bridge`,group:`Rigid stacks`},"bridge-demo-empty":{label:`Bridge empty`,group:`Rigid stacks`},"bridge-demo-fixed":{label:`Bridge fixed`,group:`Rigid stacks`},"sphere-demo":{label:`Spheres`,group:`Rigid stacks`},"jointed-sandbox-demo":{label:`Jointed sandbox`,group:`Other`},"newtons-cradles-demo":{label:`Newton's cradles`,group:`Other`},"waterfall-gutter":{label:`Waterfall gutter`,group:`Other`},"coliseum-12k":{label:`Coliseum 12k`,group:`Stress`},"coliseum-50k":{label:`Coliseum 50k`,group:`Stress`,desktopOnly:!0},"coliseum-64k":{label:`Coliseum 64k`,group:`Stress`,desktopOnly:!0},"grid-1000x10":{label:`Grid 1000×10`,group:`Stress`},"grid-64x10":{label:`Grid 64×10`,group:`Stress`,desktopOnly:!0},"line-1x1x1":{label:`Line 1`,group:`Rigid stacks`},"line-2x1x1":{label:`Line 2`,group:`Rigid stacks`},"line-3x1x1":{label:`Line 3`,group:`Rigid stacks`},"line-10x1x1":{label:`Line 10`,group:`Rigid stacks`}};function qu(e){return Ku[e]?.label??e}function Ju(e){return Ku[e]?.group??`Other`}function Yu(e){return Ku[e]?.desktopOnly===!0}function Xu(e){let t=new Map;for(let e of Gu)t.set(e,[]);for(let n of Object.keys(Vu)){if(e?.skipDesktopOnly&&Yu(n))continue;let r=Ju(n);t.get(r).push(n)}return Gu.map(e=>({group:e,ids:t.get(e)})).filter(e=>e.ids.length)}var Zu=64,Qu=22,$u=16,ed=1.03,td=1.09,nd=class{scene;boxMesh;sphereMesh;boxGeometry;sphereGeometry;material;amountUniform;sizeUniform;bodyIndexAttr;instancePosAttr;instanceQuatAttr;gatherKernel=null;gpuBound=!1;body=-1;shape=`box`;amount=0;target=0;constructor(e){this.scene=e,this.amountUniform=T(0),this.sizeUniform=T(new Y(1,1,1)),this.material=new $e,this.material.color.setHex(10151935),this.material.side=1,this.material.transparent=!0,this.material.depthWrite=!1,this.material.opacityNode=this.amountUniform.mul(.7),this.material.forceSinglePass=!0,this.boxGeometry=new Oe(1,1,1),this.sphereGeometry=new nt(1,20,16),this.boxMesh=new Ne(this.boxGeometry,this.material,1),this.sphereMesh=new Ne(this.sphereGeometry,this.material,1);for(let t of[this.boxMesh,this.sphereMesh])t.frustumCulled=!1,t.count=1,t.renderOrder=8,t.visible=!1,e.add(t);this.bodyIndexAttr=new q(new Float32Array(4),4),this.instancePosAttr=new et(1,4),this.instanceQuatAttr=new et(1,4)}setBody(e,t){if(e===null||e<0||!t){this.target=0;return}let n=t.getBodyPoseCpu(e),r=t.getBodyShapeType(e);if(!n||!r){this.target=0;return}this.body=e,this.shape=r,this.target=1;let[i,a,o]=n.halfExtents;if(r===`sphere`){let e=Math.max(i,1e-4);this.sizeUniform.value.set(e,e,e)}else this.sizeUniform.value.set(Math.max(i*2,1e-4),Math.max(a*2,1e-4),Math.max(o*2,1e-4));let s=this.bodyIndexAttr.array;s[0]=e,this.bodyIndexAttr.needsUpdate=!0}sync(e,t,n){let r=Math.min(Math.max(n,0),.05),i=this.target>this.amount?Qu:$u;this.amount+=(this.target-this.amount)*(1-Math.exp(-i*r)),Math.abs(this.target-this.amount)<.004&&(this.amount=this.target),this.amountUniform.value=this.amount;let a=this.amount>.01&&this.body>=0;if(this.boxMesh.visible=a&&this.shape===`box`,this.sphereMesh.visible=a&&this.shape===`sphere`,!a){this.amount===0&&(this.body=-1);return}let o=e.getRenderBuffers();if(o){if(!this.gpuBound){let t=l(`
        fn compute(
          positions: ptr<storage, array<vec4f>, read>,
          quaternions: ptr<storage, array<vec4f>, read>,
          bodyIndices: ptr<storage, array<vec4f>, read>,
          outPositions: ptr<storage, array<vec4f>, read_write>,
          outQuaternions: ptr<storage, array<vec4f>, read_write>,
          workgroupId: vec3u,
          localId: vec3u,
        ) -> void {
          let gid = workgroupId.x * ${Zu}u + localId.x;
          if (gid > 0u) { return; }
          let body = u32(bodyIndices[0].x);
          outPositions[0] = positions[body];
          outQuaternions[0] = quaternions[body];
        }
      `);this.gatherKernel=t({positions:Z(o.positions,`vec4f`,e.config.maxBodies).toReadOnly(),quaternions:Z(o.quaternions,`vec4f`,e.config.maxBodies).toReadOnly(),bodyIndices:Z(this.bodyIndexAttr,`vec4f`,1).toReadOnly(),outPositions:Z(this.instancePosAttr,`vec4f`,1),outQuaternions:Z(this.instanceQuatAttr,`vec4f`,1),workgroupId:p,localId:W}).computeKernel([Zu,1,1]).setName(`Grab Highlight Pose Gather`);let n=Z(this.instancePosAttr,`vec4`,1).toAttribute().xyz,r=Z(this.instanceQuatAttr,`vec4`,1).toAttribute(),i=r.xyz,a=r.w,s=e=>{let t=i.cross(e).mul(2);return e.add(t.mul(a)).add(i.cross(t))},c=G(A(ed),A(td),this.amountUniform);this.material.positionNode=s(te.mul(this.sizeUniform).mul(c)).add(n),this.material.needsUpdate=!0,this.gpuBound=!0}t&&t.compute(this.gatherKernel,[1,1,1])}}dispose(){this.scene.remove(this.boxMesh),this.scene.remove(this.sphereMesh),this.boxMesh.dispose(),this.sphereMesh.dispose(),this.boxGeometry.dispose(),this.sphereGeometry.dispose(),this.material.dispose()}},rd=1,id=gt,ad=8,od=id+ad,sd=65536,cd=8,ld=.001,ud=5e3,dd=.15,fd=8,pd=50,md=1/240,hd=1/20;function gd(e,t,n){return Math.min(Math.max(e,t),n)}var _d=.5,vd={min:.1,max:2.5},yd={distance:.5,height:.92},bd={distance:.48,height:.88,framedSize:.42,framedSizeRange:{min:.14,max:.95},turntable:!1},xd=25,Sd=16384;function Cd(){return yn(`avbdbvh`)!==`0`}function wd(){return yn(`avbdnan`)===`1`}function Td(e){let t=yn(e);if(t===null)return null;let n=Number.parseInt(t,10);return Number.isFinite(n)&&n>=0?n:null}var Ed=wd(),Dd=6,Od=30;function kd(e){let t=e.ax,n=e.bx,r=e.cx,i=e.ay,a=e.by,o=e.cy,s=e.az,c=e.bz,l=e.cz,u=t+a+l,d,f,p,m;if(u>0){let e=Math.sqrt(u+1)*2;m=.25*e,d=(c-o)/e,f=(r-s)/e,p=(i-n)/e}else if(t>a&&t>l){let e=Math.sqrt(1+t-a-l)*2;m=(c-o)/e,d=.25*e,f=(n+i)/e,p=(r+s)/e}else if(a>l){let e=Math.sqrt(1+a-t-l)*2;m=(r-s)/e,d=(n+i)/e,f=.25*e,p=(o+c)/e}else{let e=Math.sqrt(1+l-t-a)*2;m=(i-n)/e,d=(r+s)/e,f=(o+c)/e,p=.25*e}let h=Math.hypot(d,f,p,m)||1;return[d/h,f/h,p/h,m/h]}var Ad=class{immersive;root=new Ue;device=null;renderer=null;physics=null;runtime=null;gel=null;sceneId=Wu;active=!1;ready=!1;handBodies=[];colliderBodies=[];handVisuals=null;colliderVisuals=null;grabHighlight=null;kinPrevTargets=new Map;handSyncMs=0;forceSyncMs=0;_springCount=0;lastStepMs=0;lastCutCount=0;dragJointIndex=null;dragRayDistance=0;dragging=!1;dragNdc=new qe;dragRaycaster=new ze;dragOrigin=new Y;dragDir=new Y;presenting=!1;sceneSize=1;sceneCenter=new Y;poseSyncInFlight=!1;nanProbeReported=!1;nanProbeBaselineLogged=!1;nanProbeFrame=0;grabTarget=new Y;grabWrist=new Y;grabDelta=new Y;grabHasWrist=!1;localOrigin=new Y;localDir=new Y;invRoot=new tt;constructor(e){this.immersive=e}get isReady(){return this.ready}get isActive(){return this.active}get currentScene(){return this.sceneId}get sceneLabel(){return qu(this.sceneId)}get bodyCount(){return this.physics?.getBodyCount()??0}get springCount(){return this.gel?this.gel.springs.filter(e=>e.active).length:this._springCount}get iterations(){return this.physics?.getSolverIterations()??0}init(e,t){if(this.ready)return;this.renderer=e,this.device=t,this.root.add(new We(16777215,.1));let n=new Fe(16777215,1.3);n.position.set(4,8,5),this.root.add(n);let r=new Fe(13161704,.25);r.position.set(-5,3,-4),this.root.add(r),this.immersive.attach(this.root),this.root.visible=!1,this.loadScene(this.sceneId),this.ready=!0,this.presenting&&this.enterImmersive()}setActive(e){this.ready&&(this.active=e,this.root.visible=e)}setScene(e){return Uu(e)?e===this.sceneId&&this.physics?!0:(this.sceneId=e,this.loadScene(e),!0):!1}reset(){this.loadScene(this.sceneId)}resetSimulation(){if(this.physics?.resetSimulationToInitialPose(),this.runtime)for(let e of this.runtime.sceneResetCallbacks)e()}usesFpsControls(){return this.active&&this.sceneId!==`gel-cut`}isBodyDragging(){return this.dragging}async beginBodyDrag(e,t,n,r){if(!this.active||!this.physics||!this.renderer||this.sceneId===`gel-cut`)return!1;this.endBodyDrag(),this.screenToNdc(e,t,n,this.dragNdc),this.dragRaycaster.setFromCamera(this.dragNdc,r),this.dragOrigin.copy(this.dragRaycaster.ray.origin),this.dragDir.copy(this.dragRaycaster.ray.direction).normalize(),await this.physics.syncPosesFromGpuAsync(this.renderer);let i=[this.dragOrigin.x,this.dragOrigin.y,this.dragOrigin.z],a=[this.dragDir.x,this.dragDir.y,this.dragDir.z],o=this.runtime?.pickKinematicBody?.(i,a)??null,s=this.physics.pickDynamicBody(i,a)??(o===null?null:this.centreHit(o,i));return s?(this.dragRayDistance=Math.max(s.t,.1),this.dragJointIndex=this.physics.setDragJoint(s.body,s.worldHit,s.localHit,ud,this.dragJointIndex),this.dragging=!0,this.grabHighlight?.setBody(s.body,this.physics),!0):!1}updateBodyDrag(e,t,n,r){if(!this.dragging||!this.physics||this.dragJointIndex===null)return;this.screenToNdc(e,t,n,this.dragNdc),this.dragRaycaster.setFromCamera(this.dragNdc,r),this.dragOrigin.copy(this.dragRaycaster.ray.origin),this.dragDir.copy(this.dragRaycaster.ray.direction).normalize();let i=this.dragOrigin.x+this.dragDir.x*this.dragRayDistance,a=this.dragOrigin.y+this.dragDir.y*this.dragRayDistance,o=this.dragOrigin.z+this.dragDir.z*this.dragRayDistance;this.physics.setJointAnchorA(this.dragJointIndex,[i,a,o])}endBodyDrag(){this.dragJointIndex!==null&&this.physics&&this.physics.disableJoint(this.dragJointIndex),this.dragging=!1,this.grabHighlight?.setBody(null)}centreHit(e,t){let n=this.physics?.getBodyPoseCpu(e);if(!n)return null;let[r,i,a]=n.position;return{body:e,localHit:[0,0,0],worldHit:n.position,t:Math.hypot(r-t[0],i-t[1],a-t[2])}}screenToNdc(e,t,n,r){let i=n.getBoundingClientRect(),a=Math.max(i.width,1),o=Math.max(i.height,1);r.set((e-i.left)/a*2-1,-((t-i.top)/o*2-1))}shoot(e){return this.runtime?this.runtime.shootProjectileOverride?this.runtime.shootProjectileOverride(e):this.runtime.spawner.shoot(e):!1}prepareBench(){this.setScene(`gel-cut`),this.setActive(!0)}applyCamera(e,t){let n=Vu[this.sceneId];e.position.set(n.cameraPosition[0],n.cameraPosition[1],n.cameraPosition[2]);let r=n.cameraLookAt;e.lookAt(r[0],r[1],r[2]),t?.target.set(r[0],r[1],r[2])}sceneStatusText(){return this.runtime?.sceneStatusText?.()??null}step(e,t){if(!this.active||!this.physics||!this.renderer||!this.runtime)return;let n=performance.now();if(this.sceneId===`gel-cut`){this.syncKinematics(t);let e=this.activeBladeObbs();this.lastCutCount=Qc(this.physics,this.gel?.springs??[],e)}else this.lastCutCount=0;for(let t of this.runtime.scenePreStepCallbacks)t(e,this.renderer);this.physics.step(e,this.renderer);for(let t of this.runtime.sceneUpdateCallbacks)t(e);this.runtime.spawner.syncVisuals(this.physics,this.renderer);for(let e of this.runtime.trackedVisualSets)e.syncVisuals(this.physics,this.renderer);for(let e of this.runtime.trackedSpringVisualSets)e.syncVisuals(this.physics);for(let e of this.runtime.syncedSceneVisuals)e.syncVisuals(this.physics,this.renderer);this.gel?.visuals.syncVisuals(this.physics),this.handVisuals?.syncVisuals(this.physics),this.colliderVisuals?.syncVisuals(this.physics),this.grabHighlight?.sync(this.physics,this.renderer,e),this.refreshPickMirror(),this.probeNonFinitePoses(),this.lastStepMs=performance.now()-n}probeNonFinitePoses(){let e=this.physics,t=this.renderer;if(!Ed||this.nanProbeReported||!e||!t||(this.nanProbeFrame++,this.nanProbeFrame>Od&&this.nanProbeFrame%Dd!==0)||this.poseSyncInFlight)return;this.poseSyncInFlight=!0;let n=this.nanProbeFrame;e.syncPosesFromGpuAsync(t).then(async r=>{if(!r||this.nanProbeReported)return;let i=e.getBodyCount(),a=[],o=0,s=-1,c=-1;for(let t=0;t<i;t++){let n=e.getBodyPoseCpu(t);if(!n)continue;let r=n.quaternion;c<0&&Math.hypot(r[0],r[1],r[2],r[3])<1e-6&&(c=t),![...n.position,...r].every(e=>Number.isFinite(e))&&(o++,s<0&&(s=t),a.length<5&&a.push(`#${t} pos=[${n.position.join(`, `)}] quat=[${r.join(`, `)}]`))}if(!this.nanProbeBaselineLogged){let r=await e.readBodySolverStateAsync(t,0),i=await e.readContactDiagnosticsAsync(t,0);r&&!r.includes(`readback failed`)&&(this.nanProbeBaselineLogged=!0,console.warn(`GPU AVBD solver state at frame ${n} — ${r}\n${i??``}`))}if(o===0&&c<0)return;this.nanProbeReported=!0;let l=Math.max(s,0),u=await e.readBodySolverStateAsync(t,l),d=await e.readContactDiagnosticsAsync(t,l);console.error(`GPU AVBD: ${o} of ${i} bodies non-finite at frame ${n} (scene "${this.sceneId}", bvh ${Cd()?`on`:`off`}, zero-length quat on body ${c})\n${a.join(`
`)}\n${u??``}\n${d??``}`)}).catch(()=>void 0).finally(()=>{this.poseSyncInFlight=!1})}refreshPickMirror(){let e=this.physics,t=this.renderer;!e||!t||!this.presenting||this.poseSyncInFlight||this.usesPresetFraming&&(e.getBodyCount()>Sd||(this.poseSyncInFlight=!0,e.syncPosesFromGpuAsync(t).catch(()=>!1).finally(()=>{this.poseSyncInFlight=!1})))}dispose(){this.teardownScene(),this.root.removeFromParent(),this.ready=!1,this.active=!1}loadScene(e){if(!this.device)return;this.teardownScene(),this.sceneId=e,this.nanProbeReported=!1,this.nanProbeBaselineLogged=!1,this.nanProbeFrame=0;let t=Vu[e],n=e===`gel-cut`;this.physics=new Ru(this.device,{maxBodies:Math.min(t.maxBodies+od,sd),gravity:[0,n?-6:-9.81,0],substeps:n?2:4,deltaTime:1/60,pairManifoldSlots:8,solverIterations:n?8:4,pairSolveColorCount:t.physics.maxPairSolveColorCount,maxPairsPerBodyBroadphase:t.physics.maxPairsPerBodyBroadphase,maxContactsPerBodySolver:t.physics.maxContactsPerBodySolver??64,maxSpringsPerBodySolver:n?32:12,maxFixedStepsPerFrame:1,enableBvhBuild:Cd(),bvhBuildOnce:!1,bvhRebuildIntervalFrames:1,bvhWaitForGpuCompletion:!1,avbdFriction:Gn,avbdBodySolveMode:`colored`}),Cn(this.physics),t.physics.activePairSolveColorCount!==void 0&&this.physics.setPairSolveColorCount(t.physics.activePairSolveColorCount),n&&(this.physics.setSubsteps(2),this.physics.setSolverIterations(8));let r=Td(`avbdsubsteps`),i=Td(`avbditers`);r!==null&&r>0&&this.physics.setSubsteps(r),i!==null&&this.physics.setSolverIterations(i),this.runtime=Kc({parent:this.root,physics:this.physics,stackPreset:e,stackConfig:t}),n?(this.gel=Xc({scene:this.runtime.sceneRoot,physics:this.physics}),this._springCount=this.gel.springCount):(this.gel=null,this._springCount=this.physics.getSpringCount()),this.measureScene(),Ed&&this.reportAuthoredPoses(),n&&this.allocKinematicPools(),this.grabHighlight=new nd(this.runtime.sceneRoot),this.presenting&&this.enterImmersive()}reportAuthoredPoses(){let e=this.physics;if(!e)return;let t=e.getBodyCount(),n=0,r=[];for(let i=0;i<t;i++){let t=e.getBodyPoseCpu(i);t&&(t.position.every(e=>Number.isFinite(e))||n++,r.length<3&&r.push(`#${i} [${t.position.join(`, `)}]`))}console.warn(`GPU AVBD authored poses for "${this.sceneId}": ${n} of ${t} non-finite. `+r.join(`  `))}measureScene(){let e=this.physics;if(!e)return;let t=1/0,n=1/0,r=1/0,i=-1/0,a=-1/0,o=-1/0,s=e.getBodyCount();for(let c=0;c<s;c++){let s=e.getBodyPoseCpu(c);if(!s)continue;let[l,u,d]=s.halfExtents;if(Math.max(l,u,d)>xd)continue;let[f,p,m]=s.position;t=Math.min(t,f-l),n=Math.min(n,p-u),r=Math.min(r,m-d),i=Math.max(i,f+l),a=Math.max(a,p+u),o=Math.max(o,m+d)}if(!Number.isFinite(t)){this.sceneCenter.set(0,rd*.5,0),this.sceneSize=rd;return}this.sceneCenter.set((t+i)*.5,(n+a)*.5,(r+o)*.5),this.sceneSize=Math.max(i-t,a-n,o-r,.001)}get usesPresetFraming(){return this.sceneId!==`gel-cut`}applyXrFraming(){if(!this.usesPresetFraming){this.root.position.set(0,0,0),this.immersive.setDomainSize(rd),this.immersive.setPlacement({...bd});return}this.immersive.setDomainSize(this.sceneSize),this.immersive.setPlacement({...yd,framedSize:_d,framedSizeRange:vd,turntable:!1}),this.root.position.set(-this.sceneCenter.x,-this.sceneCenter.y+this.sceneSize*.5,-this.sceneCenter.z)}enterImmersive(){this.presenting=!0,this.ready&&(this.endBodyDrag(),this.allocKinematicPools(),this.applyXrFraming(),this.immersive.setBodyPointer(this.usesPresetFraming?this:null))}exitImmersive(){this.presenting=!1,this.endGrab(),this.immersive.setBodyPointer(null),this.root.position.set(0,0,0),this.setHandColliders([])}teardownScene(){this.endBodyDrag(),this.dragJointIndex=null,this.grabHighlight?.dispose(),this.grabHighlight=null,this.handVisuals?.dispose(),this.colliderVisuals?.dispose(),this.handVisuals=null,this.colliderVisuals=null,this.handBodies=[],this.colliderBodies=[],this.kinPrevTargets.clear(),this.gel?.visuals.dispose(),this.gel=null,this.runtime?.dispose(),this.runtime=null,this.physics&&this.renderer&&this.physics.dispose(this.renderer),this.physics=null}parkSlot(e){let t=Math.max(this.sceneSize*.02,.02),n=e%cd,r=Math.floor(e/cd);return[(n-(cd-1)*.5)*t,this.sceneCenter.y-this.sceneSize,r*t]}parkBody(e,t){this.physics&&(this.kinPrevTargets.delete(t),this.physics.setBodyPose(t,this.parkSlot(e),void 0,[0,0,0],[0,0,0]),this.physics.setBodyShapeHalfExtents(t,[ld,ld,ld]))}driveKinematic(e,t,n,r){let i=this.physics,a=this.kinPrevTargets.get(e),o=!1;if(a&&r>0){let s=1/r,c=(t[0]-a[0])*s,l=(t[1]-a[1])*s,u=(t[2]-a[2])*s,d=c*c+l*l+u*u,f=a[3],p=a[4],m=a[5],h=a[6],g=n[3]*-f+n[0]*h+n[1]*-m-n[2]*-p,_=n[3]*-p-n[0]*-m+n[1]*h+n[2]*-f,v=n[3]*-m+n[0]*-p-n[1]*-f+n[2]*h;n[3]*h-n[0]*-f-n[1]*-p-n[2]*-m<0&&(g=-g,_=-_,v=-v);let y=2*g*s,b=2*_*s,x=2*v*s,S=y*y+b*b+x*x;d<=fd*fd&&S<=pd*pd&&(i.setBodyPose(e,[a[0],a[1],a[2]],[f,p,m,h],[c,l,u],[y,b,x]),o=!0)}o||i.setBodyPose(e,t,n,[0,0,0],[0,0,0]),a?(a[0]=t[0],a[1]=t[1],a[2]=t[2],a[3]=n[0],a[4]=n[1],a[5]=n[2],a[6]=n[3]):this.kinPrevTargets.set(e,new Float32Array([...t,...n]))}allocKinematicPools(){if(!this.physics||!this.runtime||this.handBodies.length>0)return;this.handVisuals=Nn(this.runtime.sceneRoot,this.physics,{capacity:id,halfExtents:[.03,.03,.03],color:13935988,showOutline:!1,castShadow:!1,receiveShadow:!1}),this.colliderVisuals=Nn(this.runtime.sceneRoot,this.physics,{capacity:ad,halfExtents:[.06,.06,.06],color:8029332,showOutline:!1,castShadow:!1,receiveShadow:!1});for(let e=0;e<id;e++){let t=this.physics.addBody({position:this.parkSlot(e),mass:0,halfExtents:[ld,ld,ld],friction:.8,lockRotation:!0,collisionGroup:1,collisionMask:255});this.handBodies.push(t),this.handVisuals.addBody(t)}for(let e=0;e<ad;e++){let t=this.physics.addBody({position:this.parkSlot(id+e),mass:0,halfExtents:[ld,ld,ld],friction:.7,lockRotation:!0,collisionGroup:1,collisionMask:255});this.colliderBodies.push(t),this.colliderVisuals.addBody(t)}let e=this.handBodies[0],t=this.colliderBodies[this.colliderBodies.length-1]===e+id+ad-1?id+ad:id;this.runtime.setKinematicImpactors?.(e,t)}forceToWorld(e){let t=[(e.x-.5)*rd,e.y*rd,(e.z-.5)*rd];if(e.isCapsule){let n=Math.max((e.radius>0?e.radius:e.hy)*rd,.01);return{p:t,half:[e.hx*rd,n,n],quat:kd(e)}}if(e.isBox)return{p:t,half:[e.hx*rd,e.hy*rd,e.hz*rd],quat:kd(e)};let n=Math.max(e.radius*rd,.015);return{p:t,half:[n,n,n],quat:[0,0,0,1]}}syncKinematics(e){if(!this.physics)return;let t=performance.now();(t-this.forceSyncMs)/1e3,this.forceSyncMs=t;let n=new Uint8Array(this.handBodies.length),r=new Uint8Array(this.colliderBodies.length),i=0,a=0;for(let t of e){if(t.strength===0&&!t.isBox&&!t.isCapsule&&t.radius<=0)continue;let{p:e,half:o,quat:s}=this.forceToWorld(t),c=t.isBox||t.isCapsule,l=c?this.handBodies:this.colliderBodies,u=c?n:r,d=c?i++:a++;if(d>=l.length)continue;u[d]=1;let f=l[d];this.physics.setBodyPose(f,e,s,[0,0,0],[0,0,0]),this.physics.setBodyShapeHalfExtents(f,o)}for(let e=0;e<this.handBodies.length;e++)n[e]||this.parkBody(e,this.handBodies[e]);for(let e=0;e<this.colliderBodies.length;e++)r[e]||this.parkBody(id+e,this.colliderBodies[e])}get handColliderSpace(){return this.runtime?.sceneRoot??this.root}setHandColliders(e){let t=this.physics;if(!t)return;let n=performance.now(),r=gd((n-this.handSyncMs)/1e3,md,hd);this.handSyncMs=n;let i=Math.min(e.length,this.handBodies.length);for(let n=0;n<i;n++){let i=e[n],a=this.handBodies[n];this.driveKinematic(a,i.position,i.quaternion,r),t.setBodyShapeHalfExtents(a,i.halfExtents)}for(let e=i;e<this.handBodies.length;e++)this.parkBody(e,this.handBodies[e])}get pickReady(){let e=this.physics;return this.active&&e!==null&&e.getBodyCount()<=Sd}tryGrab(e){let t=this.physics;if(!t||this.dragging||!this.presenting||!this.pickReady)return!1;let n=this.handColliderSpace;n.updateMatrixWorld(!0),this.invRoot.copy(n.matrixWorld).invert(),this.localOrigin.copy(e.origin).applyMatrix4(this.invRoot),this.localDir.copy(e.direction).transformDirection(this.invRoot).normalize();let r=this.runtime?.nonGrabbableBodies,i=[this.localOrigin.x,this.localOrigin.y,this.localOrigin.z],a=[this.localDir.x,this.localDir.y,this.localDir.z],o=this.runtime?.pickKinematicBody?.(i,a)??null,s=t.pickDynamicBody(i,a,r&&r.size>0?{skip:e=>r.has(e)}:void 0)??(o!==null&&!r?.has(o)?this.centreHit(o,i):null);return s?(this.dragJointIndex=t.setDragJoint(s.body,s.worldHit,s.localHit,ud,this.dragJointIndex),this.dragging=!0,this.grabHighlight?.setBody(s.body,t),this.grabTarget.set(s.worldHit[0],s.worldHit[1],s.worldHit[2]).applyMatrix4(n.matrixWorld),this.dragRayDistance=Math.max(this.grabTarget.distanceTo(e.origin),.05),this.grabHasWrist=!1,!0):!1}moveGrab(e,t){let n=this.physics;if(!this.dragging||!n||this.dragJointIndex===null)return;t?(this.grabHasWrist&&(this.grabDelta.subVectors(t,this.grabWrist),this.grabDelta.lengthSq()<=dd*dd&&this.grabTarget.add(this.grabDelta)),this.grabWrist.copy(t),this.grabHasWrist=!0):this.grabHasWrist||this.grabTarget.copy(e.origin).addScaledVector(e.direction,this.dragRayDistance);let r=this.handColliderSpace;r.updateMatrixWorld(!0),this.invRoot.copy(r.matrixWorld).invert(),this.localOrigin.copy(this.grabTarget).applyMatrix4(this.invRoot),n.setJointAnchorA(this.dragJointIndex,[this.localOrigin.x,this.localOrigin.y,this.localOrigin.z])}endGrab(){this.endBodyDrag(),this.grabHasWrist=!1}activeBladeObbs(){if(!this.physics)return[];let e=[],t=t=>{for(let n of t){let t=this.physics.getBodyPoseCpu(n);!t||t.position[1]<-5||e.push({position:t.position,halfExtents:t.halfExtents,quaternion:t.quaternion})}};return t(this.handBodies),t(this.colliderBodies),e}},jd=class{camera;domElement;cameraEuler=new st(0,0,0,`YXZ`);up=new Y(0,1,0);moveForward=new Y;moveRight=new Y;moveDelta=new Y;desiredVelocity=new Y;lookDir=new Y;shootOrigin=new Y;keys=new Set;crosshair;sceneStatusHint;controlsHint;modeBadge;sceneStatusText=null;yaw=0;pitch=0;verticalVelocity=0;isGrounded=!1;isPointerLocked=!1;lookDragging=!1;bodyDragging=!1;primaryPending=!1;lookPointerId=null;jumpRequested=!1;noclipEnabled=!1;moveSpeed;sprintMultiplier;jumpVelocity;gravity;eyeHeight;groundY;mouseSensitivity;physicsBodyMode;freeFly;tryPrimaryGrab;onPrimaryGrabMove;onPrimaryGrabEnd;constructor(e,t,n={}){this.camera=e,this.domElement=t,this.moveSpeed=n.moveSpeed??7,this.sprintMultiplier=n.sprintMultiplier??1.8,this.jumpVelocity=n.jumpVelocity??5.4,this.gravity=n.gravity??16,this.eyeHeight=n.eyeHeight??1.7,this.groundY=n.groundY??0,this.mouseSensitivity=n.mouseSensitivity??.0018,this.physicsBodyMode=n.physicsBodyMode??!1,this.freeFly=n.freeFly??!1,this.tryPrimaryGrab=n.tryPrimaryGrab,this.onPrimaryGrabMove=n.onPrimaryGrabMove,this.onPrimaryGrabEnd=n.onPrimaryGrabEnd,this.freeFly&&(this.noclipEnabled=!0),this.crosshair=document.createElement(`div`),Object.assign(this.crosshair.style,{position:`fixed`,left:`50%`,top:`50%`,width:`12px`,height:`12px`,marginLeft:`-6px`,marginTop:`-6px`,pointerEvents:`none`,zIndex:`30`,display:`none`}),this.crosshair.innerHTML=`<div style="position:absolute;left:5px;top:0;width:2px;height:12px;background:#ffffffc0"></div><div style="position:absolute;left:0;top:5px;width:12px;height:2px;background:#ffffffc0"></div>`,document.body.appendChild(this.crosshair);let r=document.createElement(`div`);Object.assign(r.style,{position:`fixed`,bottom:`12px`,right:`12px`,display:`flex`,flexDirection:`column`,alignItems:`flex-end`,gap:`8px`,pointerEvents:`none`,zIndex:`30`}),document.body.appendChild(r);let i={color:`#ffffffd0`,fontFamily:`monospace`,fontSize:`12px`,background:`rgba(0,0,0,0.55)`,padding:`6px 10px`,borderRadius:`4px`,whiteSpace:`pre`};this.sceneStatusHint=document.createElement(`div`),Object.assign(this.sceneStatusHint.style,i,{display:`none`}),this.sceneStatusHint.textContent=``,r.appendChild(this.sceneStatusHint),this.controlsHint=document.createElement(`div`),Object.assign(this.controlsHint.style,i,{display:`none`}),r.appendChild(this.controlsHint),this.modeBadge=document.createElement(`div`),Object.assign(this.modeBadge.style,i),this.modeBadge.textContent=``,r.appendChild(this.modeBadge),this.updateModeBadge(),this.camera.position.y=Math.max(this.camera.position.y,this.groundY+this.eyeHeight),this.cameraEuler.setFromQuaternion(this.camera.quaternion),this.yaw=this.cameraEuler.y,this.pitch=J.clamp(this.cameraEuler.x,-1.54,1.54),this.applyView(),this.domElement.hasAttribute(`tabindex`)||(this.domElement.tabIndex=-1),window.addEventListener(`keydown`,this.onKeyDown),window.addEventListener(`keyup`,this.onKeyUp),document.addEventListener(`pointerlockchange`,this.onPointerLockChange),document.addEventListener(`mousemove`,this.onMouseMove),this.domElement.addEventListener(`pointerdown`,this.onPointerDown),this.domElement.addEventListener(`pointermove`,this.onPointerMove),this.domElement.addEventListener(`pointerup`,this.onPointerUp),this.domElement.addEventListener(`pointercancel`,this.onPointerUp),this.domElement.addEventListener(`contextmenu`,this.onContextMenu)}uiEnabled=!0;setEnabled(e){if(this.uiEnabled=e,!e){this.endLookDrag(),document.pointerLockElement===this.domElement&&document.exitPointerLock(),this.crosshair.style.display=`none`,this.sceneStatusHint.style.display=`none`,this.controlsHint.style.display=`none`,this.modeBadge.style.display=`none`,this.keys.clear();return}this.modeBadge.style.display=`block`,this.controlsHint.style.display=`block`,this.crosshair.style.display=this.freeFly?`block`:`none`,this.updateHintVisibility(),this.updateModeBadge()}isEnabled(){return this.uiEnabled}syncFromCamera(){this.cameraEuler.setFromQuaternion(this.camera.quaternion,`YXZ`),this.yaw=this.cameraEuler.y,this.pitch=J.clamp(this.cameraEuler.x,-1.54,1.54),this.applyView()}lockPointer(){!this.uiEnabled||this.freeFly||this.domElement.requestPointerLock()}isLocked(){return this.freeFly?this.uiEnabled:this.isPointerLocked}isLookDragging(){return this.lookDragging}isBodyDragging(){return this.bodyDragging}setSceneStatusText(e){this.sceneStatusText!==e&&(this.sceneStatusText=e,this.sceneStatusHint.textContent=e??``,this.updateHintVisibility())}update(e){if(!this.uiEnabled)return;let t=this.keys.has(`ShiftLeft`)||this.keys.has(`ShiftRight`)?this.sprintMultiplier:1,n=this.moveSpeed*t;if(this.getLookDirection(this.lookDir),this.freeFly||this.noclipEnabled?(this.moveForward.copy(this.lookDir),this.moveRight.set(1,0,0).applyQuaternion(this.camera.quaternion).normalize()):(this.moveForward.set(Math.sin(this.yaw),0,-Math.cos(this.yaw)).normalize(),this.moveRight.crossVectors(this.moveForward,this.up).normalize()),this.moveDelta.set(0,0,0),this.keys.has(`KeyW`)&&this.moveDelta.add(this.moveForward),this.keys.has(`KeyS`)&&this.moveDelta.sub(this.moveForward),this.keys.has(`KeyD`)&&this.moveDelta.add(this.moveRight),this.keys.has(`KeyA`)&&this.moveDelta.sub(this.moveRight),this.freeFly?(this.keys.has(`KeyE`)&&this.moveDelta.add(this.lookDir),this.keys.has(`KeyQ`)&&this.moveDelta.sub(this.lookDir)):this.noclipEnabled&&(this.keys.has(`Space`)&&this.moveDelta.add(this.up),(this.keys.has(`ControlLeft`)||this.keys.has(`ControlRight`)||this.keys.has(`KeyQ`))&&this.moveDelta.sub(this.up),this.keys.has(`KeyE`)&&this.moveDelta.add(this.up)),this.desiredVelocity.set(0,0,0),this.moveDelta.lengthSq()>1e-6&&(this.moveDelta.normalize(),this.desiredVelocity.copy(this.moveDelta).multiplyScalar(n),this.physicsBodyMode||this.camera.position.addScaledVector(this.moveDelta,n*e)),this.physicsBodyMode)return;if(this.freeFly||this.noclipEnabled){this.verticalVelocity=0,this.isGrounded=!1;return}this.verticalVelocity-=this.gravity*e,this.camera.position.y+=this.verticalVelocity*e;let r=this.groundY+this.eyeHeight;this.camera.position.y<=r?(this.camera.position.y=r,this.verticalVelocity=0,this.isGrounded=!0):this.isGrounded=!1}getLookDirection(e){return e.set(0,0,-1).applyQuaternion(this.camera.quaternion).normalize()}getShootOrigin(e,t=1){return this.getLookDirection(this.lookDir),this.shootOrigin.copy(this.camera.position).addScaledVector(this.lookDir,t),e.copy(this.shootOrigin)}applyView(){this.cameraEuler.set(this.pitch,this.yaw,0,`YXZ`),this.camera.quaternion.setFromEuler(this.cameraEuler)}toggleNoclip(){return this.setNoclipEnabled(!this.noclipEnabled),this.noclipEnabled}isNoclipEnabled(){return this.noclipEnabled}isTypingTarget(e){return e instanceof HTMLInputElement||e instanceof HTMLTextAreaElement||e instanceof HTMLSelectElement||e instanceof HTMLElement&&e.isContentEditable}releaseUiFocus(){let e=document.activeElement;e instanceof HTMLElement&&e!==this.domElement&&this.isTypingTarget(e)&&e.blur(),this.domElement.focus({preventScroll:!0})}onKeyDown=e=>{if(this.uiEnabled&&!(this.isTypingTarget(e.target)||this.isTypingTarget(document.activeElement))&&(this.keys.add(e.code),!this.freeFly)){if(e.code===`KeyN`&&!e.repeat){e.preventDefault(),this.toggleNoclip();return}e.code===`Space`&&(e.preventDefault(),this.physicsBodyMode?this.isGrounded&&=(this.jumpRequested=!0,!1):!this.noclipEnabled&&this.isGrounded&&(this.verticalVelocity=this.jumpVelocity,this.isGrounded=!1))}};onKeyUp=e=>{this.keys.delete(e.code)};onPointerLockChange=()=>{this.freeFly||(this.isPointerLocked=document.pointerLockElement===this.domElement,this.crosshair.style.display=this.isPointerLocked?`block`:`none`,this.updateHintVisibility())};onContextMenu=e=>{this.uiEnabled&&this.freeFly&&e.preventDefault()};onPointerDown=e=>{if(!this.uiEnabled||!this.freeFly||e.button!==0||e.target!==this.domElement)return;e.preventDefault(),this.releaseUiFocus(),this.lookPointerId=e.pointerId,this.bodyDragging=!1,this.lookDragging=!1;try{this.domElement.setPointerCapture(e.pointerId)}catch{}if(!this.tryPrimaryGrab){this.lookDragging=!0;return}this.primaryPending=!0;let t=e.pointerId;Promise.resolve(this.tryPrimaryGrab(e)).then(n=>{if(!this.uiEnabled||this.lookPointerId!==t){n&&this.onPrimaryGrabEnd?.(e);return}this.primaryPending=!1,n?(this.bodyDragging=!0,this.lookDragging=!1):(this.bodyDragging=!1,this.lookDragging=!0)})};onPointerMove=e=>{if(!(!this.uiEnabled||!this.freeFly)&&!(this.lookPointerId!==null&&e.pointerId!==this.lookPointerId)){if(this.bodyDragging||this.primaryPending){this.onPrimaryGrabMove?.(e);return}this.lookDragging&&this.applyLookDelta(e.movementX,e.movementY)}};onPointerUp=e=>{if(!this.freeFly||this.lookPointerId!==null&&e.pointerId!==this.lookPointerId)return;let t=this.bodyDragging||this.primaryPending;this.endPrimaryPointer(),t&&this.onPrimaryGrabEnd?.(e)};endPrimaryPointer(){if(this.lookPointerId!==null)try{this.domElement.releasePointerCapture(this.lookPointerId)}catch{}this.lookDragging=!1,this.bodyDragging=!1,this.primaryPending=!1,this.lookPointerId=null}endLookDrag(){this.endPrimaryPointer()}applyLookDelta(e,t){e===0&&t===0||(this.yaw-=e*this.mouseSensitivity,this.pitch-=t*this.mouseSensitivity,this.pitch=J.clamp(this.pitch,-1.54,1.54),this.applyView())}onMouseMove=e=>{this.freeFly||!this.isPointerLocked||this.applyLookDelta(e.movementX,e.movementY)};getDesiredMoveVelocity(e){return e.copy(this.desiredVelocity)}captureState(){return{position:[this.camera.position.x,this.camera.position.y,this.camera.position.z],quaternion:[this.camera.quaternion.x,this.camera.quaternion.y,this.camera.quaternion.z,this.camera.quaternion.w],verticalVelocity:this.verticalVelocity,isGrounded:this.isGrounded,jumpRequested:this.jumpRequested,noclipEnabled:this.noclipEnabled}}restoreState(e){this.setNoclipEnabled(e.noclipEnabled),this.camera.position.set(e.position[0],e.position[1],e.position[2]),this.camera.quaternion.set(e.quaternion[0],e.quaternion[1],e.quaternion[2],e.quaternion[3]),this.cameraEuler.setFromQuaternion(this.camera.quaternion,`YXZ`),this.yaw=this.cameraEuler.y,this.pitch=J.clamp(this.cameraEuler.x,-1.54,1.54),this.verticalVelocity=e.verticalVelocity,this.isGrounded=e.isGrounded,this.jumpRequested=e.jumpRequested}consumeJumpRequest(){let e=this.jumpRequested;return this.jumpRequested=!1,e}setPhysicsBodyState(e,t,n=this.eyeHeight){this.camera.position.set(e.x,e.y+n,e.z),this.isGrounded=t}setNoclipEnabled(e){if(this.noclipEnabled!==e){if(this.noclipEnabled=e,this.verticalVelocity=0,!this.physicsBodyMode&&!e){let e=this.groundY+this.eyeHeight;this.camera.position.y<e&&(this.camera.position.y=e),this.isGrounded=this.camera.position.y<=e+1e-4}else this.isGrounded=!1;this.updateModeBadge()}}updateHintVisibility(){this.sceneStatusHint.style.display=this.uiEnabled&&this.sceneStatusText?`block`:`none`}updateModeBadge(){if(this.controlsHint.textContent=this.freeFly?`WASD + QE  move
LMB drag   look / grab a body
RMB hold   fire projectiles`:`WASD  move
Space jump  ·  N noclip`,this.freeFly){this.modeBadge.textContent=`Mode: FLY`,this.modeBadge.style.background=`rgba(42, 122, 64, 0.75)`;return}this.noclipEnabled?(this.modeBadge.textContent=`Mode: NOCLIP`,this.modeBadge.style.background=`rgba(42, 122, 64, 0.75)`):(this.modeBadge.textContent=`Mode: WALK`,this.modeBadge.style.background=`rgba(0,0,0,0.55)`)}},Md={width:.1,height:.07,gap:.008},Nd={width:256,height:148},Pd={y:1.22,z:-.48,tilt:.32},Fd=[{action:`kora`,text:`kora`},{action:`mls`,text:`mls`},{action:`avbd`,text:`avbd`},{action:`reset`,text:`reset`}],Id=[{action:`sand`,text:`sand`},{action:`goo`,text:`goo`},{action:`water`,text:`water`},{action:`toggle-view`,text:`solid`}];function Ld(e){return e===`fire`?`kora`:e===`avbd`?`avbd`:`mls`}function Rd(e){let t=e.filter(e=>e.mesh.visible),n=t.length*Md.width+Math.max(t.length-1,0)*Md.gap;for(let[e,r]of t.entries())r.mesh.position.x=-n/2+Md.width/2+e*(Md.width+Md.gap)}function zd(e,t){let n=e.canvas.getContext(`2d`);if(!n)return;let{width:r,height:i}=Nd,a=e.action===`reset`;n.clearRect(0,0,r,i),n.beginPath(),n.roundRect(4,4,r-8,i-8,26),n.fillStyle=t&&!a?`#d4a574`:`#1b1f27`,n.fill(),n.lineWidth=3,n.strokeStyle=t&&!a?`#f0d2a8`:`#48525f`,n.stroke(),n.fillStyle=t&&!a?`#231607`:`#c3ccd8`,n.font=`600 48px system-ui, -apple-system, sans-serif`,n.textAlign=`center`,n.textBaseline=`middle`,n.fillText(e.text,r/2,i/2+2),e.texture.needsUpdate=!0}var Bd=class{group=new Ue;buttons=[];mlsButtons=[];geometry=new Re(Md.width,Md.height);current;gelSurface=!0;onAction=null;constructor(e=`sand`){this.current=e,this.buildRow(Fd,0,this.buttons),this.buildRow(Id,-(Md.height+Md.gap),this.mlsButtons),this.group.position.set(0,Pd.y,Pd.z),this.group.rotation.x=Pd.tilt,this.group.visible=!1,this.repaint()}buildRow(e,t,n){for(let{action:r,text:i}of e){let e=document.createElement(`canvas`);e.width=Nd.width,e.height=Nd.height;let a=new Ae(e);a.colorSpace=Me;let o=new Qe(this.geometry,new Ye({map:a,transparent:!0}));o.position.y=t,o.name=`mat-panel-${r}`;let s={action:r,mesh:o,texture:a,canvas:e,text:i};this.group.add(o),n.push(s)}Rd(n)}get targets(){return[...this.buttons,...this.mlsButtons].filter(e=>e.mesh.visible).map(e=>e.mesh)}get visible(){return this.group.visible}setOnAction(e){this.onAction=e}setKind(e){this.current=e,this.repaint()}setGelSurface(e){this.gelSurface=e,this.repaint()}repaint(){let e=Ld(this.current);for(let t of this.buttons)zd(t,t.action===e);for(let t of this.mlsButtons){let n=t.action===`toggle-view`;t.mesh.visible=e===`mls`&&(!n||this.current===`goo`),zd(t,n?this.gelSurface:t.action===this.current)}Rd(this.mlsButtons)}setVisible(e){this.group.visible=e}handlePick(e){let t=this.buttons.find(t=>t.mesh===e)??this.mlsButtons.find(t=>t.mesh===e&&t.mesh.visible);if(!t)return!1;if(this.onAction?.(t.action),t.action===`kora`)this.setKind(`fire`);else if(t.action===`mls`){let e=this.current===`sand`||this.current===`goo`||this.current===`water`?this.current:`sand`;this.setKind(e)}else t.action===`avbd`?this.setKind(`avbd`):t.action!==`reset`&&t.action!==`toggle-view`&&this.setKind(t.action);return!0}dispose(){for(let e of[...this.buttons,...this.mlsButtons])e.texture.dispose(),e.mesh.material.dispose();this.geometry.dispose()}},Vd={width:.09,height:.055,gap:.008},Hd={width:.34,height:.055,gap:.008},Ud={width:320,height:120};function Wd(e,t,n){return Math.min(n,Math.max(t,e))}function Gd(e,t,n,r,i,a){t(Wd(e()+a*n,r,i))}var Kd=[{title:`forces`,knobs:[{label:`hand`,read:e=>e.handForce.toFixed(0),step:(e,t,n)=>Gd(()=>e.handForce,t=>{e.handForce=t},5,5,120,n)},{label:`hand ×`,read:(e,t)=>e[t].handForceScale.toFixed(2),step:(e,t,n)=>Gd(()=>e[t].handForceScale,n=>{e[t].handForceScale=n},.25,.2,8,n)},{label:`grav`,read:e=>e.gravity.toFixed(0),step:(e,t,n)=>Gd(()=>e.gravity,t=>{e.gravity=t},10,10,250,n)}]},{title:`body`,knobs:[{label:`grav ×`,read:(e,t)=>e[t].gravityScale.toFixed(2),step:(e,t,n)=>Gd(()=>e[t].gravityScale,n=>{e[t].gravityScale=n},.1,.2,4,n)},{label:`μ`,read:(e,t)=>e[t].mu.toFixed(0),step:(e,t,n)=>Gd(()=>e[t].mu,n=>{e[t].mu=n},10,0,400,n)},{label:`λ`,read:(e,t)=>e[t].lambda.toFixed(0),step:(e,t,n)=>Gd(()=>e[t].lambda,n=>{e[t].lambda=n},20,20,1200,n)}]},{title:`time`,knobs:[{label:`subs`,read:e=>e.substeps.toFixed(0),step:(e,t,n)=>Gd(()=>e.substeps,t=>{e.substeps=Math.round(t)},1,4,24,n)},{label:`Δt`,read:e=>e.subDt.toExponential(1),step:(e,t,n)=>Gd(()=>e.subDt,t=>{e.subDt=t},2e-5,1e-4,5e-4,n)}]}];function qd(e,t,n=!1){let r=e.canvas.getContext(`2d`);if(!r)return;let{width:i,height:a}=Ud;r.clearRect(0,0,i,a),r.beginPath(),r.roundRect(4,4,i-8,a-8,22),r.fillStyle=n?`#d4a574`:`#1b1f27`,r.fill(),r.lineWidth=3,r.strokeStyle=n?`#f0d2a8`:`#48525f`,r.stroke(),r.fillStyle=n?`#231607`:`#c3ccd8`,r.font=`600 44px system-ui, -apple-system, sans-serif`,r.textAlign=`center`,r.textBaseline=`middle`,r.fillText(t,i/2,a/2+2),e.texture.needsUpdate=!0}function Jd(e,t,n){let r=e.canvas.getContext(`2d`);if(!r)return;let{width:i,height:a}=Ud;r.clearRect(0,0,i,a),r.beginPath(),r.roundRect(4,4,i-8,a-8,22),r.fillStyle=`#141820`,r.fill(),r.lineWidth=3,r.strokeStyle=`#3a4452`,r.stroke(),r.fillStyle=`#8d96a3`,r.font=`600 36px system-ui, -apple-system, sans-serif`,r.textAlign=`left`,r.textBaseline=`middle`,r.fillText(t,28,a/2+2),r.fillStyle=`#e8eef6`,r.textAlign=`right`,r.font=`600 40px system-ui, -apple-system, sans-serif`,r.fillText(n,i-28,a/2+2),e.texture.needsUpdate=!0}function Yd(e,t,n){let r=document.createElement(`canvas`);r.width=Ud.width,r.height=Ud.height;let i=new Ae(r);i.colorSpace=Me;let a=new Qe(new Re(e,t),new Ye({map:i,transparent:!0}));return a.name=`world-params-${n}`,{mesh:a,texture:i,canvas:r,action:n}}var Xd={y:1.42,z:-.48,tilt:.32},Zd=class{group=new Ue;widgets=[];byAction=new Map;pageIndex=0;kind=`sand`;params;onChange=null;constructor(e){this.params=e;let t=Yd(Vd.width,Vd.height,`page-prev`),n=Yd(Hd.width*.7,Vd.height,`page-title`),r=Yd(Vd.width,Vd.height,`page-next`),i=(Hd.height+Hd.gap)*3+Vd.height*.5,a=Vd.width*2+Hd.width*.7+Vd.gap*2;t.mesh.position.set(-a/2+Vd.width/2,i,0),n.mesh.position.set(0,i,0),r.mesh.position.set(a/2-Vd.width/2,i,0),this.addWidget(t),this.addWidget(n),this.addWidget(r);for(let e=0;e<3;e++){let t=(Hd.height+Hd.gap)*(2-e),n=Yd(Vd.width,Hd.height,`knob-${e}-`),r=Yd(Hd.width,Hd.height,`knob-${e}`),i=Yd(Vd.width,Hd.height,`knob-${e}+`),a=Vd.width*2+Hd.width+Vd.gap*2;n.mesh.position.set(-a/2+Vd.width/2,t,0),r.mesh.position.set(0,t,0),i.mesh.position.set(a/2-Vd.width/2,t,0),this.addWidget(n),this.addWidget(r),this.addWidget(i)}this.group.position.set(0,Xd.y,Xd.z),this.group.rotation.x=Xd.tilt,this.group.visible=!1,this.repaint()}addWidget(e){this.group.add(e.mesh),this.widgets.push(e),this.byAction.set(e.action,e)}get targets(){return this.widgets.map(e=>e.mesh)}get visible(){return this.group.visible}setVisible(e){this.group.visible=e}setKind(e){this.kind=e,this.repaint()}setOnChange(e){this.onChange=e}refresh(){this.repaint()}handlePick(e){let t=this.widgets.find(t=>t.mesh===e);if(!t)return!1;if(t.action===`page-prev`)return this.pageIndex=(this.pageIndex+Kd.length-1)%Kd.length,this.repaint(),!0;if(t.action===`page-next`)return this.pageIndex=(this.pageIndex+1)%Kd.length,this.repaint(),!0;if(t.action===`page-title`||/^knob-\d+$/.test(t.action))return!0;let n=/^knob-(\d+)([+-])$/.exec(t.action);if(!n)return!0;let r=Number(n[1]),i=n[2]===`+`?1:-1,a=Kd[this.pageIndex].knobs[r];return a?(a.step(this.params,this.kind,i),this.onChange?.(),this.repaint(),!0):!0}repaint(){let e=Kd[this.pageIndex];qd(this.byAction.get(`page-prev`),`‹`),qd(this.byAction.get(`page-title`),`${e.title} · ${this.kind}`),qd(this.byAction.get(`page-next`),`›`);for(let t=0;t<3;t++){let n=this.byAction.get(`knob-${t}-`),r=this.byAction.get(`knob-${t}`),i=this.byAction.get(`knob-${t}+`),a=e.knobs[t];if(!a){n.mesh.visible=!1,r.mesh.visible=!1,i.mesh.visible=!1;continue}n.mesh.visible=!0,r.mesh.visible=!0,i.mesh.visible=!0,qd(n,`−`),Jd(r,a.label,a.read(this.params,this.kind)),qd(i,`+`)}}dispose(){for(let e of this.widgets)e.texture.dispose(),e.mesh.material.dispose(),e.mesh.geometry.dispose()}},Qd={width:.09,height:.055,gap:.008},$d={width:.34,height:.055,gap:.008},ef={width:320,height:120},tf={y:1.42,z:-.48,tilt:.32},nf=[`translate`,`rotate`,`scale`],rf={translate:`move`,rotate:`turn`,scale:`size`};function af(e,t,n){return Math.min(n,Math.max(t,e))}function of(e,t,n,r,i,a){t(af(e()+a*n,r,i))}function sf(e){return[{title:`burn`,knobs:[{label:`fuel`,read:e=>e.sourceAmount.toFixed(2),step:(e,t)=>of(()=>e.sourceAmount,t=>{e.sourceAmount=t},.1,0,3,t)},{label:`burn`,read:e=>e.combustionRate.toFixed(0),step:(e,t)=>of(()=>e.combustionRate,t=>{e.combustionRate=t},2,1,80,t)},{label:`T src`,read:e=>e.sourceTemperature.toFixed(0),step:(e,t)=>of(()=>e.sourceTemperature,t=>{e.sourceTemperature=t},50,800,2200,t)}]},{title:`smoke`,knobs:[{label:`form`,read:e=>e.sootFormationRate.toFixed(1),step:(e,t)=>of(()=>e.sootFormationRate,t=>{e.sootFormationRate=t},.5,0,20,t)},{label:`dens`,read:e=>e.sootDensity.toFixed(0),step:(e,t)=>of(()=>e.sootDensity,t=>{e.sootDensity=t},20,0,600,t)},{label:`fade`,read:e=>e.sootDissipationRate.toFixed(2),step:(e,t)=>of(()=>e.sootDissipationRate,t=>{e.sootDissipationRate=t},.02,0,1,t)}]},{title:`look`,knobs:[{label:`exp`,read:e=>e.exposure.toFixed(2),step:(e,t)=>of(()=>e.exposure,t=>{e.exposure=t},.05,.05,4,t)},{label:`flame`,read:e=>e.flameIntensity.toFixed(2),step:(e,t)=>of(()=>e.flameIntensity,t=>{e.flameIntensity=t},.1,.1,4,t)},{label:`hollow`,read:e=>e.hollowFlame.toFixed(2),step:(e,t)=>of(()=>e.hollowFlame,t=>{e.hollowFlame=t},.05,0,1,t)}]},{title:`tool`,knobs:[{label:`gizmo`,read:e=>rf[e.gizmoMode],step:(t,n)=>{let r=nf[(nf.indexOf(t.gizmoMode)+(n===1?1:nf.length-1))%nf.length];t.gizmoMode=r,e(r)}},{label:`speed`,read:e=>e.sourceSpeed.toFixed(1),step:(e,t)=>of(()=>e.sourceSpeed,t=>{e.sourceSpeed=t},.25,0,8,t)},{label:`bloom`,read:e=>e.bloom.toFixed(2),step:(e,t)=>of(()=>e.bloom,t=>{e.bloom=t},.05,0,2,t)}]}]}function cf(e,t,n=!1){let r=e.canvas.getContext(`2d`);if(!r)return;let{width:i,height:a}=ef;r.clearRect(0,0,i,a),r.beginPath(),r.roundRect(4,4,i-8,a-8,22),r.fillStyle=n?`#d4a574`:`#1b1f27`,r.fill(),r.lineWidth=3,r.strokeStyle=n?`#f0d2a8`:`#48525f`,r.stroke(),r.fillStyle=n?`#231607`:`#c3ccd8`,r.font=`600 44px system-ui, -apple-system, sans-serif`,r.textAlign=`center`,r.textBaseline=`middle`,r.fillText(t,i/2,a/2+2),e.texture.needsUpdate=!0}function lf(e,t,n){let r=e.canvas.getContext(`2d`);if(!r)return;let{width:i,height:a}=ef;r.clearRect(0,0,i,a),r.beginPath(),r.roundRect(4,4,i-8,a-8,22),r.fillStyle=`#141820`,r.fill(),r.lineWidth=3,r.strokeStyle=`#3a4452`,r.stroke(),r.fillStyle=`#8d96a3`,r.font=`600 36px system-ui, -apple-system, sans-serif`,r.textAlign=`left`,r.textBaseline=`middle`,r.fillText(t,28,a/2+2),r.fillStyle=`#e8eef6`,r.textAlign=`right`,r.font=`600 40px system-ui, -apple-system, sans-serif`,r.fillText(n,i-28,a/2+2),e.texture.needsUpdate=!0}function uf(e,t,n){let r=document.createElement(`canvas`);r.width=ef.width,r.height=ef.height;let i=new Ae(r);i.colorSpace=Me;let a=new Qe(new Re(e,t),new Ye({map:i,transparent:!0}));return a.name=`fire-params-${n}`,{mesh:a,texture:i,canvas:r,action:n}}var df=class{group=new Ue;widgets=[];byAction=new Map;pages;pageIndex=0;getParams;onChange=null;constructor(e,t){this.getParams=e,this.pages=sf(t);let n=uf(Qd.width,Qd.height,`page-prev`),r=uf($d.width*.7,Qd.height,`page-title`),i=uf(Qd.width,Qd.height,`page-next`),a=($d.height+$d.gap)*3+Qd.height*.5,o=Qd.width*2+$d.width*.7+Qd.gap*2;n.mesh.position.set(-o/2+Qd.width/2,a,0),r.mesh.position.set(0,a,0),i.mesh.position.set(o/2-Qd.width/2,a,0),this.addWidget(n),this.addWidget(r),this.addWidget(i);for(let e=0;e<3;e++){let t=($d.height+$d.gap)*(2-e),n=uf(Qd.width,$d.height,`knob-${e}-`),r=uf($d.width,$d.height,`knob-${e}`),i=uf(Qd.width,$d.height,`knob-${e}+`),a=Qd.width*2+$d.width+Qd.gap*2;n.mesh.position.set(-a/2+Qd.width/2,t,0),r.mesh.position.set(0,t,0),i.mesh.position.set(a/2-Qd.width/2,t,0),this.addWidget(n),this.addWidget(r),this.addWidget(i)}this.group.position.set(0,tf.y,tf.z),this.group.rotation.x=tf.tilt,this.group.visible=!1,this.repaint()}addWidget(e){this.group.add(e.mesh),this.widgets.push(e),this.byAction.set(e.action,e)}get targets(){return this.widgets.map(e=>e.mesh)}get visible(){return this.group.visible}setVisible(e){this.group.visible=e}setOnChange(e){this.onChange=e}refresh(){this.repaint()}handlePick(e){let t=this.widgets.find(t=>t.mesh===e);if(!t)return!1;if(t.action===`page-prev`)return this.pageIndex=(this.pageIndex+this.pages.length-1)%this.pages.length,this.repaint(),!0;if(t.action===`page-next`)return this.pageIndex=(this.pageIndex+1)%this.pages.length,this.repaint(),!0;if(t.action===`page-title`||/^knob-\d+$/.test(t.action))return!0;let n=/^knob-(\d+)([+-])$/.exec(t.action);if(!n)return!0;let r=Number(n[1]),i=n[2]===`+`?1:-1,a=this.pages[this.pageIndex].knobs[r];return a?(a.step(this.getParams(),i),this.onChange?.(),this.repaint(),!0):!0}repaint(){let e=this.pages[this.pageIndex],t=this.getParams();cf(this.byAction.get(`page-prev`),`‹`),cf(this.byAction.get(`page-title`),`${e.title} · fire`),cf(this.byAction.get(`page-next`),`›`);for(let n=0;n<3;n++){let r=this.byAction.get(`knob-${n}-`),i=this.byAction.get(`knob-${n}`),a=this.byAction.get(`knob-${n}+`),o=e.knobs[n];if(!o){r.mesh.visible=!1,i.mesh.visible=!1,a.mesh.visible=!1;continue}r.mesh.visible=!0,i.mesh.visible=!0,a.mesh.visible=!0,cf(r,`−`),lf(i,o.label,o.read(t)),cf(a,`+`)}}dispose(){for(let e of this.widgets)e.texture.dispose(),e.mesh.material.dispose(),e.mesh.geometry.dispose()}},ff={width:.09,height:.055,gap:.008},pf={width:.42,height:.055,gap:.008},mf={width:384,height:120},hf=4,gf={y:1.4,z:-.48,tilt:.32};function _f(){let e=[];for(let{group:t,ids:n}of Xu({skipDesktopOnly:!0})){let r=Math.ceil(n.length/hf);for(let i=0;i<r;i++)e.push({title:r>1?`${t} ${i+1}/${r}`:t,ids:n.slice(i*hf,i*hf+hf)})}return e}function vf(e,t,n,r){for(let i=r;i>22;i-=2)if(e.font=`600 ${i}px system-ui, -apple-system, sans-serif`,e.measureText(t).width<=n)return}function yf(e,t){let n=e.canvas.getContext(`2d`);if(!n)return;let{width:r,height:i}=mf;n.clearRect(0,0,r,i),n.beginPath(),n.roundRect(4,4,r-8,i-8,22),n.fillStyle=`#1b1f27`,n.fill(),n.lineWidth=3,n.strokeStyle=`#48525f`,n.stroke(),n.fillStyle=`#c3ccd8`,n.textAlign=`center`,n.textBaseline=`middle`,vf(n,t,r-40,44),n.fillText(t,r/2,i/2+2),e.texture.needsUpdate=!0}function bf(e,t,n){let r=e.canvas.getContext(`2d`);if(!r)return;let{width:i,height:a}=mf;r.clearRect(0,0,i,a),r.beginPath(),r.roundRect(4,4,i-8,a-8,22),r.fillStyle=n?`#d4a574`:`#141820`,r.fill(),r.lineWidth=3,r.strokeStyle=n?`#f0d2a8`:`#3a4452`,r.stroke(),r.fillStyle=n?`#231607`:`#e8eef6`,r.textAlign=`left`,r.textBaseline=`middle`,vf(r,t,i-56,40),r.fillText(t,28,a/2+2),e.texture.needsUpdate=!0}function xf(e,t,n){let r=document.createElement(`canvas`);r.width=mf.width,r.height=mf.height;let i=new Ae(r);i.colorSpace=Me;let a=new Qe(new Re(e,t),new Ye({map:i,transparent:!0}));return a.name=`avbd-scene-${n}`,{mesh:a,texture:i,canvas:r,action:n}}var Sf=class{group=new Ue;widgets=[];byAction=new Map;pages=_f();pageIndex=0;current=Wu;onSelect=null;constructor(){let e=xf(ff.width,ff.height,`page-prev`),t=xf(pf.width*.7,ff.height,`page-title`),n=xf(ff.width,ff.height,`page-next`),r=(pf.height+pf.gap)*hf+ff.height*.5,i=ff.width*2+pf.width*.7+ff.gap*2;e.mesh.position.set(-i/2+ff.width/2,r,0),t.mesh.position.set(0,r,0),n.mesh.position.set(i/2-ff.width/2,r,0),this.addWidget(e),this.addWidget(t),this.addWidget(n);for(let e=0;e<hf;e++){let t=xf(pf.width,pf.height,`scene-${e}`);t.mesh.position.set(0,(pf.height+pf.gap)*(hf-1-e),0),this.addWidget(t)}this.group.position.set(0,gf.y,gf.z),this.group.rotation.x=gf.tilt,this.group.visible=!1,this.pageIndex=this.pageOf(this.current),this.repaint()}addWidget(e){this.group.add(e.mesh),this.widgets.push(e),this.byAction.set(e.action,e)}pageOf(e){let t=this.pages.findIndex(t=>t.ids.includes(e));return t<0?this.pageIndex:t}get targets(){return this.widgets.filter(e=>e.mesh.visible).map(e=>e.mesh)}get visible(){return this.group.visible}setVisible(e){this.group.visible=e}setOnSelect(e){this.onSelect=e}setScene(e){this.current=e,this.pageIndex=this.pageOf(e),this.repaint()}handlePick(e){let t=this.widgets.find(t=>t.mesh===e);if(!t)return!1;if(t.action===`page-prev`)return this.pageIndex=(this.pageIndex+this.pages.length-1)%this.pages.length,this.repaint(),!0;if(t.action===`page-next`)return this.pageIndex=(this.pageIndex+1)%this.pages.length,this.repaint(),!0;if(t.action===`page-title`)return!0;let n=/^scene-(\d+)$/.exec(t.action);if(!n)return!0;let r=this.pages[this.pageIndex]?.ids[Number(n[1])];return!r||r===this.current?!0:(this.current=r,this.repaint(),this.onSelect?.(r),!0)}repaint(){let e=this.pages[this.pageIndex];yf(this.byAction.get(`page-prev`),`‹`),yf(this.byAction.get(`page-title`),e?.title??`scenes`),yf(this.byAction.get(`page-next`),`›`);for(let t=0;t<hf;t++){let n=this.byAction.get(`scene-${t}`),r=e?.ids[t];n.mesh.visible=r!==void 0,r!==void 0&&bf(n,qu(r),r===this.current)}}dispose(){for(let e of this.widgets)e.texture.dispose(),e.mesh.material.dispose(),e.mesh.geometry.dispose()}},Cf={width:.075,height:.045,gap:.006},wf={width:256,height:148},Tf={y:1.31,z:-.48,tilt:.32},Ef={void:`void`,studio:`studio`,dusk:`dusk`,daylight:`day`,night:`night`};function Df(e,t){let n=e.canvas.getContext(`2d`);if(!n)return;let{width:r,height:i}=wf;n.clearRect(0,0,r,i),n.beginPath(),n.roundRect(4,4,r-8,i-8,26),n.fillStyle=t?`#d4a574`:`#141820`,n.fill(),n.lineWidth=3,n.strokeStyle=t?`#f0d2a8`:`#3a4452`,n.stroke(),n.fillStyle=t?`#231607`:`#c3ccd8`,n.textAlign=`center`,n.textBaseline=`middle`,n.font=`600 44px system-ui, -apple-system, sans-serif`,n.fillText(Ef[e.name],r/2,i/2+2),e.texture.needsUpdate=!0}var Of=class{group=new Ue;buttons=[];current=`night`;onSelect=null;constructor(){let e=i.length*Cf.width+(i.length-1)*Cf.gap;for(let[t,n]of i.entries()){let r=document.createElement(`canvas`);r.width=wf.width,r.height=wf.height;let i=new Ae(r);i.colorSpace=Me;let a=new Qe(new Re(Cf.width,Cf.height),new Ye({map:i,transparent:!0}));a.name=`env-${n}`,a.position.x=-e/2+Cf.width/2+t*(Cf.width+Cf.gap),this.group.add(a),this.buttons.push({mesh:a,texture:i,canvas:r,name:n})}this.group.position.set(0,Tf.y,Tf.z),this.group.rotation.x=Tf.tilt,this.group.visible=!1,this.repaint()}get targets(){return this.buttons.map(e=>e.mesh)}get visible(){return this.group.visible}setVisible(e){this.group.visible=e}setOnSelect(e){this.onSelect=e}setEnvironment(e){this.current!==e&&(this.current=e,this.repaint())}handlePick(e){let t=this.buttons.find(t=>t.mesh===e);return t?(t.name!==this.current&&(this.current=t.name,this.repaint(),this.onSelect?.(t.name)),!0):!1}repaint(){for(let e of this.buttons)Df(e,e.name===this.current)}dispose(){for(let e of this.buttons)e.texture.dispose(),e.mesh.material.dispose(),e.mesh.geometry.dispose()}},kf=class{group=new Ue;materials;params;env=new Of;fireParams=null;avbdScenes=null;exhibit;paramsChangeHandler=null;constructor(e,t=`sand`){this.exhibit=t,this.materials=new Bd(t===`fire`?`sand`:t),this.params=new Zd(e),this.group.add(this.materials.group),this.group.add(this.params.group),this.group.add(this.env.group),this.materials.setKind(t),this.syncParamsVisibility()}bindFire(e,t){this.fireParams&&(this.group.remove(this.fireParams.group),this.fireParams.dispose()),this.fireParams=new df(e,t),this.paramsChangeHandler&&this.fireParams.setOnChange(this.paramsChangeHandler),this.group.add(this.fireParams.group),this.syncParamsVisibility()}bindAvbdScenes(e){this.avbdScenes&&(this.group.remove(this.avbdScenes.group),this.avbdScenes.dispose()),this.avbdScenes=new Sf,this.avbdScenes.setOnSelect(e),this.group.add(this.avbdScenes.group),this.syncParamsVisibility()}setAvbdScene(e){this.avbdScenes?.setScene(e)}get targets(){let e=this.fireParams?.visible?this.fireParams.targets:[],t=this.params.visible?this.params.targets:[],n=this.avbdScenes?.visible?this.avbdScenes.targets:[],r=this.env.visible?this.env.targets:[];return[...this.materials.targets,...t,...e,...n,...r]}get visible(){return this.group.visible}setVisible(e){this.group.visible=e,this.materials.setVisible(e),this.syncParamsVisibility()}setOnAction(e){this.materials.setOnAction(e)}setOnEnvironment(e){this.env.setOnSelect(e)}setEnvironment(e){this.env.setEnvironment(e)}setOnParamsChange(e){this.paramsChangeHandler=e,this.params.setOnChange(e),this.fireParams?.setOnChange(e)}setExhibit(e){this.exhibit=e,this.materials.setKind(e),e!==`fire`&&e!==`avbd`&&this.params.setKind(e),this.syncParamsVisibility()}setGelSurface(e){this.materials.setGelSurface(e)}setMaterialKind(e){this.exhibit=e,this.materials.setKind(e),this.params.setKind(e),this.syncParamsVisibility()}handlePick(e){return!!(this.materials.handlePick(e)||this.params.visible&&this.params.handlePick(e)||this.fireParams?.visible&&this.fireParams.handlePick(e)||this.avbdScenes?.visible&&this.avbdScenes.handlePick(e)||this.env.visible&&this.env.handlePick(e))}refreshParams(){this.params.refresh(),this.fireParams?.refresh()}syncParamsVisibility(){let e=this.group.visible,t=this.exhibit===`fire`,n=this.exhibit===`avbd`,r=!t&&!n;this.env.setVisible(e),this.params.setVisible(e&&r),this.fireParams?.setVisible(e&&t),this.avbdScenes?.setVisible(e&&n)}dispose(){this.materials.dispose(),this.params.dispose(),this.env.dispose(),this.fireParams?.dispose(),this.avbdScenes?.dispose()}},Af=4,jf=1716288,Mf=5951712,Nf=new Y,Pf=new Y,Ff=new Y,If=new Le;function Lf(e){return e===`sphere`?new nt(.5,24,16):new Oe(1,1,1)}function Rf(){return new $e({color:jf,transparent:!0,opacity:.45,depthWrite:!1})}var zf=class{camera;domElement;group=new Ue;gizmo;items=[];raycaster=new ze;pointer=new qe;forcePool=[];selected=null;gizmoEnabled=!0;domain=1;onModeChanged=()=>{};constructor(e,t,n){this.camera=e,this.domElement=t,this.gizmo=new L(e,t),this.gizmo.addEventListener(`dragging-changed`,e=>n(e.value)),this.gizmo.setMode(`translate`),this.gizmo.setSize(.85),t.addEventListener(`pointerdown`,this.onPointerDown);for(let e=0;e<Af;e++)this.forcePool.push({x:.5,y:.5,z:.5,strength:0,radius:.08,isBox:!1,isCapsule:!1,hx:.05,hy:.05,hz:.05,ax:1,ay:0,az:0,bx:0,by:1,bz:0,cx:0,cy:0,cz:1})}get count(){return this.items.length}get selection(){return this.selected}get mode(){return this.gizmo.mode}get helper(){return this.gizmo.getHelper()}setDomain(e){this.domain=e}setGizmoEnabled(e){this.gizmoEnabled=e,this.syncGizmo()}setVisible(e){this.group.visible=e,this.syncGizmo()}add(e,t){if(this.items.length>=Af)return!1;let n=new Qe(Lf(e),Rf());return n.position.copy(t??new Y(0,.2,0)),e===`sphere`?n.scale.setScalar(.14):n.scale.set(.12,.12,.12),n.material.color.setHex(Mf),this.group.add(n),this.items.push({kind:e,mesh:n}),this.select(this.items.length-1),!0}remove(e){let t=this.items[e];t&&(this.selected===e&&this.select(null),this.items.splice(e,1),this.group.remove(t.mesh),t.mesh.geometry.dispose(),t.mesh.material.dispose(),this.select(this.items.length>0?Math.min(e,this.items.length-1):null))}clear(){for(;this.items.length>0;)this.remove(this.items.length-1)}select(e){this.selected=e;for(let[t,n]of this.items.entries())n.mesh.material.color.setHex(t===e?Mf:jf),n.mesh.material.opacity=t===e?.65:.4;this.syncGizmo()}syncGizmo(){let e=this.gizmoEnabled&&this.group.visible&&this.selected!==null?this.items[this.selected]?.mesh:void 0;e?(this.gizmo.attach(e),this.gizmo.getHelper().visible=!0):(this.gizmo.detach(),this.gizmo.getHelper().visible=!1)}setMode(e){this.mode!==e&&(this.gizmo.setMode(e),this.onModeChanged(e))}toForces(e){let t=[],n=Math.min(this.items.length,50,this.forcePool.length);for(let r=0;r<n;r++){let n=this.items[r],i=this.forcePool[r],a=n.mesh.position;i.x=Math.min(.98,Math.max(.02,a.x/this.domain+.5)),i.y=Math.min(.98,Math.max(.02,a.y/this.domain)),i.z=Math.min(.98,Math.max(.02,a.z/this.domain+.5)),i.strength=e,n.kind===`sphere`?(i.isBox=!1,i.isCapsule=!1,i.radius=Math.max(.02,Math.abs(n.mesh.scale.x)*.5/this.domain)):(i.isBox=!0,i.isCapsule=!1,If.copy(n.mesh.quaternion),Nf.set(1,0,0).applyQuaternion(If),Pf.set(0,1,0).applyQuaternion(If),Ff.set(0,0,1).applyQuaternion(If),i.ax=Nf.x,i.ay=Nf.y,i.az=Nf.z,i.bx=Pf.x,i.by=Pf.y,i.bz=Pf.z,i.cx=Ff.x,i.cy=Ff.y,i.cz=Ff.z,i.hx=Math.max(.015,Math.abs(n.mesh.scale.x)*.5/this.domain),i.hy=Math.max(.015,Math.abs(n.mesh.scale.y)*.5/this.domain),i.hz=Math.max(.015,Math.abs(n.mesh.scale.z)*.5/this.domain),i.radius=i.hy),t.push(i)}return t}onPointerDown=e=>{if(!this.group.visible||this.gizmo.dragging||e.button!==0)return;let t=this.domElement.getBoundingClientRect();this.pointer.set((e.clientX-t.left)/t.width*2-1,-((e.clientY-t.top)/t.height)*2+1),this.raycaster.setFromCamera(this.pointer,this.camera);let n=this.raycaster.intersectObjects(this.items.map(e=>e.mesh),!1)[0];n&&this.select(this.items.findIndex(e=>e.mesh===n.object))};dispose(){this.domElement.removeEventListener(`pointerdown`,this.onPointerDown),this.gizmo.detach(),this.gizmo.dispose(),this.clear()}};function Bf(e,t){return e.domElement.title=t,e}function Vf(e,t,n){let r=new ct({title:`Materials`,width:300});r.$title.title=`MLS-MPM sandbox knobs. Hover a row for a short note.`;let i={material:t},a={reset:()=>n.onReset()},o=Bf(r.add(i,`material`,[`sand`,`goo`,`water`]).name(`material`).onChange(e=>{n.onMaterial(e),d()}),`Active MPM exhibit. Fire is switched from the toolbar / XR strip.`);Bf(r.add(a,`reset`).name(`reset`),`Re-seed particles for the active material.`),Bf(r.add(e,`gravity`,10,250,1).name(`gravity`).onChange(()=>n.onChange()),`Baseline downward acceleration (sim units). Per-material scale multiplies this.`),Bf(r.add(e,`handForce`,5,120,1).name(`collider / hand force`).onChange(()=>n.onChange()),`Baseline impulse for desktop force colliders and XR hand bones. Per-material scale multiplies this.`);let s=r.addFolder(`Force colliders (desktop)`),c={sphere:()=>n.onAddCollider(`sphere`),box:()=>n.onAddCollider(`box`),remove:()=>n.onRemoveCollider()};Bf(s.add(c,`sphere`).name(`add sphere`),`Drop a sphere force field you can drag with the gizmo.`),Bf(s.add(c,`box`).name(`add box`),`Drop an oriented box force field.`),Bf(s.add(c,`remove`).name(`remove selected`),`Remove the gizmo-selected collider.`),Bf(s.add({mode:`translate`},`mode`,[`translate`,`rotate`,`scale`]).name(`gizmo (W / E / R)`).onChange(e=>n.onGizmoMode(e)),`Same TransformControls modes as the fire demo. W translate, E rotate, R scale, Esc clears selection.`),s.open();let l=r.addFolder(`Time stepping`);Bf(l.add(e,`substeps`,4,24,1).name(`substeps / frame`).onChange(()=>n.onChange()),`More substeps = stabler / heavier. XR may override with a lighter count while presenting.`),Bf(l.add(e,`subDt`,1e-4,5e-4,1e-5).name(`Δt per substep`).onChange(()=>n.onChange()),`Fixed substep size. Raising this with low substeps can detonate elastic materials.`);let u=null,d=()=>{u&&=(u.destroy(),null);let t=i.material,a=e[t];u=r.addFolder(`${t} body`),Bf(u.add(a,`gravityScale`,.2,4,.05).name(`gravity ×`).onChange(()=>n.onChange()),`Multiplies baseline gravity for this material.`),Bf(u.add(a,`handForceScale`,.2,8,.05).name(`hand force ×`).onChange(()=>n.onChange()),`Multiplies baseline poke for this material.`),Bf(u.add(a,`mu`,0,400,1).name(`μ shear`).onChange(()=>n.onChange()),`Neo-Hookean shear stiffness. Water should stay 0 (pressure-only).`),Bf(u.add(a,`lambda`,20,1200,5).name(`λ volume`).onChange(()=>n.onChange()),`Volume stiffness. Water uses this as weakly-compressible bulk modulus.`),u.open()};return d(),Object.assign(r,{setMaterial(e){i.material=e,o.updateDisplay(),d()},refresh(){o.updateDisplay();for(let e of r.controllers)e.updateDisplay();for(let e of r.folders)for(let t of e.controllers)t.updateDisplay()}})}var Hf={stirEnergy:0,contactCount:0,meanSpeed:0,maxSpeed:0,pour:0},Uf=3;function Wf(e){return Math.min(1,Math.max(0,e))}function Gf(e,t,n){return e+(t-e)*n}function Kf(e,t){return Wf(e/Math.max(t,1e-6))}function qf(e,t,n,r){let i=1-Math.exp(-r*Math.max(n,0));return e+(t-e)*i}function Jf(e,t,n=!1){let r=Math.max(1,Math.floor(e.sampleRate*t)),i=e.createBuffer(1,r,e.sampleRate),a=i.getChannelData(0),o=0;for(let e=0;e<r;e++){let t=Math.random()*2-1;n?(o=(o+t*.02)*.998,a[e]=o*3.5):a[e]=t}return i}function Yf(e,t,n=1){let r=e.createBufferSource();return r.buffer=t,r.loop=!0,r.playbackRate.value=n,r.start(),r}var Xf=class{ctx=null;master=null;bedLowGain=null;bedMidGain=null;bedHighGain=null;bubbleBus=null;splashBus=null;white=null;sources=[];enabled=!1;targets={...Hf};smooth={...Hf};pourUntil=0;splashCooldown=0;bubbleCooldown=0;get active(){return this.enabled&&this.ctx?.state===`running`}setEnabled(e){this.enabled=e,this.enabled?this.master&&this.ctx?.state===`running`&&this.master.gain.setTargetAtTime(.42,this.ctx.currentTime,.1):(this.targets={...Hf},this.pourUntil=0,this.master&&this.ctx&&(this.master.gain.cancelScheduledValues(this.ctx.currentTime),this.master.gain.setTargetAtTime(0,this.ctx.currentTime,.06)))}async resume(){this.ctx||this.build(),this.ctx&&(this.ctx.state===`suspended`&&await this.ctx.resume(),this.enabled&&this.master&&this.master.gain.setTargetAtTime(.42,this.ctx.currentTime,.1))}setDrivers(e){this.targets={...this.targets,...e}}triggerPour(e=1.25){this.enabled&&(this.pourUntil=Math.max(this.pourUntil,performance.now()/1e3+e),this.targets.pour=1)}update(e){if(!this.ctx||!this.master||!this.enabled)return;let t=performance.now()/1e3;if(this.pourUntil>t){let e=this.pourUntil-t;this.targets.pour=Wf(e/.35)}else this.targets.pour=0;let n=this.smooth,r=this.targets;n.stirEnergy=qf(n.stirEnergy,r.stirEnergy,e,12),n.contactCount=qf(n.contactCount,r.contactCount,e,10),n.meanSpeed=qf(n.meanSpeed,r.meanSpeed,e,6),n.maxSpeed=qf(n.maxSpeed,r.maxSpeed,e,8),n.pour=qf(n.pour,r.pour,e,4);let i=Kf(n.stirEnergy,180),a=Kf(n.contactCount,18),o=Kf(n.meanSpeed,2.2),s=Kf(n.maxSpeed,8),c=Wf(n.pour),l=Wf(o*.85+s*.25),u=Wf(i*.95+a*.2+l*.45+c*.55),d=this.ctx.currentTime;this.bedLowGain&&this.bedLowGain.gain.setTargetAtTime(.04*u+.02*c,d,.06),this.bedMidGain&&this.bedMidGain.gain.setTargetAtTime(.07*Wf(i*.7+l*.5+c*.6),d,.05),this.bedHighGain&&this.bedHighGain.gain.setTargetAtTime(.05*Wf(i*.9+s*.35),d,.04),this.bubbleBus&&this.bubbleBus.gain.setTargetAtTime(.55*Wf(.15+u),d,.05),this.splashBus&&this.splashBus.gain.setTargetAtTime(.4*Wf(.1+i),d,.04);let f=i*18+l*7+c*16+a*2.5;if(this.bubbleCooldown=Math.max(0,this.bubbleCooldown-e),this.bubbleCooldown<=0&&f>.4&&Math.random()<f*e){let e=Gf(9e-4,.0045,Math.random()**2.1),t=.045+i*.12+c*.05+Math.random()*.05,n=.04+Math.random()*.09;this.spawnBubble(e,t,n),this.bubbleCooldown=.018+Math.random()*.04}this.splashCooldown=Math.max(0,this.splashCooldown-e);let p=i*14+a*1.5;this.splashCooldown<=0&&p>.5&&Math.random()<p*e&&(this.burstSplash(.04+i*.12),this.splashCooldown=.03+Math.random()*.06)}dispose(){for(let e of this.sources)try{e.stop()}catch{}this.sources=[],this.ctx?.close(),this.ctx=null,this.master=null}spawnBubble(e,t,n){if(!this.ctx||!this.white||!this.bubbleBus)return;let r=this.ctx,i=r.currentTime,a=Math.min(2800,Math.max(520,Uf/Math.max(e,5e-4))),o=a*(1+n),s=.028+e*12+Math.random()*.035,c=Math.min(.2,t),l=r.createBufferSource();l.buffer=this.white,l.playbackRate.value=.85+Math.random()*.55;let u=r.createBiquadFilter();u.type=`highpass`,u.frequency.value=1200+Math.random()*2800,u.Q.value=.5;let d=r.createBiquadFilter();d.type=`bandpass`,d.frequency.value=1800+Math.random()*3200,d.Q.value=.55+Math.random()*.45;let f=r.createGain(),p=c*(.55+Math.random()*.35),m=.012+Math.random()*.02;f.gain.setValueAtTime(p,i),f.gain.exponentialRampToValueAtTime(8e-4,i+m),l.connect(u).connect(d).connect(f).connect(this.bubbleBus),l.start(i),l.stop(i+m+.01);let h=r.createBufferSource();h.buffer=this.white;let g=r.createGain(),_=.0015+Math.random()*.0025;g.gain.setValueAtTime(1,i),g.gain.exponentialRampToValueAtTime(8e-4,i+_);let v=r.createBiquadFilter();v.type=`bandpass`,v.Q.value=6+Math.random()*6,v.frequency.setValueAtTime(a,i),v.frequency.exponentialRampToValueAtTime(Math.max(a*1.01,o),i+s);let y=r.createBiquadFilter();y.type=`lowpass`,y.frequency.value=Math.min(5500,a*2.2+800),y.Q.value=.7;let b=r.createGain(),x=c*(.18+Math.random()*.16);if(b.gain.setValueAtTime(1e-4,i),b.gain.exponentialRampToValueAtTime(x,i+.002),b.gain.exponentialRampToValueAtTime(1e-4,i+s),h.connect(g).connect(v).connect(y).connect(b).connect(this.bubbleBus),h.start(i),h.stop(i+_+.008),Math.random()<.35){let e=i+.012+Math.random()*.03,t=a*(1.15+Math.random()*.45),o=s*(.45+Math.random()*.35),c=r.createBufferSource();c.buffer=this.white;let l=r.createGain();l.gain.setValueAtTime(1,e),l.gain.exponentialRampToValueAtTime(8e-4,e+.002);let u=r.createBiquadFilter();u.type=`bandpass`,u.Q.value=5+Math.random()*5,u.frequency.setValueAtTime(t,e),u.frequency.exponentialRampToValueAtTime(t*(1+n*.7),e+o);let d=r.createGain(),f=x*(.35+Math.random()*.3);d.gain.setValueAtTime(1e-4,e),d.gain.exponentialRampToValueAtTime(f,e+.002),d.gain.exponentialRampToValueAtTime(1e-4,e+o),c.connect(l).connect(u).connect(d).connect(this.bubbleBus),c.start(e),c.stop(e+.01)}}burstSplash(e){if(!this.ctx||!this.white||!this.splashBus)return;let t=this.ctx,n=t.createBufferSource();n.buffer=this.white,n.playbackRate.value=.9+Math.random()*.35;let r=t.createBiquadFilter();r.type=`bandpass`,r.frequency.value=700+Math.random()*2200,r.Q.value=.45+Math.random()*.5;let i=t.createBiquadFilter();i.type=`highpass`,i.frequency.value=400+Math.random()*600;let a=t.createGain(),o=t.currentTime,s=Math.min(.24,e),c=.035+Math.random()*.055;a.gain.setValueAtTime(s,o),a.gain.exponentialRampToValueAtTime(8e-4,o+c),n.connect(i).connect(r).connect(a).connect(this.splashBus),n.start(o),n.stop(o+c+.02)}build(){let e=window.AudioContext||window.webkitAudioContext;if(!e)return;let t=new e;this.ctx=t;let n=Jf(t,2.5,!0);this.white=Jf(t,1.5,!1),this.master=t.createGain(),this.master.gain.value=0;let r=t.createBiquadFilter();r.type=`highpass`,r.frequency.value=80;let i=t.createBiquadFilter();i.type=`lowpass`,i.frequency.value=7200;let a=t.createGain();a.gain.value=.22;let o=t.createGain();o.gain.value=.85;let s=[.017,.023,.031,.043].map(e=>{let n=t.createDelay(.1);n.delayTime.value=e;let r=t.createGain();r.gain.value=.28;let i=t.createBiquadFilter();return i.type=`lowpass`,i.frequency.value=4500,a.connect(n).connect(i).connect(r),r.connect(n),r}),c=t.createGain();o.connect(c);for(let e of s)e.connect(c);c.connect(this.master),this.master.connect(t.destination);let l=t.createGain();l.connect(r).connect(i),i.connect(o),i.connect(a);let u=t.createBiquadFilter();u.type=`lowpass`,u.frequency.value=280,this.bedLowGain=t.createGain(),this.bedLowGain.gain.value=0;let d=Yf(t,n,1),f=Yf(t,n,.93);d.connect(u),f.connect(u),u.connect(this.bedLowGain).connect(l),this.sources.push(d,f);let p=t.createBiquadFilter();p.type=`bandpass`,p.frequency.value=900,p.Q.value=.6,this.bedMidGain=t.createGain(),this.bedMidGain.gain.value=0;let m=Yf(t,this.white,1.02);m.connect(p).connect(this.bedMidGain).connect(l),this.sources.push(m);let h=t.createBiquadFilter();h.type=`highpass`,h.frequency.value=2400,this.bedHighGain=t.createGain(),this.bedHighGain.gain.value=0;let g=Yf(t,this.white,1.07);g.connect(h).connect(this.bedHighGain).connect(l),this.sources.push(g),this.bubbleBus=t.createGain(),this.bubbleBus.gain.value=.55,this.bubbleBus.connect(l),this.splashBus=t.createGain(),this.splashBus.gain.value=.3,this.splashBus.connect(l)}},Zf=2048,Qf=6,$f=null;function ep(e){if($f)return $f;if(!e.features.has(`timestamp-query`))return null;let t=[],n=new WeakSet,r=null,i=0,a=0,o=0,s=()=>{let n=t.find(e=>!e.busy);if(n)return n.busy=!0,n.kinds.length=0,n;if(t.length>=Qf)return null;let r={busy:!0,kinds:[],qs:e.createQuerySet({type:`timestamp`,count:Zf*2}),resolve:e.createBuffer({size:Zf*16,usage:GPUBufferUsage.QUERY_RESOLVE|GPUBufferUsage.COPY_SRC}),read:e.createBuffer({size:Zf*16,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST})};return t.push(r),r},c=GPUDevice.prototype.createCommandEncoder,l=()=>{let t=r;if(r=null,!t)return;let n=t.kinds.length;if(!n){t.busy=!1;return}let s=c.call(e);s.resolveQuerySet(t.qs,0,n*2,t.resolve,0),s.copyBufferToBuffer(t.resolve,0,t.read,0,n*16),e.queue.submit([s.finish()]),t.read.mapAsync(GPUMapMode.READ,0,n*16).then(()=>{let e=new BigInt64Array(t.read.getMappedRange(0,n*16));for(let r=0;r<n;r++){let n=Number(e[r*2+1]-e[r*2]);n<=0||n>1e9||(t.kinds[r]===`compute`?i+=n:a+=n)}o++,t.read.unmap(),t.busy=!1},()=>{t.busy=!1})},u={enabled:!1,frame(){l()},read(){if(!o)return null;let e={compute:i/1e6/o,render:a/1e6/o};return i=a=0,o=0,e}};GPUDevice.prototype.createCommandEncoder=function(t){let r=c.call(this,t);return u.enabled&&this===e&&n.add(r),r};let d=(e,t)=>{let i=GPUCommandEncoder.prototype,a=i[e];i[e]=function(e){if(n.has(this)&&!e?.timestampWrites&&(r??=s(),r&&r.kinds.length<Zf)){let n=r.kinds.length;return r.kinds.push(t),a.call(this,{...e,timestampWrites:{querySet:r.qs,beginningOfPassWriteIndex:n*2,endOfPassWriteIndex:n*2+1}})}return a.call(this,e)}};return d(`beginComputePass`,`compute`),d(`beginRenderPass`,`render`),$f=u,u}var tp=1,np=.04,rp={distance:.48,height:.88,framedSize:.42,turntable:!1},ip={void:1,studio:.9,dusk:.8,daylight:.5,night:1.6},ap=new Y,op=new Y,sp=new Y,cp=new Y,lp=new Y,up=new Y,dp=new Y,fp=new Y,pp=new Y,mp=new Le,hp=new tt;function gp(e,t,n){t.addScaledVector(e,-t.dot(e)),t.lengthSq()<1e-8&&(t.set(0,1,0),Math.abs(e.y)>.9&&t.set(1,0,0),t.addScaledVector(e,-t.dot(e))),t.normalize(),n.crossVectors(e,t).normalize(),t.crossVectors(n,e).normalize()}function _p(){return{x:0,y:0,z:0,strength:0,radius:.05,isBox:!1,isCapsule:!1,hx:.05,hy:.05,hz:.05,ax:1,ay:0,az:0,bx:0,by:1,bz:0,cx:0,cy:0,cz:1}}async function vp(){if(!navigator.gpu){document.getElementById(`unsupported`)?.classList.add(`show`);return}let e=document.getElementById(`app`),n=document.getElementById(`stats`),r=document.getElementById(`xr-button`);if(!e)return;let i=await navigator.gpu.requestAdapter({powerPreference:`high-performance`,xrCompatible:!0});if(!i)throw Error(`WebGPU adapter missing`);let a=new URLSearchParams(window.location.search).get(`nosubgroups`)===`1`,o=[];!a&&i.features.has(`subgroups`)?o.push(`subgroups`):console.warn(`GPU AVBD: subgroups unavailable — LBVH onesweep disabled; large scenes will be much slower than webphysics.`),i.features.has(`timestamp-query`)&&o.push(`timestamp-query`);let s={};for(let e of[`maxStorageTexturesPerShaderStage`,`maxSampledTexturesPerShaderStage`,`maxStorageBuffersPerShaderStage`,`maxComputeInvocationsPerWorkgroup`,`maxBufferSize`,`maxStorageBufferBindingSize`]){let t=i.limits?.[e];typeof t==`number`&&(s[e]=t)}let c=Math.min(10,i.limits.maxStorageBuffersPerShaderStage);s.maxStorageBuffersPerShaderStage=c;let l=i.limits;for(let e of[`maxStorageBuffersInVertexStage`,`maxStorageBuffersInFragmentStage`]){let t=l[e];typeof t==`number`&&(s[e]=Math.min(t,c))}c<10&&console.warn(`GPU AVBD wants 10 storage buffers/stage; adapter only has ${i.limits.maxStorageBuffersPerShaderStage}. Physics scenes may fail.`);let u=await i.requestDevice({requiredFeatures:o,requiredLimits:s}),d=ep(u);u.addEventListener(`uncapturederror`,e=>{console.error(`WebGPU uncaptured error:`,e.error.message)});{let e=u.limits;console.warn(`GPU storage buffer limits — perStage:`,e.maxStorageBuffersPerShaderStage,`vertex:`,e.maxStorageBuffersInVertexStage,`fragment:`,e.maxStorageBuffersInFragmentStage)}let f=new Je({antialias:!0,forceWebGL:!1,device:u,requiredLimits:s});f.setSize(window.innerWidth,window.innerHeight),f.toneMapping=4,f.toneMappingExposure=1,e.appendChild(f.domElement),f.xr.enabled=!0,await f.init(),u.features.has(`subgroups`)||console.warn(`GPU device features:`,[...u.features.values()].join(`, `)||`(none)`);let p=new He,m=new Ce(p);m.set(`night`),m.setIntensity(1.6);let h=new je(45,window.innerWidth/window.innerHeight,.05,1e3);h.position.set(1.6,1.2,1.6);let g=new t(h,f.domElement);g.target.set(0,.35,0),g.enableDamping=!0;let _=0,v=`sand`,y=new Xf,b=()=>!S.active&&!(v===`avbd`&&!T&&E.usesFpsControls?.()),x=new zf(h,f.domElement,e=>{g.enabled=!e&&b()});x.setDomain(tp);let S=new de(f,{onEnter:()=>{g.enabled=!1,x.setGizmoEnabled(!1),_=20,v===`fire`&&(w.resumeAudio(),w.enterImmersive()),v===`avbd`&&!T&&E.enterImmersive(),v===`water`&&y.resume(),_e.setQuality(`immersive`)},onExit:()=>{g.enabled=b(),x.setGizmoEnabled(v!==`fire`&&v!==`avbd`),w.exitImmersive(),E.exitImmersive(),_e.setQuality(`desktop`),_=0,v===`avbd`&&J()}});p.add(S.rig),p.add(S.hud),S.setDomainSize(tp),S.setPlacement({...rp}),S.attach(x.group),p.add(x.helper),x.add(`box`,new Y(.42,.1,0));let w=new $t(f,S,m,p,h,e=>{g.enabled=!e&&b()}),T=new URLSearchParams(location.search).has(`avbdCpu`),E=new Ad(S),D=new gn(S);T?D.init():E.init(f,u);let O=T?D:E,k=new jd(h,f.domElement,{eyeHeight:.75,groundY:0,moveSpeed:7,freeFly:!0,mouseSensitivity:.0024,tryPrimaryGrab:e=>T||!E.usesFpsControls()?!1:E.beginBodyDrag(e.clientX,e.clientY,f.domElement,h),onPrimaryGrabMove:e=>{E.isBodyDragging()&&E.updateBodyDrag(e.clientX,e.clientY,f.domElement,h)},onPrimaryGrabEnd:()=>{E.endBodyDrag()}});k.setEnabled(!1);let A=new Y,j=new Y,M=!1,N=0,P=new re(f,p),F=Lt(),I=new kf(F,`sand`);S.setActionPanel(I),S.setModePanelEnabled(!1),I.bindFire(()=>w.koraParams,e=>w.setGizmoMode(e)),w.onWorldUiChange=()=>I.refreshParams();let L=new Qe(new Oe(tp,tp*.02,tp),new $e({color:2763314}));L.position.set(0,.01,0),S.attach(L);let R=new Ve(tp,10,4473936,2763314);R.position.y=.02,S.attach(R);let z=new $e({color:8308963,transparent:!0,opacity:.14,side:2,depthWrite:!1}),B=.42,V=.02,H=tp*.48,ee=[new Qe(new Oe(tp*.96,B,V),z),new Qe(new Oe(tp*.96,B,V),z),new Qe(new Oe(V,B,tp*.96),z),new Qe(new Oe(V,B,tp*.96),z)];ee[0].position.set(0,B*.5,-.48),ee[1].position.set(0,B*.5,H),ee[2].position.set(-.48,B*.5,0),ee[3].position.set(H,B*.5,0);for(let e of ee)e.visible=!1,S.attach(e);let te=new Qe(new Ie(.11,.11,.5,24),new $e({color:5919560}));te.position.set(.12,.25,-.12),te.visible=!1,S.attach(te);let ne=e=>{for(let t of ee)t.visible=e;te.visible=e},U=new Wt({gridN:48,particleCount:24576*2,substeps:14,subDt:24e-5});await U.init(u),U.bindParams(F),U.reset(`sand`);let ie=new Float32Array(150),ae=0,oe=np,se=!1;function ce(e,t){let n=0,r=1/Math.max(t,1e-4);for(let t=0;t<e.length;t++){let i=e[t],a=0;if(t<ae){let e=i.x-ie[t*3],n=i.y-ie[t*3+1],o=i.z-ie[t*3+2];a=Math.hypot(e,n,o)*r}n+=Math.abs(i.strength)*a,ie[t*3]=i.x,ie[t*3+1]=i.y,ie[t*3+2]=i.z}return ae=e.length,{stirEnergy:n,contactCount:e.length}}function le(e){y.setEnabled(e),e&&y.resume()}let ue=()=>{v===`water`&&y.resume()};f.domElement.addEventListener(`pointerdown`,ue),document.getElementById(`toolbar`)?.addEventListener(`click`,ue);function W(e,t){if(v===`water`&&t){let n=ce(t,e);y.setDrivers({stirEnergy:n.stirEnergy,contactCount:n.contactCount}),oe+=e,!se&&oe>=np&&(oe=0,se=!0,U.readMotionStats(16).then(e=>{se=!1,e&&v===`water`&&y.setDrivers({meanSpeed:e.meanSpeed,maxSpeed:e.maxSpeed})}).catch(()=>{se=!1}))}y.update(e)}let fe=U.capacity,G=new et(fe,4),pe=new et(fe,4),{mesh:me,setKind:he}=Kt(fe,tp,G,pe);me.count=U.particleCount,S.attach(me),me.visible=!0;let ge=!0,_e=new Xt(tp);await _e.init(u,U.renderBuffer,fe),S.attach(_e.mesh);let ve=new URLSearchParams(location.search).get(`gel`)!==`0`,ye=!0,be=0,xe=document.getElementById(`mat-view`);xe&&(xe.hidden=!0);function Se(e){return f.backend.get(e)?.buffer}let K=`sand`;function we(){return v===`avbd`?`goo`:K}function Te(e){let t=we(),n=F.handForce*F[t].handForceScale;return e.palm?n*.85:e.to.endsWith(`-tip`)?n:n*.95}function Ee(e){let t=we(),n=t===`sand`?.01:t===`water`?.012:.011;return e.palm?n*1.7:e.to.endsWith(`-tip`)?n:n*.85}let De=Array.from({length:50},()=>_p()),ke=[];function Ae(){let e=we(),t=F.handForce*F[e].handForceScale;return x.toForces(t)}function Me(e){if(ke.length=0,!S.active)return Ae();let t=f.xr.getSession(),n=f.xr.getReferenceSpace();if(!t||!n||!e)return Ae();let r=me.parent;if(!r)return ke;r.updateMatrixWorld(!0),r.getWorldScale(pp);let i=1/(tp*Math.max(pp.x,1e-4));hp.copy(r.matrixWorld).invert();for(let a of t.inputSources)if(!(a.handedness!==`right`&&a.handedness!==`left`||!a.hand))for(let t of ht){if(ke.length>=50)return ke;let o=a.hand.get(t.from),s=a.hand.get(t.to);if(!o||!s)continue;let c=e.getJointPose?.(o,n)??e.getPose(o,n),l=e.getJointPose?.(s,n)??e.getPose(s,n);if(!c||!l)continue;let u=c.transform.position,d=l.transform.position;ap.set(u.x,u.y,u.z),op.set(d.x,d.y,d.z),sp.copy(ap),cp.copy(op),r.worldToLocal(sp),r.worldToLocal(cp),lp.addVectors(sp,cp).multiplyScalar(.5);let f=lp.x/tp+.5,p=lp.y/tp,m=lp.z/tp+.5;if(f<-.12||f>1.12||p<-.12||p>1.12||m<-.12||m>1.12)continue;up.subVectors(cp,sp);let h=up.length();if(h<1e-5)continue;up.multiplyScalar(1/h);let g=c.transform.orientation;mp.set(g.x,g.y,g.z,g.w),dp.set(0,1,0).applyQuaternion(mp).transformDirection(hp),gp(up,dp,fp);let _=`radius`in c&&typeof c.radius==`number`?c.radius:void 0,v=`radius`in l&&typeof l.radius==`number`?l.radius:void 0,y=_!==void 0&&v!==void 0?(_+v)*.5*i:Ee(t),b=t.to.endsWith(`-tip`),x=t.palm?1.15:b?.7:.55,S=t.palm?.75:.4,C=Math.max(h/tp*.5,.005),w=Math.max(y*x,.0035),T=Math.max(y*S,.0028),E=De[ke.length];E.x=Math.min(.98,Math.max(.02,f)),E.y=Math.min(.98,Math.max(.02,p)),E.z=Math.min(.98,Math.max(.02,m)),E.strength=Te(t),E.isCapsule=b,E.isBox=!b,E.radius=w,E.hx=C,E.hy=w,E.hz=b?w:T,E.ax=up.x,E.ay=up.y,E.az=up.z,E.bx=dp.x,E.by=dp.y,E.bz=dp.z,E.cx=fp.x,E.cy=fp.y,E.cz=fp.z,ke.push(E)}for(let e of Ae()){if(ke.length>=50)break;ke.push(e)}return ke}let Ne=e=>{for(let e of document.querySelectorAll(`.mat-btn`))e.classList.remove(`active`);document.getElementById(e)?.classList.add(`active`)},Pe=()=>{let e=ye&&ve&&K===`goo`;_e.setEnabled(e),me.visible=ye&&!e},Fe=e=>{ve=e,Pe(),I.setGelSurface(e),qe&&(qe.checked=e)},Le=e=>{ye=e,L.visible=e,R.visible=e,Pe(),x.setVisible(e),x.setGizmoEnabled(e&&!S.active),ne(e?K===`water`:!1)},Re=e=>{e===`fire`?(h.position.set(2.8,1.6,3.2),g.target.set(0,.7,0)):e===`avbd`&&O.applyCamera?O.applyCamera(h,g):(h.position.set(1.6,1.2,1.6),g.target.set(0,.35,0))},ze=document.getElementById(`toolbar-sub`),Be=document.getElementById(`sub-label`),Ue=document.getElementById(`mls-scene`),We=document.getElementById(`avbd-scene`),Ge=document.getElementById(`env-select`),Ke=document.getElementById(`gel-toggle`),qe=document.getElementById(`gel-solid`);if(qe?.addEventListener(`change`,()=>Fe(qe.checked)),We&&!T){for(let{group:e,ids:t}of Xu()){let n=document.createElement(`optgroup`);n.label=e;for(let e of t){let t=document.createElement(`option`);t.value=e,t.textContent=qu(e),n.appendChild(t)}We.appendChild(n)}We.value=Wu}let q=e=>e===`fire`?`mat-kora`:e===`avbd`?`mat-avbd`:`mat-mls`,J=()=>{let e=!T&&v===`avbd`&&!!O.usesFpsControls?.();e||E.endBodyDrag(),k.setEnabled(e),g.enabled=b(),e?(g.enableDamping=!1,k.syncFromCamera()):g.enableDamping=!0},Ye=()=>{if(!ze)return;let e=v===`sand`||v===`goo`||v===`water`,t=v===`avbd`&&!T,n=v===`fire`;ze.hidden=!(e||t||n),Be&&(Be.hidden=n,Be.textContent=t?`Scene`:`Material`),Ue&&(Ue.hidden=!e,e&&(Ue.value=v)),Ke&&(Ke.hidden=v!==`goo`),We&&(We.hidden=!t,t&&(We.value=O.currentScene))},Xe=document.getElementById(`hud-credit`),Ze={fire:{href:`https://doi.org/10.1145/3819990.3820026`,label:`Kora: A Physics-Based Fire Pipeline and Toolset`},mls:{href:`https://doi.org/10.1145/3197517.3201293`,label:`MLS-MPM (Hu et al.)`},avbd:{href:`https://graphics.cs.utah.edu/research/projects/avbd/`,label:`Augmented Vertex Block Descent`}},tt=()=>{if(!Xe)return;let e=Ze[v===`fire`?`fire`:v===`avbd`?`avbd`:`mls`];Xe.innerHTML=`<a href="${e.href}" target="_blank" rel="noopener noreferrer">${e.label}</a>`},nt=`kora.sandbox.perf`,rt=!1;try{rt=localStorage.getItem(nt)===`1`}catch{}let it=document.getElementById(`mat-perf`),at=()=>{it?.classList.toggle(`active`,rt),d&&(d.enabled=rt),n&&(n.hidden=!rt,rt||(n.textContent=``)),ge=!0};at();let ot=null,st=()=>{ot&&(ot.domElement.style.display=v===`fire`||v===`avbd`?`none`:``)},ct=e=>{K=e,U.reset(e),me.count=U.particleCount,he(e),ne(e===`water`),I.setMaterialKind(e),ot?.setMaterial(e),Ne(q(e)),ye=!0,Pe(),le(e===`water`),e===`water`&&y.triggerPour(),ge=!0},lt=`kora.sandbox.exhibit`,ut=`kora.sandbox.avbdScene`,X=e=>e===`fire`||e===`sand`||e===`goo`||e===`water`||e===`avbd`,dt=e=>{try{localStorage.setItem(lt,e),e===`avbd`&&localStorage.setItem(ut,O.currentScene)}catch{}},ft=(e,t=v)=>{m.set(e),m.setIntensity(t===`fire`?C[e]:ip[e]),Ge&&(Ge.value=e),I.setEnvironment(e),w.koraParams.environment=e,w.koraParams.backgroundIntensity=C[e],w.refreshDesktopGui()},pt=null;Ge?.addEventListener(`change`,()=>{pt=Ge.value,ft(pt)}),I.setOnEnvironment(e=>{pt=e,ft(e)});let mt=e=>{f.toneMapping=4,f.toneMappingExposure=1,ft(pt??(e===`avbd`?`studio`:`night`),e)},gt=async e=>{if(e===`fire`){w.isReady||await w.init(),v===`avbd`&&E.exitImmersive(),O.setActive(!1),le(!1),w.setActive(!0),Le(!1),v=`fire`,I.setExhibit(`fire`),Ne(`mat-kora`),Re(`fire`),S.active&&w.enterImmersive(),mt(`fire`),st(),Ye(),tt(),J(),dt(`fire`),ge=!0;return}if(e===`avbd`){v===`fire`&&S.active&&w.exitImmersive(),w.setActive(!1),le(!1),L.visible=!1,R.visible=!1,me.visible=!1,ne(!1);let e=O.currentScene===`gel-cut`||T;x.setVisible(e),x.setGizmoEnabled(e&&!S.active),O.setActive(!0),S.active&&!T&&E.enterImmersive(),v=`avbd`,I.setExhibit(`avbd`),I.setAvbdScene(O.currentScene),Ne(`mat-avbd`),Re(`avbd`),mt(`avbd`),st(),Ye(),tt(),J(),dt(`avbd`),ge=!0;return}v===`fire`&&S.active&&w.exitImmersive(),v===`avbd`&&E.exitImmersive(),w.setActive(!1),O.setActive(!1),S.setDomainSize(tp),S.setPlacement({...rp}),v=e,ct(e),Le(!0),Re(e),mt(e),st(),Ye(),tt(),J(),dt(e),ge=!0},_t=e=>{if(!Uu(e))return;O.setScene(e);let t=e===`gel-cut`;x.setVisible(t),x.setGizmoEnabled(t&&!S.active),Re(`avbd`),We&&(We.value=e),I.setAvbdScene(e),J(),dt(`avbd`),ge=!0},vt=()=>{if(!O.shoot||!O.usesFpsControls?.())return;let e=O.currentScene,t=e===`cloth-boxes-demo`,n=Ni(e),r=e===`dominoes-demo`||e===`dominoes-advanced-demo`;k.getShootOrigin(A,1.1),k.getLookDirection(j),O.shoot({position:[A.x,A.y,A.z],direction:[j.x,j.y,j.z],averageSpeed:t?10:n?40:r?12:18,speedJitter:t?2:n?6:r?1.5:4,angularJitter:t?4:n?5:r?2:8})},yt=e=>{if(e===`reset`){v===`fire`?w.reset():v===`avbd`?O.usesFpsControls?.()&&O.resetSimulation?O.resetSimulation():O.reset():(U.reset(K),me.count=U.particleCount,K===`water`&&y.triggerPour());return}if(e===`toggle-view`){Fe(!ve);return}if(e===`kora`){gt(`fire`);return}if(e===`mls`){gt(K===`sand`||K===`goo`||K===`water`?K:`sand`);return}gt(e)};I.setOnAction(yt),T||I.bindAvbdScenes(e=>_t(e)),I.setOnParamsChange(()=>{I.refreshParams(),ot?.refresh(),v===`fire`&&w.refreshDesktopGui()}),ot=Vf(F,K,{onReset:()=>{U.reset(K),me.count=U.particleCount,K===`water`&&y.triggerPour()},onMaterial:e=>void gt(e),onChange:()=>I.refreshParams(),onAddCollider:e=>{x.add(e,new Y(.1,.22,0))},onRemoveCollider:()=>{x.selection!==null&&x.remove(x.selection)},onGizmoMode:e=>x.setMode(e)}),Fe(ve),window.addEventListener(`keydown`,e=>{if(e.target instanceof HTMLInputElement||e.target instanceof HTMLTextAreaElement||e.target instanceof HTMLSelectElement)return;if(v===`avbd`&&e.code===`KeyR`&&!e.repeat){e.preventDefault(),O.resetSimulation?O.resetSimulation():O.reset();return}if(v===`fire`||S.active||O.usesFpsControls?.())return;let t={w:`translate`,e:`rotate`,r:`scale`}[e.key.toLowerCase()];t&&x.setMode(t),e.key===`Escape`&&x.select(null)}),window.addEventListener(`mousedown`,e=>{v!==`avbd`||!O.usesFpsControls?.()||e.target===f.domElement&&e.button===2&&(e.preventDefault(),M=!0,N=0,Ni(O.currentScene)&&vt())}),window.addEventListener(`mouseup`,e=>{e.button===2&&(M=!1)}),document.getElementById(`mat-kora`)?.addEventListener(`click`,()=>void gt(`fire`)),document.getElementById(`mat-mls`)?.addEventListener(`click`,()=>{gt(K===`sand`||K===`goo`||K===`water`?K:`sand`)}),document.getElementById(`mat-avbd`)?.addEventListener(`click`,()=>void gt(`avbd`)),document.getElementById(`mat-reset`)?.addEventListener(`click`,()=>yt(`reset`)),it?.addEventListener(`click`,()=>{rt=!rt;try{localStorage.setItem(nt,rt?`1`:`0`)}catch{}at()}),Ue?.addEventListener(`change`,()=>{let e=Ue.value;Ue.blur(),f.domElement.focus({preventScroll:!0}),(e===`sand`||e===`goo`||e===`water`)&&gt(e)}),We?.addEventListener(`change`,()=>{We.blur(),_t(We.value),f.domElement.focus({preventScroll:!0})});let bt=new URLSearchParams(location.search).get(`exhibit`),xt=new URLSearchParams(location.search).get(`scene`),St=null,Ct=null;try{St=localStorage.getItem(lt),Ct=localStorage.getItem(ut)}catch{}let wt=X(bt)?bt:X(St)?St:`sand`,Tt=Uu(xt)&&xt||Uu(Ct)&&Ct||Ct&&{soft:`gel-cut`,stack:`single-5`,pyramid:`pyramid-8`,springs:`spring-demo`}[Ct]||`gel-cut`;!T&&Tt!==O.currentScene?O.setScene(Tt):T&&(Ct===`soft`||Ct===`stack`||Ct===`pyramid`||Ct===`springs`)&&D.setScene(Ct),await gt(wt),st(),Ye(),J(),window.koraAvbdStep=e=>(O.step(1/60,e),{springs:O.springCount,bodies:O.bodyCount,cut:O.lastCutCount,ms:O.lastStepMs,com:O.softCom?.()??{x:0,y:0,z:0}}),r&&await S.mountButton(r);let Et=0,Dt=0,Ot=0,kt=0,At=U.substeps,jt=performance.now(),Mt,Nt;f.setAnimationLoop((e,t)=>{let r=performance.now(),i=Math.min((r-jt)/1e3,.05);if(jt=r,Dt+=i,Et++,d?.frame(),Dt>.5&&(Ot=Et/Dt,Dt=0,Et=0,ge=!0),P.update(),S.update(t??null,i),v===`avbd`&&O.usesFpsControls?.()&&!S.active&&(k.update(i),M)){let e=Ni(O.currentScene)?2:1/28;for(N+=i;N>=e;)N-=e,vt()}let a=S.active&&_>0&&!S.rendering,o=null;if(!a){let e=performance.now();if(v===`fire`)w.step(i,t);else if(v===`avbd`){let e=O.currentScene===`gel-cut`||T?Me(t):[];o=e,S.active&&!T&&O.currentScene!==`gel-cut`&&E.setHandColliders(Pt({session:f.xr.getSession(),referenceSpace:f.xr.getReferenceSpace(),frame:t,target:E.handColliderSpace})),O.step(i,e)}else{let e=Me(t);o=e,Mt||=Se(G),Nt||=Se(pe);let n=S.rendering?6:void 0;At=n??U.substeps,U.step(e,n,Mt,Nt),be++,be%(S.rendering?4:2)==0&&_e.update(f)}kt=performance.now()-e}if(W(i,o),_>0&&_--,S.active?S.rendering&&f.render(p,h):(g.enabled&&g.update(),f.render(p,h)),n&&rt&&ge){ge=!1;let e=[`${Ot.toFixed(0)} fps`];v===`avbd`?(e.push(`${O.bodyCount} bodies`+(O.springCount?` · ${O.springCount} springs`:``)),T&&e.push(`CPU step ${O.lastStepMs.toFixed(2)} ms`)):v!==`fire`&&e.push(`${At} substeps/frame`);let t=d?.read();t?e.push(`GPU sim ${t.compute.toFixed(2)} ms · draw ${t.render.toFixed(2)} ms`):d||e.push(`CPU step ${kt.toFixed(2)} ms`),S.active&&e.push(`XR`),n.textContent=e.join(` · `)}v===`avbd`&&k.setSceneStatusText(O.sceneStatusText?.()??null)}),window.addEventListener(`resize`,()=>{h.aspect=window.innerWidth/window.innerHeight,h.updateProjectionMatrix(),f.setSize(window.innerWidth,window.innerHeight)})}vp().catch(e=>{console.error(e),document.getElementById(`unsupported`)?.classList.add(`show`)});