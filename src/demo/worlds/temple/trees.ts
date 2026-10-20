// The trees: cypresses (a short trunk and a flame-shaped crown of stacked frusta, ragged and a
// little bent, with side flames low down, which a blast at the foot drops whole) and olives (a
// leaning, twisted trunk with a flared foot, limbs forking up to two or three broad canopies, each
// a few cells of leaves). Foliage is tinted per piece: dark green for cypress, darker toward the
// foot; grey-green for olive, darker underneath and silvery on top.

import { clip, type Convex, hullConvex, type V3, voronoi } from '../../../lib/index.ts';
import { hex, type Kit, ring } from './kit.ts';

const CYPRESSES: Array<[number, number, number]> = [
  [30.5, -0.5, 9.5],
  [30.5, 8.5, 10],
  [-30, 9, 10.5],
  [-31, 15, 9],
  [-29.5, 21, 11],
  [-10, 9, 9],
  [-6, -27, 10],
  [-1, -28, 8.5],
  [-6, 21.5, 9],
  [2, 21.5, 10.5],
  [10, 21.5, 8],
  [22, 21.5, 11],
  [35.4, -16, 9],
  [-22, -8, 10.5],
  [-24, -2, 9],
  [-18, -26, 10],
];

const OLIVES: Array<[number, number]> = [
  [4, 13],
  [19, 15],
  [25, 18],
  [-4, 16],
  [-12, 20],
  [-28, -14],
  [-22, -20],
  [-30, -2],
  [27, -8],
  [13, 18.6],
  [-8, -16],
  [24, 12],
];

export function buildTrees(k: Kit): void {
  for (const [x, z, h] of CYPRESSES) cypress(k, x, z, h);
  for (const [x, z] of OLIVES) olive(k, x, z);
}

/** A colour t of the way from a to b. */
function lerpHex(a: number, b: number, t: number): number {
  const ch = (c: number, s: number) => ((c >> s) & 255) / 255;
  return hex(ch(a, 16) + (ch(b, 16) - ch(a, 16)) * t, ch(a, 8) + (ch(b, 8) - ch(a, 8)) * t, ch(a, 0) + (ch(b, 0) - ch(a, 0)) * t);
}

/** A tint a little lighter or darker. */
function shade(k: Kit, c: number, spread = 0.08): number {
  const f = 1 - spread + k.rand() * spread * 2;
  return hex((((c >> 16) & 255) / 255) * f, (((c >> 8) & 255) / 255) * f, ((c & 255) / 255) * f);
}

function cypress(k: Kit, x: number, z: number, height: number): void {
  const r = k.rand;
  const s = (height - 1) / 8.5;
  const sides = 18;
  const a0 = r() * Math.PI;
  k.hull('bark', [...ring(x, 0, z, 0.22, 10, a0), ...ring(x, 1.0, z, 0.17, 10, a0)], { tint: 0x7a6a58 });
  // The crown's profile (height, radius): a slim flame, widest a third of the way up; each
  // frustum's top ring is the next one's bottom, so they bond
  const profile: Array<[number, number]> = [
    [1.0, 0.36],
    [1.0 + 0.7 * s, 0.56],
    [1.0 + 1.6 * s, 0.7],
    [1.0 + 2.6 * s, 0.75],
    [1.0 + 3.6 * s, 0.71],
    [1.0 + 4.7 * s, 0.63],
    [1.0 + 5.8 * s, 0.51],
    [1.0 + 6.8 * s, 0.36],
    [1.0 + 7.6 * s, 0.2],
    [height, 0],
  ];
  // Each ring off the one below by a little, in a direction that wanders: the crown bends and
  // kinks instead of standing as a turned spindle
  let off: [number, number] = [0, 0];
  let heading = r() * Math.PI * 2;
  const centres = profile.map(([y], i) => {
    if (i > 0) {
      heading += (r() - 0.5) * 1.6;
      const step = 0.04 + r() * 0.06;
      off = [off[0] + Math.cos(heading) * step, off[1] + Math.sin(heading) * step];
    }
    return [x + off[0], y, z + off[1]] as V3;
  });
  // Two or three side flames on the lower half: the rings bulge out there, toward one side
  const flames = Array.from({ length: 2 + Math.floor(r() * 2) }, () => {
    const y0 = 1.2 + r() * 2.4 * s;
    return { a: r() * Math.PI * 2, y0, y1: y0 + (1.6 + r() * 1.4) * s, amp: 0.1 + r() * 0.1 };
  });
  const bulge = (a: number, y: number) =>
    flames.reduce((sum, f) => {
      if (y <= f.y0 || y >= f.y1) return sum;
      const da = Math.atan2(Math.sin(a - f.a), Math.cos(a - f.a));
      return sum + f.amp * Math.exp(-((da / 0.55) ** 2)) * Math.sin((Math.PI * (y - f.y0)) / (f.y1 - f.y0));
    }, 0);
  // Each ring irregular: its size wandering between 80% and 120% of the profile's (a walk, so the
  // outline swells and narrows instead of alternating), each point by up to ±5% (made once: it's
  // the top of one frustum and the bottom of the next)
  let j = 0.9 + r() * 0.2;
  const rings = profile.map(([y, rad], i) => {
    const c = centres[i];
    if (rad <= 0) return [c];
    j = Math.min(1.2, Math.max(0.8, j + (r() - 0.5) * 0.24));
    const turn = a0 + r() * 0.3;
    return ring(c[0], y, c[2], rad * j, sides, turn).map(([px, py, pz], n) => {
      const w = (0.95 + r() * 0.1) * (1 + bulge(turn + (n / sides) * Math.PI * 2, y));
      return [c[0] + (px - c[0]) * w, py, c[2] + (pz - c[2]) * w] as V3;
    });
  });
  // Darker toward the foot, where the sun doesn't reach
  const top = lerpHex(0x3e5a32, 0x46623a, r());
  for (let i = 0; i + 1 < rings.length; i++) {
    const t = i / (rings.length - 2);
    k.hull('cypress', [...rings[i], ...rings[i + 1]], { tint: shade(k, lerpHex(0x2f4a26, top, Math.min(1, t * 1.3)), 0.04) });
  }
}

/**
 * An olive: a gnarled trunk in three lengths, leaning and twisting, with a flared foot; a limb from
 * its head to each of two or three canopies, forking under it into a branch and a twig; and the
 * crown: the canopies, broad flattened domes with a lumpy outline, each split into a few cells
 * (darker underneath, silvery on top) that share faces, so they bond to each other and a blast
 * strips them one by one. A canopy's underside is flat, at the height where its branch and twig
 * end, so they press on it (bonded, nothing floating).
 */
function olive(k: Kit, x: number, z: number): void {
  const r = k.rand;
  const sides = 9;
  // The trunk's section: irregular, the same shape at each joint (turned a little more each
  // length: a twist) so the lengths bond
  const wobble = Array.from({ length: sides }, () => 0.8 + r() * 0.4);
  const section = (cx: number, y: number, cz: number, rad: number, turn: number): V3[] =>
    wobble.map((wb, i) => {
      const a = turn + (i / sides) * Math.PI * 2;
      return [cx + Math.cos(a) * rad * wb, y, cz + Math.sin(a) * rad * wb];
    });
  const lean = r() * Math.PI * 2;
  const tilt = 0.12 + r() * 0.14;
  const a0 = r() * Math.PI;
  const twist = 0.25 + r() * 0.25;
  // Joints: the flared foot, then up and over in the lean's direction, wandering
  const joints: Array<{ c: V3; rad: number }> = [];
  let [cx, cz] = [x, z];
  const ys = [0, 0.3 + r() * 0.1, 1.0 + r() * 0.25, 1.65 + r() * 0.3];
  const radii = [0.42, 0.27, 0.24, 0.22];
  for (let i = 0; i < ys.length; i++) {
    if (i > 0) {
      const dir = lean + (r() - 0.5) * 1.2;
      const step = (ys[i] - ys[i - 1]) * tilt * (i === 1 ? 0.3 : 1);
      cx += Math.cos(dir) * step;
      cz += Math.sin(dir) * step;
    }
    joints.push({ c: [cx, ys[i], cz], rad: radii[i] * (0.9 + r() * 0.2) });
  }
  const bark = lerpHex(0x8a8274, 0xa49c8c, r());
  const sections = joints.map((j, i) => section(j.c[0], j.c[1], j.c[2], j.rad, a0 + i * twist));
  for (let i = 0; i + 1 < sections.length; i++) k.hull('bark', [...sections[i], ...sections[i + 1]], { tint: shade(k, bark, 0.05) });
  const head = joints[joints.length - 1].c;

  // The canopies round the head, at different heights, the crown 5..6 m across in all
  const n = r() < 0.7 ? 3 : 2;
  const turn = r() * Math.PI * 2;
  const canopies = Array.from({ length: n }, (_, i) => {
    const a = turn + (i * Math.PI * 2) / n + (r() - 0.5) * 0.6;
    const d = (n === 3 ? 1.1 : 1.0) + r() * 0.3;
    const w = 2.6 + r() * 0.9;
    const h = w * (0.5 + r() * 0.1);
    const base = head[1] + 0.65 + r() * 0.35;
    return { a, w, h, base, c: [head[0] + Math.cos(a) * d, base + h * 0.45, head[2] + Math.sin(a) * d] as V3 };
  });
  const silver = lerpHex(0xc0c8aa, 0xccd2b8, r());
  for (const [i, cp] of canopies.entries()) {
    let hull = hullConvex(canopy(k, cp.c, cp.base, cp.w, cp.h));
    // Clear of its neighbours: cut along the plane halfway between, with a gap
    for (const [j, other] of canopies.entries()) {
      if (!hull || j === i) continue;
      const v: V3 = [other.c[0] - cp.c[0], other.c[1] - cp.c[1], other.c[2] - cp.c[2]];
      const l = Math.hypot(...v);
      const nrm: V3 = [v[0] / l, v[1] / l, v[2] / l];
      const mid: V3 = [(other.c[0] + cp.c[0]) / 2, (other.c[1] + cp.c[1]) / 2, (other.c[2] + cp.c[2]) / 2];
      hull = clip(hull, nrm, nrm[0] * mid[0] + nrm[1] * mid[1] + nrm[2] * mid[2] - 0.08);
    }
    if (!hull) continue;
    // Cells in two layers: the underside's darker, the top's silvery
    const R = cp.w / 2;
    const seeds: V3[] = [];
    const layer = (count: number, y: number, spread: number) => {
      const s0 = r() * Math.PI * 2;
      for (let q = 0; q < count; q++) {
        const sa = s0 + (q * Math.PI * 2) / count + (r() - 0.5) * 0.8;
        const sd = spread * (0.45 + r() * 0.55);
        seeds.push([cp.c[0] + Math.cos(sa) * sd, y, cp.c[2] + Math.sin(sa) * sd]);
      }
    };
    layer(2 + Math.floor(r() * 2), cp.base + cp.h * 0.22, R * 0.55);
    layer(2 + Math.floor(r() * 2), cp.base + cp.h * 0.68, R * 0.4);
    for (const cell of voronoi(hull, seeds, 0.02)) {
      const t = Math.min(1, Math.max(0, (cell.centroid[1] - cp.base - cp.h * 0.2) / (cp.h * 0.45)));
      k.hull('foliage', cell.convex.faces.flatMap((f) => f.pts), { tint: shade(k, lerpHex(0x7f8c6c, silver, t), 0.05) });
    }
    // The limb from the head up toward the canopy, forking under it into a branch and a twig,
    // their ends flat on its underside
    const out: [number, number] = [Math.cos(cp.a), Math.sin(cp.a)];
    const side: [number, number] = [-out[1], out[0]];
    const foot: V3 = [head[0] + out[0] * 0.12, head[1], head[2] + out[1] * 0.12];
    const forkY = cp.base - 0.35 - r() * 0.15;
    const fork: V3 = [head[0] + (cp.c[0] - head[0]) * 0.45, forkY, head[2] + (cp.c[2] - head[2]) * 0.45];
    k.hull('bark', [...ring(foot[0], foot[1], foot[2], 0.1, 7, a0), ...ring(fork[0], fork[1], fork[2], 0.11, 7, a0)], { tint: shade(k, bark, 0.05) });
    // Where each ends (out from the canopy's middle, across), and its radius there
    const ends: Array<[number, number, number]> = [
      [0.1, -0.3, 0.04],
      [-0.15, 0.35 + r() * 0.25, 0.03],
    ];
    for (const [e, [along, across, rad]] of ends.entries()) {
      const sgn = e === 0 ? -1 : 1;
      const at: V3 = [fork[0] + side[0] * 0.055 * sgn, forkY, fork[2] + side[1] * 0.055 * sgn];
      // Pulled in toward the middle until its end is wholly on the underside
      let f = 1;
      const tipAt = (g: number): V3 => [cp.c[0] + (out[0] * along + side[0] * across) * g, cp.base, cp.c[2] + (out[1] * along + side[1] * across) * g];
      while (f > 0.2 && !ring(...tipAt(f), rad, 6, a0).every((q) => within(hull, [q[0], q[1] + 0.01, q[2]]))) f *= 0.8;
      const tip = tipAt(f);
      k.hull('bark', [...ring(at[0], at[1], at[2], 0.045, 6, a0), ...ring(tip[0], tip[1], tip[2], rad, 6, a0)], { tint: shade(k, bark, 0.05) });
    }
  }
}

/** Whether p is inside a convex. */
function within(c: Convex, p: V3): boolean {
  return c.faces.every((f) => f.n[0] * p[0] + f.n[1] * p[1] + f.n[2] * p[2] <= f.d + 1e-6);
}

/**
 * A canopy's points: a broad dome flattened to h, its underside flat at `base`, its outline lumpy
 * (the same lumps all the way up, so they read as masses of leaves), longer one way than the other.
 */
function canopy(k: Kit, c: V3, base: number, w: number, h: number): V3[] {
  const r = k.rand;
  const R = w / 2;
  const phase = [r(), r(), r()].map((v) => v * Math.PI * 2);
  const stretch = 0.8 + r() * 0.15;
  const spin = r() * Math.PI;
  const lump = (a: number) => 1 + 0.14 * Math.sin(2 * a + phase[0]) + 0.1 * Math.sin(3 * a + phase[1]) + 0.07 * Math.sin(5 * a + phase[2]);
  // Rings up the dome: height, radius, points
  const rings: Array<[number, number, number]> = [
    [0, 0.5, 10],
    [0.24, 0.95, 12],
    [0.55, 0.93, 10],
    [0.82, 0.6, 7],
    [1, 0.22, 3],
  ];
  const pts: V3[] = [];
  for (const [ty, tr, count] of rings) {
    const off = r() * Math.PI * 2;
    for (let i = 0; i < count; i++) {
      const a = off + (i / count) * Math.PI * 2;
      const rad = R * tr * lump(a) * (0.9 + r() * 0.2);
      const [lx, lz] = [Math.cos(a) * rad, Math.sin(a) * rad * stretch];
      const y = ty === 0 ? base : base + h * (ty + (r() - 0.5) * 0.08);
      pts.push([c[0] + lx * Math.cos(spin) - lz * Math.sin(spin), y, c[2] + lx * Math.sin(spin) + lz * Math.cos(spin)]);
    }
  }
  return pts;
}
