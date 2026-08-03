import {
  ACESFilmicToneMapping,
  type Group,
  type Line,
  LinearSRGBColorSpace,
  NoToneMapping,
  PerspectiveCamera,
  RenderPipeline,
  SRGBColorSpace,
  Scene,
  Vector3,
  WebGPURenderer,
} from 'three/webgpu';
import { pass } from 'three/tsl';
import { bloom } from 'three/addons/tsl/display/BloomNode.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

import { FLAME_AUDIO_ENABLED, FlameAudio } from './audio/FlameAudio';
import { installGpuErrorReporter, gpuErrorSummary } from './debug/gpuErrors';
import { disarmTimestamps, profile, printProfile, type ProfileOptions } from './debug/profile';
import { KoraSolver } from './sim/KoraSolver';
import { FieldProbe } from './sim/probe';
import { gridOps } from './sim/tsl';
import { createNoiseVolume } from './sim/noise';
import { defaultParams, type KoraParams } from './sim/params';
import { createDomainHelper } from './render/DomainHelper';
import { VolumeRenderer } from './render/VolumeRenderer';
import { createGui, refreshGui } from './ui/gui';
import { PRESETS, applyPreset, type Preset } from './ui/presets';
import { QUALITY, applyQuality, type Quality } from './ui/quality';
import {
  IMMERSIVE_FIRE_FRAMED_SIZE,
  applyImmersiveFireBudget,
  IMMERSIVE_FIRE_SOLVE_INTERVAL,
  restoreFireBudget,
  snapshotFireBudget,
  type ImmersiveFireSnapshot,
} from './ui/immersiveFire';
import { Obstacles, type GizmoMode } from './scene/Obstacles';
import { Environment, DEFAULT_INTENSITY, type EnvironmentName } from './scene/Environment';
import { Sparks } from './particles/Sparks';
import { MAX_HAND_SOLIDS, MAX_SCENE_OBSTACLES, type ObstacleKind } from './sim/obstacles';
import { Hands, previewHand } from './xr/Hands';
import { HandSolids } from './xr/HandSolids';
import { ImmersiveMode, type ViewportPolicy } from './xr/ImmersiveMode';
import { isVisionOS } from './xr/platform';

function fireObstacleBudget(sceneCount: number, hands: boolean): number {
  return sceneCount + (hands ? MAX_HAND_SOLIDS : 0);
}

const AUDIO_PROBE_PERIOD = 0.12;
const AUDIO_PROBE_STRIDE = 8;

const app = document.getElementById('app') as HTMLDivElement;
const statsEl = document.getElementById('stats') as HTMLDivElement;

async function main() {
  if (!navigator.gpu) {
    document.getElementById('unsupported')?.classList.add('show');
    return;
  }

  // The solver writes several storage textures per kernel. WebGPU only guarantees four per
  // shader stage, so ask the adapter for whatever headroom it actually has.
  const adapter = await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' });
  const requiredLimits: Record<string, number> = {};
  for (const limit of [
    'maxStorageTexturesPerShaderStage',
    'maxSampledTexturesPerShaderStage',
    'maxComputeInvocationsPerWorkgroup',
    'maxBufferSize',
    'maxStorageBufferBindingSize',
  ] as const) {
    const value = adapter?.limits?.[limit as keyof GPUSupportedLimits];
    if (typeof value === 'number') requiredLimits[limit] = value;
  }

  // trackTimestamp only arms the query pool; nothing is resolved until the profiler asks.
  const renderer = new WebGPURenderer({
    antialias: true, // WebGPU XR MSAA: three #34120
    forceWebGL: false,
    requiredLimits,
    trackTimestamp: true,
  });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  app.appendChild(renderer.domElement);

  // Set before init(), not after: three requests the adapter during init and forwards this as
  // `xrCompatible`. Enabling it later leaves the device unusable for an XR session.
  renderer.xr.enabled = true;

  await renderer.init();

  const device = (renderer as unknown as { backend?: { device?: GPUDevice } }).backend?.device;
  if (device) {
    installGpuErrorReporter(device);
    // A session that drops back to passthrough on its own has usually lost the device rather than
    // hit a validation error, and nothing else reports that.
    void device.lost.then((info) => {
      console.error(`[kora] the GPU device was lost (${info.reason}): ${info.message}`);
    });
  }

  disarmTimestamps(renderer);

  const scene = new Scene();
  const environment = new Environment(scene);

  const camera = new PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.05, 200);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.maxPolarAngle = Math.PI * 0.92;

  const noise = createNoiseVolume(32);
  let params: KoraParams = applyPreset({ ...defaultParams }, PRESETS[0]);
  params.environment = 'night';
  params.backgroundIntensity = DEFAULT_INTENSITY.night;
  params.obstacleCount = fireObstacleBudget(isVisionOS() ? 0 : 1, false);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, QUALITY[params.quality].pixelRatio));

  let solver = new KoraSolver(renderer, params, noise);
  const handSolids = new HandSolids();
  const flameAudio = new FlameAudio();
  flameAudio.setEnabled(FLAME_AUDIO_ENABLED);
  let audioProbes: FieldProbe[] | null = null;
  let audioProbeBusy = false;
  let audioProbeAge = AUDIO_PROBE_PERIOD;
  const unlockAudio = () => {
    if (FLAME_AUDIO_ENABLED) void flameAudio.resume();
  };
  if (FLAME_AUDIO_ENABLED) {
    window.addEventListener('pointerdown', unlockAudio, { once: true });
  }
  let volume = new VolumeRenderer(
    { field: solver.renderField, blur: solver.renderBlur, solid: solver.fields.solid },
    params.domainSize,
  );
  // Everything the viewer looks at hangs off the immersive rig, which is inert on the desktop
  // and becomes the thing the pointer turns once a session starts.
  const immersive = new ImmersiveMode(renderer, {
    onEnter: () => enterImmersive(),
    onExit: () => exitImmersive(),
  });
  scene.add(immersive.rig);

  // Hands go in the scene, not on the rig: they are tracked against the real world and have to
  // stay at life size, while the rig scales the domain down to something you can hold.
  const hands = new Hands(renderer, scene);

  // Embers are their own solve reading the volume's output, which is why they are built from the
  // solver rather than inside it. They share the flame's blackbody table so a spark leaving the
  // fire is the same colour as the fire it left.
  function makeSparks() {
    return new Sparks(
      {
        render: solver.renderField,
        solid: solver.fields.solid,
        velocity: [solver.state[0].vel, solver.state[1].vel],
        lut: volume.lut,
      },
      solver.uniforms,
      solver.res,
      params.domainSize,
      Math.max(1, Math.round(params.sparkCount)),
    );
  }
  let sparks = makeSparks();

  immersive.attach(volume.mesh);
  immersive.attach(sparks.mesh);
  solver.reset();
  sparks.reset(renderer);

  environment.setIntensity(params.backgroundIntensity);
  void environment.set(params.environment);

  let domainHelper = createDomainHelper(params.domainSize);
  domainHelper.visible = params.showGrid;
  immersive.attach(domainHelper);
  immersive.setDomainSize(params.domainSize);

  // ---- displacement volumes -----------------------------------------------------------------
  // The proxies ride the rig with the fire so they stay put relative to it in VR, but the gizmo
  // is a mouse tool and belongs in world space alongside the desktop camera.
  const obstacles = new Obstacles(
    solver.uniforms,
    camera,
    renderer.domElement,
    (dragging) => {
      controls.enabled = !dragging;
    },
    MAX_SCENE_OBSTACLES,
  );
  immersive.attach(obstacles.group);
  scene.add(obstacles.helper);

  // In a headset a pinch grabs the primitives directly, and the mode moves to a panel you can
  // actually hit with a hand ray.
  immersive.setManipulator(obstacles);
  scene.add(immersive.hud);

  // Seeded sphere on desktop macOS only — visionOS uses palm boxes instead.
  if (!isVisionOS()) {
    addObstacle('sphere');
    const seeded = obstacles.targets()[0];
    seeded.scale.setScalar(0.6);
    seeded.position.x += 0.1;
    obstacles.select(null);
  }

  // Adding or removing a primitive changes how many are unrolled into the kernels, so the graph
  // has to be rebuilt. Dragging one does not.
  obstacles.onCountChanged = (count) => {
    params.obstacleCount = fireObstacleBudget(count, handSolids.active);
    rebuild();
    refreshGui(gui);
  };

  // Every route into a mode change ends up here, so the panel, the keys and the headset's button
  // strip can never disagree about which one is active.
  obstacles.onModeChanged = (mode) => {
    params.gizmoMode = mode;
    immersive.showMode(mode);
    refreshGui(gui);
  };
  obstacles.setMode(params.gizmoMode);

  // ---- post processing --------------------------------------------------------------------
  const post = new RenderPipeline(renderer);
  const scenePass = pass(scene, camera);
  const scenePassColor = scenePass.getTextureNode();
  const bloomPass = bloom(scenePassColor, params.bloom, 0.6, 0.85);
  post.outputNode = scenePassColor.add(bloomPass);

  function setCamera(preset: Preset) {
    const c = preset.camera;
    if (!c) return;
    camera.position.set(...c.position);
    controls.target.set(...c.target);
    controls.update();
  }
  setCamera(PRESETS[0]);

  // ---- rebuilding -------------------------------------------------------------------------
  // Built on first use, so the diagnostic path costs nothing and cannot disturb a normal run.
  let probes: FieldProbe[] | null = null;

  /** One probe per ping-pong parity, so a readback always inspects the freshest buffers. */
  function getProbes() {
    if (!probes) {
      const g = gridOps(solver.res);
      const channels = solver.probeChannels();
      probes = [0, 1].map(
        (parity) => new FieldProbe(renderer, g, solver.probeTextures(parity), channels),
      );
    }
    return probes;
  }

  function rebuildAudioProbes(): void {
    if (!FLAME_AUDIO_ENABLED) {
      audioProbes = null;
      return;
    }
    const g = gridOps(solver.res);
    const channels = solver.audioProbeChannels();
    audioProbes = [0, 1].map(
      (parity) =>
        new FieldProbe(renderer, g, solver.probeTextures(parity), channels, AUDIO_PROBE_STRIDE),
    );
    audioProbeBusy = false;
    audioProbeAge = AUDIO_PROBE_PERIOD;
  }
  rebuildAudioProbes();

  function tickFlameAudio(dt: number): void {
    if (!FLAME_AUDIO_ENABLED) return;
    let stir = 0;
    const slots = solver.uniforms.obstacles;
    const base = obstacles.count;
    for (let i = 0; i < MAX_HAND_SOLIDS; i++) {
      const v = slots[base + i]?.velocity.value;
      if (v) stir = Math.max(stir, v.length());
    }
    for (let i = 0; i < base; i++) {
      const v = slots[i]?.velocity.value;
      if (v) stir = Math.max(stir, v.length());
    }
    flameAudio.setDrivers({ stir });

    audioProbeAge += dt;
    const probe = audioProbes?.[solver.currentParity];
    if (probe && !audioProbeBusy && audioProbeAge >= AUDIO_PROBE_PERIOD) {
      audioProbeAge = 0;
      audioProbeBusy = true;
      void probe
        .read()
        .then((stats) => {
          audioProbeBusy = false;
          flameAudio.setDrivers({
            heat: stats.maxHeat?.value ?? 0,
            temperature: stats.maxTemperature?.value ?? 300,
            speed: stats.maxSpeed?.value ?? 0,
            expansion: stats.maxExpansion?.value ?? 0,
            fuel: stats.maxFuel?.value ?? 0,
          });
        })
        .catch(() => {
          audioProbeBusy = false;
        });
    }
    flameAudio.update(dt);
  }

  function rebuild() {
    volume.mesh.removeFromParent();
    sparks.mesh.removeFromParent();
    sparks.dispose();
    solver.dispose();
    volume.dispose();

    solver = new KoraSolver(renderer, params, noise);
    volume = new VolumeRenderer(
      { field: solver.renderField, blur: solver.renderBlur, solid: solver.fields.solid },
      params.domainSize,
    );
    sparks = makeSparks();
    immersive.attach(volume.mesh);
    immersive.attach(sparks.mesh);
    solver.reset();
    sparks.reset(renderer);
    probes = null;
    rebuildAudioProbes();

    // The reference geometry is sized to the domain, so it is rebuilt rather than reused.
    domainHelper.removeFromParent();
    disposeHelper(domainHelper);
    domainHelper = createDomainHelper(params.domainSize);
    domainHelper.visible = params.showGrid;
    immersive.attach(domainHelper);

    immersive.setDomainSize(params.domainSize);

    // A rebuild means a fresh uniform block, so the displacement volumes have to be re-pointed at
    // it or they would carry on writing to the discarded one and freeze in place.
    obstacles.bind(solver.uniforms);
  }

  /**
   * A session renders the whole scene twice at headset resolution. Fire drops into a leaner
   * immersive budget for the duration (see `immersiveFire.ts`) and restores on exit.
   */
  let budgetBeforeXR: ImmersiveFireSnapshot | null = null;
  /**
   * Frames after the XR target is ready that draw reference geometry only.
   *
   * The first immersive submits recompile materials for the ArrayCamera / single-pass path and
   * routinely take close to a second on visionOS; the compositor ends the session before the
   * fire ever gets a chance. Cheap frames keep the session alive until that cost is paid.
   */
  let xrWarmupLeft = 0;

  /**
   * Session debug switches, as query parameters so a headset can be sent straight to a URL.
   *
   * `?bisect=1` draws the reference geometry only — see the note in the frame loop.
   *
   * `?flat=1` renders a session without tone mapping and in the working colour space. Both of
   * those are what make three interpose an intermediate target and copy out of it: in a session
   * that is a second full-size half-float array texture and a blit into the compositor's eye
   * textures every frame, and it is the least travelled path in the whole stack. Turning them off
   * has the scene drawn straight into the eye buffers. Colour will be wrong; that is not the point.
   */
  const flags = new URLSearchParams(location.search);
  let bisect = flags.has('bisect');
  const flatXR = flags.has('flat');
  if (bisect || flatXR) {
    console.info(`[kora/xr] debug flags: ${bisect ? 'bisect ' : ''}${flatXR ? 'flat' : ''}`.trim());
  }

  function enterImmersive() {
    controls.enabled = false;
    unlockAudio();
    // The transform gizmo is a mouse tool, and its thin axis handles are both unusable with a
    // hand ray and squarely in the way of the fire. Pinching a primitive replaces it.
    obstacles.setGizmoEnabled(false);

    budgetBeforeXR = snapshotFireBudget(params);
    handSolids.setEnabled(true);
    params.obstacleCount = fireObstacleBudget(obstacles.count, true);
    applyImmersiveFireBudget(params);
    // Rebuild for lean budget and newly reserved palm solid slots.
    refreshGui(gui);
    rebuild();
    immersive.setPlacement({
      distance: 0.48,
      height: 0.88,
      framedSize: IMMERSIVE_FIRE_FRAMED_SIZE,
      turntable: true,
    });
    xrWarmupLeft = 20;
    scoped = 0;

    if (flatXR) {
      renderer.toneMapping = NoToneMapping;
      renderer.outputColorSpace = LinearSRGBColorSpace;
    }
  }

  function exitImmersive() {
    controls.enabled = true;
    obstacles.setGizmoEnabled(true);
    applyPixelRatio(params.quality);
    xrWarmupLeft = 0;
    handSolids.setEnabled(false);
    params.obstacleCount = fireObstacleBudget(obstacles.count, false);

    if (flatXR) {
      renderer.toneMapping = ACESFilmicToneMapping;
      renderer.outputColorSpace = SRGBColorSpace;
    }

    immersive.setPlacement({
      distance: 0.48,
      height: 0.88,
      framedSize: 0.42,
      turntable: true,
    });

    if (budgetBeforeXR) {
      const snap = budgetBeforeXR;
      budgetBeforeXR = null;
      restoreFireBudget(params, snap);
      refreshGui(gui);
      rebuild();
    } else {
      rebuild();
    }
  }

  // The raymarcher is the only thing in the frame whose cost scales with pixels, so the tier
  // caps the device ratio rather than the window size.
  function applyPixelRatio(quality: Quality) {
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, QUALITY[quality].pixelRatio));
    renderer.setSize(window.innerWidth, window.innerHeight);
  }

  function disposeHelper(group: Group) {
    group.traverse((o) => {
      const line = o as Partial<Line>;
      line.geometry?.dispose();
      const material = line.material;
      if (Array.isArray(material)) material.forEach((m) => m.dispose());
      else material?.dispose();
    });
  }

  async function logProbe() {
    const stats = await getProbes()[solver.lastParity].read();

    const flat: Record<string, number | string> = {};
    for (const [label, s] of Object.entries(stats)) {
      const bad = [s.nan && `${s.nan} NaN`, s.infinite && `${s.infinite} Inf`].filter(Boolean);
      flat[label] = bad.length ? `${s.value} (${bad.join(', ')} of ${s.samples})` : s.value;
    }
    console.table(flat);
    return flat;
  }

  // The profiler drives the solver and the renderer itself and times the result, so the animation
  // loop has to stand down for the duration or its frames land in the middle of a measurement.
  let profiling = false;

  async function runProfile(options?: ProfileOptions) {
    if (profiling) return null;
    profiling = true;
    try {
      const result = await profile(
        {
          renderer,
          solver,
          render: () => post.render(),
          setVolumeVisible: (v) => {
            volume.mesh.visible = v;
          },
          setBloom: (s) => {
            bloomPass.strength.value = s;
          },
          bloomStrength: params.bloom,
        },
        options,
      );
      printProfile(result);
      return result;
    } finally {
      profiling = false;
      last = performance.now();
    }
  }

  let gui = createGui(params, callbacks());

  function callbacks() {
    return {
      onStructuralChange: rebuild,
      onPreset: (preset: Preset) => {
        params = applyPreset(params, preset);
        params.environment = 'night';
        params.backgroundIntensity = DEFAULT_INTENSITY.night;
        params.obstacleCount = fireObstacleBudget(obstacles.count, handSolids.active);
        gui.destroy();
        gui = createGui(params, callbacks());
        refreshGui(gui);
        void environment.set('night');
        environment.setIntensity(DEFAULT_INTENSITY.night);
        rebuild();
        setCamera(preset);
      },
      onReset: () => rebuild(),
      onDetonate: () => solver.detonate(1.0),
      onProbe: () => void logProbe(),
      onProfile: () => void runProfile(),
      onQuality: (q: Quality) => {
        params = applyQuality(params, q);
        applyPixelRatio(q);
        refreshGui(gui);
        rebuild();
      },
      onShowGrid: (visible: boolean) => {
        domainHelper.visible = visible;
      },
      onAddObstacle: (kind: ObstacleKind) => addObstacle(kind),
      onRemoveObstacle: () => {
        if (obstacles.selection !== null) obstacles.remove(obstacles.selection);
      },
      onGizmoMode: (mode: GizmoMode) => obstacles.setMode(mode),
      onEnvironment: (name: EnvironmentName) => {
        // The backdrops span a wide range of real exposures, so each carries its own starting
        // brightness; without it, daylight arrives orders of magnitude above the flame.
        params.backgroundIntensity = DEFAULT_INTENSITY[name];
        environment.setIntensity(params.backgroundIntensity);
        void environment.set(name);
        refreshGui(gui);
      },
    };
  }

  /**
   * Drops a primitive just above the emitter, where it is in the plume and obviously doing
   * something. A fixed fraction of the domain would land in clear air for the shorter presets.
   */
  function addObstacle(kind: ObstacleKind) {
    const at = params.sourcePosition.clone();
    at.y += params.sourceLength + 0.45;
    obstacles.add(kind, at);
  }

  // Exposed so the field statistics and parameters can be driven from the console or an
  // automated check, without going through the GUI.
  (window as unknown as Record<string, unknown>).kora = {
    probe: logProbe,
    profile: runProfile,
    setQuality: (q: Quality) => callbacks().onQuality(q),
    addObstacle: (kind: ObstacleKind = 'sphere') => addObstacle(kind),
    obstacles: () => obstacles,
    immersive: () => immersive,
    xrStatus: () => {
      const status = immersive.status();
      console.table(status);
      return status;
    },
    // Switchable mid-session: a warped image is one of a few placements of the frustum inside the
    // eye attachment, and looking at each is faster than deducing which the compositor wants.
    xrViewport: (policy: ViewportPolicy = 'full') => immersive.setViewportPolicy(policy),
    // The correction for a compositor that samples further across the layer than the layer goes.
    // Off renders the whole frustum into the corner it does not fit, which is the warp itself.
    xrCrop: (on = true) => {
      immersive.frustumCrop = on;
      return `frustum crop ${on ? 'on' : 'off'}`;
    },
    // three defaults this to 1 (max). 0 is Ada's "don't apply foveation twice" workaround.
    xrFoveation: (level = 0) => {
      renderer.xr.setFoveation(level);
      return renderer.xr.getFoveation();
    },
    xrViewportScale: (scale = 1) => immersive.setViewportScale(scale),
    // Only takes effect on the next session; a projection layer is fixed in size once built.
    xrLayerScale: (scale = 1) => immersive.setLayerScale(scale),
    xrBisect: (on = true) => {
      bisect = on;
      return `session rendering ${on ? 'reference geometry only' : 'everything'}`;
    },
    params: () => params,
    setDebugView: (v: KoraParams['debugView'], scale = 1) => {
      params.debugView = v;
      params.debugScale = scale;
      refreshGui(gui);
    },
    setParam: (name: string, value: unknown) => {
      (params as unknown as Record<string, unknown>)[name] = value;
      refreshGui(gui);
      return (params as unknown as Record<string, unknown>)[name];
    },
    // Refilling the domain only re-runs the init kernels; rebuilding tears down and recompiles
    // every compute graph, which is only needed when a parameter changes the graph's shape.
    reset: () => {
      solver.reset();
      sparks.reset(renderer);
    },
    // The hand shader is only ever seen inside a headset; this puts one on screen, and frames it,
    // so it can be looked at without one.
    previewHand: async (handedness: 'left' | 'right' = 'right') => {
      // Low on the plume axis, so the shell is judged against flame rather than against black.
      const at = new Vector3(0, params.domainSize * 0.3, 0);
      const object = await previewHand(scene, handedness, at);
      camera.position.set(at.x + 0.28, at.y + 0.1, at.z + 0.38);
      controls.target.copy(at);
      controls.update();
      return object;
    },
    // Drives the solver without the animation loop, for environments where requestAnimationFrame
    // never fires — an automated browser view, or a backgrounded tab.
    advance: async (count = 60, dt = 1 / 60) => {
      for (let i = 0; i < count; i++) {
        solver.step(dt);
        volume.update(params, frame++);
      }
      post.render();
      await device?.queue.onSubmittedWorkDone();
      return count;
    },
    rebuild: () => rebuild(),
    // Dispatches each pass alone inside an error scope, so a shader that fails to compile is
    // reported by name instead of as an anonymous pipeline in a cascade of follow-on errors.
    findBadPass: async () => {
      if (!device) return 'no device';
      const bad: { label: string; message: string }[] = [];
      for (const parity of [0, 1]) {
        for (const { label, node } of solver.passes(parity)) {
          device.pushErrorScope('validation');
          renderer.compute([node]);
          const err = await device.popErrorScope();
          if (err) bad.push({ label: `p${parity}/${label}`, message: err.message.split('\n')[0] });
        }
      }
      console.table(bad);
      return bad;
    },
    gpuErrors: () => {
      const errors = gpuErrorSummary();
      console.table(errors.map((e) => ({ count: e.count, message: e.message })));
      return errors;
    },
  };

  // ---- loop -------------------------------------------------------------------------------
  let last = performance.now();
  let frame = 0;
  let accum = 0;
  let frames = 0;
  let fps = 0;

  /**
   * Renders a session frame, with the first few wrapped in a validation error scope.
   *
   * The session dies on its first rendered frame and leaves nothing behind: no uncaptured error,
   * no lost device, not even the session's own `end` event. An error scope is the one report that
   * cannot go missing, because it resolves against the work this call submitted rather than
   * relying on a handler that may be torn down with the session.
   */
  let scoped = 0;

  function renderXR() {
    if (!device || scoped >= 3) {
      renderer.render(scene, camera);
      return;
    }

    const nth = ++scoped;
    const started = performance.now();

    device.pushErrorScope('validation');
    try {
      renderer.render(scene, camera);
    } catch (error) {
      console.error(`[kora] XR render ${nth} threw:`, error);
    }
    void device.popErrorScope().then((error) => {
      if (error) console.error(`[kora] XR render ${nth} was invalid: ${error.message}`);
      else console.info(`[kora/xr] render ${nth} validated clean`);
    });

    // The session stays open but stops asking for frames, which is what a compositor does while
    // it waits on work that never finishes. This says whether the queue actually drained, and how
    // long it took — a line that never arrives is a hung queue, and a slow one is a budget problem.
    void device.queue.onSubmittedWorkDone().then(() => {
      console.info(`[kora/xr] render ${nth} finished on the GPU after ${Math.round(performance.now() - started)} ms`);
    });
  }

  function animate(_time?: number, xrFrame?: XRFrame) {
    if (profiling) return;

    const now = performance.now();
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;

    accum += dt;
    frames++;
    if (accum > 0.5) {
      fps = frames / accum;
      accum = 0;
      frames = 0;
    }

    solver.params.bloom = params.bloom;
    bloomPass.strength.value = params.bloom;
    environment.setIntensity(params.backgroundIntensity);

    // Bisect strips everything for plumbing diagnosis. Warmup keeps the volume visible so its
    // shaders compile under a live session, but skips the solver and sparks — the compositor
    // ends a session that spends a second on the first immersive submits.
    const warming = immersive.rendering && xrWarmupLeft > 0;
    const stripped = bisect && immersive.active;
    const simulate = !stripped && !warming;

    if (simulate) {
      // Before the step, so the velocity a dragged primitive picked up this frame is the boundary
      // flux the projection sees rather than one frame stale.
      obstacles.update(dt);
      handSolids.update(
        solver.uniforms,
        obstacles.count,
        immersive.contentRoot,
        renderer,
        immersive.active ? xrFrame : undefined,
        dt,
      );
      // Stereo raymarching already owns the frame; throttle the Euler solve in a session.
      const interval = IMMERSIVE_FIRE_SOLVE_INTERVAL;
      if (!immersive.active || frame % interval === 0) {
        solver.step(immersive.active ? dt * interval : dt);
      }
      volume.update(params, frame++);

      // After the step, so the embers spawn from the reaction zone and ride the velocity field
      // this frame actually produced rather than last frame's. Sparks are off in XR — dual-eye
      // overdraw for a garnish the session cannot afford.
      sparks.update(params);
      if (params.sparksEnabled && !immersive.active) {
        sparks.step(renderer, solver.currentParity, dt, frame);
      }
      tickFlameAudio(dt);
    } else if (!stripped) {
      // Warmup still needs the volume's uniforms current for the compile/draw.
      volume.update(params, frame);
    }

    volume.mesh.visible = !stripped;
    sparks.mesh.visible = !stripped && params.sparksEnabled && !immersive.active;

    if (immersive.active) {
      immersive.update(xrFrame ?? null, dt);
      hands.update();

      // `rendering`, not `active`: the first frames of a session go by before the renderer is
      // bound and its eye buffers are sized, and drawing into those is drawing into nothing.
      // Skipping the frame entirely is the point — the desktop path would composite to the canvas
      // while the renderer is pointed at the headset.
      if (immersive.rendering) {
        // The bloom pass composites through a screen-space render target, which is not something
        // the XR projection layer's per-eye array texture will accept. In a session the volume
        // goes straight to the eye buffers and loses its glow.
        renderXR();
        if (xrWarmupLeft > 0) {
          xrWarmupLeft--;
          if (xrWarmupLeft === 0) {
            console.info('[kora/xr] warmup done, enabling the fire');
          }
        }
      }
    } else {
      controls.update();
      post.render();
    }

    const n = params.resolution;
    statsEl.textContent = `${n}^3 · ${(n ** 3 / 1e6).toFixed(2)} M voxels · ${fps.toFixed(0)} fps · ${params.fuel}`;
  }

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    applyPixelRatio(params.quality);
  });

  window.addEventListener('keydown', (e) => {
    if (e.target instanceof HTMLInputElement) return;

    if (e.key === ' ') {
      e.preventDefault();
      solver.detonate(1.0);
    }

    // three's own convention for its transform gizmo, so it is where anyone expects it.
    const mode = { w: 'translate', e: 'rotate', r: 'scale' }[e.key.toLowerCase()];
    if (mode) obstacles.setMode(mode as GizmoMode);

    if (e.key === 'Escape') obstacles.select(null);
  });

  // Not requestAnimationFrame: inside a session three has to drive the loop from the headset's
  // own frame callback, and setAnimationLoop is what lets it take over.
  renderer.setAnimationLoop(animate);

  void immersive.mountButton(document.getElementById('xr-button') as HTMLButtonElement);
}

main().catch((err) => {
  console.error(err);
  document.getElementById('unsupported')?.classList.add('show');
});
