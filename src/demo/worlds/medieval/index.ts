// Market Town: a medieval market square at golden hour. Half-timbered houses on the west, the town
// wall with its gatehouse and a round tower on the north, the church tower and the market hall on
// the east, stalls and a well in the square, the low sun from the south-west. The church bell
// tolls in the evening, answers blasts near the tower and rings under a round; it clangs when it
// falls. At a blast or a burst of the gun the pigeons scatter, the market goes quiet and the hens
// complain; the hung signs swing and creak; smoke rises from the chimneys.

import type * as THREE from 'three/webgpu';
import { type MaterialSounds, packMaterials, type Piece, type V3, type Voice } from '../../../lib/index.ts';
import type { WorldDefinition, WorldRuntime } from '../types.ts';
import { CHURCH, churchTower, nave } from './church.ts';
import { leanFalls, releaseFronts, watchFalls } from './falls.ts';
import { Frame, Kit, type P } from './kit.ts';
import { COOP, cross, placeProps, stalls, well, yard } from './market.ts';
import { townMaterials } from './materials.ts';
import { meta } from './meta.ts';
import { COBBLE_MAP, ground, groundAt, haze, onSquare, SQUARE, town, trees, walkable, windmill } from './scenery.ts';
import { buildHouses, lantern, marketHall, type Sign, stable } from './town.ts';
import { gatehouse, tower, townWall, wallStair } from './walls.ts';

/** What the reactions keep between frames (module state, as Brick Street's alarm). */
let bell: Piece | null = null;
let bellLoose = false;
let bellStruck = false;
let sails: THREE.Object3D | null = null;
let band: THREE.Object3D | null = null;
let pots: P[] = [];
let signs: Sign[] = [];
let breezeAt = 0;
let lastBlast = -1e9;
let lastHit: V3 | null = null;
let hens = -1e9;
let smokeAt = 0;
/** Whether the evening bell has been rung. */
let evening = false;
/**
 * The songbirds' and the market's levels (1: as they were) after a blast or the gun, and when each
 * comes back (rt.time); when the pigeons last went up.
 */
let birds = 1;
let market = 1;
let birdsAt = 0;
let marketAt = 0;
let flown = -1e9;
/**
 * The gun's rounds the town has heard lately (each fading over 10 s or so) and when last counted;
 * the rounds of the burst going on that struck something; when a round last rang the bell.
 */
let noise = 0;
let noiseAt = 0;
let strikes = 0;
let pinged = -1e9;
/** The bell's strokes, played or waiting to be (with the volume each was asked for), and when the last one heard began (audio time). */
const strokes: Array<{ voice: Voice; volume: number }> = [];
let rung = -1e9;

const FOG = 0xcbb8a0;

// A bullet into dressed stone snaps (the base pack's concrete strike), not brick's dry crack
const STONE: MaterialSounds = { break: 'stone.break', impact: 'brick.impact.small', heavyImpact: 'stone.impact.large', debris: 'brick.debris', strain: 'structure.creak', collapse: 'collapse.rumble', settle: 'dust.settle', land: 'stone.impact.large', bullet: 'bullet.concrete' };

/** Where the bell is now. */
const bellAt = (): V3 => (bell ? [...bell.pose.position] : [...CHURCH.bell]) as V3;
const hanging = () => !!bell && bell.state === 'fixed';
/** Whether a sign still hangs from its bracket (once that falls, it lies where it lands). */
const swings = (s: Sign) => s.hinge.holding && s.bracket.state === 'fixed';

/** A stroke of the bell `delay` s from now (stopped if the bell comes down before it). */
function toll(rt: WorldRuntime, delay: number, volume: number): void {
  const voice = rt.sound.play('bell.toll', { at: bellAt(), volume, delay });
  if (voice) strokes.push({ voice, volume });
}

/**
 * The town hears a blast or the gun, `loud` 0–1 (a blast 1): the songbirds and the market go
 * quiet, the louder the quieter and the longer (a blast's 20 s and 120 s). With `flush`, and at
 * least 0.3 (three rounds of the gun), the pigeons go up off the roofs over `at` and the hens
 * complain if it's near the coop. Heard again while quiet, it only deepens the hush and keeps it.
 */
function startle(at: V3, loud: number, rt: WorldRuntime, flush = true): void {
  const t = rt.time;
  if (1 - 0.85 * loud < birds) rt.ambience.get('ambience.birds')?.setVolume((birds = 1 - 0.85 * loud), 1);
  if (1 - loud < market) rt.ambience.get('ambience.market')?.setVolume((market = 1 - loud), 2);
  birdsAt = Math.max(birdsAt, t + 20);
  marketAt = Math.max(marketAt, t + 20 + 100 * loud);
  if (!flush || loud < 0.3) return;
  // One flock at a time; the hens if it's near them
  if (t > flown + 5) {
    flown = t;
    rt.sound.play('birds.scatter', { at: [at[0], Math.max(at[1] + 3, 11), at[2]] });
  }
  if (Math.hypot(at[0] - COOP[0], at[2] - COOP[2]) < 30) cackle(rt, 0.2 + Math.random() * 0.3);
}

/** The hens in the coop complain `delay` s from now (once for blasts and rounds within 3 s). */
function cackle(rt: WorldRuntime, delay: number): void {
  if (rt.time < hens + 3) return;
  hens = rt.time;
  rt.sound.play('chickens.startle', { at: [COOP[0], 0.5, COOP[2]], delay });
}

/** How loud the gun is to the town with `rounds` more: eight rounds lately (0.6 s of it) as loud as a blast. */
function hear(rounds: number, t: number): number {
  noise = noise * Math.exp((noiseAt - t) / 10) + rounds;
  noiseAt = t;
  return Math.min(1, noise / 8);
}

/** A sign swung `speed` m/s across its board, the way `dir` goes, creaking on its rings (louder the harder). */
function swing(s: Sign, dir: V3, speed: number, rt: WorldRuntime): void {
  const k = Math.sign(dir[0] * s.across[0] + dir[2] * s.across[2] || 1) * speed;
  rt.destruction.push(s.pieces[0], [s.across[0] * k, 0, s.across[2] * k]);
  creak(s, speed, rt);
}

/** A sign's creak on its rings, swinging at `speed` m/s. */
function creak(s: Sign, speed: number, rt: WorldRuntime): void {
  rt.sound.play('sign.creak', { at: [...s.pieces[0].pose.position] as V3, volume: Math.min(1, 0.35 + speed / 3) });
}

/** Stop the strokes still waiting to be heard; returns the loudest of them (0: none). */
function stopStrokes(): number {
  let loudest = 0;
  for (const { voice, volume } of strokes.splice(0)) {
    if (!voice.live) continue;
    if (voice.age >= 0) rung = Math.max(rung, voice.start);
    else {
      loudest = Math.max(loudest, volume);
      voice.stop(0);
    }
  }
  return loudest;
}

const world: WorldDefinition = {
  ...meta,
  sky: {
    hdri: 'packs/medieval/hdri/syferfontein_6d_clear_puresky_1k.hdr',
    azimuth: -2.1,
    // Golden hour: the sun 10° up (the sky's own is lower, and would be raised to 14°)
    elevation: (10 * Math.PI) / 180,
    // The sky lights less than the sun, so the light is the low warm sun's and the shade cool
    background: 0.65,
    environment: 0.24,
    sun: { color: 0xffa860, intensity: 5.3 },
    shadowRange: 50,
  },
  look: {
    // Aerial perspective: the wooded hill (about 220 m) and the ridge fade into a cool haze
    fog: { color: FOG, near: 40, far: 340 },
    exposure: 0.95,
    bloom: { strength: 0.22, radius: 0.5, threshold: 1.0 },
    hemisphere: { sky: 0x8a9cc0, ground: 0xa07040, intensity: 0.2 },
    ao: 0.7,
    grade: { saturation: 1.1, contrast: 1.1, tint: 0xffe0c0, vignette: 0.22 },
    weather: { motes: 0.05, motesColor: 0xfff0d0 },
    // A blast's own cloud, smaller (at full size it hid what a rocket had done for 6–15 s), it and
    // the dust blue grey, taking little of the stone's colour: the low orange sun lights dust with
    // no sky to cool it, so the warm default turned it rust and a cool grey salmon
    smoke: { scale: 0.55, color: 0x90a6c4 },
    dustPalette: { colors: [0x9cb0c8, 0xa8bcd0, 0x90a4bc], blend: 0.15 },
  },
  materials: townMaterials,
  scenery(scene, world) {
    ground(scene, world);
    town(scene, world);
    trees(scene);
    sails = windmill(scene);
    band = haze(scene, FOG);
  },
  // On the square its bed: the slabs over it are found as pieces
  groundAt,
  walkable,
  // No water in town (the demo's guess took a crater's bed by the scenery houses for it)
  water: () => false,
  props: ['packs/medieval/models/'],
  // What a heavy piece presses through the square's bed goes, just under it; past 1,500 pieces
  // over what's built, rubble at rest shrinks away
  destruction: { killBelow: SQUARE.bed - 0.7, maxPieces: 9500 },
  build(d, models) {
    // The square: cobbles over packed earth on its bed, their maps laid as the cobbles round them
    // (what stands on it bonds to it, and goes into a crater with it); a crater's floor is the
    // earth too, as drawn
    d.addGround({ material: 'cobbles', under: 'earth', bed: 'earth', area: SQUARE.area, top: 0, depth: SQUARE.depth, underDepth: SQUARE.underDepth, cell: SQUARE.cell, textureFrame: { position: COBBLE_MAP.origin } });
    watchFalls(d);
    const kit = new Kit(d, 1471);
    townWall(kit);
    wallStair(kit);
    const gate = gatehouse(kit);
    tower(kit);
    ({ pots, signs } = buildHouses(kit));
    const hall = marketHall(kit);
    stable(kit);
    bell = churchTower(kit);
    nave(kit);
    const counters = stalls(kit);
    well(kit);
    cross(kit);
    yard(kit);
    // Lanterns: in the gate passage, by the church door, on the hall's front posts (the tavern's are with it)
    kit.part('lanterns');
    for (const l of gate.lanterns) lantern(kit, l.f, l.u, l.v);
    lantern(kit, new Frame([15, 0, 1], Math.PI / 2), 4.4, 2.7);
    for (const u of [2.4, 4.6]) lantern(kit, hall.sub(0, 0, 0.25), u, 2.5);
    kit.close();
    const props = placeProps(d, models, counters);
    console.debug(`Market Town: ${d.stats.pieces} pieces, ${props} props`, JSON.stringify(kit.counts));
    // Reset what the reactions remember (the world may be built again)
    bellLoose = bellStruck = evening = false;
    birds = market = 1;
    birdsAt = marketAt = noise = noiseAt = strikes = 0;
    lastBlast = hens = flown = pinged = -1e9;
    lastHit = null;
    smokeAt = 0;
    // The breeze picks up once the signs have hung still a while: what hangs counts as moving until
    // it has swayed within 10 cm for 6 s (or been still)
    breezeAt = 7;
    strokes.length = 0;
    rung = -1e9;
    return { feet: [3, 0, 11], look: [-1, 5, -16] };
  },
  audio: {
    packs: ['packs/medieval/sounds/'],
    // The mix: every world's bed about -33 LUFS standing at the start, its steps as loud as Brick Street's (docs/changelog/phase-c/sound.md)
    settings: { 'explosion.near': { reverb: 0.6 }, 'ambience.birds': { volume: 0.17 }, 'ambience.market': { volume: 0.22 }, 'steps.cobble': { volume: 0.34 } },
    // The birds duck at a blast and the market falls quiet (rt.ambience)
    ambience: [{ sound: 'ambience.wind', high: 3.5 }, { sound: 'ambience.birds' }, { sound: 'ambience.market' }],
    materials: {
      limestone: STONE,
      limestoneTower: STONE,
      // Rubble walls: the same stone, rougher and heavier
      rubble: { ...STONE, pitch: 0.88 },
      rubbleTower: { ...STONE, pitch: 0.88 },
      // Daub crumbles: dry grit and a clay knock, duller than tile; a bullet thuds into the clay
      plaster: { break: 'dust.settle', impact: 'tile.impact', debris: 'dust.settle', settle: 'dust.settle', bullet: 'bullet.dirt', pitch: { impact: 0.75, bullet: 1.1 } },
      // Oak: a bullet's thunk a little deeper than the boards'
      oak: { break: 'timber.crack', impact: 'wood.impact', heavyImpact: 'wood.impact', debris: 'wood.impact', strain: 'timber.groan', collapse: 'collapse.rumble', land: 'timber.crack', bullet: 'bullet.wood', pitch: { bullet: 0.92 } },
      // Planks: lighter than the oak
      boards: { ...packMaterials.wood, bullet: 'bullet.wood', pitch: 1.15 },
      // A slope of slabs landing is a row of tiles smashing; a bullet cracks fired clay as brick, higher
      tile: { break: 'tile.impact', impact: 'tile.impact', heavyImpact: 'tile.clatter', debris: 'tile.impact', collapse: 'tile.clatter', land: 'tile.clatter', bullet: 'bullet.brick', pitch: { bullet: 1.15 } },
      glass: { ...packMaterials.glass, bullet: 'bullet.glass' },
      // Small fittings: brackets, bars, pictograms
      iron: { ...packMaterials.metal, bullet: 'bullet.metal', pitch: 1.25 },
      // The bell's bronze rings lower than steel under a bullet
      bronze: { impact: 'bell.clang', heavyImpact: 'bell.clang', bullet: 'bullet.metal', pitch: { bullet: 0.85 } },
      // Soft things thud: canvas, straw, cabbages
      cloth: { bullet: 'bullet.dirt', pitch: { bullet: 1.3 } },
      hay: { settle: 'dust.settle', bullet: 'bullet.dirt', pitch: { bullet: 1.1 } },
      produce: { bullet: 'bullet.dirt', pitch: { bullet: 1.25 } },
      lantern: { break: 'glass.shatter', impact: 'glass.debris', debris: 'glass.debris', bullet: 'bullet.glass', pitch: 1.3 },
      // The square's setts: stone, without a wall's heavy landing; the earth under them crunches
      // where its clods land (no stone's sounds: a bullet into it pocks it as dirt)
      cobbles: { break: 'stone.break', impact: 'brick.impact.small', heavyImpact: 'brick.impact.large', debris: 'brick.debris', settle: 'dust.settle', bullet: 'bullet.concrete' },
      earth: { impact: 'steps.rubble', debris: 'steps.rubble', bullet: 'bullet.dirt', pitch: { impact: 0.75, debris: 0.75 } },
    },
    // Cobbles underfoot; the wall walk, stairs and steps are dressed stone; down in a crater in the
    // square the earth under the setts crunches, and the bed under that
    footsteps: {
      hard: 'steps.cobble',
      surface: ([x, y, z], material, rubble) => {
        if (material === 'earth' || (!material && onSquare(x, z) && y < -SQUARE.depth)) return 'steps.rubble';
        return !rubble && (material?.startsWith('limestone') || material?.startsWith('rubble')) ? 'steps.asphalt' : undefined;
      },
    },
  },
  dust: { limestone: 0xd8cdb4, limestoneTower: 0xd8cdb4, rubble: 0xa89c88, rubbleTower: 0xa89c88, plaster: 0xe2dccc, oak: 0x9a8670, boards: 0xa89478, tile: 0xb88c74, hay: 0xd8c890, cloth: 0xd8d2c4, glass: 0xe0e6e2, produce: 0xb8b890, cobbles: 0xb4ac9c, earth: 0x9a8670 },
  // Well under the default: a cloud over every falling section hid the town
  dustAmount: { limestone: 0.3, limestoneTower: 0.3, rubble: 0.3, rubbleTower: 0.3, plaster: 0.3, tile: 0.3, oak: 0.2, boards: 0.2, hay: 0.4, cloth: 0.2, glass: 0.2, produce: 0.2, cobbles: 0.3, earth: 0.4 },
  // Cloth's chips undyed linen (the awnings are striped, the bolts every dye)
  chips: { limestone: 0xcfc3a8, limestoneTower: 0xcfc3a8, rubble: 0x8f8472, rubbleTower: 0x8f8472, plaster: 0xeee6d4, oak: 0x6b5238, boards: 0x8a6a48, tile: 0xb0583a, glass: 0x9fb79a, hay: 0xd2b25a, cloth: 0xcfc2a6, produce: 0x8a9a40, iron: 0x3a3632, bronze: 0x9a7440, lantern: 0xffe0b0, cobbles: 0x8c867a, earth: 0x6a5440 },
  blastRadius: 2.5,
  onBlast(at, _radius, rt) {
    lastBlast = rt.time;
    lastHit = at;
    // Pigeons off the roofs, the songbirds go quiet, and so does the market; the hens
    startle(at, 1, rt);
    // Signs within 6 m swing away from it, the nearer the harder
    for (const s of signs) {
      const p = s.pieces[0].pose.position;
      const d = Math.hypot(p[0] - at[0], p[1] - at[1], p[2] - at[2]);
      if (d < 6 && swings(s)) swing(s, [p[0] - at[0], 0, p[2] - at[2]], (6 - d) * 0.6, rt);
    }
    // The bell answers a hit on its tower, swinging on a few times; the nave makes it hum once
    if (!hanging()) return;
    const b = bellAt();
    const d = Math.hypot(at[0] - b[0], at[1] - b[1], at[2] - b[2]);
    const { x0, z0, x1, z1 } = CHURCH.tower;
    const near = d < 9 || (at[0] > x0 - 2 && at[0] < x1 + 2 && at[2] > z0 - 2 && at[2] < z1 + 2 && at[1] < 23);
    const n = CHURCH.nave;
    if (near) {
      // Blasts together swing it once: the swings still to come give way to the new ones, which
      // start from the louder of the two
      let v = Math.max(Math.min(1, Math.max(0.3, 1.2 - d / 12)), stopStrokes());
      const swings = 3 + Math.floor(Math.random() * 2);
      for (let i = 0; i < swings; i++) {
        toll(rt, i * 1.7, v);
        v *= 0.6;
      }
    } else if (at[0] > n.x0 - 2 && at[0] < n.x1 + 2 && at[2] > n.z0 - 2 && at[2] < n.z1 + 2) toll(rt, 0, 0.35);
  },
  onShot(hit, rt) {
    const t = rt.time;
    // The town hears each round, the pigeons and the hens the burst's third
    startle(hit.at, hear(1, t), rt, ++strikes === 3);
    // A tower the gun undermines leans toward where its rounds broke it, as toward a blast
    if (hit.broke) lastHit = hit.at;
    // A round into the coop sets the hens off at once
    if (Math.hypot(hit.at[0] - COOP[0], hit.at[2] - COOP[2]) < 1.2) cackle(rt, 0.05);
    // A round on the bell: the bronze pings and rings (hung, its hum too, once for a run of rounds);
    // fallen, duller
    if (bell && hit.piece === bell) {
      rt.sound.play('bell.ping', { at: hit.at, ...(hanging() ? {} : { volume: 0.6, pitch: 0.85 }) });
      if (hanging() && t > pinged + 3) toll(rt, 0.05, 0.2);
      pinged = t;
    }
    // A sign struck swings and creaks on its rings (the round pushes what it strikes, if it's free
    // to move), and so does one by a round into its bracket or the wall beside it; shot through,
    // it's gone
    for (const s of signs) {
      if (!swings(s)) continue;
      const p = s.pieces[0].pose.position;
      const d = Math.hypot(p[0] - hit.at[0], p[1] - hit.at[1], p[2] - hit.at[2]);
      if (hit.piece && s.pieces.includes(hit.piece)) {
        if (!hit.broke) creak(s, 3, rt);
      } else if (hit.piece === s.bracket || d < 1.2) swing(s, hit.direction, hit.piece === s.bracket ? 1.2 : 2 * (1 - d / 1.2), rt);
    }
  },
  onBurst(burst, rt) {
    // Its rounds that struck nothing are heard too (where it struck, or where it was fired from),
    // and a burst too short to have startled the pigeons and the hens may yet (taps one after another)
    startle(burst.at ?? (rt.camera.position.toArray() as V3), hear(burst.rounds - strikes, rt.time), rt, strikes < 3);
    strikes = 0;
  },
  onImpact(e, rt) {
    const name = e.piece.materialName;
    if (e.piece === bell && e.speed > 1.5) {
      rt.effects.dust(e.at, 0.16, 0xd8cdb4);
      if (!bellStruck && e.speed > 4) {
        // Its first hard landing: bronze glints, and the weight of it under the clang
        bellStruck = true;
        rt.effects.impact(e.at, [0, 1, 0], 0xffc070);
        rt.sound.play('metal.impact.large', { at: e.at, volume: 0.8 });
        rt.sound.play('stone.impact.large', { at: e.at });
      }
    }
    // Iron and bronze striking hard throw sparks
    if ((name === 'iron' || name === 'bronze') && e.speed > 4) rt.effects.impact(e.at, [0, 1, 0], 0xffb060);
  },
  update(dt, rt) {
    const t = rt.time;
    if (sails) sails.rotation.z += 0.35 * dt;
    band?.position.copy(rt.camera.position);
    leanFalls(rt.destruction, lastHit, t);
    releaseFronts(rt.destruction, t, t - lastBlast);
    // Wood smoke from the chimneys whose pots still stand, drifting with the air
    if (t > smokeAt) {
      smokeAt = t + 0.4;
      for (const p of pots) {
        if (p?.state !== 'fixed') continue;
        const [x, y, z] = p.pose.position;
        rt.effects.puff([x, y + 0.3, z], { color: 0x8c8884, rise: 1.1, size: 1.6, life: 7, opacity: 0.16 });
      }
    }
    // The signs swing a little in the breeze, now one, now another
    if (t > breezeAt && signs.length) {
      breezeAt = t + 0.6 + Math.random() * 1.2;
      const s = signs[Math.floor(Math.random() * signs.length)];
      const k = (Math.random() - 0.5) * 0.5;
      if (swings(s)) rt.destruction.push(s.pieces[0], [s.across[0] * k, 0, s.across[2] * k]);
    }
    // The evening bell, three strokes a while after the town comes alive (audio unlocked, and the
    // bell loaded: audio allowed from the start runs before the sounds are in)
    if (!evening && rt.sound.running && rt.sound.has('bell.toll')) {
      evening = true;
      for (let i = 0; i < 3; i++) toll(rt, 6 + i * 4, 0.8);
    }
    // Birds come back after a quiet spell; the market after a longer one
    if (birds < 1 && t > birdsAt) {
      birds = 1;
      rt.ambience.get('ambience.birds')?.setVolume(1, 40);
    }
    if (market < 1 && t > marketAt) {
      market = 1;
      rt.ambience.get('ambience.market')?.setVolume(1, 15);
    }
    // The bell comes off its headstock: the strokes still to come are dropped, and it jangles once,
    // as soon as the cooldown after the last stroke allows
    if (bell && !bellLoose && bell.state !== 'fixed') {
      bellLoose = true;
      stopStrokes();
      rt.sound.play('bell.toll', { at: bellAt(), volume: 0.7, pitch: 0.92, delay: Math.max(0, rung + 0.85 - rt.sound.context.currentTime) });
    }
  },
};

export default world;
