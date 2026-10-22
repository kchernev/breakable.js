import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as THREE from 'three/webgpu';
import { Destruction, type Piece, presets, type PropModel, type V3 } from '../src/lib/index.ts';
import { asWorld, type FakeBody, FakeWorld } from './fake-world.ts';

function make() {
  const w = new FakeWorld();
  const d = new Destruction({ world: asWorld(w), frameBudget: Infinity, materials: { concrete: presets.concrete(), brick: presets.brick(), steel: presets.metal() } });
  // The ground: a fixed box, its top at 0
  w.addBox({ size: [200, 2, 200], position: [0, -1, 0], fixed: true });
  return { w, d };
}

/** Frames of `dt`, letting each readback land. */
async function run(d: Destruction, seconds: number, dt = 0.1) {
  for (let t = 0; t < seconds; t += dt) {
    d.update(dt);
    await new Promise((r) => setImmediate(r));
  }
}

/**
 * A 2 m block of scenery at x (on the ground): a fixed body until it wakes, then 2 × 2 × 2 blocks of
 * concrete (`gap`: leaving out the middle row, as a doorway would).
 */
function block(w: FakeWorld, d: Destruction, x: number, o: { blastOnly?: boolean; gap?: boolean; name?: string } = {}) {
  const body = w.addBox({ size: [2, 2, 2], position: [x, 1, 0], fixed: true });
  return d.addDormant({
    name: o.name,
    bounds: { min: [x - 1, 0, -1], max: [x + 1, 2, 1] },
    bodies: [body as never],
    blastOnly: o.blastOnly,
    build: (dd) => {
      for (const i of [-0.5, 0.5])
        for (const j of [0.5, 1.5])
          for (const k of [-0.5, 0.5]) {
            if (o.gap && j === 0.5) continue;
            dd.addBox({ material: 'concrete', size: [1, 1, 1], position: [x + i, j, k] });
          }
    },
  });
}

test('a dormant thing stands as its fixed bodies until a blast reaches it, then as its pieces: its bodies out of the world', () => {
  const { w, d } = make();
  const dormant = block(w, d, 0);
  const body = w.bodies.find((b) => b.position[0] === 0 && b.position[1] === 1)!;
  const woken: Piece[][] = [];
  d.on('wake', (e) => woken.push(e.pieces));
  // A blast 1.5 m off its side: past its radius and the reach it wakes things within (1.25 radii)
  d.explode({ at: [0, 1, 2.6], radius: 1 });
  assert.equal(dormant.woken, false);
  assert.equal(d.all().length, 0);
  assert.ok(body.alive);
  // Nearer, it wakes and is broken as any pieces are
  d.explode({ at: [0, 1, 2.1], radius: 1 });
  assert.ok(dormant.woken);
  assert.equal((body as unknown as FakeBody).alive, false, 'its stand-in is out of the world');
  assert.equal(woken.length, 1);
  assert.equal(woken[0].length, 8);
  assert.ok(d.all().length >= 8);
});

test('a round wakes the first thing dormant on its way and strikes its pieces; the next only if it passes through them', () => {
  const { w, d } = make();
  const near = block(w, d, 5);
  const far = block(w, d, 10);
  const hit = d.shoot([0, 1.5, 0.5], [1, 0, 0]);
  assert.ok(near.woken && !far.woken, 'only the first');
  assert.ok(hit?.piece, 'it strikes the pieces woken');
  assert.ok(Math.abs(hit!.point[0] - 4) < 1e-6, `at its face: ${hit!.point}`);
  // A gap in the second's way: the round goes through the first (no pieces there) on into the next
  const { w: w2, d: d2 } = make();
  const open = block(w2, d2, 5, { gap: true });
  const next = block(w2, d2, 10);
  const through = d2.shoot([0, 0.5, 0.5], [1, 0, 0]);
  assert.ok(open.woken && next.woken);
  assert.ok(Math.abs(through!.point[0] - 9) < 1e-6, `at the second's face: ${through!.point}`);
});

test('what wakes only to blasts (the ground) a round passes as scenery, and the way along a ray stops at what it meets', () => {
  const { w, d } = make();
  const ground = block(w, d, 5, { blastOnly: true });
  assert.equal(d.shoot([0, 1.5, 0.5], [1, 0, 0]), null);
  assert.equal(ground.woken, false);
  // wakeAlong (a rocket's flight): within its range only
  const wall = block(w, d, 20);
  assert.equal(d.wakeAlong([0, 1, 0.5], [1, 0, 0], 15), null);
  assert.equal(wall.woken, false);
  const met = d.wakeAlong([0, 1, 0.5], [1, 0, 0], 30);
  assert.ok(wall.woken && met && Math.abs(met.distance - 19) < 1e-6);
});

test('what stands on a dormant thing stands on its top as on the ground, and on its pieces once it wakes', async () => {
  const { w, d } = make();
  const under = block(w, d, 0);
  const top = d.addBox({ material: 'brick', size: [1, 0.5, 1], position: [0, 2.25, 0] })!;
  d.reinforce();
  await run(d, 0.5);
  assert.equal(top.state, 'fixed', 'on the stand-in');
  d.awaken(under);
  await run(d, 0.5);
  assert.equal(top.state, 'fixed', 'on its pieces');
  assert.ok(top.bonds.size > 0, 'bonded to them');
});

test('a piece that goes from under something dormant wakes it: an upper storey on a lower one that fell', async () => {
  const { w, d } = make();
  const post = d.addBox({ material: 'concrete', size: [2, 2, 2], position: [30, 1, 0] })!;
  const body = w.addBox({ size: [2, 2, 2], position: [30, 3, 0], fixed: true });
  const upper = d.addDormant({ bounds: { min: [29, 2, -1], max: [31, 4, 1] }, bodies: [body as never], build: (dd) => void dd.addBox({ material: 'concrete', size: [2, 2, 2], position: [30, 3, 0] }) });
  d.reinforce();
  await run(d, 0.3);
  assert.equal(upper.woken, false);
  d.loosen(post);
  await run(d, 0.3);
  assert.ok(upper.woken, 'woken as what held it went');
});

test('an anchor holds up what is bonded to it with nothing under it, and breaks as any piece', async () => {
  const { d } = make();
  // A slab over a hollow, a block on it
  const slab = d.addBox({ material: 'concrete', size: [3, 0.3, 3], position: [0, 2, 0], anchor: true })!;
  const load = d.addBox({ material: 'brick', size: [0.5, 0.5, 0.5], position: [0, 2.4, 0] })!;
  d.reinforce();
  await run(d, 0.5);
  assert.equal(slab.state, 'fixed');
  assert.equal(load.state, 'fixed', 'held up by the anchor');
  const r = d.explode({ at: [0, 1.6, 0], radius: 1.5 });
  await run(d, 0.5);
  assert.ok(r.broken > 0, 'the blast broke it');
  assert.equal(slab.state, 'gone');
  assert.notEqual(load.state, 'fixed', 'what it held falls');
});

test('a prop with shards breaks into them under a blast or enough rounds; without, it never does', () => {
  const { d } = make();
  const cube = (s: number, y0: number): V3[] => [-s, s].flatMap((x) => [y0, y0 + 2 * s].flatMap((y) => [-s, s].map((z): V3 => [x, y, z])));
  const shard = (y0: number): PropModel => ({ name: `bin.${y0}`, object: new THREE.Group(), mass: 0.05, collider: cube(0.25, y0) });
  const bin: PropModel = { name: 'bin', object: new THREE.Group(), mass: 0.1, collider: cube(0.25, 0), shards: [shard(0), shard(0.25)], rounds: 3 };
  const a = d.addProp({ model: bin, material: 'steel', position: [0, 0, 0] })!;
  for (let i = 0; i < 2; i++) d.shoot([0, 0.25, -5], [0, 0, 1]);
  assert.notEqual(a.state, 'gone', 'two rounds of three');
  const third = d.shoot([0, 0.25, -5], [0, 0, 1]);
  assert.ok(third?.broke, 'the third breaks it');
  assert.equal(a.state, 'gone');
  assert.equal(d.all().filter((p) => p.prop?.debris).length, 2, 'its shards, as debris');
  // A blast at its heart breaks another at once
  const b = d.addProp({ model: bin, material: 'steel', position: [10, 0, 0] })!;
  d.explode({ at: [10, 0.25, 0.6], radius: 2 });
  assert.equal(b.state, 'gone');
  // One without shards is thrown whole
  const plain = d.addProp({ model: { ...bin, name: 'plain', shards: undefined }, material: 'steel', position: [20, 0, 0] })!;
  d.explode({ at: [20, 0.25, 0.6], radius: 2 });
  assert.equal(plain.state, 'loose');
});
