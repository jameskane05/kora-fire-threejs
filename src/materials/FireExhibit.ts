/**
 * Fire mount for the AVP sandbox — torch solver + volume + sparks + Kora GUI + desktop Obstacles.
 */
import { Scene, Vector3, type PerspectiveCamera, type WebGPURenderer } from 'three/webgpu';
import type GUI from 'lil-gui';
import { KoraSolver } from '../sim/KoraSolver';
import { createNoiseVolume, type NoiseVolume } from '../sim/noise';
import { defaultParams, type KoraParams } from '../sim/params';
import type { ObstacleKind } from '../sim/obstacles';
import { VolumeRenderer } from '../render/VolumeRenderer';
import { PRESETS, applyPreset, type Preset } from '../ui/presets';
import { QUALITY, QUALITY_TIERS, applyQuality, type Quality } from '../ui/quality';
import { createGui, refreshGui } from '../ui/gui';
import { Sparks } from '../particles/Sparks';
import { Obstacles, type GizmoMode } from '../scene/Obstacles';
import { DEFAULT_INTENSITY, type Environment, type EnvironmentName } from '../scene/Environment';
import type { ImmersiveMode } from '../xr/ImmersiveMode';

/** Immersive floor: dual ~2k eyes cannot carry desktop raymarch or a high quality tier. */
const IMMERSIVE_QUALITY: Quality = 'performance';
const IMMERSIVE_RAYMARCH_STEPS = 32;

export const FIRE_PLACEMENT = {
  distance: 1.15,
  height: 1.25,
  /** Smaller on-screen footprint than the old 0.85 — raymarch cost scales with fragments. */
  framedSize: 0.5,
  /** Same as sand/goo/water: pinch is for colliders, not spinning the domain. */
  turntable: false,
} as const;

export class FireExhibit {
  private solver: KoraSolver | null = null;
  private volume: VolumeRenderer | null = null;
  private sparks: Sparks | null = null;
  private noise: NoiseVolume | null = null;
  private obstacles: Obstacles | null = null;
  private params: KoraParams = applyQuality(
    applyPreset({ ...defaultParams }, PRESETS[0]),
    'performance',
  );
  private gui: GUI | null = null;
  private frame = 0;
  private active = false;
  private ready = false;
  private qualityBeforeXR: Quality | null = null;
  private raymarchBeforeXR: number | null = null;
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
    if (on) {
      this.immersive.setDomainSize(this.params.domainSize);
      this.immersive.setPlacement({ ...FIRE_PLACEMENT });
      this.environment.setIntensity(this.params.backgroundIntensity);
      void this.environment.set(this.params.environment);
      this.obstacles?.setGizmoEnabled(!this.immersive.active);
      if (this.obstacles) this.immersive.setManipulator(this.obstacles);
    } else {
      // Keep selection so re-entering fire re-attaches the gizmo to the same collider.
      this.obstacles?.setGizmoEnabled(false);
    }
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

    // Match fire.html: step the tier down for the session. Raymarch alone is not enough if the
    // GUI was left on high/balanced (96³ + MacCormack survives otherwise).
    const order = QUALITY_TIERS.indexOf(this.params.quality);
    if (order < QUALITY_TIERS.indexOf(IMMERSIVE_QUALITY)) {
      this.qualityBeforeXR = this.params.quality;
      this.params = applyQuality(this.params, IMMERSIVE_QUALITY);
      this.rebuild();
      if (this.gui) refreshGui(this.gui);
    }

    this.raymarchBeforeXR = this.params.raymarchSteps;
    this.params.raymarchSteps = Math.min(this.params.raymarchSteps, IMMERSIVE_RAYMARCH_STEPS);
    this.volume?.update(this.params, this.frame);

    // Sparks are a second dual-eye pass the session cannot afford (same policy as fire.html).
    if (this.sparks) this.sparks.mesh.visible = false;
  }

  exitImmersive(): void {
    if (this.active) this.obstacles?.setGizmoEnabled(true);

    if (this.raymarchBeforeXR !== null) {
      this.params.raymarchSteps = this.raymarchBeforeXR;
      this.raymarchBeforeXR = null;
      this.volume?.update(this.params, this.frame);
    }

    if (this.qualityBeforeXR) {
      this.params = applyQuality(this.params, this.qualityBeforeXR);
      this.qualityBeforeXR = null;
      this.rebuild();
      if (this.gui) refreshGui(this.gui);
    }

    if (this.sparks) this.sparks.mesh.visible = this.active && this.params.sparksEnabled;
  }

  step(dt: number): void {
    if (!this.active || !this.solver || !this.volume || !this.sparks) return;
    this.obstacles?.update(dt);
    this.solver.step(dt);
    this.volume.update(this.params, this.frame);
    // Dual-eye overdraw for embers is dropped while presenting.
    if (this.params.sparksEnabled && !this.immersive.active) {
      this.sparks.step(this.renderer, this.solver.currentParity, dt, this.frame);
    }
    this.frame++;
  }

  dispose(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    this.gui?.destroy();
    this.gui = null;
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
      onStructuralChange: () => this.rebuild(),
      onPreset: (preset: Preset) => {
        this.params = applyPreset(this.params, preset);
        this.rebuild();
        this.mountGui();
        refreshGui(this.gui!);
      },
      onReset: () => this.rebuild(),
      onDetonate: () => this.solver?.detonate(1.0),
      onProbe: () => undefined,
      onProfile: () => undefined,
      onQuality: (q: Quality) => {
        this.params = applyQuality(this.params, q);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, QUALITY[q].pixelRatio));
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

  private rebuild(): void {
    const wasVisible = this.active;
    this.teardownSolver();
    this.buildSolver();
    this.setVisible(wasVisible);
    if (wasVisible) {
      this.immersive.setDomainSize(this.params.domainSize);
      this.immersive.setPlacement({ ...FIRE_PLACEMENT });
      if (this.obstacles) this.immersive.setManipulator(this.obstacles);
    }
  }

  private buildSolver(): void {
    if (!this.noise) this.noise = createNoiseVolume(32);
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
      );
      this.immersive.attach(this.obstacles.group);
      this.scene.add(this.obstacles.helper);
      // Seed before wiring count→rebuild, or the first add would recurse into buildSolver.
      this.addObstacle('sphere');
      const seeded = this.obstacles.targets()[0];
      if (seeded) {
        seeded.scale.setScalar(0.6);
        seeded.position.x += 0.1;
      }
      // Leave the gizmo on the seeded sphere — select(null) parks the helper at the scene origin.
      this.obstacles.setMode(this.params.gizmoMode);
      this.params.obstacleCount = this.obstacles.count;
      this.obstacles.onCountChanged = (count) => {
        this.params.obstacleCount = count;
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
    // Keep obstacles across rebuilds (same as fire main) — only unbind via bind() on next build.
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
