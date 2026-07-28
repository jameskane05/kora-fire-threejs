import {
  Data3DTexture,
  FloatType,
  LinearFilter,
  RGBAFormat,
  RepeatWrapping,
} from 'three/webgpu';

/**
 * A tileable 3D vector noise potential for the curl-noise term of ECT (§4.8).
 *
 * Periodic value noise summed over a couple of octaves. Tileability matters: the potential is
 * sampled at five different scales and offsets, and any seam would show up as a straight line
 * of injected vorticity.
 */
export function createNoiseVolume(size = 32, seed = 1337): Data3DTexture {
  const data = new Float32Array(size * size * size * 4);
  const lattice = periodicLattice(size, seed);

  for (let z = 0; z < size; z++) {
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const i = (z * size * size + y * size + x) * 4;
        for (let ch = 0; ch < 3; ch++) {
          const a = sampleOctaves(lattice, size, x, y, z, ch);
          data[i + ch] = a * 0.5 + 0.5;
        }
        data[i + 3] = 1;
      }
    }
  }

  const tex = new Data3DTexture(data, size, size, size);
  tex.format = RGBAFormat;
  tex.type = FloatType;
  tex.minFilter = LinearFilter;
  tex.magFilter = LinearFilter;
  tex.wrapS = RepeatWrapping;
  tex.wrapT = RepeatWrapping;
  tex.wrapR = RepeatWrapping;
  tex.needsUpdate = true;
  return tex;
}

type Lattice = (channel: number, period: number, x: number, y: number, z: number) => number;

function periodicLattice(size: number, seed: number): Lattice {
  const hash = (n: number) => {
    let h = (n ^ seed) >>> 0;
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
  };

  return (channel, period, x, y, z) => {
    const xi = ((x % period) + period) % period;
    const yi = ((y % period) + period) % period;
    const zi = ((z % period) + period) % period;
    return hash(
      channel * 7919 + period * 104729 + xi + yi * 313 + zi * 98317 + size * 65537,
    );
  };
}

const fade = (t: number) => t * t * (3 - 2 * t);

function valueNoise(
  lattice: Lattice,
  channel: number,
  period: number,
  x: number,
  y: number,
  z: number,
): number {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const z0 = Math.floor(z);
  const tx = fade(x - x0);
  const ty = fade(y - y0);
  const tz = fade(z - z0);

  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
  const at = (dx: number, dy: number, dz: number) =>
    lattice(channel, period, x0 + dx, y0 + dy, z0 + dz);

  const c00 = lerp(at(0, 0, 0), at(1, 0, 0), tx);
  const c10 = lerp(at(0, 1, 0), at(1, 1, 0), tx);
  const c01 = lerp(at(0, 0, 1), at(1, 0, 1), tx);
  const c11 = lerp(at(0, 1, 1), at(1, 1, 1), tx);

  return lerp(lerp(c00, c10, ty), lerp(c01, c11, ty), tz) * 2 - 1;
}

function sampleOctaves(
  lattice: Lattice,
  size: number,
  x: number,
  y: number,
  z: number,
  channel: number,
): number {
  let sum = 0;
  let amplitude = 1;
  let total = 0;

  for (const period of [4, 8, 16]) {
    if (period > size) break;
    const s = period / size;
    sum += amplitude * valueNoise(lattice, channel, period, x * s, y * s, z * s);
    total += amplitude;
    amplitude *= 0.5;
  }

  return sum / total;
}
