// The street's props (public/models): cars parked along both curbs, hydrants, litter baskets and
// mailboxes on the sidewalks, each placed where nothing already stands. The sedan's paint takes a
// tint (its model has a paint mask), so one model parks in many colours.

import type { Destruction, PropModel, Q, V3 } from '../../../lib/index.ts';
import { random } from '../../../lib/index.ts';
import { STREET } from './city.ts';

const yaw = (a: number): Q => [0, Math.sin(a / 2), 0, Math.cos(a / 2)];

/** Sedan paints (undefined: the model's own navy). */
const PAINTS = [undefined, 0x1c1d20, 0x8b1e1e, 0x3f6b52, 0xffffff, 0xc8b48a, 0x6e7378];

/** Place the props of `models` that there are (any may be missing). Returns how many were placed. */
export function placeProps(d: Destruction, models: Record<string, PropModel>, seed = 11): number {
  const rand = random(seed);
  // Colours on a stream of their own: the places don't change with them
  const paint = random(seed + 1);
  const pieces = d.all();
  let placed = 0;
  // Where a model would stand, turned by `turn` at `at`: its collider's bounds
  const bounds = (m: PropModel, at: V3, turn: number) => {
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
    return { min, max };
  };
  const taken: Array<{ min: V3; max: V3 }> = [];
  const free = (b: { min: V3; max: V3 }) => {
    const overlaps = (o: { min: V3; max: V3 }) => [0, 1, 2].every((k) => b.min[k] < o.max[k] - 0.02 && b.max[k] > o.min[k] + 0.02);
    return !taken.some(overlaps) && !pieces.some((p) => p.state === 'fixed' && overlaps(p.bounds));
  };
  const put = (name: string, at: V3, turn: number) => {
    const m = models[name];
    if (!m) return false;
    const b = bounds(m, at, turn);
    if (!free(b)) return false;
    const tint = m.tintMask ? PAINTS[Math.floor(paint() * PAINTS.length)] : undefined;
    d.addProp({ model: m, material: 'metal', position: at, rotation: yaw(turn), tint });
    taken.push(b);
    placed++;
    return true;
  };

  // Cars along the curbs, nose to tail with gaps, facing the way the traffic on their side goes
  const cars = ['taxi', 'sedan', 'sedan', 'taxi', 'sedan', 'van'].filter((n) => models[n]);
  for (const side of [1, -1]) {
    let x = -STREET.length / 2 + 3 + rand() * 4;
    while (x < STREET.length / 2 - 4 && cars.length) {
      const name = cars[Math.floor(rand() * cars.length)];
      const length = models[name].collider.reduce((m, p) => Math.max(m, Math.abs(p[2])), 0) * 2;
      if (rand() < 0.75) put(name, [x + length / 2, STREET.road, side * (STREET.halfRoad - 1.15)], side === 1 ? Math.PI / 2 : -Math.PI / 2);
      x += length + 1.2 + rand() * 2.5;
    }
  }
  // On the sidewalks, by the curb, their fronts (-z) to the road
  const furniture: Array<[string, number]> = [
    ['hydrant', 2],
    ['trashcan', 3],
    ['mailbox', 2],
  ];
  for (const [name, count] of furniture) {
    for (let k = 0, tries = 0; k < count && tries < 40; tries++) {
      const side = rand() < 0.5 ? 1 : -1;
      const x = (rand() - 0.5) * (STREET.length - 8);
      if (put(name, [x, 0, side * (STREET.halfRoad + 0.55)], side === 1 ? 0 : Math.PI)) k++;
    }
  }
  return placed;
}
