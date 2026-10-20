import assert from 'node:assert/strict';
import { test } from 'node:test';
import { World } from 'three-avbd';
import { B_INITIAL_POS, BODY_FLOATS } from '../vendor/three-avbd/src/avbd3d/gpu/layout.ts';
import { Destruction, presets } from '../src/lib/index.ts';
import { asWorld, FakeWorld } from './fake-world.ts';

// A GPU device that takes every call and does nothing (buffers map to zeros): enough to run the
// World's bookkeeping (body slots, the queues) without a GPU.
Object.assign(globalThis, {
  GPUBufferUsage: { MAP_READ: 1, MAP_WRITE: 2, COPY_SRC: 4, COPY_DST: 8, INDEX: 16, VERTEX: 32, UNIFORM: 64, STORAGE: 128, INDIRECT: 256, QUERY_RESOLVE: 512 },
  GPUShaderStage: { VERTEX: 1, FRAGMENT: 2, COMPUTE: 4 },
  GPUMapMode: { READ: 1, WRITE: 2 },
});

function idleDevice(writes: Array<{ label: string; offset: number; data: ArrayBufferView | ArrayBuffer }> = []): GPUDevice {
  const anything: unknown = new Proxy(() => anything, { get: (_, k) => (k === 'then' ? undefined : anything), apply: () => anything });
  const buffer = (d: { size: number; label?: string }) => ({ size: d.size, label: d.label ?? '', destroy() {}, unmap() {}, mapAsync: async () => {}, getMappedRange: () => new ArrayBuffer(d.size) });
  const limits = { maxStorageBuffersPerShaderStage: 10, maxStorageBufferBindingSize: 2 ** 30, maxBufferSize: 2 ** 30 };
  const queue = {
    writeBuffer(b: { label: string }, offset: number, data: ArrayBufferView | ArrayBuffer) {
      writes.push({ label: b.label, offset, data });
    },
    submit() {},
    onSubmittedWorkDone: async () => {},
  };
  return new Proxy({}, { get: (_, k) => (k === 'limits' ? limits : k === 'features' ? new Set() : k === 'queue' ? queue : k === 'createBuffer' ? buffer : anything) }) as GPUDevice;
}

const box = (world: World, x: number) => world.addBox({ size: [1, 1, 1], position: [x, 5, 0] });

test("a removed body's slot waits a step, parked, before a new body takes it (but in a full world)", async () => {
  const world = await World.create({ device: idleDevice(), maxBodies: 4 });
  const [a, b] = [box(world, 0)!, box(world, 3)!];
  world.step();
  b.remove();
  // Taken at once, the new body started with what the old one left there: last step's contacts of
  // that slot (their forces, penalties and static-friction anchors), and it read as still touching
  const early = box(world, 6)!;
  assert.notEqual(early.index, b.index, 'not before a step');
  world.step();
  const later = box(world, 9)!;
  assert.equal(later.index, b.index, 'after one');
  // Full: a slot freed since the last step is taken at once
  box(world, 12);
  a.remove();
  const last = box(world, 15)!;
  assert.equal(last.index, a.index, 'a full world takes a parked slot');
  assert.equal(box(world, 18), null, 'and then it is full');
  world.step();
  await world.read();
  assert.deepEqual(world.bodies.map((x) => x.index).sort(), [0, 1, 2, 3]);
  world.destroy();
});

test('a body removed before it reached the solver keeps its slot until the flush has placed it', async () => {
  const world = await World.create({ device: idleDevice(), maxBodies: 8 });
  box(world, 0);
  const queued = box(world, 3)!;
  queued.remove();
  // Given the queued body's slot, two bodies were queued for it and every handle after was off by one
  const next = box(world, 6)!;
  assert.notEqual(next.index, queued.index);
  assert.doesNotThrow(() => world.step(), 'slots in step with the solver');
  assert.equal(box(world, 9)!.index, queued.index, 'free after the step');
  world.destroy();
});

test('pieces and props roll on the rolling resistance asked (default 0.02)', () => {
  // (A fake world's hull is a box: addHull goes through addBox)
  const rolled = (rolling?: number) => {
    const world = new FakeWorld();
    const made: number[] = [];
    const addBox = world.addBox.bind(world);
    world.addBox = (o, hull) => (made.push((o as { rolling?: number }).rolling ?? NaN), addBox(o, hull));
    const d = new Destruction({ world: asWorld(world), frameBudget: Infinity, rolling, materials: { stone: presets.concrete(), drum: presets.metal() } });
    d.addBox({ material: 'stone', size: [1, 1, 1], position: [0, 0.5, 0] });
    d.addConvex({ material: 'drum', points: [[0, 0, 0], [1, 0, 0], [0, 1, 0], [0, 0, 1], [1, 1, 1]], position: [3, 0, 0] });
    return made;
  };
  assert.deepEqual(rolled(), [0.02, 0.02]);
  assert.deepEqual(rolled(0.05), [0.05, 0.05]);
  assert.deepEqual(rolled(0), [0, 0]);
});

test("a body's rolling resistance goes to the solver with it, and the solver's step limits with the world's", async () => {
  const writes: Array<{ label: string; offset: number; data: ArrayBufferView | ArrayBuffer }> = [];
  const world = await World.create({ device: idleDevice(writes), maxBodies: 4 });
  world.maxSpeed = 25;
  world.addBox({ size: [1, 1, 1], position: [0, 5, 0], rolling: 0.04 });
  world.addBox({ size: [1, 1, 1], position: [3, 5, 0] });
  world.step();
  const words = (data: ArrayBufferView | ArrayBuffer) => (data instanceof ArrayBuffer ? new Float32Array(data) : new Float32Array(data.buffer, data.byteOffset, data.byteLength / 4));
  const last = (label: string) => words(writes.filter((w) => w.label === label).reverse()[0].data);
  // The bodies go up as appended, in one write from slot 0
  const bodies = last('bodies 3d');
  assert.ok(Math.abs(bodies[B_INITIAL_POS + 3] - 0.04) < 1e-7, `rolling ${bodies[B_INITIAL_POS + 3]}`);
  assert.equal(bodies[BODY_FLOATS + B_INITIAL_POS + 3], 0, 'none unless asked');
  // Params: the most speed (limits.x), and slip friction, push-out, speculation and seams on by default
  const params = last('params 3d');
  const flags = () => new Uint32Array(last('params 3d').buffer, last('params 3d').byteOffset)[6];
  assert.equal(params[48], 25);
  for (const flag of [128, 256, 512, 1024]) assert.ok(flags() & flag, `flag ${flag}`);
  const p = world.solver.params;
  p.slipFriction = p.pushOut = p.speculative = p.seams = false;
  world.step();
  assert.equal(flags() & (128 | 256 | 512 | 1024), 0, 'each can be switched off (the reference has none)');
  world.destroy();
});
