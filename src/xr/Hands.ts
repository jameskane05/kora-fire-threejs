/**
 * Tracked hands, drawn as glass rather than as skin.
 *
 * The joint data comes from WebXR's `hand-tracking` feature and the rigged mesh is the reference
 * hand from `@webxr-input-profiles/assets`, which three's XRHandModelFactory already knows how to
 * drive — twenty-five joints per hand, posed onto the glTF skeleton every frame. It is vendored
 * into `public/` rather than pulled from the CDN three defaults to, so a headset on a local
 * network can load it.
 *
 * The asset ships with an opaque skin material, which is wrong here twice over: the scene has no
 * lights, so a lit material renders black, and solid hands in front of a volumetric fire hide the
 * thing you are looking at. It is replaced with an unlit fresnel shell — nearly invisible face-on,
 * bright along grazing edges — so the hands read as an outline you can see the fire through.
 */
import {
  Group,
  MeshBasicNodeMaterial,
  NormalBlending,
  Vector3,
  type Object3D,
  type Renderer,
  type SkinnedMesh,
} from 'three/webgpu';
import {
  abs,
  color,
  dot,
  float,
  mix,
  normalView,
  oneMinus,
  positionViewDirection,
  positionWorld,
  pow,
  smoothstep,
  uniform,
} from 'three/tsl';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { XRHandModelFactory } from 'three/addons/webxr/XRHandModelFactory.js';

/* eslint-disable @typescript-eslint/no-explicit-any */
type N = any;

const HAND_ASSET_PATH = 'hands/';

/** Opacity where the surface faces you, which is what you see through. */
const CORE_ALPHA = 0.05;

/** Extra opacity at the silhouette. Together with CORE_ALPHA this is the peak. */
const RIM_ALPHA = 0.8;

/** Tightness of the falloff to the silhouette; higher confines the glow to the very edge. */
const RIM_POWER = 2.5;

/** Cool against the fire's orange, so a hand in front of a flame stays legible. */
const CORE_COLOR = 0x2a3f55;
const RIM_COLOR = 0xbfe4ff;

/**
 * Distance from the wrist joint over which the model's cut-off end is faded out, in metres.
 * The nearest vertex to that joint sits about 18 mm away and the fingertips about 190 mm, so
 * this dissolves the open end and the base of the palm while leaving the fingers untouched.
 */
const WRIST_FADE = { start: 0.02, end: 0.1 };

interface Hand {
  group: Group;
  /** Uniform node carrying the tracked wrist position, shared with the hand's material. */
  wrist: { value: Vector3 };
}

/**
 * An unlit shell whose opacity tracks the viewing angle.
 *
 * The wrist fade is driven by world-space distance from the tracked wrist joint rather than
 * anything in the mesh, because the geometry is skinned: its bind-pose coordinates no longer say
 * where a vertex has ended up. The joint position is known every frame anyway, so this costs one
 * uniform and removes the hard ring where the model stops.
 */
function createHandMaterial(wrist: N): MeshBasicNodeMaterial {
  const material = new MeshBasicNodeMaterial();

  const facing: N = abs(dot(normalView, positionViewDirection));
  const rim: N = pow(oneMinus(facing), RIM_POWER);
  const stump: N = smoothstep(
    float(WRIST_FADE.start),
    float(WRIST_FADE.end),
    positionWorld.sub(wrist).length(),
  );

  material.colorNode = mix(color(CORE_COLOR), color(RIM_COLOR), rim);
  material.opacityNode = rim.mul(RIM_ALPHA).add(CORE_ALPHA).mul(stump);

  material.transparent = true;
  material.blending = NormalBlending;
  // Hands sit between the viewer and the volume and are themselves transparent, so writing depth
  // would punch a hole in the fire behind them.
  material.depthWrite = false;
  material.toneMapped = false;

  return material;
}

/**
 * Puts the shell material on every skinned mesh in a loaded hand.
 *
 * Neither the hands nor the volume write depth, so which is in front is decided by draw order
 * alone. The volume renders at 10; the hands go after it, which means you can always see where
 * your hands are even when they are inside the fire. Since the shell is mostly transparent the
 * flame still shows through, so this reads as the hand being lit from within rather than as it
 * floating in front of something it should be inside.
 */
function dressHand(object: Object3D, wrist: N): void {
  object.traverse((child) => {
    const mesh = child as SkinnedMesh;
    if (!mesh.isSkinnedMesh) return;

    mesh.material = createHandMaterial(wrist);
    mesh.renderOrder = 20;
    mesh.frustumCulled = false;
  });
}

export class Hands {
  private readonly hands: Hand[] = [];

  constructor(renderer: Renderer, parent: Object3D) {
    const loader = new GLTFLoader().setPath(HAND_ASSET_PATH);

    for (const index of [0, 1]) {
      const wrist = uniform(new Vector3());

      // One factory per hand so the load callback knows whose wrist to bind. The two hands are
      // separate files, so nothing is fetched twice by splitting them up.
      const factory = new XRHandModelFactory(loader, (object: Object3D) => dressHand(object, wrist));
      factory.setPath(HAND_ASSET_PATH);

      const group = renderer.xr.getHand(index) as Group;
      group.add(factory.createHandModel(group, 'mesh'));
      parent.add(group);

      this.hands.push({ group, wrist });
    }
  }

  /** Called once per XR frame. three has already posed the joints by the time this runs. */
  update(): void {
    for (const hand of this.hands) {
      const joint = (hand.group as unknown as { joints?: Record<string, Object3D> }).joints?.wrist;
      if (joint) joint.getWorldPosition(hand.wrist.value);
    }
  }
}

/**
 * Drops a hand into an ordinary scene, in its rest pose, wearing the same material.
 *
 * Everything else here needs a headset to see, which makes the shader the one part of this that
 * is otherwise impossible to iterate on. This renders it on a desktop instead.
 */
export async function previewHand(
  parent: Object3D,
  handedness: 'left' | 'right' = 'right',
  at = new Vector3(),
): Promise<Object3D> {
  const loader = new GLTFLoader().setPath(HAND_ASSET_PATH);
  const gltf = await loader.loadAsync(`${handedness}.glb`);
  const object = gltf.scene.children[0];

  const wrist = uniform(new Vector3());
  dressHand(object, wrist);

  object.position.copy(at);
  parent.add(object);

  // Read the wrist off the skeleton rather than assuming it sits at the model's origin, which is
  // also what the tracked path does — the joint it uses is this same bone, posed by the headset.
  object.updateMatrixWorld(true);
  object.getObjectByName('wrist')?.getWorldPosition(wrist.value);

  return object;
}
