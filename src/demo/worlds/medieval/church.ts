// The church on the east side of the square: a square ashlar tower in three stages (the west door,
// string courses, the belfry with the bell in its oak frame, battlements and pinnacles) and the
// nave behind it, its pointed windows of leaded glass between buttresses, under a tile roof. Its
// openings are Gothic (two-centred arches), the town's round.

import { cylinder, frustum, type V3 } from '../../../lib/index.ts';
import { Frame, type Kit, type P, type Pt, rotY, split, vary } from './kit.ts';
import { archHead, coursedWall, courses, type Opening, sides } from './masonry.ts';
import { roof } from './timber.ts';

export const CHURCH = {
  tower: { x0: 15, z0: -5, x1: 21, z1: 1 },
  nave: { x0: 21.05, z0: -6.5, x1: 37, z1: 2.5 },
  /** The bell hangs here (its mouth's centre): in line with an opening of the west face and one of the north. */
  bell: [17.25, 15.37, -2.75] as V3,
};

const STONE = 0xffffff;

/**
 * Glass in an arched opening: a pane up to the springing and the head over it, 5 mm clear of the
 * jambs and voussoirs, so it stands on the sill alone. Bonded to them, it joined the courses up the
 * window's sides in one step: the wall's weight went through the glass, and once a rocket broke a
 * window it went round through the next ones, which gave way one after another down the nave.
 */
function archGlass(kit: Kit, f: Frame, o: Opening, w: number, tint: number): void {
  const g = 0.005;
  const uc = (o.u0 + o.u1) / 2;
  const k = 1 - (2 * g) / (o.u1 - o.u0);
  kit.box(f, 'glass', o.u0 + g, o.sill, w, o.u1 - o.u0 - 2 * g, o.spring - o.sill, 0.03, { tint });
  kit.prism(f, 'glass', archHead(o).map(([u, v]): Pt => [uc + (u - uc) * k, o.spring + (v - o.spring) * k]), w, 0.03, { tint });
}

/** The tower. Returns the bell. */
export function churchTower(kit: Kit): P {
  kit.part('church tower');
  const { x0, z0, x1, z1 } = CHURCH.tower;
  const S = x1 - x0;
  const t = 1.1;
  // Stage 1 to 8, a string course, stage 2 to 14, a string course, the belfry to 19.5
  const lines = [...courses(0, 10, 0.8), ...courses(8.25, 8, 0.71875), ...courses(14.25, 7, 0.75)];
  const strings = [10, 19];
  const isString = (k: number) => strings.includes(k);
  // The lower one is flush on the east, under the nave's west gable 5 cm off: standing proud into
  // the gable it bonded to it, and the tower coming down took the nave's west end and roof with it
  const nave = (k: number) => k === strings[0];
  // Belfry openings 0.84 wide, each centred on the bell's line (2.25 on the north face, 3.75 on the west)
  const belfry = (n: number): Opening => ({ u0: n === 0 ? 1.83 : 3.33, u1: n === 0 ? 2.67 : 4.17, sill: lines[21], spring: lines[23], arch: { ring: 0.3, count: 6, pointed: true } });
  const door: Opening = { u0: 2.2, u1: 3.8, sill: 0, spring: lines[3], arch: { ring: 0.4, count: 8, pointed: true } };
  const window: Opening = { u0: 2.65, u1: 3.35, sill: lines[6], spring: lines[7], arch: { ring: 0.3, count: 6, pointed: true } };
  const slit: Opening = { u0: 2.7, u1: 3.3, sill: lines[13], spring: lines[16], arch: { ring: 0.3, count: 6, pointed: true } };
  const all = sides(x0, z0, x1, z1);
  for (const key of ['n', 'e', 's', 'w'] as const) {
    const { f, length } = all[key];
    const through = key === 'n' || key === 's' ? 0 : 1;
    const openings = key === 'w' ? [door, window, slit, belfry(0), belfry(1)] : [belfry(0), belfry(1)];
    coursedWall(kit, f, {
      material: 'limestoneTower',
      length,
      thickness: t,
      lines,
      block: [1.2, 1.6],
      openings,
      tint: STONE,
      // String courses stand 0.12 proud, and leave room inside for the floors
      depth: (k) => (isString(k) ? [nave(k) && key === 'e' ? 0 : -0.12, t - 0.15] : [0, t]),
      ends: (k) => {
        const run = (k + through) % 2 === 0;
        if (!isString(k)) return run ? [0, length] : [t, length - t];
        if (!run) return [t - 0.15, length - t + 0.15];
        // The north face's u ends at the east corner, the south face's starts there
        return [nave(k) && key === 's' ? 0 : -0.12, length + (nave(k) && key === 'n' ? 0 : 0.12)];
      },
    });
    if (key === 'w') {
      archGlass(kit, f, window, 0.35, 0xe8d8b0);
      archGlass(kit, f, slit, 0.35, 0xd8e8c8);
      // The door: two boards leaves under the arch, set back in the reveal
      const d = new Frame(f.at(door.u0, 0, 0.5), f.a);
      for (const [u, v, h] of [
        [0, 0, 1.6],
        [0.8, 0, 1.6],
      ])
        kit.box(d, 'boards', u, v, 0, 0.8, Math.min(h, door.spring - 0.05), 0.1, { tint: vary(0x7a6050, 0.05, kit.rand) });
    }
  }
  // Floors in the string courses: boards over the inside, their edges on the course below
  const inner = t - 0.15;
  for (const k of strings) {
    const v = lines[k];
    const xs = split(x0 + inner, x1 - inner, 1.6);
    const zs = split(z0 + inner, z1 - inner, 1.6);
    for (let i = 0; i + 1 < xs.length; i++)
      for (let j = 0; j + 1 < zs.length; j++) kit.box(new Frame([xs[i], v, zs[j]]), 'boards', 0, 0, 0, xs[i + 1] - xs[i], 0.25, zs[j + 1] - zs[j], { tint: vary(0xa89880, 0.06, kit.rand) });
  }
  // Battlements and pinnacles
  const top = lines[lines.length - 1];
  const sidesTop = [
    { f: new Frame([x0, top, z0]), length: S },
    { f: new Frame([x1, top, z1], Math.PI), length: S },
    { f: new Frame([x1, top, z0 + 0.5], -Math.PI / 2), length: S - 1 },
    { f: new Frame([x0, top, z1 - 0.5], Math.PI / 2), length: S - 1 },
  ];
  for (const { f, length } of sidesTop) {
    const h = 0.45;
    for (const [a, b] of pairs(split(0, length, 2))) kit.box(f, 'limestoneTower', a, 0, 0, b - a, h, 0.5, { tint: vary(STONE, 0.05, kit.rand) });
    const n = Math.floor((length + 0.8) / 1.8);
    const start = (length - (n * 1.8 - 0.8)) / 2;
    let x = 0;
    for (let i = 0; i <= n; i++) {
      const m0 = i < n ? start + i * 1.8 : length;
      if (m0 > x + 0.05) kit.box(f, 'limestoneTower', x, h, 0, m0 - x, 0.12, 0.5, { tint: vary(0xf0e8d8, 0.04, kit.rand) });
      if (i < n) {
        kit.box(f, 'limestoneTower', m0, h, 0, 1.0, 0.45, 0.5, { tint: vary(STONE, 0.05, kit.rand) });
        kit.box(f, 'limestoneTower', m0, h + 0.45, 0, 1.0, 0.12, 0.5, { tint: vary(0xf0e8d8, 0.04, kit.rand) });
      }
      x = m0 + 1.0;
    }
  }
  for (const [x, z] of [
    [x0, z0],
    [x1 - 0.5, z0],
    [x0, z1 - 0.5],
    [x1 - 0.5, z1 - 0.5],
  ]) {
    const f = new Frame([x, top + 0.57, z]);
    kit.box(f, 'limestoneTower', 0, 0, 0, 0.5, 0.35, 0.5, { tint: 0xf4ece0 });
    kit.hull(f, 'limestoneTower', frustum(0.3, 0.03, 1.2, 4), 0.25, 0.35, 0.25, { turn: rotY(Math.PI / 4), tint: 0xf4ece0 });
  }
  const bell = bellFrame(kit, lines[20]);
  kit.close();
  return bell;
}

/** The bell frame on the belfry floor, and the bell under its headstock. */
function bellFrame(kit: Kit, floor: number): P {
  const [cx, , cz] = CHURCH.bell;
  const f = new Frame([cx, floor, cz]);
  const oak = 0x9a8878;
  const post = 1.8;
  for (const [x, z] of [
    [-0.9, -0.7],
    [0.9, -0.7],
    [-0.9, 0.7],
    [0.9, 0.7],
  ])
    kit.box(f, 'oak', x - 0.1, 0, z - 0.1, 0.2, post, 0.2, { tint: vary(oak, 0.05, kit.rand) });
  for (const z of [-0.7, 0.7]) kit.box(f, 'oak', -1.0, post, z - 0.1, 2.0, 0.2, 0.2, { tint: vary(oak, 0.05, kit.rand) });
  kit.box(f, 'oak', -0.15, post + 0.2, -0.7, 0.3, 0.3, 1.4, { tint: oak });
  // The bell: rings of its profile, hulled; its crown flat against the headstock
  const profile: Array<[number, number]> = [
    [0, 0.56],
    [0.1, 0.53],
    [0.45, 0.4],
    [0.8, 0.3],
    [0.88, 0.26],
  ];
  const pts: V3[] = profile.flatMap(([y, r]) => cylinder(r, 0, 16).slice(0, 16).map(([x, , z]) => [x, y, z] as V3));
  const mouth = post + 0.2 - 0.88;
  CHURCH.bell[1] = floor + mouth;
  return kit.hull(f, 'bronze', pts, 0, mouth, 0, { smooth: 0.5 });
}

/** The nave: ashlar walls with three windows a side between buttresses, gables, the roof, pews and an altar. */
export function nave(kit: Kit): void {
  kit.part('nave');
  const { x0, z0, x1, z1 } = CHURCH.nave;
  const t = 0.9;
  const lines = courses(0, 10, 0.75);
  const span = z1 - z0;
  const L = x1 - x0;
  const pitch = (52 * Math.PI) / 180;
  const tp = Math.tan(pitch);
  const win = (u: number): Opening => ({ u0: u - 0.7, u1: u + 0.7, sill: lines[3], spring: lines[7], arch: { ring: 0.35, count: 10, pointed: true } });
  const north = [4, 8, 12].map(win);
  const south = [4, 8, 12].map((u) => win(L - u));
  // A course lower than the side windows: its taller head clears the wall top (7.5)
  const east = [{ u0: span / 2 - 0.8, u1: span / 2 + 0.8, sill: lines[3], spring: lines[7], arch: { ring: 0.4, count: 10, pointed: true } }];
  const all = sides(x0, z0, x1, z1);
  const openings = { n: north, s: south, e: east, w: [] as Opening[] };
  const amber = [0xf0d8a8, 0xd8ecd0];
  for (const key of ['n', 'e', 's', 'w'] as const) {
    const { f, length } = all[key];
    const through = key === 'n' || key === 's' ? 0 : 1;
    coursedWall(kit, f, { material: 'limestone', length, thickness: t, lines, block: [1.2, 1.6], openings: openings[key], tint: STONE, ends: (k) => ((k + through) % 2 === 0 ? [0, length] : [t, length - t]) });
    openings[key].forEach((o, i) => archGlass(kit, f, o, 0.4, amber[i % 2]));
    if (key === 'e' || key === 'w') {
      // The gable over it, coursed and cut to the roof's underside
      const top = 7.5 + 0.05;
      coursedWall(kit, f, {
        material: 'limestone',
        length,
        thickness: t,
        lines: courses(7.5, 8, 0.75),
        block: [1.2, 1.6],
        tint: STONE,
        under: [
          [-tp, 1, top],
          [tp, 1, top + span * tp],
        ],
      });
    }
    if (key === 'n' || key === 's') {
      // Buttresses between the bays, stepping back at 4.5
      for (const u of [2, 6, 10, 14]) {
        const bu = key === 'n' ? u : L - u;
        for (let k = 0; k < 9; k++) {
          const out = k < 6 ? 1.0 : 0.6;
          kit.box(f, 'limestone', bu - 0.4, lines[k], -out, 0.8, 0.75, out, { tint: vary(STONE, 0.06, kit.rand) });
        }
        kit.prism(f.sub(bu, lines[9], 0, -Math.PI / 2), 'limestone', [[0, 0], [0.6, 0], [0, 0.5]], -0.4, 0.8, { tint: vary(STONE, 0.06, kit.rand) });
      }
    }
  }
  roof(kit, new Frame([x0, 7.5, z0]), { length: L, span, pitch, gables: [false, false], ends: [t, t], oak: 0x8a7868, plaster: 0xffffff, tile: 0xe8c8b8, verge: [0.15, 0.25] });
  // Inside: pews, an altar
  const inside = new Frame([x0 + t, 0, z0 + t]);
  for (let i = 0; i < 6; i++) {
    const x = 2.2 + Math.floor(i / 2) * 2.2;
    const z = i % 2 ? 4.3 : 0.6;
    for (const dz of [0, 1.1]) kit.box(inside, 'boards', x, 0, z + dz, 0.45, 0.48, 1.1, { tint: vary(0x8a6a50, 0.05, kit.rand) });
  }
  kit.box(inside, 'limestone', L - 2 * t - 1.6, 0, span / 2 - t - 0.8, 1.0, 0.95, 1.6, { tint: 0xf4ece0 });
  // The churchyard's headstones: round-headed or gabled, of different heights, leaning as old ones do
  for (let i = 0; i < 8; i++) {
    const f = new Frame([26 + (i % 4) * 2.6 + kit.range(-0.4, 0.4), 0, 4.2 + Math.floor(i / 4) * 3.2 + kit.range(-0.3, 0.3)], kit.range(-0.25, 0.25));
    const lean = kit.range(-0.12, 0.12);
    const h = kit.range(0.6, 0.9);
    const w = kit.range(0.42, 0.55);
    const shoulder = h - w / 2;
    // The head: a half circle in four, or a gable
    const head: Pt[] = i % 3 === 2 ? [[w / 2, h]] : [0.25, 0.5, 0.75].map((t) => [w / 2 - (Math.cos(Math.PI * t) * w) / 2, shoulder + (Math.sin(Math.PI * t) * w) / 2] as Pt);
    const outline: Pt[] = [[0, 0], [w, 0], [w, shoulder], ...head.reverse(), [0, shoulder]];
    // Leaning: each point slid by its height
    kit.prism(f, 'limestone', outline.map(([u, v]) => [u + (lean * v) / h, v] as Pt), 0, 0.12, { tint: vary(0xd0c8b4, 0.08, kit.rand) });
  }
  kit.close();
}

function pairs(xs: number[]): Array<[number, number]> {
  return xs.slice(0, -1).map((x, i) => [x, xs[i + 1]]);
}
