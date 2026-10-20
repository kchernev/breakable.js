// Breakable ground: a road, a square or a beach laid as slabs over a rectangle, a top layer
// (asphalt, cobbles, sand, paving) over an optional deeper one (earth, gravel, rubble fill), on the
// world's fixed bed under them (its ground body, moved down to the layers' bottom). Slabs are
// pieces like any other: a blast that reaches them breaks them, throws the chunks up and out of
// the crater to land round it (not far: `toss`), and leaves a pit down to what it reached; the gun
// bites into them, and held on one spot digs a pothole. Each slab is held up by what's under it,
// down to the bed, never by the slabs beside it: what's left round a crater stands, and a slab
// undermined falls in. Standing, the layer is seamless: its slabs share faces exactly and map their
// textures in one frame, so the map runs on across the seams; and fixed slabs cost the solver next
// to nothing (they cost pieces and vertices).

import * as THREE from 'three/webgpu';
import type { Destruction, Piece } from './destruction.ts';
import type { TextureFrame } from './fragment-mesh.ts';
import { type BreakableMaterial, material, type MaterialOptions } from './materials.ts';
import { type Box3, type Q, toLocal, type V3 } from './math.ts';

export interface GroundOptions {
  /** The top layer's material (a key of the Destruction's materials): asphalt, cobbles, sand, paving. */
  material: string;
  /** The layer under it, if any: earth, gravel, rubble fill. Without one the top layer lies on the bed. */
  under?: string;
  /**
   * What the bed is (a key of the Destruction's materials, default `under`, else `material`): the
   * floor of a pit through the ground. A bullet striking it strikes as it (its kind, chips, dust and
   * sound): bedrock, sand, packed rubble.
   */
  bed?: string;
  /** What it covers, seen from above: [x0, z0, x1, z1] (world). */
  area: [number, number, number, number];
  /** Its surface's height (default the Destruction's ground). */
  top?: number;
  /** How deep the top layer is (m; default 0.3). */
  depth?: number;
  /** How deep the layer under it is (m; default 0.6). */
  underDepth?: number;
  /** About how wide a slab is (m; default 2): the area is cut into equal slabs nearest this each way. */
  cell?: number;
  /**
   * Where its maps are laid from (default: the area's x0, z0 corner at the top, unturned). Every
   * slab maps its texture in this one frame (on the top, u along x and v along -z), so the map runs
   * on across the seams: give it the frame of a drawn ground beside it to run on into that too.
   */
  textureFrame?: { position: V3; rotation?: Q };
  /** How hard a blast throws its chunks, as a share of how hard it throws anything else (default 0.4): they land round the crater. */
  toss?: number;
  /** Colour multiplying the top layer's. */
  tint?: THREE.ColorRepresentation;
}

/** A breakable ground laid (Destruction.addGround). */
export class Ground {
  /** What it covers, seen from above: [x0, z0, x1, z1]. */
  readonly area: [number, number, number, number];
  /** Its top layer's material, and the one under it (null: none). */
  readonly material: string;
  readonly under: string | null;
  /** What its bed is made of (GroundOptions.bed): a pit's floor. (`bed` is the bed's height.) */
  readonly bedMaterial: string;
  /** Its surface's height. */
  readonly top: number;
  /**
   * The bed's height: the layers' bottom, where they rest on the world's fixed ground. The world
   * moves its ground body's top down to it under the area, and its groundAt gives it there.
   */
  readonly bed: number;
  /** How hard a blast throws its chunks (GroundOptions.toss). */
  readonly toss: number;
  /** The slabs as laid: the top layer's, then the one under it. */
  readonly slabs: Piece[] = [];

  /** @internal Made by Destruction.addGround. */
  constructor(o: { area: [number, number, number, number]; material: string; under: string | null; bedMaterial: string; top: number; bed: number; toss: number }) {
    this.area = o.area;
    this.material = o.material;
    this.under = o.under;
    this.bedMaterial = o.bedMaterial;
    this.top = o.top;
    this.bed = o.bed;
    this.toss = o.toss;
  }

  /** Whether (x, z) is in its area, seen from above, or within `margin` of it. */
  contains(x: number, z: number, margin = 0): boolean {
    const [x0, z0, x1, z1] = this.area;
    return x >= x0 - margin && x <= x1 + margin && z >= z0 - margin && z <= z1 + margin;
  }
}

/** @internal Lay the slabs (Destruction.addGround, which keeps the Ground). */
export function layGround(d: Destruction, o: GroundOptions): Ground {
  const [x0, z0, x1, z1] = o.area;
  if (!(x1 > x0 && z1 > z0)) throw new Error('addGround: the area is empty');
  const bedMaterial = o.bed ?? o.under ?? o.material;
  if (!d.materials[bedMaterial]) throw new Error(`addGround: no material '${bedMaterial}' for the bed`);
  const top = o.top ?? d.ground ?? 0;
  const depth = o.depth ?? 0.3;
  const underDepth = o.under ? (o.underDepth ?? 0.6) : 0;
  const cell = o.cell ?? 2;
  const nx = Math.max(1, Math.round((x1 - x0) / cell));
  const nz = Math.max(1, Math.round((z1 - z0) / cell));
  const sx = (x1 - x0) / nx;
  const sz = (z1 - z0) / nz;
  const frame = { position: o.textureFrame?.position ?? ([x0, top, z0] as V3), rotation: o.textureFrame?.rotation ?? ([0, 0, 0, 1] as Q) };
  const layers = [{ material: o.material, y0: top - depth, y1: top, tint: o.tint }];
  if (o.under) layers.push({ material: o.under, y0: top - depth - underDepth, y1: top - depth, tint: undefined });
  const ground = new Ground({ area: [x0, z0, x1, z1], material: o.material, under: o.under ?? null, bedMaterial, top, bed: top - depth - underDepth, toss: o.toss ?? 0.4 });
  const slabs = ground.slabs;
  for (const { material, y0, y1, tint } of layers) {
    // One frame for the layer, its box the whole layer's (what pieceFrame measures from: the paint
    // of a road's markings goes by where on the road a point is, and stays on the chunks)
    const textureFrame: TextureFrame = { ...frame, box: boxIn(frame, [x0, y0, z0], [x1, y1, z1]) };
    for (let i = 0; i < nx; i++)
      for (let j = 0; j < nz; j++) {
        const p = d.addBox({ material, size: [sx, y1 - y0, sz], position: [x0 + (i + 0.5) * sx, (y0 + y1) / 2, z0 + (j + 0.5) * sz], textureFrame, tint });
        if (p) slabs.push(p);
      }
  }
  // Each slab held up by what's under it, never by what's beside it (its neighbours, a curb or a
  // wall built before it; what's built after doesn't bond to its sides). What stands on it, it holds
  for (const p of slabs) {
    p.ground = ground;
    for (const b of [...p.bonds]) if (Math.abs(b.normal[1]) < 0.7) d.unbond(b);
  }
  return ground;
}

/** The box from `min` to `max` (world) as seen in a frame. */
function boxIn(frame: { position: V3; rotation: Q }, min: V3, max: V3): Box3 {
  const box: Box3 = { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] };
  for (const x of [min[0], max[0]])
    for (const y of [min[1], max[1]])
      for (const z of [min[2], max[2]]) {
        const q = toLocal(frame.position, frame.rotation, [x, y, z]);
        for (let k = 0; k < 3; k++) {
          box.min[k] = Math.min(box.min[k], q[k]);
          box.max[k] = Math.max(box.max[k], q[k]);
        }
      }
  return box;
}

// What every ground material shares: a slab carries whatever stands on it, and what's at rest on it
// stays a while
const groundBase: MaterialOptions = { compression: 400, rubbleLife: 20 };

const surface = (color: number, roughness: number) => new THREE.MeshStandardNodeMaterial({ color, roughness });

/**
 * Starting points for ground materials (pass a `surface` to draw them your way). A blast reaches
 * each as far as `reach` says (a share of its radius): at the demo's 2.3 m a rocket into asphalt
 * over earth leaves a crater about 2 m across and 0.7 m deep, less in paving, more in sand. Hard
 * tops break into chunks; earth, gravel and sand mostly spray (`minBodySize`), raise dust, crumble
 * where their clods land (`landing`) and hold nothing out over a hole (`support`). Their `impact`
 * is over what wreckage or a car landing on them strikes with (asphalt's 30: a car comes down at
 * 15-25), and it's what bullets measure them by (Destruction.shoot: a fresh 2.2 m slab of asphalt
 * takes about 35 rounds of power 1, 6 at the demo's gun's 6, the chunks it leaves a few).
 */
export const groundPresets = {
  asphalt: (o: MaterialOptions = {}): BreakableMaterial =>
    material({ ...groundBase, impact: 30, density: 2.3, friction: 0.85, support: 10, strength: 1.5e4, reach: 0.5, fragmentSize: 0.28, minSize: 0.12, minBodySize: 0.1, dustSize: 0.12, maxPieces: 12, surface: surface(0x3e3d3b, 0.9), inside: 0x4a4642, ...o }),
  /** Setts laid in sand: they come apart where they're joined. */
  cobbles: (o: MaterialOptions = {}): BreakableMaterial =>
    material({ ...groundBase, impact: 30, density: 2.5, friction: 0.8, support: 4, strength: 8e3, reach: 0.45, fragmentSize: 0.22, minSize: 0.1, minBodySize: 0.1, dustSize: 0.1, maxPieces: 18, surface: surface(0x7a776f, 0.85), inside: 0x8a8478, ...o }),
  sand: (o: MaterialOptions = {}): BreakableMaterial =>
    material({ ...groundBase, impact: 12, density: 1.6, friction: 0.9, support: 1, strength: 2e3, reach: 0.65, fragmentSize: 0.4, minSize: 0.2, minBodySize: 0.3, dustSize: 0.35, maxPieces: 12, rubbleLife: 6, surface: surface(0xc8b28a, 1), inside: 0xb89c74, insideMap: 0.6, ...o }),
  /** Stone flags (marble, granite): hard, so a blast breaks less of it. */
  paving: (o: MaterialOptions = {}): BreakableMaterial =>
    material({ ...groundBase, impact: 60, density: 2.7, friction: 0.7, support: 40, compression: 100, strength: 4e4, reach: 0.35, fragmentSize: 0.35, minSize: 0.15, minBodySize: 0.12, dustSize: 0.12, maxPieces: 12, surface: surface(0xd8d4cc, 0.6), inside: 0xe0dcd4, ...o }),
  earth: (o: MaterialOptions = {}): BreakableMaterial =>
    material({ ...groundBase, impact: 15, density: 1.7, friction: 0.9, support: 3, strength: 5e3, reach: 0.34, fragmentSize: 0.3, minSize: 0.2, minBodySize: 0.25, dustSize: 0.3, maxPieces: 16, landing: 3, rubbleLife: 8, surface: surface(0x6a5440, 1), inside: 0x5e4a38, insideMap: 0.6, ...o }),
  gravel: (o: MaterialOptions = {}): BreakableMaterial =>
    material({ ...groundBase, impact: 15, density: 1.9, friction: 0.9, support: 2, strength: 3e3, reach: 0.45, fragmentSize: 0.3, minSize: 0.15, minBodySize: 0.2, dustSize: 0.25, maxPieces: 12, rubbleLife: 8, surface: surface(0x8a8478, 1), inside: 0x7a7468, insideMap: 0.6, ...o }),
  /** Broken stone and brick under paving. */
  fill: (o: MaterialOptions = {}): BreakableMaterial =>
    material({ ...groundBase, impact: 25, density: 2, friction: 0.85, support: 6, strength: 6e3, reach: 0.4, fragmentSize: 0.35, minSize: 0.15, minBodySize: 0.15, dustSize: 0.2, maxPieces: 12, rubbleLife: 12, surface: surface(0x7c7064, 1), inside: 0x6e6458, ...o }),
};
