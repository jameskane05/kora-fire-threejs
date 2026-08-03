import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const threeRoot = join(root, 'node_modules', 'three');
// WebGPU XR MSAA — https://github.com/mrdoob/three.js/pull/34120
const pin = 'd6521c46d5a8978c75a997a3748c1861d55c5b71';
// Single-pass XR output — https://github.com/mrdoob/three.js/pull/34153 (still open)
const singlePassPr = 34153;
const webgpuBuild = join(threeRoot, 'build', 'three.webgpu.js');

function run(command, args, cwd) {
  const result = spawnSync(command, args, { cwd, stdio: 'inherit', shell: process.platform === 'win32' });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

function buildHasFeatures(file) {
  if (!existsSync(file)) return false;
  const text = readFileSync(file, 'utf8');
  const msaa =
    text.includes('_getExternalMSAATextures') && !text.includes('WebGPU XR does not support MSAA yet');
  const singlePass = text.includes('function getInlineOutputContextNode');
  return msaa && singlePass;
}

if (!existsSync(threeRoot)) {
  console.error('scripts/build-three: node_modules/three is missing; run npm install first');
  process.exit(1);
}

if (buildHasFeatures(webgpuBuild)) {
  console.log('scripts/build-three: three.webgpu.js already includes MSAA + single-pass XR');
  process.exit(0);
}

// npm's github install omits utils/, so the package cannot rebuild itself in place.
// Fetch the MSAA pin, apply #34153, build, and copy artifacts into node_modules/three/build.
const work = mkdtempSync(join(tmpdir(), 'kora-three-build-'));
try {
  run('git', ['init'], work);
  run('git', ['remote', 'add', 'origin', 'https://github.com/mrdoob/three.js.git'], work);
  run('git', ['fetch', '--depth', '1', 'origin', pin], work);
  run('git', ['checkout', 'FETCH_HEAD'], work);

  const patchPath = join(work, `${singlePassPr}.diff`);
  const patch = spawnSync(
    'curl',
    ['-fsSL', `https://patch-diff.githubusercontent.com/raw/mrdoob/three.js/pull/${singlePassPr}.diff`, '-o', patchPath],
    { stdio: 'inherit' },
  );
  if (patch.status !== 0) process.exit(patch.status ?? 1);
  run('git', ['apply', patchPath], work);

  run('npm', ['install', '--ignore-scripts'], work);
  run('npm', ['run', 'build'], work);

  cpSync(join(work, 'build'), join(threeRoot, 'build'), { recursive: true });

  if (!buildHasFeatures(webgpuBuild)) {
    console.error('scripts/build-three: built three.webgpu.js is missing MSAA and/or single-pass XR');
    process.exit(1);
  }
  console.log(`scripts/build-three: installed three build from ${pin} + PR #${singlePassPr}`);
} finally {
  rmSync(work, { recursive: true, force: true });
}
