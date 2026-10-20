import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as THREE from 'three/webgpu';
import { Destruction, presets, type PropModel, type V3 } from '../src/lib/index.ts';
import { asWorld, FakeBody, FakeWorld } from './fake-world.ts';

/** A car-sized box of a prop, 1.4 heavy. */
const car: PropModel = {
  name: 'car',
  object: new THREE.Group(),
  mass: 1.4,
  collider: [-0.9, 0.9].flatMap((x) => [0, 1.4].flatMap((y) => [-2.3, 2.3].map((z) => [x, y, z] as V3))),
};

function make() {
  const w = new FakeWorld();
  const d = new Destruction({ world: asWorld(w), frameBudget: Infinity, materials: { brick: presets.brick(), car: presets.metal() } });
  return { w, d };
}

test('a prop rests where it is put, as heavy as its model says, its hull where its model is', () => {
  const { d } = make();
  const turn: [number, number, number, number] = [0, Math.sin(0.4), 0, Math.cos(0.4)];
  const p = d.addProp({ model: car, material: 'car', position: [10, 0, 3], rotation: turn })!;
  assert.equal(p.state, 'rubble');
  assert.ok((p.body as unknown as FakeBody).fixed);
  assert.ok(Math.abs(p.mass - 1.4) < 1e-9, `mass ${p.mass}`);
  assert.ok(Math.abs((p.body as unknown as FakeBody).density - p.density) < 1e-12);
  // Its hull stands on the ground around where it was put
  const b = p.bounds;
  assert.ok(Math.abs(b.min[1]) < 1e-6 && Math.abs(b.max[1] - 1.4) < 1e-6, `${b.min[1]}..${b.max[1]}`);
  assert.ok(Math.abs((b.min[0] + b.max[0]) / 2 - 10) < 1e-6 && Math.abs((b.min[2] + b.max[2]) / 2 - 3) < 1e-6);
  // A second copy shares the first's hull, at its own place
  const q = d.addProp({ model: car, material: 'car', position: [-5, 0, 0] })!;
  assert.ok(Math.abs((q.bounds.max[2] - q.bounds.min[2]) - 4.6) < 1e-6);
});

test('a blast throws a prop whole: it never breaks', () => {
  const { d } = make();
  const p = d.addProp({ model: car, material: 'car', position: [0, 0, 0] })!;
  const before = d.all().length;
  d.explode({ at: [0, 0.7, -2.6], radius: 3 });
  assert.equal(p.state, 'loose');
  assert.equal(d.all().length, before);
  const v = (p.body as unknown as FakeBody).velocity;
  assert.ok(v[2] > 0, `thrown away from the blast: ${v}`);
});

test("the base pack's colliders are the points Destruction collides them as, standing on three or more", async () => {
  const { readFile } = await import('node:fs/promises');
  const index = JSON.parse(await readFile(new URL('../public/models/index.json', import.meta.url), 'utf8')) as Record<string, { collider: V3[] }>;
  for (const [name, e] of Object.entries(index)) {
    assert.ok(e.collider.length <= 12, `${name}: ${e.collider.length} points (Destruction would pick 12 itself)`);
    const floor = Math.min(...e.collider.map((p) => p[1]));
    assert.ok(Math.abs(floor) < 1e-3, `${name} stands on y = 0`);
    assert.ok(e.collider.filter((p) => p[1] < floor + 1e-3).length >= 3, `${name} stands on three points or more`);
  }
});

test('each copy of a prop has its own tint, kept when another copy goes', () => {
  const w = new FakeWorld();
  Object.assign(w, { bodyAttribute: new THREE.StorageInstancedBufferAttribute(new Float32Array(64 * 16), 4), maxBodies: 64 });
  const d = new Destruction({ world: asWorld(w), scene: new THREE.Scene(), frameBudget: Infinity, materials: { car: presets.metal() } });
  const object = new THREE.Group().add(new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.4, 4.6), new THREE.MeshStandardMaterial()));
  const model: PropModel = { ...car, object };
  const tints = [0xff0000, 0x00ff00, 0x0000ff];
  const copies = tints.map((tint, i) => d.addProp({ model, material: 'car', position: [i * 3, 0, 0], tint })!);
  const mesh = (d as unknown as { props: Map<PropModel, { mesh: { tints: THREE.BufferAttribute; count: number } }> }).props.get(model)!.mesh;
  const tintOf = (i: number) => Array.from((mesh.tints.array as Float32Array).subarray(4 * i, 4 * i + 3));
  assert.deepEqual([0, 1, 2].map(tintOf), [[1, 0, 0], [0, 1, 0], [0, 0, 1]]);
  d.removePiece(copies[0]);
  assert.equal(mesh.count, 2);
  // The last copy took the first's place, with its tint
  assert.deepEqual([0, 1].map(tintOf), [[0, 0, 1], [0, 1, 0]]);
});
