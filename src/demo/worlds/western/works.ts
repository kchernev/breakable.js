// The rest of the town: the livery barn (raw timber, its gable to the street), the smithy shed,
// the water tower on its timber legs, the windmill and its stock tank, and the small things that
// stand about: barrels, crates, hay, hitching rails, troughs, benches, the barber's pole,
// telegraph poles, the corral and the outhouse.

import * as THREE from 'three/webgpu';
import type { Destruction, Piece, V3 } from '../../../lib/index.ts';
import { add, arcBlock, cross, dot, normalize, quatFromAxisAngle, scale, sub } from '../../../lib/index.ts';
import { Frame, opening, slope, under, wall } from './frame.ts';
import { type Hanger, hangSign, rowFrame } from './fronts.ts';

/** An upright eight-sided prism (flats facing ±x and ±z), its foot centred at (x, y, z). */
export function octo(r: number, h: number, x = 0, y = 0, z = 0): V3[] {
  const pts: V3[] = [];
  for (let k = 0; k < 8; k++) {
    const a = Math.PI / 8 + (k * Math.PI) / 4;
    pts.push([x + Math.cos(a) * r, y, z + Math.sin(a) * r], [x + Math.cos(a) * r, y + h, z + Math.sin(a) * r]);
  }
  return pts;
}

/** A disc's sector as a flat prism: centre and the arc's points at radius r (angles about y), y0 to y1. */
function sector(r: number, a0: number, a1: number, steps: number, y0: number, y1: number, cx: number, cz: number): V3[] {
  const pts: V3[] = [
    [cx, y0, cz],
    [cx, y1, cz],
  ];
  for (let k = 0; k <= steps; k++) {
    const a = a0 + ((a1 - a0) * k) / steps;
    pts.push([cx + Math.cos(a) * r, y0, cz + Math.sin(a) * r], [cx + Math.cos(a) * r, y1, cz + Math.sin(a) * r]);
  }
  return pts;
}

/** The livery barn (S3): x 1.5..12.5, gable end to the street at z -9.5, back to -23.5. */
export function livery(d: Destruction): { hangers: Hanger[] } {
  const f = rowFrame(d, 1.5, 12.5, -1, 41);
  const W = 11 - 0.06;
  const D = 14;
  const T = 0.16;
  const C = 0.6;
  const E = 0.3 + 8 * C;
  const pitch = (33 * Math.PI) / 180;
  const rise = (W / 2) * Math.tan(pitch);
  const gable: Array<[number, number]> = [
    [0, E + 0.15],
    [W / 2, E + 0.15 + rise],
    [W, E + 0.15],
  ];
  // Sleepers round the walls; the floor is the dirt
  f.beams('timber', -0.02, 0, -0.02, W + 0.04, 0.3, 0.2);
  f.beams('timber', -0.02, 0, D - 0.18, W + 0.04, 0.3, 0.2);
  for (const x of [-0.02, W - 0.18]) f.beams('timber', x, 0, 0.18, 0.2, 0.3, D - 0.36);
  const boards = { material: 'timber', t: T, course: C, y0: 0.3 } as const;

  // The gable end: the big door, the hayloft door over it; posts either side of the door
  const jl = W / 2 - 1.85;
  const jr = W / 2 + 1.85;
  const posts = [0.08, (0.08 + jl) / 2, jl, jr, (jr + W - 0.08) / 2, W - 0.08];
  const big = { a: W / 2 - 1.77, b: W / 2 + 1.77, y0: 0.3, y1: 0.3 + 6 * C };
  const loft = { a: W / 2 - 0.7, b: W / 2 + 0.7, y0: 0.3 + 7 * C, y1: 0.3 + 10 * C };
  wall(f, { ...boards, axis: 'x', at: 0, from: 0, to: W, top: gable, posts, holes: [big, loft] });
  opening(f, { axis: 'x', at: 0, t: T, hole: big, kind: 'open', trim: 0xffffff });
  opening(f, { axis: 'x', at: 0, t: T, hole: loft, kind: 'open', trim: 0xffffff });
  // The leaves stand open against the front, either side
  for (const [x0, x1] of [
    [big.a - 1.77, big.a],
    [big.b, big.b + 1.77],
  ]) {
    f.box('timber', x0, 0.32, -0.06, x1 - x0, 1.8, 0.06, { tint: 0xc8b8a0 });
    f.box('timber', x0, 2.12, -0.06, x1 - x0, 1.6, 0.06, { tint: 0xc8b8a0 });
  }
  f.box('timber', loft.b, loft.y0 + 0.1, -0.06, 1.3, 1.5, 0.06, { tint: 0xc8b8a0 });
  // The hoist beam out from the apex, its hook
  const hy = E + 0.15 + rise - 1.0;
  f.beam('timber', W / 2 - 0.1, hy, -1.2, 0.2, 0.2, 1.2);
  f.box('iron', W / 2 - 0.02, hy - 0.45, -1.05, 0.04, 0.45, 0.04, { tint: 0x3a3a3a });

  // Sides, back
  const sp = Array.from({ length: 8 }, (_, i) => T + 0.08 + ((i + 1) * (D - T - 0.16)) / 8);
  for (const x of [0, W - T]) {
    const win = { a: sp[3] + 0.08 + 0.3, b: sp[4] - 0.08 - 0.3, y0: 0.3 + 3 * C, y1: 0.3 + 5 * C };
    wall(f, { ...boards, axis: 'z', at: x, from: T, to: D, top: E, posts: sp, holes: [win] });
    opening(f, { axis: 'z', at: x, t: T, hole: win, kind: 'open', trim: 0xffffff });
  }
  const bp = Array.from({ length: 5 }, (_, i) => T + 0.08 + ((i + 1) * (W - 2 * T - 0.16)) / 6);
  const back = { a: bp[1] + 0.08, b: bp[2] - 0.08, y0: 0.3, y1: 0.3 + 4 * C };
  wall(f, { ...boards, axis: 'x', at: D - T, from: T, to: W - T, top: E, posts: bp, holes: [back] });
  opening(f, { axis: 'x', at: D - T, t: T, hole: back, kind: 'door', trim: 0xffffff, door: 0xb8a890, out: 1 });
  wall(f, { ...boards, axis: 'x', at: D - T, from: 0, to: W, y0: E + 0.15, top: gable });
  const plates = [f.beams('timber', 0, E, T, T, 0.15, D - T), f.beams('timber', W - T, E, T, T, 0.15, D - T)];
  f.beams('timber', T, E, D - T, W - 2 * T, 0.15, T);

  // Roof: steep, tin, overhanging the gable end
  const n = 7;
  const lines = Array.from({ length: n + 1 }, (_, j) => 0.08 + (j * (D - 0.16)) / n);
  const common = { axis: 'x' as const, pitch, run: W / 2, overhang: 0.35, lines, across: [-0.3, D + 0.3] as [number, number], ridge: true, depth: 0.18 };
  const left = slope(f, { ...common, eave: 0, y: E + 0.15, dir: 1 });
  const right = slope(f, { ...common, eave: W, y: E + 0.15, dir: -1 });
  lines.forEach((z, j) => {
    if (j > 0 && j < n) {
      f.bond(left.feet[j], under(plates[0], f.at(0.08, E, z)), 0.012);
      f.bond(right.feet[j], under(plates[1], f.at(W - 0.08, E, z)), 0.012);
    }
    f.bond(left.tops[j], right.tops[j], 0.012);
  });

  // The hayloft: beams across between the side walls, a plank floor stopping short of the gable
  const ly = 3.0;
  for (let j = 0; j < 6; j++) f.beams('timber', T, ly - 0.2, 1.4 + j * 2.4, W - 2 * T, 0.2, 0.16, 1.9);
  for (let i = 0; i < 5; i++)
    for (let j = 0; j < 7; j++) {
      const z0 = 1.2 + (j * (D - T - 1.2)) / 7;
      f.box('timber', T + (i * (W - 2 * T)) / 5, ly, z0, (W - 2 * T) / 5, 0.06, (D - T - 1.2) / 7, { tint: 0xd8ccb8 });
    }
  // Bales: up in the loft and down on the floor
  const bales: Array<[number, number, number, boolean]> = [];
  for (let k = 0; k < 6; k++) bales.push([T + 0.1 + (k % 3) * 1.05, ly + 0.06, 7 + Math.floor(k / 3) * 0.55, false]);
  for (let k = 0; k < 6; k++) bales.push([W - T - 1.1 - (k % 3) * 1.05, ly + 0.06, 9 + Math.floor(k / 3) * 0.55, false]);
  for (let k = 0; k < 4; k++) bales.push([T + 0.1 + (k % 2) * 1.05, ly + 0.51, 7 + Math.floor(k / 2) * 0.55, false]);
  for (let k = 0; k < 6; k++) bales.push([W - T - 1.2, 0.0, 3.5 + k * 0.55, true]);
  for (let k = 0; k < 4; k++) bales.push([W - T - 2.3, 0.0, 3.5 + k * 0.55, true]);
  for (const [x, y, z] of bales) baleIn(f, x, y, z);
  // Stalls: rails from the west wall to a post, three
  for (const z of [6, 8.4, 10.8]) {
    f.post('timber', 2.6, 0, z, 0.15, 1.45, 0.15);
    for (const y of [0.6, 1.15]) f.beam('timber', T, y, z + 0.02, 2.6 - T, 0.14, 0.08);
  }

  // A hanging sign on an arm from the front, beside the door
  const arm = f.beam('timber', W - 1.3, 4.1, -1.2, 0.1, 0.1, 1.2);
  f.box('timber', W - 1.29, 3.78, -0.1, 0.08, 0.32, 0.1);
  const sign = hangSign(f, arm, [W - 1.25, 4.1, -0.75], 'horseshoe');
  return { hangers: sign ? [sign] : [] };
}

/** The blacksmith's shed (S4): x 14..20, z -9.5..-15.5, open on three sides, a stone forge. Returns its sign and the forge's coals. */
export function smithy(d: Destruction): { hangers: Hanger[]; coals: Piece | null } {
  const f = rowFrame(d, 14, 20, -1, 51);
  const W = 6 - 0.06;
  const D = 6;
  const h = 3.2;
  // Posts on footing stones, taller at the front for the roof's fall; plates on top; a back wall of boards
  const pitch = (10 * Math.PI) / 180;
  const run = D - 0.1 - 0.6;
  const hf = h + run * Math.tan(pitch);
  const px = [0.1, W / 2, W - 0.1];
  for (const [z, ph] of [
    [0.6, hf],
    [D - 0.1, h],
  ])
    for (const x of px) {
      f.box('stone', x - 0.15, 0, z - 0.15, 0.3, 0.2, 0.3);
      f.post('timber', x - 0.1, 0.2, z - 0.1, 0.2, ph - 0.2, 0.2);
    }
  const front = f.beams('timber', 0, hf, 0.5, W, 0.18, 0.2);
  const back = f.beams('timber', 0, h, D - 0.2, W, 0.18, 0.2);
  wall(f, { material: 'timber', axis: 'x', at: D - 0.36, t: 0.16, from: 0.2, to: W / 2 - 0.1, y0: 0, course: 0.6, top: h });
  wall(f, { material: 'timber', axis: 'x', at: D - 0.36, t: 0.16, from: W / 2 + 0.1, to: W - 0.2, y0: 0, course: 0.6, top: h });
  // Shed roof falling to the back, from the front plate to the back one
  const lines = [0.1, W / 4, W / 2, (3 * W) / 4, W - 0.1];
  const r = slope(f, { axis: 'z', eave: D - 0.1, y: h + 0.18, dir: -1, pitch, run, overhang: 0.3, lines, across: [-0.2, W + 0.2], depth: 0.14 });
  r.feet.forEach((foot, i) => f.bond(foot, under(back, f.at(lines[i], h, D - 0.1)), 0.012));
  r.tops.forEach((top, i) => f.bond(top, under(front, f.at(lines[i], h, 0.6)), 0.012));
  // The forge: a stone hearth with a hood and a chimney up through the roof's line
  const fx = W - 2.0;
  for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) f.box('stone', fx + i * 0.6, 0, 2.6 + j * 0.5, 0.6, 0.8, 0.5);
  f.box('stone', fx - 0.05, 0.8, 2.55, 1.3, 0.12, 1.1);
  const coals = f.box('coals', fx + 0.2, 0.92, 2.65, 0.8, 0.12, 0.45);
  for (let k = 0; k < 4; k++) f.box('stone', fx + 0.35, 0.92 + k * 0.5, 3.15, 0.5, 0.5, 0.45);
  // The anvil on a stump
  f.hull('timber', octo(0.25, 0.55, 2.0, 0, 2.6), { smooth: 1 });
  f.box('iron', 1.75, 0.55, 2.47, 0.5, 0.12, 0.26, { tint: 0x2e2c2a });
  f.box('iron', 1.85, 0.67, 2.5, 0.3, 0.12, 0.2, { tint: 0x2e2c2a });
  f.box('iron', 1.65, 0.79, 2.45, 0.7, 0.14, 0.3, { tint: 0x2e2c2a });
  // A hanging sign on an arm out from the corner post
  const arm = f.beam('timber', 0.05, h - 0.4, -0.9, 0.1, 0.1, 1.4);
  const sign = hangSign(f, arm, [0.1, h - 0.4, -0.5], 'anvil');
  return { hangers: sign ? [sign] : [], coals };
}

/** The water tower: its legs (lengths, bottom up), their lowest joints (and how high), its feet, its middle and spread at the foot. */
export interface Tower {
  top: V3;
  legs: Piece[][];
  joints: V3[];
  joint: number;
  feet: V3[];
  centre: V3;
  spread: number;
  tank: Tank;
}

/** The water tower's tank, for its water (water.ts). */
export interface Tank {
  /** Its axis (x, z), its staves' outer radius, its floor's top and its rim. */
  centre: V3;
  radius: number;
  floor: number;
  rim: number;
  /** The deck it stands on: its half width (it's square round the axis) and its top. */
  deck: number;
  deckTop: number;
  /** Its bottom (four quarter discs): once a tenth of it goes, what water is left goes too. */
  bottom: Piece[];
}

/**
 * A piece whose x and z extents (frame) run straight from their values at y0 to those at y1: a
 * leaning leg, or what meets one (its faces lie in the leg's).
 */
function slant(f: Frame, material: string, y0: number, y1: number, x: (y: number) => [number, number], z: (y: number) => [number, number], tint?: THREE.ColorRepresentation): Piece | null {
  const pts: V3[] = [];
  for (const y of [y0, y1]) {
    const [xa, xb] = x(y);
    const [za, zb] = z(y);
    pts.push([xa, y, za], [xb, y, za], [xa, y, zb], [xb, y, zb]);
  }
  return f.hull(material, pts, { tint, grain: [0, 0, 0, 1], grainAt: [(x(y0)[0] + x(y1)[1]) / 2 + f.rand(), (y0 + y1) / 2, (z(y0)[0] + z(y1)[1]) / 2] });
}

/**
 * The water tower (WT) at (27, -15): four legs leaning in 4° with girts between them at each joint,
 * a plank deck, a stave tank with two hoops, and its roof.
 */
export function waterTower(d: Destruction): Tower {
  const f = new Frame(d, [27, 0, -15], 0, 61);
  const L = 1.75;
  const lw = 0.3;
  const legH = 6.0;
  const lean = Math.tan((4 * Math.PI) / 180);
  // A leg's centre (|x| and |z|) at height y, and its inner face
  const c = (y: number) => L - y * lean;
  const face = (y: number) => c(y) - lw / 2;
  const legs: Piece[][] = [];
  const joints: V3[] = [];
  const feet: V3[] = [];
  for (const sx of [-1, 1])
    for (const sz of [-1, 1]) {
      const leg: Piece[] = [];
      for (let i = 0; i < 4; i++) {
        const p = slant(f, 'timber', i * 1.5, (i + 1) * 1.5, (y) => [sx * c(y) - lw / 2, sx * c(y) + lw / 2], (y) => [sz * c(y) - lw / 2, sz * c(y) + lw / 2]);
        if (p) leg.push(p);
      }
      legs.push(leg);
      joints.push(f.at(sx * c(1.5), 1.5, sz * c(1.5)));
      feet.push(f.at(sx * L, 0, sz * L));
    }
  // Girts at each joint between the legs, on all four sides, in two lengths; their ends lie in the legs' faces
  for (const y of [1.5, 3.0, 4.5]) {
    const g = 0.08;
    for (const sz of [-1, 1]) {
      const zc = sz * c(y);
      for (const half of [-1, 1]) slant(f, 'timber', y - g, y + g, (yy) => (half < 0 ? [-face(yy), 0] : [0, face(yy)]), () => [zc - g, zc + g]);
    }
    for (const sx of [-1, 1]) {
      const xc = sx * c(y + 2 * g);
      for (const half of [-1, 1]) slant(f, 'timber', y + g, y + 3 * g, () => [xc - g, xc + g], (yy) => (half < 0 ? [-face(yy), 0] : [0, face(yy)]));
    }
  }
  // Cap beams on the legs' heads, joists, deck
  const top = c(legH);
  for (const z of [-top, top]) f.beams('timber', -2.2, legH, z - 0.15, 4.4, 0.16, 0.3, 1.5);
  for (const x of [-1.6, -0.55, 0.55, 1.6]) f.beams('timber', x - 0.06, legH + 0.16, -2.2, 0.12, 0.08, 4.4, 1.5);
  const dy = legH + 0.24;
  for (let i = 0; i < 3; i++) for (let j = 0; j < 4; j++) f.box('timber', -2.2 + (i * 4.4) / 3, dy, -2.2 + j * 1.1, 4.4 / 3, 0.06, 1.1, { tint: 0xd0c4b0 });
  // The tank: 16 staves round, two high; a floor of four quarter discs; two iron hoops
  const base = dy + 0.06;
  const R = 2.0;
  const n = 16;
  const staves: Piece[] = [];
  for (let k = 0; k < n; k++) {
    const a0 = (k / n) * Math.PI * 2;
    const a1 = ((k + 1) / n) * Math.PI * 2;
    for (const level of [0, 1]) {
      const p = f.hull('stave', arcBlock(R - 0.08, R, a0, a1, 1.6).map(([x, y, z]) => [x, base + level * 1.6 + y, z] as V3), { tint: 0xc0b098 });
      if (p && level === 1) staves.push(p);
    }
    for (const hy of [0.7, 2.2]) f.hull('iron', arcBlock(R, R + 0.03, a0, a1, 0.08).map(([x, y, z]) => [x, base + hy + y, z] as V3), { tint: 0x5a4a40 });
  }
  const bottom: Piece[] = [];
  for (let q = 0; q < 4; q++) {
    const p = f.hull('stave', sector(R - 0.08, (q * Math.PI) / 2, ((q + 1) * Math.PI) / 2, 4, base, base + 0.06, 0, 0), { tint: 0xb8a890 });
    if (p) bottom.push(p);
  }
  // A shallow cone of a roof: sixteen thin wedges, each on the stave under it. They stand a few
  // millimetres apart, held to each other by small bonds, so it lands as slices, not a wheel
  const ry = base + 3.2;
  const roof: Array<Piece | null> = [];
  const gap = 0.002;
  for (let k = 0; k < 16; k++) {
    const a0 = (k / 16) * Math.PI * 2 + gap;
    const a1 = ((k + 1) / 16) * Math.PI * 2 - gap;
    const am = (a0 + a1) / 2;
    const rim = R + 0.15;
    const tip: V3 = [Math.cos(am) * 0.03, 0, Math.sin(am) * 0.03];
    const pts: V3[] = [
      [tip[0], ry + 0.75, tip[2]],
      [tip[0], ry + 0.785, tip[2]],
    ];
    for (const a of [a0, a1]) pts.push([Math.cos(a) * rim, ry - 0.05, Math.sin(a) * rim], [Math.cos(a) * rim, ry - 0.015, Math.sin(a) * rim]);
    const w = f.hull('stave', pts, { tint: 0xa89880 });
    roof.push(w);
    f.bond(w, staves[k], 0.015);
  }
  // Joints that falling, give at a knock (a bond's joint holds its area times the staves' strength)
  roof.forEach((w, k) => f.bond(w, roof[(k + 1) % 16], 0.003));
  // The ladder up the street-side leg's outer face, leaning with it: two rails and 18 rungs
  const out = (y: number): [number, number] => [c(y) + lw / 2, c(y) + lw / 2 + 0.06];
  for (const [a, b] of [
    [-lw / 2, -lw / 2 + 0.06],
    [lw / 2 - 0.06, lw / 2],
  ])
    for (let i = 0; i < 4; i++) slant(f, 'timber', i * 1.5, (i + 1) * 1.5, (y) => [c(y) + a, c(y) + b], out, 0xb8a890);
  for (let k = 1; k <= 18; k++) slant(f, 'timber', k * 0.32, k * 0.32 + 0.04, (y) => [c(y) - lw / 2 + 0.06, c(y) + lw / 2 - 0.06], (y) => [c(y) + lw / 2, c(y) + lw / 2 + 0.05], 0xb8a890);
  // The spout: a chute hanging off the tank toward the street on a bond
  const spout = f.tilt('stave', [0, base + 1.9, R + 0.75], [0.3, 1.6, 0.12], quatFromAxisAngle([1, 0, 0], 1.0));
  f.bond(spout, staves[4], 0.01);
  const tank: Tank = { centre: f.at(0, base, 0), radius: R, floor: base + 0.06, rim: base + 3.2, deck: 2.2, deckTop: base, bottom };
  return { top: f.at(0, ry + 0.82, 0), legs, joints, joint: 1.5, feet, centre: f.at(0, 0, 0), spread: L, tank };
}

/**
 * The windmill (WM) at (-28, 16) and its stock tank. Returns the gearbox (the wheel rides on it),
 * the hub, and the platform's corner toward the street (a hawk's perch) with the platform.
 */
export function windmill(d: Destruction): { gearbox: Piece | null; hub: V3; roost: { at: V3; piece: Piece | null } } {
  const f = new Frame(d, [-28, 0, 16], 0, 71);
  const L = 0.7;
  const lw = 0.16;
  const H = 8.0;
  const legs: Piece[][] = [];
  for (const x of [-L, L]) for (const z of [-L, L]) legs.push(f.post('timber', x - lw / 2, 0, z - lw / 2, lw, H, lw, 1.6));
  const span = 2 * L - lw;
  const levels = [1.6, 3.2, 4.8, 6.4];
  for (const y of levels) {
    for (const z of [-L, L]) f.beam('timber', -L + lw / 2, y - 0.06, z - 0.06, span, 0.12, 0.12);
    for (const x of [-L, L]) f.beam('timber', x - 0.06, y + 0.06, -L + lw / 2, 0.12, 0.12, span);
  }
  // Iron X-rods on alternate levels, outside the legs, held at their ends by bonds
  for (const [y0, y1] of [
    [0.2, 1.6],
    [3.2, 4.8],
  ]) {
    const h = y1 - y0;
    const len = Math.hypot(2 * L, h);
    const ang = Math.atan2(2 * L, h);
    for (const side of [-1, 1]) {
      for (const [sgn, off] of [
        [1, 0.0125],
        [-1, 0.0375],
      ] as const) {
        const z = side * (L + lw / 2 + off);
        const rod = f.tilt('iron', [0, (y0 + y1) / 2, z], [0.025, len, 0.025], quatFromAxisAngle([0, 0, 1], sgn * ang), { tint: 0x4a4440 });
        // Ends to the legs they cross at
        const near = (p: Piece) => {
          const b = p.bounds;
          return Math.abs((b.min[2] + b.max[2]) / 2 - (16 + side * L)) < 0.2 && b.min[1] < y1 && b.max[1] > y0;
        };
        for (const leg of legs.flat().filter(near)) f.bond(rod, leg, 0.004);
      }
    }
  }
  // Platform, gearbox, shaft, boom and tail vane, the pump rod down to its stand
  const platform = f.box('timber', -0.8, H, -0.8, 1.6, 0.08, 1.6, { tint: 0xc0b098 });
  const gearbox = f.box('iron', -0.25, H + 0.08, -0.2, 0.5, 0.4, 0.4, { tint: 0x6a5a4a });
  f.beam('iron', -0.95, H + 0.24, -0.04, 0.7, 0.08, 0.08, { tint: 0x4a4440 });
  f.beam('iron', 0.25, H + 0.25, -0.025, 1.6, 0.05, 0.05, { tint: 0x4a4440 });
  f.box('tin', 1.85, H - 0.15, -0.015, 1.5, 0.9, 0.03, { tint: 0xe8e0d8 });
  f.box('timber', -0.2, 0, -0.2, 0.4, 0.9, 0.4);
  for (let k = 0; k < 5; k++) f.box('iron', -0.02, 0.9 + (k * (H - 0.9)) / 5, -0.02, 0.04, (H - 0.9) / 5, 0.04, { tint: 0x4a4440 });

  // The stock tank: twelve staves and a floor of quarter discs
  const tx = 2.5;
  const tz = -2.0;
  const R = 1.5;
  for (let k = 0; k < 12; k++) f.hull('timber', arcBlock(R - 0.08, R, (k / 12) * Math.PI * 2, ((k + 1) / 12) * Math.PI * 2, 0.7).map(([x, y, z]) => [tx + x, y, tz + z] as V3), { tint: 0xa89478 });
  for (let q = 0; q < 4; q++) f.hull('timber', sector(R - 0.08, (q * Math.PI) / 2, ((q + 1) * Math.PI) / 2, 3, 0, 0.05, tx, tz), { tint: 0x8a7a64 });
  return { gearbox, hub: f.at(-1.0, H + 0.28, 0), roost: { at: f.at(0.5, H + 0.08, -0.55), piece: platform } };
}

// --- Small things -----------------------------------------------------------------------------

/**
 * A barrel: eight staves bellied out (0.26 at the heads, 0.30 at the middle), a head inside each
 * end, and two hoops, a segment on each stave's face. The hoops are dark paint, not iron: iron
 * ones don't break, and a blast throws a few of them 60-80 m (paint ones land within 15 m).
 */
export function barrel(d: Destruction, x: number, y: number, z: number, tint = 0xb09474): void {
  const f = new Frame(d, [x, y, z], 0, Math.round(x * 31 + z * 17));
  const [head, belly, t, h] = [0.26, 0.3, 0.04, 0.86];
  const at = (a: number, r: number, yy: number): V3 => [Math.cos(a) * r, yy, Math.sin(a) * r];
  // The outer face's radius at a height (straight from each head to the middle)
  const outer = (yy: number) => head + (belly - head) * (1 - Math.abs(yy - h / 2) / (h / 2));
  for (let k = 0; k < 8; k++) {
    const [a0, a1] = [(k / 8) * Math.PI * 2, ((k + 1) / 8) * Math.PI * 2];
    const pts: V3[] = [];
    for (const a of [a0, a1]) pts.push(at(a, head - t, 0), at(a, head - t, h), at(a, head, 0), at(a, belly, h / 2), at(a, head, h));
    const v = 0.96 + f.rand() * 0.08;
    f.hull('timber', pts, { tint: new THREE.Color(tint).multiplyScalar(v) });
    // Hoops a little in from each end, lying on the stave's face
    for (const [y0, y1] of [
      [0.12, 0.17],
      [h - 0.17, h - 0.12],
    ]) {
      const inner = [at(a0, outer(y0), y0), at(a1, outer(y0), y0), at(a0, outer(y1), y1), at(a1, outer(y1), y1)];
      let n = normalize(cross(sub(inner[1], inner[0]), sub(inner[2], inner[0])));
      if (dot(n, at((a0 + a1) / 2, 1, 0)) < 0) n = scale(n, -1);
      f.hull('paint', [...inner, ...inner.map((p) => add(p, scale(n, 0.016)))], { tint: 0x3a3430 });
    }
  }
  for (const hy of [0, h - 0.03]) f.hull('timber', octagonHead(head - t, hy, 0.03), { tint: 0x9a8264 });
}

/** A flat eight-sided head whose sides meet the staves' inner faces (corners at k·45°). */
function octagonHead(r: number, y: number, t: number): V3[] {
  const pts: V3[] = [];
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2;
    pts.push([Math.cos(a) * r, y, Math.sin(a) * r], [Math.cos(a) * r, y + t, Math.sin(a) * r]);
  }
  return pts;
}

export function crate(d: Destruction, x: number, y: number, z: number, s: number, tint = 0xe8d8c0): void {
  d.addBox({ material: 'siding', size: [s, s, s], position: [x, y + s / 2, z], tint });
}

/**
 * A bale 1.0 × 0.45 × 0.5 along the frame's x from its min corner: three slabs side by side, and
 * two strands of twine running along it between them (over the top and round the ends).
 */
function baleIn(f: Frame, x: number, y: number, z: number): void {
  const tw = 0.008;
  const slab = (0.5 - 2 * tw) / 3;
  // One bale one shade (slabs of different shades read as planks)
  const shade = [0xfff4dc, 0xf2e6c8, 0xf8eed2][Math.floor(f.rand() * 3)];
  let at = z;
  for (let i = 0; i < 3; i++) {
    f.box('hay', x, y, at, 1.0, 0.45, slab, { tint: shade });
    at += slab;
    if (i === 2) break;
    f.box('hay', x, y, at, 1.0, 0.45, tw, { tint: 0x9a7a4a });
    at += tw;
  }
}

export function bale(d: Destruction, x: number, z: number, along: 'x' | 'z', y = 0): void {
  // A frame turned a quarter for a bale along z (its x then runs along the world's -z)
  const f = new Frame(d, [x, y, z], along === 'x' ? 0 : Math.PI / 2, Math.round(x * 11 + z * 5));
  baleIn(f, -0.5, 0, -0.25);
}

/** A hitching rail: three posts on the dirt, two rails along x on top. */
export function hitchingRail(d: Destruction, x: number, z: number): void {
  const f = new Frame(d, [x, 0, z], 0, Math.round(x * 7));
  for (const px of [-1.2, 0, 1.2]) f.box('timber', px - 0.06, 0, -0.06, 0.12, 1.0, 0.12);
  for (const x0 of [-1.26, 0]) f.beam('timber', x0, 1.0, -0.05, 1.26, 0.1, 0.1);
}

/** A water trough: a bottom on two blocks, two sides, two ends. */
export function trough(d: Destruction, x: number, z: number): void {
  const f = new Frame(d, [x, 0, z], 0, Math.round(x * 13));
  for (const bx of [-0.8, 0.6]) f.box('timber', bx, 0, -0.3, 0.2, 0.2, 0.6);
  f.beam('timber', -1.0, 0.2, -0.3, 2.0, 0.06, 0.6, { tint: 0x8a7a64 });
  for (const zz of [-0.3, 0.25]) f.beam('timber', -1.0, 0.26, zz, 2.0, 0.5, 0.05);
  for (const xx of [-1.0, 0.95]) f.box('timber', xx, 0.26, -0.25, 0.05, 0.5, 0.5);
}

export function bench(d: Destruction, x: number, y: number, z: number): void {
  const f = new Frame(d, [x, y, z], 0, Math.round(x * 3));
  for (const lx of [-0.7, 0.62]) f.box('timber', lx, 0, -0.17, 0.08, 0.42, 0.34);
  f.beam('timber', -0.8, 0.42, -0.18, 1.6, 0.05, 0.36, { tint: 0x9a8a74 });
}

/** The barber's pole beside an awning post: red and white lengths, a cap, an iron bracket to the post. */
export function barberPole(d: Destruction, post: V3): void {
  const f = new Frame(d, post, 0, 5);
  const r = 0.07;
  const x = -0.075 - 0.03 - r * Math.cos(Math.PI / 8);
  let prev: Piece | null = null;
  for (let k = 0; k < 6; k++) {
    const p = f.hull('paint', octo(r, 0.25, x, 1.2 + k * 0.25, 0), { tint: k % 2 ? 0xf2ead8 : 0xb03a2e, smooth: 1 });
    f.bond(p, prev, 0.01);
    prev = p;
  }
  f.hull('paint', octo(r + 0.02, 0.08, x, 2.7, 0), { tint: 0xd8c08a, smooth: 1 });
  const bracket = f.box('iron', -0.075 - 0.03, 2.3, -0.02, 0.03, 0.05, 0.04, { tint: 0x3a3a3a });
  f.bond(bracket, prev, 0.004);
}

/** A telegraph pole: four lengths, a crossarm, two green glass insulators. Returns its top and its top length (a hawk's perch). */
export function telegraph(d: Destruction, x: number, z: number): { at: V3; piece: Piece | null } {
  const f = new Frame(d, [x, 0, z], 0, 9);
  const r = 0.11;
  let top: Piece | null = null;
  for (let k = 0; k < 4; k++) top = f.hull('timber', octo(r, 1.875, 0, k * 1.875, 0), { tint: 0x9a8a74, smooth: 1 });
  const fx = r * Math.cos(Math.PI / 8);
  f.beam('timber', fx, 6.9, -0.6, 0.1, 0.1, 1.2);
  for (const zz of [-0.45, 0.45]) f.hull('glass', octo(0.035, 0.1, fx + 0.05, 7.0, zz), { tint: 0x4a8a5a, smooth: 1 });
  return { at: f.at(0, 7.5, 0), piece: top };
}

/** The corral behind the smithy: posts every 2 m, two rails between each pair. */
export function corral(d: Destruction): void {
  const f = new Frame(d, [0, 0, 0], 0, 81);
  const [x0, x1, z0, z1] = [13.2, 23.8, -23.8, -16.2];
  const side = (ax: number, az: number, bx: number, bz: number, gate: boolean) => {
    const len = Math.hypot(bx - ax, bz - az);
    const n = Math.round(len / 2);
    for (let i = 0; i <= n; i++) {
      const px = ax + ((bx - ax) * i) / n;
      const pz = az + ((bz - az) * i) / n;
      if (i < n) f.box('timber', px - 0.075, 0, pz - 0.075, 0.15, 1.6, 0.15);
      if (i === n) continue;
      if (gate && i === Math.floor(n / 2)) continue;
      const qx = ax + ((bx - ax) * (i + 1)) / n;
      const qz = az + ((bz - az) * (i + 1)) / n;
      for (const y of [0.7, 1.3]) {
        if (az === bz) f.beam('timber', Math.min(px, qx) + 0.075, y, pz - 0.04, Math.abs(qx - px) - 0.15, 0.14, 0.08);
        else f.beam('timber', px - 0.04, y, Math.min(pz, qz) + 0.075, 0.08, 0.14, Math.abs(qz - pz) - 0.15);
      }
    }
  };
  side(x0, z1, x1, z1, true);
  side(x1, z1, x1, z0, false);
  side(x1, z0, x0, z0, false);
  side(x0, z0, x0, z1, false);
}

/** The outhouse behind the sheriff's: siding on corner posts, a plank door, a shed roof. */
export function outhouse(d: Destruction): void {
  const f = new Frame(d, [-5.4, 0, -21.9], Math.PI, 91);
  const W = 1.2;
  const t = 0.06;
  f.beams('timber', -0.02, 0, -0.02, W + 0.04, 0.12, W + 0.04);
  const posts = [0.04, W - 0.04];
  wall(f, { material: 'siding', axis: 'x', at: 0, t, from: 0, to: W, y0: 0.12, course: 0.45, top: 2.3, posts, pw: 0.08, holes: [{ a: 0.2, b: 1.0, y0: 0.12, y1: 1.92 }], tint: 0xc9c3b8 });
  f.box('timber', 0.2, 0.12, 0.01, 0.8, 1.8, 0.04, { tint: 0xa89880 });
  for (const x of [0, W - t]) wall(f, { material: 'siding', axis: 'z', at: x, t, from: t, to: W, y0: 0.12, course: 0.45, top: [[t, 2.3], [W, 2.0]], tint: 0xc9c3b8 });
  wall(f, { material: 'siding', axis: 'x', at: W - t, t, from: t, to: W - t, y0: 0.12, course: 0.45, top: 2.0, tint: 0xc9c3b8 });
  const pitch = Math.atan2(0.3, W - t);
  slope(f, { axis: 'z', eave: W, y: 2.0, dir: -1, pitch, run: W - t, overhang: 0.15, lines: [0.03, W - 0.03], across: [-0.1, W + 0.1], cover: 'timber', sheet: 0.04, depth: 0.04, width: 0.06 });
}
