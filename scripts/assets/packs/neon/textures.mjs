// Neon Alley's texture sets: what to ask GPT Image 2.5 for. scripts/assets/packs/neon/textures.py
// says how each is made to tile (PACK=neon python3 -I scripts/assets/process-textures.py).
//
// The images are asked for bright and low in contrast: the materials tint them per building, and
// the night light and the neon do the rest of the colouring.

import { tex } from '../../textures.mjs';

/** @type {Array<{ name: string, prompt: string, size?: { width: number, height: number } }>} */
export const textures = [
  {
    // 12 x 12 tiles, so 10 x 10 can be cut out joint to joint (a 1 m set)
    name: 'neon_tile',
    size: { width: 1536, height: 1536 },
    prompt: tex(
      'Texture of an exterior wall clad in small square glazed ceramic tiles, the cladding of an old apartment tower in a humid East Asian city. ' +
        'Square tiles 9.5 cm across with light grey cement grout joints 5 mm wide, laid in stack bond: every joint runs straight through in both directions, ' +
        'a perfectly straight, square, evenly spaced grid with no offset rows. The tiles are off-white with a faint satin glaze, each tile a slightly different ' +
        'very pale shade between warm white, very pale grey and very pale blue-grey, a few tiles a little darker; grime collected in the grout lines, ' +
        'faint vertical rain streaks of grey dirt running down across some tiles, one or two hairline-cracked tiles. Bright and low in contrast. ' +
        'The frame shows a 1.2 m × 1.2 m area: exactly 12 tiles across and 12 tiles from top to bottom.',
    ),
  },
  {
    name: 'neon_concrete',
    prompt: tex(
      'Texture of a weathered cast-in-place concrete wall of an old city building in a rainy climate: smooth mid-grey concrete with fine pores and small ' +
        'air pits, darker grey water stains and streaks running down from above, pale whitish efflorescence in a few places, two or three patched repairs in ' +
        'a slightly different grey, faint hairline cracks. No formwork marks, no tie holes, no joints, no panel lines. Even and low in contrast. ' +
        'The frame shows a 2 m × 2 m area.',
    ),
  },
  {
    name: 'neon_render',
    prompt: tex(
      'Texture of an old painted cement render wall on a shophouse in a humid East Asian city: sand-cement render with a fine trowelled texture, painted a ' +
        'faded very light warm grey, almost white; the paint chalky and mottled, soft greyish damp patches, faint dark grey-green mould streaks trickling down ' +
        'from above, a few fine hairline cracks, two or three small patches where the paint has flaked off to bare grey cement. Bright and low in contrast. ' +
        'The frame shows a 2 m × 2 m area.',
    ),
  },
  {
    name: 'neon_asphalt',
    prompt: tex(
      'Texture of an old asphalt alley pavement seen from directly above, just after rain: dark grey asphalt with fine grey aggregate stones, a few slightly ' +
        'darker patched repairs with straight edges, thin cracks sealed with black tar, and several shallow puddles of standing water in the low spots, ' +
        'together covering about a quarter of the area: irregular rounded shapes from 20 cm to 1 m across, their water very smooth, dark and plain, the ' +
        'asphalt under them darker and blurred. No reflections of sky or lights in the water, no painted lines, no manholes, no drains, no leaves or litter. ' +
        'The frame shows a 4 m × 4 m area.',
    ),
  },
  {
    name: 'neon_shutter',
    prompt: tex(
      'Texture of a corrugated steel roller shutter on a shop front, seen straight on: horizontal interlocking slats, each 7.5 cm tall, each with a ' +
        'shallow rounded corrugation and a narrow dark seam where it hooks into the next; all slats perfectly horizontal, straight, parallel and evenly ' +
        'spaced, running right through the left and right edges. Dull light grey galvanised zinc with faded pale grey-green paint worn off in places, fine ' +
        'scratches and scuffs, grime collected along the seams, small orange-brown rust spots and short rust streaks at the seams. No lock, no handle, no ' +
        'bottom bar, no graffiti, no stickers. The frame shows a 1.2 m × 1.2 m area: exactly 16 slats from top to bottom.',
    ),
  },
  {
    name: 'neon_metal',
    prompt: tex(
      'Texture of weathered painted sheet steel, a flat panel seen straight on: very light grey enamel paint, slightly glossy, with light grime, a few ' +
        'small chipped spots showing orange-brown rust with short rust streaks running down from them, scuffs, and a few thin bright scratches through to ' +
        'bare metal. Mostly clean, intact light grey paint. No panel seams, no rivets, no bolts, no edges, no dents. The frame shows a 1 m × 1 m area.',
    ),
  },
];
