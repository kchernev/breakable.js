// The buildings. Type A is a concrete frame clad in tile: slabs tied to the facade's bands, tile
// columns, and between them bays of spandrel, glass and head; it fails at its ground-floor columns
// and comes down in chunks. Type B is a rendered masonry shophouse built as Brick Street builds its
// walk-ups: a free-standing facade on a steel beam over the shop, which peels away as a sheet when
// its base goes. The end block is a type A with an arcade through its two lower floors, under
// transfer beams. Signs, AC units, pipes and lit windows are put on as each facade is built.

import type { Destruction, Piece } from '../../../lib/index.ts';
import { random } from '../../../lib/index.ts';
import { neonColor, type Pictogram } from './glyphs.ts';
import { END, endFrame, type Frame, GAP, H, H0, laneFrame, levelY, type Lot, lotFrame, runs, T, Taken, TS } from './layout.ts';
import { glow } from './materials.ts';
import { blade, crown, flatSign, flatSize, lightbox, type Plane, type Sign, signs, tube } from './signs.ts';
import { awning, shutter } from './street.ts';

/** Where the blade signs stand (world x, side), besides the big one on N4. */
const BLADES: Array<[number, 1 | -1]> = [
  [-22.5, 1],
  [-16, -1],
  [-9, 1],
  [-1, -1],
  [5, -1],
  [11, 1],
  [15, -1],
  [20, -1],
  [25, 1],
];
const BIG_BLADE = 0.9;
const WINDOW_TINTS = [0xffd9a8, 0xffd9a8, 0xcfe6ff, 0xffc8dc];
const PICTOS: Pictogram[] = ['bowl', 'fish', 'cup', 'key', 'arrow'];

/** What a facade is built from, for putting things on it: its spandrels, fascias and columns (lx spans, by floor). */
interface Facade {
  f: Frame;
  W: number;
  taken: Taken;
  /** Spandrel runs per floor: [lx0, lx1] (between columns). */
  spandrels: Array<Array<[number, number]>>;
  /** Ground-floor fascias between columns, and the shop under each. */
  fascias: Array<[number, number]>;
  columns: Array<[number, number]>;
}

/** The big blade (a point light hangs under it). */
export const landmarks = { bigBlade: null as Sign | null };

/** Column spans along a facade W long: the ends, `given` (left edges, 0.45 wide; or [lx, width]), else every ~3.8 m when wide. */
function columnSpans(W: number, given?: number[]): Array<[number, number]> {
  const c = 0.45;
  let lefts: Array<[number, number]> = [];
  if (given) lefts = given.map((x) => [x, x > W - 1.5 ? 0.6 : c]);
  else if (W >= 8.5) {
    const n = Math.round(W / 3.8);
    for (let i = 1; i < n; i++) lefts.push([(i * W) / n - c / 2, c]);
  }
  const spans: Array<[number, number]> = [[0, c], ...lefts.map(([x, w]) => [x, x + w] as [number, number]), [W - c, W]];
  // Columns closer than 0.8 m merge into one wide pier (no sliver of a window)
  const out: Array<[number, number]> = [];
  for (const s of spans.sort((a, b) => a[0] - b[0])) {
    const last = out[out.length - 1];
    if (last && s[0] - last[1] < 0.8) last[1] = Math.max(last[1], s[1]);
    else out.push([s[0], s[1]]);
  }
  return out;
}

/** The openings between columns. */
const openings = (cols: Array<[number, number]>): Array<[number, number]> => cols.slice(1).map((c, i) => [cols[i][1], c[0]]);

/**
 * One type A floor of a facade module (columns, and bays of spandrel, glass and head between them)
 * from yb, `fh` tall, in frame f; `framed`: each pane with a steel mullion and transom. Returns its
 * spandrel runs.
 */
function frameFloor(d: Destruction, f: Frame, cols: Array<[number, number]>, yb: number, fh: number, tint: number, mullions: boolean, framed = mullions): Array<[number, number]> {
  const tile = { tint, textureFrame: f.texture };
  for (const [a, b] of cols) f.box(d, 'tile', a, yb, 0, b - a, fh, T, tile);
  const runsOut: Array<[number, number]> = [];
  for (const [a, b] of openings(cols)) {
    const nb = Math.max(1, Math.round((b - a) / 2.3));
    const bw = (b - a) / nb;
    for (let i = 0; i < nb; i++) {
      const x = a + i * bw;
      f.box(d, 'tile', x, yb, 0, bw, 0.9, T, tile);
      f.box(d, 'glass', x + 0.05, yb + 0.9, 0.12, bw - 0.1, 1.5, 0.03);
      f.box(d, 'tile', x, yb + 2.4, 0, bw, fh - 2.4, T, tile);
      if (mullions) for (const mx of [x + 0.05, x + bw - 0.1]) f.box(d, 'steel', mx, yb + 0.9, 0.06, 0.05, 1.5, 0.06);
      if (framed) {
        // A transom under a top light, a mullion under it (touching, not crossing)
        f.box(d, 'steel', x + 0.1, yb + 1.95, 0.06, bw - 0.2, 0.04, 0.06, { tint: 0x3a3e46 });
        f.box(d, 'steel', x + bw / 2 - 0.02, yb + 0.9, 0.06, 0.04, 1.05, 0.06, { tint: 0x3a3e46 });
      }
    }
    runsOut.push([a, b]);
  }
  return runsOut;
}

/**
 * The longest a slab panel may be: the ground slab's (on the ground, under the shops' thresholds)
 * and, from level 3 up, out of sight from the street, bigger.
 */
const STATIC = 3;
const panel = (k: number): number => (k >= 3 ? 3 : 2.2);

/** Slab panels of one level from lz0 to D across lx0 … lx1 (`isStatic`: the ground slab, in bigger panels). */
function slab(d: Destruction, f: Frame, k: number, lx0: number, lx1: number, lz0: number, D: number, isStatic = false): void {
  const W = lx1 - lx0;
  const most = isStatic ? STATIC : panel(k);
  const [nx, nz] = [runs(W, most), runs(D - lz0, most)];
  for (let i = 0; i < nx; i++)
    for (let j = 0; j < nz; j++) {
      const [x1, x2] = [lx0 + (i * W) / nx, lx0 + ((i + 1) * W) / nx];
      const [z1, z2] = [lz0 + (j * (D - lz0)) / nz, lz0 + ((j + 1) * (D - lz0)) / nz];
      f.box(d, 'concrete', x1, levelY(k), z1, x2 - x1, TS, z2 - z1, { tint: 0xb8bcc4 });
    }
}

/** A wall run from (lx0, lz0) along lx or lz in panels of at most 2.2 m, from y0 to y1 (in courses if tall). */
function wall(d: Destruction, f: Frame, material: string, along: 'x' | 'z', a0: number, a1: number, at: number, y0: number, y1: number, tint?: number): void {
  const n = runs(a1 - a0);
  const courses = y1 - y0 > 3 ? 2 : 1;
  const extra = { tint, textureFrame: f.texture };
  for (let i = 0; i < n; i++)
    for (let c = 0; c < courses; c++) {
      const [p, q] = [a0 + (i * (a1 - a0)) / n, a0 + ((i + 1) * (a1 - a0)) / n];
      const [ya, yb] = [y0 + (c * (y1 - y0)) / courses, y0 + ((c + 1) * (y1 - y0)) / courses];
      if (along === 'x') f.box(d, material, p, ya, at, q - p, yb - ya, T, extra);
      else f.box(d, material, at, ya, p, T, yb - ya, q - p, extra);
    }
}

/** A lit shop: its lamps, the box its light fills and its colour (wet.ts reflects them); its kind, and its door on the facade line (street.ts puts clutter there). */
export interface Shop {
  lamps: Piece[];
  min: number[];
  max: number[];
  color: number;
  kind: 'noodle' | 'store';
  door: [number, number, number];
  along: [number, number, number];
  out: [number, number, number];
  width: number;
}

export const shops: Shop[] = [];

/** A box of the frame that glows evenly (a lightbox face on a blank of the atlas): a lit wall, a chiller door. */
function litPanel(d: Destruction, f: Frame, lx: number, ly: number, lz: number, sx: number, sy: number, sz: number, tint: number, level: number): Piece | null {
  const p = f.box(d, 'lightbox', lx, ly, lz, sx, sy, sz, { tint });
  // Scale 0 at a corner of the atlas's first cell: no glyph there
  glow.light(p, [0, 0.004, 0.004]);
  if (p) glow.set(p, level);
  return p;
}

const GOODS = [0xff3a2a, 0x2a6aff, 0x30d060, 0xffc020];

/**
 * A lit shop front between lx0 and lx1 under y1: glass with a door gap, two ceiling panels, a back
 * wall that glows with the shop's light, menus on it, and inside either a noodle counter with
 * stools and hanging lamps, or shelves of goods and a chiller.
 */
function litShop(d: Destruction, f: Frame, lx0: number, lx1: number, y1: number, D: number, rand: () => number, door: boolean, kind: 'noodle' | 'store' = rand() < 0.5 ? 'noodle' : 'store'): void {
  const w = lx1 - lx0;
  const doorW = door && w > 2.4 ? 1.0 : 0;
  const doorAt = lx0 + 0.3 + rand() * Math.max(0, w - doorW - 0.6);
  const top = TS + 2.6;
  const panes = (a: number, b: number) => {
    const n = Math.max(1, Math.ceil((b - a) / 1.8));
    for (let i = 0; i < n; i++) f.box(d, 'glass', a + (i * (b - a)) / n, TS, 0.12, (b - a) / n, Math.min(2.6, y1 - TS - 0.01), 0.03);
  };
  if (doorW) {
    panes(lx0, doorAt);
    panes(doorAt + doorW, lx1);
    // The door's glass transom
    f.box(d, 'glass', doorAt, TS + 2.1, 0.12, doorW, Math.min(top, y1 - 0.01) - TS - 2.1, 0.03);
  } else panes(lx0, lx1);
  const warm = rand() < 0.6;
  const light = warm ? 0xffe2b8 : 0xe0f0ff;
  const ceiling = levelY(1);
  const mid = lx0 + w / 2;
  const back = D - T - 0.02;
  const lamps: Piece[] = [];
  const lamp = (p: Piece | null, level: number) => {
    glow.light(p);
    if (!p) return;
    glow.set(p, level);
    lamps.push(p);
  };
  // Two ceiling panels, one near the window and one deep in: bright, so the shop lights the street
  const pw = Math.min(1.2, w * 0.4);
  lamp(f.box(d, 'lamp', lx0 + w * 0.3 - pw / 2, ceiling - 0.06, 1.1, pw, 0.06, 0.8, { tint: light }), 4);
  lamp(f.box(d, 'lamp', lx0 + w * 0.7 - pw / 2, ceiling - 0.06, D - 3.6, pw, 0.06, 0.8, { tint: light }), 4);
  // The back wall, lit: a glowing panel over it, in runs
  const nb = runs(w - 0.1);
  const wallH = Math.min(3.0, ceiling - TS - 0.1);
  for (let i = 0; i < nb; i++) {
    const p = litPanel(d, f, lx0 + 0.05 + (i * (w - 0.1)) / nb, TS, back, (w - 0.1) / nb, wallH, 0.02, light, 1.0);
    if (p) lamps.push(p);
  }
  // The floor inside the window catches the light (a faint glowing sheet, short of the counter)
  for (let i = 0; i < nb; i++) {
    const p = litPanel(d, f, lx0 + 0.05 + (i * (w - 0.1)) / nb, TS, 0.2, (w - 0.1) / nb, 0.01, 1.65, light, 0.18);
    if (p) lamps.push(p);
  }
  const menuW = Math.min(1.8, w / 2 - 0.2);
  const color = neonColor(rand);
  const menuY = kind === 'store' ? 2.65 : 2.0;
  for (const s of [-1, 1]) {
    const cx = mid + s * (menuW / 2 + 0.05);
    const sign: Sign = { pieces: [], centre: f.at(cx, menuY, back), color };
    const p = lightbox(d, f.at(cx, menuY, back - 0.015), f.size(menuW, 0.6, 0.03), f.out, color, 0.28, Math.floor(rand() * 3), Math.floor(rand() * 2), [0.05, 0.02]);
    if (p) sign.pieces.push(p);
    signs.push(sign);
  }
  if (kind === 'noodle' && w > 2.4) {
    // The counter, red plastic stools before it, two lamps hanging over it
    f.box(d, 'signbox', mid - 1.0, TS, 2.6, 2.0, 1.0, 0.6, { tint: rand() < 0.5 ? 0x8a3a2a : 0xd8d0c0 });
    for (const dx of [-0.7, 0, 0.7]) {
      f.box(d, 'steel', mid + dx - 0.03, TS, 2.07, 0.06, 0.62, 0.06, { tint: 0x2a2c30 });
      f.box(d, 'signbox', mid + dx - 0.16, TS + 0.62, 1.94, 0.32, 0.06, 0.32, { tint: 0xd02a20 });
    }
    // Each lamp: a dark shade on its cord, a warm glowing diffuser under it
    for (const dx of [-0.55, 0.55]) {
      f.box(d, 'steel', mid + dx - 0.01, ceiling - 0.6, 2.89, 0.02, 0.6, 0.02, { tint: 0x15161a });
      f.box(d, 'signbox', mid + dx - 0.17, ceiling - 0.72, 2.73, 0.34, 0.12, 0.34, { tint: 0x2a1c18 });
      lamp(f.box(d, 'lamp', mid + dx - 0.13, ceiling - 0.8, 2.77, 0.26, 0.08, 0.26, { tint: 0xffb050 }), 6);
    }
  } else {
    if (w > 2.4) f.box(d, 'signbox', mid - 1.0, TS, 2.6, 2.0, 1.0, 0.6, { tint: 0xd8d0c0 });
    // Shelves against the back wall with rows of goods, and a chiller beside them
    if (w >= 2.6) {
      const sx = lx0 + 0.15;
      const sw = Math.min(2.0, w - 1.3);
      f.box(d, 'signbox', sx, TS, back - 0.4, sw, 1.8, 0.4, { tint: 0x8a8e94 });
      for (let row = 0; row < 3; row++) {
        const n = Math.floor((sw - 0.1) / 0.3);
        for (let k = 0; k < n; k += 1 + (rand() < 0.3 ? 1 : 0)) lamp(f.box(d, 'lamp', sx + 0.08 + k * 0.3, TS + 0.35 + row * 0.5, back - 0.52, 0.22, 0.18, 0.12, { tint: GOODS[(row + k) % GOODS.length] }), 0.7);
      }
      const cx = lx1 - 0.15 - 0.8;
      f.box(d, 'signbox', cx, TS, back - 0.6, 0.8, 1.9, 0.57, { tint: 0xd8dcd8 });
      const door = litPanel(d, f, cx + 0.05, TS + 0.1, back - 0.63, 0.7, 1.7, 0.03, 0xdff4ff, 1.4);
      if (door) lamps.push(door);
    }
  }
  const lo = f.at(lx0, TS, 0.12);
  const hi = f.at(lx1, TS + 2.6, 0.15);
  shops.push({
    lamps,
    min: [Math.min(lo[0], hi[0]), lo[1], Math.min(lo[2], hi[2])],
    max: [Math.max(lo[0], hi[0]), hi[1], Math.max(lo[2], hi[2])],
    color: light,
    kind,
    door: f.at(doorW ? doorAt + doorW / 2 : mid, 0, 0),
    along: f.along,
    out: f.out,
    width: w,
  });
}

/** Curtains and blinds in unlit rooms: muted cloth, a grey blind. */
const CURTAINS = [0x5a4a62, 0x4a5a58, 0x6a5444, 0x3e4a66, 0x7a7a78, 0x6a4048];

/**
 * Upper-floor rooms behind a type A facade's windows: lit ones (a glowing panel inside), and
 * behind about half of the rest a curtain or blind (unlit), so the windows read as rooms and not
 * holes. `more` draws the curtains (so the lit rooms stay where they were).
 */
function windowsLit(d: Destruction, f: Frame, spandrels: Array<[number, number]>, yb: number, rand: () => number, more: () => number): void {
  for (const [a, b] of spandrels) {
    const nb = Math.max(1, Math.round((b - a) / 2.3));
    const bw = (b - a) / nb;
    for (let i = 0; i < nb; i++) {
      if (rand() > 0.22) {
        if (more() < 0.5) f.box(d, 'lamp', a + i * bw + 0.1, yb, T + 0.5, bw - 0.2, 2.2, 0.02, { tint: CURTAINS[Math.floor(more() * CURTAINS.length)] });
        continue;
      }
      glow.light(f.box(d, 'lamp', a + i * bw + 0.1, yb, T + 0.5, bw - 0.2, 2.2, 0.02, { tint: WINDOW_TINTS[Math.floor(rand() * WINDOW_TINTS.length)] }));
    }
  }
}

/** An AC unit on two brackets on a facade face at (lx, y). */
function acUnit(d: Destruction, f: Frame, lx: number, y: number): void {
  for (const bx of [lx + 0.1, lx + 0.65]) f.box(d, 'steel', bx, y, -0.35, 0.05, 0.05, 0.35);
  f.box(d, 'signbox', lx, y + 0.05, -0.32, 0.8, 0.5, 0.3, { tint: 0xd8dcd8 });
}

/** A drain pipe up a column face at lx (its centre), octagonal, in 1.5 m lengths, from y0 to y1. */
function drainPipe(d: Destruction, f: Frame, lx: number, y0: number, y1: number): void {
  const r = 0.06;
  const n = Math.max(1, Math.round((y1 - y0) / 1.5));
  for (let i = 0; i < n; i++) {
    const [ya, yb] = [y0 + (i * (y1 - y0)) / n, y0 + ((i + 1) * (y1 - y0)) / n];
    const pts: Array<[number, number, number]> = [];
    // A flat face against the wall: corners at 22.5° + k·45° about the pipe's axis
    const c = r * Math.cos(Math.PI / 8);
    for (let k = 0; k < 8; k++) {
      const a = Math.PI / 8 + (k * Math.PI) / 4;
      for (const y of [ya, yb]) pts.push(f.at(lx + r * Math.cos(a), y, -c + r * Math.sin(a)));
    }
    // Shaded round: its faces meet at 45°
    d.addConvex({ material: 'steel', points: pts, tint: 0x7a7e84, smooth: 0.8 });
  }
}

/** Three pipes up a ground-floor column face at lx (the bundle's centre), to the band at level 1. */
function pipeBundle(d: Destruction, f: Frame, lx: number): void {
  const r = 0.05;
  const c = r * Math.cos(Math.PI / 8);
  const top = levelY(1);
  for (const dx of [-0.11, 0, 0.11])
    for (const [ya, yb] of [
      [0.3, 0.3 + (top - 0.3) / 2],
      [0.3 + (top - 0.3) / 2, top],
    ]) {
      const pts: Array<[number, number, number]> = [];
      for (let k = 0; k < 8; k++) {
        const a = Math.PI / 8 + (k * Math.PI) / 4;
        for (const y of [ya, yb]) pts.push(f.at(lx + dx + r * Math.cos(a), y, -c + r * Math.sin(a)));
      }
      d.addConvex({ material: 'steel', points: pts, tint: dx ? 0x8a8e94 : 0x4a5a6a, smooth: 0.8 });
    }
}

/** Signs and things on a facade's upper floors and fascias, around what's taken. */
function dress(d: Destruction, fa: Facade, floors: number, rand: () => number, o: { ac: boolean; pipe: boolean }): void {
  const { f, taken } = fa;
  // Fascia signs: a neon row on each fascia
  for (const [a, b] of fa.fascias) {
    const size = 0.42;
    let count = Math.min(3, Math.floor((b - a - 0.4) / (size * 1.2)));
    if (count < 2) continue;
    count = 2 + Math.floor(rand() * (count - 1));
    const [w] = flatSize(count, size);
    const lx = a + (b - a - w) / 2;
    if (!taken.free(lx, 2.9, lx + w, 3.55)) continue;
    taken.take(lx, 2.9, lx + w, 3.55);
    const color = neonColor(rand);
    flatSign(d, f, lx, 2.92, { count, size, color, second: neonColor(rand, color), picto: rand() < 0.5 ? PICTOS[Math.floor(rand() * PICTOS.length)] : undefined, seed: Math.floor(rand() * 1e6) });
  }
  // Spandrel signs on floors 1 to 4, AC units elsewhere
  for (let k = 1; k < Math.min(floors, 5); k++) {
    const yb = levelY(k) + TS;
    for (const [a, b] of fa.spandrels[k] ?? []) {
      if (rand() < 0.45) {
        const size = 0.5;
        const max = Math.floor((b - a - 0.3) / (size * 1.2));
        if (max >= 2) {
          const count = 2 + Math.floor(rand() * Math.min(2, max - 1));
          const [w, h] = flatSize(count, size);
          const lx = a + 0.1 + rand() * (b - a - w - 0.2);
          const ly = yb + (0.9 - h) / 2;
          if (taken.free(lx, ly, lx + w, ly + h)) {
            taken.take(lx, ly, lx + w, ly + h);
            const color = neonColor(rand);
            flatSign(d, f, lx, ly, { count, size, color, second: rand() < 0.4 ? neonColor(rand, color) : undefined, seed: Math.floor(rand() * 1e6) });
            continue;
          }
        }
      }
      if (!o.ac) continue;
      const nb = Math.max(1, Math.round((b - a) / 2.3));
      const bw = (b - a) / nb;
      for (let i = 0; i < nb; i++) {
        if (rand() > 0.3) continue;
        const lx = a + i * bw + (bw - 0.8) / 2 + (rand() - 0.5) * 0.4;
        if (!taken.free(lx, yb + 0.1, lx + 0.8, yb + 0.6)) continue;
        taken.take(lx, yb + 0.1, lx + 0.8, yb + 0.6);
        acUnit(d, f, lx, yb + 0.1);
      }
    }
  }
  // A column of glyphs down one column face, and a drain pipe down another
  const wide = fa.columns.filter(([a, b]) => b - a >= 0.44);
  if (wide.length && rand() < 0.6) {
    const [a, b] = wide[Math.floor(rand() * wide.length)];
    const size = Math.min(0.36, (b - a - 0.06) / 1.36);
    const count = 3 + Math.floor(rand() * 2);
    const [w, h] = flatSize(count, size, true);
    const lx = (a + b) / 2 - w / 2;
    const ly = levelY(1) + TS + 0.3;
    if (ly + h < levelY(floors) && taken.free(lx, ly, lx + w, ly + h)) {
      taken.take(lx, ly, lx + w, ly + h);
      flatSign(d, f, lx, ly, { count, size, color: neonColor(rand), vertical: true, seed: Math.floor(rand() * 1e6) });
    }
  }
  if (o.pipe) {
    const c = fa.columns[fa.columns.length - 1];
    const lx = c[1] - 0.12;
    const [y0, y1] = [0.3, levelY(floors) + TS];
    if (taken.free(lx - 0.07, y0, lx + 0.07, y1, 0)) {
      taken.take(lx - 0.07, y0, lx + 0.07, y1);
      drainPipe(d, f, lx, y0, y1);
    }
  }
}

/** Blade signs on a facade (world x positions on this lot), before anything else takes the face. */
function blades(d: Destruction, fa: Facade, lot: Lot, rand: () => number): void {
  const { f, taken } = fa;
  for (const [x, side] of BLADES) {
    if (side !== lot.side || x < lot.x0 + 1 || x > lot.x1 - 1) continue;
    const lx = x - lot.x0 - GAP / 2;
    const segments = 2 + Math.floor(rand() * 3);
    const top = 4.2 + segments * 1.5;
    if (top > levelY(lot.floors) - 0.2) continue;
    taken.take(lx - 0.25, 4.1, lx + 0.25, top + 0.1);
    const face = neonColor(rand);
    blade(d, f, lx, 4.2, { segments, width: 0.25, out: 0.7, face, edge: neonColor(rand, face), cell: 0.56, col: Math.floor(rand() * 2) });
  }
  if (lot.id === 'N4') {
    const lx = BIG_BLADE - lot.x0 - GAP / 2;
    taken.take(lx - 0.3, 4.1, lx + 0.3, 17);
    const sign = blade(d, f, lx, 4.2, { segments: 8, width: 0.35, out: 0.9, face: 0xff2bd6, edge: 0x22e6ff, cell: 0.8, col: 0 });
    crown(d, f, lx, 4.2 + 8 * 1.5, 0.9, sign);
    landmarks.bigBlade = sign;
  }
  if (lot.hotel !== undefined) {
    // The hotel sign: a moon and two glyphs on the band at level 3, flickering on its own
    const [w, h] = flatSize(3, 0.55);
    const ly = levelY(3) + 0.05;
    taken.take(lot.hotel, ly, lot.hotel + w, ly + h);
    const sign = flatSign(d, f, lot.hotel, ly, { count: 3, size: 0.55, color: 0xfff1d6, second: 0xff3a7a, picto: 'moon', seed: 77 });
    sign.flicker = true;
  }
}

/**
 * The roof: a parapet on all four sides, and what stands on it. Given `more` (the type A towers),
 * also a stair head-house with a lit door and an antenna in the back corner, a row of condensers
 * along the front and a washing line.
 */
function roof(d: Destruction, f: Frame, W: number, D: number, floors: number, material: string, tint: number, items: Lot['roof'], rand: () => number, more?: () => number): void {
  const y = levelY(floors) + TS;
  const ph = 1.0;
  wall(d, f, material, 'x', 0, W, 0, y, y + ph, tint);
  wall(d, f, material, 'x', 0, W, D - T, y, y + ph, tint);
  wall(d, f, material, 'z', T, D - T, 0, y, y + ph, tint);
  wall(d, f, material, 'z', T, D - T, W - T, y, y + ph, tint);
  if (more) roofClutter(d, f, W, D, y, more);
  // The tank keeps clear of the head-house
  const tankLimit = more ? W - 2.8 : W - 0.5;
  let lx = 1.0;
  for (const item of items ?? []) {
    if (item === 'tank' && lx + 1.6 < tankLimit) {
      // A tank on four legs and a platform
      const [cx, cz] = [lx + 0.8, D - 2.2];
      for (const [dx, dz] of [
        [-0.5, -0.5],
        [0.5, -0.5],
        [-0.5, 0.5],
        [0.5, 0.5],
      ])
        f.box(d, 'steel', cx + dx - 0.04, y, cz + dz - 0.04, 0.08, 0.8, 0.08);
      f.box(d, 'steel', cx - 0.65, y + 0.8, cz - 0.65, 1.3, 0.08, 1.3);
      const pts: Array<[number, number, number]> = [];
      for (let k = 0; k < 12; k++) for (const h of [0, 1.4]) pts.push(f.at(cx + 0.6 * Math.cos((k * Math.PI) / 6), y + 0.88 + h, cz + 0.6 * Math.sin((k * Math.PI) / 6)));
      d.addConvex({ material: 'signbox', points: pts, tint: rand() < 0.5 ? 0xd8dce0 : 0x5a7a9a, smooth: 0.6 });
      lx += 2.2;
    } else if (item === 'condenser' && lx + 2.2 < W - 0.5) {
      for (let i = 0; i < 2; i++) f.box(d, 'signbox', lx + i * 1.1, y, 2 + rand() * 2, 1.0, 0.8, 0.5, { tint: 0xc8ccc8 });
      lx += 2.6;
    } else if (item === 'mast') {
      const mx = W - 1.2;
      for (let k = 0; k < 3; k++) f.box(d, 'steel', mx, y + k * 2, D / 2, 0.08, 2, 0.08);
    } else if (item === 'billboard') {
      // On two posts, facing -x (toward the start), across the roof
      billboardOnRoof(d, f, Math.min(W - 1.0, lx + 0.6), y, D, rand);
      lx += 1.5;
    }
  }
}

/** A type A roof's clutter (see roof()), in the back corner and along the front parapet: few pieces. */
function roofClutter(d: Destruction, f: Frame, W: number, D: number, y: number, more: () => number): void {
  // The head-house: a concrete box, a steel door facing the front, a warm lamp over it, an antenna
  const [hx, hz, hh] = [W - 2.6, D - 2.5, 2.4];
  f.box(d, 'concrete', hx, y, hz, 2.0, hh, 2.0, { tint: 0xb8bcc4 });
  f.box(d, 'steel', hx + 0.5, y, hz - 0.04, 0.9, 2.0, 0.04, { tint: 0x3a4048 });
  const lamp = f.box(d, 'lamp', hx + 0.8, y + 2.1, hz - 0.1, 0.3, 0.12, 0.1, { tint: 0xffc890 });
  glow.light(lamp);
  if (lamp) glow.set(lamp, 2.5);
  f.box(d, 'steel', hx + 1.6, y + hh, hz + 1.5, 0.05, 2.0, 0.05, { tint: 0x5a5e66 });
  // Condensers in a row along the front parapet, on the left half (three at most)
  for (let cx = 0.8; cx + 1.0 < Math.min(W / 2 - 0.2, 4.1); cx += 1.1) f.box(d, 'signbox', cx, y, 0.7, 1.0, 0.75, 0.5, { tint: more() < 0.5 ? 0xc8ccc8 : 0xb8bcb4 });
  // A washing line on the right half: two posts, the line on their tops, cloths hung from it
  const p0 = W / 2 + 0.2;
  const p1 = Math.min(W - 0.8, p0 + 2.2);
  if (p1 - p0 < 1.6) return;
  for (const px of [p0, p1 - 0.05]) f.box(d, 'steel', px, y, 0.95, 0.05, 1.7, 0.05, { tint: 0x4a4e54 });
  const line = f.box(d, 'steel', p0, y + 1.7, 0.95, p1 - p0, 0.02, 0.05, { tint: 0x2a2c30 });
  if (!line) return;
  for (let x = p0 + 0.2; x < p1 - 0.6; x += 0.5 + more() * 0.3) {
    const cloth = f.box(d, 'awning', x, y + 1.15, 0.965, 0.3 + more() * 0.15, 0.55, 0.02, { tint: [0xe8e0d0, 0x4a6aa0, 0xc85050, 0xe0c060, 0x7aa07a][Math.floor(more() * 5)] });
    if (cloth) d.bond(cloth, line, 0.005);
  }
}

/** A rooftop billboard 3 × 2 m facing -x at lx, on two steel posts standing on the roof slab. */
function billboardOnRoof(d: Destruction, f: Frame, lx: number, y: number, D: number, rand: () => number): void {
  const zc = D / 2;
  const bottom = 1.4;
  const tint = neonColor(rand);
  // The posts (world x: f's lx at a north or south lot)
  for (const dz of [-0.9, 0.9]) for (let k = 0; k < 2; k++) f.box(d, 'steel', lx, y + k * 1.7, zc + dz - 0.06, 0.12, 1.7, 0.12);
  const back = f.at(lx, y + bottom, zc);
  const sign = billboardFacingWest(d, back, tint, rand);
  signs.push(sign);
}

/** Two lightbox panels 1.5 × 2 on a backing 0.1 deep whose +x face is at `back`, facing -x. */
function billboardFacingWest(d: Destruction, back: [number, number, number], tint: number, rand: () => number): Sign {
  const pieces: Piece[] = [];
  const x = back[0];
  for (const dz of [-0.75, 0.75]) {
    const p = d.addBox({ material: 'signbox', size: [0.1, 2, 1.5], position: [x - 0.05, back[1] + 1, back[2] + dz], tint: 0x22242a });
    if (p) pieces.push(p);
  }
  const whole = { min: [x - 0.13, back[1], back[2] - 1.5] as [number, number, number], max: [x - 0.1, back[1] + 2, back[2] + 1.5] as [number, number, number] };
  const row = Math.floor(rand() * 2);
  for (const dz of [-0.75, 0.75]) {
    const p = lightbox(d, [x - 0.115, back[1] + 1, back[2] + dz], [0.03, 2, 1.5], [-1, 0, 0], tint, 0.75, 0, row, [0, 0.25], whole);
    if (p) pieces.push(p);
  }
  return { pieces, centre: [x - 0.1, back[1] + 1, back[2]], color: tint };
}

/** A type A tower on a lot. */
export function towerA(d: Destruction, lot: Lot, seed: number): void {
  const rand = random(seed);
  // What was added after the first layout draws from its own stream, so the rest stays put
  const more = random(seed * 7 + 3);
  const f = lotFrame(lot);
  const W = lot.x1 - lot.x0 - GAP;
  const D = lot.depth;
  const cols = columnSpans(W, lot.columns);
  const fa: Facade = { f, W, taken: new Taken(), spandrels: [], fascias: [], columns: cols };
  const tile = { tint: lot.tint, textureFrame: f.texture };
  const corner = lot.corner ? laneFrame(lot) : null;
  // The lane facade's module runs 5 m in from the alley; the side wall goes on behind it
  const laneEnd = T + 5.0;
  // The lane side's lx (in this frame): east corner at W - T, west at 0
  const laneLx = lot.corner === 'east' ? W - T : 0;

  for (let k = 0; k <= lot.floors; k++) {
    // The slab, butting against the band, which runs along the facade
    slab(d, f, k, 0, W, T, D, k === 0);
    const n = runs(W, k === 0 ? STATIC : 2.2);
    for (let i = 0; i < n; i++) f.box(d, 'tile', (i * W) / n, levelY(k), 0, W / n, TS, T, { ...tile });
  }
  for (let k = 0; k < lot.floors; k++) {
    const yb = levelY(k) + TS;
    const fh = (k === 0 ? H0 : H) - TS;
    if (k === 0) {
      // Columns in two lengths, a fascia between them, and under it a lit shop or a shutter
      for (const [a, b] of cols) for (let c = 0; c < 2; c++) f.box(d, 'tile', a, yb + (c * fh) / 2, 0, b - a, fh / 2, T, tile);
      for (const [a, b] of openings(cols)) {
        const n = runs(b - a);
        for (let i = 0; i < n; i++) f.box(d, 'tile', a + (i * (b - a)) / n, 2.85, 0, (b - a) / n, H0 - 2.85, T, tile);
        fa.fascias.push([a, b]);
        const kind = lot.shop ?? (rand() < 0.5 ? 'lit' : 'shutter');
        if (kind === 'lit') litShop(d, f, a, b, 2.85, D, rand, true);
        else shutter(d, f, a, b, TS, 2.85, rand);
      }
    } else {
      fa.spandrels[k] = frameFloor(d, f, cols, yb, fh, lot.tint, lot.id === 'N7', lot.id === 'N7' || k <= 2);
      windowsLit(d, f, fa.spandrels[k], yb, rand, more);
    }
    // Back and side walls (the lane side: a facade module first)
    wall(d, f, 'concrete', 'x', 0, W, D - T, yb, yb + fh);
    for (const lx of [0, W - T]) {
      const lane = corner && lx === laneLx;
      wall(d, f, 'concrete', 'z', lane ? laneEnd : T, D - T, lx, yb, yb + fh);
      if (lane && corner) {
        if (k === 0) wall(d, f, 'concrete', 'z', T, laneEnd, lx, yb, yb + fh);
        else frameFloor(d, corner, [[T, T + 0.45], [laneEnd - 0.45, laneEnd]], yb, fh, lot.tint, false);
      }
    }
    if (W > 7) f.box(d, 'concrete', W / 2 - 0.2, yb, D / 2 - 0.2, 0.4, fh, 0.4, { tint: 0xb8bcc4 });
  }
  if (lot.balconies) for (const k of lot.balconies) cagedBalcony(d, f, cols, k, lot.tint, rand);
  blades(d, fa, lot, rand);
  if (corner) {
    // A blade on the lane facade too, on its column by the side wall
    const face = neonColor(rand);
    blade(d, corner, laneEnd - 0.225, 4.2, { segments: 3, width: 0.25, out: 0.7, face, edge: neonColor(rand, face), cell: 0.56, col: 1 });
    laneWall(d, corner, lot, more);
  }
  dress(d, fa, lot.floors, rand, { ac: true, pipe: seed % 2 === 0 });
  // A bundle of pipes up a ground-floor column (not the last: the drain pipe may be there)
  const inner = cols.slice(0, -1).filter(([a, b]) => b - a >= 0.4);
  if (inner.length && rand() < 0.8) {
    const [a, b] = inner[Math.floor(rand() * inner.length)];
    pipeBundle(d, f, (a + b) / 2);
  }
  roof(d, f, W, D, lot.floors, 'concrete', 0xb8bcc4, lot.roof, rand, more);
  if (lot.awning) {
    const open = openings(cols);
    const [a, b] = open[Math.floor(rand() * open.length)];
    awning(d, f, a + 0.1, b - 0.1, 2.8, neonAwning(rand));
  }
}

/**
 * The side wall on the lane past the facade module (lane lx 5.3 … 8.7): AC units, a drain pipe and
 * a small blade, so it isn't bare concrete. N5's keeps clear of the transformer box (lane lx 5.6 …
 * 6.3, up to 8.6 m with its conduits).
 */
function laneWall(d: Destruction, f: Frame, lot: Lot, more: () => number): void {
  const west = lot.corner === 'west';
  const ac: Array<[number, number]> = west ? [[7.2, 3], [7.2, 4], [5.8, 5]] : [[5.9, 1], [5.9, 3], [7.4, 4]];
  for (const [lx, k] of ac) if (k < lot.floors) acUnit(d, f, lx, levelY(k) + TS + 0.9);
  drainPipe(d, f, 8.5, 0.3, levelY(lot.floors) + TS);
  const face = neonColor(more);
  blade(d, f, west ? 7.0 : 7.6, 4.2, { segments: 2, width: 0.25, out: 0.6, face, edge: neonColor(more, face), cell: 0.5, col: Math.floor(more() * 2) });
}

/** An awning's colour: deep, a little faded. */
function neonAwning(rand: () => number): number {
  const c = [0xc83a3a, 0x2a6ab0, 0x2a9a6a, 0xd89a2a, 0x8a3ab0];
  return c[Math.floor(rand() * c.length)];
}

/** A caged balcony across the middle two bays at floor k: a slab on the band, a balustrade, grating up to the head. */
function cagedBalcony(d: Destruction, f: Frame, cols: Array<[number, number]>, k: number, tint: number, rand: () => number): void {
  const open = openings(cols);
  const [a, b] = open[Math.floor(open.length / 2)];
  const y = levelY(k) + TS;
  const depth = 1.0;
  const x0 = a + 0.1;
  const w = b - a - 0.2;
  const n = runs(w);
  for (let i = 0; i < n; i++) f.box(d, 'concrete', x0 + (i * w) / n, y - 0.16, -depth, w / n, 0.16, depth, { tint: 0xb8bcc4 });
  // Balustrade sheet and grating above, front and ends
  const top = levelY(k + 1) - 0.05;
  for (let i = 0; i < n; i++) {
    f.box(d, 'signbox', x0 + (i * w) / n, y, -depth, w / n, 0.9, 0.03, { tint });
    f.box(d, 'grate', x0 + (i * w) / n, y + 0.9, -depth, w / n, top - y - 0.9, 0.03);
  }
  for (const ex of [x0, x0 + w - 0.03]) {
    f.box(d, 'signbox', ex, y, -depth + 0.03, 0.03, 0.9, depth - 0.03, { tint });
    f.box(d, 'grate', ex, y + 0.9, -depth + 0.03, 0.03, top - y - 0.9, depth - 0.03);
  }
  // Washing on a pole across the cage
  if (rand() < 0.8) {
    const pole = f.box(d, 'steel', x0 + 0.03, y + 2.1, -depth * 0.55, w - 0.06, 0.03, 0.03);
    if (!pole) return;
    for (let x = x0 + 0.3; x < x0 + w - 0.6; x += 0.5 + rand() * 0.3) {
      const cloth = f.box(d, 'awning', x, y + 1.55, -depth * 0.55, 0.3 + rand() * 0.2, 0.55, 0.02, { tint: [0xe8e0d0, 0x4a6aa0, 0xc85050, 0xe0c060][Math.floor(rand() * 4)] });
      if (cloth) d.bond(cloth, pole, 0.005);
    }
  }
}

/** A type B shophouse on a lot. */
export function shophouse(d: Destruction, lot: Lot, seed: number): void {
  const rand = random(seed);
  const f = lotFrame(lot);
  f.texture = { position: f.at(rand() * 2, rand() * 2, 0), rotation: [0, 0, 0, 1] };
  const W = lot.x1 - lot.x0 - GAP;
  const D = lot.depth;
  const tint = lot.tint;
  const render = { tint, textureFrame: f.texture };
  const fa: Facade = { f, W, taken: new Taken(), spandrels: [], fascias: [], columns: [] };
  const pier0 = 0.5;
  for (let k = 0; k <= lot.floors; k++) {
    // Slabs stop short of the facade, which stands on its own (tied in through the side walls)
    slab(d, f, k, 0, W, T + 0.02, D, k === 0);
    if (k === 0) {
      const n = runs(W, STATIC);
      for (let i = 0; i < n; i++) f.box(d, 'concrete', (i * W) / n, 0, 0, W / n, TS, T + 0.02, { tint: 0xb8bcc4 });
      continue;
    }
    const n = runs(W);
    for (let i = 0; i < n; i++) f.box(d, 'render', (i * W) / n, levelY(k), 0, W / n, TS, T, render);
  }
  // The ground floor: end piers, a steel beam over the opening, a shutter or a lit shop under it
  const beamY = levelY(1) - 0.4;
  for (const x of [0, W - pier0]) for (let c = 0; c < 2; c++) f.box(d, 'render', x, TS + (c * (beamY - TS)) / 2, 0, pier0, (beamY - TS) / 2, T, render);
  const nb = runs(W);
  for (let i = 0; i < nb; i++) f.box(d, 'steel', (i * W) / nb, beamY, 0, W / nb, 0.4, T, { tint: 0x3a3e46 });
  if ((lot.shop ?? 'lit') === 'lit') litShop(d, f, pier0, W - pier0, beamY, D, rand, true, lot.id === 'S1' ? 'noodle' : undefined);
  else shutter(d, f, pier0, W - pier0, TS, beamY, rand);
  // Upper floors: piers, sills and lintels round two windows, each a steel frame with two panes
  const bays = 2;
  const B = W / bays;
  const ww = Math.min(1.4, B * 0.5);
  const sill = 0.9;
  const wh = 1.5;
  for (let k = 1; k < lot.floors; k++) {
    const yb = levelY(k) + TS;
    const fh = H - TS;
    const pier = B - ww;
    // Piers in two lifts a floor: more joints, so a falling facade tears up
    for (let i = 0; i <= bays; i++) {
      const w = i === 0 || i === bays ? pier / 2 : pier;
      const x = i === 0 ? 0 : i * B - pier / 2;
      for (const [y, h] of [
        [yb, sill + wh / 2],
        [yb + sill + wh / 2, fh - sill - wh / 2],
      ])
        f.box(d, 'render', x, y, 0, w, h, T, render);
    }
    fa.spandrels[k] = [];
    for (let i = 0; i < bays; i++) {
      const x = i * B + pier / 2;
      f.box(d, 'render', x, yb, 0, ww, sill, T, render);
      f.box(d, 'render', x, yb + sill + wh, 0, ww, fh - sill - wh, T, render);
      sash(d, f, x, yb + sill, ww, wh);
      if (k === 1) for (let g = 1; g <= 3; g++) f.box(d, 'steel', x + (g * ww) / 4 - 0.015, yb + sill, 0, 0.03, wh, 0.03, { tint: 0x2a2c30 });
      if (rand() < 0.3) glow.light(f.box(d, 'lamp', x + 0.05, yb, T + 0.6, ww - 0.1, 2.0, 0.02, { tint: WINDOW_TINTS[Math.floor(rand() * WINDOW_TINTS.length)] }));
    }
  }
  // Walls: render sides and back, in panels
  for (let k = 0; k < lot.floors; k++) {
    const yb = levelY(k) + TS;
    const fh = (k === 0 ? H0 : H) - TS;
    wall(d, f, 'render', 'x', 0, W, D - T, yb, yb + fh, tint);
    for (const lx of [0, W - T]) wall(d, f, 'render', 'z', T, D - T, lx, yb, yb + fh, tint);
  }
  blades(d, fa, lot, rand);
  // A sign across the floor-1 sill line, under the windows
  {
    const size = 0.56;
    const count = Math.min(4, Math.floor((W - 1.0) / (size * 1.2)));
    const [w, h] = flatSize(count, size);
    const lx = (W - w) / 2;
    const ly = levelY(1) + TS + 0.05;
    if (fa.taken.free(lx, ly, lx + w, ly + h)) {
      fa.taken.take(lx, ly, lx + w, ly + h);
      const color = neonColor(rand);
      flatSign(d, f, lx, ly, { count, size, color, second: neonColor(rand, color), picto: PICTOS[Math.floor(rand() * PICTOS.length)], seed: Math.floor(rand() * 1e6) });
    }
  }
  roof(d, f, W, D, lot.floors, 'render', tint, lot.roof, rand);
  // Hung from the beam's face
  if (lot.awning) awning(d, f, pier0 + 0.1, W - pier0 - 0.1, beamY + 0.15, neonAwning(rand));
}

/** A window in an opening: a steel frame, a sash bar, two panes. */
function sash(d: Destruction, f: Frame, x: number, y: number, w: number, h: number): void {
  const b = 0.06;
  const z = 0.1;
  const fd = 0.06;
  const c = { tint: 0x3a3e46 };
  f.box(d, 'steel', x, y, z, b, h, fd, c);
  f.box(d, 'steel', x + w - b, y, z, b, h, fd, c);
  f.box(d, 'steel', x + b, y, z, w - 2 * b, b, fd, c);
  f.box(d, 'steel', x + b, y + h - b, z, w - 2 * b, b, fd, c);
  f.box(d, 'steel', x + b, y + h / 2 - b / 2, z, w - 2 * b, b, fd, c);
  const ph = h / 2 - b * 1.5;
  f.box(d, 'glass', x + b, y + b, z + 0.015, w - 2 * b, ph, 0.03);
  f.box(d, 'glass', x + b, y + h / 2 + b / 2, z + 0.015, w - 2 * b, ph, 0.03);
}

/**
 * The end block across the alley's end: a type A of 8 floors facing -x, with an arcade through its
 * two lower floors (lx 6.6 … 11.4) under three transfer beams at level 2, a lamp strip along the
 * arcade's ceiling, and a big billboard on its face.
 */
export function endBlock(d: Destruction, seed: number): { arcade: Piece[]; billboard: Piece[] } {
  const rand = random(seed);
  const more = random(seed * 7 + 3);
  const f = endFrame();
  const W = END.z1 - END.z0;
  const D = END.x1 - END.x0;
  const mid = W / 2;
  const [a0, a1] = [mid - END.arcade, mid + END.arcade];
  const [b0, b1] = [a0 - 0.45, a1 + 0.45];
  const tile = { tint: END.tint, textureFrame: f.texture };
  const arcade: Piece[] = [];
  const cols: Array<[number, number]> = [
    [0, 0.45],
    [3.0, 3.45],
    [14.55, 15.0],
    [W - 0.45, W],
  ];
  const fa: Facade = { f, W, taken: new Taken(), spandrels: [], fascias: [], columns: cols };
  // The bays over the arcade (as frameFloor lays them), and the band's joints at the bay lines
  // nearest the alley's edges: the face over the alley comes away whole from what's behind N7 and
  // S8 (life.ts lets it go with the arcade's front)
  const bay = (cols[2][0] - cols[1][1]) / Math.max(1, Math.round((cols[2][0] - cols[1][1]) / 2.3));
  const seams = [0, cols[1][1] + bay, cols[2][0] - bay, W];
  for (let k = 0; k <= END.floors; k++) {
    // Level 1 is open over the arcade
    if (k === 1) {
      slab(d, f, k, 0, b0, T, D);
      slab(d, f, k, b1, W, T, D);
      for (const [p, q] of [
        [0, b0],
        [b1, W],
      ]) {
        const n = runs(q - p);
        for (let i = 0; i < n; i++) f.box(d, 'tile', p + (i * (q - p)) / n, levelY(k), 0, (q - p) / n, TS, T, tile);
      }
      continue;
    }
    slab(d, f, k, 0, W, T, D, k === 0);
    if (k === 0) {
      const n = runs(W, STATIC);
      for (let i = 0; i < n; i++) f.box(d, 'tile', (i * W) / n, 0, 0, W / n, TS, T, { ...tile });
      continue;
    }
    for (let s = 1; s < seams.length; s++) {
      const [p, q] = [seams[s - 1], seams[s]];
      const n = runs(q - p);
      for (let i = 0; i < n; i++) f.box(d, 'tile', p + (i * (q - p)) / n, levelY(k), 0, (q - p) / n, TS, T, tile);
    }
  }
  // The arcade: columns under each transfer beam, from the ground to the beam
  const beamY = levelY(2) - 0.6;
  for (const lz of [0, 3.94, D - 0.6]) {
    for (const [p, q] of [
      [b0, a0],
      [a1, b1],
    ]) {
      const cz = lz + 0.075;
      for (const [y0, y1] of [
        [TS, TS + (levelY(1) - TS) / 2],
        [TS + (levelY(1) - TS) / 2, levelY(1)],
        [levelY(1), levelY(1) + TS],
        [levelY(1) + TS, beamY],
      ]) {
        const p1 = f.box(d, 'tile', p, y0, cz, q - p, y1 - y0, 0.45, tile);
        if (p1) arcade.push(p1);
      }
    }
    const n = 3;
    for (let i = 0; i < n; i++) {
      const p1 = f.box(d, 'concrete', b0 + (i * (b1 - b0)) / n, beamY, lz, (b1 - b0) / n, 0.6, 0.6, { tint: 0xb8bcc4 });
      if (p1) arcade.push(p1);
    }
  }
  // The arcade's lamp strip, under the level 2 slab between the beams
  for (const [z0, z1] of [
    [0.7, 3.84],
    [4.64, D - 0.7],
  ])
    glow.light(f.box(d, 'lamp', mid - 0.3, levelY(2) - 0.06, z0, 0.6, 0.06, z1 - z0, { tint: 0xdff0ff }));

  for (let k = 0; k < END.floors; k++) {
    const yb = levelY(k) + TS;
    const fh = (k === 0 ? H0 : H) - TS;
    if (k <= 1) {
      // Outside the arcade: shops on the ground floor, windows on the first
      const side: Array<Array<[number, number]>> = [
        [
          [0, 0.45],
          [3.0, 3.45],
          [b0 - 0.45, b0],
        ],
        [
          [b1, b1 + 0.45],
          [14.55, 15.0],
          [W - 0.45, W],
        ],
      ];
      for (const sc of side) {
        if (k === 0) {
          for (const [a, b] of sc) for (let c = 0; c < 2; c++) f.box(d, 'tile', a, yb + (c * fh) / 2, 0, b - a, fh / 2, T, tile);
          for (const [a, b] of openings(sc)) {
            const n = runs(b - a);
            for (let i = 0; i < n; i++) f.box(d, 'tile', a + (i * (b - a)) / n, 2.85, 0, (b - a) / n, H0 - 2.85, T, tile);
            fa.fascias.push([a, b]);
            litShop(d, f, a, b, 2.85, D, rand, true);
          }
        } else fa.spandrels[k] = [...(fa.spandrels[k] ?? []), ...frameFloor(d, f, sc, yb, fh, END.tint, true)];
      }
      // The arcade's walls: tiled, its length through, between the columns
      for (const lx of [b0 - T, b1]) wall(d, f, 'tile', 'z', T, D - T, lx, yb, yb + fh, END.tint);
    } else {
      fa.spandrels[k] = frameFloor(d, f, cols, yb, fh, END.tint, true);
      windowsLit(d, f, fa.spandrels[k], yb, rand, more);
    }
    // The back wall (the arcade goes through it)
    if (k <= 1) {
      wall(d, f, 'concrete', 'x', 0, b0, D - T, yb, yb + fh);
      wall(d, f, 'concrete', 'x', b1, W, D - T, yb, yb + fh);
    } else wall(d, f, 'concrete', 'x', 0, W, D - T, yb, yb + fh);
    for (const lx of [0, W - T]) wall(d, f, 'concrete', 'z', T, D - T, lx, yb, yb + fh);
  }
  // The billboard on the face over the arcade: six panels on a backing, a neon frame
  fa.taken.take(mid - 3.3, 7.8, mid + 3.3, 11.3);
  const sign = endBillboard(d, f, mid);
  signs.push(sign);
  dress(d, fa, END.floors, rand, { ac: true, pipe: false });
  roof(d, f, W, D, END.floors, 'concrete', 0xb8bcc4, ['tank', 'condenser', 'mast'], rand, more);
  return { arcade, billboard: sign.pieces };
}

function endBillboard(d: Destruction, f: Frame, mid: number): Sign {
  const pieces: Piece[] = [];
  // Backing pieces 2 × 1.5 on the facade (its face at lz 0), with a rim for the frame tubes
  const [w, h] = [6, 3];
  const [x0, y0] = [mid - w / 2, 8];
  const m = 0.12;
  for (let i = 0; i < 3; i++)
    for (let j = 0; j < 2; j++) {
      const p = f.box(d, 'signbox', x0 - m + (i * (w + 2 * m)) / 3, y0 - m + (j * (h + 2 * m)) / 2, -0.12, (w + 2 * m) / 3, (h + 2 * m) / 2, 0.12, { tint: 0x22242a });
      if (p) pieces.push(p);
    }
  const n = f.out;
  const lo = f.at(x0, y0, -0.15);
  const hi = f.at(x0 + w, y0 + h, -0.12);
  const whole = { min: [Math.min(lo[0], hi[0]), y0, Math.min(lo[2], hi[2])] as [number, number, number], max: [Math.max(lo[0], hi[0]), y0 + h, Math.max(lo[2], hi[2])] as [number, number, number] };
  for (let i = 0; i < 3; i++)
    for (let j = 0; j < 2; j++) {
      const p = lightbox(d, f.at(x0 + (i + 0.5) * 2, y0 + (j + 0.5) * 1.5, -0.135), f.size(2, 1.5, 0.03), n, 0xff3a7a, 1.5, 0, 0, [0, 0], whole);
      if (p) pieces.push(p);
    }
  // A cyan neon frame on the backing's rim
  const plane: Plane = { o: f.at(x0, y0, -0.12), right: f.along, up: [0, 1, 0], n };
  const e = m / 2;
  for (let i = 0; i < 3; i++)
    for (const b of [-e, h + e]) {
      const p = tube(d, plane, i * 2, b, (i + 1) * 2, b, 0x22e6ff);
      if (p) pieces.push(p);
    }
  for (let j = 0; j < 2; j++)
    for (const a of [-e, w + e]) {
      const p = tube(d, plane, a, j * 1.5, a, (j + 1) * 1.5, 0x22e6ff);
      if (p) pieces.push(p);
    }
  return { pieces, centre: f.at(mid, y0 + h / 2, -0.15), color: 0xff3a7a };
}
