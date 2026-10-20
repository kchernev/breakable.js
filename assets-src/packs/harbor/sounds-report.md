# Harbor Yard sounds: report

15 sounds in `public/packs/harbor/sounds/` (2.1 MB, `index.json` with each sound's `play`), made
from `scripts/assets/packs/harbor/sounds.mjs` with Stable Audio 3 Medium. 39 of the 40 allowed
takes were used: 36, plus 3 groans made again. One take is left in reserve.

(Later, with no new takes: `sheet.tear` is cut at the rise into its rip (`onset` in sounds.mjs),
and `steps.metal` keeps the 7 slices that are steps: slices 1, 3 and 5, the crunches 0.37 to 0.47 s
after a step's clank, are left out (`sounds/skip.json`).)

## How it was checked

- The pipeline's audio model QA (`sounds/qa.json`) on every take.
- A spectrogram of every take, plus levels, clipping, steady tones (music or beeps would show)
  and how each one ends after the trim.
- In Chrome on the virtual display (muted), the base and harbor packs were loaded with the
  library's `loadSoundPack`. All 15 sounds and every take decoded. A scripted scene played on the
  engine was recorded: ambience, lapping 12 m off, a gull 45 m up, the horn from 330 m, a blast 15 m
  off with the scatter, the collapse, boom, clangs, a splash, chains, and both kinds of steps.
  Every play was accepted. Levels in that mix: ambience -34 dBFS RMS, horn -23, the blast
  section -16, and the steps -31 (with the base's steps.asphalt settings). The peak was -2.4,
  through the limiter.

## Each sound, honestly

| Sound | Takes | How good | Notes |
|---|---|---|---|
| ambience.harbor | 1 | 7/10 | Steady and even, no voices or music. Mostly low rumble (63–250 Hz) with soft lapping, so the water detail is thin; water.lap brings that near the quay. Two faint gull blips (about 4 s and 31 s in) come back every 41 s. Volume lowered to 0.3: it is more even than the city loop, so it sits higher at the same level. |
| water.lap | 1 | 8/10 | Clear slaps and gurgles every ~2 s, bright. Clean 18 s loop. |
| gulls.call | 3 | 9/10 | Clean, convincing herring gull cries; three different phrasings. |
| gulls.scatter | 2 | 7/10 | Good alarmed cries. The wing flaps are hard to pick out. Both takes stopped abruptly at the end, fixed with a 1.5 s fade (QA had given take 1 a 6 for that). |
| ship.horn | 2 | 9/10 | Deep tonal horn (about 90 Hz with harmonics), one ~4 s blast and an echo tail. Volume 0.45 after hearing it in the mix (0.8 was almost as loud as a blast 15 m away). |
| water.splash | 3 | 8/10 | Deep plunge, then spray and slosh. All three are heavy objects; a board or a carton gets the same sound pitched up. |
| container.boom | 4 | 8/10 | Big hollow booms that ring out. Takes 1–3 have a few clipped samples (8–19 in a row, under 0.5 ms) in the first 30 ms of the hit; they read as part of the hit. |
| container.clang | 4 | 8/10 | Sharp, short sheet-metal clangs with a wobble, four different ones. |
| container.groan | 3 | 7/10 | Redone. The first prompt ("a lock grinding and popping") gave a loud bang 1.2 s in (QA 2–4). The new ones start at once and groan continuously for ~3.5 s (QA 10). They are low and dark (centroid ~500 Hz), so from far off they may read as rumble more than screech. |
| container.collapse | 3 | 7/10 | Takes 0 and 1 are good: several booms, scraping, settling. Take 2 is two booms then sparse ticks (QA 3); kept, because it sounds like one box toppling and bouncing. |
| sheet.tear | 3 | 6/10 | QA 10, but all three build up: the loudest part comes 1–1.5 s after the start. That fits after a blast (bang, then metal screeching); it lags on a tear caused by an impact. Takes 1 and 2 ran to the end of the take, so I lengthened the fade to 0.6 s. |
| chain.rattle | 2 | 8/10 | Heavy jangles and clanks, settling. Only two takes. |
| drum.bonk | 3 | 7/10 | A bong, then a short roll. Take 0 is mostly the single hit; take 1 has a few clipped samples at the hit. |
| steps.wet | 1 → 10 slices | 8/10 | Ten even, clean steps with a damp scuff. |
| steps.metal | 1 → 10 slices | 6/10 | Crunchy and bright. The take had ~7 steps; three of the 10 slices are the crunch that follows a step's clank, levelled up like a whole step. Fine for rubble, but uneven. |

## What I'd redo (one take is left)

1. sheet.tear: ask for "a sudden violent rip that hits at once", so the loudest part is at the start.
2. A small splash (`water.splash.small`, 2 takes) for boards, cartons and pallets.
3. steps.metal: ask for widely spaced single steps, each one clank.
4. container.collapse:2.
5. A hiss for a breached tank (none was made; see below).

## For the builder

```ts
audio: {
  packs: ['/packs/harbor/sounds/'],
  settings: { 'explosion.near': { reverb: 0.35 }, 'explosion.far': { reverb: 0.4 } }, // open water, no street canyon
  ambience: [{ sound: 'ambience.harbor', high: 0.5 }, { sound: 'ambience.wind', high: 3 }],
  footsteps: { hard: 'steps.wet', rubble: 'steps.metal' },
  materials: {
    container: { break: 'sheet.tear', impact: 'container.clang', heavyImpact: 'container.boom', debris: 'metal.impact.small', strain: 'container.groan', collapse: 'container.collapse' },
    cladding / rollerDoor: { break: 'sheet.tear', impact: 'container.clang', heavyImpact: 'metal.impact.large', debris: 'metal.impact.small', strain: 'metal.bend', collapse: 'metal.impact.large' },
    tank: { break: 'sheet.tear', impact: 'container.clang', heavyImpact: 'container.boom', debris: 'metal.impact.small', strain: 'container.groan', collapse: 'container.collapse' },
    steel: { break: 'metal.bend', impact: 'metal.impact.small', heavyImpact: 'metal.impact.large', debris: 'metal.impact.small', strain: 'container.groan', collapse: 'container.collapse' },
    cable: { break: 'metal.bend', impact: 'chain.rattle', heavyImpact: 'chain.rattle', debris: 'chain.rattle' },
    drum: { impact: 'drum.bonk', heavyImpact: 'drum.bonk' },
    ...
  },
}
```

- **container.boom will not play through `heavyImpact`.** DestructionSounds treats a piece as heavy
  when density × volume > 0.25, and the demo doesn't change that. With `container` at density 0.4,
  a side panel is ~0.06 and a corner post ~0.01. Tank shell segments at 0.5 are ~0.13. Play
  the boom from `onImpact` instead: when a container piece strikes faster than ~4 m/s and the
  world's container record says that box came down as a section, play `container.boom` once
  per box (a WeakMap of box → last time, 1.5 s apart) at the box's centre. Use
  `volume: Math.min(1.2, speed / 8)`, and pitch ~0.9 for a 40ft or ~1.05 for a 20ft. The simpler
  option is to map the container's `impact` itself to `container.boom` (hits are scaled by speed
  and mass, so light ones are quiet) and keep `container.clang` for cladding, doors and tanks.
- **water.lap** is a world loop. Start it once (on the first `update`) at a few points along the
  edge, e.g. `rt.sound.play('water.lap', { at: [x, -1.4, -30.3] })` for x = -24, 0, 24 (it has 4
  voices). Each starts at a random point in the loop, so they are not in step. Loops may start
  before the first click.
- **gulls.call**: `rt.sound.play('gulls.call', { at })` every 8–20 s, 25–50 m from the player and
  15–30 m up. It's on the ambience bus, so blasts duck it.
- **gulls.scatter** (stereo, head): `rt.sound.play('gulls.scatter', { delay: 0.3 })` in `onBlast`.
  It's on the sfx bus on purpose: the blast ducks the ambience bus just then. Its 25 s cooldown
  limits it to one every 25 s. The design's "only after 25 s of quiet" needs its own timer.
- **ship.horn**: `rt.sound.play('ship.horn', { at: [30, 6, -330] })`. It arrives ~1 s later
  (speed of sound) and the air takes its treble. It has 2 voices, so the double blast is two plays,
  the second with `{ delay: 6 }` (each take is a ~4 s blast and an echo).
- **water.splash**: `{ at: [x, -1.8, z], volume: 0.5 + 0.5 * Math.min(1, mass / 2), pitch: 1.2 - 0.35 * Math.min(1, mass / 2) }`.
- **chain.rattle** at the headblock on crane hits (it has its own 0.5 s cooldown; the design's 2 s
  needs the world's own timer).
- **Tank breach hiss**: no sound of its own. Try the base `rocket.loop` at `{ at, pitch: 0.55,
  volume: 0.5 }` (a steady jet roar, lower) under `fire.loop`. Its 4 voices are shared with
  rockets in flight, so stop it when the fire ends.
- The `play` values are in `index.json`. The harbor names don't clash with the base pack's, so
  `packSettings` doesn't override them. Change any of them in `audio.settings`.

## What I'd want changed outside this folder (not done)

- Let a world set DestructionSounds' `heavy` (per material, or through `WorldAudio`), so
  thin-skinned containers can boom through `heavyImpact`.
- An event when a bonded section lands (its pieces, total mass, speed), so a whole box booms once
  instead of each panel clanging.
- Pitch per material for shared sounds (the design's request 6).
- In `process-sounds.mjs`: an option to start a shot at its loudest onset (for break sounds that
  build up), and a way to skip a single slice of a sliced take.

## Spend

39 Stable Audio takes × $0.0376 = $1.47. Audio QA on 39 takes (billed at $0.01 per 5 s of audio)
= $0.58. Total ≈ $2.05, all in `ledger.jsonl` (`"by": "sounds"`).

## Phase F: the leaks and the fuel catching (6 takes, $0.23)

Three sounds for the yard's answers to the gun (`index.ts`), made with the pack's script and
levelled by `process-sounds.mjs` as the others were. No audio-model QA this time (not in the
phase's allowance): each take was checked by spectrogram and its loudness over time.

| Sound | Takes | How good | Notes |
|---|---|---|---|
| fuel.leak | 2 | 7/10 | A steady broadband pour with glugs around 0.8-1 kHz every few tenths of a second: reads as liquid running out of a hole. Both loop cleanly (7.3 s each). |
| drum.leak | 1 | 7/10 | A softer, thinner trickle and patter, 8-10 dB quieter than the tank's in the raw. |
| fuel.ignite | 1 of 3 | 7/10 | Takes 0 and 1, asked for "a whoomph, then the fire", came as a steady roar from the first instant (flat within 3 dB for 3.5 s): the base pack's `fire.loop` already does that, so both are left out (`skip.json`). Take 2, asked for silence then one whoosh-whump, has a soft hiss for 1 s, then a broadband burst 20 dB up with its low end lasting 0.8 s and a crackle tail; `onset` cuts it at the burst (2.3 s). |
