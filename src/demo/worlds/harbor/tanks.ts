// The fuel tanks in their bund: steel shells in courses of curved segments, conical roofs of
// plates, ladders, vents and a pipe, inside a low concrete wall with a stile over it. A rocket opens
// a hole in a shell; what's above sags into it; a breached tank catches fire, as one the gun has
// holed enough does (each hole leaking first: index.ts).

import type { Destruction, Piece, Pose, V3 } from '../../../lib/index.ts';
import { cylinder } from '../../../lib/index.ts';
import { aboutZ, Frame, split } from './frame.ts';

export interface Tank {
  center: V3;
  radius: number;
  height: number;
  /** The shell's course segments, and where each stood as built (where a hole opens, whatever flew). */
  shell: Set<Piece>;
  built: Map<Piece, V3>;
  /** The roof's plates. */
  roof: Set<Piece>;
  /** Breached (it's burning, or has burnt). */
  breached: boolean;
  /** Until when a blast near it may breach it, and where (index.ts). */
  armedUntil: number;
  armedAt: V3;
  /** The gun's rounds into its shell lately (each fading over about 20 s): enough, and it catches (index.ts). */
  heat: number;
}

const WHITE = 0xdcdcd4;
const BAND = 0x6f8a70;
const ROOF = 0xc4c4bc;

/**
 * A shell segment between angles a0 and a1: its outer face curved (`steps` flats, shaded smooth so
 * the tank reads round), its inner face one flat. Neighbours still share their radial faces exactly.
 */
function segment(inner: number, outer: number, a0: number, a1: number, height: number, steps: number): V3[] {
  const pts: V3[] = [];
  for (let i = 0; i <= steps; i++) {
    const a = a0 + ((a1 - a0) * i) / steps;
    pts.push([outer * Math.cos(a), 0, outer * Math.sin(a)], [outer * Math.cos(a), height, outer * Math.sin(a)]);
  }
  for (const a of [a0, a1]) pts.push([inner * Math.cos(a), 0, inner * Math.sin(a)], [inner * Math.cos(a), height, inner * Math.sin(a)]);
  return pts;
}

/** The bund's wall (its outer faces; 0.3 m thick): what leaks from the tanks stays inside it. */
export const BUND = { x0: 13.5, x1: 34.5, z0: -26.5, z1: -10, wall: 0.3 };

function tank(d: Destruction, cx: number, cz: number, r: number, courses: number, segments: number): Tank {
  const T = 0.08;
  const h = courses * 2;
  const shell = new Set<Piece>();
  const built = new Map<Piece, V3>();
  const roof = new Set<Piece>();
  // The paint's seams and streaks are laid out down from the roof edge (materials.ts tankPaint)
  const textureFrame: Pose = { position: [cx, h, cz], rotation: [0, 0, 0, 1] };
  const rows: Piece[][] = [];
  for (let k = 0; k < courses; k++) {
    const row: Piece[] = [];
    for (let i = 0; i < segments; i++) {
      const a0 = (i / segments) * Math.PI * 2;
      const a1 = ((i + 1) / segments) * Math.PI * 2;
      const p = d.addConvex({ material: 'tank', points: segment(r - T, r, a0, a1, 2, 9), position: [cx, k * 2, cz], tint: k === 2 ? BAND : WHITE, textureFrame, smooth: 0.5 });
      if (p) {
        shell.add(p);
        built.set(p, [...p.pose.position]);
        row.push(p);
      }
    }
    rows.push(row);
  }
  // The roof: a cone of plates, each wedge in two (a ring plate outside half the radius, a wedge
  // to the apex inside), sharing their faces; the ring plates bonded by hand to the course under
  const rise = r * 0.17;
  const plate = 0.06;
  const cone = (rho: number): number => h + rise * (1 - rho / r);
  const ring = (rho: number, a: number): V3[] => [
    [rho * Math.cos(a), cone(rho), rho * Math.sin(a)],
    [rho * Math.cos(a), cone(rho) + plate, rho * Math.sin(a)],
  ];
  const inner: Piece[] = [];
  for (let i = 0; i < segments; i++) {
    const as = [(i / segments) * Math.PI * 2, ((i + 1) / segments) * Math.PI * 2];
    const outerPts = as.flatMap((a) => [...ring(r, a), ...ring(r / 2, a)]);
    const innerPts = [...as.flatMap((a) => ring(r / 2, a)), [0, h + rise, 0] as V3, [0, h + rise + plate, 0] as V3];
    const o = d.addConvex({ material: 'roof', points: outerPts, position: [cx, 0, cz], tint: ROOF });
    const n = d.addConvex({ material: 'roof', points: innerPts, position: [cx, 0, cz], tint: ROOF });
    for (const p of [o, n]) if (p) roof.add(p);
    if (n) inner.push(n);
    if (o && n && ![...o.bonds].some((b) => b.other(o) === n)) d.bond(o, n, 0.03);
    const under = rows[courses - 1][i];
    if (o && under) d.bond(o, under, 0.12);
  }
  // A vent on the apex
  const vent = d.addConvex({ material: 'roof', points: cylinder(0.22, 0.45, 8), position: [cx, h + rise + plate, cz], tint: 0x9a9c98, smooth: 0.9 });
  if (vent && inner[0]) d.bond(vent, inner[0], 0.05);
  // A straight ladder up the south side, held to the top and bottom courses
  const f = new Frame(d, [cx, 0, cz + r + 0.25]);
  const grey = 0x8a8c88;
  const rails: Array<Piece | null> = [];
  for (const x of [-0.28, 0.22]) for (const [y0, y1] of split(0, h + 0.9, 2)) rails.push(f.box('steel', [x, y0, 0], [x + 0.06, y1, 0.06], { tint: grey }));
  for (let y = 0.35; y < h + 0.6; y += 0.4) f.box('steel', [-0.22, y, 0], [0.22, y + 0.035, 0.06], { tint: grey });
  const south = Math.floor(segments / 4);
  for (const rail of rails) {
    if (!rail) continue;
    const y = rail.pose.position[1];
    const row = y < 2 ? rows[0] : y > h - 2 ? rows[courses - 1] : null;
    if (row?.[south]) d.bond(rail, row[south], 0.01);
  }
  return { center: [cx, h / 2, cz], radius: r, height: h, shell, built, roof, breached: false, armedUntil: -1, armedAt: [cx, 0, cz], heat: 0 };
}

export function buildTanks(d: Destruction): Tank[] {
  const tanks = [tank(d, 19, -20.5, 3.5, 4, 14), tank(d, 28.5, -20.5, 3.5, 4, 14), tank(d, 24, -13.5, 2.5, 3, 10)];
  bund(d);
  // A pipe from T1 to the bund's west wall, on a block
  d.addBox({ material: 'concrete', size: [0.5, 0.35, 0.6], position: [14.65, 0.175, -20.5], tint: 0xb4b8b8 });
  d.addConvex({ material: 'steel', points: cylinder(0.15, 1.7, 10), position: [13.8, 0.5, -20.5], rotation: aboutZ(-Math.PI / 2), tint: 0x9a9c98, smooth: 0.7 });
  return tanks;
}

/** The bund: a low concrete wall round the tanks, and a steel stile over its west side. */
function bund(d: Destruction): void {
  const { x0, x1, z0, z1, wall: t } = BUND;
  const f = new Frame(d, [0, 0, 0]);
  const tint = 0xb4b8b8;
  for (const [a, b] of split(x0, x1, 2)) {
    f.box('concrete', [a, 0, z0], [b, 1, z0 + t], { tint });
    f.box('concrete', [a, 0, z1 - t], [b, 1, z1], { tint });
  }
  for (const [a, b] of split(z0 + t, z1 - t, 2)) {
    f.box('concrete', [x0, 0, a], [x0 + t, 1, b], { tint });
    f.box('concrete', [x1 - t, 0, a], [x1, 1, b], { tint });
  }
  // The stile: steps up outside, a plate over the wall, steps down inside
  const steel = 0x6a6c68;
  const [za, zb] = [-15.2, -14.4];
  f.box('steel', [x0 - 0.9, 0, za], [x0, 0.35, zb], { tint: steel });
  f.box('steel', [x0 - 0.6, 0.35, za], [x0, 0.7, zb], { tint: steel });
  f.box('steel', [x0 - 0.3, 0.7, za], [x0, 1.06, zb], { tint: steel });
  f.box('steel', [x0, 1, za], [x0 + t, 1.06, zb], { tint: steel });
  f.box('steel', [x0 + t, 0.7, za], [x0 + t + 0.3, 1.06, zb], { tint: steel });
  f.box('steel', [x0 + t, 0.35, za], [x0 + t + 0.6, 0.7, zb], { tint: steel });
  f.box('steel', [x0 + t, 0, za], [x0 + t + 0.9, 0.35, zb], { tint: steel });
}
