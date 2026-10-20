// Market Town's sounds (PACK=medieval): only what the base pack lacks or what should sound different
// in a stone-and-timber market town (src/demo/worlds/medieval/DESIGN.md, section 7). The base pack
// still gives the explosions, glass, iron, wood.impact, brick (for plaster), structure.creak,
// collapse.rumble, dust.settle, steps.rubble, player.land and the wind up high.
//
// The prompts never say "medieval", "tavern" or "church music": those pull the model toward period
// music. The birds' negative leaves out "singing" (it could mute the songbirds) and asks for no
// human singing instead. Takes left out of the pack are in assets-src/packs/medieval/sounds/skip.json.

import { NO, foley, fx, sound } from '../../sounds.mjs';

// A bell take is one bell struck once: no peal, no tune
const BELL_NO = `${NO}, chimes, wind chimes, several bells, carillon, peal, tune, organ, choir, gong, electronic tone`;

export const sounds = [
  // --- Around the square: started by the world itself (so it can duck them), not audio.ambience ---
  {
    name: 'ambience.birds', kind: 'loop', space: 'head', count: 1, duration: 40,
    negative: 'music, melody, instruments, human singing, speech, voices, talking, traffic, cars, engines, airplane, rooster, beeps, synthesizer',
    prompt: 'Field recording of a small country town square on a calm summer evening: many songbirds nearby and far off, blackbirds and sparrows chirping, swallows twittering as they swoop overhead, a light breeze in the trees. Peaceful and even from start to end. No voices, no traffic, no music.',
    play: { bus: 'ambience', volume: 0.32, voices: 1, reverb: 0 },
  },
  {
    // Round 1's "busy" market had the whole crowd go "ooh" once: in a loop that repeats every 36 s
    name: 'ambience.market', kind: 'loop', space: 'head', count: 1, duration: 40,
    negative: `${NO}, clear speech, words, shouting, cheering, applause, gasps, crowd reactions, laughter, announcer, instruments, street musicians, bells, engines, traffic, cars`,
    prompt: "Field recording of an open-air market heard from across a wide stone square: a steady, low, indistinct murmur of many people far away with no clear words, footsteps on cobblestones, the wooden wheels of a handcart rolling over cobbles, now and then a horse's hooves clopping slowly past, and far away the light tapping of a blacksmith's hammer on an anvil. Calm and even from start to end. No music, no modern sounds.",
    // Its file came out ~6 dB under the birds' (a hoof hit the peak limit): 0.4 keeps it ~4 dB under them
    play: { bus: 'ambience', volume: 0.4, voices: 1, reverb: 0 },
  },

  // --- The bell in the church tower ---
  {
    // Raw take 1 is a lower bell (a 111 Hz hum) and is skipped: the kept two share their partials,
    // so every toll is the same bell
    name: 'bell.toll', count: 3, duration: 8, fade: 1.5, negative: BELL_NO,
    prompt: fx('One single strike of a large old bronze church bell hanging in a stone bell tower, heard from the town square below: a deep, rich metallic bong with a clear low hum note and bright shimmering, beating overtones, then a long, slow ringing hum fading away. Outdoors, a soft echo off stone walls. Only one strike.'),
    play: { near: 25, rolloff: 0.5, volume: 1, voices: 3, priority: 4, cooldown: 0.8, reverb: 0.5, pitch: [0.98, 1.02] },
  },
  {
    // "Church bell" in the prompt gave a clean toll (QA round 1): this one asks for the crash
    name: 'bell.clang', count: 2, duration: 4, fade: 0.8,
    negative: `${BELL_NO}, church bell, bell toll, clean ringing tone, long sustain`,
    prompt: fx('A huge, heavy bronze bell dropped from a height onto cobblestones: a violent crash of heavy metal on stone with a deep thud, then a harsh, buzzing, out-of-tune clanking as the cracked bell rocks and rolls on the stones, its dull ring dying quickly. Outdoors.'),
    play: { near: 15, rolloff: 0.6, volume: 1, voices: 2, priority: 4, cooldown: 0.4, reverb: 0.45 },
  },
  {
    // A round on the bell (phase F), asked as a hammer on its lip: the strike and the bell's ring,
    // and no gunshot in the take (the demo plays the gun's own). At 0.25 it rings 3 dB over the
    // shot as heard from the square (20 m), 9 over the bullet's strike on it; at 0.5 it rang 10 dB
    // over the shot. Its cooldown keeps a burst on the bell to about two rings a second (each
    // round still strikes it: bullet.metal)
    name: 'bell.ping', count: 2, duration: 4, fade: 1.2,
    negative: `${BELL_NO}, gunshot, gunfire, explosion, several strikes, hammering, anvil`,
    prompt: fx('A single hard strike of a steel hammer on the lip of a large old bronze church bell hanging in a stone tower: an instant, sharp, bright metallic pang with a piercing ping, then the big bell humming and ringing on with shimmering overtones, fading away. Heard from the square below, outdoors, a soft echo off stone walls. Only one strike.'),
    play: { near: 20, rolloff: 0.6, volume: 0.25, voices: 2, priority: 3, cooldown: 0.45, reverb: 0.45, pitch: [0.97, 1.03] },
  },

  // --- Limestone and rubble (walls, tower, church) ---
  {
    // "Crackling, gritty crumbling" gave a campfire (QA round 1): this asks for weight, not grit
    name: 'stone.break', count: 3, duration: 2.5,
    negative: `${NO}, fire, crackling flames, frying, sizzling, rain`,
    prompt: fx('Large limestone masonry blocks breaking apart: a heavy, deep, rocky crack like a boulder splitting, then big stone chunks crunching and grinding against each other and tumbling down. Weighty, low and solid, outdoors.'),
    play: { near: 5, volume: 0.8, voices: 4, cooldown: 0.06, spacing: 3 },
  },
  {
    // The hit comes first: "falling from a height" gave a second of falling before it (round 1)
    name: 'stone.impact.large', count: 3, duration: 3,
    negative: `${NO}, water, liquid, pouring, splashing`,
    prompt: fx('A heavy cut stone block slamming down onto a cobblestone square: it starts at once with a deep, heavy, weighty thud and a stony crunch as a corner breaks off, then a short rattle of stone chips. Bassy and heavy, dry, outdoors.'),
    play: { bus: 'debris', near: 6, volume: 0.8, voices: 4, priority: 2 },
  },

  // --- Oak frames ---
  {
    // The crack comes first: "snapping under load ... then a creak" put it a second or more in (round 1)
    name: 'timber.crack', count: 3, duration: 2,
    prompt: fx('A thick oak beam snapping in two: one loud, sharp, woody crack at the very start, then fibrous splintering and tearing of the grain, fading out quickly. A single break, close-up, outdoors.'),
    play: { near: 4, volume: 0.75, voices: 3, cooldown: 0.08 },
  },
  {
    name: 'timber.groan', count: 2, duration: 3.5, fade: 0.4,
    prompt: fx('An old timber-framed house straining under its own weight just before it gives way: slow, deep creaking and groaning of heavy oak beams, wooden pegs squeaking and popping, a little dust and plaster crumbs trickling down. Slow and ominous.'),
    play: { bus: 'debris', near: 6, volume: 0.6, voices: 2, cooldown: 1.5, spacing: 10 },
  },

  // --- Clay roof tiles ---
  {
    name: 'tile.clatter', count: 3, duration: 3, fade: 0.3,
    prompt: fx('A whole row of fired clay roof tiles sliding down a steep roof and pouring off the eaves: a rattling, scraping cascade of tiles, then tiles smashing and clattering onto cobblestones below, terracotta shards scattering.'),
    play: { bus: 'debris', near: 5, volume: 0.75, voices: 3, cooldown: 0.3, spacing: 6 },
  },
  {
    name: 'tile.impact', count: 4, duration: 1.5,
    prompt: foley('A single fired clay roof tile dropped onto cobblestones and smashing: one bright, hollow ceramic crack like a terracotta flower pot breaking, then a few shards skittering.'),
    play: { bus: 'debris', near: 2.5, rolloff: 1.2, volume: 0.45, voices: 5, pitch: [0.85, 1.15] },
  },

  // --- The hung signs (phase F: shot, or swung by a blast) ---
  {
    name: 'sign.creak', count: 2, duration: 3.5, fade: 0.5,
    negative: `${NO}, door, footsteps, wind howling, chains, bells, voices`,
    prompt: fx('An old wooden shop sign hanging from an iron bracket on two rusty iron rings, knocked and swinging back and forth: three slow, squeaky, grinding creaks of the rusty rings on their hooks as it swings, with a faint hollow wooden knock, then slowing to a stop. Outdoors, close, a quiet street.'),
    // One creak a sign at a time (they're metres apart), two at once. At 0.5 it was lost under the
    // market and the birds 5 m off; at 0.9 (and a swing's 0.75) it's as loud as wood struck there
    play: { near: 4, volume: 0.9, voices: 2, cooldown: 0.8, spacing: 1.5, reverb: 0.25, pitch: [0.92, 1.08] },
  },

  // --- Creatures ---
  {
    // Wings only: alarmed pigeons hardly coo, and coos read as voices in a take
    name: 'birds.scatter', count: 2, duration: 3.5, fade: 0.6,
    negative: `${NO}, cooing, chirping, birdsong`,
    prompt: fx('A flock of pigeons startled off a rooftop all at once: a sudden loud burst of many wings flapping and clapping as they take off, flying up and away and fading out. Outdoors.'),
    // One flock at a time, wherever the blasts are
    play: { near: 10, rolloff: 0.8, volume: 0.7, voices: 2, cooldown: 5, spacing: 60, reverb: 0.35 },
  },
  {
    name: 'chickens.startle', count: 2, duration: 4, fade: 0.5,
    prompt: fx('A few hens in a farmyard suddenly startled: loud panicked squawking and cackling, wings flapping hard, then agitated clucking slowly settling down. Outdoors, close.'),
    // The coop is ~11 m from the start: a wider near than the design's 4 so it's heard over the blast's tail
    play: { near: 6, rolloff: 0.8, volume: 0.65, voices: 1, cooldown: 4, spacing: 10, reverb: 0.25 },
  },

  // --- The player ---
  {
    name: 'steps.cobble', kind: 'slice', space: 'head', count: 1, duration: 8,
    prompt: foley('Footsteps of a person in leather boots walking on old rounded cobblestones at a steady pace: hard heel knocks with a little gritty scuff, clear separate steps with short gaps of silence between them.'),
    play: { volume: 0.3, voices: 2, pitch: [0.95, 1.05], reverb: 0.15 },
  },
].map(sound);
