# Harbor Yard: credits

## Textures (`textures/`)

Generated for this world with OpenAI's GPT Image 2.5 (on fal.ai,
`openai/gpt-image-2.5/flare/text-to-image`; no photographs or other sources), then made to tile and
turned into colour (`diff`), OpenGL normal (`nor_gl`) and occlusion / roughness / metalness (`arm`)
maps by `scripts/assets/process-textures.py` with `scripts/assets/packs/harbor/textures.py`. The
raw images, each with the prompt it was made from, are in `assets-src/packs/harbor/textures/raw`.

| Set | What it is | One tile |
|---|---|---|
| harbor_container | Container side sheet: trapezoidal ribs, pale grey paint (to be tinted), rust spots and streaks, grime, dents; plus `harbor_container_rust_1k.webp`, a mask of its rust | 6 ribs (1.71 m at 28.5 cm a rib) |
| harbor_cladding | Warehouse wall sheeting, box profile: narrow ribs, wide pans, pale grey (to be tinted), faint streaks | 4 ribs (1 m at 25 cm a rib) |
| harbor_steel_painted | Painted structural steel, pale grey (to be tinted), chipped to primer and rust | 1 m |
| harbor_yard_concrete | Port pavement from above: 2 x 2 slabs of 4 m, sealed sawn joints, tyre marks, oil, one puddle (glossy in the roughness map) | 8 m |
| harbor_pallet_wood | Rough-sawn spruce, grain along the tile's x, knots, nail heads | 1 m |
| harbor_roller_door | Galvanised roller shutter slats, grime in the grooves | 9 slats (0.75 m at 8.3 cm a slat) |
| harbor_gravel | Crushed grey stone sub-base under the yard's slabs (the breakable apron's lower layer and its bed) | 1 m |
| harbor_slab_broken | The slabs' broken faces: the base pack's fractured concrete (`gen_concrete_broken`'s raw image, also GPT Image 2.5, copied), with the ends of the reinforcement's bars painted in by `textures.py` in two rows | 1 m |

## Sky (`hdri/`)

`kloofendal_overcast_puresky_1k.hdr`: [Kloofendal Overcast (Pure Sky)](https://polyhaven.com/a/kloofendal_overcast_puresky)
by Greg Zaal, from [Poly Haven](https://polyhaven.com), CC0 (public domain), 1k Radiance HDR, unchanged.

## Sounds (`sounds/`)

All 18 sounds were generated for this world from text prompts with Stability AI's Stable Audio 3
Medium (on fal.ai, `fal-ai/stable-audio-3/medium/text-to-audio`). No recordings or other
libraries were used. Each take was checked by an audio-understanding model
(`fal-ai/audio-understanding`) and by spectrogram (the three of phase F, the leaks' and the fuel
catching, by spectrogram and loudness over time only), then cut and levelled by
`scripts/assets/process-sounds.mjs` (silence trimmed, loops crossfaded, footsteps sliced, mono for
sounds placed in the world, MP3). The list and prompts are in `scripts/assets/packs/harbor/sounds.mjs`.
Each raw take is in `assets-src/packs/harbor/sounds/<name>/<i>.flac`, with the prompt, negative
prompt, seed and source URL it came from next to it (`<i>.json`). The QA answers are in `qa.json`.

| Sound | What it is | Takes |
|---|---|---|
| ambience.harbor | Port ambience loop (41 s): soft lapping, far machinery and ship engine rumble, faint far gulls | 1 |
| water.lap | Waves lapping against the quay wall and fenders, close (loop, 18 s) | 1 |
| gulls.call | A herring gull crying overhead | 3 |
| gulls.scatter | A flock of gulls taking off in alarm and flying away (stereo) | 2 |
| ship.horn | A ship's deep horn far across the water, with its echo | 2 |
| water.splash | A heavy steel thing plunging into deep water | 3 |
| container.boom | An empty steel container dropped on concrete: hollow boom and ring | 4 |
| container.clang | A loose corrugated sheet hitting concrete | 4 |
| container.groan | Steel under strain: a slow, continuous, deep groan | 3 |
| container.collapse | A container stack toppling: booms, scraping, settling | 3 |
| sheet.tear | Corrugated sheet ripped open, crumpling, flapping | 3 |
| chain.rattle | Heavy chains and wire rope swinging and dropping | 2 |
| drum.bonk | An empty steel drum knocked over: a bong and a short roll | 3 |
| fuel.leak | Oil glugging out of a hole in a tank and splattering on concrete (loop, 7.3 s) | 2 |
| drum.leak | A thin trickle of oil from a drum pattering into a puddle (loop, 5.8 s) | 1 |
| fuel.ignite | Spilt fuel catching: a whoosh and whump, dying to a crackle | 1 (of 3: two came as a steady roar) |
| steps.wet | Work boots on damp concrete (10 slices from one take) | 1 |
| steps.metal | Boots over bent steel sheets and scrap (10 slices from one take) | 1 |

## Props (`models/`)

The props were made for this world with generative AI and cleaned up in Blender. No scans, stock
models or photographs were used.

- **Concept images:** OpenAI GPT Image 2.5 (`openai/gpt-image-2.5/flare/text-to-image`, on fal.ai).
  One whole object per image, three-quarter view, plain background. No text, logos or markings
  were asked for, and none appeared.
- **Image to 3D:** Tripo P2 (`tripo3d/p2/image-to-3d`, on fal.ai): detailed PBR textures. One take
  per prop.
- **Processing:** Blender 4.5 in background mode. `scripts/assets/process-props.py` welds each
  model, decimates it to its triangle budget and orients it (+Y up, front to -Z). It then scales
  the model to its real size in metres, puts the origin at the bottom centre and stores the
  textures as WebP. The drum's blue paint is turned grey with a mask in the colour map's alpha, so
  the world tints each copy. Colliders: 16-sided prisms for the drum and the reel (they roll), and
  two parts each for the vehicles (the forklift's body and forks, the tractor's chassis and cab).
  `scripts/assets/packs/harbor/finish-props.py` (run by `process-props.py` after it) then:
  - cuts off the needles the 3D model made of one flange's bolts;
  - puts back the reel's black cable and grey-weathered plywood, which the model had lightened;
  - fills a missing triangle in the drum's wall;
  - fits the drum's and the reel's colliders again to the result.
- **Shards:** what each prop breaks into (`models/<name>.shards.glb`, listed under `shards` in
  `models/index.json`) is cut from its own processed mesh by `scripts/assets/shatter-props.py`
  (Blender): Voronoi cells, their cut faces filled in a duller, darker shade of the prop's colour.
  No generation; the pieces wear the prop's own materials.

| Model | What it is | Size (w x h x l, m) | Triangles |
|---|---|---|---|
| forklift | Diesel counterbalance forklift, 3 t class, faded red-orange, mast lowered, forks down | 1.39 x 2.10 x 3.80 | 19,799 |
| yard_tractor | Terminal tractor: offset single-seat cab, fifth-wheel deck, tandem rear axle, faded off-white | 2.56 x 3.33 x 5.60 | 19,800 |
| drum | 205 L steel drum, faded blue (tinted per copy), rust and dents | 0.58 x 0.88 x 0.58 | 4,952 |
| reel | Wooden cable reel wound with black cable, standing on its flanges | 1.02 x 1.40 x 1.40 | 5,900 |

The prompts, settings, seeds and source URLs of every generation are next to the raw files in
`assets-src/packs/harbor/props/raw/<name>/` (`concept0.json`, `model.json`). The prop list is
`scripts/assets/packs/harbor/props.mjs`.
