// Sun Temple's generated texture sets (GPT Image 2.5). textures.py next to this makes each one tile
// and derives its maps; the Poly Haven sets the world also uses come from polyhaven.py. Each prompt
// states the frame's real size; the processed tile is that size unless textures.py crops it.

import { tex } from '../../textures.mjs';

/** @type {Array<{ name: string, prompt: string, size?: { width: number, height: number } }>} */
export const textures = [
  {
    // Most of the world is this, on hundreds of same-sized pieces: no single mark that would be
    // recognised where it comes round again. Fairly neutral, since the material's colour warms it.
    name: 'temple_marble',
    size: { width: 1536, height: 1536 },
    prompt: tex(
      'Texture of the weathered outer surface of an ancient Greek temple built of white Pentelic marble, seen straight on: one continuous dressed ' +
        'marble face filling the whole frame, with no joints, no block edges, no carving, no fluting, no mouldings and no cracks across it. ' +
        'Warm white to ivory marble softly eroded by centuries of sun and rain: a fine sugary granular surface with tiny pits and pores, very faint thin ' +
        'pale grey veins, a light honey-ochre and golden patina in soft irregular cloudy patches and faint short vertical rain streaks, small shallow ' +
        'chips and flaked spots, a few tiny dark grey lichen specks and pale grey weathering spots. All of it evenly spread over the whole frame: ' +
        'no single large stain, hole or feature. The frame shows a 1.2 m × 1.2 m area.',
    ),
  },
  {
    // Broken faces of marble and (tinted ochre) of limestone: near white, so the inside colour sets it.
    name: 'temple_marble_broken',
    prompt: tex(
      'Texture of freshly broken white marble, the raw fracture surface of a split marble block seen straight on: sugary crystalline calcite grains ' +
        '1 to 3 mm across that glint, a rough uneven fracture with angular facets, small steps and sharp ridges where it split, shallow conchoidal ' +
        'scoops, a dusting of white marble powder in the hollows, a few small loose chips. Bright pure white with only very faint pale grey; no ' +
        'weathered surface, no patina, no lichen, no coloured veins, no joints and no block edges. The frame shows a 0.6 m × 0.6 m patch.',
    ),
  },
  {
    // Ashlar blocks are separate pieces, so no joints in the map.
    name: 'temple_limestone',
    size: { width: 1536, height: 1536 },
    prompt: tex(
      'Texture of the dressed face of an ancient Greek building block of poros limestone, seen straight on: one continuous stone face filling the ' +
        'whole frame, with no joints, no mortar, no block edges and no seams. Pale cream to warm ochre porous shelly limestone: many small irregular ' +
        'holes and pores from 1 to 10 mm, a few small fossil shell fragments, faint fine claw-chisel tooling marks, soft weathering that has rounded ' +
        'the pores, gentle mottling of honey-ochre, buff and light grey, a few tiny dark lichen specks. Uniform density over the whole frame, no ' +
        'single large hole or stain. The frame shows a 1.5 m × 1.5 m area.',
    ),
  },
  {
    // 8 × 6 tiles of 0.55 × 0.733 m to pick from: textures.py cuts them out tile by tile and lays
    // 4 × 3 of them on an exact grid (2.2 m), cover tiles on the wrap and every quarter across.
    name: 'temple_roof_tiles',
    size: { width: 2048, height: 2048 },
    prompt: tex(
      'Texture of the terracotta tiled roof of an ancient Greek temple seen from directly above, the camera looking straight down at the roof plane: ' +
        'large flat rectangular pan tiles with low raised rims along their long sides, laid in straight columns running from the top edge to the ' +
        'bottom edge of the frame; over every joint between two columns a narrow ridged cover tile about 16 cm wide with a gabled, triangular ' +
        'cross-section runs in a perfectly straight vertical line through the whole frame. Each pan tile is 55 cm wide and 73 cm long; the lower end ' +
        'of each tile overlaps the top of the tile below with a straight horizontal edge and a thin shadow line, and the cover tiles join at the same ' +
        'lines, so the courses form straight level rows across the whole frame. Exactly 8 columns of tiles across and 6 courses from top to bottom, ' +
        'a perfectly regular grid: all cover tiles parallel and evenly spaced, all course lines level and evenly spaced. Matte sun-faded fired ' +
        'clay in orange-red and ochre, each tile a slightly different shade from light ochre-orange to brick red, a few darker brown tiles, ' +
        'dust in the corners, small pale grey lichen spots, a few chipped corners. The frame shows a 4.4 m × 4.4 m area.',
    ),
  },
  {
    // A 4 m tile over the whole plateau: the bedrock patches come from a separate set mixed in by
    // the scenery, so only small marks here, nothing that marks out the repeat.
    name: 'temple_ground',
    size: { width: 2048, height: 2048 },
    prompt: tex(
      'Texture of dry Mediterranean hilltop ground in late summer seen from directly above: sun-bleached straw-yellow and pale golden dry grass in ' +
        'low, sparse, flattened tufts, dry stalks and seed heads, small grey-green cushions of wild thyme, bare patches of pale ochre dusty soil ' +
        'between them, scattered small angular pale grey-white limestone pebbles and gravel from 1 to 6 cm, and a few small spots of pale grey ' +
        'bedrock no bigger than 30 cm showing through. Evenly mixed over the whole frame: no path, no large rock, no green lawn grass. ' +
        'The frame shows a 4 m × 4 m area.',
    ),
  },
  {
    // The breakable ground's earth: what a crater's sides and a clod's breaks show under the dry grass.
    // Take 1 (textures.py's TAKES): take 0 asked for stony soil, and its pale pebbles on red read as
    // speckled stone on a crater's faces and the clods
    name: 'temple_earth',
    prompt: tex(
      'Texture of a fresh vertical cut through dry, crumbly earth on a sunny Mediterranean hilltop, seen straight on: loose sun-dried soil in a ' +
        'soft warm ochre brown with a reddish tinge, broken into small rounded crumbs and clods of earth from a few millimetres to 4 cm, small ' +
        'dark gaps and pores between them, fine pale powdery dust settled in places, a few thin dry root threads, and only a few small pale ' +
        'pebbles here and there. Soft, matte and earthy, like dug soil dried by the sun: not stone, not gravel, no granite-like speckle. Evenly ' +
        'mixed over the whole frame: no layers or bands, no grass, no rocks, no holes. The frame shows a 1 m × 1 m area.',
    ),
  },
  {
    // The bedding under the court's marble flags: what a crater in the court shows under them
    name: 'temple_fill',
    prompt: tex(
      'Texture of the packed rubble bedding laid under ancient Greek marble paving, a broken face of it seen straight on: angular broken chips ' +
        'and fragments of white marble and pale cream limestone from 1 to 8 cm, densely packed, set in a pale grey-ochre lime mortar and fine ' +
        'stone dust, small dark voids between some fragments, a few small terracotta sherds. Evenly mixed over the whole frame: no layers, no ' +
        'whole stones bigger than 10 cm, no paving slabs. The frame shows a 1 m × 1 m area.',
    ),
  },
  {
    // Cypress and olive crowns, tinted per tree (dark green, silvery grey-green): light and close to
    // neutral, the leaves and the shade between clumps doing the work.
    name: 'temple_foliage',
    prompt: tex(
      'Texture of the dense evergreen foliage of a Mediterranean olive tree filling the whole frame, seen close up straight on: a thick mass of ' +
        'small narrow lance-shaped leaves 3 to 6 cm long on fine twigs, overlapping in every direction, many showing their pale silvery undersides, ' +
        'with small deep dark gaps of shade between the leaf clumps. Muted grey-green, fairly light and neutral in colour; no flowers, no fruit, no ' +
        'sky showing through, no trunk and no large branches. Uniform density over the whole frame. The frame shows a 1 m × 1 m patch.',
    ),
  },
];
