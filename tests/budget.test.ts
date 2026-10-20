import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as THREE from 'three/webgpu';
import { BODY_FLOATS } from 'three-avbd/advanced';
import { Destruction, type DestructionOptions, type Piece, presets, type PropModel, quatFromAxisAngle, type V3 } from '../src/lib/index.ts';
import { asWorld, FakeWorld } from './fake-world.ts';

/**
 * A world with the ground at 0, its brick's small rubble kept (`life`: cleared after so long); `draw`:
 * with a body buffer and a scene, so pieces are drawn (no GPU).
 */
function make(o: Partial<DestructionOptions> = {}, draw = false, life = Infinity) {
  const w = new FakeWorld();
  if (draw) Object.assign(w, { bodyAttribute: new THREE.StorageInstancedBufferAttribute(new Float32Array(4096 * BODY_FLOATS), 4), maxBodies: 4096 });
  const d = new Destruction({ world: asWorld(w), scene: draw ? new THREE.Scene() : null, frameBudget: Infinity, materials: { brick: presets.brick({ rubbleLife: life }), crate: presets.wood() }, ...o });
  return { w, d };
}
/** Frames of `dt`, letting each readback land; `each` before each frame. */
async function run(d: Destruction, seconds: number, dt = 0.1, each?: () => void) {
  for (let t = 0; t < seconds; t += dt) {
    each?.();
    d.update(dt);
    await new Promise((r) => setImmediate(r));
  }
}
/** A loose brick of `size` lying on the ground at (x, z): it comes to rest as rubble (the fake world never moves it). */
const brick = (d: Destruction, x: number, z: number, size = 0.2) => d.addBox({ material: 'brick', size: [size, size, size], position: [x, size / 2, z], loose: true })!;
const crate: PropModel = { name: 'crate', object: new THREE.Group(), mass: 0.02, collider: [-0.3, 0.3].flatMap((x) => [0, 0.6].flatMap((y) => [-0.3, 0.3].map((z) => [x, y, z] as V3))) };

test('past maxPieces, the rubble of what broke dissolves down to the budget, a pile too, what lies on rubble from above first; what stands, props, and what moves or hangs never go', async () => {
  const { d } = make();
  // What never goes: what stands, a prop, a sign on its hinge, one moving all along (the fake
  // world moves nothing: it's moved by hand)
  const wall = Array.from({ length: 6 }, (_, i) => d.addBox({ material: 'brick', size: [0.5, 0.25, 0.25], position: [i * 0.5 - 1.5, 0.125, -4] })!);
  const prop = d.addProp({ model: crate, material: 'crate', position: [4, 0, 4] })!;
  d.addBox({ material: 'brick', size: [0.4, 4, 2], position: [-6.7, 2, 0] });
  const bracket = d.addBox({ material: 'crate', size: [1, 0.1, 0.1], position: [-6, 3.5, 0] })!;
  const sign = d.addBox({ material: 'crate', size: [0.6, 0.4, 0.04], position: [-5.9, 3.2, 0] })!;
  d.hinge(sign, [-5.9, 3.44, 0], [1, 0, 0], { to: bracket });
  const moving = brick(d, 6, 0);
  const move = () => moving.body.set({ position: [6, 0.1, moving.body.position[2] + 0.02], velocity: [0, 0, 0.2] });
  // A pile: three stacked, two leaning together like a tent, and three blocks blown apart, their
  // cells come to rest where they were cut, on and against each other
  const stack = [0.1, 0.3, 0.5].map((y) => d.addBox({ material: 'brick', size: [0.2, 0.2, 0.2], position: [2, y, 2], loose: true })!);
  const tent = [-1, 1].map((k) => d.addBox({ material: 'brick', size: [0.06, 0.36, 0.3], position: [4 + k * 0.07, 0.17, 2], rotation: quatFromAxisAngle([0, 0, 1], (-k * Math.PI) / 6), loose: true })!);
  [-2, -1, 0].map((x) => d.addBox({ material: 'brick', size: [0.8, 0.8, 0.8], position: [x * 0.8, 0.4, 2] })!);
  d.reinforce();
  const blast = d.explode({ at: [-0.8, 0.6, 2.6], radius: 1.4, speed: 3 });
  for (const p of d.loosePieces) if (p !== moving && p !== sign) p.body.set({ velocity: [0, 0, 0], angularVelocity: [0, 0, 0] });
  await run(d, 5, 0.1, move);
  const rubble = () => d.all().filter((p) => p.state === 'rubble' && !p.prop && p !== sign);
  assert.ok(blast.made.length > 10, `the blast made ${blast.made.length} cells`);
  assert.ok([...stack, ...tent].every((p) => p.state === 'rubble'));
  assert.ok(rubble().filter((p) => rubble().some((q) => q.under.includes(p) && q.pose.position[1] > p.pose.position[1])).length >= 4, 'rubble lies on rubble');
  assert.ok(tent.every((p, i) => p.under.includes(tent[1 - i])), 'the two lean on each other');
  // All the rubble over the budget: it all goes, from the top of the pile down
  d.maxPieces = d.stats.pieces - rubble().length;
  const order: Piece[] = [];
  d.on('state', (e) => e.to === 'gone' && order.push(e.piece));
  await run(d, 60, 0.1, move);
  assert.equal(d.stats.pieces, d.maxPieces, 'down to the budget');
  assert.equal(rubble().length, 0);
  assert.ok(order.indexOf(stack[2]) < order.indexOf(stack[1]) && order.indexOf(stack[1]) < order.indexOf(stack[0]), 'the stack from the top');
  assert.ok(wall.every((p) => p.state === 'fixed'), 'what stands stays');
  assert.equal(prop.state, 'rubble', 'and props');
  assert.equal(sign.state, 'loose', 'and what hangs');
  assert.equal(moving.state, 'loose', 'and what moves');
  // More pieces later: it holds again
  for (let i = 0; i < 10; i++) brick(d, i - 4.5, 8);
  await run(d, 8, 0.1, move);
  assert.equal(d.stats.pieces, d.maxPieces);
});

test('of two leaning on each other either may go (neither lies on the other), and the other rests on as it lies; one woken as it dissolves stays, drawn whole again', async () => {
  const { d } = make();
  const tent = [-1, 1].map((k) => d.addBox({ material: 'brick', size: [0.06, 0.36, 0.3], position: [k * 0.07, 0.17, 0], rotation: quatFromAxisAngle([0, 0, 1], (-k * Math.PI) / 6), loose: true })!);
  // (Leaning, they come to rest a while after they stop)
  await run(d, 7);
  assert.ok(tent.every((p, i) => p.state === 'rubble' && p.under.includes(tent[1 - i])));
  const woke: Piece[] = [];
  d.on('state', (e) => e.from === 'rubble' && e.to === 'loose' && woke.push(e.piece));
  d.maxPieces = 1;
  await run(d, 2);
  const [gone, left] = tent[0].state === 'gone' ? tent : [tent[1], tent[0]];
  assert.equal(gone.state, 'gone');
  assert.equal(left.state, 'rubble');
  assert.deepEqual(woke, [], 'not woken: each piece going from a pile would stir those round it');
  assert.ok(!left.under.includes(gone));

  // Pushed (a bullet, a blast, what it rests on going) while it shrinks: it's moving, so it stays,
  // drawn at its full size
  const c = make({ maxPieces: 0 }, true);
  const p = c.d.addBox({ material: 'brick', size: [0.4, 0.4, 0.4], position: [0, 0.2, 0], loose: true })!;
  await run(c.d, 4.6);
  const mesh = c.d.drawn.find((m) => m.name === 'breakable:brick')!;
  const extent = () => {
    const a = mesh.geometry.getAttribute('position').array as Float32Array;
    const ys = Array.from({ length: p.draw!.count }, (_, i) => a[3 * (p.draw!.start + i) + 1]);
    return Math.max(...ys) - Math.min(...ys);
  };
  assert.ok(p.state === 'rubble' && extent() < 0.38, `dissolving: ${extent().toFixed(2)} m high as drawn`);
  c.d.push(p, [3, 0, 0]);
  assert.equal(p.state, 'loose');
  assert.ok(Math.abs(extent() - 0.4) < 1e-6, 'drawn whole');
  await run(c.d, 1.5);
  assert.notEqual(p.state, 'gone', 'still there after it would have gone');
});

test('what goes first is out of view, then what looks smallest from the viewer: small and far', async () => {
  const { d } = make();
  const camera = new THREE.PerspectiveCamera(70, 16 / 9, 0.05, 600);
  camera.position.set(0, 1.6, 0);
  camera.lookAt(0, 1.6, -10);
  camera.updateMatrixWorld();
  d.viewer = camera;
  const near = brick(d, 0, -3);
  const big = brick(d, 0.6, -3, 0.5);
  const far = brick(d, 0, -30);
  const behind = brick(d, 0, 3);
  const bigBehind = brick(d, 0.6, 3, 0.5);
  // Joined at rest: they go together, or not at all
  const pair = [brick(d, -2, -30, 0.15), brick(d, -1.85, -30, 0.15)];
  d.bond(pair[0], pair[1], 0.02);
  const all = [near, big, far, behind, bigBehind, ...pair];
  await run(d, 4);
  assert.ok(all.every((p) => p.state === 'rubble'));
  const gone: Piece[] = [];
  for (let n = 6; n >= 1; n--) {
    d.maxPieces = n;
    await run(d, 1.5);
    for (const p of all) if (p.state === 'gone' && !gone.includes(p)) gone.push(p);
  }
  // Behind the viewer, the small one and then the big one (however near, and bigger than all in
  // view but one); then in view the pair (0.19 m together, 30 m off), the far one, the near one,
  // the big one last
  assert.deepEqual(
    gone.map((p) => all.indexOf(p)),
    [3, 4, 5, 6, 2, 0],
  );
  assert.equal(big.state, 'rubble');
});

test('a piece dissolving shrinks into what it lies on before it goes; small rubble cleared does too', async () => {
  const { d } = make({ maxPieces: 0 }, true);
  const p = brick(d, 0, 0, 0.4);
  const mesh = d.drawn.find((m) => m.name === 'breakable:brick')!;
  // Its drawn corners, in the world (the fake world's bodies stay where they're put)
  const corners = () => {
    const a = mesh.geometry.getAttribute('position').array as Float32Array;
    const out: V3[] = [];
    for (let i = p.draw!.start; i < p.draw!.start + p.draw!.count; i++) {
      const q = p.pose.rotation;
      const v = new THREE.Vector3(a[3 * i], a[3 * i + 1], a[3 * i + 2]).applyQuaternion(new THREE.Quaternion(...q)).add(new THREE.Vector3(...p.pose.position));
      out.push([v.x, v.y, v.z]);
    }
    return out;
  };
  const extent = (c: V3[]) => [0, 1, 2].map((k) => Math.max(...c.map((v) => v[k])) - Math.min(...c.map((v) => v[k])));
  // At rest for a while (BUDGET.settled), then it starts to go
  await run(d, 3.5);
  assert.equal(p.state, 'rubble');
  assert.ok(extent(corners()).every((e) => Math.abs(e - 0.4) < 1e-6), 'whole as it came to rest');
  await run(d, 1.1);
  // Under way: smaller, still on the ground under its middle
  assert.equal(p.state, 'rubble');
  const mid = corners();
  const e = extent(mid);
  assert.ok(e.every((x) => x > 0.02 && x < 0.38), `shrinking: ${e.map((x) => x.toFixed(2))}`);
  assert.ok(Math.abs(Math.min(...mid.map((v) => v[1]))) < 1e-6, 'its foot stays on the ground');
  assert.ok(Math.abs((Math.min(...mid.map((v) => v[0])) + Math.max(...mid.map((v) => v[0]))) / 2) < 1e-6, 'under its middle');
  await run(d, 0.8);
  assert.equal(p.state, 'gone');
  assert.equal(mesh.stats.used, 0, 'nothing drawn');

  // Small rubble past its life, with no budget: it shrinks away too, not gone at once
  const c = make({}, true, 1);
  const small = c.d.addBox({ material: 'brick', size: [0.1, 0.1, 0.1], position: [0, 0.05, 0], loose: true })!;
  assert.ok(small.size < c.d.materials.brick.dustSize * 2);
  await run(c.d, 1 + c.d.materials.brick.rubbleLife + 0.2);
  assert.equal(small.state, 'rubble', 'still there, shrinking');
  await run(c.d, 1.3);
  assert.equal(small.state, 'gone');
});
