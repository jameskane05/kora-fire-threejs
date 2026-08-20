import { webkit, chromium } from 'playwright';
import { readFileSync } from 'node:fs';

const shaderPath = process.argv[2];
const engine = process.argv[3] === 'chromium' ? chromium : webkit;
const code = readFileSync(shaderPath, 'utf8');

const browser = await engine.launch(
  process.argv[3] === 'chromium'
    ? { channel: 'chrome', args: ['--enable-unsafe-webgpu', '--enable-gpu', '--use-angle=metal', '--headless=new'] }
    : {},
);
const context = await browser.newContext({ ignoreHTTPSErrors: true });
const page = await context.newPage();
await page.goto('https://localhost:5273/scripts/wgsl-harness.mjs', { waitUntil: 'load' });

const result = await page.evaluate(async (wgsl) => {
  const adapter = await navigator.gpu?.requestAdapter();
  if (!adapter) return { error: 'no adapter' };
  const device = await adapter.requestDevice();
  const module = device.createShaderModule({ code: wgsl });
  const info = await module.getCompilationInfo();
  const errors = info.messages.filter((m) => m.type === 'error').map((m) => m.message);
  if (errors.length) return { errors };
  let pipeline;
  try {
    pipeline = await device.createComputePipelineAsync({
      layout: 'auto',
      compute: { module, entryPoint: 'main' },
    });
  } catch (e) {
    return { errors: [`pipeline: ${e.message}`] };
  }
  const outBuf = device.createBuffer({
    size: 16 * 4 * 4,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
  });
  const bindGroup = device.createBindGroup({
    layout: pipeline.getBindGroupLayout(0),
    entries: [{ binding: 0, resource: { buffer: outBuf } }],
  });
  const encoder = device.createCommandEncoder();
  const pass = encoder.beginComputePass();
  pass.setPipeline(pipeline);
  pass.setBindGroup(0, bindGroup);
  pass.dispatchWorkgroups(1);
  pass.end();
  const readback = device.createBuffer({
    size: outBuf.size,
    usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
  });
  encoder.copyBufferToBuffer(outBuf, 0, readback, 0, readback.size);
  device.queue.submit([encoder.finish()]);
  await readback.mapAsync(GPUMapMode.READ);
  const out = Array.from(new Float32Array(readback.getMappedRange()));
  readback.unmap();
  const rows = {};
  for (let r = 0; r < 8; r++) rows[`v${r}`] = out.slice(r * 4, r * 4 + 4);
  return rows;
}, code);

console.log(JSON.stringify(result));
await browser.close();
