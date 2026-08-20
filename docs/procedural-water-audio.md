# Procedural water audio (hand-driven MLS)

WebAudio synthesis for the MLS-MPM **water** exhibit in [`materials.html`](../materials.html). No sample banks: the bus reacts to hand/collider forces and cheap GPU motion aggregates from the particle vel buffer.

## Scene context

- Sim domain is `[0,1]³` mapped to a ~0.42 m XR tabletop tank (hand-reachable).
- Water is weakly compressible MLS-MPM (~49k particles). Splash and pour emerge from the solver; there is no dedicated splash system.
- Interaction is XR hand bone capsules plus desktop force colliders — that is the primary expressive cue for audio.
- Quiet tank should be nearly silent. A constant outdoor-river loop reads wrong at bowl scale.

## Design goal

Two coupled layers:

1. **Interaction-led events** — discrete Minnaert-style bubble plinks and short splash noise when hands shove fluid.
2. **Thin continuous bed** — filtered noise + sparse stochastic bubbles so pouring / residual motion is not dead air, still close-mic and short-decay.

That follows the usual procedural water layering (droplet impulses + turbulence noise + density/tone control) without Ableton-style MIDI chains or offline acoustic transfer.

## Mapping from DAW-style water synthesis

| DAW / tutorial idea | WebAudio equivalent here |
| --- | --- |
| Legato note length | Exhibit enabled + pour envelope window |
| Arpeggiator / note density | Poisson rate Λ for bubble voice spawns |
| MIDI echoes / layering | Random radius PDF + short overlapping voices |
| Banded droplet chains (lows/mids/highs) | Radius bands → Minnaert \(f \propto 1/R\) |
| Noise floor / turbulence | Looped filtered noise bed (low / mid / high) |
| Post stacking (offsets + pitch) | Two detuned bed noise loops |
| Distance / room acoustics | Mild HP/LP + short algorithmic reverb (bowl, not hall) |

## Physics / published baselines

- **Minnaert** bubble resonance — damped sinusoid, pitch rises as the bubble shrinks / nears the free surface (rise factor ξ).
- **van den Doel 2005** — single-bubble IR + stochastic population (rate Λ, radius range, ξ) for drip → stream → rain. Real-time baseline for games.
- **Moss et al. 2010 / Langlois et al. 2016** — couple bubble voices to interactive fluid; steal event forcing + pitch glide, skip heavy radiation solvers.
- **Farnell, *Designing Sound*** — Pure Data bubble / running-water patches as practical envelopes.
- Open WebAudio reference: [Bubble Sound Bank](https://dougjam.github.io/demos/bubble-soundbank/) (van den Doel remake).

**Deliberately skipped in v1:** per-bubble Helmholtz transfer (Zheng–James Harmonic Fluids), coupled-bubble FDTD (Xue et al.), sample granular water, HRTF per droplet.

## Module layout

| Piece | Role |
| --- | --- |
| [`src/audio/WaterAudio.ts`](../src/audio/WaterAudio.ts) | WebAudio graph, drivers, voice bank, pour trigger |
| [`MlsMpm.readMotionStats()`](../src/materials/MlsMpm.ts) | Async GPU subsample → mean/max speed |
| [`src/materials/main.ts`](../src/materials/main.ts) | Hand `stirEnergy` / `contactCount`, enable only for water, resume UX |

Feature flag: `WATER_AUDIO_ENABLED` (default on). Audio is enabled only while the sandbox exhibit material is `water`.

## Drivers

Smoothed on the audio side so throttled GPU probes do not stair-step.

| Driver | Source | Maps to |
| --- | --- | --- |
| `stirEnergy` | Σ \|strength\| × hand/collider speed (CPU, every frame) | Splash burst rate, mid/high bed, bubble Λ |
| `contactCount` | Active force count | Soft presence when hands are in the tank |
| `meanSpeed` / `maxSpeed` | GPU vel subsample (~40 ms) | Bed floor and Λ while fluid keeps moving after a shove |
| `pour` | Water reset / select | Temporary elevated Λ + mid bed (~1.2 s) |

Hand energy is the primary feel. Residual fluid speed keeps a thin tail after the hand leaves. Idle rest → near zero.

## WebAudio graph

```
noise loops ──► low / band / high Biquads ──► bed gains ─┐
Oscillator one-shots (Minnaert + ξ glide) ──► bubble bus ─┼─► HP → LP → Convolver/alg short verb → master
white burst → bandpass ──► splash bus ───────────────────┘
```

- **Bed:** 2–3 looped noise buffers; bowl-scale gains (quiet).
- **Voice bank:** ~24 one-shot damped sines; radius ~1–8 mm → roughly 0.4–3 kHz; exponential amp decay + slight rising pitch.
- **Splash:** short bandpassed white noise; rate from `stirEnergy`.
- **Master:** HP ~80 Hz, LP ~7 kHz, short reverb, low master gain. Resume unlocks `AudioContext` from a user gesture / Enter VR.

## Tuning knobs (code)

On `WaterAudio` / drivers: master presence, bed amount, bubble rate scale, splash sensitivity, pour duration. No GUI knobs required for v1.

## Enable / resume UX

- Construct once with the materials host.
- `setEnabled(true)` only for MLS `water`; otherwise ramp master to 0.
- `resume()` on Enter VR and on water select / first interaction (same gesture path as fire’s `resumeAudio`).
- Water reset → `triggerPour()`.

## Validation checklist

- Desktop: MLS → water, drag force collider — stir/splash tracks motion; idle nearly quiet.
- Reset water — brief pour density, then settle.
- XR: Enter VR, hand through water — context resumes; audio follows hand energy without probe stair-steps.
- Sand / goo / fire / AVBD stay silent.
