// What a breakable thing is made of: how heavy, how strong its bonds are, how it breaks (fine
// near the hit or into even shards), and how it's drawn (a node material, and the colour of its
// broken insides).

import * as THREE from 'three/webgpu';

export interface BreakableMaterial {
  /** Density (the solver's units: water-ish is 1). */
  density: number;
  friction: number;
  /**
   * How hard its bonds hold, per square metre of the face two pieces share (force units of the
   * solver: a 1-density cube a metre on a side weighs 9.81). A bond carries this times its area
   * before it breaks, once the piece it holds has come loose from the structure and is falling.
   */
  strength: number;
  /**
   * How much weight its bonds carry while it stands, per square metre of bond: held sideways or
   * hanging (a bond under its piece, carrying the weight down, carries `compression` times as
   * much). A standing piece's weight goes to the ground along its bonds; a bond asked to carry
   * more breaks, and what it held comes down. Lower makes buildings frailer.
   */
  support: number;
  /** How many times more a bond carries pressed than held sideways (default 40). */
  compression?: number;
  /**
   * How hard a falling piece must strike it (impulse, the solver's units: mass × m/s) to break it.
   * Bullets measure it by this too, with its size (bulletsToBreak: a brick's 25 is the unit).
   */
  impact: number;
  /** Size (m) of the pieces near a break; they grow away from it. */
  fragmentSize: number;
  /** Pieces smaller than this (m, the cube root of the volume) don't break any further. */
  minSize: number;
  /** Pieces up to this size (m) at the heart of a blast turn to dust and are gone. */
  dustSize: number;
  /**
   * Pieces a blast makes or throws that are smaller than this (m, the cube root of the volume)
   * aren't made bodies: they're 'debris' events, for particles (those beyond its reach fall where
   * they were). Many tiny bodies cost the solver more than they show (a pane's shards especially),
   * and are the first to be flung.
   */
  minBodySize: number;
  /**
   * Keep a blast's cells smaller than `minBodySize` beyond its reach standing, as bodies (default
   * false: they fall as 'debris' wherever they are). A pane only partly in reach then keeps its
   * far shards in the frame.
   */
  keepSmall?: boolean;
  /** Most pieces one break makes of one piece. */
  maxPieces: number;
  /** Shatter: break all at once into even shards (glass), not finer around the hit. */
  shatter?: boolean;
  /** How far a blast breaks it, as a share of the blast's radius (glass: the pressure wave carries it further). Default 1. */
  reach?: number;
  /**
   * Bends before it breaks (metal): where two pieces of it are bonded, a section's joint yields at
   * `yieldStress` per m² of the bond and tears once it has bent `bend` radians.
   */
  plastic?: { yieldStress: number; bend: number };
  /**
   * A loose piece of it breaks where it lands when it strikes something with this change of speed
   * or more (m/s), however light it is (a roof tile, a pot). Default: only pieces heavier than
   * Destruction's `heavy` break on landing, past its `shatterSpeed`.
   */
  landing?: number;
  /**
   * Loose pieces of it heavier than this (density × volume) report what they strike as 'impact'
   * events while something listens. Default: Destruction's `audible` (0.02); a light sheet of tin
   * that should be heard needs less.
   */
  audible?: number;
  /**
   * Wood's grain: it splits into long splinters along `axis` of each piece's texture frame ('u',
   * 'v' or 'w': x, y or z of the frame its map is projected in), its fracture cells `stretch` times
   * as long that way as across (e.g. 4).
   */
  grain?: { axis: 'u' | 'v' | 'w'; stretch: number };
  /** Seconds a loose piece smaller than `dustSize`·2 stays once it has settled, before it shrinks away (Infinity: for good). */
  rubbleLife: number;
  /**
   * The drawing: a node material (its colour, map and roughness are used; position and normal are
   * set). A see-through one (glass) is best left writing depth (three's default): with
   * `depthWrite: false`, dust and smoke drifting over a facade fade against its wall but not over
   * its panes, which show as sharp, bright window-shaped patches.
   */
  surface: THREE.NodeMaterial;
  /** The colour of broken faces (multiplies the surface's colour or map). */
  inside: THREE.ColorRepresentation;
  /** How much of the surface's map shows through on broken faces (0: flat inside colour). */
  insideMap?: number;
  /**
   * Broken faces' own maps (crushed brick, fractured concrete with its gravel), tinted by `inside`,
   * at `uvScale` repeats per metre (default 1). Without it, broken faces are `inside` with some of
   * the surface's grain (`insideMap`).
   */
  insideTexture?: { map: THREE.Texture; normalMap?: THREE.Texture; uvScale?: number };
  /**
   * Texture repeats per metre (the map is box-projected in the piece's own frame): one number, or
   * [u, v] for a map whose tile isn't square (a roof's tiles: [1 / 1.2, 1 / 0.8]).
   */
  uvScale: number | [number, number];
  /**
   * How far each piece's map is moved at random, as a share of a tile (0–1; default 0): blocks of
   * one size then don't all show the same patch. A broken piece's cells keep their piece's.
   */
  uvJitter?: number;
  /**
   * How much of a piece's tint each point of the surface takes (1: all, 0: none, so it keeps the
   * surface's colour): a float node (e.g. one minus where rust shows), or a texture whose red
   * channel says, at the surface's texture coordinates. Default: the tint colours it all.
   */
  tintMask?: THREE.Node | THREE.Texture;
  /**
   * 'standing': the surface's emission (its emissive, emissiveMap, emissiveNode) shows only while
   * the piece stands, never on broken faces: a neon tube or a lit window goes dark once knocked
   * loose. Default: it glows as drawn, whatever happens to it.
   */
  glow?: 'standing';
}

export type MaterialOptions = Partial<BreakableMaterial>;

const base: Omit<BreakableMaterial, 'surface' | 'inside'> = {
  density: 1.8,
  friction: 0.7,
  strength: 2.5e4,
  support: 120,
  impact: 25,
  minBodySize: 0.07,
  fragmentSize: 0.35,
  minSize: 0.12,
  dustSize: 0.16,
  maxPieces: 28,
  rubbleLife: 12,
  uvScale: 0.5,
  insideMap: 0.35,
};

/** A material from options over the defaults (a plain grey surface unless one is given). */
export function material(options: MaterialOptions = {}): BreakableMaterial {
  return {
    ...base,
    surface: new THREE.MeshStandardNodeMaterial({ color: 0xb0aca4, roughness: 0.85 }),
    inside: 0x9a948a,
    ...options,
  };
}

/** Starting points for common materials (pass a `surface` to draw them your way). */
export const presets = {
  brick: (o: MaterialOptions = {}) =>
    material({
      support: 35,
      compression: 120,
      density: 1.7,
      strength: 2.2e4,
      fragmentSize: 0.32,
      minSize: 0.11,
      surface: new THREE.MeshStandardNodeMaterial({ color: 0x9c4a36, roughness: 0.9 }),
      inside: 0xa08a78,
      ...o,
    }),
  concrete: (o: MaterialOptions = {}) =>
    material({
      impact: 45,
      support: 100,
      compression: 60,
      density: 2.3,
      strength: 4e4,
      fragmentSize: 0.45,
      minSize: 0.15,
      dustSize: 0.2,
      surface: new THREE.MeshStandardNodeMaterial({ color: 0x9a9890, roughness: 0.92 }),
      inside: 0x8c8880,
      ...o,
    }),
  glass: (o: MaterialOptions = {}) =>
    material({
      impact: 2,
      minBodySize: 0.3,
      support: 30,
      density: 2.5,
      strength: 2e3,
      fragmentSize: 0.12,
      minSize: 0.05,
      dustSize: 0.3,
      maxPieces: 14,
      shatter: true,
      reach: 3,
      rubbleLife: 4,
      surface: new THREE.MeshStandardNodeMaterial({ color: 0x9fc3d0, roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.55 }),
      inside: 0xdff2f8,
      insideMap: 0,
      ...o,
    }),
  wood: (o: MaterialOptions = {}) =>
    material({
      impact: 20,
      support: 150,
      density: 0.7,
      strength: 1.4e4,
      fragmentSize: 0.3,
      minSize: 0.08,
      dustSize: 0.1,
      surface: new THREE.MeshStandardNodeMaterial({ color: 0x8a6440, roughness: 0.8 }),
      inside: 0xc7a27a,
      ...o,
    }),
  metal: (o: MaterialOptions = {}) =>
    material({
      impact: 200,
      minBodySize: 0,
      support: 3000,
      density: 3.5,
      strength: 9e4,
      fragmentSize: 0.6,
      minSize: 0.3,
      dustSize: 0.02,
      maxPieces: 6,
      rubbleLife: Infinity,
      plastic: { yieldStress: 2e4, bend: 1.2 },
      surface: new THREE.MeshStandardNodeMaterial({ color: 0x2c3036, roughness: 0.5, metalness: 0.7 }),
      inside: 0x8d939a,
      ...o,
    }),
};
