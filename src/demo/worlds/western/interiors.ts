// A little inside each building, so a rocket through a window finds something: the saloon's bar
// with its foot rail, bottles, mirror, tables and stools; the store's counter, its shelves stocked
// with tins, jars and crates, and sacks; the sheriff's desk, stove and cell; the barber's chairs;
// the hotel's desk. In each building's own frame (as fronts.ts builds it).

import type { Destruction } from '../../../lib/index.ts';
import { FLOOR, rowFrame } from './fronts.ts';
import { octo } from './works.ts';

export function interiors(d: Destruction): void {
  const y = FLOOR;
  {
    // The saloon: the bar along the west wall (a dark top, a kick board, panel strips, a brass foot
    // rail), the back bar and its bottles, a mirror, six tables and nine stools
    const f = rowFrame(d, -24, -12, 1, 101);
    f.beams('timber', 1.3, y, 3.6, 0.55, 1.05, 3.0, 1.6, { tint: 0x7a5a44 });
    f.beams('timber', 1.22, y + 1.05, 3.55, 0.7, 0.05, 3.1, 1.6, { tint: 0x3a2a20 });
    f.beams('timber', 1.85, y, 3.6, 0.03, 0.12, 3.0, 1.6, { tint: 0x4a3426 });
    for (let k = 0; k < 5; k++) f.box('timber', 1.85, y + 0.12, 3.6 + 0.1 + k * 0.68, 0.03, 0.88, 0.08, { tint: 0x5a4030 });
    f.beams('iron', 1.88, y + 0.16, 3.6, 0.05, 0.05, 3.0, 1.6, { tint: 0xd8b060 });
    f.beams('timber', 0.16, y, 3.7, 0.4, 0.9, 2.8, 1.5, { tint: 0x5a3e2e });
    f.beams('timber', 0.16, y + 1.45, 3.7, 0.3, 0.04, 2.8, 1.5, { tint: 0x5a3e2e });
    f.box('glass', 0.16, y + 1.6, 4.2, 0.03, 1.0, 1.8, { tint: 0xf4f8f8 });
    // Bright enough to read against the mirror
    const amber = 0xe8a848;
    const green = 0x78b860;
    for (let k = 0; k < 24; k++) {
      const top = k < 14;
      const z = 3.8 + ((k % (top ? 14 : 10)) * 2.6) / (top ? 14 : 10);
      d.addConvex({ material: 'glass', points: octo(0.04, 0.3, 0, 0, 0), position: f.at(top ? 0.36 : 0.3, top ? y + 0.9 : y + 1.49, z), rotation: f.q, tint: k % 3 ? amber : green, smooth: 1 });
    }
    for (const [x, z] of [
      [4.0, 3.0],
      [8.2, 2.8],
      [3.6, 6.4],
      [8.6, 6.2],
      [4.2, 9.6],
      [8.0, 10.0],
    ]) {
      for (const [dx, dz] of [
        [-0.37, -0.37],
        [0.32, -0.37],
        [-0.37, 0.32],
        [0.32, 0.32],
      ])
        f.box('timber', x + dx, y, z + dz, 0.05, 0.72, 0.05, { tint: 0x6a4a36 });
      f.box('timber', x - 0.45, y + 0.72, z - 0.45, 0.9, 0.04, 0.9, { tint: 0x7a5a44 });
    }
    // Stools: four at the bar, the rest by the tables
    for (const [x, z] of [
      [2.4, 3.95],
      [2.4, 4.75],
      [2.4, 5.55],
      [2.4, 6.35],
      [4.0, 3.95],
      [8.2, 3.75],
      [3.6, 7.35],
      [8.6, 5.25],
      [5.15, 9.6],
    ])
      f.hull('timber', octo(0.16, 0.66, x, y, z), { tint: 0x8a6a50, smooth: 1 });
  }
  {
    // The store: a counter across, shelves on the back wall, sacks and crates
    const f = rowFrame(d, -24, -12, -1, 102);
    const D = 12;
    f.beams('timber', 3.2, y, 6.5, 5.5, 0.95, 0.6, 1.9, { tint: 0x7a5a44 });
    f.beams('timber', 3.15, y + 0.95, 6.45, 5.6, 0.05, 0.7, 1.9, { tint: 0x5a4434 });
    const zb = D - 0.16 - 0.45;
    let shelf = 0;
    for (const x0 of [1.0, 6.2]) {
      for (const x of [x0, x0 + 1.7, x0 + 3.4]) f.box('timber', x, y, zb, 0.08, 2.4, 0.45, { tint: 0x6a5040 });
      for (const sy of [0.5, 1.2, 1.9])
        for (const k of [0, 1]) {
          const u = x0 + 0.08 + k * 1.7;
          f.box('timber', u, y + sy, zb, 1.62, 0.04, 0.45, { tint: 0x8a6a50 });
          goods(u, y + sy + 0.04, shelf++);
        }
    }
    // What's on a shelf board (1.62 long, from u along x, its top at `top`): tins in rows, jars,
    // small crates, sacks on the lowest boards
    function goods(u: number, top: number, i: number): void {
      const zc = zb + 0.225;
      const tins = [0xa84a3a, 0x5a7a5a, 0x4a5a7a, 0xc8b48a];
      const tin = (x: number, z: number, c: number) => f.hull('paint', octo(0.055, 0.13, x, top, z), { tint: tins[c % tins.length], smooth: 1 });
      const box = (x: number, w: number, h: number) => f.box('timber', x, top, zc - 0.15, w, h, 0.3, { tint: 0xd8c8a8 });
      switch (i % 4) {
        case 0:
          for (let k = 0; k < 3; k++) tin(u + 0.12 + k * 0.13, zc - 0.07, i + k);
          tin(u + 0.18, zc + 0.08, i + 1);
          box(u + 0.85, 0.32, 0.24);
          break;
        case 1:
          for (let k = 0; k < 2; k++) f.hull('glass', octo(0.05, 0.17, u + 0.15 + k * 0.14, top, zc), { tint: k % 2 ? 0xc89a50 : 0xa8b890, smooth: 1 });
          if (top < 1) d.addBox({ material: 'hay', size: [0.34, 0.3, 0.28], position: f.at(u + 1.1, top + 0.15, zc), rotation: f.q, tint: 0xd8c8a8 });
          else box(u + 0.95, 0.4, 0.2);
          break;
        case 2:
          box(u + 0.1, 0.3, 0.26);
          for (let k = 0; k < 3; k++) tin(u + 0.6 + k * 0.13, zc, i + k);
          break;
        default:
          box(u + 0.2, 0.36, 0.22);
          box(u + 0.9, 0.3, 0.3);
      }
    }
    for (const [x, z] of [
      [1.2, 3.0],
      [1.7, 3.1],
      [1.45, 3.65],
      [10.2, 4.0],
      [10.7, 4.2],
    ])
      d.addBox({ material: 'hay', size: [0.42, 0.6, 0.32], position: f.at(x, y + 0.3, z), rotation: f.q, tint: 0xd8c8a8 });
    for (const [x, z, s] of [
      [9.6, 8.6, 0.7],
      [10.4, 8.7, 0.6],
      [9.7, 9.5, 0.6],
    ])
      d.addBox({ material: 'siding', size: [s, s, s], position: f.at(x, y + s / 2, z), rotation: f.q, tint: 0xe8d8c0 });
  }
  {
    // The sheriff's: a desk, a stove and its pipe, the cell's bars across the back corner
    const f = rowFrame(d, -10, -1, -1, 103);
    f.box('timber', 5.6, y, 3.0, 0.5, 0.75, 0.7, { tint: 0x6a4a36 });
    f.box('timber', 7.0, y, 3.0, 0.5, 0.75, 0.7, { tint: 0x6a4a36 });
    f.box('timber', 5.5, y + 0.75, 2.95, 2.1, 0.05, 0.8, { tint: 0x5a3e2e });
    f.box('iron', 2.2, y, 2.4, 0.5, 0.7, 0.5, { tint: 0x2a2a2a });
    for (let k = 0; k < 4; k++) f.hull('iron', octo(0.07, 0.7, 2.45, y + 0.7 + k * 0.7, 2.65), { tint: 0x2a2a2a, smooth: 1 });
    const cz = 6.8;
    const bars = 18;
    for (let k = 0; k <= bars; k++) {
      const x = 0.2 + (k * 2.8) / bars;
      if (k >= 12 && k <= 15) continue;
      f.box('iron', x, y, cz, 0.03, 2.3, 0.03, { tint: 0x3a3a3a });
    }
    f.beams('iron', 0.16, y + 2.3, cz - 0.01, 2.88, 0.05, 0.05, 1.5, { tint: 0x3a3a3a });
    f.box('timber', 0.3, y, cz + 1.0, 1.8, 0.45, 0.7, { tint: 0x7a6a58 });
  }
  {
    // The barber's: two chairs
    const f = rowFrame(d, -10.5, -4.5, 1, 104);
    for (const x of [1.2, 3.6]) {
      f.box('timber', x, y, 3.5, 0.6, 0.5, 0.6, { tint: 0x5a3e2e });
      f.box('timber', x, y + 0.5, 4.0, 0.6, 0.7, 0.1, { tint: 0x7a3a2e });
    }
  }
  {
    // The hotel: the desk inside the door
    const f = rowFrame(d, 10, 20, 1, 105);
    f.beams('timber', 5.6, y, 3.0, 2.6, 1.05, 0.6, 1.9, { tint: 0x5a3e2e });
    f.beams('timber', 5.55, y + 1.05, 2.95, 2.7, 0.05, 0.7, 1.9, { tint: 0x4a3426 });
  }
}
