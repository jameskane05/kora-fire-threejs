import { wgsl } from './tslCompat';

export const SHAPE_FRICTION_MAX = 2.0;
export const SHAPE_FRICTION_WORD_MASK = 0x3fff;
export const SHAPE_TYPE_SHIFT = 14;
export const SHAPE_TYPE_MASK = 0x3;
export const DEFAULT_COLLISION_GROUP = 0x01;
export const DEFAULT_COLLISION_MASK = 0xff;
export const SHAPE_TYPE_BOX = 0;
export const SHAPE_TYPE_SPHERE = 1;

export type PackedShapeType =
  | typeof SHAPE_TYPE_BOX
  | typeof SHAPE_TYPE_SPHERE;

export function clampShapeFriction(friction: number): number {
  return Math.max(0.0, Math.min(SHAPE_FRICTION_MAX, friction));
}

export function clampCollisionFilterWord(value: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(0, Math.min(0xff, Math.floor(value)));
}

export function packShapeMetaWord(
  friction: number,
  collisionGroup = DEFAULT_COLLISION_GROUP,
  collisionMask = DEFAULT_COLLISION_MASK,
  shapeType: PackedShapeType = SHAPE_TYPE_BOX,
): number {
  const clampedFriction = clampShapeFriction(friction);
  const frictionWord = Math.round((clampedFriction / SHAPE_FRICTION_MAX) * SHAPE_FRICTION_WORD_MASK) & SHAPE_FRICTION_WORD_MASK;
  const groupWord = clampCollisionFilterWord(collisionGroup, DEFAULT_COLLISION_GROUP) & 0xff;
  const maskWord = clampCollisionFilterWord(collisionMask, DEFAULT_COLLISION_MASK) & 0xff;
  const shapeWord = (shapeType & SHAPE_TYPE_MASK) << SHAPE_TYPE_SHIFT;
  return (frictionWord | shapeWord | (groupWord << 16) | (maskWord << 24)) >>> 0;
}

export function decodeShapeFrictionWord(metaWord: number): number {
  return ((metaWord & SHAPE_FRICTION_WORD_MASK) / SHAPE_FRICTION_WORD_MASK) * SHAPE_FRICTION_MAX;
}

export function decodeShapeTypeWord(metaWord: number): PackedShapeType {
  return ((metaWord >> SHAPE_TYPE_SHIFT) & SHAPE_TYPE_MASK) as PackedShapeType;
}

export const shapeEncodingHelpers = wgsl(/* wgsl */`
      const SHAPE_FRICTION_MAX: f32 = 2.0;
      const SHAPE_FRICTION_WORD_SCALE: f32 = 2.0 / 16383.0;
      const SHAPE_TYPE_SHIFT: u32 = ${SHAPE_TYPE_SHIFT}u;
      const SHAPE_TYPE_MASK: u32 = ${SHAPE_TYPE_MASK}u;
      const SHAPE_TYPE_BOX: u32 = ${SHAPE_TYPE_BOX}u;
      const SHAPE_TYPE_SPHERE: u32 = ${SHAPE_TYPE_SPHERE}u;

      fn decodeShapeMetaWord(shapeMeta: f32) -> u32 {
        return bitcast<u32>(shapeMeta);
      }

      fn decodeShapeFriction(shapeMeta: f32) -> f32 {
        return f32(decodeShapeMetaWord(shapeMeta) & 0xffffu) * SHAPE_FRICTION_WORD_SCALE;
      }

      fn decodeShapeCollisionGroup(shapeMeta: f32) -> u32 {
        return (decodeShapeMetaWord(shapeMeta) >> 16u) & 0xffu;
      }

      fn decodeShapeCollisionMask(shapeMeta: f32) -> u32 {
        return (decodeShapeMetaWord(shapeMeta) >> 24u) & 0xffu;
      }

      fn decodeShapeType(shapeMeta: f32) -> u32 {
        return (decodeShapeMetaWord(shapeMeta) >> SHAPE_TYPE_SHIFT) & SHAPE_TYPE_MASK;
      }

      fn shapesCanCollide(shapeA: vec4f, shapeB: vec4f) -> bool {
        let groupA = decodeShapeCollisionGroup(shapeA.x);
        let groupB = decodeShapeCollisionGroup(shapeB.x);
        let maskA = decodeShapeCollisionMask(shapeA.x);
        let maskB = decodeShapeCollisionMask(shapeB.x);
        return (maskA & groupB) != 0u && (maskB & groupA) != 0u;
      }
    `);
