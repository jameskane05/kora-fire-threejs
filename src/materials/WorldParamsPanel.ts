/**
 * Glanceable world-space params for XR: a few stepped knobs per page, pinch to nudge.
 * Continuous sliders stay on the desktop lil-gui.
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
import type { MaterialsParams } from './params';

const BTN = { width: 0.09, height: 0.055, gap: 0.008 };
const ROW = { width: 0.34, height: 0.055, gap: 0.008 };
const RES = { width: 320, height: 120 };

type StepFn = (params: MaterialsParams, kind: MaterialKind, dir: 1 | -1) => void;

interface Knob {
  label: string;
  read: (params: MaterialsParams, kind: MaterialKind) => string;
  step: StepFn;
}

interface Page {
  title: string;
  knobs: Knob[];
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

function stepScalar(
  get: () => number,
  set: (v: number) => void,
  delta: number,
  lo: number,
  hi: number,
  dir: 1 | -1,
): void {
  set(clamp(get() + dir * delta, lo, hi));
}

const PAGES: Page[] = [
  {
    title: 'forces',
    knobs: [
      {
        label: 'hand',
        read: (p) => p.handForce.toFixed(0),
        step: (p, _k, d) => stepScalar(() => p.handForce, (v) => { p.handForce = v; }, 5, 5, 120, d),
      },
      {
        label: 'hand ×',
        read: (p, k) => p[k].handForceScale.toFixed(2),
        step: (p, k, d) =>
          stepScalar(() => p[k].handForceScale, (v) => { p[k].handForceScale = v; }, 0.25, 0.2, 8, d),
      },
      {
        label: 'grav',
        read: (p) => p.gravity.toFixed(0),
        step: (p, _k, d) => stepScalar(() => p.gravity, (v) => { p.gravity = v; }, 10, 10, 250, d),
      },
    ],
  },
  {
    title: 'body',
    knobs: [
      {
        label: 'grav ×',
        read: (p, k) => p[k].gravityScale.toFixed(2),
        step: (p, k, d) =>
          stepScalar(() => p[k].gravityScale, (v) => { p[k].gravityScale = v; }, 0.1, 0.2, 4, d),
      },
      {
        label: 'μ',
        read: (p, k) => p[k].mu.toFixed(0),
        step: (p, k, d) => stepScalar(() => p[k].mu, (v) => { p[k].mu = v; }, 10, 0, 400, d),
      },
      {
        label: 'λ',
        read: (p, k) => p[k].lambda.toFixed(0),
        step: (p, k, d) => stepScalar(() => p[k].lambda, (v) => { p[k].lambda = v; }, 20, 20, 1200, d),
      },
    ],
  },
  {
    title: 'time',
    knobs: [
      {
        label: 'subs',
        read: (p) => p.substeps.toFixed(0),
        step: (p, _k, d) =>
          stepScalar(() => p.substeps, (v) => { p.substeps = Math.round(v); }, 1, 4, 24, d),
      },
      {
        label: 'Δt',
        read: (p) => p.subDt.toExponential(1),
        step: (p, _k, d) =>
          stepScalar(() => p.subDt, (v) => { p.subDt = v; }, 2e-5, 1e-4, 5e-4, d),
      },
    ],
  },
];

interface Widget {
  mesh: Mesh;
  texture: CanvasTexture;
  canvas: HTMLCanvasElement;
  action: string;
}

function paintButton(w: Widget, text: string, active = false): void {
  const ctx = w.canvas.getContext('2d');
  if (!ctx) return;
  const { width, height } = RES;
  ctx.clearRect(0, 0, width, height);
  ctx.beginPath();
  ctx.roundRect(4, 4, width - 8, height - 8, 22);
  ctx.fillStyle = active ? '#d4a574' : '#1b1f27';
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = active ? '#f0d2a8' : '#48525f';
  ctx.stroke();
  ctx.fillStyle = active ? '#231607' : '#c3ccd8';
  ctx.font = '600 44px system-ui, -apple-system, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, width / 2, height / 2 + 2);
  w.texture.needsUpdate = true;
}

function paintRow(w: Widget, label: string, value: string): void {
  const ctx = w.canvas.getContext('2d');
  if (!ctx) return;
  const { width, height } = RES;
  ctx.clearRect(0, 0, width, height);
  ctx.beginPath();
  ctx.roundRect(4, 4, width - 8, height - 8, 22);
  ctx.fillStyle = '#141820';
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#3a4452';
  ctx.stroke();
  ctx.fillStyle = '#8d96a3';
  ctx.font = '600 36px system-ui, -apple-system, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, 28, height / 2 + 2);
  ctx.fillStyle = '#e8eef6';
  ctx.textAlign = 'right';
  ctx.font = '600 40px system-ui, -apple-system, sans-serif';
  ctx.fillText(value, width - 28, height / 2 + 2);
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
  mesh.name = `world-params-${action}`;
  return { mesh, texture, canvas, action };
}

/** Above the exhibit strip, still in reference space. */
const PLACEMENT = { y: 1.42, z: -0.48, tilt: 0.32 };

export class WorldParamsPanel {
  readonly group = new Group();
  private readonly widgets: Widget[] = [];
  private readonly byAction = new Map<string, Widget>();
  private pageIndex = 0;
  private kind: MaterialKind = 'sand';
  private params: MaterialsParams;
  private onChange: (() => void) | null = null;

  constructor(params: MaterialsParams) {
    this.params = params;

    const prev = makeWidget(BTN.width, BTN.height, 'page-prev');
    const title = makeWidget(ROW.width * 0.7, BTN.height, 'page-title');
    const next = makeWidget(BTN.width, BTN.height, 'page-next');
    const headY = (ROW.height + ROW.gap) * 3 + BTN.height * 0.5;
    const headSpan = BTN.width * 2 + ROW.width * 0.7 + BTN.gap * 2;
    prev.mesh.position.set(-headSpan / 2 + BTN.width / 2, headY, 0);
    title.mesh.position.set(0, headY, 0);
    next.mesh.position.set(headSpan / 2 - BTN.width / 2, headY, 0);
    this.addWidget(prev);
    this.addWidget(title);
    this.addWidget(next);

    for (let i = 0; i < 3; i++) {
      const y = (ROW.height + ROW.gap) * (2 - i);
      const minus = makeWidget(BTN.width, ROW.height, `knob-${i}-`);
      const row = makeWidget(ROW.width, ROW.height, `knob-${i}`);
      const plus = makeWidget(BTN.width, ROW.height, `knob-${i}+`);
      const span = BTN.width * 2 + ROW.width + BTN.gap * 2;
      minus.mesh.position.set(-span / 2 + BTN.width / 2, y, 0);
      row.mesh.position.set(0, y, 0);
      plus.mesh.position.set(span / 2 - BTN.width / 2, y, 0);
      this.addWidget(minus);
      this.addWidget(row);
      this.addWidget(plus);
    }

    this.group.position.set(0, PLACEMENT.y, PLACEMENT.z);
    this.group.rotation.x = PLACEMENT.tilt;
    this.group.visible = false;
    this.repaint();
  }

  private addWidget(w: Widget): void {
    this.group.add(w.mesh);
    this.widgets.push(w);
    this.byAction.set(w.action, w);
  }

  get targets(): Object3D[] {
    return this.widgets.map((w) => w.mesh);
  }

  get visible(): boolean {
    return this.group.visible;
  }

  setVisible(visible: boolean): void {
    this.group.visible = visible;
  }

  setKind(kind: MaterialKind): void {
    this.kind = kind;
    this.repaint();
  }

  setOnChange(handler: () => void): void {
    this.onChange = handler;
  }

  /** Sync painted values after desktop GUI edits. */
  refresh(): void {
    this.repaint();
  }

  handlePick(object: Object3D): boolean {
    const w = this.widgets.find((x) => x.mesh === object);
    if (!w) return false;

    if (w.action === 'page-prev') {
      this.pageIndex = (this.pageIndex + PAGES.length - 1) % PAGES.length;
      this.repaint();
      return true;
    }
    if (w.action === 'page-next') {
      this.pageIndex = (this.pageIndex + 1) % PAGES.length;
      this.repaint();
      return true;
    }
    if (w.action === 'page-title' || /^knob-\d+$/.test(w.action)) return true;

    const m = /^knob-(\d+)([+-])$/.exec(w.action);
    if (!m) return true;
    const idx = Number(m[1]);
    const dir = m[2] === '+' ? 1 : (-1 as const);
    const knob = PAGES[this.pageIndex].knobs[idx];
    if (!knob) return true;
    knob.step(this.params, this.kind, dir);
    this.onChange?.();
    this.repaint();
    return true;
  }

  private repaint(): void {
    const page = PAGES[this.pageIndex];
    paintButton(this.byAction.get('page-prev')!, '‹');
    paintButton(this.byAction.get('page-title')!, `${page.title} · ${this.kind}`);
    paintButton(this.byAction.get('page-next')!, '›');

    for (let i = 0; i < 3; i++) {
      const minus = this.byAction.get(`knob-${i}-`)!;
      const row = this.byAction.get(`knob-${i}`)!;
      const plus = this.byAction.get(`knob-${i}+`)!;
      const knob = page.knobs[i];
      if (!knob) {
        minus.mesh.visible = false;
        row.mesh.visible = false;
        plus.mesh.visible = false;
        continue;
      }
      minus.mesh.visible = true;
      row.mesh.visible = true;
      plus.mesh.visible = true;
      paintButton(minus, '−');
      paintRow(row, knob.label, knob.read(this.params, this.kind));
      paintButton(plus, '+');
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
