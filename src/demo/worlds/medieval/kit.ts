// The building kit: frames to build in (a wall's or a roof's own coordinates), pieces placed in
// them with their textures lined up the way each material wants, and the small helpers every
// builder here shares.

import { add, type Destruction, multiply, type Piece, type Pose, type Q, quatFromAxisAngle, random, rotate, type V3 } from '../../../lib/index.ts';

export type P = Piece | null;
export type Pt = [number, number];

export const yaw = (a: number): Q => [0, Math.sin(a / 2), 0, Math.cos(a / 2)];
export const rotX = (a: number): Q => quatFromAxisAngle([1, 0, 0], a);
export const rotY = (a: number): Q => quatFromAxisAngle([0, 1, 0], a);
export const rotZ = (a: number): Q => quatFromAxisAngle([0, 0, 1], a);

/**
 * Coordinates to build in: u along (x), v up (y), w across (z), turned `a` about the vertical (u
 * runs along (cos a, 0, -sin a), w along (sin a, 0, cos a)). Walls put their outer face at w = 0
 * and run inward to +w.
 */
export class Frame {
  readonly o: V3;
  readonly a: number;
  readonly q: Q;
  constructor(o: V3, a = 0) {
    this.o = o;
    this.a = a;
    this.q = yaw(a);
  }
  at(u: number, v: number, w: number): V3 {
    return add(this.o, rotate(this.q, [u, v, w]));
  }
  /** A frame at (u, v, w) of this one, turned a further `turn` (π/2: its u runs along this one's -w). */
  sub(u: number, v: number, w: number, turn = 0): Frame {
    return new Frame(this.at(u, v, w), this.a + turn);
  }
  get pose(): Pose {
    return { position: this.o, rotation: this.q };
  }
}

/**
 * How a piece's map is laid: 'wall' continues one map across the whole frame (roof tiles: their
 * rows are in the map), 'own' in the piece's own frame (its material's uvJitter gives each its own
 * patch: ashlar, rubble, boards, plaster panels), 'grain' turns it along the piece's longest side
 * (timbers).
 */
export type Lay = 'wall' | 'own' | 'grain';

interface PieceLook {
  tint?: number;
  lay?: Lay;
  /** Bevel on a box's edges (m): ashlar gets one, so its joints read as V grooves. */
  chamfer?: number;
  /** Faces meeting at less than this (radians) shade as one round surface (a drum, a turned pot). */
  smooth?: number;
}

/** Ashlar's bevel. */
const CHAMFER: Record<string, number> = { limestone: 0.03, limestoneTower: 0.03 };

/** A box of half sizes (x, y, z) with its edges and corners cut back by c. */
function bevelled(x: number, y: number, z: number, c: number): V3[] {
  const pts: V3[] = [];
  for (const sx of [-1, 1])
    for (const sy of [-1, 1])
      for (const sz of [-1, 1]) pts.push([sx * x, sy * (y - c), sz * (z - c)], [sx * (x - c), sy * y, sz * (z - c)], [sx * (x - c), sy * (y - c), sz * z]);
  return pts;
}

/**
 * A convex outline (x, y) from z0 to z1 with its edges and corners cut back by c, as bevelled() cuts
 * a box: three points a corner, each pulled c along two of the edges that meet there.
 */
export function bevelledPrism(outline: Pt[], z0: number, z1: number, c: number): V3[] {
  const pts: V3[] = [];
  const n = outline.length;
  outline.forEach(([x, y], i) => {
    const unit = ([px, py]: Pt): Pt => {
      const l = Math.hypot(px - x, py - y);
      return [(px - x) / l, (py - y) / l];
    };
    const a = unit(outline[(i + n - 1) % n]);
    const b = unit(outline[(i + 1) % n]);
    for (const [z, dz] of [
      [z0, c],
      [z1, -c],
    ])
      pts.push([x + c * (a[0] + b[0]), y + c * (a[1] + b[1]), z], [x + c * a[0], y + c * a[1], z + dz], [x + c * b[0], y + c * b[1], z + dz]);
  });
  return pts;
}

/** Brightness ± `amount` and a slight warm or cool shift, around `base`. */
export function vary(base: number, amount: number, rand: () => number): number {
  const k = 1 + (rand() * 2 - 1) * amount;
  const warm = (rand() * 2 - 1) * amount * 0.35;
  const r = Math.min(255, Math.round(((base >> 16) & 255) * k * (1 + warm)));
  const g = Math.min(255, Math.round(((base >> 8) & 255) * k));
  const b = Math.min(255, Math.round((base & 255) * k * (1 - warm)));
  return (r << 16) | (g << 8) | b;
}

/** Each material's lay, unless a piece says otherwise (the rest: 'own'). */
const LAYS: Record<string, Lay> = {
  oak: 'grain',
  tile: 'wall',
};

/** Clip a convex polygon to a·u + b·v ≤ c. */
export function clip(poly: Pt[], [a, b, c]: [number, number, number]): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i];
    const q = poly[(i + 1) % poly.length];
    const dp = a * p[0] + b * p[1] - c;
    const dq = a * q[0] + b * q[1] - c;
    if (dp <= 1e-9) out.push(p);
    if ((dp < -1e-9 && dq > 1e-9) || (dp > 1e-9 && dq < -1e-9)) {
      const t = dp / (dp - dq);
      out.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]);
    }
  }
  return out;
}

export function area(poly: Pt[]): number {
  let s = 0;
  for (let i = 0; i < poly.length; i++) {
    const [x0, y0] = poly[i];
    const [x1, y1] = poly[(i + 1) % poly.length];
    s += x0 * y1 - x1 * y0;
  }
  return Math.abs(s) / 2;
}

/** Cut [a, b] into lengths of at most `max` (at least one piece), evenly. */
export function split(a: number, b: number, max: number): number[] {
  const n = Math.max(1, Math.ceil((b - a) / max - 1e-6));
  return Array.from({ length: n + 1 }, (_, i) => a + ((b - a) * i) / n);
}

/** The builders' hands: a Destruction, a seeded random, and pieces placed in frames. */
export class Kit {
  readonly d: Destruction;
  readonly rand: () => number;
  /** Pieces made per structure (for the README's counts). */
  readonly counts: Record<string, number> = {};
  private current = '';
  private before = 0;
  private bag: Piece[] | null = null;

  constructor(d: Destruction, seed: number) {
    this.d = d;
    this.rand = random(seed);
  }

  /** Count what's built from here on as `name` (until the next call). */
  part(name: string): void {
    this.close();
    this.current = name;
    this.before = this.d.stats.pieces;
  }

  close(): void {
    if (this.current) this.counts[this.current] = (this.counts[this.current] ?? 0) + this.d.stats.pieces - this.before;
    this.current = '';
  }

  range(a: number, b: number): number {
    return a + (b - a) * this.rand();
  }

  /** Keep the pieces built from here on (through the kit) until collect(). */
  gather(): void {
    this.bag = [];
  }

  collect(): Piece[] {
    const out = this.bag ?? [];
    this.bag = null;
    return out;
  }

  private keep(p: P): P {
    if (p && this.bag) this.bag.push(p);
    return p;
  }

  /** The texture frame for a piece at `pose` laid `lay` in frame `f` (undefined: its own). */
  private laid(f: Frame, pose: Pose, lay: Lay): Pose | undefined {
    if (lay === 'wall') return f.pose;
    if (lay === 'own') return undefined;
    // Slid along the grain only: the map's peg holes stay off the timber's middle
    return { position: add(pose.position, rotate(pose.rotation, [0, this.rand() * 1.0, 0])), rotation: pose.rotation };
  }

  /** A box from (u0, v0, w0) to (u0 + su, …) in `f`. Timbers ('grain') turn so their grain runs along their length. */
  box(f: Frame, material: string, u0: number, v0: number, w0: number, su: number, sv: number, sw: number, look: PieceLook = {}): P {
    if (su < 1e-3 || sv < 1e-3 || sw < 1e-3) return null;
    const lay = look.lay ?? LAYS[material] ?? 'own';
    const position = f.at(u0 + su / 2, v0 + sv / 2, w0 + sw / 2);
    let rotation = f.q;
    let size: V3 = [su, sv, sw];
    if (lay === 'grain') {
      // The map's grain runs along v: the longest side becomes the box's own y
      if (su > sv && su >= sw) {
        rotation = multiply(f.q, rotZ(Math.PI / 2));
        size = [sv, su, sw];
      } else if (sw > sv && sw > su) {
        rotation = multiply(f.q, rotX(Math.PI / 2));
        size = [su, sw, sv];
      }
    }
    const pose = { position, rotation };
    const c = look.chamfer ?? CHAMFER[material] ?? 0;
    const textureFrame = this.laid(f, pose, lay);
    if (c > 0 && Math.min(...size) > 4 * c) return this.keep(this.d.addConvex({ material, points: bevelled(size[0] / 2, size[1] / 2, size[2] / 2, c), position, rotation, tint: look.tint, textureFrame }));
    return this.keep(this.d.addBox({ material, size, position, rotation, tint: look.tint, textureFrame }));
  }

  /**
   * A prism: the convex outline (u, v) in `f`, from w0 to w0 + sw. `grain`: for a timber laid
   * aslant (a brace), the turn about w that lays its grain along it (atan2(-du, dv) of its run).
   */
  prism(f: Frame, material: string, outline: Pt[], w0: number, sw: number, look: PieceLook & { grain?: number } = {}): P {
    if (outline.length < 3 || area(outline) < 2e-4) return null;
    const lay = look.lay ?? LAYS[material] ?? 'own';
    const position = f.at(0, 0, w0 + sw / 2);
    const points = outline.flatMap(([u, v]) => [[u, v, -sw / 2] as V3, [u, v, sw / 2] as V3]);
    let textureFrame: Pose | undefined;
    if (lay === 'wall') textureFrame = f.pose;
    else if (lay === 'grain') {
      // Centred on the outline, turned so v runs along the grain, and slid along it
      const cu = outline.reduce((s, p) => s + p[0], 0) / outline.length;
      const cv = outline.reduce((s, p) => s + p[1], 0) / outline.length;
      const rotation = look.grain ? multiply(f.q, rotZ(look.grain)) : f.q;
      textureFrame = { position: add(f.at(cu, cv, w0 + sw / 2), rotate(rotation, [0, this.rand(), 0])), rotation };
    }
    return this.keep(this.d.addConvex({ material, points, position, rotation: f.q, tint: look.tint, textureFrame }));
  }

  /** The hull of `points` (in `f`, offset by (u, v, w), turned `turn`), its map in its own frame unless laid 'wall'. */
  hull(f: Frame, material: string, points: V3[], u: number, v: number, w: number, look: PieceLook & { turn?: Q } = {}): P {
    const position = f.at(u, v, w);
    const rotation = look.turn ? multiply(f.q, look.turn) : f.q;
    const textureFrame = (look.lay ?? LAYS[material]) === 'wall' ? f.pose : undefined;
    return this.keep(this.d.addConvex({ material, points, position, rotation, tint: look.tint, textureFrame, smooth: look.smooth }));
  }

  /** A box turned about the frame's w by `angle` (a brace, a sign's chain), centred at (u, v, w). */
  tilted(f: Frame, material: string, u: number, v: number, w: number, size: V3, angle: number, look: PieceLook = {}): P {
    const position = f.at(u, v, w);
    const rotation = multiply(f.q, rotZ(angle));
    const pose = { position, rotation };
    return this.keep(this.d.addBox({ material, size, position, rotation, tint: look.tint, textureFrame: this.laid(f, pose, look.lay ?? LAYS[material] ?? 'own') }));
  }

  bond(a: P, b: P, area = 0.02): void {
    if (a && b) this.d.bond(a, b, area);
  }
}
