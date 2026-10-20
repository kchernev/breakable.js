// The ground and what's round the town. The street breaks: packed dirt and sand over earth, laid as
// slabs (Destruction.addGround, in build: layStreet) between the boardwalks from the west end of
// town to the chapel, and on along the chapel's south side to where it becomes the road; a rocket
// leaves a wide, soft crater in a cloud of its dust, the gun pocks it and digs. The slabs are drawn
// as the ground round them is (dirt(): the paler street, the wheel ruts, the churned middle), each
// point by where on the street it was laid, so a clod carries its bit of rut away. What doesn't
// break: the ground round the street (the town's dirt, the road, the desert going off red and tan),
// the mesas and buttes on the horizon in banded rock, sage, rocks, cacti and telegraph poles in
// between, a few things on the outskirts (boot hill, a stock pen, a ruined adobe corral, a broken
// wheel), and a skirt of haze round the horizon in the fog's colour. The sky (Goegap lighting it, a
// pure noon sky shown, the sun raised to noon) is index.ts's.

import { abs, attribute, color, float, fract, max, mix, mx_noise_float, normalize, normalMap, normalView, normalWorld, positionWorld, select, smoothstep, step, texture, uv, vec2, vec3 } from 'three/tsl';
import * as THREE from 'three/webgpu';
import type { World } from 'three-avbd';
import { type Destruction, pieceFrame, random } from '../../../lib/index.ts';
import { texture as mapOf } from '../../textures.ts';

const base = 'packs/western/textures/';

/** The haze's colour: the fog's. */
export const HAZE = 0xd9c9ad;

export function scenery(scene: THREE.Scene, world: World): void {
  streetBed(scene, world);
  ground(scene);
  mesas(scene);
  scrub(scene);
  poles(scene);
  outskirts(scene, world);
  haze(scene);
}

type Area = [number, number, number, number];

export const STREET = {
  /** The town's ground, and the layers' depths: packed dirt and sand, and the earth under it. */
  top: 0,
  depth: 0.25,
  underDepth: 0.95,
  /** About how wide a slab is: 272 of them in all. */
  cell: 3,
  /**
   * Between the boardwalks (their fascias stand at |z| 6.96, their footings from 7) from the west
   * end of town to the chapel's front (its buttresses from x 23), and on along the chapel's south
   * wall (z 2.5) to the edge of town. The rails, troughs, pumps and wagons in it stand on the slabs.
   */
  areas: [
    [-45, -6.9, 23, 6.9],
    [23, -6.9, 45, 2.4],
  ] as Area[],
};

/** The layers' bottom, where they rest on the ground's fixed body: what groundAt gives in the street. */
export const BED = STREET.top - STREET.depth - STREET.underDepth;

/** Whether (x, z) is on the street's breakable ground, seen from above. */
export const onStreet = (x: number, z: number) => STREET.areas.some(([x0, z0, x1, z1]) => x >= x0 && x <= x1 && z >= z0 && z <= z1);

/** The street's outline seen from above (x, z), round both stretches. */
const STREET_OUTLINE: Array<[number, number]> = (() => {
  const [[ax0, az0, ax1, az1], [, , bx1, bz1]] = STREET.areas;
  return [
    [ax0, az0],
    [bx1, az0],
    [bx1, bz1],
    [ax1, bz1],
    [ax1, az1],
    [ax0, az1],
  ];
})();

/** Lay the street (in build): every slab maps the dirt in the drawn ground's frame, so it runs on across them and into it. */
export function layStreet(d: Destruction): void {
  // A pit's floor is the same earth, drawn so (bed)
  for (const area of STREET.areas) d.addGround({ material: 'sand', under: 'earth', bed: 'earth', area, top: STREET.top, depth: STREET.depth, underDepth: STREET.underDepth, cell: STREET.cell, textureFrame: { position: [0, STREET.top, 0] } });
}

/** Rut centres across the street at x: two pairs in town, one pair out on the road. */
function ruts(x: THREE.Node<'float'>, z: THREE.Node<'float'>): THREE.Node<'float'> {
  // Out of town the outer pair runs into the inner one
  const merge = smoothstep(30, 48, abs(x));
  const wobble = mx_noise_float(vec2(x.mul(0.035), 3.1)).mul(0.25);
  const zz = z.add(wobble);
  const rut = (c: THREE.Node<'float'>) => float(1).sub(smoothstep(0.05, 0.16, abs(abs(zz).sub(c))));
  const inner = rut(float(0.8));
  const outer = rut(mix(float(2.3), float(0.8), merge));
  return max(inner, outer);
}

/**
 * The ground at (x, z) (world): dirt everywhere, paler and smoother in the street (|z| < 7 in town)
 * and on the road beyond, wheel ruts, the churned middle, red earth and gravel further out. Its
 * colour and roughness, where the map lies (`uv`: a tile per 4 m, v along -z as the slabs' maps
 * run) and how much rut there is. The drawn ground reads it at each pixel, the slabs where they
 * were laid.
 */
function dirt(x: THREE.Node<'float'>, z: THREE.Node<'float'>) {
  const diff = mapOf('western_dirt_diff', true, base);
  const arm = mapOf('western_dirt_arm', false, base);
  // A second lookup, turned and larger, breaks the repeat further off
  const uv = vec2(x, z.negate()).div(4);
  const q = vec2(x.mul(0.8).sub(z.mul(0.6)), x.mul(0.6).add(z.mul(0.8))).div(11.3);
  const far = smoothstep(25, 70, vec2(x, z).length());
  const map = mix(texture(diff, uv).rgb, mix(texture(diff, uv).rgb, texture(diff, q).rgb, 0.5), far);
  // The street (|z| < 7 in town) and the road beyond, a little paler and smoother
  const inTown = float(1).sub(smoothstep(36, 44, abs(x)));
  const street = mix(float(1).sub(smoothstep(2.6, 3.4, abs(z))), float(1).sub(smoothstep(6.6, 7.2, abs(z))), inTown);
  const rut = ruts(x, z).mul(float(1).sub(smoothstep(160, 260, abs(x)))).mul(float(1).sub(smoothstep(4, 6, abs(z))));
  // Hooves churn the middle of the street
  const churn = float(1).sub(smoothstep(0.2, 1.2, abs(z))).mul(inTown).mul(mx_noise_float(vec2(x, z).mul(1.7)).mul(0.5).add(0.5));
  // Further out: big patches of red earth, and darker gravel
  const n1 = mx_noise_float(vec2(x, z).mul(0.012)).mul(0.5).add(0.5);
  const n2 = mx_noise_float(vec2(x, z).mul(0.045).add(17)).mul(0.5).add(0.5);
  const out = smoothstep(40, 90, max(abs(x).sub(20), abs(z)));
  const [r1, r0] = [new THREE.Color(0xb07a52), new THREE.Color(0xc9a77c)];
  const red = vec3(r1.r / r0.r, r1.g / r0.g, r1.b / r0.b);
  const gravel = smoothstep(0.62, 0.78, n2).mul(out);
  let tint = mix(vec3(1, 1, 1), red, smoothstep(0.45, 0.75, n1).mul(out).mul(0.85));
  tint = tint.mul(mix(float(1), float(0.72), gravel));
  tint = mix(tint, vec3(1.02, 1.03, 1.05), street.mul(0.85));
  tint = tint.mul(mix(float(1), float(0.82), rut)).mul(mix(float(1), float(0.9), churn));
  return { color: map.mul(tint), roughness: mix(texture(arm, uv).g, float(0.8), rut.mul(0.6)), uv, rut };
}

/**
 * The street's top layer: on the slabs' tops the ground round it (dirt()), each point by where on
 * the street it was laid, so it runs on into the drawn ground and a clod keeps its bit of rut; on
 * their sides crumbled, as where it breaks. (The library bends the normal by the map at the slabs'
 * own uv, which lies where the drawn ground's does.)
 */
export function streetSurface(): THREE.MeshStandardNodeMaterial {
  // pieceFrame() measures from the middle of the stretch a slab was laid in (a clod keeps its
  // slab's), and the two stretches' lengths tell them apart
  const { position, normal, halfExtents } = pieceFrame();
  const [a, b] = STREET.areas;
  const middle = ([x0, z0, x1, z1]: Area) => vec2((x0 + x1) / 2, (z0 + z1) / 2);
  const at = position.xz.add(select(halfExtents.x.greaterThan((a[2] - a[0] + b[2] - b[0]) / 4), middle(a), middle(b)));
  const look = dirt(at.x, at.y);
  const m = new THREE.MeshStandardNodeMaterial({ roughness: 1, normalMap: mapOf('western_dirt_nor_gl', false, base) });
  const top = step(0.5, normal.y);
  // (the sides crumbled as the broken faces are, a tile a metre)
  m.colorNode = mix(texture(mapOf('western_dirt_broken_diff', true, base), uv().mul(4)).rgb, look.color, top);
  m.roughnessNode = mix(texture(mapOf('western_dirt_broken_arm', false, base), uv().mul(4)).g, look.roughness, top);
  return m;
}

/** What the earth's map is multiplied by: browner and a little darker, dug soil in the noon sun. */
export const EARTH = 0xccc0b4;

/**
 * The ground's fixed body, 4 m thick (a piece driven half a metre into a 1 m box went out of its
 * bottom), its top at the bed under the street and at the town's ground round it; and what a
 * crater shows past the slabs: the bed's earth, and the street's edge cut down to it (packed dirt
 * over earth).
 */
function streetBed(scene: THREE.Scene, world: World): void {
  const box = (x0: number, z0: number, x1: number, z1: number, top: number) =>
    world.addBox({ size: [x1 - x0, top + 4, z1 - z0], position: [(x0 + x1) / 2, (top - 4) / 2, (z0 + z1) / 2], fixed: true, friction: 0.9 });
  const [[ax0, az0, ax1, az1], [, bz0, bx1, bz1]] = STREET.areas;
  const far = 600;
  for (const [x0, z0, x1, z1] of STREET.areas) box(x0, z0, x1, z1, BED);
  // North and south of the street, west of it, the chapel's lot, and east of it
  box(-far, az1, far, far, STREET.top);
  box(-far, -far, far, az0, STREET.top);
  box(-far, az0, ax0, az1, STREET.top);
  box(ax1, bz1, far, az1, STREET.top);
  box(bx1, bz0, far, bz1, STREET.top);

  const m = new THREE.MeshStandardNodeMaterial({ roughness: 1 });
  const p = positionWorld;
  // A tile per metre: the bed's from above, a wall's along it
  const n = normalWorld;
  const uv = select(abs(n.y).greaterThan(0.5), vec2(p.x, p.z.negate()), vec2(select(abs(n.x).greaterThan(0.5), p.z, p.x), p.y));
  // The packed dirt's broken face over the earth
  const sand = texture(mapOf('western_dirt_broken_diff', true, base), uv).rgb;
  const earth = texture(mapOf('western_earth_diff', true, base), uv).rgb.mul(color(EARTH));
  m.colorNode = mix(earth, sand, smoothstep(STREET.top - STREET.depth - 0.03, STREET.top - STREET.depth + 0.03, p.y));
  const pos: number[] = [];
  // The bed: the outline's two rectangles
  for (const [x0, z0, x1, z1] of STREET.areas) pos.push(x0, BED, z0, x0, BED, z1, x1, BED, z0, x1, BED, z0, x0, BED, z1, x1, BED, z1);
  // The walls, each facing into the street: a wall from a to b faces (-(b - a).z, (b - a).x)
  STREET_OUTLINE.forEach(([x0, z0], i) => {
    const [x1, z1] = STREET_OUTLINE[(i + 1) % STREET_OUTLINE.length];
    const [mx, mz] = [(x0 + x1) / 2, (z0 + z1) / 2];
    const keep = onStreet(mx - (z1 - z0) * 1e-3, mz + (x1 - x0) * 1e-3);
    const [a, b] = keep ? [[x0, z0], [x1, z1]] : [[x1, z1], [x0, z0]];
    pos.push(a[0], STREET.top, a[1], a[0], BED, a[1], b[0], BED, b[1], a[0], STREET.top, a[1], b[0], BED, b[1], b[0], STREET.top, b[1]);
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  const mesh = new THREE.Mesh(g, m);
  mesh.receiveShadow = true;
  scene.add(mesh);
}

/** The ground: dirt everywhere, paler in the street and on the road, ruts, red earth and gravel further out (dirt()). Over the street the slabs are drawn instead. */
function ground(scene: THREE.Scene): void {
  const nor = mapOf('western_dirt_nor_gl', false, base);
  const m = new THREE.MeshStandardNodeMaterial({ roughness: 1 });
  const look = dirt(positionWorld.x, positionWorld.z);
  m.colorNode = look.color;
  m.normalNode = normalMap(texture(nor, look.uv), mix(float(1), float(0.4), look.rut));
  m.roughnessNode = look.roughness;
  // A plane 1400 m across with the street cut out of it (a shape's y is the plane's -z)
  const shape = new THREE.Shape([new THREE.Vector2(-700, -700), new THREE.Vector2(700, -700), new THREE.Vector2(700, 700), new THREE.Vector2(-700, 700)]);
  shape.holes.push(new THREE.Path(STREET_OUTLINE.map(([x, z]) => new THREE.Vector2(x, -z))));
  const plane = new THREE.Mesh(new THREE.ShapeGeometry(shape), m);
  plane.rotation.x = -Math.PI / 2;
  plane.receiveShadow = true;
  scene.add(plane);
}

/**
 * A mesa or butte: an irregular cliff-walled block on a talus skirt, with a ledge partway up. A
 * butte narrows to its top, its talus reaches a third of the way up, and its top is notched.
 */
function mesaGeometry(cx: number, cz: number, rx: number, rz: number, h: number, seed: number, butte = false): THREE.BufferGeometry {
  const rand = random(seed);
  const n = 40;
  // Outline: a lumpy ellipse with bays and spurs
  const bumps = Array.from({ length: 6 }, () => [rand() * Math.PI * 2, 0.05 + rand() * 0.1, 2 + Math.floor(rand() * 6)] as const);
  const outline = Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2;
    return { a, r: 1 + bumps.reduce((acc, [ph, amp, k]) => acc + amp * Math.sin(k * a + ph), 0) };
  });
  // Rings up the profile: the talus foot and top, a ledge, the cliff top, the cap rock's edge.
  // `zone` tells the material which is which (0 talus, 0.5 cliff, 1 cap rock)
  const ledge = 0.45 + rand() * 0.2;
  const rings: Array<{ s: number; y: number; jitter: number; zone: number }> = butte
    ? [
        { s: 1.75, y: 0, jitter: 0.1, zone: 0 },
        { s: 1.25, y: 0.2, jitter: 0.06, zone: 0.1 },
        { s: 1.06, y: 0.35, jitter: 0.04, zone: 0.25 },
        { s: 0.98, y: 0.4, jitter: 0.03, zone: 0.5 },
        { s: 0.9, y: 0.62, jitter: 0.04, zone: 0.5 },
        { s: 0.84, y: 0.64, jitter: 0.04, zone: 0.5 },
        { s: 0.76, y: 0.92, jitter: 0.03, zone: 0.6 },
        { s: 0.72, y: 1, jitter: 0.02, zone: 1 },
      ]
    : [
        { s: 1.6, y: 0, jitter: 0.08, zone: 0 },
        { s: 1.13, y: 0.28, jitter: 0.05, zone: 0.25 },
        { s: 1.06, y: ledge, jitter: 0.03, zone: 0.5 },
        { s: 1.0, y: ledge + 0.03, jitter: 0.03, zone: 0.5 },
        { s: 0.98, y: 0.9, jitter: 0.025, zone: 0.6 },
        { s: 0.97, y: 1, jitter: 0.02, zone: 1 },
      ];
  // A butte's notches: clefts down from its top, two or three, at random bearings
  const notches = butte ? Array.from({ length: 2 + Math.floor(rand() * 2) }, () => [rand() * Math.PI * 2, 0.12 + rand() * 0.12, 0.12 + rand() * 0.1] as const) : [];
  const cleft = (a: number, y: number) =>
    notches.reduce((acc, [at, depth, width]) => {
      const d = Math.abs(Math.atan2(Math.sin(a - at), Math.cos(a - at)));
      // Deepest at the top, fading out down the cliff
      return Math.max(acc, depth * Math.max(0, 1 - d / width) * Math.max(0, (y - 0.6) / 0.4));
    }, 0);
  // Smooth shading down the talus and the cliffs, hard at the ledge's shelf and the cap rock's rim:
  // a ring there gets a second row of vertices, so the bands either side don't share normals
  const hard = new Set(butte ? [4, 5, rings.length - 1] : [2, 3, rings.length - 1]);
  const pos: number[] = [];
  const zones: number[] = [];
  const idx: number[] = [];
  // Each ring's row for the band above it, and for the band below it
  const above: number[] = [];
  const below: number[] = [];
  rings.forEach((ring, k) => {
    const row: number[] = [];
    for (const o of outline) {
      const j = 1 + (rand() - 0.5) * ring.jitter * 2;
      const y = (ring.y - cleft(o.a, ring.y)) * h + (ring.y > 0 ? (rand() - 0.5) * h * 0.04 : 0);
      row.push(cx + Math.cos(o.a) * rx * o.r * ring.s * j, y, cz + Math.sin(o.a) * rz * o.r * ring.s * j);
    }
    below.push(pos.length / 3);
    for (let i = 0; i < n; i++) {
      pos.push(row[3 * i], row[3 * i + 1], row[3 * i + 2]);
      zones.push(ring.zone);
    }
    if (hard.has(k)) {
      above.push(pos.length / 3);
      for (let i = 0; i < n; i++) {
        pos.push(row[3 * i], row[3 * i + 1], row[3 * i + 2]);
        zones.push(ring.zone);
      }
    } else above.push(below[k]);
  });
  for (let k = 0; k + 1 < rings.length; k++)
    for (let i = 0; i < n; i++) {
      const a = above[k] + i;
      const b = above[k] + ((i + 1) % n);
      const c = below[k + 1] + i;
      const d = below[k + 1] + ((i + 1) % n);
      idx.push(a, c, b, b, c, d);
    }
  // The flat top, on its own vertices (the rim's second row), facing straight up
  const centre = pos.length / 3;
  pos.push(cx, h * (butte ? 0.99 : 1), cz);
  zones.push(1);
  const top = above[rings.length - 1];
  for (let i = 0; i < n; i++) idx.push(centre, top + ((i + 1) % n), top + i);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('zone', new THREE.Float32BufferAttribute(zones, 1));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** Desert sandstone: deep rust with a few broad paler beds, dark streaks down the cliffs, a greyer cap, pinkish talus. */
function rockMaterial(): THREE.MeshStandardNodeMaterial {
  const m = new THREE.MeshStandardNodeMaterial({ roughness: 0.95 });
  const p = positionWorld;
  const zone = attribute<'float'>('zone');
  // Beds: broad, a little wavy, and only some of them pale
  const wav = mx_noise_float(p.mul(vec3(0.012, 0.03, 0.012))).mul(4);
  const bed = fract(p.y.add(wav).div(11));
  const pale = smoothstep(0.55, 0.7, bed).mul(float(1).sub(smoothstep(0.8, 0.95, bed)));
  const rust = mix(color(0x9a4e30), color(0xb8683e), mx_noise_float(p.mul(vec3(0.02, 0.08, 0.02))).mul(0.5).add(0.5));
  let c = mix(rust, color(0xc9926a), pale.mul(0.55));
  // Desert varnish: dark streaks running down the cliff faces
  const streak = smoothstep(0.2, 0.75, mx_noise_float(p.mul(vec3(0.09, 0.008, 0.09))).mul(0.5).add(0.5));
  c = c.mul(mix(float(1), float(0.72), streak.mul(smoothstep(0.3, 0.5, zone))));
  // Talus paler and pinker, the cap rock greyer and darker
  c = mix(c, color(0xc08a68), float(1).sub(smoothstep(0.1, 0.4, zone)).mul(0.7));
  c = mix(c, color(0x6e4632), smoothstep(0.7, 1, zone).mul(0.6));
  m.colorNode = c;
  // Relief the mesh is too coarse to have: the normal bent by noise, lumpy, and banded along the beds
  const bend = (k: THREE.Node<'vec3'>, o: number) => vec3(mx_noise_float(p.mul(k).add(o)), mx_noise_float(p.mul(k).add(o + 7.1)), mx_noise_float(p.mul(k).add(o + 13.7)));
  m.normalNode = normalize(normalView.add(bend(vec3(0.11, 0.11, 0.11), 0).mul(0.28)).add(bend(vec3(0.03, 0.5, 0.03), 31).mul(0.16)));
  return m;
}

/** The mesas and buttes round the horizon: the big butte down the street, twin buttes west, the mesa line north, low ridges south. */
function mesas(scene: THREE.Scene): void {
  const m = rockMaterial();
  // Centre, radii, height; the first three are buttes (the big one down the street, the twins west)
  const list: Array<[number, number, number, number, number]> = [
    [430, -30, 70, 45, 90],
    [-420, 75, 34, 26, 60],
    [-440, 20, 27, 22, 45],
    [-330, 380, 80, 40, 55],
    [-160, 430, 70, 35, 70],
    [20, 330, 60, 30, 45],
    [180, 440, 95, 40, 80],
    [330, 360, 55, 30, 40],
    [-250, -420, 110, 25, 28],
    [60, -460, 140, 30, 38],
    [300, -400, 90, 22, 22],
  ];
  list.forEach(([x, z, rx, rz, h], i) => scene.add(new THREE.Mesh(mesaGeometry(x, z, rx, rz, h, 31 + i * 7, i < 3), m)));
}

/** Sage and creosote, rocks and a few cacti, 40-300 m out, off the road. */
function scrub(scene: THREE.Scene): void {
  const rand = random(77);
  const where = (rmin: number, rmax: number): [number, number] => {
    for (;;) {
      const a = rand() * Math.PI * 2;
      const r = rmin + Math.sqrt(rand()) * (rmax - rmin);
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      // Not on the road, not in town
      if (Math.abs(z) < 5 && Math.abs(x) > 30) continue;
      if (Math.abs(x) < 42 && Math.abs(z) < 32) continue;
      return [x, z];
    }
  };
  const dummy = new THREE.Object3D();
  const instanced = (geometry: THREE.BufferGeometry, material: THREE.Material, count: number, place: (i: number) => void) => {
    const mesh = new THREE.InstancedMesh(geometry, material, count);
    for (let i = 0; i < count; i++) {
      place(i);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
    return mesh;
  };
  // Shrubs: lumpy blobs, olive-grey, some sage-blue
  const shrub = new THREE.IcosahedronGeometry(1, 1);
  const sp = shrub.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < sp.count; i++) {
    const k = 0.75 + rand() * 0.5;
    sp.setXYZ(i, sp.getX(i) * k, Math.max(-0.2, sp.getY(i)) * k, sp.getZ(i) * k);
  }
  shrub.computeVertexNormals();
  const shrubs = instanced(shrub, new THREE.MeshStandardNodeMaterial({ color: 0xffffff, roughness: 1, flatShading: true }), 320, () => {
    const [x, z] = where(28, 300);
    const s = 0.35 + rand() * 0.6;
    dummy.position.set(x, s * 0.15, z);
    dummy.scale.set(s * (1 + rand() * 0.6), s * (0.6 + rand() * 0.3), s * (1 + rand() * 0.6));
    dummy.rotation.set(0, rand() * 6.28, 0);
  });
  const tints = [0x8b8a6a, 0x7d8466, 0x9a9878, 0x8a8f7a, 0x6f7656];
  for (let i = 0; i < 320; i++) shrubs.setColorAt(i, new THREE.Color(tints[Math.floor(rand() * tints.length)]));
  // Rocks
  const rock = new THREE.DodecahedronGeometry(1, 0);
  instanced(rock, new THREE.MeshStandardNodeMaterial({ color: 0xa88a6c, roughness: 0.95, flatShading: true }), 70, () => {
    const [x, z] = where(30, 320);
    const s = 0.3 + rand() * rand() * 2.2;
    dummy.position.set(x, s * 0.2, z);
    dummy.scale.set(s * (1 + rand()), s * (0.5 + rand() * 0.4), s * (1 + rand()));
    dummy.rotation.set(rand(), rand() * 6.28, rand() * 0.4);
  });
  // Cacti: a trunk and two bent arms
  const parts: THREE.BufferGeometry[] = [];
  const trunk = new THREE.CylinderGeometry(0.22, 0.26, 4.2, 8);
  trunk.translate(0, 2.1, 0);
  parts.push(trunk);
  for (const [side, y0, up] of [
    [1, 1.6, 1.3],
    [-1, 2.3, 1.0],
  ] as const) {
    const out = new THREE.CylinderGeometry(0.16, 0.16, 0.7, 8);
    out.rotateZ(Math.PI / 2);
    out.translate(side * 0.5, y0, 0);
    const rise = new THREE.CylinderGeometry(0.16, 0.17, up, 8);
    rise.translate(side * 0.85, y0 + up / 2 - 0.08, 0);
    parts.push(out, rise);
  }
  const cactus = mergeGeometries(parts);
  instanced(cactus, new THREE.MeshStandardNodeMaterial({ color: 0x5f7048, roughness: 0.85 }), 16, () => {
    const [x, z] = where(45, 260);
    const s = 0.7 + rand() * 0.6;
    dummy.position.set(x, 0, z);
    dummy.scale.set(s, s, s);
    dummy.rotation.set(0, rand() * 6.28, 0);
  });
}

/** Merge geometries of the same attributes (position, normal, uv) into one. */
function mergeGeometries(list: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const flat = list.map((g) => (g.index ? g.toNonIndexed() : g));
  const out = new THREE.BufferGeometry();
  for (const name of ['position', 'normal', 'uv']) {
    const arrays = flat.map((g) => g.getAttribute(name).array as Float32Array);
    const size = flat[0].getAttribute(name).itemSize;
    const merged = new Float32Array(arrays.reduce((s, a) => s + a.length, 0));
    let o = 0;
    for (const a of arrays) {
      merged.set(a, o);
      o += a.length;
    }
    out.setAttribute(name, new THREE.BufferAttribute(merged, size));
  }
  return out;
}

/** Telegraph poles along both roads out of town, every 45 m, no wires. */
function poles(scene: THREE.Scene): void {
  const pole = new THREE.CylinderGeometry(0.1, 0.13, 7.5, 6);
  pole.translate(0, 3.75, 0);
  const arm = new THREE.BoxGeometry(1.3, 0.1, 0.1);
  arm.translate(0, 7.0, 0);
  const geometry = mergeGeometries([pole, arm.toNonIndexed()]);
  const m = new THREE.MeshStandardNodeMaterial({ color: 0x8a7a66, roughness: 0.95 });
  const xs: number[] = [];
  for (let x = 40; x <= 350; x += 45) xs.push(x, -x);
  const mesh = new THREE.InstancedMesh(geometry, m, xs.length);
  const dummy = new THREE.Object3D();
  xs.forEach((x, i) => {
    dummy.position.set(x, 0, -8 + Math.sin(x * 0.07) * 0.6);
    dummy.rotation.set(Math.sin(x) * 0.04, 0, Math.cos(x * 1.3) * 0.04);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
  });
  mesh.castShadow = true;
  scene.add(mesh);
}

/** A box (size, centre, turn about y and then a tilt about its own x), as a geometry to merge. */
function block(sx: number, sy: number, sz: number, x: number, y: number, z: number, yaw = 0, tilt = 0): THREE.BufferGeometry {
  const g = new THREE.BoxGeometry(sx, sy, sz).toNonIndexed();
  g.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(tilt, yaw, 0, 'YXZ')), new THREE.Vector3(1, 1, 1)));
  return g;
}

/**
 * The outskirts, 40-80 m out, so the town doesn't sit in an empty plain: boot hill (a rail fence,
 * crosses and headboards over stony mounds) to the north-west, a stock pen by the west road, a
 * ruined adobe corral and a broken wagon wheel by the east road. Drawn in four merged meshes;
 * the corral's walls are in the physics world, so debris and the player stop at them.
 */
function outskirts(scene: THREE.Scene, world: World): void {
  const rand = random(404);
  const wood: THREE.BufferGeometry[] = [];
  const bleached: THREE.BufferGeometry[] = [];
  const earth: THREE.BufferGeometry[] = [];
  const mud: THREE.BufferGeometry[] = [];
  // A rail fence round a rectangle, posts every ~2 m, a gap for the gate on its first side
  const fence = (x0: number, z0: number, x1: number, z1: number, h: number) => {
    const corners: Array<[number, number]> = [
      [x0, z0],
      [x1, z0],
      [x1, z1],
      [x0, z1],
    ];
    corners.forEach(([ax, az], side) => {
      const [bx, bz] = corners[(side + 1) % 4];
      const len = Math.hypot(bx - ax, bz - az);
      const yaw = Math.atan2(-(bz - az), bx - ax);
      const n = Math.round(len / 2);
      for (let i = 0; i < n; i++) {
        const t0 = i / n;
        const t1 = (i + 1) / n;
        const lean = (rand() - 0.5) * 0.12;
        wood.push(block(0.14, h, 0.14, ax + (bx - ax) * t0, h / 2, az + (bz - az) * t0, rand(), lean));
        if (side === 0 && i === Math.floor(n / 2)) continue;
        // One rail of two down at one end now and then
        for (const y of [h * 0.45, h * 0.85]) {
          const sag = rand() < 0.12 ? -h * 0.35 : 0;
          wood.push(block(len / n, 0.1, 0.06, ax + (bx - ax) * (t0 + t1) * 0.5, y + sag / 2, az + (bz - az) * (t0 + t1) * 0.5, yaw, 0));
        }
      }
    });
  };

  // Boot hill, north-west of town
  const [hx, hz] = [-52, 40];
  fence(hx - 6, hz - 4, hx + 6, hz + 4, 1.1);
  for (let i = 0; i < 10; i++) {
    const gx = hx - 4.8 + (i % 5) * 2.4 + (rand() - 0.5) * 0.6;
    const gz = hz - 1.8 + Math.floor(i / 5) * 3.4 + (rand() - 0.5) * 0.4;
    const mound = new THREE.SphereGeometry(1, 9, 5, 0, Math.PI * 2, 0, Math.PI / 2).toNonIndexed();
    mound.scale(0.55, 0.28, 1.05);
    mound.translate(gx, 0, gz + 0.9);
    earth.push(mound);
    const lean = (rand() - 0.5) * 0.3;
    const yaw = (rand() - 0.5) * 0.3;
    // Sun-bleached markers: crosses, and headboards
    if (rand() < 0.65) {
      bleached.push(block(0.1, 1.4, 0.07, gx, 0.7, gz, yaw, lean));
      bleached.push(block(0.62, 0.1, 0.06, gx, 1.0, gz + Math.sin(lean) * 0.3, yaw, lean));
    } else bleached.push(block(0.5, 0.8, 0.06, gx, 0.4, gz, yaw, lean));
  }

  // A stock pen by the west road
  fence(-62, -19, -54, -13, 1.5);

  // A ruined adobe corral by the east road: walls broken down to stubs, lumps at their feet
  const [cx, cz] = [64, -16];
  const walls: Array<[number, number, number, number]> = [
    [cx - 5, cz - 4, cx + 5, cz - 4],
    [cx + 5, cz - 4, cx + 5, cz + 3],
    [cx - 5, cz - 4, cx - 5, cz + 1],
  ];
  for (const [ax, az, bx, bz] of walls) {
    const len = Math.hypot(bx - ax, bz - az);
    const yaw = Math.atan2(-(bz - az), bx - ax);
    const n = Math.round(len);
    for (let i = 0; i < n; i++) {
      if (rand() < 0.15) continue;
      const t = (i + 0.5) / n;
      const h = 0.4 + rand() * 1.3;
      const [x, z] = [ax + (bx - ax) * t, az + (bz - az) * t];
      mud.push(block(len / n + 0.02, h, 0.45, x, h / 2, z, yaw, 0));
      world.addBox({ size: [len / n, h, 0.45], position: [x, h / 2, z], rotation: [0, Math.sin(yaw / 2), 0, Math.cos(yaw / 2)], fixed: true, friction: 0.9 });
      if (rand() < 0.5) {
        const lump = new THREE.DodecahedronGeometry(0.25 + rand() * 0.2, 0);
        lump.scale(1.2, 0.6, 1);
        lump.translate(x + (rand() - 0.5) * 0.8, 0.08, z + (rand() < 0.5 ? -0.5 : 0.5));
        mud.push(lump);
      }
    }
  }

  // A broken wagon wheel by the east road, spokes missing, and its axle
  const [wx, wz] = [47, 9];
  const wheel: THREE.BufferGeometry[] = [];
  const rim = new THREE.TorusGeometry(0.62, 0.045, 5, 22, Math.PI * 1.7).toNonIndexed();
  wheel.push(rim);
  for (let k = 0; k < 12; k++) {
    if (k === 3 || k === 4 || k === 9) continue;
    const a = (k / 12) * Math.PI * 2;
    const spoke = new THREE.BoxGeometry(0.04, 0.58, 0.03).toNonIndexed();
    spoke.translate(0, 0.33, 0);
    spoke.rotateZ(a);
    wheel.push(spoke);
  }
  const hub = new THREE.CylinderGeometry(0.1, 0.1, 0.16, 8).toNonIndexed();
  hub.rotateX(Math.PI / 2);
  wheel.push(hub);
  // Tipped up on its broken side, a third of the way off the ground
  for (const g of wheel) {
    g.rotateX(-Math.PI / 2 + 0.6);
    g.rotateY(0.6);
    g.translate(wx, 0.36, wz);
    wood.push(g);
  }
  wood.push(block(1.6, 0.1, 0.1, wx + 1.2, 0.05, wz - 0.6, 0.3, 0));

  const draw = (list: THREE.BufferGeometry[], color: number) => {
    const mesh = new THREE.Mesh(mergeGeometries(list), new THREE.MeshStandardNodeMaterial({ color, roughness: 0.95, flatShading: true }));
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
  };
  draw(wood, 0x8a7c6a);
  draw(bleached, 0xd2c8b6);
  draw(earth, 0xa48464);
  draw(mud, 0xc29a72);
}

/** A skirt of haze round the horizon, the fog's colour, thick at its foot and gone by its top. */
function haze(scene: THREE.Scene): void {
  const h = 150;
  const geometry = new THREE.CylinderGeometry(540, 540, h, 64, 1, true);
  geometry.translate(0, h / 2 - 2, 0);
  const m = new THREE.MeshBasicNodeMaterial({ transparent: true, depthWrite: false, fog: false, side: THREE.BackSide });
  m.colorNode = color(HAZE);
  const y = positionWorld.y;
  m.opacityNode = float(0.95).mul(float(1).sub(smoothstep(0, h * 0.85, y)).pow(1.6));
  const mesh = new THREE.Mesh(geometry, m);
  mesh.renderOrder = -1;
  mesh.frustumCulled = false;
  scene.add(mesh);
}
