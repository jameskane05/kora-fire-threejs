/**
 * Swappable image-based backdrops.
 *
 * Nothing in this scene is lit — the volume is emissive, the obstacles and hands are unlit — so
 * these are backdrops rather than lighting environments. They exist because soot is dark grey and
 * a dark grey plume against a near-black void is invisible: the smoke half of the simulation is
 * simply not legible without something behind it to occlude.
 *
 * That makes intensity the important control rather than an afterthought. Bloom runs over the
 * whole frame at a 0.85 threshold, so a bright sky at full strength both blooms on its own and
 * flattens the fire's glow against it.
 */
import {
  Color,
  EquirectangularReflectionMapping,
  type Scene,
  type Texture,
} from 'three/webgpu';
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';

export const ENVIRONMENTS = ['void', 'studio', 'dusk', 'daylight', 'night'] as const;
export type EnvironmentName = (typeof ENVIRONMENTS)[number];

/** 1k HDRIs from Poly Haven, CC0. Vendored so the app works offline and on a local network. */
const FILES: Partial<Record<EnvironmentName, string>> = {
  studio: 'env/studio_small_09.hdr',
  dusk: 'env/venice_sunset.hdr',
  daylight: 'env/kloofendal_48d_partly_cloudy_puresky.hdr',
  night: 'env/dikhololo_night.hdr',
};

/**
 * A sensible starting brightness per backdrop, since they span a wide range of real exposures.
 * Daylight in particular is orders of magnitude above the fire and needs pulling right down
 * before the flame reads as the brightest thing in frame again.
 */
export const DEFAULT_INTENSITY: Record<EnvironmentName, number> = {
  void: 1,
  studio: 0.5,
  dusk: 0.6,
  daylight: 0.12,
  night: 1.6,
};

const VOID_COLOUR = 0x05060a;

export class Environment {
  private readonly cache = new Map<EnvironmentName, Texture>();
  private readonly loader = new HDRLoader();
  private readonly fallback = new Color(VOID_COLOUR);
  /** Guards against a slow load landing after the user has moved on to another backdrop. */
  private pending = 0;
  private current: EnvironmentName = 'void';

  constructor(private readonly scene: Scene) {
    scene.background = this.fallback;
  }

  get name(): EnvironmentName {
    return this.current;
  }

  /** Loads on first use rather than up front; the four HDRIs together are several megabytes. */
  async set(name: EnvironmentName): Promise<void> {
    this.current = name;
    const token = ++this.pending;

    const file = FILES[name];
    if (!file) {
      this.scene.background = this.fallback;
      return;
    }

    const cached = this.cache.get(name);
    if (cached) {
      this.scene.background = cached;
      return;
    }

    try {
      const texture = await this.loader.loadAsync(file);
      texture.mapping = EquirectangularReflectionMapping;
      this.cache.set(name, texture);

      if (token === this.pending) this.scene.background = texture;
      else texture.dispose();
    } catch (error) {
      console.error(`[kora] could not load the ${name} backdrop:`, error);
      if (token === this.pending) this.scene.background = this.fallback;
    }
  }

  setIntensity(intensity: number): void {
    this.scene.backgroundIntensity = intensity;
  }

  dispose(): void {
    for (const texture of this.cache.values()) texture.dispose();
    this.cache.clear();
  }
}
