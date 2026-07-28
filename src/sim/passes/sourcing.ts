/**
 * Algorithm 1, steps 1-2: dissipation (§4.7.5) and emission (§5.1).
 *
 * Emission is Kora's *volumetric stamping* variant: "the user defines an emission region via an
 * implicit SDF, where the solver's temperature, velocity and chemical concentrations are combined
 * with the values of the corresponding input fields" (§5.1.2). The premixed fuel/oxidiser amounts
 * arriving in `sourceMix` were built by the §5.1.1 pre-mixing rule in `uniforms.ts`.
 */
import { T, load, type N } from '../tsl';
import type { Ctx } from '../context';

const { float, vec3, vec4, clamp, dot, exp, length, max, mix, oneMinus, smoothstep, textureStore } = T;

/** Signed distance to a capsule; a zero-length capsule degenerates to a sphere. */
function capsule(p: N, a: N, b: N, r: N): N {
  const pa = p.sub(a);
  const ba = b.sub(a);
  const h = clamp(dot(pa, ba).div(max(dot(ba, ba), float(1e-8))), 0.0, 1.0);
  return length(pa.sub(ba.mul(h))).sub(r);
}

/** World-space position of a point given in voxel units. */
export function worldPos(u: Ctx['u'], voxel: N): N {
  return u.origin.add(voxel.mul(u.dx));
}

/** Signed distance from a point in voxel units to the emitter surface. */
export function sourceSdf(u: Ctx['u'], voxel: N): N {
  return capsule(worldPos(u, voxel), u.sourceP0, u.sourceP1, u.sourceRadius);
}

/**
 * Emission falloff across the emitter surface: 1 inside, 0 outside.
 *
 * The edges go low-then-high; smoothstep with reversed edges is undefined in WGSL rather than a
 * free inversion, so the inside/outside flip has to be explicit.
 */
export function sourceMask(u: Ctx['u'], voxel: N): N {
  const edge = u.dx.mul(1.5);
  return oneMinus(smoothstep(edge.negate(), edge, sourceSdf(u, voxel)));
}

export function sourcingPass(ctx: Ctx): N {
  const { g, f, u, m } = ctx;

  return g.kernel(() => {
    const c = g.coord();
    const chem = load(f.chem.read, c).toVar();
    const aux = load(f.aux.read, c).toVar();
    const vel = load(f.vel.read, c).toVar();

    // ---- §4.7.5 dissipation, eq. (28) -------------------------------------------------
    // "To prevent the formation of locally depressurized regions as material is removed, the
    // dissipated amount is redistributed to ambient species, such as nitrogen or oxygen."
    const fuelKept = exp(u.fuelDissipationRate.negate().mul(u.dt));
    const fuelLost = chem.x.mul(oneMinus(fuelKept));
    const fuel = chem.x.sub(fuelLost).toVar();
    const nitrogen = chem.z.add(fuelLost).toVar();

    // Soot sits outside the equation of state, so removing it depressurises nothing.
    const soot = aux.x.mul(exp(u.sootDissipationRate.negate().mul(u.dt))).toVar();

    // ---- §5.1 emission ------------------------------------------------------------------
    const voxelOf = (o: N) => vec3(c).add(o);
    const mask = sourceMask(u, voxelOf(vec3(0.5))).toVar();

    // Continuous emission is a rate; the detonation charge is an amount injected whole. Keeping
    // them separate is what lets an emitter that is switched off still be detonated.
    const emitted = u.sourceMix
      .mul(u.dt)
      .add(u.detonationMix.mul(u.sourceImpulse))
      .mul(mask)
      .toVar();

    // Temperature and velocity are only stamped while the emitter is actually delivering
    // something. Keying them off the geometric mask alone leaves an idle emitter pinning its
    // region to the source temperature forever, and — worse for a detonation — pinning the
    // velocity there to the source velocity, holding the blast still as it tries to expand.
    const stamp = mask.mul(clamp(u.sourceGate.add(u.sourceImpulse), 0.0, 1.0)).toVar();

    fuel.addAssign(emitted.x);
    const oxygen = chem.y.add(emitted.y).toVar();
    nitrogen.addAssign(emitted.z);

    // The emitter is an inflow boundary, so inside it the temperature is the source temperature
    // rather than anything the solver arrived at. Taking a max() here instead makes it a one-way
    // ratchet that admits fresh reactants every frame while never admitting the cold gas arriving
    // with them, so each burn stacks its adiabatic rise on the last without bound. Mixing by mole
    // count is the opposite failure: at these flow speeds a voxel empties in milliseconds, far too
    // fast for the injected gas to ever dominate, and the flame starves and blows out.
    const temperature = mix(aux.y, u.sourceTemperature, stamp).toVar();

    // ---- velocity stamp, evaluated per MAC face ----------------------------------------
    const gate = clamp(u.sourceGate.add(u.sourceImpulse), 0.0, 1.0);
    const faceMask = (o: N) => sourceMask(u, voxelOf(o)).mul(gate);

    const mx = faceMask(vec3(0.0, 0.5, 0.5));
    const my = faceMask(vec3(0.5, 0.0, 0.5));
    const mz = faceMask(vec3(0.5, 0.5, 0.0));

    const newVel = vec3(
      mix(vel.x, u.sourceVelocity.x, mx),
      mix(vel.y, u.sourceVelocity.y, my),
      mix(vel.z, u.sourceVelocity.z, mz),
    );

    textureStore(f.chem.write, c, vec4(fuel, oxygen, nitrogen, chem.w)).toWriteOnly();
    textureStore(f.aux.write, c, vec4(soot, temperature, aux.z, aux.w)).toWriteOnly();
    textureStore(f.vel.write, c, vec4(newVel, 0.0)).toWriteOnly();
  });
}

/** Fills the domain with still air at ambient temperature and pushes the flame SDF outside. */
export function initialisePass(ctx: Ctx): N {
  const { g, f, u } = ctx;

  return g.kernel(() => {
    const c = g.coord();
    const air = vec4(0.0, 0.21, 0.79, 0.0);
    const narrowband = u.dx.mul(5.0);

    textureStore(f.chem.write, c, air).toWriteOnly();
    textureStore(
      f.aux.write,
      c,
      vec4(0.0, u.ambientTemperature, 0.0, narrowband),
    ).toWriteOnly();
    textureStore(f.vel.write, c, vec4(0.0)).toWriteOnly();
    textureStore(f.pressure.write, c, vec4(0.0)).toWriteOnly();
    textureStore(f.divergence, c, vec4(0.0)).toWriteOnly();
    textureStore(f.expansion, c, vec4(1.0)).toWriteOnly();
  });
}
