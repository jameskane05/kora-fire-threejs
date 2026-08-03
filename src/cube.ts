/* XRGPUBinding is still missing from lib.dom in places; declare the surface we use. */
declare class XRGPUBinding {
  constructor(session: XRSession, device: GPUDevice);
  createProjectionLayer(init: { colorFormat: GPUTextureFormat; scaleFactor?: number }): XRProjectionLayer;
  getViewSubImage(layer: XRProjectionLayer, view: XRView): {
    viewport: XRViewport;
    colorTexture: GPUTexture;
    getViewDescriptor?: () => GPUTextureViewDescriptor;
  };
  getPreferredColorFormat?: () => GPUTextureFormat;
}

/**
 * Bare WebGPU + WebXR cube:
 *
 *   /cube.html              — three.js WebGPURenderer.xr (default)
 *   /cube.html?native=1     — dual-pass XRGPUBinding (per-eye render passes)
 *   /cube.html?native=1&multiview=1 — attempt view-instancing single pass (falls back if unsupported)
 *   &stress=N               — draw N cubes per eye/pass for geometry A/B (native only)
 *   &fit=1 / &none=1        — viewport modes (dual-pass native)
 */
import {
  AmbientLight,
  BoxGeometry,
  Mesh,
  MeshBasicNodeMaterial,
  PerspectiveCamera,
  Scene,
  WebGPURenderer,
} from 'three/webgpu';

const button = document.getElementById('xr-button') as HTMLButtonElement;
const note = document.getElementById('note');
const query = new URLSearchParams(location.search);
/** Default is three.js WebGPU XR. `?native=1` is the clustered-style XRGPUBinding path. */
const useNative = query.has('native');
const useThree = !useNative;
/** Request a view-instancing / multiview present when the UA exposes it. */
const wantMultiview = query.has('multiview');
/** Extra cube draws for encode/geometry stress (native paths). */
const stressCount = Math.max(1, Math.min(4096, Number(query.get('stress') ?? '1') || 1));

/** Draft / experimental feature names seen in proposals and Chromium prototypes. */
const VIEW_INSTANCING_FEATURE_CANDIDATES = [
  'view-instancing',
  'chromium-experimental-multiview',
  'multiview',
] as const;

const log = (message: string, detail?: unknown) => {
  if (detail === undefined) console.info(`[cube] ${message}`);
  else console.info(`[cube] ${message}`, detail);
};

function pickViewInstancingFeature(adapter: GPUAdapter): string | null {
  for (const name of VIEW_INSTANCING_FEATURE_CANDIDATES) {
    if (adapter.features.has(name as GPUFeatureName)) return name;
  }
  // Also catch any *multiview* / *view-instanc* names the UA ships under.
  for (const name of adapter.features) {
    const lower = name.toLowerCase();
    if (lower.includes('multiview') || lower.includes('view-instanc')) return name;
  }
  return null;
}

function probeAdapterFeatures(adapter: GPUAdapter): void {
  const all = [...adapter.features].sort();
  const related = all.filter(
    (n) =>
      n.toLowerCase().includes('multiview') ||
      n.toLowerCase().includes('view-instanc') ||
      n.toLowerCase().includes('array'),
  );
  log(`adapter features (${all.length}): ${all.join(', ') || '(none)'}`);
  log(`adapter multiview-related: ${related.join(', ') || '(none)'}`);
  const limits = adapter.limits as GPUSupportedLimits & { maxViewInstanceCount?: number };
  log(
    `adapter limits | maxTextureArrayLayers ${limits.maxTextureArrayLayers}` +
      (limits.maxViewInstanceCount != null
        ? ` | maxViewInstanceCount ${limits.maxViewInstanceCount}`
        : ' | maxViewInstanceCount (absent)'),
  );
}

// ---------------------------------------------------------------------------
// Shared scene bits for the three.js path (and a spinning angle for native)
// ---------------------------------------------------------------------------

let angle = 0;

// ---------------------------------------------------------------------------
// Native path — mirrors webgpu-clustered-shading's XR loop
// ---------------------------------------------------------------------------

const CUBE_VERTS = new Float32Array([
  // position (3) + colour (3) — unit cube centred at origin
  -1, -1, 1, 1, 0.4, 0.2, 1, -1, 1, 1, 0.5, 0.2, 1, 1, 1, 1, 0.6, 0.3, -1, 1, 1, 1, 0.5, 0.3,
  -1, -1, -1, 0.8, 0.3, 0.15, 1, -1, -1, 0.8, 0.4, 0.15, 1, 1, -1, 0.9, 0.5, 0.2, -1, 1, -1, 0.8, 0.4, 0.2,
]);
const CUBE_INDICES = new Uint16Array([
  0, 1, 2, 0, 2, 3, 1, 5, 6, 1, 6, 2, 5, 4, 7, 5, 7, 6, 4, 0, 3, 4, 3, 7, 3, 2, 6, 3, 6, 7, 4, 5, 1, 4, 1, 0,
]);

const NATIVE_WGSL = /* wgsl */ `
struct Uniforms {
  mvp : mat4x4f,
};
@group(0) @binding(0) var<uniform> u : Uniforms;

struct VSIn {
  @location(0) position : vec3f,
  @location(1) colour : vec3f,
};
struct VSOut {
  @builtin(position) position : vec4f,
  @location(0) colour : vec3f,
};

@vertex fn vs(input : VSIn) -> VSOut {
  var out : VSOut;
  out.position = u.mvp * vec4f(input.position, 1.0);
  out.colour = input.colour;
  return out;
}

@fragment fn fs(input : VSOut) -> @location(0) vec4f {
  return vec4f(input.colour, 1.0);
}
`;

/** Draft view-instancing shader — enable name may need UA-specific tweaks. */
const MULTIVIEW_WGSL = /* wgsl */ `
enable view_instancing;

struct Uniforms {
  mvp : array<mat4x4f, 2>,
};
@group(0) @binding(0) var<uniform> u : Uniforms;

struct VSIn {
  @location(0) position : vec3f,
  @location(1) colour : vec3f,
};
struct VSOut {
  @builtin(position) position : vec4f,
  @location(0) colour : vec3f,
};

@vertex fn vs(input : VSIn, @builtin(view_index) view_index : u32) -> VSOut {
  var out : VSOut;
  out.position = u.mvp[view_index] * vec4f(input.position, 1.0);
  out.colour = input.colour;
  return out;
}

@fragment fn fs(input : VSOut) -> @location(0) vec4f {
  return vec4f(input.colour, 1.0);
}
`;

type NativeXR = {
  device: GPUDevice;
  adapter: GPUAdapter;
  context: GPUCanvasContext;
  format: GPUTextureFormat;
  pipeline: GPURenderPipeline;
  vertexBuffer: GPUBuffer;
  indexBuffer: GPUBuffer;
  /** One slot per eye — a single buffer rewritten between draws is seen by both as the last write. */
  uniformBuffers: GPUBuffer[];
  bindGroups: GPUBindGroup[];
  /** Feature name requested on the device, if any. */
  viewInstancingFeature: string | null;
  multiviewPipeline: GPURenderPipeline | null;
  multiviewUniformBuffer: GPUBuffer | null;
  multiviewBindGroup: GPUBindGroup | null;
  /** App-owned 2-layer depth for multiview passes. */
  multiviewDepth: GPUTexture | null;
  session: XRSession | null;
  binding: XRGPUBinding | null;
  layer: XRProjectionLayer | null;
  refSpace: XRReferenceSpace | null;
  depth: GPUTexture[];
};

function mat4Identity(): Float32Array {
  return new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
}

function mat4Multiply(a: Float32Array, b: Float32Array, out: Float32Array): void {
  for (let c = 0; c < 4; c++) {
    for (let r = 0; r < 4; r++) {
      out[c * 4 + r] =
        a[0 * 4 + r] * b[c * 4 + 0] +
        a[1 * 4 + r] * b[c * 4 + 1] +
        a[2 * 4 + r] * b[c * 4 + 2] +
        a[3 * 4 + r] * b[c * 4 + 3];
    }
  }
}

function mat4Translation(x: number, y: number, z: number, out: Float32Array): void {
  out.set(mat4Identity());
  out[12] = x;
  out[13] = y;
  out[14] = z;
}

function mat4RotationY(rad: number, out: Float32Array): void {
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  out.set(mat4Identity());
  out[0] = c;
  out[2] = -s;
  out[8] = s;
  out[10] = c;
}

function mat4Scale(s: number, out: Float32Array): void {
  out.set(mat4Identity());
  out[0] = s;
  out[5] = s;
  out[10] = s;
}

/** Perspective, WebGPU/WebXR clip space (z 0..1), column-major. */
function mat4Perspective(fovy: number, aspect: number, near: number, far: number, out: Float32Array): void {
  const f = 1 / Math.tan(fovy / 2);
  out.fill(0);
  out[0] = f / aspect;
  out[5] = f;
  out[10] = far / (near - far);
  out[11] = -1;
  out[14] = (far * near) / (near - far);
}

const CUBE_VERTEX_BUFFERS: GPUVertexBufferLayout[] = [
  {
    arrayStride: 24,
    attributes: [
      { shaderLocation: 0, offset: 0, format: 'float32x3' },
      { shaderLocation: 1, offset: 12, format: 'float32x3' },
    ],
  },
];

function makePipeline(
  device: GPUDevice,
  format: GPUTextureFormat,
  code = NATIVE_WGSL,
): GPURenderPipeline {
  const module = device.createShaderModule({ code });
  return device.createRenderPipeline({
    layout: 'auto',
    vertex: {
      module,
      entryPoint: 'vs',
      buffers: CUBE_VERTEX_BUFFERS,
    },
    fragment: {
      module,
      entryPoint: 'fs',
      targets: [{ format }],
    },
    primitive: { topology: 'triangle-list', cullMode: 'back' },
    depthStencil: {
      format: 'depth24plus',
      depthWriteEnabled: true,
      depthCompare: 'less',
    },
  });
}

function tryMakeMultiviewPipeline(
  device: GPUDevice,
  format: GPUTextureFormat,
): GPURenderPipeline | null {
  try {
    return makePipeline(device, format, MULTIVIEW_WGSL);
  } catch (error) {
    log(`multiview pipeline create threw: ${error instanceof Error ? error.message : error}`);
    return null;
  }
}

async function initNative(): Promise<NativeXR> {
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'display:block;width:100%;height:100%';
  document.body.appendChild(canvas);

  const adapter = await navigator.gpu.requestAdapter({ xrCompatible: true });
  if (!adapter) throw new Error('no GPU adapter');
  probeAdapterFeatures(adapter);

  const viewInstancingFeature = pickViewInstancingFeature(adapter);
  log(
    `view-instancing feature: ${viewInstancingFeature ?? 'unsupported'}` +
      (wantMultiview ? ' | ?multiview=1 requested' : ' | dual-pass (omit ?multiview=1 to keep baseline)'),
  );

  const requiredFeatures: GPUFeatureName[] = [];
  if (wantMultiview && viewInstancingFeature) {
    requiredFeatures.push(viewInstancingFeature as GPUFeatureName);
  }

  let device: GPUDevice;
  try {
    device = await adapter.requestDevice(
      requiredFeatures.length ? { requiredFeatures } : undefined,
    );
  } catch (error) {
    log(
      `requestDevice with ${viewInstancingFeature} failed (${
        error instanceof Error ? error.message : error
      }); retrying without feature`,
    );
    device = await adapter.requestDevice();
  }

  const deviceLimits = device.limits as GPUSupportedLimits & { maxViewInstanceCount?: number };
  log(
    `device features: ${[...device.features].sort().join(', ') || '(none)'}` +
      (deviceLimits.maxViewInstanceCount != null
        ? ` | maxViewInstanceCount ${deviceLimits.maxViewInstanceCount}`
        : ''),
  );

  const context = canvas.getContext('webgpu') as GPUCanvasContext;
  const format = navigator.gpu.getPreferredCanvasFormat();
  context.configure({ device, format, alphaMode: 'opaque' });

  const pipeline = makePipeline(device, format);

  const vertexBuffer = device.createBuffer({
    size: CUBE_VERTS.byteLength,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
  });
  device.queue.writeBuffer(vertexBuffer, 0, CUBE_VERTS);

  const indexBuffer = device.createBuffer({
    size: CUBE_INDICES.byteLength,
    usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
  });
  device.queue.writeBuffer(indexBuffer, 0, CUBE_INDICES);

  const uniformBuffers = [0, 1].map(() =>
    device.createBuffer({
      size: 64,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    }),
  );
  const bindGroups = uniformBuffers.map((buffer) =>
    device.createBindGroup({
      layout: pipeline.getBindGroupLayout(0),
      entries: [{ binding: 0, resource: { buffer } }],
    }),
  );

  const featureOnDevice =
    viewInstancingFeature && device.features.has(viewInstancingFeature as GPUFeatureName)
      ? viewInstancingFeature
      : null;

  let multiviewPipeline: GPURenderPipeline | null = null;
  let multiviewUniformBuffer: GPUBuffer | null = null;
  let multiviewBindGroup: GPUBindGroup | null = null;
  if (wantMultiview && featureOnDevice) {
    device.pushErrorScope('validation');
    multiviewPipeline = tryMakeMultiviewPipeline(device, format);
    const pipeError = await device.popErrorScope();
    if (pipeError || !multiviewPipeline) {
      log(`multiview pipeline invalid: ${pipeError?.message ?? 'create returned null'}`);
      multiviewPipeline = null;
    } else {
      multiviewUniformBuffer = device.createBuffer({
        size: 128,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      });
      multiviewBindGroup = device.createBindGroup({
        layout: multiviewPipeline.getBindGroupLayout(0),
        entries: [{ binding: 0, resource: { buffer: multiviewUniformBuffer } }],
      });
      log('multiview pipeline ready (view_index + mvp[2])');
    }
  } else if (wantMultiview) {
    log('multiview: unsupported — feature not on device; will use dual-pass');
  }

  return {
    device,
    adapter,
    context,
    format,
    pipeline,
    vertexBuffer,
    indexBuffer,
    uniformBuffers,
    bindGroups,
    viewInstancingFeature: featureOnDevice,
    multiviewPipeline,
    multiviewUniformBuffer,
    multiviewBindGroup,
    multiviewDepth: null,
    session: null,
    binding: null,
    layer: null,
    refSpace: null,
    depth: [],
  };
}

function nativeDepth(xr: NativeXR, eye: number, w: number, h: number): GPUTexture {
  const existing = xr.depth[eye];
  if (existing && existing.width === w && existing.height === h) return existing;
  existing?.destroy();
  xr.depth[eye] = xr.device.createTexture({
    size: [w, h],
    format: 'depth24plus',
    usage: GPUTextureUsage.RENDER_ATTACHMENT,
  });
  return xr.depth[eye];
}

function nativeMultiviewDepth(xr: NativeXR, w: number, h: number): GPUTexture {
  const existing = xr.multiviewDepth;
  if (
    existing &&
    existing.width === w &&
    existing.height === h &&
    existing.depthOrArrayLayers >= 2
  ) {
    return existing;
  }
  existing?.destroy();
  xr.multiviewDepth = xr.device.createTexture({
    size: [w, h, 2],
    format: 'depth24plus',
    usage: GPUTextureUsage.RENDER_ATTACHMENT,
  });
  return xr.multiviewDepth;
}

function cubeModel(floor: boolean, instance = 0): Float32Array {
  const model = mat4Identity();
  const rot = mat4Identity();
  const scale = mat4Identity();
  const trans = mat4Identity();
  const tmp = mat4Identity();
  // Stress grid: keep instance 0 on the original pose; pack extras beside it.
  const col = instance % 8;
  const row = Math.floor(instance / 8) % 8;
  const layer = Math.floor(instance / 64);
  const ox = instance === 0 ? 0 : (col - 3.5) * 0.22;
  const oy = instance === 0 ? 0 : (row - 3.5) * 0.22;
  const oz = instance === 0 ? 0 : -layer * 0.25;
  mat4Scale(instance === 0 ? 0.15 : 0.08, scale);
  mat4RotationY(angle + instance * 0.07, rot);
  mat4Translation(ox, (floor ? 1.5 : 0) + oy, -1.2 + oz, trans);
  mat4Multiply(rot, scale, tmp);
  mat4Multiply(trans, tmp, model);
  return model;
}

function drawNativeCube(
  xr: NativeXR,
  pass: GPURenderPassEncoder,
  mvp: Float32Array,
  eye = 0,
  pipeline = xr.pipeline,
  bindGroup = xr.bindGroups[eye] ?? xr.bindGroups[0],
): void {
  xr.device.queue.writeBuffer(xr.uniformBuffers[eye] ?? xr.uniformBuffers[0], 0, mvp);
  pass.setPipeline(pipeline);
  pass.setBindGroup(0, bindGroup);
  pass.setVertexBuffer(0, xr.vertexBuffer);
  pass.setIndexBuffer(xr.indexBuffer, 'uint16');
  pass.drawIndexed(CUBE_INDICES.length);
}

function drawMultiviewCube(
  xr: NativeXR,
  pass: GPURenderPassEncoder,
  mvpEyes: Float32Array,
): void {
  if (!xr.multiviewPipeline || !xr.multiviewUniformBuffer || !xr.multiviewBindGroup) return;
  xr.device.queue.writeBuffer(xr.multiviewUniformBuffer, 0, mvpEyes);
  pass.setPipeline(xr.multiviewPipeline);
  pass.setBindGroup(0, xr.multiviewBindGroup);
  pass.setVertexBuffer(0, xr.vertexBuffer);
  pass.setIndexBuffer(xr.indexBuffer, 'uint16');
  pass.drawIndexed(CUBE_INDICES.length);
}

function eyeMvp(view: XRView, model: Float32Array, out: Float32Array): void {
  const mv = mat4Identity();
  const viewMat = view.transform.inverse.matrix as Float32Array;
  mat4Multiply(viewMat, model, mv);
  mat4Multiply(view.projectionMatrix as Float32Array, mv, out);
}

type ArrayProbe = {
  ok: boolean;
  sharedTexture: boolean;
  reportedLayers: number;
  descriptors: string;
  error?: string;
};

function probeXrArrayTexture(
  colorTexture: GPUTexture,
  views: XRView[],
  binding: XRGPUBinding,
  layer: XRProjectionLayer,
): ArrayProbe {
  const descriptors: string[] = [];
  let sharedTexture = true;
  for (let i = 0; i < views.length; i++) {
    const sub = binding.getViewSubImage(layer, views[i]);
    if (sub.colorTexture !== colorTexture) sharedTexture = false;
    const desc = sub.getViewDescriptor?.() ?? {};
    descriptors.push(
      `eye${i}:{base=${desc.baseArrayLayer ?? 0},layers=${desc.arrayLayerCount ?? 1},dim=${desc.dimension ?? 'default'}}`,
    );
  }
  const reportedLayers = colorTexture.depthOrArrayLayers;
  try {
    const view = colorTexture.createView({
      dimension: '2d-array',
      baseArrayLayer: 0,
      arrayLayerCount: 2,
    });
    // Touch the view so a lazy UA still validates.
    void view;
    return {
      ok: true,
      sharedTexture,
      reportedLayers,
      descriptors: descriptors.join(' '),
    };
  } catch (error) {
    return {
      ok: false,
      sharedTexture,
      reportedLayers,
      descriptors: descriptors.join(' '),
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function paintNativeCanvas(xr: NativeXR): void {
  const canvas = xr.context.canvas as HTMLCanvasElement;
  const cssW = canvas.clientWidth || innerWidth;
  const cssH = canvas.clientHeight || innerHeight;
  const w = Math.max(1, Math.floor(cssW * devicePixelRatio));
  const h = Math.max(1, Math.floor(cssH * devicePixelRatio));
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }

  const texture = xr.context.getCurrentTexture();
  const depth = nativeDepth(xr, 2, texture.width, texture.height);
  const encoder = xr.device.createCommandEncoder();
  const pass = encoder.beginRenderPass({
    colorAttachments: [
      {
        view: texture.createView(),
        clearValue: { r: 0.05, g: 0.05, b: 0.08, a: 1 },
        loadOp: 'clear',
        storeOp: 'store',
      },
    ],
    depthStencilAttachment: {
      view: depth.createView(),
      depthClearValue: 1,
      depthLoadOp: 'clear',
      depthStoreOp: 'store',
    },
  });

  // Camera at origin looking down -Z; cube sits at z=-1.2.
  const proj = mat4Identity();
  const view = mat4Identity();
  const mv = mat4Identity();
  const mvp = mat4Identity();
  mat4Perspective((60 * Math.PI) / 180, texture.width / texture.height, 0.05, 50, proj);
  mat4Multiply(view, cubeModel(false), mv);
  mat4Multiply(proj, mv, mvp);

  drawNativeCube(xr, pass, mvp);
  pass.end();
  xr.device.queue.submit([encoder.finish()]);
}

async function enterNative(xr: NativeXR): Promise<void> {
  const session = await navigator.xr!.requestSession('immersive-vr', {
    requiredFeatures: ['webgpu', 'local-floor'],
    optionalFeatures: ['layers'],
  });
  log(`session granted – ${[...(session.enabledFeatures ?? [])].join(', ')}`);

  const binding = new XRGPUBinding(session, xr.device);
  const colorFormat = binding.getPreferredColorFormat?.() ?? xr.format;
  // Same shape as webgpu-clustered-shading: colour only, scaleFactor 1.
  const layer = binding.createProjectionLayer({
    colorFormat,
    scaleFactor: 1.0,
  });
  session.updateRenderState({ layers: [layer] });

  // XR's preferred format can differ from the canvas (bgra vs rgba); rebuild if so.
  let pipeline = xr.pipeline;
  let bindGroups = xr.bindGroups;
  if (colorFormat !== xr.format) {
    log(`XR colour format ${colorFormat} (canvas was ${xr.format}), rebuilding pipeline`);
    pipeline = makePipeline(xr.device, colorFormat);
    bindGroups = xr.uniformBuffers.map((buffer) =>
      xr.device.createBindGroup({
        layout: pipeline.getBindGroupLayout(0),
        entries: [{ binding: 0, resource: { buffer } }],
      }),
    );
    if (xr.viewInstancingFeature && wantMultiview) {
      xr.device.pushErrorScope('validation');
      const mvPipe = tryMakeMultiviewPipeline(xr.device, colorFormat);
      const err = await xr.device.popErrorScope();
      if (!err && mvPipe && xr.multiviewUniformBuffer) {
        xr.multiviewPipeline = mvPipe;
        xr.multiviewBindGroup = xr.device.createBindGroup({
          layout: mvPipe.getBindGroupLayout(0),
          entries: [{ binding: 0, resource: { buffer: xr.multiviewUniformBuffer } }],
        });
      } else {
        log(`multiview pipeline rebuild failed: ${err?.message ?? 'null pipeline'}`);
        xr.multiviewPipeline = null;
      }
    }
  }

  const refSpace = await session.requestReferenceSpace(
    session.enabledFeatures?.includes('local-floor') ? 'local-floor' : 'local',
  );

  xr.session = session;
  xr.binding = binding;
  xr.layer = layer;
  xr.refSpace = refSpace;

  const floor = !!session.enabledFeatures?.includes('local-floor');
  /** raw = compositor viewport (clustered default); fit = full texture; none = omit setViewport */
  const viewportMode = query.has('none') ? 'none' : query.has('fit') ? 'fit' : 'raw';
  let frames = 0;
  let lastFrameTime = 0;
  let useMultiview = !!(wantMultiview && xr.multiviewPipeline && xr.viewInstancingFeature);
  let arrayProbed = false;
  let multiviewFailed = false;
  const mvpPair = new Float32Array(32);
  const mvpScratch = mat4Identity();

  session.addEventListener('end', () => {
    const mode = useMultiview && !multiviewFailed ? 'multiview' : 'dual-pass';
    log(`session ended after ${frames} frames | mode ${mode} | stress ${stressCount}`);
    xr.session = null;
    xr.binding = null;
    xr.layer = null;
    xr.refSpace = null;
    button.textContent = 'Enter VR';
  });

  const onFrame = (time: number, frame: XRFrame) => {
    if (!xr.session) return;
    xr.session.requestAnimationFrame(onFrame);

    angle += 0.01;
    const pose = frame.getViewerPose(refSpace);
    if (!pose || !xr.binding || !xr.layer) return;

    frames++;
    const dt = lastFrameTime ? time - lastFrameTime : 0;
    lastFrameTime = time;
    const tickStart = performance.now();
    const encoder = xr.device.createCommandEncoder();
    let passCount = 0;
    let drawCount = 0;
    let mode: 'multiview' | 'dual-pass' = 'dual-pass';
    let rendered = false;

    const leftSub = xr.binding.getViewSubImage(xr.layer, pose.views[0]);
    const colorTexture = leftSub.colorTexture;

    if (!arrayProbed) {
      arrayProbed = true;
      const probe = probeXrArrayTexture(colorTexture, pose.views, xr.binding, xr.layer);
      log(
        `array probe | ok=${probe.ok} shared=${probe.sharedTexture} ` +
          `reportedLayers=${probe.reportedLayers} | ${probe.descriptors}` +
          (probe.error ? ` | error=${probe.error}` : ''),
      );
      if (useMultiview && !probe.ok) {
        useMultiview = false;
        multiviewFailed = true;
        log('multiview: kill — 2-layer array view rejected; falling back to dual-pass');
      }
      if (useMultiview && !probe.sharedTexture) {
        useMultiview = false;
        multiviewFailed = true;
        log('multiview: kill — eyes do not share one colorTexture; falling back to dual-pass');
      }
    }

    if (useMultiview && xr.multiviewPipeline && pose.views.length >= 2) {
      try {
        const colorView = colorTexture.createView({
          dimension: '2d-array',
          baseArrayLayer: 0,
          arrayLayerCount: 2,
        });
        const depth = nativeMultiviewDepth(xr, colorTexture.width, colorTexture.height);
        const depthView = depth.createView({
          dimension: '2d-array',
          baseArrayLayer: 0,
          arrayLayerCount: 2,
        });

        const passDesc: GPURenderPassDescriptor & { viewCount?: number } = {
          colorAttachments: [
            {
              view: colorView,
              clearValue: { r: 0.05, g: 0.05, b: 0.1, a: 1 },
              loadOp: 'clear',
              storeOp: 'store',
            },
          ],
          depthStencilAttachment: {
            view: depthView,
            depthClearValue: 1,
            depthLoadOp: 'clear',
            depthStoreOp: 'store',
          },
          viewCount: 2,
        };

        if (frames <= 5) xr.device.pushErrorScope('validation');
        const pass = encoder.beginRenderPass(passDesc);
        passCount = 1;
        // No setViewport/setScissorRect — visionOS treats them as compositor hints.
        for (let s = 0; s < stressCount; s++) {
          const model = cubeModel(floor, s);
          eyeMvp(pose.views[0], model, mvpScratch);
          mvpPair.set(mvpScratch, 0);
          eyeMvp(pose.views[1], model, mvpScratch);
          mvpPair.set(mvpScratch, 16);
          drawMultiviewCube(xr, pass, mvpPair);
          drawCount++;
        }
        pass.end();
        mode = 'multiview';
        rendered = true;
        if (frames <= 5) {
          const nth = frames;
          void xr.device.popErrorScope().then((error) => {
            if (error) {
              console.error(`[cube] multiview frame ${nth} invalid: ${error.message}`);
              useMultiview = false;
              multiviewFailed = true;
              log('multiview: kill — viewCount pass validation failed; dual-pass next frames');
            }
          });
        }
      } catch (error) {
        console.error('[cube] multiview pass threw:', error);
        useMultiview = false;
        multiviewFailed = true;
        log('multiview: kill — pass threw; dual-pass next frames');
        // Do not dual-pass on this encoder — pass state may be unclean.
        xr.device.queue.submit([encoder.finish()]);
        return;
      }
    }

    if (!rendered) {
      for (let i = 0; i < pose.views.length; i++) {
        const view = pose.views[i];
        const sub = xr.binding.getViewSubImage(xr.layer, view);
        const { viewport: v, colorTexture: t } = sub;

        if (frames <= 3 || frames === 60) {
          log(
            `frame ${frames} eye ${i} | viewport ${v.x},${v.y} ${v.width}x${v.height} | ` +
              `colour ${t.width}x${t.height}x${t.depthOrArrayLayers} ${t.format} | vpMode ${viewportMode}`,
          );
        }

        const colorView = t.createView(sub.getViewDescriptor?.() ?? {});
        const depth = nativeDepth(xr, i, t.width, t.height);

        const pass = encoder.beginRenderPass({
          colorAttachments: [
            {
              view: colorView,
              clearValue: { r: 0.05, g: 0.05, b: 0.1, a: 1 },
              loadOp: 'clear',
              storeOp: 'store',
            },
          ],
          depthStencilAttachment: {
            view: depth.createView(),
            depthClearValue: 1,
            depthLoadOp: 'clear',
            depthStoreOp: 'store',
          },
        });
        passCount++;

        if (viewportMode === 'fit') pass.setViewport(0, 0, t.width, t.height, 0, 1);
        else if (viewportMode === 'raw') pass.setViewport(v.x, v.y, v.width, v.height, 0, 1);

        for (let s = 0; s < stressCount; s++) {
          eyeMvp(view, cubeModel(floor, s), mvpScratch);
          drawNativeCube(xr, pass, mvpScratch, i, pipeline, bindGroups[i] ?? bindGroups[0]);
          drawCount++;
        }
        pass.end();
      }
    }

    xr.device.queue.submit([encoder.finish()]);

    const shouldLog =
      frames <= 3 || frames === 10 || frames === 60 || frames === 120;
    if (shouldLog) {
      const cpuMs = performance.now() - tickStart;
      log(
        `frame ${frames} | mode ${mode} | passes ${passCount} | draws ${drawCount} | ` +
          `stress ${stressCount} | dt ${dt.toFixed(1)} ms | encode ${cpuMs.toFixed(1)} ms | ` +
          `feature ${xr.viewInstancingFeature ?? 'none'}` +
          (multiviewFailed ? ' | multiviewFailed' : ''),
      );
      if (frames <= 5) {
        const nth = frames;
        const started = tickStart;
        void xr.device.queue.onSubmittedWorkDone().then(() => {
          log(`frame ${nth} GPU done in ${Math.round(performance.now() - started)} ms | mode ${mode}`);
        });
      }
    }
  };

  session.requestAnimationFrame(onFrame);
  button.textContent = 'Exit VR';
  log(
    `native XRGPUBinding running | mode ${
      useMultiview ? 'multiview' : 'dual-pass'
    } | viewport ${viewportMode} | stress ${stressCount}`,
  );
  if (wantMultiview && !useMultiview) {
    log('multiview: unsupported at session start — dual-pass baseline');
  }
}

// ---------------------------------------------------------------------------
// three.js path — previous experiment, kept for A/B
// ---------------------------------------------------------------------------

let suppressPassRects = false;

function installPassRectSuppression(): void {
  type Encoder = { prototype: Record<string, unknown> };
  const proto = (globalThis as { GPURenderPassEncoder?: Encoder }).GPURenderPassEncoder?.prototype;
  if (!proto || proto.cubeRectsSuppressed) return;
  for (const name of ['setViewport', 'setScissorRect'] as const) {
    const original = proto[name] as (...args: number[]) => void;
    proto[name] = function (this: unknown, ...args: number[]) {
      if (!suppressPassRects) original.apply(this, args);
    };
  }
  proto.cubeRectsSuppressed = true;
}

function installFoveationNullGuard(xr: {
  foveateBoundTexture?: (renderTarget: unknown) => void;
  koraFoveationGuarded?: boolean;
}): void {
  if (xr.koraFoveationGuarded || typeof xr.foveateBoundTexture !== 'function') return;
  const original = xr.foveateBoundTexture.bind(xr);
  xr.foveateBoundTexture = (renderTarget: unknown) => {
    if (renderTarget == null) return;
    original(renderTarget);
  };
  xr.koraFoveationGuarded = true;
}

async function runThreePath(): Promise<void> {
  const scene = new Scene();
  const camera = new PerspectiveCamera(70, innerWidth / innerHeight, 0.05, 50);
  camera.position.set(0, 1.5, 0);
  // Unlit on purpose: MeshStandard's first XR compile has been enough to trip visionOS's
  // session watchdog after a couple of correct-looking frames.
  scene.add(new AmbientLight(0xffffff, 1));
  const mesh = new Mesh(
    new BoxGeometry(0.3, 0.3, 0.3),
    new MeshBasicNodeMaterial({ color: 0xff7a3c }),
  );
  mesh.position.set(0, 1.5, -1.2);
  scene.add(mesh);

  const renderer = new WebGPURenderer({ antialias: true }); // WebGPU XR MSAA: three #34120
  renderer.setPixelRatio(1);
  renderer.setSize(innerWidth, innerHeight);
  renderer.xr.enabled = true;
  document.body.appendChild(renderer.domElement);
  await renderer.init();

  const device = (
    renderer as unknown as { backend?: { device?: GPUDevice } }
  ).backend?.device;

  device?.lost.then((info) => {
    console.error(`[cube] GPU device lost (${info.reason}): ${info.message}`);
  });

  addEventListener('resize', () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  });

  // Compile the cube on the desktop path before a session, so the first immersive frames are not
  // the ones that pay for pipeline creation.
  for (let i = 0; i < 3; i++) renderer.render(scene, camera);
  if (device) await device.queue.onSubmittedWorkDone();
  log('desktop warm-up done');

  function sizeXRTarget(): boolean {
    type Sized = { width: number; height: number };
    type Target = Sized & {
      depth: number;
      texture: object;
      setSize(w: number, h: number, d?: number): void;
    };
    const target = (renderer.xr as unknown as { _xrRenderTarget?: Target })._xrRenderTarget;
    if (!target) return false;
    if (target.width > 0 && target.height > 0) return true;
    const backend = (
      renderer as unknown as { backend?: { get?(o: object): { texture?: Sized } | undefined } }
    ).backend;
    const texture = backend?.get?.(target.texture)?.texture;
    if (!texture?.width || !texture.height) return false;
    target.setSize(texture.width, texture.height, target.depth);
    log(`sized XR target to ${texture.width}x${texture.height}, skipping this frame`);
    return false;
  }

  function fitEyes(): void {
    const target = (
      renderer.xr as unknown as { _xrRenderTarget?: { width: number; height: number } }
    )._xrRenderTarget;
    if (!target?.width) return;
    for (const sub of (
      renderer.xr.getCamera() as unknown as {
        cameras?: { viewport?: { x: number; y: number; width: number; height: number } }[];
      }
    ).cameras ?? []) {
      const v = sub.viewport;
      if (!v) continue;
      v.x = 0;
      v.y = 0;
      v.width = target.width;
      v.height = target.height;
    }
  }

  function dumpSubImages(frame: XRFrame): void {
    type SubImage = {
      viewport: { x: number; y: number; width: number; height: number };
      colorTexture: { width: number; height: number; depthOrArrayLayers: number; format: string };
    };
    const xr = renderer.xr as unknown as {
      getWebGPUBinding?(): { getViewSubImage(layer: object, view: XRView): SubImage } | null;
      _glProjLayer?: object;
    };
    const binding = xr.getWebGPUBinding?.();
    const layer = xr._glProjLayer;
    const space = renderer.xr.getReferenceSpace();
    if (!binding || !layer || !space) return;
    const pose = frame.getViewerPose(space);
    if (!pose) return;
    pose.views.forEach((view, i) => {
      const sub = binding.getViewSubImage(layer, view);
      const { viewport: v, colorTexture: t } = sub;
      log(
        `view ${i} | viewport ${v.x},${v.y} ${v.width}x${v.height} | ` +
          `colour ${t.width}x${t.height}x${t.depthOrArrayLayers} ${t.format}`,
      );
    });
  }

  let frames = 0;
  let targetReady = false;
  let sessionStarted = 0;
  renderer.setAnimationLoop((_t, frame) => {
    mesh.rotation.y += 0.01;
    const tickStart = performance.now();

    if (frame) {
      frames++;
      if (!sizeXRTarget()) {
        targetReady = false;
        return;
      }
      targetReady = true;
      fitEyes();
      if (frames === 2) dumpSubImages(frame);
    }

    if (frame && !targetReady) return;

    if (frame && device && frames <= 5) {
      device.pushErrorScope('validation');
    }

    try {
      renderer.render(scene, camera);
    } catch (error) {
      console.error(`[cube] render threw on frame ${frames}:`, error);
    }

    if (frame && device && frames <= 5) {
      const nth = frames;
      const started = tickStart;
      void device.popErrorScope().then((error) => {
        if (error) console.error(`[cube] frame ${nth} invalid: ${error.message}`);
      });
      void device.queue.onSubmittedWorkDone().then(() => {
        log(`frame ${nth} GPU done in ${Math.round(performance.now() - started)} ms`);
      });
    }

    if (frame && (frames <= 10 || frames === 60 || frames === 120)) {
      const t = (renderer.xr as unknown as { _xrRenderTarget?: { width: number; height: number } })
        ._xrRenderTarget;
      const needsBlit = !!(renderer as unknown as { needsFrameBufferTarget?: boolean })
        .needsFrameBufferTarget;
      log(
        `three frame ${frames} | ${Math.round(performance.now() - sessionStarted)} ms since enter | ` +
          `target ${t?.width}x${t?.height} | output ${needsBlit ? 'blit' : 'single-pass'} | ` +
          `foveation ${renderer.xr.getFoveation()}`,
      );
    }
  });

  button.disabled = false;
  button.textContent = 'Enter VR';
  button.onclick = async () => {
    if (renderer.xr.getSession()) {
      await renderer.xr.getSession()?.end();
      return;
    }
    button.disabled = true;
    try {
      const session = await navigator.xr!.requestSession('immersive-vr', {
        requiredFeatures: ['webgpu'],
        optionalFeatures: ['local-floor', 'layers'],
      });
      log(`session granted – ${[...(session.enabledFeatures ?? [])].join(', ')}`);
      renderer.xr.setReferenceSpaceType(
        session.enabledFeatures?.includes('local-floor') ? 'local-floor' : 'local',
      );
      mesh.position.y = session.enabledFeatures?.includes('local-floor') ? 1.5 : 0;
      installPassRectSuppression();
      suppressPassRects = true;
      installFoveationNullGuard(
        renderer.xr as {
          foveateBoundTexture?: (renderTarget: unknown) => void;
          koraFoveationGuarded?: boolean;
        },
      );
      session.addEventListener('end', () => {
        const lived = sessionStarted ? Math.round(performance.now() - sessionStarted) : 0;
        suppressPassRects = false;
        log(`session ended after ${frames} frames / ${lived} ms`);
        frames = 0;
        targetReady = false;
        sessionStarted = 0;
        button.textContent = 'Enter VR';
      });
      await renderer.xr.setSession(session);
      renderer.xr.setFoveation(0);
      sessionStarted = performance.now();
      button.textContent = 'Exit VR';
      log(`three.js XR running | foveation ${renderer.xr.getFoveation()}`);
    } catch (e) {
      console.error('[cube] three session failed:', e);
      button.textContent = 'Enter VR';
    } finally {
      button.disabled = false;
    }
  };
}

// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  if (note) {
    if (useThree) {
      note.textContent = 'Path: three.js WebGPU XR (default). ?native=1 for dual-pass binding.';
    } else if (wantMultiview) {
      note.textContent = `Path: native multiview probe. stress=${stressCount}. Falls back to dual-pass if unsupported.`;
    } else {
      note.textContent = `Path: native dual-pass. ?multiview=1 to probe view-instancing. stress=${stressCount}.`;
    }
  }

  const supported = await navigator.xr?.isSessionSupported('immersive-vr');
  if (!supported || !('XRGPUBinding' in globalThis)) {
    button.textContent = supported ? 'No XRGPUBinding' : 'No immersive-vr';
    return;
  }

  if (useThree) {
    await runThreePath();
    return;
  }

  const xr = await initNative();
  // Keep the canvas alive; XR presents through the layer, not the canvas.
  const spin = () => {
    if (!xr.session) {
      angle += 0.01;
      paintNativeCanvas(xr);
    }
    requestAnimationFrame(spin);
  };
  requestAnimationFrame(spin);

  button.disabled = false;
  button.textContent = 'Enter VR';
  button.onclick = async () => {
    if (xr.session) {
      await xr.session.end();
      return;
    }
    button.disabled = true;
    try {
      await enterNative(xr);
    } catch (e) {
      console.error('[cube] native session failed:', e);
      button.textContent = 'Enter VR';
    } finally {
      button.disabled = false;
    }
  };

  log(
    `ready | native` +
      (wantMultiview ? ' multiview-probe' : ' dual-pass') +
      ` | stress ${stressCount} | ?fit=1 / ?none=1 viewport modes`,
  );
}

void main();
