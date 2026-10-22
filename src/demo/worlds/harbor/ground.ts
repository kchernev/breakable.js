// The yard's ground: the quay's edge with the water beyond it, and the apron, the yard's paving laid
// as reinforced concrete slabs over a bed of crushed stone (Destruction.addGround): a rocket craters
// it, the gun chips it. It runs from the quay's edge strip (the kerb, the bollards and the pair of
// boxes there stand on the fixed deck) to the far blocks, round the crane's rail beams (pieces of
// their own: scenery.ts railBeams).

import type { Destruction, Ground } from '../../../lib/index.ts';

/** Where things are: the quay edge (north of it the water), and the water's level. */
export const QUAY = { edge: -30, water: -1.8, seabed: -9 };

/** The crane's rail beams: concrete strips flush with the deck along x, a rail down each (pieces on the bed: scenery.ts railBeams). */
export const BEAMS = { x0: -36, x1: 8, rails: [-21, -1], half: 0.4 };

/**
 * The apron: `depth` of concrete over `under` of crushed stone, on its bed (`bed`, where groundAt has
 * the ground). Slabs of about `cell`, the pavement's own 4 m slabs (lined up with its joints west and
 * east of the beams). Its areas ([x0, z0, x1, z1]): west of the beams, east of them, and between and
 * round them; `bounds` holds them all.
 */
export const APRON = (() => {
  const depth = 0.3;
  const under = 0.4;
  const bounds = [-48, QUAY.edge + 4, 48, 42] as const;
  const [x0, z0, x1, z1] = bounds;
  const [r0, r1] = BEAMS.rails;
  const h = BEAMS.half;
  const areas: Array<[number, number, number, number]> = [
    [x0, z0, BEAMS.x0, z1],
    [BEAMS.x1, z0, x1, z1],
    [BEAMS.x0, z0, BEAMS.x1, r0 - h],
    [BEAMS.x0, r0 + h, BEAMS.x1, r1 - h],
    [BEAMS.x0, r1 + h, BEAMS.x1, z1],
  ];
  return { depth, under, bed: -(depth + under), cell: 4, bounds, areas };
})();

/** On the apron (seen from above): its ground is the bed, the slabs over it are pieces. */
export const onApron = (x: number, z: number): boolean => APRON.areas.some(([x0, z0, x1, z1]) => x >= x0 && x <= x1 && z >= z0 && z <= z1);

/**
 * Lay the apron: each area's slabs, `slab` over `gravel`, every one mapped from the pavement's corner
 * on the quay's edge (x 0), so the map, its joints and its paint run on across them and across the
 * drawn deck round them. A rocket throws the chunks out of the crater, to land round it out to 7 m
 * (`toss` 0.6, and the slab cut in 24, its thin wedges going as grit: paving.ts): at the library's
 * 0.4, in 16, these heavy chunks hopped and fell back across the hole and round its rim, some on
 * edge, and the player walked over them instead of down into it.
 */
export function layApron(d: Destruction): Ground[] {
  return APRON.areas.map((area) =>
    d.addGround({ material: 'slab', under: 'gravel', area, top: 0, depth: APRON.depth, underDepth: APRON.under, cell: APRON.cell, toss: 0.6, textureFrame: { position: [0, 0, QUAY.edge] } }),
  );
}

/** Under a roof (x0, x1, z0, z1): the shed's and the office's floors, dry. */
export const ROOFS: Array<[number, number, number, number]> = [
  [-34.3, -9.7, 7.7, 24.3],
  [-7.2, -0.8, 11.3, 14.1],
];

export const roofed = (x: number, z: number): boolean => ROOFS.some(([x0, x1, z0, z1]) => x >= x0 && x <= x1 && z >= z0 && z <= z1);

/** The drain grates' centres (painted on the pavement; it's wetter round them). */
export const DRAINS: Array<[number, number]> = [
  [8, -25],
  [8, -5],
  [8, 15],
  [-30, -4.05],
  [-10, -4.05],
];
