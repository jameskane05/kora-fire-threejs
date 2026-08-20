import type { WebGPURenderer } from 'three/webgpu';
import type {
  Inspector,
  InspectorParametersGroup,
} from 'three/addons/inspector/Inspector.js';
import type { BoxSpawner } from './boxSpawner';

type InspectorRenderer = WebGPURenderer & {
  inspector: Inspector & {
    createParameters: (label: string) => InspectorParametersGroup;
  };
};

type EmitterUIState = {
  spawned: string;
  enabled: boolean;
  rate: number;
  x: number;
  y: number;
  z: number;
  randomRotation: boolean;
  rotationJitter: number;
  debugTimingEnabled: boolean;
  debugBehaviorEnabled: boolean;
  showContactPoints: boolean;
  shadowsEnabled: boolean;
  paused: boolean;
  logEveryStep: boolean;
  timeScale: number;
  friction: number;
  dualUpdateBeta: number;
  regularizationAlpha: number;
  penaltyDecayGamma: number;
  solverIterations: number;
  stackPreset: StackPreset;
  emitOne: () => void;
  emitTen: () => void;
  stepOnce: () => void;
  resetSimulation: () => void;
  resetDefaults: () => void;
};

export type StackPreset =
  | 'single-5'
  | 'single-10'
  | 'wall-10x10x1'
  | 'line-1x1x1'
  | 'line-2x1x1'
  | 'line-3x1x1'
  | 'line-10x1x1'
  | 'bridge-demo'
  | 'bridge-demo-empty'
  | 'bridge-demo-fixed'
  | 'soft-body'
  | 'bunny-soft-body'
  | 'spring-demo'
  | 'spring-ratio'
  | 'rope-demo'
  | 'heavy-rope-demo'
  | 'sphere-demo'
  | 'ragdoll-cloth-demo'
  | 'ragdoll-carousel-demo'
  | 'jointed-sandbox-demo'
  | 'cloth-boxes-demo'
  | 'coliseum-12k'
  | 'coliseum-50k'
  | 'coliseum-64k'
  | 'pyramid-8'
  | 'waterfall-gutter'
  | 'grid-1000x10'
  | 'grid-64x10'
  | 'dominoes-demo'
  | 'dominoes-advanced-demo'
  | 'newtons-cradles-demo'
  | 'ragdoll-avalanche-demo'
  | 'cliff-plateau-demo';

export type EmitterResetDefaults = {
  enabled: boolean;
  rate: number;
  x: number;
  y: number;
  z: number;
  randomRotation: boolean;
  rotationJitter: number;
  debugTimingEnabled: boolean;
  debugBehaviorEnabled: boolean;
  showContactPoints: boolean;
  shadowsEnabled: boolean;
  paused: boolean;
  logEveryStep: boolean;
  timeScale: number;
  friction: number;
  dualUpdateBeta: number;
  regularizationAlpha: number;
  penaltyDecayGamma: number;
  solverIterations: number;
  stackPreset: StackPreset;
};

export type EmitterPanelOptions = {
  debugTimingEnabled?: boolean;
  onDebugTimingEnabledChange?: (enabled: boolean) => void;
  debugBehaviorEnabled?: boolean;
  onDebugBehaviorEnabledChange?: (enabled: boolean) => void;
  showContactPoints?: boolean;
  onShowContactPointsChange?: (enabled: boolean) => void;
  shadowsEnabled?: boolean;
  onShadowsEnabledChange?: (enabled: boolean) => void;
  paused?: boolean;
  onPausedChange?: (paused: boolean) => void;
  logEveryStep?: boolean;
  onLogEveryStepChange?: (enabled: boolean) => void;
  onStepOnce?: () => void;
  onResetSimulation?: () => void;
  timeScale?: number;
  onTimeScaleChange?: (timeScale: number) => void;
  friction?: number;
  onFrictionChange?: (friction: number) => void;
  dualUpdateBeta?: number;
  onDualUpdateBetaChange?: (beta: number) => void;
  getDualUpdateBeta?: () => number;
  regularizationAlpha?: number;
  onRegularizationAlphaChange?: (alpha: number) => void;
  getRegularizationAlpha?: () => number;
  penaltyDecayGamma?: number;
  onPenaltyDecayGammaChange?: (gamma: number) => void;
  getPenaltyDecayGamma?: () => number;
  solverIterations?: number;
  onSolverIterationsChange?: (iterations: number) => void;
  getSolverIterations?: () => number;
  stackPreset?: StackPreset;
  onStackPresetChange?: (preset: StackPreset) => void;
  defaults?: Partial<EmitterResetDefaults>;
};

function hasInspector(renderer?: WebGPURenderer): renderer is InspectorRenderer {
  return Boolean(
    renderer &&
    (renderer as any).inspector &&
    typeof (renderer as any).inspector.createParameters === 'function',
  );
}

export class EmitterPanel {
  private root: HTMLDivElement | null = null;
  private countValue: HTMLSpanElement | null = null;
  private readonly usingInspector: boolean;
  private readonly state: EmitterUIState;
  private readonly defaults: EmitterResetDefaults;
  private readonly onDebugTimingEnabledChange: ((enabled: boolean) => void) | null;
  private readonly onDebugBehaviorEnabledChange: ((enabled: boolean) => void) | null;
  private readonly onShowContactPointsChange: ((enabled: boolean) => void) | null;
  private readonly onShadowsEnabledChange: ((enabled: boolean) => void) | null;
  private readonly onPausedChange: ((paused: boolean) => void) | null;
  private readonly onLogEveryStepChange: ((enabled: boolean) => void) | null;
  private readonly onStepOnce: (() => void) | null;
  private readonly onResetSimulation: (() => void) | null;
  private readonly onTimeScaleChange: ((timeScale: number) => void) | null;
  private readonly onFrictionChange: ((friction: number) => void) | null;
  private readonly onDualUpdateBetaChange: ((beta: number) => void) | null;
  private readonly getDualUpdateBeta: (() => number) | null;
  private readonly onRegularizationAlphaChange: ((alpha: number) => void) | null;
  private readonly getRegularizationAlpha: (() => number) | null;
  private readonly onPenaltyDecayGammaChange: ((gamma: number) => void) | null;
  private readonly getPenaltyDecayGamma: (() => number) | null;
  private readonly onSolverIterationsChange: ((iterations: number) => void) | null;
  private readonly getSolverIterations: (() => number) | null;
  private readonly onStackPresetChange: ((preset: StackPreset) => void) | null;
  private dualUpdateBetaInput: HTMLInputElement | null = null;
  private regularizationAlphaInput: HTMLInputElement | null = null;
  private penaltyDecayGammaInput: HTMLInputElement | null = null;
  private solverIterationsInput: HTMLInputElement | null = null;
  private spawner: BoxSpawner;

  constructor(
    spawner: BoxSpawner,
    renderer?: WebGPURenderer,
    options?: EmitterPanelOptions,
  ) {
    this.spawner = spawner;
    this.onDebugTimingEnabledChange = options?.onDebugTimingEnabledChange ?? null;
    this.onDebugBehaviorEnabledChange = options?.onDebugBehaviorEnabledChange ?? null;
    this.onShowContactPointsChange = options?.onShowContactPointsChange ?? null;
    this.onShadowsEnabledChange = options?.onShadowsEnabledChange ?? null;
    this.onPausedChange = options?.onPausedChange ?? null;
    this.onLogEveryStepChange = options?.onLogEveryStepChange ?? null;
    this.onStepOnce = options?.onStepOnce ?? null;
    this.onResetSimulation = options?.onResetSimulation ?? null;
    this.onTimeScaleChange = options?.onTimeScaleChange ?? null;
    this.onFrictionChange = options?.onFrictionChange ?? null;
    this.onDualUpdateBetaChange = options?.onDualUpdateBetaChange ?? null;
    this.getDualUpdateBeta = options?.getDualUpdateBeta ?? null;
    this.onRegularizationAlphaChange = options?.onRegularizationAlphaChange ?? null;
    this.getRegularizationAlpha = options?.getRegularizationAlpha ?? null;
    this.onPenaltyDecayGammaChange = options?.onPenaltyDecayGammaChange ?? null;
    this.getPenaltyDecayGamma = options?.getPenaltyDecayGamma ?? null;
    this.onSolverIterationsChange = options?.onSolverIterationsChange ?? null;
    this.getSolverIterations = options?.getSolverIterations ?? null;
    this.onStackPresetChange = options?.onStackPresetChange ?? null;

    const emitter = this.spawner.getEmitter();
    this.state = {
      spawned: '',
      enabled: emitter.enabled,
      rate: emitter.rate,
      x: emitter.x,
      y: emitter.y,
      z: emitter.z,
      randomRotation: emitter.randomRotation,
      rotationJitter: emitter.rotationJitter,
      debugTimingEnabled: options?.debugTimingEnabled ?? false,
      debugBehaviorEnabled: options?.debugBehaviorEnabled ?? false,
      showContactPoints: options?.showContactPoints ?? false,
      shadowsEnabled: options?.shadowsEnabled ?? false,
      paused: options?.paused ?? false,
      logEveryStep: options?.logEveryStep ?? false,
      timeScale: options?.timeScale ?? 1.0,
      friction: options?.friction ?? 0.75,
      dualUpdateBeta: options?.dualUpdateBeta ?? 10000.0,
      regularizationAlpha: options?.regularizationAlpha ?? 0.95,
      penaltyDecayGamma: options?.penaltyDecayGamma ?? 0.99,
      solverIterations: options?.solverIterations ?? 4,
      stackPreset: options?.stackPreset ?? 'single-5',
      emitOne: () => {
        this.spawner.emit(1);
        this.update();
      },
      emitTen: () => {
        this.spawner.emit(10);
        this.update();
      },
      stepOnce: () => {
        this.onStepOnce?.();
      },
      resetSimulation: () => {
        this.onResetSimulation?.();
      },
      resetDefaults: () => {
        this.resetToDefaults();
      },
    };

    const providedDefaults = options?.defaults ?? {};
    this.defaults = {
      enabled: providedDefaults.enabled ?? this.state.enabled,
      rate: providedDefaults.rate ?? this.state.rate,
      x: providedDefaults.x ?? this.state.x,
      y: providedDefaults.y ?? this.state.y,
      z: providedDefaults.z ?? this.state.z,
      randomRotation: providedDefaults.randomRotation ?? this.state.randomRotation,
      rotationJitter: providedDefaults.rotationJitter ?? this.state.rotationJitter,
      debugTimingEnabled: providedDefaults.debugTimingEnabled ?? this.state.debugTimingEnabled,
      debugBehaviorEnabled: providedDefaults.debugBehaviorEnabled ?? this.state.debugBehaviorEnabled,
      showContactPoints: providedDefaults.showContactPoints ?? this.state.showContactPoints,
      shadowsEnabled: providedDefaults.shadowsEnabled ?? this.state.shadowsEnabled,
      paused: providedDefaults.paused ?? this.state.paused,
      logEveryStep: providedDefaults.logEveryStep ?? this.state.logEveryStep,
      timeScale: providedDefaults.timeScale ?? this.state.timeScale,
      friction: providedDefaults.friction ?? this.state.friction,
      dualUpdateBeta: providedDefaults.dualUpdateBeta ?? this.state.dualUpdateBeta,
      regularizationAlpha: providedDefaults.regularizationAlpha ?? this.state.regularizationAlpha,
      penaltyDecayGamma: providedDefaults.penaltyDecayGamma ?? this.state.penaltyDecayGamma,
      solverIterations: providedDefaults.solverIterations ?? this.state.solverIterations,
      stackPreset: providedDefaults.stackPreset ?? this.state.stackPreset,
    };

    if (hasInspector(renderer)) {
      this.usingInspector = true;
      this.initInspector(renderer);
    } else {
      this.usingInspector = false;
      const ui = this.initDom();
      this.root = ui.root;
      this.countValue = ui.countValue;
    }

    this.update();
  }

  setSpawner(spawner: BoxSpawner): void {
    this.spawner = spawner;
    this.update();
  }

  update(): void {
    const emitter = this.spawner.getEmitter();
    this.state.spawned = `${this.spawner.getSpawnedCount()} / ${this.spawner.getCapacity()}`;
    this.state.enabled = emitter.enabled;
    this.state.rate = emitter.rate;
    this.state.x = emitter.x;
    this.state.y = emitter.y;
    this.state.z = emitter.z;
    this.state.randomRotation = emitter.randomRotation;
    this.state.rotationJitter = emitter.rotationJitter;

    if (!this.usingInspector && this.getSolverIterations) {
      this.state.solverIterations = this.getSolverIterations();
    }
    if (!this.usingInspector && this.getDualUpdateBeta) {
      this.state.dualUpdateBeta = this.getDualUpdateBeta();
    }
    if (!this.usingInspector && this.getRegularizationAlpha) {
      this.state.regularizationAlpha = this.getRegularizationAlpha();
    }
    if (!this.usingInspector && this.getPenaltyDecayGamma) {
      this.state.penaltyDecayGamma = this.getPenaltyDecayGamma();
    }
    if (!this.usingInspector && this.countValue) {
      this.countValue.textContent = this.state.spawned;
    }
    if (
      !this.usingInspector
      && this.dualUpdateBetaInput
      && document.activeElement !== this.dualUpdateBetaInput
    ) {
      this.dualUpdateBetaInput.value = this.state.dualUpdateBeta.toString();
    }
    if (
      !this.usingInspector
      && this.regularizationAlphaInput
      && document.activeElement !== this.regularizationAlphaInput
    ) {
      this.regularizationAlphaInput.value = this.state.regularizationAlpha.toString();
    }
    if (
      !this.usingInspector
      && this.penaltyDecayGammaInput
      && document.activeElement !== this.penaltyDecayGammaInput
    ) {
      this.penaltyDecayGammaInput.value = this.state.penaltyDecayGamma.toString();
    }
    if (
      !this.usingInspector
      && this.solverIterationsInput
      && document.activeElement !== this.solverIterationsInput
    ) {
      this.solverIterationsInput.value = this.state.solverIterations.toString();
    }
  }

  private initInspector(renderer: InspectorRenderer): void {
    const controls = renderer.inspector.createParameters('Settings');
    const physicsControls = controls.addFolder?.('Physics') ?? controls;
    const emitterControls = controls.addFolder?.('Emitter') ?? controls;
    const actionsControls = controls.addFolder?.('Actions') ?? controls;
    const add = (group: any, ...args: [any, string, ...any[]]) => (group as any).add(...args) as any;

    const stackPresetOptions = {
      'Stack 5x5x5': 'single-5',
      'Stack 10x10x10': 'single-10',
      'Stack 10x10x1': 'wall-10x10x1',
      'Stack 1x1x1': 'line-1x1x1',
      'Stack 2x1x1': 'line-2x1x1',
      'Stack 3x1x1': 'line-3x1x1',
      'Stack 10x1x1': 'line-10x1x1',
      'Bridge': 'bridge-demo',
      'Bridge Empty': 'bridge-demo-empty',
      'Bridge Fixed': 'bridge-demo-fixed',
      'Soft Body': 'soft-body',
      'Soft Body Bunny': 'bunny-soft-body',
      'Spring': 'spring-demo',
      'Spring Ratio': 'spring-ratio',
      'Rope': 'rope-demo',
      'Heavy Rope': 'heavy-rope-demo',
      'Sphere': 'sphere-demo',
      'Ragdoll Cloth': 'ragdoll-cloth-demo',
      'Ragdoll Carousel': 'ragdoll-carousel-demo',
      'Jointed Sandbox': 'jointed-sandbox-demo',
      'Cloth Boxes': 'cloth-boxes-demo',
      'Coliseum 12k': 'coliseum-12k',
      'Coliseum 50k': 'coliseum-50k',
      'Coliseum Max 64k': 'coliseum-64k',
      'Pyramid 8 (2D)': 'pyramid-8',
      'Waterfall Gutter': 'waterfall-gutter',
      '1000 x (10x1x1)': 'grid-1000x10',
      '64 x (10x10x10)': 'grid-64x10',
      'Dominoes': 'dominoes-demo',
      'Dominoes Advanced': 'dominoes-advanced-demo',
      'Newton\'s Cradles': 'newtons-cradles-demo',
      'Ragdoll Avalanche': 'ragdoll-avalanche-demo',
    };
    const stackPresetControl = add(physicsControls, this.state, 'stackPreset', stackPresetOptions);
    stackPresetControl?.name?.('Scene');
    stackPresetControl?.onChange?.((value: any) => {
      const preset = String(value) as StackPreset;
      this.state.stackPreset = preset;
      this.onStackPresetChange?.(preset);
    });
    stackPresetControl?.listen?.();

    const debugTimingControl = add(physicsControls, this.state, 'debugTimingEnabled');
    debugTimingControl?.name?.('Debug Timing');
    debugTimingControl?.onChange?.((value: any) => {
      const enabled = Boolean(value);
      this.state.debugTimingEnabled = enabled;
      this.onDebugTimingEnabledChange?.(enabled);
    });
    debugTimingControl?.listen?.();

    const debugBehaviorControl = add(physicsControls, this.state, 'debugBehaviorEnabled');
    debugBehaviorControl?.name?.('Debug Behavior');
    debugBehaviorControl?.onChange?.((value: any) => {
      const enabled = Boolean(value);
      this.state.debugBehaviorEnabled = enabled;
      this.onDebugBehaviorEnabledChange?.(enabled);
    });
    debugBehaviorControl?.listen?.();

    const showContactPointsControl = add(physicsControls, this.state, 'showContactPoints');
    showContactPointsControl?.name?.('Show contact dots');
    showContactPointsControl?.onChange?.((value: any) => {
      const enabled = Boolean(value);
      this.state.showContactPoints = enabled;
      this.onShowContactPointsChange?.(enabled);
    });
    showContactPointsControl?.listen?.();

    const shadowsEnabledControl = add(physicsControls, this.state, 'shadowsEnabled');
    shadowsEnabledControl?.name?.('Shadows');
    shadowsEnabledControl?.onChange?.((value: any) => {
      const enabled = Boolean(value);
      this.state.shadowsEnabled = enabled;
      this.onShadowsEnabledChange?.(enabled);
    });
    shadowsEnabledControl?.listen?.();

    const pausedControl = add(physicsControls, this.state, 'paused');
    pausedControl?.name?.('Paused');
    pausedControl?.onChange?.((value: any) => {
      const paused = Boolean(value);
      this.state.paused = paused;
      this.onPausedChange?.(paused);
    });
    pausedControl?.listen?.();

    const logEveryStepControl = add(physicsControls, this.state, 'logEveryStep');
    logEveryStepControl?.name?.('Log every step');
    logEveryStepControl?.onChange?.((value: any) => {
      const enabled = Boolean(value);
      this.state.logEveryStep = enabled;
      this.onLogEveryStepChange?.(enabled);
    });
    logEveryStepControl?.listen?.();

    const timeScaleControl = add(physicsControls, this.state, 'timeScale', 0.05, 2.0, 0.01);
    timeScaleControl?.name?.('Time scale (x)');
    timeScaleControl?.onChange?.((value: any) => {
      const scale = Math.max(0.05, Math.min(2.0, Number(value)));
      this.state.timeScale = scale;
      this.onTimeScaleChange?.(scale);
    });
    timeScaleControl?.listen?.();

    const frictionControl = add(physicsControls, this.state, 'friction', 0.0, 2.0, 0.01);
    frictionControl?.name?.('Friction');
    frictionControl?.onChange?.((value: any) => {
      const friction = Math.max(0.0, Math.min(2.0, Number(value)));
      this.state.friction = friction;
      this.onFrictionChange?.(friction);
    });
    frictionControl?.listen?.();

    const dualUpdateBetaControl = add(physicsControls, this.state, 'dualUpdateBeta', 0.0, 1_000_000.0, 1.0);
    dualUpdateBetaControl?.name?.('Dual beta');
    dualUpdateBetaControl?.onChange?.((value: any) => {
      const beta = Math.max(0.0, Number(value) || 0.0);
      this.state.dualUpdateBeta = beta;
      this.onDualUpdateBetaChange?.(beta);
    });
    dualUpdateBetaControl?.listen?.();

    const regularizationAlphaControl = add(physicsControls, this.state, 'regularizationAlpha', 0.0, 1.0, 0.001);
    regularizationAlphaControl?.name?.('Regularization alpha');
    regularizationAlphaControl?.onChange?.((value: any) => {
      const alpha = Math.max(0.0, Math.min(1.0, Number(value) || 0.0));
      this.state.regularizationAlpha = alpha;
      this.onRegularizationAlphaChange?.(alpha);
    });
    regularizationAlphaControl?.listen?.();

    const penaltyDecayGammaControl = add(physicsControls, this.state, 'penaltyDecayGamma', 0.0, 1.0, 0.001);
    penaltyDecayGammaControl?.name?.('Penalty gamma');
    penaltyDecayGammaControl?.onChange?.((value: any) => {
      const gamma = Math.max(0.0, Math.min(1.0, Number(value) || 0.0));
      this.state.penaltyDecayGamma = gamma;
      this.onPenaltyDecayGammaChange?.(gamma);
    });
    penaltyDecayGammaControl?.listen?.();

    const solverIterationsControl = add(physicsControls, this.state, 'solverIterations', 1, 64, 1);
    solverIterationsControl?.name?.('Solver iterations');
    solverIterationsControl?.onChange?.((value: any) => {
      const iterations = Math.max(1, Math.min(64, Math.floor(Number(value) || 1)));
      this.state.solverIterations = iterations;
      this.onSolverIterationsChange?.(iterations);
    });
    solverIterationsControl?.listen?.();

    const enabledControl = add(emitterControls, this.state, 'enabled');
    enabledControl?.name?.('Enabled');
    enabledControl?.onChange?.((value: any) => this.spawner.setEmitter({ enabled: Boolean(value) }));
    enabledControl?.listen?.();

    const rateControl = add(emitterControls, this.state, 'rate', 0, 240, 1.0);
    rateControl?.name?.('Rate (boxes/s)');
    rateControl?.onChange?.((value: any) => this.spawner.setEmitter({ rate: Number(value) }));
    rateControl?.listen?.();

    const xControl = add(emitterControls, this.state, 'x', -20, 20, 0.1);
    xControl?.name?.('X');
    xControl?.onChange?.((value: any) => this.spawner.setEmitter({ x: Number(value) }));
    xControl?.listen?.();

    const yControl = add(emitterControls, this.state, 'y', 0.5, 50, 0.1);
    yControl?.name?.('Y');
    yControl?.onChange?.((value: any) => this.spawner.setEmitter({ y: Number(value) }));
    yControl?.listen?.();

    const zControl = add(emitterControls, this.state, 'z', -20, 20, 0.1);
    zControl?.name?.('Z');
    zControl?.onChange?.((value: any) => this.spawner.setEmitter({ z: Number(value) }));
    zControl?.listen?.();

    const randomRotationControl = add(emitterControls, this.state, 'randomRotation');
    randomRotationControl?.name?.('Random rot');
    randomRotationControl?.onChange?.((value: any) => this.spawner.setEmitter({ randomRotation: Boolean(value) }));
    randomRotationControl?.listen?.();

    const jitterControl = add(emitterControls, this.state, 'rotationJitter', 0, 1.5, 0.01);
    jitterControl?.name?.('Rot jitter');
    jitterControl?.onChange?.((value: any) => this.spawner.setEmitter({ rotationJitter: Number(value) }));
    jitterControl?.listen?.();

    const emitOneControl = add(actionsControls, this.state, 'emitOne');
    emitOneControl?.name?.('Emit 1');
    const emitTenControl = add(actionsControls, this.state, 'emitTen');
    emitTenControl?.name?.('Emit 10');
    const stepOnceControl = add(actionsControls, this.state, 'stepOnce');
    stepOnceControl?.name?.('Step once');
    const resetSimulationControl = add(actionsControls, this.state, 'resetSimulation');
    resetSimulationControl?.name?.('Reset sim (R)');
    const resetDefaultsControl = add(actionsControls, this.state, 'resetDefaults');
    resetDefaultsControl?.name?.('Reset defaults');
  }

  private initDom(): { root: HTMLDivElement; countValue: HTMLSpanElement } {
    const state = this.spawner.getEmitter();
    const root = document.createElement('div');
    Object.assign(root.style, {
      position: 'absolute',
      top: '10px',
      right: '10px',
      width: '280px',
      color: '#fff',
      fontFamily: 'monospace',
      fontSize: '12px',
      background: 'rgba(0, 0, 0, 0.72)',
      padding: '10px 12px',
      borderRadius: '6px',
      lineHeight: '1.4',
      zIndex: '10',
    });

    const title = document.createElement('div');
    title.textContent = 'Controls';
    title.style.fontWeight = '700';
    title.style.marginBottom = '8px';
    root.appendChild(title);

    this.addSection(root, 'Simulation');
    this.addSelect(root, 'Scene', this.state.stackPreset, [
      { label: 'Stack 5x5x5', value: 'single-5' },
      { label: 'Stack 10x10x10', value: 'single-10' },
      { label: 'Stack 10x10x1', value: 'wall-10x10x1' },
      { label: 'Stack 1x1x1', value: 'line-1x1x1' },
      { label: 'Stack 2x1x1', value: 'line-2x1x1' },
      { label: 'Stack 3x1x1', value: 'line-3x1x1' },
      { label: 'Stack 10x1x1', value: 'line-10x1x1' },
      { label: 'Bridge', value: 'bridge-demo' },
      { label: 'Bridge Empty', value: 'bridge-demo-empty' },
      { label: 'Bridge Fixed', value: 'bridge-demo-fixed' },
      { label: 'Soft Body', value: 'soft-body' },
      { label: 'Soft Body Bunny', value: 'bunny-soft-body' },
      { label: 'Spring', value: 'spring-demo' },
      { label: 'Spring Ratio', value: 'spring-ratio' },
      { label: 'Rope', value: 'rope-demo' },
      { label: 'Heavy Rope', value: 'heavy-rope-demo' },
      { label: 'Sphere', value: 'sphere-demo' },
      { label: 'Ragdoll Cloth', value: 'ragdoll-cloth-demo' },
      { label: 'Ragdoll Carousel', value: 'ragdoll-carousel-demo' },
      { label: 'Jointed Sandbox', value: 'jointed-sandbox-demo' },
      { label: 'Cloth Boxes', value: 'cloth-boxes-demo' },
      { label: 'Coliseum 12k', value: 'coliseum-12k' },
      { label: 'Coliseum 50k', value: 'coliseum-50k' },
      { label: 'Coliseum Max 64k', value: 'coliseum-64k' },
      { label: 'Pyramid 8 (2D)', value: 'pyramid-8' },
      { label: 'Waterfall Gutter', value: 'waterfall-gutter' },
      { label: '1000 x (10x1x1)', value: 'grid-1000x10' },
      { label: '64 x (10x10x10)', value: 'grid-64x10' },
      { label: 'Dominoes', value: 'dominoes-demo' },
      { label: 'Dominoes Advanced', value: 'dominoes-advanced-demo' },
      { label: 'Newton\'s Cradles', value: 'newtons-cradles-demo' },
      { label: 'Ragdoll Avalanche', value: 'ragdoll-avalanche-demo' },
    ], (value) => {
      this.state.stackPreset = value;
      this.onStackPresetChange?.(value);
    });
    this.addCheckbox(root, 'Debug Timing', this.state.debugTimingEnabled, (value) => {
      this.state.debugTimingEnabled = value;
      this.onDebugTimingEnabledChange?.(value);
    });
    this.addCheckbox(root, 'Debug Behavior', this.state.debugBehaviorEnabled, (value) => {
      this.state.debugBehaviorEnabled = value;
      this.onDebugBehaviorEnabledChange?.(value);
    });
    this.addCheckbox(root, 'Show contact dots', this.state.showContactPoints, (value) => {
      this.state.showContactPoints = value;
      this.onShowContactPointsChange?.(value);
    });
    this.addCheckbox(root, 'Shadows', this.state.shadowsEnabled, (value) => {
      this.state.shadowsEnabled = value;
      this.onShadowsEnabledChange?.(value);
    });
    this.addCheckbox(root, 'Paused', this.state.paused, (value) => {
      this.state.paused = value;
      this.onPausedChange?.(value);
    });
    this.addCheckbox(root, 'Log every step', this.state.logEveryStep, (value) => {
      this.state.logEveryStep = value;
      this.onLogEveryStepChange?.(value);
    });
    this.addNumber(root, 'Time scale (x)', this.state.timeScale, 0.05, 2.0, 0.01, (value) => {
      this.state.timeScale = value;
      this.onTimeScaleChange?.(value);
    });
    this.addNumber(root, 'Friction', this.state.friction, 0.0, 2.0, 0.01, (value) => {
      this.state.friction = value;
      this.onFrictionChange?.(value);
    });
    this.dualUpdateBetaInput = this.addNumber(root, 'Dual beta', this.state.dualUpdateBeta, 0.0, 1_000_000.0, 1, (value) => {
      const beta = Math.max(0.0, value);
      this.state.dualUpdateBeta = beta;
      this.onDualUpdateBetaChange?.(beta);
    });
    this.regularizationAlphaInput = this.addNumber(root, 'Regularization alpha', this.state.regularizationAlpha, 0.0, 1.0, 0.001, (value) => {
      const alpha = Math.max(0.0, Math.min(1.0, value));
      this.state.regularizationAlpha = alpha;
      this.onRegularizationAlphaChange?.(alpha);
    });
    this.penaltyDecayGammaInput = this.addNumber(root, 'Penalty gamma', this.state.penaltyDecayGamma, 0.0, 1.0, 0.001, (value) => {
      const gamma = Math.max(0.0, Math.min(1.0, value));
      this.state.penaltyDecayGamma = gamma;
      this.onPenaltyDecayGammaChange?.(gamma);
    });
    this.solverIterationsInput = this.addNumber(root, 'Solver iterations', this.state.solverIterations, 1, 64, 1, (value) => {
      const iterations = Math.max(1, Math.min(64, Math.floor(value)));
      this.state.solverIterations = iterations;
      this.onSolverIterationsChange?.(iterations);
    });
    this.addSection(root, 'Emitter');
    const countValue = document.createElement('span');
    this.addRow(root, 'Spawned', countValue);
    this.addCheckbox(root, 'Enabled', state.enabled, (value) => this.spawner.setEmitter({ enabled: value }));
    this.addNumber(root, 'Rate (boxes/s)', state.rate, 0, 240, 1.0, (value) => this.spawner.setEmitter({ rate: value }));
    this.addNumber(root, 'X', state.x, -20, 20, 0.1, (value) => this.spawner.setEmitter({ x: value }));
    this.addNumber(root, 'Y', state.y, 0.5, 50, 0.1, (value) => this.spawner.setEmitter({ y: value }));
    this.addNumber(root, 'Z', state.z, -20, 20, 0.1, (value) => this.spawner.setEmitter({ z: value }));
    this.addCheckbox(root, 'Random rot', state.randomRotation, (value) => this.spawner.setEmitter({ randomRotation: value }));
    this.addNumber(root, 'Rot jitter', state.rotationJitter, 0, 1.5, 0.01, (value) => this.spawner.setEmitter({ rotationJitter: value }));

    const buttons = document.createElement('div');
    Object.assign(buttons.style, {
      display: 'flex',
      gap: '8px',
      marginTop: '8px',
    });

    const emitOne = this.makeButton('Emit 1', () => this.spawner.emit(1));
    const emitTen = this.makeButton('Emit 10', () => this.spawner.emit(10));
    const stepOnce = this.makeButton('Step once', () => this.onStepOnce?.());
    const resetSimulation = this.makeButton('Reset sim (R)', () => this.onResetSimulation?.());
    const resetDefaults = this.makeButton('Reset defaults', () => this.resetToDefaults());
    buttons.appendChild(emitOne);
    buttons.appendChild(emitTen);
    buttons.appendChild(stepOnce);
    buttons.appendChild(resetSimulation);
    buttons.appendChild(resetDefaults);
    root.appendChild(buttons);

    document.body.appendChild(root);
    return { root, countValue };
  }

  private addSection(root: HTMLDivElement, label: string): void {
    const section = document.createElement('div');
    section.textContent = label;
    Object.assign(section.style, {
      fontWeight: '700',
      marginTop: '10px',
      marginBottom: '6px',
      color: '#ddd',
    });
    root.appendChild(section);
  }

  private addRow(root: HTMLDivElement, label: string, valueNode: HTMLElement): void {
    const row = document.createElement('div');
    Object.assign(row.style, {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: '6px',
      gap: '8px',
    });

    const labelNode = document.createElement('label');
    labelNode.textContent = label;
    labelNode.style.flex = '1';

    valueNode.style.flex = '0 0 auto';

    row.appendChild(labelNode);
    row.appendChild(valueNode);
    root.appendChild(row);
  }

  private addCheckbox(
    root: HTMLDivElement,
    label: string,
    initialValue: boolean,
    onChange: (value: boolean) => void,
  ): void {
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = initialValue;
    input.addEventListener('change', () => onChange(input.checked));
    this.addRow(root, label, input);
  }

  private addNumber(
    root: HTMLDivElement,
    label: string,
    initialValue: number,
    min: number,
    max: number,
    step: number,
    onChange: (value: number) => void,
  ): HTMLInputElement {
    const input = document.createElement('input');
    input.type = 'number';
    input.value = initialValue.toString();
    input.min = min.toString();
    input.max = max.toString();
    input.step = step.toString();
    Object.assign(input.style, {
      width: '88px',
      fontFamily: 'monospace',
      fontSize: '12px',
      padding: '2px 4px',
    });

    const commit = () => {
      const raw = Number(input.value);
      const clamped = Number.isFinite(raw) ? Math.min(max, Math.max(min, raw)) : initialValue;
      input.value = clamped.toString();
      onChange(clamped);
    };

    input.addEventListener('change', commit);
    input.addEventListener('blur', commit);
    this.addRow(root, label, input);
    return input;
  }

  private addSelect(
    root: HTMLDivElement,
    label: string,
    initialValue: StackPreset,
    options: Array<{ label: string; value: StackPreset }>,
    onChange: (value: StackPreset) => void,
  ): HTMLSelectElement;

  private addSelect<T extends string>(
    root: HTMLDivElement,
    label: string,
    initialValue: T,
    options: Array<{ label: string; value: T }>,
    onChange: (value: T) => void,
  ): HTMLSelectElement {
    const select = document.createElement('select');
    Object.assign(select.style, {
      width: '110px',
      fontFamily: 'monospace',
      fontSize: '12px',
      padding: '2px 4px',
    });

    for (const option of options) {
      const node = document.createElement('option');
      node.value = option.value;
      node.textContent = option.label;
      select.appendChild(node);
    }
    select.value = initialValue;
    select.addEventListener('change', () => {
      onChange(select.value as T);
    });
    this.addRow(root, label, select);
    return select;
  }

  private makeButton(label: string, onClick: () => void): HTMLButtonElement {
    const button = document.createElement('button');
    button.textContent = label;
    Object.assign(button.style, {
      flex: '1',
      padding: '5px 8px',
      fontFamily: 'monospace',
      fontSize: '12px',
      borderRadius: '4px',
      border: '1px solid #777',
      background: '#222',
      color: '#fff',
      cursor: 'pointer',
    });
    button.addEventListener('click', onClick);
    return button;
  }

  private resetToDefaults(): void {
    const defaults = this.defaults;

    this.state.enabled = defaults.enabled;
    this.state.rate = defaults.rate;
    this.state.x = defaults.x;
    this.state.y = defaults.y;
    this.state.z = defaults.z;
    this.state.randomRotation = defaults.randomRotation;
    this.state.rotationJitter = defaults.rotationJitter;
    this.state.debugTimingEnabled = defaults.debugTimingEnabled;
    this.state.debugBehaviorEnabled = defaults.debugBehaviorEnabled;
    this.state.showContactPoints = defaults.showContactPoints;
    this.state.shadowsEnabled = defaults.shadowsEnabled;
    this.state.paused = defaults.paused;
    this.state.logEveryStep = defaults.logEveryStep;
    this.state.timeScale = defaults.timeScale;
    this.state.friction = defaults.friction;
    this.state.dualUpdateBeta = defaults.dualUpdateBeta;
    this.state.regularizationAlpha = defaults.regularizationAlpha;
    this.state.penaltyDecayGamma = defaults.penaltyDecayGamma;
    this.state.solverIterations = defaults.solverIterations;
    this.state.stackPreset = defaults.stackPreset;

    this.spawner.setEmitter({
      enabled: defaults.enabled,
      rate: defaults.rate,
      x: defaults.x,
      y: defaults.y,
      z: defaults.z,
      randomRotation: defaults.randomRotation,
      rotationJitter: defaults.rotationJitter,
    });

    this.onDebugTimingEnabledChange?.(defaults.debugTimingEnabled);
    this.onDebugBehaviorEnabledChange?.(defaults.debugBehaviorEnabled);
    this.onShowContactPointsChange?.(defaults.showContactPoints);
    this.onShadowsEnabledChange?.(defaults.shadowsEnabled);
    this.onPausedChange?.(defaults.paused);
    this.onLogEveryStepChange?.(defaults.logEveryStep);
    this.onTimeScaleChange?.(defaults.timeScale);
    this.onFrictionChange?.(defaults.friction);
    this.onDualUpdateBetaChange?.(defaults.dualUpdateBeta);
    this.onRegularizationAlphaChange?.(defaults.regularizationAlpha);
    this.onPenaltyDecayGammaChange?.(defaults.penaltyDecayGamma);
    this.onSolverIterationsChange?.(defaults.solverIterations);
    this.onStackPresetChange?.(defaults.stackPreset);

    this.update();
  }
}
