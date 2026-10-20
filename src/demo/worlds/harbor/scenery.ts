// What doesn't break: the yard's wet concrete deck round the apron (ground.ts) and under it, the
// crane's rail beams, the quay wall and the dark water beyond, and far off in the fog a container
// ship, the cranes of the far quay, a breakwater with its lighthouse, buoys, and more of the port
// behind the yard.

import { abs, color, cos, float, fract, fwidth, luminance, materialColor, materialRoughness, mix, mx_noise_float, mx_noise_vec3, normalize, normalWorld, positionWorld, select, sin, smoothstep, step, texture as sample, time, transformNormalToView, vec2, vec3, vec4 } from 'three/tsl';
import * as THREE from 'three/webgpu';
import { ConvexGeometry } from 'three/examples/jsm/geometries/ConvexGeometry.js';
import type { World } from 'three-avbd';
import { random } from '../../../lib/index.ts';
import { repeat, texture, textured } from '../../textures.ts';
import { APRON, BEAMS, QUAY } from './ground.ts';
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

export function scenery(scene: THREE.Scene, world: World): Scenery {
  deck(scene, world);
  rails(scene);
  quayWall(scene);
  water(scene);
  ship(scene);
  farQuay(scene);
  farYard(scene);
  return { buoys: buoys(scene), lighthouse: breakwater(scene) };
}

/**
 * The yard's deck: in the world its fixed body, at the apron's bed under the apron and at 0 round it
 * (down past the bed, so nothing slips under it out of a crater at the edge), the crane's rail beams
 * standing up through the bed, and the seabed. Drawn: the pavement round the apron (the apron's
 * slabs are pieces), and what a crater shows past the slabs.
 */
function deck(scene: THREE.Scene, world: World): void {
  const { edge, seabed } = QUAY;
  const [x0, z0, x1, z1] = APRON.bounds;
  const box = (ax: number, az: number, bx: number, bz: number, top: number, bottom = -12) => world.addBox({ size: [bx - ax, top - bottom, bz - az], position: [(ax + bx) / 2, (top + bottom) / 2, (az + bz) / 2], fixed: true, friction: 0.8 });
  box(x0, z0, x1, z1, APRON.bed);
  box(-450, edge, 450, z0, 0);
  box(-450, z1, 450, edge + 600, 0);
  box(-450, z0, x0, z1, 0);
  box(x1, z0, 450, z1, 0);
  for (const z of BEAMS.rails) box(BEAMS.x0, z - BEAMS.half, BEAMS.x1, z + BEAMS.half, 0, APRON.bed - 1);
  world.addBox({ size: [1400, 2, 900], position: [0, seabed - 1, edge - 450], fixed: true, friction: 0.9 });

  // The pavement round the apron, to 240 m either way and 320 m back
  const m = deckMaterial();
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
 * What a crater shows past the slabs: the bed (crushed stone), and where the apron meets the fixed
 * deck round it, the deck's edge (its slab over the stone) and the rail beams' concrete sides.
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
  // The rail beams' sides and ends
  const long = BEAMS.x1 - BEAMS.x0;
  for (const r of BEAMS.rails)
    for (const [w, x, z, turn] of [
      [long, (BEAMS.x0 + BEAMS.x1) / 2, r - BEAMS.half, Math.PI],
      [long, (BEAMS.x0 + BEAMS.x1) / 2, r + BEAMS.half, 0],
      [2 * BEAMS.half, BEAMS.x0, r, -Math.PI / 2],
      [2 * BEAMS.half, BEAMS.x1, r, Math.PI / 2],
    ])
      face(greyConcrete(0x8e9496, 0.8), w, bed, 0, x, z, turn, 2.5);
}

/**
 * The crane rails: a concrete beam flush with the deck, darker and rougher, and on it a steel rail
 * standing 7 cm, its head worn bright; the lane's edge line painted across each beam (the rest of
 * the lines, the drains and the oil are in the pavement).
 */
function rails(scene: THREE.Scene): void {
  const flat = (c: number, rough: number, metal = 0) => new THREE.MeshStandardNodeMaterial({ color: c, roughness: rough, metalness: metal, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const strip = (m: THREE.Material, x0: number, x1: number, z0: number, z1: number, y = 0.003) => {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, z1 - z0), m);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set((x0 + x1) / 2, y, (z0 + z1) / 2);
    mesh.receiveShadow = true;
    scene.add(mesh);
  };
  const beam = new THREE.MeshStandardNodeMaterial({ color: 0x5e605e, roughness: 0.92 });
  const rail = new THREE.MeshStandardNodeMaterial({ color: 0x4a4c4e, roughness: 0.35, metalness: 0.6 });
  const head = flat(0x8e9092, 0.3, 0.7);
  const yellow = flat(0xb89a3a, 0.65);
  for (const z of BEAMS.rails) {
    strip(beam, BEAMS.x0, BEAMS.x1, z - BEAMS.half, z + BEAMS.half, 0);
    const r = new THREE.Mesh(new THREE.BoxGeometry(41, 0.07, 0.12), rail);
    r.position.set(-14.5, 0.035, z);
    r.castShadow = r.receiveShadow = true;
    scene.add(r);
    strip(head, -35, 6, z - 0.035, z + 0.035, 0.0705);
    strip(yellow, 4.4 - 0.08, 4.4 + 0.08, z - BEAMS.half, z + BEAMS.half);
  }
}

/** The quay wall under the edge: concrete, darker where the tide wets it, with fenders and ladders. */
function quayWall(scene: THREE.Scene): void {
  const { edge, water, seabed } = QUAY;
  const W = 480;
  const H = -seabed;
  const m = repeat(textured('concrete_wall_008', { color: 0x8e9496, normalScale: 0.8 }), W / 4, H / 4);
  // The tide line: a dark wet band, and dark below it; the map's yellow mostly taken out
  const y = positionWorld.y;
  const wet = smoothstep(water + 0.9, water + 0.3, y);
  const grey = mix(materialColor.rgb, vec3(luminance(materialColor.rgb)), 0.7);
  m.colorNode = vec4(grey.mul(mix(float(1), float(0.4), wet)), 1) as unknown as THREE.Node<'color'>;
  m.roughnessNode = mix(materialRoughness, float(0.3), wet) as unknown as THREE.Node<'float'>;
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(W, H), m);
  wall.rotation.y = Math.PI;
  wall.position.set(0, -H / 2, edge);
  wall.receiveShadow = true;
  scene.add(wall);

  // Rubber fenders between the bollards: black cylinders lying along the wall
  const fender = new THREE.MeshStandardNodeMaterial({ color: 0x18191a, roughness: 0.75 });
  const cyl = new THREE.CylinderGeometry(0.4, 0.4, 2, 16);
  cyl.rotateZ(Math.PI / 2);
  const fenders = new THREE.InstancedMesh(cyl, fender, 9);
  const mat = new THREE.Matrix4();
  for (let i = 0; i < 9; i++) {
    mat.makeTranslation(-40 + i * 10, -0.95, edge - 0.42);
    fenders.setMatrixAt(i, mat);
  }
  fenders.castShadow = fenders.receiveShadow = true;
  scene.add(fenders);

  // Steel ladders set into the wall
  const steel = new THREE.MeshStandardNodeMaterial({ color: 0x5a5650, roughness: 0.5, metalness: 0.6 });
  for (const x of [-5, 22]) {
    for (const dx of [-0.22, 0.22]) {
      const r = new THREE.Mesh(new THREE.BoxGeometry(0.06, 4.2, 0.06), steel);
      r.position.set(x + dx, -1.9, edge - 0.05);
      scene.add(r);
    }
    for (let k = 0; k < 13; k++) {
      const rung = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.035, 0.035), steel);
      rung.position.set(x, -3.8 + k * 0.3, edge - 0.08);
      scene.add(rung);
    }
  }
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
 * bow, a red boot top, stacks of boxes, a pale house aft with its funnel.
 */
function ship(scene: THREE.Scene): void {
  const { x: xs, z, deck: top } = SHIP;
  const stern = xs + 95;
  const bowAt = xs - 95;
  // White: each box's own colour is its instance colour (multiplied in)
  const hull = new THREE.MeshStandardNodeMaterial({ roughness: 0.7, metalness: 0.2 });
  const list: Array<{ p: [number, number, number]; s: [number, number, number]; c: number; r?: number }> = [];
  // Hull; the red boot top showing 2.6 m above the water; a pale rubbing strake under the deck edge
  list.push({ p: [xs, (top + QUAY.water) / 2, z], s: [190, top - QUAY.water, 32], c: 0x1e2226 });
  list.push({ p: [xs, QUAY.water + 1.2, z], s: [190.2, 2.8, 32.2], c: 0x7a2e26 });
  list.push({ p: [xs, top - 1.1, z], s: [190.3, 0.45, 32.3], c: 0x8a8e90 });
  // Hatch covers under each bay of boxes, their gaps the lines between bays
  for (let bay = 0; bay < 12; bay++) list.push({ p: [bowAt + 10 + bay * 13.2, top + 0.25, z], s: [12.6, 0.5, 30], c: 0x3c4246 });
  scene.add(boxes(list, hull));
  // The bow: narrow at the waterline, flaring out to the deck and raked forward
  const w = QUAY.water;
  const bowPts = [
    [bowAt, w, z - 15],
    [bowAt, w, z + 15],
    [bowAt - 20, w, z],
    [bowAt, top + 1.5, z - 16],
    [bowAt, top + 1.5, z + 16],
    [bowAt - 30, top + 1.5, z],
  ].map(([x, y, zz]) => new THREE.Vector3(x, y, zz));
  scene.add(new THREE.Mesh(new ConvexGeometry(bowPts), new THREE.MeshStandardNodeMaterial({ color: 0x1e2226, roughness: 0.7, metalness: 0.2 })));
  // The boot top round the bow, a little proud of it (a narrower hull of the same rake)
  const bootPts = [
    [bowAt + 0.1, w - 0.2, z - 15.1],
    [bowAt + 0.1, w - 0.2, z + 15.1],
    [bowAt - 20.1, w - 0.2, z],
    [bowAt + 0.1, w + 2.6, z - 15.4],
    [bowAt + 0.1, w + 2.6, z + 15.4],
    [bowAt - 21.6, w + 2.6, z],
  ].map(([x, y, zz]) => new THREE.Vector3(x, y, zz));
  scene.add(new THREE.Mesh(new ConvexGeometry(bootPts), new THREE.MeshStandardNodeMaterial({ color: 0x7a2e26, roughness: 0.7 })));

  // Deck stacks: bays of 40 ft boxes, 12 across, 3 to 6 tiers
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
  scene.add(boxes(stacks, farBoxMaterial()));

  // The house aft: pale, with bridge wings, and the funnel on its after half
  const house = stern - 9;
  const white = new THREE.MeshStandardNodeMaterial({ roughness: 0.6 });
  scene.add(
    boxes(
      [
        { p: [house, top + 11, z], s: [14, 22, 26], c: 0xf0f0ea },
        { p: [house - 4, top + 20.5, z], s: [6, 2.4, 38], c: 0xe8e8e2 },
        { p: [house - 4, top + 19.4, z], s: [6.1, 0.9, 38.1], c: 0x30383e },
        { p: [house + 3, top + 25, z], s: [6, 6, 8], c: 0xd8d8d0 },
        { p: [house + 3, top + 28.5, z], s: [6.1, 1.6, 8.1], c: 0x8a3a30 },
        // Rows of windows along the house, a deck apart
        ...[4.2, 8.2, 12.2, 16.2].map((y) => ({ p: [house, top + y, z] as [number, number, number], s: [12.4, 0.7, 26.1] as [number, number, number], c: 0x2a3238 })),
        // The bridge front's windows, facing forward
        { p: [house - 7.05, top + 20.6, z], s: [0.2, 1, 24], c: 0x2a3238 },
      ],
      white,
    ),
  );
}

/** Ship-to-shore cranes on the far quay, their booms raised: silhouettes in the fog. */
function farQuay(scene: THREE.Scene): void {
  const list: Array<{ p: [number, number, number]; s: [number, number, number]; c: number; r?: number }> = [];
  const red = 0xa8443a;
  const white = 0xd0d0c8;
  const z0 = -300;
  for (const x of [-150, -100, -50]) {
    // Legs, sill and portal: landside z0 - 12, waterside z0 + 6
    for (const zl of [z0 - 12, z0 + 6]) for (const dx of [-9, 9]) list.push({ p: [x + dx, 22.5 - 2, zl], s: [1.6, 45, 1.6], c: red });
    for (const zl of [z0 - 12, z0 + 6]) list.push({ p: [x, 44, zl], s: [20, 2, 2], c: white });
    for (const dx of [-9, 9]) list.push({ p: [x + dx, 30, z0 - 3], s: [1.2, 1.2, 18], c: white });
    for (const dx of [-5, 5]) list.push({ p: [x + dx, 46, z0 - 3], s: [1.6, 2.4, 22], c: red });
    // The A-frame and the machinery house
    for (const dx of [-5, 5]) list.push({ p: [x + dx, 56, z0 - 6], s: [1.2, 20, 1.2], c: red });
    list.push({ p: [x, 48.5, z0 - 11], s: [10, 4.5, 8], c: white });
    list.push({ p: [x, 66, z0 - 6], s: [11, 1.2, 1.2], c: red });
  }
  const mesh = boxes(list, new THREE.MeshStandardNodeMaterial({ roughness: 0.6 }));
  scene.add(mesh);
  // The booms raised, rising out over the water
  const booms: typeof list = [];
  for (const x of [-150, -100, -50]) for (const dx of [-4.5, 4.5]) booms.push({ p: [x + dx, 0, 0], s: [1.4, 1.6, 46], c: red });
  const boom = boxes(booms, new THREE.MeshStandardNodeMaterial({ roughness: 0.6 }));
  const m = new THREE.Matrix4();
  booms.forEach((b, i) => {
    const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -1.05);
    const centre = new THREE.Vector3(b.p[0], 47 + Math.sin(1.05) * 23, z0 + 4 + Math.cos(1.05) * 23);
    m.compose(centre, q, new THREE.Vector3(...b.s));
    boom.setMatrixAt(i, m);
  });
  scene.add(boom);
  // The quay they stand on
  const quay = boxes([{ p: [-90, -1, z0 + 2], s: [260, 4, 30], c: 0x6a6c6a }], new THREE.MeshStandardNodeMaterial({ roughness: 0.9 }));
  scene.add(quay);
}

/** A rock breakwater across the harbour mouth with a white lighthouse at its head; returns the lamp's material (it blinks). */
function breakwater(scene: THREE.Scene): THREE.MeshStandardNodeMaterial {
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
  return lamp;
}

/** A red and a green buoy in the channel (they bob). */
function buoys(scene: THREE.Scene): Scenery['buoys'] {
  const out: Scenery['buoys'] = [];
  for (const [x, z, c] of [
    [-40, -95, 0xa8302a],
    [70, -120, 0x2f7a4a],
  ] as Array<[number, number, number]>) {
    const g = new THREE.Group();
    const paint = new THREE.MeshStandardNodeMaterial({ color: c, roughness: 0.55 });
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.1, 1.4, 16), paint);
    body.position.y = 0.2;
    const top = new THREE.Mesh(c === 0xa8302a ? new THREE.ConeGeometry(0.6, 1.8, 16) : new THREE.CylinderGeometry(0.5, 0.5, 1.6, 16), paint);
    top.position.y = 1.7;
    g.add(body, top);
    g.position.set(x, QUAY.water, z);
    scene.add(g);
    out.push({ mesh: g, phase: x * 0.1, y: QUAY.water });
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

/** More of the port behind the yard, far enough that the fog softens it: blocks of stacked boxes, gantries over them, light masts, sheds. */
function farYard(scene: THREE.Scene): void {
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
  list.push({ p: [-60, 4.5, 30], s: [22, 9, 20], c: 0x9ea6a2 });
  const stacks = boxes(list, farBoxMaterial(), true);
  scene.add(stacks);

  // Rubber-tyred gantries over the southern blocks, sheds, light masts
  const frame: typeof list = [];
  for (const [x, z] of [
    [-60, 52],
    [40, 52],
    [-10, 96],
    [110, 96],
  ]) {
    for (const dz of [-1.5, 18]) for (const dx of [-12, 12]) frame.push({ p: [x + dx, 9, z + dz], s: [0.9, 18, 0.9], c: 0xc8a040 });
    for (const dz of [-1.5, 18]) frame.push({ p: [x, 18.5, z + dz], s: [25, 1.4, 1.2], c: 0xc8a040 });
    frame.push({ p: [x - 12, 18.5, z + 8.25], s: [1.2, 1.2, 20], c: 0xc8a040 });
  }
  for (const [x, z, w, d, h] of [
    [-130, 150, 50, 30, 14],
    [-60, 160, 40, 24, 11],
    [40, 150, 60, 30, 16],
    [130, 140, 40, 40, 12],
  ]) frame.push({ p: [x, h / 2, z], s: [w, h, d], c: 0x8e9692 });
  // The near shed's roof, and a roller door in each face toward the yard
  frame.push({ p: [-60, 9.1, 30], s: [22.4, 0.4, 20.4], c: 0x50565a }, { p: [-48.95, 2.6, 26], s: [0.1, 5.2, 6], c: 0x6a706e }, { p: [-55, 2.6, 19.95], s: [6, 5.2, 0.1], c: 0x6a706e });
  for (const [x, z] of [
    [-40, 75],
    [20, 75],
    [80, 75],
    [-100, 75],
    [60, -10],
    [-60, -10],
  ]) frame.push({ p: [x, 15, z], s: [0.5, 30, 0.5], c: 0x9a9c98 });
  scene.add(boxes(frame, new THREE.MeshStandardNodeMaterial({ roughness: 0.7 }), true));
  // The masts' heads, lit
  const head = new THREE.MeshStandardNodeMaterial({ color: 0xfff2dc, emissive: 0xffe8c8, emissiveIntensity: 2.5 });
  const heads: typeof list = [];
  for (const [x, z] of [
    [-40, 75],
    [20, 75],
    [80, 75],
    [-100, 75],
    [60, -10],
    [-60, -10],
  ]) heads.push({ p: [x, 30.2, z], s: [2.4, 0.5, 0.8], c: 0xffffff });
  scene.add(boxes(heads, head));
}
