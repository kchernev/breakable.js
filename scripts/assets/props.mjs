// The street props: what to ask GPT Image 2.5 for (a concept image), what to ask Meshy for (the 3D
// model made from that image), and how scripts/assets/process-props.py turns the raw model into a
// game-ready GLB in public/models (real-world size, orientation, triangle and texture budgets, and
// the mass and description that go into public/models/index.json).
//
// generate-props.mjs makes assets-src/props/raw/<name>/concept<i>.png and model.glb; process-props.py
// reads this file through node (so it is the one list of props) and writes public/models/<name>.glb.
//
// `pick`, `inpaint`, `yaw` and `paintOut` were set by looking at the particular raw files in
// assets-src/props/raw (each concept's .json keeps the prompt it was made with); after regenerating a
// prop, look at its concept and previews again and redo them.

// What every concept prompt asks for: one whole object, posed and lit the way image-to-3D likes it.
export const studio = (bg) =>
  'Product photo for 3D reconstruction: exactly one object, shown whole and centred with a generous empty margin on every side, nothing cropped. ' +
  'Three-quarter front view from slightly above (camera about 20 degrees above the horizon and about 35 degrees off the front axis), a long lens with little perspective distortion. ' +
  `Isolated on a plain, seamless, uniform ${bg} background. ` +
  'Soft, even, diffuse studio lighting from all around: no harsh highlights, ' +
  'no cast shadow or contact shadow, no floor, no reflections of surroundings. No other objects, no people, no text, no lettering, no numbers, ' +
  'no logos, no badges, no watermark. Photorealistic, sharp, accurate real-world proportions and materials.';

export const concept = (s, bg = 'pure white') => `${s} ${studio(bg)}`;

// Meshy settings shared by every prop (see generate-props.mjs); a prop can override any of them.
export const meshyDefaults = {
  model_type: 'standard',
  topology: 'triangle',
  target_polycount: 30000,
  should_remesh: true,
  should_texture: true,
  enable_pbr: true,
  symmetry_mode: 'auto',
};

/**
 * @typedef {object} Prop
 * @property {string} name          file name stem in public/models
 * @property {string} prompt        concept image prompt
 * @property {{width:number,height:number}} imageSize
 * @property {number} pick          which concept take goes to 3D (concept<pick>.png)
 * @property {Array<{box:number[],offset:number[]}>} [inpaint]  regions painted out of the concept before 3D (props-inpaint.py)
 * @property {object} meshy         Meshy input overrides (merged over meshyDefaults); texture_prompt guides the texture
 * @property {'length'|'height'} fit  scale so the longest horizontal side (length) or the height matches `metres`
 * @property {number} metres
 * @property {number} yaw           degrees about +Y applied after auto-alignment so the front faces -Z (three.js)
 * @property {Array<number[][]>} [paintOut]  boxes [[x0,y0,z0],[x1,y1,z1]] (final frame, m) whose texture is painted over with the paint around them (made-up badges/lettering)
 * @property {number[]} [scale]     [x, y, z] stretch after it's fitted to `metres` (three.js axes)
 * @property {number[]} [roughness] [min, max] its metal/rough map (or values) is kept within; also [metalness]
 * @property {{hue:number[],minSat?:number,grow?:number}} [paint]  its paint made tintable per copy (addProp's tint): hues [from, to] in degrees; `grow` texels of its rims and the light grey round it (panel gaps) count as paint
 * @property {Array<{box:number[][],minLuma?:number,color?:number[]|'map',strength?:number}>} [glow]  emissive where its texels are bright in these boxes
 * @property {'x'|'y'|'z'} [round]  collides as a prism round that axis (a drum standing: 'y', a reel on its side: 'x'), of `sides` (default 16, which rolls; 6 doesn't)
 * @property {Array<{box:number[][],round?:'x'|'y'|'z',sides?:number}>} [parts]  collides as a hull of each box's vertices (final frame, m; the first the main body), welded: a forklift's body and forks
 * @property {number} maxTriangles
 * @property {number} textureSize   largest texture edge in the final GLB
 * @property {number} mass          solver mass (density units where water = 1, so ~tonnes)
 * @property {string} description
 */

/** @type {Prop[]} */
export const props = [
  {
    name: 'taxi',
    prompt: concept(
      'A New York City yellow taxi cab: a 2010s Ford Crown Victoria-style full-size four-door sedan with a long boxy body, painted glossy bright taxi yellow, ' +
        'black plastic bumpers and side trim, a little chrome around the grille, dark tinted windows (no interior visible), black tyres on plain steel wheels with simple ' +
        'silver hub caps, front wheels pointing straight ahead. On the roof a two-sided rectangular taxi roof sign box (blank light panels, no lettering). ' +
        'Clean, not damaged. Blank licence plates.',
    ),
    imageSize: { width: 1536, height: 1024 },
    pick: 0,
    meshy: { texture_prompt: 'New York yellow taxi cab, glossy taxi-yellow car paint, dark tinted glass, black rubber tyres, steel wheels with silver hub caps, black bumpers, white roof sign box' },
    fit: 'length',
    metres: 4.9,
    yaw: 180,
    paintOut: [[[-0.16, 0.845, 2.0], [0.16, 0.905, 2.6]]], // made-up lettering across the trunk lid
    maxTriangles: 20000,
    textureSize: 2048,
    mass: 1.4,
    description: 'New York yellow cab (Crown Victoria-style sedan with roof sign), parked.',
  },
  {
    name: 'sedan',
    prompt: concept(
      'An ordinary parked 2010s mid-size four-door family sedan (generic shape like a Toyota Camry or Honda Accord), metallic dark navy blue paint, ' +
        'dark tinted windows (no interior visible), body-colour bumpers, black tyres on five-spoke silver alloy wheels, front wheels pointing straight ahead. ' +
        'Clean, not damaged. Blank licence plates.',
    ),
    imageSize: { width: 1536, height: 1024 },
    pick: 0,
    meshy: { texture_prompt: 'dark navy blue metallic car paint, dark tinted glass, black rubber tyres, silver alloy wheels, chrome trim' },
    fit: 'length',
    metres: 4.8,
    yaw: 0,
    paintOut: [[[0.05, 0.975, 2.0], [0.175, 1.105, 2.6]]], // a made-up maker's badge on the trunk
    paint: { hue: [195, 255], grow: 3 }, // its navy tintable: Brick Street's sedans in many colours
    maxTriangles: 20000,
    textureSize: 2048,
    mass: 1.4,
    description: 'Ordinary 2010s four-door sedan in dark navy blue, parked.',
  },
  {
    name: 'hydrant',
    prompt: concept(
      'A classic New York City cast-iron sidewalk fire hydrant: a stout cylindrical barrel painted glossy red with a round flanged base ring, ' +
        'a domed bonnet on top with a pentagonal operating nut, two side hose outlets with chained caps and one larger front outlet cap, ' +
        'the bonnet and all caps painted silver. Slightly worn paint.',
    ),
    imageSize: { width: 1024, height: 1024 },
    pick: 0,
    meshy: { texture_prompt: 'red painted cast iron fire hydrant, silver painted bonnet and caps, slightly worn paint', target_polycount: 10000 },
    fit: 'height',
    metres: 0.75,
    yaw: 180, // the big pumper outlet to the front
    maxTriangles: 5000,
    textureSize: 1024,
    mass: 0.15,
    description: 'Classic NYC fire hydrant, red with silver bonnet and caps.',
  },
  {
    name: 'trashcan',
    prompt: concept(
      'The classic New York City sidewalk litter basket: a round, open-top, slightly tapered steel basket painted dark green, about waist high, ' +
        'with thick solid horizontal steel hoops at the rolled top rim, around the middle and at the bottom, and a solid green band at the base. ' +
        'Its wall is a fine, dense diagonal woven wire mesh (small diamond openings about 3 cm across, thin wires), pressed tight against a ' +
        'full black plastic bin liner inside, so the basket reads as a solid, smooth-sided tapered drum with a fine green mesh pattern over black; ' +
        'nothing can be seen through it.',
    ),
    imageSize: { width: 1024, height: 1024 },
    pick: 2, // earlier prompts: 0 was a wide square lattice, not the NYC basket; 1 a diamond lattice whose holes Meshy carved into spikes (raw/trashcan/rejected)
    meshy: { texture_prompt: 'dark green painted steel wire mesh litter basket with a black plastic liner bag inside', target_polycount: 10000 },
    fit: 'height',
    metres: 0.9,
    yaw: 0,
    maxTriangles: 5000,
    textureSize: 1024,
    mass: 0.03,
    description: 'NYC green wire-mesh litter basket with a black liner (the mesh is in the texture).',
  },
  {
    name: 'mailbox',
    prompt: concept(
      'A blue US street mail collection box: the classic heavy steel box painted dark blue, a rounded domed top, a pull-down mail slot door with a handle ' +
        'on the upper front, a smaller access door below it, standing on four short angled steel legs. Plain paint, no labels.',
    ),
    imageSize: { width: 1024, height: 1024 },
    pick: 0,
    meshy: { texture_prompt: 'dark blue painted steel mail collection box, slightly worn paint, grey steel legs', target_polycount: 10000 },
    fit: 'height',
    metres: 1.25,
    yaw: 180, // the mail slot to the front
    maxTriangles: 5000,
    textureSize: 1024,
    mass: 0.1,
    description: 'Blue US street mail collection box on four legs (no lettering).',
  },
  {
    name: 'van',
    prompt: concept(
      'A plain white full-size delivery cargo van (generic Ford Transit-style high-roof panel van), solid side panels without rear side windows, ' +
        'dark tinted cab windows, black plastic bumpers and mirrors, black tyres on steel wheels, front wheels pointing straight ahead. ' +
        'Clean, not damaged. Blank licence plates.',
      'medium grey', // a white van on white would lose its outline
    ),
    imageSize: { width: 1536, height: 1024 },
    pick: 0,
    inpaint: [{ box: [1084, 586, 1144, 624], offset: [-58, 0] }], // an oval badge on the grille, cloned over from the grille beside it
    meshy: { texture_prompt: 'plain white painted cargo van, dark tinted glass, black plastic bumpers, black tyres, steel wheels' },
    fit: 'length',
    metres: 5.5,
    yaw: 0,
    maxTriangles: 20000,
    textureSize: 2048,
    mass: 2.5,
    description: 'Plain white Transit-style delivery van, parked.',
  },
];
