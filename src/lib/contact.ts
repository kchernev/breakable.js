// Where two convex pieces touch face to face: the overlap of a face of one with a face of the
// other lying in the same plane, facing it. Its area is how strongly they're bonded and its centre
// is where the bond's joint goes.

import { areaVector, type Convex, EPS } from './convex.ts';
import { add, cross, dot, length, normalize, scale, sub, type V3 } from './math.ts';

export interface Patch {
  area: number;
  /** The overlap's centre. */
  center: V3;
  /** From a towards b. */
  normal: V3;
}

/** How far apart (metres) two faces may be and still count as touching. */
export const TOUCH = 2e-3;
/** How far from facing each other exactly (radians) two faces may turn and still count as touching (about 2.6°). */
export const FACING = Math.acos(0.999);

/**
 * The face-to-face contact between a and b, or null when they don't touch over an area: where a
 * face of each, turned at most `angle` from facing the other, overlap, and are at most `gap` apart
 * all over the overlap (faces that only meet at an edge, or open up from it, don't touch).
 */
export function contactPatch(a: Convex, b: Convex, gap = TOUCH, angle = FACING): Patch | null {
  const facing = -Math.cos(angle);
  let area = 0;
  let moment: V3 = [0, 0, 0];
  let normal: V3 = [0, 0, 0];
  for (const fa of a.faces) {
    for (const fb of b.faces) {
      if (dot(fa.n, fb.n) > facing) continue;
      // Some of a's face within the gap of b's plane, before clipping
      let near = false;
      let above = false;
      let below = false;
      for (const p of fa.pts) {
        const s = dot(fb.n, p) - fb.d;
        if (Math.abs(s) <= gap) near = true;
        else if (s > 0) above = true;
        else below = true;
      }
      if (!near && !(above && below)) continue;
      const overlap = clipPolygon(fa.pts, fb.pts, fb.n);
      if (overlap.length < 3) continue;
      if (overlap.some((p) => Math.abs(dot(fb.n, p) - fb.d) > gap)) continue;
      const av = areaVector(overlap);
      const s = length(av) / 2;
      if (s < 1e-8) continue;
      area += s;
      moment = add(moment, scale(polygonCentroid(overlap), s));
      normal = add(normal, scale(fa.n, s));
    }
  }
  if (area <= 0) return null;
  return { area, center: scale(moment, 1 / area), normal: normalize(normal) };
}

/** Polygon p clipped to the convex polygon q (counter-clockwise about nq), both in about one plane. */
function clipPolygon(p: V3[], q: V3[], nq: V3): V3[] {
  let out = p;
  const m = q.length;
  for (let i = 0; i < m && out.length >= 3; i++) {
    const a = q[i];
    const e = sub(q[(i + 1) % m], a);
    // Inside is to the left of each edge, seen along nq: the side cross(nq, e) points to
    const inward = cross(nq, e);
    const next: V3[] = [];
    for (let k = 0; k < out.length; k++) {
      const s = out[k];
      const t = out[(k + 1) % out.length];
      const ds = dot(inward, sub(s, a));
      const dt = dot(inward, sub(t, a));
      if (ds >= -EPS) next.push(s);
      if ((ds < -EPS && dt > EPS) || (ds > EPS && dt < -EPS)) {
        const f = ds / (ds - dt);
        next.push([s[0] + (t[0] - s[0]) * f, s[1] + (t[1] - s[1]) * f, s[2] + (t[2] - s[2]) * f]);
      }
    }
    out = next;
  }
  return out;
}

function polygonCentroid(p: V3[]): V3 {
  let total = 0;
  let c: V3 = [0, 0, 0];
  for (let i = 1; i + 1 < p.length; i++) {
    const s = length(cross(sub(p[i], p[0]), sub(p[i + 1], p[0])));
    total += s;
    c = add(c, scale(add(add(p[0], p[i]), p[i + 1]), s / 3));
  }
  return total > 0 ? scale(c, 1 / total) : p[0];
}
