// The signs, which this world is about: many small light pieces bonded to the facades. Neon tubes
// are hexagonal prisms laid along each stroke with a flat face on their backing (so they bond to
// it face to face), shortened at both ends as real neon is at its bends. Flat signs are tubes on a
// dark raceway; blade signs stick out into the alley with lightbox faces and neon edges; the big
// blade on N4 is 12 m tall with a ring on top; billboards are lightbox panels on a backing. When
// the wall behind goes, they hang by their last bonds, spark and fall.

import type { Destruction, Piece, Pose, V3 } from '../../../lib/index.ts';
import { cross, normalize, random } from '../../../lib/index.ts';
import { glyph, PICTOGRAMS, type Pictogram, type Stroke } from './glyphs.ts';
import { type Frame, levelY, TS } from './layout.ts';
import { atlasMap, glow } from './materials.ts';

/** A sign: its pieces (for the reactions: when it hangs, when it's dark), where it is, its colour. */
export interface Sign {
  pieces: Piece[];
  centre: V3;
  color: number;
  /** The flickering hotel sign. */
  flicker?: boolean;
}

/** Every sign built (life.ts reads it). */
export const signs: Sign[] = [];

/** Tube radius (its hexagon's corner radius) and how much each stroke is shortened at each end (at most). */
const R = 0.022;
const TRIM = 0.025;
const SQ3 = Math.sqrt(3);

const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a: V3, k: number): V3 => [a[0] * k, a[1] * k, a[2] * k];
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];

/** A plane to lay tubes on: its origin (world), its right and up directions, and its normal (out of the backing). */
export interface Plane {
  o: V3;
  right: V3;
  up: V3;
  n: V3;
}

/** One tube from (a0, b0) to (a1, b1) on a plane (metres along right and up), lying on it. */
export function tube(d: Destruction, plane: Plane, a0: number, b0: number, a1: number, b1: number, tint: number): Piece | null {
  const p0 = add(plane.o, add(mul(plane.right, a0), mul(plane.up, b0)));
  const p1 = add(plane.o, add(mul(plane.right, a1), mul(plane.up, b1)));
  const len = Math.hypot(...sub(p1, p0));
  // Short strokes (small signs) are trimmed less, so every stroke of a glyph gets its tube
  const trim = Math.min(TRIM, len * 0.2);
  if (len - 2 * trim < 0.035) return null;
  const dir = normalize(sub(p1, p0));
  const s0 = add(p0, mul(dir, trim));
  const s1 = sub(p1, mul(dir, trim));
  const across = normalize(cross(plane.n, dir));
  // A hexagon flat on the plane: corners at 0°, 60° … with flat top and bottom, its bottom at 0
  const h = (R * SQ3) / 2;
  const hex: Array<[number, number]> = [
    [R, h],
    [R / 2, 2 * h],
    [-R / 2, 2 * h],
    [-R, h],
    [-R / 2, 0],
    [R / 2, 0],
  ];
  const points: V3[] = [];
  for (const [x, y] of hex) {
    const off = add(mul(across, x), mul(plane.n, y));
    points.push(add(s0, off), add(s1, off));
  }
  const p = d.addConvex({ material: 'neon', points, tint });
  glow.light(p);
  return p;
}

/** Tubes for strokes (glyph units, 4 = `size` m) with their glyph box's corner at (a, b) on the plane. */
export function strokes(d: Destruction, plane: Plane, list: Stroke[], a: number, b: number, size: number, tint: number, out: Piece[]): void {
  const u = size / 4;
  for (const [x0, y0, x1, y1] of list) {
    const p = tube(d, plane, a + x0 * u, b + y0 * u, a + x1 * u, b + y1 * u, tint);
    if (p) out.push(p);
  }
}

/**
 * The plane of a facade's face at lz (out of it, toward the street), in a frame, for a sign `w`
 * wide from lx: its right is the right of someone facing the facade (-x on the north row, where the
 * frame's lx runs the other way), so the strokes start from that end of the sign and read unmirrored.
 */
function facePlane(f: Frame, lx: number, ly: number, lz: number, w: number): Plane {
  const right = cross([0, 1, 0], f.out);
  const same = right[0] * f.along[0] + right[2] * f.along[2] > 0;
  return { o: f.at(same ? lx : lx + w, ly, lz), right, up: [0, 1, 0], n: f.out };
}

/**
 * The texture frame that puts u, v = 0 at the lower left of a face (normal `n`, its box `min` …
 * `max`), as the fragment mesh's box projection runs u and v on it (so atlas cells land on it).
 */
function faceFrame(n: V3, min: V3, max: V3): Pose {
  const ax = Math.abs(n[0]) > Math.abs(n[2]) ? 0 : 2;
  const position: V3 = ax === 0 ? [min[0], min[1], n[0] > 0 ? max[2] : min[2]] : [n[2] > 0 ? min[0] : max[0], min[1], min[2]];
  return { position, rotation: [0, 0, 0, 1] };
}

/** A lightbox panel (a box `size`, centred `at`, facing `n`), its face showing atlas cells `cell` m wide from (col, row), `pad` m in from its lower left. */
export function lightbox(d: Destruction, at: V3, size: V3, n: V3, tint: number, cell: number, col: number, row: number, pad: [number, number] = [0, 0], frame?: { min: V3; max: V3 }): Piece | null {
  const min: V3 = [at[0] - size[0] / 2, at[1] - size[1] / 2, at[2] - size[2] / 2];
  const max: V3 = [at[0] + size[0] / 2, at[1] + size[1] / 2, at[2] + size[2] / 2];
  const box = frame ?? { min, max };
  const p = d.addBox({ material: 'lightbox', size, position: at, tint, textureFrame: faceFrame(n, box.min, box.max) });
  const [k, u, v] = atlasMap(cell, col, row);
  glow.light(p, [k, u - pad[0] * k, v - pad[1] * k]);
  return p;
}

/**
 * A flat neon sign on a facade: a dark raceway 0.06 deep on the face at lz 0 from (lx, ly), and
 * on it a row of glyphs (or a column, `vertical`), one or two colours. Returns its sign.
 */
export function flatSign(d: Destruction, f: Frame, lx: number, ly: number, o: { count: number; size: number; color: number; second?: number; vertical?: boolean; picto?: Pictogram; seed: number }): Sign {
  const rand = random(o.seed);
  const pitch = o.size * 1.2;
  const pad = o.size * 0.18;
  const [w, h] = o.vertical ? [o.size + 2 * pad, o.count * pitch - (pitch - o.size) + 2 * pad] : [o.count * pitch - (pitch - o.size) + 2 * pad, o.size + 2 * pad];
  const pieces: Piece[] = [];
  const depth = 0.06;
  // The raceway, in runs of at most 2.2 m
  const n = Math.max(1, Math.round((o.vertical ? h : w) / 2.2));
  for (let i = 0; i < n; i++) {
    const p = o.vertical ? f.box(d, 'signbox', lx, ly + (i * h) / n, -depth, w, h / n, depth, { tint: 0x1c1e24 }) : f.box(d, 'signbox', lx + (i * w) / n, ly, -depth, w / n, h, depth, { tint: 0x1c1e24 });
    if (p) pieces.push(p);
  }
  const plane = facePlane(f, lx, ly, -depth, w);
  for (let i = 0; i < o.count; i++) {
    const [a, b] = o.vertical ? [pad, h - pad - o.size - i * pitch] : [pad + i * pitch, pad];
    const last = i === o.count - 1;
    const list = last && o.picto ? PICTOGRAMS[o.picto] : glyph(Math.floor(rand() * 1e6));
    strokes(d, plane, list, a, b, o.size, last && o.second ? o.second : o.color, pieces);
  }
  const sign: Sign = { pieces, centre: f.at(lx + w / 2, ly + h / 2, -depth), color: o.color };
  signs.push(sign);
  return sign;
}

/** How far a flat sign reaches (its raceway's width and height), to place it. */
export function flatSize(count: number, size: number, vertical = false): [number, number] {
  const pitch = size * 1.2;
  const pad = size * 0.18;
  const long = count * pitch - (pitch - size) + 2 * pad;
  return vertical ? [size + 2 * pad, long] : [long, size + 2 * pad];
}

/**
 * A blade sign sticking out of a facade at lx (its centre): `segments` sheet-metal boxes `width`
 * × 1.5 × `out` stacked from y0, each touching the facade, with lightbox faces on both sides
 * (glyphs `cell` m from atlas column `col`) and neon along their edges.
 */
export function blade(d: Destruction, f: Frame, lx: number, y0: number, o: { segments: number; width: number; out: number; face: number; edge: number; cell: number; col: number }): Sign {
  const pieces: Piece[] = [];
  const seg = 1.5;
  const { width: bw, out } = o;
  const face = 0.03;
  // What's behind the facade a little in (slabs and walls): each segment is bolted through to it as
  // well, so a sign whose pier is blown away hangs on from the floors and sparks
  const behind = d.all().filter((p) => p.state === 'fixed' && p.materialName === 'concrete');
  for (let i = 0; i < o.segments; i++) {
    const y = y0 + i * seg;
    const body = f.box(d, 'signbox', lx - bw / 2, y, -out, bw, seg, out, { tint: 0x2a2c34 });
    if (!body) continue;
    pieces.push(body);
    // The nearest floor slab (or a wall at that height), half a metre in
    for (let k = 1; k < 12; k++) {
      const ys = levelY(k) + TS / 2;
      if (ys < y - 0.8 || ys > y + seg + 0.8) continue;
      const q = f.at(lx, ys, 0.5);
      const anchor = behind.find((p) => [0, 1, 2].every((a) => q[a] > p.bounds.min[a] - 0.05 && q[a] < p.bounds.max[a] + 0.05));
      if (anchor) d.bond(body, anchor, 0.03);
    }
  }
  // The faces and their edge tubes, on both sides
  const h = o.segments * seg;
  for (const s of [-1, 1]) {
    const lxFace = s < 0 ? lx - bw / 2 - face : lx + bw / 2;
    const n: V3 = [f.along[0] * s, 0, f.along[2] * s];
    // The whole face's box (all segments): the glyphs run on across the seams
    const lo = f.at(lxFace, y0, -out);
    const hi = f.at(lxFace + face, y0 + h, 0);
    const whole = { min: [Math.min(lo[0], hi[0]), y0, Math.min(lo[2], hi[2])] as V3, max: [Math.max(lo[0], hi[0]), y0 + h, Math.max(lo[2], hi[2])] as V3 };
    for (let i = 0; i < o.segments; i++) {
      const y = y0 + i * seg;
      const p = lightbox(d, f.at(lxFace + face / 2, y + seg / 2, -out / 2), f.size(face, seg, out), n, o.face, o.cell, o.col, 3, [(out - o.cell) / 2, 0.15], whole);
      if (p) pieces.push(p);
    }
    // Edge tubes on the face, along its outer and inner edges, a tube a segment
    const plane: Plane = { o: f.at(s < 0 ? lxFace : lxFace + face, y0, 0), right: f.out, up: [0, 1, 0], n };
    for (let i = 0; i < o.segments; i++)
      for (const a of [0.035, out - 0.035]) {
        const p = tube(d, plane, a, i * seg + 0.02, a, (i + 1) * seg - 0.02, o.edge);
        if (p) pieces.push(p);
      }
  }
  const sign: Sign = { pieces, centre: f.at(lx, y0 + h / 2, -out / 2), color: o.face };
  signs.push(sign);
  return sign;
}

/** The big blade's crown: an amber ring of eight tubes on a round plate standing on a plinth, on top at y. */
export function crown(d: Destruction, f: Frame, lx: number, y: number, out: number, sign: Sign): void {
  const plinth = f.box(d, 'signbox', lx - 0.175, y, -out, 0.35, 0.3, out, { tint: 0x2a2c34 });
  if (plinth) sign.pieces.push(plinth);
  // The plate: an octagon in the plane across the blade (facing ±along), its flat bottom on the plinth
  const r = 0.55;
  const cy = y + 0.3 + r * Math.cos(Math.PI / 8);
  const c = f.at(lx, cy, -out / 2);
  const outv = f.out;
  const pts: V3[] = [];
  for (let k = 0; k < 8; k++) {
    const a = Math.PI / 8 + (k * Math.PI) / 4 - Math.PI / 2;
    for (const s of [-0.05, 0.05]) pts.push(add(add(c, mul(outv, r * Math.cos(a))), add([0, r * Math.sin(a), 0], mul(f.along, s))));
  }
  const plate = d.addConvex({ material: 'signbox', points: pts, tint: 0x2a2c34 });
  if (plate) sign.pieces.push(plate);
  for (const s of [-1, 1]) {
    const n: V3 = [f.along[0] * s, 0, f.along[2] * s];
    const plane: Plane = { o: add(c, mul(f.along, 0.05 * s)), right: outv, up: [0, 1, 0], n };
    for (let k = 0; k < 8; k++) {
      const [a0, a1] = [(k * Math.PI) / 4, ((k + 1) * Math.PI) / 4];
      const rr = 0.42;
      const p = tube(d, plane, rr * Math.cos(a0), rr * Math.sin(a0), rr * Math.cos(a1), rr * Math.sin(a1), 0xffa62b);
      if (p) sign.pieces.push(p);
    }
  }
}

/**
 * A billboard: lightbox panels (cols × rows, each `pw` × `ph`) on a sheet-metal backing `depth`
 * deep, its back at `back` (world), facing `n` (a world axis), centred at (`centre` across, y0 up).
 * The panels show atlas cells `cell` m from (col, row), across all of them. Optional neon frame.
 */
export function billboard(d: Destruction, o: { back: V3; n: V3; cols: number; rows: number; pw: number; ph: number; depth: number; tint: number; cell: number; col: number; row: number; frame?: number }): Sign {
  const pieces: Piece[] = [];
  const { n } = o;
  const xAxis = Math.abs(n[0]) > 0.5;
  // Across the face: the horizontal axis in the plane
  const right: V3 = xAxis ? [0, 0, n[0] > 0 ? 1 : -1] : [n[2] > 0 ? -1 : 1, 0, 0];
  const W = o.cols * o.pw;
  const Hh = o.rows * o.ph;
  const at = (a: number, b: number, c: number): V3 => add(add(o.back, mul(right, a - W / 2)), add([0, b, 0], mul(n, c)));
  const sizeOf = (a: number, b: number, c: number): V3 => (xAxis ? [c, b, a] : [a, b, c]);
  // The backing, with a rim round the panels for the frame's tubes
  const m = o.frame === undefined ? 0 : 0.12;
  const [bw, bh] = [(W + 2 * m) / o.cols, (Hh + 2 * m) / o.rows];
  for (let i = 0; i < o.cols; i++)
    for (let j = 0; j < o.rows; j++) {
      const p = d.addBox({ material: 'signbox', size: sizeOf(bw, bh, o.depth), position: at(-m + (i + 0.5) * bw, -m + (j + 0.5) * bh, o.depth / 2), tint: 0x22242a });
      if (p) pieces.push(p);
    }
  const lo = at(0, 0, o.depth);
  const hi = at(W, Hh, o.depth + 0.03);
  const whole = { min: [Math.min(lo[0], hi[0]), lo[1], Math.min(lo[2], hi[2])] as V3, max: [Math.max(lo[0], hi[0]), hi[1], Math.max(lo[2], hi[2])] as V3 };
  for (let i = 0; i < o.cols; i++)
    for (let j = 0; j < o.rows; j++) {
      const p = lightbox(d, at((i + 0.5) * o.pw, (j + 0.5) * o.ph, o.depth + 0.015), sizeOf(o.pw, o.ph, 0.03), n, o.tint, o.cell, o.col, o.row, [0, 0], whole);
      if (p) pieces.push(p);
    }
  if (o.frame !== undefined) {
    // A neon frame round the panels, on the backing's rim
    const plane: Plane = { o: at(0, 0, o.depth), right, up: [0, 1, 0], n };
    const e = m / 2;
    const runsW = Math.max(1, Math.round(W / 1.5));
    const runsH = Math.max(1, Math.round(Hh / 1.5));
    for (let i = 0; i < runsW; i++)
      for (const b of [-e, Hh + e]) {
        const p = tube(d, plane, (i * W) / runsW, b, ((i + 1) * W) / runsW, b, o.frame);
        if (p) pieces.push(p);
      }
    for (let j = 0; j < runsH; j++)
      for (const a of [-e, W + e]) {
        const p = tube(d, plane, a, (j * Hh) / runsH, a, ((j + 1) * Hh) / runsH, o.frame);
        if (p) pieces.push(p);
      }
  }
  const sign: Sign = { pieces, centre: at(W / 2, Hh / 2, o.depth), color: o.tint };
  signs.push(sign);
  return sign;
}
