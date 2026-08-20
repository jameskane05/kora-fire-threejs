/**
 * World-space backdrop picker for XR — the header's <select> as a single row of pinch targets.
 *
 * Unlike the params panels this is not per-exhibit, so it stays up whichever exhibit is loaded and
 * lives in the gap between the exhibit strip and whatever panel is occupying the slot above it.
 */
import {
  CanvasTexture,
  Group,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  SRGBColorSpace,
  type Object3D,
} from 'three/webgpu';
import { ENVIRONMENTS, type EnvironmentName } from '../scene/Environment';

const BTN = { width: 0.075, height: 0.045, gap: 0.006 };
const RES = { width: 256, height: 148 };

/** Between the exhibit strip (1.22) and the params panels (1.42). */
const PLACEMENT = { y: 1.31, z: -0.48, tilt: 0.32 };

const LABELS: Record<EnvironmentName, string> = {
  void: 'void',
  studio: 'studio',
  dusk: 'dusk',
  daylight: 'day',
  night: 'night',
};

interface Button {
  mesh: Mesh;
  texture: CanvasTexture;
  canvas: HTMLCanvasElement;
  name: EnvironmentName;
}

function paint(button: Button, active: boolean): void {
  const ctx = button.canvas.getContext('2d');
  if (!ctx) return;
  const { width, height } = RES;
  ctx.clearRect(0, 0, width, height);
  ctx.beginPath();
  ctx.roundRect(4, 4, width - 8, height - 8, 26);
  ctx.fillStyle = active ? '#d4a574' : '#141820';
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = active ? '#f0d2a8' : '#3a4452';
  ctx.stroke();
  ctx.fillStyle = active ? '#231607' : '#c3ccd8';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '600 44px system-ui, -apple-system, sans-serif';
  ctx.fillText(LABELS[button.name], width / 2, height / 2 + 2);
  button.texture.needsUpdate = true;
}

export class EnvPanel {
  readonly group = new Group();
  private readonly buttons: Button[] = [];
  private current: EnvironmentName = 'night';
  private onSelect: ((name: EnvironmentName) => void) | null = null;

  constructor() {
    const span = ENVIRONMENTS.length * BTN.width + (ENVIRONMENTS.length - 1) * BTN.gap;
    for (const [i, name] of ENVIRONMENTS.entries()) {
      const canvas = document.createElement('canvas');
      canvas.width = RES.width;
      canvas.height = RES.height;
      const texture = new CanvasTexture(canvas);
      texture.colorSpace = SRGBColorSpace;
      const mesh = new Mesh(
        new PlaneGeometry(BTN.width, BTN.height),
        new MeshBasicMaterial({ map: texture, transparent: true }),
      );
      mesh.name = `env-${name}`;
      mesh.position.x = -span / 2 + BTN.width / 2 + i * (BTN.width + BTN.gap);
      this.group.add(mesh);
      this.buttons.push({ mesh, texture, canvas, name });
    }

    this.group.position.set(0, PLACEMENT.y, PLACEMENT.z);
    this.group.rotation.x = PLACEMENT.tilt;
    this.group.visible = false;
    this.repaint();
  }

  get targets(): Object3D[] {
    return this.buttons.map((b) => b.mesh);
  }

  get visible(): boolean {
    return this.group.visible;
  }

  setVisible(visible: boolean): void {
    this.group.visible = visible;
  }

  setOnSelect(handler: (name: EnvironmentName) => void): void {
    this.onSelect = handler;
  }

  /** Follow changes that came from the desktop select or an exhibit's default. */
  setEnvironment(name: EnvironmentName): void {
    if (this.current === name) return;
    this.current = name;
    this.repaint();
  }

  handlePick(object: Object3D): boolean {
    const button = this.buttons.find((b) => b.mesh === object);
    if (!button) return false;
    if (button.name !== this.current) {
      this.current = button.name;
      this.repaint();
      this.onSelect?.(button.name);
    }
    return true;
  }

  private repaint(): void {
    for (const button of this.buttons) paint(button, button.name === this.current);
  }

  dispose(): void {
    for (const button of this.buttons) {
      button.texture.dispose();
      (button.mesh.material as MeshBasicMaterial).dispose();
      button.mesh.geometry.dispose();
    }
  }
}
