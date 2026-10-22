// The sanctuary's smaller things: the altar before the temple, the ramp up to it, the statue base
// and the exedra round it, the votive column, the stelai, empty pedestals, the temenos wall, and
// the column fragments lying where they fell long ago.

import type { Piece, V3 } from '../../../lib/index.ts';
import { courses, platform, wall } from './doric.ts';
import { column, type Kit, lyingDrum, prismZ, ring, yawQ } from './kit.ts';
import { PLACES } from './layout.ts';

/**
 * The altar: a limestone core on a marble base moulding, a marble crown, a step on its west side,
 * and on it the offering still smouldering, a bed of embers and two layers of charred logs (as they
 * were laid: each layer across the one under it). Returns the embers and logs.
 */
export function buildAltar(k: Kit): Piece[] {
  const { x, z } = PLACES.altar;
  const [x0, x1, z0, z1] = [x - 1.2, x + 1.2, z - 3, z + 3];
  platform(k, 'marble', x0, x1, z0, z1, 0, 0.2, { length: 1.2, anchor: false });
  const core = courses(0.2, [0.425, 0.425]);
  for (const [y0, y1] of core) platform(k, 'limestone', x0 + 0.1, x1 - 0.1, z0 + 0.1, z1 - 0.1, y0, y1, { length: 1.16, anchor: false });
  platform(k, 'marble', x0 - 0.08, x1 + 0.08, z0 - 0.08, z1 + 0.08, 1.05, 1.3, { length: 1.22, anchor: false });
  // The step the priest stood on
  for (let i = 0; i < 6; i++) k.box('limestone', [x0 - 0.8, 0, z0 + i], [x0, 0.3, z0 + i + 1]);
  const fire = [k.box('embers', [x - 0.35, 1.3, z - 0.28], [x + 0.35, 1.34, z + 0.28])];
  for (const dz of [-0.14, 0.14]) fire.push(k.box('embers', [x - 0.3, 1.34, z + dz - 0.05], [x + 0.3, 1.44, z + dz + 0.05]));
  for (const dx of [-0.16, 0.16]) fire.push(k.box('embers', [x + dx - 0.05, 1.44, z - 0.3], [x + dx + 0.05, 1.54, z + 0.3]));
  return fire.filter((p) => p !== null);
}

/** The ramp up the temple's east front: wedges on the ground, and fillers over the lower steps. */
export function buildRamp(k: Kit): void {
  const [xa, xb, za, zb] = [8.7, 12, -5.6, -2.4];
  const rise = (x: number) => (1.05 * (xb - x)) / (xb - xa);
  const xm = (xa + xb) / 2;
  for (const [z0, z1] of [
    [za, (za + zb) / 2],
    [(za + zb) / 2, zb],
  ]) {
    for (const [a, b] of [
      [xa, xm],
      [xm, xb],
    ]) {
      const outline: Array<[number, number]> = [[a, 0], [b, 0], [b, rise(b)], [a, rise(a)]];
      k.hull('marble', prismZ(outline.filter(([, y], i) => i < 2 || y > 1e-6), z0, z1), { anchor: true });
    }
    k.box('marble', [8.25, 0.35, z0], [8.7, 1.05, z1], { anchor: true });
    k.box('marble', [7.8, 0.7, z0], [8.25, 1.05, z1], { anchor: true });
  }
}

/** The statue base (a step, a die in two courses, a crown) and the limestone exedra round it. */
export function buildStatueBase(k: Kit): number {
  const { x, z } = PLACES.statue;
  platform(k, 'marble', x - 1.1, x + 1.1, z - 1.1, z + 1.1, 0, 0.35, { length: 1.1, anchor: false });
  for (const [y0, y1] of courses(0.35, [0.75, 0.75])) {
    k.box('marble', [x - 0.7, y0, z - 0.7], [x, y1, z + 0.7]);
    k.box('marble', [x, y0, z - 0.7], [x + 0.7, y1, z + 0.7]);
  }
  k.box('marble', [x - 0.8, 1.85, z - 0.8], [x + 0.8, 2.1, z + 0.8]);
  // The exedra: a semicircular bench on the west side, two courses and seat slabs, square arms
  const block = (r0: number, r1: number, a0: number, a1: number, y0: number, y1: number): V3[] => {
    const pts: V3[] = [];
    for (const a of [a0, a1]) for (const r of [r0, r1]) for (const y of [y0, y1]) pts.push([x + Math.cos(a) * r, y, z + Math.sin(a) * r]);
    return pts;
  };
  // Course 0 and the seat slabs in 15° blocks, course 1 half a block round (running bond)
  const deg = Math.PI / 180;
  const cuts = (off: number) => {
    const c = [90];
    for (let a = 90 + off; a < 270 - 1e-6; a += 15) if (a > 90 + 1e-6) c.push(a);
    c.push(270);
    return c.map((v) => v * deg);
  };
  for (const [c, [y0, y1]] of courses(0, [0.2, 0.2]).entries()) {
    const a = cuts(c % 2 ? 7.5 : 15);
    for (let i = 0; i + 1 < a.length; i++) k.hull('limestone', block(3.2, 3.8, a[i], a[i + 1], y0, y1));
  }
  const seats = cuts(15);
  for (let i = 0; i + 1 < seats.length; i++) k.hull('limestone', block(3.15, 3.85, seats[i], seats[i + 1], 0.4, 0.5));
  // Square arms at the two ends, against the bench's end faces
  for (const side of [1, -1]) k.box('limestone', [x, 0, z + side * 3.5 - 0.35], [x + 0.6, 0.75, z + side * 3.5 + 0.35]);
  return 2.1;
}

/** The votive column: a base block, ten slender drums, a capital; a tripod goes on top. Returns its top. */
export function buildVotive(k: Kit): number {
  const { x, z } = PLACES.votive;
  k.box('marble', [x - 0.7, 0, z - 0.7], [x + 0.7, 0.4, z + 0.7]);
  return column(k, { material: 'marble', at: [x, 0.4, z], drums: Array(10).fill(0.75), r0: 0.35, r1: 0.29, sides: 20, echinus: { h: 0.3, r: 0.44 }, abacus: { w: 0.95, h: 0.2 } }).top;
}

/** Stelai along the way: a base block, the slab, a gable on top. */
export function buildStelai(k: Kit): void {
  // Either side of the way, clear of the line of sight from the gate to the temple
  for (const [x, z] of [
    [23, 0.8],
    [23, 7.2],
    [19, 0.8],
    [19, 7.2],
  ]) {
    k.box('marble', [x - 0.4, 0, z - 0.225], [x + 0.4, 0.35, z + 0.225]);
    k.box('marble', [x - 0.275, 0.35, z - 0.09], [x + 0.275, 2.05, z + 0.09]);
    k.hull('marble', prismZ([[x - 0.3, 2.05], [x + 0.3, 2.05], [x, 2.3]], z - 0.1, z + 0.1));
  }
}

/** Pedestals whose statues are long gone: a step, a die in two halves, a crown. */
export function buildPedestals(k: Kit): void {
  for (const [x, z] of [
    [10, -15.5],
    [-13, 13],
  ]) {
    k.box('marble', [x - 0.6, 0, z - 0.6], [x + 0.6, 0.2, z + 0.6]);
    k.box('marble', [x - 0.45, 0.2, z - 0.45], [x, 1.2, z + 0.45]);
    k.box('marble', [x, 0.2, z - 0.45], [x + 0.45, 1.2, z + 0.45]);
    k.box('marble', [x - 0.5, 1.2, z - 0.5], [x + 0.5, 1.4, z + 0.5]);
  }
}

/**
 * The temenos wall: three courses of limestone and a coping, along the east side (open for the
 * propylon) and the south. An old wall: here and there, over one to four blocks, its coping has
 * gone, and in some of those places a block or two of the course under it, never leaving a block
 * on a gap; a few of the fallen slabs and blocks lie beside it.
 */
export function buildTemenos(k: Kit): void {
  const C = courses(0, [0.45, 0.45, 0.45]);
  const coping: [number, number] = [1.35, 1.47];
  const B = 1.2;
  const run = (axis: 'x' | 'z', from: number, to: number, t0: number, t1: number) => {
    // Along the wall in blocks: stretches whole, then a damaged one
    const n = Math.ceil((to - from) / B);
    const copingGone = new Set<number>();
    const courseGone = new Set<number>();
    for (let j = Math.floor(k.rand() * 3); j < n; ) {
      const len = 1 + Math.floor(k.rand() * 4);
      for (let q = j; q < j + len && q < n; q++) copingGone.add(q);
      // The course under it too in about half of them, a block or two in from the ends
      if (len >= 2 && k.rand() < 0.55) for (let q = j + (len > 2 ? 1 : 0); q < j + len - (len > 3 ? 1 : 0) && q < n; q++) courseGone.add(q);
      j += len + 2 + Math.floor(k.rand() * 6);
    }
    const index = (a: number) => Math.floor((a - from) / B + 0.01);
    wall(k, { material: 'limestone', axis, from, to, t0, t1, courses: C.slice(0, 2), block: B });
    wall(k, { material: 'limestone', axis, from, to, t0, t1, courses: C.slice(2), block: B, pick: (a) => (courseGone.has(index(a)) ? null : 'limestone') });
    wall(k, { material: 'limestone', axis, from, to, t0: t0 - 0.05, t1: t1 + 0.05, courses: [coping], block: B, bond: false, pick: (a) => (copingGone.has(index(a)) ? null : 'limestone') });
    // Some of what fell lies beside the wall, on one side or the other, turned a little
    const lying = (j: number, size: V3) => {
      const along = Math.min(to - 0.8, from + (j + 0.5) * B + (k.rand() - 0.5) * 0.4);
      const side = k.rand() < 0.5 ? -1 : 1;
      const off = (t0 + t1) / 2 + side * (1.25 + k.rand() * 0.6);
      const at: V3 = axis === 'x' ? [along, size[1] / 2, off] : [off, size[1] / 2, along];
      k.tbox('limestone', at, size, yawQ((axis === 'x' ? 0 : Math.PI / 2) + (k.rand() - 0.5) * 0.9));
    };
    for (const j of copingGone) if (k.rand() < 0.3) lying(j, [B - 0.05, 0.12, t1 - t0 + 0.1]);
    for (const j of courseGone) if (k.rand() < 0.35) lying(j, [B - 0.05, 0.45, t1 - t0]);
  };
  // East side, either side of the propylon; then the south side
  run('z', -19, 0.8, 33.7, 34.3);
  run('z', 7.2, 23.7, 33.7, 34.3);
  run('x', -31, 34.3, 23.7, 24.3);
}

/** Column fragments lying where they fell: drums on a facet, a capital upside down, beams flat. */
export function buildFragments(k: Kit): void {
  const r = k.rand;
  // North of the temple: a toppled column, drums in a loose line, its capital beyond
  for (let i = 0; i < 4; i++) lyingDrum(k, 'drum', -13 + i * 1.05 + r() * 0.2, -14 + (r() - 0.5) * 0.5, (r() - 0.5) * 0.3, 0.6, 0.47 - i * 0.012, 20);
  fallenCapital(k, 'marble', -8.6, -14.3);
  // South of the stoa, where its fifth column stood
  const drums: Array<[number, number, number]> = [
    [20.4, -15.6, 0.3],
    [21.6, -17.4, 1.2],
    [23.2, -16.1, -0.4],
    [26.9, -15.5, 0.9],
    [25.6, -15.4, 2.1],
  ];
  for (const [x, z, yaw] of drums) lyingDrum(k, 'ruin', x, z, yaw, 0.6, 0.46, 20);
  fallenCapital(k, 'ruin', 22.4, -18.6);
  k.box('ruin', [22.8, 0, -17.75], [25.2, 0.5, -17.25]);
  k.box('ruin', [25.8, 0, -17.05], [28.2, 0.5, -16.55]);
  k.box('ruin', [26.4, 0, -19.2], [27.5, 0.35, -17.75]);
  // West of the tholos
  lyingDrum(k, 'drum', -29, 2, 0.5, 0.68, 0.39, 20);
  lyingDrum(k, 'drum', -27.5, 3.5, -0.8, 0.68, 0.38, 20);
}

/** A Doric capital lying upside down: its abacus on the ground, the echinus on it. */
function fallenCapital(k: Kit, material: string, x: number, z: number): Piece | null {
  k.box(material, [x - 0.65, 0, z - 0.65], [x + 0.65, 0.22, z + 0.65]);
  const pts = [...ring(x, 0.22, z, 0.62, 20), ...ring(x, 0.38, z, 0.55, 20), ...ring(x, 0.54, z, 0.4, 20)];
  return k.hull(material, pts, { rotation: [0, 0, 0, 1] });
}

