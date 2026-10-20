// The square's furniture: market stalls with striped awnings either side of the lane, each selling
// something, the well, the market cross, crates, hay, the chicken coop, a woodpile, a trough, the
// pillory, the low wall by the road out, and the props (barrels, handcarts, the hay wagon, baskets
// of apples) set where nothing stands.

import { add, arcBlock, cylinder, type Destruction, frustum, type PropModel, type Q, random, rotate, type V3 } from '../../../lib/index.ts';
import { Frame, type Kit, type P, rotZ, vary, yaw } from './kit.ts';
import { courses, coursedWall, ring } from './masonry.ts';

/** Cloth dyes: madder red, woad blue, weld yellow, green; and undyed. */
const DYES = [0xa8402e, 0x3f5d8a, 0xd2a845, 0x5d7a45, 0xa8402e, 0x3f5d8a, 0x5d7a45, 0xd2a845];
const UNDYED = 0xe2d8c0;

export const WELL: V3 = [-5, 0, -6];
const CROSS: V3 = [6.5, 0, -5];
export const COOP: V3 = [13.3, 0, 16];

/** Where a counter's top is (for the baskets): its middle and the way along it. */
export interface Counter {
  at: V3;
  along: V3;
  ware: Ware;
}

/** What a stall sells. */
type Ware = 'fruit' | 'roots' | 'cloth' | 'pots';
const WARES: Ware[] = ['fruit', 'roots', 'cloth', 'pots', 'fruit', 'roots', 'cloth', 'pots'];

/**
 * A stall in `f`: u along its counter (0–3), w in from its front (0–1.6). Posts, side beams
 * following the awning, a striped awning drooping past the front posts with a scalloped valance,
 * a counter on trestles, its wares, crates.
 */
function stall(kit: Kit, f: Frame, dye: number, ware: Ware): Counter {
  const oak = 0xc8b8a0;
  // The awning falls from 2.65 at the back to 2.0 at the front posts, and on out over the lane
  const slope = 0.65 / 1.6;
  const at = (w: number) => 2.0 + slope * w;
  // Posts, their tops cut to the awning's slope
  for (const u of [0, 2.9]) {
    const s = f.sub(u + 0.1, 0, 0, -Math.PI / 2);
    for (const [w0, w1] of [
      [0, 0.1],
      [1.5, 1.6],
    ])
      kit.prism(s, 'oak', [[w0, 0], [w1, 0], [w1, at(w1)], [w0, at(w0)]], 0, 0.1, { tint: vary(oak, 0.06, kit.rand), lay: 'grain', grain: 0 });
    // A side beam along the post tops
    kit.prism(s, 'oak', [[0, at(0)], [1.6, at(1.6)], [1.6, at(1.6) + 0.1], [0, at(0) + 0.1]], 0, 0.1, { tint: vary(oak, 0.06, kit.rand), lay: 'grain', grain: Math.atan2(-1.6, 0.2) });
  }
  // The awning: three strips on the beams, alternating dyed and undyed; past the front posts each
  // droops (a second, steeper piece), and a valance of scallops hangs from its edge
  const s = f.sub(0, 0, 0, -Math.PI / 2);
  const top = (w: number) => at(w) + 0.1;
  const edge = -0.45;
  const droop = 0.09;
  const t = 0.03;
  for (let i = 0; i < 3; i++) {
    const tint = i % 2 ? UNDYED : dye;
    kit.prism(s, 'cloth', [[0, top(0)], [1.6, top(1.6)], [1.6, top(1.6) + t], [0, top(0) + t]], -(i + 1), 1, { tint });
    const low = top(edge) - droop;
    kit.prism(s, 'cloth', [[edge, low], [0, top(0)], [0, top(0) + t], [edge, low + t]], -(i + 1), 1, { tint });
    for (let k = 0; k < 4; k++) {
      const u0 = i + k * 0.25;
      kit.prism(f, 'cloth', [[u0, low + t], [u0, low - 0.1], [u0 + 0.125, low - 0.17], [u0 + 0.25, low - 0.1], [u0 + 0.25, low + t]], edge - 0.02, 0.02, { tint: k % 2 ? tint : vary(tint, 0.06, kit.rand) });
    }
  }
  // Trestles and the counter
  for (const u of [0.45, 2.47]) kit.box(f, 'boards', u, 0, 0.15, 0.08, 0.84, 0.8, { tint: vary(0xb09a80, 0.06, kit.rand) });
  kit.box(f, 'boards', 0.1, 0.84, 0.1, 2.8, 0.06, 0.9, { tint: vary(0xc0aa90, 0.05, kit.rand) });
  wares(kit, f, ware);
  // Crates behind and beside
  crate(kit, f, 0.9, 0, 1.0, 0.45);
  if (kit.rand() < 0.7) crate(kit, f, 1.6, 0, 0.95, 0.6);
  return { at: f.at(1.5, 0.9, 0.55), along: [Math.cos(f.a), 0, -Math.sin(f.a)], ware };
}

/** Produce: cabbages, turnips, onions, leeks' white, carrots; apples and pears for the fruit stalls. */
const ROOTS = [0x6f8f3a, 0x8aa048, 0xe8e0c8, 0xb07898, 0xc8904a, 0xd88a3a];
const FRUIT = [0xb8402a, 0xc85a30, 0xa8b040, 0xd0a040];

/** What a stall sells, on its counter (top at 0.9) and in front of it. */
function wares(kit: Kit, f: Frame, ware: Ware): void {
  const v = 0.9;
  if (ware === 'roots' || ware === 'fruit') {
    // Shallow trays heaped with produce; the fruit stalls also have baskets (props) between
    const trays = ware === 'roots' ? [0.2, 1.1, 2.0] : [1.1];
    for (const u0 of trays) {
      kit.box(f, 'boards', u0, v, 0.2, 0.75, 0.06, 0.6, { tint: vary(0x9a8468, 0.06, kit.rand) });
      const colours = ware === 'roots' ? ROOTS : FRUIT;
      const c = colours[Math.floor(kit.rand() * colours.length)];
      heap(kit, f, u0, v + 0.06, 0.2, 0.75, 0.6, ware === 'roots' ? 0.075 : 0.05, c);
    }
  } else if (ware === 'cloth') {
    // Folded bolts in stacks, each its own dye
    for (const u0 of [0.2, 0.85, 1.5, 2.15]) {
      let h = v;
      const n = 2 + Math.floor(kit.rand() * 3);
      for (let k = 0; k < n; k++) {
        const th = kit.range(0.07, 0.1);
        kit.box(f, 'cloth', u0 + kit.range(-0.02, 0.02), h, 0.25, 0.55, th, 0.45, { tint: vary(DYES[Math.floor(kit.rand() * 4)], 0.12, kit.rand) });
        h += th;
      }
    }
  } else {
    // Pots and jugs on the counter, more on the ground before it
    for (let u = 0.25; u < 2.75; u += kit.range(0.26, 0.34)) pot(kit, f, u, v, kit.range(0.35, 0.75));
    for (let u = 0.3; u < 2.7; u += kit.range(0.3, 0.45)) pot(kit, f, u, 0, kit.range(-0.25, -0.12));
  }
}

/** A heap of produce on a tray: a layer of small rounded pieces, a few more on top, pegged to those under them. */
function heap(kit: Kit, f: Frame, u0: number, v: number, w0: number, su: number, sw: number, r: number, tint: number): void {
  const d = 2 * r + 0.004;
  const nu = Math.floor((su - 0.04) / d);
  const nw = Math.floor((sw - 0.04) / d);
  // Round (an icosphere of 42 points, a little squashed), flat underneath where it sits (wide
  // enough to bond to the tray)
  const shape: V3[] = SPHERE.map(([x, y, z]) => [x * r, Math.max(0, y * 0.88 + 0.58) * r, z * r]);
  const piece = (u: number, w: number, y: number) => kit.hull(f, 'produce', shape, u, y, w, { tint: vary(tint, 0.06, kit.rand), smooth: 0.6 });
  const under: P[][] = [];
  for (let i = 0; i < nu; i++) {
    under.push([]);
    for (let j = 0; j < nw; j++) under[i].push(piece(u0 + 0.02 + r + i * d, w0 + 0.02 + r + j * d, v));
  }
  for (let i = 0; i + 1 < nu; i += 2)
    for (let j = 0; j + 1 < nw; j += 2) {
      // High enough to clear the four under it (they're round now)
      const p = piece(u0 + 0.02 + r + (i + 0.5) * d, w0 + 0.02 + r + (j + 0.5) * d, v + 1.3 * r);
      for (const q of [under[i][j], under[i + 1][j], under[i][j + 1], under[i + 1][j + 1]]) kit.bond(p, q, 0.001);
    }
}

/** A solid of revolution through rings of (height, radius), 16 sides: a pot's belly, a jug's neck. */
function turned(rings: Array<[number, number]>): V3[] {
  return rings.flatMap(([y, r]) => Array.from({ length: 16 }, (_, i): V3 => [r * Math.cos((i * Math.PI) / 8), y, r * Math.sin((i * Math.PI) / 8)]));
}

/** A pot or a jug (fired clay, so it shatters): a turned belly and a rim, standing at (u, v, w) in `f`. */
function pot(kit: Kit, f: Frame, u: number, v: number, w: number): void {
  const tint = vary(kit.rand() < 0.5 ? 0xd8a080 : 0xb87858, 0.08, kit.rand);
  if (kit.rand() < 0.5) {
    const body = kit.hull(f, 'tile', turned([[0, 0.07], [0.05, 0.1], [0.11, 0.105], [0.16, 0.085]]), u, v, w, { tint, smooth: 0.5 });
    const rim = kit.hull(f, 'tile', turned([[0, 0.085], [0.015, 0.095], [0.03, 0.092]]), u, v + 0.16, w, { tint, smooth: 0.5 });
    kit.bond(body, rim, 0.01);
  } else {
    const body = kit.hull(f, 'tile', turned([[0, 0.065], [0.05, 0.088], [0.1, 0.09], [0.14, 0.07]]), u, v, w, { tint, smooth: 0.5 });
    const neck = kit.hull(f, 'tile', turned([[0, 0.07], [0.04, 0.05], [0.09, 0.042], [0.1, 0.05], [0.11, 0.047]]), u, v + 0.14, w, { tint, smooth: 0.5 });
    kit.bond(body, neck, 0.01);
  }
}

/** The 42 corners of a twice-divided icosahedron on the unit sphere. */
const SPHERE: V3[] = (() => {
  const t = (1 + Math.sqrt(5)) / 2;
  const ico: V3[] = [[-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0], [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t], [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1]];
  const unit = ([x, y, z]: V3): V3 => {
    const l = Math.hypot(x, y, z);
    return [x / l, y / l, z / l];
  };
  const pts = ico.map(unit);
  // The midpoint of each edge (corners 2 apart before scaling), pushed out to the sphere
  for (let i = 0; i < 12; i++)
    for (let j = i + 1; j < 12; j++) {
      const [a, b] = [ico[i], ico[j]];
      if (Math.abs(Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) - 2) < 1e-6) pts.push(unit([a[0] + b[0], a[1] + b[1], a[2] + b[2]]));
    }
  return pts;
})();

/** A sack of grain or flour, slumped (cloth), standing in `f` at (u, 0, w). */
function sack(kit: Kit, f: Frame, u: number, w: number, turn: number): void {
  const pts: V3[] = [];
  for (const [y, a, b] of [
    [0, 0.2, 0.15],
    [0.22, 0.23, 0.18],
    [0.42, 0.17, 0.13],
    [0.52, 0.06, 0.05],
  ])
    for (let k = 0; k < 6; k++) {
      const t = (k / 6) * Math.PI * 2 + turn;
      pts.push([a * Math.cos(t), y, b * Math.sin(t)]);
    }
  kit.hull(f, 'cloth', pts, u, 0, w, { tint: vary(0xc8b088, 0.08, kit.rand), smooth: 1.1 });
}

/** Loose hay heaped up (one soft hull), `r` across, on the ground at `f`. */
function heapOfHay(kit: Kit, f: Frame, r: number): void {
  const pts: V3[] = [];
  for (const [y, k] of [
    [0, 1],
    [0.3 * r, 0.85],
    [0.55 * r, 0.5],
    [0.68 * r, 0.15],
  ])
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2 + y;
      pts.push([Math.cos(a) * r * k * (0.9 + 0.2 * kit.rand()), y, Math.sin(a) * r * k * 0.8]);
    }
  kit.hull(f, 'hay', pts, 0, 0, 0, { tint: vary(0xf0e0c0, 0.06, kit.rand), smooth: 1.0 });
}

/** A crate: a boards box (in `f`, at its corner). */
function crate(kit: Kit, f: Frame, u: number, v: number, w: number, size: number): P {
  return kit.box(f, 'boards', u, v, w, size, size * 0.85, size, { tint: vary(0xd0b898, 0.08, kit.rand) });
}

/** The stalls either side of the lane; returns their counters. */
export function stalls(kit: Kit): Counter[] {
  kit.part('stalls');
  // West row faces east (+x) from x = -4.5; east row faces west from x = 6
  const frames = [
    ...[-1, 2.6, 6.2].map((z) => new Frame([-4.5, 0, z - 1.5], -Math.PI / 2)),
    ...[1, 4.6, 8.2].map((z) => new Frame([6, 0, z + 1.5], Math.PI / 2)),
    // A fourth each side, toward the road in
    new Frame([-4.5, 0, 9.8 - 1.5], -Math.PI / 2),
    new Frame([6, 0, 11.8 + 1.5], Math.PI / 2),
  ];
  const out = frames.map((f, i) => stall(kit, f, DYES[i], WARES[i]));
  // Sacks of grain by the roots stalls, behind the counters
  for (const i of [1, 5])
    for (const [u, w] of [
      [2.55, 1.25],
      [2.6, 1.7],
      [0.45, 1.2],
    ])
      sack(kit, frames[i], u, w, kit.range(0, 1));
  kit.close();
  return out;
}

/** The well: two rubble courses of arc blocks, a limestone coping, posts, a beam, the windlass and bucket, a little roof. */
export function well(kit: Kit): void {
  kit.part('well');
  const f = new Frame(WELL);
  for (let k = 0; k < 2; k++)
    for (let i = 0; i < 8; i++) {
      const a0 = (k * Math.PI) / 8 + (i * Math.PI) / 4;
      kit.hull(f, 'rubble', arcBlock(0.65, 0.95, a0, a0 + Math.PI / 4, 0.45), 0, k * 0.45, 0, { tint: vary(0xffffff, 0.05, kit.rand) });
    }
  ring(kit, f, 0.6, 1.05, 0.9, 0.12, 8, 0, 'limestone', 0xf4ece0);
  const v0 = 1.02;
  const oak = 0xa89480;
  for (const x of [-0.875, 0.725]) kit.box(f, 'oak', x, v0, -0.075, 0.15, 1.8, 0.15, { tint: vary(oak, 0.05, kit.rand) });
  const beam = kit.box(f, 'oak', -1.0, v0 + 1.8, -0.075, 2.0, 0.15, 0.15, { tint: oak });
  // The windlass between the posts, on its side: a drum with a rope wound on it, and a crank outside the east post
  const turn = [0, 0, -Math.SQRT1_2, Math.SQRT1_2] as Q;
  const axle = v0 + 1.0;
  kit.hull(f, 'oak', cylinder(0.11, 0.475, 14), -0.725, axle, 0, { turn, tint: 0x8a7a68, smooth: 0.5 });
  const drum = kit.hull(f, 'oak', cylinder(0.135, 0.5, 14), -0.25, axle, 0, { turn, tint: 0x6a5a48, smooth: 0.5 });
  const east = kit.hull(f, 'oak', cylinder(0.11, 0.475, 14), 0.25, axle, 0, { turn, tint: 0x8a7a68, smooth: 0.5 });
  const arm = kit.box(f, 'oak', 0.875, axle - 0.04, -0.04, 0.05, 0.34, 0.08, { tint: 0x5a4a3a });
  kit.box(f, 'oak', 0.925, axle + 0.24, -0.025, 0.2, 0.05, 0.05, { tint: 0x5a4a3a });
  kit.bond(east, arm, 0.004);
  // The rope down from the drum to the bucket, half down the shaft
  const rope = kit.box(f, 'oak', -0.015, v0 + 0.05, -0.015, 0.03, axle - 0.135 - v0 - 0.05, 0.03, { tint: 0x4a4038 });
  const bucket = kit.hull(f, 'boards', frustum(0.15, 0.18, 0.3, 8), 0, v0 - 0.25, 0, { tint: 0x9a8268, smooth: 0.8 });
  kit.bond(drum, rope, 0.002);
  kit.bond(rope, bucket, 0.002);
  // Two tile slabs over the beam, meeting at a ridge
  const r = new Frame(WELL, Math.PI / 2);
  const pitch = 0.6;
  const slabs: P[] = [];
  for (const side of [-1, 1]) {
    const len = 0.85;
    const cu = side * (Math.cos(pitch) * len * 0.5 + 0.02);
    const cv = v0 + 1.95 + 0.38 - Math.sin(pitch) * len * 0.5;
    slabs.push(kit.tilted(r, 'tile', cu, cv, 0, [len, 0.05, 2.3], -side * pitch, { tint: vary(0xe8c8b8, 0.04, kit.rand), lay: 'own' }));
  }
  for (const s of slabs) kit.bond(s, beam, 0.01);
  kit.bond(slabs[0], slabs[1], 0.01);
  kit.close();
}

/** The market cross: three steps, a socket stone, an octagonal shaft, a small cross on top. */
export function cross(kit: Kit): void {
  kit.part('market cross');
  const f = new Frame(CROSS);
  const stone = () => vary(0xffffff, 0.05, kit.rand);
  for (const [size, v] of [
    [3.0, 0],
    [2.2, 0.3],
  ]) {
    const h = size / 2;
    for (const [x, z] of [
      [-h, -h],
      [0, -h],
      [-h, 0],
      [0, 0],
    ])
      kit.box(f, 'limestone', x, v, z, h, 0.3, h, { tint: stone() });
  }
  kit.box(f, 'limestone', -0.7, 0.6, -0.7, 1.4, 0.3, 1.4, { tint: stone() });
  kit.box(f, 'limestone', -0.35, 0.9, -0.35, 0.7, 0.7, 0.7, { tint: stone() });
  for (const v of [1.6, 2.4]) kit.hull(f, 'limestone', cylinder(0.18, 0.8, 8), 0, v, 0, { tint: stone() });
  kit.box(f, 'limestone', -0.08, 3.2, -0.08, 0.16, 0.62, 0.16, { tint: stone() });
  for (const side of [-1, 1]) kit.box(f, 'limestone', side > 0 ? 0.08 : -0.26, 3.5, -0.07, 0.18, 0.14, 0.14, { tint: stone() });
  kit.close();
}

/** Hay bales by the stable and the wagon, crates about, the coop, the low wall by the road. */
export function yard(kit: Kit): void {
  kit.part('yard');
  const hay = () => vary(0xffffff, 0.06, kit.rand);
  const bale = (x: number, y: number, z: number, along: boolean) => kit.box(new Frame([x, y, z]), 'hay', along ? -0.5 : -0.25, 0, along ? -0.25 : -0.5, along ? 1.0 : 0.5, 0.45, along ? 0.5 : 1.0, { tint: hay() });
  // A stack against the stable's west end, and some before it
  for (const [x, z] of [
    [2.9, 15.6],
    [2.9, 16.65],
    [2.9, 17.7],
  ])
    bale(x, 0, z, false);
  bale(2.9, 0.45, 16.15, false);
  bale(2.9, 0.45, 17.2, false);
  bale(2.9, 0.9, 16.65, false);
  bale(6.2, 0, 13.9, true);
  bale(7.25, 0, 13.9, true);
  bale(6.7, 0.45, 13.9, true);
  // By the hay wagon
  bale(12.3, 0, -12.6, true);
  bale(12.3, 0, -13.15, true);
  bale(12.3, 0.45, -12.9, true);
  // Crates under the hall, by the gate, by W1's shop
  for (const [x, z, s] of [
    [16.2, 6.4, 0.6],
    [16.25, 7.1, 0.45],
    [21.6, 10.2, 0.6],
    [-3.2, -14.7, 0.6],
    [-2.5, -14.7, 0.45],
    [-13.9, -11.8, 0.6],
    [-13.9, -11.1, 0.45],
  ])
    crate(kit, new Frame([x, 0, z]), 0, 0, 0, s);
  crate(kit, new Frame([-3.2, 0.51, -14.7]), 0.07, 0, 0.07, 0.45);
  // Trestle tables under the hall
  for (const z of [7.9, 9.9]) {
    const t = new Frame([18.2, 0, z]);
    for (const u of [0.2, 1.7]) kit.box(t, 'boards', u, 0, 0.1, 0.08, 0.76, 0.6, { tint: vary(0xb09a80, 0.06, kit.rand) });
    kit.box(t, 'boards', 0, 0.76, 0, 2.0, 0.05, 0.8, { tint: vary(0xc0aa90, 0.05, kit.rand) });
  }
  // The coop: a box with a one-slab lean-to roof
  const c = new Frame([COOP[0] - 0.7, 0, COOP[2] - 0.5]);
  kit.box(c, 'boards', 0, 0, 0, 1.4, 0.9, 1.0, { tint: 0x9a8a72 });
  kit.prism(c.sub(0, 0, 0, -Math.PI / 2), 'tile', [[-0.12, 0.9], [1.12, 0.9], [1.12, 1.1], [-0.12, 0.96]], -1.5, 1.6, { tint: 0xd8b0a0, lay: 'own' });
  // Hay heaped either side of the bales by the wagon
  for (const [x, z, r] of [
    [12.4, -10.9, 0.8],
    [13.0, -14.5, 0.7],
  ])
    heapOfHay(kit, new Frame([x, 0, z]), r);
  // A woodpile against the low wall, logs end on
  const pile = new Frame([-13, 0, 18.45]);
  for (let k = 0; k < 3; k++)
    for (let i = 0; i < 10 - k; i++) kit.box(pile, 'oak', i * 0.2 + k * 0.1, k * 0.18, 0, 0.2, 0.18, 0.5, { tint: vary(0x9a7a58, 0.12, kit.rand), lay: 'own' });
  // A horse trough of boards before the stable
  const trough = new Frame([9.2, 0, 13.4]);
  const board = () => ({ tint: vary(0x8a7660, 0.06, kit.rand) });
  for (const u of [0.1, 1.4]) kit.box(trough, 'boards', u, 0, 0, 0.1, 0.25, 0.5, board());
  kit.box(trough, 'boards', 0, 0.25, 0, 1.6, 0.06, 0.5, board());
  for (const w of [0, 0.45]) kit.box(trough, 'boards', 0, 0.31, w, 1.6, 0.3, 0.05, board());
  for (const u of [0, 1.55]) kit.box(trough, 'boards', u, 0.31, 0.05, 0.05, 0.3, 0.4, board());
  // The pillory: a post on a step, its yoke in two halves either side of it
  const pillory = new Frame([11, 0, 3.5]);
  kit.box(pillory, 'limestone', -0.5, 0, -0.5, 1.0, 0.2, 1.0, { tint: vary(0xe8e0d0, 0.04, kit.rand) });
  const post = kit.box(pillory, 'oak', -0.09, 0.2, -0.09, 0.18, 1.75, 0.18, { tint: 0x6a5440 });
  for (const side of [-1, 1]) {
    const yoke = kit.box(pillory, 'oak', side > 0 ? 0.09 : -0.5, 1.38, -0.05, 0.41, 0.24, 0.1, { tint: 0x7a6248 });
    kit.bond(post, yoke, 0.02);
  }
  kit.box(pillory, 'oak', -0.15, 1.95, -0.15, 0.3, 0.06, 0.3, { tint: 0x5a4636 });
  // The low wall either side of the road out to the south-west
  const lines = courses(0, 2, 0.6);
  coursedWall(kit, new Frame([-14, 0, 19]), { material: 'rubble', length: 8, thickness: 0.5, lines, block: [1.4, 1.8], tint: 0xffffff, vary: 0.05 });
  coursedWall(kit, new Frame([-3, 0, 19]), { material: 'rubble', length: 5, thickness: 0.5, lines, block: [1.4, 1.8], tint: 0xffffff, vary: 0.05 });
  kit.close();
}

/** The props, each where nothing stands (any model may be missing), each copy a little lighter or darker, warmer or cooler. */
export function placeProps(d: Destruction, models: Record<string, PropModel>, counters: Counter[]): number {
  const pieces = d.all();
  const rand = random(77);
  let placed = 0;
  const taken: Array<{ min: V3; max: V3 }> = [];
  const bounds = (m: PropModel, at: V3, rotation: Q) => {
    const min: V3 = [Infinity, Infinity, Infinity];
    const max: V3 = [-Infinity, -Infinity, -Infinity];
    for (const p of m.collider) {
      const q = add(at, rotate(rotation, p));
      for (let k = 0; k < 3; k++) {
        min[k] = Math.min(min[k], q[k]);
        max[k] = Math.max(max[k], q[k]);
      }
    }
    return { min, max };
  };
  const overlaps = (a: { min: V3; max: V3 }, b: { min: V3; max: V3 }) => [0, 1, 2].every((k) => a.min[k] < b.max[k] - 0.01 && a.max[k] > b.min[k] + 0.01);
  const put = (name: string, at: V3, rotation: Q, tint = 0.08) => {
    const m = models[name];
    if (!m) return false;
    const b = bounds(m, at, rotation);
    if (taken.some((t) => overlaps(b, t)) || pieces.some((p) => p.state === 'fixed' && overlaps(b, p.bounds))) return false;
    d.addProp({ model: m, material: 'boards', position: at, rotation, tint: vary(0xffffff, tint, rand) });
    taken.push(b);
    placed++;
    return true;
  };
  // Barrels: by the tavern (one lying across two), under the hall, inside the gate, by a stall
  for (const [x, z] of [
    [-13.9, -3.0],
    [-13.9, -2.3],
    [-13.9, -1.6],
    [-13.2, -2.65],
    [-13.9, 0.6],
    [17.0, 8.9],
    [17.7, 8.9],
    [22.8, 6.4],
    [23.3, 7.1],
    [-6.0, -14.4],
    [-5.3, -14.3],
    [-5.7, -13.6],
    [-7.0, 3.3],
    [5.5, 2.9],
  ])
    put('barrel', [x, 0, z], yaw(x * 3.1 + z));
  // Lying across the first two: a quarter turn puts its axis along x, its origin at one end
  put('barrel', [-14.35, 0.9 + 0.322, -2.65], rotZ(-Math.PI / 2));
  // Handcarts: by W1, by the hall, at the road gap
  put('handcart', [-9.5, 0, -10], yaw(-0.6));
  put('handcart', [11, 0, 10.5], yaw(2.4));
  put('handcart', [-2.5, 0, 15.5], yaw(0.4));
  // The hay wagon inside the gate, its pole turned toward it
  put('haywagon', [9, 0, -11], yaw(0.35), 0);
  // Baskets of apples on the fruit stalls' counters, either side of the tray
  counters
    .filter((c) => c.ware === 'fruit')
    .forEach((c, i) => {
      for (const s of [-0.9, 0.9]) put('basket', [c.at[0] + c.along[0] * s, c.at[1], c.at[2] + c.along[2] * s], yaw(i * 1.3 + s));
    });
  return placed;
}

