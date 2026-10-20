// The street's materials: the library's presets with Poly Haven textures (CC0) and ones made for it
// (gen_*: GPT Image 2.5, made seamless by scripts/assets), all in public/textures, and the looks of
// the street (painted frames, lamps, leaves, terracotta, the curb, the manhole covers).

import { abs, color, dFdx, dFdy, float, floor, fract, fwidth, hash, length, luminance, materialColor, mix, smoothstep, step, texture, uv, vec2, vec3, vec4 } from 'three/tsl';
import * as THREE from 'three/webgpu';
import { type BreakableMaterial, groundPresets, material, pieceFrame, presets, type V3 } from '../../../lib/index.ts';
import { inside, textured } from '../../textures.ts';
import { STREET } from './city.ts';

/** Where the road's map is laid from (its corner): the slabs' and the drawn road's past them line up. */
export const ROAD_MAP: V3 = [-130, STREET.road, STREET.halfRoad];
/** The earth under the asphalt and the flags: Poly Haven's rocky_trail_02 (CC0, 2 m; Market Town's too), greyed to a city's fill. */
export const EARTH = 'packs/nyc/textures/';
export const EARTH_TINT = 0xa8a49c;

/**
 * The sidewalk map's colour and roughness at `at` (its uv, in tiles of 2 × 2 flags, the joints on
 * the half tiles), each flag its own: one of the tile's four, turned or mirrored its own way and a
 * shade lighter or darker (by which flag it is), so no two show the same stains in the same place.
 * The normal map (grain and joints, alike in all four) is left as laid. Sampled with the uv's own
 * gradients, turned with it: across a joint the uv jumps, which would pick the smallest mip there.
 */
export function flagged(m: THREE.MeshStandardNodeMaterial, at: THREE.Node<'vec2'>): { color: THREE.Node<'vec3'>; roughness: THREE.Node<'float'> } {
  const g = at.mul(2);
  const id = floor(g);
  const f = fract(g);
  // (Turned by weights of 0 or 1, not select(): that's an if/else, and one inside another's branch
  // left its result unset in the other branch, smearing those flags into streaks)
  const seed = id.x.add(256).add(id.y.add(256).mul(512)).mul(4);
  const turn = floor(hash(seed).mul(8));
  const swap = turn.mod(2);
  const flip = vec2(floor(turn.div(2)).mod(2), floor(turn.div(4)));
  const across = mix(f, f.yx, swap);
  const local = flip.sub(across).abs();
  const turned = (d: THREE.Node<'vec2'>) => mix(d, d.yx, swap).mul(flip.mul(-2).add(1));
  const quarter = floor(hash(seed.add(1)).mul(4));
  const uvs = vec2(quarter.mod(2), floor(quarter.div(2))).add(local).mul(0.5);
  const [dx, dy] = [turned(dFdx(at)), turned(dFdy(at))];
  const shade = hash(seed.add(2)).mul(0.1).add(0.95);
  return {
    color: texture(m.map!, uvs).grad(dx, dy).rgb.mul(color(m.color)).mul(shade),
    roughness: texture(m.roughnessMap!, uvs).grad(dx, dy).g.mul(m.roughness),
  };
}

/**
 * The sidewalk's flags (the map's 2 × 2 flags at 4 m: a flag a slab, its joints on their seams,
 * each flag its own: flagged), and the curb painted along the road edge, where each side's frame
 * starts (z from its curb): a granite strip with a joint behind it and a steel-faced edge, on the
 * face down to the road too, so it goes with the chunks a blast throws.
 */
function sidewalkSurface(): THREE.MeshStandardNodeMaterial {
  const m = textured('gen_sidewalk', { color: 0xe4e0d8, normalScale: 0.6 });
  const flag = flagged(m, uv());
  m.roughnessNode = flag.roughness;
  const { position, normal, halfExtents } = pieceFrame();
  const from = position.z.add(halfExtents.z);
  const top = step(0.5, normal.y);
  const face = step(0.5, normal.z.negate()).mul(step(from, 0.01));
  const strip = top.mul(step(from, 0.24)).max(face);
  const joint = top.mul(smoothstep(0.205, 0.215, from)).mul(smoothstep(0.225, 0.235, from).oneMinus());
  const steel = top.mul(step(from, 0.03)).max(face.mul(step(halfExtents.y.sub(0.04), position.y)));
  const granite = flag.color.mul(vec3(0.58, 0.6, 0.64));
  m.colorNode = mix(mix(mix(flag.color, granite, strip), granite.mul(0.45), joint), color(0x3e3c3a), steel);
  return m;
}

/**
 * A manhole cover's cast iron, by where on the disc a point is (pieceFrame, its middle at the
 * axis): a raised grid of diamonds worn bright by the tyres inside a groove, and the rim.
 */
function manholeSurface(): THREE.MeshStandardNodeMaterial {
  // The painted iron's map for its grain and rust, lifted from black paint to bare cast iron
  const m = textured('gen_iron_painted');
  const { position, normal } = pieceFrame();
  const r = length(position.xz);
  // Diamonds on a 5 cm grid, faded out where they'd shimmer (far off)
  const g = vec2(position.x.add(position.z), position.x.sub(position.z)).mul(14);
  const f = fract(g).sub(0.5).abs();
  const w = fwidth(g.x).max(1e-4);
  const raised = smoothstep(w.negate().add(0.36), 0.36, f.x.max(f.y)).oneMinus().sub(0.5).mul(smoothstep(0.3, 1, w).oneMinus()).add(0.5);
  const field = step(r, 0.315);
  const groove = step(0.315, r).mul(step(r, 0.338)).add(step(0.15, r).mul(step(r, 0.165)));
  const shade = mix(mix(float(1.3), mix(float(0.55), float(1.7), raised), field), float(0.4), groove);
  const top = step(0.5, normal.y);
  // (Its rust toned down: on a cover in the road it's mostly worn off)
  const iron = mix(vec3(luminance(materialColor.rgb)), materialColor.rgb, 0.45);
  m.colorNode = vec4(iron.mul(mix(float(1), shade, top).mul(3)), 1);
  // Rough, the worn tops less so (a smooth cover lies white in the road against the sky)
  m.roughnessNode = mix(float(0.95), float(0.72), raised.mul(field).mul(top));
  return m;
}

/**
 * The road's asphalt, with the double yellow down its middle painted on the slabs' top (where on the
 * road a point is: pieceFrame, in the layer's frame), so it goes with the chunks a blast throws. Its
 * other faces (a slab's edge in a crater's wall, a chunk's sides) show the aggregate its broken
 * faces do (`aggregate`, in `tone`, at the same scale): drawn as the top, they came out nearly black
 * in the shade.
 */
function roadSurface(aggregate: { map: THREE.Texture; uvScale?: number }, tone: number, uvScale: number): THREE.MeshStandardNodeMaterial {
  const m = textured('asphalt_03', { color: 0x8a8a8a, normalScale: 0.7 });
  const { position, normal, halfExtents } = pieceFrame();
  // The layer's frame has its middle at the road's: z across it. Two 10 cm lines 24 cm apart, each
  // pixel painted by how much of its breadth they cover: crisp near, thinning out far off (not gone)
  const s = abs(position.z).sub(0.12);
  const w = fwidth(position.z).max(1e-4);
  const line = s.add(w.mul(0.5)).min(0.05).sub(s.sub(w.mul(0.5)).max(-0.05)).div(w).clamp(0, 1);
  const up = step(0.5, normal.y);
  const top = up.mul(step(halfExtents.y.sub(0.01), position.y));
  const sides = texture(aggregate.map, uv().mul((aggregate.uvScale ?? 1) / uvScale)).rgb.mul(color(tone));
  m.colorNode = mix(sides, mix(materialColor.rgb, color(0xd9b23a), line.mul(top)), up);
  return m;
}

/** The fire escapes' grating: painted iron, cut through in bars. */
function grate(): THREE.MeshStandardNodeMaterial {
  const m = textured('gen_iron_painted', { color: 0xb8b8b8 });
  m.alphaMap = grating();
  m.alphaTest = 0.5;
  return m;
}

/** An iron grating's see-through pattern: bars one way, thinner ones across. */
function grating(): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  g.fillStyle = '#000';
  g.fillRect(0, 0, 64, 64);
  g.fillStyle = '#fff';
  for (let i = 0; i < 64; i += 8) g.fillRect(i, 0, 3, 64);
  for (let j = 0; j < 64; j += 32) g.fillRect(0, j, 64, 3);
  // A solid rim, so the pieces' edges read as frames
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.NoColorSpace;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.anisotropy = 8;
  return t;
}

/**
 * Where the surface is red: fired brick, not paint (0–1, from how much redder than blue its texel
 * is for its brightness).
 */
function red(): THREE.Node<'float'> {
  const c = materialColor;
  return smoothstep(0.45, 0.7, c.r.sub(c.b).div(c.r.max(1e-3)));
}

export function demoMaterials(): Record<string, BreakableMaterial> {
  // Brick breaks to crushed fired clay and mortar, toned down, in at most 16 cells a break (28 by
  // default): what a collapse leaves loose is what the solver pays for, and bigger chunks read as
  // well. The maps' occlusion darkens the joints. Its mortar holds what falls together only weakly
  // (the preset's is 44 times as strong), so a front breaks up as it comes down: as strong, it
  // mostly landed in the road as a sheet or in big panels, its window grid whole
  const laid = { inside: 0xc4a596, insideTexture: inside('gen_brick_broken', 1.6), maxPieces: 16, strength: 500 };
  // The asphalt's aggregate: on its broken faces, and on its sides
  const aggregate = inside('gen_concrete_broken', 1.4)!;
  return {
    brick: presets.brick({ surface: textured('brick_wall_005', { normalScale: 1.2, ao: 1 }), ...laid, uvScale: 0.55 }),
    // Dark brown brick, and brick painted cream (their tile is 2 m): its tint is the paint's, and the
    // brick showing through the chips keeps its red
    brickBrown: presets.brick({ surface: textured('gen_brick_brown', { normalScale: 1.1, ao: 1 }), ...laid, uvScale: 0.5 }),
    brickPainted: presets.brick({ surface: textured('gen_brick_painted', { normalScale: 0.9, ao: 1 }), ...laid, uvScale: 0.5, tintMask: red().oneMinus() }),
    // Slabs and partitions are panels of one size: each shows its own patch of the map
    concrete: presets.concrete({ surface: textured('concrete_wall_008', { normalScale: 0.6 }), inside: 0xd8d4cc, insideTexture: inside('gen_concrete_broken', 1.2), uvScale: 0.4, uvJitter: 1, maxPieces: 14 }),
    plaster: material({ density: 1.2, strength: 1.2e4, fragmentSize: 0.4, minSize: 0.14, surface: textured('plastered_wall_02', { color: 0xf2eee6 }), inside: 0xd8d2c8, uvScale: 0.5, uvJitter: 1 }),
    // The pressure carries further than the blast (panes in its reach go to glitter), a pane breaks
    // into a few shards, not a dozen (all glitter, too thin to be bodies: fewer to cut and to draw),
    // and one falling whole breaks where it lands
    glass: presets.glass({
      reach: 5,
      fragmentSize: 0.35,
      maxPieces: 4,
      landing: 2,
      surface: new THREE.MeshStandardNodeMaterial({ color: 0x5d7684, roughness: 0.06, metalness: 0.35, transparent: true, opacity: 0.62 }),
    }),
    painted: material({ density: 0.9, strength: 1.4e4, fragmentSize: 0.25, minSize: 0.12, dustSize: 0.06, maxPieces: 6, surface: new THREE.MeshStandardNodeMaterial({ color: 0xffffff, roughness: 0.55 }), inside: 0xd8d0c4, insideMap: 0 }),
    // Flower pots: they break where they land, into chips
    pot: material({ density: 1.6, strength: 6e3, fragmentSize: 0.08, minSize: 0.05, minBodySize: 0.15, maxPieces: 6, landing: 2.5, rubbleLife: 6, surface: new THREE.MeshStandardNodeMaterial({ color: 0xb5603c, roughness: 0.85 }), inside: 0xc98a68, insideMap: 0 }),
    // Air conditioners: thin painted sheet steel boxes
    sheet: material({ density: 0.5, strength: 1e4, fragmentSize: 0.3, minSize: 0.25, maxPieces: 4, surface: new THREE.MeshStandardNodeMaterial({ color: 0xffffff, roughness: 0.45, metalness: 0.3 }), inside: 0x9a9a98, insideMap: 0 }),
    // Black-painted iron, chipped to rust
    metal: presets.metal({ surface: textured('gen_iron_painted', { color: 0xb8b8b8 }), inside: 0x5a4a40, uvScale: 1 }),
    grate: presets.metal({ surface: grate(), uvScale: 3, minSize: 0.5 }),
    // Weathered boards (the water tanks' staves), their old paint mostly gone: they split along the staves
    wood: presets.wood({ surface: textured('gen_wood_painted', { color: 0xa88a6c }), inside: 0xb89a78, uvScale: 1, grain: { axis: 'v', stretch: 4 } }),
    // The road between the curbs (the breakable ground, laid in index.ts): asphalt breaking to its
    // dark aggregate, over earth
    asphalt: groundPresets.asphalt({ surface: roadSurface(aggregate, 0x9a958e, 0.25), uvScale: 0.25, inside: 0x9a958e, insideTexture: aggregate }),
    earth: groundPresets.earth({ surface: textured('rocky_trail_02', { base: EARTH, color: EARTH_TINT }), uvScale: 0.5, inside: EARTH_TINT, insideTexture: inside('rocky_trail_02', 0.5, { base: EARTH }) }),
    // The sidewalks (laid in index.ts): concrete flags breaking to fractured concrete, over the
    // earth; a blast reaches further into them than into stone flags (the preset's 0.35)
    paving: groundPresets.paving({ surface: sidewalkSurface(), density: 2.3, reach: 0.45, uvScale: 0.25, inside: 0xd0ccc4, insideTexture: inside('gen_concrete_broken', 1.2) }),
    // Cast iron covers: bullets only ring, spark and dent them (at metal's impact, 56 rounds knocked
    // one loose and it slid off as if light); too small to cut, so a blast throws one whole
    manhole: presets.metal({ surface: manholeSurface(), density: 7, impact: 2e4, inside: 0x5a4a40, uvScale: 2 }),
    foliage: material({ density: 0.3, strength: 3e3, fragmentSize: 0.15, minSize: 0.2, dustSize: 0.4, maxPieces: 4, rubbleLife: 6, surface: new THREE.MeshStandardNodeMaterial({ color: 0xffffff, roughness: 0.9 }), inside: 0x4a6a2a, insideMap: 0 }),
    // Lit while it hangs: a lamp knocked down goes dark
    lamp: material({
      density: 0.6,
      strength: 5e3,
      minSize: 0.5,
      dustSize: 0.3,
      maxPieces: 4,
      rubbleLife: 6,
      glow: 'standing',
      surface: new THREE.MeshStandardNodeMaterial({ color: 0xfff4e0, emissive: 0xffd8a0, emissiveIntensity: 6, roughness: 0.4 }),
      inside: 0xe8e0d0,
      insideMap: 0,
    }),
  };
}
