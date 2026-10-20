import assert from 'node:assert/strict';
import { Rigid } from '../src/avbd3d/ref/body.ts';
import { Solver } from '../src/avbd3d/ref/solver.ts';
import { GpuSolver3D } from '../src/avbd3d/gpu/solver.ts';
import { gpuTest } from './device.ts';

// Every ownership direction must survive: fixed bodies never launch a grid probe,
// but still collide with small and large moving bodies, irrespective of body index.
// three-destruction sleeps bodies by rewriting them as fixed (mass zero); waking restores mass.
gpuTest('dynamic probes cover fixed/dynamic small/large pairs and sleeping/waking rewrites', async device => {
  const ref = new Solver();
  const expected: string[] = [];
  const specifications: Array<{ size: number[]; position: number[]; density: number }> = [];
  for (const largeA of [false, true]) for (const largeB of [false, true]) {
    for (const dynamicA of [false, true]) for (const dynamicB of [false, true]) {
      const start = specifications.length;
      for (const [large, dynamic, dx] of [[largeA, dynamicA, 0], [largeB, dynamicB, 0.2]] as const) {
        const spec = { size: large ? [8, 8, 8] : [1, 1, 1], position: [start * 20 + dx, 0, 0], density: dynamic ? 1 : 0 };
        specifications.push(spec);
        new Rigid(ref, spec.size, spec.density, 0.5, spec.position);
      }
      if (dynamicA || dynamicB) expected.push(`${start + 1}-${start}`);
    }
  }
  // Keep the median radius small so the larger test bodies use the large-body path.
  for (let i = 0; i < 100; i++) new Rigid(ref, [1, 1, 1], 0, 0.5, [i * 3, 1000, 0]);
  const gpu = new GpuSolver3D(device, ref, { spatialSort: false });
  gpu.params.iterations = 0;
  gpu.params.gravity = 0;
  const pairs = async () => {
    gpu.step();
    const raw = await gpu.readPairs();
    const out: string[] = [];
    for (let i = 0; i < raw.length; i += 2) out.push(`${raw[i]}-${raw[i + 1]}`);
    assert.equal((await gpu.readCounters()).overflow, 0);
    return out.sort();
  };
  try {
    assert.deepEqual(await pairs(), expected.sort());
    const rewrite = (awake: boolean) => {
      const scratch = new Solver();
      gpu.rewriteBodies(specifications.map((_, i) => i), specifications.map(s => new Rigid(scratch, s.size, awake ? s.density : 0, 0.5, s.position)));
    };
    rewrite(false);
    assert.deepEqual(await pairs(), [], 'all sleeping: no stale probe entries or fixed/fixed pairs');
    rewrite(true);
    assert.deepEqual(await pairs(), expected.sort(), 'wake restores every pair, including large dynamic vs small fixed');
  } finally {
    gpu.destroy();
  }
});
