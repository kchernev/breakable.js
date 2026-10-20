// Sun Temple: a Doric sanctuary on a limestone hilltop above the Mediterranean at midday. A marble
// temple faces east over its altar; a treasury north of it, a domed tholos to the south-west, the
// ruin of a stoa along the north cliff, a gate on the east. Cypresses and olives, dry grass and
// pale rock, the sea far below with islands in the haze. Cicadas fall silent at a blast or a burst of
// the gun, jackdaws burst off the roofs, the bay echoes it back, the bronze goddess rings when she's
// shot, leaves flutter down off a shot olive, and what goes over the cliff splashes into the sea.

import { type LandedEvent, packMaterials, type Piece, random, type V3 } from '../../../lib/index.ts';
import type { WorldDefinition, WorldRuntime } from '../types.ts';
import { buildPropylon, buildTreasury } from './buildings.ts';
import { Flock, Gulls, Leaves } from './flock.ts';
import { layGround } from './ground.ts';
import { Kit } from './kit.ts';
import { AREAS, LAYERS, PLACES, SEA, terrain, within } from './layout.ts';
import { templeMaterials } from './materials.ts';
import { meta } from './meta.ts';
import { placeProps } from './props.ts';
import { buildScenery } from './scenery.ts';
import { buildAltar, buildFragments, buildPedestals, buildRamp, buildStatueBase, buildStelai, buildTemenos, buildVotive } from './small.ts';
import { buildStoa } from './stoa.ts';
import { buildTemple } from './temple.ts';
import { buildTholos } from './tholos.ts';
import { buildTrees } from './trees.ts';

// Far things fade into a clear blue haze, not the pale grey of the sky's last degree; the
// mountains at 1.2..1.7 km keep a little of their shading in it
const FOG = { color: 0xb4c6d8, near: 90, far: 1900 };

/** What the reactions keep between frames. */
const state = {
  kit: null as Kit | null,
  bronze: new Set<Piece>(),
  /** When each bronze prop last rang (by piece id). */
  rang: new Map<number, number>(),
  /** Until when the cicadas stay quiet after a blast or a burst (they come back after). */
  quietUntil: 0,
  silenced: false,
  flock: null as Flock | null,
  gulls: null as Gulls | null,
  leaves: null as Leaves | null,
  birdsAt: -Infinity,
  echoAt: -Infinity,
  puffs: 0,
  splashWait: 0,
  /** Masses of leaves that landed whole, to burst next frame. */
  landed: new Map<Piece, V3>(),
  /** The offering smouldering on the altar, and when it next smokes. */
  fire: [] as Piece[],
  smokeAt: 0,
  /** The strikes of the burst going on (onBurst has the burst's rounds once it ends), and when the last came. */
  shots: 0,
  shotAt: -Infinity,
};

/** A mass of leaves that fell whole bursts where it lands: a spray of leaves, a little leaf dust. */
function burstLeaves(p: Piece, at: V3, rt: WorldRuntime): void {
  const v = p.volume;
  rt.destruction.removePiece(p);
  rt.effects.dust(at, Math.min(0.25, 0.04 + v * 0.12), world.dust[p.materialName]);
  const sprays = Math.min(4, 1 + Math.round(v * 3));
  for (let i = 0; i < sprays; i++) rt.effects.impact([at[0] + (Math.random() - 0.5) * 0.6, at[1] + 0.2 + Math.random() * 0.4, at[2] + (Math.random() - 0.5) * 0.6], [(Math.random() - 0.5) * 0.8, 1, (Math.random() - 0.5) * 0.8], world.chips[p.materialName]);
  rt.sound.play('foliage.break', { at, volume: Math.min(1, 0.3 + v) });
}

/** The marbles: what puffs white when it lands, and what's heard landing as stone on stone. */
const STONE = new Set(['marble', 'drum', 'triglyph', 'ruin']);
/** What's heard underfoot as stone (steps, stylobates, the court's flags, fallen blocks, the rock in a crater): not gravel. */
const PAVED = new Set([...STONE, 'limestone', 'paving', 'rock']);

/** The buildings birds roost on: where their ridges are, and which way the sea is from them. */
const ROOSTS: Array<{ at: V3; away: [number, number] }> = [
  { at: [PLACES.temple.x, 10.6, PLACES.temple.z], away: [-0.9, -0.4] },
  { at: [PLACES.treasury.x, 8.3, PLACES.treasury.z], away: [-0.3, -0.95] },
  { at: [PLACES.tholos.x, 9.8, PLACES.tholos.z], away: [-0.95, -0.3] },
];

/** Where the bay's echo comes back from: the water and the islands, 400 m out to the west. */
const BAY: V3 = [-400, -40, -60];

/** The bay's echo of a blast: a second or two later (and the 1.2 s from 400 m the engine adds). */
function echo(rt: WorldRuntime): void {
  if (rt.time - state.echoAt < 3) return;
  state.echoAt = rt.time;
  rt.sound.play('explosion.far', { at: BAY, volume: 0.5, delay: 1.2 + Math.random() * 0.6 });
}

/** The bay's answer to a burst of the gun: its rattle back off the water, louder the longer it went on (`loud`, 0..1). */
function bayEcho(loud: number, rt: WorldRuntime): void {
  if (rt.time - state.echoAt < 3) return;
  state.echoAt = rt.time;
  rt.sound.play('bay.echo', { at: BAY, volume: 0.35 + 0.65 * loud, delay: 1 + Math.random() * 0.5 });
}

/**
 * A loud noise, a blast or the gun (`loud`: a rocket's 1, a burst's by how long it went on): the
 * cicadas stop at once, and stay quiet a while, the longer the louder it was (update() brings them back).
 */
function hush(loud: number, rt: WorldRuntime): void {
  rt.ambience.get('ambience.cicadas')?.setVolume(0, 0.25);
  state.silenced = true;
  state.quietUntil = Math.max(state.quietUntil, rt.time + (15 + Math.random() * 15) * loud);
}

/** Jackdaws burst off the roof nearest any of `near` (within `reach` of it), at most every 40 s. */
function scatter(near: V3[], reach: number, rt: WorldRuntime): void {
  if (rt.time - state.birdsAt <= 40) return;
  let roost: (typeof ROOSTS)[number] | undefined;
  let best = reach;
  for (const r of ROOSTS)
    for (const at of near) {
      const d = Math.hypot(r.at[0] - at[0], r.at[2] - at[2]);
      if (d < best) [roost, best] = [r, d];
    }
  if (!roost) return;
  state.birdsAt = rt.time;
  rt.sound.play('birds.scatter', { at: roost.at, delay: 0.15 });
  state.flock?.start(roost.at, roost.away);
}

/** Where the player is (the camera). */
function player(rt: WorldRuntime): V3 {
  const e = rt.camera.matrixWorld.elements;
  return [e[12], e[13], e[14]];
}

/**
 * A bronze prop struck by a bullet rings: deep for the goddess, high for a tripod. Once a second at
 * most each, softer while it's still ringing from the last, so a burst at her keeps one ring going.
 */
function ring(p: Piece, at: V3, rt: WorldRuntime): void {
  const last = state.rang.get(p.id) ?? -Infinity;
  if (rt.time - last < 1) return;
  state.rang.set(p.id, rt.time);
  const high = p.prop?.name === 'tripod';
  rt.sound.play('bronze.ring', { at, pitch: high ? 1.3 + Math.random() * 0.15 : 0.72 + Math.random() * 0.08, volume: rt.time - last < 4 ? 0.5 : 1 });
}

/** The trees, which a leaf falls past. */
const TREES = new Set(['foliage', 'cypress', 'bark']);

/** What a leaf falling from `at` lands on: what's under it (not the tree it came off), or the ground. */
function floorUnder(at: V3, rt: WorldRuntime): number {
  const ground = world.groundAt(at[0], at[2]);
  let y = at[1];
  for (let k = 0; k < 4 && y > ground; k++) {
    const h = rt.destruction.raycast([at[0], y, at[2]], [0, -1, 0], y - ground);
    if (!h) break;
    if (!TREES.has(h.piece.materialName)) return h.point[1];
    y = h.point[1] - 0.05;
  }
  return ground;
}

/** Stone landing: a white puff of marble dust where it struck (a few a second), and the bay's echo when a great deal comes down at once. */
function landed(e: LandedEvent, rt: WorldRuntime): void {
  if (!STONE.has(e.material) || e.speed < 3) return;
  if (state.puffs < 3) {
    state.puffs++;
    const size = Math.min(3, 0.8 + e.mass * 0.15);
    rt.effects.puff(e.at, { color: 0xf2efe8, size, rise: 0.5, life: 2.5, opacity: 0.5 });
  }
  if (e.mass > 25) echo(rt);
}

const world: WorldDefinition = {
  ...meta,
  sky: { hdri: 'packs/temple/hdri/temple_sky_1k.hdr', azimuth: -1.25, background: 0.95, environment: 0.6, sun: { color: 0xfff3e0, intensity: 3.6 }, shadowRange: 55 },
  look: {
    fog: FOG,
    exposure: 0.95,
    bloom: { strength: 0.18, radius: 0.45, threshold: 0.96 },
    hemisphere: { sky: 0xb8cde4, ground: 0xc9a674, intensity: 0.5 },
    ao: 0.9,
    // A touch more depth in the blue and warmth in the stone
    grade: { saturation: 1.15, contrast: 1.05, tint: 0xfff8ee, vignette: 0.15 },
    // Marble dust, white in the sun and gone in a few seconds, not a brown cloud over the temple
    smoke: { color: 0xf0ece4, life: 0.55, opacity: 0.8 },
    dustPalette: { colors: [0xeee9df, 0xddd5c6, 0xcfc5b2], blend: 0.6 },
    // The noon air shimmering low over the dry ground and the sea far off
    haze: { strength: 1, from: 80, height: 1.5 },
  },
  // The hills inland and the mountains behind them, in the haze
  far: 2000,
  // What goes over the cliff reaches the sea before it's taken out. Past about what it loads with
  // and 1,500 more (a long session's craters and cells), rubble at rest dissolves
  destruction: { killBelow: SEA - 10, maxPieces: 7250 },
  materials: templeMaterials,
  scenery(scene, world, sky) {
    buildScenery(scene, world, sky);
    // The birds and the leaves, made now so their materials are ready before the first blast or burst
    state.flock = new Flock(scene);
    state.leaves = new Leaves(scene);
    // Gulls off the west and north cliffs, below and above the brink
    state.gulls = new Gulls(scene, [
      [-62, -8, 0],
      [-58, 6, 30],
      [-40, -14, -60],
      [-5, 4, -62],
      [20, -10, -58],
      [-70, 14, -40],
    ]);
  },
  // On the breakable ground, its bed: the slabs over it are found as pieces
  groundAt: (x, z) => (within(AREAS, x, z) ? LAYERS.bed : terrain(x, z)),
  // The sea: bullets go into it unseen
  water: (x, z) => terrain(x, z) < SEA,
  // A pit's side where the ground ends is the land's cut (pits() in ground.ts), its earth over its
  // rock: the fields' own layers, but not the court's flags and rubble
  pitSide: (at, g) => (g.material === 'paving' ? (at[1] > -LAYERS.earth ? 'earth' : 'rock') : undefined),
  props: ['packs/temple/models/'],
  build(d, models) {
    const k = new Kit(d, random(7));
    state.kit = k;
    // The ground first: what stands on it bonds to it, and goes into a crater with it
    layGround(d);
    buildRamp(k);
    buildTemple(k);
    buildTreasury(k);
    buildPropylon(k);
    buildStoa(k);
    buildTholos(k);
    state.fire = buildAltar(k);
    const statueTop = buildStatueBase(k);
    const votiveTop = buildVotive(k);
    buildStelai(k);
    buildPedestals(k);
    buildTemenos(k);
    buildFragments(k);
    buildTrees(k);
    // Only the statue and the tripods ring: the doors and shields have the material's own sounds
    state.bronze = new Set(placeProps(d, models, votiveTop, statueTop, k.rand));
    return { feet: [29.5, 0, 3.4], look: [-4, 6, -3] };
  },
  audio: {
    packs: ['packs/temple/sounds/'],
    settings: {
      // The echo plays 400 m out: with the pack's falloff it would be too faint to play at all
      'explosion.far': { near: 120, rolloff: 0.6 },
      // A ring now and then, not a gong storm when a door or the statue comes down
      'bronze.clang': { cooldown: 0.8, spacing: 12, voices: 2 },
      // Tiles break by the dozen as a roof lands: one crash covers those close together
      'tile.shatter': { cooldown: 0.2, spacing: 6 },
      // The mix: every world's bed about -33 LUFS standing at the start, its steps as loud as Brick Street's (docs/changelog/phase-c/sound.md)
      'ambience.cicadas': { volume: 0.2 },
      'steps.gravel': { volume: 0.21 },
    },
    ambience: [
      { sound: 'ambience.coast', volume: 0.95, high: 1.4 },
      { sound: 'ambience.wind', volume: 0.6, high: 3 },
      // In the trees round about: fainter up high
      { sound: 'ambience.cicadas', high: 0.5 },
    ],
    materials: {
      // Stone chips on stone ring brighter than brick on asphalt; a section landing is one thud. A
      // bullet snaps off marble as off hard stone, a little higher
      marble: { break: 'marble.break', impact: 'brick.impact.small', heavyImpact: 'marble.impact.large', land: 'marble.impact.large', debris: 'brick.debris', strain: 'stone.grind', collapse: 'collapse.marble', settle: 'dust.settle', bullet: 'bullet.concrete', pitch: { impact: 1.15, debris: 1.1, bullet: 1.1 } },
      drum: { break: 'marble.break', impact: 'brick.impact.small', heavyImpact: 'marble.impact.large', land: 'marble.impact.large', debris: 'brick.debris', strain: 'stone.grind', collapse: 'collapse.marble', settle: 'dust.settle', bullet: 'bullet.concrete', pitch: { impact: 1.15, debris: 1.1, land: 0.92, bullet: 1.1 } },
      triglyph: { break: 'marble.break', impact: 'brick.impact.small', heavyImpact: 'marble.impact.large', land: 'marble.impact.large', debris: 'brick.debris', strain: 'stone.grind', collapse: 'collapse.marble', settle: 'dust.settle', bullet: 'bullet.concrete', pitch: { impact: 1.15, debris: 1.1, bullet: 1.1 } },
      ruin: { break: 'marble.break', impact: 'brick.impact.small', heavyImpact: 'marble.impact.large', land: 'marble.impact.large', debris: 'brick.debris', strain: 'stone.grind', collapse: 'collapse.marble', settle: 'dust.settle', bullet: 'bullet.concrete', pitch: { impact: 1.1, debris: 1.05 } },
      // Poros is soft and porous: a bullet's dry crack and a burst of crumbs, as off brick
      limestone: { break: 'concrete.break', impact: 'brick.impact.small', heavyImpact: 'concrete.impact', land: 'concrete.impact', debris: 'brick.debris', strain: 'stone.grind', collapse: 'collapse.rumble', settle: 'dust.settle', bullet: 'bullet.brick', pitch: { impact: 1.05, bullet: 0.95 } },
      // Fired clay cracks rather than tinkles (a tile still shatters at the first round)
      terracotta: { break: 'tile.shatter', impact: 'tile.debris', heavyImpact: 'tile.debris', debris: 'tile.debris', bullet: 'bullet.brick', pitch: { bullet: 1.2 } },
      timber: { ...packMaterials.wood, strain: 'structure.creak', bullet: 'bullet.wood' },
      // Bronze rings lower than steel
      bronze: { break: 'metal.bend', impact: 'metal.impact.small', heavyImpact: 'metal.impact.small', strain: 'metal.bend', bullet: 'bullet.metal', pitch: { bullet: 0.85 } },
      // Through leaves: a soft rustle and thud, not a thunk
      foliage: { break: 'foliage.break', bullet: 'bullet.dirt', pitch: { bullet: 1.3 } },
      cypress: { break: 'foliage.break', bullet: 'bullet.dirt', pitch: { bullet: 1.3 } },
      bark: { break: 'foliage.break', impact: 'wood.impact', heavyImpact: 'wood.impact', bullet: 'bullet.wood', pitch: { bullet: 0.85 } },
      embers: { break: 'wood.break', impact: 'wood.impact', bullet: 'bullet.wood', pitch: 1.3 },
      // The ground: the court's flags as the marble, the rubble under them and the earth crunching
      // (the rock under the earth as stone, lower)
      paving: { break: 'marble.break', impact: 'brick.impact.small', heavyImpact: 'marble.impact.large', debris: 'brick.debris', settle: 'dust.settle', bullet: 'bullet.concrete', pitch: { impact: 1.15, debris: 1.1, bullet: 1.1 } },
      fill: { impact: 'steps.rubble', debris: 'brick.debris', bullet: 'bullet.dirt', pitch: { bullet: 1.1 } },
      earth: { impact: 'steps.rubble', debris: 'steps.rubble', bullet: 'bullet.dirt' },
      rock: { break: 'concrete.break', impact: 'brick.impact.small', heavyImpact: 'concrete.impact', debris: 'brick.debris', bullet: 'bullet.concrete', pitch: { impact: 0.9, debris: 0.9, bullet: 0.9 } },
    },
    // Gravel and dry grass on the ground (the earth and the rubble in a crater too), stone on steps,
    // floors, the court's flags, the rock and a crater's bare floor
    footsteps: { hard: 'steps.gravel', surface: (at, material, rubble) => ((material ? !rubble && PAVED.has(material) : at[1] < LAYERS.bed + 0.1 && within(AREAS, at[0], at[2])) ? 'steps.asphalt' : undefined) },
  },
  dust: { marble: 0xfbf8f2, drum: 0xfbf8f2, triglyph: 0xfbf8f2, ruin: 0xf2eadc, limestone: 0xeee6d4, terracotta: 0xdcc0a8, timber: 0x9a7a58, bronze: 0x8a7a5a, foliage: 0x9aa874, cypress: 0x7d8f62, bark: 0x8a7458, embers: 0x6a625a, paving: 0xf6f2ea, fill: 0xe2dacb, earth: 0xc9ab8c, rock: 0xeee6d4 },
  chips: { marble: 0xf4f0e6, drum: 0xf4f0e6, triglyph: 0xf4f0e6, ruin: 0xe2d4b8, limestone: 0xcdb88e, terracotta: 0xb0532e, timber: 0x8a6a48, bronze: 0x8a6a3a, foliage: 0x6f7f45, cypress: 0x3e5a32, bark: 0x6a5a48, embers: 0x1e1a18, paving: 0xf0eae0, fill: 0xd6cdbd, earth: 0x8e5e40, rock: 0xd8ccb4 },
  // Leaves, timber, metal and ash raise little dust (leaves least: a crown coming down is a little leaf dust)
  dustAmount: { foliage: 0.12, cypress: 0.12, timber: 0.6, bark: 0.6, bronze: 0.15, embers: 0.3 },
  blastRadius: 2.4,
  onStart(rt) {
    rt.destruction.on('landed', (e) => landed(e, rt));
  },
  onBlast(at, radius, rt) {
    hush(1, rt);
    scatter([at], 25, rt);
    if (radius >= 2) echo(rt);
  },
  onShot(hit, rt) {
    // The burst going on: the cicadas stop at its first round, and a few rounds in the jackdaws go up
    // off the roof nearest where it strikes, or nearest the player
    if (rt.time - state.shotAt > 0.3) state.shots = 0;
    state.shotAt = rt.time;
    if (++state.shots === 1) hush(0.25, rt);
    // and they stay quiet while it goes on (onBurst says how long after it ends)
    else state.quietUntil = Math.max(state.quietUntil, rt.time + 1);
    if (state.shots === 3) scatter([hit.at, player(rt)], 30, rt);
    if (hit.piece && state.bronze.has(hit.piece)) ring(hit.piece, hit.at, rt);
    // Leaves off an olive's crown, more where the round broke it
    if (hit.material === 'foliage') state.leaves?.shed(hit.at, hit.normal, hit.broke ? 10 : 6, floorUnder(hit.at, rt));
  },
  onBurst(burst, rt) {
    // The sanctuary answers it as a blast, as loud as it was long: after a tap of the trigger the
    // cicadas are back in a few seconds, after a long burst (30 rounds, 2 s) as late as after a
    // rocket; the bay throws it back
    const loud = Math.min(1, 0.25 + burst.rounds / 40);
    hush(loud, rt);
    if (burst.rounds >= 3) scatter(burst.at ? [burst.at, player(rt)] : [player(rt)], 30, rt);
    bayEcho(loud, rt);
    state.shots = 0;
  },
  onImpact(e, rt) {
    const p = e.piece;
    if (p.state === 'loose' && (p.materialName === 'foliage' || p.materialName === 'cypress') && e.speed > 1) state.landed.set(p, e.at);
    // Bronze rings when it strikes (the cauldron higher)
    if (state.bronze.has(p) && e.speed > 2) {
      const last = state.rang.get(p.id) ?? -Infinity;
      if (rt.time - last > 1) {
        state.rang.set(p.id, rt.time);
        const high = p.prop?.name === 'tripod';
        rt.sound.play('bronze.clang', { at: e.at, pitch: high ? 1.15 + Math.random() * 0.15 : 0.9 + Math.random() * 0.1, volume: Math.min(1, e.speed / 6) });
      }
    }
  },
  update(dt, rt) {
    state.kit?.levers.update(dt);
    state.puffs = Math.max(0, state.puffs - dt * 3);
    state.flock?.update(dt);
    state.gulls?.update(dt);
    state.leaves?.update(dt);
    // The cicadas come back after a quiet spell
    if (state.silenced && rt.time > state.quietUntil) {
      state.silenced = false;
      rt.ambience.get('ambience.cicadas')?.setVolume(1, 10);
    }
    // Leaves that landed whole burst, a few a frame
    let n = 0;
    for (const [p, at] of state.landed) {
      if (n++ >= 6) break;
      state.landed.delete(p);
      if (p.state === 'loose' || p.state === 'rubble') burstLeaves(p, at, rt);
    }
    // A thin smoke from the offering, while any of it still lies on the altar, drifting toward the sea
    state.smokeAt -= dt;
    if (state.smokeAt <= 0 && state.fire.some((p) => p.state === 'fixed')) {
      state.smokeAt = 0.3 + Math.random() * 0.2;
      const { x, z } = PLACES.altar;
      rt.effects.puff([x + (Math.random() - 0.5) * 0.4, 1.6, z + (Math.random() - 0.5) * 0.4], { color: 0x4d4a47, size: 1.8, rise: 1.1, life: 7, opacity: 0.4, velocity: [-0.35, 0.4, -0.1] });
    }
    // What goes over the cliff: a splash where it meets the sea, and it's gone
    state.splashWait -= dt;
    if (state.splashWait <= 0) {
      state.splashWait = 0.1;
      for (const p of [...rt.destruction.loosePieces]) {
        if (p.pose.position[1] > SEA + 1) continue;
        // Chips just vanish into it; a block or a drum throws up white water you can hear
        if (p.mass > 0.05) {
          const [x, , z] = p.pose.position;
          rt.effects.puff([x, SEA + 0.5, z], { color: 0xf6f8fa, size: Math.min(5, 1.5 + p.mass), rise: 1.5, life: 2.5, opacity: 0.75, velocity: [0, 4, 0] });
          rt.sound.play('sea.splash', { at: [x, SEA + 0.5, z], volume: Math.min(1, 0.4 + p.mass * 0.3) });
        }
        rt.destruction.removePiece(p);
      }
    }
  },
};

export default world;
