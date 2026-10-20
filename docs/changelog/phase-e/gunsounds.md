# The machine gun's sounds

Twelve new sounds in the base pack (`public/sounds/`, listed in `scripts/assets/sounds.mjs` under
"The machine gun, its casings and its bullets"): the gun's report, its echo, its reload and empty
click, brass casings, bullets striking six kinds of thing, and ricochets. Every world loads them
(the base pack always loads first). Their play settings are in the pack's `index.json` (`play`,
written from the list), so a world re-levels one with its `audio.settings`, as for any other sound.

## What there is

| Sound | Kind, space | Files | Length | What it is |
|---|---|---|---|---|
| `gun.shot` | shot, head | 8 | 0.62–0.84 s (sounds for 0.32–0.48 s) | One close rifle report: a crack, a deep thump, the action's clack 0.1 s in. Starts at its crack, faded out over its last 0.5 s. |
| `gun.tail` | shot, head | 3 | 1.88–2.44 s | The echo off the street: a rolling rumble with slaps off the walls, gone by ~1.7 s. Starts after a shot's crack, faded in over 25 ms. |
| `gun.reload` | shot, head | 2 | 1.82–1.98 s | Laid out on the gun's 2 s reload: the release clicked and the magazine pulled free by 0.57 s, the new one seated at 1.42, the handle pulled at 1.53 and let go at 1.74–1.84. |
| `gun.empty` | slice, head | 2 | 0.33 s | One dry click of the trigger on an empty chamber. |
| `casing.drop` | slice, world | 14 | 0.26–0.34 s | One brass casing tinkling on pavement. |
| `bullet.brick` | slice, world | 8 | 0.29–0.33 s | A sharp, dry crack and a burst of chips. |
| `bullet.concrete` | slice, world | 9 | 0.28–0.33 s | A hard snap of stone and a spray of grit. |
| `bullet.metal` | slice, world | 10 | 0.29–0.33 s | A hard, bright spang on thick steel. |
| `bullet.wood` | slice, world | 9 | 0.24–0.33 s | A solid thunk with a crack of splinters. |
| `bullet.glass` | slice, world | 8 | 0.23–0.33 s | A sharp crack and a small, quick shatter. |
| `bullet.dirt` | slice, world | 12 | 0.23–0.33 s | A soft thud and a short spray of soil. |
| `bullet.ricochet` | shot, world | 3 | 1.50 s | A ping off stone and a whine flying away. |

0.53 MB of MP3 (the base pack is 4.9 MB). The 31 sounds that were there are untouched (their
files and their `index.json` entries are as they were).

## Playing them

The demo does it all (`src/demo/audio.ts`, `src/demo/gun.ts`, `DestructionSounds.bullet`). For
your own code, by name, with these defaults (each sound's `play`; a world's `audio.settings`
overrides any of it):

| Sound | volume | near / rolloff | voices | cooldown / spacing | pitch | bus | reverb | priority |
|---|---|---|---|---|---|---|---|---|
| `gun.shot` | 0.3 (the demo plays it at half: 0.15) | (head) | 4 | – | 0.97–1.03 | sfx | 0.2 | 1 |
| `gun.tail` | 0.065 | (head) | 1 | – | 0.95–1.05 | sfx | 0 | 1 |
| `gun.reload` | 0.3 | (head) | 1 | – | 1 (never shifted) | sfx | 0.1 | 2 |
| `gun.empty` | 0.22 | (head) | 1 | 0.12 s | 0.94–1.06 | sfx | 0.05 | 1 |
| `casing.drop` | 0.15 | 1.5 / 1.5 | 3 | 0.1 s / 1 m | 0.9–1.12 | debris | 0.1 | 1 |
| `bullet.brick` | 0.215 | 6 / 0.8 | 4 | – | 0.9–1.1 | sfx | 0.25 | 1 |
| `bullet.concrete` | 0.365 | 6 / 0.8 | 4 | – | 0.9–1.1 | sfx | 0.25 | 1 |
| `bullet.metal` | 0.13 | 6 / 0.8 | 4 | – | 0.9–1.1 | sfx | 0.25 | 1 |
| `bullet.wood` | 0.235 | 6 / 0.8 | 4 | – | 0.9–1.1 | sfx | 0.25 | 1 |
| `bullet.glass` | 0.34 | 6 / 0.8 | 4 | – | 0.9–1.1 | sfx | 0.25 | 1 |
| `bullet.dirt` | 0.365 | 6 / 0.8 | 4 | – | 0.9–1.1 | sfx | 0.25 | 1 |
| `bullet.ricochet` | 0.13 | 6 / 0.8 | 2 | 0.2 s / 4 m | 0.85–1.15 | sfx | 0.3 | 1 |

```ts
// Each round: the report at once, in the head (at half its pack level, as the demo has it); the
// strike where it struck (DestructionSounds.bullet picks bullet.<kind> from the material); a
// casing at the feet now and then, as it lands
engine.play('gun.shot', { volume: 0.5 });
sounds.bullet(hit.at, hit.material, hit.kind, glance);
engine.play('casing.drop', { at: feet, delay: 0.45 });
// The burst ends (trigger let go, magazine empty): the echo, longer bursts louder
engine.play('gun.tail', { volume: Math.min(1, 0.4 + rounds / 20) });
// The reload begins (its moves come at the gun's own moments), the trigger pulled on an empty gun
engine.play('gun.reload');
engine.play('gun.empty');
```

- **One level for the gun.** The demo plays `gun.shot` at half its pack level (`SHOT` 0.5 in
  `src/demo/audio.ts`: at the pack's 0.3, a burst at a wall was louder than a blast 20 m off), so
  every other sound of the gun is levelled to the shot as heard there, 0.15. Folding `SHOT` into the
  pack is two lines that go together: `gun.shot`'s `volume` 0.15 in the list (then
  `process-sounds.mjs --only gun.shot`, no paid call, the files don't change) and `SHOT` gone from
  audio.ts. Either alone leaves the shot at half or double what it is now, the echo and strikes
  6 dB too loud or too quiet against it.
- **The echo needs no offset.** Every take's first 60 ms (a shot's crack: the model makes no echo
  without one) are cut and the rest faded in over 25 ms, so it can start with the last round or a
  frame after it and still sound like the street ringing, not one more round.
- **One voice for the echo.** A new burst's tail takes the voice from the last one (it's louder:
  the old one has faded), so quick taps each get their echo and never stack.
- **The reload is timed.** Played as the reload begins, its moves land on the view model's: the
  magazine out (0.25–0.55 s in gun.ts), seated (1.42), cocked (1.52); it's over before the gun can
  fire again (2 s). It's never pitched (`pitch: [1, 1]`), so the timing holds.
- **A world's own bullet sound.** `MaterialSounds.bullet` (the weapons team's field) names the
  sound for a material, and `pitch: { bullet }` pitches it: `bronze: { ...packMaterials.metal,
  bullet: 'bullet.metal', pitch: { bullet: 0.85 } }`. Without it, `materialKind` picks the kind.

## Why these settings (a burst at 11–12 a second)

- **Shots never pile up.** Each shot is faded out by its end (0.62–0.84 s; 20 dB down by ~0.28 s),
  and `voices: 4` holds it to the last four: the fifth takes the voice of the oldest, which has the
  least left of it. No shot was turned away (62 of 62 in each of the six worlds).
- **They're even.** All eight files peak at -0.7 to -1.4 dBFS (levelled by their loudest 400 ms,
  never past -1 before encoding); their loudest 400 ms span 2.9 dB (-13.0 to -15.9 LUFS, max
  momentary). Each is within 10 dB of its loudest 5–10 ms in; the sample peak itself, the thump
  under the crack, comes at 13–36 ms. In a burst the rounds' peaks vary by 1.0–1.6 dB (standard
  deviation). Pitch varies ±3% only: a rifle is the same rifle every round.
- **A burst sits well under the launcher.** As the demo plays it, a burst is M -21 (the launcher's
  shot -11, footsteps -30): it goes on for as long as the trigger is held, so it mustn't drown the
  world.
- **The echo carries the burst off, under it.** At 0.065 (and 0.4 + rounds / 20 of that, through
  the world's reverb at 0.45 as the demo sends it), the 1/11 s windows after the last round fall
  5–6, 7–8, then 9–12 dB under a round: no louder than a burst's own decay (4–6, 9–10, 12–17 dB
  down) at first, then ringing on where that dies. The 2.5 s after are M -29.5, 8 dB under the
  burst. At 0.19 (before) the echo came in at a round's level, like three or four more rounds.
- **The strikes carry, but never over the gun.** Full volume within 6 m, then the inverse distance
  (rolloff 0.8). Each material's `volume` levels them to about -37 LUFS at 15 m, -44 at 40 m. At
  3 m a strike is 1–4 dB under a shot, and a stream of them 3–4 dB under the burst: a hit at your
  feet shouldn't outdo the rifle at your shoulder. Each starts where it rises (`onset: 20`), most
  within 10 dB of their loudest 5–20 ms in, so a stream at 11 a second keeps time with the sparks;
  three dirt and wood hits swell over 25–30 ms, and two glass hits keep a small tick 45–60 ms
  before their crack (a pane is shot once, and the crack is right behind it). On the sfx bus, so a
  rocket's duck of the debris bus doesn't take them away.
- **The reload and the click sit under the rounds.** The reload's loudest moment (the handle let
  go) peaks about a round's peak (-17.5 against -16 to -17 dBFS) and is M -29, as the footsteps;
  it never lands in a burst. The empty click is one click now (both takes came as two: the slicer
  keeps the second, whole one), M -31.
- **Casings are a garnish.** At the feet, M -36 to -40 (footsteps are -30), on the debris bus, at
  most one every 0.1 s within a metre (the demo throws one in three or so). They're heard after the
  burst, under its echo.
- **Ricochets are rare and short-lived.** One every 0.2 s within 4 m at most (the demo asks for 8%
  of stone strikes and 18% of metal ones, more when glancing); 3 m off, M -33, under the strike.
- **It doesn't starve the rest.** The gun's sounds take at most 13–14 of the 40 voices (shots 4, a
  material's strikes 4, casings 3, ricochets 2, the echo 1). The engine doesn't play a one-shot
  30 dB under the loudest sound lately: the strikes are half what they were and the echo a third,
  so they turn away less (a falling brick was heard 60 m off through a burst with the shot at
  twice this level and the strikes at four times). A short
  tap's echo (0.4 + 2/20 of 0.065) right after something loud can be turned away itself (1 of the
  18 asked for in the six worlds, after a wall gave way), which is fine.

## Measurements

Recorded from the engine's `output` in Brick Street (Chrome on a virtual display, muted; the
demo's own engine and settings, its ambience turned off; loudness by ffmpeg's ebur128: max
momentary M, true peak TP; peaks are 5 ms RMS). Rounds scheduled exactly, 22 at 11 a second, the
shot as the demo plays it (0.15); three runs of each.

| | M | TP |
|---|---|---|
| One shot (by take) | -26.6 to -29.7 | -14.4 to -15.1 |
| 22 rounds | -20.9 to -21.3 | -10.2 to -11.0 |
| The 2.5 s after: with the echo / without | -28.8 to -29.6 / -30.4 to -31.8 | |
| 22 rounds at a wall 3 m off (shots and strikes, by material) | -19.4 to -19.9 | -6.7 to -9.9 |
| 22 strikes alone at 3 m (by material) | -24.1 to -25.3 | |
| Reload / empty click / four casings | -28.5 to -29.3 / -30.8 / -35.7 to -40.3 | -7.8 / -10.2 / -16.5 |
| The launcher, four footsteps (for scale) | -11.2, -29.9 | |
| Real bursts (`demo.fire(22)`) at a brick wall 4 m off: shots, strikes, both | -20.9, -27.8, -20.2 | |
| Dust Town (its longer reverb): 22 rounds; the 2.5 s after with the echo | -20.6 to -21.3; -28.2 to -29.9 | |

The end of a burst (the peak of the last round and of each 1/11 s after it, against the median
round):

| | Last round | The three 1/11 s after |
|---|---|---|
| No echo | -0.9 to +2.5 | -4 to -6, -9 to -10, -12 to -17 |
| Echo 20 ms after the last round (the trigger let go) | -0.2 to +0.3 | -5 to -6, -7 to -8, -9 to -12 |
| Echo with the last round (the magazine empty) | -0.8 to +1.7 | -4 to -5, -5 to -8, -9 to -13 |
| Real bursts, everything (strikes, casings, the echo) | | -3 to -4, -6 to -9, -10 to -12 |
| Before the fix (echo at 0.19, its crack in; the review's reading) | +2.8 to +4.7 | 0 to -2 |

Strikes alone, four hits each (M):

| | 3 m | 15 m | 40 m |
|---|---|---|---|
| brick | -29.9 | -37.7 | -45.5 |
| concrete | -31.4 | -37.3 | -45.9 |
| metal | -31.0 | -37.5 | -44.9 |
| wood | -30.5 | -37.5 | -45.0 |
| glass | -29.7 | -36.1 | -44.0 |
| dirt | -28.9 | -35.7 | -43.1 |
| ricochet | -32.8 | -39.4 | |

Single readings of four random hits vary by ±1.5 dB from run to run. The reload, holding the
trigger through a magazine in Brick Street: it played 1.82 s at once as the reload began, the gun
reloaded for 2.03 s and fired again 2.00 s after the sound began; its loudest moment, -17.7 dBFS,
came at 1.72 s (the rounds before it peaked at -14.4 to -20.3).

Each set's files, levelled by the pipeline, span (max momentary of each, padded): shots 2.9 dB,
echoes 0.3, reloads 0.3, clicks 2.5, casings 6.7, brick 5.1, concrete 3.6, metal 6.4 (one ping 3 dB
under the next quietest), wood 2.6, glass 4.5, dirt 5.0, ricochets 4.1. Every world (all six)
loads all twelve with no errors or warnings and plays them through a burst, a magazine and a
reload; the sound browser (`sounds.html`, base pack) plays every take of each with no errors.
`tests/gunsounds.test.ts` checks the pack has every sound the gun and its bullets play (a strike
for every `MaterialKind`, at least eight of each) and that the reload ends inside the gun's.

## How they were made

Stable Audio 3 Medium, 42 takes (of the 48 allowed), the audio QA after each round
(`qa-sounds.mjs`), then an audio-model check of each finished sound (its files joined, 0.6 s
apart): every set came back "consistent, none odd", 10/10 (the ten metal strikes once as "a
click like a switch", 3/10; asked again, and each half on its own, "a sharp metallic spang",
10/10; the brick, concrete, glass and dirt strikes, only cut to their rise since, weren't asked
again). Paid calls in `assets-src/sounds/ledger.jsonl`: 42 takes ($1.58) and 66 checks ($1.01,
of which 6 ($0.06) were lost: a run cut off before it saved its answers), $2.59 in all.

- **Shots**: first asked for as takes of single shots a second apart, to slice; the model put two
  or three shots in ten seconds. Then as eight one-second takes of one shot each (`onset: true`,
  `fade: 0.5`): all eight "a sharp crack and deep thump, the action's clack at 0.1 s", 10/10.
- **The echo**: asked for as a burst's echo, every take began with a burst of four or five
  rounds. Asked for as the echo alone (with gunshots in the negative prompt), each begins with
  one crack, then the rolling decay: the model doesn't make one without the other, so the crack's
  60 ms are cut (`start: 0.06`). Checked after: "all begin only with the echo".
- **The reload**: two takes of the whole reload, 2.5 s, its handle let go at 2.3 s. Each take's
  moves are cut out and laid on the gun's moments (`parts`: from, to, where, in seconds), the
  pauses between them shortened. Take 0 keeps its click, scrape and pull-free as they were, its
  seat moved 50 ms earlier, and pull and let-go brought 0.25 and 0.52 s forward (a knock between
  them left out); take 1's click and scrape 0.1 s later, its seat 0.22 s later, the handle 0.68 s
  earlier (a few soft taps left out).
- **The click**: each take came as two equal clicks 0.19–0.28 s apart. Sliced (`kind: 'slice'`,
  `onset: 20`): the slicer finds no rise at a take's very start, so each gives its second click,
  whole. Checked after: "one click" each.
- **Strikes and casings** are `slice` takes (8 s of single hits), so a take gives up to ten of
  them. The grit after a hit comes out as a slice of its own, 10–50 dB under the hit: those are
  left out by `assets-src/sounds/skip.json` (by each slice's peak and RMS against the take's hits),
  with three casings far louder or quieter than the rest. A slice is a third of a second from just
  before its onset, faded over its last 0.12 s; strikes then start where they rise (`onset: 20`:
  10 of 47 had up to 0.1 s of hiss first). A hit at the very start of a take isn't found (the
  slicer needs a rise), so a few takes lost their first.
- Redone: `bullet.metal:0` (rang "like a cowbell"; new prompt, its redo uneven and left out; a
  third seed gave five bright pings and two duller ones, all kept), `bullet.dirt:1` (once "wet and
  fleshy", once "a crack like breaking glass"; a firmer prompt the third time, 9/10),
  `bullet.ricochet:0` (its wide whine lost 7 dB folded to mono). `bullet.wood` got a second take
  (four thunks, 9/10). Each take's own prompt and seed are in its `.json`; the list's comments say
  where a take was made from an earlier prompt.

`process-sounds.mjs` gained three things for these (`scripts/assets/sound-cut.mjs` has `place()`):

- `start: s` (shots): that many seconds off the front once the silence is cut, faded in over 25 ms.
- `parts: [[[from, to, at], …], …]` (shots, a list for each take): those stretches of the take laid
  down at those times, each faded in and out over 5 ms, instead of trimming it.
- `onset` on a slice sound: each slice cut to its rise, as a shot is (`onset: 20`: where it first
  comes within 20 dB of its loudest 50 ms, from 5 ms before).

To redo or extend (base pack, so no `PACK`): `FAL_KEY=… node scripts/assets/generate-sounds.mjs
--only gun.shot` (or `--redo gun.shot:3`), `… qa-sounds.mjs --only gun.shot`, then
`node scripts/assets/process-sounds.mjs --only gun.shot,…`. Always pass `--only`: without it the
scripts go over the whole pack (QA for the old takes that have none, every sound processed again).
A new slice take's slices are listed by the processing log: add its grit to skip.json.

## What each world should do

Nothing is needed: the sounds load everywhere and `materialKind` picks a strike for every
material. What's worth a line in a world's `audio.materials` (`bullet`, and `pitch: { bullet }`),
from what each world's materials get now:

- **Brick Street**: as it should be (its `earth` already says `bullet.dirt`, asphalt is concrete).
  `plaster` cracks as brick; `bullet.concrete` at `pitch: { bullet: 1.1 }` is closer. `foliage`
  thunks as wood: `bullet.dirt` at 1.3 (a soft rustle-thud) or nothing louder.
- **Market Town**: `bronze` is heard as concrete: `bullet: 'bullet.metal', pitch: { bullet: 0.85 }`.
  `hay`, `cloth`, `produce` thunk as wood: `bullet.dirt`. `tile` is concrete; `bullet.brick` at 1.15
  fits roof tiles. Cobbles (when its ground is breakable): `bullet.brick` or `bullet.concrete`.
- **Dust Town**: `bronze` as metal (above); `hay` as `bullet.dirt`. Its ground is dirt (from its
  footsteps), so the casings land in sand: `audio.settings: { 'casing.drop': { volume: 0.07 } }`.
  Its reverb rings longer: the echo is a dB or two louder there after a burst, as it should be.
- **Neon Alley**: `awning` (cloth) and `lantern` (paper) thunk as wood: `bullet.dirt` at 1.2 for
  both. Wet asphalt is concrete, as it should be.
- **Harbor Yard**: as it should be (its steel is metal). `cardboard` is wood; `bullet.dirt` at 1.2
  is softer.
- **Sun Temple**: `marble`, `drum`, `triglyph`, `ruin` crack as brick: `bullet.concrete` at 1.1 is
  closer to marble. `terracotta` shatters as glass: `bullet.brick` at 1.2 for pots (it does break at
  the first hit, as glass, since it shatters). Its gravel ground (when breakable) is `bullet.dirt`.

A world that wants the gun quieter or the street drier changes the sounds in its `audio.settings`
(`'gun.tail': { volume: 0.04 }`; `'gun.shot': { volume: 0.25 }` is heard at half that, as the demo
plays the shot), as for any sound; keep the echo's first 1/11 s 4–6 dB under a round, and the
strikes 3 m off 1–4 dB under a shot.
