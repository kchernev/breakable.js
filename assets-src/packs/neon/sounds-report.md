# Neon Alley: sounds report

14 sounds, 43 files, 2.7 MB, in `public/packs/neon/sounds/` (`index.json` has the takes, lengths
and how each is played). The list is `scripts/assets/packs/neon/sounds.mjs`.

To rebuild them: `generate-sounds.mjs`, then `python3 -I scripts/assets/packs/neon/prep-sounds.py`,
then `process-sounds.mjs` (all with `PACK=neon`). The prep step synthesizes `neon.buzz`, cuts the
alarm bells to whole rings and equalizes the rain. It keeps each original as `<i>.full.flac` and can
be run any number of times. `skip.json` leaves out `rain.awning:0`.

## How they were checked

- Every take went through the audio model (`qa-sounds.mjs`, `assets-src/packs/neon/sounds/qa.json`).
  It is generous: it gave 10/10 to takes that were plainly wrong (a "constant buzz" that is 90% sub-bass,
  and alarm bells that stop ringing halfway through). So I also looked at every take's spectrogram and
  loudness over time.
- Loops: I checked the seams of the processed files for level jumps and clicks, and checked that the
  alarm bells' rhythm stays even across the seam (it does: 0.51 s and 1.03 s, every ring).
- In the engine: all 14 sounds loaded with the library's `SoundEngine` and `loadSoundPack` in Chrome
  (base pack first, as the demo does). I recorded a scripted 23 s scene from the engine's output:
  ambience, wet footsteps, a blast on a sign with breaks layered on it and the ambience ducked, the
  transformer blowing and the buzz stopping, then the alarm bell. The audio model heard every part
  and no seams, glitches, music or voices. It scored the scene 10/10, which I'd discount.
- I haven't heard any of this myself. The judgements below come from the spectra and the model.

## What there is, and how good it is

| Sound | Files | Length | Kind | Verdict |
|---|---|---|---|---|
| `ambience.rain` | 1 | 41 s loop, stereo | head | **Good.** Second take: the first had a drainpipe gushing in suddenly 10 s in. Equalized: the take was 70% between 80 and 320 Hz and turned the alley into a low wash under the city's traffic rumble. There's still a mild swell around 8 to 13 s. |
| `ambience.city` | 1 | 41 s loop, stereo | head | **Good.** Even distant traffic, the city's hum and a faint far train, with no rain in it. Heavy in the bass, as distant traffic is. Replaces the base pack's afternoon city. |
| `rain.awning` | 1 | 8.8 s loop | world | **Good**, but only one take. Take 0 was skipped: its water surges in a third of the way through, and a 9 s loop would repeat that. Loop voices start at random points, so one take is enough. |
| `neon.buzz` | 2 | 5.84 s loops | world | **Fair to good. This is the weakest for realism.** Synthesized, not generated: four Stable Audio takes in three wordings gave a sub-bass rumble, near silence with a whine, and bare crackle. The originals are kept in `neon.buzz/replaced/`. The buzz is a 100 Hz transformer hum with a rattling lamination, gas sizzle and crackle. The model heard take 1 as "the low-frequency buzz of a large neon sign up close" (9/10) and take 0 as "a large fluorescent ballast or a malfunctioning neon sign" (7/10). It called both too steady to be a recording. Each loop is 584 whole cycles, so it joins in step. |
| `neon.break` | 5 | 1.3 to 2 s | world | **Fair.** Short glassy pops and bursts with a shower of thin tinkle. The electrical fizz is faint in most. Takes 2 and 3 were redone (each was a single snap). Take 2 is still only a crack and tinkle (the model gave it 4/10). It works with `spark.zap` layered on it, as the design's reaction does. |
| `spark.zap` | 4 | 1.5 s | world | **Good.** Dense crackling arcs and snaps that cut off suddenly. Two have a low thump in them. No sci-fi zaps. |
| `transformer.blow` | 1 | 3.65 s | world | **Good.** A sharp bang, an arc buzzing for about 2 s, a second, heavier bang at 2.35 s, then dead (silent from about 2.85 s). New: it isn't in the design. |
| `shutter.rattle` | 4 | 2.5 s | world | **Good.** A crash, then slats clattering and settling. Take 3's biggest crash comes late, at 1.25 s. |
| `sheetmetal.impact` | 4 | 0.9 to 1.2 s | world | **Good.** A hollow, tinny bang and a short buzzy rattle. One take has a small bounce. |
| `tile.break` | 4 | 2.4 to 2.5 s | world | **Good.** A sharp crack, then brittle ceramic with ringing tile "tinks" and chips. Two takes have a second burst near 1 s. |
| `splash.debris` | 3 | 2 s | world | **Fair to good.** Wet splash and spatter. The "heavy thud" is light, with little low end. |
| `steam.hiss` | 1 | 7.3 s loop | world | **Good.** A soft, steady hiss with a faint rumble and drips. New: it isn't in the design. |
| `steps.wet` | 10 | 0.34 s slices | head | **Fair to good.** Clear separate boot steps with a small splash. Three slices start 70 to 100 ms before the main hit (a heel touch first). |
| `alarm.bell` | 2 | 3.07 s and 4.12 s loops | world | **Good.** Take 0 is a continuous harsh trill, take 1 rings and pauses about once a second (more like an old shop or school bell). Both takes stopped ringing after 5 to 7 s of their 10. Each is cut to 6 and 4 whole rings, so the loop keeps time. |

## What I'd redo, with more budget

1. `neon.buzz`: a real neon or ballast recording, or another sound model, if one does sustained
   electrical hum. Short of that, add a little air or room tone under the synthesis so it's less
   perfectly steady.
2. `neon.break:2`: one more take, for a sharper "pop" and some fizz.
3. `rain.awning`: a second take that stays even.
4. `splash.debris`: more weight (a thud under the splash).
5. `ambience.rain`: a take with no swell at all, if one comes.

## Spend

- Stable Audio 3 Medium: **40 takes** (the whole budget). The design's 33, then 5 redos
  (`ambience.rain:0`, `neon.buzz:0`, `neon.buzz:1`, `neon.break:2`, `neon.break:3`) and 2 new
  sounds (`transformer.blow`, `steam.hiss`). At $0.0376 each, that's $1.50.
- Audio QA (`fal-ai/audio-understanding`, $0.01 per 5 s of audio): 43 calls, $0.85. That covers
  every take, the synthesized buzzes (asked three times as they were tuned) and the recorded scene.
- **Total about $2.35.** Each call is a line in `assets-src/packs/neon/ledger.jsonl` (`"by": "sounds"`).

## For the builder

- `audio.packs: ['/packs/neon/sounds/']`. Every name the design's section 6 table uses exists, and
  `index.json` gives each one's `play` (volume, near, rolloff, voices, cooldown, bus, reverb,
  pitch).
- Materials and footsteps are exactly as in DESIGN.md section 6.
- `ambience.city`: the library's `packSettings['ambience.city']` (volume 0.35) overrides this pack's
  `play` (0.3), because `loadSoundPack` applies `packSettings` after a pack's own `play`. Set
  `audio.settings['ambience.city']` if you want it different.
- Ambience as in the design: rain at `volume: 1` (which multiplies the pack's 0.45), city, and wind at 0.5.
- **Loops placed in the world** all go on the `ambience` bus, so a blast ducks them with the rain:
  - `neon.buzz` at the 3 nearest lit signs: `rt.sound.play('neon.buzz', { at, fadeIn: 0.3 })`, then
    `voice.stop(0.3)`. It plays at volume 0.3, near 2, rolloff 1.4: about as loud as the rain right
    under a sign, and 5 dB under it 3 m off. The flickering sign can drive its voice with
    `voice.setVolume(envelope, 0.02)`. Stop the voices on blackout and start them again with the
    power.
  - `rain.awning` at the 2 nearest standing awnings: volume 0.5, near 2.5.
  - `steam.hiss` at the three vents: volume 0.4, near 2. While a vent gushes after a blast,
    `voice.setVolume(2.5, 0.2)`, then back to 1 over about 2 s.
  - `alarm.bell`: one at a time at the shutter, `voice.stop(0.3)` after 15 to 25 s, like the nyc
    car alarm.
- **`transformer.blow`** (new) for the blackout: play it once at the box, in place of the first
  `spark.zap`. To match it, have the neon stutter during its arc (0.4 to 2.3 s), go dark on its
  second bang at about 2.35 s, and stop the buzz then.
- `spark.zap` for dangling signs at `{ volume: 0.5 }`. Its cooldown is 0.08 s within 3 m.
- `neon.break` has priority 2: when too many sounds play at once, it keeps its voice.
- The base pack's `glass.debris`, `glass.shatter`, `metal.*`, `brick.*`, `concrete.*` and
  `collapse.rumble` are used as in the design. Nothing here replaces them.
