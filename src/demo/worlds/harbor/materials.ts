// Harbor Yard's materials: thin painted steel that dents and folds (containers, cladding, roller
// doors, tanks), structural steel that bends before it tears (the crane, the shed's frame, masts and
// ladders), wire rope, cast iron, concrete, pallet timber and cardboard.
// Textures from the harbor pack (GPT Image 2.5, processed by scripts/assets/packs/harbor/textures.py)
// and the base pack.

import { abs, color, float, floor, fwidth, luminance, materialColor, max, mix, mx_noise_float, smoothstep, step, texture as sample, uv, vec3, vec4 } from 'three/tsl';
import * as THREE from 'three/webgpu';
import { type BreakableMaterial, material, pieceFrame, presets } from '../../../lib/index.ts';
import { inside, texture, textured } from '../../textures.ts';

export const base = 'packs/harbor/textures/';

/** The container skin's repeats per metre (its 1.71 m tile). */
const SKIN_UV = 0.585;

/**
 * The container skin: tinted per box, rust where it collects on a real box (under the top rail,
 * along the bottom rail, at the corner castings) and on some boxes more than others. Each box's
 * texture frame has its floor at v = 0 (so v / SKIN_UV is the height in the box) and a random
 * offset of up to 300 m along u, which picks its own patch of a slow noise: how rusty it is. The
 * tint goes on the paint only (`tintMask`), so rust keeps its colour on any box. Inside, grey
 * primer: containers.ts turns each piece's texture frame so its faces toward the box's middle face
 * +x or +z in it (and the roof's underside faces down); the floor's top is brown boards (the only
 * pieces 16 cm thick and over a metre each way).
 */
function containerSkin(): { surface: THREE.MeshStandardNodeMaterial; tintMask: THREE.Node } {
  const m = textured('harbor_container', { base, metalness: 0.15, normalScale: 0.9 });
  const diffuse = sample(m.map!, uv()).rgb;
  const raw = sample(texture('harbor_container_rust', false, base), uv()).r;
  // Metres along the wall and up from the floor
  const x = uv().x.div(SKIN_UV);
  const y = uv().y.div(SKIN_UV);
  const band = max(float(0.25), max(smoothstep(0.75, 0.2, y), smoothstep(1.85, 2.4, y)));
  const weathered = smoothstep(-0.45, 0.25, mx_noise_float(vec3(x.mul(0.04), 0.37, 1.7)));
  // Runs down from under the top rail (thin across, long down), patches along the bottom rail
  const runs = smoothstep(0.3, 0.7, mx_noise_float(vec3(x.mul(5), y.mul(0.35), 3.3))).mul(smoothstep(1.2, 2.35, y)).mul(0.7);
  const foot = smoothstep(0.15, 0.55, mx_noise_float(vec3(x.mul(1.6), y.mul(2.5), 8.1))).mul(smoothstep(0.5, 0.12, y));
  const rust = max(smoothstep(0.35, 0.75, raw).mul(band), max(runs, foot)).mul(weathered);
  // The map's own flecks go back to paint wherever rust isn't wanted
  const paint = mix(diffuse, vec3(0.66), smoothstep(0.1, 0.6, raw));
  const oxide = color(0x5e3b26).mul(luminance(diffuse).mul(0.5).add(0.65));
  const { normal: n, halfExtents: h } = pieceFrame();
  const inner = max(step(0.5, max(n.x, n.z)), step(n.y, -0.5));
  const boards = step(0.5, n.y).mul(step(0.05, h.y)).mul(step(0.5, h.x.min(h.z)));
  const outside = mix(paint, oxide, rust);
  m.colorNode = vec4(mix(mix(outside, paint.mul(color(0xb4b0a8)), inner), paint.mul(color(0x7a5e44)), boards), 1) as unknown as THREE.Node<'color'>;
  return { surface: m, tintMask: painted(paint, outside, rust).mul(inner.oneMinus()).mul(boards.oneMinus()) };
}

/**
 * How much of each channel of `colour` (paint blended with rust by `rust`) is paint: as a tint
 * mask, the tint takes the paint and not the rust, also where they blend (a single share would
 * leave the paint's pale grey showing at a rust patch's edge).
 */
function painted(paint: THREE.Node<'vec3'>, colour: THREE.Node<'vec3'>, rust: THREE.Node<'float'>): THREE.Node<'vec3'> {
  return paint.mul(rust.oneMinus()).div(colour.max(1e-4));
}

/**
 * Painted structural steel: enamel on plate. The map's chips and specks are mostly painted over
 * (from any distance they read as stucco or cork), the bumps kept faint, a little sheen.
 */
function paintedSteel(normalScale: number, options: { roughness?: number; metalness?: number; cover?: number } = {}): THREE.MeshStandardNodeMaterial {
  const m = textured('harbor_steel_painted', { base, normalScale, roughness: options.roughness ?? 0.45, metalness: options.metalness ?? 0.35 });
  m.colorNode = vec4(mix(sample(m.map!, uv()).rgb, vec3(0.68), options.cover ?? 0.65), 1) as unknown as THREE.Node<'color'>;
  return m;
}

/** The tanks' roof plates: weathered paint on top, dark unpainted steel underneath (seen once the roof has blown). */
function roofPlate(): THREE.MeshStandardNodeMaterial {
  const m = paintedSteel(0.3, { roughness: 0.7, metalness: 0.2, cover: 0.55 });
  const under = step(pieceFrame().normal.y, -0.5);
  m.colorNode = vec4((m.colorNode as THREE.Node<'vec4'>).rgb.mul(mix(float(1), float(0.3), under)), 1) as unknown as THREE.Node<'color'>;
  return m;
}

/**
 * Concrete: the base pack's wall concrete with most of its yellow taken out (under the cool grade
 * it read olive in shade), tinted per piece as before.
 */
export function greyConcrete(color: number, normalScale: number): THREE.MeshStandardNodeMaterial {
  const m = textured('concrete_wall_008', { color, normalScale });
  m.colorNode = vec4(mix(materialColor.rgb, vec3(luminance(materialColor.rgb)), 0.7), 1) as unknown as THREE.Node<'color'>;
  return m;
}

/** The tanks' repeats per metre (a large tile, so the map's blooms don't grid). */
const TANK_UV = 0.4;

/**
 * A tank's shell: white enamel with the map's specks painted out, dark seams between the 2 m
 * courses, vertical welds staggered course to course, and light rust streaks running down from the
 * roof edge. Each tank's texture frame has its origin at the roof edge on the axis, so v / TANK_UV
 * is the height under the roof and u / TANK_UV the distance across the face (the box projection's
 * side axis, which is near enough to the arc to space the welds). The tint (white, or the green
 * band) goes on the paint, not the rust.
 */
function tankPaint(): { surface: THREE.MeshStandardNodeMaterial; tintMask: THREE.Node } {
  const m = textured('harbor_steel_painted', { base, normalScale: 0.2, roughness: 0.62, metalness: 0.2 });
  const diffuse = sample(m.map!, uv()).rgb;
  const across = uv().x.div(TANK_UV);
  const down = uv().y.div(TANK_UV).negate();
  const line = (d: THREE.Node<'float'>, width: number) => float(1).sub(smoothstep(width, fwidth(d).add(width * 1.6), d));
  // Seams every 2 m; welds every 1.6 m, half a plate over on alternate courses
  const seam = line(abs(down.div(2).sub(down.div(2).round())).mul(2), 0.012);
  const course = floor(down.div(2));
  const w = across.div(1.6).add(course.mod(2).mul(0.5));
  const weld = line(abs(w.sub(w.round())).mul(1.6), 0.008);
  // Streaks: thin across, long down, from under the roof edge, fading over 3.5 m
  const streak = smoothstep(0.2, 0.65, mx_noise_float(vec3(across.mul(9), down.mul(0.22), 4.2))).mul(smoothstep(3.5, 0.05, down));
  const paint = mix(diffuse, vec3(0.7), float(0.85));
  const lines = float(1).sub(seam.mul(0.4)).sub(weld.mul(0.18));
  // Rust: 0x8a6a50 (linear)
  const rust = streak.mul(0.6);
  const outside = mix(paint, vec3(0.254, 0.145, 0.08), rust);
  m.colorNode = vec4(outside.mul(lines), 1) as unknown as THREE.Node<'color'>;
  return { surface: m, tintMask: painted(paint, outside, rust) };
}

/**
 * Cardboard: a strip of tape along the top's middle and down the ends halfway, the edges a little
 * darker. A carton's length is along its own x; where on the carton comes from its frame, so a
 * burst carton's flaps keep their tape.
 */
function cardboard(): THREE.MeshStandardNodeMaterial {
  const m = new THREE.MeshStandardNodeMaterial({ color: 0xffffff, roughness: 0.95 });
  const { position: p, halfExtents: h } = pieceFrame();
  const d = h.sub(abs(p));
  const tape = smoothstep(0.03, 0.026, abs(p.z)).mul(max(smoothstep(0.015, 0.005, d.y), smoothstep(0.015, 0.005, d.x).mul(smoothstep(0, 0.01, p.y))));
  // Each face is at d = 0 on its own axis: the other two say how near an edge it is
  const near = (k: THREE.Node<'float'>) => smoothstep(0.04, 0.0, k);
  const edge = near(d.x).add(near(d.y)).add(near(d.z)).sub(1).clamp(0, 1);
  m.colorNode = vec4(mix(vec3(1), vec3(0.62, 0.58, 0.5), tape).mul(float(1).sub(edge.mul(0.2))), 1) as unknown as THREE.Node<'color'>;
  return m;
}

/** Floodlights and the crane's beacon: lit while they stand (their intensity is a uniform: the beacon blinks). */
function lamp(color: number, emissive: number, intensity: number): BreakableMaterial {
  return material({
    density: 0.8,
    strength: 5e3,
    minSize: 0.5,
    dustSize: 0.3,
    maxPieces: 4,
    rubbleLife: 8,
    glow: 'standing',
    surface: new THREE.MeshStandardNodeMaterial({ color, emissive, emissiveIntensity: intensity, roughness: 0.4 }),
    inside: 0xe8e0d0,
    insideMap: 0,
  });
}

export function harborMaterials(): Record<string, BreakableMaterial> {
  // Torn steel: dark bare metal, not the pale grey of stone
  const steelInside = 0x4a4c4e;
  return {
    // Corrugated boxes drawn thick (6 cm for 2 mm): a low density gives a real tare. Low support so
    // reinforce makes a stack carry what it carries as built and no more; joints yield at the seams.
    // A blast throws a wall panel or roof sheet whole (none is cut: they're under 1.5 × minSize)
    container: presets.metal({
      density: 0.4,
      support: 20,
      impact: 60,
      plastic: { yieldStress: 6e3, bend: 0.9 },
      fragmentSize: 0.7,
      minSize: 0.45,
      maxPieces: 4,
      friction: 0.45,
      ...containerSkin(),
      inside: 0x5a4e46,
      insideMap: 0.2,
      uvScale: SKIN_UV,
    }),
    // Box stand-ins for I and box sections. Support low on purpose: lose a leg and the others are
    // overloaded (the shed's frame is joined at half of it: warehouse.ts). It tears rather than
    // shatters: a blast cuts a length in two at most (pieces under 0.9 m aren't cut at all), and the
    // plastic joints do the bending
    steel: presets.metal({
      density: 1.2,
      support: 300,
      compression: 60,
      impact: 300,
      plastic: { yieldStress: 1.5e4, bend: 1.0 },
      fragmentSize: 1.2,
      minSize: 0.6,
      maxPieces: 2,
      surface: paintedSteel(0.25),
      inside: steelInside,
      uvScale: 1,
      uvJitter: 1,
    }),
    // The ship's plating, bulkheads and deck: plate drawn 40 cm thick, lighter than it looks. A blast
    // tears a hole in it (the plate it strikes cut up, the nearest thrown), the rest stands
    plate: presets.metal({
      density: 0.5,
      support: 200,
      impact: 150,
      plastic: { yieldStress: 8e3, bend: 1.0 },
      fragmentSize: 0.7,
      minSize: 0.4,
      maxPieces: 6,
      surface: paintedSteel(0.25),
      inside: steelInside,
      uvScale: 1,
      uvJitter: 1,
    }),
    // Yields at once and hardly ever tears: rope lengths act as links
    cable: presets.metal({
      density: 2,
      strength: 6e4,
      minSize: 0.5,
      plastic: { yieldStress: 500, bend: 3 },
      surface: textured('harbor_steel_painted', { base, color: 0x3a3a38, normalScale: 0.25, roughness: 0.45, metalness: 0.5 }),
      inside: steelInside,
      uvScale: 2,
    }),
    // Light sheeting, weakly held: a blast peels it
    cladding: presets.metal({
      density: 0.3,
      support: 60,
      impact: 30,
      plastic: { yieldStress: 3e3, bend: 1.4 },
      fragmentSize: 0.5,
      minSize: 0.25,
      maxPieces: 5,
      surface: textured('harbor_cladding', { base, metalness: 0.15 }),
      inside: 0x8a8e90,
      uvScale: 1,
    }),
    rollerDoor: presets.metal({
      density: 0.35,
      support: 40,
      impact: 30,
      plastic: { yieldStress: 3e3, bend: 1.6 },
      fragmentSize: 0.5,
      minSize: 0.25,
      maxPieces: 5,
      surface: textured('harbor_roller_door', { base, color: 0xa8acaa, metalness: 1, metalMap: true }),
      inside: 0x9a9ea0,
      uvScale: 1.333,
    }),
    // An 8 mm shell drawn 8 cm thick. Slivers are thrown as particles, not bodies
    tank: presets.metal({
      density: 0.8,
      support: 120,
      impact: 80,
      plastic: { yieldStress: 8e3, bend: 1.0 },
      fragmentSize: 0.8,
      minSize: 0.4,
      minBodySize: 0.15,
      maxPieces: 3,
      ...tankPaint(),
      inside: steelInside,
      uvScale: TANK_UV,
    }),
    // The tanks' roof plates: weathered paint, dark steel where torn; a blast cuts a plate in two
    // at most (it creases rather than sails off whole)
    roof: presets.metal({
      density: 0.8,
      support: 120,
      impact: 80,
      plastic: { yieldStress: 6e3, bend: 1.2 },
      fragmentSize: 0.8,
      minSize: 0.3,
      minBodySize: 0.15,
      maxPieces: 2,
      surface: roofPlate(),
      inside: 0x3a3c3e,
      uvScale: 0.6,
    }),
    // Cast iron snaps; it doesn't bend
    iron: presets.metal({
      density: 7,
      impact: 400,
      plastic: undefined,
      surface: textured('harbor_steel_painted', { base, color: 0x2c2e30, normalScale: 0.4, roughness: 0.7 }),
      inside: 0x6a6a68,
      uvScale: 1.5,
    }),
    // Kerbs, bund walls, barriers and blocks of one size each show their own patch of the map
    concrete: presets.concrete({ surface: greyConcrete(0xc2c8ca, 0.6), inside: 0xd8d4cc, insideTexture: inside('gen_concrete_broken', 1.2), uvScale: 0.4, uvJitter: 1 }),
    // Pallet boards snap into splinters along their length (each board's own x, its map's grain)
    wood: presets.wood({
      density: 0.55,
      strength: 1.2e4,
      fragmentSize: 0.2,
      minSize: 0.06,
      grain: { axis: 'u', stretch: 4 },
      surface: textured('harbor_pallet_wood', { base }),
      inside: 0xd8c09a,
      uvScale: 1,
      uvJitter: 1,
    }),
    // Light boxes that tumble far, and burst where they land hard
    cardboard: material({
      density: 0.15,
      strength: 4e3,
      support: 60,
      impact: 4,
      fragmentSize: 0.25,
      minSize: 0.12,
      dustSize: 0.08,
      maxPieces: 4,
      landing: 6,
      surface: cardboard(),
      inside: 0xb89a72,
      insideMap: 0,
    }),
    glass: presets.glass({
      surface: new THREE.MeshStandardNodeMaterial({ color: 0x5d7a7c, roughness: 0.06, metalness: 0.35, transparent: true, opacity: 0.6 }),
    }),
    lamp: lamp(0xfff2dc, 0xffe8c8, 3),
    beacon: lamp(0xff6050, 0xff2a1a, 8),
    // The drum props: friction and sounds (a prop's density comes from its model)
    drum: presets.metal({ friction: 0.5 }),
  };
}

/** Dust each material makes (over the world's grey palette, index.ts), and its chips. */
export const dust: Record<string, number> = { container: 0x8a7e74, steel: 0x8a8a84, plate: 0x8a8a84, cladding: 0x9a9e9c, rollerDoor: 0x9a9e9c, tank: 0xb8b6b0, roof: 0x9a9894, iron: 0x6a6a68, concrete: 0xb4b0a8, slab: 0xb4b0a8, gravel: 0x9a9890, wood: 0xc8b08a, cardboard: 0xb89a72, glass: 0xe0eef4, cable: 0x6a6a68 };
export const chips: Record<string, number> = { container: 0x5a524c, steel: 0x4a4c4e, plate: 0x4a4c4e, cladding: 0xa0a4a2, rollerDoor: 0xa0a4a2, tank: 0xd8d4cc, roof: 0xb8b8b0, concrete: 0x9a968e, slab: 0x9a968e, gravel: 0x6e6c68, wood: 0xb89a6c, cardboard: 0xa47c52, glass: 0xd6eaf2, iron: 0x3a3a38, cable: 0x3a3a38, lamp: 0xf0e8d8, beacon: 0xc03020 };
