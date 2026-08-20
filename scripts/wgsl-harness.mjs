import { webkit, chromium } from 'playwright';
import { readFileSync } from 'node:fs';

const shaderPath = process.argv[2] ?? '/tmp/kora-wgsl/043_compute_AVBD_Body_Primal_Solve_Generic.wgsl';
const engine = process.argv[3] === 'chromium' ? chromium : webkit;
const code = readFileSync(shaderPath, 'utf8');

const browser = await engine.launch(
  process.argv[3] === 'chromium'
    ? { channel: 'chrome', args: ['--enable-unsafe-webgpu', '--enable-gpu', '--use-angle=metal', '--headless=new'] }
    : {},
);
const context = await browser.newContext({ ignoreHTTPSErrors: true });
const page = await context.newPage();
page.on('console', (msg) => console.log(`[page ${msg.type()}] ${msg.text()}`));
await page.goto('https://localhost:5273/scripts/wgsl-harness.mjs', { waitUntil: 'load' });

const result = await page.evaluate(async (wgsl) => {
  const adapter = await navigator.gpu?.requestAdapter();
  if (!adapter) return { error: 'no adapter' };
  const features = [];
  for (const f of adapter.features) features.push(f);
  const device = await adapter.requestDevice({
    requiredFeatures: features,
    requiredLimits: {
      maxStorageBuffersPerShaderStage: Math.min(10, adapter.limits.maxStorageBuffersPerShaderStage),
    },
  });
  const errors = [];
  device.pushErrorScope('validation');

  const module = device.createShaderModule({ code: wgsl });
  const info = await module.getCompilationInfo();
  for (const m of info.messages) {
    if (m.type === 'error') errors.push(`compile: ${m.message}`);
  }
  if (errors.length) return { errors };

  let pipeline;
  try {
    pipeline = await device.createComputePipelineAsync({
      layout: 'auto',
      compute: { module, entryPoint: 'main' },
    });
  } catch (e) {
    return { errors: [`pipeline: ${e.message} | features: ${features.join(',')}`] };
  }

  const mkBuf = (f32len, data) => {
    const buf = device.createBuffer({
      size: f32len * 4,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
    });
    if (data) device.queue.writeBuffer(buf, 0, data);
    return buf;
  };

  const maxBodies = 2;
  // initialPose: 2 vec4 per body: [pos, invMass], [quat]
  const initialPose = new Float32Array([
    0, 0.3, 0, 1, 0, 0, 0, 1,
    0, -0.5, 0, 0, 0, 0, 0, 1,
  ]);
  // inertialPose: 4 vec4 per body: [inertialPos, invMass], [inertialQ], [guessPos, invMass], [guessQ]
  const inertialPose = new Float32Array([
    0, 0.297275, 0, 1, 0, 0, 0, 1, 0, 0.3, 0, 1, 0, 0, 0, 1,
    0, -0.5, 0, 0, 0, 0, 0, 1, 0, -0.5, 0, 0, 0, 0, 0, 1,
  ]);
  // derivedInvInertia: 3 vec4 per body
  const ii = 16.666666;
  const derivedInvInertia = new Float32Array([
    ii, 0, 0, 1, ii, 0, ii, ii, ii, ii, 0, 0,
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  ]);
  const constraintCounts = new Uint32Array([0, 0]);
  const constraintRefs = new Uint32Array(2 * 64);

  const bufs = [
    mkBuf(initialPose.length, initialPose),
    mkBuf(inertialPose.length, inertialPose),
    mkBuf(16 * 4),                          // bodySolveOutputPose (+ debug slots)
    mkBuf(derivedInvInertia.length, derivedInvInertia),
  ];
  const countsBuf = device.createBuffer({
    size: constraintCounts.byteLength,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
  });
  device.queue.writeBuffer(countsBuf, 0, constraintCounts);
  const refsBuf = device.createBuffer({
    size: constraintRefs.byteLength,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
  });
  device.queue.writeBuffer(refsBuf, 0, constraintRefs);
  const pairContacts = mkBuf(16 * 9 * 4);
  const jointRecords = mkBuf(16 * 12 * 4);
  const springRecords = mkBuf(16 * 4 * 4);

  // uniforms nodeUniform9..35 (27 f32)
  const u = new Float32Array(28);
  const set = (idx, v) => { u[idx - 9] = v; };
  set(9, 2);      // bodyCount
  set(10, 0);     // bodyIndexBase
  set(11, 2);     // dispatchBodyCount
  set(12, 0);     // bodySolveMode
  set(13, 0);     // currentColor
  set(14, 0);     // sweepOffset
  set(15, 0.95);  // regularizationAlpha
  set(16, 0.95);  // tangentialRegularizationAlpha
  set(17, 1);     // relaxation
  set(18, 1);     // frictionRelaxation
  set(19, 0.6);   // frictionStatic
  set(20, 0.4);   // frictionDynamic
  set(21, 1);     // useReferenceTangentialUpdate
  set(22, 1);     // frictionSolveScale
  set(23, 100);   // kStart
  set(24, 1e6);   // dualForceMax
  set(25, 0);     // enableNormalReleaseHeuristic
  set(26, 0);     // enableHessianRescaling
  set(27, 1 / 240); // dt
  set(28, 1);     // inertialDiagWeight
  set(29, 10);    // maxLinearCorrection
  set(30, 10);    // maxAngularCorrection
  set(31, 0);     // useLocalDiagonalInertia (generic mode uniform)
  set(32, 1);     // useNormalContactMargin
  set(33, 1);     // useLocalContactArms
  set(34, 0);     // alwaysStampNormalHessian
  set(35, 0);     // alwaysStampTangentialHessian
  const uniformBuf = device.createBuffer({
    size: 128,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
  device.queue.writeBuffer(uniformBuf, 0, u);

  const bindGroup = device.createBindGroup({
    layout: pipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: { buffer: bufs[0] } },
      { binding: 1, resource: { buffer: bufs[1] } },
      { binding: 2, resource: { buffer: bufs[2] } },
      { binding: 3, resource: { buffer: bufs[3] } },
      { binding: 4, resource: { buffer: countsBuf } },
      { binding: 5, resource: { buffer: refsBuf } },
      { binding: 6, resource: { buffer: pairContacts } },
      { binding: 7, resource: { buffer: jointRecords } },
      { binding: 8, resource: { buffer: springRecords } },
      { binding: 9, resource: { buffer: uniformBuf } },
    ],
  });

  const encoder = device.createCommandEncoder();
  const pass = encoder.beginComputePass();
  pass.setPipeline(pipeline);
  pass.setBindGroup(0, bindGroup);
  pass.dispatchWorkgroups(1);
  pass.end();
  const readback = device.createBuffer({
    size: 16 * 4 * 4,
    usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
  });
  encoder.copyBufferToBuffer(bufs[2], 0, readback, 0, readback.size);
  device.queue.submit([encoder.finish()]);
  await readback.mapAsync(GPUMapMode.READ);
  const out = Array.from(new Float32Array(readback.getMappedRange()));
  readback.unmap();
  const scopeError = await device.popErrorScope();
  const rows = {};
  for (let r = 0; r < 16; r++) rows[`v${r}`] = out.slice(r * 4, r * 4 + 4);
  return {
    scopeError: scopeError ? scopeError.message : null,
    body0Pos: out.slice(0, 4),
    debug: rows,
  };
}, code);

console.log(JSON.stringify(result, null, 2));
await browser.close();
