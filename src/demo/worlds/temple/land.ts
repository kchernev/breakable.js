// The land's look, shared by what draws it: the land mesh (scenery.ts), and the breakable ground's
// earth and rock (materials.ts) and the sides and bed of its craters (ground.ts), so the slabs read
// as the land they were cut from. Dry grass and thyme with bare pale rock in patches, cliff rock on
// steep faces, wet rock and foam at the sea; under the grass, terra rossa over the bedrock.

import { abs, color, float, luminance, max, mix, mx_fractal_noise_float, mx_noise_float, pow, smoothstep, texture, time, vec2, vec3 } from 'three/tsl';
import type * as THREE from 'three/webgpu';
import { texture as mapOf } from '../../textures.ts';
import { SEA } from './layout.ts';

export const BASE = 'packs/temple/textures/';

type Vec2 = THREE.Node<'vec2'>;
type Vec3 = THREE.Node<'vec3'>;
type Float = THREE.Node<'float'>;

/** Colour of a map seen from above (u, v from x, z at `scale` repeats a metre). */
const top = (t: THREE.Texture, p: Vec3, scale: number) => texture(t, vec2(p.x, p.z.negate()).mul(scale)).rgb;

/** A map projected along all three axes, blended by the surface's facing. */
function triplanar(t: THREE.Texture, p: Vec3, n: Vec3, scale: number): Vec3 {
  const w = pow(abs(n), vec3(4));
  const ws = w.div(w.x.add(w.y).add(w.z));
  const x = texture(t, vec2(p.z, p.y).mul(scale)).rgb;
  const y = texture(t, vec2(p.x, p.z).mul(scale)).rgb;
  const z = texture(t, vec2(p.x, p.y).mul(scale)).rgb;
  return x.mul(ws.x).add(y.mul(ws.y)).add(z.mul(ws.z));
}

/** Bare bedrock seen from above at p (world): the rock's cracks at a 3 m tile, the bedrock's colour, not white. */
export function bedrock(p: Vec3): Vec3 {
  return top(mapOf('marble_rock_02_diff', true, BASE), p, 1 / 3).mul(color(0xd6cfc0)).mul(1.12);
}

/**
 * Sun-bleached cliff rock at p (world, for its noise), its maps read by `sample` (a map at a scale):
 * the pale map at two scales (so its tile doesn't show), with ochre streaks broken along their
 * length, the maps' warm tan pulled toward a pale grey limestone.
 */
function cliff(sample: (t: THREE.Texture, scale: number) => Vec3, p: Vec3): Vec3 {
  const big = mx_fractal_noise_float(vec3(p.x.mul(0.03), p.y.mul(0.05), p.z.mul(0.03)), 3, 2, 0.5);
  const pale = mix(sample(mapOf('marble_cliff_01_diff', true, BASE), 1 / 4.3), sample(mapOf('marble_cliff_01_diff', true, BASE), 1 / 13), smoothstep(-0.3, 0.3, big));
  const ochre = sample(mapOf('marble_cliff_03_diff', true, BASE), 1 / 9);
  const stained = mix(pale, ochre, smoothstep(0.15, 0.45, mx_noise_float(vec3(p.x.mul(0.08), p.y.mul(0.06), p.z.mul(0.08)))).mul(0.4));
  return mix(vec3(luminance(stained)), stained, 0.55).mul(vec3(1.08, 1.06, 1.02));
}

/**
 * The bedrock in a cut, at u (along the cut, and up; m): the cliffs' rock, as a crater's sides and
 * a broken slab of it show it.
 */
export function rockFace(u: Vec2): Vec3 {
  return cliff((t, scale) => texture(t, u.mul(scale)).rgb, vec3(u.x, u.y, 0));
}

/** The terra rossa under the grass in a cut, at u (m): a crater's sides, a clod's faces. */
export function soilFace(u: Vec2): Vec3 {
  return texture(mapOf('temple_earth_diff', true, BASE), u).rgb.mul(color(0xf0e6dc));
}

/** The land at p (world) on a surface facing n: its colour and roughness. */
export function landLook(p: Vec3, n: Vec3): { color: Vec3; roughness: Float } {
  const grass = top(mapOf('temple_ground_diff', true, BASE), p, 0.25);
  const grassFar = top(mapOf('temple_ground_diff', true, BASE), p, 0.031);
  const r = float(p.xz.length());
  // Bare rock in patches, more of it toward the cliff tops and where feet have worn the ground
  const patches = mx_fractal_noise_float(vec3(p.x.mul(0.045), p.z.mul(0.045), 0.3), 3, 2, 0.5);
  const edge = smoothstep(12, 0, p.x.add(38)).max(smoothstep(12, 0, p.z.add(34)));
  // Along the sacred way and round the temple, worn spots rather than bands
  const spots = smoothstep(0.05, 0.45, mx_fractal_noise_float(vec3(p.x.mul(0.32), p.z.mul(0.32), 2.2), 2, 2, 0.5));
  const worn = smoothstep(9, 2, abs(p.z.sub(4)).max(p.x.sub(34)).max(float(17).sub(p.x))).mul(0.45).mul(spots);
  const temple = smoothstep(4, 0, max(abs(p.x.add(4)).sub(13.5), abs(p.z.add(4)).sub(8))).mul(0.4).mul(spots);
  // The rock's edge broken up at a finer grain, and soft over a few tenths of a metre
  const ragged = mx_fractal_noise_float(vec3(p.x.mul(0.9), p.z.mul(0.9), 4.4), 3, 2, 0.5).mul(0.1);
  const rockMask = smoothstep(0.6, 0.82, patches.add(edge.mul(0.35)).add(worn).add(temple).add(ragged));
  // Broad patches: browner earth here, greyer dry scrub there
  const broad = mx_fractal_noise_float(vec3(p.x.mul(0.018), p.z.mul(0.018), 5.1), 3, 2, 0.5);
  const tone = mix(mix(vec3(1), vec3(0.86, 0.8, 0.7), smoothstep(0.05, 0.4, broad)), vec3(0.78, 0.82, 0.7), smoothstep(-0.05, -0.4, broad));
  // And at a finer scale, the grass a little greener (olive) or more straw, lighter or darker
  const hue = mx_fractal_noise_float(vec3(p.x.mul(0.06), p.z.mul(0.06), 8.3), 2, 2, 0.5);
  const value = mx_fractal_noise_float(vec3(p.x.mul(0.09), p.z.mul(0.09), 1.9), 2, 2, 0.5).mul(0.24).add(1);
  const tuft = mix(mix(vec3(1), vec3(0.86, 0.92, 0.7), smoothstep(-0.1, -0.35, hue)), vec3(1.08, 1.02, 0.84), smoothstep(0.12, 0.35, hue)).mul(value);
  const near = mix(grass.mul(tone).mul(tuft), bedrock(p), rockMask);
  // Far off: the same ground at a coarser grain, ochre, with dark scrub (macchia) in clumpy
  // patches, the ground's own grain showing through, darkened and greened
  const clumps = mx_fractal_noise_float(vec3(p.x.mul(0.012), p.z.mul(0.012), 1.7), 3, 2, 0.5).add(mx_noise_float(vec3(p.x.mul(0.15), p.z.mul(0.15), 0.6)).mul(0.18));
  const scrubMask = smoothstep(0.0, 0.2, clumps);
  const far = mix(grassFar.mul(vec3(0.92, 0.84, 0.7)).mul(tone), grassFar.mul(vec3(0.34, 0.4, 0.24)), scrubMask.mul(0.9));
  const flat = mix(near, far, smoothstep(60, 160, r));
  // Steep faces are cliff rock; at the foot, wet dark rock and a ragged line of foam
  const steep = smoothstep(0.78, 0.5, n.y);
  let col: Vec3 = mix(flat, cliff((t, scale) => triplanar(t, p, n, scale), p).mul(1.05), steep);
  const wet = smoothstep(SEA + 3.5, SEA + 0.3, p.y);
  col = col.mul(mix(float(1), float(0.55), wet));
  const foam = smoothstep(SEA + 1.2, SEA + 0.1, p.y).mul(smoothstep(-0.2, 0.35, mx_noise_float(vec3(p.x.mul(0.9), p.z.mul(0.9), time.mul(0.4)))));
  return { color: mix(col, vec3(0.92, 0.94, 0.95), foam), roughness: mix(float(0.95), float(0.8), steep.max(wet)) };
}
