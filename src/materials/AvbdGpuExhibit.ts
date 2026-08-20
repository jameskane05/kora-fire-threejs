/**
 * GPU AVBD exhibit — webphysics PhysicsEngine + all demos + Kora gel-cut.
 */
import {
  AmbientLight,
  DirectionalLight,
  Group,
  Matrix4,
  PerspectiveCamera,
  Raycaster,
  Vector2,
  Vector3,
  type WebGPURenderer,
} from 'three/webgpu';
import type { BodyPointer, ImmersiveMode } from '../xr/ImmersiveMode';
import type { PointerRay } from '../xr/RayGrab';
import { MAX_HAND_OBBS, type HandObb } from '../xr/handObbs';
import { debugParam } from './avbdDebugFlags';
import type { ForcePoint } from './MlsMpm';
import { applyReferenceAvbdConfig } from './webphysics/app/avbdReferenceConfig';
import { buildPresetScene, type SceneRuntime } from './webphysics/buildPresetScene';
import {
  buildGelCutScene,
  KINEMATIC_COLLISION_GROUP,
  severGelSpringsInObbs,
  type GelCutBuild,
} from './webphysics/gelCutScene';
import { AVBD_FRICTION_STATIC } from './webphysics/physics/avbdParams';
import { PhysicsEngine } from './webphysics/physics/PhysicsEngine';
import {
  DEFAULT_STACK_PRESET,
  isStackPreset,
  presetLabel,
  STACK_PRESET_CONFIGS,
  type StackPreset,
} from './webphysics/presets';
import { GrabHighlight } from './webphysics/scene/grabHighlight';
import { createTrackedBodyVisualSet, type TrackedBodyVisualSet } from './webphysics/scene/trackedBodyVisuals';

const DOMAIN = 1;
const HAND_POOL = MAX_HAND_OBBS;
const COLLIDER_POOL = 8;
const KINEMATIC_POOL_TOTAL = HAND_POOL + COLLIDER_POOL;
/** The engine's packed candidate-pair encoding refuses anything larger, by throwing. */
const MAX_ENGINE_BODIES = 65536;
/**
 * Unused kinematic slots go below the scene, in a grid, shrunk to a speck.
 *
 * They must not share a position: coincident bodies produce identical Morton codes, which the
 * LBVH build does not survive on the no-subgroup fallback path, and a broken tree means no
 * contacts at all — every dynamic body drops through the floor. Keeping the grid tight and
 * close under the scene also stops the parked slots from inflating the world AABB and
 * coarsening Morton precision for the bodies that matter.
 */
const PARK_COLUMNS = 8;
const PARK_HALF_EXTENT = 1e-3;
/** Utah avbd_demo3d drag joint stiffness. */
const DRAG_JOINT_STIFFNESS = 5000;

/**
 * Wrist travel in one frame above which the reading is a tracking artefact rather than a gesture.
 * A deliberate drag moves a few centimetres per frame; the jumps this rejects are half-metre ones
 * (a dropped pose falling back to a different joint, or the nearest-hand search switching hands),
 * which the drag joint would otherwise convert into an impulse that tears jointed bodies apart.
 */
const MAX_WRIST_STEP = 0.15;

// Above these, treat the pose delta as a tracking glitch / unpark and teleport
// instead of sweeping the collider through the whole scene.
const KINEMATIC_MAX_LINEAR_SPEED = 8;
const KINEMATIC_MAX_ANGULAR_SPEED = 50;
const KINEMATIC_MIN_DT = 1 / 240;
const KINEMATIC_MAX_DT = 1 / 20;

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(Math.max(v, lo), hi);
}

/**
 * XR framing. Presets are authored anywhere from two metres (Newton's cradle) to two hundred
 * (coliseum), so each one is measured and scaled to the same apparent size — near enough to
 * reach into, with the two-handed pinch to resize from there.
 */
const XR_FRAMED_SIZE = 0.5;
const XR_FRAMED_SIZE_RANGE = { min: 0.1, max: 2.5 };
const XR_PLACEMENT = { distance: 0.5, height: 0.92 };
/** Gel-cut shares the MPM tabletop, so switching back to it has to put that framing back. */
const GEL_PLACEMENT = {
  distance: 0.48,
  height: 0.88,
  framedSize: 0.42,
  framedSizeRange: { min: 0.14, max: 0.95 },
  turntable: false,
} as const;
/** A half-extent past this is scenery (the 100 m floor slab) and must not drive the framing. */
const FRAMING_BOUNDS_LIMIT = 25;
/**
 * Pointer picking reads poses back from the GPU each frame (positions + quaternions,
 * 32 B/body, throttled to one readback in flight). Cheap enough for the 10k ragdoll
 * avalanche; only the 50k/64k coliseum stress tests stay above the cutoff.
 */
const PICK_SYNC_MAX_BODIES = 16384;

export type AvbdGpuSceneId = StackPreset;

/**
 * `?avbdbvh=0` swaps the GPU LBVH for the brute-force broadphase.
 *
 * visionOS has no subgroups, so it takes a different sort and bounds-reduction path than desktop
 * Chrome. This is the switch that says whether a device-only physics failure is that tree build
 * or something else entirely.
 */
function bvhEnabledFromQuery(): boolean {
  return debugParam('avbdbvh') !== '0';
}

/** `?avbdnan=1` reports the first frame on which any body pose stops being finite. */
function nanProbeFromQuery(): boolean {
  return debugParam('avbdnan') === '1';
}

/** `?avbdsubsteps=` / `?avbditers=` shrink the solver's work per frame. */
function intFromQuery(key: string): number | null {
  const raw = debugParam(key);
  if (raw === null) return null;
  const value = Number.parseInt(raw, 10);
  return Number.isFinite(value) && value >= 0 ? value : null;
}

const NAN_PROBE = nanProbeFromQuery();
const NAN_PROBE_INTERVAL_FRAMES = 6;
const NAN_PROBE_DENSE_FRAMES = 30;

function basisToQuat(f: ForcePoint): [number, number, number, number] {
  // Orthonormal basis columns → quaternion (same as CPU AvbdExhibit).
  const m00 = f.ax;
  const m01 = f.bx;
  const m02 = f.cx;
  const m10 = f.ay;
  const m11 = f.by;
  const m12 = f.cy;
  const m20 = f.az;
  const m21 = f.bz;
  const m22 = f.cz;
  const trace = m00 + m11 + m22;
  let x: number;
  let y: number;
  let z: number;
  let w: number;
  if (trace > 0) {
    const s = Math.sqrt(trace + 1) * 2;
    w = 0.25 * s;
    x = (m21 - m12) / s;
    y = (m02 - m20) / s;
    z = (m10 - m01) / s;
  } else if (m00 > m11 && m00 > m22) {
    const s = Math.sqrt(1 + m00 - m11 - m22) * 2;
    w = (m21 - m12) / s;
    x = 0.25 * s;
    y = (m01 + m10) / s;
    z = (m02 + m20) / s;
  } else if (m11 > m22) {
    const s = Math.sqrt(1 + m11 - m00 - m22) * 2;
    w = (m02 - m20) / s;
    x = (m01 + m10) / s;
    y = 0.25 * s;
    z = (m12 + m21) / s;
  } else {
    const s = Math.sqrt(1 + m22 - m00 - m11) * 2;
    w = (m10 - m01) / s;
    x = (m02 + m20) / s;
    y = (m12 + m21) / s;
    z = 0.25 * s;
  }
  const len = Math.hypot(x, y, z, w) || 1;
  return [x / len, y / len, z / len, w / len];
}

export class AvbdGpuExhibit implements BodyPointer {
  readonly root = new Group();
  private device: GPUDevice | null = null;
  private renderer: WebGPURenderer | null = null;
  private physics: PhysicsEngine | null = null;
  private runtime: SceneRuntime | null = null;
  private gel: GelCutBuild | null = null;
  private sceneId: AvbdGpuSceneId = DEFAULT_STACK_PRESET;
  private active = false;
  private ready = false;
  private handBodies: number[] = [];
  private colliderBodies: number[] = [];
  private handVisuals: TrackedBodyVisualSet | null = null;
  private colliderVisuals: TrackedBodyVisualSet | null = null;
  private grabHighlight: GrabHighlight | null = null;
  /** Last targets fed to each kinematic body, for finite-difference velocities. */
  private readonly kinPrevTargets = new Map<number, Float32Array>();
  private handSyncMs = 0;
  private forceSyncMs = 0;
  private _springCount = 0;
  lastStepMs = 0;
  lastCutCount = 0;

  private dragJointIndex: number | null = null;
  private dragRayDistance = 0;
  private dragging = false;
  private readonly dragNdc = new Vector2();
  private readonly dragRaycaster = new Raycaster();
  private readonly dragOrigin = new Vector3();
  private readonly dragDir = new Vector3();

  private presenting = false;
  private sceneSize = 1;
  private readonly sceneCenter = new Vector3();
  private poseSyncInFlight = false;
  private nanProbeReported = false;
  private nanProbeBaselineLogged = false;
  private nanProbeFrame = 0;
  /** Reference-space point the held body is being pulled toward. */
  private readonly grabTarget = new Vector3();
  private readonly grabWrist = new Vector3();
  private readonly grabDelta = new Vector3();
  private grabHasWrist = false;
  private readonly localOrigin = new Vector3();
  private readonly localDir = new Vector3();
  private readonly invRoot = new Matrix4();

  constructor(private readonly immersive: ImmersiveMode) {}

  get isReady(): boolean {
    return this.ready;
  }

  get isActive(): boolean {
    return this.active;
  }

  get currentScene(): AvbdGpuSceneId {
    return this.sceneId;
  }

  get sceneLabel(): string {
    return presetLabel(this.sceneId);
  }

  get bodyCount(): number {
    return this.physics?.getBodyCount() ?? 0;
  }

  get springCount(): number {
    if (this.gel) return this.gel.springs.filter((s) => s.active).length;
    return this._springCount;
  }

  get iterations(): number {
    return this.physics?.getSolverIterations() ?? 0;
  }

  init(renderer: WebGPURenderer, device: GPUDevice): void {
    if (this.ready) return;
    this.renderer = renderer;
    this.device = device;
    // Materials sandbox has no scene lights (MPM/fire are unlit). webphysics demos use
    // MeshStandard* — without these they render pure black. The environment map carries the
    // ambient term, so these stay low: enough to give surfaces a light direction and no more.
    this.root.add(new AmbientLight(0xffffff, 0.1));
    const key = new DirectionalLight(0xffffff, 1.3);
    key.position.set(4, 8, 5);
    this.root.add(key);
    const fill = new DirectionalLight(0xc8d4e8, 0.25);
    fill.position.set(-5, 3, -4);
    this.root.add(fill);
    this.immersive.attach(this.root);
    this.root.visible = false;
    this.loadScene(this.sceneId);
    this.ready = true;
    // A session that started before the exhibit finished building never got its framing applied,
    // which leaves the scene at authored scale — tens of metres, towering over the viewer.
    if (this.presenting) this.enterImmersive();
  }

  setActive(on: boolean): void {
    if (!this.ready) return;
    this.active = on;
    this.root.visible = on;
  }

  setScene(id: string): boolean {
    if (!isStackPreset(id)) return false;
    if (id === this.sceneId && this.physics) return true;
    this.sceneId = id;
    this.loadScene(id);
    return true;
  }

  reset(): void {
    this.loadScene(this.sceneId);
  }

  /** Soft reset poses without rebuilding the scene (webphysics R key). */
  resetSimulation(): void {
    this.physics?.resetSimulationToInitialPose();
    if (!this.runtime) return;
    for (const cb of this.runtime.sceneResetCallbacks) cb();
  }

  /** FPS + LMB shoot for rigid/soft demos; gel-cut keeps orbit + force colliders. */
  usesFpsControls(): boolean {
    return this.active && this.sceneId !== 'gel-cut';
  }

  isBodyDragging(): boolean {
    return this.dragging;
  }

  /**
   * Utah-style screen-space grab: raycast → world spherical joint → drag along ray.
   * Returns true if a dynamic body was picked.
   */
  async beginBodyDrag(
    clientX: number,
    clientY: number,
    canvas: HTMLElement,
    camera: PerspectiveCamera,
  ): Promise<boolean> {
    if (!this.active || !this.physics || !this.renderer || this.sceneId === 'gel-cut') return false;
    this.endBodyDrag();
    this.screenToNdc(clientX, clientY, canvas, this.dragNdc);
    this.dragRaycaster.setFromCamera(this.dragNdc, camera);
    this.dragOrigin.copy(this.dragRaycaster.ray.origin);
    this.dragDir.copy(this.dragRaycaster.ray.direction).normalize();

    await this.physics.syncPosesFromGpuAsync(this.renderer);
    const origin: [number, number, number] = [this.dragOrigin.x, this.dragOrigin.y, this.dragOrigin.z];
    const direction: [number, number, number] = [this.dragDir.x, this.dragDir.y, this.dragDir.z];
    const woken = this.runtime?.pickKinematicBody?.(origin, direction) ?? null;
    const hit =
      this.physics.pickDynamicBody(origin, direction)
      ?? (woken !== null ? this.centreHit(woken, origin) : null);
    if (!hit) return false;

    this.dragRayDistance = Math.max(hit.t, 0.1);
    this.dragJointIndex = this.physics.setDragJoint(
      hit.body,
      hit.worldHit,
      hit.localHit,
      DRAG_JOINT_STIFFNESS,
      this.dragJointIndex,
    );
    this.dragging = true;
    this.grabHighlight?.setBody(hit.body, this.physics);
    return true;
  }

  updateBodyDrag(clientX: number, clientY: number, canvas: HTMLElement, camera: PerspectiveCamera): void {
    if (!this.dragging || !this.physics || this.dragJointIndex === null) return;
    this.screenToNdc(clientX, clientY, canvas, this.dragNdc);
    this.dragRaycaster.setFromCamera(this.dragNdc, camera);
    this.dragOrigin.copy(this.dragRaycaster.ray.origin);
    this.dragDir.copy(this.dragRaycaster.ray.direction).normalize();
    const x = this.dragOrigin.x + this.dragDir.x * this.dragRayDistance;
    const y = this.dragOrigin.y + this.dragDir.y * this.dragRayDistance;
    const z = this.dragOrigin.z + this.dragDir.z * this.dragRayDistance;
    this.physics.setJointAnchorA(this.dragJointIndex, [x, y, z]);
  }

  endBodyDrag(): void {
    if (this.dragJointIndex !== null && this.physics) {
      this.physics.disableJoint(this.dragJointIndex);
    }
    this.dragging = false;
    this.grabHighlight?.setBody(null);
  }

  /**
   * Grab a specific body at its centre.
   *
   * `pickKinematicBody` wakes the body a pointer was aimed at and reports which one it was, but
   * the raycast that follows is stricter than the scene's own hit test — a ray threaded between
   * two limbs wakes a walker and then intersects none of its boxes. Falling back to the reported
   * body keeps the grab, and anchoring at the centre means the joint starts already satisfied.
   */
  private centreHit(
    body: number,
    origin: [number, number, number],
  ): { body: number; localHit: [number, number, number]; worldHit: [number, number, number]; t: number } | null {
    const pose = this.physics?.getBodyPoseCpu(body);
    if (!pose) return null;
    const [x, y, z] = pose.position;
    return {
      body,
      localHit: [0, 0, 0],
      worldHit: pose.position,
      t: Math.hypot(x - origin[0], y - origin[1], z - origin[2]),
    };
  }

  private screenToNdc(clientX: number, clientY: number, canvas: HTMLElement, out: Vector2): void {
    const rect = canvas.getBoundingClientRect();
    const w = Math.max(rect.width, 1);
    const h = Math.max(rect.height, 1);
    out.set(((clientX - rect.left) / w) * 2 - 1, -(((clientY - rect.top) / h) * 2 - 1));
  }

  shoot(config: {
    position: [number, number, number];
    direction: [number, number, number];
    averageSpeed: number;
    speedJitter?: number;
    angularJitter?: number;
  }): boolean {
    if (!this.runtime) return false;
    if (this.runtime.shootProjectileOverride) {
      return this.runtime.shootProjectileOverride(config);
    }
    return this.runtime.spawner.shoot(config);
  }

  /** Bench helper — force gel-cut and clear cut state. */
  prepareBench(): void {
    this.setScene('gel-cut');
    this.setActive(true);
  }

  /** Desktop camera framing for the active physics preset. */
  applyCamera(camera: PerspectiveCamera, controls?: { target: { set: (x: number, y: number, z: number) => void } }): void {
    const cfg = STACK_PRESET_CONFIGS[this.sceneId];
    camera.position.set(cfg.cameraPosition[0], cfg.cameraPosition[1], cfg.cameraPosition[2]);
    const look = cfg.cameraLookAt;
    camera.lookAt(look[0], look[1], look[2]);
    controls?.target.set(look[0], look[1], look[2]);
  }

  /** Scene-supplied readout for the on-screen hint, when the active scene offers one. */
  sceneStatusText(): string | null {
    return this.runtime?.sceneStatusText?.() ?? null;
  }

  step(dt: number, forces: ForcePoint[]): void {
    if (!this.active || !this.physics || !this.renderer || !this.runtime) return;
    const t0 = performance.now();
    if (this.sceneId === 'gel-cut') {
      this.syncKinematics(forces);
      const blades = this.activeBladeObbs();
      this.lastCutCount = severGelSpringsInObbs(this.physics, this.gel?.springs ?? [], blades);
    } else {
      this.lastCutCount = 0;
    }
    for (const cb of this.runtime.scenePreStepCallbacks) cb(dt, this.renderer);
    this.physics.step(dt, this.renderer);
    for (const cb of this.runtime.sceneUpdateCallbacks) cb(dt);
    this.runtime.spawner.syncVisuals(this.physics, this.renderer);
    for (const v of this.runtime.trackedVisualSets) v.syncVisuals(this.physics, this.renderer);
    for (const v of this.runtime.trackedSpringVisualSets) v.syncVisuals(this.physics);
    for (const v of this.runtime.syncedSceneVisuals) v.syncVisuals(this.physics, this.renderer);
    this.gel?.visuals.syncVisuals(this.physics);
    this.handVisuals?.syncVisuals(this.physics);
    this.colliderVisuals?.syncVisuals(this.physics);
    this.grabHighlight?.sync(this.physics, this.renderer, dt);
    this.refreshPickMirror();
    this.probeNonFinitePoses();
    this.lastStepMs = performance.now() - t0;
  }

  private probeNonFinitePoses(): void {
    const physics = this.physics;
    const renderer = this.renderer;
    if (!NAN_PROBE || this.nanProbeReported || !physics || !renderer) return;
    this.nanProbeFrame++;
    // Sample every frame early on: knowing whether the blow-up happens on the first step or
    // accumulates over several separates a bad initial pose from a diverging solve.
    if (
      this.nanProbeFrame > NAN_PROBE_DENSE_FRAMES &&
      this.nanProbeFrame % NAN_PROBE_INTERVAL_FRAMES !== 0
    ) return;
    if (this.poseSyncInFlight) return;
    this.poseSyncInFlight = true;
    const frame = this.nanProbeFrame;
    void physics
      .syncPosesFromGpuAsync(renderer)
      .then(async (ok) => {
        if (!ok || this.nanProbeReported) return;
        const count = physics.getBodyCount();
        const bad: string[] = [];
        let badCount = 0;
        let firstBad = -1;
        // A zero-length quaternion is finite but still poison: the solver normalizes quaternions in
        // dozens of places, and normalize() of zero is NaN.
        let firstDegenerateQuat = -1;
        for (let body = 0; body < count; body++) {
          const pose = physics.getBodyPoseCpu(body);
          if (!pose) continue;
          const q = pose.quaternion;
          if (firstDegenerateQuat < 0 && Math.hypot(q[0], q[1], q[2], q[3]) < 1e-6) {
            firstDegenerateQuat = body;
          }
          if ([...pose.position, ...q].every((v) => Number.isFinite(v))) continue;
          badCount++;
          if (firstBad < 0) firstBad = body;
          if (bad.length < 5) {
            bad.push(`#${body} pos=[${pose.position.join(', ')}] quat=[${q.join(', ')}]`);
          }
        }
        if (!this.nanProbeBaselineLogged) {
          // Baseline: with gravity applied, inertialPos.y must already differ from the authored y
          // (else the integration kernel is not running), and invMass must be positive (else the
          // body solve writes every body back unchanged). Retries until the readback succeeds —
          // some buffers are not GPU-resident on the very first frame.
          const state = await physics.readBodySolverStateAsync(renderer, 0);
          const contactsInfo = await physics.readContactDiagnosticsAsync(renderer, 0);
          if (state && !state.includes('readback failed')) {
            this.nanProbeBaselineLogged = true;
            console.warn(`GPU AVBD solver state at frame ${frame} — ${state}\n${contactsInfo ?? ''}`);
          }
        }
        if (badCount === 0 && firstDegenerateQuat < 0) return;
        this.nanProbeReported = true;
        const probeBody = Math.max(firstBad, 0);
        const state = await physics.readBodySolverStateAsync(renderer, probeBody);
        const contactsInfo = await physics.readContactDiagnosticsAsync(renderer, probeBody);
        console.error(
          `GPU AVBD: ${badCount} of ${count} bodies ` +
          `non-finite at frame ${frame} (scene "${this.sceneId}", ` +
          `bvh ${bvhEnabledFromQuery() ? 'on' : 'off'}, ` +
          `zero-length quat on body ${firstDegenerateQuat})\n${bad.join('\n')}\n` +
          `${state ?? ''}\n${contactsInfo ?? ''}`,
        );
      })
      .catch(() => undefined)
      .finally(() => {
        this.poseSyncInFlight = false;
      });
  }

  /**
   * Keep the CPU pose mirror roughly current so a pinch can pick synchronously.
   *
   * The desktop mouse path awaits this before picking, which is fine for a click but would cost
   * a stall every XR frame. Letting it land a frame or two late is imperceptible for aiming.
   */
  private refreshPickMirror(): void {
    const physics = this.physics;
    const renderer = this.renderer;
    if (!physics || !renderer || !this.presenting || this.poseSyncInFlight) return;
    if (!this.usesPresetFraming) return;
    if (physics.getBodyCount() > PICK_SYNC_MAX_BODIES) return;
    this.poseSyncInFlight = true;
    void physics
      .syncPosesFromGpuAsync(renderer)
      .catch(() => false)
      .finally(() => {
        this.poseSyncInFlight = false;
      });
  }

  dispose(): void {
    this.teardownScene();
    this.root.removeFromParent();
    this.ready = false;
    this.active = false;
  }

  private loadScene(id: AvbdGpuSceneId): void {
    if (!this.device) return;
    this.teardownScene();
    this.sceneId = id;
    this.nanProbeReported = false;
    this.nanProbeBaselineLogged = false;
    this.nanProbeFrame = 0;
    const cfg = STACK_PRESET_CONFIGS[id];
    const isGel = id === 'gel-cut';
    this.physics = new PhysicsEngine(this.device, {
      maxBodies: Math.min(cfg.maxBodies + KINEMATIC_POOL_TOTAL, MAX_ENGINE_BODIES),
      gravity: [0, isGel ? -6 : -9.81, 0],
      substeps: isGel ? 2 : 4,
      deltaTime: 1 / 60,
      pairManifoldSlots: 8,
      solverIterations: isGel ? 8 : 4,
      pairSolveColorCount: cfg.physics.maxPairSolveColorCount,
      maxPairsPerBodyBroadphase: cfg.physics.maxPairsPerBodyBroadphase,
      maxContactsPerBodySolver: cfg.physics.maxContactsPerBodySolver ?? 64,
      maxSpringsPerBodySolver: isGel ? 32 : 12,
      maxFixedStepsPerFrame: 1,
      enableBvhBuild: bvhEnabledFromQuery(),
      bvhBuildOnce: false,
      bvhRebuildIntervalFrames: 1,
      bvhWaitForGpuCompletion: false,
      avbdFriction: AVBD_FRICTION_STATIC,
      avbdBodySolveMode: 'colored',
    });
    applyReferenceAvbdConfig(this.physics);
    if (cfg.physics.activePairSolveColorCount !== undefined) {
      this.physics.setPairSolveColorCount(cfg.physics.activePairSolveColorCount);
    }
    if (isGel) {
      this.physics.setSubsteps(2);
      this.physics.setSolverIterations(8);
    }
    const substepOverride = intFromQuery('avbdsubsteps');
    const iterOverride = intFromQuery('avbditers');
    if (substepOverride !== null && substepOverride > 0) this.physics.setSubsteps(substepOverride);
    if (iterOverride !== null) this.physics.setSolverIterations(iterOverride);

    this.runtime = buildPresetScene({
      parent: this.root,
      physics: this.physics,
      stackPreset: id,
      stackConfig: cfg,
    });

    if (isGel) {
      this.gel = buildGelCutScene({ scene: this.runtime.sceneRoot, physics: this.physics });
      this._springCount = this.gel.springCount;
    } else {
      this.gel = null;
      this._springCount = this.physics.getSpringCount();
    }

    // Measured before the kinematic pools exist, so parked hands never widen the framing.
    this.measureScene();
    if (NAN_PROBE) this.reportAuthoredPoses();
    // Gel-cut is poked by the desktop force colliders too, so it needs its pool immediately.
    // The rigid/soft presets only ever use hands in XR, and pay nothing for them until then.
    if (isGel) this.allocKinematicPools();
    this.grabHighlight = new GrabHighlight(this.runtime.sceneRoot);
    // Re-entering also re-decides whether this preset offers pointer grabbing.
    if (this.presenting) this.enterImmersive();
  }

  /**
   * CPU-authored poses, before anything has been read back from the GPU. Separates "the scene was
   * built wrong" from "the GPU round-trip corrupted it", which the per-frame probe cannot tell
   * apart because its readback overwrites the CPU mirror.
   */
  private reportAuthoredPoses(): void {
    const physics = this.physics;
    if (!physics) return;
    const count = physics.getBodyCount();
    let nonFinite = 0;
    const samples: string[] = [];
    for (let body = 0; body < count; body++) {
      const pose = physics.getBodyPoseCpu(body);
      if (!pose) continue;
      if (!pose.position.every((v) => Number.isFinite(v))) nonFinite++;
      if (samples.length < 3) samples.push(`#${body} [${pose.position.join(', ')}]`);
    }
    console.warn(
      `GPU AVBD authored poses for "${this.sceneId}": ${nonFinite} of ${count} non-finite. ` +
      samples.join('  '),
    );
  }

  /**
   * Bounds of the built scene, ignoring the ground slab. Presets place their content at wildly
   * different scales and none of them centre it on the origin, so both the size and the offset
   * have to come from the bodies themselves.
   */
  private measureScene(): void {
    const physics = this.physics;
    if (!physics) return;
    let minX = Infinity;
    let minY = Infinity;
    let minZ = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    let maxZ = -Infinity;

    const count = physics.getBodyCount();
    for (let body = 0; body < count; body++) {
      const pose = physics.getBodyPoseCpu(body);
      if (!pose) continue;
      const [hx, hy, hz] = pose.halfExtents;
      if (Math.max(hx, hy, hz) > FRAMING_BOUNDS_LIMIT) continue;
      const [x, y, z] = pose.position;
      // Half-extents are the local box; using them unrotated overestimates a tilted body
      // slightly, which only ever frames a touch loose.
      minX = Math.min(minX, x - hx);
      minY = Math.min(minY, y - hy);
      minZ = Math.min(minZ, z - hz);
      maxX = Math.max(maxX, x + hx);
      maxY = Math.max(maxY, y + hy);
      maxZ = Math.max(maxZ, z + hz);
    }

    if (!Number.isFinite(minX)) {
      this.sceneCenter.set(0, DOMAIN * 0.5, 0);
      this.sceneSize = DOMAIN;
      return;
    }

    this.sceneCenter.set((minX + maxX) * 0.5, (minY + maxY) * 0.5, (minZ + maxZ) * 0.5);
    this.sceneSize = Math.max(maxX - minX, maxY - minY, maxZ - minZ, 1e-3);
  }

  /** Gel-cut is authored for the shared 1 m domain and keeps the sandbox's own framing. */
  private get usesPresetFraming(): boolean {
    return this.sceneId !== 'gel-cut';
  }

  /** Frame the measured scene to hand scale and centre it on the rig pivot. */
  private applyXrFraming(): void {
    if (!this.usesPresetFraming) {
      // Back to the shared sandbox domain, in case a preset resized it on the way here.
      this.root.position.set(0, 0, 0);
      this.immersive.setDomainSize(DOMAIN);
      this.immersive.setPlacement({ ...GEL_PLACEMENT });
      return;
    }
    this.immersive.setDomainSize(this.sceneSize);
    this.immersive.setPlacement({
      ...XR_PLACEMENT,
      framedSize: XR_FRAMED_SIZE,
      framedSizeRange: XR_FRAMED_SIZE_RANGE,
      turntable: false,
    });
    // `setDomainSize` puts the pivot at the middle of a domain sitting on y = 0; these presets
    // are centred wherever they like, so the offset makes up the difference.
    this.root.position.set(
      -this.sceneCenter.x,
      -this.sceneCenter.y + this.sceneSize * 0.5,
      -this.sceneCenter.z,
    );
  }

  enterImmersive(): void {
    // Recorded before the readiness bail so init can pick the framing up when it finishes.
    this.presenting = true;
    if (!this.ready) return;
    this.endBodyDrag();
    this.allocKinematicPools();
    this.applyXrFraming();
    this.immersive.setBodyPointer(this.usesPresetFraming ? this : null);
  }

  exitImmersive(): void {
    this.presenting = false;
    this.endGrab();
    this.immersive.setBodyPointer(null);
    // Desktop cameras use the preset's authored coordinates, so the recentring has to come off.
    this.root.position.set(0, 0, 0);
    this.setHandColliders([]);
  }

  private teardownScene(): void {
    this.endBodyDrag();
    this.dragJointIndex = null;
    this.grabHighlight?.dispose();
    this.grabHighlight = null;
    this.handVisuals?.dispose();
    this.colliderVisuals?.dispose();
    this.handVisuals = null;
    this.colliderVisuals = null;
    this.handBodies = [];
    this.colliderBodies = [];
    this.kinPrevTargets.clear();
    this.gel?.visuals.dispose();
    this.gel = null;
    this.runtime?.dispose();
    this.runtime = null;
    // Not clearScene(): that zero-fills every mirror array and flags them for re-upload, which on
    // the larger presets is hundreds of megabytes of memset plus a pointless GPU write into an
    // engine we are about to drop on the floor.
    if (this.physics && this.renderer) this.physics.dispose(this.renderer);
    this.physics = null;
  }

  private parkSlot(index: number): [number, number, number] {
    const spacing = Math.max(this.sceneSize * 0.02, 0.02);
    const column = index % PARK_COLUMNS;
    const row = Math.floor(index / PARK_COLUMNS);
    return [
      (column - (PARK_COLUMNS - 1) * 0.5) * spacing,
      this.sceneCenter.y - this.sceneSize,
      row * spacing,
    ];
  }

  /** Move a pool slot out of play and shrink it, so a parked box can never touch anything. */
  private parkBody(index: number, body: number): void {
    if (!this.physics) return;
    this.kinPrevTargets.delete(body);
    this.physics.setBodyPose(body, this.parkSlot(index), undefined, [0, 0, 0], [0, 0, 0]);
    this.physics.setBodyShapeHalfExtents(body, [
      PARK_HALF_EXTENT,
      PARK_HALF_EXTENT,
      PARK_HALF_EXTENT,
    ]);
  }

  /**
   * Pose a kinematic body so it sweeps toward the tracked target instead of
   * teleporting: the body is placed at last frame's target with the
   * finite-difference velocity that carries it to the current one over the
   * substeps of this frame. Contacts then see real hand motion (impulses,
   * friction, swept broadphase) at the cost of one frame of collider latency.
   */
  private driveKinematic(
    body: number,
    p: [number, number, number],
    q: [number, number, number, number],
    dt: number,
  ): void {
    const physics = this.physics!;
    const prev = this.kinPrevTargets.get(body);
    let drove = false;
    if (prev && dt > 0) {
      const invDt = 1 / dt;
      const vx = (p[0] - prev[0]) * invDt;
      const vy = (p[1] - prev[1]) * invDt;
      const vz = (p[2] - prev[2]) * invDt;
      const speedSq = vx * vx + vy * vy + vz * vz;

      // Angular velocity from the frame-to-frame quaternion delta
      // (small-angle: w = 2 * vec(q_new * conj(q_prev)) / dt).
      const px = prev[3], py = prev[4], pz = prev[5], pw = prev[6];
      let dqx = q[3] * -px + q[0] * pw + q[1] * -pz - q[2] * -py;
      let dqy = q[3] * -py - q[0] * -pz + q[1] * pw + q[2] * -px;
      let dqz = q[3] * -pz + q[0] * -py - q[1] * -px + q[2] * pw;
      const dqw = q[3] * pw - q[0] * -px - q[1] * -py - q[2] * -pz;
      if (dqw < 0) { dqx = -dqx; dqy = -dqy; dqz = -dqz; }
      const wx = 2 * dqx * invDt;
      const wy = 2 * dqy * invDt;
      const wz = 2 * dqz * invDt;
      const spinSq = wx * wx + wy * wy + wz * wz;

      if (
        speedSq <= KINEMATIC_MAX_LINEAR_SPEED * KINEMATIC_MAX_LINEAR_SPEED
        && spinSq <= KINEMATIC_MAX_ANGULAR_SPEED * KINEMATIC_MAX_ANGULAR_SPEED
      ) {
        physics.setBodyPose(
          body,
          [prev[0], prev[1], prev[2]],
          [px, py, pz, pw],
          [vx, vy, vz],
          [wx, wy, wz],
        );
        drove = true;
      }
    }
    if (!drove) {
      physics.setBodyPose(body, p, q, [0, 0, 0], [0, 0, 0]);
    }
    if (prev) {
      prev[0] = p[0]; prev[1] = p[1]; prev[2] = p[2];
      prev[3] = q[0]; prev[4] = q[1]; prev[5] = q[2]; prev[6] = q[3];
    } else {
      this.kinPrevTargets.set(body, new Float32Array([...p, ...q]));
    }
  }

  private allocKinematicPools(): void {
    if (!this.physics || !this.runtime || this.handBodies.length > 0) return;
    this.handVisuals = createTrackedBodyVisualSet(this.runtime.sceneRoot, this.physics, {
      capacity: HAND_POOL,
      halfExtents: [0.03, 0.03, 0.03],
      color: 0xd4a574,
      showOutline: false,
      castShadow: false,
      receiveShadow: false,
    });
    this.colliderVisuals = createTrackedBodyVisualSet(this.runtime.sceneRoot, this.physics, {
      capacity: COLLIDER_POOL,
      halfExtents: [0.06, 0.06, 0.06],
      color: 0x7a8494,
      showOutline: false,
      castShadow: false,
      receiveShadow: false,
    });
    for (let i = 0; i < HAND_POOL; i++) {
      const body = this.physics.addBody({
        position: this.parkSlot(i),
        mass: 0,
        halfExtents: [PARK_HALF_EXTENT, PARK_HALF_EXTENT, PARK_HALF_EXTENT],
        friction: 0.8,
        lockRotation: true,
        collisionGroup: KINEMATIC_COLLISION_GROUP,
        collisionMask: 0xff,
      });
      this.handBodies.push(body);
      this.handVisuals.addBody(body);
    }
    for (let i = 0; i < COLLIDER_POOL; i++) {
      const body = this.physics.addBody({
        position: this.parkSlot(HAND_POOL + i),
        mass: 0,
        halfExtents: [PARK_HALF_EXTENT, PARK_HALF_EXTENT, PARK_HALF_EXTENT],
        friction: 0.7,
        lockRotation: true,
        collisionGroup: KINEMATIC_COLLISION_GROUP,
        collisionMask: 0xff,
      });
      this.colliderBodies.push(body);
      this.colliderVisuals.addBody(body);
    }
    // Both pools come out of one allocation run, so they are a single range. A scene that has to
    // detect being shoved (the walking crowd) scans that range for user-driven motion.
    const base = this.handBodies[0]!;
    const last = this.colliderBodies[this.colliderBodies.length - 1]!;
    const count = last === base + HAND_POOL + COLLIDER_POOL - 1 ? HAND_POOL + COLLIDER_POOL : HAND_POOL;
    this.runtime.setKinematicImpactors?.(base, count);
  }

  private forceToWorld(f: ForcePoint): {
    p: [number, number, number];
    half: [number, number, number];
    quat: [number, number, number, number];
  } {
    const p: [number, number, number] = [
      (f.x - 0.5) * DOMAIN,
      f.y * DOMAIN,
      (f.z - 0.5) * DOMAIN,
    ];
    if (f.isCapsule) {
      const r = Math.max((f.radius > 0 ? f.radius : f.hy) * DOMAIN, 0.01);
      return {
        p,
        half: [f.hx * DOMAIN, r, r],
        quat: basisToQuat(f),
      };
    }
    if (f.isBox) {
      return {
        p,
        half: [f.hx * DOMAIN, f.hy * DOMAIN, f.hz * DOMAIN],
        quat: basisToQuat(f),
      };
    }
    const r = Math.max(f.radius * DOMAIN, 0.015);
    return { p, half: [r, r, r], quat: [0, 0, 0, 1] };
  }

  private syncKinematics(forces: ForcePoint[]): void {
    if (!this.physics) return;
    const now = performance.now();
    const dt = clamp((now - this.forceSyncMs) / 1000, KINEMATIC_MIN_DT, KINEMATIC_MAX_DT);
    this.forceSyncMs = now;
    const usedH = new Uint8Array(this.handBodies.length);
    const usedC = new Uint8Array(this.colliderBodies.length);
    let hi = 0;
    let ci = 0;
    for (const f of forces) {
      if (f.strength === 0 && !f.isBox && !f.isCapsule && f.radius <= 0) continue;
      const { p, half, quat } = this.forceToWorld(f);
      const isHand = f.isBox || f.isCapsule;
      const pool = isHand ? this.handBodies : this.colliderBodies;
      const used = isHand ? usedH : usedC;
      const idx = isHand ? hi++ : ci++;
      if (idx >= pool.length) continue;
      used[idx] = 1;
      const body = pool[idx];
      // Resize via re-add is unavailable; approximate with pose only (shapes fixed at pool create).
      // For boxes with varying size, rewrite shape half-extents on the CPU buffer.
      this.physics.setBodyPose(body, p, quat, [0, 0, 0], [0, 0, 0]);
      this.physics.setBodyShapeHalfExtents(body, half);
    }
    for (let i = 0; i < this.handBodies.length; i++) {
      if (!usedH[i]) this.parkBody(i, this.handBodies[i]!);
    }
    for (let i = 0; i < this.colliderBodies.length; i++) {
      if (!usedC[i]) this.parkBody(HAND_POOL + i, this.colliderBodies[i]!);
    }
  }

  /** The node physics coordinates are expressed in — hand colliders must be built in its space. */
  get handColliderSpace(): Group {
    return this.runtime?.sceneRoot ?? this.root;
  }

  /** Pose the hand pool from tracked-hand boxes already in physics-space coordinates. */
  setHandColliders(obbs: HandObb[]): void {
    const physics = this.physics;
    if (!physics) return;
    const now = performance.now();
    const dt = clamp((now - this.handSyncMs) / 1000, KINEMATIC_MIN_DT, KINEMATIC_MAX_DT);
    this.handSyncMs = now;
    const used = Math.min(obbs.length, this.handBodies.length);
    for (let i = 0; i < used; i++) {
      const obb = obbs[i]!;
      const body = this.handBodies[i]!;
      this.driveKinematic(body, obb.position, obb.quaternion, dt);
      physics.setBodyShapeHalfExtents(body, obb.halfExtents);
    }
    for (let i = used; i < this.handBodies.length; i++) {
      this.parkBody(i, this.handBodies[i]!);
    }
  }

  /** True while the CPU pose mirror is fresh enough for a pointer pick. */
  private get pickReady(): boolean {
    const physics = this.physics;
    return (
      this.active
      && physics !== null
      && physics.getBodyCount() <= PICK_SYNC_MAX_BODIES
    );
  }

  tryGrab(ray: PointerRay): boolean {
    const physics = this.physics;
    if (!physics || this.dragging || !this.presenting || !this.pickReady) return false;

    const space = this.handColliderSpace;
    space.updateMatrixWorld(true);
    this.invRoot.copy(space.matrixWorld).invert();
    this.localOrigin.copy(ray.origin).applyMatrix4(this.invRoot);
    this.localDir.copy(ray.direction).transformDirection(this.invRoot).normalize();

    const blocked = this.runtime?.nonGrabbableBodies;
    const localOrigin: [number, number, number] = [this.localOrigin.x, this.localOrigin.y, this.localOrigin.z];
    const localDir: [number, number, number] = [this.localDir.x, this.localDir.y, this.localDir.z];
    const woken = this.runtime?.pickKinematicBody?.(localOrigin, localDir) ?? null;
    const hit =
      physics.pickDynamicBody(
        localOrigin,
        localDir,
        blocked && blocked.size > 0 ? { skip: (body) => blocked.has(body) } : undefined,
      )
      ?? (woken !== null && !blocked?.has(woken) ? this.centreHit(woken, localOrigin) : null);
    if (!hit) return false;

    this.dragJointIndex = physics.setDragJoint(
      hit.body,
      hit.worldHit,
      hit.localHit,
      DRAG_JOINT_STIFFNESS,
      this.dragJointIndex,
    );
    this.dragging = true;
    this.grabHighlight?.setBody(hit.body, physics);
    this.grabTarget
      .set(hit.worldHit[0], hit.worldHit[1], hit.worldHit[2])
      .applyMatrix4(space.matrixWorld);
    this.dragRayDistance = Math.max(this.grabTarget.distanceTo(ray.origin), 0.05);
    this.grabHasWrist = false;
    return true;
  }

  moveGrab(ray: PointerRay, wrist: Vector3 | null): void {
    const physics = this.physics;
    if (!this.dragging || !physics || this.dragJointIndex === null) return;

    if (wrist) {
      if (this.grabHasWrist) {
        this.grabDelta.subVectors(wrist, this.grabWrist);
        if (this.grabDelta.lengthSq() <= MAX_WRIST_STEP * MAX_WRIST_STEP) {
          this.grabTarget.add(this.grabDelta);
        }
      }
      this.grabWrist.copy(wrist);
      this.grabHasWrist = true;
    } else if (!this.grabHasWrist) {
      // Controllers have no wrist joint; hold the body at its original depth along the ray.
      this.grabTarget.copy(ray.origin).addScaledVector(ray.direction, this.dragRayDistance);
    }
    // A hand that had a wrist and lost it is mid-dropout: hold the anchor still rather than
    // snapping to the shoulder-anchored ray, which is a different frame of reference entirely.

    const space = this.handColliderSpace;
    space.updateMatrixWorld(true);
    this.invRoot.copy(space.matrixWorld).invert();
    this.localOrigin.copy(this.grabTarget).applyMatrix4(this.invRoot);
    physics.setJointAnchorA(this.dragJointIndex, [
      this.localOrigin.x,
      this.localOrigin.y,
      this.localOrigin.z,
    ]);
  }

  endGrab(): void {
    this.endBodyDrag();
    this.grabHasWrist = false;
  }

  private activeBladeObbs(): Array<{
    position: [number, number, number];
    halfExtents: [number, number, number];
    quaternion: [number, number, number, number];
  }> {
    if (!this.physics) return [];
    const out: Array<{
      position: [number, number, number];
      halfExtents: [number, number, number];
      quaternion: [number, number, number, number];
    }> = [];
    const collect = (bodies: number[]) => {
      for (const body of bodies) {
        const pose = this.physics!.getBodyPoseCpu(body);
        if (!pose || pose.position[1] < -5) continue;
        out.push({
          position: pose.position,
          halfExtents: pose.halfExtents,
          quaternion: pose.quaternion,
        });
      }
    };
    collect(this.handBodies);
    collect(this.colliderBodies);
    return out;
  }
}
