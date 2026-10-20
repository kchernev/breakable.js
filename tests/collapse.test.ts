import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as THREE from 'three/webgpu';
import { Destruction, type DestructionOptions, type Piece, presets, type PropModel, quatFromAxisAngle, type V3 } from '../src/lib/index.ts';
import { asWorld, type FakeBody, FakeWorld } from './fake-world.ts';

function make(options: Partial<DestructionOptions> = {}) {
  const w = new FakeWorld();
  const d = new Destruction({ world: asWorld(w), frameBudget: Infinity, materials: { brick: presets.brick(), concrete: presets.concrete(), glass: presets.glass(), wood: presets.wood(), clearGlass: presets.glass({ keepSmall: true }) }, ...options });
  return { w, d };
}
const body = (p: Piece) => p.body as unknown as FakeBody;
/** Frames of `dt`, letting each readback land. */
async function run(d: Destruction, seconds: number, dt = 0.1, each?: () => void) {
  for (let t = 0; t < seconds; t += dt) {
    each?.();
    d.update(dt);
    await new Promise((r) => setImmediate(r));
  }
}
const box = (c: V3, h = 0.25): V3[] => [-1, 1].flatMap((x) => [-1, 1].flatMap((y) => [-1, 1].map((z): V3 => [c[0] + x * h, c[1] + y * h, c[2] + z * h])));

test('a sign hanging still on its hinge is hanging, not loose; the loose cap leaves it and props', async () => {
  const { d } = make({ maxLoose: 6 });
  const wall = d.addBox({ material: 'brick', size: [0.4, 4, 2], position: [0, 2, 0] })!;
  const bracket = d.addBox({ material: 'wood', size: [1, 0.1, 0.1], position: [0.7, 3.5, 0] })!;
  const sign = d.addBox({ material: 'wood', size: [0.6, 0.4, 0.04], position: [0.8, 3.2, 0] })!;
  const lettering = d.addBox({ material: 'wood', size: [0.2, 0.1, 0.01], position: [0.8, 3.2, 0.025] })!;
  d.release([sign, lettering]);
  d.hinge(sign, [0.8, 3.44, 0], [1, 0, 0], { to: bracket });
  const model: PropModel = { object: new THREE.Object3D(), collider: box([0, 0, 0], 0.05), mass: 0.1 };
  const crate = d.addProp({ model, material: 'wood', position: [3, 3, 0], loose: true })!;
  await run(d, 1.5);
  assert.equal(sign.state, 'loose', 'it swings: never frozen');
  assert.equal(d.stats.hanging, 2, 'the sign and its lettering');
  assert.equal(d.stats.loose, 1, 'still on its hinge, it is not counted loose (the prop in the air is)');
  // Loose pieces past the cap: the smallest go, but not the sign's lettering (smaller still), nor the prop
  const chips = [0.14, 0.12, 0.1, 0.11, 0.13, 0.15].map((s, i) => d.addBox({ material: 'brick', size: [s, s, s], position: [5 + i, 5, 0], loose: true })!);
  d.update(0.01);
  assert.equal(lettering.state, 'loose');
  assert.equal(crate.state, 'loose');
  assert.deepEqual(
    chips.map((c) => c.state),
    ['loose', 'gone', 'gone', 'gone', 'loose', 'loose'],
    '9 loose over the cap of 6: the three smallest chips go',
  );
  assert.equal(wall.state, 'fixed');
});

test('a sign fallen with what it hangs from comes to rest, and wakes with it', async () => {
  const { d } = make();
  d.addBox({ material: 'brick', size: [0.4, 4, 2], position: [0, 2, 0] });
  const bracket = d.addBox({ material: 'wood', size: [1, 0.1, 0.1], position: [0.7, 3.5, 0] })!;
  const sign = d.addBox({ material: 'wood', size: [0.6, 0.4, 0.04], position: [0.8, 3.2, 0] })!;
  d.hinge(sign, [0.8, 3.44, 0], [1, 0, 0], { to: bracket });
  // The bracket comes down, and both lie on the ground
  d.loosen(bracket);
  for (const [p, y] of [[bracket, 0.05], [sign, 0.02]] as const) {
    p.body.set({ position: [p.pose.position[0], y, p.pose.position[2]], rotation: [0, 0, 0, 1] });
  }
  sign.body.set({ rotation: quatFromAxisAngle([1, 0, 0], Math.PI / 2) });
  await run(d, 1.5);
  assert.equal(bracket.state, 'rubble');
  assert.equal(sign.state, 'rubble', 'it hangs from nothing that stands: it rests');
  assert.equal(d.stats.hanging, 0);
  d.push(bracket, [1, 0, 0]);
  assert.equal(sign.state, 'loose', 'what its hinge holds it to moved: it wakes');
});

test('a chain hung link by link hangs whole: none of it frozen in the air or counted loose; felled, it all rests', async () => {
  const { d } = make({ maxLoose: 4 });
  d.addBox({ material: 'brick', size: [0.4, 4, 2], position: [0, 2, 0] });
  const bracket = d.addBox({ material: 'wood', size: [1, 0.1, 0.1], position: [0.7, 3.5, 0] })!;
  const link1 = d.addBox({ material: 'wood', size: [0.05, 0.3, 0.05], position: [1, 3.25, 0], bond: false })!;
  const link2 = d.addBox({ material: 'wood', size: [0.05, 0.3, 0.05], position: [1, 2.9, 0], bond: false })!;
  // A lantern small enough to be swept away as small rubble (glass: under 2 × its dustSize)
  const lantern = d.addBox({ material: 'glass', size: [0.3, 0.4, 0.3], position: [1, 2.5, 0], bond: false })!;
  d.reinforce();
  d.hinge(link1, [1, 3.42, 0], [0, 0, 1], { to: bracket });
  d.hinge(link2, [1, 3.07, 0], [0, 0, 1], { to: link1 });
  d.hinge(lantern, [1, 2.72, 0], [0, 0, 1], { to: link2 });
  const chain = [link1, link2, lantern];
  // Loose pieces past the cap of 4: the smallest chip goes, not the chain's links (smaller still)
  const chips = [0.14, 0.12].map((s, i) => d.addBox({ material: 'brick', size: [s, s, s], position: [5 + i, 0.07, 0], loose: true })!);
  d.update(0.01);
  assert.deepEqual(chips.map((c) => c.state), ['loose', 'gone']);
  // The lantern sways a little all the while (never still, never moving on)
  await run(d, 12, 0.1, () => (body(lantern).velocity = [0.25, 0, 0]));
  assert.deepEqual(chain.map((p) => p.state), ['loose', 'loose', 'loose'], 'all of it hangs and swings');
  assert.equal(d.stats.hanging, 3);
  assert.equal(d.stats.loose, 0, 'hanging at rest, the chain is not counted loose');
  // The bracket comes down, and the chain lies on the ground: it all rests, the lantern kept as it's held
  d.loosen(bracket);
  for (const [p, y] of [[bracket, 0.05], [link1, 0.025], [link2, 0.025], [lantern, 0.15]] as const) p.body.set({ position: [p.pose.position[0], y, p.pose.position[2]], rotation: [0, 0, 0, 1] });
  for (const p of [link1, link2]) p.body.set({ rotation: quatFromAxisAngle([0, 0, 1], Math.PI / 2) });
  await run(d, 8);
  assert.deepEqual(chain.map((p) => p.state), ['rubble', 'rubble', 'rubble'], 'hung from what has fallen, it rests');
  assert.equal(d.stats.hanging, 0);
  d.push(bracket, [1, 0, 0]);
  assert.equal(link1.state, 'loose', 'what its hinge holds it to moved: it wakes');
});

test('glass cells too small to be bodies are particles wherever they are; a material may keep them standing', () => {
  for (const material of ['glass', 'clearGlass']) {
    const { d } = make();
    d.addBox({ material: 'brick', size: [2, 1, 0.3], position: [0, 0.5, 0] });
    // A pane on a sill, its far end beyond the blast's reach (glass: 3 times its radius)
    const pane = d.addBox({ material, size: [4, 1.2, 0.03], position: [0, 1.6, 0] })!;
    let debris = 0;
    d.on('debris', () => debris++);
    d.explode({ at: [-1.8, 1.6, 0.3], radius: 0.4 });
    assert.equal(pane.state, 'gone');
    const shards = d.all().filter((p) => p.materialName === material);
    const small = shards.filter((p) => p.size < p.material.minBodySize);
    assert.ok(debris > 0, `${material}: some shards fly as particles`);
    if (material === 'glass') assert.equal(small.length, 0, `glass: no shard under minBodySize is a body (${shards.length} left)`);
    else assert.ok(small.length > 0 && small.every((p) => p.state === 'fixed'), 'keepSmall: those beyond its reach stand');
  }
});

test('loose pieces flung far, or slid off the world, are taken out (killBeyond)', async () => {
  const { d } = make({ killBeyond: 100 });
  const near = d.addBox({ material: 'brick', size: [0.3, 0.3, 0.3], position: [50, 5, 50], loose: true })!;
  const far = d.addBox({ material: 'brick', size: [0.3, 0.3, 0.3], position: [80, 1, 80], loose: true })!;
  const high = d.addBox({ material: 'brick', size: [0.3, 0.3, 0.3], position: [0, 120, 0], loose: true })!;
  await run(d, 0.2);
  assert.equal(near.state, 'loose');
  assert.equal(far.state, 'gone', '113 m out');
  assert.equal(high.state, 'gone', '120 m up');
  assert.equal(make().d.killBeyond, 1000, 'default');
});

test('a pile at rest freezes in a few readbacks, held up piece on piece', async () => {
  const { d } = make();
  // 5 × 5 columns of 4 blocks, loose and at rest
  const pile: Piece[] = [];
  for (let i = 0; i < 5; i++) for (let j = 0; j < 5; j++) for (let k = 0; k < 4; k++) pile.push(d.addBox({ material: 'brick', size: [0.3, 0.3, 0.3], position: [i * 0.31, 0.15 + k * 0.3, j * 0.31], loose: true, bond: false })!);
  await run(d, 2);
  assert.equal(pile.filter((p) => p.state === 'loose').length, 0, 'all frozen within a second of being still');
  // The top of a column rests on the one under it, and wakes when it goes
  const [bottom, top] = [pile[0], pile[1]];
  assert.ok(top.under.includes(bottom) || bottom.carried?.has(top));
  d.removePiece(pile[0]);
  assert.equal(pile[1].state, 'loose');
});

test('the resting checks take 2 ms a frame: a big pile at rest freezes over several frames, each piece looked at once', async () => {
  const { d } = make();
  const pile: Piece[] = [];
  for (let i = 0; i < 45; i++) for (let j = 0; j < 45; j++) pile.push(d.addBox({ material: 'brick', size: [0.3, 0.3, 0.3], position: [i * 0.35, 0.15, j * 0.35], loose: true, bond: false })!);
  // Each frame's resting checks, and the sections they look for
  const inner = d as unknown as { rest(now: unknown): void; groupOf(p: Piece, state: string): Piece[] };
  const [rest, groupOf] = [inner.rest.bind(d), inner.groupOf.bind(d)];
  let [ms, resting, groups] = [0, false, 0];
  inner.rest = (now) => {
    const t = performance.now();
    resting = true;
    rest(now);
    resting = false;
    ms += performance.now() - t;
  };
  inner.groupOf = (p, state) => {
    if (resting) groups++;
    return groupOf(p, state);
  };
  const frames: number[] = [];
  await run(d, 2, 1 / 60, () => {
    frames.push(ms);
    ms = 0;
  });
  assert.equal(pile.filter((p) => p.state === 'loose').length, 0, 'all frozen');
  const busy = frames.filter((t) => t > 0).sort((a, b) => a - b);
  assert.ok(busy.length > 3, `over several frames (${busy.length})`);
  // (A frame now and then takes longer: the garbage collector's)
  assert.ok(busy[Math.floor(busy.length / 2)] < 2.2, `most frames within the budget (${busy.map((t) => t.toFixed(1)).join(' ')})`);
  assert.ok(groups < pile.length * 1.2, `not every frame over all that's at rest (${groups} sections looked for)`);
});

test('a piece held by what is nearest under it rests on that alone, and wakes only when that goes', async () => {
  const { d } = make();
  const near = d.addBox({ material: 'brick', size: [0.4, 0.4, 0.4], position: [0, 0.2, 0], loose: true, bond: false })!;
  const far = d.addBox({ material: 'brick', size: [0.4, 0.4, 0.4], position: [0.45, 0.2, 0], loose: true, bond: false })!;
  // Over both, its centre of mass over the nearer
  const top = d.addBox({ material: 'brick', size: [0.6, 0.2, 0.4], position: [0.1, 0.5, 0], loose: true, bond: false })!;
  await run(d, 1.5);
  assert.deepEqual([near, far, top].map((p) => p.state), ['rubble', 'rubble', 'rubble']);
  assert.deepEqual(top.under, [near], 'what held it was found first: no need to look further');
  d.removePiece(far);
  assert.equal(top.state, 'rubble');
  d.removePiece(near);
  assert.equal(top.state, 'loose');
});

test('a wedged piece waits on what moves under it, for a while at most', async () => {
  const { d } = make();
  d.addBox({ material: 'brick', size: [0.4, 0.4, 0.4], position: [0, 0.2, 0], loose: true, bond: false });
  // A plank on a block, its weight out past it, over a piece that keeps moving (back and forth, never still)
  const plank = d.addBox({ material: 'wood', size: [1.2, 0.1, 0.3], position: [0.55, 0.45, 0], loose: true, bond: false })!;
  const mover = d.addBox({ material: 'brick', size: [0.38, 0.38, 0.3], position: [0.95, 0.19, 0], loose: true, bond: false })!;
  let time = 0;
  const froze: number[] = [];
  d.on('state', (e) => e.piece === plank && e.to === 'rubble' && froze.push(time));
  const move = () => {
    time += 0.1;
    body(mover).set({ position: [Math.floor(time / 0.3) % 2 ? 1.07 : 0.95, 0.19, 0], velocity: [0.3, 0, 0] });
  };
  await run(d, 6, 0.1, move);
  assert.equal(plank.state, 'loose', 'at rest past SETTLE, it waits on what moves under it');
  await run(d, 4, 0.1, move);
  assert.ok(froze.length && froze[0] > 8.3 && froze[0] < 9.7, `it gives up waiting after 2.5 + 6 s (${froze[0]?.toFixed(1)})`);
  assert.equal(plank.state, 'loose', 'resting on what moves, it wakes when that moves on');
});

test('a piece jittering in place (its speed never still, it never moves on) comes to rest after a while', async () => {
  const { d } = make();
  const block = d.addBox({ material: 'brick', size: [0.5, 0.5, 0.5], position: [0, 0.25, 0], loose: true })!;
  let k = 0;
  await run(d, 5, 0.1, () => (body(block).velocity = [k++ % 2 ? 0.3 : -0.3, 0, 0]));
  assert.equal(block.state, 'loose', 'not still yet');
  await run(d, 2, 0.1, () => (body(block).velocity = [k++ % 2 ? 0.3 : -0.3, 0, 0]));
  assert.equal(block.state, 'rubble', 'it stayed where it was for 6 s');
});

test('a section at rest in part, its other end still moving, parts there', async () => {
  const { d } = make();
  const pieces = [0, 1, 2].map((i) => d.addBox({ material: 'brick', size: [0.5, 0.5, 0.5], position: [i * 0.5, 0.25, 0] })!);
  d.reinforce();
  d.release(pieces);
  // Its far end keeps moving on
  await run(d, 4, 0.1, () => {
    const b = body(pieces[2]);
    b.velocity = [0, 0, 0.3];
    b.position = [b.position[0], b.position[1], b.position[2] + 0.03];
  });
  assert.equal(pieces[0].state, 'rubble', 'its end at rest parts from the end still moving, and freezes');
  assert.equal(pieces[1].state, 'rubble');
  assert.equal(pieces[2].state, 'loose');
  assert.ok(![...pieces[1].bonds].some((b) => b.other(pieces[1]) === pieces[2]), 'their joint gave way');
});

test('a section come to rest sagging across a gap gives way at the joint bent open, and its halves do not hold each other up', async () => {
  const { d } = make({ ground: null });
  // Two posts 1.4 m apart, a beam of two blocks across them
  d.addBox({ material: 'brick', size: [0.4, 2, 0.4], position: [-0.9, 1, 0], static: true });
  d.addBox({ material: 'brick', size: [0.4, 2, 0.4], position: [0.9, 1, 0], static: true });
  const left = d.addBox({ material: 'brick', size: [1, 0.3, 0.4], position: [-0.5, 2.15, 0], bond: false })!;
  const right = d.addBox({ material: 'brick', size: [1, 0.3, 0.4], position: [0.5, 2.15, 0], bond: false })!;
  d.bond(left, right, 0.12, [0, 2.15, 0]);
  let broke = 0;
  d.on('bondBreak', () => broke++);
  d.release([left, right]);
  // It comes to rest in a V: each half turned 10° down to the middle
  const turn = 0.17;
  for (const [p, s] of [[left, 1], [right, -1]] as const) {
    const q = quatFromAxisAngle([0, 0, 1], -s * turn);
    body(p).rotation = q;
    body(p).position = [s * -0.5, 2.15 - 0.5 * Math.sin(turn), 0];
  }
  await run(d, 1.5);
  assert.equal(broke, 1, 'the joint at the middle gave way');
  assert.equal(left.state, 'loose', 'each half rests on one post only: not held');
  assert.equal(right.state, 'loose');
  // Propped on each other, neither lower: each drops through the other into the gap
  const JAMMED = 1 << 30;
  assert.equal(body(left).group, JAMMED);
  assert.equal(body(right).group, JAMMED);
  assert.equal(body(left).collidesWith & JAMMED, 0);
});

test('a slab propped at one end on a block no lower drops through it over a gap, not with the ground or a loose piece under it', async () => {
  const JAMMED = 1 << 30;
  for (const [under, drops] of [
    ['ground', false],
    ['gap', true],
    ['loose', false],
  ] as const) {
    const { d } = make({ ground: under === 'ground' ? 0 : null });
    // Its left end on a block (standing on the ground, or static over nothing), its right end against a tall block at rest
    if (under === 'ground') d.addBox({ material: 'brick', size: [0.4, 0.425, 0.4], position: [-0.5, 0.2125, 0], loose: true, bond: false });
    else {
      d.addBox({ material: 'brick', size: [0.4, 1, 0.4], position: [-0.5, -0.075, 0], static: true });
      d.addBox({ material: 'brick', size: [0.4, 1, 0.4], position: [0.8, -0.5, 0], static: true });
    }
    const block = d.addBox({ material: 'brick', size: [0.4, 1.2, 0.4], position: [0.8, 0.6, 0], loose: true, bond: false })!;
    const slab = d.addBox({ material: 'brick', size: [1.2, 0.1, 0.4], position: [0, 0.475, 0], loose: true, bond: false })!;
    // Or something still moving half a metre under its middle
    if (under === 'loose') d.addBox({ material: 'brick', size: [0.3, 0.3, 0.3], position: [0, -0.2, 0], loose: true, bond: false })!.body.set({ velocity: [0, 0, 0.5] });
    // Whether it ever passes through the block (here it's clear of it at once: nothing moves)
    let [dropped, passed] = [false, false];
    const [s, b] = [body(slab), body(block)];
    const [setS, setB] = [s.setCollisionGroups.bind(s), b.setCollisionGroups.bind(b)];
    s.setCollisionGroups = (group, mask) => ((dropped ||= group === JAMMED), setS(group, mask));
    b.setCollisionGroups = (group, mask = b.collidesWith) => ((passed ||= (mask & JAMMED) === 0), setB(group, mask));
    // (Looked at again once the block has frozen: a loose piece at rest props it only if it's over the gap too)
    await run(d, 4);
    assert.equal(block.state, 'rubble');
    assert.equal(dropped, drops, `${under}: ${drops ? 'drops through the block' : 'stays against it'}`);
    assert.equal(passed, drops);
  }
});

test('a section lying flat at rest keeps its joints, and freezes whole', async () => {
  const { d } = make();
  const pieces = [0, 1, 2].map((i) => d.addBox({ material: 'brick', size: [0.5, 0.5, 0.5], position: [i * 0.5, 0.25, 0] })!);
  d.reinforce();
  d.release(pieces);
  await run(d, 1.5);
  assert.ok(pieces.every((p) => p.state === 'rubble'));
  assert.equal(pieces[1].bonds.size, 2, 'joined as it rested');
});

/** Three bricks in a row, falling as one section 3 m up over a ground body. */
function falling() {
  const { w, d } = make();
  const ground = w.addBox({ size: [20, 1, 20], position: [0, -0.5, 0], fixed: true });
  const pieces = [0, 1, 2].map((i) => d.addBox({ material: 'brick', size: [0.6, 0.3, 0.3], position: [i * 0.6, 3, 0] })!);
  d.update(0.1);
  assert.ok(pieces.every((p) => p.state === 'loose'), 'nothing holds it: it falls as one');
  const joined = (a: Piece, b: Piece) => [...a.bonds].some((bond) => bond.other(a) === b && bond.joint);
  const strike = (p: Piece, speed: number) => w.contact({ a: body(p), b: ground, normal: [0, 1, 0], impulse: speed * p.mass });
  return { d, pieces, joined, strike };
}

test('a section landing flat and hard cracks at its joints; one landing at a few m/s does not', async () => {
  for (const [speed, cracks] of [
    [4, false],
    [12, true],
  ] as const) {
    const { d, pieces, joined, strike } = falling();
    // Falling at `speed`, as the readback says; then it strikes the ground all along
    for (const p of pieces) body(p).velocity = [0, -speed, 0];
    await run(d, 0.1);
    for (const p of pieces) strike(p, speed);
    await run(d, 0.1);
    assert.deepEqual([joined(pieces[0], pieces[1]), joined(pieces[1], pieces[2])], [!cracks, !cracks], `at ${speed} m/s`);
  }
});

test('a section cracks where its pieces strike, not where it is still in the air', async () => {
  const { d, pieces, joined, strike } = falling();
  for (const p of pieces) body(p).velocity = [0, -12, 0];
  await run(d, 0.1);
  // Its first end strikes: the joint there gives way, the one between the two still falling holds
  strike(pieces[0], 12);
  await run(d, 0.1);
  assert.equal(joined(pieces[0], pieces[1]), false);
  assert.equal(joined(pieces[1], pieces[2]), true, 'neither of them struck anything');
  // Its other end strikes in turn
  strike(pieces[2], 12);
  await run(d, 0.2);
  assert.equal(joined(pieces[1], pieces[2]), false);
});

test('a plate whose weight has moved off what it stands on holds by its bonds as levers, if they can', async () => {
  for (const [support, weakened, falls] of [
    [100, 1, true],
    [4000, 1, false],
    [4000, 0.02, true],
  ] as const) {
    const w = new FakeWorld();
    const d = new Destruction({ world: asWorld(w), frameBudget: Infinity, materials: { brick: presets.brick({ support }), concrete: presets.concrete({ support }) } });
    const left = d.addBox({ material: 'brick', size: [0.5, 2, 0.5], position: [-1.25, 1, 0] })!;
    const post = d.addBox({ material: 'brick', size: [0.5, 2, 0.5], position: [1.25, 1, 0] })!;
    const plate = d.addBox({ material: 'concrete', size: [3, 0.25, 1], position: [0, 2.125, 0] })!;
    d.reinforce();
    // A bond weakened from outside stays weak as a lever (reinforce()'s strength is for pressing)
    for (const b of plate.bonds) if (b.other(plate) === left) b.strength = Math.min(b.strength, weakened);
    d.removePiece(post);
    await run(d, 0.5);
    assert.equal(plate.state, falls ? 'loose' : 'fixed', `support ${support}, strength ${weakened}: its weight 1.25 m out past the post it has left`);
  }
});

test('a support overloaded only by a bond giving way over it gives way with it, unless passHeldOnly', async () => {
  for (const passHeldOnly of [false, true]) {
    const { d } = make({ passHeldOnly });
    // A thin post, a block on it, and a heavy beam bonded to the block's side, too heavy for that bond
    const post = d.addBox({ material: 'brick', size: [0.036, 1, 0.036], position: [0, 0.5, 0] })!;
    const block = d.addBox({ material: 'brick', size: [0.3, 0.3, 0.3], position: [0, 1.15, 0] })!;
    const beam = d.addBox({ material: 'concrete', size: [3, 0.3, 0.3], position: [1.65, 1.15, 0] })!;
    const [onPost] = [...block.bonds].filter((b) => b.other(block) === post);
    const [onBlock] = [...beam.bonds];
    d.weigh();
    assert.ok(onBlock.load > 1, 'the beam is too heavy for its bond');
    assert.equal(onPost.load < 1, passHeldOnly, `the post takes the block and, passHeldOnly, no more than the beam's bond holds (${onPost.load.toFixed(2)})`);
    await run(d, 0.3);
    assert.equal(beam.state, 'loose');
    assert.equal(block.state, passHeldOnly ? 'fixed' : 'loose', passHeldOnly ? 'the post holds what is left on it' : 'the beam dragged it down');
  }
});
