// Harbor Yard: a container yard on a quay on a grey, foggy morning. Stacks of faded boxes, a
// gantry crane with a box hanging from its ropes, a corrugated warehouse, fuel tanks in a bund,
// and dark water beyond with a ship moored across the harbour. Steel dents, folds and topples;
// stacks tip when a corner goes; what goes over the edge splashes into the water; a tank holed by
// the gun leaks from each hole, and one holed enough (or by a blast) burns and blows its roof; a
// holed drum leaks; gulls scatter at a blast or a burst, and the ship's horn answers enough noise.

import type * as THREE from 'three/webgpu';
import { conjugate, type Destruction, type MaterialSounds, packMaterials, type Piece, type Q, random, rotate, toLocal, toWorld, type V3, type Voice } from '../../../lib/index.ts';
import type { BulletHit } from '../../gun.ts';
import type { WorldDefinition, WorldRuntime } from '../types.ts';
import { type Box, buildContainers, jolt, pickPaint, type QuayPair, tipStacks } from './containers.ts';
import { buildCrane, type Crane } from './crane.ts';
import { Fires, type Leak, type LeakOptions, Leaks } from './fire.ts';
import { Frame } from './frame.ts';
import { Gulls } from './gulls.ts';
import { chips, dust, harborMaterials } from './materials.ts';
import { meta } from './meta.ts';
import { placeProps } from './props.ts';
import { APRON, BEAMS, layApron, onApron, QUAY, roofed } from './ground.ts';
import { apronMaterials } from './paving.ts';
import { type Scenery, scenery, SHIP } from './scenery.ts';
import { BUND, buildTanks, type Tank } from './tanks.ts';
import { buildWarehouse } from './warehouse.ts';
import { barriers, bollard, CARTON, CARTONS, kerb, loadedPallet, mast, office, pallet, railStops } from './yard.ts';

// What the reactions keep track of (one world a page load)
let boxes: Box[] = [];
let pair: QuayPair | null = null;
let fires: Fires | null = null;
let leaks: Leaks | null = null;
let gulls: Gulls | null = null;
let crane: Crane | null = null;
let tanks: Tank[] = [];
let around: Scenery | null = null;
/** Until when to keep checking for stacks that have lost their footing. */
let tipUntil = 0;
let time = 0;
/** Blasts and bursts lately (decaying): enough of them and the ship sounds its horn. */
let noise = 0;
const state = {
  /** The last loud noise (a blast, the gun): the gulls keep away a while after it. */
  loudAt: -100,
  gullsAt: 12,
  hornAt: 25,
  hornedAt: -100,
  sirens: null as { voice: Voice; until: number } | null,
  rattleAt: -10,
  sparks: 0,
  splashAt: 0,
  splashed: new WeakSet<Piece>(),
  /** When the leaks were last looked at (still on what holed them?). */
  leaksAt: 0,
  fires: [] as Array<{ tank: Tank; at: V3; out: V3; until: number; puffAt: number; blowAt: number; voices: Array<Voice | null>; flame: number }>,
};

/** Build the yard: containers, the crane, the warehouse, the tanks, the quay and its furniture. */
function buildYard(d: Destruction): void {
  const rand = random(3);
  ({ boxes, pair } = buildContainers(d));
  for (const b of boxes) for (const { leaf, post, hinge } of b.leaves) doors.set(leaf, { post, hinge });
  crane = buildCrane(d, pickPaint(rand));
  buildWarehouse(d);
  tanks = buildTanks(d);
  // The quay: its kerb, bollards between the fenders
  kerb(d, QUAY.edge, -35, 35);
  for (let x = -30; x <= 30; x += 10) bollard(d, x, -28.7);
  // Light masts (the first off the line of sight down the lane), barriers along it, the site
  // office, the crane rails' end stops
  mast(d, -4.5, 2.2, 0.6);
  mast(d, 32, 12, -0.4);
  mast(d, -26, -25, 0.2);
  barriers(d, 12.3, 10, 8);
  office(d, -7, 11.5);
  railStops(d, 6.3, [-21, -1]);
  // Pallets: three stacks of empties, loaded ones about the pallet area, two in the open box, cartons spilled out of it
  const f = new Frame(d, [0, 0, 0]);
  for (const [x, z] of [
    [-30, 4],
    [-28.6, 4],
    [-22.5, 4],
  ])
    for (let k = 0; k < 8; k++) pallet(f, [x + (rand() - 0.5) * 0.05, k * 0.122, z + (rand() - 0.5) * 0.05], false, (rand() - 0.5) * 0.06);
  for (const [x, z, across] of [
    [-26.6, 3.0, 0],
    [-25.2, 3.0, 0],
    [-26.6, 4.6, 0],
    [-22.5, 6.2, 0],
    [-21.0, 6.2, 0],
    [-32.6, 0.9, 1],
  ])
    loadedPallet(f, [x, 0, z], across === 1, rand);
  for (const x of [-14.6, -13.2]) loadedPallet(f, [x, 0.16, 4.42], false, rand);
  for (let i = 0; i < 6; i++) {
    const c = new Frame(d, [-8.6 + rand() * 2.2, 0, 3 + rand() * 3], rand() * Math.PI);
    c.boxAt('cardboard', [0, CARTON[1] / 2, 0], CARTON, undefined, { tint: CARTONS[i % 3] });
  }
}

/** Splashes: pieces that go over the edge, a splash each (near ones as one, by their mass). */
function splashes(rt: WorldRuntime): void {
  const groups: Array<{ at: V3; mass: number }> = [];
  for (const p of rt.destruction.loosePieces) {
    if (state.splashed.has(p)) continue;
    const [x, y, z] = p.pose.position;
    if (z > QUAY.edge || y > QUAY.water + 0.2) continue;
    state.splashed.add(p);
    const g = groups.find((g) => Math.hypot(g.at[0] - x, g.at[2] - z) < 3);
    if (g) g.mass += p.mass;
    else groups.push({ at: [x, QUAY.water, z], mass: p.mass });
  }
  for (const g of groups.slice(0, 4)) {
    const m = g.mass;
    // The splash takes are heavy plunges: chips and flakes only throw spray
    if (m > 0.03) rt.sound.play('water.splash', { at: g.at, volume: Math.min(1.1, 0.3 + Math.sqrt(m) * 0.35), pitch: Math.min(1.5, Math.max(0.7, 1.3 - Math.log10(1 + m) * 0.45)) });
    rt.effects.dust([g.at[0], g.at[1] + 0.3, g.at[2]], Math.min(6, 0.4 + m * 0.6), 0xdfe6e8);
    for (let k = 0; k < Math.min(5, 1 + m * 2); k++) rt.effects.impact([g.at[0] + (Math.random() - 0.5), g.at[1] + 0.1, g.at[2] + (Math.random() - 0.5)], [0, 1, 0], 0xb8c4c8);
  }
}

/** The open box's door leaves: the post each hangs from, and its hinge. */
const doors = new Map<Piece, { post: Piece; hinge: V3 }>();
/** The open box's door leaves once hung, each with the velocity it was last slowed from. */
const hung = new Map<Piece, V3>();
/** How much a leaf's hinges take off its speed at each new pose (m/s, about every 0.1 s). */
const HINGE_DRAG = 0.05;

/**
 * The leaves' hinges are stiff: a leaf slows as it swings, and stops (on free hinges one turns on
 * at a few cm/s for good, and counts as moving). Once a readback, from its velocity then.
 */
function drag(rt: WorldRuntime): void {
  for (const [leaf, last] of hung) {
    const v = leaf.body.velocity;
    if (leaf.state !== 'loose' || (v[0] === last[0] && v[1] === last[1] && v[2] === last[2])) continue;
    hung.set(leaf, [v[0], v[1], v[2]]);
    const k = Math.min(1, HINGE_DRAG / (Math.hypot(v[0], v[1], v[2]) || 1));
    rt.destruction.push(leaf, [-v[0] * k, -v[1] * k, -v[2] * k]);
  }
}

/**
 * A round into one of the open box's door leaves swings it on its stiff hinges, a little each round
 * (pushed only while it swings slower than 2 m/s that way).
 */
function swing(leaf: Piece, hit: BulletHit, rt: WorldRuntime): void {
  const door = doors.get(leaf);
  if (!door || door.post.state !== 'fixed') return;
  if (leaf.state === 'fixed') {
    rt.destruction.hinge(leaf, door.hinge, [0, 1, 0], { to: door.post });
    hung.set(leaf, [0, 0, 0]);
  }
  const [dx, , dz] = hit.direction;
  const v = leaf.body.velocity;
  if (v[0] * dx + v[2] * dz < 2) rt.destruction.push(leaf, [dx * 0.5, 0, dz * 0.5]);
}

/** A tank breached: it burns, smokes, and soon its roof blows off (once). */
function burn(tank: Tank, rt: WorldRuntime): void {
  tank.breached = true;
  // The hole: where the torn course segment nearest the blast stood, not where it has flown
  let at: V3 = tank.armedAt;
  let best = Infinity;
  for (const p of tank.shell) {
    const b = tank.built.get(p);
    if (p.state === 'fixed' || !b) continue;
    const d = Math.hypot(b[0] - tank.armedAt[0], b[1] - tank.armedAt[1], b[2] - tank.armedAt[2]);
    if (d < best) {
      best = d;
      at = b;
    }
  }
  const c = tank.center;
  const dx = at[0] - c[0];
  const dz = at[2] - c[2];
  const r = Math.hypot(dx, dz) || 1;
  const out: V3 = [dx / r, 0, dz / r];
  // The flame's foot just outside the shell, a little under the hole's middle (it licks up the side)
  const y = Math.max(0.6, Math.min(tank.height - 1.5, at[1] - 0.5));
  const hole: V3 = [c[0] + out[0] * (tank.radius + 0.7), y, c[2] + out[2] * (tank.radius + 0.7)];
  // The fuel catches with a whoomph, then roars
  rt.sound.play('fuel.ignite', { at: hole });
  const voices = [rt.sound.play('fire.loop', { at: hole, fadeIn: 0.5 }), rt.sound.play('rocket.loop', { at: hole, pitch: 0.55, volume: 0.5 })];
  const flame = fires?.start(hole) ?? -1;
  state.fires.push({ tank, at: hole, out, until: time + 40, puffAt: time, blowAt: time + 1.5 + Math.random() * 1.5, voices, flame });
}

/** A tank's hole: a full tank runs a while and spreads a wide pool in the bund; a drum's trickles. */
const TANK_LEAK: LeakOptions = { strip: 0.22, most: 1.6, spread: 14, life: 75 };
const DRUM_LEAK: LeakOptions = { strip: 0.12, most: 0.55, spread: 5, life: 25 };
/** The gun's rounds into a tank's shell (lately) that set it alight: about 3 s of a burst held on it. A round that tears the shell counts for six. */
const CATCH = 40;
/** The leaks heard at once, a loop each (a tank's gurgle, a drum's trickle): past it the oldest goes quiet. */
const LEAK_VOICES = 3;
const gurgles = new Map<object, Voice>();

/** The tank whose shell is at `at`. */
const tankAt = (at: V3): Tank | undefined => tanks.find((t) => Math.hypot(at[0] - t.center[0], at[2] - t.center[2]) < t.radius + 0.3 && at[1] < t.height + 0.1);

/** What a stream from `at` runs down onto: the first thing under it but small things it runs past (a pipe, a ladder's rung): the slabs, a box's floor. */
function floorUnder(at: V3, rt: WorldRuntime): number {
  let from = at;
  for (let k = 0; k < 4; k++) {
    const h = rt.destruction.raycast(from, [0, -1, 0], from[1] + 1);
    if (!h) return 0;
    if (h.piece.ground || h.piece.size > 0.6) return h.point[1];
    from = [h.point[0], h.point[1] - 0.02, h.point[2]];
  }
  return 0;
}

/**
 * A round into a tank's shell from outside: the hole leaks (four streams a tank at most; a round
 * near one feeds it), and with enough rounds lately the fuel catches, as a blast's breach sets it
 * alight. Once it burns, the fire is what shows.
 */
function shotTank(t: Tank, hit: BulletHit, rt: WorldRuntime): void {
  if (t.breached) return;
  const l = Math.hypot(hit.at[0] - t.center[0], hit.at[2] - t.center[2]) || 1;
  const out: V3 = [(hit.at[0] - t.center[0]) / l, 0, (hit.at[2] - t.center[2]) / l];
  if (hit.normal[0] * out[0] + hit.normal[2] * out[2] < 0.3) return;
  t.heat += hit.broke ? 6 : 1;
  if (t.heat >= CATCH) {
    t.armedAt = [...hit.at];
    burn(t, rt);
    return;
  }
  if (!leaks) return;
  const mine = leaks.of(t);
  if (mine.length >= 4 || mine.some((l) => Math.hypot(l.at[0] - hit.at[0], l.at[1] - hit.at[1], l.at[2] - hit.at[2]) < 0.6)) return;
  // Down the shell from the hole, out from the tank's axis
  leaks.start(t, hit.at, out, floorUnder([hit.at[0] + out[0] * 0.06, hit.at[1], hit.at[2] + out[2] * 0.06], rt), TANK_LEAK, time);
  gurgle(t, hit.at, 'fuel.leak', rt);
}

/** A round into a drum: a hole low or on its side trickles (two a drum at most), one on top doesn't. */
function shotDrum(drum: Piece, hit: BulletHit, rt: WorldRuntime): void {
  if (!leaks || hit.normal[1] > 0.5) return;
  const mine = leaks.of(drum);
  if (mine.length >= 2 || mine.some((l) => Math.hypot(l.at[0] - hit.at[0], l.at[1] - hit.at[1], l.at[2] - hit.at[2]) < 0.15)) return;
  const from: V3 = [hit.at[0] + hit.normal[0] * 0.04, hit.at[1], hit.at[2] + hit.normal[2] * 0.04];
  const leak = leaks.start(drum, hit.at, hit.normal, floorUnder(from, rt), DRUM_LEAK, time);
  const { position, rotation } = drum.pose;
  drums.set(leak, { hole: toLocal(position, rotation, hit.at), normal: rotate(conjugate(rotation), hit.normal), position: [...position], rotation: [...rotation] });
  gurgle(drum, hit.at, 'drum.leak', rt);
}
/** The leaking drums' holes (in the drum's frame) and where each drum was when last looked at. */
const drums = new Map<Leak, { hole: V3; normal: V3; position: V3; rotation: Q }>();

/**
 * A drum the gun pushes along takes its leaks with it (a new pool where one runs off the last); one
 * turned with the hole on top, or gone, stops leaking.
 */
function followDrums(rt: WorldRuntime): void {
  for (const [leak, d] of drums) {
    const drum = leak.source as Piece;
    if (leak.ending !== Infinity || !leaks?.leaks.includes(leak)) {
      drums.delete(leak);
      continue;
    }
    if (drum.state === 'gone') {
      leaks.end(leak, time);
      continue;
    }
    const { position, rotation } = drum.pose;
    if (position.every((v, k) => Math.abs(v - d.position[k]) < 0.005) && rotation.every((v, k) => Math.abs(v - d.rotation[k]) < 0.002)) continue;
    d.position = [...position];
    d.rotation = [...rotation];
    const normal = rotate(rotation, d.normal);
    if (normal[1] > 0.5) {
      leaks.end(leak, time);
      continue;
    }
    const at = toWorld(position, rotation, d.hole);
    leaks.move(leak, at, normal, floorUnder([at[0] + normal[0] * 0.04, at[1], at[2] + normal[2] * 0.04], rt), time);
  }
}

/** A leak's sound: one loop for each tank or drum leaking, louder with more holes, the oldest let go past LEAK_VOICES. */
function gurgle(source: object, at: V3, sound: string, rt: WorldRuntime): void {
  const holes = leaks?.of(source).length ?? 1;
  const going = gurgles.get(source);
  if (going) return going.setVolume(Math.min(1.3, 0.7 + 0.2 * holes), 0.5);
  if (gurgles.size >= LEAK_VOICES) {
    const [first, voice] = gurgles.entries().next().value!;
    voice.stop(0.6);
    gurgles.delete(first);
  }
  const voice = rt.sound.play(sound, { at, fadeIn: 0.4 });
  if (voice) gurgles.set(source, voice);
}

/**
 * The leaks, four times a second: a tank's stops when the shell it ran down has gone from under the
 * hole; a tank or drum with none running goes quiet.
 */
function checkLeaks(rt: WorldRuntime): void {
  if (!leaks) return;
  for (const l of leaks.leaks) {
    if (l.ending !== Infinity || drums.has(l)) continue;
    const outside: V3 = [l.at[0] + l.out[0] * 0.08, l.at[1], l.at[2] + l.out[2] * 0.08];
    if (rt.destruction.raycast(outside, [-l.out[0], 0, -l.out[2]], 0.2)?.piece.materialName !== 'tank') leaks.end(l, time);
  }
  for (const [source, voice] of gurgles)
    if (!leaks.of(source).length) {
      voice.stop(1.5);
      gurgles.delete(source);
    }
}

/** A loud noise at `at` (a blast, the gun): the gulls take off, crying if it had been quiet a while, and keep away. */
function loud(at: V3, rt: WorldRuntime): void {
  if (time - state.loudAt > 25) rt.sound.play('gulls.scatter', { delay: 0.3 });
  state.loudAt = time;
  state.gullsAt = Math.max(state.gullsAt, time + 30);
  gulls?.scatter(at, time, Math.random);
}

/** Where the gulls perch: bollards on the quay, the crane's girders, the stacks' roofs and the light masts' heads (x, z: on top of what stands there). */
const PERCHES: Array<[number, number]> = [
  [-20, -28.7],
  [-10, -28.7],
  [10, -28.7],
  [20, -28.7],
  [-17.3, -22.5],
  [-12.3, -18],
  [-17.3, -3],
  [-12.3, 1],
  [-26.8, -16.2],
  [-7.6, -9.4],
  [18.4, 6.2],
  [24.5, -2],
  [-4.5, 2.2],
  [32, 12],
  [-26, -25],
];

/** The top of what stands at (x, z) (null: nothing there). */
function topAt(x: number, z: number, rt: WorldRuntime): V3 | null {
  const h = rt.destruction.raycast([x, 40, z], [0, -1, 0], 40);
  return h && h.normal[1] > 0.7 ? [x, h.point[1], z] : null;
}

/** Materials that ring as steel underfoot: boxes, the crane, the tanks, the stiles, the office's floor, the drums. */
const METAL = new Set(['container', 'steel', 'cladding', 'rollerDoor', 'tank', 'roof', 'iron', 'drum']);
/** Fuel smoke. */
const SOOT = 0x1c1a18;

const world: WorldDefinition = {
  ...meta,
  sky: { hdri: 'packs/harbor/hdri/kloofendal_overcast_puresky_1k.hdr', azimuth: 0.75, background: 0.72, environment: 0.75, sun: { color: 0xdfe6ee, intensity: 1.2 } },
  look: {
    fog: { color: 0x929ea8, near: 6, far: 340 },
    exposure: 0.92,
    bloom: { strength: 0.25, radius: 0.5, threshold: 0.9 },
    hemisphere: { sky: 0xb8c4cc, ground: 0x5a5c58, intensity: 0.55 },
    ao: 0.8,
    reflections: { strength: 1, distance: 30 },
    grade: { saturation: 0.92, contrast: 1.06, tint: 0xeef2f6, vignette: 0.25 },
    // A rocket's cloud on steel and concrete: grey smoke and grit, thinner and sooner gone than brick dust
    smoke: { color: 0x8c8e8e, opacity: 0.85, life: 0.7, scale: 0.8 },
    // Grit of steel, paint and concrete: greys, each material's own colour mostly kept
    dustPalette: { colors: [0x9a9c9c, 0x8a8e90, 0xa8a8a4, 0x7e8284], blend: 0.6 },
  },
  // The yard's own, and the apron's slabs over their crushed stone
  materials: () => ({ ...harborMaterials(), ...apronMaterials() }),
  ground: 0,
  scenery(scene, w) {
    around = scenery(scene, w);
    fires = new Fires(scene);
    gulls = new Gulls(scene, 13, 3, random(17));
    // What leaks from the tanks stays inside the bund's wall
    const { x0, x1, z0, z1, wall } = BUND;
    leaks = new Leaks(scene, [
      [x0, z0, x1, z0 + wall],
      [x0, z1 - wall, x1, z1],
      [x0, z0, x0 + wall, z1],
      [x1 - wall, z0, x1, z1],
    ]);
  },
  // The water's surface past the quay edge (a rocket goes off on it); on the apron its bed (the slabs
  // over it are found as pieces); the player keeps to the quay
  groundAt: (x, z) => (z < QUAY.edge ? QUAY.water : onApron(x, z) ? APRON.bed : 0),
  walkable: (_x, z) => z > QUAY.edge + 0.3,
  // The harbour: bullets go into it unseen, blasts leave no soot on it
  water: (_x, z) => z < QUAY.edge,
  // The crane rails' beams are concrete from the bed up, not the apron's layers
  pitSide: (at) => (at[0] > BEAMS.x0 - 0.05 && at[0] < BEAMS.x1 + 0.05 && BEAMS.rails.some((z) => Math.abs(at[2] - z) <= BEAMS.half + 0.05) ? null : undefined),
  // What sinks is out of sight under the dark water: taken out of the world 3 m down. Light sheet
  // thrown by a blast flies at most 25 m/s, so it lands in the yard (at 40, up to 110 m off). Past
  // 8,300 pieces (1,500 over the yard at load) rubble at rest dissolves, for a long session
  destruction: { killBelow: QUAY.water - 3, maxSpeed: 25, maxPieces: 8300 },
  props: ['packs/harbor/models/'],
  build(d, models) {
    layApron(d);
    buildYard(d);
    placeProps(d, models);
    // A collapse anywhere may leave a box on two posts: look for it while things come down
    d.on('collapse', () => (tipUntil = Math.max(tipUntil, time + 1)));
    return { feet: [8, 0, 24], look: [0, 7, -20] };
  },
  audio: {
    packs: ['packs/harbor/sounds/'],
    // The mix: every world's bed about -33 LUFS standing at the start, its steps as loud as Brick Street's (docs/changelog/phase-c/sound.md)
    settings: { 'explosion.near': { reverb: 0.35 }, 'steps.wet': { volume: 0.32 }, 'steps.metal': { volume: 0.22 } },
    ambience: [
      { sound: 'ambience.harbor', volume: 0.9, high: 0.5 },
      { sound: 'ambience.wind', high: 3 },
    ],
    footsteps: {
      hard: 'steps.wet',
      // Steel on boxes, the crane and drums; rubble of anything else crunches, and so does the
      // apron's crushed stone in a crater and its bed under it; dry on concrete pieces and under a
      // roof (a pallet in the shed too); the wet deck elsewhere, the apron's slabs too
      surface: ([x, y, z], material, rubble) => {
        if (material && METAL.has(material)) return 'steps.metal';
        if (rubble || material === 'gravel' || (!material && onApron(x, z) && y < -APRON.depth)) return 'steps.rubble';
        if (material === 'concrete' || roofed(x, z)) return 'steps.asphalt';
        return undefined;
      },
    },
    // What a bullet sounds like on each: steel rings higher the thinner it is, cast iron duller; the
    // cartons and the stone under the slabs thud
    materials: (() => {
      const steel: MaterialSounds = { break: 'metal.bend', impact: 'metal.impact.small', heavyImpact: 'metal.impact.large', debris: 'metal.impact.small', strain: 'container.groan', collapse: 'container.collapse', bullet: 'bullet.metal', pitch: { bullet: 0.9 } };
      // Thin sheeting rings higher than a box's walls
      const sheet: MaterialSounds = { break: 'sheet.tear', impact: 'container.clang', heavyImpact: 'metal.impact.large', debris: 'metal.impact.small', strain: 'metal.bend', collapse: 'metal.impact.large', bullet: 'bullet.metal', pitch: { break: 1.1, impact: 1.2, bullet: 1.2 } };
      // A loose panel clangs; a whole box landing booms (onStart)
      const box: MaterialSounds = { break: 'sheet.tear', impact: 'container.clang', heavyImpact: 'container.clang', debris: 'metal.impact.small', strain: 'container.groan', collapse: 'container.collapse', bullet: 'bullet.metal', pitch: { bullet: 1.1 } };
      const lit: MaterialSounds = { break: 'glass.shatter', impact: 'glass.debris', debris: 'glass.debris', bullet: 'bullet.glass' };
      return {
        container: box,
        // A tank's shell is heavier plate than a box's wall
        tank: { ...box, pitch: 0.85 },
        cladding: sheet,
        rollerDoor: sheet,
        roof: { ...sheet, pitch: { break: 0.95, impact: 1.05, bullet: 1.05 } },
        steel,
        cable: { break: 'metal.bend', impact: 'chain.rattle', heavyImpact: 'chain.rattle', debris: 'chain.rattle', bullet: 'bullet.metal', pitch: { bullet: 0.8 } },
        // Cast iron: duller and lower
        iron: { break: 'metal.bend', impact: 'metal.impact.small', heavyImpact: 'metal.impact.large', bullet: 'bullet.metal', pitch: 0.75 },
        drum: { impact: 'drum.bonk', heavyImpact: 'drum.bonk', bullet: 'bullet.metal' },
        concrete: { ...packMaterials.concrete, bullet: 'bullet.concrete' },
        // The apron: its slabs as the concrete, the crushed stone under them crunching
        slab: { ...packMaterials.concrete, bullet: 'bullet.concrete' },
        gravel: { impact: 'steps.rubble', debris: 'steps.rubble', bullet: 'bullet.dirt' },
        wood: { ...packMaterials.wood, bullet: 'bullet.wood' },
        cardboard: { impact: 'wood.impact', heavyImpact: 'wood.impact', bullet: 'bullet.dirt', pitch: { impact: 0.7, heavyImpact: 0.7, bullet: 1.2 } },
        glass: lit,
        // The floodlights' small panes
        lamp: { ...lit, pitch: 1.25 },
        beacon: { ...lit, pitch: 1.25 },
      };
    })(),
  },
  dust,
  chips,
  // Steel and sheet raise a little grit, not a masonry cloud
  dustAmount: { container: 0.15, steel: 0.15, cable: 0.1, tank: 0.1, roof: 0.1, cladding: 0.25, rollerDoor: 0.25, iron: 0.3 },
  onStart(rt) {
    // The gulls to their perches, a perch each, in an order of their own
    const rand = random(29);
    const perches = PERCHES.map(([x, z]) => topAt(x, z, rt)).filter((p): p is V3 => !!p);
    for (let i = perches.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [perches[i], perches[j]] = [perches[j], perches[i]];
    }
    gulls?.settle(perches);
    // Water lapping along the quay
    for (const x of [-24, 0, 24]) rt.sound.play('water.lap', { at: [x, -1.4, QUAY.edge - 0.3] });
    // A box landing whole booms, once (a loose panel only clangs), and so does a heavy length of the
    // crane, lower
    rt.destruction.on('landed', (e) => {
      const box = e.material === 'container' && (e.pieces.length >= 20 || e.mass > 1);
      const girder = e.material === 'steel' && e.mass > 4;
      if (box || girder) rt.sound.play('container.boom', { at: e.at, volume: Math.min(1.2, e.speed / 8), pitch: girder ? 0.7 : 1 });
    });
  },
  onBlast(at, radius, rt) {
    noise += radius;
    loud(at, rt);
    // Near the crane's hoist, the ropes rattle
    if (crane && Math.hypot(at[0] - crane.hoist[0], at[1] - crane.hoist[1], at[2] - crane.hoist[2]) < 15) rattle(rt);
    // A blast on the water throws spray
    if (at[2] < QUAY.edge && at[1] < 0) {
      rt.effects.dust([at[0], QUAY.water + 0.5, at[2]], 6, 0xdfe6e8);
      rt.sound.play('water.splash', { at: [at[0], QUAY.water, at[2]], volume: 1, pitch: 0.8 });
    }
    tipUntil = time + 1.5;
    // The open box's door leaves swing on their hinges once a blast shakes them
    for (const b of boxes)
      for (const { leaf, post, hinge } of b.leaves) {
        const dx = leaf.pose.position[0] - at[0];
        const dz = leaf.pose.position[2] - at[2];
        const r = Math.hypot(dx, dz);
        if (leaf.state !== 'fixed' || post.state !== 'fixed' || r > 12) continue;
        rt.destruction.hinge(leaf, hinge, [0, 1, 0], { to: post });
        const k = Math.min(4, 12 / (1 + r)) / (r || 1);
        rt.destruction.push(leaf, [dx * k, 0, dz * k]);
        hung.set(leaf, [0, 0, 0]);
      }
    // A blast on the fuel a holed tank has spilt sets it alight; what it reaches of the pools is thrown
    const spilt = leaks?.poolNear(at, radius) as Tank | null;
    if (spilt && tanks.includes(spilt) && !spilt.breached) {
      spilt.armedAt = [...at];
      burn(spilt, rt);
    }
    leaks?.clear(at, radius * 0.7, time);
    // A blast on a tank's shell may breach it (a dent from flying debris doesn't)
    for (const t of tanks) {
      const out = Math.max(0, Math.hypot(at[0] - t.center[0], at[2] - t.center[2]) - t.radius);
      const up = Math.max(0, -at[1], at[1] - t.height * 1.2);
      if (Math.hypot(out, up) < radius + 0.5) {
        t.armedUntil = time + 0.5;
        t.armedAt = [...at];
      }
    }
  },
  onShot(hit, rt) {
    loud(hit.at, rt);
    const p = hit.piece;
    if (!p) return;
    // A tank's shell leaks and catches, a drum leaks, the hanging box's ropes rattle, a floodlight
    // shot out sparks, a door leaf swings
    const tank = hit.material === 'tank' ? tankAt(hit.at) : undefined;
    if (tank) shotTank(tank, hit, rt);
    else if (p.prop?.name === 'drum') shotDrum(p, hit, rt);
    else if (crane && hit.at[1] > crane.hoist[1] - 3.6 && Math.abs(hit.at[0] - crane.hoist[0]) < 6.5 && Math.abs(hit.at[2] - crane.hoist[2]) < 1.5) rattle(rt);
    else if ((hit.material === 'lamp' || hit.material === 'beacon') && hit.broke) rt.effects.sparks(hit.at, hit.normal, 0.35, 0xffe0a0);
    else swing(p, hit, rt);
  },
  onBurst(burst, rt) {
    // The yard hears a burst as it does a blast, the less for its rounds (70 of them about a rocket
    // and a half): the gulls, the ship's horn when it adds up; and stacks it undermined tip
    noise += burst.rounds * 0.05;
    const p = rt.camera.position;
    loud(burst.at ?? [p.x, p.y, p.z], rt);
    tipUntil = Math.max(tipUntil, time + 1.5);
  },
  onImpact(e, rt) {
    const name = e.piece.materialName;
    // Steel on steel or concrete, hard: a few sparks
    if ((name === 'steel' || name === 'container' || name === 'iron') && e.speed > 6 && state.sparks < 6) {
      state.sparks++;
      rt.effects.sparks(e.at, [0, 1, 0], 0.12);
    }
  },
  update(dt, rt) {
    time = rt.time;
    noise *= Math.exp(-dt / 30);
    state.sparks = Math.max(0, state.sparks - dt * 6);
    const fog = rt.scene.fog as THREE.Fog | null;
    // The sea fog breathes
    if (fog) fog.far = 340 + 40 * Math.sin((time * Math.PI * 2) / 70);
    if (around) {
      for (const b of around.buoys) {
        b.mesh.position.y = b.y + Math.sin(time * 1.1 + b.phase) * 0.12;
        b.mesh.rotation.z = Math.sin(time * 0.8 + b.phase) * 0.08;
      }
      // Never quite 0: a material's numbers count in its pipeline's key as zero or not, and
      // switching keys costs a long frame
      around.lighthouse.emissiveIntensity = time % 5 < 0.7 ? 6 : 0.02;
    }
    // The crane's beacon blinks (lit only while it stands: its material glows 'standing')
    const beacon = rt.destruction.materials.beacon.surface as THREE.MeshStandardNodeMaterial;
    beacon.emissiveIntensity = time % 2 < 1 ? 8 : 0.2;
    // The gulls wheel and come back; a call now and then from one in the air (else somewhere overhead)
    gulls?.update(dt, time, (perch) => Math.abs((topAt(perch[0], perch[2], rt)?.[1] ?? -9) - perch[1]) < 0.08);
    if (time > state.gullsAt) {
      state.gullsAt = time + 8 + Math.random() * 12;
      const a = Math.random() * Math.PI * 2;
      const r = 25 + Math.random() * 25;
      const p = rt.camera.position;
      rt.sound.play('gulls.call', { at: gulls?.flying(Math.random) ?? [p.x + Math.cos(a) * r, 15 + Math.random() * 15, p.z + Math.sin(a) * r] });
    }
    // The ship's horn: now and then, and twice when the yard gets loud
    if (time > state.hornAt || (noise > 10 && time - state.hornedAt > 40)) {
      state.hornAt = time + 90 + Math.random() * 70;
      state.hornedAt = time;
      const at: V3 = [SHIP.x, SHIP.deck, SHIP.z];
      rt.sound.play('ship.horn', { at });
      if (noise > 10) rt.sound.play('ship.horn', { at, delay: 6 });
    }
    if (!state.sirens && noise > 18) {
      const voice = rt.sound.play('siren.far', { fadeIn: 6 });
      if (voice) state.sirens = { voice, until: time + 45 };
    }
    if (state.sirens && time > state.sirens.until) {
      state.sirens.voice.stop(8);
      state.sirens = null;
    }
    // Stacks that have lost their footing tip, and the quay pair goes over once shaken
    if (time < tipUntil) {
      tipStacks(rt.destruction, boxes);
      if (pair) jolt(rt.destruction, pair);
    }
    // Splashes, ten times a second while anything moves
    if (time > state.splashAt) {
      state.splashAt = time + 0.1;
      if (rt.destruction.loosePieces.size) splashes(rt);
    }
    drag(rt);
    // The leaks run and spread; the gun's rounds into a tank fade from its count
    followDrums(rt);
    leaks?.update(time);
    if (time > state.leaksAt) {
      state.leaksAt = time + 0.25;
      checkLeaks(rt);
    }
    for (const t of tanks) t.heat *= Math.exp(-dt / 20);
    // Tanks: a blast that opens the shell sets it burning
    for (const t of tanks) if (!t.breached && time < t.armedUntil && [...t.shell].some((p) => p.state !== 'fixed')) burn(t, rt);
    let lit: (typeof state.fires)[number] | null = null;
    for (const fire of state.fires) {
      if (time < fire.until) {
        lit = fire;
        if (time > fire.puffAt) {
          // Black smoke rolling up above and behind the flame (so the flame shows in front of it),
          // and from the open top once the roof has gone; embers
          fire.puffAt = time + 0.3;
          const [x, y, z] = fire.at;
          const j = () => (Math.random() - 0.5) * 0.8;
          const t = fire.tank;
          const roofless = fire.blowAt < 0 && Math.random() < 0.5;
          const from: V3 = roofless ? [t.center[0] + j(), t.height + 1, t.center[2] + j()] : [x - fire.out[0] * 0.9 + j(), y + 3, z - fire.out[2] * 0.9 + j()];
          rt.effects.puff(from, { color: SOOT, rise: 2.4, size: 8, life: 9, opacity: 0.85, velocity: [0.35, 1.5, 0] });
          rt.effects.sparks([x, y + 0.6, z], [0, 1, 0], 0.1, 0xff8a30);
        }
      }
      if (fire.blowAt > 0 && time > fire.blowAt) {
        // The roof goes, as a tank's frangible roof seam is made to: up, not the shell out; it
        // lifts and drops back into and around the tank, in a cloud of black smoke
        fire.blowAt = -1;
        const t = fire.tank;
        const top: V3 = [t.center[0], t.height - 0.5, t.center[2]];
        // Short of the shell's inner faces: the roof goes, the courses stay
        rt.destruction.explode({ at: top, radius: t.radius * 0.85, speed: 3 });
        const smoke = rt.effects.smoke;
        rt.effects.smoke = { color: SOOT, opacity: 1, life: 1.2 };
        rt.effects.explosion([top[0], t.height + 0.5, top[2]], [0, 1, 0], 1.6);
        rt.effects.smoke = smoke;
        rt.sound.play('explosion.near', { at: top });
        noise += 4;
        tipUntil = time + 1.5;
      }
      if (fire.until > 0 && time > fire.until) {
        fire.until = -1;
        for (const v of fire.voices) v?.stop(3);
        fires?.stop(fire.flame);
      }
    }
    fires?.update(time, lit?.at ?? null);
  },
};

/** The hoist's ropes rattling (not too often). */
function rattle(rt: WorldRuntime): void {
  if (!crane || time - state.rattleAt < 2) return;
  state.rattleAt = time;
  rt.sound.play('chain.rattle', { at: crane.hoist });
}

export default world;
