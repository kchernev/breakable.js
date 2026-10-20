import assert from 'node:assert/strict';
import { test } from 'node:test';
import { contactPatch } from '../src/lib/contact.ts';
import { boxConvex, clip, hullConvex, raycastConvex, signedDistance, volumeCentroid } from '../src/lib/convex.ts';
import { impactSeeds, voronoi } from '../src/lib/fracture.ts';
import { quatFromAxisAngle, random, type V3 } from '../src/lib/math.ts';

const near = (a: number, b: number, tol = 1e-9) => assert.ok(Math.abs(a - b) <= tol, `${a} != ${b} (±${tol})`);

test('a box has its volume and centre', () => {
  const b = boxConvex([2, 3, 4], [1, 2, 3], quatFromAxisAngle([1, 1, 0], 0.7));
  const { volume, centroid } = volumeCentroid(b);
  near(volume, 24, 1e-9);
  centroid.forEach((c, i) => near(c, [1, 2, 3][i], 1e-9));
});

test('a cut keeps the near side and marks its new face inner', () => {
  const b = boxConvex([2, 2, 2]);
  const half = clip(b, [1, 0, 0], 0)!;
  near(volumeCentroid(half).volume, 4);
  assert.equal(half.faces.length, 6);
  assert.equal(half.faces.filter((f) => f.inner).length, 1);
  // A slanted cut through a corner: a tetrahedron's worth goes
  const corner = clip(b, [Math.SQRT1_2, Math.SQRT1_2, 0], Math.SQRT1_2 * 1)!;
  near(volumeCentroid(corner).volume, 7, 1e-9); // x + y > 1 goes: a prism of 0.5 (the triangle) × 2
  assert.equal(clip(b, [1, 0, 0], 5), b, 'a plane that misses leaves it as it was');
  assert.equal(clip(b, [1, 0, 0], -5), null, 'a plane past it leaves nothing');
  // A cut along a face changes nothing and makes no second face there
  const flush = clip(b, [1, 0, 0], 1);
  assert.equal(flush, b);
});

test('Voronoi cells fill the piece exactly once', () => {
  const rand = random(7);
  const piece = boxConvex([4, 3, 0.3], [0, 1.5, 0], quatFromAxisAngle([0, 1, 0], 0.4));
  const seeds = impactSeeds(piece, { at: [0.5, 1.2, 0], count: 30, spread: 0.6, rand });
  assert.ok(seeds.length >= 25, `seeds: ${seeds.length}`);
  const cells = voronoi(piece, seeds);
  const total = cells.reduce((s, c) => s + c.volume, 0);
  near(total, 4 * 3 * 0.3, 1e-6);
  // Random points inside: each in exactly one cell
  for (let k = 0; k < 400; k++) {
    const p: V3 = [(rand() - 0.5) * 4, rand() * 3, (rand() - 0.5) * 0.4];
    if (signedDistance(piece, p) > -1e-3) continue;
    const owners = cells.filter((c) => signedDistance(c.convex, p) < -1e-7).length;
    assert.ok(owners <= 1, `point in ${owners} cells`);
  }
  // Cells near the break are smaller than those far off
  const byDistance = [...cells].sort((a, b) => dist(a.centroid, [0.5, 1.2, 0]) - dist(b.centroid, [0.5, 1.2, 0]));
  const third = Math.floor(cells.length / 3);
  const mean = (xs: typeof cells) => xs.reduce((s, c) => s + c.volume, 0) / xs.length;
  assert.ok(mean(byDistance.slice(0, third)) < mean(byDistance.slice(-third)), 'cells grow away from the break');
});

test('touching boxes share a patch the size of their overlap', () => {
  const a = boxConvex([2, 1, 1], [0, 0.5, 0]);
  const b = boxConvex([1, 1, 1], [0.5, 1.5, 0.25]);
  const p = contactPatch(a, b)!;
  near(p.area, 1 * 0.75, 1e-9);
  near(p.normal[1], 1);
  near(p.center[0], 0.5);
  near(p.center[2], 0.125);
  assert.equal(contactPatch(a, boxConvex([1, 1, 1], [0, 3, 0])), null, 'apart: no patch');
});

test('neighbouring Voronoi cells are bonded across their shared face', () => {
  const rand = random(3);
  const piece = boxConvex([2, 2, 0.25]);
  const cells = voronoi(piece, impactSeeds(piece, { at: [0, 0, 0], count: 12, spread: 0.5, rand }));
  let bonded = 0;
  for (let i = 0; i < cells.length; i++)
    for (let j = i + 1; j < cells.length; j++) {
      const p = contactPatch(cells[i].convex, cells[j].convex);
      if (p) bonded++;
    }
  assert.ok(bonded >= cells.length - 1, 'enough bonds to connect the cells');
});

test('a ray enters a convex piece at its face', () => {
  const b = boxConvex([2, 2, 2]);
  const hit = raycastConvex(b, [-5, 0.3, 0.2], [1, 0, 0])!;
  near(hit.t, 4);
  assert.deepEqual(hit.n, [-1, 0, 0]);
  assert.equal(raycastConvex(b, [-5, 3, 0], [1, 0, 0]), null);
});

test('hullConvex wraps points into a convex piece', () => {
  const pts: V3[] = [
    [0, 0, 0],
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1],
    [0.1, 0.1, 0.1],
  ];
  const h = hullConvex(pts)!;
  near(volumeCentroid(h).volume, 1 / 6, 1e-6);
  assert.equal(h.faces.length, 4);
});

function dist(a: V3, b: V3) {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

test('a cell made a solver shape from its faces matches the one the solver makes of its corners', async () => {
  const { hullShape } = await import('../src/lib/hull-shape.ts');
  const { convexHull } = await import('three-avbd');
  const { vertices } = await import('../src/lib/convex.ts');
  const rand = random(11);
  const piece = boxConvex([3, 2.5, 0.3], [40, 7, -12], quatFromAxisAngle([0.3, 1, 0.1], 0.6));
  const cells = voronoi(piece, impactSeeds(piece, { at: [40.2, 7.1, -12], count: 16, spread: 0.5, rand }));
  for (const cell of cells) {
    const mine = hullShape(cell.convex)!;
    const theirs = convexHull(vertices(cell.convex).flat())!;
    near(mine.volume, theirs.volume, 1e-6);
    mine.center.forEach((c, i) => near(c, theirs.center[i], 1e-5));
    const sorted = (m: number[]) => [...m].sort((a, b) => a - b);
    sorted(mine.moments).forEach((m, i) => near(m, sorted(theirs.moments)[i], 1e-6 + 1e-4 * Math.abs(m)));
    sorted(mine.size).forEach((s, i) => near(s, sorted(theirs.size)[i], 1e-4));
    assert.equal(mine.vertices.length, theirs.vertices.length, 'the same corners');
    assert.equal(mine.edges.length, theirs.edges.length, 'the same edges');
  }
});

test('along a grain, cells come out long: splinters', () => {
  const board = boxConvex([2, 2, 2]);
  const rand = random(9);
  const seeds: V3[] = Array.from({ length: 40 }, () => [(rand() - 0.5) * 2, (rand() - 0.5) * 2, (rand() - 0.5) * 2]);
  // How long each cell is along x against across (its bounds)
  const shape = (cells: ReturnType<typeof voronoi>) => {
    let along = 0;
    let across = 0;
    for (const c of cells) {
      const xs = c.convex.faces.flatMap((f) => f.pts.map((p) => p[0]));
      const ys = c.convex.faces.flatMap((f) => f.pts.map((p) => p[1]));
      const zs = c.convex.faces.flatMap((f) => f.pts.map((p) => p[2]));
      along += Math.max(...xs) - Math.min(...xs);
      across += (Math.max(...ys) - Math.min(...ys) + Math.max(...zs) - Math.min(...zs)) / 2;
    }
    return along / across;
  };
  const plain = voronoi(board, seeds);
  const grained = voronoi(board, seeds, 0, { axis: [1, 0, 0], stretch: 4 });
  near(grained.reduce((s, c) => s + c.volume, 0), 8, 1e-6);
  for (const c of grained) near(volumeCentroid(c.convex).volume, c.volume, 1e-9);
  assert.ok(shape(grained) > 2 * shape(plain), `${shape(grained)} vs ${shape(plain)}`);
  // Each still holds its seed, and the cells touch face to face (they bond)
  for (const c of grained) assert.ok(signedDistance(c.convex, c.seed) < 1e-9);
  let bonded = 0;
  for (let i = 0; i < grained.length; i++) for (let j = i + 1; j < grained.length; j++) if (contactPatch(grained[i].convex, grained[j].convex)) bonded++;
  assert.ok(bonded >= grained.length - 1);
});
