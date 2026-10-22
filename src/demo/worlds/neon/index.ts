// Neon Alley: a narrow alley at night in a dense megacity, in the rain. Tile-clad towers and
// rendered shophouses stand close on both sides, stacked with neon glyph signs, blade signs and
// lightboxes; a glass footbridge crosses overhead; lanterns and cables sag between the facades; an
// end block with a lit arcade closes the far end. The wet street reflects the neon, and breaks:
// a rocket craters it, the gun chips it. Signs short out with sparks, blasts brown the street's
// light out, and the transformer box blacks it out; under the gun, signs and lamps are shot dark,
// shutters rattle, pipes gush steam and a long burst browns the alley out.

import { packMaterials, random } from '../../../lib/index.ts';
import type { WorldDefinition } from '../types.ts';
import { endBlock, landmarks, shophouse, shops, towerA } from './buildings.ts';
import { GROUND, LOTS, onGround, START } from './layout.ts';
import { footstep, onBlast, onBurst, onImpact, onShot, peelFacades, pointLights, startLife, update } from './life.ts';
import { glow, neonMaterials } from './materials.ts';
import { meta } from './meta.ts';
import { placeProps } from './props.ts';
import { blockMaterial, dormantScenery, neonScenery, shopfrontPiece, streetBed } from './scenery.ts';
import { bridge, cables, clutter, gate, lanternGroups, lanternString, slotPipes, transformerBox, vendingMachines } from './street.ts';
import { collectStrips, groundMaterials, layGround } from './wet.ts';

const neon = { break: 'neon.break', impact: 'glass.debris', debris: 'glass.debris' };

const world: WorldDefinition = {
  ...meta,
  sky: { hdri: 'packs/neon/hdri/kloppenheim_07_puresky_1k.hdr', azimuth: 0.35, background: 0.13, environment: 0.3, sun: { color: 0x8ea4ff, intensity: 0.35 } },
  look: {
    fog: { color: 0x121a30, near: 20, far: 150 },
    exposure: 1.0,
    bloom: { strength: 0.85, radius: 0.55, threshold: 0.55 },
    hemisphere: { sky: 0x2a3a70, ground: 0x2a1834, intensity: 0.35 },
    ao: 0.5,
    grade: { saturation: 1.15, contrast: 1.08, tint: 0xeef0ff, vignette: 0.3 },
    weather: { rain: 0.9, rainColor: 0x9fb4d8, wind: [0.6, 0.2] },
    // Concrete and tile dust, cool grey under the night light (warm tans read as brown smoke); the
    // rain brings the cloud down a little sooner
    smoke: { color: 0x8c949e, life: 0.75 },
    dustPalette: { colors: [0x9aa4ae, 0x8a929c, 0xb2b8be], blend: 0.6 },
  },
  materials: () => ({ ...neonMaterials(), ...groundMaterials(), block: blockMaterial(), shopfront: shopfrontPiece() }),
  ground: 0,
  scenery(scene, world, sky) {
    neonScenery(scene, world);
    pointLights(scene);
    // The moon's shadows don't show in a narrow alley at night: spare their pass
    sky.sun.castShadow = false;
  },
  // On the alley's breakable ground (and where a blast has laid the street round it breakable), its
  // bed: the slabs over it are found as pieces
  groundAt: (x, z) => (onGround(x, z) ? GROUND.bed : (streetBed(x, z) ?? 0)),
  props: ['packs/neon/models/'],
  build(d, models) {
    layGround(d);
    // Round the alley: scenery until something reaches it
    dormantScenery(d);
    glow.watch(d);
    peelFacades(d);
    LOTS.forEach((lot, i) => (lot.type === 'A' ? towerA(d, lot, 101 + i * 17) : shophouse(d, lot, 101 + i * 17)));
    const { arcade, billboard } = endBlock(d, 7);
    gate(d);
    bridge(d);
    vendingMachines(d, shops);
    transformerBox(d);
    slotPipes(d);
    const rand = random(31);
    for (const x of [-14.5, -2, 17.5]) lanternString(d, x, 6.4, rand);
    cables(d, 10, rand);
    placeProps(d, models);
    clutter(d, shops, rand);
    startLife(d, landmarks.bigBlade, arcade, billboard);
    collectStrips(shops, lanternGroups);
    return { feet: START.feet, look: START.look };
  },
  // Nothing belongs under the street: a cell pressed through it goes under a metre down, not 50.
  // Past about 1,500 more pieces than at load (7,976), rubble at rest shrinks away
  destruction: { killBelow: -1.2, maxPieces: 9500 },
  audio: {
    // Its own pack, and Brick Street's steps on metal (its pack has only those)
    packs: ['packs/neon/sounds/', 'packs/nyc/sounds/'],
    // The alley is a hard canyon: more reverb on the big sounds
    settings: { 'explosion.near': { reverb: 0.6 }, 'collapse.rumble': { reverb: 0.6 }, 'glass.shatter': { reverb: 0.35 }, 'steps.wet': { volume: 0.36 } },
    // The mix: every world's bed about -33 LUFS standing at the start, its steps as loud as Brick Street's (docs/changelog/phase-c/sound.md)
    ambience: [
      { sound: 'ambience.rain', volume: 0.2, high: 1.1 },
      { sound: 'ambience.city', volume: 0.4, high: 1.6 },
      { sound: 'ambience.wind', volume: 0.5, high: 4 },
    ],
    // A section coming down lands with one heavy blow (land), not its pieces' patter. A bullet
    // (bullet): stone snaps, glazed tile and render crack, sheet metal rings thinner than steel,
    // tubes and lamps pop higher than panes, paper thuds, plastic knocks
    materials: {
      concrete: { ...packMaterials.concrete, land: 'concrete.impact', bullet: 'bullet.concrete' },
      // The towers round the alley: render over concrete
      block: { ...packMaterials.concrete, land: 'concrete.impact', bullet: 'bullet.brick', pitch: { land: 0.85 } },
      shopfront: { break: 'glass.shatter', debris: 'glass.debris', bullet: 'bullet.glass' },
      // Glazed tile's chips clink: glass debris, lower
      tile: { ...packMaterials.concrete, break: 'tile.break', debris: 'glass.debris', land: 'concrete.impact', bullet: 'bullet.brick', pitch: { debris: 0.7, bullet: 1.2 } },
      render: { ...packMaterials.brick, land: 'brick.impact.large', bullet: 'bullet.brick' },
      glass: { ...packMaterials.glass, bullet: 'bullet.glass' },
      neon: { ...neon, bullet: 'bullet.glass', pitch: { bullet: 1.3 } },
      lightbox: { break: 'glass.shatter', impact: 'sheetmetal.impact', debris: 'glass.debris', bullet: 'bullet.glass', pitch: { bullet: 0.85 } },
      signbox: { break: 'metal.bend', impact: 'sheetmetal.impact', heavyImpact: 'metal.impact.large', strain: 'metal.bend', collapse: 'metal.impact.large', land: 'metal.impact.large', bullet: 'bullet.metal', pitch: { bullet: 1.25 } },
      steel: { ...packMaterials.metal, bullet: 'bullet.metal' },
      grate: { ...packMaterials.metal, bullet: 'bullet.metal', pitch: { bullet: 1.1 } },
      shutter: { break: 'shutter.rattle', impact: 'sheetmetal.impact', heavyImpact: 'shutter.rattle', strain: 'metal.bend', collapse: 'shutter.rattle', land: 'shutter.rattle', bullet: 'bullet.metal', pitch: { bullet: 1.2 } },
      lamp: { break: 'glass.shatter', debris: 'glass.debris', bullet: 'bullet.glass', pitch: { bullet: 1.15 } },
      // Its break is played by life.ts (quiet and high: paper on a wire frame)
      lantern: { bullet: 'bullet.dirt', pitch: { bullet: 1.4 } },
      // The awnings, and the plastic crates and bins (props)
      awning: { break: 'sheetmetal.impact', impact: 'sheetmetal.impact', bullet: 'bullet.wood', pitch: { bullet: 1.3 } },
      wood: { ...packMaterials.wood, bullet: 'bullet.wood' },
      // The street: asphalt cracks lower than concrete, the base under it as concrete, the wet earth
      // under that (a crater's floor) thuds
      asphalt: { ...packMaterials.concrete, bullet: 'bullet.concrete', pitch: 0.85 },
      base: { ...packMaterials.concrete, bullet: 'bullet.concrete' },
      earth: { impact: 'steps.rubble', debris: 'steps.rubble', bullet: 'bullet.dirt', pitch: { impact: 0.75, debris: 0.75, bullet: 0.85 } },
    },
    footsteps: { hard: 'steps.wet', rubble: 'steps.rubble', land: 'player.land', surface: footstep },
  },
  dust: { asphalt: 0x6e737a, base: 0xaab4c0, earth: 0x5e564c, concrete: 0xaab4c0, block: 0x8a909a, shopfront: 0xc8d0d8, tile: 0xaab4c0, render: 0xb8b8b4, glass: 0xc8dce8, neon: 0xd8f4ff, lightbox: 0xe8e8f0, signbox: 0x6a6a6a, steel: 0x5a5a5a, grate: 0x5a5a5a, shutter: 0x7a807a, lamp: 0xe8eef4, lantern: 0x8a2a1a, awning: 0x9aa0a8, wood: 0x7a6048 },
  // Thin sheet, tubes, glass and paper raise little dust; the wet street not much
  dustAmount: { shopfront: 0.3, asphalt: 0.5, base: 0.8, earth: 0.3, neon: 0.3, lightbox: 0.4, glass: 0.4, lamp: 0.4, lantern: 0.4, awning: 0.3, signbox: 0.3, shutter: 0.2, steel: 0.15, grate: 0.15, wood: 0.6 },
  chips: { asphalt: 0x5a5752, base: 0x9a968e, earth: 0x3e352c, concrete: 0x8a8780, block: 0x2a2e38, shopfront: 0x3a3a44, tile: 0xe8eef2, render: 0xd0c8b8, glass: 0xbcd8e6, neon: 0xeaffff, lightbox: 0xf2f2f8, signbox: 0x40444a, steel: 0x4a4e54, grate: 0x4a4e54, shutter: 0x8a908a, lamp: 0xf0f4f8, lantern: 0xc8281e, awning: 0x5a7a9a, wood: 0x6a4a30 },
  onBlast,
  onImpact,
  onShot,
  onBurst,
  update,
};

export default world;
