// The smaller buildings with walls and columns in antis: the treasury (a porch of two columns
// before a walled room with a bronze door) and the propylon (the gate: a porch at each end and a
// cross wall with the passage through it). Both are a rectangle of walls and column axes carrying
// a Doric entablature round it and a gabled roof with a pediment at each end.

import type { Piece } from '../../../lib/index.ts';
import { band, courses, frieze, platform, type Rect, wall } from './doric.ts';
import { column, type Kit, leafPanels } from './kit.ts';
import { PLACES } from './layout.ts';
import { gableRoof, PANEL, spans } from './roof.ts';

interface InAntis {
  /** Axis lines: the side walls' centres (z0, z1) and the end column lines (x0, x1). */
  r: Rect;
  /** The floor the walls and columns stand on. */
  floor: number;
  /** Wall: thickness, course heights, block length. */
  t: number;
  courses: number[];
  block: number;
  /** A wall closing the x0 end (else columns there too). */
  backWall: boolean;
  /** Cross walls (x centre) with a doorway (z range, height), maybe bronze leaves in it. */
  crossWalls: Array<{ x: number; door: [number, number]; doorTop: number; leaves: boolean }>;
  /** Column positions along the ends (z), and their size. */
  columnsZ: number[];
  /** The triglyphs' spacing along the ends (one over each column and between). */
  pitchShort: number;
  column: { r0: number; r1: number; drums: number; echinus: number; capital: number; abacus: number };
  /** Entablature heights: architrave, frieze, geison; triglyph width; the geison's overhang. */
  architrave: number;
  frieze: number;
  geison: number;
  triglyph: number;
  overhang: number;
  /** Tile rows a slope, panel columns along the ridge. */
  rows: number;
  cols: number;
}

function inAntis(k: Kit, s: InAntis): void {
  const { r, t } = s;
  const h = t / 2;
  const wallCourses = courses(s.floor, s.courses);
  const top = wallCourses[wallCourses.length - 1][1];
  // Side walls, running on past the end walls as antae
  for (const zc of [r.z0, r.z1]) wall(k, { material: 'limestone', axis: 'x', from: r.x0 - h, to: r.x1 + h, t0: zc - h, t1: zc + h, courses: wallCourses, block: s.block });
  if (s.backWall) wall(k, { material: 'limestone', axis: 'z', from: r.z0 + h, to: r.z1 - h, t0: r.x0 - h, t1: r.x0 + h, courses: wallCourses, block: s.block });
  for (const c of s.crossWalls) {
    const [za, zb] = c.door;
    const frame = 0.2;
    const lintelTop = wallCourses.find(([, y1]) => y1 >= c.doorTop + 0.4)?.[1] ?? top;
    wall(k, { material: 'limestone', axis: 'z', from: r.z0 + h, to: r.z1 - h, t0: c.x - h, t1: c.x + h, courses: wallCourses, block: s.block, holes: [{ a: za - frame, b: zb + frame, y0: s.floor, y1: lintelTop }] });
    // A marble frame: jambs in two lengths and a lintel
    const mid = s.floor + (c.doorTop - s.floor) / 2;
    for (const [a, b] of [
      [za - frame, za],
      [zb, zb + frame],
    ]) {
      k.box('marble', [c.x - h, s.floor, a], [c.x + h, mid, b]);
      k.box('marble', [c.x - h, mid, a], [c.x + h, c.doorTop, b]);
    }
    k.levers.add(k.box('marble', [c.x - h, c.doorTop, za - frame], [c.x + h, lintelTop, zb + frame]));
    if (!c.leaves) continue;
    // Two bronze leaves, shut, each in two lengths
    const zm = (za + zb) / 2;
    for (const [a, b] of [
      [za, zm],
      [zm, zb],
    ])
      for (const [y0, y1] of [
        [s.floor, mid],
        [mid, c.doorTop],
      ]) {
        if (k.box('bronze', [c.x - 0.06, y0, a], [c.x + 0.06, y1, b])) leafPanels(k, 'bronze', [c.x + 0.06, (y0 + y1) / 2, (a + b) / 2], b - a, y1 - y0, Math.PI / 2);
      }
  }
  // Columns in antis at the open ends
  const ends = s.backWall ? [r.x1] : [r.x0, r.x1];
  const c = s.column;
  const drumH = (top - s.floor - c.echinus - c.capital) / c.drums;
  const abaci: Piece[] = [];
  for (const x of ends)
    for (const z of s.columnsZ) {
      const col = column(k, { material: 'marble', at: [x, s.floor, z], drums: Array(c.drums).fill(drumH), r0: c.r0, r1: c.r1, sides: 20, echinus: { h: c.echinus, r: c.abacus / 2 - 0.04 }, abacus: { w: c.abacus, h: c.capital } });
      abaci.push(col.pieces[col.pieces.length - 1]);
    }

  // Entablature round the rectangle: one beam deep (the walls' thickness), joined over the columns
  const y1 = top + s.architrave;
  const y2 = y1 + s.frieze;
  const y3 = y2 + s.geison;
  const along = (a: number, b: number, n: number) => Array.from({ length: n - 1 }, (_, i) => a + ((i + 1) * (b - a)) / n);
  const longCuts = [r.x0, r.x1, ...along(r.x0, r.x1, Math.round((r.x1 - r.x0) / 2))];
  k.levers.addAll(band(k, r, 'marble', -h, h, top, y1, { long: longCuts, short: s.columnsZ }));
  const pitch = (r.x1 - r.x0) / Math.round((r.x1 - r.x0) / 1.0);
  k.levers.addAll(frieze(k, r, { v0: 0, v1: h, recess: 0.04, y0: y1, y1: y2, tw: s.triglyph, pitch, pitchShort: s.pitchShort, material: 'marble', glyph: 'triglyph', triglyph: 0xc9d0d4 }));
  // Frieze backers; over the porches they're thinner, leaving a ledge on the architrave for the
  // ceiling's beams
  const ledge = 0.15;
  const porch = (side: 'w' | 'e') => ends.includes(side === 'w' ? r.x0 : r.x1);
  k.levers.addAll(band(k, r, 'marble', -h, 0, y1, y2, { long: longCuts.slice(2), short: s.columnsZ }, { sides: ['n', 's', ...(['w', 'e'] as const).filter((side) => !porch(side))] }));
  for (const side of ['w', 'e'] as const) {
    if (!porch(side)) continue;
    const [xa, xb] = side === 'w' ? [r.x0, r.x0 + h - ledge] : [r.x1 - h + ledge, r.x1];
    for (const [za, zb] of spans(r.z0 + h, r.z1 - h, s.columnsZ)) k.levers.add(k.box('marble', [xa, y1, za], [xb, y2, zb]));
  }
  // The porches' ceilings: the cross wall raised to the architrave's top, beams from a ledge on
  // it to the architrave's, slabs (lids) across them
  for (const c of s.crossWalls) wall(k, { material: 'limestone', axis: 'z', from: r.z0 + h, to: r.z1 - h, t0: c.x - h, t1: c.x + h, courses: [[top, y1]], block: s.block });
  for (const x of ends) {
    const cross = s.crossWalls.reduce((best, c) => (Math.abs(c.x - x) < Math.abs(best.x - x) ? c : best));
    const [xa, xb] = x > cross.x ? [cross.x + h - ledge, x - h + ledge] : [x + h - ledge, cross.x - h + ledge];
    const beam = { y1: y1 + 0.28, lid: 0.12, w: 0.24 };
    const count = Math.max(2, Math.round((r.z1 - r.z0 - t) / 1.1) + 1);
    const bz = Array.from({ length: count }, (_, i) => r.z0 + h + beam.w / 2 + ((r.z1 - r.z0 - t - beam.w) * i) / (count - 1));
    for (const z of bz) k.levers.add(k.box('marble', [xa, y1, z - beam.w / 2], [xb, beam.y1, z + beam.w / 2]));
    for (let i = 0; i + 1 < bz.length; i++) k.levers.add(k.box('marble', [xa, beam.y1, bz[i]], [xb, beam.y1 + beam.lid, bz[i + 1]]));
  }
  const geisonCuts = { long: along(r.x0 - h, r.x1 + h, Math.round((r.x1 - r.x0 + t) / 1.1)), short: along(r.z0, r.z1, Math.round((r.z1 - r.z0) / 1.1)) };
  k.levers.addAll(band(k, r, 'marble', -h, h + s.overhang, y2, y3, geisonCuts));

  // The roof: plates on the geison's inner half, tiles out to the geison's edge
  const zc = (r.z0 + r.z1) / 2;
  const xc = (r.x0 + r.x1) / 2;
  const halfZ = (r.z1 - r.z0) / 2;
  const plateOut = halfZ + 0.25;
  const front = (r.x1 - r.x0) / 2 + h + s.overhang;
  const tx0 = xc - (s.cols * PANEL.w) / 2;
  const tx1 = xc + (s.cols * PANEL.w) / 2;
  const tympanum = [front - 0.25 - 0.4, front - 0.25];
  const rafters: number[] = [];
  for (let x = tx0 + PANEL.w; x < tx1 - 1e-6; x += PANEL.w) if (Math.abs(x - xc) < tympanum[0] - 0.12) rafters.push(x);
  gableRoof(k, {
    x0: tx0,
    x1: tx1,
    zc,
    rows: s.rows,
    plateTop: y3 + 0.3,
    plateIn: plateOut - 0.4,
    plateOut,
    plateCuts: rafters.filter((_, i) => i % 2 === 1),
    rafters,
    ties: rafters.filter((_, i) => i % 2 === 0),
    tieParts: 3,
    geisonTop: y3,
    sima: [xc - tympanum[0], xc + tympanum[0]],
    pediments: [
      { tympanum: [xc + tympanum[0], xc + tympanum[1]], cornice: [xc + tympanum[0], tx1 + 0.05], end: 1 },
      { tympanum: [xc - tympanum[1], xc - tympanum[0]], cornice: [tx0 - 0.05, xc - tympanum[0]], end: -1 },
    ],
    courses: [y3 + 1.0],
    acroterion: 0.65,
    falls: true,
  });
}

/** The treasury: north of the temple, facing east, a stepped platform, two columns in antis before its door. */
export function buildTreasury(k: Kit): void {
  const { x: ox, z: oz } = PLACES.treasury;
  platform(k, 'marble', ox - 5.9, ox + 5.9, oz - 3.9, oz + 3.9, 0, 0.3, { width: 0.8 });
  platform(k, 'marble', ox - 5.5, ox + 5.5, oz - 3.5, oz + 3.5, 0.3, 0.6);
  inAntis(k, {
    r: { x0: ox - 4.9, x1: ox + 4.9, z0: oz - 2.9, z1: oz + 2.9 },
    floor: 0.6,
    t: 0.6,
    courses: Array(9).fill(0.5),
    block: 0.75,
    backWall: true,
    crossWalls: [{ x: ox + 3.1, door: [oz - 0.7, oz + 0.7], doorTop: 3.6, leaves: true }],
    columnsZ: [oz - 0.967, oz + 0.967],
    pitchShort: 0.967,
    column: { r0: 0.4, r1: 0.32, drums: 6, echinus: 0.26, capital: 0.18, abacus: 0.95 },
    architrave: 0.65,
    frieze: 0.55,
    geison: 0.28,
    triglyph: 0.36,
    overhang: 0.3,
    rows: 5,
    cols: 10,
  });
}

/** The propylon: the gate on the east side, a porch at each end and the passage through a cross wall. */
export function buildPropylon(k: Kit): void {
  const { x: ox, z: oz } = PLACES.propylon;
  inAntis(k, {
    r: { x0: ox - 2.1, x1: ox + 2.1, z0: oz - 2.9, z1: oz + 2.9 },
    floor: 0,
    t: 0.6,
    courses: Array(9).fill(0.489),
    block: 0.8,
    backWall: false,
    crossWalls: [{ x: ox, door: [oz - 1.2, oz + 1.2], doorTop: 3.0, leaves: false }],
    columnsZ: [oz - 1.45, oz + 1.45],
    pitchShort: 0.725,
    column: { r0: 0.4, r1: 0.32, drums: 6, echinus: 0.26, capital: 0.18, abacus: 0.95 },
    architrave: 0.5,
    frieze: 0.45,
    geison: 0.25,
    triglyph: 0.32,
    overhang: 0.3,
    rows: 5,
    cols: 5,
  });
}
