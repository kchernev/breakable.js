// What a piece rests on: where its convex touches another (within a tolerance, as resting pieces
// sink a little into what's under them), which way each touch pushes it, and whether its centre of
// mass is over the touches that push it up. A piece jammed sideways between its neighbours touches
// them on faces that push it sideways: it isn't held up, and mustn't freeze where it hangs.

import type { Convex, Face } from './convex.ts';
import { dot, lerp, type V3 } from './math.ts';

export interface Touch {
  at: V3;
  /** The way it pushes the piece: the normal from what's touched toward the piece (its y: how much it holds it up). */
  n: V3;
}

/** A direction no edge is square to, in practice: each edge is clipped once, not once per face beside it. */
const ORDER: V3 = [0.6123, 0.5345, 0.5826];

/**
 * The face of c that a touch at p is on: of the faces p is (within `tol` of) furthest out of, the
 * one `other` (a point inside what's touching) is furthest out of. At an edge or a corner that's
 * the face it rests against, not the one beside it.
 */
function faceAt(c: Convex, p: V3, other: V3, tol: number): Face {
  let far = -Infinity;
  for (const f of c.faces) far = Math.max(far, dot(f.n, p) - f.d);
  let best = c.faces[0];
  let s = -Infinity;
  for (const f of c.faces) {
    if (dot(f.n, p) - f.d < far - tol) continue;
    const o = dot(f.n, other) - f.d;
    if (o > s) {
      s = o;
      best = f;
    }
  }
  return best;
}

/** A point inside a convex: the mean of its faces' corners. */
function inside(c: Convex): V3 {
  const m: V3 = [0, 0, 0];
  let n = 0;
  for (const f of c.faces)
    for (const p of f.pts) {
      m[0] += p[0];
      m[1] += p[1];
      m[2] += p[2];
      n++;
    }
  return [m[0] / n, m[1] / n, m[2] / n];
}

/**
 * Where convex a touches convex b, within `tol` (m): a's edges where they run within b (grown by
 * tol), which takes in a's corners on or in b and a's edges across b's; and b's `corners` within a.
 */
export function touches(a: Convex, b: Convex, corners: V3[], tol: number, out: Touch[] = []): Touch[] {
  const ca = inside(a);
  const cb = inside(b);
  for (const f of a.faces) {
    const n = f.pts.length;
    for (let i = 0; i < n; i++) {
      const p = f.pts[i];
      const q = f.pts[(i + 1) % n];
      if ((q[0] - p[0]) * ORDER[0] + (q[1] - p[1]) * ORDER[1] + (q[2] - p[2]) * ORDER[2] < 0) continue;
      let t0 = 0;
      let t1 = 1;
      for (const g of b.faces) {
        const dp = dot(g.n, p) - g.d - tol;
        const dq = dot(g.n, q) - g.d - tol;
        if (dp > 0 && dq > 0) {
          t0 = 2;
          break;
        }
        if (dp > 0) t0 = Math.max(t0, dp / (dp - dq));
        else if (dq > 0) t1 = Math.min(t1, dp / (dp - dq));
        if (t0 > t1) break;
      }
      if (t0 > t1) continue;
      for (const t of t1 - t0 < 1e-6 ? [t0] : [t0, t1]) {
        const at = lerp(p, q, t);
        out.push({ at, n: faceAt(b, at, ca, tol).n });
      }
    }
  }
  for (const c of corners) {
    let far = -Infinity;
    for (const f of a.faces) far = Math.max(far, dot(f.n, c) - f.d);
    if (far < tol) {
      const n = faceAt(a, c, cb, tol).n;
      out.push({ at: c, n: [-n[0], -n[1], -n[2]] });
    }
  }
  return out;
}

/** Points' convex hull seen from above (x, z), counter-clockwise. */
function hull2(points: V3[]): Array<[number, number]> {
  const p = points.map((v): [number, number] => [v[0], v[2]]).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (p.length < 3) return p;
  const turn = (o: [number, number], a: [number, number], b: [number, number]) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower: Array<[number, number]> = [];
  for (const q of p) {
    while (lower.length >= 2 && turn(lower[lower.length - 2], lower[lower.length - 1], q) <= 1e-12) lower.pop();
    lower.push(q);
  }
  const upper: Array<[number, number]> = [];
  for (let i = p.length - 1; i >= 0; i--) {
    while (upper.length >= 2 && turn(upper[upper.length - 2], upper[upper.length - 1], p[i]) <= 1e-12) upper.pop();
    upper.push(p[i]);
  }
  return lower.slice(0, -1).concat(upper.slice(0, -1));
}

/**
 * How far a centre of mass is out past the points holding it up, seen from above (negative:
 * inside, by that much), and the nearest point of their outline: the edge it tips over. Infinity
 * with nothing to hold it.
 */
export function overhang(center: V3, points: V3[]): { distance: number; edge: [number, number] } {
  if (!points.length) return { distance: Infinity, edge: [center[0], center[2]] };
  const h = hull2(points);
  const c: [number, number] = [center[0], center[2]];
  let best = Infinity;
  let edge: [number, number] = h[0];
  let inside = h.length >= 3;
  for (let i = 0; i < h.length; i++) {
    const a = h[i];
    const b = h[(i + 1) % h.length];
    const ab = [b[0] - a[0], b[1] - a[1]];
    const l2 = ab[0] * ab[0] + ab[1] * ab[1];
    const t = l2 > 0 ? Math.max(0, Math.min(1, ((c[0] - a[0]) * ab[0] + (c[1] - a[1]) * ab[1]) / l2)) : 0;
    const q: [number, number] = [a[0] + ab[0] * t, a[1] + ab[1] * t];
    const d = Math.hypot(c[0] - q[0], c[1] - q[1]);
    if (d < best) {
      best = d;
      edge = q;
    }
    if (ab[0] * (c[1] - a[1]) - ab[1] * (c[0] - a[0]) < 0) inside = false;
  }
  return { distance: inside ? -best : best, edge };
}

/** How far from `from` (inside the points' outline, seen from above) the outline is along `dir` (x, z). */
export function reachToward(points: V3[], from: [number, number], dir: [number, number]): number {
  const h = hull2(points);
  const l = Math.hypot(dir[0], dir[1]) || 1;
  const [ux, uz] = [dir[0] / l, dir[1] / l];
  let best = Infinity;
  for (let i = 0; i < h.length; i++) {
    const a = h[i];
    const b = h[(i + 1) % h.length];
    // from + t·u = a + s·(b - a)
    const [ex, ez] = [b[0] - a[0], b[1] - a[1]];
    const den = ux * ez - uz * ex;
    if (Math.abs(den) < 1e-12) continue;
    const [wx, wz] = [a[0] - from[0], a[1] - from[1]];
    const t = (wx * ez - wz * ex) / den;
    const s = (wx * uz - wz * ux) / den;
    if (t >= 0 && s >= -1e-9 && s <= 1 + 1e-9) best = Math.min(best, t);
  }
  return best === Infinity ? 0 : best;
}
