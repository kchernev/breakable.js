// The false-front frame buildings (saloon, barber, hotel, store, sheriff's): sleepers on the dirt,
// a plank floor, walls of lap-siding courses between timber posts, a false front rising past the
// roof with its signboard, a tin roof hidden behind it, and the boardwalk out front with an awning
// or a balcony over it. All in the building's frame (see frame.ts): x along the front, z back.

import * as THREE from 'three/webgpu';
import type { Destruction, Hinge, Piece, Q, V3 } from '../../../lib/index.ts';
import { cylinder, toLocal } from '../../../lib/index.ts';
import { Frame, type Hole, holding, opening, type OpeningKind, slope, under, wall } from './frame.ts';
import { ATLAS, hangFrame, type Picto, SIGNS, signFrame, signRow } from './signs.ts';

/** The street: facades at |z| = FACADE, boardwalks out to |z| = WALK, floors at FLOOR. */
export const FACADE = 9.5;
const WALK = 7.0;
export const FLOOR = 0.4;
/** Siding courses: 0.45 m (three 15 cm boards) from the sill top at 0.30. */
const COURSE = 0.45;
const SILL = 0.3;
const T = 0.16;
const PLATE = 0.15;
/** A two-storey front stands this far off its upper side walls, tied on every other course. */
const GAP = 0.005;
const TIE = 0.012;
/** Indoor floors: darker, as the sky's light isn't shut out indoors. */
const INDOOR = 0xb8a890;

interface FrontSpec {
  /** World x extent, and which row: 1 north (facade at z +9.5, facing -z), -1 south. */
  x0: number;
  x1: number;
  side: 1 | -1;
  depth: number;
  storeys: 1 | 2;
  /** Courses of false front above the eaves, and more in the middle (stepped fronts). */
  front: number;
  step?: number;
  cornice?: boolean;
  paint: number;
  trim: number;
  door?: number;
  /** The front bays, ground floor and upstairs: '-' wall, 'w' window, 'W' shop window, 'd' door, 'b' batwing doors. */
  ground: string;
  upper?: string;
  /** The back and side walls' bays (by post bays, from the frame's x = 0 / z = 0 end); 'x': a barred window. */
  back?: string;
  left?: string;
  right?: string;
  sign: Picto;
  roof: 'gable' | 'shed';
  porch: 'awning' | 'balcony';
  seed: number;
}

/** A hanging sign: its board on a hinge under its bracket's arm. */
export interface Hanger {
  hinge: Hinge;
  /** The board's face normal (world), across the street's length: the way it swings. */
  normal: V3;
  /** What it hangs from, and its hinge's line (world): what's left of a board shot apart hangs there again. */
  arm: Piece;
  anchor: V3;
  axis: V3;
}

/** How far under its arm a hanging board hangs, on two chains (life.ts draws them). */
export const CHAIN = 0.17;

/**
 * A hanging sign under an arm (along the frame's z) from `at` (frame), on a hinge along the arm:
 * a board of the atlas, swinging across its face, that falls when the arm does. Its own material
 * (`hangboard`): cut without the grain, a round leaves a piece of board at each chain to swing.
 */
export function hangSign(f: Frame, arm: Piece | null, at: V3, picto: Picto): Hanger | null {
  if (!arm) return null;
  const [length, height] = ATLAS.hang;
  const position = f.at(at[0], at[1] - CHAIN - height / 2, at[2]);
  const board = f.d.addBox({ material: 'hangboard', size: [0.04, height, length], position, rotation: f.q, textureFrame: hangFrame(picto, position, f.q), loose: true });
  if (!board) return null;
  const [anchor, axis] = [f.at(...at), f.dir([0, 0, 1])];
  return { hinge: f.d.hinge(board, anchor, axis, { to: arm }), normal: f.dir([1, 0, 0]), arm, anchor, axis };
}

/**
 * A wall for life.ts to bring down once what carries it is shot out (bonds carry no bending, so it
 * could otherwise hang on at a corner, or sit on the stubs of its ground floor, for ever).
 */
export interface WallWatch {
  /** A front's porch goes first; a side or back wall's floor band is cut under it. */
  kind: 'front' | 'wall';
  /** What carries it, and the share of that gone at which it goes. */
  base: Piece[];
  share: number;
  /** The ground floor's bays: their pieces, and a point in the floor band over each, hit once it's blown out. */
  bays: Array<{ pieces: Piece[]; over: V3 }>;
  /** The building's frame (x along the front, z back, the street toward -z) and the wall's box in it. */
  origin: V3;
  rotation: Q;
  min: V3;
  max: V3;
  /** Once it lets go it's turned out over its foot: which way (frame), and a point on its outer face (frame). */
  out: V3;
  face: V3;
  /**
   * Points high on a front's porch posts, hit first so they buckle, and the box (frame) of the porch
   * over those: it goes over with the front (left standing, a balcony's end railings against the
   * front would stop it turning).
   */
  porch: V3[];
  porchBox: [V3, V3] | null;
  /** Points along the floor band under an upper storey's side or back wall: hit as it goes. */
  under: V3[];
}

export interface Built {
  hangers: Hanger[];
  watches: WallWatch[];
}

/** The frame of a building of the row on `side` spanning x0..x1 (set in 3 cm each end: neighbours stand apart). */
export function rowFrame(d: Destruction, x0: number, x1: number, side: 1 | -1, seed: number): Frame {
  return side === 1 ? new Frame(d, [x0 + 0.03, 0, FACADE], 0, seed) : new Frame(d, [x1 - 0.03, 0, -FACADE], Math.PI, seed);
}

/** A course line: the height of the top of course n. */
const cy = (n: number) => SILL + n * COURSE;

/** Holes for a row of bays between `posts` (centres), from a pattern; `base` is the floor's sill. */
function holes(pattern: string, posts: number[], base: number, pw = 0.16): Array<{ hole: Hole; kind: OpeningKind }> {
  const out: Array<{ hole: Hole; kind: OpeningKind }> = [];
  for (let i = 0; i < pattern.length && i + 1 < posts.length; i++) {
    const ch = pattern[i];
    if (ch === '-' || ch === ' ') continue;
    const a = posts[i] + pw / 2;
    const b = posts[i + 1] - pw / 2;
    const cw = b - a;
    const spec: Record<string, { w: number; c0: number; c1: number; kind: OpeningKind }> = {
      w: { w: 1.1, c0: 2, c1: 5, kind: 'window' },
      x: { w: 0.9, c0: 3, c1: 5, kind: 'barred' },
      W: { w: cw, c0: 1, c1: 5, kind: 'display' },
      d: { w: 1.15, c0: 0, c1: 5, kind: 'door' },
      D: { w: 1.6, c0: 0, c1: 5, kind: 'door' },
      b: { w: cw, c0: 0, c1: 6, kind: 'batwing' },
    };
    const s = spec[ch];
    if (!s) continue;
    let w = Math.min(s.w, cw);
    if (cw - w < 0.12) w = cw;
    const m = (a + b) / 2;
    out.push({ hole: { a: m - w / 2, b: m + w / 2, y0: base + s.c0 * COURSE, y1: base + s.c1 * COURSE }, kind: s.kind });
  }
  return out;
}

/** Even posts across a span (ends set in by half a post) making `n` bays. */
function bayPosts(from: number, to: number, n: number, pw = 0.16): number[] {
  return Array.from({ length: n + 1 }, (_, i) => from + pw / 2 + (i * (to - from - pw)) / n);
}

/** A false-front building, its boardwalk and its awning or balcony. */
export function falseFront(d: Destruction, s: FrontSpec): Built {
  const f = rowFrame(d, s.x0, s.x1, s.side, s.seed);
  const rand = f.rand;
  const W = s.x1 - s.x0 - 0.06;
  const D = s.depth;
  const two = s.storeys === 2;
  // Ground storey to 3.90 (8 courses), or 3.45 then a 0.30 floor band and 7 courses more
  const lowTop = two ? cy(7) : cy(8);
  const upBase = lowTop + 0.3;
  const E = two ? upBase + 7 * COURSE : lowTop;
  const sideTop = E + s.front * COURSE;
  const top = sideTop + (s.step ?? 0) * COURSE;
  const paint = s.paint;
  const siding = (c: number, i: number) => {
    // Boards weather unevenly: a little lighter or darker piece to piece
    const k = 0.94 + ((c * 7 + i * 13) % 5) * 0.03;
    return new THREE.Color(paint).multiplyScalar(k);
  };

  // --- Sleepers and floor ---
  f.beams('timber', -0.02, 0, -0.02, W + 0.04, SILL, 0.2);
  f.beams('timber', -0.02, 0, D - 0.18, W + 0.04, SILL, 0.2);
  f.beams('timber', -0.02, 0, 0.18, 0.2, SILL, D - 0.36);
  f.beams('timber', W - 0.18, 0, 0.18, 0.2, SILL, D - 0.36);
  const nx = Math.max(2, Math.ceil((W - 0.32) / 2));
  const lines = Array.from({ length: nx - 1 }, (_, k) => T + ((k + 1) * (W - 2 * T)) / nx);
  for (const x of lines) f.beams('timber', x - 0.1, 0, 0.18, 0.2, SILL, D - 0.36);
  const xs = [T, ...lines, W - T];
  const nz = Math.max(1, Math.ceil((D - T - 0.18) / 2));
  for (let i = 0; i + 1 < xs.length; i++)
    for (let j = 0; j < nz; j++) {
      const z0 = 0.18 + (j * (D - T - 0.18)) / nz;
      f.box('timber', xs[i], SILL, z0, xs[i + 1] - xs[i], FLOOR - SILL, (D - T - 0.18) / nz, { tint: INDOOR });
    }

  // --- Front wall: storeys, the band between, the false front, its step ---
  const nb = s.ground.length;
  const fp = bayPosts(0, W, nb);
  const front = (y0: number, course: number, wallTop: number, pattern: string | null, base: number, from = 0, to = W, posts = fp, tint: typeof siding | number = siding) => {
    const hs = pattern ? holes(pattern, posts, base) : [];
    const built = wall(f, { material: 'siding', axis: 'x', at: 0, t: T, from, to, y0, course, top: wallTop, posts, postTint: s.trim, holes: hs.map((h) => h.hole), tint });
    for (const h of hs) opening(f, { axis: 'x', at: 0, t: T, hole: h.hole, kind: h.kind, trim: s.trim, door: s.door });
    return built;
  };
  const frontTop: Piece[] = [];
  const ground = front(SILL, COURSE, lowTop, s.ground, SILL);
  const band = two ? front(lowTop, 0.3, upBase, null, 0, 0, W, fp, s.trim) : null;
  const upper = two ? front(upBase, COURSE, sideTop, s.upper ?? '', upBase) : front(lowTop, COURSE, sideTop, null, 0);
  // The courses just above the eaves, where the braces from the roof take hold
  const eaveRow = upper.courses[two ? 7 : 0] ?? [];
  frontTop.push(...eaveRow);
  if (s.step) {
    // The middle third of the bays rises further
    const k0 = Math.floor(nb / 3);
    const k1 = nb - k0;
    front(sideTop, COURSE, top, null, 0, fp[k0] - 0.08, fp[k1] + 0.08, fp.slice(k0, k1 + 1));
  }
  // Caps: a timber cap along the top (projecting), the step's own, a deeper cornice on brackets
  const cap = (x0: number, x1: number, y: number, deep = 0.3, h = 0.16) => f.beams('timber', x0, y, -0.12, x1 - x0, h, deep, 1.9, { tint: s.trim });
  if (s.step) {
    const k0 = Math.floor(nb / 3);
    const k1 = nb - k0;
    cap(-0.06, fp[k0] - 0.08, sideTop);
    cap(fp[k1] + 0.08, W + 0.06, sideTop);
    cap(fp[k0] - 0.14, fp[k1] + 0.14, top);
  } else cap(-0.06, W + 0.06, top);
  if (s.cornice) {
    // Brackets under a second, deeper course
    const n = Math.round(W / 1.2);
    for (let i = 0; i <= n; i++) f.box('timber', 0.1 + (i * (W - 0.32)) / n, top - 0.36, -0.12, 0.12, 0.36, 0.12, { tint: s.trim });
    f.beams('timber', -0.12, top + 0.16, -0.26, W + 0.24, 0.14, 0.44, 1.9, { tint: s.trim });
  }

  // Signboard on the false front, its face 4 cm proud
  const sign = SIGNS[signRow(s.sign)];
  const L = Math.min(sign.length, W - 0.8);
  const sy = (E + sideTop) / 2 - 0.45 + (two ? 0 : 0.1);
  const sx0 = (W - L) / 2;
  const tex = signFrame(f, s.sign, sx0 + L, sy, -0.04);
  const ns = Math.ceil(L / 1.9);
  for (let i = 0; i < ns; i++) f.box('signpaint', sx0 + (i * L) / ns, sy, -0.04, L / ns, 0.9, 0.04, { tex });

  // --- Side and back walls ---
  const sp = bayPosts(T, D, Math.max(2, Math.ceil((D - T) / 1.8))).slice(1);
  const bp = bayPosts(T, W - T, Math.max(2, Math.ceil((W - 2 * T) / 1.8)));
  const bpInner = bp.slice(1, -1);
  const sideWall = (at: number, pattern: string | undefined, y0: number, wallTop: number | Array<[number, number]>, base: number, from = T) => {
    const posts = [T - 0.08, ...sp];
    const hs = pattern ? holes(pattern, posts, base) : [];
    const built = wall(f, { material: 'siding', axis: 'z', at, t: T, from, to: D, y0, course: COURSE, top: wallTop, posts: sp, holes: hs.map((h) => h.hole), tint: siding });
    for (const h of hs) opening(f, { axis: 'z', at, t: T, hole: h.hole, kind: h.kind, trim: s.trim, door: s.door, out: at < W / 2 ? -1 : 1 });
    return built;
  };
  const backWall = (y0: number, wallTop: number, pattern: string | undefined, base: number) => {
    const hs = pattern ? holes(pattern, bp, base) : [];
    const built = wall(f, { material: 'siding', axis: 'x', at: D - T, t: T, from: T, to: W - T, y0, course: COURSE, top: wallTop, posts: bpInner, holes: hs.map((h) => h.hole), tint: siding });
    for (const h of hs) opening(f, { axis: 'x', at: D - T, t: T, hole: h.hole, kind: h.kind, trim: s.trim, door: s.door, out: 1 });
    return built;
  };
  const shed = s.roof === 'shed';
  const pitch = shed ? (8 * Math.PI) / 180 : (18 * Math.PI) / 180;
  // A shed roof's sides follow its slope (falling to the back)
  const shedLine = (y: number): Array<[number, number]> => [
    [T, y + (D - T) * Math.tan(pitch)],
    [D, y],
  ];
  const watches: WallWatch[] = [];
  const watch = (kind: WallWatch['kind'], base: Piece[], share: number, bayList: WallWatch['bays'], min: V3, max: V3, out: V3, face: V3, porch: V3[] = [], under: V3[] = []) => {
    const porchBox: [V3, V3] | null = porch.length ? [[min[0], Math.min(...porch.map((p) => p[1])) - 0.25, WALK - FACADE - 0.3], [max[0], 99, 0]] : null;
    watches.push({ kind, base, share, bays: bayList, origin: f.origin, rotation: f.q, min, max, out, face, porch, porchBox, under });
  };
  // The band over a ground-floor wall's bays (u along it, at its middle across): a point a bay
  const bays = (axis: 'x' | 'z', at: number, built: ReturnType<typeof wall>, posts: number[]) => {
    const mid = at + T / 2;
    const y = lowTop + 0.15;
    return posts.slice(0, -1).map((a, i) => {
      const b = posts[i + 1];
      const inBay = (p: Piece) => {
        const [x, , z] = toLocal(f.origin, f.q, p.pose.position);
        const u = axis === 'x' ? x : z;
        return u > a && u < b;
      };
      const u = (a + b) / 2;
      return { pieces: [...built.courses.flat(), ...built.posts.flat()].filter(inBay), over: axis === 'x' ? f.at(u, y, mid) : f.at(mid, y, u) };
    });
  };
  // Points every 0.7 m along the band over a wall
  const along = (axis: 'x' | 'z', at: number, from: number, to: number) => {
    const n = Math.max(1, Math.round((to - from) / 0.7));
    return Array.from({ length: n + 1 }, (_, i) => from + ((to - from) * i) / n).map((u) => (axis === 'x' ? f.at(u, lowTop + 0.15, at + T / 2) : f.at(at + T / 2, lowTop + 0.15, u)));
  };
  if (two) {
    // Each ground-floor wall watched: once 60% of it is gone, the storey above it comes down
    const sidePosts = [T, ...sp, D];
    for (const [at, pattern] of [
      [0, s.left],
      [W - T, s.right],
    ] as const) {
      const built = sideWall(at, pattern, SILL, lowTop, SILL);
      const out: V3 = at ? [1, 0, 0] : [-1, 0, 0];
      watch('wall', [...built.courses.flat(), ...built.posts.flat()], 0.6, bays('z', at, built, sidePosts), [at - 0.02, lowTop - 0.02, T], [at + T + 0.02, 99, D + 0.01], out, [at ? W : 0, 0, D / 2], [], along('z', at, T + 0.3, D - 0.3));
    }
    const back = backWall(SILL, lowTop, s.back, SILL);
    watch('wall', [...back.courses.flat(), ...back.posts.flat()], 0.6, bays('x', D - T, back, bp), [T - 0.01, lowTop - 0.02, D - T - 0.02], [W - T + 0.01, 99, D + 0.02], [0, 0, 1], [W / 2, 0, D], [], along('x', D - T, T + 0.3, W - T - 0.3));
    // The floor band over the whole plan (2 cm short of the front), a girder's posts under its middle
    const bx = Math.ceil(W / 2);
    const bz = Math.ceil((D - 0.18) / 2);
    for (let i = 0; i < bx; i++)
      for (let j = 0; j < bz; j++) f.box('timber', (i * W) / bx, lowTop, 0.18 + (j * (D - 0.18)) / bz, W / bx, 0.3, (D - 0.18) / bz);
    for (const z of [D / 3, (2 * D) / 3]) f.post('timber', W / 2 - 0.08, FLOOR, z - 0.08, 0.16, lowTop - FLOOR, 0.16);
    // Upstairs the side walls stand just off the front and are tied to its corner posts on every
    // other course: undermined, the front's whole upper storey peels away into the street
    for (const [at, pattern, post] of [
      [0, s.left, upper.posts[0]],
      [W - T, s.right, upper.posts[upper.posts.length - 1]],
    ] as const) {
      const side = sideWall(at, pattern?.replace(/x/g, 'w'), upBase, E, upBase, T + GAP);
      side.courses.forEach((row, c) => {
        if (c % 2) return;
        const y = upBase + (c + 0.5) * COURSE;
        f.bond(holding(row, f.at(at + T / 2, y, T + GAP + 0.01)), holding(post ?? [], f.at(at + T / 2, y, T - 0.01)), TIE);
      });
    }
    backWall(upBase, E, s.back?.replace(/d/g, 'w'), upBase);
  } else {
    const sides = [sideWall(0, s.left, SILL, shed ? shedLine(E + PLATE) : E, SILL), sideWall(W - T, s.right, SILL, shed ? shedLine(E + PLATE) : E, SILL)];
    backWall(SILL, E, s.back, SILL);
    // The front's corner posts are nailed to the side walls' end boards, course by course: a hit
    // in the middle of the front takes out its bay, not the whole front
    sides.forEach((side, k) => {
      const corner = k ? ground.posts[ground.posts.length - 1] : ground.posts[0];
      const x = k ? W - T / 2 : T / 2;
      side.courses.forEach((row, c) => f.bond(holding(row, f.at(x, SILL + (c + 0.5) * COURSE, T + 0.01)), holding(corner ?? [], f.at(x, SILL + (c + 0.5) * COURSE, T - 0.01)), 0.05));
    });
  }

  // --- Plates and roof ---
  const backPlate = f.beams('timber', T, E, D - T, W - 2 * T, PLATE, T);
  const hangers: Hanger[] = [];
  // The map's own streaks carry the rust: one sheet in six a little darker, the rest near alike
  const tinTint = () => new THREE.Color(0xf0f0f0).lerp(new THREE.Color(0xe6ddd2), rand() < 1 / 6 ? 0.6 + rand() * 0.4 : rand() * 0.2).getHex();
  if (shed) {
    const m = Math.ceil((W - 0.16) / 1.4);
    const lines = Array.from({ length: m + 1 }, (_, i) => 0.08 + (i * (W - 0.16)) / m);
    const r = slope(f, { axis: 'z', eave: D, y: E + PLATE, dir: -1, pitch, run: D - T, overhang: 0.35, lines, across: [-0.15, W + 0.15], tint: tinTint });
    r.feet.forEach((foot, i) => f.bond(foot, under(backPlate, f.at(lines[i], E, D - 0.08)), 0.012));
  } else {
    const g = two ? GAP : 0;
    const plates = [f.beams('timber', 0, E, T + g, T, PLATE, D - T - g), f.beams('timber', W - T, E, T + g, T, PLATE, D - T - g)];
    // The first rafters stand 4 cm off the false front: it's tied to the roof by two kicker braces
    // (bonds), not along its whole width, so undermined it leans out and falls into the street
    const n = Math.max(2, Math.ceil((D - T - 0.12) / 1.8));
    const lines = Array.from({ length: n + 1 }, (_, j) => T + 0.08 + (j * (D - T - 0.12)) / n);
    const common = { axis: 'x' as const, pitch, run: W / 2, overhang: 0.3, lines, across: [T + 0.02, D + 0.25] as [number, number], ridge: true, tint: tinTint };
    const left = slope(f, { ...common, eave: 0, y: E + PLATE, dir: 1 });
    const right = slope(f, { ...common, eave: W, y: E + PLATE, dir: -1 });
    // Rafters' feet are spiked to the plates, and pairs meet at the ridge
    lines.forEach((z, j) => {
      for (const [side, r] of [
        [0, left],
        [1, right],
      ] as const) {
        f.bond(r.feet[j], under(plates[side], f.at(side ? W - 0.08 : 0.08, E, z)), 0.012);
      }
      f.bond(left.tops[j], right.tops[j], 0.012);
    });
    for (const r of [left, right]) f.bond(r.tops[0], under(frontTop, f.at(W / 2 + (r === left ? -1.5 : 1.5), 0, 0.08)), 0.02);
    // The back gable, under the rafters
    wall(f, {
      material: 'siding',
      axis: 'x',
      at: D - T,
      t: T,
      from: 0,
      to: W,
      y0: E + PLATE,
      course: COURSE,
      top: [
        [0, E + PLATE],
        [W / 2, E + PLATE + (W / 2) * Math.tan(pitch)],
        [W, E + PLATE],
      ],
      tint: siding,
    });
  }

  // --- Boardwalk ---
  walkway(f, W, rand);
  // A two-storey front's awning stops 2 cm short of it, as its floor band comes down to it
  const porch = s.porch === 'awning' ? awning(f, W, 3.2, two ? 0.02 : 0) : balcony(f, W, lowTop, band ? [...band.courses.flat(), ...band.posts.flat()] : []);

  // A hanging sign on an arm out from the facade near one end, under the awning or balcony
  const armY = s.porch === 'awning' ? 2.75 : 2.85;
  const ax = s.side === 1 ? W - 0.6 : 0.6;
  const arm = f.beam('timber', ax - 0.05, armY, -1.25, 0.1, 0.1, 1.25);
  f.box('timber', ax - 0.04, armY - 0.32, -0.1, 0.08, 0.32, 0.1);
  const hanger = hangSign(f, arm, [ax, armY, -0.8], s.sign);
  if (hanger) hangers.push(hanger);

  // The front: tipped into the street once 60% of its ground floor's posts are gone (40% for a
  // one-storey front: the false front over it is a sail with nothing behind it); a two-storey
  // front's upper storey only, from the band up
  const foot = two ? lowTop - 0.02 : SILL - 0.02;
  watch('front', ground.posts.flat(), two ? 0.6 : 0.4, two ? bays('x', 0, ground, fp) : [], [-0.4, foot, -0.35], [W + 0.4, 99, T + 0.003], [0, 0, -1], [0, 0, 0], porch);
  return { hangers, watches };
}

/** The boardwalk in front of a building: footings, joists, planks across, a fascia along the edge. */
export function walkway(f: Frame, W: number, rand: () => number, depth = FACADE - WALK, gap = 0.02): void {
  const nf = Math.max(1, Math.ceil((W - 0.2) / 2));
  const fx = Array.from({ length: nf + 1 }, (_, k) => 0.1 + (k * (W - 0.2)) / nf);
  for (const zc of [-depth + 0.1, -depth / 2, -0.2]) {
    for (const x of fx) f.box('timber', x - 0.1, 0, zc - 0.1, 0.2, 0.24, 0.2);
    // Joists jointed over the footings
    const cuts = [0, ...fx.slice(1, -1), W];
    for (let k = 0; k + 1 < cuts.length; k++) f.beam('timber', cuts[k], 0.24, zc - 0.05, cuts[k + 1] - cuts[k], 0.1, 0.1);
  }
  const n = Math.round(W / 0.4);
  const shade = [0xf2ece2, 0xe8dfd0, 0xded2c0, 0xd8ccb8];
  for (let i = 0; i < n; i++) f.beam('timber', (i * W) / n, 0.34, -depth, W / n, 0.06, depth - gap, { tint: shade[Math.floor(rand() * shade.length)] });
  f.beams('timber', 0, 0.15, -depth - 0.04, W, 0.25, 0.04);
}

/**
 * A flat plank awning over the boardwalk: posts, a header, a ledger on the wall, joists, boards
 * (`gap` off the wall), a fascia. Returns points high on its posts.
 */
function awning(f: Frame, W: number, y: number, gap: number, depth = FACADE - WALK): V3[] {
  const na = Math.max(2, Math.round(W / 2.8));
  const zc = -depth + 0.15;
  const px = Array.from({ length: na + 1 }, (_, k) => 0.08 + (k * (W - 0.16)) / na);
  for (const x of px) f.post('timber', x - 0.075, FLOOR, zc - 0.075, 0.15, y - FLOOR, 0.15, 1.5);
  f.beams('timber', 0, y, zc - 0.08, W, 0.16, 0.16);
  f.beams('timber', 0, y, -0.12, W, 0.16, 0.12);
  const nj = Math.max(2, Math.round(W / 1.2));
  for (let k = 0; k <= nj; k++) f.beam('timber', 0.02 + (k * (W - 0.12)) / nj, y + 0.16, zc - 0.08, 0.08, 0.1, -(zc - 0.08));
  // Boards 0.6 m wide out from the wall, 5 mm apart so their joints show from below
  const z0 = zc - 0.2;
  const nb = Math.round(W / 0.6);
  for (let i = 0; i < nb; i++) f.beam('timber', (i * W) / nb + 0.0025, y + 0.26, z0, W / nb - 0.005, 0.05, -z0 - gap);
  f.beams('timber', 0, y + 0.16, z0 - 0.04, W, 0.15, 0.04);
  return px.map((x) => f.at(x, y - 0.5, zc));
}

/**
 * The saloon's balcony: posts, a deck level with the upper floor, a railing of turned balusters.
 * It stands 2 cm off the front, its joists tied to the floor band by small bonds, so it tears off
 * once its posts go.
 */
function balcony(f: Frame, W: number, y: number, band: Piece[], depth = FACADE - WALK): V3[] {
  const na = Math.max(2, Math.round(W / 2.6));
  const zc = -depth + 0.15;
  const px = Array.from({ length: na + 1 }, (_, k) => 0.08 + (k * (W - 0.16)) / na);
  const hy = y - 0.16;
  for (const x of px) f.post('timber', x - 0.075, FLOOR, zc - 0.075, 0.15, hy - FLOOR, 0.15, 1.6);
  f.beams('timber', 0, hy, zc - 0.08, W, 0.16, 0.16);
  f.beams('timber', 0, hy, -0.12, W, 0.16, 0.12);
  const nj = Math.max(2, Math.round(W / 1.2));
  for (let k = 0; k <= nj; k++) {
    const x = 0.02 + (k * (W - 0.12)) / nj;
    const joist = f.beam('timber', x, y, zc - 0.08, 0.08, 0.24, -(zc - 0.08) - 0.02);
    f.bond(joist, holding(band, f.at(x + 0.04, y + 0.12, 0.01)), 0.01);
  }
  // Planks across (long on z), the deck's top level with the band's
  const n = Math.round(W / 0.3);
  const front = -depth - 0.05;
  for (let i = 0; i < n; i++) f.beam('timber', (i * W) / n, y + 0.24, front, W / n, 0.06, -front - 0.02);
  const deck = y + 0.3;
  // Railing: a bottom rail, balusters every 0.30, a top rail; along the front and down both ends
  const bone = 0xf2ead8;
  const r = 0.035;
  const bh = 0.85;
  const rail = (x0: number, z0: number, sx: number, sz: number, yy: number, h: number) => f.beams('paint', x0, yy, z0, sx, h, sz, 1.9, { tint: bone });
  const zf = front + 0.02;
  rail(0, zf, W, 0.08, deck, 0.08);
  rail(0, zf - 0.01, W, 0.1, deck + 0.08 + bh, 0.08);
  for (const x0 of [0.02, W - 0.1]) {
    rail(x0, zf + 0.08, 0.08, -zf - 0.1, deck, 0.08);
    rail(x0 - 0.01, zf + 0.09, 0.1, -zf - 0.11, deck + 0.08 + bh, 0.08);
  }
  const baluster = (x: number, z: number) => f.hull('paint', cylinder(r, bh, 8).map(([a, b, c]) => [a + x, b + deck + 0.08, c + z] as V3), { tint: bone, smooth: 1 });
  const nbal = Math.round(W / 0.3);
  for (let i = 0; i <= nbal; i++) baluster(0.06 + (i * (W - 0.12)) / nbal, zf + 0.04);
  for (const x of [0.06, W - 0.06]) {
    const m = Math.round(-zf / 0.3);
    for (let i = 1; i < m; i++) baluster(x, zf + 0.04 + (i * (-zf - 0.12)) / m);
  }
  return px.map((x) => f.at(x, hy - 0.5, zc));
}
