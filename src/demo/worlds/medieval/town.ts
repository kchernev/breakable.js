// The buildings round the square: the west row (W1, the tavern W2, W3), E1 by the wall, the market
// hall on its oak posts, the stable; their hanging signs and lanterns.

import type { Hinge, Piece, V3 } from '../../../lib/index.ts';
import { Frame, type Kit, type P, type Pt, split, vary } from './kit.ts';
import { bayPosts, house, type House, plinth, PLINTH } from './houses.ts';
import { floor, frameWall, roof, T } from './timber.ts';

const deg = (d: number) => (d * Math.PI) / 180;

/** Oak tints (the map is grey-brown): silver-grey, mid brown, tarred. */
const OAK = { silver: 0xf0e8d6, brown: 0xba9679, tarred: 0x806a57 };
/** Lime washes on the near-white limewash map. */
const WASH = { white: 0xf3ead8, ochre: 0xe8cf98, pink: 0xe9c9b8, green: 0xd9dccb };
/** Roof tints: plain, weathered, redder, mossy. */
const ROOF = { plain: 0xffffff, weathered: 0xe8c8b8, red: 0xd8a890, mossy: 0xc8c0a0 };

/** A post's middle on a front of `n` bays. */
const postAt = (width: number, n: number, i: number) => {
  const [a, b] = bayPosts(width, n, true)[i];
  return (a + b) / 2;
};

/** A hanging sign: its board (first) and pictograms, its bracket and hinge, and the way across its board (it swings that way). */
export interface Sign {
  pieces: Piece[];
  bracket: Piece;
  across: V3;
  hinge: Hinge;
}

/** W1, W2, W3 and E1 with their signs and lanterns, and E1's pentice. Returns their chimney pots and signs. */
export function buildHouses(kit: Kit): { pots: P[]; signs: Sign[] } {
  // W1: three storeys and the attic, a rubble ground floor with an arched shop front, the gable to the square
  const w1 = house(kit, {
    name: 'W1',
    f: new Frame([-15, 0, -12.6], -Math.PI / 2),
    width: 7.4,
    depth: 8.5,
    jetty: 0.45,
    stone: {
      openings: [
        { u0: 1.2, u1: 3.4, sill: 0, spring: 1.16, arch: { ring: 0.35, count: 7 } },
        { u0: 5.0, u1: 6.0, sill: 0, spring: 1.74, arch: { ring: 0.3, count: 5 } },
      ],
    },
    storeys: [{ height: 2.9, front: '' }, { height: 2.6, front: 'BWPGPWb' }, { height: 2.4, front: 'BGGPGGb' }],
    sides: ['', 'PBWbP', 'PGPGP'],
    rich: [true, false],
    roof: 'gable',
    pitch: deg(54),
    oak: OAK.tarred,
    plaster: WASH.white,
    tile: ROOF.plain,
    chimney: 'back',
    verge: [0.25, 0],
  });
  const signs = [sign(kit, front(w1, 1), postAt(7.4, 7, 2), 0.02, 'key')];

  // W2, the tavern: two storeys, the eaves to the square, lanterns either side of its door
  const w2 = house(kit, {
    name: 'W2',
    f: new Frame([-15, 0, -4.75], -Math.PI / 2),
    width: 6.7,
    depth: 8.5,
    jetty: 0.45,
    storeys: [{ height: 2.9, front: 'BGGDGb' }, { height: 2.6, front: 'BWGGWb' }],
    roof: 'eaves',
    pitch: deg(48),
    oak: OAK.silver,
    plaster: WASH.ochre,
    tile: ROOF.weathered,
    verge: [0.05, 0.05],
  });
  const tavern = front(w2, 0);
  signs.push(sign(kit, tavern, postAt(6.7, 6, 1), 2.75, 'tankard'));
  for (const i of [3, 4]) lantern(kit, tavern, postAt(6.7, 6, i), 2.2);

  // W3: two storeys and the attic, gable to the square, its south side in the sun framed like a front
  const w3 = house(kit, {
    name: 'W3',
    f: new Frame([-15, 0, 2.4], -Math.PI / 2),
    width: 7.0,
    depth: 8.0,
    jetty: 0.45,
    storeys: [{ height: 2.9, front: 'BGDGPb' }, { height: 2.6, front: 'BGWWGb' }],
    sides: ['PGBbGP', 'BGWWGb'],
    rich: [false, true],
    roof: 'gable',
    pitch: deg(55),
    oak: OAK.brown,
    plaster: WASH.pink,
    tile: ROOF.red,
    chimney: 'back',
    verge: [0.25, 0],
  });
  signs.push(sign(kit, front(w3, 0), postAt(7.0, 6, 5), 2.75, 'boot'));

  // E1 by the wall: a rubble ground floor, two windows and a door, one jettied storey
  const e1 = house(kit, {
    name: 'E1',
    f: new Frame([15, 0, -7.6], Math.PI / 2),
    width: 7.4,
    depth: 7.3,
    jetty: 0.45,
    stone: {
      openings: [
        { u0: 1.0, u1: 1.8, sill: 1.16, spring: 2.32 },
        { u0: 3.3, u1: 4.3, sill: 0, spring: 2.32 },
        { u0: 5.6, u1: 6.4, sill: 1.16, spring: 2.32 },
      ],
    },
    storeys: [{ height: 2.9, front: '' }, { height: 2.6, front: 'BWGPGWb' }],
    roof: 'eaves',
    pitch: deg(50),
    oak: OAK.tarred,
    plaster: WASH.green,
    tile: ROOF.mossy,
    chimney: 'right',
    verge: [0.1, 0],
  });
  signs.push(sign(kit, front(e1, 1), postAt(7.4, 7, 3), 0.02, 'loaf'));
  pentice(kit, new Frame([15, 0, -7.6], Math.PI / 2), 7.4, 2.6);
  return { pots: [w1.pot, w3.pot, e1.pot], signs: signs.filter((s): s is Sign => !!s) };
}

/** The front frame of storey k of a house (for its signs and lanterns). */
function front(h: House, k: number): Frame {
  return h.frame.sub(0, h.bases[k], h.faces[k]);
}

/**
 * A pentice over a stone ground floor: a lean-to of tile on oak brackets along the front, just
 * under the jetty.
 */
function pentice(kit: Kit, f: Frame, width: number, top: number): void {
  const out = 0.75;
  const drop = 0.4;
  const angle = Math.atan2(drop, out);
  // Brackets: triangles against the wall, under the slab
  for (const u of split(0.3, width - 0.3, 2.3)) {
    const b = f.sub(u, 0, 0, -Math.PI / 2);
    kit.prism(b, 'oak', [[0, top - 0.75], [0, top - 0.05], [-out, top - 0.05 - drop]], -0.06, 0.12, { tint: vary(OAK.tarred, 0.05, kit.rand) });
  }
  // The slabs on the brackets' sloped tops
  const s = f.sub(0, 0, 0, -Math.PI / 2);
  for (const [a, b] of pairs(split(-0.1, width + 0.1, 1.3))) {
    const pts: Pt[] = [
      [0, top - 0.05],
      [-out - 0.1, top - 0.05 - drop - 0.1 * Math.tan(angle)],
      [-out - 0.1, top - 0.05 - drop - 0.1 * Math.tan(angle) + 0.06],
      [0, top + 0.01],
    ];
    kit.prism(s, 'tile', pts, -b, b - a, { tint: vary(ROOF.mossy, 0.04, kit.rand) });
  }
}

/**
 * A hanging sign on a front: an iron bracket out of the wall at (u, v), a board hung on rings 3 cm
 * under it, an iron pictogram on each side of the board. It swings on a hinge along the bracket
 * and falls with it (what hangs counts as moving only while it swings more than 10 cm, and the
 * loose cap leaves it).
 */
function sign(kit: Kit, f: Frame, u: number, v: number, picture: 'key' | 'tankard' | 'boot' | 'loaf'): Sign | null {
  const bracket = kit.box(f, 'iron', u - 0.025, v, -0.95, 0.05, 0.05, 0.95);
  const ring = 0.03;
  const board = f.sub(u, v - ring - 0.48, -0.88, -Math.PI / 2);
  // The board's own frame: u' along w (out from the wall), w' across
  const plank = kit.box(board, 'boards', 0, 0, -0.02, 0.6, 0.48, 0.04, { tint: vary(0x6a5038, 0.06, kit.rand) });
  const shapes: Record<string, Array<[number, number, number, number]>> = {
    key: [
      [0.08, 0.17, 0.14, 0.14],
      [0.22, 0.215, 0.26, 0.05],
      [0.4, 0.13, 0.05, 0.09],
      [0.33, 0.13, 0.05, 0.09],
    ],
    tankard: [
      [0.18, 0.1, 0.2, 0.26],
      [0.38, 0.16, 0.05, 0.14],
      [0.16, 0.36, 0.24, 0.04],
    ],
    boot: [
      [0.24, 0.18, 0.12, 0.22],
      [0.14, 0.1, 0.32, 0.09],
    ],
    loaf: [
      [0.12, 0.12, 0.36, 0.12],
      [0.18, 0.24, 0.24, 0.06],
    ],
  };
  const pictogram: P[] = [];
  for (const [a, b, w, h] of shapes[picture])
    for (const side of [-1, 1]) pictogram.push(kit.box(board, 'iron', a, b, side > 0 ? 0.02 : -0.035, w, h, 0.015, { tint: 0x3a3632 }));
  if (!bracket || !plank) return null;
  const way = (du: number, dw: number) => f.at(du, 0, dw).map((x, k) => x - f.o[k]) as V3;
  // The board and its pictograms as one section, on its rings
  const pieces = [plank, ...pictogram.filter((p): p is Piece => !!p)];
  kit.d.release(pieces);
  const hinge = kit.d.hinge(plank, f.at(u, v - ring, -0.58), way(0, -1), { to: bracket });
  return { pieces, bracket, across: way(1, 0), hinge };
}

/**
 * A lantern on an iron bracket out of a wall at (u, v) of `f`: a base plate, four corner posts,
 * a pyramid cap hung from the bracket, and the glowing horn panes between the posts.
 */
export function lantern(kit: Kit, f: Frame, u: number, v: number): void {
  const iron = { tint: 0x3a3632 };
  kit.box(f, 'iron', u - 0.025, v, -0.36, 0.05, 0.05, 0.36, iron);
  // In the lantern's own frame: its middle at (0, ·, 0), hanging from v
  const l = f.sub(u, v - 0.36, -0.25);
  kit.box(l, 'iron', -0.12, 0, -0.12, 0.24, 0.035, 0.24, iron);
  for (const [x, z] of [
    [-0.11, -0.11],
    [0.08, -0.11],
    [-0.11, 0.08],
    [0.08, 0.08],
  ])
    kit.box(l, 'iron', x, 0.035, z, 0.03, 0.22, 0.03, iron);
  kit.box(l, 'lantern', -0.08, 0.035, -0.08, 0.16, 0.22, 0.16);
  kit.hull(l, 'iron', [[-0.13, 0, -0.13], [0.13, 0, -0.13], [-0.13, 0, 0.13], [0.13, 0, 0.13], [-0.025, 0.1, -0.025], [0.025, 0.1, -0.025], [-0.025, 0.1, 0.025], [0.025, 0.1, 0.025]], 0, 0.255, 0, iron);
  kit.box(l, 'iron', -0.025, 0.355, -0.025, 0.05, 0.005, 0.05, iron);
}

/**
 * The market hall: stone pads, twelve oak posts in three rows, beams along the rows, knee braces,
 * and a framed storey above, jettied to the square, its gable to it.
 */
export function marketHall(kit: Kit): Frame {
  kit.part('market hall');
  // Its front faces west at x = 14.5; u runs north from z = 12, w east
  const f = new Frame([14.5, 0, 12], Math.PI / 2);
  const W = 7;
  const D = 10;
  const us = [0.3, 2.4, 4.6, 6.7];
  const ws = [0.4, 5.0, 9.6];
  const pad = 0.3;
  const top = 3.1;
  const oak = OAK.brown;
  for (const w of ws)
    for (const u of us) {
      kit.box(f, 'limestone', u - 0.25, 0, w - 0.25, 0.5, pad, 0.5, { tint: vary(0xffffff, 0.06, kit.rand) });
      const tint = vary(oak, 0.06, kit.rand);
      kit.box(f, 'oak', u - 0.15, pad, w - 0.15, 0.3, 1.4, 0.3, { tint });
      kit.box(f, 'oak', u - 0.15, pad + 1.4, w - 0.15, 0.3, top - pad - 1.4, 0.3, { tint });
    }
  // Beams along each row, cut at the inner posts
  for (const w of ws) for (const [a, b] of pairs([0, 2.4, 4.6, W])) kit.box(f, 'oak', a, top, w - 0.15, b - a, 0.3, 0.3, { tint: vary(oak, 0.06, kit.rand) });
  // Knee braces from each post up to its beam, both ways along the row
  for (const w of ws) {
    const b = f.sub(0, 0, w - 0.075);
    for (const u of us)
      for (const dir of [-1, 1]) {
        const face = u + dir * 0.15;
        if (face + dir * 0.6 < 0 || face + dir * 0.6 > W) continue;
        const pts: Pt[] = [
          [face, top - 0.6],
          [face + dir * 0.6, top],
          [face + dir * 0.38, top],
          [face, top - 0.38],
        ];
        kit.prism(b, 'oak', pts, 0, 0.15, { tint: vary(oak, 0.06, kit.rand), grain: (-dir * Math.PI) / 4, lay: 'grain' });
      }
  }
  // The floor on the beams, out over the front, then the storey
  floor(kit, f, W, -0.45, D, top + 0.3, oak);
  house(kit, {
    name: 'market hall',
    f,
    width: W,
    depth: D,
    jetty: 0,
    raised: { v: top + 0.3 + T, front: -0.45 },
    storeys: [{ height: 2.7, front: 'BGWPWGb' }],
    sides: ['BGPBbPGPb'],
    rich: [true, true],
    roof: 'gable',
    pitch: deg(52),
    oak,
    plaster: WASH.white,
    tile: ROOF.weathered,
    verge: [0.25, 0.25],
  });
  kit.close();
  return f;
}

/** The stable: timber on a plinth, an open front with half doors, a lean-to roof falling to the square. */
export function stable(kit: Kit): void {
  kit.part('stable');
  const f = new Frame([4, 0, 15]);
  const W = 8;
  const D = 4;
  const front = 2.6 - PLINTH;
  const head = 1.2;
  plinth(kit, f, W, D);
  const oak = OAK.silver;
  const n = 5;
  frameWall(kit, f.sub(0, PLINTH, 0), { length: W, height: front, posts: bayPosts(W, n, true, T, 0.2), bays: (i) => (i === 0 || i === n - 1 ? { kind: 'brace', flip: i > 0 } : { kind: 'open' }), rails: [1.0], oak, plaster: WASH.white });
  // Half doors in the open bays, standing on the plinth, against the posts
  const ps = bayPosts(W, n, true, T, 0.2);
  for (const i of [1, 3]) {
    const [a, b] = [ps[i][1], ps[i + 1][0]];
    kit.box(f, 'boards', a, PLINTH + 0.2, 0.05, b - a, 1.0, 0.06, { tint: vary(0x8a7a64, 0.05, kit.rand) });
  }
  frameWall(kit, f.sub(W, PLINTH, D, Math.PI), { length: W, height: front + head, posts: bayPosts(W, 4, true), bays: () => ({ kind: 'panel' }), rails: [1.4], oak, plaster: WASH.white });
  for (const side of [0, 1]) {
    const sf = side === 0 ? f.sub(0, PLINTH, D - T, Math.PI / 2) : f.sub(W, PLINTH, T, -Math.PI / 2);
    frameWall(kit, sf, { length: D - 2 * T, height: front, posts: bayPosts(D - 2 * T, 2, false), bays: () => ({ kind: 'panel' }), rails: [1.0], oak, plaster: WASH.white });
  }
  roof(kit, f.sub(0, 2.6, 0), { length: W, span: D, pitch: deg(20), lean: true, head, gables: [true, true], oak, plaster: WASH.white, tile: ROOF.mossy, verge: [0.25, 0.25] });
  kit.close();
}

function pairs(xs: number[]): Array<[number, number]> {
  return xs.slice(0, -1).map((x, i) => [x, xs[i + 1]]);
}
