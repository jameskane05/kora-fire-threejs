import { webkit } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';

const url = process.argv[2]
  ?? 'https://localhost:5273/materials.html?exhibit=avbd&scene=line-1x1x1&avbdnan=1&avbdbvh=0&avbdnoindirect=1';
const outDir = process.argv[3] ?? '/tmp/kora-wgsl';

const browser = await webkit.launch();
const context = await browser.newContext({ ignoreHTTPSErrors: true });
const page = await context.newPage();

await page.addInitScript(() => {
  window.__wgsl = [];
  const orig = GPUDevice.prototype.createShaderModule;
  GPUDevice.prototype.createShaderModule = function (desc) {
    window.__wgsl.push({ label: desc?.label ?? '', code: desc?.code ?? '' });
    return orig.call(this, desc);
  };
});

page.on('console', (msg) => {
  const t = msg.text();
  if (t.includes('solver state') || t.includes('non-finite')) console.log(`[${msg.type()}] ${t.slice(0, 200)}`);
});

await page.goto(url, { waitUntil: 'load', timeout: 30000 });
await page.waitForTimeout(12000);

const shaders = await page.evaluate(() => window.__wgsl);
mkdirSync(outDir, { recursive: true });
shaders.forEach((s, idx) => {
  const safe = (s.label || `unlabeled_${idx}`).replace(/[^a-zA-Z0-9_-]+/g, '_').slice(0, 80);
  writeFileSync(`${outDir}/${String(idx).padStart(3, '0')}_${safe}.wgsl`, s.code);
});
console.log(`captured ${shaders.length} shader modules to ${outDir}`);
await browser.close();
