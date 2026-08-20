import * as THREE from 'three';
import { PhysicsEngine } from '../physics/PhysicsEngine';
import {
  createTrackedBodyVisualSet,
  type TrackedBodyVisualSet,
} from './trackedBodyVisuals';
import type { TrackedSpringVisualSet } from './trackedSpringVisuals';
import {
  DOMINO_BLENDER_THREE_BOXES_DATA,
  DOMINO_RENDER_SCENES_DATA,
} from './dominoSceneData';

type Vec2 = {
  x: number;
  z: number;
};

type DominoVariantKey = 'large' | 'standard' | 'small';

type DominoPlacement = {
  position: [number, number, number];
  quaternion: [number, number, number, number];
  variant: DominoVariantKey;
  halfExtents?: [number, number, number];
  color: number;
};

type BlockColorContext = {
  block: TechniqueBlock;
  module: TechniqueModule;
  index: number;
  normalizedT: number;
};

type DominoVariant = {
  halfExtents: [number, number, number];
  mass: number;
  friction: number;
  spacing: number;
};

type Triangle2 = [Vec2, Vec2, Vec2];
type BoundarySide = 'north' | 'south' | 'east' | 'west';
type Rect2 = {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
};

type TechniqueSlug =
  | 'straight-line'
  | 'straight-double-line'
  | 'curve'
  | 'double-curve'
  | 'split'
  | 'double-split'
  | 'field-starter'
  | 'triangle'
  | 'spiral'
  | 'double-spiral'
  | 'elegant-splitting'
  | 'split-ends'
  | 'small-triangles';

type RawTechniqueBlock = {
  x: number;
  y: number;
  w: number;
  h: number;
  angle: number;
};

type RawTechniqueScene = {
  slug: string;
  top_extract?: {
    blocks: RawTechniqueBlock[];
  };
  connection_blocks?: Array<number | 'min_x' | 'max_x' | 'min_y' | 'max_y'>;
  three_boxes?: {
    manual_boxes?: Array<{
      count: number;
      x_cm: number;
      step_x_cm?: number;
      z_cm: number;
      y_cm: number;
      yaw_deg: number;
      pose: 'upright' | 'flat';
      material?: string;
    }>;
  };
};

type TechniqueBlock = {
  x: number;
  z: number;
  yaw: number;
};

type TechniqueModule = {
  slug: TechniqueSlug;
  blocks: TechniqueBlock[];
  connectionBlockIndices: Set<number>;
  explicitConnectors: Partial<Record<BoundarySide, ConnectorPoint[]>>;
  bounds: Rect2 & {
    width: number;
    depth: number;
  };
};

type ConnectorPoint = {
  position: Vec2;
  normal: Vec2;
};

type TechniqueModulePlacementOptions = {
  origin: Vec2;
  rotation?: number;
  scale?: number | Vec2;
  variant: DominoVariantKey;
  colorer: (t: number) => number;
  blockColor?: (context: BlockColorContext) => number;
  entry?: { side: BoundarySide; groups: number; offset?: number };
  exits?: { side: BoundarySide; groups: number; offset?: number };
};

type TechniqueModuleStamp = {
  entry: ConnectorPoint | null;
  exits: ConnectorPoint[];
  reservedBounds: Rect2;
};

export type DominoDemoResult = {
  trackedVisualSets: TrackedBodyVisualSet[];
  trackedSpringVisualSets: TrackedSpringVisualSet[];
  dominoCount: number;
};

type DominoSceneVariant = 'base' | 'advanced';

const DOMINO_VARIANTS: Record<DominoVariantKey, DominoVariant> = {
  large: {
    halfExtents: [0.085, 0.66, 0.30],
    mass: 0.34,
    friction: 0.66,
    spacing: 0.34,
  },
  standard: {
    halfExtents: [0.065, 0.52, 0.24],
    mass: 0.22,
    friction: 0.62,
    spacing: 0.26,
  },
  small: {
    halfExtents: [0.045, 0.34, 0.17],
    mass: 0.10,
    friction: 0.58,
    spacing: 0.20,
  },
};

const TECHNIQUE_SLUGS: TechniqueSlug[] = [
  'straight-line',
  'straight-double-line',
  'curve',
  'double-curve',
  'split',
  'double-split',
  'field-starter',
  'triangle',
  'spiral',
  'double-spiral',
  'elegant-splitting',
  'split-ends',
  'small-triangles',
];

const TECHNIQUE_TARGET_DOMINO_SPAN = DOMINO_VARIANTS.standard.halfExtents[2] * 2.35;
const DOMINO_FIELD_GRAY = 0x87919b;
const DOMINO_FIELD_DARK = 0x5d6872;
const CONNECTOR_RED = 0xcc3333;
const SVG_LOGO_COLORS = [0x005a9c, 0x0066b0, 0x0076cc, 0x0086e8, 0x0093ff] as const;
const SVG_LOGO_SAMPLE_BOUNDS = {
  minX: 24.74,
  maxX: 686.991,
  minY: 87.0,
  maxY: 504.0,
};
const LOGO_SCALE = 0.072;
const LOGO_CENTER = { x: 0.0, z: -64.0 };
const DOMINO_EXPORT_WORLD_SCALE_XZ = (DOMINO_VARIANTS.standard.halfExtents[2] * 2.0) / 2.4;
const DOMINO_EXPORT_WORLD_SCALE_Y = (DOMINO_VARIANTS.standard.halfExtents[1] * 2.0) / 4.8;
const IMPORTED_DOMINO_WORLD_SCALE = (DOMINO_VARIANTS.standard.halfExtents[1] * 2.0) / 4.8;

const LOCAL_X = new THREE.Vector3(1.0, 0.0, 0.0);
const WORLD_UP = new THREE.Vector3(0.0, 1.0, 0.0);
const WORLD_FORWARD = new THREE.Vector3(0.0, 0.0, 1.0);
const TEMP_QUATERNION = new THREE.Quaternion();
const TEMP_BOX_CENTER = new THREE.Vector3();
const TEMP_BOX_CORNER = new THREE.Vector3();

function vec2(x: number, z: number): Vec2 {
  return { x, z };
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function lerpVec2(a: Vec2, b: Vec2, t: number): Vec2 {
  return {
    x: lerp(a.x, b.x, t),
    z: lerp(a.z, b.z, t),
  };
}

function addVec2(a: Vec2, b: Vec2): Vec2 {
  return {
    x: a.x + b.x,
    z: a.z + b.z,
  };
}

function scaleVec2(value: Vec2, scalar: number): Vec2 {
  return {
    x: value.x * scalar,
    z: value.z * scalar,
  };
}

function angleOfVec2(value: Vec2): number {
  return Math.atan2(value.z, value.x);
}

function dotVec2(a: Vec2, b: Vec2): number {
  return a.x * b.x + a.z * b.z;
}

function rotatePoint(point: Vec2, angle: number): Vec2 {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return {
    x: point.x * c - point.z * s,
    z: point.x * s + point.z * c,
  };
}

function normalizeModuleScale(scale: number | Vec2): Vec2 {
  return typeof scale === 'number' ? vec2(scale, scale) : scale;
}

function transformPoint(local: Vec2, origin: Vec2, rotation: number, scale: number | Vec2): Vec2 {
  const moduleScale = normalizeModuleScale(scale);
  const scaledLocal = vec2(local.x * moduleScale.x, local.z * moduleScale.z);
  const rotated = rotatePoint(scaledLocal, rotation);
  return {
    x: origin.x + rotated.x,
    z: origin.z + rotated.z,
  };
}

function rotateVector(local: Vec2, angle: number): Vec2 {
  return rotatePoint(local, angle);
}

function hueColor(hue: number, saturation: number, lightness: number): number {
  return new THREE.Color().setHSL(hue, saturation, lightness).getHex();
}

function makeHueRamp(startHue: number, endHue: number, saturation = 0.78, lightness = 0.58): (t: number) => number {
  return (t: number) => hueColor(lerp(startHue, endHue, t), saturation, lightness);
}

function quantizeKey(x: number, z: number, y: number): string {
  return `${Math.round(x * 20)}:${Math.round(z * 20)}:${Math.round(y * 10)}`;
}

function sampleLine(start: Vec2, end: Vec2, maxStep: number): Vec2[] {
  const distance = Math.hypot(end.x - start.x, end.z - start.z);
  const steps = Math.max(1, Math.ceil(distance / maxStep));
  const points: Vec2[] = [];
  for (let i = 0; i <= steps; i++) {
    points.push(lerpVec2(start, end, i / steps));
  }
  return points;
}

function sampleQuadraticCurve(start: Vec2, control: Vec2, end: Vec2, maxStep: number): Vec2[] {
  const controlPolygonLength = Math.hypot(control.x - start.x, control.z - start.z)
    + Math.hypot(end.x - control.x, end.z - control.z);
  const steps = Math.max(12, Math.ceil(controlPolygonLength / maxStep));
  const points: Vec2[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const a = lerpVec2(start, control, t);
    const b = lerpVec2(control, end, t);
    points.push(lerpVec2(a, b, t));
  }
  return points;
}

function appendPolyline(target: Vec2[], segment: Vec2[]): void {
  for (let i = 0; i < segment.length; i++) {
    if (target.length > 0 && i === 0) continue;
    target.push(segment[i]);
  }
}

function transformStroke(points: Vec2[], origin: Vec2, scale: number): Vec2[] {
  return points.map((point) => ({
    x: origin.x + point.x * scale,
    z: origin.z + point.z * scale,
  }));
}

function inflateRect(rect: Rect2, amount: number): Rect2 {
  return {
    minX: rect.minX - amount,
    maxX: rect.maxX + amount,
    minZ: rect.minZ - amount,
    maxZ: rect.maxZ + amount,
  };
}

function rectsIntersect(a: Rect2, b: Rect2): boolean {
  return !(a.maxX <= b.minX || a.minX >= b.maxX || a.maxZ <= b.minZ || a.minZ >= b.maxZ);
}

function transformRect(rect: Rect2, origin: Vec2, rotation: number, scale: number | Vec2): Rect2 {
  const corners = [
    transformPoint(vec2(rect.minX, rect.minZ), origin, rotation, scale),
    transformPoint(vec2(rect.maxX, rect.minZ), origin, rotation, scale),
    transformPoint(vec2(rect.maxX, rect.maxZ), origin, rotation, scale),
    transformPoint(vec2(rect.minX, rect.maxZ), origin, rotation, scale),
  ];

  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (const corner of corners) {
    minX = Math.min(minX, corner.x);
    maxX = Math.max(maxX, corner.x);
    minZ = Math.min(minZ, corner.z);
    maxZ = Math.max(maxZ, corner.z);
  }
  return { minX, maxX, minZ, maxZ };
}

function registerReservedBounds(
  name: string,
  rect: Rect2,
  reservedBounds: Array<{ name: string; rect: Rect2 }>,
): void {
  for (const existing of reservedBounds) {
    if (rectsIntersect(rect, existing.rect)) {
      throw new Error(`Domino technique overlap: ${name} intersects ${existing.name}`);
    }
  }
  reservedBounds.push({ name, rect });
}

function buildWordPath(origin: Vec2, letterScale: number, gap: number): Vec2[] {
  const letters: Array<Vec2[]> = [
    [vec2(0.0, 1.6), vec2(0.18, 0.0), vec2(0.5, 0.9), vec2(0.82, 0.0), vec2(1.0, 1.6)],
    [vec2(1.0, 1.6), vec2(0.0, 1.6), vec2(0.0, 0.0), vec2(1.0, 0.0), vec2(0.0, 0.0), vec2(0.0, 0.8), vec2(0.76, 0.8)],
    [vec2(0.0, 0.0), vec2(0.0, 1.6), vec2(0.72, 1.4), vec2(0.82, 1.12), vec2(0.72, 0.88), vec2(0.0, 0.82), vec2(0.72, 0.72), vec2(0.84, 0.44), vec2(0.72, 0.16), vec2(0.0, 0.0)],
    [vec2(1.0, 1.3), vec2(0.72, 1.6), vec2(0.2, 1.6), vec2(0.0, 1.3), vec2(0.0, 0.3), vec2(0.2, 0.0), vec2(0.82, 0.0), vec2(1.0, 0.3), vec2(1.0, 0.72), vec2(0.56, 0.72)],
    [vec2(0.0, 0.0), vec2(0.0, 1.6), vec2(0.74, 1.6), vec2(0.96, 1.34), vec2(0.96, 1.02), vec2(0.74, 0.8), vec2(0.0, 0.8)],
    [vec2(0.0, 1.6), vec2(0.0, 0.34), vec2(0.2, 0.0), vec2(0.8, 0.0), vec2(1.0, 0.34), vec2(1.0, 1.6)],
  ];

  const path: Vec2[] = [];
  let cursorX = origin.x;
  for (let i = 0; i < letters.length; i++) {
    const letterPath = transformStroke(letters[i], vec2(cursorX, origin.z), letterScale);
    if (path.length > 0) {
      appendPolyline(path, sampleLine(path[path.length - 1], letterPath[0], 0.06));
    }
    appendPolyline(path, letterPath);
    cursorX += letterScale + gap;
  }
  return path;
}

function getPathBounds(points: Vec2[]): { minX: number; maxX: number; minZ: number; maxZ: number } {
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (const point of points) {
    minX = Math.min(minX, point.x);
    maxX = Math.max(maxX, point.x);
    minZ = Math.min(minZ, point.z);
    maxZ = Math.max(maxZ, point.z);
  }
  return { minX, maxX, minZ, maxZ };
}

function svgToWorld(x: number, y: number): Vec2 {
  return {
    x: (x - 384.0) * LOGO_SCALE + LOGO_CENTER.x,
    z: (384.0 - y) * LOGO_SCALE + LOGO_CENTER.z,
  };
}

function buildLogoTriangles(): Triangle2[] {
  return [
    [
      svgToWorld(265.5, 504.0),
      svgToWorld(24.74, 87.0),
      svgToWorld(506.25, 87.0),
    ],
    [
      svgToWorld(506.26, 87.0),
      svgToWorld(385.88, 295.5),
      svgToWorld(626.64, 295.498),
    ],
    [
      svgToWorld(506.26, 504.0),
      svgToWorld(385.88, 295.5),
      svgToWorld(626.64, 295.498),
    ],
    [
      svgToWorld(626.63, 295.5),
      svgToWorld(566.441, 191.25),
      svgToWorld(686.991, 191.25),
    ],
    [
      svgToWorld(626.63, 87.001),
      svgToWorld(566.441, 191.251),
      svgToWorld(686.991, 191.251),
    ],
  ];
}

function buildTriangleOutlinePath(triangle: Triangle2): Vec2[] {
  return [triangle[0], triangle[1], triangle[2], triangle[0]];
}

function pointInTriangleXY(
  point: { x: number; y: number },
  triangle: [{ x: number; y: number }, { x: number; y: number }, { x: number; y: number }],
): boolean {
  const [a, b, c] = triangle;
  const ab = (point.x - b.x) * (a.y - b.y) - (a.x - b.x) * (point.y - b.y);
  const bc = (point.x - c.x) * (b.y - c.y) - (b.x - c.x) * (point.y - c.y);
  const ca = (point.x - a.x) * (c.y - a.y) - (c.x - a.x) * (point.y - a.y);
  const hasNeg = ab < 0 || bc < 0 || ca < 0;
  const hasPos = ab > 0 || bc > 0 || ca > 0;
  return !(hasNeg && hasPos);
}

function sampleWebGpuLogoColorFromNormalized(u: number, v: number): number {
  const x = lerp(SVG_LOGO_SAMPLE_BOUNDS.minX, SVG_LOGO_SAMPLE_BOUNDS.maxX, THREE.MathUtils.clamp(u, 0.0, 1.0));
  const y = lerp(SVG_LOGO_SAMPLE_BOUNDS.minY, SVG_LOGO_SAMPLE_BOUNDS.maxY, THREE.MathUtils.clamp(v, 0.0, 1.0));
  const sample = { x, y };
  const triangles = [
    {
      color: SVG_LOGO_COLORS[0],
      triangle: [{ x: 265.5, y: 504.0 }, { x: 24.74, y: 87.0 }, { x: 506.25, y: 87.0 }] as [{ x: number; y: number }, { x: number; y: number }, { x: number; y: number }],
    },
    {
      color: SVG_LOGO_COLORS[1],
      triangle: [{ x: 506.26, y: 87.0 }, { x: 385.88, y: 295.5 }, { x: 626.64, y: 295.498 }] as [{ x: number; y: number }, { x: number; y: number }, { x: number; y: number }],
    },
    {
      color: SVG_LOGO_COLORS[2],
      triangle: [{ x: 506.26, y: 504.0 }, { x: 385.88, y: 295.5 }, { x: 626.64, y: 295.498 }] as [{ x: number; y: number }, { x: number; y: number }, { x: number; y: number }],
    },
    {
      color: SVG_LOGO_COLORS[3],
      triangle: [{ x: 626.63, y: 295.5 }, { x: 566.441, y: 191.25 }, { x: 686.991, y: 191.25 }] as [{ x: number; y: number }, { x: number; y: number }, { x: number; y: number }],
    },
    {
      color: SVG_LOGO_COLORS[4],
      triangle: [{ x: 626.63, y: 87.001 }, { x: 566.441, y: 191.251 }, { x: 686.991, y: 191.251 }] as [{ x: number; y: number }, { x: number; y: number }, { x: number; y: number }],
    },
  ];
  for (const triangle of triangles) {
    if (pointInTriangleXY(sample, triangle.triangle)) {
      return triangle.color;
    }
  }
  return DOMINO_FIELD_GRAY;
}

function makeTriangleTechniqueLogoColorer(
  rowCount: number,
  fanOutStart = 0.0,
): (context: BlockColorContext) => number {
  return ({ block, module }) => {
    const rawU = module.bounds.width > 1e-6
      ? (block.x - module.bounds.minX) / module.bounds.width
      : 0.5;
    const u = THREE.MathUtils.clamp(rawU, 0.0, 1.0);
    const vertical = module.bounds.depth > 1e-6
      ? (module.bounds.maxZ - block.z) / module.bounds.depth
      : 0.5;
    const quantizedV = rowCount > 1
      ? Math.round(THREE.MathUtils.clamp(vertical, 0.0, 1.0) * (rowCount - 1)) / (rowCount - 1)
      : 0.5;
    if (u <= fanOutStart) {
      return DOMINO_FIELD_GRAY;
    }
    const remappedU = fanOutStart < 1.0
      ? THREE.MathUtils.clamp((u - fanOutStart) / (1.0 - fanOutStart), 0.0, 1.0)
      : 1.0;
    return sampleWebGpuLogoColorFromNormalized(1.0 - remappedU, quantizedV);
  };
}

function pointInTriangle(point: Vec2, triangle: Triangle2): boolean {
  const [a, b, c] = triangle;
  const ab = (point.x - b.x) * (a.z - b.z) - (a.x - b.x) * (point.z - b.z);
  const bc = (point.x - c.x) * (b.z - c.z) - (b.x - c.x) * (point.z - c.z);
  const ca = (point.x - a.x) * (c.z - a.z) - (c.x - a.x) * (point.z - a.z);
  const hasNeg = ab < 0 || bc < 0 || ca < 0;
  const hasPos = ab > 0 || bc > 0 || ca > 0;
  return !(hasNeg && hasPos);
}

function distancePointToSegment(point: Vec2, a: Vec2, b: Vec2): number {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const lenSq = dx * dx + dz * dz;
  if (lenSq < 1e-9) return Math.hypot(point.x - a.x, point.z - a.z);
  const t = Math.max(0.0, Math.min(1.0, ((point.x - a.x) * dx + (point.z - a.z) * dz) / lenSq));
  const projX = a.x + dx * t;
  const projZ = a.z + dz * t;
  return Math.hypot(point.x - projX, point.z - projZ);
}

function placeDominoesAlongPolyline(
  points: Vec2[],
  variant: DominoVariantKey,
  color: number | ((index: number) => number),
  target: DominoPlacement[],
): DominoPlacement[] {
  if (points.length < 2) return [];

  const variantSpec = DOMINO_VARIANTS[variant];
  const placements: DominoPlacement[] = [];
  let carry = 0.0;
  let prev = points[0];
  const tangent = new THREE.Vector3();

  for (let i = 1; i < points.length; i++) {
    const next = points[i];
    const dx = next.x - prev.x;
    const dz = next.z - prev.z;
    const segLength = Math.hypot(dx, dz);
    if (segLength < 1e-6) {
      prev = next;
      continue;
    }

    tangent.set(dx / segLength, 0.0, dz / segLength);
    let distanceAlong = carry;
    while (distanceAlong <= segLength) {
      const t = distanceAlong / segLength;
      const x = lerp(prev.x, next.x, t);
      const z = lerp(prev.z, next.z, t);
      TEMP_QUATERNION.setFromUnitVectors(LOCAL_X, tangent);
      const placementIndex = target.length + placements.length;
      placements.push({
        position: [x, variantSpec.halfExtents[1] + 0.002, z],
        quaternion: [TEMP_QUATERNION.x, TEMP_QUATERNION.y, TEMP_QUATERNION.z, TEMP_QUATERNION.w],
        variant,
        color: typeof color === 'function' ? color(placementIndex) : color,
      });
      distanceAlong += variantSpec.spacing;
    }
    carry = distanceAlong - segLength;
    prev = next;
  }

  target.push(...placements);
  return placements;
}

function dedupePlacements(placements: DominoPlacement[]): DominoPlacement[] {
  const seen = new Set<string>();
  const deduped: DominoPlacement[] = [];
  for (const placement of placements) {
    const key = quantizeKey(
      placement.position[0],
      placement.position[2],
      placement.position[1],
    );
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(placement);
  }
  return deduped;
}

function addFieldMask(
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number },
  variant: DominoVariantKey,
  yaw: number,
  contains: (point: Vec2) => boolean,
  color: number | ((index: number) => number),
  target: DominoPlacement[],
): DominoPlacement[] {
  const placements: DominoPlacement[] = [];
  const spec = DOMINO_VARIANTS[variant];
  const xStep = spec.spacing * 1.45;
  const zStep = spec.spacing * 1.28;
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  TEMP_QUATERNION.setFromAxisAngle(new THREE.Vector3(0.0, 1.0, 0.0), yaw);

  let row = 0;
  for (let z = bounds.maxZ; z >= bounds.minZ; z -= zStep) {
    const xOffset = row % 2 === 0 ? 0.0 : xStep * 0.5;
    for (let x = bounds.minX - xStep; x <= bounds.maxX + xStep; x += xStep) {
      const sample = { x: x + xOffset, z };
      if (!contains(sample)) continue;
      const placementIndex = target.length + placements.length;
      placements.push({
        position: [sample.x, spec.halfExtents[1] + 0.002, sample.z],
        quaternion: [TEMP_QUATERNION.x, TEMP_QUATERNION.y, TEMP_QUATERNION.z, TEMP_QUATERNION.w],
        variant,
        color: typeof color === 'function' ? color(placementIndex) : color,
      });
    }
    row++;
  }

  target.push(...placements);
  return placements;
}

function fillTriangleField(
  triangle: Triangle2,
  variant: DominoVariantKey,
  color: number | ((index: number) => number),
  target: DominoPlacement[],
): DominoPlacement[] {
  const minX = Math.min(triangle[0].x, triangle[1].x, triangle[2].x);
  const maxX = Math.max(triangle[0].x, triangle[1].x, triangle[2].x);
  const minZ = Math.min(triangle[0].z, triangle[1].z, triangle[2].z);
  const maxZ = Math.max(triangle[0].z, triangle[1].z, triangle[2].z);
  return addFieldMask(
    { minX, maxX, minZ, maxZ },
    variant,
    0.0,
    (point) => pointInTriangle(point, triangle),
    color,
    target,
  );
}

function fillStrokeField(
  path: Vec2[],
  strokeWidth: number,
  variant: DominoVariantKey,
  color: number | ((index: number) => number),
  target: DominoPlacement[],
): DominoPlacement[] {
  const bounds = getPathBounds(path);
  return addFieldMask(
    {
      minX: bounds.minX - strokeWidth,
      maxX: bounds.maxX + strokeWidth,
      minZ: bounds.minZ - strokeWidth,
      maxZ: bounds.maxZ + strokeWidth,
    },
    variant,
    0.0,
    (point) => {
      for (let i = 0; i < path.length - 1; i++) {
        if (distancePointToSegment(point, path[i], path[i + 1]) <= strokeWidth) {
          return true;
        }
      }
      return false;
    },
    color,
    target,
  );
}

const DOMINO_RENDER_SCENES = DOMINO_RENDER_SCENES_DATA as unknown as RawTechniqueScene[];

function buildTechniqueModules(): Record<TechniqueSlug, TechniqueModule> {
  const modules = {} as Record<TechniqueSlug, TechniqueModule>;

  for (const slug of TECHNIQUE_SLUGS) {
    const scene = DOMINO_RENDER_SCENES.find((candidate) => candidate.slug === slug);
    const blocks = scene?.top_extract?.blocks;
    if (!blocks || blocks.length === 0) {
      throw new Error(`Missing extracted domino layout for technique: ${slug}`);
    }

    const majors = blocks
      .map((block) => Math.max(block.w, block.h))
      .sort((a, b) => a - b);
    const medianMajor = majors[Math.floor(majors.length * 0.5)] ?? 52.0;
    const scale = TECHNIQUE_TARGET_DOMINO_SPAN / medianMajor;

    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const block of blocks) {
      minX = Math.min(minX, block.x);
      maxX = Math.max(maxX, block.x);
      minY = Math.min(minY, block.y);
      maxY = Math.max(maxY, block.y);
    }
    const centerX = (minX + maxX) * 0.5;
    const centerY = (minY + maxY) * 0.5;

    const normalizedBlocks: TechniqueBlock[] = blocks.map((block) => ({
      x: (block.x - centerX) * scale,
      z: -(block.y - centerY) * scale,
      yaw: THREE.MathUtils.degToRad(block.angle - 90.0),
    }));

    let normMinX = Infinity;
    let normMaxX = -Infinity;
    let normMinZ = Infinity;
    let normMaxZ = -Infinity;
    for (const block of normalizedBlocks) {
      normMinX = Math.min(normMinX, block.x);
      normMaxX = Math.max(normMaxX, block.x);
      normMinZ = Math.min(normMinZ, block.z);
      normMaxZ = Math.max(normMaxZ, block.z);
    }

    const connectionBlockIndices = new Set<number>();
    const explicitConnectors: Partial<Record<BoundarySide, ConnectorPoint[]>> = {};
    const resolvedConnectionIndices = new Set<number>();
    for (const connection of scene.connection_blocks ?? []) {
      if (typeof connection === 'number') {
        if (connection >= 0 && connection < normalizedBlocks.length) {
          resolvedConnectionIndices.add(connection);
        }
        continue;
      }

      let boundaryValue = 0.0;
      if (connection === 'min_x') boundaryValue = minX;
      else if (connection === 'max_x') boundaryValue = maxX;
      else if (connection === 'min_y') boundaryValue = minY;
      else if (connection === 'max_y') boundaryValue = maxY;

      for (let i = 0; i < blocks.length; i++) {
        const block = blocks[i];
        const value = connection === 'min_x' || connection === 'max_x' ? block.x : block.y;
        if (Math.abs(value - boundaryValue) <= 1e-3) {
          resolvedConnectionIndices.add(i);
        }
      }
    }

    const groupedBySide: Partial<Record<BoundarySide, number[]>> = {};
    for (const index of resolvedConnectionIndices) {
      connectionBlockIndices.add(index);
      const block = normalizedBlocks[index];
      const distances: Array<[BoundarySide, number]> = [
        ['west', Math.abs(block.x - normMinX)],
        ['east', Math.abs(block.x - normMaxX)],
        ['north', Math.abs(block.z - normMaxZ)],
        ['south', Math.abs(block.z - normMinZ)],
      ];
      distances.sort((lhs, rhs) => lhs[1] - rhs[1]);
      const side = distances[0]?.[0] ?? 'north';
      (groupedBySide[side] ??= []).push(index);
    }

    const outwardBySide: Record<BoundarySide, Vec2> = {
      north: vec2(0.0, 1.0),
      south: vec2(0.0, -1.0),
      east: vec2(1.0, 0.0),
      west: vec2(-1.0, 0.0),
    };
    for (const side of Object.keys(groupedBySide) as BoundarySide[]) {
      const indices = groupedBySide[side] ?? [];
      if (indices.length === 0) continue;
      let avgX = 0.0;
      let avgZ = 0.0;
      for (const index of indices) {
        avgX += normalizedBlocks[index].x;
        avgZ += normalizedBlocks[index].z;
      }
      avgX /= indices.length;
      avgZ /= indices.length;
      explicitConnectors[side] = [{
        position: vec2(avgX, avgZ),
        normal: outwardBySide[side],
      }];
    }

    modules[slug] = {
      slug,
      blocks: normalizedBlocks,
      connectionBlockIndices,
      explicitConnectors,
      bounds: {
        minX: normMinX,
        maxX: normMaxX,
        minZ: normMinZ,
        maxZ: normMaxZ,
        width: normMaxX - normMinX,
        depth: normMaxZ - normMinZ,
      },
    };
  }

  return modules;
}

const TECHNIQUE_MODULES = buildTechniqueModules();

function getBoundaryConnectors(
  module: TechniqueModule,
  side: BoundarySide,
  groups: number,
  offset = 1.15,
): ConnectorPoint[] {
  const explicit = module.explicitConnectors[side];
  if (explicit && explicit.length > 0) {
    return explicit.map((connector) => ({
      position: addVec2(connector.position, scaleVec2(connector.normal, offset)),
      normal: connector.normal,
    }));
  }

  const alongX = side === 'north' || side === 'south';
  const boundary = side === 'north'
    ? module.bounds.maxZ
    : side === 'south'
      ? module.bounds.minZ
      : side === 'east'
        ? module.bounds.maxX
        : module.bounds.minX;
  const band = alongX
    ? Math.max(module.bounds.depth * 0.12, 0.9)
    : Math.max(module.bounds.width * 0.12, 0.9);
  let candidates = module.blocks.filter((block) => {
    if (side === 'north') return block.z >= boundary - band;
    if (side === 'south') return block.z <= boundary + band;
    if (side === 'east') return block.x >= boundary - band;
    return block.x <= boundary + band;
  });
  if (candidates.length === 0) {
    candidates = [...module.blocks];
  }
  candidates.sort((a, b) => (alongX ? a.x - b.x : a.z - b.z));

  const outward = side === 'north'
    ? vec2(0.0, 1.0)
    : side === 'south'
      ? vec2(0.0, -1.0)
      : side === 'east'
        ? vec2(1.0, 0.0)
        : vec2(-1.0, 0.0);

  const anchors: ConnectorPoint[] = [];
  for (let group = 0; group < groups; group++) {
    const start = Math.floor(group * candidates.length / groups);
    const end = Math.max(start + 1, Math.floor((group + 1) * candidates.length / groups));
    const slice = candidates.slice(start, end);
    let avgX = 0.0;
    let avgZ = 0.0;
    for (const block of slice) {
      avgX += block.x;
      avgZ += block.z;
    }
    avgX /= slice.length;
    avgZ /= slice.length;
    if (side === 'north') avgZ = module.bounds.maxZ + offset;
    if (side === 'south') avgZ = module.bounds.minZ - offset;
    if (side === 'east') avgX = module.bounds.maxX + offset;
    if (side === 'west') avgX = module.bounds.minX - offset;
    anchors.push({
      position: { x: avgX, z: avgZ },
      normal: outward,
    });
  }
  return anchors;
}

function stampTechniqueModule(
  slug: TechniqueSlug,
  options: TechniqueModulePlacementOptions,
  target: DominoPlacement[],
): TechniqueModuleStamp {
  const module = TECHNIQUE_MODULES[slug];
  const scale = options.scale ?? 1.0;
  const rotation = options.rotation ?? 0.0;

  for (let i = 0; i < module.blocks.length; i++) {
    const block = module.blocks[i];
    const worldPoint = transformPoint(block, options.origin, rotation, scale);
    TEMP_QUATERNION.setFromAxisAngle(new THREE.Vector3(0.0, 1.0, 0.0), block.yaw + rotation);
    const normalizedT = module.blocks.length <= 1 ? 0.0 : i / (module.blocks.length - 1);
    target.push({
      position: [worldPoint.x, DOMINO_VARIANTS[options.variant].halfExtents[1] + 0.002, worldPoint.z],
      quaternion: [TEMP_QUATERNION.x, TEMP_QUATERNION.y, TEMP_QUATERNION.z, TEMP_QUATERNION.w],
      variant: options.variant,
      color: module.connectionBlockIndices.has(i)
        ? CONNECTOR_RED
        : options.blockColor
          ? options.blockColor({ block, module, index: i, normalizedT })
          : options.colorer(normalizedT),
    });
  }

  const reservePadding = DOMINO_VARIANTS[options.variant].spacing * 2.2;
  const reservedBounds = inflateRect(
    transformRect(module.bounds, options.origin, rotation, scale),
    reservePadding,
  );

  const entry = options.entry
    ? (() => {
      const connector = getBoundaryConnectors(module, options.entry.side, options.entry.groups, options.entry.offset)[0];
      if (!connector) return null;
      return {
        position: transformPoint(connector.position, options.origin, rotation, scale),
        normal: rotateVector(connector.normal, rotation),
      };
    })()
    : null;
  const exits = options.exits
    ? getBoundaryConnectors(module, options.exits.side, options.exits.groups, options.exits.offset)
      .map((connector) => ({
        position: transformPoint(connector.position, options.origin, rotation, scale),
        normal: rotateVector(connector.normal, rotation),
      }))
    : [];
  exits.sort((a, b) => a.position.x - b.position.x || b.position.z - a.position.z);

  return { entry, exits, reservedBounds };
}

function makeConnector(position: Vec2, normal: Vec2): ConnectorPoint {
  return { position, normal };
}

function connectAnchors(
  start: ConnectorPoint,
  end: ConnectorPoint,
  variant: DominoVariantKey,
  color: number | ((index: number) => number),
  target: DominoPlacement[],
  bend = 0.0,
): DominoPlacement[] {
  const lift = DOMINO_VARIANTS[variant].spacing * 2.2;
  const liftedStart = addVec2(start.position, scaleVec2(start.normal, lift));
  const liftedEnd = addVec2(end.position, scaleVec2(end.normal, lift));
  const dx = liftedEnd.x - liftedStart.x;
  const dz = liftedEnd.z - liftedStart.z;
  const length = Math.hypot(dx, dz);
  const control = length > 1e-6
    ? vec2(
      (liftedStart.x + liftedEnd.x) * 0.5 + (-dz / length) * bend,
      (liftedStart.z + liftedEnd.z) * 0.5 + (dx / length) * bend,
    )
    : vec2((liftedStart.x + liftedEnd.x) * 0.5, (liftedStart.z + liftedEnd.z) * 0.5);
  const path: Vec2[] = [start.position];
  appendPolyline(path, sampleLine(start.position, liftedStart, DOMINO_VARIANTS[variant].spacing * 0.35));
  appendPolyline(path, sampleQuadraticCurve(liftedStart, control, liftedEnd, DOMINO_VARIANTS[variant].spacing * 0.4));
  appendPolyline(path, sampleLine(liftedEnd, end.position, DOMINO_VARIANTS[variant].spacing * 0.35));
  return placeDominoesAlongPolyline(path, variant, color, target);
}

function addStarterStacks(starterPlacements: DominoPlacement[], target: DominoPlacement[]): void {
  const large = DOMINO_VARIANTS.large;
  const standard = DOMINO_VARIANTS.standard;
  const small = DOMINO_VARIANTS.small;
  for (let i = 5; i < Math.min(110, starterPlacements.length); i += 4) {
    const base = starterPlacements[i];
      target.push({
        position: [
          base.position[0],
          large.halfExtents[1] * 2.0 + standard.halfExtents[1] + 0.004,
          base.position[2],
        ],
        quaternion: base.quaternion,
        variant: 'standard',
        color: base.color,
      });
    if (i % 8 === 1) {
      target.push({
        position: [
          base.position[0],
          large.halfExtents[1] * 2.0 + standard.halfExtents[1] * 2.0 + small.halfExtents[1] + 0.006,
          base.position[2],
        ],
        quaternion: base.quaternion,
        variant: 'small',
        color: base.color,
      });
    }
  }
}

function getLocalConnector(
  slug: TechniqueSlug,
  side: BoundarySide,
): ConnectorPoint {
  const module = TECHNIQUE_MODULES[slug];
  return getBoundaryConnectors(module, side, 1, 0.0)[0] ?? {
    position: vec2(0.0, 0.0),
    normal: side === 'north'
      ? vec2(0.0, 1.0)
      : side === 'south'
        ? vec2(0.0, -1.0)
        : side === 'east'
          ? vec2(1.0, 0.0)
          : vec2(-1.0, 0.0),
  };
}

function computeOriginForConnectorAttachment(
  slug: TechniqueSlug,
  localSide: BoundarySide,
  worldConnectorPosition: Vec2,
  rotation: number,
  scale: number | Vec2,
): Vec2 {
  const localConnector = getLocalConnector(slug, localSide);
  const moduleScale = normalizeModuleScale(scale);
  const rotated = rotatePoint(
    vec2(localConnector.position.x * moduleScale.x, localConnector.position.z * moduleScale.z),
    rotation,
  );
  return vec2(
    worldConnectorPosition.x - rotated.x,
    worldConnectorPosition.z - rotated.z,
  );
}

function getStampedConnector(
  slug: TechniqueSlug,
  side: BoundarySide,
  origin: Vec2,
  rotation: number,
  scale: number | Vec2,
): ConnectorPoint {
  const localConnector = getLocalConnector(slug, side);
  return {
    position: transformPoint(localConnector.position, origin, rotation, scale),
    normal: rotateVector(localConnector.normal, rotation),
  };
}

function pickConnectorByDirection(connectors: ConnectorPoint[], targetNormal: Vec2): ConnectorPoint {
  let best = connectors[0];
  let bestDot = -Infinity;
  for (const connector of connectors) {
    const dot = dotVec2(connector.normal, targetNormal);
    if (dot > bestDot) {
      bestDot = dot;
      best = connector;
    }
  }
  return best;
}

function oppositeBoundarySide(side: BoundarySide): BoundarySide {
  if (side === 'north') return 'south';
  if (side === 'south') return 'north';
  if (side === 'east') return 'west';
  return 'east';
}

function computeRotationForConnectorFacing(
  slug: TechniqueSlug,
  localSide: BoundarySide,
  worldNormal: Vec2,
  extraRotation = 0.0,
): number {
  const localConnector = getLocalConnector(slug, localSide);
  return angleOfVec2(worldNormal) - angleOfVec2(localConnector.normal) + extraRotation;
}

function computeRotationForConnectorMatch(
  slug: TechniqueSlug,
  localSide: BoundarySide,
  targetNormal: Vec2,
  extraRotation = 0.0,
): number {
  const localConnector = getLocalConnector(slug, localSide);
  return angleOfVec2(scaleVec2(targetNormal, -1.0)) - angleOfVec2(localConnector.normal) + extraRotation;
}

function buildTriangleStripePaths(triangle: Triangle2, stripeCount: number): Vec2[][] {
  const edges: Array<{ a: Vec2; b: Vec2; length: number; opposite: Vec2 }> = [
    { a: triangle[0], b: triangle[1], length: Math.hypot(triangle[1].x - triangle[0].x, triangle[1].z - triangle[0].z), opposite: triangle[2] },
    { a: triangle[1], b: triangle[2], length: Math.hypot(triangle[2].x - triangle[1].x, triangle[2].z - triangle[1].z), opposite: triangle[0] },
    { a: triangle[2], b: triangle[0], length: Math.hypot(triangle[0].x - triangle[2].x, triangle[0].z - triangle[2].z), opposite: triangle[1] },
  ];
  edges.sort((lhs, rhs) => rhs.length - lhs.length);
  const base = edges[0];
  const stripes: Vec2[][] = [];
  for (let i = 1; i <= stripeCount; i++) {
    const t = i / (stripeCount + 1);
    stripes.push([
      lerpVec2(base.opposite, base.a, t),
      lerpVec2(base.opposite, base.b, t),
    ]);
  }
  return stripes;
}

const IMPORTED_BLENDER_THREE_BOXES = DOMINO_BLENDER_THREE_BOXES_DATA as unknown as Record<string, number[][]>;

type ImportedStructureSlug = '2d-pyramid' | '3d-pyramid';

type ImportedThreeBox = {
  x: number;
  y: number;
  z: number;
  w: number;
  h: number;
  d: number;
  quaternion: [number, number, number, number];
};

function importedBoxQuaternion(box: ImportedThreeBox): THREE.Quaternion {
  return TEMP_QUATERNION.set(
    box.quaternion[0],
    box.quaternion[1],
    box.quaternion[2],
    box.quaternion[3],
  ).normalize();
}

function getCenteredImportedBoxes(
  slug: ImportedStructureSlug,
): ImportedThreeBox[] {
  const rows = IMPORTED_BLENDER_THREE_BOXES[slug] ?? [];
  if (rows.length === 0) {
    throw new Error(`Missing imported blender three-box data for ${slug}`);
  }
  const boxes: ImportedThreeBox[] = rows.map((row) => ({
    x: Number(row[0] ?? 0),
    y: Number(row[1] ?? 0),
    z: Number(row[2] ?? 0),
    w: Number(row[3] ?? 0),
    h: Number(row[4] ?? 0),
    d: Number(row[5] ?? 0),
    quaternion: [
      Number(row[6] ?? 0),
      Number(row[7] ?? 0),
      Number(row[8] ?? 0),
      Number(row[9] ?? 1),
    ] as [number, number, number, number],
  }));

  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (const box of boxes) {
    const rotation = importedBoxQuaternion(box);
    const halfW = box.w * 0.5;
    const halfH = box.h * 0.5;
    const halfD = box.d * 0.5;
    TEMP_BOX_CENTER.set(box.x, box.y, box.z);
    for (const sx of [-1, 1] as const) {
      for (const sy of [-1, 1] as const) {
        for (const sz of [-1, 1] as const) {
          TEMP_BOX_CORNER.set(sx * halfW, sy * halfH, sz * halfD)
            .applyQuaternion(rotation)
            .add(TEMP_BOX_CENTER);
          minX = Math.min(minX, TEMP_BOX_CORNER.x);
          maxX = Math.max(maxX, TEMP_BOX_CORNER.x);
          minZ = Math.min(minZ, TEMP_BOX_CORNER.z);
          maxZ = Math.max(maxZ, TEMP_BOX_CORNER.z);
        }
      }
    }
  }
  const centerX = (minX + maxX) * 0.5;
  const centerZ = (minZ + maxZ) * 0.5;

  return boxes.map((box) => ({
    ...box,
    x: box.x - centerX,
    z: box.z - centerZ,
  }));
}

function addImportedStructurePlacements(
  slug: ImportedStructureSlug,
  origin: Vec2,
  rotation: number,
  colorer: (t: number) => number,
  target: DominoPlacement[],
): void {
  const boxes = getCenteredImportedBoxes(slug);
  const rotationQuaternion = new THREE.Quaternion().setFromAxisAngle(WORLD_UP, rotation);

  for (let i = 0; i < boxes.length; i++) {
    const box = boxes[i];
    const t = boxes.length <= 1 ? 0.0 : i / (boxes.length - 1);
    const localPosition = vec2(
      box.x * IMPORTED_DOMINO_WORLD_SCALE,
      box.z * IMPORTED_DOMINO_WORLD_SCALE,
    );
    const worldPosition = transformPoint(localPosition, origin, rotation, 1.0);
    const localQuaternion = new THREE.Quaternion(
      box.quaternion[0],
      box.quaternion[1],
      box.quaternion[2],
      box.quaternion[3],
    ).normalize();
    const worldQuaternion = rotationQuaternion.clone().multiply(localQuaternion);
    const halfExtents: [number, number, number] = [
      box.w * IMPORTED_DOMINO_WORLD_SCALE * 0.5,
      box.h * IMPORTED_DOMINO_WORLD_SCALE * 0.5,
      box.d * IMPORTED_DOMINO_WORLD_SCALE * 0.5,
    ];
    target.push({
      position: [worldPosition.x, box.y * IMPORTED_DOMINO_WORLD_SCALE, worldPosition.z],
      quaternion: [worldQuaternion.x, worldQuaternion.y, worldQuaternion.z, worldQuaternion.w],
      variant: 'standard',
      halfExtents,
      color: colorer(t),
    });
  }
}

function addManualSpeedWallPlacements(
  origin: Vec2,
  rotation: number,
  colorer: (t: number) => number,
  target: DominoPlacement[],
): void {
  const scene = DOMINO_RENDER_SCENES.find((candidate) => candidate.slug === 'speed-wall');
  const manualBoxes = scene?.three_boxes?.manual_boxes ?? [];
  if (manualBoxes.length === 0) {
    throw new Error('Missing manual domino layout for speed-wall');
  }

  const uprightHalfXcm = 0.75 * 0.5;
  const uprightHalfZcm = 2.4 * 0.5;
  const flatHalfXcm = 4.8 * 0.5;
  const flatHalfZcm = 2.4 * 0.5;

  const expanded: Array<{
    xCm: number;
    yCm: number;
    zCm: number;
    pose: 'upright' | 'flat';
  }> = [];

  for (const run of manualBoxes) {
    const count = Math.max(0, Math.floor(run.count ?? 0));
    const stepX = Number(run.step_x_cm ?? 0);
    const baseX = Number(run.x_cm ?? 0);
    const yCm = Number(run.y_cm ?? 0);
    const zCm = Number(run.z_cm ?? 0);
    const pose = run.pose === 'flat' ? 'flat' : 'upright';
    for (let i = 0; i < count; i++) {
      expanded.push({
        xCm: baseX + i * stepX,
        yCm,
        zCm,
        pose,
      });
    }
  }

  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (const box of expanded) {
    const halfX = box.pose === 'flat' ? flatHalfXcm : uprightHalfXcm;
    const halfZ = box.pose === 'flat' ? flatHalfZcm : uprightHalfZcm;
    minX = Math.min(minX, box.xCm - halfX);
    maxX = Math.max(maxX, box.xCm + halfX);
    minZ = Math.min(minZ, box.zCm - halfZ);
    maxZ = Math.max(maxZ, box.zCm + halfZ);
  }
  const centerX = (minX + maxX) * 0.5;
  const centerZ = (minZ + maxZ) * 0.5;

  const rotationQuaternion = new THREE.Quaternion().setFromAxisAngle(WORLD_UP, rotation);
  const uprightQuaternion = new THREE.Quaternion();
  const flatQuaternion = new THREE.Quaternion().setFromAxisAngle(WORLD_FORWARD, -Math.PI * 0.5);

  for (let i = 0; i < expanded.length; i++) {
    const box = expanded[i];
    const t = expanded.length <= 1 ? 0.0 : i / (expanded.length - 1);
    const localPosition = vec2(
      (box.xCm - centerX) * DOMINO_EXPORT_WORLD_SCALE_XZ,
      (box.zCm - centerZ) * DOMINO_EXPORT_WORLD_SCALE_XZ,
    );
    const worldPosition = transformPoint(localPosition, origin, rotation, 1.0);
    const localQuaternion = box.pose === 'flat' ? flatQuaternion : uprightQuaternion;
    const worldQuaternion = rotationQuaternion.clone().multiply(localQuaternion);
    target.push({
      position: [worldPosition.x, box.yCm * DOMINO_EXPORT_WORLD_SCALE_Y, worldPosition.z],
      quaternion: [worldQuaternion.x, worldQuaternion.y, worldQuaternion.z, worldQuaternion.w],
      variant: 'standard',
      color: colorer(t),
    });
  }
}

function buildDominoPlacements(variant: DominoSceneVariant): DominoPlacement[] {
  const placements: DominoPlacement[] = [];
  const pyramid2dColor = makeHueRamp(0.02, 0.09, 0.80, 0.62);
  const pyramid3dColor = makeHueRamp(0.56, 0.66, 0.76, 0.60);
  const speedWallColor = makeHueRamp(0.12, 0.18, 0.74, 0.56);

  if (variant === 'advanced') {
    addImportedStructurePlacements(
      '2d-pyramid',
      vec2(-32.0, 2.5),
      0.0,
      pyramid2dColor,
      placements,
    );
    addManualSpeedWallPlacements(
      vec2(0.0, 10.0),
      Math.PI * 0.5,
      speedWallColor,
      placements,
    );
    addImportedStructurePlacements(
      '3d-pyramid',
      vec2(30.0, 2.0),
      0.0,
      pyramid3dColor,
      placements,
    );
    return dedupePlacements(placements);
  }

  const rootColor = makeHueRamp(0.53, 0.58, 0.76, 0.60);
  const lineColor = makeHueRamp(0.11, 0.16, 0.80, 0.62);
  const spiralLeftColor = makeHueRamp(0.86, 0.96, 0.82, 0.60);
  const spiralRightColor = makeHueRamp(0.58, 0.70, 0.78, 0.60);
  const starterColor = makeHueRamp(0.06, 0.10, 0.84, 0.64);

  const stampModule = (
    _name: string,
    slug: TechniqueSlug,
    options: TechniqueModulePlacementOptions,
  ): TechniqueModuleStamp => {
    return stampTechniqueModule(slug, options, placements);
  };
  const connectorGap = DOMINO_VARIANTS.standard.spacing * 1.25;

  const rootOrigin = vec2(0.0, 14.0);
  const rootRotation = 0.0;
  const rootScale = 1.14;
  stampModule('root-double-split', 'double-split', {
    origin: rootOrigin,
    rotation: rootRotation,
    scale: rootScale,
    variant: 'standard',
    colorer: rootColor,
  });

  const rootNorth = getStampedConnector('double-split', 'north', rootOrigin, rootRotation, rootScale);
  const rootWest = getStampedConnector('double-split', 'west', rootOrigin, rootRotation, rootScale);
  const rootEast = getStampedConnector('double-split', 'east', rootOrigin, rootRotation, rootScale);
  const rootSouth = getStampedConnector('double-split', 'south', rootOrigin, rootRotation, rootScale);

  const starterLineScale = 1.10;
  const starterLineRotation = Math.PI * 0.5;
  const starterAnchor = addVec2(rootNorth.position, scaleVec2(rootNorth.normal, connectorGap));
  const starterOrigin = computeOriginForConnectorAttachment(
    'straight-line',
    'west',
    starterAnchor,
    starterLineRotation,
    starterLineScale,
  );
  stampModule('starter-line', 'straight-line', {
    origin: starterOrigin,
    rotation: starterLineRotation,
    scale: starterLineScale,
    variant: 'large',
    colorer: starterColor,
  });
  const starterFar = getStampedConnector('straight-line', 'east', starterOrigin, starterLineRotation, starterLineScale);
  const starterPath = sampleLine(
    addVec2(starterFar.position, scaleVec2(starterFar.normal, DOMINO_VARIANTS.large.spacing * 18.0)),
    starterFar.position,
    0.07,
  );
  const starterPlacements = placeDominoesAlongPolyline(starterPath, 'large', starterColor, placements);
  addStarterStacks(starterPlacements, placements);

  const westLineScale = 1.28;
  const westLineRotation = 0.0;
  const westLineOrigin = computeOriginForConnectorAttachment(
    'straight-line',
    'east',
    addVec2(rootWest.position, scaleVec2(rootWest.normal, connectorGap)),
    westLineRotation,
    westLineScale,
  );
  stampModule('west-line', 'straight-line', {
    origin: westLineOrigin,
    rotation: westLineRotation,
    scale: westLineScale,
    variant: 'standard',
    colorer: lineColor,
  });
  const westLineFar = getStampedConnector('straight-line', 'west', westLineOrigin, westLineRotation, westLineScale);

  const eastLineScale = 1.28;
  const eastLineRotation = 0.0;
  const eastLineOrigin = computeOriginForConnectorAttachment(
    'straight-line',
    'west',
    addVec2(rootEast.position, scaleVec2(rootEast.normal, connectorGap)),
    eastLineRotation,
    eastLineScale,
  );
  stampModule('east-line', 'straight-line', {
    origin: eastLineOrigin,
    rotation: eastLineRotation,
    scale: eastLineScale,
    variant: 'standard',
    colorer: lineColor,
  });
  const eastLineFar = getStampedConnector('straight-line', 'east', eastLineOrigin, eastLineRotation, eastLineScale);

  const southLineScale = 0.78;
  const southLineRotation = Math.PI * 0.5;
  const southLineOrigin = computeOriginForConnectorAttachment(
    'straight-line',
    'east',
    addVec2(rootSouth.position, scaleVec2(rootSouth.normal, connectorGap)),
    southLineRotation,
    southLineScale,
  );
  stampModule('south-line', 'straight-line', {
    origin: southLineOrigin,
    rotation: southLineRotation,
    scale: southLineScale,
    variant: 'standard',
    colorer: lineColor,
  });
  const southLineFar = getStampedConnector('straight-line', 'west', southLineOrigin, southLineRotation, southLineScale);

  const southSplitScale = 0.94;
  const southSplitReferenceRotation = computeRotationForConnectorMatch('split', 'south', southLineFar.normal, Math.PI * 0.5);
  const splitSides: BoundarySide[] = ['west', 'east', 'north', 'south'];
  const southSplitBaseIncomingSide = splitSides.reduce((bestSide, side) => {
    const bestDot = dotVec2(
      rotateVector(getLocalConnector('split', bestSide).normal, southSplitReferenceRotation),
      vec2(0.0, 1.0),
    );
    const sideDot = dotVec2(
      rotateVector(getLocalConnector('split', side).normal, southSplitReferenceRotation),
      vec2(0.0, 1.0),
    );
    return sideDot > bestDot ? side : bestSide;
  }, 'west' as BoundarySide);
  const southSplitIncomingSide = southSplitBaseIncomingSide;
  const southSplitTriangleSide = oppositeBoundarySide(southSplitIncomingSide);
  const southSplitRotation = computeRotationForConnectorFacing(
    'split',
    southSplitIncomingSide,
    vec2(0.0, 1.0),
  );
  const southSplitOrigin = computeOriginForConnectorAttachment(
    'split',
    southSplitIncomingSide,
    addVec2(southLineFar.position, scaleVec2(southLineFar.normal, connectorGap)),
    southSplitRotation,
    southSplitScale,
  );
  stampModule('south-split', 'split', {
    origin: southSplitOrigin,
    rotation: southSplitRotation,
    scale: southSplitScale,
    variant: 'standard',
    colorer: lineColor,
  });
  const southSplitConnectorsBySide = {
    west: getStampedConnector('split', 'west', southSplitOrigin, southSplitRotation, southSplitScale),
    east: getStampedConnector('split', 'east', southSplitOrigin, southSplitRotation, southSplitScale),
    north: getStampedConnector('split', 'north', southSplitOrigin, southSplitRotation, southSplitScale),
    south: getStampedConnector('split', 'south', southSplitOrigin, southSplitRotation, southSplitScale),
  } satisfies Record<BoundarySide, ConnectorPoint>;
  const southSplitSideBranches = splitSides
    .filter((side) => side !== southSplitIncomingSide && side !== southSplitTriangleSide)
    .map((side) => southSplitConnectorsBySide[side]);
  const southSplitWest = pickConnectorByDirection(southSplitSideBranches, vec2(-1.0, 0.0));
  const southSplitEast = pickConnectorByDirection(southSplitSideBranches, vec2(1.0, 0.0));
  const southSplitNorth = southSplitConnectorsBySide[southSplitTriangleSide];
  const southBranchGap = DOMINO_VARIANTS.standard.spacing * 3.0;

  const westSpiralScale = 1.14;
  const westSpiralRotation = computeRotationForConnectorMatch('spiral', 'east', westLineFar.normal);
  const westSpiralOrigin = computeOriginForConnectorAttachment(
    'spiral',
    'east',
    addVec2(westLineFar.position, scaleVec2(westLineFar.normal, connectorGap)),
    westSpiralRotation,
    westSpiralScale,
  );
  stampModule('west-spiral', 'spiral', {
    origin: westSpiralOrigin,
    rotation: westSpiralRotation,
    scale: westSpiralScale,
    variant: 'small',
    colorer: spiralLeftColor,
  });

  const eastSpiralScale = 1.14;
  const eastSpiralRotation = computeRotationForConnectorMatch('spiral', 'east', eastLineFar.normal);
  const eastSpiralOrigin = computeOriginForConnectorAttachment(
    'spiral',
    'east',
    addVec2(eastLineFar.position, scaleVec2(eastLineFar.normal, connectorGap)),
    eastSpiralRotation,
    eastSpiralScale,
  );
  stampModule('east-spiral', 'spiral', {
    origin: eastSpiralOrigin,
    rotation: eastSpiralRotation,
    scale: eastSpiralScale,
    variant: 'small',
    colorer: spiralRightColor,
  });

  const southBranchSpiralScale = 1.08;
  const southBranchSpiralRotation = computeRotationForConnectorMatch('spiral', 'east', southSplitWest.normal);
  const southBranchSpiralOrigin = computeOriginForConnectorAttachment(
    'spiral',
    'east',
    addVec2(southSplitWest.position, scaleVec2(southSplitWest.normal, southBranchGap)),
    southBranchSpiralRotation,
    southBranchSpiralScale,
  );
  stampModule('south-branch-spiral', 'spiral', {
    origin: southBranchSpiralOrigin,
    rotation: southBranchSpiralRotation,
    scale: southBranchSpiralScale,
    variant: 'small',
    colorer: makeHueRamp(0.28, 0.40, 0.76, 0.58),
  });

  const logoTriangleScale = vec2(1.42, 0.96);
  const logoTriangleRotation = computeRotationForConnectorMatch('triangle', 'west', southSplitNorth.normal);
  const logoTriangleOrigin = computeOriginForConnectorAttachment(
    'triangle',
    'west',
    addVec2(southSplitNorth.position, scaleVec2(southSplitNorth.normal, southBranchGap)),
    logoTriangleRotation,
    logoTriangleScale,
  );
  stampModule('south-logo-triangle', 'triangle', {
    origin: logoTriangleOrigin,
    rotation: logoTriangleRotation,
    scale: logoTriangleScale,
    variant: 'standard',
    colorer: () => DOMINO_FIELD_GRAY,
    blockColor: makeTriangleTechniqueLogoColorer(24, 0.44),
  });

  const southFreeSpiralScale = 1.08;
  const southFreeSpiralRotation = computeRotationForConnectorMatch('spiral', 'east', southSplitEast.normal);
  const southFreeSpiralOrigin = computeOriginForConnectorAttachment(
    'spiral',
    'east',
    addVec2(southSplitEast.position, scaleVec2(southSplitEast.normal, southBranchGap)),
    southFreeSpiralRotation,
    southFreeSpiralScale,
  );
  stampModule('south-free-spiral', 'spiral', {
    origin: southFreeSpiralOrigin,
    rotation: southFreeSpiralRotation,
    scale: southFreeSpiralScale,
    variant: 'small',
    colorer: makeHueRamp(0.72, 0.84, 0.78, 0.60),
  });

  return dedupePlacements(placements);
}

function buildDominoScene(
  variant: DominoSceneVariant,
  args: {
    scene: THREE.Object3D;
    physics: PhysicsEngine;
  },
): DominoDemoResult {
  const { scene, physics } = args;
  const trackedVisualSets: TrackedBodyVisualSet[] = [];
  const trackedSpringVisualSets: TrackedSpringVisualSet[] = [];

  if (variant === 'advanced') {
    const floorHalfExtents: [number, number, number] = [50.5, 0.5, 50.5];
    const floorCenters: Array<[number, number, number]> = [
      [-50.0, -floorHalfExtents[1], -50.0],
      [50.0, -floorHalfExtents[1], -50.0],
      [-50.0, -floorHalfExtents[1], 50.0],
      [50.0, -floorHalfExtents[1], 50.0],
    ];
    const floorVisuals = createTrackedBodyVisualSet(scene, physics, {
      capacity: floorCenters.length,
      halfExtents: floorHalfExtents,
      color: 0x495563,
      roughness: 0.85,
      metalness: 0.05,
      showOutline: false,
      castShadow: true,
      receiveShadow: true,
    });
    trackedVisualSets.push(floorVisuals);
    for (const center of floorCenters) {
      const body = physics.addBody({
        position: center,
        mass: 0.0,
        halfExtents: floorHalfExtents,
        lockRotation: true,
      });
      floorVisuals.addBody(body);
    }
  }

  const placements = buildDominoPlacements(variant);

  // Every domino carries its own hue off a continuous ramp, so grouping visuals by
  // colour/size gave one instanced mesh (and one gather dispatch) per handful of dominoes.
  const dominoVisuals = createTrackedBodyVisualSet(scene, physics, {
    capacity: Math.max(placements.length, 1),
    perInstance: true,
    color: DOMINO_FIELD_GRAY,
    roughness: 0.68,
    metalness: 0.02,
    showOutline: false,
    castShadow: true,
    receiveShadow: true,
  });
  trackedVisualSets.push(dominoVisuals);

  for (const placement of placements) {
    const variantDef = DOMINO_VARIANTS[placement.variant];
    const halfExtents = placement.halfExtents ?? variantDef.halfExtents;
    const standardVolume =
      DOMINO_VARIANTS.standard.halfExtents[0] * 2.0 *
      DOMINO_VARIANTS.standard.halfExtents[1] * 2.0 *
      DOMINO_VARIANTS.standard.halfExtents[2] * 2.0;
    const volume =
      halfExtents[0] * 2.0 *
      halfExtents[1] * 2.0 *
      halfExtents[2] * 2.0;
    const body = physics.addBody({
      position: placement.position,
      halfExtents,
      quaternion: placement.quaternion,
      mass: variantDef.mass * (volume / standardVolume),
      friction: variantDef.friction,
    });
    dominoVisuals.addBody(body, { halfExtents, color: placement.color });
  }

  console.log(
    `[DominoDemo] built ${placements.length} dominoes with technique grammar (${variant}).`,
  );

  return {
    trackedVisualSets,
    trackedSpringVisualSets,
    dominoCount: placements.length,
  };
}

export function buildDominoDemo(args: {
  scene: THREE.Object3D;
  physics: PhysicsEngine;
}): DominoDemoResult {
  return buildDominoScene('base', args);
}

export function buildDominoAdvancedDemo(args: {
  scene: THREE.Object3D;
  physics: PhysicsEngine;
}): DominoDemoResult {
  return buildDominoScene('advanced', args);
}
