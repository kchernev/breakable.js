// Convex polyhedra as lists of planar faces: built from boxes, cut by planes (each cut leaves a
// new face, marked inner: a broken surface, not the outside of the object), and measured. Every
// fracture piece is one of these, so each collides in the solver as a convex hull and each cut
// is exact.

import { type Box3, type V3, add, basis, cross, dot, length, normalize, rotate, scale, sub, type Q } from './math.ts';

export interface Face {
  /** Corners, counter-clockwise seen from outside. */
  pts: V3[];
  /** Outward unit normal; the face's plane is n·x = d. */
  n: V3;
  d: number;
  /** A surface the object broke along (drawn with the material's inside), not its outside. */
  inner: boolean;
}

export interface Convex {
  faces: Face[];
}

/** Points closer than this to a plane are on it (metres). */
export const EPS = 1e-6;

/** A box of full widths `size`, centred at `center`, turned by `rotation`. */
export function boxConvex(size: V3, center: V3 = [0, 0, 0], rotation: Q = [0, 0, 0, 1]): Convex {
  const [hx, hy, hz] = [size[0] / 2, size[1] / 2, size[2] / 2];
  const corner = (x: number, y: number, z: number): V3 => add(rotate(rotation, [x * hx, y * hy, z * hz]), center);
  // Corners of each face, counter-clockwise seen from outside, and the face's local normal
  const quads: Array<[V3, V3[]]> = [
    [[1, 0, 0], [corner(1, -1, -1), corner(1, 1, -1), corner(1, 1, 1), corner(1, -1, 1)]],
    [[-1, 0, 0], [corner(-1, -1, -1), corner(-1, -1, 1), corner(-1, 1, 1), corner(-1, 1, -1)]],
    [[0, 1, 0], [corner(-1, 1, -1), corner(-1, 1, 1), corner(1, 1, 1), corner(1, 1, -1)]],
    [[0, -1, 0], [corner(-1, -1, -1), corner(1, -1, -1), corner(1, -1, 1), corner(-1, -1, 1)]],
    [[0, 0, 1], [corner(-1, -1, 1), corner(1, -1, 1), corner(1, 1, 1), corner(-1, 1, 1)]],
    [[0, 0, -1], [corner(-1, -1, -1), corner(-1, 1, -1), corner(1, 1, -1), corner(1, -1, -1)]],
  ];
  return {
    faces: quads.map(([local, pts]) => {
      const n = rotate(rotation, local);
      return { pts, n, d: dot(n, pts[0]), inner: false };
    }),
  };
}

/**
 * The convex hull of points as a Convex: for authoring pieces that aren't boxes. Points closer
 * than EPS are one (a Voronoi cell's faces list each corner three or four times). An incremental
 * hull of the rest, its triangles within EPS of one plane merged into one face, corners along a
 * face's edge dropped. Null when the points span no volume.
 */
export function hullConvex(points: V3[]): Convex | null {
  const pts = weld(points, EPS);
  const tris = pts.length >= 4 ? hullTriangles(pts) : null;
  return tris && mergeFaces(pts, tris);
}

/** Points with those within `tolerance` of one kept merged into it (a hash grid of that size). */
function weld(points: V3[], tolerance: number): V3[] {
  const grid = new Map<string, V3[]>();
  const out: V3[] = [];
  const key = (x: number, y: number, z: number) => `${x},${y},${z}`;
  for (const p of points) {
    const [x, y, z] = [Math.floor(p[0] / tolerance), Math.floor(p[1] / tolerance), Math.floor(p[2] / tolerance)];
    let near = false;
    for (let dx = -1; dx <= 1 && !near; dx++)
      for (let dy = -1; dy <= 1 && !near; dy++)
        for (let dz = -1; dz <= 1 && !near; dz++)
          for (const q of grid.get(key(x + dx, y + dy, z + dz)) ?? [])
            if (Math.abs(q[0] - p[0]) <= tolerance && Math.abs(q[1] - p[1]) <= tolerance && Math.abs(q[2] - p[2]) <= tolerance) near = true;
    if (near) continue;
    out.push(p);
    const k = key(x, y, z);
    const cell = grid.get(k);
    if (cell) cell.push(p);
    else grid.set(k, [p]);
  }
  return out;
}

/** A hull triangle: corners (indices, counter-clockwise from outside), outward normal, plane n·x = d. */
interface Tri {
  v: [number, number, number];
  n: V3;
  d: number;
}

/**
 * The points' hull as triangles, by an incremental hull: from a tetrahedron of extreme points, the
 * farthest points first, each replacing the triangles it's in front of by a fan from their horizon.
 * A point less than EPS in front is on the hull already. Null when the points are flat (or on a line).
 */
function hullTriangles(p: V3[]): Tri[] | null {
  // The first tetrahedron: the lowest x, the farthest from it, the farthest from their line, from their plane
  const farthest = (score: (v: V3) => number) => {
    let best = -Infinity;
    let at = -1;
    p.forEach((v, i) => {
      const s = score(v);
      if (s > best) [best, at] = [s, i];
    });
    return { at, best };
  };
  const i0 = farthest((v) => -v[0]).at;
  const { at: i1, best: d1 } = farthest((v) => length(sub(v, p[i0])));
  if (d1 < EPS) return null;
  const e01 = sub(p[i1], p[i0]);
  const { at: i2, best: d2 } = farthest((v) => length(cross(e01, sub(v, p[i0]))));
  if (d2 < EPS * d1) return null;
  const n012 = cross(e01, sub(p[i2], p[i0]));
  const { at: i3, best: d3 } = farthest((v) => Math.abs(dot(n012, sub(v, p[i0]))));
  if (d3 < EPS * length(n012)) return null;

  const N = p.length;
  const tris = new Set<Tri>();
  // Each directed edge's triangle (key a·N + b), so a triangle's neighbours are found at once
  const byEdge = new Map<number, Tri>();
  const addTri = (a: number, b: number, c: number) => {
    const n = normalize(cross(sub(p[b], p[a]), sub(p[c], p[a])));
    const t: Tri = { v: [a, b, c], n, d: dot(n, p[a]) };
    tris.add(t);
    for (let k = 0; k < 3; k++) byEdge.set(t.v[k] * N + t.v[(k + 1) % 3], t);
  };
  const base = dot(n012, sub(p[i3], p[i0])) > 0 ? [i0, i2, i1] : [i0, i1, i2];
  addTri(base[0], base[1], base[2]);
  addTri(base[0], i3, base[1]);
  addTri(base[1], i3, base[2]);
  addTri(base[2], i3, base[0]);
  const centre = scale(add(add(p[i0], p[i1]), add(p[i2], p[i3])), 0.25);
  const order = p.map((_, i) => i).filter((i) => i !== i0 && i !== i1 && i !== i2 && i !== i3);
  order.sort((a, b) => length(sub(p[b], centre)) - length(sub(p[a], centre)));
  for (const i of order) {
    // The triangles it's in front of (none: it's inside), grown across neighbours it's level
    // with, so a flat face's triangles go together
    const region = new Set<Tri>();
    for (const t of tris) if (dot(t.n, p[i]) - t.d > EPS) region.add(t);
    if (!region.size) continue;
    const queue = [...region];
    while (queue.length) {
      const t = queue.pop()!;
      for (let k = 0; k < 3; k++) {
        const u = byEdge.get(t.v[(k + 1) % 3] * N + t.v[k]);
        if (u && !region.has(u) && dot(u.n, p[i]) - u.d > -EPS) {
          region.add(u);
          queue.push(u);
        }
      }
    }
    // The horizon: edges of the region whose other side stays
    const horizon: Array<[number, number]> = [];
    for (const t of region)
      for (let k = 0; k < 3; k++) {
        const u = byEdge.get(t.v[(k + 1) % 3] * N + t.v[k]);
        if (!u || !region.has(u)) horizon.push([t.v[k], t.v[(k + 1) % 3]]);
      }
    for (const t of region) {
      tris.delete(t);
      for (let k = 0; k < 3; k++) if (byEdge.get(t.v[k] * N + t.v[(k + 1) % 3]) === t) byEdge.delete(t.v[k] * N + t.v[(k + 1) % 3]);
    }
    for (const [a, b] of horizon) addTri(a, b, i);
  }
  return [...tris];
}

/**
 * Hull triangles as a Convex: neighbours within EPS of a triangle's plane join its face (a face's
 * outline is the loop of its triangles' outer edges), and corners on a straight run of the outline
 * go. Null when a face's outline isn't one loop (round-off on a degenerate hull).
 */
function mergeFaces(p: V3[], tris: Tri[]): Convex | null {
  const N = p.length;
  const byEdge = new Map<number, Tri>();
  for (const t of tris) for (let k = 0; k < 3; k++) byEdge.set(t.v[k] * N + t.v[(k + 1) % 3], t);
  const done = new Set<Tri>();
  const faces: Face[] = [];
  for (const seed of tris) {
    if (done.has(seed)) continue;
    const group = [seed];
    done.add(seed);
    for (let g = 0; g < group.length; g++)
      for (let k = 0; k < 3; k++) {
        const t = group[g];
        const u = byEdge.get(t.v[(k + 1) % 3] * N + t.v[k]);
        if (u && !done.has(u) && u.v.every((i) => Math.abs(dot(seed.n, p[i]) - seed.d) <= EPS)) {
          done.add(u);
          group.push(u);
        }
      }
    // The outline: each outer edge's start to its end, walked from any
    const inGroup = new Set(group);
    const next = new Map<number, number>();
    let normal: V3 = [0, 0, 0];
    for (const t of group) {
      normal = add(normal, scale(cross(sub(p[t.v[1]], p[t.v[0]]), sub(p[t.v[2]], p[t.v[0]])), 0.5));
      for (let k = 0; k < 3; k++) {
        const [a, b] = [t.v[k], t.v[(k + 1) % 3]];
        const u = byEdge.get(b * N + a);
        if (!u || !inGroup.has(u)) {
          if (next.has(a)) return null;
          next.set(a, b);
        }
      }
    }
    const loop: number[] = [];
    const first = next.keys().next().value!;
    for (let v = first; loop.length <= next.size; v = next.get(v)!) {
      loop.push(v);
      if (next.get(v) === first) break;
    }
    if (loop.length !== next.size) return null;
    // Corners on a straight run of the outline (a point on an edge of the hull) go
    const pts = loop.filter((v, k) => {
      const a = p[loop[(k + loop.length - 1) % loop.length]];
      const c = p[loop[(k + 1) % loop.length]];
      return length(cross(sub(p[v], a), sub(c, a))) > EPS * length(sub(c, a));
    }).map((v) => p[v]);
    if (pts.length < 3) continue;
    const n = normalize(normal);
    let d = -Infinity;
    for (const q of pts) d = Math.max(d, dot(n, q));
    faces.push({ pts, n, d, inner: false });
  }
  return faces.length >= 4 ? { faces } : null;
}

/** The face's corners in order, without repeats (points closer than EPS merged). */
function dedupeRing(pts: V3[]): V3[] {
  const out: V3[] = [];
  for (const p of pts) {
    const last = out[out.length - 1];
    if (!last || Math.abs(last[0] - p[0]) > EPS || Math.abs(last[1] - p[1]) > EPS || Math.abs(last[2] - p[2]) > EPS) out.push(p);
  }
  while (out.length > 1) {
    const [a, b] = [out[0], out[out.length - 1]];
    if (Math.abs(a[0] - b[0]) > EPS || Math.abs(a[1] - b[1]) > EPS || Math.abs(a[2] - b[2]) > EPS) break;
    out.pop();
  }
  return out;
}

/** Twice the area vector of a polygon (its normal times twice its area). */
export function areaVector(pts: V3[]): V3 {
  let s: V3 = [0, 0, 0];
  for (let i = 1; i + 1 < pts.length; i++) s = add(s, cross(sub(pts[i], pts[0]), sub(pts[i + 1], pts[0])));
  return s;
}

/**
 * The part of `c` on the side n·x <= d, with the cut made a new face (inner, as marked), or
 * null when nothing is left. `c` itself comes back when the plane misses it.
 */
export function clip(c: Convex, n: V3, d: number, inner = true): Convex | null {
  let anyOut = false;
  let anyIn = false;
  for (const f of c.faces)
    for (const p of f.pts) {
      const s = dot(n, p) - d;
      if (s > EPS) anyOut = true;
      else if (s < -EPS) anyIn = true;
    }
  if (!anyOut) return c;
  if (!anyIn) return null;

  const faces: Face[] = [];
  const onPlane: V3[] = [];
  for (const f of c.faces) {
    const out: V3[] = [];
    const m = f.pts.length;
    for (let i = 0; i < m; i++) {
      const a = f.pts[i];
      const b = f.pts[(i + 1) % m];
      const sa = dot(n, a) - d;
      const sb = dot(n, b) - d;
      if (sa <= EPS) out.push(a);
      if (Math.abs(sa) <= EPS) onPlane.push(a);
      if ((sa < -EPS && sb > EPS) || (sa > EPS && sb < -EPS)) {
        const t = sa / (sa - sb);
        const p: V3 = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
        out.push(p);
        onPlane.push(p);
      }
    }
    const ring = dedupeRing(out);
    // A face lying in the cutting plane is the cap already (it stays; no new face is made)
    if (ring.length >= 3 && length(areaVector(ring)) > 1e-12) {
      const coplanar = ring.every((p) => Math.abs(dot(n, p) - d) <= EPS);
      if (coplanar && dot(f.n, n) > 0) return keepWithoutCap(c, n, d);
      if (!coplanar) faces.push({ pts: ring, n: f.n, d: f.d, inner: f.inner });
    }
  }
  const cap = capPolygon(onPlane, n);
  if (cap.length >= 3 && length(areaVector(cap)) > 1e-12) faces.push({ pts: cap, n, d, inner });
  if (faces.length < 4) return null;
  return { faces };
}

/** c has a face in the plane already, facing out of it: clip without making a new cap. */
function keepWithoutCap(c: Convex, n: V3, d: number): Convex | null {
  const faces: Face[] = [];
  for (const f of c.faces) {
    const ring = dedupeRing(f.pts.map((p) => p).filter((p) => dot(n, p) - d <= EPS));
    if (ring.length >= 3) faces.push({ ...f, pts: ring });
  }
  return faces.length >= 4 ? { faces } : null;
}

/** Points on a plane, as a convex polygon counter-clockwise about n (repeats merged). */
function capPolygon(points: V3[], n: V3): V3[] {
  const unique: V3[] = [];
  for (const p of points) if (!unique.some((q) => Math.abs(q[0] - p[0]) <= EPS && Math.abs(q[1] - p[1]) <= EPS && Math.abs(q[2] - p[2]) <= EPS)) unique.push(p);
  if (unique.length < 3) return unique;
  let c: V3 = [0, 0, 0];
  for (const p of unique) c = add(c, p);
  c = scale(c, 1 / unique.length);
  const [u, v] = basis(n);
  const angle = (p: V3) => Math.atan2(dot(sub(p, c), v), dot(sub(p, c), u));
  return dedupeRing(unique.sort((a, b) => angle(a) - angle(b)));
}

/** Volume and centre of mass. */
export function volumeCentroid(c: Convex): { volume: number; centroid: V3 } {
  let ref: V3 = [0, 0, 0];
  let count = 0;
  for (const f of c.faces)
    for (const p of f.pts) {
      ref = add(ref, p);
      count++;
    }
  ref = scale(ref, 1 / Math.max(count, 1));
  let volume = 0;
  let moment: V3 = [0, 0, 0];
  for (const f of c.faces) {
    const p0 = f.pts[0];
    for (let i = 1; i + 1 < f.pts.length; i++) {
      const [a, b, cc] = [sub(p0, ref), sub(f.pts[i], ref), sub(f.pts[i + 1], ref)];
      const v = dot(a, cross(b, cc)) / 6;
      volume += v;
      moment = add(moment, scale(add(add(a, b), cc), v / 4));
    }
  }
  return { volume, centroid: volume > 0 ? add(ref, scale(moment, 1 / volume)) : ref };
}

/** Its corners, each once. */
export function vertices(c: Convex): V3[] {
  const out: V3[] = [];
  const seen = new Set<string>();
  for (const f of c.faces)
    for (const p of f.pts) {
      const key = `${Math.round(p[0] * 1e5)},${Math.round(p[1] * 1e5)},${Math.round(p[2] * 1e5)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(p);
    }
  return out;
}

export function bounds(c: Convex): Box3 {
  const min: V3 = [Infinity, Infinity, Infinity];
  const max: V3 = [-Infinity, -Infinity, -Infinity];
  for (const f of c.faces)
    for (const p of f.pts)
      for (let a = 0; a < 3; a++) {
        if (p[a] < min[a]) min[a] = p[a];
        if (p[a] > max[a]) max[a] = p[a];
      }
  return { min, max };
}

/** c moved into another frame: each point p becomes rotation·p + position. */
export function transform(c: Convex, position: V3, rotation: Q): Convex {
  return {
    faces: c.faces.map((f) => {
      const n = rotate(rotation, f.n);
      const pts = f.pts.map((p) => add(rotate(rotation, p), position));
      return { pts, n, d: dot(n, pts[0]), inner: f.inner };
    }),
  };
}

/** How far p is outside c (negative inside): exact where a face is nearest, a lower bound at edges and corners. */
export function signedDistance(c: Convex, p: V3): number {
  let s = -Infinity;
  for (const f of c.faces) s = Math.max(s, dot(f.n, p) - f.d);
  return s;
}

/** Where a ray (unit direction) enters c: distance and the face's normal, or null. A ray starting inside hits at 0. */
export function raycastConvex(c: Convex, origin: V3, dir: V3, maxDistance = Infinity): { t: number; n: V3 } | null {
  let tIn = 0;
  let tOut = maxDistance;
  let nIn: V3 = [0, 0, 0];
  for (const f of c.faces) {
    const denom = dot(f.n, dir);
    const dist = f.d - dot(f.n, origin);
    if (Math.abs(denom) < 1e-12) {
      if (dist < 0) return null;
      continue;
    }
    const t = dist / denom;
    if (denom < 0) {
      if (t > tIn) {
        tIn = t;
        nIn = f.n;
      }
    } else if (t < tOut) tOut = t;
    if (tIn > tOut) return null;
  }
  return { t: tIn, n: nIn };
}

/** The largest distance from p to a corner of c. */
export function reach(c: Convex, p: V3): number {
  let r = 0;
  for (const f of c.faces) for (const q of f.pts) r = Math.max(r, length(sub(q, p)));
  return r;
}
