// Neon Alley's own sounds (PACK=neon): the rain and the city around, neon signs humming, popping,
// sparking and shot dark, lamps shot out, a transformer blowing, roller shutters, sheet metal,
// glazed tile, steam vents hissing and shot, debris splashing into puddles, wet footsteps and a shop
// alarm bell. Everything else (blasts, concrete, brick, glass, wood, metal.*, collapse, wind, the
// gun) is the base pack's.
//
// After generate-sounds, run prep-sounds.py (it makes neon.buzz, cuts the alarm bells to whole
// rings, evens out the rain and cuts a lamp's pop), then process-sounds. skip.json leaves out
// rain.awning:0.

import { NO, foley, fx, sound } from '../../sounds.mjs';

// Electrics come out as sci-fi blasters unless told not to
const ZAP = `${NO}, laser, sci-fi, blaster, gunshot`;

export const sounds = [
  // --- The rain and the city ---
  // Kept even and featureless: anything that stands out is heard again every loop
  {
    name: 'ambience.rain',
    kind: 'loop',
    space: 'head',
    count: 1,
    duration: 45,
    // A drainpipe in the prompt made the first take gush in suddenly halfway, so no pipes.
    // prep-sounds.py takes some of its low end off.
    negative: `${NO}, thunder, wind gusts, birds, cars, footsteps, gushing water, waterfall, stream`,
    prompt: 'Field recording of steady heavy rain at night in a narrow city back alley, close and enveloping: a dense, even patter on wet asphalt and puddles, heavy drips falling from ledges and signs. Constant, unchanging intensity from start to end, no swells. No thunder, no voices, no music.',
    play: { bus: 'ambience', volume: 0.45, voices: 1, reverb: 0 },
  },
  // Replaces the base pack's afternoon city by name. No rain in it: the rain is its own layer.
  {
    name: 'ambience.city',
    kind: 'loop',
    space: 'head',
    count: 1,
    duration: 45,
    negative: `${NO}, rain, birds, pigeons, sirens, close cars, footsteps`,
    prompt: 'Field recording of a huge city at night heard from deep inside a narrow back alley: a distant, low, steady roar of traffic on wide avenues a few blocks away, the deep hum of the city, an elevated train rumbling far off, a faint car horn very far away. Calm, even and distant from start to end. No voices, no music.',
    play: { bus: 'ambience', volume: 0.3, voices: 1, reverb: 0 },
  },
  // Placed at the nearest standing awnings, so walking under one is heard. Take 0 is skipped: its
  // water surges in a third of the way through, which a 9 s loop would repeat.
  {
    name: 'rain.awning',
    kind: 'loop',
    count: 2,
    duration: 12,
    negative: `${NO}, thunder, wind`,
    prompt: 'Field recording of heavy rain drumming on a taut plastic tarpaulin awning just overhead: dense, hollow pattering thuds on the stretched sheet, and a steady stream of water pouring off its edge onto the pavement below. Close-up, constant from start to end. No music.',
    play: { bus: 'ambience', near: 2.5, rolloff: 1.4, volume: 0.5, voices: 3, reverb: 0.2 },
  },

  // --- Neon ---
  // Placed at the nearest lit signs; the flickering sign's voice follows its flicker. Both takes
  // are synthesized by prep-sounds.py: in four takes asked three ways (this is the last), the model
  // gave a sub-bass rumble, near silence with a whine, and bare crackle (kept in neon.buzz/replaced/).
  {
    name: 'neon.buzz',
    kind: 'loop',
    count: 2,
    duration: 8,
    negative: `${NO}, rain, wind, drone music`,
    prompt: fx('An old neon sign buzzing loudly up close: a constant, gritty electric buzz with a slight crackle, like a faulty fluorescent tube light.'),
    // About as loud as the rain right under a sign, 5 dB under it 3 m off
    play: { bus: 'ambience', near: 2, rolloff: 1.4, volume: 0.3, voices: 4, pitch: [0.97, 1.03], reverb: 0.1 },
  },
  {
    name: 'neon.break',
    count: 5,
    duration: 2,
    negative: ZAP,
    // Takes 2 and 3 came out as a lone snap; their redos ask for the tail outright
    prompt: fx('A glowing neon glass tube smashing: a hollow glassy pop as the tube bursts, then thin glass shards tinkling down for half a second, with a crackling electrical fizz as the live wires short out.'),
    play: { near: 4, volume: 0.75, voices: 5, priority: 2, cooldown: 0.05, spacing: 1.5, pitch: [0.9, 1.12] },
  },
  // A sign shot until it goes dark (life.ts): its buzz stutters, a pop, the hum gone
  {
    name: 'neon.die',
    count: 2,
    duration: 2,
    negative: ZAP,
    prompt: fx('A neon sign shorting out and dying: its electric buzz stutters and crackles angrily for half a second, then a sharp electrical pop as the tube fails, and the hum cuts out to silence.'),
    play: { near: 4, volume: 0.7, voices: 2, cooldown: 0.25, pitch: [0.92, 1.08], reverb: 0.3 },
  },
  // A lamp or a lit panel shot dark (life.ts)
  {
    name: 'lamp.pop',
    count: 2,
    duration: 1.5,
    negative: ZAP,
    prompt: fx('A fluorescent light fitting struck and failing: a short sharp glassy pop as the tube bursts, a tiny electric tick, and a faint tinkle of glass, then silence.'),
    play: { near: 3, volume: 0.6, voices: 3, cooldown: 0.1, pitch: [0.9, 1.15], reverb: 0.25 },
  },
  {
    name: 'spark.zap',
    count: 4,
    duration: 1.5,
    negative: ZAP,
    prompt: fx('Electrical sparks from a broken live cable: a short burst of sharp crackling arcs, snapping pops and a sizzling hiss, then it cuts out.'),
    play: { near: 4, volume: 0.65, voices: 4, cooldown: 0.08, pitch: [0.9, 1.15], reverb: 0.3 },
  },

  // The blackout: once, when the transformer box goes
  {
    name: 'transformer.blow',
    count: 1,
    duration: 4,
    fade: 0.6,
    negative: ZAP,
    prompt: fx('An electrical transformer box on a wall blowing out: a loud sharp bang of a short circuit, a fierce crackling electric arc for a second, then the hum of the electrics winding down to silence. Outdoors in a street.'),
    play: { near: 8, rolloff: 0.8, volume: 0.9, voices: 1, priority: 3, reverb: 0.5 },
  },

  // --- Shutters, sheet metal, tile ---
  {
    name: 'shutter.rattle',
    count: 4,
    duration: 2.5,
    prompt: fx('A corrugated steel roller shutter on a shop front struck hard by a blast wave: a loud rattling metallic crash, then the thin steel slats clattering and shaking in their side rails and settling. Outdoors in a street.'),
    play: { near: 5, volume: 0.7, voices: 4, cooldown: 0.15, spacing: 3, pitch: [0.92, 1.08], reverb: 0.35 },
  },
  {
    name: 'sheetmetal.impact',
    count: 4,
    duration: 1.5,
    prompt: foley('A thin hollow sheet-metal box falling onto wet pavement: one hollow tinny bang with a short buzzy rattle of the panel.'),
    play: { bus: 'debris', near: 3, volume: 0.45, voices: 4, pitch: [0.85, 1.2] },
  },
  {
    name: 'tile.break',
    count: 4,
    duration: 2.5,
    prompt: fx('Glazed ceramic wall tiles cracking and showering off a concrete wall: a sharp crack, brittle ceramic shattering into shards, and small chips skittering across the pavement.'),
    play: { near: 4, volume: 0.75, voices: 5, cooldown: 0.06, spacing: 2 },
  },

  // --- Water ---
  // Placed at the three steam vents; turned up while one gushes after a blast
  {
    name: 'steam.hiss',
    kind: 'loop',
    count: 1,
    duration: 10,
    negative: `${NO}, rain, wind gusts, whistle, kettle, train`,
    prompt: 'Field recording of steam escaping steadily from a street vent grate at night: a soft, constant hiss of steam with a faint low rumble from below and a few water drips, close-up. Constant from start to end. No music.',
    play: { bus: 'ambience', near: 2, rolloff: 1.4, volume: 0.4, voices: 3, reverb: 0.15 },
  },
  // A steam pipe or vent shot (life.ts): it bursts out, then the vent's hiss carries on louder
  {
    name: 'steam.burst',
    count: 2,
    duration: 3,
    negative: `${NO}, rain, wind gusts, whistle, kettle, train, explosion`,
    prompt: 'Field recording of a pressurised steam pipe punctured in a street at night: a sudden loud roaring hiss of escaping steam bursting out at full force, then blowing hard and steady, close-up. No music.',
    play: { near: 3, volume: 0.6, voices: 2, cooldown: 0.5, pitch: [0.92, 1.08], reverb: 0.3 },
  },
  {
    name: 'splash.debris',
    count: 3,
    duration: 2,
    negative: `${NO}, rain`,
    prompt: foley('A heavy chunk of broken concrete dropped into a shallow puddle on a wet street: a heavy wet splash with a gritty thud, and the water spattering back down.'),
    play: { bus: 'debris', near: 4, volume: 0.5, voices: 3, cooldown: 0.1, spacing: 2, pitch: [0.85, 1.15] },
  },

  // --- The player ---
  {
    name: 'steps.wet',
    kind: 'slice',
    space: 'head',
    count: 1,
    duration: 8,
    negative: `${NO}, rain`,
    prompt: foley('Footsteps of a person in boots walking on a wet asphalt street with shallow puddles at a steady pace: each step a firm heel tap with a small watery splash, clear separate steps with short gaps of silence.'),
    play: { volume: 0.32, voices: 2, pitch: [0.95, 1.05], reverb: 0.15 },
  },

  // --- Reactions ---
  // The takes ring for 5 to 7 s, then die away: prep-sounds.py cuts each to whole rings
  {
    name: 'alarm.bell',
    kind: 'loop',
    count: 2,
    duration: 10,
    negative: 'music, melody, singing, speech, voices, siren, church bell, chimes, car alarm',
    prompt: fx('An electric burglar alarm bell on a shop wall ringing continuously: a loud, fast, harsh metallic trill of a hammer striking a steel gong, constant and unbroken from start to end, outdoors in a street.'),
    play: { near: 6, volume: 0.55, voices: 1, reverb: 0.45 },
  },
].map(sound);
