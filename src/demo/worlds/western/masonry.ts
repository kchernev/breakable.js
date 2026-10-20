// The town's two masonry buildings: the brick bank (stone plinth, running-bond walls, barred
// windows, a parapet hiding its roof, a safe inside) and the adobe chapel at the end of the street
// (thick mud-brick walls, vigas through them, buttresses, and a bell gable with the bell hung in
// its arch).

import type { Destruction, Hinge, V3 } from '../../../lib/index.ts';
import { arch, cylinder, frustum, quatFromAxisAngle } from '../../../lib/index.ts';
import { Frame, wall } from './frame.ts';
import { FACADE, FLOOR, walkway } from './fronts.ts';
import { signFrame, SIGNS, signRow } from './signs.ts';

/** The bank (N3): x -2..8, its front on the north row. Returns the frame and where the safe goes. */
export function bank(d: Destruction): { safe: V3 } {
  const x0 = -2;
  const x1 = 8;
  const f = new Frame(d, [x0 + 0.03, 0, FACADE], 0, 21);
  const W = x1 - x0 - 0.06;
  const D = 10;
  const t = 0.4;
  const C = 0.6;
  const base = FLOOR;
  const top = 5.2;
  const brick = (c: number, i: number) => ((c * 3 + i) % 4 === 0 ? 0xe2c4ae : (c + i) % 5 === 0 ? 0xf2dcc8 : undefined);

  // Plinth of sandstone under the walls, level with the boardwalks
  f.beams('stone', -0.05, 0, -0.05, W + 0.1, base, t + 0.1, 1.5);
  f.beams('stone', -0.05, 0, D - t - 0.05, W + 0.1, base, t + 0.1, 1.5);
  f.beams('stone', -0.05, 0, t + 0.05, t + 0.1, base, D - 2 * t - 0.1, 1.5);
  f.beams('stone', W - t - 0.05, 0, t + 0.05, t + 0.1, base, D - 2 * t - 0.1, 1.5);
  // Floor: sleepers and planks inside the plinth
  const fx = [t + 0.05, W / 3, (2 * W) / 3, W - t - 0.05];
  for (const x of fx.slice(1, -1)) f.beams('timber', x - 0.1, 0, t + 0.05, 0.2, 0.3, D - 2 * t - 0.1);
  for (let i = 0; i + 1 < fx.length; i++)
    for (let j = 0; j < 5; j++) {
      const z0 = t + 0.05 + (j * (D - 2 * t - 0.1)) / 5;
      f.box('timber', fx[i], 0.3, z0, fx[i + 1] - fx[i], 0.1, (D - 2 * t - 0.1) / 5, { tint: 0x9a8a78 });
    }

  // Front: a door in the middle with a fanlight, a barred window each side; stone lintels in one course
  const door = { a: W / 2 - 0.7, b: W / 2 + 0.7 };
  const wins = [
    { a: 1.6, b: 2.9 },
    { a: W - 2.9, b: W - 1.6 },
  ];
  const lintelY = base + 5 * C;
  wall(f, {
    material: 'brick',
    axis: 'x',
    at: 0,
    t,
    from: 0,
    to: W,
    y0: base,
    course: C,
    top,
    block: 1.6,
    stagger: true,
    tint: brick,
    holes: [door, ...wins].flatMap((o) => [
      { ...o, y0: base, y1: lintelY },
      { a: o.a - 0.2, b: o.b + 0.2, y0: lintelY, y1: lintelY + C },
    ]),
  });
  for (const o of [door, ...wins]) f.box('stone', o.a - 0.2, lintelY, -0.04, o.b - o.a + 0.4, C, t + 0.04);
  // The fanlight over the door, and the door's two dark green leaves
  f.box('timber', door.a, base + 4 * C - 0.1, 0.1, door.b - door.a, 0.1, 0.2, { tint: 0x4a5a48 });
  f.box('glass', door.a, base + 4 * C, 0.18, door.b - door.a, C, 0.03);
  for (const k of [0, 1]) f.box('timber', door.a + k * 0.7, base, 0.12, 0.7, 4 * C - 0.1, 0.08, { tint: 0x4a5a48 });
  // Windows: brick under the sill, a projecting stone sill, a frame, panes, iron bars
  for (const w of wins) {
    f.box('brick', w.a, base, 0, w.b - w.a, C - 0.12, t, { tint: 0xe2c4ae });
    const sill = base + C;
    f.box('stone', w.a, sill - 0.12, -0.08, w.b - w.a, 0.12, t + 0.08);
    const h = lintelY - sill;
    const fw = 0.07;
    const z = 0.2;
    f.box('timber', w.a, sill, z, fw, h, 0.1, { tint: 0x4a5a48 });
    f.box('timber', w.b - fw, sill, z, fw, h, 0.1, { tint: 0x4a5a48 });
    f.box('timber', w.a + fw, sill, z, w.b - w.a - 2 * fw, fw, 0.1, { tint: 0x4a5a48 });
    f.box('timber', w.a + fw, lintelY - fw, z, w.b - w.a - 2 * fw, fw, 0.1, { tint: 0x4a5a48 });
    f.box('timber', w.a + fw, sill + h / 2 - fw / 2, z, w.b - w.a - 2 * fw, fw, 0.1, { tint: 0x4a5a48 });
    const pw = (w.b - w.a - 3 * fw) / 2;
    for (const yy of [sill + fw, sill + h / 2 + fw / 2]) {
      f.box('timber', w.a + fw + pw, yy, z, fw, h / 2 - 1.5 * fw, 0.1, { tint: 0x4a5a48 });
      for (const k of [0, 1]) f.box('glass', w.a + fw + k * (pw + fw), yy, z + 0.035, pw, h / 2 - 1.5 * fw, 0.03);
    }
    // Five bars in two lengths each, standing on the sill and touching the lintel; two flat bars across their faces
    const bz = 0.08;
    for (let k = 1; k <= 5; k++) {
      const u = w.a + ((w.b - w.a) * k) / 6 - 0.0175;
      for (const half of [0, 1]) f.box('iron', u, sill + (half * h) / 2, bz, 0.035, h / 2, 0.035, { tint: 0x3a3a3a });
    }
    for (const yy of [sill + h * 0.3, sill + h * 0.72]) f.box('iron', w.a + 0.05, yy, bz - 0.012, w.b - w.a - 0.1, 0.04, 0.012, { tint: 0x3a3a3a });
  }
  // Pilasters at the front corners, a shade darker
  for (const x of [0, W - 0.6]) for (let c = 0; c < 8; c++) f.box('brick', x, base + c * C, -0.08, 0.6, C, 0.08, { tint: 0xd8b8a0 });

  // Sides and back
  for (const x of [0, W - t]) wall(f, { material: 'brick', axis: 'z', at: x, t, from: t, to: D, y0: base, course: C, top, block: 1.6, stagger: true, tint: brick });
  // A small barred window at the back, a stone lintel over it
  wall(f, { material: 'brick', axis: 'x', at: D - t, t, from: t, to: W - t, y0: base, course: C, top, block: 1.6, stagger: true, tint: brick, holes: [{ a: W / 2 - 0.6, b: W / 2 + 0.6, y0: base + 2 * C, y1: base + 5 * C }] });
  f.box('stone', W / 2 - 0.6, base + 4 * C, D - t, 1.2, C, t);
  for (let k = 1; k < 6; k++) f.box('iron', W / 2 - 0.6 + (1.2 * k) / 6 - 0.0175, base + 2 * C, D - t / 2, 0.035, 2 * C, 0.035, { tint: 0x3a3a3a });

  // The roof, hidden: joists across between the side walls, deck panels on them
  const ry = top - 0.4;
  for (let j = 0; j < 5; j++) {
    const z = t + 0.4 + (j * (D - 2 * t - 0.8)) / 4;
    f.beams('timber', t, ry - 0.2, z - 0.08, W - 2 * t, 0.2, 0.16, 1.85);
  }
  for (let i = 0; i < 5; i++)
    for (let j = 0; j < 5; j++) f.box('timber', t + (i * (W - 2 * t)) / 5, ry, t + (j * (D - 2 * t)) / 5, (W - 2 * t) / 5, 0.1, (D - 2 * t) / 5, { tint: 0x8a7a68 });
  // Cornice band, brick parapet, stone coping
  f.beams('stone', -0.2, top, -0.2, W + 0.4, 0.25, t + 0.2, 1.7);
  for (const x of [-0.2, W - t]) f.beams('stone', x, top, t, t + 0.2, 0.25, D - t, 1.7);
  f.beams('stone', t, top, D - t, W - 2 * t, 0.25, t, 1.7);
  const py = top + 0.25;
  wall(f, { material: 'brick', axis: 'x', at: 0, t, from: 0, to: W, y0: py, course: 0.6, top: py + 0.6, block: 1.6, stagger: false, tint: brick });
  wall(f, { material: 'brick', axis: 'x', at: D - t, t, from: t, to: W - t, y0: py, course: 0.6, top: py + 0.6, block: 1.6 });
  for (const x of [0, W - t]) wall(f, { material: 'brick', axis: 'z', at: x, t, from: t, to: D, y0: py, course: 0.6, top: py + 0.6, block: 1.6 });
  f.beams('stone', -0.05, py + 0.6, -0.05, W + 0.1, 0.15, t + 0.1, 1.7);
  f.beams('stone', -0.05, py + 0.6, D - t - 0.05, W + 0.1, 0.15, t + 0.1, 1.7);
  for (const x of [-0.05, W - t - 0.05]) f.beams('stone', x, py + 0.6, t + 0.05, t + 0.1, 0.15, D - 2 * t - 0.1, 1.7);

  // Its signboard on the brick between the lintels and the cornice
  const sign = SIGNS[signRow('coins')];
  const L = sign.length;
  const sy = lintelY + C + 0.12;
  const tex = signFrame(f, 'coins', (W + L) / 2, sy, -0.04);
  for (let i = 0; i < 4; i++) f.box('signpaint', (W - L) / 2 + (i * L) / 4, sy, -0.04, L / 4, 0.9, 0.04, { tex });

  // Inside: a teller counter with an iron grille, a partition behind
  const cz = 4.2;
  f.beams('timber', t + 0.3, FLOOR, cz, W - 2 * t - 0.6, 1.05, 0.5, 1.8, { tint: 0x7a5a44 });
  f.beams('timber', t + 0.25, FLOOR + 1.05, cz - 0.05, W - 2 * t - 0.5, 0.05, 0.6, 1.8, { tint: 0x5a4434 });
  const gx0 = t + 1.2;
  const gx1 = W - t - 1.2;
  for (let k = 0; k < 12; k++) f.box('iron', gx0 + (k * (gx1 - gx0)) / 11 - 0.01, FLOOR + 1.1, cz + 0.24, 0.02, 0.9, 0.02, { tint: 0x2e2e2e });
  f.beams('iron', gx0 - 0.02, FLOOR + 2.0, cz + 0.22, gx1 - gx0 + 0.06, 0.04, 0.06, 1.8, { tint: 0x2e2e2e });
  for (let i = 0; i < 4; i++) {
    const a = t + 0.05 + (i * (W - 2 * t - 0.1)) / 4;
    if (i === 1) continue;
    f.box('siding', a, FLOOR, 6.6, (W - 2 * t - 0.1) / 4, 2.6, 0.1, { tint: 0xd8cfc0 });
  }
  walkway(f, W, f.rand, undefined, 0.06);
  return { safe: f.at(W - 2.6, FLOOR, D - t - 0.33) };
}

/** The adobe chapel (C): x 24..34, z 2.5..10.5, its front and bell gable facing west down the street. */
export function chapel(d: Destruction): { bell: Hinge | null; top: V3 } {
  // Frame x runs from z 10.5 toward z 2.5, frame z from x 24 east
  const f = new Frame(d, [24, 0, 10.5], Math.PI / 2, 31);
  const W = 8;
  const D = 10;
  const t = 0.6;
  const C = 0.5;
  const eaves = 4.5;
  // Plastered: one colour, the faintest variation block to block
  const pale = (c: number, i: number) => ((c * 5 + i * 3) % 7 === 0 ? 0xfaf4ea : undefined);
  const adobe = { material: 'adobe', t, course: C, block: 1.4, stagger: true, tint: pale } as const;

  // Front (west) wall: the door, a small window over it; the parapet course above the eaves
  const door = { a: 3.2, b: 4.8 };
  wall(f, {
    ...adobe,
    axis: 'x',
    at: 0,
    from: 0,
    to: W,
    y0: 0,
    top: eaves + C,
    holes: [
      { ...door, y0: 0, y1: 2.5 },
      { a: door.a - 0.3, b: door.b + 0.3, y0: 2.5, y1: 3.0 },
      { a: 3.7, b: 4.3, y0: 3.0, y1: 3.5 },
    ],
  });
  // Door lintel (projecting) on its own course, leaves, the small window's pane
  f.beams('timber', door.a - 0.3, 2.5, -0.1, door.b - door.a + 0.6, 0.5, t + 0.1, 1.9, { tint: 0x8a7258 });
  for (const k of [0, 1]) f.box('timber', door.a + k * 0.8, 0, 0.25, 0.8, 2.5, 0.08, { tint: 0x6a5040 });
  f.box('glass', 3.7, 3.0, 0.28, 0.6, 0.5, 0.03);

  // The bell gable: shoulders, then the centre with the arched opening, a round cap
  const g0 = eaves + C;
  wall(f, { ...adobe, axis: 'x', at: 0, from: 1, to: 7, y0: g0, top: g0 + 0.5, holes: [{ a: 3.45, b: 4.55, y0: g0, y1: g0 + 0.5 }] });
  const s1 = g0 + 0.5;
  const spring = s1 + 0.4;
  wall(f, { ...adobe, axis: 'x', at: 0, from: 2.4, to: 5.6, y0: s1, course: 0.4, top: spring, holes: [{ a: 3.45, b: 4.55, y0: s1, y1: spring }] });
  // The arch: voussoirs, the fill over each, and pieces either side
  const r = 0.55;
  const ring = 0.35;
  const crown = spring + r + ring;
  for (const v of arch(2 * r, ring, t, 7)) {
    f.hull(
      'adobe',
      v.points.map(([x, y, z]) => [4 + x, spring + y, t / 2 + z] as V3),
      { tint: 0xfaf4ea },
    );
    // Fill from the voussoir's outer face up to the crown course
    const [a0, a1] = [v.a0, v.a1];
    const p0: [number, number] = [4 + Math.cos(a0) * (r + ring), spring + Math.sin(a0) * (r + ring)];
    const p1: [number, number] = [4 + Math.cos(a1) * (r + ring), spring + Math.sin(a1) * (r + ring)];
    const top = crown + 0.1;
    const outline: Array<[number, number]> = [p0, p1, [p1[0], top], [p0[0], top]];
    if (Math.abs(p1[0] - p0[0]) > 0.02) f.hull('adobe', outline.flatMap(([x, y]) => [[x, y, 0] as V3, [x, y, t] as V3]));
  }
  for (const [a, b] of [
    [2.4, 4 - r - ring],
    [4 + r + ring, 5.6],
  ])
    f.box('adobe', a, spring, 0, b - a, crown + 0.1 - spring, t);
  const c2 = crown + 0.1;
  f.box('adobe', 2.4, c2, 0, 1.6, 7.3 - c2, t);
  f.box('adobe', 4.0, c2, 0, 1.6, 7.3 - c2, t);
  // The round cap: a five-point arc in two halves
  const cap = (from: number, to: number) => {
    const pts: Array<[number, number]> = [];
    for (let k = 0; k <= 4; k++) {
      const x = from + ((to - from) * k) / 4;
      const u = (x - 4) / 1.6;
      pts.push([x, 7.3 + 0.3 * Math.sqrt(Math.max(0, 1 - u * u))]);
    }
    const outline: Array<[number, number]> = [[from, 7.3], [to, 7.3], ...pts.reverse()];
    f.hull('adobe', outline.flatMap(([x, y]) => [[x, y, 0] as V3, [x, y, t] as V3]), { tint: 0xfaf4ea });
  };
  cap(2.4, 4.0);
  cap(4.0, 5.6);
  // The yoke across the opening at the springing, the bell swinging under it on a hinge along it:
  // its waist, a lip ring round the mouth and a crown up to the hinge, one hull (the crown's slope
  // lets it swing 35 degrees each way clear of the yoke)
  const yoke = f.beam('timber', 3.45, spring - 0.15, 0.15, 1.1, 0.15, 0.3, { tint: 0x7a6650 });
  const top = spring - 0.15 - 0.12;
  const at = (pts: V3[], y: number) => pts.map(([x, py, z]) => [4 + x, y + py, t / 2 + z] as V3);
  const bellPts = [...at(frustum(0.3, 0.17, 0.48, 12), top - 0.48), ...at(cylinder(0.32, 0.05, 12), top - 0.53), [4, spring - 0.155, t / 2] as V3];
  const bronze = f.hull('bronze', bellPts, { loose: true, smooth: 0.6 });
  const bell = bronze && yoke ? d.hinge(bronze, f.at(4, spring - 0.155, t / 2), f.dir([1, 0, 0]), { to: yoke }) : null;

  // Buttresses at the two west corners: two steps
  for (const x of [0, W - 1.0]) {
    f.box('adobe', x, 0, -1.0, 1.0, 1.0, 1.0, { tint: 0xfaf4ea });
    f.box('adobe', x, 1.0, -1.0, 1.0, 1.0, 1.0, { tint: 0xfaf4ea });
    f.box('adobe', x + (x ? 0.3 : 0), 2.0, -0.7, 0.7, 1.0, 0.7);
    f.box('adobe', x + (x ? 0.3 : 0), 3.0, -0.7, 0.7, 0.8, 0.7);
  }

  // Side walls: three small deep windows each, timber lintels; the top course split round the vigas
  const vz = Array.from({ length: 6 }, (_, k) => 1.2 + k * 1.52);
  const vr = 0.13;
  const half = vr * Math.cos(Math.PI / 8);
  const vy = eaves - C;
  for (const x of [0, W - t]) {
    const wins = [2.4, 5.0, 7.6].map((z) => ({ a: z - 0.3, b: z + 0.3, y0: 2.0, y1: 3.0 }));
    wall(f, { ...adobe, axis: 'z', at: x, from: t, to: D, y0: 0, top: 3.0, holes: wins });
    for (const w of wins) {
      f.beam('timber', x, 3.0, w.a - 0.15, t, 0.2, 0.9, { tint: 0x8a7258 });
      f.box('glass', x + t / 2 - 0.015, 2.0, w.a, 0.03, 1.0, 0.6);
    }
    // Over the timber lintels, a little adobe to the course line
    for (const w of wins) f.box('adobe', x, 3.2, w.a - 0.15, t, 0.3, 0.9);
    wall(f, { ...adobe, axis: 'z', at: x, from: t, to: D, y0: 3.0, top: 3.5, holes: wins.map((w) => ({ a: w.a - 0.15, b: w.b + 0.15, y0: 3.0, y1: 3.5 })) });
    wall(f, { ...adobe, axis: 'z', at: x, from: t, to: D, y0: 3.5, top: vy });
    // The vigas' course: pieces between them, and a block over each
    wall(f, { ...adobe, axis: 'z', at: x, from: t, to: D, y0: vy, top: eaves, holes: vz.map((z) => ({ a: z - half, b: z + half, y0: vy, y1: eaves })) });
    for (const z of vz) f.box('adobe', x, vy + 2 * half, z - half, t, eaves - vy - 2 * half, 2 * half);
    // Parapet
    wall(f, { ...adobe, axis: 'z', at: x, from: t, to: D, y0: eaves, top: eaves + C });
  }
  wall(f, { ...adobe, axis: 'x', at: D - t, from: t, to: W - t, y0: 0, top: eaves + C });

  // Vigas: 8-sided, a flat down and a flat up, across the span and out through both walls
  const octagon = (z: number, x0: number, x1: number): V3[] => {
    const pts: V3[] = [];
    for (let k = 0; k < 8; k++) {
      const a = Math.PI / 8 + (k * Math.PI) / 4;
      for (const x of [x0, x1]) pts.push([x, vy + half + Math.sin(a) * vr, z + Math.cos(a) * vr]);
    }
    return pts;
  };
  const grain = quatFromAxisAngle([0, 0, 1], -Math.PI / 2);
  for (const z of vz) for (let k = 0; k < 5; k++) f.hull('timber', octagon(z, -0.5 + k * 1.8, -0.5 + (k + 1) * 1.8), { grain, grainAt: [0, vy, z], tint: 0x9a8670, smooth: 1 });
  // Latillas on the vigas, then adobe slabs
  const ly = vy + 2 * half;
  for (let i = 0; i < 4; i++)
    for (let j = 0; j < 5; j++) {
      const x0 = t + (i * (W - 2 * t)) / 4;
      const z0 = t + (j * (D - 2 * t)) / 5;
      f.box('timber', x0, ly, z0, (W - 2 * t) / 4, 0.08, (D - 2 * t) / 5, { tint: 0xb8a488 });
      f.box('adobe', x0, ly + 0.08, z0, (W - 2 * t) / 4, 0.15, (D - 2 * t) / 5, { tint: 0xe8d6bc });
    }

  // Pews: a bench, a back, two ends
  for (let k = 0; k < 8; k++) {
    const z = 1.6 + k * 0.85;
    for (const [x0, x1] of [
      [t + 0.3, 3.4],
      [4.6, W - t - 0.3],
    ]) {
      f.box('timber', x0, 0, z, 0.08, 0.45, 0.4, { tint: 0x7a6650 });
      f.box('timber', x1 - 0.08, 0, z, 0.08, 0.45, 0.4, { tint: 0x7a6650 });
      f.beam('timber', x0, 0.45, z, x1 - x0, 0.05, 0.4, { tint: 0x8a7258 });
      f.beam('timber', x0, 0.5, z + 0.34, x1 - x0, 0.5, 0.05, { tint: 0x7a6650 });
    }
  }
  f.box('timber', 3.0, 0, D - t - 1.2, 2.0, 0.9, 0.8, { tint: 0x6a5040 });
  return { bell, top: f.at(4, 7.6, t / 2) };
}
