/**
 * Procedural flame bed for Kora — filtered noise layers driven by field extremes.
 *
 * No sample banks: brownish loop for the bed, brighter noise for roar/whoosh, sparse
 * impulses for crackle. Drivers are smoothed so a throttled GPU probe does not stair-step.
 *
 * Off for now — flip to true when revisiting the mix.
 */
export const FLAME_AUDIO_ENABLED = false;

export interface FlameDrivers {
  /** Released heat (aux.z), MJ-scale proxy for combustion intensity. */
  heat: number;
  /** Kelvin — flame brightness / hiss. */
  temperature: number;
  /** m/s plume rush. */
  speed: number;
  /** Expansion field max — crackle rate. */
  expansion: number;
  /** Peak fuel — idle torch vs fed flame. */
  fuel: number;
  /** Hand / obstacle shove, m/s. */
  stir: number;
}

const EMPTY: FlameDrivers = {
  heat: 0,
  temperature: 300,
  speed: 0,
  expansion: 0,
  fuel: 0,
  stir: 0,
};

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function soft(v: number, scale: number): number {
  return clamp01(v / Math.max(scale, 1e-6));
}

/** One-pole toward target; rate is approximate Hz of settling. */
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

function loopNoise(ctx: AudioContext, buffer: AudioBuffer): AudioBufferSourceNode {
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  src.loop = true;
  src.start();
  return src;
}

export class FlameAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private bedGain: GainNode | null = null;
  private bedFilter: BiquadFilterNode | null = null;
  private roarGain: GainNode | null = null;
  private roarFilter: BiquadFilterNode | null = null;
  private crackleBus: GainNode | null = null;
  private stirGain: GainNode | null = null;
  private stirFilter: BiquadFilterNode | null = null;
  private brown: AudioBuffer | null = null;
  private white: AudioBuffer | null = null;
  private sources: AudioBufferSourceNode[] = [];

  private enabled = false;
  private targets: FlameDrivers = { ...EMPTY };
  private smooth: FlameDrivers = { ...EMPTY };
  private crackleCooldown = 0;

  get active(): boolean {
    return this.enabled && this.ctx?.state === 'running';
  }

  setEnabled(on: boolean): void {
    this.enabled = FLAME_AUDIO_ENABLED && on;
    if (!this.enabled) {
      this.targets = { ...EMPTY };
      if (this.master && this.ctx) {
        this.master.gain.cancelScheduledValues(this.ctx.currentTime);
        this.master.gain.setTargetAtTime(0, this.ctx.currentTime, 0.05);
      }
    }
  }

  /** Safe to call from a click / Enter VR; no-ops if already running. */
  async resume(): Promise<void> {
    if (!FLAME_AUDIO_ENABLED) return;
    if (!this.ctx) this.build();
    if (!this.ctx) return;
    if (this.ctx.state === 'suspended') await this.ctx.resume();
    if (this.enabled && this.master) {
      this.master.gain.setTargetAtTime(0.55, this.ctx.currentTime, 0.08);
    }
  }

  setDrivers(next: Partial<FlameDrivers>): void {
    if (!FLAME_AUDIO_ENABLED) return;
    this.targets = { ...this.targets, ...next };
  }

  update(dt: number): void {
    if (!FLAME_AUDIO_ENABLED || !this.ctx || !this.master || !this.enabled) return;

    const s = this.smooth;
    const t = this.targets;
    s.heat = smoothToward(s.heat, t.heat, dt, 6);
    s.temperature = smoothToward(s.temperature, t.temperature, dt, 5);
    s.speed = smoothToward(s.speed, t.speed, dt, 8);
    s.expansion = smoothToward(s.expansion, t.expansion, dt, 10);
    s.fuel = smoothToward(s.fuel, t.fuel, dt, 4);
    s.stir = smoothToward(s.stir, t.stir, dt, 10);

    const heatN = soft(s.heat, 8);
    const tempN = soft(Math.max(0, s.temperature - 400), 2200);
    const speedN = soft(s.speed, 2.5);
    const fuelN = soft(s.fuel, 0.35);
    const expandN = soft(s.expansion, 4);
    const stirN = soft(s.stir, 1.2);

    const presence = clamp01(0.15 + heatN * 0.75 + fuelN * 0.25);
    const now = this.ctx.currentTime;

    if (this.bedGain && this.bedFilter) {
      this.bedGain.gain.setTargetAtTime(0.22 * presence, now, 0.05);
      this.bedFilter.frequency.setTargetAtTime(lerp(90, 420, tempN * 0.7 + heatN * 0.3), now, 0.08);
    }

    if (this.roarGain && this.roarFilter) {
      const roar = clamp01(speedN * 0.85 + heatN * 0.35);
      this.roarGain.gain.setTargetAtTime(0.18 * roar, now, 0.04);
      this.roarFilter.frequency.setTargetAtTime(lerp(400, 2400, speedN), now, 0.06);
      this.roarFilter.Q.setTargetAtTime(lerp(0.5, 1.4, speedN), now, 0.06);
    }

    if (this.stirGain && this.stirFilter) {
      this.stirGain.gain.setTargetAtTime(0.2 * stirN, now, 0.03);
      this.stirFilter.frequency.setTargetAtTime(lerp(600, 3200, stirN), now, 0.04);
    }

    if (this.crackleBus) {
      this.crackleBus.gain.setTargetAtTime(0.35 * clamp01(0.2 + heatN), now, 0.05);
    }

    this.crackleCooldown = Math.max(0, this.crackleCooldown - dt);
    const crackleRate = expandN * 14 + heatN * 6;
    if (this.crackleCooldown <= 0 && Math.random() < crackleRate * dt) {
      this.burstCrackle(0.04 + heatN * 0.1 + expandN * 0.08);
      this.crackleCooldown = 0.03 + Math.random() * 0.08;
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

  private build(): void {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    this.ctx = ctx;

    this.brown = makeNoiseBuffer(ctx, 2.5, true);
    this.white = makeNoiseBuffer(ctx, 1.5, false);

    this.master = ctx.createGain();
    this.master.gain.value = 0;
    this.master.connect(ctx.destination);

    // Bed — low brown noise
    this.bedFilter = ctx.createBiquadFilter();
    this.bedFilter.type = 'lowpass';
    this.bedFilter.frequency.value = 180;
    this.bedGain = ctx.createGain();
    this.bedGain.gain.value = 0;
    const bed = loopNoise(ctx, this.brown);
    bed.connect(this.bedFilter).connect(this.bedGain).connect(this.master);
    this.sources.push(bed);

    // Roar / whoosh — band-passed white
    this.roarFilter = ctx.createBiquadFilter();
    this.roarFilter.type = 'bandpass';
    this.roarFilter.frequency.value = 800;
    this.roarFilter.Q.value = 0.7;
    this.roarGain = ctx.createGain();
    this.roarGain.gain.value = 0;
    const roar = loopNoise(ctx, this.white);
    roar.connect(this.roarFilter).connect(this.roarGain).connect(this.master);
    this.sources.push(roar);

    // Stir whoosh when hands shove the plume
    this.stirFilter = ctx.createBiquadFilter();
    this.stirFilter.type = 'highpass';
    this.stirFilter.frequency.value = 900;
    this.stirGain = ctx.createGain();
    this.stirGain.gain.value = 0;
    const stir = loopNoise(ctx, this.white);
    stir.connect(this.stirFilter).connect(this.stirGain).connect(this.master);
    this.sources.push(stir);

    this.crackleBus = ctx.createGain();
    this.crackleBus.gain.value = 0.2;
    this.crackleBus.connect(this.master);
  }

  private burstCrackle(amp: number): void {
    if (!this.ctx || !this.white || !this.crackleBus) return;
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.white;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 1800 + Math.random() * 3200;
    filter.Q.value = 1.2 + Math.random();
    const gain = ctx.createGain();
    const t = ctx.currentTime;
    const peak = Math.min(0.35, amp);
    gain.gain.setValueAtTime(peak, t);
    gain.gain.exponentialRampToValueAtTime(0.0008, t + 0.03 + Math.random() * 0.04);
    src.connect(filter).connect(gain).connect(this.crackleBus);
    src.start(t);
    src.stop(t + 0.08);
  }
}
