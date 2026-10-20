// Neon Alley's materials: tile-clad concrete, rendered masonry, night glass, and what glows: neon
// tubes, lightbox faces, lamps and paper lanterns (their light from the per-piece tint, the street's
// power and each piece's own level, see glow.ts; dark once the piece no longer stands). Textures
// from this world's pack (public/packs/neon/textures), broken faces from the base pack's.

import { abs, atan, cameraPosition, color, dot, float, fract, max, mix, normalize, positionWorld, step, texture, uv, vec3 } from 'three/tsl';
import * as THREE from 'three/webgpu';
import { type BreakableMaterial, material, pieceFrame, pieceState, pieceTint, presets } from '../../../lib/index.ts';
import { inside, textured } from '../../textures.ts';
import { Glow } from './glow.ts';
import { glyphAtlas } from './glyphs.ts';

const base = 'packs/neon/textures/';

/** The materials that glow (glow.ts keeps their pieces' light). */
const GLOWING = ['neon', 'lightbox', 'lamp', 'lantern'];

/** The per-piece light and the street's power, made with the materials. */
export let glow: Glow;

/** Emission: the piece's tint × strength × power × how lit it is. */
function emitting(m: THREE.MeshStandardNodeMaterial, strength: number): THREE.MeshStandardNodeMaterial {
  m.emissiveNode = pieceTint().mul(strength).mul(glow.power).mul(glow.values().x);
  return m;
}

/**
 * Lamps and lit windows: the tint's light behind blinds (bright slats with dark gaps, brighter at
 * the top, as a room lit from its ceiling), so a window reads as a room and not a white card.
 */
function lampSurface(): THREE.MeshStandardNodeMaterial {
  const m = new THREE.MeshStandardNodeMaterial({ color: 0xfff4e0, roughness: 0.4 });
  const v = glow.values();
  const slats = fract(uv().y.mul(14)).smoothstep(0.55, 0.75).oneMinus().mul(0.55).add(0.45);
  const fall = uv().y.mul(0.35).add(0.55).clamp(0.4, 1.3);
  m.emissiveNode = pieceTint().mul(1.5).mul(slats).mul(fall).mul(glow.power).mul(v.x);
  return m;
}

/**
 * Paper lanterns: lit from inside, brightest where the paper faces you, darker along the ten ribs
 * round the barrel's axis (its piece's frame is unturned and centred on it). Still lit while one
 * swings on a string shaken loose (life.ts hangs it); out once it lies at rest, and inside.
 */
function lanternSurface(): THREE.MeshStandardNodeMaterial {
  // Dark paper by day: the light is its own (else the gate's lamp washes it pale)
  const m = new THREE.MeshStandardNodeMaterial({ color: 0x404040, roughness: 0.8 });
  const rel = pieceFrame().position.xz;
  const radial = normalize(vec3(rel.x, 0, rel.y));
  const facing = abs(dot(radial, normalize(cameraPosition.sub(positionWorld))));
  const rib = step(0.07, fract(atan(rel.y, rel.x).div(Math.PI * 2).mul(10).add(0.035))).mul(0.65).add(0.35);
  const glowing = facing.mul(facing).mul(0.75).add(0.18).mul(rib);
  const { rubble, broken } = pieceState();
  m.emissiveNode = pieceTint().mul(glowing).mul(glow.power).mul(rubble.oneMinus()).mul(broken.oneMinus());
  return m;
}

/** Lightbox faces: the glyph atlas, mapped per piece (glow.ts), glyphs near white over the tint. */
function lightboxSurface(): THREE.MeshStandardNodeMaterial {
  const m = new THREE.MeshStandardNodeMaterial({ color: 0xffffff, roughness: 0.35 });
  const v = glow.values();
  const at = uv().mul(v.y).add(v.zw);
  const g = texture(glyphAtlas(), at).r;
  const t = pieceTint();
  const glyphs = mix(t.mul(0.25), mix(t, vec3(1, 1, 1), 0.25).mul(1.6), g);
  m.emissiveNode = glyphs.mul(2.0).mul(glow.power).mul(v.x);
  // Unlit, the face is the tint's acrylic over dark
  m.colorNode = color(0x3a3a40);
  return m;
}

/** Awnings: stripes 0.25 m wide across the sheet (along the facade); uv runs 1 per metre along x on it (uvScale 1). */
const stripe = fract(uv().x.mul(2)).step(0.5);

/** The white bands of an awning (the tint takes the others: its material's tintMask is the stripe). */
function awningSurface(): THREE.MeshStandardNodeMaterial {
  const m = new THREE.MeshStandardNodeMaterial({ roughness: 0.35 });
  m.colorNode = mix(vec3(0.94, 0.94, 0.94), vec3(1, 1, 1), stripe);
  return m;
}

/**
 * Roller shutters: painted steel, matte enough to stay out of the reflections (at metalness 1 and
 * the map's low roughness they glittered with specks of every sign); the corrugation is in the normals.
 */
function shutterSurface(): THREE.MeshStandardNodeMaterial {
  const m = textured('neon_shutter', { base, metalMap: true, metalness: 0.4 });
  m.roughnessNode = max(texture(m.roughnessMap!, uv()).g, float(0.45));
  return m;
}

/**
 * Glazed tile: the map's gloss, but no smoother than 0.45, out of the screen-space reflections'
 * range (inside it, the grout grid speckled with every sign's colour, as the shutters did).
 */
function tileSurface(): THREE.MeshStandardNodeMaterial {
  const m = textured('neon_tile', { base, normalScale: 0.8 });
  m.roughnessNode = max(texture(m.roughnessMap!, uv()).g.mul(1.4), float(0.45));
  return m;
}

/** The cage panels' grating: bars one way, thinner ones across. */
function grating(): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  g.fillStyle = '#000';
  g.fillRect(0, 0, 64, 64);
  g.fillStyle = '#fff';
  for (let i = 0; i < 64; i += 8) g.fillRect(i, 0, 2, 64);
  for (let j = 0; j < 64; j += 16) g.fillRect(0, j, 64, 2);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.NoColorSpace;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.anisotropy = 8;
  return t;
}

export function neonMaterials(): Record<string, BreakableMaterial> {
  glow = new Glow(GLOWING);
  const crushed = { inside: 0xd0ccc4, insideTexture: inside('gen_concrete_broken', 1.2) };
  // Painted sheet steel, light grey so tints read true
  const sheet = (c = 0xffffff) => textured('neon_metal', { base, metalness: 0.2, color: c });
  const neonSurface = () => emitting(new THREE.MeshStandardNodeMaterial({ color: 0xffffff, roughness: 0.2 }), 7);
  // Night glass: dielectric and a little rough, so the wall behind it doesn't streak through it
  // in the screen-space reflections; clear enough that a lit room shows. It writes depth, so dust
  // drifting over a facade fades over the panes as over the wall
  const glass = new THREE.MeshStandardNodeMaterial({ color: 0x3a5060, roughness: 0.12, metalness: 0, transparent: true, opacity: 0.55 });
  const cage = sheet(0x6a6e74);
  cage.alphaMap = grating();
  cage.alphaTest = 0.5;
  cage.side = THREE.DoubleSide;

  const neon = (o: Partial<BreakableMaterial> = {}) =>
    material({
      density: 2.5,
      strength: 1e3,
      support: 25,
      impact: 1,
      shatter: true,
      reach: 2,
      // A tube that falls shatters where it lands
      landing: 3,
      fragmentSize: 0.1,
      minSize: 0.04,
      minBodySize: 0.12,
      dustSize: 0.25,
      maxPieces: 4,
      rubbleLife: 0,
      friction: 0.4,
      surface: neonSurface(),
      glow: 'standing',
      inside: 0x9ab0b8,
      insideMap: 0,
      uvScale: 1,
      ...o,
    });

  return {
    concrete: presets.concrete({ support: 120, dustSize: 0.1, surface: textured('neon_concrete', { base, roughness: 0.75 }), ...crushed, uvScale: 0.5 }),
    // Concrete clad in glazed tile: tiles come off in smaller, crisper bits
    tile: presets.concrete({
      density: 2.2,
      support: 120,
      compression: 60,
      strength: 3.5e4,
      impact: 40,
      fragmentSize: 0.4,
      minSize: 0.12,
      dustSize: 0.1,
      maxPieces: 6,
      surface: tileSurface(),
      inside: 0xcfc8be,
      insideTexture: inside('gen_concrete_broken', 1.2),
      uvScale: 1,
    }),
    // Masonry under painted render: its joints give once it falls (strength, impact), so a facade
    // that drops tears up into slabs and chunks as it lands
    render: presets.brick({ support: 15, strength: 6e3, impact: 15, dustSize: 0.1, surface: textured('neon_render', { base }), inside: 0xc8b0a0, insideTexture: inside('gen_brick_broken', 1.6), uvScale: 0.5 }),
    glass: presets.glass({ surface: glass }),
    neon: neon(),
    lightbox: material({
      density: 1.2,
      strength: 3e3,
      support: 40,
      impact: 3,
      shatter: true,
      reach: 1.5,
      landing: 3,
      fragmentSize: 0.25,
      minSize: 0.08,
      minBodySize: 0.12,
      dustSize: 0.2,
      maxPieces: 4,
      rubbleLife: 0,
      surface: lightboxSurface(),
      glow: 'standing',
      inside: 0x2a2a30,
      insideMap: 0,
      uvScale: 1,
    }),
    // Hollow sheet-metal boxes: sign bodies, raceways, AC units, tanks, vending machines
    signbox: presets.metal({
      density: 0.35,
      support: 600,
      strength: 2e4,
      impact: 30,
      fragmentSize: 0.45,
      minSize: 0.25,
      maxPieces: 4,
      plastic: { yieldStress: 6e3, bend: 1.0 },
      surface: sheet(),
      inside: 0x3a3d42,
      uvScale: 1,
      // Each box its own patch of the sheet's wear (the AC units, the condensers, the tanks)
      uvJitter: 1,
    }),
    steel: presets.metal({ surface: sheet(0x5a5e66), inside: 0x6a6e74, uvScale: 1 }),
    shutter: presets.metal({
      density: 0.9,
      support: 400,
      strength: 1.5e4,
      impact: 18,
      fragmentSize: 0.5,
      // Small enough that a slat (0.27) is cut where a bullet strikes it: one too small to cut gives
      // way only if struck near its middle (Destruction.shoot), and a slat is 2 m long
      minSize: 0.15,
      maxPieces: 4,
      plastic: { yieldStress: 2.5e3, bend: 1.5 },
      surface: shutterSurface(),
      inside: 0x6a706a,
      uvScale: 1,
    }),
    lamp: material({
      density: 0.6,
      strength: 5e3,
      landing: 4,
      minSize: 0.5,
      dustSize: 0.3,
      maxPieces: 4,
      rubbleLife: 6,
      surface: lampSurface(),
      glow: 'standing',
      inside: 0xe8e0d0,
      insideMap: 0,
    }),
    // Paper on a wire frame
    lantern: material({
      density: 0.06,
      strength: 600,
      support: 25,
      impact: 0.4,
      fragmentSize: 0.18,
      minSize: 0.12,
      minBodySize: 0.1,
      dustSize: 0.22,
      maxPieces: 4,
      rubbleLife: 5,
      surface: lanternSurface(),
      inside: 0x3a1810,
      insideMap: 0,
    }),
    awning: material({
      density: 0.25,
      strength: 2.5e3,
      support: 50,
      impact: 4,
      fragmentSize: 0.4,
      minSize: 0.25,
      dustSize: 0.08,
      maxPieces: 5,
      rubbleLife: 20,
      surface: awningSurface(),
      tintMask: stripe,
      inside: 0xd8d8d8,
      insideMap: 0,
      uvScale: 1,
    }),
    // The gate: faded red lacquer over grey wood
    wood: presets.wood({ surface: textured('gen_wood_painted', { color: 0xb83a28 }), inside: 0xb89a78, uvScale: 1 }),
    grate: presets.metal({ surface: cage, uvScale: 3, minSize: 0.5, inside: 0x6a6e74 }),
  };
}

/** Floats that make a lightbox face show atlas cells `cell` m wide from cell (col, row): its glow map. */
export function atlasMap(cell: number, col: number, row: number): [number, number, number] {
  return [1 / (4 * cell), col / 4, row / 4];
}
