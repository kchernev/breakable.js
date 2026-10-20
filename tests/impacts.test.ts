import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Destruction, type LandedEvent, type Piece, presets, type V3 } from '../src/lib/index.ts';
import { asWorld, FakeBody, FakeWorld } from './fake-world.ts';

function make(options: Partial<ConstructorParameters<typeof Destruction>[0]> = {}) {
  const w = new FakeWorld();
  const d = new Destruction({
    world: asWorld(w),
    frameBudget: Infinity,
    materials: {
      brick: presets.brick(),
      concrete: presets.concrete(),
      // Roof tiles: light, and break where they land
      tile: presets.brick({ density: 1.2, landing: 3 }),
      // Tin sheets: light, and heard
      tin: presets.metal({ density: 1, audible: 0.001 }),
    },
    ...options,
  });
  // Something that isn't a piece to land on
  const ground = w.addBox({ fixed: true });
  return { w, d, ground };
}
const body = (p: Piece) => p.body as unknown as FakeBody;
const speed = (v: V3) => Math.hypot(v[0], v[1], v[2]);
/** An update that reads the loose pieces back, and the readback's work done. */
async function readback(d: Destruction): Promise<void> {
  d.update(0.2);
  for (let k = 0; k < 5; k++) await new Promise((r) => setImmediate(r));
}

test('blasts throw nothing faster than maxSpeed, and the world slows what is', () => {
  const { w, d } = make({ maxSpeed: 5 });
  assert.equal((w as unknown as { maxSpeed: number }).maxSpeed, 5, 'the world is told');
  d.addBox({ material: 'brick', size: [4, 3, 0.3], position: [0, 1.5, 0] });
  let fastest = 0;
  d.on('debris', (e) => (fastest = Math.max(fastest, speed(e.velocity))));
  const r = d.explode({ at: [0, 1.5, 0.4], radius: 1.5, speed: 300 });
  assert.ok(r.loose.length > 0);
  for (const p of r.loose) fastest = Math.max(fastest, speed(body(p).velocity));
  assert.ok(fastest > 4 && fastest <= 5 + 1e-9, `fastest ${fastest}`);
  assert.equal((make().w as unknown as { maxSpeed: number }).maxSpeed, 40, 'default 40 m/s');
});

test("a light piece of a material with a landing speed breaks where it lands; one without lands whole", async () => {
  const { w, d, ground } = make();
  const tile = d.addBox({ material: 'tile', size: [0.4, 0.05, 0.3], position: [0, 3, 0], loose: true })!;
  const brick = d.addBox({ material: 'brick', size: [0.4, 0.05, 0.3], position: [2, 3, 0], loose: true })!;
  assert.ok(tile.mass < d.heavy && brick.mass < d.heavy, 'both light');
  assert.ok(body(tile).reportContacts, 'a tile reports what it strikes');
  assert.ok(!body(brick).reportContacts, 'a light brick does not');
  let pieces = 0;
  d.on('fracture', (e) => (pieces += e.pieces.length));
  for (const p of [tile, brick]) w.contact({ a: body(p), b: ground, impulse: p.mass * 6, point: p.pose.position });
  await readback(d);
  assert.equal(tile.state, 'gone', 'the tile broke');
  assert.ok(pieces >= 2, `into ${pieces} pieces`);
  assert.equal(brick.state, 'loose', 'the brick is whole');
  // Landing softer than its landing speed: whole
  const soft = d.addBox({ material: 'tile', size: [0.4, 0.05, 0.3], position: [4, 3, 0], loose: true })!;
  w.contact({ a: body(soft), b: ground, impulse: soft.mass * 2 });
  await readback(d);
  assert.equal(soft.state, 'loose');
});

test('the landings broken per readback take turns by material', async () => {
  const { w, d, ground } = make({ maxImpacts: 2 });
  // Heavy concrete landing much harder than the tiles
  const blocks = [0, 1, 2, 3].map((i) => d.addBox({ material: 'concrete', size: [0.8, 0.8, 0.8], position: [i * 2, 5, 0], loose: true })!);
  const tiles = [0, 1, 2].map((i) => d.addBox({ material: 'tile', size: [0.4, 0.05, 0.3], position: [i * 2, 5, 4], loose: true })!);
  for (const p of [...blocks, ...tiles]) w.contact({ a: body(p), b: ground, impulse: p.mass * 8 });
  await readback(d);
  assert.equal(blocks.filter((p) => p.state === 'gone').length, 1, 'one block');
  assert.equal(tiles.filter((p) => p.state === 'gone').length, 1, 'and one tile');
});

test("'landed': a falling section once, however many of its pieces touch down; a heavy piece once; a light one never", async () => {
  const { w, d, ground } = make();
  const landed: LandedEvent[] = [];
  d.on('landed', (e) => landed.push(e));
  // Two bricks bonded, standing on nothing: they fall as one section
  const a = d.addBox({ material: 'brick', size: [0.4, 0.2, 0.2], position: [0, 5.1, 0] })!;
  const b = d.addBox({ material: 'brick', size: [0.4, 0.2, 0.2], position: [0, 5.3, 0] })!;
  d.update(0.016);
  assert.equal(a.state, 'loose');
  assert.ok(a.bonds.size === 1, 'still bonded, falling');
  assert.ok(body(a).reportContacts && body(b).reportContacts, 'light, but a section says when it lands');
  // Falling at 5 m/s as of a readback, it lands at the next (the normal is from b toward a)
  body(a).velocity = body(b).velocity = [0, -5, 0];
  await readback(d);
  body(a).velocity = body(b).velocity = [0, 0, 0];
  w.contact({ a: body(a), b: ground, impulse: 0.02, point: [0, 0, 0], normal: [0, 1, 0] });
  w.contact({ a: ground, b: body(b), impulse: 0.06, point: [1, 0, 0], normal: [0, -1, 0] });
  await readback(d);
  assert.equal(landed.length, 1);
  const e = landed[0];
  assert.deepEqual(new Set(e.pieces), new Set([a, b]));
  assert.ok(Math.abs(e.mass - (a.mass + b.mass)) < 1e-12);
  assert.ok(Math.abs(e.speed - 5) < 1e-9, `speed ${e.speed}: as it fell, the touches' impulse over its mass being less`);
  assert.ok(Math.abs(e.at[0] - 0.75) < 1e-6, 'where it struck, weighted by how hard');
  assert.equal(e.material, 'brick');
  // It bounces and touches down again: no second one
  w.contact({ a: body(a), b: ground, impulse: 0.3 });
  await readback(d);
  assert.equal(landed.length, 1);
  // A heavy piece alone, and a light one alone, falling
  const heavy = d.addBox({ material: 'concrete', size: [0.8, 0.8, 0.8], position: [5, 5, 0], loose: true })!;
  const light = d.addBox({ material: 'brick', size: [0.2, 0.2, 0.2], position: [8, 5, 0], loose: true })!;
  body(heavy).velocity = body(light).velocity = [0, -4, 0];
  await readback(d);
  w.contact({ a: body(heavy), b: ground, impulse: heavy.mass * 0.5 });
  w.contact({ a: body(light), b: ground, impulse: light.mass * 0.5 });
  // Striking another loose piece isn't landing
  const other = d.addBox({ material: 'concrete', size: [0.8, 0.8, 0.8], position: [5, 8, 0], loose: true })!;
  w.contact({ a: body(other), b: body(heavy), impulse: 5 });
  await readback(d);
  assert.equal(landed.length, 2);
  assert.deepEqual(landed[1].pieces, [heavy]);
});

test("'landed': a section let go where it rests hasn't landed, nor one sliding; it lands when it strikes", async () => {
  const { w, d, ground } = make();
  const landed: LandedEvent[] = [];
  d.on('landed', (e) => landed.push(e));
  // A column of three on the ground; the top two let go as one, resting on the one under them
  const [base, mid, top] = [0, 1, 2].map((k) => d.addBox({ material: 'brick', size: [0.4, 0.2, 0.2], position: [0, 0.1 + 0.2 * k, 0] })!);
  d.release([mid, top]);
  assert.ok(mid.state === 'loose' && top.state === 'loose' && base.state === 'fixed');
  const weight = (mid.mass + top.mass) * 9.81 * (1 / 60);
  // It touches what it rests on as the solver takes it (before any readback), and settles on it
  w.contact({ a: body(mid), b: body(base), impulse: weight, normal: [0, 1, 0] });
  await readback(d);
  w.contact({ a: body(base), b: body(mid), impulse: weight, normal: [0, -1, 0] });
  await readback(d);
  assert.equal(landed.length, 0, 'not at its release, nor settling');
  // Sliding across something as fast as it likes isn't striking it
  body(mid).velocity = body(top).velocity = [3, 0, 0];
  await readback(d);
  w.contact({ a: body(mid), b: body(base), impulse: weight, normal: [0, 1, 0] });
  await readback(d);
  assert.equal(landed.length, 0, 'nor sliding');
  // Falling at 6 m/s as of a readback, it strikes the ground: once
  body(mid).velocity = body(top).velocity = [0, -6, 0];
  await readback(d);
  w.contact({ a: body(mid), b: ground, impulse: weight, normal: [0, 1, 0] });
  w.contact({ a: body(top), b: ground, impulse: weight, normal: [0, 1, 0] });
  await readback(d);
  assert.equal(landed.length, 1);
  assert.deepEqual(new Set(landed[0].pieces), new Set([mid, top]));
  assert.ok(Math.abs(landed[0].speed - 6) < 1e-9, `speed ${landed[0].speed}`);
});

test("a material's audible lets its light pieces be heard", () => {
  const { d } = make();
  d.on('impact', () => {});
  const tin = d.addBox({ material: 'tin', size: [0.5, 0.004, 0.5], position: [0, 3, 0], loose: true })!;
  const brick = d.addBox({ material: 'brick', size: [0.1, 0.05, 0.1], position: [2, 3, 0], loose: true })!;
  assert.ok(tin.mass < 0.02 && brick.mass < 0.02);
  assert.ok(body(tin).reportContacts, 'tin heard');
  assert.ok(!body(brick).reportContacts, 'a crumb of brick not');
});

test('a blast cuts the loose pieces it reaches when asked (by default it only throws them)', () => {
  const { d } = make();
  const flying = d.addBox({ material: 'concrete', size: [0.8, 0.8, 0.8], position: [0, 3, 0], loose: true })!;
  body(flying).velocity = [0, -5, 0];
  const spared = d.addBox({ material: 'concrete', size: [0.8, 0.8, 0.8], position: [10, 3, 0], loose: true })!;
  d.explode({ at: [10.6, 3, 0], radius: 1.2 });
  assert.equal(spared.state, 'loose', 'left whole by default');
  const r = d.explode({ at: [0.6, 3, 0], radius: 1.2, loose: true });
  assert.equal(flying.state, 'gone');
  assert.ok(r.broken === 1 && r.made.length >= 3, `made ${r.made.length}`);
  // Its cells fly on as it did, and are thrown away from the blast
  const v = r.made.map((p) => body(p).velocity);
  assert.ok(v.every((u) => u[1] < 0 || u[0] < 0), 'still falling, or thrown away');
  assert.ok(v.some((u) => u[0] < -1), 'some thrown away from the blast');
});

test('a blast cuts a loose piece where it is now, not where the last readback saw it', () => {
  // No readbacks: its pose stays where it was let go
  const { d } = make({ readInterval: 100 });
  const flying = d.addBox({ material: 'concrete', size: [0.8, 0.8, 0.8], position: [0, 3, 0], loose: true })!;
  // Moving 8 m/s along x and turning 45° about y in the 0.15 s since
  const turn = Math.PI / 4;
  body(flying).velocity = [8, 0, 0];
  body(flying).angularVelocity = [0, turn / 0.15, 0];
  d.update(0.15);
  // Out of reach of where it was; in reach of where it is
  const r = d.explode({ at: [1.2, 3, 0.75], radius: 0.6, speed: 1, loose: true });
  assert.equal(flying.state, 'gone');
  const lo = Math.min(...r.made.map((p) => p.bounds.min[0]));
  const hi = Math.max(...r.made.map((p) => p.bounds.max[0]));
  // Turned 45°: as wide as its diagonal, about x = 1.2
  assert.ok(Math.abs((lo + hi) / 2 - 1.2) < 1e-6, `centre ${(lo + hi) / 2}`);
  assert.ok(Math.abs(hi - lo - 0.8 * Math.SQRT2) < 1e-6, `width ${hi - lo}`);
});

test("wood's grain splits a beam into splinters along its texture frame's axis", () => {
  // A beam along z, its texture frame turned so u (x) runs along it
  const along = (stretch: number) => {
    const w = new FakeWorld();
    const d = new Destruction({ world: asWorld(w), frameBudget: Infinity, seed: 3, materials: { wood: presets.wood(stretch > 1 ? { grain: { axis: 'u', stretch } } : {}) } });
    const turn: [number, number, number, number] = [0, -Math.SQRT1_2, 0, Math.SQRT1_2];
    d.addBox({ material: 'wood', size: [0.3, 0.3, 3], position: [0, 0.15, 0], textureFrame: { position: [0, 0, 0], rotation: turn } });
    const r = d.explode({ at: [0, 0.15, 0.3], radius: 0.6, speed: 1 });
    let z = 0;
    let xy = 0;
    for (const p of r.made) {
      const b = p.bounds;
      z += b.max[2] - b.min[2];
      xy += (b.max[0] - b.min[0] + b.max[1] - b.min[1]) / 2;
    }
    return z / xy;
  };
  const plain = along(1);
  const grained = along(5);
  assert.ok(grained > 1.5 * plain, `${grained.toFixed(2)} vs ${plain.toFixed(2)}`);
});
