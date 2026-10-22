// The street's props (public/models): cars parked along both curbs, hydrants, litter baskets and
// mailboxes on the sidewalks, each placed where nothing already stands. A car's paint takes a tint
// (its paint is its own material), so one model parks in many colours. A car that comes apart
// (public/models/cars: the street's Cars) is parked as one; one that doesn't yet, as its prop.

import type { Destruction, PropModel, Q, V3, VehicleModel } from '../../../lib/index.ts';
import { random } from '../../../lib/index.ts';
import type { Cars } from '../../cars.ts';
import { STREET } from './city.ts';

const yaw = (a: number): Q => [0, Math.sin(a / 2), 0, Math.cos(a / 2)];

/**
 * Paints by model (undefined: the model's own): a sedan's (its own silver), a van's (fleet white,
 * silver, dark blue), a sports car's (its own blue); a cab is always a cab's yellow.
 */
const PAINTS: Record<string, Array<number | undefined>> = {
  sedan: [undefined, 0x1c1d20, 0x8b1e1e, 0x2f4a6e, 0xf2f2f0, 0xc8b48a, 0x5d6268, 0x3f6b52],
  van: [undefined, undefined, 0xbfc3c7, 0x1d2a44],
  gt15: [undefined, 0xd81f1f, 0xff7a00, 0x141414, 0xf0f0f0, 0xffcc00],
  taxi: [undefined],
};

/**
 * Place the props of `models` that there are (any may be missing), the cars of `vehicles` as cars
 * that come apart. Returns how many were placed.
 */
export function placeProps(d: Destruction, models: Record<string, PropModel>, cars?: { cars: Cars; vehicles: Record<string, VehicleModel> }, seed = 11): number {
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
    const vehicle = cars?.vehicles[name];
    const m = vehicle?.models.body ?? models[name];
    if (!m) return false;
    const b = bounds(vehicle ? { ...m, collider: vehicle.parts.flatMap((p) => (p.collider ?? p.colliders!.flat()).map(([x, y, z]) => [x + p.pivot[0], y + p.pivot[1], z + p.pivot[2]] as V3)) } : m, at, turn);
    if (!free(b)) return false;
    const paints = PAINTS[name] ?? PAINTS.sedan;
    const tint = m.tintMask ? paints[Math.floor(paint() * paints.length)] : undefined;
    if (vehicle && cars) cars.cars.place(d, vehicle, at, yaw(turn), tint);
    else d.addProp({ model: m, material: 'metal', position: at, rotation: yaw(turn), tint });
    taken.push(b);
    placed++;
    return true;
  };

  // Cars along the curbs, nose to tail with gaps, facing the way the traffic on their side goes
  // (A car that comes apart and has no prop, the sports car, parks too)
  const parked = ['taxi', 'sedan', 'sedan', 'taxi', 'sedan', 'van', 'gt15', 'gt15'].filter((n) => models[n] || cars?.vehicles[n]);
  // Its length, and how far it reaches out to a side (its mirrors), by its colliders
  const reach = (name: string, k: number) => {
    const v = cars?.vehicles[name];
    const qs = v ? v.parts.flatMap((p) => (p.collider ?? p.colliders!.flat()).map((q) => q[k] + p.pivot[k])) : models[name].collider.map((q) => q[k]);
    return Math.max(...qs.map(Math.abs));
  };
  for (const side of [1, -1]) {
    let x = -STREET.length / 2 + 3 + rand() * 4;
    while (x < STREET.length / 2 - 4 && parked.length) {
      const name = parked[Math.floor(rand() * parked.length)];
      const length = reach(name, 2) * 2;
      // (Its mirror a hand's width short of the curb)
      const out = Math.max(1.15, reach(name, 0) + 0.1);
      if (rand() < 0.75) put(name, [x + length / 2, STREET.road, side * (STREET.halfRoad - out)], side === 1 ? Math.PI / 2 : -Math.PI / 2);
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
