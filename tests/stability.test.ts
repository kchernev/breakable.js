import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as THREE from 'three/webgpu';
import { Destruction, type Piece, presets, type PropModel, quatFromAxisAngle, type StateEvent, type V3 } from '../src/lib/index.ts';
import { asWorld, type FakeBody, FakeWorld } from './fake-world.ts';

function make(options: { ground?: number | null; killBelow?: number } = {}) {
  const w = new FakeWorld();
  const d = new Destruction({ world: asWorld(w), frameBudget: Infinity, materials: { brick: presets.brick(), concrete: presets.concrete(), wood: presets.wood() }, ...options });
  return { w, d };
}
const body = (p: Piece) => p.body as unknown as FakeBody;
/** Frames of `dt`, letting each readback land. */
async function run(d: Destruction, seconds: number, dt = 0.1) {
  for (let t = 0; t < seconds; t += dt) {
    d.update(dt);
    await new Promise((r) => setImmediate(r));
  }
}
const JAMMED = 1 << 30;

test('a piece at rest over what it rests on freezes, and wakes when that goes', async () => {
  const { d } = make();
  const wall = d.addBox({ material: 'brick', size: [1, 2, 0.4], position: [0, 1, 0] })!;
  const block = d.addBox({ material: 'brick', size: [0.6, 0.3, 0.3], position: [0.1, 2.15, 0], loose: true })!;
  await run(d, 1.5);
  assert.equal(block.state, 'rubble');
  d.removePiece(wall);
  assert.equal(block.state, 'loose', 'what it rested on went: it wakes');
});

test('rubble wakes when what it rests on comes loose, and so does what rests on it', async () => {
  const { d } = make();
  const wall = d.addBox({ material: 'brick', size: [1, 2, 0.4], position: [0, 1, 0] })!;
  const low = d.addBox({ material: 'brick', size: [0.6, 0.3, 0.3], position: [0, 2.15, 0], loose: true })!;
  const high = d.addBox({ material: 'brick', size: [0.4, 0.2, 0.2], position: [0, 2.4, 0], loose: true })!;
  await run(d, 2);
  assert.equal(low.state, 'rubble');
  assert.equal(high.state, 'rubble');
  d.loosen(wall, [1, 0, 0]);
  assert.equal(low.state, 'loose');
  assert.equal(high.state, 'loose', 'resting on rubble that woke');
});

test('a piece jammed between standing neighbours, nothing under it, stays loose and drops clear of them', async () => {
  const { d } = make({ ground: null });
  // Two static pillars 0.5 m apart, a block jammed between them
  const left = d.addBox({ material: 'brick', size: [0.5, 2, 0.5], position: [-0.5, 4, 0], static: true })!;
  const right = d.addBox({ material: 'brick', size: [0.5, 2, 0.5], position: [0.5, 4, 0], static: true })!;
  const block = d.addBox({ material: 'brick', size: [0.5, 0.5, 0.5], position: [0, 4, 0], loose: true })!;
  await run(d, 2);
  assert.equal(block.state, 'loose', "it isn't held up: it doesn't freeze");
  assert.equal(body(block).group, JAMMED, 'it passes through what it is jammed against');
  assert.equal(body(left).collidesWith & JAMMED, 0);
  assert.equal(body(right).collidesWith & JAMMED, 0);
  // Once it has dropped clear of them, they collide again
  body(block).position = [0, 1, 0];
  await run(d, 0.3);
  assert.notEqual(body(block).group, JAMMED);
  assert.notEqual(body(left).collidesWith & JAMMED, 0);
});

test('a piece creeping on slowly does not freeze until it stops', async () => {
  const { d } = make();
  const block = d.addBox({ material: 'brick', size: [0.5, 0.5, 0.5], position: [0, 0.25, 0], loose: true })!;
  body(block).velocity = [0.1, 0, 0];
  for (let k = 0; k < 20; k++) {
    const [x, y, z] = body(block).position;
    body(block).position = [x + 0.01, y, z];
    await run(d, 0.1);
  }
  assert.equal(block.state, 'loose', 'slow, but it moved on 20 cm');
  body(block).velocity = [0, 0, 0];
  await run(d, 1.5);
  assert.equal(block.state, 'rubble');
});

test('a plank leaning against a wall comes to rest there, and wakes when the wall goes', async () => {
  const { d } = make();
  const wall = d.addBox({ material: 'brick', size: [0.4, 3, 1], position: [0.2, 1.5, 0] })!;
  // A plank 2 m long, leaning 20° toward the wall, its top edge against it and its foot on the ground
  const q = quatFromAxisAngle([0, 0, 1], -0.35);
  const plank = d.addBox({ material: 'wood', size: [0.08, 2, 0.3], position: [0, 0, 0], rotation: q, loose: true })!;
  const b = plank.bounds;
  plank.body.set({ position: [-b.max[0] - 0.001, -b.min[1] - 0.001, 0] });
  plank.moved({ position: plank.body.position as V3, rotation: q });
  await run(d, 1.5);
  assert.equal(plank.state, 'rubble');
  assert.ok(plank.under.includes(wall), 'it rests on what it leans on');
  d.removePiece(wall);
  assert.equal(plank.state, 'loose', 'what it leaned on went: it wakes');
});

test('a block wedged between rubble settles there, and wakes when what wedged it goes', async () => {
  const { d } = make({ ground: null });
  // Two blocks come to rest on posts, a block's width apart; a block between them, on nothing
  d.addBox({ material: 'brick', size: [0.4, 1, 0.5], position: [-0.55, 3.25, 0], static: true });
  d.addBox({ material: 'brick', size: [0.4, 1, 0.5], position: [0.55, 3.25, 0], static: true });
  const left = d.addBox({ material: 'brick', size: [0.5, 0.5, 0.5], position: [-0.5, 4, 0], loose: true })!;
  const right = d.addBox({ material: 'brick', size: [0.5, 0.5, 0.5], position: [0.5, 4, 0], loose: true })!;
  await run(d, 1.5);
  assert.equal(left.state, 'rubble');
  const block = d.addBox({ material: 'brick', size: [0.5, 0.5, 0.5], position: [0, 4, 0], loose: true })!;
  // Jammed, it passes through them; still there after a while (held by something unseen), it settles
  await run(d, 7);
  assert.equal(block.state, 'rubble');
  assert.ok(block.under.includes(left) && block.under.includes(right));
  d.removePiece(left);
  assert.equal(block.state, 'loose', 'what wedged it went: it wakes');
  assert.equal(right.state, 'rubble', 'what it was wedged against stays');
});

test('a piece on one still moving does not settle there until that has stopped', async () => {
  const { d } = make({ ground: null });
  const low = d.addBox({ material: 'brick', size: [0.5, 0.5, 0.5], position: [0, 1.25, 0], loose: true })!;
  const high = d.addBox({ material: 'brick', size: [0.4, 0.4, 0.4], position: [0, 1.7, 0], loose: true })!;
  // The one under it is moving (so it holds nothing up), though the stand-in world leaves it where it is
  body(low).velocity = [0.5, 0, 0];
  await run(d, 5);
  assert.equal(low.state, 'loose');
  assert.equal(high.state, 'loose', 'not settled on something moving');
  // Stopped (held by something unseen), it settles; and then what's on it rests on it
  body(low).velocity = [0, 0, 0];
  await run(d, 5);
  assert.equal(low.state, 'rubble');
  assert.equal(high.state, 'rubble');
  assert.ok(high.under.includes(low));
});

test('a section at rest that nothing holds up as one comes apart at its joints', async () => {
  const { d } = make();
  const pillar = d.addBox({ material: 'brick', size: [0.5, 2, 0.5], position: [0, 1, 0] })!;
  // Two blocks joined end to end, only the first over the pillar: not bonded to it, they drop as one
  const a = d.addBox({ material: 'brick', size: [0.5, 0.4, 0.5], position: [0, 2.2, 0], bond: false })!;
  const b = d.addBox({ material: 'brick', size: [1, 0.4, 0.5], position: [0.75, 2.2, 0], bond: false })!;
  d.bond(a, b, 0.2);
  let broke = 0;
  d.on('bondBreak', () => broke++);
  d.update(0.1);
  assert.equal(a.state, 'loose');
  assert.ok(body(b).velocity[1] < 0, 'let go, it turns over the pillar: its far end goes down');
  // Stopped where it is (jammed, say): it rests on the pillar at one end only
  for (const p of [a, b]) Object.assign(body(p), { velocity: [0, 0, 0], angularVelocity: [0, 0, 0] });
  await run(d, 2.5);
  assert.ok(broke >= 1, 'its joint gave');
  assert.equal(a.bonds.size, 0);
  assert.equal(a.state, 'rubble', 'over the pillar: it rests there');
  assert.equal(b.state, 'loose', 'out over nothing: it does not');
  assert.ok(a.under.includes(pillar));
});

test('pieces that came to rest joined keep their bond, and a push wakes them together', async () => {
  const { w, d } = make();
  const a = d.addBox({ material: 'brick', size: [0.5, 0.4, 0.5], position: [0, 3, 0], bond: false })!;
  const b = d.addBox({ material: 'brick', size: [0.5, 0.4, 0.5], position: [0.5, 3, 0], bond: false })!;
  d.bond(a, b, 0.2);
  d.update(0.1);
  assert.equal(a.state, 'loose', 'standing on nothing: it drops as a section');
  // It lands on the ground
  for (const p of [a, b]) {
    const [x, , z] = body(p).position;
    p.body.set({ position: [x, 0.2, z] });
  }
  await run(d, 1.5);
  assert.equal(a.state, 'rubble');
  assert.equal(b.state, 'rubble');
  assert.equal(a.bonds.size, 1, 'the bond is kept');
  const joints = w.joints.filter((j) => !j.removed).length;
  assert.ok(d.push(a, [2, 0, 0]));
  assert.equal(b.state, 'loose', 'woken with it');
  assert.equal(w.joints.filter((j) => !j.removed).length, joints + 1, 'joined again');
  // As one body: both move the same way
  const [va, vb] = [body(a).velocity, body(b).velocity];
  assert.ok(va[0] > 0.5 && vb[0] > 0.5, `${va} ${vb}`);
});

test('a blast reaching part of a section at rest throws all of it', async () => {
  const { d } = make();
  const parts = [0, 1, 2].map((i) => d.addBox({ material: 'brick', size: [0.5, 0.4, 0.5], position: [i * 0.5, 0.2, 0], loose: true })!);
  d.bond(parts[0], parts[1], 0.2);
  d.bond(parts[1], parts[2], 0.2);
  await run(d, 1.5);
  assert.ok(parts.every((p) => p.state === 'rubble'));
  // Only the far end is within the blast's reach (and none in its heart)
  d.explode({ at: [2, 0.2, 0], radius: 1.4, speed: 6 });
  assert.ok(parts.every((p) => p.state === 'loose'));
  assert.ok(parts.every((p) => body(p).velocity[0] < -0.1), 'all of it pushed away from the blast');
});

test('reweigh and unbond: cutting a bond from outside brings down what it held', async () => {
  const { d } = make();
  d.addBox({ material: 'brick', size: [0.3, 3, 1], position: [0, 1.5, 0] });
  const beam = d.addBox({ material: 'concrete', size: [1, 0.3, 0.3], position: [0.65, 2.5, 0] })!;
  d.reinforce();
  await run(d, 0.3);
  assert.equal(beam.state, 'fixed');
  d.unbond([...beam.bonds][0]);
  await run(d, 0.3);
  assert.equal(beam.state, 'loose');
  // A bond weakened from outside: weighed again on asking
  const shelf = d.addBox({ material: 'concrete', size: [1, 0.3, 0.3], position: [0.65, 1, 0] })!;
  await run(d, 0.3);
  assert.equal(shelf.state, 'fixed');
  for (const b of shelf.bonds) b.strength = 0.001;
  await run(d, 0.3);
  assert.equal(shelf.state, 'fixed', 'not weighed yet');
  d.reweigh();
  await run(d, 0.3);
  assert.equal(shelf.state, 'loose');
});

test('loosen, release and push set pieces moving whole; state events say so', async () => {
  const { w, d } = make();
  const events: StateEvent[] = [];
  d.on('state', (e) => events.push(e));
  const base = d.addBox({ material: 'brick', size: [1, 1, 1], position: [0, 0.5, 0] })!;
  const top = d.addBox({ material: 'brick', size: [1, 1, 1], position: [0, 1.5, 0] })!;
  d.loosen(top, [0, 0, 3], [0, 1, 0]);
  assert.equal(top.state, 'loose');
  assert.deepEqual(body(top).velocity, [0, 0, 3]);
  assert.equal(base.bonds.size, 0, 'cut from what it stood on');
  assert.deepEqual(events.map((e) => [e.from, e.to]), [['fixed', 'loose']]);
  assert.ok(d.loosePieces.has(top));
  // Two standing together, let go as one section
  const a = d.addBox({ material: 'brick', size: [1, 1, 1], position: [5, 0.5, 0] })!;
  const b = d.addBox({ material: 'brick', size: [1, 1, 1], position: [5, 1.5, 0] })!;
  d.release([a, b], [1, 0, 0]);
  assert.equal(a.state, 'loose');
  assert.ok(w.joints.some((j) => !j.removed && ((j.a === body(a) && j.b === body(b)) || (j.a === body(b) && j.b === body(a)))), 'joined');
  assert.deepEqual(body(b).velocity, [1, 0, 0]);
  // A push on a loose piece is an impulse; a standing one isn't pushed
  assert.ok(d.push(top, [1, 0, 0]));
  assert.equal(body(top).impulses.length, 1);
  assert.equal(d.push(base, [1, 0, 0]), false);
});

test('loose pieces below killBelow are taken out of the world', async () => {
  const { d } = make({ killBelow: -5 });
  const p = d.addBox({ material: 'brick', size: [0.3, 0.3, 0.3], position: [0, -4, 0], loose: true })!;
  await run(d, 0.3);
  assert.equal(p.state, 'loose');
  p.body.set({ position: [0, -6, 0] });
  await run(d, 0.3);
  assert.equal(p.state, 'gone');
});

test('blasts and hits share one breaking budget a frame: what is over waits for the next frames', async () => {
  const { d } = make();
  for (let i = 0; i < 4; i++) d.addBox({ material: 'brick', size: [1, 1, 0.3], position: [i * 3, 0.5, 0] });
  d.frameBudget = 0;
  d.update(0.016);
  const results = [0, 1, 2, 3].map((i) => d.hit([i * 3, 0.5, 0.2], 0.4));
  assert.ok(results.every((r) => !r.done && r.broken === 0), 'nothing broken at once: the frame has no budget');
  d.frameBudget = Infinity;
  d.update(0.016);
  assert.ok(results.every((r) => r.done && r.broken === 1), 'broken at the next frame');
});

test("a reinforced bond's extra strength is for its load as built: asked for more, it gives", async () => {
  const { d } = make();
  d.addBox({ material: 'brick', size: [0.3, 3, 1], position: [0, 1.5, 0] });
  // Too long for its side bond: it stands only as reinforced
  const beam = d.addBox({ material: 'concrete', size: [4, 0.3, 0.3], position: [2.15, 2.5, 0] })!;
  d.reinforce();
  // A third more weight on it: within the 1.5 margin it was strengthened to, but not as built
  d.addBox({ material: 'concrete', size: [1.3, 0.3, 0.3], position: [2.15, 2.8, 0] });
  d.reweigh();
  await run(d, 0.5);
  assert.equal(beam.state, 'loose');
});

test("a span whose weight has moved off what it stands on tips over the edge it's left on", async () => {
  const { d } = make();
  const left = d.addBox({ material: 'brick', size: [0.5, 2, 0.5], position: [0, 1, 0] })!;
  const right = d.addBox({ material: 'brick', size: [0.5, 2, 0.5], position: [3, 1, 0] })!;
  const span = d.addBox({ material: 'concrete', size: [3.5, 0.4, 0.5], position: [1.5, 2.2, 0] })!;
  d.reinforce();
  await run(d, 0.3);
  assert.equal(span.state, 'fixed');
  d.removePiece(right);
  await run(d, 0.3);
  assert.equal(span.state, 'loose', 'on one pillar, its weight 1.5 m out past it: it tips');
  // Turning over the pillar's edge, its free end going down: about -z
  assert.ok(body(span).angularVelocity[2] < -0.05, `${body(span).angularVelocity}`);
  assert.equal(left.state, 'fixed');
});

test('a span whose column now hangs from it (its foot gone) tips: a piece hanging from it carries none of it', async () => {
  const { d } = make();
  d.addBox({ material: 'brick', size: [0.5, 2, 0.5], position: [0, 1, 0] });
  const foot = d.addBox({ material: 'brick', size: [0.5, 1, 0.5], position: [3, 0.5, 0] })!;
  const column = d.addBox({ material: 'brick', size: [0.5, 1, 0.5], position: [3, 1.5, 0] })!;
  const span = d.addBox({ material: 'concrete', size: [3.5, 0.4, 0.5], position: [1.5, 2.2, 0] })!;
  d.reinforce();
  d.removePiece(foot);
  await run(d, 0.3);
  assert.equal(span.state, 'loose', 'on the left column only, its weight 1.5 m out past it');
  assert.equal(column.state, 'loose', 'and what hung from it goes with it');
});

test('a piece still squarely on one that stands does not tip, however many bonds that one is from the ground', async () => {
  const { d } = make();
  const box = (size: V3, position: V3) => d.addBox({ material: 'brick', size, position, bond: false })!;
  // A long block on a short one (on a post), its end bonded to the side of a wall piece (on a pier)
  const pier = box([0.5, 2.5, 0.25], [-0.25, 1.25, 0]);
  const wall = box([0.5, 0.25, 0.25], [-0.25, 2.625, 0]);
  const post = box([0.5, 2.25, 0.25], [0.6, 1.125, 0]);
  const under = box([0.5, 0.25, 0.25], [0.6, 2.375, 0]);
  const block = box([1.2, 0.25, 0.25], [0.6, 2.625, 0]);
  d.bond(pier, wall, 0.125);
  d.bond(post, under, 0.125);
  d.bond(under, block, 0.125);
  const side = d.bond(wall, block, 0.0625);
  // The short one is also bonded to a column behind it, on a footing
  const footing = box([0.5, 0.5, 0.25], [0.6, 0.25, 0.25]);
  const back = box([0.5, 2, 0.25], [0.6, 1.5, 0.25]);
  d.bond(footing, back, 0.125);
  d.bond(back, under, 0.0625);
  d.reinforce();
  // Its post gone, the short one holds on to the column behind: as many bonds from the ground as the block
  d.removePiece(post);
  d.weigh();
  assert.ok(side.load <= 1, `the side bond carries the block whole, not as a lever: ${side.load}`);
  await run(d, 0.3);
  assert.equal(block.state, 'fixed');
  assert.ok(block.bonds.has(side));
});

test('a cornice that stands as built does not tip after damage elsewhere', async () => {
  const { d } = make();
  const wall: Piece[] = [];
  for (let x = 0; x < 6; x++) for (let y = 0; y < 4; y++) wall.push(d.addBox({ material: 'brick', size: [0.5, 0.5, 0.3], position: [x * 0.5, y * 0.5 + 0.25, 0] })!);
  // Each stone out 0.5 m from the wall's face, held only at its back (and to the next)
  const cornice = [0, 1, 2, 3, 4, 5].map((x) => d.addBox({ material: 'concrete', size: [0.5, 0.2, 0.5], position: [x * 0.5, 1.9, 0.4] })!);
  d.reinforce();
  // Elsewhere: the wall's bottom corner, and a piece under the middle of the cornice row
  d.removePiece(wall[0]);
  d.removePiece(wall[3 * 4 + 1]);
  const over = d.weigh();
  assert.ok(!over.some((b) => cornice.includes(b.a) || cornice.includes(b.b)), 'its bonds hold');
  await run(d, 0.5);
  assert.ok(cornice.every((p) => p.state === 'fixed'));
});

test('small rubble that came to rest joined is not cleared; taken out, what rested joined to it wakes', async () => {
  const w = new FakeWorld();
  const d = new Destruction({ world: asWorld(w), frameBudget: Infinity, materials: { brick: presets.brick({ rubbleLife: 1 }) } });
  const s = d.materials.brick.dustSize * 1.5;
  d.addBox({ material: 'brick', size: [0.6, 2, 0.6], position: [0, 1, 0], static: true });
  // A block on a post; a small one bonded to its side, out over nothing; a block hung off that
  const big = d.addBox({ material: 'brick', size: [0.6, 0.6, 0.6], position: [0, 2.3, 0], loose: true })!;
  const small = d.addBox({ material: 'brick', size: [s, s, s], position: [0.3 + s / 2, 2.3, 0], loose: true })!;
  const hung = d.addBox({ material: 'brick', size: [0.4, 0.4, 0.4], position: [0.5 + s, 2.3, 0], loose: true })!;
  d.bond(big, small, s * s);
  d.bond(small, hung, s * s);
  await run(d, 1.5);
  assert.ok([big, small, hung].every((p) => p.state === 'rubble'), 'at rest as one, held by the post');
  await run(d, 2);
  assert.equal(small.state, 'rubble', 'small, but what hangs from it would be left in the air');
  d.removePiece(small);
  assert.equal(hung.state, 'loose', 'what it held wakes');
  assert.equal(big.state, 'loose');
  // Woken, what's held comes to rest again; what isn't, doesn't
  await run(d, 1.5);
  assert.equal(big.state, 'rubble');
  assert.equal(hung.state, 'loose');
});

test('rubble loosened whole wakes what rested joined to it', async () => {
  const { d } = make();
  const parts = [0, 1, 2].map((i) => d.addBox({ material: 'brick', size: [0.5, 0.4, 0.5], position: [i * 0.5, 0.2, 0], loose: true })!);
  d.bond(parts[0], parts[1], 0.2);
  d.bond(parts[1], parts[2], 0.2);
  await run(d, 1.5);
  assert.ok(parts.every((p) => p.state === 'rubble'));
  d.loosen(parts[1], [0, 3, 0]);
  assert.ok(parts.every((p) => p.state === 'loose'));
  assert.equal(parts[1].bonds.size, 0);
  assert.deepEqual(body(parts[0]).velocity, [0, 0, 0], 'woken, not thrown');
});

test('a blast tearing out the heart of rubble at rest throws each part left by its own pieces', async () => {
  const { d } = make();
  const parts = [-1, 0, 1].map((i) => d.addBox({ material: 'brick', size: [0.5, 0.4, 0.5], position: [i * 0.5, 0.2, 0], loose: true })!);
  d.bond(parts[0], parts[1], 0.2);
  d.bond(parts[1], parts[2], 0.2);
  await run(d, 1.5);
  assert.ok(parts.every((p) => p.state === 'rubble'));
  // At the middle one: it's in the blast's heart, the ends aren't
  d.explode({ at: [0, 0.2, 0.3], radius: 0.9, speed: 12, spin: 0 });
  const [l, , r] = parts.map((p) => body(p).velocity);
  assert.equal(parts[1].bonds.size, 0, 'torn out');
  assert.ok(l[0] < -1 && r[0] > 1, `the ends fly apart, away from it: ${l} ${r}`);
});

test('a blast reaching part of a loose section raises the rest to their share of its push', async () => {
  const { d } = make();
  const parts = [0, 1, 2].map((i) => d.addBox({ material: 'brick', size: [0.5, 0.4, 0.5], position: [i * 0.5, 2, 0], loose: true })!);
  d.bond(parts[0], parts[1], 0.2);
  d.bond(parts[1], parts[2], 0.2);
  // As with a GPU: the push on the pieces in its reach is BlastPass's (here, none)
  (d as unknown as { blast: unknown }).blast = { run() {} };
  // The far end is already going that way faster than its share
  body(parts[2]).velocity = [20, 0, 0];
  d.explode({ at: [-0.8, 2, 0], radius: 0.6, speed: 6 });
  assert.equal(body(parts[0]).impulses.length, 0, 'in reach: the GPU pushes it');
  const [pushed] = body(parts[1]).impulses;
  assert.ok(pushed && pushed[0] > 0, `the rest of it, away from the blast: ${pushed}`);
  assert.equal(body(parts[2]).impulses.length, 0, 'raised to its share, not added to');
  // Without a GPU push nothing is pushed at all
  const other = make().d;
  const lone = [0, 1].map((i) => other.addBox({ material: 'brick', size: [0.5, 0.4, 0.5], position: [i * 0.5, 2, 0], loose: true })!);
  other.bond(lone[0], lone[1], 0.2);
  other.explode({ at: [-0.8, 2, 0], radius: 0.6, speed: 6 });
  assert.equal(body(lone[1]).impulses.length, 0);
});

test('a push on a loose piece of a section moves the section as one', () => {
  const { d } = make();
  const parts = [0, 1, 2].map((i) => d.addBox({ material: 'brick', size: [0.5, 0.4, 0.5], position: [i * 0.5, 2, 0], loose: true })!);
  d.bond(parts[0], parts[1], 0.2);
  d.bond(parts[1], parts[2], 0.2);
  assert.ok(d.push(parts[1], [3, 0, 0]));
  const impulses = parts.map((p) => body(p).impulses[0]);
  assert.ok(impulses.every((i) => i && Math.abs(i[0] - parts[1].mass) < 1e-6), `each its share: ${impulses}`);
});

test("a prop's parts jammed together drop clear together, then get their collision groups back", async () => {
  const { d } = make({ ground: null });
  const left = d.addBox({ material: 'brick', size: [0.5, 2, 0.5], position: [-0.5, 4, 0], static: true })!;
  const box = (c: V3): V3[] => [-1, 1].flatMap((x) => [-1, 1].flatMap((y) => [-1, 1].map((z) => [c[0] + x * 0.25, c[1] + y * 0.25, c[2] + z * 0.25] as V3)));
  const model: PropModel = { object: new THREE.Object3D(), collider: [], colliders: [box([0, 0.25, 0]), box([0, 0.75, 0])], mass: 10 };
  d.addBox({ material: 'brick', size: [0.5, 2, 0.5], position: [0.5, 4, 0], static: true });
  const low = d.addProp({ model, material: 'brick', position: [0, 3.5, 0], loose: true })!;
  const high = [...d.loosePieces].find((p) => p !== low)!;
  await run(d, 1.5);
  assert.ok(body(low).group === JAMMED && body(high).group === JAMMED);
  // The lower part drops clear first: both pass through until both have
  body(low).position = [0, 1.5, 0];
  low.moved({ position: body(low).position, rotation: body(low).rotation });
  await run(d, 0.5);
  assert.ok(body(low).group === JAMMED && body(high).group === JAMMED, 'the upper part is still between the pillars');
  body(high).position = [0, 1, 0];
  await run(d, 0.5);
  assert.ok(body(low).group === 1 && body(high).group === 1);
  assert.notEqual(body(left).collidesWith & JAMMED, 0, 'the pillar collides with jammed pieces again');
});

test('pieces rest on scenery, not on a hinge holder (it collides with nothing) or scenery removed since', async () => {
  const { w, d } = make({ ground: null });
  w.addBox({ size: [2, 1, 2], position: [0, 0.5, 0], fixed: true });
  const slab = w.addBox({ size: [1, 0.2, 1], position: [10, 1, 0], fixed: true });
  const onStep = d.addBox({ material: 'brick', size: [0.5, 0.5, 0.5], position: [0, 1.25, 0], loose: true })!;
  const sign = d.addBox({ material: 'brick', size: [0.6, 0.4, 0.05], position: [5, 2.7, 0] })!;
  d.hinge(sign, [5, 3, 0], [1, 0, 0]);
  const onHolder = d.addBox({ material: 'brick', size: [0.3, 0.3, 0.3], position: [5, 3.15, 0], loose: true })!;
  await run(d, 1.5);
  assert.equal(onStep.state, 'rubble');
  assert.equal(onHolder.state, 'loose');
  slab.remove();
  const onSlab = d.addBox({ material: 'brick', size: [0.3, 0.3, 0.3], position: [10, 1.25, 0], loose: true })!;
  await run(d, 1.5);
  assert.equal(onSlab.state, 'loose');
});

test('blasts fired before an update draw on the same budget as its breaking', async () => {
  const { d } = make();
  for (let i = 0; i < 40; i++) d.addBox({ material: 'brick', size: [1, 1, 0.3], position: [i * 3, 0.5, 0] });
  d.frameBudget = 30;
  // A clock that moves on a millisecond each time it's read
  const real = performance.now;
  let t = 0;
  performance.now = () => (t += 1);
  try {
    d.update(0.016);
    const results = Array.from({ length: 40 }, (_, i) => d.hit([i * 3, 0.5, 0.2], 0.4));
    const broken = () => results.filter((r) => r.broken).length;
    const first = broken();
    assert.ok(first > 0 && first < 40, `the frame's budget broke some: ${first}`);
    d.update(0.016);
    assert.equal(broken(), first, 'and the update in the same frame breaks no more');
    d.update(0.016);
    assert.ok(broken() > first, 'the next frame does');
  } finally {
    performance.now = real;
  }
});
