# Kora fire in three.js

A browser implementation of the combustion solver described in **[Kora: A Physics-Based Fire Pipeline and Toolset](https://doi.org/10.1145/3819990.3820026)** (Stomakhin et al., Weta FX, DigiPro '26) — the fire system built for *Avatar: Fire and Ash*, which won the VES 2026 Emerging Technology Award. Everything runs on the GPU through WebGPU compute shaders written in TSL.

![Fire tornado preset](docs/fire-tornado.png)

The paper's central argument is that fire behaviour should *emerge from tracked chemistry* rather than from noise and hand-keyed modulation:

> Fuel-rich conditions give rise to oxygen starvation, in which combustion becomes locally oxygen-limited and flame fronts intermittently ignite and extinguish as fresh oxygen is entrained from the surrounding flow. This naturally produces visual phenomena known as choked flames, pulsation, and flickering. Because the solver tracks chemicals and models reactions explicitly, these behaviors emerge directly from the local availability of reactants rather than from heuristic noise or temporal modulation.

So this carries real molar concentrations of fuel, oxygen, nitrogen and combustion products through every voxel, burns them against a stoichiometric limit, and lets the flicker fall out of the chemistry. With the propane torch preset the flame settles at 2200–2700 K, which is propane's adiabatic flame temperature — not a number that was dialled in anywhere.

## Running it

Requires a WebGPU browser: Chrome/Edge 113+, or Safari 18+.

```bash
npm install
npm run dev
```

The dev server is HTTPS on the LAN address as well as localhost, which is there for the headset: WebXR needs a secure context, and a Vision Pro reaching this machine over the network doesn't get localhost's exemption. The certificate is self-signed, so Safari will ask you to accept it once before the VR button will do anything.

Known issue: `npm run build` gates on `tsc --noEmit`, which currently runs for many minutes and gets killed rather than reporting an error. The editor's language service checks `src` clean, so this looks like pathological inference against the large `@types/three` graph under TypeScript 7's native compiler, not a real type error. `npx vite build` on its own works.

## There are no particles

This is the thing most worth understanding, and it surprises people.

There are two ways to simulate a fluid. The **Lagrangian** approach uses particles that carry properties like temperature and velocity and physically move through space. The **Eulerian** approach fixes a grid in space and lets fluid flow *through* stationary cells — nothing moves, and what changes is the numbers stored in each cell. Kora is Eulerian, and so is this. There is not one particle anywhere in the codebase.

The status readout says `96^3 · 0.88 M voxels`. That's a 96×96×96 lattice of 884,736 fixed cells filling a 2 m box, so each voxel is a cube roughly 2 cm on a side. That 2 cm is a hard floor on detail: no feature smaller than a voxel can exist. It's precisely why the paper's energy cascade turbulence is needed — it injects swirl to *suggest* structure below grid scale that the grid cannot itself resolve.

Each voxel holds eleven numbers across three RGBA 3D textures:

| Field | Channels |
| --- | --- |
| `chem` | fuel, oxygen, nitrogen, products (molar concentrations) |
| `aux` | soot, temperature (K), released heat, flame-front distance |
| `vel` | velocity u, v, w |

Each is double-buffered, because WebGPU won't let one compute shader read and write the same texture: a pass reads one copy and writes the other, then they swap. With pressure, divergence and expansion, the core state is about 57 MB of GPU memory.

**Motion without particles** comes from semi-Lagrangian advection, which is confusingly named. Each frame, for every voxel, the solver traces *backwards* along the velocity field to ask "where was the material that's now in me, one timestep ago?" and samples there. It's a backward lookup discarded immediately, with no persistence — see `trace()` in [`advection.ts`](src/sim/passes/advection.ts).

**Velocity lives on faces, not centres.** The x-component sits on the face between a cell and its neighbour in x, and so on. On this staggered (MAC) grid, divergence and pressure gradients become exact differences between adjacent samples instead of wide averages, which is the difference between a stable pressure solve and one that oscillates.

**Nothing is rendered as geometry.** The scene contains exactly one object for the fire: a cube of twelve triangles bounding the domain. The fragment shader takes each pixel that cube covers, casts a ray, and walks it through the 3D textures in up to 160 steps, accumulating emission from the blackbody temperature and opacity from soot and flame. The flame you see is that accumulation — no mesh, no surface, no sprites.

**The flame front is also just a field.** It's a signed distance stored per voxel, negative inside the reaction zone and positive outside, and combustion fires wherever it is at or below zero. The flame's "surface" is implied by the zero crossing and is never explicitly constructed.

Fire suits a grid because the physics is mostly spatial derivatives. Enforcing the ideal gas law means computing divergence; buoyancy means solving a pressure Poisson equation across neighbours; diffusion means averaging with adjacent cells. All natural on a lattice, all awkward with particles.

## Paper sections mapped to code

The solver follows Algorithm 1 of the paper, one pass per step, orchestrated in [`KoraSolver.ts`](src/sim/KoraSolver.ts).

| Paper | Code |
| --- | --- |
| §4.3.1 mixture thermodynamics, eq. (15) | [`mixture.ts`](src/sim/mixture.ts) |
| §4.3 / §4.4 expansion, ideal gas constraint, adiabatic cooling | [`expansion.ts`](src/sim/passes/expansion.ts) |
| §4.5.1 combustion, soot formation and oxidation, eq. (21) | [`combustion.ts`](src/sim/passes/combustion.ts) |
| §4.5.2 flame-front SDF and propagation, eq. (22) | [`flameFront.ts`](src/sim/passes/flameFront.ts) |
| §4.7.1 variable-density pressure projection | [`projection.ts`](src/sim/passes/projection.ts) |
| §4.7.2 mass diffusion and thermal conduction | [`diffusion.ts`](src/sim/passes/diffusion.ts) |
| §4.7.3 semi-Lagrangian and MacCormack advection | [`advection.ts`](src/sim/passes/advection.ts) |
| §4.7.4 radiative cooling | [`radiativeCooling.ts`](src/sim/passes/radiativeCooling.ts) |
| §4.7.5 dissipation, eq. (28) | [`sourcing.ts`](src/sim/passes/sourcing.ts) |
| §4.8 energy cascade turbulence, eq. (30) | [`turbulence.ts`](src/sim/passes/turbulence.ts) |
| §5.1 premixed fuel sourcing and volumetric stamping | [`sourcing.ts`](src/sim/passes/sourcing.ts) |
| §5.3.1 warped gravity and truncated Coriolis, eq. (36) | [`forces.ts`](src/sim/passes/forces.ts) |
| §5.3.2 frequency-domain guiding, eq. (38) | [`guiding.ts`](src/sim/passes/guiding.ts) |
| §5.4.1 blackbody flame colour, hollow flame, eq. (41) | [`VolumeRenderer.ts`](src/render/VolumeRenderer.ts) |
| §5.4.2 Kora diffusion and crust | [`VolumeRenderer.ts`](src/render/VolumeRenderer.ts) |
| §6 production setups | [`presets.ts`](src/ui/presets.ts) |

Physical constants and the fuel database are in [`constants.ts`](src/sim/constants.ts). The controls are grouped the way the paper groups its toolset — sourcing, simulation control, art direction, rendering — because §5.2 argues the value is as much in *which* parameters get exposed as in the solver behind them.

## How this differs from production Kora

Kora proper is "a weakly compressible, sparse, spatially adaptive, MPI-distributed physics-based combustion solver" running on a render farm. This is a dense grid in one browser tab, so the differences are substantial and worth being honest about.

The grid here is dense and uniform rather than sparse and spatially adaptive, so memory is spent on empty air and resolution is uniform where Kora refines near the flame. There's no MPI distribution, no liquid-gas coupling or vaporization, and no Houdini integration. The pressure projection is a fixed number of Jacobi iterations rather than a converged solve, so it's formulated in terms of deviation from hydrostatic equilibrium to keep buoyancy correct regardless of convergence. Rendering is single-scattering raymarching rather than Manuka's spectral path tracing. The eq. (30) turbulence filter defaults to an à-trous approximation, with the exact form available as a toggle.

## Performance

The frame is almost entirely solver. On an M3 Air at 96³ the simulation is ~94% of it and the raymarcher under 3%, which is the opposite of what you might expect from a volume renderer and worth knowing before optimising the wrong thing.

There's a GPU profiler built in. It attributes time per pass using WebGPU timestamp queries, submitting each pass as its own compute group for the duration of a run, and separately measures each stage by ablation on the batched path the app really uses — run the frame, run it again without the stage, take the difference:

```js
await kora.profile()  // stage budget, then solver passes grouped and individual
```

Two findings from it paid for themselves immediately, both without any change to the maths:

- **The pressure solve was recomputing its own coefficients.** Every Jacobi sweep evaluated the full mixture density of a cell and its six neighbours, but density is fixed for the whole projection. Caching the face weights, the boundary mask and the Neumann wind faces into two textures once per frame turned a sweep from 1.11 ms into 0.31 ms.
- **Curl noise was being differenced live.** Six trilinear fetches per band per voxel, twenty-four at the default band count, to take a curl of a static potential. Baking the curl into the noise volume makes it one fetch: 4.36 ms to 1.13 ms.

Together those took the frame from 47 ms to 18.6 ms — 21 fps to 54 fps — at identical quality.

Past that, cost is traded for quality through the `quality` control, which is deliberately separate from the preset: a preset says what the fire *is*, a tier says what it may cost. Measured on the same machine and scene:

| tier | grid | Jacobi | frame | fps |
| --- | --- | --- | --- | --- |
| ultra | 128³ | 32 | 49.7 ms | 20 |
| high | 96³ | 24 | 18.9 ms | 53 |
| balanced | 80³ | 12 | 8.5 ms | 117 |
| performance | 64³ | 8 | 3.3 ms | 305 |

The tiers move grid resolution and Jacobi iterations first because that is where the measurement pointed; raymarch steps barely move until the lowest tier, since cutting them buys almost nothing here and costs banding. At `performance` the plume is visibly softer and loses its finest wisps, but it is still recognisably the same fire, and a 3 ms frame leaves room for a game to do everything else.

## Immersive VR

There's an **Enter VR** button on headsets that can run it, tested against Safari on visionOS.

The requirement worth calling out is that the session has to be WebGPU-backed. The solver *is* compute shaders, so there is no WebGL path to fall back to, and until WebKit shipped the WebXR/WebGPU binding this could not have worked on the device at all. Two things follow, both easy to get wrong:

- `renderer.xr.enabled` has to be set **before** `renderer.init()`, because that is when three requests the adapter and passes the flag through as `xrCompatible`. Set it afterwards and the device is already the wrong kind.
- the session is requested with `webgpu` as a *required* feature, alongside `layers`, which three needs in order to install its `XRGPUBinding` projection layer.

The button stays hidden where immersive VR isn't offered at all, but says so explicitly on a browser that has WebXR without the WebGPU binding — that's the difference between an out-of-date visionOS and a bug, and it is not otherwise visible from inside a headset.

Navigation is object-centric. The viewer's rig never moves; the domain is placed a metre and a bit in front of you, scaled so every preset frames the same way, and **pinch and drag to turn it**. On visionOS a pinch arrives as a `transient-pointer` input source that exists only for the duration of the gesture. Its ray is anchored near the shoulder and passes through the pinching hand, so moving that hand changes both where the ray starts and where it points; rather than guess which signal dominates, both are summed, which also makes controllers and gaze work unchanged. Release and it coasts to a stop, and catching it stops it dead. Release velocity is smoothed across frames and capped, because hand tracking drops poses and one long frame reporting an implausible speed will otherwise throw the domain through several turns.

Two things are given up inside a session. Bloom is skipped, since the pass composites through a screen-space render target that the per-eye array texture won't take, so the fire loses its glow. And the quality tier is stepped down to `balanced` for the duration and restored on exit: three currently disables multiview for WebGPU XR, so the volume is raymarched twice per frame at headset resolution, and a fire that judders is worse than one with less detail.

## Diagnostics

Field statistics can be read back from the GPU at any time, which is how the physics above was verified. In the browser console:

```js
await kora.probe()        // min/max/NaN per field, as a table
kora.setDebugView('heat') // max-intensity projection of one channel
kora.setQuality('balanced')
await kora.advance(120)   // step without requestAnimationFrame, for headless checks
kora.findBadPass()        // dispatch each pass alone, name any that fails to compile
kora.gpuErrors()          // deduplicated WebGPU errors
```

The debug views step through the shading chain — `temperature`, `heat`, `soot`, `equivalence`, then `flameAlpha`, `blackbody`, `emission` — so a black frame can be attributed to a specific link rather than guessed at.

![Domain grid, origin and simulation bounds](docs/domain-grid.png)

## Credits

All of the science here is from the original paper. Please cite it, not this repository:

> Alexey Stomakhin, John Edholm, Murali Ramachari, Aleksandr Isakov, Zahra Forootaninia, Marcus Schoo, Nicholas Illingworth, and Joe Letteri. 2026. *Kora: A Physics-Based Fire Pipeline and Toolset.* In Proceedings of DigiPro '26. https://doi.org/10.1145/3819990.3820026

The paper is licensed CC BY-NC-ND 4.0. *Kora* is te reo Māori for *spark*.
