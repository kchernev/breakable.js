// Harbor Yard's own sounds (PACK=harbor): the port around (sea, gulls, the ship), steel boxes
// booming, clanging, groaning and toppling, sheet metal tearing, chains, drums, and footsteps on
// wet concrete and on scrap. Everything else (blasts, concrete, wood, glass, metal.*) is the base
// pack's.

import { NO, foley, fx, sound } from '../../sounds.mjs';

export const sounds = [
  // --- The port around ---
  // Kept even and featureless: anything that stands out (a close gull) is heard again every loop.
  // Quieter than the city's (0.35): it is more even, so it sits higher at the same level
  {
    name: 'ambience.harbor',
    kind: 'loop',
    space: 'head',
    count: 1,
    duration: 45,
    negative: `${NO}, car horns, sirens, reversing beepers, close bird calls`,
    prompt: 'Field recording on a quiet container port quay on a calm, grey, foggy morning: small waves lapping softly against a concrete quay wall, a low steady rumble of far-off port machinery and a distant ship engine idling, a faint breeze, seagulls only very far away and faint. Steady and even from start to end. No voices, no music.',
    play: { bus: 'ambience', volume: 0.3, voices: 1, reverb: 0 },
  },
  // Placed along the quay edge, so the sea gets louder as you walk up to it
  {
    name: 'water.lap',
    kind: 'loop',
    count: 1,
    duration: 22,
    prompt: 'Small waves lapping and sloshing against a concrete harbour wall and its rubber fenders, close: gentle irregular slaps, gurgles and wet splashes, steady, nothing else. Field recording, no music.',
    play: { bus: 'ambience', near: 5, rolloff: 1, volume: 0.55, voices: 4, reverb: 0.1 },
  },
  {
    name: 'gulls.call',
    count: 3,
    duration: 4,
    prompt: fx('A single herring gull calling while flying overhead by the sea: two or three loud laughing cries, clear, outdoors, no other birds.'),
    play: { bus: 'ambience', near: 15, rolloff: 0.6, volume: 0.5, voices: 2, reverb: 0.35, pitch: [0.92, 1.08] },
  },
  // Played just after a blast, so on the sfx bus: the ambience bus is ducked then
  {
    name: 'gulls.scatter',
    space: 'head',
    count: 2,
    duration: 5,
    fade: 1.5,
    negative: `${NO}, explosion, gunshot, bang`,
    prompt: fx('A flock of seagulls suddenly taking flight together in alarm: a burst of many wings flapping, loud screeching alarm cries, the flock moving away overhead and fading, outdoors by the sea.'),
    play: { volume: 0.55, voices: 1, cooldown: 25, reverb: 0.2 },
  },
  // From the ship 330 m out: about 8 dB under a blast nearby. Two voices for the double blast
  {
    name: 'ship.horn',
    count: 2,
    duration: 9,
    fade: 1,
    negative: `${NO}, train, car horn, trumpet`,
    prompt: fx('A large container ship sounding its horn far out across a foggy harbour: one long, very deep, steady low foghorn blast of about four seconds, then its echo rolling back over the water and fading away.'),
    play: { near: 200, rolloff: 0.3, volume: 0.45, voices: 2, priority: 2, reverb: 0.6, pitch: [0.97, 1.03] },
  },
  {
    name: 'water.splash',
    count: 3,
    duration: 4,
    fade: 0.4,
    prompt: fx('A heavy steel object falling off a quay into deep harbour water: a deep booming plunge and a big splash, then the spray raining back down and the water sloshing, close.'),
    play: { near: 8, rolloff: 0.8, volume: 0.9, voices: 4, priority: 2, reverb: 0.3, pitch: [0.9, 1.1] },
  },

  // --- Containers, sheds, tanks ---
  {
    name: 'container.boom',
    count: 4,
    duration: 3.5,
    fade: 0.5,
    prompt: fx('An empty steel shipping container dropped flat onto concrete: one huge, deep, hollow metallic boom, the big empty steel box resonating like a giant steel drum and ringing low as it dies away, outdoors.'),
    play: { near: 8, rolloff: 0.8, volume: 0.85, voices: 3, priority: 3, reverb: 0.45, pitch: [0.9, 1.08] },
  },
  {
    name: 'container.clang',
    count: 4,
    duration: 2,
    prompt: foley('A loose sheet of corrugated steel striking a concrete floor: a sharp, hollow sheet-metal clang with a short wobbly ring and rattle that fades fast.'),
    play: { bus: 'debris', near: 4, volume: 0.5, voices: 4, pitch: [0.85, 1.15] },
  },
  // A strain sound (bonds giving way): asking for a lock "popping" gave bangs, so no hits at all
  {
    name: 'container.groan',
    count: 3,
    duration: 4,
    fade: 0.4,
    negative: `${NO}, impact, bang, hit, clang, slam, door, explosion`,
    prompt: fx('Huge steel structure under strain, starting at once: a slow, deep, drawn-out metallic groan of stressed steel bending, low moaning creaks, like a ship hull or a stack of steel containers twisting. Continuous, no impacts.'),
    play: { bus: 'debris', near: 8, volume: 0.65, voices: 2, cooldown: 1.2, spacing: 10, reverb: 0.4 },
  },
  {
    name: 'container.collapse',
    count: 3,
    duration: 7,
    fade: 1,
    prompt: fx('A stack of steel shipping containers toppling over: huge hollow metallic booms as the heavy boxes slam onto concrete one after another, crunching and scraping steel, a last booming bounce, then rattling as it settles, outdoors.'),
    play: { near: 12, rolloff: 0.7, volume: 1, voices: 2, priority: 3, cooldown: 1.2, spacing: 12, reverb: 0.45 },
  },
  {
    name: 'sheet.tear',
    count: 3,
    duration: 2.5,
    fade: 0.6,
    // The takes build up to the rip: start at it
    onset: true,
    prompt: fx('A corrugated steel wall panel ripped open by a blast: a harsh tearing screech of sheet metal, a crumpling crunch, then the torn sheet flapping and rattling.'),
    play: { near: 5, volume: 0.7, voices: 3, cooldown: 0.1, spacing: 3, pitch: [0.9, 1.1] },
  },
  {
    name: 'chain.rattle',
    count: 2,
    duration: 3,
    prompt: foley('Heavy steel chains and steel wire rope swinging and dropping onto a steel deck: loud jangling, rattling and clanking links, then settling.'),
    play: { near: 5, volume: 0.6, voices: 2, cooldown: 0.5, spacing: 4, pitch: [0.9, 1.1] },
  },
  {
    name: 'drum.bonk',
    count: 3,
    duration: 2,
    prompt: foley('An empty steel oil drum knocked over onto concrete: one hollow, resonant metal bong, then a short rolling rumble as it rolls a little and stops.'),
    play: { bus: 'debris', near: 4, volume: 0.55, voices: 3, pitch: [0.9, 1.1] },
  },
  // A tank holed by the gun: fuel running out of the hole and down its side (a loop at the hole,
  // one a tank; index.ts keeps three going at most)
  {
    name: 'fuel.leak',
    kind: 'loop',
    count: 2,
    duration: 10,
    negative: `${NO}, impact, bang, hit, clang, drip, rain, tap water, bubbling pot`,
    prompt: foley('A steady stream of oil gushing out of a hole in the side of a big steel fuel tank: thick liquid glugging and gurgling out of the hole, running down the steel and splattering into a spreading puddle on concrete. Continuous and even, no impacts.'),
    play: { near: 3, rolloff: 1, volume: 0.5, voices: 3, reverb: 0.15, pitch: [0.95, 1.05] },
  },
  // A drum holed by the gun: a thin trickle
  {
    name: 'drum.leak',
    kind: 'loop',
    count: 1,
    duration: 8,
    negative: `${NO}, impact, bang, hit, clang, rain, tap water, bubbling pot`,
    prompt: foley('A thin stream of oil trickling out of a small hole in a steel drum and pattering into a puddle on concrete: a soft steady trickle and patter, close. Continuous and even, no impacts.'),
    play: { near: 2, rolloff: 1, volume: 0.4, voices: 3, reverb: 0.1, pitch: [0.95, 1.05] },
  },
  // The fuel catching: the whoomph before the fire's own roar (fire.loop). The first two takes,
  // asked for the whoomph and the fire after it, came as a steady roar from the start (skip.json)
  {
    name: 'fuel.ignite',
    count: 3,
    duration: 4,
    fade: 0.8,
    onset: true,
    negative: `${NO}, steady, continuous, constant, explosion, bang, gunshot, crack, debris`,
    prompt: fx('A puddle of petrol set alight: silence, then one sudden deep whoosh-whump as all the vapour ignites at once and flames burst up, the rush dying down quickly to a soft crackle.'),
    play: { near: 10, rolloff: 0.8, volume: 0.9, voices: 2, priority: 2, reverb: 0.35, pitch: [0.92, 1.05] },
  },

  // --- The player ---
  {
    name: 'steps.wet',
    kind: 'slice',
    space: 'head',
    count: 1,
    duration: 8,
    prompt: foley('Footsteps of a person in work boots walking on damp concrete at a steady pace, clear separate steps with short gaps, a slightly wet gritty scuff on each step, no puddles.'),
    play: { volume: 0.3, voices: 2, pitch: [0.95, 1.05], reverb: 0.15 },
  },
  {
    name: 'steps.metal',
    kind: 'slice',
    space: 'head',
    count: 1,
    duration: 8,
    prompt: foley('Footsteps of a person in boots walking over scattered bent steel sheets and metal scrap at a steady pace, clear separate steps with short gaps, each a hollow metallic clank with a crunch.'),
    play: { volume: 0.32, voices: 2, pitch: [0.95, 1.05], reverb: 0.15 },
  },
].map(sound);
