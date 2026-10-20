// Masonry: coursed walls in running bond with openings and round or pointed arches (voussoirs, and
// fillers over them up to a course line), corners that interlock course by course, gables clipped
// to the roof, and the round tower's courses of arc blocks.

import { arcBlock, pointedArch, type V3 } from '../../../lib/index.ts';
import { area, bevelledPrism, clip, Frame, type Kit, type Lay, type P, type Pt, rotZ, split, vary } from './kit.ts';

export interface Opening {
  /** The clear opening from u0 to u1, from `sill` up to `spring` (both on course lines). */
  u0: number;
  u1: number;
  sill: number;
  spring: number;
  /**
   * An arch on it, in limestone (an ashlar wall's own): the ring's depth and its voussoirs (round:
   * odd, a keystone at the crown; pointed, two-centred: even, the halves meeting in a joint at the
   * crown).
   */
  arch?: { ring: number; count: number; pointed?: boolean };
}

interface WallSpec {
  material: string;
  length: number;
  thickness: number;
  /** Course lines, bottom to top: n + 1 lines make n courses. */
  lines: number[];
  /** Block lengths. */
  block: [number, number];
  openings?: Opening[];
  /** Each course's extent along u (corners: walls take turns running through). */
  ends?: (k: number) => [number, number];
  /** Each course's extent across (string courses stand proud). */
  depth?: (k: number) => [number, number];
  /** Half-planes a·u + b·v ≤ c the wall is cut to (a gable under its roof). */
  under?: Array<[number, number, number]>;
  /** Shift of the bond along u (so two skins don't joint in line). */
  phase?: number;
  tint: number;
  /** Tint variation per block (±). */
  vary?: number;
  /** Deepest piece across the wall (thicker walls are cut through). */
  maxDepth?: number;
  lay?: Lay;
}

interface Built {
  /** Per course, its blocks. */
  courses: P[][];
  /** Per opening, its voussoirs in order of angle, each as its slices through the wall (front first). */
  arches: P[][];
}

/** The fillers over one arch: per voussoir, its column's u range and the course line it rises to. */
interface Column {
  lo: number;
  hi: number;
  top: number;
}

const MIN_BLOCK = 0.4;
/** Voussoirs' bevel, and how far the keystone rises over the ring and stands out of the wall. */
const CHAMFER = 0.03;
const KEY_RISE = 0.07;
const KEY_PROUD = 0.05;

/** One voussoir: its outline (x, y) about `centre` turned by -`turn`, and its outer face's corners (left to right), all from the arch's centre. */
interface Voussoir {
  outline: Pt[];
  centre: Pt;
  turn: number;
  outer: [Pt, Pt];
  key: boolean;
}

/**
 * The voussoirs of an arch over `span`, left to right. Each is built about the centre of its own
 * curve, its map laid square to its soffit and joints, not streaked across them. A round arch's
 * keystone rises over the ring (its sides straight up, so its fillers meet them) and stands proud
 * of the wall's faces; a pointed arch's halves meet in a joint at the crown.
 */
function voussoirs(span: number, arch: NonNullable<Opening['arch']>): Voussoir[] {
  const r = span / 2;
  if (arch.pointed) {
    // Each half a ring of radius `span` about the springing on the other side
    const c = r - span;
    return pointedArch(span, arch.ring, 1, arch.count).map(({ points, outer }) => {
      const [a0, b0, a1, b1] = [0, 2, 4, 6].map((k): Pt => [points[k][0], points[k][1]]);
      const centre: Pt = [a0[0] + a1[0] > 0 ? c : -c, 0];
      const turn = Math.atan2((a0[1] + a1[1]) / 2 - centre[1], (a0[0] + a1[0]) / 2 - centre[0]);
      const [cs, sn] = [Math.cos(-turn), Math.sin(-turn)];
      const local = ([x, y]: Pt): Pt => [(x - centre[0]) * cs - (y - centre[1]) * sn, (x - centre[0]) * sn + (y - centre[1]) * cs];
      return { outline: [a0, b0, b1, a1].map(local), centre, turn, outer, key: false };
    });
  }
  const R = r + arch.ring;
  const n = arch.count;
  return Array.from({ length: n }, (_, i): Voussoir => {
    // Right to left in angle: from the right springing (0) over to the left (π); listed left to right
    const a0 = Math.PI - ((i + 1) / n) * Math.PI;
    const a1 = Math.PI - (i / n) * Math.PI;
    const mid = (a0 + a1) / 2;
    const key = i === (n - 1) / 2;
    const rise = key ? KEY_RISE : 0;
    const local = (r0: number, a: number): Pt => [r0 * Math.cos(a - mid), r0 * Math.sin(a - mid)];
    const up = (p: Pt): Pt => [p[0] + Math.sin(mid) * rise, p[1] + Math.cos(mid) * rise];
    const outline: Pt[] = [local(r, a0), local(R, a0), ...(rise ? [up(local(R, a0)), up(local(R, a1))] : []), local(R, a1), local(r, a1)];
    const outer: [Pt, Pt] = [
      [R * Math.cos(a1), R * Math.sin(a1) + rise],
      [R * Math.cos(a0), R * Math.sin(a0) + rise],
    ];
    return { outline, centre: [0, 0], turn: mid, outer, key };
  });
}

/** The opening's head under its arch (u, v), springing to springing along the voussoirs' soffits: glass fits it. */
export function archHead(o: Opening): Pt[] {
  const uc = (o.u0 + o.u1) / 2;
  const ring = voussoirs(o.u1 - o.u0, { ...o.arch!, ring: 0.1 });
  const soffit = (v: Voussoir): Pt[] => {
    // Its inner corners back in the arch's frame, in order along the outline
    const [cs, sn] = [Math.cos(v.turn), Math.sin(v.turn)];
    return [v.outline[0], v.outline[v.outline.length - 1]].map(([x, y]): Pt => [uc + v.centre[0] + x * cs - y * sn, o.spring + v.centre[1] + x * sn + y * cs]);
  };
  const pts = ring.flatMap(soffit).sort((a, b) => a[0] - b[0]);
  return pts.filter((p, i) => i === 0 || Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]) > 1e-6);
}

/** A coursed wall in frame `f`: outer face at w = 0, along u from 0 to `length`. */
export function coursedWall(kit: Kit, f: Frame, s: WallSpec): Built {
  const lines = s.lines;
  const slicesFor = (w0: number, w1: number) => split(w0, w1, s.maxDepth ?? 2);
  const lay = s.lay;
  const out: Built = { courses: [], arches: [] };
  const columns: Column[][] = [];
  const lineAbove = (v: number) => lines.find((l) => l >= v - 1e-6) ?? lines[lines.length - 1];

  // Arches first: voussoirs, and the fillers over them
  for (const o of s.openings ?? []) {
    const cols: Column[] = [];
    columns.push(cols);
    if (!o.arch) {
      out.arches.push([]);
      continue;
    }
    const k0 = lines.findIndex((l) => Math.abs(l - o.spring) < 1e-6);
    const [w0, w1] = s.depth?.(Math.max(0, k0)) ?? [0, s.thickness];
    const ws = slicesFor(w0, w1);
    const uc = (o.u0 + o.u1) / 2;
    const vs: P[] = [];
    const dressed = s.material.startsWith('limestone') ? s.material : 'limestone';
    voussoirs(o.u1 - o.u0, o.arch).forEach((v, i) => {
      // Its fillers rise from its outer face to the first course line over it
      const [q0, q1] = v.outer.map(([x, y]): Pt => [uc + x, o.spring + y]);
      const top = lineAbove(Math.max(q0[1], q1[1]) + 0.12);
      cols.push({ lo: Math.min(q0[0], q1[0]), hi: Math.max(q0[0], q1[0]), top });
      // Lighter and darker in turn, so the ring reads as stones; the keystone the lightest
      const tint = vary(v.key ? 0xffffff : i % 2 ? 0xd8d8d8 : 0xf8f8f8, 0.03, kit.rand);
      for (let j = 0; j + 1 < ws.length; j++) {
        const depth = ws[j + 1] - ws[j];
        const proud = v.key ? [j === 0 ? KEY_PROUD : 0, j + 2 === ws.length ? KEY_PROUD : 0] : [0, 0];
        const points = bevelledPrism(v.outline, -depth / 2 - proud[0], depth / 2 + proud[1], CHAMFER);
        vs.push(kit.hull(f, dressed, points, uc + v.centre[0], o.spring + v.centre[1], (ws[j] + ws[j + 1]) / 2, { tint, turn: rotZ(v.turn) }));
        kit.prism(f, s.material, [q0, q1, [q1[0], top], [q0[0], top]], ws[j], depth, { tint: vary(s.tint, s.vary ?? 0.04, kit.rand), lay });
      }
    });
    out.arches.push(vs);
  }

  for (let k = 0; k + 1 < lines.length; k++) {
    const [v0, v1] = [lines[k], lines[k + 1]];
    const [e0, e1] = s.ends?.(k) ?? [0, s.length];
    const [w0, w1] = s.depth?.(k) ?? [0, s.thickness];
    // What this course leaves out: openings, and the arches' columns that reach into it
    const gaps: Array<[number, number]> = [];
    const lintels: Array<[number, number]> = [];
    (s.openings ?? []).forEach((o, i) => {
      if (o.sill < v1 - 1e-6 && o.spring > v0 + 1e-6) gaps.push([o.u0, o.u1]);
      if (!o.arch && Math.abs(o.spring - v0) < 1e-6) lintels.push([o.u0 - 0.3, o.u1 + 0.3]);
      if (o.arch && v0 >= o.spring - 1e-6) {
        const cols = columns[i].filter((c) => c.top > v0 + 1e-6);
        if (cols.length) gaps.push([Math.min(...cols.map((c) => c.lo)), Math.max(...cols.map((c) => c.hi))]);
      }
    });
    gaps.sort((a, b) => a[0] - b[0]);
    const segments: Array<[number, number]> = [];
    let x = e0;
    for (const [g0, g1] of gaps) {
      if (g0 > x + 1e-6) segments.push([x, Math.min(g0, e1)]);
      x = Math.max(x, g1);
    }
    if (e1 > x + 1e-6) segments.push([x, e1]);

    const course: P[] = [];
    const tintOf = () => vary(s.tint, s.vary ?? 0.06, kit.rand);
    const L = (s.block[0] + s.block[1]) / 2;
    const offset = (s.phase ?? 0) + (k % 2) * L * 0.5;
    for (const [a, b] of segments) {
      // Joints on the course's grid, jittered, none closer than MIN_BLOCK to another
      let cuts = [a];
      for (let n = Math.floor((a - offset) / L) + 1; ; n++) {
        const c = offset + n * L + (kit.rand() - 0.5) * (s.block[1] - s.block[0]) * 0.6;
        if (c >= b - MIN_BLOCK) break;
        if (c - cuts[cuts.length - 1] >= MIN_BLOCK) cuts.push(c);
      }
      cuts.push(b);
      // A flat-topped opening below: one block spans it
      cuts = cuts.filter((c, i) => i === 0 || i === cuts.length - 1 || !lintels.some(([l0, l1]) => c > l0 && c < l1));
      // Cut to a gable: slivers join their neighbour
      const cut = (u0: number, u1: number) => {
        let poly: Pt[] = [
          [u0, v0],
          [u1, v0],
          [u1, v1],
          [u0, v1],
        ];
        for (const h of s.under ?? []) poly = clip(poly, h);
        return poly;
      };
      if (s.under) {
        for (let i = 1; i < cuts.length - 1; ) {
          if (area(cut(cuts[i - 1], cuts[i])) < 0.08 || area(cut(cuts[i], cuts[i + 1])) < 0.08) cuts.splice(i, 1);
          else i++;
        }
      }
      for (let i = 0; i + 1 < cuts.length; i++) {
        const tint = tintOf();
        const poly = cut(cuts[i], cuts[i + 1]);
        if (poly.length < 3 || area(poly) < 1e-3) continue;
        const rect = poly.length === 4 && !s.under;
        const ws = slicesFor(w0, w1);
        for (let j = 0; j + 1 < ws.length; j++) {
          course.push(rect ? kit.box(f, s.material, cuts[i], v0, ws[j], cuts[i + 1] - cuts[i], v1 - v0, ws[j + 1] - ws[j], { tint, lay }) : kit.prism(f, s.material, poly, ws[j], ws[j + 1] - ws[j], { tint, lay }));
        }
      }
    }
    out.courses.push(course);
  }
  return out;
}

/** Course lines from `v0`: `n` courses of `h`. */
export function courses(v0: number, n: number, h: number): number[] {
  return Array.from({ length: n + 1 }, (_, i) => v0 + i * h);
}

/** The four walls of a rectangle (x0, z0)–(x1, z1): frames with outer faces outward and u running round anticlockwise seen from above. */
export function sides(x0: number, z0: number, x1: number, z1: number): Record<'n' | 's' | 'e' | 'w', { f: Frame; length: number }> {
  return {
    n: { f: new Frame([x0, 0, z0], 0), length: x1 - x0 },
    e: { f: new Frame([x1, 0, z0], -Math.PI / 2), length: z1 - z0 },
    s: { f: new Frame([x1, 0, z1], Math.PI), length: x1 - x0 },
    w: { f: new Frame([x0, 0, z1], Math.PI / 2), length: z1 - z0 },
  };
}

/**
 * A square-cornered enclosure of four coursed walls `t` thick: north and south walls run through the
 * corners on even courses, east and west on odd ones.
 */
export function enclosure(kit: Kit, x0: number, z0: number, x1: number, z1: number, t: number, spec: Omit<WallSpec, 'length' | 'thickness' | 'ends' | 'openings'>, openings: Partial<Record<'n' | 's' | 'e' | 'w', Opening[]>> = {}): Record<'n' | 's' | 'e' | 'w', Built> {
  const all = sides(x0, z0, x1, z1);
  const out = {} as Record<'n' | 's' | 'e' | 'w', Built>;
  for (const key of ['n', 'e', 's', 'w'] as const) {
    const { f, length } = all[key];
    const through = key === 'n' || key === 's' ? 0 : 1;
    out[key] = coursedWall(kit, f, { ...spec, length, thickness: t, openings: openings[key], ends: (k) => ((k + through) % 2 === 0 ? [0, length] : [t, length - t]) });
  }
  return out;
}

/**
 * A round tower: `n` courses of 12 arc blocks between radii `ri` and `ro`, each course turned half a
 * block from the one below. `door`: the block from angle 0 to 30° is left out of the first
 * `door` courses (which stand unturned, so the doorway's sides are straight).
 */
export function roundTower(kit: Kit, cx: number, cz: number, ri: number, ro: number, n: number, h: number, material: string, tint: number, door = 0): P[][] {
  const f = new Frame([cx, 0, cz]);
  const per = 12;
  const out: P[][] = [];
  for (let k = 0; k < n; k++) {
    const turn = k < door ? 0 : ((k - door + 1) % 2) * (Math.PI / per);
    const row: P[] = [];
    for (let i = 0; i < per; i++) {
      const a0 = turn + (i * 2 * Math.PI) / per;
      const a1 = a0 + (2 * Math.PI) / per;
      if (k < door && i === 0) {
        row.push(null);
        continue;
      }
      // The outer face curved (points on the radius between the ends, shaded round): flat faces
      // stepped the outline in and out course by course
      const bulge = [0.25, 0.5, 0.75].flatMap((t): V3[] => {
        const a = a0 + (a1 - a0) * t;
        return [
          [ro * Math.cos(a), 0, ro * Math.sin(a)],
          [ro * Math.cos(a), h, ro * Math.sin(a)],
        ];
      });
      row.push(kit.hull(f, material, [...arcBlock(ri, ro, a0, a1, h), ...bulge], 0, k * h, 0, { tint: vary(tint, 0.05, kit.rand), smooth: 0.3 }));
    }
    out.push(row);
  }
  return out;
}

/** A ring of `per` arc blocks at height v (a wall plate, a coping), starting at angle `turn`. */
export function ring(kit: Kit, f: Frame, ri: number, ro: number, v: number, h: number, per: number, turn: number, material: string, tint: number): P[] {
  return Array.from({ length: per }, (_, i) => {
    const a0 = turn + (i * 2 * Math.PI) / per;
    return kit.hull(f, material, arcBlock(ri, ro, a0, a0 + (2 * Math.PI) / per, h), 0, v, 0, { tint: vary(tint, 0.04, kit.rand) });
  });
}
