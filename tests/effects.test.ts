import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as THREE from 'three/webgpu';
import { DecalSlots, Effects, flashLight } from '../src/demo/effects.ts';
import { Destruction, type Piece, presets, signedDistance, toWorld, type V3 } from '../src/lib/index.ts';
import { asWorld, FakeWorld } from './fake-world.ts';

/** Floats a decal takes. */
const F = 16;

const slots = (cap = 64) => new DecalSlots(cap, new Float32Array(cap * F), true);

/** Decal `i`'s centre in the world (on `piece`, where the piece is now), its body slot, its half size and tint. */
function decal(s: DecalSlots, i: number, piece: Piece | null = null) {
  const d = s.data;
  const o = i * F;
  const c: V3 = [d[o], d[o + 1], d[o + 2]];
  return { at: piece ? toWorld(piece.pose.position, piece.pose.rotation, c) : c, slot: d[o + 3], half: d[o + 8], tint: d[o + 12] };
}

const near = (a: V3, b: V3, within = 1e-4) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) < within;

test('decals: a ring of slots, the oldest written over first; only what changed is uploaded', () => {
  const s = slots(64);
  for (let i = 0; i < 70; i++) s.add([i, 0, 0], [0, 1, 0]);
  assert.equal(s.filled, 64);
  assert.equal(s.next, 6);
  assert.equal(s.count, 64);
  assert.equal(decal(s, 5).at[0], 69, 'slot 5: the 70th');
  assert.equal(decal(s, 6).at[0], 6, 'slot 6: still the 7th');
  assert.deepEqual(s.flush(), [[0, 64 * F]], 'all of them, in one run');
  assert.deepEqual(s.flush(), [], 'nothing since');
  s.add([0, 0, 0], [0, 1, 0]);
  s.add([0, 0, 0], [0, 1, 0]);
  assert.deepEqual(s.flush(), [[6 * F, 2 * F]]);
});

test("a decal on a piece: in its body's frame, onto the cell it was on when the piece breaks, dropped with what's gone", () => {
  const d = new Destruction({ world: asWorld(new FakeWorld()), frameBudget: Infinity, materials: { concrete: presets.concrete() } });
  const block = d.addBox({ material: 'concrete', size: [2, 1, 0.5], position: [0, 0.5, 0] })!;
  const s = slots();
  d.on('fracture', (e) => s.fractured(e.piece, e.pieces));
  // Holes in its face (z = 0.25) at each end, and one on the ground beside it
  const left: V3 = [-0.8, 0.5, 0.25];
  const right: V3 = [0.75, 0.5, 0.25];
  const a = s.add(left, [0, 0, 1], { piece: block });
  const b = s.add(right, [0, 0, 1], { piece: block });
  const g = s.add([3, 0, 0], [0, 1, 0]);
  assert.equal(decal(s, a).slot, block.body.index);
  assert.ok(near(decal(s, a, block).at, left));
  assert.equal(decal(s, g).slot, -1, 'the world');
  // Shot at the right end till it gives way: each hole goes onto the cell it's on
  for (let n = 0; n < 1000 && block.state !== 'gone'; n++) d.shoot([0.7, 0.5, 5], [0, 0, -1]);
  assert.equal(block.state, 'gone');
  const cells = d.all();
  for (const [i, at] of [[a, left], [b, right]] as const) {
    const cell = cells.find((c) => c.body.index === decal(s, i).slot);
    assert.ok(cell && cell !== block, `decal ${i} on a cell`);
    assert.ok(near(decal(s, i, cell).at, at), `where it was: ${decal(s, i, cell).at}`);
    assert.ok(signedDistance(cell.convex, at) < 0.02, 'on that cell');
  }
  assert.deepEqual(decal(s, g).at, [3, 0, 0], "the ground's stays put");
  // The cell under one is taken out of the world: its decal goes, the rest stay
  const cell = cells.find((c) => c.body.index === decal(s, b).slot)!;
  d.removePiece(cell);
  s.drop();
  assert.equal(decal(s, b).half, 0, 'dropped');
  assert.ok(decal(s, a).half > 0);
  assert.equal(s.count, 2);
});

test('a slot written over lets go of its piece: the piece breaking later leaves the new decal be', () => {
  const d = new Destruction({ world: asWorld(new FakeWorld()), frameBudget: Infinity, materials: { concrete: presets.concrete() } });
  const block = d.addBox({ material: 'concrete', size: [2, 1, 0.5], position: [0, 0.5, 0] })!;
  const s = slots(64);
  d.on('fracture', (e) => s.fractured(e.piece, e.pieces));
  s.add([0.7, 0.5, 0.25], [0, 0, 1], { piece: block });
  for (let i = 0; i < 64; i++) s.add([10 + i, 0, 0], [0, 1, 0]);
  for (let n = 0; n < 1000 && block.state !== 'gone'; n++) d.shoot([0.7, 0.5, 5], [0, 0, -1]);
  assert.equal(block.state, 'gone');
  assert.deepEqual([decal(s, 0).slot, decal(s, 0).at], [-1, [73, 0, 0]]);
  for (const p of d.all()) d.removePiece(p);
  s.drop();
  assert.equal(s.count, 64);
});

test("scorches in one spot don't stack to black: the older go lighter, together about a tenth at most", () => {
  const s = slots();
  const hole = s.add([0, 0, 0], [0, 1, 0], { color: 0xffffff });
  const far = s.add([20, 0, 0], [0, 1, 0], { kind: 'scorch', size: 6 });
  const first = s.add([0, 0, 0], [0, 1, 0], { kind: 'scorch', size: 6 });
  assert.ok(decal(s, first).tint > 0.2 && decal(s, first).tint < 0.3, `one darkens to a quarter: ${decal(s, first).tint}`);
  const all = [first];
  /** What they all multiply the middle by. */
  const together = () => all.reduce((k, i) => k * decal(s, i).tint, 1);
  for (let k = 1; k < 10; k++) {
    all.push(s.add([0.1 * k, 0, 0], [0, 1, 0], { kind: 'scorch', size: 6 }));
    if (k === 2) assert.ok(together() > 0.11 && together() < 0.16, `three: ${together()}`);
  }
  assert.ok(together() > 0.09, `ten: ${together()}`);
  assert.equal(decal(s, far).tint, decal(s, all.at(-1)!).tint, 'one 20 m off: as dark as the newest');
  assert.equal(decal(s, hole).tint, 1, 'a hole there: untouched');
  // One half its size off: softened by half as much
  const t = slots();
  const x = t.add([0, 0, 0], [0, 1, 0], { kind: 'scorch', size: 6 });
  t.add([1.5, 0, 0], [0, 1, 0], { kind: 'scorch', size: 6 });
  assert.ok(Math.abs(1 - decal(t, x).tint - 0.75 * 0.75) < 1e-6, `${decal(t, x).tint}`);
});

test("a muzzle's or a spark's flash never takes a blast's light", () => {
  const lights = [0, 1, 2].map(() => ({ active: false, minor: false, t: 0 }));
  assert.equal(flashLight(lights, true), lights[0], 'an idle one');
  lights.forEach((l, i) => Object.assign(l, { active: true, t: 0.1 * i }));
  assert.equal(flashLight(lights, true), null, 'three blasts going: none for it');
  assert.equal(flashLight(lights, false), lights[2], 'a blast takes the one furthest into its fade');
  lights[0].minor = true;
  assert.equal(flashLight(lights, true), lights[0], 'another minor one');
  assert.equal(flashLight(lights, false), lights[2]);
  lights[1].active = false;
  assert.equal(flashLight(lights, true), lights[1], 'an idle one first');
});

test("a debris spray's chips land on the floor they're given, else on the effects' ground", () => {
  /** Where each bit made lands (its floor: the 13th of its 16 floats). */
  const floors = (floor?: number) => {
    const fx = new Effects(new THREE.Scene(), new THREE.PerspectiveCamera(70, 1, 0.05, 600), { maxParticles: 4000 });
    fx.impact([0, 3, -4], [0, 0, 1], 0x8a5a44, floor);
    const bits = (fx as unknown as { bits: { s: Float32Array; head: number } }).bits;
    return Array.from({ length: bits.head }, (_, i) => bits.s[i * 16 + 12]);
  };
  const given = floors(-0.15);
  assert.ok(given.length > 10, `${given.length} bits`);
  assert.ok(given.every((y) => y === Math.fround(-0.15)), 'on the asphalt, 15 cm under the effects ground');
  assert.ok(floors().every((y) => y === 0));
});

test("chips not given a floor land on what's under them (the options' floor), asked from just off the surface", () => {
  const asked: V3[] = [];
  const fx = new Effects(new THREE.Scene(), new THREE.PerspectiveCamera(70, 1, 0.05, 600), { maxParticles: 4000, floor: (from) => (asked.push(from), -0.9) });
  const bits = (fx as unknown as { bits: { s: Float32Array; head: number } }).bits;
  const landed = (from: number) => Array.from({ length: bits.head - from }, (_, i) => bits.s[(from + i) * 16 + 12]);
  // A spark off iron landing in a crater, a bullet into a wall over one
  fx.impact([1, 0.4, 2], [0, 1, 0], 0xffb060);
  const sparks = landed(0);
  assert.ok(sparks.length > 10 && sparks.every((y) => y === Math.fround(-0.9)), 'on the floor under it, not at y 0');
  assert.deepEqual(asked[0], [1, 0.5, 2], '5 cm off it, and 5 cm up');
  const head = bits.head;
  fx.bullet([0, 1, -3], [0, 0, 1], { kind: 'brick' });
  assert.ok(landed(head).every((y) => y === Math.fround(-0.9)));
  assert.ok(Math.abs(asked[1][2] + 2.95) < 1e-9 && Math.abs(asked[1][1] - 1.05) < 1e-9, 'off the wall, not in it');
  // A sign's sparks too
  const signs = bits.head;
  fx.sparks([2, 5, -3], [0, 0, 1]);
  assert.ok(bits.head > signs && landed(signs).every((y) => y === Math.fround(-0.9)));
  // A floor given is taken as it is
  const before = bits.head;
  fx.impact([0, 3, -4], [0, 0, 1], 0x8a5a44, -0.15);
  assert.ok(landed(before).every((y) => y === Math.fround(-0.15)));
  assert.equal(asked.length, 3);
});
