// The houses round the square: timber-framed storeys over a rubble ground floor or a rubble plinth,
// each upper storey jettied out over the one below on joists, under a steep tile roof with its
// gable or its eaves to the square.

import type { Piece } from '../../../lib/index.ts';
import type { Frame, Kit, P } from './kit.ts';
import { vary } from './kit.ts';
import { coursedWall, courses, type Opening } from './masonry.ts';
import { watchFront } from './falls.ts';
import { type Bay, floor, frameWall, roof, T } from './timber.ts';

/** Bays by letter: P panel, G leaded glass, W open window with shutters, w without, D door, B / b brace, O open. */
const BAYS: Record<string, Bay> = {
  P: { kind: 'panel' },
  G: { kind: 'glass' },
  W: { kind: 'window', shutters: true },
  w: { kind: 'window' },
  D: { kind: 'door' },
  B: { kind: 'brace' },
  b: { kind: 'brace', flip: true },
  O: { kind: 'open' },
};

/** Posts for `n` bays over `length`: corner posts at the ends (`ends`), the bays even. */
export function bayPosts(length: number, n: number, ends: boolean, corner = T, mid = 0.16): Array<[number, number]> {
  const a = ends ? corner : 0;
  const b = ends ? length - corner : length;
  // Bays of equal clear width: n bays between n - 1 posts
  const clear = (b - a - (n - 1) * mid) / n;
  const out: Array<[number, number]> = [];
  if (ends) out.push([0, corner]);
  for (let i = 1; i < n; i++) {
    const u0 = a + i * clear + (i - 1) * mid;
    out.push([u0, u0 + mid]);
  }
  if (ends) out.push([length - corner, length]);
  return out;
}

interface Storey {
  height: number;
  /** Front bays, by letter (see BAYS). */
  front: string;
  /** Sill and head rails above the storey's bottom. */
  rails?: number[];
}

interface HouseSpec {
  name: string;
  /** Front-left corner on the ground; u along the front, w into the house. */
  f: Frame;
  width: number;
  depth: number;
  storeys: Storey[];
  /** How far each upper storey stands out over the one below, on the front. */
  jetty: number;
  /** A rubble ground storey (instead of a timber one on a plinth), with these openings in front. */
  stone?: { openings: Opening[]; side?: Opening[]; back?: Opening[] };
  /** 'gable': the gable faces the front; 'eaves': the eaves do. */
  roof: 'gable' | 'eaves';
  pitch: number;
  oak: number;
  plaster: number;
  tile: number;
  /** Sides framed like fronts (the left side, at u = 0, and the right). */
  rich?: [boolean, boolean];
  /** Bays of the rich sides, per storey. */
  sides?: string[];
  /** How far the tiles reach past the gables (default 0.25 each). */
  verge?: [number, number];
  /** A chimney stack outside the back gable ('back'), or the gable at u = width ('right'). */
  chimney?: 'back' | 'right';
  /** Raised on something else (the market hall's posts): the first storey's bottom (v) and front (w), and no plinth. */
  raised?: { v: number; front: number };
}

export interface House {
  frame: Frame;
  /** The front's outer face per storey (w) and each storey's base (v). */
  faces: number[];
  bases: number[];
  /** Its chimney pot, if it has a chimney. */
  pot: P;
}

export const PLINTH = 0.45;
const STONE_COURSE = 0.58;

/** One house. */
export function house(kit: Kit, s: HouseSpec): House {
  kit.part(s.name);
  const { f, width: W, depth: D } = s;
  const out: House = { frame: f, faces: [], bases: [], pot: null };
  const oakTint = s.oak;
  let v = s.raised?.v ?? 0;
  // The ground storey's front, the jettied fronts over it and the floors' front rows (see falls.ts)
  let below: Piece[] = [];
  const fronts: Piece[] = [];
  const jetties: Piece[] = [];
  if (!s.stone && !s.raised) {
    plinth(kit, f, W, D);
    v = PLINTH;
  }
  s.storeys.forEach((st, k) => {
    const wf = (s.raised?.front ?? 0) - s.jetty * k;
    if (k > 0) {
      // The floor: joists from the jettied front to the back, on the top plates below
      for (const p of floor(kit, f, W, wf, D, v, oakTint)) if (p) jetties.push(p);
      v += T;
    }
    out.faces.push(wf);
    out.bases.push(v);
    const H = st.height;
    if (k === 0 && s.stone) {
      below = stoneStorey(kit, f, W, D, H, s.stone);
      v += H;
      return;
    }
    const rails = st.rails ?? (H > 2.75 ? [0.95, 2.15] : [0.85, 1.95]);
    const pattern = st.front;
    kit.gather();
    frameWall(kit, f.sub(0, v, wf), {
      length: W,
      height: H,
      posts: bayPosts(W, pattern.length, true),
      bays: (i) => BAYS[pattern[i]] ?? BAYS.P,
      rails,
      oak: oakTint,
      plaster: s.plaster,
    });
    if (k === 0) below = kit.collect();
    else fronts.push(...kit.collect());
    // The back: plain framing, one mid rail
    const nb = Math.max(2, Math.round(W / 2));
    frameWall(kit, f.sub(W, v, D, Math.PI), { length: W, height: H, posts: bayPosts(W, nb, true), bays: (i) => (k > 0 && i === 1 ? BAYS.w : BAYS.P), rails: k > 0 ? rails : [1.35], oak: oakTint, plaster: s.plaster });
    // The sides, between the front and back walls
    const L = D - T - (wf + T);
    for (const side of [0, 1]) {
      const sf = side === 0 ? f.sub(0, v, D - T, Math.PI / 2) : f.sub(W, v, wf + T, -Math.PI / 2);
      const rich = s.rich?.[side];
      const bays = rich ? (s.sides?.[k] ?? 'PBGGbP') : '';
      const n = rich ? bays.length : Math.max(2, Math.round(L / 2));
      frameWall(kit, sf, {
        length: L,
        height: H,
        posts: bayPosts(L, n, false),
        bays: (i) => (rich ? (BAYS[bays[side === 0 ? n - 1 - i : i]] ?? BAYS.P) : BAYS.P),
        rails: rich ? rails : [1.35],
        oak: oakTint,
        plaster: s.plaster,
      });
    }
    v += H;
  });
  // The roof over the top storey
  const wt = out.faces[out.faces.length - 1];
  const pitch = s.pitch;
  const span = s.roof === 'gable' ? W : D - wt;
  if (s.roof === 'gable') roof(kit, f.sub(W, v, wt, -Math.PI / 2), { length: D - wt, span, pitch, gables: [true, true], oak: oakTint, plaster: s.plaster, tile: s.tile, rich: [true, false], verge: s.verge });
  else roof(kit, f.sub(0, v, wt), { length: W, span, pitch, gables: [true, true], oak: oakTint, plaster: s.plaster, tile: s.tile, verge: s.verge });
  // A chimney stack a metre over the ridge
  const top = v + 0.05 + (span / 2) * Math.tan(pitch) + 1.4;
  if (s.chimney === 'back') out.pot = chimney(kit, f.sub(W / 2 + 0.45, 0, D + 0.72, Math.PI), top);
  if (s.chimney === 'right') out.pot = chimney(kit, f.sub(W + 0.72, 0, (D + wt) / 2 - 0.45, -Math.PI / 2), top);
  if (!s.raised && s.jetty > 0) watchFront(f, W, s.stone ? below : below.filter(isPost), fronts, jetties);
  kit.close();
  return out;
}

/** An upright timber of a frame wall: oak, at least twice as tall as it is wide (not a plate, rail or brace). */
function isPost(p: Piece): boolean {
  const { min, max } = p.bounds;
  return p.materialName === 'oak' && max[1] - min[1] > 2 * Math.max(max[0] - min[0], max[2] - min[2]);
}

/** A rubble plinth under a timber ground storey: front and back run through, the sides between. */
export function plinth(kit: Kit, f: Frame, W: number, D: number): void {
  const t = 0.3;
  const o = 0.04;
  const spec = { material: 'rubble', lines: [0, PLINTH], block: [1.4, 1.9] as [number, number], tint: 0xffffff, vary: 0.05 };
  coursedWall(kit, f.sub(-o, 0, -o), { ...spec, length: W + 2 * o, thickness: t });
  coursedWall(kit, f.sub(W + o, 0, D + o, Math.PI), { ...spec, length: W + 2 * o, thickness: t });
  coursedWall(kit, f.sub(-o, 0, D + o - t, Math.PI / 2), { ...spec, length: D + 2 * o - 2 * t, thickness: t });
  coursedWall(kit, f.sub(W + o, 0, t - o, -Math.PI / 2), { ...spec, length: D + 2 * o - 2 * t, thickness: t });
}

/** A rubble ground storey, 0.5 thick, corners interlocking, with its openings. Returns its front's pieces. */
function stoneStorey(kit: Kit, f: Frame, W: number, D: number, H: number, o: NonNullable<HouseSpec['stone']>): Piece[] {
  const t = 0.5;
  const n = Math.round(H / STONE_COURSE);
  const lines = courses(0, n, H / n);
  const spec = { material: 'rubble', lines, block: [1.2, 1.8] as [number, number], tint: 0xffffff, vary: 0.05 };
  const walls: Array<{ f: Frame; length: number; through: number; openings?: Opening[] }> = [
    { f, length: W, through: 0, openings: o.openings },
    { f: f.sub(W, 0, 0, -Math.PI / 2), length: D, through: 1, openings: o.side },
    { f: f.sub(W, 0, D, Math.PI), length: W, through: 0, openings: o.back },
    { f: f.sub(0, 0, D, Math.PI / 2), length: D, through: 1 },
  ];
  let front: Piece[] = [];
  for (const w of walls) {
    kit.gather();
    coursedWall(kit, w.f, { ...spec, length: w.length, thickness: t, openings: w.openings, ends: (k) => ((k + w.through) % 2 === 0 ? [0, w.length] : [t, w.length - t]) });
    const built = kit.collect();
    if (w === walls[0]) front = built;
  }
  return front;
}

/** A rubble chimney stack, 0.9 × 0.7, from the ground in `f` (u across its face, w out from the wall). Returns its pot. */
function chimney(kit: Kit, f: Frame, top: number): P {
  const h = 0.75;
  const n = Math.ceil(top / h);
  for (let k = 0; k < n; k++) kit.box(f, 'rubble', 0, k * h, 0, 0.9, h, 0.7, { tint: vary(0xffffff, 0.05, kit.rand) });
  // A cap and a pot
  kit.box(f, 'limestone', -0.06, n * h, -0.06, 1.02, 0.12, 0.82, { tint: 0xe8e0d0 });
  return kit.box(f, 'tile', 0.3, n * h + 0.12, 0.2, 0.3, 0.45, 0.3, { tint: 0xb06048 });
}
