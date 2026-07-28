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
import { Group, Object3D, Quaternion, Vector3, type Renderer } from 'three/webgpu';

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

export interface ImmersiveCallbacks {
  onEnter(): void;
  onExit(): void;
}

interface Drag {
  source: XRInputSource;
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

  private readonly drags = new Map<XRInputSource, Drag>();
  private readonly velocity = { yaw: 0, pitch: 0 };
  private readonly direction = new Vector3();
  private domainSize = 1;
  private button: HTMLButtonElement | null = null;
  private session: XRSession | null = null;

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

  get active(): boolean {
    return this.session !== null;
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
    } catch {
      return;
    }
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

    try {
      const session = await navigator.xr.requestSession('immersive-vr', {
        requiredFeatures: ['webgpu'],
        // three composites through an XRGPUBinding projection layer, which it installs with
        // updateRenderState, so `layers` has to be asked for even though it looks incidental.
        optionalFeatures: ['local-floor', 'bounded-floor', 'layers', 'hand-tracking'],
      });
      await this.begin(session);
    } catch (error) {
      this.button.disabled = false;
      this.button.textContent = 'Enter VR';
      console.error('[kora] could not start an immersive session:', error);
    }
  }

  private async begin(session: XRSession): Promise<void> {
    this.session = session;

    session.addEventListener('end', () => this.end());
    session.addEventListener('selectstart', this.onSelectStart);
    session.addEventListener('selectend', this.onSelectEnd);

    this.renderer.xr.setReferenceSpaceType(
      session.enabledFeatures?.includes('local-floor') ? 'local-floor' : 'local',
    );

    this.callbacks.onEnter();
    this.layout();

    await this.renderer.xr.setSession(session);

    if (this.button) {
      this.button.disabled = false;
      this.button.textContent = 'Exit VR';
    }
  }

  private end(): void {
    this.session = null;
    this.drags.clear();
    this.velocity.yaw = 0;
    this.velocity.pitch = 0;

    this.layout();
    this.callbacks.onExit();

    if (this.button) {
      this.button.disabled = false;
      this.button.textContent = 'Enter VR';
    }
  }

  private onSelectStart(event: XRInputSourceEvent): void {
    // Catching a coasting domain should stop it, the way putting a hand on a globe does.
    this.velocity.yaw = 0;
    this.velocity.pitch = 0;

    // transient-pointer is what a visionOS pinch produces, and it only exists for the duration
    // of the pinch. Controllers and gaze are accepted too; they behave the same way here.
    this.drags.set(event.inputSource, {
      source: event.inputSource,
      started: false,
      yaw: 0,
      pitch: 0,
      x: 0,
      y: 0,
    });
  }

  private onSelectEnd(event: XRInputSourceEvent): void {
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

    if (frame && referenceSpace) {
      for (const drag of this.drags.values()) {
        const pose = frame.getPose(drag.source.targetRaySpace, referenceSpace);
        if (!pose) continue;

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
