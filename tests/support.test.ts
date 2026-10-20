import assert from 'node:assert/strict';
import { test } from 'node:test';
import { boxConvex, quatFromAxisAngle, type V3 } from '../src/lib/index.ts';
import { vertices } from '../src/lib/convex.ts';
import { overhang, reachToward, touches } from '../src/lib/support.ts';

const near = (a: number, b: number, eps = 1e-6) => Math.abs(a - b) < eps;
/** The touches of a on b, within 3 cm (so as far as 3 cm up the edges that run into b). */
const on = (a: ReturnType<typeof boxConvex>, b: ReturnType<typeof boxConvex>) => touches(a, b, vertices(b), 0.03);

test('a box resting on another touches it across its bottom face, pushed straight up', () => {
  const base = boxConvex([2, 1, 2], [0, 0.5, 0]);
  const top = boxConvex([1, 1, 1], [0.2, 1.5, 0]);
  const t = on(top, base);
  assert.ok(t.length >= 4, `${t.length} touches`);
  for (const { at, n } of t) {
    assert.ok(at[1] > 1 - 1e-9 && at[1] < 1.03 + 1e-9, `at ${at}`);
    assert.ok(near(n[1], 1), `pushed ${n}`);
  }
  // Their outline, seen from above, is its bottom face
  const xs = t.map(({ at }) => at[0]);
  assert.ok(near(Math.min(...xs), -0.3) && near(Math.max(...xs), 0.7));
});

test('turned on the box under it, or standing on one edge, it is still pushed up where it touches', () => {
  const base = boxConvex([2, 1, 2], [0, 0.5, 0]);
  const turned = boxConvex([1, 1, 1], [0, 1.5, 0], quatFromAxisAngle([0, 1, 0], Math.PI / 4));
  const t = on(turned, base);
  assert.ok(t.length >= 4 && t.every(({ at, n }) => at[1] > 1 - 1e-9 && at[1] < 1.03 + 1e-9 && near(n[1], 1)));
  // On an edge: a cube turned 45° about z, its lowest edge along z on the base's top
  const h = Math.SQRT1_2;
  const edge = boxConvex([1, 1, 1], [0, 1 + h, 0], quatFromAxisAngle([0, 0, 1], Math.PI / 4));
  const e = on(edge, base);
  assert.ok(e.length >= 2, `${e.length} touches`);
  for (const { at, n } of e) {
    assert.ok(Math.abs(at[0]) <= 0.03 + 1e-9 && at[1] > 1 - 1e-9 && at[1] < 1.03 + 1e-9, `at ${at}`);
    assert.ok(near(n[1], 1), `pushed ${n}`);
  }
});

test('a plate on a post touches it at the corners of the post, pushed up', () => {
  const post = boxConvex([0.2, 1, 0.2], [0, 0.5, 0]);
  const plate = boxConvex([2, 0.2, 2], [0.5, 1.1, 0]);
  const t = on(plate, post);
  assert.equal(t.length, 4);
  assert.ok(t.every(({ at, n }) => near(at[1], 1) && Math.abs(at[0]) <= 0.1 + 1e-9 && near(n[1], 1)));
});

test('side by side, a box is pushed sideways; apart, it touches nothing', () => {
  const a = boxConvex([2, 1, 2], [0, 0.5, 0]);
  const beside = on(boxConvex([1, 1, 1], [1.51, 0.5, 0]), a);
  assert.ok(beside.length > 0);
  assert.ok(beside.every(({ n }) => near(n[0], 1) && near(n[1], 0)), 'from what it touches toward it: +x');
  assert.equal(on(boxConvex([1, 1, 1], [1.6, 0.5, 0]), a).length, 0, '10 cm apart');
});

test('overhang: how far a centre of mass is out past what holds it up, and the edge it would go over', () => {
  const square: V3[] = [
    [-0.5, 0, -0.5],
    [0.5, 0, -0.5],
    [0.5, 0, 0.5],
    [-0.5, 0, 0.5],
  ];
  const inside = overhang([0.1, 3, 0], square);
  assert.ok(near(inside.distance, -0.4), 'inside, by its distance to the nearest edge');
  const out = overhang([0.8, 3, 0.2], square);
  assert.ok(near(out.distance, 0.3));
  assert.deepEqual(out.edge.map((x) => Math.round(x * 1e6) / 1e6), [0.5, 0.2]);
  // Held at two points (a line): never over it, only near it
  const line = overhang([0, 1, 0.1], [
    [-1, 0, 0],
    [1, 0, 0],
  ]);
  assert.ok(near(line.distance, 0.1));
  assert.equal(overhang([0, 0, 0], []).distance, Infinity, 'nothing to hold it');
});

test('reachToward: how far the outline is from a point inside it, along a direction', () => {
  const square: V3[] = [
    [-0.5, 0, -0.5],
    [0.5, 0, -0.5],
    [0.5, 0, 0.5],
    [-0.5, 0, 0.5],
  ];
  assert.ok(near(reachToward(square, [0, 0], [1, 0]), 0.5));
  assert.ok(near(reachToward(square, [0, 0], [1, 1]), Math.SQRT1_2));
  assert.ok(near(reachToward(square, [0.2, 0], [3, 0]), 0.3), 'its length does not matter');
});
