// How long the solver's steps take on this machine's GPU through Dawn (no browser): a baseline
// for what the browser shows.
import { create, globals } from 'webgpu';
import { World } from 'three-avbd';

Object.assign(globalThis, globals);
const gpu = create([]);
const adapter = (await gpu.requestAdapter({ powerPreference: 'high-performance' }))!;
console.log('adapter', adapter.info.vendor, adapter.info.architecture, adapter.info.description);
const device = await adapter.requestDevice({ requiredLimits: { maxStorageBuffersPerShaderStage: adapter.limits.maxStorageBuffersPerShaderStage, maxStorageBufferBindingSize: adapter.limits.maxStorageBufferBindingSize, maxBufferSize: adapter.limits.maxBufferSize } });
(globalThis as { __dawn?: unknown }).__dawn = [gpu, adapter, device];
for (const n of [7, 2000]) {
  const world = await World.create({ device, maxBodies: 30_000 });
  world.addBox({ size: [200, 1, 200], position: [0, -0.5, 0], fixed: true });
  for (let i = 0; i < n; i++) world.addBox({ size: [0.5, 0.5, 0.5], position: [(i % 20) - 10, 0.3 + Math.floor(i / 400) * 0.6, (Math.floor(i / 20) % 20) - 10] });
  for (let i = 0; i < 30; i++) world.step();
  await device.queue.onSubmittedWorkDone();
  const t0 = performance.now();
  for (let i = 0; i < 60; i++) world.step();
  await device.queue.onSubmittedWorkDone();
  console.log(`${n} bodies: ${((performance.now() - t0) / 60).toFixed(2)} ms/step`);
  world.destroy();
}
process.exit(0);
