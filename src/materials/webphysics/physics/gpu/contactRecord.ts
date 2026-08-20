import { wgsl } from './tslCompat';

export const CONTACT_RECORD_META_OFFSET = 0;
export const CONTACT_RECORD_NORMAL_PEN_OFFSET = 1;
export const CONTACT_RECORD_ARM_A_OFFSET = 2;
export const CONTACT_RECORD_ARM_B_OFFSET = 3;
export const CONTACT_RECORD_CONSTRAINT_C0_OFFSET = 4;
export const CONTACT_RECORD_SHADOW_OFFSET = 5;
export const CONTACT_RECORD_DUAL_OFFSET = 6;
export const CONTACT_RECORD_PENALTY_OFFSET = 7;
export const CONTACT_RECORD_CACHE_OFFSET = 8;
export const CONTACT_RECORD_VEC4S = 9;
export const CONTACT_RECORD_FLOATS = CONTACT_RECORD_VEC4S * 4;

export const contactRecordHelpers = wgsl(/* wgsl */`
      const CONTACT_RECORD_META_OFFSET: u32 = ${CONTACT_RECORD_META_OFFSET}u;
      const CONTACT_RECORD_NORMAL_PEN_OFFSET: u32 = ${CONTACT_RECORD_NORMAL_PEN_OFFSET}u;
      const CONTACT_RECORD_ARM_A_OFFSET: u32 = ${CONTACT_RECORD_ARM_A_OFFSET}u;
      const CONTACT_RECORD_ARM_B_OFFSET: u32 = ${CONTACT_RECORD_ARM_B_OFFSET}u;
      const CONTACT_RECORD_CONSTRAINT_C0_OFFSET: u32 = ${CONTACT_RECORD_CONSTRAINT_C0_OFFSET}u;
      const CONTACT_RECORD_SHADOW_OFFSET: u32 = ${CONTACT_RECORD_SHADOW_OFFSET}u;
      const CONTACT_RECORD_DUAL_OFFSET: u32 = ${CONTACT_RECORD_DUAL_OFFSET}u;
      const CONTACT_RECORD_PENALTY_OFFSET: u32 = ${CONTACT_RECORD_PENALTY_OFFSET}u;
      const CONTACT_RECORD_CACHE_OFFSET: u32 = ${CONTACT_RECORD_CACHE_OFFSET}u;
      const CONTACT_RECORD_VEC4S: u32 = ${CONTACT_RECORD_VEC4S}u;

      fn contactRecordBase(p: u32) -> u32 {
        return p * CONTACT_RECORD_VEC4S;
      }

      fn loadContactMeta(pairContacts: ptr<storage, array<vec4f>, read_write>, p: u32) -> vec4f {
        return pairContacts[contactRecordBase(p) + CONTACT_RECORD_META_OFFSET];
      }

      fn storeContactMeta(
        pairContacts: ptr<storage, array<vec4f>, read_write>,
        p: u32,
        value: vec4f,
      ) {
        pairContacts[contactRecordBase(p) + CONTACT_RECORD_META_OFFSET] = value;
      }

      fn loadContactNormalPen(pairContacts: ptr<storage, array<vec4f>, read_write>, p: u32) -> vec4f {
        return pairContacts[contactRecordBase(p) + CONTACT_RECORD_NORMAL_PEN_OFFSET];
      }

      fn storeContactNormalPen(
        pairContacts: ptr<storage, array<vec4f>, read_write>,
        p: u32,
        value: vec4f,
      ) {
        pairContacts[contactRecordBase(p) + CONTACT_RECORD_NORMAL_PEN_OFFSET] = value;
      }

      fn loadContactArmA(pairContacts: ptr<storage, array<vec4f>, read_write>, p: u32) -> vec4f {
        return pairContacts[contactRecordBase(p) + CONTACT_RECORD_ARM_A_OFFSET];
      }

      fn storeContactArmA(
        pairContacts: ptr<storage, array<vec4f>, read_write>,
        p: u32,
        value: vec4f,
      ) {
        pairContacts[contactRecordBase(p) + CONTACT_RECORD_ARM_A_OFFSET] = value;
      }

      fn loadContactArmB(pairContacts: ptr<storage, array<vec4f>, read_write>, p: u32) -> vec4f {
        return pairContacts[contactRecordBase(p) + CONTACT_RECORD_ARM_B_OFFSET];
      }

      fn storeContactArmB(
        pairContacts: ptr<storage, array<vec4f>, read_write>,
        p: u32,
        value: vec4f,
      ) {
        pairContacts[contactRecordBase(p) + CONTACT_RECORD_ARM_B_OFFSET] = value;
      }

      fn loadContactConstraintC0(pairContacts: ptr<storage, array<vec4f>, read_write>, p: u32) -> vec4f {
        return pairContacts[contactRecordBase(p) + CONTACT_RECORD_CONSTRAINT_C0_OFFSET];
      }

      fn storeContactConstraintC0(
        pairContacts: ptr<storage, array<vec4f>, read_write>,
        p: u32,
        value: vec4f,
      ) {
        pairContacts[contactRecordBase(p) + CONTACT_RECORD_CONSTRAINT_C0_OFFSET] = value;
      }

      fn loadContactShadow(pairContacts: ptr<storage, array<vec4f>, read_write>, p: u32) -> vec4f {
        return pairContacts[contactRecordBase(p) + CONTACT_RECORD_SHADOW_OFFSET];
      }

      fn storeContactShadow(
        pairContacts: ptr<storage, array<vec4f>, read_write>,
        p: u32,
        value: vec4f,
      ) {
        pairContacts[contactRecordBase(p) + CONTACT_RECORD_SHADOW_OFFSET] = value;
      }

      fn loadContactDual(pairContacts: ptr<storage, array<vec4f>, read_write>, p: u32) -> vec4f {
        return pairContacts[contactRecordBase(p) + CONTACT_RECORD_DUAL_OFFSET];
      }

      fn storeContactDual(
        pairContacts: ptr<storage, array<vec4f>, read_write>,
        p: u32,
        value: vec4f,
      ) {
        pairContacts[contactRecordBase(p) + CONTACT_RECORD_DUAL_OFFSET] = value;
      }

      fn loadContactPenalty(pairContacts: ptr<storage, array<vec4f>, read_write>, p: u32) -> vec4f {
        return pairContacts[contactRecordBase(p) + CONTACT_RECORD_PENALTY_OFFSET];
      }

      fn storeContactPenalty(
        pairContacts: ptr<storage, array<vec4f>, read_write>,
        p: u32,
        value: vec4f,
      ) {
        pairContacts[contactRecordBase(p) + CONTACT_RECORD_PENALTY_OFFSET] = value;
      }

      fn loadContactCache(pairContacts: ptr<storage, array<vec4f>, read_write>, p: u32) -> vec4u {
        return bitcast<vec4u>(pairContacts[contactRecordBase(p) + CONTACT_RECORD_CACHE_OFFSET]);
      }

      fn storeContactCache(
        pairContacts: ptr<storage, array<vec4f>, read_write>,
        p: u32,
        value: vec4u,
      ) {
        pairContacts[contactRecordBase(p) + CONTACT_RECORD_CACHE_OFFSET] = bitcast<vec4f>(value);
      }

      fn loadContactCacheWord(pairContacts: ptr<storage, array<vec4f>, read_write>, p: u32) -> u32 {
        return loadContactCache(pairContacts, p).x;
      }

      fn storeContactCacheWord(
        pairContacts: ptr<storage, array<vec4f>, read_write>,
        p: u32,
        value: u32,
      ) {
        let cache = loadContactCache(pairContacts, p);
        storeContactCache(pairContacts, p, vec4u(value, cache.y, cache.z, cache.w));
      }
`);

export function contactRecordBaseFloatIndex(contactIndex: number): number {
  return contactIndex * CONTACT_RECORD_FLOATS;
}

export function contactRecordVec4FloatIndex(contactIndex: number, vec4Offset: number): number {
  return contactRecordBaseFloatIndex(contactIndex) + vec4Offset * 4;
}

export function contactRecordVec4Slice(
  pairContacts: Float32Array,
  contactIndex: number,
  vec4Offset: number,
): Float32Array {
  const base = contactRecordVec4FloatIndex(contactIndex, vec4Offset);
  return pairContacts.subarray(base, base + 4);
}
