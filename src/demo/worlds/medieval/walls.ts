// The town's defences on the north side of the square: the wall (two rubble skins, a parapet and
// merlons), the stone stair up to its walk, the gatehouse over the road (a round arch of real
// voussoirs, a portcullis half raised, the gate leaves open), and the round tower with its cone.

import { cylinder, type V3 } from '../../../lib/index.ts';
import { Frame, type Kit, type P, split, vary } from './kit.ts';
import { coursedWall, courses, enclosure, ring, roundTower } from './masonry.ts';

const WALL = {
  /** The skins' outer faces: the country's side, the town's. */
  outer: -18,
  inner: -16,
  walk: 7.5,
  /** Where the breakable wall runs: west of the gate, east of it. */
  west: [-23.95, -4.5] as [number, number],
  east: [4.5, 26] as [number, number],
  tower: { x: -28, z: -17, ri: 2.8, ro: 4.0 },
};

export function townWall(kit: Kit): void {
  kit.part('town wall');
  const lines = courses(0, 10, 0.75);
  for (const [x0, x1] of [WALL.west, WALL.east]) {
    const L = x1 - x0;
    // The outer skin faces north, the inner one the town; their joints a quarter block apart
    coursedWall(kit, new Frame([x0, 0, WALL.outer]), { material: 'rubble', length: L, thickness: 1, lines, block: [1.2, 1.8], tint: 0xffffff, vary: 0.05, phase: 0.2 });
    coursedWall(kit, new Frame([x1, 0, WALL.inner], Math.PI), { material: 'rubble', length: L, thickness: 1, lines, block: [1.2, 1.8], tint: 0xf4f0ea, vary: 0.05, phase: 0.6 });
    battlements(kit, new Frame([x0, WALL.walk, WALL.outer]), L, 1.1, 0.6);
  }
  kit.close();
}

/**
 * A parapet `h` tall and `t` thick along u in `f` (outer face at w = 0), merlons on it with
 * crenels between, limestone coping over both.
 */
function battlements(kit: Kit, f: Frame, length: number, h: number, t: number, merlon = 0.88): void {
  for (const [a, b] of pairs(split(0, length, 1.9))) kit.box(f, 'rubble', a, 0, 0, b - a, h, t, { tint: vary(0xffffff, 0.04, kit.rand) });
  const cope = 0.12;
  const pitch = 1.8;
  const n = Math.max(1, Math.floor((length + 0.8) / pitch));
  const start = (length - (n * pitch - 0.8)) / 2;
  let x = 0;
  for (let i = 0; i < n; i++) {
    const m0 = start + i * pitch;
    // The crenel before it, then the merlon
    if (m0 > x + 0.05) kit.box(f, 'limestone', x, h, 0, m0 - x, cope, t, { tint: vary(0xf2ece0, 0.05, kit.rand) });
    kit.box(f, 'rubble', m0, h, 0, 1.0, merlon, t, { tint: vary(0xffffff, 0.04, kit.rand) });
    kit.box(f, 'limestone', m0, h + merlon, 0, 1.0, cope, t, { tint: vary(0xf2ece0, 0.05, kit.rand) });
    x = m0 + 1.0;
  }
  if (length > x + 0.05) kit.box(f, 'limestone', x, h, 0, length - x, cope, t, { tint: vary(0xf2ece0, 0.05, kit.rand) });
}

/** The stair up the inner face to the walk: 30 steps cantilevered from the wall, rising west. */
export function wallStair(kit: Kit): void {
  kit.part('wall stair');
  const f = new Frame([0, 0, WALL.inner]);
  for (let i = 0; i < 30; i++) {
    const x1 = -6 - 0.35 * i;
    kit.box(f, 'limestone', x1 - 0.6, 0.25 * i, 0, 0.6, 0.25, 1.0, { tint: vary(0xffffff, 0.06, kit.rand) });
  }
  kit.close();
}

/** The gatehouse: piers, the arch and its fill, the guard chamber's walls, merlons; the portcullis and the gate. */
export function gatehouse(kit: Kit): { lanterns: Array<{ f: Frame; u: number; v: number }> } {
  kit.part('gatehouse');
  const f = new Frame([-4.5, 0, -20]);
  const span = 3.6;
  const opening = { u0: 4.5 - span / 2, u1: 4.5 + span / 2, sill: 0, spring: 3.6 };
  // Piers of ashlar, the passage between
  coursedWall(kit, f, { material: 'limestone', length: 9, thickness: 6, lines: courses(0, 5, 0.72), block: [1.25, 1.45], openings: [opening], tint: 0xffffff });
  // The arch (11 voussoirs, 3 slices deep) and the rubble fill over it, which floors the chamber
  const fill = coursedWall(kit, f, {
    material: 'rubble',
    length: 9,
    thickness: 6,
    lines: courses(3.6, 4, 0.75),
    block: [1.3, 1.8],
    openings: [{ ...opening, sill: 3.6, arch: { ring: 0.6, count: 11 } }],
    tint: 0xffffff,
    vary: 0.04,
  });
  // The guard chamber: walls round it, doors from the wall walk either side
  const lines = [6.6, 7.5, 8.22, 8.94, 9.66, 10.38, 11.1];
  const door = { sill: 7.5, spring: 9.66 };
  enclosure(kit, -4.5, -20, 4.5, -14, 1.2, { material: 'rubble', lines, block: [1.3, 1.8], tint: 0xffffff, vary: 0.05 }, { e: [{ u0: 2.7, u1: 3.9, ...door }], w: [{ u0: 2.1, u1: 3.3, ...door }], n: [{ u0: 2.2, u1: 2.5, sill: 8.94, spring: 10.38 }, { u0: 6.5, u1: 6.8, sill: 8.94, spring: 10.38 }] });
  // Merlons round the top
  const top = 11.1;
  for (const { f: side, length } of [
    { f: new Frame([-4.5, top, -20]), length: 9 },
    { f: new Frame([4.5, top, -14], Math.PI), length: 9 },
    { f: new Frame([4.5, top, -19.4], -Math.PI / 2), length: 4.8 },
    { f: new Frame([-4.5, top, -14.6], Math.PI / 2), length: 4.8 },
  ]) {
    const n = Math.floor((length + 0.8) / 1.8);
    const start = (length - (n * 1.8 - 0.8)) / 2;
    for (let i = 0; i < n; i++) {
      kit.box(side, 'rubble', start + i * 1.8, 0, 0, 1.0, 0.78, 0.6, { tint: vary(0xffffff, 0.04, kit.rand) });
      kit.box(side, 'limestone', start + i * 1.8, 0.78, 0, 1.0, 0.12, 0.6, { tint: vary(0xf2ece0, 0.05, kit.rand) });
    }
  }
  portcullis(kit, fill.arches[0]);
  // The gate leaves, open against the passage walls
  for (const side of [-1, 1]) {
    const x = side * 1.8 - (side > 0 ? 0.1 : 0);
    const g = new Frame([x, 0, -19.5]);
    for (const v of [0, 1.7]) kit.box(g, 'boards', 0, v, 0, 0.1, 1.7, 1.75, { tint: vary(0x9a8a74, 0.05, kit.rand) });
  }
  kit.close();
  return {
    lanterns: [
      { f: new Frame([-1.8, 0, -14.9], -Math.PI / 2), u: 0, v: 2.7 },
      { f: new Frame([1.8, 0, -15.1], Math.PI / 2), u: 0, v: 2.7 },
    ],
  };
}

/** The portcullis, hanging half raised in the arch's front: bars and cross bars, pinned to the voussoirs over it. */
function portcullis(kit: Kit, voussoirs: P[]): void {
  const f = new Frame([0, 0, -19.75]);
  const bar = 0.08;
  const bottom = 3.0;
  const r = 1.8;
  const bars: P[] = [];
  for (const x of [-1.4, -0.7, 0, 0.7, 1.4]) {
    const top = 3.6 + Math.sqrt(r * r - (Math.abs(x) + bar / 2) ** 2) - 0.08;
    bars.push(kit.box(f, 'iron', x - bar / 2, bottom - 0.1, bar, bar, top - bottom + 0.1, bar));
  }
  let last: P = null;
  for (const y of [3.15, 3.85, 4.5]) last = kit.box(f, 'iron', -1.45, y, 0, 2.9, bar, bar);
  // Its chains: the middle bar and the top cross bar to the crown's front voussoirs (3 slices each)
  const front = (i: number) => voussoirs[i * 3] ?? null;
  for (const i of [4, 5, 6]) {
    kit.bond(bars[2], front(i), 0.01);
    kit.bond(last, front(i), 0.01);
  }
}

/** The round tower: rubble courses, a door toward the square, two floors, the oak wall plate and the tiled cone. */
export function tower(kit: Kit): void {
  kit.part('round tower');
  const { x, z, ri, ro } = WALL.tower;
  const h = 0.75;
  const n = 16;
  roundTower(kit, x, z, ri, ro, n, h, 'rubbleTower', 0xffffff, 3);
  const c = new Frame([x, 0, z]);
  // Floors at 4.5 and 9: board sectors meeting the course they sit in
  for (const k of [6, 12]) {
    const turn = ((k - 3 + 1) % 2) * (Math.PI / 12);
    for (let i = 0; i < 12; i++) {
      const a0 = turn + (i * Math.PI) / 6;
      const a1 = a0 + Math.PI / 6;
      const pts: V3[] = [];
      for (const y of [0, 0.1]) pts.push([0, y, 0], [ri * Math.cos(a0), y, ri * Math.sin(a0)], [ri * Math.cos(a1), y, ri * Math.sin(a1)]);
      kit.hull(c, 'boards', pts, 0, k * h, 0, { tint: vary(0xb8a890, 0.06, kit.rand) });
    }
  }
  const top = n * h;
  ring(kit, c, ri, ro, top, 0.25, 12, 0, 'oak', 0x9a8070);
  // The cone: 4 layers of 12, the lowest resting on the wall plate, the top in wedges to the point
  const y0 = top + 0.25;
  const apex = 18.5;
  const ro0 = 4.4;
  const outer = (y: number) => (ro0 * (apex - y)) / (apex - y0);
  const layers = split(y0, apex, (apex - y0) / 4);
  const tile = 0xc8a898;
  const wedges: P[] = [];
  for (let l = 0; l < 4; l++) {
    const [ya, yb] = [layers[l], layers[l + 1]];
    for (let i = 0; i < 12; i++) {
      const a0 = (i * Math.PI) / 6;
      const a1 = a0 + Math.PI / 6;
      const pts: V3[] = [];
      for (const a of [a0, a1]) {
        const [ca, sa] = [Math.cos(a), Math.sin(a)];
        const rib = l === 0 ? 3.6 : outer(ya) - 0.24;
        pts.push([rib * ca, ya, rib * sa], [outer(ya) * ca, ya, outer(ya) * sa]);
        if (l < 3) pts.push([(outer(yb) - 0.24) * ca, yb, (outer(yb) - 0.24) * sa], [outer(yb) * ca, yb, outer(yb) * sa]);
      }
      if (l === 3) pts.push([0, apex, 0]);
      const p = kit.hull(c, 'tile', pts, 0, 0, 0, { tint: vary(tile, 0.04, kit.rand) });
      if (l === 3) wedges.push(p);
    }
  }
  // An iron finial on the point
  const finial = kit.hull(c, 'iron', cylinder(0.05, 0.9, 6), 0, apex, 0);
  for (const w of wedges.slice(0, 4)) kit.bond(finial, w, 0.005);
  kit.close();
}

function pairs(xs: number[]): Array<[number, number]> {
  return xs.slice(0, -1).map((x, i) => [x, xs[i + 1]]);
}
