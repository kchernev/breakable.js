import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Destruction, presets } from '../src/lib/index.ts';
import { asWorld, FakeWorld } from './fake-world.ts';

function make(w = new FakeWorld()) {
  const d = new Destruction({ world: asWorld(w), frameBudget: Infinity, materials: { brick: presets.brick(), concrete: presets.concrete(), glass: presets.glass() } });
  return { w, d };
}
const fixed = (d: Destruction) => d.all().filter((p) => p.state === 'fixed');
const volume = (d: Destruction) => d.all().reduce((s, p) => s + p.volume, 0);

test('pieces touching face to face are bonded by the area they share', () => {
  const { d } = make();
  const a = d.addBox({ material: 'brick', size: [2, 1, 0.3], position: [0, 0.5, 0] })!;
  const b = d.addBox({ material: 'brick', size: [1, 1, 0.3], position: [0.5, 1.5, 0] })!;
  const c = d.addBox({ material: 'brick', size: [1, 1, 0.3], position: [5, 0.5, 0] })!;
  assert.equal(a.bonds.size, 1);
  assert.equal(c.bonds.size, 0);
  const bond = [...a.bonds][0];
  assert.equal(bond.other(a), b);
  assert.ok(Math.abs(bond.area - 0.3) < 1e-9, `area ${bond.area}`);
});

test('what reaches the ground through its bonds stands; what does not, falls', () => {
  const { d } = make();
  const wall = d.addBox({ material: 'brick', size: [1, 2, 0.3], position: [0, 1, 0] })!;
  const onTop = d.addBox({ material: 'brick', size: [1, 0.5, 0.3], position: [0, 2.25, 0] })!;
  const floating = d.addBox({ material: 'brick', size: [1, 0.5, 0.3], position: [4, 3, 0] })!;
  d.update(0.016);
  assert.equal(wall.state, 'fixed');
  assert.equal(onTop.state, 'fixed');
  assert.equal(floating.state, 'loose');
});

test('a blast cuts what it reaches into cells, conserving volume less the dust', () => {
  const { d } = make();
  d.addBox({ material: 'brick', size: [4, 3, 0.3], position: [0, 1.5, 0] });
  const before = volume(d);
  const r = d.explode({ at: [0, 1.5, 0.4], radius: 1 });
  assert.equal(r.broken, 1);
  assert.ok(r.made.length >= 4, `made ${r.made.length}`);
  assert.ok(r.loose.length > 0, 'some pieces thrown');
  assert.ok(fixed(d).length > 0, 'the rest still stands');
  assert.ok(Math.abs(volume(d) + r.dust - before) < 1e-4, `volume ${volume(d)} + dust ${r.dust} vs ${before}`);
  // The pieces left standing are still bonded to each other and stand on the ground
  for (const p of fixed(d)) assert.ok(p.bonds.size > 0 || p.bounds.min[1] < 1e-6, 'a standing piece holds on to something');
});

test('a section that loses its support falls whole, its bonds made joints', () => {
  const { w, d } = make();
  const left = d.addBox({ material: 'brick', size: [0.5, 2, 0.5], position: [-1.5, 1, 0] })!;
  const right = d.addBox({ material: 'brick', size: [0.5, 2, 0.5], position: [1.5, 1, 0] })!;
  // A slab on the pillars, and a block on the slab
  const slab = d.addBox({ material: 'concrete', size: [3.5, 0.25, 1], position: [0, 2.125, 0] })!;
  const block = d.addBox({ material: 'brick', size: [0.5, 0.5, 0.5], position: [0, 2.5, 0] })!;
  d.update(0.1);
  assert.equal(slab.state, 'fixed');
  d.removePiece(left);
  d.update(0.1);
  assert.equal(slab.state, 'fixed', 'one pillar still holds it (pressed)');
  d.removePiece(right);
  d.update(0.1);
  assert.equal(slab.state, 'loose');
  assert.equal(block.state, 'loose');
  const slabJoints = w.joints.filter((j) => !j.removed && (j.a === (slab.body as unknown) || j.b === (slab.body as unknown)));
  assert.ok(slabJoints.length >= 1, 'the block and what is left on the slab fall joined to it');
  assert.ok(
    slabJoints.every((j) => (j.options.breakForce as number) > 0),
    'joints break',
  );
});

test('a beam held only at its side stands while its bond can carry it, and falls when it cannot', () => {
  for (const [length, falls] of [
    [1, false],
    [6, true],
  ] as const) {
    const { d } = make();
    d.addBox({ material: 'brick', size: [0.3, 3, 1], position: [0, 1.5, 0] });
    // Bonded to the wall's side over 0.3 x 0.3 m² (sideways: support x area), out from it
    const beam = d.addBox({ material: 'concrete', size: [length, 0.3, 0.3], position: [0.15 + length / 2, 2.5, 0] })!;
    assert.equal(beam.bonds.size, 1);
    for (let k = 0; k < 10; k++) d.update(0.1);
    assert.equal(beam.state, falls ? 'loose' : 'fixed', `a ${length} m beam`);
  }
});

test('a weight on a wall is carried down to the ground, pressed, not sideways', () => {
  const { d } = make();
  const wall = d.addBox({ material: 'brick', size: [1, 3, 0.3], position: [0, 1.5, 0] })!;
  // A heavy block on top: pressed into the wall, which carries far more than it would sideways
  const block = d.addBox({ material: 'concrete', size: [1, 1, 0.3], position: [0, 3.5, 0] })!;
  d.weigh();
  const bond = [...block.bonds][0];
  assert.ok(bond.load > 0 && bond.load < 0.1, `load ${bond.load}`);
  for (let k = 0; k < 5; k++) d.update(0.1);
  assert.equal(wall.state, 'fixed');
  assert.equal(block.state, 'fixed');
});

test('glass shatters out to three times a blast radius', () => {
  const { d } = make();
  const pane = d.addBox({ material: 'glass', size: [1.2, 1.2, 0.03], position: [2.4, 1.6, 0] })!;
  d.addBox({ material: 'brick', size: [1, 1, 0.3], position: [2.4, 0.5, 0] });
  let shards = 0;
  d.on('debris', (e) => e.material === 'glass' && shards++);
  d.on('dust', (e) => e.material === 'glass' && shards++);
  d.explode({ at: [0, 1.6, 0], radius: 1 });
  assert.equal(pane.state, 'gone', 'the pane was broken');
  assert.ok(shards >= 4, `into shards, flying as particles (${shards})`);
});

test('reinforce makes a structure stand as built, and what is undermined still falls', () => {
  const { d } = make();
  d.addBox({ material: 'brick', size: [0.3, 3, 1], position: [0, 1.5, 0] });
  // Too long for its side bond: it would fall at the first weighing
  const beam = d.addBox({ material: 'concrete', size: [6, 0.3, 0.3], position: [3.15, 2.5, 0] })!;
  const strengthened = d.reinforce();
  assert.ok(strengthened >= 1);
  for (let k = 0; k < 5; k++) d.update(0.1);
  assert.equal(beam.state, 'fixed', 'it stands as built');
  // Without the wall it hangs from, nothing holds it
  const wall = d.all().find((p) => p.materialName === 'brick')!;
  d.removePiece(wall);
  for (let k = 0; k < 5; k++) d.update(0.1);
  assert.equal(beam.state, 'loose', 'with the wall gone it falls');
});
