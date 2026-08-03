# WebGPU-backed WebXR on visionOS: a session that stops after two frames

A WebGPU-backed `immersive-vr` session on Safari for visionOS opens, renders two frames, and then
stops being asked for more. The session stays alive, the passthrough environment stays visible with
no page content in it, and it has to be dismissed with a system gesture.

This is a record of what has been measured, what has been ruled out, and where it currently
stands. Seven separate bugs were found and worked around on the way; none of them was the cause.
The cause is still open.

## Environment

| | |
| --- | --- |
| Device | Apple Vision Pro, M5 |
| Browser | Safari for visionOS |
| Framework | three.js r185, `WebGPURenderer` |
| Session | `immersive-vr`, `requiredFeatures: ['webgpu']` |

The application is a volumetric fire solver. The simulation runs entirely in WebGPU compute
shaders, so a WebGPU-backed session is not a preference — there is no WebGL path to fall back to.

## The symptom

```
[kora/xr] session granted – ["viewer", "local", "local-floor", "hand-tracking", "webgpu"]
[kora/xr] renderer bound | requested scale 0.3 | shim installed | layer 0x0 (native x0.3)
[kora/xr] sized the XR target to 2048x1984, drawing from next frame
[kora/xr] frame 1 | 188 ms/frame | layers unsupported | baseLayer no | pose yes | views 2 | ...
[kora/xr] frame 2 |  98 ms/frame | layers unsupported | baseLayer no | pose yes | views 2 | ...
[kora/xr] render 1 validated clean
[kora/xr] render 1 finished on the GPU after 32 ms
```

Then nothing. No further `requestAnimationFrame` callbacks, no uncaptured WebGPU error, no lost
device, and no `end` event on the session.

## What has been ruled out

**It is not the cost of the frame.** `?bisect=1` draws reference geometry only — no solve, no
particles, no raymarch — and stalls identically, at the same frame count.

**It is not a failed or invalid submission.** The render is wrapped in a `validation` error scope,
which comes back clean, and `device.queue.onSubmittedWorkDone()` resolves at 32 ms. The GPU work is
submitted, valid, and finished.

**It is not the intermediate tone-mapping target.** `?flat=1` disables tone mapping and renders in
the working colour space, so three draws straight into the eye textures rather than through a
half-float intermediate and a blit. No change.

**It is probably not the projection layer failing to attach.** This was the leading theory for a
while, on the strength of `session.renderState.layers` reading `undefined`, and it was wrong. That
getter lives in `WebXRRenderState+Layers.idl` behind `EnabledBySetting=WebXRLayersAPIEnabled`,
which is off on visionOS — so it reads `undefined` whether or not a layer is attached. It is a
read-back artifact and says nothing about the attachment. Meanwhile:

- `XRRenderStateInit.layers`, the *input* member, carries no such gate — only the dictionary-level
  `Conditional=WEBXR`. It is accepted on visionOS.
- `WebXRSession::updateRenderState` handles it under `#if ENABLE(WEBXR_LAYERS)`, a **compile-time**
  conditional that is on for visionOS, and rejects a missing `layers` feature only when
  `newState.layers->size() > 1`. A single projection layer is allowed, as the spec requires.
- three's `_initWebGPUSession` calls `session.updateRenderState({ layers: [ glProjLayer ] })`
  unconditionally, without consulting `renderState.layers`.

So the layer is very likely attached and the frame loop very likely has something to composite.

Worth noting for anyone reading the preference file: `WebXRLayersAPIEnabled` is gated on
`ENABLE(WEBXR_LAYERS) && USE(OPENXR)` by
[114ad78](https://github.com/WebKit/WebKit/commit/114ad783c3f1c5de848c0832c09d7f698c3257c9), so it
is off on visionOS, while `WebXRWebGPUBindingsEnabled` immediately below it is
`PLATFORM(VISION) && ENABLE(WEBXR_WEBGPU): true` — explicitly on. That asymmetry is real and is
what makes the JS-visible state confusing, but per the above it does not appear to break
attachment.

## Current hypothesis, unproven

**Swapchain textures are not being released back to the compositor.** Two frames is what a
double-buffered swapchain would give: the compositor hands out both textures, neither is returned,
and it then waits for a free one rather than scheduling frame 3. That fits every observation —
the session stays alive, no error is raised, and the work completes on the GPU but the compositor
still considers the buffer in flight.

What would distinguish it: whether `XRProjectionLayerImpl::endFrame()` is reached on visionOS for a
WebGPU-backed layer, and whether the completion sync event it carries is ever signalled. That is
not observable from JS, which is where this needs someone with a WebKit build.

A secondary possibility is that the frame is presented but rejected as malformed, given the
sub-image metadata is internally inconsistent (see bugs 2 and 3 below) and at one point the scene
was briefly visible, incorrectly projected, before the stall.

## Bugs found and worked around

All real, all independent, all still present. Any future WebGPU-backed session on this platform
will meet them in roughly this order. Workarounds are in
[`src/xr/ImmersiveMode.ts`](../src/xr/ImmersiveMode.ts) unless noted.

**1. The projection layer reports 0×0 (WebKit).** A layer created through `XRGPUBinding` reports
`textureWidth` and `textureHeight` as zero. three's `_initWebGPUSession` sizes its render target
directly from those fields (`XRManager.js:783`), so the target is 0×0 and there is nowhere to draw.
The true size is on the `GPUTexture` the compositor hands back. Worked around in `sizeXRTarget()`
by reading the texture and resizing the target, skipping one frame while the backend re-registers.

**2. The eye texture misreports its array layer count (WebKit).** The same texture reports
`depthOrArrayLayers` as 1, while the view descriptors from `getViewSubImage()` select
`baseArrayLayer` 0 and 1. The descriptors are correct; believing the field collapses the target to
one layer and drops the second eye.

**3. The sub-image viewport is in the wrong space (WebKit).** `getViewSubImage().viewport` is
reported in the compositor's recommended-resolution space (4851×3887) rather than that of the
texture actually handed back (2048×1984). three copies it onto the sub-cameras verbatim, and a
viewport larger than its attachment is a validation error that discards the frame. Worked around in
`clampViewports()`.

**4. `setViewport`/`setScissorRect` are treated as compositor hints
([WebKit 315274](https://bugs.webkit.org/show_bug.cgi?id=315274)).** An explicit scissor rect, even
one covering the whole attachment, is read as a statement about where in the eye display the image
belongs, and the result is clipped to it. PlayCanvas hit this and fixed it by not making the calls.
Worked around in `installPassRectSuppression()` by no-oping both for the duration of a session; a
render pass already defaults to the full attachment, and with one array layer per eye there is no
sub-rectangle to select.

**5. The pixel ratio is not reset for XR (three.js).** three's WebGL paths reset the renderer's
pixel ratio to 1 inside `setSession`; the WebGPU path does not, and then scales the eye viewport by
it. Nothing about a projection layer is measured in CSS pixels. Compounds bug 3.

**6. No way to scale the projection layer (three.js).** On the WebGL path three passes a
framebuffer scale factor into `createProjectionLayer`; the WebGPU path passes only formats, so the
layer arrives at the compositor's recommended size — 4851×3887 per eye, about 38 megapixels of
raymarching per frame. A layer cannot be resized after creation and three exposes no hook, so the
scale factor is folded into the call by a shim in `installLayerScale()`. Note that WebKit appears to
ignore `scaleFactor`; `XRView.requestViewportScale()` is applied per frame as well.

**7. `cameraPosition` throws in an XR session (three.js).** The TSL `cameraPosition` node
dereferences a null camera under `ArrayCamera`:
`TypeError: Cannot destructure property 'camera' from null or undefined`. Worked around in
`VolumeRenderer` by taking the translation from `cameraWorldMatrix` and raymarching in object
space, which is more robust to rig transforms anyway.

## Reproducing

```
npm install
npm run dev
```

Vite serves over HTTPS on the LAN, which WebXR requires; Safari will ask you to accept the
self-signed certificate once. Open the printed address on the headset and press **Enter VR**.

Diagnostics print under `[kora/xr]`. Frame reports are emitted at frames 1, 2, 3, 5, 10, 30 and
120, so a loop that stops shows up as a line that never arrives. `?bisect=1` and `?flat=1` are
described above, and `window.kora.xrStatus()` dumps everything session entry depends on.

## What would help

Anything that shows whether the compositor received and released frame 1 — specifically whether
`XRProjectionLayerImpl::endFrame()` runs for a WebGPU-backed layer on visionOS, and what happens to
its completion sync event. Failing that, confirmation that a WebGPU-backed session has ever
presented more than two frames on this platform would tell us whether to keep debugging the app or
stop.

## Multiview / view-instancing spike

WebGPU’s draft [`view-instancing`](https://github.com/gpuweb/gpuweb/blob/main/proposals/view-instancing.md)
feature (`GPURenderPassDescriptor.viewCount`, WGSL `@builtin(view_index)`) is the only path that
could share one shaded pass across both XR eyes. three.js does not use it on WebGPU XR today.
Fragment work still runs per eye when it works — the win is encode/geometry, not half the
raymarch fill.

Harness: [`cube.html`](../cube.html) + [`src/cube.ts`](../src/cube.ts).

| URL | Behaviour |
| --- | --- |
| `/cube.html?native=1` | Dual-pass baseline (one render pass per eye) |
| `/cube.html?native=1&multiview=1` | Probe feature + 2-layer array view + `viewCount: 2`; falls back to dual-pass on any kill |
| `&stress=256` | Extra cube draws for geometry/encode A/B |

Console markers to collect on visionOS Safari:

1. `adapter multiview-related:` / `view-instancing feature:` — feature present or `unsupported`
2. `array probe | ok=… shared=… reportedLayers=…` — whether a `2d-array` view with 2 layers is legal despite WebKit’s `depthOrArrayLayers === 1` misreport
3. `frame N | mode multiview|dual-pass | passes … | draws … | dt … | encode …` and `GPU done in … ms`
4. Any `multiview: kill — …` line

### Kill / proceed (device)

| Result | Decision |
| --- | --- |
| Feature absent, array view rejected, or `viewCount` validation fails | **Kill** — stay on three dual-eye; no three.js rip for multiview |
| Multiview stable but cube/`stress` win tiny | **Kill migration**; optional note for bead-heavy native present later |
| Multiview stable + clear win on high `stress` | Follow-up plan for native XR present of MPM beads / optional volume |

**Status (harness landed, awaiting AVP console capture):** treat as **unsupported until proven**. The draft feature is not known to ship in WebKit; the first `?native=1&multiview=1` session on device should log `view-instancing feature: unsupported` or a kill line and keep dual-pass. Paste those lines here when measured and flip this status to supported or confirmed kill.
