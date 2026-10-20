// The smaller things about the yard: the quay's kerb and bollards, light masts, Jersey barriers,
// the crane rails' end stops, the site office, pallets (empty stacks and loaded with cartons).

import type { Destruction, Piece, V3 } from '../../../lib/index.ts';
import { frustum, prism } from '../../../lib/index.ts';
import { Frame, spans, yaw } from './frame.ts';

export const CARTONS = [0xb08a5c, 0xa47c52, 0xc0a07a, 0x9a7a58, 0xd8d0c0, 0xb89a72];
/** A carton's size: its length along its own x (the cardboard material puts its tape by it). */
export const CARTON: V3 = [0.59, 0.5, 0.39];

/**
 * A pallet (1.2 × 0.8 × 0.144): three runners along its length, five top boards across them. In
 * frame `f` at `at` (the middle of its underside), its length along the frame's x, or z if `across`.
 * Each board's texture frame runs along the board, so its grain does.
 */
export function pallet(f: Frame, at: V3, across = false, wobble = 0): Piece[] {
  const out: Piece[] = [];
  const sub = f.sub(at, (across ? Math.PI / 2 : 0) + wobble);
  for (const z of [-0.35, 0, 0.35]) {
    const p = sub.box('wood', [-0.6, 0, z - 0.05], [0.6, 0.1, z + 0.05], { tint: 0xd8cbb4 });
    if (p) out.push(p);
  }
  for (let i = 0; i < 5; i++) {
    const x = -0.55 + i * 0.275;
    const p = sub.boxAt('wood', [x, 0.111, 0], [0.8, 0.022, 0.1], yaw(Math.PI / 2), { tint: 0xe8dcc4 });
    if (p) out.push(p);
  }
  return out;
}

/** A pallet loaded with four cartons, 2 × 2. */
export function loadedPallet(f: Frame, at: V3, across: boolean, rand: () => number): Piece[] {
  const out = pallet(f, at, across);
  const tint = CARTONS[Math.floor(rand() * CARTONS.length)];
  const along: V3 = across ? [0, 0, 1] : [1, 0, 0];
  const side: V3 = across ? [1, 0, 0] : [0, 0, 1];
  for (const a of [-0.3, 0.3])
    for (const b of [-0.2, 0.2]) {
      const c: V3 = [at[0] + along[0] * a + side[0] * b, at[1] + 0.122 + 0.25, at[2] + along[2] * a + side[2] * b];
      const p = f.boxAt('cardboard', c, CARTON, yaw(across ? Math.PI / 2 : 0), { tint });
      if (p) out.push(p);
    }
  return out;
}

/** A light mast: a pole in 2 m lengths to 18 m, a cross arm, four floodlights under it. */
export function mast(d: Destruction, x: number, z: number, turn: number): void {
  const f = new Frame(d, [x, 0, z], turn);
  const grey = 0x9a9c98;
  f.box('concrete', [-0.5, 0, -0.5], [0.5, 0.4, 0.5], { tint: 0xc8c6c0 });
  for (const [y0, y1] of spans(0.4, 18, 9)) f.box('steel', [-0.175, y0, -0.175], [0.175, y1, 0.175], { tint: grey });
  for (const [x0, x1] of [
    [-1.6, -0.175],
    [0.175, 1.6],
  ])
    f.box('steel', [x0, 17.6, -0.12], [x1, 17.84, 0.12], { tint: grey });
  for (const x of [-1.35, -0.6, 0.6, 1.35]) f.box('lamp', [x - 0.25, 17.42, -0.2], [x + 0.25, 17.6, 0.2]);
}

/** The crane rails' end stops at x, on each rail (z): yellow steel buffers. */
export function railStops(d: Destruction, x: number, rails: number[]): void {
  for (const z of rails) d.addBox({ material: 'steel', size: [0.6, 0.5, 0.8], position: [x, 0.25, z], tint: 0xc8a040 });
}

/** The quay's kerb along the edge: 1 m lengths of concrete painted faded yellow, worn grey here and there. */
export function kerb(d: Destruction, edge: number, x0: number, x1: number): void {
  let i = 0;
  for (const [a, b] of spans(x0, x1, Math.round(x1 - x0))) {
    d.addBox({ material: 'concrete', size: [b - a - 0.01, 0.35, 0.6], position: [(a + b) / 2, 0.175, edge + 0.3], tint: i++ % 6 === 5 ? 0xb4ae98 : 0xd8c070 });
  }
}

/** A mooring bollard: a cast-iron body on a base plate, a wider cap. */
export function bollard(d: Destruction, x: number, z: number): void {
  d.addBox({ material: 'iron', size: [0.8, 0.08, 0.8], position: [x, 0.04, z] });
  d.addConvex({ material: 'iron', points: frustum(0.24, 0.2, 0.55, 12), position: [x, 0.08, z], smooth: 0.6 });
  d.addConvex({ material: 'iron', points: frustum(0.2, 0.32, 0.12, 12), position: [x, 0.63, z], smooth: 0.6 });
}

/** Jersey barriers along x = `x`, red and white by turns, a centimetre apart (each its own). */
export function barriers(d: Destruction, x: number, z0: number, n: number): void {
  const shape = prism(
    [
      [-0.3, 0],
      [0.3, 0],
      [0.12, 0.45],
      [0.1, 0.8],
      [-0.1, 0.8],
      [-0.12, 0.45],
    ],
    1.99,
  );
  for (let i = 0; i < n; i++) d.addConvex({ material: 'concrete', points: shape, position: [x, 0, z0 + i * 2 + 1], tint: i % 2 ? 0xd8d6d0 : 0xb8564a });
}

/** The site office: a portable cabin on blocks, windows to the north, a door and steps at the west end. */
export function office(d: Destruction, x0: number, z0: number): void {
  const f = new Frame(d, [x0, 0, z0]);
  const L = 6;
  const W = 2.4;
  const [y0, y1] = [0.3, 0.45];
  const top = 2.9;
  const skin = 0xd8dcd8;
  const frame = 0x5c6a72;
  // One texture frame for the cabin's skin, so its panels' maps run on across them
  const textureFrame = f.pose();
  for (const [x, z] of [
    [0.1, 0.1],
    [L - 0.5, 0.1],
    [0.1, W - 0.5],
    [L - 0.5, W - 0.5],
    [L / 2 - 0.2, 0.1],
    [L / 2 - 0.2, W - 0.5],
  ])
    f.box('concrete', [x, 0, z], [x + 0.4, y0, z + 0.4], { tint: 0xb4b8b8 });
  for (const [a, b] of spans(0, L, 3)) f.box('steel', [a, y0, 0], [b, y1, W], { tint: frame });
  // Corner posts
  for (const [x, z] of [
    [0, 0],
    [L - 0.1, 0],
    [0, W - 0.1],
    [L - 0.1, W - 0.1],
  ])
    f.box('steel', [x, y1, z], [x + 0.1, top, z + 0.1], { tint: frame });
  // North wall: a band under the windows, three windows between piers, a band over them
  const [w0, w1] = [1.15, 2.05];
  const t = 0.06;
  for (const [a, b] of spans(0.1, L - 0.1, 3)) {
    f.box('cladding', [a, y1, 0], [b, w0, t], { tint: skin, textureFrame });
    f.box('cladding', [a, w1, 0], [b, top, t], { tint: skin, textureFrame });
  }
  const piers = [0.1, 0.5, 2.2, 2.6, 3.4, 3.8, 5.5, L - 0.1];
  for (let i = 0; i < piers.length; i += 2) f.box('cladding', [piers[i], w0, 0], [piers[i + 1], w1, t], { tint: skin, textureFrame });
  for (let i = 1; i < piers.length - 1; i += 2) f.box('glass', [piers[i], w0, 0.02], [piers[i + 1], w1, 0.04]);
  // South wall, plain
  for (const [a, b] of spans(0.1, L - 0.1, 3)) f.box('cladding', [a, y1, W - t], [b, top, W], { tint: skin, textureFrame });
  // East end, plain; west end with the door
  for (const [a, b] of spans(0.1, W - 0.1, 2)) f.box('cladding', [L - t, y1, a], [L, top, b], { tint: skin, textureFrame });
  f.box('cladding', [0, y1, 0.1], [t, top, 0.8], { tint: skin, textureFrame });
  f.box('steel', [0, y1, 0.8], [t, 2.4, 1.7], { tint: 0x3e5470 });
  f.box('cladding', [0, 2.4, 0.8], [t, top, 1.7], { tint: skin, textureFrame });
  f.box('cladding', [0, y1, 1.7], [t, top, W - 0.1], { tint: skin, textureFrame });
  // Roof
  for (const [a, b] of spans(0, L, 3)) f.box('cladding', [a, top, 0], [b, top + 0.1, W], { tint: 0xc8ccc8, textureFrame });
  // Steps up to the door
  f.box('steel', [-0.9, 0, 0.75], [0, 0.15, 1.75], { tint: 0x6a6c68 });
  f.box('steel', [-0.5, 0.15, 0.75], [0, 0.3, 1.75], { tint: 0x6a6c68 });
}
