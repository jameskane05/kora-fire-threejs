/**
 * Math helpers for AVBD — TypeScript port of maths.h from
 * https://github.com/savant117/avbd-demo3d (MIT, Chris Giles).
 */
export type V2 = { x: number; y: number };
export type V3 = { x: number; y: number; z: number };
export type Quat = { x: number; y: number; z: number; w: number };
/** Row-major 3×3 */
export type Mat3 = { row: [V3, V3, V3] };

export const v2 = (x = 0, y = 0): V2 => ({ x, y });
export const v3 = (x = 0, y = 0, z = 0): V3 => ({ x, y, z });
export const quat = (x = 0, y = 0, z = 0, w = 1): Quat => ({ x, y, z, w });
export const mat3 = (r0?: V3, r1?: V3, r2?: V3): Mat3 => ({
  row: [r0 ?? v3(), r1 ?? v3(), r2 ?? v3()],
});

export function mat3From9(
  a00: number, a01: number, a02: number,
  a10: number, a11: number, a12: number,
  a20: number, a21: number, a22: number,
): Mat3 {
  return mat3(v3(a00, a01, a02), v3(a10, a11, a12), v3(a20, a21, a22));
}

export const zeroMat3 = (): Mat3 => mat3From9(0, 0, 0, 0, 0, 0, 0, 0, 0);
export const identityMat3 = (): Mat3 => mat3From9(1, 0, 0, 0, 1, 0, 0, 0, 1);

export function col(m: Mat3, i: number): V3 {
  const k = i === 0 ? 'x' : i === 1 ? 'y' : 'z';
  return v3(m.row[0][k], m.row[1][k], m.row[2][k]);
}
function rowComp(r: V3, i: number): number {
  return i === 0 ? r.x : i === 1 ? r.y : r.z;
}
function setRowComp(r: V3, i: number, v: number): void {
  if (i === 0) r.x = v; else if (i === 1) r.y = v; else r.z = v;
}
export function get(m: Mat3, r: number, c: number): number {
  return rowComp(m.row[r], c);
}
export function set(m: Mat3, r: number, c: number, v: number): void {
  setRowComp(m.row[r], c, v);
}

export function addV3(a: V3, b: V3): V3 { return v3(a.x + b.x, a.y + b.y, a.z + b.z); }
export function subV3(a: V3, b: V3): V3 { return v3(a.x - b.x, a.y - b.y, a.z - b.z); }
export function negV3(a: V3): V3 { return v3(-a.x, -a.y, -a.z); }
export function scaleV3(a: V3, s: number): V3 { return v3(a.x * s, a.y * s, a.z * s); }
export function addEqV3(a: V3, b: V3): V3 { a.x += b.x; a.y += b.y; a.z += b.z; return a; }
export function dotV2(a: V2, b: V2): number { return a.x * b.x + a.y * b.y; }
export function dot(a: V3, b: V3): number { return a.x * b.x + a.y * b.y + a.z * b.z; }
export function lengthSq(a: V3): number { return dot(a, a); }
export function lengthV3(a: V3): number { return Math.sqrt(lengthSq(a)); }
export function lengthV2(a: V2): number { return Math.sqrt(dotV2(a, a)); }
export function normalize(a: V3): V3 {
  const L = lengthV3(a);
  return L > 1e-20 ? scaleV3(a, 1 / L) : v3(1, 0, 0);
}
export function cross(a: V3, b: V3): V3 {
  return v3(a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x);
}
export function absV3(a: V3): V3 { return v3(Math.abs(a.x), Math.abs(a.y), Math.abs(a.z)); }
export function clamp(x: number, a: number, b: number): number { return Math.max(a, Math.min(b, x)); }
export function clampV3(v: V3, a: number, b: number): V3 {
  return v3(clamp(v.x, a, b), clamp(v.y, a, b), clamp(v.z, a, b));
}
export function minV3s(a: V3, s: number): V3 { return v3(Math.min(a.x, s), Math.min(a.y, s), Math.min(a.z, s)); }
export function sign(x: number): number { return x < 0 ? -1 : x > 0 ? 1 : 0; }
export function rad(deg: number): number { return deg * 0.01745329251994329577; }

export function addMat3(a: Mat3, b: Mat3): Mat3 {
  return mat3(addV3(a.row[0], b.row[0]), addV3(a.row[1], b.row[1]), addV3(a.row[2], b.row[2]));
}
export function addEqMat3(a: Mat3, b: Mat3): Mat3 {
  addEqV3(a.row[0], b.row[0]); addEqV3(a.row[1], b.row[1]); addEqV3(a.row[2], b.row[2]);
  return a;
}
export function scaleMat3(a: Mat3, s: number): Mat3 {
  return mat3(scaleV3(a.row[0], s), scaleV3(a.row[1], s), scaleV3(a.row[2], s));
}
export function mulMat3(a: Mat3, b: Mat3): Mat3 {
  const bc = [col(b, 0), col(b, 1), col(b, 2)];
  return mat3(
    v3(dot(a.row[0], bc[0]), dot(a.row[0], bc[1]), dot(a.row[0], bc[2])),
    v3(dot(a.row[1], bc[0]), dot(a.row[1], bc[1]), dot(a.row[1], bc[2])),
    v3(dot(a.row[2], bc[0]), dot(a.row[2], bc[1]), dot(a.row[2], bc[2])),
  );
}
export function mulMat3V3(a: Mat3, b: V3): V3 {
  return v3(dot(a.row[0], b), dot(a.row[1], b), dot(a.row[2], b));
}
export function transpose(a: Mat3): Mat3 {
  return mat3(
    v3(a.row[0].x, a.row[1].x, a.row[2].x),
    v3(a.row[0].y, a.row[1].y, a.row[2].y),
    v3(a.row[0].z, a.row[1].z, a.row[2].z),
  );
}
export function diagonal(m00: number, m11: number, m22: number): Mat3 {
  return mat3From9(m00, 0, 0, 0, m11, 0, 0, 0, m22);
}
export function outer(a: V3, b: V3): Mat3 {
  return mat3(scaleV3(b, a.x), scaleV3(b, a.y), scaleV3(b, a.z));
}
export function skew(r: V3): Mat3 {
  return mat3From9(0, -r.z, r.y, r.z, 0, -r.x, -r.y, r.x, 0);
}
export function diagonalize(m: Mat3): Mat3 {
  return diagonal(lengthV3(col(m, 0)), lengthV3(col(m, 1)), lengthV3(col(m, 2)));
}

export function quatLengthSq(q: Quat): number { return q.x * q.x + q.y * q.y + q.z * q.z + q.w * q.w; }
export function normalizeQuat(q: Quat): Quat {
  const L = Math.sqrt(quatLengthSq(q));
  if (L < 1e-20) return quat(0, 0, 0, 1);
  return quat(q.x / L, q.y / L, q.z / L, q.w / L);
}
export function conjugate(q: Quat): Quat { return quat(-q.x, -q.y, -q.z, q.w); }
export function inverseQuat(q: Quat): Quat {
  const L2 = quatLengthSq(q);
  return quat(-q.x / L2, -q.y / L2, -q.z / L2, q.w / L2);
}
export function mulQuat(a: Quat, b: Quat): Quat {
  return quat(
    a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y,
    a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x,
    a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w,
    a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z,
  );
}
/** quat - quat → float3 (axis-angle-ish vector used by AVBD). */
export function subQuat(a: Quat, b: Quat): V3 {
  const d = mulQuat(a, inverseQuat(b));
  return scaleV3(v3(d.x, d.y, d.z), 2);
}
/** quat + float3 → quat (exponential map step used by AVBD). */
export function addQuatV3(a: Quat, b: V3): Quat {
  const t = mulQuat(quat(b.x, b.y, b.z, 0), a);
  return normalizeQuat(quat(a.x + t.x * 0.5, a.y + t.y * 0.5, a.z + t.z * 0.5, a.w + t.w * 0.5));
}
export function rotate(q: Quat, v: V3): V3 {
  const u = v3(q.x, q.y, q.z);
  const t = scaleV3(cross(u, v), 2);
  return addV3(addV3(v, scaleV3(t, q.w)), cross(u, t));
}
export function transform(qLin: V3, qAng: Quat, v: V3): V3 {
  return addV3(rotate(qAng, v), qLin);
}
export function orthonormal(normal: V3): Mat3 {
  const t1 = Math.abs(normal.x) > Math.abs(normal.z)
    ? normalize(v3(-normal.y, normal.x, 0))
    : normalize(v3(0, -normal.z, normal.y));
  const t2 = cross(normal, t1);
  return mat3(normal, t1, t2);
}

/** 6×6 LDL solve for coupled linear/angular AVBD primal update. */
export function solve(
  aLin: Mat3, aAng: Mat3, aCross: Mat3,
  bLin: V3, bAng: V3,
  xLin: V3, xAng: V3,
): void {
  const A11 = get(aLin, 0, 0);
  const A21 = get(aLin, 1, 0), A22 = get(aLin, 1, 1);
  const A31 = get(aLin, 2, 0), A32 = get(aLin, 2, 1), A33 = get(aLin, 2, 2);
  const A41 = get(aCross, 0, 0), A42 = get(aCross, 0, 1), A43 = get(aCross, 0, 2), A44 = get(aAng, 0, 0);
  const A51 = get(aCross, 1, 0), A52 = get(aCross, 1, 1), A53 = get(aCross, 1, 2), A54 = get(aAng, 1, 0), A55 = get(aAng, 1, 1);
  const A61 = get(aCross, 2, 0), A62 = get(aCross, 2, 1), A63 = get(aCross, 2, 2), A64 = get(aAng, 2, 0), A65 = get(aAng, 2, 1), A66 = get(aAng, 2, 2);

  const L21 = A21 / A11, L31 = A31 / A11, L41 = A41 / A11, L51 = A51 / A11, L61 = A61 / A11;
  const D1 = A11;
  const D2 = A22 - L21 * L21 * D1;
  const L32 = (A32 - L21 * L31 * D1) / D2;
  const L42 = (A42 - L21 * L41 * D1) / D2;
  const L52 = (A52 - L21 * L51 * D1) / D2;
  const L62 = (A62 - L21 * L61 * D1) / D2;
  const D3 = A33 - (L31 * L31 * D1 + L32 * L32 * D2);
  const L43 = (A43 - L31 * L41 * D1 - L32 * L42 * D2) / D3;
  const L53 = (A53 - L31 * L51 * D1 - L32 * L52 * D2) / D3;
  const L63 = (A63 - L31 * L61 * D1 - L32 * L62 * D2) / D3;
  const D4 = A44 - (L41 * L41 * D1 + L42 * L42 * D2 + L43 * L43 * D3);
  const L54 = (A54 - L41 * L51 * D1 - L42 * L52 * D2 - L43 * L53 * D3) / D4;
  const L64 = (A64 - L41 * L61 * D1 - L42 * L62 * D2 - L43 * L63 * D3) / D4;
  const D5 = A55 - (L51 * L51 * D1 + L52 * L52 * D2 + L53 * L53 * D3 + L54 * L54 * D4);
  const L65 = (A65 - L51 * L61 * D1 - L52 * L62 * D2 - L53 * L63 * D3 - L54 * L64 * D4) / D5;
  const D6 = A66 - (L61 * L61 * D1 + L62 * L62 * D2 + L63 * L63 * D3 + L64 * L64 * D4 + L65 * L65 * D5);

  const y1 = bLin.x;
  const y2 = bLin.y - L21 * y1;
  const y3 = bLin.z - L31 * y1 - L32 * y2;
  const y4 = bAng.x - L41 * y1 - L42 * y2 - L43 * y3;
  const y5 = bAng.y - L51 * y1 - L52 * y2 - L53 * y3 - L54 * y4;
  const y6 = bAng.z - L61 * y1 - L62 * y2 - L63 * y3 - L64 * y4 - L65 * y5;

  const z1 = y1 / D1, z2 = y2 / D2, z3 = y3 / D3, z4 = y4 / D4, z5 = y5 / D5, z6 = y6 / D6;

  xAng.z = z6;
  xAng.y = z5 - L65 * xAng.z;
  xAng.x = z4 - L54 * xAng.y - L64 * xAng.z;
  xLin.z = z3 - L43 * xAng.x - L53 * xAng.y - L63 * xAng.z;
  xLin.y = z2 - L32 * xLin.z - L42 * xAng.x - L52 * xAng.y - L62 * xAng.z;
  xLin.x = z1 - L21 * xLin.y - L31 * xLin.z - L41 * xAng.x - L51 * xAng.y - L61 * xAng.z;
}
