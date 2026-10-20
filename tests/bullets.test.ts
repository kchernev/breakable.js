import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as THREE from 'three/webgpu';
import { bulletPush, bulletsToBreak, Destruction, DestructionSounds, type MaterialKind, materialKind, packMaterials, type PlayOptions, presets, type PropModel, type SoundEngine, type V3 } from '../src/lib/index.ts';
import { asWorld, type FakeBody, FakeWorld } from './fake-world.ts';

function make() {
  const w = new FakeWorld();
  const d = new Destruction({ world: asWorld(w), frameBudget: Infinity, materials: { brick: presets.brick(), concrete: presets.concrete(), glass: presets.glass(), wood: presets.wood(), steel: presets.metal(), crate: presets.wood() } });
  return { w, d };
}

/** A crate-sized prop, as light as the neon pack's. */
const crate: PropModel = {
  name: 'crate',
  object: new THREE.Group(),
  mass: 0.0015,
  collider: [-0.2, 0.2].flatMap((x) => [0, 0.3].flatMap((y) => [-0.3, 0.3].map((z) => [x, y, z] as V3))),
};

/** Shots from 5 m in front of z = 0, straight at it, until one breaks what it strikes (or `most` are fired). */
function shootUntilBroken(d: Destruction, at: V3, most = 1000): number {
  for (let n = 1; n <= most; n++) {
    const hit = d.shoot([at[0], at[1], 5], [0, 0, -1]);
    assert.ok(hit, `shot ${n} struck something`);
    if (hit.broke) return n;
  }
  return Infinity;
}

test('how many bullets a piece takes: glass one, a brick a few, a thin board soon, concrete many, steel very many', () => {
  const m = { brick: presets.brick(), concrete: presets.concrete(), glass: presets.glass(), wood: presets.wood(), steel: presets.metal() };
  const size = (x: number, y: number, z: number) => Math.cbrt(x * y * z);
  assert.equal(bulletsToBreak(m.glass, size(1, 1.5, 0.01)), 1);
  assert.equal(bulletsToBreak(m.glass, size(3, 3, 0.05)), 1, 'however big the pane');
  const brick = bulletsToBreak(m.brick, 0.25);
  assert.ok(brick >= 2 && brick <= 5, `a quarter-metre brick: ${brick}`);
  const board = bulletsToBreak(m.wood, size(1, 0.2, 0.025));
  assert.ok(board <= 2, `a thin board: ${board}`);
  const block = bulletsToBreak(m.concrete, size(2, 1, 0.5));
  assert.ok(block >= 30, `a 2 m concrete block: ${block}`);
  const plate = bulletsToBreak(m.steel, size(2, 1, 0.1));
  assert.ok(plate >= 100, `a steel plate: ${plate}`);
  // Bigger takes more, and a harder material more than a softer one of the same size
  assert.ok(bulletsToBreak(m.brick, 0.5) > brick);
  assert.ok(bulletsToBreak(m.concrete, 0.5) > bulletsToBreak(m.brick, 0.5));
  assert.equal(bulletsToBreak(m.brick, 0.01), 1, 'at least one');
});

test("a bullet's push: light things skitter, heavy ones don't move, nothing past 6 m/s", () => {
  assert.equal(bulletPush(0.0001), 6);
  assert.ok(bulletPush(0.015) > 0.3 && bulletPush(0.015) < 1, `a bin: ${bulletPush(0.015)}`);
  assert.ok(bulletPush(1.4) < 0.01, `a car: ${bulletPush(1.4)}`);
  assert.ok(Math.abs(bulletPush(0.01, 2) - 2 * bulletPush(0.01)) < 1e-12, 'twice the power, twice the push');
});

test('a brick gives way after a few hits, chipped and whole until then', () => {
  const { d } = make();
  const brick = d.addBox({ material: 'brick', size: [0.25, 0.25, 0.25], position: [0, 0.125, 0] })!;
  const limit = bulletsToBreak(brick.material, brick.size);
  for (let n = 1; n < limit; n++) {
    const hit = d.shoot([0, 0.125, 5], [0, 0, -1])!;
    assert.equal(hit.piece, brick);
    assert.equal(hit.material, 'brick');
    assert.equal(hit.broke, false);
    assert.ok(Math.abs(hit.damage - n / limit) < 1e-9, `damage ${hit.damage}`);
    assert.deepEqual(hit.normal.map(Math.round), [0, 0, 1]);
    assert.ok(Math.abs(hit.point[2] - 0.125) < 1e-9 && Math.abs(hit.distance - 4.875) < 1e-9);
    // Only chipped: nothing cut, nothing moved
    assert.equal(brick.state, 'fixed');
    assert.equal(d.all().length, 1);
  }
  const last = d.shoot([0, 0.125, 5], [0, 0, -1])!;
  assert.equal(last.broke, true);
  assert.equal(last.damage, 1);
  assert.notEqual(brick.state, 'fixed', 'knocked out, or cut');
});

test('glass breaks at the first hit, a 2 m concrete block takes many, steel very many', () => {
  const { d } = make();
  d.addBox({ material: 'glass', size: [1, 1.5, 0.01], position: [0, 1, 0], static: false });
  assert.equal(shootUntilBroken(d, [0, 1, 0]), 1);

  const b = make();
  b.d.addBox({ material: 'concrete', size: [2, 1, 0.5], position: [0, 0.5, 0] });
  const block = shootUntilBroken(b.d, [0.3, 0.5, 0]);
  assert.ok(block >= 30, `the block: ${block}`);

  const s = make();
  s.d.addBox({ material: 'steel', size: [2, 1, 0.1], position: [0, 0.5, 0] });
  assert.ok(shootUntilBroken(s.d, [0, 0.5, 0], 99) === Infinity, 'steel takes more than 99');
});

test('breaking cuts where it was struck and leaves the rest standing; a thin board splinters soon', () => {
  const { d } = make();
  d.addBox({ material: 'concrete', size: [2, 1, 0.5], position: [0, 0.5, 0] });
  const n = shootUntilBroken(d, [0.7, 0.5, 0]);
  assert.ok(Number.isFinite(n));
  const standing = d.all().filter((p) => p.state === 'fixed');
  assert.ok(d.all().length > 2, `cut into cells: ${d.all().length}`);
  assert.ok(standing.length >= 1, 'some of it stands');
  // What came loose came from the struck end
  for (const p of d.all()) if (p.state === 'loose') assert.ok(p.pose.position[0] > -0.2, `loose at x ${p.pose.position[0]}`);

  const w = make();
  w.d.addBox({ material: 'wood', size: [1, 0.2, 0.025], position: [0, 0.1, 0] });
  assert.ok(shootUntilBroken(w.d, [0.2, 0.1, 0]) <= 2);
});

test('a heavy round (power over 1) breaks what it strikes sooner, and the pieces right around it too', () => {
  const row = (power: number) => {
    const { d } = make();
    const bricks = [-0.25, 0, 0.25].map((x) => d.addBox({ material: 'brick', size: [0.25, 0.25, 0.25], position: [x, 0.125, 0] })!);
    return { hit: d.shoot([0, 0.125, 5], [0, 0, -1], power)!, bricks };
  };
  // Power 1: a brick only chipped, its neighbours untouched
  const one = row(1);
  assert.equal(one.hit.broke, false);
  assert.deepEqual(one.bricks.map((b) => b.state), ['fixed', 'fixed', 'fixed']);
  // Power 6: the brick gives way at once, and takes the two beside it with it
  const six = row(6);
  assert.equal(six.hit.broke, true);
  for (const b of six.bricks) assert.notEqual(b.state, 'fixed');
  // A 2 m concrete block: in a handful, not dozens
  const { d } = make();
  d.addBox({ material: 'concrete', size: [2, 1, 0.5], position: [0, 0.5, 0] });
  let n = 1;
  for (; n < 100 && !d.shoot([0.3, 0.5, 5], [0, 0, -1], 6)!.broke; n++);
  assert.ok(n <= 12, `the block at power 6: ${n}`);
});

test("held in the line of fire, a loose piece isn't sped up round after round; one too small to cut comes loose whole", () => {
  // A light loose plate already going at its push along the bullet's way: no more
  const { d } = make();
  const plate = d.addBox({ material: 'steel', size: [0.3, 0.3, 0.01], position: [0, 1, 0], loose: true })!;
  const body = plate.body as unknown as FakeBody;
  d.shoot([0, 1, 5], [0, 0, -1], 6);
  assert.equal(body.impulses.length, 1, 'pushed at first');
  body.velocity = [0, 0, -6];
  for (let n = 0; n < 10; n++) d.shoot([0, 1, 5], [0, 0, -1], 6);
  assert.equal(body.impulses.length, 1, 'not again while it goes that way as fast');
  // Slower than its push: raised to it, not past it
  body.velocity = [0, 0, -2];
  d.shoot([0, 1, 5], [0, 0, -1], 6);
  const last = body.impulses.at(-1)!;
  assert.ok(Math.abs(-last[2] / plate.mass - 4) < 0.05, `topped up by 4 m/s: ${last[2] / plate.mass}`);

  // A standing piece too small to cut, struck near its edge: it comes loose (it used to stand, struck off its middle)
  const s = make();
  const small = s.d.addBox({ material: 'brick', size: [0.16, 0.16, 0.16], position: [0, 0.08, 0] })!;
  assert.ok(small.size <= small.material.minSize * 1.5, `too small to cut: ${small.size}`);
  // (power 1: its blast's reach from the edge doesn't take in its middle)
  const limit = bulletsToBreak(small.material, small.size);
  for (let n = 1; n < limit; n++) assert.equal(s.d.shoot([0.07, 0.08, 5], [0, 0, -1])!.broke, false);
  const hit = s.d.shoot([0.07, 0.08, 5], [0, 0, -1])!;
  assert.equal(hit.piece, small);
  assert.equal(hit.broke, true);
  assert.notEqual(small.state, 'fixed');
});

test('static pieces and props never break; props and loose pieces are pushed along the way', () => {
  const { d } = make();
  const base = d.addBox({ material: 'concrete', size: [1, 1, 1], position: [0, 0.5, 0], static: true })!;
  for (let n = 0; n < 200; n++) assert.equal(d.shoot([0, 0.5, 5], [0, 0, -1])!.broke, false);
  assert.equal(base.state, 'fixed');

  const p = make();
  const box = p.d.addProp({ model: crate, material: 'crate', position: [0, 0, 0] })!;
  assert.equal(box.state, 'rubble');
  const hit = p.d.shoot([0, 0.15, 5], [0, 0, -1])!;
  assert.equal(hit.piece, box);
  assert.equal(hit.broke, false);
  assert.equal(box.state, 'loose', 'woken');
  const v = (box.body as unknown as FakeBody).velocity;
  assert.ok(v[2] < -1 && v[2] >= -6.0001, `skitters off along the shot: ${v}`);

  // A loose piece, struck where it is now
  const l = make();
  const brick = l.d.addBox({ material: 'brick', size: [0.2, 0.2, 0.2], position: [3, 2, 0], loose: true })!;
  const flying = l.d.shoot([3, 2, 5], [0, 0, -1])!;
  assert.equal(flying.piece, brick);
  assert.ok((brick.body as unknown as FakeBody).impulses.length > 0, 'pushed');
  assert.equal(l.d.shoot([10, 2, 5], [0, 0, -1]), null, 'a miss: null');
});

test("a material's kind: by how it breaks, its sounds, its name", () => {
  assert.equal(materialKind('pane', presets.glass()), 'glass');
  assert.equal(materialKind('terracotta', { ...presets.brick(), shatter: true }, { bullet: 'bullet.brick' }), 'brick', 'its bullet sound first: fired clay, not glass');
  assert.equal(materialKind('tin', presets.metal()), 'metal');
  assert.equal(materialKind('render', presets.brick(), packMaterials.brick), 'brick');
  assert.equal(materialKind('stone', presets.concrete(), packMaterials.concrete), 'concrete');
  assert.equal(materialKind('oak', presets.wood()), 'wood');
  assert.equal(materialKind('dirt', presets.concrete()), 'dirt');
  assert.equal(materialKind('earth', presets.concrete(), packMaterials.brick), 'dirt', 'called earth, whatever it sounds like');
  assert.equal(materialKind('fill', presets.concrete(), { ...packMaterials.brick, bullet: 'bullet.dirt' }), 'dirt', 'its own bullet sound says');
  assert.equal(materialKind('limestone', presets.concrete()), 'concrete');
});

/** A seeded Math.random (mulberry32): the same numbers every run. */
function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

test("a strike's sound: the material's own, else its kind's, at its pitch; ricochets now and then off metal and stone, more often grazing, never two at once", (t) => {
  const { d } = make();
  const plays: Array<{ name: string } & PlayOptions> = [];
  const context = { currentTime: 0 };
  const engine = { context, play: (name: string, o: PlayOptions = {}) => (plays.push({ name, ...o }), null) } as unknown as SoundEngine;
  const sounds = new DestructionSounds(engine, d, { materials: { brick: { ...packMaterials.brick, bullet: 'bullet.old', pitch: 0.9 }, concrete: packMaterials.concrete, wood: { ...packMaterials.wood, pitch: { bullet: 1.2 } } } });
  // The strike is the first sound of each (a ricochet may follow it)
  const strike = (...args: Parameters<DestructionSounds['bullet']>) => {
    const n = plays.length;
    sounds.bullet(...args);
    return plays[n];
  };
  assert.deepEqual(strike([0, 1, 0], 'brick'), { name: 'bullet.old', at: [0, 1, 0], pitch: 0.9 });
  assert.equal(strike([0, 1, 0], 'concrete').name, 'bullet.concrete');
  const wood = strike([0, 1, 0], 'wood');
  assert.deepEqual([wood.name, wood.pitch], ['bullet.wood', 1.2]);
  assert.equal(strike([0, 1, 0], 'glass').name, 'bullet.glass', 'unlisted: by its kind');
  assert.equal(strike([0, 0, 0], null, 'dirt').name, 'bullet.dirt', 'the ground, of the kind given');
  // Ricochets in 400 hits a second apart (past the gap), the same random numbers each run
  t.mock.method(Math, 'random', seeded(7));
  const ricochets = (material: string | null, kind: MaterialKind | undefined, glance: number, n = 400, every = 1) => {
    plays.length = 0;
    for (let i = 0; i < n; i++) {
      context.currentTime += every;
      sounds.bullet([0, 0, 0], material, kind, glance);
    }
    return plays.filter((p) => p.name === 'bullet.ricochet').length;
  };
  const square = ricochets('steel', undefined, 0);
  assert.ok(square > 15 && square < 50, `${square} of 400 square on off steel (8 %)`);
  const grazing = ricochets('steel', undefined, 1);
  assert.ok(grazing > 85 && grazing < 140, `${grazing} of 400 grazing off steel (28 %)`);
  const angled = ricochets('steel', undefined, 1 - Math.SQRT1_2);
  assert.ok(angled < 50, `${angled} of 400 at 45° off steel: no more than square on`);
  // The road 9 m ahead of the eye: about 1 in 12
  const road = ricochets(null, 'concrete', 0.82);
  assert.ok(road > 18 && road < 55, `${road} of 400 at the road`);
  assert.equal(ricochets('wood', undefined, 1), 0, 'off wood never');
  assert.equal(ricochets(null, 'dirt', 1), 0, 'off dirt never');
  // A burst of grazing hits 8 a second (every one would whine): one in each 0.6 s at most
  t.mock.method(Math, 'random', () => 0);
  assert.equal(ricochets('steel', undefined, 1, 40, 0.125), 8, 'in 5 s');
});
