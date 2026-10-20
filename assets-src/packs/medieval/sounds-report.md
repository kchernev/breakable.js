# Market Town: sounds report

What the sound pass made for `PACK=medieval`, how good each sound is, and what I'd redo.

- **Made:** 13 sounds, 36 takes in the pack (`public/packs/medieval/sounds/`, 2.3 MB), as in DESIGN.md §7.
- **The list:** `scripts/assets/packs/medieval/sounds.mjs`.
- **Raws:** the raw takes are in `assets-src/packs/medieval/sounds/`. Takes left out of the pack are listed
  in its `skip.json`. Replaced takes are kept in `assets-src/packs/medieval/sounds-rejected/`, as `<i>.r<round>`.
- **Spend:** 40 Stable Audio takes (the whole budget, $1.50) and 45 audio-understanding calls ($0.84), about
  $2.34 in all. The calls are logged in `ledger.jsonl` (`"by":"sounds"`).

## How it was checked

- **Two checks per take:** each take went through `qa-sounds.mjs` and through my own look at it: loudness
  over time, a log spectrogram, clipping, how it sums to mono, and partials for the bells.
- **Where QA was unreliable:** the QA model is good at catching the wrong kind of sound (a campfire, pouring
  liquid, a person imitating a hen) and bad at timing. Twice it put "the hit at 0 s" on takes whose loudest
  moment was 1.2 to 1.5 s in. I measured where every impact and break peaks, and dropped or redid the late ones.
- **In the engine:** the finished pack was loaded into the library's `SoundEngine` in Chrome on the virtual
  display (muted), next to the base pack. I played a scripted half-minute from the player's start and recorded
  the engine's output:
  - the evening bell three times;
  - a blast on the wall with pigeons, hens, stone, tiles and timber;
  - a hit on the tower with the bell swinging, coming loose and landing.

  All 13 sounds loaded, and every call played: none was culled by the engine's window after a blast. The
  bell stands 10 to 17 dB over the ambience at the start.

## Each sound

| Sound | In pack | Grade | Notes |
|---|---|---|---|
| ambience.birds | 1 × 36 s loop | good | Steady songbirds and swallows, a breeze. Clean seam. One take, so its phrases come round every 36 s. I left the rooster out on purpose: a crow in a loop gives the loop away. |
| ambience.market | 1 × 36 s loop | fair | Indistinct murmur and footsteps on cobbles. Asked twice: no intelligible words, no music, no bells. One brief distant laugh at ~25 s. The cart, hooves and anvil in the prompt didn't come through, so it reads as "people in a square" more than "market". Round 1's take had the whole crowd go "ooh" near the seam and was replaced. |
| bell.toll | 2 × ~7.5 s | good | One strike, inharmonic bell partials (a real bell, not a synth tone), a long hum. The two kept takes share their partials (124, 141, ~330, 553 Hz), so random takes sound like one bell. Raw take 1 was a lower bell (a 111 Hz hum) and is skipped, so the evening bell and the swinging don't jump between two bells. |
| bell.clang | 2 × ~3 s | fair | A crash, a bounce (take 0), then a harsh, dying ring with strong partials at 2.6–3.3 kHz, lower than the toll. QA heard "a clean bell strike" in all four tries (two prompts), so the crash is shorter than it should be. Layer it (see the notes for the builder). |
| stone.break | 3 | good | Two takes (round 2 and 3 prompt) are heavy and low: a rock crack, then chunks grinding. The third (round 1) is brighter and grittier, which adds variety. Round 1's other two sounded like a campfire and were replaced. |
| stone.impact.large | 2 | good, but few | Both hit at once with a deep thud and a crunch. Only two takes for a sound collapses play a lot. Raw take 1 has 30 clipped samples at the hit (under 1 ms). One take was pouring liquid, two had their hit a second late. |
| timber.crack | 3 | good | All redone: crack at 0 s, then splinters for 1–1.6 s. Round 1's three all had the crack 0.85–1.85 s in. |
| timber.groan | 2 | fair to good | Take 1: a deep groan with peg pops. Take 0: a pop and a shorter groan (QA 3, but "yes, believable" when asked directly). |
| tile.clatter | 3 | good | A rattling slide, then a smash and shards, ~2.4 s. |
| tile.impact | 4 | good | A sharp ceramic crack at once, shards skittering. Take 1 is more a clatter of pieces, which suits debris. |
| birds.scatter | 2 | good | A burst of wings flying off, fading over 3.5 s. Wings only: alarmed pigeons hardly coo, and coos read as voices. |
| chickens.startle | 1 | fair | Real-sounding panicked hens. Raw take 0 was a person imitating a chicken and is skipped, so it's the same take every time. |
| steps.cobble | 10 steps | good | Ten clean heel-and-toe steps on stone, cut from one take. |

## Phase F: two sounds for the reactions to the gun

- **Made:** `bell.ping` (2 takes, 4 s) and `sign.creak` (2 takes, 3.5 s), 4 Stable Audio takes ($0.15,
  `"by":"phase-f reactions"` in `ledger.jsonl`). No audio-understanding calls this time: each take was checked by
  its envelope, a log spectrogram and, for the bell, its partials.
- **bell.ping:** asked as a hammer on the bell's lip (the strike and the ring, no gunshot in the take). Both takes
  strike at once (the peak at 0.03 and 0.06 s), bright (a spectral centroid of 2.0 and 2.7 kHz in the first
  0.1 s), fall 30 dB in 0.4 s and hum on for 2.5–3 s. Their partials (139, 309, 371 Hz; 139, 170, 339, 525 Hz)
  sit with the toll's (124, 139–142, 300–338, 553 Hz), so a ping and the soft toll a round adds read as one bell.
- **sign.creak:** creaks with a harmonic stack (a squeak at 700–800 Hz and its overtones) in bursts at 0, 0.6,
  1.6 and 2.0 s (take 0) and through the first 1.2 s (take 1), with knocks under them.
- **Levels** (the engine's output recorded in Chrome, muted, each sound alone where the game plays it): from the
  square 20 m from the bell, the loudest 400 ms of the shot is -27 to -28 dB, of the bullet's strike on the bell
  -31 to -34, of `bell.ping` at 0.25 -24 (at 0.5 it was -19, well over the shot), of the toll at the round's 0.2
  -24. 5 m from a sign, where the market and the birds' loudest 400 ms is -30 to -32, a bullet into wood is -30,
  `wood.impact` -29, `sign.creak` at 0.9 × 0.75 (a swing's) -29 and at 0.9 -25 (at 0.5 × 0.75 it was -31, lost
  under the ambience).

## What I changed from the design, and why

- **market volume 0.22 → 0.4:** its file came out ~6 dB under the birds', because a hoof hit the
  peak limit while it was levelled. At 0.4 it sits ~4 dB under the birds, about where the wind is.
- **chickens.startle near 4 → 6, rolloff 0.8:** the coop is ~11 m from the start. At near 4 it was quiet
  next to a blast's tail.
- **birds.scatter spacing 60:** one flock per 5 s anywhere in town, not one per blast spot.
- **tile.impact 1.5 s, rolloff 1.2:** the generator does better at 1.5 s than at 1.2 s. The rolloff 1.2
  matches the base brick.impact.small.
- **Prompt changes:**
  - The prompts avoid "medieval", "tavern" and "church music".
  - bell.clang avoids "church bell".
  - stone.break asks for weight, not "crackling grit".
  - stone.impact.large and timber.crack ask for the hit first.

## What I'd redo with more takes

1. **bell.clang:** a crash take with no bell word in the prompt, to layer under this one. Better still, an
   audio-to-audio pass from the toll, so the landing bell rings at the toll's pitch.
2. **More takes** of stone.impact.large (it plays often) and chickens.startle (one take repeats).
3. **The market:** two takes of crowd murmur only, and the hooves, a cart and an anvil as rare one-shots the
   world places around the square. A loop can't hold occasional events without giving itself away.
4. **Plaster (daub) breaking:** a dry, soft crunch with hazel rods snapping. The plaster now uses the base
   brick.break, which is harder and brighter than daub.
5. **A rooster crowing once,** as a world-placed one-shot near the coop at the start.

## Notes for the builder

- **Loops:** start them yourself and keep the voices. `rt.sound.play('ambience.birds')` and
  `('ambience.market')` with no `at` (head space). Their bus, volume and loop come from `index.json`.
  - Duck with `voice.setVolume(v, seconds)`, where `v` multiplies the index volume.
  - Restart the market with `fadeIn: 15`.
  - Both return null until audio is unlocked, so keep trying in `update`.
- **bell.toll:**
  - The two takes are one bell, so random takes are right.
  - It is long (7.5 s), so the evening bell's 4 s spacing and the swing's 1.7 s overlap, as a real bell's would.
  - Coming loose: `pitch: 0.92`.
  - `take` indexes the files in the pack (0, 1), not the raw take numbers.
- **bell.clang:**
  - It plays as bronze's `impact`/`heavyImpact` (DESIGN §7).
  - On the bell's first strike over ~4 m/s, also play the base `metal.impact.large` at the same spot (volume ~0.8),
    and `stone.impact.large` for the cobbles. That gives the crash this sound is short of.
- **The window gate:** the engine decides whether a sound is heard (the 30 dB window under the latest loud sound)
  when `play()` is called, not when it starts. A `delay` doesn't save a quiet sound right after a blast. With
  these settings, the pigeons (heard ~0.58) and the hens (~0.38 at the coop) clear it right after a blast near
  the player.
- **Footsteps:** `footsteps: { hard: 'steps.cobble' }`. Rubble and landing stay on the base `steps.rubble` and `player.land`.
- **Material sounds:** as in DESIGN §7. All the base sounds it names exist.
- **Sizes:**

  | Sound | Size | Takes | Length |
  |---|---|---|---|
  | ambience.birds | 720 KB | 1 | 36 s, stereo |
  | ambience.market | 796 KB | 1 | 36 s, stereo |
  | bell.toll | 84 KB | 2 | ~7.5 s |
  | bell.clang | 48 KB | 2 | ~3.1 s |
  | stone.break | 88 KB | 3 | |
  | stone.impact.large | 48 KB | 2 | |
  | timber.crack | 60 KB | 3 | |
  | timber.groan | 64 KB | 2 | |
  | tile.clatter | 100 KB | 3 | |
  | tile.impact | 56 KB | 4 | |
  | birds.scatter | 76 KB | 2 | |
  | chickens.startle | 36 KB | 1 | |
  | steps.cobble | 84 KB | 10 steps | stereo |
  | bell.ping | 34 KB | 2 | ~3.3 s |
  | sign.creak | 49 KB | 2 | 3.5 s |

  World sounds are mono.
