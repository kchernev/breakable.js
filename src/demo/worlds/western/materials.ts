// Dust Town's materials: the pack's textures (weathered siding, timber, tin, adobe, dirt, splinter
// faces), the base pack's brick, sandstone and iron, plain glass, bronze and paint, and the signs'
// atlas, the bales' straw and the forge's coals drawn in code.

import { color, mx_noise_float, smoothstep, time, vec2, vec3 } from 'three/tsl';
import * as THREE from 'three/webgpu';
import { type BreakableMaterial, groundPresets, material, pieceFrame, presets } from '../../../lib/index.ts';
import { inside, texture, textured } from '../../textures.ts';
import { random } from '../../../lib/index.ts';
import { ATLAS, signAtlas } from './signs.ts';
import { EARTH, groundSurface, streetSurface } from './scenery.ts';

const base = 'packs/western/textures/';

export function townMaterials(): Record<string, BreakableMaterial> {
  // Broken boards show torn pine, which carries its own cream colour (so `inside` stays white)
  const splinter = { inside: 0xffffff, insideTexture: inside('western_splinter', 2, { base }) };
  // The signs' atlas: the signboards' and the hanging boards'
  const atlas = signAtlas();
  return {
    // Painted lap siding: comes apart into boards, not crumbs
    siding: presets.wood({
      density: 0.5,
      // Thin nailed boards hang poorly: a bay whose posts or header go comes down
      support: 25,
      compression: 40,
      // Nails pull: a fallen front lands as boards and panels, not one sheet
      strength: 1.5e3,
      impact: 12,
      fragmentSize: 0.45,
      minSize: 0.12,
      // Few pieces, split along the boards (every wall's skin runs its x along the wall);
      // splinters are particles (a collapse adds boards, not thousands of chips)
      maxPieces: 4,
      grain: { axis: 'u', stretch: 4 },
      dustSize: 0.05,
      minBodySize: 0.16,
      rubbleLife: 25,
      surface: textured('western_siding', { base }),
      // The building's paint only where the map has paint: the bare boards stay silver-grey
      tintMask: texture('western_siding_paint', false, base),
      uvScale: 1 / 0.9,
      ...splinter,
      insideMap: 0.2,
    }),
    timber: presets.wood({
      density: 0.6,
      support: 60,
      compression: 60,
      strength: 1.6e4,
      impact: 22,
      fragmentSize: 0.4,
      minSize: 0.1,
      // Beams, posts and planks lie long on their texture frame's y: they split into long pieces
      // along it, and splinters are particles (a collapse leaves beams and boards, not chips)
      maxPieces: 4,
      grain: { axis: 'v', stretch: 4 },
      minBodySize: 0.12,
      dustSize: 0.05,
      rubbleLife: 40,
      surface: textured('western_timber', { base }),
      uvScale: 1,
      // Each piece its own patch of the map, so the knots of a deck of equal panels don't line up
      uvJitter: 1,
      ...splinter,
    }),
    // The water tank's staves, floor and roof: the same timber, its hoops and joints weak, so a
    // tank that falls from the tower bursts into staves
    stave: presets.wood({
      density: 0.6,
      support: 60,
      compression: 60,
      strength: 250,
      impact: 6,
      fragmentSize: 0.4,
      minSize: 0.1,
      maxPieces: 4,
      grain: { axis: 'v', stretch: 4 },
      dustSize: 0.05,
      rubbleLife: 40,
      surface: textured('western_timber', { base }),
      uvScale: 1,
      uvJitter: 1,
      ...splinter,
    }),
    // Corrugated iron: light sheets that fold, hang and fly rather than break, at about their real
    // weight (half a millimetre of iron over the 3 cm a sheet is drawn), heard whatever they strike
    tin: presets.metal({
      density: 0.2,
      audible: 0.001,
      support: 400,
      strength: 6e3,
      impact: 60,
      plastic: { yieldStress: 2.5e3, bend: 1.8 },
      fragmentSize: 0.8,
      minSize: 0.45,
      maxPieces: 3,
      minBodySize: 0,
      friction: 0.45,
      rubbleLife: Infinity,
      surface: textured('western_tin', { base, metalMap: true, roughness: 1.1 }),
      uvScale: 1.46,
      inside: 0x8c8a84,
      insideMap: 0.6,
    }),
    // Sun-dried mud brick: weak sideways, strong pressed, crumbles to small lumps and dust
    adobe: presets.brick({
      density: 1.6,
      support: 22,
      compression: 90,
      strength: 1e4,
      impact: 16,
      fragmentSize: 0.3,
      minSize: 0.12,
      dustSize: 0.32,
      minBodySize: 0.12,
      maxPieces: 30,
      rubbleLife: 30,
      // Smoothed mud plaster: soft, broad lumps rather than a stucco's popcorn
      surface: textured('western_adobe', { base, normalScale: 0.45 }),
      uvScale: 0.4,
      inside: 0xb4916a,
      insideMap: 0.7,
    }),
    // The bank: the fortress of the town
    brick: presets.brick({
      support: 60,
      impact: 35,
      surface: textured('brick_wall_005', { color: 0xead2bc, normalScale: 1.2 }),
      uvScale: 0.55,
      inside: 0xc4a596,
      insideTexture: inside('gen_brick_broken', 1.6),
    }),
    // Sandstone trim and footings
    stone: presets.concrete({
      surface: textured('concrete_wall_008', { color: 0xe6d2ae, normalScale: 0.8 }),
      uvScale: 0.5,
      inside: 0xd8c4a0,
      insideTexture: inside('gen_concrete_broken', 1.2),
    }),
    // Old dusty panes, writing depth so a blast's dust drifting over a front fades at them as at
    // its walls. Bottles and panes knocked loose break where they land
    glass: presets.glass({
      landing: 2,
      surface: new THREE.MeshStandardNodeMaterial({ color: 0x7d8f8c, roughness: 0.18, metalness: 0.25, transparent: true, opacity: 0.5 }),
    }),
    // Bars, hoops, rods, the stove, the windmill's gearbox: they bend before they tear
    iron: presets.metal({
      surface: textured('gen_iron_painted', { color: 0x8a8a8a }),
      uvScale: 1,
      plastic: { yieldStress: 1.5e4, bend: 1.4 },
      // Bars and rods are thin; the gearbox and the safe-sized things stay whole
      minSize: 0.45,
      inside: 0x5a4a40,
    }),
    // The chapel's bell: rounds only ring it, and it rings when it lands; a blast at it cracks it in a few
    bronze: presets.metal({
      density: 8,
      impact: 1e9,
      minSize: 0.2,
      maxPieces: 4,
      plastic: undefined,
      surface: new THREE.MeshStandardNodeMaterial({ color: 0xa0783c, metalness: 1, roughness: 0.35 }),
      inside: 0x8a6a3a,
    }),
    // The signboards: the atlas, a metre of board a metre of it; split along the boards
    signpaint: material({
      density: 0.5,
      support: 80,
      strength: 6e3,
      impact: 10,
      fragmentSize: 0.3,
      minSize: 0.1,
      dustSize: 0.04,
      maxPieces: 6,
      grain: { axis: 'u', stretch: 4 },
      surface: new THREE.MeshStandardNodeMaterial({ map: atlas, roughness: 0.85 }),
      uvScale: [1 / ATLAS.width, 1 / ATLAS.tall],
      ...splinter,
      insideMap: 0,
    }),
    // The hanging signs' boards: the same board cut without the grain, its cells packed closer
    // round the hole, so a round blows out where it struck and leaves a piece at each chain to
    // swing (about 70% of the board; along the grain it left a strip of 40%, and fell at the next)
    hangboard: material({
      density: 0.5,
      support: 80,
      strength: 6e3,
      impact: 10,
      fragmentSize: 0.15,
      minSize: 0.1,
      dustSize: 0.04,
      maxPieces: 6,
      surface: new THREE.MeshStandardNodeMaterial({ map: atlas, roughness: 0.85 }),
      uvScale: [1 / ATLAS.width, 1 / ATLAS.tall],
      ...splinter,
      insideMap: 0,
    }),
    // Painted trim: window frames, balusters, batwings, the barber's pole (colour by tint)
    paint: presets.wood({
      density: 0.5,
      strength: 8e3,
      impact: 10,
      fragmentSize: 0.25,
      minSize: 0.06,
      maxPieces: 5,
      dustSize: 0.04,
      rubbleLife: 20,
      surface: new THREE.MeshStandardNodeMaterial({ color: 0xffffff, roughness: 0.78 }),
      uvScale: 1,
      ...splinter,
      insideMap: 0,
    }),
    // Bales and sacks: burst into straw dust, and where they land off the loft. Straw drawn in
    // code, lying along the piece's x
    hay: material({
      landing: 5,
      density: 0.15,
      support: 40,
      compression: 20,
      strength: 2e3,
      impact: 6,
      fragmentSize: 0.25,
      minSize: 0.18,
      dustSize: 0.4,
      minBodySize: 0.15,
      maxPieces: 6,
      rubbleLife: 15,
      surface: straw(),
      uvScale: 1.5,
      inside: 0xd8c070,
      insideMap: 0.8,
    }),
    // The street (scenery.ts): packed dirt and sand, drawn as the ground round it, that a blast
    // throws up mostly as spray and a cloud (few clods: a crater wide and soft); the earth under it
    // in its own dug look. Their bits too small to be bodies beyond a blast's reach stand, so a
    // crater's rim stays whole
    sand: groundPresets.sand({ surface: streetSurface(), uvScale: 0.25, reach: 0.75, fragmentSize: 0.35, minBodySize: 0.5, dustSize: 0.45, maxPieces: 14, keepSmall: true, inside: 0xffffff, insideTexture: inside('western_dirt_broken', 1, { base }) }),
    // The ground round the street, where a blast has laid it: as the street's, drawn as the ground there
    dirt: groundPresets.sand({ surface: groundSurface(), uvScale: 0.25, uvJitter: 0, reach: 0.75, fragmentSize: 0.35, minBodySize: 0.5, dustSize: 0.45, maxPieces: 14, keepSmall: true, inside: 0xffffff, insideTexture: inside('western_dirt_broken', 1, { base }) }),
    // The desert's sage and creosote (each its own grey-green: its tint): light, it bursts
    brush: material({
      density: 0.1,
      support: 30,
      compression: 40,
      strength: 700,
      impact: 3,
      fragmentSize: 0.35,
      minSize: 0.18,
      dustSize: 0.3,
      minBodySize: 0.2,
      maxPieces: 5,
      rubbleLife: 6,
      surface: new THREE.MeshStandardNodeMaterial({ color: 0xffffff, roughness: 1, flatShading: true }),
      inside: 0x6f7656,
      insideMap: 0,
    }),
    // Its rocks: sandstone boulders
    rock: presets.concrete({
      density: 2.3,
      fragmentSize: 0.3,
      minSize: 0.12,
      maxPieces: 8,
      surface: new THREE.MeshStandardNodeMaterial({ color: 0xa88a6c, roughness: 0.95, flatShading: true }),
      inside: 0xc8a888,
      insideMap: 0,
    }),
    // Saguaro: green skin over pale wet flesh, soft as wood goes
    cactus: presets.wood({
      density: 0.5,
      support: 80,
      strength: 4e3,
      impact: 8,
      fragmentSize: 0.25,
      minSize: 0.1,
      maxPieces: 5,
      minBodySize: 0.1,
      dustSize: 0.08,
      surface: new THREE.MeshStandardNodeMaterial({ color: 0x5f7048, roughness: 0.85 }),
      inside: 0xb8c890,
      insideMap: 0,
    }),
    // Boot hill's mounds: stony earth heaped up (each its tint), soft
    heap: groundPresets.earth({ surface: new THREE.MeshStandardNodeMaterial({ color: 0xffffff, roughness: 0.95, flatShading: true }), uvScale: 1, minBodySize: 0.3, dustSize: 0.35, maxPieces: 8, inside: 0x8a6a50, insideMap: 0 }),
    earth: groundPresets.earth({ surface: textured('western_earth', { base, color: EARTH }), uvScale: 1, reach: 0.45, minBodySize: 0.4, dustSize: 0.35, maxPieces: 12, keepSmall: true, inside: EARTH, insideTexture: inside('western_earth', 1, { base }) }),
    // The forge's coals: glowing while they lie in the hearth, dark once knocked out of it
    coals: material({
      density: 0.9,
      support: 200,
      strength: 3e3,
      impact: 8,
      fragmentSize: 0.15,
      minSize: 0.08,
      dustSize: 0.1,
      minBodySize: 0.08,
      maxPieces: 8,
      rubbleLife: 10,
      glow: 'standing',
      surface: coals(),
      uvScale: 1,
      inside: 0x4a3c34,
      insideMap: 0,
    }),
  };
}

/** Coals: black with embers glowing through, brightest on top, breathing slowly. */
function coals(): THREE.MeshStandardNodeMaterial {
  const { position, normal } = pieceFrame();
  const m = new THREE.MeshStandardNodeMaterial({ color: 0x2a2420, roughness: 1 });
  const ember = mx_noise_float(vec3(position.x.mul(16), position.z.mul(16), time.mul(0.25)));
  const heat = smoothstep(0.05, 0.6, ember).mul(normal.y.max(0.25)).mul(mx_noise_float(vec2(time.mul(0.7), 0.5)).mul(0.25).add(1));
  m.emissiveNode = color(0xff5a1a).mul(heat.mul(5));
  return m;
}

/**
 * Straw: a canvas of short stalks lying along u, pale gold to dun, and its normal map from their
 * relief (so the sun picks out the stalks). Two thirds of a metre a tile, at `uvScale` 1.5.
 */
function straw(): THREE.MeshStandardNodeMaterial {
  const n = 512;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = n;
  const g = canvas.getContext('2d')!;
  const rand = random(17);
  g.fillStyle = '#5a4622';
  g.fillRect(0, 0, n, n);
  // Clumps a little lighter or darker, then stalks, each with a dark edge so it stands out
  const wrap = (x: number, y: number, r: number, draw: (x: number, y: number) => void) => {
    for (const ox of x + r > n ? [0, -n] : x < r ? [0, n] : [0]) for (const oy of y + r > n ? [0, -n] : y < r ? [0, n] : [0]) draw(x + ox, y + oy);
  };
  for (let i = 0; i < 70; i++) {
    const [x, y, r] = [rand() * n, rand() * n, 30 + rand() * 70];
    const c = rand() < 0.5 ? '255,236,170' : '60,40,10';
    wrap(x, y, r, (px, py) => {
      const grad = g.createRadialGradient(px, py, 0, px, py, r);
      grad.addColorStop(0, `rgba(${c},0.3)`);
      grad.addColorStop(1, `rgba(${c},0)`);
      g.fillStyle = grad;
      g.fillRect(px - r, py - r, 2 * r, 2 * r);
    });
  }
  const stalks = ['#f4de98', '#e6ca76', '#d8b660', '#c8a24e', '#faeebc', '#b48e44', '#a8945a'];
  for (let i = 0; i < 2600; i++) {
    const x = rand() * n;
    const y = rand() * n;
    const len = 40 + rand() * 130;
    // Mostly along the bale; one in six lies askew
    const a = (rand() - 0.5) * (rand() < 1 / 6 ? 1.2 : 0.2);
    const w = 2.5 + rand() * 3.5;
    const colour = stalks[Math.floor(rand() * stalks.length)];
    wrap(x, y, len, (px, py) => {
      for (const [style, width] of [
        ['rgba(40,28,8,0.55)', w + 1.6],
        [colour, w],
      ] as const) {
        g.strokeStyle = style;
        g.lineWidth = width;
        g.beginPath();
        g.moveTo(px, py);
        g.lineTo(px + Math.cos(a) * len, py + Math.sin(a) * len);
        g.stroke();
      }
    });
  }
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  // Heights from brightness (the stalks on top are the pale ones), slopes to a normal map
  const src = g.getImageData(0, 0, n, n).data;
  const h = (x: number, y: number) => {
    const i = 4 * (((y + n) % n) * n + ((x + n) % n));
    return (src[i] * 0.3 + src[i + 1] * 0.55 + src[i + 2] * 0.15) / 255;
  };
  const out = document.createElement('canvas');
  out.width = out.height = n;
  const og = out.getContext('2d')!;
  const img = og.createImageData(n, n);
  const k = 3.5;
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) {
      // Canvas y runs down, the map's v up
      const nx = -(h(x + 1, y) - h(x - 1, y)) * k;
      const ny = (h(x, y + 1) - h(x, y - 1)) * k;
      const l = Math.hypot(nx, ny, 1);
      const i = 4 * (y * n + x);
      img.data[i] = (nx / l / 2 + 0.5) * 255;
      img.data[i + 1] = (ny / l / 2 + 0.5) * 255;
      img.data[i + 2] = (1 / l / 2 + 0.5) * 255;
      img.data[i + 3] = 255;
    }
  og.putImageData(img, 0, 0);
  const normalMap = new THREE.CanvasTexture(out);
  normalMap.colorSpace = THREE.NoColorSpace;
  for (const t of [map, normalMap]) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = 8;
  }
  return new THREE.MeshStandardNodeMaterial({ map, normalMap, roughness: 1 });
}
