// The ground and what's round the town. The street breaks: packed dirt and sand over earth, laid as
// slabs (Destruction.addGround, in build: layStreet) between the boardwalks from the west end of
// town to the chapel, and on along the chapel's south side to where it becomes the road; a rocket
// leaves a wide, soft crater in a cloud of its dust, the gun pocks it and digs. The slabs are drawn
// as the ground round them is (dirt(): the paler street, the wheel ruts, the churned middle), each
// point by where on the street it was laid, so a clod carries its bit of rut away. The ground round
// the street, 200 m each way, is laid the same where a blast reaches it (tiles waiting as fixed
// boxes: DormantGround). What's in the desert stands as scenery until a round or a blast reaches
// it, then is built as pieces: sage, rocks, cacti and telegraph poles, and on the outskirts boot
// hill, a stock pen, a ruined adobe corral and a broken wheel. What doesn't break: the desert past
// 200 m, the mesas and buttes on the horizon in banded rock, and a skirt of haze round the horizon
// in the fog's colour. The sky (Goegap lighting it, a pure noon sky shown, the sun raised to noon)
// is index.ts's.

import { abs, attribute, color, float, fract, max, mix, mx_noise_float, normalize, normalMap, normalView, normalWorld, positionWorld, select, smoothstep, step, texture, uv, vec2, vec3 } from 'three/tsl';
import * as THREE from 'three/webgpu';
import type { Body, World } from 'three-avbd';
import { clip, type Destruction, frustum, hullConvex, type Piece, pieceFrame, random, type V3 } from '../../../lib/index.ts';
import { DormantGround } from '../../dormant-ground.ts';
import { DormantUnits, Merged } from '../../dormant.ts';
import { texture as mapOf } from '../../textures.ts';

const base = 'packs/western/textures/';

/** The haze's colour: the fog's. */
export const HAZE = 0xd9c9ad;

/** What stands as scenery until something reaches it (made dormant in build: dormantScenery), and the ground round the street in tiles. */
const units = new DormantUnits();
let grounds: DormantGround[] = [];

export function scenery(scene: THREE.Scene, world: World): void {
  units.units.length = 0;
  streetBed(scene, world);
  ground(scene);
  mesas(scene);
  scrub(scene);
  poles(scene);
  outskirts(scene, world);
  haze(scene);
}

type Area = [number, number, number, number];

/** The scenery's dormant things (in build: the Destruction is made). */
export function dormantScenery(d: Destruction): void {
  units.dormant(d);
  for (const g of grounds) g.dormant(d);
}

/** How far round the town the ground is laid breakable where a blast reaches it (x0, z0, x1, z1). */
const AROUND: Area = [-204, -150, 204, 150];

/** The bed where a blast has laid the ground round the street breakable (the world's groundAt there), else null. */
export function groundBed(x: number, z: number): number | null {
  for (const g of grounds) {
    const b = g.bedAt(x, z);
    if (b !== null) return b;
  }
  return null;
}

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

/**
 * The ground round the street where a blast has laid it (its tiles' top layer): on the slabs' tops
 * the ground as drawn there (dirt(), at the point their map's coordinates give: laid from the
 * world's origin, a tile per 4 m, v along -z), on their sides crumbled, as the street's.
 */
export function groundSurface(): THREE.MeshStandardNodeMaterial {
  const { normal } = pieceFrame();
  const look = dirt(uv().x.mul(4), uv().y.mul(-4));
  const m = new THREE.MeshStandardNodeMaterial({ roughness: 1, normalMap: mapOf('western_dirt_nor_gl', false, base) });
  const top = step(0.5, normal.y);
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
  const [[ax0, az0, ax1, az1], [, , bx1, bz1]] = STREET.areas;
  const far = 600;
  for (const [x0, z0, x1, z1] of STREET.areas) box(x0, z0, x1, z1, BED);
  // Past AROUND, the ground's top out to 600 m
  const [gx0, gz0, gx1, gz1] = AROUND;
  box(-far, gz1, far, far, STREET.top);
  box(-far, -far, far, gz0, STREET.top);
  box(-far, gz0, gx0, gz1, STREET.top);
  box(gx1, gz0, far, gz1, STREET.top);

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

  // Within it, round the street (north and south of it, west of it, east of it, the chapel's lot),
  // tiles waiting for a blast; under them the bed, drawn, for a crater to show
  const around: Area[] = [
    [gx0, az1, gx1, gz1],
    [gx0, gz0, gx1, az0],
    [gx0, az0, ax0, az1],
    [bx1, az0, gx1, az1],
    [ax1, bz1, bx1, az1],
  ];
  grounds = around.map(
    (area) =>
      new DormantGround(scene, world, {
        name: 'desert',
        area,
        tile: 12,
        top: STREET.top,
        bottom: -4,
        pit: m,
        layers: (a) => [{ material: 'dirt', under: 'earth', bed: 'earth', area: a, top: STREET.top, depth: STREET.depth, underDepth: STREET.underDepth, cell: STREET.cell, textureFrame: { position: [0, STREET.top, 0] } }],
      }),
  );
  const bed: number[] = [];
  for (const [x0, z0, x1, z1] of around) bed.push(x0, BED, z0, x0, BED, z1, x1, BED, z0, x1, BED, z0, x0, BED, z1, x1, BED, z1);
  const under = new THREE.BufferGeometry();
  under.setAttribute('position', new THREE.Float32BufferAttribute(bed, 3));
  under.computeVertexNormals();
  const floor = new THREE.Mesh(under, m);
  floor.receiveShadow = true;
  scene.add(floor);
}

/** The ground: dirt everywhere, paler in the street and on the road, ruts, red earth and gravel further out (dirt()). Over the street the slabs are drawn instead. */
function ground(scene: THREE.Scene): void {
  const nor = mapOf('western_dirt_nor_gl', false, base);
  const m = new THREE.MeshStandardNodeMaterial({ roughness: 1 });
  const look = dirt(positionWorld.x, positionWorld.z);
  m.colorNode = look.color;
  m.normalNode = normalMap(texture(nor, look.uv), mix(float(1), float(0.4), look.rut));
  m.roughnessNode = look.roughness;
  // Gone where a blast has laid the ground breakable
  m.opacityNode = grounds.map((g) => g.hole(positionWorld.xz)).reduce((a, b) => max(a, b)).oneMinus();
  m.alphaTest = 0.5;
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
  const rocks = instanced(rock, new THREE.MeshStandardNodeMaterial({ color: 0xa88a6c, roughness: 0.95, flatShading: true }), 70, () => {
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
  const cacti = instanced(cactus, new THREE.MeshStandardNodeMaterial({ color: 0x5f7048, roughness: 0.85 }), 16, () => {
    const [x, z] = where(45, 260);
    const s = 0.7 + rand() * 0.6;
    dummy.position.set(x, 0, z);
    dummy.scale.set(s, s, s);
    dummy.rotation.set(0, rand() * 6.28, 0);
  });

  // Each dormant (no body: a round or a rocket through its box wakes it, and meets its pieces):
  // a shrub or a rock as the hull of its points, set down on the ground and cut flat there; a
  // cactus as its trunk and its arms, each out from the trunk and up
  const m = new THREE.Matrix4();
  const c = new THREE.Color();
  const placed = (g: THREE.BufferGeometry, mesh: THREE.InstancedMesh, i: number): V3[] => {
    mesh.getMatrixAt(i, m);
    const p = g.attributes.position as THREE.BufferAttribute;
    const v = new THREE.Vector3();
    const out: V3[] = [];
    for (let k = 0; k < p.count; k++) {
      v.fromBufferAttribute(p, k).applyMatrix4(m);
      out.push([v.x, v.y, v.z]);
    }
    return out;
  };
  const lump = (points: V3[], name: string, material: string, mesh: THREE.InstancedMesh, i: number, tint?: number) => {
    const low = Math.min(...points.map((p) => p[1]));
    const down = points.map(([x, y, z]): V3 => [x, y - Math.max(0, low), z]);
    units.add({
      name,
      bounds: bound(down),
      instances: [[mesh, i]],
      build: (d) => {
        const shape = hullConvex(down);
        const cut = shape && clip(shape, [0, -1, 0], -STREET.top);
        if (cut) d.addConvex({ material, points: cut.faces.flatMap((f) => f.pts), tint });
      },
    });
  };
  for (let i = 0; i < shrubs.count; i++) {
    shrubs.getColorAt(i, c);
    lump(placed(shrub, shrubs, i), 'shrub', 'brush', shrubs, i, c.getHex());
  }
  for (let i = 0; i < rocks.count; i++) lump(placed(rock, rocks, i), 'rock', 'rock', rocks, i);
  for (let i = 0; i < cacti.count; i++) {
    cacti.getMatrixAt(i, m);
    const at = new THREE.Matrix4().copy(m);
    const to = (pts: V3[]): V3[] => pts.map(([x, y, z]) => new THREE.Vector3(x, y, z).applyMatrix4(at).toArray() as V3);
    const box = (x0: number, y0: number, z0: number, x1: number, y1: number, z1: number): V3[] => [x0, x1].flatMap((x) => [y0, y1].flatMap((y) => [z0, z1].map((z): V3 => [x, y, z])));
    units.add({
      name: 'cactus',
      bounds: bound(placed(cactus, cacti, i)),
      instances: [[cacti, i]],
      build: (d) => {
        const trunk = d.addConvex({ material: 'cactus', points: to(frustum(0.26, 0.22, 4.2, 8)), smooth: 0.9 });
        for (const [side, y0, up] of [
          [1, 1.6, 1.3],
          [-1, 2.3, 1.0],
        ] as const) {
          const out = d.addConvex({ material: 'cactus', points: to(box(side * 0.24, y0 - 0.15, -0.15, side * 0.69, y0 + 0.15, 0.15)) });
          const rise = d.addConvex({ material: 'cactus', points: to(frustum(0.17, 0.16, up + 0.08, 8).map(([x, y, z]): V3 => [side * 0.85 + x, y0 - 0.16 + y, z])), smooth: 0.9 });
          if (trunk && out) d.bond(trunk, out, 0.06);
          if (out && rise) d.bond(out, rise, 0.06);
        }
      },
    });
  }
}

/** The box round some points. */
function bound(points: V3[]): { min: V3; max: V3 } {
  return { min: [0, 1, 2].map((k) => Math.min(...points.map((p) => p[k]))) as V3, max: [0, 1, 2].map((k) => Math.max(...points.map((p) => p[k]))) as V3 };
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
    // Dormant: woken, the pole and its arm's two halves either side of it
    const at = dummy.matrix.clone();
    const to = (pts: V3[]): V3[] => pts.map(([x, y, z]) => new THREE.Vector3(x, y, z).applyMatrix4(at).toArray() as V3);
    const corners = to([-0.65, 0.65].flatMap((x) => [0, 7.5].flatMap((y) => [-0.13, 0.13].map((z): V3 => [x, y, z]))));
    units.add({
      name: 'pole',
      bounds: bound(corners),
      instances: [[mesh, i]],
      build: (d) => {
        const pole = d.addConvex({ material: 'timber', points: to(frustum(0.13, 0.1, 7.5, 6)), tint: 0x8a7a66, smooth: 0.9 });
        for (const side of [1, -1]) {
          const arm = d.addConvex({ material: 'timber', points: to([0.1, 0.65].flatMap((x) => [6.95, 7.05].flatMap((y) => [-0.05, 0.05].map((z): V3 => [side * x, y, z])))), tint: 0x8a7a66 });
          if (pole && arm) d.bond(pole, arm, 0.01);
        }
      },
    });
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

/** A box's corners (size, centre, turn about y and then a tilt about its own x, as block() lays it; `at` a point in its own frame). */
function corners(sx: number, sy: number, sz: number, x: number, y: number, z: number, yaw = 0, tilt = 0, at: V3 = [0, 0, 0]): V3[] {
  const m = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(tilt, yaw, 0, 'YXZ')), new THREE.Vector3(1, 1, 1));
  return [-1, 1].flatMap((a) => [-1, 1].flatMap((b) => [-1, 1].map((c): V3 => new THREE.Vector3(at[0] + (a * sx) / 2, at[1] + (b * sy) / 2, at[2] + (c * sz) / 2).applyMatrix4(m).toArray() as V3)));
}

/**
 * The outskirts, 40-80 m out, so the town doesn't sit in an empty plain: boot hill (a rail fence,
 * crosses and headboards over stony mounds) to the north-west, a stock pen by the west road, a
 * ruined adobe corral and a broken wagon wheel by the east road. Drawn in four merged meshes; each
 * a dormant thing, woken as its pieces: posts and rails (a rail a little short of the posts, bonded
 * to them), mounds of earth with their markers bonded on, the corral's wall blocks and lumps, the
 * wheel's rim in lengths, its spokes, hub and axle. The corral's walls are in the physics world, so
 * debris and the player stop at them.
 */
function outskirts(scene: THREE.Scene, world: World): void {
  const rand = random(404);
  const wood = new Merged();
  const bleached = new Merged();
  const earth = new Merged();
  const mud = new Merged();
  type Group = { key: number; parts: Array<{ material: string; points: V3[]; tint: number }>; bonds: Array<[number, number]>; bodies: Body[] };
  let next = 0;
  const group = (): Group => ({ key: next++, parts: [], bonds: [], bodies: [] });
  const part = (g: Group, material: string, points: V3[], tint: number) => g.parts.push({ material, points, tint }) - 1;
  const done = (g: Group, name: string) =>
    units.add({
      name,
      bounds: bound(g.parts.flatMap((p) => p.points)),
      bodies: g.bodies,
      hide: () => {
        for (const m of [wood, bleached, earth, mud]) m.hide(g.key);
      },
      build: (d) => {
        const made: Array<Piece | null> = g.parts.map((p) => {
          const shape = hullConvex(p.points);
          // (Nothing in the ground: what reaches into it is cut off at its top)
          const cut = shape && clip(shape, [0, -1, 0], -STREET.top);
          return cut ? d.addConvex({ material: p.material, points: cut.faces.flatMap((f) => f.pts), tint: p.tint }) : null;
        });
        for (const [a, b] of g.bonds) if (made[a] && made[b]) d.bond(made[a]!, made[b]!, 0.01);
      },
    });
  const WOOD = 0x8a7c6a;
  // (The woken timber's own map is the weathered grey the drawn wood is flat)
  const GREY = 0xe0d8cc;
  // A rail fence round a rectangle, posts every ~2 m, a gap for the gate on its first side
  const fence = (g: Group, x0: number, z0: number, x1: number, z1: number, h: number) => {
    const corner: Array<[number, number]> = [
      [x0, z0],
      [x1, z0],
      [x1, z1],
      [x0, z1],
    ];
    const posts: number[][] = [];
    const rails: Array<{ part: number; side: number; i: number }> = [];
    corner.forEach(([ax, az], side) => {
      const [bx, bz] = corner[(side + 1) % 4];
      const len = Math.hypot(bx - ax, bz - az);
      const yaw = Math.atan2(-(bz - az), bx - ax);
      const n = Math.round(len / 2);
      posts.push([]);
      for (let i = 0; i < n; i++) {
        const t0 = i / n;
        const t1 = (i + 1) / n;
        const lean = (rand() - 0.5) * 0.12;
        const turn = rand();
        const [px, pz] = [ax + (bx - ax) * t0, az + (bz - az) * t0];
        wood.add(g.key, block(0.14, h, 0.14, px, h / 2, pz, turn, lean));
        posts[side].push(part(g, 'timber', corners(0.14, h, 0.14, px, h / 2, pz, turn, lean), GREY));
        if (side === 0 && i === Math.floor(n / 2)) continue;
        // One rail of two down at one end now and then
        for (const y of [h * 0.45, h * 0.85]) {
          const sag = rand() < 0.12 ? -h * 0.35 : 0;
          const [rx, ry, rz] = [ax + (bx - ax) * (t0 + t1) * 0.5, y + sag / 2, az + (bz - az) * (t0 + t1) * 0.5];
          wood.add(g.key, block(len / n, 0.1, 0.06, rx, ry, rz, yaw, 0));
          rails.push({ part: part(g, 'timber', corners(len / n - 0.24, 0.1, 0.06, rx, ry, rz, yaw, 0), GREY), side, i });
        }
      }
    });
    // Each rail to the posts at its ends (the last of a side's ends on the next side's first)
    for (const r of rails) {
      const n = posts[r.side].length;
      g.bonds.push([r.part, posts[r.side][r.i]], [r.part, r.i + 1 < n ? posts[r.side][r.i + 1] : posts[(r.side + 1) % 4][0]]);
    }
  };

  // Boot hill, north-west of town
  const hill = group();
  const [hx, hz] = [-52, 40];
  fence(hill, hx - 6, hz - 4, hx + 6, hz + 4, 1.1);
  for (let i = 0; i < 10; i++) {
    const gx = hx - 4.8 + (i % 5) * 2.4 + (rand() - 0.5) * 0.6;
    const gz = hz - 1.8 + Math.floor(i / 5) * 3.4 + (rand() - 0.5) * 0.4;
    const mound = new THREE.SphereGeometry(1, 9, 5, 0, Math.PI * 2, 0, Math.PI / 2).toNonIndexed();
    mound.scale(0.55, 0.28, 1.05);
    mound.translate(gx, 0, gz + 0.9);
    earth.add(hill.key, mound);
    const pos = mound.attributes.position as THREE.BufferAttribute;
    const heap = part(hill, 'heap', Array.from({ length: pos.count }, (_, k): V3 => [pos.getX(k), pos.getY(k), pos.getZ(k)]), 0xa48464);
    const lean = (rand() - 0.5) * 0.3;
    const yaw = (rand() - 0.5) * 0.3;
    // Sun-bleached markers: crosses, and headboards, bonded to their mounds (woken, as the signs' plain boards)
    if (rand() < 0.65) {
      bleached.add(hill.key, block(0.1, 1.4, 0.07, gx, 0.7, gz, yaw, lean));
      bleached.add(hill.key, block(0.62, 0.1, 0.06, gx, 1.0, gz + Math.sin(lean) * 0.3, yaw, lean));
      const upright = part(hill, 'paint', corners(0.1, 1.4, 0.07, gx, 0.7, gz, yaw, lean), 0xd2c8b6);
      hill.bonds.push([upright, heap]);
      for (const side of [1, -1]) hill.bonds.push([part(hill, 'paint', corners(0.26, 0.1, 0.06, gx, 1.0, gz + Math.sin(lean) * 0.3, yaw, lean, [side * 0.18, 0, 0]), 0xd2c8b6), upright]);
    } else {
      bleached.add(hill.key, block(0.5, 0.8, 0.06, gx, 0.4, gz, yaw, lean));
      hill.bonds.push([part(hill, 'paint', corners(0.5, 0.8, 0.06, gx, 0.4, gz, yaw, lean), 0xd2c8b6), heap]);
    }
  }
  done(hill, 'boot hill');

  // A stock pen by the west road
  const pen = group();
  fence(pen, -62, -19, -54, -13, 1.5);
  done(pen, 'stock pen');

  // A ruined adobe corral by the east road: walls broken down to stubs, lumps at their feet
  const corral = group();
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
      mud.add(corral.key, block(len / n + 0.02, h, 0.45, x, h / 2, z, yaw, 0));
      part(corral, 'adobe', corners(len / n, h, 0.45, x, h / 2, z, yaw, 0), 0xffffff);
      corral.bodies.push(world.addBox({ size: [len / n, h, 0.45], position: [x, h / 2, z], rotation: [0, Math.sin(yaw / 2), 0, Math.cos(yaw / 2)], fixed: true, friction: 0.9 })!);
      if (rand() < 0.5) {
        const lump = new THREE.DodecahedronGeometry(0.25 + rand() * 0.2, 0);
        lump.scale(1.2, 0.6, 1);
        lump.translate(x + (rand() - 0.5) * 0.8, 0.08, z + (rand() < 0.5 ? -0.5 : 0.5));
        mud.add(corral.key, lump);
        const pos = lump.attributes.position as THREE.BufferAttribute;
        part(corral, 'adobe', Array.from({ length: pos.count }, (_, k): V3 => [pos.getX(k), pos.getY(k), pos.getZ(k)]), 0xffffff);
      }
    }
  }
  done(corral, 'corral');

  // A broken wagon wheel by the east road, spokes missing, and its axle
  const wreck = group();
  const [wx, wz] = [47, 9];
  const wheel: THREE.BufferGeometry[] = [];
  const rim = new THREE.TorusGeometry(0.62, 0.045, 5, 22, Math.PI * 1.7).toNonIndexed();
  wheel.push(rim);
  const spokes: number[] = [];
  for (let k = 0; k < 12; k++) {
    if (k === 3 || k === 4 || k === 9) continue;
    const a = (k / 12) * Math.PI * 2;
    const spoke = new THREE.BoxGeometry(0.04, 0.58, 0.03).toNonIndexed();
    spoke.translate(0, 0.33, 0);
    spoke.rotateZ(a);
    wheel.push(spoke);
    spokes.push(a);
  }
  const hub = new THREE.CylinderGeometry(0.1, 0.1, 0.16, 8).toNonIndexed();
  hub.rotateX(Math.PI / 2);
  wheel.push(hub);
  // Tipped up on its broken side, a third of the way off the ground
  const tipped = new THREE.Matrix4().makeTranslation(wx, 0.36, wz).multiply(new THREE.Matrix4().makeRotationY(0.6)).multiply(new THREE.Matrix4().makeRotationX(-Math.PI / 2 + 0.6));
  for (const g of wheel) {
    g.applyMatrix4(tipped);
    wood.add(wreck.key, g);
  }
  wood.add(wreck.key, block(1.6, 0.1, 0.1, wx + 1.2, 0.05, wz - 0.6, 0.3, 0));
  // Woken: the rim in lengths (chords), the spokes from the hub to the rim, the hub, the axle
  const local = (pts: V3[]): V3[] => pts.map((p) => new THREE.Vector3(...p).applyMatrix4(tipped).toArray() as V3);
  // (A box in the wheel's plane: centred r out at angle a, `along` long across the radius, `out` long along it)
  const radial = (r: number, a: number, along: number, out: number, thick: number): V3[] => {
    const [c, s] = [Math.cos(a), Math.sin(a)];
    return [-1, 1].flatMap((i) => [-1, 1].flatMap((j) => [-1, 1].map((k): V3 => [(r + (j * out) / 2) * c - ((i * along) / 2) * s, (r + (j * out) / 2) * s + ((i * along) / 2) * c, (k * thick) / 2])));
  };
  const lengths: number[] = [];
  for (let k = 0; k < 17; k++) lengths.push(part(wreck, 'timber', local(radial(0.62 * Math.cos(0.05 * Math.PI), (k + 0.5) * 0.1 * Math.PI, 2 * 0.62 * Math.sin(0.05 * Math.PI), 0.09, 0.09)), GREY));
  for (let k = 1; k < lengths.length; k++) wreck.bonds.push([lengths[k - 1], lengths[k]]);
  const nave = part(wreck, 'timber', local(frustum(0.1, 0.1, 0.16, 8).map(([x, y, z]): V3 => [x, z, y - 0.08])), GREY);
  for (const a of spokes) {
    // (A spoke runs up its own y, turned a about z: out along (-sin a, cos a))
    const spoke = part(wreck, 'timber', local(radial(0.3375, a + Math.PI / 2, 0.04, 0.475, 0.03)), GREY);
    wreck.bonds.push([spoke, nave]);
    const at = (((a + Math.PI / 2) / (0.1 * Math.PI)) | 0) % 20;
    if (at < 17) wreck.bonds.push([spoke, lengths[at]]);
  }
  part(wreck, 'timber', corners(1.6, 0.1, 0.1, wx + 1.2, 0.05, wz - 0.6, 0.3, 0), GREY);
  done(wreck, 'wheel');

  const draw = (m: Merged, color: number) => {
    const mesh = m.build(new THREE.MeshStandardNodeMaterial({ color, roughness: 0.95, flatShading: true }), 'outskirts');
    if (mesh) scene.add(mesh);
  };
  draw(wood, WOOD);
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
