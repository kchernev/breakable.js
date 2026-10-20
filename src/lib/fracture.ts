// Voronoi fracture: a convex piece cut into the cells of seed points (each cell the part of the
// piece nearer its seed than any other, cut out by the planes halfway to the other seeds), and
// the seeds packed around where it broke, so pieces are small there and big further off.

import { clip, type Convex, reach, signedDistance, volumeCentroid, bounds } from './convex.ts';
import { add, distance, dot, normalize, scale, sub, type V3 } from './math.ts';

export interface Cell {
  convex: Convex;
  seed: V3;
  volume: number;
  centroid: V3;
}

/** Wood's grain: cells `stretch` times as long along `axis` (a unit vector) as across it. */
export interface Grain {
  axis: V3;
  stretch: number;
}

/**
 * The Voronoi cells of `seeds` inside `piece` (seeds outside it make no cell, or a sliver). With a
 * grain, nearness counts distance along its axis `stretch` times less: the cells of a space squashed
 * along it, stretched back, so they come out long that way (splinters).
 */
export function voronoi(piece: Convex, seeds: V3[], minVolume = 0, grain?: Grain): Cell[] {
  if (grain && grain.stretch !== 1 && seeds.length) {
    const { axis, stretch } = grain;
    const o = seeds[0];
    const squashed = voronoi(stretchConvex(piece, axis, 1 / stretch, o), seeds.map((s) => stretchPoint(s, axis, 1 / stretch, o)), minVolume / stretch);
    return squashed.map((cell) => {
      const convex = stretchConvex(cell.convex, axis, stretch, o);
      const { volume, centroid } = volumeCentroid(convex);
      return { convex, seed: stretchPoint(cell.seed, axis, stretch, o), volume, centroid };
    });
  }
  const cells: Cell[] = [];
  for (let i = 0; i < seeds.length; i++) {
    const s = seeds[i];
    // Nearest seeds first: once a seed is twice the cell's reach away, no farther one cuts it
    const others = seeds
      .map((q, j) => ({ q, j, d: distance(q, s) }))
      .filter((o) => o.j !== i && o.d > 1e-9)
      .sort((a, b) => a.d - b.d);
    let cell: Convex | null = piece;
    let r = reach(piece, s);
    for (const o of others) {
      if (o.d > 2 * r) break;
      const n = normalize(sub(o.q, s));
      const mid = scale(add(o.q, s), 0.5);
      const next: Convex | null = clip(cell!, n, dot(n, mid), true);
      if (!next) {
        cell = null;
        break;
      }
      if (next !== cell) {
        cell = next;
        r = reach(cell, s);
      }
    }
    if (!cell) continue;
    const { volume, centroid } = volumeCentroid(cell);
    if (volume > minVolume) cells.push({ convex: cell, seed: s, volume, centroid });
  }
  return cells;
}

/** p moved along unit `axis` to `k` times as far from `o` that way. */
function stretchPoint(p: V3, axis: V3, k: number, o: V3): V3 {
  return add(p, scale(axis, (k - 1) * dot(sub(p, o), axis)));
}

/** c stretched `k` times along unit `axis` about `o` (a plane's normal turns the other way). */
function stretchConvex(c: Convex, axis: V3, k: number, o: V3): Convex {
  return {
    faces: c.faces.map((f) => {
      const pts = f.pts.map((p) => stretchPoint(p, axis, k, o));
      const n = normalize(add(f.n, scale(axis, (1 / k - 1) * dot(f.n, axis))));
      return { pts, n, d: dot(n, pts[0]), inner: f.inner };
    }),
  };
}

export interface SeedOptions {
  /** Where it broke: seeds gather here. */
  at: V3;
  /** How many seeds (the piece breaks into about this many pieces). */
  count: number;
  /** How tightly they gather (metres): about half fall within this of `at`. */
  spread: number;
  rand: () => number;
}

/**
 * Seed points inside a piece, packed around `at`: distances from it drawn so that about half
 * fall within `spread` and the rest thin out to the far side of the piece, so the cells grow with
 * distance from the break. A few seeds always go to the far parts, so a long wall hit at one end
 * doesn't leave one sliver the length of the wall.
 */
export function impactSeeds(piece: Convex, o: SeedOptions): V3[] {
  const seeds: V3[] = [];
  const box = bounds(piece);
  const extent = sub(box.max, box.min);
  const far = Math.max(reach(piece, o.at), 1e-3);
  const inside = (p: V3) => signedDistance(piece, p) < -1e-4;
  let tries = 0;
  const near = Math.max(1, Math.round(o.count * 0.8));
  // Distance from the break r = far·u^k, its median `spread` (an even spread of distances is
  // already dense near the break: the shells there are small)
  const k = Math.max(1, Math.log2(far / Math.max(o.spread, 1e-3)));
  while (seeds.length < near && tries++ < o.count * 60) {
    const r = far * Math.pow(o.rand(), k);
    const dir = sphereDirection(o.rand);
    const p = add(o.at, scale(dir, r));
    if (inside(p)) seeds.push(p);
  }
  // The rest spread evenly over the piece
  tries = 0;
  while (seeds.length < o.count && tries++ < o.count * 60) {
    const p: V3 = [box.min[0] + o.rand() * extent[0], box.min[1] + o.rand() * extent[1], box.min[2] + o.rand() * extent[2]];
    if (inside(p)) seeds.push(p);
  }
  return seeds;
}

/** Seeds spread evenly through a piece (a pane shattering, a section splitting where it lands). */
export function uniformSeeds(piece: Convex, count: number, rand: () => number): V3[] {
  const box = bounds(piece);
  const extent = sub(box.max, box.min);
  const seeds: V3[] = [];
  let tries = 0;
  while (seeds.length < count && tries++ < count * 60) {
    const p: V3 = [box.min[0] + rand() * extent[0], box.min[1] + rand() * extent[1], box.min[2] + rand() * extent[2]];
    if (signedDistance(piece, p) < -1e-4) seeds.push(p);
  }
  return seeds;
}

function sphereDirection(rand: () => number): V3 {
  const z = 2 * rand() - 1;
  const a = 2 * Math.PI * rand();
  const s = Math.sqrt(1 - z * z);
  return [s * Math.cos(a), s * Math.sin(a), z];
}
