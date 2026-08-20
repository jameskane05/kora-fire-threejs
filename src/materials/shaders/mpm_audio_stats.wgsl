// Subsample particle velocities into compact motion stats for procedural water audio.
// Binding layout is independent of the main MLS-MPM pass.

struct StatsParams {
  num_particles: u32,
  stride: u32,
  high_speed: f32,
  _pad: f32,
}

struct StatsOut {
  // Fixed-point sum of speed * 1024
  sum_speed: atomic<u32>,
  // Bit pattern of max speed (non-negative f32 — bit order matches magnitude)
  max_speed_bits: atomic<u32>,
  count: atomic<u32>,
  high_count: atomic<u32>,
}

@group(0) @binding(0) var<uniform> params: StatsParams;
@group(0) @binding(1) var<storage, read> render_vel: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read_write> stats: StatsOut;

@compute @workgroup_size(64)
fn reduce_vel(@builtin(global_invocation_id) gid: vec3<u32>) {
  let sample = gid.x;
  let i = sample * params.stride;
  if (i >= params.num_particles) { return; }
  let s = length(render_vel[i].xyz);
  atomicAdd(&stats.sum_speed, u32(s * 1024.0));
  atomicAdd(&stats.count, 1u);
  if (s > params.high_speed) {
    atomicAdd(&stats.high_count, 1u);
  }
  // Atomic max on IEEE-754 bits works for non-negative floats.
  let bits = bitcast<u32>(s);
  atomicMax(&stats.max_speed_bits, bits);
}
