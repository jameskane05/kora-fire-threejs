/**
 * A three-button strip for picking what a pinch-drag does to a grabbed primitive.
 *
 * The desktop build switches modes with the W/E/R keys and shows a transform gizmo. Neither
 * survives a headset: there is no keyboard, and a gizmo made of thin axis handles is miserable to
 * hit with a hand ray. So the mode moves out of the gizmo and into a panel you look at and pinch,
 * which reuses the same pick the rest of the pointer handling already does.
 *
 * The panel lives in reference space rather than on the rig — it should stay put and stay
 * legible while the domain turns and scales in front of it.
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
import type { GizmoMode } from '../scene/Obstacles';

const BUTTON = { width: 0.13, height: 0.075, gap: 0.015 };
const RESOLUTION = { width: 256, height: 148 };

/** Placement in reference space, just under the domain and tipped up towards the viewer. */
const PLACEMENT = { y: 0.66, z: -1.5, tilt: -0.42 };

const LABELS: { mode: GizmoMode; text: string }[] = [
  { mode: 'translate', text: 'move' },
  { mode: 'rotate', text: 'turn' },
  { mode: 'scale', text: 'size' },
];

interface Button {
  mode: GizmoMode;
  mesh: Mesh;
  texture: CanvasTexture;
  canvas: HTMLCanvasElement;
  text: string;
}

function paint(button: Button, active: boolean): void {
  const ctx = button.canvas.getContext('2d');
  if (!ctx) return;

  const { width, height } = RESOLUTION;
  const radius = 26;

  ctx.clearRect(0, 0, width, height);
  ctx.beginPath();
  ctx.roundRect(4, 4, width - 8, height - 8, radius);

  ctx.fillStyle = active ? '#e8a24c' : '#1b1f27';
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = active ? '#ffd9a3' : '#48525f';
  ctx.stroke();

  ctx.fillStyle = active ? '#231607' : '#c3ccd8';
  ctx.font = '600 54px system-ui, -apple-system, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(button.text, width / 2, height / 2 + 2);

  button.texture.needsUpdate = true;
}

export class ModePanel {
  readonly group = new Group();
  private readonly buttons: Button[] = [];
  private current: GizmoMode;

  constructor(mode: GizmoMode) {
    this.current = mode;

    const geometry = new PlaneGeometry(BUTTON.width, BUTTON.height);
    const span = LABELS.length * BUTTON.width + (LABELS.length - 1) * BUTTON.gap;

    for (const [i, { mode: m, text }] of LABELS.entries()) {
      const canvas = document.createElement('canvas');
      canvas.width = RESOLUTION.width;
      canvas.height = RESOLUTION.height;

      const texture = new CanvasTexture(canvas);
      texture.colorSpace = SRGBColorSpace;

      const mesh = new Mesh(geometry, new MeshBasicMaterial({ map: texture, transparent: true }));
      mesh.position.x = -span / 2 + BUTTON.width / 2 + i * (BUTTON.width + BUTTON.gap);

      const button: Button = { mode: m, mesh, texture, canvas, text };
      paint(button, m === mode);

      this.group.add(mesh);
      this.buttons.push(button);
    }

    this.group.position.set(0, PLACEMENT.y, PLACEMENT.z);
    this.group.rotation.x = PLACEMENT.tilt;
    this.group.visible = false;
  }

  get targets(): Object3D[] {
    return this.buttons.map((b) => b.mesh);
  }

  get visible(): boolean {
    return this.group.visible;
  }

  /** The mode a picked object stands for, or null if it is not one of the buttons. */
  resolve(object: Object3D): GizmoMode | null {
    return this.buttons.find((b) => b.mesh === object)?.mode ?? null;
  }

  setMode(mode: GizmoMode): void {
    if (mode === this.current) return;
    this.current = mode;
    for (const button of this.buttons) paint(button, button.mode === mode);
  }

  setVisible(visible: boolean): void {
    this.group.visible = visible;
  }

  dispose(): void {
    for (const button of this.buttons) {
      button.texture.dispose();
      (button.mesh.material as MeshBasicMaterial).dispose();
    }
    this.buttons[0]?.mesh.geometry.dispose();
  }
}
