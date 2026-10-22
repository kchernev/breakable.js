// What the scenery round the breakable town is built as once a round or a blast reaches it
// (scenery.ts makes each a dormant thing): a house as plastered panels a bay wide and a storey high
// under its roof, a length of the town wall as two rubble skins under battlements (as the breakable
// wall is built), a robbed-out stub of the south wall in courses, a round tower in courses of arc
// blocks under its cone, a tree as its trunk and its crown, the windmill as its trestle, post, body,
// roof and sails.

import { clip, type Destruction, frustum, hullConvex, multiply, type Piece, type Q, type V3 } from '../../../lib/index.ts';
import { WORLD_FRAME } from '../../towers.ts';
import { Frame, type Kit, rotX, rotY, rotZ, yaw } from './kit.ts';
import { coursedWall, courses, roundTower } from './masonry.ts';
import { battlements, cone } from './walls.ts';

/** The scenery houses: a storey's height, and how far an upper storey stands out over the ground floor. */
export const STOREY = 2.8;
export const JETTY = 0.4;
/** A house's walls (m thick) and the width of a panel of them (about a window's bay). */
const T = 0.3;
const BAY = 2.2;
/** The roofs: how far the eaves stand out, and their pitch's rise over run. */
export const EAVES = 0.5;
export const PITCH = 1.2;

/** A scenery house: its footprint, its eaves' height, which way its ridge runs, its wash (its facade's tone) and its tiles' tint. */
export interface HouseSpec {
  x0: number;
  z0: number;
  x1: number;
  z1: number;
  h: number;
  ridgeAlongX: boolean;
  tone: number;
  tiles: number;
}

/**
 * A house: its walls in panels (the facade drawn as the scenery's, from where each stood: the
 * 'house' material), rows on the storey lines; a jettied house's upper storeys over a floor that
 * reaches out past the ground storey's walls; its roof in two halves, in lengths along the ridge,
 * resting on the walls' tops.
 */
export function house(d: Destruction, s: HouseSpec): void {
  const panel = (size: V3, position: V3) => d.addBox({ material: 'house', size, position, tint: s.tone, textureFrame: WORLD_FRAME });
  // A box's walls from y0 to y1: the faces along x whole, the ends between them
  const walls = (ax: number, az: number, bx: number, bz: number, y0: number, y1: number) => {
    const rows: Array<[number, number]> = [];
    for (let y = y0; y < y1 - 1e-6; ) {
      const next = Math.min(y1, (Math.floor(y / STOREY + 1e-6) + 1) * STOREY);
      rows.push([y, next]);
      y = next;
    }
    // (A sliver at the top goes with the row under it)
    if (rows.length > 1 && rows[rows.length - 1][1] - rows[rows.length - 1][0] < 0.5) rows[rows.length - 2][1] = rows.pop()![1];
    for (const [a, b] of rows) {
      const y = (a + b) / 2;
      for (const far of [false, true]) {
        const n = Math.max(1, Math.round((bx - ax) / BAY));
        const cw = (bx - ax) / n;
        for (let c = 0; c < n; c++) panel([cw, b - a, T], [ax + cw * (c + 0.5), y, far ? bz - T / 2 : az + T / 2]);
        const len = bz - az - 2 * T;
        const m = Math.max(1, Math.round(len / BAY));
        const cd = len / m;
        for (let c = 0; c < m; c++) panel([T, b - a, cd], [far ? bx - T / 2 : ax + T / 2, y, az + T + cd * (c + 0.5)]);
      }
    }
  };
  const { x0, z0, x1, z1, h } = s;
  if (h > 5.2) {
    walls(x0 + JETTY, z0 + JETTY, x1 - JETTY, z1 - JETTY, 0, STOREY - 0.25);
    // The floor, out over the ground storey's walls to the upper ones'
    const nx = Math.ceil((x1 - x0) / 3);
    const nz = Math.ceil((z1 - z0) / 3);
    const [sx, sz] = [(x1 - x0) / nx, (z1 - z0) / nz];
    for (let i = 0; i < nx; i++) for (let k = 0; k < nz; k++) panel([sx, 0.25, sz], [x0 + sx * (i + 0.5), STOREY - 0.125, z0 + sz * (k + 0.5)]);
    walls(x0, z0, x1, z1, STOREY, h);
  } else walls(x0, z0, x1, z1, 0, h);
  // The roof: each half (eaves to ridge) in lengths along the ridge
  for (const half of roofHalves(s)) {
    const n = Math.max(1, Math.ceil(half.length / 3));
    for (let i = 0; i < n; i++) {
      const points = half.section.flatMap((p): V3[] => [
        [p[0] + half.along[0] * (half.length * i) / n, p[1], p[2] + half.along[2] * (half.length * i) / n],
        [p[0] + half.along[0] * (half.length * (i + 1)) / n, p[1], p[2] + half.along[2] * (half.length * (i + 1)) / n],
      ]);
      d.addConvex({ material: 'roofing', points, tint: s.tiles, textureFrame: half.frame });
    }
  }
}

/**
 * A house's roof as two halves, each solid from its eaves to the ridge: its section at the ridge's
 * start (eaves, under the ridge, the ridge), the way along the ridge and how far, and the frame its
 * tiles are laid in (the slope's, turned to face down it, as the breakable roofs' slabs are). The
 * scenery draws it as the woken roof is built, so the tiles lie the same.
 */
export function roofHalves(s: HouseSpec): Array<{ section: [V3, V3, V3]; along: V3; length: number; frame: { position: V3; rotation: Q } }> {
  const p = Math.atan(PITCH);
  const { x0, z0, x1, z1, h } = s;
  const [ra, rb] = s.ridgeAlongX ? [x0 - EAVES, x1 + EAVES] : [z0 - EAVES, z1 + EAVES];
  const [ca, cb] = s.ridgeAlongX ? [z0 - EAVES, z1 + EAVES] : [x0 - EAVES, x1 + EAVES];
  const mid = (ca + cb) / 2;
  const top = h + ((cb - ca) / 2) * PITCH;
  const at = (r: number, c: number, y: number): V3 => (s.ridgeAlongX ? [r, y, c] : [c, y, r]);
  return [ca, cb].map((eaves) => {
    // (A slope's frame: u along the ridge, w from the eaves in; yaw a turns w that way)
    const a = s.ridgeAlongX ? (eaves === ca ? 0 : Math.PI) : eaves === ca ? Math.PI / 2 : -Math.PI / 2;
    return {
      section: [at(ra, eaves, h), at(ra, mid, h), at(ra, mid, top)],
      along: s.ridgeAlongX ? [1, 0, 0] : [0, 0, 1],
      length: rb - ra,
      frame: { position: at(ra, eaves, h), rotation: multiply(multiply(yaw(a), rotX(-p)), rotY(Math.PI)) },
    };
  });
}

/** A length `L` of the town wall in frame `f` (its outer face at w = 0, 2 m thick): two rubble skins, the battlements on top. */
export function wallLength(kit: Kit, f: Frame, L: number): void {
  const lines = courses(0, 10, 0.75);
  coursedWall(kit, f, { material: 'rubble', length: L, thickness: 1, lines, block: [1.2, 1.8], tint: 0xffffff, vary: 0.05, phase: 0.2 });
  coursedWall(kit, f.sub(L, 0, 2, Math.PI), { material: 'rubble', length: L, thickness: 1, lines, block: [1.2, 1.8], tint: 0xf4f0ea, vary: 0.05, phase: 0.6 });
  battlements(kit, f.sub(0, 7.5, 0), L, 1.1, 0.6);
}

/** A step of a robbed-out wall: x0 to x1 along x, 2 m thick from z0, `top` high, in courses about 0.75 m. */
export function wallStub(kit: Kit, x0: number, x1: number, z0: number, top: number): void {
  const n = Math.max(1, Math.round(top / 0.75));
  coursedWall(kit, new Frame([x0, 0, z0]), { material: 'rubble', length: x1 - x0, thickness: 2, lines: courses(0, n, top / n), block: [1.2, 1.8], tint: 0xffffff, vary: 0.05, maxDepth: 1 });
}

/** A round tower of the town's: 12 courses of arc blocks to 9.5 m, its cone (tiles of `tint`) to 14 m. */
export function townTower(kit: Kit, x: number, z: number, tint: number): void {
  roundTower(kit, x, z, 2.3, 3.5, 12, 9.5 / 12, 'rubbleTower', 0xffffff);
  cone(kit, new Frame([x, 0, z]), 9.5, 14, 3.9, 2.4, 2, tint);
}

/** A lump of a tree's crown: its middle, its half-sizes (x, y, z) and its turn about the vertical. */
export interface Lump {
  c: V3;
  s: V3;
  turn?: number;
}

/** A tree standing at (x, y, z): its trunk's radius at the foot (0: none, a bush), its crown's lumps, their green. */
export interface TreeSpec {
  x: number;
  y: number;
  z: number;
  trunk: number;
  lumps: Lump[];
  tint: number;
}

/** A sphere's points: an icosahedron's corners and its edges' middles (42). */
const BALL: V3[] = (() => {
  const t = (1 + Math.sqrt(5)) / 2;
  const unit = ([x, y, z]: V3): V3 => {
    const l = Math.hypot(x, y, z);
    return [x / l, y / l, z / l];
  };
  const corners = (
    [
      [-1, t, 0],
      [1, t, 0],
      [-1, -t, 0],
      [1, -t, 0],
      [0, -1, t],
      [0, 1, t],
      [0, -1, -t],
      [0, 1, -t],
      [t, 0, -1],
      [t, 0, 1],
      [-t, 0, -1],
      [-t, 0, 1],
    ] as V3[]
  ).map(unit);
  const mids: V3[] = [];
  for (let a = 0; a < 12; a++)
    for (let b = a + 1; b < 12; b++) {
      const [p, q] = [corners[a], corners[b]];
      if (Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]) < 1.1) mids.push(unit([p[0] + q[0], p[1] + q[1], p[2] + q[2]]));
    }
  return [...corners, ...mids];
})();

/**
 * A tree: its crown its lumps as drawn, each a piece (the lump cut where it meets the others, on
 * the planes that share their overlap out between them, so together they're the crown as it stood
 * and none overlaps another); its trunk in two lengths, tapering, up to the crown's underside, which
 * it's bonded to. A crown down to the ground (a bush, the yew) is cut flat on it and has no trunk.
 */
export function tree(d: Destruction, t: TreeSpec): void {
  // Where the trunk meets the crown: the lumps' underside over it, else the lowest of them
  const under = t.lumps.map((l) => {
    const [dx, dz] = [(t.x - l.c[0]) / l.s[0], (t.z - l.c[2]) / l.s[2]];
    const k = 1 - dx * dx - dz * dz;
    return k > 0 ? l.c[1] - l.s[1] * Math.sqrt(k) : Infinity;
  });
  const lowest = Math.min(...t.lumps.map((l) => l.c[1] - l.s[1]));
  const meets = Math.min(...under);
  let top = Number.isFinite(meets) ? meets : lowest;
  const trunk = t.trunk > 0 && top - t.y > 0.4;
  if (!trunk) top = t.y;
  // Each lump's piece. Its overlap with another shared out on their power plane (the plane equal
  // in the squares of the distances less the squares of the radii), taken where the lumps are
  // spheres: y scaled by the crown's squash, a lump's own (the same for all of a tree's)
  const squash = t.lumps[0].s[1] / t.lumps[0].s[0];
  const crown: Array<{ piece: Piece | null; lump: Lump }> = [];
  t.lumps.forEach((l, i) => {
    const [c, s] = [Math.cos(l.turn ?? 0), Math.sin(l.turn ?? 0)];
    const points = BALL.map(([x, y, z]): V3 => {
      const [u, w] = [x * l.s[0], z * l.s[2]];
      return [l.c[0] + u * c + w * s, l.c[1] + y * l.s[1], l.c[2] - u * s + w * c];
    });
    let shape = hullConvex(points);
    const sphere = (m: Lump): [V3, number] => [[m.c[0], m.c[1] / squash, m.c[2]], m.s[0]];
    const [ci, ri] = sphere(l);
    t.lumps.forEach((o, j) => {
      if (j === i || !shape) return;
      const [cj, rj] = sphere(o);
      const m: V3 = [cj[0] - ci[0], cj[1] - ci[1], cj[2] - ci[2]];
      const dd = (cj[0] ** 2 + cj[1] ** 2 + cj[2] ** 2 - ci[0] ** 2 - ci[1] ** 2 - ci[2] ** 2 - rj * rj + ri * ri) / 2;
      shape = clip(shape, [m[0], m[1] / squash, m[2]], dd);
    });
    // A crown with no trunk cut flat on the ground
    if (shape && !trunk) shape = clip(shape, [0, -1, 0], -top);
    if (!shape) return;
    const corners = shape.faces.flatMap((f) => f.pts);
    crown.push({ piece: d.addConvex({ material: 'leaves', points: corners, tint: t.tint, smooth: 1.2 }), lump: l });
  });
  if (!trunk) return;
  const mid = (t.y + top) / 2;
  const head = t.trunk * 0.65;
  const at = (y: number) => t.trunk + (head - t.trunk) * ((y - t.y) / (top - t.y));
  let upper: Piece | null = null;
  for (const [a, b] of [
    [t.y, mid],
    [mid, top],
  ])
    upper = d.addConvex({ material: 'oak', points: frustum(at(a), at(b), b - a, 7).map(([x, y, z]): V3 => [t.x + x, a + y, t.z + z]), tint: 0x5a4a3c, smooth: 0.9 });
  // The crown sits on it: bonded to the lump it meets (or the lowest)
  const seat = crown.reduce<{ piece: Piece | null; lump: Lump } | null>((best, c) => {
    const gap = (x: { lump: Lump }) => Math.hypot(x.lump.c[0] - t.x, x.lump.c[1] - x.lump.s[1] - top, x.lump.c[2] - t.z);
    return !best || gap(c) < gap(best) ? c : best;
  }, null);
  if (upper && seat?.piece) d.bond(upper, seat.piece, 0.08, [t.x, top, t.z]);
}

/**
 * The post mill in frame `f` (on its hill, facing the town), its sails turned `sails` (radians):
 * the trestle's beams, the post on them, the body's floor on the post and its board walls, the roof,
 * the windshaft and hub, and the four sails (stocks with their cloths) as they stood.
 */
export function windmill(d: Destruction, f: Frame, sails: number): void {
  const oak = 0x4a3c30;
  const boards = 0x7a6450;
  const box = (material: string, tint: number, size: V3, u: number, v: number, w: number) => d.addBox({ material, size, position: f.at(u, v, w), rotation: f.q, tint });
  box('oak', oak, [5, 0.3, 0.3], 0, 0.15, 0);
  for (const side of [1, -1]) box('oak', oak, [0.3, 0.3, 2.35], 0, 0.15, side * (0.15 + 2.35 / 2));
  d.addConvex({ material: 'oak', points: frustum(0.5, 0.35, 4.2, 8).map(([x, y, z]) => f.at(x, 0.3 + y, z)), tint: oak, smooth: 0.9 });
  box('boards', boards, [3.6, 0.15, 4.6], 0, 4.575, 0);
  // The body's walls (no floor: it stands on the one under it)
  const [y0, y1] = [4.65, 9.2];
  for (const side of [1, -1]) {
    box('boards', boards, [3.6, y1 - y0, 0.15], 0, (y0 + y1) / 2, side * (2.3 - 0.075));
    box('boards', boards, [0.15, y1 - y0, 4.3], side * (1.8 - 0.075), (y0 + y1) / 2, 0);
  }
  // The roof: a pyramid over it, its eaves a little out past the walls
  const roof: V3[] = [f.at(0, 10.8, 0)];
  for (const [u, w] of [
    [1.91, 2.39],
    [-1.91, 2.39],
    [1.91, -2.39],
    [-1.91, -2.39],
  ])
    roof.push(f.at(u, y1, w));
  d.addConvex({ material: 'boards', points: roof, tint: oak });
  // The windshaft out of the front, the hub on it; the sails from the hub
  box('oak', oak, [0.3, 0.3, 0.15], 0, 7.8, 2.375);
  box('oak', oak, [0.4, 0.4, 0.3], 0, 7.8, 2.6);
  for (let i = 0; i < 4; i++) {
    const a = sails + (i * Math.PI) / 2;
    const [c, s] = [Math.cos(a), Math.sin(a)];
    // A point of the sail (x across it, y out along it) in the frame
    const out = (x: number, y: number, w: number): V3 => f.at(x * c - y * s, 7.8 + x * s + y * c, w);
    const rotation = multiply(f.q, rotZ(a));
    d.addBox({ material: 'oak', size: [0.25, 10.3, 0.2], position: out(0, 0.2 + 5.15, 2.6), rotation, tint: oak });
    d.addBox({ material: 'cloth', size: [1.8, 8, 0.06], position: out(0.125 + 0.9, 6.2, 2.65), rotation, tint: 0xd8ccb0 });
  }
}
