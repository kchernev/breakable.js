// What doesn't break: the street past the alley's breakable ground (wet.ts), the towers that
// wall the alley in behind both rows, their rooftop billboards, the far skyline with its blinking
// beacons, the avenue behind the start (shopfronts, awnings, traffic), the lane north and the
// passage east. The buildings and billboards close by are fixed boxes in the world too, so
// rockets go off on them and debris and the player stop at them; the far skyline isn't.

import { abs, color, float, floor, fract, max, mix, modelScale, normalWorld, positionGeometry, positionWorld, select, smoothstep, step, texture, transformNormalToView, uniform, uv, vec2, vec3 } from 'three/tsl';
import * as THREE from 'three/webgpu';
import type { World } from 'three-avbd';
import { random } from '../../../lib/index.ts';
import { texture as mapOf, textured } from '../../textures.ts';
import { glyphAtlas } from './glyphs.ts';
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
 * it there), what a crater shows under it, and the ground in the world: the bed under the area, and
 * round it the ground reaching below the bed, so nothing slips under it out of a crater.
 */
function ground(scene: THREE.Scene, world: World): void {
  const { x0, x1, bed } = GROUND;
  world.addBox({ size: [x1 - x0, 1, 2 * FRONT], position: [(x0 + x1) / 2, bed - 0.5, 0], fixed: true, friction: 0.8 });
  const around = (a: number, b: number, c: number, e: number) => world.addBox({ size: [b - a, 1.5, e - c], position: [(a + b) / 2, -0.75, (c + e) / 2], fixed: true, friction: 0.8 });
  around(-120, x0, -120, 120);
  around(x1, 120, -120, 120);
  around(x0, x1, FRONT, 120);
  around(x0, x1, -120, -FRONT);
  const m = new THREE.MeshStandardNodeMaterial({ metalness: 0 });
  const xz = positionWorld.xz;
  const wet = wetStreet(xz, vec2(xz.x, xz.y.negate()).div(4), float(1), float(1));
  m.colorNode = wet.color;
  m.normalNode = transformNormalToView(wet.normal);
  m.roughnessNode = wet.roughness;
  m.aoNode = wet.ao;
  m.emissiveNode = wet.emissive;
  // 240 m square, with the area cut out (laid flat: the shape's y is the world's -z), in the world's
  // frame as the slabs are, so its normal is taken as they take it
  const shape = new THREE.Shape([new THREE.Vector2(-120, -120), new THREE.Vector2(120, -120), new THREE.Vector2(120, 120), new THREE.Vector2(-120, 120)]);
  shape.holes.push(new THREE.Path([new THREE.Vector2(x0, -FRONT), new THREE.Vector2(x0, FRONT), new THREE.Vector2(x1, FRONT), new THREE.Vector2(x1, -FRONT)]));
  const plane = new THREE.Mesh(new THREE.ShapeGeometry(shape).rotateX(-Math.PI / 2), m);
  plane.receiveShadow = true;
  scene.add(plane);
  underStreet(scene);
}

/**
 * Night facades: a dark body with paler spandrel bands at each floor and a parapet line at the
 * roof, and a grid of windows 1.6 × 3.2 m (as the alley's own; `fine`: 0.9 × 2.5 m on the lower
 * 10 m, for the blocks seen close), about one in ten lit, cool or warm, each with its own level and
 * a curtain or blind across it. LED bands in dashes on some towers, none at street level.
 */
function towerMaterial(fine = false): THREE.MeshStandardNodeMaterial {
  const m = new THREE.MeshStandardNodeMaterial({ roughness: 0.8 });
  const side = abs(normalWorld.x).greaterThan(0.5);
  const along = select(side, positionWorld.z, positionWorld.x);
  const size = fine ? select(positionWorld.y.lessThan(10), vec2(0.9, 2.5), vec2(1.6, 3.2)) : vec2(1.6, 3.2);
  const cell = vec2(along, positionWorld.y).div(size);
  const f = fract(cell);
  const id = floor(cell);
  // The window: 70 % of the cell's width, 1.5 m tall over a sill
  const isWindow = step(0.15, f.x).mul(step(f.x, 0.85)).mul(step(0.28, f.y)).mul(step(f.y, 0.76));
  const top = abs(normalWorld.y).greaterThan(0.5);
  // Height under the roof (the boxes are scaled unit cubes)
  const fromTop = float(0.5).sub(positionGeometry.y).mul(modelScale.y);
  const tower = cellHash(floor(positionWorld.x.div(11)), floor(positionWorld.z.div(11)), 7);
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
  m.colorNode = select(top, wall.mul(0.8), mix(body, glass, isWindow.mul(step(0.9, fromTop))));
  const lit = color(0xcfe6ff).mul(cool).add(color(0xffc890).mul(warm)).mul(isWindow).mul(step(0.9, fromTop)).mul(lightIn).mul(0.45);
  m.emissiveNode = select(top, vec3(0), lit.add(bandColor.mul(band).mul(1.2)));
  m.roughnessNode = mix(float(0.85), float(0.2), isWindow);
  return m;
}

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
function shopfrontMaterial(cells: THREE.DataTexture, first: number, len: number): THREE.MeshBasicNodeMaterial {
  const m = new THREE.MeshBasicNodeMaterial();
  const s = uv().x.mul(len);
  const y = uv().y.mul(3.4);
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
function shopfronts(scene: THREE.Scene, cells: THREE.DataTexture, data: Float32Array, first: number, a: THREE.Vector3, b: THREE.Vector3, facing: number, awnings: THREE.Matrix4[], awningColors: THREE.Color[], rand: () => number): void {
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
}

const BILLBOARD_TINTS = [0x22e6ff, 0xff2bd6, 0xffa62b, 0xff3a7a, 0x14ffc8, 0x8a5bff];

export function neonScenery(scene: THREE.Scene, world: World): void {
  nightSky(scene);
  ground(scene, world);
  const rand = random(5);
  const tower = towerMaterial();
  const box = new THREE.BoxGeometry(1, 1, 1);
  // A building, and a fixed box as drawn (`solid`; not the far skyline's, 60 m off and more, out of play)
  const place = (x: number, z: number, w: number, d: number, h: number, material = tower, solid = true) => {
    const m = new THREE.Mesh(box, material);
    m.scale.set(w, h, d);
    m.position.set(x, h / 2, z);
    m.receiveShadow = true;
    scene.add(m);
    if (solid) world.addBox({ size: [w, h, d], position: [x, h / 2, z], fixed: true, friction: 0.8 });
  };
  const plane = new THREE.PlaneGeometry(1, 1);
  const sign = (at: THREE.Vector3, w: number, h: number, facing: number, tint: number, strength = 2.2) => {
    // Each from its own place in the atlas, so no two read alike
    const m = new THREE.Mesh(plane, billboardMaterial(tint, Math.floor(rand() * 4), Math.floor(rand() * 2), Math.max(1, Math.round(w / h)), strength));
    m.scale.set(w, h, 1);
    m.position.copy(at);
    m.rotation.y = facing;
    scene.add(m);
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
        // Facing the alley (a plane faces +z unturned): seen from behind, its glyphs would be mirrored
        sign(new THREE.Vector3(x + w / 2, h + bh / 2 + 1, side * 14.5), bw, bh, side === 1 ? Math.PI : 0, BILLBOARD_TINTS[Math.floor(rand() * BILLBOARD_TINTS.length)]);
        // A thin box, so a rocket at it goes off there
        world.addBox({ size: [bw, bh, 0.2], position: [x + w / 2, h + bh / 2 + 1, side * 14.5], fixed: true, friction: 0.8 });
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
  const fine = towerMaterial(true);
  for (const side of [1, -1]) place(-28, side * 20, 4, 14, 30 + rand() * 20, fine);
  // Street level on the avenue: shopfronts across it and on the corner blocks, awnings over some
  const data = new Float32Array(CELLS * 4);
  for (let i = 0; i < CELLS; i++) {
    const r = rand();
    data.set([r < 0.6 ? 1 : r < 0.88 ? 0.5 : 0, Math.floor(rand() * 4), Math.floor(rand() * 4), Math.floor(rand() * 2)], i * 4);
  }
  const cells = new THREE.DataTexture(data, CELLS, 1, THREE.RGBAFormat, THREE.FloatType);
  cells.needsUpdate = true;
  const awnings: THREE.Matrix4[] = [];
  const awningColors: THREE.Color[] = [];
  shopfronts(scene, cells, data, 0, new THREE.Vector3(-45.97, 0, 60), new THREE.Vector3(-45.97, 0, -60), Math.PI / 2, awnings, awningColors, rand);
  shopfronts(scene, cells, data, 31, new THREE.Vector3(-30.02, 0, 13), new THREE.Vector3(-30.02, 0, 27), -Math.PI / 2, awnings, awningColors, rand);
  shopfronts(scene, cells, data, 35, new THREE.Vector3(-30.02, 0, -27), new THREE.Vector3(-30.02, 0, -13), -Math.PI / 2, awnings, awningColors, rand);
  const sheets = new THREE.InstancedMesh(box, new THREE.MeshStandardNodeMaterial({ roughness: 0.5 }), awnings.length);
  awnings.forEach((m, i) => {
    sheets.setMatrixAt(i, m);
    sheets.setColorAt(i, awningColors[i]);
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
    place(x, z, w, 14 + rand() * 18, h, tower, false);
    if (h > 110) {
      const b = new THREE.Mesh(beacon, beaconMat);
      b.position.set(x, h + 0.6, z);
      scene.add(b);
    }
  }
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
