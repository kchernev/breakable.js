// The stoa ruin along the north edge: a platform, a line of nine column places (some full, some
// broken off, one gone), what's left of the entablature over two stretches, and the back wall
// standing ragged, taller toward the east, with a return at its east end. Built of `ruin`, the
// older marble that gives way at a near miss.

import { band, courses, frieze, platform, wall } from './doric.ts';
import { column, type Kit } from './kit.ts';
import { noise2 } from './layout.ts';

const LINE = -20.5;
const X0 = 13;
const AX = 2.4;
/** Drums standing at each column place (8: whole, with its capital). */
const STANDING = [8, 8, 8, 2, 0, 8, 8, 4, 1];

export function buildStoa(k: Kit): void {
  const floor = 0.3;
  platform(k, 'marble', 11.8, 33.6, -27.2, -19.6, 0, floor, { zs: [-23.4], length: 2.42 });
  const drums = Array(8).fill(0.6);
  STANDING.forEach((n, i) => {
    if (n) column(k, { material: 'ruin', at: [X0 + AX * i, floor, LINE], drums, r0: 0.5, r1: 0.4, sides: 20, echinus: { h: 0.32, r: 0.62 }, abacus: { w: 1.3, h: 0.22 }, standing: n });
  });
  const capital = floor + 4.8 + 0.32 + 0.22;
  const arch = capital + 0.85;
  const frz = arch + 0.7;
  const geison = frz + 0.35;
  // Over the first three columns: architrave, a frieze with two metopes fallen out, one cornice block
  const r1 = { x0: X0, x1: X0 + 2 * AX, z0: LINE - 1, z1: LINE };
  const long = [X0, X0 + AX, X0 + 2 * AX];
  k.levers.addAll(band(k, r1, 'ruin', 0, 0.5, capital, arch, { long, short: [] }, { sides: ['s'] }));
  k.levers.addAll(band(k, r1, 'ruin', -0.5, 0, capital, arch, { long, short: [] }, { sides: ['s'] }));
  frieze(k, r1, { v0: 0.1, v1: 0.5, recess: 0.05, y0: arch, y1: frz, tw: 0.44, pitch: AX / 2, material: 'ruin', triglyph: 0xc4c8c4, sides: ['s'], skip: (i) => i === 1 || i === 4 });
  k.levers.addAll(band(k, r1, 'ruin', -0.3, 0.1, arch, frz, { long: [X0 + AX], short: [] }, { sides: ['s'] }));
  k.box('ruin', [X0 + AX * 0.5, frz, LINE - 0.5], [X0 + AX * 1.0, geison, LINE + 0.95]);
  // Over the sixth and seventh: one span of architrave and a cornice block on it
  const x5 = X0 + 5 * AX;
  for (const [a, b] of [
    [LINE - 0.5, LINE],
    [LINE, LINE + 0.5],
  ])
    k.levers.add(k.box('ruin', [x5 - 0.3, capital, a], [x5 + AX + 0.3, arch, b]));
  k.box('ruin', [x5 + 0.6, arch, LINE - 0.5], [x5 + 1.7, arch + 0.35, LINE + 0.95]);

  // The back wall: its height (in courses) varies smoothly, from 2 at the west end to 8 at the east
  const C = courses(floor, Array(8).fill(0.5));
  const height = (x: number) => 2 + 6 * smooth((x - 11.8) / 21.8) + (noise2(x * 0.18, 3.7) - 0.5) * 2.5;
  const lowest = (a: number, b: number) => Math.min(height(a), height((a + b) / 2), height(b));
  wall(k, { material: 'limestone', axis: 'x', from: 11.8, to: 33.0, t0: -26.8, t1: -26.2, courses: C, block: 0.9, pick: (a, b, i) => (i < lowest(a, b) ? 'limestone' : null) });
  // The east return, stepping down from the back wall to the column line
  const ret = (z: number) => 6 - 3 * smooth((z + 26.8) / 6.8);
  wall(k, { material: 'limestone', axis: 'z', from: -26.8, to: -20.0, t0: 33.0, t1: 33.6, courses: C, block: 0.9, pick: (a, b, i) => (i < Math.min(ret(a), ret(b)) ? 'limestone' : null) });
}

const smooth = (t: number) => {
  const c = Math.min(1, Math.max(0, t));
  return c * c * (3 - 2 * c);
};
