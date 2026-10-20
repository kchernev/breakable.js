// Shipping containers built from bonded parts: corner posts, rails, floor, roof, corrugated wall
// panels, doors and locking bars. Stacked boxes touch only post to post (the top rails and roof
// stop 2 cm under the post tops), so a stack stands on its twistlocks and nowhere else, and each
// stack stands and falls on its own.

import type { Destruction, Piece, Pose, V3 } from '../../../lib/index.ts';
import { cross, multiply, random, scale, sub } from '../../../lib/index.ts';
import { Frame, split, yaw } from './frame.ts';

export const FT20 = 6.058;
export const FT40 = 12.192;
export const WIDTH = 2.438;
export const STD = 2.591;
const HIGH = 2.896;
/** Frame section, skin thickness, and the skin's inset from the posts' outer faces. */
const C = 0.16;
const T = 0.06;
const INSET = 0.03;
/** The closed doors' inset (their locking bars stand on them). */
const DOOR = 0.05;

/** Faded paints: reds, blues, green, teal, orange, greys (no beige: corrugated, it reads as a timber fence). */
const PALETTE: Array<[number, number]> = [
  [0xb04c3c, 13], [0x8a3c30, 12],
  [0x46699a, 13], [0x34496a, 12],
  [0x55785a, 12], [0x45787a, 6],
  [0xd07a3c, 12],
  [0xa4a6a2, 10], [0xd4d4cc, 8],
];
const REEFER = 0xdcdedb;

export function pickPaint(rand: () => number): number {
  let r = rand() * PALETTE.reduce((s, [, w]) => s + w, 0);
  for (const [c, w] of PALETTE) if ((r -= w) <= 0) return c;
  return PALETTE[0][0];
}

/** One container as built: its pieces and its corner posts (bottom and top halves), to know when it has lost its footing. */
export interface Box {
  pieces: Set<Piece>;
  /** How many pieces it was built of. */
  built: number;
  /** By corner (0: x0 z0, 1: x1 z0, 2: x0 z1, 3: x1 z1): the bottom and top halves of the post. */
  posts: Array<[Piece | null, Piece | null]>;
  /** By corner: where its bottom post stood as built. */
  postAt: V3[];
  /** By corner: the bottom side rail and bottom end rail beside its bottom post. */
  rails: Array<[Piece | null, Piece | null]>;
  /** Where each corner is (its post's foot, in the world). */
  corners: V3[];
  /** The box it stands on (null: the ground, or a spreader), and the one standing on it. */
  under: Box | null;
  over: Box | null;
  /** Let go by tipStacks. */
  tipped: boolean;
  /** An open box's door leaves, each with the post it's hung from and its hinge (world): they swing once a blast shakes them. */
  leaves: Array<{ leaf: Piece; post: Piece; hinge: V3 }>;
}

export interface ContainerOptions {
  /** Where its middle is on the ground or the box under it (x, bottom y, z). */
  at: V3;
  /** Its turn about the vertical (0: its length along x, doors at +x). */
  turn: number;
  length: number;
  height?: number;
  tint: number;
  /** 'open': the door leaves stand swung open beside it. */
  doors?: 'closed' | 'open';
  /** A refrigerated box: the front end is a recessed machinery unit. */
  reefer?: boolean;
  under?: Box | null;
  /** Its texture's offset along the walls (up to 300 m: it picks how rusty the box is). */
  rand: () => number;
}

/** Darker paint for the frame (posts and rails). */
const darker = (c: number, k = 0.82) => {
  const r = ((c >> 16) & 255) * k;
  const g = ((c >> 8) & 255) * k;
  const b = (c & 255) * k;
  return (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(b);
};

export function container(d: Destruction, o: ContainerOptions): Box {
  const L = o.length;
  const W = WIDTH;
  const H = o.height ?? STD;
  // Local frame: x along the length (0 the front end, L the doors), z across, y up from the bottom
  const c = Math.cos(o.turn);
  const s = Math.sin(o.turn);
  // The frame's origin is the box's corner: the middle less half the length and width, turned
  const hx = L / 2;
  const hz = W / 2;
  const origin: V3 = [o.at[0] - (c * hx + s * hz), o.at[1], o.at[2] - (-s * hx + c * hz)];
  const f = new Frame(d, origin, o.turn);
  // The texture frame's floor is the box's (the skin puts rust by height). Each piece's is turned a
  // quarter or a half about the vertical so its faces toward the box's middle face +x or +z (the
  // skin paints them as the inside); a vertical face's map doesn't change with the turn
  const textureFrame = f.pose([o.rand() * 300, 0, o.rand() * 300]);
  const turned = [0, -1, 2, 1].map((k): Pose => ({ position: textureFrame.position, rotation: multiply(f.rotation, yaw((k * Math.PI) / 2)) }));
  const skin = o.tint;
  const frame = darker(o.tint);
  const pieces = new Set<Piece>();
  const leaves: Box['leaves'] = [];
  /** `turn`: the piece's corner of the box (0: x0 z0, 1: x1 z0, 2: x1 z1, 3: x0 z1), as its texture frame's. */
  const add = (material: string, min: V3, max: V3, tint = skin, turn = 0) => {
    const p = f.box(material, min, max, { tint, textureFrame: turned[turn] });
    if (p) pieces.add(p);
    return p;
  };
  /** The turn of a piece along x on the side at z0 (0, or 2 at the far side), or along z at x0. */
  const far = (z0: number) => (z0 > W / 2 ? 2 : 0);
  const end = (x0: number) => (x0 > L / 2 ? 2 : 0);
  const xs = split(C, L - C, 2.05);
  const topRail = H - 0.18;
  const roofTop = H - 0.02;

  // Corner posts in two halves
  const posts: Box['posts'] = [];
  for (const [x0, z0, turn] of [
    [0, 0, 0],
    [L - C, 0, 1],
    [0, W - C, 3],
    [L - C, W - C, 2],
  ]) {
    const lo = add('container', [x0, 0, z0], [x0 + C, H / 2, z0 + C], frame, turn);
    const hi = add('container', [x0, H / 2, z0], [x0 + C, H, z0 + C], frame, turn);
    posts.push([lo, hi]);
  }
  const rails: Box['rails'] = [
    [null, null],
    [null, null],
    [null, null],
    [null, null],
  ];
  xs.forEach(([x0, x1], i) => {
    // Bottom side rails, the floor between them; top side rails, the roof between them
    for (const [z0, z1] of [
      [0, C],
      [W - C, W],
    ]) {
      const rail = add('container', [x0, 0, z0], [x1, C, z1], frame, far(z0));
      // The first and last lengths are beside the posts: corners 0 and 1 on the z = 0 side
      const k = z0 === 0 ? 0 : 2;
      if (i === 0) rails[k][0] = rail;
      if (i === xs.length - 1) rails[k + 1][0] = rail;
      add('container', [x0, topRail, z0], [x1, roofTop, z1], frame, far(z0));
    }
    add('container', [x0, 0, C], [x1, C, W - C], frame);
    add('container', [x0, H - 0.08, C], [x1, roofTop, W - C]);
    // Side walls, two rows, set in from the posts' faces
    const mid = (C + topRail) / 2;
    for (const [z0, z1] of [
      [INSET, INSET + T],
      [W - INSET - T, W - INSET],
    ])
      for (const [y0, y1] of [
        [C, mid],
        [mid, topRail],
      ])
        add('container', [x0, y0, z0], [x1, y1, z1], skin, far(z0));
  });
  // End rails, bottom and top
  for (const x0 of [0, L - C]) {
    const rail = add('container', [x0, 0, C], [x0 + C, C, W - C], frame, end(x0));
    for (const k of x0 === 0 ? [0, 2] : [1, 3]) rails[k][1] = rail;
    add('container', [x0, topRail, C], [x0 + C, roofTop, W - C], frame, end(x0));
  }
  const mid = (C + topRail) / 2;
  const halves: Array<[number, number]> = [
    [C, W / 2],
    [W / 2, W - C],
  ];
  const rows: Array<[number, number]> = [
    [C, mid],
    [mid, topRail],
  ];
  // The front end: a plain wall, or a reefer's recessed unit with two fan housings
  if (o.reefer) {
    for (const [z0, z1] of halves) for (const [y0, y1] of rows) add('steel', [0.1, y0, z0], [C, y1, z1], 0x3c3f42);
    for (const zc of [W * 0.3, W * 0.7]) add('steel', [0.03, mid + 0.15, zc - 0.32], [0.1, mid + 0.79, zc + 0.32], 0x2a2c2e);
    add('steel', [0.03, C + 0.25, W * 0.2], [0.1, C + 0.7, W * 0.8], 0x55595c);
  } else for (const [z0, z1] of halves) for (const [y0, y1] of rows) add('container', [INSET, y0, z0], [INSET + T, y1, z1]);

  // The doors: two leaves of two rows, locking bars on them; or the leaves swung open beside it.
  // The leaves are set in further than the walls, so the bars stand inside the posts' faces. The
  // bars are stout steel (8 kg): drawn true to size in the box's light sheet they'd weigh 1 kg, light
  // enough for a box landing on one to press it into the deck
  if ((o.doors ?? 'closed') === 'closed') {
    for (const [z0, z1] of halves) for (const [y0, y1] of rows) add('container', [L - DOOR - T, y0, z0], [L - DOOR, y1, z1], skin, 2);
    for (const k of [0.16, 0.36, 0.64, 0.84]) add('steel', [L - DOOR, C + 0.05, W * k - 0.03], [L - 0.002, topRail - 0.05, W * k + 0.03], darker(o.tint, 0.65), 2);
  } else {
    // Each leaf swung 110° out from its post, held there by its hinge (a bond until a blast shakes it)
    for (const side of [0, 1]) {
      const leaf = W / 2 - C;
      const swing = (110 * Math.PI) / 180;
      const dir: V3 = [Math.sin(swing), 0, side ? -Math.cos(swing) : Math.cos(swing)];
      const h = topRail - C;
      const hinge: V3 = [L + 0.03 * dir[0], C + h / 2, (side ? W : 0) + 0.03 * dir[2]];
      const centre: V3 = [hinge[0] + (dir[0] * leaf) / 2, hinge[1], hinge[2] + (dir[2] * leaf) / 2];
      // Its inside (toward the box's middle as it stood shut) faces +x or +z in its texture frame
      const q = f.boxAt('container', centre, [leaf, h, T], yaw(-Math.atan2(dir[2], dir[0])), { tint: skin, bond: false, textureFrame: turned[side ? 2 : 0] });
      const post = posts[side ? 3 : 1][0];
      if (q && post) {
        pieces.add(q);
        d.bond(q, post, 0.01);
        leaves.push({ leaf: q, post, hinge: f.at(hinge) });
      }
    }
  }
  const corners = ([[0, 0], [L, 0], [0, W], [L, W]] as Array<[number, number]>).map(([x, z]) => f.at([x, 0, z]));
  const postAt = posts.map(([lo]) => [...(lo?.pose.position ?? [0, 0, 0])] as V3);
  const box: Box = { pieces, built: pieces.size, posts, postAt, rails, corners, under: o.under ?? null, over: null, tipped: false, leaves };
  if (box.under) box.under.over = box;
  return box;
}

/** A stack of boxes, each a little off the one under it (as stacked by a crane). */
export function stack(d: Destruction, at: V3, turn: number, length: number, heights: number[], tints: number[], rand: () => number, extra: Partial<ContainerOptions> = {}): Box[] {
  const boxes: Box[] = [];
  let y = at[1];
  let under: Box | null = null;
  // Posts must overlap by at least 10 cm: a small turn moves the ends by half the length times it
  const most = 0.025;
  for (let k = 0; k < heights.length; k++) {
    const jitter = k === 0 ? 0 : 1;
    const t = turn + jitter * (rand() - 0.5) * ((2 * most) / length);
    const off: V3 = [jitter * (rand() - 0.5) * 0.05, 0, jitter * (rand() - 0.5) * 0.05];
    const box = container(d, { at: [at[0] + off[0], y, at[2] + off[2]], turn: t, length, height: heights[k], tint: tints[k], under, rand, ...extra });
    boxes.push(box);
    under = box;
    y += heights[k];
  }
  return boxes;
}

/**
 * The pair on the quay edge: a box on the kerb line with a second on it that the crane landed
 * badly, 1.4 m out over the water. That one bears on the lower box's seaward posts with its end
 * rails, its middle past them, held only by its landward twistlocks (hand bonds to the lower box's
 * end rails, 2 cm under its posts). Shake the pair and it goes over (see `jolt`).
 */
export interface QuayPair {
  lower: Box;
  upper: Box;
  /** Let go. */
  gone: boolean;
}

const QUAY_PAIR = { x: -29.2, z: -29.3, overhang: 1.4 };

function quayPair(d: Destruction, rand: () => number): QuayPair {
  const { x, z, overhang } = QUAY_PAIR;
  const lower = container(d, { at: [x + FT20 / 2, 0, z + WIDTH / 2], turn: 0, length: FT20, height: STD, tint: pickPaint(rand), rand });
  const upper = container(d, { at: [x + FT20 / 2, STD, z - overhang + WIDTH / 2], turn: 0, length: FT20, height: STD, tint: pickPaint(rand), rand });
  // Its landward posts (corners 2 and 3) on the lower box's top end rails: the rails are the
  // lower box's pieces nearest under them
  for (const k of [2, 3]) {
    const post = upper.posts[k][0];
    if (!post) continue;
    const at = post.pose.position;
    let best: Piece | null = null;
    for (const p of lower.pieces) {
      const q = p.pose.position;
      if (q[1] > STD - 0.3 && q[1] < STD && Math.abs(q[0] - at[0]) < 0.1 && (!best || Math.abs(q[2] - at[2]) < Math.abs(best.pose.position[2] - at[2]))) best = p;
    }
    if (best) d.bond(post, best, C * C);
  }
  return { lower, upper, gone: false };
}

/**
 * Let a box go with what's stacked on it, as one section turning over the edge through `pivot` (at
 * its foot) toward `toward` (level) at `rate` rad/s, pushed `push` m/s that way: a lurch as the
 * frame under it gives.
 */
function tip(d: Destruction, box: Box, pivot: V3, toward: V3, rate: number, push: number): void {
  const pieces: Piece[] = [];
  for (let b: Box | null = box; b; b = b.over) {
    b.tipped = true;
    for (const p of b.pieces) if (p.state === 'fixed') pieces.push(p);
  }
  const l = Math.hypot(toward[0], toward[2]) || 1;
  const u: V3 = [toward[0] / l, 0, toward[2] / l];
  // About up × toward: the side toward `toward` goes down
  const spin: V3 = [u[2] * rate, 0, -u[0] * rate];
  let mass = 0;
  const middle: V3 = [0, 0, 0];
  for (const p of pieces) {
    mass += p.mass;
    for (let k = 0; k < 3; k++) middle[k] += p.pose.position[k] * p.mass;
  }
  const v = cross(spin, sub(scale(middle, 1 / (mass || 1)), pivot));
  d.release(pieces, [v[0] + u[0] * push, v[1], v[2] + u[2] * push], spin);
}

/**
 * The quay pair goes over once either box has lost a piece: the upper box tips seaward over the
 * lower box's seaward posts. Its middle is only 0.18 m past them, so it goes briskly (turned
 * slowly, it stalled on the lower box's roof edge), pushed out over the water.
 */
export function jolt(d: Destruction, pair: QuayPair): void {
  if (pair.gone) return;
  const shaken = (b: Box) => [...b.pieces].some((p) => p.state !== 'fixed');
  if (!shaken(pair.lower) && !shaken(pair.upper)) return;
  pair.gone = true;
  const [c0, c1] = pair.lower.corners;
  tip(d, pair.upper, [(c0[0] + c1[0]) / 2, STD, c0[2]], [0, 0, -1], 2, 1.5);
}

/** Block A (three bays under and beside the crane), Block B (east of the lane), the open box; and the quay pair. */
export function buildContainers(d: Destruction, seed = 21): { boxes: Box[]; pair: QuayPair } {
  const rand = random(seed);
  const boxes: Box[] = [];
  const heightOf = () => (rand() < 0.3 ? HIGH : STD);
  const put = (at: V3, turn: number, length: number, n: number, extra: Partial<ContainerOptions> = {}, fixedHeight?: number) => {
    if (n <= 0) return [];
    const heights = Array.from({ length: n }, () => fixedHeight ?? heightOf());
    const tints = heights.map(() => pickPaint(rand));
    const s = stack(d, at, turn, length, heights, tints, rand, extra);
    boxes.push(...s);
    return s;
  };

  // Block A: rows along x at these z centres
  const rows = [-18.8, -16.06, -13.32, -10.58, -7.84];
  // B1: 40 ft boxes
  [3, 2, 2, 1, 2].forEach((n, r) => put([-33.5 + FT40 / 2, 0, rows[r]], 0, FT40, n));
  // B2 under the crane (r2 empty: its working slot); r3 standard height so the hanging box clears it
  [2, 3, 0, 2, 1].forEach((n, r) => put([-20.9 + FT40 / 2, 0, rows[r]], 0, FT40, n, {}, r === 3 ? STD : undefined));
  // B3: two 20 ft boxes a row
  const b3: Array<[number, number]> = [
    [2, 2],
    [2, 1],
    [1, 0],
    [2, 1],
    [1, 1],
  ];
  b3.forEach(([a, b], r) => {
    put([-8.3 + FT20 / 2, 0, rows[r]], 0, FT20, a);
    put([-8.3 + FT20 + 0.1 + FT20 / 2, 0, rows[r]], 0, FT20, b);
  });

  // Block B line 1: 20 ft boxes along z, doors south, stepped up and down
  [1, 2, 3, 4, 3, 1].forEach((n, i) => put([14 + 2.74 * i, 0, -5.5 + FT20 / 2], -Math.PI / 2, FT20, n));
  // Line 2: 40 ft along z; two reefers, their units at the south end
  [1, 0, 2, 1, 1].forEach((n, i) => {
    const reefer = i === 2 || i === 4;
    if (reefer) {
      const heights = Array.from({ length: n }, () => HIGH);
      boxes.push(...stack(d, [14 + 2.74 * i, 0, 1 + FT40 / 2], Math.PI / 2, FT40, heights, heights.map(() => REEFER), rand, { reefer: true }));
    } else put([14 + 2.74 * i, 0, 1 + FT40 / 2], -Math.PI / 2, FT40, n);
  });

  // The open box, doors swung open to the east
  put([-15.5 + FT20 / 2, 0, 3.2 + WIDTH / 2], 0, FT20, 1, { doors: 'open' }, STD);
  const pair = quayPair(d, rand);
  boxes.push(pair.lower, pair.upper);
  return { boxes, pair };
}

/** How many boxes stand on this one, itself included. */
function height(b: Box): number {
  let n = 0;
  for (let c: Box | null = b; c; c = c.over) n++;
  return n;
}

/** A corner of a box is lost when its bottom post is, or has moved, or both rails beside it are gone. */
function lostCorner(b: Box, k: number): boolean {
  const post = b.posts[k][0];
  if (post?.state !== 'fixed') return true;
  const p = post.pose.position;
  const q = b.postAt[k];
  if (Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]) > 0.05) return true;
  const [side, end] = b.rails[k];
  return side?.state !== 'fixed' && end?.state !== 'fixed';
}

/** The share of a box's pieces no longer standing. */
function lostShare(b: Box): number {
  let n = 0;
  for (const p of b.pieces) if (p.state !== 'fixed') n++;
  return n / b.built;
}

/**
 * Stacks tip. The library's weighing tips a piece whose weight has moved off what it stands on, but
 * a box on three posts still has its weight over them, and a corner post standing alone still
 * carries. A box goes when it has lost both corners of an end or of a side (its own, or those it
 * stands on), or a single corner with another box on it: a box on three corners racks under that
 * load, and the end of the box under it over the lost corner buckles, so the box has nothing under
 * that end (it goes lengthways, out of the row, rather than onto the stack beside it). A corner is
 * lost with its post, or with both bottom rails beside it (the post alone doesn't carry a stack). A
 * stack of three or more also goes when its bottom box has lost over 30% of its pieces, over the
 * side it lost most from. The box goes with what's on it, tipping over its far side.
 */
export function tipStacks(d: Destruction, boxes: Box[]): void {
  const holds = (b: Box, corner: number): boolean => {
    if (lostCorner(b, corner) || b.posts[corner][1]?.state !== 'fixed') return false;
    return b.under ? holds(b.under, corner) : true;
  };
  const mean = (ps: V3[]): V3 => ps.reduce((s, c) => [s[0] + c[0] / ps.length, s[1] + c[1] / ps.length, s[2] + c[2] / ps.length] as V3, [0, 0, 0] as V3);
  for (const b of boxes) {
    const under = b.under;
    if (!under || b.tipped) continue;
    const lows = b.posts.map((p) => p[0]);
    // Still standing (its own bottom posts that are left are fixed)
    if (!lows.some((p) => p?.state === 'fixed')) continue;
    const ok = [0, 1, 2, 3].map((k) => !lostCorner(b, k) && holds(under, k));
    let lost = [0, 1, 2, 3].filter((k) => !ok[k]);
    let side = (!ok[0] && !ok[2]) || (!ok[1] && !ok[3]) || (!ok[0] && !ok[1]) || (!ok[2] && !ok[3]);
    // The second box of a stack of three or more, on a bottom box that's mostly gone
    if (!side && !under.under && height(under) >= 3 && lostShare(under) > 0.3) {
      lost = crushedSide(under);
      side = true;
    }
    if (!side && !(lost.length && height(b) >= 2)) continue;
    let edge = lost.map((k) => b.corners[k]);
    if (!side) {
      // The end the corner is on (corners 0, 2 are one, 1, 3 the other) buckles, and it tips
      // lengthways over the far end: out of the row, not onto the stack beside it
      const k = lost[0];
      edge = [b.corners[k], b.corners[k ^ 2]];
      buckle(d, under, edge[0], edge[1], WIDTH - 0.35);
    }
    const mid = mean(b.corners);
    const at = mean(edge);
    const toward: V3 = [at[0] - mid[0], 0, at[2] - mid[2]];
    // It tips over the far edge, at its foot
    tip(d, b, [mid[0] - toward[0], mid[1], mid[2] - toward[2]], toward, 1.2, 0.4);
  }
}

/** The two corners (an end or a side) nearest where box `u` has lost most of its pieces. */
function crushedSide(u: Box): number[] {
  const c = u.corners.reduce((s, q) => [s[0] + q[0] / 4, 0, s[2] + q[2] / 4] as V3, [0, 0, 0] as V3);
  let gx = 0;
  let gz = 0;
  for (const p of u.pieces) {
    const dx = p.pose.position[0] - c[0];
    const dz = p.pose.position[2] - c[2];
    // Pieces thrown far say nothing about where it's crushed
    if (p.state === 'fixed' || Math.hypot(dx, dz) > 7) continue;
    gx += dx;
    gz += dz;
  }
  const sides = [
    [0, 1],
    [2, 3],
    [0, 2],
    [1, 3],
  ];
  // The side whose middle is furthest along where the losses lie
  const score = (s: number[]) => {
    const m = [(u.corners[s[0]][0] + u.corners[s[1]][0]) / 2 - c[0], (u.corners[s[0]][2] + u.corners[s[1]][2]) / 2 - c[2]];
    return (m[0] * gx + m[1] * gz) / Math.hypot(m[0], m[1]);
  };
  return sides.reduce((a, s) => (score(s) > score(a) ? s : a));
}

/**
 * Box `u` buckles along its top edge from a to b (the feet of the box on it): what stands within
 * `reach` of that edge, above its floor, goes at once, before that box drops: its posts and panels
 * pushed out, tipping outward, its top rails and roof sheets let drop.
 */
function buckle(d: Destruction, u: Box, a: V3, b: V3, reach: number): void {
  const dx = b[0] - a[0];
  const dz = b[2] - a[2];
  const l = Math.hypot(dx, dz) || 1;
  const mid = u.corners.reduce((s, c) => [s[0] + c[0] / 4, 0, s[2] + c[2] / 4] as V3, [0, 0, 0] as V3);
  for (const p of [...u.pieces]) {
    if (p.state !== 'fixed') continue;
    const [x, y, z] = p.pose.position;
    if (y < a[1] - STD + 0.2 || Math.abs((x - a[0]) * dz - (z - a[2]) * dx) / l > reach) continue;
    if (y > a[1] - 0.3) {
      d.loosen(p);
      continue;
    }
    const ox = x - mid[0];
    const oz = z - mid[2];
    const ol = Math.hypot(ox, oz) || 1;
    d.loosen(p, [(ox / ol) * 1.5, 0, (oz / ol) * 1.5], [(oz / ol) * 2, 0, (-ox / ol) * 2]);
  }
}
