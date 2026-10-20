// Sun Temple's sounds (PACK=temple): a hilltop sanctuary above the sea at midday. Cicadas and a warm
// coastal breeze; marble cracking, column drums slamming and grinding, colonnades toppling;
// terracotta roof tiles shattering; bronze ringing; trees snapping; birds bursting off the roofs;
// boots on dry gravel. The base pack still gives explosions, concrete, brick chips, wood, metal,
// collapse.rumble, dust.settle and the wind up high (src/demo/worlds/temple/DESIGN.md, section 6).
//
// The prompts never say "Greek" or "ancient temple" for ambience: those pull the model toward film
// music. The two loops are kept apart: the coast has no insects in it, so when the world silences
// the cicadas after a blast, the place really goes quiet.

import { NO, foley, fx, sound } from '../../sounds.mjs';

// Fired clay must not come out as glass or crockery ringing
const NO_GLASS = `${NO}, glass, glass shattering, tinkling, ringing, metal`;

export const sounds = [
  // --- The hilltop around ---
  // Played by the world itself (not audio.ambience), so it can fall silent after a blast. Take 1 is
  // left out (skip.json): levelled by its loudest moment it came out 3 LU louder than take 0, and a
  // one-voice bed shouldn't change level from one page load to the next
  {
    name: 'ambience.cicadas',
    kind: 'loop',
    space: 'head',
    count: 2,
    duration: 45,
    negative: `${NO}, birds, birdsong, crickets, frogs, traffic, cars, engines, people, airplane`,
    prompt: 'Field recording in a grove of olive and pine trees on a hot, dry hillside at summer midday: a dense chorus of many cicadas all around, a loud shrill rasping buzz pulsing and swelling in slow waves, a light warm breeze in dry leaves. Steady and even from start to end. No birds, no voices, no music.',
    play: { bus: 'ambience', volume: 0.32, voices: 1, reverb: 0 },
  },
  // No insects or birds: anything that stands out is heard again every loop. Take 1 is left out
  // (skip.json): a low engine hum
  {
    name: 'ambience.coast',
    kind: 'loop',
    space: 'head',
    count: 2,
    duration: 45,
    negative: `${NO}, cicadas, insects, seagulls, birds, traffic, boats, engines, people, rain, thunder`,
    prompt: 'Field recording on a rocky hilltop high above the sea on a warm, sunny day: a soft warm breeze blowing in gentle gusts through dry grass and low shrubs, and far below the slow, distant wash of waves breaking on rocky cliffs. Very open and airy, steady and even from start to end. No voices, no music.',
    play: { bus: 'ambience', volume: 0.3, voices: 1, reverb: 0 },
  },
  // Rubble falling off the cliff into the sea 62 m below (the world plays it where the piece
  // passes y -60): recorded close, the engine's distance and air make it far
  {
    name: 'sea.splash',
    count: 2,
    duration: 5,
    fade: 0.6,
    negative: `${NO}, seagulls, birds, boat, engine, rain`,
    prompt: fx('A heavy stone block falling from a great height and plunging into deep sea water: a deep booming plunge and a big heavy splash, spray raining back onto the water, then waves sloshing against rocks. Outdoors by the sea.'),
    play: { near: 40, rolloff: 0.5, volume: 0.7, voices: 3, cooldown: 0.5, spacing: 8, reverb: 0.5, pitch: [0.85, 1.1] },
  },
  // On a blast near a roof (sfx bus: the ambience bus is ducked just then)
  {
    name: 'birds.scatter',
    count: 2,
    duration: 4,
    fade: 0.6,
    negative: `${NO}, explosion, gunshot, bang, seagulls`,
    prompt: fx('A flock of jackdaws and pigeons suddenly bursting into flight from the roof of a stone building: a loud flurry of many flapping wings and sharp alarmed jackdaw calls, the flock flying off and fading into the distance. Outdoors.'),
    play: { near: 10, volume: 0.6, voices: 1, cooldown: 25, spacing: 100, reverb: 0.3 },
  },

  // --- Marble and limestone ---
  {
    name: 'marble.break',
    count: 4,
    duration: 2.5,
    // Asked for weight: "sharp, bright crack" alone gave a thin click
    prompt: fx('A big block of solid marble splitting apart under a heavy blow: a loud, hard, full-bodied crack of thick stone breaking with a deep thump in it, heavy stone chunks breaking off and thudding down, then a short crumble of grit and pebbles. Outdoors.'),
    // A shade lower than recorded: a marble block is heavier than the takes sound
    play: { near: 5, volume: 0.85, voices: 5, cooldown: 0.06, spacing: 2, pitch: [0.88, 1.04] },
  },
  // The column drums: the sound of the place coming down
  {
    name: 'marble.impact.large',
    count: 4,
    duration: 3,
    prompt: fx('A heavy round marble column drum falling and slamming onto stone paving: one deep, weighty thud with a hard, bright clack of stone on stone, then a short heavy roll and grind of stone on stone. Outdoors.'),
    play: { bus: 'debris', near: 6, volume: 0.85, voices: 4, priority: 3, pitch: [0.85, 1.08] },
  },
  {
    name: 'stone.grind',
    count: 3,
    duration: 3,
    prompt: fx('Massive stone blocks shifting under a heavy load: a deep, low, slow scrape and grind of stone on stone, a dull creak and crack, grit and small chips trickling down. Slow and ominous, outdoors.'),
    play: { bus: 'debris', near: 6, volume: 0.55, voices: 2, cooldown: 1.5, spacing: 10 },
  },
  {
    name: 'collapse.marble',
    count: 3,
    duration: 7,
    fade: 1,
    prompt: fx('A stone colonnade toppling: heavy marble column drums and long stone beams crashing down onto stone paving one after another, deep booming thuds and sharp cracks, drums rolling and grinding, then a rumble and a trickle of rubble fading out. Outdoors.'),
    play: { near: 12, rolloff: 0.7, volume: 1, voices: 3, priority: 3, cooldown: 1.2, spacing: 10, reverb: 0.5 },
  },

  // --- Terracotta roof tiles ---
  {
    name: 'tile.shatter',
    count: 4,
    duration: 2,
    negative: NO_GLASS,
    prompt: fx('A stack of terracotta clay roof tiles smashing onto stone: a sharp, dry ceramic crack and crash like a clay flowerpot breaking, thick fired clay shards clattering and skittering. Brittle, dry and earthy.'),
    play: { near: 4, volume: 0.75, voices: 5, pitch: [0.9, 1.12] },
  },
  {
    name: 'tile.debris',
    count: 3,
    duration: 2,
    negative: NO_GLASS,
    prompt: foley('Broken pieces of terracotta clay roof tile sliding off and dropping onto stone paving: dry, clicky clay clinks and knocks and a short rattle of small shards.'),
    play: { bus: 'debris', near: 3, volume: 0.45, voices: 4, pitch: [0.9, 1.15] },
  },

  // --- Bronze ---
  {
    name: 'bronze.clang',
    count: 3,
    duration: 3.5,
    fade: 0.6,
    negative: `${NO}, chimes, several bells, church bell, gong roll, cymbal`,
    prompt: fx('A heavy bronze shield falling flat onto stone paving: one loud, deep, resonant metallic clang, then a long shimmering ring that wobbles and slowly dies away, a little bell-like. A single strike, outdoors.'),
    play: { bus: 'debris', near: 6, volume: 0.6, voices: 3, priority: 2 },
  },

  // A bullet striking the goddess (a tripod plays it higher): a ping and the deep ring of the hollow
  // bronze, not the clang of something falling. One ring at a time, kept going while she's hit
  // (index.ts)
  {
    name: 'bronze.ring',
    count: 3,
    duration: 4,
    fade: 0.8,
    negative: `${NO}, gunshot, gunfire, explosion, several bells, church bell, chimes, gong roll, cymbal, falling, clatter`,
    prompt: fx('A single small hard pellet striking a large hollow bronze statue: one sharp bright metallic ping, then a deep, warm, resonant hum that rings on like a big bronze bell struck softly, slowly wavering and fading away. One strike only, outdoors.'),
    play: { near: 8, volume: 0.3, voices: 2, priority: 2 },
  },

  // --- The bay ---
  // Its answer to a burst of the gun, once the trigger's let go (index.ts plays it 400 m out over the
  // sea, as the blast's echo): the burst rolling back off the far cliffs and islands. Both takes
  // begin with a loud crack, its first 150 ms: cut, so the rattle comes back alone
  {
    name: 'bay.echo',
    count: 2,
    duration: 5,
    start: 0.15,
    fade: 1,
    negative: `${NO}, close gunshots, loud crack, explosion, boom, thunder, rain, seagulls, birds, waves crashing`,
    prompt: fx('The far echo of a burst of rapid gunfire coming back across a wide sea bay from distant cliffs and islands: only the faint, soft, rolling rattle of the echoes, blurred and hollow with distance, slowly dying away into the open air. No close sounds.'),
    play: { near: 160, rolloff: 0.6, volume: 1, voices: 1, reverb: 0.4 },
  },

  // --- Trees ---
  {
    name: 'foliage.break',
    count: 3,
    duration: 2,
    prompt: fx('A tree branch snapping off and a leafy tree crown thrashing: a crisp, woody crack, then a rush of rustling leaves and twigs whipping and shaking. Outdoors.'),
    play: { near: 4, volume: 0.55, voices: 3, cooldown: 0.2 },
  },

  // --- The player ---
  {
    name: 'steps.gravel',
    kind: 'slice',
    space: 'head',
    count: 1,
    duration: 8,
    prompt: foley('Footsteps of a person in boots walking on dry, stony ground with loose gravel and dry grass at a steady pace, clear separate crunching steps with short gaps.'),
    play: { volume: 0.32, voices: 2, pitch: [0.95, 1.05], reverb: 0.1 },
  },
].map(sound);
