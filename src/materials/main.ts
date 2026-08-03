/**
 * AVP sandbox — fire + MLS-MPM sand / goo / water in one WebXR host.
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
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { ImmersiveMode } from '../xr/ImmersiveMode';
import { Hands } from '../xr/Hands';
import { Environment } from '../scene/Environment';
import { MAX_FORCES, MlsMpm, type ForcePoint, type MaterialKind } from './MlsMpm';
import { createParticleSurfaceMesh } from './GooMaterial';
import { FireExhibit } from './FireExhibit';
import { type MaterialAction, type SandboxExhibit } from './MaterialPanel';
import { SandboxHud } from './SandboxHud';
import { ForceColliders } from './ForceColliders';
import { createMaterialsGui, type MaterialsGui } from './gui';
import { defaultMaterialsParams } from './params';
import type { GizmoMode } from '../sim/obstacles';

const DOMAIN = 1.0;
const MPM_PLACEMENT = {
  distance: 0.48,
  height: 0.88,
  framedSize: 0.42,
  turntable: false,
} as const;

/** Finger / palm bone segments — oriented boxes between consecutive joints. */
const HAND_BONES: { from: string; to: string; palm?: boolean }[] = [
  { from: 'thumb-metacarpal', to: 'thumb-phalanx-proximal' },
  { from: 'thumb-phalanx-proximal', to: 'thumb-phalanx-distal' },
  { from: 'thumb-phalanx-distal', to: 'thumb-tip' },
  { from: 'index-finger-metacarpal', to: 'index-finger-phalanx-proximal' },
  { from: 'index-finger-phalanx-proximal', to: 'index-finger-phalanx-intermediate' },
  { from: 'index-finger-phalanx-intermediate', to: 'index-finger-phalanx-distal' },
  { from: 'index-finger-phalanx-distal', to: 'index-finger-tip' },
  { from: 'middle-finger-metacarpal', to: 'middle-finger-phalanx-proximal' },
  { from: 'middle-finger-phalanx-proximal', to: 'middle-finger-phalanx-intermediate' },
  { from: 'middle-finger-phalanx-intermediate', to: 'middle-finger-phalanx-distal' },
  { from: 'middle-finger-phalanx-distal', to: 'middle-finger-tip' },
  { from: 'ring-finger-metacarpal', to: 'ring-finger-phalanx-proximal' },
  { from: 'ring-finger-phalanx-proximal', to: 'ring-finger-phalanx-intermediate' },
  { from: 'ring-finger-phalanx-intermediate', to: 'ring-finger-phalanx-distal' },
  { from: 'ring-finger-phalanx-distal', to: 'ring-finger-tip' },
  { from: 'pinky-finger-metacarpal', to: 'pinky-finger-phalanx-proximal' },
  { from: 'pinky-finger-phalanx-proximal', to: 'pinky-finger-phalanx-intermediate' },
  { from: 'pinky-finger-phalanx-intermediate', to: 'pinky-finger-phalanx-distal' },
  { from: 'pinky-finger-phalanx-distal', to: 'pinky-finger-tip' },
  { from: 'wrist', to: 'thumb-metacarpal', palm: true },
  { from: 'wrist', to: 'index-finger-metacarpal', palm: true },
  { from: 'wrist', to: 'middle-finger-metacarpal', palm: true },
  { from: 'wrist', to: 'ring-finger-metacarpal', palm: true },
  { from: 'wrist', to: 'pinky-finger-metacarpal', palm: true },
];

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

  const adapter = await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' });
  const requiredLimits: Record<string, number> = {};
  // Fire needs storage-texture headroom; MPM is happy with the buffer limits alone.
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

  const renderer = new WebGPURenderer({
    antialias: true,
    forceWebGL: false,
    requiredLimits,
  });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  app.appendChild(renderer.domElement);
  renderer.xr.enabled = true;
  await renderer.init();

  const device = (renderer as unknown as { backend?: { device?: GPUDevice } }).backend?.device;
  if (!device) throw new Error('WebGPU device missing after renderer.init()');

  const scene = new Scene();
  const environment = new Environment(scene);
  void environment.set('night');
  environment.setIntensity(1.6);

  const camera = new PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.05, 50);
  camera.position.set(1.6, 1.2, 1.6);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 0.35, 0);
  controls.enableDamping = true;

  let xrWarmupFrames = 0;
  let exhibit: SandboxExhibit = 'sand';

  const forceColliders = new ForceColliders(camera, renderer.domElement, (dragging) => {
    controls.enabled = !dragging && !immersive.active;
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
    },
    onExit: () => {
      controls.enabled = true;
      forceColliders.setGizmoEnabled(exhibit !== 'fire');
      fire.exitImmersive();
      xrWarmupFrames = 0;
    },
  });
  scene.add(immersive.rig);
  scene.add(immersive.hud);
  immersive.setDomainSize(DOMAIN);
  immersive.setPlacement({ ...MPM_PLACEMENT });
  immersive.attach(forceColliders.group);
  scene.add(forceColliders.helper);
  forceColliders.add('sphere', new Vector3(0.12, 0.18, 0.05));

  const fire = new FireExhibit(
    renderer,
    immersive,
    environment,
    scene,
    camera,
    (dragging) => {
      controls.enabled = !dragging && !immersive.active;
    },
  );
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

  // GelSurface parked — bead impostors only for now.
  points.visible = true;
  let statsDirty = true;

  const viewBtn = document.getElementById('mat-view');
  if (viewBtn) viewBtn.hidden = true;

  function attrGpuBuffer(attr: StorageInstancedBufferAttribute): GPUBuffer | undefined {
    const backend = (
      renderer as unknown as { backend: { get: (a: unknown) => { buffer?: GPUBuffer } } }
    ).backend;
    return backend.get(attr)?.buffer;
  }

  let materialKind: MaterialKind = 'sand';

  function handForceStrength(bone: { from: string; to: string; palm?: boolean }): number {
    const base = matParams.handForce * matParams[materialKind].handForceScale;
    if (bone.palm) return base * 0.85;
    if (bone.to.endsWith('-tip')) return base;
    return base * 0.95;
  }

  function fallbackBoneRadius(bone: { from: string; to: string; palm?: boolean }): number {
    const tip = materialKind === 'sand' ? 0.01 : materialKind === 'water' ? 0.012 : 0.011;
    if (bone.palm) return tip * 1.7;
    if (bone.to.endsWith('-tip')) return tip;
    return tip * 0.85;
  }

  const forcePool: ForcePoint[] = Array.from({ length: MAX_FORCES }, () => emptyForce());
  const activeForces: ForcePoint[] = [];

  function colliderForces(): ForcePoint[] {
    const strength = matParams.handForce * matParams[materialKind].handForceScale;
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
        // Slim finger sticks; palm stays a bit wider so the whole hand still catches goo.
        const widthScale = bone.palm ? 1.15 : 0.55;
        const thickScale = bone.palm ? 0.75 : 0.4;
        const halfLen = Math.max((boneLenContent / DOMAIN) * 0.5, 0.005);
        const halfWidth = Math.max(rSim * widthScale, 0.0035);
        const halfThick = Math.max(rSim * thickScale, 0.0028);

        const f = forcePool[activeForces.length];
        f.x = Math.min(0.98, Math.max(0.02, sx));
        f.y = Math.min(0.98, Math.max(0.02, sy));
        f.z = Math.min(0.98, Math.max(0.02, sz));
        f.strength = handForceStrength(bone);
        f.isBox = true;
        f.radius = halfWidth;
        f.hx = halfLen;
        f.hy = halfWidth;
        f.hz = halfThick;
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

  const setMpmVisible = (on: boolean) => {
    basin.visible = on;
    grid.visible = on;
    points.visible = on;
    forceColliders.setVisible(on);
    forceColliders.setGizmoEnabled(on && !immersive.active);
    if (on) setWaterPropsVisible(materialKind === 'water');
    else setWaterPropsVisible(false);
  };

  const setDesktopCamera = (next: SandboxExhibit) => {
    if (next === 'fire') {
      camera.position.set(2.8, 1.6, 3.2);
      controls.target.set(0, 0.7, 0);
    } else {
      camera.position.set(1.6, 1.2, 1.6);
      controls.target.set(0, 0.35, 0);
    }
  };

  const toolbarId = (next: SandboxExhibit) =>
    next === 'fire' ? 'mat-fire' : next === 'sand' ? 'mat-sand' : next === 'goo' ? 'mat-goo' : 'mat-water';

  let matGui: MaterialsGui | null = null;

  const syncGuiVisibility = () => {
    // FireExhibit toggles its own Kora GUI in setActive; materials GUI is the complement.
    if (matGui) matGui.domElement.style.display = exhibit === 'fire' ? 'none' : '';
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
    points.visible = true;
    statsDirty = true;
  };

  const applyExhibit = async (next: SandboxExhibit) => {
    if (next === 'fire') {
      if (!fire.isReady) await fire.init();
      fire.setActive(true);
      setMpmVisible(false);
      exhibit = 'fire';
      hud.setExhibit('fire');
      setActive('mat-fire');
      setDesktopCamera('fire');
      // Selecting Fire mid-session used to skip enterImmersive — lean placement / sparks hide
      // never ran. Always sync when already presenting.
      if (immersive.active) fire.enterImmersive();
      syncGuiVisibility();
      statsDirty = true;
      return;
    }

    if (exhibit === 'fire' && immersive.active) fire.exitImmersive();
    fire.setActive(false);
    immersive.setDomainSize(DOMAIN);
    immersive.setPlacement({ ...MPM_PLACEMENT });
    exhibit = next;
    applyMaterial(next);
    setMpmVisible(true);
    setDesktopCamera(next);
    syncGuiVisibility();
  };

  const applyAction = (action: MaterialAction) => {
    if (action === 'reset') {
      if (exhibit === 'fire') fire.reset();
      else {
        sim.reset(materialKind);
        points.count = sim.particleCount;
      }
      return;
    }
    if (action === 'toggle-view') return;
    void applyExhibit(action);
  };

  hud.setOnAction(applyAction);
  hud.setOnParamsChange(() => {
    hud.refreshParams();
    matGui?.refresh();
    if (exhibit === 'fire') fire.refreshDesktopGui();
  });

  matGui = createMaterialsGui(matParams, materialKind, {
    onReset: () => {
      sim.reset(materialKind);
      points.count = sim.particleCount;
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

  window.addEventListener('keydown', (e) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
    if (exhibit === 'fire' || immersive.active) return;
    const mode = { w: 'translate', e: 'rotate', r: 'scale' }[e.key.toLowerCase()];
    if (mode) forceColliders.setMode(mode as GizmoMode);
    if (e.key === 'Escape') forceColliders.select(null);
  });

  document.getElementById('mat-fire')?.addEventListener('click', () => void applyExhibit('fire'));
  document.getElementById('mat-sand')?.addEventListener('click', () => void applyExhibit('sand'));
  document.getElementById('mat-goo')?.addEventListener('click', () => void applyExhibit('goo'));
  document.getElementById('mat-water')?.addEventListener('click', () => void applyExhibit('water'));
  document.getElementById('mat-reset')?.addEventListener('click', () => applyAction('reset'));

  const boot = new URLSearchParams(location.search).get('exhibit');
  const initial: SandboxExhibit =
    boot === 'fire' || boot === 'sand' || boot === 'goo' || boot === 'water' ? boot : 'sand';
  await applyExhibit(initial);
  syncGuiVisibility();

  if (xrButton) await immersive.mountButton(xrButton);

  let frames = 0;
  let accum = 0;
  let fps = 0;
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

    const skipSim = immersive.active && xrWarmupFrames > 0 && !immersive.rendering;
    if (!skipSim) {
      if (exhibit === 'fire') {
        fire.step(dt, xrFrame);
      } else {
        const forces = gatherForces(xrFrame);
        if (!beadCopyPos) beadCopyPos = attrGpuBuffer(posAttr);
        if (!beadCopyVel) beadCopyVel = attrGpuBuffer(velAttr);
        const simSubsteps = immersive.rendering ? 6 : undefined;
        sim.step(forces, simSubsteps, beadCopyPos, beadCopyVel);
      }
    }
    if (xrWarmupFrames > 0) xrWarmupFrames--;

    if (immersive.active) {
      if (immersive.rendering) renderer.render(scene, camera);
    } else {
      controls.update();
      renderer.render(scene, camera);
    }

    if (statsEl && statsDirty) {
      statsDirty = false;
      statsEl.textContent =
        exhibit === 'fire'
          ? `fire · torch · ${fps.toFixed(0)} fps · sandbox`
          : `${sim.particleCount.toLocaleString()} particles · ${sim.gridN}³ · ${materialKind} · ` +
            `${fps.toFixed(0)} fps · drag to stir (shift = pull)`;
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
