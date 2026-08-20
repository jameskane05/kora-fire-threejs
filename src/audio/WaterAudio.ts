/**
 * Procedural water bed for the MLS water exhibit — filtered noise + Minnaert bubble voices.
 *
 * Drivers: hand/collider stir energy (CPU), particle mean/max speed (GPU probe), pour envelope.
 * Bowl-scale: quiet idle, interaction-led splash/plinks. See docs/procedural-water-audio.md.
 */
export const WATER_AUDIO_ENABLED = true;

export interface WaterDrivers {
  /** Hand / collider energy (strength × speed). */
  stirEnergy: number;
  /** Active force count in the domain. */
  contactCount: number;
  /** Mean particle speed (sim units). */
  meanSpeed: number;
  /** Peak particle speed (sim units). */
  maxSpeed: number;
  /** 0–1 pour envelope (set via triggerPour). */
  pour: number;
}

const EMPTY: WaterDrivers = {
  stirEnergy: 0,
  contactCount: 0,
  meanSpeed: 0,
  maxSpeed: 0,
  pour: 0,
};

/** van den Doel / Minnaert: f ≈ 3 / r with r in meters → Hz. */
const MINNAERT_C = 3.0;

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function soft(v: number, scale: number): number {
  return clamp01(v / Math.max(scale, 1e-6));
}

function smoothToward(current: number, target: number, dt: number, hz: number): number {
  const a = 1 - Math.exp(-hz * Math.max(dt, 0));
  return current + (target - current) * a;
}

function makeNoiseBuffer(ctx: AudioContext, seconds: number, brown = false): AudioBuffer {
  const length = Math.max(1, Math.floor(ctx.sampleRate * seconds));
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  let last = 0;
  for (let i = 0; i < length; i++) {
    const white = Math.random() * 2 - 1;
    if (brown) {
      last = (last + white * 0.02) * 0.998;
      data[i] = last * 3.5;
    } else {
      data[i] = white;
    }
  }
  return buffer;
}

function loopNoise(ctx: AudioContext, buffer: AudioBuffer, rate = 1): AudioBufferSourceNode {
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  src.loop = true;
  src.playbackRate.value = rate;
  src.start();
  return src;
}

export class WaterAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private bedLowGain: GainNode | null = null;
  private bedMidGain: GainNode | null = null;
  private bedHighGain: GainNode | null = null;
  private bubbleBus: GainNode | null = null;
  private splashBus: GainNode | null = null;
  private white: AudioBuffer | null = null;
  private sources: AudioBufferSourceNode[] = [];

  private enabled = false;
  private targets: WaterDrivers = { ...EMPTY };
  private smooth: WaterDrivers = { ...EMPTY };
  private pourUntil = 0;
  private splashCooldown = 0;
  private bubbleCooldown = 0;

  get active(): boolean {
    return this.enabled && this.ctx?.state === 'running';
  }

  setEnabled(on: boolean): void {
    this.enabled = WATER_AUDIO_ENABLED && on;
    if (!this.enabled) {
      this.targets = { ...EMPTY };
      this.pourUntil = 0;
      if (this.master && this.ctx) {
        this.master.gain.cancelScheduledValues(this.ctx.currentTime);
        this.master.gain.setTargetAtTime(0, this.ctx.currentTime, 0.06);
      }
    } else if (this.master && this.ctx?.state === 'running') {
      this.master.gain.setTargetAtTime(0.42, this.ctx.currentTime, 0.1);
    }
  }

  /** Unlock AudioContext from a click / Enter VR / material select. */
  async resume(): Promise<void> {
    if (!WATER_AUDIO_ENABLED) return;
    if (!this.ctx) this.build();
    if (!this.ctx) return;
    if (this.ctx.state === 'suspended') await this.ctx.resume();
    if (this.enabled && this.master) {
      this.master.gain.setTargetAtTime(0.42, this.ctx.currentTime, 0.1);
    }
  }

  setDrivers(next: Partial<WaterDrivers>): void {
    if (!WATER_AUDIO_ENABLED) return;
    this.targets = { ...this.targets, ...next };
  }

  /** Brief elevated density matching the seeded tap stream on water reset. */
  triggerPour(durationSec = 1.25): void {
    if (!WATER_AUDIO_ENABLED || !this.enabled) return;
    this.pourUntil = Math.max(this.pourUntil, performance.now() / 1000 + durationSec);
    this.targets.pour = 1;
  }

  update(dt: number): void {
    if (!WATER_AUDIO_ENABLED || !this.ctx || !this.master || !this.enabled) return;

    const nowWall = performance.now() / 1000;
    if (this.pourUntil > nowWall) {
      const remain = this.pourUntil - nowWall;
      this.targets.pour = clamp01(remain / 0.35);
    } else {
      this.targets.pour = 0;
    }

    const s = this.smooth;
    const t = this.targets;
    s.stirEnergy = smoothToward(s.stirEnergy, t.stirEnergy, dt, 12);
    s.contactCount = smoothToward(s.contactCount, t.contactCount, dt, 10);
    s.meanSpeed = smoothToward(s.meanSpeed, t.meanSpeed, dt, 6);
    s.maxSpeed = smoothToward(s.maxSpeed, t.maxSpeed, dt, 8);
    s.pour = smoothToward(s.pour, t.pour, dt, 4);

    const stirN = soft(s.stirEnergy, 180);
    const contactN = soft(s.contactCount, 18);
    const meanN = soft(s.meanSpeed, 2.2);
    const maxN = soft(s.maxSpeed, 8);
    const pourN = clamp01(s.pour);

    const motion = clamp01(meanN * 0.85 + maxN * 0.25);
    const presence = clamp01(stirN * 0.95 + contactN * 0.2 + motion * 0.45 + pourN * 0.55);
    const now = this.ctx.currentTime;

    if (this.bedLowGain) {
      this.bedLowGain.gain.setTargetAtTime(0.04 * presence + 0.02 * pourN, now, 0.06);
    }
    if (this.bedMidGain) {
      this.bedMidGain.gain.setTargetAtTime(
        0.07 * clamp01(stirN * 0.7 + motion * 0.5 + pourN * 0.6),
        now,
        0.05,
      );
    }
    if (this.bedHighGain) {
      this.bedHighGain.gain.setTargetAtTime(0.05 * clamp01(stirN * 0.9 + maxN * 0.35), now, 0.04);
    }
    if (this.bubbleBus) {
      this.bubbleBus.gain.setTargetAtTime(0.55 * clamp01(0.15 + presence), now, 0.05);
    }
    if (this.splashBus) {
      this.splashBus.gain.setTargetAtTime(0.4 * clamp01(0.1 + stirN), now, 0.04);
    }

    // Bubble / plink rate — a bit sparser so each event can read as a drop, not a beep train.
    const lambda =
      stirN * 18 + motion * 7 + pourN * 16 + contactN * 2.5;
    this.bubbleCooldown = Math.max(0, this.bubbleCooldown - dt);
    if (this.bubbleCooldown <= 0 && lambda > 0.4 && Math.random() < lambda * dt) {
      // Bias small radii (shorter, higher, splashier) — large Minnaert sines read as boops.
      const radiusM = lerp(0.0009, 0.0045, Math.random() ** 2.1);
      const amp = 0.045 + stirN * 0.12 + pourN * 0.05 + Math.random() * 0.05;
      const rise = 0.04 + Math.random() * 0.09;
      this.spawnBubble(radiusM, amp, rise);
      this.bubbleCooldown = 0.018 + Math.random() * 0.04;
    }

    // Splash noise bursts from hand energy.
    this.splashCooldown = Math.max(0, this.splashCooldown - dt);
    const splashRate = stirN * 14 + contactN * 1.5;
    if (this.splashCooldown <= 0 && splashRate > 0.5 && Math.random() < splashRate * dt) {
      this.burstSplash(0.04 + stirN * 0.12);
      this.splashCooldown = 0.03 + Math.random() * 0.06;
    }
  }

  dispose(): void {
    for (const src of this.sources) {
      try {
        src.stop();
      } catch {
        /* already stopped */
      }
    }
    this.sources = [];
    void this.ctx?.close();
    this.ctx = null;
    this.master = null;
  }

  /**
   * One water plink: broadband impact (Pumphrey click) + a short resonant filter ring
   * (bubble entrainment). Sustained sines sound like UI beeps; impulse→bandpass reads wetter.
   */
  private spawnBubble(radiusM: number, amp: number, rise: number): void {
    if (!this.ctx || !this.white || !this.bubbleBus) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const f0 = Math.min(2800, Math.max(520, MINNAERT_C / Math.max(radiusM, 5e-4)));
    const f1 = f0 * (1 + rise);
    // Small bubbles die fast; avoid long tonal tails.
    const dur = 0.028 + radiusM * 12 + Math.random() * 0.035;
    const peak = Math.min(0.2, amp);

    // --- Impact transient (majority of the perceived “drop”) ---
    const impactSrc = ctx.createBufferSource();
    impactSrc.buffer = this.white;
    impactSrc.playbackRate.value = 0.85 + Math.random() * 0.55;
    const impactHp = ctx.createBiquadFilter();
    impactHp.type = 'highpass';
    impactHp.frequency.value = 1200 + Math.random() * 2800;
    impactHp.Q.value = 0.5;
    const impactBp = ctx.createBiquadFilter();
    impactBp.type = 'bandpass';
    impactBp.frequency.value = 1800 + Math.random() * 3200;
    impactBp.Q.value = 0.55 + Math.random() * 0.45;
    const impactGain = ctx.createGain();
    const impactPeak = peak * (0.55 + Math.random() * 0.35);
    const impactDur = 0.012 + Math.random() * 0.02;
    impactGain.gain.setValueAtTime(impactPeak, t);
    impactGain.gain.exponentialRampToValueAtTime(0.0008, t + impactDur);
    impactSrc.connect(impactHp).connect(impactBp).connect(impactGain).connect(this.bubbleBus);
    impactSrc.start(t);
    impactSrc.stop(t + impactDur + 0.01);

    // --- Bubble ring: brief noise excites a resonant bandpass (not a free-running oscillator) ---
    const excSrc = ctx.createBufferSource();
    excSrc.buffer = this.white;
    const excGate = ctx.createGain();
    const excMs = 0.0015 + Math.random() * 0.0025;
    excGate.gain.setValueAtTime(1, t);
    excGate.gain.exponentialRampToValueAtTime(0.0008, t + excMs);

    const ring = ctx.createBiquadFilter();
    ring.type = 'bandpass';
    ring.Q.value = 6 + Math.random() * 6; // moderate — high Q = ringtone
    ring.frequency.setValueAtTime(f0, t);
    ring.frequency.exponentialRampToValueAtTime(Math.max(f0 * 1.01, f1), t + dur);

    // Soft lowpass so the ring is rounded, not piercing.
    const round = ctx.createBiquadFilter();
    round.type = 'lowpass';
    round.frequency.value = Math.min(5500, f0 * 2.2 + 800);
    round.Q.value = 0.7;

    const ringGain = ctx.createGain();
    const ringPeak = peak * (0.18 + Math.random() * 0.16);
    ringGain.gain.setValueAtTime(0.0001, t);
    ringGain.gain.exponentialRampToValueAtTime(ringPeak, t + 0.002);
    ringGain.gain.exponentialRampToValueAtTime(0.0001, t + dur);

    excSrc.connect(excGate).connect(ring).connect(round).connect(ringGain).connect(this.bubbleBus);
    excSrc.start(t);
    excSrc.stop(t + excMs + 0.008);

    // Occasional second quieter micro-bubble (MIDI-echo analogue) — short delay, smaller radius.
    if (Math.random() < 0.35) {
      const t2 = t + 0.012 + Math.random() * 0.03;
      const f2 = f0 * (1.15 + Math.random() * 0.45);
      const dur2 = dur * (0.45 + Math.random() * 0.35);
      const exc2 = ctx.createBufferSource();
      exc2.buffer = this.white;
      const gate2 = ctx.createGain();
      gate2.gain.setValueAtTime(1, t2);
      gate2.gain.exponentialRampToValueAtTime(0.0008, t2 + 0.002);
      const ring2 = ctx.createBiquadFilter();
      ring2.type = 'bandpass';
      ring2.Q.value = 5 + Math.random() * 5;
      ring2.frequency.setValueAtTime(f2, t2);
      ring2.frequency.exponentialRampToValueAtTime(f2 * (1 + rise * 0.7), t2 + dur2);
      const g2 = ctx.createGain();
      const p2 = ringPeak * (0.35 + Math.random() * 0.3);
      g2.gain.setValueAtTime(0.0001, t2);
      g2.gain.exponentialRampToValueAtTime(p2, t2 + 0.002);
      g2.gain.exponentialRampToValueAtTime(0.0001, t2 + dur2);
      exc2.connect(gate2).connect(ring2).connect(g2).connect(this.bubbleBus);
      exc2.start(t2);
      exc2.stop(t2 + 0.01);
    }
  }

  private burstSplash(amp: number): void {
    if (!this.ctx || !this.white || !this.splashBus) return;
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.white;
    src.playbackRate.value = 0.9 + Math.random() * 0.35;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 700 + Math.random() * 2200;
    filter.Q.value = 0.45 + Math.random() * 0.5;
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 400 + Math.random() * 600;
    const gain = ctx.createGain();
    const t = ctx.currentTime;
    const peak = Math.min(0.24, amp);
    const dur = 0.035 + Math.random() * 0.055;
    gain.gain.setValueAtTime(peak, t);
    gain.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    src.connect(hp).connect(filter).connect(gain).connect(this.splashBus);
    src.start(t);
    src.stop(t + dur + 0.02);
  }

  private build(): void {
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    this.ctx = ctx;

    const brown = makeNoiseBuffer(ctx, 2.5, true);
    this.white = makeNoiseBuffer(ctx, 1.5, false);

    this.master = ctx.createGain();
    this.master.gain.value = 0;

    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 80;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 7200;

    // Short bowl reverb — delay network, no IR asset.
    const verbIn = ctx.createGain();
    verbIn.gain.value = 0.22;
    const dry = ctx.createGain();
    dry.gain.value = 0.85;
    const delays = [0.017, 0.023, 0.031, 0.043].map((sec) => {
      const d = ctx.createDelay(0.1);
      d.delayTime.value = sec;
      const g = ctx.createGain();
      g.gain.value = 0.28;
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = 4500;
      verbIn.connect(d).connect(f).connect(g);
      g.connect(d);
      return g;
    });

    const mix = ctx.createGain();
    dry.connect(mix);
    for (const g of delays) g.connect(mix);
    mix.connect(this.master);
    this.master.connect(ctx.destination);

    const bus = ctx.createGain();
    bus.connect(hp).connect(lp);
    lp.connect(dry);
    lp.connect(verbIn);

    // Bed — stacked / slightly detuned noise (tutorial “stacking” analogue).
    const lowFilter = ctx.createBiquadFilter();
    lowFilter.type = 'lowpass';
    lowFilter.frequency.value = 280;
    this.bedLowGain = ctx.createGain();
    this.bedLowGain.gain.value = 0;
    const bedA = loopNoise(ctx, brown, 1);
    const bedB = loopNoise(ctx, brown, 0.93);
    bedA.connect(lowFilter);
    bedB.connect(lowFilter);
    lowFilter.connect(this.bedLowGain).connect(bus);
    this.sources.push(bedA, bedB);

    const midFilter = ctx.createBiquadFilter();
    midFilter.type = 'bandpass';
    midFilter.frequency.value = 900;
    midFilter.Q.value = 0.6;
    this.bedMidGain = ctx.createGain();
    this.bedMidGain.gain.value = 0;
    const mid = loopNoise(ctx, this.white, 1.02);
    mid.connect(midFilter).connect(this.bedMidGain).connect(bus);
    this.sources.push(mid);

    const highFilter = ctx.createBiquadFilter();
    highFilter.type = 'highpass';
    highFilter.frequency.value = 2400;
    this.bedHighGain = ctx.createGain();
    this.bedHighGain.gain.value = 0;
    const high = loopNoise(ctx, this.white, 1.07);
    high.connect(highFilter).connect(this.bedHighGain).connect(bus);
    this.sources.push(high);

    this.bubbleBus = ctx.createGain();
    this.bubbleBus.gain.value = 0.55;
    this.bubbleBus.connect(bus);

    this.splashBus = ctx.createGain();
    this.splashBus.gain.value = 0.3;
    this.splashBus.connect(bus);
  }
}
