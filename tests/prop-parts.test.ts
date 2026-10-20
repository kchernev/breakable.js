import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as THREE from 'three/webgpu';
import { Destruction, type Piece, presets, type PropModel, type V3 } from '../src/lib/index.ts';
import { cylinder } from '../src/lib/shapes.ts';
import { asWorld, FakeBody, FakeJoint, FakeWorld } from './fake-world.ts';

const box = (min: V3, max: V3): V3[] => [min[0], max[0]].flatMap((x) => [min[1], max[1]].flatMap((y) => [min[2], max[2]].map((z) => [x, y, z] as V3)));

/** A forklift: a body, and forks out in front at the bottom. */
const forklift: PropModel = {
  name: 'forklift',
  object: new THREE.Group(),
  mass: 3,
  collider: [...box([-0.6, 0, -1], [0.6, 2, 1]), ...box([-0.5, 0, -2.2], [0.5, 0.1, -1])],
  colliders: [box([-0.6, 0, -1], [0.6, 2, 1]), box([-0.5, 0, -2.2], [-0.3, 0.1, -1]), box([0.3, 0, -2.2], [0.5, 0.1, -1])],
};

function make() {
  const w = new FakeWorld();
  const d = new Destruction({ world: asWorld(w), frameBudget: Infinity, materials: { metal: presets.metal(), brick: presets.brick() } });
  return { w, d };
}
const body = (b: unknown) => b as FakeBody;

test('a prop of several hulls is a body each, welded, as heavy as its model all told', () => {
  const { w, d } = make();
  const p = d.addProp({ model: forklift, material: 'metal', position: [5, 0, 0] })!;
  const parts = [p, ...[...p.bonds].map((b) => b.other(p))];
  assert.equal(parts.length, 3, 'its body and two forks');
  assert.ok(parts.every((q) => q.state === 'rubble' && q.prop === forklift));
  assert.ok(Math.abs(parts.reduce((s, q) => s + q.mass, 0) - 3) < 1e-9, 'its mass');
  // The space between the forks is open: a fork's hull doesn't reach the middle
  const forks = parts.slice(1);
  assert.ok(forks.every((f) => Math.abs((f.bounds.min[0] + f.bounds.max[0]) / 2 - 5) > 0.3));
  // Thrown, it moves as one: welded by joints that never break
  d.explode({ at: [5, 1, 1.5], radius: 3 });
  assert.ok(parts.every((q) => q.state === 'loose'), 'all thrown');
  const welds = w.joints.filter((j: FakeJoint) => !j.removed && parts.some((q) => body(q.body) === j.a) && parts.some((q) => body(q.body) === j.b));
  assert.equal(welds.length, 2);
  assert.ok(welds.every((j) => (j.options.breakForce as number) > 1e8));
  // Gone, it goes whole
  d.removePiece(forks[0]);
  assert.ok(parts.every((q) => q.state === 'gone'));
});

test("a round prop keeps as many hull corners as it's given, up to the solver's 32", () => {
  const { d } = make();
  const drum = (hullVertices?: number): PropModel => ({ name: 'drum', object: new THREE.Group(), mass: 0.2, collider: cylinder(0.3, 0.9, 24).map(([x, y, z]) => [x, y + 0.45, z] as V3), hullVertices });
  const corners = (m: PropModel) => {
    const p = d.addProp({ model: m, material: 'metal' })!;
    return new Set(p.local.faces.flatMap((f) => f.pts.map((q) => q.map((v) => v.toFixed(4)).join()))).size;
  };
  assert.equal(corners(drum()), 48, 'its look keeps every corner');
  // The solver's shape: 12 corners by default, 32 when asked
  const shapes = (m: PropModel) => (d as unknown as { props: Map<PropModel, { shape: { vertices: Float32Array } }> }).props.get(m)!.shape.vertices.length / 3;
  const plain = drum();
  const round = drum(32);
  corners(plain);
  corners(round);
  assert.equal(shapes(plain), 12);
  assert.equal(shapes(round), 32);
});

test('a hinge holds a piece swinging about its axis, to a piece or to the world', () => {
  const { w, d } = make();
  const beam = d.addBox({ material: 'brick', size: [1.2, 0.2, 0.2], position: [0, 3, 0] })!;
  const sign = d.addBox({ material: 'brick', size: [0.8, 0.5, 0.05], position: [0, 2.65, 0] })!;
  const h = d.hinge(sign, [0, 2.9, 0], [1, 0, 0], { to: beam });
  assert.equal(sign.state, 'loose', 'it swings');
  assert.equal(h.piece, sign);
  const joints = w.joints.filter((j) => !j.removed && j.b === body(sign.body));
  assert.equal(joints.length, 2);
  assert.ok(joints.every((j) => j.a === body(beam.body) && j.options.type === 'ball'));
  // Two points on the axis, as far apart as the sign is wide, the same point seen from each
  const world = (b: FakeBody, local: V3): V3 => {
    const q = new THREE.Quaternion(...b.rotation);
    return new THREE.Vector3(...local).applyQuaternion(q).add(new THREE.Vector3(...b.position)).toArray() as V3;
  };
  const ends = joints.map((j) => world(j.a, j.options.anchorA as V3));
  joints.forEach((j, k) => world(j.b, j.options.anchorB as V3).forEach((v, i) => assert.ok(Math.abs(v - ends[k][i]) < 1e-9)));
  assert.ok(Math.abs(Math.abs(ends[0][0] - ends[1][0]) - 0.8) < 1e-9 && ends.every((e) => Math.abs(e[1] - 2.9) < 1e-9 && Math.abs(e[2]) < 1e-9));
  // To the world: a hold that collides with nothing, gone with the piece
  const door = d.addBox({ material: 'brick', size: [0.6, 1.2, 0.05], position: [3, 1.2, 0] })!;
  const before = w.bodies.length;
  d.hinge(door, [2.7, 1.2, 0], [0, 1, 0]);
  assert.equal(w.bodies.length, before + 1, 'a hold');
  d.removePiece(door);
  assert.equal(w.bodies.length, before - 1, 'the door and its hold gone');
});

/** Updates that read the loose pieces back, and the readbacks' work done. */
async function run(d: Destruction, seconds: number): Promise<void> {
  for (let t = 0; t < seconds; t += 0.2) {
    d.update(0.2);
    for (let k = 0; k < 5; k++) await new Promise((r) => setImmediate(r));
  }
}

test("a prop's parts stay welded when it comes to rest unheld, jammed, or is let go", async () => {
  const { w, d } = make();
  let breaks = 0;
  d.on('bondBreak', () => breaks++);
  const weldsOf = (parts: Piece[]) => new Set(parts.flatMap((q) => [...q.bonds])).size;
  // Still, with nothing under it: its welds hold, and it settles whole
  const p = d.addProp({ model: forklift, material: 'metal', position: [0, 5, 0], loose: true })!;
  const parts = [p, ...[...p.bonds].map((b) => b.other(p))];
  await run(d, 4);
  assert.equal(weldsOf(parts), 2);
  assert.equal(breaks, 0);
  assert.ok(parts.every((q) => q.state === 'rubble'), parts.map((q) => q.state).join());
  // Let go by one part: it goes whole
  d.loosen(parts[1]);
  assert.ok(parts.every((q) => q.state === 'loose'));
  assert.equal(weldsOf(parts), 2);
  // Jammed against a wall with nothing under it: every part drops clear of it, still welded
  const wall = d.addBox({ material: 'brick', size: [0.4, 3, 6], position: [20.8, 1.5, 0], static: true })!;
  const q = d.addProp({ model: forklift, material: 'metal', position: [20, 0.5, 0], loose: true })!;
  const jammed = [q, ...[...q.bonds].map((b) => b.other(q))];
  await run(d, 1.2);
  assert.equal(weldsOf(jammed), 2);
  assert.ok(jammed.every((r) => body(r.body).group !== 1), 'each part passes through what it was jammed against');
  assert.ok(body(wall.body).collidesWith !== 0xffffffff);
  assert.equal(breaks, 0);
  assert.ok(w.joints.filter((j) => !j.removed).length >= 4, 'both props held by their welds');
});

test('a piece hanging on a hinge never freezes; once what it hangs from goes, it can', async () => {
  const { d } = make();
  const arm = d.addBox({ material: 'brick', size: [1.2, 0.2, 0.2], position: [0, 3, 0] })!;
  d.bond(d.addBox({ material: 'brick', size: [0.2, 3, 0.2], position: [-0.7, 1.5, 0], static: true })!, arm, 0.04);
  const sign = d.addBox({ material: 'brick', size: [0.8, 0.5, 0.05], position: [0, 2.65, 0] })!;
  const h = d.hinge(sign, [0, 2.9, 0], [1, 0, 0], { to: arm });
  const door = d.addBox({ material: 'brick', size: [0.6, 1.2, 0.05], position: [3, 1.5, 0] })!;
  const hd = d.hinge(door, [2.7, 1.5, 0], [0, 1, 0]);
  // Hanging still for 5 s: still swinging free
  await run(d, 5);
  assert.ok(h.holding && hd.holding);
  assert.equal(sign.state, 'loose');
  assert.equal(door.state, 'loose');
  assert.ok(!body(sign.body).fixed && !body(door.body).fixed);
  // Its arm gone (or its hinge taken off), it no longer hangs: it falls, or comes to rest like any piece
  d.removePiece(arm);
  hd.remove();
  assert.ok(!h.holding && !hd.holding);
  assert.ok(sign.state === 'loose' && !body(sign.body).fixed, 'free to fall');
  await run(d, 4);
  assert.equal(sign.state, 'rubble', 'nothing in the stand-in world moves it: it settles where it is');
  assert.equal(door.state, 'rubble');
});
