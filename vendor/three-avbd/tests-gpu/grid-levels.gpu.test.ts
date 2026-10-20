import assert from 'node:assert/strict';
import { GpuSolver3D } from '../src/avbd3d/gpu/solver.ts';
import { Rigid } from '../src/avbd3d/ref/body.ts';
import { Solver } from '../src/avbd3d/ref/solver.ts';
import { gpuTest } from './device.ts';

gpuTest('grid levels and large pairs match brute force across sleep, wake and resize', async device => {
  const ref = new Solver();
  let seed = 17;
  const random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32);
  for (let i = 0; i < 210; i++) {
    const size = i < 2 ? 40 : i % 2 ? 0.4 : 4;
    new Rigid(ref, [size, size, size], i % 2 ? (i % 3 ? 1 : 0) : (i < 3 ? 1 : 0), 0.5, [(random() - 0.5) * 80, (random() - 0.5) * 8, (random() - 0.5) * 8]);
  }
  const gpu = new GpuSolver3D(device, ref, { spatialSort: false });
  gpu.params.iterations = 0;
  gpu.params.gravity = 0;
  try {
    for (const stage of ['initial', 'sleep', 'wake', 'resize']) {
      if (stage !== 'initial') for (let i = 3; i < ref.bodies.length; i += 2) {
        const b = ref.bodies[i]!;
        b.mass = stage === 'sleep' ? 0 : 1;
        if (stage === 'resize') { b.size.set([0.2, 0.2, 0.2]); b.radius = Math.sqrt(3) * 0.1; }
      }
      gpu.rewriteBodies(Uint32Array.from(ref.bodies, (_, i) => i), ref.bodies);
      gpu.step();
      // Confirm the fixture exercises both levels, not just the legacy one-level path.
      const split = Reflect.get(gpu, 'gridLevels') > 1;
      assert.equal(split, stage !== 'sleep', `${stage}: expected grid levels`);
      const pairs = await gpu.readPairs();
      const actual: string[] = [], expected: string[] = [];
      for (let k = 0; k < pairs.length; k += 2) actual.push(`${pairs[k]}-${pairs[k + 1]}`);
      for (let i = 0; i < ref.bodies.length; i++) for (let j = 0; j < i; j++) {
        const a = ref.bodies[i]!, b = ref.bodies[j]!;
        if (a.mass <= 0 && b.mass <= 0) continue;
        if ([0, 1, 2].every(k => Math.abs(a.positionLin[k]! - b.positionLin[k]!) <= (a.size[k]! + b.size[k]!) * 0.5)) expected.push(`${i}-${j}`);
      }
      assert.equal(new Set(actual).size, actual.length, `${stage}: duplicate pairs`);
      assert.deepEqual(actual.sort(), expected.sort(), stage);
      assert.equal((await gpu.readCounters()).overflow, 0, stage);
    }
  } finally { gpu.destroy(); }
});


gpuTest('dynamic-only probes preserve every fixed/fine/coarse ownership direction', async device => {
  const ref = new Solver();
  const expected: string[] = [];
  for (const coarseA of [false, true]) for (const coarseB of [false, true]) {
    for (const movingA of [false, true]) for (const movingB of [false, true]) {
      const start = ref.bodies.length;
      for (const [coarse, moving, dx] of [[coarseA, movingA, 0], [coarseB, movingB, 0.1]] as const) {
        const size = coarse ? 4 : 0.4;
        new Rigid(ref, [size, size, size], moving ? 1 : 0, 0.5, [start * 10 + dx, 0, 0]);
      }
      if (movingA || movingB) expected.push(`${start + 1}-${start}`);
    }
  }
  // More than 64 coarse bodies keep that level out of the large-body list;
  // many fine movers ensure a distinct fine level even with a few coarse movers.
  for (let i = 0; i < 160; i++) new Rigid(ref, [4, 4, 4], 0, 0.5, [i * 5, 1000, 0]);
  for (let i = 0; i < 1000; i++) new Rigid(ref, [0.4, 0.4, 0.4], 1, 0.5, [i, 2000, 0]);
  const gpu = new GpuSolver3D(device, ref, { spatialSort: false });
  gpu.params.gravity = 0; gpu.params.iterations = 0;
  try {
    gpu.step();
    assert.ok(Reflect.get(gpu, 'gridLevels') > 1);
    // Movers above level 0: the fixed bodies under them probe up for them
    assert.ok(Reflect.get(gpu, 'moverLevels') > 1);
    const raw = await gpu.readPairs(), pairs: string[] = [];
    for (let k = 0; k < raw.length; k += 2) pairs.push(`${raw[k]}-${raw[k + 1]}`);
    assert.equal(new Set(pairs).size, pairs.length);
    assert.deepEqual(pairs.sort(), expected.sort());
    assert.equal((await gpu.readCounters()).overflow, 0);
  } finally { gpu.destroy(); }
});
