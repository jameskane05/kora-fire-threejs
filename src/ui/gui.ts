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
 *
 * Hover any control for a short note and paper section. Section numbers refer to Stomakhin et al.,
 * DigiPro '26 (Kora).
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

/** Native title tooltip on the whole row — same mechanism the quality control already used. */
function tip<T extends { domElement: HTMLElement }>(controller: T, text: string): T {
  controller.domElement.title = text;
  return controller;
}

function tipFolder(folder: GUI, text: string): GUI {
  folder.$title.title = text;
  return folder;
}

export interface CreateGuiOptions {
  /** Skip displacement-volume controls (sandbox fire mount has no obstacle editor yet). */
  omitSolids?: boolean;
  /** Skip GPU probe / profile buttons (still keep channel view + grid). */
  omitDiagnosticsTools?: boolean;
}

export function createGui(
  params: KoraParams,
  cb: GuiCallbacks,
  opts: CreateGuiOptions = {},
): GUI {
  const gui = new GUI({ title: 'Kora', width: 320 });
  gui.$title.title =
    'Kora: A Physics-Based Fire Pipeline and Toolset — Stomakhin et al., DigiPro ’26 (Weta FX). Hover any control for what it does and which paper section it comes from.';

  const actions = {
    reset: () => cb.onReset(),
    detonate: () => cb.onDetonate(),
  };

  // Bound to `params`, not to `actions`: applying a preset rebuilds this panel, and a selection
  // held in a local object would be discarded and snap back to the first entry.
  tip(
    gui
      .add(params, 'preset', PRESETS.map((p) => p.name))
      .name('preset')
      .onChange((name: string) => {
        const preset = PRESETS.find((p) => p.name === name);
        if (preset) cb.onPreset(preset);
      }),
    '§6 production setups. Same solver, different sourcing and art-direction — the paper’s point that look comes from knobs, not special-case models.',
  );

  // Separate from the preset on purpose: this is the frame budget, not the fire.
  const quality = tip(
    gui
      .add(params, 'quality', [...QUALITY_TIERS])
      .name('quality')
      .onChange((q: Quality) => {
        quality.$widget.title = QUALITY[q].note;
        quality.domElement.title = QUALITY[q].note;
        cb.onQuality(q);
      }),
    QUALITY[params.quality].note,
  );
  quality.$widget.title = QUALITY[params.quality].note;

  tip(
    gui.add(actions, 'detonate').name('detonate (§4.4 charge)'),
    '§4.4 — Stamps a one-shot hot fuel charge (detonation charge × premix) so pressure jumps above atmospheric; the adiabatic regime turns that into expansion with cooling. Spacebar does the same.',
  );
  tip(
    gui.add(actions, 'reset').name('reset domain'),
    'Clears the grid back to still air and restarts emission. Use after changing fuel or when the domain has filled with leftover products.',
  );

  // ---- §5.1 sourcing -------------------------------------------------------------------
  const src = tipFolder(
    gui.addFolder('Sourcing — §5.1'),
    '§5.1 — Where fuel and oxidiser enter the domain. Premixing (§5.1.1) and the emission SDF (§5.1.2) decide sooty vs clean more than any other controls.',
  );
  tip(src.add(params, 'sourceEnabled').name('emit'), 'Gate on continuous emission. Off still allows detonate().');
  tip(
    src
      .add(params, 'fuel', Object.keys(FUELS))
      .name('fuel')
      .onChange(() => cb.onReset()),
    'Fuel database: stoichiometry, enthalpy, ignition temperature, flammability limits, flame speed. Changing fuel resets the domain because those constants rewrite the chemistry.',
  );
  tip(
    src.add(params, 'sourceAmount', 0, 4, 0.05).name('mixture density (1 = air)'),
    'Density of gas inside the emitter relative to still air — not a rate. 1 ≈ atmospheric; above 1 is the deliberate over-fill artists asked for (2023 talk), which expansion then resolves.',
  );
  tip(
    src.add(params, 'detonationCharge', 0, 30, 0.1).name('detonation charge'),
    '§4.4 — Amount injected by detonate(), premixed independently of continuous emission. Large + hot + adiabatic ⇒ blast.',
  );
  tip(
    src.add(params, 'oxygenPremix', 0.05, 1.2, 0.01).name('oxygen pre-mix (1/phi)'),
    '§5.1.1 / Fig. 10 — Fraction of stoichiometric O₂ demand in the delivered mix. φ = 1 / this. Low (~0.2) → rich, sooty; ~0.85 → short clean premixed flame. The single most consequential look control.',
  );
  tip(
    src.add(params, 'sourceTemperature', 400, 3000, 10).name('temperature K'),
    'Temperature stamped inside the emitter. Must stay above the fuel’s ignition temperature or the jet never lights as it mixes down.',
  );
  tip(
    src.add(params, 'sourceRadius', 0.01, 1.0, 0.005).name('radius m'),
    '§5.1.2 — Radius of the emission capsule SDF. Bigger source ⇒ more fire at the same mixture density.',
  );
  tip(
    src.add(params, 'sourceLength', 0, 3, 0.01).name('capsule length m'),
    '§5.1.2 — Capsule axis length. 0 → point/sphere source; >0 → line jet (flame bar).',
  );
  tip(
    src.add(params, 'sourceSpeed', 0, 40, 0.1).name('exit speed m/s'),
    'Inflow velocity stamped on MAC faces inside the emitter. Sets jet momentum; too high can blow the flame out before it mixes.',
  );
  tip(src.add(params.sourcePosition, 'x', -3, 3, 0.01).name('position x'), 'World-space emitter centre (m).');
  tip(src.add(params.sourcePosition, 'y', 0, 6, 0.01).name('position y'), 'World-space emitter centre (m). Domain floor is y = 0.');
  tip(src.add(params.sourcePosition, 'z', -3, 3, 0.01).name('position z'), 'World-space emitter centre (m).');
  src.close();

  // ---- §5.2 simulation control ------------------------------------------------------------
  const sim = tipFolder(
    gui.addFolder('Simulation control — §5.2'),
    '§5.2 — Artist-facing combustion and transport knobs. The paper keeps hundreds of solver constants hidden; these are the ones that change visual character.',
  );
  tip(
    sim.add(params, 'combustionRate', 0.5, 120, 0.5).name('combustion rate'),
    '§4.5.1 — How fast fuel+O₂ react inside the flame front (first-order rate). Higher → thinner, hotter reaction zone; lower → softer, more starved burn.',
  );
  tip(
    sim.add(params, 'flameSpeed', 0.0, 4, 0.01).name('flame speed m/s'),
    '§4.5.2 eq. (22) — Laminar flame-front propagation speed ν. How quickly the SDF ignition surface advances into flammable mixture.',
  );
  tip(
    sim.add(params, 'expansionRelaxation', 0.001, 0.3, 0.001).name('expansion relaxation tau'),
    '§4.3 eq. (19) — Time constant for delayed expansion toward the ideal-gas constraint. Smaller → snappier density response; larger → softer, lagging expansion.',
  );
  tip(
    sim.add(params, 'emissivityAlpha', 0, 3, 0.01).name('emissivity alpha (soot grad)'),
    '§4.7.4 — Weight on ||∇c_soot|| in radiative cooling. Cooling that reads off soot edges / shells.',
  );
  tip(
    sim.add(params, 'emissivityBeta', 0, 3, 0.01).name('emissivity beta (thermal)'),
    '§4.7.4 — Weight on c_soot·||∇T|| in radiative cooling. Cooling that reads off hot soot in the thermal field.',
  );
  tip(
    sim.add(params, 'massDiffusivity', 0, 2e-3, 1e-5).name('mass diffusivity'),
    '§4.7.2 — Species diffusion. Higher mixes fuel and air faster → shorter, cleaner flames; lower keeps rich cores sooty longer.',
  );
  tip(
    sim.add(params, 'thermalDiffusivity', 0, 2e-3, 1e-5).name('thermal diffusivity'),
    '§4.7.2 — Heat conduction. Spreads temperature; high values soften hot spots and help ignition of neighbours.',
  );
  tip(
    sim.add(params, 'sootFormationRate', 0, 20, 0.05).name('soot formation rate'),
    '§4.5.1 — How quickly excess fuel pyrolyses into soot in hot, oxygen-starved regions. Turn up for creosote/smoke; pairs with oxygen pre-mix.',
  );
  tip(
    sim.add(params, 'sootOxidationRate', 0, 8, 0.05).name('soot oxidation rate'),
    '§4.5.1 — How quickly soot burns away in hot, oxygen-rich regions (excess O₂ after fuel’s claim). High → cleaner; low → smoke survives.',
  );
  tip(
    sim.add(params, 'sootOxidationTemperature', 600, 2500, 10).name('soot oxidation K'),
    '§4.5.1 — Temperature floor for soot oxidation. Below this, soot will not burn off even if oxygen is available.',
  );
  tip(
    sim.add(params, 'sootDissipationRate', 0, 3, 0.01).name('soot dissipation rate'),
    '§4.7.5 — Soft removal of soot (outside the equation of state). Higher fades the plume faster as it rises.',
  );
  tip(
    sim.add(params, 'fuelDissipationRate', 0, 3, 0.01).name('fuel dissipation rate'),
    '§4.7.5 — Soft removal of fuel, redistributed to nitrogen so pressure does not drop. Usually leave at 0 for jets.',
  );
  tip(
    sim
      .add(params, 'adiabatic')
      .name('adiabatic regime (§4.4)')
      .onChange(() => cb.onStructuralChange()),
    '§4.4 — Off: isobaric (Cp). On: isochoric burn then adiabatic expansion with cooling — needed for detonations and blasts.',
  );

  // ---- §4.8 energy cascade turbulence ------------------------------------------------------
  const ect = tipFolder(
    sim.addFolder('Energy cascade turbulence — §4.8'),
    '§4.8 — Injects turbulence by cascading energy across length scales instead of procedural noise. Drives the flicker and breakup of the plume.',
  );
  tip(
    ect.add(params, 'energyCascadeStrength', 0, 4, 0.01).name('strength'),
    'Overall gain on the cascade forcing. 0 → laminar; higher → more breakup and billowing.',
  );
  tip(
    ect
      .add(params, 'energyCascadeBands', 1, 5, 1)
      .name('frequency bands')
      .onChange(() => cb.onStructuralChange()),
    'How many successive filter scales (l = 2ⁿ dx) participate. More bands ⇒ richer multi-scale motion; rebuilds the graph.',
  );
  tip(
    ect
      .add(params, 'exactCascadeFilter')
      .name('exact eq. (30) filter (slow)')
      .onChange(() => cb.onStructuralChange()),
    '§4.8 eq. (30) — Exact repeated box filter instead of the cheap à-trous approximation. Correct but expensive.',
  );
  for (let i = 0; i < 5; i++) {
    tip(
      ect.add(params.energyCascadeGain, `${i}`, 0, 2, 0.01).name(`Rturb band ${i} (l = ${2 ** i} dx)`),
      `§4.8 eq. (32) — Per-band turbulence gain Rturb(l) at length scale l = ${2 ** i}·dx. Shape which scales dominate the cascade.`,
    );
  }
  ect.close();
  sim.close();

  // ---- §5.3 art direction ------------------------------------------------------------------
  const art = tipFolder(
    gui.addFolder('Art direction — §5.3'),
    '§5.3 — Direct the plume without breaking the chemistry: warped gravity, truncated Coriolis, wind, and frequency-domain guiding.',
  );
  tip(art.add(params, 'gravity', 0, 30, 0.1).name('gravity'), 'Gravitational acceleration (m/s²). Buoyancy uses the density anomaly, so hot gas rises and soot-laden gas can fall.');
  tip(
    art.add(params, 'updraftStrength', 0, 1, 0.01).name('warped gravity updraft'),
    '§5.3.1 — Blend toward a local updraft axis (warped gravity). Bends the plume without painting velocity.',
  );
  tip(
    art.add(params, 'updraftRadius', 0.05, 3, 0.01).name('updraft radius'),
    '§5.3.1 — Radial extent of the warped-gravity updraft (m).',
  );
  tip(
    art.add(params, 'updraftTilt', -0.8, 0.8, 0.01).name('updraft tilt'),
    '§5.3.1 — Tilts the local updraft axis off vertical. Fire-tornado / leaning plume.',
  );
  tip(
    art.add(params, 'coriolis', -20, 20, 0.05).name('Coriolis omega (eq. 36)'),
    '§5.3.1 eq. (36) — Truncated Coriolis rotation rate. Spins the plume (fire tornado with updraft).',
  );
  tip(
    art.add(params, 'coriolisRadialFalloff', 0.1, 5, 0.05).name('Coriolis falloff'),
    '§5.3.1 — How quickly Coriolis weakens away from the axis.',
  );
  tip(art.add(params.wind, 'x', -8, 8, 0.05).name('wind x'), 'Uniform wind acceleration / body force (m/s²) along X.');
  tip(art.add(params.wind, 'y', -8, 8, 0.05).name('wind y'), 'Uniform wind acceleration / body force (m/s²) along Y.');
  tip(art.add(params.wind, 'z', -8, 8, 0.05).name('wind z'), 'Uniform wind acceleration / body force (m/s²) along Z.');
  tip(
    art
      .add(params, 'guidingWeight', 0, 1, 0.01)
      .name('freq-domain guiding (§5.3.2)')
      .onChange((v: number) => {
        if (v === 0 || v > 0) cb.onStructuralChange();
      }),
    '§5.3.2 — Weight for frequency-domain velocity guiding [Forootaninia & Narain 2020]. 0 disables the pass (cheaper).',
  );
  tip(
    art.add(params, 'guidingSwirl', 0, 6, 0.05).name('guide swirl'),
    '§5.3.2 — Target swirl component for the guiding field.',
  );
  tip(
    art.add(params, 'guidingRise', 0, 8, 0.05).name('guide rise'),
    '§5.3.2 — Target rising component for the guiding field.',
  );
  art.close();

  // ---- §5.4 rendering ------------------------------------------------------------------------
  const render = tipFolder(
    gui.addFolder('Rendering — §5.4'),
    '§5.4 — Volume shading: blackbody flame from heat/temperature, grey soot extinction, plus the §5.4.2 diffusion/crust tricks. Not a second solve.',
  );
  tip(render.add(params, 'exposure', 0.05, 4, 0.01).name('exposure'), 'Linear gain on the raymarched radiance before tone mapping.');
  tip(
    render.add(params, 'flameIntensity', 0, 4, 0.01).name('flame intensity'),
    '§5.4.1 — Scales flame emission (and lightly its extinction) from the released-heat channel H.',
  );
  tip(
    render.add(params, 'hollowFlame', 0, 1, 0.01).name('hollow flame (eq. 41)'),
    '§5.4.1 eq. (41) — Blend toward ζ = (1−(2φ−1)⁴)·H so the reaction zone reads as a thin shell instead of a solid blob. Critical for close-ups.',
  );
  tip(
    render.add(params, 'sootDensity', 0, 600, 1).name('soot density'),
    '§5.4.1 — Extinction coefficient multiplier on soot concentration. How opaque the creosote/smoke is. Needs a backdrop to read.',
  );
  tip(
    render.add(params, 'sootAlbedo', 0, 1, 0.01).name('soot albedo'),
    '§5.4.1 — How much the smoke scatters vs absorbs. Low → dark creosote; higher → greyer, lit smoke.',
  );
  tip(
    render.add(params, 'smokeAmbient', 0, 1.0, 0.005).name('smoke ambient'),
    'Cheap ambient in-scatter on soot (self-shadowed via blurred soot). Not scene lighting — just enough for the plume to read as volume.',
  );
  tip(
    render.add(params, 'koraDiffusion', 0, 1, 0.01).name('Kora diffusion (§5.4.2)'),
    '§5.4.2 — Blend blurred temperature back into shading. Exaggerates radiative cooling on the outer shell.',
  );
  tip(
    render.add(params, 'koraCrust', 0, 1.5, 0.01).name('Kora crust (§5.4.2)'),
    '§5.4.2 — Emphasise convex soot (blurred soot subtracted from local). Dark crust with cracks where the emissive core shows through.',
  );
  tip(render.add(params, 'bloom', 0, 2, 0.01).name('bloom'), 'Screen-space bloom strength on the hot fire. Disabled in XR (projection-layer limitation).');
  tip(
    render.add(params, 'raymarchSteps', 32, 256, 1).name('raymarch steps'),
    'Samples along each eye ray through the domain. More → less banding, higher cost. Quality tiers also set this.',
  );
  tip(
    render.add(params, 'showFlameFront').name('tint by equivalence ratio'),
    'Debug tint: blue lean → red rich by φ. Visualises the §4.5.1 mixture state the flame front cares about.',
  );

  tip(
    render
      .add(params, 'environment', [...ENVIRONMENTS])
      .name('backdrop')
      .onChange((name: EnvironmentName) => cb.onEnvironment(name)),
    'HDRI backdrop (not lighting). Soot is dark grey and invisible against a void — you need something behind the plume to occlude.',
  );
  tip(
    render.add(params, 'backgroundIntensity', 0, 3, 0.01).name('backdrop brightness').listen(),
    'Exposure of the backdrop. Daylight HDRIs need to be pulled down or they bloom and flatten the fire.',
  );

  // ---- solver ---------------------------------------------------------------------------------
  const solver = tipFolder(
    gui.addFolder('Solver'),
    'Low-level grid / projection settings. Changing these rebuilds compute graphs. Prefer quality tiers unless you know you need a custom budget.',
  );
  tip(
    solver
      .add(params, 'resolution', [48, 64, 80, 96, 112, 128])
      .name('grid resolution')
      .onChange(() => cb.onStructuralChange()),
    'Voxels along each domain edge (N³). Dominates cost and fine detail.',
  );
  tip(
    solver
      .add(params, 'domainSize', 1, 12, 0.25)
      .name('domain size m')
      .onChange(() => cb.onStructuralChange()),
    'Physical size of the cubic domain (metres). Larger domain at fixed N ⇒ coarser dx.',
  );
  tip(
    solver
      .add(params, 'pressureIterations', 4, 64, 1)
      .name('pressure iterations')
      .onChange(() => cb.onStructuralChange()),
    '§4.7.1 — Jacobi iterations for the pressure projection. Too few ⇒ leaky divergence / mushy volume conservation.',
  );
  tip(
    solver.add(params, 'substeps', 1, 4, 1).name('substeps'),
    'Solver substeps per displayed frame. Helps stability with fast jets; multiplies cost.',
  );
  tip(
    solver
      .add(params, 'macCormack')
      .name('MacCormack advection')
      .onChange(() => cb.onStructuralChange()),
    '§4.7.3 — Semi-Lagrangian advection with MacCormack error correction. Sharper features; slightly more expensive / energetic.',
  );
  solver.close();

  // ---- displacement volumes ---------------------------------------------------------------------
  if (!opts.omitSolids) {
    const solids = tipFolder(
      gui.addFolder('Displacement volumes'),
      'Solid primitives as Neumann boundaries in the pressure solve — not from the paper (Kora inherits collisions from the host). Plume goes around them; a dragged solid pushes the fire.',
    );
    const shapes = {
      sphere: () => cb.onAddObstacle('sphere'),
      box: () => cb.onAddObstacle('box'),
      capsule: () => cb.onAddObstacle('capsule'),
      remove: () => cb.onRemoveObstacle(),
    };
    tip(solids.add(shapes, 'sphere').name(`add sphere (max ${MAX_OBSTACLES})`), 'Drop a sphere just above the emitter. Rebuilds the solver for the new primitive count.');
    tip(solids.add(shapes, 'box').name('add box'), 'Add a box obstacle in the plume.');
    tip(solids.add(shapes, 'capsule').name('add capsule'), 'Add a capsule obstacle in the plume.');
    tip(solids.add(shapes, 'remove').name('remove selected'), 'Remove the gizmo-selected primitive.');
    tip(
      solids
        .add(params, 'gizmoMode', ['translate', 'rotate', 'scale'])
        .name('gizmo (W / E / R)')
        .onChange((m: GizmoMode) => cb.onGizmoMode(m)),
      'Desktop gizmo mode (also W / E / R). Headset uses the same modes from the hand panel.',
    );
    solids.close();
  }

  // ---- sparks ----------------------------------------------------------------------------------
  const sparks = tipFolder(
    gui.addFolder('Sparks & embers'),
    'Particle system beside the grid (both papers keep sparks off-voxel). Samples volume velocity/heat; blackbody-matched to the fire it left.',
  );
  tip(sparks.add(params, 'sparksEnabled').name('enabled'), 'Toggle the ember particle system.');
  tip(
    sparks
      .add(params, 'sparkCount', 0, 80000, 1000)
      .name('population cap')
      .onFinishChange(() => cb.onStructuralChange()),
    'Max live embers. Changing this reallocates GPU buffers (rebuild).',
  );
  tip(
    sparks.add(params, 'sparkSpawnRate', 0, 1, 0.01).name('spawn rate'),
    'Probability a hot-enough cell throws an ember, per candidate test.',
  );
  tip(
    sparks.add(params, 'sparkSpawnHeat', 0, 6, 0.05).name('heat floor'),
    'Released-heat threshold before a cell can spawn embers at all.',
  );
  tip(
    sparks.add(params, 'sparkEjectSpeed', 0, 5, 0.05).name('ejection speed (m/s)'),
    'Isotropic kick at birth on top of the local gas velocity.',
  );
  tip(sparks.add(params, 'sparkLife', 0.2, 10, 0.1).name('lifetime (s)'), 'How long an ember lives before it is recycled.');
  tip(
    sparks.add(params, 'sparkDrag', 0.1, 8, 0.05).name('drag rate (1/s)'),
    '1/τ of the drag that pulls an ember onto the gas velocity. Low → heavy cinder that arcs; high → mote that rides the plume.',
  );
  tip(
    sparks.add(params, 'sparkCooling', 0, 6e-10, 1e-11).name('radiative cooling'),
    'Grey-body cooling coefficient (~ 3εσ / (ρ c r)). Higher → embers go dark faster.',
  );
  tip(sparks.add(params, 'sparkSize', 0.001, 0.06, 0.001).name('size (m)'), 'Rendered ember radius (metres).');
  tip(
    sparks.add(params, 'sparkStreak', 0, 0.06, 0.001).name('motion streak'),
    'Metres of motion blur streak per m/s of ember speed.',
  );
  tip(sparks.add(params, 'sparkIntensity', 0, 6, 0.05).name('intensity'), 'Emission multiplier for embers.');
  sparks.close();

  // ---- diagnostics -----------------------------------------------------------------------------
  const debug = tipFolder(
    gui.addFolder('Diagnostics'),
    'Debug overlays and GPU probes. Channel view bypasses shading with a max-intensity projection of one scalar.',
  );
  tip(
    debug
      .add(params, 'showGrid')
      .name('grid, origin & bounds')
      .onChange((v: boolean) => cb.onShowGrid(v)),
    'Floor grid, world axes, and the simulation AABB.',
  );
  tip(
    debug.add(params, 'debugView', [...DEBUG_CHANNELS]).name('channel view'),
    'off = shaded. Others = max projection of temperature / heat / soot / φ / flame alpha / blackbody / emission. Use soot×scale to confirm smoke is in the field.',
  );
  tip(
    debug.add(params, 'debugScale', 0.01, 20, 0.01).name('channel scale'),
    'Gain on the debug max-projection. Soot concentrations are small — try 5–40 to see the plume.',
  );
  if (!opts.omitDiagnosticsTools) {
    tip(
      debug.add({ probe: () => cb.onProbe() }, 'probe').name('log field stats'),
      'GPU→CPU sample of field extremes (maxSoot, maxHeat, φ, …). Also window.kora.probe().',
    );
    tip(
      debug.add({ profile: () => cb.onProfile() }, 'profile').name('profile GPU (~2 s)'),
      'Timestamp-query pass timings for a couple of seconds. Also window.kora.profile().',
    );
  }
  debug.close();

  return gui;
}

export function refreshGui(gui: GUI): void {
  gui.controllersRecursive().forEach((c) => c.updateDisplay());
}
