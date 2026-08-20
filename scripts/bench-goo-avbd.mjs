/**
 * Headless laptop bench: MLS-MPM goo vs AVBD soft gel.
 * Usage: node scripts/bench-goo-avbd.mjs [url]
 * Default URL: https://127.0.0.1:5273/materials.html?bench=1 (vite dev; base `/`).
 * Preview builds use `/kora-fire-threejs/` — prefer the dev server for local benches.
 */
import puppeteer from 'puppeteer-core';

const CHROME =
  process.env.CHROME ||
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const url = process.argv[2] || 'https://127.0.0.1:5273/materials.html?bench=1';

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  ignoreHTTPSErrors: true,
  args: [
    '--enable-unsafe-webgpu',
    '--ignore-certificate-errors',
    '--use-angle=metal',
    '--enable-features=Vulkan,UseSkiaRenderer',
  ],
});

try {
  const page = await browser.newPage();
  page.on('console', (msg) => {
    const t = msg.text();
    if (t.includes('Sandbox bench') || t.includes('MPM goo') || t.includes('AVBD')) {
      console.log('[page]', t);
    }
  });
  page.on('pageerror', (err) => console.error('[pageerror]', err.message));

  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => typeof window.koraRunBench === 'function', {
    timeout: 30000,
  });

  const report = await page.evaluate(async () => {
    const r = await window.koraRunBench();
    return r;
  });

  console.log(JSON.stringify(report, null, 2));
  console.log('\n' + report.summary);
} finally {
  await browser.close();
}
