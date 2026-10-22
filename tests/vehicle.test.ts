import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as THREE from 'three/webgpu';
import { WELD } from '../src/lib/destruction.ts';
import { addVehicle, Destruction, presets, type V3, type Vehicle, type VehicleEntry, vehicleModel, vehicleOf, vehiclePresets } from '../src/lib/index.ts';
import { asWorld, type FakeBody, FakeWorld } from './fake-world.ts';

/** A box's corners: its middle and its size. */
const box = (c: V3, s: V3): V3[] => [-1, 1].flatMap((x) => [-1, 1].flatMap((y) => [-1, 1].map((z) => [c[0] + (x * s[0]) / 2, c[1] + (y * s[1]) / 2, c[2] + (z * s[2]) / 2] as V3)));

/**
 * A car of boxes in the cars' frame (facing -z, standing on y = 0): a body (under the waist and a
 * cabin), a front left door hinged at its front edge, the hood at its back edge, a front left
 * wheel, a front bumper; a windscreen on the body, a window in the door; its tank at the back.
 */
const entry: VehicleEntry = {
  file: 'box.glb',
  mass: 1.4,
  triangles: 0,
  parts: [
    { name: 'body', role: 'body', pivot: [0, 0, 0], colliders: [box([0, 0.6, 0], [1.6, 0.8, 4.4]), box([0, 1.2, 0.2], [1.3, 0.4, 2])], mass: 1.2, triangles: 0 },
    { name: 'door.fl', role: 'door', pivot: [-0.85, 0.6, -0.9], axis: [0, 1, 0], collider: box([0, 0, 0.55], [0.06, 0.6, 1.1]), mass: 0.05, triangles: 0 },
    { name: 'hood', role: 'hood', pivot: [0, 1.0, -1.1], axis: [1, 0, 0], collider: box([0, 0.02, -0.6], [1.3, 0.04, 1.2]), mass: 0.035, triangles: 0 },
    { name: 'wheel.fl', role: 'wheel', pivot: [-0.8, 0.33, -1.4], axis: [1, 0, 0], radius: 0.33, collider: box([0, 0, 0], [0.24, 0.66, 0.66]), mass: 0.035, triangles: 0 },
    { name: 'bumper.f', role: 'bumper', pivot: [0, 0.4, -2.25], collider: box([0, 0, 0], [1.7, 0.4, 0.2]), mass: 0.017, triangles: 0 },
  ],
  glass: [
    { name: 'glass.windscreen', on: 'body', points: box([0, 1.2, -0.85], [1.2, 0.3, 0.01]), normal: [0, 0.4, -0.9] },
    { name: 'glass.fl', on: 'door.fl', points: box([-0.85, 1.15, -0.35], [0.01, 0.3, 0.9]), normal: [-1, 0, 0] },
  ],
  fuel: [0, 0.35, 1.2],
};
const model = vehicleModel('box', entry, () => new THREE.Group());

function make(): { w: FakeWorld; d: Destruction; v: Vehicle; events: string[] } {
  const w = new FakeWorld();
  const d = new Destruction({ world: asWorld(w), frameBudget: Infinity, materials: { carbody: vehiclePresets.carbody(), carglass: vehiclePresets.carglass(), tyre: vehiclePresets.tyre(), bumper: vehiclePresets.bumper(), brick: presets.brick() } });
  const events: string[] = [];
  const v = addVehicle(
    d,
    model,
    { position: [5, 0, 2] },
    {
      latch: (_v, part) => events.push(`latch ${part}`),
      torn: (_v, part) => events.push(`torn ${part}`),
      tyre: (_v, wheel) => events.push(`tyre ${wheel}`),
      tank: (_v, _at, holes) => events.push(`tank ${holes}`),
    },
  );
  return { w, d, v, events };
}

const bondTo = (a: { bonds: Set<{ other(p: unknown): unknown; area: number }> }, b: unknown) => [...a.bonds].find((x) => x.other(a) === b);

test('a car stands at rest as one: its parts bonded to its body, its panes welded into what they sit in, all of it the car', () => {
  const { v } = make();
  assert.equal(v.body.state, 'rubble');
  assert.deepEqual([...v.parts.keys()].sort(), ['body', 'bumper.f', 'door.fl', 'hood', 'wheel.fl']);
  for (const [name, p] of v.parts) {
    assert.equal(p.state, 'rubble', name);
    assert.equal(vehicleOf(p), v);
    if (name !== 'body') assert.ok(bondTo(p, v.body) && bondTo(p, v.body)!.area < WELD, `${name} bonded to the body, breakably`);
  }
  // The panes: glass at rest, welded in (only breaking takes one out)
  const screen = v.panes.get('glass.windscreen')!;
  const window = v.panes.get('glass.fl')!;
  assert.equal(screen.state, 'rubble');
  assert.equal(screen.materialName, 'carglass');
  assert.ok(bondTo(screen, v.body)!.area >= WELD);
  assert.ok(bondTo(window, v.parts.get('door.fl'))!.area >= WELD);
  assert.equal(v.partOf(window), 'glass.fl');
  // The body's cabin, a hull welded to it, is the body
  const cabin = [...v.body.bonds].find((b) => b.area >= WELD && b.other(v.body).prop === v.body.prop)!.other(v.body);
  assert.equal(v.partOf(cabin), 'body');
  assert.equal(vehicleOf(cabin), v);
  // Where it was put: its frame is the car's (the tank where the model has it)
  const tank = v.toWorld(model.fuel);
  assert.ok(Math.hypot(tank[0] - 5, tank[1] - 0.35, tank[2] - 3.2) < 1e-6, `${tank}`);
});

test("a car's pieces don't collide with each other (its hulls overlap), only with the rest; the next car's are apart", () => {
  const { d, v } = make();
  const pieces = [...v.parts.values(), ...v.panes.values(), ...[...v.body.bonds].filter((b) => b.area >= WELD).map((b) => b.other(v.body))];
  const group = (v.body.body as unknown as FakeBody).group;
  for (const p of pieces) {
    const b = p.body as unknown as FakeBody;
    assert.equal(b.group, group);
    assert.equal(b.collidesWith & group, 0, 'not with its own');
    assert.equal((b.collidesWith | group) >>> 0, 0xffffffff, 'with all else');
  }
  const other = addVehicle(d, model, { position: [-5, 0, 2] });
  assert.notEqual((other.body.body as unknown as FakeBody).group, group);
});

test("a few rounds into a door spring its latch: it swings open on its hinge, its window with it; the hood pops on the hinge at its back", () => {
  const { v, events } = make();
  const door = v.parts.get('door.fl')!;
  let n = 0;
  while (!v.open.has('door.fl') && n < 20) {
    v.shot({ piece: door, at: [4.15, 0.6, 1.5], direction: [1, 0, 0] });
    n++;
  }
  assert.ok(n >= 5 && n <= 9, `${n} rounds`);
  assert.deepEqual(events, ['latch door.fl']);
  assert.equal(bondTo(door, v.body), undefined, 'the latch has gone');
  assert.equal(door.state, 'loose', 'it swings');
  // Out, though the rounds went in (the left door: toward -x)
  const impulse = (door.body as unknown as FakeBody).impulses.at(-1)!;
  assert.ok(impulse[0] < 0 && Math.abs(impulse[1]) < 1e-9, `pushed ${impulse}`);
  assert.ok(bondTo(v.panes.get('glass.fl')!, door), 'its window goes with it');
  assert.equal(v.off.has('door.fl'), false, 'still on its hinge');
  // The hood: open, its hinge at its back edge
  v.unlatch('hood');
  assert.equal(v.parts.get('hood')!.state, 'loose');
  assert.ok(v.open.has('hood') && !v.off.has('hood'));
});

test('a round into a tyre lets it down: the wheel made again on its flat tyre (squashed onto the road), still on the car', () => {
  const { v, events } = make();
  const wheel = v.parts.get('wheel.fl')!;
  v.shot({ piece: wheel, at: [4.08, 0.33, 0.6], direction: [1, 0, 0] });
  assert.deepEqual(events, ['tyre wheel.fl']);
  assert.equal(wheel.state, 'gone');
  const flat = v.parts.get('wheel.fl')!;
  assert.notEqual(flat, wheel);
  assert.equal(flat.prop?.name, 'box.wheel.fl.flat');
  assert.ok(bondTo(flat, v.body), 'bonded to the body as the wheel was');
  // Its hull's bottom up off the road by the let-down tyre (the car settles onto it)
  assert.ok(Math.abs(flat.bounds.min[1] - 0.08) < 1e-6, `${flat.bounds.min[1]}`);
  // Its look squashed: what's under the sunk rim pressed flat, the tyre wider there
  const look = new THREE.Group();
  look.add(new THREE.Mesh(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute([0.1, -0.33, 0, 0.1, 0.33, 0, 0.1, -0.1, 0.2], 3))));
  const squashed = vehicleModel('box', entry, (n) => (n === 'wheel.fl' ? look : new THREE.Group())).flats['wheel.fl'].object;
  const p = ((squashed.children[0] as THREE.Mesh).geometry.getAttribute('position') as THREE.BufferAttribute).array;
  assert.ok(Math.abs(p[1] + 0.25) < 1e-6 && p[0] > 0.11, `the bottom: ${p.slice(0, 3)}`);
  assert.deepEqual([...p.slice(3, 6)], [0.1, 0.33, 0].map(Math.fround), 'the top as it was');
  assert.equal(((look.children[0] as THREE.Mesh).geometry.getAttribute('position') as THREE.BufferAttribute).array[1], Math.fround(-0.33), 'the wheel itself untouched');
  // Shot again: nothing more
  v.shot({ piece: flat, at: [4.08, 0.33, 0.6], direction: [1, 0, 0] });
  assert.equal(events.length, 1);
});

test('a tyre let down as the car flies: the flat wheel goes on as the wheel went, held to the body by a joint (not left in the air)', () => {
  const { w, d, v } = make();
  d.push(v.body, [0, 8, 0]);
  const wheel = v.parts.get('wheel.fl')!;
  assert.equal(wheel.state, 'loose');
  const velocity = [...wheel.body.velocity];
  wheel.body.set({ angularVelocity: [0, 0, 3] });
  v.shot({ piece: wheel, at: [4.08, 0.33, 0.6], direction: [1, 0, 0] });
  const flat = v.parts.get('wheel.fl')!;
  assert.notEqual(flat, wheel);
  assert.equal(flat.state, 'loose');
  assert.deepEqual([...flat.body.velocity], velocity);
  assert.deepEqual([...flat.body.angularVelocity], [0, 0, 3]);
  const bond = bondTo(flat, v.body) as { joint: unknown } | undefined;
  assert.ok(bond?.joint, 'held by a joint');
  assert.ok(w.joints.some((j) => !j.removed && [j.a, j.b].includes(flat.body as unknown as FakeBody) && [j.a, j.b].includes(v.body.body as unknown as FakeBody)));
});

test('a round on through the car past its tank holes it; one wide of it only holes the panel', () => {
  const { v, events } = make();
  // From the side, low, through the body at the back: the tank's in its way
  v.shot({ piece: v.body, at: [4.2, 0.35, 3.2], direction: [1, 0, 0] });
  assert.deepEqual(events, ['tank 1']);
  // High up the side: over it
  v.shot({ piece: v.body, at: [4.2, 1.0, 3.2], direction: [1, 0, 0] });
  // Into the front: nowhere near it
  v.shot({ piece: v.body, at: [4.2, 0.35, 0.5], direction: [1, 0, 0] });
  assert.deepEqual(events, ['tank 1']);
  v.shot({ piece: v.body, at: [5, 0.6, 4.2], direction: [0, -0.2, -1] });
  assert.deepEqual(events, ['tank 1', 'tank 2']);
});

test('a blast tears off what of the car is nearest it, springs the latches further off, lets its tyres down in its heart', () => {
  const { v, events } = make();
  // In front of it, low: the bumper and the hood go; the door and the wheel nearer the middle
  v.blast([5, 0.5, -1.2], 2.3);
  assert.ok(v.off.has('bumper.f') && v.off.has('hood'), `off: ${[...v.off]}`);
  assert.ok(v.open.has('door.fl'));
  assert.ok(v.flat.has('wheel.fl'));
  assert.ok(events.includes('torn bumper.f') && events.includes('torn hood') && events.includes('latch door.fl') && events.includes('tyre wheel.fl'), `${events}`);
  for (const name of ['bumper.f', 'hood']) assert.equal(bondTo(v.parts.get(name)!, v.body), undefined, `${name} off the body`);
});

test("a round that strikes the car through one of its panes (glass a hull round it hides: the cabin's, a framed door's) breaks the glass", () => {
  const { v } = make();
  const screen = v.panes.get('glass.windscreen')!;
  // From the front, into the cabin's hull just behind the windscreen
  v.shot({ piece: v.body, at: [5, 1.2, 1.2], direction: [0, 0, 1] });
  assert.equal(screen.state, 'gone');
  // Into the side, nowhere near a pane: the door's window stays
  v.shot({ piece: v.parts.get('door.fl')!, at: [4.15, 0.5, 1.5], direction: [1, 0, 0] });
  assert.notEqual(v.panes.get('glass.fl')!.state, 'gone');
});

test('burnt out: every piece of it black', () => {
  const { v } = make();
  v.burn();
  for (const p of [...v.parts.values(), ...v.panes.values()]) assert.ok(p.tint.every((c) => c < 0.02), `${v.partOf(p)} ${p.tint}`);
  assert.equal(v.burnt, true);
});
