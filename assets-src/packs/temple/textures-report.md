# Sun Temple: textures report

What I made, how good each set is, and what I would redo. All maps are 1k WebP triplets in
`public/packs/temple/textures/` (`<set>_diff_1k.webp`, `<set>_nor_gl_1k.webp`, `<set>_arm_1k.webp`).
The sky is in `public/packs/temple/hdri/`.

## Paid calls

Six GPT Image 2.5 images, one take per set, no redos. That leaves 2 of my 8 unused. The estimated
cost is $1.90; the ledger is `ledger.jsonl` (`"by": "textures"`). The image sizes were:

| Size | Sets | Estimated cost each |
|---|---|---|
| 1024² | marble_broken, foliage | $0.20 |
| 1536² | marble, limestone | $0.30 |
| 2048² | roof, ground | $0.45 |

The two 1536² and two 2048² sets were made big for two reasons. A shrunk image is sharper than a
native 1k one. The roof also needed enough tiles to choose from.

## How they were checked

- The 2x2 colour previews, the lit previews and the seam crops are in `textures/previews/`. Every
  wrap is clean.
- I also rendered a temple-like test scene in Blender (Cycles, AgX) under the design's sun
  (53° up, azimuth -1.25, 3.6) and the 1k sky. It had:
  - 20-sided drums, a running-bond limestone wall, steps and an entablature;
  - a roof slope of 1.1 × 0.733 panels in one slope frame;
  - an olive and a cypress with the design's tints.

  The UVs in that scene were box-projected exactly as `drawFaces` does. The renders are
  `previews/check_*.jpg`. After the first render I made two changes:
  - The marble came out cream, about the same as the limestone, so I made it more neutral.
  - The olives came out yellow-green under the warm sun and the yellowish tint, so I made the
    foliage cooler.

## The generated sets

| Set | Tile | Colour mean (sRGB) | Rough (mean) | Quality |
|---|---|---|---|---|
| temple_marble | 1.2 m | 0.865, 0.861, 0.840 | 0.60 | Good |
| temple_marble_broken | 0.6 m | 0.90, 0.90, 0.90 | 0.50 | Very good |
| temple_limestone | 1.5 m | 0.841, 0.776, 0.635 | 0.87 | Very good |
| temple_roof_tiles | 2.2 m | 0.652, 0.375, 0.256 | 0.80 | Good |
| temple_ground | 4 m | 0.670, 0.586, 0.409 | 0.95 | Good |
| temple_foliage | 1 m | 0.521, 0.581, 0.541 | 0.79 | Good |

- **temple_marble**
  - What it is: weathered white marble with a sugary grain, shallow pits, a faint honey patina,
    faint veins and small dark lichen specks. It has no joints.
  - Colour: it is regraded close to neutral, so the material's `0xf4efe4` supplies the warmth. In
    the test render, marble and limestone now read as different stones.
  - Height: it comes from the brightest channel, so the patina stays flat. The marble is kept
    smoother than the limestone.
  - Weak spots:
    - The lichen specks are star-shaped. They are a little stylised and come round every 1.2 m on
      big flat faces.
    - The patina has faint vertical streaks that line up when tiled.
  - Redo: if it shows in the game, use a spare image with no lichen and a finer, more broken-up
    patina.
- **temple_marble_broken**
  - What it is: a crystalline fracture with facets, steps and powder, near white and neutral, so the
    inside colour tints it. Nothing weak.
- **temple_limestone**
  - What it is: porous shelly poros. It is cream-ochre with deep pores and fossil shell bits.
  - Colour: it was brought to the design's limestone colour (`0xd8c8a4`), so it needs no surface
    colour.
  - Weak spot: from a distance it is a little speckly or busy, but it reads as a soft porous stone.
- **temple_roof_tiles**
  - What it is: flat pan tiles with ridged (gabled) cover tiles.
  - How it was made:
    - The raw has 6 × 6 tiles with crisp gap lines and chevron joints. It came out with 6 columns,
      not the 8 asked for, and the tiles were nearly square.
    - `textures.py` finds each tile by its gap and shadow lines (30 tiles). It leaves out the 30%
      that differ most and pulls the rest halfway to the typical colour.
    - It then lays 12 of them, each used once, on an exact grid of 4 × 0.55 m by 3 × 0.733 m.
  - The height is built from that layout: gabled cover tiles at about 40°, a course that rises
    toward its lower end and drops at the course line, and a dark gap beside each cover tile. The
    normals have physical strength.
  - In the test render the pattern runs across the panels without a break and reads as a Greek tile
    roof.
  - Weak spots:
    - Each tile is stretched about 0.74 across to reach the 0.55 × 0.733 proportion. The clay grain
      is slightly elongated, which is invisible at roof distance.
    - The chevron ends of the cover tiles sit about 3 cm above the step in the height map.
  - Variety: the tiles are pulled toward one colour, so the per-panel `tint` should provide it.
- **temple_ground**
  - What it is: dry straw grass tufts, grey-green thyme cushions, ochre soil and pale pebbles. It is
    lighter and more golden than the raw.
  - Repetition: the few bigger pale rock spots marked out the 4 m repeat, so most of their contrast
    was taken out.
  - Weak spots:
    - Seen from above, the thyme cushions still repeat every 4 m.
    - At eye level it reads as an even golden-ochre ground, like sand. At 256 px/m it is soft
      underfoot.
    - Mixing in the bedrock (below) and any scenery grass will matter more than this map.
- **temple_foliage**
  - What it is: dense olive leaves with deep dark gaps (the gaps keep their darkness in the colour,
    because the AO channel isn't used). The map is light and slightly cool grey-green for tinting.
  - Untinted it looks pastel, which is intended. With `0xc8d0b4` it is silvery olive, and with
    `0x5c7a4c` it is a dark cypress green.
  - Weak spot: on 1–2 m faceted blobs at uvScale 1 the leaves read as a fine noise from about 15 m.
    uvScale 0.6–0.8 would show bigger leaf clumps.

## Free sets from Poly Haven (CC0)

These were fetched by `scripts/assets/packs/temple/polyhaven.py` and re-encoded once; the record is
in `polyhaven.json`.

| Set | Tile | Colour mean | Use | Notes |
|---|---|---|---|---|
| marble_rock_02 | 2 m | 0.78, 0.70, 0.60 | Bedrock (recommended) | Pale, worn and finely cracked, close to the design's bedrock `0xd6cfc0`. |
| marble_rock_01 | 2 m | 0.59, 0.54, 0.48 | The design's first pick | Greyer and darker, with strong black cracks. A multiplier can't make it paler, so I'd use 02. |
| marble_cliff_01 | 4.3 m | 0.68, 0.56, 0.46 | Cliffs (recommended) | Cream with dark vertical fractures; it will read as pale limestone in the haze. |
| marble_cliff_03 | 5.7 m | 0.61, 0.49, 0.36 | The design's first pick | Orange-tan with blocky strata. Its big band repeats very visibly. |
| rough_wood | 0.5 m | 0.42, 0.38, 0.34 | Timber | Jointless grey weathered grain; the material's brown tint makes it cedar-ish. |
| bark_willow_02 | 2.15 m | 0.52, 0.46, 0.41 | Bark | Deep vertical furrows, fine for olive; cypress is close enough under its tint. |

- rough_wood:
  - It replaces the design's `roof_planks` / `brown_planks_03`. Their dark board gaps would stripe
    a 0.22 m rafter.
  - The 0.5 m tile repeats its knots.
  - Its roughness is 0.51, a bit glossy for old wood.

**Sky:** `pizzo_pernice_puresky_1k.hdr` (1.1 MB). It is a clean deep-blue sky with the sun 53° up
(measured) and a few small clouds and a haze band on the horizon. The 2k version was barely sharper
on those clouds, and the fog covers the horizon, so I kept 1k only.

## What I'd redo, in order

1. **temple_marble**, only if the star lichen or the vertical patina repeat shows in the game. It
   would cost one spare image.
2. **temple_ground**, as a second set for variety, if the 4 m repeat shows across the plateau. A
   2 m grass-only set mixed with this one by noise would break up the lattice.
3. Nothing else needs a redo.

## Phase E: the breakable ground's two sets

Two more GPT Image 2.5 images (1024², one take each, $0.20 each by estimate, `"by": "phase-e temple
ground"` in the ledger), for what a crater shows that nothing in the pack did: `temple_earth` (a cut
through terra rossa with limestone pebbles: the earth's sides and breaks, and the cut along the
ground's edges) and `temple_fill` (marble and limestone chips packed in lime: the rubble under the
court's flags). Both tile cleanly (previews in `textures/previews/`). The earth's raw is a saturated
brick red; at its first grade (mean 0.55, 0.40, 0.29) the clods a blast threw read in the noon sun
as broken roof tiles, so it's regraded to a dusty brown (0.50, 0.40, 0.31, 55% of its saturation).
The court's flags use `temple_marble` (painted into courses by the surface), the rock under the
earth `marble_rock_02` and `marble_cliff_01` as the land does.
