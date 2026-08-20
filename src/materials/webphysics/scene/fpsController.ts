import * as THREE from 'three';

export interface FPSControllerConfig {
  moveSpeed?: number;
  sprintMultiplier?: number;
  jumpVelocity?: number;
  gravity?: number;
  eyeHeight?: number;
  groundY?: number;
  mouseSensitivity?: number;
  physicsBodyMode?: boolean;
  /** No gravity; WASD stays level, Q/E move along the look vector. */
  freeFly?: boolean;
  /**
   * Free-fly LMB: if this returns true, the click was consumed (e.g. body grab)
   * and look-drag will not start. May be async (GPU pose readback).
   */
  tryPrimaryGrab?: (event: PointerEvent) => boolean | Promise<boolean>;
  /** Called while a primary grab is active (pointer move / hold). */
  onPrimaryGrabMove?: (event: PointerEvent) => void;
  /** Called when primary button releases after a grab attempt or look drag. */
  onPrimaryGrabEnd?: (event: PointerEvent) => void;
}

export interface FPSControllerState {
  position: [number, number, number];
  quaternion: [number, number, number, number];
  verticalVelocity: number;
  isGrounded: boolean;
  jumpRequested: boolean;
  noclipEnabled: boolean;
}

export class FPSController {
  private readonly cameraEuler = new THREE.Euler(0, 0, 0, 'YXZ');
  private readonly up = new THREE.Vector3(0, 1, 0);
  private readonly moveForward = new THREE.Vector3();
  private readonly moveRight = new THREE.Vector3();
  private readonly moveDelta = new THREE.Vector3();
  private readonly desiredVelocity = new THREE.Vector3();
  private readonly lookDir = new THREE.Vector3();
  private readonly shootOrigin = new THREE.Vector3();
  private readonly keys = new Set<string>();
  private readonly crosshair: HTMLDivElement;
  private readonly sceneStatusHint: HTMLDivElement;
  private readonly controlsHint: HTMLDivElement;
  private readonly modeBadge: HTMLDivElement;
  private sceneStatusText: string | null = null;
  private yaw = 0;
  private pitch = 0;
  private verticalVelocity = 0;
  private isGrounded = false;
  private isPointerLocked = false;
  /** Screen-space LMB drag look (no pointer lock). */
  private lookDragging = false;
  private bodyDragging = false;
  private primaryPending = false;
  private lookPointerId: number | null = null;
  private jumpRequested = false;
  private noclipEnabled = false;
  private readonly moveSpeed: number;
  private readonly sprintMultiplier: number;
  private readonly jumpVelocity: number;
  private readonly gravity: number;
  private readonly eyeHeight: number;
  private readonly groundY: number;
  private readonly mouseSensitivity: number;
  private readonly physicsBodyMode: boolean;
  private readonly freeFly: boolean;
  private readonly tryPrimaryGrab?: (event: PointerEvent) => boolean | Promise<boolean>;
  private readonly onPrimaryGrabMove?: (event: PointerEvent) => void;
  private readonly onPrimaryGrabEnd?: (event: PointerEvent) => void;

  constructor(
    private readonly camera: THREE.PerspectiveCamera,
    private readonly domElement: HTMLElement,
    config: FPSControllerConfig = {},
  ) {
    this.moveSpeed = config.moveSpeed ?? 7.0;
    this.sprintMultiplier = config.sprintMultiplier ?? 1.8;
    this.jumpVelocity = config.jumpVelocity ?? 5.4;
    this.gravity = config.gravity ?? 16.0;
    this.eyeHeight = config.eyeHeight ?? 1.7;
    this.groundY = config.groundY ?? 0.0;
    this.mouseSensitivity = config.mouseSensitivity ?? 0.0018;
    this.physicsBodyMode = config.physicsBodyMode ?? false;
    this.freeFly = config.freeFly ?? false;
    this.tryPrimaryGrab = config.tryPrimaryGrab;
    this.onPrimaryGrabMove = config.onPrimaryGrabMove;
    this.onPrimaryGrabEnd = config.onPrimaryGrabEnd;
    if (this.freeFly) this.noclipEnabled = true;

    this.crosshair = document.createElement('div');
    Object.assign(this.crosshair.style, {
      position: 'fixed',
      left: '50%',
      top: '50%',
      width: '12px',
      height: '12px',
      marginLeft: '-6px',
      marginTop: '-6px',
      pointerEvents: 'none',
      zIndex: '30',
      display: 'none',
    });
    this.crosshair.innerHTML =
      '<div style="position:absolute;left:5px;top:0;width:2px;height:12px;background:#ffffffc0"></div>' +
      '<div style="position:absolute;left:0;top:5px;width:12px;height:2px;background:#ffffffc0"></div>';
    document.body.appendChild(this.crosshair);

    // Flex column rather than stacked `bottom` offsets: the panels vary in line count and
    // any of them can be hidden, so fixed offsets either overlap or leave holes.
    const corner = document.createElement('div');
    Object.assign(corner.style, {
      position: 'fixed',
      bottom: '12px',
      right: '12px',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'flex-end',
      gap: '8px',
      pointerEvents: 'none',
      zIndex: '30',
    });
    document.body.appendChild(corner);

    const panelStyle = {
      color: '#ffffffd0',
      fontFamily: 'monospace',
      fontSize: '12px',
      background: 'rgba(0,0,0,0.55)',
      padding: '6px 10px',
      borderRadius: '4px',
      whiteSpace: 'pre',
    } as const;

    this.sceneStatusHint = document.createElement('div');
    Object.assign(this.sceneStatusHint.style, panelStyle, { display: 'none' });
    this.sceneStatusHint.textContent = '';
    corner.appendChild(this.sceneStatusHint);

    // Every binding here is unhinted otherwise — firing in particular is easy to never find.
    this.controlsHint = document.createElement('div');
    Object.assign(this.controlsHint.style, panelStyle, { display: 'none' });
    corner.appendChild(this.controlsHint);

    this.modeBadge = document.createElement('div');
    Object.assign(this.modeBadge.style, panelStyle);
    this.modeBadge.textContent = '';
    corner.appendChild(this.modeBadge);

    this.updateModeBadge();

    this.camera.position.y = Math.max(this.camera.position.y, this.groundY + this.eyeHeight);
    this.cameraEuler.setFromQuaternion(this.camera.quaternion);
    this.yaw = this.cameraEuler.y;
    this.pitch = THREE.MathUtils.clamp(this.cameraEuler.x, -1.54, 1.54);
    this.applyView();

    // So canvas clicks can take keyboard focus away from toolbar <select>/buttons.
    if (!this.domElement.hasAttribute('tabindex')) {
      this.domElement.tabIndex = -1;
    }

    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    document.addEventListener('pointerlockchange', this.onPointerLockChange);
    document.addEventListener('mousemove', this.onMouseMove);
    this.domElement.addEventListener('pointerdown', this.onPointerDown);
    this.domElement.addEventListener('pointermove', this.onPointerMove);
    this.domElement.addEventListener('pointerup', this.onPointerUp);
    this.domElement.addEventListener('pointercancel', this.onPointerUp);
    this.domElement.addEventListener('contextmenu', this.onContextMenu);
  }

  private uiEnabled = true;

  /** Show/hide FPS chrome; unlock pointer when disabled. */
  setEnabled(enabled: boolean): void {
    this.uiEnabled = enabled;
    if (!enabled) {
      this.endLookDrag();
      if (document.pointerLockElement === this.domElement) document.exitPointerLock();
      this.crosshair.style.display = 'none';
      this.sceneStatusHint.style.display = 'none';
      this.controlsHint.style.display = 'none';
      this.modeBadge.style.display = 'none';
      this.keys.clear();
      return;
    }
    this.modeBadge.style.display = 'block';
    this.controlsHint.style.display = 'block';
    // Free-fly: always show a center reticle (no pointer lock).
    this.crosshair.style.display = this.freeFly ? 'block' : 'none';
    this.updateHintVisibility();
    this.updateModeBadge();
  }

  isEnabled(): boolean {
    return this.uiEnabled;
  }

  /** Sync yaw/pitch from the current camera pose (after applyCamera). */
  syncFromCamera(): void {
    this.cameraEuler.setFromQuaternion(this.camera.quaternion, 'YXZ');
    this.yaw = this.cameraEuler.y;
    this.pitch = THREE.MathUtils.clamp(this.cameraEuler.x, -1.54, 1.54);
    this.applyView();
  }

  lockPointer(): void {
    if (!this.uiEnabled || this.freeFly) return;
    this.domElement.requestPointerLock();
  }

  isLocked(): boolean {
    return this.freeFly ? this.uiEnabled : this.isPointerLocked;
  }

  /** True while LMB is dragging to steer (screen-space look). */
  isLookDragging(): boolean {
    return this.lookDragging;
  }

  /** True while LMB is dragging a physics body (screen-space joint). */
  isBodyDragging(): boolean {
    return this.bodyDragging;
  }

  setSceneStatusText(text: string | null): void {
    if (this.sceneStatusText === text) return;
    this.sceneStatusText = text;
    this.sceneStatusHint.textContent = text ?? '';
    this.updateHintVisibility();
  }

  update(dt: number): void {
    if (!this.uiEnabled) return;
    const runMultiplier = this.keys.has('ShiftLeft') || this.keys.has('ShiftRight')
      ? this.sprintMultiplier
      : 1.0;
    const speed = this.moveSpeed * runMultiplier;

    this.getLookDirection(this.lookDir);
    if (this.freeFly) {
      // True free-fly FPS: W/S along look, A/D strafe, Q/E along look (same axis as W/S
      // extras — use for fine dolly). No gravity / ground.
      this.moveForward.copy(this.lookDir);
      this.moveRight.set(1, 0, 0).applyQuaternion(this.camera.quaternion).normalize();
    } else if (this.noclipEnabled) {
      this.moveForward.copy(this.lookDir);
      this.moveRight.set(1, 0, 0).applyQuaternion(this.camera.quaternion).normalize();
    } else {
      this.moveForward.set(Math.sin(this.yaw), 0, -Math.cos(this.yaw)).normalize();
      this.moveRight.crossVectors(this.moveForward, this.up).normalize();
    }

    this.moveDelta.set(0, 0, 0);
    if (this.keys.has('KeyW')) this.moveDelta.add(this.moveForward);
    if (this.keys.has('KeyS')) this.moveDelta.sub(this.moveForward);
    if (this.keys.has('KeyD')) this.moveDelta.add(this.moveRight);
    if (this.keys.has('KeyA')) this.moveDelta.sub(this.moveRight);

    if (this.freeFly) {
      if (this.keys.has('KeyE')) this.moveDelta.add(this.lookDir);
      if (this.keys.has('KeyQ')) this.moveDelta.sub(this.lookDir);
    } else if (this.noclipEnabled) {
      if (this.keys.has('Space')) this.moveDelta.add(this.up);
      if (this.keys.has('ControlLeft') || this.keys.has('ControlRight') || this.keys.has('KeyQ')) {
        this.moveDelta.sub(this.up);
      }
      if (this.keys.has('KeyE')) this.moveDelta.add(this.up);
    }

    this.desiredVelocity.set(0, 0, 0);
    if (this.moveDelta.lengthSq() > 1e-6) {
      this.moveDelta.normalize();
      this.desiredVelocity.copy(this.moveDelta).multiplyScalar(speed);
      if (!this.physicsBodyMode) {
        this.camera.position.addScaledVector(this.moveDelta, speed * dt);
      }
    }

    if (this.physicsBodyMode) {
      return;
    }

    if (this.freeFly || this.noclipEnabled) {
      this.verticalVelocity = 0;
      this.isGrounded = false;
      return;
    }

    this.verticalVelocity -= this.gravity * dt;
    this.camera.position.y += this.verticalVelocity * dt;
    const minY = this.groundY + this.eyeHeight;
    if (this.camera.position.y <= minY) {
      this.camera.position.y = minY;
      this.verticalVelocity = 0;
      this.isGrounded = true;
    } else {
      this.isGrounded = false;
    }
  }

  getLookDirection(out: THREE.Vector3): THREE.Vector3 {
    return out.set(0, 0, -1).applyQuaternion(this.camera.quaternion).normalize();
  }

  getShootOrigin(out: THREE.Vector3, forwardOffset = 1.0): THREE.Vector3 {
    this.getLookDirection(this.lookDir);
    this.shootOrigin.copy(this.camera.position).addScaledVector(this.lookDir, forwardOffset);
    return out.copy(this.shootOrigin);
  }

  private applyView(): void {
    this.cameraEuler.set(this.pitch, this.yaw, 0, 'YXZ');
    this.camera.quaternion.setFromEuler(this.cameraEuler);
  }

  toggleNoclip(): boolean {
    this.setNoclipEnabled(!this.noclipEnabled);
    return this.noclipEnabled;
  }

  isNoclipEnabled(): boolean {
    return this.noclipEnabled;
  }

  private isTypingTarget(target: EventTarget | null): boolean {
    return (
      target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement ||
      target instanceof HTMLSelectElement ||
      (target instanceof HTMLElement && target.isContentEditable)
    );
  }

  private releaseUiFocus(): void {
    const active = document.activeElement;
    if (active instanceof HTMLElement && active !== this.domElement && this.isTypingTarget(active)) {
      active.blur();
    }
    this.domElement.focus({ preventScroll: true });
  }

  private onKeyDown = (event: KeyboardEvent): void => {
    if (!this.uiEnabled) return;
    if (this.isTypingTarget(event.target) || this.isTypingTarget(document.activeElement)) return;
    this.keys.add(event.code);

    if (this.freeFly) return;

    if (event.code === 'KeyN' && !event.repeat) {
      event.preventDefault();
      this.toggleNoclip();
      return;
    }

    if (event.code === 'Space') {
      event.preventDefault();
      if (this.physicsBodyMode) {
        if (this.isGrounded) {
          this.jumpRequested = true;
          this.isGrounded = false;
        }
      } else if (!this.noclipEnabled && this.isGrounded) {
        this.verticalVelocity = this.jumpVelocity;
        this.isGrounded = false;
      }
    }
  };

  private onKeyUp = (event: KeyboardEvent): void => {
    this.keys.delete(event.code);
  };

  private onPointerLockChange = (): void => {
    if (this.freeFly) return;
    this.isPointerLocked = document.pointerLockElement === this.domElement;
    this.crosshair.style.display = this.isPointerLocked ? 'block' : 'none';
    this.updateHintVisibility();
  };

  private onContextMenu = (event: Event): void => {
    if (this.uiEnabled && this.freeFly) event.preventDefault();
  };

  private onPointerDown = (event: PointerEvent): void => {
    if (!this.uiEnabled || !this.freeFly) return;
    if (event.button !== 0) return;
    if (event.target !== this.domElement) return;
    event.preventDefault();
    this.releaseUiFocus();
    this.lookPointerId = event.pointerId;
    this.bodyDragging = false;
    this.lookDragging = false;
    try {
      this.domElement.setPointerCapture(event.pointerId);
    } catch {
      /* ignore */
    }

    if (!this.tryPrimaryGrab) {
      this.lookDragging = true;
      return;
    }

    this.primaryPending = true;
    const pointerId = event.pointerId;
    void Promise.resolve(this.tryPrimaryGrab(event)).then((grabbed) => {
      // Released (or disabled) while pose readback / pick was in flight.
      if (!this.uiEnabled || this.lookPointerId !== pointerId) {
        if (grabbed) this.onPrimaryGrabEnd?.(event);
        return;
      }
      this.primaryPending = false;
      if (grabbed) {
        this.bodyDragging = true;
        this.lookDragging = false;
      } else {
        this.bodyDragging = false;
        this.lookDragging = true;
      }
    });
  };

  private onPointerMove = (event: PointerEvent): void => {
    if (!this.uiEnabled || !this.freeFly) return;
    if (this.lookPointerId !== null && event.pointerId !== this.lookPointerId) return;
    if (this.bodyDragging || this.primaryPending) {
      this.onPrimaryGrabMove?.(event);
      return;
    }
    if (!this.lookDragging) return;
    this.applyLookDelta(event.movementX, event.movementY);
  };

  private onPointerUp = (event: PointerEvent): void => {
    if (!this.freeFly) return;
    if (this.lookPointerId !== null && event.pointerId !== this.lookPointerId) return;
    const wasGrab = this.bodyDragging || this.primaryPending;
    this.endPrimaryPointer();
    if (wasGrab) this.onPrimaryGrabEnd?.(event);
  };

  private endPrimaryPointer(): void {
    if (this.lookPointerId !== null) {
      try {
        this.domElement.releasePointerCapture(this.lookPointerId);
      } catch {
        /* ignore */
      }
    }
    this.lookDragging = false;
    this.bodyDragging = false;
    this.primaryPending = false;
    this.lookPointerId = null;
  }

  private endLookDrag(): void {
    this.endPrimaryPointer();
  }

  private applyLookDelta(dx: number, dy: number): void {
    if (dx === 0 && dy === 0) return;
    this.yaw -= dx * this.mouseSensitivity;
    this.pitch -= dy * this.mouseSensitivity;
    this.pitch = THREE.MathUtils.clamp(this.pitch, -1.54, 1.54);
    this.applyView();
  }

  private onMouseMove = (event: MouseEvent): void => {
    // Legacy pointer-lock path (non–free-fly).
    if (this.freeFly || !this.isPointerLocked) return;
    this.applyLookDelta(event.movementX, event.movementY);
  };

  getDesiredMoveVelocity(out: THREE.Vector3): THREE.Vector3 {
    return out.copy(this.desiredVelocity);
  }

  captureState(): FPSControllerState {
    return {
      position: [this.camera.position.x, this.camera.position.y, this.camera.position.z],
      quaternion: [this.camera.quaternion.x, this.camera.quaternion.y, this.camera.quaternion.z, this.camera.quaternion.w],
      verticalVelocity: this.verticalVelocity,
      isGrounded: this.isGrounded,
      jumpRequested: this.jumpRequested,
      noclipEnabled: this.noclipEnabled,
    };
  }

  restoreState(state: FPSControllerState): void {
    this.setNoclipEnabled(state.noclipEnabled);
    this.camera.position.set(state.position[0], state.position[1], state.position[2]);
    this.camera.quaternion.set(
      state.quaternion[0],
      state.quaternion[1],
      state.quaternion[2],
      state.quaternion[3],
    );
    this.cameraEuler.setFromQuaternion(this.camera.quaternion, 'YXZ');
    this.yaw = this.cameraEuler.y;
    this.pitch = THREE.MathUtils.clamp(this.cameraEuler.x, -1.54, 1.54);
    this.verticalVelocity = state.verticalVelocity;
    this.isGrounded = state.isGrounded;
    this.jumpRequested = state.jumpRequested;
  }

  consumeJumpRequest(): boolean {
    const requested = this.jumpRequested;
    this.jumpRequested = false;
    return requested;
  }

  setPhysicsBodyState(center: THREE.Vector3, grounded: boolean, eyeOffset = this.eyeHeight): void {
    this.camera.position.set(center.x, center.y + eyeOffset, center.z);
    this.isGrounded = grounded;
  }

  setNoclipEnabled(enabled: boolean): void {
    if (this.noclipEnabled === enabled) return;
    this.noclipEnabled = enabled;
    this.verticalVelocity = 0;
    if (!this.physicsBodyMode && !enabled) {
      const minY = this.groundY + this.eyeHeight;
      if (this.camera.position.y < minY) {
        this.camera.position.y = minY;
      }
      this.isGrounded = this.camera.position.y <= minY + 1e-4;
    } else {
      this.isGrounded = false;
    }
    this.updateModeBadge();
  }

  private updateHintVisibility(): void {
    this.sceneStatusHint.style.display =
      this.uiEnabled && this.sceneStatusText ? 'block' : 'none';
  }

  private updateModeBadge(): void {
    this.controlsHint.textContent = this.freeFly
      ? 'WASD + QE  move\nLMB drag   look / grab a body\nRMB hold   fire projectiles'
      : 'WASD  move\nSpace jump  ·  N noclip';

    if (this.freeFly) {
      this.modeBadge.textContent = 'Mode: FLY';
      this.modeBadge.style.background = 'rgba(42, 122, 64, 0.75)';
      return;
    }
    if (this.noclipEnabled) {
      this.modeBadge.textContent = 'Mode: NOCLIP';
      this.modeBadge.style.background = 'rgba(42, 122, 64, 0.75)';
    } else {
      this.modeBadge.textContent = 'Mode: WALK';
      this.modeBadge.style.background = 'rgba(0,0,0,0.55)';
    }
  }
}
