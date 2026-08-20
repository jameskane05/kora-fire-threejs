/**
 * OBB–OBB contact generation — TypeScript port of collide.cpp from
 * https://github.com/savant117/avbd-demo3d (MIT, Chris Giles).
 */
import {
  type Mat3, type Quat, type V3,
  addV3, clamp, conjugate, cross, dot, lengthSq, lengthV3, normalize, orthonormal,
  rotate, scaleV3, subV3, v3,
} from './maths';
import type { Contact, Rigid } from './solver';

const PENALTY_MIN = 1.0;

const MAX_CONTACTS = 8;
const MAX_POLY_VERTS = 16;
const SAT_AXIS_EPSILON = 1e-6;
const PLANE_EPSILON = 1e-5;
const CONTACT_MERGE_DIST_SQ = 1e-6;

const AXIS_FACE_A = 0;
const AXIS_FACE_B = 1;
const AXIS_EDGE = 2;

type OBB = { center: V3; rotation: Quat; half: V3; axis: [V3, V3, V3] };
type SatAxis = {
  type: number; indexA: number; indexB: number; separation: number; normalAB: V3; valid: boolean;
};
type FaceFrame = {
  axisIndex: number; normal: V3; center: V3; u: V3; v: V3; extentU: number; extentV: number;
};

function makeOBB(body: Rigid): OBB {
  return {
    center: body.positionLin,
    rotation: body.positionAng,
    half: scaleV3(body.size, 0.5),
    axis: [
      rotate(body.positionAng, v3(1, 0, 0)),
      rotate(body.positionAng, v3(0, 1, 0)),
      rotate(body.positionAng, v3(0, 0, 1)),
    ],
  };
}

function absDot(a: V3, b: V3): number { return Math.abs(dot(a, b)); }

function halfComp(half: V3, i: number): number {
  return i === 0 ? half.x : i === 1 ? half.y : half.z;
}

function supportPoint(box: OBB, dir: V3): V3 {
  const sx = dot(dir, box.axis[0]) >= 0 ? 1 : -1;
  const sy = dot(dir, box.axis[1]) >= 0 ? 1 : -1;
  const sz = dot(dir, box.axis[2]) >= 0 ? 1 : -1;
  return addV3(
    addV3(
      addV3(box.center, scaleV3(box.axis[0], box.half.x * sx)),
      scaleV3(box.axis[1], box.half.y * sy),
    ),
    scaleV3(box.axis[2], box.half.z * sz),
  );
}

function getFaceAxes(box: OBB, axisIndex: number): { u: V3; v: V3; extentU: number; extentV: number } {
  if (axisIndex === 0) return { u: box.axis[1], v: box.axis[2], extentU: box.half.y, extentV: box.half.z };
  if (axisIndex === 1) return { u: box.axis[0], v: box.axis[2], extentU: box.half.x, extentV: box.half.z };
  return { u: box.axis[0], v: box.axis[1], extentU: box.half.x, extentV: box.half.y };
}

function buildFaceFrame(box: OBB, axisIndex: number, outwardNormal: V3): FaceFrame {
  const s = dot(outwardNormal, box.axis[axisIndex]) >= 0 ? 1 : -1;
  const normal = scaleV3(box.axis[axisIndex], s);
  const center = addV3(box.center, scaleV3(normal, halfComp(box.half, axisIndex)));
  const { u, v, extentU, extentV } = getFaceAxes(box, axisIndex);
  return { axisIndex, normal, center, u, v, extentU, extentV };
}

function chooseIncidentFaceAxis(box: OBB, referenceNormal: V3): number {
  let axis = 0;
  let best = -Infinity;
  for (let i = 0; i < 3; i++) {
    const d = absDot(box.axis[i], referenceNormal);
    if (d > best) { best = d; axis = i; }
  }
  return axis;
}

function buildIncidentFace(box: OBB, axisIndex: number, referenceNormal: V3, outVerts: V3[]): void {
  const s = dot(box.axis[axisIndex], referenceNormal) > 0 ? -1 : 1;
  const faceNormal = scaleV3(box.axis[axisIndex], s);
  const faceCenter = addV3(box.center, scaleV3(faceNormal, halfComp(box.half, axisIndex)));
  const { u, v, extentU, extentV } = getFaceAxes(box, axisIndex);
  outVerts[0] = addV3(addV3(faceCenter, scaleV3(u, extentU)), scaleV3(v, extentV));
  outVerts[1] = addV3(addV3(faceCenter, scaleV3(u, -extentU)), scaleV3(v, extentV));
  outVerts[2] = addV3(addV3(faceCenter, scaleV3(u, -extentU)), scaleV3(v, -extentV));
  outVerts[3] = addV3(addV3(faceCenter, scaleV3(u, extentU)), scaleV3(v, -extentV));
}

function clipPolygonAgainstPlane(
  inVerts: V3[], inCount: number, planeNormal: V3, planeOffset: number, outVerts: V3[],
): number {
  if (inCount <= 0) return 0;
  let outCount = 0;
  let a = inVerts[inCount - 1];
  let da = dot(planeNormal, a) - planeOffset;
  for (let i = 0; i < inCount; i++) {
    const b = inVerts[i];
    const db = dot(planeNormal, b) - planeOffset;
    const aInside = da <= PLANE_EPSILON;
    const bInside = db <= PLANE_EPSILON;
    if (aInside !== bInside) {
      let t = 0;
      const denom = da - db;
      if (Math.abs(denom) > SAT_AXIS_EPSILON) t = clamp(da / denom, 0, 1);
      if (outCount < MAX_POLY_VERTS) outVerts[outCount++] = addV3(a, scaleV3(subV3(b, a), t));
    }
    if (bInside && outCount < MAX_POLY_VERTS) outVerts[outCount++] = b;
    a = b;
    da = db;
  }
  return outCount;
}

function emptyContact(featureKey: number): Contact {
  return {
    featureKey,
    rA: v3(), rB: v3(),
    C0: v3(),
    penalty: v3(PENALTY_MIN, PENALTY_MIN, PENALTY_MIN),
    lambda: v3(),
    stick: false,
  };
}

function addContact(
  bodyA: Rigid, bodyB: Rigid, contacts: Contact[], contactMidpoints: V3[],
  xA: V3, xB: V3, featureKey: number,
): boolean {
  const midpoint = scaleV3(addV3(xA, xB), 0.5);
  for (let i = 0; i < contacts.length; i++) {
    if (lengthSq(subV3(midpoint, contactMidpoints[i])) < CONTACT_MERGE_DIST_SQ) return false;
  }
  if (contacts.length >= MAX_CONTACTS) return false;
  const c = emptyContact(featureKey);
  c.rA = rotate(conjugate(bodyA.positionAng), subV3(xA, bodyA.positionLin));
  c.rB = rotate(conjugate(bodyB.positionAng), subV3(xB, bodyB.positionLin));
  contactMidpoints.push(midpoint);
  contacts.push(c);
  return true;
}

function testAxis(
  boxA: OBB, boxB: OBB, delta: V3, axis: V3, type: number, indexA: number, indexB: number, best: SatAxis,
): boolean {
  const lenSq = lengthSq(axis);
  if (lenSq < SAT_AXIS_EPSILON) return true;
  let n = scaleV3(axis, 1 / Math.sqrt(lenSq));
  if (dot(n, delta) < 0) n = scaleV3(n, -1);
  const distance = Math.abs(dot(delta, n));
  const rA =
    boxA.half.x * absDot(n, boxA.axis[0]) +
    boxA.half.y * absDot(n, boxA.axis[1]) +
    boxA.half.z * absDot(n, boxA.axis[2]);
  const rB =
    boxB.half.x * absDot(n, boxB.axis[0]) +
    boxB.half.y * absDot(n, boxB.axis[1]) +
    boxB.half.z * absDot(n, boxB.axis[2]);
  const separation = distance - (rA + rB);
  if (separation > 0) return false;
  if (!best.valid || separation > best.separation) {
    best.valid = true;
    best.type = type;
    best.indexA = indexA;
    best.indexB = indexB;
    best.separation = separation;
    best.normalAB = n;
  }
  return true;
}

function supportEdge(box: OBB, axisIndex: number, dir: V3): [V3, V3] {
  const axis1 = (axisIndex + 1) % 3;
  const axis2 = (axisIndex + 2) % 3;
  const sign1 = dot(dir, box.axis[axis1]) >= 0 ? 1 : -1;
  const sign2 = dot(dir, box.axis[axis2]) >= 0 ? 1 : -1;
  const edgeCenter = addV3(
    addV3(box.center, scaleV3(box.axis[axis1], halfComp(box.half, axis1) * sign1)),
    scaleV3(box.axis[axis2], halfComp(box.half, axis2) * sign2),
  );
  return [
    subV3(edgeCenter, scaleV3(box.axis[axisIndex], halfComp(box.half, axisIndex))),
    addV3(edgeCenter, scaleV3(box.axis[axisIndex], halfComp(box.half, axisIndex))),
  ];
}

function closestPointsOnSegments(p0: V3, p1: V3, q0: V3, q1: V3): [V3, V3] {
  const d1 = subV3(p1, p0);
  const d2 = subV3(q1, q0);
  const r = subV3(p0, q0);
  const a = dot(d1, d1);
  const e = dot(d2, d2);
  const f = dot(d2, r);
  let s = 0;
  let t = 0;
  if (a <= SAT_AXIS_EPSILON && e <= SAT_AXIS_EPSILON) return [p0, q0];
  if (a <= SAT_AXIS_EPSILON) {
    t = clamp(f / e, 0, 1);
  } else {
    const c = dot(d1, r);
    if (e <= SAT_AXIS_EPSILON) {
      s = clamp(-c / a, 0, 1);
    } else {
      const b = dot(d1, d2);
      const denom = a * e - b * b;
      if (Math.abs(denom) > SAT_AXIS_EPSILON) s = clamp((b * f - c * e) / denom, 0, 1);
      t = (b * s + f) / e;
      if (t < 0) { t = 0; s = clamp(-c / a, 0, 1); }
      else if (t > 1) { t = 1; s = clamp((b - c) / a, 0, 1); }
    }
  }
  return [addV3(p0, scaleV3(d1, s)), addV3(q0, scaleV3(d2, t))];
}

function buildFaceManifold(
  bodyA: Rigid, bodyB: Rigid, boxA: OBB, boxB: OBB,
  referenceIsA: boolean, referenceAxis: number, normalAB: V3, contacts: Contact[],
): number {
  const referenceBox = referenceIsA ? boxA : boxB;
  const incidentBox = referenceIsA ? boxB : boxA;
  const referenceOutward = referenceIsA ? normalAB : scaleV3(normalAB, -1);
  const referenceFace = buildFaceFrame(referenceBox, referenceAxis, referenceOutward);
  const incidentAxis = chooseIncidentFaceAxis(incidentBox, referenceFace.normal);

  const clip0: V3[] = new Array(MAX_POLY_VERTS);
  const clip1: V3[] = new Array(MAX_POLY_VERTS);
  buildIncidentFace(incidentBox, incidentAxis, referenceFace.normal, clip0);
  let count = 4;

  let n0 = referenceFace.u;
  let o0 = dot(n0, referenceFace.center) + referenceFace.extentU;
  count = clipPolygonAgainstPlane(clip0, count, n0, o0, clip1);
  if (!count) return 0;
  let n1 = scaleV3(referenceFace.u, -1);
  let o1 = dot(n1, referenceFace.center) + referenceFace.extentU;
  count = clipPolygonAgainstPlane(clip1, count, n1, o1, clip0);
  if (!count) return 0;
  let n2 = referenceFace.v;
  let o2 = dot(n2, referenceFace.center) + referenceFace.extentV;
  count = clipPolygonAgainstPlane(clip0, count, n2, o2, clip1);
  if (!count) return 0;
  let n3 = scaleV3(referenceFace.v, -1);
  let o3 = dot(n3, referenceFace.center) + referenceFace.extentV;
  count = clipPolygonAgainstPlane(clip1, count, n3, o3, clip0);
  if (!count) return 0;

  const midpoints: V3[] = [];
  let featurePrefix = ((referenceIsA ? AXIS_FACE_A : AXIS_FACE_B) << 24)
    | ((referenceAxis & 0xff) << 16)
    | ((incidentAxis & 0xff) << 8);

  for (let i = 0; i < count && contacts.length < MAX_CONTACTS; i++) {
    const pIncident = clip0[i];
    const distance = dot(subV3(pIncident, referenceFace.center), referenceFace.normal);
    if (distance > PLANE_EPSILON) continue;
    const pReference = subV3(pIncident, scaleV3(referenceFace.normal, distance));
    const xA = referenceIsA ? pReference : pIncident;
    const xB = referenceIsA ? pIncident : pReference;
    addContact(bodyA, bodyB, contacts, midpoints, xA, xB, featurePrefix | (i & 0xff));
  }

  if (!contacts.length) {
    const xA = supportPoint(boxA, normalAB);
    const xB = supportPoint(boxB, scaleV3(normalAB, -1));
    addContact(bodyA, bodyB, contacts, midpoints, xA, xB, featurePrefix);
  }
  return contacts.length;
}

function buildEdgeContact(
  bodyA: Rigid, bodyB: Rigid, boxA: OBB, boxB: OBB,
  axisA: number, axisB: number, normalAB: V3, contacts: Contact[],
): number {
  const [a0, a1] = supportEdge(boxA, axisA, normalAB);
  const [b0, b1] = supportEdge(boxB, axisB, scaleV3(normalAB, -1));
  let [xA, xB] = closestPointsOnSegments(a0, a1, b0, b1);
  const midpoints: V3[] = [];
  const featureKey = (AXIS_EDGE << 24) | ((axisA & 0xff) << 8) | (axisB & 0xff);
  addContact(bodyA, bodyB, contacts, midpoints, xA, xB, featureKey);
  if (!contacts.length) {
    xA = supportPoint(boxA, normalAB);
    xB = supportPoint(boxB, scaleV3(normalAB, -1));
    addContact(bodyA, bodyB, contacts, midpoints, xA, xB, featureKey);
  }
  return contacts.length;
}

/** Fill `outContacts` and `basisOut` (normal in row 0). Returns contact count. */
export function collideObb(
  bodyA: Rigid, bodyB: Rigid, outContacts: Contact[], basisOut: Mat3,
): number {
  outContacts.length = 0;
  const boxA = makeOBB(bodyA);
  const boxB = makeOBB(bodyB);
  const delta = subV3(boxB.center, boxA.center);
  const bestFace: SatAxis = { type: 0, indexA: 0, indexB: 0, separation: -Infinity, normalAB: v3(), valid: false };
  const bestEdge: SatAxis = { type: 0, indexA: 0, indexB: 0, separation: -Infinity, normalAB: v3(), valid: false };

  for (let i = 0; i < 3; i++) {
    if (!testAxis(boxA, boxB, delta, boxA.axis[i], AXIS_FACE_A, i, -1, bestFace)) return 0;
  }
  for (let i = 0; i < 3; i++) {
    if (!testAxis(boxA, boxB, delta, boxB.axis[i], AXIS_FACE_B, -1, i, bestFace)) return 0;
  }
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      const axis = cross(boxA.axis[i], boxB.axis[j]);
      if (!testAxis(boxA, boxB, delta, axis, AXIS_EDGE, i, j, bestEdge)) return 0;
    }
  }
  if (!bestFace.valid) return 0;

  let best = bestFace;
  if (bestEdge.valid) {
    if (0.95 * bestEdge.separation > bestFace.separation + 0.01) best = bestEdge;
  }

  const basis = orthonormal(scaleV3(best.normalAB, -1));
  basisOut.row[0] = basis.row[0];
  basisOut.row[1] = basis.row[1];
  basisOut.row[2] = basis.row[2];

  if (best.type === AXIS_EDGE) {
    return buildEdgeContact(bodyA, bodyB, boxA, boxB, best.indexA, best.indexB, best.normalAB, outContacts);
  }
  if (best.type === AXIS_FACE_A) {
    return buildFaceManifold(bodyA, bodyB, boxA, boxB, true, best.indexA, best.normalAB, outContacts);
  }
  return buildFaceManifold(bodyA, bodyB, boxA, boxB, false, best.indexB, best.normalAB, outContacts);
}
