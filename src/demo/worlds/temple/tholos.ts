// The tholos: a round Doric building south-west of the temple. Three round steps, twelve columns
// round a cella wall of curved blocks (its door to the east), a ring entablature (architrave,
// triglyph frieze, cornice), a coffered ceiling ring, a terracotta roof ring, a drum and a dome
// of shell pieces with a finial. The dome's rings bond to each other and to the drum by themselves;
// the finial, standing on the cap's point, is bonded by hand.

import type { Piece, V3 } from '../../../lib/index.ts';
import { column, type Kit, ring } from './kit.ts';
import { PLACES } from './layout.ts';

const DEG = Math.PI / 180;

export function buildTholos(k: Kit): void {
  const { x: cx, z: cz } = PLACES.tholos;
  // A block of a round course: radii r0..r1, angles a0..a1 (radians from +x toward +z), heights
  // y0..y1. Its outer face follows the circle in steps of 11.25° at most, so courses turned half a
  // block against each other still meet the same facets
  // Its inner face is one flat chord, set out so it only touches the circle r0 (never cuts inside it)
  const arc = (r0: number, r1: number, a0: number, a1: number, y0: number, y1: number): V3[] => {
    const pts: V3[] = [];
    const steps = Math.max(1, Math.round((a1 - a0) / (11.25 * DEG)));
    const inner = r0 / Math.cos((a1 - a0) / 2);
    for (let i = 0; i <= steps; i++) {
      const a = a0 + ((a1 - a0) * i) / steps;
      const rs = i === 0 || i === steps ? [inner, r1] : [r1];
      for (const r of rs) for (const y of [y0, y1]) pts.push([cx + Math.cos(a) * r, y, cz + Math.sin(a) * r]);
    }
    return pts;
  };
  const ringOf = (n: number, off: number, r0: number, r1: number, y0: number, y1: number, material: string, o: { anchor?: boolean; tint?: number; skip?: (a0: number, a1: number) => boolean } = {}) => {
    const out: Piece[] = [];
    for (let i = 0; i < n; i++) {
      const a0 = off + (i / n) * Math.PI * 2;
      const a1 = off + ((i + 1) / n) * Math.PI * 2;
      if (o.skip?.(a0, a1)) continue;
      const p = k.hull(material, arc(r0, r1, a0, a1, y0, y1), { anchor: o.anchor, tint: o.tint });
      if (p) out.push(p);
    }
    return out;
  };

  // Steps: two rings and the top platform (anchors: over the hollow the rings leave, they hold up what's on them, and break)
  ringOf(32, 0, 5.6, 6.6, 0, 0.3, 'marble', { anchor: true });
  ringOf(32, 0, 5.2, 6.2, 0.3, 0.6, 'marble', { anchor: true });
  ringOf(20, 0, 2.0, 5.8, 0.6, 0.9, 'marble', { anchor: true });
  k.hull('marble', [...ring(cx, 0.6, cz, 2.0, 20), ...ring(cx, 0.9, cz, 2.0, 20)], { anchor: true });
  const floor = 0.9;

  // Columns: twelve on r 4.9, each abacus turned to face out
  const capitalTop = 4.72;
  const drums = 5;
  const drumH = (capitalTop - floor - 0.24 - 0.18) / drums;
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    column(k, { material: 'marble', at: [cx + Math.cos(a) * 4.9, floor, cz + Math.sin(a) * 4.9], drums: Array(drums).fill(drumH), r0: 0.4, r1: 0.33, sides: 20, echinus: { h: 0.24, r: 0.46 }, abacus: { w: 0.9, h: 0.18, yaw: -a } });
  }
  // Ring entablature: architrave joined over the columns, frieze of triglyphs (5°) and metopes (10°), cornice
  const yA = capitalTop + 0.55;
  const yF = yA + 0.5;
  const yC = yF + 0.3;
  k.levers.addAll(ringOf(12, 0, 4.45, 5.35, capitalTop, yA, 'marble'));
  for (let i = 0; i < 12; i++) {
    const base = (i * 30 - 2.5) * DEG;
    const parts: Array<[number, number, boolean]> = [
      [0, 5, true],
      [5, 15, false],
      [15, 20, true],
      [20, 30, false],
    ];
    for (const [d0, d1, tri] of parts) k.hull('marble', arc(4.75, tri ? 5.35 : 5.3, base + d0 * DEG, base + d1 * DEG, yA, yF), tri ? { tint: 0xb9c3c9 } : {});
  }
  k.levers.addAll(ringOf(12, 15 * DEG, 4.6, 5.8, yF, yC, 'marble'));

  // The cella wall: 16 blocks a course, alternate courses half a block round; the door to the east
  const wallTop = yA;
  const n = 7;
  const ch = (wallTop - floor) / n;
  const half = 11.25 * DEG;
  for (let c = 0; c < n; c++) {
    const y0 = floor + c * ch;
    const y1 = y0 + ch;
    const off = c % 2 ? 0 : -half;
    if (c === 5) {
      // The lintel over the door: one long block, the rest of the course as usual
      k.levers.add(k.hull('limestone', arc(2.9, 3.5, -2 * half, 2 * half, y0, y1)));
      ringOf(16, off, 2.9, 3.5, y0, y1, 'limestone', { skip: (a0, a1) => wrap(a0) > -2 * half - 1e-6 && wrap(a1) < 2 * half + 1e-6 });
      continue;
    }
    // The doorway in the lower courses: a block's width
    const door = (a0: number, a1: number) => c < 5 && wrap((a0 + a1) / 2) > -half && wrap((a0 + a1) / 2) < half;
    if (c % 2) {
      // Courses turned half a block: the blocks either side of the door are halves
      ringOf(16, off, 2.9, 3.5, y0, y1, 'limestone', { skip: (a0, a1) => (c < 5 && Math.abs(wrap((a0 + a1) / 2)) < 2 * half) || door(a0, a1) });
      if (c < 5) for (const s of [-1, 1]) k.hull('limestone', arc(2.9, 3.5, s > 0 ? half : -2 * half, s > 0 ? 2 * half : -half, y0, y1));
    } else ringOf(16, off, 2.9, 3.5, y0, y1, 'limestone', { skip: door });
  }
  // Ceiling ring on the wall's outer strip and the architrave's inner; the roof ring on it
  const yCeil = wallTop + 0.25;
  k.levers.addAll(ringOf(12, 15 * DEG, 3.2, 4.7, wallTop, yCeil, 'marble'));
  const roofIn = 6.27;
  const roofOut = yF - 0.02;
  for (let i = 0; i < 24; i++) {
    const a0 = (i / 24) * Math.PI * 2;
    const a1 = ((i + 1) / 24) * Math.PI * 2;
    const pts: V3[] = [];
    const rin = 3.2 / Math.cos((a1 - a0) / 2);
    for (const a of [a0, a1]) {
      pts.push([cx + Math.cos(a) * rin, yCeil, cz + Math.sin(a) * rin], [cx + Math.cos(a) * rin, roofIn, cz + Math.sin(a) * rin]);
      pts.push([cx + Math.cos(a) * 4.6, yCeil, cz + Math.sin(a) * 4.6], [cx + Math.cos(a) * 4.6, roofOut, cz + Math.sin(a) * 4.6]);
    }
    k.hull('terracotta', pts, { tint: 0xe8d8cc });
  }
  // The drum above the roof: two courses on the wall's inner strip
  ringOf(16, 0, 2.9, 3.2, wallTop, wallTop + 0.5, 'limestone');
  ringOf(16, half, 2.9, 3.2, wallTop + 0.5, roofIn, 'limestone');

  // The dome: shell pieces, rings of 16, 16 and 8, a cap and a finial
  const yDome = roofIn;
  // `halves`: its foot follows the ring of twice as many under it (a corner at its middle too), so
  // the two meet all along instead of leaving a crescent of sky under each chord
  const shell = (a0: number, a1: number, b0: number, b1: number, halves = false): V3[] => {
    const pts: V3[] = [];
    const at = (a: number, b: number, r: number): V3 => [cx + r * Math.cos(b) * Math.cos(a), yDome + r * Math.sin(b), cz + r * Math.cos(b) * Math.sin(a)];
    for (const a of [a0, a1]) for (const b of [b0, b1]) for (const r of [2.9, 3.2]) pts.push(at(a, b, r));
    if (halves) for (const r of [2.9, 3.2]) pts.push(at((a0 + a1) / 2, b0, r));
    return pts;
  };
  const rings: Array<{ n: number; b0: number; b1: number; halves?: boolean }> = [
    { n: 16, b0: 0, b1: 22.5 * DEG },
    { n: 16, b0: 22.5 * DEG, b1: 45 * DEG },
    { n: 8, b0: 45 * DEG, b1: 67.5 * DEG, halves: true },
  ];
  for (const rg of rings) for (let i = 0; i < rg.n; i++) k.hull('marble', shell((i / rg.n) * Math.PI * 2, ((i + 1) / rg.n) * Math.PI * 2, rg.b0, rg.b1, rg.halves));
  const capPts: V3[] = [];
  for (const r of [2.9, 3.2]) capPts.push(...ring(cx, yDome + r * Math.sin(67.5 * DEG), cz, r * Math.cos(67.5 * DEG), 8), [cx, yDome + r, cz]);
  const cap = k.hull('marble', capPts);
  const finial = k.hull('marble', [...ring(cx, yDome + 3.2, cz, 0.22, 8), ...ring(cx, yDome + 3.55, cz, 0.12, 8), [cx, yDome + 3.75, cz]], { bond: false });
  if (cap && finial) k.d.bond(finial, cap, 0.05);

  // Inside: a small round altar
  k.hull('marble', [...ring(cx, floor, cz, 0.45, 16), ...ring(cx, floor + 0.9, cz, 0.45, 16)]);
}

/** An angle into (-π, π]. */
function wrap(a: number): number {
  let x = a % (Math.PI * 2);
  if (x > Math.PI) x -= Math.PI * 2;
  if (x <= -Math.PI) x += Math.PI * 2;
  return x;
}
