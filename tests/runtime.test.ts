// The demo's runtime without a GPU: the player's bounds and the scenery's solids (on the fake
// world), what the effects emit (their pools are plain arrays until uploaded), and the sky's turn.

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { convexHull } from 'three-avbd';
import * as THREE from 'three/webgpu';
import { collapseDust, Effects } from '../src/demo/effects.ts';
import { Player, type SolidBody, Solids } from '../src/demo/player.ts';
import { aimSky } from '../src/demo/sky.ts';
import { Destruction, presets, type V3 } from '../src/lib/index.ts';
import { asWorld, FakeWorld } from './fake-world.ts';

// The player listens for keys on the window: a stand-in, and keys pressed by hand
const listeners: Record<string, (e: { code: string }) => void> = {};
Object.assign(globalThis, { addEventListener: (type: string, f: (e: { code: string }) => void) => (listeners[type] = f) });
const dom = { addEventListener: () => {} } as unknown as HTMLElement;

function player(options: ConstructorParameters<typeof Player>[4] = {}, ground: (x: number, z: number) => number = () => 0): Player {
  const d = new Destruction({ world: asWorld(new FakeWorld()), frameBudget: Infinity, materials: { brick: presets.brick() } });
  return new Player(new THREE.PerspectiveCamera(), dom, d, ground, options);
}

/** Hold `code` down for `seconds`. */
function walk(p: Player, code: string, seconds: number): void {
  listeners.keydown({ code });
  for (let t = 0; t < seconds; t += 1 / 60) p.update(1 / 60);
  listeners.keyup({ code });
}

const box = (size: V3, position: V3): SolidBody => ({ shape: 'box', size, position, rotation: [0, 0, 0, 1], hull: null });

test('the player stops at the edge of where the world lets them walk, and slides along it', () => {
  const p = player({ walkable: (_x, z) => z > -5 });
  p.place(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 1.65, -10));
  walk(p, 'KeyW', 3);
  assert.ok(p.position.z > -5 && p.position.z < -4.8, `stopped at z ${p.position.z}`);
  // Heading across the edge at 45°: it keeps going along it
  p.place(new THREE.Vector3(0, 0, -4.9), new THREE.Vector3(-10, 1.65, -14.9));
  walk(p, 'KeyW', 1);
  assert.ok(p.position.z > -5, `still in, at z ${p.position.z}`);
  assert.ok(p.position.x < -1.5, `slid along to x ${p.position.x}`);
});

test('from outside the walkable part, the player can walk back in', () => {
  const p = player({ walkable: (_x, z) => z > -5 });
  p.place(new THREE.Vector3(0, 0, -8), new THREE.Vector3(0, 1.65, 0));
  walk(p, 'KeyW', 2);
  assert.ok(p.position.z > -5, `back in at z ${p.position.z}`);
});

test("the scenery's fixed bodies are walls to walk into and floors to stand on", () => {
  const solids = new Solids([box([10, 3, 1], [0, 1.5, -5]), box([4, 1, 4], [6, 0.5, 0])]);
  const p = player({ solids });
  p.place(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 1.65, -10));
  walk(p, 'KeyW', 3);
  assert.ok(p.position.z > -4.5 && p.position.z < -3.9, `stopped by the wall at z ${p.position.z}`);
  // Dropped onto the box's top (1 m up), it stands there
  p.place(new THREE.Vector3(6, 1.5, 0), new THREE.Vector3(6, 1.65, -10));
  for (let i = 0; i < 60; i++) p.update(1 / 60);
  assert.ok(Math.abs(p.position.y - 1) < 1e-6, `stands at y ${p.position.y}`);
  // Without them it walks straight through
  const q = player();
  q.place(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 1.65, -10));
  walk(q, 'KeyW', 3);
  assert.ok(q.position.z < -10, `walked on to z ${q.position.z}`);
});

test("a ray from inside one solid still finds the next: what it starts inside doesn't hide the rest", () => {
  // A low box the ray starts in, and a wall 1.5 m ahead of the start
  const s = new Solids([box([4, 2, 4], [0, 0, 0]), box([10, 3, 1], [0, 1.5, -2])]);
  const hit = s.raycast([0, 0.5, 0], [0, 0, -1], 5)!;
  assert.ok(Math.abs(hit.distance - 1.5) < 1e-6, `the wall at ${hit.distance}`);
  assert.deepEqual(hit.normal, [0, 0, 1]);
  // Down from inside an overhang onto the floor under it
  const floor = new Solids([box([4, 0.4, 4], [0, 1.1, 0]), box([4, 1, 4], [0, -0.5, 0])]).raycast([0, 1, 0], [0, -1, 0], 3)!;
  assert.ok(Math.abs(floor.point[1]) < 1e-6, `the floor at y ${floor.point[1]}`);
  // Inside the only one: nothing
  assert.equal(new Solids([box([4, 2, 4], [0, 0, 0])]).raycast([0, 0.5, 0], [0, 0, -1], 5), null);
});

test("the ground's own bodies aren't walls: out of the water and back up onto the quay", () => {
  // Harbor Yard's shape: a deck 12 m deep, its top at 0 and its face at z = 0, with the water
  // beyond, where the ground the player wades on is 1.3 m down
  const ground = (_x: number, z: number) => (z < 0 ? -1.3 : 0);
  const deck = box([40, 12, 40], [0, -6, 20]);
  const bollard = box([1, 1, 1], [0, 0.5, 6]);
  const solids = new Solids([deck, bollard]).above(ground);
  assert.equal(solids.count, 1, 'the deck is the ground; what stands on it is kept');
  const p = player({ solids }, ground);
  p.place(new THREE.Vector3(3, 0, 2), new THREE.Vector3(3, 1.65, -10));
  walk(p, 'KeyW', 1.5);
  assert.ok(p.position.z < -1 && Math.abs(p.position.y + 1.3) < 1e-6, `in the water at z ${p.position.z}, y ${p.position.y}`);
  p.place(p.position.clone(), new THREE.Vector3(3, 0, 10));
  walk(p, 'KeyW', 1.5);
  assert.ok(p.position.z > 1 && p.position.y === 0, `back on the quay at z ${p.position.z}, y ${p.position.y}`);
  // Without the ground to tell them apart, the deck's face is a wall the player can't climb
  const q = player({ solids: new Solids([deck]) }, ground);
  q.place(new THREE.Vector3(3, -1.3, -2), new THREE.Vector3(3, 0.35, 10));
  walk(q, 'KeyW', 1.5);
  assert.ok(q.position.z < 0, `held at z ${q.position.z}`);
});

test('a hull following the ground is the ground; one rising off it is solid', () => {
  // A slope's cell as Sun Temple makes them: its top corners on the ground, its bottom 3 m under
  const ground = (x: number) => x * 0.5;
  const cell = (lift: number) => {
    const points = [0, 4].flatMap((x) => [0, 4].flatMap((z) => [x, ground(x) + lift, z, x, -3, z]));
    const hull = convexHull(points)!;
    return { shape: 'hull' as const, hull, size: hull.size, position: hull.center, rotation: hull.rotation };
  };
  assert.equal(new Solids([cell(0)]).above(ground).count, 0);
  assert.equal(new Solids([cell(0.3)]).above(ground).count, 1);
});

test('solids take hull bodies as the world has them: on their principal axes, at their centre of mass', () => {
  // A wedge: as World.addHull places one (the body at the hull's centre, turned onto its axes)
  const points = [0, 0, 0, 4, 0, 0, 0, 0, 2, 4, 0, 2, 0, 3, 0, 0, 3, 2];
  const hull = convexHull(points)!;
  const solids = new Solids([{ shape: 'hull', hull, size: hull.size, position: hull.center, rotation: hull.rotation }]);
  // Down onto the slope at x = 2: it's 1.5 m up there
  const hit = solids.raycast([2, 10, 1], [0, -1, 0], 20)!;
  assert.ok(Math.abs(hit.point[1] - 1.5) < 1e-4, `hit at y ${hit.point[1]}`);
  assert.ok(hit.normal[1] > 0.5 && hit.normal[0] > 0.5, `the slope faces up and +x: ${hit.normal}`);
  assert.equal(solids.raycast([6, 10, 1], [0, -1, 0], 20), null);
});

// --- Effects ---------------------------------------------------------------------------------

/** The effects' particle pools, as written on the CPU (positions; and colours: a puff's at 4–6 of its 20 floats). */
const pools = (fx: Effects) => fx as unknown as { puffs: { p: Float32Array; s: Float32Array; head: number }; bits: { p: Float32Array; head: number } };
const camera = () => new THREE.PerspectiveCamera(70, 1, 0.05, 600);

test('warm() uses every effect once, out of sight past the far plane, and is gone in a moment', () => {
  const cam = camera();
  const fx = new Effects(new THREE.Scene(), cam, { maxParticles: 2000 });
  fx.warm();
  fx.update(1 / 60);
  assert.equal(fx.count, 7, 'three puffs (dust, fire, glow) and four bits (spark, chip, ember, flake)');
  const { puffs, bits } = pools(fx);
  for (let i = 0; i < puffs.head; i++) assert.ok(puffs.p[i * 4] > 2 * cam.far, `puff ${i} at x ${puffs.p[i * 4]}`);
  for (let i = 0; i < bits.head; i++) assert.ok(bits.p[i * 4] > 2 * cam.far, `bit ${i} at x ${bits.p[i * 4]}`);
  for (let i = 0; i < 30; i++) fx.update(1 / 60);
  assert.equal(fx.count, 0);
});

test('puff() makes one puff in its own colour, not the dust palette', () => {
  const fx = new Effects(new THREE.Scene(), camera(), { maxParticles: 2000 });
  fx.puff([0, 2, 0], { color: 0x203040, life: 3, size: 2 });
  fx.update(1 / 60);
  assert.equal(fx.count, 1);
  const s = pools(fx).puffs.s;
  const want = new THREE.Color(0x203040);
  // Shaded a little either way, its hue kept
  assert.ok(Math.abs(s[4] / s[6] - want.r / want.b) < 1e-4 && Math.abs(s[5] / s[6] - want.g / want.b) < 1e-4, `rgb ${s[4]}, ${s[5]}, ${s[6]}`);
});

test("a world's smoke settings shrink and colour the blast's cloud", () => {
  const blast = (smoke?: object) => {
    const fx = new Effects(new THREE.Scene(), camera(), { maxParticles: 8000, smoke });
    fx.explosion([0, 1, 0], [0, 1, 0]);
    fx.update(1 / 60);
    return pools(fx).puffs;
  };
  const plain = blast();
  const small = blast({ scale: 0.5 });
  assert.ok(small.head < plain.head * 0.6, `${small.head} puffs, against ${plain.head}`);
  // The billow comes first: in the colour given (a light grey here), not the palette's tans
  const grey = blast({ color: 0xd0d0d0 });
  for (let i = 0; i < 20; i++) {
    const o = i * 20;
    assert.ok(Math.abs(grey.s[o + 4] - grey.s[o + 6]) < 1e-6, `puff ${i} is grey`);
  }
});

test("dust takes its material's colour as far as the world's blend says, over its palette", () => {
  const dusty = (dustPalette?: object) => {
    const fx = new Effects(new THREE.Scene(), camera(), { maxParticles: 4000, dustPalette });
    fx.dust([0, 1, 0], 0.5, 0x404448);
    fx.update(1 / 60);
    const s = pools(fx).puffs.s;
    // How warm (red over blue) the first puff is
    return s[4] / s[6];
  };
  const steel = new THREE.Color(0x404448);
  assert.ok(dusty() > 1.1, 'by default, steel dust is pulled toward the warm palette');
  assert.ok(Math.abs(dusty({ blend: 1 }) - steel.r / steel.b) < 1e-4, 'blend 1: its own colour');
  assert.ok(dusty({ colors: [0x808080], blend: 0 }) === 1, 'blend 0: the palette alone');
  // Out of range: kept to 0–1; no colours: the default palette
  assert.ok(Math.abs(dusty({ blend: 3 }) - steel.r / steel.b) < 1e-4, 'blend over 1: as 1');
  assert.ok(dusty({ colors: [] }) > 1.1, 'an empty palette: the default');
});

test('the cloud over a collapse: the colour of most of it by volume, as much dust as its materials raise', () => {
  const piece = (materialName: string, volume: number, at: V3) => ({ materialName, volume, bounds: { min: at, max: [at[0] + 1, at[1] + 1, at[2] + 1] as V3 } });
  const amount = (m: string) => ({ steel: 0.1 })[m] ?? 1;
  // A brick chip first, then the steel frame it hung on
  const c = collapseDust([piece('brick', 0.2, [0, 4, 0]), piece('steel', 0.4, [2, 0, 1]), piece('steel', 0.4, [-1, 1, 0])], amount);
  assert.equal(c.material, 'steel');
  assert.ok(Math.abs(c.amount - (0.2 * 1 + 0.8 * 0.1)) < 1e-9, `amount ${c.amount}`);
  assert.deepEqual([c.min, c.max], [
    [-1, 0, 0],
    [3, 5, 2],
  ]);
  assert.equal(collapseDust([], amount).amount, 1);
});

// --- The sky ---------------------------------------------------------------------------------

test("the sky's sun is turned onto the light: where three looks up the light's direction, the HDRI's sun is", () => {
  // A 64 × 32 equirectangular sky, dim but for one hot texel (column 10, high up)
  const [w, h] = [64, 32];
  const data = new Float32Array(w * h * 4).fill(0.1);
  data.fill(50, (6 * w + 10) * 4, (6 * w + 10) * 4 + 3);
  const hdr = new THREE.DataTexture(data, w, h, THREE.RGBAFormat, THREE.FloatType);
  // Three's lookup: the direction turned back by the rotation's inverse, then equirectUV's column
  const column = (dir: THREE.Vector3, turn: number) => {
    const d = dir.clone().applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(0, turn, 0)).transpose());
    return (((Math.atan2(d.z, d.x) / (2 * Math.PI) + 0.5) * w) % w + w) % w;
  };
  for (const azimuth of [1.15, 0.3, 2.8, -2]) {
    const { turn, sun } = aimSky(hdr, azimuth);
    const off = Math.atan2(-sun.z, sun.x) - azimuth;
    assert.ok(Math.abs(Math.atan2(Math.sin(off), Math.cos(off))) < 1e-9, `the light at azimuth ${Math.atan2(-sun.z, sun.x)}, wanted ${azimuth}`);
    assert.ok(Math.abs(column(sun, turn) - 10.5) < 0.01, `the light looks up column ${column(sun, turn)}`);
    // Turned the other way (as it was), the light looks elsewhere
    assert.ok(Math.abs(column(sun, -turn) - 10.5) > 1, 'the old turn misses it');
  }
});
