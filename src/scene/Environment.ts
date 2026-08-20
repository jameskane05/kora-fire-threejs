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
  HalfFloatType,
  type Scene,
  type Texture,
} from 'three/webgpu';
import { EXRLoader } from 'three/addons/loaders/EXRLoader.js';
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';

export const ENVIRONMENTS = ['void', 'studio', 'dusk', 'daylight', 'night'] as const;
export type EnvironmentName = (typeof ENVIRONMENTS)[number];

/**
 * Poly Haven HDRIs, CC0. Vendored so the app works offline and on a local network.
 *
 * 1k except studio, which is the one backdrop the camera actually looks at rather than just
 * being lit by, so it earns 2k. EXR at the same resolution is meaningfully smaller than HDR.
 */
const FILES: Partial<Record<EnvironmentName, string>> = {
  studio: 'env/studio_small_09_2k.exr',
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
  private readonly hdrLoader = new HDRLoader();
  /** Pinned to match what HDRLoader produces, so format is not a variable between backdrops. */
  private readonly exrLoader = new EXRLoader().setDataType(HalfFloatType);
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
      this.apply(null);
      return;
    }

    const cached = this.cache.get(name);
    if (cached) {
      this.apply(cached);
      return;
    }

    try {
      const loader = file.endsWith('.exr') ? this.exrLoader : this.hdrLoader;
      const texture = await loader.loadAsync(file);
      texture.mapping = EquirectangularReflectionMapping;
      this.cache.set(name, texture);

      if (token === this.pending) this.apply(texture);
      else texture.dispose();
    } catch (error) {
      console.error(`[kora] could not load the ${name} backdrop:`, error);
      if (token === this.pending) this.apply(null);
    }
  }

  /**
   * The same texture serves as backdrop and as the lighting environment.
   *
   * Scenes whose materials are all unlit ignore the second half of that; the webphysics demos are
   * the ones that care, since their MeshStandard surfaces otherwise sit under a neutral white rig
   * with nothing tying them to whatever is behind them.
   */
  private apply(texture: Texture | null): void {
    this.scene.background = texture ?? this.fallback;
    this.scene.environment = texture;
  }

  setIntensity(intensity: number): void {
    this.scene.backgroundIntensity = intensity;
    this.scene.environmentIntensity = intensity;
  }

  dispose(): void {
    for (const texture of this.cache.values()) texture.dispose();
    this.cache.clear();
  }
}
