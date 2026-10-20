// Dust Town: a frontier main street at high noon. Two rows of false-front wooden buildings with
// covered boardwalks, a brick bank, an adobe chapel with a bell, a water tower and a windmill, open
// desert and mesas beyond. Everything in the town breaks, its street too; the desert doesn't.

import { packMaterials } from '../../../lib/index.ts';
import type { WorldDefinition } from '../types.ts';
import { townMaterials } from './materials.ts';
import { meta } from './meta.ts';
import { Life } from './life.ts';
import { BED, HAZE, layStreet, onStreet, scenery, STREET } from './scenery.ts';
import { buildTown } from './town.ts';

let life: Life | null = null;

// Boards and beams: a section let go groans, and crashes once as it lands (its boards' own knocks
// then left out); a bullet thunks into them
const wood = { break: 'wood.splinter', impact: 'wood.impact', heavyImpact: 'timber.crash', debris: 'wood.impact', strain: 'timber.creak', collapse: 'timber.creak', land: 'timber.crash', settle: 'dust.settle', bullet: 'bullet.wood' };

const world: WorldDefinition = {
  ...meta,
  // Goegap lights the town (a real desert: its sandy ground bounces warm light into the shade), but
  // its photographed hills stand up to 20° over the horizon, sharp behind our mesas: the sky seen is
  // a pure one. The sun at high noon (Goegap's own stands at 47°, mid-afternoon)
  sky: {
    hdri: 'packs/western/hdri/goegap_1k.hdr',
    backgroundHdri: 'packs/western/hdri/qwantani_noon_puresky_1k.hdr',
    azimuth: 1.3,
    elevation: (65 * Math.PI) / 180,
    background: 1.05,
    environment: 0.12,
    sun: { color: 0xfff1dc, intensity: 3.7 },
    shadowRange: 55,
  },
  look: {
    fog: { color: HAZE, near: 70, far: 640 },
    exposure: 1.0,
    bloom: { strength: 0.22, radius: 0.35, threshold: 0.95 },
    // Little fill: noon shade is deep (the shade under the awnings has to read as stripes)
    hemisphere: { sky: 0xbcd0e8, ground: 0xc2a07a, intensity: 0.17 },
    // The light the sky's own sun gave from the other side while sky.ts turned the sky the wrong
    // way (the look was made with it), kept as a fill; the sky's light is less for it
    fill: { intensity: 2.4, azimuth: -2.66, elevation: 0.81 },
    ao: 0.5,
    // Bleached and warm, a little contrast for the hard noon light (no motes: against the sky
    // they read as stars; the dust that hangs is life.ts's)
    grade: { saturation: 0.92, contrast: 1.05, tint: 0xfff6ea, vignette: 0.1 },
    // The air over the hot desert shimmers: the far scrub and the mesas' feet waver, the town doesn't
    haze: { strength: 1.4, from: 60, height: 8 },
    // All dust is the street's: pale sand and dun, and a blast throws up a cloud of it, not smoke
    dustPalette: { colors: [0xd8c4a0, 0xc9ae86, 0xe4d6bc, 0xbfa27c, 0xcdbb9a] },
    smoke: { color: 0xd0b894 },
  },
  materials: townMaterials,
  ground: 0,
  scenery,
  // On the street, its bed: the slabs over it are found as pieces
  groundAt: (x, z) => (onStreet(x, z) ? BED : 0),
  // Past the fog's end (640 m), so the desert floor and the far mesas aren't cut off before it
  far: 700,
  props: ['packs/western/models/'],
  build(d, models) {
    // The street first: what stands on it (rails, troughs, the pumps and wagons) stands on its slabs
    layStreet(d);
    life = new Life(buildTown(d, models), d);
    console.debug(`western: ${d.stats.pieces} pieces`);
    return { feet: [-33, 0, -2.5], look: [12, 3.5, 1] };
  },
  // Nothing belongs under the street's earth: a clod pressed through the bed goes 0.8 m down, not 50.
  // Past 9,400 pieces (7,872 at load and about a minute of the gun at a wall), rubble at rest
  // dissolves, what's out of sight first
  destruction: { killBelow: BED - 0.8, maxPieces: 9400 },
  audio: {
    packs: ['packs/western/sounds/'],
    // The mix: every world's bed about -33 LUFS standing at the start, its steps as loud as Brick Street's (docs/changelog/phase-c/sound.md).
    // The gun's casings drop into dirt and onto boards: a softer tinkle than on pavement
    settings: { 'windmill.loop': { volume: 0.64 }, 'steps.dirt': { volume: 0.22 }, 'steps.boards': { volume: 0.2 }, 'casing.drop': { volume: 0.08 } },
    ambience: [
      { sound: 'ambience.desert', volume: 0.45, high: 0.6 },
      { sound: 'ambience.wind', high: 3.5 },
    ],
    materials: {
      siding: wood,
      timber: wood,
      // The tank's staves a little deeper, the trim and the signboards lighter
      stave: { ...wood, pitch: 0.85 },
      signpaint: { ...wood, pitch: 1.1 },
      hangboard: { ...wood, pitch: 1.1 },
      paint: { ...wood, pitch: 1.2 },
      // A sheet clatters where it strikes; a roof slope tears loose with a crash, and lands with a lower
      // one. A bullet through thin sheet pings higher than off steel
      tin: { break: 'tin.crash', impact: 'tin.impact', debris: 'tin.impact', strain: 'metal.bend', collapse: 'tin.crash', land: 'tin.crash', bullet: 'bullet.metal', heavy: 0.02, pitch: { land: 0.85, bullet: 1.25 } },
      // Sun-dried mud: a bullet goes in with a dull thud and a puff, and pocks it as it would the dirt
      adobe: { break: 'adobe.break', impact: 'brick.impact.small', heavyImpact: 'brick.impact.large', debris: 'brick.debris', strain: 'structure.creak', collapse: 'collapse.rumble', land: 'brick.impact.large', settle: 'dust.settle', bullet: 'bullet.dirt', pitch: { land: 0.8, bullet: 0.9 } },
      brick: { ...packMaterials.brick, land: 'brick.impact.large', bullet: 'bullet.brick' },
      stone: { ...packMaterials.concrete, bullet: 'bullet.concrete' },
      glass: { ...packMaterials.glass, bullet: 'bullet.glass' },
      // Bars, the stove, the safe, the pumps: heavy iron, a bullet's ping a little lower
      iron: { ...packMaterials.metal, bullet: 'bullet.metal', pitch: { bullet: 0.9 } },
      // The bell rings lower than iron where a bullet strikes it
      bronze: { impact: 'bell.toll', heavyImpact: 'bell.toll', collapse: 'metal.impact.large', bullet: 'bullet.metal', pitch: { bullet: 0.8 } },
      // Straw takes a bullet with a soft thud
      hay: { debris: 'dust.settle', bullet: 'bullet.dirt', pitch: { bullet: 1.2 } },
      // Coals: clinks, like brick chips but small and light
      coals: { break: 'brick.debris', impact: 'brick.impact.small', debris: 'brick.debris', bullet: 'bullet.brick', pitch: 1.4 },
      // The street: its clods thud down and hiss where they land, the earth's crunch lower (no
      // stone's sounds: a bullet into them is dirt)
      sand: { impact: 'steps.dirt', debris: 'dust.settle', bullet: 'bullet.dirt' },
      earth: { impact: 'steps.rubble', debris: 'steps.rubble', bullet: 'bullet.dirt', pitch: { impact: 0.75, debris: 0.75, bullet: 0.85 } },
    },
    // Hollow on the boardwalks and floors (and on boards lying in the street), dirt elsewhere; down
    // in a crater the earth crumbles underfoot, and the bed under it
    footsteps: {
      hard: 'steps.dirt',
      rubble: 'steps.rubble',
      land: 'player.land',
      surface: ([x, y, z], material, rubble) => {
        if (material === 'timber' && !rubble) return 'steps.boards';
        if (material === 'earth' || (!material && onStreet(x, z) && y < STREET.top - STREET.depth)) return 'steps.rubble';
        return undefined;
      },
    },
  },
  dust: { siding: 0xcbb89a, timber: 0xb8a080, stave: 0xcbb89a, tin: 0x9a948a, adobe: 0xc9a57a, brick: 0xb08a70, stone: 0xd0c0a0, glass: 0xe8f0ee, signpaint: 0xcbb89a, hangboard: 0xcbb89a, paint: 0xcbb89a, hay: 0xd8c27a, iron: 0x8a7a6a, bronze: 0x9a8060, coals: 0x5a5048, sand: 0xd6c2a0, earth: 0xb0947a },
  // Adobe, hay and the street go up in clouds; sheet metal and glass hardly any, the bell and the
  // tank's staves none (its roof's boards dropping as the top staves went raised a cloud over it
  // that, seen from under it against the sky, read as smoke; still at a third of it)
  dustAmount: { adobe: 1.3, hay: 1.5, sand: 2, earth: 1.4, tin: 0.15, iron: 0.1, glass: 0.4, bronze: 0, coals: 0.5, stave: 0 },
  onStart: (rt) => life?.onStart(rt),
  onBlast: (at, radius, rt) => life?.onBlast(at, radius, rt),
  onShot: (hit, rt) => life?.onShot(hit, rt),
  onBurst: (burst, rt) => life?.onBurst(burst, rt),
  onImpact: (e, rt) => life?.onImpact(e, rt),
  update: (dt, rt) => life?.update(dt, rt),
  chips: { siding: 0xd8cbb4, timber: 0x9a8466, stave: 0x9a8466, tin: 0x8a8a84, adobe: 0xb08a60, brick: 0x8a5a44, stone: 0xc8b490, glass: 0xd8ece6, iron: 0x3a3a3a, bronze: 0x8a6a3a, signpaint: 0xc9b89a, hangboard: 0xc9b89a, paint: 0xe8e0d0, hay: 0xd8c070, coals: 0x3a2a24, sand: 0xc4a47c, earth: 0x8a6650 },
};

export default world;
