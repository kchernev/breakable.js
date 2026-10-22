import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as THREE from 'three/webgpu';
import { along, blown, Fall, first, reach } from '../src/demo/birds.ts';
import type { Round } from '../src/demo/gun.ts';
import { Gulls } from '../src/demo/worlds/harbor/gulls.ts';
import type { WorldRuntime } from '../src/demo/worlds/types.ts';
import type { V3 } from '../src/lib/index.ts';

const DT = 1 / 60;

/** A round from `from` toward `to`, going `reach` m. */
function round(from: V3, to: V3, reach = 400): Round {
  const d = new THREE.Vector3(...to).sub(new THREE.Vector3(...from)).normalize();
  return { from, direction: d.toArray() as V3, reach };
}

test('a round strikes a bird it passes close enough to, before what it struck; not one wide of it, beyond what it struck or behind the eye', () => {
  // Up at 45° from the eye; a bird 0.3 m off its line, 14 m along it
  const r = round([0, 1.6, 0], [0, 21.6, -20]);
  const bird = new THREE.Vector3(0.3, 11.6, -10);
  const t = along(r, bird, 0.5);
  assert.ok(t !== null && Math.abs(t - Math.hypot(10, 10)) < 1e-6, `${t}`);
  assert.equal(along(r, bird, 0.2), null, 'wide of it');
  assert.equal(along({ ...r, reach: 10 }, bird, 0.5), null, 'beyond the wall it struck');
  assert.equal(along(r, new THREE.Vector3(0, -8.4, 10), 0.5), null, 'behind the eye');
  // The nearest of those in its way (none: -1); the shot ones (null) aren't there to strike
  assert.equal(first(r, [null, new THREE.Vector3(0, 16.6, -15), bird, new THREE.Vector3(5, 5, 5)], 0.5), 2);
  assert.equal(first(r, [new THREE.Vector3(5, 5, 5), null], 0.5), -1);
  // A pigeon is struck within half a metre of its middle, a gull further
  assert.ok(reach(0.68) > 0.45 && reach(0.68) < 0.55 && reach(1.4) > reach(0.68), `${reach(0.68)} ${reach(1.4)}`);
});

test('a blast blows the birds near it out of the air: away from it and up, harder the nearer', () => {
  const birds = [new THREE.Vector3(2, 10, 0), new THREE.Vector3(0, 10, 4), new THREE.Vector3(0, 10, 20), null];
  const out = blown([0, 10, 0], 2.3, birds);
  assert.deepEqual(
    out.map((o) => o.i),
    [0, 1],
    'within 2.5 times its radius',
  );
  assert.ok(out[0].push.x > 0 && Math.abs(out[0].push.z) < 1e-9 && out[0].push.y > 0, 'away and up');
  assert.ok(out[1].push.z > 0);
  assert.ok(out[0].push.length() > out[1].push.length(), 'the nearer, the harder');
});

test('a bird shot falls, tumbling, onto what is under it and lies there on its side; if that goes, it falls again', () => {
  let roof = true;
  // A roof at 6 m over x under 5 m; else the ground
  const floor = (at: V3) => (roof && at[0] < 5 && at[1] >= 6 ? 6 : 0);
  const forward = new THREE.Vector3(0, 0, 1);
  const f = new Fall(new THREE.Vector3(0, 20, 0), new THREE.Vector3(5, 0, 0), new THREE.Quaternion(), new THREE.Vector3(0, 0, -2), forward, 1.35, 0.05);
  // Some of its own speed, and the round's push
  assert.deepEqual(f.v.toArray(), [3, 0, -2]);
  const turned = f.q.clone();
  let t = 0;
  while (!f.down && t < 5) {
    f.update(DT, floor);
    t += DT;
  }
  assert.ok(f.down, 'it landed');
  assert.ok(t > 1.4 && t < 2.2, `in ${t.toFixed(2)} s from 14 m over the roof`);
  assert.ok(Math.abs(f.at.y - 6.05) < 1e-9 && f.at.x < 5, `on the roof: ${f.at.toArray()}`);
  assert.ok(turned.angleTo(new THREE.Quaternion()) < 1e-9 && f.q.angleTo(turned) > 0.5, 'it tumbled as it fell');
  // Lying: its length level, its back to one side
  const length = forward.clone().applyQuaternion(f.q);
  const up = new THREE.Vector3(0, 1, 0).applyQuaternion(f.q);
  assert.ok(Math.abs(length.y) < 1e-6 && Math.abs(length.length() - 1) < 1e-6, `level: ${length.toArray()}`);
  assert.ok(Math.abs(up.y - Math.cos(1.35)) < 1e-6, `on its side: ${up.toArray()}`);
  // It stays there
  const lay = f.at.clone();
  for (let k = 0; k < 120; k++) f.update(DT, floor);
  assert.ok(f.down && f.at.equals(lay));
  // The roof gone: it falls on, to the ground
  roof = false;
  for (let k = 0; k < 180 && f.at.y > 0.06; k++) f.update(DT, floor);
  assert.ok(f.down && Math.abs(f.at.y - 0.05) < 1e-9, `on the ground: ${f.at.y}`);
});

test('one shot where it sits, pushed up and off its perch, falls past it: not straight back onto it', () => {
  // A rail 10 m up, 0.3 m across; the bird's feet on it
  const floor = (at: V3) => (Math.abs(at[0]) < 0.15 && at[1] >= 10 ? 10 : 0);
  const f = new Fall(new THREE.Vector3(0, 10, 0), new THREE.Vector3(), new THREE.Quaternion(), new THREE.Vector3(2, 1.5, 0), new THREE.Vector3(0, 0, 1), 1.35, 0.05);
  for (let k = 0; k < 300 && !f.down; k++) f.update(DT, floor);
  assert.ok(f.down && Math.abs(f.at.y - 0.05) < 1e-9 && f.at.x > 1, `in the street: ${f.at.toArray()}`);
});

test("Harbor Yard: a gull shot on its perch drops in a puff of feathers, with the hit and its cry, and lies where it landed; the others still scatter, it doesn't", () => {
  const scene = new THREE.Scene();
  const gulls = new Gulls(scene, 3, 0, () => 0.5);
  gulls.settle([
    [0, 5, -10],
    [6, 5, -10],
    [12, 5, -10],
  ]);
  const bodies = scene.children[0] as THREE.InstancedMesh;
  const where = (i: number) => new THREE.Vector3().setFromMatrixPosition(bodies.getMatrixAt(i, new THREE.Matrix4()) as unknown as THREE.Matrix4);
  const played: string[] = [];
  const feathers: V3[] = [];
  const rt = { time: 0, effects: { feathers: (at: V3) => void feathers.push(at) }, sound: { play: (name: string) => void played.push(name) } } as unknown as WorldRuntime;
  const ground = () => 0;
  // Wide of it: nothing
  gulls.shoot(round([0, 1.6, 0], [3, 5.07, -10]), rt);
  assert.deepEqual(played, []);
  // At its middle (it sits on the bollard's top at 5 m)
  gulls.shoot(round([0, 1.6, 0], [0, 5.07, -10]), rt);
  assert.deepEqual(played, ['bird.hit', 'gulls.call']);
  assert.equal(feathers.length, 1);
  assert.ok(Math.abs(feathers[0][1] - 5.07) < 1e-9);
  // Shot again where it was: it's no longer there to strike
  gulls.shoot(round([0, 1.6, 0], [0, 5.07, -10]), rt);
  assert.equal(played.length, 2);
  let time = 0;
  const run = (seconds: number) => {
    for (let t = 0; t < seconds; t += DT) gulls.update(DT, (time += DT), () => true, ground);
  };
  let landed: V3 | null = null;
  gulls.onLanded = (at) => (landed = at);
  run(2);
  assert.ok(landed, 'it landed');
  const lying = where(0);
  assert.ok(Math.abs(lying.y - 0.07) < 1e-6, `down on the ground: ${lying.toArray()}`);
  // A blast: the other two go up, it stays where it lies
  gulls.scatter([0, 0, -5], time, () => 0.5);
  run(3);
  assert.ok(where(0).equals(lying));
  assert.ok(where(1).y > 6 && where(2).y > 6, 'the others are up');
  for (let k = 0; k < 20; k++) assert.ok(!gulls.flying(Math.random)?.every((v, i) => v === lying.toArray()[i]), "its calls don't come from the dead one");
});
