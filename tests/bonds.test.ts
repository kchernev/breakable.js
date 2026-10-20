import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Destruction, domePiece, presets, quatFromAxisAngle, type BondTolerance, type V3 } from '../src/lib/index.ts';
import { asWorld, FakeWorld } from './fake-world.ts';

function make() {
  return new Destruction({ world: asWorld(new FakeWorld()), frameBudget: Infinity, materials: { stone: presets.concrete() } });
}

/** A block, and a second one on it turned `tilt` rad about x, lifted `lift` m (at its middle). */
function stack(tilt: number, lift: number, bond: boolean | BondTolerance, at: V3 = [0, 0, 0]) {
  const d = make();
  const base = d.addBox({ material: 'stone', size: [1, 0.5, 0.6], position: [at[0], at[1] + 0.25, at[2]] })!;
  const top = d.addBox({ material: 'stone', size: [1, 0.5, 0.6], position: [at[0], at[1] + 0.75 + lift, at[2]], rotation: quatFromAxisAngle([1, 0, 0], tilt), bond })!;
  return { d, base, top, area: [...top.bonds].find((b) => b.other(top) === base)?.area ?? 0 };
}

test('faces a little apart, or a little turned, bond when the piece says how loosely', () => {
  // 5 mm apart: not by default (a gap left on purpose stays one), yes within 1 cm
  assert.equal(stack(0, 0.005, true).area, 0);
  assert.ok(Math.abs(stack(0, 0.005, { gap: 0.01 }).area - 0.6) < 1e-9);
  // Turned 1.5°, its middle on the block: its ends 8 mm off. Not by default; yes within 1 cm and 3°
  const tilt = 1.5 * (Math.PI / 180);
  assert.equal(stack(tilt, 0, true).area, 0);
  const loose = stack(tilt, 0, { gap: 0.01, angle: 0.05 }).area;
  assert.ok(loose > 0.55, `area ${loose}`);
  // The same far from the origin (planes' offsets mean nothing for turned faces)
  assert.ok(Math.abs(stack(tilt, 0, { gap: 0.01, angle: 0.05 }, [500, 20, -300]).area - loose) < 1e-6);
  // Turned more than the angle allows: no
  assert.equal(stack(4 * (Math.PI / 180), 0, { gap: 0.05, angle: 0.05 }).area, 0);
});

test('faces that only meet at an edge, opening up from it, do not bond', () => {
  // Turned 1.5° and resting on one edge: 16 mm open at the other
  const tilt = 1.5 * (Math.PI / 180);
  const lift = 0.3 * Math.sin(tilt);
  assert.equal(stack(tilt, lift, { gap: 0.01, angle: 0.05 }).area, 0);
});

test("a piece's cells bond as loosely as it did", () => {
  const tilt = 1.5 * (Math.PI / 180);
  const { d, base, top } = stack(tilt, 0, { gap: 0.01, angle: 0.05 });
  const r = d.explode({ at: [0.45, 1.2, 0], radius: 0.4, speed: 0.1 });
  assert.equal(top.state, 'gone');
  const standing = r.made.filter((p) => p.state === 'fixed');
  assert.ok(standing.some((p) => [...p.bonds].some((b) => b.other(p) === base)), 'its cells still bond to the block under them');
});

test("a dome's shell pieces bond by themselves, rings of 16 under rings of 8 included", () => {
  const d = make();
  const deg = Math.PI / 180;
  const ringOf = (n: number, b0: number, b1: number) =>
    Array.from({ length: n }, (_, i) => {
      const [a0, a1] = [(i / n) * 2 * Math.PI, ((i + 1) / n) * 2 * Math.PI];
      const points = domePiece(2.9, 3.2, a0, a1, b0, b1);
      // Under a ring of twice as many: its foot has a corner at its middle, so it meets both
      if (n === 8) for (const r of [2.9, 3.2]) points.push([r * Math.cos(b0) * Math.cos((a0 + a1) / 2), r * Math.sin(b0), r * Math.cos(b0) * Math.sin((a0 + a1) / 2)]);
      return d.addConvex({ material: 'stone', points, position: [-21, 7.3, 15] })!;
    });
  const low = ringOf(16, 0, 22.5 * deg);
  const high = ringOf(8, 22.5 * deg, 45 * deg);
  const between = high.reduce((s, p) => s + [...p.bonds].filter((b) => low.includes(b.other(p))).length, 0);
  assert.equal(between, 16);
  assert.ok(high.every((p) => [...p.bonds].filter((b) => high.includes(b.other(p))).length === 2), 'each to its neighbours round the ring');
});

test('a piece bonds to a looser neighbour whichever is built first', () => {
  // 5 mm apart: within the loose piece's gap, not the default's
  for (const looseFirst of [true, false]) {
    const d = make();
    const add = (loose: boolean) => d.addBox({ material: 'stone', size: [1, 0.5, 1], position: [0, loose ? 0.25 : 0.755, 0], bond: loose ? { gap: 0.01 } : true })!;
    const [a, b] = looseFirst ? [add(true), add(false)] : [add(false), add(true)];
    assert.ok([...a.bonds].some((x) => x.other(a) === b), looseFirst ? 'loose one first' : 'default one first');
  }
});
