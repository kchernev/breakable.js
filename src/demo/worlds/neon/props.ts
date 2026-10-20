// The alley's props (public/packs/neon/models): scooters parked in groups at an angle to the
// facades and three on the avenue's curbs, two hawker carts, crate stacks by the shop doors, under
// the bridge and at the slot, loose crates, wheelie bins. Each is placed where nothing stands, as
// Brick Street places its cars. The scooters, crates and bins are one model each, their paint
// tinted per copy (undefined: the model's own).

import type { Destruction, PropModel, Q, V3 } from '../../../lib/index.ts';
import { random } from '../../../lib/index.ts';
import { FRONT } from './layout.ts';

const yaw = (a: number): Q => [0, Math.sin(a / 2), 0, Math.cos(a / 2)];

/** Paint: the scooters' (their own a faded mint), the crates' red (the stacks' other one stays blue), the bins' green. */
const RED = 0xd04848;
const CHARCOAL = 0x50545c;
const POWDER = 0x9cc4f0;
const BUTTER = 0xf8dc78;
const BLUE = 0x3a78e8;
const YELLOW = 0xf8c830;
const GREEN = 0x48b060;
const GREY = 0x8a9096;

/** Place what models there are (any may be missing). Returns how many were placed. */
export function placeProps(d: Destruction, models: Record<string, PropModel>, seed = 21): number {
  const rand = random(seed);
  // (The street's slabs aren't in the way: the props stand on them)
  const pieces = d.all().filter((p) => !p.ground);
  let placed = 0;
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
    const overlaps = (o: { min: V3; max: V3 }) => [0, 1, 2].every((k) => b.min[k] < o.max[k] - 0.01 && b.max[k] > o.min[k] + 0.01);
    return !taken.some(overlaps) && !pieces.some((p) => p.state === 'fixed' && overlaps(p.bounds));
  };
  /** Put `name` at (x, z) turned `turn`, its paint `tint`, nudged about until it fits. */
  const put = (name: string, x: number, z: number, turn: number, material: string, tint?: number, tries = 8): boolean => {
    const m = models[name];
    if (!m) return false;
    for (let k = 0; k < tries; k++) {
      const at: V3 = [x + (k ? (rand() - 0.5) * 0.8 : 0), 0, z + (k ? (rand() - 0.5) * 0.3 : 0)];
      const b = bounds(m, at, turn);
      if (!free(b)) continue;
      d.addProp({ model: m, material, position: at, rotation: yaw(turn), tint });
      taken.push(b);
      placed++;
      return true;
    }
    return false;
  };

  // Scooters in groups, 30 to 40° to the facade, their fronts to the street
  const scooters = [undefined, RED, CHARCOAL, POWDER, RED, BUTTER, CHARCOAL];
  let si = 0;
  const group = (x0: number, n: number, side: 1 | -1) => {
    for (let i = 0; i < n; i++) {
      const turn = (side === 1 ? 0 : Math.PI) + (Math.PI / 2 - (0.55 + rand() * 0.15)) * (rand() < 0.8 ? 1 : -1);
      put('scooter', x0 + i * 1.05, side * (FRONT - 1.05), turn, 'signbox', scooters[si++ % scooters.length]);
    }
  };
  group(-24.2, 2, -1);
  group(-11, 3, 1);
  group(16.6, 2, -1);
  // On the avenue's curbs, fronts to the road: two by the start, one across
  put('scooter', -31.8, 2.6, Math.PI / 2 + 0.45, 'signbox', RED);
  put('scooter', -31.8, 3.7, Math.PI / 2 + 0.5, 'signbox', CHARCOAL);
  put('scooter', -44.6, -4.5, -Math.PI / 2 + 0.4, 'signbox', BUTTER);
  // The carts: S4's serving its +z side to the street, N7's its -z side
  put('cart', -1.0, -2.6, Math.PI, 'signbox');
  put('cart', 24, 2.7, 0, 'signbox');
  // Crate stacks: by shop doors, at the slot's mouth, under the bridge
  const stacks: Array<[number, number, number, number | undefined]> = [
    [-22.2, -FRONT + 0.3, Math.PI, undefined],
    [-15.0, FRONT - 0.3, 0, GREEN],
    [14.6, FRONT - 0.3, 0, YELLOW],
    [-11.75, -FRONT + 0.6, Math.PI / 2, GREEN],
    [7.2, FRONT - 0.3, 0, undefined],
    [8.0, -FRONT + 0.3, Math.PI, YELLOW],
  ];
  for (const [x, z, turn, tint] of stacks) put('crates', x, z, turn, 'awning', tint);
  // Loose crates about the carts and stacks
  const loose: Array<[number, number, number | undefined]> = [
    [0.4, -2.2, undefined],
    [22.6, 2.4, YELLOW],
    [-21.0, -2.9, BLUE],
    [6.5, 2.6, undefined],
    [13.4, 2.9, BLUE],
  ];
  for (const [x, z, tint] of loose) put('crate', x, z, rand() * Math.PI * 2, 'awning', tint);
  // Bins: by the slot, by S8
  put('bin', -12.2, -FRONT + 0.45, Math.PI, 'awning');
  put('bin', 26.5, -FRONT + 0.45, Math.PI, 'awning', GREY);
  put('bin', 27.3, -FRONT + 0.45, Math.PI, 'awning', BLUE);
  return placed;
}
