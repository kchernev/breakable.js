// The street's ground: its bed and the ground past the facades (fixed bodies in the world), what a
// crater shows below the slabs, the sidewalk drawn beyond the facades, and the road and the
// sidewalks past the breakable stretch to the street's ends (dormant until something reaches them,
// then breakable as the stretch is). The towers round the street are towers.ts's.

import { uv, vec2 } from 'three/tsl';
import * as THREE from 'three/webgpu';
import type { World } from 'three-avbd';
import type { Destruction, GroundOptions, Piece, Q, V3 } from '../../../lib/index.ts';
import { repeat, textured } from '../../textures.ts';
import { ROAD, STREET } from './city.ts';
import { EARTH, EARTH_TINT, flagged } from './materials.ts';

/** How long the street is drawn, end to end (m). */
const L = 260;

/**
 * The street in the world (its bed under the breakable stretch, the ground past the facades), what
 * a crater shows past the slabs, and the sidewalk drawn beyond the facades.
 */
export function street(scene: THREE.Scene, world: World): void {
  const { front } = STREET;
  const { bed } = ROAD;
  // In the world: the bed under the road and the sidewalks (the stretch's slabs rest on it, and the
  // layers past both ends: streetEnds), and the ground beyond the facades (its top the ground the
  // buildings stand on; its foot under the bed, so nothing slips under it out of a crater by a facade)
  world.addBox({ size: [L, 1, 2 * front], position: [0, bed - 0.5, 0], fixed: true, friction: 0.9 });
  for (const side of [1, -1]) world.addBox({ size: [L, 2, 120], position: [0, -1, side * (front + 60)], fixed: true, friction: 0.9 });

  // What a crater shows past the slabs: the earth of the bed, and the buildings' foundations down
  // the facade line, the street's length (a segment past the stretch is laid breakable too)
  const plane = (material: THREE.MeshStandardNodeMaterial, w: number, h: number, at: V3, turn: number, flat = false) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), material);
    m.rotation.set(flat ? -Math.PI / 2 : 0, turn, 0, 'YXZ');
    m.position.set(...at);
    m.receiveShadow = true;
    scene.add(m);
  };
  plane(repeat(textured('rocky_trail_02', { base: EARTH, color: EARTH_TINT }), L / 2, front), L, 2 * front, [0, bed, 0], 0, true);
  const footing = repeat(textured('concrete_wall_008', { color: 0xb8b2a8, normalScale: 0.6 }), L / 2.5, -bed / 2.5);
  for (const side of [1, -1]) plane(footing, L, -bed, [0, bed / 2, side * front], side > 0 ? Math.PI : 0);

  // The sidewalk beyond the facades (under the buildings and past the row's ends), its 2 m flags on
  // the joints of the stretch's (a joint where it meets them), each its own as theirs are
  const walk = textured('gen_sidewalk', { color: 0xe4e0d8, normalScale: 0.6 });
  const flag = flagged(walk, uv().mul(vec2(L / 4, 10)));
  walk.colorNode = flag.color;
  walk.roughnessNode = flag.roughness;
  repeat(walk, L / 4, 10);
  for (const side of [1, -1]) plane(walk, L, 40, [0, 0, side * (front + 20)], 0, true);
}

/** The street past the breakable stretch, both ways to its ends, is in segments this long (m: the flags' joints on their seams). */
const SEGMENT = 10;

/**
 * The street past its breakable stretch both ways, to its ends: segments of its layers (its
 * grounds' options, `grounds(x0, x1)`), each standing as pieces that never break, on the bed,
 * mapped in the slabs' frames (so it looks just as they do across the stretch's ends, the light,
 * the map, the double yellow and the curb running on), until a round or a blast reaches it: then
 * it's laid as breakable ground as the stretch is (Destruction.addDormant), and `woken` says where.
 */
export function streetEnds(d: Destruction, grounds: (x0: number, x1: number) => GroundOptions[], woken: Array<[number, number]>): void {
  const [x0, , x1] = grounds(-ROAD.half, ROAD.half)[0].area;
  for (const end of [1, -1])
    for (let a = x1; a < L / 2 - 1e-6; a += SEGMENT) {
      const [s0, s1] = end > 0 ? [a, Math.min(L / 2, a + SEGMENT)] : [-Math.min(L / 2, a + SEGMENT), -a];
      const standIns: Piece[] = [];
      for (const g of grounds(s0, s1)) {
        const [, z0, , z1] = g.area;
        const top = g.top ?? 0;
        const y0 = top - (g.depth ?? 0.3);
        const bed = y0 - (g.under ? (g.underDepth ?? 0.6) : 0);
        // The stretch's own frames: its map runs on into these
        const frame = { position: g.textureFrame?.position ?? [x0, top, z0], rotation: g.textureFrame?.rotation ?? [0, 0, 0, 1] } as { position: V3; rotation: Q };
        for (const [material, lo, hi] of [
          [g.material, y0, top],
          [g.under, bed, y0],
        ] as Array<[string | undefined, number, number]>)
          if (material) {
            const p = d.addBox({ material, size: [s1 - s0, hi - lo, z1 - z0], position: [(s0 + s1) / 2, (lo + hi) / 2, (z0 + z1) / 2], textureFrame: frame, static: true, bond: false });
            if (p) standIns.push(p);
          }
      }
      d.addDormant({
        name: 'street',
        bounds: { min: [s0, ROAD.bed, -STREET.front], max: [s1, 0, STREET.front] },
        hide: () => standIns.forEach((p) => d.removePiece(p)),
        build: (dd) => {
          for (const g of grounds(s0, s1)) dd.addGround(g);
          woken.push([s0, s1]);
        },
      });
    }
}
