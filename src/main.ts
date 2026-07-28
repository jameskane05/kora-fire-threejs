import {
  ACESFilmicToneMapping,
  Color,
  type Group,
  type Line,
  PerspectiveCamera,
  RenderPipeline,
  Scene,
  WebGPURenderer,
} from 'three/webgpu';
import { pass } from 'three/tsl';
import { bloom } from 'three/addons/tsl/display/BloomNode.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

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
import { QUALITY, QUALITY_TIERS, applyQuality, type Quality } from './ui/quality';
import { ImmersiveMode } from './xr/ImmersiveMode';

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
    antialias: false,
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
  if (device) installGpuErrorReporter(device);

  disarmTimestamps(renderer);

  const scene = new Scene();
  scene.background = new Color(0x05060a);

  const camera = new PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.05, 200);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.maxPolarAngle = Math.PI * 0.92;

  const noise = createNoiseVolume(32);
  let params: KoraParams = applyPreset({ ...defaultParams }, PRESETS[0]);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, QUALITY[params.quality].pixelRatio));

  let solver = new KoraSolver(renderer, params, noise);
  let volume = new VolumeRenderer(
    { field: solver.renderField, blur: solver.renderBlur },
    params.domainSize,
  );
  // Everything the viewer looks at hangs off the immersive rig, which is inert on the desktop
  // and becomes the thing the pointer turns once a session starts.
  const immersive = new ImmersiveMode(renderer, {
    onEnter: () => enterImmersive(),
    onExit: () => exitImmersive(),
  });
  scene.add(immersive.rig);

  immersive.attach(volume.mesh);
  solver.reset();

  let domainHelper = createDomainHelper(params.domainSize);
  domainHelper.visible = params.showGrid;
  immersive.attach(domainHelper);
  immersive.setDomainSize(params.domainSize);

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

  function rebuild() {
    volume.mesh.removeFromParent();
    solver.dispose();

    solver = new KoraSolver(renderer, params, noise);
    volume = new VolumeRenderer(
      { field: solver.renderField, blur: solver.renderBlur },
      params.domainSize,
    );
    immersive.attach(volume.mesh);
    solver.reset();
    probes = null;

    // The reference geometry is sized to the domain, so it is rebuilt rather than reused.
    domainHelper.removeFromParent();
    disposeHelper(domainHelper);
    domainHelper = createDomainHelper(params.domainSize);
    domainHelper.visible = params.showGrid;
    immersive.attach(domainHelper);

    immersive.setDomainSize(params.domainSize);
  }

  /**
   * A session renders the whole scene twice at headset resolution, which is a great deal more
   * raymarching than a window. Anything above the immersive tier is stepped down for the
   * duration and put back on exit, since a fire that judders is worse than one with less detail.
   */
  const IMMERSIVE_QUALITY: Quality = 'balanced';
  let qualityBeforeXR: Quality | null = null;

  function enterImmersive() {
    controls.enabled = false;

    const order = QUALITY_TIERS.indexOf(params.quality);
    if (order < QUALITY_TIERS.indexOf(IMMERSIVE_QUALITY)) {
      qualityBeforeXR = params.quality;
      params = applyQuality(params, IMMERSIVE_QUALITY);
      refreshGui(gui);
      rebuild();
    }
  }

  function exitImmersive() {
    controls.enabled = true;
    applyPixelRatio(params.quality);

    if (qualityBeforeXR) {
      params = applyQuality(params, qualityBeforeXR);
      qualityBeforeXR = null;
      refreshGui(gui);
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
        gui.destroy();
        gui = createGui(params, callbacks());
        refreshGui(gui);
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
    };
  }

  // Exposed so the field statistics and parameters can be driven from the console or an
  // automated check, without going through the GUI.
  (window as unknown as Record<string, unknown>).kora = {
    probe: logProbe,
    profile: runProfile,
    setQuality: (q: Quality) => callbacks().onQuality(q),
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
    reset: () => solver.reset(),
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

    solver.step(dt);
    volume.update(params, frame++);

    if (immersive.active) {
      immersive.update(xrFrame ?? null, dt);
      // The bloom pass composites through a screen-space render target, which is not something
      // the XR projection layer's per-eye array texture will accept. In a session the volume
      // goes straight to the eye buffers and loses its glow.
      renderer.render(scene, camera);
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
    if (e.key === ' ') {
      e.preventDefault();
      solver.detonate(1.0);
    }
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
