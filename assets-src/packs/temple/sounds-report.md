# Sun Temple sounds: report

13 sounds (the 12 in DESIGN.md section 6, plus `sea.splash`), 43 files, 2.6 MB, in
`public/packs/temple/sounds/` with `index.json`. The list is
`scripts/assets/packs/temple/sounds.mjs`. Every take was generated with Stable Audio 3 Medium.

## Spend

| What | Calls | USD |
|---|---|---|
| Stable Audio takes (34 planned + 2 for `sea.splash` + 1 redo) | 37 of 40 | 1.39 |
| QA with `qa-sounds.mjs` ($0.01 per 5 s of audio) | 37 | 0.73 |
| Second opinions (the same model, asked a question specific to the sound) | 13 | 0.15 |
| Total | | 2.27 |

Each call has a line in `assets-src/packs/temple/ledger.jsonl` (`"by": "sounds"`). 3 takes of the
budget are left.

## How it was checked

- The QA model's answers are in `assets-src/packs/temple/sounds/qa.json`. It is generous and noisy:
  it gave `collapse.marble:2` a 1 ("a wooden creak, a door closing"), then 10 when asked again
  ("almost exclusively stone, a huge resonant thud"). Where a verdict mattered, I asked again with a
  question specific to the sound, and checked against a spectrogram and level plot of each take.
- Loudness of every processed file (EBU R128) was compared with the matching sounds in the base
  pack, and the play volumes were set from that.
- In Chrome (on a virtual display, muted), I loaded the pack with the library's own
  `loadSoundPack` after the base pack. Every file decodes at its exact length, and the loop ends
  match in level with no padding at the seam. I then recorded a scripted sequence played by
  `SoundEngine` (both loops, then each sound at a few metres, then the splash 85 m away and 62 m
  below) and checked that recording.

## Each sound

| Sound | Kept | Verdict |
|---|---|---|
| `ambience.cicadas` | 1 of 2 | **Good.** A dense cicada band at 4-8 kHz that swells in slow waves, with a warm breeze under it. QA 10. The seam is clean. Take 1 (also QA 10) is left out (`skip.json`): the pipeline levels a take by its loudest moment, so it came out 3 LU louder than take 0, and a one-voice bed shouldn't change level from one page load to the next. The swells repeat every 41 s, which an attentive listener may notice. |
| `ambience.coast` | 1 of 2 | **Good, if plain.** A gusting breeze over dry grass, with a soft wash of distant waves now and then. It has no insects in it (they are in the negative prompt), so silencing the cicadas really empties the place. Take 1 was a constant engine-like hum (QA 1), so it is skipped. |
| `marble.break` | 4 | **The weakest of the stone set: adequate.** A crack with some body, then a few chunks and grit. Second opinions call it "stone or thick ceramic, medium weight" (7-9 of 10), not the heavy split I asked for. Take 0 came from the first prompt and is the thinnest. Take 3 is a redo; the original was "wet squishy" or "plastic and paper". To add weight, its play pitch is [0.88, 1.04] and its volume 0.85. Since it plays on every fracture, medium weight is acceptable. |
| `marble.impact.large` | 4 | **Good.** A deep thud with a hard stone clack, then a short roll and grind (QA 7, 10, 10, 10). This is the drum sound. Take 3 is about 5 LU quieter (a lighter hit), which gives some variety. |
| `stone.grind` | 3 | **Good.** A low, slow grind of stone on stone with a crack and trickling grit, 2.6 s each (QA 10 for all). |
| `collapse.marble` | 3 | **Good.** 6-7 s of crashing drums and beams, grinding and a fading rumble. Take 1 is about 6 LU quieter than take 0. |
| `tile.shatter` | 4 | **Good.** A dry ceramic smash, then shards skittering, 1-1.9 s (QA 10 for all; heard as ceramic, not glass). The files sit about 5 LU under the base pack's `glass.shatter`, so the volume is 0.75 (the design had 0.65). |
| `tile.debris` | 3 | **Good.** Dry clay clinks and a short rattle. |
| `bronze.clang` | 3 | **Good, a little bell-like.** A loud clang with a long ring of strong partials (that is the material). Take 2 is lighter and higher (QA 5: "more a bell than a shield"). It suits the tripods better than the door; I kept it for variety. |
| `foliage.break` | 3 | **Good.** A woody crack, then rustling leaves and twigs (QA 10 for all). |
| `birds.scatter` | 2 | **Adequate.** Wings and alarmed jackdaw calls, flying off over about 3.3 s (QA 10). The calls are evenly spaced (about every 0.45 s), so they can read as one bird repeating, and the wings are quieter than the calls. |
| `steps.gravel` | 1 take, 10 steps | **Good.** Crunching steps on gravel; each slice holds one step. Two of the ten are more rustle than crunch. |
| `sea.splash` (extra) | 2 | **Adequate, untested in the world.** A deep plunge and splash at about 0.5-1 s over a bed of sea wash (QA 8, 7), recorded close: the engine's distance and air make it far. Played 85 m away and 62 m below in the engine test, it came through as a low thump clearly above the ambience. The 0.4 s of water before the plunge doesn't matter at that range. DESIGN.md doesn't list it; it is meant for section 7's "Splashes". |

## What I'd redo

1. `marble.break`: a heavier set. The model keeps giving a crack plus a few clicks. A prompt about a
   sledgehammer splitting a boulder, or layering a thump under the existing takes, might work.
   The 3 takes left in the budget would cover it.
2. `birds.scatter`: one take with more wing flutter and fewer, less regular calls.
3. The levelling of loops (a pipeline change, not mine to make): level loops by integrated loudness,
   not by their loudest 400 ms. Both cicada takes could then be used.
