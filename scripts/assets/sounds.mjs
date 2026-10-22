// The sound pack: what to ask Stable Audio 3 (Medium) for, and how each clip is cut once it's back.
//
// kind: 'shot' (a one-shot, trimmed of silence), 'loop' (crossfaded into itself so it repeats
// seamlessly), 'slice' (one take of several separate hits, cut apart: footsteps).
// space: 'world' (heard from somewhere in the scene: mono) or 'head' (the player's own: stereo).

// For packs' lists too (scripts/assets/packs/<pack>/sounds.mjs import these)
export const NO = 'music, melody, singing, speech, voices, talking, dialogue, beeps, synthesizer';
export const fx = (s) => `${s} Sound effect, no music.`;
export const foley = (s) => `${s} Close-up foley, dry, no music.`;
/** A list entry with the defaults filled in. */
export const sound = (s) => ({ kind: 'shot', space: 'world', negative: NO, fade: 0.15, ...s });

/**
 * `onset`, `start`, `parts`: where a take is cut (process-sounds.mjs says how).
 * `play`: how the game plays it (the library's SoundOptions without src: volume, near, voices,
 * cooldown, bus…), written into the pack's index.json.
 * @type {Array<{ name: string, prompt: string, duration: number, count: number, kind?: 'shot'|'loop'|'slice', space?: 'world'|'head', negative?: string, fade?: number, onset?: true|number, start?: number, parts?: Array<Array<[number, number, number]>>, play?: object }>}
 */
export const sounds = [
  // --- The launcher and its rocket ---
  { name: 'launcher.fire', space: 'head', count: 3, duration: 3, prompt: fx("Shoulder-fired rocket launcher firing, heard from the shooter's position: a hard punchy thump of the launch, then a fierce rushing whoosh of the rocket motor speeding away into the distance, outdoors.") },
  { name: 'launcher.reload', space: 'head', count: 2, duration: 3, prompt: foley('Reloading a heavy military rocket launcher: a metal rocket sliding into a steel tube with a scrape, a solid heavy metallic clunk as it seats, then a latch snapping shut.') },
  { name: 'rocket.loop', kind: 'loop', count: 2, duration: 8, prompt: fx('Steady continuous roar and hiss of a small rocket motor burning, a constant rushing jet noise with crackle, sustained without change from start to end.') },
  { name: 'rocket.flyby', count: 2, duration: 3, prompt: fx('A rocket whooshing past very close at high speed: a fast doppler whoosh with rushing jet hiss passing by and away.') },

  // --- The machine gun, its casings and its bullets (docs/changelog/phase-e/gunsounds.md) ---
  // A burst is 10-12 shots a second. Each shot starts at its crack and fades out over its last
  // half second (the four voices cut the oldest sooner). The demo plays it at half its level here
  // (SHOT in src/demo/audio.ts: a burst about 9 dB under the launcher), and the gun's other sounds
  // are levelled to the shot as heard there, 0.15: fold SHOT into this one and the rest hold. The
  // echo is its own sound, played once a burst ends
  {
    name: 'gun.shot',
    space: 'head',
    count: 8,
    duration: 1,
    onset: true,
    fade: 0.5,
    negative: `${NO}, echo, reverb, explosion, several shots, burst`,
    prompt: fx("A single shot from a military assault rifle, heard from the shooter's position outdoors: one loud, sharp, punchy and dry report, a hard crack with a deep thump and a metallic clack of the action."),
    play: { volume: 0.3, voices: 4, pitch: [0.97, 1.03], reverb: 0.2 },
  },
  // Every take starts with a shot's crack (asked for as a burst's echo, each began with the burst):
  // its first 60 ms are cut, so it comes in after the last shot as the street's ring alone. One
  // voice: a new burst's tail takes over from the last one's
  {
    name: 'gun.tail',
    space: 'head',
    count: 3,
    duration: 2.5,
    start: 0.06,
    fade: 0.8,
    negative: `${NO}, gunshots, gunfire, rifle shots, close crack, burst`,
    prompt: fx('The echo after a burst of gunfire in a city street, heard from where the shooter stands: only the reverberation, a low rolling rumble with slapback reflections from the buildings, decaying smoothly into silence.'),
    play: { volume: 0.065, voices: 1, pitch: [0.95, 1.05], reverb: 0 },
  },
  // Each take's moves laid out on the gun's 2 s reload (src/demo/gun.ts): the magazine out by
  // 0.55 s, the new one seated at 1.42, the handle pulled at 1.52 and let go by 1.85, all over by
  // 2, when it can fire again. Never pitched, so the timing holds
  {
    name: 'gun.reload',
    space: 'head',
    count: 2,
    duration: 2.5,
    fade: 0.06,
    parts: [
      [[0, 0.72, 0], [1, 1.64, 0.95], [1.75, 2.02, 1.5], [2.26, 2.5, 1.74]],
      [[0, 0.52, 0.1], [1.04, 1.27, 1.255], [2.18, 2.5, 1.5]],
    ],
    prompt: foley('Reloading an assault rifle: the empty magazine pressed out with a click and pulled free, a full magazine pushed in and locked with a firm metallic snap, then the charging handle pulled back and let go with a sharp metallic clack.'),
    play: { volume: 0.3, voices: 1, pitch: [1, 1], priority: 2, reverb: 0.1 },
  },
  // Each take came as two clicks: sliced, each gives its second (the first is at its very start,
  // where the slicer finds no rise), from where it rises
  {
    name: 'gun.empty',
    kind: 'slice',
    space: 'head',
    count: 2,
    duration: 1,
    onset: 20,
    prompt: foley('A rifle trigger pulled on an empty chamber: one single dry, small, sharp metallic click of the hammer, then silence.'),
    play: { volume: 0.22, voices: 1, cooldown: 0.12, reverb: 0.05 },
  },
  // At the shooter's feet, a moment after each shot: on the debris bus, thinned by the cooldown
  {
    name: 'casing.drop',
    kind: 'slice',
    count: 2,
    duration: 8,
    prompt: foley('Empty brass rifle cartridge casings falling one at a time onto a concrete pavement: separate small, bright, high metallic tinkles and pings, each casing bouncing and rolling briefly, a short pause between each.'),
    play: { bus: 'debris', near: 1.5, rolloff: 1.5, volume: 0.15, voices: 3, cooldown: 0.1, spacing: 1, pitch: [0.9, 1.12], reverb: 0.1 },
  },
  // Where a bullet strikes, a third of a second each, cut from takes of single hits and started
  // where each rises (some came with a hiss before: heard late, a stream of them limps). The grit
  // after a hit comes as a slice of its own: those are left out, in the raws' skip.json. Levelled
  // to each other (about -37 LUFS at 15 m in a world), on the sfx bus so a blast doesn't duck them
  // away. Full volume within 6 m, 2-4 dB under the shot there: a hit at your feet stays under it
  ...[
    ['brick', 2, 0.215, 'Bullets striking a brick wall one at a time, about a second apart: each a sharp, hard, dry crack with a short burst of brick chips and grit scattering.'],
    ['concrete', 2, 0.365, 'Bullets striking a concrete wall one at a time, about a second apart: each a hard, sharp snap of stone and a short spray of grit and plaster dust.'],
    // Asked for a ping with a ring, it rang like a cowbell
    ['metal', 2, 0.13, 'Bullets striking thick armour steel one at a time, about a second apart: each a hard, sharp, bright metallic spang, a quick high ping that stops at once.', ', ringing bell, cowbell, hollow tone'],
    ['wood', 2, 0.235, 'Bullets hitting thick wooden planks one at a time, about a second apart: each a solid, dull thunk with a crack of splintering wood.'],
    ['glass', 2, 0.34, 'Bullets punching through small panes of glass one at a time, about a second apart: each a sharp crack and a quick, small shatter of glass shards.'],
    // Take 0 was asked for as 'Bullets hitting dry dirt ground…, each a soft, muffled thud and a
    // short spray of sand and soil': its other seeds came out fleshy, then as glass
    ['dirt', 2, 0.365, 'Bullets thudding into dry packed earth one at a time, about a second apart: each a dull, soft, low thump and a short spray of sand, soil and small pebbles pattering down.', ', glass, flesh, wet'],
  ].map(([material, count, volume, prompt, avoid = '']) => ({
    name: `bullet.${material}`,
    kind: 'slice',
    count,
    duration: 8,
    onset: 20,
    negative: `${NO}, gunshots, gunfire, rifle${avoid}`,
    prompt: foley(prompt),
    play: { near: 6, rolloff: 0.8, volume, voices: 4, pitch: [0.9, 1.1], reverb: 0.25 },
  })),
  {
    name: 'bullet.ricochet',
    count: 3,
    duration: 1.5,
    fade: 0.3,
    negative: `${NO}, gunshots, gunfire`,
    prompt: fx('A bullet ricocheting off stone: a sharp ping and a high whining whistle flying away, fading quickly.'),
    play: { near: 6, rolloff: 0.8, volume: 0.13, voices: 2, cooldown: 0.2, spacing: 4, pitch: [0.85, 1.15], reverb: 0.3 },
  },
  // A bird shot out of the air (src/demo/birds.ts): what says it was hit, a round going into
  // something so light being all but silent. Each take came with two or three, cut apart
  {
    name: 'bird.hit',
    kind: 'slice',
    count: 3,
    duration: 1.5,
    onset: 20,
    fade: 0.1,
    negative: `${NO}, gunshots, gunfire, explosion, chirping, birdsong, squawking`,
    prompt: foley('A bird struck in mid-air: a single soft, muffled, feathery thwack, then a short frantic flutter of wings and a puff of loose feathers, over in under a second.'),
    play: { near: 10, rolloff: 0.8, volume: 0.4, voices: 3, cooldown: 0.05, pitch: [0.9, 1.15], reverb: 0.3 },
  },

  // --- Cars coming apart (src/demo/cars.ts) ---
  // A latch sprung by rounds or a blast: the door swings open; the hood or the trunk lid pops up
  { name: 'car.door', count: 3, duration: 2, fade: 0.3, prompt: foley('A car door springing open by itself after its lock is shot: a hard metallic clunk of the latch letting go, then the heavy door swinging open with a short creak of its hinges.'), play: { near: 6, rolloff: 0.8, volume: 0.55, voices: 2, cooldown: 0.15, pitch: [0.92, 1.08], reverb: 0.3 } },
  { name: 'car.lid', count: 2, duration: 2, fade: 0.3, prompt: foley("A car's bonnet springing open: the latch releasing with a hard metallic clunk and the thin sheet-steel lid flying up and wobbling with a tinny boing."), play: { near: 6, rolloff: 0.8, volume: 0.55, voices: 2, cooldown: 0.15, pitch: [0.92, 1.08], reverb: 0.3 } },
  // A tyre shot: the bang, then its air hissing out
  { name: 'tyre.burst', count: 3, duration: 2.5, fade: 0.5, negative: `${NO}, gunshots, gunfire`, prompt: fx('A car tyre bursting: one loud sharp bang of the tyre blowing out, then a strong hiss of escaping air fading away.'), play: { near: 8, rolloff: 0.8, volume: 0.7, voices: 2, cooldown: 0.1, pitch: [0.9, 1.1], reverb: 0.35 } },
  // A holed tank: petrol running out onto the road; then it catches
  { name: 'fuel.leak', kind: 'loop', count: 1, duration: 10, prompt: foley('Petrol pouring out of a holed car fuel tank: a thin steady stream of liquid splashing and gurgling onto asphalt, close up, constant.'), play: { near: 3, rolloff: 1, volume: 0.35, voices: 2, reverb: 0.15 } },
  { name: 'fuel.ignite', count: 2, duration: 3.5, fade: 0.8, prompt: fx('Spilled petrol under a car catching fire: a deep sudden whoomph of ignition, then the roar of flames taking hold.'), play: { near: 10, rolloff: 0.7, volume: 0.9, voices: 2, cooldown: 0.5, reverb: 0.4 } },

  // --- Blasts ---
  { name: 'explosion.near', count: 4, duration: 6, fade: 0.6, prompt: fx('Massive close-range explosion of a rocket hitting a brick building: deep sub-bass boom and sharp crack, then bricks and debris crumbling and raining down onto a city street, outdoor echo.') },
  { name: 'explosion.far', count: 3, duration: 7, fade: 0.8, prompt: fx('A distant explosion heard from a few blocks away in a city: a deep muffled boom that rolls and echoes between tall buildings, with a long reverberant rumbling tail.') },
  { name: 'explosion.debris', count: 3, duration: 5, fade: 0.6, prompt: fx('Rubble raining down after an explosion: a shower of broken bricks, stones and small chunks falling and bouncing on asphalt, scattered heavy thuds and pattering clatter, fading out.') },

  // --- Masonry ---
  { name: 'brick.break', count: 4, duration: 2.5, prompt: fx('A brick wall cracking and breaking apart: a sharp loud crack followed by crumbling bricks and mortar.') },
  { name: 'brick.impact.small', count: 6, duration: 1.5, prompt: foley('A single broken brick hitting asphalt pavement: one short hard knock with a little gravelly crumble.') },
  { name: 'brick.impact.large', count: 4, duration: 3, prompt: fx('A heavy chunk of brick wall, several bricks still mortared together, slamming onto an asphalt street: a deep, low, weighty thud, then the bricks crunching apart and a short rattle of debris. Bassy and heavy.') },
  { name: 'brick.debris', count: 4, duration: 2, prompt: foley('A handful of small stones and brick chips scattering across pavement: a quick pattering, rattling clatter.') },
  { name: 'concrete.break', count: 3, duration: 2.5, prompt: fx('A reinforced concrete slab cracking and snapping: a loud sharp fracture with a grinding crunch and crumbling.') },
  { name: 'concrete.impact', count: 4, duration: 2.5, prompt: fx('A heavy concrete slab slamming flat onto rubble: a massive dull thud with cracking and crumbling.') },

  // --- Glass ---
  { name: 'glass.shatter', count: 5, duration: 2.5, prompt: fx('A window pane shattering: a bright explosive crash of breaking glass with shards scattering and tinkling.') },
  { name: 'glass.debris', count: 3, duration: 2.5, prompt: foley('Small pieces of broken window glass dropping onto a concrete pavement: bright, glassy tinkling and clinking of shards, scattered.') },

  // --- Wood ---
  { name: 'wood.break', count: 3, duration: 2, prompt: fx('Wooden planks and a door frame snapping and splintering: a sharp crack with a splintering crunch.') },
  { name: 'wood.impact', count: 3, duration: 1.5, prompt: foley('A wooden plank falling onto concrete: a hollow wooden knock and a short clatter.') },

  // --- Metal ---
  { name: 'metal.impact.small', count: 4, duration: 2, prompt: foley('A short iron bar dropped onto concrete: a hard metallic clang with a short ringing.') },
  { name: 'metal.impact.large', count: 3, duration: 3.5, prompt: fx('A heavy iron fire escape staircase crashing onto a street: a loud metallic crash with clanging, banging and rattling steel.') },
  { name: 'metal.bend', count: 3, duration: 3, prompt: fx('Old steel structure bending and tearing under heavy load: a deep metallic groan and creak, rivets popping, screeching metal.') },

  // --- Structures giving way ---
  { name: 'collapse.rumble', count: 3, duration: 7, fade: 1, prompt: fx('A brick building facade collapsing: a long deep rumble of masonry crumbling and falling, a heavy avalanche of bricks and debris crashing down, fading out.') },
  { name: 'structure.creak', count: 3, duration: 3, prompt: fx('An old brick building groaning under strain just before it collapses: a deep, low grinding of masonry, stone scraping on stone, mortar cracking, a trickle of small debris. Slow and ominous.') },
  { name: 'dust.settle', count: 2, duration: 5, fade: 1, prompt: fx('Dust and fine debris settling after a collapse: a soft hiss of sand and tiny pebbles trickling down, quiet.') },

  // --- The player ---
  { name: 'steps.asphalt', kind: 'slice', space: 'head', count: 1, duration: 8, prompt: foley('Footsteps of a person in boots walking on an asphalt street at a steady pace, clear separate steps with short gaps.') },
  { name: 'steps.rubble', kind: 'slice', space: 'head', count: 1, duration: 8, prompt: foley('Footsteps of a person in boots walking over broken bricks and gravel rubble at a steady pace, separate crunching steps with short gaps.') },
  { name: 'player.land', space: 'head', count: 2, duration: 1.5, prompt: foley('A person landing from a jump onto pavement in boots: a single heavy thud with a scuff.') },

  // --- Ambience ---
  { name: 'ambience.city', kind: 'loop', space: 'head', count: 1, duration: 45, prompt: 'New York City street ambience on a calm afternoon: distant traffic hum, a far car horn now and then, pigeons, faint wind between buildings. Field recording, no voices, no music.' },
  { name: 'ambience.wind', kind: 'loop', space: 'head', count: 1, duration: 30, prompt: 'Gentle wind blowing down an empty city street, soft gusts and an airy whoosh. Field recording, no music.' },
  { name: 'alarm.car', kind: 'loop', count: 2, duration: 12, negative: 'music, melody, singing, speech, voices', prompt: fx('A car alarm going off on a city street: a classic loud electronic car alarm cycling through its siren and whooping tones, outdoors.') },
  { name: 'siren.far', kind: 'loop', space: 'head', count: 1, duration: 25, negative: 'music, melody, singing, speech, voices', prompt: 'Distant police and fire truck sirens wailing far away across a city, echoing between buildings. Field recording, no music.' },
  { name: 'fire.loop', kind: 'loop', count: 1, duration: 15, prompt: fx('Debris burning after an explosion: steady crackling flames and popping embers, close-up.') },
].map(sound);
