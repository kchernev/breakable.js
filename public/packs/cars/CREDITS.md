# The cars' insides: credits

## Textures (`textures/`)

What `scripts/assets/process-cars.py` (by way of `scripts/assets/car_insides.py`) lines the cars'
cabins, engine bays and trunks with; the cars' glTFs carry copies of the colour and normal maps
(`public/models/cars/textures/`). Seven were generated for this project with OpenAI's GPT Image 2.5
(on fal.ai, `openai/gpt-image-2.5/flare/text-to-image`; no photographs or other sources), then made
to tile and turned into colour (`diff`), OpenGL normal (`nor_gl`) and occlusion / roughness /
metalness (`arm`) maps by `scripts/assets/process-textures.py` with
`scripts/assets/packs/cars/textures.py`; two more are drawn by that script. The raw images, each
with the prompt it was made from, are in `assets-src/packs/cars/textures/raw`; the prompts are in
`scripts/assets/packs/cars/textures.mjs`.

| Set | What it is | One tile |
|---|---|---|
| car_leather_black | Black nappa leather, a fine even grain, satin | 30 cm |
| car_leather_tan | Cognac tan leather (tinted red for a sport trim) | 30 cm |
| car_leather_quilted | Drawn by `textures.py`: the black leather's grain under a diamond quilt, its seams stitched, a few perforations in each diamond (tinted tan for a tan trim) | 30 cm (6 diamonds) |
| car_fabric | Charcoal woven seat cloth (darker, the seatbelts) | 20 cm |
| car_carpet | Anthracite cut-pile floor carpet | 30 cm |
| car_plastic | Soft-touch dashboard plastic, a pebbled grain (darker, the trim) | 20 cm |
| car_headliner | Pale grey headliner felt | 30 cm |
| car_plywood | A van's cargo floor and lining: birch plywood, scuffed | 1 m |
| car_carbon | Drawn by `textures.py`: a 2x2 twill carbon weave | 12 cm |

Two more of GPT Image 2.5's are pictures, not tiles, and are used as they came (as light, in the
cars' glTFs only): `car_gauges`, a lit instrument cluster (two dials, numerals and ticks, no
lettering), and `car_screen`, a centre screen's dark navigation map.
