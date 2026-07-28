/**
 * A coarse sampler over the simulation fields, for inspecting the volume from the console.
 *
 * The GPU side is deliberately dull: one invocation per sampled voxel, each writing its channel
 * values straight into a storage buffer, which is the same shape as every other pass in the
 * solver. The reduction happens on the CPU after readback, where NaN and infinity are visible
 * rather than something that has to be smuggled out through a sentinel.
 *
 * An earlier version did the reduction on the GPU in a single invocation looping over the grid.
 * It was compact and it did not compile — worth remembering that a diagnostic which can fail in
 * the same ways as the thing it measures is worse than no diagnostic at all.
 *
 * Each texture is fetched once per voxel and the result handed to every channel; letting channels
 * fetch for themselves makes each fetch its own binding and walks past the sampled-texture limit.
 */
import { StorageBufferAttribute } from 'three/webgpu';
import type { Renderer, Storage3DTexture } from 'three/webgpu';
import { storage } from 'three/tsl';
import { T, load, type N, type GridOps } from './tsl';

const { Fn, int, ivec3, instanceIndex } = T;

/** The state of one voxel, already fetched. */
export interface ProbeSample {
  coord: N;
  chem: N;
  aux: N;
  vel: N;
  render: N;
  pressure: N;
  expansion: N;
}

export interface ProbeChannel {
  label: string;
  value(s: ProbeSample): N;
  /** Reduce with min instead of max, for quantities whose interesting extreme is the low one. */
  min?: boolean;
  /** Report the first sample rather than a reduction, for passing a uniform through unchanged. */
  constant?: boolean;
}

export interface ProbeTextures {
  chem: Storage3DTexture;
  aux: Storage3DTexture;
  vel: Storage3DTexture;
  render: Storage3DTexture;
  pressure: Storage3DTexture;
  expansion: Storage3DTexture;
}

export interface ProbeStats {
  value: number;
  /** Counts across the sampled voxels, so a field that is partly poisoned still reads as such. */
  nan: number;
  infinite: number;
  samples: number;
}

export class FieldProbe {
  private readonly buffer: StorageBufferAttribute;
  private readonly node: N;
  private readonly channels: ProbeChannel[];
  private readonly samples: number;

  constructor(
    private readonly renderer: Renderer,
    g: GridOps,
    textures: ProbeTextures,
    channels: ProbeChannel[],
    stride = 4,
  ) {
    this.channels = channels;

    const dims = g.res.map((n) => Math.ceil(n / stride));
    this.samples = dims[0] * dims[1] * dims[2];

    const width = channels.length;
    this.buffer = new StorageBufferAttribute(new Float32Array(this.samples * width), 1);
    const out = storage(this.buffer, 'float', this.samples * width);

    this.node = Fn(() => {
      const idx = int(instanceIndex);
      const coord = ivec3(
        idx.mod(dims[0]).mul(stride),
        idx.div(dims[0]).mod(dims[1]).mul(stride),
        idx.div(dims[0] * dims[1]).mul(stride),
      );

      const s: ProbeSample = {
        coord,
        chem: load(textures.chem, coord),
        aux: load(textures.aux, coord),
        vel: load(textures.vel, coord),
        render: load(textures.render, coord),
        pressure: load(textures.pressure, coord),
        expansion: load(textures.expansion, coord),
      };

      const base = idx.mul(width);
      channels.forEach((channel, i) => {
        out.element(base.add(int(i))).assign(channel.value(s));
      });
    })().compute(this.samples);
  }

  async read(): Promise<Record<string, ProbeStats>> {
    this.renderer.compute([this.node]);
    const values = new Float32Array(await this.renderer.getArrayBufferAsync(this.buffer));

    const width = this.channels.length;
    const result: Record<string, ProbeStats> = {};

    this.channels.forEach((channel, i) => {
      let best = channel.min ? Infinity : -Infinity;
      let nan = 0;
      let infinite = 0;

      for (let n = 0; n < this.samples; n++) {
        const v = values[n * width + i];
        if (Number.isNaN(v)) {
          nan++;
          continue;
        }
        if (!Number.isFinite(v)) infinite++;
        best = channel.min ? Math.min(best, v) : Math.max(best, v);
      }

      result[channel.label] = {
        value: channel.constant ? values[i] : best,
        nan,
        infinite,
        samples: this.samples,
      };
    });

    return result;
  }
}
