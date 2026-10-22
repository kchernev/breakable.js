// The town's materials: honey limestone ashlar, rubble, lime plaster on wattle and daub, oak
// timbers, boards, clay roof tiles that shatter and slide, leaded glass, the bell's bronze, iron,
// the stalls' cloth, hay, the lanterns, and the square's cobbles over packed earth. The maps are
// the world's pack (public/packs/medieval: Poly Haven sets and ones made for it) and two of the
// base pack's.

import { abs, color, float, length, materialColor, min, mix, mx_noise_float, normalWorld, select, smoothstep, step, vec2, vec3 } from 'three/tsl';
import * as THREE from 'three/webgpu';
import { type BreakableMaterial, groundPresets, material, pieceFrame, presets } from '../../../lib/index.ts';
import { inside, textured } from '../../textures.ts';
import { facadeMaterial } from '../../towers.ts';
import { WELL } from './market.ts';
import { COBBLE_MAP, cobbleSurface, earthSurface, houseLook, SETTS_BROKEN, SQUARE } from './scenery.ts';

const base = 'packs/medieval/textures/';

/** Leaded glass: diamond quarries in lead cames, each quarry a little different. */
function leaded(): THREE.MeshStandardNodeMaterial {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d')!;
  g.fillStyle = '#d8dccb';
  g.fillRect(0, 0, 256, 256);
  // Quarries 1/8 of the map wide and 1/5 tall (a map is 1 m at uvScale 1: 12.5 × 20 cm diamonds)
  const [w, h] = [32, 51.2];
  let s = 7;
  const rand = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let j = -1; j <= 5; j++)
    for (let i = -1; i <= 8; i++) {
      const x = i * w + (j % 2 ? w / 2 : 0);
      const y = j * h;
      const k = 200 + rand() * 40;
      g.fillStyle = `rgb(${k * (0.95 + rand() * 0.08)}, ${k}, ${k * (0.82 + rand() * 0.12)})`;
      g.beginPath();
      g.moveTo(x, y - h / 2);
      g.lineTo(x + w / 2, y);
      g.lineTo(x, y + h / 2);
      g.lineTo(x - w / 2, y);
      g.closePath();
      g.fill();
    }
  // The cames: diagonals both ways
  g.strokeStyle = '#1c1a18';
  g.lineWidth = 3;
  for (let i = -8; i <= 16; i++) {
    g.beginPath();
    g.moveTo(i * w, 0);
    g.lineTo(i * w + (256 * w) / (2 * h), 256);
    g.stroke();
    g.beginPath();
    g.moveTo(i * w, 0);
    g.lineTo(i * w - (256 * w) / (2 * h), 256);
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return new THREE.MeshStandardNodeMaterial({ map: t, color: 0x6a7a60, roughness: 0.15, metalness: 0.1, transparent: true, opacity: 0.78 });
}

/** Sharper maps at a glance along a wall (the most the GPU filters). */
function sharp(m: THREE.MeshStandardNodeMaterial): THREE.MeshStandardNodeMaterial {
  for (const t of [m.map, m.normalMap, m.roughnessMap]) if (t) t.anisotropy = 16;
  return m;
}

/**
 * Limestone ashlar: a false bed joint, a centimetre dark line round a block at its mid-height, on
 * blocks a course or more tall and thick (not headstones or copings), so the courses read at about
 * 0.4 m with no more pieces. It goes with the block when it falls, and never along its top.
 */
function ashlar(m: THREE.MeshStandardNodeMaterial): THREE.MeshStandardNodeMaterial {
  const { position, halfExtents } = pieceFrame();
  const block = step(0.325, halfExtents.y).mul(step(0.15, min(halfExtents.x, halfExtents.z)));
  const joint = float(1).sub(smoothstep(0.004, 0.007, abs(position.y))).mul(block);
  m.colorNode = materialColor.mul(float(1).sub(joint.mul(0.5)));
  return m;
}

/**
 * Where on the square a point of its slabs is (world), and the face's way: the slabs' frame is the
 * layer's, its box's middle the square's (pieceFrame), so the look stays on the chunks a blast throws.
 */
function onSlab(): { at: THREE.Node<'vec3'>; normal: THREE.Node<'vec3'>; top: THREE.Node<'float'> } {
  const { position, normal, halfExtents } = pieceFrame();
  const [x0, z0, x1, z1] = SQUARE.area;
  // The top layer's top: its faces turned up at the box's top
  const top = step(0.5, normal.y).mul(step(halfExtents.y.sub(0.01), position.y));
  return { at: position.add(vec3((x0 + x1) / 2, 0, (z0 + z1) / 2)), normal, top };
}

/** The square's setts: the drawn cobbles' look and uvs (upright on a slab's sides); the well's shaft dark in them. */
function setts(): THREE.MeshStandardNodeMaterial {
  const { at, normal, top } = onSlab();
  const m = cobbleSurface(select(abs(normal.y).greaterThan(0.5), at.xz, vec2(at.x.add(at.z), at.y)));
  const shaft = float(1).sub(smoothstep(0.62, 0.64, length(at.xz.sub(vec2(WELL[0], WELL[2]))))).mul(top);
  m.colorNode = mix(m.colorNode as THREE.Node<'vec3'>, color(0x0a0806), shaft);
  return m;
}

/**
 * A woken tree's crown (its tint its green): shaded darker underneath, as the scenery's crowns are
 * (their vertex colours), and mottled in clumps, so the one hull reads as leaves and not a green stone.
 */
function foliage(): THREE.MeshStandardNodeMaterial {
  const m = new THREE.MeshStandardNodeMaterial({ roughness: 0.85 });
  const { position: at } = pieceFrame();
  const shade = smoothstep(-0.8, 0.8, normalWorld.y).mul(0.58).add(0.42);
  const clumps = mx_noise_float(at.mul(0.9)).mul(0.22).add(mx_noise_float(at.mul(3.1)).mul(0.1)).add(1);
  m.colorNode = vec3(shade.mul(clumps));
  return m;
}

export function townMaterials(): Record<string, BreakableMaterial> {
  const broken = inside('medieval_limestone_broken', 1.25, { base });
  const slab = onSlab();
  // Each material needs its own surface (its mesh builds on it)
  const rubbleLook = () => ({
    density: 2.2,
    support: 30,
    strength: 1e3,
    // Falling timber and thrown stone don't break walls (they do roofs)
    impact: 120,
    fragmentSize: 0.32,
    minSize: 0.12,
    // Small: a blast's dust hid what it did for 6–15 s
    dustSize: 0.1,
    maxPieces: 26,
    surface: sharp(textured('castle_wall_slates', { base, normalScale: 1.1 })),
    inside: 0xb8ab94,
    insideTexture: broken,
    uvScale: 0.4,
    // Every block its own patch: one map across a wall repeated its stones every 2.5 m
    uvJitter: 1,
  });
  // Lime-jointed ashlar, weak sideways
  const ashlarLook = () => ({
    density: 2.4,
    support: 45,
    // Joints of a falling section: weak (lime mortar), so a toppling tower breaks up as it bends and lands
    strength: 1.2e3,
    impact: 150,
    fragmentSize: 0.42,
    minSize: 0.15,
    dustSize: 0.1,
    // A fallen tower's blocks break as they land: fewer, bigger pieces each (at 22, and chips of
    // 7 cm as bodies, its collapse left 2,400 pieces loose, most at rest waiting to settle)
    maxPieces: 14,
    minBodySize: 0.1,
    rubbleLife: 20,
    surface: ashlar(sharp(textured('medieval_limestone', { base, normalScale: 0.7, color: 0xf4e8d2 }))),
    inside: 0xe9e1cf,
    insideTexture: broken,
    uvScale: 0.67,
    // Every block its own patch of the map
    uvJitter: 1,
  });
  return {
    // Ashlar walls: stiff when pressed, as the rubble's, so what's left round a hole carries what
    // hung over it (at 12 one rocket at the nave's wall base brought down half its walls and roof),
    // and twice as strong sideways: a block over a hole holds by its side bonds and, tipped, by its
    // bed joints as levers (at 45 the wall over the hole gave way in two blasts of four, a bay of
    // the roof with it)
    limestone: presets.concrete({ ...ashlarLook(), compression: 60, support: 90 }),
    // The church tower's: pressed only a few times stronger than sideways, so reinforce() sets its
    // base near 1.5 times its load and a third of a course gone brings it down
    limestoneTower: presets.concrete({ ...ashlarLook(), compression: 12 }),
    // Rubble walls: stiff when pressed, so a long wall stands on what's left and a breach grows up in a V
    rubble: presets.brick({ ...rubbleLook(), compression: 60 }),
    // The round tower's rubble: it stands alone, and goes when about a third of its base does
    rubbleTower: presets.brick({ ...rubbleLook(), compression: 10 }),
    // Lime plaster on wattle and daub: breaks to brown clay and straw, much of it to dust
    plaster: material({
      density: 1.1,
      support: 25,
      compression: 40,
      // Its joints in a falling frame: weak, so panels drop out when the frame lands (at 6e3 the
      // market hall's upper storey lay propped in the square with every panel in place)
      strength: 600,
      impact: 10,
      fragmentSize: 0.22,
      minSize: 0.09,
      dustSize: 0.07,
      minBodySize: 0.08,
      maxPieces: 14,
      rubbleLife: 8,
      surface: sharp(textured('medieval_limewash', { base, normalScale: 0.8 })),
      inside: 0xc8b090,
      insideTexture: inside('medieval_daub_broken', 1.25, { base }),
      uvScale: 0.5,
      // Panels each their own patch: timbers part them, and one map per wall repeated its marks in a grid
      uvJitter: 1,
    }),
    // The scenery houses' walls, woken (wake.ts): panels a bay wide and a storey high, the facade
    // drawn on them as the scenery's was (each from where it stood). Plaster on its frame, as the
    // breakable houses' panels, a little stronger: a panel stands for its frame and its infill
    house: facadeMaterial(
      houseLook,
      {
        density: 0.9,
        support: 60,
        compression: 40,
        strength: 1500,
        impact: 12,
        fragmentSize: 0.35,
        minSize: 0.15,
        dustSize: 0.07,
        minBodySize: 0.1,
        maxPieces: 10,
        rubbleLife: 8,
        inside: 0xc8b090,
        insideTexture: inside('medieval_daub_broken', 1.25, { base }),
      },
      material,
    ),
    // Their roofs, woken: each half solid from the eaves to the ridge (no rafters under it), so
    // light; tiles on its faces, a dark void and broken tile inside
    roofing: material({
      density: 0.25,
      friction: 0.55,
      support: 60,
      compression: 40,
      strength: 2e3,
      impact: 6,
      fragmentSize: 0.45,
      minSize: 0.2,
      dustSize: 0.08,
      minBodySize: 0.12,
      maxPieces: 8,
      rubbleLife: 10,
      surface: sharp(textured('roof_09', { base })),
      inside: 0x6a4a3a,
      insideTexture: inside('gen_brick_broken', 2),
      uvScale: 0.25,
    }),
    // A tree's crown, woken: light and soft, it bursts into leafy bits
    leaves: material({
      density: 0.08,
      support: 40,
      compression: 40,
      strength: 900,
      impact: 3,
      fragmentSize: 0.8,
      minSize: 0.4,
      dustSize: 0.5,
      minBodySize: 0.35,
      maxPieces: 6,
      rubbleLife: 6,
      surface: foliage(),
      inside: 0x3a5228,
      insideMap: 0,
    }),
    // Pegged oak: jetties cantilever on it, and a falling frame folds before it parts
    oak: presets.wood({
      density: 0.75,
      support: 220,
      strength: 2.2e4,
      impact: 28,
      fragmentSize: 0.35,
      minSize: 0.1,
      dustSize: 0.06,
      minBodySize: 0.06,
      maxPieces: 8,
      rubbleLife: 30,
      surface: sharp(textured('medieval_oak', { base, normalScale: 0.9 })),
      inside: 0xc89a62,
      insideMap: 0.5,
      uvScale: 1,
      // Timbers are laid with the map's grain up their frame's v: they split into splinters along it
      grain: { axis: 'v', stretch: 4 },
    }),
    boards: presets.wood({
      density: 0.6,
      support: 120,
      strength: 1.2e4,
      impact: 14,
      fragmentSize: 0.25,
      maxPieces: 10,
      surface: sharp(textured('old_planks_02', { base })),
      inside: 0xc7a27a,
      uvScale: 0.5,
      uvJitter: 1,
      // The planks run up the map
      grain: { axis: 'v', stretch: 3 },
    }),
    // Pegged clay tiles: anything landing on a roof breaks it, the pieces slide off, and slabs and
    // pots break where they land (whole, they lay on the cobbles as tile-printed boards)
    tile: material({
      density: 1.9,
      friction: 0.55,
      // A blast holes a roof about 3.5 m across; the slabs past that whose rafters went slide off
      reach: 0.5,
      support: 70,
      compression: 60,
      strength: 4e3,
      impact: 6,
      fragmentSize: 0.18,
      minSize: 0.07,
      dustSize: 0.05,
      minBodySize: 0.06,
      // A slab or a pot in a handful of shards
      maxPieces: 6,
      landing: 3,
      rubbleLife: 10,
      surface: sharp(textured('roof_09', { base })),
      inside: 0xc0704a,
      insideTexture: inside('gen_brick_broken', 2),
      uvScale: 0.25,
    }),
    glass: presets.glass({ reach: 2, surface: leaded(), uvScale: 1 }),
    // The bell: a solid hull of about 0.8 t. Rounds only ring it; a blast at it cracks it in a few
    bronze: presets.metal({
      density: 1.6,
      impact: 1e5,
      strength: 1e6,
      support: 1e5,
      minSize: 0.3,
      maxPieces: 4,
      dustSize: 0.01,
      plastic: undefined,
      surface: new THREE.MeshStandardNodeMaterial({ color: 0x9a7440, metalness: 1, roughness: 0.35 }),
      inside: 0xc8a060,
      insideMap: 0,
    }),
    iron: presets.metal({ surface: textured('gen_iron_painted', { color: 0x8a8580 }), inside: 0x5a4a40, uvScale: 1, uvJitter: 1 }),
    cloth: material({
      density: 0.25,
      support: 45,
      strength: 2e3,
      impact: 3,
      fragmentSize: 0.3,
      minSize: 0.25,
      dustSize: 0.5,
      minBodySize: 0.2,
      maxPieces: 4,
      rubbleLife: 8,
      surface: textured('medieval_canvas', { base, normalScale: 0.8 }),
      inside: 0xe8e0d0,
      insideMap: 0.8,
      uvScale: 2,
      uvJitter: 1,
    }),
    hay: material({
      density: 0.15,
      support: 20,
      strength: 1.5e3,
      impact: 2,
      fragmentSize: 0.3,
      minSize: 0.2,
      dustSize: 0.6,
      minBodySize: 0.25,
      maxPieces: 5,
      rubbleLife: 12,
      surface: textured('medieval_hay', { base }),
      inside: 0xd8b860,
      insideMap: 0.8,
      uvScale: 1,
      uvJitter: 1,
    }),
    // Market produce: soft, plain colour (each piece's tint is what it is), bursts when hit
    produce: material({
      density: 0.9,
      support: 20,
      strength: 1e3,
      impact: 2,
      fragmentSize: 0.06,
      minSize: 0.05,
      dustSize: 0.02,
      minBodySize: 0.05,
      maxPieces: 3,
      rubbleLife: 10,
      // Matt: glossier, the small facets flashed in the low sun
      surface: new THREE.MeshStandardNodeMaterial({ color: 0xffffff, roughness: 0.75 }),
      inside: 0xe8e0b0,
      insideMap: 0,
    }),
    // The square (laid in index.ts): setts as the cobbles round them, over packed earth. Broken,
    // a chunk shows setts on every side (as pale broken stone, they lay round a crater as boards)
    cobbles: groundPresets.cobbles({ surface: setts(), uvScale: 1 / COBBLE_MAP.tile, inside: SETTS_BROKEN, insideTexture: inside('cobblestone_floor_001', 1 / COBBLE_MAP.tile, { base }) }),
    earth: groundPresets.earth({ surface: earthSurface(slab.at, slab.normal), uvScale: 0.5, inside: 0xc8b494 }),
    lantern: material({
      density: 0.6,
      strength: 5e3,
      minSize: 0.5,
      dustSize: 0.3,
      maxPieces: 4,
      rubbleLife: 6,
      // Dark once knocked down
      glow: 'standing',
      // Amber through horn: at 4 and paler it bloomed to white
      surface: new THREE.MeshStandardNodeMaterial({ color: 0xf0c890, emissive: 0xffa040, emissiveIntensity: 2.5, roughness: 0.5 }),
      inside: 0xe8e0d0,
      insideMap: 0,
    }),
  };
}
