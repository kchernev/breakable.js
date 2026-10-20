// The gantry crane over Block A: four legs on bogies on two rails, portal beams across their tops,
// two lattice girders along z with a trolley on them, a cab hanging under it, and a 40 ft box
// hanging from four wire ropes on a spreader. Everything reaches the ground through the legs;
// cut one and the others are overloaded (the steel's support is low on purpose), so it comes down
// toward the cut, bending at its joints.

import type { Destruction, V3 } from '../../../lib/index.ts';
import { cylinder, random } from '../../../lib/index.ts';
import { container, FT40, STD, WIDTH } from './containers.ts';
import { aboutX, Frame, spans, split } from './frame.ts';

/** Where the crane stands. */
export const CRANE = { x: -14.8, rails: [-21, -1] as const, girders: [-24, 2] as const, ochre: 0xd4a43a };

export interface Crane {
  /** The hoist's headblock: where the ropes rattle. */
  hoist: V3;
}

export function buildCrane(d: Destruction, hangingTint: number): Crane {
  const xc = CRANE.x;
  const f = new Frame(d, [0, 0, 0]);
  const ochre = CRANE.ochre;
  const S = (min: V3, max: V3, tint = ochre, material = 'steel') => f.box(material, min, max, { tint });

  // Bogies, two under each leg along the rail, with wheels on their sides
  const legX = [xc - 6, xc + 6];
  for (const zr of CRANE.rails)
    for (const lx of legX) {
      for (const bx of [lx - 0.85, lx + 0.85]) {
        S([bx - 0.8, 0, zr - 0.5], [bx + 0.8, 0.9, zr + 0.5], 0x4a4a46);
        for (const wx of [bx - 0.42, bx + 0.42])
          for (const side of [-1, 1]) {
            const z0 = side > 0 ? zr + 0.5 : zr - 0.62;
            d.addConvex({ material: 'steel', points: cylinder(0.32, 0.12, 10), position: [wx, 0.33, z0], rotation: aboutX(Math.PI / 2), tint: 0x2e2e2c, smooth: 0.7 });
          }
      }
    }
  // Sill beams on the bogies, legs on the sills, ties between the legs, portal beams on top
  for (const zr of CRANE.rails) {
    for (const [x0, x1] of spans(xc - 6.7, xc + 6.7, 7)) S([x0, 0.9, zr - 0.45], [x1, 1.6, zr + 0.45]);
    for (const lx of legX) for (const [y0, y1] of spans(1.6, 15, 7)) S([lx - 0.45, y0, zr - 0.45], [lx + 0.45, y1, zr + 0.45]);
    for (const [x0, x1] of spans(xc - 5.55, xc + 5.55, 6)) S([x0, 8, zr - 0.3], [x1, 8.5, zr + 0.3]);
    for (const [x0, x1] of spans(xc - 6.45, xc + 6.45, 7)) S([x0, 15, zr - 0.45], [x1, 16, zr + 0.45]);
  }

  // The main girders: lattice trusses along z, 13 panels of 2 m
  const [za, zb] = CRANE.girders;
  const points = Array.from({ length: 14 }, (_, i) => za + 2 * i);
  const pz = (i: number) => Math.min(zb - 0.125, Math.max(za + 0.125, points[i]));
  for (const gx of [xc - 2.5, xc + 2.5]) {
    for (const [z0, z1] of spans(za, zb, 13)) {
      S([gx - 0.2, 16, z0], [gx + 0.2, 16.4, z1]);
      S([gx - 0.2, 18.6, z0], [gx + 0.2, 19, z1]);
    }
    for (let i = 0; i < 14; i++) S([gx - 0.125, 16.4, pz(i) - 0.125], [gx + 0.125, 18.6, pz(i) + 0.125]);
    // One diagonal a panel, cut level at both ends so they lie flat on the chords, in two halves
    for (let i = 0; i < 13; i++) {
      const a = 0.11;
      const up = i % 2 === 0;
      const zl = pz(i) + 0.125 + a + 0.01;
      const zr = pz(i + 1) - 0.125 - a - 0.01;
      const [z0, z1] = up ? [zl, zr] : [zr, zl];
      const zAt = (y: number) => z0 + ((z1 - z0) * (y - 16.4)) / 2.2;
      for (const [y0, y1] of [
        [16.4, 17.5],
        [17.5, 18.6],
      ]) {
        const pts: V3[] = [];
        for (const x of [gx - 0.1, gx + 0.1]) for (const y of [y0, y1]) for (const dz of [-a, a]) pts.push([x, y, zAt(y) + dz]);
        d.addConvex({ material: 'steel', points: pts, tint: ochre });
      }
    }
  }
  // Cross ties between the girders every 4 m, at both chords
  for (let j = 0; j < 7; j++) {
    const z = Math.min(zb - 0.125, Math.max(za + 0.125, za + 4 * j + 1));
    for (const [y0, y1] of [
      [16.075, 16.325],
      [18.675, 18.925],
    ])
      for (const [x0, x1] of spans(xc - 2.3, xc + 2.3, 3)) S([x0, y0, z - 0.125], [x1, y1, z + 0.125]);
  }

  // A walkway hung on the west girder's outer face: grating, posts, a top rail
  const wx = xc - 2.7;
  for (const [z0, z1] of spans(za, zb, 13)) {
    S([wx - 0.9, 16.0, z0], [wx, 16.06, z1], 0x6a6c68);
  }
  for (let i = 0; i <= 13; i += 2) {
    const z = Math.min(zb - 0.04, Math.max(za + 0.04, za + 2 * i));
    S([wx - 0.9, 16.06, z - 0.04], [wx - 0.82, 17.1, z + 0.04]);
  }
  for (const [z0, z1] of split(za, zb, 2)) S([wx - 0.9, 17.1, z0], [wx - 0.82, 17.16, z1]);

  // A ladder up the north-west leg's west face
  const lx = legX[0] - 0.45;
  const lz = CRANE.rails[0];
  for (const dz of [-0.25, 0.25]) for (const [y0, y1] of spans(1.6, 15, 7)) S([lx - 0.2, y0, lz + dz - 0.03], [lx - 0.14, y1, lz + dz + 0.03], 0x9a9c98);
  for (let y = 2.0; y < 14.8; y += 0.5) S([lx - 0.14, y, lz - 0.25], [lx, y + 0.04, lz + 0.25], 0x9a9c98);

  // The trolley: a deck over both girders, a machinery house on it, the beacon on top
  const [tz0, tz1] = [-13.1, -8.1];
  for (const [x0, x1] of spans(xc - 2.7, xc + 2.7, 3)) for (const [z0, z1] of spans(tz0, tz1, 3)) S([x0, 19, z0], [x1, 19.3, z1], 0x7a7a72);
  for (const [x0, x1] of spans(xc - 1.8, xc + 1.8, 2)) for (const [z0, z1] of spans(tz0 + 0.5, tz1 - 0.5, 2)) S([x0, 19.3, z0], [x1, 21.1, z1], 0xb8b4a8);
  // Its door on the east face, a louvre strip with three slats on the west
  S([xc + 1.8, 19.3, -11.3], [xc + 1.84, 21.0, -10.5], 0x55595c);
  S([xc - 1.83, 20.3, tz0 + 1.1], [xc - 1.8, 20.8, tz1 - 1.1], 0x3a3c3e);
  for (const y of [20.36, 20.52, 20.68]) S([xc - 1.86, y, tz0 + 1.15], [xc - 1.83, y + 0.06, tz1 - 1.15], 0x8a8c88);
  S([xc - 0.12, 21.1, -10.72], [xc + 0.12, 21.34, -10.48], 0xffffff, 'beacon');

  // The cab, hung under the trolley between the girders
  // Beside the ropes, not round them
  const [cx0, cx1, cz0, cz1] = [xc - 2.1, xc - 0.6, tz0 + 0.1, tz0 + 2.1];
  S([cx0, 13.3, cz0], [cx1, 13.4, cz1], 0x6a6c68);
  for (const [x0, z0] of [
    [cx0, cz0],
    [cx1 - 0.08, cz0],
    [cx0, cz1 - 0.08],
    [cx1 - 0.08, cz1 - 0.08],
  ])
    S([x0, 13.4, z0], [x0 + 0.08, 15.7, z0 + 0.08]);
  S([cx0, 15.7, cz0], [cx1, 15.8, cz1]);
  // Back wall (south), glass on the other three sides, a seat
  S([cx0 + 0.08, 13.4, cz1 - 0.06], [cx1 - 0.08, 15.7, cz1], ochre);
  S([cx0 + 0.08, 14.2, cz0], [cx1 - 0.08, 15.7, cz0 + 0.03], 0xffffff, 'glass');
  S([cx0 + 0.08, 13.4, cz0], [cx1 - 0.08, 14.2, cz0 + 0.06], ochre);
  for (const x0 of [cx0, cx1 - 0.03]) S([x0, 14.2, cz0 + 0.08], [x0 + 0.03, 15.7, cz1 - 0.08], 0xffffff, 'glass');
  S([cx0 + 0.45, 13.4, cz0 + 0.9], [cx1 - 0.45, 13.9, cz0 + 1.5], 0x2a2a2a);
  for (const x of [cx0 + 0.25, cx1 - 0.25]) for (const [y0, y1] of spans(15.8, 19, 2)) S([x - 0.05, y0, cz0 + 0.95], [x + 0.05, y1, cz0 + 1.05], 0x5a5a56);

  // Floodlights under the girders' ends
  for (const gx of [xc - 2.5, xc + 2.5]) for (const z of [za + 0.5, zb - 0.5]) S([gx - 0.25, 15.85, z - 0.2], [gx + 0.25, 16, z + 0.2], 0xffffff, 'lamp');

  // The hoist: four ropes from the deck's underside to a headblock on a spreader
  const hz = -10.58;
  for (const x of [xc - 0.4, xc + 0.4]) for (const z of [hz - 1, hz + 1]) for (const [y0, y1] of spans(10.2, 19, 5)) S([x - 0.025, y0, z - 0.025], [x + 0.025, y1, z + 0.025], 0xffffff, 'cable');
  S([xc - 0.7, 9.6, hz - 1.15], [xc + 0.7, 10.2, hz + 1.15], 0xc89a30);
  const [sx0, sx1] = [-20.9, -20.9 + FT40];
  for (const [x0, x1] of spans(sx0 + 0.4, sx1 - 0.4, 6)) S([x0, 9.2, hz - 0.3], [x1, 9.6, hz + 0.3], 0xc89a30);
  for (const x0 of [sx0, sx1 - 0.4]) S([x0, 9.2, hz - WIDTH / 2], [x0 + 0.4, 9.6, hz + WIDTH / 2], 0xc89a30);
  // The box, its post tops against the spreader's end beams
  container(d, { at: [(sx0 + sx1) / 2, 9.2 - STD, hz], turn: 0, length: FT40, height: STD, tint: hangingTint, rand: random(5) });
  return { hoist: [xc, 10, hz] };
}
