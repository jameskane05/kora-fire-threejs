import { storage as rawStorage } from 'three/tsl';

export { localId, uniform, wgsl, wgslFn, workgroupId } from 'three/tsl';

// three/tsl typings currently miss WGSL scalar/vector spellings we use
// (e.g. vec4f), so keep a narrow compatibility wrapper in one place.
export const storage = ((value: unknown, type: string, count: number) =>
  rawStorage(value as never, type as never, count as never)) as (
  value: unknown,
  type: string,
  count: number,
) => any;
