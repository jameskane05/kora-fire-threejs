/**
 * Guarded typecheck: project tsc (TS 7 native + three/webgpu) has ballooned past
 * 1GB RSS and wedged the machine when left unbounded. Cap wall time and kill hard.
 */
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(path.join(root, 'package.json'));
const tsc = require.resolve('typescript/bin/tsc');

const MAX_MS = Number(process.env.TYPECHECK_TIMEOUT_MS ?? 45_000);
const child = spawn(process.execPath, [tsc, '--noEmit', '-p', 'tsconfig.json'], {
  cwd: root,
  stdio: 'inherit',
  env: {
    ...process.env,
    NODE_OPTIONS: [process.env.NODE_OPTIONS, '--max-old-space-size=1024'].filter(Boolean).join(' '),
  },
});

const timer = setTimeout(() => {
  console.error(`[typecheck] exceeded ${MAX_MS}ms — killing (tsc OOMs this machine if left unbounded)`);
  try {
    child.kill('SIGKILL');
  } catch {
    /* ignore */
  }
  process.exit(1);
}, MAX_MS);

child.on('exit', (code, signal) => {
  clearTimeout(timer);
  if (signal) {
    console.error(`[typecheck] killed by ${signal}`);
    process.exit(1);
  }
  process.exit(code ?? 1);
});
