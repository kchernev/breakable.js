// Where everything in Neon Alley is: the alley's constants, the storey heights every building
// shares (so ledges, the bridge and the cables line up), the lots on both sides, and a frame that
// maps a building's local coordinates into the world.

import type { Destruction, Piece, PieceOptions, Pose, V3 } from '../../../lib/index.ts';

/** The facades stand at z = ±FRONT: the alley is 7.5 m wide. */
export const FRONT = 3.75;
/** Ground-floor height, upper-floor height, slab thickness, facade thickness. */
export const H0 = 3.6;
export const H = 3.0;
export const TS = 0.24;
export const T = 0.3;
/** Neighbouring buildings stand this far apart: separate structures. */
export const GAP = 0.06;

/** The bottom of level k's slab (level 0: the ground slab). */
export const levelY = (k: number): number => (k === 0 ? 0 : H0 + H * (k - 1));

/** Equal runs of at most about 2.2 m along a length (no long pieces: the broadphase grid is sized by the biggest). */
export const runs = (length: number, max = 2.2): number => Math.max(1, Math.round(length / max));

type LotType = 'A' | 'B';

export interface Lot {
  id: string;
  /** 1: north row (z > 0), -1: south row. */
  side: 1 | -1;
  x0: number;
  x1: number;
  type: LotType;
  floors: number;
  depth: number;
  /** The facade's tint (tile or render). */
  tint: number;
  /** The lane runs along this end of the lot ('east': at x1, 'west': at x0): a facade turned 90° there. */
  corner?: 'east' | 'west';
  /** Column lines on the facade (lx of each column's left edge, besides the two ends). */
  columns?: number[];
  /** Ground floor: a roller shutter or a lit shop (default: seeded). */
  shop?: 'shutter' | 'lit';
  balconies?: number[];
  roof?: Array<'tank' | 'condenser' | 'mast' | 'billboard'>;
  awning?: boolean;
  /** The flickering hotel sign's lx, on the band at level 3. */
  hotel?: number;
}

const WHITE = 0xffffff;
const BLUE = 0xd6e4f0;
const GREEN = 0xd2eadb;
const SALMON = 0xf2cbbd;
const OCHRE = 0xead9a8;

export const LOTS: Lot[] = [
  { id: 'N1', side: 1, x0: -26, x1: -19, type: 'A', floors: 7, depth: 9, tint: WHITE, shop: 'lit', roof: ['condenser', 'mast'], awning: true },
  { id: 'N2', side: 1, x0: -19, x1: -13, type: 'B', floors: 4, depth: 8, tint: 0xcfe8d6, shop: 'shutter', roof: ['condenser', 'billboard'] },
  { id: 'N3', side: 1, x0: -13, x1: -5, type: 'A', floors: 8, depth: 9, tint: SALMON, shop: 'shutter', balconies: [2, 4, 6], roof: ['tank', 'condenser', 'billboard'] },
  // The big blade's column is at x 0.6 … 1.2 (lx 5.57 … 6.17)
  { id: 'N4', side: 1, x0: -5, x1: 2, type: 'A', floors: 6, depth: 9, tint: BLUE, corner: 'east', columns: [3.05, 5.57], shop: 'lit', roof: ['condenser', 'tank'] },
  { id: 'N5', side: 1, x0: 6, x1: 13, type: 'A', floors: 7, depth: 9, tint: GREEN, corner: 'west', shop: 'shutter', roof: ['tank', 'mast', 'billboard'] },
  { id: 'N6', side: 1, x0: 13, x1: 19, type: 'B', floors: 5, depth: 8, tint: 0xf2e8d0, shop: 'lit', roof: ['tank'], awning: true },
  { id: 'N7', side: 1, x0: 19, x1: 30, type: 'A', floors: 6, depth: 9, tint: OCHRE, shop: 'lit', roof: ['tank', 'billboard'], awning: true },
  { id: 'S1', side: -1, x0: -26, x1: -20, type: 'B', floors: 4, depth: 8, tint: 0xf0c8cc, shop: 'lit', roof: ['condenser'], awning: true },
  { id: 'S2', side: -1, x0: -20, x1: -12.5, type: 'A', floors: 7, depth: 9, tint: WHITE, shop: 'shutter', roof: ['condenser', 'tank'] },
  { id: 'S3', side: -1, x0: -11, x1: -4, type: 'A', floors: 8, depth: 9, tint: BLUE, shop: 'lit', roof: ['tank', 'mast', 'billboard'], awning: true },
  { id: 'S4', side: -1, x0: -4, x1: 2, type: 'B', floors: 5, depth: 8, tint: 0xf0e6b0, shop: 'lit', roof: ['condenser'], awning: true },
  { id: 'S5', side: -1, x0: 2, x1: 9, type: 'A', floors: 6, depth: 9, tint: SALMON, shop: 'shutter', roof: ['condenser', 'tank'] },
  { id: 'S6', side: -1, x0: 9, x1: 16, type: 'A', floors: 7, depth: 9, tint: GREEN, shop: 'lit', roof: ['condenser', 'mast'], hotel: 0.9 },
  { id: 'S7', side: -1, x0: 16, x1: 22, type: 'B', floors: 4, depth: 8, tint: 0xcfe8d6, shop: 'shutter', roof: ['condenser', 'billboard'], awning: true },
  { id: 'S8', side: -1, x0: 22, x1: 30, type: 'A', floors: 6, depth: 9, tint: WHITE, shop: 'shutter', roof: ['tank', 'condenser'] },
];

/** The end block across the alley's end: its facade at x0 faces -x; z0 … z1 across. */
export const END = { x0: 30.06, x1: 38, z0: -9, z1: 9, floors: 8, tint: 0x8a8e94, arcade: 2.4 };
/**
 * The alley's ground, breakable between the facades from the mouth to the end block: wet asphalt
 * `depth` deep over a concrete base `underDepth` deep, in slabs about `cell` across, on the bed (a
 * crater's floor, under half a metre down: a step, so the player walks out of one). A blast throws
 * its chunks out of the crater a little harder than the library's 0.4 (`toss`): at 0.4 the big
 * asphalt plates mostly fell back in and hid the hole.
 */
export const GROUND = { x0: -26, x1: END.x0, depth: 0.18, underDepth: 0.3, cell: 2.5, bed: -0.48, toss: 0.55 };
/** Whether (x, z) is on the alley's breakable ground, seen from above. */
export const onGround = (x: number, z: number): boolean => x >= GROUND.x0 && x <= GROUND.x1 && Math.abs(z) <= FRONT;
/** The cross lane north, between N4 and N5. */
export const LANE = { x0: 2, x1: 6 };
/** The footbridge: its x span, at level 3. */
export const BRIDGE = { x0: 6.4, x1: 8.8, level: 3 };
/** The lantern gate at the alley's mouth: where it stands, and how high its posts reach (the tie beam's foot). */
export const GATE = { x: -25.6, posts: 4.8 };
/** Where the player starts, and looks. */
export const START = { feet: [-30, 0, -1] as V3, look: [6, 7.5, 0.5] as V3 };

/**
 * A building's frame: lx along the facade, ly up, lz into the building from the facade. Its axes
 * are world axes (signed), so boxes stay axis-aligned and neighbours share faces exactly.
 */
export class Frame {
  readonly origin: V3;
  /** World directions of lx and lz (unit, along a world axis). */
  readonly along: V3;
  readonly into: V3;
  /** The texture frame its tile and render share (maps line up across pieces). */
  texture: Pose;

  constructor(origin: V3, along: V3, into: V3) {
    this.origin = origin;
    this.along = along;
    this.into = into;
    this.texture = { position: origin, rotation: [0, 0, 0, 1] };
  }

  /** The world point of (lx, ly, lz). */
  at(lx: number, ly: number, lz: number): V3 {
    const [o, a, i] = [this.origin, this.along, this.into];
    return [o[0] + a[0] * lx + i[0] * lz, o[1] + ly, o[2] + a[2] * lx + i[2] * lz];
  }

  /** A world size from a local one. */
  size(sx: number, sy: number, sz: number): V3 {
    const [a, i] = [this.along, this.into];
    return [Math.abs(a[0] * sx + i[0] * sz), sy, Math.abs(a[2] * sx + i[2] * sz)];
  }

  /** Out of the facade (toward the street). */
  get out(): V3 {
    return [-this.into[0], 0, -this.into[2]];
  }

  /** A box from its local min corner (lx, ly, lz) and size. */
  box(d: Destruction, material: string, lx: number, ly: number, lz: number, sx: number, sy: number, sz: number, extra: Omit<PieceOptions, 'material'> = {}): Piece | null {
    return d.addBox({ material, size: this.size(sx, sy, sz), position: this.at(lx + sx / 2, ly + sy / 2, lz + sz / 2), ...extra });
  }
}

/** A lot's frame: north lots run +x with lz toward +z; south lots run +x with lz toward -z. */
export function lotFrame(lot: Lot): Frame {
  return new Frame([lot.x0 + GAP / 2, 0, lot.side * FRONT], [1, 0, 0], [0, 0, lot.side]);
}

/** The end block's frame: lx runs along +z from z0, lz into the block along +x. */
export function endFrame(): Frame {
  return new Frame([END.x0, 0, END.z0], [0, 0, 1], [1, 0, 0]);
}

/** The lane facade of a corner lot: lx runs north (+z) from the alley's facade line, lz into the building. */
export function laneFrame(lot: Lot): Frame {
  const west = lot.corner === 'west';
  const x = west ? lot.x0 + GAP / 2 : lot.x1 - GAP / 2;
  return new Frame([x, 0, FRONT], [0, 0, 1], [west ? 1 : -1, 0, 0]);
}

/** Facade rectangles taken (lx0, ly0, lx1, ly1), so signs, AC units and pipes don't overlap. */
export class Taken {
  private rects: Array<[number, number, number, number]> = [];
  take(lx0: number, ly0: number, lx1: number, ly1: number): void {
    this.rects.push([lx0, ly0, lx1, ly1]);
  }
  free(lx0: number, ly0: number, lx1: number, ly1: number, margin = 0.05): boolean {
    return !this.rects.some(([a, b, c, d]) => lx0 < c + margin && lx1 > a - margin && ly0 < d + margin && ly1 > b - margin);
  }
}
