// Sound for a world: a Web Audio engine for many short sounds placed in the scene (impacts,
// breaks, blasts) and a few long ones (loops, ambience).
//
// Each sound is a set of takes, one picked at random each time (never the same twice running) at
// a slightly different pitch, so a hundred bricks landing don't sound like one brick a hundred
// times. A sound placed in the world is panned and fades with distance; it also loses its treble
// to the air, is heard later the further it is (sound is slow: a blast 100 m off is heard 0.3 s
// after it's seen), and is wetter (more of it reaches the ears off the walls than straight). There
// are only so many voices: past that, the quietest give way to louder ones (but a loop only to
// another of its own sound; and sounds in the listener's head, the player's own, have voices kept
// for them and are never masked), and a sound played again too soon in the same place is dropped.
// Whether a sound is heard is decided when it reaches the ears, not when it's asked for. Loud
// sounds duck the ambience, and a blast close by can leave the world dull and ringing for a moment.

import type * as THREE from 'three/webgpu';
import type { V3 } from './math.ts';

export interface SoundOptions {
  /** URLs of its takes: one is picked each time, never the same twice running. */
  src: string[];
  /** Gain (default 1). */
  volume?: number;
  /** Playback rate picked from this range each time (default [0.94, 1.06]). */
  pitch?: [number, number];
  /** Metres within which it's at full volume (default 2). */
  near?: number;
  /** How fast it fades past `near` (the inverse distance model's rolloff; default 1). */
  rolloff?: number;
  /** Most of it playing at once (default 6). */
  voices?: number;
  /** Seconds before it plays again within `spacing` metres of where it last did (default 0). */
  cooldown?: number;
  /** Metres: see `cooldown` (default 3). */
  spacing?: number;
  /** Higher keeps its voice when there are too many (default 1). */
  priority?: number;
  /** 'world': it comes from a place in the scene (mono, panned); 'head': the listener's own (stereo, not placed). Default 'world'. */
  space?: 'world' | 'head';
  loop?: boolean;
  /** Which bus: 'sfx' (default), 'debris' (the many small sounds a blast ducks), 'ambience' (ducked too, further). */
  bus?: Bus;
  /** How much of it goes to the reverb (0–1, default 0.3); further sounds send more. */
  reverb?: number;
  /** Another sound played instead past `from` metres (a blast's distant boom). */
  distant?: { sound: string; from: number };
}

export interface PlayOptions {
  /** Where it comes from (world). Without it (or `follow`), it's in the listener's head. */
  at?: V3;
  /** Follow this object (its world position at each update), Doppler shift and all. */
  follow?: THREE.Object3D;
  /** Multiplies the sound's volume. */
  volume?: number;
  /** Multiplies the playback rate picked. */
  pitch?: number;
  /** Seconds from now (added to the time the sound takes to arrive). Whether it's heard is decided then. */
  delay?: number;
  /** Start this far into the take (seconds; a loop starts somewhere at random). */
  offset?: number;
  /** Seconds to fade in over (default 0). */
  fadeIn?: number;
  /** Which take (default: one at random). */
  take?: number;
}

export interface SoundEngineOptions {
  /** An AudioContext to use (default: a new one). */
  context?: AudioContext;
  /** Most voices at once (default 40). */
  maxVoices?: number;
  /**
   * Voices kept for sounds in the listener's head (the player's own: a gun's shots, steps; the
   * ambience) past `maxVoices` (default 8). The head's voices count toward `maxVoices` too: a
   * sound placed in the world plays while fewer than that are taken in all (else it takes a quieter
   * one of the world's), and these are used only once they are, by sounds in the head. With these
   * taken too, a sound in the head takes the least heard of the world's, however loud: a burst into
   * a busy street never loses a shot.
   */
  reserve?: number;
  /** m/s: further sounds start later (default 343; Infinity: at once). */
  speedOfSound?: number;
  /** Metres of air that halve the treble (default 70; Infinity: none). */
  air?: number;
  /** Seconds the reverb rings for (default 1.4; 0: no reverb). */
  reverb?: number;
  /** Master gain (default 0.8). */
  volume?: number;
  /** Resume on the first click or key press (browsers start audio suspended; default true). */
  autoUnlock?: boolean;
  /** HRTF panning (better placement in headphones, costlier; default false: equal power). */
  hrtf?: boolean;
  /**
   * dB: one-shots placed in the world this far under the loudest sound heard a moment ago aren't
   * played (default 30). Ears do this: right after a blast, the bricks landing around it go
   * unheard. A sound with a delay (or far enough off to arrive late) is weighed when it arrives.
   * Sounds in the listener's head (its own) are always played.
   */
  window?: number;
}

/** Seconds: a sound that starts later than this from now is decided on when it's this close. */
const LOOKAHEAD = 0.1;
/** Seconds: a sound let through this late (no frames for a while: a hidden tab) is dropped, not played out of time. */
const STALE = 0.5;
/** The quietest gain at the ears worth a voice. */
const AUDIBLE = 0.004;

interface Take {
  buffer: AudioBuffer;
  /** Where its sound starts and ends (an MP3's padding left out), for looping. */
  loopStart: number;
  loopEnd: number;
}

interface Sound {
  name: string;
  o: Required<Omit<SoundOptions, 'distant'>> & Pick<SoundOptions, 'distant'>;
  takes: Take[];
  last: number;
  playing: Voice[];
  recent: Array<{ time: number; at: V3 | null }>;
}

export type Bus = 'sfx' | 'debris' | 'ambience';

const DEFAULTS: Required<Omit<SoundOptions, 'src' | 'distant'>> = {
  volume: 1,
  pitch: [0.94, 1.06],
  near: 2,
  rolloff: 1,
  voices: 6,
  cooldown: 0,
  spacing: 3,
  priority: 1,
  space: 'world',
  loop: false,
  bus: 'sfx',
  reverb: 0.3,
};

const dist = (a: V3, b: V3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

/** One sound playing. */
export class Voice {
  readonly sound: string;
  readonly loop: boolean;
  /** Where it is (null: in the listener's head). */
  position: V3 | null;
  follow: THREE.Object3D | null;
  /** It has finished (its nodes are let go). */
  ended = false;
  /** It's been stopped and is fading out: no longer counted among the voices. */
  stopping = false;
  /** @internal Not yet decided on: it starts later, and is weighed against what's playing then. */ waiting = false;
  /** @internal Where in its take it starts and its fade in, until it's started (only a waiting voice isn't yet). */ cue: { offset: number; fadeIn: number } | null = null;
  /** @internal */ volume: number;
  /** @internal setMix's. */ mix = 1;
  /** @internal The sound's own volume (setVolume multiplies it). */ readonly base: number;
  /** @internal */ readonly priority: number;
  /** @internal The rate it started at (setRate multiplies it). */ readonly startRate: number;
  /** @internal Its rate now, before Doppler. */ rate: number;
  /** @internal */ lastDistance = -1;
  /** @internal */ readonly nodes: { source: AudioBufferSourceNode; gain: GainNode; mix: GainNode; filter: BiquadFilterNode | null; panner: PannerNode | null; send: GainNode | null };
  /** @internal */ readonly reverb: number;
  /** @internal start's. */ begins: number;
  /** @internal duration's. */ length: number;
  private readonly context: AudioContext;

  /** @internal Made by SoundEngine.play. */
  constructor(context: AudioContext, sound: string, start: number, duration: number, loop: boolean, volume: number, base: number, priority: number, rate: number, reverb: number, position: V3 | null, follow: THREE.Object3D | null, nodes: Voice['nodes']) {
    this.context = context;
    this.sound = sound;
    this.begins = start;
    this.length = duration;
    this.loop = loop;
    this.volume = volume;
    this.base = base;
    this.priority = priority;
    this.startRate = this.rate = rate;
    this.reverb = reverb;
    this.position = position;
    this.follow = follow;
    this.nodes = nodes;
    nodes.source.onended = () => this.release();
  }

  /** Context time it starts (after its delay; a sound let through late starts then). */
  get start(): number {
    return this.begins;
  }

  /** Seconds it plays for (a loop: once through), at the rates it's been set to. */
  get duration(): number {
    return this.length;
  }

  /** Fade it out over `fade` seconds and stop. */
  stop(fade = 0.08): void {
    if (this.ended || this.stopping) return;
    // Still waiting to arrive: never started, so never heard
    if (this.cue) return this.release();
    this.stopping = true;
    const t = this.context.currentTime;
    const g = this.nodes.gain.gain;
    g.cancelScheduledValues(t);
    g.setValueAtTime(g.value, t);
    g.linearRampToValueAtTime(0, t + fade);
    try {
      // Let through but not started yet: never mind it
      this.nodes.source.stop(this.start > t ? t : t + fade + 0.01);
    } catch {
      this.release();
    }
  }

  /**
   * Change its volume, over `time` seconds: a multiple of the sound's own volume (1: as the sound is
   * set to; a play's `volume` isn't kept).
   */
  setVolume(volume: number, time = 0.05): void {
    if (!this.live) return;
    this.volume = this.base * volume;
    this.ramp(this.nodes.gain.gain, this.volume, time);
  }

  /**
   * A second multiplier on its volume, apart from setVolume's (default 1), over `time` seconds: for
   * a mix applied by something other than whoever sets its volume (the demo shifts its ambience
   * with the player's height while the world ducks it), so neither undoes the other's fades.
   */
  setMix(mix: number, time = 0.05): void {
    if (!this.live) return;
    this.mix = mix;
    this.ramp(this.nodes.mix.gain, mix, time);
  }

  /**
   * Change its playback rate, over `time` seconds: a multiple of the rate it was played at (its
   * random pitch and a play's `pitch` kept; 1.5 is a fifth higher and faster). A voice following
   * an object keeps its Doppler shift on top.
   */
  setRate(rate: number, time = 0.05): void {
    if (!this.live) return;
    // What's left of it plays at the new rate: it ends sooner or later
    const t = Math.max(this.context.currentTime, this.start);
    const next = this.startRate * rate;
    this.length = t - this.start + (Math.max(0, this.start + this.length - t) * this.rate) / next;
    this.rate = next;
    this.ramp(this.nodes.source.playbackRate, this.rate, time);
  }

  /** Playing, or waiting to (not stopped, not ended). */
  get live(): boolean {
    return !this.ended && !this.stopping;
  }

  /** Seconds since it started (negative while it waits to). */
  get age(): number {
    return this.context.currentTime - this.start;
  }

  private ramp(param: AudioParam, value: number, time: number): void {
    const t = Math.max(this.context.currentTime, this.start);
    param.cancelScheduledValues(t);
    if (time > 0) param.setTargetAtTime(value, t, time / 3);
    else param.setValueAtTime(value, t);
  }

  private release(): void {
    if (this.ended) return;
    this.ended = true;
    this.stopping = true;
    const { source, gain, mix, filter, panner, send } = this.nodes;
    for (const n of [source, gain, mix, filter, panner, send]) n?.disconnect();
  }
}

export class SoundEngine {
  readonly context: AudioContext;
  /** Everything ends up here (then a filter for being deafened, a limiter, and a soft ceiling). */
  readonly master: GainNode;
  readonly buses: Record<Bus, GainNode>;
  /** What's heard, last in the chain (connect it to a MediaStreamAudioDestinationNode to record it). */
  readonly output: AudioNode;
  readonly maxVoices: number;
  readonly reserve: number;
  speedOfSound: number;
  air: number;
  /** Where the ears are (set by listen()). */
  readonly listener: { position: V3; forward: V3; up: V3 } = { position: [0, 0, 0], forward: [0, 0, -1], up: [0, 1, 0] };
  private readonly sounds = new Map<string, Sound>();
  private readonly voices: Voice[] = [];
  /** Voices that start later, not yet decided on (see update). */
  private waiting: Voice[] = [];
  private readonly reverbIn: GainNode | null;
  private readonly dull: BiquadFilterNode;
  private readonly limiter: DynamicsCompressorNode;
  private readonly hrtf: boolean;
  private ears: THREE.Object3D | null = null;
  private readonly unlockers: Array<() => void> = [];
  /** The window under the loudest sound lately (a gain), and that sound's level and when it was. */
  private readonly window: number;
  private loudest = { level: 0, time: 0 };

  constructor(options: SoundEngineOptions = {}) {
    this.context = options.context ?? new AudioContext({ latencyHint: 'interactive' });
    this.maxVoices = options.maxVoices ?? 40;
    this.reserve = options.reserve ?? 8;
    this.speedOfSound = options.speedOfSound ?? 343;
    this.air = options.air ?? 70;
    this.hrtf = options.hrtf ?? false;
    this.window = 10 ** (-(options.window ?? 30) / 20);
    const ctx = this.context;
    // master → dull (lowpass, open unless deafened) → limiter → ceiling → out. The limiter lets
    // the first milliseconds of a blast through (and raises what's under it); the ceiling rounds
    // off what still reaches past -4.4 dBFS, so nothing goes over -1.4
    const limiter = (this.limiter = ctx.createDynamicsCompressor());
    limiter.threshold.value = -10;
    limiter.knee.value = 6;
    limiter.ratio.value = 10;
    limiter.attack.value = 0.003;
    limiter.release.value = 0.25;
    const ceiling = ctx.createWaveShaper();
    ceiling.curve = softClip(0.6, 0.85);
    ceiling.oversample = '4x';
    limiter.connect(ceiling).connect(ctx.destination);
    this.output = ceiling;
    this.dull = ctx.createBiquadFilter();
    this.dull.type = 'lowpass';
    this.dull.frequency.value = 20000;
    this.dull.Q.value = 0.5;
    this.dull.connect(limiter);
    this.master = ctx.createGain();
    this.master.gain.value = options.volume ?? 0.8;
    this.master.connect(this.dull);
    this.buses = { sfx: ctx.createGain(), debris: ctx.createGain(), ambience: ctx.createGain() };
    for (const b of Object.values(this.buses)) b.connect(this.master);
    const seconds = options.reverb ?? 1.4;
    if (seconds > 0) {
      const convolver = ctx.createConvolver();
      convolver.buffer = streetReverb(ctx, seconds);
      const wet = ctx.createGain();
      wet.gain.value = 0.7;
      convolver.connect(wet).connect(this.master);
      this.reverbIn = ctx.createGain();
      this.reverbIn.connect(convolver);
    } else this.reverbIn = null;
    if ((options.autoUnlock ?? true) && typeof window !== 'undefined') {
      const unlock = () => void this.unlock();
      for (const type of ['pointerdown', 'keydown', 'touchend'] as const) {
        window.addEventListener(type, unlock, { capture: true });
        this.unlockers.push(() => window.removeEventListener(type, unlock, { capture: true }));
      }
    }
  }

  /** Resume the context (browsers only let it start after the user does something). */
  async unlock(): Promise<void> {
    if (this.context.state !== 'running') await this.context.resume();
    if (this.context.state === 'running') for (const off of this.unlockers.splice(0)) off();
  }

  get running(): boolean {
    return this.context.state === 'running';
  }

  /** Load sounds (name → options): their takes are fetched and decoded together. Takes that fail are left out, with a warning. */
  async load(defs: Record<string, SoundOptions>): Promise<void> {
    await Promise.all(
      Object.entries(defs).map(async ([name, o]) => {
        const takes = await Promise.all(
          o.src.map(async (url) => {
            try {
              const r = await fetch(url);
              if (!r.ok) throw new Error(`${r.status}`);
              return this.take(await this.context.decodeAudioData(await r.arrayBuffer()));
            } catch (e) {
              console.warn(`SoundEngine: ${name}: ${url}: ${(e as Error).message}`);
              return null;
            }
          }),
        );
        this.define(name, o, takes.filter((t): t is Take => t !== null).map((t) => t.buffer));
      }),
    );
  }

  /** Add a sound from buffers made some other way (synthesized, decoded already). */
  define(name: string, options: Omit<SoundOptions, 'src'> & { src?: string[] }, buffers: AudioBuffer[]): void {
    const o = { ...DEFAULTS, ...options, src: options.src ?? [] };
    this.sounds.set(name, { name, o, takes: buffers.map((b) => this.take(b)), last: -1, playing: [], recent: [] });
  }

  has(name: string): boolean {
    return (this.sounds.get(name)?.takes.length ?? 0) > 0;
  }

  /** Follow this object with the ears (the camera, usually): read at each update. */
  listen(object: THREE.Object3D): void {
    this.ears = object;
  }

  /** How loud a sound placed at `at` would be at the ears, from its distance alone (0–1). */
  falloff(name: string, at: V3): number {
    const s = this.sounds.get(name);
    if (!s) return 0;
    return gainAt(dist(at, this.listener.position), s.o.near, s.o.rolloff);
  }

  /**
   * Play a sound. Null when it isn't played: unknown, inaudible, too soon, or no voice to spare. A
   * sound that starts later (a delay, or far off) is decided on when it arrives: its voice may end
   * then without having been heard.
   */
  play(name: string, options: PlayOptions = {}): Voice | null {
    let s = this.sounds.get(name);
    if (!s || !s.takes.length) return null;
    const ctx = this.context;
    // Until audio is allowed, only loops start (they'll be going when it is)
    if (ctx.state !== 'running' && !s.o.loop) return null;
    const placed = s.o.space === 'world' && (options.at || options.follow);
    const at: V3 | null = placed ? (options.at ?? worldPosition(options.follow!)) : null;
    const d = at ? dist(at, this.listener.position) : 0;
    if (at && s.o.distant && d > s.o.distant.from && this.has(s.o.distant.sound)) {
      s = this.sounds.get(s.o.distant.sound)!;
    }
    const o = s.o;
    const volume = o.volume * (options.volume ?? 1);
    const heard = volume * (at ? gainAt(d, o.near, o.rolloff) : 1);
    const now = ctx.currentTime;
    const delay = Math.max(0, options.delay ?? 0) + (at && Number.isFinite(this.speedOfSound) ? d / this.speedOfSound : 0);
    const start = now + delay;
    // Heard later: weighed then (in update), against what's playing by then. A blast going off
    // first doesn't silence the debris landing after it
    const waiting = delay > LOOKAHEAD;
    if (waiting) {
      if (heard < AUDIBLE) return null;
      this.waiting = this.waiting.filter((v) => v.live);
      if (this.waiting.length >= this.maxVoices && !this.steal(this.waiting, heard * o.priority, s.name, true)) return null;
    } else if (!this.admit(s, heard, at, start)) return null;

    // The take: at random, not the last one
    let k = options.take ?? Math.floor(Math.random() * s.takes.length);
    if (options.take === undefined && s.takes.length > 1 && k === s.last) k = (k + 1 + Math.floor(Math.random() * (s.takes.length - 1))) % s.takes.length;
    s.last = k;
    const take = s.takes[k % s.takes.length];
    const rate = (o.pitch[0] + Math.random() * (o.pitch[1] - o.pitch[0])) * (options.pitch ?? 1);

    const source = ctx.createBufferSource();
    source.buffer = take.buffer;
    source.playbackRate.value = rate;
    if (o.loop) {
      source.loop = true;
      source.loopStart = take.loopStart;
      source.loopEnd = take.loopEnd;
    }
    const gain = ctx.createGain();
    const mix = ctx.createGain();
    source.connect(gain).connect(mix);
    let filter: BiquadFilterNode | null = null;
    let panner: PannerNode | null = null;
    let send: GainNode | null = null;
    let last: AudioNode = mix;
    if (at) {
      filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = this.cutoff(d);
      panner = ctx.createPanner();
      panner.panningModel = this.hrtf ? 'HRTF' : 'equalpower';
      panner.distanceModel = 'inverse';
      panner.refDistance = o.near;
      panner.rolloffFactor = o.rolloff;
      panner.maxDistance = 10_000;
      setPosition(panner, at);
      mix.connect(filter).connect(panner);
      last = panner;
    }
    last.connect(this.buses[o.bus]);
    if (this.reverbIn && o.reverb > 0) {
      send = ctx.createGain();
      send.gain.value = this.wet(o.reverb, at ? gainAt(d, o.near, o.rolloff) : 1);
      (filter ?? mix).connect(send).connect(this.reverbIn);
    }
    const voice = new Voice(ctx, s.name, start, take.buffer.duration / rate, o.loop, volume, o.volume, o.priority, rate, o.reverb, at, at ? (options.follow ?? null) : null, { source, gain, mix, filter, panner, send });
    voice.lastDistance = at ? d : -1;
    voice.cue = { offset: options.offset ?? (o.loop ? take.loopStart + Math.random() * (take.loopEnd - take.loopStart) : 0), fadeIn: options.fadeIn ?? 0 };
    // A waiting voice makes no sound until it's let through (see update)
    voice.waiting = waiting;
    if (waiting) this.waiting.push(voice);
    else {
      this.begin(voice, start);
      s.playing.push(voice);
    }
    this.voices.push(voice);
    return voice;
  }

  /** Start a voice at context time `at`. */
  private begin(v: Voice, at: number): void {
    const { offset, fadeIn } = v.cue!;
    v.cue = null;
    v.begins = at;
    v.nodes.source.start(at, offset);
    const g = v.nodes.gain.gain;
    if (fadeIn) {
      g.setValueAtTime(0, at);
      g.linearRampToValueAtTime(v.volume, at + fadeIn);
    } else g.value = v.volume;
  }

  /**
   * Whether a sound heard this loud (a gain at the ears), from `at`, starting at `start`, is played:
   * audible, not under the loudest sound's window, not too soon after itself, a voice to spare.
   */
  private admit(s: Sound, heard: number, at: V3 | null, start: number): boolean {
    const o = s.o;
    if (heard < AUDIBLE) return false;
    // Under the window of the loudest sound lately, weighted by its priority (a blast's lasts
    // longer); it fades from mind over a second or so. Not the listener's own, in the head: a shot
    // of the gun in hand is heard under a blast going off
    const loudest = this.loudest.level * Math.exp(-Math.max(0, start - this.loudest.time) / 0.8);
    if (!o.loop && at && heard < loudest * this.window) return false;
    if (heard * o.priority >= loudest) this.loudest = { level: heard * o.priority, time: start };
    // Played here a moment ago: once is enough
    if (o.cooldown > 0) {
      s.recent = s.recent.filter((r) => Math.abs(start - r.time) < o.cooldown);
      if (s.recent.some((r) => !at || !r.at || dist(r.at, at) < o.spacing)) return false;
      s.recent.push({ time: start, at });
    }
    // A voice to play it on: of its own, and of all. One in the world gives way only to another in
    // the world; one in the head has the reserve too, and past it takes a voice from the world's
    s.playing = s.playing.filter((v) => v.live);
    const loudness = heard * o.priority;
    if (s.playing.length >= o.voices && !this.steal(s.playing, loudness, s.name)) return false;
    if (at) return this.active < this.maxVoices || this.steal(this.voices, loudness, s.name, false, true);
    return this.active < this.maxVoices + this.reserve || this.steal(this.voices, Infinity, s.name, false, true) || this.steal(this.voices, loudness, s.name);
  }

  /**
   * Duck a bus under something loud (the ambience by default): down by `depth` (0–1) at once,
   * held for `hold` seconds, back over `release`.
   */
  duck(depth: number, release = 2, bus: Bus = 'ambience', hold = 0.25): void {
    const g = this.buses[bus].gain;
    const t = this.context.currentTime;
    const low = Math.max(0, 1 - depth);
    if (g.value < low) return;
    g.cancelScheduledValues(t);
    g.setValueAtTime(g.value, t);
    g.linearRampToValueAtTime(low, t + 0.03);
    g.setTargetAtTime(1, t + 0.03 + hold, release / 3);
  }

  /**
   * Deafen for a moment, as a blast close by does: everything dull (by `amount`, 0–1) and a ring
   * in the ears, coming back over `seconds`.
   */
  deafen(amount: number, seconds = 2): void {
    if (!this.running || amount <= 0) return;
    const ctx = this.context;
    const t = ctx.currentTime;
    const f = this.dull.frequency;
    const low = 20000 * Math.pow(350 / 20000, Math.min(1, amount));
    if (f.value <= low * 1.05) return;
    f.cancelScheduledValues(t);
    f.setValueAtTime(f.value, t);
    f.exponentialRampToValueAtTime(low, t + 0.04);
    f.setValueAtTime(low, t + seconds * 0.25);
    f.exponentialRampToValueAtTime(20000, t + seconds);
    // The ring: a high sine, past the dulling filter, fading
    const ring = ctx.createOscillator();
    ring.frequency.value = 3400 + Math.random() * 600;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.03 * amount, t + 0.08);
    g.gain.exponentialRampToValueAtTime(0.0001, t + seconds * 1.4);
    ring.connect(g).connect(this.limiter);
    ring.start(t);
    ring.stop(t + seconds * 1.4 + 0.05);
    ring.onended = () => g.disconnect();
  }

  /** Move the ears and the voices that follow things. Call each frame. */
  update(dt: number): void {
    const ctx = this.context;
    if (this.ears) {
      this.ears.updateWorldMatrix(true, false);
      const e = this.ears.matrixWorld.elements;
      const l = this.listener;
      l.position = [e[12], e[13], e[14]];
      l.forward = [-e[8], -e[9], -e[10]];
      l.up = [e[4], e[5], e[6]];
      setListener(ctx.listener, l.position, l.forward, l.up);
    }
    // The sounds arriving now are weighed against what's playing (soonest first); those let
    // through take their voices and start. After a slow frame, one already due starts now, from
    // its beginning; one long overdue (no frames for a while) isn't played
    if (this.waiting.length) {
      const now = ctx.currentTime;
      const due = this.waiting.filter((v) => v.live && v.start - now <= LOOKAHEAD).sort((a, b) => a.start - b.start);
      this.waiting = this.waiting.filter((v) => v.live && v.start - now > LOOKAHEAD);
      for (const v of due) {
        const s = this.sounds.get(v.sound)!;
        const start = Math.max(v.start, now);
        if ((!v.loop && start - v.start > STALE) || !this.admit(s, this.heard(v), v.position, start)) {
          v.stop();
          continue;
        }
        v.waiting = false;
        this.begin(v, start);
        s.playing.push(v);
      }
    }
    let alive = 0;
    for (const v of this.voices) {
      if (v.ended) continue;
      this.voices[alive++] = v;
      if (!v.position) continue;
      if (v.follow) v.position = worldPosition(v.follow);
      const d = dist(v.position, this.listener.position);
      const { panner, filter, send, source } = v.nodes;
      setPosition(panner!, v.position);
      filter!.frequency.setTargetAtTime(this.cutoff(d), ctx.currentTime, 0.05);
      if (send) send.gain.setTargetAtTime(this.wet(v.reverb, gainAt(d, panner!.refDistance, panner!.rolloffFactor)), ctx.currentTime, 0.05);
      // Doppler: coming closer raises the pitch, going away lowers it (on detune, so setRate's own
      // changes keep their time)
      if (v.follow && v.lastDistance >= 0 && dt > 0 && Number.isFinite(this.speedOfSound)) {
        const closing = (d - v.lastDistance) / dt;
        const shift = this.speedOfSound / Math.max(this.speedOfSound * 0.5, this.speedOfSound + closing);
        source.detune.setTargetAtTime(1200 * Math.log2(Math.min(2, shift)), ctx.currentTime, 0.04);
      }
      v.lastDistance = d;
    }
    this.voices.length = alive;
  }

  /** Voices playing now (or about to: those starting later count once they're let through). */
  get active(): number {
    let n = 0;
    for (const v of this.voices) if (v.live && !v.waiting) n++;
    return n;
  }

  /** Stop every voice (fading out over `fade` seconds). */
  stopAll(fade = 0.1): void {
    for (const v of this.voices) v.stop(fade);
  }

  dispose(): void {
    this.stopAll(0.01);
    for (const off of this.unlockers.splice(0)) off();
    void this.context.close();
  }

  /**
   * Give up the least heard of `voices` (playing, or `waiting` ones; only those placed in the world,
   * if `world`) to a sound `loudness` loud if it's quieter; whether one was. A loop gives way only to
   * its own sound: loops are the bed (a world turns one down to nothing to duck it), and nothing
   * would start one again.
   */
  private steal(voices: Voice[], loudness: number, sound: string, waiting = false, world = false): boolean {
    let worst: Voice | null = null;
    let least = Infinity;
    for (const v of voices) {
      if (!v.live || v.waiting !== waiting || (v.loop && v.sound !== sound) || (world && !v.position)) continue;
      const l = this.loudness(v);
      if (l < least) [least, worst] = [l, v];
    }
    if (!worst || least >= loudness) return false;
    worst.stop(0.04);
    return true;
  }

  /** A voice's gain where the ears are now. */
  private heard(v: Voice): number {
    const p = v.nodes.panner;
    return v.volume * v.mix * (p && v.position ? gainAt(dist(v.position, this.listener.position), p.refDistance, p.rolloffFactor) : 1);
  }

  /** How much a voice still matters: its volume where the ears are, fading over its length. */
  private loudness(v: Voice): number {
    const left = v.loop ? 1 : Math.max(0, 1 - Math.max(0, v.age) / v.duration);
    return this.heard(v) * left * v.priority;
  }

  private cutoff(d: number): number {
    return Math.max(500, 20000 * Math.pow(0.5, d / this.air));
  }

  /**
   * The reverb send (taken before the distance fades it): the reflections fade with distance more
   * slowly than the sound itself, so further sounds are wetter.
   */
  private wet(reverb: number, direct: number): number {
    return reverb * Math.sqrt(direct);
  }

  private take(buffer: AudioBuffer): Take {
    // Where the sound itself starts and ends (decoders may pad an MP3 with silence)
    const data = buffer.getChannelData(0);
    let a = 0;
    let b = data.length - 1;
    while (a < b && Math.abs(data[a]) < 1e-4) a++;
    while (b > a && Math.abs(data[b]) < 1e-4) b--;
    return { buffer, loopStart: a / buffer.sampleRate, loopEnd: (b + 1) / buffer.sampleRate };
  }
}

/** A curve for a WaveShaperNode: straight up to `knee`, then bending smoothly toward `ceiling` (never past it). */
function softClip(knee: number, ceiling: number): Float32Array<ArrayBuffer> {
  const n = 4096;
  const curve = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    const a = Math.abs(x);
    curve[i] = Math.sign(x) * (a <= knee ? a : knee + (ceiling - knee) * Math.tanh((a - knee) / (ceiling - knee)));
  }
  return curve;
}

/** The inverse distance model's gain (as PannerNode's). */
function gainAt(d: number, near: number, rolloff: number): number {
  return near / (near + rolloff * (Math.max(d, near) - near));
}

function worldPosition(o: THREE.Object3D): V3 {
  o.updateWorldMatrix(true, false);
  const e = o.matrixWorld.elements;
  return [e[12], e[13], e[14]];
}

function setPosition(p: PannerNode, at: V3): void {
  if (p.positionX) {
    p.positionX.value = at[0];
    p.positionY.value = at[1];
    p.positionZ.value = at[2];
  } else p.setPosition(at[0], at[1], at[2]);
}

function setListener(l: AudioListener, at: V3, f: V3, u: V3): void {
  if (l.positionX) {
    l.positionX.value = at[0];
    l.positionY.value = at[1];
    l.positionZ.value = at[2];
    l.forwardX.value = f[0];
    l.forwardY.value = f[1];
    l.forwardZ.value = f[2];
    l.upX.value = u[0];
    l.upY.value = u[1];
    l.upZ.value = u[2];
  } else {
    l.setPosition(at[0], at[1], at[2]);
    l.setOrientation(f[0], f[1], f[2], u[0], u[1], u[2]);
  }
}

/**
 * A street's reverb, made up: a few early reflections off the facades (the slap of a canyon of
 * brick), then a tail of noise decaying to -60 dB over `seconds`, losing its treble as it goes.
 */
export function streetReverb(ctx: BaseAudioContext, seconds: number): AudioBuffer {
  const rate = ctx.sampleRate;
  const n = Math.round(rate * seconds);
  const ir = ctx.createBuffer(2, n, rate);
  let seed = 1;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1;
  const taps = [0.017, 0.029, 0.041, 0.063, 0.088, 0.121, 0.157];
  for (let c = 0; c < 2; c++) {
    const data = ir.getChannelData(c);
    let lp = 0;
    const pre = Math.round(rate * 0.012);
    for (let i = pre; i < n; i++) {
      const t = (i - pre) / rate;
      // A one-pole lowpass closing over time: the tail darkens
      const a = 0.08 + 0.7 * Math.exp(-t * 4);
      lp += a * (rand() - lp);
      data[i] = lp * Math.exp((-6.9 * t) / seconds) * Math.min(1, t / 0.03) * 0.5;
    }
    taps.forEach((tap, k) => {
      const i = Math.round(rate * (tap + (c ? 0.0031 * (k % 3) : 0.0023 * (k % 2))));
      if (i < n) data[i] += (0.55 - k * 0.06) * (k % 2 ? -1 : 1);
    });
  }
  // About as loud as what goes in
  let e = 0;
  for (let c = 0; c < 2; c++) for (const v of ir.getChannelData(c)) e += v * v;
  const g = 1 / Math.sqrt(e / 2);
  for (let c = 0; c < 2; c++) {
    const data = ir.getChannelData(c);
    for (let i = 0; i < n; i++) data[i] *= g;
  }
  return ir;
}
