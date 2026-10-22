// Round the yard: its wet concrete deck round the apron (ground.ts), the crane's rail beams, the quay
// wall and the dark water beyond, and far off in the fog a container ship, the cranes of the far
// quay, a breakwater with its lighthouse, buoys, and more of the port behind the yard. All of it
// but the water stands as scenery until something reaches it (../../dormant.ts,
// ../../dormant-ground.ts): the deck in tiles a blast lays breakable as the apron is, the quay's
// face, each box of the stacks (made as the yard's boxes are when woken), the ship's hull in
// lengths, its house, each crane, gantry, mast and shed, the breakwater, the lighthouse and the
// buoys, each made of what it's made of once a round or a blast reaches it.

import { abs, color, cos, float, fract, fwidth, luminance, materialColor, materialRoughness, mix, mx_noise_float, mx_noise_vec3, normalize, normalWorld, positionWorld, select, sin, smoothstep, step, texture as sample, time, transformNormalToView, vec2, vec3, vec4 } from 'three/tsl';
import * as THREE from 'three/webgpu';
import { ConvexGeometry } from 'three/examples/jsm/geometries/ConvexGeometry.js';
import type { World } from 'three-avbd';
import { type Destruction, random, type V3 } from '../../../lib/index.ts';
import { boundsOf, boxPieces, DormantUnits, solidBox, union } from '../../dormant.ts';
import { DormantGround } from '../../dormant-ground.ts';
import { container, FT40 } from './containers.ts';
import { cylinder, frustum } from '../../../lib/index.ts';
import { repeat, texture, textured } from '../../textures.ts';
import { APRON, BEAMS, QUAY } from './ground.ts';
import { CRANE } from './crane.ts';
import { base, greyConcrete } from './materials.ts';
import { pavement } from './paving.ts';

/** What moves in the scenery: the buoys bob, the lighthouse blinks. */
export interface Scenery {
  buoys: Array<{ mesh: THREE.Object3D; phase: number; y: number }>;
  lighthouse: THREE.MeshStandardNodeMaterial;
}

const box = new THREE.BoxGeometry(1, 1, 1);

/** Boxes (centre, size, colour) as one instanced mesh. */
function boxes(list: Array<{ p: [number, number, number]; s: [number, number, number]; c: number; r?: number }>, material: THREE.Material, shadows = false): THREE.InstancedMesh {
  const mesh = new THREE.InstancedMesh(box, material, list.length);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const col = new THREE.Color();
  list.forEach((b, i) => {
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), b.r ?? 0);
    m.compose(new THREE.Vector3(...b.p), q, new THREE.Vector3(...b.s));
    mesh.setMatrixAt(i, m);
    mesh.setColorAt(i, col.setHex(b.c));
  });
  mesh.castShadow = shadows;
  mesh.receiveShadow = shadows;
  return mesh;
}

/** What stands as scenery until something reaches it (made dormant in build: dormantScenery). */
const units = new DormantUnits();
let decks: DormantGround[] = [];

export function scenery(scene: THREE.Scene, world: World): Scenery {
  units.units.length = 0;
  decks = [deck(scene, world)];
  quayWall(scene, world);
  water(scene);
  ship(scene, world);
  decks.push(farQuay(scene, world));
  farYard(scene, world);
  return { buoys: buoys(scene, world), lighthouse: breakwater(scene, world) };
}

/** The scenery as dormant things, once the Destruction is made. */
export function dormantScenery(d: Destruction): void {
  units.dormant(d);
  for (const g of decks) g.dormant(d);
}

/** The bed where a blast has laid the deck breakable (the world's groundAt there), else null. */
export const deckBed = (x: number, z: number): number | null => {
  for (const g of decks) {
    const b = g.bedAt(x, z);
    if (b !== null) return b;
  }
  return null;
};

/**
 * The crane's rail beams, as pieces on the apron's bed: concrete flush with the deck, darker, and on
 * each a steel rail standing 7 cm (but under the crane's bogies, which stand on the beam).
 */
export function railBeams(d: Destruction): void {
  for (const z of BEAMS.rails) {
    boxPieces(d, { at: [(BEAMS.x0 + BEAMS.x1) / 2, APRON.bed / 2, z], size: [BEAMS.x1 - BEAMS.x0, -APRON.bed, 2 * BEAMS.half], material: 'concrete', tint: 0x5e605e, most: 2.2 });
    const legs = [CRANE.x - 6, CRANE.x + 6];
    const clear = (x: number) => legs.every((lx) => Math.abs(x - lx) > 1.75);
    for (let x = -35; x < 6 - 1e-6; x += 2.05) if (clear(x + 1.025)) d.addBox({ material: 'steel', size: [2.05, 0.07, 0.12], position: [x + 1.025, 0.035, z], tint: 0x4a4c4e });
  }
}

/**
 * The yard's deck: in the world its fixed body, at the apron's bed under the apron (and the rail
 * beams, pieces on it), round it in tiles (dormant ground: a blast lays a tile breakable as the
 * apron is) to the pavement's ends, and past them at 0 (down past the bed, so nothing slips under
 * it out of a crater at the edge), and the seabed. Drawn: the pavement round the apron (the apron's
 * slabs are pieces; where a tile has been laid breakable, its slabs), and what a crater shows past
 * the slabs.
 */
function deck(scene: THREE.Scene, world: World): DormantGround {
  const { edge, seabed } = QUAY;
  const [x0, z0, x1, z1] = APRON.bounds;
  const box = (ax: number, az: number, bx: number, bz: number, top: number, bottom = -12) => world.addBox({ size: [bx - ax, top - bottom, bz - az], position: [(ax + bx) / 2, (top + bottom) / 2, (az + bz) / 2], fixed: true, friction: 0.8 });
  box(x0, z0, x1, z1, APRON.bed);
  // Past the pavement (240 m either way, 320 m back): the deck as it was
  box(-450, edge, -240, edge + 600, 0);
  box(240, edge, 450, edge + 600, 0);
  box(-240, edge + 320, 240, edge + 600, 0);
  world.addBox({ size: [1400, 2, 900], position: [0, seabed - 1, edge - 450], fixed: true, friction: 0.9 });
  const tiles = new DormantGround(scene, world, {
    name: 'deck',
    area: [-240, edge, 240, edge + 320],
    tile: 12,
    top: 0,
    bottom: -12,
    friction: 0.8,
    // (Cut along the apron's edges, so the tiles meet it and only those on it are left out)
    cuts: { xs: [x0, x1], zs: [z0, z1] },
    skip: ([a0, b0, a1, b1]) => (a0 + a1) / 2 > x0 && (a0 + a1) / 2 < x1 && (b0 + b1) / 2 > z0 && (b0 + b1) / 2 < z1,
    layers: (area) => [{ material: 'slab', under: 'gravel', area, top: 0, depth: APRON.depth, underDepth: APRON.under, cell: APRON.cell, toss: 0.6, textureFrame: { position: [0, 0, QUAY.edge] } }],
    pit: textured('harbor_gravel', { base, color: 0xb4b2ac }),
  });

  // The pavement round the apron, to 240 m either way and 320 m back
  const m = deckMaterial();
  tiles.cut(m, positionWorld.xz);
  for (const [ax, az, bx, bz] of [
    [-240, edge, 240, z0],
    [-240, z1, 240, edge + 320],
    [-240, z0, x0, z1],
    [x1, z0, 240, z1],
  ]) {
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(bx - ax, bz - az).rotateX(-Math.PI / 2).translate((ax + bx) / 2, 0, (az + bz) / 2), m);
    plane.receiveShadow = true;
    scene.add(plane);
  }
  pit(scene);
  return tiles;
}

/** The pavement drawn, as the apron's slabs are (paving.ts). */
function deckMaterial(): THREE.MeshStandardNodeMaterial {
  const m = new THREE.MeshStandardNodeMaterial({ roughness: 1, metalness: 0 });
  const look = pavement(positionWorld.xz);
  m.colorNode = look.color as unknown as THREE.Node<'color'>;
  m.roughnessNode = look.roughness;
  m.metalnessNode = look.metalness;
  return m;
}

/**
 * What a crater shows past the slabs: the bed (crushed stone), and where the apron meets the deck
 * round it, the deck's edge (its slab over the stone).
 */
function pit(scene: THREE.Scene): void {
  const [x0, z0, x1, z1] = APRON.bounds;
  const { bed, depth } = APRON;
  const stone = () => textured('harbor_gravel', { base, color: 0xb4b2ac });
  // A face w wide from y0 to y1, its middle at (x, z), turned `turn` about the vertical (0: facing +z)
  const face = (m: THREE.MeshStandardNodeMaterial, w: number, y0: number, y1: number, x: number, z: number, turn: number, tile: number) => {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, y1 - y0), repeat(m, w / tile, (y1 - y0) / tile));
    mesh.rotation.y = turn;
    mesh.position.set(x, (y0 + y1) / 2, z);
    mesh.receiveShadow = true;
    scene.add(mesh);
  };
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, z1 - z0), repeat(stone(), x1 - x0, z1 - z0));
  floor.rotation.x = -Math.PI / 2;
  floor.position.set((x0 + x1) / 2, bed, (z0 + z1) / 2);
  floor.receiveShadow = true;
  scene.add(floor);
  // The deck's edge all round, facing in
  for (const [w, x, z, turn] of [
    [x1 - x0, (x0 + x1) / 2, z0, 0],
    [x1 - x0, (x0 + x1) / 2, z1, Math.PI],
    [z1 - z0, x0, (z0 + z1) / 2, Math.PI / 2],
    [z1 - z0, x1, (z0 + z1) / 2, -Math.PI / 2],
  ]) {
    face(greyConcrete(0xb4b8b8, 0.6), w, -depth, 0, x, z, turn, 2.5);
    face(stone(), w, bed, -depth, x, z, turn, 1);
  }
}

/**
 * The quay wall under the edge: concrete, darker where the tide wets it, with fenders and ladders.
 * Its face from 3 m under the deck up stands in lengths of 12 m, each dormant: woken, a skin of
 * blocks 0.6 m thick on a ledge, its fenders and ladders with it; under it, the rest of the wall.
 */
function quayWall(scene: THREE.Scene, world: World): void {
  const { edge, water, seabed } = QUAY;
  const W = 480;
  const H = -seabed;
  const SKIN = 3;
  const LEN = 12;
  const m = repeat(textured('concrete_wall_008', { color: 0x8e9496, normalScale: 0.8 }), W / 4, H / 4);
  // The tide line: a dark wet band, and dark below it; the map's yellow mostly taken out
  const y = positionWorld.y;
  const wet = smoothstep(water + 0.9, water + 0.3, y);
  const grey = mix(materialColor.rgb, vec3(luminance(materialColor.rgb)), 0.7);
  m.colorNode = vec4(grey.mul(mix(float(1), float(0.4), wet)), 1) as unknown as THREE.Node<'color'>;
  m.roughnessNode = mix(materialRoughness, float(0.3), wet) as unknown as THREE.Node<'float'>;
  // Under the skin: one face
  const lower = new THREE.Mesh(new THREE.PlaneGeometry(W, H - SKIN), m);
  lower.rotation.y = Math.PI;
  lower.position.set(0, -SKIN - (H - SKIN) / 2, edge);
  lower.receiveShadow = true;
  scene.add(lower);
  // The skin's lengths (its map runs on: each face drawn from the wall's own world coordinates)
  const skin = repeat(textured('concrete_wall_008', { color: 0x8e9496, normalScale: 0.8 }), LEN / 4, SKIN / 4);
  skin.colorNode = m.colorNode;
  skin.roughnessNode = m.roughnessNode;
  const n = Math.round(W / LEN);
  const faces = new THREE.InstancedMesh(new THREE.PlaneGeometry(LEN, SKIN).rotateY(Math.PI), skin, n);
  const mat = new THREE.Matrix4();
  // The ledge they stand on, out of sight under the water
  world.addBox({ size: [W, H - SKIN, 0.6], position: [0, -SKIN - (H - SKIN) / 2, edge - 0.3], fixed: true, friction: 0.8 });
  const lengths: Array<{ x0: number; extras: Array<() => void>; builds: Array<(d: Destruction) => void> }> = [];
  for (let i = 0; i < n; i++) {
    const x0 = -W / 2 + i * LEN;
    faces.setMatrixAt(i, mat.makeTranslation(x0 + LEN / 2, -SKIN / 2, edge));
    lengths.push({ x0, extras: [], builds: [] });
  }
  faces.receiveShadow = true;
  scene.add(faces);
  const lengthAt = (x: number) => lengths[Math.min(n - 1, Math.max(0, Math.floor((x + W / 2) / LEN)))];

  // Rubber fenders between the bollards: black cylinders lying along the wall
  const fender = new THREE.MeshStandardNodeMaterial({ color: 0x18191a, roughness: 0.75 });
  const cyl = new THREE.CylinderGeometry(0.4, 0.4, 2, 16);
  cyl.rotateZ(Math.PI / 2);
  const fenders = new THREE.InstancedMesh(cyl, fender, 9);
  for (let i = 0; i < 9; i++) {
    const x = -40 + i * 10;
    fenders.setMatrixAt(i, mat.makeTranslation(x, -0.95, edge - 0.42));
    const at = lengthAt(x);
    at.extras.push(() => {
      fenders.setMatrixAt(i, new THREE.Matrix4().makeScale(0, 0, 0));
      fenders.instanceMatrix.needsUpdate = true;
    });
    // (The cylinder's axis up from its base, turned to lie along x: from x + 1 back to x - 1)
    at.builds.push((d) => void d.addConvex({ material: 'cable', points: cylinder(0.4, 2, 12), position: [x + 1, -0.95, edge - 1.0], rotation: [0, 0, Math.SQRT1_2, Math.SQRT1_2], tint: 0x18191a, smooth: 0.6 }));
  }
  fenders.castShadow = fenders.receiveShadow = true;
  scene.add(fenders);

  // Steel ladders set into the wall
  const steel = new THREE.MeshStandardNodeMaterial({ color: 0x5a5650, roughness: 0.5, metalness: 0.6 });
  for (const x of [-5, 22]) {
    const parts: THREE.Mesh[] = [];
    for (const dx of [-0.22, 0.22]) {
      const r = new THREE.Mesh(new THREE.BoxGeometry(0.06, 4.2, 0.06), steel);
      r.position.set(x + dx, -1.9, edge - 0.05);
      scene.add(r);
      parts.push(r);
    }
    for (let k = 0; k < 13; k++) {
      const rung = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.035, 0.035), steel);
      rung.position.set(x, -3.8 + k * 0.3, edge - 0.08);
      scene.add(rung);
      parts.push(rung);
    }
    const at = lengthAt(x);
    at.extras.push(() => parts.forEach((p) => (p.visible = false)));
    // Woken: the stiles on the skin, the rungs between them (each bar its own piece)
    at.builds.push((d) => {
      for (const dx of [-0.22, 0.22]) d.addBox({ material: 'iron', size: [0.06, 2.95, 0.06], position: [x + dx, -1.5, edge - 0.63], tint: 0x5a5650 });
      for (let k = 4; k < 13; k++) d.addBox({ material: 'iron', size: [0.38, 0.035, 0.035], position: [x, -3.8 + k * 0.3, edge - 0.6175], tint: 0x5a5650 });
    });
  }

  lengths.forEach(({ x0, extras, builds }, i) =>
    units.add({
      name: 'quay',
      bounds: { min: [x0, -SKIN, edge - 0.6], max: [x0 + LEN, 0, edge] },
      instances: [[faces, i]],
      hide: () => extras.forEach((e) => e()),
      build: (d) => {
        // Blocks 2 m long, 1 m high, the lowest row wet and dark
        for (let x = x0; x < x0 + LEN - 1e-6; x += 2)
          for (let yb = -SKIN; yb < -1e-6; yb += 1) d.addBox({ material: 'concrete', size: [2, 1, 0.6], position: [x + 1, yb + 0.5, edge - 0.3], tint: yb < water + 0.4 ? 0x5a5e60 : 0x9a9ea0 });
        for (const b of builds) b(d);
      },
    }),
  );
}

/** Dark harbour water: slow swell and chop drawn in its normals, glossy enough to mirror the yard. */
function water(scene: THREE.Scene): void {
  const { edge } = QUAY;
  const m = new THREE.MeshStandardNodeMaterial({ color: 0x1c272d, roughness: 0.13, metalness: 0.05, envMapIntensity: 0.3 });
  const p = positionWorld.xz;
  const t = time;
  // A slow noise bends each wave's crests, so they don't run in straight parallel bands
  const bend = mx_noise_float(vec3(p.x.mul(0.025), p.y.mul(0.025), t.mul(0.03)));
  // Waves: [direction x, z, wavenumber (2π / wavelength), slope amplitude, speed]
  const waves: Array<[number, number, number, number, number]> = [
    [0.8, 0.6, 2.1, 0.05, 0.9],
    [-0.5, 0.86, 3.7, 0.04, 1.3],
    [0.2, -0.98, 6.3, 0.03, 1.8],
    [-0.9, -0.43, 10.5, 0.022, 2.4],
    [0.6, -0.8, 17, 0.016, 3.1],
  ];
  let gx: THREE.Node<'float'> = float(0);
  let gz: THREE.Node<'float'> = float(0);
  for (const [i, [dx, dz, k, a, s]] of waves.entries()) {
    const phase = p.x.mul(dx * k).add(p.y.mul(dz * k)).add(t.mul(s)).add(bend.mul(3 + i * 2));
    // A wave finer than a couple of pixels only shimmers: it fades out where it would
    const c = cos(phase).mul(a).mul(float(1).sub(fwidth(phase).mul(0.7)).clamp(0, 1));
    gx = gx.add(c.mul(dx));
    gz = gz.add(c.mul(dz));
  }
  const swell = sin(p.x.mul(0.21).add(t.mul(0.5))).mul(0.02);
  // Chop with no direction, fading where it would be finer than a pixel or two
  const chop = mx_noise_vec3(vec3(p.x.mul(0.35), p.y.mul(0.35), t.mul(0.1))).mul(0.03).mul(float(1).sub(fwidth(p.x.mul(0.35)).mul(0.7)).clamp(0, 1));
  const n = normalize(vec3(gx.negate().add(swell).add(chop.x), 1, gz.negate().add(chop.z)));
  m.normalNode = transformNormalToView(n);
  // A paler, murky band where the water slaps the quay wall
  const nearWall = smoothstep(3, 0, float(edge).sub(p.y));
  const murk = mx_noise_float(vec3(p.x.mul(0.4), p.y.mul(0.4), t.mul(0.15))).mul(0.5).add(0.5);
  m.colorNode = mix(color(0x1c272d), color(0x34423f), nearWall.mul(murk).mul(0.7)) as unknown as THREE.Node<'color'>;
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(1400, 900).rotateX(-Math.PI / 2), m);
  sea.position.set(0, QUAY.water, edge - 450);
  sea.receiveShadow = true;
  scene.add(sea);
}

/** Where the ship lies: its middle (x), its centre line (z), its deck (y). The horn sounds from there. */
export const SHIP = { x: 15, z: -215, deck: 14 };

/**
 * A container ship moored beam-on across the harbour: a black hull with a high freeboard, a flared
 * bow, a red boot top, stacks of boxes, a pale house aft with its funnel. In the world: its hull
 * under the water, and each of its parts above (a length of hull, the bow, a box, the house) a
 * dormant thing standing on what's under it.
 */
function ship(scene: THREE.Scene, world: World): void {
  const { x: xs, z, deck: top } = SHIP;
  const stern = xs + 95;
  const bowAt = xs - 95;
  const w = QUAY.water;
  // Under the water: the hull, and the bow's forefoot (what the rest stands on)
  world.addBox({ size: [stern - (bowAt - 30), w - QUAY.seabed, 32], position: [(stern + bowAt - 30) / 2, (w + QUAY.seabed) / 2, z], fixed: true, friction: 0.8 });
  // White: each box's own colour is its instance colour (multiplied in)
  const hull = new THREE.MeshStandardNodeMaterial({ roughness: 0.7, metalness: 0.2 });
  const list: Array<{ p: [number, number, number]; s: [number, number, number]; c: number; r?: number }> = [];
  // The hull in lengths of 10 m: its side, the red boot top showing 2.6 m above the water, a pale
  // rubbing strake under the deck edge; hatch covers under each bay of boxes, their gaps the lines
  // between bays
  const LEN = 10;
  const lengths: Array<{ x0: number; indices: number[]; covers: number[] }> = [];
  for (let x0 = bowAt; x0 < stern - 1e-6; x0 += LEN) {
    const x = x0 + LEN / 2;
    const indices = [list.length, list.length + 1, list.length + 2];
    list.push({ p: [x, (top + w) / 2, z], s: [LEN, top - w, 32], c: 0x1e2226 });
    list.push({ p: [x, w + 1.2, z], s: [LEN + 0.01, 2.8, 32.2], c: 0x7a2e26 });
    list.push({ p: [x, top - 1.1, z], s: [LEN + 0.02, 0.45, 32.3], c: 0x8a8e90 });
    lengths.push({ x0, indices, covers: [] });
  }
  for (let bay = 0; bay < 12; bay++) {
    const x = bowAt + 10 + bay * 13.2;
    lengths[Math.min(lengths.length - 1, Math.floor((x - bowAt) / LEN))].covers.push(list.length);
    list.push({ p: [x, top + 0.25, z], s: [12.6, 0.5, 30], c: 0x3c4246 });
  }
  const hullMesh = boxes(list, hull);
  scene.add(hullMesh);
  for (const { x0, indices, covers } of lengths)
    units.add({
      name: 'hull',
      bounds: { min: [x0, w, z - 16.2], max: [x0 + LEN, top + 0.5, z + 16.2] },
      instances: [...indices, ...covers].map((i) => [hullMesh, i] as [THREE.InstancedMesh, number]),
      bodies: [solidBox(world, [x0 + LEN / 2, (top + w) / 2, z], [LEN, top - w, 32])],
      build: (d) => {
        // Its sides as they're drawn (the boot top red, the strake pale under the deck edge, the
        // rest black); a bulkhead at its fore end and across its middle (and at the stern), the deck
        // resting on them between its sides; the covers on it
        const x = x0 + LEN / 2;
        const rows: Array<[number, number, number]> = [
          [w, w + 2.6, 0x7a2e26],
          [w + 2.6, top - 1.325, 0x1e2226],
          [top - 1.325, top - 0.875, 0x8a8e90],
          [top - 0.875, top, 0x1e2226],
        ];
        for (const side of [1, -1]) for (const [y0, y1, tint] of rows) boxPieces(d, { at: [x, (y0 + y1) / 2, z + side * 15.8], size: [LEN, y1 - y0, 0.4], material: 'plate', tint, most: 3.4 });
        const ends = [x0 + 0.2, x];
        if (x0 + LEN >= stern - 1e-6) ends.push(x0 + LEN - 0.2);
        for (const at of ends) boxPieces(d, { at: [at, (w + top - 0.4) / 2, z], size: [0.4, top - 0.4 - w, 31.2], material: 'plate', tint: 0x1e2226, most: 5 });
        boxPieces(d, { at: [x, top - 0.2, z], size: [LEN, 0.4, 31.2], material: 'plate', tint: 0x2a2e32, most: 5 });
        for (const i of covers) {
          const c = list[i];
          // (A cover reaching over the next length: only its part over this one)
          const a = Math.max(x0, c.p[0] - c.s[0] / 2);
          const b = Math.min(x0 + LEN, c.p[0] + c.s[0] / 2);
          if (b - a > 0.2) boxPieces(d, { at: [(a + b) / 2, top + 0.25, z], size: [b - a, 0.5, 30], material: 'plate', tint: 0x3c4246, most: 3.4 });
        }
      },
    });
  // The bow: narrow at the waterline, flaring out to the deck and raked forward
  const bowPts = [
    [bowAt, w, z - 15],
    [bowAt, w, z + 15],
    [bowAt - 20, w, z],
    [bowAt, top + 1.5, z - 16],
    [bowAt, top + 1.5, z + 16],
    [bowAt - 30, top + 1.5, z],
  ].map(([x, y, zz]) => new THREE.Vector3(x, y, zz));
  const bow = new THREE.Mesh(new ConvexGeometry(bowPts), new THREE.MeshStandardNodeMaterial({ color: 0x1e2226, roughness: 0.7, metalness: 0.2 }));
  scene.add(bow);
  // The boot top round the bow, a little proud of it (a narrower hull of the same rake)
  const bootPts = [
    [bowAt + 0.1, w - 0.2, z - 15.1],
    [bowAt + 0.1, w - 0.2, z + 15.1],
    [bowAt - 20.1, w - 0.2, z],
    [bowAt + 0.1, w + 2.6, z - 15.4],
    [bowAt + 0.1, w + 2.6, z + 15.4],
    [bowAt - 21.6, w + 2.6, z],
  ].map(([x, y, zz]) => new THREE.Vector3(x, y, zz));
  const boot = new THREE.Mesh(new ConvexGeometry(bootPts), new THREE.MeshStandardNodeMaterial({ color: 0x7a2e26, roughness: 0.7 }));
  scene.add(boot);
  const bowBody = world.addHull({ points: bowPts.flatMap((p) => [p.x, p.y, p.z]), fixed: true, friction: 0.8 });
  units.add({
    name: 'bow',
    bounds: { min: [bowAt - 30, w, z - 16], max: [bowAt, top + 1.5, z + 16] },
    bodies: bowBody ? [bowBody] : [],
    hide: () => {
      bow.visible = false;
      boot.visible = false;
    },
    // Woken: in slices along it, each the hull of the bow's points between two cuts
    build: (d) => {
      const at = (t: number, y: number, side: number): V3 => {
        // The bow's section at x (t: 0 at its foot, 1 at the deck's tip), as the hull of its points
        const lo = { x: bowAt - 20 * t, half: 15 * (1 - t) };
        const hi = { x: bowAt - 30 * t, half: 16 * (1 - t) };
        return y === 0 ? [lo.x, w, z + side * lo.half] : [hi.x, top + 1.5, z + side * hi.half];
      };
      for (let k = 0; k < 6; k++) {
        const [t0, t1] = [k / 6, (k + 1) / 6];
        const pts: V3[] = [];
        for (const t of [t0, t1]) for (const y of [0, 1]) for (const side of [1, -1]) pts.push(at(t, y, side));
        d.addConvex({ material: 'plate', points: pts, tint: k === 0 ? 0x2a2e32 : 0x1e2226 });
      }
    },
  });

  // Deck stacks: bays of 40 ft boxes, 12 across, 3 to 6 tiers; each box dormant, made as the
  // yard's boxes are once something reaches it
  const rand = random(31);
  const paints = [0x9a4236, 0x7a3a30, 0x3e5f86, 0x2e4258, 0x4d6e52, 0xc4733a, 0x9a9c98, 0xd0d0c8, 0x3f6f6c, 0xb0a890];
  const stacks: typeof list = [];
  for (let bay = 0; bay < 12; bay++) {
    const x = bowAt + 10 + bay * 13.2;
    const tiers = 3 + Math.floor(rand() * 4);
    for (let row = 0; row < 12; row++) {
      const zr = z - 15 + 1.25 + row * 2.5;
      const n = Math.max(1, tiers - (row === 0 || row === 11 ? 1 : 0) - (rand() < 0.15 ? 1 : 0));
      for (let k = 0; k < n; k++) stacks.push({ p: [x, top + 1.8 + k * 2.6, zr], s: [12.1, 2.55, 2.4], c: paints[Math.floor(rand() * paints.length)] });
    }
  }
  const stackMesh = boxes(stacks, farBoxMaterial());
  scene.add(stackMesh);
  dormantBoxes(world, stackMesh, stacks, 'shipbox');

  // The house aft: pale, with bridge wings, and the funnel on its after half (its window bands,
  // a deck apart, drawn on it)
  const house = stern - 9;
  const white = new THREE.MeshStandardNodeMaterial({ roughness: 0.6 });
  const bands = [4.2, 8.2, 12.2, 16.2];
  const parts: typeof list = [
    { p: [house, top + 11, z], s: [14, 22, 26], c: 0xf0f0ea },
    { p: [house - 4, top + 20.5, z], s: [6, 2.4, 38], c: 0xe8e8e2 },
    { p: [house - 4, top + 19.4, z], s: [6.1, 0.9, 38.1], c: 0x30383e },
    { p: [house + 3, top + 24.85, z], s: [6, 5.7, 8], c: 0xd8d8d0 },
    { p: [house + 3, top + 28.5, z], s: [6.1, 1.6, 8.1], c: 0x8a3a30 },
    // Rows of windows along the house, a deck apart
    ...bands.map((y) => ({ p: [house, top + y, z] as [number, number, number], s: [12.4, 0.7, 26.1] as [number, number, number], c: 0x2a3238 })),
    // The bridge front's windows, facing forward
    { p: [house - 7.05, top + 20.6, z], s: [0.2, 1, 24], c: 0x2a3238 },
  ];
  const houseMesh = boxes(parts, white);
  scene.add(houseMesh);
  units.add({
    name: 'house',
    bounds: union(parts.map((b) => boundsOf(b.p, b.s))),
    instances: parts.map((_, i) => [houseMesh, i] as [THREE.InstancedMesh, number]),
    bodies: [solidBox(world, [house, top + 11, z], [14, 22, 26]), solidBox(world, [house - 4, top + 20.5, z], [6, 2.4, 38]), solidBox(world, [house + 3, top + 25.85, z], [6, 7.7, 8])],
    build: (d) => {
      // Its walls in storeys (the window bands dark), its roof; the wings out past it; the funnel
      const rows: Array<[number, number, number]> = [];
      let y = 0;
      for (const b of bands) {
        rows.push([y, b - 0.35, 0xf0f0ea], [b - 0.35, b + 0.35, 0x2a3238]);
        y = b + 0.35;
      }
      rows.push([y, 22, 0xf0f0ea]);
      for (const [y0, y1, tint] of rows) boxPieces(d, { at: [house, top + (y0 + y1) / 2, z], size: [14, y1 - y0, 26], material: 'cladding', tint, most: 3.5, hollow: 0.3, roof: false });
      boxPieces(d, { at: [house, top + 22 - 0.15, z], size: [13.4, 0.3, 25.4], material: 'cladding', tint: 0xe0e0da, most: 3.5 });
      for (const side of [1, -1]) boxPieces(d, { at: [house - 4, top + 20.5, z + side * 16], size: [6, 2.4, 6], material: 'cladding', tint: 0xe8e8e2, most: 3 });
      boxPieces(d, { at: [house + 3, top + 24.85, z], size: [6, 5.7, 8], material: 'cladding', tint: 0xd8d8d0, most: 3, hollow: 0.25, roof: false });
      boxPieces(d, { at: [house + 3, top + 28.5, z], size: [6.1, 1.6, 8.1], material: 'cladding', tint: 0x8a3a30, most: 3, hollow: 0.25 });
    },
  });
}

/**
 * Boxes of a stack (instances of `mesh`), each a fixed box in the world and dormant: woken, a box
 * made as the yard's are (its paint the instance's), standing on what's under it.
 */
function dormantBoxes(world: World, mesh: THREE.InstancedMesh, list: Array<{ p: [number, number, number]; s: [number, number, number]; c: number }>, name: string): void {
  const rand = random(list.length + 7);
  list.forEach((b, i) => {
    const [sx, sy, sz] = b.s;
    // (The shed among a block's boxes is no box)
    if (sy > 3) return;
    const alongX = sx > sz;
    units.add({
      name,
      bounds: boundsOf(b.p, b.s),
      instances: [[mesh, i]],
      bodies: [solidBox(world, b.p, b.s)],
      build: (d) => void container(d, { at: [b.p[0], b.p[1] - sy / 2, b.p[2]], turn: alongX ? 0 : Math.PI / 2, length: Math.abs((alongX ? sx : sz) - FT40) < 0.5 ? FT40 : alongX ? sx : sz, height: sy, tint: b.c, rand }),
    });
  });
}

/**
 * Ship-to-shore cranes on the far quay, their booms raised: silhouettes in the fog, each dormant
 * (its members fixed boxes; woken, steel in lengths). The quay they stand on is dormant ground.
 */
function farQuay(scene: THREE.Scene, world: World): DormantGround {
  const list: Array<{ p: [number, number, number]; s: [number, number, number]; c: number; r?: number }> = [];
  const red = 0xa8443a;
  const white = 0xd0d0c8;
  const z0 = -300;
  const QUAY_TOP = 1;
  const cranes: Array<{ members: number[]; booms: number[] }> = [];
  for (const x of [-150, -100, -50]) {
    const members: number[] = [];
    const push = (b: (typeof list)[number]) => {
      members.push(list.length);
      list.push(b);
    };
    // Legs (from the quay up), sill and portal: landside z0 - 12, waterside z0 + 6
    for (const zl of [z0 - 12, z0 + 6]) for (const dx of [-9, 9]) push({ p: [x + dx, QUAY_TOP + 21.5, zl], s: [1.6, 43, 1.6], c: red });
    for (const zl of [z0 - 12, z0 + 6]) push({ p: [x, 44, zl], s: [20, 2, 2], c: white });
    for (const dx of [-9, 9]) push({ p: [x + dx, 30, z0 - 3], s: [1.2, 1.2, 16.4], c: white });
    for (const dx of [-5, 5]) push({ p: [x + dx, 46, z0 - 3], s: [1.6, 2.4, 22], c: red });
    // The A-frame and the machinery house
    for (const dx of [-5, 5]) push({ p: [x + dx, 56, z0 - 6], s: [1.2, 20, 1.2], c: red });
    push({ p: [x, 48.5, z0 - 11], s: [10, 4.5, 8], c: white });
    push({ p: [x, 66, z0 - 6], s: [11, 1.2, 1.2], c: red });
    cranes.push({ members, booms: [] });
  }
  const mesh = boxes(list, new THREE.MeshStandardNodeMaterial({ roughness: 0.6 }));
  scene.add(mesh);
  // The booms raised, rising out over the water
  const booms: typeof list = [];
  const boomAt: Array<{ centre: THREE.Vector3; q: THREE.Quaternion }> = [];
  [-150, -100, -50].forEach((x, c) => {
    for (const dx of [-4.5, 4.5]) {
      cranes[c].booms.push(booms.length);
      booms.push({ p: [x + dx, 0, 0], s: [1.4, 1.6, 46], c: red });
    }
  });
  const boom = boxes(booms, new THREE.MeshStandardNodeMaterial({ roughness: 0.6 }));
  const m = new THREE.Matrix4();
  booms.forEach((b, i) => {
    const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -1.05);
    const centre = new THREE.Vector3(b.p[0], 47 + Math.sin(1.05) * 23, z0 + 4 + Math.cos(1.05) * 23);
    m.compose(centre, q, new THREE.Vector3(...b.s));
    boom.setMatrixAt(i, m);
    boomAt.push({ centre, q });
  });
  scene.add(boom);
  for (const { members, booms: bs } of cranes) {
    const rotationOf = (i: number): [number, number, number, number] => [boomAt[i].q.x, boomAt[i].q.y, boomAt[i].q.z, boomAt[i].q.w];
    const atOf = (i: number): V3 => [boomAt[i].centre.x, boomAt[i].centre.y, boomAt[i].centre.z];
    units.add({
      name: 'sts',
      bounds: union([...members.map((i) => boundsOf(list[i].p, list[i].s)), ...bs.map((i) => boundsOf(atOf(i), booms[i].s, 0, rotationOf(i)))]),
      instances: [...members.map((i) => [mesh, i] as [THREE.InstancedMesh, number]), ...bs.map((i) => [boom, i] as [THREE.InstancedMesh, number])],
      bodies: [...members.map((i) => solidBox(world, list[i].p, list[i].s)), ...bs.map((i) => solidBox(world, atOf(i), booms[i].s, 0, rotationOf(i)))],
      build: (d) => {
        for (const i of members) boxPieces(d, { at: list[i].p, size: list[i].s, material: 'steel', tint: list[i].c, most: 3 });
        for (const i of bs) boxPieces(d, { at: atOf(i), size: booms[i].s, rotation: rotationOf(i), material: 'steel', tint: booms[i].c, most: 3 });
      },
    });
  }
  // The quay they stand on: drawn as a block, laid breakable in tiles where a blast reaches it
  const quayMaterial = new THREE.MeshStandardNodeMaterial({ color: 0x6a6c6a, roughness: 0.9 });
  const ground = new DormantGround(scene, world, {
    name: 'far quay',
    area: [-220, z0 + 2 - 15, 40, z0 + 2 + 15],
    tile: 10,
    top: QUAY_TOP,
    bottom: -3,
    layers: (area) => [{ material: 'slab', under: 'gravel', area, top: QUAY_TOP, depth: APRON.depth, underDepth: APRON.under, cell: 3, toss: 0.6 }],
  });
  ground.cut(quayMaterial, positionWorld.xz);
  const quay = boxes([{ p: [-90, -1, z0 + 2], s: [260, 4, 30], c: 0xffffff }], quayMaterial);
  scene.add(quay);
  return ground;
}

/**
 * A rock breakwater across the harbour mouth with a white lighthouse at its head (on its own rock);
 * returns the lamp's material (it blinks). Each dormant: woken, the breakwater rock in blocks, the
 * lighthouse in rings of blocks, its lantern a lamp under glass.
 */
function breakwater(scene: THREE.Scene, world: World): THREE.MeshStandardNodeMaterial {
  const a: [number, number] = [330, -150];
  const b: [number, number] = [140, -235];
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const turn = -Math.atan2(b[1] - a[1], b[0] - a[0]);
  const rock = new THREE.MeshStandardNodeMaterial({ color: 0x3a3c3c, roughness: 0.95 });
  const mound = new THREE.Mesh(new THREE.CylinderGeometry(5, 9, 4, 6, 1), rock);
  mound.scale.set(1, 1, len / 14);
  mound.geometry.rotateX(Math.PI / 2);
  mound.rotation.y = turn + Math.PI / 2;
  mound.position.set((a[0] + b[0]) / 2, -0.6, (a[1] + b[1]) / 2);
  scene.add(mound);
  // As drawn: about 4 × len / 14 m long, 18 m wide at its foot, its top 1.4 m over the sea
  const along = (4 * len) / 14;
  const mid: V3 = [(a[0] + b[0]) / 2, -0.6, (a[1] + b[1]) / 2];
  const yaw = turn;
  units.add({
    name: 'breakwater',
    bounds: boundsOf(mid, [along, 4, 14], yaw),
    instances: [],
    bodies: [solidBox(world, mid, [along, 4, 14], yaw)],
    hide: () => (mound.visible = false),
    build: (d) => {
      // On the seabed's shelf under it: two courses of rock, the upper narrower
      boxPieces(d, { at: [mid[0], -2.1, mid[2]], size: [along, 1, 16], turn: yaw, material: 'concrete', tint: 0x3a3c3c, most: 4 });
      boxPieces(d, { at: [mid[0], -0.6, mid[2]], size: [along, 2, 13], turn: yaw, material: 'concrete', tint: 0x444646, most: 4 });
      boxPieces(d, { at: [mid[0], 0.9, mid[2]], size: [along, 1, 9], turn: yaw, material: 'concrete', tint: 0x4a4c4c, most: 4 });
    },
  });
  world.addBox({ size: [along, 3, 18], position: [mid[0], -4.1, mid[2]], rotation: [0, Math.sin(yaw / 2), 0, Math.cos(yaw / 2)], fixed: true, friction: 0.9 });
  const white = new THREE.MeshStandardNodeMaterial({ color: 0xe0e0da, roughness: 0.6 });
  const red = new THREE.MeshStandardNodeMaterial({ color: 0xa83a32, roughness: 0.6 });
  const tower = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 2.1, 14, 16), white);
  tower.position.set(b[0], 0.9 + 7, b[1]);
  const band = new THREE.Mesh(new THREE.CylinderGeometry(1.75, 1.85, 2.4, 16), red);
  band.position.set(b[0], 0.9 + 9, b[1]);
  const lamp = new THREE.MeshStandardNodeMaterial({ color: 0xfff0d0, emissive: 0xffe0a0, emissiveIntensity: 0.02, roughness: 0.3 });
  const lantern = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.0, 1.4, 12), lamp);
  lantern.position.set(b[0], 0.9 + 14.7, b[1]);
  const cap = new THREE.Mesh(new THREE.ConeGeometry(1.3, 1.2, 12), red);
  cap.position.set(b[0], 0.9 + 16, b[1]);
  scene.add(tower, band, lantern, cap);
  // Its rock (out of the water to its foot)
  world.addBox({ size: [6, 3.6, 6], position: [b[0], 0.9 - 1.8, b[1]], fixed: true, friction: 0.9 });
  const parts = [tower, band, lantern, cap];
  units.add({
    name: 'lighthouse',
    bounds: { min: [b[0] - 2.1, 0.9, b[1] - 2.1], max: [b[0] + 2.1, 0.9 + 16.6, b[1] + 2.1] },
    bodies: [world.addHull({ points: cylinder(2.1, 16.6, 8).flatMap(([x, y, z]) => [b[0] + x, 0.9 + y, b[1] + z]), fixed: true, friction: 0.8 })!],
    hide: () => parts.forEach((p) => (p.visible = false)),
    build: (d) => {
      // Rings of eight blocks, 2 m a course, tapering; the red band's course red
      for (let k = 0; k < 7; k++) {
        const y0 = 0.9 + k * 2;
        const r1 = 2.1 - (0.5 * (k * 2)) / 14;
        const r2 = 2.1 - (0.5 * (k * 2 + 2)) / 14;
        for (let s = 0; s < 8; s++) {
          const pts: V3[] = [];
          for (const [r, y] of [
            [r1, y0],
            [r2, y0 + 2],
          ])
            for (const t of [s / 8, (s + 1) / 8]) {
              const ang = t * Math.PI * 2;
              pts.push([b[0] + Math.cos(ang) * r, y, b[1] + Math.sin(ang) * r], [b[0] + Math.cos(ang) * (r - 0.4), y, b[1] + Math.sin(ang) * (r - 0.4)]);
            }
          d.addConvex({ material: 'concrete', points: pts, tint: k === 4 ? 0xa83a32 : 0xe0e0da });
        }
      }
      d.addConvex({ material: 'lamp', points: cylinder(1.0, 1.4, 12).map(([x, y, z]) => [b[0] + x, 0.9 + 14 + y, b[1] + z] as V3) });
      d.addConvex({ material: 'concrete', points: frustum(1.3, 0, 1.2, 12).map(([x, y, z]) => [b[0] + x, 0.9 + 15.4 + y, b[1] + z] as V3), tint: 0xa83a32 });
    },
  });
  return lamp;
}

/** A red and a green buoy in the channel (they bob); each dormant: woken, its body and top in steel, to sink. */
function buoys(scene: THREE.Scene, world: World): Scenery['buoys'] {
  const out: Scenery['buoys'] = [];
  for (const [x, z, c] of [
    [-40, -95, 0xa8302a],
    [70, -120, 0x2f7a4a],
  ] as Array<[number, number, number]>) {
    const g = new THREE.Group();
    const paint = new THREE.MeshStandardNodeMaterial({ color: c, roughness: 0.55 });
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.1, 1.4, 16), paint);
    body.position.y = 0.2;
    const cone = c === 0xa8302a;
    const top = new THREE.Mesh(cone ? new THREE.ConeGeometry(0.6, 1.8, 16) : new THREE.CylinderGeometry(0.5, 0.5, 1.6, 16), paint);
    top.position.y = 1.7;
    g.add(body, top);
    g.position.set(x, QUAY.water, z);
    scene.add(g);
    const w = QUAY.water;
    const entry = { mesh: g, phase: x * 0.1, y: w };
    out.push(entry);
    units.add({
      name: 'buoy',
      bounds: { min: [x - 1.1, w - 0.5, z - 1.1], max: [x + 1.1, w + 2.6, z + 1.1] },
      bodies: [solidBox(world, [x, w + 1, z], [2, 2.4, 2])],
      hide: () => (g.visible = false),
      build: (d) => {
        d.addConvex({ material: 'iron', points: cylinder(1.0, 1.4, 12).map(([px, py, pz]) => [x + px, w - 0.5 + py, z + pz] as V3), tint: c, loose: true });
        d.addConvex({ material: 'iron', points: (cone ? frustum(0.6, 0, 1.7, 12) : cylinder(0.5, 1.6, 12)).map(([px, py, pz]) => [x + px, w + 0.9 + py, z + pz] as V3), tint: c, loose: true });
      },
    });
  }
  return out;
}

/**
 * The far blocks' boxes: the container skin's colour, projected in the world on each face (the
 * instance colour tints it), and its corrugations drawn in the normals, fading out where they'd be
 * finer than a pixel or two.
 */
function farBoxMaterial(): THREE.MeshStandardNodeMaterial {
  const m = new THREE.MeshStandardNodeMaterial({ roughness: 0.7, metalness: 0.15 });
  const diff = texture('harbor_container_diff', true, base);
  const n = normalWorld;
  // Faces toward x run along z, and the other way round
  const alongZ = step(abs(n.z), abs(n.x));
  const w = mix(positionWorld.x, positionWorld.z, alongZ);
  const vertical = step(abs(n.y), 0.5);
  m.colorNode = vec4(sample(diff, vec2(w, positionWorld.y).mul(0.585)).rgb, 1) as unknown as THREE.Node<'color'>;
  // A trapezoid rib every 0.285 m: its sloping sides tilt the normal along the wall
  const ribs = w.div(0.285);
  const f = fract(ribs);
  const slope = smoothstep(0.08, 0.14, f).mul(smoothstep(0.2, 0.14, f)).sub(smoothstep(0.58, 0.64, f).mul(smoothstep(0.7, 0.64, f)));
  const fade = float(1).sub(fwidth(ribs).mul(0.7)).clamp(0, 1).mul(vertical);
  const tangent = select(alongZ.greaterThan(0.5), vec3(0, 0, 1), vec3(1, 0, 0));
  m.normalNode = transformNormalToView(normalize(n.add(tangent.mul(slope.mul(0.6).mul(fade)))));
  return m;
}

/**
 * More of the port behind the yard, far enough that the fog softens it: blocks of stacked boxes,
 * gantries over them, light masts, sheds. Each box, gantry, mast and shed is dormant: a fixed box
 * (or its members') until something reaches it, then made of what it's made of.
 */
function farYard(scene: THREE.Scene, world: World): void {
  const rand = random(77);
  const paints = [0x9a4236, 0x7e3a30, 0x3e5f86, 0x2e4258, 0x4d6e52, 0xc4733a, 0x9a9c98, 0xd0d0c8, 0x3f6f6c, 0xb0a890];
  const list: Array<{ p: [number, number, number]; s: [number, number, number]; c: number; r?: number }> = [];
  const block = (x0: number, z0: number, bays: number, rows: number, along: 'x' | 'z', most: number) => {
    for (let i = 0; i < bays; i++)
      for (let j = 0; j < rows; j++) {
        const n = Math.floor(rand() * (most + 1));
        for (let k = 0; k < n; k++) {
          const c = paints[Math.floor(rand() * paints.length)];
          if (along === 'x') list.push({ p: [x0 + i * 12.6 + 6.1, 1.3 + k * 2.6, z0 + j * 2.75], s: [12.19, 2.59, 2.44], c });
          else list.push({ p: [x0 + j * 2.75, 1.3 + k * 2.6, z0 + i * 12.6 + 6.1], s: [2.44, 2.59, 12.19], c });
        }
      }
  };
  // South of the yard, across the whole frontage
  for (const x0 of [-150, -90, -30, 30, 90]) block(x0, 46, 4, 6, 'x', 4);
  for (const x0 of [-150, -90, -30, 30, 90]) block(x0, 90, 4, 6, 'x', 4);
  // East and west of the yard
  block(72, -26, 3, 8, 'z', 4);
  block(100, -26, 3, 8, 'z', 4);
  block(-122, -26, 3, 8, 'z', 4);
  block(-150, -26, 3, 8, 'z', 3);
  block(72, 14, 1, 6, 'z', 3);
  // The shed nearest the yard (15 m past the warehouse, too near for the fog to hide it): clad in
  // the boxes' corrugations; its roof and doors below
  const shedAt = list.length;
  list.push({ p: [-60, 4.5, 30], s: [22, 9, 20], c: 0x9ea6a2 });
  const stacks = boxes(list, farBoxMaterial(), true);
  scene.add(stacks);
  dormantBoxes(world, stacks, list, 'yardbox');

  // Rubber-tyred gantries over the southern blocks, sheds, light masts
  const frame: typeof list = [];
  const gantries: number[][] = [];
  for (const [x, z] of [
    [-60, 52],
    [40, 52],
    [-10, 96],
    [110, 96],
  ]) {
    const members: number[] = [];
    const push = (b: (typeof list)[number]) => {
      members.push(frame.length);
      frame.push(b);
    };
    for (const dz of [-1.5, 18]) for (const dx of [-12, 12]) push({ p: [x + dx, 8.9, z + dz], s: [0.9, 17.8, 0.9], c: 0xc8a040 });
    for (const dz of [-1.5, 18]) push({ p: [x, 18.5, z + dz], s: [25, 1.4, 1.2], c: 0xc8a040 });
    push({ p: [x - 12, 18.5, z + 8.25], s: [1.2, 1.2, 18.3], c: 0xc8a040 });
    gantries.push(members);
  }
  const sheds: number[] = [];
  for (const [x, z, w, d, h] of [
    [-130, 150, 50, 30, 14],
    [-60, 160, 40, 24, 11],
    [40, 150, 60, 30, 16],
    [130, 140, 40, 40, 12],
  ]) {
    sheds.push(frame.length);
    frame.push({ p: [x, h / 2, z], s: [w, h, d], c: 0x8e9692 });
  }
  // The near shed's roof, and a roller door in each face toward the yard
  const nearShed = [frame.length, frame.length + 1, frame.length + 2];
  frame.push({ p: [-60, 9.1, 30], s: [22.4, 0.4, 20.4], c: 0x50565a }, { p: [-48.95, 2.6, 26], s: [0.1, 5.2, 6], c: 0x6a706e }, { p: [-55, 2.6, 19.95], s: [6, 5.2, 0.1], c: 0x6a706e });
  const mastAt = [
    [-40, 75],
    [20, 75],
    [80, 75],
    [-100, 75],
    [60, -10],
    [-60, -10],
  ];
  const masts: number[] = [];
  for (const [x, z] of mastAt) {
    masts.push(frame.length);
    frame.push({ p: [x, 15, z], s: [0.5, 30, 0.5], c: 0x9a9c98 });
  }
  const frames = boxes(frame, new THREE.MeshStandardNodeMaterial({ roughness: 0.7 }), true);
  scene.add(frames);
  // The masts' heads, lit
  const head = new THREE.MeshStandardNodeMaterial({ color: 0xfff2dc, emissive: 0xffe8c8, emissiveIntensity: 2.5 });
  const heads: typeof list = mastAt.map(([x, z]) => ({ p: [x, 30.2, z] as [number, number, number], s: [2.4, 0.5, 0.8] as [number, number, number], c: 0xffffff }));
  const headMesh = boxes(heads, head);
  scene.add(headMesh);

  const steel = (indices: number[], name: string, extra: Array<[THREE.InstancedMesh, number]> = []) =>
    units.add({
      name,
      bounds: union(indices.map((i) => boundsOf(frame[i].p, frame[i].s))),
      instances: [...indices.map((i) => [frames, i] as [THREE.InstancedMesh, number]), ...extra],
      bodies: indices.map((i) => solidBox(world, frame[i].p, frame[i].s)),
      build: (d) => {
        for (const i of indices) boxPieces(d, { at: frame[i].p, size: frame[i].s, material: 'steel', tint: frame[i].c, most: 3 });
      },
    });
  for (const g of gantries) steel(g, 'gantry');
  masts.forEach((i, k) => {
    const u = steel([i], 'mast', [[headMesh, k]]);
    const b = u.build;
    u.build = (d) => {
      b(d);
      d.addBox({ material: 'lamp', size: [2.4, 0.5, 0.8], position: heads[k].p });
    };
  });
  // The sheds: their cladding round them, a roof on it
  const shed = (b: (typeof list)[number], mesh: THREE.InstancedMesh, i: number, more: Array<[THREE.InstancedMesh, number]> = []) =>
    units.add({
      name: 'shed',
      bounds: boundsOf(b.p, b.s),
      instances: [[mesh, i], ...more],
      bodies: [solidBox(world, b.p, b.s)],
      build: (d) => void boxPieces(d, { at: b.p, size: b.s, material: 'cladding', tint: b.c, most: 3.2, hollow: 0.2 }),
    });
  for (const i of sheds) shed(frame[i], frames, i);
  shed(list[shedAt], stacks, shedAt, nearShed.map((i) => [frames, i] as [THREE.InstancedMesh, number]));
}
