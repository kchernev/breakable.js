// The builders' kit: pieces by their corners or their points in the world, with the tints each
// material wants, and the shapes the sanctuary is made of (drums, columns, prisms cut in a vertical
// plane, lying fragments). The materials move each piece's map at random themselves (uvJitter).

import { type Destruction, multiply, type Piece, type Pose, type Q, quatFromAxisAngle, type V3 } from '../../../lib/index.ts';
import { Levers } from './levers.ts';

// Close together: drum to drum the banding shows, without a drum standing out
const MARBLE_TINTS = [0xfbf8f2, 0xf8f4ec, 0xf6f0e6];
const IDENTITY: Q = [0, 0, 0, 1];
/** Drums shade round (their 20 facets meet at 18°), their rims and broken faces stay sharp. */
const ROUND = 0.5;
/** The gap left between pieces side by side (m). */
const GAP = 0.0012;

export const yawQ = (a: number): Q => quatFromAxisAngle([0, 1, 0], a);

export interface PieceOpts {
  tint?: number;
  static?: boolean;
  /** Holds up what's on it as the ground does, but breaks (PieceOptions.anchor): a platform's slabs over its hollow. */
  anchor?: boolean;
  bond?: boolean;
  /** Faces meeting at less than this (radians) shade as one smooth surface. */
  smooth?: number;
}

export class Kit {
  readonly d: Destruction;
  readonly rand: () => number;
  /** Spans to watch: they tip off when they lose a support. */
  readonly levers: Levers;

  constructor(d: Destruction, rand: () => number) {
    this.d = d;
    this.rand = rand;
    this.levers = new Levers(d);
  }

  /**
   * A per-piece tint: marble a little warmer or cooler; limestone ±9% in value, each block warmer
   * (ochre) or cooler (grey), so the courses read block by block.
   */
  tint(material: string): number | undefined {
    const r = this.rand;
    if (material === 'marble' || material === 'drum' || material === 'ruin') return MARBLE_TINTS[Math.floor(r() * MARBLE_TINTS.length)];
    if (material === 'limestone') {
      const v = 0.86 + r() * 0.14;
      const warm = (r() - 0.5) * 0.12;
      return hex(v * (1 + warm * 0.3), v * (1 - warm * 0.15), v * (1 - warm));
    }
    return undefined;
  }

  /**
   * An axis-aligned box between two corners, a hair narrower than that (GAP): neighbours side by
   * side still bond (the library bonds faces up to 2 mm apart), but one that falls doesn't rub
   * against them on the way down and stick there.
   */
  box(material: string, min: V3, max: V3, o: PieceOpts = {}): Piece | null {
    const size: V3 = [max[0] - min[0] - GAP, max[1] - min[1], max[2] - min[2] - GAP];
    if (size[0] <= 1e-4 || size[1] <= 1e-4 || size[2] <= 1e-4) return null;
    const position: V3 = [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2];
    return this.d.addBox({ material, size, position, tint: o.tint ?? this.tint(material), static: o.static, anchor: o.anchor, bond: o.bond });
  }

  /** A turned box: centre, full size, rotation. Its texture frame is turned with it. */
  tbox(material: string, position: V3, size: V3, rotation: Q, o: PieceOpts & { texture?: Pose } = {}): Piece | null {
    return this.d.addBox({ material, size: [size[0] - GAP, size[1], size[2] - GAP], position, rotation, tint: o.tint ?? this.tint(material), static: o.static, anchor: o.anchor, bond: o.bond, textureFrame: o.texture });
  }

  /** The hull of points in the world; its texture frame at their middle, upright (or turned by `rotation`). */
  hull(material: string, points: V3[], o: PieceOpts & { rotation?: Q; texture?: Pose } = {}): Piece | null {
    const textureFrame = o.texture ?? { position: centre(points), rotation: o.rotation ?? IDENTITY };
    return this.d.addConvex({ material, points, tint: o.tint ?? this.tint(material), static: o.static, anchor: o.anchor, bond: o.bond, smooth: o.smooth, textureFrame });
  }
}

export function hex(r: number, g: number, b: number): number {
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v * 255)));
  return (c(r) << 16) | (c(g) << 8) | c(b);
}

function centre(points: V3[]): V3 {
  const c: V3 = [0, 0, 0];
  for (const p of points) for (let k = 0; k < 3; k++) c[k] += p[k] / points.length;
  return c;
}

/** A ring of `sides` points of radius r at height y round (x, z), starting at angle a0. */
export function ring(x: number, y: number, z: number, r: number, sides: number, a0 = 0): V3[] {
  return Array.from({ length: sides }, (_, i) => {
    const a = a0 + (i / sides) * Math.PI * 2;
    return [x + Math.cos(a) * r, y, z + Math.sin(a) * r] as V3;
  });
}

/**
 * A prism whose outline is drawn in a vertical plane across x (each point is [z, y]) and runs from
 * x0 to x1: roof timbers, gable blocks, ridge caps, all cut so their joints are vertical or follow
 * the slope.
 */
export function prismX(outline: Array<[number, number]>, x0: number, x1: number): V3[] {
  return outline.flatMap(([z, y]) => [
    [x0, y, z],
    [x1, y, z],
  ] as V3[]);
}

/** The same along z (outline points [x, y]). */
export function prismZ(outline: Array<[number, number]>, z0: number, z1: number): V3[] {
  return outline.flatMap(([x, y]) => [
    [x, y, z0],
    [x, y, z1],
  ] as V3[]);
}

export interface ColumnSpec {
  material: string;
  /** Foot of the shaft: x, y, z. */
  at: V3;
  /** Drum heights, bottom up. */
  drums: number[];
  /** Shaft radius at the foot and at the top. */
  r0: number;
  r1: number;
  sides: number;
  /** The capital: an echinus flaring to `r` over `h`, and a square abacus (side, height). */
  echinus?: { h: number; r: number };
  abacus?: { w: number; h: number; yaw?: number };
  /** How many drums actually stand (a ruin): the rest, and the capital, are left out. */
  standing?: number;
  /** Turn of the polygons (radians). */
  turn?: number;
}

/**
 * A Doric column of stacked drums (each drum's top polygon the next one's bottom, so they bond), its
 * capital. Each drum's texture frame is on its axis, its x toward the polygon's first corner, the
 * same for every drum of the column: the drum material's flutes run on from drum to drum. Returns
 * its pieces and its top.
 */
export function column(k: Kit, s: ColumnSpec): { pieces: Piece[]; top: number } {
  const [x, y0, z] = s.at;
  // Marble drums and echinus have their own, softer surface (the abacus is a block like the rest)
  const shaft = s.material === 'marble' ? 'drum' : s.material;
  const total = s.drums.reduce((a, b) => a + b, 0);
  const turn = s.turn ?? k.rand() * ((Math.PI * 2) / s.sides);
  const radius = (h: number) => s.r0 + ((s.r1 - s.r0) * h) / total;
  const pieces: Piece[] = [];
  let y = y0;
  let h = 0;
  const n = s.standing ?? s.drums.length;
  // (ring() goes from +x toward +z; a yaw turns +x toward -z)
  const rotation = yawQ(-turn);
  for (let i = 0; i < n; i++) {
    const dh = s.drums[i];
    const points = [...ring(x, y, z, radius(h), s.sides, turn), ...ring(x, y + dh, z, radius(h + dh), s.sides, turn)];
    const p = k.hull(shaft, points, { rotation, smooth: ROUND });
    if (p) pieces.push(p);
    y += dh;
    h += dh;
  }
  if (n < s.drums.length) return { pieces, top: y };
  if (s.echinus) {
    // The cushion: flaring fast, then rounding over under the abacus (a concave profile: still convex)
    const { h: eh, r: er } = s.echinus;
    const points: V3[] = [];
    for (const t of [0, 0.45, 1]) points.push(...ring(x, y + eh * t, z, s.r1 + (er - s.r1) * Math.sin((t * Math.PI) / 2), s.sides, turn));
    const p = k.hull(shaft, points, { rotation, smooth: ROUND });
    if (p) pieces.push(p);
    y += eh;
  }
  if (s.abacus) {
    const { w, h, yaw } = s.abacus;
    const p = yaw === undefined ? k.box(s.material, [x - w / 2, y, z - w / 2], [x + w / 2, y + h, z + w / 2]) : k.tbox(s.material, [x, y + h / 2, z], [w, h, w], yawQ(yaw));
    if (p) pieces.push(p);
    y += s.abacus.h;
  }
  return { pieces, top: y };
}

/**
 * A drum (or any short cylinder) lying on the ground, its axis level along `yaw`, a facet flat at
 * y = 0 so it rests (and counts as on the ground). Its texture frame's y is its axis, its x toward
 * its first corner, as a standing drum's.
 */
export function lyingDrum(k: Kit, material: string, x: number, z: number, yaw: number, length: number, r: number, sides: number): Piece | null {
  const axis: V3 = [Math.cos(yaw), 0, -Math.sin(yaw)];
  const side: V3 = [-axis[2], 0, axis[0]];
  const apothem = r * Math.cos(Math.PI / sides);
  const points: V3[] = [];
  for (let i = 0; i < sides; i++) {
    // Two corners symmetric about straight down: the bottom facet is level
    const a = -Math.PI / 2 + Math.PI / sides + (i / sides) * Math.PI * 2;
    const [c, s] = [Math.cos(a) * r, Math.sin(a) * r];
    for (const t of [-length / 2, length / 2]) points.push([x + axis[0] * t + side[0] * c, apothem + s, z + axis[2] * t + side[2] * c]);
  }
  // Snap the bottom to the ground exactly
  const low = Math.min(...points.map((p) => p[1]));
  for (const p of points) if (Math.abs(p[1] - low) < 1e-9) p[1] = 0;
  // Up turned onto the axis, then round it to the first corner
  const rotation = multiply(yawQ(yaw), multiply(quatFromAxisAngle([0, 0, 1], -Math.PI / 2), quatFromAxisAngle([0, 1, 0], -Math.PI / sides)));
  return k.hull(material, points, { rotation, smooth: ROUND });
}

/**
 * Raised frames on a door leaf's face: stiles at its edges and up its middle, rails across at its
 * foot, middle and head (between the stiles: nothing overlaps), so it reads as panels. `face`: the
 * middle of the leaf's face; `yaw` turns the frames' z out of it. Returns the pieces.
 */
export function leafPanels(k: Kit, material: string, face: V3, width: number, height: number, yaw: number): Piece[] {
  const q = yawQ(yaw);
  const u: V3 = [Math.cos(yaw), 0, -Math.sin(yaw)];
  const n: V3 = [Math.sin(yaw), 0, Math.cos(yaw)];
  const s = 0.07;
  const proud = 0.025;
  const at = (du: number, dv: number): V3 => [face[0] + u[0] * du + n[0] * proud / 2, face[1] + dv, face[2] + u[2] * du + n[2] * proud / 2];
  const out: Piece[] = [];
  const push = (p: Piece | null) => p && out.push(p);
  for (const du of [-width / 2 + s / 2, 0, width / 2 - s / 2]) push(k.tbox(material, at(du, 0), [s, height, proud], q));
  const span = width / 2 - s * 1.5;
  for (const dv of [-height / 2 + s / 2, 0, height / 2 - s / 2])
    for (const side of [-1, 1]) push(k.tbox(material, at(side * (s / 2 + span / 2), dv), [span, s, proud], q));
  return out;
}
