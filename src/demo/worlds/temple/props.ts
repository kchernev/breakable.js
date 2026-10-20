// The props (public/packs/temple/models, each standing on y = 0 and facing -Z): the bronze goddess
// on her base, the marble lions at the foot of the ramp, bronze tripods by the altar and on the
// votive column, amphorae by the stoa, the treasury door, the altar and the tholos. A prop up on
// the structure falls with what it stands on (it wakes when that goes).

import * as THREE from 'three/webgpu';
import type { Destruction, Piece, PropModel, Q, V3 } from '../../../lib/index.ts';
import { multiply, quatFromAxisAngle } from '../../../lib/index.ts';
import { yawQ } from './kit.ts';
import { PLACES } from './layout.ts';

/** Places the props; returns the bronze ones (statue, tripods), which ring when they strike something. */
export function placeProps(d: Destruction, models: Record<string, PropModel>, votiveTop: number, statueTop: number, rand: () => number): Piece[] {
  const bronze: Piece[] = [];
  const put = (name: string, material: string, at: V3, rotation: Q, tint?: THREE.Color) => {
    const m = models[name];
    if (!m) return null;
    const p = d.addProp({ model: m, material, position: at, rotation, tint });
    if (p && material === 'bronze') bronze.push(p);
    return p;
  };
  // Fired clay varies jar to jar: a little redder or paler, lighter or darker
  const clay = () => {
    const v = 0.88 + rand() * 0.2;
    const warm = (rand() - 0.5) * 0.12;
    return new THREE.Color(v * (1 + warm * 0.5), v, v * (1 - warm));
  };
  // The goddess on her base, looking east-south-east down the forecourt
  put('statue', 'bronze', [PLACES.statue.x, statueTop, PLACES.statue.z], yawQ(-1.963));
  // Lions flanking the ramp, facing east
  for (const z of [-8, 0]) put('lion', 'marble', [12.6, 0, z], yawQ(-Math.PI / 2));
  // Tripods by the altar, and one on the votive column (shifted so its feet, not its handles, are centred)
  for (const z of [-8.6, 0.6]) put('tripod', 'bronze', [15.5, 0, z], yawQ(0.4));
  put('tripod', 'bronze', [PLACES.votive.x + 0.07, votiveTop, PLACES.votive.z + 0.035], yawQ(0));
  // Amphorae: three by the stoa, two by the treasury door, one lying by the altar, one by the tholos door
  const amphorae: Array<[number, number, number, number]> = [
    [30.5, 0.3, -23, 0.3],
    [31.2, 0.3, -23.6, 1.9],
    [29.8, 0.3, -24.1, 4.1],
    [9.2, 0, -19.4, 2.2],
    [9.6, 0, -22.8, 5.0],
    [-14, 0, 17.5, 0.8],
  ];
  for (const [x, y, z, a] of amphorae) put('amphora', 'terracotta', [x, y, z], yawQ(a), clay());
  put('amphora', 'terracotta', [18, 0.24, -6.5], multiply(yawQ(0.6), quatFromAxisAngle([1, 0, 0], Math.PI / 2)), clay());
  return bronze;
}
