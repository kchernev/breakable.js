// Market Town's props (public/packs/medieval/models): barrels, handcarts, a hay wagon and baskets of
// apples. They rest until thrown and never break, so what should break (crates, hay bales, stall
// counters) is built from pieces in src/demo/worlds/medieval, not here.
//
// The fields are the base list's (scripts/assets/props.mjs). All four go through Tripo P2, then
// fix-props.py (beside this file) repairs the raw models before process-props.py: the gutter fill for
// all, the barrel's invented taps, the handcart's wheels and axle, the wagon's pale hay. `pick` and
// `yaw` were set by looking at assets-src/packs/medieval/props (the concepts and the previews); after
// regenerating a prop, look again and redo them and its entry in fix-props.py.
//
//   PACK=medieval node scripts/assets/generate-props.mjs concept | 3d
//   PACK=medieval blender -b --factory-startup --python scripts/assets/packs/medieval/fix-props.py
//   PACK=medieval blender -b --factory-startup --python scripts/assets/process-props.py

import { concept } from '../../props.mjs';

export const generator = 'tripo';

/** @type {import('../../props.mjs').Prop[]} */
export const props = [
  {
    name: 'barrel',
    prompt: concept(
      'A medieval oak storage barrel standing upright on one end, about 90 cm tall and 60 cm across at the bulge: ' +
        'about eighteen narrow staves of weathered oak, grey-brown with darker seams between them, bulging gently in the middle; ' +
        'three dark wrought-iron hoops near each end, slightly rusty, with a few rivet heads; a closed flat head of oak boards ' +
        'set a little below the stave ends at the top. Old and used but sound: faint water stains and grime near the bottom. ' +
        'No bung, no tap, no markings, no brand.',
    ),
    imageSize: { width: 1024, height: 1024 },
    pick: 0,
    fit: 'height',
    metres: 0.9,
    yaw: 0,
    maxTriangles: 7000, // at 4000 decimation stretched faces near the cloned staves over a dark UV-island edge
    textureSize: 1024,
    mass: 0.14,
    // Collides as a 16-sided drum round its axis: knocked over, it rolls
    round: 'y',
    description: 'Oak barrel with three iron hoops at each end, closed, standing upright.',
  },
  {
    name: 'handcart',
    prompt: concept(
      'An empty medieval two-wheeled wooden market handcart, parked level: a flat rectangular bed of oak planks about 1.4 m long ' +
        'and 0.9 m wide with low plank sides about 25 cm high on the left, right and front, open at the back; two long straight ' +
        'square-section shafts run along under the bed and stick out about 1 m past its front as handles, ending in rounded grips; ' +
        'two large wooden wheels about 1 m across, one on each side under the middle of the bed, each with eight thick spokes, ' +
        'a turned wooden hub and a dark iron tyre; a pair of short wooden legs under the front of the bed so it stands level. ' +
        'Weathered silver-brown oak, dark iron nails and straps at the corners.',
    ),
    imageSize: { width: 1536, height: 1024 },
    pick: 0,
    fit: 'length',
    metres: 2.4,
    yaw: 0,
    maxTriangles: 10000,
    textureSize: 2048,
    mass: 0.12,
    description: 'Empty two-wheeled wooden market handcart, standing level on its front legs; handles toward -Z.',
  },
  {
    name: 'haywagon',
    prompt: concept(
      'A medieval four-wheeled wooden farm wagon loaded with loose golden hay, no horse and no harness: a long plank wagon bed ' +
        'about 3 m long with slatted wooden rack sides (rails and uprights like a ladder), the hay heaped in a big rounded mound ' +
        'well above the rails and hanging a little over the edges; four wooden wheels with spokes, wooden hubs and dark iron tyres, ' +
        'the rear pair larger than the front pair; a short wooden draught pole about 1.2 m long sticking straight forward from the ' +
        'front axle, its tip resting on the ground. Weathered grey-brown oak, dry sunlit-gold hay with paler and greyer stalks.',
    ),
    imageSize: { width: 1536, height: 1024 },
    pick: 0,
    fit: 'length',
    metres: 4.2,
    yaw: 0,
    maxTriangles: 16000,
    textureSize: 2048,
    mass: 1.0,
    description: 'Four-wheeled wooden farm wagon heaped with loose hay, no horse; the pole toward -Z.',
  },
  {
    name: 'basket',
    prompt: concept(
      'A round, wide, low wicker market basket of woven brown willow, about 50 cm across and 20 cm deep, with a thick braided rim ' +
        'and no handle, heaped in a dome above its rim with ripe apples, mostly red and some green and yellow-green, a few leaves ' +
        'among them.',
    ),
    imageSize: { width: 1024, height: 1024 },
    pick: 0,
    fit: 'length',
    metres: 0.5,
    yaw: 0,
    maxTriangles: 10000, // at 4000 the apples turned into faceted lumps
    textureSize: 1024,
    mass: 0.015,
    description: 'Round wicker basket heaped with red and green apples.',
  },
];
