# Textures

Copied from [three-voxel-destruction](https://github.com/sbobyn/three-voxel-destruction)'s `public/textures`.

All from [Poly Haven](https://polyhaven.com), CC0 (public domain), 1k, re-encoded from their JPEGs
as WebP (`cwebp -q 90 -m 6 -sharp_yuv`: 3.5 MB for the set instead of 11.7), colour (`diff`),
OpenGL normal (`nor_gl`) and packed ambient occlusion / roughness / metalness (`arm`) maps:

| Set | Photography / processing |
|---|---|
| brick_wall_005 | Dimitrios Savva, Dario Barresi |
| concrete_wall_008 | Charlotte Baglioni, Dario Barresi |
| plastered_wall_02 | Charlotte Baglioni |
| damaged_plaster | Amal Kumar |
| asphalt_03 | Charlotte Baglioni, Dario Barresi |

## Generated sets (`gen_*`)

Generated for this project with OpenAI's GPT Image 2.5 (on fal.ai, `openai/gpt-image-2.5/flare/text-to-image`;
no photographs or other sources), then made to tile and turned into the same three maps by
`scripts/assets/process-textures.py`: the height, and from it the normal and occlusion, plus the
roughness and metalness, are derived from the colour. The raw images, with the prompt each was made
with, are in `assets-src/textures/raw`; `scripts/assets/generate-textures.mjs` makes any that are
missing.

| Set | What it is | One tile |
|---|---|---|
| gen_brick_broken | Inside of broken brick masonry, for fracture faces: crushed red-orange clay, crumbs of mortar | ~1 m |
| gen_concrete_broken | Freshly fractured concrete: cement paste, broken gravel, air voids, a little rust staining | ~1 m |
| gen_iron_painted | Old black-painted iron (fire escapes): chipped paint, rust, drips; metalness only on bare scratches | ~1 m |
| gen_wood_painted | Weathered vertical boards with flaking cream paint, 7 boards | ~1 m |
| gen_brick_brown | Tenement facade: dark chocolate-brown brick, running bond, light grey mortar, 9 bricks × 28 courses | 2 m |
| gen_brick_painted | Brick wall painted cream, worn and chipped down to red brick, running bond, 9 × 28 | 2 m |
| gen_sidewalk | Sidewalk from above: 2 × 2 concrete flags of 1.5 m with tooled joints, stains, gum | 3 m |
