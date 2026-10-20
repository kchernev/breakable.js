// The street: a row of brick walk-ups on each side, built from boxes the library bonds where they
// touch. A building is floors of walls standing on slabs: each slab runs out to the facade (the
// grey band between floors), and each floor's walls are piers between the windows, a block under
// each window and a lintel over it, so a blast takes out whole bricks-and-mortar shapes and what's
// above comes down when what carries it goes. Windows have frames, sashes and panes; some floors
// have balconies with railings; ledges carry AC units and plants; roofs have parapets and, now and
// then, a water tower.

import type { Destruction, Piece, Pose } from '../../../lib/index.ts';
import { cylinder, quatFromAxisAngle, random, type V3 } from '../../../lib/index.ts';

/** Where the street is: its asphalt, the sidewalks, and where the facades stand. */
export const STREET = {
  /** The asphalt's top (the sidewalks' top, and the ground the buildings stand on, is 0). */
  road: -0.15,
  /** Half the road's width; the sidewalks run from it to the facades. */
  halfRoad: 6.5,
  /** Distance from the street's middle to the facades. */
  front: 10.5,
  /** The row runs along x over this length, centred. */
  length: 64,
};

/**
 * The road between the curbs breaks along the row and 8 m past each end (Destruction.addGround):
 * asphalt over earth in slabs of about 2.2 m, on its bed (the road's fixed ground, moved down to
 * their bottom: where groundAt has the ground there).
 */
export const ROAD = { half: 40, depth: 0.3, underDepth: 0.9, cell: 2.2, bed: STREET.road - 1.2 };

/**
 * The sidewalks along the same stretch, curb to facade: concrete flags of 2 m (a slab each, the
 * map's joints on their seams) over the earth, on the road's bed.
 */
export const WALK = { depth: 0.2, cell: 2 };

/** Whether (x, z) is on the street's breakable stretch, the road or its sidewalks (where the ground is their bed). */
export const inStretch = (x: number, z: number) => Math.abs(x) <= ROAD.half && Math.abs(z) <= STREET.front;

/** Where the manhole covers lie in the lanes (x, z), each clear of the slabs' seams and the parked cars. */
const MANHOLES: Array<[number, number]> = [
  [-14.5, -3.2],
  [6, 3.2],
  [24, -2.8],
];

export interface BuildingStyle {
  /** The facade's material (a brick of the demo's materials), and its tint. */
  wall: string;
  brick: number;
  trim: number;
  frame: number;
  floors: number;
  floorHeight: number;
  bays: number;
  balconies: boolean;
  /** A fire escape up two bays of the facade (where there are no balconies). */
  fireEscape: boolean;
  waterTower: boolean;
  depth: number;
}

export interface CityStats {
  buildings: number;
  pieces: number;
}

const BRICKS = [0xffffff, 0xf2d8c8, 0xd8bcae, 0xffeee0, 0xb89888, 0xe8c8b0];
const BROWNS = [0xffffff, 0xf0e4dc, 0xe0d0c4];
const PAINTS = [0xffffff, 0xf4ead6, 0xdfe6ea, 0xeed8c8, 0xd8dccc];
const TRIMS = [0xd8d2c8, 0xc8c0b4, 0xb8b4ac, 0xe4ded2];
const FRAMES = [0xf2efe8, 0xe8e2d6, 0x3a3f46, 0x6b4b36];

/** Build both sides of the street. */
export function buildStreet(d: Destruction, seed = 7, options: { hydrants?: boolean } = {}): CityStats {
  const rand = random(seed);
  const pick = <T>(xs: T[]) => xs[Math.floor(rand() * xs.length)];
  let buildings = 0;
  const before = d.stats.pieces;
  for (const side of [1, -1] as const) {
    let x = -STREET.length / 2;
    while (x < STREET.length / 2 - 6) {
      const width = Math.min(STREET.length / 2 - x, 9 + Math.floor(rand() * 3) * 1.5);
      const bays = Math.max(2, Math.round(width / 2.6));
      const balconies = rand() < 0.45;
      // Red brick mostly; some dark brown, some painted
      const r = rand();
      const wall = r < 0.5 ? 'brick' : r < 0.78 ? 'brickBrown' : 'brickPainted';
      const style: BuildingStyle = {
        wall,
        brick: wall === 'brick' ? pick(BRICKS) : wall === 'brickBrown' ? pick(BROWNS) : pick(PAINTS),
        trim: pick(TRIMS),
        frame: pick(FRAMES),
        // The near row lower, so the sun gets over it onto the far facades
        floors: side === 1 ? 4 + Math.floor(rand() * 3) : 3 + Math.floor(rand() * 2),
        floorHeight: 3.1 + rand() * 0.3,
        bays,
        balconies,
        fireEscape: !balconies && bays >= 3 && rand() < 0.8,
        waterTower: rand() < 0.35,
        depth: 9 + Math.floor(rand() * 3),
      };
      building(d, x, width, side, style, rand);
      buildings++;
      x += width;
    }
  }
  streetFurniture(d, rand, options.hydrants ?? true);
  return { buildings, pieces: d.stats.pieces - before };
}

/**
 * One building, its facade on the street. Local frame: lx along the street from its left end, ly
 * up, lz into the building from the facade; `side` 1 is the far (+z) side of the street.
 */
export function building(d: Destruction, x0: number, width: number, side: 1 | -1, s: BuildingStyle, rand: () => number): void {
  const W = width - 0.06; // a gap between neighbours: separate structures
  const D = s.depth;
  const t = 0.32; // wall thickness
  const ts = 0.26; // slab thickness
  const H = s.floorHeight;
  const ox = x0 + 0.03;
  // Its brick is laid as one wall: every piece of it maps the texture in the building's frame, so
  // the courses run on across piers, sills and lintels (each piece's own frame would start them
  // afresh at each)
  const wall: Pose = { position: [ox, 0, side * STREET.front], rotation: [0, 0, 0, 1] };
  // A box in the local frame (min corner and size) into the world
  const box = (material: string, lx: number, ly: number, lz: number, sx: number, sy: number, sz: number, tint?: number) => {
    const cz = side * (STREET.front + lz + sz / 2);
    return d.addBox({ material, size: [sx, sy, sz], position: [ox + lx + sx / 2, ly + sy / 2, cz], tint, textureFrame: material === s.wall ? wall : undefined });
  };

  // Slabs: floors 0..floors (the last is the roof), in panels of about 3 m. They stop just short of
  // the facade, which stands on its own: a brick face carried by the brick below it, tied in only
  // at its corners, so it peels away when what's under it goes
  const nx = Math.max(2, Math.round(W / 2.1));
  const nz = Math.max(2, Math.round(D / 2.1));
  const z0 = t + 0.02;
  // The band's lips, by floor then bay (fire escapes are bracketed to them)
  const lips: Array<Array<Piece | null>> = [];
  for (let k = 0; k <= s.floors; k++) {
    const y = k * H;
    for (let i = 0; i < nx; i++)
      for (let j = 0; j < nz; j++) {
        const [x1, x2] = [(i * W) / nx, ((i + 1) * W) / nx];
        const [z1, z2] = [z0 + (j * (D - z0)) / nz, z0 + ((j + 1) * (D - z0)) / nz];
        box('concrete', x1, y, z1, x2 - x1, ts, z2 - z1, s.trim);
      }
    // The facade's band at the slab's level, a bay at a time, and its lip proud of the facade
    for (let i = 0; i < s.bays; i++) box('concrete', (i * W) / s.bays, y, 0, W / s.bays, ts, t, s.trim);
    lips[k] = [];
    if (k > 0) for (let i = 0; i < s.bays; i++) lips[k][i] = box('concrete', (i * W) / s.bays, y - 0.06, -0.1, W / s.bays, ts + 0.12, 0.1, s.trim);
  }

  for (let k = 0; k < s.floors; k++) {
    const yb = k * H + ts;
    const fh = H - ts;
    facade(box, W, yb, fh, t, s, rand, k);
    // Back wall: a few windows' worth of plain panels
    const nb = Math.max(2, Math.round(W / 1.6));
    for (let i = 0; i < nb; i++) box(s.wall, (i * W) / nb, yb, D - t, W / nb, fh, t, s.brick);
    // Side walls between front and back, in panels
    const ns = Math.max(2, Math.round((D - 2 * t) / 1.6));
    for (const lx of [0, W - t])
      for (let j = 0; j < ns; j++) {
        const [z1, z2] = [t + (j * (D - 2 * t)) / ns, t + ((j + 1) * (D - 2 * t)) / ns];
        box(s.wall, lx, yb, z1, t, fh, z2 - z1, s.brick);
      }
    // A partition across the middle, plaster, with a doorway
    const pz = D * (0.45 + rand() * 0.1);
    const door = 1.0;
    const dx = t + 0.6 + rand() * (W - 2 * t - door - 1.2);
    // Either side of the door in panels of about 1.6 m (no long pieces: see the parapets)
    for (const [a, b] of [
      [t, dx],
      [dx + door, W - t],
    ]) {
      const n = Math.max(1, Math.round((b - a) / 1.6));
      for (let i = 0; i < n; i++) box('plaster', a + (i * (b - a)) / n, yb, pz, (b - a) / n, fh, 0.12);
    }
    box('plaster', dx, yb + 2.1, pz, door, fh - 2.1, 0.12);
    // Ceiling lights, hanging under the slab above
    for (let i = 0; i < Math.max(2, Math.round(W / 4)); i++) {
      if (rand() < 0.35) continue;
      const lx = ((i + 0.5) * W) / Math.max(2, Math.round(W / 4));
      box('lamp', lx - 0.25, (k + 1) * H - 0.08, 1.6 + rand() * 1.5, 0.5, 0.08, 0.5);
    }
  }

  // Roof: a parapet, its coping, and maybe a water tower
  const top = s.floors * H + ts;
  const ph = 0.9;
  // In lengths of about 2 m: no piece much bigger than a slab panel. One much bigger than the rest is
  // among the broadphase's large bodies, which every moving piece is tested against, and a parapet
  // in one length would come down whole
  const runs = (length: number) => Math.max(1, Math.round(length / 2.2));
  const nf = runs(W);
  for (let i = 0; i < nf; i++) {
    const [x1, x2] = [(i * W) / nf, ((i + 1) * W) / nf];
    box(s.wall, x1, top, 0, x2 - x1, ph, t, s.brick);
    box(s.wall, x1, top, D - t, x2 - x1, ph, t, s.brick);
    box('concrete', x1 - (i === 0 ? 0.04 : 0), top + ph, -0.12, x2 - x1 + (i === 0 || i === nf - 1 ? 0.04 : 0), 0.14, 0.12 + t + 0.06, s.trim);
  }
  const nd = runs(D - 2 * t);
  for (let j = 0; j < nd; j++) {
    const [z1, z2] = [t + (j * (D - 2 * t)) / nd, t + ((j + 1) * (D - 2 * t)) / nd];
    box(s.wall, 0, top, z1, t, ph, z2 - z1, s.brick);
    box(s.wall, W - t, top, z1, t, ph, z2 - z1, s.brick);
  }
  if (s.waterTower) waterTower(d, ox + W * (0.3 + rand() * 0.4), top, side * (STREET.front + D * 0.6));
  if (s.fireEscape) {
    // A box turned about z (a stair's stringer): centre (lx, ly), its z span in the local frame
    const tilted = (material: string, cx: number, cy: number, lz: number, length: number, depth: number, thick: number, angle: number) =>
      d.addBox({ material, size: [length, depth, thick], position: [ox + cx, cy, side * (STREET.front + lz + thick / 2)], rotation: quatFromAxisAngle([0, 0, 1], angle) });
    const first = Math.floor((s.bays - 2) / 2);
    fireEscape(d, box, tilted, (first * W) / s.bays, ((first + 2) * W) / s.bays, s, ts, lips.map((row) => row.slice(first, first + 2)));
  }
}

type TiltedFn = (material: string, cx: number, cy: number, lz: number, length: number, depth: number, thick: number, angle: number) => Piece | null;

/**
 * A fire escape over the facade from xs to xe: a grated platform at each floor above the first
 * (bracketed to the band's lips), railed round, a steep stair from each up to a hatch in the next,
 * and a ladder hanging from the lowest. Everything iron: it bends before it tears.
 */
function fireEscape(d: Destruction, box: BoxFn, tilted: TiltedFn, xs: number, xe: number, s: BuildingStyle, ts: number, lips: Array<Array<Piece | null>>): void {
  const H = s.floorHeight;
  const plate = 0.05;
  const [back, mid, front] = [-0.1, -0.7, -1.35];
  const angle = (55 * Math.PI) / 180;
  const run = H / Math.tan(angle);
  const xa = xs + 0.25;
  const xb = xa + run;
  const hatch = 0.9;
  const bar = 0.04;
  const platforms: Array<{ back: Piece | null; left: Piece | null; right: Piece | null }> = [];
  for (let k = 1; k < s.floors; k++) {
    const y = k * H + ts;
    const strip = box('grate', xs, y - plate, mid, xe - xs, plate, back - mid) as Piece | null;
    // Brackets: bolted to the lips it hangs in front of
    for (const lip of lips[k] ?? []) if (strip && lip) d.bond(strip, lip, 0.15);
    // The front strip, with a hatch where the stair from below comes up
    let left: Piece | null;
    let right: Piece | null = null;
    if (k >= 2) {
      left = box('grate', xs, y - plate, front, xb - hatch - xs, plate, mid - front) as Piece | null;
      right = box('grate', xb, y - plate, front, xe - xb, plate, mid - front) as Piece | null;
    } else left = box('grate', xs, y - plate, front, xe - xs, plate, mid - front) as Piece | null;
    platforms[k] = { back: strip, left, right };

    // Railing: posts along the front (not over the hatch) and down the ends, a rail on top
    const rail = 1.0;
    const posts = Math.round((xe - xs) / 0.45);
    for (let i = 0; i <= posts; i++) {
      const x = xs + 0.02 + (i * (xe - xs - 0.08)) / posts;
      if (k >= 2 && x + bar > xb - hatch && x < xb) continue;
      box('metal', x, y, front, bar, rail - bar, bar);
    }
    for (const x of [xs + 0.02, xe - 0.02 - bar]) for (const z of [-1.0, -0.6, -0.25]) box('metal', x, y, z, bar, rail - bar, bar);
    box('metal', xs, y + rail - bar, front, xe - xs, bar, 0.06);
    for (const x of [xs + 0.02, xe - 0.02 - bar]) box('metal', x, y + rail - bar, front + 0.06, bar, bar, back - front - 0.06);

    // The ladder hanging from the lowest platform, its foot well above the sidewalk
    if (k === 1) {
      const top = y - plate;
      const len = Math.min(2.4, top - 1.2);
      const [r1, r2] = [xe - 0.75, xe - 0.33];
      box('metal', r1, top - len, -1.3, bar, len, bar);
      box('metal', r2, top - len, -1.3, bar, len, bar);
      for (let yy = top - len + 0.2; yy < top - 0.15; yy += 0.3) box('metal', r1 + bar, yy, -1.3, r2 - r1 - bar, 0.03, bar);
    }
  }
  // Stairs between consecutive platforms: two stringers, treads between them, the feet bonded
  // to the platform below and the heads to the one above
  for (let k = 1; k < s.floors - 1; k++) {
    const y0 = k * H + ts;
    const sd = 0.16;
    const length = Math.hypot(run, H);
    const [zo, zi] = [-1.28, -0.79];
    const cx = (xa + xb) / 2;
    const cy = y0 + H / 2 + sd / 2;
    const outer = tilted('metal', cx, cy, zo, length, sd, bar, angle);
    const inner = tilted('metal', cx, cy, zi, length, sd, bar, angle);
    const steps = Math.round(H / 0.24) - 1;
    for (let i = 1; i <= steps; i++) {
      const x = xa + (run * i) / (steps + 1);
      const top = y0 + (H * i) / (steps + 1);
      box('grate', x - 0.11, top - 0.03, zo + bar, 0.22, 0.03, zi - zo - bar);
    }
    const below = platforms[k];
    const above = platforms[k + 1];
    for (const stringer of [outer, inner]) {
      if (!stringer) continue;
      if (below?.left) d.bond(stringer, below.left, 0.02, undefined);
      if (above?.right) d.bond(stringer, above.right, 0.02, undefined);
      if (above?.back) d.bond(stringer, above.back, 0.01, undefined);
    }
  }
}

type BoxFn = (material: string, lx: number, ly: number, lz: number, sx: number, sy: number, sz: number, tint?: number) => Piece | null;

/** One floor of the street facade: piers, the blocks under and over each window, and the windows. */
function facade(box: BoxFn, W: number, yb: number, fh: number, t: number, s: BuildingStyle, rand: () => number, floor: number): void {
  const B = W / s.bays;
  const ww = Math.min(1.25, B * 0.48);
  const wh = Math.min(1.75, fh * 0.62);
  const sill = Math.min(0.9, fh - wh - 0.25);
  const lintel = fh - sill - wh;
  const pier = B - ww;
  // Piers: half a pier at each end, a whole one between bays
  for (let i = 0; i <= s.bays; i++) {
    const w = i === 0 || i === s.bays ? pier / 2 : pier;
    const x = i === 0 ? 0 : i * B - pier / 2;
    box(s.wall, x, yb, 0, w, fh, t, s.brick);
  }
  const balcony = s.balconies && floor > 0 && floor % 2 === 1;
  for (let i = 0; i < s.bays; i++) {
    const x = i * B + pier / 2;
    box(s.wall, x, yb, 0, ww, sill, t, s.brick);
    box(s.wall, x, yb + sill + wh, 0, ww, lintel, t, s.brick);
    windowIn(box, x, yb + sill, ww, wh, t, s.frame);
    // A ledge under the window, and what stands on it
    if (!balcony) {
      box('concrete', x - 0.08, yb + sill - 0.07, -0.16, ww + 0.16, 0.07, 0.16, s.trim);
      const r = rand();
      if (r < 0.18) acUnit(box, x + ww / 2 - 0.33, yb + sill, s);
      else if (r < 0.36) plant(box, x + 0.15 + rand() * (ww - 0.5), yb + sill, -0.15, rand);
    }
  }
  if (balcony) balconyOn(box, W, yb, s, rand);
}

/** A window in an opening: a frame, a sash bar across the middle, and two panes. */
function windowIn(box: BoxFn, x: number, y: number, w: number, h: number, t: number, frame: number): void {
  const f = 0.07;
  const z = t * 0.35;
  const fd = 0.1;
  box('painted', x, y, z, f, h, fd, frame);
  box('painted', x + w - f, y, z, f, h, fd, frame);
  box('painted', x + f, y, z, w - 2 * f, f, fd, frame);
  box('painted', x + f, y + h - f, z, w - 2 * f, f, fd, frame);
  box('painted', x + f, y + h / 2 - f / 2, z, w - 2 * f, f, fd, frame);
  const ph = h / 2 - f * 1.5;
  box('glass', x + f, y + f, z + 0.035, w - 2 * f, ph, 0.03);
  box('glass', x + f, y + h / 2 + f / 2, z + 0.035, w - 2 * f, ph, 0.03);
}

function acUnit(box: BoxFn, x: number, ledgeTop: number, _s: BuildingStyle): void {
  box('sheet', x, ledgeTop, -0.5, 0.66, 0.44, 0.5, 0xd9dcd8);
  box('metal', x + 0.08, ledgeTop + 0.08, -0.52, 0.5, 0.28, 0.02);
}

/** A pot and its leaves, standing at `ledgeTop`, centred `z` out from the facade. */
function plant(box: BoxFn, x: number, ledgeTop: number, z: number, rand: () => number): void {
  const pot = 0.18 + rand() * 0.06;
  const front = Math.min(z + pot / 2, -0.005);
  box('pot', x, ledgeTop, front - pot, pot, pot * 0.9, pot);
  box('foliage', x - 0.03, ledgeTop + pot * 0.9, front - pot - 0.02, pot + 0.06, 0.28 + rand() * 0.2, pot + 0.02, 0x5f8a3a);
}

/** A balcony across the middle bays: a slab out from the facade and a railing round it. */
function balconyOn(box: BoxFn, W: number, yb: number, s: BuildingStyle, rand: () => number): void {
  const bw = Math.min(W - 1.2, 2.6 + Math.floor(rand() * 2) * 1.3);
  const x = (W - bw) / 2;
  const depth = 1.2;
  const th = 0.16;
  const y = yb - th; // its top level with the floor inside
  // Out from the band's lip (0.1 proud of the facade), which it's bonded to
  const z0 = -0.1;
  box('concrete', x, y, z0 - depth, bw, th, depth, s.trim);
  const rail = 1.0;
  const bar = 0.04;
  const ry = y + th;
  // Posts along the front and the two ends, a rail on top
  const posts = Math.round(bw / 0.28);
  const zf = z0 - depth;
  for (let i = 0; i <= posts; i++) box('metal', x + 0.04 + (i * (bw - 0.08 - bar)) / posts, ry, zf + 0.04, bar, rail - bar, bar);
  for (const ex of [x + 0.04, x + bw - 0.04 - bar])
    for (let j = 1; j < 4; j++) box('metal', ex, ry, zf + 0.04 + (j * (depth - 0.08)) / 4, bar, rail - bar, bar);
  box('metal', x + 0.02, ry + rail - bar, zf + 0.02, bw - 0.04, bar, bar * 2);
  box('metal', x + 0.02, ry + rail - bar, zf + 0.02 + bar * 2, bar * 2, bar, depth - 0.12 - bar * 2);
  box('metal', x + bw - 0.02 - bar * 2, ry + rail - bar, zf + 0.02 + bar * 2, bar * 2, bar, depth - 0.12 - bar * 2);
  // A chair and a pot or two
  if (rand() < 0.6) box('painted', x + 0.4, ry, zf + 0.4, 0.45, 0.45, 0.45, 0x4f6f8f);
  if (rand() < 0.7) plant(box, x + bw - 0.6, ry, z0 - 0.3, rand);
}

/** A wooden tank on four steel legs. */
function waterTower(d: Destruction, x: number, y: number, z: number): void {
  const legH = 2.2;
  const r = 1.3;
  for (const [dx, dz] of [
    [-0.8, -0.8],
    [0.8, -0.8],
    [-0.8, 0.8],
    [0.8, 0.8],
  ])
    d.addBox({ material: 'metal', size: [0.16, legH, 0.16], position: [x + dx, y + legH / 2, z + dz] });
  d.addBox({ material: 'metal', size: [2.0, 0.12, 2.0], position: [x, y + legH + 0.06, z] });
  // The tank: a twelve-sided prism, and a cone of a roof, both shaded round (their rims sharp)
  const ring = (radius: number, h: number): V3[] => Array.from({ length: 12 }, (_, i) => [Math.cos((i * Math.PI) / 6) * radius, h, Math.sin((i * Math.PI) / 6) * radius] as V3);
  const base = y + legH + 0.12;
  const tankH = 2.4;
  d.addConvex({ material: 'wood', points: [...ring(r, 0), ...ring(r, tankH)], position: [x, base, z], smooth: 0.6 });
  d.addConvex({ material: 'wood', points: [...ring(r + 0.08, 0), [0, 0.9, 0]], position: [x, base + tankH, z], tint: 0x7a6a58, smooth: 0.6 });
}

/** Lamp posts, a street sign, a hydrant along the near sidewalks. */
function streetFurniture(d: Destruction, rand: () => number, hydrants: boolean): void {
  for (const side of [1, -1]) {
    for (let x = -STREET.length / 2 + 6; x < STREET.length / 2 - 4; x += 12 + rand() * 4) {
      const z = side * (STREET.halfRoad + 0.6);
      // The post in two lengths (no piece much over 2 m: see the parapets)
      d.addBox({ material: 'metal', size: [0.14, 2.3, 0.14], position: [x, 1.15, z] });
      d.addBox({ material: 'metal', size: [0.14, 2.3, 0.14], position: [x, 3.45, z] });
      // The arm out over the road from the post's side, the lamp under its end
      d.addBox({ material: 'metal', size: [0.12, 0.12, 1.2], position: [x, 4.5, z - side * (0.07 + 0.6)] });
      d.addBox({ material: 'lamp', size: [0.34, 0.12, 0.5], position: [x, 4.38, z - side * 1.0] });
    }
  }
  // The corner sign: a post and two crossed blades
  const sx = -3;
  const sz = STREET.halfRoad + 0.9;
  d.addBox({ material: 'metal', size: [0.09, 3.3, 0.09], position: [sx, 1.65, sz] });
  d.addBox({ material: 'painted', size: [1.1, 0.24, 0.03], position: [sx, 3.12, sz - 0.06], tint: 0x1f6b3a });
  d.addBox({ material: 'painted', size: [0.03, 0.24, 1.1], position: [sx + 0.06, 2.84, sz], tint: 0x1f6b3a });
  // Manhole covers in the lanes: cast iron discs lying on the asphalt, each on one slab, so they go
  // where it goes (thrown whole by a blast, too small to cut; dropped into a crater under them)
  for (const [x, z] of MANHOLES) d.addConvex({ material: 'manhole', points: cylinder(0.38, 0.03, 20), position: [x, STREET.road, z] });
  // Hydrants (boxes, unless there are models of them)
  if (!hydrants) return;
  for (const [x, side] of [
    [8, 1],
    [-14, -1],
  ] as const) {
    d.addBox({ material: 'painted', size: [0.3, 0.6, 0.3], position: [x, 0.3, side * (STREET.halfRoad + 0.5)], tint: 0xb3261e });
    d.addBox({ material: 'painted', size: [0.22, 0.12, 0.22], position: [x, 0.66, side * (STREET.halfRoad + 0.5)], tint: 0xb3261e });
  }
}
