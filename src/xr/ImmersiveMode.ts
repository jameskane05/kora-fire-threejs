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
 * Navigation is deliberately object-centric rather than viewer-centric: the rig stays put and
 * the simulation turns in front of you. Moving the viewer instead would be both more work and,
 * on a device with no thumbsticks, a good way to make someone ill.
 */
import { Group, Object3D, Quaternion, Raycaster, Vector3, type Renderer } from 'three/webgpu';
import { RayGrab, type PointerRay } from './RayGrab';
import { ModePanel } from './ModePanel';
import type { GizmoMode } from '../scene/Obstacles';

/** Where the domain is placed relative to the viewer, in metres. */
const PLACEMENT = { distance: 1.75, height: 1.25 };

/** The domain's largest dimension is scaled to this, so every preset frames the same way. */
const FRAMED_SIZE = 0.9;

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

/** Frame counts that report in, so a loop that stalls shows up as a line that never arrives. */
const FRAME_REPORTS = new Set([1, 2, 3, 5, 10, 30, 120]);

/**
 * Shrinks the XR projection layer, which three's WebGPU path otherwise leaves at full size.
 *
 * On the WebGL path three passes its framebuffer scale factor into `createProjectionLayer`; the
 * WebGPU path passes only the formats, so the layer comes back at whatever the compositor
 * recommends. On a Vision Pro that is 4851x3887 per eye — around 38 megapixels of raymarching a
 * frame, backed by an eye buffer and a half-gigabyte float intermediate for tone mapping. The
 * session stays open and keeps handing out poses, but nothing is ever finished and presented, so
 * the passthrough environment simply never goes away.
 *
 * A layer cannot be resized once built and three exposes no hook, so the scale is folded into the
 * call on its way through. `setFramebufferScaleFactor` is the equivalent knob on the WebGL path.
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
 * A render pass defaults to the full attachment, which is what the compositor wants, and since
 * each eye is its own array layer there is no sub-rectangle to select in the first place. three
 * additionally scales the viewport by the renderer's pixel ratio, which on the WebGPU path is
 * never reset to 1 the way it is for WebGL — so at any tier above `performance` the viewport
 * came out larger than the attachment as well.
 */
let suppressPassRects = false;

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
 * A pinch either turns the whole domain or moves one thing inside it, decided once at the moment
 * the pinch begins and fixed for its duration.
 */
type DragKind = 'turntable' | 'object';

interface Drag {
  source: XRInputSource;
  kind: DragKind;
  /** false until the first pose arrives; a pinch's opening frame only establishes an origin */
  started: boolean;
  yaw: number;
  pitch: number;
  x: number;
  y: number;
}

const scratchQuaternion = new Quaternion();

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
   * Off by default: it calls into the binding on the same frame as the first render, which is a
   * poor thing to have in the picture when that frame is the one under suspicion.
   */
  debugViews = false;

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
  private manipulator: Manipulator | null = null;
  private domainSize = 1;
  private button: HTMLButtonElement | null = null;
  private session: XRSession | null = null;
  private presenting = false;
  private framesSeen = 0;
  private sessionStart = 0;
  private layerScale = 0.5;
  private targetReady = false;
  private pixelRatioBeforeXR = 1;

  constructor(
    private readonly renderer: Renderer,
    private readonly callbacks: ImmersiveCallbacks,
  ) {
    this.rig.add(this.pivot);
    this.pivot.add(this.content);
    this.rig.visible = true;

    this.onSelectStart = this.onSelectStart.bind(this);
    this.onSelectEnd = this.onSelectEnd.bind(this);
  }

  /** Supplies what a pinch may pick up. The mode panel appears once one is set. */
  setManipulator(manipulator: Manipulator): void {
    this.manipulator = manipulator;

    if (!this.panel) {
      this.panel = new ModePanel(manipulator.mode);
      this.hud.add(this.panel.group);
    }
    this.panel.setMode(manipulator.mode);
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
   * Fraction of the compositor's recommended eye resolution to render at. Takes effect on the
   * next session, since a projection layer is fixed in size once it exists.
   */
  setLayerScale(scale: number): void {
    this.layerScale = Math.max(0.1, Math.min(1, scale));
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
   * Keeps each eye's viewport inside the texture it is drawn into.
   *
   * visionOS reports a sub-image viewport of the recommended resolution while handing back a much
   * smaller texture, and three copies that viewport onto the sub-cameras verbatim. Setting a
   * viewport larger than its attachment is a validation error, so the frame is thrown away.
   */
  private clampViewports(): void {
    const target = (
      this.renderer.xr as unknown as { _xrRenderTarget?: { width: number; height: number } }
    )._xrRenderTarget;
    if (!target || target.width === 0) return;

    const xrCamera = this.renderer.xr.getCamera() as unknown as {
      cameras?: { viewport?: { x: number; y: number; width: number; height: number } }[];
    };

    for (const sub of xrCamera.cameras ?? []) {
      const v = sub.viewport;
      if (!v) continue;
      v.x = Math.max(0, Math.min(v.x, target.width));
      v.y = Math.max(0, Math.min(v.y, target.height));
      v.width = Math.min(v.width, target.width - v.x);
      v.height = Math.min(v.height, target.height - v.y);
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
    const pose = frame.getViewerPose(referenceSpace);
    if (!pose) return;

    for (const view of pose.views) {
      const scalable = view as unknown as { requestViewportScale?: (scale: number) => void };
      scalable.requestViewportScale?.(this.layerScale);
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

  private layout(): void {
    if (this.session) {
      const scale = FRAMED_SIZE / Math.max(this.domainSize, 1e-3);
      this.rig.scale.setScalar(scale);
      this.rig.position.set(0, PLACEMENT.height, -PLACEMENT.distance);
    } else {
      // Outside a session the desktop camera frames the domain itself, so the rig is a no-op
      // and only has to undo the pivot offset.
      this.rig.scale.setScalar(1);
      this.rig.position.set(0, this.domainSize / 2, 0);
      this.pivot.rotation.set(0, 0, 0);
    }
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

  private async toggle(): Promise<void> {
    if (this.session) {
      await this.session.end();
      return;
    }

    if (!navigator.xr || !this.button) return;
    this.button.disabled = true;
    this.log('requesting a session');

    try {
      const session = await navigator.xr.requestSession('immersive-vr', {
        requiredFeatures: ['webgpu'],
        // three composites through an XRGPUBinding projection layer, which it installs with
        // updateRenderState, so `layers` has to be asked for even though it looks incidental.
        optionalFeatures: ['local-floor', 'bounded-floor', 'layers', 'hand-tracking'],
      });
      this.log('session granted', [...(session.enabledFeatures ?? [])]);
      await this.begin(session);
    } catch (error) {
      // Leaving `session` set here would strand the frame loop on its XR branch with no session
      // behind it, so the page carries on running but stops drawing what it used to.
      this.session = null;
      this.presenting = false;
      this.targetReady = false;
      suppressPassRects = false;
      this.renderer.setPixelRatio(this.pixelRatioBeforeXR);
      this.button.disabled = false;
      this.button.textContent = 'Enter VR';
      console.error('[kora] could not start an immersive session:', error);
    }
  }

  private async begin(session: XRSession): Promise<void> {
    this.session = session;
    this.framesSeen = 0;
    this.targetReady = false;

    session.addEventListener('end', () => this.end());
    session.addEventListener('selectstart', this.onSelectStart);
    session.addEventListener('selectend', this.onSelectEnd);

    this.renderer.xr.setReferenceSpaceType(
      session.enabledFeatures?.includes('local-floor') ? 'local-floor' : 'local',
    );

    // onEnter picks the immersive quality tier, which is where the layer scale comes from, so the
    // shim has to go in after it and before three builds the layer inside setSession.
    this.callbacks.onEnter();
    this.layout();
    this.panel?.setVisible(true);

    layerScale = this.layerScale;
    const scaled = installLayerScale();

    installPassRectSuppression();
    suppressPassRects = true;

    // What three's WebGL paths do inside setSession and its WebGPU path forgets. Nothing about a
    // projection layer is measured in CSS pixels, and three scales the eye viewport by this.
    this.pixelRatioBeforeXR = this.renderer.getPixelRatio();
    this.renderer.setPixelRatio(1);

    await this.renderer.xr.setSession(session);
    this.presenting = true;
    this.sessionStart = performance.now();
    this.log(
      `renderer bound | requested scale ${layerScale} | shim ${scaled ? 'installed' : 'FAILED'} | ` +
        `layer ${this.layerSize()}`,
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
    this.renderer.setPixelRatio(this.pixelRatioBeforeXR);
    this.drags.clear();
    this.grab.end();
    this.velocity.yaw = 0;
    this.velocity.pitch = 0;

    this.panel?.setVisible(false);
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

    // One flat string rather than an object: Safari collapses objects in the console and hides
    // whichever field turns out to matter.
    // A WebXR session whose render state ends up with no baseLayer and an empty layer list stops
    // running its frame loop, while staying perfectly alive. `updateRenderState` applies a frame
    // or two after the call, which would give exactly the handful of frames we get.
    const state = this.session?.renderState as
      | { baseLayer?: object | null; layers?: readonly object[] }
      | undefined;
    const layers = state?.layers === undefined ? 'unsupported' : String(state.layers.length);

    this.log(
      `frame ${this.framesSeen} | ${Math.round(elapsed / this.framesSeen)} ms/frame | ` +
        `layers ${layers} | baseLayer ${state?.baseLayer ? 'yes' : 'no'} | ` +
        `pose ${pose ? 'yes' : 'no'} | views ${pose?.views.length ?? 0} | ` +
        `eye ${eye ? `${Math.round(eye.width)}x${Math.round(eye.height)}` : 'none'} ` +
        `(aspect ${eyeAspect} vs projection ${projAspect}) | ` +
        `layer ${this.layerSize()} | target ${this.targetSize()}`,
    );
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
  private onSelectStart(event: XRInputSourceEvent): void {
    // Catching a coasting domain should stop it, the way putting a hand on a globe does.
    this.velocity.yaw = 0;
    this.velocity.pitch = 0;

    const referenceSpace = this.renderer.xr.getReferenceSpace();
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

      const target = this.manipulator ? this.pick(this.manipulator.targets()) : null;
      if (target && this.manipulator) {
        this.manipulator.selectObject(target);
        this.grab.begin(target, this.ray, this.manipulator.mode);
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
    });
  }

  private onSelectEnd(event: XRInputSourceEvent): void {
    const drag = this.drags.get(event.inputSource);
    if (drag?.kind === 'object') this.grab.end();
    this.drags.delete(event.inputSource);
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
      this.clampViewports();
      if (referenceSpace) this.requestViewportScale(frame, referenceSpace);
      if (this.debugViews && referenceSpace && this.framesSeen === 2) {
        this.dumpSubImages(frame, referenceSpace);
      }
      if (FRAME_REPORTS.has(this.framesSeen)) this.reportFrame(frame, referenceSpace);
    }

    if (frame && referenceSpace) {
      for (const drag of this.drags.values()) {
        const pose = frame.getPose(drag.source.targetRaySpace, referenceSpace);
        if (!pose) continue;

        // A pinch that picked something up moves that and nothing else — the domain stays put
        // under it, so you can place a primitive against a part of the fire you can still see.
        if (drag.kind === 'object') {
          if (this.readRay(drag.source, frame, referenceSpace)) this.grab.move(this.ray);
          continue;
        }

        const { yaw, pitch } = aim(pose.transform.orientation, this.direction);
        const { x, y } = pose.transform.position;

        if (drag.started) {
          const dYaw = -angleDelta(drag.yaw, yaw) * AIM_GAIN + (x - drag.x) * REACH_GAIN;
          const dPitch = angleDelta(drag.pitch, pitch) * AIM_GAIN + (y - drag.y) * REACH_GAIN;

          this.turn(dYaw, dPitch);

          if (dt > 0) {
            this.velocity.yaw = smoothSpin(this.velocity.yaw, dYaw / dt);
            this.velocity.pitch = smoothSpin(this.velocity.pitch, dPitch / dt);
          }
        }

        drag.started = true;
        drag.yaw = yaw;
        drag.pitch = pitch;
        drag.x = x;
        drag.y = y;
      }
    }

    if (this.drags.size > 0) return;

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
