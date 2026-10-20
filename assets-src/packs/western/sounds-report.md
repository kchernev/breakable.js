# Dust Town sounds: report

What I made for `PACK=western`, how good each sound is, and what I'd redo. The list is
`scripts/assets/packs/western/sounds.mjs`, and the finished pack is `public/packs/western/sounds/`
(13 sounds, 39 files, 1.7 MB). It loads as `audio.packs: ['/packs/western/sounds/']`.

## How it was checked

- **Generation:** 40 Stable Audio takes, the whole budget: 36 from the first list, then 4 redos.
- **The audio model** (`fal-ai/audio-understanding`) checked every take. Its plain QA pass is noisy:
  - The same tin crash scored 10, 9 and 2 on three runs.
  - It hears loud as "heavy rumble".
  - It once gave 10 to tin.impact takes that turned out to be foil.

  So every doubtful take also got a pointed either/or question ("metal, or paper/foil?"), asked at
  matched loudness. Its answers are in `sounds/qa2.json`.
- **My own checks:** levels, clipping, spectrograms, loop seams, and Chrome decoding (gapless, exact
  lengths, no MP3 padding on the loops).
- **In the engine:** the pack was loaded into the real `SoundEngine` (base pack first) in Chrome on
  a virtual display, muted. I recorded scripted scenes and had the recordings described. No music,
  melody, singing or voices anywhere.

## Each sound, honestly

| Sound | Files | Quality | Notes |
|---|---|---|---|
| `ambience.desert` (loop, head) | 1 × 41 s | Good | Dry steady wind, grit hiss, a faint high cicada drone. The raw take was bass-heavy and read as "a low hum" in the mix, so the shipped take is EQ'd (high-pass 90 Hz, +7 dB shelf at 2.2 kHz). At matched loudness the model picked it as the most desert-like. Seamless loop. The other take had a traffic-like rumble and was dropped |
| `windmill.loop` (loop, world) | 2 × 8.8 s | Good | Clank, squeak and vane rattle, steady. The seams are clean (crossfaded, no click), with a small level dip at the wrap that the clanks hide |
| `sign.creak` | 3 | Good | Rusty iron squeaks and a wooden knock |
| `hawk.cry` | 3 | Good | One raspy falling scream with an echo. Takes 0–2 had a wind rumble under the cry, so the shipped ones are high-passed at 350 Hz. Through the engine at about 60 m it scored 10/10 as a natural hawk. Much further off, the engine's air absorption strips the rasp and it reads as a whistle |
| `bell.toll` | 3 | Good | A single strike and a ring. The takes ring at about 1 kHz (a hand bell), so `play.pitch` is [0.68, 0.73]: a lower, bigger bell with a longer ring (5.6–6.4 s files, about 8–9 s as played). Through the engine it scored "large bronze bell, struck once, 10/10" |
| `birds.flush` | 1 | Fair | Wing flaps bursting away. Only one usable take (the other was a crumpled wrapper), so the pitch range is widened for variety |
| `wood.splinter` | 4 | Good | Three takes have a dry crack and splinters. Take 0 is crackle-and-splinter without a big snap: fine as texture, weaker alone |
| `timber.crash` | 3 | Good | Deep wooden thud, then planks clattering |
| `timber.creak` | 2 | Fair | Take 0 (the redo): deep beam groan ending in a crack, 9/10. Take 1 (first prompt): a click, then a wooden creak, a little door-like (4/10 on a pointed question). Kept for variety |
| `tin.impact` | 2 | Good | A sheet-metal clang with a short ringing wobble; asked neutrally, the model said "metal, a large sheet, rings briefly", 9/10. Only 2 takes, so pitch [0.85, 1.15] |
| `tin.crash` | 2 | Fair to good | Layered here: the generated steel crash (heavy, but alone it read as "an explosion with debris") with the `tin.impact` strikes placed on its hits. Both read as metal sheets crashing (9–10/10 on most passes). Each is plausible, but they share source strikes, so they're related |
| `adobe.break` | 3 | Good | Dull crunch and dry earth pouring (take 0 is lighter and crumbly, 8/10) |
| `steps.dirt` (slice, head) | 10 × 0.27–0.34 s | Good | Ten single gritty steps cut from one take, at the level of the base `steps.asphalt` |

### What went wrong, and the lesson

The model hears "tin" as tin foil. All 7 first takes of `tin.impact` and `tin.crash` were paper or
foil crumpling. Asking for "galvanized steel sheet", "clang" and "wobble", with paper, foil, plastic,
crinkling and crumpling in the negative prompt, fixed the impacts. "Creaks" plus "nails squealing"
gave doors and latches. Future packs should avoid "tin" in prompts and say "steel sheet".

## What I'd redo with more budget

1. `tin.crash`: 2–3 real takes from the steel prompt, to replace the layered ones.
2. `birds.flush`: a second take, with "pigeons" (the model knows pigeon wing claps better than doves).
3. `timber.creak`: one more take from the new prompt, to replace take 1.
4. `tin.impact`: 1–2 more takes for variety (sheets land in bursts).
5. A gust sound (`wind.gust`, head or world, 2 × 6 s): a rising whoosh with sand hiss for each
   time the wind value rises through 1.0. The design has no sound for the gusts themselves.

## Notes for the builder

- **Load:** `audio.packs: ['/packs/western/sounds/']`. Every sound carries its own `play` settings
  in `index.json`, so `audio.settings` isn't needed.
- **Names are unchanged from DESIGN.md section 6.** Use the material and footstep tables there as
  written:
  - footsteps `{ hard: 'steps.dirt', rubble: 'steps.rubble', land: 'player.land' }`;
  - ambience `[{ sound: 'ambience.desert', high: 0.6 }, { sound: 'ambience.wind', high: 3.5 }]`.
- **Levels I changed from the design:**
  - `ambience.desert` volume 0.45;
  - `windmill.loop` near 8, volume 0.8 (it is 21 m from the start point and was under the ambience);
  - `sign.creak` volume 0.7;
  - `adobe.break` volume 0.6;
  - `bell.toll` pitch [0.68, 0.73];
  - wider pitch ranges on `birds.flush` and `tin.crash`.
- **Buses:** `ambience.desert`, `windmill.loop`, `sign.creak` and `hawk.cry` are on the `ambience`
  bus, so blasts duck them. The windmill's gust modulation (`voice.setVolume`) multiplies its 0.8.
- **Hawk:** play it 50–70 m away (for example 45 m out and 35 m up), not 120 m out and 60 m up. At
  about 130 m the air absorption leaves only the tonal core, and the model heard it as an electronic
  whistle. Keep it apart from the bell tolls: when they overlapped in a test scene they blurred
  into one "chime".
- **Bell:** the alarm's 3 tolls 1.7 s apart overlap at this pitch (each rings about 8 s). That's how
  a bell sounds being rung, so it's intended.
- **Loops:** they start at a random offset (the engine does this), so two windmill voices wouldn't
  phase. Only one is meant to play.

## Spend

| What | Calls | Est. cost |
|---|---|---|
| Stable Audio 3 Medium takes (`fal-ai/stable-audio-3/medium/text-to-audio`, $0.0376 each) | 40 | $1.50 |
| Audio QA (`fal-ai/audio-understanding`, $0.01 per 5 s): first pass, redos, mixes, pointed second opinions, an EQ A/B/C and 3 engine recordings | 79 | $1.37 |
| **Total** | | **$2.87** |

Every call is a line in `assets-src/packs/western/ledger.jsonl` (`"by": "sounds"`). Uploads to fal
storage for QA of the mixed takes are free.

## Files

- `scripts/assets/packs/western/sounds.mjs`: the list (prompts, takes, `mix` recipes, `play`).
- `scripts/assets/packs/western/mix-sounds.mjs`: renders the `mix` takes (layering and EQ with
  ffmpeg). It keeps a take whose recipe hasn't changed. Run order: generate-sounds, mix-sounds,
  qa-sounds, process-sounds.
- `assets-src/packs/western/sounds/`:
  - raw takes (`<name>/<i>.flac` + `.json`);
  - `qa.json` (the standard QA) and `qa2.json` (the pointed questions);
  - `skip.json` (the 12 takes left out).
- `public/packs/western/sounds/`: the pack (`index.json` + MP3s).
- `public/packs/western/CREDITS.md`: the Sounds section.
