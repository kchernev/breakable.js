import assert from 'node:assert/strict';
import { test } from 'node:test';
import { arch, arcBlock, cylinder, Destruction, pointedArch, presets, prism } from '../src/lib/index.ts';
import { asWorld, FakeWorld } from './fake-world.ts';

function make() {
  const w = new FakeWorld();
  const d = new Destruction({ world: asWorld(w), frameBudget: Infinity, materials: { stone: presets.concrete(), wood: presets.wood() } });
  return { w, d };
}

test('a column of drums stands, each drum bonded to the next by its face', () => {
  const { d } = make();
  const drums = [0, 1, 2].map((k) => d.addConvex({ material: 'stone', points: cylinder(0.4, 1, 16), position: [0, k, 0] })!);
  for (const [a, b] of [
    [drums[0], drums[1]],
    [drums[1], drums[2]],
  ]) {
    const bond = [...a.bonds].find((x) => x.other(a) === b);
    assert.ok(bond, 'bonded');
    // The area of a 16-gon of radius 0.4
    assert.ok(Math.abs(bond!.area - 0.5 * 16 * 0.16 * Math.sin((2 * Math.PI) / 16)) < 1e-6, `area ${bond!.area}`);
  }
  d.update(0.016);
  assert.ok(drums.every((p) => p.state === 'fixed'));
});

test('an arch on two piers stands; take a pier away and it falls', () => {
  const { d } = make();
  const span = 2;
  const piers = [-1, 1].map((side) => d.addBox({ material: 'stone', size: [0.5, 2, 0.5], position: [side * (span / 2 + 0.25), 1, 0] })!);
  const stones = arch(span, 0.5, 0.5, 7).map((v) => d.addConvex({ material: 'stone', points: v.points, position: [0, 2, 0] })!);
  // Each voussoir bonds to the next, the ends to the piers
  for (let i = 0; i + 1 < stones.length; i++) assert.ok([...stones[i].bonds].some((b) => b.other(stones[i]) === stones[i + 1]), `voussoir ${i}`);
  assert.ok([...stones[0].bonds].some((b) => piers.includes(b.other(stones[0]) as never)));
  d.update(0.016);
  assert.ok(stones.every((p) => p.state === 'fixed'));
  d.removePiece(piers[0]);
  d.update(0.016);
  // What's left reaches the ground through the other pier, so it hangs on until it's weighed
  assert.ok(stones.some((p) => p.state === 'fixed'));
});

test('a tower course of arc blocks closes into a ring, each block bonded to its neighbours', () => {
  const { d } = make();
  const n = 10;
  const blocks = Array.from({ length: n }, (_, i) => d.addConvex({ material: 'stone', points: arcBlock(2, 2.6, (i / n) * 2 * Math.PI, ((i + 1) / n) * 2 * Math.PI, 0.6), position: [0, 0, 0] })!);
  for (let i = 0; i < n; i++) assert.ok([...blocks[i].bonds].some((b) => b.other(blocks[i]) === blocks[(i + 1) % n]), `block ${i}`);
});

test('a gable roof prism rests on a wall it touches', () => {
  const { d } = make();
  const wall = d.addBox({ material: 'wood', size: [4, 2, 3], position: [0, 1, 0] })!;
  const roof = d.addConvex({ material: 'wood', points: prism([[-2, 0], [2, 0], [0, 1.2]], 3), position: [0, 2, 0] })!;
  assert.ok([...roof.bonds].some((b) => b.other(roof) === wall));
});

test('a pointed arch on two piers stands, its halves bonded in a vertical joint at the crown', () => {
  const { d } = make();
  const span = 2;
  const stones = pointedArch(span, 0.4, 0.5, 8);
  assert.equal(stones.length, 8);
  // Equilateral: the crown's intrados is span·√3/2 up
  const crown = Math.max(...stones.flatMap((v) => v.points.filter((p) => Math.abs(p[0]) < 1e-9).map((p) => p[1])));
  assert.ok(Math.abs(crown - Math.sqrt((span + 0.4) ** 2 - (span / 2) ** 2)) < 1e-9, `extrados crown ${crown}`);
  const piers = [-1, 1].map((side) => d.addBox({ material: 'stone', size: [0.4, 2, 0.5], position: [side * (span / 2 + 0.2), 1, 0] })!);
  const pieces = stones.map((v) => d.addConvex({ material: 'stone', points: v.points, position: [0, 2, 0] })!);
  for (let i = 0; i + 1 < pieces.length; i++) assert.ok([...pieces[i].bonds].some((b) => b.other(pieces[i]) === pieces[i + 1]), `voussoir ${i} to ${i + 1}`);
  assert.ok([...pieces[0].bonds].some((b) => b.other(pieces[0]) === piers[0]), 'left springer on its pier');
  assert.ok([...pieces[7].bonds].some((b) => b.other(pieces[7]) === piers[1]), 'right springer on its pier');
  // The crown joint is vertical, the voussoirs' outer corners rise to it from each side
  const joint = [...pieces[3].bonds].find((b) => b.other(pieces[3]) === pieces[4])!;
  assert.ok(Math.abs(Math.abs(joint.normal[0]) - 1) < 1e-9);
  for (let i = 0; i < 4; i++) assert.ok(stones[i].outer[1][1] > stones[i].outer[0][1] && stones[7 - i].outer[0][1] > stones[7 - i].outer[1][1]);
  for (let k = 0; k < 10; k++) d.update(0.1);
  assert.ok(pieces.every((p) => p.state === 'fixed'));
  // Without its piers it has nothing to stand on
  for (const p of piers) d.removePiece(p);
  for (let k = 0; k < 10; k++) d.update(0.1);
  assert.ok(pieces.every((p) => p.state === 'loose'));
});
