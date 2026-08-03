/**
 * Volume rendering — Kora §5.4.
 *
 * Kora renders through Manuka with a node-based render graph that resolves volume compositing at
 * render time. This is a single-scattering raymarcher rather than a spectral path tracer, but the
 * shading model follows §5.4.1 and §5.4.2 directly:
 *
 *  - flame colour from the Kelvin temperature channel via blackbody radiation
 *  - flame alpha from the released-heat channel H (the enthalpy of combustion)
 *  - the *hollow flame* of eq. (41), zeta = (1 - (2 phi - 1)^4) H, modulating H by the
 *    equivalence ratio to sharpen thin reaction zones for close-ups
 *  - soot shaded "straightforwardly by using its concentration to drive alpha and mapping a
 *    shade of gray to its color"
 *  - the two render-graph operations of §5.4.2: *Kora diffusion* (blur the temperature channel
 *    and blend it back, exaggerating radiative cooling on the outer shell) and *Kora crust*
 *    (subtract a blurred soot field from the original, isolating soot on convex regions so the
 *    emissive core shines through the concave cracks).
 */
import {
  BackSide,
  BoxGeometry,
  Mesh,
  NodeMaterial,
  AddEquation,
  CustomBlending,
  OneFactor,
  OneMinusSrcAlphaFactor,
  Vector3,
  type DataTexture,
  type Storage3DTexture,
} from 'three/webgpu';
import {
  Break,
  Fn,
  If,
  Loop,
  cameraWorldMatrix,
  clamp,
  exp,
  float,
  int,
  max,
  min,
  mix,
  modelWorldMatrixInverse,
  normalize,
  oneMinus,
  positionLocal,
  pow,
  screenCoordinate,
  texture,
  texture3D,
  uniform,
  vec2,
  vec3,
  vec4,
} from 'three/tsl';
import { BLACKBODY_MAX_K, BLACKBODY_MIN_K, createBlackbodyLUT } from './blackbody';
import type { KoraParams } from '../sim/params';

/* eslint-disable @typescript-eslint/no-explicit-any */
type N = any;

/** Upper bound for the raymarch loop; the artist-facing step count only changes the stride. */
const MAX_STEPS = 256;

/**
 * Debug views, as a max-intensity projection of one scalar. Index 0 is the shaded result; 1-4 are
 * raw solver outputs and 5-7 are successive links of the shading chain.
 */
export const DEBUG_CHANNELS = [
  'off',
  'temperature',
  'heat',
  'soot',
  'equivalence',
  'flameAlpha',
  'blackbody',
  'emission',
] as const;
export type DebugChannel = (typeof DEBUG_CHANNELS)[number];

export interface VolumeInputs {
  /** (temperature, released heat, soot, equivalence ratio) */
  field: Storage3DTexture;
  /** (blurred temperature, blurred heat, blurred soot, blurred phi) */
  blur: Storage3DTexture;
  /** (solid velocity, signed distance) — the march terminates where w goes negative */
  solid: Storage3DTexture;
}

export class VolumeRenderer {
  readonly mesh: Mesh;
  readonly lut: DataTexture;

  private readonly u = {
    boxMin: uniform(new Vector3()),
    boxMax: uniform(new Vector3()),
    steps: uniform(160),
    exposure: uniform(1),
    flameIntensity: uniform(1),
    hollowFlame: uniform(0.85),
    sootDensity: uniform(280),
    sootAlbedo: uniform(0.28),
    smokeAmbient: uniform(0.16),
    koraDiffusion: uniform(0.35),
    koraCrust: uniform(0.3),
    showFlameFront: uniform(0),
    frame: uniform(0),
    /** 0 = shaded, otherwise a max-intensity projection of one raw channel */
    debugChannel: uniform(0),
    debugScale: uniform(1),
    /** 1 while any displacement volume exists, gating the solid fetch out of the march */
    obstacles: uniform(0),
  };

  constructor(inputs: VolumeInputs, domainSize: number) {
    this.lut = createBlackbodyLUT();

    const half = domainSize / 2;
    this.u.boxMin.value.set(-half, 0, -half);
    this.u.boxMax.value.set(half, domainSize, half);

    const geometry = new BoxGeometry(domainSize, domainSize, domainSize);
    geometry.translate(0, half, 0);

    const material = new NodeMaterial();
    material.side = BackSide;
    material.transparent = true;
    material.depthWrite = false;
    material.depthTest = true;
    // The raymarcher emits premultiplied radiance, and its alpha only tracks soot extinction. A
    // clean premixed flame makes no soot, so alpha is zero while the emission is bright; under
    // ordinary src-alpha blending that multiplies the fire away to nothing. Spelling the factors
    // out gives `src.rgb + dst * (1 - src.a)`, so emission composites regardless of opacity.
    material.blending = CustomBlending;
    material.blendEquation = AddEquation;
    material.blendSrc = OneFactor;
    material.blendDst = OneMinusSrcAlphaFactor;
    material.blendSrcAlpha = OneFactor;
    material.blendDstAlpha = OneMinusSrcAlphaFactor;
    material.premultipliedAlpha = true;
    material.fragmentNode = this.buildShader(inputs)();

    this.mesh = new Mesh(geometry, material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 10;
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    const material = this.mesh.material;
    if (Array.isArray(material)) material.forEach((m) => m.dispose());
    else material.dispose();
    this.lut.dispose();
  }

  private buildShader(inputs: VolumeInputs) {
    const u = this.u;
    const lut = this.lut;

    /** Blackbody colour for a Kelvin temperature, with the Stefan-Boltzmann T^4 intensity. */
    const blackbody = (T: N): N => {
      const t = clamp(
        T.sub(BLACKBODY_MIN_K).div(BLACKBODY_MAX_K - BLACKBODY_MIN_K),
        float(0.0),
        float(1.0),
      );
      const chroma = texture(lut, vec2(t, 0.5)).rgb;
      const intensity = pow(T.div(2200.0), float(4.0));
      return chroma.mul(intensity);
    };

    /** Slab test against the domain AABB. */
    const intersectBox = (origin: N, invDir: N) => {
      const t0 = u.boxMin.sub(origin).mul(invDir);
      const t1 = u.boxMax.sub(origin).mul(invDir);
      const lo = min(t0, t1);
      const hi = max(t0, t1);
      return {
        near: max(max(lo.x, lo.y), lo.z),
        far: min(min(hi.x, hi.y), hi.z),
      };
    };

    return Fn(() => {
      // The march runs in object space, where the domain bounds are fixed and a step of `ds` is a
      // step of `ds` simulated metres. In a session the mesh hangs off a rig that scales the
      // domain down and swings it around, so a world-space ray would miss the box entirely.
      //
      // The camera comes from the translation column of its world matrix rather than TSL's
      // `cameraPosition`: under an XR ArrayCamera the latter backs itself with a uniform array
      // whose render-update callback three invokes frameless during setup, which throws. Both
      // resolve per-eye.
      const cameraWorld: N = (cameraWorldMatrix as N)[3];
      const origin = modelWorldMatrixInverse.mul(cameraWorld).xyz;
      const dir = normalize(positionLocal.sub(origin));
      const invDir = vec3(1.0).div(dir);

      const hit = intersectBox(origin, invDir);
      const tNear = max(hit.near, float(0.0)).toVar();
      const tFar = max(hit.far, tNear).toVar();

      const ds = tFar.sub(tNear).div(u.steps).toVar();

      // interleaved-gradient jitter, re-seeded each frame, trading banding for a little noise
      const jitter = screenCoordinate.x
        .mul(0.06711056)
        .add(screenCoordinate.y.mul(0.00583715))
        .add(u.frame.mul(0.6180339))
        .fract();

      const extent = u.boxMax.sub(u.boxMin);
      const transmittance = float(1.0).toVar();
      const radiance = vec3(0.0).toVar();
      const t = tNear.add(ds.mul(jitter)).toVar();
      const debugPeak = float(0.0).toVar();

      Loop(MAX_STEPS, () => {
        If(
          t.greaterThanEqual(tFar)
            .or(transmittance.lessThan(float(0.004)))
            .or(ds.lessThanEqual(float(0.0))),
          () => {
            Break();
          },
        );

        const p = origin.add(dir.mul(t));
        const uvw = p.sub(u.boxMin).div(extent);

        // Displacement volumes are opaque. The solver already keeps them empty of fuel and heat,
        // so marching through one accumulates nothing — but everything behind one would still
        // show through it. Stopping here is what makes an obstacle read as solid.
        // The branch is on a uniform, so with no obstacles in the scene the fetch is skipped
        // outright rather than fetched and discarded.
        If(u.obstacles.greaterThan(float(0.5)), () => {
          If(texture3D(inputs.solid, uvw).level(int(0)).w.lessThan(float(0.0)), () => {
            Break();
          });
        });

        const s = texture3D(inputs.field, uvw).level(int(0));
        const b = texture3D(inputs.blur, uvw).level(int(0));

        const temperature = s.x;
        const heat = s.y;
        const soot = s.z;
        const equivalence = s.w;

        // ---- §5.4.2 Kora diffusion -------------------------------------------------------
        // Blend the multi-level blurred temperature back in: the hot interior mixes with the
        // cooler surrounding air, dropping the temperature along the outer shell and
        // exaggerating the appearance of radiative cooling.
        const shadedTemperature = mix(temperature, b.x, u.koraDiffusion);

        // ---- §5.4.2 Kora crust -----------------------------------------------------------
        // Blurred soot subtracted from the original isolates convex regions of the shell; the
        // resulting layer darkens it while the emissive core shines through the concave cracks.
        const relief = max(soot.sub(b.z), float(0.0));
        const shadedSoot = max(soot.add(relief.mul(u.koraCrust).mul(4.0)), float(0.0));

        // ---- §5.4.1 flame alpha ------------------------------------------------------------
        // eq. (41): zeta = (1 - (2 phi - 1)^4) H, suppressing H near phi = 0 and phi = 1 so
        // thin reaction zones read as a shell rather than a solid blob.
        const k2 = equivalence.mul(2.0).sub(1.0).pow(2.0);
        const hollow = max(oneMinus(k2.mul(k2)), float(0.0)).mul(heat);
        const flameAlpha = mix(heat, hollow, u.hollowFlame);

        const bodyColour = blackbody(shadedTemperature);
        const debugTint = mix(
          vec3(1.0),
          mix(vec3(0.2, 0.5, 1.0), vec3(1.0, 0.25, 0.1), clamp(equivalence, 0.0, 2.0).mul(0.5)),
          u.showFlameFront,
        );

        // §5.4.1: flame colour is blackbody(T) driven by the heat channel. Soot is a separate
        // medium — "using its concentration to drive alpha and mapping a shade of gray to its
        // color". Multiplying soot into the blackbody made the plume read as warm amber haze
        // instead of creosote, and hid the smoke even when the soot field was clearly populated.
        const emission = bodyColour.mul(flameAlpha.mul(u.flameIntensity)).mul(debugTint);

        // Debug: max-intensity projection of one scalar, bypassing compositing. Channels 1-4 are
        // raw solver outputs; 5-7 step through the shading chain so a black frame can be
        // attributed to a specific link rather than guessed at.
        const luminance = (c: N) => c.x.mul(0.2126).add(c.y.mul(0.7152)).add(c.z.mul(0.0722));

        // Indices line up with DEBUG_CHANNELS, whose entry 0 is the shaded result.
        const sources: N[] = [
          temperature.div(2000.0),
          heat,
          soot,
          equivalence,
          flameAlpha,
          luminance(bodyColour),
          luminance(emission),
        ];
        const raw = sources.reduceRight(
          (otherwise, value, i) => u.debugChannel.equal(i + 1).select(value, otherwise),
          float(0.0) as N,
        );
        debugPeak.assign(max(debugPeak, raw.mul(u.debugScale)));

        // §5.4.1 takes flame alpha from the released-heat channel, so the reaction zone is a
        // medium in its own right rather than a glow painted onto smoke. Extinction has to
        // include it: a clean premixed flame makes no soot, and on soot alone it would composite
        // at zero opacity and vanish however bright its emission.
        const sootSigma = shadedSoot.mul(u.sootDensity);
        // Flame emits strongly but should not seal the ray: if extinction tracked emission 1:1,
        // a luminous core went fully opaque and erased the creosote sitting in the same column.
        const flameSigma = flameAlpha.mul(u.flameIntensity).mul(0.28);
        const sigma = sootSigma.add(flameSigma);
        const alpha = oneMinus(exp(sigma.negate().mul(ds)));

        // What fraction of the extinction here is soot rather than reaction zone. The in-scatter
        // below is light bouncing off smoke particles, so it has to be weighted by this: applied
        // to the whole alpha it also washes over a clean, soot-free flame, which only ever makes
        // the fire brighter and never reads as smoke.
        const sootShare = sootSigma.div(max(sigma, float(1e-6)));

        // Cheap self-shadowing: the blurred soot doubles as an occlusion estimate, so deep
        // smoke sits in shadow without paying for a per-step shadow ray. Scale with sootDensity
        // so the occlusion estimate tracks the same extinction the march uses.
        const shadow = exp(b.z.mul(u.sootDensity).mul(-0.045));
        const sootGrey = vec3(0.12, 0.11, 0.1);
        const sunBleed = vec3(0.35, 0.28, 0.18).mul(shadow);
        const scattered = sootGrey.add(sunBleed).mul(u.smokeAmbient).mul(u.sootAlbedo);

        // Soot extinction is absorptive: grey in-scatter is the only light it adds, so a thick
        // plume goes dark against the backdrop instead of picking up the flame's blackbody.
        const sootAlpha = oneMinus(exp(sootSigma.negate().mul(ds)));
        radiance.addAssign(
          transmittance.mul(emission.mul(ds).add(scattered.mul(sootAlpha).mul(sootShare))),
        );
        transmittance.mulAssign(oneMinus(alpha));

        t.addAssign(ds);
      });

      // Premultiplied output: rgb already includes extinction, a is opacity for the backdrop.
      const opacity = clamp(oneMinus(transmittance), float(0.0), float(1.0));
      const shaded = vec4(radiance.mul(u.exposure), opacity);

      const peak = clamp(debugPeak, float(0.0), float(1.0));
      const debug = vec4(vec3(peak.pow(0.6)), float(1.0));

      return mix(shaded, debug, min(u.debugChannel, float(1.0)));
    });
  }

  update(params: KoraParams, frame: number): void {
    const u = this.u;
    u.steps.value = params.raymarchSteps;
    u.exposure.value = params.exposure;
    u.flameIntensity.value = params.flameIntensity;
    u.hollowFlame.value = params.hollowFlame;
    u.sootDensity.value = params.sootDensity;
    u.sootAlbedo.value = params.sootAlbedo;
    u.smokeAmbient.value = params.smokeAmbient;
    u.koraDiffusion.value = params.koraDiffusion;
    u.koraCrust.value = params.koraCrust;
    u.showFlameFront.value = params.showFlameFront ? 1 : 0;
    u.debugChannel.value = DEBUG_CHANNELS.indexOf(params.debugView);
    u.debugScale.value = params.debugScale;
    u.obstacles.value = params.obstacleCount > 0 ? 1 : 0;
    u.frame.value = frame;
  }

  setDomain(domainSize: number): void {
    const half = domainSize / 2;
    this.u.boxMin.value.set(-half, 0, -half);
    this.u.boxMax.value.set(half, domainSize, half);
  }
}
