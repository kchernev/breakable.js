// The towers that frame the street, down it both ways and behind both rows (../../towers.ts): each a
// box of a grid of windows, about one in six lit, on a stone or brick colour of its own, standing as
// scenery until a round or a blast reaches it, then coming down in storey-high panels a window wide.

import { color, dot, float, floor, fract, hash, mix, select, smoothstep, step, vec2, vec3 } from 'three/tsl';
import type * as THREE from 'three/webgpu';
import type { World } from 'three-avbd';
import type { BreakableMaterial, Destruction } from '../../../lib/index.ts';
import { inside } from '../../textures.ts';
import { type FacadeLook, type TowerSpec, Towers } from '../../towers.ts';
import { STREET } from './city.ts';

/** A storey (m) and the facades' window bay. */
const STOREY = 3.3;
const BAY = 2.2;

let towers: Towers | null = null;

/**
 * A grid of windows (2.2 m bays, 3.3 m storeys): dark glass lighter toward its top, about one in six
 * lit, which by the window and the tower's colour; the roof the wall's colour, darker.
 */
const facade: FacadeLook = ({ along, y, tone, top }) => {
  const cell = vec2(along.div(BAY), y.div(STOREY));
  const f = fract(cell);
  const id = floor(cell);
  const isWindow = step(0.28, f.x).mul(step(f.x, 0.72)).mul(step(0.3, f.y)).mul(step(f.y, 0.82));
  const seed = floor(dot(tone, vec3(31.7, 17.3, 7.1)).mul(97));
  const lit = step(0.82, hash(id.x.mul(17.3).add(id.y.mul(91.7)).add(seed)));
  const glass = mix(color(0x2d3640), color(0x46525c), smoothstep(0.3, 0.82, f.y));
  return {
    color: select(top, vec3(0.8), mix(vec3(1), glass, isWindow)),
    toned: select(top, float(1), isWindow.oneMinus()),
    emissive: select(top, vec3(0), vec3(1.0, 0.78, 0.5).mul(1.6).mul(isWindow).mul(lit)),
    roughness: mix(float(0.9), float(0.25), isWindow),
  };
};

/** The towers as scenery and fixed boxes (with the scenery: the Destruction isn't made yet). */
export function skyline(scene: THREE.Scene, world: World, seed = 3): void {
  let s = seed;
  const rand = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const specs: TowerSpec[] = [];
  const place = (x: number, z: number, w: number, d: number, h: number) => specs.push({ x, z, w, d, h, tone: 0 });
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
  // Each its stone or brick
  const tone = (t: TowerSpec) => {
    const k = (Math.sin(t.x * 12.9898 + t.z * 78.233) * 43758.5453) % 1;
    const c = Math.abs(k);
    const a = [0x8a, 0x74, 0x66];
    const b = [0xb8, 0xad, 0x9c];
    return (Math.round(a[0] + (b[0] - a[0]) * c) << 16) | (Math.round(a[1] + (b[1] - a[1]) * c) << 8) | Math.round(a[2] + (b[2] - a[2]) * c);
  };
  for (const t of specs) t.tone = tone(t);
  towers = new Towers(scene, world, specs, facade, { storey: STOREY, bay: BAY, section: 4 * STOREY, wall: 0.3, material: 'tower', name: 'towers' });
}

/** Each tower's sections as dormant things (in build: the Destruction is made). */
export function dormantTowers(d: Destruction): void {
  towers?.dormant(d);
}

/** The towers' pieces: their facades as the scenery's, cracking and crumbling as concrete. */
export function towerMaterial(): BreakableMaterial {
  if (!towers) throw new Error('nyc: towers before skyline()');
  return towers.material({ inside: 0xb4aca0, insideTexture: inside('gen_concrete_broken', 1.2), strength: 2000 });
}
