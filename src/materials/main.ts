/**
 * AVP sandbox — fire + MLS-MPM sand / goo / water + AVBD rigids in one WebXR host.
 */
import {
  ACESFilmicToneMapping,
  BoxGeometry,
  CylinderGeometry,
  DoubleSide,
  GridHelper,
  Matrix4,
  Mesh,
  MeshBasicNodeMaterial,
  PerspectiveCamera,
  Quaternion,
  Scene,
  StorageInstancedBufferAttribute,
  Vector3,
  WebGPURenderer,
} from 'three/webgpu';
import { REQUESTED_MAX_STORAGE_BUFFERS_PER_SHADER_STAGE } from './webphysics/gpuLimits';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { ImmersiveMode } from '../xr/ImmersiveMode';
import { Hands } from '../xr/Hands';
import { HAND_BONES, gatherHandObbs } from '../xr/handObbs';
import { DEFAULT_INTENSITY, Environment, type EnvironmentName } from '../scene/Environment';
import { MAX_FORCES, MlsMpm, type ForcePoint, type MaterialKind } from './MlsMpm';
import { createParticleSurfaceMesh } from './GooMaterial';
import { GelSurface } from './GelSurface';
import { FireExhibit } from './FireExhibit';
import { AvbdExhibit } from './AvbdExhibit';
import { AvbdGpuExhibit } from './AvbdGpuExhibit';
import {
  DEFAULT_STACK_PRESET,
  isStackPreset,
  presetLabel,
  presetsByGroup,
  type StackPreset,
} from './webphysics/presets';
import { isColiseumDemoVariant } from './webphysics/scene/coliseumDemo';
import { type MaterialAction, type SandboxExhibit } from './MaterialPanel';
import { FPSController } from './webphysics/scene/fpsController';
import { Vector3 as ThreeVector3 } from 'three';
import { SandboxHud } from './SandboxHud';
import { ForceColliders } from './ForceColliders';
import { createMaterialsGui, type MaterialsGui } from './gui';
import { defaultMaterialsParams } from './params';
import type { GizmoMode } from '../sim/obstacles';
import { WATER_AUDIO_ENABLED, WaterAudio } from '../audio/WaterAudio';

const DOMAIN = 1.0;
/** How often to pull particle speed aggregates for the water audio bus (seconds). */
const WATER_AUDIO_PROBE_PERIOD = 0.04;
const MPM_PLACEMENT = {
  distance: 0.48,
  height: 0.88,
  framedSize: 0.42,
  turntable: false,
} as const;

/**
 * DEFAULT_INTENSITY is pulled way down on the bright skies so the fire stays the brightest thing
 * in frame. The MPM and physics exhibits have no such constraint — daylight at 0.12 just leaves
 * them in the dark — so they get the backdrops closer to their real exposure.
 */
const LIT_INTENSITY: Record<EnvironmentName, number> = {
  void: 1,
  studio: 0.9,
  dusk: 0.8,
  daylight: 0.5,
  night: 1.6,
};

const _world = new Vector3();
const _worldB = new Vector3();
const _local = new Vector3();
const _localB = new Vector3();
const _mid = new Vector3();
const _axisX = new Vector3();
const _axisY = new Vector3();
const _axisZ = new Vector3();
const _scale = new Vector3();
const _quat = new Quaternion();
const _invParent = new Matrix4();

/** Build an orthonormal frame with +X along `axisX` (already normalized). */
function makeBoneBasis(axisX: Vector3, axisY: Vector3, axisZ: Vector3): void {
  axisY.addScaledVector(axisX, -axisY.dot(axisX));
  if (axisY.lengthSq() < 1e-8) {
    axisY.set(0, 1, 0);
    if (Math.abs(axisX.y) > 0.9) axisY.set(1, 0, 0);
    axisY.addScaledVector(axisX, -axisY.dot(axisX));
  }
  axisY.normalize();
  axisZ.crossVectors(axisX, axisY).normalize();
  axisY.crossVectors(axisZ, axisX).normalize();
}

function emptyForce(): ForcePoint {
  return {
    x: 0,
    y: 0,
    z: 0,
    strength: 0,
    radius: 0.05,
    isBox: false,
    isCapsule: false,
    hx: 0.05,
    hy: 0.05,
    hz: 0.05,
    ax: 1,
    ay: 0,
    az: 0,
    bx: 0,
    by: 1,
    bz: 0,
    cx: 0,
    cy: 0,
    cz: 1,
  };
}

async function main() {
  if (!navigator.gpu) {
    document.getElementById('unsupported')?.classList.add('show');
    return;
  }

  const app = document.getElementById('app');
  const statsEl = document.getElementById('stats');
  const xrButton = document.getElementById('xr-button') as HTMLButtonElement | null;
  if (!app) return;

  // Match webphysics device creation: core adapter (not three's default compatibility
  // featureLevel) + subgroups. Without subgroups, LBVH falls back to a slow radix sort and
  // spring-scale scenes rebuild BVH every frame at ~30fps.
  // https://www.webgpu.com/showcase/webphysics-webgpu-avbd-solver/
  const adapter = await navigator.gpu.requestAdapter({
    powerPreference: 'high-performance',
    xrCompatible: true,
  });
  if (!adapter) throw new Error('WebGPU adapter missing');

  // `?nosubgroups=1` reproduces Safari's device on a subgroup-capable adapter, so the LBVH
  // fallback paths can be debugged in Chrome instead of on the headset.
  const forceNoSubgroups = new URLSearchParams(window.location.search).get('nosubgroups') === '1';

  const requiredFeatures: GPUFeatureName[] = [];
  if (!forceNoSubgroups && adapter.features.has('subgroups' as GPUFeatureName)) {
    requiredFeatures.push('subgroups' as GPUFeatureName);
  } else {
    console.warn(
      'GPU AVBD: subgroups unavailable — LBVH onesweep disabled; large scenes will be much slower than webphysics.',
    );
  }
  if (adapter.features.has('timestamp-query')) requiredFeatures.push('timestamp-query');

  const requiredLimits: Record<string, number> = {};
  // Fire needs storage-texture headroom; MPM is happy with the buffer limits alone.
  // GPU AVBD (webphysics) needs ≥10 storage buffers per compute stage (default is often 8).
  for (const limit of [
    'maxStorageTexturesPerShaderStage',
    'maxSampledTexturesPerShaderStage',
    'maxStorageBuffersPerShaderStage',
    'maxComputeInvocationsPerWorkgroup',
    'maxBufferSize',
    'maxStorageBufferBindingSize',
  ] as const) {
    const value = adapter.limits?.[limit as keyof GPUSupportedLimits];
    if (typeof value === 'number') requiredLimits[limit] = value;
  }
  const storageBufLimit = Math.min(
    REQUESTED_MAX_STORAGE_BUFFERS_PER_SHADER_STAGE,
    adapter.limits.maxStorageBuffersPerShaderStage,
  );
  requiredLimits.maxStorageBuffersPerShaderStage = storageBufLimit;

  // Instanced body/particle visuals read pose storage buffers from the vertex shader. Core mode is
  // supposed to derive these from maxStorageBuffersPerShaderStage, but compat mode defaults them to
  // zero, so ask explicitly rather than trusting the device to infer it.
  const adapterLimits = adapter.limits as unknown as Record<string, number | undefined>;
  for (const stageLimit of ['maxStorageBuffersInVertexStage', 'maxStorageBuffersInFragmentStage']) {
    const available = adapterLimits[stageLimit];
    if (typeof available !== 'number') continue;
    requiredLimits[stageLimit] = Math.min(available, storageBufLimit);
  }
  if (storageBufLimit < REQUESTED_MAX_STORAGE_BUFFERS_PER_SHADER_STAGE) {
    console.warn(
      `GPU AVBD wants ${REQUESTED_MAX_STORAGE_BUFFERS_PER_SHADER_STAGE} storage buffers/stage; adapter only has ${adapter.limits.maxStorageBuffersPerShaderStage}. Physics scenes may fail.`,
    );
  }

  const device = await adapter.requestDevice({
    requiredFeatures,
    requiredLimits,
  });

  // three creates pipelines inside its own error scopes, so a rejected bind group layout can
  // silently produce a mesh that never draws. Surface anything the renderer does not report.
  device.addEventListener('uncapturederror', (event) => {
    console.error('WebGPU uncaptured error:', (event as GPUUncapturedErrorEvent).error.message);
  });

  {
    const limits = device.limits as unknown as Record<string, number | undefined>;
    console.warn(
      'GPU storage buffer limits — perStage:', limits.maxStorageBuffersPerShaderStage,
      'vertex:', limits.maxStorageBuffersInVertexStage,
      'fragment:', limits.maxStorageBuffersInFragmentStage,
    );
  }

  const renderer = new WebGPURenderer({
    antialias: true,
    forceWebGL: false,
    device,
    requiredLimits,
  } as ConstructorParameters<typeof WebGPURenderer>[0]);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  app.appendChild(renderer.domElement);
  // Set before init(): three forwards xrCompatible from this flag when it owns the device;
  // we already requested an xrCompatible adapter above for the same reason.
  renderer.xr.enabled = true;
  await renderer.init();

  if (!device.features.has('subgroups' as GPUFeatureName)) {
    console.warn('GPU device features:', [...device.features.values()].join(', ') || '(none)');
  }

  const scene = new Scene();
  const environment = new Environment(scene);
  void environment.set('night');
  environment.setIntensity(1.6);

  const camera = new PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.05, 1000);
  camera.position.set(1.6, 1.2, 1.6);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 0.35, 0);
  controls.enableDamping = true;

  let xrWarmupFrames = 0;
  let exhibit: SandboxExhibit = 'sand';
  const waterAudio = new WaterAudio();

  const orbitAllowed = () =>
    !immersive.active && !(exhibit === 'avbd' && !useCpuAvbd && !!avbdGpu.usesFpsControls?.());

  const forceColliders = new ForceColliders(camera, renderer.domElement, (dragging) => {
    controls.enabled = !dragging && orbitAllowed();
  });
  forceColliders.setDomain(DOMAIN);

  const immersive = new ImmersiveMode(renderer, {
    onEnter: () => {
      controls.enabled = false;
      forceColliders.setGizmoEnabled(false);
      xrWarmupFrames = 20;
      if (exhibit === 'fire') {
        fire.resumeAudio();
        fire.enterImmersive();
      }
      if (exhibit === 'avbd' && !useCpuAvbd) avbdGpu.enterImmersive();
      if (WATER_AUDIO_ENABLED && exhibit === 'water') {
        void waterAudio.resume();
      }
      gel.setQuality('immersive');
    },
    onExit: () => {
      controls.enabled = orbitAllowed();
      forceColliders.setGizmoEnabled(exhibit !== 'fire' && exhibit !== 'avbd');
      fire.exitImmersive();
      avbdGpu.exitImmersive();
      gel.setQuality('desktop');
      xrWarmupFrames = 0;
      if (exhibit === 'avbd') syncAvbdControls();
    },
  });
  scene.add(immersive.rig);
  scene.add(immersive.hud);
  immersive.setDomainSize(DOMAIN);
  immersive.setPlacement({ ...MPM_PLACEMENT });
  immersive.attach(forceColliders.group);
  scene.add(forceColliders.helper);
  // Sit beside the goo/AVBD dome — drag into the gel to poke (AVBD uses kinematic contact).
  forceColliders.add('box', new Vector3(0.42, 0.1, 0.0));

  const fire = new FireExhibit(
    renderer,
    immersive,
    environment,
    scene,
    camera,
    (dragging) => {
      controls.enabled = !dragging && orbitAllowed();
    },
  );
  const useCpuAvbd = new URLSearchParams(location.search).has('avbdCpu');
  const avbdGpu = new AvbdGpuExhibit(immersive);
  const avbdCpu = new AvbdExhibit(immersive);
  if (useCpuAvbd) {
    avbdCpu.init();
  } else {
    avbdGpu.init(renderer, device);
  }
  type AvbdFacade = {
    isReady: boolean;
    currentScene: string;
    bodyCount: number;
    springCount: number;
    iterations: number;
    lastStepMs: number;
    lastCutCount: number;
    setActive: (on: boolean) => void;
    setScene: (id: string) => boolean | void;
    reset: () => void;
    resetSimulation?: () => void;
    step: (dt: number, forces: ForcePoint[]) => void;
    prepareBench?: () => void;
    usesFpsControls?: () => boolean;
    shoot?: (config: {
      position: [number, number, number];
      direction: [number, number, number];
      averageSpeed: number;
      speedJitter?: number;
      angularJitter?: number;
    }) => boolean;
    applyCamera?: (camera: PerspectiveCamera, controls?: { target: { set: (x: number, y: number, z: number) => void } }) => void;
    softCom?: () => { x: number; y: number; z: number };
    sceneStatusText?: () => string | null;
  };
  const avbd: AvbdFacade = useCpuAvbd ? avbdCpu : avbdGpu;

  const avbdFps = new FPSController(camera as unknown as ConstructorParameters<typeof FPSController>[0], renderer.domElement, {
    eyeHeight: 0.75,
    groundY: 0,
    moveSpeed: 7,
    freeFly: true,
    mouseSensitivity: 0.0024,
    tryPrimaryGrab: (event) => {
      if (useCpuAvbd || !avbdGpu.usesFpsControls()) return false;
      return avbdGpu.beginBodyDrag(
        event.clientX,
        event.clientY,
        renderer.domElement,
        camera as unknown as PerspectiveCamera,
      );
    },
    onPrimaryGrabMove: (event) => {
      if (!avbdGpu.isBodyDragging()) return;
      avbdGpu.updateBodyDrag(
        event.clientX,
        event.clientY,
        renderer.domElement,
        camera as unknown as PerspectiveCamera,
      );
    },
    onPrimaryGrabEnd: () => {
      avbdGpu.endBodyDrag();
    },
  });
  avbdFps.setEnabled(false);
  const fireOrigin = new ThreeVector3();
  const fireDirection = new ThreeVector3();
  let triggerHeld = false;
  let fireAccumulator = 0;
  const hands = new Hands(renderer, scene);
  const matParams = defaultMaterialsParams();
  const hud = new SandboxHud(matParams, 'sand');
  immersive.setActionPanel(hud);
  // Gizmo mode lives on the paginated HUD (and double-pinch), not the legacy ModePanel strip.
  immersive.setModePanelEnabled(false);

  hud.bindFire(
    () => fire.koraParams,
    (mode) => fire.setGizmoMode(mode),
  );
  fire.onWorldUiChange = () => hud.refreshParams();

  const basin = new Mesh(
    new BoxGeometry(DOMAIN, DOMAIN * 0.02, DOMAIN),
    new MeshBasicNodeMaterial({ color: 0x2a2a32 }),
  );
  basin.position.set(0, 0.01, 0);
  immersive.attach(basin);
  const grid = new GridHelper(DOMAIN, 10, 0x444450, 0x2a2a32);
  grid.position.y = 0.02;
  immersive.attach(grid);

  // Open glass tank + pillar so water has a clear pour target / displacer.
  const glassMat = new MeshBasicNodeMaterial({
    color: 0x7ec8e3,
    transparent: true,
    opacity: 0.14,
    side: DoubleSide,
    depthWrite: false,
  });
  const wallH = 0.42;
  const wallT = 0.02;
  const tankHalf = DOMAIN * 0.48;
  const walls: Mesh[] = [
    new Mesh(new BoxGeometry(DOMAIN * 0.96, wallH, wallT), glassMat),
    new Mesh(new BoxGeometry(DOMAIN * 0.96, wallH, wallT), glassMat),
    new Mesh(new BoxGeometry(wallT, wallH, DOMAIN * 0.96), glassMat),
    new Mesh(new BoxGeometry(wallT, wallH, DOMAIN * 0.96), glassMat),
  ];
  walls[0].position.set(0, wallH * 0.5, -tankHalf);
  walls[1].position.set(0, wallH * 0.5, tankHalf);
  walls[2].position.set(-tankHalf, wallH * 0.5, 0);
  walls[3].position.set(tankHalf, wallH * 0.5, 0);
  for (const w of walls) {
    w.visible = false;
    immersive.attach(w);
  }

  const pillar = new Mesh(
    new CylinderGeometry(0.11, 0.11, 0.5, 24),
    new MeshBasicNodeMaterial({ color: 0x5a5348 }),
  );
  // Match sim pillar at (0.62, *, 0.38) → world (0.12, 0.25, -0.12)
  pillar.position.set(0.12, 0.25, -0.12);
  pillar.visible = false;
  immersive.attach(pillar);

  const setWaterPropsVisible = (on: boolean) => {
    for (const w of walls) w.visible = on;
    pillar.visible = on;
  };

  const sim = new MlsMpm({
    gridN: 48,
    // Capacity = 2× base so water can run denser; sand/goo stay at base count.
    particleCount: 24576 * 2,
    substeps: 14,
    subDt: 2.4e-4,
  });
  await sim.init(device);
  sim.bindParams(matParams);
  sim.reset('sand');

  const prevForcePos = new Float32Array(MAX_FORCES * 3);
  let prevForceCount = 0;
  let waterAudioProbeAge = WATER_AUDIO_PROBE_PERIOD;
  let waterAudioProbeBusy = false;

  function stirFromForces(forces: ForcePoint[], dt: number): { stirEnergy: number; contactCount: number } {
    let energy = 0;
    const invDt = 1 / Math.max(dt, 1e-4);
    for (let i = 0; i < forces.length; i++) {
      const f = forces[i];
      let speed = 0;
      if (i < prevForceCount) {
        const dx = f.x - prevForcePos[i * 3];
        const dy = f.y - prevForcePos[i * 3 + 1];
        const dz = f.z - prevForcePos[i * 3 + 2];
        speed = Math.hypot(dx, dy, dz) * invDt;
      }
      energy += Math.abs(f.strength) * speed;
      prevForcePos[i * 3] = f.x;
      prevForcePos[i * 3 + 1] = f.y;
      prevForcePos[i * 3 + 2] = f.z;
    }
    prevForceCount = forces.length;
    return { stirEnergy: energy, contactCount: forces.length };
  }

  function setWaterAudioEnabled(on: boolean): void {
    waterAudio.setEnabled(on);
    if (on) void waterAudio.resume();
  }

  // Unlock AudioContext on first user gesture while water is showing.
  const resumeWaterAudioOnce = () => {
    if (exhibit === 'water') void waterAudio.resume();
  };
  renderer.domElement.addEventListener('pointerdown', resumeWaterAudioOnce);
  document.getElementById('toolbar')?.addEventListener('click', resumeWaterAudioOnce);

  function tickWaterAudio(dt: number, forces: ForcePoint[] | null): void {
    if (!WATER_AUDIO_ENABLED) return;
    if (exhibit === 'water' && forces) {
      const stir = stirFromForces(forces, dt);
      waterAudio.setDrivers({
        stirEnergy: stir.stirEnergy,
        contactCount: stir.contactCount,
      });
      waterAudioProbeAge += dt;
      if (!waterAudioProbeBusy && waterAudioProbeAge >= WATER_AUDIO_PROBE_PERIOD) {
        waterAudioProbeAge = 0;
        waterAudioProbeBusy = true;
        void sim
          .readMotionStats(16)
          .then((stats) => {
            waterAudioProbeBusy = false;
            if (stats && exhibit === 'water') {
              waterAudio.setDrivers({
                meanSpeed: stats.meanSpeed,
                maxSpeed: stats.maxSpeed,
              });
            }
          })
          .catch(() => {
            waterAudioProbeBusy = false;
          });
      }
    }
    waterAudio.update(dt);
  }

  const capacity = sim.capacity;
  // Must be instanced — a plain StorageBufferAttribute makes every sprite read particle 0.
  const posAttr = new StorageInstancedBufferAttribute(capacity, 4);
  const velAttr = new StorageInstancedBufferAttribute(capacity, 4);
  const { mesh: points, setKind: setSurfaceKind } = createParticleSurfaceMesh(
    capacity,
    DOMAIN,
    posAttr,
    velAttr,
  );
  points.count = sim.particleCount;
  immersive.attach(points);

  points.visible = true;
  let statsDirty = true;

  // Goo renders as an isosurface raymarched from a density field. The march is a plain forward
  // pass with no framebuffer read, so it costs the same on a headset as on desktop and does not
  // need an offscreen target — `?gel=0` falls back to bead impostors.
  const gel = new GelSurface(DOMAIN);
  await gel.init(device, sim.renderBuffer, capacity);
  immersive.attach(gel.mesh);
  let gelWanted = new URLSearchParams(location.search).get('gel') !== '0';
  let mpmVisible = true;
  let gelFrame = 0;

  const viewBtn = document.getElementById('mat-view');
  if (viewBtn) viewBtn.hidden = true;

  function attrGpuBuffer(attr: StorageInstancedBufferAttribute): GPUBuffer | undefined {
    const backend = (
      renderer as unknown as { backend: { get: (a: unknown) => { buffer?: GPUBuffer } } }
    ).backend;
    return backend.get(attr)?.buffer;
  }

  let materialKind: MaterialKind = 'sand';

  /** AVBD soft gel shares goo’s force scale / bone thickness. */
  function forceMaterial(): MaterialKind {
    return exhibit === 'avbd' ? 'goo' : materialKind;
  }

  function handForceStrength(bone: { from: string; to: string; palm?: boolean }): number {
    const kind = forceMaterial();
    const base = matParams.handForce * matParams[kind].handForceScale;
    if (bone.palm) return base * 0.85;
    if (bone.to.endsWith('-tip')) return base;
    return base * 0.95;
  }

  function fallbackBoneRadius(bone: { from: string; to: string; palm?: boolean }): number {
    const kind = forceMaterial();
    const tip = kind === 'sand' ? 0.01 : kind === 'water' ? 0.012 : 0.011;
    if (bone.palm) return tip * 1.7;
    if (bone.to.endsWith('-tip')) return tip;
    return tip * 0.85;
  }

  const forcePool: ForcePoint[] = Array.from({ length: MAX_FORCES }, () => emptyForce());
  const activeForces: ForcePoint[] = [];

  function colliderForces(): ForcePoint[] {
    const kind = forceMaterial();
    const strength = matParams.handForce * matParams[kind].handForceScale;
    return forceColliders.toForces(strength);
  }

  function gatherForces(xrFrame?: XRFrame): ForcePoint[] {
    activeForces.length = 0;
    if (!immersive.active) {
      return colliderForces();
    }

    const session = renderer.xr.getSession();
    const refSpace = renderer.xr.getReferenceSpace();
    if (!session || !refSpace || !xrFrame) return colliderForces();

    const parent = points.parent;
    if (!parent) return activeForces;
    parent.updateMatrixWorld(true);
    parent.getWorldScale(_scale);
    const worldScale = Math.max(_scale.x, 1e-4);
    const toSim = 1 / (DOMAIN * worldScale);
    _invParent.copy(parent.matrixWorld).invert();

    for (const source of session.inputSources) {
      if ((source.handedness !== 'right' && source.handedness !== 'left') || !source.hand) {
        continue;
      }

      for (const bone of HAND_BONES) {
        if (activeForces.length >= MAX_FORCES) return activeForces;

        const fromSpace = source.hand.get(bone.from);
        const toSpace = source.hand.get(bone.to);
        if (!fromSpace || !toSpace) continue;

        const fromPose =
          xrFrame.getJointPose?.(fromSpace, refSpace) ?? xrFrame.getPose(fromSpace, refSpace);
        const toPose = xrFrame.getJointPose?.(toSpace, refSpace) ?? xrFrame.getPose(toSpace, refSpace);
        if (!fromPose || !toPose) continue;

        const a = fromPose.transform.position;
        const b = toPose.transform.position;
        _world.set(a.x, a.y, a.z);
        _worldB.set(b.x, b.y, b.z);

        _local.copy(_world);
        _localB.copy(_worldB);
        parent.worldToLocal(_local);
        parent.worldToLocal(_localB);

        _mid.addVectors(_local, _localB).multiplyScalar(0.5);
        const sx = _mid.x / DOMAIN + 0.5;
        const sy = _mid.y / DOMAIN;
        const sz = _mid.z / DOMAIN + 0.5;
        if (sx < -0.12 || sx > 1.12 || sy < -0.12 || sy > 1.12 || sz < -0.12 || sz > 1.12) {
          continue;
        }

        _axisX.subVectors(_localB, _local);
        const boneLenContent = _axisX.length();
        if (boneLenContent < 1e-5) continue;
        _axisX.multiplyScalar(1 / boneLenContent);

        const o = fromPose.transform.orientation;
        _quat.set(o.x, o.y, o.z, o.w);
        // Joint +Y hint from world → content space for the width axis.
        _axisY.set(0, 1, 0).applyQuaternion(_quat).transformDirection(_invParent);
        makeBoneBasis(_axisX, _axisY, _axisZ);

        const fromRadiusM =
          'radius' in fromPose && typeof (fromPose as XRJointPose).radius === 'number'
            ? (fromPose as XRJointPose).radius
            : undefined;
        const toRadiusM =
          'radius' in toPose && typeof (toPose as XRJointPose).radius === 'number'
            ? (toPose as XRJointPose).radius
            : undefined;
        const rSim =
          fromRadiusM !== undefined && toRadiusM !== undefined
            ? ((fromRadiusM + toRadiusM) * 0.5) * toSim
            : fallbackBoneRadius(bone);
        const isTip = bone.to.endsWith('-tip');
        // Slim finger sticks; palm stays a bit wider so the whole hand still catches goo.
        // Tips are capsules (round cross-section) instead of flat boxes.
        const widthScale = bone.palm ? 1.15 : isTip ? 0.7 : 0.55;
        const thickScale = bone.palm ? 0.75 : 0.4;
        const halfLen = Math.max((boneLenContent / DOMAIN) * 0.5, 0.005);
        const halfWidth = Math.max(rSim * widthScale, 0.0035);
        const halfThick = Math.max(rSim * thickScale, 0.0028);

        const f = forcePool[activeForces.length];
        f.x = Math.min(0.98, Math.max(0.02, sx));
        f.y = Math.min(0.98, Math.max(0.02, sy));
        f.z = Math.min(0.98, Math.max(0.02, sz));
        f.strength = handForceStrength(bone);
        f.isCapsule = isTip;
        f.isBox = !isTip;
        f.radius = halfWidth;
        f.hx = halfLen;
        f.hy = halfWidth;
        f.hz = isTip ? halfWidth : halfThick;
        f.ax = _axisX.x;
        f.ay = _axisX.y;
        f.az = _axisX.z;
        f.bx = _axisY.x;
        f.by = _axisY.y;
        f.bz = _axisY.z;
        f.cx = _axisZ.x;
        f.cy = _axisZ.y;
        f.cz = _axisZ.z;
        activeForces.push(f);
      }
    }
    // Desktop force colliders still push in XR if you left any in the scene.
    for (const f of colliderForces()) {
      if (activeForces.length >= MAX_FORCES) break;
      activeForces.push(f);
    }
    return activeForces;
  }

  const setActive = (id: string) => {
    for (const el of document.querySelectorAll('.mat-btn')) el.classList.remove('active');
    document.getElementById(id)?.classList.add('active');
  };

  const syncGooView = () => {
    const gelOn = mpmVisible && gelWanted && materialKind === 'goo';
    gel.setEnabled(gelOn);
    points.visible = mpmVisible && !gelOn;
  };

  const setGelSurface = (on: boolean) => {
    gelWanted = on;
    syncGooView();
    hud.setGelSurface(on);
    if (gelCheck) gelCheck.checked = on;
  };

  const setMpmVisible = (on: boolean) => {
    mpmVisible = on;
    basin.visible = on;
    grid.visible = on;
    syncGooView();
    forceColliders.setVisible(on);
    forceColliders.setGizmoEnabled(on && !immersive.active);
    if (on) setWaterPropsVisible(materialKind === 'water');
    else setWaterPropsVisible(false);
  };

  const setDesktopCamera = (next: SandboxExhibit) => {
    if (next === 'fire') {
      camera.position.set(2.8, 1.6, 3.2);
      controls.target.set(0, 0.7, 0);
    } else if (next === 'avbd' && avbd.applyCamera) {
      avbd.applyCamera(camera, controls);
    } else {
      camera.position.set(1.6, 1.2, 1.6);
      controls.target.set(0, 0.35, 0);
    }
  };

  const subBar = document.getElementById('toolbar-sub');
  const subLabel = document.getElementById('sub-label');
  const mlsSelect = document.getElementById('mls-scene') as HTMLSelectElement | null;
  const avbdSelect = document.getElementById('avbd-scene') as HTMLSelectElement | null;
  const envSelect = document.getElementById('env-select') as HTMLSelectElement | null;
  const gelToggle = document.getElementById('gel-toggle');
  const gelCheck = document.getElementById('gel-solid') as HTMLInputElement | null;
  gelCheck?.addEventListener('change', () => setGelSurface(gelCheck.checked));
  if (avbdSelect && !useCpuAvbd) {
    for (const { group, ids } of presetsByGroup()) {
      const og = document.createElement('optgroup');
      og.label = group;
      for (const id of ids) {
        const opt = document.createElement('option');
        opt.value = id;
        opt.textContent = presetLabel(id);
        og.appendChild(opt);
      }
      avbdSelect.appendChild(og);
    }
    avbdSelect.value = DEFAULT_STACK_PRESET;
  }

  const toolbarId = (next: SandboxExhibit) => {
    if (next === 'fire') return 'mat-kora';
    if (next === 'avbd') return 'mat-avbd';
    return 'mat-mls';
  };

  const syncAvbdControls = () => {
    const fpsOn = !useCpuAvbd && exhibit === 'avbd' && !!avbd.usesFpsControls?.();
    if (!fpsOn) avbdGpu.endBodyDrag();
    avbdFps.setEnabled(fpsOn);
    controls.enabled = orbitAllowed();
    if (fpsOn) {
      // Stop orbit from yanking the camera back toward its old target.
      controls.enableDamping = false;
      avbdFps.syncFromCamera();
    } else {
      controls.enableDamping = true;
    }
  };

  const syncSubBar = () => {
    if (!subBar) return;
    const showMls = exhibit === 'sand' || exhibit === 'goo' || exhibit === 'water';
    const showAvbd = exhibit === 'avbd' && !useCpuAvbd;
    const showFire = exhibit === 'fire';
    // Reset lives here next to the scene/material selector; fire still gets Reset alone.
    subBar.hidden = !(showMls || showAvbd || showFire);
    if (subLabel) {
      subLabel.hidden = showFire;
      subLabel.textContent = showAvbd ? 'Scene' : 'Material';
    }
    if (mlsSelect) {
      mlsSelect.hidden = !showMls;
      if (showMls) mlsSelect.value = exhibit;
    }
    // Only goo has a solid mode; sand and water are always beads.
    if (gelToggle) gelToggle.hidden = exhibit !== 'goo';
    if (avbdSelect) {
      avbdSelect.hidden = !showAvbd;
      if (showAvbd) avbdSelect.value = avbd.currentScene;
    }
  };

  const creditEl = document.getElementById('hud-credit');
  const HUD_CREDITS: Record<'fire' | 'mls' | 'avbd', { href: string; label: string }> = {
    fire: {
      href: 'https://doi.org/10.1145/3819990.3820026',
      label: 'Kora: A Physics-Based Fire Pipeline and Toolset',
    },
    mls: {
      href: 'https://doi.org/10.1145/3197517.3201293',
      label: 'MLS-MPM (Hu et al.)',
    },
    avbd: {
      href: 'https://graphics.cs.utah.edu/research/projects/avbd/',
      label: 'Augmented Vertex Block Descent',
    },
  };
  const syncHudCredit = () => {
    if (!creditEl) return;
    const key = exhibit === 'fire' ? 'fire' : exhibit === 'avbd' ? 'avbd' : 'mls';
    const credit = HUD_CREDITS[key];
    creditEl.innerHTML = `<a href="${credit.href}" target="_blank" rel="noopener noreferrer">${credit.label}</a>`;
  };

  const STORAGE_PERF = 'kora.sandbox.perf';
  let perfEnabled = false;
  try {
    perfEnabled = localStorage.getItem(STORAGE_PERF) === '1';
  } catch {
    /* ignore */
  }
  const perfBtn = document.getElementById('mat-perf');
  const syncPerfUi = () => {
    perfBtn?.classList.toggle('active', perfEnabled);
    if (statsEl) {
      statsEl.hidden = !perfEnabled;
      if (!perfEnabled) statsEl.textContent = '';
    }
    statsDirty = true;
  };
  syncPerfUi();

  let matGui: MaterialsGui | null = null;

  const syncGuiVisibility = () => {
    // Fire / AVBD own their look; materials GUI is for MLS-MPM knobs only.
    if (matGui) {
      matGui.domElement.style.display =
        exhibit === 'fire' || exhibit === 'avbd' ? 'none' : '';
    }
  };

  const applyMaterial = (kind: MaterialKind) => {
    materialKind = kind;
    sim.reset(kind);
    points.count = sim.particleCount;
    setSurfaceKind(kind);
    setWaterPropsVisible(kind === 'water');
    hud.setMaterialKind(kind);
    matGui?.setMaterial(kind);
    setActive(toolbarId(kind));
    mpmVisible = true;
    syncGooView();
    setWaterAudioEnabled(kind === 'water');
    if (kind === 'water') waterAudio.triggerPour();
    statsDirty = true;
  };

  const STORAGE_EXHIBIT = 'kora.sandbox.exhibit';
  const STORAGE_AVBD_SCENE = 'kora.sandbox.avbdScene';

  const isExhibit = (v: string | null): v is SandboxExhibit =>
    v === 'fire' || v === 'sand' || v === 'goo' || v === 'water' || v === 'avbd';

  const rememberExhibit = (id: SandboxExhibit) => {
    try {
      localStorage.setItem(STORAGE_EXHIBIT, id);
      if (id === 'avbd') localStorage.setItem(STORAGE_AVBD_SCENE, avbd.currentScene);
    } catch {
      /* private mode / quota */
    }
  };

  const applyEnvironment = (name: EnvironmentName, id: SandboxExhibit = exhibit) => {
    void environment.set(name);
    environment.setIntensity(id === 'fire' ? DEFAULT_INTENSITY[name] : LIT_INTENSITY[name]);
    if (envSelect) envSelect.value = name;
    hud.setEnvironment(name);
    // Fire carries its own backdrop params and re-applies them on setActive, so they have to
    // follow along or selecting Fire would silently undo the pick.
    fire.koraParams.environment = name;
    fire.koraParams.backgroundIntensity = DEFAULT_INTENSITY[name];
    fire.refreshDesktopGui();
  };

  /** A hand-picked backdrop outranks the per-exhibit default for the rest of the session. */
  let envOverride: EnvironmentName | null = null;

  envSelect?.addEventListener('change', () => {
    envOverride = envSelect.value as EnvironmentName;
    applyEnvironment(envOverride);
  });
  hud.setOnEnvironment((name) => {
    envOverride = name;
    applyEnvironment(name);
  });

  const syncPresentationForExhibit = (id: SandboxExhibit) => {
    renderer.toneMapping = ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    // The physics demos are lit surfaces in a room; fire and the MPM materials are emissive
    // volumes that want a dark sky behind them.
    applyEnvironment(envOverride ?? (id === 'avbd' ? 'studio' : 'night'), id);
  };

  const applyExhibit = async (next: SandboxExhibit) => {
    if (next === 'fire') {
      if (!fire.isReady) await fire.init();
      if (exhibit === 'avbd') avbdGpu.exitImmersive();
      avbd.setActive(false);
      setWaterAudioEnabled(false);
      fire.setActive(true);
      setMpmVisible(false);
      exhibit = 'fire';
      hud.setExhibit('fire');
      setActive('mat-kora');
      setDesktopCamera('fire');
      // Selecting Fire mid-session used to skip enterImmersive — lean placement / sparks hide
      // never ran. Always sync when already presenting.
      if (immersive.active) fire.enterImmersive();
      syncPresentationForExhibit('fire');
      syncGuiVisibility();
      syncSubBar();
      syncHudCredit();
      syncAvbdControls();
      rememberExhibit('fire');
      statsDirty = true;
      return;
    }

    if (next === 'avbd') {
      if (exhibit === 'fire' && immersive.active) fire.exitImmersive();
      fire.setActive(false);
      setWaterAudioEnabled(false);
      // Hide MPM particles/basin; keep desktop force colliders as kinematic pushers for gel-cut.
      basin.visible = false;
      grid.visible = false;
      points.visible = false;
      setWaterPropsVisible(false);
      const gel = avbd.currentScene === 'gel-cut' || useCpuAvbd;
      forceColliders.setVisible(gel);
      forceColliders.setGizmoEnabled(gel && !immersive.active);
      avbd.setActive(true);
      if (immersive.active && !useCpuAvbd) avbdGpu.enterImmersive();
      exhibit = 'avbd';
      hud.setExhibit('avbd');
      hud.setAvbdScene(avbd.currentScene as StackPreset);
      setActive('mat-avbd');
      setDesktopCamera('avbd');
      syncPresentationForExhibit('avbd');
      syncGuiVisibility();
      syncSubBar();
      syncHudCredit();
      syncAvbdControls();
      rememberExhibit('avbd');
      statsDirty = true;
      return;
    }

    if (exhibit === 'fire' && immersive.active) fire.exitImmersive();
    if (exhibit === 'avbd') avbdGpu.exitImmersive();
    fire.setActive(false);
    avbd.setActive(false);
    immersive.setDomainSize(DOMAIN);
    immersive.setPlacement({ ...MPM_PLACEMENT });
    exhibit = next;
    applyMaterial(next);
    setMpmVisible(true);
    setDesktopCamera(next);
    syncPresentationForExhibit(next);
    syncGuiVisibility();
    syncSubBar();
    syncHudCredit();
    syncAvbdControls();
    rememberExhibit(next);
    statsDirty = true;
  };

  const applyPhysicsScene = (id: string) => {
    if (!isStackPreset(id)) return;
    avbd.setScene(id);
    const gel = id === 'gel-cut';
    forceColliders.setVisible(gel);
    forceColliders.setGizmoEnabled(gel && !immersive.active);
    setDesktopCamera('avbd');
    if (avbdSelect) avbdSelect.value = id;
    hud.setAvbdScene(id);
    syncAvbdControls();
    rememberExhibit('avbd');
    statsDirty = true;
  };

  const shootAvbd = () => {
    if (!avbd.shoot || !avbd.usesFpsControls?.()) return;
    const scene = avbd.currentScene;
    const isCloth = scene === 'cloth-boxes-demo';
    const isColiseum = isColiseumDemoVariant(scene);
    const isDomino = scene === 'dominoes-demo' || scene === 'dominoes-advanced-demo';
    avbdFps.getShootOrigin(fireOrigin, isColiseum ? 1.1 : 1.1);
    avbdFps.getLookDirection(fireDirection);
    avbd.shoot({
      position: [fireOrigin.x, fireOrigin.y, fireOrigin.z],
      direction: [fireDirection.x, fireDirection.y, fireDirection.z],
      averageSpeed: isCloth ? 10 : isColiseum ? 40 : isDomino ? 12 : 18,
      speedJitter: isCloth ? 2 : isColiseum ? 6 : isDomino ? 1.5 : 4,
      angularJitter: isCloth ? 4 : isColiseum ? 5 : isDomino ? 2 : 8,
    });
  };

  const applyAction = (action: MaterialAction) => {
    if (action === 'reset') {
      if (exhibit === 'fire') fire.reset();
      else if (exhibit === 'avbd') {
        if (avbd.usesFpsControls?.() && avbd.resetSimulation) avbd.resetSimulation();
        else avbd.reset();
      } else {
        sim.reset(materialKind);
        points.count = sim.particleCount;
        if (materialKind === 'water') waterAudio.triggerPour();
      }
      return;
    }
    if (action === 'toggle-view') {
      setGelSurface(!gelWanted);
      return;
    }
    if (action === 'kora') {
      void applyExhibit('fire');
      return;
    }
    if (action === 'mls') {
      void applyExhibit(materialKind === 'sand' || materialKind === 'goo' || materialKind === 'water' ? materialKind : 'sand');
      return;
    }
    void applyExhibit(action as SandboxExhibit);
  };

  hud.setOnAction(applyAction);
  if (!useCpuAvbd) hud.bindAvbdScenes((id) => applyPhysicsScene(id));
  hud.setOnParamsChange(() => {
    hud.refreshParams();
    matGui?.refresh();
    if (exhibit === 'fire') fire.refreshDesktopGui();
  });

  matGui = createMaterialsGui(matParams, materialKind, {
    onReset: () => {
      sim.reset(materialKind);
      points.count = sim.particleCount;
      if (materialKind === 'water') waterAudio.triggerPour();
    },
    onMaterial: (kind) => void applyExhibit(kind),
    onChange: () => hud.refreshParams(),
    onAddCollider: (kind) => {
      forceColliders.add(kind, new Vector3(0.1, 0.22, 0));
    },
    onRemoveCollider: () => {
      if (forceColliders.selection !== null) forceColliders.remove(forceColliders.selection);
    },
    onGizmoMode: (mode) => forceColliders.setMode(mode),
  });
  setGelSurface(gelWanted);

  window.addEventListener('keydown', (e) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return;
    if (exhibit === 'avbd' && e.code === 'KeyR' && !e.repeat) {
      e.preventDefault();
      if (avbd.resetSimulation) avbd.resetSimulation();
      else avbd.reset();
      return;
    }
    if (exhibit === 'fire' || immersive.active) return;
    if (avbd.usesFpsControls?.()) return;
    const mode = { w: 'translate', e: 'rotate', r: 'scale' }[e.key.toLowerCase()];
    if (mode) forceColliders.setMode(mode as GizmoMode);
    if (e.key === 'Escape') forceColliders.select(null);
  });

  // Free-fly: LMB drag steers (handled in FPSController). RMB hold shoots.
  window.addEventListener('mousedown', (e) => {
    if (exhibit !== 'avbd' || !avbd.usesFpsControls?.()) return;
    if (e.target !== renderer.domElement) return;
    if (e.button === 2) {
      e.preventDefault();
      triggerHeld = true;
      fireAccumulator = 0;
      const isColiseum = isColiseumDemoVariant(avbd.currentScene);
      if (isColiseum) shootAvbd();
    }
  });
  window.addEventListener('mouseup', (e) => {
    if (e.button === 2) triggerHeld = false;
  });

  document.getElementById('mat-kora')?.addEventListener('click', () => void applyExhibit('fire'));
  document.getElementById('mat-mls')?.addEventListener('click', () => {
    const kind =
      materialKind === 'sand' || materialKind === 'goo' || materialKind === 'water' ? materialKind : 'sand';
    void applyExhibit(kind);
  });
  document.getElementById('mat-avbd')?.addEventListener('click', () => void applyExhibit('avbd'));
  document.getElementById('mat-reset')?.addEventListener('click', () => applyAction('reset'));
  perfBtn?.addEventListener('click', () => {
    perfEnabled = !perfEnabled;
    try {
      localStorage.setItem(STORAGE_PERF, perfEnabled ? '1' : '0');
    } catch {
      /* ignore */
    }
    syncPerfUi();
  });
  mlsSelect?.addEventListener('change', () => {
    const v = mlsSelect.value;
    mlsSelect.blur();
    renderer.domElement.focus({ preventScroll: true });
    if (v === 'sand' || v === 'goo' || v === 'water') void applyExhibit(v);
  });
  avbdSelect?.addEventListener('change', () => {
    avbdSelect.blur();
    applyPhysicsScene(avbdSelect.value);
    // Canvas isn't focusable by default, so the select can keep keyboard focus after change.
    renderer.domElement.focus({ preventScroll: true });
  });

  const boot = new URLSearchParams(location.search).get('exhibit');
  const bootScene = new URLSearchParams(location.search).get('scene');
  let saved: string | null = null;
  let savedAvbd: string | null = null;
  try {
    saved = localStorage.getItem(STORAGE_EXHIBIT);
    savedAvbd = localStorage.getItem(STORAGE_AVBD_SCENE);
  } catch {
    /* ignore */
  }
  const initial: SandboxExhibit = isExhibit(boot) ? boot : isExhibit(saved) ? saved : 'sand';
  const legacyCpuScene: Record<string, StackPreset> = {
    soft: 'gel-cut',
    stack: 'single-5',
    pyramid: 'pyramid-8',
    springs: 'spring-demo',
  };
  const wantedScene =
    (isStackPreset(bootScene) && bootScene) ||
    (isStackPreset(savedAvbd) && savedAvbd) ||
    (savedAvbd && legacyCpuScene[savedAvbd]) ||
    DEFAULT_STACK_PRESET;
  if (!useCpuAvbd && wantedScene !== avbd.currentScene) {
    avbd.setScene(wantedScene);
  } else if (
    useCpuAvbd &&
    (savedAvbd === 'soft' ||
      savedAvbd === 'stack' ||
      savedAvbd === 'pyramid' ||
      savedAvbd === 'springs')
  ) {
    avbdCpu.setScene(savedAvbd);
  }
  await applyExhibit(initial);
  syncGuiVisibility();
  syncSubBar();
  syncAvbdControls();

  /** Drive AVBD soft with an explicit ForcePoint list (for cut / displace checks). */
  (window as unknown as {
    koraAvbdStep?: (forces: ForcePoint[]) => {
      springs: number;
      bodies: number;
      cut: number;
      ms: number;
    };
  }).koraAvbdStep = (forces) => {
    avbd.step(1 / 60, forces);
    return {
      springs: avbd.springCount,
      bodies: avbd.bodyCount,
      cut: avbd.lastCutCount,
      ms: avbd.lastStepMs,
      com: avbd.softCom?.() ?? { x: 0, y: 0, z: 0 },
    };
  };

  if (xrButton) await immersive.mountButton(xrButton);

  let frames = 0;
  let accum = 0;
  let fps = 0;
  let lastStepMs = 0;
  let last = performance.now();
  let beadCopyPos: GPUBuffer | undefined;
  let beadCopyVel: GPUBuffer | undefined;

  renderer.setAnimationLoop((_time?: number, xrFrame?: XRFrame) => {
    const now = performance.now();
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    accum += dt;
    frames++;
    if (accum > 0.5) {
      fps = frames / accum;
      accum = 0;
      frames = 0;
      statsDirty = true;
    }

    hands.update();
    immersive.update(xrFrame ?? null, dt);

    if (exhibit === 'avbd' && avbd.usesFpsControls?.() && !immersive.active) {
      avbdFps.update(dt);
      if (triggerHeld) {
        const isColiseum = isColiseumDemoVariant(avbd.currentScene);
        const interval = isColiseum ? 2.0 : 1 / 28;
        fireAccumulator += dt;
        while (fireAccumulator >= interval) {
          fireAccumulator -= interval;
          shootAvbd();
        }
      }
    }

    const skipSim = immersive.active && xrWarmupFrames > 0 && !immersive.rendering;
    let frameForces: ForcePoint[] | null = null;
    if (!skipSim) {
      const t0 = performance.now();
      if (exhibit === 'fire') {
        fire.step(dt, xrFrame);
      } else if (exhibit === 'avbd') {
        // Gel-cut drives its kinematics from MPM-style force volumes (it also needs them for
        // spring severing). The rigid/soft presets take hand bones straight in scene units.
        const gelForces =
          avbd.currentScene === 'gel-cut' || useCpuAvbd ? gatherForces(xrFrame) : [];
        frameForces = gelForces;
        if (immersive.active && !useCpuAvbd && avbd.currentScene !== 'gel-cut') {
          avbdGpu.setHandColliders(gatherHandObbs({
            session: renderer.xr.getSession(),
            referenceSpace: renderer.xr.getReferenceSpace(),
            frame: xrFrame,
            target: avbdGpu.handColliderSpace,
          }));
        }
        avbd.step(dt, gelForces);
      } else {
        const forces = gatherForces(xrFrame);
        frameForces = forces;
        if (!beadCopyPos) beadCopyPos = attrGpuBuffer(posAttr);
        if (!beadCopyVel) beadCopyVel = attrGpuBuffer(velAttr);
        const simSubsteps = immersive.rendering ? 6 : undefined;
        sim.step(forces, simSubsteps, beadCopyPos, beadCopyVel);
        // Splat + smooth is the expensive half; the surface reads fine rebuilt at a fraction
        // of the sim rate because the isosurface moves far slower than individual particles.
        gelFrame++;
        if (gelFrame % (immersive.rendering ? 4 : 2) === 0) gel.update(renderer);
      }
      lastStepMs = performance.now() - t0;
      if (perfEnabled) statsDirty = true;
    }
    tickWaterAudio(dt, frameForces);
    if (xrWarmupFrames > 0) xrWarmupFrames--;

    if (immersive.active) {
      if (immersive.rendering) renderer.render(scene, camera);
    } else {
      // OrbitControls.update() must not run while FPS owns the camera (damping fights look/move).
      if (controls.enabled) controls.update();
      renderer.render(scene, camera);
    }

    if (statsEl && perfEnabled && statsDirty) {
      statsDirty = false;
      statsEl.textContent =
        exhibit === 'fire'
          ? `Kora · step ${lastStepMs.toFixed(1)} ms · ${fps.toFixed(0)} fps`
          : exhibit === 'avbd'
            ? `AVBD · ${presetLabel(avbd.currentScene as StackPreset)} · ${avbd.bodyCount} bodies` +
              (avbd.springCount ? ` · ${avbd.springCount} springs` : '') +
              ` · step ${avbd.lastStepMs.toFixed(1)} ms · frame ${lastStepMs.toFixed(1)} ms · ${fps.toFixed(0)} fps` +
              (useCpuAvbd ? ' · CPU' : ' · GPU')
            : `MLS · ${materialKind} · ${sim.particleCount.toLocaleString()} particles · ${sim.gridN}³` +
              ` · step ${lastStepMs.toFixed(1)} ms · ${fps.toFixed(0)} fps`;
    }

    if (exhibit === 'avbd') {
      avbdFps.setSceneStatusText(avbd.sceneStatusText?.() ?? null);
    }
  });

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
}

main().catch((err) => {
  console.error(err);
  document.getElementById('unsupported')?.classList.add('show');
});
