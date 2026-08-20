import * as THREE from 'three';
import { MeshStandardNodeMaterial, StorageBufferAttribute } from 'three/webgpu';
import { transformNormalToView, varying, vertexIndex } from 'three/tsl';
import { storage, wgslFn, workgroupId, localId } from '../physics/gpu/tslCompat';
import { PhysicsEngine } from '../physics/PhysicsEngine';

const WORKGROUP_SIZE = 64;

/**
 * A knot on the rope centreline. With `bodyB` set the knot sits at the midpoint of the two
 * anchors, which is what hides residual joint separation: a chain joint the solver has left
 * slightly open averages out instead of showing as a kink.
 */
export type RopeKnot = {
  bodyA: number;
  offsetA: [number, number, number];
  bodyB?: number;
  offsetB?: [number, number, number];
};

export type TrackedRopeTube = {
  syncVisuals: (engine: PhysicsEngine, renderer?: any) => void;
  dispose: () => void;
};

function wgslFloat(value: number): string {
  return Number.isInteger(value) ? `${value}.0` : `${value}`;
}

export function createTrackedRopeTube(
  scene: THREE.Object3D,
  physics: PhysicsEngine,
  options: {
    knots: RopeKnot[];
    radius: number;
    color: number;
    radialSegments?: number;
    segmentsPerSpan?: number;
    strands?: number;
    layDepth?: number;
    layTurnsPerSpan?: number;
    capStart?: boolean;
    capEnd?: boolean;
    roughness?: number;
    metalness?: number;
  },
): TrackedRopeTube {
  const knots = options.knots;
  const knotCount = knots.length;
  if (knotCount < 2) throw new Error('Rope tube needs at least two knots');

  const radialSegments = Math.max(3, options.radialSegments ?? 10);
  const segmentsPerSpan = Math.max(1, options.segmentsPerSpan ?? 6);
  const strands = options.strands ?? 3;
  const layDepth = options.layDepth ?? 0.17;
  const layTurnsPerSpan = options.layTurnsPerSpan ?? 0.5;
  const capStart = options.capStart ?? true;
  const capEnd = options.capEnd ?? true;
  const capSpan = 0.6;

  const spanCount = knotCount - 1;
  const ringCount = spanCount * segmentsPerSpan + 1;
  const vertexCount = ringCount * radialSegments;

  const indices: number[] = [];
  for (let ring = 0; ring < ringCount - 1; ring++) {
    for (let k = 0; k < radialSegments; k++) {
      const kNext = (k + 1) % radialSegments;
      const a = ring * radialSegments + k;
      const b = ring * radialSegments + kNext;
      const c = (ring + 1) * radialSegments + k;
      const d = (ring + 1) * radialSegments + kNext;
      indices.push(a, b, d);
      indices.push(a, d, c);
    }
  }

  const knotSpecData = new Float32Array(knotCount * 8);
  for (let i = 0; i < knotCount; i++) {
    const knot = knots[i]!;
    knotSpecData[i * 8 + 0] = knot.bodyA;
    knotSpecData[i * 8 + 1] = knot.offsetA[0];
    knotSpecData[i * 8 + 2] = knot.offsetA[1];
    knotSpecData[i * 8 + 3] = knot.offsetA[2];
    knotSpecData[i * 8 + 4] = knot.bodyB ?? -1;
    knotSpecData[i * 8 + 5] = knot.offsetB?.[0] ?? 0;
    knotSpecData[i * 8 + 6] = knot.offsetB?.[1] ?? 0;
    knotSpecData[i * 8 + 7] = knot.offsetB?.[2] ?? 0;
  }

  const knotSpecAttr = new StorageBufferAttribute(knotSpecData, 4);
  const knotPosAttr = new StorageBufferAttribute(new Float32Array(knotCount * 4), 4);
  const knotFrameAttr = new StorageBufferAttribute(new Float32Array(knotCount * 4), 4);
  const positionAttr = new StorageBufferAttribute(new Float32Array(vertexCount * 4), 4);
  const normalAttr = new StorageBufferAttribute(new Float32Array(vertexCount * 4), 4);

  // Placeholder attribute purely so the draw knows its vertex count; both position and normal
  // are overridden below with the compute output, indexed by vertex id.
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(vertexCount * 3), 3));
  geometry.setIndex(indices);
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e4);

  const material = new MeshStandardNodeMaterial();
  material.color.setHex(options.color);
  material.roughness = options.roughness ?? 0.85;
  material.metalness = options.metalness ?? 0.0;

  const positionStore = storage(positionAttr, 'vec4', vertexCount).toReadOnly();
  const normalStore = storage(normalAttr, 'vec4', vertexCount).toReadOnly();
  material.positionNode = positionStore.element(vertexIndex).xyz;
  material.normalNode = varying(
    transformNormalToView(normalStore.element(vertexIndex).xyz).normalize(),
    'vRopeTubeNormalView',
  );

  const mesh = new THREE.Mesh(geometry, material);
  mesh.frustumCulled = false;
  mesh.visible = false;
  scene.add(mesh);

  let knotKernel: any = null;
  let frameKernel: any = null;
  let tubeKernel: any = null;

  const buildKernels = (engine: PhysicsEngine): boolean => {
    const renderBuffers = engine.getRenderBuffers();
    if (!renderBuffers) return false;

    const knotShader = wgslFn(/* wgsl */`
      fn compute(
        positions: ptr<storage, array<vec4f>, read>,
        quaternions: ptr<storage, array<vec4f>, read>,
        knotSpecs: ptr<storage, array<vec4f>, read>,
        outKnotPos: ptr<storage, array<vec4f>, read_write>,
        workgroupId: vec3u,
        localId: vec3u,
      ) -> void {
        let gid = workgroupId.x * ${WORKGROUP_SIZE}u + localId.x;
        if (gid >= ${knotCount}u) { return; }

        let specA = knotSpecs[gid * 2u];
        let specB = knotSpecs[gid * 2u + 1u];

        let ia = u32(specA.x);
        let qa = quaternions[ia];
        let ta = cross(qa.xyz, specA.yzw) * 2.0;
        var point = positions[ia].xyz + specA.yzw + ta * qa.w + cross(qa.xyz, ta);

        if (specB.x >= 0.0) {
          let ib = u32(specB.x);
          let qb = quaternions[ib];
          let tb = cross(qb.xyz, specB.yzw) * 2.0;
          let pointB = positions[ib].xyz + specB.yzw + tb * qb.w + cross(qb.xyz, tb);
          point = (point + pointB) * 0.5;
        }

        outKnotPos[gid] = vec4f(point, 0.0);
      }
    `);

    knotKernel = knotShader({
      positions: storage(renderBuffers.positions, 'vec4f', physics.config.maxBodies).toReadOnly(),
      quaternions: storage(renderBuffers.quaternions, 'vec4f', physics.config.maxBodies).toReadOnly(),
      knotSpecs: storage(knotSpecAttr, 'vec4f', knotCount * 2).toReadOnly(),
      outKnotPos: storage(knotPosAttr, 'vec4f', knotCount),
      workgroupId,
      localId,
    }).computeKernel([WORKGROUP_SIZE, 1, 1]).setName('Rope Knot Resolve');

    // Roll cannot come from the links: a spherical joint is a point constraint, so each link's
    // spin about its own axis is unconstrained and wanders on solver noise, which crawls the
    // strand lay along a rope that is otherwise sitting still. Instead the frame is transported
    // along the centreline by double reflection (Wang et al.'s rotation-minimizing frame), seeded
    // from the first tangent. That makes roll a pure function of the current shape, so a rope at
    // rest has a dead-still surface, and unlike a Frenet frame it cannot flip at an inflection.
    // It is serial in the knot index, hence the single thread — a few dozen iterations.
    const frameShader = wgslFn(/* wgsl */`
      fn compute(
        knotPos: ptr<storage, array<vec4f>, read>,
        outKnotFrame: ptr<storage, array<vec4f>, read_write>,
        workgroupId: vec3u,
        localId: vec3u,
      ) -> void {
        if (workgroupId.x != 0u || localId.x != 0u) { return; }

        let count = ${knotCount}u;
        var tangentPrev = normalize(knotPos[1u].xyz - knotPos[0u].xyz);
        let seedAxis = select(vec3f(0.0, 1.0, 0.0), vec3f(1.0, 0.0, 0.0), abs(tangentPrev.y) > 0.9);
        var framePrev = normalize(seedAxis - tangentPrev * dot(seedAxis, tangentPrev));
        outKnotFrame[0u] = vec4f(framePrev, 0.0);

        for (var i = 1u; i < count; i = i + 1u) {
          let pointPrev = knotPos[i - 1u].xyz;
          let pointCur = knotPos[i].xyz;
          let ahead = min(i + 1u, count - 1u);
          let behind = select(i - 1u, i, ahead == i);

          var tangentCur = knotPos[ahead].xyz - knotPos[behind].xyz;
          let tangentLength = length(tangentCur);
          tangentCur = select(tangentPrev, tangentCur / max(tangentLength, 1e-9), tangentLength > 1e-9);

          var frameCur = framePrev;
          let v1 = pointCur - pointPrev;
          let c1 = dot(v1, v1);
          if (c1 > 1e-12) {
            let reflectedFrame = framePrev - v1 * (2.0 / c1 * dot(v1, framePrev));
            let reflectedTangent = tangentPrev - v1 * (2.0 / c1 * dot(v1, tangentPrev));
            let v2 = tangentCur - reflectedTangent;
            let c2 = dot(v2, v2);
            frameCur = select(
              reflectedFrame,
              reflectedFrame - v2 * (2.0 / c2 * dot(v2, reflectedFrame)),
              c2 > 1e-12,
            );
          }

          frameCur = frameCur - tangentCur * dot(frameCur, tangentCur);
          let frameLength = length(frameCur);
          let fallbackAxis = select(vec3f(0.0, 1.0, 0.0), vec3f(1.0, 0.0, 0.0), abs(tangentCur.y) > 0.9);
          let fallback = normalize(fallbackAxis - tangentCur * dot(fallbackAxis, tangentCur));
          frameCur = select(fallback, frameCur / max(frameLength, 1e-9), frameLength > 1e-6);

          outKnotFrame[i] = vec4f(frameCur, 0.0);
          framePrev = frameCur;
          tangentPrev = tangentCur;
        }
      }
    `);

    frameKernel = frameShader({
      knotPos: storage(knotPosAttr, 'vec4f', knotCount).toReadOnly(),
      outKnotFrame: storage(knotFrameAttr, 'vec4f', knotCount),
      workgroupId,
      localId,
    }).computeKernel([1, 1, 1]).setName('Rope Frame Transport');

    const capStartExpr = capStart ? 'capDistance = min(capDistance, distanceFromStart);' : '';
    const capEndExpr = capEnd ? 'capDistance = min(capDistance, distanceFromEnd);' : '';

    // Surface is P(theta, s) = C(s) + r(theta, s) * R, with r modulated by the strand lay. The
    // normal is the exact cross product of the two partials for that form, ignoring frame torsion:
    //   n = |C'| * (r*R - dr/dtheta * Q) - r * dr/ds * T
    const tubeShader = wgslFn(/* wgsl */`
      fn compute(
        knotPos: ptr<storage, array<vec4f>, read>,
        knotFrame: ptr<storage, array<vec4f>, read>,
        outPosition: ptr<storage, array<vec4f>, read_write>,
        outNormal: ptr<storage, array<vec4f>, read_write>,
        workgroupId: vec3u,
        localId: vec3u,
      ) -> void {
        let gid = workgroupId.x * ${WORKGROUP_SIZE}u + localId.x;
        if (gid >= ${vertexCount}u) { return; }

        let ring = gid / ${radialSegments}u;
        let slot = gid % ${radialSegments}u;

        let maxSpan = ${wgslFloat(spanCount)};
        let s = f32(ring) / ${wgslFloat(segmentsPerSpan)};
        let baseSpan = clamp(floor(s), 0.0, maxSpan - 1.0);
        let t = s - baseSpan;

        let i1 = u32(baseSpan);
        let i2 = i1 + 1u;
        let i0 = u32(max(i32(i1) - 1, 0));
        let i3 = min(i2 + 1u, ${knotCount - 1}u);

        let p0 = knotPos[i0].xyz;
        let p1 = knotPos[i1].xyz;
        let p2 = knotPos[i2].xyz;
        let p3 = knotPos[i3].xyz;

        let c0 = p1 * 2.0;
        let c1 = p2 - p0;
        let c2 = p0 * 2.0 - p1 * 5.0 + p2 * 4.0 - p3;
        let c3 = p1 * 3.0 - p0 - p2 * 3.0 + p3;
        let centre = (c0 + c1 * t + c2 * (t * t) + c3 * (t * t * t)) * 0.5;
        let derivative = (c1 + c2 * (2.0 * t) + c3 * (3.0 * t * t)) * 0.5;

        let speed = max(length(derivative), 1e-6);
        let tangent = derivative / speed;

        let rolled = mix(knotFrame[i1].xyz, knotFrame[i2].xyz, t);
        var axisU = rolled - tangent * dot(rolled, tangent);
        if (length(axisU) < 1e-4) {
          let fallback = select(vec3f(1.0, 0.0, 0.0), vec3f(0.0, 0.0, 1.0), abs(tangent.x) > 0.9);
          axisU = fallback - tangent * dot(fallback, tangent);
        }
        axisU = normalize(axisU);
        let axisV = cross(tangent, axisU);

        let theta = f32(slot) * ${wgslFloat((Math.PI * 2.0) / radialSegments)};
        let radial = axisU * cos(theta) + axisV * sin(theta);
        let tangential = axisU * -sin(theta) + axisV * cos(theta);

        let distanceFromStart = s;
        let distanceFromEnd = maxSpan - s;
        var capDistance = 1e9;
        ${capStartExpr}
        ${capEndExpr}
        let capU = clamp(capDistance / ${wgslFloat(capSpan)}, 0.0, 1.0);
        let cap = sqrt(max(1.0 - (1.0 - capU) * (1.0 - capU), 0.0));

        let layAmplitude = ${wgslFloat(layDepth)} * cap;
        let layTwist = ${wgslFloat(layTurnsPerSpan * Math.PI * 2.0)};
        let phase = ${wgslFloat(strands)} * theta + layTwist * s;
        let scaledRadius = ${wgslFloat(options.radius)} * cap;
        let r = scaledRadius * (1.0 + layAmplitude * cos(phase));
        let drdTheta = scaledRadius * layAmplitude * ${wgslFloat(strands)} * -sin(phase);
        let drdS = scaledRadius * layAmplitude * layTwist * -sin(phase);

        let position = centre + radial * r;

        let rawNormal = (radial * r - tangential * drdTheta) * speed - tangent * (r * drdS);
        let rawLength = length(rawNormal);
        let geometricNormal = select(radial, rawNormal / max(rawLength, 1e-9), rawLength > 1e-9);
        let axialSign = select(1.0, -1.0, distanceFromStart < distanceFromEnd);
        let towardTip = (1.0 - cap) * (1.0 - cap);
        let normal = normalize(mix(geometricNormal, tangent * axialSign, towardTip));

        outPosition[gid] = vec4f(position, 1.0);
        outNormal[gid] = vec4f(normal, 0.0);
      }
    `);

    tubeKernel = tubeShader({
      knotPos: storage(knotPosAttr, 'vec4f', knotCount).toReadOnly(),
      knotFrame: storage(knotFrameAttr, 'vec4f', knotCount).toReadOnly(),
      outPosition: storage(positionAttr, 'vec4f', vertexCount),
      outNormal: storage(normalAttr, 'vec4f', vertexCount),
      workgroupId,
      localId,
    }).computeKernel([WORKGROUP_SIZE, 1, 1]).setName('Rope Tube Build');

    return true;
  };

  return {
    syncVisuals(engine: PhysicsEngine, renderer?: any): void {
      if (!renderer) return;
      if (!tubeKernel && !buildKernels(engine)) return;

      renderer.compute(knotKernel, [Math.ceil(knotCount / WORKGROUP_SIZE), 1, 1]);
      renderer.compute(frameKernel, [1, 1, 1]);
      renderer.compute(tubeKernel, [Math.ceil(vertexCount / WORKGROUP_SIZE), 1, 1]);
      mesh.visible = true;
    },

    dispose(): void {
      scene.remove(mesh);
      mesh.removeFromParent();
      geometry.dispose();
      material.dispose();
    },
  };
}
