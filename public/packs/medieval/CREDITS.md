# Market Town: credits

Each asset maker adds a section below.

## Textures and skies (textures/, hdri/)

### Generated sets (`medieval_*`, except `medieval_limewash`)

Generated for this world with OpenAI's GPT Image 2.5 (on fal.ai, `openai/gpt-image-2.5/flare/text-to-image`;
no photographs or other sources), then made to tile and turned into 1k WebP maps (`diff`, `nor_gl`,
`arm`) by `scripts/assets/process-textures.py` with this pack's `scripts/assets/packs/medieval/textures.py`:
height, normal, occlusion and roughness are derived from the colour. The prompts are in
`scripts/assets/packs/medieval/textures.mjs`; the raw images, with how each was made, are in
`assets-src/packs/medieval/textures/raw`.

| Set | What it is | One tile |
|---|---|---|
| medieval_oak | Weathered hewn oak, silver-grey, grain running down the map, drying checks, adze facets, two peg holes | 1 m |
| medieval_limestone | Dressed honey-cream oolitic limestone, claw tooling, pits, a few lichen spots; no joints | 1.5 m |
| medieval_limestone_broken | Freshly fractured pale limestone: facets, steps, fossil bits, dust | 0.8 m |
| medieval_daub_broken | Broken wattle-and-daub: clay clods, chopped straw, hazel rods | 0.8 m |
| medieval_hay | Side of a straw bale, stalks mostly horizontal | 1 m |
| medieval_canvas | Undyed coarse linen, plain weave, near white | 0.5 m |

### From Poly Haven (CC0, public domain)

1k maps from [Poly Haven](https://polyhaven.com), fetched as PNG and re-encoded once as WebP by
`scripts/assets/packs/medieval/polyhaven.py` (sources and checksums in `assets-src/packs/medieval/polyhaven.json`).

| Set | By | One tile | Changes |
|---|---|---|---|
| [cobblestone_floor_001](https://polyhaven.com/a/cobblestone_floor_001) | Rob Tuytel | 2.4 m | its arm map ships with no occlusion (black R): set to 1 |
| [rocky_trail_02](https://polyhaven.com/a/rocky_trail_02) | Amal Kumar | 2 m | none |
| [roof_09](https://polyhaven.com/a/roof_09) | Rob Tuytel | 4 m | colour moved toward fired clay (mean, a little more saturated) |
| [castle_wall_slates](https://polyhaven.com/a/castle_wall_slates) | Rob Tuytel | 2.5 m | its few pale and coloured stones repainted at the wall's median colour (they tiled as a lattice); roughness at least 0.8 |
| medieval_limewash | Rob Tuytel ([medieval_wall_01](https://polyhaven.com/a/medieval_wall_01), not shipped itself) | 2 m | medieval_wall_01's colour regraded to near-white lime (stains kept as dirt), its darkest marks toned down; its normal and arm maps unchanged |
| [old_planks_02](https://polyhaven.com/a/old_planks_02) | Rob Tuytel | 2 m | none |

### Sky (hdri/)

[Poly Haven](https://polyhaven.com), CC0, Radiance HDR, the "pure sky" version (the sky alone), photographed by
Greg Zaal, sky edits by Jarod Guest:

- `syferfontein_6d_clear_puresky_1k.hdr`: [Syferfontein 6d Clear](https://polyhaven.com/a/syferfontein_6d_clear_puresky), a clear hazy sky with the sun about 6° up.


## Sounds (sounds/)

Generated for this world with Stability AI's Stable Audio 3 Medium (on fal.ai,
`fal-ai/stable-audio-3/medium/text-to-audio`; text prompts only, no recordings or other sources),
checked with `fal-ai/audio-understanding` and by spectrogram, then trimmed, looped, sliced, levelled and
encoded as MP3 by `scripts/assets/process-sounds.mjs`. The prompts and how the game plays each sound are in
`scripts/assets/packs/medieval/sounds.mjs`; the raw takes, with the prompt and seed of each, are in
`assets-src/packs/medieval/sounds/` (takes left out of the pack are listed in its `skip.json`; replaced
takes are kept in `assets-src/packs/medieval/sounds-rejected/`).

| Sound | What it is | Takes |
|---|---|---|
| ambience.birds | Songbirds and swallows over a country town square on a summer evening, a light breeze (36 s loop) | 1 |
| ambience.market | A distant open-air market: indistinct murmur, footsteps on cobbles (36 s loop) | 1 |
| bell.toll | One strike of a large bronze bell in a stone tower, heard from the square | 2 |
| bell.clang | The bell crashing onto cobbles: a crash, a bounce, a short dull ring | 2 |
| stone.break | Limestone blocks cracking apart, chunks grinding and tumbling | 3 |
| stone.impact.large | A heavy stone block slamming onto cobbles, a crunch, chips | 2 |
| timber.crack | An oak beam snapping, then splintering | 3 |
| timber.groan | Oak beams and pegs creaking and groaning under strain | 2 |
| tile.clatter | A row of clay roof tiles sliding off a roof and smashing below | 3 |
| tile.impact | One clay tile smashing on cobbles, shards skittering | 4 |
| birds.scatter | A flock of pigeons bursting off a roof, wings only | 2 |
| chickens.startle | Startled hens squawking and flapping, then clucking | 1 |
| steps.cobble | Leather boots on cobblestones (10 steps cut from one take) | 1 |
| bell.ping | A hard strike on the bell's lip and its ring: a round striking the bell (phase F) | 2 |
| sign.creak | A wooden sign swinging on rusty iron rings: squeaky creaks, a faint knock (phase F) | 2 |

`bell.ping` and `sign.creak` were checked by spectrogram, envelope and partials only (no audio-understanding
calls), and levelled in the engine against the gun's shot and strikes.

## Props (models/)

`barrel.glb`, `handcart.glb`, `haywagon.glb` and `basket.glb` (listed in `models/index.json`) were made
for this world with generative AI and cleaned up in Blender; no photographs, scans or other models
were used:

- **Concept images:** OpenAI GPT Image 2.5 (`openai/gpt-image-2.5/flare/text-to-image`), via
  [fal.ai](https://fal.ai), one image per prop: one whole object, three-quarter view, plain background,
  no text or marks.
- **Image to 3D:** Tripo P2 (`tripo3d/p2/image-to-3d`, detailed PBR textures), via fal.ai.
- **Repairs:** Blender 4.5 in background mode (`scripts/assets/packs/medieval/fix-props.py`): the
  texture gutters filled from the nearest UV island; two taps Tripo added to the barrel removed and the
  marks under them covered with the barrel's own staves; the handcart's wheels put on one axis and an
  axle-tree added (a copy of its own shaft); the hay wagon's hay warmed from a pale grey to gold.
- **Processing:** `scripts/assets/process-props.py`: welded, decimated, oriented (+Y up, front to -Z),
  scaled to real size in metres, origin at the bottom centre, textures shrunk and stored as WebP; its
  colliders fitted again with `--colliders`: 12 points standing on four, the barrel a 16-sided drum
  (32 points: it rolls).
- **Shards:** what each prop breaks into (`models/<name>.shards.glb`, listed under `shards` in
  `models/index.json`) is cut from its own processed mesh by `scripts/assets/shatter-props.py`
  (Blender): Voronoi cells, their cut faces filled in a duller, darker shade of the prop's colour.
  No generation; the pieces wear the prop's own materials.

The prompts are in `scripts/assets/packs/medieval/props.mjs`; each generation's settings, seed and
source URLs are next to its raw files in `assets-src/packs/medieval/props/raw/<name>/` (`concept0.json`,
`model.json`; `model_tripo.glb` is the model as generated, `model.glb` the repaired one).

| Model | What it is | Size (m, w × h × l) | Triangles |
|---|---|---|---|
| barrel | Oak barrel, three iron hoops at each end, closed | 0.64 × 0.90 × 0.64 | 6,929 |
| handcart | Empty two-wheeled market handcart on two front legs, handles to -Z | 1.52 × 0.76 × 2.40 | 9,899 |
| haywagon | Four-wheeled farm wagon heaped with loose hay, pole to -Z | 1.83 × 2.11 × 4.20 | 15,839 |
| basket | Round wicker basket heaped with red and green apples | 0.44 × 0.32 × 0.50 | 9,899 |
