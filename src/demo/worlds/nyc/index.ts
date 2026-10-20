// Brick Street: a New York block of brick walk-ups with fire escapes, balconies and water tanks on
// the roofs, cabs and sedans at the curb, pigeons on the copings, an afternoon sun raking across the
// far facades. Blasts and the gun hush the traffic and put the pigeons up, enough noise brings the
// sirens; a car shot or come down hard sets its alarm off and loses its glass, a hydrant knocked or
// shot off its main sprays the street, a tank holed leaks onto its roof, an air conditioner shot
// through hisses out its gas and a lamp knocked out of its fitting sparks.

import { packMaterials, type Piece, rotate, toWorld, type V3, type Voice } from '../../../lib/index.ts';
import type { WorldDefinition, WorldRuntime } from '../types.ts';
import { buildStreet, inStretch, ROAD, STREET, WALK } from './city.ts';
import { demoMaterials, ROAD_MAP } from './materials.ts';
import { meta } from './meta.ts';
import { Pigeons } from './pigeons.ts';
import { placeProps } from './props.ts';
import { groundEnds, skyline, street } from './scenery.ts';
import { Water } from './water.ts';

/** The colour of each material's flying chips (and a bullet's: flakes of black paint off the iron). */
const CHIPS: Record<string, number> = { asphalt: 0x3a3836, earth: 0x6a5440, paving: 0xb4b0a8, manhole: 0x3a3430, glass: 0xd6eaf2, lamp: 0xf0e8d8, brick: 0x8a5a44, brickBrown: 0x5a3a2e, brickPainted: 0xd8d0c4, concrete: 0x9a958c, painted: 0xe8e2d8, pot: 0xb5603c, sheet: 0xd9dcd8, plaster: 0xe0dad0, wood: 0x7a5a3c, foliage: 0x5f8a3a, metal: 0x2c2a28, grate: 0x2c2a28 };
const CARS = new Set(['taxi', 'sedan', 'van']);
const isCar = (p: Piece | null): p is Piece => CARS.has(p?.prop?.name ?? '');
const centre = (p: Piece): V3 => [0, 1, 2].map((k) => (p.bounds.min[k] + p.bounds.max[k]) / 2) as V3;

/** Car alarms going at once, at most: a new one cuts the oldest short. */
const ALARMS = 2;
/** Seconds a car's alarm stays quiet once it has stopped, before it can go off again. */
const REARM = 45;
/** Rounds into a parked car before its windows go: after these, each round takes the one nearest it. */
const WINDOWS_AFTER = 3;
/** Seconds the gun has to keep on before the traffic stops while it's still firing. */
const FIRING = 0.5;

/** A car's alarm going, until when. */
interface Alarm {
  car: Piece;
  voice: Voice;
  until: number;
}
/** A parked car that has been shot or thrown: rounds taken, its windows gone (a bit each), and when its alarm can go off again. */
interface Car {
  rounds: number;
  broken: number;
  quiet: number;
}

let alarms: Alarm[] = [];
const cars = new WeakMap<Piece, Car>();
let parked: Piece[] = [];
let sirens: { voice: Voice; until: number } | null = null;
/** Blasts and bursts lately (decaying): enough of them and the sirens come. */
let noise = 0;
/** When the traffic, hushed by a blast or the gun, starts to come back (-1: it isn't hushed). */
let hush = -1;
/** When a round last struck something, and since when they have kept coming. */
let firing = { from: 0, last: -Infinity };
let water: Water;
let pigeons: Pigeons;
/** The window air conditioners: where each is, and whether it has been shot through. */
let units: Array<{ at: V3; holed: boolean }> = [];
/** Air conditioners venting their gas: where, which way, since when. */
let vents: Array<{ at: V3; dir: V3; from: number; carry: number }> = [];
/** When a lamp knocked out can spark next (one at a time: a blast takes out dozens). */
let sparkAt = 0;

const carOf = (car: Piece): Car => {
  let c = cars.get(car);
  if (!c) cars.set(car, (c = { rounds: 0, broken: 0, quiet: 0 }));
  return c;
};

/**
 * A car's alarm, going off at `at` after `delay` and going for a while. One already going, or quiet
 * since its alarm stopped a little while ago, doesn't start again; past ALARMS going, the oldest stops.
 */
function carAlarm(rt: WorldRuntime, car: Piece, at: V3, delay: number): void {
  if (alarms.some((a) => a.car === car) || rt.time < carOf(car).quiet) return;
  if (alarms.length >= ALARMS) stopAlarm(alarms[0], rt);
  const voice = rt.sound.play('alarm.car', { at, delay });
  if (voice) alarms.push({ car, voice, until: rt.time + delay + 14 + Math.random() * 12 });
}

function stopAlarm(alarm: Alarm, rt: WorldRuntime): void {
  alarm.voice.stop(0.3);
  carOf(alarm.car).quiet = rt.time + REARM;
  alarms = alarms.filter((a) => a !== alarm);
}

/** A car's windows: the windscreen, the back window and the side windows, each where it is and which way it faces. */
function windows(car: Piece): Array<[V3, V3]> {
  const min: V3 = [Infinity, Infinity, Infinity];
  const max: V3 = [-Infinity, -Infinity, -Infinity];
  for (const p of car.prop!.collider) for (let k = 0; k < 3; k++) [min[k], max[k]] = [Math.min(min[k], p[k]), Math.max(max[k], p[k])];
  // In the model's frame (front to -z)
  const [w, h, l] = [max[0] - min[0], max[1] - min[1], max[2] - min[2]];
  const local: Array<[V3, V3]> = [
    [[0, h * 0.8, -l * 0.12], [0, 0.6, -0.8]],
    [[0, h * 0.8, l * 0.22], [0, 0.6, 0.8]],
    [[w * 0.45, h * 0.75, 0], [1, 0.3, 0]],
    [[-w * 0.45, h * 0.75, 0], [-1, 0.3, 0]],
  ];
  const { position, rotation } = car.textureFrame;
  return local.map(([at, normal]) => [toWorld(position, rotation, at), rotate(rotation, normal)]);
}

/** A car's windows bursting (`which`: a bit each, default all of them), glass showering off each. */
function shedGlass(car: Piece, rt: WorldRuntime, which = 0b1111): void {
  const c = carOf(car);
  const fresh = which & ~c.broken;
  if (!fresh) return;
  c.broken |= fresh;
  const gone = windows(car).filter((_, i) => fresh & (1 << i));
  for (const [at, normal] of gone) {
    rt.effects.impact(at, normal, CHIPS.glass);
    rt.effects.bullet(at, normal, { kind: 'glass', chips: CHIPS.glass });
  }
  rt.sound.play('glass.shatter', { at: gone[0][0], volume: 1.2 });
  rt.sound.play('glass.debris', { at: gone[0][0], delay: 0.3 });
}

/** The traffic stops: the city's bed down to a third, until it has been quiet for 20 s. */
function quiet(rt: WorldRuntime): void {
  if (hush < 0) rt.ambience.get('ambience.city')?.setVolume(0.35, 1.5);
  hush = rt.time + 20;
}

/** Enough noise lately, and the city answers: sirens in the distance for a while. */
function listen(rt: WorldRuntime): void {
  if (sirens || noise <= 12) return;
  const voice = rt.sound.play('siren.far', { fadeIn: 6 });
  if (voice) sirens = { voice, until: rt.time + 45 };
}

/** An air conditioner shot through: a spit of sparks off its works and its gas hissing out, once a unit. */
function holeUnit(at: V3, normal: V3, rt: WorldRuntime): void {
  const unit = units.find((u) => !u.holed && Math.hypot(u.at[0] - at[0], u.at[1] - at[1], u.at[2] - at[2]) < 0.55);
  if (!unit) return;
  unit.holed = true;
  rt.effects.sparks(at, normal, 0.35, 0xd8ecff);
  rt.sound.play('ac.hiss', { at });
  vents.push({ at, dir: normal, from: rt.time, carry: 0 });
}

/** A lamp knocked out of its fitting: sparks spitting from it and a pop. */
function shortOut(lamp: Piece, rt: WorldRuntime): void {
  if (rt.time < sparkAt) return;
  sparkAt = rt.time + 0.2;
  const at = centre(lamp);
  rt.effects.sparks(at, [0, -1, 0], 0.45, 0xffe2a8);
  rt.sound.play('lamp.short', { at });
}

const world: WorldDefinition = {
  ...meta,
  // The street was lit, as well as by the sun, by the sky's own sun shining from the other side
  // (sky.ts turned the sky the wrong way): kept as a fill from there, with less of the sky's light
  sky: { hdri: 'qwantani_afternoon_puresky_1k.hdr', azimuth: 1.15, environment: 0.05 },
  look: {
    fog: { color: 0xb9c4cc, near: 60, far: 260 },
    hemisphere: { sky: 0xc8d8ec, ground: 0x6a5a48, intensity: 0.7 },
    fill: { intensity: 3.9, azimuth: -2.41, elevation: 0.72 },
    // A blast raises brick dust that clears in about 6 s; dust takes more of its material's colour
    smoke: { life: 0.75 },
    dustPalette: { blend: 0.6 },
  },
  materials: demoMaterials,
  scenery(scene, world) {
    street(scene, world);
    skyline(scene, world);
  },
  // On the street's breakable stretch, its bed: the slabs over it are found as pieces
  groundAt: (x, z) => (inStretch(x, z) ? ROAD.bed : Math.abs(z) < STREET.halfRoad ? STREET.road : 0),
  // The pit's side along the facades is the buildings' concrete footing, not the sidewalk's layers
  pitSide: (at) => (Math.abs(at[2]) >= STREET.front - 0.05 ? null : undefined),
  props: ['models/'],
  build(d, models) {
    // The road between the curbs: asphalt over earth (what stands on it bonds to it)
    const road = d.addGround({ material: 'asphalt', under: 'earth', area: [-ROAD.half, -STREET.halfRoad, ROAD.half, STREET.halfRoad], top: STREET.road, depth: ROAD.depth, underDepth: ROAD.underDepth, cell: ROAD.cell, textureFrame: { position: ROAD_MAP } });
    // The sidewalks, curb to facade: concrete flags over the same earth, on the same bed. Each
    // side's frame starts at a joint on its curb (the far side's turned round), so its flags are the
    // slabs and the curb is painted along their edge
    const walks = ([1, -1] as const).map((side) =>
      d.addGround({
        material: 'paving',
        under: 'earth',
        area: side > 0 ? [-ROAD.half, STREET.halfRoad, ROAD.half, STREET.front] : [-ROAD.half, -STREET.front, ROAD.half, -STREET.halfRoad],
        top: 0,
        depth: WALK.depth,
        underDepth: -WALK.depth - ROAD.bed,
        cell: WALK.cell,
        textureFrame: { position: [-side * ROAD.half, 0, side * STREET.halfRoad], rotation: side > 0 ? [0, 0, 0, 1] : [0, 1, 0, 0] },
      }),
    );
    // Past the stretch both ways, the same layers that never break, drawn as the slabs are
    for (const ground of [road, ...walks]) groundEnds(d, ground);
    buildStreet(d, 7, { hydrants: !models.hydrant });
    placeProps(d, models);
    water = new Water(d);
    pigeons = new Pigeons(d);
    parked = d.all().filter(isCar);
    units = d.all().flatMap((p) => (p.materialName === 'sheet' ? [{ at: centre(p), holed: false }] : []));
    return { feet: [-2, STREET.road, -3], look: [2, 9, STREET.front + 2] };
  },
  // Nothing belongs under the asphalt: a cell pressed through the ground goes 2 m down, not 50. Past
  // its load (7,886) and as much again as a minute of the gun at a wall adds, rubble at rest goes
  destruction: { killBelow: -2, maxPieces: 9400 },
  audio: {
    // Its own pack: the pigeons, an air conditioner's gas, a lamp shorting, a tank leaking
    // (scripts/assets/packs/nyc/sounds.mjs), and steps on iron made from the base pack's (steps-metal.mjs)
    packs: ['packs/nyc/sounds/'],
    // The mix: every world's bed about -33 LUFS standing at the start (docs/changelog/phase-c/sound.md)
    ambience: [
      { sound: 'ambience.city', volume: 1.65, high: 0.4 },
      { sound: 'ambience.wind', high: 3.5 },
    ],
    // Each with the crack, thunk or ping of a bullet striking it (bullet), at its pitch unless it
    // says otherwise
    materials: {
      // A section landing whole is heard once, as one heavy thing (louder and lower the heavier)
      brick: { ...packMaterials.brick, land: 'brick.impact.large', bullet: 'bullet.brick' },
      brickBrown: { ...packMaterials.brick, land: 'brick.impact.large', bullet: 'bullet.brick' },
      brickPainted: { ...packMaterials.brick, land: 'brick.impact.large', bullet: 'bullet.brick' },
      concrete: { ...packMaterials.concrete, land: 'concrete.impact', bullet: 'bullet.concrete' },
      // The road: asphalt cracks lower than concrete; the earth under it crunches where its clods
      // land (no stone's sounds: a bullet into it then pocks it as dirt, as made, not lowered)
      asphalt: { ...packMaterials.concrete, bullet: 'bullet.concrete', pitch: 0.85 },
      earth: { impact: 'steps.rubble', debris: 'steps.rubble', bullet: 'bullet.dirt', pitch: { impact: 0.75, debris: 0.75 } },
      // The sidewalks' flags crack a little brighter than the slabs; a manhole cover rings low
      paving: { ...packMaterials.concrete, bullet: 'bullet.concrete', pitch: { bullet: 1.08 } },
      manhole: { ...packMaterials.metal, land: 'metal.impact.large', bullet: 'bullet.metal', pitch: 0.8 },
      // Plaster crumbles lighter than brick, and cracks as render does; terracotta clinks higher, an
      // air conditioner is tinny iron, a lamp a small pane
      plaster: { ...packMaterials.brick, bullet: 'bullet.concrete', pitch: 1.15 },
      pot: { ...packMaterials.brick, bullet: 'bullet.brick', pitch: 1.4 },
      sheet: { ...packMaterials.metal, bullet: 'bullet.metal', pitch: 1.35 },
      lamp: { break: 'glass.shatter', debris: 'glass.debris', bullet: 'bullet.glass', pitch: 1.25 },
      glass: { ...packMaterials.glass, bullet: 'bullet.glass' },
      painted: { ...packMaterials.wood, bullet: 'bullet.wood' },
      wood: { ...packMaterials.wood, bullet: 'bullet.wood', pitch: { bullet: 0.9 } },
      // Iron, and the cars: a fire escape or a car landing is one crash
      metal: { ...packMaterials.metal, land: 'metal.impact.large', bullet: 'bullet.metal' },
      grate: { ...packMaterials.metal, land: 'metal.impact.large', bullet: 'bullet.metal', pitch: { bullet: 1.15 } },
      // Leaves: a soft rustle and thud, not wood's knock
      foliage: { bullet: 'bullet.dirt', pitch: 1.3 },
    },
    // Iron underfoot clanks: a fire escape's grating, a car's roof, a fallen railing; down in a
    // crater the earth under the asphalt crunches, and the bed under that
    footsteps: {
      surface: ([x, y, z], material) => {
        if (material === 'grate' || material === 'metal') return 'steps.metal';
        if (material === 'earth' || (!material && inStretch(x, z) && y < STREET.road - ROAD.depth)) return 'steps.rubble';
        return undefined;
      },
    },
  },
  dust: { asphalt: 0x77736c, earth: 0x9a8670, paving: 0xc4beb4, brick: 0xa88a74, brickBrown: 0x8e7464, brickPainted: 0xc8bcae, concrete: 0xb0aaa0, plaster: 0xd8d2c8, painted: 0xc8c0b8, pot: 0xc08a6c, sheet: 0xc8c8c4, wood: 0x9a8064 },
  chips: CHIPS,
  // Masonry raises the clouds; a railing, a frame or a pot raises little, and a pane none (it goes to
  // glitter: a puff in each blown window read as a ball of cotton)
  dustAmount: { asphalt: 0.6, paving: 0.7, glass: 0, lamp: 0.2, metal: 0.15, grate: 0.15, sheet: 0.15, manhole: 0.1, painted: 0.4, pot: 0.5, foliage: 0.3 },
  onStart(rt) {
    // A car thrown or dropped: its alarm goes off, and the first time it comes down hard it loses
    // its glass
    rt.destruction.on('landed', (e) => {
      for (const car of e.pieces.filter(isCar)) {
        if (e.speed > 3) carAlarm(rt, car, e.at, 0.3);
        if (e.speed > 5) shedGlass(car, rt);
      }
    });
    // A lamp knocked out of its fitting, however (a round, a blast, the ceiling coming down)
    rt.destruction.on('state', (e) => {
      if (e.from === 'fixed' && e.piece.materialName === 'lamp') shortOut(e.piece, rt);
    });
  },
  onBlast(at, radius, rt) {
    noise += radius;
    // A car alarm along the curb near it, half the time
    const near = parked.filter((car) => Math.abs(centre(car)[0] - at[0]) < 15);
    if (radius >= 2 && near.length && Math.random() < 0.5) {
      const car = near[Math.floor(Math.random() * near.length)];
      carAlarm(rt, car, centre(car), 0.6 + Math.random() * 1.5);
    }
    // The traffic stops, and the pigeons go up; it comes back once it has been quiet a while
    quiet(rt);
    pigeons.startle(at, rt);
    listen(rt);
  },
  onShot(hit, rt) {
    // The gun going: the pigeons go up at once, the traffic stops once it has kept on a moment
    if (rt.time - firing.last > FIRING) firing.from = rt.time;
    firing.last = rt.time;
    if (rt.time - firing.from > FIRING) quiet(rt);
    pigeons.startle(rt.camera.position.toArray() as V3, rt);
    // A parked car shot: its alarm; a few more rounds and its windows go, the one nearest each round
    if (isCar(hit.piece)) {
      const car = hit.piece;
      carAlarm(rt, car, hit.at, 0.2);
      if (++carOf(car).rounds > WINDOWS_AFTER) {
        const near = windows(car).map(([at]) => Math.hypot(at[0] - hit.at[0], at[1] - hit.at[1], at[2] - hit.at[2]));
        shedGlass(car, rt, 1 << near.indexOf(Math.min(...near)));
      }
    }
    // A hydrant cracked off its main, a tank holed; an air conditioner shot through; a litter
    // basket spilling its paper
    water.shot(hit, rt);
    if (hit.material === 'sheet' || hit.material === 'metal') holeUnit(hit.at, hit.normal, rt);
    if (hit.piece?.prop?.name === 'trashcan') rt.effects.impact(hit.at, hit.normal, 0xe8e4da);
  },
  onBurst(burst, rt) {
    // The street hears a burst as it hears a blast: the traffic stops, the pigeons go up (rounds
    // into the sky too), and the noise adds up to the sirens (150 rounds about as much as five blasts)
    noise += burst.rounds * 0.08;
    quiet(rt);
    pigeons.startle(rt.camera.position.toArray() as V3, rt);
    listen(rt);
  },
  onImpact(e, rt) {
    // Something heavy coming down on a parked car sets its alarm off; on a hydrant, it cracks it
    // off its main
    if (isCar(e.other) && e.speed > 3 && e.piece.mass > 0.3) carAlarm(rt, e.other, e.at, 0.2);
    water.struck(e, rt);
  },
  update(dt, rt) {
    noise *= Math.exp(-dt / 30);
    if (hush >= 0 && rt.time > hush) {
      rt.ambience.get('ambience.city')?.setVolume(1, 12);
      hush = -1;
    }
    for (const alarm of alarms) if (rt.time > alarm.until) stopAlarm(alarm, rt);
    if (sirens && rt.time > sirens.until) {
      sirens.voice.stop(8);
      sirens = null;
    }
    // An air conditioner's gas blowing out of the hole, weakening over 2.5 s
    for (const v of vents) {
      const left = 1 - (rt.time - v.from) / 2.5;
      for (v.carry += dt * 20; v.carry >= 1; v.carry--) rt.effects.puff(v.at, { color: 0xeef1f2, size: 1.5 - left * 0.9, life: 1.3, opacity: 0.55 * left, rise: 0.3, velocity: [v.dir[0] * 3.5 * left, v.dir[1] * 3.5 * left, v.dir[2] * 3.5 * left] });
    }
    vents = vents.filter((v) => rt.time - v.from < 2.5);
    water.update(dt, rt);
    pigeons.update(dt, rt);
  },
};

export default world;
