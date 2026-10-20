import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as THREE from 'three/webgpu';
import { onset, RATE, slices } from '../scripts/assets/sound-cut.mjs';
import { DemoAudio } from '../src/demo/audio.ts';
import type { Launcher } from '../src/demo/launcher.ts';
import type { Player } from '../src/demo/player.ts';
import type { WorldDefinition } from '../src/demo/worlds/types.ts';
import { Destruction, DestructionSounds, packMaterials, presets, type PlayOptions, SoundEngine, type SoundOptions, type V3 } from '../src/lib/index.ts';
import { asWorld, FakeBody, FakeWorld } from './fake-world.ts';

/** A SoundEngine that only remembers what it was asked to play. */
function fakeEngine() {
  const plays: Array<{ name: string } & PlayOptions> = [];
  const engine = {
    context: { currentTime: 0 },
    listener: { position: [0, 1.6, -10] },
    play: (name: string, o: PlayOptions = {}) => {
      plays.push({ name, ...o });
      return null;
    },
    duck: () => {},
    deafen: () => {},
  };
  return { engine: engine as unknown as SoundEngine & { context: { currentTime: number } }, plays };
}

function make() {
  const w = new FakeWorld();
  const d = new Destruction({ world: asWorld(w), frameBudget: Infinity, materials: { brick: presets.brick(), glass: presets.glass() } });
  const { engine, plays } = fakeEngine();
  const sounds = new DestructionSounds(engine, d, { materials: packMaterials });
  return { w, d, engine, plays, sounds };
}

test('light loose pieces report their contacts only while something listens for impacts', () => {
  const w = new FakeWorld();
  const d = new Destruction({ world: asWorld(w), materials: { brick: presets.brick() } });
  const quiet = d.addBox({ material: 'brick', size: [0.3, 0.3, 0.3], position: [0, 5, 0], loose: true })!;
  assert.equal(quiet.body.reportContacts, false);
  const { engine } = fakeEngine();
  new DestructionSounds(engine, d, { materials: packMaterials });
  const heard = d.addBox({ material: 'brick', size: [0.3, 0.3, 0.3], position: [2, 5, 0], loose: true })!;
  assert.equal(heard.body.reportContacts, true);
});

test('a loose piece striking the ground is heard where it struck, harder strikes louder', () => {
  const { w, d, plays, sounds } = make();
  const a = d.addBox({ material: 'brick', size: [0.3, 0.3, 0.3], position: [0, 5, 0], loose: true })!;
  const b = d.addBox({ material: 'brick', size: [0.3, 0.3, 0.3], position: [9, 5, 0], loose: true })!;
  const ground = new FakeBody(w, 999, { fixed: true });
  const mass = a.volume * a.material.density;
  w.contact({ a: a.body as unknown as FakeBody, b: ground, point: [0, 0, 0], impulse: mass * 2 });
  w.contact({ a: b.body as unknown as FakeBody, b: ground, point: [9, 0, 0], impulse: mass * 6 });
  sounds.update();
  assert.equal(plays.length, 2);
  const [soft, hard] = [plays.find((p) => p.at![0] < 4)!, plays.find((p) => p.at![0] > 4)!];
  assert.ok(soft.name.startsWith('brick.impact'));
  assert.ok(hard.volume! > soft.volume!, `${hard.volume} > ${soft.volume}`);
  // Too slow to be heard
  w.contact({ a: a.body as unknown as FakeBody, b: ground, point: [0, 0, 0], impulse: mass * 0.3 });
  sounds.update();
  assert.equal(plays.length, 2);
});

test('a piece bouncing is heard once, and a readback of impacts keeps their timing', () => {
  const { w, d, engine, plays, sounds } = make();
  const a = d.addBox({ material: 'brick', size: [0.3, 0.3, 0.3], position: [0, 5, 0], loose: true })!;
  const b = d.addBox({ material: 'brick', size: [0.3, 0.3, 0.3], position: [20, 5, 0], loose: true })!;
  const ground = new FakeBody(w, 999, { fixed: true });
  const hit = (p: typeof a, step: number) => w.contact({ a: p.body as unknown as FakeBody, b: ground, point: p.pose.position, impulse: 1, step });
  hit(a, 100);
  hit(a, 102);
  hit(b, 106);
  sounds.update();
  assert.equal(plays.length, 2);
  const delayB = plays.find((p) => p.at![0] > 10)!.delay!;
  assert.ok(Math.abs(delayB - 6 * w.dt) < 1e-9, `delay ${delayB}`);
  // Later, the same piece is heard again
  engine.context.currentTime = 1;
  hit(a, 200);
  sounds.update();
  assert.equal(plays.length, 3);
});

test("a blast's many breaks and shards are heard as a few sounds, the shards where and when they land", () => {
  const { d, plays, sounds } = make();
  d.addBox({ material: 'brick', size: [4, 3, 0.3], position: [0, 1.5, 0] });
  // A pane far enough off to shatter into shards rather than dust
  d.addBox({ material: 'glass', size: [2, 2, 0.02], position: [4.5, 3, 0] });
  let events = 0;
  for (const e of ['fracture', 'debris', 'dust'] as const) d.on(e, () => events++);
  d.explode({ at: [0, 2.5, 0.4], radius: 2 });
  sounds.update();
  assert.ok(events > 10, `${events} events`);
  assert.ok(plays.length > 0 && plays.length < events, `${plays.length} sounds for ${events} events`);
  const per = new Map<string, number>();
  for (const p of plays) per.set(p.name, (per.get(p.name) ?? 0) + 1);
  for (const [name, n] of per) assert.ok(n <= sounds.most, `${name}: ${n}`);
  assert.ok(per.has('glass.shatter'));
  const shards = plays.filter((p) => p.name === 'glass.debris');
  assert.ok(shards.length > 0);
  for (const s of shards) {
    assert.ok(s.delay! > 0.2, `lands after ${s.delay} s`);
    assert.equal(s.at![1], 0);
  }
});

test("a world pack's own play settings win over the library's, and the base pack plays as before", async () => {
  const { readFile } = await import('node:fs/promises');
  const { loadSoundPack, packSettings } = await import('../src/lib/index.ts');
  const real = globalThis.fetch;
  globalThis.fetch = (async (url: string) => new Response(await readFile(`public/${url.replace(/^\//, '')}`))) as typeof fetch;
  try {
    const load = async (base: string) => {
      let defs: Record<string, SoundOptions> = {};
      await loadSoundPack({ load: async (d: Record<string, SoundOptions>) => void (defs = d) } as unknown as SoundEngine, { base });
      return defs;
    };
    // The base pack: as the old order (index, then packSettings) had it
    const index = JSON.parse(await readFile('public/sounds/index.json', 'utf8'));
    const base = await load('sounds/');
    for (const [name, e] of Object.entries<{ src: string[]; kind: string; space: 'world' | 'head'; play?: object }>(index)) {
      assert.deepEqual(base[name], { space: e.space, loop: e.kind === 'loop', ...e.play, ...packSettings[name], src: e.src.map((f) => `sounds/${f}`) });
    }
    // Neon Alley's city loop is its own, at its own level
    const neon = await load('packs/neon/sounds/');
    assert.equal(packSettings['ambience.city'].volume, 0.35);
    assert.equal(neon['ambience.city'].volume, 0.3);
  } finally {
    globalThis.fetch = real;
  }
});

test('a material plays shared sounds at its own pitch, apart from the material it shares them with', () => {
  const w = new FakeWorld();
  const d = new Destruction({ world: asWorld(w), frameBudget: Infinity, materials: { brick: presets.brick(), stone: presets.brick() } });
  const { engine, plays } = fakeEngine();
  const sounds = new DestructionSounds(engine, d, { materials: { brick: packMaterials.brick, stone: { ...packMaterials.brick, pitch: { break: 0.8 } } } });
  d.addBox({ material: 'brick', size: [2, 2, 0.3], position: [-1, 1, 0] });
  d.addBox({ material: 'stone', size: [2, 2, 0.3], position: [1, 1, 0] });
  d.explode({ at: [0, 1, 0.4], radius: 2 });
  sounds.update();
  const breaks = plays.filter((p) => p.name === 'brick.break');
  assert.ok(breaks.some((p) => p.pitch === 1) && breaks.some((p) => Math.abs(p.pitch! - 0.8) < 1e-9), JSON.stringify(breaks.map((p) => p.pitch)));
  // Kinds not listed play as they are
  for (const p of plays.filter((p) => p.name === 'brick.debris')) assert.equal(p.pitch, 1);
});

test("a material's own heavy threshold picks its heavy impact", () => {
  const w = new FakeWorld();
  const d = new Destruction({ world: asWorld(w), materials: { tin: presets.metal() } });
  const { engine, plays } = fakeEngine();
  const sounds = new DestructionSounds(engine, d, { materials: { tin: { impact: 'metal.impact.small', heavyImpact: 'metal.impact.large', heavy: 0.01 } } });
  const panel = d.addBox({ material: 'tin', size: [1, 1, 0.004], position: [0, 5, 0], loose: true })!;
  const mass = panel.volume * panel.material.density;
  assert.ok(mass > 0.01 && mass < 0.25, `mass ${mass}`);
  w.contact({ a: panel.body as unknown as FakeBody, b: new FakeBody(w, 999, { fixed: true }), point: [0, 0, 0], impulse: mass * 6 });
  sounds.update();
  assert.deepEqual(plays.map((p) => p.name), ['metal.impact.large']);
});

test("a section landing whole is heard once, as its material's land sound, louder for more mass", async () => {
  /** Two blocks bonded, one on the other, standing on nothing: they fall as one section and touch down. */
  const fall = async (size: number) => {
    const w = new FakeWorld();
    const d = new Destruction({ world: asWorld(w), frameBudget: Infinity, materials: { brick: presets.brick() } });
    const { engine, plays } = fakeEngine();
    // Just its strikes and landing (no collapse sounds)
    const sounds = new DestructionSounds(engine, d, { materials: { brick: { impact: 'brick.impact.small', heavyImpact: 'brick.impact.large', land: 'concrete.impact' } } });
    const ground = w.addBox({ fixed: true });
    const pair = [0, 1].map((k) => d.addBox({ material: 'brick', size: [2 * size, size, size], position: [0, 5 + size * (k + 0.5), 0] })!);
    d.update(0.016);
    assert.ok(pair.every((p) => p.state === 'loose' && p.bonds.size > 0), 'falling as one');
    for (const p of pair) w.contact({ a: p.body as unknown as FakeBody, b: ground, impulse: p.volume * p.material.density * 6, point: [0, 0, 0] });
    d.update(0.2);
    for (let k = 0; k < 5; k++) await new Promise((r) => setImmediate(r));
    sounds.update();
    return plays;
  };
  const light = await fall(0.2);
  assert.deepEqual(light.map((p) => p.name), ['concrete.impact'], 'once, and not each brick striking');
  // Eight times the mass
  const heavy = await fall(0.4);
  assert.deepEqual(heavy.map((p) => p.name), ['concrete.impact']);
  assert.ok(heavy[0].volume! > light[0].volume! && heavy[0].pitch! < light[0].pitch!, 'heavier: louder and lower');
});

test("without a land sound, a section's pieces are heard striking as before", async () => {
  const w = new FakeWorld();
  const d = new Destruction({ world: asWorld(w), frameBudget: Infinity, materials: { brick: presets.brick() } });
  const { engine, plays } = fakeEngine();
  const sounds = new DestructionSounds(engine, d, { materials: { brick: { impact: 'brick.impact.small', heavyImpact: 'brick.impact.large' } } });
  const ground = w.addBox({ fixed: true });
  const a = d.addBox({ material: 'brick', size: [0.4, 0.2, 0.2], position: [0, 5.1, 0] })!;
  d.addBox({ material: 'brick', size: [0.4, 0.2, 0.2], position: [0, 5.3, 0] });
  d.update(0.016);
  w.contact({ a: a.body as unknown as FakeBody, b: ground, impulse: a.volume * a.material.density * 6, point: [0, 0, 0] });
  d.update(0.2);
  for (let k = 0; k < 5; k++) await new Promise((r) => setImmediate(r));
  sounds.update();
  assert.deepEqual(plays.map((p) => p.name), ['brick.impact.small']);
});

// --- The engine, on a stand-in for Web Audio --------------------------------------------------

class FakeParam {
  value = 0;
  setValueAtTime(v: number) {
    this.value = v;
  }
  setTargetAtTime(v: number) {
    this.value = v;
  }
  linearRampToValueAtTime(v: number) {
    this.value = v;
  }
  exponentialRampToValueAtTime(v: number) {
    this.value = v;
  }
  cancelScheduledValues() {}
}

class FakeNode {
  connect<T>(n: T): T {
    return n;
  }
  disconnect() {}
}

class FakeSource extends FakeNode {
  buffer: unknown = null;
  playbackRate = new FakeParam();
  detune = new FakeParam();
  loop = false;
  loopStart = 0;
  loopEnd = 0;
  onended: (() => void) | null = null;
  started = -1;
  stopped = -1;
  start(t: number) {
    this.started = t;
  }
  stop(t: number) {
    this.stopped = t;
  }
}

/** Just enough of an AudioContext for the engine: time moves when the test says. */
class FakeContext {
  currentTime = 0;
  state = 'running';
  sampleRate = 8000;
  destination = new FakeNode();
  listener = Object.fromEntries(['positionX', 'positionY', 'positionZ', 'forwardX', 'forwardY', 'forwardZ', 'upX', 'upY', 'upZ'].map((k) => [k, new FakeParam()]));
  readonly sources: FakeSource[] = [];
  createGain() {
    return Object.assign(new FakeNode(), { gain: new FakeParam() });
  }
  createBufferSource() {
    const s = new FakeSource();
    this.sources.push(s);
    return s;
  }
  createBiquadFilter() {
    return Object.assign(new FakeNode(), { type: '', frequency: new FakeParam(), Q: new FakeParam() });
  }
  createPanner() {
    return Object.assign(new FakeNode(), { refDistance: 1, rolloffFactor: 1, positionX: new FakeParam(), positionY: new FakeParam(), positionZ: new FakeParam() });
  }
  createDynamicsCompressor() {
    return Object.assign(new FakeNode(), { threshold: new FakeParam(), knee: new FakeParam(), ratio: new FakeParam(), attack: new FakeParam(), release: new FakeParam() });
  }
  createWaveShaper() {
    return Object.assign(new FakeNode(), { curve: null, oversample: 'none' });
  }
  createConvolver() {
    return Object.assign(new FakeNode(), { buffer: null });
  }
  createBuffer(channels: number, length: number, sampleRate: number) {
    const data = Array.from({ length: channels }, () => new Float32Array(length));
    return { numberOfChannels: channels, length, sampleRate, duration: length / sampleRate, getChannelData: (c: number) => data[c] };
  }
  async decodeAudioData() {
    return second;
  }
}

/** Where the ears are (the listener's place): a sound placed there is heard at once, as loud as it plays. */
const EARS: V3 = [0, 0, 0];

/** One second of sound. */
const second = { duration: 1, sampleRate: 8000, length: 8000, numberOfChannels: 1, getChannelData: () => new Float32Array(8000).fill(0.5) } as unknown as AudioBuffer;

function fakeAudio() {
  const ctx = new FakeContext();
  const engine = new SoundEngine({ context: ctx as unknown as AudioContext, reverb: 0, autoUnlock: false });
  engine.define('bang', { space: 'head', priority: 5 }, [second]);
  // Placed in the world (where it's played `at`), as the sounds a blast masks are
  engine.define('tick', { volume: 0.1, voices: 1 }, [second]);
  engine.define('loop', { space: 'head', loop: true }, [second]);
  // Many at once, all as loud
  engine.define('grit', { space: 'head', volume: 0.5, voices: 64 }, [second]);
  const at = (t: number) => {
    ctx.currentTime = t;
    engine.update(1 / 60);
  };
  return { ctx, engine, at };
}

test('a sound with a delay is weighed when it starts: a blast just before the call does not silence it', () => {
  const { ctx, engine, at } = fakeAudio();
  engine.play('bang');
  // Asked for now, at once: under the blast's window
  assert.equal(engine.play('tick', { at: EARS }), null);
  // Asked for now, heard in a second: by then the blast has faded enough
  const later = engine.play('tick', { at: EARS, delay: 1 })!;
  assert.ok(later);
  assert.equal(engine.active, 1, 'it takes no voice while it waits');
  at(0.5);
  assert.ok(later.live && later.waiting);
  at(0.95);
  assert.ok(later.live && !later.waiting, 'let through');
  assert.equal(engine.active, 2);
  assert.equal(ctx.sources.at(-1)!.started, 1, 'on time');
  assert.equal(ctx.sources.at(-1)!.stopped, -1);
});

test('a delayed sound is turned away by a blast that comes before it starts', () => {
  const { ctx, engine, at } = fakeAudio();
  const later = engine.play('tick', { at: EARS, delay: 1 })!;
  const source = ctx.sources.at(-1)!;
  at(0.85);
  engine.play('bang');
  at(0.95);
  assert.equal(later.live, false);
  assert.equal(source.started, -1, 'never started: never heard');
});

test('a waiting sound takes its voice only when it starts', () => {
  const { engine, at } = fakeAudio();
  const later = engine.play('tick', { delay: 2 })!;
  // tick has one voice: the one waiting doesn't hold it
  const now = engine.play('tick')!;
  assert.ok(now && later);
  // By the time the later one starts, the first has played out: it takes the voice over
  at(1.95);
  assert.ok(later.live && !later.waiting);
  assert.equal(now.live, false);
});

test('a voice changes rate, and its volume and mix are kept apart', () => {
  const { ctx, engine } = fakeAudio();
  const v = engine.play('loop', { pitch: 1 })!;
  const source = ctx.sources.at(-1)!;
  const rate = source.playbackRate.value;
  v.setRate(1.5, 0);
  assert.ok(Math.abs(source.playbackRate.value - rate * 1.5) < 1e-9);
  v.setRate(1, 0);
  assert.ok(Math.abs(source.playbackRate.value - rate) < 1e-9, 'a multiple of the rate it started at');
  v.setMix(0.4, 0);
  v.setVolume(0.5, 0);
  assert.equal(v.nodes.gain.gain.value, 0.5);
  assert.equal(v.nodes.mix.gain.value, 0.4);
});

test('after a slow frame, a delayed sound is weighed before it makes a sound, and one let through late starts then', () => {
  const { ctx, engine, at } = fakeAudio();
  // Due 0.15 s from now; a blast, then the next frame 240 ms on: it's past its start when weighed
  const drowned = engine.play('tick', { at: EARS, delay: 0.15 })!;
  const source = ctx.sources.at(-1)!;
  ctx.currentTime = 0.04;
  engine.play('bang');
  at(0.24);
  assert.equal(drowned.live, false);
  assert.equal(source.started, -1, 'turned away without a sound, not cut short');
  // Nothing in the way: it starts at once, from its beginning
  const late = engine.play('grit', { delay: 0.15 })!;
  at(0.48);
  assert.ok(late.live && !late.waiting);
  assert.equal(ctx.sources.at(-1)!.started, 0.48);
  assert.equal(late.start, 0.48);
});

test('with no frames (a hidden tab), waiting sounds make no sound, and those long overdue are dropped', () => {
  const { ctx, engine, at } = fakeAudio();
  const voices = Array.from({ length: 45 }, () => engine.play('grit', { delay: 0.5 }));
  assert.equal(voices.filter((v) => v?.live).length, engine.maxVoices, 'no more waiting than there are voices');
  assert.ok(ctx.sources.every((s) => s.started < 0));
  at(3);
  assert.ok(voices.every((v) => !v?.live));
  assert.ok(ctx.sources.every((s) => s.started < 0));
});

test("a delayed sound is turned away on arrival if it's too soon after itself", () => {
  const { ctx, engine, at } = fakeAudio();
  engine.define('crack', { space: 'head', cooldown: 0.5 }, [second]);
  const later = engine.play('crack', { delay: 1 })!;
  at(0.85);
  assert.ok(engine.play('crack'));
  at(0.95);
  assert.equal(later.live, false);
  assert.ok(ctx.sources.filter((s) => s.started >= 0).length === 1);
  // Past the cooldown, it's heard
  const after = engine.play('crack', { delay: 0.5 })!;
  at(1.45);
  assert.ok(after.live && !after.waiting);
});

test('a loop keeps its voice under louder sounds in every voice, even turned down to nothing; only its own sound takes it', () => {
  const { engine } = fakeAudio();
  const bed = engine.play('loop')!;
  bed.setVolume(0, 0);
  for (let k = 0; k < 50; k++) engine.play('grit');
  assert.equal(engine.active, engine.maxVoices + engine.reserve, 'the voices kept for the head too (grit is in it)');
  assert.ok(bed.live, 'the bed is still there');
  // A loop of one voice gives it to a louder one of itself
  engine.define('hum', { space: 'head', loop: true, voices: 1 }, [second]);
  const quiet = engine.play('hum', { volume: 0.8 })!;
  const loud = engine.play('hum')!;
  assert.ok(loud.live && !quiet.live);
});

test("the player's own sounds always have a voice and are never masked: the world's never take those kept for the head, past them they take the world's", () => {
  const { engine, at } = fakeAudio();
  // The world's rubble, all 40 voices of it, each louder than a shot of the gun at the ears
  engine.define('rubble', { volume: 0.8, voices: 64 }, [second]);
  engine.define('shot', { space: 'head', volume: 0.15, priority: 0.6, voices: 4 }, [second]);
  engine.define('step', { space: 'head', volume: 0.05 }, [second]);
  const rubble = Array.from({ length: 45 }, (_, k) => engine.play('rubble', { at: [k % 5, 0, -2] }));
  assert.equal(rubble.filter((v) => v?.live).length, engine.maxVoices);
  // A burst, a round each 1/14 s: every shot heard
  const shots = [];
  for (let k = 0; k < 6; k++) {
    at((k + 1) / 14);
    shots.push(engine.play('shot'));
  }
  assert.ok(shots.every((v) => v), 'none dropped');
  assert.equal(shots.filter((v) => v!.live).length, 4, 'four at once, the oldest giving way to the newest');
  assert.equal(engine.active, engine.maxVoices + 4);
  // A louder sound in the world takes another of the world's, not a shot
  assert.ok(engine.play('rubble', { at: [0, 0, -1], volume: 1.5 }));
  assert.equal(shots.filter((v) => v!.live).length, 4);
  // The voices kept for the head all taken: one more in the head takes the world's least heard,
  // however quiet it is
  for (let k = 0; k < engine.reserve - 4; k++) engine.play('grit');
  assert.equal(engine.active, engine.maxVoices + engine.reserve);
  const world = () => rubble.filter((v) => v?.live).length;
  const before = world();
  assert.ok(engine.play('step')?.live);
  assert.equal(world(), before - 1);
  assert.equal(engine.active, engine.maxVoices + engine.reserve);
  // A blast going off: the world's quieter sounds then go unheard, the gun's shots still are
  at(1);
  engine.play('bang');
  assert.equal(engine.play('rubble', { at: [0, 0, -2], volume: 0.1 }), null);
  assert.ok(engine.play('shot')?.live);
});

test("a slowed sound lasts longer, and keeps its voice while it plays; Doppler doesn't undo the rate", () => {
  const { ctx, engine, at } = fakeAudio();
  const v = engine.play('tick')!;
  const length = v.duration;
  v.setRate(0.5, 0);
  assert.ok(Math.abs(v.duration - 2 * length) < 1e-9);
  // 1.2 s in, still well short of its end: a quieter tick doesn't take its one voice
  at(1.2);
  assert.equal(engine.play('tick', { volume: 0.3 }), null);
  assert.ok(v.live);
  // Following something that moves: the shift goes on detune, the rate set stays
  engine.define('hiss', { loop: true }, [second]);
  const thing = new THREE.Object3D();
  thing.position.set(0, 0, -20);
  const hiss = engine.play('hiss', { follow: thing, pitch: 1 })!;
  const source = ctx.sources.at(-1)!;
  hiss.setRate(1.5, 0);
  const rate = source.playbackRate.value;
  thing.position.z = -10;
  at(1.25);
  assert.equal(source.playbackRate.value, rate);
  assert.ok(source.detune.value > 0, 'coming closer: higher');
});

test("the engine's ceiling: straight up to -4.4 dBFS, then bending, never past -1.4", () => {
  const { engine } = fakeAudio();
  const curve = (engine.output as WaveShaperNode).curve!;
  const n = curve.length;
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    if (Math.abs(x) <= 0.6) assert.ok(Math.abs(curve[i] - x) < 1e-6, `${x}: ${curve[i]}`);
    assert.ok(Math.abs(curve[i]) < 0.85);
    if (i) assert.ok(curve[i] >= curve[i - 1], 'never turns back');
  }
  assert.ok(curve[n - 1] > 0.8, 'full scale comes out near the ceiling');
});

/** A world with one ambience loop and footsteps by surface, on the demo's audio, with stand-ins for the browser. */
async function demoAudio(surface: (at: V3, material: string | null, rubble: boolean) => string | undefined) {
  const { readFile } = await import('node:fs/promises');
  const real = { fetch: globalThis.fetch, AudioContext: globalThis.AudioContext };
  globalThis.fetch = (async (url: string) => (url.endsWith('.json') ? new Response(await readFile(`public/${url.replace(/^\//, '')}`)) : new Response(new ArrayBuffer(8)))) as typeof fetch;
  globalThis.AudioContext = FakeContext as unknown as typeof AudioContext;
  try {
    const d = new Destruction({ world: asWorld(new FakeWorld()), materials: { brick: presets.brick() } });
    const world = { audio: { materials: {}, ambience: [{ sound: 'ambience.city', volume: 0.5, high: 3 }], footsteps: { surface } } } as unknown as WorldDefinition;
    const camera = new THREE.PerspectiveCamera();
    const player = { position: new THREE.Vector3() } as unknown as Player;
    const audio = new DemoAudio(world, d, camera, {} as Launcher, player);
    await audio.ready;
    const played: string[] = [];
    const play = audio.engine.play.bind(audio.engine);
    audio.engine.play = (name, o) => (played.push(name), play(name, o));
    return { audio, d, camera, player, played };
  } finally {
    Object.assign(globalThis, real);
  }
}

test("the demo's ambience: at its listed level, shifted up high only as the height changes, the world's fades kept", async () => {
  const { audio, camera } = await demoAudio(() => undefined);
  const city = audio.ambience.get('ambience.city')!;
  const mix = city.nodes.mix.gain;
  const gain = city.nodes.gain.gain;
  assert.equal(mix.value, 0.5);
  // The world turns it down; the player climbs 20 m: halfway to the full shift (3 times)
  city.setVolume(0.2, 0);
  camera.position.y = 23;
  audio.update(1 / 60);
  assert.equal(mix.value, 0.5 * 2);
  assert.ok(Math.abs(gain.value - 0.35 * 0.2) < 1e-9, "the world's level kept");
  // A small change in height (under 1% of the mix) isn't ramped to
  mix.value = -1;
  camera.position.y = 23.1;
  audio.update(1 / 60);
  assert.equal(mix.value, -1);
  camera.position.y = 3;
  audio.update(1 / 60);
  assert.equal(mix.value, 0.5);
});

test('footsteps by surface: the piece stood on and the feet as (x, y, z), a sound not loaded heard as the default', async () => {
  const seen: Array<[V3, string | null, boolean]> = [];
  const { d, player, played } = await demoAudio((at, material, rubble) => {
    seen.push([at, material, rubble]);
    return material === 'brick' ? 'steps.boards' : 'steps.rubble';
  });
  // A brick floor, its top 0.2 m up
  d.addBox({ material: 'brick', size: [2, 0.2, 2], position: [0, 0.1, 0] });
  player.position.set(0.5, 0.2, -0.3);
  player.onStep('hard', 4);
  // Off it, on the ground
  player.position.set(5, 0, 0);
  player.onStep('hard', 4);
  assert.deepEqual(seen, [
    [[0.5, 0.2, -0.3], 'brick', false],
    [[5, 0, 0], null, false],
  ]);
  assert.deepEqual(played, ['steps.asphalt', 'steps.rubble'], 'steps.boards is no sound here: the hard step instead');
});

test("process-sounds' onset cut starts a take at the rise into its loudest part, and slices come in order with their times", () => {
  // A second of rising hiss, then a hit and its tail
  const n = RATE * 2;
  const noise = (i: number) => Math.sin(i * 12.9898) * 43758.5453 % 1;
  const ch = [new Float32Array(n), new Float32Array(n)];
  for (let i = 0; i < n; i++) {
    const t = i / RATE;
    const v = t < 1 ? 0.02 * t * noise(i) : 0.8 * Math.exp(-(t - 1) * 8) * noise(i);
    ch[0][i] = ch[1][i] = v;
  }
  const cut = onset(ch, 15);
  const start = (n - cut[0].length) / RATE;
  assert.ok(start > 0.98 && start < 1, `starts at ${start} s`);
  // Footsteps: four hits half a second apart over a quiet floor
  const steps = [new Float32Array(n), new Float32Array(n)];
  for (let i = 0; i < n; i++) {
    const t = i / RATE;
    const since = t - 0.2 - Math.floor((t - 0.2) / 0.5) * 0.5;
    const v = t >= 0.2 ? 0.6 * Math.exp(-since * 40) * noise(i) : 0;
    steps[0][i] = steps[1][i] = v + 0.002 * noise(i + 7);
  }
  const hits = slices(steps);
  assert.deepEqual(hits.map((h) => +h.at.toFixed(2)), [0.2, 0.7, 1.2, 1.7]);
  // Each from just before its onset
  for (const h of hits) assert.ok(h.ch[0].length > RATE * 0.3 && h.ch[0].length <= RATE * 0.34 + 1);
});
