// Harbor Yard's texture sets (PACK=harbor): what to ask GPT Image 2.5 for. textures.py next to
// this turns them into tiling maps in public/packs/harbor/textures.
//
// Everything a tint colours (containers, painted steel, the roller door) is asked for pale and
// neutral, so the per-piece tint gives the colour.

import { tex } from '../../textures.mjs';

/** @type {Array<{ name: string, prompt: string, size?: { width: number, height: number } }>} */
export const textures = [
  {
    // textures.py lays out the whole ribs it finds (6 in take 0: a 1.71 m tile at 28.5 cm a rib)
    name: 'harbor_container',
    size: { width: 1536, height: 1536 },
    prompt: tex(
      'Texture of the side wall of an old steel shipping container seen straight on: corrugated steel sheet with trapezoidal corrugations running ' +
        'vertically from top to bottom, perfectly straight, parallel and evenly spaced: flat outer crests and flat inner valleys of about the same width, ' +
        'joined by short sloping faces, about 3.5 cm deep. Seven full corrugations across the frame, one every 28.5 cm. The corrugations run straight ' +
        'through the top and bottom edges. Painted light neutral grey, almost white, with no colour cast; the paint faded, chalky and weathered by sea air: ' +
        'small rust spots and rust blooms at dents and along a few corrugation edges, thin rust-brown streaks and grey grime streaks running down from them, ' +
        'scuffs and scrapes, a few shallow dents. No markings, no text, no numbers, no logos, no stickers, no rails, no frame, no door hardware: only the ' +
        'corrugated sheet. The frame shows a 2 m × 2 m area.',
    ),
  },
  {
    // The warehouse's walls and roof: a box profile (narrow ribs, wide pans), not a container's
    // (4 whole ribs in take 0: a 1 m tile)
    name: 'harbor_cladding',
    size: { width: 1536, height: 1536 },
    prompt: tex(
      'Texture of the wall of an industrial warehouse clad in steel trapezoidal profile sheeting, seen straight on: narrow raised trapezoidal ribs ' +
        'running vertically from top to bottom, each about 4 cm wide on top and 3.5 cm high with sloping sides, one every 25 cm, separated by wide flat ' +
        'pans; all ribs perfectly straight, parallel and evenly spaced, running straight through the top and bottom edges. Six ribs across the frame. ' +
        'Factory-painted coating in light neutral grey, almost white, with no colour cast; weathered by sea air: chalky and faded, faint grey dirt ' +
        'streaks running down from the top, a few small dents, a few small scratches, very little rust. No fasteners, no screws, no joints, no ' +
        'markings, no text. The frame shows a 1.5 m × 1.5 m area.',
    ),
  },
  {
    name: 'harbor_steel_painted',
    prompt: tex(
      'Texture of painted structural steel plate seen straight on: a flat steel surface coated in pale neutral grey industrial paint, almost white, with no ' +
        'colour cast, old and weathered by sea air: mostly intact paint with a faint brush and roller texture, chipped and scraped in places showing dark ' +
        'grey primer and orange-brown rust, a few small rust blooms with short rust streaks running down, grime and dust in patches, a few thin scratches ' +
        'to bare metal. No bolts, no rivets, no welds, no seams, no edges, no markings. The frame shows a 1 m × 1 m patch.',
    ),
  },
  {
    // 4 × 4 slabs, of which textures.py re-lays 2 × 2 (an 8 m tile) with thinner joints
    name: 'harbor_yard_concrete',
    size: { width: 2048, height: 2048 },
    prompt: tex(
      'Texture of the heavy-duty concrete pavement of a container port yard seen from directly above: a regular grid of 4 × 4 square grey concrete slabs, ' +
        'each 4 m square, separated by straight, narrow sawn joints filled with dark sealant, all joints perfectly straight, parallel and evenly spaced. ' +
        'Smooth power-trowelled concrete, worn and weathered, wet after rain: darker damp patches and a few shallow puddles lying in slight dips (dark and ' +
        'smooth, no reflections), dark oil stains and drips, faint black tyre marks, scuffs and scrapes from container corners, a few fine hairline cracks, ' +
        'some slabs a little lighter or darker than others. No paint markings. The frame shows a 16 m × 16 m area.',
    ),
  },
  {
    // The crushed stone under the yard's slabs (the breakable ground's lower layer), seen in a crater
    name: 'harbor_gravel',
    prompt: tex(
      'Texture of a compacted crushed-stone sub-base under a concrete pavement, seen from directly above: grey angular crushed granite aggregate, ' +
        'stones 10 to 40 mm with sharp broken edges in mid and dark greys with a few bluish and pale ones, packed with finer grit, sand and grey stone ' +
        'dust between them, a few larger stones up to 60 mm, slightly damp, dusty. Evenly spread, no soil, no plants, no larger rocks, no colour cast. ' +
        'The frame shows a 1 m × 1 m patch.',
    ),
  },
  {
    name: 'harbor_pallet_wood',
    prompt: tex(
      'Texture of rough-sawn pallet timber seen straight on: a continuous surface of pale yellow-beige spruce wood with the grain running straight from left ' +
        'to right across the whole frame, no gaps and no joints between boards, like one very wide plank: coarse, fibrous rough-sawn surface with faint ' +
        'curved circular-saw marks, a few small dark knots, slight grey weathering in places, dirt smudges and scuffs, two or three small rusty nail heads. ' +
        'The frame shows a 1 m × 1 m patch.',
    ),
  },
  {
    // textures.py lays out the whole slats it finds (9 in take 0)
    name: 'harbor_roller_door',
    prompt: tex(
      'Texture of a galvanised steel roller shutter door curtain seen straight on: identical horizontal interlocking slats running straight from the left ' +
        'edge to the right edge, each slat about 8 cm tall with a gently rounded convex face and a narrow dark hinge groove between slats, all perfectly ' +
        'straight, parallel and evenly spaced. Dull matte zinc-grey galvanised steel, weathered: grime and dark dirt collected in the grooves, faint ' +
        'vertical dirt streaks, a few faint dents and scratches. No frame, no guide rails, no bottom bar, no handles, no locks, no markings. ' +
        'The frame shows a 1 m × 1 m area: 12 slats from top to bottom.',
    ),
  },
];
