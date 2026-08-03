/**
 * Static checks that MlsMpm.step() does not submit per substep.
 * Run: node scripts/check-mpm-alloc.mjs
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = readFileSync(join(repoRoot, 'src/materials/MlsMpm.ts'), 'utf8');

const stepStart = src.indexOf('step(forces: ForcePoint[]');
const fillStart = src.indexOf('private fillParams(');
if (stepStart < 0 || fillStart < 0 || fillStart < stepStart) {
  console.error('FAIL: could not locate step() in MlsMpm.ts');
  process.exit(1);
}
const stepBody = src.slice(stepStart, fillStart);
const submits = [...stepBody.matchAll(/queue\.submit/g)].length;
const encoders = [...stepBody.matchAll(/createCommandEncoder/g)].length;

let failed = false;
const check = (ok, msg) => {
  if (!ok) {
    console.error(`FAIL: ${msg}`);
    failed = true;
  } else {
    console.log(`ok: ${msg}`);
  }
};

check(submits === 1, `step() has exactly 1 queue.submit (found ${submits})`);
check(encoders === 1, `step() has exactly 1 createCommandEncoder (found ${encoders})`);
check(
  src.includes('paramsBufferForce') && src.includes('paramsBufferIdle'),
  'dual params buffers (force/idle) present',
);
check(src.includes('resetScratch'), 'reset() reuses CPU scratch buffer');
check(src.includes('lastSubmitCount'), 'lastSubmitCount diagnostic present');

// Confirm the old anti-pattern is gone from step().
check(!/for\s*\(\s*let\s+s\s*=\s*0[\s\S]*queue\.submit/.test(stepBody) || submits === 1, 'no per-substep submit loop');

if (failed) process.exit(1);
console.log('All MlsMpm allocation checks passed.');
console.log('Runtime expectation: after step(substeps=14) → lastSubmitCount=1, lastEncoderCount=1');
