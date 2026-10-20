// The warehouse: a portal-framed shed, 24 × 16 m. Steel columns on five frames, sloping rafters to
// a ridge, purlins on the rafters, box-profile sheets on the purlins and on the walls (standing on a
// concrete plinth), two roller doors on the north face (one half open), a door and windows in the
// east gable, and two runs of pallet racking inside. The sheeting is light and weakly held: a
// rocket peels it; cut two columns and that bay's roof sags in (the frame is lightly joined).

import type { Destruction, Piece, Pose, V3 } from '../../../lib/index.ts';
import { random } from '../../../lib/index.ts';
import { Frame, split, spans, weaken } from './frame.ts';
import { loadedPallet } from './yard.ts';

const SHED = { x0: -34, x1: -10, z0: 8, z1: 24, eave: 7, ridge: 16, doors: [[-33.3, -28.5], [-21.3, -16.5]] as Array<[number, number]> };

const WALL = 0x8f9a94;
const ROOF = 0x7c8288;
const FRAME = 0x5c6a72;
/** The roof's pitch: 1.6 m over 8 m. */
const SLOPE = 0.2;
const RAFTER = 0.45;
const PURLIN = 0.15;
const SHEET = 0.05;

export function buildWarehouse(d: Destruction, seed = 9): void {
  const { x0, x1, z0, z1, eave, ridge } = SHED;
  const f = new Frame(d, [0, 0, 0]);
  const box = (material: string, min: V3, max: V3, tint?: number) => f.box(material, min, max, { tint });
  const hull = (material: string, points: V3[], tint?: number, textureFrame?: Pose) => d.addConvex({ material, points, tint, textureFrame });
  // Each wall's sheets share one texture frame (at its lower corner), so the cladding's stains and
  // ribs run on from sheet to sheet
  const wall = (corner: V3): Pose => ({ position: corner, rotation: [0, 0, 0, 1] });
  const sheet = (min: V3, max: V3, frame: Pose) => f.box('cladding', min, max, { tint: WALL, textureFrame: frame });
  // The portal frame's members (columns, rafters, eaves beams, purlins, gable posts): the crane's
  // steel, more lightly joined (below)
  const members: Piece[] = [];
  const member = (p: Piece | null) => {
    if (p) members.push(p);
    return p;
  };
  const frames = [-34, -28, -22, -16, -10];
  const colX = (fx: number): [number, number] => (fx === x0 ? [x0, x0 + 0.35] : fx === x1 ? [x1 - 0.35, x1] : [fx - 0.175, fx + 0.175]);
  const rafterX = (fx: number): [number, number] => (fx === x0 ? [x0, x0 + 0.3] : fx === x1 ? [x1 - 0.3, x1] : [fx - 0.15, fx + 0.15]);
  // The rafters' underside (y) at z: up from each eave to the ridge
  const under = (z: number) => eave + SLOPE * (z < ridge ? z - z0 : z1 - z);

  // Plinth: a concrete dwarf wall outside the column line, broken at the doors
  const plinth = (ax: number, bx: number, az: number, bz: number) => {
    const along = bx - ax > bz - az;
    for (const [a, b] of split(along ? ax : az, along ? bx : bz, 2)) box('concrete', along ? [a, 0, az] : [ax, 0, a], along ? [b, 1, bz] : [bx, 1, b], 0xb4b8b8);
  };
  const [d1, d2] = SHED.doors;
  plinth(x0 - 0.25, d1[0], z0 - 0.25, z0);
  plinth(d1[1], d2[0], z0 - 0.25, z0);
  plinth(d2[1], x1 + 0.25, z0 - 0.25, z0);
  plinth(x0 - 0.25, x1 + 0.25, z1, z1 + 0.25);
  plinth(x0 - 0.25, x0, z0, z1);
  // The east gable's personnel door breaks its plinth
  plinth(x1, x1 + 0.25, z0, 18.5);
  plinth(x1, x1 + 0.25, 19.5, z1);

  // Columns on every frame, both long walls; the rafters on them, bonded at the foot and the ridge
  const columnTops = new Map<string, Piece | null>();
  const rafters = new Map<number, Array<{ za: number; zb: number; piece: Piece | null }>>();
  for (const fx of frames) {
    const [cx0, cx1] = colX(fx);
    for (const [cz0, cz1] of [
      [z0, z0 + 0.3],
      [z1 - 0.3, z1],
    ]) {
      let top: Piece | null = null;
      for (const [y0, y1] of spans(0, eave, 4)) top = member(box('steel', [cx0, y0, cz0], [cx1, y1, cz1], FRAME));
      columnTops.set(`${fx},${cz0}`, top);
    }
    const [rx0, rx1] = rafterX(fx);
    const lengths: Array<Piece | null> = [];
    const list: Array<{ za: number; zb: number; piece: Piece | null }> = [];
    for (const [za, zb] of [...spans(z0, ridge, 4), ...spans(ridge, z1, 4)]) {
      const pts: V3[] = [];
      for (const x of [rx0, rx1]) for (const z of [za, zb]) pts.push([x, under(z), z], [x, under(z) + RAFTER, z]);
      const piece = member(hull('steel', pts, FRAME));
      lengths.push(piece);
      list.push({ za, zb, piece });
    }
    rafters.set(fx, list);
    const north = columnTops.get(`${fx},${z0}`);
    const south = columnTops.get(`${fx},${z1 - 0.3}`);
    if (lengths[0] && north) d.bond(lengths[0], north, 0.08);
    if (lengths[7] && south) d.bond(lengths[7], south, 0.08);
  }

  // Eaves beams between the rafters, on the column tops
  for (let i = 0; i < frames.length - 1; i++) {
    const a = rafterX(frames[i])[1];
    const b = rafterX(frames[i + 1])[0];
    for (const [cz0, cz1] of [
      [z0, z0 + 0.3],
      [z1 - 0.3, z1],
    ])
      for (const [xa, xb] of spans(a, b, 3)) member(box('steel', [xa, eave, cz0], [xb, eave + 0.3, cz1], FRAME));
  }

  // Purlins and sheets on each slope, laid out along it: s from the eave up to the ridge
  const cos = 1 / Math.hypot(1, SLOPE);
  const sin = SLOPE * cos;
  const run = (ridge - z0) / cos;
  const rand = random(seed);
  // On the slope from the eave at zEdge: s along it, h out from the rafters' top, z sign toward the ridge
  const slope = (s: number, h: number, north: boolean): [number, number] => {
    const dir = north ? 1 : -1;
    const zEdge = north ? z0 : z1;
    return [zEdge + dir * (s * cos - h * sin), eave + RAFTER + s * sin + h * cos];
  };
  const onSlope = (xa: number, xb: number, s0: number, s1: number, h0: number, h1: number, north: boolean): V3[] => {
    const pts: V3[] = [];
    for (const x of [xa, xb])
      for (const s of [s0, s1])
        for (const h of [h0, h1]) {
          const [z, y] = slope(s, h, north);
          pts.push([x, y, z]);
        }
    return pts;
  };
  const sheetRows = spans(0, run, 4);
  // Rooflights: (slope, row, length) of six sheets
  const lights = new Set(['n,1,2', 'n,1,7', 's,2,4', 's,2,9', 'n,2,5', 's,1,10']);
  for (const north of [true, false]) {
    for (const [s0, s1] of sheetRows) {
      const sc = (s0 + s1) / 2;
      for (const [xa, xb] of split(x0, x1, 2)) member(hull('steel', onSlope(xa, xb, sc - 0.1, sc + 0.1, 0, PURLIN, north), FRAME));
    }
    // The sheets overhang the eave and the gables by 0.3 m
    sheetRows.forEach(([s0, s1], row) => {
      const sa = row === 0 ? -0.3 : s0;
      split(x0 - 0.3, x1 + 0.3, 2.1).forEach(([xa, xb], k) => {
        const light = lights.has(`${north ? 'n' : 's'},${row},${k}`);
        hull(light ? 'glass' : 'cladding', onSlope(xa, xb, sa, s1, PURLIN, PURLIN + SHEET, north), light ? 0xffffff : ROOF);
      });
    });
  }
  // A ridge cap over where the slopes meet, lying on both top rows of sheets
  for (const [xa, xb] of split(x0 - 0.3, x1 + 0.3, 2.1)) {
    const top = PURLIN + SHEET;
    const pts: V3[] = [];
    for (const x of [xa, xb]) {
      for (const north of [true, false])
        for (const s of [run - 0.18, run]) {
          const [z, y] = slope(s, top, north);
          pts.push([x, y, z]);
        }
      pts.push([x, slope(run, top, true)[1] + 0.1, ridge]);
    }
    hull('cladding', pts, ROOF);
  }

  // Wall sheeting: three rows from the plinth to the eaves, on the columns' outer faces
  const T = 0.06;
  const rows: Array<[number, number]> = [
    [1, 3],
    [3, 5],
    [5, eave],
  ];
  // North wall, around the roller doors
  const north = wall([x0 - T, 1, z0 - T]);
  const south = wall([x0 - T, 1, z1]);
  for (const [y0, y1] of rows) {
    const runs: Array<[number, number]> = y1 <= 5 ? [[x0 - T, d1[0]], [d1[1], d2[0]], [d2[1], x1 + T]] : [[x0 - T, x1 + T]];
    for (const [a, b] of runs) for (const [xa, xb] of split(a, b, 1.5)) sheet([xa, y0, z0 - T], [xb, y1, z0], north);
    for (const [xa, xb] of split(x0 - T, x1 + T, 1.5)) sheet([xa, y0, z1], [xb, y1, z1 + T], south);
  }
  // Gables: wind posts at z 12, 16, 20 up to the rafters, sheeting on them, triangles above the eaves
  for (const gx of [x0, x1]) {
    const [px0, px1] = gx === x0 ? [x0, x0 + 0.3] : [x1 - 0.3, x1];
    for (const zp of [12, 16, 20]) {
      // Up to the sloping rafter's underside where it's lowest over the post, bonded to it by hand
      let top: Piece | null = null;
      for (const [y0, y1] of split(0, Math.min(under(zp - 0.15), under(zp + 0.15)), 2)) top = member(box('steel', [px0, y0, zp - 0.15], [px1, y1, zp + 0.15], FRAME));
      const rafter = rafters.get(gx)?.find((r) => r.za <= zp && zp <= r.zb)?.piece;
      if (top && rafter) d.bond(top, rafter, 0.05);
    }
    const [sx0, sx1] = gx === x0 ? [x0 - T, x0] : [x1, x1 + T];
    const east = gx === x1;
    const gable = wall([sx0, 1, z0]);
    // The east gable has a door and three windows; its rows line up with them
    const gableRows: Array<[number, number]> = east
      ? [
          [1, 2.2],
          [2.2, 3.4],
          [3.4, 5.2],
          [5.2, eave],
        ]
      : rows;
    const windows: Array<[number, number]> = [
      [10.4, 11.6],
      [12.4, 13.6],
      [14.4, 15.6],
    ];
    for (const [y0, y1] of gableRows) {
      let gaps: Array<[number, number]> = [];
      if (east && y0 < 2.2) gaps = [[18.5, 19.5]];
      if (east && y0 === 2.2) gaps = windows;
      let z = z0;
      for (const [ga, gb] of [...gaps, [z1, z1] as [number, number]]) {
        for (const [za, zb] of split(z, ga, 1.5)) if (zb - za > 0.01) sheet([sx0, y0, za], [sx1, y1, zb], gable);
        z = gb;
      }
    }
    if (east) {
      for (const [za, zb] of windows) {
        box('glass', [sx0, 2.2, za], [sx1, 3.4, zb], 0xffffff);
        box('steel', [sx1, 2.14, za - 0.05], [sx1 + 0.06, 2.2, zb + 0.05], 0x6a6c68);
      }
      box('steel', [sx0, 0, 18.5], [sx1, 2.2, 19.5], 0x3e5470);
    }
    // Triangles above the eaves, in four trapezoids up to the rafters' top
    for (const [za, zb] of [...spans(z0, ridge, 2), ...spans(ridge, z1, 2)]) {
      const pts: V3[] = [];
      for (const x of [sx0, sx1]) for (const z of [za, zb]) pts.push([x, eave, z], [x, under(z) + RAFTER, z]);
      hull('cladding', pts, WALL, gable);
    }
  }

  // Roller doors: door 1 shut, door 2 half open. Galvanised slats in the sheeting's plane, a bottom bar, guides outside
  SHED.doors.forEach(([a, b], k) => {
    const bottom = k === 0 ? 0 : 2.4;
    box('steel', [a, bottom, z0 - T], [b, bottom + 0.1, z0], 0x4a4c4a);
    for (const [ya, yb] of spans(bottom + 0.1, 5, k === 0 ? 8 : 4)) for (const [xa, xb] of spans(a, b, 3)) box('rollerDoor', [xa, ya, z0 - T], [xb, yb, z0], 0xffffff);
    for (const x of [a, b]) for (const [ya, yb] of spans(1, 5, 3)) box('steel', [x - 0.06, ya, z0 - T - 0.06], [x + 0.06, yb, z0 - T], 0x6a6c68);
  });

  // Inside: two runs of pallet racking along x, loaded
  for (const zc of [14, 19]) racking(f, zc, rand);
  // The frame carries half what the crane's joints do: two cut columns bring their bay's roof down
  weaken(members, 0.5);
}

/** A run of pallet racking: uprights, beams at three levels, loaded pallets on them. */
function racking(f: Frame, zc: number, rand: () => number): void {
  const xs = Array.from({ length: 6 }, (_, i) => -32 + 2.8 * i);
  for (const x of xs)
    for (const z of [zc - 0.5, zc + 0.5])
      for (const [y0, y1] of spans(0, 4.5, 3)) f.box('steel', [x - 0.05, y0, z - 0.05], [x + 0.05, y1, z + 0.05], { tint: 0x3a5a8a });
  const levels = [0.15, 1.65, 3.15];
  for (let i = 0; i < xs.length - 1; i++)
    for (const y of levels) {
      for (const z of [zc - 0.5, zc + 0.5]) for (const [a, b] of spans(xs[i] + 0.05, xs[i + 1] - 0.05, 2)) f.box('steel', [a, y, z - 0.05], [b, y + 0.12, z + 0.05], { tint: 0xd06a2a });
      // Two pallet places a bay; most of them loaded
      for (const xp of [xs[i] + 0.75, xs[i] + 2.05]) if (rand() < (y < 1 ? 0.55 : 0.35)) loadedPallet(f, [xp, y + 0.12, zc], true, rand);
    }
}
