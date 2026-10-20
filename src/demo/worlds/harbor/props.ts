// The harbor pack's props (public/packs/harbor/models): forklifts, yard tractors, oil drums in five
// paints (one model, its paint tinted per copy; three lying on their sides) and cable reels, each
// placed only where nothing stands. Drums and reels roll (16-sided colliders).

import type { Destruction, Piece, PropModel, Q, V3 } from '../../../lib/index.ts';
import { add, multiply, random, rotate } from '../../../lib/index.ts';
import { yaw } from './frame.ts';

/** Faded paints: the model's own blue, red, yellow, green, charcoal (times the model's grey paint). */
const PAINTS = [undefined, 0xbd5c4e, 0xf0c65c, 0x609269, 0x3f4144];
/** On its side: 90° about z puts a flat of its collider down; its axle then runs along -x from where it's put. */
const LYING: Q = [0, 0, Math.SQRT1_2, Math.SQRT1_2];

export function placeProps(d: Destruction, models: Record<string, PropModel>, seed = 13): void {
  const rand = random(seed);
  const fixed = d.all().filter((p) => p.state === 'fixed');
  const taken: Array<{ min: V3; max: V3 }> = [];
  // A model's collider's bounds where it would stand
  const bounds = (m: PropModel, at: V3, rotation: Q) => {
    const min: V3 = [Infinity, Infinity, Infinity];
    const max: V3 = [-Infinity, -Infinity, -Infinity];
    for (const p of m.collider) {
      const q = add(rotate(rotation, p), at);
      for (let k = 0; k < 3; k++) {
        min[k] = Math.min(min[k], q[k]);
        max[k] = Math.max(max[k], q[k]);
      }
    }
    return { min, max };
  };
  const overlaps = (a: { min: V3; max: V3 }, b: { min: V3; max: V3 }) => [0, 1, 2].every((k) => a.min[k] < b.max[k] - 0.02 && a.max[k] > b.min[k] + 0.02);
  const put = (name: string, at: V3, rotation: Q, material: string, tint?: number): Piece | null => {
    const m = models[name];
    if (!m) return null;
    const b = bounds(m, at, rotation);
    if (taken.some((t) => overlaps(b, t)) || fixed.some((p) => overlaps(b, p.bounds))) return null;
    taken.push(b);
    return d.addProp({ model: m, material, position: at, rotation, tint });
  };
  const drum = (x: number, z: number, y = 0) => put('drum', [x + (rand() - 0.5) * 0.06, y, z + (rand() - 0.5) * 0.06], yaw(rand() * Math.PI * 2), 'drum', PAINTS[Math.floor(rand() * PAINTS.length)]);

  // Vehicles: a forklift facing the half-open door, another parked at the lane's edge (out of the
  // view down it to the sea); tractors in the truck lane and south of Block B
  put('forklift', [-18.5, 0, 4.5], yaw(Math.PI), 'steel');
  put('forklift', [10.6, 0, -7], yaw(0), 'steel');
  put('yard_tractor', [-14, 0, -4], yaw(-Math.PI / 2), 'steel');
  put('yard_tractor', [20, 0, 18], yaw(Math.PI / 2), 'steel');

  // Drums: a row by the bund, a group on the pallet area, four in the open box's mouth, four by the warehouse's east wall
  for (let i = 0; i < 4; i++) for (const z of [-9.1, -8.4]) drum(19 + i * 0.72, z);
  for (const [x, z] of [
    [-31.5, 2.6],
    [-30.8, 2.6],
    [-31.15, 1.88],
    [-24.2, 6.4],
    [-23.5, 6.6],
    [-20.4, 2.4],
  ])
    drum(x, z);
  // Inside the open box, on its floor
  for (const x of [-10.05, -10.75]) for (const z of [3.95, 4.85]) drum(x, z, 0.16);
  for (const z of [12.2, 12.9, 14.6, 15.3]) drum(-9.25, z);
  // Three on their sides
  put('drum', [-26.8, 0.291, 1.6], LYING, 'drum', PAINTS[1]);
  put('drum', [17.8, 0.291, -7.6], LYING, 'drum', PAINTS[3]);
  put('drum', [7.2, 0.291, 10.8], multiply(yaw(0.6), LYING), 'drum', PAINTS[4]);

  // Cable reels on their rims
  put('reel', [-33, 0, 5.8], yaw(0.2), 'wood');
  put('reel', [-28.3, 0, 6.5], yaw(-0.3), 'wood');
  put('reel', [0, 0, -25], yaw(1.1), 'wood');
  put('reel', [-2.6, 0, 9.4], yaw(0.5), 'wood');
}
