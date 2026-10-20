import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import * as THREE from 'three/webgpu';
import { Destruction, presets, type V3 } from '../src/lib/index.ts';
import { type Blast, type Kit, Launcher, VIEW_LAYER } from '../src/demo/launcher.ts';
import { type SolidBody, Solids } from '../src/demo/player.ts';
import { asWorld, FakeWorld } from './fake-world.ts';

const DT = 1 / 60;

/** The kit as public/packs/kit has it (its muzzle, rear and rocket length), with stand-in models. */
function packKit(): Kit {
  const index = JSON.parse(readFileSync(new URL('../public/packs/kit/models/index.json', import.meta.url), 'utf8'));
  const box = (size: V3) => new THREE.Mesh(new THREE.BoxGeometry(...size), new THREE.MeshStandardNodeMaterial());
  return { launcher: box(index.launcher.size), rocket: box(index.rocket.size), muzzle: index.launcher.muzzle, rear: index.launcher.rear, length: index.rocket.size[2] };
}

/** A box of the scenery: a fixed body, not a piece. */
const solid = (size: V3, position: V3): SolidBody => ({ shape: 'box', size, position, rotation: [0, 0, 0, 1], hull: null });

interface Setup {
  ground?: (x: number, z: number) => number;
  solids?: Solids;
  kit?: Kit;
}

/** A launcher in a world of `walls` (boxes), the eye at 1.6 m looking down -z, flat ground at 0 unless given. */
function make(walls: Array<{ size: V3; position: V3 }> = [], { ground = () => 0, solids, kit }: Setup = {}) {
  const d = new Destruction({ world: asWorld(new FakeWorld()), frameBudget: Infinity, materials: { brick: presets.brick() } });
  for (const w of walls) d.addBox({ material: 'brick', ...w });
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(70, 16 / 9, 0.05, 600);
  camera.position.set(0, 1.6, 0);
  scene.add(camera);
  const calls: Array<{ kind: string; at: V3 }> = [];
  const effects = {
    sparks: (at: V3) => void calls.push({ kind: 'sparks', at }),
    trail: (at: V3) => void calls.push({ kind: 'trail', at }),
    dust: (at: V3) => void calls.push({ kind: 'dust', at }),
  };
  const player = { shake: 0 };
  const launcher = new Launcher(scene, camera, d, ground, { effects, player, solids, kit });
  const blasts: Blast[] = [];
  const launches: Array<{ rocket: THREE.Object3D; fired: boolean }> = [];
  launcher.onBlast = (b) => blasts.push(b);
  launcher.onLaunch = (rocket, fired) => launches.push({ rocket, fired });
  return { d, scene, camera, launcher, calls, player, blasts, launches };
}

/** The loaded rocket: the view model's second child. */
const loaded = (l: Launcher) => l.view.children[1];

test('a rocket leaves the muzzle slowly, speeds up, and goes off where its path meets a wall', () => {
  const { scene, launcher, blasts, launches } = make([{ size: [6, 4, 0.5], position: [0, 2, -30.25] }]);
  assert.equal(launcher.fire(), true);
  assert.equal(launches.length, 1);
  assert.equal(launches[0].fired, true);
  const rocket = launches[0].rocket;
  assert.equal(rocket.parent, scene);
  const start = rocket.position.clone();
  launcher.update(DT, 0);
  const first = rocket.position.distanceTo(start);
  assert.ok(first > 15 * DT && first < 30 * DT, `first frame ${first / DT} m/s`);
  const steps: number[] = [];
  let last = rocket.position.clone();
  for (let i = 0; i < 120 && !blasts.length; i++) {
    launcher.update(DT, 0);
    steps.push(rocket.position.distanceTo(last) / DT);
    last = rocket.position.clone();
  }
  assert.equal(blasts.length, 1);
  assert.equal(blasts[0].rocket, rocket);
  assert.ok(Math.abs(blasts[0].at[2] + 30) < 0.01, `on the wall's face: ${blasts[0].at}`);
  assert.deepEqual(blasts[0].normal.map(Math.round), [0, 0, 1]);
  assert.ok(Math.max(...steps) > 47 && Math.max(...steps) < 48.5, `top speed ${Math.max(...steps)}`);
  assert.equal(rocket.parent, null);
});

test('one shot per reload: the tube is empty, the next rocket shows ahead of the muzzle and slides in', () => {
  const { launcher } = make();
  const seated = loaded(launcher).position.clone();
  assert.equal(loaded(launcher).visible, true);
  assert.equal(launcher.fire(), true);
  assert.equal(loaded(launcher).visible, false);
  assert.equal(launcher.fire(), false);
  let t = 0;
  const step = () => {
    launcher.update(DT, 0);
    t += DT;
  };
  while (t < 0.3) step();
  assert.equal(loaded(launcher).visible, false);
  assert.equal(launcher.fire(), false);
  while (t < 0.4) step();
  assert.equal(loaded(launcher).visible, true);
  // Ahead of where it sits (the muzzle is toward -z)
  assert.ok(loaded(launcher).position.z < seated.z - 0.05, `${loaded(launcher).position.z} vs ${seated.z}`);
  while (t < 0.76) step();
  assert.ok(loaded(launcher).position.distanceTo(seated) < 1e-6);
  assert.equal(launcher.fire(), true);
});

test('the view model kicks back when fired, dips while reloading, and is back at rest after', () => {
  const { launcher, player } = make();
  for (let i = 0; i < 30; i++) launcher.update(DT, 0);
  const rest = launcher.view.position.clone();
  launcher.fire();
  assert.ok(player.shake > 0.3, 'the view shakes a little');
  launcher.update(DT, 0);
  assert.ok(launcher.view.position.z > rest.z + 0.04, `kicked back: ${launcher.view.position.z - rest.z}`);
  for (let i = 0; i < 27; i++) launcher.update(DT, 0);
  assert.ok(launcher.view.position.y < rest.y - 0.05, `dipped: ${launcher.view.position.y - rest.y}`);
  for (let i = 0; i < 60; i++) launcher.update(DT, 0);
  assert.ok(launcher.view.position.distanceTo(rest) < 0.01, `at rest: ${launcher.view.position.distanceTo(rest)}`);
});

test('a footfall dips the view model, and it settles', () => {
  const { launcher } = make();
  for (let i = 0; i < 30; i++) launcher.update(DT, 0);
  const rest = launcher.view.position.clone();
  launcher.footfall(4);
  let low = 0;
  for (let i = 0; i < 12; i++) {
    launcher.update(DT, 0);
    low = Math.min(low, launcher.view.position.y - rest.y);
  }
  assert.ok(low < -0.004, `dipped ${low}`);
  for (let i = 0; i < 90; i++) launcher.update(DT, 0);
  assert.ok(Math.abs(launcher.view.position.y - rest.y) < 0.004);
});

test('the flash at the muzzle and the back-blast behind the rear', () => {
  const { launcher, calls, camera } = make();
  launcher.fire();
  const sparks = calls.find((c) => c.kind === 'sparks')!;
  const trail = calls.find((c) => c.kind === 'trail')!;
  const dust = calls.find((c) => c.kind === 'dust')!;
  const eye = camera.position;
  // The muzzle well in front of the eye, low and to the right; the rear behind the muzzle, the cloud behind that
  assert.ok(sparks.at[2] < eye.z - 0.6 && sparks.at[0] > 0.05 && sparks.at[1] < eye.y, `${sparks.at}`);
  assert.ok(trail.at[2] > sparks.at[2] + 0.5, `${trail.at}`);
  assert.ok(dust.at[2] > trail.at[2] + 1, `${dust.at}`);
  // The flash shows for a few frames
  const glow = (launcher as unknown as { glow: { value: number } }).glow;
  launcher.update(DT, 0);
  assert.ok(glow.value > 0.5);
  for (let i = 0; i < 6; i++) launcher.update(DT, 0);
  assert.equal(glow.value, 0);
});

test('the flash is drawn only while it shows (and while the shaders warm up)', () => {
  const { launcher } = make();
  const flash = launcher.view.children[2];
  assert.equal(flash.visible, true, 'warming up');
  for (let i = 0; i < 40; i++) launcher.update(DT, 0);
  assert.equal(flash.visible, false, 'idle');
  launcher.fire();
  launcher.update(DT, 0);
  assert.equal(flash.visible, true, 'firing');
  for (let i = 0; i < 6; i++) launcher.update(DT, 0);
  assert.equal(flash.visible, false, 'gone');
});

test('up against a wall, the rocket goes off at the wall, not beyond it', () => {
  const { launcher, blasts, launches } = make([{ size: [4, 4, 0.4], position: [0, 2, -0.6] }]);
  launcher.fire();
  assert.equal(launches.length, 1);
  assert.equal(blasts.length, 1);
  assert.ok(Math.abs(blasts[0].at[2] + 0.4) < 0.01, `${blasts[0].at}`);
  assert.equal(launches[0].rocket.parent, null);
});

/** Fire, step until the rocket goes off (at most 8 s), and return the blast. */
function shoot(launcher: Launcher, blasts: Blast[], dt = DT): Blast {
  launcher.update(dt, 0);
  launcher.fire();
  for (let t = 0; t < 8 && !blasts.length; t += dt) launcher.update(dt, 0);
  assert.equal(blasts.length, 1, 'it went off');
  return blasts[0];
}

test('a rocket that meets nothing goes off on the ground', () => {
  const { launcher, camera, blasts } = make();
  camera.lookAt(0, 0, -12);
  const b = shoot(launcher, blasts);
  assert.ok(Math.abs(b.at[1]) < 1e-9);
  assert.deepEqual(b.normal, [0, 1, 0]);
  assert.ok(Math.hypot(b.at[0], b.at[2] + 12) < 0.1, `${b.at}`);
});

test('rockets go where the crosshair is: walls near and far, at any frame rate', () => {
  for (const kit of [undefined, packKit()])
    for (const far of [10, 30, 60, 120])
      for (const dt of [1 / 30, DT, 1 / 144]) {
        const { launcher, blasts } = make([{ size: [20, 12, 0.5], position: [0, 6, -far - 0.25] }], { kit });
        const b = shoot(launcher, blasts, dt);
        // The crosshair is at (0, 1.6, -far) on the wall's face
        assert.ok(Math.abs(b.at[2] + far) < 0.01, `on the face: ${b.at}`);
        assert.ok(Math.hypot(b.at[0], b.at[1] - 1.6) < 0.05, `${far} m, ${kit ? 'pack' : 'drawn'} kit, 1/${Math.round(1 / dt)} s: ${b.at}`);
      }
});

test('rockets go where the crosshair is: the ground near and far, and a slope', () => {
  for (const far of [5, 30, 60, 90]) {
    const { launcher, camera, blasts } = make([], { kit: packKit() });
    camera.lookAt(0, 0, -far);
    const b = shoot(launcher, blasts);
    assert.ok(Math.hypot(b.at[0], b.at[2] + far) < 0.1, `${far} m: ${b.at}`);
  }
  // Rising 1 in 10 from 10 m out; the crosshair on it at 40 m
  const ground = (_x: number, z: number) => Math.max(0, (-z - 10) * 0.1);
  const { launcher, camera, blasts } = make([], { ground, kit: packKit() });
  camera.lookAt(0, 3, -40);
  const b = shoot(launcher, blasts);
  assert.ok(Math.hypot(b.at[0], b.at[1] - 3, b.at[2] + 40) < 0.1, `${b.at}`);
});

test('the scenery (solids) stops the aim and the rocket as a piece does', () => {
  // A fixed wall 20 m off: the rocket goes off on its face, at the crosshair
  const wall = new Solids([solid([20, 12, 1], [0, 6, -20.5])]);
  const far = make([], { solids: wall });
  const b = shoot(far.launcher, far.blasts);
  assert.ok(Math.abs(b.at[2] + 20) < 0.01 && Math.hypot(b.at[0], b.at[1] - 1.6) < 0.05, `${b.at}`);
  assert.ok(b.normal[2] > 0.999, `${b.normal}`);
  // A fixed wall closer than the muzzle: it goes off there at once
  const near = make([], { solids: new Solids([solid([4, 4, 0.4], [0, 2, -0.8])]) });
  near.launcher.fire();
  assert.equal(near.blasts.length, 1);
  assert.ok(Math.abs(near.blasts[0].at[2] + 0.6) < 0.01, `${near.blasts[0].at}`);
  // Without solids, as before: it flies through
  const none = make([{ size: [20, 12, 0.5], position: [0, 6, -40.25] }]);
  assert.ok(Math.abs(shoot(none.launcher, none.blasts).at[2] + 40) < 0.01);
});

test('a scripted rocket goes off at its target, near or far', () => {
  for (const far of [8, 50]) {
    const { launcher, blasts } = make([{ size: [20, 12, 0.5], position: [0, 6, -far - 0.25] }]);
    launcher.fireFrom(new THREE.Vector3(0.3, 1.3, 0), new THREE.Vector3(-2, 4, -far));
    for (let i = 0; i < 600 && !blasts.length; i++) launcher.update(DT, 0);
    assert.ok(Math.hypot(blasts[0].at[0] + 2, blasts[0].at[1] - 4, blasts[0].at[2] + far) < 0.05, `${blasts[0].at}`);
  }
});

test('scripted rockets: not fired, no reload, no flash, the same flight', () => {
  const { launcher, launches, blasts, calls } = make([{ size: [6, 4, 0.5], position: [0, 2, -20.25] }]);
  launcher.fireFrom(new THREE.Vector3(0, 1.5, 0), new THREE.Vector3(0, 1.5, -20));
  launcher.fireFrom(new THREE.Vector3(1, 1.5, 0), new THREE.Vector3(1, 1.5, -20));
  assert.deepEqual(launches.map((l) => l.fired), [false, false]);
  assert.equal(calls.length, 0);
  assert.equal(loaded(launcher).visible, true);
  for (let i = 0; i < 120 && blasts.length < 2; i++) launcher.update(DT, 0);
  assert.equal(blasts.length, 2);
  assert.ok(blasts.every((b) => Math.abs(b.at[2] + 20) < 0.01));
});

test('the view model is on its own layer, seen by the camera, and draws over the world', () => {
  const { launcher, camera } = make();
  assert.ok(camera.layers.isEnabled(VIEW_LAYER) && camera.layers.isEnabled(0));
  let meshes = 0;
  launcher.view.traverse((o) => {
    assert.equal(o.layers.mask, 1 << VIEW_LAYER);
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    meshes++;
    assert.ok((mesh.material as THREE.NodeMaterial).vertexNode, 'its depth squeezed');
    assert.equal(mesh.castShadow, false);
  });
  assert.ok(meshes > 4);
  assert.equal(launcher.view.parent, camera);
});
