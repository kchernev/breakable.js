# Sun Temple: credits

## Sounds (`sounds/`)

All 15 sounds were generated for this world from text prompts with Stability AI's Stable Audio 3
Medium (on fal.ai, `fal-ai/stable-audio-3/medium/text-to-audio`). No recordings or other sound
libraries were used. Each take was checked by an audio-understanding model
(`fal-ai/audio-understanding`) and by spectrogram, then cut and levelled by
`scripts/assets/process-sounds.mjs` (silence trimmed, loops crossfaded, footsteps sliced, mono for
sounds placed in the world, MP3). The list and prompts are in
`scripts/assets/packs/temple/sounds.mjs`. Each raw take is in
`assets-src/packs/temple/sounds/<name>/<i>.flac`, with the prompt, negative prompt, seed and source
URL it came from next to it (`<i>.json`). The QA answers are in `qa.json`, and the takes left out
are listed in `skip.json`.

| Sound | What it is | Takes |
|---|---|---|
| ambience.cicadas | Cicada chorus in olive and pine trees at midday, swelling in slow waves (loop, 41 s) | 1 |
| ambience.coast | Warm breeze over dry grass, distant waves breaking on the cliffs below (loop, 41 s) | 1 |
| sea.splash | A heavy stone plunging into deep sea water, spray, sloshing | 2 |
| birds.scatter | Jackdaws and pigeons bursting off a roof: wings, alarm calls, flying off | 2 |
| marble.break | A marble block cracking apart, chunks and grit | 4 |
| marble.impact.large | A column drum slamming onto stone paving: thud, clack, short roll | 4 |
| stone.grind | Stone blocks grinding and shifting under load | 3 |
| collapse.marble | A colonnade toppling: drums and beams crashing down, rumble | 3 |
| tile.shatter | Terracotta roof tiles smashing | 4 |
| tile.debris | Terracotta shards clinking and rattling on stone | 3 |
| bronze.clang | A bronze shield or door falling flat: clang and long ring | 3 |
| bronze.ring | A pellet striking a hollow bronze statue: a ping and a deep ringing hum (the goddess shot; Phase F) | 3 |
| bay.echo | The far echo of a burst of gunfire rolling back across a bay from distant cliffs (its first 150 ms cut; Phase F) | 2 |
| foliage.break | A branch snapping and a leafy crown thrashing | 3 |
| steps.gravel | Boots on dry gravel and grass, cut into 10 single steps | 1 take, 10 steps |

## Props (models/)

The four GLBs in `models/` (`statue`, `tripod`, `amphora`, `lion`, listed in `models/index.json`)
were made for this project (Breakable.js's Sun Temple world) with generative AI and cleaned up
in Blender:

- **Concept images:** OpenAI GPT Image 2.5 (`openai/gpt-image-2.5/flare/text-to-image`), via
  [fal.ai](https://fal.ai). One take each, one whole object per image, three-quarter view, plain
  background, no text, inscriptions or logos. The statue is a generic armed goddess in the
  Classical manner, not a copy of a known work.
- **Image to 3D:** Tripo P2 (`tripo3d/p2/image-to-3d`, detailed PBR textures), via fal.ai.
- **Processing:** Blender 4.5 in background mode (`scripts/assets/process-props.py`): welded,
  decimated to the triangle budget, oriented (+Y up, front facing -Z), scaled to real size in metres,
  origin at the bottom centre, textures shrunk and stored as WebP, plus a convex collider of at most
  24 points. Then `scripts/assets/packs/temple/props-post.py` graded the statue's and the tripod's
  colour maps toward the world's bronze palette (warmer bronze, blue-green verdigris) and gave the
  bare bronze some metalness. No paid calls in that step.

The prompts, settings, seeds and source URLs of every generation are kept next to the raw files in
`assets-src/packs/temple/props/raw/<name>/` (`concept0.json`, `model.json`); the list and prompts
are in `scripts/assets/packs/temple/props.mjs`.

## Textures and sky (textures/, hdri/)

### Generated sets (`temple_*`)

Generated for this world with OpenAI's GPT Image 2.5 (on fal.ai,
`openai/gpt-image-2.5/flare/text-to-image`; no photographs or other sources), one take each (the
earth two, the second used), then
made to tile and turned into 1k WebP maps (`diff`, `nor_gl`, `arm`) by
`scripts/assets/process-textures.py` with this pack's `scripts/assets/packs/temple/textures.py`:
the colour regraded, and the height, normal, occlusion and roughness derived from it (the roof's
height is built from its tile layout). The prompts are in `scripts/assets/packs/temple/textures.mjs`;
the raw images, with how each was made, are in `assets-src/packs/temple/textures/raw`.

| Set | What it is | One tile |
|---|---|---|
| temple_marble | Weathered white marble: sugary grain, shallow pits, faint honey patina and veins, lichen specks; no joints | 1.2 m |
| temple_marble_broken | Fresh marble fracture, near white (tinted by the inside colour) | 0.6 m |
| temple_limestone | Porous shelly poros limestone, cream-ochre, deep pores; no joints | 1.5 m |
| temple_roof_tiles | Terracotta roof from above: flat pan tiles and ridged cover tiles, cut tile by tile from the raw and re-laid as 4 tiles of 0.55 m by 3 courses of 0.733 m | 2.2 m |
| temple_ground | Dry hilltop ground from above: straw-yellow grass tufts, thyme, ochre soil, pale pebbles | 4 m |
| temple_foliage | Dense olive leaves, light grey-green, for tinting per tree | 1 m |
| temple_earth | A cut through dry, crumbly earth: soft crumbs and small clods, a few pebbles, regraded toward a dusty brown: the breakable ground's earth, in a crater's sides and a clod's breaks (Phase F's take 1; Phase E's take 0, stony soil with pale pebbles, read as speckled stone) | 1 m |
| temple_fill | Packed rubble of marble and limestone chips in lime: the bed under the court's flags (Phase E) | 1 m |

### From Poly Haven (CC0, public domain)

1k maps from [Poly Haven](https://polyhaven.com), fetched as PNG and re-encoded once as WebP by
`scripts/assets/packs/temple/polyhaven.py`, unchanged otherwise (sources and checksums in
`assets-src/packs/temple/polyhaven.json`).

| Set | By | One tile |
|---|---|---|
| [marble_rock_02](https://polyhaven.com/a/marble_rock_02) | Amal Kumar | 2 m |
| [marble_rock_01](https://polyhaven.com/a/marble_rock_01) | Amal Kumar | 2 m |
| [marble_cliff_01](https://polyhaven.com/a/marble_cliff_01) | Amal Kumar | 4.3 m |
| [marble_cliff_03](https://polyhaven.com/a/marble_cliff_03) | Amal Kumar | 5.7 m |
| [rough_wood](https://polyhaven.com/a/rough_wood) | Rob Tuytel | 0.5 m |
| [bark_willow_02](https://polyhaven.com/a/bark_willow_02) | Charlotte Baglioni | 2.15 m |

### Sky (hdri/)

`pizzo_pernice_puresky_1k.hdr`: [Pizzo Pernice (pure sky)](https://polyhaven.com/a/pizzo_pernice_puresky)
from Poly Haven, CC0, Radiance HDR, by Andreas Mischok, sky edits by Jarod Guest. A clear midday
sky, the sun about 53° up.

`temple_sky_1k.hdr`, the sky the world uses, is that map graded by
`scripts/assets/packs/temple/sky.py`: above the first few degrees the sky is pulled toward a deeper
blue (red × 0.62, blue × 1.45 at the zenith), the haze low down and the sun's disc left as they
are. Same licence (CC0).
