// What destruction sounds like: a Destruction's events played on a SoundEngine.
//
// Breaks crack where they happen, pieces knock and thud where they land (louder the harder and
// heavier), chips and shards patter down where and when they'd land, sections rumble as they come
// down, and what's left standing creaks as bonds give way. A blast throws hundreds of events in a
// few frames, so events of a kind close together are heard as one sound, louder for being many,
// and only the loudest few of each sound play. The impacts of a readback (several solver steps'
// worth) are spread back out over the steps they happened in, so they keep their rhythm. A section
// landing whole can be heard once, as one heavy thing, rather than as each of its pieces.

import type { SoundEngine } from './audio.ts';
import { type MaterialKind, materialKind } from './bullets.ts';
import type { Destruction, ImpactEvent, LandedEvent, Piece } from './destruction.ts';
import type { V3 } from './math.ts';

/** The sounds a material makes (names of sounds loaded on the engine). */
export interface MaterialSounds {
  /** Breaking: a blast or a strike cutting it. */
  break?: string;
  /** A light loose piece of it striking something. */
  impact?: string;
  /** A heavy one (heavier than `heavy`). */
  heavyImpact?: string;
  /** Chips and shards of it thrown as particles: heard where and when they'd land. */
  debris?: string;
  /** Its bonds giving way: a standing structure creaking, metal bending as it tears. */
  strain?: string;
  /** A section of it coming down. */
  collapse?: string;
  /** Grit and dust trickling down a few seconds after a section came down. */
  settle?: string;
  /**
   * A section of it (pieces still bonded) or a heavy piece touching down whole (the Destruction's
   * 'landed'): once for the whole, louder and lower the heavier, instead of its pieces' strikes then.
   * Default: none, each piece is heard striking.
   */
  land?: string;
  /**
   * Its sounds played at this rate (a multiple of theirs: 0.8 is lower and slower), all of them or
   * by kind (`{ debris: 0.75 }`; those not listed at 1), so a material can share another's sounds.
   */
  pitch?: number | { [K in SoundKind]?: number };
  /** Its pieces heavier than this (density × volume) strike with `heavyImpact` (default DestructionSoundsOptions.heavy). */
  heavy?: number;
  /**
   * A bullet striking it (DestructionSounds.bullet): its crack, thunk or ping. Default its kind's,
   * `bullet.<kind>` (materialKind: brick, concrete, metal, wood, glass, dirt).
   */
  bullet?: string;
}

type SoundKind = 'break' | 'impact' | 'heavyImpact' | 'debris' | 'strain' | 'collapse' | 'settle' | 'land' | 'bullet';

/** A material's sound of a kind, and the rate it plays at. */
interface Heard {
  name: string;
  pitch: number;
}

export interface DestructionSoundsOptions {
  /** Sounds by material (the Destruction's material names). */
  materials: Record<string, MaterialSounds>;
  /** For materials not listed. */
  fallback?: MaterialSounds;
  /** Pieces heavier than this (density × volume) strike with `heavyImpact` (default 0.25; a material's own `heavy` wins). */
  heavy?: number;
  /** The slowest strike heard (m/s, default 1.2). */
  minSpeed?: number;
  /** Metres: events of a sound closer than this in a moment are one sound (default 3). */
  spacing?: number;
  /** Most of each sound started per frame (default 4). */
  most?: number;
  /** Most of each sound started per second, on average (default 6; bursts of up to `most` × 2). */
  rate?: number;
  /** Seconds before the same piece is heard striking again (default 0.3): a bouncing or rocking piece knocks once. */
  repeat?: number;
  /** The sounds of a blast (blast()): the bang, and the debris raining after. */
  blast?: { bang?: string; debris?: string };
  gravity?: number;
}

interface Pending {
  sound: string;
  /** Weighted sums, for the centre and the pitch. */
  at: V3;
  pitch: number;
  weight: number;
  /** Sum of the squared intensities: n equal sounds together are √n times as loud. */
  energy: number;
  delay: number;
}

/** A bullet's chance of a ricochet off metal and off stone, and how much more when it grazes; the least time between two (s). */
const RICOCHET = { metal: 0.08, stone: 0.03, grazing: 0.2 };
const RICOCHET_GAP = 0.6;

export class DestructionSounds {
  readonly engine: SoundEngine;
  readonly destruction: Destruction;
  readonly materials: Record<string, MaterialSounds>;
  readonly fallback: MaterialSounds;
  heavy: number;
  minSpeed: number;
  spacing: number;
  most: number;
  rate: number;
  repeat: number;
  private readonly blastSounds: { bang: string; debris: string };
  private readonly gravity: number;
  private readonly pending = new Map<string, Pending>();
  private impacts: ImpactEvent[] = [];
  /** When each piece was last heard striking. */
  private readonly struck = new WeakMap<Piece, number>();
  /** Each sound's allowance: a bucket refilled at `rate` a second. */
  private readonly allowance = new Map<string, { tokens: number; at: number }>();
  /** When the last ricochet was heard (the engine's time). */
  private ricochetAt = -Infinity;
  private readonly off: Array<() => void>;

  constructor(engine: SoundEngine, destruction: Destruction, options: DestructionSoundsOptions) {
    this.engine = engine;
    this.destruction = destruction;
    this.materials = options.materials;
    this.fallback = options.fallback ?? {};
    this.heavy = options.heavy ?? 0.25;
    this.minSpeed = options.minSpeed ?? 1.2;
    this.spacing = options.spacing ?? 3;
    this.most = options.most ?? 4;
    this.rate = options.rate ?? 6;
    this.repeat = options.repeat ?? 0.3;
    this.gravity = options.gravity ?? 9.81;
    this.blastSounds = { bang: options.blast?.bang ?? 'explosion.near', debris: options.blast?.debris ?? 'explosion.debris' };
    const d = destruction;
    this.off = [
      d.on('impact', (e) => this.impacts.push(e)),
      d.on('fracture', (e) => {
        const s = this.soundOf(e.piece.materialName, 'break');
        if (s) this.add(s, e.at, Math.min(1, 0.35 + 1.2 * Math.cbrt(e.piece.volume)), 0);
      }),
      d.on('debris', (e) => {
        const s = this.soundOf(e.material, 'debris');
        if (!s) return;
        // Where and when it lands: thrown from `at` with `velocity`, falling to the ground
        const h = Math.max(0, e.at[1] - (d.ground ?? 0));
        const vy = e.velocity[1];
        const t = (vy + Math.sqrt(vy * vy + 2 * this.gravity * h)) / this.gravity;
        const land: V3 = [e.at[0] + e.velocity[0] * t, d.ground ?? 0, e.at[2] + e.velocity[2] * t];
        this.add(s, land, Math.min(1, Math.cbrt(e.volume) * 5), Math.min(t, 4), 1, 2, 0.25);
      }),
      d.on('collapse', (e) => {
        const material = this.mostly(e.pieces);
        const loud = Math.min(1.3, 0.3 + 0.6 * Math.cbrt(e.volume));
        const collapse = this.soundOf(material, 'collapse');
        const settle = this.soundOf(material, 'settle');
        if (collapse) this.add(collapse, e.center, loud, 0, 1, 4);
        if (settle) this.add(settle, e.center, loud * 0.8, 2 + Math.random(), 1, 4, 1);
      }),
      d.on('bondBreak', ({ bond }) => {
        const s = this.soundOf(bond.a.materialName, 'strain');
        if (!s) return;
        const at = bond.a.state === 'loose' ? bond.a.pose.position : bond.center;
        this.add(s, at, Math.min(1, 0.4 + Math.sqrt(bond.area)), 0, 1, 3);
      }),
    ];
    // Only when a material says how it lands: listening makes falling sections report their contacts
    if ([...Object.values(this.materials), this.fallback].some((m) => m.land)) this.off.push(d.on('landed', (e) => this.landed(e)));
  }

  /**
   * A blast: the bang (its distant boom, when it's far), debris raining after, the ambience
   * ducked, and the listener deafened for a moment if it went off close.
   */
  blast(at: V3, radius: number, loudness = 1): void {
    const e = this.engine;
    const v = Math.min(1.4, (0.55 + radius / 5) * loudness);
    e.play(this.blastSounds.bang, { at, volume: v, pitch: Math.min(1.1, Math.max(0.85, 1.05 - radius * 0.03)) });
    e.play(this.blastSounds.debris, { at, volume: v * 0.8, delay: 0.25 + Math.random() * 0.2 });
    const d = Math.hypot(at[0] - e.listener.position[0], at[1] - e.listener.position[1], at[2] - e.listener.position[2]);
    // It punches a hole in everything else for a moment
    e.duck(Math.min(0.85, 0.4 + radius * 0.1), 3);
    e.duck(Math.min(0.75, 0.35 + radius * 0.1), 1.4, 'debris', 0.35);
    const close = 1 - d / (radius * 3 + 5);
    if (close > 0) e.deafen(Math.min(0.9, close * 1.2), 1.2 + close * 1.6);
  }

  /**
   * A bullet struck `material` at `at` (null: the ground or the scenery, of `kind`, default stone):
   * its `bullet` sound, else its kind's, played at once, as each bullet is heard; and now and then,
   * off metal and stone, a ricochet whining away (more often when it grazes: `glance`, 0 square on,
   * 1 along the surface; never two within RICOCHET_GAP s). A sound that isn't loaded plays nothing.
   */
  bullet(at: V3, material: string | null, kind?: MaterialKind, glance = 0): void {
    const sounds = material ? this.soundsOf(material) : null;
    const k = kind ?? (material && this.destruction.materials[material] ? materialKind(material, this.destruction.materials[material], sounds!) : 'concrete');
    // At the material's pitch, its own sound or its kind's
    const pitch = typeof sounds?.pitch === 'number' ? sounds.pitch : (sounds?.pitch?.bullet ?? 1);
    this.engine.play(sounds?.bullet ?? `bullet.${k}`, { at, pitch });
    // Only a truly grazing hit (within 15° or so of the surface) whines more often: a burst at the
    // road a few metres off is all grazing, and must not whine every few rounds
    const chance = k === 'metal' ? RICOCHET.metal : k === 'brick' || k === 'concrete' ? RICOCHET.stone : 0;
    const grazing = Math.max(0, (glance - 0.75) / 0.25);
    const now = this.engine.context.currentTime;
    if (!chance || now - this.ricochetAt < RICOCHET_GAP || Math.random() >= chance + RICOCHET.grazing * grazing) return;
    this.ricochetAt = now;
    this.engine.play('bullet.ricochet', { at });
  }

  /** Play what this frame's events added up to. Call each frame, after Destruction.update. */
  update(): void {
    // The impacts a readback brought, spread back over the steps they happened in
    if (this.impacts.length) {
      const first = Math.min(...this.impacts.map((e) => e.step));
      const step = this.destruction.world.dt;
      for (const e of this.impacts.splice(0)) this.impact(e, (e.step - first) * step);
    }
    if (!this.pending.size) return;
    const bySound = new Map<string, Pending[]>();
    for (const p of this.pending.values()) {
      const list = bySound.get(p.sound) ?? [];
      list.push(p);
      bySound.set(p.sound, list);
    }
    this.pending.clear();
    const now = this.engine.context.currentTime;
    for (const [sound, list] of bySound) {
      list.sort((a, b) => b.energy - a.energy);
      // What its allowance lets through: the loudest
      const a = this.allowance.get(sound) ?? { tokens: this.most * 2, at: now };
      a.tokens = Math.min(this.most * 2, a.tokens + (now - a.at) * this.rate);
      a.at = now;
      this.allowance.set(sound, a);
      const n = Math.min(this.most, Math.floor(a.tokens));
      a.tokens -= n;
      for (const p of list.slice(0, n)) {
        const at: V3 = [p.at[0] / p.weight, p.at[1] / p.weight, p.at[2] / p.weight];
        this.engine.play(sound, { at, volume: Math.min(1.3, Math.sqrt(p.energy)), pitch: p.pitch / p.weight, delay: p.delay });
      }
    }
  }

  dispose(): void {
    for (const off of this.off.splice(0)) off();
  }

  private impact(e: ImpactEvent, delay: number): void {
    if (e.speed < this.minSpeed) return;
    const p = e.piece;
    const now = this.engine.context.currentTime + delay;
    if (now - (this.struck.get(p) ?? -Infinity) < this.repeat) return;
    this.struck.set(p, now);
    const mass = p.volume * p.material.density;
    const heavy = this.soundsOf(p.materialName).heavy ?? this.heavy;
    const big = mass > heavy ? this.soundOf(p.materialName, 'heavyImpact') : null;
    const s = big ?? this.soundOf(p.materialName, 'impact');
    const hard = Math.min(1, (e.speed - this.minSpeed * 0.5) / 7);
    const intensity = hard * (0.35 + 0.65 * Math.min(1, Math.cbrt(mass / heavy)));
    // Heavier sounds lower
    const pitch = Math.min(1.2, Math.max(0.82, Math.pow(heavy / mass, big ? 0.05 : 0.08)));
    if (s) this.add(s, e.at, intensity, delay, pitch, 1, 0.06);
    // What it struck rings too, if it's something else (a brick on a fire escape)
    const o = e.other;
    if (o && o.materialName !== p.materialName && e.speed > 3) {
      const os = this.soundOf(o.materialName, 'impact');
      if (os) this.add(os, e.at, intensity * 0.45, delay, 1, 1, 0.06);
    }
  }

  /** A section (or a heavy piece) touched down: its material's land sound, once for all its pieces' first strikes. */
  private landed(e: LandedEvent): void {
    const s = this.soundOf(e.material, 'land');
    if (!s || e.speed < this.minSpeed) return;
    const now = this.engine.context.currentTime;
    for (const p of e.pieces) this.struck.set(p, now);
    const heavy = this.soundsOf(e.material).heavy ?? this.heavy;
    const hard = Math.min(1, (e.speed - this.minSpeed * 0.5) / 7);
    const loud = Math.min(1.3, hard * (0.5 + 0.3 * Math.log10(1 + e.mass / heavy)));
    const pitch = Math.max(0.8, Math.min(1, Math.pow(heavy / e.mass, 0.04)));
    this.add(s, e.at, loud, 0, pitch, 2);
  }

  /**
   * Add to what's played at this frame's end: merged with what's near in place and time (and
   * played at the same rate: a material sharing a sound at its own pitch stays apart).
   */
  private add(s: Heard, at: V3, intensity: number, delay: number, pitch = 1, spacing = 1, bucket = 0.08): void {
    if (intensity <= 0) return;
    const g = this.spacing * spacing;
    const key = `${s.name}|${s.pitch}|${Math.round(at[0] / g)},${Math.round(at[1] / g)},${Math.round(at[2] / g)}|${Math.round(delay / bucket)}`;
    let p = this.pending.get(key);
    if (!p) this.pending.set(key, (p = { sound: s.name, at: [0, 0, 0], pitch: 0, weight: 0, energy: 0, delay }));
    const w = intensity;
    p.at[0] += at[0] * w;
    p.at[1] += at[1] * w;
    p.at[2] += at[2] * w;
    p.pitch += pitch * s.pitch * w;
    p.weight += w;
    p.energy += intensity * intensity;
    p.delay = Math.min(p.delay, delay);
  }

  private soundsOf(material: string): MaterialSounds {
    return this.materials[material] ?? this.fallback;
  }

  /** The sound a material makes of a kind (null: none), at its pitch. */
  private soundOf(material: string, kind: SoundKind): Heard | null {
    const m = this.soundsOf(material);
    const name = m[kind];
    if (!name) return null;
    return { name, pitch: typeof m.pitch === 'number' ? m.pitch : (m.pitch?.[kind] ?? 1) };
  }

  /** The material most of these pieces are, by volume. */
  private mostly(pieces: Piece[]): string {
    const v = new Map<string, number>();
    for (const p of pieces) v.set(p.materialName, (v.get(p.materialName) ?? 0) + p.volume);
    let best = pieces[0]?.materialName ?? '';
    for (const [m, x] of v) if (x > (v.get(best) ?? 0)) best = m;
    return best;
  }
}
