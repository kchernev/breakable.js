// What's in the alley besides the buildings: roller shutters and awnings on the shops, the lantern
// gate at the mouth, strings of paper lanterns and power cables slung between the facades, the
// glass footbridge, vending machines and the transformer box that feeds the signs.

import type { Destruction, Piece, Q, V3 } from '../../../lib/index.ts';
import { cross, normalize, quatFromAxisAngle, rotate } from '../../../lib/index.ts';
import { BRIDGE, FRONT, type Frame, GATE, levelY, TS } from './layout.ts';
import type { Shop } from './buildings.ts';
import { glow } from './materials.ts';
import { lightbox, type Plane, type Sign, signs, tube } from './signs.ts';

interface Thing {
  pieces: Piece[];
  centre: V3;
}

/** Shutters (their rattle and the shop alarms), awnings (the rain on them). */
export const shutters: Thing[] = [];
export const awnings: Thing[] = [];
/** The transformer box: breaking it blacks out the street. */
export const transformer: { piece: Piece | null } = { piece: null };
/** What each point light hangs on (it fades when they've fallen). */
export const structures: Record<'gate' | 'bridge', Piece[]> = { gate: [], bridge: [] };
/** The dark slot between S2 and S3 (x0 … x1, south of the facades), where the steam pipes run. */
export const SLOT = { x0: -12.53, x1: -11 };

/** One slat course: four of the texture's 11 slats a metre, so piece seams fall on slat seams. */
const SLAT = 4 / 11;
const SHUTTER_TINTS = [0xffffff, 0xb8c8b8, 0xb0bccc];
/** Lantern paper: a deep red (brighter reds go salmon under tone mapping) and an amber. */
const RED = 0xc01005;
const AMBER = 0xe0701a;

/** The facade piece at (lx, y) of a frame: the first standing piece just behind its face, up to 0.35 deep. */
function facadeAt(d: Destruction, f: Frame, lx: number, y: number): Piece | null {
  const near = d.all().filter((p) => p.state === 'fixed');
  for (let lz = 0.01; lz < 0.35; lz += 0.03) {
    const q = f.at(lx, y, lz);
    const p = near.find((o) => [0, 1, 2].every((k) => q[k] > o.bounds.min[k] - 0.005 && q[k] < o.bounds.max[k] + 0.005));
    if (p) return p;
  }
  return null;
}

/**
 * A roller shutter across an opening from lx0 to lx1, from y0 up to y1 (the fascia or beam): its
 * box at the top, guides at the ends against the piers, and slats stacked between them.
 */
export function shutter(d: Destruction, f: Frame, lx0: number, lx1: number, y0: number, y1: number, rand: () => number): Thing {
  const pieces: Piece[] = [];
  const push = (p: Piece | null) => p && pieces.push(p);
  const g = 0.06;
  const n = Math.floor((y1 - y0 - 0.35) / SLAT);
  const top = y0 + n * SLAT;
  const tint = SHUTTER_TINTS[Math.floor(rand() * SHUTTER_TINTS.length)];
  const textureFrame = { position: f.at(lx0, y0, 0.1), rotation: [0, 0, 0, 1] as Q };
  // The box, flush with the facade, under what's above
  const w = lx1 - lx0;
  const nb = Math.max(1, Math.round(w / 2.2));
  for (let i = 0; i < nb; i++) push(f.box(d, 'signbox', lx0 + (i * w) / nb, top, 0, w / nb, y1 - top, 0.35, { tint: 0x4a4e56 }));
  for (const x of [lx0, lx1 - g]) push(f.box(d, 'steel', x, y0, 0.06, g, top - y0, 0.1));
  const sw = w - 2 * g;
  const ns = Math.max(1, Math.ceil(sw / 2.2));
  for (let k = 0; k < n; k++)
    for (let i = 0; i < ns; i++) push(f.box(d, 'shutter', lx0 + g + (i * sw) / ns, y0 + k * SLAT, 0.095, sw / ns, SLAT, 0.03, { tint, textureFrame }));
  const thing = { pieces, centre: f.at((lx0 + lx1) / 2, (y0 + y1) / 2, 0) };
  shutters.push(thing);
  return thing;
}

/** A sheet tilted about its frame's along axis, `angle` down from level going out. */
function tilt(f: Frame, angle: number): Q {
  const q = quatFromAxisAngle(f.along, angle);
  // Whichever sign takes the out direction down
  return rotate(q, f.out)[1] < 0 ? q : quatFromAxisAngle(f.along, -angle);
}

/**
 * An awning over a shop front from lx0 to lx1, its top edge on the facade at y: a striped sheet
 * 1.2 deep tilted 15° down, in pieces of at most 2 m, on two steel arms. Both touch the facade only
 * at an edge, so they're bonded to it.
 */
export function awning(d: Destruction, f: Frame, lx0: number, lx1: number, y: number, tint: number): Thing {
  const pieces: Piece[] = [];
  const a = (15 * Math.PI) / 180;
  const depth = 1.2;
  const th = 0.04;
  const q = tilt(f, a);
  const [c, s] = [Math.cos(a), Math.sin(a)];
  const w = lx1 - lx0;
  const n = Math.max(1, Math.round(w / 2));
  const sheets: Piece[] = [];
  for (let i = 0; i < n; i++) {
    const lx = lx0 + ((i + 0.5) * w) / n;
    // Its top face runs from the facade at y down and out (its back edge just clear of the wall)
    const at = f.at(lx, y - (depth / 2) * s - (th / 2) * c, -(depth / 2) * c + (th / 2) * s - th * s - 0.005);
    const p = d.addBox({ material: 'awning', size: f.size(w / n, th, depth), position: at, rotation: q, tint, textureFrame: { position: f.at(lx0, 0, 0), rotation: [0, 0, 0, 1] } });
    if (!p) continue;
    sheets.push(p);
    pieces.push(p);
    const wall = facadeAt(d, f, lx, y - 0.02);
    if (wall) d.bond(p, wall, 0.01);
  }
  // The arms: from the facade 0.6 below, up and out to under the sheet's front
  for (const lx of [lx0 + 0.15, lx1 - 0.15]) {
    const arm = rod(d, 'steel', f.at(lx, y - 0.6, -0.03), f.at(lx, y - 0.9 * depth * s - th - 0.04, -0.9 * depth * c), 0.04);
    if (!arm) continue;
    pieces.push(arm);
    const wall = facadeAt(d, f, lx, y - 0.6);
    if (wall) d.bond(arm, wall, 0.004);
    const sheet = sheets[Math.min(sheets.length - 1, Math.floor(((lx - lx0) / w) * sheets.length))];
    if (sheet) d.bond(arm, sheet, 0.004);
  }
  const thing = { pieces, centre: f.at((lx0 + lx1) / 2, y - 0.3, -0.6) };
  awnings.push(thing);
  return thing;
}

/** The lanterns built (wet.ts reflects each string): by string, the gate's last. */
export const lanternGroups: Piece[][] = [];

/** A flat ten-sided disc of radius r from y0 to y1 about (x, z). */
function disc(x: number, z: number, r: number, y0: number, y1: number): V3[] {
  const pts: V3[] = [];
  for (let k = 0; k < 10; k++) for (const y of [y0, y1]) pts.push([x + Math.cos((k * Math.PI) / 5) * r, y, z + Math.sin((k * Math.PI) / 5) * r]);
  return pts;
}

/**
 * A paper lantern: a ten-sided barrel under a dark lacquered cap, another cap under it and a short
 * tassel; its top (the cap's top) at `top`. Returns its parts, the barrel first (none: not made).
 */
export function lantern(d: Destruction, top: V3, tint: number): Piece[] {
  const [x, , z] = top;
  const cap = 0.03;
  const y = top[1] - cap - 0.6;
  const rings: Array<[number, number]> = [
    [0, 0.14],
    [0.1, 0.21],
    [0.3, 0.24],
    [0.5, 0.21],
    [0.6, 0.14],
  ];
  const points: V3[] = [];
  for (const [h, r] of rings) for (let k = 0; k < 10; k++) points.push([x + Math.cos((k * Math.PI) / 5) * r, y + h, z + Math.sin((k * Math.PI) / 5) * r]);
  // Shaded round, its ribs drawn (materials.ts)
  const p = d.addConvex({ material: 'lantern', points, tint, smooth: 0.8 });
  if (!p) return [];
  glow.light(p);
  const lacquer = 0x3a2018;
  const parts = [
    p,
    d.addConvex({ material: 'wood', points: disc(x, z, 0.15, y + 0.6, y + 0.6 + cap), tint: lacquer }),
    d.addConvex({ material: 'wood', points: disc(x, z, 0.15, y - cap, y), tint: lacquer }),
    d.addBox({ material: 'steel', size: [0.02, 0.12, 0.02], position: [x, y - cap - 0.06, z], tint: 0x8a1810 }),
  ];
  return parts.filter((q): q is Piece => q !== null);
}

/** A box from a to b (its long axis), `thick` square, not bonded by contact. */
function rod(d: Destruction, material: string, a: V3, b: V3, thick: number, tint?: number): Piece | null {
  const dir = normalize([b[0] - a[0], b[1] - a[1], b[2] - a[2]]);
  const len = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
  const axis = cross([0, 0, 1], dir);
  const sin = Math.hypot(...axis);
  const q: Q = sin < 1e-6 ? [0, 0, 0, 1] : quatFromAxisAngle(normalize(axis), Math.atan2(sin, dir[2]));
  return d.addBox({ material, size: [thick, thick, len], position: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2], rotation: q, tint, bond: false });
}

/** A cable slung across the alley (life.ts hangs what's left of it from the facades once it's struck). */
export interface Sling {
  /** From one end to the other, and where each was built. */
  segments: Piece[];
  built: V3[];
  /** The points between segments i and i + 1, and what hangs at each (a lantern's parts). */
  joints: V3[];
  hung: Piece[][];
  /** The facade pieces its ends are tied to, and where. */
  ends: [Piece, Piece];
  at: [V3, V3];
  /** A power cable (it sparks where it's cut). */
  power: boolean;
}

export const slings: Sling[] = [];

/**
 * Something slung across the alley from `a` to `b` (on the facades) with `sag`: `n` segments,
 * bonded end to end and to the facade pieces at both ends.
 */
function sling(d: Destruction, a: V3, b: V3, sag: number, n: number, thick: number, tint: number, ends: [Piece, Piece], power: boolean): Sling {
  const pts: V3[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    pts.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t - sag * 4 * t * (1 - t), a[2] + (b[2] - a[2]) * t]);
  }
  const segments: Piece[] = [];
  for (let i = 0; i < n; i++) {
    // Shortened a little at each end, so neighbours don't overlap where they meet at an angle
    const [p, q] = [pts[i], pts[i + 1]];
    const k = 0.012 / Math.hypot(q[0] - p[0], q[1] - p[1], q[2] - p[2]);
    const s = rod(d, 'steel', [p[0] + (q[0] - p[0]) * k, p[1] + (q[1] - p[1]) * k, p[2] + (q[2] - p[2]) * k], [q[0] - (q[0] - p[0]) * k, q[1] - (q[1] - p[1]) * k, q[2] - (q[2] - p[2]) * k], thick, tint);
    if (!s) continue;
    if (segments.length) d.bond(segments[segments.length - 1], s, 0.002, p);
    segments.push(s);
  }
  if (segments.length) {
    d.bond(segments[0], ends[0], 0.002, a);
    d.bond(segments[segments.length - 1], ends[1], 0.002, b);
  }
  const joints = pts.slice(1, -1);
  const made: Sling = { segments, built: segments.map((s) => [...s.pose.position]), joints, hung: joints.map(() => []), ends, at: [a, b], power };
  slings.push(made);
  return made;
}

/** Where a line across the alley at (x, y) meets each facade, and the pieces there. */
function anchors(d: Destruction, x: number, y: number): Array<{ at: V3; piece: Piece }> | null {
  const out: Array<{ at: V3; piece: Piece }> = [];
  for (const side of [-1, 1]) {
    const h = d.raycast([x, y, 0], [0, 0, side], 6);
    // On the facade itself (or a flat sign on it), not on what sticks out
    if (!h || Math.abs(h.point[2]) < FRONT - 0.08) return null;
    out.push({ at: h.point, piece: h.piece });
  }
  return out;
}

/** A string of paper lanterns across the alley at x, from facade to facade at y with 0.6 m of sag. */
export function lanternString(d: Destruction, x: number, y: number, rand: () => number): void {
  // At y, or a little above or below where something sticks out there
  const ends = anchors(d, x, y) ?? anchors(d, x, y + 0.15) ?? anchors(d, x, y - 0.15);
  if (!ends) return;
  const cable = sling(d, ends[0].at, ends[1].at, 0.6, 6, 0.02, 0x15161a, [ends[0].piece, ends[1].piece], false);
  const group: Piece[] = [];
  lanternGroups.push(group);
  cable.joints.forEach((j, i) => {
    // Hung 4 cm under the cable
    const parts = lantern(d, [j[0], j[1] - 0.04, j[2]], rand() < 0.7 ? RED : AMBER);
    if (!parts.length) return;
    cable.hung[i] = parts;
    group.push(parts[0]);
    // From the segments meeting at the joint
    for (const s of cable.segments) if (Math.hypot(s.pose.position[2] - j[2], s.pose.position[1] - j[1]) < 0.8) d.bond(parts[0], s, 0.004, j);
  });
}

/** Power cables slung across the alley at random, clear of the bridge and of what stands. */
export function cables(d: Destruction, count: number, rand: () => number): void {
  let made = 0;
  for (let tries = 0; made < count && tries < 120; tries++) {
    const x = -24 + rand() * 53;
    const y = 5 + rand() * 8;
    if (x > 5.2 && x < 10 && y > 8.4) continue;
    const a = anchors(d, x, y);
    const b = anchors(d, x + (rand() - 0.5) * 3, 5 + rand() * 8);
    if (!a || !b) continue;
    const [p, q] = [a[0], b[1]];
    const sag = 0.3 + rand() * 0.7;
    // Nothing in the way: each segment's box against what stands (the facades aside)
    const pts: V3[] = [];
    for (let i = 0; i <= 6; i++) {
      const t = i / 6;
      pts.push([p.at[0] + (q.at[0] - p.at[0]) * t, p.at[1] + (q.at[1] - p.at[1]) * t - sag * 4 * t * (1 - t), p.at[2] + (q.at[2] - p.at[2]) * t]);
    }
    const all = d.all().filter((o) => Math.abs(o.bounds.min[2] + o.bounds.max[2]) / 2 < FRONT - 0.1 || o.bounds.max[2] - o.bounds.min[2] > 1);
    const clear = pts.slice(1).every((e, i) => {
      const s = pts[i];
      const min = [0, 1, 2].map((k) => Math.min(s[k], e[k]) - 0.04);
      const max = [0, 1, 2].map((k) => Math.max(s[k], e[k]) + 0.04);
      return !all.some((o) => [0, 1, 2].every((k) => o.bounds.min[k] < max[k] && o.bounds.max[k] > min[k]));
    });
    if (!clear) continue;
    sling(d, p.at, q.at, sag, 6, 0.03, 0x15161a, [p.piece, q.piece], true);
    made++;
  }
}

/** The lantern gate at the alley's mouth: red posts and beams, a lightbox, five lanterns. */
export function gate(d: Destruction): void {
  const x0 = GATE.x - 0.175;
  const w = 0.35;
  const red = 0xb83a28;
  const parts = structures.gate;
  const push = (p: Piece | null) => p && parts.push(p);
  const frame = { position: [x0, 0, 0] as V3, rotation: [0, 0, 0, 1] as Q };
  for (const z of [-3.2, 3.2]) for (let k = 0; k < 3; k++) push(d.addBox({ material: 'wood', size: [w, GATE.posts / 3, w], position: [GATE.x, ((k + 0.5) * GATE.posts) / 3, z], tint: red, textureFrame: frame }));
  // The tie beam in four, the top beam over it in five with its joints between the tie beam's
  const z0 = -3.55;
  const L = 7.1;
  for (let i = 0; i < 4; i++) push(d.addBox({ material: 'wood', size: [w, 0.35, L / 4], position: [GATE.x, 4.975, z0 + ((i + 0.5) * L) / 4], tint: red, textureFrame: frame }));
  const cuts = [0, L / 8, (3 * L) / 8, (5 * L) / 8, (7 * L) / 8, L];
  for (let i = 0; i < 5; i++) push(d.addBox({ material: 'wood', size: [w + 0.1, 0.3, cuts[i + 1] - cuts[i]], position: [GATE.x, 5.3, z0 + (cuts[i] + cuts[i + 1]) / 2], tint: 0xa83224, textureFrame: frame }));
  // The name board on the street side (amber glyphs), its face on the tie beam's -x face
  const sign: Sign = { pieces: [], centre: [x0, 5.0, 0], color: 0xffa040 };
  const board = lightbox(d, [x0 - 0.015, 4.87, 0], [0.03, 0.54, 1.6], [-1, 0, 0], 0xffa040, 0.5, 0, 0, [0.05, 0.02]);
  if (board) sign.pieces.push(board);
  push(board);
  signs.push(sign);
  // Lanterns on cords from the tie beam
  const group: Piece[] = [];
  lanternGroups.push(group);
  for (const z of [-2.4, -1.2, 0, 1.2, 2.4]) {
    const cord = d.addBox({ material: 'steel', size: [0.02, 0.3, 0.02], position: [GATE.x, 4.8 - 0.15, z], tint: 0x15161a });
    push(cord);
    const [l] = lantern(d, [GATE.x, 4.5, z], z === 0 ? AMBER : RED);
    if (!l) continue;
    push(l);
    group.push(l);
  }
}

/**
 * The footbridge between N5 and S5 at level 3: a concrete deck on steel edge beams, posts, glass
 * sides, a sheet-metal roof with a lamp strip under it, a cyan neon line along both sides of the
 * deck and a magenta one along the roof's edges.
 */
export function bridge(d: Destruction): void {
  const parts = structures.bridge;
  const push = (p: Piece | null) => p && parts.push(p);
  const { x0, x1 } = BRIDGE;
  const y = levelY(BRIDGE.level);
  const xc = (x0 + x1) / 2;
  const w = x1 - x0;
  const n = 5;
  const span = (2 * FRONT) / n;
  for (let i = 0; i < n; i++) {
    const z = -FRONT + (i + 0.5) * span;
    push(d.addBox({ material: 'concrete', size: [w, TS, span], position: [xc, y + TS / 2, z], tint: 0xc8ccd0 }));
    for (const x of [x0 + 0.1, x1 - 0.1]) push(d.addBox({ material: 'steel', size: [0.2, 0.36, span], position: [x, y - 0.18, z] }));
    push(d.addBox({ material: 'signbox', size: [w + 0.2, 0.1, span], position: [xc, y + TS + 2.4 + 0.05, z], tint: 0x3a3e46 }));
  }
  // Posts at the deck's joints, glass between
  const top = y + TS;
  for (const x of [x0 + 0.04, x1 - 0.04]) {
    for (let i = 0; i <= n; i++) {
      const z = Math.min(FRONT - 0.04, Math.max(-FRONT + 0.04, -FRONT + i * span));
      push(d.addBox({ material: 'steel', size: [0.08, 2.4, 0.08], position: [x, top + 1.2, z] }));
    }
    for (let i = 0; i < n; i++) {
      const za = -FRONT + i * span + (i === 0 ? 0.08 : 0.04);
      const zb = -FRONT + (i + 1) * span - (i === n - 1 ? 0.08 : 0.04);
      push(d.addBox({ material: 'glass', size: [0.03, 2.2, zb - za], position: [x, top + 1.1, (za + zb) / 2] }));
    }
  }
  // A cool lamp strip under the roof, down the middle: the lit inside shows through the glass
  const roofY = top + 2.4;
  for (let i = 0; i < n; i++) {
    const l = d.addBox({ material: 'lamp', size: [0.32, 0.04, span - 0.1], position: [xc, roofY - 0.02, -FRONT + (i + 0.5) * span], tint: 0xd8ecff });
    glow.light(l);
    if (l) glow.set(l, 2.2);
    push(l);
  }
  // The cyan underline on both side faces of the deck, a magenta line along both edges of the roof
  const sign: Sign = { pieces: [], centre: [xc, y, 0], color: 0x22e6ff };
  for (const s of [-1, 1])
    for (const [x, ly, c] of [
      [s < 0 ? x0 : x1, y + TS / 2, 0x22e6ff],
      [s < 0 ? x0 - 0.1 : x1 + 0.1, roofY + 0.05, 0xff2bd6],
    ]) {
      const plane: Plane = { o: [x, ly, -FRONT], right: [0, 0, 1], up: [0, 1, 0], n: [s, 0, 0] };
      for (let i = 0; i < n; i++) {
        const p = tube(d, plane, i * span + 0.02, 0, (i + 1) * span - 0.02, 0, c);
        if (p) sign.pieces.push(p);
      }
    }
  signs.push(sign);
}

const VENDING = [0xc8202a, 0xe8eef2, 0x2050c0, 0x20a060];
const CANS = [0xff3020, 0x3070ff, 0x30d070, 0xffb020];

/** A box that glows evenly (a lightbox on a blank of the atlas), at `level`. */
function glowBox(d: Destruction, size: V3, at: V3, tint: number, level: number): Piece | null {
  const p = d.addBox({ material: 'lightbox', size, position: at, tint });
  glow.light(p, [0, 0.004, 0.004]);
  if (p) glow.set(p, level);
  return p;
}

/**
 * Vending machines in front of S6 (free standing, 0.02 off the wall), clear of its shop's door: a
 * body in the machine's colour with a lit header, a bright window of cans in three coloured rows
 * behind glass, a column of lit buttons, a coin panel and the pickup slot.
 */
export function vendingMachines(d: Destruction, shops: Shop[]): void {
  const zb = -FRONT + 0.02;
  // Along S6's front (9.5 … 15.5 between its columns), stepping over its door
  const door = shops.find((s) => s.out[2] > 0.5 && s.door[0] > 9 && s.door[0] < 16)?.door[0] ?? -99;
  let left = 9.6;
  for (let i = 0; i < 4; i++) {
    if (left + 0.9 > door - 0.65 && left < door + 0.65) left = door + 0.65;
    const x = left + 0.45;
    left += 0.95;
    const tint = VENDING[i];
    const zc = zb + 0.35;
    // Its body: a round into it counts against the machine as one into its lit front does (life.ts)
    for (const [h, y] of [
      [1.0, 0.5],
      [0.85, 1.425],
    ]) {
      const body = d.addBox({ material: 'signbox', size: [0.9, h, 0.7], position: [x, y, zc], tint });
      if (body) glow.tag(body, signs.length);
    }
    const zf = zb + 0.7;
    const sign: Sign = { pieces: [], centre: [x, 1.3, zf], color: 0xfff4e0 };
    const lit = (p: Piece | null) => p && sign.pieces.push(p);
    // The header in the machine's colour, the window warm white
    lit(glowBox(d, [0.84, 0.14, 0.03], [x, 1.73, zf + 0.015], tint === 0xe8eef2 ? 0x8ad8ff : tint, 2.2));
    lit(glowBox(d, [0.64, 0.65, 0.02], [x - 0.1, 1.275, zf + 0.01], 0xfff4e0, 2.2));
    // Cans: four to a row, a colour a row
    for (let row = 0; row < 3; row++)
      for (let k = 0; k < 4; k++) {
        const can = d.addBox({ material: 'lamp', size: [0.11, 0.15, 0.08], position: [x - 0.42 + 0.04 + k * 0.15 + 0.055, 1.0 + row * 0.21 + 0.075, zf + 0.06], tint: CANS[(row + i) % CANS.length] });
        glow.light(can);
        lit(can);
      }
    d.addBox({ material: 'glass', size: [0.64, 0.65, 0.02], position: [x - 0.1, 1.275, zf + 0.11] });
    for (let k = 0; k < 6; k++) {
      const b = d.addBox({ material: 'lamp', size: [0.04, 0.04, 0.04], position: [x + 0.3, 1.04 + k * 0.1, zf + 0.02], tint: k % 2 ? 0xffb040 : 0x60ff90 });
      glow.light(b);
      lit(b);
    }
    signs.push(sign);
    d.addBox({ material: 'steel', size: [0.12, 0.22, 0.015], position: [x + 0.3, 0.81, zf + 0.0075], tint: 0x1a1c20 });
    d.addBox({ material: 'steel', size: [0.6, 0.22, 0.02], position: [x, 0.29, zf + 0.01], tint: 0x101114 });
  }
}

/**
 * The transformer box on N5's lane wall (its -x face at x 6.03): two conduits up the wall, a
 * bundle of two along the slab edge at level 2 toward the alley (what feeds the signs), an amber
 * status lamp, and a warning bolt in yellow neon on its face.
 */
export function transformerBox(d: Destruction): void {
  const xw = 6.03;
  const z = 9.7;
  const p = d.addBox({ material: 'signbox', size: [0.5, 0.8, 0.6], position: [xw - 0.25, 5.4, z], tint: 0x6a6e70 });
  transformer.piece = p;
  for (const dz of [-0.18, 0.18]) for (let k = 0; k < 2; k++) d.addBox({ material: 'steel', size: [0.06, 1.6, 0.06], position: [xw - 0.03, 5.8 + 0.8 + k * 1.6, z + dz], tint: 0x3a3c40 });
  // The bundle: octagonal pipes lying on the slab edge (6.6 … 6.84), in lengths, to the corner
  const r = 0.05;
  const c = r * Math.cos(Math.PI / 8);
  for (const y of [6.66, 6.78]) {
    const [z0, z1] = [z - 0.25, FRONT + 0.35];
    const n = Math.ceil((z0 - z1) / 1.8);
    for (let i = 0; i < n; i++) {
      const [za, zb] = [z0 - ((z0 - z1) * i) / n, z0 - ((z0 - z1) * (i + 1)) / n];
      const pts: V3[] = [];
      for (let k = 0; k < 8; k++) {
        const a = Math.PI / 8 + (k * Math.PI) / 4;
        for (const zz of [za, zb]) pts.push([xw - c + r * Math.cos(a), y + r * Math.sin(a), zz]);
      }
      d.addConvex({ material: 'steel', points: pts, tint: y < 6.7 ? 0x3a3c40 : 0x5a4a30, smooth: 0.8 });
    }
  }
  if (!p) return;
  // On its face (x 5.53, facing -x: right is +z): a status lamp, and the bolt
  const lamp = d.addBox({ material: 'lamp', size: [0.03, 0.06, 0.06], position: [xw - 0.5 - 0.015, 5.68, z + 0.2], tint: 0xffa020 });
  glow.light(lamp);
  if (lamp) glow.set(lamp, 4);
  const plane: Plane = { o: [xw - 0.5, 5.08, z - 0.24], right: [0, 0, 1], up: [0, 1, 0], n: [-1, 0, 0] };
  const sign: Sign = { pieces: lamp ? [lamp] : [], centre: [xw - 0.5, 5.4, z], color: 0xffd040 };
  for (const [a0, b0, a1, b1] of [
    [0.3, 0.62, 0.12, 0.33],
    [0.12, 0.33, 0.32, 0.33],
    [0.32, 0.33, 0.14, 0.04],
  ]) {
    const t = tube(d, plane, a0, b0, a1, b1, 0xffd040);
    if (t) sign.pieces.push(t);
  }
  signs.push(sign);
}

/** Pipes up S2's wall in the dark slot between S2 and S3 (its face at x -12.53): octagonal, in 1.5 m lengths. */
export function slotPipes(d: Destruction): void {
  const x = SLOT.x0;
  for (const [z, r, top] of [
    [-4.6, 0.07, 13],
    [-5.3, 0.05, 9],
    [-8.2, 0.09, 19],
  ] as const) {
    const c = r * Math.cos(Math.PI / 8);
    const n = Math.round((top - 0.3) / 1.5);
    for (let i = 0; i < n; i++) {
      const [ya, yb] = [0.3 + (i * (top - 0.3)) / n, 0.3 + ((i + 1) * (top - 0.3)) / n];
      const pts: V3[] = [];
      for (let k = 0; k < 8; k++) {
        const a = Math.PI / 8 + (k * Math.PI) / 4;
        for (const y of [ya, yb]) pts.push([x + c + r * Math.cos(a), y, z + r * Math.sin(a)]);
      }
      d.addConvex({ material: 'steel', points: pts, tint: 0x7a7e84, smooth: 0.8 });
    }
  }
}

/**
 * Clutter at street level, put after the props where nothing stands: plastic stools outside the
 * noodle bars, gas cylinders by the shop doors, stacks of cardboard boxes by the shutters.
 */
export function clutter(d: Destruction, shops: Shop[], rand: () => number): void {
  // (The street's slabs aren't in the way: what's put stands on them)
  const taken = d.all().filter((p) => !p.ground).map((p) => p.bounds);
  /** Whether a box (centre, size) is clear of what stands and of what's been put. */
  const free = (at: V3, size: V3) => {
    const lo = at.map((v, k) => v - size[k] / 2 - 0.03);
    const hi = at.map((v, k) => v + size[k] / 2 + 0.03);
    return !taken.some((b) => [0, 1, 2].every((k) => lo[k] < b.max[k] && hi[k] > b.min[k]));
  };
  const claim = (at: V3, size: V3) => taken.push({ min: at.map((v, k) => v - size[k] / 2) as V3, max: at.map((v, k) => v + size[k] / 2) as V3 });
  /** A point `a` along and `o` out from a facade point. */
  const off = (p: V3, along: V3, out: V3, a: number, o: number): V3 => [p[0] + along[0] * a + out[0] * o, 0, p[2] + along[2] * a + out[2] * o];
  for (const s of shops) {
    if (Math.abs(s.out[0]) > 0.5) continue;
    if (s.kind === 'noodle') {
      // Two or three stools before the window, red or blue plastic
      for (const a of [-1.1, -0.4, 0.6]) {
        const at = off(s.door, s.along, s.out, a + (rand() - 0.5) * 0.2, 0.55 + rand() * 0.3);
        if (rand() < 0.25 || !free([at[0], 0.23, at[2]], [0.34, 0.46, 0.34])) continue;
        claim([at[0], 0.23, at[2]], [0.34, 0.46, 0.34]);
        const tint = rand() < 0.6 ? 0xd02a20 : 0x2a5ad0;
        d.addBox({ material: 'signbox', size: [0.08, 0.4, 0.08], position: [at[0], 0.2, at[2]], tint });
        d.addBox({ material: 'signbox', size: [0.32, 0.05, 0.32], position: [at[0], 0.425, at[2]], tint });
      }
    }
    // A gas cylinder or two by the door, against the wall
    const n = rand() < 0.5 ? 1 : 2;
    for (let i = 0; i < n; i++) {
      const at = off(s.door, s.along, s.out, (s.width / 2 - 0.3) * (rand() < 0.5 ? -1 : 1) + i * 0.34, 0.2);
      if (!free([at[0], 0.5, at[2]], [0.32, 1.0, 0.32])) continue;
      claim([at[0], 0.5, at[2]], [0.32, 1.0, 0.32]);
      const pts: V3[] = [];
      for (let k = 0; k < 8; k++) for (const y of [0, 0.9]) pts.push([at[0] + 0.15 * Math.cos((k * Math.PI) / 4 + Math.PI / 8), y, at[2] + 0.15 * Math.sin((k * Math.PI) / 4 + Math.PI / 8)]);
      d.addConvex({ material: 'steel', points: pts, tint: rand() < 0.5 ? 0x3a6ab0 : 0xc84a30, smooth: 0.8 });
      d.addBox({ material: 'steel', size: [0.08, 0.08, 0.08], position: [at[0], 0.94, at[2]], tint: 0x8a8e94 });
    }
  }
  // Boxes stacked by the shutters, two or three high
  for (const sh of shutters) {
    if (rand() < 0.4) continue;
    const c = sh.centre;
    const side = Math.sign(c[2]) || 1;
    if (Math.abs(Math.abs(c[2]) - FRONT) > 0.3) continue;
    let at: V3 = [c[0] + (rand() - 0.5) * 2, 0, side * (FRONT - 0.3)];
    let y = 0;
    for (let k = 0; k < 2 + Math.floor(rand() * 2); k++) {
      const size: V3 = [0.55 - k * 0.07, 0.36, 0.42 - k * 0.04];
      const centre: V3 = [at[0] + (rand() - 0.5) * 0.06, y + size[1] / 2, at[2]];
      if (!free(centre, size)) break;
      claim(centre, size);
      d.addBox({ material: 'signbox', size, position: centre, tint: [0xb08a5a, 0xa07a4a, 0xc09a68][k % 3] });
      y += size[1];
      at = centre;
    }
  }
}
