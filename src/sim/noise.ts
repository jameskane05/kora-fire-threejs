import {
  Data3DTexture,
  FloatType,
  LinearFilter,
  RGBAFormat,
  RepeatWrapping,
} from 'three/webgpu';

/**
 * Texel separation of the central difference that takes the curl, as a fraction of the volume.
 *
 * ECT samples the potential at feature size l_i = 2^i voxels and differences it over h = l_i / 2
 * voxels, against a repeat period of 8 l_i voxels. In the volume's own coordinates that step is
 * h / period = 1/16 whatever the band, which is what makes it possible to take the curl once here
 * instead of six times per band per voxel in the shader.
 */
const CURL_STEP = 1 / 16;

export interface NoiseVolume {
  /** curl of the vector potential, encoded to [0,1] */
  texture: Data3DTexture;
  /** multiplier that returns a decoded [-1,1] sample to its original magnitude */
  scale: number;
}

/**
 * A tileable curl-noise volume for the turbulence term of ECT (§4.8).
 *
 * The underlying field is a periodic value-noise vector potential, summed over a few octaves;
 * tileability matters because it is sampled at five scales and offsets, and a seam would read as
 * a straight line of injected vorticity. Taking the curl is what makes the injected velocity
 * divergence-free, so it costs nothing downstream in the pressure solve.
 *
 * The curl is baked here rather than differenced in the shader. Doing it live cost six trilinear
 * fetches per band per voxel — twenty-four at the default band count — where a pre-curled volume
 * costs one. The two differ only in that the hardware now interpolates the curl instead of the
 * potential it came from, which for a noise field is not a visible distinction.
 */
export function createNoiseVolume(size = 32, seed = 1337): NoiseVolume {
  const lattice = periodicLattice(size, seed);

  const potential = new Float32Array(size * size * size * 3);
  for (let z = 0; z < size; z++) {
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const i = (z * size * size + y * size + x) * 3;
        for (let ch = 0; ch < 3; ch++) {
          potential[i + ch] = sampleOctaves(lattice, size, x, y, z, ch);
        }
      }
    }
  }

  const wrap = (v: number) => ((v % size) + size) % size;
  const at = (x: number, y: number, z: number, ch: number) =>
    potential[(wrap(z) * size * size + wrap(y) * size + wrap(x)) * 3 + ch];

  const step = Math.max(1, Math.round(size * CURL_STEP));
  const curl = new Float32Array(size * size * size * 3);
  let peak = 0;

  for (let z = 0; z < size; z++) {
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const d = (ax: 0 | 1 | 2, ch: number) => {
          const o = [0, 0, 0];
          o[ax] = step;
          return (
            at(x + o[0], y + o[1], z + o[2], ch) - at(x - o[0], y - o[1], z - o[2], ch)
          );
        };

        const i = (z * size * size + y * size + x) * 3;
        curl[i + 0] = d(1, 2) - d(2, 1);
        curl[i + 1] = d(2, 0) - d(0, 2);
        curl[i + 2] = d(0, 1) - d(1, 0);

        for (let ch = 0; ch < 3; ch++) peak = Math.max(peak, Math.abs(curl[i + ch]));
      }
    }
  }

  const scale = peak || 1;
  const data = new Float32Array(size * size * size * 4);
  for (let i = 0, j = 0; i < curl.length; i += 3, j += 4) {
    data[j + 0] = curl[i + 0] / scale / 2 + 0.5;
    data[j + 1] = curl[i + 1] / scale / 2 + 0.5;
    data[j + 2] = curl[i + 2] / scale / 2 + 0.5;
    data[j + 3] = 1;
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

  return { texture: tex, scale };
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
