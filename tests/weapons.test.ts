import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as THREE from 'three/webgpu';
import { type BulletHit, type Burst, Gun, type GunOptions } from '../src/demo/gun.ts';
import { Launcher } from '../src/demo/launcher.ts';
import { type SolidBody, Solids } from '../src/demo/player.ts';
import { groundKind, gunHooks, waterOf, Weapons } from '../src/demo/weapons.ts';
import harbor from '../src/demo/worlds/harbor/index.ts';
import nyc from '../src/demo/worlds/nyc/index.ts';
import type { WorldRuntime } from '../src/demo/worlds/types.ts';
import western from '../src/demo/worlds/western/index.ts';
import { Destruction, groundPresets, presets, type V3 } from '../src/lib/index.ts';
import { asWorld, FakeWorld } from './fake-world.ts';

const DT = 1 / 60;

/** A gun in a world of a brick wall 20 m ahead (x -3..3, up to 4 m), the eye at 1.6 m looking down -z, flat ground at 0. */
function make(options: GunOptions = {}) {
  const d = new Destruction({ world: asWorld(new FakeWorld()), frameBudget: Infinity, materials: { brick: presets.brick() } });
  d.addBox({ material: 'brick', size: [6, 4, 0.5], position: [0, 2, -20.25], static: true });
  const camera = new THREE.PerspectiveCamera(70, 16 / 9, 0.05, 600);
  camera.position.set(0, 1.6, 0);
  const calls = { muzzle: 0, casing: [] as Array<{ at: V3; floor: number }>, tracer: [] as Array<{ from: V3; to: V3 }> };
  const effects = {
    muzzle: () => void calls.muzzle++,
    casing: (at: V3, _v: V3, floor: number) => void calls.casing.push({ at, floor }),
    tracer: (from: V3, to: V3) => void calls.tracer.push({ from, to }),
  };
  const player = { shake: 0 };
  const gun = new Gun(camera, d, () => 0, { effects, player, ...options });
  gun.lowered = 0;
  const hits: BulletHit[] = [];
  const sounds: string[] = [];
  gun.onHit = (h) => hits.push(h);
  gun.onShot = () => sounds.push('shot');
  gun.onBurstEnd = (b) => sounds.push(`tail ${b.rounds}`);
  return { d, camera, gun, calls, player, hits, sounds };
}

/** Frames of `seconds`, the view turned each as the player has it (the gun lays its climb over that). */
const run = (gun: Gun, seconds: number, look = 0) => {
  for (let t = 0; t < seconds - 1e-9; t += DT) {
    (gun as unknown as { camera: THREE.Camera }).camera.rotation.set(look, 0, 0, 'YXZ');
    gun.update(DT, 0);
  }
};

test('held, the gun fires 14 rounds a second at the crosshair; let go, it stops, with nothing banked', () => {
  const { gun, hits, calls, sounds } = make();
  gun.trigger(true);
  run(gun, 1);
  assert.ok(hits.length >= 13 && hits.length <= 15, `${hits.length} rounds in a second`);
  assert.equal(calls.muzzle, hits.length);
  assert.equal(calls.casing.length, hits.length, 'a casing a round');
  assert.equal(calls.tracer.length, Math.floor(hits.length / 2), 'a tracer every other');
  // Each struck the wall, near the crosshair
  for (const h of hits) {
    assert.equal(h.material, 'brick');
    assert.equal(h.kind, 'brick');
    assert.ok(Math.abs(h.at[2] + 20) < 1e-6 && Math.abs(h.at[0]) < 1 && Math.abs(h.at[1] - 1.6) < 1.2, `at ${h.at}`);
  }
  gun.trigger(false);
  run(gun, 1);
  const fired = hits.length;
  assert.equal(sounds.filter((s) => s === 'shot').length, fired);
  assert.equal(sounds.at(-1), `tail ${fired}`, 'the echo once the burst ends');
  // A second later the trigger again: one round at once, not the ones it might have fired
  gun.trigger(true);
  run(gun, DT);
  assert.equal(hits.length, fired + 1);
});

test('the spread opens through a burst and closes again; the view climbs and settles back', () => {
  const { gun, hits, camera } = make();
  const pitch = 0;
  gun.trigger(true);
  run(gun, 0.05);
  const first = hits[0].at;
  assert.ok(Math.hypot(first[0], first[1] - 1.6) < 20 * 0.003, `the first round on the crosshair: ${first}`);
  run(gun, 2.5);
  const later = hits.slice(-10).map((h) => Math.hypot(h.at[0], h.at[1] - 1.6 - Math.tan(camera.rotation.x - pitch) * 20));
  assert.ok(Math.max(...later) > 0.12, `later rounds spread: ${later.map((x) => x.toFixed(2))}`);
  const climbed = camera.rotation.x - pitch;
  assert.ok(climbed > 0.005 && climbed < 0.05, `the view climbed ${climbed} rad`);
  gun.trigger(false);
  run(gun, 1);
  assert.ok(Math.abs(camera.rotation.x - pitch) < 0.002, `and settled: ${camera.rotation.x - pitch}`);
  // Closed again: a new burst's first round on the crosshair
  const n = hits.length;
  gun.trigger(true);
  run(gun, DT);
  const again = hits[n].at;
  assert.ok(Math.hypot(again[0], again[1] - 1.6) < 20 * 0.004, `on the crosshair again: ${again}`);
});

test('it never runs dry: held for 10 s, it fires all the way through, at the same rate, one burst', () => {
  const { gun, hits, sounds } = make();
  gun.trigger(true);
  run(gun, 10);
  assert.ok(hits.length >= 138 && hits.length <= 141, `${hits.length} rounds in 10 s`);
  // The last second as full as the first
  const last = sounds.filter((s) => s === 'shot').length;
  run(gun, 1);
  const more = sounds.filter((s) => s === 'shot').length - last;
  assert.ok(more >= 13 && more <= 15, `${more} in the 11th second`);
  assert.ok(!sounds.some((s) => s.startsWith('tail')), 'no echo while held: one burst');
  gun.trigger(false);
  run(gun, DT);
  assert.equal(sounds.at(-1), `tail ${hits.length}`);
});

test('bullets stop on the scenery and the ground; the water and the sky take them', () => {
  const solid: SolidBody = { shape: 'box', size: [4, 4, 1], position: [0, 2, -8], rotation: [0, 0, 0, 1], hull: null };
  const s = make({ solids: new Solids([solid]) });
  s.gun.burst(1);
  run(s.gun, 0.1);
  assert.equal(s.hits[0].piece, null);
  assert.equal(s.hits[0].kind, 'concrete');
  assert.ok(Math.abs(s.hits[0].at[2] + 7.5) < 1e-6, `on the scenery: ${s.hits[0].at}`);

  const g = make({ ground: () => 'dirt' });
  g.gun.burst(1);
  run(g.gun, 0.1, -0.3);
  assert.equal(g.hits[0].kind, 'dirt');
  assert.ok(Math.abs(g.hits[0].at[1]) < 0.02, `on the ground: ${g.hits[0].at}`);

  const w = make({ water: () => true });
  w.gun.burst(1);
  run(w.gun, 0.1, -0.3);
  assert.equal(w.hits.length, 0, 'into the water: nothing');
  const sky = make();
  sky.gun.burst(1);
  run(sky.gun, 0.1, 0.5);
  assert.equal(sky.hits.length, 0, 'into the sky: nothing');
  assert.equal(sky.calls.muzzle, 1, 'though it fired');
});

test("the world's ground as a fixed body (its top at groundAt) is the ground, not the scenery's stone", () => {
  // As every world has it: a fixed box whose top is the ground, and groundAt the same
  const bed: SolidBody = { shape: 'box', size: [400, 1, 400], position: [0, -0.5, 0], rotation: [0, 0, 0, 1], hull: null };
  const { gun, camera, hits } = make({ solids: new Solids([bed]), ground: () => 'dirt' });
  gun.trigger(true);
  // Round and round, down at the ground 4–10 m off (grazing hits, where the bed and groundAt tied)
  for (let k = 0; k < 300; k++) {
    camera.rotation.set(-0.25 - 0.1 * Math.sin(k * 0.05), k * 0.01, 0, 'YXZ');
    gun.update(DT, 0);
  }
  assert.ok(hits.length > 40, `${hits.length} rounds`);
  for (const h of hits) {
    assert.equal(h.kind, 'dirt', `on the ground at ${h.at}`);
    assert.ok(Math.abs(h.at[1]) < 1e-6 && h.normal[1] > 0.99, `on its top, facing up: ${h.at}, ${h.normal}`);
  }
  // The scenery standing on it is still stone; the ground where it's water takes them
  const wall: SolidBody = { shape: 'box', size: [4, 4, 1], position: [0, 2, -8], rotation: [0, 0, 0, 1], hull: null };
  const s = make({ solids: new Solids([bed, wall]), ground: () => 'dirt' });
  s.gun.burst(1);
  run(s.gun, 0.1);
  assert.equal(s.hits[0].kind, 'concrete');
  const w = make({ solids: new Solids([bed]), water: () => true });
  w.gun.burst(5);
  run(w.gun, 1, -0.3);
  assert.equal(w.hits.length, 0, 'into the water: nothing');
});

test('casings land on the ground, or on what stands where they fall', () => {
  const { gun, calls, d } = make();
  gun.burst(1);
  run(gun, 0.1);
  assert.equal(calls.casing[0].floor, 0);
  // A floor under the player's right, half a metre up
  d.addBox({ material: 'brick', size: [4, 0.5, 4], position: [1.5, 0.25, -0.5], static: true });
  gun.burst(1);
  run(gun, 0.2);
  assert.equal(calls.casing[1].floor, 0.5);
});

test('switching: the one in hand goes down, then the other comes up, in about 0.3 s; a trigger held through it fires the gun once it is up', () => {
  const d = new Destruction({ world: asWorld(new FakeWorld()), frameBudget: Infinity, materials: { brick: presets.brick() } });
  const camera = new THREE.PerspectiveCamera(70, 16 / 9, 0.05, 600);
  camera.position.set(0, 1.6, 0);
  const launcher = new Launcher(new THREE.Scene(), camera, d, () => 0);
  const gun = new Gun(camera, d, () => 0);
  const weapons = new Weapons([launcher, gun]);
  assert.equal(weapons.current, launcher);
  assert.equal(gun.lowered, 1);
  const rockets: unknown[] = [];
  launcher.onLaunch = (r) => rockets.push(r);
  let shots = 0;
  gun.onShot = () => {
    shots++;
    assert.equal(gun.lowered, 0, 'never while it comes up');
  };
  weapons.select('gun');
  assert.ok(weapons.switching);
  weapons.trigger(true);
  let t = 0;
  for (; weapons.switching && t < 1; t += DT) weapons.update(DT, 0);
  assert.ok(t > 0.25 && t < 0.36, `switched in ${t.toFixed(2)} s`);
  assert.equal(weapons.current, gun);
  assert.equal(launcher.lowered, 1);
  assert.equal(gun.lowered, 0);
  assert.equal(rockets.length, 0);
  for (let k = 0; k < 30; k++) weapons.update(DT, 0);
  assert.ok(shots >= 5, `held through the switch, it fires once up: ${shots} rounds in half a second`);
  weapons.trigger(false);
  // Held through a switch to the launcher: it waits for a click
  weapons.select('launcher');
  weapons.trigger(true);
  for (let k = 0; k < 30; k++) weapons.update(DT, 0);
  assert.equal(weapons.current, launcher);
  assert.equal(rockets.length, 0);
  weapons.trigger(false);
  weapons.select('gun');
  for (let k = 0; k < 30; k++) weapons.update(DT, 0);
  // Back to the last (Q); the wheel goes round
  weapons.swap();
  for (let k = 0; k < 30; k++) weapons.update(DT, 0);
  assert.equal(weapons.current, launcher);
  weapons.cycle(1);
  for (let k = 0; k < 30; k++) weapons.update(DT, 0);
  assert.equal(weapons.current, gun);
  // Changing one's mind halfway: the one going down comes back up
  weapons.select('launcher');
  weapons.update(DT, 0);
  weapons.select('gun');
  for (let k = 0; k < 30; k++) weapons.update(DT, 0);
  assert.equal(weapons.current, gun);
  assert.equal(gun.lowered, 0);
  assert.equal(launcher.lowered, 1);
});

test("a rocket in flight flies on while the launcher is down; the launcher's burst fires at its reload pace", () => {
  const d = new Destruction({ world: asWorld(new FakeWorld()), frameBudget: Infinity, materials: { brick: presets.brick() } });
  d.addBox({ material: 'brick', size: [6, 4, 0.5], position: [0, 2, -40.25] });
  const camera = new THREE.PerspectiveCamera(70, 16 / 9, 0.05, 600);
  camera.position.set(0, 1.6, 0);
  const launcher = new Launcher(new THREE.Scene(), camera, d, () => 0);
  const weapons = new Weapons([launcher, new Gun(camera, d, () => 0)]);
  const blasts: unknown[] = [];
  launcher.onBlast = (b) => blasts.push(b);
  weapons.trigger(true);
  weapons.trigger(false);
  weapons.select('gun');
  for (let k = 0; k < 120 && !blasts.length; k++) weapons.update(DT, 0);
  assert.equal(blasts.length, 1, 'it went off on the wall');
  weapons.select('launcher');
  for (let k = 0; k < 30; k++) weapons.update(DT, 0);
  const launched: unknown[] = [];
  launcher.onLaunch = (r) => launched.push(r);
  weapons.burst(3);
  for (let t = 0; t < 1.6; t += DT) weapons.update(DT, 0);
  assert.equal(launched.length, 3, 'three rockets in 1.6 s (one each 0.75 s)');
});

test("a burst asked for as the gun is taken up fires once it's up; one not fired is dropped when it's put away", () => {
  const d = new Destruction({ world: asWorld(new FakeWorld()), frameBudget: Infinity, materials: { brick: presets.brick() } });
  const camera = new THREE.PerspectiveCamera(70, 16 / 9, 0.05, 600);
  const launcher = new Launcher(new THREE.Scene(), camera, d, () => 0);
  const gun = new Gun(camera, d, () => 0);
  const weapons = new Weapons([launcher, gun]);
  let shots = 0;
  gun.onShot = () => shots++;
  // demo.weapon('gun'); demo.fire(5)
  weapons.select('gun');
  weapons.burst(5);
  for (let t = 0; t < 1; t += DT) weapons.update(DT, 0);
  assert.equal(shots, 5);
  // Put away halfway through one: the rest isn't fired when it's back
  weapons.burst(20);
  for (let t = 0; t < 0.5; t += DT) weapons.update(DT, 0);
  weapons.select('launcher');
  for (let t = 0; t < 0.5; t += DT) weapons.update(DT, 0);
  const fired = shots;
  assert.ok(fired > 5 && fired < 25, `${fired}`);
  weapons.select('gun');
  for (let t = 0; t < 1; t += DT) weapons.update(DT, 0);
  assert.equal(shots, fired);
});

test('the wheel switches once a turn of it: a notch, or a touchpad swipe of many small steps', () => {
  const d = new Destruction({ world: asWorld(new FakeWorld()), frameBudget: Infinity, materials: { brick: presets.brick() } });
  const camera = new THREE.PerspectiveCamera(70, 16 / 9, 0.05, 600);
  const weapons = new Weapons([new Launcher(new THREE.Scene(), camera, d, () => 0), new Gun(camera, d, () => 0)]);
  let time = 0;
  /** Wheel events of `delta` each `every` ms, `n` of them, the weapons going on between them. */
  const turn = (delta: number, n: number, every: number) => {
    for (let i = 0; i < n; i++) {
      weapons.scroll(delta, time);
      for (let t = 0; t < every; t += 1000 * DT) weapons.update(DT, 0);
      time += every;
    }
    // Then a pause, and the switch done
    for (let k = 0; k < 30; k++) weapons.update(DT, 0);
    time += 500;
  };
  // A touchpad: 50 steps of 6 px 16 ms apart (0.8 s): once
  turn(6, 50, 16);
  assert.equal(weapons.current.name, 'gun');
  // A notch back
  turn(-100, 1, 16);
  assert.equal(weapons.current.name, 'launcher');
  // A wheel spun fast (notches 40 ms apart): once
  turn(100, 6, 40);
  assert.equal(weapons.current.name, 'gun');
  // A nudge too small to be a notch: nothing
  turn(20, 1, 16);
  assert.equal(weapons.current.name, 'gun');
});

test('the HUD: each weapon, the one in hand lit (no rounds counted: neither runs dry); written when it changes', () => {
  const d = new Destruction({ world: asWorld(new FakeWorld()), frameBudget: Infinity, materials: { brick: presets.brick() } });
  const camera = new THREE.PerspectiveCamera(70, 16 / 9, 0.05, 600);
  const gun = new Gun(camera, d, () => 0);
  const weapons = new Weapons([new Launcher(new THREE.Scene(), camera, d, () => 0), gun]);
  const el = { innerHTML: '' } as HTMLElement;
  weapons.show(el);
  assert.match(el.innerHTML, /<span class="slot on"><kbd>1<\/kbd>Launcher<\/span>/);
  assert.match(el.innerHTML, /<span class="slot"><kbd>2<\/kbd>Machine gun<\/span>/);
  // Unchanged: not written again
  el.innerHTML = 'kept';
  weapons.show(el);
  assert.equal(el.innerHTML, 'kept');
  weapons.select('gun');
  weapons.show(el);
  assert.match(el.innerHTML, /<span class="slot on"><kbd>2<\/kbd>Machine gun/, 'the one coming up is lit');
  // Firing changes nothing there
  for (let k = 0; k < 30; k++) weapons.update(DT, 0);
  weapons.show(el);
  const shown = el.innerHTML;
  weapons.trigger(true);
  for (let k = 0; k < 60; k++) weapons.update(DT, 0);
  el.innerHTML = 'kept';
  weapons.show(el);
  assert.equal(el.innerHTML, 'kept', `unchanged from ${shown}`);
  assert.doesNotMatch(shown, /rounds|reload/);
});

test("the ground's kind by its step sound: Dust Town's dirt, Brick Street's stone", () => {
  assert.equal(groundKind(western)(0, 0, 0), 'dirt');
  assert.equal(groundKind(western)(30, 0, -20), 'dirt');
  assert.equal(groundKind(nyc)(0, 0, 9), 'concrete', 'the sidewalk');
  assert.equal(groundKind({ audio: { materials: {}, footsteps: { surface: () => 'steps.grass' } } })(0, 0, 0), 'dirt');
  assert.equal(groundKind({ audio: { materials: {} } })(0, 0, 0), 'concrete', 'no steps: stone');
});

test('the world hears the gun: each bullet that strikes, after its strike; each burst as it ends, where most of it struck', () => {
  const { gun } = make();
  const order: string[] = [];
  const shots: BulletHit[] = [];
  const bursts: Burst[] = [];
  const rt = { time: 0 } as WorldRuntime;
  gun.onBurstEnd = () => order.push('echo');
  const world = {
    onShot: (h: BulletHit, r: WorldRuntime) => {
      assert.equal(r, rt);
      order.push('world');
      shots.push(h);
    },
    onBurst: (b: Burst) => {
      order.push('burst');
      bursts.push(b);
    },
  };
  gunHooks(gun, world, rt, () => order.push('strike'));
  // A second at the wall 20 m off, then a quarter of one at the ground a few metres ahead
  gun.trigger(true);
  run(gun, 1);
  run(gun, 0.25, -0.5);
  gun.trigger(false);
  run(gun, DT);
  assert.ok(shots.length >= 16 && shots.length <= 19, `${shots.length} rounds struck`);
  assert.deepEqual(order.slice(0, 4), ['strike', 'world', 'strike', 'world'], 'each strike, then the world');
  assert.deepEqual(order.slice(-2), ['echo', 'burst'], 'the echo, then the world');
  assert.equal(bursts.length, 1);
  const b = bursts[0];
  assert.equal(b.rounds, shots.length);
  assert.ok(Math.abs(b.seconds - 1.25) < 0.05, `${b.seconds} s`);
  // Most struck the wall: the middle is there, not between it and the ground
  assert.ok(b.at && Math.abs(b.at[2] + 20) < 1e-6 && Math.abs(b.at[0]) < 0.5 && b.at[1] > 1 && b.at[1] < 3, `at ${b.at}`);
  // Into the sky: nothing struck, nothing heard but the burst, with nowhere it struck
  gun.burst(3);
  run(gun, 0.5, 0.5);
  assert.equal(shots.length, b.rounds);
  assert.deepEqual(bursts[1], { rounds: 3, at: null, seconds: bursts[1].seconds });
  assert.ok(bursts[1].seconds > 0.1 && bursts[1].seconds < 0.25, `${bursts[1].seconds} s`);
  // A world without the hooks: the gun's own strike and echo all the same
  const plain = make();
  let struck = 0;
  let echoes = 0;
  plain.gun.onBurstEnd = () => echoes++;
  gunHooks(plain.gun, {}, rt, () => struck++);
  plain.gun.burst(3);
  run(plain.gun, 0.5);
  assert.deepEqual([struck, echoes], [3, 1]);
});

test("down in a pit through a breakable ground: its floor strikes as its bed, its sides as the layer there or what the world says; the scenery over it as stone", () => {
  const d = new Destruction({ world: asWorld(new FakeWorld()), frameBudget: Infinity, materials: { asphalt: groundPresets.asphalt(), earth: groundPresets.earth(), gravel: groundPresets.gravel() } });
  // Asphalt 0.3 m over earth 0.6 m on a bed of gravel at -0.9: all of it blown away
  const ground = d.addGround({ material: 'asphalt', under: 'earth', bed: 'gravel', area: [-4, -4, 4, 4], top: 0, depth: 0.3, underDepth: 0.6 });
  for (const p of [...ground.slabs]) d.removePiece(p);
  // The world's ground body under the area, its top the bed; past the area's edge (x 4) the ground
  // beside it, from under the bed up to the top, and a wall standing on it at x 8
  const box = (size: V3, position: V3): SolidBody => ({ shape: 'box', size, position, rotation: [0, 0, 0, 1], hull: null });
  const solids = new Solids([box([8, 1, 8], [0, -1.4, 0]), box([4, 2, 8], [6, -1, 0]), box([1, 3, 8], [8.5, 1.5, 0])]);
  /** A gun in the pit's world, and a round from `eye` at (x, y) on the plane z = 0, toward +x (the spread closed again first). */
  const gunFor = (pitSide?: GunOptions['pitSide']) => {
    const camera = new THREE.PerspectiveCamera(70, 16 / 9, 0.05, 600);
    const gun = new Gun(camera, d, (x, z) => (ground.contains(x, z) ? ground.bed : 0), { solids, ground: () => 'concrete', pitSide });
    gun.lowered = 0;
    const hits: BulletHit[] = [];
    gun.onHit = (h) => hits.push(h);
    return (eye: [number, number], at: [number, number]) => {
      camera.position.set(eye[0], eye[1], 0);
      const aim = () => camera.rotation.set(Math.atan2(at[1] - eye[1], at[0] - eye[0]), -Math.PI / 2, 0, 'YXZ');
      for (let k = 0; k < 60; k++) {
        aim();
        gun.update(DT, 0);
      }
      const n = hits.length;
      gun.burst(1);
      for (let k = 0; k < 20 && hits.length === n; k++) {
        aim();
        gun.update(DT, 0);
      }
      return hits[n];
    };
  };
  const shoot = gunFor();
  const inPit: [number, number] = [0, -0.5];
  const top = shoot(inPit, [4, -0.15]);
  assert.ok(Math.abs(top.at[0] - 4) < 1e-6 && Math.abs(top.at[1] + 0.15) < 0.03, `on the side: ${top.at}`);
  assert.deepEqual([top.piece, top.material, top.kind], [null, 'asphalt', 'concrete'], 'the top layer');
  const under = shoot(inPit, [4, -0.6]);
  assert.deepEqual([under.material, under.kind], ['earth', 'dirt'], 'the layer under it');
  const floor = shoot(inPit, [1, -0.9]);
  assert.ok(Math.abs(floor.at[1] - ground.bed) < 1e-6 && floor.at[0] < 4, `on the floor: ${floor.at}`);
  assert.deepEqual([floor.material, floor.kind], ['gravel', 'dirt'], 'the bed');
  const wall = shoot(inPit, [8, 1]);
  assert.ok(Math.abs(wall.at[0] - 8) < 1e-6, `on the wall: ${wall.at}`);
  assert.deepEqual([wall.material, wall.kind], [null, 'concrete'], "over the ground's top: the scenery's stone");
  // From over the far rim, down at the side: the side, not the rim over it (groundAt steps up there)
  const above = shoot([0, 1.6], [4, -0.15]);
  assert.ok(Math.abs(above.at[0] - 4) < 1e-6 && Math.abs(above.at[1] + 0.15) < 0.03, `on the side: ${above.at}`);
  assert.equal(above.material, 'asphalt');
  // Out of the pit, the world's own ground: of its kind, no material
  const out = shoot([0, 1.6], [6, 0]);
  assert.ok(out.at[0] > 4.5 && Math.abs(out.at[1]) < 1e-6, `on the ground past it: ${out.at}`);
  assert.deepEqual([out.material, out.kind], [null, 'concrete']);
  // Where the world draws the side as something else (a building's footing in concrete from the bed
  // up, a kerb of gravel): what it says, asked with the point and the ground; the floor still the bed
  const asked: Array<[V3, unknown]> = [];
  const said = gunFor((at, g) => (asked.push([at, g]), at[1] > -0.3 ? null : at[1] > -0.5 ? 'gravel' : undefined));
  const footing = said(inPit, [4, -0.15]);
  assert.deepEqual([footing.material, footing.kind], [null, 'concrete'], "null: the scenery's stone");
  assert.ok(Math.abs(asked[0][0][0] - 4) < 1e-6 && asked[0][1] === ground, 'asked where it struck, of that ground');
  const kerb = said(inPit, [4, -0.4]);
  assert.deepEqual([kerb.material, kerb.kind], ['gravel', 'dirt'], 'a material: that');
  assert.equal(said(inPit, [4, -0.7]).material, 'earth', 'nothing: the layer there');
  const asks = asked.length;
  assert.equal(said(inPit, [1, -0.9]).material, 'gravel', 'the floor: the bed');
  assert.equal(asked.length, asks, 'not asked of the floor');
});

test("the water: the world's own, else where it can't be walked and lies low; none without either", () => {
  const sea = waterOf({ water: (x) => x < -10, walkable: () => false, groundAt: () => -5 })!;
  assert.deepEqual([sea(-20, 0), sea(0, 0)], [true, false], 'what the world says, over the guess');
  // Harbor Yard: the harbour past the quay, not the yard
  const harbour = waterOf(harbor)!;
  assert.deepEqual([harbour(0, -60), harbour(0, 10)], [true, false]);
  assert.equal(waterOf({ groundAt: () => -5 }), undefined, 'walkable anywhere: no water');
});
