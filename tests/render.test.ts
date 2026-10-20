import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as THREE from 'three/webgpu';
import { BODY_FLOATS } from 'three-avbd/advanced';
import { cylinder, Destruction, type FragmentMesh, type Piece, presets, type PropModel, random, uniformSeeds, type V3, voronoi } from '../src/lib/index.ts';
import { asWorld, type FakeBody, FakeWorld } from './fake-world.ts';

/** A fake world with a body buffer, so the Destruction draws (no GPU: nothing is compiled or uploaded). */
function make(materials = { stone: presets.concrete(), glass: presets.glass() }) {
  const w = new FakeWorld();
  const slots = 4096;
  Object.assign(w, { bodyAttribute: new THREE.StorageInstancedBufferAttribute(new Float32Array(slots * BODY_FLOATS), 4), maxBodies: slots });
  const d = new Destruction({ world: asWorld(w), scene: new THREE.Scene(), frameBudget: Infinity, materials });
  return { w, d };
}

const mesh = (d: Destruction, name: string) => d.drawn.find((m) => m.name === `breakable:${name}`)!;
/** A piece's record: texture frame rotation, origin, state, box centre, half extents. */
function record(d: Destruction, p: Piece) {
  const data = (mesh(d, p.materialName) as unknown as { records: { data: Float32Array } }).records.data;
  const r = Array.from(data.subarray(p.body.index * 16, p.body.index * 16 + 16));
  return { rotation: r.slice(0, 4), origin: r.slice(4, 7), state: r[7], centre: r.slice(8, 11), half: r.slice(12, 15) };
}
/** Every drawn vertex of a piece: position, normal, uv (body frame). */
function vertices(m: FragmentMesh, p: Piece) {
  const g = m.geometry;
  const at = (name: string, k: number, i: number) => Array.from((g.getAttribute(name).array as Float32Array).subarray(k * i, k * i + k));
  const out: Array<{ p: number[]; n: number[]; uv: number[]; inner: boolean }> = [];
  for (let i = p.draw!.start; i < p.draw!.start + p.draw!.count; i++) out.push({ p: at('position', 3, i), n: at('normal', 3, i), uv: at('uv', 2, i), inner: at('pieceInfo', 2, i)[1] > 0.5 });
  return out;
}
const near = (a: number[], b: number[], eps = 1e-5) => a.every((x, k) => Math.abs(x - b[k]) < eps);

test("a piece's record holds its texture frame, its box as built and its state, which follows it", async () => {
  const { w, d } = make();
  const wall = Array.from({ length: 4 }, (_, i) => d.addBox({ material: 'stone', size: [1, 1, 0.4], position: [0, 0.5 + i, 0] })!);
  const r = record(d, wall[2]);
  assert.deepEqual(r.rotation, [0, 0, 0, 1]);
  assert.ok(near(r.half, [0.5, 0.5, 0.2]) && near(r.centre, [0, 0, 0]), JSON.stringify(r));
  assert.equal(r.state, 0);
  // A blast in the middle: its cells keep their piece's box, and those thrown say they're loose
  const res = d.explode({ at: [0, 2.5, 0.3], radius: 0.6 });
  assert.ok(res.made.length > 2);
  for (const c of res.made.filter((p) => p.state !== 'gone')) {
    const rc = record(d, c);
    assert.ok(near(rc.half, [0.5, 0.5, 0.2], 1e-4), `cell keeps the block's half extents: ${rc.half}`);
    assert.equal(rc.state, c.state === 'loose' ? 1 : 0);
  }
  assert.ok(res.loose.length > 0);
  // Rubble once it rests (the fake world never slows it: stop it)
  const thrown = res.loose[0];
  Object.assign(thrown.body as unknown as FakeBody, { velocity: [0, 0, 0], angularVelocity: [0, 0, 0] });
  for (let k = 0; k < 12; k++) {
    d.update(0.1);
    await Promise.resolve();
  }
  assert.equal(thrown.state, 'rubble');
  assert.equal(record(d, thrown).state, 2);
  assert.ok(w.bodies.length > 4);
});

test("a cell's texture is where its piece's was: the same point, the same texture coordinates", () => {
  const { d } = make({ stone: presets.concrete({ uvScale: [2, 0.5] }), glass: presets.glass() });
  const block = d.addBox({ material: 'stone', size: [1.2, 0.8, 0.5], position: [3, 0.4, 0], rotation: [0, Math.sin(0.3), 0, Math.cos(0.3)] })!;
  // The front face (+z): u runs 2 a metre along x, v 0.5 a metre up
  const front = vertices(mesh(d, 'stone'), block).filter((v) => v.n[2] > 0.99);
  const span = (k: number) => Math.max(...front.map((v) => v.uv[k])) - Math.min(...front.map((v) => v.uv[k]));
  assert.ok(Math.abs(span(0) - 2.4) < 1e-5 && Math.abs(span(1) - 0.4) < 1e-5, `u ${span(0)}, v ${span(1)}`);
  // Where (world) each front vertex of the block is, and its uv
  const toWorld = (p: Piece, v: number[]) => new THREE.Vector3(...v).applyQuaternion(new THREE.Quaternion(...p.pose.rotation)).add(new THREE.Vector3(...p.pose.position));
  const turn = (p: Piece, n: number[]) => new THREE.Vector3(...n).applyQuaternion(new THREE.Quaternion(...p.pose.rotation));
  const facing = turn(block, [0, 0, 1]);
  const before = front.map((v) => ({ at: toWorld(block, v.p), uv: v.uv }));
  const res = d.explode({ at: [3, 0.4, 0.6], radius: 0.4, speed: 0 });
  let matched = 0;
  for (const c of res.made.filter((p) => p.state !== 'gone'))
    for (const v of vertices(mesh(d, 'stone'), c).filter((v) => !v.inner && turn(c, v.n).dot(facing) > 0.99)) {
      const at = toWorld(c, v.p);
      const same = before.find((b) => b.at.distanceTo(at) < 1e-4);
      if (!same) continue;
      assert.ok(near(same.uv, v.uv, 1e-4), `${same.uv} vs ${v.uv}`);
      matched++;
    }
  assert.ok(matched > 0, 'some corner of the block is a corner of a cell');
});

test('uvJitter moves each piece\'s map, so blocks of one size show different patches', () => {
  const { d } = make({ stone: presets.concrete({ uvScale: 0.5, uvJitter: 1 }), glass: presets.glass() });
  const blocks = [0, 1, 2].map((i) => d.addBox({ material: 'stone', size: [1, 0.5, 0.5], position: [i * 1.2, 0.25, 0] })!);
  const firstUV = blocks.map((b) => vertices(mesh(d, 'stone'), b).find((v) => v.n[2] > 0.99)!.uv);
  assert.ok(!near(firstUV[0], firstUV[1], 1e-3) && !near(firstUV[1], firstUV[2], 1e-3), JSON.stringify(firstUV));
  // Within a tile (2 m at 0.5 a metre): up to one repeat
  for (const b of blocks) assert.ok(Math.hypot(...b.texture.position) <= 2 * Math.sqrt(3) + 1e-9);
  // Its record's box is the block's, wherever the frame went
  assert.ok(near(record(d, blocks[1]).half, [0.5, 0.25, 0.25]));
});

test('smooth: a drum shades round, its ends flat; its cells keep it and their broken faces stay flat', () => {
  const { d } = make();
  const drum = d.addConvex({ material: 'stone', points: cylinder(0.5, 0.8, 16), position: [0, 0, 0], smooth: 0.5 })!;
  const flat = d.addConvex({ material: 'stone', points: cylinder(0.5, 0.8, 16), position: [3, 0, 0] })!;
  const axisOf = (p: Piece, v: number[]) => new THREE.Vector3(...v).applyQuaternion(new THREE.Quaternion(...p.pose.rotation)).add(new THREE.Vector3(...p.pose.position));
  const turn = (p: Piece, n: number[]) => new THREE.Vector3(...n).applyQuaternion(new THREE.Quaternion(...p.pose.rotation));
  for (const v of vertices(mesh(d, 'stone'), drum)) {
    const n = turn(drum, v.n);
    if (Math.abs(n.y) > 0.99) continue; // an end
    const at = axisOf(drum, v.p);
    const radial = new THREE.Vector3(at.x, 0, at.z).normalize();
    assert.ok(n.dot(radial) > 1 - 1e-6, `side normal radial at its corners: ${n.toArray()} vs ${radial.toArray()}`);
  }
  // Unsmoothed, a side's corners have its face's normal, a 16th of a turn off radial at the corners
  const off = vertices(mesh(d, 'stone'), flat).filter((v) => Math.abs(turn(flat, v.n).y) < 0.99).map((v) => turn(flat, v.n).dot(new THREE.Vector3(axisOf(flat, v.p).x - 3, 0, axisOf(flat, v.p).z).normalize()));
  assert.ok(Math.max(...off) < Math.cos(Math.PI / 16) + 1e-6);
  assert.equal(drum.texture.smooth, 0.5);
  const res = d.explode({ at: [0, 0.4, 0.6], radius: 0.4, speed: 0 });
  const cells = res.made.filter((p) => p.state !== 'gone');
  assert.ok(cells.length > 1 && cells.every((c) => c.texture.smooth === 0.5));
  for (const c of cells)
    for (const f of vertices(mesh(d, 'stone'), c).filter((v) => v.inner)) {
      assert.ok(c.local.faces.some((g) => g.inner && near(f.n, g.n) && g.pts.some((q) => near(q, f.p))), 'broken faces flat');
    }
});

test('a piece made again from its textureFrame keeps its look: its map (jittered once), its box, its smoothing', () => {
  const { d } = make({ stone: presets.concrete({ uvScale: 0.5, uvJitter: 1 }), glass: presets.glass() });
  const drum = d.addConvex({ material: 'stone', points: cylinder(0.5, 0.8, 16), position: [1, 0, 2], rotation: [0, Math.sin(0.2), 0, Math.cos(0.2)], smooth: 0.5 })!;
  const m = mesh(d, 'stone');
  const world = (p: Piece, v: number[]) => new THREE.Vector3(...v).applyQuaternion(new THREE.Quaternion(...p.pose.rotation)).add(new THREE.Vector3(...p.pose.position));
  const turn = (p: Piece, n: number[]) => new THREE.Vector3(...n).applyQuaternion(new THREE.Quaternion(...p.pose.rotation));
  const drawn = (p: Piece) => vertices(m, p).map((v) => ({ at: world(p, v.p), n: turn(p, v.n), uv: v.uv }));
  const before = drawn(drum);
  const built = record(d, drum);
  // As Sun Temple's levers let a piece go whole: made again where it was, loose
  const frame = drum.textureFrame;
  const points = drum.corners;
  d.removePiece(drum);
  const again = d.addConvex({ material: 'stone', points, textureFrame: frame, loose: true })!;
  // Each corner drawn as before: where it was, its normal and its texture coordinates (two sides
  // meeting at a corner share its smooth normal, not their uv)
  const after = drawn(again);
  assert.equal(after.length, before.length);
  for (const v of after) assert.ok(before.some((b) => b.at.distanceTo(v.at) < 1e-5 && b.n.dot(v.n) > 1 - 1e-6 && near(b.uv, v.uv, 1e-5)), `the map stays put at ${v.at.toArray()}: ${v.uv}`);
  assert.equal(again.texture.smooth, 0.5);
  assert.ok(near(record(d, again).half, built.half) && near(record(d, again).centre, built.centre), 'its box kept');
  // As its tiles shatter: parts made again from cells, each with the drum's frame and box
  const cells = voronoi(again.convex, uniformSeeds(again.convex, 3, random(7)), 1e-6);
  const whole = again.textureFrame;
  d.removePiece(again);
  for (const cell of cells) {
    const part = d.addConvex({ material: 'stone', points: cell.convex.faces.flatMap((f) => f.pts), textureFrame: whole, loose: true })!;
    assert.ok(near(part.textureFrame.position, frame.position, 1e-6), 'not jittered again');
    assert.ok(near(record(d, part).half, built.half, 1e-6) && part.texture.smooth === 0.5);
  }
  // A frame without a box (a plain pose) is jittered as before
  const plain = d.addBox({ material: 'stone', size: [1, 0.5, 0.5], position: [5, 0.25, 0], textureFrame: { position: [5, 0.25, 0], rotation: [0, 0, 0, 1] } })!;
  assert.ok(!near(plain.textureFrame.position, [5, 0.25, 0], 1e-3));
});

test("a world's piece records aren't uploaded until a shader reads them: no update ranges pile up", () => {
  const { d } = make();
  for (let i = 0; i < 20; i++) d.addBox({ material: 'stone', size: [1, 1, 1], position: [i * 1.5, 0.5, 0] });
  const records = (mesh(d, 'stone') as unknown as { records: { read: boolean; attr: THREE.StorageBufferAttribute } }).records;
  const loosen = (count: number) => {
    for (const p of d.all().filter((p) => p.state === 'fixed').slice(0, count)) d.loosen(p);
    d.update(0.016);
  };
  for (let k = 0; k < 5; k++) loosen(2);
  assert.equal(records.read, false);
  assert.equal(records.attr.updateRanges.length, 0, 'nothing waits for an upload no one makes');
  // Once read (building a material that uses pieceState, pieceFrame or glow does), the records
  // that change go up, merged when close
  records.read = true;
  const version = records.attr.version;
  loosen(2);
  assert.ok(records.attr.version > version);
  assert.equal(records.attr.updateRanges.length, 1);
  assert.ok(records.attr.updateRanges[0].count <= 16 * 4, `${records.attr.updateRanges[0].count} floats`);
});

test('a prop takes its own tint, or its model\'s', () => {
  const { d } = make({ stone: presets.concrete(), glass: presets.glass(), drum: presets.metal() } as never);
  const model: PropModel = { name: 'drum', object: new THREE.Group(), mass: 0.2, collider: cylinder(0.3, 0.9, 8) as V3[], tint: 0x3355aa, tintMask: 'alpha' };
  const a = d.addProp({ model, material: 'drum', position: [0, 0, 0] })!;
  const b = d.addProp({ model, material: 'drum', position: [2, 0, 0], tint: 0xff0000 })!;
  const c = new THREE.Color(0x3355aa);
  assert.ok(near(a.tint, [c.r, c.g, c.b]));
  assert.ok(near(b.tint, [1, 0, 0]));
  const props = d.drawn.length;
  assert.equal(props, 0, 'props are drawn by PropMesh, not FragmentMesh');
});
