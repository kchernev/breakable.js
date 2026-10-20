// Dust Town's texture sets (GPT Image 2.5). scripts/assets/packs/western/textures.py turns them into
// the maps in public/packs/western/textures. Paint is pale and neutral: the buildings' colours come
// from per-piece tints. Nothing that would repeat visibly per tile (a stain along one edge, one big
// stone, a single knot) is asked for, since every set is tiled over whole walls and the street.

import { tex } from '../../textures.mjs';

/** @type {Array<{ name: string, prompt: string, size?: { width: number, height: number } }>} */
export const textures = [
  {
    // Taller than wide for 10 boards to pick 6 from (textures.py re-lays them to an exact 0.90 m tile)
    name: 'western_siding',
    size: { width: 1024, height: 1536 },
    prompt: tex(
      'Texture of the weathered clapboard wall of an old frontier-town building in the desert: horizontal lap siding, long wooden boards running perfectly ' +
        'straight and level from the left edge to the right edge with no board ends or joints, each board 15 cm tall, its thick lower edge lapping over the ' +
        'top of the board below with a thin straight dark shadow line under it. Old chalky off-white paint, sun-bleached and finely cracked all over, ' +
        'with many small flakes of paint missing (1 to 5 cm across) scattered evenly over every board, showing silver-grey bare wood with a fine grain ' +
        'running along the boards (left to right). About two thirds of the paint is left everywhere: no large bare areas and no large unbroken painted ' +
        'areas, the same wear across the whole wall. A few small rusty nail heads with faint rust streaks below them, faint dust in the cracks. ' +
        'The frame shows a 1.0 m wide by 1.5 m tall patch: exactly 10 boards from top to bottom, all the same height, evenly spaced like ruled lines.',
    ),
  },
  {
    name: 'western_timber',
    size: { width: 1536, height: 1536 },
    prompt: tex(
      'Texture of the face of an old rough-sawn timber beam, bleached by decades of desert sun: silver-grey to grey-brown wood with the grain running ' +
        'perfectly straight from the top edge to the bottom edge, raised grain ridges where the soft wood has eroded, long narrow weathering checks and ' +
        'cracks along the grain, fuzzy torn fibres, two or three small dark knots, a few old nail holes with small rust stains. One continuous piece of ' +
        'wood: no board gaps, no joints, no paint, no edges. The frame shows a 1 m × 1 m patch.',
    ),
  },
  {
    name: 'western_tin',
    size: { width: 1536, height: 1536 },
    prompt: tex(
      'Texture of an old sheet of corrugated galvanised iron roofing seen straight on: rounded corrugations running perfectly straight and vertical from ' +
        'the top edge to the bottom edge, evenly spaced, exactly 13 ridges across the frame (7.6 cm apart). Dull weathered grey zinc with a mottled ' +
        'white-grey bloom, scattered patches of orange-brown rust of different sizes, thin rust streaks running down the valleys, a horizontal row of ' +
        'roofing nails across the sheet with rust around each nail head. The corrugations show only as soft, faint shading. ' +
        'The frame shows a 1 m × 1 m patch.',
    ),
  },
  {
    name: 'western_adobe',
    size: { width: 1536, height: 1536 },
    prompt: tex(
      'Texture of an old adobe wall in the desert: hand-smoothed earthen mud plaster, warm tan-ochre, gently uneven with soft trowel and hand marks, ' +
        'fine hairline shrinkage cracks, flecks of chopped straw and small pits all over, and three or four small rain-eroded patches scattered across ' +
        'the wall where the plaster has fallen away and the sun-dried mud bricks beneath show (brick faces about 40 cm × 10 cm, with thick mud joints). ' +
        'Gentle mottling, even in colour from top to bottom: no damp stains, no edges, no openings. The frame shows a 2 m × 2 m area.',
    ),
  },
  {
    name: 'western_dirt',
    size: { width: 2048, height: 2048 },
    prompt: tex(
      'Texture of a packed, dry desert dirt road seen from directly above: pale tan-ochre compacted earth with a fine dusty surface, faint hairline ' +
        'cracks, tiny pebbles and gravel (1 to 3 cm, so very small in this frame) and grit spread evenly everywhere, a few tiny bits of dry straw, soft ' +
        'scuffs. No large stones, no wheel tracks, no tyre marks, no footprints, no puddles, no plants. The frame shows a 4 m × 4 m area.',
    ),
  },
  {
    // The earth under the street (street.ts): a crater's floor and sides, and its clods' broken faces
    name: 'western_earth',
    size: { width: 1536, height: 1536 },
    prompt: tex(
      'Texture of freshly dug dry desert earth seen straight on, as on the floor and sides of a fresh hole: loose, crumbly reddish-brown soil broken ' +
        'into clods and crumbs of every size from 1 to 6 cm, with dark shadowed gaps between them, a scattering of small angular pale stones and gravel ' +
        '(1 to 3 cm) and a few white flecks of caliche, dusty. No plants, no roots, no large stones, no tool marks, even in colour from edge to edge. ' +
        'The frame shows a 1 m × 1 m area.',
    ),
  },
  {
    // The street's packed dirt where it breaks (street.ts): a crater's upper rim, its clods' faces
    name: 'western_dirt_broken',
    size: { width: 1536, height: 1536 },
    prompt: tex(
      'Texture of the freshly broken edge of packed desert dirt and sand, the crumbled fracture seen straight on: pale tan-ochre sandy soil broken into ' +
        'soft lumps and crumbs from 1 to 5 cm with small shadowed hollows between them, loose dry sand grains spilling over them, a few tiny pebbles. ' +
        'Dry and dusty, lighter and yellower than red earth. No plants, no roots, no large stones, no tool marks, even in colour from edge to edge. ' +
        'The frame shows a 1 m × 1 m area.',
    ),
  },
  {
    name: 'western_splinter',
    prompt: tex(
      'Texture of the inside of a freshly broken old pine board, the torn fracture surface seen straight on: pale cream-yellow raw wood fibres torn ' +
        'apart, long splinters and slivers running along the grain from the top edge to the bottom edge, ragged torn fibre ends, a few darker grey-brown ' +
        'weathered streaks and thin amber resin streaks. The frame shows a 0.5 m × 0.5 m patch.',
    ),
  },
];
