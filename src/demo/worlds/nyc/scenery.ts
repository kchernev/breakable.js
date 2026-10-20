// What isn't breakable: the street's bed and the ground past the facades (fixed bodies in the
// world), the road and the sidewalks past the row (pieces that never break), what a crater shows
// below them, and the towers in the distance that frame the street.

import { abs, color, float, floor, fract, hash, mix, normalWorld, positionWorld, select, smoothstep, step, uv, vec2, vec3 } from 'three/tsl';
import * as THREE from 'three/webgpu';
import type { World } from 'three-avbd';
import type { Destruction, Ground, V3 } from '../../../lib/index.ts';
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
  const { half, bed } = ROAD;
  // In the world: the bed under the road and the sidewalks (the stretch's slabs rest on it, and the
  // layers past both ends: groundEnds), and the ground beyond the facades (its top the ground the
  // buildings stand on; its foot under the bed, so nothing slips under it out of a crater by a facade)
  world.addBox({ size: [L, 1, 2 * front], position: [0, bed - 0.5, 0], fixed: true, friction: 0.9 });
  for (const side of [1, -1]) world.addBox({ size: [L, 2, 120], position: [0, -1, side * (front + 60)], fixed: true, friction: 0.9 });

  // What a crater shows past the slabs: the earth of the bed, and the buildings' foundations down
  // the facade line
  const plane = (material: THREE.MeshStandardNodeMaterial, w: number, h: number, at: V3, turn: number, flat = false) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), material);
    m.rotation.set(flat ? -Math.PI / 2 : 0, turn, 0, 'YXZ');
    m.position.set(...at);
    m.receiveShadow = true;
    scene.add(m);
  };
  plane(repeat(textured('rocky_trail_02', { base: EARTH, color: EARTH_TINT }), half, front), 2 * half, 2 * front, [0, bed, 0], 0, true);
  const footing = repeat(textured('concrete_wall_008', { color: 0xb8b2a8, normalScale: 0.6 }), (2 * half) / 2.5, -bed / 2.5);
  for (const side of [1, -1]) plane(footing, 2 * half, -bed, [0, bed / 2, side * front], side > 0 ? Math.PI : 0);

  // The sidewalk beyond the facades (under the buildings and past the row's ends), its 2 m flags on
  // the joints of the stretch's (a joint where it meets them), each its own as theirs are
  const walk = textured('gen_sidewalk', { color: 0xe4e0d8, normalScale: 0.6 });
  const flag = flagged(walk, uv().mul(vec2(L / 4, 10)));
  walk.colorNode = flag.color;
  walk.roughnessNode = flag.roughness;
  repeat(walk, L / 4, 10);
  for (const side of [1, -1]) plane(walk, L, 40, [0, 0, side * (front + 20)], 0, true);
}

/**
 * A breakable ground's layers past its stretch both ways, to the street's ends: pieces that never
 * break, on the bed, mapped in the slabs' frames, so it looks just as they do across the stretch's
 * ends (the light, the map, the double yellow and the curb running on) and a crater there shows the
 * top layer's edge over the earth. The slabs don't bond to them: what holds a slab up is under it.
 */
export function groundEnds(d: Destruction, ground: Ground): void {
  const [x0, z0, x1, z1] = ground.area;
  const top = ground.slabs[0];
  const layers = [{ material: ground.material, slab: top, y0: top.bounds.min[1], y1: ground.top }];
  if (ground.under) layers.push({ material: ground.under, slab: ground.slabs[ground.slabs.length - 1], y0: ground.bed, y1: top.bounds.min[1] });
  for (const { material, slab, y0, y1 } of layers)
    for (const [a, b] of [
      [x1, L / 2],
      [-L / 2, x0],
    ])
      d.addBox({ material, size: [b - a, y1 - y0, z1 - z0], position: [(a + b) / 2, (y0 + y1) / 2, (z0 + z1) / 2], textureFrame: slab.textureFrame, static: true });
}

/**
 * Distant towers along and beyond both ends of the street, with lit windows at random. Each is a
 * fixed box in the world too: rounds and rockets strike it (as the scenery's stone), and a tracer
 * stops at it.
 */
export function skyline(scene: THREE.Scene, world: World, seed = 3): void {
  const material = towerMaterial();
  let s = seed;
  const rand = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const geometry = new THREE.BoxGeometry(1, 1, 1);
  const place = (x: number, z: number, w: number, d: number, h: number) => {
    const m = new THREE.Mesh(geometry, material);
    m.scale.set(w, h, d);
    m.position.set(x, h / 2, z);
    m.castShadow = true;
    m.receiveShadow = true;
    scene.add(m);
    world.addBox({ size: [w, h, d], position: [x, h / 2, z], fixed: true });
  };
  const half = STREET.length / 2;
  // Tall behind the far row (the backdrop as you look at it); lower and further back behind the
  // near row, so the sun, which comes from that side, reaches over them onto the far facades
  for (let x = -half - 20; x < half + 20; x += 14 + rand() * 10) place(x, STREET.front + 26 + rand() * 20, 12 + rand() * 10, 14 + rand() * 8, 30 + rand() * 50);
  for (let x = -half - 20; x < half + 20; x += 18 + rand() * 12) place(x, -(STREET.front + 70 + rand() * 30), 14 + rand() * 10, 14 + rand() * 8, 18 + rand() * 22);
  // Down the street both ways, past where the row ends
  for (const end of [1, -1])
    for (let k = 0; k < 6; k++) {
      const z = (k % 2 ? 1 : -1) * (STREET.front + 6 + rand() * 4);
      place(end * (half + 10 + k * 14 + rand() * 6), z, 12 + rand() * 6, 12, 26 + rand() * 60);
    }
}

/** Facades of a grid of windows, some lit, on a stone or brick colour per tower. */
function towerMaterial(): THREE.MeshStandardNodeMaterial {
  const m = new THREE.MeshStandardNodeMaterial({ roughness: 0.85 });
  // Window grid in facade space: horizontal along the face, vertical up
  const side = abs(normalWorld.x).greaterThan(0.5);
  const along = select(side, positionWorld.z, positionWorld.x);
  const cell = vec2(along.div(2.2), positionWorld.y.div(3.3));
  const f = fract(cell);
  const id = floor(cell);
  const isWindow = step(0.28, f.x).mul(step(f.x, 0.72)).mul(step(0.3, f.y)).mul(step(f.y, 0.82));
  const top = abs(normalWorld.y).greaterThan(0.5);
  const lit = step(0.82, hash(id.x.mul(17.3).add(id.y.mul(91.7)).add(floor(positionWorld.x.add(positionWorld.z).div(40)))));
  const tower = hash(floor(positionWorld.x.div(9)).add(floor(positionWorld.z.div(9)).mul(13.1)));
  const wall = mix(color(0x8a7466), color(0xb8ad9c), tower);
  const glass = mix(color(0x2d3640), color(0x46525c), smoothstep(0.3, 0.82, f.y));
  m.colorNode = select(top, wall.mul(0.8), mix(wall, glass, isWindow));
  m.emissiveNode = select(top, vec3(0), vec3(1.0, 0.78, 0.5).mul(isWindow).mul(lit).mul(float(1.6)));
  m.roughnessNode = mix(float(0.9), float(0.25), isWindow);
  return m;
}
