import GUI from 'lil-gui';
import { DEBUG_CHANNELS } from '../render/VolumeRenderer';
import { FUELS } from '../sim/constants';
import type { KoraParams } from '../sim/params';
import { MAX_OBSTACLES, type GizmoMode, type ObstacleKind } from '../sim/obstacles';
import { ENVIRONMENTS, type EnvironmentName } from '../scene/Environment';
import { PRESETS, type Preset } from './presets';
import { QUALITY, QUALITY_TIERS, type Quality } from './quality';

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
  onProfile(): void;
  onQuality(quality: Quality): void;
  onShowGrid(visible: boolean): void;
  onAddObstacle(kind: ObstacleKind): void;
  onRemoveObstacle(): void;
  onGizmoMode(mode: GizmoMode): void;
  onEnvironment(name: EnvironmentName): void;
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

  // Separate from the preset on purpose: this is the frame budget, not the fire.
  const quality = gui
    .add(params, 'quality', [...QUALITY_TIERS])
    .name('quality')
    .onChange((q: Quality) => {
      quality.$widget.title = QUALITY[q].note;
      cb.onQuality(q);
    });
  quality.$widget.title = QUALITY[params.quality].note;

  gui.add(actions, 'detonate').name('detonate (§4.4 charge)');
  gui.add(actions, 'reset').name('reset domain');

  // ---- §5.1 sourcing -------------------------------------------------------------------
  const src = gui.addFolder('Sourcing — §5.1');
  src.add(params, 'sourceEnabled').name('emit');
  src
    .add(params, 'fuel', Object.keys(FUELS))
    .name('fuel')
    .onChange(() => cb.onReset());
  // Density of the gas in the emitter, not a rate: 1 is atmospheric, above is a deliberate
  // over-fill for expansion to resolve. The pre-mix ratio below is what decides sooty versus clean.
  src.add(params, 'sourceAmount', 0, 4, 0.05).name('mixture density (1 = air)');
  src.add(params, 'detonationCharge', 0, 30, 0.1).name('detonation charge');
  // Floored rather than allowed to zero: the emitter is blended to this mixture, so below about
  // 0.05 the jet is so rich that it has cooled past the ignition temperature by the time it mixes
  // down to a flammable ratio, and simply never lights.
  src.add(params, 'oxygenPremix', 0.05, 1.2, 0.01).name('oxygen pre-mix (1/phi)');
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

  // Backdrops. Not lighting — nothing here is lit — but soot is dark grey and simply does not
  // read against an empty void, so the smoke half of the sim is invisible without one.
  render
    .add(params, 'environment', [...ENVIRONMENTS])
    .name('backdrop')
    .onChange((name: EnvironmentName) => cb.onEnvironment(name));
  render.add(params, 'backgroundIntensity', 0, 3, 0.01).name('backdrop brightness').listen();

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

  // ---- displacement volumes ---------------------------------------------------------------------
  // Not from the paper: Kora takes collision objects from the host framework. These enter the
  // solve as Neumann boundaries in the pressure projection, so the plume goes around them, and a
  // primitive dragged through the fire pushes it.
  const solids = gui.addFolder('Displacement volumes');
  const shapes = {
    sphere: () => cb.onAddObstacle('sphere'),
    box: () => cb.onAddObstacle('box'),
    capsule: () => cb.onAddObstacle('capsule'),
    remove: () => cb.onRemoveObstacle(),
  };
  solids.add(shapes, 'sphere').name(`add sphere (max ${MAX_OBSTACLES})`);
  solids.add(shapes, 'box').name('add box');
  solids.add(shapes, 'capsule').name('add capsule');
  solids.add(shapes, 'remove').name('remove selected');
  // Bound to `params` so the keyboard shortcuts and the headset's button strip can drive it and
  // have this reflect the change, rather than the three of them drifting apart.
  solids
    .add(params, 'gizmoMode', ['translate', 'rotate', 'scale'])
    .name('gizmo (W / E / R)')
    .onChange((m: GizmoMode) => cb.onGizmoMode(m));
  solids.close();

  // ---- sparks ----------------------------------------------------------------------------------
  // Both papers keep sparks off the grid and in a particle system, so this is a separate solve
  // that samples the volume rather than a channel of it. Changing the population reallocates the
  // buffers, hence the structural rebuild.
  const sparks = gui.addFolder('Sparks & embers');
  sparks.add(params, 'sparksEnabled').name('enabled');
  sparks
    .add(params, 'sparkCount', 0, 80000, 1000)
    .name('population cap')
    .onFinishChange(() => cb.onStructuralChange());
  sparks.add(params, 'sparkSpawnRate', 0, 1, 0.01).name('spawn rate');
  sparks.add(params, 'sparkSpawnHeat', 0, 6, 0.05).name('heat floor');
  sparks.add(params, 'sparkEjectSpeed', 0, 5, 0.05).name('ejection speed (m/s)');
  sparks.add(params, 'sparkLife', 0.2, 10, 0.1).name('lifetime (s)');
  // Low is a heavy cinder that arcs over, high is a mote that rides the plume out of the top.
  sparks.add(params, 'sparkDrag', 0.1, 8, 0.05).name('drag rate (1/s)');
  sparks.add(params, 'sparkCooling', 0, 6e-10, 1e-11).name('radiative cooling');
  sparks.add(params, 'sparkSize', 0.001, 0.06, 0.001).name('size (m)');
  sparks.add(params, 'sparkStreak', 0, 0.06, 0.001).name('motion streak');
  sparks.add(params, 'sparkIntensity', 0, 6, 0.05).name('intensity');
  sparks.close();

  // ---- diagnostics -----------------------------------------------------------------------------
  const debug = gui.addFolder('Diagnostics');
  debug
    .add(params, 'showGrid')
    .name('grid, origin & bounds')
    .onChange((v: boolean) => cb.onShowGrid(v));
  debug.add(params, 'debugView', [...DEBUG_CHANNELS]).name('channel view');
  debug.add(params, 'debugScale', 0.01, 20, 0.01).name('channel scale');
  debug.add({ probe: () => cb.onProbe() }, 'probe').name('log field stats');
  debug.add({ profile: () => cb.onProfile() }, 'profile').name('profile GPU (~2 s)');
  debug.close();

  return gui;
}

export function refreshGui(gui: GUI): void {
  gui.controllersRecursive().forEach((c) => c.updateDisplay());
}
