// A gabled roof with its ridge along x, as the Greeks framed it: wall plates on the cornice, tie
// beams and king posts, rafters in pairs (cut with vertical joints so their segments bond face to
// face, the heads meeting at the ridge), terracotta tile panels on the rafters, half ridge caps,
// antefixes along the eaves, a marble sima course outside the plates, and at each end a pediment:
// the tympanum, the raking cornice the end tiles rest on, and an acroterion at the apex.

import { multiply, type Piece, type Pose, quatFromAxisAngle, type V3 } from '../../../lib/index.ts';
import { type Kit, prismX } from './kit.ts';

const PITCH = (15 * Math.PI) / 180;
const TAN = Math.tan(PITCH);
const COS = Math.cos(PITCH);
const SIN = Math.sin(PITCH);
/** A tile panel: two tiles wide (x), one course up the slope, its thickness. */
export const PANEL = { w: 1.1, l: 0.733, t: 0.08 };
const RAFTER = { w: 0.22, d: 0.25 };
const CORNICE = 0.35;

export interface RoofSpec {
  /** The tiles' extent along x (a whole number of panels) and the ridge line. */
  x0: number;
  x1: number;
  zc: number;
  /** Tile rows a slope. */
  rows: number;
  /** The wall plates: their top, and their inner and outer distance from the ridge line. */
  plateTop: number;
  plateIn: number;
  plateOut: number;
  /** Where the plates are cut along x. */
  plateCuts: number[];
  /** Rafter pairs (x of each). */
  rafters: number[];
  /** Tie beams with king posts (x of each), their length cut in `tieParts`. */
  ties: number[];
  tieParts: number;
  /** The cornice top under the sima course and the tympana (the geison), and the sima's x extent. */
  geisonTop: number;
  sima: [number, number];
  /** Pediments: the tympanum's x range (set back from the cornice front), the raking cornice's, which end (+1 east). */
  pediments: Array<{ tympanum: [number, number]; cornice: [number, number]; end: 1 | -1 }>;
  /** Where the tympanum courses are split (heights). */
  courses: number[];
  /** The acroteria's height (m). */
  acroterion: number;
  /**
   * Its frame falls with what holds it: a rafter whose foot went drops whole, and a tie beam's
   * middle once an end has (a small roof over a porch; a temple's rafters hang from the ridge over a
   * lost column, holding its tiles up).
   */
  falls?: boolean;
}

export function gableRoof(k: Kit, s: RoofSpec): void {
  const P = s.plateTop;
  const W1 = s.plateOut;
  // The rafter-top plane: rafters' bottoms meet the plates' outer top edge
  const T0 = P + RAFTER.d / COS + W1 * TAN;
  const top = (a: number) => T0 - a * TAN;
  const bottom = (a: number) => top(a) - RAFTER.d / COS;
  const reach = s.rows * PANEL.l * COS;
  const sides = [1, -1] as const;
  const zOf = (side: 1 | -1, a: number) => s.zc + side * a;

  // Wall plates on the cornice
  for (const side of sides) {
    const za = zOf(side, s.plateIn);
    const zb = zOf(side, W1);
    for (const [xa, xb] of spans(s.x0, s.x1, s.plateCuts, s.sima)) k.levers.add(k.box('timber', [xa, P - 0.3, Math.min(za, zb)], [xb, P, Math.max(za, zb)]));
  }
  // Tie beams across, resting on the walls under them, and a king post on each under the ridge
  for (const x of s.ties) {
    const n = s.tieParts;
    const parts: Array<Piece | null> = [];
    for (let i = 0; i < n; i++) {
      const za = s.zc - s.plateIn + (2 * s.plateIn * i) / n;
      const zb = s.zc - s.plateIn + (2 * s.plateIn * (i + 1)) / n;
      parts.push(k.box('timber', [x - 0.15, P - 0.3, za], [x + 0.15, P, zb]));
    }
    // Its ends rest on the cornice: when that goes, they drop instead of sticking out over the walk
    k.levers.addAll([parts[0], parts[n - 1]]);
    if (s.falls) for (const part of parts.slice(1, -1)) k.levers.hang(part);
    const h = 0.15;
    k.hull('timber', prismX([[s.zc - h, P], [s.zc + h, P], [s.zc + h, bottom(h)], [s.zc, bottom(0)], [s.zc - h, bottom(h)]], x - 0.15, x + 0.15));
  }
  // Rafters: a foot on the plate (cut level), then segments with vertical joints up to the ridge
  const cuts = [W1, s.plateIn, s.plateIn * 0.5, 0];
  for (const x of s.rafters) {
    const hung: Array<Piece | null> = [];
    for (const side of sides) {
      for (let i = 0; i + 1 < cuts.length; i++) {
        const [a1, a0] = [cuts[i], cuts[i + 1]];
        const low = i === 0 ? P : bottom(a1);
        const outline: Array<[number, number]> = [
          [zOf(side, a1), low],
          [zOf(side, a0), i === 0 ? P : bottom(a0)],
          [zOf(side, a0), top(a0)],
          [zOf(side, a1), top(a1)],
        ];
        const p = k.hull('timber', prismX(outline, x - RAFTER.w / 2, x + RAFTER.w / 2));
        if (s.falls && i === 0) k.levers.add(p);
        else if (s.falls) hung.push(p);
      }
    }
    // Once the pair is made, so each segment knows its neighbours
    for (const p of hung) k.levers.hang(p);
  }
  // The sima course outside the plates: its sloping top carries the eave tiles
  for (const side of sides) {
    for (const [xa, xb] of spans(s.sima[0], s.sima[1], s.plateCuts, s.sima)) {
      const outline: Array<[number, number]> = [
        [zOf(side, W1), s.geisonTop],
        [zOf(side, reach), s.geisonTop],
        [zOf(side, reach), top(reach)],
        [zOf(side, W1), top(W1)],
      ];
      k.levers.add(k.hull('marble', prismX(outline, xa, xb)));
    }
  }

  // Tile panels: every panel of a slope shares one texture frame, so the tiles run on across them
  const cols = Math.round((s.x1 - s.x0) / PANEL.w);
  for (const side of sides) {
    const tilt = quatFromAxisAngle([1, 0, 0], side * PITCH);
    const n: V3 = [0, COS, side * SIN];
    const texture: Pose = {
      position: [s.x0, top(reach), zOf(side, reach)],
      rotation: side === 1 ? quatFromAxisAngle([1, 0, 0], PITCH) : multiply(quatFromAxisAngle([0, 1, 0], Math.PI), quatFromAxisAngle([1, 0, 0], PITCH)),
    };
    const onPlane = (u: number, lift: number, x: number): V3 => {
      const a = u * COS;
      return [x, top(a) + n[1] * lift, zOf(side, a) + n[2] * lift];
    };
    const eave: Array<Piece | null> = [];
    for (let row = 0; row < s.rows; row++) {
      for (let c = 0; c < cols; c++) {
        const x = s.x0 + (c + 0.5) * PANEL.w;
        const p = k.tbox('terracotta', onPlane((row + 0.5) * PANEL.l, PANEL.t / 2, x), [PANEL.w, PANEL.t, PANEL.l], tilt, { tint: tileTint(k), texture });
        k.levers.add(p);
        if (row === s.rows - 1) eave.push(p);
      }
    }
    // Antefixes along the eave, at the joints between panels: upright, as they stood, a palmette
    // outline (wider at the top) standing out from the eave tiles' ends, which they're tied to by
    // hand (they touch them only along an edge)
    const outline: Array<[number, number]> = [[-0.07, 0], [0.07, 0], [0.11, 0.15], [0.07, 0.235], [0, 0.26], [-0.07, 0.235], [-0.11, 0.15]];
    const points = outline.flatMap(([px, py]) => [-0.025, 0.025].map((pz) => [px, py, pz] as V3));
    for (let c = 1; c < cols; c++) {
      const x = s.x0 + c * PANEL.w;
      const tile = eave[c];
      const p = k.d.addConvex({ material: 'terracotta', points, position: [x, top(reach) + 0.002, zOf(side, reach + 0.027)], tint: tileTint(k), bond: false });
      if (p && tile) k.d.bond(p, tile, 0.006);
    }
    // Half ridge caps on the top row, meeting their pair at the ridge line (short of the
    // acroteria at the ends)
    const capTop = (a: number) => top(a) + PANEL.t / COS;
    for (let c = 0; c < cols; c++) {
      const xa = s.x0 + c * PANEL.w + (c === 0 ? 0.3 : 0);
      const xb = s.x0 + (c + 1) * PANEL.w - (c === cols - 1 ? 0.3 : 0);
      const reachCap = 0.3;
      const outline: Array<[number, number]> = [
        [s.zc, capTop(0)],
        [zOf(side, reachCap), capTop(reachCap)],
        [zOf(side, reachCap), capTop(reachCap) + 0.1],
        [s.zc, capTop(0) + 0.16],
      ];
      k.hull('terracotta', prismX(outline, xa, xb), { tint: tileTint(k) });
    }
  }

  // Pediments
  for (const ped of s.pediments) {
    const [tx0, tx1] = ped.tympanum;
    const tympanumTop = (a: number) => top(a) - CORNICE / COS;
    gable(k, tx0, tx1, s.zc, s.geisonTop, tympanumTop, W1, s.courses);
    // Raking cornice: blocks along each slope, their tops in the rafter-top plane
    const [cx0, cx1] = ped.cornice;
    const blocks = Math.round((s.rows * PANEL.l) / 1.1);
    const len = (s.rows * PANEL.l) / blocks;
    for (const side of sides) {
      // Cut with vertical joints, as the rafters are: the two top blocks meet in a vertical face
      // at the ridge instead of crossing under it
      for (let i = 0; i < blocks; i++) {
        const [a0, a1] = [i * len * COS, (i + 1) * len * COS];
        const outline: Array<[number, number]> = [
          [zOf(side, a0), top(a0)],
          [zOf(side, a1), top(a1)],
          [zOf(side, a1), top(a1) - CORNICE / COS],
          [zOf(side, a0), top(a0) - CORNICE / COS],
        ];
        k.levers.add(k.hull('marble', prismX(outline, cx0, cx1)));
      }
    }
    // The acroterion at the apex, standing on the end tiles
    const end = ped.end === 1 ? s.x1 : s.x0;
    acroterion(k, ped.end === 1 ? end - 0.14 : end + 0.14, s.zc, top(0) + PANEL.t / COS, s.acroterion);
  }
}

/**
 * A palmette acroterion of height h on the ridge at (x, zc), its foot at y: a base in two halves
 * (their undersides on the two slopes), and a fan of thin petals over it, each its own convex
 * piece clear of the others (tied to the base by hand).
 */
function acroterion(k: Kit, x: number, zc: number, y: number, h: number): void {
  const t = 0.07;
  const bw = 0.2 * h;
  const bh = 0.12 * h;
  const halves: Piece[] = [];
  for (const side of [1, -1]) {
    const outline: Array<[number, number]> = [
      [zc, y],
      [zc + side * bw, y - bw * TAN],
      [zc + side * bw, y + bh],
      [zc, y + bh],
    ];
    const p = k.hull('marble', prismX(outline, x - t, x + t));
    if (p) halves.push(p);
  }
  if (!halves.length) return;
  // The fan: from a point just under the base's top, petals at even angles, the middle one longest
  const n = h > 0.8 ? 7 : 5;
  const spread = (n === 7 ? 66 : 60) * (Math.PI / 180);
  const r0 = 0.13 * h;
  const fy = y + bh + 0.02 - r0 * Math.cos(spread);
  for (let i = 0; i < n; i++) {
    const a = -spread + (2 * spread * i) / (n - 1);
    const len = (h - bh - 0.02) * (0.62 + 0.38 * Math.cos(a * 1.1)) - r0 * 0.3;
    const d: [number, number] = [Math.sin(a), Math.cos(a)];
    const e: [number, number] = [d[1], -d[0]];
    // Narrow at the root, widest two thirds of the way out, a rounded tip
    const shape: Array<[number, number]> = [
      [r0, 0.012],
      [r0 + len * 0.62, 0.05 * h + 0.012],
      [r0 + len * 0.86, 0.042 * h + 0.008],
      [r0 + len, 0],
      [r0 + len * 0.86, -(0.042 * h + 0.008)],
      [r0 + len * 0.62, -(0.05 * h + 0.012)],
      [r0, -0.012],
    ];
    const pts = shape.map(([along, across]) => [zc + d[0] * along + e[0] * across, fy + d[1] * along + e[1] * across] as [number, number]);
    const p = k.hull('marble', prismX(pts, x - t * 0.6, x + t * 0.6), { bond: false });
    if (p) k.d.bond(p, halves[a < 0 && halves.length > 1 ? 1 : 0], 0.01);
  }
}

/** A tympanum: courses of blocks up to a sloping top (a gable), split about every 2 m. */
function gable(k: Kit, x0: number, x1: number, zc: number, base: number, top: (a: number) => number, half: number, courses: number[]): void {
  const levels = [base, ...courses.filter((c) => c > base && c < top(0)), Infinity];
  for (let i = 0; i + 1 < levels.length; i++) {
    const [ya, yb] = [levels[i], levels[i + 1]];
    // The course's reach from the ridge line: where the top falls to its bottom
    const reach = Math.min(half, (top(0) - ya) / TAN);
    if (reach <= 0.05) continue;
    const n = Math.max(1, Math.round((2 * reach) / 2));
    const m = n % 2 ? n + 1 : n; // split at the apex
    for (let j = 0; j < m; j++) {
      const za = zc - reach + (2 * reach * j) / m;
      const zb = zc - reach + (2 * reach * (j + 1)) / m;
      const yTop = (z: number) => Math.min(yb, top(Math.abs(z - zc)));
      const outline: Array<[number, number]> = [[za, ya], [zb, ya], [zb, yTop(zb)]];
      // Where the sloping top crosses the course's top, a corner
      const cross = (top(0) - yb) / TAN;
      for (const zc2 of [zc - cross, zc + cross]) if (Number.isFinite(cross) && cross > 0 && zc2 > za + 1e-4 && zc2 < zb - 1e-4) outline.push([zc2, yb]);
      if (zc > za + 1e-4 && zc < zb - 1e-4) outline.push([zc, yTop(zc)]);
      outline.push([za, yTop(za)]);
      k.levers.add(k.hull('marble', prismX(outline, x0, x1)));
    }
  }
}

/** Cut [x0, x1] at the cuts inside it (and within `within`). */
export function spans(x0: number, x1: number, cuts: number[], within: [number, number] = [x0, x1]): Array<[number, number]> {
  const lo = Math.max(x0, within[0]);
  const hi = Math.min(x1, within[1]);
  const xs = [lo, ...cuts.filter((c) => c > lo + 0.05 && c < hi - 0.05).sort((a, b) => a - b), hi];
  return xs.slice(0, -1).map((x, i) => [x, xs[i + 1]]);
}

/** Terracotta varies tile to tile: about ±8% in value and a little in hue. */
function tileTint(k: Kit): number {
  const v = 0.9 + k.rand() * 0.16;
  const h = (k.rand() - 0.5) * 0.08;
  const c = (x: number) => Math.max(0, Math.min(255, Math.round(x * 255)));
  return (c(v * (1 + h)) << 16) | (c(v) << 8) | c(v * (1 - h * 1.5));
}

