/**
 * Immersive VR, aimed at Safari on visionOS.
 *
 * The solver is compute shaders, so this has to be a WebGPU-backed XR session — there is no
 * WebGL fallback to drop to. That path only became possible once WebKit implemented the WebXR /
 * WebGPU binding, so entry is gated on `XRGPUBinding` being present and on the session actually
 * granting the `webgpu` feature. three's XRManager throws a fairly opaque error otherwise, and a
 * headset going black is a bad way to find out.
 *
 * Two consequences of the GPUDevice needing to be XR-compatible, both easy to get wrong:
 *
 *  - `renderer.xr.enabled` must be true *before* `renderer.init()`, because that is when three
 *    requests the adapter and it passes `xrCompatible` straight through.
 *  - the frame loop must go through `renderer.setAnimationLoop`, since in a session frames are
 *    driven by `XRSession.requestAnimationFrame` and not by the window's.
 *
 * Navigation is deliberately object-centric rather than viewer-centric: one pinch turns the
 * domain (when turntable is on); two pinches pan from wrist travel and scale from inter-hand
 * distance. Moving the viewer instead would be both more work and, on a device with no
 * thumbsticks, a good way to make someone ill.
 */
import {
  Group,
  type Matrix4,
  Object3D,
  Quaternion,
  Raycaster,
  Vector3,
  type Renderer,
} from 'three/webgpu';
import { RayGrab, type PointerRay } from './RayGrab';
import { ModePanel } from './ModePanel';
import type { GizmoMode } from '../scene/Obstacles';

/** Where the domain is placed relative to the viewer, in metres. */
/** Lap / tabletop default — matches materials + sandbox fire. */
const DEFAULT_PLACEMENT = { distance: 0.48, height: 0.88 };

/** The domain's largest dimension is scaled to this, so every preset frames the same way. */
const DEFAULT_FRAMED_SIZE = 0.42;

/**
 * Two-handed pinch pans the rig from wrist travel and scales framedSize from inter-hand
 * distance (not target-ray origin). visionOS transient pointers are shoulder-anchored, so
 * ray origins barely move when you pull both hands toward yourself — wrists do.
 */
const PAN_GAIN = 1.15;
// Loose bounds that only stop the stage being flung out of reach entirely. Vertical is the
// widest: physics presets get framed at standing height and want dragging down to a floor game
// or up to eye level.
const PAN_LIMIT = { x: 1.0, y: 1.4, z: 0.8 };

/** Two-hand pinch: pull apart / pinch together scales `framedSize` (rig world size). */
const FRAMED_SIZE_MIN = 0.14;
const FRAMED_SIZE_MAX = 0.95;

/**
 * When the session is head-origin (`local`) rather than floor-origin, floor-relative heights are
 * shifted down by about a standing eye height so a “table at 0.9 m” still lands near the lap.
 */
const LOCAL_EYE_HEIGHT = 1.5;

/**
 * Frames to give tracking before anchoring to a pose the runtime still calls emulated. Past this
 * the guess is better than leaving the stage at the reference-space origin.
 */
const ANCHOR_SETTLE_FRAMES = 30;

/**
 * Whether the runtime will give us a floor-relative origin.
 *
 * Asked by requesting the space rather than reading `session.enabledFeatures`, which is optional
 * in the spec and absent on some runtimes. Treating a missing array as "no floor" drops us onto
 * the eye-height guess below, and that puts the scene at a different height on every entry.
 */
async function hasFloorOrigin(session: XRSession): Promise<boolean> {
  try {
    await session.requestReferenceSpace('local-floor');
    return true;
  } catch {
    return false;
  }
}

/**
 * Two gains, because a pinch is read from two signals at once.
 *
 * visionOS builds a transient pointer as an ergonomic ray anchored near the shoulder and passing
 * through the pinching hand, so moving that hand changes both where the ray starts and where it
 * points. Which of the two moves more is not something to depend on — a controller on another
 * headset swings mostly in orientation, a hand mostly in position — so both are summed and the
 * gesture works out the same either way.
 */
const AIM_GAIN = 1.6;
const REACH_GAIN = 4.0;

/** Per-second velocity retention once the pinch is released; gives the turntable some spin. */
const SPIN_RETENTION = 0.01;

/** Below this the residual spin is dropped, so the box actually comes to rest. */
const SPIN_EPSILON = 1e-3;

/**
 * Release velocity is smoothed over frames and capped, rather than taken from the last frame
 * alone. Hand tracking drops poses and the frame rate is not steady, so a single long frame can
 * report an implausible speed; left as-is that flings the domain through several turns.
 */
const SPIN_SMOOTHING = 0.35;
const MAX_SPIN = 6.0;

/** How far the box may be tipped, so it can never end up upside down. */
const PITCH_LIMIT = Math.PI * 0.35;

/**
 * Two short pinches within this window cycle gizmo mode (move → turn → size).
 * Measured between completed taps (`select` / `selectend`), not selectstart — transient-pointer
 * sources often do not survive long enough for a selectstart-based arm to stick.
 */
const DOUBLE_PINCH_MS = 700;
/** Longer than this is a hold/drag, not a tap, and does not arm a double-pinch. */
const TAP_MAX_MS = 450;

const GIZMO_MODE_ORDER: GizmoMode[] = ['translate', 'rotate', 'scale'];

/** Frame counts that report in, so a loop that stalls shows up as a line that never arrives. */
const FRAME_REPORTS = new Set([1, 2, 3, 5, 10, 30, 120]);

/**
 * Resizes the XR projection layer, which three's WebGPU path otherwise leaves to the compositor.
 *
 * On the WebGL path three passes its framebuffer scale factor into `createProjectionLayer`; the
 * WebGPU path passes only the formats, so the layer comes back at whatever the compositor
 * recommends. On a Vision Pro that is 4851x3887 per eye — around 38 megapixels of raymarching a
 * frame, backed by an eye buffer and a half-gigabyte float intermediate for tone mapping.
 *
 * visionOS ignores it in both directions: 0.3, 1 and 2.484 all return the same 2048x1984 layer.
 * See {@link ImmersiveMode.cropFrusta} for what that costs and what is done about it.
 */
let layerScale = 1;


/**
 * Stops three setting a viewport or scissor rect for the duration of a session.
 *
 * visionOS reads any explicit `setScissorRect` — even one covering the whole attachment — as a
 * hint about where in the eye display the image belongs, and clips to it; `setViewport` behaves
 * the same way. That is WebKit bug 315274, and it renders the scene into a sub-rectangle of each
 * eye. PlayCanvas hit it too and fixed it by simply not making the calls.
 *
 * three additionally scales the viewport by the renderer's pixel ratio, which on the WebGPU path
 * is never reset to 1 the way it is for WebGL — so at any tier above `performance` the viewport
 * came out larger than the attachment as well.
 *
 * Dropping the calls is only right if the compositor samples the whole attachment. It does not:
 * the eye texture is padded, and the frustum belongs in a sub-rectangle of it. See
 * {@link ViewportPolicy}.
 */
let suppressPassRects = false;

/**
 * Where in the eye attachment a frustum is drawn.
 *
 * The compositor samples the rectangle it named and stretches that over the eye, so the only thing
 * that has to be true is that the pixels land where it will look for them.
 *
 *  - `raw` — `setViewport(v.x, v.y, v.width, v.height)`, untouched. What three's own WebGPU path
 *    does, and correct anywhere the two ends agree on which corner y is measured from.
 *  - `full` — ignore the viewport, render across the whole attachment, and drop the rect calls
 *    entirely. WebKit bug 315274's workaround, and correct only if the attachment is the eye.
 *  - `fit` — scale the reported viewport uniformly until it fits the attachment. A safety net now
 *    that `fitViewportToTexture` asks for a rectangle that already fits; on its own it is `raw`.
 *  - `fit-flipped` — the same rectangle measured from the opposite edge. three hands the viewport
 *    to `setViewport` untouched, but WebXR inherited bottom-left viewports from GL and WebGPU
 *    takes them top-left, so a rectangle shorter than the attachment lands on the wrong side.
 *
 * Switchable during a session — the suppression shim reads it per call — so all four can be told
 * apart by looking rather than by four re-entries.
 */
export type ViewportPolicy = 'raw' | 'full' | 'fit' | 'fit-flipped';

/**
 * three's XRManager.foveateBoundTexture assumes a post-processing target. With PR #34153's
 * single-pass path that target is null, and an unpatched (or Vite-cached) build throws every
 * frame. Guard it on the live instance so a stale prebundle cannot take the session down.
 */
function installFoveationNullGuard(xr: {
  foveateBoundTexture?: (renderTarget: unknown) => void;
  koraFoveationGuarded?: boolean;
}): void {
  if (xr.koraFoveationGuarded || typeof xr.foveateBoundTexture !== 'function') return;
  const original = xr.foveateBoundTexture.bind(xr);
  xr.foveateBoundTexture = (renderTarget: unknown) => {
    if (renderTarget == null) return;
    original(renderTarget);
  };
  xr.koraFoveationGuarded = true;
}

function installPassRectSuppression(): void {
  type Encoder = { prototype: Record<string, unknown> };
  const proto = (globalThis as { GPURenderPassEncoder?: Encoder }).GPURenderPassEncoder?.prototype;
  if (!proto || proto.koraRectsSuppressed) return;

  for (const name of ['setViewport', 'setScissorRect'] as const) {
    const original = proto[name] as (...args: number[]) => void;
    proto[name] = function (this: unknown, ...args: number[]) {
      if (suppressPassRects) return;
      original.apply(this, args);
    };
  }
  proto.koraRectsSuppressed = true;
}

function installLayerScale(): boolean {
  type Binding = { prototype: Record<string, unknown> };
  const proto = (globalThis as { XRGPUBinding?: Binding }).XRGPUBinding?.prototype;
  if (!proto) return false;
  if (proto.koraScaled) return true;

  const create = proto.createProjectionLayer as (init: object) => unknown;
  proto.createProjectionLayer = function (this: unknown, init: object) {
    // Ours first so an explicit scaleFactor from a future three would still win.
    return create.call(this, { scaleFactor: layerScale, ...init });
  };
  proto.koraScaled = true;
  return true;
}

export interface ImmersiveCallbacks {
  onEnter(): void;
  onExit(): void;
}

/**
 * Extra world-space HUD (materials strip, etc.). Picked before turntable / grab.
 * Return true from handlePick when the pinch was consumed by a button.
 */
export interface ActionPanel {
  readonly group: Group;
  readonly targets: Object3D[];
  get visible(): boolean;
  setVisible(visible: boolean): void;
  handlePick(object: Object3D): boolean;
}

/**
 * The objects a pinch is allowed to pick up, and what to do once it has.
 *
 * Kept as an interface so the XR code does not need to know what a displacement volume is; it
 * only needs some meshes to aim at and somewhere to report the selection.
 */
export interface Manipulator {
  /** Meshes a pointer may grab. */
  targets(): Object3D[];
  /** What a drag on a held object means. */
  readonly mode: GizmoMode;
  setMode(mode: GizmoMode): void;
  /** Notified when a pinch picks one, or clears the selection. */
  selectObject(object: Object3D | null): void;
}

/**
 * A simulated body a pointer can grab, for content with no pickable Object3D of its own.
 *
 * Instanced physics bodies have no per-body mesh to raycast, so this hands the pointer ray to
 * the owner and lets it do the pick against its own broadphase.
 */
export interface BodyPointer {
  /** Try to take hold of something along this reference-space ray. True if it caught. */
  tryGrab(ray: PointerRay): boolean;
  /** Once per frame while held. `wrist` is reference-space, null when the runtime has none. */
  moveGrab(ray: PointerRay, wrist: Vector3 | null): void;
  endGrab(): void;
}

/**
 * A pinch either turns the whole domain, moves one thing inside it, drags a simulated body, or
 * (as a second hand while something is held) drives two-hand scale. Kind is decided once when
 * the pinch begins.
 */
type DragKind = 'turntable' | 'object' | 'body' | 'scale';

interface Drag {
  source: XRInputSource;
  kind: DragKind;
  /** false until the first pose arrives; a pinch's opening frame only establishes an origin */
  started: boolean;
  yaw: number;
  pitch: number;
  x: number;
  y: number;
  z: number;
}

export interface PlacementOptions {
  /** Metres in front of the viewer (along −Z). */
  distance?: number;
  /** Metres above the floor reference (local-floor). */
  height?: number;
  /** World size the domain is scaled to fit, in metres. */
  framedSize?: number;
  /**
   * Limits for the two-handed scale gesture, in metres. Physics presets want a wider range than
   * the fire/MPM domains — you resize to bring a part of the sim within arm's reach.
   */
  framedSizeRange?: { min: number; max: number };
  /**
   * One-pinch turntable. Default on (fire). Materials leaves it off so a pinch is free for
   * stirring; two pinches still pan.
   */
  turntable?: boolean;
}

const scratchQuaternion = new Quaternion();
const wristA = new Vector3();
const wristB = new Vector3();
const wristScratch = new Vector3();

/**
 * Where a pointer aims, as yaw and pitch in the reference space.
 *
 * Yaw is zero looking down -Z and grows anticlockwise from above, which is three's own
 * convention, so a swing to the right reads as a decrease.
 */
function aim(orientation: DOMPointReadOnly, out: Vector3): { yaw: number; pitch: number } {
  scratchQuaternion.set(orientation.x, orientation.y, orientation.z, orientation.w);
  out.set(0, 0, -1).applyQuaternion(scratchQuaternion);
  return {
    yaw: Math.atan2(-out.x, -out.z),
    pitch: Math.asin(Math.max(-1, Math.min(1, out.y))),
  };
}

function smoothSpin(current: number, sample: number): number {
  const blended = current + (sample - current) * SPIN_SMOOTHING;
  return Math.max(-MAX_SPIN, Math.min(MAX_SPIN, blended));
}

/** Shortest signed distance between two angles, so crossing +/-pi does not fling the box. */
function angleDelta(from: number, to: number): number {
  let d = (to - from) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

export class ImmersiveMode {
  /** Placement in the reference space. Never rotated, so the viewer's world stays level. */
  readonly rig = new Group();
  /** What the pointer turns. */
  readonly pivot = new Group();
  /** Holds the scene content, offset so the pivot sits at the middle of the domain. */
  private readonly content = new Group();

  /** Reference-space furniture: the mode buttons. Added to the scene, not to the rig. */
  readonly hud = new Group();

  /**
   * Dumps each eye's sub-image on the second frame of the next session.
   *
   * It calls into the binding on the same frame as the first render, which was a poor thing to
   * have in the picture while the first frame was the one under suspicion. Now that a session
   * survives, the sub-image layout is the only place the eye geometry is stated outright.
   */
  debugViews = true;

  /**
   * See {@link ViewportPolicy}. `full` because {@link cropFrusta} makes the frustum follow the
   * rectangle drawn rather than the other way round, and the whole attachment is the largest
   * rectangle available — so it buys the widest window the layer can reach.
   */
  viewportPolicy: ViewportPolicy = 'full';

  private readonly drags = new Map<XRInputSource, Drag>();
  private readonly velocity = { yaw: 0, pitch: 0 };
  private readonly direction = new Vector3();
  private readonly raycaster = new Raycaster();
  private readonly grab = new RayGrab();
  private readonly ray: PointerRay = {
    origin: new Vector3(),
    direction: new Vector3(),
    orientation: new Quaternion(),
  };
  private panel: ModePanel | null = null;
  private actionPanel: ActionPanel | null = null;
  private manipulator: Manipulator | null = null;
  private bodyPointer: BodyPointer | null = null;
  /** Sandbox folds gizmo mode into its paginated HUD; the legacy strip stays off there. */
  private modePanelEnabled = true;
  private domainSize = 1;
  private placement = { ...DEFAULT_PLACEMENT };
  private framedSize = DEFAULT_FRAMED_SIZE;
  private framedSizeMin = FRAMED_SIZE_MIN;
  private framedSizeMax = FRAMED_SIZE_MAX;
  private turntableEnabled = true;
  /** Floor-relative placement is valid (local-floor); otherwise heights are eye-relative. */
  private usesFloorOrigin = true;
  /** True until the first viewer pose places the stage in front of the user. */
  private pendingAnchor = false;
  /** Rig position before pan — set from the viewer so the stage is not left behind you. */
  private readonly anchorBase = new Vector3(
    0,
    DEFAULT_PLACEMENT.height,
    -DEFAULT_PLACEMENT.distance,
  );
  private readonly anchorForward = new Vector3(0, 0, -1);
  /** HUD position before pan, set from the viewer alongside `anchorBase`. */
  private readonly hudBase = new Vector3();
  /** Extra translation from two-handed pan, in metres (reference space). */
  private readonly panOffset = new Vector3();
  /** Baseline for two-hand domain scale (pull apart → larger framedSize). */
  private domainScaleGesture: { startDist: number; startFramed: number } | null = null;
  private button: HTMLButtonElement | null = null;
  private session: XRSession | null = null;
  private presenting = false;
  private framesSeen = 0;
  private sessionStart = 0;
  private layerScale = 1;
  private viewportScale = 1;
  private targetReady = false;
  private pixelRatioBeforeXR = 1;
  /** The viewport as the compositor reported it, before it was fitted to the attachment. */
  private rawViewport = 'none';
  /** The sub-image viewport as first quoted, which is what the crop is a fraction of. */
  private baseViewport: { width: number; height: number } | null = null;
  /**
   * See {@link cropFrusta}. Off by default — it broke stereo convergence. Kept as a toggle while
   * the visionOS layer/viewport mismatch is still being sorted out.
   */
  frustumCrop = false;
  private reportedCrop = false;
  /** Set by a policy change, so the effect of one shows up in the log without re-entering. */
  private reportNext = false;
  private warnedOversize = false;
  private warnedNoScale = false;
  /** `performance.now()` of the last short tap that armed a double-pinch. */
  private lastTapEnd = 0;
  private readonly pinchBeganAt = new WeakMap<XRInputSource, number>();
  /** Dedupes `select` + `selectend` both noting the same gesture. */
  private readonly pinchTapNoted = new WeakMap<XRInputSource, boolean>();

  constructor(
    private readonly renderer: Renderer,
    private readonly callbacks: ImmersiveCallbacks,
  ) {
    this.rig.add(this.pivot);
    this.pivot.add(this.content);
    this.rig.visible = true;

    this.onSelectStart = this.onSelectStart.bind(this);
    this.onSelect = this.onSelect.bind(this);
    this.onSelectEnd = this.onSelectEnd.bind(this);
  }

  /** Supplies what a pinch may pick up. The mode panel appears once one is set (if enabled). */
  setManipulator(manipulator: Manipulator): void {
    this.manipulator = manipulator;

    if (!this.panel) {
      this.panel = new ModePanel(manipulator.mode);
      this.hud.add(this.panel.group);
    }
    this.panel.setMode(manipulator.mode);
    this.panel.setVisible(this.modePanelEnabled && this.session !== null);
  }

  /**
   * Supplies something a pinch may grab out of a simulation. Picked after the HUD panels and
   * before the Object3D manipulator; pass null when the active exhibit has no bodies.
   */
  setBodyPointer(pointer: BodyPointer | null): void {
    if (this.bodyPointer && this.bodyPointer !== pointer) this.bodyPointer.endGrab();
    this.bodyPointer = pointer;
  }

  /** Hide the legacy move/turn/size strip when a sandbox HUD owns that affordance. */
  setModePanelEnabled(enabled: boolean): void {
    this.modePanelEnabled = enabled;
    this.panel?.setVisible(enabled && this.session !== null);
  }

  /**
   * World-space action strip (e.g. materials sand/goo/water). Shown for the session and
   * hit-tested on selectstart ahead of turntable / object grabs.
   */
  setActionPanel(panel: ActionPanel): void {
    if (this.actionPanel) this.hud.remove(this.actionPanel.group);
    this.actionPanel = panel;
    this.hud.add(panel.group);
    panel.setVisible(this.session !== null);
  }

  /** Reflects a mode change that came from somewhere else, so the button strip agrees. */
  showMode(mode: GizmoMode): void {
    this.panel?.setMode(mode);
  }

  get active(): boolean {
    return this.session !== null;
  }

  /** True only once the renderer is bound to the headset *and* has somewhere real to draw. */
  get rendering(): boolean {
    return this.presenting && this.targetReady;
  }

  /**
   * Resizes the projection layer itself. Takes effect on the next session, since a layer is fixed
   * in size once it exists — which is why it is also remembered across one.
   *
   * Below 1 this is a plain resolution control: the image still covers the eye, with fewer pixels
   * behind it. Above 1 it would ask for more, which visionOS declines — 2.484 returned the same
   * 2048x1984 layer as 1 did — so on that platform this is inert in both directions.
   */
  setLayerScale(scale: number): number {
    this.layerScale = Math.max(0.1, Math.min(6, scale));
    return this.layerScale;
  }

  /**
   * Fraction of each eye the compositor is asked to hand back for drawing.
   *
   * The sanctioned way to trade resolution for frame time: the texture keeps its size, the runtime
   * returns a smaller sub-image within it, and the compositor stretches what it finds there back
   * over the eye. On visionOS the second half of that does not happen — the presented region does
   * not follow the request — so it cuts the drawn rectangle without cutting the displayed one, and
   * is left at 1. `setLayerScale` is the knob with an effect on this platform.
   *
   * Applies from the frame after it is asked, which is why it is re-asked every frame.
   */
  setViewportScale(scale: number): number {
    this.viewportScale = Math.max(0.1, Math.min(1, scale));
    this.reportNext = true;
    return this.viewportScale;
  }

  /** Takes effect on the next frame, so the four can be compared inside one session. */
  setViewportPolicy(policy: ViewportPolicy): ViewportPolicy {
    this.viewportPolicy = policy;
    if (this.session) suppressPassRects = policy === 'full';
    this.reportNext = true;
    return policy;
  }

  /** The layer's per-eye texture, read off three's handle, to confirm the scale actually took. */
  private layerSize(): string {
    const xr = this.renderer.xr as unknown as {
      _glProjLayer?: { textureWidth: number; textureHeight: number };
      _webgpuBinding?: { nativeProjectionScaleFactor?: number };
    };
    const layer = xr._glProjLayer;
    const native = xr._webgpuBinding?.nativeProjectionScaleFactor;
    const size = layer ? `${layer.textureWidth}x${layer.textureHeight}` : 'none';
    return native === undefined ? size : `${size} (native x${native})`;
  }

  /**
   * Gives three's XR render target the dimensions WebKit declines to report.
   *
   * `_initWebGPUSession` sizes the target straight from the projection layer's `textureWidth` and
   * `textureHeight`, and on visionOS a layer created through `XRGPUBinding` reports both as zero.
   * The target is therefore 0x0, as is the half-float buffer the tone mapper sizes from it, and
   * the session renders into nothing: no frame is ever presented, the compositor stops asking for
   * more, and the passthrough environment simply stays where it is.
   *
   * The true size is on the `GPUTexture` the compositor hands back each frame, which three has
   * already registered against the target by the time the frame loop reaches us. Resizing clears
   * the backend's record of that registration, so the frame this happens on is deliberately not
   * rendered — from the next one the size matches, nothing is disposed, and the eye textures are
   * drawn into as intended.
   */
  private sizeXRTarget(): boolean {
    type Sized = { width: number; height: number };
    type Target = Sized & {
      depth: number;
      texture: object;
      setSize(w: number, h: number, d?: number): void;
    };

    const target = (this.renderer.xr as unknown as { _xrRenderTarget?: Target })._xrRenderTarget;
    if (!target) return false;
    if (target.width > 0 && target.height > 0) return true;

    const backend = (
      this.renderer as unknown as {
        backend?: { get?(object: object): { texture?: Sized } | undefined };
      }
    ).backend;

    const texture = backend?.get?.(target.texture)?.texture;
    if (!texture?.width || !texture.height) return false;

    // Width and height only. The texture's `depthOrArrayLayers` reads 1 here, but the view
    // descriptors the compositor hands back select `baseArrayLayer` 0 and 1, so it is really the
    // two-layer array three built the target for. Believing the field collapses the target to a
    // single layer, which drops the second eye and turns off the array depth buffer with it.
    target.setSize(texture.width, texture.height, target.depth);
    this.log(`sized the XR target to ${texture.width}x${texture.height}, drawing from next frame`);
    return false;
  }

  /**
   * Everything the compositor says about each eye, once.
   *
   * The layout is only discoverable here, and on visionOS several of the fields disagree with each
   * other: the viewport is reported in recommended-resolution space rather than the texture's, the
   * texture claims a single array layer, and the view descriptors nonetheless select layers 0 and
   * 1. The descriptors are the ones telling the truth.
   */
  private dumpSubImages(frame: XRFrame, referenceSpace: XRReferenceSpace): void {
    type SubImage = {
      viewport: { x: number; y: number; width: number; height: number };
      colorTexture: { width: number; height: number; depthOrArrayLayers: number; format: string };
      getViewDescriptor?(): object;
    };
    const xr = this.renderer.xr as unknown as {
      getWebGPUBinding?(): { getViewSubImage(layer: object, view: XRView): SubImage } | null;
      _glProjLayer?: object;
    };

    const binding = xr.getWebGPUBinding?.();
    const layer = xr._glProjLayer;
    const pose = frame.getViewerPose(referenceSpace);
    if (!binding || !layer || !pose) return;

    let shared: object | null = null;

    pose.views.forEach((view, i) => {
      const sub = binding.getViewSubImage(layer, view);
      const { viewport: v, colorTexture: t } = sub;
      const descriptor = sub.getViewDescriptor?.();
      if (i === 0) shared = t;

      this.log(
        `view ${i} | viewport ${v.x},${v.y} ${v.width}x${v.height} | ` +
          `colour ${t.width}x${t.height}x${t.depthOrArrayLayers} ${t.format} | ` +
          `sameTexture ${t === shared} | descriptor ${descriptor ? JSON.stringify(descriptor) : 'none'}`,
      );
    });
  }

  /**
   * Applies {@link ViewportPolicy} to the viewport three took from each sub-image.
   *
   * Under `raw` this only reads the rectangle, which is the point: a viewport that has to be
   * repaired before it can be used is evidence about the layer, not a problem to be solved here.
   * The one thing worth saying out loud is a viewport larger than the attachment, since that is a
   * validation error rather than a wrong picture and the frame is simply thrown away.
   */
  private fitViewports(): void {
    const target = (
      this.renderer.xr as unknown as { _xrRenderTarget?: { width: number; height: number } }
    )._xrRenderTarget;
    if (!target || target.width === 0) return;

    const xrCamera = this.renderer.xr.getCamera() as unknown as {
      cameras?: { viewport?: { x: number; y: number; width: number; height: number } }[];
    };

    const policy = this.viewportPolicy;

    (xrCamera.cameras ?? []).forEach((sub, i) => {
      const v = sub.viewport;
      if (!v) return;
      if (i === 0) {
        this.rawViewport = `${v.x},${v.y} ${v.width}x${v.height}`;
        // Before any policy touches it: the quoted rectangle is what the crop is a fraction of.
        if (!this.baseViewport && v.width > 0) {
          this.baseViewport = { width: v.width, height: v.height };
        }
      }

      if (policy === 'raw') {
        if (!this.warnedOversize && (v.x + v.width > target.width || v.y + v.height > target.height)) {
          this.warnedOversize = true;
          console.warn(
            `[kora/xr] eye ${i}'s viewport ${v.x},${v.y} ${v.width}x${v.height} does not fit the ` +
              `${target.width}x${target.height} attachment; every frame will fail validation. ` +
              `Try kora.xrViewport('fit').`,
          );
        }
        return;
      }

      if (policy === 'full') {
        v.x = 0;
        v.y = 0;
        v.width = target.width;
        v.height = target.height;
        return;
      }

      const scale = Math.min(target.width / v.width, target.height / v.height, 1);
      const width = Math.max(1, Math.floor(v.width * scale));
      const height = Math.max(1, Math.floor(v.height * scale));
      const x = Math.min(Math.max(0, Math.floor(v.x * scale)), target.width - width);
      const y = Math.min(Math.max(0, Math.floor(v.y * scale)), target.height - height);

      v.x = x;
      v.y = policy === 'fit-flipped' ? target.height - height - y : y;
      v.width = width;
      v.height = height;
    });
  }

  /**
   * Narrows each eye's frustum to the part of it the layer can actually reach.
   *
   * visionOS quotes a 5087x4081 sub-image against a 2048x1984 layer and then samples the rectangle
   * it quoted, so three fifths of what it reads is off the end of the texture. Drawing the whole
   * frustum into the part that exists is what produced the original complaint: the scene rendered
   * at 40% of its true angular size, pushed into the top-left of the eye, with the rest of the
   * display filled by whatever lies past the edge of the texture — and anything moving outward
   * leaving the painted region long before it left view.
   *
   * Nothing about where the frame is drawn can fix that, in any of the four ways
   * {@link ViewportPolicy} allows, because the texels are not there to be drawn into.
   * `requestViewportScale` cannot either: it changes the rectangle that is drawn without changing
   * the one that is presented. Nor can the layer be asked for larger — 0.3, 1 and 2.484 all return
   * 2048x1984 — so the size is not ours to choose.
   *
   * What is ours to choose is the lens. The texture covers a known fraction of the rectangle being
   * sampled, that fraction maps to a known sub-frustum of the eye, and rendering that sub-frustum
   * instead puts everything at the angular size it belongs at. The cost is the rest of the eye,
   * which stays black: a correct view through a window rather than an incorrect one filling the
   * display. It costs nothing where the two agree, since the fraction is then 1.
   */
  private cropFrusta(): void {
    const quoted = this.baseViewport;
    if (!this.frustumCrop || !quoted || quoted.width === 0) return;

    const xrCamera = this.renderer.xr.getCamera() as unknown as {
      cameras?: {
        viewport?: { x: number; y: number; width: number; height: number };
        projectionMatrix: Matrix4;
        projectionMatrixInverse: Matrix4;
      }[];
    };

    for (const sub of xrCamera.cameras ?? []) {
      const v = sub.viewport;
      const e = sub.projectionMatrix.elements;
      if (!v || e[0] === 0 || e[5] === 0) continue;

      // Where the rectangle being drawn sits inside the rectangle being sampled. The compositor
      // reads texel for texel from the top-left, so these are the same coordinates.
      const u0 = v.x / quoted.width;
      const u1 = (v.x + v.width) / quoted.width;
      const w0 = v.y / quoted.height;
      const w1 = (v.y + v.height) / quoted.height;
      if (u0 <= 0.001 && u1 >= 0.999 && w0 <= 0.001 && w1 >= 0.999) continue;

      // The frustum as tangents of its half-angles, which is the form the crop is a fraction of.
      const left = (e[8] - 1) / e[0];
      const right = (e[8] + 1) / e[0];
      const bottom = (e[9] - 1) / e[5];
      const top = (e[9] + 1) / e[5];

      const l = left + (right - left) * u0;
      const r = left + (right - left) * u1;
      const t = top - (top - bottom) * w0;
      const b = top - (top - bottom) * w1;

      e[0] = 2 / (r - l);
      e[8] = (r + l) / (r - l);
      e[5] = 2 / (t - b);
      e[9] = (t + b) / (t - b);

      sub.projectionMatrixInverse.copy(sub.projectionMatrix).invert();

      if (!this.reportedCrop) {
        this.reportedCrop = true;
        const deg = (tan: number) => ((Math.atan(tan) * 180) / Math.PI).toFixed(1);
        this.log(
          `cropping each eye to the ${((u1 - u0) * 100).toFixed(1)}% x ` +
            `${((w1 - w0) * 100).toFixed(1)}% of its frustum the layer can reach — ` +
            `L${deg(l)} R${deg(r)} D${deg(b)} U${deg(t)} — so it renders at true scale, ` +
            'with the rest of the display left black',
        );
      }
    }
  }

  /** What three is actually rendering into, which is the number that was silently zero. */
  private targetSize(): string {
    const target = (
      this.renderer.xr as unknown as {
        _xrRenderTarget?: { width: number; height: number; depth: number };
      }
    )._xrRenderTarget;
    return target ? `${target.width}x${target.height}x${target.depth}` : 'none';
  }

  /**
   * Asks the compositor to hand back a smaller slice of the layer to draw into.
   *
   * The second, independent way to cut pixels, and the one that does not care whether the layer
   * was created at a sane size: the texture stays as large as it was, but only the requested
   * fraction of it is rendered and sampled. It applies from the following frame, which is why it
   * is re-asked every frame rather than set once.
   */
  private requestViewportScale(frame: XRFrame, referenceSpace: XRReferenceSpace): void {
    if (this.viewportScale >= 1) return;

    const pose = frame.getViewerPose(referenceSpace);
    if (!pose) return;

    for (const view of pose.views) {
      const scalable = view as unknown as { requestViewportScale?: (scale: number) => void };
      if (!scalable.requestViewportScale) {
        if (!this.warnedNoScale) {
          this.warnedNoScale = true;
          console.warn(
            '[kora/xr] XRView.requestViewportScale is missing, so the sub-image cannot be brought ' +
              'down to the size of the texture behind it and part of the eye will be edge clamp.',
          );
        }
        return;
      }
      scalable.requestViewportScale(this.viewportScale);
    }
  }

  /**
   * Every step between pressing the button and the first stereo frame, on one line each.
   *
   * A headset that shows nothing gives you no way to tell a session that never opened from one
   * that opened and drew an empty frame, and the two have nothing in common to fix. There are
   * only a handful of these and none repeat, so they cost nothing to leave in.
   */
  private log(message: string, detail?: unknown): void {
    if (detail === undefined) console.info(`[kora/xr] ${message}`);
    else console.info(`[kora/xr] ${message}`, detail);
  }

  /** A snapshot of everything entry depends on, for asking "why is the button doing nothing". */
  status(): Record<string, unknown> {
    const xr = this.renderer.xr as unknown as { isPresenting?: boolean };
    return {
      hasNavigatorXR: Boolean(navigator.xr),
      hasXRGPUBinding: typeof (globalThis as { XRGPUBinding?: unknown }).XRGPUBinding !== 'undefined',
      buttonHidden: this.button?.hidden ?? 'no button',
      buttonDisabled: this.button?.disabled ?? 'no button',
      buttonText: this.button?.textContent ?? 'no button',
      session: this.session !== null,
      enabledFeatures: this.session ? [...(this.session.enabledFeatures ?? [])] : null,
      rendererPresenting: xr.isPresenting ?? false,
      referenceSpace: Boolean(this.renderer.xr.getReferenceSpace()),
      framesSeen: this.framesSeen,
    };
  }

  /** Reparents an object into the rotating group. */
  /** Domain / obstacle parent — hand joints must be transformed into this space for fire solids. */
  get contentRoot(): Object3D {
    return this.content;
  }

  attach(object: Object3D): void {
    this.content.add(object);
  }

  /**
   * The domain's world size, which sets both the scale that frames it and the offset that puts
   * the pivot at its centre. The domain is modelled sitting on y = 0, not centred on the origin.
   */
  setDomainSize(size: number): void {
    this.domainSize = size;
    this.content.position.set(0, -size / 2, 0);
    this.layout();
  }

  /**
   * Where the domain sits in XR and how large it frames. Default is lap/tabletop;
   * exhibits can override distance / height / framedSize / turntable.
   */
  setPlacement(options: PlacementOptions): void {
    if (options.distance !== undefined) this.placement.distance = options.distance;
    if (options.height !== undefined) this.placement.height = options.height;
    if (options.framedSizeRange !== undefined) {
      this.framedSizeMin = options.framedSizeRange.min;
      this.framedSizeMax = options.framedSizeRange.max;
    }
    if (options.framedSize !== undefined) this.framedSize = options.framedSize;
    this.framedSize = Math.max(this.framedSizeMin, Math.min(this.framedSizeMax, this.framedSize));
    if (options.turntable !== undefined) {
      this.turntableEnabled = options.turntable;
      if (!this.turntableEnabled) {
        this.velocity.yaw = 0;
        this.velocity.pitch = 0;
        this.pivot.rotation.set(0, 0, 0);
      }
    }
    this.layout();
  }

  private layout(): void {
    if (this.session) {
      const scale = this.framedSize / Math.max(this.domainSize, 1e-3);
      this.rig.scale.setScalar(scale);
      if (!this.pendingAnchor) this.applyRigPose();
      else {
        // Pre-anchor fallback: origin facing −Z (replaced on the first viewer pose).
        this.anchorBase.set(
          0,
          this.usesFloorOrigin ? this.placement.height : this.placement.height - LOCAL_EYE_HEIGHT,
          -this.placement.distance,
        );
        this.hudBase.set(0, this.usesFloorOrigin ? 0 : -LOCAL_EYE_HEIGHT, 0);
        this.applyRigPose();
      }
    } else {
      // Outside a session the desktop camera frames the domain itself, so the rig is a no-op
      // and only has to undo the pivot offset.
      this.rig.scale.setScalar(1);
      this.rig.position.set(0, this.domainSize / 2, 0);
      this.pivot.rotation.set(0, 0, 0);
      this.panOffset.set(0, 0, 0);
      this.hudBase.set(0, 0, 0);
      this.hud.position.set(0, 0, 0);
      this.hud.rotation.set(0, 0, 0);
      this.anchorBase.set(0, this.placement.height, -this.placement.distance);
    }
  }

  private applyRigPose(): void {
    this.rig.position.set(
      this.anchorBase.x + this.panOffset.x,
      this.anchorBase.y + this.panOffset.y,
      this.anchorBase.z + this.panOffset.z,
    );
    // The HUD travels with the stage. Leaving it on its original anchor meant dragging the sim
    // down to where you could reach it stranded the buttons back where the sim used to be.
    this.hud.position.set(
      this.hudBase.x + this.panOffset.x,
      this.hudBase.y + this.panOffset.y,
      this.hudBase.z + this.panOffset.z,
    );
  }

  private applyPan(dx: number, dy: number, dz: number): void {
    this.panOffset.x = Math.max(-PAN_LIMIT.x, Math.min(PAN_LIMIT.x, this.panOffset.x + dx));
    this.panOffset.y = Math.max(-PAN_LIMIT.y, Math.min(PAN_LIMIT.y, this.panOffset.y + dy));
    this.panOffset.z = Math.max(-PAN_LIMIT.z, Math.min(PAN_LIMIT.z, this.panOffset.z + dz));
    this.applyRigPose();
  }

  /**
   * Puts the stage and HUD in front of wherever the user is actually looking when the session
   * starts — fixed room placement was easy to “lose” if you entered facing the other way.
   */
  private anchorFromViewer(pose: XRViewerPose): void {
    const p = pose.transform.position;
    const o = pose.transform.orientation;
    scratchQuaternion.set(o.x, o.y, o.z, o.w);
    this.anchorForward.set(0, 0, -1).applyQuaternion(scratchQuaternion);
    this.anchorForward.y = 0;
    if (this.anchorForward.lengthSq() < 1e-8) this.anchorForward.set(0, 0, -1);
    else this.anchorForward.normalize();

    const y = this.usesFloorOrigin
      ? this.placement.height
      : p.y + (this.placement.height - LOCAL_EYE_HEIGHT);

    this.anchorBase.set(
      p.x + this.anchorForward.x * this.placement.distance,
      y,
      p.z + this.anchorForward.z * this.placement.distance,
    );
    // HUD stays in reference space, yawed to face the user; panels keep their local offsets.
    this.hudBase.set(p.x, this.usesFloorOrigin ? 0 : p.y - LOCAL_EYE_HEIGHT, p.z);
    this.panOffset.set(0, 0, 0);
    this.applyRigPose();
    this.hud.rotation.set(0, Math.atan2(-this.anchorForward.x, -this.anchorForward.z), 0);

    this.log(
      `anchored stage | floor=${this.usesFloorOrigin} | ` +
        `base (${this.anchorBase.x.toFixed(2)}, ${this.anchorBase.y.toFixed(2)}, ${this.anchorBase.z.toFixed(2)})` +
        ` | viewer y ${p.y.toFixed(2)} | domain ${this.domainSize.toFixed(2)}m` +
        ` framed ${this.framedSize.toFixed(2)}m`,
    );
  }

  private turntableCount(): number {
    let n = 0;
    for (const drag of this.drags.values()) {
      if (drag.kind === 'turntable') n++;
    }
    return n;
  }

  /**
   * Wires up a button. It stays hidden unless the browser can actually do this, except where
   * immersive VR exists but the WebGPU binding does not — worth saying out loud, since that is
   * the difference between a current visionOS and an older one rather than a coding mistake.
   */
  async mountButton(button: HTMLButtonElement): Promise<void> {
    this.button = button;

    if (!navigator.xr) return;

    let supported = false;
    try {
      supported = await navigator.xr.isSessionSupported('immersive-vr');
    } catch (error) {
      this.log('isSessionSupported threw; leaving the button hidden', error);
      return;
    }
    this.log('immersive-vr supported', supported);
    if (!supported) return;

    button.hidden = false;

    if (typeof (globalThis as { XRGPUBinding?: unknown }).XRGPUBinding === 'undefined') {
      button.disabled = true;
      button.textContent = 'VR needs WebXR/WebGPU support';
      button.title =
        'The solver runs in compute shaders, so an immersive session has to be backed by ' +
        'WebGPU. This browser offers WebXR but not the WebGPU binding for it.';
      return;
    }

    button.textContent = 'Enter VR';
    button.addEventListener('click', () => void this.toggle());
  }

  /**
   * visionOS sometimes shows the immersive prompt, then stalls forever waiting for a hand-tracking
   * dialog that never appears. A timed-out requestSession cannot be cancelled — stacking a second
   * request in the same click is what left the button on “Starting…” forever. On stall we restore
   * the button and skip hands on the *next* click instead.
   */
  private preferHandTracking = true;
  private entering = false;

  private async toggle(): Promise<void> {
    if (this.session) {
      await this.session.end();
      return;
    }

    if (!navigator.xr || !this.button || this.entering) return;
    this.entering = true;
    this.button.disabled = true;
    this.button.textContent = 'Starting…';
    this.log('requesting a session', { handTracking: this.preferHandTracking });

    // Absolute backstop — even if something in begin() hangs past setSession's own timeout.
    const watchdog = window.setTimeout(() => {
      if (this.presenting || !this.button) return;
      this.log('entry watchdog — restoring Enter VR');
      this.preferHandTracking = false;
      this.button.disabled = false;
      this.button.textContent = 'Enter VR';
      this.entering = false;
    }, 12_000);

    try {
      const session = await this.requestImmersiveSession();
      this.log('session granted', [...(session.enabledFeatures ?? [])]);
      await this.begin(session);
    } catch (error) {
      // Leaving `session` set here would strand the frame loop on its XR branch with no session
      // behind it, so the page carries on running but stops drawing what it used to.
      const orphan = this.session;
      this.session = null;
      this.presenting = false;
      this.targetReady = false;
      suppressPassRects = false;
      this.renderer.setPixelRatio(this.pixelRatioBeforeXR);
      if (orphan) {
        try {
          await orphan.end();
        } catch {
          /* already dead */
        }
      }
      console.error('[kora] could not start an immersive session:', error);
    } finally {
      window.clearTimeout(watchdog);
      this.entering = false;
      // begin() enables the button as Exit VR on success; recover Enter VR on any failure path.
      if (this.button && !this.presenting) {
        this.button.disabled = false;
        this.button.textContent = 'Enter VR';
      }
    }
  }

  private async requestImmersiveSession(): Promise<XRSession> {
    // three composites through an XRGPUBinding projection layer, which it installs with
    // updateRenderState, so `layers` has to be asked for even though it looks incidental.
    const optional = ['local-floor', 'bounded-floor', 'layers'];
    if (this.preferHandTracking) optional.push('hand-tracking');

    try {
      return await this.requestSessionWithTimeout(
        {
          requiredFeatures: ['webgpu'],
          optionalFeatures: optional,
        },
        6_000,
      );
    } catch (error) {
      // Do not requestSession again in this click — the timed-out call is still pending in the
      // browser and a retry wedges on Starting… until reload.
      if (this.preferHandTracking) {
        this.preferHandTracking = false;
        this.log(
          'hand-tracking session stalled; click Enter VR again to join without hands',
          error,
        );
      }
      throw error;
    }
  }

  private requestSessionWithTimeout(init: XRSessionInit, ms: number): Promise<XRSession> {
    return new Promise((resolve, reject) => {
      let settled = false;
      const timer = window.setTimeout(() => {
        if (settled) return;
        settled = true;
        reject(new Error(`requestSession timed out after ${ms}ms`));
      }, ms);

      void navigator.xr!.requestSession('immersive-vr', init).then(
        (session) => {
          if (settled) {
            // Timed out already — drop the late grant so it cannot steal the page.
            void session.end();
            return;
          }
          settled = true;
          window.clearTimeout(timer);
          resolve(session);
        },
        (error: unknown) => {
          if (settled) return;
          settled = true;
          window.clearTimeout(timer);
          reject(error);
        },
      );
    });
  }

  private async begin(session: XRSession): Promise<void> {
    this.session = session;
    this.framesSeen = 0;
    this.targetReady = false;

    session.addEventListener('end', () => this.end());
    session.addEventListener('selectstart', this.onSelectStart);
    session.addEventListener('select', this.onSelect);
    session.addEventListener('selectend', this.onSelectEnd);

    this.usesFloorOrigin = await hasFloorOrigin(session);
    this.renderer.xr.setReferenceSpaceType(this.usesFloorOrigin ? 'local-floor' : 'local');
    this.log(`reference space ${this.usesFloorOrigin ? 'local-floor' : 'local (eye-relative)'}`);

    // onEnter picks the immersive quality tier, which is where the layer scale comes from, so the
    // shim has to go in after it and before three builds the layer inside setSession.
    this.panOffset.set(0, 0, 0);
    this.domainScaleGesture = null;
    this.pendingAnchor = true;
    this.velocity.yaw = 0;
    this.velocity.pitch = 0;
    this.pivot.rotation.set(0, 0, 0);
    this.callbacks.onEnter();
    this.layout();
    this.panel?.setVisible(this.modePanelEnabled);
    this.actionPanel?.setVisible(true);

    layerScale = this.layerScale;
    const scaled = this.layerScale !== 1 ? installLayerScale() : false;

    installPassRectSuppression();
    suppressPassRects = this.viewportPolicy === 'full';

    // What three's WebGL paths do inside setSession and its WebGPU path forgets. Nothing about a
    // projection layer is measured in CSS pixels, and three scales the eye viewport by this.
    this.pixelRatioBeforeXR = this.renderer.getPixelRatio();
    this.renderer.setPixelRatio(1);

    installFoveationNullGuard(
      this.renderer.xr as {
        foveateBoundTexture?: (renderTarget: unknown) => void;
        koraFoveationGuarded?: boolean;
      },
    );

    await Promise.race([
      this.renderer.xr.setSession(session),
      new Promise<never>((_, reject) => {
        window.setTimeout(() => reject(new Error('setSession timed out after 8000ms')), 8000);
      }),
    ]);

    // three defaults foveation to 1.0 and applies it on the projection layer *and* (WebGL) via
    // foveateBoundTexture on the tone-map target — Ada's "applied twice". visionOS already
    // foveates the compositor side; stacking max fixed foveation on top warps the periphery.
    // Must run after setSession, which re-applies the default.
    this.renderer.xr.setFoveation(0);

    this.presenting = true;
    this.sessionStart = performance.now();
    this.log(
      `renderer bound | layer scale ${layerScale} ${scaled ? '(shim installed)' : '(native)'} | ` +
        `viewport scale ${this.viewportScale} | policy ${this.viewportPolicy} | ` +
        `foveation ${this.renderer.xr.getFoveation()} | layer ${this.layerSize()} | ` +
        `hands ${session.enabledFeatures?.includes('hand-tracking') ? 'on' : 'off'}`,
    );

    if (this.button) {
      this.button.disabled = false;
      this.button.textContent = 'Exit VR';
    }
  }

  private end(): void {
    this.log('session ended', { framesSeen: this.framesSeen });
    this.session = null;
    this.presenting = false;
    this.targetReady = false;
    suppressPassRects = false;
    // Next session gets its own layer, so it has to be measured again.
    this.baseViewport = null;
    this.reportedCrop = false;
    this.renderer.setPixelRatio(this.pixelRatioBeforeXR);
    this.drags.clear();
    this.grab.end();
    this.bodyPointer?.endGrab();
    this.velocity.yaw = 0;
    this.velocity.pitch = 0;
    this.lastTapEnd = 0;

    this.panel?.setVisible(false);
    this.actionPanel?.setVisible(false);
    this.pendingAnchor = false;
    this.layout();
    this.callbacks.onExit();

    if (this.button) {
      this.button.disabled = false;
      this.button.textContent = 'Enter VR';
    }
  }

  /**
   * Reads a pointer's pose into `this.ray`, in reference space.
   *
   * On visionOS the transient pointer's target ray is built to pass through whatever the user was
   * looking at when they pinched, so aiming it is gaze selection without asking for eye tracking —
   * which the platform will not hand over anyway. On a headset with controllers the same ray is
   * simply where the controller points, and the behaviour here is identical.
   */
  private readRay(source: XRInputSource, frame: XRFrame, referenceSpace: XRReferenceSpace): boolean {
    const pose = frame.getPose(source.targetRaySpace, referenceSpace);
    if (!pose) return false;

    const { position, orientation } = pose.transform;
    this.ray.origin.set(position.x, position.y, position.z);
    this.ray.orientation.set(orientation.x, orientation.y, orientation.z, orientation.w);
    this.ray.direction.set(0, 0, -1).applyQuaternion(this.ray.orientation);
    return true;
  }

  /**
   * Wrist (or best stand-in) for a pinch source, in reference space.
   *
   * visionOS often exposes the pinch as a transient-pointer without `source.hand`, while the
   * tracked skeleton lives on a separate hand source — so this also searches session hands and
   * picks the wrist nearest the gaze ray.
   *
   * Returns false when no wrist can be read. It deliberately does not fall back to the ray origin:
   * a transient-pointer ray is anchored near the shoulder, so substituting it silently moves the
   * reported hand half a metre and callers differencing successive wrists see that as real travel.
   */
  private readWrist(
    source: XRInputSource,
    frame: XRFrame,
    referenceSpace: XRReferenceSpace,
    out: Vector3,
  ): boolean {
    if (this.readWristFromHand(source.hand, frame, referenceSpace, out)) return true;

    if (source.gripSpace) {
      const grip = frame.getPose(source.gripSpace, referenceSpace);
      if (grip) {
        const { x, y, z } = grip.transform.position;
        out.set(x, y, z);
        return true;
      }
    }

    if (!this.readRay(source, frame, referenceSpace)) return false;

    let best = Infinity;
    let found = false;
    for (const other of this.session?.inputSources ?? []) {
      if (!other.hand) continue;
      if (
        source.handedness !== 'none' &&
        other.handedness !== 'none' &&
        other.handedness !== source.handedness
      ) {
        continue;
      }
      if (!this.readWristFromHand(other.hand, frame, referenceSpace, wristScratch)) continue;

      const ox = wristScratch.x - this.ray.origin.x;
      const oy = wristScratch.y - this.ray.origin.y;
      const oz = wristScratch.z - this.ray.origin.z;
      const along =
        ox * this.ray.direction.x + oy * this.ray.direction.y + oz * this.ray.direction.z;
      const dx = ox - this.ray.direction.x * along;
      const dy = oy - this.ray.direction.y * along;
      const dz = oz - this.ray.direction.z * along;
      const lateral = dx * dx + dy * dy + dz * dz;
      if (lateral < best) {
        best = lateral;
        out.copy(wristScratch);
        found = true;
      }
    }
    return found;
  }

  private readWristFromHand(
    hand: XRHand | null | undefined,
    frame: XRFrame,
    referenceSpace: XRReferenceSpace,
    out: Vector3,
  ): boolean {
    const joint = hand?.get('wrist');
    if (!joint) return false;
    const pose =
      frame.getJointPose?.(joint, referenceSpace) ?? frame.getPose(joint, referenceSpace);
    if (!pose) return false;
    const { x, y, z } = pose.transform.position;
    out.set(x, y, z);
    return true;
  }

  private findDrag(kind: DragKind): Drag | undefined {
    for (const drag of this.drags.values()) {
      if (drag.kind === kind) return drag;
    }
    return undefined;
  }

  private clearScaleDrags(): void {
    for (const [source, drag] of this.drags) {
      if (drag.kind === 'scale') this.drags.delete(source);
    }
  }

  private syncTwoHandScale(frame: XRFrame, referenceSpace: XRReferenceSpace): boolean {
    const objectDrag = this.findDrag('object');
    const scaleDrag = this.findDrag('scale');
    if (!objectDrag || !scaleDrag) return false;

    if (
      !this.readWrist(objectDrag.source, frame, referenceSpace, wristA) ||
      !this.readWrist(scaleDrag.source, frame, referenceSpace, wristB)
    ) {
      return true;
    }

    const distance = wristA.distanceTo(wristB);
    if (!this.grab.twoHand) this.grab.beginTwoHandScale(distance);
    else this.grab.moveTwoHandScale(distance);
    return true;
  }

  /**
   * Two transient-pointer pinches (empty space): pull hands apart to grow the domain, pinch
   * together to shrink. Uses wrist distance so shoulder-anchored rays don't mute the gesture.
   */
  private syncTwoHandDomainScale(frame: XRFrame, referenceSpace: XRReferenceSpace): void {
    const hands: Drag[] = [];
    for (const drag of this.drags.values()) {
      if (drag.kind === 'turntable') hands.push(drag);
      if (hands.length >= 2) break;
    }
    if (hands.length < 2) {
      this.domainScaleGesture = null;
      return;
    }
    if (
      !this.readWrist(hands[0].source, frame, referenceSpace, wristA) ||
      !this.readWrist(hands[1].source, frame, referenceSpace, wristB)
    ) {
      return;
    }

    const dist = wristA.distanceTo(wristB);
    if (dist < 1e-4) return;

    if (!this.domainScaleGesture) {
      this.domainScaleGesture = { startDist: dist, startFramed: this.framedSize };
      return;
    }

    const ratio = dist / this.domainScaleGesture.startDist;
    const next = Math.max(
      this.framedSizeMin,
      Math.min(this.framedSizeMax, this.domainScaleGesture.startFramed * ratio),
    );
    if (Math.abs(next - this.framedSize) < 1e-4) return;
    this.framedSize = next;
    this.layout();
  }

  /**
   * How the session is getting on, at a few frame counts.
   *
   * The mean frame time is the useful number here: a headset that shows nothing because the frame
   * is too expensive to finish and one that shows nothing because it is drawing an empty scene
   * look identical from the outside, and this is what tells them apart.
   */
  private reportFrame(frame: XRFrame, referenceSpace: XRReferenceSpace | null): void {
    const elapsed = performance.now() - this.sessionStart;
    const pose = referenceSpace ? frame.getViewerPose(referenceSpace) : null;
    const xrCamera = this.renderer.xr.getCamera() as unknown as {
      cameras?: { viewport?: { width: number; height: number } }[];
    };
    const eye = xrCamera.cameras?.[0]?.viewport;

    // The runtime's projection is an asymmetric frustum, and the aspect it implies is the aspect
    // it expects to be rendered into. If it disagrees with the viewport we ended up with, the
    // image is stretched — which is a different complaint from the session dying.
    const p = pose?.views[0]?.projectionMatrix;
    const projAspect = p && p[0] !== 0 ? (p[5] / p[0]).toFixed(3) : '?';
    const eyeAspect = eye && eye.height !== 0 ? (eye.width / eye.height).toFixed(3) : '?';

    // Each eye's frustum as the four half-angles it actually subtends. An aspect ratio cannot tell
    // a plausible eye from an implausible one, and this is the difference between "drawn into the
    // wrong rectangle" — a linear squash — and "drawn with the wrong lens", which is what a
    // stretched periphery over a receding centre means. A Vision Pro eye is a little over 50
    // degrees each way; anything near 90 is a union of both eyes or a frustum built by mistake.
    const frusta = (pose?.views ?? [])
      .map((view, i) => {
        const m = view.projectionMatrix;
        if (!m || m[0] === 0 || m[5] === 0) return `view ${i} ?`;
        const deg = (tan: number) => (Math.atan(tan) * 180) / Math.PI;
        const left = deg((m[8] - 1) / m[0]);
        const right = deg((m[8] + 1) / m[0]);
        const down = deg((m[9] - 1) / m[5]);
        const up = deg((m[9] + 1) / m[5]);
        return (
          `view ${i} fov L${left.toFixed(1)} R${right.toFixed(1)} ` +
          `D${down.toFixed(1)} U${up.toFixed(1)}`
        );
      })
      .join(' | ');

    const eyes = (
      this.renderer.xr.getCamera() as unknown as {
        cameras?: { viewport?: { x: number; y: number; width: number; height: number } }[];
      }
    ).cameras
      ?.map((sub, i) => {
        const v = sub.viewport;
        return v ? `${i}:${Math.round(v.x)},${Math.round(v.y)} ${Math.round(v.width)}x${Math.round(v.height)}` : `${i}:none`;
      })
      .join(' ');

    // One flat string rather than an object: Safari collapses objects in the console and hides
    // whichever field turns out to matter.
    // A WebXR session whose render state ends up with no baseLayer and an empty layer list stops
    // running its frame loop, while staying perfectly alive. `updateRenderState` applies a frame
    // or two after the call, which would give exactly the handful of frames we get.
    const state = this.session?.renderState as
      | { baseLayer?: object | null; layers?: readonly object[] }
      | undefined;
    const layers = state?.layers === undefined ? 'unsupported' : String(state.layers.length);

    // PR #34153 inlines tone mapping so this is false during the XR animation callback.
    const needsBlit = !!(this.renderer as unknown as { needsFrameBufferTarget?: boolean })
      .needsFrameBufferTarget;

    this.log(
      `frame ${this.framesSeen} | ${Math.round(elapsed / this.framesSeen)} ms/frame | ` +
        `layers ${layers} | baseLayer ${state?.baseLayer ? 'yes' : 'no'} | ` +
        `pose ${pose ? 'yes' : 'no'} | views ${pose?.views.length ?? 0} | ` +
        `eye ${eye ? `${Math.round(eye.width)}x${Math.round(eye.height)}` : 'none'} ` +
        `(aspect ${eyeAspect} vs projection ${projAspect}) | ` +
        `viewports ${eyes ?? 'none'} | raw ${this.rawViewport} | ` +
        `policy ${this.viewportPolicy} x${this.viewportScale.toFixed(3)} | ` +
        `output ${needsBlit ? 'blit' : 'single-pass'} | ` +
        `pixelRatio ${this.renderer.getPixelRatio()} | ` +
        `layer ${this.layerSize()} | target ${this.targetSize()}`,
    );

    this.log(frusta || 'no views');
  }

  /** The nearest of `targets` along the current ray, or null. */
  private pick(targets: Object3D[]): Object3D | null {
    if (targets.length === 0) return null;

    this.raycaster.set(this.ray.origin, this.ray.direction);
    return this.raycaster.intersectObjects(targets, false)[0]?.object ?? null;
  }

  /**
   * Decides what this pinch is for, once, from where it was aimed when it started.
   *
   * Aim at a mode button and it switches modes without starting a drag; aim at a primitive and the
   * drag carries that primitive; aim anywhere else and it turns the whole domain. Committing to
   * one of the three up front matters: re-deciding mid-drag on a hand ray that wanders across an
   * edge would have the domain lurch every time the pointer clipped an obstacle.
   */
  private cycleGizmoMode(): void {
    if (!this.manipulator) return;
    const i = GIZMO_MODE_ORDER.indexOf(this.manipulator.mode);
    const next = GIZMO_MODE_ORDER[(i + 1) % GIZMO_MODE_ORDER.length]!;
    this.manipulator.setMode(next);
    this.panel?.setMode(next);
  }

  /**
   * Arms or fires a double-tap. Returns true when this tap completed a double-pinch and the
   * mode was cycled — caller should drop any drag this gesture started.
   */
  private notePinchTap(source: XRInputSource, kind: DragKind | undefined): boolean {
    if (this.pinchTapNoted.get(source)) return false;
    this.pinchTapNoted.set(source, true);

    if (!this.manipulator || kind === 'scale' || kind === 'body') return false;

    const now = performance.now();
    const began = this.pinchBeganAt.get(source);
    const duration = began === undefined ? 0 : now - began;
    if (duration > TAP_MAX_MS) {
      this.lastTapEnd = 0;
      return false;
    }

    if (this.lastTapEnd > 0 && now - this.lastTapEnd <= DOUBLE_PINCH_MS) {
      this.cycleGizmoMode();
      this.lastTapEnd = 0;
      return true;
    }

    this.lastTapEnd = now;
    return false;
  }

  private cancelGestureDrag(source: XRInputSource, kind: DragKind | undefined): void {
    this.drags.delete(source);
    if (kind === 'object') {
      this.grab.end();
      this.clearScaleDrags();
    }
    if (kind === 'body') this.bodyPointer?.endGrab();
  }

  private onSelectStart(event: XRInputSourceEvent): void {
    // Catching a coasting domain should stop it, the way putting a hand on a globe does.
    this.velocity.yaw = 0;
    this.velocity.pitch = 0;

    this.pinchBeganAt.set(event.inputSource, performance.now());
    this.pinchTapNoted.set(event.inputSource, false);

    const referenceSpace = this.renderer.xr.getReferenceSpace();

    // Second pinch while holding a collider: scale from inter-hand distance, not turntable pan.
    if (this.grab.active && this.findDrag('object')) {
      this.drags.set(event.inputSource, {
        source: event.inputSource,
        kind: 'scale',
        started: false,
        yaw: 0,
        pitch: 0,
        x: 0,
        y: 0,
        z: 0,
      });
      if (referenceSpace) this.syncTwoHandScale(event.frame, referenceSpace);
      return;
    }

    let kind: DragKind = 'turntable';

    if (referenceSpace && this.readRay(event.inputSource, event.frame, referenceSpace)) {
      // The pick runs against last frame's matrices otherwise, and the domain may have been
      // turning right up to the moment of the pinch.
      this.rig.updateMatrixWorld(true);
      this.hud.updateMatrixWorld(true);

      const button = this.panel?.visible ? this.pick(this.panel.targets) : null;
      if (button) {
        const mode = this.panel?.resolve(button);
        if (mode && this.manipulator) {
          this.manipulator.setMode(mode);
          this.panel?.setMode(mode);
        }
        return;
      }

      const actionHit =
        this.actionPanel?.visible ? this.pick(this.actionPanel.targets) : null;
      if (actionHit && this.actionPanel?.handlePick(actionHit)) {
        return;
      }

      if (this.bodyPointer?.tryGrab(this.ray)) {
        this.drags.set(event.inputSource, {
          source: event.inputSource,
          kind: 'body',
          started: false,
          yaw: 0,
          pitch: 0,
          x: 0,
          y: 0,
          z: 0,
        });
        return;
      }

      const target = this.manipulator ? this.pick(this.manipulator.targets()) : null;
      if (target && this.manipulator) {
        this.manipulator.selectObject(target);
        const wrist = this.readWrist(event.inputSource, event.frame, referenceSpace, wristA)
          ? wristA
          : null;
        this.grab.begin(target, this.ray, this.manipulator.mode, wrist);
        kind = 'object';
      } else {
        this.manipulator?.selectObject(null);
      }
    }

    // transient-pointer is what a visionOS pinch produces, and it only exists for the duration
    // of the pinch. Controllers and gaze are accepted too; they behave the same way here.
    this.drags.set(event.inputSource, {
      source: event.inputSource,
      kind,
      started: false,
      yaw: 0,
      pitch: 0,
      x: 0,
      y: 0,
      z: 0,
    });

    // Second pinch: drop into pan+scale and re-origin both hands so the turntable doesn't keep spinning.
    if (kind === 'turntable' && this.turntableCount() >= 2) {
      this.velocity.yaw = 0;
      this.velocity.pitch = 0;
      this.domainScaleGesture = null;
      for (const drag of this.drags.values()) {
        if (drag.kind === 'turntable') drag.started = false;
      }
    }
  }

  /**
   * WebXR fires `select` between start and end for a completed primary action. Prefer it for
   * double-tap; `selectend` repeats the same note if `select` was skipped (seen on some
   * transient-pointer paths).
   */
  private onSelect(event: XRInputSourceEvent): void {
    const drag = this.drags.get(event.inputSource);
    if (this.notePinchTap(event.inputSource, drag?.kind)) {
      this.cancelGestureDrag(event.inputSource, drag?.kind);
    }
  }

  private onSelectEnd(event: XRInputSourceEvent): void {
    const drag = this.drags.get(event.inputSource);
    const kind = drag?.kind;

    if (this.notePinchTap(event.inputSource, kind)) {
      this.cancelGestureDrag(event.inputSource, kind);
      return;
    }

    this.drags.delete(event.inputSource);

    if (kind === 'scale') {
      const remaining = this.findDrag('object');
      const referenceSpace = this.renderer.xr.getReferenceSpace();
      if (
        remaining &&
        referenceSpace &&
        this.readWrist(remaining.source, event.frame, referenceSpace, wristA)
      ) {
        this.grab.resumeWrist(wristA);
      }
      return;
    }

    if (kind === 'object') {
      this.grab.end();
      this.clearScaleDrags();
    }

    if (kind === 'body') this.bodyPointer?.endGrab();

    // Leaving a two-handed pan/scale: re-origin the remaining pinch so turntable doesn't hitch.
    this.domainScaleGesture = null;
    for (const remaining of this.drags.values()) {
      if (remaining.kind === 'turntable') remaining.started = false;
    }
  }

  /** Applies a turn, keeping the tip within limits so the box can never end up inverted. */
  private turn(yaw: number, pitch: number): void {
    this.pivot.rotation.y += yaw;
    this.pivot.rotation.x = Math.max(
      -PITCH_LIMIT,
      Math.min(PITCH_LIMIT, this.pivot.rotation.x + pitch),
    );
  }

  /**
   * Turns pointer movement into rotation. Called once per XR frame, before the render.
   *
   * Dragging right brings the domain's left side around to face you and dragging up reveals its
   * top, which is the way round people expect when they are moving the object rather than
   * themselves.
   */
  update(frame: XRFrame | null, dt: number): void {
    if (!this.session) return;

    const referenceSpace = this.renderer.xr.getReferenceSpace();

    if (frame) {
      this.framesSeen++;
      this.targetReady = this.sizeXRTarget();
      this.fitViewports();
      this.cropFrusta();
      if (referenceSpace) this.requestViewportScale(frame, referenceSpace);

      if (this.pendingAnchor && referenceSpace) {
        const pose = frame.getViewerPose(referenceSpace);
        // An emulated pose is the runtime's guess at where the head is, and the head height is
        // exactly what the eye-relative placement is measured from — anchoring to a guess is how
        // the stage ends up at a different height every time.
        const settled = pose && (!pose.emulatedPosition || this.framesSeen > ANCHOR_SETTLE_FRAMES);
        if (pose && settled) {
          this.anchorFromViewer(pose);
          this.pendingAnchor = false;
        }
      }

      if (this.debugViews && referenceSpace && this.framesSeen === 2) {
        this.dumpSubImages(frame, referenceSpace);
      }
      if (FRAME_REPORTS.has(this.framesSeen) || this.reportNext) {
        this.reportNext = false;
        this.reportFrame(frame, referenceSpace);
      }
    }

    if (frame && referenceSpace) {
      if (this.syncTwoHandScale(frame, referenceSpace)) {
        // Holding a collider with two pinches: scale only — leave the turntable alone.
      } else {
        const panning = this.turntableCount() >= 2;
        let panDx = 0;
        let panDy = 0;
        let panDz = 0;
        let panSamples = 0;

        for (const drag of this.drags.values()) {
          if (drag.kind === 'scale') continue;

          // A pinch that picked something up moves that and nothing else — the domain stays put
          // under it, so you can place a primitive against a part of the fire you can still see.
          if (drag.kind === 'object') {
            if (this.manipulator?.mode === 'translate') {
              if (this.readWrist(drag.source, frame, referenceSpace, wristA)) {
                if (!drag.started) {
                  this.grab.resumeWrist(wristA);
                  drag.started = true;
                } else {
                  this.grab.moveWrist(wristA);
                }
              }
            } else if (this.readRay(drag.source, frame, referenceSpace)) {
              this.grab.move(this.ray);
              drag.started = true;
            }
            continue;
          }

          // Held body: the ray fixes the direction, the wrist supplies the travel. visionOS
          // transient pointers are shoulder-anchored, so the ray origin barely moves when you
          // pull your hand toward you — the wrist is what actually tracks the gesture.
          if (drag.kind === 'body') {
            if (this.readRay(drag.source, frame, referenceSpace)) {
              const wrist = this.readWrist(drag.source, frame, referenceSpace, wristA)
                ? wristA
                : null;
              this.bodyPointer?.moveGrab(this.ray, wrist);
              drag.started = true;
            }
            continue;
          }

          const pose = frame.getPose(drag.source.targetRaySpace, referenceSpace);
          if (!pose) continue;

          const { yaw, pitch } = aim(pose.transform.orientation, this.direction);
          const rayPos = pose.transform.position;

          // Pan from wrists: pulling both hands toward you must move the container toward you.
          // Fall back to the target-ray origin when a source has no hand joints (controllers).
          let x = rayPos.x;
          let y = rayPos.y;
          let z = rayPos.z;
          if (panning) {
            if (this.readWrist(drag.source, frame, referenceSpace, wristA)) {
              x = wristA.x;
              y = wristA.y;
              z = wristA.z;
            }
          }

          if (drag.started) {
            if (panning) {
              panDx += x - drag.x;
              panDy += y - drag.y;
              panDz += z - drag.z;
              panSamples++;
            } else if (this.turntableEnabled) {
              const dYaw =
                -angleDelta(drag.yaw, yaw) * AIM_GAIN + (rayPos.x - drag.x) * REACH_GAIN;
              const dPitch =
                angleDelta(drag.pitch, pitch) * AIM_GAIN + (rayPos.y - drag.y) * REACH_GAIN;

              this.turn(dYaw, dPitch);

              if (dt > 0) {
                this.velocity.yaw = smoothSpin(this.velocity.yaw, dYaw / dt);
                this.velocity.pitch = smoothSpin(this.velocity.pitch, dPitch / dt);
              }
              // Single-hand turntable still tracks the ray origin in drag.x/y/z.
              x = rayPos.x;
              y = rayPos.y;
              z = rayPos.z;
            }
          }

          drag.started = true;
          drag.yaw = yaw;
          drag.pitch = pitch;
          drag.x = x;
          drag.y = y;
          drag.z = z;
        }

        if (panning && panSamples > 0) {
          const inv = PAN_GAIN / panSamples;
          this.applyPan(panDx * inv, panDy * inv, panDz * inv);
          this.velocity.yaw = 0;
          this.velocity.pitch = 0;
          this.syncTwoHandDomainScale(frame, referenceSpace);
        } else if (!panning) {
          this.domainScaleGesture = null;
        }
      }
    }

    if (this.drags.size > 0 || !this.turntableEnabled) return;

    // Let go and it keeps turning for a moment, then settles.
    const decay = Math.pow(SPIN_RETENTION, dt);
    this.velocity.yaw *= decay;
    this.velocity.pitch *= decay;

    if (Math.abs(this.velocity.yaw) < SPIN_EPSILON && Math.abs(this.velocity.pitch) < SPIN_EPSILON) {
      this.velocity.yaw = 0;
      this.velocity.pitch = 0;
      return;
    }

    this.turn(this.velocity.yaw * dt, this.velocity.pitch * dt);
  }
}
