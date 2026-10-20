import assert from 'node:assert/strict';
import { GpuSolver3D } from '../src/avbd3d/gpu/solver.ts';
import { BODY_FLOATS, CONTACT_WORDS, K_RB } from '../src/avbd3d/gpu/layout.ts';
import { Rigid } from '../src/avbd3d/ref/body.ts';
import { Solver } from '../src/avbd3d/ref/solver.ts';
import { World } from '../src/lib/world.ts';
import { gpuTest } from './device.ts';

const fixture = (device: GPUDevice, z = 0.49, velocity = 0) => {
  const ref = new Solver();
  new Rigid(ref, [10, 10, 1], 0, 0.5, [0, 0, -0.5]);
  const body = new Rigid(ref, [1, 1, 1], 1, 0.5, [0, 0, z]);
  body.velocityLin[2] = velocity;
  const gpu = new GpuSolver3D(device, ref, { spatialSort: false, bodyCapacity: 8 });
  gpu.params.gravity = 0;
  gpu.params.iterations = 0;
  // Pairs as the broadphase finds them touching (speculation finds a moving body's pairs with fixed
  // ones ahead: the last test has it)
  gpu.params.speculative = false;
  return { ref, body, gpu };
};

async function firstSeparation(device: GPUDevice, gpu: GpuSolver3D): Promise<number> {
  const read = device.createBuffer({ size: CONTACT_WORDS * 4, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ });
  try {
    const encoder = device.createCommandEncoder();
    encoder.copyBufferToBuffer(gpu.contactStorage.contacts, 0, read, 0, CONTACT_WORDS * 4);
    device.queue.submit([encoder.finish()]);
    await read.mapAsync(GPUMapMode.READ);
    const c0 = new Float32Array(read.getMappedRange())[K_RB + 3]!;
    read.unmap();
    return c0;
  } finally { read.destroy(); }
}

gpuTest('reused manifolds refresh separation, and the first reuse request detects contacts', async device => {
  const { gpu } = fixture(device, 0.49, -0.6);
  try {
    gpu.step({ reuseManifolds: true });
    assert.equal((await gpu.readCounters()).contacts, 4);
    const before = await firstSeparation(device, gpu);
    const positions = await gpu.readBodies();
    const displacement = positions[BODY_FLOATS + 2]! - Math.fround(0.49);
    assert.ok(Math.abs(displacement) > 0.001);
    gpu.step({ reuseManifolds: true });
    assert.equal((await gpu.readCounters()).contacts, 4);
    const after = await firstSeparation(device, gpu);
    assert.ok(Math.abs(after - before - displacement) < 1e-6, `${before} -> ${after}, moved ${displacement}`);
  } finally { gpu.destroy(); }
});

gpuTest('body/filter/joint changes invalidate retained manifolds', async device => {
  const { ref, body, gpu } = fixture(device);
  try {
    gpu.step();
    assert.equal((await gpu.readCounters()).contacts, 4);
    gpu.setFilters([1], [0], [0]);
    gpu.step({ reuseManifolds: true });
    assert.equal((await gpu.readCounters()).contacts, 0);
    gpu.setFilters([1], [1], [0xffffffff]);
    gpu.step({ reuseManifolds: true });
    assert.equal((await gpu.readCounters()).contacts, 4);
    body.positionLin[2] = 5;
    gpu.rewriteBodies([1], [body]);
    gpu.step({ reuseManifolds: true });
    assert.equal((await gpu.readCounters()).contacts, 0);
    body.positionLin[2] = 0.49;
    gpu.rewriteBodies([1], [body]);
    const [slot] = gpu.appendJoints([{ a: 0, b: 1, rA: [0, 0, 0.5], rB: [0, 0, -0.5] }]);
    gpu.step({ reuseManifolds: true });
    assert.equal((await gpu.readCounters()).contacts, 0);
    gpu.releaseJoints([slot!]);
    gpu.rewriteBodies([0, 1], ref.bodies);
    gpu.step({ reuseManifolds: true });
    assert.equal((await gpu.readCounters()).contacts, 4);
  } finally { gpu.destroy(); }
});

gpuTest('empty reused sets stay empty until the next detecting step', async device => {
  const { gpu } = fixture(device, 0.7, -12);
  try {
    gpu.step();
    assert.equal((await gpu.readCounters()).contacts, 0);
    gpu.step({ reuseManifolds: true });
    assert.equal((await gpu.readCounters()).contacts, 0);
    gpu.step();
    assert.ok((await gpu.readCounters()).contacts > 0);
  } finally { gpu.destroy(); }
});

gpuTest('World opt-in substeps keep a resting stack supported', async device => {
  const run = async (reuse: boolean) => {
    const world = await World.create({ device, maxBodies: 16, dt: 1 / 120 });
    try {
      world.addBox({ size: [10, 1, 10], position: [0, -0.5, 0], fixed: true });
      const boxes = Array.from({ length: 5 }, (_, i) => world.addBox({ size: [1, 1, 1], position: [0, 0.5 + i, 0] })!);
      for (let i = 0; i < 120; i++) { world.step(); world.step({ reuseManifolds: reuse }); }
      await world.read();
      for (const box of boxes) assert.ok(box.position.every(Number.isFinite));
      assert.ok(boxes[0]!.position[1] > 0.45);
      assert.equal((await world.solver.readCounters()).overflow, 0);
      return boxes.map(b => [...b.position]);
    } finally { world.destroy(); }
  };
  const before = await run(false), after = await run(true);
  const delta = Math.max(...after.flatMap((p, i) => p.map((x, k) => Math.abs(x - before[i]![k]!))));
  assert.ok(delta < 0.1, `resting-stack deviation ${delta} m`);
});


gpuTest('reuse retains broadphase diagnostics from the last detecting step', async device => {
  const { gpu } = fixture(device, 0.49, 120);
  try {
    gpu.step();
    const pairs = await gpu.readPairs();
    assert.equal(pairs.length, 2);
    gpu.step({ reuseManifolds: true });
    assert.deepEqual(await gpu.readPairs(), pairs);
    assert.equal((await gpu.readCounters()).pairs, 1);
    gpu.step();
    assert.equal((await gpu.readCounters()).pairs, 0);
  } finally { gpu.destroy(); }
});

gpuTest('World queued kinematic moves force fresh detection during reuse', async device => {
  const world = await World.create({ device, maxBodies: 8, dt: 1 / 120 });
  try {
    const floor = world.addBox({ size: [10, 1, 10], position: [0, -0.5, 0], fixed: true })!;
    world.addBox({ size: [1, 1, 1], position: [0, 0.49, 0] });
    world.step();
    assert.ok((await world.solver.readCounters()).contacts > 0);
    floor.moveTo([0, -10, 0]);
    world.step({ reuseManifolds: true });
    // The move integrates after detection. The next queued move must detect at the new pose.
    floor.moveTo([0, -11, 0]);
    world.step({ reuseManifolds: true });
    assert.equal((await world.solver.readCounters()).contacts, 0);
  } finally { world.destroy(); }
});

gpuTest('reused hull contacts remain supported while rotating and slowing under friction', async device => {
  const world = await World.create({ device, maxBodies: 8, dt: 1 / 120 });
  try {
    assert.ok(world.hullsEnabled, 'exercise the hull collision path');
    world.addBox({ size: [20, 1, 20], position: [0, -0.5, 0], fixed: true, friction: 0.8 });
    const points = [-0.5, 0.5].flatMap(x => [-0.5, 0.5].flatMap(y => [-0.5, 0.5].flatMap(z => [x, y, z])));
    const body = world.addHull({ points, position: [0, 0.5, 0], velocity: [1, 0, 0], angularVelocity: [0, 0.5, 0], friction: 0.8 })!;
    for (let i = 0; i < 120; i++) { world.step(); world.step({ reuseManifolds: true }); }
    await world.read();
    assert.ok([...body.position, ...body.rotation, ...body.velocity, ...body.angularVelocity].every(Number.isFinite));
    assert.ok(body.position[1] > 0.45 && body.position[1] < 0.6, `height ${body.position[1]}`);
    assert.ok(Math.abs(body.velocity[0]) < 0.2, `friction slows translation: ${body.velocity[0]}`);
    assert.ok(Math.abs(body.angularVelocity[1]) < 0.2, `friction slows rotation: ${body.angularVelocity[1]}`);
    assert.equal((await world.solver.readCounters()).overflow, 0);
  } finally { world.destroy(); }
});

gpuTest('speculative contacts: a thin plate thrown at the ground at 30 m/s stops on it, its pair found before it touches', async device => {
  const world = await World.create({ device, maxBodies: 8 });
  try {
    world.addBox({ size: [20, 1, 20], position: [0, -0.5, 0], fixed: true, friction: 0.8 });
    // The lowest its centre gets in the first ten steps
    const lowest = async (x: number) => {
      const plate = world.addBox({ size: [0.3, 0.01, 0.3], position: [x, 0.4, 0], velocity: [0, -30, 0], density: 0.5 })!;
      let low = Infinity;
      for (let i = 0; i < 10; i++) {
        world.step();
        await world.read();
        low = Math.min(low, plate.position[1]);
      }
      return low;
    };
    // 0.4 m up and 0.5 m a step: its contact found while it's apart, it stops on the ground
    const caught = await lowest(0);
    assert.ok(caught > -0.02, `stopped on the ground: lowest ${caught}`);
    // Found only once it overlapped, it was 10 cm in (and pushed back out)
    world.solver.params.speculative = false;
    const late = await lowest(3);
    assert.ok(late < -0.05, `without, it went in: lowest ${late}`);
  } finally { world.destroy(); }
});

gpuTest('seams: a box slides over flush fixed tiles as far as friction takes it, without a hop', async device => {
  const world = await World.create({ device, maxBodies: 512 });
  try {
    world.maxSpeed = 40;
    for (let k = 0; k < 60; k++) world.addBox({ size: [0.5, 0.2, 2], position: [k * 0.5 + 0.25, -0.1, 0], fixed: true, friction: 0.4 });
    // From 10 m/s at friction 0.4: v²/(2μg) = 12.7 m
    const slide = async () => {
      const box = world.addBox({ size: [0.3, 0.1, 0.2], position: [0.6, 0.05, 0], density: 500, friction: 0.4, velocity: [10, 0, 0] })!;
      let hop = 0;
      for (let i = 0; i < 240; i++) {
        world.step();
        if (i % 4 === 3) { await world.read(); hop = Math.max(hop, box.velocity[1]); }
      }
      await world.read();
      const distance = box.position[0] - 0.6;
      box.remove();
      return { distance, hop };
    };
    const over = await slide();
    assert.ok(Math.abs(over.distance - 12.74) < 1.3, `slid ${over.distance} m`);
    assert.ok(over.hop < 1, `hopped at ${over.hop} m/s`);
    // Without, a contact on the next tile's side (found ahead, speculation) stops it at a seam
    world.solver.params.seams = false;
    const stopped = await slide();
    assert.ok(stopped.distance < 6, `without, it stopped at a seam: ${stopped.distance} m`);
  } finally { world.destroy(); }
});
