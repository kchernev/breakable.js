// The generated texture sets: what to ask GPT Image 2.5 for. scripts/assets/process-textures.py
// turns the raw images into the PBR maps in public/textures (<set>_diff/nor_gl/arm_1k.webp).
//
// The prompts state the real-world size of the frame, since the maps are box-projected at a fixed
// number of repeats per metre: a brick wall's bricks have to come out brick-sized.

// What every prompt asks for, so the image is usable as an albedo map and close to tiling already.
export const TILE =
  'Seamless tileable texture: the left edge continues into the right edge and the top edge into the bottom edge. ' +
  'Orthographic view, camera exactly perpendicular to the surface, no perspective. ' +
  'Flat, even, diffuse overcast lighting: no directional light, no cast shadows, no highlights, no vignette. ' +
  'The surface fills the whole frame edge to edge, uniform density everywhere; no borders, no text, no logos, no watermark, nothing in front of it. ' +
  'Photographic albedo texture for a PBR material, sharp and highly detailed.';

export const tex = (s) => `${s} ${TILE}`;

/** @type {Array<{ name: string, prompt: string, size?: { width: number, height: number } }>} */
export const textures = [
  {
    name: 'gen_brick_broken',
    prompt: tex(
      'Texture of the inside of broken brick masonry, a fracture surface seen straight on: crushed, freshly broken red-orange fired clay with a grainy, porous, ' +
        'sandy texture, angular chips and broken faces of brick of many sizes, embedded chunks and crumbs of grey-white lime mortar, brick dust. ' +
        'No wall pattern, no whole bricks, no mortar joints in rows. The frame shows a 1 m × 1 m patch.',
    ),
  },
  {
    name: 'gen_concrete_broken',
    prompt: tex(
      'Texture of freshly fractured concrete seen straight on: rough grey cement paste with exposed, broken gravel aggregate of mixed sizes (5 to 25 mm, ' +
        'grey, beige and dark stones, some split through), sand grains, small air voids and pits, faint orange-brown rust staining in a few spots. ' +
        'The frame shows a 1 m × 1 m patch.',
    ),
  },
  {
    name: 'gen_iron_painted',
    prompt: tex(
      'Texture of an old New York fire escape surface: a flat sheet of wrought iron with many layers of thick glossy black paint, worn and weathered: ' +
        'chipped and flaking paint revealing orange-brown rust underneath in scattered patches, rust streaks and drips, bubbled paint, grime and dust ' +
        'in the low spots, a few thin bright scratches to bare grey metal. Mostly intact black paint. The frame shows a 1 m × 1 m patch.',
    ),
  },
  {
    name: 'gen_wood_painted',
    prompt: tex(
      'Texture of weathered painted wood: vertical wooden boards about 12 cm wide running top to bottom with thin dark gaps between them, covered in old ' +
        'off-white cream paint that is cracked, peeling and flaking, revealing silver-grey weathered wood with a strong vertical grain underneath. ' +
        'The boards run straight through the top and bottom edges. The frame shows a 1 m × 1 m patch, about 8 boards across.',
    ),
  },
  {
    name: 'gen_brick_brown',
    size: { width: 1536, height: 1536 },
    prompt: tex(
      'Texture of a New York City tenement facade: a wall of dark chocolate-brown face brick laid in running bond (each course offset by exactly half a brick), ' +
        'with slightly recessed light grey mortar joints about 1 cm wide. Standard bricks 21.5 cm long and 6.5 cm tall. The frame shows a 2 m × 2 m area: ' +
        '9 bricks across each course and 30 courses from top to bottom, perfectly straight, level and evenly spaced like a regular grid. ' +
        'Subtle variation between bricks from dark chocolate to reddish brown, light soot and weathering, a few chipped edges.',
    ),
  },
  {
    // Bigger than the 2 m tile it makes, for more bricks to pick from (process-textures.py re-lays them)
    name: 'gen_brick_painted',
    size: { width: 2048, height: 2048 },
    prompt: tex(
      'Texture of an old New York City brick wall painted cream off-white: running bond brickwork (each course offset by exactly half a brick) with slightly ' +
        'recessed mortar joints about 1 cm wide, bricks and mortar all painted over with the same cream paint. The paint is old and unevenly worn: ' +
        'most bricks are still fully painted, some have irregular worn and flaked patches of different sizes anywhere on their faces and along random edges ' +
        'showing the red brick underneath, a few have larger bare areas; faint grime and dirt streaks. Standard bricks 21.5 cm long and 6.5 cm tall. ' +
        'The frame shows a 2.7 m × 2.7 m area: 12 bricks across each course and 40 courses from top to bottom, perfectly straight, level and evenly ' +
        'spaced like a regular grid.',
    ),
  },
  {
    // 4 × 4 flags so that 2 × 2 of them can be cut out joint to joint, away from the image's edges.
    name: 'gen_sidewalk',
    size: { width: 2048, height: 2048 },
    prompt: tex(
      'Texture of a New York City concrete sidewalk seen from directly above: a regular grid of 4 × 4 square light grey concrete flags, each 1.5 m square, ' +
        'separated by straight, narrow tooled joints with rounded edges, all joints perfectly straight, parallel and evenly spaced. ' +
        'Fine broom-finished concrete, faint stains and discolouration, a few dark flattened chewing gum spots, a couple of hairline cracks. ' +
        'The frame shows a 6 m × 6 m area.',
    ),
  },
];
