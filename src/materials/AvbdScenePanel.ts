/**
 * World-space AVBD scene picker for XR — the header's <select> as paged rows, pinch to load.
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
import { DEFAULT_STACK_PRESET, presetLabel, presetsByGroup, type StackPreset } from './webphysics/presets';

const BTN = { width: 0.09, height: 0.055, gap: 0.008 };
const ROW = { width: 0.42, height: 0.055, gap: 0.008 };
const RES = { width: 384, height: 120 };
const ROWS = 4;

/** Above the exhibit strip, in the slot the MLS params panel uses. */
const PLACEMENT = { y: 1.4, z: -0.48, tilt: 0.32 };

interface Page {
  title: string;
  ids: StackPreset[];
}

function buildPages(): Page[] {
  const pages: Page[] = [];
  for (const { group, ids } of presetsByGroup({ skipDesktopOnly: true })) {
    const chunks = Math.ceil(ids.length / ROWS);
    for (let i = 0; i < chunks; i++) {
      pages.push({
        title: chunks > 1 ? `${group} ${i + 1}/${chunks}` : group,
        ids: ids.slice(i * ROWS, i * ROWS + ROWS),
      });
    }
  }
  return pages;
}

interface Widget {
  mesh: Mesh;
  texture: CanvasTexture;
  canvas: HTMLCanvasElement;
  action: string;
}

/** Shrink until the longest preset labels stop overflowing their row. */
function fitFont(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, startPx: number): void {
  for (let size = startPx; size > 22; size -= 2) {
    ctx.font = `600 ${size}px system-ui, -apple-system, sans-serif`;
    if (ctx.measureText(text).width <= maxWidth) return;
  }
}

function paintButton(w: Widget, text: string): void {
  const ctx = w.canvas.getContext('2d');
  if (!ctx) return;
  const { width, height } = RES;
  ctx.clearRect(0, 0, width, height);
  ctx.beginPath();
  ctx.roundRect(4, 4, width - 8, height - 8, 22);
  ctx.fillStyle = '#1b1f27';
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#48525f';
  ctx.stroke();
  ctx.fillStyle = '#c3ccd8';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  fitFont(ctx, text, width - 40, 44);
  ctx.fillText(text, width / 2, height / 2 + 2);
  w.texture.needsUpdate = true;
}

function paintScene(w: Widget, label: string, active: boolean): void {
  const ctx = w.canvas.getContext('2d');
  if (!ctx) return;
  const { width, height } = RES;
  ctx.clearRect(0, 0, width, height);
  ctx.beginPath();
  ctx.roundRect(4, 4, width - 8, height - 8, 22);
  ctx.fillStyle = active ? '#d4a574' : '#141820';
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = active ? '#f0d2a8' : '#3a4452';
  ctx.stroke();
  ctx.fillStyle = active ? '#231607' : '#e8eef6';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  fitFont(ctx, label, width - 56, 40);
  ctx.fillText(label, 28, height / 2 + 2);
  w.texture.needsUpdate = true;
}

function makeWidget(width: number, height: number, action: string): Widget {
  const canvas = document.createElement('canvas');
  canvas.width = RES.width;
  canvas.height = RES.height;
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  const mesh = new Mesh(
    new PlaneGeometry(width, height),
    new MeshBasicMaterial({ map: texture, transparent: true }),
  );
  mesh.name = `avbd-scene-${action}`;
  return { mesh, texture, canvas, action };
}

export class AvbdScenePanel {
  readonly group = new Group();
  private readonly widgets: Widget[] = [];
  private readonly byAction = new Map<string, Widget>();
  private readonly pages = buildPages();
  private pageIndex = 0;
  private current: StackPreset = DEFAULT_STACK_PRESET;
  private onSelect: ((id: StackPreset) => void) | null = null;

  constructor() {
    const prev = makeWidget(BTN.width, BTN.height, 'page-prev');
    const title = makeWidget(ROW.width * 0.7, BTN.height, 'page-title');
    const next = makeWidget(BTN.width, BTN.height, 'page-next');
    const headY = (ROW.height + ROW.gap) * ROWS + BTN.height * 0.5;
    const headSpan = BTN.width * 2 + ROW.width * 0.7 + BTN.gap * 2;
    prev.mesh.position.set(-headSpan / 2 + BTN.width / 2, headY, 0);
    title.mesh.position.set(0, headY, 0);
    next.mesh.position.set(headSpan / 2 - BTN.width / 2, headY, 0);
    this.addWidget(prev);
    this.addWidget(title);
    this.addWidget(next);

    for (let i = 0; i < ROWS; i++) {
      const row = makeWidget(ROW.width, ROW.height, `scene-${i}`);
      row.mesh.position.set(0, (ROW.height + ROW.gap) * (ROWS - 1 - i), 0);
      this.addWidget(row);
    }

    this.group.position.set(0, PLACEMENT.y, PLACEMENT.z);
    this.group.rotation.x = PLACEMENT.tilt;
    this.group.visible = false;
    this.pageIndex = this.pageOf(this.current);
    this.repaint();
  }

  private addWidget(w: Widget): void {
    this.group.add(w.mesh);
    this.widgets.push(w);
    this.byAction.set(w.action, w);
  }

  private pageOf(id: StackPreset): number {
    const i = this.pages.findIndex((p) => p.ids.includes(id));
    return i < 0 ? this.pageIndex : i;
  }

  get targets(): Object3D[] {
    return this.widgets.filter((w) => w.mesh.visible).map((w) => w.mesh);
  }

  get visible(): boolean {
    return this.group.visible;
  }

  setVisible(visible: boolean): void {
    this.group.visible = visible;
  }

  setOnSelect(handler: (id: StackPreset) => void): void {
    this.onSelect = handler;
  }

  /** Follow scene changes that came from the desktop select / boot restore. */
  setScene(id: StackPreset): void {
    this.current = id;
    this.pageIndex = this.pageOf(id);
    this.repaint();
  }

  handlePick(object: Object3D): boolean {
    const w = this.widgets.find((x) => x.mesh === object);
    if (!w) return false;

    if (w.action === 'page-prev') {
      this.pageIndex = (this.pageIndex + this.pages.length - 1) % this.pages.length;
      this.repaint();
      return true;
    }
    if (w.action === 'page-next') {
      this.pageIndex = (this.pageIndex + 1) % this.pages.length;
      this.repaint();
      return true;
    }
    if (w.action === 'page-title') return true;

    const m = /^scene-(\d+)$/.exec(w.action);
    if (!m) return true;
    const id = this.pages[this.pageIndex]?.ids[Number(m[1])];
    if (!id || id === this.current) return true;
    this.current = id;
    this.repaint();
    this.onSelect?.(id);
    return true;
  }

  private repaint(): void {
    const page = this.pages[this.pageIndex];
    paintButton(this.byAction.get('page-prev')!, '‹');
    paintButton(this.byAction.get('page-title')!, page?.title ?? 'scenes');
    paintButton(this.byAction.get('page-next')!, '›');

    for (let i = 0; i < ROWS; i++) {
      const row = this.byAction.get(`scene-${i}`)!;
      const id = page?.ids[i];
      row.mesh.visible = id !== undefined;
      if (id !== undefined) paintScene(row, presetLabel(id), id === this.current);
    }
  }

  dispose(): void {
    for (const w of this.widgets) {
      w.texture.dispose();
      (w.mesh.material as MeshBasicMaterial).dispose();
      w.mesh.geometry.dispose();
    }
  }
}
