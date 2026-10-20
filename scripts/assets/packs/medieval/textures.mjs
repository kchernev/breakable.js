// Market Town's generated texture sets (GPT Image 2.5): what Poly Haven has no jointless or broken
// version of. textures.py next to this turns them into maps; the Poly Haven sets the world also uses
// come from polyhaven.py. Each prompt states the frame's real size, which is the tile's size.

import { tex } from '../../textures.mjs';

/** @type {Array<{ name: string, prompt: string, size?: { width: number, height: number } }>} */
export const textures = [
  {
    // Timbers are 0.16 to 0.22 m wide, so each shows a strip of this: it is one surface, not boards.
    // Light, since the world tints it per house from silver-grey down to tarred brown.
    name: 'medieval_oak',
    prompt: tex(
      'Texture of old weathered hand-hewn oak timber from a medieval timber-framed house, seen straight on: one broad continuous flat face of solid oak ' +
        'that fills the frame, with no edges, no gaps, no joints and no separate boards. Silver-grey to light grey-brown sun-bleached oak with a deep, ' +
        'straight, open grain running vertically from the top edge to the bottom edge, long narrow drying checks and splits following the grain (thin dark ' +
        'cracks, some up to 40 cm long), shallow flat adze facets across the face, two small round old peg holes. No knots bigger than a coin, no paint, ' +
        'no nails, no metal. The frame shows a 1 m × 1 m patch.',
    ),
  },
  {
    // Ashlar blocks are separate pieces: the joints are the gaps between them, so none in the map.
    name: 'medieval_limestone',
    prompt: tex(
      'Texture of a single huge dressed face of warm honey-cream oolitic limestone (like Cotswold building stone), seen straight on: one continuous ' +
        'smooth-dressed stone surface filling the whole frame, with no joints, no mortar, no block edges, no seams and no cracks. Fine shallow parallel ' +
        'diagonal tooling marks from a claw chisel over the whole face, gentle mottled colour variation from pale cream to honey-ochre and light buff, ' +
        'tiny pits and sand-sized ooid grains, faint fossil shell specks, light weathering, a few small pale grey-green and yellow lichen spots. ' +
        'The frame shows a 1.5 m × 1.5 m area.',
    ),
  },
  {
    name: 'medieval_limestone_broken',
    prompt: tex(
      'Texture of freshly fractured limestone seen straight on: the raw inside of a broken block of pale cream oolitic limestone, rough granular ' +
        'crystalline stone with sparkling fine grains, shallow conchoidal facets, small steps and ridges where it split, a few small fossil shell ' +
        'fragments, scattered pale rock dust and tiny loose chips in the hollows. No weathered surface, no lichen, no moss, no joints, no mortar, no ' +
        'block edges. The frame shows a 0.8 m × 0.8 m patch.',
    ),
  },
  {
    name: 'medieval_daub_broken',
    prompt: tex(
      'Texture of broken wattle-and-daub seen straight on: the crumbled inside of a medieval timber-frame wall panel. Crumbly brown-ochre clay daub ' +
        'mixed with lots of chopped golden straw fibres, broken lumps and clods, cracks and pores, clay dust; thin hazel wattle rods 2 to 3 cm thick with ' +
        'grey-brown bark, woven horizontally, showing through the clay in a few places. A few flakes of white lime plaster at most. ' +
        'The frame shows a 0.8 m × 0.8 m patch.',
    ),
  },
  {
    name: 'medieval_hay',
    prompt: tex(
      'Texture of the side of a tightly compressed rectangular straw bale, seen straight on: dense tangled dry golden straw filling the whole frame, ' +
        'stalks mostly lying horizontal with some crossing at angles, hollow stems 3 to 5 mm thick, a mix of golden yellow, paler cream and some greyer ' +
        'older stalks, a few broken ends and bits of chaff. No twine, no strings, no edges of the bale, no green grass. ' +
        'The frame shows a 1 m × 1 m patch.',
    ),
  },
  {
    // Near white, since the stalls tint it (madder red, woad blue, weld yellow, green or left undyed)
    name: 'medieval_canvas',
    prompt: tex(
      'Texture of coarse undyed linen canvas, as used for medieval market stall awnings, lying flat and seen straight on: a clearly visible plain ' +
        'weave of thick, slightly irregular natural off-white threads (about 4 threads per centimetre each way), small slubs and thicker threads here ' +
        'and there, very faint soft creases, a few faint pale water marks and light grey dirt marks. Almost white overall. ' +
        'The frame shows a 0.5 m × 0.5 m patch.',
    ),
  },
];
