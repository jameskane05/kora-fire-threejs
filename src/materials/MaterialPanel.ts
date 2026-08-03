/**
 * World-space exhibit strip for the AVP sandbox in XR.
 * Lives in reference space (ImmersiveMode.hud) so gaze-and-pinch can hit it while the stage pans.
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
import type { MaterialKind } from './MlsMpm';

export type SandboxExhibit = 'fire' | MaterialKind;
export type MaterialAction = SandboxExhibit | 'reset' | 'toggle-view';

const BUTTON = { width: 0.1, height: 0.07, gap: 0.01 };
const RESOLUTION = { width: 256, height: 148 };

/** Above the tabletop exhibit, tipped down toward the viewer. */
const PLACEMENT = { y: 1.22, z: -0.48, tilt: 0.32 };

const LABELS: { action: MaterialAction; text: string }[] = [
  { action: 'fire', text: 'fire' },
  { action: 'sand', text: 'sand' },
  { action: 'goo', text: 'goo' },
  { action: 'water', text: 'water' },
  { action: 'reset', text: 'reset' },
];

interface Button {
  action: MaterialAction;
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
  const isUtility = button.action === 'reset' || button.action === 'toggle-view';

  ctx.clearRect(0, 0, width, height);
  ctx.beginPath();
  ctx.roundRect(4, 4, width - 8, height - 8, radius);

  ctx.fillStyle = active && !isUtility ? '#d4a574' : '#1b1f27';
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = active && !isUtility ? '#f0d2a8' : '#48525f';
  ctx.stroke();

  ctx.fillStyle = active && !isUtility ? '#231607' : '#c3ccd8';
  ctx.font = '600 48px system-ui, -apple-system, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(button.text, width / 2, height / 2 + 2);

  button.texture.needsUpdate = true;
}

export class MaterialPanel {
  readonly group = new Group();
  private readonly buttons: Button[] = [];
  private current: SandboxExhibit;
  private onAction: ((action: MaterialAction) => void) | null = null;

  constructor(kind: SandboxExhibit = 'sand') {
    this.current = kind;

    const geometry = new PlaneGeometry(BUTTON.width, BUTTON.height);
    const span = LABELS.length * BUTTON.width + (LABELS.length - 1) * BUTTON.gap;

    for (const [i, { action, text }] of LABELS.entries()) {
      const canvas = document.createElement('canvas');
      canvas.width = RESOLUTION.width;
      canvas.height = RESOLUTION.height;

      const texture = new CanvasTexture(canvas);
      texture.colorSpace = SRGBColorSpace;

      const mesh = new Mesh(geometry, new MeshBasicMaterial({ map: texture, transparent: true }));
      mesh.position.x = -span / 2 + BUTTON.width / 2 + i * (BUTTON.width + BUTTON.gap);
      mesh.name = `mat-panel-${action}`;

      const button: Button = { action, mesh, texture, canvas, text };
      this.group.add(mesh);
      this.buttons.push(button);
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

  setOnAction(handler: (action: MaterialAction) => void): void {
    this.onAction = handler;
  }

  setKind(kind: SandboxExhibit): void {
    this.current = kind;
    this.repaint();
  }

  private repaint(): void {
    for (const button of this.buttons) {
      paint(button, button.action === this.current);
    }
  }

  setVisible(visible: boolean): void {
    this.group.visible = visible;
  }

  /** True when the pinch hit a button (and the action was fired). */
  handlePick(object: Object3D): boolean {
    const button = this.buttons.find((b) => b.mesh === object);
    if (!button) return false;
    this.onAction?.(button.action);
    if (button.action !== 'reset' && button.action !== 'toggle-view') {
      this.setKind(button.action);
    }
    return true;
  }

  dispose(): void {
    for (const button of this.buttons) {
      button.texture.dispose();
      (button.mesh.material as MeshBasicMaterial).dispose();
    }
    this.buttons[0]?.mesh.geometry.dispose();
  }
}
