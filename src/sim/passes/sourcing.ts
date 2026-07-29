/**
 * Algorithm 1, steps 1-2: dissipation (§4.7.5) and emission (§5.1).
 *
 * Emission is Kora's *volumetric stamping* variant: "the user defines an emission region via an
 * implicit SDF, where the solver's temperature, velocity and chemical concentrations are combined
 * with the values of the corresponding input fields" (§5.1.2). The premixed fuel/oxidiser amounts
 * arriving in `sourceMix` were built by the §5.1.1 pre-mixing rule in `uniforms.ts`.
 */
import { T, load, worldPos, type N } from '../tsl';
import { makeSolid } from './solids';
import type { Ctx } from '../context';

export { worldPos };

const { float, vec3, vec4, clamp, dot, exp, length, max, mix, oneMinus, smoothstep, textureStore } = T;

/** Signed distance to a capsule; a zero-length capsule degenerates to a sphere. */
function capsule(p: N, a: N, b: N, r: N): N {
  const pa = p.sub(a);
  const ba = b.sub(a);
  const h = clamp(dot(pa, ba).div(max(dot(ba, ba), float(1e-8))), 0.0, 1.0);
  return length(pa.sub(ba.mul(h))).sub(r);
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

export function sourcingPass(ctx: Ctx, obstacles: number): N {
  const { g, f, u, m } = ctx;
  const solid = makeSolid(ctx, obstacles);

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

    // Temperature, velocity and now composition are only stamped while the emitter is actually
    // delivering something. Keying them off the geometric mask alone leaves an idle emitter
    // pinning its region to the source temperature forever, and — worse for a detonation —
    // pinning the velocity there to the source velocity, holding the blast still as it expands.
    const stamp = mask.mul(clamp(u.sourceGate.add(u.sourceImpulse), 0.0, 1.0)).toVar();

    // Continuous emission displaces what is in the voxel instead of being deposited on top of it.
    //
    // Adding to the cell was wrong, and wrong in a way that quietly disabled half the paper: the
    // ambient air stayed where it was, so an emitter voxel was 21% oxygen plus a trace of fuel and
    // the mixture could never run rich. Soot only nucleates from fuel left over once oxygen is
    // locally spent (§4.5.1), so nothing sooted, ever — no smoke in any preset at any setting.
    //
    // Displacement is also what gives §5.1.1's pre-mixing ratio the meaning the paper describes.
    // The premix is a fraction of the stoichiometric oxygen demand, so an emitter blended to the
    // mixture sits at an equivalence ratio of exactly 1 / oxygenPremix: 0.85 is a near-clean
    // premixed flame, 0.04 is the heavily sooting flamethrower. That single ratio deciding between
    // them is Figure 10, and it could not do it while the voxel was full of air regardless.
    //
    // The total need not come to atmospheric. `sourceAmount` is the density of the delivered gas
    // relative to still air, and a value above one is the over-filling the 2023 talk singles out
    // as the thing artists kept asking for — the expansion step resolves it over the steps after.
    const supplied = mix(vec4(fuel, chem.y, nitrogen, chem.w), u.sourceMix, stamp).toVar();

    // The charge stays additive. It is an amount injected whole rather than a flow, which is the
    // §4.4 explosion case: stamp a large quantity into a volume at once and let expansion sort out
    // the pressure afterwards. Blending it in would cap it at the mixture and lose the over-fill.
    supplied.addAssign(u.detonationMix.mul(u.sourceImpulse).mul(mask));

    fuel.assign(supplied.x);
    const oxygen = supplied.y.toVar();
    nitrogen.assign(supplied.z);
    const product = supplied.w.toVar();

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

    // ---- displacement volumes ------------------------------------------------------------
    // A cell inside a solid is not fluid, so it is reset to still air rather than left to
    // accumulate. The velocity boundary keeps flow from entering, but advection and diffusion
    // are not boundary-aware and would otherwise let heat and soot seep in and glow there.
    // Doing it here, in the pass that already holds all three buffers, costs no extra pass.
    const chemOut = vec4(fuel, oxygen, nitrogen, product).toVar();
    const auxOut = vec4(soot, temperature, aux.z, aux.w).toVar();
    const velOut = vec4(newVel, 0.0).toVar();

    if (obstacles > 0) {
      const buried = solid.inside(c);
      chemOut.assign(buried.select(vec4(0.0, 0.21, 0.79, 0.0), chemOut));
      auxOut.assign(
        buried.select(vec4(0.0, u.ambientTemperature, 0.0, u.dx.mul(5.0)), auxOut),
      );
      velOut.assign(buried.select(vec4(solid.velocity(c), 0.0), velOut));
    }

    textureStore(f.chem.write, c, chemOut).toWriteOnly();
    textureStore(f.aux.write, c, auxOut).toWriteOnly();
    textureStore(f.vel.write, c, velOut).toWriteOnly();
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
