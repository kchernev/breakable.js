// A blast's push on the loose pieces near it, on the GPU where their poses are (the CPU only
// knows them a readback late): each moving body within the radius is thrown outward and a little
// up, harder near the centre and for lighter pieces, and set spinning. Fixed bodies are left be
// (the CPU decides what of the structure comes loose).

import type { World } from 'three-avbd';
import { B_ANGVEL, B_POS, B_SIZE, B_VEL, BODY_FLOATS } from 'three-avbd/advanced';

const wgsl = /* wgsl */ `
struct Blast { centre: vec4f, push: vec4f, limit: vec4f }  // centre xyz, radius; push: outward m/s, lift m/s, spin rad/s, body count; limit: most speed (m/s)
@group(0) @binding(0) var<uniform> blast: Blast;
@group(0) @binding(1) var<storage, read_write> bodies: array<vec4f>;

fn hash(n: u32) -> f32 {
  var x = n * 747796405u + 2891336453u;
  x = ((x >> ((x >> 28u) + 4u)) ^ x) * 277803737u;
  return f32((x >> 22u) ^ x) / 4294967295.0;
}

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) gid: vec3u) {
  let i = gid.x;
  if (i >= u32(blast.push.w)) { return; }
  let base = i * ${BODY_FLOATS / 4}u;
  let mass = bodies[base + ${B_SIZE / 4}u].w;
  if (mass <= 0.0) { return; }
  let d = bodies[base + ${B_POS / 4}u].xyz - blast.centre.xyz;
  let dist = length(d);
  if (dist > blast.centre.w) { return; }
  // Falls off with distance; lighter pieces fly further
  let f = (1.0 - dist / blast.centre.w) / pow(max(mass, 0.05), 0.33);
  let dir = normalize(d + vec3f(0.0, 0.15 * blast.centre.w, 0.0) + vec3f(1e-4));
  // Raised to the blast's throw along it, not added: debris already flying faster keeps its speed
  var v = bodies[base + ${B_VEL / 4}u];
  let kick = (dir * blast.push.x + vec3f(0.0, blast.push.y, 0.0)) * f;
  let speed = length(kick);
  let along = kick / max(speed, 1e-6);
  v = vec4f(v.xyz + along * max(0.0, speed - dot(v.xyz, along)), v.w);
  // No faster than the most speed
  let fast = length(v.xyz);
  if (fast > blast.limit.x) { v = vec4f(v.xyz * (blast.limit.x / fast), v.w); }
  bodies[base + ${B_VEL / 4}u] = v;
  let spin = vec3f(hash(i * 3u), hash(i * 3u + 1u), hash(i * 3u + 2u)) - 0.5;
  let w = bodies[base + ${B_ANGVEL / 4}u];
  bodies[base + ${B_ANGVEL / 4}u] = vec4f(w.xyz + spin * blast.push.z * f, w.w);
}
`;

export class BlastPass {
  private readonly device: GPUDevice;
  private readonly world: World;
  private readonly pipeline: GPUComputePipeline;
  private readonly uniforms: GPUBuffer;
  private group: GPUBindGroup | null = null;
  private bound: GPUBuffer | null = null;

  constructor(world: World) {
    this.world = world;
    this.device = world.device;
    this.pipeline = this.device.createComputePipeline({
      label: 'blast',
      layout: 'auto',
      compute: { module: this.device.createShaderModule({ label: 'blast', code: wgsl }), entryPoint: 'main' },
    });
    this.uniforms = this.device.createBuffer({ label: 'blast uniforms', size: 48, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
  }

  /** Push the loose bodies within `radius` of `at`: outward at up to `speed` m/s, `lift` up, `spin` rad/s, none past `maxSpeed` m/s. */
  run(at: ArrayLike<number>, radius: number, speed: number, lift: number, spin: number, maxSpeed = Infinity): void {
    const count = this.world.solver.bodyCount;
    if (!count) return;
    const buffer = this.world.solver.bodyBuffer;
    if (buffer !== this.bound) {
      this.bound = buffer;
      this.group = this.device.createBindGroup({
        layout: this.pipeline.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: { buffer: this.uniforms } },
          { binding: 1, resource: { buffer } },
        ],
      });
    }
    this.device.queue.writeBuffer(this.uniforms, 0, new Float32Array([at[0], at[1], at[2], radius, speed, lift, spin, count, Math.min(maxSpeed, 3e38), 0, 0, 0]));
    const encoder = this.device.createCommandEncoder({ label: 'blast' });
    const pass = encoder.beginComputePass({ label: 'blast' });
    pass.setPipeline(this.pipeline);
    pass.setBindGroup(0, this.group!);
    pass.dispatchWorkgroups(Math.ceil(count / 64));
    pass.end();
    this.device.queue.submit([encoder.finish()]);
  }

  destroy(): void {
    this.uniforms.destroy();
  }
}
