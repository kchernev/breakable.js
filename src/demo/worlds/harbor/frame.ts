// A local frame for building: an origin and a turn about the vertical. Every structure is laid out
// in its own frame from corner coordinates, so neighbours share faces exactly and bond.

import type { Destruction, Piece, PieceOptions, Pose, Q, V3 } from '../../../lib/index.ts';
import { multiply, quatFromAxisAngle, rotate } from '../../../lib/index.ts';

export const yaw = (a: number): Q => [0, Math.sin(a / 2), 0, Math.cos(a / 2)];

type Extra = Omit<PieceOptions, 'material' | 'position' | 'rotation'>;

export class Frame {
  readonly d: Destruction;
  readonly origin: V3;
  readonly rotation: Q;

  /** `turn`: about the vertical (radians), or a rotation. */
  constructor(d: Destruction, origin: V3, turn: number | Q = 0) {
    this.d = d;
    this.origin = origin;
    this.rotation = typeof turn === 'number' ? yaw(turn) : turn;
  }

  /** A frame within this one: at `p`, turned `turn` more about the vertical. */
  sub(p: V3, turn = 0): Frame {
    return new Frame(this.d, this.at(p), multiply(this.rotation, yaw(turn)));
  }

  /** A point of the frame in the world. */
  at(p: V3): V3 {
    const r = rotate(this.rotation, p);
    return [r[0] + this.origin[0], r[1] + this.origin[1], r[2] + this.origin[2]];
  }

  /** The frame moved by `p` (in it). */
  pose(p: V3 = [0, 0, 0]): Pose {
    return { position: this.at(p), rotation: this.rotation };
  }

  /** A box between two corners (in the frame). */
  box(material: string, min: V3, max: V3, extra: Extra = {}): Piece | null {
    const c: V3 = [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2];
    return this.d.addBox({ material, size: [max[0] - min[0], max[1] - min[1], max[2] - min[2]], position: this.at(c), rotation: this.rotation, ...extra });
  }

  /** A box of `size` centred at `c` (in the frame), turned by `turn` more. */
  boxAt(material: string, c: V3, size: V3, turn: Q = [0, 0, 0, 1], extra: Extra = {}): Piece | null {
    return this.d.addBox({ material, size, position: this.at(c), rotation: multiply(this.rotation, turn), ...extra });
  }
}

/** Turn about the x axis (a slope rising toward +z for positive angles is a turn of -angle). */
export const aboutX = (a: number): Q => quatFromAxisAngle([1, 0, 0], a);
export const aboutZ = (a: number): Q => quatFromAxisAngle([0, 0, 1], a);

/** The bonds among `pieces` carry `share` of what their material's do: the same steel, lighter built. */
export function weaken(pieces: Piece[], share: number): void {
  const set = new Set(pieces);
  for (const p of set) for (const b of p.bonds) if (set.has(b.other(p))) b.strength = share;
}

/** n equal lengths from a to b, as [start, end] pairs. */
export function spans(a: number, b: number, n: number): Array<[number, number]> {
  return Array.from({ length: n }, (_, i) => [a + ((b - a) * i) / n, a + ((b - a) * (i + 1)) / n]);
}

/** As few equal lengths from a to b as keep each at most `most` long. */
export function split(a: number, b: number, most: number): Array<[number, number]> {
  return spans(a, b, Math.max(1, Math.ceil((b - a) / most - 1e-6)));
}
