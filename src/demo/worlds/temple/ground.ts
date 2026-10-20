// The breakable ground (layout.ts has where): the court before the temple, marble flags over a bed
// of rubble, and the hilltop round it, its dry earth over the rock. A rocket craters it, the gun
// chips it, the player walks down into a crater and out. Here: the slabs, the plateau's bodies (its
// top at the bed under the ground, at the land elsewhere), and what a crater shows past the slabs
// (the bed, and the cut where the ground ends against the land and what stands on it).

import { normalWorld, positionWorld, select, vec2 } from 'three/tsl';
import * as THREE from 'three/webgpu';
import type { World } from 'three-avbd';
import type { Destruction, Ground } from '../../../lib/index.ts';
import { bedrock, rockFace, soilFace } from './land.ts';
import { AREAS, type Area, COURT, FIELDS, LAYERS, within } from './layout.ts';

/** Every slab maps its textures from the world's origin: the maps run on across areas, and a surface reads where it was laid from its texture coordinates. */
const ORIGIN = { position: [0, 0, 0] as [number, number, number] };

/** Lays the court and the fields (in build(), before what stands on them). */
export function layGround(d: Destruction): Ground[] {
  const under = -LAYERS.bed;
  return [
    // Flags of 2.2 m (the joints between them painted in their surface, materials.ts), on 0.7 m of
    // rubble; a blast throws their chunks clear of the hole, to land round it. The floor of a pit is
    // the bare rock pits() draws, and is struck as rock
    ...COURT.map((area) => d.addGround({ material: 'paving', under: 'fill', bed: 'rock', area, top: 0, depth: LAYERS.flags, underDepth: under - LAYERS.flags, cell: 2.2, textureFrame: ORIGIN, toss: 0.55 })),
    // Big slabs: the earth sprays and the rock under it breaks in chunks wherever they're struck
    ...FIELDS.map((area) => d.addGround({ material: 'earth', under: 'rock', bed: 'rock', area, top: 0, depth: LAYERS.earth, underDepth: under - LAYERS.earth, cell: 3, textureFrame: ORIGIN })),
  ];
}

/**
 * The plateau in the physics world: boxes 4 m deep, their top at the land's 0, and at the bed under
 * the breakable ground. Cut along the areas' edges, each column's runs carried on into the next
 * while they're the same.
 */
export function plateau(world: World): void {
  const [X0, Z0, X1, Z1] = [-34, -30, 40, 30];
  const xs = [...new Set([X0, X1, ...AREAS.flatMap(([x0, , x1]) => [x0, x1])])].sort((a, b) => a - b);
  const zs = [...new Set([Z0, Z1, ...AREAS.flatMap(([, z0, , z1]) => [z0, z1])])].sort((a, b) => a - b);
  type Run = { x0: number; z0: number; z1: number; bed: boolean };
  const box = (r: Run, x1: number) => {
    const top = r.bed ? LAYERS.bed : 0;
    world.addBox({ size: [x1 - r.x0, top + 4, r.z1 - r.z0], position: [(r.x0 + x1) / 2, (top - 4) / 2, (r.z0 + r.z1) / 2], fixed: true, friction: 0.8 });
  };
  let open: Run[] = [];
  for (let i = 0; i + 1 < xs.length; i++) {
    const runs: Run[] = [];
    for (let j = 0; j + 1 < zs.length; j++) {
      const bed = within(AREAS, (xs[i] + xs[i + 1]) / 2, (zs[j] + zs[j + 1]) / 2);
      const last = runs[runs.length - 1];
      if (last && last.bed === bed) last.z1 = zs[j + 1];
      else runs.push({ x0: xs[i], z0: zs[j], z1: zs[j + 1], bed });
    }
    const next = runs.map((r) => open.find((o) => o.z0 === r.z0 && o.z1 === r.z1 && o.bed === r.bed) ?? r);
    for (const o of open) if (!next.includes(o)) box(o, xs[i]);
    open = next;
  }
  for (const o of open) box(o, X1);
}

/** An edge of the ground where it meets no other area: from, to (x, z), and the way into the ground. */
interface Rim {
  from: [number, number];
  to: [number, number];
  inward: [number, number];
}

/** The parts of [a, b] not covered by the spans. */
function subtract(a: number, b: number, spans: Array<[number, number]>): Array<[number, number]> {
  let out: Array<[number, number]> = [[a, b]];
  for (const [c, e] of spans) out = out.flatMap(([p, q]): Array<[number, number]> => (e <= p || c >= q ? [[p, q]] : [...(c > p ? [[p, c] as [number, number]] : []), ...(e < q ? [[e, q] as [number, number]] : [])]));
  return out.filter(([p, q]) => q - p > 1e-6);
}

/** The edges of the areas that border no other area, each facing into its area. */
function rims(areas: Area[]): Rim[] {
  const out: Rim[] = [];
  const near = (a: number, b: number) => Math.abs(a - b) < 1e-6;
  for (const [x0, z0, x1, z1] of areas) {
    // West and east: what borders it there across x
    for (const [x, dir] of [[x0, 1], [x1, -1]] as const) {
      const others = areas.filter((o) => near(dir > 0 ? o[2] : o[0], x)).map((o): [number, number] => [o[1], o[3]]);
      for (const [a, b] of subtract(z0, z1, others)) out.push({ from: [x, a], to: [x, b], inward: [dir, 0] });
    }
    // North and south, across z
    for (const [z, dir] of [[z0, 1], [z1, -1]] as const) {
      const others = areas.filter((o) => near(dir > 0 ? o[3] : o[1], z)).map((o): [number, number] => [o[0], o[2]]);
      for (const [a, b] of subtract(x0, x1, others)) out.push({ from: [a, z], to: [b, z], inward: [0, dir] });
    }
  }
  return out;
}

/**
 * What a crater shows past the slabs: the bed (bare rock), and where the ground ends against the
 * land and what stands on it (the steps, the platforms, the strip left at the wall's foot), the cut
 * through the earth and the rock under it, from the bed up to the surface. One mesh.
 */
export function pits(): THREE.Mesh {
  const pos: number[] = [];
  const nor: number[] = [];
  const quad = (a: number[], b: number[], c: number[], d: number[], n: number[]) => {
    for (const p of [a, b, c, a, c, d]) pos.push(...p);
    for (let i = 0; i < 6; i++) nor.push(...n);
  };
  const { bed } = LAYERS;
  for (const [x0, z0, x1, z1] of AREAS) quad([x0, bed, z0], [x0, bed, z1], [x1, bed, z1], [x1, bed, z0], [0, 1, 0]);
  for (const { from: [ax, az], to: [bx, bz], inward: [ix, iz] } of rims(AREAS)) {
    // Wound to face into the ground
    const [p, q] = ix > 0 || iz < 0 ? [[bx, bz], [ax, az]] : [[ax, az], [bx, bz]];
    quad([p[0], bed, p[1]], [q[0], bed, q[1]], [q[0], 0, q[1]], [p[0], 0, p[1]], [ix, 0, iz]);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  const m = new THREE.MeshStandardNodeMaterial({ roughness: 0.95 });
  const p = positionWorld;
  // Along a cut and up it: the earth over the rock; the bed, bare rock seen from above
  const along = vec2(select(normalWorld.x.abs().greaterThan(0.5), p.z, p.x), p.y);
  const cut = select(p.y.greaterThan(-LAYERS.earth), soilFace(along), rockFace(along));
  m.colorNode = select(normalWorld.y.greaterThan(0.5), bedrock(p), cut);
  const mesh = new THREE.Mesh(g, m);
  mesh.receiveShadow = true;
  mesh.name = 'temple:pits';
  return mesh;
}
