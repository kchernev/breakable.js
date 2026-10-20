import assert from 'node:assert/strict';
import { GpuSolver3D } from '../src/avbd3d/gpu/solver.ts';
import { Rigid } from '../src/avbd3d/ref/body.ts';
import { Solver } from '../src/avbd3d/ref/solver.ts';
import { gpuTest } from './device.ts';

gpuTest('sparse color fusion preserves states, including multi-chunk buckets and parameter changes', async device => {
  for (const count of [80, 1100]) {
    const make = (fuse: boolean) => {
      const ref = new Solver();
      for (let i = 0; i < count; i++) new Rigid(ref, [0.1, 0.1, 0.1], 1, 0.5, [i * 0.3, 0, 3]);
      const gpu = new GpuSolver3D(device, ref, { spatialSort: false });
      gpu.fuseSparseColors = fuse;
      gpu.appendJoints(Array.from({ length: 63 }, (_, i) => ({ a: i, b: i + 1, rA: [0.15, 0, 0], rB: [-0.15, 0, 0] })));
      return gpu;
    };
    const normal = make(false), fused = make(true);
    try {
      for (let step = 0; step < 30; step++) {
        for (const gpu of [normal, fused]) {
          // First use a populated 64-colour tail; then exercise multiple chunks in colour 63.
          gpu.fixedColors = Uint32Array.from({ length: count }, (_, i) => step < 15 ? i % 64 : i < 64 ? i : 63);
          gpu.params.alpha = step < 10 ? 0.95 : 0.8;
          gpu.params.iterations = step === 0 ? 0 : step < 20 ? 4 : 8;
          gpu.step();
        }
        assert.deepEqual(await fused.readBodies(), await normal.readBodies(), `step ${step}`);
      }
    } finally { normal.destroy(); fused.destroy(); }
  }
});

gpuTest('color cap shrinks after quiet readbacks and regrows on clashes', async device => {
  const ref = new Solver();
  new Rigid(ref, [1, 1, 1], 1, 0.5, [0, 0, 3]);
  const gpu = new GpuSolver3D(device, ref);
  try {
    gpu.colorCap = 64;
    gpu.step();
    const counters = await gpu.readCounters();
    assert.equal(counters.colors, 1);
    for (let i = 0; i < 3; i++) gpu.adapt(counters);
    assert.equal(gpu.colorCap, 4);
    gpu.adapt({ ...counters, clashes: 1 });
    assert.equal(gpu.colorCap, 8);
  } finally { gpu.destroy(); }
});

gpuTest('dynamic coloring preserves the solve with an underestimated tail hint', async device => {
  const make = (fuse: boolean) => {
    const ref = new Solver();
    for (let i = 0; i < 300; i++) new Rigid(ref, [0.1, 0.1, 0.1], 1, 0.5, [i * 0.3, 0, 3]);
    const gpu = new GpuSolver3D(device, ref, { spatialSort: false });
    gpu.fuseSparseColors = fuse;
    gpu.appendJoints(Array.from({ length: 299 }, (_, i) => ({ a: i, b: i + 1, rA: [0.15, 0, 0], rB: [-0.15, 0, 0] })));
    gpu.fixedColors = Uint32Array.from({ length: 300 }, (_, i) => 32 + i % 2);
    return gpu;
  };
  const normal = make(false), fused = make(true);
  try {
    normal.step(); fused.step();
    for (const gpu of [normal, fused]) {
      gpu.fixedColors = null;
      gpu.adapt({ ...await gpu.readCounters(), tailBodies: 0 });
      gpu.colorCap = 64;
    }
    normal.step(); fused.step();
    assert.ok((await fused.readCounters()).tailBodies! > 128, 'fixture needs an underestimated tail');
    assert.deepEqual(await fused.readBodies(), await normal.readBodies());
  } finally { normal.destroy(); fused.destroy(); }
});
