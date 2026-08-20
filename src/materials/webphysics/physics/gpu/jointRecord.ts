import { wgsl } from './tslCompat';

export const JOINT_RECORD_META_OFFSET = 0;
export const JOINT_RECORD_ANCHOR_A_OFFSET = 1;
export const JOINT_RECORD_ANCHOR_B_OFFSET = 2;
export const JOINT_RECORD_REST_RELATIVE_ROTATION_OFFSET = 3;
export const JOINT_RECORD_STIFFNESS_OFFSET = 4;
export const JOINT_RECORD_C0_LIN_OFFSET = 5;
export const JOINT_RECORD_C0_ANG_OFFSET = 6;
export const JOINT_RECORD_LAMBDA_LIN_OFFSET = 7;
export const JOINT_RECORD_LAMBDA_ANG_OFFSET = 8;
export const JOINT_RECORD_PENALTY_LIN_OFFSET = 9;
export const JOINT_RECORD_PENALTY_ANG_OFFSET = 10;
export const JOINT_RECORD_VEC4S = 11;
export const JOINT_RECORD_FLOATS = JOINT_RECORD_VEC4S * 4;

export const jointRecordHelpers = wgsl(/* wgsl */`
      const JOINT_RECORD_META_OFFSET: u32 = ${JOINT_RECORD_META_OFFSET}u;
      const JOINT_RECORD_ANCHOR_A_OFFSET: u32 = ${JOINT_RECORD_ANCHOR_A_OFFSET}u;
      const JOINT_RECORD_ANCHOR_B_OFFSET: u32 = ${JOINT_RECORD_ANCHOR_B_OFFSET}u;
      const JOINT_RECORD_REST_RELATIVE_ROTATION_OFFSET: u32 = ${JOINT_RECORD_REST_RELATIVE_ROTATION_OFFSET}u;
      const JOINT_RECORD_STIFFNESS_OFFSET: u32 = ${JOINT_RECORD_STIFFNESS_OFFSET}u;
      const JOINT_RECORD_C0_LIN_OFFSET: u32 = ${JOINT_RECORD_C0_LIN_OFFSET}u;
      const JOINT_RECORD_C0_ANG_OFFSET: u32 = ${JOINT_RECORD_C0_ANG_OFFSET}u;
      const JOINT_RECORD_LAMBDA_LIN_OFFSET: u32 = ${JOINT_RECORD_LAMBDA_LIN_OFFSET}u;
      const JOINT_RECORD_LAMBDA_ANG_OFFSET: u32 = ${JOINT_RECORD_LAMBDA_ANG_OFFSET}u;
      const JOINT_RECORD_PENALTY_LIN_OFFSET: u32 = ${JOINT_RECORD_PENALTY_LIN_OFFSET}u;
      const JOINT_RECORD_PENALTY_ANG_OFFSET: u32 = ${JOINT_RECORD_PENALTY_ANG_OFFSET}u;
      const JOINT_RECORD_VEC4S: u32 = ${JOINT_RECORD_VEC4S}u;

      fn jointRecordBase(jointIndex: u32) -> u32 {
        return jointIndex * JOINT_RECORD_VEC4S;
      }

      fn loadJointMetaWords(jointRecords: ptr<storage, array<vec4f>, read_write>, jointIndex: u32) -> vec4u {
        return bitcast<vec4u>(jointRecords[jointRecordBase(jointIndex) + JOINT_RECORD_META_OFFSET]);
      }

      fn storeJointMetaWords(
        jointRecords: ptr<storage, array<vec4f>, read_write>,
        jointIndex: u32,
        value: vec4u,
      ) {
        jointRecords[jointRecordBase(jointIndex) + JOINT_RECORD_META_OFFSET] = bitcast<vec4f>(value);
      }

      fn loadJointAnchorA(jointRecords: ptr<storage, array<vec4f>, read_write>, jointIndex: u32) -> vec4f {
        return jointRecords[jointRecordBase(jointIndex) + JOINT_RECORD_ANCHOR_A_OFFSET];
      }

      fn storeJointAnchorA(
        jointRecords: ptr<storage, array<vec4f>, read_write>,
        jointIndex: u32,
        value: vec4f,
      ) {
        jointRecords[jointRecordBase(jointIndex) + JOINT_RECORD_ANCHOR_A_OFFSET] = value;
      }

      fn loadJointAnchorB(jointRecords: ptr<storage, array<vec4f>, read_write>, jointIndex: u32) -> vec4f {
        return jointRecords[jointRecordBase(jointIndex) + JOINT_RECORD_ANCHOR_B_OFFSET];
      }

      fn storeJointAnchorB(
        jointRecords: ptr<storage, array<vec4f>, read_write>,
        jointIndex: u32,
        value: vec4f,
      ) {
        jointRecords[jointRecordBase(jointIndex) + JOINT_RECORD_ANCHOR_B_OFFSET] = value;
      }

      fn loadJointRestRelativeRotation(
        jointRecords: ptr<storage, array<vec4f>, read_write>,
        jointIndex: u32,
      ) -> vec4f {
        return jointRecords[jointRecordBase(jointIndex) + JOINT_RECORD_REST_RELATIVE_ROTATION_OFFSET];
      }

      fn storeJointRestRelativeRotation(
        jointRecords: ptr<storage, array<vec4f>, read_write>,
        jointIndex: u32,
        value: vec4f,
      ) {
        jointRecords[jointRecordBase(jointIndex) + JOINT_RECORD_REST_RELATIVE_ROTATION_OFFSET] = value;
      }

      fn loadJointStiffness(jointRecords: ptr<storage, array<vec4f>, read_write>, jointIndex: u32) -> vec4f {
        return jointRecords[jointRecordBase(jointIndex) + JOINT_RECORD_STIFFNESS_OFFSET];
      }

      fn storeJointStiffness(
        jointRecords: ptr<storage, array<vec4f>, read_write>,
        jointIndex: u32,
        value: vec4f,
      ) {
        jointRecords[jointRecordBase(jointIndex) + JOINT_RECORD_STIFFNESS_OFFSET] = value;
      }

      fn loadJointC0Lin(jointRecords: ptr<storage, array<vec4f>, read_write>, jointIndex: u32) -> vec4f {
        return jointRecords[jointRecordBase(jointIndex) + JOINT_RECORD_C0_LIN_OFFSET];
      }

      fn storeJointC0Lin(
        jointRecords: ptr<storage, array<vec4f>, read_write>,
        jointIndex: u32,
        value: vec4f,
      ) {
        jointRecords[jointRecordBase(jointIndex) + JOINT_RECORD_C0_LIN_OFFSET] = value;
      }

      fn loadJointC0Ang(jointRecords: ptr<storage, array<vec4f>, read_write>, jointIndex: u32) -> vec4f {
        return jointRecords[jointRecordBase(jointIndex) + JOINT_RECORD_C0_ANG_OFFSET];
      }

      fn storeJointC0Ang(
        jointRecords: ptr<storage, array<vec4f>, read_write>,
        jointIndex: u32,
        value: vec4f,
      ) {
        jointRecords[jointRecordBase(jointIndex) + JOINT_RECORD_C0_ANG_OFFSET] = value;
      }

      fn loadJointLambdaLin(jointRecords: ptr<storage, array<vec4f>, read_write>, jointIndex: u32) -> vec4f {
        return jointRecords[jointRecordBase(jointIndex) + JOINT_RECORD_LAMBDA_LIN_OFFSET];
      }

      fn storeJointLambdaLin(
        jointRecords: ptr<storage, array<vec4f>, read_write>,
        jointIndex: u32,
        value: vec4f,
      ) {
        jointRecords[jointRecordBase(jointIndex) + JOINT_RECORD_LAMBDA_LIN_OFFSET] = value;
      }

      fn loadJointLambdaAng(jointRecords: ptr<storage, array<vec4f>, read_write>, jointIndex: u32) -> vec4f {
        return jointRecords[jointRecordBase(jointIndex) + JOINT_RECORD_LAMBDA_ANG_OFFSET];
      }

      fn storeJointLambdaAng(
        jointRecords: ptr<storage, array<vec4f>, read_write>,
        jointIndex: u32,
        value: vec4f,
      ) {
        jointRecords[jointRecordBase(jointIndex) + JOINT_RECORD_LAMBDA_ANG_OFFSET] = value;
      }

      fn loadJointPenaltyLin(jointRecords: ptr<storage, array<vec4f>, read_write>, jointIndex: u32) -> vec4f {
        return jointRecords[jointRecordBase(jointIndex) + JOINT_RECORD_PENALTY_LIN_OFFSET];
      }

      fn storeJointPenaltyLin(
        jointRecords: ptr<storage, array<vec4f>, read_write>,
        jointIndex: u32,
        value: vec4f,
      ) {
        jointRecords[jointRecordBase(jointIndex) + JOINT_RECORD_PENALTY_LIN_OFFSET] = value;
      }

      fn loadJointPenaltyAng(jointRecords: ptr<storage, array<vec4f>, read_write>, jointIndex: u32) -> vec4f {
        return jointRecords[jointRecordBase(jointIndex) + JOINT_RECORD_PENALTY_ANG_OFFSET];
      }

      fn storeJointPenaltyAng(
        jointRecords: ptr<storage, array<vec4f>, read_write>,
        jointIndex: u32,
        value: vec4f,
      ) {
        jointRecords[jointRecordBase(jointIndex) + JOINT_RECORD_PENALTY_ANG_OFFSET] = value;
      }
`);

export function jointRecordBaseFloatIndex(jointIndex: number): number {
  return jointIndex * JOINT_RECORD_FLOATS;
}

export function jointRecordVec4FloatIndex(jointIndex: number, vec4Offset: number): number {
  return jointRecordBaseFloatIndex(jointIndex) + vec4Offset * 4;
}
