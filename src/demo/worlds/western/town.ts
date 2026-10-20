// The town's layout: what stands where (DESIGN.md §1.2), built by fronts.ts, masonry.ts and
// works.ts, and the props (wagons, the safe, pumps, rocking chairs) placed where nothing stands.

import type { Destruction, Hinge, Piece, PropModel, Q, V3 } from '../../../lib/index.ts';
import { type Built, falseFront, type Hanger, type WallWatch } from './fronts.ts';
import { interiors } from './interiors.ts';
import { bank, chapel } from './masonry.ts';
import { bale, barberPole, barrel, bench, corral, crate, hitchingRail, livery, outhouse, smithy, telegraph, type Tower, trough, waterTower, windmill } from './works.ts';

/** What the world's reactions need to know about the town once it's built. */
export interface Town {
  hangers: Hanger[];
  bell: Hinge | null;
  /** The forge's coals. */
  forge: Piece | null;
  /** The chapel's gable top, the water tower's roof, the saloon's ridge: where the doves sit. */
  perches: V3[];
  /** Where the hawk sits (and what it sits on): the windmill's platform, the telegraph poles' tops. */
  roosts: Array<{ at: V3; piece: Piece | null }>;
  gearbox: Piece | null;
  hub: V3;
  tower: Tower;
  /** The fronts, and the two-storey buildings' side and back walls. */
  walls: WallWatch[];
}

export function buildTown(d: Destruction, models: Record<string, PropModel>): Town {
  const hangers: Hanger[] = [];
  const walls: WallWatch[] = [];
  const step = <T>(name: string, make: () => T): T => {
    const before = d.stats.pieces;
    const r = make();
    console.debug(`western: ${name} ${d.stats.pieces - before} pieces`);
    return r;
  };
  const front = (name: string, make: () => Built) =>
    step(name, () => {
      const built = make();
      hangers.push(...built.hangers);
      walls.push(...built.watches);
    });

  // The north row: sunlit fronts. Their paint shows only where the siding's map has paint left
  // (the bare boards stay grey), so it's a little deeper than the faded colour it reads as. The
  // saloon's red is a pale, faded one: a deep red, darker than the bare wood between its flakes,
  // reads as brick from across the street
  front('saloon', () =>
    falseFront(d, { x0: -24, x1: -12, side: 1, depth: 12, storeys: 2, front: 5, step: 2, paint: 0xc49a8a, trim: 0xf2ead8, door: 0x7e5a42, ground: 'ww-b-ww', upper: '-w-d-w-', back: '-d--w-', left: '-w--w-', right: '---w--', sign: 'tankard', roof: 'gable', porch: 'balcony', seed: 11 }),
  );
  front('barber', () => falseFront(d, { x0: -10.5, x1: -4.5, side: 1, depth: 8, storeys: 1, front: 5, paint: 0x95a689, trim: 0x5f6f58, ground: 'wdw', back: '-d-', sign: 'razor', roof: 'shed', porch: 'awning', seed: 12 }));
  const vault = step('bank', () => bank(d));
  front('hotel', () =>
    falseFront(d, { x0: 10, x1: 20, side: 1, depth: 11, storeys: 2, front: 5, cornice: true, paint: 0x93a4b1, trim: 0xf2ead8, door: 0x74583e, ground: 'wwdww', upper: 'wwwww', back: '-d-w-', left: '-w--w-', right: '-w--w-', sign: 'bed', roof: 'gable', porch: 'awning', seed: 13 }),
  );
  const church = step('chapel', () => chapel(d));
  // The south row: fronts in shade
  front('store', () =>
    falseFront(d, { x0: -24, x1: -12, side: -1, depth: 12, storeys: 1, front: 7, step: 2, paint: 0xd0ab5e, trim: 0x8a4a3c, door: 0x74503a, ground: 'w-WdW-w', back: '-d--w-', left: '--w--w', right: '-w--w-', sign: 'goods', roof: 'gable', porch: 'awning', seed: 14 }),
  );
  front('sheriff', () =>
    falseFront(d, { x0: -10, x1: -1, side: -1, depth: 10, storeys: 1, front: 5, paint: 0xece0c7, trim: 0x4a5a48, door: 0x66503a, ground: 'w-d-w', back: '--w--', left: '----x', right: '-w---', sign: 'star', roof: 'gable', porch: 'awning', seed: 15 }),
  );
  step('livery', () => hangers.push(...livery(d).hangers));
  const forge = step('smithy', () => {
    const shed = smithy(d);
    hangers.push(...shed.hangers);
    return shed.coals;
  });
  const tower = step('water tower', () => waterTower(d));
  const mill = step('windmill', () => windmill(d));
  step('interiors', () => interiors(d));

  const roosts = step('small things', () => {
    // Barrels: on the store's boardwalk, by the saloon, the livery, the smithy, the west entrance, behind the hotel
    const walk = 0.4;
    const barrels: Array<[number, number, number]> = [
      [-21, walk, -8.3],
      [-20.3, walk, -8.5],
      [-14, walk, -8.4],
      [-12.6, walk, 7.8],
      [-12.6, walk, 8.5],
      [-13.25, walk, 8.6],
      [-13.3, walk, 7.75],
      [2.2, 0, -8.7],
      [2.85, 0, -8.4],
      [11.8, 0, -8.7],
      [19.0, 0, -11.0],
      [19.2, 0, -14.4],
      [15.0, 0, -14.5],
      [-30.0, 0, -6.0],
      [-29.35, 0, -6.35],
      [12.0, 0, 21.3],
      [12.7, 0, 21.6],
      [13.3, 0, 21.2],
    ];
    barrels.forEach(([x, y, z], i) => barrel(d, x, y, z, i % 3 ? 0xb09474 : 0xa08668));
    // Crates in stacks: the store's boardwalk, beside the hotel, behind the store
    const stack = (x: number, y: number, z: number, sizes: number[]) => {
      let h = y;
      for (const s of sizes) {
        crate(d, x, h, z, s, s > 0.75 ? 0xd8c8b0 : 0xe8d8c0);
        h += s;
      }
    };
    stack(-16.6, walk, -8.1, [0.8, 0.7, 0.6]);
    stack(-15.7, walk, -8.2, [0.7, 0.6]);
    stack(-23.2, walk, -8.2, [0.75, 0.6]);
    stack(20.9, 0, 12.4, [0.9, 0.8, 0.6]);
    stack(20.9, 0, 13.5, [0.8, 0.6]);
    stack(21.0, 0, 14.6, [0.7]);
    stack(21.9, 0, 12.9, [0.6, 0.6]);
    stack(-21.0, 0, -22.4, [0.9, 0.8, 0.7, 0.6]);
    stack(-19.9, 0, -22.3, [0.8, 0.7]);
    stack(-18.9, 0, -22.5, [0.9, 0.6, 0.6]);
    stack(-17.9, 0, -22.4, [0.7]);
    stack(-20.4, 0, -23.4, [0.8, 0.6]);
    stack(-14.2, 0, -22.4, [0.75, 0.65]);
    // Hay outside the livery
    for (const [x, z, along, y] of [
      [12.8, -7.6, 'x', 0],
      [13.85, -7.6, 'x', 0],
      [13.3, -7.6, 'x', 0.45],
      [12.9, -6.85, 'z', 0],
      [14.9, -7.1, 'z', 0],
      [11.6, -7.2, 'z', 0],
    ] as const)
      bale(d, x, z, along, y);
    for (const [x, z] of [
      [-21.5, 6.6],
      [-15.5, 6.6],
      [-18, -6.6],
      [-6, -6.6],
      [15, 6.6],
      // Beside the bank's steps, not across them
      [6.0, 6.6],
      [3.5, -6.6],
      [-31, 6.6],
    ])
      hitchingRail(d, x, z);
    for (const [x, z] of [
      [-18, 6.2],
      [-18, -6.2],
      [7, -6.4],
      [18, 6.4],
    ])
      trough(d, x, z);
    bench(d, -6.9, walk, 9.0);
    bench(d, -3.4, walk, -9.0);
    bench(d, 17.6, walk, 9.0);
    barberPole(d, [-4.61, 0, 7.15]);
    const poles = [telegraph(d, -34, -8.0), telegraph(d, 33, -8.0)];
    corral(d);
    outhouse(d);
    return poles;
  });

  // Each copy a shade of its own: the wagon by the livery more sun-bleached, the chairs from
  // different years
  step('props', () =>
    placeProps(d, models, [
      { name: 'wagon', at: [-27, 0, 4.5], turn: Math.PI / 2 + 0.35, material: 'timber' },
      { name: 'wagon', at: [9.5, 0, -4.8], turn: -Math.PI / 2, material: 'timber', tint: 0xe4ddd2 },
      { name: 'safe', at: vault.safe, turn: 0, material: 'iron' },
      { name: 'pump', at: [-19.5, 0, 6.2], turn: -Math.PI / 2, material: 'iron' },
      { name: 'pump', at: [5.6, 0, -6.2], turn: -Math.PI / 2, material: 'iron' },
      { name: 'rocking_chair', at: [12.0, 0.4, 8.6], turn: 0.15, material: 'timber' },
      { name: 'rocking_chair', at: [14.4, 0.4, 8.6], turn: -0.2, material: 'timber', tint: 0xc8b49c },
      { name: 'rocking_chair', at: [-7.6, 0.4, -8.6], turn: Math.PI + 0.25, material: 'timber', tint: 0xa89280 },
      { name: 'rocking_chair', at: [-9.6, 0.4, 8.6], turn: 0.1, material: 'timber', tint: 0xe2d6c4 },
    ]),
  );

  return {
    hangers,
    bell: church.bell,
    forge,
    perches: [church.top, tower.top, [-18, 9.2, 15.5]],
    roosts: [mill.roost, ...roosts],
    gearbox: mill.gearbox,
    hub: mill.hub,
    tower,
    walls,
  };
}

const yaw = (a: number): Q => [0, Math.sin(a / 2), 0, Math.cos(a / 2)];

/** Place props where their colliders are clear of what stands and of each other (any model may be missing). */
function placeProps(d: Destruction, models: Record<string, PropModel>, list: Array<{ name: string; at: V3; turn: number; material: string; tint?: number }>): void {
  const pieces = d.all().filter((p) => p.state === 'fixed');
  const taken: Array<{ min: V3; max: V3 }> = [];
  for (const { name, at, turn, material, tint } of list) {
    const m = models[name];
    if (!m) continue;
    const [c, s] = [Math.cos(turn), Math.sin(turn)];
    const min: V3 = [Infinity, Infinity, Infinity];
    const max: V3 = [-Infinity, -Infinity, -Infinity];
    for (const [x, y, z] of m.collider) {
      const p: V3 = [at[0] + c * x + s * z, at[1] + y, at[2] - s * x + c * z];
      for (let k = 0; k < 3; k++) {
        min[k] = Math.min(min[k], p[k]);
        max[k] = Math.max(max[k], p[k]);
      }
    }
    const b = { min, max };
    const overlaps = (o: { min: V3; max: V3 }) => [0, 1, 2].every((k) => b.min[k] < o.max[k] - 0.02 && b.max[k] > o.min[k] + 0.02);
    const blocking = pieces.find((p) => overlaps(p.bounds));
    if (taken.some(overlaps) || blocking) {
      console.warn(`western: no room for ${name} at ${at.map((v) => v.toFixed(1))}${blocking ? ` (${blocking.materialName} at ${blocking.pose.position.map((v) => v.toFixed(1))})` : ''}`);
      continue;
    }
    d.addProp({ model: m, material, position: at, rotation: yaw(turn), tint });
    taken.push(b);
  }
}
