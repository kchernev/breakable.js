// How the alley reacts. Signs short out with sparks when they break, and ones left hanging spark
// and stutter; every blast browns the street's light out for a moment; breaking the transformer box
// blacks it out (then the signs come back one by one); the hotel sign flickers on its own; shutters
// rattle and a shop alarm may ring; debris splashes into the puddles; vents steam; the four point
// lights die with what they hang on; a cut cable or lantern string swings down and hangs from the
// facades, a power cable sparking at its end. A shophouse facade that drops tips out into the
// alley, and the end block's face over the alley comes down once its arcade's front has gone; the
// gate comes down once a post no longer holds it. The neon buzz, the rain on the awnings and the
// steam are loops kept at the nearest ones that still stand.
//
// The gun: a sign struck sparks and stutters, and a few rounds in flickers, fizzes and goes dark
// (its light too); a lamp or a lit panel shot pops and goes out; a shutter rattles, and a shop's
// alarm may ring; a vent or a steam pipe shot gushes; a long burst browns the alley out and rattles
// the shutters round where it strikes; the wet street keeps a pale mark where a round struck it.

import * as THREE from 'three/webgpu';
import type { Destruction, ImpactEvent, Piece, V3, Voice } from '../../../lib/index.ts';
import { add, cross, normalize, scale, sub } from '../../../lib/index.ts';
import type { Burst, BulletHit } from '../../gun.ts';
import type { WorldRuntime } from '../types.ts';
import { END, FRONT, GATE, GROUND, levelY, onGround, T } from './layout.ts';
import { glow } from './materials.ts';
import { sceneryUpdate } from './scenery.ts';
import { type Sign, signs } from './signs.ts';
import { awnings, SLOT, type Sling, shutters, slings, structures, transformer } from './street.ts';
import { markStrike, updateMarks, updateStrips } from './wet.ts';

const dist = (a: V3, b: V3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
/** Where the player's eye is. */
const eye = (rt: WorldRuntime): V3 => [rt.camera.position.x, rt.camera.position.y, rt.camera.position.z];

/** The point lights, made with the scenery (adding lights later recompiles every material). */
const LIGHTS: Array<{ color: number; at: V3; intensity: number; tie: 'blade' | 'bridge' | 'gate' | 'arcade' }> = [
  { color: 0xff2bd6, at: [1.0, 6.0, 2.3], intensity: 30, tie: 'blade' },
  { color: 0x30e0ff, at: [7.6, 8.4, 0], intensity: 20, tie: 'bridge' },
  { color: 0xffa040, at: [-25.0, 4.0, 0], intensity: 18, tie: 'gate' },
  { color: 0xbcd8ff, at: [31.8, 4.5, 0], intensity: 24, tie: 'arcade' },
];
/**
 * The lights, and what each shines for besides what it hangs on: the sign it's the colour of (the
 * big blade's, the bridge's, the gate's board), or the arcade's lamp strip. Shot dark, it goes too.
 */
const lights: Array<{ light: THREE.PointLight; base: number; tie: string; fade: number; sign: number; lamps: Piece[] }> = [];

/**
 * The steam vents: the manhole, S3's wall exhaust (blowing out into the alley), the slot; and which
 * way each blows. The manhole's is in the street that breaks: it steams from what's under it (a
 * crater's floor, rubble).
 */
const VENTS: Array<{ at: V3; out: V3; street?: boolean }> = [
  { at: [12, 0.05, 0.8], out: [0, 1, 0], street: true },
  { at: [-7.5, 3.2, -3.6], out: [0, 0.3, 1] },
  { at: [-11.75, 0.05, -5], out: [0, 1, 0] },
];
/** Their steam: a thin wisp, and a jet for a while after a blast nearby. */
const WISP = { color: 0xc8d2dc, rise: 1.2, size: 1.4, life: 2.4, opacity: 0.5, speed: 0.5 };
const JET = { color: 0xdde4ea, rise: 2.5, size: 1.6, life: 2.2, opacity: 0.4, speed: 3 };

/** What the reactions keep (reset when the world is built). */
const s = {
  d: null as Destruction | null,
  ties: {} as Record<string, Piece[]>,
  bigBlade: null as Sign | null,
  /** Blasts' brown-outs: when, and how deep. */
  dips: [] as Array<{ t: number; depth: number }>,
  blackout: -1,
  sparksAt: [] as number[],
  /** When spark.zap last played, near (within 25 m) and far: one budget for breaks and hanging signs. */
  zapsNear: [] as number[],
  zapsFar: [] as number[],
  splashes: [] as number[],
  dangle: new Map<number, number>(),
  flicker: { sign: -1, next: 3, until: 0, level: 1 },
  buzz: new Map<number, Voice>(),
  rain: new Map<number, Voice>(),
  steam: [] as Array<{ voice: Voice | null; gush: number; puff: number }>,
  alarm: null as { voice: Voice; until: number } | null,
  loopsAt: 0,
  /** Cables struck (and hung), and the last segments of the hung power cables whose far end is free: they spark. */
  cut: new Set<Sling>(),
  live: [] as Array<{ wire: Piece; from: V3; next: number }>,
  /** The arcade's front: its two columns' feet, what they carry (the beam, the columns' upper parts), and the billboard over it, until it goes. */
  front: null as { feet: Piece[][]; carried: Piece[]; billboard: Piece[] } | null,
  /** The gate: each post's pieces and the rest (beams, cords, lanterns, board), as they're cut; when it's next looked at. */
  gate: null as { posts: Array<Set<Piece>>; rest: Set<Piece>; next: number } | null,
  /** The signs the gun struck (rounds taken, stuttering until), the ones dying (until when), the ones shot dark. */
  shot: new Map<number, { rounds: number; until: number }>(),
  dying: [] as Array<{ group: number; at: V3; until: number }>,
  dead: new Set<number>(),
  /** Lamps and lit panels shot: stuttering until they go out. */
  fading: [] as Array<{ pieces: Piece[]; until: number }>,
  /** When lamp.pop and neon.die last played (budgets). */
  pops: [] as number[],
  dies: [] as number[],
  /** The rounds of the burst going on (and when the last struck), and when the alley last browned out for one. */
  run: { rounds: 0, last: -Infinity, dip: -Infinity },
  /** Rounds into each shutter (its alarm), and when each last rattled for one. */
  rounds: new Map<number, number>(),
  rattled: new Map<number, number>(),
  /** Steam blowing out of pipes shot. */
  leaks: [] as Array<{ at: V3; out: V3; until: number; puff: number }>,
};

/** The point lights, in the scene from the start. */
export function pointLights(scene: THREE.Scene): void {
  lights.length = 0;
  for (const l of LIGHTS) {
    const light = new THREE.PointLight(l.color, l.intensity, 14, 2);
    light.position.set(...l.at);
    light.castShadow = false;
    scene.add(light);
    lights.push({ light, base: l.intensity, tie: l.tie, fade: 1, sign: -1, lamps: [] });
  }
}

/**
 * A shophouse facade that drops (its beam blown) tips out into the alley as it goes: its slabs stop
 * short of it, so nothing holds its top back. The library turns a section over the edge it's out
 * past, but this facade comes loose a few pieces at a time, and without the push more of it settles
 * on the building line over the shop; with it, the facade leans out from its base, lands in the
 * street and tears up.
 */
export function peelFacades(d: Destruction): void {
  d.on('collapse', ({ pieces }) => {
    for (const p of pieces) {
      const [, y, z] = p.pose.position;
      if (p.materialName !== 'render' || Math.abs(Math.abs(z) - (FRONT + T / 2)) > 0.2) continue;
      const v = 0.25 + 0.12 * Math.max(0, y - levelY(1));
      p.body.applyImpulse([0, -0.3 * p.mass, -Math.sign(z) * v * p.mass]);
    }
  });
}

/**
 * Of the end block's face over the alley (and what's on it, the billboard in front), above the
 * arcade. The face is wider than the alley, its ends behind N7's and S8's end walls; its band
 * joints break at the alley's edges (buildings.ts), so the part over the alley comes away alone.
 */
function endFace(p: Piece): boolean {
  const [x, y] = p.pose.position;
  return x > END.x0 - 0.2 && x < END.x0 + T && y > levelY(2) && p.bounds.min[2] > -FRONT - 0.05 && p.bounds.max[2] < FRONT + 0.05;
}

/**
 * The arcade's front beam carries the face over the alley. Once both its columns' feet are gone it
 * carries nothing, but the library holds it and the face up from the floors behind (or lets part
 * go, which jams in its slot between the bays beside it, the billboard dark at 10 m). So the beam
 * goes, and the face with it, turning out about its foot fast enough to clear its slot. What of the
 * face the library let go before (when the first column went) and is still in its slot is turned
 * out the same way. The billboard comes away from the face: held by its joints to the band behind
 * it, it was left hanging from the level 3 slab, dark at 10 m.
 */
function dropFront(d: Destruction, carried: Piece[], billboard: Piece[]): void {
  d.release(carried);
  const sign = new Set(billboard);
  for (const p of billboard) for (const b of [...p.bonds]) if (!sign.has(b.other(p))) d.unbond(b);
  const face = d.all().filter((p) => (p.state === 'fixed' || p.state === 'loose') && endFace(p));
  let volume = 0;
  let y = 0;
  for (const p of face) {
    volume += p.volume;
    y += p.pose.position[1] * p.volume;
  }
  y /= Math.max(volume, 1e-9);
  const velocity: V3 = [-(0.6 + 0.25 * (y - levelY(2))), -0.2, 0];
  const spin: V3 = [0, 0, 0.25];
  const loose = face.filter((p) => p.state === 'loose');
  d.release(face, velocity, spin);
  let center: V3 = [0, 0, 0];
  let mass = 0;
  for (const p of loose) {
    center = add(center, scale(p.pose.position, p.mass));
    mass += p.mass;
  }
  center = scale(center, 1 / Math.max(mass, 1e-9));
  for (const p of loose) p.body.applyImpulse(scale(add(velocity, cross(spin, sub(p.pose.position, center))), p.mass));
}

/** After building: what the lights hang on, the signs' groups, the vents. */
export function startLife(d: Destruction, bigBlade: Sign | null, arcade: Piece[], billboard: Piece[]): void {
  s.d = d;
  s.ties = { gate: structures.gate, bridge: structures.bridge, arcade, blade: bigBlade?.pieces ?? [] };
  s.bigBlade = bigBlade;
  s.dips = [];
  s.blackout = -1;
  s.dangle.clear();
  s.flicker.sign = signs.findIndex((x) => x.flicker);
  signs.forEach((sign, i) => {
    for (const p of sign.pieces) glow.tag(p, i);
  });
  s.shot.clear();
  s.dying = [];
  s.dead.clear();
  s.fading = [];
  s.run = { rounds: 0, last: -Infinity, dip: -Infinity };
  s.rounds.clear();
  s.rattled.clear();
  s.leaks = [];
  // The big blade's light shines for it, the bridge's and the gate's for the sign nearest them, the
  // arcade's for its lamp strip (under the level 2 slab)
  const nearest = (at: V3) => signs.reduce((best, x, i) => (dist(x.centre, at) < dist(signs[best].centre, at) ? i : best), 0);
  for (const l of lights) {
    const at: V3 = [l.light.position.x, l.light.position.y, l.light.position.z];
    l.fade = 1;
    l.sign = l.tie === 'blade' ? (bigBlade ? signs.indexOf(bigBlade) : -1) : l.tie === 'arcade' ? -1 : nearest(at);
    l.lamps = l.tie === 'arcade' ? d.all().filter((p) => p.materialName === 'lamp' && glow.lit(p) && p.pose.position[0] > END.x0 && Math.abs(p.pose.position[1] - (levelY(2) - 0.03)) < 0.1) : [];
  }
  // The gate's posts (the wood under the tie beam, each side), and what they carry
  const post = (p: Piece) => p.materialName === 'wood' && p.bounds.max[1] < GATE.posts + 0.05;
  s.gate = {
    posts: [-1, 1].map((side) => new Set(structures.gate.filter((p) => post(p) && Math.sign(p.pose.position[2]) === side))),
    rest: new Set(structures.gate.filter((p) => !post(p))),
    next: 0,
  };
  d.on('fracture', ({ piece, pieces }) => {
    if (!s.gate) return;
    for (const set of [...s.gate.posts, s.gate.rest])
      if (set.delete(piece)) for (const c of pieces) set.add(c);
  });
  s.steam = VENTS.map(() => ({ voice: null, gush: 0, puff: Math.random() * 0.3 }));
  s.cut.clear();
  s.live = [];
  // The columns' feet are their pieces under level 1; the rest of the front hangs from the beam
  const front = arcade.filter((p) => p.pose.position[0] < END.x0 + 0.7);
  s.front = {
    feet: [-1, 1].map((side) => front.filter((p) => Math.sign(p.pose.position[2]) === side && p.pose.position[1] < levelY(1))),
    carried: front.filter((p) => p.pose.position[1] > levelY(1)),
    billboard,
  };
}

/** The street's power now: brown-outs from blasts, the blackout. */
function power(t: number): number {
  let p = 1;
  for (const d of s.dips) {
    const a = t - d.t;
    if (a < 0 || a > 1) continue;
    // Down at once, a few stutters, back up over 0.6 s
    let v: number;
    if (a < 0.08) v = 1 - d.depth;
    else if (a < 0.4) v = Math.sin(a * 90) > 0.2 ? 1 - d.depth * 0.6 : 1 - d.depth;
    else v = 1 - d.depth * Math.max(0, 1 - (a - 0.4) / 0.6);
    p = Math.min(p, v);
  }
  if (s.blackout >= 0) {
    const a = t - s.blackout;
    // The arc (0.4 … 2.35 s): a hard stutter; then dark for 1.5 s; then back over 2.5 s in steps
    if (a < 0.4) p = Math.min(p, 0.5);
    else if (a < 2.35) p = Math.min(p, Math.sin(a * 53) * Math.sin(a * 17) > 0 ? 1 : 0.15);
    else if (a < 3.85) p = 0;
    else if (a < 6.35) {
      const k = (a - 3.85) / 2.5;
      p = Math.min(p, Math.floor(k * 6) / 6 + (Math.sin(a * 70) > 0.6 ? 0.15 : 0));
    }
  }
  return Math.max(0, p);
}

/**
 * A cable struck no longer stands stiff: once a blast has cut or shaken it loose, what's left of it
 * from each end still tied to its facade hangs there, each segment from the one before and each
 * lantern from its joint (a hinge each, so it drapes and swings); one that still spans the alley is
 * hung from both ends.
 */
function hangCut(rt: WorldRuntime): void {
  for (const sl of slings) {
    if (s.cut.has(sl) || (sl.segments.every((p) => p.state === 'fixed') && sl.ends.every((p) => p.state === 'fixed'))) continue;
    s.cut.add(sl);
    const last = sl.segments[sl.segments.length - 1];
    if (hang(rt, sl, 0) < sl.segments.length) hang(rt, sl, 1);
    else if (sl.ends[1].state === 'fixed') rt.destruction.hinge(last, sl.at[1], across(sl), { to: sl.ends[1] });
  }
}

/** Level and across a cable: what it swings about. */
const across = (sl: Sling): V3 => {
  const [a, b] = sl.at;
  return normalize(cross([b[0] - a[0], b[1] - a[1], b[2] - a[2]], [0, 1, 0]));
};

/** Hang what's left of a cable from its end `e` (0: its first, 1: its last). Returns how many segments it hung. */
function hang(rt: WorldRuntime, sl: Sling, e: 0 | 1): number {
  const d = rt.destruction;
  const end = sl.ends[e];
  if (end.state !== 'fixed') return 0;
  const n = sl.segments.length;
  const axis = across(sl);
  let hung = 0;
  let from = end;
  let at = sl.at[e];
  for (let k = 0; k < n; k++) {
    const i = e === 0 ? k : n - 1 - k;
    const seg = sl.segments[i];
    // Gone, or thrown: what's past it isn't held from this end
    if (seg.state === 'gone' || dist(seg.pose.position, sl.built[i]) > 0.3) break;
    d.hinge(seg, at, axis, { to: from });
    from = seg;
    hung++;
    // The joint at its far end, and the lantern there
    const j = e === 0 ? i : i - 1;
    if (j < 0 || j >= sl.joints.length) break;
    at = sl.joints[j];
    const lantern = sl.hung[j];
    if (lantern.length && lantern[0].state === 'fixed') {
      d.release(lantern);
      d.hinge(lantern[0], at, axis, { to: seg });
    }
  }
  // A power cable whose far end is free now (cut, or its other end gone) sparks there
  if (sl.power && hung && (hung < n || sl.ends[1 - e].state !== 'fixed')) s.live.push({ wire: from, from: sl.at[e], next: rt.time + 0.5 + Math.random() });
  return hung;
}

/** What clanks underfoot: a fallen shutter, a sign box, a grate. */
const METAL = new Set(['signbox', 'steel', 'shutter', 'grate']);

/**
 * The step for where the feet come down (audio.footsteps.surface): metal clanks; down in a crater
 * the broken concrete and the earth crunch; under a slab or a ceiling within 7 m (in a shop, in the
 * arcade) the ground is dry, whatever hangs below it (lamps, signs); elsewhere the wet street's own
 * step.
 */
export function footstep(at: V3, material: string | null, rubble: boolean): string | undefined {
  if (material && METAL.has(material)) return 'steps.metal';
  if (material === 'base' || (!material && onGround(at[0], at[2]) && at[1] < -0.05)) return 'steps.rubble';
  if (rubble || !s.d) return undefined;
  let y = at[1] + 0.2;
  for (let k = 0; k < 4; k++) {
    const hit = s.d.raycast([at[0], y, at[2]], [0, 1, 0], at[1] + 7 - y);
    if (!hit) return undefined;
    if (hit.piece.materialName === 'concrete' || hit.piece.materialName === 'tile') return 'steps.asphalt';
    y = hit.piece.bounds.max[1] + 0.01;
  }
  return undefined;
}

/**
 * Whether the gate still stands as built: each post, from its foot on the street up through its
 * own pieces, reaches the tie beam. A post blown at its foot was left hanging from the beam 2 m up
 * (the other post held the beams); once one doesn't reach, the beams and all they carry come down
 * (turning over the post that stands), with what of the broken post hangs from them.
 */
function gateDown(d: Destruction): void {
  const g = s.gate!;
  const held = g.posts.map((post) => {
    const up = [...post].filter((p) => p.state === 'fixed');
    const on = new Set(up);
    const seen = new Set(up.filter((p) => p.bounds.min[1] < 0.05 && [...p.bonds].some((b) => b.other(p).ground && b.other(p).state === 'fixed')));
    for (const p of seen) for (const b of p.bonds) if (on.has(b.other(p))) seen.add(b.other(p));
    return [...seen].some((p) => p.bounds.max[1] > GATE.posts - 0.05) ? seen : null;
  });
  if (held.every((h) => h)) return;
  const fall = [...g.rest, ...g.posts.flatMap((post, i) => (held[i] ? [] : [...post]))];
  d.release(fall.filter((p) => p.state === 'fixed'));
  s.gate = null;
}

/** The street's power browns out (everyone's on one feed: deeper near the middle of the alley). */
function brownOut(at: V3, depth: number, t: number): void {
  const near = Math.max(0, 1 - Math.abs(at[0] - 2) / 60);
  s.dips.push({ t, depth: Math.min(0.75, depth + near * 0.2) });
  if (s.dips.length > 6) s.dips.shift();
}

/** The `n` standing shutters nearest `at` within `range` (nearest first). */
function shuttersNear(at: V3, n: number, range: number): Array<{ x: (typeof shutters)[number]; d: number }> {
  return shutters
    .filter((x) => x.pieces.some((p) => p.state === 'fixed'))
    .map((x) => ({ x, d: dist(x.centre, at) }))
    .filter((e) => e.d < range)
    .sort((a, b) => a.d - b.d)
    .slice(0, n);
}

/** Shutters rattle, louder nearer (`loud` at the nearest). */
function rattle(near: Array<{ x: { centre: V3 }; d: number }>, range: number, loud: number, rt: WorldRuntime): void {
  for (const { x, d } of near) rt.sound.play('shutter.rattle', { at: x.centre, volume: loud * Math.min(1.2, 0.5 + (range - d) / range) });
}

/** A shop's alarm by a shutter starts ringing a moment later (one at a time, for 15 to 25 s). */
function ring(at: V3, rt: WorldRuntime): void {
  if (s.alarm) return;
  const voice = rt.sound.play('alarm.bell', { at, delay: 0.5 + Math.random() });
  if (voice) s.alarm = { voice, until: rt.time + 15 + Math.random() * 10 };
}

/** A vent gushes for `seconds` (a burst of steam as it starts). */
function gush(i: number, seconds: number, rt: WorldRuntime): void {
  const v = s.steam[i];
  if (rt.time >= v.gush) rt.sound.play('steam.burst', { at: VENTS[i].at, volume: 0.8 });
  v.gush = Math.max(v.gush, rt.time + seconds);
}

/** Steam blows out of a pipe where a round struck it, for a few seconds (three pipes at most). */
function leak(at: V3, out: V3, rt: WorldRuntime): void {
  const old = s.leaks.find((l) => dist(l.at, at) < 0.4);
  if (old) {
    old.until = rt.time + 3.5;
    return;
  }
  if (s.leaks.length >= 3) s.leaks.shift();
  s.leaks.push({ at, out, until: rt.time + 3.5, puff: 0 });
  rt.sound.play('steam.burst', { at });
}

/** Sparks, if the budget allows (6 bursts a second, from breaks and the gun). */
function spark(rt: WorldRuntime, at: V3, normal: V3, amount: number, color: number): boolean {
  while (s.sparksAt.length && s.sparksAt[0] < rt.time - 1) s.sparksAt.shift();
  if (s.sparksAt.length >= 6) return false;
  s.sparksAt.push(rt.time);
  rt.effects.sparks(at, normal, amount, color);
  return true;
}

/** A sound, if fewer than `most` of it played in the last second. */
function budget(rt: WorldRuntime, list: number[], most: number, name: string, at: V3): void {
  while (list.length && list[0] < rt.time - 1) list.shift();
  if (list.length >= most) return;
  list.push(rt.time);
  rt.sound.play(name, { at });
}

/** Rounds into a sign before it goes dark: a few, more for a big one (the big blade's 5). */
const toKill = (sign: Sign): number => Math.min(6, 3 + Math.floor(sign.pieces.length / 30));

/** A round into a sign (a tube, a face, its raceway or backing): sparks and a stutter; a few in, it dies. */
function shootSign(g: number, hit: BulletHit, rt: WorldRuntime, me: V3): void {
  if (s.dead.has(g) || s.dying.some((e) => e.group === g)) return;
  const sign = signs[g];
  const e = s.shot.get(g) ?? { rounds: 0, until: 0 };
  s.shot.set(g, e);
  if (++e.rounds >= toKill(sign)) {
    // A hard flicker, the fizz and pop (neon.die: its pop at 0.7 to 1.4 s), then dark
    s.dying.push({ group: g, at: hit.at, until: rt.time + 0.75 + Math.random() * 0.25 });
    budget(rt, s.dies, 2, 'neon.die', sign.centre);
    return;
  }
  e.until = rt.time + 0.12 + Math.random() * 0.2;
  // A round that broke a lit piece sparks where it broke (glow.lost); one that didn't, here
  if (!hit.broke && spark(rt, hit.at, hit.normal, 0.3, sign.color)) zap(rt, hit.at, me, 0.6);
}

/** A lamp or a lit panel shot: what of it still glows stutters a moment and goes out, with a pop. */
function shootLamp(p: Piece, hit: BulletHit, rt: WorldRuntime): void {
  const pieces = glow.litOf(p);
  if (!pieces.length) return;
  s.fading.push({ pieces, until: rt.time + 0.1 + Math.random() * 0.25 });
  // (One that broke pops where it broke: glow.lost)
  if (!hit.broke) {
    budget(rt, s.pops, 3, 'lamp.pop', hit.at);
    spark(rt, hit.at, hit.normal, 0.2, 0xfff0d8);
  }
}

/** The shutter a point is on (within 2.5 m of its middle along the facade), or -1. */
const shutterAt = (at: V3): number => shutters.findIndex((x) => Math.hypot(x.centre[0] - at[0], x.centre[2] - at[2]) < 2.5);

/**
 * A round of the gun struck something (its chips, mark and sound are the demo's). Every reaction
 * here is bounded: a burst of 70 rounds sets off a few of each at most.
 */
export function onShot(hit: BulletHit, rt: WorldRuntime): void {
  const t = rt.time;
  const p = hit.piece;
  const g = p ? glow.groupOf(p) : undefined;
  if (p && g !== undefined) shootSign(g, hit, rt, eye(rt));
  else if (p && (p.materialName === 'lamp' || p.materialName === 'lightbox')) shootLamp(p, hit, rt);
  // The wet street keeps a pale mark round the hole (not where a round bit it away)
  if (!hit.broke && hit.normal[1] > 0.7 && Math.abs(hit.at[1]) < 0.05 && (!p || p.materialName === 'asphalt')) markStrike(hit.at);
  // A shutter rattles in its rails (each at most every 0.7 s); at a second round its alarm may go
  // off (a round or two tears it open, and the next go through)
  if (p?.materialName === 'shutter') {
    const i = shutterAt(hit.at);
    if (i >= 0) {
      if (t - (s.rattled.get(i) ?? -Infinity) > 0.7) {
        s.rattled.set(i, t);
        rt.sound.play('shutter.rattle', { at: hit.at, volume: 0.35 });
      }
      const n = (s.rounds.get(i) ?? 0) + 1;
      s.rounds.set(i, n);
      if (n === 2 && Math.random() < 0.6) ring(shutters[i].centre, rt);
    }
  }
  // A vent struck gushes; a steam pipe in the slot blows out where it was struck
  s.steam.forEach((_, i) => {
    if (dist(VENTS[i].at, hit.at) < 0.6) gush(i, 6, rt);
  });
  if (p?.materialName === 'steel' && hit.at[0] > SLOT.x0 - 0.3 && hit.at[0] < SLOT.x1 && hit.at[2] < -FRONT) leak(hit.at, hit.normal, rt);
  // A long burst: the street's power browns out as for a blast, and the shutters nearest where it
  // strikes rattle, once it has gone on 1.4 s (20 rounds), and again every 5 s it goes on
  const run = s.run;
  if (t - run.last > 0.5) run.rounds = 0;
  run.rounds++;
  run.last = t;
  if (run.rounds >= 20 && t - run.dip > 5) {
    run.dip = t;
    brownOut(hit.at, 0.25, t);
    rattle(shuttersNear(hit.at, 2, 10), 10, 0.7, rt);
  }
}

/** A burst ended: after a long one, a shop's alarm near where it struck may go off. */
export function onBurst(burst: Burst, rt: WorldRuntime): void {
  s.run.rounds = 0;
  if (!burst.at || burst.seconds < 1.5) return;
  const [near] = shuttersNear(burst.at, 1, 8);
  if (near && Math.random() < 0.35) ring(near.x.centre, rt);
}

export function onBlast(at: V3, radius: number, rt: WorldRuntime): void {
  // Brown-out: deeper for bigger, nearer blasts
  brownOut(at, 0.35 + radius * 0.08, rt.time);
  // Shutters rattle (the nearest three), louder nearer; a shop alarm may ring
  const near3 = shuttersNear(at, 3, 14);
  rattle(near3, 14, 1, rt);
  if (near3.length && near3[0].d < 9 && Math.random() < 0.6) ring(near3[0].x.centre, rt);
  // Vents nearby gush
  s.steam.forEach((_, i) => {
    if (dist(VENTS[i].at, at) < 6) gush(i, 8, rt);
  });
}

export function onImpact(e: ImpactEvent, rt: WorldRuntime): void {
  // Debris landing in the wet (the street, or a crater): a splash and a pale puff, at most 8 a second
  if ((e.other !== null && !e.other.ground) || e.at[1] > 0.3 || e.speed < 2.5 || e.piece.mass < 0.05) return;
  const t = rt.time;
  while (s.splashes.length && s.splashes[0] < t - 1) s.splashes.shift();
  if (s.splashes.length >= 8) return;
  s.splashes.push(t);
  rt.sound.play('splash.debris', { at: e.at, volume: Math.min(1.2, 0.35 + e.impulse * 0.05) });
  rt.effects.dust(e.at, 0.02, 0xaab8c8);
}

/** Voices in use above which the loops aren't restarted (the engine has 40). */
const BUSY = 30;

/** A spark.zap, if the budget allows: 3 a second within 25 m of the player, 1 a second beyond. */
function zap(rt: WorldRuntime, at: V3, me: V3, volume: number): void {
  const near = dist(at, me) < 25;
  const list = near ? s.zapsNear : s.zapsFar;
  while (list.length && list[0] < rt.time - 1) list.shift();
  if (list.length >= (near ? 3 : 1)) return;
  list.push(rt.time);
  rt.sound.play('spark.zap', { at, volume });
}

export function update(dt: number, rt: WorldRuntime): void {
  const t = rt.time;
  const me = eye(rt);
  sceneryUpdate(dt, t);

  // Signs shorting out where they broke: sparks in their colour, at most 6 bursts a second, and a
  // zap (a lamp or a lit panel pops); a paper lantern only tears when it breaks (a quiet, high
  // knock of its frame and a red puff)
  for (const l of glow.lost.splice(0)) {
    if (l.material === 'lantern') {
      if (!l.cracked) continue;
      rt.sound.play('wood.impact', { at: l.at, volume: 0.3, pitch: 1.7 });
      rt.effects.dust(l.at, 0.02, 0xc8281e);
      continue;
    }
    if (!spark(rt, l.at, [0, -1, 0], l.cracked ? 0.35 : 0.6, new THREE.Color(l.tint[0], l.tint[1], l.tint[2]).getHex())) continue;
    if (l.group < 0 && (l.material === 'lamp' || l.material === 'lightbox')) budget(rt, s.pops, 3, 'lamp.pop', l.at);
    else zap(rt, l.at, me, 0.8);
  }

  // The transformer: a blackout, once
  const tp = transformer.piece;
  if (tp && s.blackout < 0 && tp.state !== 'fixed') {
    s.blackout = t;
    const at = tp.pose.position;
    rt.effects.explosion(at, [-1, 0, 0], 0.15);
    rt.effects.sparks(at, [-1, 0, 0], 2, 0xbfe8ff);
    rt.sound.play('transformer.blow', { at });
    transformer.piece = null;
  }
  if (s.blackout >= 0) {
    const a = t - s.blackout;
    if (a > 0.4 && a < 2.35 && Math.random() < dt * 8) rt.effects.sparks([5.8, 5.4 + Math.random() * 0.4, 9.7], [-1, 0, 0], 0.4, 0xbfe8ff);
    if (a > 2.35 && a < 3.85 && s.buzz.size) {
      for (const v of s.buzz.values()) v.stop(0.05);
      s.buzz.clear();
    }
  }
  const p = power(t);
  glow.power.value = p;

  // The hotel sign's own flicker: mostly on, stutters every few seconds, now and then out for a second
  const fl = s.flicker;
  const bySign = glow.bySign();
  if (fl.sign >= 0) {
    if (t > fl.next) {
      fl.until = t + (Math.random() < 0.15 ? 1.0 : 0.15 + Math.random() * 0.45);
      fl.next = fl.until + 3 + Math.random() * 6;
    }
    fl.level = t < fl.until ? (fl.until - t > 0.9 ? 0 : Math.random() < 0.5 ? 0.1 : 1) : 1;
    for (const piece of bySign.get(fl.sign) ?? []) glow.dim(piece, fl.level);
    s.buzz.get(fl.sign)?.setVolume(0.2 + fl.level * 0.9, 0.02);
  }

  // Signs left hanging stutter; the 6 nearest spark every 1 to 3 s at a piece still up, and the 3
  // nearest of those zap
  const hanging: Array<{ g: number; pieces: Piece[]; d: number }> = [];
  for (const [g, pieces] of bySign) {
    const sign = signs[g];
    if (!sign || pieces.length === sign.pieces.length) continue;
    if (!sign.pieces.some((q) => q.state !== 'fixed')) continue;
    hanging.push({ g, pieces, d: dist(sign.centre, me) });
    const stutter = Math.random() < 0.12 ? 0.2 : 1;
    for (const q of pieces) glow.dim(q, stutter);
  }
  hanging.sort((a, b) => a.d - b.d);
  hanging.slice(0, 6).forEach(({ g, pieces }, rank) => {
    const next = s.dangle.get(g) ?? t + 0.5 + Math.random();
    if (t < next) {
      s.dangle.set(g, next);
      return;
    }
    const q = pieces[Math.floor(Math.random() * pieces.length)];
    rt.effects.sparks(q.pose.position, [0, -1, 0], 0.4, 0xd8f8ff);
    if (rank < 3) zap(rt, q.pose.position, me, 0.5);
    s.dangle.set(g, t + 1 + Math.random() * 2);
  });

  // The gun's: a sign struck stutters a moment; one shot dark flickers hard (flaring), then goes out
  // for good with a last spray of sparks; a lamp or panel shot stutters, then goes out. The street
  // reflects each at its level (the hotel sign's flicker too)
  const levels = new Map<number, number>();
  if (fl.sign >= 0) levels.set(fl.sign, fl.level);
  for (const [g, e] of s.shot) {
    if (!e.until) continue;
    const k = t < e.until ? (Math.random() < 0.5 ? 0.15 : 1) : 1;
    for (const q of bySign.get(g) ?? []) glow.dim(q, k);
    if (t < e.until) levels.set(g, k);
    else e.until = 0;
  }
  for (const e of s.dying) {
    const pieces = bySign.get(e.group) ?? [];
    if (t < e.until) {
      const k = Math.random() < 0.3 ? 1.4 : 0.05;
      for (const q of pieces) glow.dim(q, k);
      levels.set(e.group, k);
      continue;
    }
    for (const q of pieces) glow.out(q);
    s.dead.add(e.group);
    spark(rt, e.at, [0, -1, 0], 0.7, signs[e.group].color);
  }
  s.dying = s.dying.filter((e) => !s.dead.has(e.group));
  for (const e of s.fading) for (const q of e.pieces) (t < e.until ? glow.dim(q, Math.random() < 0.5 ? 0.1 : 1.3) : glow.out(q));
  s.fading = s.fading.filter((e) => t < e.until);
  glow.update();
  updateStrips(rt.camera.position, levels);
  updateMarks();

  // The arcade's front gone from under the face over the alley: it comes down
  if (s.front?.feet.every((foot) => foot.every((q) => q.state !== 'fixed'))) {
    dropFront(rt.destruction, s.front.carried, s.front.billboard);
    s.front = null;
  }

  // The gate, once a post no longer holds it, comes down (looked at four times a second)
  if (s.gate && t >= s.gate.next) {
    s.gate.next = t + 0.25;
    gateDown(rt.destruction);
  }

  // Cut cables hang; the power cables' free ends spark every 1 to 3 s while the street has power
  hangCut(rt);
  for (const w of s.live) {
    if (w.wire.state !== 'loose' || t < w.next) continue;
    w.next = t + 1 + Math.random() * 2;
    if (p < 0.3) continue;
    const tip = w.wire.corners.reduce((x, y) => (dist(x, w.from) > dist(y, w.from) ? x : y));
    rt.effects.sparks(tip, [0, -1, 0], 0.3, 0xd8f0ff);
    zap(rt, tip, me, 0.4);
  }

  // The point lights follow the power (and their sign's flicker as it's shot), and die with what
  // they hang on, or with what they shine for once it's shot dark
  for (const l of lights) {
    const tie = s.ties[l.tie] ?? [];
    if (l.fade > 0) {
      const up = tie.length ? tie.filter((q) => q.state === 'fixed').length / tie.length : 1;
      const shot = s.dead.has(l.sign) || (l.lamps.length > 0 && !l.lamps.some((q) => glow.lit(q)));
      if (up < 0.3 || shot) l.fade = Math.max(0, l.fade - dt / 0.5);
    }
    const flick = l.fade > 0 && l.fade < 1 && Math.random() < 0.3 ? 0.3 : 1;
    l.light.intensity = l.base * p * l.fade * flick * Math.min(1.2, levels.get(l.sign) ?? 1);
  }

  // Steam blowing out of shot pipes: a jet along the way out of the hole
  for (const l of s.leaks) {
    l.puff -= dt;
    if (l.puff > 0) continue;
    l.puff = 0.07;
    const { speed, ...look } = JET;
    rt.effects.puff(add(l.at, scale(l.out, 0.06)), { ...look, size: 1.1, velocity: [l.out[0] * speed, l.out[1] * speed + 0.4, l.out[2] * speed] });
  }
  s.leaks = s.leaks.filter((l) => t < l.until);

  // Steam: a thin wisp, a puff every 0.25 s; a jet while gushing
  s.steam.forEach((v, i) => {
    const gushing = t < v.gush;
    v.puff -= dt;
    if (v.puff <= 0) {
      v.puff = gushing ? 0.06 : 0.25;
      const { at, out, street } = VENTS[i];
      const { speed, ...look } = gushing ? JET : WISP;
      const from: V3 = street ? [at[0], (rt.destruction.raycast([at[0], 0.6, at[2]], [0, -1, 0], 0.6 - GROUND.bed)?.point[1] ?? GROUND.bed) + 0.05, at[2]] : at;
      rt.effects.puff(from, { ...look, velocity: [out[0] * speed, out[1] * speed, out[2] * speed] });
    }
    v.voice?.setVolume(gushing ? 2.5 : 1, gushing ? 0.2 : 2);
  });

  if (s.alarm && t > s.alarm.until) {
    s.alarm.voice.stop(0.3);
    s.alarm = null;
  }

  // The loops at the nearest things that still stand, every half second, and only where they're
  // heard over the rain: a sign's buzz within 12 m, an awning's rain within 12 m, a vent's hiss
  // within 14 m (stopping past 18). While the gun keeps firing it drowns the buzz and the awning's
  // rain: their voices go to the strikes until it stops
  if (t >= s.loopsAt) {
    s.loopsAt = t + 0.5;
    const dark = s.blackout >= 0 && t - s.blackout > 2.35 && t - s.blackout < 4.5;
    const firing = s.run.rounds >= 8 && t - s.run.last < 0.5;
    const lit = [...bySign.keys()]
      .map((g) => ({ g, d: dist(signs[g].centre, me) }))
      .filter((e) => e.d < 12)
      .sort((a, b) => a.d - b.d)
      .slice(0, dark || firing ? 0 : 2);
    keep(rt, s.buzz, lit, (g) => signs[g].centre, 'neon.buzz');
    const up = awnings
      .map((a, i) => ({ g: i, d: dist(a.centre, me), a }))
      .filter((e) => e.d < 12 && e.a.pieces.some((q) => q.state === 'fixed' && q.materialName === 'awning'))
      .sort((a, b) => a.d - b.d)
      .slice(0, firing ? 0 : 1);
    keep(rt, s.rain, up, (i) => awnings[i].centre, 'rain.awning');
    // The nearest vent hisses (started again whenever there's no voice: the sounds may still be
    // loading at first, or the voice was taken); the others, and it once out of range, stop
    const ds = VENTS.map((v) => dist(v.at, me));
    const nearest = ds.indexOf(Math.min(...ds));
    s.steam.forEach((v, i) => {
      const d = ds[i];
      if (v.voice && (!v.voice.live || d > 18 || i !== nearest)) {
        v.voice.stop(0.5);
        v.voice = null;
      }
      if (!v.voice && i === nearest && d < 14 && rt.sound.active < BUSY && rt.sound.has('steam.hiss')) v.voice = rt.sound.play('steam.hiss', { at: VENTS[i].at, fadeIn: 1 });
    });
  }
}

/** Keep a loop playing at each of `want` (by id), stopping the others. */
function keep(rt: WorldRuntime, voices: Map<number, Voice>, want: Array<{ g: number }>, at: (g: number) => V3, sound: string): void {
  const ids = new Set(want.map((w) => w.g));
  for (const [g, v] of voices)
    if (!ids.has(g) || !v.live) {
      v.stop(0.3);
      voices.delete(g);
    }
  for (const { g } of want) {
    if (voices.has(g) || rt.sound.active >= BUSY) continue;
    const v = rt.sound.play(sound, { at: at(g), fadeIn: 0.3 });
    if (v) voices.set(g, v);
  }
}
