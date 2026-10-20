// Visual effects for the destruction demo: the flash, fireball, sparks, embers, chips, flakes and,
// above all, the dust; and puffs of smoke or steam for a world's own vents, chimneys and fires. And
// the guns': bullets striking, muzzle flashes, casings, tracers, and marks left on surfaces (bullet
// holes, scorch marks: Decals, below).
//
// Two GPU particle systems, each simulated by a TSL compute kernel and drawn as one instanced
// sprite:
//   - puffs: big soft billboards (dust, smoke, fireball, flash glow, rocket trail). Each puff samples
//     a baked "cauliflower" atlas whose RGB holds a normal and AO and whose A holds density, so the
//     unlit sprite can be shaded like a lumpy volume by the sun and the sky. They fade where they
//     meet geometry (soft particles, from the depth buffer) and near the camera.
//   - bits: small quads (sparks streaked along their velocity, embers, tumbling chips, dust flakes)
//     with gravity, drag and a bounce on the ground.
// Both are drawn with premultiplied alpha, so one material is both an occluding smoke (alpha > 0)
// and an additive HDR glow (alpha 0, colour > 1, which blooms).
//
// Emission writes the new particles straight into a ring buffer on the CPU side and uploads only
// those slots (update ranges), the compute pass then owns them. Nothing is allocated per emission.

import * as THREE from 'three/webgpu';
import {
  Discard,
  Fn,
  If,
  abs,
  atan,
  cameraFar,
  cameraNear,
  cameraPosition,
  cameraViewMatrix,
  cameraWorldMatrix,
  cos,
  cross,
  dFdx,
  dFdy,
  dot,
  exp,
  float,
  fwidth,
  instanceIndex,
  instancedArray,
  length,
  max,
  mix,
  mx_noise_float,
  normalize,
  perspectiveDepthToViewZ,
  positionGeometry,
  positionView,
  pow,
  saturate,
  select,
  sin,
  smoothstep,
  sqrt,
  storage,
  texture,
  uint,
  uniform,
  uv,
  varying,
  vec2,
  vec3,
  vec4,
  viewportDepthTexture,
} from 'three/tsl';
import { B_POS, B_ROT, BODY_FLOATS } from 'three-avbd/advanced';
import { type Destruction, type MaterialKind, type Piece, signedDistance } from '../lib/index.ts';
import * as m3 from '../lib/math.ts';

export type V3 = [number, number, number];

export interface EffectsOptions {
  /** Total particle budget, split 40 % big puffs / 60 % small bits (default 10000). */
  maxParticles?: number;
  /** Direction toward the sun. Default: taken from the scene's first DirectionalLight, else (0.5, 0.8, 0.3). */
  sunDirection?: THREE.Vector3;
  /** Height of the ground plane that puffs and bits rest on (default 0). */
  groundY?: number;
  /**
   * What a bit falling from a point lands on (a height: the ground there, or what stands on it), for
   * the strikes and sprays not given a floor (default the ground plane).
   */
  floor?: (from: V3) => number;
  /** Air drift in m/s (default a light breeze). Also settable later through `effects.wind`. */
  wind?: THREE.Vector3;
  /** Fade puffs where they meet geometry, from the depth buffer (default true). */
  softParticles?: boolean;
  /** The renderer, to run the compute passes; if omitted it is picked up on the first render. */
  renderer?: THREE.Renderer;
  /** The explosion's cloud (default the dust's colours, as dense and lasting as it was made to). */
  smoke?: SmokeOptions;
  /** What dust is made of (default warm tans and greys, a material's colour blended in at 0.45). */
  dustPalette?: DustPalette;
  /** The pieces: marks on them (decal) go where they go, and onto their cells when they break (default none: marks stay put). */
  destruction?: Destruction;
  /** Most marks on surfaces at once (default 2048): the oldest fade out as new ones come. */
  decals?: number;
}

/** What a bullet struck, for how its strike looks (Effects.bullet). */
export interface BulletLook {
  /** What it is: sparks off metal, glittering bits off glass, earth off dirt, chips and powder off the rest. */
  kind: MaterialKind;
  /** Its chips' colour (default a grey; earth's brown for dirt). */
  chips?: number;
  /** Its dust's colour, blended over the dust palette as dust is (default the palette's; earth's for dirt). */
  dust?: number;
  /** The height its chips land on (default what's under it: EffectsOptions.floor, else the effects' ground). */
  floor?: number;
}

/** The cloud an explosion raises: the billow and the darker smoke rising out of it. */
export interface SmokeOptions {
  /** Its colour (default the dust palette's); the smoke rising out of it is a darker shade. */
  color?: THREE.ColorRepresentation;
  /** Density, times the default (1). */
  opacity?: number;
  /** How long it hangs, times the default (1: the billow 6–12 s). */
  life?: number;
  /** How big it is, times the default (1): fewer, smaller puffs below 1. */
  scale?: number;
}

/** The colours dust is made in. */
export interface DustPalette {
  /** The colours each puff is mixed from (default, or empty: tans and warm greys). */
  colors?: THREE.ColorRepresentation[];
  /** How far dust takes its material's own colour over the palette's, 0–1 (default 0.45). */
  blend?: number;
}

/** A puff of smoke or steam (Effects.puff): a vent, a chimney, a fire. */
export interface PuffOptions {
  /** Its colour as given, not mixed with the dust palette (default a light grey). */
  color?: THREE.ColorRepresentation;
  /** How fast it rises (m/s, default 0.8), slowing as it cools. */
  rise?: number;
  /** How big it grows (m across, default 1.5). */
  size?: number;
  /** Seconds it lasts (default 4). */
  life?: number;
  /** How dense, 0–1 (default 0.5). */
  opacity?: number;
  /** How it sets off (m/s, default still: the air takes it). */
  velocity?: V3;
}

// Static parameters per particle, in vec4s
const PUFF_STRIDE = 5;
const BIT_STRIDE = 4;
const FLASHES = 3;
/** dust() calls are merged within this distance (m) until the next update. */
const DUST_MERGE = 1.2;
const DUST_QUEUE = 128;

// Bit kinds
const SPARK = 0;
const CHIP = 1;
const EMBER = 2;
const FLAKE = 3;
const CASING = 4;

/** Earth's chips and dust where a bullet strikes the ground and the world gives no colours (sRGB). */
const DIRT = { chips: 0x8c7658, dust: 0xbca78a };
// Dust palette (sRGB): tan, grey-brown, light, warm
const DUST_PALETTE = [0xb8a48c, 0x8a8378, 0xc6b8a2, 0xa38e74, 0x9a9184];
/** How long warm()'s particles last (s). */
const WARM_LIFE = 0.3;

type Float4Buffer = THREE.StorageBufferNode<'vec4'>;

/** A ring buffer of particles: live state on the GPU, written slot by slot from the CPU. */
class Pool {
  readonly cap: number;
  readonly stride: number;
  readonly P: Float4Buffer; // pos.xyz, age
  readonly V: Float4Buffer; // vel.xyz, life
  readonly S: Float4Buffer; // static parameters, `stride` vec4s per particle
  readonly p: Float32Array;
  readonly v: Float32Array;
  readonly s: Float32Array;
  /** When each slot dies (seconds of effect time). */
  readonly death: Float32Array;
  readonly headU = uniform(0, 'uint');
  head = 0;
  lastDeath = -1;
  private start = 0;
  private pending = 0;

  constructor(cap: number, stride: number) {
    this.cap = cap;
    this.stride = stride;
    this.P = instancedArray(cap, 'vec4');
    this.V = instancedArray(cap, 'vec4');
    this.S = instancedArray(cap * stride, 'vec4');
    this.p = this.P.value.array as Float32Array;
    this.v = this.V.value.array as Float32Array;
    this.s = this.S.value.array as Float32Array;
    this.death = new Float32Array(cap);
  }

  /** Claim the next slot (the oldest particle is overwritten). */
  next(now: number, life: number): number {
    const i = this.head;
    if (this.pending === 0) this.start = i;
    if (this.pending < this.cap) this.pending++;
    this.head = (i + 1) % this.cap;
    const d = now + life;
    this.death[i] = d;
    if (d > this.lastDeath) this.lastDeath = d;
    return i;
  }

  /** Upload the slots written since the last flush. */
  flush(): void {
    this.headU.value = this.head;
    if (this.pending === 0) return;
    this.upload(this.P, 4);
    this.upload(this.V, 4);
    this.upload(this.S, 4 * this.stride);
    this.pending = 0;
  }

  /** Mark the pending slots of one buffer for upload (two ranges when they wrap around). */
  private upload(node: Float4Buffer, floatsPerSlot: number): void {
    const a = this.start;
    const n = this.pending;
    const first = Math.min(n, this.cap - a);
    const attr = node.value;
    attr.addUpdateRange(a * floatsPerSlot, first * floatsPerSlot);
    if (n > first) attr.addUpdateRange(0, (n - first) * floatsPerSlot);
    attr.needsUpdate = true;
  }

  /** Particles emitted since the last flush. */
  get emitted(): number {
    return this.pending;
  }

  live(now: number): number {
    if (now >= this.lastDeath) return 0;
    let n = 0;
    const d = this.death;
    for (let i = 0; i < d.length; i++) if (d[i] > now) n++;
    return n;
  }
}

/** What one puff is launched with (reused, so emitting allocates nothing). */
interface PuffSpec {
  x: number; y: number; z: number;
  vx: number; vy: number; vz: number;
  life: number;
  size0: number; size1: number; grow: number; spin: number;
  r: number; g: number; b: number; opacity: number;
  heat: number; heatTau: number; drag: number; buoy: number;
  fadeIn: number; fadeOut: number; turb: number;
  glow: number;
}

interface BitSpec {
  x: number; y: number; z: number;
  vx: number; vy: number; vz: number;
  life: number;
  r: number; g: number; b: number; kind: number;
  size: number; drag: number; gravity: number;
  /** The height it lands on (default the effects' ground). */
  floor: number | null;
}

interface Flash {
  light: THREE.PointLight;
  t: number;
  peak: number;
  active: boolean;
  /** A muzzle's or a bullet's: brief, and it never takes a blast's light. */
  minor: boolean;
  u: THREE.UniformNode<'vec4', THREE.Vector4>; // xyz, intensity
}

/**
 * The light a flash takes: an idle one, else the one furthest into its fade; a minor flash (a
 * muzzle's, a bullet's sparks) only another minor one, or none (never one a blast is using).
 */
export function flashLight<F extends Pick<Flash, 'active' | 'minor' | 't'>>(lights: readonly F[], minor: boolean): F | null {
  let f: F | null = null;
  for (const g of lights) {
    if (!g.active) return g;
    if ((!minor || g.minor) && (!f || g.t > f.t)) f = g;
  }
  return f;
}

const rand = (a: number, b: number): number => a + Math.random() * (b - a);

const _v = new THREE.Vector3();
const _n = new THREE.Vector3();
const _d = new THREE.Vector3();
const _c = new THREE.Color();
const _c2 = new THREE.Color();
const _t = new THREE.Color();
const _s = new THREE.Color();

/** Random unit vector into `out`. */
function randUnit(out: THREE.Vector3): THREE.Vector3 {
  const z = Math.random() * 2 - 1;
  const a = Math.random() * Math.PI * 2;
  const r = Math.sqrt(1 - z * z);
  return out.set(r * Math.cos(a), r * Math.sin(a), z);
}

/** Direction around `n`: n + spread * random unit, normalised. */
function around(n: THREE.Vector3, spread: number, out: THREE.Vector3): THREE.Vector3 {
  randUnit(out).multiplyScalar(spread).add(n);
  if (out.lengthSq() < 1e-6) out.copy(n);
  return out.normalize();
}

// ---------------------------------------------------------------------------------------------
// The puff atlas: 2x2 lumpy blobs. RG: normal (xy, view-aligned), B: thickness/AO, A: density.

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function valueNoise(seed: number): (x: number, y: number) => number {
  const r = mulberry32(seed);
  const perm = new Uint8Array(512);
  const val = new Float32Array(256);
  for (let i = 0; i < 256; i++) {
    perm[i] = i;
    val[i] = r();
  }
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    const t = perm[i];
    perm[i] = perm[j];
    perm[j] = t;
  }
  for (let i = 0; i < 256; i++) perm[i + 256] = perm[i];
  return (x, y) => {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const xf = x - xi;
    const yf = y - yi;
    const u = xf * xf * (3 - 2 * xf);
    const v = yf * yf * (3 - 2 * yf);
    const X = xi & 255;
    const Y = yi & 255;
    const a = val[perm[perm[X] + Y]];
    const b = val[perm[perm[X + 1] + Y]];
    const c = val[perm[perm[X] + Y + 1]];
    const d = val[perm[perm[X + 1] + Y + 1]];
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  };
}

function makePuffAtlas(cell: number): THREE.DataTexture {
  const N = cell * 2;
  const data = new Uint8Array(N * N * 4);
  const rnd = mulberry32(20240611);
  const noise = valueNoise(99);
  const fbm = (x: number, y: number): number => {
    let s = 0;
    let amp = 0.5;
    let f = 1;
    for (let o = 0; o < 4; o++) {
      s += noise(x * f, y * f) * amp;
      f *= 2.03;
      amp *= 0.5;
    }
    return s / 0.9375;
  };
  const H = new Float32Array(cell * cell);
  const blobs: number[] = [];
  const smooth = (e0: number, e1: number, x: number): number => {
    const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
    return t * t * (3 - 2 * t);
  };

  const B = new Float32Array(cell * cell);
  // Separable box blur of H, twice (close to a gaussian): rounds off the creases where lobes meet
  const blur = (radius: number): void => {
    const w = 1 / (2 * radius + 1);
    for (let pass = 0; pass < 2; pass++) {
      for (let y = 0; y < cell; y++) {
        for (let x = 0; x < cell; x++) {
          let sum = 0;
          for (let k = -radius; k <= radius; k++) sum += H[y * cell + Math.min(cell - 1, Math.max(0, x + k))];
          B[y * cell + x] = sum * w;
        }
      }
      for (let y = 0; y < cell; y++) {
        for (let x = 0; x < cell; x++) {
          let sum = 0;
          for (let k = -radius; k <= radius; k++) sum += B[Math.min(cell - 1, Math.max(0, y + k)) * cell + x];
          H[y * cell + x] = sum * w;
        }
      }
    }
  };

  for (let c = 0; c < 4; c++) {
    // A union of hemispheres: a core, big lobes around it, smaller lobes on the rim
    blobs.length = 0;
    blobs.push(rand2(rnd, -0.02, 0.02), rand2(rnd, -0.04, 0.0), 0.24 + rnd() * 0.04);
    const big = 5 + Math.floor(rnd() * 3);
    for (let i = 0; i < big; i++) {
      const a = (i / big) * Math.PI * 2 + rnd() * 0.7;
      const r = 0.11 + rnd() * 0.08;
      const d = Math.min(0.42 - r, 0.13 + rnd() * 0.12);
      blobs.push(Math.cos(a) * d, Math.sin(a) * d * 0.92, r);
    }
    const rim = 7 + Math.floor(rnd() * 4);
    for (let i = 0; i < rim; i++) {
      const a = rnd() * Math.PI * 2;
      const r = 0.06 + rnd() * 0.05;
      const d = Math.min(0.44 - r, 0.24 + rnd() * 0.14);
      blobs.push(Math.cos(a) * d, Math.sin(a) * d * 0.92, r);
    }
    const ox = c * 37.1;
    const oy = c * 11.7;
    for (let y = 0; y < cell; y++) {
      const py = (y + 0.5) / cell - 0.5;
      for (let x = 0; x < cell; x++) {
        const px = (x + 0.5) / cell - 0.5;
        let h = 0;
        for (let b = 0; b < blobs.length; b += 3) {
          const dx = px - blobs[b];
          const dy = py - blobs[b + 1];
          const r = blobs[b + 2];
          const q = r * r - dx * dx - dy * dy;
          if (q > 0) {
            const s = Math.sqrt(q);
            if (s > h) h = s;
          }
        }
        // Soft bumps on the surface (only where there is a surface)
        if (h > 0) h += (fbm(px * 9 + ox, py * 9 + oy) - 0.5) * 0.03 * smooth(0, 0.06, h);
        H[y * cell + x] = Math.max(0, h);
      }
    }
    blur(Math.max(1, Math.round(cell / 80)));
    const cx = (c & 1) * cell;
    const cy = (c >> 1) * cell;
    const step = 2 / cell;
    for (let y = 0; y < cell; y++) {
      const py = (y + 0.5) / cell - 0.5;
      for (let x = 0; x < cell; x++) {
        const px = (x + 0.5) / cell - 0.5;
        const h = H[y * cell + x];
        const hx0 = H[y * cell + Math.max(0, x - 1)];
        const hx1 = H[y * cell + Math.min(cell - 1, x + 1)];
        const hy0 = H[Math.max(0, y - 1) * cell + x];
        const hy1 = H[Math.min(cell - 1, y + 1) * cell + x];
        let nx = -(hx1 - hx0) / step;
        let ny = -(hy1 - hy0) / step;
        let nz = 1;
        let l = Math.hypot(nx, ny, nz);
        nx /= l;
        ny /= l;
        nz /= l;
        // Blend toward the whole puff's sphere normal so the lighting reads as one volume
        const sx = px / 0.48;
        const sy = py / 0.48;
        const sz = Math.sqrt(Math.max(0, 1 - sx * sx - sy * sy));
        nx = nx * 0.65 + sx * 0.35;
        ny = ny * 0.65 + sy * 0.35;
        nz = nz * 0.65 + sz * 0.35;
        l = Math.hypot(nx, ny, nz) || 1;
        nx /= l;
        ny /= l;
        // Density: soft, eroded edge; some see-through variation inside
        const ero = fbm(px * 5 + ox + 5.3, py * 5 + oy + 1.7);
        const inner = fbm(px * 3.5 + ox + 9.1, py * 3.5 + oy + 3.3);
        let dens = smooth(0.0, 0.22, h + (ero - 0.5) * 0.15);
        dens *= 0.65 + 0.35 * inner;
        const thick = Math.min(1, h / 0.26);
        const o = ((cy + y) * N + cx + x) * 4;
        data[o] = Math.round((nx * 0.5 + 0.5) * 255);
        data[o + 1] = Math.round((ny * 0.5 + 0.5) * 255);
        data[o + 2] = Math.round(thick * 255);
        data[o + 3] = Math.round(dens * 255);
      }
    }
  }
  const tex = new THREE.DataTexture(data, N, N, THREE.RGBAFormat, THREE.UnsignedByteType);
  tex.colorSpace = THREE.NoColorSpace;
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.needsUpdate = true;
  return tex;
}

/** How much to emit at a pool's fill fraction: all of it up to half full, down to 30 % when full. */
function loadFor(fill: number): number {
  return fill < 0.5 ? 1 : Math.max(0.3, 1 - (fill - 0.5) * 1.6);
}

function rand2(r: () => number, a: number, b: number): number {
  return a + r() * (b - a);
}

/**
 * The cloud over a section coming down (for dustRegion): the box round its pieces, the material
 * most of it is (by volume), whose colour the dust takes, and how much dust it raises for its size,
 * `amount(material)` (1: as much as any) averaged over its volume.
 */
export function collapseDust(pieces: Iterable<{ bounds: { min: V3; max: V3 }; materialName: string; volume: number }>, amount: (material: string) => number): { min: V3; max: V3; material: string; amount: number } {
  const min: V3 = [Infinity, Infinity, Infinity];
  const max: V3 = [-Infinity, -Infinity, -Infinity];
  const volumes = new Map<string, number>();
  let raised = 0;
  let total = 0;
  for (const p of pieces) {
    for (let k = 0; k < 3; k++) {
      min[k] = Math.min(min[k], p.bounds.min[k]);
      max[k] = Math.max(max[k], p.bounds.max[k]);
    }
    volumes.set(p.materialName, (volumes.get(p.materialName) ?? 0) + p.volume);
    raised += p.volume * amount(p.materialName);
    total += p.volume;
  }
  let material = '';
  for (const [m, v] of volumes) if (v > (volumes.get(material) ?? 0)) material = m;
  return { min, max, material, amount: total > 0 ? raised / total : 1 };
}

// ---------------------------------------------------------------------------------------------

// ---------------------------------------------------------------------------------------------
// Marks on surfaces: bullet holes and dents, pocks in the dirt, blasts' scorch marks.

/** The kinds of mark (Effects.decal). */
export type DecalKind = 'hole' | 'dent' | 'pock' | 'scorch';

/** A mark on a surface (Effects.decal). */
export interface DecalOptions {
  /** A bullet 'hole' (default), a 'dent' in metal, a 'pock' in the dirt, a blast's 'scorch'. */
  kind?: DecalKind;
  /** How far across (m; default the kind's: a hole 12 cm, a scorch 6 m). */
  size?: number;
  /** The piece it's on: it goes where the piece goes, and onto what's left of it when it breaks (default none: it stays where it is, as on the scenery). */
  piece?: Piece | null;
  /** The colour of what's crushed round a hole (the material's chips; default a light grey). */
  color?: THREE.ColorRepresentation;
}

/** Each kind's code (in the shader), size across and how far out of and into the surface it reaches (m). */
const DECAL_KINDS: Record<DecalKind, { code: number; size: number; depth: number }> = {
  hole: { code: 0, size: 0.12, depth: 0.04 },
  dent: { code: 1, size: 0.09, depth: 0.04 },
  pock: { code: 2, size: 0.16, depth: 0.06 },
  scorch: { code: 3, size: 6, depth: 1 },
};
/** Floats a decal: its centre and body slot (-1: the world), its turn, half sizes and kind, colour and seed. */
const DECAL_FLOATS = 16;
/** A scorch's soot at its middle (multiplied in, linear): one alone darkens what's there to a quarter. */
const SOOT: V3 = [0.25, 0.235, 0.22];
const _q = new THREE.Quaternion();
const _r = new THREE.Quaternion();
const Z = new THREE.Vector3(0, 0, 1);

/** vec4 quaternion products and turns, for the shader. */
function qmul(a: THREE.Node<'vec4'>, b: THREE.Node<'vec4'>): THREE.Node<'vec4'> {
  return vec4(b.xyz.mul(a.w).add(a.xyz.mul(b.w)).add(cross(a.xyz, b.xyz)), a.w.mul(b.w).sub(dot(a.xyz, b.xyz)));
}
function qrotate(q: THREE.Node<'vec4'>, v: THREE.Node<'vec3'>): THREE.Node<'vec3'> {
  const t = cross(q.xyz, v).mul(2);
  return v.add(t.mul(q.w)).add(cross(q.xyz, t));
}

/**
 * Where the decals are and what they're on (the CPU side of Decals): a ring of slots, each a
 * decal's floats in `data` (what the GPU draws from), the oldest written over first; which piece
 * each is on, so it follows that piece, goes onto the cell it was on when the piece breaks and is
 * dropped when the piece is gone; and which are scorches, so that blasts in one spot don't stack
 * them to black. It says which slots changed (`flush`).
 */
export class DecalSlots {
  readonly cap: number;
  readonly data: Float32Array;
  private head = 0;
  private written = 0;
  private dirty: number[] = [];
  /** The piece each decal is on (null: the world's), and the decals on each piece. */
  private readonly on: Array<Piece | null>;
  private readonly byPiece = new Map<Piece, Set<number>>();
  /** The scorches in the world (a blast's stays where it went off). */
  private readonly scorches = new Set<number>();
  /** Decals go on pieces (their bodies can be read on the GPU); if not, every one stays put. */
  private readonly follow: boolean;

  /** `data`: DECAL_FLOATS a slot, `cap` of them. */
  constructor(cap: number, data: Float32Array, follow: boolean) {
    this.cap = cap;
    this.data = data;
    this.follow = follow;
    this.on = new Array(cap).fill(null);
  }

  /** The slot the next decal goes in (the oldest), and how many slots have been used (up to cap). */
  get next(): number {
    return this.head;
  }

  get filled(): number {
    return this.written;
  }

  /** A mark at `at` on a surface facing `normal` (see DecalOptions); its slot. */
  add(at: V3, normal: V3, o: DecalOptions = {}): number {
    const kind = DECAL_KINDS[o.kind ?? 'hole'];
    const i = this.head;
    this.head = (i + 1) % this.cap;
    this.written = Math.min(this.cap, this.written + 1);
    this.detach(i);
    this.scorches.delete(i);
    // Facing out of the surface, turned at random about it
    _q.setFromUnitVectors(Z, _v.set(normal[0], normal[1], normal[2]).normalize()).multiply(_r.setFromAxisAngle(Z, Math.random() * Math.PI * 2));
    let centre: V3 = [at[0], at[1], at[2]];
    let turn: m3.Q = [_q.x, _q.y, _q.z, _q.w];
    let slot = -1;
    const piece = this.follow && o.piece && o.piece.state !== 'gone' ? o.piece : null;
    if (piece) {
      // In its body's frame (a standing piece's pose is where its body is)
      centre = m3.toLocal(piece.pose.position, piece.pose.rotation, centre);
      turn = m3.multiply(m3.conjugate(piece.pose.rotation), turn);
      slot = piece.body.index;
      this.attach(i, piece);
    }
    const half = (o.size ?? kind.size) / 2;
    let tint: V3;
    if (kind === DECAL_KINDS.scorch) {
      // Its soot; those already round it go lighter
      tint = SOOT;
      if (!piece) {
        this.soften(centre, half);
        this.scorches.add(i);
      }
    } else {
      const c = _c.set(o.color ?? 0xb8b2a8);
      tint = [c.r, c.g, c.b];
    }
    // A prop is struck on its collider, which only roughly wraps what's drawn: its marks reach in further
    const depth = piece?.prop ? Math.max(kind.depth, 0.25) : kind.depth;
    this.write(i, centre, turn, slot, [half, half, depth], kind.code, tint, Math.random());
    return i;
  }

  /** A piece broke into `cells`: its decals go onto the cell each was on (or with what was turned to dust). */
  fractured(piece: Piece, cells: Piece[]): void {
    const list = this.byPiece.get(piece);
    if (!list) return;
    this.byPiece.delete(piece);
    const { position, rotation } = piece.pose;
    const d = this.data;
    for (const i of list) {
      const o = i * DECAL_FLOATS;
      const at = m3.toWorld(position, rotation, [d[o], d[o + 1], d[o + 2]]);
      const turn = m3.multiply(rotation, [d[o + 4], d[o + 5], d[o + 6], d[o + 7]]);
      // The cell it's on: the one its centre is in or on (within a couple of centimetres)
      let best: Piece | null = null;
      let near = 0.02;
      for (const cell of cells) {
        if (cell.state === 'gone') continue;
        const dist = signedDistance(cell.convex, at);
        if (dist < near) [near, best] = [dist, cell];
      }
      this.on[i] = null;
      if (!best) {
        this.hide(i);
        continue;
      }
      this.attach(i, best);
      const local = m3.toLocal(best.pose.position, best.pose.rotation, at);
      const t = m3.multiply(m3.conjugate(best.pose.rotation), turn);
      d.set([local[0], local[1], local[2], best.body.index, t[0], t[1], t[2], t[3]], o);
      this.dirty.push(i);
    }
  }

  /** Drop the marks on pieces that have gone (turned to dust, cleared). */
  drop(): void {
    for (const [piece, list] of this.byPiece) {
      if (piece.state !== 'gone') continue;
      for (const i of list) {
        this.on[i] = null;
        this.hide(i);
      }
      this.byPiece.delete(piece);
    }
  }

  /** What changed since the last call, as runs of floats in `data` to upload: [offset, count]. */
  flush(): Array<[number, number]> {
    if (!this.dirty.length) return [];
    this.dirty.sort((a, b) => a - b);
    const runs: Array<[number, number]> = [];
    let [s, e] = [this.dirty[0], this.dirty[0]];
    for (const k of this.dirty) {
      if (k <= e + 8) e = Math.max(e, k);
      else {
        runs.push([s * DECAL_FLOATS, (e - s + 1) * DECAL_FLOATS]);
        s = e = k;
      }
    }
    runs.push([s * DECAL_FLOATS, (e - s + 1) * DECAL_FLOATS]);
    this.dirty = [];
    return runs;
  }

  /** How many there are (shown or fading). */
  get count(): number {
    let n = 0;
    for (let i = 0; i < this.written; i++) if (this.data[i * DECAL_FLOATS + 8] > 0) n++;
    return n;
  }

  /**
   * A scorch of half size `half` going on at `at`: those round it go lighter, by up to half their
   * soot the nearer they are, so blasts in one spot darken it to about a tenth and no further.
   */
  private soften(at: V3, half: number): void {
    const d = this.data;
    for (const j of this.scorches) {
      const o = j * DECAL_FLOATS;
      const near = 1 - Math.hypot(d[o] - at[0], d[o + 1] - at[1], d[o + 2] - at[2]) / ((d[o + 8] + half) / 2);
      if (near <= 0) continue;
      for (let k = o + 12; k < o + 15; k++) d[k] = 1 - (1 - d[k]) * (1 - 0.5 * near);
      this.dirty.push(j);
    }
  }

  private write(i: number, centre: V3, turn: m3.Q, slot: number, half: V3, code: number, tint: V3, seed: number): void {
    this.data.set([centre[0], centre[1], centre[2], slot, turn[0], turn[1], turn[2], turn[3], half[0], half[1], half[2], code, tint[0], tint[1], tint[2], seed], i * DECAL_FLOATS);
    this.dirty.push(i);
  }

  private hide(i: number): void {
    this.data.fill(0, i * DECAL_FLOATS + 8, i * DECAL_FLOATS + 11);
    this.dirty.push(i);
  }

  private attach(i: number, piece: Piece): void {
    this.on[i] = piece;
    let list = this.byPiece.get(piece);
    if (!list) this.byPiece.set(piece, (list = new Set()));
    list.add(i);
  }

  /** The decal in slot `i` is let go of its piece (its slot is taken by a new one). */
  private detach(i: number): void {
    const piece = this.on[i];
    if (!piece) return;
    this.on[i] = null;
    const list = this.byPiece.get(piece);
    list?.delete(i);
    if (list && !list.size) this.byPiece.delete(piece);
  }
}

/**
 * The decals: each a box standing out of and into its surface, on a piece's body (read from the
 * solver's buffer, so it goes where the piece goes) or in the world, drawn only where the scene's
 * depth puts a surface inside it, facing its way. It multiplies what's drawn there (darker, or a
 * little lighter round a hole), so it takes the light where it is, and with nothing there it shows
 * nothing: it never hangs in the air. A ring: past `cap` the oldest go, fading out first.
 */
class Decals {
  readonly mesh: THREE.Mesh;
  readonly slots: DecalSlots;
  private readonly attr: THREE.StorageBufferAttribute;
  private readonly headU = uniform(0, 'uint');

  constructor(cap: number, world: Destruction['world'] | null, fogAt: (viewZ: THREE.Node<'float'>) => THREE.Node<'float'>, sceneDepth: THREE.Node<'vec4'>) {
    const D = instancedArray(cap * (DECAL_FLOATS / 4), 'vec4');
    this.attr = D.value as THREE.StorageBufferAttribute;
    this.slots = new DecalSlots(cap, this.attr.array as Float32Array, !!world?.bodyAttribute);
    const i = instanceIndex.mul(DECAL_FLOATS / 4);
    const d0 = D.element(i); // centre, body slot
    const d1 = D.element(i.add(1)); // turn
    const d2 = D.element(i.add(2)); // half sizes, kind
    const d3 = D.element(i.add(3)); // colour, seed
    // On a piece: its body's pose now, from the solver's buffer
    let at: THREE.Node<'vec3'> = vec3(0, 0, 0);
    let turn: THREE.Node<'vec4'> = vec4(0, 0, 0, 1);
    if (world?.bodyAttribute) {
      const per = BODY_FLOATS / 4;
      const bodies = storage(world.bodyAttribute, 'vec4', world.maxBodies * per).toReadOnly();
      const base = uint(max(d0.w, 0).add(0.5)).mul(per);
      const onBody = d0.w.greaterThan(-0.5);
      at = select(onBody, bodies.element(base.add(B_POS / 4)).xyz, vec3(0, 0, 0));
      turn = select(onBody, bodies.element(base.add(B_ROT / 4)) as unknown as THREE.Node<'vec4'>, vec4(0, 0, 0, 1));
    }
    const rot = qmul(turn, d1 as unknown as THREE.Node<'vec4'>);
    const centre = at.add(qrotate(turn, d0.xyz));
    // The oldest fade out before they go
    const rank = this.headU.add(cap * 2 - 1).sub(instanceIndex).mod(uint(cap));
    const vCentre = varying(centre);
    const vRot = varying(rot);
    const vHalf = varying(d2.xyz);
    const vKind = varying(d2.w);
    const vTint = varying(d3.xyz);
    const vSeed = varying(d3.w);
    const vOld = varying(float(1).sub(smoothstep(cap * 0.8, cap, float(rank))));

    const m = new THREE.MeshBasicNodeMaterial({ transparent: true, depthWrite: false, side: THREE.BackSide, fog: false });
    // Drawn where the box's far side is behind what's there (the surface may be inside it), and
    // multiplied in: the colour drawn there times the decal's
    m.depthFunc = THREE.GreaterEqualDepth;
    m.blending = THREE.CustomBlending;
    m.blendEquation = THREE.AddEquation;
    m.blendSrc = THREE.DstColorFactor;
    m.blendDst = THREE.ZeroFactor;
    m.blendSrcAlpha = THREE.ZeroFactor;
    m.blendDstAlpha = THREE.OneFactor;
    m.positionNode = centre.add(qrotate(rot, positionGeometry.mul(d2.xyz)));
    m.colorNode = Fn(() => {
      // What's drawn here, where it is (along this fragment's ray, as deep as the scene there), in
      // the decal's own frame (its box: -1 to 1)
      const view = positionView.mul(perspectiveDepthToViewZ(sceneDepth.x, cameraNear, cameraFar).div(positionView.z));
      const world = cameraWorldMatrix.mul(vec4(view, 1)).xyz;
      const inv = vec4(vRot.xyz.negate(), vRot.w);
      const local = qrotate(inv, world.sub(vCentre)).div(max(vHalf, vec3(1e-4, 1e-4, 1e-4)));
      // Not on the view model (its depth is squeezed up to the eye), nor on what faces across it
      const normal = normalize(cross(dFdx(world), dFdy(world)));
      const facing = abs(dot(normal, qrotate(vRot, vec3(0, 0, 1))));
      If(max(abs(local.x), max(abs(local.y), abs(local.z))).greaterThan(1).or(view.z.greaterThan(-0.15)), () => {
        Discard();
      });
      const q = local.xy;
      const r = length(q);
      const th = atan(q.y, q.x);
      const s = vSeed.mul(40);
      const jag = sin(th.mul(5).add(s)).mul(0.1).add(sin(th.mul(9).add(s.mul(1.7))).mul(0.06)).add(sin(th.mul(17).add(s.mul(2.3))).mul(0.035));
      const rj = r.mul(jag.add(1));
      const white = vec3(1, 1, 1);
      // A hole: a black core in a shadowed crater of what it broke (toward the material's colour),
      // a lighter chipped lip round it, powder dulling what's round that
      const hue = vTint.div(max(dot(vTint, vec3(0.2126, 0.7152, 0.0722)), 0.02)).min(vec3(2, 2, 2));
      const core = smoothstep(0.34, 0.24, rj);
      const crater = smoothstep(0.66, 0.46, rj);
      const lip = smoothstep(0.9, 0.72, rj.mul(jag.add(1))).mul(crater.oneMinus());
      const powder = smoothstep(1, 0.5, r.mul(jag.mul(1.6).add(1)));
      const hole = mix(mix(mix(mix(white, vec3(0.78, 0.78, 0.78), powder), mix(vec3(1.25, 1.25, 1.25), hue.mul(1.25), 0.15), lip), mix(vec3(0.42, 0.42, 0.42), hue.mul(0.42), 0.3), crater.mul(0.85)), vec3(0.03, 0.03, 0.03), core);
      // A dent: a dark dimple in a ring of bright scuffed metal
      const dimple = smoothstep(0.32, 0.12, rj);
      const scuff = smoothstep(0.62, 0.36, rj).mul(dimple.oneMinus());
      const dent = mix(mix(mix(white, vec3(0.8, 0.8, 0.8), smoothstep(1, 0.5, rj)), vec3(2, 2, 2), scuff), vec3(0.3, 0.3, 0.3), dimple);
      // A pock: soft dark earth thrown up round a darker pit
      const pock = mix(mix(white, vec3(0.55, 0.52, 0.48), smoothstep(1, 0.25, rj)), vec3(0.3, 0.28, 0.26), smoothstep(0.35, 0.1, rj));
      // A scorch: soot streaked out from the middle, in blotches (noise through its box, so it has
      // no grid on a surface turned any way); its tint is its soot at the middle
      const streak = sin(th.mul(7).add(s)).mul(0.18).add(sin(th.mul(13).add(s.mul(2.1))).mul(0.1)).add(sin(th.mul(23).add(s.mul(0.7))).mul(0.06));
      const blotch = mx_noise_float(local.mul(2.5).add(s)).mul(0.12).add(mx_noise_float(local.mul(7).sub(s)).mul(0.06));
      const soot = smoothstep(1, 0.3, r.mul(streak.add(1))).mul(blotch.add(0.86).min(1));
      const scorch = mix(white, vTint, soot);
      const look = select(vKind.lessThan(0.5), hole, select(vKind.lessThan(1.5), dent, select(vKind.lessThan(2.5), pock, scorch)));
      // Faded at the box's faces, on what's turned from it, when old, and in the fog
      const isScorch = vKind.greaterThan(2.5);
      const k = smoothstep(1, 0.6, abs(local.z))
        .mul(smoothstep(select(isScorch, 0.1, 0.25), select(isScorch, 0.4, 0.6), facing))
        .mul(vOld)
        .mul(fogAt(view.z).oneMinus());
      const out = mix(white, look, k);
      If(abs(out.r.sub(1)).add(abs(out.b.sub(1))).lessThan(0.004), () => {
        Discard();
      });
      return vec4(out, 1);
    })();
    const box = new THREE.BoxGeometry(2, 2, 2);
    this.mesh = new THREE.Mesh(box, m);
    this.mesh.name = 'fx-decals';
    this.mesh.frustumCulled = false;
    // Before the dust and the bits (it reads the depth of what's solid)
    this.mesh.renderOrder = 999;
    // One empty decal from the start: its pipeline is made with the rest, not at the first shot
    this.mesh.count = 1;
  }

  /** A mark at `at` on a surface facing `normal` (see DecalOptions). */
  add(at: V3, normal: V3, o: DecalOptions = {}): void {
    this.slots.add(at, normal, o);
    this.headU.value = this.slots.next;
  }

  /** Drop the marks on pieces that have gone; upload what changed. */
  update(): void {
    this.slots.drop();
    this.mesh.count = Math.max(1, this.slots.filled);
    const runs = this.slots.flush();
    if (!runs.length) return;
    for (const [offset, count] of runs) this.attr.addUpdateRange(offset, count);
    this.attr.needsUpdate = true;
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    (this.mesh.material as THREE.Material).dispose();
  }
}

// ---------------------------------------------------------------------------------------------
// Tracers: a bright streak flying from a gun's muzzle to where its bullet struck.

const TRACERS = 24;
/** How fast a tracer is seen to fly (m/s), how long its streak is (m) and how wide on screen (radians of view). */
const TRACER_SPEED = 520;
const TRACER_LENGTH = 7;
const TRACER_WIDTH = 0.0016;

class Tracers {
  readonly mesh: THREE.Mesh;
  private readonly list: Array<{ from: THREE.Vector3; dir: THREE.Vector3; distance: number; age: number }> = [];
  private readonly position: THREE.BufferAttribute;
  private live = 0;
  /** Frames drawn so far: the first few draw it empty, so its pipeline is made at load. */
  private frames = 0;

  constructor(fogAt: (viewZ: THREE.Node<'float'>) => THREE.Node<'float'>) {
    const geometry = new THREE.BufferGeometry();
    this.position = new THREE.BufferAttribute(new Float32Array(TRACERS * 4 * 3), 3);
    const uvs = new Float32Array(TRACERS * 8);
    const index: number[] = [];
    for (let k = 0; k < TRACERS; k++) {
      uvs.set([0, 0, 1, 0, 0, 1, 1, 1], k * 8);
      const v = k * 4;
      index.push(v, v + 1, v + 2, v + 2, v + 1, v + 3);
    }
    geometry.setAttribute('position', this.position);
    geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    geometry.setIndex(index);
    const m = new THREE.MeshBasicNodeMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false });
    // White-hot at the head, orange down the tail; soft across
    const across = uv().x.sub(0.5).abs().mul(2);
    const along = uv().y;
    const glow = float(1).sub(across).max(0).pow(2).mul(along.pow(2.2));
    m.colorNode = vec4(mix(vec3(9, 3.2, 0.8), vec3(16, 11, 6), along.pow(4)).mul(glow).mul(fogAt(positionView.z).oneMinus()), 1);
    this.mesh = new THREE.Mesh(geometry, m);
    this.mesh.name = 'fx-tracers';
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 1002;
  }

  add(from: V3, to: V3): void {
    const a = new THREE.Vector3(...from);
    const dir = new THREE.Vector3(...to).sub(a);
    const distance = dir.length();
    if (distance < 1) return;
    if (this.list.length >= TRACERS) this.list.shift();
    this.list.push({ from: a, dir: dir.divideScalar(distance), distance, age: 0 });
  }

  /** Fly them on, and lay each streak's quad across the view. */
  update(dt: number, camera: THREE.Camera): void {
    const eye = _v.setFromMatrixPosition(camera.matrixWorld);
    const p = this.position.array as Float32Array;
    p.fill(0);
    let n = 0;
    for (const t of this.list) {
      t.age += dt;
      const head = Math.min(t.distance, t.age * TRACER_SPEED);
      const tail = Math.max(0, head - TRACER_LENGTH);
      if (tail >= t.distance - 0.05) continue;
      const h = _n.copy(t.from).addScaledVector(t.dir, head);
      const w = h.distanceTo(eye) * TRACER_WIDTH;
      const side = _d.copy(h).sub(eye).cross(t.dir).normalize().multiplyScalar(w);
      const o = n * 12;
      for (const [k, at, sign] of [
        [0, tail, -1],
        [1, tail, 1],
        [2, head, -1],
        [3, head, 1],
      ] as const) {
        p[o + k * 3] = t.from.x + t.dir.x * at + side.x * sign;
        p[o + k * 3 + 1] = t.from.y + t.dir.y * at + side.y * sign;
        p[o + k * 3 + 2] = t.from.z + t.dir.z * at + side.z * sign;
      }
      n++;
    }
    // The spent ones go
    for (let k = this.list.length - 1; k >= 0; k--) {
      const t = this.list[k];
      if (t.age * TRACER_SPEED - TRACER_LENGTH >= t.distance - 0.05) this.list.splice(k, 1);
    }
    if (n || this.live) this.position.needsUpdate = true;
    this.live = n;
    // Drawn while one flies (and, empty, for the first frames: made at load, not at the first shot)
    this.mesh.visible = n > 0 || this.frames++ < 30;
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    (this.mesh.material as THREE.Material).dispose();
  }
}

export class Effects {
  /** Air drift in m/s; dust, smoke, embers and flakes follow it. */
  readonly wind: THREE.Vector3;
  /** The explosion's cloud (it can be changed at any time). */
  smoke: SmokeOptions;
  /** What dust is made of (it can be changed at any time). */
  dustPalette: DustPalette;

  private readonly scene: THREE.Scene;
  private readonly camera: THREE.Camera;
  private renderer: THREE.Renderer | null;
  private readonly puffs: Pool;
  private readonly bits: Pool;
  private readonly puffSprite: THREE.Sprite;
  private readonly bitSprite: THREE.Sprite;
  private readonly puffMaterial: THREE.SpriteNodeMaterial;
  private readonly bitMaterial: THREE.SpriteNodeMaterial;
  private readonly atlas: THREE.DataTexture;
  private readonly puffCompute: THREE.ComputeNode;
  private readonly bitCompute: THREE.ComputeNode;
  private readonly flashes: Flash[] = [];
  private readonly decals: Decals;
  private readonly tracers: Tracers;
  /** What's drawn so far, as depth: the puffs fade into it, the decals find their surfaces in it. */
  private readonly sceneDepth = viewportDepthTexture();
  private readonly fixedSun: THREE.Vector3 | null;
  private readonly floorUnder: ((from: V3) => number) | null;
  private sunLight: THREE.DirectionalLight | null = null;
  private hemiLight: THREE.HemisphereLight | null = null;
  private lightScanAt = -1;
  private time = 0;
  private lastDt = 1 / 60;
  private trailCarry = 0;
  private warmed = false;
  private disposed = false;
  private readonly sp: PuffSpec;
  private readonly bp: BitSpec;

  // Uniforms
  private readonly uDt = uniform(0);
  private readonly uTime = uniform(0);
  private readonly uGround: THREE.UniformNode<'float', number>;
  private readonly uWind = uniform(new THREE.Vector3());
  private readonly uSunDir = uniform(new THREE.Vector3(0.5, 0.8, 0.3).normalize());
  private readonly uSunCol = uniform(new THREE.Vector3(3, 2.85, 2.6));
  private readonly uSkyCol = uniform(new THREE.Vector3(1.2, 1.28, 1.4));
  private readonly uGroundCol = uniform(new THREE.Vector3(0.4, 0.35, 0.29));
  private readonly uFog = uniform(new THREE.Vector4(0, 0, 1, 0)); // mode (0 none, 1 linear, 2 exp2), near, far, density
  private readonly uFogColor = uniform(new THREE.Vector3());
  // The scene's environment map, boiled down to an up and a down radiance
  private envTex: THREE.Texture | null = null;
  private envOk = false;
  private readonly envUp = new THREE.Vector3();
  private readonly envDown = new THREE.Vector3();
  private readonly sprites: readonly THREE.Object3D[];
  // How full each pool was at the last update
  private puffFill = 0;
  private bitFill = 0;
  // This frame's dust() calls, merged by proximity: x, y, z, volume, r, g, b, tinted
  private readonly dq = new Float32Array(DUST_QUEUE * 8);
  private dqn = 0;

  constructor(scene: THREE.Scene, camera: THREE.Camera, options: EffectsOptions = {}) {
    this.scene = scene;
    this.camera = camera;
    this.renderer = options.renderer ?? null;
    this.fixedSun = options.sunDirection ?? null;
    if (this.fixedSun) this.uSunDir.value.copy(this.fixedSun).normalize();
    this.wind = options.wind ? options.wind.clone() : new THREE.Vector3(0.35, 0, 0.12);
    this.smoke = { ...options.smoke };
    this.dustPalette = { ...options.dustPalette };
    this.uGround = uniform(options.groundY ?? 0);
    this.floorUnder = options.floor ?? null;
    const soft = options.softParticles ?? true;

    const total = Math.max(256, options.maxParticles ?? 10000);
    const round64 = (n: number): number => Math.max(64, Math.ceil(n / 64) * 64);
    this.puffs = new Pool(round64(total * 0.4), PUFF_STRIDE);
    this.bits = new Pool(round64(total * 0.6), BIT_STRIDE);

    this.sp = {
      x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, life: 1, size0: 1, size1: 1, grow: 1, spin: 0,
      r: 1, g: 1, b: 1, opacity: 1, heat: 0, heatTau: 1, drag: 1, buoy: 0, fadeIn: 0.1, fadeOut: 0.5, turb: 0, glow: 0,
    };
    this.bp = { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, life: 1, r: 1, g: 1, b: 1, kind: SPARK, size: 0.05, drag: 0, gravity: 1, floor: null };

    // Flash lights: always in the scene (adding/removing lights recompiles every material)
    for (let i = 0; i < FLASHES; i++) {
      const light = new THREE.PointLight(0xffa060, 0, 30, 2);
      light.castShadow = false;
      light.name = 'fx-flash';
      scene.add(light);
      this.flashes.push({ light, t: 0, peak: 0, active: false, minor: false, u: uniform(new THREE.Vector4(0, -1000, 0, 0)) });
    }

    this.atlas = makePuffAtlas(192);
    this.puffCompute = this.makePuffCompute();
    this.bitCompute = this.makeBitCompute();
    this.puffMaterial = this.makePuffMaterial(soft);
    this.bitMaterial = this.makeBitMaterial();

    const capture = (renderer: unknown): void => {
      if (!this.renderer) this.renderer = renderer as THREE.Renderer;
    };
    this.puffSprite = new THREE.Sprite(this.puffMaterial);
    this.puffSprite.count = this.puffs.cap;
    this.bitSprite = new THREE.Sprite(this.bitMaterial);
    this.bitSprite.count = this.bits.cap;
    const fogAt = (z: THREE.Node<'float'>) => this.fogAt(z);
    this.decals = new Decals(Math.max(64, options.decals ?? 2048), options.destruction?.world ?? null, fogAt, this.sceneDepth);
    this.tracers = new Tracers(fogAt);
    options.destruction?.on('fracture', (e) => this.decals.slots.fractured(e.piece, e.pieces));
    for (const o of [this.decals.mesh, this.tracers.mesh]) scene.add(o);
    this.sprites = [this.puffSprite, this.bitSprite, this.decals.mesh, this.tracers.mesh];
    for (const [s, order, name] of [
      [this.puffSprite, 1000, 'fx-puffs'],
      [this.bitSprite, 1001, 'fx-bits'],
    ] as const) {
      s.frustumCulled = false;
      s.renderOrder = order;
      s.name = name;
      s.onBeforeRender = capture;
      scene.add(s);
    }
  }

  /** What's drawn (the puffs, the bits, the decals, the tracers), e.g. to put them on a layer a pre-pass skips. */
  get objects(): readonly THREE.Object3D[] {
    return this.sprites;
  }

  /** Number of live particles. */
  get count(): number {
    return this.puffs.live(this.time) + this.bits.live(this.time);
  }

  // -------------------------------------------------------------------------------------------
  // Emitters

  explosion(at: V3, normal: V3, scale = 1): void {
    const s = Math.max(0.05, scale);
    const n = _n.set(normal[0], normal[1], normal[2]);
    if (n.lengthSq() < 1e-8) n.set(0, 1, 0);
    n.normalize();
    const x = at[0];
    const y = at[1];
    const z = at[2];
    const lod = this.lod(at[0], at[1], at[2]) * this.bitLoad();
    const load = this.load();

    const p = this.sp;
    // Drawn in the order emitted: dust and smoke first, the fire over them, the flash on top

    // Dust: the big, slow, billowing part (the world's smoke settings scale its size, how long it
    // hangs and how dense it is, and may colour it)
    const k = load;
    const cloud = this.smoke;
    const cs = Math.max(0.05, cloud.scale ?? 1);
    const cl = cloud.life ?? 1;
    const co = cloud.opacity ?? 1;
    const tint = cloud.color !== undefined ? _s.set(cloud.color) : null;
    const dust = Math.round(110 * s * cs * k);
    const grow = 1 / Math.sqrt(k);
    for (let i = 0; i < dust; i++) {
      around(n, 1.05, _d);
      const f = Math.random();
      const sp = (1.2 + 9 * f * f * f) * Math.sqrt(s) * cs;
      randUnit(_v).multiplyScalar(0.7 * s * cs * Math.cbrt(Math.random()));
      this.setPuff(x + _v.x, y + _v.y, z + _v.z, _d.x * sp, _d.y * sp + 0.5, _d.z * sp);
      this.look(rand(6, 12) * cl, rand(0.9, 1.7) * s * cs, rand(4, 7.5) * s * cs * grow, rand(1.2, 2.8), rand(-0.25, 0.25), rand(0.5, 0.8) * co);
      this.moves(rand(1.3, 2.4), rand(0.05, 0.3), rand(0.15, 0.3), rand(0.25, 0.5), rand(0.45, 0.6));
      if (tint) this.shade(p, tint, rand(0.85, 1.08));
      else this.dustColor(p, false, 0, 0, 0);
      this.emitPuff();
    }
    // A darker smoke column that rises out of it
    const smoke = Math.round(10 * s * cs * k);
    const ss = Math.pow(s, 0.75) * cs;
    for (let i = 0; i < smoke; i++) {
      around(n, 0.6, _d);
      const sp = rand(1, 3);
      this.setPuff(x + n.x * s, y + n.y * s + rand(0, 1) * s, z + n.z * s, _d.x * sp, _d.y * sp + 1, _d.z * sp);
      this.look(rand(8, 12) * cl, rand(1.2, 2) * ss, rand(3.5, 5.5) * ss * grow, rand(2, 3.5), rand(-0.2, 0.2), rand(0.25, 0.4) * co);
      this.moves(rand(0.8, 1.4), rand(0.8, 1.3), 0.25, rand(0.3, 0.8), 0.5);
      if (tint) this.shade(p, tint, rand(0.55, 0.75));
      else {
        const g = rand(0.26, 0.36);
        p.r = g; p.g = g * 0.95; p.b = g * 0.9;
      }
      this.emitPuff();
    }

    // Fireball: hot puffs thrown out, cooling into dark smoke
    const fire = Math.round(20 * Math.min(2.5, s));
    for (let i = 0; i < fire; i++) {
      around(n, 0.9, _d);
      const sp = rand(2.5, 9) * Math.sqrt(s);
      const r0 = rand(0.1, 0.5) * s;
      this.setPuff(x + _d.x * r0, y + _d.y * r0, z + _d.z * r0, _d.x * sp, _d.y * sp, _d.z * sp);
      this.look(rand(1.2, 2.2), rand(0.7, 1.3) * s, rand(2.4, 4) * s, rand(0.2, 0.35), rand(-0.8, 0.8), rand(0.45, 0.7));
      this.moves(rand(3, 4.5), rand(0.8, 1.6), 0.15, 0.02, 0.55);
      this.hot(rand(1.0, 1.5), rand(0.2, 0.35), 0);
      const g = rand(0.1, 0.18);
      p.r = g; p.g = g * 0.95; p.b = g * 0.9;
      this.emitPuff();
    }

    // The flash: a point light and a big, brief additive glow
    this.flash(x + n.x * 0.8 * s, y + n.y * 0.8 * s, z + n.z * 0.8 * s, 900 * s * s, 30 * s);
    this.setPuff(x + n.x * 0.5 * s, y + n.y * 0.5 * s, z + n.z * 0.5 * s, 0, 0, 0);
    this.look(0.22, 4 * s, 9 * s, 0.07, 0, 0);
    this.moves(0, 0, 0, 0, 0.5);
    this.hot(2.2, 0.07, 1);
    this.rgb(p, 0x000000);
    this.emitPuff();

    // Sparks, embers, chips, flakes
    const b = this.bp;
    const sparks = Math.round(110 * s * lod);
    for (let i = 0; i < sparks; i++) {
      around(n, 1.0, _d);
      const sp = rand(7, 26) * Math.sqrt(s);
      this.setBit(x + n.x * 0.2, y + n.y * 0.2, z + n.z * 0.2, _d.x * sp, _d.y * sp + 2, _d.z * sp);
      const h = rand(0.7, 1.5);
      this.bit(rand(0.35, 1.3), SPARK, rand(0.035, 0.06), rand(0.6, 1.4), 1);
      b.r = 9 * h; b.g = 4.2 * h; b.b = 1.3 * h;
      this.emitBit();
    }
    const embers = Math.round(36 * s * lod);
    for (let i = 0; i < embers; i++) {
      around(n, 1.1, _d);
      const sp = rand(2, 8) * Math.sqrt(s);
      this.setBit(x + n.x * 0.3, y + n.y * 0.3, z + n.z * 0.3, _d.x * sp, _d.y * sp + 1.5, _d.z * sp);
      const h = rand(0.6, 1.2);
      this.bit(rand(1.5, 4), EMBER, rand(0.04, 0.08), rand(1.2, 2.2), rand(0.05, 0.2));
      b.r = 6 * h; b.g = 2.0 * h; b.b = 0.45 * h;
      this.emitBit();
    }
    const chips = Math.round(70 * s * lod);
    for (let i = 0; i < chips; i++) {
      around(n, 0.95, _d);
      const sp = rand(3, 14) * Math.sqrt(s);
      randUnit(_v).multiplyScalar(0.3 * s);
      this.setBit(x + _v.x, y + _v.y, z + _v.z, _d.x * sp, _d.y * sp + 2, _d.z * sp);
      this.bit(rand(4, 8), CHIP, rand(0.03, 0.12) * Math.sqrt(s), 0.15, 1);
      this.chipColor(b, 0x8a5a44);
      this.emitBit();
    }
    const flakes = Math.round(140 * s * lod);
    for (let i = 0; i < flakes; i++) {
      around(n, 1.2, _d);
      const sp = rand(0.5, 7) * Math.sqrt(s);
      randUnit(_v).multiplyScalar(1.2 * s * Math.cbrt(Math.random()));
      this.setBit(x + _v.x, y + _v.y, z + _v.z, _d.x * sp, _d.y * sp + 0.5, _d.z * sp);
      this.bit(rand(5, 11), FLAKE, rand(0.012, 0.03), rand(1.8, 3), rand(0.03, 0.08));
      this.dustColor(b, false, 0, 0, 0);
      this.emitBit();
    }
  }

  /**
   * A burst of sparks off a surface facing `normal`: electrics shorting (a neon sign torn down),
   * steel striking steel. `amount` scales the count; `color` tints them (default hot orange) and a
   * brief flash lights the spot.
   */
  sparks(at: V3, normal: V3, amount = 1, color = 0xffa040): void {
    const n = _n.set(normal[0], normal[1], normal[2]);
    if (n.lengthSq() < 1e-8) n.set(0, 1, 0);
    n.normalize();
    const lod = this.lod(at[0], at[1], at[2]) * this.bitLoad();
    const { r, g, b: bl } = _c.set(color);
    const b = this.bp;
    const floor = this.floorOff(at, n);
    const count = Math.round(60 * amount * lod);
    for (let i = 0; i < count; i++) {
      around(n, 1.1, _d);
      const sp = rand(2.5, 11);
      this.setBit(at[0] + n.x * 0.05, at[1] + n.y * 0.05, at[2] + n.z * 0.05, _d.x * sp, _d.y * sp + 1, _d.z * sp);
      const h = rand(0.8, 1.6) * 7;
      this.bit(rand(0.3, 1.1), SPARK, rand(0.025, 0.045), rand(0.8, 1.4), 1);
      b.r = r * h; b.g = g * h; b.b = bl * h;
      b.floor = floor;
      this.emitBit();
    }
    this.flash(at[0] + n.x * 0.3, at[1] + n.y * 0.3, at[2] + n.z * 0.3, 60 * amount, 6);
  }

  dust(at: V3, volume: number, color?: number): void {
    if (!(volume > 0)) return;
    // Queued: a blast turns many small pieces to dust in one frame, and they make better clouds
    // (and spare the pool) as a few bigger puffs than as many small ones
    const q = this.dq;
    let tr = 0;
    let tg = 0;
    let tb = 0;
    const tinted = color !== undefined ? 1 : 0;
    if (tinted) {
      _c.setHex(color as number);
      tr = _c.r; tg = _c.g; tb = _c.b;
    }
    let best = -1;
    let bestD = this.dqn < DUST_QUEUE ? DUST_MERGE * DUST_MERGE : Infinity;
    for (let k = 0; k < this.dqn; k++) {
      const o = k * 8;
      const d = (q[o] - at[0]) ** 2 + (q[o + 1] - at[1]) ** 2 + (q[o + 2] - at[2]) ** 2;
      if (d < bestD) {
        bestD = d;
        best = k;
      }
    }
    if (best < 0) {
      const o = this.dqn++ * 8;
      q[o] = at[0]; q[o + 1] = at[1]; q[o + 2] = at[2]; q[o + 3] = volume;
      q[o + 4] = tr; q[o + 5] = tg; q[o + 6] = tb; q[o + 7] = tinted;
      return;
    }
    const o = best * 8;
    const w = volume / (q[o + 3] + volume);
    q[o] += (at[0] - q[o]) * w;
    q[o + 1] += (at[1] - q[o + 1]) * w;
    q[o + 2] += (at[2] - q[o + 2]) * w;
    q[o + 3] += volume;
    if (tinted) {
      const wt = q[o + 7] ? w : 1;
      q[o + 4] += (tr - q[o + 4]) * wt;
      q[o + 5] += (tg - q[o + 5]) * wt;
      q[o + 6] += (tb - q[o + 6]) * wt;
      q[o + 7] = 1;
    }
  }

  private flushDust(): void {
    const q = this.dq;
    for (let k = 0; k < this.dqn; k++) {
      const o = k * 8;
      this.emitDust(q[o], q[o + 1], q[o + 2], q[o + 3], q[o + 7] > 0, q[o + 4], q[o + 5], q[o + 6]);
    }
    this.dqn = 0;
  }

  private emitDust(x: number, y: number, z: number, volume: number, tinted: boolean, tr: number, tg: number, tb: number): void {
    const r = Math.cbrt(Math.max(volume, 1e-5));
    const k = this.load();
    const count = Math.max(1, Math.min(40, Math.round((2 + 11 * r) * k)));
    const size1 = Math.min(7, 0.5 + 4 * r) / Math.sqrt(k);
    const p = this.sp;
    for (let i = 0; i < count; i++) {
      randUnit(_v).multiplyScalar(0.5 * r * Math.cbrt(Math.random()));
      randUnit(_d).multiplyScalar(rand(0.3, 1) * (0.4 + 2.2 * r));
      this.setPuff(x + _v.x, y + _v.y, z + _v.z, _d.x, _d.y + 0.3, _d.z);
      this.look(rand(4, 7) + 3 * Math.min(1, r), size1 * rand(0.35, 0.5), size1 * rand(0.8, 1.2), rand(0.9, 2), rand(-0.3, 0.3), rand(0.45, 0.7));
      this.moves(rand(1.2, 2), rand(0.0, 0.2), rand(0.15, 0.3), rand(0.1, 0.3), rand(0.45, 0.6));
      this.dustColor(p, tinted, tr, tg, tb);
      this.emitPuff();
    }
    const b = this.bp;
    const flakes = Math.round(Math.min(60, 4 + 30 * r) * this.lod(x, y, z) * this.bitLoad());
    for (let i = 0; i < flakes; i++) {
      randUnit(_v).multiplyScalar(0.6 * r);
      randUnit(_d).multiplyScalar(rand(0.2, 1.5));
      this.setBit(x + _v.x, y + _v.y, z + _v.z, _d.x, _d.y + 0.3, _d.z);
      this.bit(rand(4, 9), FLAKE, rand(0.012, 0.03), rand(1.8, 3), rand(0.03, 0.08));
      this.dustColor(b, tinted, tr, tg, tb);
      this.emitBit();
    }
  }

  dustRegion(min: V3, max: V3, amount: number, color?: number): void {
    const k = this.load();
    const want = Math.max(0, amount) * k;
    let count = Math.floor(want);
    if (Math.random() < want - count) count++;
    count = Math.min(count, 400);
    if (count === 0) return;
    const ex = Math.max(0.05, max[0] - min[0]);
    const ey = Math.max(0.05, max[1] - min[1]);
    const ez = Math.max(0.05, max[2] - min[2]);
    const size1 = Math.min(6, Math.max(0.9, Math.cbrt((ex * ey * ez) / count) * 3));
    const p = this.sp;
    const tinted = color !== undefined;
    if (tinted) _c2.setHex(color as number);
    const tr = _c2.r;
    const tg = _c2.g;
    const tb = _c2.b;
    for (let i = 0; i < count; i++) {
      randUnit(_d).multiplyScalar(rand(0.2, 1.2));
      this.setPuff(min[0] + Math.random() * ex, min[1] + Math.random() * ey, min[2] + Math.random() * ez, _d.x, Math.abs(_d.y) * 0.5, _d.z);
      this.look(rand(5, 10), size1 * rand(0.45, 0.6), size1 * rand(0.85, 1.3), rand(1.2, 2.5), rand(-0.25, 0.25), rand(0.3, 0.5));
      this.moves(rand(1, 1.8), rand(0.0, 0.15), rand(0.15, 0.3), rand(0.25, 0.6), rand(0.45, 0.6));
      this.dustColor(p, tinted, tr, tg, tb);
      this.emitPuff();
    }
    const b = this.bp;
    const flakes = Math.round(Math.min(120, count * 3) * this.lod((min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2) * this.bitLoad());
    for (let i = 0; i < flakes; i++) {
      randUnit(_d).multiplyScalar(rand(0.2, 1));
      this.setBit(min[0] + Math.random() * ex, min[1] + Math.random() * ey, min[2] + Math.random() * ez, _d.x, _d.y, _d.z);
      this.bit(rand(4, 9), FLAKE, rand(0.012, 0.03), rand(1.8, 3), rand(0.03, 0.08));
      this.dustColor(b, tinted, tr, tg, tb);
      this.emitBit();
    }
  }

  /**
   * Where bits thrown off a surface at `at` facing `n` land, by the options' floor: what's under a
   * point just off it (not the surface itself, a wall's or a beam's). Null: the effects' ground.
   */
  private floorOff(at: V3, n: THREE.Vector3): number | null {
    return this.floorUnder?.([at[0] + n.x * 0.05, at[1] + n.y * 0.05 + 0.05, at[2] + n.z * 0.05]) ?? null;
  }

  /**
   * Chips, sparks and powder off a surface facing `normal`, in `color`; the bits land on `floor` (a
   * height; default what's under it: the options' floor, else the effects' ground).
   */
  impact(at: V3, normal: V3, color = 0x8a5a44, floor?: number): void {
    const n = _n.set(normal[0], normal[1], normal[2]);
    if (n.lengthSq() < 1e-8) n.set(0, 1, 0);
    n.normalize();
    const lands = floor ?? this.floorOff(at, n);
    const x = at[0];
    const y = at[1];
    const z = at[2];
    const b = this.bp;
    const lod = this.lod(at[0], at[1], at[2]) * this.bitLoad();
    _c2.setHex(color);
    const tr = _c2.r;
    const tg = _c2.g;
    const tb = _c2.b;
    const chips = Math.round(rand(10, 18) * lod);
    for (let i = 0; i < chips; i++) {
      around(n, 0.7, _d);
      const sp = rand(1.5, 7);
      this.setBit(x + n.x * 0.03, y + n.y * 0.03, z + n.z * 0.03, _d.x * sp, _d.y * sp + 1, _d.z * sp);
      this.bit(rand(2, 4), CHIP, rand(0.02, 0.06), 0.2, 1);
      this.chipColor(b, color);
      b.floor = lands;
      this.emitBit();
    }
    const sparks = Math.round(rand(4, 9) * lod);
    for (let i = 0; i < sparks; i++) {
      around(n, 0.8, _d);
      const sp = rand(4, 14);
      this.setBit(x + n.x * 0.03, y + n.y * 0.03, z + n.z * 0.03, _d.x * sp, _d.y * sp, _d.z * sp);
      const h = rand(0.6, 1.2);
      this.bit(rand(0.08, 0.25), SPARK, rand(0.015, 0.03), 1, 1);
      b.r = 10 * h; b.g = 5.5 * h; b.b = 2 * h;
      b.floor = lands;
      this.emitBit();
    }
    const flakes = Math.round(10 * lod);
    for (let i = 0; i < flakes; i++) {
      around(n, 1, _d);
      const sp = rand(0.3, 2);
      this.setBit(x + n.x * 0.05, y + n.y * 0.05, z + n.z * 0.05, _d.x * sp, _d.y * sp, _d.z * sp);
      this.bit(rand(2, 5), FLAKE, rand(0.01, 0.022), rand(2, 3), rand(0.03, 0.08));
      this.dustColor(b, true, tr, tg, tb);
      b.floor = lands;
      this.emitBit();
    }
    // A small puff of powder from the hole
    const p = this.sp;
    const puffs = Math.round(rand(2, 4) * this.load());
    for (let i = 0; i < puffs; i++) {
      around(n, 0.6, _d);
      const sp = rand(0.6, 2.2);
      this.setPuff(x + n.x * 0.1, y + n.y * 0.1, z + n.z * 0.1, _d.x * sp, _d.y * sp + 0.1, _d.z * sp);
      this.look(rand(1.8, 3.2), rand(0.1, 0.2), rand(0.6, 1.1), rand(0.4, 0.8), rand(-0.5, 0.5), rand(0.35, 0.55));
      this.moves(rand(2.5, 3.5), 0.05, 0.15, 0.04, 0.6);
      this.dustColor(p, true, tr, tg, tb);
      this.emitPuff();
    }
  }

  trail(at: V3, velocity: V3): void {
    const vx = velocity[0];
    const vy = velocity[1];
    const vz = velocity[2];
    const speed = Math.hypot(vx, vy, vz);
    const dt = this.lastDt;
    const p = this.sp;
    // Exhaust glow behind the nozzle (lives for about a frame)
    const back = speed > 1e-3 ? 0.25 / speed : 0;
    this.setPuff(at[0] - vx * back, at[1] - vy * back, at[2] - vz * back, 0, 0, 0);
    this.look(0.05, 0.55, 0.6, 1, 0, 0);
    this.moves(0, 0, 0, 0, 0.3);
    this.hot(1.8, 1, 1);
    this.rgb(p, 0x000000);
    this.emitPuff();
    // Smoke puffs spaced along the path travelled since the last frame
    this.trailCarry += (speed * dt) / 0.3;
    let count = Math.floor(this.trailCarry);
    this.trailCarry -= count;
    count = Math.min(count, 12);
    for (let i = 0; i < count; i++) {
      const f = (i + Math.random()) / Math.max(1, count);
      const bx = at[0] - vx * (back + dt * f);
      const by = at[1] - vy * (back + dt * f);
      const bz = at[2] - vz * (back + dt * f);
      randUnit(_d).multiplyScalar(rand(0.2, 0.8));
      this.setPuff(bx, by, bz, -vx * 0.04 + _d.x, -vy * 0.04 + _d.y, -vz * 0.04 + _d.z);
      this.look(rand(2, 3.5), rand(0.45, 0.6), rand(1.4, 2.2), rand(0.5, 1), rand(-0.6, 0.6), rand(0.3, 0.42));
      this.moves(2, rand(0.1, 0.3), 0.2, 0.03, 0.6);
      this.hot(rand(0.25, 0.45), 0.04, 0);
      const g = rand(0.6, 0.78);
      p.r = g; p.g = g * 0.98; p.b = g * 0.95;
      this.emitPuff();
    }
  }

  /**
   * One puff of smoke or steam in its own colour (not the dust palette): a vent, a chimney, a
   * fire's smoke. Call it as often as the source puffs (a vent: a few times a second).
   */
  puff(at: V3, o: PuffOptions = {}): void {
    const size = o.size ?? 1.5;
    const life = o.life ?? 4;
    const v = o.velocity ?? [0, 0, 0];
    randUnit(_d).multiplyScalar(0.15 * size);
    this.setPuff(at[0], at[1], at[2], v[0] + _d.x, v[1] + _d.y, v[2] + _d.z);
    this.look(life * rand(0.85, 1.15), size * 0.3, size * rand(0.85, 1.15), life * 0.35, rand(-0.3, 0.3), o.opacity ?? 0.5);
    this.moves(1.5, o.rise ?? 0.8, 0.2, Math.min(0.3, life * 0.1), 0.55);
    this.shade(this.sp, _c.set(o.color ?? 0xc8c8c8), rand(0.92, 1.05));
    this.emitPuff();
  }

  /**
   * A bullet striking a surface facing `normal`, by what it is (BulletLook): sparks off metal (and
   * a glint of light), glittering bits off glass, a spray of earth off dirt, and off the rest chips
   * and a small puff of powder in its colours.
   */
  bullet(at: V3, normal: V3, look: BulletLook): void {
    const n = _n.set(normal[0], normal[1], normal[2]);
    if (n.lengthSq() < 1e-8) n.set(0, 1, 0);
    n.normalize();
    const [x, y, z] = at;
    const kind = look.kind;
    const metal = kind === 'metal';
    const glass = kind === 'glass';
    const dirt = kind === 'dirt';
    const stone = kind === 'brick' || kind === 'concrete';
    const lod = this.lod(x, y, z) * this.bitLoad();
    const b = this.bp;
    const floor = look.floor ?? this.floorOff(at, n);
    // Chips (grit, splinters, glittering glass, clods) thrown back out of the hole
    const chips = Math.round((metal ? 2 : dirt ? rand(10, 15) : rand(7, 11)) * lod);
    for (let i = 0; i < chips; i++) {
      around(n, dirt ? 0.45 : 0.75, _d);
      const sp = dirt ? rand(2, 6) : rand(1.5, 6.5);
      this.setBit(x + n.x * 0.02, y + n.y * 0.02, z + n.z * 0.02, _d.x * sp, _d.y * sp + (dirt ? 1.6 : 0.6), _d.z * sp);
      this.bit(rand(1.2, 2.6), CHIP, rand(0.008, glass ? 0.018 : 0.026), 0.2, 1);
      this.chipColor(b, look.chips ?? (metal ? 0x5a5c60 : dirt ? DIRT.chips : 0x8a8378));
      b.floor = floor;
      this.emitBit();
    }
    // Sparks: a spray off metal, now and then one or two off stone
    const sparks = Math.round((metal ? rand(9, 16) : stone && Math.random() < 0.3 ? rand(1, 3) : 0) * lod);
    for (let i = 0; i < sparks; i++) {
      around(n, 0.9, _d);
      const sp = rand(4, 14);
      this.setBit(x + n.x * 0.02, y + n.y * 0.02, z + n.z * 0.02, _d.x * sp, _d.y * sp, _d.z * sp);
      const h = rand(0.7, 1.3);
      this.bit(rand(0.06, metal ? 0.3 : 0.15), SPARK, rand(0.012, 0.022), 1, 1);
      b.r = 10 * h; b.g = 5.5 * h; b.b = 2 * h;
      b.floor = floor;
      this.emitBit();
    }
    if (metal) this.flash(x + n.x * 0.15, y + n.y * 0.15, z + n.z * 0.15, 5, 2.5, true);
    if (glass) return;
    // Powder: a small puff of it (more off dirt, a breath off metal), and a few flakes drifting
    const p = this.sp;
    const dust = look.dust ?? (dirt ? DIRT.dust : undefined);
    const tinted = dust !== undefined;
    if (tinted) _c2.setHex(dust);
    const puffs = Math.round((dirt ? 4 : metal ? 1 : 3) * this.load());
    for (let i = 0; i < puffs; i++) {
      around(n, 0.5, _d);
      const sp = rand(0.6, 2.6) * (i === 0 ? 0.4 : 1);
      this.setPuff(x + n.x * 0.06, y + n.y * 0.06, z + n.z * 0.06, _d.x * sp, _d.y * sp + 0.1, _d.z * sp);
      this.look(rand(1.5, 2.8), 0.1, dirt ? rand(0.7, 1.2) : rand(0.45, 0.8), rand(0.25, 0.5), rand(-0.5, 0.5), metal ? 0.2 : rand(0.5, 0.68));
      this.moves(rand(2.5, 3.5), 0.06, 0.12, 0.03, 0.6);
      this.dustColor(p, tinted, _c2.r, _c2.g, _c2.b);
      this.emitPuff();
    }
    const flakes = Math.round((metal ? 2 : 5) * lod);
    for (let i = 0; i < flakes; i++) {
      around(n, 1, _d);
      const sp = rand(0.3, 1.6);
      this.setBit(x + n.x * 0.04, y + n.y * 0.04, z + n.z * 0.04, _d.x * sp, _d.y * sp, _d.z * sp);
      this.bit(rand(1.5, 3.5), FLAKE, rand(0.008, 0.016), rand(2, 3), rand(0.03, 0.08));
      this.dustColor(b, tinted, _c2.r, _c2.g, _c2.b);
      b.floor = floor;
      this.emitBit();
    }
  }

  /**
   * A gun firing from its muzzle at `at`, along `dir`: a brief flash of light there (one a blast
   * never gives up for it) and a wisp of smoke.
   */
  muzzle(at: V3, dir: V3): void {
    this.flash(at[0] + dir[0] * 0.25, at[1] + dir[1] * 0.25, at[2] + dir[2] * 0.25, 14, 6, true);
    randUnit(_d).multiplyScalar(0.25);
    const sp = rand(0.8, 1.8);
    this.setPuff(at[0] + dir[0] * 0.12, at[1] + dir[1] * 0.12, at[2] + dir[2] * 0.12, dir[0] * sp + _d.x, dir[1] * sp + _d.y, dir[2] * sp + _d.z);
    this.look(rand(1, 1.6), 0.05, rand(0.35, 0.6), 0.4, rand(-0.6, 0.6), rand(0.1, 0.16));
    this.moves(2.5, 0.35, 0.1, 0.02, 0.6);
    const g = rand(0.62, 0.74);
    this.sp.r = g; this.sp.g = g; this.sp.b = g * 0.97;
    this.emitPuff();
  }

  /** A spent casing thrown from a gun at `at`, at `velocity`: it tumbles, bounces on `floor` (a height) and lies there a few seconds. */
  casing(at: V3, velocity: V3, floor: number): void {
    this.setBit(at[0], at[1], at[2], velocity[0], velocity[1], velocity[2]);
    this.bit(rand(4, 6), CASING, rand(0.011, 0.013), 0.12, 1);
    const j = rand(0.85, 1.1);
    const b = this.bp;
    b.r = 0.62 * j; b.g = 0.42 * j; b.b = 0.15 * j;
    b.floor = floor;
    this.emitBit();
  }

  /** A tracer round's streak, flying from `from` (the muzzle) to `to` (where it struck, or far along its way). */
  tracer(from: V3, to: V3): void {
    this.tracers.add(from, to);
  }

  /**
   * A mark on a surface at `at`, facing `normal`: a bullet hole (dark, small), a dent, a pock, or a
   * scorch (see DecalOptions). On a piece it goes where the piece goes, onto what's left of it if it
   * breaks, and with it when it goes; it only ever shows on a surface, never in the air.
   */
  decal(at: V3, normal: V3, options: DecalOptions = {}): void {
    this.decals.add(at, normal, options);
  }

  /**
   * Soot where a blast of `radius` went off against a surface facing `normal` (the ground, a wall):
   * on what's left round the hole (and in it, and on what lands there), out past where it broke.
   */
  scorch(at: V3, normal: V3, radius = 2.3): void {
    this.decals.add(at, normal, { kind: 'scorch', size: Math.min(10, radius * 2.6) });
  }

  /**
   * Use everything once, out of sight: a puff of each kind (dust, smoke, fire, glow), a bit of each
   * (spark, ember, chip, flake) and a flash, beyond the camera's far plane and gone in a moment.
   * Call it when the scene is built: the first explosion then costs what any other does.
   */
  warm(): void {
    const far = (this.camera as THREE.PerspectiveCamera).far ?? 1000;
    const e = this.camera.matrixWorld.elements;
    // On the ground (particles are kept above it), three far planes off
    const x = e[12] + 3 * far;
    const y = this.uGround.value + 1;
    const z = e[14];
    const p = this.sp;
    for (const kind of ['dust', 'fire', 'glow'] as const) {
      this.setPuff(x, y, z, 0, 1, 0);
      this.look(WARM_LIFE, 1, 2, 0.5, 0, 0.5);
      this.moves(1, 0.5, 0.2, 0.05, 0.5);
      if (kind === 'fire') this.hot(1.2, 0.3, 0);
      if (kind === 'glow') this.hot(2.2, 0.07, 1);
      this.dustColor(p, false, 0, 0, 0);
      this.emitPuff();
    }
    for (const kind of [SPARK, CHIP, EMBER, FLAKE]) {
      this.setBit(x, y, z, 0, 2, 0);
      this.bit(WARM_LIFE, kind, 0.05, 1, 1);
      this.rgb(this.bp, 0xffa040);
      this.emitBit();
    }
    this.flash(x, y, z, 1, 1);
  }

  // -------------------------------------------------------------------------------------------

  update(dt: number): void {
    if (this.disposed) return;
    dt = Math.min(Math.max(dt, 0), 0.1);
    this.time += dt;
    this.lastDt = dt > 0 ? dt : this.lastDt;
    this.uDt.value = dt;
    this.uTime.value = this.time;
    this.uWind.value.copy(this.wind);
    this.updateLights(dt);

    this.flushDust();
    this.puffs.flush();
    this.bits.flush();
    this.puffFill = this.puffs.live(this.time) / this.puffs.cap;
    this.bitFill = this.bits.live(this.time) / this.bits.cap;
    const puffsLive = this.time < this.puffs.lastDeath;
    const bitsLive = this.time < this.bits.lastDeath;
    const r = this.renderer;
    if (r) {
      // Compile both kernels up front (the first explosion should not hitch)
      if (!this.warmed || puffsLive) r.compute(this.puffCompute);
      if (!this.warmed || bitsLive) r.compute(this.bitCompute);
      this.warmed = true;
    }
    // Idle systems are not drawn (but are, until the renderer has seen and compiled them)
    this.puffSprite.visible = puffsLive || !this.warmed;
    this.bitSprite.visible = bitsLive || !this.warmed;
    this.decals.update();
    this.tracers.update(dt, this.camera);
  }

  /** How many marks there are on surfaces. */
  get marks(): number {
    return this.decals.slots.count;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const s of this.sprites) s.removeFromParent();
    this.decals.dispose();
    this.tracers.dispose();
    for (const f of this.flashes) {
      f.light.removeFromParent();
      f.light.dispose();
    }
    this.puffMaterial.dispose();
    this.bitMaterial.dispose();
    this.atlas.dispose();
    this.puffCompute.dispose();
    this.bitCompute.dispose();
    this.puffSprite.geometry.dispose();
    this.bitSprite.geometry.dispose();
  }

  // -------------------------------------------------------------------------------------------
  // Emission helpers

  private setPuff(x: number, y: number, z: number, vx: number, vy: number, vz: number): void {
    const p = this.sp;
    p.x = x; p.y = y; p.z = z;
    p.vx = vx; p.vy = vy; p.vz = vz;
  }

  private setBit(x: number, y: number, z: number, vx: number, vy: number, vz: number): void {
    const b = this.bp;
    b.x = x; b.y = y; b.z = z;
    b.vx = vx; b.vy = vy; b.vz = vz;
  }

  /** A puff's lifetime and look: sizes in m, growth time constant in s, spin in rad/s. */
  private look(life: number, size0: number, size1: number, grow: number, spin: number, opacity: number): void {
    const p = this.sp;
    p.life = life; p.size0 = size0; p.size1 = size1; p.grow = grow; p.spin = spin; p.opacity = opacity;
  }

  /** A puff's motion: drag (1/s), rise (m/s), swirl (m/s), fade in (s) and fade out (fraction of life). */
  private moves(drag: number, buoy: number, turb: number, fadeIn: number, fadeOut: number): void {
    const p = this.sp;
    p.drag = drag; p.buoy = buoy; p.turb = turb; p.fadeIn = fadeIn; p.fadeOut = fadeOut;
  }

  /** Make the next puff glow (heat ~1 is a fireball's, decaying with time constant tau); glow=1 for a round glow. */
  private hot(heat: number, tau: number, glow: number): void {
    const p = this.sp;
    p.heat = heat; p.heatTau = tau; p.glow = glow;
  }

  private bit(life: number, kind: number, size: number, drag: number, gravity: number): void {
    const b = this.bp;
    b.life = life; b.kind = kind; b.size = size; b.drag = drag; b.gravity = gravity;
  }

  private rgb(o: { r: number; g: number; b: number }, hex: number): void {
    _c.setHex(hex);
    o.r = _c.r; o.g = _c.g; o.b = _c.b;
  }

  /** A colour times `j`. */
  private shade(o: { r: number; g: number; b: number }, c: THREE.Color, j: number): void {
    o.r = c.r * j; o.g = c.g * j; o.b = c.b * j;
  }

  /** A dust colour from the palette, pulled toward a tint (linear rgb) when there is one. */
  private dustColor(o: { r: number; g: number; b: number }, tinted: boolean, tr: number, tg: number, tb: number): void {
    const { colors, blend } = this.dustPalette;
    const pal = colors?.length ? colors : DUST_PALETTE;
    _c.set(pal[Math.floor(Math.random() * pal.length)]);
    _t.set(pal[Math.floor(Math.random() * pal.length)]);
    _c.lerp(_t, Math.random());
    if (tinted) {
      // Powder is lighter and greyer than the solid it came from (greyed toward the palette less
      // the more of the tint is taken: all of it, none)
      const k = Math.min(1, Math.max(0, blend ?? 0.45));
      _t.setRGB(tr, tg, tb, THREE.LinearSRGBColorSpace).lerp(_c, (0.35 * (1 - k)) / 0.55).multiplyScalar(1.15);
      _c.lerp(_t, k);
    }
    this.shade(o, _c, rand(0.72, 1.1));
  }

  private chipColor(o: { r: number; g: number; b: number }, hex: number): void {
    _c.setHex(hex);
    const j = rand(0.55, 1.15);
    _c2.setHex(0x9a9184);
    _c.lerp(_c2, Math.random() * 0.35);
    o.r = _c.r * j; o.g = _c.g * j; o.b = _c.b * j;
  }

  private emitPuff(): void {
    const s = this.sp;
    const pool = this.puffs;
    const i = pool.next(this.time, s.life);
    const P = pool.p;
    const V = pool.v;
    const S = pool.s;
    let o = i * 4;
    P[o] = s.x; P[o + 1] = s.y; P[o + 2] = s.z; P[o + 3] = 0;
    V[o] = s.vx; V[o + 1] = s.vy; V[o + 2] = s.vz; V[o + 3] = s.life;
    o = i * PUFF_STRIDE * 4;
    S[o] = s.size0; S[o + 1] = s.size1; S[o + 2] = Math.max(0.01, s.grow); S[o + 3] = s.spin;
    S[o + 4] = s.r; S[o + 5] = s.g; S[o + 6] = s.b; S[o + 7] = s.opacity;
    S[o + 8] = s.heat; S[o + 9] = Math.max(0.01, s.heatTau); S[o + 10] = s.drag; S[o + 11] = s.buoy;
    S[o + 12] = s.fadeIn; S[o + 13] = s.fadeOut; S[o + 14] = s.turb; S[o + 15] = Math.random();
    S[o + 16] = s.glow; S[o + 17] = 0; S[o + 18] = 0; S[o + 19] = 0;
    // Heat is opt-in per puff
    s.heat = 0; s.heatTau = 1; s.glow = 0;
  }

  private emitBit(): void {
    const s = this.bp;
    const pool = this.bits;
    const i = pool.next(this.time, s.life);
    const P = pool.p;
    const V = pool.v;
    const S = pool.s;
    let o = i * 4;
    P[o] = s.x; P[o + 1] = s.y; P[o + 2] = s.z; P[o + 3] = 0;
    V[o] = s.vx; V[o + 1] = s.vy; V[o + 2] = s.vz; V[o + 3] = s.life;
    o = i * BIT_STRIDE * 4;
    S[o] = s.r; S[o + 1] = s.g; S[o + 2] = s.b; S[o + 3] = s.kind;
    S[o + 4] = s.size; S[o + 5] = s.drag; S[o + 6] = s.gravity; S[o + 7] = Math.random();
    // Spin and tumble angles (advanced by the compute pass) and their rates
    S[o + 8] = Math.random() * 6.2832; S[o + 9] = Math.random() * 6.2832;
    // (A casing spins and tumbles twice as fast)
    const k = s.kind === CASING ? 2 : 1;
    S[o + 10] = rand(3, 12) * k * (Math.random() < 0.5 ? -1 : 1); S[o + 11] = rand(3, 11) * k;
    // Where it lands (casings at the shooter's feet, chips under where they were struck)
    S[o + 12] = s.floor ?? this.uGround.value; S[o + 13] = 0; S[o + 14] = 0; S[o + 15] = 0;
    s.floor = null;
  }

  /** Fewer small bits far from the camera, where they would be sub-pixel anyway. */
  private lod(x: number, y: number, z: number): number {
    const c = this.camera.matrixWorld.elements;
    const d = Math.hypot(x - c[12], y - c[13], z - c[14]);
    return Math.min(1, Math.max(0.3, 45 / Math.max(1, d)));
  }

  /** 1 while the puff pool has room; less (fewer, bigger puffs) as it fills up. */
  private load(): number {
    return loadFor(this.puffFill + this.puffs.emitted / this.puffs.cap);
  }

  /** The same for the small bits (fewer of them as the pool fills). */
  private bitLoad(): number {
    return loadFor(this.bitFill + this.bits.emitted / this.bits.cap);
  }

  private flash(x: number, y: number, z: number, peak: number, range: number, minor = false): void {
    const f = flashLight(this.flashes, minor);
    if (!f) return;
    f.active = true;
    f.minor = minor;
    f.t = 0;
    f.peak = peak;
    f.light.position.set(x, y, z);
    f.light.distance = range;
    f.u.value.set(x, y, z, 0);
  }

  private updateLights(dt: number): void {
    for (const f of this.flashes) {
      if (!f.active) continue;
      f.t += dt;
      const t = f.t;
      let i = f.minor ? f.peak * Math.exp(-t / 0.025) : f.peak * (Math.exp(-t / 0.07) + 0.06 * Math.exp(-t / 0.3)) * (0.85 + 0.15 * Math.sin(t * 90));
      if (t > (f.minor ? 0.12 : 1.2)) {
        f.active = false;
        i = 0;
      }
      f.light.intensity = i;
      f.u.value.w = i;
    }

    // Shade the dust with the scene's own sun and sky
    if (this.time >= this.lightScanAt || (this.sunLight && !this.sunLight.parent) || (this.hemiLight && !this.hemiLight.parent)) {
      this.lightScanAt = this.time + 1;
      this.sunLight = null;
      this.hemiLight = null;
      for (const o of this.scene.children) {
        if (!this.sunLight && (o as THREE.DirectionalLight).isDirectionalLight) this.sunLight = o as THREE.DirectionalLight;
        if (!this.hemiLight && (o as THREE.HemisphereLight).isHemisphereLight) this.hemiLight = o as THREE.HemisphereLight;
      }
    }
    const sun = this.sunLight;
    if (sun && sun.visible) {
      const c = sun.color;
      this.uSunCol.value.set(c.r, c.g, c.b).multiplyScalar(sun.intensity);
      if (this.fixedSun) this.uSunDir.value.copy(this.fixedSun).normalize();
      else {
        sun.updateMatrixWorld();
        sun.target.updateMatrixWorld();
        _v.setFromMatrixPosition(sun.matrixWorld).sub(_d.setFromMatrixPosition(sun.target.matrixWorld));
        if (_v.lengthSq() > 1e-8) this.uSunDir.value.copy(_v.normalize());
      }
    } else if (sun) this.uSunCol.value.set(0, 0, 0);
    const hemi = this.hemiLight;
    const sky = this.uSkyCol.value;
    const gnd = this.uGroundCol.value;
    const env = this.scene.environment;
    if (env !== this.envTex) {
      this.envTex = env;
      this.envOk = env !== null && this.measureEnv(env);
    }
    if ((hemi && hemi.visible) || this.envOk) {
      sky.set(0, 0, 0);
      gnd.set(0, 0, 0);
      if (hemi && hemi.visible) {
        const k = hemi.intensity;
        sky.set(hemi.color.r * k, hemi.color.g * k, hemi.color.b * k);
        gnd.set(hemi.groundColor.r * k, hemi.groundColor.g * k, hemi.groundColor.b * k);
      }
      // Image-based light as a second hemisphere light (irradiance = pi * mean cosine-weighted radiance)
      if (this.envOk) {
        const k = Math.PI * (this.scene.environmentIntensity ?? 1);
        sky.addScaledVector(this.envUp, k);
        gnd.addScaledVector(this.envDown, k);
      }
    }

    // Fog, done by hand (three's would add fog colour where the sprite is transparent)
    const fog = this.scene.fog;
    if (fog && (fog as THREE.Fog).isFog) {
      const f = fog as THREE.Fog;
      this.uFog.value.set(1, f.near, f.far, 0);
      this.uFogColor.value.set(f.color.r, f.color.g, f.color.b);
    } else if (fog && (fog as THREE.FogExp2).isFogExp2) {
      const f = fog as THREE.FogExp2;
      this.uFog.value.set(2, 0, 1, f.density);
      this.uFogColor.value.set(f.color.r, f.color.g, f.color.b);
    } else this.uFog.value.set(0, 0, 1, 0);
  }

  /**
   * The mean cosine-weighted radiance of an equirectangular environment's upper and lower halves
   * (CPU-side data only: an HDR/EXR DataTexture). False if it can't be read.
   */
  private measureEnv(tex: THREE.Texture): boolean {
    const img = tex.image as { width?: number; height?: number; data?: ArrayLike<number> } | null;
    if (!img || !img.data || !img.width || !img.height || tex.mapping !== THREE.EquirectangularReflectionMapping) return false;
    const { width: w, height: h, data } = img as { width: number; height: number; data: ArrayLike<number> };
    const ch = Math.round(data.length / (w * h));
    if (ch < 3) return false;
    const half = data instanceof Uint16Array;
    const byte = data instanceof Uint8Array || data instanceof Uint8ClampedArray;
    const read = (i: number): number => (half ? THREE.DataUtils.fromHalfFloat(data[i]) : byte ? data[i] / 255 : data[i]);
    const sx = Math.max(1, Math.floor(w / 96));
    const sy = Math.max(1, Math.floor(h / 48));
    const up = this.envUp.set(0, 0, 0);
    const down = this.envDown.set(0, 0, 0);
    let wu = 0;
    let wd = 0;
    for (let y = 0; y < h; y += sy) {
      // Rows run top down: row 0 looks straight up
      const lat = (0.5 - (y + 0.5) / h) * Math.PI;
      const wgt = Math.cos(lat) * Math.abs(Math.sin(lat)); // solid angle x cosine to the pole
      for (let x = 0; x < w; x += sx) {
        const o = (y * w + x) * ch;
        const r = read(o);
        const g = read(o + 1);
        const b = read(o + 2);
        if (!(r + g + b < 1e6)) continue; // NaN, inf
        if (lat > 0) {
          up.x += r * wgt; up.y += g * wgt; up.z += b * wgt;
          wu += wgt;
        } else {
          down.x += r * wgt; down.y += g * wgt; down.z += b * wgt;
          wd += wgt;
        }
      }
    }
    if (wu <= 0 || wd <= 0) return false;
    up.divideScalar(wu);
    down.divideScalar(wd);
    // If the image is stored bottom up, the brighter half is still the sky
    if (down.x + down.y + down.z > up.x + up.y + up.z) {
      _v.copy(up);
      up.copy(down);
      down.copy(_v);
    }
    return true;
  }

  /** How much fog covers a sprite at this view-space depth. */
  private fogAt(viewZ: THREE.Node<'float'>): THREE.Node<'float'> {
    const d = viewZ.negate();
    const f = this.uFog;
    const linear = smoothstep(f.y, f.z, d);
    const exp2 = float(1).sub(exp(f.w.mul(f.w).mul(d).mul(d).negate()));
    return select(f.x.greaterThan(1.5), exp2, select(f.x.greaterThan(0.5), linear, 0));
  }

  // -------------------------------------------------------------------------------------------
  // GPU side

  /** The air the particles drift in: wind plus a slowly changing, divergence-free swirl (ABC flow). */
  private air(pos: THREE.Node<'vec3'>, amp: THREE.Node<'float'>): THREE.Node<'vec3'> {
    const t = this.uTime;
    const q = pos.mul(0.42).add(vec3(t.mul(0.13), t.mul(0.07), t.mul(0.1)));
    const q2 = pos.mul(1.3).add(vec3(t.mul(-0.21), t.mul(0.17), t.mul(0.15)));
    const abc = vec3(sin(q.z).add(cos(q.y)), sin(q.x).add(cos(q.z)), sin(q.y).add(cos(q.x)));
    const abc2 = vec3(sin(q2.z).add(cos(q2.y)), sin(q2.x).add(cos(q2.z)), sin(q2.y).add(cos(q2.x)));
    return this.uWind.add(abc.add(abc2.mul(0.5)).mul(amp));
  }

  private makePuffCompute(): THREE.ComputeNode {
    const { P, V, S, cap } = this.puffs;
    const dt = this.uDt;
    return Fn(() => {
      const i = instanceIndex;
      const pp = P.element(i);
      const vv = V.element(i);
      const age = pp.w.toVar();
      const life = vv.w;
      If(age.lessThan(life), () => {
        const base = i.mul(PUFF_STRIDE);
        const s0 = S.element(base); // size0, size1, grow, spin
        const s2 = S.element(base.add(2)); // heat, heatTau, drag, buoy
        const s3 = S.element(base.add(3)); // fadeIn, fadeOut, turb, seed
        const pos = pp.xyz.toVar();
        const vel = vv.xyz.toVar();
        // Relax toward the air's velocity; hot puffs rise, less so as they cool
        const lift = s2.w.mul(exp(age.div(-4)));
        const air = this.air(pos, s3.z).add(vec3(0, lift, 0));
        vel.addAssign(air.sub(vel).mul(exp(s2.z.mul(dt).negate()).oneMinus()));
        pos.addAssign(vel.mul(dt));
        age.addAssign(dt);
        // Rest on the ground and spread along it
        const size = mix(s0.x, s0.y, exp(age.div(s0.z).negate()).oneMinus());
        const floorY = this.uGround.add(size.mul(0.3));
        If(pos.y.lessThan(floorY), () => {
          pos.y.assign(floorY);
          vel.y.assign(max(vel.y, 0));
        });
        pp.assign(vec4(pos, age));
        vv.assign(vec4(vel, life));
      });
    })().compute(cap);
  }

  private makeBitCompute(): THREE.ComputeNode {
    const { P, V, S, cap } = this.bits;
    const dt = this.uDt;
    return Fn(() => {
      const i = instanceIndex;
      const pp = P.element(i);
      const vv = V.element(i);
      const age = pp.w.toVar();
      const life = vv.w;
      If(age.lessThan(life), () => {
        const base = i.mul(BIT_STRIDE);
        const s0 = S.element(base); // rgb, kind
        const s1 = S.element(base.add(1)); // size, drag, gravity, seed
        const kind = s0.w;
        const pos = pp.xyz.toVar();
        const vel = vv.xyz.toVar();
        // Embers and flakes ride the air (flakes flutter); sparks and chips fly through still air
        const floaty = kind.greaterThan(EMBER - 0.5);
        const flake = kind.greaterThan(FLAKE - 0.5);
        const ph = s1.w.mul(40);
        const flutter = vec3(sin(age.mul(3.1).add(ph)), sin(age.mul(4.7).add(ph.mul(1.7))).mul(0.4), cos(age.mul(2.3).add(ph))).mul(select(flake, 0.35, 0));
        const air = select(floaty, this.air(pos, float(0.25)), vec3(0, 0, 0)).add(flutter);
        vel.y.subAssign(s1.z.mul(9.81).mul(dt));
        vel.addAssign(air.sub(vel).mul(exp(s1.y.mul(dt).negate()).oneMinus()));
        pos.addAssign(vel.mul(dt));
        age.addAssign(dt);
        const r = s1.x.mul(0.5);
        const floorY = S.element(base.add(3)).x.add(r); // where it lands
        If(pos.y.lessThan(floorY), () => {
          pos.y.assign(floorY);
          const bounce = select(kind.lessThan(SPARK + 0.5), 0.35, select(kind.lessThan(CHIP + 0.5), 0.28, select(kind.greaterThan(CASING - 0.5), 0.4, 0)));
          If(vel.y.lessThan(0), () => {
            vel.y.assign(vel.y.negate().mul(bounce));
          });
          vel.x.mulAssign(0.55);
          vel.z.mulAssign(0.55);
          // A spark that hits the ground soon goes out
          If(kind.lessThan(SPARK + 0.5), () => {
            age.addAssign(life.sub(age).mul(0.25));
          });
        });
        // Spin and tumble while moving; a chip at rest lies still
        const s2 = S.element(base.add(2)); // spin, tumble, spin rate, tumble rate
        const turn = saturate(length(vel).div(1.5)).mul(dt);
        s2.assign(vec4(s2.x.add(s2.z.mul(turn)), s2.y.add(s2.w.mul(turn)), s2.z, s2.w));
        pp.assign(vec4(pos, age));
        vv.assign(vec4(vel, life));
      });
    })().compute(cap);
  }

  private makePuffMaterial(soft: boolean): THREE.SpriteNodeMaterial {
    const pool = this.puffs;
    const cap = pool.cap;
    const rP = storage(pool.P.value, 'vec4', cap).toReadOnly();
    const rV = storage(pool.V.value, 'vec4', cap).toReadOnly();
    const rS = storage(pool.S.value, 'vec4', cap * PUFF_STRIDE).toReadOnly();
    // Oldest first, so newer puffs (denser, nearer the source) are drawn over older ones
    const slot = instanceIndex.add(pool.headU).mod(uint(cap));
    const p = rP.element(slot);
    const v = rV.element(slot);
    const base = slot.mul(PUFF_STRIDE);
    const s0 = rS.element(base); // size0, size1, grow, spin
    const s1 = rS.element(base.add(1)); // rgb, opacity
    const s2 = rS.element(base.add(2)); // heat, heatTau, drag, buoy
    const s3 = rS.element(base.add(3)); // fadeIn, fadeOut, turb, seed
    const s4 = rS.element(base.add(4)); // glow
    const age = p.w;
    const life = v.w;
    const alive = age.lessThan(life);
    const t = age.div(max(life, 1e-3));
    const size = mix(s0.x, s0.y, exp(age.div(s0.z).negate()).oneMinus());
    // Thinner as it spreads, faded in quickly and out slowly
    const fade = smoothstep(0, max(s3.x, 1e-3), age).mul(smoothstep(1, float(1).sub(s3.y), t));
    const thin = pow(s0.x.div(size), 0.3);
    const opacity = s1.w.mul(fade).mul(thin);
    const seed = s3.w;
    const rot = seed.mul(6.2832).add(s0.w.mul(age));
    const heat = s2.x.mul(exp(age.div(s2.y).negate())).mul(smoothstep(1, 0.6, t));

    const m = new THREE.SpriteNodeMaterial();
    m.transparent = true;
    m.depthWrite = false;
    m.blending = THREE.CustomBlending;
    m.blendEquation = THREE.AddEquation;
    m.blendSrc = THREE.OneFactor;
    m.blendDst = THREE.OneMinusSrcAlphaFactor;
    m.blendSrcAlpha = THREE.OneFactor;
    m.blendDstAlpha = THREE.OneMinusSrcAlphaFactor;
    m.fog = false;
    m.positionNode = p.xyz;
    m.scaleNode = vec2(select(alive, size, 0));
    m.rotationNode = rot;

    // Per-sprite values for the fragment stage
    const center = p.xyz;
    const viewZ = cameraViewMatrix.mul(vec4(center, 1)).z;
    // Warm light from the flashes, at the puff's centre
    let flashLight: THREE.Node<'vec3'> = vec3(0, 0, 0);
    for (const f of this.flashes) {
      const d = f.u.xyz.sub(center);
      const c = f.light.color;
      flashLight = flashLight.add(vec3(c.r, c.g, c.b).mul(f.u.w.mul(0.5).div(dot(d, d).add(size.mul(size)).add(4))));
    }
    const vCell = varying(vec2(select(seed.fract().greaterThan(0.5), 0.5, 0), select(seed.mul(7).fract().greaterThan(0.5), 0.5, 0)));
    const vRot = varying(vec2(cos(rot), sin(rot)));
    const vAlbedo = varying(s1.xyz);
    const vOpacity = varying(opacity);
    const vHeat = varying(heat);
    const vGlow = varying(s4.x);
    const vViewZ = varying(viewZ);
    const vSize = varying(size);
    const vFlash = varying(flashLight);
    const vFog = varying(this.fogAt(viewZ));

    // Fragment: the baked lumpy normal, rotated with the sprite, into world space
    const q = uv();
    const tex = texture(this.atlas, vCell.add(q.mul(0.5)));
    const nx0 = tex.r.mul(2).sub(1);
    const ny0 = tex.g.mul(2).sub(1);
    const nx = nx0.mul(vRot.x).sub(ny0.mul(vRot.y));
    const ny = nx0.mul(vRot.y).add(ny0.mul(vRot.x));
    const nz = sqrt(max(float(1).sub(nx.mul(nx)).sub(ny.mul(ny)), 0));
    const nW = normalize(cameraWorldMatrix.mul(vec4(nx, ny, nz, 0)).xyz);
    const sunDir = this.uSunDir;
    // Wrapped diffuse (light scatters into the dust), sky from above, bounce from below
    const wrap = pow(saturate(dot(nW, sunDir).mul(0.55).add(0.45)), 1.5);
    const sky = mix(this.uGroundCol, this.uSkyCol, nW.y.mul(0.5).add(0.5));
    const thick = tex.b;
    const ao = mix(float(0.62), float(1), thick);
    // Back-lit edges glow a little when looking toward the sun
    const viewDir = normalize(cameraPosition.sub(cameraWorldMatrix.mul(vec4(0, 0, vViewZ, 1)).xyz));
    const forward = pow(saturate(dot(viewDir.negate(), sunDir)), 6).mul(float(1).sub(thick)).mul(0.6);
    const light = this.uSunCol.mul(wrap.mul(ao).add(forward)).add(sky.mul(ao)).add(vFlash).mul(1 / Math.PI);
    const lit = vAlbedo.mul(light);

    // Shape: the lumpy blob, or a smooth round glow
    const r2 = dot(q.sub(0.5), q.sub(0.5)).mul(4);
    const glowShape = exp(r2.mul(-4.5)).mul(smoothstep(1, 0.6, r2));
    const isGlow = vGlow.greaterThan(0.5);
    const shape = select(isGlow, glowShape, tex.a);
    const core = select(isGlow, glowShape, thick);

    // Soft where it meets geometry, and gone before it fills the camera
    let edge: THREE.Node<'float'> = smoothstep(0.3, 1.0, vViewZ.negate().sub(cameraNear).div(max(vSize.mul(0.6), 0.5)));
    if (soft) {
      const sceneZ = perspectiveDepthToViewZ(this.sceneDepth.x, cameraNear, cameraFar);
      edge = edge.mul(saturate(vViewZ.sub(sceneZ).div(max(vSize.mul(0.35), 0.15))));
    }
    const alpha = shape.mul(vOpacity).mul(edge);

    // Heat: dark red at the edges to yellow-white in the core, in HDR
    const h = vHeat.mul(mix(float(0.3), float(1), core));
    const hot = mix(mix(vec3(1.0, 0.1, 0.01), vec3(1.0, 0.33, 0.04), smoothstep(0.1, 0.55, h)), vec3(1.0, 0.68, 0.32), smoothstep(0.7, 1.4, h));
    const emission = hot.mul(pow(h, 1.6).mul(7)).mul(shape).mul(edge);

    m.colorNode = vec4(mix(lit, this.uFogColor, vFog).mul(alpha).add(emission.mul(vFog.oneMinus())), alpha);
    return m;
  }

  private makeBitMaterial(): THREE.SpriteNodeMaterial {
    const pool = this.bits;
    const cap = pool.cap;
    const rP = storage(pool.P.value, 'vec4', cap).toReadOnly();
    const rV = storage(pool.V.value, 'vec4', cap).toReadOnly();
    const rS = storage(pool.S.value, 'vec4', cap * BIT_STRIDE).toReadOnly();
    const slot = instanceIndex.add(pool.headU).mod(uint(cap));
    const p = rP.element(slot);
    const v = rV.element(slot);
    const base = slot.mul(BIT_STRIDE);
    const s0 = rS.element(base); // rgb, kind
    const s1 = rS.element(base.add(1)); // size, drag, gravity, seed
    const age = p.w;
    const life = v.w;
    const alive = age.lessThan(life);
    const t = age.div(max(life, 1e-3));
    const kind = s0.w;
    const seed = s1.w;
    const isSpark = kind.lessThan(SPARK + 0.5);
    const isChip = kind.greaterThan(CHIP - 0.5).and(kind.lessThan(CHIP + 0.5));
    const isEmber = kind.greaterThan(EMBER - 0.5).and(kind.lessThan(EMBER + 0.5));
    const isCasing = kind.greaterThan(CASING - 0.5);
    const glows = isSpark.or(isEmber);

    // Sparks are streaked along their motion on screen; chips tumble (thin when edge-on), and so
    // do casings (short end-on)
    const vView = cameraViewMatrix.mul(vec4(v.xyz, 0)).xy;
    const speed = length(vView);
    const s2 = rS.element(base.add(2)); // spin, tumble (angles), rates
    const spin = s2.x;
    const tumble = abs(cos(s2.y));
    const size = s1.x;
    const shrink = smoothstep(1, 0.8, t);
    const sparkW = size.mul(pow(float(1).sub(t), 0.5));
    const lenX = select(isSpark, sparkW.add(speed.mul(0.03)), select(isChip, size.mul(seed.fract().mul(0.6).add(0.7)), select(isCasing, size.mul(3.6).mul(mix(0.3, 1, tumble)), size.mul(shrink))));
    const lenY = select(isSpark, sparkW, select(isChip, size.mul(mix(0.2, 1, tumble)), select(isCasing, size, size.mul(shrink))));
    const rot = select(isSpark, atan(vView.y, vView.x), spin);

    const m = new THREE.SpriteNodeMaterial();
    m.transparent = true;
    m.depthWrite = false;
    m.blending = THREE.CustomBlending;
    m.blendEquation = THREE.AddEquation;
    m.blendSrc = THREE.OneFactor;
    m.blendDst = THREE.OneMinusSrcAlphaFactor;
    m.blendSrcAlpha = THREE.OneFactor;
    m.blendDstAlpha = THREE.OneMinusSrcAlphaFactor;
    m.fog = false;
    m.positionNode = p.xyz;
    m.scaleNode = select(alive, vec2(lenX, lenY), vec2(0, 0));
    m.rotationNode = rot;

    // Glowing bits cool from yellow to red; embers flicker
    const cool = pow(float(1).sub(t), 1.5);
    const flicker = select(isEmber, sin(age.mul(seed.mul(20).add(18))).mul(0.35).add(0.75), 1);
    const emis = s0.xyz.mul(mix(vec3(0.6, 0.18, 0.05), vec3(1, 1, 1), cool)).mul(cool.mul(0.8).add(0.2)).mul(flicker).mul(select(isEmber, smoothstep(1, 0.7, t), 1));
    // Lit bits: sun on whichever face is turned to it, sky otherwise; a casing glints broadside on
    const sunAmt = select(isChip, mix(0.25, 1, tumble), select(isCasing, mix(0.35, 1.4, tumble), 0.75));
    const sky = this.uSkyCol.add(this.uGroundCol).mul(0.5);
    const lit = s0.xyz.mul(this.uSunCol.mul(sunAmt).add(sky)).mul(1 / Math.PI);
    const fogF = this.fogAt(cameraViewMatrix.mul(vec4(p.xyz, 1)).z);
    const vEmis = varying(select(glows, emis, vec3(0, 0, 0)).mul(fogF.oneMinus()));
    const vLit = varying(select(glows, vec3(0, 0, 0), mix(lit, this.uFogColor, fogF)));
    const vKind = varying(select(glows, 0, select(isChip, 1, select(isCasing, 3, 2))));
    const vSeed = varying(seed);

    const q = uv().mul(2).sub(1);
    const r2 = dot(q, q);
    const glowShape = exp(r2.mul(-3)).mul(smoothstep(1, 0.5, r2));
    const ax = abs(q.x);
    const ay = abs(q.y);
    // A chip: the square cut by three planes at angles of its own, crisp edged, with two facets
    const a0 = vSeed.mul(6.2832);
    const cut = (a: number) => dot(q, vec2(cos(a0.add(a)), sin(a0.add(a))));
    const chipD = max(max(ax, ay), max(cut(0), max(cut(2.2), cut(4.1))).mul(1.3));
    const chipShape = saturate(float(1).sub(chipD).div(max(fwidth(chipD), 1e-3)));
    const facet = select(cut(1.1).greaterThan(0), 1.1, 0.72);
    const flakeShape = smoothstep(1, 0.15, r2).mul(0.8);
    // A casing: a little cylinder seen side on, a highlight along it
    const casingShape = smoothstep(1, 0.8, ax).mul(smoothstep(1, 0.6, ay));
    const brass = float(0.5).add(exp(q.y.add(0.35).div(0.28).pow(2).negate()).mul(0.9));
    const isChipF = vKind.lessThan(1.5);
    const isCasingF = vKind.greaterThan(2.5);
    const solid = select(isCasingF, casingShape, select(isChipF, chipShape, flakeShape));
    const isGlow = vKind.lessThan(0.5);
    const a = select(isGlow, 0, solid);
    m.colorNode = vec4(vEmis.mul(glowShape).add(vLit.mul(a).mul(select(isCasingF, brass, select(isChipF, facet, 1)))), a);
    return m;
  }
}
