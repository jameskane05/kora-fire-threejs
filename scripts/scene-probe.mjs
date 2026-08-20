/**
 * Headless WebGPU smoke check for a sandbox scene, through the installed Chrome.
 * Usage: node scripts/scene-probe.mjs <scene-id> [seconds] [outPng] [baseUrl]
 * Reports console/page errors, median/p90 step ms from the perf HUD, and screenshots.
 *
 * Env knobs, all optional:
 *   PROFILE=1     print the hottest JS self-time frames
 *   SHOTS=n       spread n screenshots over the run instead of one at the end
 *   FLY_MS=ms     hold W to fly the desktop camera in (FLY_KEY to pick another key)
 *   SHOOT_MS=ms   hold RMB to fire projectiles at screen centre
 *   GRAB=1        LMB-drag whatever is at screen centre
 *   RESET=1       click Reset, reporting scene status either side of it
 *   DPR=n         device pixel ratio, to pair with CLIP for a sharp close-up
 *   CLIP=x,y,w,h  screenshot only this region of the viewport
 */
import { chromium } from 'playwright';

const scene = process.argv[2] ?? 'cliff-plateau-demo';
const seconds = Number(process.argv[3] ?? 8);
const out = process.argv[4] ?? `/tmp/${scene}.png`;
const base = process.argv[5] ?? 'https://localhost:5273';
const profile = process.env.PROFILE === '1';

const browser = await chromium.launch({
  channel: 'chrome',
  args: [
    '--enable-unsafe-webgpu',
    '--use-angle=metal',
    '--ignore-gpu-blocklist',
    '--ignore-certificate-errors',
  ],
});
const context = await browser.newContext({
  ignoreHTTPSErrors: true,
  viewport: { width: 1280, height: 800 },
  deviceScaleFactor: Number(process.env.DPR ?? 1),
});
const clipEnv = process.env.CLIP?.split(',').map(Number);
const clip = clipEnv?.length === 4
  ? { x: clipEnv[0], y: clipEnv[1], width: clipEnv[2], height: clipEnv[3] }
  : undefined;
const page = await context.newPage();
const problems = [];
page.on('console', (msg) => {
  if (msg.type() === 'error' || msg.type() === 'warning') problems.push(`[${msg.type()}] ${msg.text()}`);
});
page.on('pageerror', (err) => problems.push(`[pageerror] ${err.message}`));

await page.addInitScript(() => {
  localStorage.setItem('kora.sandbox.perf', '1');
});
await page.goto(`${base}/materials.html?exhibit=avbd&scene=${scene}`, {
  waitUntil: 'domcontentloaded',
  timeout: 60000,
});
// Fly the desktop camera in (WASD fly mode) so a screenshot can resolve limb detail.
const flyMs = Number(process.env.FLY_MS ?? 0);
if (flyMs > 0) {
  await page.waitForTimeout(3000);
  await page.mouse.click(640, 500);
  await page.keyboard.down(process.env.FLY_KEY ?? 'w');
  await page.waitForTimeout(flyMs);
  await page.keyboard.up(process.env.FLY_KEY ?? 'w');
}

// RMB holds the projectile trigger in free-fly mode; LMB drag grabs a body under the cursor.
const shootMs = Number(process.env.SHOOT_MS ?? 0);
if (shootMs > 0) {
  await page.waitForTimeout(3000);
  await page.mouse.move(512, 300);
  await page.mouse.down({ button: 'right' });
  await page.waitForTimeout(shootMs);
  await page.mouse.up({ button: 'right' });
}
if (process.env.GRAB === '1') {
  await page.waitForTimeout(2000);
  const status = () => page.evaluate(() => document.body.innerText.match(/crowd .*ragdolled/)?.[0] ?? '');
  console.log(`before grab: ${await status()}`);
  await page.mouse.move(512, 300);
  await page.mouse.down();
  for (let i = 0; i < 12; i++) {
    await page.mouse.move(512 + i * 6, 300 - i * 8);
    await page.waitForTimeout(60);
  }
  await page.waitForTimeout(400);
  console.log(`after grab: ${await status()}`);
  await page.mouse.up();
}

if (process.env.RESET === '1') {
  const status = () => page.evaluate(() => document.body.innerText.match(/crowd .*ragdolled/)?.[0] ?? '');
  await page.waitForTimeout(2500);
  console.log(`before reset: ${await status()}`);
  await page.click('#mat-reset');
  await page.waitForTimeout(1500);
  console.log(`after reset: ${await status()}`);
}

const shots = Number(process.env.SHOTS ?? 1);
for (let i = 0; i < shots; i++) {
  await page.waitForTimeout((seconds * 1000) / shots);
  if (shots > 1) {
    const path = out.replace(/\.png$/, `-${i}.png`);
    await page.screenshot({ path, clip });
    console.log(`saved ${path}`);
  }
}

let hot = '';
if (profile) {
  const cdp = await context.newCDPSession(page);
  await cdp.send('Profiler.enable');
  await cdp.send('Profiler.start');
  await page.waitForTimeout(4000);
  const { profile: prof } = await cdp.send('Profiler.stop');
  const self = new Map();
  const byId = new Map(prof.nodes.map((n) => [n.id, n]));
  const total = prof.timeDeltas.reduce((a, b) => a + Math.max(b, 0), 0);
  for (let i = 0; i < prof.samples.length; i++) {
    const node = byId.get(prof.samples[i]);
    if (!node) continue;
    const { functionName, url, lineNumber } = node.callFrame;
    const key = `${functionName || '(anon)'} ${url.split('/').pop() ?? ''}:${lineNumber}`;
    self.set(key, (self.get(key) ?? 0) + Math.max(prof.timeDeltas[i] ?? 0, 0));
  }
  hot = [...self.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 18)
    .map(([k, us]) => `  ${(us / 1000).toFixed(1)} ms  ${((us / total) * 100).toFixed(1)}%  ${k}`)
    .join('\n');
}

const stats = await page.evaluate(async () => {
  const read = () => document.getElementById('stats')?.textContent ?? '';
  const steps = [];
  for (let i = 0; i < 24; i++) {
    const m = /step ([\d.]+) ms/.exec(read());
    if (m) steps.push(Number(m[1]));
    await new Promise((r) => setTimeout(r, 125));
  }
  steps.sort((a, b) => a - b);
  return {
    text: read(),
    median: steps[steps.length >> 1] ?? -1,
    p90: steps[Math.floor(steps.length * 0.9)] ?? -1,
  };
});
await page.screenshot({ path: out, clip });

console.log(`stats: ${stats.text}`);
console.log(`step median ${stats.median.toFixed(2)} ms · p90 ${stats.p90.toFixed(2)} ms`);
if (hot) console.log(`hot frames (self time):\n${hot}`);
console.log(problems.length ? `problems:\n${[...new Set(problems)].join('\n')}` : 'problems: none');
console.log(`saved ${out}`);
await browser.close();
