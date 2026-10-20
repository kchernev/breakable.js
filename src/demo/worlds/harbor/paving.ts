// The yard's pavement: wet port concrete in 4 m slabs, drawn the same on the deck round the yard
// (scenery.ts) and on the apron's breakable slabs, so neither shows where the other begins: its
// colour and shine at a point on the deck, the lines painted on it, the drain grates and the oil
// where the tractors stand; and the apron's materials, reinforced concrete over crushed stone. On
// the slabs the paint is in their surface, so it goes with the chunks a blast throws and stays on
// the cells a bullet leaves.

import { abs, color, cos, dFdx, dFdy, float, floor, fract, fwidth, hash, max, min, mix, mx_noise_float, sin, smoothstep, step, texture as sample, uv, vec2, vec3 } from 'three/tsl';
import * as THREE from 'three/webgpu';
import { type BreakableMaterial, groundPresets, pieceFrame, random } from '../../../lib/index.ts';
import { inside, texture, textured } from '../../textures.ts';
import { DRAINS, QUAY, ROOFS } from './ground.ts';
import { base } from './materials.ts';

/** The pavement's map: an 8 m tile of 2 × 2 slabs, laid from x 0 on the quay's edge (u along x, v along -z). */
export const PAVE = { tile: 8 };

type F = THREE.Node<'float'>;
type V2 = THREE.Node<'vec2'>;

/** Where on the deck a slab's top face is, from its map coordinates (uv()). */
export const paveAt = (uv: V2): V2 => vec2(uv.x, uv.y.negate()).mul(PAVE.tile).add(vec2(0, QUAY.edge));

/**
 * The pavement at `p` (x, z on the deck): the 8 m tile of slabs, each tile turned or mirrored at
 * random (the slabs and joints are symmetric, so they still line up) so its puddle and tyre track
 * don't repeat in a grid, and wet patches at a larger scale, darker and glossy enough to mirror what
 * stands in them. `paint` (0-1): where the lines, grates and oil may go (a slab's top, not its sides).
 */
export function pavement(p: V2, paint: F = float(1)): { color: THREE.Node<'vec3'>; roughness: F; metalness: F } {
  const diff = texture('harbor_yard_concrete_diff', true, base);
  const arm = texture('harbor_yard_concrete_arm', false, base);
  // Tile coordinates: a tile edge on the quay edge and on x = 0
  const q = vec2(p.x, p.y.sub(QUAY.edge)).div(PAVE.tile);
  const cell = floor(q);
  const f = fract(q);
  const k = floor(hash(cell.x.mul(7.13).add(cell.y.mul(157.7))).mul(8));
  const swap = k.mod(2);
  const fu = floor(k.div(2)).mod(2);
  const fv = floor(k.div(4));
  const turn = (v: V2, offset: boolean) => {
    const s = mix(v, v.yx, swap);
    return offset ? vec2(mix(s.x, s.x.oneMinus(), fu), mix(s.y, s.y.oneMinus(), fv)) : vec2(s.x.mul(fu.mul(-2).add(1)), s.y.mul(fv.mul(-2).add(1)));
  };
  const uvT = turn(f, true);
  const gx = turn(dFdx(q), false);
  const gy = turn(dFdy(q), false);
  const at = (t: THREE.Texture) => sample(t, uvT).grad(gx, gy);
  // Wet patches over several slabs, damp margins around them, where water lies: by the drain
  // grates, along the crane rails and the lane edges, fewer elsewhere; none under a roof
  const noise = mx_noise_float(vec3(p.x.mul(0.045), p.y.mul(0.045), 0.5)).add(mx_noise_float(vec3(p.x.mul(0.17), p.y.mul(0.17), 3.1)).mul(0.35));
  const near = (d: F, r: number) => smoothstep(r, 0, d);
  const west = step(p.x, 6);
  let drain: F = float(1e3);
  for (const [x, z] of DRAINS) drain = min(drain, p.sub(vec2(x, z)).length());
  const low = max(
    max(near(drain, 3), near(min(abs(p.y.add(21)), abs(p.y.add(1))), 1.6).mul(west)),
    max(near(min(abs(p.x.sub(4.4)), abs(p.x.sub(11.6))), 1.4), near(min(abs(p.y.add(6.3)), abs(p.y.add(1.8))), 1.4).mul(step(p.x, 4.2))),
  );
  const roofed = max(within(p, ...ROOFS[0]), within(p, ...ROOFS[1]));
  const lie = noise.add(low.mul(0.28)).add(mx_noise_float(vec3(p.x.mul(0.012), p.y.mul(0.012), 7.3)).mul(0.25)).sub(0.08);
  const dry = float(1).sub(roofed);
  const wet = smoothstep(0.3, 0.62, lie).mul(dry);
  const damp = smoothstep(0.0, 0.42, lie).mul(dry);
  const ao = mix(float(1), at(arm).r, 0.6);
  // The tile's own puddle and tyre track would dot the yard on the 8 m grid, and (their roughness
  // under 0.3) be glossy wherever they fall, under the shed too: the map is divided by a blurred
  // copy of itself (its 0.5 m texels: the slabs' grain stays, the blotches go), and the roughness
  // is held at dry concrete's, so only the wet patches here darken and shine
  const local = sample(diff, uvT).level(float(6)).rgb.max(0.03);
  const even = at(diff).rgb.div(local).mul(vec3(0.241, 0.236, 0.225));
  let colour: THREE.Node<'vec3'> = mix(at(diff).rgb, even, 0.85).mul(color(0xd6d7d5)).mul(ao);
  // Damp before glossy: the edges dull through 0.25 before the middle mirrors; under a roof, matt
  let rough: F = max(at(arm).g, mix(float(0.55), float(0.6), roofed));
  colour = colour.mul(mix(float(1), float(0.82), damp)).mul(mix(float(1), float(0.7), wet));
  rough = mix(mix(rough, float(0.25), damp), float(0.07), wet);
  // Over it, the paint (worn thin in places), the drains' cast iron and the oil, as they were when
  // they lay on the deck: the water stands round them
  const { yellow, white, grate, slots } = markings(p);
  const wear = smoothstep(-0.2, 0.6, mx_noise_float(vec3(p.x.mul(1.3), p.y.mul(1.3), 5.7))).mul(0.4);
  const lines = paint.mul(float(1).sub(wear));
  colour = mix(colour, color(0xb89a3a), yellow.mul(lines));
  colour = mix(colour, color(0xc8c8c2), white.mul(lines));
  rough = mix(rough, float(0.62), max(yellow, white).mul(lines));
  const iron = grate.mul(paint);
  colour = mix(colour, mix(color(0x2a2c2c), color(0x080909), slots), iron);
  rough = mix(rough, float(0.5), iron);
  const metal = iron.mul(slots.oneMinus()).mul(0.4);
  const oil = stains(p).mul(paint);
  colour = mix(colour, color(0x141414), oil);
  rough = mix(rough, float(0.15), oil);
  return { color: colour, roughness: rough, metalness: metal };
}

/** 1 inside the rectangle x0..x1, z0..z1 (p is x, z), 0 outside. */
function within(p: V2, x0: number, x1: number, z0: number, z1: number): F {
  return step(x0, p.x).mul(step(p.x, x1)).mul(step(z0, p.y)).mul(step(p.y, z1));
}

/**
 * How much of a pixel a band |d| < half covers, its footprint `w` across: crisp near, thinning out
 * far off rather than flickering.
 */
function band(d: F, half: number, w: F): F {
  return d.add(w.mul(0.5)).min(half).sub(d.sub(w.mul(0.5)).max(-half)).div(w).clamp(0, 1);
}

/** Lines painted on the deck (x0, x1, z0, z1): the lane edges in yellow, the bays' stripes in white. */
const YELLOW: Array<[number, number, number, number]> = [
  ...[-6.3, -1.8].map((z): [number, number, number, number] => [-35, 4.2, z - 0.08, z + 0.08]),
  ...[4.4, 11.6].map((x): [number, number, number, number] => [x - 0.08, x + 0.08, -29.2, 40]),
];
const WHITE: Array<[number, number, number, number]> = [
  // Bay stripes at the ends of Block A's rows, and Block B's
  ...[-33.8, -21.1, -8.5, 4.2].map((x): [number, number, number, number] => [x - 0.06, x + 0.06, -20.2, -6.4]),
  ...[-5.75, 13.45].map((z): [number, number, number, number] => [12.4, 27.5, z - 0.06, z + 0.06]),
];

/** What's painted and set into the deck at p: the lines' cover (0-1), the drain grates' and their slots'. */
function markings(p: V2): { yellow: F; white: F; grate: F; slots: F } {
  const w = vec2(fwidth(p.x), fwidth(p.y)).max(1e-4);
  const rect = ([x0, x1, z0, z1]: [number, number, number, number]) => band(p.x.sub((x0 + x1) / 2), (x1 - x0) / 2, w.x).mul(band(p.y.sub((z0 + z1) / 2), (z1 - z0) / 2, w.y));
  const cover = (list: Array<[number, number, number, number]>) => list.reduce((a: F, r) => max(a, rect(r)), float(0));
  // A grate 0.6 m square: a rim, and bars along x 4 cm apart (evened out where they'd be finer than a pixel)
  let grate: F = float(0);
  let slot: F = float(0);
  for (const [x, z] of DRAINS) {
    grate = max(grate, rect([x - 0.3, x + 0.3, z - 0.3, z + 0.3]));
    slot = max(slot, rect([x - 0.26, x + 0.26, z - 0.26, z + 0.26]));
  }
  const bars = smoothstep(0.3, 0.45, abs(fract(p.y.div(0.04)).sub(0.5)));
  const slots = slot.mul(mix(bars.oneMinus(), float(0.6), smoothstep(0.01, 0.03, w.y)));
  return { yellow: cover(YELLOW), white: cover(WHITE), grate, slots };
}

/** Oil where the tractors and forklifts stand: x, z, size, and the blot's turn. */
const OIL: Array<[number, number, number, number]> = [
  [-14, -4, 2.4, 1.1],
  [20, 18, 2, 4.2],
  [10.6, -7, 1.4, 2.7],
  [-18.5, 4.5, 1.6, 5.9],
];

/** How much oil lies at p (0-0.55): soft blots of one shape, each turned its own way. */
function stains(p: V2): F {
  const blot = stain();
  let oil: F = float(0);
  for (const [x, z, s, a] of OIL) {
    const d = p.sub(vec2(x, z));
    const u = d.x.mul(cos(a)).sub(d.y.mul(sin(a))).div(s).add(0.5);
    const v = d.x.mul(sin(a)).add(d.y.mul(cos(a))).div(s * 0.7).add(0.5);
    const on = step(0, u).mul(step(u, 1)).mul(step(0, v)).mul(step(v, 1));
    oil = max(oil, sample(blot, vec2(u, v)).r.mul(on));
  }
  return oil.mul(0.55);
}

let blot: THREE.Texture | null = null;

/** A soft blot: an oil stain's shape. */
function stain(): THREE.Texture {
  if (blot) return blot;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  const rand = random(5);
  g.fillStyle = '#000';
  g.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 9; i++) {
    const x = 64 + (rand() - 0.5) * 50;
    const y = 64 + (rand() - 0.5) * 40;
    const r = 14 + rand() * 26;
    const grad = g.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, 'rgba(255,255,255,0.7)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 128, 128);
  }
  blot = new THREE.CanvasTexture(c);
  blot.colorSpace = THREE.NoColorSpace;
  return blot;
}

/**
 * The apron's slabs (ground.ts): the pavement on their tops (its paint where a face looks up, so not
 * on their sides), and where they break, fractured concrete with the ends of the reinforcement's
 * bars in two rows (harbor_slab_broken, laid 1 m a tile down from the top). Under them, the crushed
 * stone they're laid on. No normal map on the slabs or the drawn deck: the library would bump the
 * puddles too, and flat puddles are what mirror the yard (dry, the pavement looks the same without it).
 */
export function apronMaterials(): Record<string, BreakableMaterial> {
  const surface = new THREE.MeshStandardNodeMaterial({ roughness: 1, metalness: 0 });
  const top = step(0.5, pieceFrame().normal.y);
  const look = pavement(paveAt(uv()), top);
  surface.colorNode = look.color as unknown as THREE.Node<'color'>;
  surface.roughnessNode = look.roughness;
  surface.metalnessNode = look.metalness;
  const stone = 0xb4b2ac;
  return {
    // Reinforced: it breaks into chunks that hold together. A rocket takes as much of it as of
    // asphalt: a crater 2.5-3.5 m across, mostly down to the bed; it cuts a slab in 24, chunks light
    // enough to fly clear of the crater (ground.ts). Wreckage landing on it cracks a slab now and
    // then: the crane's heaviest lengths strike it at 25 to 35 in most of its falls, which `impact`
    // 40 takes, and at 42 and 50 in two of seven, one of which cracked the slab it struck. The gun's
    // heavy rounds crack a slab in 14 to 20 and then break more at nearly every round. What a round
    // or a rocket cuts under 0.45 m goes as grit: a burst opens a pothole into the stone rather than
    // leaving a heap of wedges, and a rocket's thin wedges don't land on edge in its crater or round it
    slab: groundPresets.paving({ surface, reach: 0.5, impact: 40, minBodySize: 0.45, maxPieces: 24, fragmentSize: 0.3, uvScale: 1 / PAVE.tile, inside: 0xd8d4cc, insideTexture: inside('harbor_slab_broken', 1, { base }) }),
    // Loose stone: what a blast reaches sprays out (no cell of it under 1.2 m is a body), and what
    // it doesn't stands round the pit
    gravel: groundPresets.gravel({ minBodySize: 1.2, keepSmall: true, maxPieces: 16, fragmentSize: 0.25, surface: textured('harbor_gravel', { base, color: stone }), uvScale: 1, inside: stone, insideTexture: inside('harbor_gravel', 1, { base }) }),
  };
}
