# Dust Town: credits

## Textures (`textures/western_*`)

Generated for Dust Town with OpenAI's GPT Image 2.5 (on fal.ai, `openai/gpt-image-2.5/flare/text-to-image`;
no photographs or other sources), then made to tile and turned into 1k WebP maps (colour `diff`,
OpenGL normal `nor_gl`, packed occlusion / roughness / metalness `arm`) by
`scripts/assets/process-textures.py` with `scripts/assets/packs/western/textures.py`. The height, and
from it the normal and occlusion, is derived from the colour, except the siding's laps and the tin's
corrugations, which are built as true profiles. The siding also has a paint mask
(`western_siding_paint_1k.webp`: where its map still has paint, for the per-building colour), from
the same map. The raw images, with the prompt each was made with, are in
`assets-src/packs/western/textures/raw`.

| Set | What it is | One tile |
|---|---|---|
| western_siding | Horizontal lap siding, chalky off-white paint finely peeled to grey wood, 6 boards of 15 cm | 0.9 m |
| western_timber | Rough-sawn sun-bleached timber, grain top to bottom, checks, a few knots and nail holes | ~0.9 m |
| western_tin | Old corrugated galvanised iron, 9 ridges, rust patches and streaks, a row of nails | 9 ridges (0.68 m at 7.6 cm) |
| western_adobe | Hand-smoothed mud plaster with fine cracks, straw and pits | ~1.75 m |
| western_dirt | Packed dry desert dirt from above, grit and small pebbles | ~3.5 m |
| western_dirt_broken | The street's packed dirt crumbled where it breaks: soft lumps and loose sand, for a crater's rim and its clods | ~0.9 m |
| western_earth | Freshly dug reddish-brown earth in clods, small pale stones and caliche flecks, for the earth under the street | ~0.9 m |
| western_splinter | Torn fibres of freshly broken pine, for broken faces | ~0.45 m |

## Sky (`hdri/*.hdr`)

[Goegap](https://polyhaven.com/a/goegap) by Greg Zaal, from [Poly Haven](https://polyhaven.com), CC0
(public domain). The 1k Radiance file, unchanged.

[Qwantani Noon (Pure Sky)](https://polyhaven.com/a/qwantani_noon_puresky) by Greg Zaal and Jarod
Guest, from [Poly Haven](https://polyhaven.com), CC0 (public domain): `hdri/qwantani_noon_puresky_1k.hdr`,
the 1k Radiance file, unchanged. It is the background only; Goegap still lights the town.

## Props (`models/*.glb`, `models/index.json`)

The wagon, the safe, the pump and the rocking chair were made for Dust Town with generative AI and
cleaned up in Blender; no photographs, scans or other people's models went into them.

- **Concept images:** OpenAI GPT Image 2.5 (`openai/gpt-image-2.5/flare/text-to-image`), via
  [fal.ai](https://fal.ai). One whole object per image on a plain background, no text, lettering or
  logos. One take each, all used as made.
- **Image to 3D:** Tripo P2 (`tripo3d/p2/image-to-3d`, detailed PBR textures), via fal.ai.
- **Processing:** Blender in background mode (`scripts/assets/process-props.py`): welded, decimated
  to the triangle budget, turned so the front faces -Z with +Y up, scaled to real size in metres,
  origin at the bottom centre, textures stored as WebP. Colliders: the safe one convex hull of 12
  points; the wagon (its bed, a drum across each pair of wheels, its tongue), the pump (post and
  body, lever, spout) and the rocking chair (seat and back, each runner) convex parts welded
  together (`parts` in the list, refitted with `--colliders`). Nothing needed painting out.
- **Shards:** what each prop breaks into (`models/<name>.shards.glb`, listed under `shards` in
  `models/index.json`) is cut from its own processed mesh by `scripts/assets/shatter-props.py`
  (Blender): Voronoi cells, their cut faces filled in a duller, darker shade of the prop's colour.
  No generation; the pieces wear the prop's own materials.

| Prop | What it is | Size (x × y × z, m) | Triangles |
|---|---|---|---|
| wagon | Weathered buckboard freight wagon, empty, tongue to the front | 2.32 × 1.71 × 5.20 | 19,799 |
| safe | Antique cast-iron floor safe, faded red door panel with a plain gold border, on castors | 0.63 × 0.95 × 0.60 | 3,960 |
| pump | Cast-iron pitcher pump on a weathered timber post, spout to the front | 0.26 × 1.30 × 0.78 | 4,949 |
| rocking_chair | Unpainted weathered porch rocking chair | 0.59 × 1.00 × 0.84 | 7,920 |

The prompts, settings and source URLs of every generation are kept next to the raw files in
`assets-src/packs/western/props/raw/<name>/` (`concept0.json`, `model.json`); the list is
`scripts/assets/packs/western/props.mjs`.

## Sounds (`sounds/*/*.mp3`, `sounds/index.json`)

Generated for Dust Town with Stable Audio 3 Medium (`fal-ai/stable-audio-3/medium/text-to-audio`, via
[fal.ai](https://fal.ai)) from text prompts alone: no field recordings, sample libraries or other
people's sounds. Every take was checked with fal's audio-understanding model (`fal-ai/audio-understanding`)
for music, voices, glitches and fit, then trimmed, looped, levelled and encoded as MP3 by
`scripts/assets/process-sounds.mjs` from the list in `scripts/assets/packs/western/sounds.mjs`.

A few takes were finished here from other takes of this pack (`scripts/assets/packs/western/mix-sounds.mjs`,
ffmpeg): the desert ambience and the hawk cries are EQ'd (low rumble cut, the ambience's sand hiss
lifted), the two tin-roof crashes are a generated crash layered with the generated sheet-metal
strikes of `tin.impact`, and the boardwalk steps are the dirt steps' take with the grit cut, a
board's thump and knock raised and the short echoes of the hollow under the boards added (no
generation of their own). The raw takes, with the prompt, seed and model of each, the QA answers and
the takes left out (`skip.json`) are in `assets-src/packs/western/sounds/`.

The three sounds made for the town's answers to the machine gun (`bell.shot`, `water.spurt`,
`water.stream`) were checked by their spectrograms (a bell's strike and its partials ringing down; a
gush, then a spatter; a steady patter, no tones) and by their loudness in the game, not by the
audio model. One stream take carried a rumble under 100 Hz: it's used with it cut.

| Sound | What it is | Takes used |
|---|---|---|
| ambience.desert | Dry desert wind over sand and scrub, a hiss of grit, faint far cicadas (41 s loop) | 1 (EQ'd) |
| windmill.loop | An old farm windmill turning: pump-rod clank, gearbox squeak, vane rattle (8.8 s loop) | 2 |
| sign.creak | A hanging signboard's rusty hooks squeaking in a gust, a wooden knock | 3 |
| hawk.cry | One raspy, falling hawk scream far over the desert | 3 (EQ'd) |
| bell.toll | One strike of a bronze bell and its ring (played lower, as a bigger bell) | 3 |
| bell.shot | A bullet striking the bell: a sharp ping and clang, then its ring (played lower, as the toll is) | 2 |
| water.spurt | A round through the water tank: a crack, then a gush settling into a spurt | 2 |
| water.stream | A thin jet of water splashing steadily onto dry dirt (7.3 s loop) | 2 (one EQ'd) |
| birds.flush | Doves taking off in a burst of wing flaps | 1 |
| wood.splinter | Dry pine boards and posts snapping and splintering | 4 |
| timber.crash | Heavy beams and planks crashing onto dirt | 3 |
| timber.creak | A timber frame groaning under load before it gives way | 2 |
| tin.impact | A sheet of steel roofing landing flat: a clang and a short ringing wobble | 2 |
| tin.crash | Several roof sheets crashing down, banging and ringing | 2 (layered) |
| adobe.break | An adobe wall breaking: a dull crunch and dry earth pouring down | 3 |
| steps.dirt | Boots on packed dirt and grit (10 single steps cut from one take) | 1 |
| steps.boards | Boots on a hollow boardwalk (10 steps, mixed from the dirt take) | 1 (mixed) |

## Code-drawn (`src/demo/worlds/western/`)

The painted signs (a canvas atlas: weathered boards, pictograms and lettering-like brush marks that
are not letters, for the false fronts and the hanging signs), the bales' straw, the forge's coals,
the mesas, the scrub, the windmill's wheel, the doves, the hawk and the tumbleweeds are made in
code for Dust Town. No outside assets.
