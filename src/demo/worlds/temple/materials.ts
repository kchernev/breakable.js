// The sanctuary's materials: weathered marble (and the older, weaker marble of the ruin), the
// frieze's triglyphs, poros limestone, terracotta tiles, old cedar timber, bronze, and the trees'
// leaves and bark; and the breakable ground's: the court's marble flags and the rubble under them,
// the hilltop's earth and the rock under it. Textures from the world's pack
// (public/packs/temple/textures): made for it, or Poly Haven (CC0).

import { abs, atan, color, float, floor, fract, fwidth, materialColor, max, min, mix, mx_noise_float, positionWorld, select, sin, smoothstep, step, texture, time, uv, vec2, vec3, vec4 } from 'three/tsl';
import * as THREE from 'three/webgpu';
import { type BreakableMaterial, groundPresets, material, type MaterialOptions, pieceFrame, pieceState, presets } from '../../../lib/index.ts';
import { texture as mapOf, inside, textured } from '../../textures.ts';
import { bedrock, landLook, rockFace, soilFace } from './land.ts';

const base = 'packs/temple/textures/';

type Float = THREE.Node<'float'>;

/**
 * How far a point on a block's face is from that face's edges (m), in its piece's frame, which its
 * cells keep: a cell shows the margin where it has its block's face. Large on broken faces.
 */
function edgeDistance(): Float {
  const { position, normal, halfExtents } = pieceFrame();
  // The face's own axis left out: its edges are along the other two
  const gap = halfExtents.sub(position.abs()).add(normal.abs().mul(10));
  return gap.x.min(gap.y).min(gap.z).add(pieceState().broken.mul(10));
}

/**
 * A drafted margin: the stone a little darker in a band round each face of a block (its tooled
 * edge, and the dirt in the joint), so courses and joints read from afar.
 */
function drafted(m: THREE.MeshStandardNodeMaterial, width: number, dark: number): THREE.MeshStandardNodeMaterial {
  const f = mix(float(dark), float(1), smoothstep(0, width, edgeDistance()));
  m.colorNode = materialColor.mul(vec4(vec3(f), 1));
  return m;
}

/**
 * A triglyph's face: two vertical grooves and a half groove at each edge, stopping short of the
 * top band; the grooves shaded as V-cuts (one side in shade). Not on its top, bottom or breaks.
 */
function triglyph(m: THREE.MeshStandardNodeMaterial): THREE.MeshStandardNodeMaterial {
  const { position: p, normal, halfExtents: half } = pieceFrame();
  const an = normal.abs();
  // An upright face of the block; across it, the horizontal axis that isn't the normal's
  const front = select(an.y.lessThan(0.5), float(1), float(0)).mul(pieceState().broken.oneMinus());
  const across = select(an.x.greaterThan(0.5), p.z, p.x);
  const width = select(an.x.greaterThan(0.5), half.z, half.x);
  // Groove centres at ±1/6 of the width from the middle, and half grooves at the edges
  const w = width.mul(2);
  const groove = (c: Float) => smoothstep(w.mul(0.085), w.mul(0.045), across.sub(c).abs());
  const inner = max(groove(w.div(6)), groove(w.div(-6)));
  const edges = smoothstep(width.sub(w.mul(0.05)), width.sub(w.mul(0.01)), across.abs());
  const below = smoothstep(half.y.sub(0.07), half.y.sub(0.1), p.y);
  const cut = max(inner, edges).mul(below).mul(front);
  // One wall of each groove lit, the other in shade: by which side of its centre
  const side = across.sub(across.div(w.div(3)).round().mul(w.div(3))).sign();
  const shade = mix(float(0.5), float(0.72), side.mul(0.5).add(0.5));
  m.colorNode = materialColor.mul(vec4(vec3(mix(float(1), shade, cut)), 1));
  return m;
}

/**
 * Bronze, weathered: dark polished metal, the environment in it; verdigris only where rain has
 * run, in streaks hanging down from the top of each plate and frame (noise stretched along the
 * map's v, which runs up every upright face) and in a band low down where the splash reaches; the
 * raised edges rubbed a little brighter.
 */
function bronze(): THREE.MeshStandardNodeMaterial {
  const m = new THREE.MeshStandardNodeMaterial();
  const { position: local, halfExtents: half } = pieceFrame();
  const p = uv();
  // How far down from the top of its piece, so streaks hang from rails, heads and rims
  const below = half.y.sub(local.y);
  const streak = smoothstep(0.55, 0.8, mx_noise_float(vec3(p.x.mul(9), p.y.mul(0.35), 1.7)).mul(0.5).add(0.5));
  const hang = smoothstep(1.1, 0.0, below);
  // The splash band, its top edge ragged, in patches along it
  const band = smoothstep(1.75, 1.05, positionWorld.y.add(mx_noise_float(vec3(p.x.mul(2.5), 0.4, 3.1)).mul(0.25)));
  const patchy = smoothstep(-0.35, 0.45, mx_noise_float(vec3(p.x.mul(3.3), p.y.mul(2.2), 7.7)));
  const green = max(streak.mul(hang), band.mul(patchy)).mul(0.85);
  // The metal a little darker or brighter from plate to plate and with handling
  const tone = mx_noise_float(vec3(p.x.mul(1.5), p.y.mul(1.5), 4.2)).mul(0.18).add(1);
  const metal = vec3(0.2, 0.12, 0.05).mul(tone);
  const verdigris = vec3(0.17, 0.27, 0.22);
  const worn = smoothstep(0.03, 0.0, edgeDistance()).mul(0.5);
  m.colorNode = mix(mix(metal, verdigris, green), vec3(0.5, 0.34, 0.17), worn);
  m.metalnessNode = mix(float(0.9), float(0.15), green);
  m.roughnessNode = mix(mix(float(0.33), float(0.8), green), float(0.26), worn);
  return m;
}

/**
 * The column drums' marble: the same stone, its specks and bumps softer (at 2 m on a curved drum
 * the map's dark specks read as granite), and twenty flutes round each drum's axis (its frame's y:
 * kit.ts turns every drum of a column alike, so they run on from drum to drum), shaded in the
 * channels and bright on the arrises at the polygon's corners. Only on the shaft's sides: not on
 * the echinus's flare, the beds or breaks.
 */
function drumMarble(): THREE.MeshStandardNodeMaterial {
  const m = textured('temple_marble', { base, color: 0xf4efe4, normalScale: 0.8, roughness: 0.85 });
  // The map's mean colour (linear), times the material's: specks pulled halfway toward it
  const c = new THREE.Color(0xf4efe4);
  const mean = vec3(c.r * 0.723, c.g * 0.715, c.b * 0.676);
  const { position, normal } = pieceFrame();
  const side = smoothstep(0.3, 0.15, normal.y.abs()).mul(pieceState().broken.oneMinus());
  // 1 on an arris, -1 down the middle of a channel
  const round = atan(position.z, position.x).mul(20).cos();
  const flute = mix(float(0.84), float(1.03), smoothstep(-0.9, 0.8, round)).add(smoothstep(0.93, 1, round).mul(0.05));
  m.colorNode = vec4(mix(mean, materialColor.rgb, 0.55).mul(mix(float(1), flute, side)), 1);
  return m;
}

/**
 * Charred wood smouldering on the altar: dark, with embers glowing in its cracks, slowly breathing.
 * It glows only while it lies there (BreakableMaterial.glow): knocked loose, it goes out.
 */
function embers(): THREE.MeshStandardNodeMaterial {
  const m = new THREE.MeshStandardNodeMaterial({ roughness: 0.95 });
  const p = positionWorld;
  // Thin cracks, the glow down in them
  const cracks = smoothstep(0.6, 0.78, mx_noise_float(p.mul(11)).mul(0.5).add(0.5));
  const breath = mx_noise_float(vec3(p.x.mul(2), time.mul(0.6), p.z.mul(2))).mul(0.4).add(0.7);
  m.colorNode = mix(vec3(0.03, 0.026, 0.024), vec3(0.08, 0.065, 0.055), mx_noise_float(p.mul(23)).mul(0.5).add(0.5));
  m.emissiveNode = vec3(1, 0.22, 0.03).mul(cracks.mul(breath).mul(2.5));
  return m;
}

/** A hash of two numbers, 0..1. */
const hash = (a: Float, b: Float) => fract(sin(a.mul(127.1).add(b.mul(311.7))).mul(43758.5453));

/** The court's marble: warmer and duller than the temple's, worn by feet and dusty; its map at the temple's scale. */
const FLAG = 0xe2d8c8;
const FLAG_SCALE = 0.83;
/** The court's courses run along x, 1.2 m wide (a joint either side of the temple's axis, z -4); flags 1.2..2 m long. */
const COURSE = 1.2;
const FLAG_LENGTH = 1.6;
/** The sacred olive in the court (`OLIVES` in trees.ts): a square of earth round its trunk (x, z, half its side). */
const OLIVE_BED = { x: 27, z: -8, half: 0.9 };

/**
 * The court's top: marble flags in courses along x, each course's joints shifted from the next
 * one's, each flag its own patch of the stone and its own shade, a dark hairline in the joints and
 * a band of dust and wear beside them; a square of earth round the olive's trunk. Painted from
 * where the point was laid (the layer maps from the world's origin, at FLAG_SCALE), so the joints
 * stay on the chunks a blast throws. Its other faces are plain marble.
 */
function flags(): THREE.MeshStandardNodeMaterial {
  const m = textured('temple_marble', { base, color: FLAG, normalScale: 0.8, roughness: 0.9 });
  const u = uv();
  const x = u.x.div(FLAG_SCALE);
  const z = u.y.div(-FLAG_SCALE);
  const rz = z.add(4 + COURSE / 2).div(COURSE);
  const course = floor(rz);
  const across = float(0.5).sub(abs(fract(rz).sub(0.5))).mul(COURSE);
  // Along a course: joint k at about k flag lengths, moved by up to a quarter of one either way
  const shift = hash(course, float(7.31)).mul(FLAG_LENGTH);
  const k = floor(x.sub(shift).div(FLAG_LENGTH));
  const joint = (q: Float) => q.add(hash(course, q).sub(0.5).mul(0.5)).mul(FLAG_LENGTH).add(shift);
  const a = joint(k);
  const b = joint(k.add(1));
  const flag = k.add(step(b, x)).sub(step(x, a));
  // The olive's bed, and how far from its edge
  const bed = max(abs(x.sub(OLIVE_BED.x)), abs(z.sub(OLIVE_BED.z))).sub(OLIVE_BED.half);
  const d = min(min(min(abs(x.sub(a)), abs(x.sub(b))), across), abs(bed));
  const h1 = hash(flag, course.add(0.37));
  const h2 = hash(course.mul(1.31), flag.add(5.17));
  const stone = texture(m.map!, u.add(vec2(h1, h2).mul(5))).rgb.mul(color(FLAG));
  // Dust and weather over the court in broad patches, a little darker and more ochre
  const dust = smoothstep(-0.3, 0.5, mx_noise_float(vec3(x.mul(0.12), z.mul(0.12), 3.7)));
  const shade = mix(vec3(1.02, 0.99, 0.94), vec3(0.95, 0.96, 0.98), h2).mul(h1.mul(0.16).add(0.84)).mul(mix(vec3(1), vec3(0.9, 0.86, 0.78), dust));
  // A hairline (no thinner than a pixel, so it doesn't shimmer far off) and a band either side
  const line = smoothstep(0.002, fwidth(d).add(0.006), d);
  const band = mix(float(0.8), float(1), smoothstep(0.006, 0.05, d));
  const paved = stone.mul(shade);
  const earth = texture(mapOf('temple_ground_diff', true, base), vec2(x, z.negate()).mul(0.25)).rgb.mul(vec3(0.9, 0.82, 0.68));
  const top = mix(paved, earth, step(bed, 0)).mul(band).mul(mix(float(0.4), float(1), line));
  m.colorNode = vec4(mix(materialColor.rgb, top, step(0.5, pieceFrame().normal.y)), 1);
  return m;
}

/**
 * The hilltop's earth: its top the land it was cut from (the land's own look, from where it was
 * laid: the layer maps from the world's origin, a metre a unit), so it runs on into the land round
 * it with no seam; its sides, as a crater shows them, the terra rossa under the grass.
 */
function earth(): THREE.MeshStandardNodeMaterial {
  const m = new THREE.MeshStandardNodeMaterial({ roughness: 0.95 });
  const u = uv();
  const up = step(0.5, pieceFrame().normal.y);
  const land = landLook(vec3(u.x, 0, u.y.negate()), vec3(0, 1, 0));
  m.colorNode = mix(soilFace(u), land.color, up);
  m.roughnessNode = mix(float(0.95), land.roughness, up);
  return m;
}

/** The rock under the earth: bare bedrock on top (a crater's floor), the cliffs' rock in its sides. */
function rock(): THREE.MeshStandardNodeMaterial {
  const m = new THREE.MeshStandardNodeMaterial({ roughness: 0.9 });
  const u = uv();
  m.colorNode = mix(rockFace(u), bedrock(vec3(u.x, 0, u.y.negate())), step(0.5, pieceFrame().normal.y));
  return m;
}

/**
 * Leaves: what a blast reaches goes as a spray of leaves (pieces under 1 m are particles), and a
 * mass that falls whole bursts into leaves where it lands (index.ts). `uvScale`: their size.
 */
function leaves(uvScale: number): MaterialOptions {
  return {
    density: 0.25,
    support: 80,
    compression: 20,
    strength: 2.5e3,
    impact: 1,
    fragmentSize: 0.6,
    minSize: 0.6,
    dustSize: 0.45,
    minBodySize: 1.0,
    maxPieces: 3,
    friction: 0.9,
    rubbleLife: 2.5,
    surface: textured('temple_foliage', { base, roughness: 0.9 }),
    uvScale,
    uvJitter: 1,
    inside: 0x3d5228,
    insideMap: 0.5,
  };
}

export function templeMaterials(): Record<string, BreakableMaterial> {
  const brokenMarble = inside('temple_marble_broken', 1.67, { base });
  const marbleBase = {
    density: 2.7,
    support: 8,
    compression: 300,
    // Dry-laid: a falling section's joints hold it together in the air, and give as soon as it
    // rests on anything, so it comes apart block by block instead of hanging off a corner
    strength: 50,
    impact: 40,
    // Big fragments, few of them: drums land as drums and blocks as blocks, not as a field of cubes
    fragmentSize: 0.6,
    minSize: 0.32,
    dustSize: 0.26,
    maxPieces: 11,
    // Thrown bits smaller than this go as particles: a big collapse stays within its piece budget
    minBodySize: 0.16,
    friction: 0.6,
    rubbleLife: 12,
    uvScale: 0.83,
    // Each block shows its own patch of the stone
    uvJitter: 1,
    inside: 0xf6f2ea,
    insideTexture: brokenMarble,
  };
  // A little glossier than the map says, and its bumps stronger: the column facets catch the light
  const marble = () => textured('temple_marble', { base, color: 0xf4efe4, normalScale: 1.15, roughness: 0.85 });
  return {
    marble: presets.concrete({ ...marbleBase, surface: drafted(marble(), 0.012, 0.8) }),
    // Column drums and capitals: the marble, softer, its grain larger
    drum: presets.concrete({ ...marbleBase, maxPieces: 3, uvScale: 0.6, surface: drumMarble() }),
    // The frieze's triglyphs: the same marble, grooved
    triglyph: presets.concrete({ ...marbleBase, surface: triglyph(marble()) }),
    // The stoa's: older, cracked, with an ochre patina; it gives way far sooner
    ruin: presets.concrete({ ...marbleBase, support: 5, compression: 200, strength: 30, impact: 25, surface: drafted(textured('temple_marble', { base, color: 0xeadcc2, normalScale: 1.1 }), 0.015, 0.78) }),
    limestone: presets.brick({
      density: 2.2,
      support: 12,
      compression: 120,
      strength: 50,
      impact: 30,
      fragmentSize: 0.36,
      minSize: 0.14,
      dustSize: 0.22,
      // A block breaks in a few big pieces: a wall comes down as blocks and halves, within budget
      maxPieces: 4,
      minBodySize: 0.18,
      friction: 0.75,
      rubbleLife: 15,
      surface: drafted(textured('temple_limestone', { base }), 0.022, 0.66),
      // Coarse: the pores and shells at 2..3 cm
      uvScale: 0.4,
      uvJitter: 1,
      inside: 0xd8c49c,
      insideTexture: inside('temple_marble_broken', 1.4, { base }),
    }),
    terracotta: material({
      density: 1.9,
      friction: 0.7,
      support: 18,
      compression: 40,
      strength: 25,
      impact: 4,
      shatter: true,
      reach: 1.4,
      fragmentSize: 0.28,
      minSize: 0.07,
      // Shards (a third of a panel, 0.28 m) count as small rubble, cleared after rubbleLife
      dustSize: 0.15,
      minBodySize: 0.12,
      maxPieces: 6,
      rubbleLife: 5,
      // A panel weighs 0.12: light, but fired clay breaks where it lands
      landing: 4,
      surface: textured('temple_roof_tiles', { base, normalScale: 1.2, ao: 1 }),
      uvScale: 0.4545,
      inside: 0xc4724a,
      insideMap: 0.2,
    }),
    // Pegged and lapped, a frame carries far more across its joints than dry stone does: losing a
    // corner of the colonnade tears the roof there, without the load moving round the frame
    // bringing all of it down
    timber: presets.wood({ density: 0.65, support: 600, impact: 25, surface: textured('rough_wood', { base, color: 0xb09070, roughness: 1.5 }), uvScale: 1.2, uvJitter: 1, inside: 0xc8a47a }),
    bronze: presets.metal({ density: 8.5, impact: 150, plastic: { yieldStress: 1.5e4, bend: 1.4 }, minSize: 0.5, surface: bronze(), inside: 0xc89a5a }),
    foliage: material(leaves(0.7)),
    // The cypresses' scale-like sprays: the same leaves, smaller
    cypress: material(leaves(1.5)),
    // Tough, and a blast reaches it less far than the rest: a hit in the crown strips the leaves
    // and the limbs, and the trunk stands
    bark: presets.wood({ density: 0.8, support: 200, strength: 6e4, impact: 60, reach: 0.55, fragmentSize: 0.25, minSize: 0.1, surface: textured('bark_willow_02', { base }), uvScale: 0.9, uvJitter: 1, inside: 0xd8c49a }),
    // The offering smouldering on the altar: out once it's knocked off
    embers: material({ density: 0.5, support: 40, strength: 500, impact: 2, fragmentSize: 0.2, minSize: 0.08, dustSize: 0.12, minBodySize: 0.12, maxPieces: 3, friction: 0.8, rubbleLife: 6, surface: embers(), uvScale: 1, inside: 0x2a221c, glow: 'standing' }),
    // The breakable ground (ground.ts). Its surfaces read where they were laid from their texture
    // coordinates, so: no uvJitter, and the earth and rock at a metre a unit
    // A blast lifts the flags a little further round it than the preset's; what it breaks smaller
    // than a quarter metre goes as chips, not as plates that land back in the hole on edge
    paving: groundPresets.paving({ reach: 0.45, minBodySize: 0.25, surface: flags(), uvScale: FLAG_SCALE, inside: 0xf6f2ea, insideTexture: brokenMarble }),
    // Rubble in lime: what a blast or a bullet reaches goes as a spray of chips and grit, not as lumps
    // that fall back into the hole and plug it; what's beyond its reach stands, however small, so a
    // crater's sides hold
    fill: groundPresets.fill({ maxPieces: 16, minBodySize: 0.75, keepSmall: true, surface: textured('temple_fill', { base }), uvScale: 1, inside: 0xf2ece4, insideTexture: inside('temple_fill', 1.3, { base }) }),
    // Dry: a blast reaches it a little further than the preset's, and most of what it reaches flies
    // as a spray of soil (cells under 0.6 m, out of 20 a slab), the few clods crumbling where they
    // land; the rest of the slab stands whole round the hole, however small its cells
    earth: groundPresets.earth({ reach: 0.45, maxPieces: 20, minBodySize: 0.6, keepSmall: true, landing: 2, surface: earth(), uvScale: 1, inside: 0xf0e6dc, insideTexture: inside('temple_earth', 1, { base }) }),
    // Limestone: hard (a blast reaches it less far than the earth over it), breaking in chunks
    rock: groundPresets.paving({ density: 2.5, friction: 0.8, impact: 80, reach: 0.25, fragmentSize: 0.4, minSize: 0.2, minBodySize: 0.2, maxPieces: 10, surface: rock(), uvScale: 1, inside: 0xd8ccb8, insideTexture: inside('temple_marble_broken', 1.2, { base }) }),
  };
}
