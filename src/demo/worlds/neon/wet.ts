// The wet street. Its look: the asphalt, puddles placed by a mask that doesn't repeat with it, rain
// rings on them, gutters, drains and manholes, all in one shader (wetStreet), for the slabs of the
// alley's breakable ground (its asphalt over a concrete base, laid here: layGround) and for the
// street drawn past them, so the two meet without a seam; on the slabs it goes by where on the
// alley a point was laid (pieceFrame), so it stays on the chunks a blast throws.
//
// Its reflections of the signs: the demo's screen-space reflections don't reach the ground here
// (rays from the street miss the signs above it), so the street's shader reflects the lights
// itself: each sign, lit shop and lantern is a glowing upright strip (where it is, how wide, from
// what height to what height, its colour), and every street pixel adds what its reflected ray
// passes near. The spread grows with roughness and distance, more along the view than across it,
// so a sign shows as a streak down the street, as on wet asphalt; sharper in the puddles. The sum
// is compressed, so a puddle under many lights doesn't fill with flat colour. The strips follow the
// street's power and dim as their pieces fall; only the nearest few dozen are drawn, and only on
// what of the street still stands.
//
// Where bullets struck it: a hole in wet asphalt at night is dark on dark, so the street draws round
// each the pale, dry crushed aggregate a round leaves (the demo's mark still darkens its middle).

import { abs, atan, cameraPosition, dot, exp, float, floor, Fn, fract, hash, If, int, length, Loop, max, min, mix, mx_noise_float, normalize, positionWorld, reflect, select, sin, smoothstep, step, storage, texture, time, transformNormalToView, uint, uniform, uniformArray, uv, vec2, vec3 } from 'three/tsl';
import * as THREE from 'three/webgpu';
import { type BreakableMaterial, type Destruction, groundPresets, type Piece, pieceFrame, pieceState, type V3 } from '../../../lib/index.ts';
import { inside, texture as mapOf, textured } from '../../textures.ts';
import { FRONT, GROUND } from './layout.ts';
import { glow } from './materials.ts';
import { signs } from './signs.ts';

const base = 'packs/neon/textures/';

type Float = THREE.Node<'float'>;
type Vec2 = THREE.Node<'vec2'>;
type Vec3 = THREE.Node<'vec3'>;

/** Strips the shader takes at once (each street pixel loops over them), and how far from the eye they're kept. */
const MAX = 48;
const RANGE = 30;

/** Per strip: its ends on the ground (x0, z0, x1, z1), colour × strength, and (bottom, top). */
const stripEnds = uniformArray(Array.from({ length: MAX }, () => new THREE.Vector4()), 'vec4');
const stripColor = uniformArray(Array.from({ length: MAX }, () => new THREE.Vector4()), 'vec4');
const stripSpan = uniformArray(Array.from({ length: MAX }, () => new THREE.Vector4()), 'vec4');
const count = uniform(0, 'int');

interface Strip {
  /** Its ends (x, z): along a facade for a flat sign, out from it for a blade. */
  ends: [number, number, number, number];
  y0: number;
  y1: number;
  color: THREE.Color;
  /** The glowing pieces it stands for (it dims as they go), and its sign (the flicker). */
  pieces: Piece[];
  sign: number;
  /** How much it counts when there are more strips in range than the shader takes. */
  weight: number;
}

/** Every strip in the alley; the shader gets the nearest that count most. */
const strips: Strip[] = [];

/** The light a street pixel at g (world xz) reflects along r (unit, up), at this roughness. */
export const signReflections = Fn(([g, r, rough]: [THREE.Node<'vec2'>, THREE.Node<'vec3'>, THREE.Node<'float'>]) => {
  const sum = vec3(0).toVar();
  const flat = max(length(r.xz), 0.001);
  const dir = r.xz.div(flat);
  const slope = r.y.div(flat);
  // Angular spread along the view and across it
  const along = rough.mul(0.9).add(0.03);
  // Across the view: hardly any spread in a puddle, a little more on the wet asphalt
  const across = rough.mul(0.16).add(0.001);
  Loop({ start: int(0), end: count }, ({ i }) => {
    const e = stripEnds.element(i) as unknown as THREE.Node<'vec4'>;
    const c = stripColor.element(i) as unknown as THREE.Node<'vec4'>;
    const span = stripSpan.element(i) as unknown as THREE.Node<'vec4'>;
    // Where the strip passes nearest the ray's line (on the ground): its sides of the line at
    // each end, and the point between them where it crosses (or the nearer end)
    const d0 = e.xy.sub(g);
    const d1 = e.zw.sub(g);
    const c0 = d0.x.mul(dir.y).sub(d0.y.mul(dir.x));
    const c1 = d1.x.mul(dir.y).sub(d1.y.mul(dir.x));
    const cross = c0.mul(c1).lessThan(0);
    const t = select(cross, c0.div(c0.sub(c1)), select(abs(c0).lessThan(abs(c1)), float(0), float(1)));
    const near = mix(d0, d1, t);
    const far = dot(near, dir);
    If(far.greaterThan(0.2), () => {
      const off = select(cross, float(0), min(abs(c0), abs(c1)));
      const y = far.mul(slope);
      const sy = far.mul(along).add(0.1);
      const up = smoothstep(span.x.sub(sy), span.x, y).mul(smoothstep(span.y.add(sy), span.y, y));
      const sx = far.mul(across).add(0.03);
      const side = exp(off.div(sx).pow2().negate());
      // The same light spread over more street is fainter
      const h = span.y.sub(span.x);
      const keep = h.add(0.2).div(h.add(sy.mul(2))).mul(float(0.08).div(sx.add(0.05)).min(1));
      sum.addAssign(c.xyz.mul(up.mul(side).mul(keep)));
    });
  });
  // Compressed (a soft knee at 2.5): where many lights overlap, the puddle brightens but keeps its
  // streaks rather than saturating into a flat fill
  return float(1).sub(exp(sum.mul(glow.power).div(-2.5))).mul(2.5);
});

/** A strip from glowing pieces' bounds (or a given box), at `strength` × its colour, along its longer side. */
function strip(pieces: Piece[], color: number, strength: number, sign: number, box?: { min: number[]; max: number[] }): void {
  let lo = box?.min ?? [Infinity, Infinity, Infinity];
  let hi = box?.max ?? [-Infinity, -Infinity, -Infinity];
  if (!box)
    for (const p of pieces) {
      lo = lo.map((v, k) => Math.min(v, p.bounds.min[k]));
      hi = hi.map((v, k) => Math.max(v, p.bounds.max[k]));
    }
  if (!Number.isFinite(lo[0])) return;
  const [cx, cz] = [(lo[0] + hi[0]) / 2, (lo[2] + hi[2]) / 2];
  const ends: Strip['ends'] = hi[0] - lo[0] > hi[2] - lo[2] ? [lo[0], cz, hi[0], cz] : [cx, lo[2], cx, hi[2]];
  const c = new THREE.Color(color).multiplyScalar(strength);
  const weight = (c.r + c.g + c.b) * (hi[1] - lo[1] + 0.3) * (Math.hypot(ends[2] - ends[0], ends[3] - ends[1]) + 0.4);
  strips.push({ ends, y0: lo[1], y1: hi[1], color: c, pieces, sign, weight });
}

/** In the alley (where the street can see it). */
const inAlley = (s: Strip) => s.ends[0] > -27 && s.ends[0] < 31.5 && Math.abs(s.ends[1]) < FRONT + 0.6;

/**
 * After building: the strips of the signs, the lit shops (each glowing on the street before it)
 * and the lanterns, each a narrow strip of its own (a whole string as one strip mirrored in a
 * puddle as a flat red slab).
 */
export function collectStrips(shops: Array<{ lamps: Piece[]; min: number[]; max: number[]; color: number }>, lanterns: Piece[][]): void {
  strips.length = 0;
  signs.forEach((s, i) => {
    const lit = s.pieces.filter((p) => glow.lit(p));
    if (!lit.length) return;
    const lightbox = lit.filter((p) => p.materialName === 'lightbox').length > lit.length / 2;
    strip(lit, s.color, lightbox ? 0.9 : 1.4, i);
  });
  for (const s of shops) strip(s.lamps, s.color, 0.5, -1, s);
  for (const l of lanterns.flat()) {
    const [x, y0, z] = [l.pose.position[0], l.bounds.min[1], l.pose.position[2]];
    strip([l], l.tint[1] > l.tint[0] * 0.15 ? 0xffa040 : 0xff3a1a, 0.25, -1, { min: [x - 0.175, y0, z - 0.175], max: [x + 0.175, l.bounds.max[1], z + 0.175] });
  }
  const kept = strips.filter(inAlley);
  strips.length = 0;
  strips.push(...kept);
  count.value = 0;
}

const active: Strip[] = [];

/**
 * Each frame: the strips within RANGE of the eye that count most, each as bright as the share of
 * its pieces still lit (× its sign's level now: the hotel sign's flicker, a sign the gun struck).
 */
export function updateStrips(eye: THREE.Vector3, levels: Map<number, number>): void {
  active.length = 0;
  for (const s of strips) {
    const [x, z] = [(s.ends[0] + s.ends[2]) / 2, (s.ends[1] + s.ends[3]) / 2];
    if (Math.hypot(x - eye.x, z - eye.z) < RANGE) active.push(s);
  }
  if (active.length > MAX) active.sort((a, b) => b.weight - a.weight);
  const n = Math.min(MAX, active.length);
  for (let i = 0; i < n; i++) {
    const s = active[i];
    let lit = 0;
    for (const p of s.pieces) if (glow.lit(p)) lit++;
    const k = (lit / s.pieces.length) * Math.min(1.2, levels.get(s.sign) ?? 1);
    (stripEnds.array[i] as THREE.Vector4).set(...s.ends);
    (stripColor.array[i] as THREE.Vector4).set(s.color.r * k, s.color.g * k, s.color.b * k, 0);
    (stripSpan.array[i] as THREE.Vector4).set(s.y0, s.y1, 0, 0);
  }
  count.value = n;
}

/**
 * The strikes' marks: a grid of 0.25 m cells over the street (x -46 to 32, z ±12: the alley, the
 * street past its mouth, the lane's foot), each keeping the last four marks that reach into it (x,
 * z, a seed, 1), so a street pixel looks in its own cell only. A mark reaches RADIUS from where it
 * struck: crushed aggregate to about half that, a powder of it beyond.
 */
const MARKS = { x0: -46, z0: -12, cell: 0.25, nx: 312, nz: 96, per: 4, radius: 0.2 };
const marks = new Float32Array(MARKS.nx * MARKS.nz * MARKS.per * 4);
const marksAttr = new THREE.StorageBufferAttribute(marks, 4);
const marksNode = storage(marksAttr, 'vec4', marks.length / 4).toReadOnly();
/** Each cell's next slot. */
const markNext = new Uint8Array(MARKS.nx * MARKS.nz);
let markDirty: number[] = [];

/** A round struck the street's top at `at` (the slabs', or the street's past them): its mark. */
export function markStrike(at: V3): void {
  const { x0, z0, cell, nx, nz, per, radius } = MARKS;
  const seed = Math.random();
  const [i0, i1] = [Math.max(0, Math.floor((at[0] - radius - x0) / cell)), Math.min(nx - 1, Math.floor((at[0] + radius - x0) / cell))];
  const [j0, j1] = [Math.max(0, Math.floor((at[2] - radius - z0) / cell)), Math.min(nz - 1, Math.floor((at[2] + radius - z0) / cell))];
  for (let j = j0; j <= j1; j++)
    for (let i = i0; i <= i1; i++) {
      const c = j * nx + i;
      const slot = c * per + (markNext[c]++ % per);
      marks.set([at[0], at[2], seed, 1], slot * 4);
      markDirty.push(slot);
    }
}

/** Each frame: the marks made since go to the GPU (only the slots that changed). */
export function updateMarks(): void {
  if (!markDirty.length) return;
  markDirty.sort((a, b) => a - b);
  let [a, b] = [markDirty[0], markDirty[0]];
  const flush = () => marksAttr.addUpdateRange(a * 4, (b - a + 1) * 4);
  for (const k of markDirty) {
    if (k <= b + 8) b = Math.max(b, k);
    else {
      flush();
      a = b = k;
    }
  }
  flush();
  marksAttr.needsUpdate = true;
  markDirty = [];
}

/** How much of a strike's crushed aggregate (x) and of its powder (y) is at xz, 0 to 1. */
function strikes(xz: Vec2): Vec2 {
  const { x0, z0, cell, nx, nz, per, radius } = MARKS;
  const c = floor(xz.sub(vec2(x0, z0)).div(cell));
  const inside = step(0, c.x).mul(step(c.x, nx - 1)).mul(step(0, c.y)).mul(step(c.y, nz - 1));
  const first = uint(c.y.clamp(0, nz - 1).mul(nx).add(c.x.clamp(0, nx - 1))).mul(per);
  let crush: Float = float(0);
  let powder: Float = float(0);
  // Its edge broken up by the grain
  const grain = mx_noise_float(vec3(xz.div(0.015), 7.1)).mul(0.1);
  for (let k = 0; k < per; k++) {
    const m = marksNode.element(first.add(k)) as unknown as THREE.Node<'vec4'>;
    const d = xz.sub(m.xy);
    const s = m.z.mul(40);
    // Ragged, each its own way round (its seed)
    const th = atan(d.y, d.x);
    const jag = sin(th.mul(3).add(s)).mul(0.1).add(sin(th.mul(7).add(s.mul(1.7))).mul(0.08)).add(sin(th.mul(13).add(s.mul(2.3))).mul(0.05)).add(1);
    const r = length(d).div(radius).mul(jag).add(grain);
    crush = max(crush, smoothstep(0.58, 0.42, r).mul(m.w));
    powder = max(powder, smoothstep(1, 0.45, r).mul(m.w));
  }
  return vec2(crush, powder).mul(inside);
}

/**
 * A hash of an integer cell (a, b) and a salt, in [0, 1). TSL's hash takes a uint: negative or
 * fractional seeds collapse, so the cell is shifted positive and kept to exact integers.
 */
export const cellHash = (a: Float, b: Float, salt: number | Float) => hash(a.add(512).mul(1031).add(b.add(512).mul(1543)).add(salt));

/** Rain rings on standing water at xz: in hashed 0.4 m cells, each restarting every 0.6 to 1.2 s (bumps on its normal). */
function rainRings(xz: Vec2): Vec2 {
  const ripples = (offset: number) => {
    const q = xz.div(0.4).add(offset);
    const cell = floor(q);
    const f = fract(q);
    const h = cellHash(cell.x, cell.y, offset * 62);
    const centre = vec2(hash(h.mul(65536)), hash(h.mul(65536).add(65536))).mul(0.5).add(0.25);
    const t = fract(time.div(float(0.6).add(h.mul(0.6))).add(h));
    const toC = f.sub(centre);
    const r = length(toC);
    const ring = sin(r.sub(t.mul(0.32)).mul(42)).mul(smoothstep(0.07, 0, abs(r.sub(t.mul(0.32))))).mul(float(1).sub(t));
    return toC.div(max(r, 0.001)).mul(ring);
  };
  return ripples(0).add(ripples(0.5)).mul(0.15);
}

/**
 * The signs in the wet at xz (its normal n, its roughness, its rain rings, how much of it is
 * standing water), stronger at grazing angles, in the alley only. Broken up by the water: a ragged
 * sheen at two scales and the rain rings, so a reflection reads as streaks on water and not as a
 * painted shape.
 */
function glints(xz: Vec2, n: Vec3, rough: Float, rip: Vec2, water: Float): Vec3 {
  const view = normalize(positionWorld.sub(cameraPosition));
  const fresnel = float(1).sub(view.y.negate().clamp(0, 1)).pow(5).mul(0.96).add(0.04);
  const alley = step(-28, xz.x).mul(step(xz.x, 31)).mul(step(abs(xz.y), FRONT));
  const breakup = mx_noise_float(vec3(xz.div(0.45), 4.2)).mul(0.4).add(mx_noise_float(vec3(xz.div(0.12), 5.7)).mul(0.2)).add(0.95).sub(length(rip).mul(2.5)).clamp(0.15, 1.3);
  return signReflections(xz, reflect(view, normalize(mix(vec3(0, 1, 0), n, 0.5))), rough).mul(fresnel).mul(alley).mul(mix(float(0.85), float(1.25), water)).mul(breakup);
}

/**
 * A crater's floor (the bed, where it shows): rain pools there, muddy, flat but for the rain rings,
 * and mirrors the signs as the puddles in the street do.
 */
export function craterWater(m: THREE.MeshStandardNodeMaterial): THREE.MeshStandardNodeMaterial {
  const xz = positionWorld.xz;
  const rip = rainRings(xz);
  m.emissiveNode = glints(xz, normalize(vec3(rip.x, 1, rip.y.negate())), float(0.03), rip, float(1)).mul(0.7);
  return m;
}

/** The wet street's look at a point (wetStreet). */
interface Street {
  color: Vec3;
  /** World normal it's lit by (see wetStreet). */
  normal: Vec3;
  roughness: Float;
  emissive: Vec3;
  ao: Float;
}

/**
 * The wet street at a point: `xz` where on the street it is (world, as laid), `at` its maps'
 * coordinates there, `top` 1 on the street's surface (0 on a slab's side: plain wet asphalt, no
 * puddles, gutters or manholes), `lit` 1 where it reflects the signs (the surface of what stands).
 */
export function wetStreet(xz: Vec2, at: Vec2, top: Float, lit: Float): Street {
  // The asphalt (puddles filled in), its 4 m tile
  const armMap = mapOf('neon_asphalt_dry_arm', false, base);
  const diff = texture(mapOf('neon_asphalt_dry_diff', true, base), at).rgb;
  const arm = texture(armMap, at);
  const nrm = texture(mapOf('neon_asphalt_dry_nor_gl', false, base), at).xyz.mul(2).sub(1);
  const z = abs(xz.y);
  // Puddles: the mask turned and at 5.3 m (so it doesn't line up with the asphalt), its blobs
  // widened by sampling it blurred, where a slow noise lets them be. They gather along the crown's
  // low middle and in the gutters, and cover about a third of the alley.
  const [c, s] = [Math.cos(0.6), Math.sin(0.6)];
  const pm = vec2(xz.x.mul(c).sub(xz.y.mul(s)), xz.x.mul(s).add(xz.y.mul(c))).div(5.3);
  const maskMap = mapOf('neon_asphalt_puddle', false, base);
  const mask = max(texture(maskMap, pm).r, texture(maskMap, pm).level(float(5)).r.mul(2.2));
  const low = smoothstep(1.4, 0.2, z).mul(0.22).add(smoothstep(0.9, 0.2, abs(z.sub(FRONT - 0.7))).mul(0.18));
  const wet = smoothstep(0.15, 0.45, mx_noise_float(vec3(xz.div(9), 0.5)).mul(0.5).add(0.5).add(low));
  // Also shallow sheets of water where the noise runs high, with ragged edges
  const sheet = smoothstep(0.62, 0.68, mx_noise_float(vec3(xz.div(2.6), 1.7)).mul(0.5).add(0.5).add(low.mul(0.6)).add(mx_noise_float(vec3(xz.div(0.5), 3.1)).mul(0.05)));
  // Gutters along both facades, darker and smoother, with a drain every 6 m; two manholes
  const along = step(-26, xz.x).mul(step(xz.x, 30));
  const gutter = smoothstep(FRONT - 0.45, FRONT - 0.3, z).mul(along).mul(top);
  const drain = gutter.mul(step(fract(xz.x.add(1).div(6)), 0.09)).mul(step(FRONT - 0.32, z));
  const slots = step(0.5, fract(xz.x.mul(16)));
  const hole = (x: number, y: number) => length(xz.sub(vec2(x, y)));
  const man = max(step(hole(12, 0.8), 0.36), step(hole(-17, -0.6), 0.36)).mul(top);
  const manRing = max(step(abs(hole(12, 0.8).sub(0.3)), 0.025), step(abs(hole(-17, -0.6).sub(0.3)), 0.025)).mul(top);
  const hatch = step(0.5, fract(xz.x.add(xz.y).mul(9)));
  const p = max(smoothstep(0.1, 0.55, mask).mul(wet), sheet).mul(float(1).sub(gutter)).mul(float(1).sub(man)).mul(top);
  const rip = rainRings(xz);
  // Where rounds struck: crushed aggregate, pale, dry and grainy (the demo's hole darkens its
  // middle), and its powder round it, dry and dull; under standing water, half of it
  const hit = strikes(xz).mul(top).mul(float(1).sub(p.mul(0.5)));
  const grit = mx_noise_float(vec3(xz.div(0.012), 2.3)).mul(0.3).add(0.85);
  // The asphalt's grain kept low (sharp grain at this gloss breaks reflections into glitter), flat in the puddles, rings on them
  const bumps = nrm.xy.mul(float(0.3).mul(float(1).sub(p))).add(rip.mul(p));
  const n = normalize(vec3(bumps.x, nrm.z, bumps.y.negate()));
  const dark = vec3(0.13, 0.135, 0.14);
  // Wet asphalt is darker than dry, a puddle darker still
  let col = diff.mul(float(0.68).sub(p.mul(0.3)));
  col = mix(col, vec3(0.18, 0.18, 0.18), gutter.mul(0.7));
  col = mix(col, dark, max(drain.mul(slots), man.mul(float(0.7).add(hatch.mul(0.3)))));
  col = mix(col, vec3(0.05), manRing);
  col = mix(col, col.mul(2.2).add(0.02), hit.y.mul(0.7));
  col = mix(col, vec3(0.46, 0.44, 0.41).mul(grit), hit.x);
  // Wet everywhere, mirror-smooth in the puddles; the map's roughness only blurred, so the sheen
  // doesn't sparkle. This is what the reflections spread by
  const grain = texture(armMap, at).level(float(4)).g.sub(0.36).div(0.12).clamp(0, 1);
  let rough = mix(mix(float(0.16), float(0.24), grain), float(0.03), p);
  rough = mix(rough, float(0.22), gutter);
  rough = mix(rough, float(0.35), max(drain, man));
  rough = mix(rough, float(0.9), max(hit.x, hit.y.mul(0.6)));
  const emissive = glints(xz, n, rough, rip, p).mul(lit).mul(float(1).sub(max(hit.x, hit.y.mul(0.5))));
  // The material's own roughness stays out of the screen-space reflections' range: on the street
  // they only caught the rain near the eye (white dashes); the signs come from the strips instead.
  // It's lit as if turned to face -z, as the street drawn as one plane was (its normal, made in the
  // world's frame, was turned again with the plane): its colours and light were tuned so
  return { color: col, normal: vec3(n.x, n.z, n.y.negate()), roughness: max(rough, float(0.42)), emissive, ao: arm.r };
}

/** The asphalt's own normal on the tops of its standing slabs, and where (layGround puts it over the library's). */
let tops: { normal: Vec3; on: Float } | null = null;

/**
 * The asphalt: the wet street on the slabs' tops, laid by where on the alley each point was (the
 * layer's frame has its middle at the area's: x along the alley, z across it); plain wet asphalt
 * on their sides. The library draws its normals from the map (the grain at 0.3, as the street's).
 */
function asphaltSurface(): THREE.MeshStandardNodeMaterial {
  const m = new THREE.MeshStandardNodeMaterial({ metalness: 0, normalMap: mapOf('neon_asphalt_dry_nor_gl', false, base) });
  m.normalScale.set(0.3, 0.3);
  const { position, normal, halfExtents } = pieceFrame();
  const { standing, broken } = pieceState();
  const top = step(0.5, normal.y).mul(step(halfExtents.y.sub(0.01), position.y));
  const lit = top.mul(standing);
  const street = wetStreet(position.xz.add(vec2((GROUND.x0 + GROUND.x1) / 2, 0)), uv(), top, lit);
  m.colorNode = street.color;
  m.roughnessNode = street.roughness;
  m.emissiveNode = street.emissive;
  m.aoNode = mix(street.ao, float(1), broken);
  tops = { normal: transformNormalToView(street.normal), on: lit };
  return m;
}

/** The ground's materials: the wet asphalt, the concrete base under it, and the earth under that. */
export function groundMaterials(): Record<string, BreakableMaterial> {
  return {
    // Breaking to its grey aggregate, in chunks round a crater (a lighter edge than the wet top: the
    // crater's rim reads at night). Cells under 16 cm go as spray (minBodySize): under the gun at
    // 10 cm, a burst along the street left a trench of standing wedges, +226 pieces in 10 s
    asphalt: groundPresets.asphalt({ surface: asphaltSurface(), uvScale: 0.25, minBodySize: 0.16, inside: 0x9a958e, insideTexture: inside('gen_concrete_broken', 1.4) }),
    // Cast concrete under it: hard, in slabs and chunks, its broken faces the buildings' crushed concrete
    base: groundPresets.paving({ impact: 45, density: 2.3, minBodySize: 0.16, surface: textured('neon_concrete', { base, roughness: 0.75 }), uvScale: 0.5, inside: 0xd0ccc4, insideTexture: inside('gen_concrete_broken', 1.2) }),
    // The bed, a crater's floor: wet earth, as the scenery draws it (no piece is made of it: a
    // round into the floor strikes as it)
    earth: groundPresets.earth({ surface: textured('rocky_trail_02', { base, color: 0x6a645c, roughness: 0.35 }), uvScale: 0.5, inside: 0x4a443c }),
  };
}

/**
 * Lay the alley's ground, first in build(): what stands on it (the gate, the vending machines, the
 * clutter, the props) then stands on its slabs, and goes into a crater with them. Its maps are laid
 * from the world's origin, as the street's past it.
 */
export function layGround(d: Destruction): void {
  d.addGround({ material: 'asphalt', under: 'base', bed: 'earth', area: [GROUND.x0, -FRONT, GROUND.x1, FRONT], top: 0, depth: GROUND.depth, underDepth: GROUND.underDepth, cell: GROUND.cell, toss: GROUND.toss, textureFrame: { position: [0, 0, 0] } });
  // The library made the asphalt's mesh for its first slab, and drew the normals from the map: on
  // the standing tops, the street's own (flat in the puddles, their rain rings), so they shade as
  // the street drawn past the mouth does
  const m = d.materials.asphalt.surface as THREE.MeshStandardNodeMaterial;
  if (tops && m.normalNode) m.normalNode = select(tops.on.greaterThan(0.5), tops.normal, m.normalNode);
}
