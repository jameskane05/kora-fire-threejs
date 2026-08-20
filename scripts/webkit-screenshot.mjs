import { webkit } from 'playwright';

const url = process.argv[2];
const out = process.argv[3] ?? '/tmp/webkit-shot.png';
const waitMs = Number(process.argv[4] ?? 10000);

const browser = await webkit.launch();
const context = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1024, height: 768 } });
const page = await context.newPage();
await page.goto(url, { waitUntil: 'load', timeout: 30000 });
await page.waitForTimeout(waitMs);
await page.screenshot({ path: out });
console.log(`saved ${out}`);
await browser.close();
