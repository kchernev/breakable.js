// Round the alley: the street past its breakable ground (wet.ts), the towers that wall it in behind
// both rows with their rooftop billboards, the far skyline with its blinking beacons, the avenue
// behind the start (shopfronts, awnings, traffic), the lane north and the passage east. All of it
// stands as scenery until something reaches it (../../towers.ts, ../../dormant-ground.ts): the
// towers are fixed boxes in sections, a round or a blast reaching one wakes it into panels in the
// same look (and the signs, shopfronts and awnings on it into lightboxes, panels and sheets), and a
// blast reaching the street lays it breakable there. Only the traffic's lights don't break.

import { abs, color, float, floor, fract, max, mix, normalWorld, positionWorld, select, smoothstep, step, texture, transformNormalToView, uniform, uv, vec2, vec3 } from 'three/tsl';
import * as THREE from 'three/webgpu';
import type { Body, World } from 'three-avbd';
import { type BreakableMaterial, type Destruction, material, random, type V3 } from '../../../lib/index.ts';
import { DormantGround } from '../../dormant-ground.ts';
import { inside, texture as mapOf, textured } from '../../textures.ts';
import { type FacadeLook, type TowerSpec, Towers } from '../../towers.ts';
import { glyphAtlas } from './glyphs.ts';
import { lightbox } from './signs.ts';
import { FRONT, GROUND, LANE } from './layout.ts';
import { cellHash, craterWater, wetStreet } from './wet.ts';

const base = 'packs/neon/textures/';

/** What moves in the scenery: the beacons' blink, the cars on the avenue. */
export const life = {
  beacon: uniform(0),
  cars: [] as Array<{ mesh: THREE.Object3D; x: number; dir: number; speed: number; z: number }>,
};

/**
 * Below the street, where a crater shows: the earth at the bed, with the rain pooled on it, and the
 * pit's sides where the area ends (against the facades' feet, the lane and the street past the
 * mouth and at the end block), the asphalt over the concrete base. Drawn after the street: where
 * it stands over them they cost nothing.
 */
function underStreet(scene: THREE.Scene): void {
  const { x0, x1, bed, depth } = GROUND;
  const w = x1 - x0;
  // The map's 2 m tile by the plane's own coordinates (repeat()'s clones of a map still loading
  // are uploaded without an image: an error each frame until it comes)
  const floor = new THREE.PlaneGeometry(w, 2 * FRONT);
  const uvs = floor.attributes.uv;
  for (let i = 0; i < uvs.count; i++) uvs.setXY(i, (uvs.getX(i) * w) / 2, uvs.getY(i) * FRONT);
  const earth = new THREE.Mesh(floor, craterWater(textured('rocky_trail_02', { base, color: 0x6a645c, roughness: 0.35 })));
  earth.rotation.x = -Math.PI / 2;
  earth.position.set((x0 + x1) / 2, bed, 0);
  earth.receiveShadow = true;
  earth.renderOrder = 1;
  scene.add(earth);
  const m = new THREE.MeshStandardNodeMaterial({ roughness: 0.85 });
  const along = select(abs(normalWorld.x).greaterThan(0.5), positionWorld.z, positionWorld.x);
  const y = positionWorld.y;
  const asphalt = texture(mapOf('neon_asphalt_dry_diff', true, base), vec2(along, y).div(4)).rgb.mul(0.68);
  const concrete = texture(mapOf('neon_concrete_diff', true, base), vec2(along, y).div(2)).rgb;
  m.colorNode = mix(concrete, asphalt, step(-depth, y));
  const side = (length: number, at: [number, number], turn: number) => {
    const s = new THREE.Mesh(new THREE.PlaneGeometry(length, -bed), m);
    s.position.set(at[0], bed / 2, at[1]);
    s.rotation.y = turn;
    s.renderOrder = 1;
    scene.add(s);
  };
  // Each facing into the area
  side(w, [(x0 + x1) / 2, -FRONT], 0);
  side(w, [(x0 + x1) / 2, FRONT], Math.PI);
  side(2 * FRONT, [x0, 0], Math.PI / 2);
  side(2 * FRONT, [x1, 0], -Math.PI / 2);
}

/**
 * The ground: the wet street drawn everywhere but over the alley's breakable ground (its slabs draw
 * it there) and where a blast has laid it breakable round the alley (dormant ground: tiles of the
 * alley's layers, cut out of the drawing as they're laid), what a crater shows under it, and the
 * ground in the world: the bed under the area, and round it the tiles (fixed boxes reaching below
 * the bed, so nothing slips under it out of a crater) but under the towers, which stand on boxes of
 * their own.
 */
function ground(scene: THREE.Scene, world: World, specs: TowerSpec[]): DormantGround {
  const { x0, x1, bed } = GROUND;
  world.addBox({ size: [x1 - x0, 1, 2 * FRONT], position: [(x0 + x1) / 2, bed - 0.5, 0], fixed: true, friction: 0.8 });
  const within = (x: number, z: number, [c0, d0, c1, d1]: [number, number, number, number]) => x > c0 && x < c1 && z > d0 && z < d1;
  const footprints = specs.map((t) => [t.x - t.w / 2, t.z - t.d / 2, t.x + t.w / 2, t.z + t.d / 2] as [number, number, number, number]);
  // The tiles cut along the alley's edges (they meet its ground; those on it are left out) and left
  // out where their middle is under a tower (it has its own ground box: one only partly under a
  // tower keeps its box there too, so no ground is missing)
  const dormant = new DormantGround(scene, world, {
    name: 'street',
    area: [-120, -120, 120, 120],
    tile: 8,
    cuts: { xs: [x0, x1], zs: [-FRONT, FRONT] },
    top: 0,
    bottom: -1.5,
    friction: 0.8,
    skip: ([a0, b0, a1, b1]) => [[x0, -FRONT, x1, FRONT] as [number, number, number, number], ...footprints].some((f) => within((a0 + a1) / 2, (b0 + b1) / 2, f)),
    layers: (area) => [{ material: 'asphalt', under: 'base', bed: 'earth', area, top: 0, depth: GROUND.depth, underDepth: GROUND.underDepth, cell: GROUND.cell, toss: GROUND.toss, textureFrame: { position: [0, 0, 0] } }],
  });
  // Under the towers: their ground (their own boxes stand on it)
  for (const [a0, b0, a1, b1] of footprints) world.addBox({ size: [a1 - a0, 1.5, b1 - b0], position: [(a0 + a1) / 2, -0.75, (b0 + b1) / 2], fixed: true, friction: 0.8 });
  const m = new THREE.MeshStandardNodeMaterial({ metalness: 0 });
  const xz = positionWorld.xz;
  const wet = wetStreet(xz, vec2(xz.x, xz.y.negate()).div(4), float(1), float(1));
  m.colorNode = wet.color;
  m.normalNode = transformNormalToView(wet.normal);
  m.roughnessNode = wet.roughness;
  m.aoNode = wet.ao;
  m.emissiveNode = wet.emissive;
  dormant.cut(m, xz);
  // 240 m square, with the area cut out (laid flat: the shape's y is the world's -z), in the world's
  // frame as the slabs are, so its normal is taken as they take it
  const shape = new THREE.Shape([new THREE.Vector2(-120, -120), new THREE.Vector2(120, -120), new THREE.Vector2(120, 120), new THREE.Vector2(-120, 120)]);
  shape.holes.push(new THREE.Path([new THREE.Vector2(x0, -FRONT), new THREE.Vector2(x0, FRONT), new THREE.Vector2(x1, FRONT), new THREE.Vector2(x1, -FRONT)]));
  const plane = new THREE.Mesh(new THREE.ShapeGeometry(shape).rotateX(-Math.PI / 2), m);
  plane.receiveShadow = true;
  scene.add(plane);
  underStreet(scene);
  return dormant;
}

/**
 * Night facades: a dark body with paler spandrel bands at each floor and a parapet line at the
 * roof, and a grid of windows 1.6 × 3.2 m (as the alley's own; finer, 0.9 × 2.5 m, on the lower
 * 10 m of the blocks seen close), about one in ten lit, cool or warm, each with its own level and a
 * curtain or blind across it. LED bands in dashes on some towers, none at street level. A tower's
 * tone is data, not a colour: its hash (x), its height / 256 (y), finer windows (z).
 */
const nightFacade: FacadeLook = ({ along, y, tone, top }) => {
  const tower = tone.x;
  const fine = tone.z.greaterThan(0.5).and(y.lessThan(10));
  const size = select(fine, vec2(0.9, 2.5), vec2(1.6, 3.2));
  const cell = vec2(along, y).div(size);
  const f = fract(cell);
  const id = floor(cell);
  // The window: 70 % of the cell's width, 1.5 m tall over a sill
  const isWindow = step(0.15, f.x).mul(step(f.x, 0.85)).mul(step(0.28, f.y)).mul(step(f.y, 0.76));
  // Height under the roof
  const fromTop = tone.y.mul(256).sub(y);
  const salt = floor(tower.mul(997));
  const r = cellHash(id.x, id.y, salt);
  const cool = step(r, 0.035);
  const warm = step(0.035, r).mul(step(r, 0.1));
  // Inside a lit window: its own level, brighter at the top (a ceiling light), and a curtain drawn
  // part way across (some from the left, some from the right) or blinds
  const h1 = cellHash(id.x, id.y, salt.add(1000));
  const h2 = cellHash(id.x, id.y, salt.add(2000));
  const wx = f.x.sub(0.15).div(0.7);
  const wy = f.y.sub(0.28).div(0.48);
  const level = h1.mul(0.6).add(0.4);
  const ceiling = wy.mul(0.6).add(0.5);
  const open = select(h2.greaterThan(0.5), wx, float(1).sub(wx));
  const curtain = mix(float(0.25), float(1), smoothstep(h2.mul(0.5).add(0.15), h2.mul(0.5).add(0.25), open));
  const blinds = mix(float(1), fract(wy.mul(9)).smoothstep(0.5, 0.7).oneMinus().mul(0.6).add(0.4), step(0.75, h1));
  const lightIn = level.mul(ceiling).mul(curtain).mul(blinds);
  const dashes = step(0.15, fract(along.div(7)));
  const band = step(0.55, tower).mul(step(fract(id.y.div(float(3).add(floor(tower.mul(2))))), 0.01)).mul(step(f.y, 0.12)).mul(step(1, id.y)).mul(dashes);
  const bandColor = mix(color(0x22e6ff), color(0xff2bd6), step(0.8, tower));
  // The body: dark render, a paler spandrel at each floor, a pale parapet line under the roof
  const wall = mix(color(0x161c2a), color(0x20242e), tower);
  const spandrel = step(f.y, 0.16).mul(0.5);
  const parapet = step(fromTop, 0.9).mul(0.6).add(step(fromTop, 0.12).mul(0.8));
  const body = wall.mul(float(1).add(spandrel).add(parapet));
  const glass = mix(color(0x0a0d12), color(0x141a24), wy);
  const lit = color(0xcfe6ff).mul(cool).add(color(0xffc890).mul(warm)).mul(isWindow).mul(step(0.9, fromTop)).mul(lightIn).mul(0.45);
  return {
    color: select(top, wall.mul(0.8), mix(body, glass, isWindow.mul(step(0.9, fromTop)))),
    toned: float(0),
    emissive: select(top, vec3(0), lit.add(bandColor.mul(band).mul(1.2))),
    roughness: mix(float(0.85), float(0.2), isWindow),
  };
};

/** A glowing billboard plane: `cells` atlas cells across from (col, row) (glyphs and pictograms) on a colour, at `strength`. */
function billboardMaterial(tint: number, col: number, row: number, cells: number, strength: number): THREE.MeshBasicNodeMaterial {
  const m = new THREE.MeshBasicNodeMaterial({ side: THREE.DoubleSide });
  const g = texture(glyphAtlas(), uv().mul(vec2(cells / 4, 0.25)).add(vec2(col / 4, row / 4))).r;
  const t = color(tint);
  m.colorNode = mix(t.mul(0.25), mix(t, vec3(1), 0.6), g).mul(strength);
  return m;
}

/**
 * The sky at night: the HDRI's overcast kept for its clouds' shapes, but recoloured as clouds lit
 * from below by the city (sodium near the horizon, violet higher up) and brighter low down. The
 * lighting keeps the original (scene.environment).
 */
function nightSky(scene: THREE.Scene): void {
  const src = scene.background;
  if (!(src instanceof THREE.DataTexture) || src.type !== THREE.HalfFloatType) return;
  const { width, height, data } = src.image as { width: number; height: number; data: Uint16Array };
  const out = new Uint16Array(data.length);
  const { fromHalfFloat: from, toHalfFloat: to } = THREE.DataUtils;
  const low = new THREE.Color(0xff8a40);
  const high = new THREE.Color(0x5a3c9a);
  const c = new THREE.Color();
  for (let y = 0; y < height; y++) {
    // 0 at the horizon, 1 straight up or down (the same either way the rows run)
    const e = Math.abs((y + 0.5) / height - 0.5) * 2;
    c.copy(low).lerp(high, Math.min(1, e / 0.45));
    const gain = 0.6 + 1.8 * (1 - Math.min(1, e / 0.5)) ** 2;
    for (let x = 0; x < width; x++) {
      const i = 4 * (y * width + x);
      const l = (0.2126 * from(data[i]) + 0.7152 * from(data[i + 1]) + 0.0722 * from(data[i + 2])) * gain;
      out[i] = to(c.r * l);
      out[i + 1] = to(c.g * l);
      out[i + 2] = to(c.b * l);
      out[i + 3] = data[i + 3];
    }
  }
  const t = new THREE.DataTexture(out, width, height, src.format as THREE.PixelFormat, src.type, src.mapping as THREE.Mapping, src.wrapS, src.wrapT, src.magFilter, src.minFilter);
  t.colorSpace = src.colorSpace;
  t.flipY = src.flipY;
  t.generateMipmaps = src.generateMipmaps;
  t.needsUpdate = true;
  scene.background = t;
}

/** Shopfront cells along the avenue, 4 m each. */
const CELL = 4;
const CELLS = 40;
const SHOP_LIGHTS = [0xffd9a8, 0xffe8c8, 0xd8ecff, 0xffc8dc];

/**
 * The avenue's street level: a band of shopfronts 3.4 m tall and `len` long, `cells` (a data
 * texture: per 4 m cell, whether it's lit, shuttered or dark, its light, its sign's colour and atlas
 * place) from cell `first`. A lit one is a window on a lit room (mullions, a transom, a counter or
 * shelves) under a glowing fascia with a row of glyphs; a shuttered one is grey slats under a dark
 * fascia.
 */
function shopfrontMaterial(cells: THREE.DataTexture, first: number, len: number, place?: THREE.Node<'vec2'>): THREE.MeshBasicNodeMaterial {
  const m = new THREE.MeshBasicNodeMaterial();
  // (Along the band and up it in metres: the plane's own uv, or a piece's map coordinates)
  const s = place ? place.x : uv().x.mul(len);
  const y = place ? place.y : uv().y.mul(3.4);
  const k = floor(s.div(CELL));
  const f = s.sub(k.mul(CELL));
  const info = texture(cells, vec2(fract(k.add(first + 0.5).div(CELLS)), 0.5));
  const inside = step(0.35, f).mul(step(f, CELL - 0.35));
  const glass = inside.mul(step(0.12, y)).mul(step(y, 2.55));
  const fascia = inside.mul(step(2.65, y)).mul(step(y, 3.3));
  // The room's light: warm or cool, brighter up by the ceiling
  const pick = (list: number[], i: THREE.Node<'float'>): THREE.Node<'vec3'> => {
    const rgb = (h: number) => vec3(...new THREE.Color(h).toArray());
    let c: THREE.Node<'vec3'> = rgb(list[0]);
    list.slice(1).forEach((h, j) => (c = mix(c, rgb(h), step(j + 0.5, i))));
    return c;
  };
  const room = pick(SHOP_LIGHTS, info.y).mul(y.div(2.55).mul(0.6).add(0.35)).mul(0.6);
  // Shelves in some (dark lines with goods between), a counter in the others
  const shelves = step(1.5, info.y).mul(max(step(abs(y.sub(1.2)), 0.04), step(abs(y.sub(1.75)), 0.04))).mul(step(0.6, f)).mul(step(f, 3.4));
  const counter = step(info.y, 1.5).mul(step(y, 0.95)).mul(step(1.0, f)).mul(step(f, 3.0));
  const mullion = max(step(abs(f.sub(1.45)), 0.03), step(abs(f.sub(2.55)), 0.03)).max(step(abs(y.sub(2.15)), 0.025));
  const lit = room.mul(float(1).sub(max(counter, shelves).mul(0.75))).mul(float(1).sub(mullion.mul(0.9)));
  // The fascia's sign: five glyphs 0.5 m tall from the atlas, from the cell's own place in it
  const gx = f.sub(0.55).div(0.58);
  const gi = floor(gx);
  const gv = y.sub(2.73).div(0.5);
  const inGlyphs = step(0, gx).mul(step(gx, 5)).mul(step(0, gv)).mul(step(gv, 1));
  const at = vec2(fract(gx), gv.clamp(0, 1)).add(vec2(fract(info.z.add(gi).div(4)).mul(4).floor(), info.w)).div(4);
  const g = texture(glyphAtlas(), at).r.mul(inGlyphs);
  const neon = pick(BILLBOARD_TINTS, info.z.add(info.w.mul(3)).mod(6));
  const sign = mix(neon.mul(0.1), mix(neon, vec3(1), 0.35).mul(1.8), g);
  // Shutters: grey slats, faintly lit by the street
  const slats = fract(y.mul(9)).smoothstep(0.6, 0.9).mul(0.025).add(0.045);
  const isLit = step(0.75, info.x);
  const isShut = step(0.25, info.x).mul(float(1).sub(isLit));
  const wall = vec3(0.025, 0.027, 0.035);
  let c: THREE.Node<'vec3'> = wall;
  c = mix(c, lit, glass.mul(isLit));
  c = mix(c, sign, fascia.mul(isLit));
  c = mix(c, vec3(slats, slats, slats.mul(1.1)), glass.mul(isShut));
  c = mix(c, vec3(0.04, 0.04, 0.05), fascia.mul(isShut));
  m.colorNode = c;
  return m;
}

/**
 * Shopfronts along a facade line: a band from `a` to `b` (world points at street level, the band
 * facing `facing`), and awnings over some lit ones (added to `awnings`).
 */
function shopfronts(scene: THREE.Scene, cells: THREE.DataTexture, data: Float32Array, first: number, a: THREE.Vector3, b: THREE.Vector3, facing: number, awnings: THREE.Matrix4[], awningColors: THREE.Color[], rand: () => number): { mesh: THREE.Mesh; a: THREE.Vector3; b: THREE.Vector3; first: number } {
  const len = a.distanceTo(b);
  const band = new THREE.Mesh(new THREE.PlaneGeometry(len, 3.4), shopfrontMaterial(cells, first, len));
  band.position.copy(a).add(b).multiplyScalar(0.5).setY(1.7);
  band.rotation.y = facing;
  scene.add(band);
  // Awnings over some of the lit ones, out from the band, tipped down
  const dir = b.clone().sub(a).normalize();
  const out = new THREE.Vector3(Math.sin(facing), 0, Math.cos(facing));
  for (let i = 0; i * CELL + CELL <= len; i++) {
    const k = (i + first) % CELLS;
    if (data[k * 4] < 0.75 || rand() < 0.4) continue;
    const at = a.clone().addScaledVector(dir, (i + 0.5) * CELL).addScaledVector(out, 0.55).setY(2.62);
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(1, 0, 0), dir).premultiply(new THREE.Quaternion().setFromAxisAngle(dir, -0.25));
    awnings.push(new THREE.Matrix4().compose(at, q, new THREE.Vector3(CELL - 0.8, 0.06, 1.1)));
    awningColors.push(new THREE.Color([0xc83a3a, 0x2a6ab0, 0x2a9a6a, 0xd89a2a, 0x8a3ab0][Math.floor(rand() * 5)]));
  }
  return { mesh: band, a, b, first };
}

const BILLBOARD_TINTS = [0x22e6ff, 0xff2bd6, 0xffa62b, 0xff3a7a, 0x14ffc8, 0x8a5bff];

/** Something on a tower's face (a sign, a shopfront, an awning, a beacon): it goes with the section it's on, built anew as a piece. */
interface Attachment {
  at: [number, number, number];
  hide: () => void;
  build?: (d: Destruction) => void;
}

let towers: Towers | null = null;
let attachments: Attachment[] = [];
let street: DormantGround | null = null;
const BLOCK = { storey: 3.2, bay: 3.2, section: 12.8, wall: 0.3, material: 'block', name: 'blocks', shadows: false };

/** A tower's hash (0–1), from where it stands. */
const towerHash = (x: number, z: number) => Math.abs((Math.sin(x * 12.9898 + z * 78.233) * 43758.5453) % 1);

export function neonScenery(scene: THREE.Scene, world: World): void {
  nightSky(scene);
  const rand = random(5);
  const specs: TowerSpec[] = [];
  attachments = [];
  // A building (its tone: its hash, its height, finer windows low down)
  const place = (x: number, z: number, w: number, d: number, h: number, fine = false) => specs.push({ x, z, w, d, h, tone: new THREE.Color().setRGB(towerHash(x, z), h / 256, fine ? 1 : 0, THREE.LinearSRGBColorSpace) });
  const plane = new THREE.PlaneGeometry(1, 1);
  const sign = (at: THREE.Vector3, w: number, h: number, facing: number, tint: number, strength = 2.2, body: Body | null = null) => {
    // Each from its own place in the atlas, so no two read alike
    const col = Math.floor(rand() * 4);
    const row = Math.floor(rand() * 2);
    const cells = Math.max(1, Math.round(w / h));
    const m = new THREE.Mesh(plane, billboardMaterial(tint, col, row, cells, strength));
    m.scale.set(w, h, 1);
    m.position.copy(at);
    m.rotation.y = facing;
    scene.add(m);
    // Woken, a lightbox showing the same cells, facing the same way
    const n: V3 = [Math.round(Math.sin(facing)), 0, Math.round(Math.cos(facing))];
    const size: V3 = n[0] ? [0.15, h, w] : [w, h, 0.15];
    attachments.push({
      at: [at.x, at.y, at.z],
      hide: () => {
        m.visible = false;
        if (body?.alive) body.remove();
      },
      build: (d) => lightbox(d, [at.x - n[0] * 0.07, at.y, at.z - n[2] * 0.07], size, n, tint, h, col, row),
    });
  };
  // The back rows: towers behind both rows, wide gaps only at the lane
  for (const side of [1, -1]) {
    let x = -30;
    while (x < 52) {
      const w = 8 + rand() * 8;
      // The lane runs on north
      if (side === 1 && x < LANE.x1 && x + w > LANE.x0) {
        if (x < LANE.x0) place((x + LANE.x0) / 2, side * 22, LANE.x0 - x, 16, 26 + rand() * 30);
        x = LANE.x1;
        continue;
      }
      const d = 12 + rand() * 6;
      const h = 26 + rand() * 34;
      place(x + w / 2, side * (14 + d / 2), w, d, h);
      // A billboard on some roofs, facing the alley
      if (rand() < 0.45) {
        const bw = 6 + rand() * 6;
        const bh = 4 + rand() * 2;
        // A thin box, so a rocket at it goes off there
        const body = world.addBox({ size: [bw, bh, 0.2], position: [x + w / 2, h + bh / 2 + 1, side * 14.5], fixed: true, friction: 0.8 })!;
        // Facing the alley (a plane faces +z unturned): seen from behind, its glyphs would be mirrored
        sign(new THREE.Vector3(x + w / 2, h + bh / 2 + 1, side * 14.5), bw, bh, side === 1 ? Math.PI : 0, BILLBOARD_TINTS[Math.floor(rand() * BILLBOARD_TINTS.length)], 2.2, body);
      }
      x += w + 0.4;
    }
  }
  // The lane north, on into the fog, with a few signs on its walls
  for (let z = 14; z < 70; z += 10) {
    place(LANE.x0 - 4, z + 5, 8, 10, 22 + rand() * 20);
    place(LANE.x1 + 4, z + 5, 8, 10, 22 + rand() * 20);
    if (rand() < 0.7) sign(new THREE.Vector3(LANE.x0 + 0.02, 4 + rand() * 6, z + 3 + rand() * 4), 1.6, 2.6, Math.PI / 2, BILLBOARD_TINTS[Math.floor(rand() * 6)], 3);
    if (rand() < 0.7) sign(new THREE.Vector3(LANE.x1 - 0.02, 4 + rand() * 6, z + 3 + rand() * 4), 1.6, 2.6, -Math.PI / 2, BILLBOARD_TINTS[Math.floor(rand() * 6)], 3);
  }
  // Beyond the end block: a lit passage east, then more towers
  for (const side of [1, -1]) {
    for (let x = 38.5; x < 62; x += 6) place(x + 3, side * 6, 6, 7, 14 + rand() * 12);
    for (let x = 38.5; x < 62; x += 6) {
      const glowStrip = new THREE.Mesh(plane, new THREE.MeshBasicNodeMaterial({ color: new THREE.Color(0xffc890).multiplyScalar(2.2) }));
      glowStrip.scale.set(4.5, 2.2, 1);
      glowStrip.position.set(x + 3, 1.6, side * 2.49);
      glowStrip.rotation.y = side === 1 ? Math.PI : 0;
      scene.add(glowStrip);
      attachments.push({ at: [x + 3, 1.6, side * 2.49], hide: () => (glowStrip.visible = false), build: (d) => void d.addBox({ material: 'lamp', size: [4.5, 2.2, 0.06], position: [x + 3, 1.6, side * 2.53], tint: 0xffc890 }) });
    }
  }
  place(48, 0, 6, 24, 40);
  // The avenue behind the start: facades across it, with big lightboxes
  for (let z = -60; z < 60; z += 12) {
    const h = 24 + rand() * 26;
    place(-52, z + 6, 12, 12, h);
    if (rand() < 0.7) sign(new THREE.Vector3(-45.95, 6 + rand() * 10, z + 6), 8, 4 + rand() * 3, Math.PI / 2, BILLBOARD_TINTS[Math.floor(rand() * 6)], 2.6);
  }
  // Corner blocks on the alley's side of the avenue, past the rows (seen close: finer windows low down)
  for (const side of [1, -1]) place(-28, side * 20, 4, 14, 30 + rand() * 20, true);
  // Street level on the avenue: shopfronts across it (a band a block) and on the corner blocks, awnings over some
  const data = new Float32Array(CELLS * 4);
  for (let i = 0; i < CELLS; i++) {
    const r = rand();
    data.set([r < 0.6 ? 1 : r < 0.88 ? 0.5 : 0, Math.floor(rand() * 4), Math.floor(rand() * 4), Math.floor(rand() * 2)], i * 4);
  }
  const cells = new THREE.DataTexture(data, CELLS, 1, THREE.RGBAFormat, THREE.FloatType);
  cells.needsUpdate = true;
  shopCells = cells;
  const awnings: THREE.Matrix4[] = [];
  const awningColors: THREE.Color[] = [];
  const bands: Array<{ mesh: THREE.Mesh; a: THREE.Vector3; b: THREE.Vector3; first: number }> = [];
  for (let k = 0; k < 10; k++) bands.push(shopfronts(scene, cells, data, 3 * k, new THREE.Vector3(-45.97, 0, 60 - 12 * k), new THREE.Vector3(-45.97, 0, 48 - 12 * k), Math.PI / 2, awnings, awningColors, rand));
  bands.push(shopfronts(scene, cells, data, 31, new THREE.Vector3(-30.02, 0, 13), new THREE.Vector3(-30.02, 0, 27), -Math.PI / 2, awnings, awningColors, rand));
  bands.push(shopfronts(scene, cells, data, 35, new THREE.Vector3(-30.02, 0, -27), new THREE.Vector3(-30.02, 0, -13), -Math.PI / 2, awnings, awningColors, rand));
  for (const band of bands) {
    const mid = band.a.clone().add(band.b).multiplyScalar(0.5);
    const len = band.a.distanceTo(band.b);
    const out = band.a.x < -40 ? 1 : -1;
    // Woken: a panel of the same shopfronts (its map laid from the band's start, a cell `first` on)
    attachments.push({
      at: [mid.x, 1.7, mid.z],
      hide: () => (band.mesh.visible = false),
      build: (d) =>
        void d.addBox({
          material: 'shopfront',
          size: [0.08, 3.4, len],
          position: [mid.x + out * 0.02, 1.7, mid.z],
          textureFrame: { position: [band.a.x, 0, out > 0 ? band.a.z + band.first * CELL : band.a.z - band.first * CELL], rotation: [0, 0, 0, 1] },
        }),
    });
  }
  const sheets = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardNodeMaterial({ roughness: 0.5 }), awnings.length);
  awnings.forEach((m, i) => {
    sheets.setMatrixAt(i, m);
    sheets.setColorAt(i, awningColors[i]);
    const p = new THREE.Vector3();
    const q = new THREE.Quaternion();
    const sc = new THREE.Vector3();
    m.decompose(p, q, sc);
    // (On the face it hangs from: 0.55 m back the way it sticks out, its box's z across the band)
    const out = new THREE.Vector3(0, 0, 1).applyQuaternion(q).setY(0).normalize();
    attachments.push({
      at: [p.x - out.x * 0.55, p.y, p.z - out.z * 0.55],
      hide: () => {
        sheets.setMatrixAt(i, new THREE.Matrix4().makeScale(0, 0, 0));
        sheets.instanceMatrix.needsUpdate = true;
      },
      build: (d) => void d.addBox({ material: 'awning', size: [sc.x, sc.y, sc.z], position: [p.x, p.y, p.z], rotation: [q.x, q.y, q.z, q.w], tint: awningColors[i] }),
    });
  });
  scene.add(sheets);
  // The far skyline, fading into the fog, with red beacons on the tall ones
  const beaconMat = new THREE.MeshBasicNodeMaterial();
  beaconMat.colorNode = color(0xff2010).mul(life.beacon.mul(12));
  const beacon = new THREE.BoxGeometry(0.8, 0.8, 0.8);
  for (let k = 0; k < 70; k++) {
    const a = rand() * Math.PI * 2;
    const r = 60 + rand() * 150;
    const x = 5 + Math.cos(a) * r;
    const z = Math.sin(a) * r;
    if (Math.abs(z) < 40 && x > -44 && x < 60) continue;
    const h = 60 + rand() * 120;
    const w = 14 + rand() * 18;
    place(x, z, w, 14 + rand() * 18, h);
    if (h > 110) {
      const b = new THREE.Mesh(beacon, beaconMat);
      b.position.set(x, h + 0.6, z);
      scene.add(b);
      attachments.push({ at: [x, h + 0.6, z], hide: () => (b.visible = false), build: (d) => void d.addBox({ material: 'lamp', size: [0.8, 0.8, 0.8], position: [x, h + 0.4, z], tint: 0xff2010 }) });
    }
  }
  towers = new Towers(scene, world, specs, nightFacade, BLOCK);
  street = ground(scene, world, specs);
  // Traffic on the avenue: headlights one way, tail lights the other
  const head = new THREE.MeshBasicNodeMaterial({ color: new THREE.Color(0xfff2d8).multiplyScalar(6) });
  const tail = new THREE.MeshBasicNodeMaterial({ color: new THREE.Color(0xff2010).multiplyScalar(5) });
  const lamp = new THREE.CircleGeometry(0.12, 10);
  for (let i = 0; i < 6; i++) {
    const dir = i % 2 ? 1 : -1;
    const g = new THREE.Group();
    for (const dx of [-0.65, 0.65]) {
      const front = new THREE.Mesh(lamp, head);
      front.position.set(dx, 0, 2.2 * dir);
      front.rotation.y = dir > 0 ? 0 : Math.PI;
      const back = new THREE.Mesh(lamp, tail);
      back.position.set(dx, 0.1, -2.2 * dir);
      back.rotation.y = dir > 0 ? Math.PI : 0;
      g.add(front, back);
    }
    const x = dir > 0 ? -40 : -34;
    g.position.set(x, 0.7, -120 + rand() * 240);
    scene.add(g);
    life.cars.push({ mesh: g, x, dir, speed: 9 + rand() * 6, z: g.position.z });
  }
}

/**
 * The scenery as dormant things, once the Destruction is made: each tower's sections (and what's
 * on each: on its faces, or over its roof if it's the top), the street round the alley.
 */
export function dormantScenery(d: Destruction): void {
  towers?.dormant(d, (t, y0, y1) => {
    const top = y1 >= t.h - 1e-6;
    const on = attachments.filter(({ at: [x, y, z] }) => Math.abs(x - t.x) <= t.w / 2 + 0.7 && Math.abs(z - t.z) <= t.d / 2 + 0.7 && y >= y0 - 1e-6 && (y < y1 || top));
    return { hide: () => on.forEach((a) => a.hide()), build: (dd) => on.forEach((a) => a.build?.(dd)) };
  });
  street?.dormant(d);
}

/** The street's bed where a blast has laid it breakable round the alley, else null (the world's groundAt). */
export const streetBed = (x: number, z: number): number | null => street?.bedAt(x, z) ?? null;

/** The blocks' pieces: their night facades as the scenery's, crumbling as render does. */
export function blockMaterial(): BreakableMaterial {
  if (!towers) throw new Error('neon: blocks before the scenery');
  return towers.material({ inside: 0x6a6670, insideTexture: inside('gen_concrete_broken', 1.2), strength: 2000 });
}

/** The shopfronts' cells (made with the scenery). */
let shopCells: THREE.DataTexture | null = null;

/**
 * A shopfront panel's look: the bands' (shopfrontMaterial) read from its map's coordinates (laid
 * from its band's start, a cell `first` on, in metres along the band, up from the street), lit.
 */
export function shopfrontPiece(): BreakableMaterial {
  if (!shopCells) throw new Error('neon: shopfronts before the scenery');
  const band = shopfrontMaterial(shopCells, 0, 1, uv());
  const surface = new THREE.MeshStandardNodeMaterial({ color: 0x000000, roughness: 0.4 });
  surface.emissiveNode = band.colorNode as THREE.Node<'color'>;
  return material({ density: 1.2, strength: 3e3, support: 40, impact: 3, shatter: true, reach: 1.5, fragmentSize: 0.3, minSize: 0.08, minBodySize: 0.12, dustSize: 0.2, maxPieces: 6, rubbleLife: 4, surface, glow: 'standing', inside: 0x2a2a30, insideMap: 0, uvScale: 1, uvJitter: 0 });
}

/** The scenery's motion: beacons blink (1 s, 0.15 s on), cars go by. */
export function sceneryUpdate(dt: number, t: number): void {
  life.beacon.value = t % 1 < 0.15 ? 1 : 0;
  for (const c of life.cars) {
    c.z += c.dir * c.speed * dt;
    if (c.z > 130) c.z = -130;
    if (c.z < -130) c.z = 130;
    c.mesh.position.z = c.z;
  }
}
