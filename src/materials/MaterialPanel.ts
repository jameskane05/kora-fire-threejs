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

export type SandboxExhibit = 'fire' | 'avbd' | MaterialKind;
/** Top-level family for XR strip (maps to fire / last MLS kind / avbd). */
export type SandboxFamily = 'kora' | 'mls' | 'avbd';
export type MaterialAction = SandboxExhibit | SandboxFamily | 'reset' | 'toggle-view';

const BUTTON = { width: 0.1, height: 0.07, gap: 0.008 };
const RESOLUTION = { width: 256, height: 148 };

/** Above the tabletop exhibit, tipped down toward the viewer. */
const PLACEMENT = { y: 1.22, z: -0.48, tilt: 0.32 };

const FAMILY_LABELS: { action: MaterialAction; text: string }[] = [
  { action: 'kora', text: 'kora' },
  { action: 'mls', text: 'mls' },
  { action: 'avbd', text: 'avbd' },
  { action: 'reset', text: 'reset' },
];

/**
 * Second row, shown only for the MLS family. AVBD gets its scene list from AvbdScenePanel and
 * kora has no variants, so the family strip alone left no way to pick a material in a headset.
 */
const MLS_LABELS: { action: MaterialAction; text: string }[] = [
  { action: 'sand', text: 'sand' },
  { action: 'goo', text: 'goo' },
  { action: 'water', text: 'water' },
  { action: 'toggle-view', text: 'solid' },
];

function familyOf(exhibit: SandboxExhibit): SandboxFamily {
  if (exhibit === 'fire') return 'kora';
  if (exhibit === 'avbd') return 'avbd';
  return 'mls';
}

interface Button {
  action: MaterialAction;
  mesh: Mesh;
  texture: CanvasTexture;
  canvas: HTMLCanvasElement;
  text: string;
}

/** Centre whatever is currently shown, so a hidden button does not leave the row lopsided. */
function layoutRow(buttons: Button[]): void {
  const shown = buttons.filter((b) => b.mesh.visible);
  const span = shown.length * BUTTON.width + Math.max(shown.length - 1, 0) * BUTTON.gap;
  for (const [i, button] of shown.entries()) {
    button.mesh.position.x = -span / 2 + BUTTON.width / 2 + i * (BUTTON.width + BUTTON.gap);
  }
}

function paint(button: Button, active: boolean): void {
  const ctx = button.canvas.getContext('2d');
  if (!ctx) return;

  const { width, height } = RESOLUTION;
  const radius = 26;
  const isUtility = button.action === 'reset';

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
  private readonly mlsButtons: Button[] = [];
  private readonly geometry = new PlaneGeometry(BUTTON.width, BUTTON.height);
  private current: SandboxExhibit;
  private gelSurface = true;
  private onAction: ((action: MaterialAction) => void) | null = null;

  constructor(kind: SandboxExhibit = 'sand') {
    this.current = kind;

    this.buildRow(FAMILY_LABELS, 0, this.buttons);
    this.buildRow(MLS_LABELS, -(BUTTON.height + BUTTON.gap), this.mlsButtons);

    this.group.position.set(0, PLACEMENT.y, PLACEMENT.z);
    this.group.rotation.x = PLACEMENT.tilt;
    this.group.visible = false;
    this.repaint();
  }

  private buildRow(
    labels: { action: MaterialAction; text: string }[],
    y: number,
    into: Button[],
  ): void {
    for (const { action, text } of labels) {
      const canvas = document.createElement('canvas');
      canvas.width = RESOLUTION.width;
      canvas.height = RESOLUTION.height;

      const texture = new CanvasTexture(canvas);
      texture.colorSpace = SRGBColorSpace;

      const mesh = new Mesh(this.geometry, new MeshBasicMaterial({ map: texture, transparent: true }));
      mesh.position.y = y;
      mesh.name = `mat-panel-${action}`;

      const button: Button = { action, mesh, texture, canvas, text };
      this.group.add(mesh);
      into.push(button);
    }
    layoutRow(into);
  }

  /** Hidden rows must drop out: Raycaster still hits an invisible plane. */
  get targets(): Object3D[] {
    return [...this.buttons, ...this.mlsButtons]
      .filter((b) => b.mesh.visible)
      .map((b) => b.mesh);
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

  setGelSurface(on: boolean): void {
    this.gelSurface = on;
    this.repaint();
  }

  private repaint(): void {
    const family = familyOf(this.current);
    for (const button of this.buttons) {
      paint(button, button.action === family);
    }
    for (const button of this.mlsButtons) {
      const isSolidToggle = button.action === 'toggle-view';
      // Only goo has a solid mode; sand and water are always beads.
      button.mesh.visible = family === 'mls' && (!isSolidToggle || this.current === 'goo');
      paint(button, isSolidToggle ? this.gelSurface : button.action === this.current);
    }
    layoutRow(this.mlsButtons);
  }

  setVisible(visible: boolean): void {
    this.group.visible = visible;
  }

  /** True when the pinch hit a button (and the action was fired). */
  handlePick(object: Object3D): boolean {
    const button =
      this.buttons.find((b) => b.mesh === object) ??
      this.mlsButtons.find((b) => b.mesh === object && b.mesh.visible);
    if (!button) return false;
    this.onAction?.(button.action);
    if (button.action === 'kora') this.setKind('fire');
    else if (button.action === 'mls') {
      const kind = this.current === 'sand' || this.current === 'goo' || this.current === 'water' ? this.current : 'sand';
      this.setKind(kind);
    } else if (button.action === 'avbd') this.setKind('avbd');
    else if (button.action !== 'reset' && button.action !== 'toggle-view') {
      this.setKind(button.action as SandboxExhibit);
    }
    return true;
  }

  dispose(): void {
    for (const button of [...this.buttons, ...this.mlsButtons]) {
      button.texture.dispose();
      (button.mesh.material as MeshBasicMaterial).dispose();
    }
    this.geometry.dispose();
  }
}
