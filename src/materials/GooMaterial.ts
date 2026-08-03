/**
 * Lit sphere impostors for MLS-MPM exhibits (billboard discs + fresnel).
 */
import {
  InstancedMesh,
  PlaneGeometry,
  Sphere,
  SpriteNodeMaterial,
  type StorageInstancedBufferAttribute,
} from 'three/webgpu';
import {
  Discard,
  Fn,
  If,
  color,
  float,
  max,
  mix,
  normalize,
  oneMinus,
  pow,
  select,
  sqrt,
  storage,
  uniform,
  uv,
  vec3,
} from 'three/tsl';
import type { MaterialKind } from './MlsMpm';

const KIND_ID: Record<MaterialKind, number> = { goo: 0, sand: 1, water: 2 };

export function createParticleSurfaceMesh(
  count: number,
  domain: number,
  posAttr: StorageInstancedBufferAttribute,
  velAttr: StorageInstancedBufferAttribute,
): { mesh: InstancedMesh; setKind: (kind: MaterialKind) => void } {
  const particles = storage(posAttr, 'vec4', count);
  const pAttr = particles.toAttribute();
  const kind = uniform(KIND_ID.sand);

  // velAttr kept in the signature — sim still uploads it; gel shading does not use it.
  void velAttr;

  const material = new SpriteNodeMaterial();
  material.positionNode = pAttr.xyz.sub(0.5).mul(domain).add(vec3(0, domain * 0.5, 0));

  // Sand is half the original bead size (user request); goo/water match the original look.
  material.scaleNode = Fn(() =>
    select(kind.lessThan(0.5), float(0.022), select(kind.greaterThan(1.5), float(0.018), float(0.007))),
  )();

  material.colorNode = Fn(() => {
    const puv = uv().mul(2).sub(1);
    const r2 = puv.dot(puv);
    If(r2.greaterThanEqual(1.0), () => {
      Discard();
    });

    const nz = sqrt(max(float(0), float(1).sub(r2)));
    const N = normalize(vec3(puv.x, puv.y, nz));

    const L = normalize(vec3(0.4, 0.75, 0.55));
    const ndl = max(N.dot(L), float(0));
    const wrap = ndl.mul(0.55).add(0.45);
    const fresnel = pow(oneMinus(max(N.z, float(0))), float(2.8));
    const H = normalize(L.add(vec3(0, 0, 1)));
    const spec = pow(max(N.dot(H), float(0)), float(56));

    const gooBase = mix(color(0x14532d), color(0x62e07a), wrap);
    const goo = gooBase
      .add(color(0xc6ffe0).mul(fresnel.mul(0.55)))
      .add(vec3(1, 1, 1).mul(spec.mul(0.5)))
      .add(color(0x2f6b45).mul(oneMinus(wrap).mul(0.15)));

    const sand = color(0xd4a574).mul(wrap.mul(0.45).add(0.55));
    const water = color(0x4da3ff)
      .mul(wrap.mul(0.35).add(0.65))
      .add(color(0xffffff).mul(fresnel.mul(0.35)))
      .add(vec3(1, 1, 1).mul(spec.mul(0.25)));

    return select(kind.lessThan(0.5), goo, select(kind.greaterThan(1.5), water, sand));
  })();

  material.transparent = false;
  material.depthWrite = true;
  material.depthTest = true;
  material.toneMapped = true;

  const mesh = new InstancedMesh(new PlaneGeometry(1, 1), material, count);
  mesh.frustumCulled = false;
  mesh.boundingSphere = new Sphere(undefined, domain * 2);
  mesh.renderOrder = 5;

  return {
    mesh,
    setKind: (k) => {
      kind.value = KIND_ID[k];
    },
  };
}
