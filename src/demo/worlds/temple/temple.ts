// The temple: Doric, peripteral, 6 × 11 columns, facing east. A stepped crepidoma (the lower two
// steps and the stylobate static), columns of eight drums with their capitals, the entablature
// (architrave of two beams, triglyph frieze with its backers, the geison), the coffered walk
// between the colonnade and the cella, the cella of limestone in courses with marble antae, porches
// with two columns in antis, a bronze door (one leaf open), and the timber and terracotta roof
// with a pediment at each end.

import type { Piece, V3 } from '../../../lib/index.ts';
import { band, courses, frieze, platform, type Rect, wall } from './doric.ts';
import { column, type Kit, leafPanels, yawQ } from './kit.ts';
import { PLACES } from './layout.ts';
import { gableRoof } from './roof.ts';

const AX = 2.2;
/** Heights (m above the ground). */
const TEMPLE_Y = { step1: 0.35, step2: 0.7, stylobate: 1.05, capital: 6.39, architrave: 7.24, frieze: 7.94, geison: 8.29, plate: 8.59 };

export function buildTemple(k: Kit): void {
  const { x: ox, z: oz } = PLACES.temple;
  const Y = TEMPLE_Y;
  const X = (x: number) => ox + x;
  const Z = (z: number) => oz + z;

  // Crepidoma: two steps and the stylobate, its slabs jointed halfway between the column axes
  platform(k, 'marble', X(-12.7), X(12.7), Z(-7.2), Z(7.2), 0, Y.step1, { width: 0.9 });
  platform(k, 'marble', X(-12.25), X(12.25), Z(-6.75), Z(6.75), Y.step1, Y.step2, { width: 0.9 });
  const half = (n: number) => Array.from({ length: n }, (_, i) => i);
  platform(k, 'marble', X(-11.8), X(11.8), Z(-6.3), Z(6.3), Y.step2, Y.stylobate, {
    xs: half(10).map((i) => X(-9.9 + AX * i)),
    zs: [-4.4, -2.2, 0, 2.2, 4.4].map(Z),
  });

  // The peristyle: 6 × 11 columns of 8 drums
  const r: Rect = { x0: X(-11), x1: X(11), z0: Z(-5.5), z1: Z(5.5) };
  const xs = half(11).map((i) => X(-11 + AX * i));
  const zs = half(6).map((j) => Z(-5.5 + AX * j));
  const drums = Array(8).fill(0.6);
  for (const x of xs)
    for (const z of zs) {
      if (x !== xs[0] && x !== xs[10] && z !== zs[0] && z !== zs[5]) continue;
      column(k, { material: 'marble', at: [x, Y.stylobate, z], drums, r0: 0.5, r1: 0.4, sides: 20, echinus: { h: 0.32, r: 0.62 }, abacus: { w: 1.3, h: 0.22 } });
    }

  // Architrave: two beams side by side, joined over the axes
  const cuts = { long: xs, short: zs };
  k.levers.addAll(band(k, r, 'marble', 0, 0.5, Y.capital, Y.architrave, cuts));
  k.levers.addAll(band(k, r, 'marble', -0.5, 0, Y.capital, Y.architrave, cuts));
  // Bronze shields on the east front, over each column
  for (const z of zs) k.hull('bronze', disc(r.x1 + 0.5, Y.capital + 0.425, z, 0.36, 0.08, 16));
  // Frieze: triglyphs and metopes in front, backers behind (joined over the inner axes)
  k.levers.addAll(frieze(k, r, { v0: 0.1, v1: 0.5, recess: 0.05, y0: Y.architrave, y1: Y.frieze, tw: 0.44, pitch: AX / 2, material: 'marble', glyph: 'triglyph', triglyph: 0xc9d0d4 }));
  k.levers.addAll(band(k, r, 'marble', -0.3, 0.1, Y.architrave, Y.frieze, { long: xs.slice(1, -1), short: zs.slice(1, -1) }));
  // Geison: blocks every 1.1, overhanging 0.45
  const every = (a: number, b: number) => {
    const c: number[] = [];
    for (let v = a; v <= b + 1e-6; v += AX / 2) c.push(v);
    return c;
  };
  k.levers.addAll(band(k, r, 'marble', -0.5, 0.95, Y.frieze, Y.geison, { long: every(r.x0, r.x1), short: every(r.z0, r.z1) }));

  // The cella: limestone in courses (orthostates, eight courses, a marble crown), long walls running
  // on as antae with marble capitals, cross walls at the porches (the east one with the door)
  const cella = courses(Y.stylobate, [0.95, ...Array(8).fill(0.549)]);
  const crown: [number, number] = [cella[cella.length - 1][1], Y.architrave];
  const anta = 7.6;
  for (const side of [-1, 1]) {
    const [t0, t1] = side < 0 ? [Z(-3.5), Z(-2.8)] : [Z(2.8), Z(3.5)];
    wall(k, { material: 'limestone', axis: 'x', from: X(-8.6), to: X(8.6), t0, t1, courses: cella.slice(0, 1), block: 1.72, bond: false });
    wall(k, {
      material: 'limestone',
      axis: 'x',
      from: X(-8.6),
      to: X(8.6),
      t0,
      t1,
      courses: cella.slice(1),
      block: 0.9,
      cuts: [X(-anta), X(anta)],
      pick: (a, b, i) => (i === 7 && (b <= X(-anta) + 1e-6 || a >= X(anta) - 1e-6) ? 'marble' : 'limestone'),
    });
    // The crown course (between the antae: the porches' architraves take over beyond)
    wall(k, { material: 'marble', axis: 'x', from: X(-anta), to: X(anta), t0, t1, courses: [crown], block: 1.8 });
    // Attic: thinner, leaving a ledge outside for the ceiling beams
    const [a0, a1] = side < 0 ? [Z(-3.2), Z(-2.8)] : [Z(2.8), Z(3.2)];
    wall(k, { material: 'limestone', axis: 'x', from: X(-8.6), to: X(8.6), t0: a0, t1: a1, courses: courses(Y.architrave, [0.525, 0.525]), block: 0.9 });
  }
  // Cross walls; the east one with the door's opening
  const door = { a: Z(-1.3), b: Z(1.3), y0: Y.stylobate, y1: cella[6][1] };
  for (const [x0, x1, holes] of [
    [X(5.1), X(5.8), [door]],
    [X(-5.8), X(-5.1), []],
  ] as const) {
    wall(k, { material: 'limestone', axis: 'z', from: Z(-2.8), to: Z(2.8), t0: x0, t1: x1, courses: [...cella, crown], block: 0.9, holes: [...holes] });
  }
  // The door frame (marble) and its bronze leaves: the south one shut, the north one open inward
  const jambTop = cella[5][1];
  for (const [za, zb] of [
    [Z(-1.3), Z(-1.0)],
    [Z(1.0), Z(1.3)],
  ]) {
    k.box('marble', [X(5.1), Y.stylobate, za], [X(5.8), 2.9, zb]);
    k.box('marble', [X(5.1), 2.9, za], [X(5.8), jambTop, zb]);
  }
  k.levers.add(k.box('marble', [X(5.1), jambTop, Z(-1.3)], [X(5.8), cella[6][1], Z(1.3)]));
  for (const [y0, y1] of [
    [Y.stylobate, 2.9],
    [2.9, jambTop],
  ]) {
    if (k.box('bronze', [X(5.39), y0, Z(0)], [X(5.51), y1, Z(1.0)])) leafPanels(k, 'bronze', [X(5.51), (y0 + y1) / 2, Z(0.5)], 1.0, y1 - y0, Math.PI / 2);
  }
  const open = 1.309; // 75°
  const hinge = [X(5.45), Z(-0.94)];
  const dir = [-Math.sin(open), Math.cos(open)];
  const leaf: Piece[] = [];
  for (const [y0, y1] of [
    [Y.stylobate + 0.01, 2.9],
    [2.9, jambTop - 0.01],
  ]) {
    const yaw = Math.atan2(-dir[1], dir[0]);
    const p = k.tbox('bronze', [hinge[0] + dir[0] * 0.5, (y0 + y1) / 2, hinge[1] + dir[1] * 0.5], [1.0, y1 - y0, 0.12], yawQ(yaw), { bond: false });
    if (p) leaf.push(p);
    // Its frames on the face toward the doorway (the other is against the jamb at the hinge)
    const out: V3 = [-Math.sin(yaw), 0, -Math.cos(yaw)];
    if (p) leafPanels(k, 'bronze', [hinge[0] + dir[0] * 0.5 + out[0] * 0.06, (y0 + y1) / 2, hinge[1] + dir[1] * 0.5 + out[2] * 0.06], 1.0, y1 - y0, yaw + Math.PI);
  }
  // Hung on its hinge (the jamb) by hand: it only touches it at an edge. The jamb found by a ray
  // along the wall's outer part, clear of the leaf
  const jamb = k.d.raycast([X(5.7), 2.0, Z(-0.5)], [0, 0, -1], 2);
  const jambHigh = k.d.raycast([X(5.7), 4.0, Z(-0.5)], [0, 0, -1], 2);
  if (leaf.length === 2) {
    k.d.bond(leaf[0], leaf[1], 0.12);
    if (jamb) k.d.bond(leaf[0], jamb.piece, 0.04);
    if (jambHigh) k.d.bond(leaf[1], jambHigh.piece, 0.04);
  }

  // The porches: two columns in antis at each end, their architrave from anta to anta
  for (const end of [-1, 1]) {
    const xc = X(end * 8.1);
    for (const z of [Z(-1.15), Z(1.15)]) column(k, { material: 'marble', at: [xc, Y.stylobate, z], drums, r0: 0.45, r1: 0.37, sides: 20, echinus: { h: 0.32, r: 0.55 }, abacus: { w: 1.1, h: 0.22 } });
    for (const [a, b] of [
      [xc - 0.5, xc],
      [xc, xc + 0.5],
    ])
      for (const [za, zb] of [
        [Z(-3.5), Z(-1.15)],
        [Z(-1.15), Z(1.15)],
        [Z(1.15), Z(3.5)],
      ])
        k.levers.add(k.box('marble', [a, Y.capital, za], [b, Y.architrave, zb]));
    // The attic across the porch, on the inner half of the architrave
    const [a0, a1] = end > 0 ? [X(7.6), X(8.0)] : [X(-8.0), X(-7.6)];
    wall(k, { material: 'limestone', axis: 'z', from: Z(-2.8), to: Z(2.8), t0: a0, t1: a1, courses: courses(Y.architrave, [0.525, 0.525]), block: 0.9 });
  }

  // The ceiling of the walk round the cella: beams from the architrave's inner strip to the
  // cella's ledge, and lids between them
  const beam = { y0: Y.architrave, y1: Y.architrave + 0.45, lid: 0.12 };
  for (const side of [-1, 1]) {
    const [za, zb] = side < 0 ? [Z(-5.2), Z(-3.2)] : [Z(3.2), Z(5.2)];
    const bx = half(16).map((i) => X(-8.25 + 1.1 * i));
    for (const x of bx) k.levers.add(k.box('marble', [x - 0.15, beam.y0, za], [x + 0.15, beam.y1, zb]));
    for (let i = 0; i + 1 < bx.length; i++) k.levers.add(k.box('marble', [bx[i], beam.y1, za], [bx[i + 1], beam.y1 + beam.lid, zb]));
  }
  for (const end of [-1, 1]) {
    const [xa, xb] = end > 0 ? [X(8.0), X(10.7)] : [X(-10.7), X(-8.0)];
    // Between the long walls' attics only (their corners stay open to the timbers)
    const bz = half(5).map((j) => Z(-2.2 + 1.1 * j));
    for (const z of bz) k.levers.add(k.box('marble', [xa, beam.y0, z - 0.15], [xb, beam.y1, z + 0.15]));
    for (let j = 0; j + 1 < bz.length; j++) k.levers.add(k.box('marble', [xa, beam.y1, bz[j]], [xb, beam.y1 + beam.lid, bz[j + 1]]));
  }

  // Inside the naos: two rows of slender columns carrying a light epistyle, the cult statue's
  // empty base between them, and an offering table
  const inner = { drums: Array(6).fill(0.75), r0: 0.27, r1: 0.22 };
  for (const zc of [Z(-1.6), Z(1.6)]) {
    const xsIn = [-3.6, -1.2, 1.2, 3.6].map(X);
    for (const x of xsIn) column(k, { material: 'marble', at: [x, Y.stylobate, zc], drums: inner.drums, r0: inner.r0, r1: inner.r1, sides: 20, echinus: { h: 0.2, r: 0.34 }, abacus: { w: 0.72, h: 0.15 } });
    const yTop = Y.stylobate + 4.5 + 0.2 + 0.15;
    const ends = [X(-4.0), ...xsIn.slice(1, -1), X(4.0)];
    for (let i = 0; i + 1 < ends.length; i++) k.levers.add(k.box('marble', [ends[i], yTop, zc - 0.22], [ends[i + 1], yTop + 0.42, zc + 0.22]));
  }
  // The cult statue's empty base and an offering table
  k.box('marble', [X(-4.7), Y.stylobate, Z(-1.1)], [X(-3.3), Y.stylobate + 0.3, Z(1.1)]);
  k.box('marble', [X(-4.6), Y.stylobate + 0.3, Z(-1.0)], [X(-3.4), Y.stylobate + 1.2, Z(0)]);
  k.box('marble', [X(-4.6), Y.stylobate + 0.3, Z(0)], [X(-3.4), Y.stylobate + 1.2, Z(1.0)]);
  for (const z of [Z(-0.45), Z(0.45)]) k.box('marble', [X(1.8), Y.stylobate, z - 0.1], [X(2.0), Y.stylobate + 0.8, z + 0.1]);
  k.box('marble', [X(1.6), Y.stylobate + 0.8, Z(-0.7)], [X(2.2), Y.stylobate + 0.9, Z(0.7)]);

  // The roof
  gableRoof(k, {
    x0: X(-12.1),
    x1: X(12.1),
    zc: Z(0),
    rows: 9,
    plateTop: Y.plate,
    plateIn: 5.3,
    plateOut: 5.9,
    plateCuts: xs,
    rafters: half(19).map((i) => X(-9.9 + 1.1 * i)),
    ties: half(9).map((i) => X(-8.8 + AX * i)),
    tieParts: 6,
    geisonTop: Y.geison,
    sima: [X(-10.9), X(10.9)],
    pediments: [
      { tympanum: [X(10.9), X(11.45)], cornice: [X(10.9), X(12.15)], end: 1 },
      { tympanum: [X(-11.45), X(-10.9)], cornice: [X(-12.15), X(-10.9)], end: -1 },
    ],
    courses: [9.25],
    acroterion: 1.0,
  });
}

/** A disc facing +x (a shield on a wall): radius r, t thick, its back at x. */
function disc(x: number, y: number, z: number, r: number, t: number, sides: number): V3[] {
  // Its face a little smaller than its back: a bevelled rim that catches the light
  return Array.from({ length: sides }, (_, i) => {
    const a = (i / sides) * Math.PI * 2;
    return [0, t].map((dx) => {
      const rr = dx ? r * 0.82 : r;
      return [x + dx, y + Math.sin(a) * rr, z + Math.cos(a) * rr] as V3;
    });
  }).flat();
}
