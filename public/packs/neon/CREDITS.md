# Neon Alley: credits

## Textures (`textures/neon_*`)

Generated for this world with OpenAI's GPT Image 2.5 (on fal.ai, `openai/gpt-image-2.5/flare/text-to-image`;
no photographs or other sources), then made to tile and turned into 1k WebP maps (colour `diff`,
OpenGL normal `nor_gl`, packed occlusion / roughness / metalness `arm`) by
`scripts/assets/process-textures.py` with this pack's `scripts/assets/packs/neon/textures.py`. The
height (and from it the normal and occlusion), roughness and metalness are derived from the colour,
or from the known shape (tile grout, shutter slats). The raw images and the prompts are in
`assets-src/packs/neon/textures/raw`.

| Set | What it is | One tile |
|---|---|---|
| neon_tile | Small square glazed wall tiles, off-white, grey grout, faint rain streaks | 1 m (10 × 10 tiles) |
| neon_concrete | Weathered cast concrete: water stains, efflorescence, patches | 2 m |
| neon_render | Painted cement render, faded off-white, mould streaks, flaked patches | 2 m |
| neon_asphalt_dry | Asphalt after rain, its puddles filled in, for puddles placed in the shader | 4 m |
| neon_asphalt_puddle | The puddle mask of the same image (one grey map) | 4 m |
| neon_shutter | Corrugated galvanised roller shutter, worn grey-green paint, rust at the seams | 1 m (11 slats) |
| neon_metal | Light grey enamelled sheet steel, rust spots and drips, scratches | 1 m |

### The earth under the street (`textures/rocky_trail_02_*`)

[Rocky Trail 02](https://polyhaven.com/a/rocky_trail_02) by Amal Kumar, from
[Poly Haven](https://polyhaven.com), CC0 (public domain): the same 1k WebP maps as Market Town's
pack (`public/packs/medieval/textures/`), copied so this pack stands alone. Unmodified; it's tinted
darker and wet in the shader. One tile is 2 m. It's the floor of a crater dug through the street.

## Sky (`hdri/kloppenheim_07_puresky_1k.hdr`)

[Kloppenheim 07 (Pure Sky)](https://polyhaven.com/a/kloppenheim_07_puresky) from
[Poly Haven](https://polyhaven.com), CC0 (public domain): photographed by Greg Zaal, sky edits by
Jarod Guest. 1k Radiance HDR, unmodified.

## Props (`models/`)

Made for this world; no photographs, scans or third-party models. The scooter, the hawker cart
and the wheelie bin: a concept image from OpenAI's GPT Image 2.5 (on fal.ai,
`openai/gpt-image-2.5/flare/text-to-image`; one whole object on a plain background, no text or
logos), turned into a textured mesh by Tripo P2 (on fal.ai, `tripo3d/p2/image-to-3d`, PBR maps),
then cleaned up in Blender 4.5 by `scripts/assets/process-props.py` (oriented with the front to -Z,
scaled to real size in metres, decimated, WebP textures, a convex collider of 12 points, the paint
of the scooter, the crates and the bin made tintable per copy, an emissive map for the cart's bulb)
and finished by this pack's `scripts/assets/packs/neon/props-post.py`: the made-up lettering Tripo
drew on the scooter's licence plate is painted over, and the cart's wheels get painted spokes.
What each prop breaks into (`models/<name>.shards.glb`, listed under `shards` in `models/index.json`)
is cut from its own processed mesh by `scripts/assets/shatter-props.py` (Blender): Voronoi cells,
their cut faces filled in a duller, darker shade of the prop's colour. No generation; the pieces wear
the prop's own materials.

The plastic crates (`crates`, `crate`) are procedural: geometry and textures written by
`scripts/assets/packs/neon/crates.py` (numpy), then processed the same way. The other colours in
the alley (red, charcoal, blue and yellow scooters, green and yellow crates, grey and blue bins) are
tints the game gives each copy.

The prompts, settings, seeds and source URLs of every generation are next to the raw files in
`assets-src/packs/neon/props/raw/<name>/` (`concept0.json`, `model.json`). Tripo's take on the
crates, not used, is kept in `raw/crates/rejected/`. The designs are generic: no badges, logos or
lettering are meant to appear on any of them.

## Sounds (`sounds/`)

Made for this world; no recordings or third-party sounds. Generated with Stable Audio 3 Medium (on
fal.ai, `fal-ai/stable-audio-3/medium/text-to-audio`; 46 takes), checked with an audio model
(`fal-ai/audio-understanding`) and by their spectra (the last six by their spectra and envelopes
alone), then cut, looped, levelled and encoded to MP3
by `scripts/assets/process-sounds.mjs`. The list, prompts and how each is played are in
`scripts/assets/packs/neon/sounds.mjs`; every take's prompt, seed and source URL is next to its raw
file in `assets-src/packs/neon/sounds/<name>/`.

- `ambience.rain`, `ambience.city`, `rain.awning`, `steam.hiss`, `neon.break`, `spark.zap`,
  `transformer.blow`, `shutter.rattle`, `sheetmetal.impact`, `tile.break`, `splash.debris`,
  `steps.wet`, `alarm.bell`: Stable Audio. `ambience.rain` was equalized (less low end, a little
  more patter) and the `alarm.bell` takes cut to whole rings by
  `scripts/assets/packs/neon/prep-sounds.py`.
- `neon.die` (a sign shot dark: its buzz stuttering, a pop), `lamp.pop` (a lamp or lit panel shot
  out), `steam.burst` (a steam pipe or vent shot): Stable Audio, for the gun's reactions. The first
  `lamp.pop` take hummed on after its pop: `prep-sounds.py` cuts it to the pop.
- `neon.buzz`: synthesized by `scripts/assets/packs/neon/prep-sounds.py` (numpy: a 100 Hz
  transformer hum, a rattling lamination, gas sizzle and crackle), after four Stable Audio takes
  failed to sound like a sign. Those takes are kept in `assets-src/packs/neon/sounds/neon.buzz/replaced/`.

## Made in code (`src/demo/worlds/neon/`)

The world's code draws a few things itself, with no image or model files: the glyph atlas the
lightboxes and billboards show (a made-up stroke script and simple pictograms, drawn on a canvas
in `glyphs.ts`; no real letters, characters or brands), the wet-ground shader (puddles, rain
rings, gutters, drains and manholes over the `neon_asphalt_dry` maps and the puddle mask), the
night window grid of the towers around the alley, and the grating of the caged balconies. From
the base pack (`public/textures`, `public/sounds`, see their credits) it uses the broken-face maps
`gen_concrete_broken` and `gen_brick_broken`, `gen_wood_painted` for the lantern gate, and the
explosion, masonry, glass, metal, wood, collapse, rubble footstep and wind sounds.
