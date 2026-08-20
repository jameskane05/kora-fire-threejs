# WebKit bug report draft

File at https://bugs.webkit.org — Product: WebKit, Component: WebGPU.
Attach `repro.html` (serve over http(s) and open; prints PASS/FAIL).

---

**Title:** [WebGPU] WGSL: stores to nested function-scope array lost when loop body contains two dynamic-bound inner loops

**Summary:**

A compute shader that assigns `D[i]` on every iteration of a constant-bound
outer loop produces wrong results when the loop body also contains two inner
loops with data-dependent bounds (`j < i`, `k < i`) and accesses a nested
function-scope array (`array<array<f32, 6>, 6>`). Only the final iteration's
store to `D` takes effect; all earlier stores are lost, as if the store had
been sunk out of the loop.

For the attached repro, expected output is `D = [57600 x6]`. WebKit produces
`D = [0, 0, 0, 0, 0, 57600]`. Chrome (Tint/Dawn) produces the correct result
for the same shader on the same hardware.

**Steps to reproduce:**

1. Serve the attached `repro.html` from any local web server.
2. Open in Safari (macOS or visionOS) or Playwright WebKit.
3. The page runs a single-invocation `@compute` dispatch and prints PASS/FAIL.

**Results observed while minimizing (all single-invocation, same outer loop):**

- Two dynamic inner loops + nested array access in either loop: FAIL.
- Removing either inner loop: PASS.
- Replacing the nested array with a flat `array<f32, 36>` (manual `r * 6 + c`
  indexing), identical loop structure: PASS.
- Fully unrolling: PASS.
- `select()` vs `if`, division, `max()`: no effect on the outcome.

**Environment:**

- Reproduced on Playwright WebKit 26.5 (build v2336, macOS 26, Apple Silicon)
  and Safari on visionOS 26 (Apple Vision Pro).
- Not reproducible in Chrome 141 (Dawn/Tint) on the same machine.

**Context / suspected relation:**

The symptom (stores sunk out of a loop the Metal optimizer may treat as
non-terminating) resembles the family fixed in bug 283595 / bug 286820
("Loops are susceptible to UB optimizations", "Infinite loop forward progress
detection leads to problematic codegen"), but this case still reproduces on
WebKit 26.5, and requires the nested-array + two-dynamic-inner-loop shape.

Found in production: this miscompiled the 6x6 LDL^T factorization of a GPU
rigid-body solver, NaN-ing all body positions on visionOS while working
everywhere else. Flattening the matrices to `array<f32, 36>` was a full
workaround.
