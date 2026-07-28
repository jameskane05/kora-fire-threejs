import GUI from 'lil-gui';
import { DEBUG_CHANNELS } from '../render/VolumeRenderer';
import { FUELS } from '../sim/constants';
import type { KoraParams } from '../sim/params';
import { PRESETS, type Preset } from './presets';

/**
 * The control panel is grouped the way Kora's toolset is (§5): sourcing, simulation control,
 * art-direction, rendering. The paper's argument is that the value of the system is as much in
 * *which* parameters get exposed as in the solver behind them — "Kora exposes only those
 * parameters which have a clear, predictable impact on the visual character of fire and smoke".
 */
export interface GuiCallbacks {
  onStructuralChange(): void;
  onPreset(preset: Preset): void;
  onReset(): void;
  onDetonate(): void;
  onProbe(): void;
  onShowGrid(visible: boolean): void;
}

export function createGui(params: KoraParams, cb: GuiCallbacks): GUI {
  const gui = new GUI({ title: 'Kora', width: 320 });

  const actions = {
    reset: () => cb.onReset(),
    detonate: () => cb.onDetonate(),
  };

  // Bound to `params`, not to `actions`: applying a preset rebuilds this panel, and a selection
  // held in a local object would be discarded and snap back to the first entry.
  gui
    .add(params, 'preset', PRESETS.map((p) => p.name))
    .name('preset')
    .onChange((name: string) => {
      const preset = PRESETS.find((p) => p.name === name);
      if (preset) cb.onPreset(preset);
    });

  gui.add(actions, 'detonate').name('detonate (§4.4 charge)');
  gui.add(actions, 'reset').name('reset domain');

  // ---- §5.1 sourcing -------------------------------------------------------------------
  const src = gui.addFolder('Sourcing — §5.1');
  src.add(params, 'sourceEnabled').name('emit');
  src
    .add(params, 'fuel', Object.keys(FUELS))
    .name('fuel')
    .onChange(() => cb.onReset());
  src.add(params, 'sourceAmount', 0, 12, 0.05).name('mixture amount');
  src.add(params, 'oxygenPremix', 0, 1.2, 0.01).name('oxygen pre-mix (1/phi)');
  src.add(params, 'sourceTemperature', 400, 3000, 10).name('temperature K');
  src.add(params, 'sourceRadius', 0.01, 1.0, 0.005).name('radius m');
  src.add(params, 'sourceLength', 0, 3, 0.01).name('capsule length m');
  src.add(params, 'sourceSpeed', 0, 40, 0.1).name('exit speed m/s');
  src.add(params.sourcePosition, 'x', -3, 3, 0.01).name('position x');
  src.add(params.sourcePosition, 'y', 0, 6, 0.01).name('position y');
  src.add(params.sourcePosition, 'z', -3, 3, 0.01).name('position z');
  src.close();

  // ---- §5.2 simulation control ------------------------------------------------------------
  const sim = gui.addFolder('Simulation control — §5.2');
  sim.add(params, 'combustionRate', 0.5, 120, 0.5).name('combustion rate');
  sim.add(params, 'flameSpeed', 0.0, 4, 0.01).name('flame speed m/s');
  sim.add(params, 'expansionRelaxation', 0.001, 0.3, 0.001).name('expansion relaxation tau');
  sim.add(params, 'emissivityAlpha', 0, 3, 0.01).name('emissivity alpha (soot grad)');
  sim.add(params, 'emissivityBeta', 0, 3, 0.01).name('emissivity beta (thermal)');
  sim.add(params, 'massDiffusivity', 0, 2e-3, 1e-5).name('mass diffusivity');
  sim.add(params, 'thermalDiffusivity', 0, 2e-3, 1e-5).name('thermal diffusivity');
  sim.add(params, 'sootFormationRate', 0, 12, 0.05).name('soot formation rate');
  sim.add(params, 'sootOxidationRate', 0, 8, 0.05).name('soot oxidation rate');
  sim.add(params, 'sootOxidationTemperature', 600, 2500, 10).name('soot oxidation K');
  sim.add(params, 'sootDissipationRate', 0, 3, 0.01).name('soot dissipation rate');
  sim.add(params, 'fuelDissipationRate', 0, 3, 0.01).name('fuel dissipation rate');
  sim
    .add(params, 'adiabatic')
    .name('adiabatic regime (§4.4)')
    .onChange(() => cb.onStructuralChange());

  // ---- §4.8 energy cascade turbulence ------------------------------------------------------
  const ect = sim.addFolder('Energy cascade turbulence — §4.8');
  ect.add(params, 'energyCascadeStrength', 0, 4, 0.01).name('strength');
  ect
    .add(params, 'energyCascadeBands', 1, 5, 1)
    .name('frequency bands')
    .onChange(() => cb.onStructuralChange());
  ect
    .add(params, 'exactCascadeFilter')
    .name('exact eq. (30) filter (slow)')
    .onChange(() => cb.onStructuralChange());
  for (let i = 0; i < 5; i++) {
    ect.add(params.energyCascadeGain, `${i}`, 0, 2, 0.01).name(`Rturb band ${i} (l = ${2 ** i} dx)`);
  }
  ect.close();
  sim.close();

  // ---- §5.3 art direction ------------------------------------------------------------------
  const art = gui.addFolder('Art direction — §5.3');
  art.add(params, 'gravity', 0, 30, 0.1).name('gravity');
  art.add(params, 'updraftStrength', 0, 1, 0.01).name('warped gravity updraft');
  art.add(params, 'updraftRadius', 0.05, 3, 0.01).name('updraft radius');
  art.add(params, 'updraftTilt', -0.8, 0.8, 0.01).name('updraft tilt');
  art.add(params, 'coriolis', -20, 20, 0.05).name('Coriolis omega (eq. 36)');
  art.add(params, 'coriolisRadialFalloff', 0.1, 5, 0.05).name('Coriolis falloff');
  art.add(params.wind, 'x', -8, 8, 0.05).name('wind x');
  art.add(params.wind, 'y', -8, 8, 0.05).name('wind y');
  art.add(params.wind, 'z', -8, 8, 0.05).name('wind z');
  art
    .add(params, 'guidingWeight', 0, 1, 0.01)
    .name('freq-domain guiding (§5.3.2)')
    .onChange((v: number) => {
      if (v === 0 || v > 0) cb.onStructuralChange();
    });
  art.add(params, 'guidingSwirl', 0, 6, 0.05).name('guide swirl');
  art.add(params, 'guidingRise', 0, 8, 0.05).name('guide rise');
  art.close();

  // ---- §5.4 rendering ------------------------------------------------------------------------
  const render = gui.addFolder('Rendering — §5.4');
  render.add(params, 'exposure', 0.05, 4, 0.01).name('exposure');
  render.add(params, 'flameIntensity', 0, 4, 0.01).name('flame intensity');
  render.add(params, 'hollowFlame', 0, 1, 0.01).name('hollow flame (eq. 41)');
  render.add(params, 'sootDensity', 0, 120, 0.5).name('soot density');
  render.add(params, 'sootAlbedo', 0, 1, 0.01).name('soot albedo');
  render.add(params, 'smokeAmbient', 0, 0.5, 0.005).name('ambient');
  render.add(params, 'koraDiffusion', 0, 1, 0.01).name('Kora diffusion (§5.4.2)');
  render.add(params, 'koraCrust', 0, 1.5, 0.01).name('Kora crust (§5.4.2)');
  render.add(params, 'bloom', 0, 2, 0.01).name('bloom');
  render.add(params, 'raymarchSteps', 32, 256, 1).name('raymarch steps');
  render.add(params, 'showFlameFront').name('tint by equivalence ratio');

  // ---- solver ---------------------------------------------------------------------------------
  const solver = gui.addFolder('Solver');
  solver
    .add(params, 'resolution', [48, 64, 80, 96, 112, 128])
    .name('grid resolution')
    .onChange(() => cb.onStructuralChange());
  solver
    .add(params, 'domainSize', 1, 12, 0.25)
    .name('domain size m')
    .onChange(() => cb.onStructuralChange());
  solver
    .add(params, 'pressureIterations', 4, 64, 1)
    .name('pressure iterations')
    .onChange(() => cb.onStructuralChange());
  solver.add(params, 'substeps', 1, 4, 1).name('substeps');
  solver
    .add(params, 'macCormack')
    .name('MacCormack advection')
    .onChange(() => cb.onStructuralChange());
  solver.close();

  // ---- diagnostics -----------------------------------------------------------------------------
  const debug = gui.addFolder('Diagnostics');
  debug
    .add(params, 'showGrid')
    .name('grid, origin & bounds')
    .onChange((v: boolean) => cb.onShowGrid(v));
  debug.add(params, 'debugView', [...DEBUG_CHANNELS]).name('channel view');
  debug.add(params, 'debugScale', 0.01, 20, 0.01).name('channel scale');
  debug.add({ probe: () => cb.onProbe() }, 'probe').name('log field stats');
  debug.close();

  return gui;
}

export function refreshGui(gui: GUI): void {
  gui.controllersRecursive().forEach((c) => c.updateDisplay());
}
