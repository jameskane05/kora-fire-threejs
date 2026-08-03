/**
 * Fire mount for the AVP sandbox — torch solver + volume + sparks + Kora GUI + desktop Obstacles.
 */
import { Scene, Vector3, type PerspectiveCamera, type WebGPURenderer } from 'three/webgpu';
import type GUI from 'lil-gui';
import { FLAME_AUDIO_ENABLED, FlameAudio } from '../audio/FlameAudio';
import { KoraSolver } from '../sim/KoraSolver';
import { createNoiseVolume, type NoiseVolume } from '../sim/noise';
import { defaultParams, type KoraParams } from '../sim/params';
import type { ObstacleKind } from '../sim/obstacles';
import { FieldProbe } from '../sim/probe';
import { gridOps } from '../sim/tsl';
import { VolumeRenderer } from '../render/VolumeRenderer';
import { PRESETS, applyPreset, type Preset } from '../ui/presets';
import { QUALITY, type Quality } from '../ui/quality';
import {
  IMMERSIVE_FIRE_BUDGET,
  IMMERSIVE_FIRE_FRAMED_SIZE,
  applyImmersiveFireBudget,
  IMMERSIVE_FIRE_SOLVE_INTERVAL,
} from '../ui/immersiveFire';
import { createGui, refreshGui } from '../ui/gui';
import { Sparks } from '../particles/Sparks';
import { Obstacles, type GizmoMode } from '../scene/Obstacles';
import { DEFAULT_INTENSITY, type Environment, type EnvironmentName } from '../scene/Environment';
import type { ImmersiveMode } from '../xr/ImmersiveMode';
import { HandSolids, MAX_HAND_SOLIDS } from '../xr/HandSolids';
import { isVisionOS } from '../xr/platform';
import { MAX_SCENE_OBSTACLES } from '../sim/obstacles';

function fireObstacleBudget(sceneCount: number, hands: boolean): number {
  return sceneCount + (hands ? MAX_HAND_SOLIDS : 0);
}

/** How often to pull lean field extremes for the audio bus (seconds). */
const AUDIO_PROBE_PERIOD = 0.12;
/** Coarse voxel stride — audio only needs a rough max. */
const AUDIO_PROBE_STRIDE = 8;

/** Match MPM tabletop so fire sits in the lap, not mid-air in front of you. */
export const FIRE_PLACEMENT = {
  distance: 0.48,
  height: 0.88,
  framedSize: 0.42,
  /** Same as sand/goo/water: pinch is for colliders, not spinning the domain. */
  turntable: false,
} as const;

export class FireExhibit {
  private solver: KoraSolver | null = null;
  private volume: VolumeRenderer | null = null;
  private sparks: Sparks | null = null;
  private noise: NoiseVolume | null = null;
  private obstacles: Obstacles | null = null;
  private readonly handSolids = new HandSolids();
  private readonly audio = new FlameAudio();
  private audioProbes: FieldProbe[] | null = null;
  private audioProbeBusy = false;
  private audioProbeAge = 0;
  private params: KoraParams = (() => {
    const p = applyPreset({ ...defaultParams }, PRESETS[0]);
    // Sandbox is AVP-first: lean budget from first build, not desktop performance (64³).
    applyImmersiveFireBudget(p);
    p.environment = 'night';
    p.backgroundIntensity = DEFAULT_INTENSITY.night;
    // Desktop keeps a seeded sphere; visionOS skips it (palms are the interactive solids).
    p.obstacleCount = fireObstacleBudget(isVisionOS() ? 0 : 1, false);
    return p;
  })();
  private gui: GUI | null = null;
  private frame = 0;
  private active = false;
  private ready = false;
  private readonly onKeyDown = (e: KeyboardEvent) => {
    if (!this.active) return;
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
    if (e.key === ' ') {
      e.preventDefault();
      this.solver?.detonate(1.0);
    }
    const mode = { w: 'translate', e: 'rotate', r: 'scale' }[e.key.toLowerCase()];
    if (mode) this.obstacles?.setMode(mode as GizmoMode);
    if (e.key === 'Escape') this.obstacles?.select(null);
  };

  constructor(
    private readonly renderer: WebGPURenderer,
    private readonly immersive: ImmersiveMode,
    private readonly environment: Environment,
    private readonly scene: Scene,
    private readonly camera: PerspectiveCamera,
    private readonly onGizmoDrag: (dragging: boolean) => void,
  ) {}

  get isReady(): boolean {
    return this.ready;
  }

  get isActive(): boolean {
    return this.active;
  }

  get domainSize(): number {
    return this.params.domainSize;
  }

  /** Live params object for the sandbox world-space HUD (mutated in place by knobs). */
  get koraParams(): KoraParams {
    return this.params;
  }

  /** Notified when XR / gizmo mode changes so the world HUD can repaint. */
  onWorldUiChange: () => void = () => {};

  setGizmoMode(mode: GizmoMode): void {
    this.params.gizmoMode = mode;
    this.obstacles?.setMode(mode);
    this.immersive.showMode(mode);
    this.onWorldUiChange();
  }

  /** Keep lil-gui in sync after XR world-panel edits. */
  refreshDesktopGui(): void {
    if (this.gui) refreshGui(this.gui);
  }

  async init(): Promise<void> {
    if (this.ready) return;

    this.noise = createNoiseVolume(32);
    this.buildSolver();
    this.mountGui();
    this.setGuiVisible(false);
    this.setVisible(false);
    window.addEventListener('keydown', this.onKeyDown);
    this.ready = true;
  }

  setActive(on: boolean): void {
    if (!this.ready) return;
    this.active = on;
    this.setVisible(on);
    this.setGuiVisible(on);
    this.audio.setEnabled(on);
    if (on) {
      // Selecting Fire from the toolbar must land on the lean budget (GUI shows 48, not 64).
      if (this.enforceLeanBudget()) this.rebuild();
      else if (this.gui) refreshGui(this.gui);
      this.immersive.setDomainSize(this.params.domainSize);
      this.immersive.setPlacement(this.placementForSession());
      this.environment.setIntensity(this.params.backgroundIntensity);
      void this.environment.set(this.params.environment);
      this.obstacles?.setGizmoEnabled(!this.immersive.active);
      if (this.obstacles) this.immersive.setManipulator(this.obstacles);
      void this.audio.resume();
    } else {
      // Keep selection so re-entering fire re-attaches the gizmo to the same collider.
      this.obstacles?.setGizmoEnabled(false);
    }
  }

  /** Unlock the AudioContext from a user gesture (toolbar click / Enter VR). */
  resumeAudio(): void {
    void this.audio.resume();
  }

  reset(): void {
    if (!this.solver || !this.sparks) return;
    this.solver.reset();
    this.sparks.reset(this.renderer);
    this.frame = 0;
  }

  enterImmersive(): void {
    if (!this.volume) return;
    this.obstacles?.setGizmoEnabled(false);

    // Budget is always lean in the sandbox; re-assert in case the GUI was twiddled.
    const handsChanged = this.setHandSlots(true);
    if (this.enforceLeanBudget() || handsChanged) {
      this.rebuild();
      if (this.gui) refreshGui(this.gui);
    } else {
      this.volume.update(this.params, this.frame);
      if (this.gui) refreshGui(this.gui);
    }
    this.immersive.setPlacement({ ...FIRE_PLACEMENT, framedSize: IMMERSIVE_FIRE_FRAMED_SIZE });

    if (this.sparks) this.sparks.mesh.visible = false;
    void this.audio.resume();
  }

  exitImmersive(): void {
    if (this.active) this.obstacles?.setGizmoEnabled(true);
    // Drop palm solid slots so flat rendering stops paying bake/pressure for parked hands.
    if (this.setHandSlots(false)) this.rebuild();
    // Stay on the lean sandbox budget — do not restore desktop 64³.
    this.immersive.setPlacement({ ...FIRE_PLACEMENT });
    if (this.sparks) this.sparks.mesh.visible = this.active && this.params.sparksEnabled;
  }

  step(dt: number, xrFrame?: XRFrame): void {
    if (!this.active || !this.solver || !this.volume || !this.sparks) return;
    this.obstacles?.update(dt);
    // Hands → reserved solid slots after scene colliders. Parks when not in XR / no joints.
    if (this.obstacles) {
      this.handSolids.update(
        this.solver.uniforms,
        this.obstacles.count,
        this.immersive.contentRoot,
        this.renderer,
        this.immersive.active ? xrFrame : undefined,
        dt,
      );
    }
    // Stereo raymarch owns the frame; throttle the Euler solve while presenting.
    const interval = IMMERSIVE_FIRE_SOLVE_INTERVAL;
    if (!this.immersive.active || this.frame % interval === 0) {
      this.solver.step(this.immersive.active ? dt * interval : dt);
    }
    this.volume.update(this.params, this.frame);
    // Dual-eye overdraw for embers is dropped while presenting.
    if (this.params.sparksEnabled && !this.immersive.active) {
      this.sparks.step(this.renderer, this.solver.currentParity, dt, this.frame);
    }
    this.tickAudio(dt);
    this.frame++;
  }

  dispose(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    this.gui?.destroy();
    this.gui = null;
    this.audio.dispose();
    this.teardownSolver();
    this.noise = null;
    this.ready = false;
    this.active = false;
  }

  private mountGui(): void {
    this.gui?.destroy();
    this.gui = createGui(this.params, this.callbacks(), {
      omitDiagnosticsTools: true,
    });
    if (!this.active) this.setGuiVisible(false);
  }

  private callbacks() {
    return {
      onStructuralChange: () => {
        // Keep headset knobs pinned; free edits to look params still rebuild.
        this.enforceLeanBudget();
        this.rebuild();
        if (this.gui) refreshGui(this.gui);
      },
      onPreset: (preset: Preset) => {
        const obstacles = this.obstacles?.count ?? 1;
        this.params = applyPreset(this.params, preset);
        this.enforceLeanBudget();
        this.params.environment = 'night';
        this.params.backgroundIntensity = DEFAULT_INTENSITY.night;
        this.params.obstacleCount = fireObstacleBudget(obstacles, this.handSolids.active);
        this.rebuild();
        this.mountGui();
        void this.environment.set('night');
        this.environment.setIntensity(DEFAULT_INTENSITY.night);
        refreshGui(this.gui!);
      },
      onReset: () => {
        this.enforceLeanBudget();
        this.rebuild();
        if (this.gui) refreshGui(this.gui);
      },
      onDetonate: () => this.solver?.detonate(1.0),
      onProbe: () => undefined,
      onProfile: () => undefined,
      onQuality: (_q: Quality) => {
        // Quality tiers would yank resolution back to 64/80/96 — sandbox ignores them for cost.
        this.enforceLeanBudget();
        this.renderer.setPixelRatio(
          Math.min(window.devicePixelRatio, QUALITY[IMMERSIVE_FIRE_BUDGET.quality].pixelRatio),
        );
        this.rebuild();
        refreshGui(this.gui!);
      },
      onShowGrid: () => {
        // Sandbox fire matches MPM: no domain wireframe.
      },
      onAddObstacle: (kind: ObstacleKind) => this.addObstacle(kind),
      onRemoveObstacle: () => {
        if (this.obstacles?.selection !== null && this.obstacles) {
          this.obstacles.remove(this.obstacles.selection);
        }
      },
      onGizmoMode: (mode: GizmoMode) => this.setGizmoMode(mode),
      onEnvironment: (name: EnvironmentName) => {
        this.params.backgroundIntensity = DEFAULT_INTENSITY[name];
        this.environment.setIntensity(this.params.backgroundIntensity);
        void this.environment.set(name);
        refreshGui(this.gui!);
      },
    };
  }

  private addObstacle(kind: ObstacleKind): void {
    if (!this.obstacles) return;
    const at = this.params.sourcePosition.clone();
    at.y += this.params.sourceLength + 0.45;
    this.obstacles.add(kind, at);
  }

  /** Pin cost knobs; returns whether the compute graph needs a rebuild. */
  private enforceLeanBudget(): boolean {
    return applyImmersiveFireBudget(this.params);
  }

  /** XR-only palm spheres. Returns true when obstacleCount changed (needs rebuild). */
  private setHandSlots(on: boolean): boolean {
    if (this.handSolids.active === on) return false;
    this.handSolids.setEnabled(on);
    this.params.obstacleCount = fireObstacleBudget(this.obstacles?.count ?? 1, on);
    return true;
  }

  private placementForSession(): typeof FIRE_PLACEMENT & { framedSize: number } {
    return {
      ...FIRE_PLACEMENT,
      framedSize: this.immersive.active ? IMMERSIVE_FIRE_FRAMED_SIZE : FIRE_PLACEMENT.framedSize,
    };
  }

  private rebuild(): void {
    const wasVisible = this.active;
    this.enforceLeanBudget();
    this.teardownSolver();
    this.buildSolver();
    this.setVisible(wasVisible);
    if (wasVisible) {
      this.immersive.setDomainSize(this.params.domainSize);
      this.immersive.setPlacement(this.placementForSession());
      if (this.obstacles) this.immersive.setManipulator(this.obstacles);
    }
  }

  private buildSolver(): void {
    if (!this.noise) this.noise = createNoiseVolume(32);
    this.enforceLeanBudget();
    this.solver = new KoraSolver(this.renderer, this.params, this.noise);
    this.volume = new VolumeRenderer(
      {
        field: this.solver.renderField,
        blur: this.solver.renderBlur,
        solid: this.solver.fields.solid,
      },
      this.params.domainSize,
    );
    this.sparks = new Sparks(
      {
        render: this.solver.renderField,
        solid: this.solver.fields.solid,
        velocity: [this.solver.state[0].vel, this.solver.state[1].vel],
        lut: this.volume.lut,
      },
      this.solver.uniforms,
      this.solver.res,
      this.params.domainSize,
      Math.max(1, Math.round(this.params.sparkCount)),
    );
    if (!this.obstacles) {
      this.obstacles = new Obstacles(
        this.solver.uniforms,
        this.camera,
        this.renderer.domElement,
        this.onGizmoDrag,
        MAX_SCENE_OBSTACLES,
      );
      this.immersive.attach(this.obstacles.group);
      this.scene.add(this.obstacles.helper);
      // Seeded sphere on desktop macOS only — visionOS uses palm boxes instead.
      if (!isVisionOS()) {
        this.addObstacle('sphere');
        const seeded = this.obstacles.targets()[0];
        if (seeded) {
          seeded.scale.setScalar(0.6);
          seeded.position.x += 0.1;
        }
      }
      this.obstacles.setMode(this.params.gizmoMode);
      this.params.obstacleCount = fireObstacleBudget(this.obstacles.count, this.handSolids.active);
      this.obstacles.onCountChanged = (count) => {
        this.params.obstacleCount = fireObstacleBudget(count, this.handSolids.active);
        this.rebuild();
        if (this.gui) refreshGui(this.gui);
      };
      this.obstacles.onModeChanged = (mode) => {
        this.params.gizmoMode = mode;
        if (this.gui) refreshGui(this.gui);
        this.onWorldUiChange();
      };
    } else {
      this.obstacles.bind(this.solver.uniforms);
    }

    this.immersive.attach(this.volume.mesh);
    this.immersive.attach(this.sparks.mesh);

    if (FLAME_AUDIO_ENABLED) {
      const g = gridOps(this.solver.res);
      const channels = this.solver.audioProbeChannels();
      this.audioProbes = [0, 1].map(
        (parity) =>
          new FieldProbe(
            this.renderer,
            g,
            this.solver!.probeTextures(parity),
            channels,
            AUDIO_PROBE_STRIDE,
          ),
      );
      this.audioProbeBusy = false;
      this.audioProbeAge = AUDIO_PROBE_PERIOD;
    } else {
      this.audioProbes = null;
    }

    this.solver.reset();
    this.sparks.reset(this.renderer);
    this.frame = 0;
  }

  private teardownSolver(): void {
    this.volume?.mesh.removeFromParent();
    this.sparks?.mesh.removeFromParent();
    this.sparks?.dispose();
    this.solver?.dispose();
    this.volume?.dispose();
    this.solver = null;
    this.volume = null;
    this.sparks = null;
    this.audioProbes = null;
    // Keep obstacles across rebuilds (same as fire main) — only unbind via bind() on next build.
  }

  private tickAudio(dt: number): void {
    if (!FLAME_AUDIO_ENABLED || !this.solver || !this.obstacles) return;

    let stir = 0;
    const slots = this.solver.uniforms.obstacles;
    const base = this.obstacles.count;
    for (let i = 0; i < MAX_HAND_SOLIDS; i++) {
      const v = slots[base + i]?.velocity.value;
      if (v) stir = Math.max(stir, v.length());
    }
    for (let i = 0; i < base; i++) {
      const v = slots[i]?.velocity.value;
      if (v) stir = Math.max(stir, v.length());
    }
    this.audio.setDrivers({ stir });

    this.audioProbeAge += dt;
    const probe = this.audioProbes?.[this.solver.currentParity];
    if (probe && !this.audioProbeBusy && this.audioProbeAge >= AUDIO_PROBE_PERIOD) {
      this.audioProbeAge = 0;
      this.audioProbeBusy = true;
      void probe
        .read()
        .then((stats) => {
          this.audioProbeBusy = false;
          this.audio.setDrivers({
            heat: stats.maxHeat?.value ?? 0,
            temperature: stats.maxTemperature?.value ?? 300,
            speed: stats.maxSpeed?.value ?? 0,
            expansion: stats.maxExpansion?.value ?? 0,
            fuel: stats.maxFuel?.value ?? 0,
          });
        })
        .catch(() => {
          this.audioProbeBusy = false;
        });
    }

    this.audio.update(dt);
  }

  private setGuiVisible(on: boolean): void {
    if (!this.gui) return;
    this.gui.domElement.style.display = on ? '' : 'none';
  }

  private setVisible(on: boolean): void {
    if (this.volume) this.volume.mesh.visible = on;
    if (this.sparks) {
      this.sparks.mesh.visible = on && this.params.sparksEnabled && !this.immersive.active;
    }
    if (this.obstacles) {
      this.obstacles.group.visible = on;
      // Helper visibility is owned by Obstacles.syncGizmo (hidden when detached / gizmo disabled).
      if (!on) this.obstacles.helper.visible = false;
    }
  }
}
