// The Doric order in pieces: bands of an entablature round a rectangle of column axes (architrave
// beams, frieze backers, cornice blocks), the frieze's triglyphs and metopes, coursed walls in
// running bond, and stepped platforms. Joints fall over supports, neighbours share faces exactly.

import type { Piece } from '../../../lib/index.ts';
import type { Kit } from './kit.ts';
import { spans } from './roof.ts';

/** Column axis lines: x0..x1 (west to east), z0..z1 (north to south). */
export interface Rect {
  x0: number;
  x1: number;
  z0: number;
  z1: number;
}

type Side = 'n' | 's' | 'w' | 'e';
const ALL: Side[] = ['n', 's', 'w', 'e'];

/**
 * A band of a layer round the rectangle, from v0 to v1 off the axis lines (outward +), y0..y1. The
 * long sides (n, s) run on over the corners; the short ones (w, e) fit between them. Cut at
 * `long` (x) and `short` (z).
 */
export function band(k: Kit, r: Rect, material: string, v0: number, v1: number, y0: number, y1: number, cuts: { long: number[]; short: number[] }, o: { sides?: Side[]; tint?: number } = {}): Piece[] {
  const out: Piece[] = [];
  const push = (p: Piece | null) => p && out.push(p);
  for (const side of o.sides ?? ALL) {
    if (side === 'n' || side === 's') {
      const [za, zb] = side === 'n' ? [r.z0 - v1, r.z0 - v0] : [r.z1 + v0, r.z1 + v1];
      for (const [xa, xb] of spans(r.x0 - v1, r.x1 + v1, cuts.long)) push(k.box(material, [xa, y0, za], [xb, y1, zb], { tint: o.tint }));
    } else {
      const [xa, xb] = side === 'w' ? [r.x0 - v1, r.x0 - v0] : [r.x1 + v0, r.x1 + v1];
      for (const [za, zb] of spans(r.z0 - v0, r.z1 + v0, cuts.short)) push(k.box(material, [xa, y0, za], [xb, y1, zb], { tint: o.tint }));
    }
  }
  return out;
}

/**
 * The frieze's face: a triglyph (proud, the ghost of its blue paint, of `glyph`: a grooved
 * material) over every axis and mid-span, one at each corner on the long side, metopes between
 * (recessed). `skip`: metopes left out (a ruin's, open to the sky).
 */
export function frieze(k: Kit, r: Rect, s: { v0: number; v1: number; recess: number; y0: number; y1: number; tw: number; pitch: number; pitchShort?: number; material: string; glyph?: string; triglyph: number; sides?: Side[]; skip?: (i: number) => boolean }): Piece[] {
  const out: Piece[] = [];
  let metope = 0;
  const run = (a: number, b: number, centres: number[], cornerA: boolean, cornerB: boolean, place: (lo: number, hi: number, depth: number, tint?: number) => Piece | null) => {
    // Triglyph intervals along the run, metopes between
    const tri: Array<[number, number]> = [];
    if (cornerA) tri.push([a, a + s.tw]);
    for (const c of centres) if (c - s.tw / 2 > a + 1e-6 && c + s.tw / 2 < b - 1e-6) tri.push([c - s.tw / 2, c + s.tw / 2]);
    if (cornerB) tri.push([b - s.tw, b]);
    tri.sort((p, q) => p[0] - q[0]);
    let at = a;
    for (const [lo, hi] of tri) {
      if (lo > at + 1e-6 && !s.skip?.(metope++)) {
        const p = place(at, lo, s.v1 - s.recess);
        if (p) out.push(p);
      }
      const p = place(lo, hi, s.v1, s.triglyph);
      if (p) out.push(p);
      at = hi;
    }
    if (b > at + 1e-6 && !s.skip?.(metope++)) {
      const p = place(at, b, s.v1 - s.recess);
      if (p) out.push(p);
    }
  };
  const along = (lo: number, hi: number, pitch: number) => {
    const c: number[] = [];
    for (let x = lo; x <= hi + 1e-6; x += pitch) c.push(x);
    return c;
  };
  for (const side of s.sides ?? ALL) {
    if (side === 'n' || side === 's') {
      const out1 = side === 'n' ? -1 : 1;
      const zl = side === 'n' ? r.z0 : r.z1;
      run(r.x0 - s.v1, r.x1 + s.v1, along(r.x0 + s.pitch, r.x1 - s.pitch, s.pitch), true, true, (lo, hi, depth, tint) => {
        const [za, zb] = out1 < 0 ? [zl - depth, zl - s.v0] : [zl + s.v0, zl + depth];
        return k.box(tint === undefined ? s.material : (s.glyph ?? s.material), [lo, s.y0, za], [hi, s.y1, zb], tint === undefined ? {} : { tint });
      });
    } else {
      const xl = side === 'w' ? r.x0 : r.x1;
      run(r.z0 - s.v0, r.z1 + s.v0, along(r.z0, r.z1, s.pitchShort ?? s.pitch), false, false, (lo, hi, depth, tint) => {
        const [xa, xb] = side === 'w' ? [xl - depth, xl - s.v0] : [xl + s.v0, xl + depth];
        return k.box(tint === undefined ? s.material : (s.glyph ?? s.material), [xa, s.y0, lo], [xb, s.y1, hi], tint === undefined ? {} : { tint });
      });
    }
  }
  return out;
}

/** Course heights from y0: given heights in order. */
export function courses(y0: number, heights: number[]): Array<[number, number]> {
  let y = y0;
  return heights.map((h) => {
    const c: [number, number] = [y, y + h];
    y += h;
    return c;
  });
}

export interface WallSpec {
  material: string;
  /** Along x (z0..z1 its thickness) or along z (x0..x1). */
  axis: 'x' | 'z';
  from: number;
  to: number;
  t0: number;
  t1: number;
  courses: Array<[number, number]>;
  /** Block length, and whether alternate courses start half a block in. */
  block: number;
  bond?: boolean;
  /** Openings: along-wall range and height range left empty. */
  holes?: Array<{ a: number; b: number; y0: number; y1: number }>;
  /** Cuts every course gets (where a pier or a capital starts). */
  cuts?: number[];
  /** Per block: the material to use instead (a marble capital in a limestone wall), or null to leave it out. */
  pick?: (a: number, b: number, course: number) => string | null;
}

/** A wall of blocks in courses, in running bond, with openings. */
export function wall(k: Kit, s: WallSpec): Piece[] {
  const out: Piece[] = [];
  s.courses.forEach(([y0, y1], i) => {
    const offset = s.bond === false ? 0 : (i % 2) * (s.block / 2);
    const holes = (s.holes ?? []).filter((h) => y0 < h.y1 - 1e-6 && y1 > h.y0 + 1e-6);
    // Cuts that must be (an opening's edges, a pier's), then the running bond's where they leave room
    const forced = [...(s.cuts ?? []), ...holes.flatMap((h) => [h.a, h.b])];
    const cuts = [...forced];
    for (let a = s.from + offset; a < s.to; a += s.block) if (a > s.from + s.block * 0.3 && a < s.to - s.block * 0.3 && forced.every((f) => Math.abs(f - a) > 0.25)) cuts.push(a);
    for (const [a, b] of spans(s.from, s.to, dedupe(cuts))) {
      if (holes.some((h) => a >= h.a - 1e-6 && b <= h.b + 1e-6)) continue;
      const m = s.pick ? s.pick(a, b, i) : s.material;
      if (!m) continue;
      const p = s.axis === 'x' ? k.box(m, [a, y0, s.t0], [b, y1, s.t1]) : k.box(m, [s.t0, y0, a], [s.t1, y1, b]);
      if (p) out.push(p);
    }
  });
  return out;
}

/** Cuts closer than 0.25 m to one another merge (no slivers). */
function dedupe(cuts: number[]): number[] {
  const sorted = [...cuts].sort((a, b) => a - b);
  const out: number[] = [];
  for (const c of sorted) if (!out.length || c - out[out.length - 1] > 0.25) out.push(c);
  return out;
}

/**
 * A rectangular step or platform course, as a ring of slabs `width` deep round its outline (the
 * steps above hide the middle) or, with `fill`, slabs over the whole of it cut at `xs`/`zs`. Its
 * slabs are anchors unless `anchor` is false: they hold up what's on them as the ground does (the
 * course above stands over the hollow the ring leaves), but break as any piece.
 */
export function platform(k: Kit, material: string, x0: number, x1: number, z0: number, z1: number, y0: number, y1: number, o: { width?: number; xs?: number[]; zs?: number[]; length?: number; anchor?: boolean; tint?: () => number } = {}): Piece[] {
  const out: Piece[] = [];
  const push = (p: Piece | null) => p && out.push(p);
  const opts = () => ({ anchor: o.anchor ?? true, tint: o.tint?.() });
  const L = o.length ?? 2.2;
  const even = (a: number, b: number) => {
    const n = Math.max(1, Math.round((b - a) / L));
    return Array.from({ length: n - 1 }, (_, i) => a + ((i + 1) * (b - a)) / n);
  };
  if (!o.width) {
    for (const [xa, xb] of spans(x0, x1, o.xs ?? even(x0, x1))) for (const [za, zb] of spans(z0, z1, o.zs ?? even(z0, z1))) push(k.box(material, [xa, y0, za], [xb, y1, zb], opts()));
    return out;
  }
  const w = o.width;
  for (const [xa, xb] of spans(x0, x1, even(x0, x1))) {
    push(k.box(material, [xa, y0, z0], [xb, y1, z0 + w], opts()));
    push(k.box(material, [xa, y0, z1 - w], [xb, y1, z1], opts()));
  }
  for (const [za, zb] of spans(z0 + w, z1 - w, even(z0 + w, z1 - w))) {
    push(k.box(material, [x0, y0, za], [x0 + w, y1, zb], opts()));
    push(k.box(material, [x1 - w, y0, za], [x1, y1, zb], opts()));
  }
  return out;
}
