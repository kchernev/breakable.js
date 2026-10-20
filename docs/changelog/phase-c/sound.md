# Sound: what changed

The sound team's changes in this phase: the engine (`src/lib/audio.ts`), destruction sounds
(`src/lib/destruction-audio.ts`), the pack loader (`src/lib/sound-pack.ts`), the demo's audio
(`src/demo/audio.ts`), `WorldAudio` (`src/demo/worlds/types.ts`), the sound browser
(`src/demo/sound-browser.ts`), the sound pipeline (`scripts/assets/process-sounds.mjs`, its cutting
now in `scripts/assets/sound-cut.mjs`) and the mix across the six worlds. Tests:
`tests/audio.test.ts` (they run without a GPU or a browser: a stand-in AudioContext for the engine
and the demo's audio, `tests/fake-world.ts` for the destruction).

## What every world hears differently (defaults)

- **A world pack's own play settings win.** `loadSoundPack` used to apply the library's
  `packSettings` after a pack's own `play` (from its `index.json`), so a world pack's sound with a
  base name played at the library's settings: Neon Alley's `ambience.city` at 0.35 instead of its
  0.3. Now the order is: the library's `packSettings` for that name, then the pack's `play`, then
  the world's `audio.settings`. The base pack has no `play` of its own, so it plays exactly as
  before (a test compares every base sound with the old order). Only Neon Alley's `ambience.city`
  changes level (0.35 to 0.3, as its pack meant). The sound browser (`sounds.html`) loads packs in
  the same order, and plays a world's pack at that world's levels (see "The sound browser" below).
- **A sound is decided on when it reaches the ears.** `SoundEngine.play` used to decide at once
  whether a sound is heard (the loudness window under the loudest sound lately, the cooldown, a
  voice to spare), so a sound starting later (a `delay`, the speed of sound from far off, debris
  landing) could be turned away by a blast that went off first, and held a voice while it waited.
  Now a sound that starts more than 0.1 s from now is weighed 0.1 s before it starts, against what's
  playing then (`update()` does it each frame; the engine's `update` must be called, as the demo
  does), and only started if it's let through. Until then it takes no voice (`engine.active`
  doesn't count it) and makes no sound. What every world hears: more of the debris and grit that
  lands a second or more after a blast (`brick.debris`, `glass.debris`, `dust.settle`), a far
  blast's boom weighed when it arrives, and a sound with a delay that a later blast drowns out
  isn't played. `play()` still returns a `Voice` for a delayed sound (or null when it can't be heard
  at all); if it's turned away when it arrives, that voice ends without a sound (`voice.live` goes
  false). After a slow frame (over 0.1 s), a sound already due when it's weighed starts then, from
  its beginning (`voice.start` says when); a one-shot more than 0.5 s overdue (no frames for a
  while: a hidden tab, where the context plays on but `update()` isn't called) is dropped, so
  nothing piles up to play at once when the tab comes back. (At first a delayed sound was started
  when asked for and cut when turned away, which a frame over 0.1 s made audible; fixed after the
  review.)
- **Loops keep their voices.** When all 40 voices are busy, the quietest gives way to a louder
  sound, but a loop now gives way only to a louder voice of its own sound (a sound's `voices`
  limit). Before, a loop could give way to any one-shot and was gone for good (nothing starts it
  again): four rockets at 20 m silenced Neon Alley's rain, city and wind, Market Town's birds and
  Sun Temple's cicadas, and a loop ducked with `setVolume(0)` was the first to go. What every world
  hears: its beds and its own loops (neon buzz, steam, a windmill) last through any blast. What it
  costs: the one-shots share the voices the loops leave (40 less the loops playing: 2 to 7 standing
  at the start, at most 9, in Neon Alley around two rockets), so keep a world's loops few, as the
  worlds do now (Neon Alley keeps its buzz, rain and steam loops at the nearest few).
- **The ambience's height shift** (`audio.ambience[].high`) is applied with the new `Voice.setMix`,
  and only when the player's height changes, so a world's own fades on those loops last. Levels are
  the same as before.
- **One more gain node per voice** (the mix stage `setMix` drives). Cheap; noted for completeness.
- **Doppler is on the source's `detune`** rather than its `playbackRate`, so `setRate` and Doppler
  don't undo each other. Heard the same.
- **A soft ceiling on the engine's output**: nothing goes past -1.4 dBFS (a blast used to reach
  0 dBFS); what's under -4.4 dBFS is untouched. See "The mix".
- **The mix**: the beds, footsteps and some loops are at new levels in every world's audio block.
  See "The mix".

## New, and what it replaces

### `MaterialSounds.pitch`: shared sounds at a material's own pitch

```ts
materials: {
  // tile debris as glass debris, lower
  tile: { ...packMaterials.glass, pitch: { debris: 0.75, impact: 0.8 } },
  // every sound of a material, a little higher
  terracotta: { ...packMaterials.brick, pitch: 1.15 },
}
```

A number pitches all of a material's sounds, an object pitches by kind (`break`, `impact`,
`heavyImpact`, `debris`, `strain`, `collapse`, `settle`, `land`; the kinds not listed stay at 1).
It multiplies the sound's own pitch range and the impact's mass pitch. Events of materials sharing a
sound at different pitches are kept apart (each heard at its own pitch), not merged. Default: 1.

Replaces: worlds pitching a shared sound for every material with `audio.settings` (Sun Temple's
`'brick.impact.small': { pitch: [1.0, 1.3] }` in `temple/index.ts`), and the need to make a new
sound for a material that only needs another's sound pitched (Harbor Yard, Neon Alley, Sun Temple:
tile and glass debris).

### `MaterialSounds.heavy`: a material's own heavy threshold

```ts
container: { impact: 'container.clang', heavyImpact: 'container.boom', heavy: 0.04 },
```

Its pieces heavier than this (density × volume) strike with `heavyImpact`. Default:
`DestructionSoundsOptions.heavy` (0.25; the demo doesn't change it). The impact's loudness and pitch
are scaled by the material's threshold too.

### `MaterialSounds.land` and the Destruction's `'landed'` event

```ts
container: { impact: 'container.clang', heavyImpact: 'container.clang', land: 'container.boom' },
```

When a section (pieces still bonded) or a heavy piece touches down whole, the solver's `'landed'`
event (`{ at, pieces, mass, speed, material }`, `solver.md`) plays the material's
`land` sound once, at `at`: louder the heavier (`min(1.3, hard × (0.5 + 0.3 log10(1 + mass /
heavy)))`, `hard` from the speed as for impacts) and lower (down to 0.8). Its pieces' own strikes
at that moment (within `repeat`, 0.3 s) aren't heard; their bounces after are. Default: no `land`
sound, every piece heard as before. DestructionSounds listens for `'landed'` only if some material
has a `land` sound (listening makes falling sections report their contacts).

Replaces: Harbor Yard's section tracking for its boom (`harbor/index.ts`: the `sections` WeakMap
filled in the collapse listener in `build()`, and the `container.boom` play in `onImpact` with
`box.boomed`). With `land: 'container.boom'` on `container` (and `heavyImpact: 'container.clang'`
kept for loose panels), the world can drop both. Note that `'landed'` fires for a section of two
or more bonded pieces or a piece over the Destruction's `heavy`; a box that comes apart in the air
lands as its parts.

### Delayed sounds: `play(name, { delay })` just works

```ts
rt.sound.play('chickens.startle', { at: COOP, delay: 0.3 });   // heard even right after the blast
rt.sound.play('bell.toll', { at: bell, delay: 1.7, volume: 0.6 });
rt.sound.play('explosion.far', { at: [-400, -40, -60], volume: 0.5, delay: 1.4 });
```

See the default change above. Replaces: Market Town's `later` queue (`medieval/index.ts`: `toll()`,
the hens in `onBlast`, the loop at the end of `update()`), which it can keep for what depends on the
world's state at the time (`ifHanging`: a toll only while the bell hangs; a world can also `stop()`
the delayed voice when the bell falls). Sun Temple's bay echo (`temple/index.ts`: `state.echoDue`,
played from `update()`) can be a `delay`. Their workarounds keep working.

### `Voice.setRate(rate, time = 0.05)` and `Voice.setMix(mix, time = 0.05)`

```ts
windmill.setRate(0.8 + 0.4 * gust, 0.3);   // the clank speeds up in a gust (and pitches up)
```

`setRate`: the playback rate as a multiple of the rate the voice was played at (its random pitch and
the play's `pitch` kept: `setRate(1)` is back to how it started), over `time` seconds. A one-shot
slowed down plays longer: `voice.duration` follows, so it keeps its voice while it still plays. A
voice following an object gets its Doppler shift on top (on `detune`), and the rate still changes
over `time`. `setMix`: a second volume multiplier (default 1), apart from `setVolume`'s, for a mix
applied by someone other than whoever sets the volume; neither undoes the other's fades. The demo
uses it for the ambience's height shift. `setVolume` is unchanged: a multiple of the sound's own
volume (`setVolume(1)` is the sound as it's set, whatever `volume` the play had; Market Town's
birds rely on that). The two differ because a sound has one volume but no one rate (its pitch is a
range).

Replaces: in Dust Town (`western/life.ts`, the windmill in `update`), `windmill.loop` can follow the
gusts in rate as well as in volume.

### `DemoAudio.ambience: Map<string, Voice>`

The world's `audio.ambience` loops by sound name, once the packs have loaded (until then the map is
empty; use `?.`). `setVolume(1)` is a loop's level as listed (its `volume` and the height shift are
applied apart, with `setMix`), so a world can duck one and bring it back:

```ts
rt.ambience.get('ambience.cicadas')?.setVolume(0, 0.5);   // a blast: they go quiet
rt.ambience.get('ambience.cicadas')?.setVolume(1, 10);    // back over 10 s
```

Turn a loop down rather than `stop()` it: a stopped loop is gone (the demo doesn't restart it). A
loop turned down to nothing keeps its voice through any blast (see "Loops keep their voices"). If a
world lists the same sound twice, the map has the first. The runtime team wires it as
`rt.ambience` (`WorldRuntime`).

Replaces: Sun Temple's own `ambience.cicadas` voice (`temple/index.ts`: `state.cicadas` started in
`update()`) and Market Town's `ambience.birds` and `ambience.market` (`medieval/index.ts`: `birds`,
`market`, started in `update()`, `market` stopped and played again): list them in `audio.ambience`
and turn them down and up through the map (Market Town's market: `setVolume(0, 2)` at a blast,
`setVolume(1, 15)` after the long quiet, instead of `stop()` and a new `play`). Dust Town's gust can
raise the wind's own loop (`setVolume(1.7, 1.4)`, then back) instead of a second voice of it.

### `WorldAudio.footsteps.surface`: footsteps by what's underfoot

```ts
footsteps: {
  hard: 'steps.dirt',
  surface: ([x, y, z], material, rubble) =>
    material === 'boards' && !rubble ? 'steps.boardwalk' : y > 0.3 && onBoardwalk(x, z) ? 'steps.boardwalk' : undefined,
},
```

`surface(at, material, rubble)`: called at each footfall with the feet (`at`, x, y, z as everywhere
else), the material of the piece stood on, and whether that piece is rubble. The piece is found as
the player finds what it stands on: the first piece down from a metre over the feet, if its top is
at the feet (a floor, a boardwalk, rubble, a prop like a car); null on the ground or the scenery.
The material and the rubble flag come from that one piece. Return a sound name; nothing, or a sound
that isn't loaded, plays `hard` or `rubble` as before. Default: none (as before). (It first took
`(x, z, y, …)` against its own comment's x, y, z, cast its own shorter ray, and was silent for a
sound name not loaded; changed after the review, before any world used it.)

Replaces: one footstep sound per world (`audio.footsteps.hard`). Dust Town (boardwalks), Market Town
(cobbles), Harbor Yard (wet concrete, steel), Sun Temple (marble), Neon Alley (wet asphalt) can make
the sounds per surface.

### `process-sounds.mjs`: start at the loudest onset, skip a slice

- `onset` on a shot in a pack's `sounds.mjs`: cut everything before the rise into its loudest part
  (for takes that build up to the hit). `onset: true` cuts where its loudness (over 50 ms) last came
  up through 15 dB under its loudest, from 5 ms before; `onset: 10` through 10 dB (closer to the
  peak). A 3 ms fade in at the cut. Tried on Harbor Yard's `sheet.tear` takes: they start 0.6 to 1 s
  later, at about -28 dBFS instead of -54, with the tear's peak 0.5 to 0.9 s in.
- `--skip name:i:j` (or the same in the raws' `skip.json`) leaves out slice `j` (from 0, in the
  order they come) of a sliced take `i`; the log now lists each sliced take's slices with their
  times (`steps.metal:0: slices at 0: 1.13, 1: 1.42, …`). Harbor Yard's `steps.metal` crunches can
  go: `PACK=harbor node scripts/assets/process-sounds.mjs --only steps.metal --skip steps.metal:0:2,…`
  (listen to the slices in the sound browser first: slice j is file j of a single take).
- The functions on a take's samples (`trim`, `onset`, `fade`, `loop`, `slices`, `level`, `mono`)
  are in `scripts/assets/sound-cut.mjs` now (types in `sound-cut.d.mts`), so the tests can feed them
  made-up signals; `process-sounds.mjs` keeps the files and the list. Unchanged in what they do:
  Harbor Yard's `sheet.tear` and `steps.metal` come out sample for sample the same.

### The sound browser: a world's pack at that world's levels

`sounds.html?pack=<world>` loads the world's definition and plays its pack's sounds as the game
does: the pack's settings, then the world's `audio.settings`, and a loop it lists in
`audio.ambience` at that `volume` (standing on the ground: the height shift isn't applied). A
sound the world re-levels says so by its name (`ambience.birds  loop · head · 0.17 here (pack
0.32)`), so whoever re-levels a sound sees where its level lives. The base pack plays at
`packSettings` (a world that re-levels a base sound, as Brick Street's `ambience.city` at 1.65 in
its `ambience`, isn't shown there). (Before the review it played every pack at the pack's levels,
which since the mix pass weren't the game's.)

## The mix

### How it was measured

Each world recorded on the virtual display, muted to the speakers, from the engine's `output` node
into a MediaStreamDestination (PCM), standing at the world's start: 20 s standing; 8 footsteps
(`player.onStep('hard', 4)`, every 0.5 s) and one `launcher.fire` with the ambience bus muted; then
two rockets at the standing piece in front of the player nearest 20 m off (the same blast distance
in every world; 19.5 to 20.4 m) and 20 s after. Loudness with ffmpeg's `ebur128` (integrated I,
true peak TP, short-term S over 3 s, momentary M over 0.4 s). The bed is the energy mean of the
quietest 40% of the 20 s standing (momentary), so a world's own events (Market Town's evening bell,
Harbor Yard's gulls) don't count as bed. The footsteps are also measured from the files, all
slices back to back at their play volume (the 8 steps in the game pick slices at random: ±1 dB).
The scripts aren't in the repo (they were the session's; the recipe is all here): record as the
guide's "Checking it" says, then `ffmpeg -ss <start> -t <seconds> -i rec.wav -af ebur128=peak=true
-f null -` for each part.

"Before" is this phase's code with items 1–7 in and the worlds' levels as they were (Neon Alley's
city loop already at its pack's 0.3). Brick Street, Market Town, Dust Town and Neon Alley were
recorded before the ceiling went in; Harbor Yard and Sun Temple after it (their "before" peaks
already have it).

### Before and after (LUFS; TP in dBTP)

| World | Bed | Standing, I | Steps (game) | Steps (files) | Launcher, max M | Rockets, I | Rockets, max M | Rockets, TP |
|---|---|---|---|---|---|---|---|---|
| Brick Street, before | -37.9 | -35.9 | -30.9 | -32.3 | -11.9 | -17.4 | -13.4 | -3.3 |
| Brick Street, after | **-34.6** | -32.5 | -31.5 | -32.3 | -11.1 | -18.1 | -11.9 | -2.8 |
| Market Town, before | -29.3 | -23.1 (bell) | -31.6 | -33.5 | -11.7 | -17.0 | -12.7 | -2.3 |
| Market Town, after | **-34.3** | -25.5 (bell) | -31.3 | -32.4 | -11.9 | -17.8 | -12.7 | -2.4 |
| Dust Town, before | -30.0 | -27.3 | -28.6 | -29.1 | -11.2 | -19.7 | -10.2 | **0.0** |
| Dust Town, after | **-33.0** | -30.6 | -31.5 | -32.3 | -10.8 | -21.0 | -12.0 | -1.8 |
| Neon Alley, before | -22.8 | -22.2 | -32.5 | -33.3 | -11.1 | -18.9 | -12.4 | -2.8 |
| Neon Alley, after | **-32.9** | -32.2 | -31.9 | -32.2 | -11.8 | -21.6 | -13.1 | -3.9 |
| Harbor Yard, before | -31.8 | -28.5 | -32.0 | -32.9 (rubble -27.0) | -11.1 | -17.2 | -10.3 | -2.7 |
| Harbor Yard, after | **-33.3** | -30.2 | -31.1 | -32.3 (rubble -30.3) | -10.7 | -19.2 | -10.4 | -3.0 |
| Sun Temple, before | -32.4 | -29.3 | -28.5 | -28.8 | -11.8 | -22.9 | -13.0 | -4.2 |
| Sun Temple, after | **-33.7** | -30.4 | -32.7 | -32.5 | -10.9 | -21.1 | -13.3 | -3.2 |

- **Beds:** 15.1 LU apart before (Neon Alley's rain at -22.8, Brick Street at -37.9), 1.7 LU after
  (-34.6 to -32.9). By the loops' own average loudness (each loop file's integrated loudness at its
  volume, summed) they are within 1.9 LU; a 20 s window varies about ±1 LU with what's in the loop
  then (Brick Street's city loop has a passing truck 10 LU over its average at 5.6 s of its 41 s,
  which is 3.5 dB louder than before; Dust Town's gusts add a voice of the wind).
- **Footsteps:** from the files, -32.2 to -32.5 everywhere (Brick Street's asphalt, -32.3, is the
  reference); rubble -30.2 (base) and Harbor Yard's metal -30.3. In the game, -32.7 to -31.1 (4 LU
  apart before). They sit 1 to 3 LU over the bed now; before, Neon Alley's were 10 LU under its rain
  and Brick Street's 7 over its bed.
- **Launcher:** the same sound everywhere: loudest momentary -10.7 to -11.9 (its takes differ).
- **Explosions:** the true peak was 0.0 dBTP in Dust Town (sample peaks at -0.05 dBFS for over a
  second after the first blast: the compressor's makeup gain and its 3 ms attack let the hits
  through). With the ceiling, at most -1.8 dBTP at 20 m, and -1.9 to -2.3 dBTP with blasts 3, 4 and
  6 m off (Brick Street, Dust Town, Neon Alley). The ceiling bends 0.01% of the samples of a 20 m
  rocket scene and 0.14% of a 3–6 m one.

### What changed

- **The engine's ceiling** (`src/lib/audio.ts`, every world): after the compressor, a WaveShaper
  (4× oversampled) that is straight up to -4.4 dBFS and bends smoothly toward -1.4 dBFS, never past
  it. The compressor itself is unchanged (so are all levels under -4.4 dBFS). `engine.output` is the
  ceiling now (record from it, as before).
- **The worlds' levels**, in each world's `audio` block (not in the packs' `index.json`:
  `process-sounds.mjs` writes those from the lists in `scripts/assets/packs/<id>/sounds.mjs`, so a
  change there would be lost the next time it runs). Each block has a one-line comment pointing here.

| World (file) | Change (was) |
|---|---|
| Brick Street (`nyc/index.ts`) | `ambience.city` volume 1.65 in `ambience` (1) |
| Market Town (`medieval/index.ts`) | `settings`: `ambience.birds` 0.17 (pack 0.32), `ambience.market` 0.22 (0.4), `steps.cobble` 0.34 (0.3) |
| Dust Town (`western/index.ts`) | `ambience.desert` volume 0.45 (1); `settings`: `windmill.loop` 0.64 (0.8), `steps.dirt` 0.22 (0.32) |
| Neon Alley (`neon/index.ts`) | `ambience.rain` volume 0.2 (1), `ambience.city` 0.4 (1); `settings`: `steps.wet` 0.36 (0.32) |
| Harbor Yard (`harbor/index.ts`) | `ambience.harbor` volume 0.9 (1); `settings`: `steps.wet` 0.32 (0.3), `steps.metal` 0.22 (0.32) |
| Sun Temple (`temple/index.ts`) | `ambience.coast` volume 0.95 (1); `settings`: `ambience.cicadas` 0.2 (0.32), `steps.gravel` 0.21 (0.32) |

A world that changes a loop's level, adds a bed loop or new footsteps should keep its bed about
-33 LUFS standing at its start and its steps as loud as `steps.asphalt` at 0.3 (-32.3 LUFS, its
slices back to back).

### After the review's fixes

Re-recorded the same way (Neon Alley and Brick Street): beds -33.0 and -34.3 LUFS, rockets I -18.8
and -16.1, true peak -3.9 and -2.8 dBTP: within a run's variation of the table above (the blasts
differ from run to run). Loops through blasts (the review's scripts): four rockets a second apart
at 20 m in Neon Alley, Market Town and Sun Temple, four blasts at 10 m in Neon Alley, and twelve in
Brick Street with its loops ducked to nothing: every loop live after, none given away, with all 40
voices in use and a hundred one-shots giving way to each other. Around two rockets, 182 delayed
sounds in Neon Alley (74 in Dust Town): 72 let through (28), 110 turned away (46) without a sound;
frames up to 103 ms, none started late.

### Found, not fixed

- **The base `explosion.near` takes are harsh in their initial bang.** An audio model
  (fal-ai/audio-understanding, `assets-src/packs/mix-ledger.jsonl`, 3 calls, $0.11) called Neon
  Alley's rockets "distorted and harsh" with the ceiling and "clipped and harsh" before it, and the
  raw takes 0 and 2 "harsh and distorted, in the initial bang". It's in the asset, not the mix: a
  new generation of the base explosions (or a gentler cut of their first milliseconds) would fix it.
- (Was here: loops given away when the voices run out. They were, in ordinary play: fixed, see
  "Loops keep their voices".)
