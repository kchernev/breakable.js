// What doesn't break: the cobbles round the square (its own break: SQUARE), what a crater in it
// shows past its slabs, the dirt roads out, the rolling country (fields in strips with hedgerows,
// the wooded hill, the windmill hill, a ridge far north), trees, the windmill, and the rest of the
// town (more wall and round towers, roofs and gables) round the breakable part.

import { abs, cameraPosition, color, float, floor, fract, fwidth, hash, max, min, mix, mx_noise_float, normalWorld, positionWorld, select, sin, smoothstep, step, texture, uv, vec2, vec3 } from 'three/tsl';
import * as THREE from 'three/webgpu';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import type { World } from 'three-avbd';
import type { V3 } from '../../../lib/index.ts';
import { textured } from '../../textures.ts';

const base = 'packs/medieval/textures/';

/** The town's middle: flat within FLAT of it. */
const CENTRE = [5, 0] as const;
const FLAT = 55;
// The wooded hill to the north-east (broad, with a shoulder to the east); the windmill hill
// west-south-west, beside the low sun
const HILLS = [
  { x: 120, z: -190, r: 120, h: 45 },
  { x: 185, z: -150, r: 75, h: 14 },
  { x: -185, z: 95, r: 70, h: 22 },
];
const MILL = { x: -185, z: 95 };

/** The scenery houses: a storey's height, and how far an upper storey stands out over the ground floor. */
const STOREY = 2.8;
const JETTY = 0.4;

/**
 * Where the scenery houses stand (x0, z0, x1, z1). Up close they're boxes with their framing drawn
 * on, so the player keeps CLEAR (m) from them, and lanes between them narrower than twice that are
 * closed: the street south-east of the stable, the alleys behind the west row and the church.
 */
const footprints: Array<[number, number, number, number]> = [];
const CLEAR = 1.8;

/** Where the player may walk: anywhere but in among the scenery houses. */
export function walkable(x: number, z: number): boolean {
  return !footprints.some(([x0, z0, x1, z1]) => x > x0 - CLEAR && x < x1 + CLEAR && z > z0 - CLEAR && z < z1 + CLEAR);
}

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/**
 * A band of haze round the horizon, 450 m out, in the fog's colour, fading out by 8° up: the sky
 * image is a clean deep blue down to the horizon away from the sun. It goes where the eye goes
 * (`follow` each frame).
 */
export function haze(scene: THREE.Scene, fog: number): THREE.Mesh {
  const r = 450;
  const g = new THREE.CylinderGeometry(r, r, 200, 64, 1, true);
  const m = new THREE.MeshBasicNodeMaterial({ color: fog, transparent: true, depthWrite: false, side: THREE.BackSide, fog: false });
  // Height over the eye, as an angle's tangent (the band is centred on the eye)
  const up = positionWorld.y.sub(cameraPosition.y).div(r);
  m.opacityNode = float(1).sub(smoothstep(-0.01, Math.tan((8 * Math.PI) / 180), up)).mul(0.85);
  const mesh = new THREE.Mesh(g, m);
  mesh.name = 'scenery:haze';
  mesh.frustumCulled = false;
  scene.add(mesh);
  return mesh;
}

/** The ground's height: 0 in town, rolling beyond, the hills and the far ridge. */
export function height(x: number, z: number): number {
  const r = Math.hypot(x - CENTRE[0], z - CENTRE[1]);
  if (r < FLAT) return 0;
  let h = smooth(FLAT, 130, r) * (4.5 + 2.5 * Math.sin(x * 0.013 + 1.3) * Math.cos(z * 0.011 - 0.7) + 1.5 * Math.sin((x + z) * 0.021));
  for (const hill of HILLS) {
    // A ragged outline and a broad, uneven top: not a turned bell
    const a = Math.atan2(z - hill.z, x - hill.x);
    const d = Math.hypot(x - hill.x, z - hill.z);
    const t = d / (hill.r * (1 + 0.13 * Math.sin(3 * a + hill.x) + 0.07 * Math.sin(5 * a + 1.7)));
    if (t < 1) h += hill.h * (1 - t * t) ** 2 * (1 + 0.1 * Math.sin(d * 0.07 + 2 * a));
  }
  h += smooth(-200, -300, z) * (28 + 8 * Math.sin(x * 0.017));
  return h;
}

/** The cobbles' extent (x0, z0, x1, z1): from the gate passage to just past the low wall. */
const COBBLES = [-45, -20, 55, 24] as const;
/** Where the cobbles' maps are laid from (the corner of their uvs) and one tile of them (m): the drawn cobbles and the square's slabs share it. */
export const COBBLE_MAP = { origin: [COBBLES[0], 0, COBBLES[3]] as V3, tile: 2.4 };
/** The setts broken (a chunk's broken faces, a crater's sides): their map in this colour. */
export const SETTS_BROKEN = 0xc4b49c;

const depth = 0.25;
const underDepth = 0.85;
/**
 * The square's breakable ground (laid in index.ts: Destruction.addGround): cobbles over packed
 * earth, from the west row's fronts to E1, the church tower and the hall's post pads, and from the
 * gatehouse to the stable's front. The stalls, the well, the cross, the pillory, the hay wagon and
 * the lane to the gate stand on it. Slabs of about 2.5 m on its bed, where the ground's fixed body
 * lies under it; the lanes, the churchyard, the road out and the ground under every building stay
 * fixed.
 */
export const SQUARE = { area: [-14.96, -14, 14.65, 14.96] as [number, number, number, number], depth, underDepth, cell: 2.5, bed: -depth - underDepth };

/** Whether (x, z) is on the square's breakable ground, seen from above (as Ground.contains). */
export function onSquare(x: number, z: number): boolean {
  const [x0, z0, x1, z1] = SQUARE.area;
  return x >= x0 && x <= x1 && z >= z0 && z <= z1;
}

/** The world's ground (groundAt): on the square its bed (the slabs over it are found as pieces), else the land's height. */
export const groundAt = (x: number, z: number): number => (onSquare(x, z) ? SQUARE.bed : height(x, z));

/** Trodden dirt (rocky_trail_02, 2 m) at world (x, z): the cobbles fade into it, and the country round them. */
function dirtColor(map: THREE.Texture, p: THREE.Node<'vec2'>): THREE.Node<'vec3'> {
  // Half its colour: the low orange sun turned the map's red-brown to rust
  const c = texture(map, p.div(2)).rgb;
  return mix(vec3(c.dot(vec3(0.3, 0.55, 0.15))), c, 0.35).mul(color(0xc4c0b0));
}

/**
 * The packed earth under the square's cobbles, at world point `p` on a face turned `n` (the map
 * laid flat on what faces up, upright on the sides): the trodden dirt, paler and yellower, a sandy
 * clay (as dark as the dirt, a crater in the low sun's shade was a black hole).
 */
export function earthSurface(p: THREE.Node<'vec3'>, n: THREE.Node<'vec3'>): THREE.MeshStandardNodeMaterial {
  const m = textured('rocky_trail_02', { base, normalScale: 0.8 });
  const at = select(abs(n.y).greaterThan(0.5), p.xz, vec2(p.x.add(p.z), p.y));
  m.colorNode = dirtColor(m.map!, at).mul(color(0xffe4bc)).mul(1.5);
  return m;
}

/**
 * The cobbles at world (x, z) `p`: two lookups of the map, turned against each other and mixed by a
 * slow noise so its 2.4 m repeat doesn't show as a grid; worn darker and dustier in patches; at
 * their edges they give out into dirt. The drawn cobbles round the square and its slabs share it.
 * Its normal and roughness maps go by its uvs, laid as COBBLE_MAP says.
 */
export function cobbleSurface(p: THREE.Node<'vec2'>): THREE.MeshStandardNodeMaterial {
  const dirtMap = textured('rocky_trail_02', { base }).map!;
  // Shallow bumps: at 0.9 the crevices went black
  const cobbles = textured('cobblestone_floor_001', { base, normalScale: 0.6 });
  const map = cobbles.map!;
  const a = p.div(COBBLE_MAP.tile);
  const b = vec2(p.x.mul(0.8).add(p.y.mul(0.6)), p.y.mul(0.8).sub(p.x.mul(0.6))).div(2.15).add(0.37);
  const noise = (scale: number, offset: number) => mx_noise_float(vec3(p.x.mul(scale), offset, p.y.mul(scale)));
  const k = smoothstep(-0.3, 0.3, noise(0.06, 0.5));
  const both = mix(texture(map, a).rgb, texture(map, b).rgb, k);
  // A little greyer than the map's red-brown, which the low sun turns to terracotta
  const stones = mix(vec3(both.dot(vec3(0.3, 0.55, 0.15))), both, 0.7);
  const dust = smoothstep(0.15, 0.75, noise(0.04, 7.3));
  const worn = smoothstep(0.3, 0.9, noise(0.11, 2.1)).mul(0.25);
  // Lighter and warmer than the map (a pale sandstone sett): as it came, the square read as asphalt
  const laid = mix(stones.mul(float(1).sub(worn)), stones.mul(color(0xd8c4a0)).add(0.04), dust.mul(0.55)).mul(color(0xf0dcc0)).mul(1.35);
  // At their edges the cobbles give out into dirt, raggedly, as the country's apron does
  const [x0, z0, x1, z1] = COBBLES;
  const inside = min(min(p.x.sub(x0), float(x1).sub(p.x)), min(p.y.sub(z0), float(z1).sub(p.y)));
  cobbles.colorNode = mix(dirtColor(dirtMap, p), laid, smoothstep(0.5, 3.5, inside.add(noise(0.3, 4.4).mul(1.5))));
  // Never glossy: toward the low sun the stones glared white
  cobbles.roughnessNode = max(texture(cobbles.roughnessMap!, a).g, 0.82);
  return cobbles;
}

/**
 * A flat mesh at height `y` over rectangles (x0, z0, x1, z1), facing up, its uvs in `tile` m from
 * `origin` (u along x, v along -z: as the slabs of a breakable ground lay their maps on their top).
 */
function flat(rects: ReadonlyArray<readonly [number, number, number, number]>, y: number, origin: V3, tile: number): THREE.BufferGeometry {
  const g = mergeGeometries(
    rects.map(([x0, z0, x1, z1]) => {
      const r = new THREE.PlaneGeometry(x1 - x0, z1 - z0);
      r.rotateX(-Math.PI / 2);
      r.translate((x0 + x1) / 2, y, (z0 + z1) / 2);
      return r;
    }),
  );
  const pos = g.attributes.position as THREE.BufferAttribute;
  const uvs = g.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < uvs.count; i++) uvs.setXY(i, (pos.getX(i) - origin[0]) / tile, (origin[2] - pos.getZ(i)) / tile);
  return g;
}

/** The town's ground and the country round it, drawn and in the world. */
export function ground(scene: THREE.Scene, world: World): void {
  const [x0, z0, x1, z1] = SQUARE.area;
  const { bed } = SQUARE;
  // In the world: the square's bed, and round it the ground, its top at 0 and its foot under the
  // bed, so nothing slips under it out of a crater by the square's edge
  world.addBox({ size: [700, 2, 700], position: [0, bed - 1, 0], fixed: true, friction: 0.9 });
  const block = (a0: number, b0: number, a1: number, b1: number) => world.addBox({ size: [a1 - a0, 1 - bed, b1 - b0], position: [(a0 + a1) / 2, (bed - 1) / 2, (b0 + b1) / 2], fixed: true, friction: 0.9 });
  block(-350, -350, 350, z0);
  block(-350, z1, 350, 350);
  block(-350, z0, x0, z1);
  block(x1, z0, 350, z1);

  // The cobbles over the town but the square (its slabs draw it, in the same look and uvs)
  const [cx0, cz0, cx1, cz1] = COBBLES;
  const around = [
    [cx0, cz0, cx1, z0],
    [cx0, z1, cx1, cz1],
    [cx0, z0, x0, z1],
    [x1, z0, cx1, z1],
  ] as const;
  const town = new THREE.Mesh(flat(around, 0, COBBLE_MAP.origin, COBBLE_MAP.tile), cobbleSurface(positionWorld.xz));
  town.receiveShadow = true;
  scene.add(town);
  // What a crater in the square shows past its slabs: the bed, and down the square's edges (where
  // the ground beyond it stays) the setts in section over the earth, as a slab's broken side
  const pit = new THREE.Mesh(flat([SQUARE.area], bed, [0, 0, 0], 1), earthSurface(positionWorld, normalWorld));
  pit.receiveShadow = true;
  scene.add(pit);
  const edge = earthSurface(positionWorld, normalWorld);
  const setts = texture(textured('cobblestone_floor_001', { base }).map!, vec2(positionWorld.x.add(positionWorld.z), positionWorld.y).div(COBBLE_MAP.tile)).rgb;
  edge.colorNode = mix(edge.colorNode as THREE.Node<'vec3'>, setts.mul(color(SETTS_BROKEN)), step(-SQUARE.depth, positionWorld.y));
  for (const [w, at, turn] of [
    [x1 - x0, [(x0 + x1) / 2, z0], 0],
    [x1 - x0, [(x0 + x1) / 2, z1], Math.PI],
    [z1 - z0, [x0, (z0 + z1) / 2], Math.PI / 2],
    [z1 - z0, [x1, (z0 + z1) / 2], -Math.PI / 2],
  ] as const) {
    const side = new THREE.Mesh(new THREE.PlaneGeometry(w, -bed), edge);
    side.rotation.y = turn;
    side.position.set(at[0], bed / 2, at[1]);
    side.receiveShadow = true;
    scene.add(side);
  }

  country(scene, textured('rocky_trail_02', { base }).map!);
  roads(scene);
}

/** The country: one mesh, its strips of fields in a turned grid with hedgerows between. */
function country(scene: THREE.Scene, dirtMap: THREE.Texture): void {
  const size = 760;
  const n = 190;
  const g = new THREE.PlaneGeometry(size, size, n, n);
  g.rotateX(-Math.PI / 2);
  const pos = g.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const [x, z] = [pos.getX(i), pos.getZ(i)];
    const h = height(x, z);
    // Under the town's cobbles, just below them
    pos.setY(i, h > 0 ? h : -0.03);
  }
  // None of it under the cobbles, where it's out of sight: over a crater in the square it would lie
  // across the hole
  const [x0, z0, x1, z1] = COBBLES;
  const under = (v: number) => pos.getX(v) >= x0 && pos.getX(v) <= x1 && pos.getZ(v) >= z0 && pos.getZ(v) <= z1;
  const index = g.index!;
  const kept: number[] = [];
  for (let i = 0; i < index.count; i += 3) {
    const tri = [index.getX(i), index.getX(i + 1), index.getX(i + 2)];
    if (!tri.every(under)) kept.push(...tri);
  }
  g.setIndex(kept);
  g.computeVertexNormals();
  const m = new THREE.MeshStandardNodeMaterial({ roughness: 0.95 });
  const p = positionWorld.xz;
  const turn = 0.35;
  const q = vec2(p.x.mul(Math.cos(turn)).sub(p.y.mul(Math.sin(turn))), p.x.mul(Math.sin(turn)).add(p.y.mul(Math.cos(turn))));
  const cell = vec2(24, 80);
  const id = floor(q.div(cell));
  const f = fract(q.div(cell));
  // hash() takes the integer part as unsigned: keep it positive
  const h = hash(id.x.add(500).mul(13.7).add(id.y.add(500).mul(71.3)));
  const h2 = hash(id.x.add(700).mul(5.1).add(id.y.add(300).mul(29.9)));
  // English fields late in summer: pasture and meadow (about two in five), pale wheat, stubble, and
  // a ploughed strip now and then. Greens and straw kept cool and grey: the low sun adds the orange
  const pasture = mix(color(0x4c7a3c), color(0x5e8a46), h2);
  const wheat = color(0xa8a068);
  const stubble = color(0xa09a78);
  const plough = color(0x6e5e4c);
  const isPasture = float(1).sub(step(0.42, h));
  const isPlough = step(0.94, h);
  let field = mix(mix(mix(pasture, wheat, step(0.42, h)), stubble, step(0.74, h)), plough, isPlough);
  // Each field its own shade, mottled slowly within it
  field = field.mul(h2.sub(0.5).mul(0.22).add(1));
  const mottle = mx_noise_float(p.mul(0.012)).mul(0.12).add(mx_noise_float(p.mul(0.05)).mul(0.08)).add(mx_noise_float(p.mul(0.4)).mul(0.04));
  // Furrows and drill rows along each strip: deep in the plough, faint in the pasture
  const rows = sin(q.x.mul(7.0)).mul(mix(mix(float(0.07), float(0.02), isPasture), float(0.14), isPlough));
  // The soil and stubble's grain, from the dirt map
  const grain = dirtColor(dirtMap, p.mul(0.8)).dot(vec3(0.3, 0.55, 0.15)).mul(2.2).sub(1).mul(0.25).add(1);
  // Hedgerows: narrow, ragged, a little darker than the pasture
  const edge = min(min(f.x, float(1).sub(f.x)).mul(cell.x), min(f.y, float(1).sub(f.y)).mul(cell.y));
  const hedge = float(1).sub(smoothstep(0.3, 0.9, edge.add(mx_noise_float(p.mul(0.35)).mul(0.5))));
  let c = mix(field.mul(rows.add(mottle).add(1)).mul(grain), color(0x4c5c2e).mul(mottle.add(1)), hedge.mul(0.85));
  // Grass round the town, and trodden dirt in a ragged apron round the cobbles
  const r = p.sub(vec2(CENTRE[0], CENTRE[1])).length();
  c = mix(c, color(0x587e40).mul(mottle.add(1)).mul(grain), float(1).sub(smoothstep(60, 85, r)));
  const out = max(max(float(x0).sub(p.x), p.x.sub(x1)), max(float(z0).sub(p.y), p.y.sub(z1)));
  c = mix(c, dirtColor(dirtMap, p), float(1).sub(smoothstep(0, 7, out.add(mx_noise_float(p.mul(0.2)).mul(3)))).mul(0.95));
  // Woodland floor on the wooded hill
  const wood = p.sub(vec2(HILLS[0].x, HILLS[0].z)).length();
  c = mix(c, color(0x3e4c26).mul(mottle.add(1)), float(1).sub(smoothstep(HILLS[0].r * 0.7, HILLS[0].r * 0.95, wood)));
  // Steeper ground a little browner
  c = mix(c, c.mul(vec3(1.05, 0.92, 0.82)), float(1).sub(smoothstep(0.85, 0.97, normalWorld.y)));
  m.colorNode = c;
  const mesh = new THREE.Mesh(g, m);
  mesh.receiveShadow = true;
  scene.add(mesh);
}

/** Dirt roads: out of the gate to the north, out of the gap in the low wall to the south-west. */
function roads(scene: THREE.Scene): void {
  const dirt = textured('rocky_trail_02', { base });
  // Greyed as the apron is: as it came, the low sun turned the roads rust red
  dirt.colorNode = dirtColor(dirt.map!, uv().mul(2));
  const paths: Array<Array<[number, number]>> = [
    Array.from({ length: 70 }, (_, i) => [8 * Math.sin(i / 9) * Math.min(1, i / 8), -19 - i * 5]),
    Array.from({ length: 70 }, (_, i) => [-4.5 - i * 2.2 - 6 * Math.sin(i / 11), 18 + i * 4.6]),
    // The lane between the south-east rows, seen from its mouth by the hall
    Array.from({ length: 14 }, (_, i) => [10 + i * 2.2, 32.4]),
  ];
  for (const path of paths) {
    const width = 4.2;
    const verts: number[] = [];
    const uvs: number[] = [];
    const index: number[] = [];
    let along = 0;
    path.forEach(([x, z], i) => {
      const [nx, nz] = path[Math.min(i + 1, path.length - 1)];
      const [px, pz] = path[Math.max(i - 1, 0)];
      const [dx, dz] = [nx - px, nz - pz];
      const l = Math.hypot(dx, dz) || 1;
      const [sx, sz] = [-dz / l, dx / l];
      along += Math.hypot(x - px, z - pz);
      for (const side of [-1, 1]) {
        const vx = x + (sx * side * width) / 2;
        const vz = z + (sz * side * width) / 2;
        verts.push(vx, Math.max(height(vx, vz), 0) + 0.04, vz);
        uvs.push((side * width) / 4, along / 2);
      }
      if (i > 0) {
        const o = (i - 1) * 2;
        index.push(o, o + 1, o + 2, o + 1, o + 3, o + 2);
      }
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    g.setIndex(index);
    g.computeVertexNormals();
    const mesh = new THREE.Mesh(g, dirt);
    mesh.receiveShadow = true;
    scene.add(mesh);
  }
}

/**
 * A crown of leaves: a sphere made lumpy, darker underneath and inside (its vertex colours are the
 * shade the leaves cast on each other), smooth-shaded.
 */
function crownGeometry(detail: number): THREE.BufferGeometry {
  const g = new THREE.IcosahedronGeometry(1, detail);
  const pos = g.attributes.position as THREE.BufferAttribute;
  const shade: number[] = [];
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).normalize();
    const lump = 1 + 0.16 * Math.sin(3.1 * v.x + 1.3) * Math.sin(2.7 * v.y + 0.4) * Math.sin(3.3 * v.z + 2.1) + 0.07 * Math.sin(7.3 * v.x + 5.1 * v.z);
    pos.setXYZ(i, v.x * lump, v.y * lump, v.z * lump);
    const k = 0.42 + 0.58 * Math.min(1, Math.max(0, (v.y + 0.8) / 1.6)) * (0.8 + 0.2 * lump);
    shade.push(k, k, k);
  }
  // Each face has its own vertices (as the icosahedron comes): welded by position, normals averaged
  g.setAttribute('color', new THREE.Float32BufferAttribute(shade, 3));
  g.deleteAttribute('uv');
  g.deleteAttribute('normal');
  const merged = mergeVertices(g, 1e-4);
  merged.computeVertexNormals();
  return merged;
}

/**
 * Trees: trunks and clusters of lumpy crowns in two or three shades, instanced; most on the wooded
 * hill, the rest along hedgerows, a yew and a lime in town, and a hedge with a few big trees on the
 * south-west horizon, dark against the low sun.
 */
export function trees(scene: THREE.Scene, seed = 5): void {
  let s = seed;
  const rand = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  type Spot = { x: number; z: number; size: number; shade: number; far: boolean; wood?: boolean };
  const spots: Spot[] = [];
  // The wood: trees in clumps whose crowns close into one dark canopy, thinning toward its edge,
  // in the darker greens only
  const hill = HILLS[0];
  for (let k = 0; k < 90; k++) {
    const a = rand() * Math.PI * 2;
    const r = Math.sqrt(rand()) * hill.r * 0.8;
    const [cx, cz] = [hill.x + Math.cos(a) * r, hill.z + Math.sin(a) * r];
    const spread = 9 + rand() * 9;
    const n = 8 + Math.floor(rand() * 9);
    for (let i = 0; i < n; i++) {
      const b = rand() * Math.PI * 2;
      const e = spread * Math.sqrt(-2 * Math.log(1 - rand() * 0.95)) * 0.6;
      spots.push({ x: cx + Math.cos(b) * e, z: cz + Math.sin(b) * e, size: 1.0 + rand() * 0.8, shade: rand(), far: true, wood: true });
    }
  }
  // Along the hedgerows: the strips' long edges, out in the country
  const turn = 0.35;
  for (let i = 0; i < 70; ) {
    const u = (Math.floor(rand() * 24) - 12) * 24;
    const v = (rand() - 0.5) * 640;
    const x = u * Math.cos(turn) + v * Math.sin(turn);
    const z = -u * Math.sin(turn) + v * Math.cos(turn);
    const r = Math.hypot(x - CENTRE[0], z - CENTRE[1]);
    // Not in town, and not in the sun's way to the south-west
    if (r < 90 || (x < -20 && z > 30 && r < 160)) continue;
    spots.push({ x, z, size: 0.7 + rand() * 0.6, shade: rand(), far: r > 200 });
    i++;
  }
  spots.push({ x: 35.5, z: 9.5, size: 0.75, shade: -1, far: false });
  spots.push({ x: 8, z: -26, size: 1.05, shade: 0.3, far: false });
  // The south-west skyline: big trees along a hedge across the way to the sun, about 110 m out
  const sun = [-0.5, 0.866];
  const across = [0.866, 0.5];
  const line = (d: number, t: number) => ({ x: CENTRE[0] + sun[0] * d + across[0] * t, z: CENTRE[1] + sun[1] * d + across[1] * t });
  for (const [t, d, size] of [
    [-38, 112, 1.5],
    [-17, 106, 1.25],
    [4, 114, 1.6],
    [29, 108, 1.35],
    [46, 118, 1.1],
  ])
    spots.push({ ...line(d, t), size, shade: 0.15, far: false });
  const near = spots.filter((t) => !t.far);
  const far = spots.filter((t) => t.far);
  const trunkG = new THREE.CylinderGeometry(0.18, 0.28, 1, 6);
  trunkG.translate(0, 0.5, 0);
  const bark = new THREE.MeshStandardNodeMaterial({ color: 0x4a3c30, roughness: 0.95 });
  const leaves = new THREE.MeshStandardNodeMaterial({ roughness: 0.85, vertexColors: true });
  const trunks = new THREE.InstancedMesh(trunkG, bark, spots.length);
  const greens = [0x2f4a22, 0x3f5a2a, 0x4d6430, 0x5b6b33, 0x3a5228, 0x8a7a3a];
  // The wood's: dark and cool (the low sun yellows them), its crowns broad enough to close up
  const woodGreens = [0x1e3e24, 0x224426, 0x28482a, 0x2c4c2e];
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const c = new THREE.Color();
  // Five crowns a tree: one high in the middle, four round and below it
  const CROWNS: Array<[number, number, number, number]> = [
    [0, 0.82, 0, 0.62],
    [0.55, 0.6, 0.15, 0.55],
    [-0.45, 0.58, 0.4, 0.52],
    [-0.2, 0.62, -0.55, 0.55],
    [0.3, 0.45, -0.3, 0.5],
  ];
  const crowns = (list: Spot[], detail: number, hedge: number) => {
    const mesh = new THREE.InstancedMesh(crownGeometry(detail), leaves, list.length * CROWNS.length + hedge);
    let k = 0;
    list.forEach((t, i) => {
      const y = height(t.x, t.z);
      const h = 5 * t.size;
      const yew = t.shade < 0;
      const base = yew ? 0x2c3e22 : t.wood ? woodGreens[Math.floor(t.shade * 3.99)] : greens[t.shade > 0.93 ? 5 : Math.floor(t.shade * 4.99)];
      CROWNS.forEach(([ox, oy, oz, r0], j) => {
        if (yew && j > 2) return;
        const r = (yew ? 1.6 - j * 0.45 : r0 * (t.wood ? 5.4 : 4.2)) * t.size;
        const spin = i * 1.3;
        const [cx, cz] = yew ? [0, 0] : [(ox * Math.cos(spin) - oz * Math.sin(spin)) * 2.2 * t.size, (ox * Math.sin(spin) + oz * Math.cos(spin)) * 2.2 * t.size];
        q.setFromEuler(new THREE.Euler(0, spin + j, 0));
        // The wood's crowns sit low enough to hide its trunks
        const up = yew ? h * (0.35 + j * 0.42) : h * ((t.wood ? 0.22 : 0.35) + oy * 0.75);
        m.compose(new THREE.Vector3(t.x + cx, y + up, t.z + cz), q, new THREE.Vector3(r, r * (yew ? 1.0 : 0.78), r));
        mesh.setMatrixAt(k, m);
        // Lit crowns on top a little lighter, the lower ones and one in three a shade darker
        c.set(base).multiplyScalar((j === 0 ? 1.12 : 0.9) * (0.85 + ((i * 13 + j * 7) % 10) * 0.03) * ((i + j) % 3 === 0 ? 0.85 : 1));
        mesh.setColorAt(k, c);
        k++;
      });
    });
    return { mesh, k };
  };
  spots.forEach((t, i) => {
    const h = 5 * t.size;
    m.compose(new THREE.Vector3(t.x, height(t.x, t.z) - 0.2, t.z), q.identity(), new THREE.Vector3(t.size * 1.2, h * 0.55, t.size * 1.2));
    trunks.setMatrixAt(i, m);
  });
  // The south-west hedge: crowns squashed into a low dark line between the big trees
  const hedgeAt = Array.from({ length: 30 }, (_, i) => line(110 + Math.sin(i * 1.7) * 3, -52 + i * 3.6));
  const nearCrowns = crowns(near, 2, hedgeAt.length);
  hedgeAt.forEach((p, i) => {
    q.setFromEuler(new THREE.Euler(0, Math.atan2(across[0], across[1]), 0));
    m.compose(new THREE.Vector3(p.x, height(p.x, p.z) + 0.6, p.z), q, new THREE.Vector3(1.4, 1.5 + (i % 3) * 0.3, 2.4));
    nearCrowns.mesh.setMatrixAt(nearCrowns.k, m);
    nearCrowns.mesh.setColorAt(nearCrowns.k++, c.set(0x34482a).multiplyScalar(0.9 + (i % 4) * 0.05));
  });
  const farCrowns = crowns(far, 1, 0);
  // The yew has fewer crowns than were made room for
  nearCrowns.mesh.count = nearCrowns.k;
  farCrowns.mesh.count = farCrowns.k;
  for (const mesh of [trunks, nearCrowns.mesh, farCrowns.mesh]) {
    // The wood is far past the shadows' range
    mesh.castShadow = mesh !== farCrowns.mesh;
    mesh.receiveShadow = true;
    scene.add(mesh);
  }
}

/** The post mill on the windmill hill: body, roof, post and trestle, and the sails (turned in update). */
export function windmill(scene: THREE.Scene): THREE.Object3D {
  const y = height(MILL.x, MILL.z);
  const mill = new THREE.Group();
  mill.position.set(MILL.x, y, MILL.z);
  // Facing the town
  mill.rotation.y = Math.atan2(5 - MILL.x, 0 - MILL.z);
  const wood = new THREE.MeshStandardNodeMaterial({ color: 0x7a6450, roughness: 0.9 });
  const dark = new THREE.MeshStandardNodeMaterial({ color: 0x4a3c30, roughness: 0.9 });
  const add = (g: THREE.BufferGeometry, mat: THREE.Material, x: number, yy: number, z: number) => {
    const m = new THREE.Mesh(g, mat);
    m.position.set(x, yy, z);
    m.castShadow = true;
    mill.add(m);
    return m;
  };
  add(new THREE.CylinderGeometry(0.35, 0.5, 4.5, 8), dark, 0, 2.25, 0);
  for (const a of [0, Math.PI / 2]) {
    const leg = add(new THREE.BoxGeometry(5, 0.3, 0.3), dark, 0, 0.5, 0);
    leg.rotation.y = a;
  }
  add(new THREE.BoxGeometry(3.6, 5, 4.6), wood, 0, 6.7, 0);
  const roof = add(new THREE.CylinderGeometry(0.01, 2.7, 1.6, 4, 1), dark, 0, 10.0, 0);
  roof.rotation.y = Math.PI / 4;
  roof.scale.set(1, 1, 1.25);
  const sails = new THREE.Group();
  sails.position.set(0, 7.8, 2.6);
  for (let i = 0; i < 4; i++) {
    const arm = new THREE.Group();
    arm.rotation.z = (i * Math.PI) / 2;
    const stock = new THREE.Mesh(new THREE.BoxGeometry(0.25, 10.5, 0.2), dark);
    stock.position.y = 5.25;
    const cloth = new THREE.Mesh(new THREE.BoxGeometry(1.8, 8, 0.06), new THREE.MeshStandardNodeMaterial({ color: 0xd8ccb0, roughness: 0.9 }));
    cloth.position.set(1.0, 6.2, 0.05);
    for (const m of [stock, cloth]) {
      m.castShadow = true;
      arm.add(m);
    }
    sails.add(arm);
  }
  mill.add(sails);
  scene.add(mill);
  return sails;
}

/**
 * The rest of the town: the wall carrying on east and round behind the church, west and south
 * behind the west row with two more round towers; houses (plastered and timbered, under tile)
 * between. In the world too, near the breakable part.
 */
export function town(scene: THREE.Scene, world: World): void {
  const walls: THREE.BufferGeometry[] = [];
  const roofs: THREE.BufferGeometry[] = [];
  const houses: THREE.BufferGeometry[] = [];
  const westHouses: THREE.BufferGeometry[] = [];
  const box = (x0: number, z0: number, x1: number, z1: number, y0: number, y1: number, into: THREE.BufferGeometry[], body = false) => {
    const g = new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0);
    worldUV(g, [x1 - x0, y1 - y0, z1 - z0]);
    g.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
    into.push(g);
    if (body) world.addBox({ size: [x1 - x0, y1 - y0, z1 - z0], position: [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2], fixed: true, friction: 0.8 });
  };
  // Walls: north from the breakable end, east side, west side; crenellated
  const wall = (x0: number, z0: number, x1: number, z1: number) => {
    box(x0, z0, x1, z1, -0.5, 7.5, walls, true);
    const alongX = x1 - x0 > z1 - z0;
    const len = alongX ? x1 - x0 : z1 - z0;
    for (let t = 0.4; t + 1 < len; t += 1.8) {
      if (alongX) box(x0 + t, z0, x0 + t + 1, z0 + 0.6, 7.5, 9.6, walls);
      else box(x1 - 0.6, z0 + t, x1, z0 + t + 1, 7.5, 9.6, walls);
    }
  };
  wall(26.02, -18, 50, -16);
  wall(48, -16, 50, 42);
  wall(-44, -18, -32.1, -16);
  wall(-44, -16, -42, 32);
  // Both runs end on a tower, and a robbed-out stub of the south wall steps down from each: the
  // open south reads as a wall long gone, not one left unfinished
  const towers: Array<[number, number]> = [
    [49, -17],
    [49, 18],
    [49, 42],
    [-43, -17],
    [-43, 10],
    [-43, 32],
  ];
  for (const [x, dir] of [
    [-43, 1],
    [49, -1],
  ]) {
    const z = x < 0 ? 31 : 41;
    [5.5, 4.2, 3.0, 1.6, 0.8].forEach((top, i) => {
      const a = x + dir * (3.4 + i * 1.9);
      const b = a + dir * (1.9 - (i === 4 ? 0.6 : 0));
      box(Math.min(a, b), z - 1, Math.max(a, b), z + 1, -0.5, top + Math.sin(i * 2.3) * 0.3, walls, i < 3);
    });
  }
  const towerMeshes: THREE.BufferGeometry[] = [];
  const cones: THREE.BufferGeometry[] = [];
  // Squatter than the breakable round tower, so it doesn't pass for it seen past it
  for (const [x, z] of towers) {
    const t = new THREE.CylinderGeometry(3.4, 3.6, 9.5, 16);
    worldUV(t, [21, 9.5, 21]);
    t.translate(x, 4.75, z);
    towerMeshes.push(t);
    const c = new THREE.ConeGeometry(3.9, 4.5, 16);
    c.translate(x, 9.5 + 2.25, z);
    cones.push(c);
    // In the world as drawn: the 16 sides (a square box stood 1.35 m out on the diagonals)
    const points: number[] = [];
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      points.push(x + 3.6 * Math.sin(a), -0.5, z + 3.6 * Math.cos(a), x + 3.4 * Math.sin(a), 9.5, z + 3.4 * Math.cos(a));
    }
    world.addHull({ points, fixed: true, friction: 0.8 });
  }
  // Houses: a body and a gable roof each, east behind the church and north-east, west behind the west row
  let s = 9;
  const rand = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  // A house of two storeys or more has its upper storeys jettied out over the ground floor; the
  // eaves stand half a metre out. In the world too, roof and all: debris from the church fell
  // through the houses beside it and lay inside them
  footprints.length = 0;
  const place = (x0: number, z0: number, w: number, d: number, h: number, ridgeAlongX: boolean, west: boolean) => {
    const into = west ? westHouses : houses;
    footprints.push([x0, z0, x0 + w, z0 + d]);
    if (h > 5.2) {
      box(x0 + JETTY, z0 + JETTY, x0 + w - JETTY, z0 + d - JETTY, -0.2, STOREY, into, true);
      box(x0, z0, x0 + w, z0 + d, STOREY, h, into, true);
    } else box(x0, z0, x0 + w, z0 + d, -0.2, h, into, true);
    const roof = gableRoof(x0 - 0.5, z0 - 0.5, x0 + w + 0.5, z0 + d + 0.5, h, ridgeAlongX);
    roofs.push(roof);
    world.addHull({ points: [...(roof.attributes.position.array as Float32Array)], fixed: true, friction: 0.6 });
  };
  // East: rows along x = 38..47 between the churchyard and the east wall
  for (let z = -14; z < 38; ) {
    const d = 6 + rand() * 3;
    if (z > 12 || z < -8) place(38.5 + rand() * 0.6, z, 8.5 - rand(), d, 6 + rand() * 4, false, false);
    else place(40.5 + rand() * 0.6, z, 6.5, d, 6 + rand() * 4, false, false);
    z += d + 0.4 + rand() * 1.5;
  }
  // North-east, between E1, the church and the wall
  place(23.5, -15.2, 6, 7, 8.5, true, false);
  place(30, -15.2, 7.5, 6.5, 7.5, true, false);
  // Behind the nave and churchyard to the south
  for (let x = 15; x < 37; ) {
    const w = 6 + rand() * 2.5;
    place(x, 15 + rand(), w, 7, 5.5 + rand() * 3, true, false);
    x += w + 0.5 + rand();
  }
  // West: behind the west row, between it and the west wall, low toward the south
  for (let z = -15; z < 26; ) {
    const d = 6 + rand() * 2.5;
    const low = z > 12;
    place(-40.5 + rand() * 0.5, z, 7, d, low ? 4.5 : 6.5 + rand() * 3, false, true);
    // The inner row keeps clear of the round tower, and lower toward the south
    if (z > -11 && z < 17) place(-32.5, z + 0.5, 7.5, d - 1, z > 9 ? 5 : 6 + rand() * 3, false, true);
    z += d + 0.5 + rand() * 1.2;
  }
  // South-east, past the stable and the hall: two rows along a street, out of the way to the sun
  for (const [z0, depth] of [
    [25, 5],
    [33.5, 6],
  ])
    for (let x = 13; x < 36; ) {
      const w = Math.min(5.5 + rand() * 2.5, 37.5 - x);
      if (w < 4) break;
      place(x, z0, w, depth + rand() * 1.5, 6 + rand() * 3, true, false);
      x += w + 0.4 + rand() * 1.2;
    }
  const rubble = townWallMaterial();
  const mesh = (gs: THREE.BufferGeometry[], m: THREE.Material, name: string, castShadow = true) => {
    if (!gs.length) return;
    const g = mergeGeometries(gs.map((x) => (x.index ? x.toNonIndexed() : x)));
    const o = new THREE.Mesh(g, m);
    o.name = `scenery:${name}`;
    o.castShadow = castShadow;
    o.receiveShadow = true;
    scene.add(o);
  };
  mesh(walls, rubble, 'walls');
  mesh(towerMeshes, rubble, 'towers');
  mesh(cones, roofMaterial(true), 'cones');
  mesh(houses, houseMaterial(), 'houses');
  // West of the square: lit by a sun behind them, they'd throw their shadows over it
  mesh(westHouses, houseMaterial(), 'west houses', false);
  // Both sides: the eaves' undersides show from the street
  mesh(roofs, roofMaterial(false, true), 'roofs');
}

/** UVs in metres (per face, by the box's size), so maps keep their scale on any box. */
function worldUV(g: THREE.BufferGeometry, [w, h, d]: [number, number, number]): void {
  const uv = g.attributes.uv as THREE.BufferAttribute;
  const n = g.attributes.normal as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) {
    const [nx, ny] = [Math.abs(n.getX(i)), Math.abs(n.getY(i))];
    const [su, sv] = nx > 0.5 ? [d, h] : ny > 0.5 ? [w, d] : [w, h];
    uv.setXY(i, uv.getX(i) * su, uv.getY(i) * sv);
  }
}

/** A gable roof over (x0, z0)–(x1, z1) from its eaves at height y, pitched about 50°. */
function gableRoof(x0: number, z0: number, x1: number, z1: number, y: number, ridgeAlongX: boolean): THREE.BufferGeometry {
  const half = ridgeAlongX ? (z1 - z0) / 2 : (x1 - x0) / 2;
  const rise = half * 1.2;
  const g = new THREE.BufferGeometry();
  const v: number[] = [];
  const uv: number[] = [];
  const slope = Math.hypot(half, rise);
  const quad = (a: number[], b: number[], c: number[], d: number[], w: number) => {
    v.push(...a, ...b, ...c, ...a, ...c, ...d);
    uv.push(0, 0, w, 0, w, slope, 0, 0, w, slope, 0, slope);
  };
  const tri = (a: number[], b: number[], c: number[]) => {
    v.push(...a, ...b, ...c);
    uv.push(0, 0, 1, 0, 0.5, 1);
  };
  if (ridgeAlongX) {
    const zm = (z0 + z1) / 2;
    quad([x0, y, z1], [x1, y, z1], [x1, y + rise, zm], [x0, y + rise, zm], x1 - x0);
    quad([x1, y, z0], [x0, y, z0], [x0, y + rise, zm], [x1, y + rise, zm], x1 - x0);
    tri([x0, y, z0], [x0, y, z1], [x0, y + rise, zm]);
    tri([x1, y, z1], [x1, y, z0], [x1, y + rise, zm]);
  } else {
    const xm = (x0 + x1) / 2;
    quad([x0, y, z0], [x0, y, z1], [xm, y + rise, z1], [xm, y + rise, z0], z1 - z0);
    quad([x1, y, z1], [x1, y, z0], [xm, y + rise, z0], [xm, y + rise, z1], z1 - z0);
    tri([x0, y, z1], [x1, y, z1], [xm, y + rise, z1]);
    tri([x1, y, z0], [x0, y, z0], [xm, y + rise, z0]);
  }
  g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.computeVertexNormals();
  return g;
}

function townWallMaterial(): THREE.MeshStandardNodeMaterial {
  const m = textured('castle_wall_slates', { base, color: 0xe8e0d4 });
  for (const k of ['map', 'normalMap', 'roughnessMap'] as const) {
    const t = m[k]!.clone();
    t.repeat.set(0.4, 0.4);
    m[k] = t;
  }
  return m;
}

/** Roofs: the clay tile map in metres; some redder, some mossy, by a hash of where they are. */
function roofMaterial(cones: boolean, twoSided = false): THREE.MeshStandardNodeMaterial {
  const m = textured('roof_09', { base });
  if (twoSided) m.side = THREE.DoubleSide;
  const map = m.map!;
  const id = hash(floor(positionWorld.x.div(5)).add(200).mul(3.1).add(floor(positionWorld.z.div(5)).add(200).mul(17.3)));
  const tint = mix(mix(color(0xffffff), color(0xd8a890), smoothstep(0.3, 0.6, id)), color(0xb8b090), smoothstep(0.75, 0.95, id));
  // Rows along the slope's level lines, v up the slope (the faces' uvs are in metres; the map is 4 m)
  const uvNode = cones ? vec2(abs(positionWorld.x.add(positionWorld.z)), positionWorld.y) : uv();
  m.colorNode = texture(map, uvNode.div(4)).rgb.mul(tint);
  m.normalMap = null;
  return m;
}

/**
 * Houses: lime plaster in washes, oak framing drawn on (storey bands, posts, braces now and
 * then), some all stone; chosen by a hash of where each house stands.
 */
function houseMaterial(): THREE.MeshStandardNodeMaterial {
  const m = textured('medieval_limewash', { base });
  const map = m.map!;
  const side = abs(normalWorld.x).greaterThan(0.5);
  const along = select(side, positionWorld.z, positionWorld.x);
  const y = positionWorld.y;
  // Each house's cell, taken 5 cm inside the face: a face on a cell edge (the south-east rows start at
  // x 13) flickered between two cells pixel by pixel, which turned its windows to striped noise
  const inner = positionWorld.sub(normalWorld.mul(0.05));
  const house = hash(floor(inner.x.div(6.5)).add(100).mul(5.3).add(floor(inner.z.div(6.5)).add(100).mul(11.9)));
  // Washes by the hash, blended by steps (select on colours misbehaved here)
  const wash = mix(mix(mix(color(0xf3ead8), color(0xe8cf98), step(0.3, house)), color(0xe9c9b8), step(0.55, house)), color(0xd9dccb), step(0.75, house));
  // Frame: plates every storey, posts every 1.1 m, a brace in some bays. Each line's width on screen
  // from the change of its own coordinate across a pixel (taken before it's wrapped)
  const storey = fract(y.div(STOREY));
  const bay = fract(along.div(1.1));
  const dy = fwidth(y.div(STOREY));
  const du = fwidth(along.div(1.1));
  const plate = step2(storey, 0.07, dy).max(step2(float(1).sub(storey), 0.04, dy));
  const post = step2(min(bay, float(1).sub(bay)), 0.075, du);
  const diag = abs(bay.sub(storey));
  const brace = step2(diag, 0.06, du.add(dy)).mul(step(0.6, hash(floor(along.div(1.1)).add(200).add(floor(y.div(STOREY)).mul(7.7)))));
  const timber = max(max(plate, post), brace).mul(step(0.6, y));
  const plaster = texture(map, vec2(along.div(2), y.div(2))).rgb.mul(wash);
  const oak = color(0x5a4636).mul(mx_noise_float(vec2(along.mul(3), y.mul(0.5))).mul(0.15).add(1));
  // Windows: dark openings in most bays of 2.2 m on the upper storeys, a door now and then below
  const level = floor(y.div(STOREY));
  const wide = fract(along.div(2.2));
  const which = hash(floor(along.div(2.2)).add(300).mul(3.7).add(level.add(20).mul(11.3)).add(house.mul(57)));
  const upper = step(0.5, level);
  const pane = step(0.3, wide).mul(step(wide, 0.68)).mul(step(0.32, storey)).mul(step(storey, 0.74)).mul(step(0.3, which)).mul(upper);
  const door = step(0.4, wide).mul(step(wide, 0.62)).mul(step(storey, 0.76)).mul(step(0.8, which)).mul(float(1).sub(upper));
  const opening = max(pane, door).mul(step(0.5, abs(normalWorld.y).oneMinus()));
  const dark = color(0x2a2119).mul(mix(float(0.75), float(1.2), which));
  // Some all stone
  const wall = mix(mix(plaster, oak, timber), plaster.mul(color(0xd8c8a8)), step(0.88, house));
  m.colorNode = mix(wall, dark, opening);
  m.normalMap = null;
  return m;
}

/**
 * 1 where x < w: a line w wide, `px` the change of x across a pixel. Its edge is a pixel soft, and
 * a line thinner than a pixel fades to its share of one: seen at a glance, the drawn timbers
 * shimmered and flickered pixel by pixel.
 */
function step2(x: THREE.Node<'float'>, w: number, px: THREE.Node<'float'>): THREE.Node<'float'> {
  const p = max(px, 1e-5);
  return float(1).sub(smoothstep(float(w).sub(p.mul(0.5)), float(w).add(p.mul(0.5)), x)).mul(min(float(1), float(w).div(p)));
}

