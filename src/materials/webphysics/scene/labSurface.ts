/**
 * Procedural cast-concrete for the static geometry in the physics demos.
 *
 * Everything here is driven from object space rather than UVs: `addStaticBoxWithVisual` builds
 * boxes at wildly different aspect ratios from one shared BoxGeometry layout, so UV-space patterns
 * stretch differently on every slab. Object space keeps the seam spacing physically constant, and
 * blending the top and side treatments by the face normal avoids needing a triplanar sample.
 *
 * No texture files: these are single static meshes, so a handful of noise octaves per fragment is
 * cheaper than the download.
 */
import { MeshStandardNodeMaterial } from 'three/webgpu';
import {
  abs,
  float,
  Fn,
  fract,
  max,
  min,
  mix,
  normalLocal,
  oneMinus,
  positionLocal,
  smoothstep,
  vec2,
  vec3,
} from 'three/tsl';

type N = any;

const hash = Fn(([p]: [N]) => p.dot(vec2(127.1, 311.7)).sin().mul(43758.5453).fract());

const valueNoise = Fn(([p]: [N]) => {
  const i = vec2(p.x.floor(), p.y.floor());
  const f = fract(p);
  const u = f.mul(f).mul(f.mul(-2).add(3));
  return mix(
    mix(hash(i), hash(i.add(vec2(1, 0))), u.x),
    mix(hash(i.add(vec2(0, 1))), hash(i.add(vec2(1, 1))), u.x),
    u.y,
  );
});

/** Aggregate mottling: a broad blotch plus two finer passes for grain. */
const concreteNoise = Fn(([p]: [N]) =>
  valueNoise(p)
    .mul(0.55)
    .add(valueNoise(p.mul(2.3)).mul(0.28))
    .add(valueNoise(p.mul(5.7)).mul(0.17)),
);

/** 1 on a line, falling to 0 over `width`, repeating every `period`. */
function seam(coord: N, period: number, width: number): N {
  const d = coord.div(period).add(0.5).fract().sub(0.5).abs().mul(period);
  return oneMinus(smoothstep(float(0), float(width), d));
}

/** Normalise a hex colour to its hue, then pull it most of the way back to white. */
function hueTint(hex: number, strength: number): [number, number, number] {
  const rgb = [((hex >> 16) & 0xff) / 255, ((hex >> 8) & 0xff) / 255, (hex & 0xff) / 255];
  const peak = Math.max(...rgb, 1e-3);
  return rgb.map((c) => 1 - strength + (strength * c) / peak) as [number, number, number];
}

export interface LabSurfaceOptions {
  /** Base tint. Scenes pass distinct greys to keep parts of a rig readable against each other. */
  color?: number;
  halfExtents: [number, number, number];
  /** Painted safety border inset from the top rim. Worth it on walkable decks, noise elsewhere. */
  markings?: boolean;
}

export function createLabSurfaceMaterial(options: LabSurfaceOptions): MeshStandardNodeMaterial {
  const material = new MeshStandardNodeMaterial();
  const [hx, , hz] = options.halfExtents;

  // Scenes pass saturated greys to tell parts of a rig apart. Used raw they would drag the slab
  // straight back to the flat grey this replaces, so keep the hue and throw away the brightness.
  const tint = vec3(...hueTint(options.color ?? 0xffffff, 0.3));

  const p = positionLocal;
  const upness = smoothstep(float(0.4), float(0.9), normalLocal.y);

  const grain = concreteNoise(vec2(p.x, p.z).mul(0.9));
  const wallGrain = concreteNoise(vec2(p.x.add(p.z), p.y).mul(1.4));
  const mottle = mix(wallGrain, grain, upness);

  // Bay joints on the deck, form-work lifts on the sides.
  const deckSeams = max(seam(p.x, 4.0, 0.05), seam(p.z, 4.0, 0.05));
  const wallSeams = seam(p.y, 1.6, 0.04);
  const seams = mix(wallSeams, deckSeams, upness);

  // Concrete reads white under the studio HDRI; the tint only shades it.
  const light = vec3(0.84, 0.84, 0.82);
  const dark = vec3(0.52, 0.52, 0.51);
  let albedo = mix(dark, light, mottle).mul(tint);
  albedo = albedo.mul(oneMinus(seams.mul(0.35)));

  let roughness = mix(float(0.95), float(0.78), mottle);

  if (options.markings) {
    const edge = min(float(hx).sub(abs(p.x)), float(hz).sub(abs(p.z)));
    const band = smoothstep(float(0.45), float(0.6), edge).mul(
      oneMinus(smoothstep(float(1.0), float(1.15), edge)),
    );
    const stripe = band.mul(upness);
    albedo = mix(albedo, vec3(0.85, 0.68, 0.13), stripe.mul(0.85));
    // Paint sits on top of the pour, so it is smoother than the slab around it.
    roughness = mix(roughness, float(0.5), stripe);
  }

  material.colorNode = albedo;
  material.roughnessNode = roughness;
  material.metalnessNode = float(0.0);
  return material;
}
