import {
  ClampToEdgeWrapping,
  DataTexture,
  DataUtils,
  HalfFloatType,
  LinearFilter,
  RGBAFormat,
} from 'three/webgpu';

/**
 * Blackbody radiation lookup table.
 *
 * Kora §5.4.1: "Photorealistic flame colors are computed from the Kelvin temperature channel T
 * using accurate black-body radiation."
 *
 * Planck's law is integrated against the CIE 1931 colour matching functions (using Wyman et al.'s
 * multi-lobe Gaussian fits) and converted to linear sRGB on the CPU, then baked into a 1D texture
 * so the raymarcher pays a single fetch per sample instead of thirty exponentials.
 *
 * The stored RGB is chromaticity-only, normalised to unit luminance; the T^4 Stefan-Boltzmann
 * intensity is reapplied in the shader so exposure stays an artist control.
 */

export const BLACKBODY_MIN_K = 300;
export const BLACKBODY_MAX_K = 4500;
const SIZE = 512;

const H_PLANCK = 6.62607015e-34;
const C_LIGHT = 2.99792458e8;
const K_BOLTZMANN = 1.380649e-23;

/** Spectral radiance of a blackbody at wavelength lambda (nm) and temperature T (K). */
function planck(lambdaNm: number, T: number): number {
  const l = lambdaNm * 1e-9;
  const a = (2 * H_PLANCK * C_LIGHT * C_LIGHT) / Math.pow(l, 5);
  const b = Math.exp((H_PLANCK * C_LIGHT) / (l * K_BOLTZMANN * T)) - 1;
  return a / b;
}

const gauss = (x: number, a: number, mu: number, s1: number, s2: number) => {
  const t = (x - mu) * (x < mu ? 1 / s1 : 1 / s2);
  return a * Math.exp(-0.5 * t * t);
};

/** Wyman, Sloan & Shirley (2013), "Simple Analytic Approximations to the CIE XYZ Colour Matching Functions". */
function cie(lambda: number): [number, number, number] {
  const x =
    gauss(lambda, 1.056, 599.8, 37.9, 31.0) +
    gauss(lambda, 0.362, 442.0, 16.0, 26.7) +
    gauss(lambda, -0.065, 501.1, 20.4, 26.2);
  const y = gauss(lambda, 0.821, 568.8, 46.9, 40.5) + gauss(lambda, 0.286, 530.9, 16.3, 31.1);
  const z = gauss(lambda, 1.217, 437.0, 11.8, 36.0) + gauss(lambda, 0.681, 459.0, 26.0, 13.8);
  return [x, y, z];
}

function xyzToLinearSRGB(X: number, Y: number, Z: number): [number, number, number] {
  return [
    3.2404542 * X - 1.5371385 * Y - 0.4985314 * Z,
    -0.969266 * X + 1.8760108 * Y + 0.041556 * Z,
    0.0556434 * X - 0.2040259 * Y + 1.0572252 * Z,
  ];
}

export function createBlackbodyLUT(): DataTexture {
  // Half float rather than full: WebGPU only allows sampling rgba32float when the optional
  // `float32-filterable` feature is present, and an unfilterable binding reads back as zero,
  // which turns every flame black. rgba16float is filterable in core WebGPU and has ample
  // precision for a normalised chromaticity.
  const data = new Uint16Array(SIZE * 4);

  for (let i = 0; i < SIZE; i++) {
    const T = BLACKBODY_MIN_K + ((BLACKBODY_MAX_K - BLACKBODY_MIN_K) * i) / (SIZE - 1);

    let X = 0;
    let Y = 0;
    let Z = 0;
    for (let l = 380; l <= 780; l += 5) {
      const p = planck(l, T);
      const [cx, cy, cz] = cie(l);
      X += p * cx;
      Y += p * cy;
      Z += p * cz;
    }

    let [r, g, b] = xyzToLinearSRGB(X, Y, Z);

    // Clip to the sRGB gamut by desaturating toward the achromatic axis rather than clamping,
    // which would swing very hot flames toward magenta.
    const lo = Math.min(r, g, b);
    if (lo < 0) {
      r -= lo;
      g -= lo;
      b -= lo;
    }

    const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    const inv = luminance > 0 ? 1 / luminance : 0;

    data[i * 4 + 0] = DataUtils.toHalfFloat(r * inv);
    data[i * 4 + 1] = DataUtils.toHalfFloat(g * inv);
    data[i * 4 + 2] = DataUtils.toHalfFloat(b * inv);
    data[i * 4 + 3] = DataUtils.toHalfFloat(1);
  }

  const tex = new DataTexture(data, SIZE, 1, RGBAFormat, HalfFloatType);
  tex.minFilter = LinearFilter;
  tex.magFilter = LinearFilter;
  tex.wrapS = ClampToEdgeWrapping;
  tex.wrapT = ClampToEdgeWrapping;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  return tex;
}
