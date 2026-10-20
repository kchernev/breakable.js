import assert from 'node:assert/strict';
import { test } from 'node:test';
import { boxConvex, hullConvex, signedDistance, vertices, volumeCentroid } from '../src/lib/convex.ts';
import { impactSeeds, voronoi } from '../src/lib/fracture.ts';
import { random, type V3 } from '../src/lib/math.ts';

const near = (a: number, b: number, tol: number, what = '') => assert.ok(Math.abs(a - b) <= tol, `${what} ${a} != ${b} (±${tol})`);

/** Every point is in the hull, and every corner of the hull is one of the points. */
function isHullOf(c: NonNullable<ReturnType<typeof hullConvex>>, points: V3[]): void {
  for (const p of points) assert.ok(signedDistance(c, p) < 1e-6, `point outside by ${signedDistance(c, p)}`);
  for (const v of vertices(c)) assert.ok(points.some((p) => Math.hypot(p[0] - v[0], p[1] - v[1], p[2] - v[2]) < 1e-5), `corner ${v} isn't a point`);
}

/** Milliseconds a call takes (the best of a few runs). */
function time(f: () => unknown, runs = 3): number {
  let best = Infinity;
  for (let k = 0; k < runs; k++) {
    const t = performance.now();
    f();
    best = Math.min(best, performance.now() - t);
  }
  return best;
}

test('a box from its corners, inner points and repeats is the box, its faces whole', () => {
  const rand = random(5);
  const box = boxConvex([2, 1, 0.5], [3, 1, -2]);
  const corners = vertices(box);
  const inner: V3[] = Array.from({ length: 40 }, () => [3 + (rand() - 0.5) * 1.9, 1 + (rand() - 0.5) * 0.9, -2 + (rand() - 0.5) * 0.4]);
  const c = hullConvex([...corners, ...inner, ...corners, ...corners.map((p) => [p[0] + 1e-9, p[1] - 1e-9, p[2]] as V3)])!;
  near(volumeCentroid(c).volume, 1, 1e-9, 'volume');
  assert.equal(c.faces.length, 6, 'six faces, each one polygon');
  assert.ok(c.faces.every((f) => f.pts.length === 4 && !f.inner));
  assert.equal(hullConvex([[0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0], [0.5, 0.5, 0]]), null, 'flat: no hull');
});

test("a Voronoi cell's corners, each listed three or four times, hull fast and exactly", () => {
  const rand = random(11);
  const piece = boxConvex([1.2, 0.9, 0.4], [10, 2, 5]);
  const cells = voronoi(piece, impactSeeds(piece, { at: [10, 2, 5], count: 14, spread: 0.3, rand }));
  let worst = 0;
  for (const cell of cells) {
    const listed = cell.convex.faces.flatMap((f) => f.pts);
    let hull = null as ReturnType<typeof hullConvex>;
    worst = Math.max(worst, time(() => (hull = hullConvex(listed))));
    near(volumeCentroid(hull!).volume, cell.volume, 1e-9, 'cell volume');
    assert.equal(hull!.faces.length, cell.convex.faces.length, 'the same faces');
    isHullOf(hull!, listed);
  }
  // It took 0.6-1 s a cell (every triple of points tried as a face, repeats and all)
  assert.ok(worst < 10, `slowest cell ${worst.toFixed(1)} ms`);
});

test('hulls of many points scale (points on a sphere)', (t) => {
  const rand = random(3);
  for (const n of [60, 200, 1000]) {
    const points: V3[] = Array.from({ length: n }, () => {
      const z = 2 * rand() - 1;
      const a = 2 * Math.PI * rand();
      const s = Math.sqrt(1 - z * z);
      return [s * Math.cos(a), z, s * Math.sin(a)];
    });
    let hull = null as ReturnType<typeof hullConvex>;
    const ms = time(() => (hull = hullConvex(points)), 2);
    t.diagnostic(`${n} points: ${ms.toFixed(1)} ms, ${hull!.faces.length} faces`);
    isHullOf(hull!, points);
    // Under the sphere's volume, and closing on it as the points do
    const v = volumeCentroid(hull!).volume;
    assert.ok(v < (4 / 3) * Math.PI && v > (n >= 200 ? 3.8 : 3.3), `volume ${v}`);
    // 60 points took ~30 ms (every triple of points tried as a face), and the time grew as the fourth power of their count.
    // The limits leave room for a loaded machine (200 points take ~6 ms alone, and went to 19 ms beside other work)
    assert.ok(ms < (n === 1000 ? 300 : 40), `${n} points: ${ms.toFixed(1)} ms`);
  }
});
