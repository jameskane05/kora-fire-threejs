import { webkit } from 'playwright';

const url = process.argv[2]
  ?? 'https://localhost:5273/materials.html?exhibit=avbd&scene=single-5&avbdnan=1&avbdbvh=0&avbdnoindirect=1';
const runMs = Number(process.argv[3] ?? 20000);

const browser = await webkit.launch();
const context = await browser.newContext({ ignoreHTTPSErrors: true });
const page = await context.newPage();

page.on('console', (msg) => {
  console.log(`[${msg.type()}] ${msg.text()}`);
});
page.on('pageerror', (err) => {
  console.log(`[pageerror] ${err.message}`);
});

await page.goto(url, { waitUntil: 'load', timeout: 30000 });
await page.waitForTimeout(runMs);
await browser.close();
