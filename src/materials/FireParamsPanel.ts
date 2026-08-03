/**
 * Glanceable world-space fire knobs for XR — same layout language as WorldParamsPanel.
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
import type { GizmoMode } from '../sim/obstacles';
import type { KoraParams } from '../sim/params';

const BTN = { width: 0.09, height: 0.055, gap: 0.008 };
const ROW = { width: 0.34, height: 0.055, gap: 0.008 };
const RES = { width: 320, height: 120 };

/** Above the exhibit strip, matching WorldParamsPanel. */
const PLACEMENT = { y: 1.42, z: -0.48, tilt: 0.32 };

const GIZMO_ORDER: GizmoMode[] = ['translate', 'rotate', 'scale'];
const GIZMO_LABEL: Record<GizmoMode, string> = {
  translate: 'move',
  rotate: 'turn',
  scale: 'size',
};

type StepFn = (params: KoraParams, dir: 1 | -1) => void;

interface Knob {
  label: string;
  read: (params: KoraParams) => string;
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

function buildPages(onGizmoMode: (mode: GizmoMode) => void): Page[] {
  return [
    {
      title: 'burn',
      knobs: [
        {
          label: 'fuel',
          read: (p) => p.sourceAmount.toFixed(2),
          step: (p, d) =>
            stepScalar(() => p.sourceAmount, (v) => { p.sourceAmount = v; }, 0.1, 0, 3, d),
        },
        {
          label: 'burn',
          read: (p) => p.combustionRate.toFixed(0),
          step: (p, d) =>
            stepScalar(() => p.combustionRate, (v) => { p.combustionRate = v; }, 2, 1, 80, d),
        },
        {
          label: 'T src',
          read: (p) => p.sourceTemperature.toFixed(0),
          step: (p, d) =>
            stepScalar(
              () => p.sourceTemperature,
              (v) => { p.sourceTemperature = v; },
              50,
              800,
              2200,
              d,
            ),
        },
      ],
    },
    {
      title: 'smoke',
      knobs: [
        {
          label: 'form',
          read: (p) => p.sootFormationRate.toFixed(1),
          step: (p, d) =>
            stepScalar(
              () => p.sootFormationRate,
              (v) => { p.sootFormationRate = v; },
              0.5,
              0,
              20,
              d,
            ),
        },
        {
          label: 'dens',
          read: (p) => p.sootDensity.toFixed(0),
          step: (p, d) =>
            stepScalar(() => p.sootDensity, (v) => { p.sootDensity = v; }, 20, 0, 600, d),
        },
        {
          label: 'fade',
          read: (p) => p.sootDissipationRate.toFixed(2),
          step: (p, d) =>
            stepScalar(
              () => p.sootDissipationRate,
              (v) => { p.sootDissipationRate = v; },
              0.02,
              0,
              1,
              d,
            ),
        },
      ],
    },
    {
      title: 'look',
      knobs: [
        {
          label: 'exp',
          read: (p) => p.exposure.toFixed(2),
          step: (p, d) =>
            stepScalar(() => p.exposure, (v) => { p.exposure = v; }, 0.05, 0.05, 4, d),
        },
        {
          label: 'flame',
          read: (p) => p.flameIntensity.toFixed(2),
          step: (p, d) =>
            stepScalar(() => p.flameIntensity, (v) => { p.flameIntensity = v; }, 0.1, 0.1, 4, d),
        },
        {
          label: 'hollow',
          read: (p) => p.hollowFlame.toFixed(2),
          step: (p, d) =>
            stepScalar(() => p.hollowFlame, (v) => { p.hollowFlame = v; }, 0.05, 0, 1, d),
        },
      ],
    },
    {
      title: 'tool',
      knobs: [
        {
          label: 'gizmo',
          read: (p) => GIZMO_LABEL[p.gizmoMode],
          step: (p, d) => {
            const i = GIZMO_ORDER.indexOf(p.gizmoMode);
            const next = GIZMO_ORDER[(i + (d === 1 ? 1 : GIZMO_ORDER.length - 1)) % GIZMO_ORDER.length]!;
            p.gizmoMode = next;
            onGizmoMode(next);
          },
        },
        {
          label: 'speed',
          read: (p) => p.sourceSpeed.toFixed(1),
          step: (p, d) =>
            stepScalar(() => p.sourceSpeed, (v) => { p.sourceSpeed = v; }, 0.25, 0, 8, d),
        },
        {
          label: 'bloom',
          read: (p) => p.bloom.toFixed(2),
          step: (p, d) => stepScalar(() => p.bloom, (v) => { p.bloom = v; }, 0.05, 0, 2, d),
        },
      ],
    },
  ];
}

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
  mesh.name = `fire-params-${action}`;
  return { mesh, texture, canvas, action };
}

export class FireParamsPanel {
  readonly group = new Group();
  private readonly widgets: Widget[] = [];
  private readonly byAction = new Map<string, Widget>();
  private readonly pages: Page[];
  private pageIndex = 0;
  private getParams: () => KoraParams;
  private onChange: (() => void) | null = null;

  constructor(getParams: () => KoraParams, onGizmoMode: (mode: GizmoMode) => void) {
    this.getParams = getParams;
    this.pages = buildPages(onGizmoMode);

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

  setOnChange(handler: () => void): void {
    this.onChange = handler;
  }

  refresh(): void {
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
    if (w.action === 'page-title' || /^knob-\d+$/.test(w.action)) return true;

    const m = /^knob-(\d+)([+-])$/.exec(w.action);
    if (!m) return true;
    const idx = Number(m[1]);
    const dir = m[2] === '+' ? 1 : (-1 as const);
    const knob = this.pages[this.pageIndex].knobs[idx];
    if (!knob) return true;
    knob.step(this.getParams(), dir);
    this.onChange?.();
    this.repaint();
    return true;
  }

  private repaint(): void {
    const page = this.pages[this.pageIndex];
    const params = this.getParams();
    paintButton(this.byAction.get('page-prev')!, '‹');
    paintButton(this.byAction.get('page-title')!, `${page.title} · fire`);
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
      paintRow(row, knob.label, knob.read(params));
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
