import { wgsl } from './tslCompat';

export const SPRING_RECORD_META_OFFSET = 0;
export const SPRING_RECORD_ANCHOR_A_OFFSET = 1;
export const SPRING_RECORD_ANCHOR_B_OFFSET = 2;
export const SPRING_RECORD_VEC4S = 3;
export const SPRING_RECORD_FLOATS = SPRING_RECORD_VEC4S * 4;

export const springRecordHelpers = wgsl(/* wgsl */`
      const SPRING_RECORD_META_OFFSET: u32 = ${SPRING_RECORD_META_OFFSET}u;
      const SPRING_RECORD_ANCHOR_A_OFFSET: u32 = ${SPRING_RECORD_ANCHOR_A_OFFSET}u;
      const SPRING_RECORD_ANCHOR_B_OFFSET: u32 = ${SPRING_RECORD_ANCHOR_B_OFFSET}u;
      const SPRING_RECORD_VEC4S: u32 = ${SPRING_RECORD_VEC4S}u;

      fn springRecordBase(springIndex: u32) -> u32 {
        return springIndex * SPRING_RECORD_VEC4S;
      }

      fn loadSpringMetaWords(
        springRecords: ptr<storage, array<vec4f>, read_write>,
        springIndex: u32,
      ) -> vec4u {
        return bitcast<vec4u>(springRecords[springRecordBase(springIndex) + SPRING_RECORD_META_OFFSET]);
      }

      fn storeSpringMetaWords(
        springRecords: ptr<storage, array<vec4f>, read_write>,
        springIndex: u32,
        value: vec4u,
      ) {
        springRecords[springRecordBase(springIndex) + SPRING_RECORD_META_OFFSET] = bitcast<vec4f>(value);
      }

      fn loadSpringAnchorARest(
        springRecords: ptr<storage, array<vec4f>, read_write>,
        springIndex: u32,
      ) -> vec4f {
        return springRecords[springRecordBase(springIndex) + SPRING_RECORD_ANCHOR_A_OFFSET];
      }

      fn storeSpringAnchorARest(
        springRecords: ptr<storage, array<vec4f>, read_write>,
        springIndex: u32,
        value: vec4f,
      ) {
        springRecords[springRecordBase(springIndex) + SPRING_RECORD_ANCHOR_A_OFFSET] = value;
      }

      fn loadSpringAnchorBStiffness(
        springRecords: ptr<storage, array<vec4f>, read_write>,
        springIndex: u32,
      ) -> vec4f {
        return springRecords[springRecordBase(springIndex) + SPRING_RECORD_ANCHOR_B_OFFSET];
      }

      fn storeSpringAnchorBStiffness(
        springRecords: ptr<storage, array<vec4f>, read_write>,
        springIndex: u32,
        value: vec4f,
      ) {
        springRecords[springRecordBase(springIndex) + SPRING_RECORD_ANCHOR_B_OFFSET] = value;
      }
`);

export function springRecordBaseFloatIndex(springIndex: number): number {
  return springIndex * SPRING_RECORD_FLOATS;
}

export function springRecordVec4FloatIndex(springIndex: number, vec4Offset: number): number {
  return springRecordBaseFloatIndex(springIndex) + vec4Offset * 4;
}
