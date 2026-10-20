import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as THREE from 'three/webgpu';
import { Player } from '../src/demo/player.ts';
import { Destruction, groundPresets, normalize, type Piece, presets, random, sub, type V3 } from '../src/lib/index.ts';
import { asWorld, FakeWorld } from './fake-world.ts';

const TOP = -0.15;
const AREA: [number, number, number, number] = [-6, -4, 6, 4];
/** The collision group of a piece passing through what it was jammed against (destruction.ts). */
const JAMMED = 1 << 30;

/** Asphalt over earth on a 12 × 8 m area, 2 m slabs, on the bed under it (the world's ground box, moved down). */
function make(o: { under?: boolean } = {}) {
  const w = new FakeWorld();
  const d = new Destruction({ world: asWorld(w), frameBudget: Infinity, materials: { asphalt: groundPresets.asphalt(), earth: groundPresets.earth(), brick: presets.brick(), concrete: presets.concrete() } });
  const ground = d.addGround({ material: 'asphalt', under: o.under === false ? undefined : 'earth', area: AREA, top: TOP, depth: 0.3, underDepth: 0.5, cell: 2 });
  w.addBox({ size: [12, 1, 8], position: [0, ground.bed - 0.5, 0], fixed: true });
  return { w, d, ground };
}
/** Frames of `dt`, letting each readback land. */
async function run(d: Destruction, seconds: number, dt = 0.1) {
  for (let t = 0; t < seconds; t += dt) {
    d.update(dt);
    await new Promise((r) => setImmediate(r));
  }
}
const standing = (d: Destruction) => d.all().filter((p) => p.state === 'fixed');
const centre = (p: Piece): V3 => {
  const b = p.bounds;
  return [(b.min[0] + b.max[0]) / 2, (b.min[1] + b.max[1]) / 2, (b.min[2] + b.max[2]) / 2];
};

test('the layer stands on its bed: slabs held by what is under them, not beside them, one texture frame', async () => {
  const { d, ground } = make();
  assert.equal(ground.slabs.length, 6 * 4 * 2);
  assert.ok(Math.abs(ground.bed - (TOP - 0.8)) < 1e-9);
  assert.equal(d.groundAt(0, 0), ground.bed, 'inside the area the ground is the bed');
  assert.equal(d.groundAt(0, 10), 0, 'outside it, the ground');
  for (const p of ground.slabs)
    for (const b of p.bonds) assert.ok(Math.abs(b.normal[1]) > 0.99, 'slabs bond only to what is over or under them');
  // Each top slab on the earth under it, face to face
  for (const p of ground.slabs.slice(0, 24)) assert.equal(p.bonds.size, 1);
  // The maps run on across the seams: every slab of a layer maps in the same frame, its box the layer's
  const frames = ground.slabs.slice(0, 24).map((p) => p.textureFrame);
  for (const f of frames) {
    for (let k = 0; k < 3; k++) assert.ok(Math.abs(f.position[k] - frames[0].position[k]) < 1e-9);
    assert.deepEqual(f.box, frames[0].box);
  }
  const box = frames[0].box!;
  for (const [a, b] of [[box.min, [0, -0.3, 0]], [box.max, [12, 0, 8]]]) for (let k = 0; k < 3; k++) assert.ok(Math.abs(a[k] - b[k]) < 1e-9, 'the layer is its box, from the corner of its area at the top');
  d.reinforce();
  await run(d, 2);
  assert.equal(standing(d).length, 48, 'it all stands');
  assert.equal(d.stats.loose, 0);
});

test("what the bed is made of: the ground's own say, else the layer under, else the top; one the Destruction doesn't have is refused", () => {
  const w = new FakeWorld();
  const d = new Destruction({ world: asWorld(w), materials: { asphalt: groundPresets.asphalt(), earth: groundPresets.earth(), rock: groundPresets.paving() } });
  const lay = (o: { under?: string; bed?: string }, x: number) => d.addGround({ material: 'asphalt', ...o, area: [x, 0, x + 2, 2], cell: 2 });
  assert.equal(lay({ under: 'earth', bed: 'rock' }, 0).bedMaterial, 'rock');
  assert.equal(lay({ under: 'earth' }, 4).bedMaterial, 'earth');
  assert.equal(lay({}, 8).bedMaterial, 'asphalt');
  assert.throws(() => lay({ under: 'earth', bed: 'sand' }, 12), /no material 'sand'/);
  assert.equal(d.grounds.length, 3);
});

test('a slab whose under-layer goes falls in: its neighbours do not hold it', async () => {
  const { d, ground } = make();
  d.reinforce();
  const top = ground.slabs.find((p) => Math.abs(centre(p)[0] - 1) < 0.01 && Math.abs(centre(p)[2] - 1) < 0.01 && centre(p)[1] > TOP - 0.3)!;
  const under = ground.slabs.find((p) => p !== top && Math.abs(centre(p)[0] - 1) < 0.01 && Math.abs(centre(p)[2] - 1) < 0.01)!;
  d.removePiece(under);
  await run(d, 0.5);
  assert.equal(top.state, 'loose');
  assert.equal(standing(d).length, 46, 'the rest stands');
});

test('a rocket into the road leaves a crater about 2 m across and under a metre deep, throws its chunks up and out, and the rest stands', async () => {
  const { d, ground } = make();
  // A brick post standing on the road, away from the blast: the slab under it holds it
  const post = d.addBox({ material: 'brick', size: [0.4, 1.5, 0.4], position: [-4.5, TOP + 0.75, -2.5] })!;
  d.reinforce();
  const before = new Set(standing(d));
  // On the road over a slab's corner (as the demo sets it off: 0.15 m off the surface), at the demo's radius
  const at: V3 = [0, TOP + 0.15, 0];
  const r = d.explode({ at, radius: 2.3, speed: 15, spin: 12 });
  assert.ok(r.done && r.broken >= 8, 'the four top slabs and the four under them are broken');
  assert.ok(r.loose.length > 0);
  for (const p of r.loose) {
    const v = p.body.velocity;
    assert.ok(v[1] > 0, 'thrown up, out of the crater');
    assert.ok(Math.hypot(v[0], v[2]) < 12, 'not far: they land round it');
  }
  // On their way out they pass through the crater's sides for a moment (thrown into them, they
  // stopped dead and covered it over): jammed, and the sides let them through, until EJECT is up
  const group = ground.slabs[ground.slabs.length - 1].body.group;
  const sides = standing(d).filter((p) => p.ground && Math.hypot(centre(p)[0], centre(p)[2]) < 3);
  for (const p of r.loose) assert.equal(p.body.group, JAMMED);
  assert.ok(sides.length > 0 && sides.every((s) => !(s.body.collidesWith & JAMMED)));
  await run(d, 1);
  for (const p of r.loose) if (p.state !== 'gone') assert.equal(p.body.group, group, 'they collide with all again');
  for (const s of sides) if (s.state !== 'gone') assert.ok(s.body.collidesWith & JAMMED);
  // The pit: open at the surface within 0.6 m of the blast, over half a metre deep but not a metre
  for (const [x, z] of [[0.6, 0], [-0.6, 0], [0, 0.6], [0, -0.6]]) assert.equal(d.raycast([x, TOP + 1, z], [0, -1, 0], 0.95), null, 'open at the surface');
  let deepest = 0;
  for (let x = -1.2; x <= 1.2; x += 0.2)
    for (let z = -1.2; z <= 1.2; z += 0.2) deepest = Math.max(deepest, TOP - (d.raycast([x, TOP + 1, z], [0, -1, 0], 5)?.point[1] ?? ground.bed));
  assert.ok(deepest > 0.5 && deepest < 1, `${deepest.toFixed(2)} m deep`);
  // And not much wider than about two and a half metres across (its edge follows the cells)
  for (const [x, z] of [[2.2, 0], [-2.2, 0], [0, 2.2], [0, -2.2]]) assert.ok(d.raycast([x, TOP + 1, z], [0, -1, 0], 1.1), 'its rim stands');
  // What it didn't reach stands as it was: the slabs further off, and the post on its slab
  for (const p of before) if (p.state !== 'gone' && Math.hypot(centre(p)[0], centre(p)[2]) > 3) assert.equal(p.state, 'fixed');
  assert.equal(post.state, 'fixed');
  // What's left of the broken slabs stands too, held up from the bed (cells over the pit fell in)
  for (const p of standing(d)) assert.ok(p.bounds.min[1] >= ground.bed - 1e-6);
});

test('a bigger blast takes the slabs out down to the bed, and what it did not reach stands', async () => {
  const { d, ground } = make();
  d.reinforce();
  const before = new Set(standing(d));
  const at: V3 = [1, TOP + 0.15, 1];
  d.explode({ at, radius: 4, speed: 15 });
  await run(d, 1);
  for (const [x, z] of [[1, 1], [1.3, 1], [1, 0.7]]) assert.equal(d.raycast([x, TOP + 1, z], [0, -1, 0], 3), null, 'nothing stands over the bed');
  for (const p of before) if (p.state !== 'gone' && Math.hypot(centre(p)[0] - 1, centre(p)[2] - 1) > 4.5) assert.equal(p.state, 'fixed');
  assert.ok(standing(d).every((p) => p.bounds.min[1] >= ground.bed - 1e-6));
});

test('only a top layer: it lies on the bed', async () => {
  const { d, ground } = make({ under: false });
  assert.equal(ground.slabs.length, 24);
  assert.ok(Math.abs(ground.bed - (TOP - 0.3)) < 1e-9);
  d.reinforce();
  await run(d, 1);
  assert.equal(standing(d).length, 24);
  d.explode({ at: [1, TOP + 0.15, 1], radius: 2.3, speed: 15 });
  await run(d, 1);
  assert.equal(d.raycast([1, TOP + 0.15, 1], [0, -1, 0], 2), null, 'through to the bed');
});

test('in a crater, what rests on the bed comes to rest; what hangs over it is not on the ground', async () => {
  const { d, ground } = make();
  d.reinforce();
  d.explode({ at: [0, TOP + 0.15, 0], radius: 4, speed: 15 });
  await run(d, 0.5);
  for (const p of [...d.loosePieces]) d.removePiece(p);
  // A chunk on the bed, and one still in the air over the pit (both still): under the street's
  // surface, but only the one on the bed is on the ground
  const lying = d.addBox({ material: 'asphalt', size: [0.3, 0.3, 0.3], position: [0, ground.bed + 0.15, 0], loose: true })!;
  const hanging = d.addBox({ material: 'asphalt', size: [0.3, 0.3, 0.3], position: [0.1, ground.bed + 0.5, 0.1], loose: true })!;
  await run(d, 1.6);
  assert.equal(lying.state, 'rubble');
  assert.equal(hanging.state, 'loose');
});

test('a curb on the bed at the edge of the area stands on its own: the slabs beside it neither hold it nor are held by it', async () => {
  const { d, ground } = make();
  // From the bed up to a sidewalk at 0, along the area's edge at x 6, built after the ground
  const curb = d.addBox({ material: 'concrete', size: [0.3, -ground.bed, 8], position: [6.15, ground.bed / 2, 0] })!;
  assert.equal(curb.bonds.size, 0, 'not bonded to the slabs beside it');
  d.reinforce();
  await run(d, 0.5);
  assert.equal(curb.state, 'fixed', 'it stands on the bed');
  // The earth under an edge slab goes: the slab falls in (the curb doesn't hold it)
  const at = (x: number, z: number, top: boolean) => ground.slabs.find((p) => Math.abs(centre(p)[0] - x) < 0.01 && Math.abs(centre(p)[2] - z) < 0.01 && centre(p)[1] > TOP - 0.3 === top)!;
  const edge = at(5, 1, true);
  d.removePiece(at(5, 1, false));
  await run(d, 0.5);
  assert.equal(edge.state, 'loose');
  // The rest beside it go: the curb still stands
  for (const p of ground.slabs) if (p.state === 'fixed' && centre(p)[0] > 4) d.removePiece(p);
  await run(d, 1);
  assert.equal(curb.state, 'fixed');
});

test('what lies in a crater is thrown as it would be anywhere: only what a blast breaks out of the ground goes out of it', async () => {
  const { d, ground } = make();
  d.reinforce();
  d.explode({ at: [0, TOP + 0.15, 0], radius: 4, speed: 15 });
  await run(d, 0.5);
  for (const p of [...d.loosePieces]) d.removePiece(p);
  // A brick at rest on the bed in the crater, and one on the ground outside the area
  const bricks = [[0, ground.bed, 0] as V3, [0, 0, 10] as V3].map(([x, y, z]) => d.addBox({ material: 'brick', size: [0.4, 0.2, 0.2], position: [x, y + 0.1, z], loose: true })!);
  await run(d, 1.6);
  assert.ok(bricks.every((b) => b.state === 'rubble'));
  // The same blast beside each, a metre off and a little up
  const thrown = bricks.map((b) => {
    const [x, y, z] = b.pose.position;
    d.explode({ at: [x - 1, y + 0.3, z], radius: 2.3, speed: 15 });
    return b.body.velocity as V3;
  });
  const speed = thrown.map((v) => Math.hypot(...v));
  assert.ok(speed[0] > 1 && Math.abs(speed[0] - speed[1]) < 1e-9, `as hard: ${speed.map((v) => v.toFixed(2))} m/s`);
  for (const v of thrown) assert.ok(v[1] / Math.hypot(v[0], v[2]) < Math.tan(0.5), 'and along the blast, not up out of a crater');
});

/**
 * How a piece lies, measured as the eye would, not as the library does: the least and the most it is
 * across seen from above (the least width of its outline, the hull of its corners, over each edge's
 * way; and the most between two corners), and how tall it is.
 */
function footprint(p: Piece): { least: number; most: number; tall: number } {
  const pts = p.corners.map(([x, , z]) => [x, z]).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const turn = (o: number[], a: number[], b: number[]) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const half = (list: number[][]) => {
    const h: number[][] = [];
    for (const q of list) {
      while (h.length >= 2 && turn(h[h.length - 2], h[h.length - 1], q) <= 0) h.pop();
      h.push(q);
    }
    return h.slice(0, -1);
  };
  const hull = [...half(pts), ...half([...pts].reverse())];
  let least = Infinity;
  let most = 0;
  for (let i = 0; i < hull.length; i++) {
    const [a, b] = [hull[i], hull[(i + 1) % hull.length]];
    const l = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const across = hull.map((q) => ((q[0] - a[0]) * (a[1] - b[1]) + (q[1] - a[1]) * (b[0] - a[0])) / l);
    least = Math.min(least, Math.max(...across) - Math.min(...across));
    for (const q of hull) most = Math.max(most, Math.hypot(q[0] - a[0], q[1] - a[1]));
  }
  return { least, most, tall: p.bounds.max[1] - p.bounds.min[1] };
}

test('the gun held on one spot digs a ragged pothole: what it breaks goes as spray and dust where it struck, now and then a chunk thrown out of the hole, and what stands round it is blocky', async () => {
  const { d, ground } = make();
  d.reinforce();
  // What each round sprays, and how far from where it struck
  let spray = 0;
  let round = 0;
  let biggest = 0;
  let farthest = 0;
  let far = 0;
  let struck: V3 = [0, 0, 0];
  d.on('dust', (e) => (round += e.volume));
  d.on('debris', (e) => {
    spray++;
    round += e.volume;
    biggest = Math.max(biggest, e.volume);
    const r = Math.hypot(...sub(e.at, struck));
    farthest = Math.max(farthest, r);
    if (r > 1) far += e.volume;
  });
  const before = standing(d).length;
  // 70 rounds at the demo's power from 6 m off, a little spread, at a spot 0.3 m in from a slab's corner
  const rand = random(5);
  const eye: V3 = [0.3, TOP + 1.65, 6.3];
  const spot: V3 = [0.3, TOP, 0.3];
  const g = 9.81;
  let broke = 0;
  let thrown = 0;
  let worst = 0;
  for (let n = 0; n < 70; n++) {
    const a = 0.02 * Math.sqrt(rand());
    const t = rand() * 2 * Math.PI;
    const dir = normalize(sub(spot, eye));
    const way: V3 = [dir[0] + a * Math.cos(t), dir[1] + a * Math.sin(t) * 0.5, dir[2] + a * Math.sin(t)];
    struck = d.raycast(eye, normalize(way), 50)?.point ?? spot;
    round = 0;
    if (d.shoot(eye, way, 6)?.broke) broke++;
    // What a round throws out of the ground goes up fast enough to clear the top
    for (const p of d.loosePieces) {
      const v = p.body.velocity as V3;
      assert.ok(v[1] ** 2 >= 2 * g * (TOP - p.bounds.min[1]), `a chunk ${(TOP - p.bounds.min[1]).toFixed(2)} m down thrown up at ${v[1].toFixed(2)} m/s`);
      thrown++;
    }
    d.update(1 / 14);
    await new Promise((r) => setImmediate(r));
    worst = Math.max(worst, round);
    // What's thrown flies off (the fake world doesn't move it)
    for (const p of [...d.loosePieces]) d.removePiece(p);
  }
  assert.ok(broke >= 10, `${broke} rounds broke something`);
  assert.ok(spray >= broke * 3 && thrown >= 1 && thrown <= broke, `${broke} broke: ${spray} sprays, ${thrown} pieces thrown`);
  // Through the asphalt where it was held and round it, and on down into the earth where the rounds
  // went on (from 6 m off they graze the hole's floor and strike its far side)
  const depth = (x: number, z: number) => TOP - (d.raycast([x, TOP + 1, z], [0, -1, 0], 5)?.point[1] ?? ground.bed);
  for (const [x, z] of [[0.3, 0.3], [0, 0.3], [0.6, 0.3], [0.3, 0], [0.3, 0.6]]) assert.ok(depth(x, z) > 0.25, `open at ${x}, ${z}`);
  let deepest = 0;
  for (let x = -0.7; x <= 1.3; x += 0.1) for (let z = -0.7; z <= 1.3; z += 0.1) deepest = Math.max(deepest, depth(x, z));
  assert.ok(deepest > 0.6, `${deepest.toFixed(2)} m deep`);
  // What goes, goes where it was struck: a round's bite (0.6 m across, into the slabs it reaches)
  // and no more, none of it far off, each spray a small one (a bigger cell goes as several). Cells
  // too long for the sliver test that reached out to the seams went whole: 0.2-2 m³ a round, metres off
  assert.ok(worst < 0.35, `${(worst * 1000).toFixed(0)} L from one round`);
  assert.ok(biggest <= 0.025, `a spray of ${(biggest * 1000).toFixed(0)} L`);
  assert.ok(farthest < 2 && far < 0.15, `sprayed ${farthest.toFixed(2)} m off, ${(far * 1000).toFixed(0)} L over a metre off`);
  // A few blocky cells left standing round it (+157 when each break left its cells beyond reach
  // standing, wedges and slivers): none thinner than 10 cm across or high, seen as the eye sees it
  const cells = standing(d).filter((p) => !ground.slabs.includes(p));
  assert.ok(standing(d).length - before <= 40, `${standing(d).length - before} more standing`);
  for (const p of cells) {
    const { least, most, tall } = footprint(p);
    assert.ok(least >= 0.1 && tall >= 0.1 && least >= most * 0.1, `a cell ${least.toFixed(2)} m across, ${most.toFixed(2)} long, ${tall.toFixed(2)} high`);
  }
});

// The player (src/demo/player.ts) on a breakable ground: keys pressed by hand
const listeners: Record<string, (e: { code: string }) => void> = {};
Object.assign(globalThis, { addEventListener: (type: string, f: (e: { code: string }) => void) => (listeners[type] = f) });
const dom = { addEventListener: () => {} } as unknown as HTMLElement;
const RADIUS = 0.35;
const EYE = 1.65;

/** A player on `d`'s ground, as a world gives it: the bed in the area, a sidewalk at 0 past its long sides, the road at its top past its ends. */
function walker(d: Destruction, feet: V3, toward: V3): Player {
  const ground = d.grounds[0];
  const p = new Player(new THREE.PerspectiveCamera(), dom, d, (x, z) => (ground.contains(x, z) ? ground.bed : Math.abs(z) > AREA[3] ? 0 : TOP));
  p.place(new THREE.Vector3(...feet), new THREE.Vector3(toward[0], toward[1] + EYE, toward[2]));
  return p;
}
/** Frames of 1/60 s for `seconds`, `code` held down, each frame's feet and eye heights after it. */
function hold(p: Player, code: string, seconds: number): Array<{ feet: number; eye: number }> {
  const trace: Array<{ feet: number; eye: number }> = [];
  listeners.keydown({ code });
  for (let t = 0; t < seconds; t += 1 / 60) {
    p.update(1 / 60);
    trace.push({ feet: p.position.y, eye: p.camera.position.y });
  }
  listeners.keyup({ code });
  return trace;
}

test('down in a pit by the curb, the edge stops the body a breadth out, the sidewalk is not stood on from below, and a jump gets out', () => {
  const { d, ground } = make();
  // Dug to the bed along the curb (z 0 to 4, x -2 to 2): the slabs at x ±2 and z 0 are its sides
  for (const p of ground.slabs) if (Math.abs(centre(p)[0]) < 2 && centre(p)[2] > 0) d.removePiece(p);
  const p = walker(d, [0, ground.bed, 2], [0, ground.bed, 10]);
  const trace = hold(p, 'KeyW', 2);
  assert.ok(p.position.z <= AREA[3] - RADIUS + 1e-9 && p.position.z > AREA[3] - RADIUS - 0.1, `stopped at z ${p.position.z.toFixed(3)}`);
  assert.ok(trace.every((f) => Math.abs(f.feet - ground.bed) < 1e-9), 'on the bed all along');
  // Along the pit's side of slabs (0.8 m up), a foot's breadth from it: the side foot over its top isn't stood on
  p.place(new THREE.Vector3(1.85, ground.bed, 0.6), new THREE.Vector3(1.85, ground.bed + EYE, 10));
  assert.ok(hold(p, 'KeyW', 0.5).every((f) => Math.abs(f.feet - ground.bed) < 1e-9));
  // A jump at the curb, walking on: out onto the sidewalk
  p.place(new THREE.Vector3(0, ground.bed, AREA[3] - RADIUS), new THREE.Vector3(0, ground.bed + EYE, 10));
  listeners.keydown({ code: 'KeyW' });
  p.update(1 / 60);
  hold(p, 'Space', 1 / 60);
  for (let t = 0; t < 1; t += 1 / 60) p.update(1 / 60);
  listeners.keyup({ code: 'KeyW' });
  assert.ok(p.position.z > AREA[3] && Math.abs(p.position.y) < 1e-9, `out at z ${p.position.z.toFixed(2)}, y ${p.position.y.toFixed(2)}`);
});

test('walking out of a shallow crater, the feet step up at once and the eye eases up after them', () => {
  const { d, ground } = make();
  // The asphalt over (1, 1) gone: a pit 0.3 m deep on the earth, the slab at x < 0 its rim
  d.removePiece(ground.slabs.find((p) => Math.abs(centre(p)[0] - 1) < 0.01 && Math.abs(centre(p)[2] - 1) < 0.01 && centre(p)[1] > TOP - 0.3)!);
  const p = walker(d, [1, TOP - 0.3, 1], [-10, TOP - 0.3, 1]);
  const trace = hold(p, 'KeyW', 1);
  let feet = 0;
  let eye = 0;
  for (let i = 1; i < trace.length; i++) {
    feet = Math.max(feet, trace[i].feet - trace[i - 1].feet);
    eye = Math.max(eye, trace[i].eye - trace[i - 1].eye);
  }
  assert.ok(Math.abs(p.position.y - TOP) < 1e-9, `up on the road at ${p.position.y}`);
  assert.ok(feet > 0.29, `the feet up ${feet.toFixed(2)} m in a frame`);
  assert.ok(eye < 0.1, `the eye at most ${eye.toFixed(3)} m a frame`);
  assert.ok(Math.abs(trace[trace.length - 1].eye - (TOP + EYE)) < 0.035, 'and at the eye again (bobbing) soon after');
});
