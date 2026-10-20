// Dust Town's sounds (PACK=western): only what the base pack lacks or what should sound different
// in a dry timber-and-tin town. The base pack still gives explosions, glass, metal, brick, concrete,
// wood.impact, collapse, dust and the wind up high (src/demo/worlds/western/DESIGN.md, section 6).
//
// The prompts never say "western", "saloon" or "cowboy": those pull the model toward film music.
//
// Order: generate-sounds, then mix-sounds.mjs (here: the takes made from other takes, `mix`), then
// qa-sounds, then process-sounds. Takes left out of the pack are in
// assets-src/packs/western/sounds/skip.json; why, in the notes on each sound below.

import { NO, foley, fx, sound } from '../../sounds.mjs';

export const sounds = [
  // --- Around the town ---
  // Take 0 has a traffic-like rumble. Take 1 is right but bass-heavy: under the game's other sounds it
  // read as a hum, so take 2 is take 1 with the rumble cut and the sand hiss lifted. Only 2 is used.
  {
    name: 'ambience.desert', kind: 'loop', space: 'head', count: 3, duration: 45,
    negative: `${NO}, birds, birdsong, traffic, cars, engines, people`,
    prompt: 'Field recording of open desert at hot midday: a dry, steady breeze breathing over sand and scrub, a soft hiss of blowing sand and grit, dry grass rustling, a faint high drone of cicadas far away. Wide, empty and still. No birds, no traffic, no voices, no music.',
    mix: { 2: [{ from: 'ambience.desert:1', at: 0, gain: 1, rate: 1, filter: 'highpass=f=90:poles=2,highshelf=f=2200:g=7' }] },
    play: { bus: 'ambience', volume: 0.45, voices: 1, reverb: 0 },
  },
  {
    name: 'sign.creak', count: 3, duration: 3,
    prompt: fx('A weathered wooden signboard hanging from two rusty iron hooks, swinging slowly in a gust of wind: dry squeaking creaks of rusted iron rubbing on iron, back and forth, and one soft hollow knock of wood. Outdoors.'),
    play: { bus: 'ambience', near: 3, volume: 0.7, voices: 2, cooldown: 2.5, spacing: 6, reverb: 0.2 },
  },
  {
    name: 'windmill.loop', kind: 'loop', count: 2, duration: 12,
    prompt: fx('An old steel farm windmill turning steadily in the wind, heard from the foot of its tower: the slow clank of the iron pump rod at each stroke, a dry squeak of the ungreased gearbox, a light rattle of the sheet-metal tail vane. Steady and unchanging from start to end, outdoors.'),
    play: { bus: 'ambience', near: 8, volume: 0.8, voices: 1, reverb: 0.25 },
  },
  // Takes 0-2 carry a wind rumble under the cry (up to a third of their energy below 80 Hz); 3-5 are
  // the same takes with it cut. Only 3-5 are used. Play it 50-70 m away: from further off the
  // engine's air absorption takes the rasp and it reads as a whistle.
  {
    name: 'hawk.cry', count: 6, duration: 4,
    negative: `${NO}, songbirds, chirping, many birds`,
    prompt: fx('A single red-tailed hawk crying once high over open desert: one long, harsh, raspy descending screech, heard from far away with a faint echo off distant cliffs, then silence.'),
    mix: Object.fromEntries([0, 1, 2].map((i) => [i + 3, [{ from: `hawk.cry:${i}`, at: 0, gain: 1, rate: 1, filter: 'highpass=f=350:poles=2,highpass=f=350:poles=2' }]])),
    play: { bus: 'ambience', near: 30, rolloff: 0.4, volume: 0.5, voices: 1, cooldown: 20, reverb: 0.6 },
  },
  // The takes ring at about 1 kHz, a hand bell; played at 0.7 the chapel's 0.6 m bell is lower and
  // rings longer.
  {
    name: 'bell.toll', count: 3, duration: 7, fade: 1,
    negative: `${NO}, chimes, several bells, carillon, organ`,
    prompt: fx('A small bronze bell in a chapel bell gable struck once by its clapper, outdoors: one clear, bright metallic clang, then a long ringing hum slowly fading away. A single strike only.'),
    play: { near: 10, rolloff: 0.6, volume: 0.8, voices: 3, priority: 3, reverb: 0.5, pitch: [0.68, 0.73] },
  },
  // A round into the chapel's bell (life.ts, onShot): played at the toll's pitch, so it's the same bell
  {
    name: 'bell.shot', count: 2, duration: 5, fade: 1,
    negative: `${NO}, chimes, several bells, carillon, organ, gunshot, explosion`,
    prompt: fx('A bullet striking a small bronze bell hanging in a chapel bell gable, outdoors: one sharp, bright metallic ping and clang of the struck bell, then its clear ringing hum slowly fading away. A single strike only.'),
    play: { near: 10, rolloff: 0.6, volume: 0.9, voices: 2, cooldown: 0.25, spacing: 2, priority: 3, reverb: 0.5, pitch: [0.68, 0.73] },
  },
  // Take 0 is a wrapper being crumpled; only take 1 is used
  {
    name: 'birds.flush', count: 2, duration: 3,
    negative: `${NO}, cooing, chirping, birdsong`,
    prompt: fx('A small flock of doves suddenly taking off from a tin roof all at once: a burst of loud fluttering wing flaps and wing claps, flying away and fading out quickly.'),
    play: { near: 6, volume: 0.6, voices: 2, cooldown: 10, reverb: 0.3, pitch: [0.9, 1.12] },
  },

  // --- The water tower's tank, shot (water.ts): a hole bursting open, and the streams coming down ---
  {
    name: 'water.spurt', count: 2, duration: 2.5,
    negative: `${NO}, rain, tap, sink, toilet, flushing, bubbles, underwater`,
    prompt: fx('A bullet punching through the side of a big wooden water tank outdoors: a sharp wooden crack, then water suddenly bursting out of the hole under pressure in a hissing, splashing gush that quickly settles into a strong steady spurt.'),
    play: { near: 4, volume: 0.6, voices: 2, cooldown: 0.15, spacing: 1, reverb: 0.25 },
  },
  // Take 0 carries a rumble under the patter (a tenth of its energy under 100 Hz); take 2 is take 0
  // with it cut. Takes 1 and 2 are used.
  {
    name: 'water.stream', kind: 'loop', count: 3, duration: 10,
    negative: `${NO}, rain, river, waterfall, tap, sink, bathtub, toilet, bubbles, underwater`,
    prompt: fx('A thin, steady jet of water falling from a height of several metres and splashing onto dry, packed dirt outdoors: a continuous soft pattering and spattering where it lands, the water hissing a little. Steady and unchanging from start to end.'),
    mix: { 2: [{ from: 'water.stream:0', at: 0, gain: 1, rate: 1, filter: 'highpass=f=140:poles=2,highpass=f=140:poles=2' }] },
    play: { bus: 'ambience', near: 4, volume: 0.7, voices: 1, reverb: 0.2 },
  },

  // --- Wood: dry pine boards, posts and beams ---
  {
    name: 'wood.splinter', count: 4, duration: 2,
    prompt: fx('Dry, sun-baked old pine boards and a wooden post snapping apart: a sharp, dry crack, splintering and tearing wood fibres, rusty nails tearing out of the wood.'),
    play: { near: 4, volume: 0.75, voices: 5, cooldown: 0.05, spacing: 2, pitch: [0.9, 1.1] },
  },
  {
    name: 'timber.crash', count: 3, duration: 3,
    prompt: fx('Heavy wooden beams and a pile of planks crashing down onto dry packed dirt: a deep, heavy wooden thud, then boards clattering, bouncing and settling with a little grit.'),
    play: { bus: 'debris', near: 6, volume: 0.75, voices: 3, priority: 2, reverb: 0.35 },
  },
  // "Creaks" and "nails squealing" gave a door and its latch (the first takes 0 and 1), so take 0 was
  // redone asking for beams groaning. Take 1 is left out; take 2 (first prompt: a click, then a creak)
  // stays.
  {
    name: 'timber.creak', count: 3, duration: 4,
    negative: `${NO}, door, hinge, latch, click, squeaky door`,
    prompt: fx('A large old timber-framed barn straining under a heavy load just before it collapses: deep, slow, low-pitched groaning of thick wooden beams bending, long stressed creaking of wood fibres, a few dry cracks of boards splitting. Big, heavy and ominous, outdoors.'),
    play: { bus: 'debris', near: 6, volume: 0.6, voices: 2, cooldown: 1.5, spacing: 10 },
  },

  // --- Tin roofs ---
  // The model hears "tin" as foil: the first takes were all paper and foil crumpling. Ask for steel.
  {
    name: 'tin.impact', count: 4, duration: 2,
    negative: `${NO}, paper, foil, plastic, crinkling, crumpling, rustling, wrapper`,
    prompt: foley('A large thin sheet of galvanized steel roofing falling flat onto hard ground: a loud metallic clang and bang, then the wobbling warble and ringing of the flexing sheet metal dying away. Clearly metallic, steel.'),
    play: { bus: 'debris', near: 4, volume: 0.5, voices: 4, pitch: [0.85, 1.15] },
  },
  // Takes 1 and 2 are foil; take 0 (the steel prompt) is a heavy crash with debris but not clearly
  // metal. Takes 3 and 4 are mixed (mix-sounds.mjs): take 0's body with the steel strikes of
  // tin.impact laid on its hits, so each hit rings like sheet metal. Only 3 and 4 are used.
  {
    name: 'tin.crash', count: 5, duration: 3,
    negative: `${NO}, paper, foil, plastic, crinkling, crumpling, rustling, wrapper`,
    prompt: fx('Several large sheets of galvanized steel roofing torn off a building and crashing down onto the ground: loud metallic bangs and clangs one after another, the deep wobbling thunder of big flexing steel sheets, sheet metal ringing as it bounces and settles. Heavy and clearly metallic, outdoors.'),
    mix: {
      3: [
        { from: 'tin.crash:0', at: 0, gain: 0.55, rate: 1 },
        { from: 'tin.impact:0', at: 0, gain: 1, rate: 0.9 },
        { from: 'tin.impact:1', at: 0.53, gain: 0.75, rate: 1.06 },
        { from: 'tin.impact:0', at: 1.25, gain: 0.5, rate: 1.18 },
      ],
      4: [
        { from: 'tin.crash:0', at: 0, gain: 0.5, rate: 0.95 },
        { from: 'tin.impact:0', at: 0, gain: 1, rate: 0.97 },
        { from: 'tin.impact:1', at: 0.56, gain: 0.7, rate: 1 },
        { from: 'tin.impact:0', at: 0.99, gain: 0.5, rate: 1.12 },
        { from: 'tin.impact:1', at: 1.55, gain: 0.4, rate: 1.2 },
      ],
    },
    play: { near: 6, volume: 0.8, voices: 3, priority: 2, reverb: 0.35, pitch: [0.9, 1.08] },
  },

  // --- Adobe ---
  {
    name: 'adobe.break', count: 3, duration: 2.5,
    prompt: fx('A thick wall of sun-dried adobe mud bricks breaking apart: a dull, heavy, crumbling crunch, dry earth clods breaking and pouring down, sandy and dusty. Soft and earthy, no ringing.'),
    play: { near: 5, volume: 0.6, voices: 4, cooldown: 0.06, spacing: 2 },
  },

  // --- The player ---
  {
    name: 'steps.dirt', kind: 'slice', space: 'head', count: 1, duration: 8,
    prompt: foley('Footsteps of a person in leather boots walking on dry packed dirt with loose grit and sand, at a steady pace, clear separate steps with short gaps of silence between them.'),
    play: { volume: 0.32, voices: 2, pitch: [0.95, 1.05], reverb: 0.15 },
  },
  // On the boardwalks and floors (index.ts, footsteps.surface): the dirt take with its grit cut, a
  // board's thump and knock raised, and the short echoes of the hollow under the boards. Mixed, not
  // generated (no paid call); the prompt is what a generated take should be.
  {
    name: 'steps.boards', kind: 'slice', space: 'head', count: 1, duration: 8,
    prompt: foley('Footsteps of a person in leather boots walking on an old hollow wooden boardwalk raised over the ground, at a steady pace: a dull wooden thump and knock at each step, the boards a little loose, clear separate steps with short gaps of silence between them.'),
    mix: { 0: [{ from: 'steps.dirt:0', at: 0, gain: 1, rate: 0.94, filter: 'highpass=f=60,lowpass=f=2400,equalizer=f=170:t=q:w=1.2:g=8,equalizer=f=480:t=q:w=2:g=5,aecho=0.8:0.6:6|11|17:0.35|0.25|0.15' }] },
    play: { volume: 0.32, voices: 2, pitch: [0.95, 1.05], reverb: 0.15 },
  },
].map(sound);
