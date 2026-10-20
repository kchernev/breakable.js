import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import { place, RATE } from '../scripts/assets/sound-cut.mjs';
import type { MaterialKind } from '../src/lib/index.ts';

type Entry = { src: string[]; duration: number[]; play?: { pitch?: [number, number] } };

test('the base pack has every sound the gun and its bullets play, each with its files', () => {
  const index: Record<string, Entry> = JSON.parse(readFileSync('public/sounds/index.json', 'utf8'));
  // A strike for every kind DestructionSounds.bullet plays (a kind added to MaterialKind fails here
  // until it's listed), and what the demo plays for the gun; its reload and dry click stay in the
  // pack for a world's own use (the demo's gun never runs dry)
  const kinds = Object.keys({ brick: 1, concrete: 1, metal: 1, wood: 1, glass: 1, dirt: 1 } satisfies Record<MaterialKind, 1>);
  const names = [...kinds.map((k) => `bullet.${k}`), 'bullet.ricochet', 'gun.shot', 'gun.tail', 'gun.reload', 'gun.empty', 'casing.drop'];
  for (const name of names) {
    const e = index[name];
    assert.ok(e && e.src.length > 0, `${name} has files`);
    assert.equal(e.duration.length, e.src.length, name);
    for (const f of e.src) assert.ok(existsSync(`public/sounds/${f}`), f);
  }
  // A stream of strikes needs a few of each, so the same one doesn't come back every few rounds
  for (const k of kinds) assert.ok(index[`bullet.${k}`].src.length >= 8, `bullet.${k}: ${index[`bullet.${k}`].src.length} files`);
  // The reload's moves are laid on a 2 s reload (docs/changelog/phase-e/gunsounds.md): over within it, never pitched
  assert.ok(Math.max(...index['gun.reload'].duration) < 2);
  assert.deepEqual(index['gun.reload'].play?.pitch, [1, 1]);
});

test("process-sounds' parts lay a take's moves out anew, each where it's asked for", () => {
  // Clicks at 0.1, 0.5 and 0.8 s
  const n = RATE;
  const ch = [new Float32Array(n), new Float32Array(n)];
  for (const t of [0.1, 0.5, 0.8]) for (let i = 0; i < 200; i++) ch[0][Math.round(t * RATE) + i] = ch[1][Math.round(t * RATE) + i] = 0.5;
  const first = (c: Float32Array) => c.findIndex((v) => v > 0.25) / RATE;
  // The first click 50 ms in, the last right after it, the middle one left out; past the end is the end
  const out = place(ch, [[0.05, 0.2, 0], [0.75, 2, 0.2]]);
  assert.equal(out.length, 2);
  assert.ok(Math.abs(out[0].length / RATE - 0.45) < 1e-3, `${out[0].length / RATE} s`);
  assert.ok(Math.abs(first(out[0]) - 0.05) < 0.006);
  assert.ok(Math.abs(first(out[0].subarray(Math.round(0.2 * RATE))) - 0.05) < 0.006);
  let loud = 0;
  for (const v of out[1]) if (v > 0.25) loud++;
  assert.equal(loud, 2 * 200, 'two whole clicks: the fades are at the cuts, away from them');
});
