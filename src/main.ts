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
import { QUALITY, applyQuality, type Quality } from './ui/quality';

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
  scene.add(volume.mesh);
  solver.reset();

  let domainHelper = createDomainHelper(params.domainSize);
  domainHelper.visible = params.showGrid;
  scene.add(domainHelper);

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
    scene.remove(volume.mesh);
    solver.dispose();

    solver = new KoraSolver(renderer, params, noise);
    volume = new VolumeRenderer(
      { field: solver.renderField, blur: solver.renderBlur },
      params.domainSize,
    );
    scene.add(volume.mesh);
    solver.reset();
    probes = null;

    // The reference geometry is sized to the domain, so it is rebuilt rather than reused.
    scene.remove(domainHelper);
    disposeHelper(domainHelper);
    domainHelper = createDomainHelper(params.domainSize);
    domainHelper.visible = params.showGrid;
    scene.add(domainHelper);
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

  function animate() {
    requestAnimationFrame(animate);
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

    controls.update();
    solver.params.bloom = params.bloom;
    bloomPass.strength.value = params.bloom;

    solver.step(dt);
    volume.update(params, frame++);
    post.render();

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

  animate();
}

main().catch((err) => {
  console.error(err);
  document.getElementById('unsupported')?.classList.add('show');
});
