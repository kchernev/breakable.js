// Dust Town's props (src/demo/worlds/western/DESIGN.md §5): a buckboard wagon, a floor safe, a
// pitcher pump on its post and a porch rocking chair. Same fields as the base list
// (scripts/assets/props.mjs); one concept take each, so the prompts carry the detail.
//
//   PACK=western FAL_KEY=... node scripts/assets/generate-props.mjs concept|3d
//   PACK=western blender -b --factory-startup --python scripts/assets/process-props.py
//
// `yaw` was set by looking at the previews in assets-src/packs/western/props/previews and at views
// from each side; none of the models invented lettering, so there is no `paintOut`. After
// regenerating a prop, look again and redo both, and the `parts` boxes (three.js frame, metres,
// found from the processed GLB's vertices): each part collides as its own hull, welded to the
// first, so a wagon isn't a wedge out to its tongue's tip and a rocking chair rocks on its runners.
// Refit them alone with `process-props.py -- --colliders`.

import { concept, studio } from '../../props.mjs';

// Tripo P2 for all four (the doc's advice: cleaner meshes than Meshy, which matters for spokes and spindles)
export const generator = 'tripo';

// The wagon is long and its wheels are the point: seen more from the side than the default view
const sideOn = (s) => {
  const view = 'about 35 degrees off the front axis';
  if (!studio('x').includes(view)) throw new Error('props.mjs: the base studio() wording changed');
  return `${s} ${studio('pure white').replace(view, 'about 60 degrees off the front axis, so the whole length and all four wheels are clearly seen')}`;
};

// Sun-bleached, the way everything in town looks at noon
const WEATHERED = 'weathered, sun-bleached silver-grey to light grey-brown wood with open grain and fine checks';

/** @type {import('../../props.mjs').Prop[]} */
export const props = [
  {
    name: 'wagon',
    prompt: sideOn(
      'An old empty wooden buckboard freight wagon of the American frontier, parked with no horse. ' +
        `A long open rectangular box bed made of horizontal planks (about 3.2 m long, 1.1 m wide, sides 45 cm deep) in ${WEATHERED}, ` +
        'with faint traces of old faded red paint left on the sides, dark iron corner straps and bolt heads. ' +
        'A plain plank bench seat across the front of the box on two short iron springs, with a low curved iron hand rail at each end of the seat. ' +
        'Four tall wooden spoked wagon wheels, each with twelve thick wooden spokes, wooden rims, dark iron tyres and iron hub bands; ' +
        'the rear wheels clearly taller than the front wheels; all wheels straight, not turned. ' +
        'Heavy wooden axles and running gear underneath. A single straight wooden tongue (draft pole) runs forward from the front axle, ' +
        'angled down so its front tip rests on the ground. No horse, no harness, no canvas cover, no cargo, no driver.',
    ),
    imageSize: { width: 1536, height: 1024 },
    pick: 0,
    tripo: { face_limit: 50000 }, // more to start from, so the spokes survive decimation
    fit: 'length',
    metres: 5.2,
    yaw: 0, // the tongue came out to the front
    // The bed with the seat and the running gear; the front and the rear wheels each a 16-sided drum
    // across the pair; the tongue
    parts: [
      { box: [[-1.0, 0.3, -1.05], [1.0, 1.71, 2.61]] },
      { box: [[-1.2, 0, -0.95], [1.2, 0.95, 0.05]], round: 'x' },
      { box: [[-1.2, 0, 1.3], [1.2, 1.4, 2.61]], round: 'x' },
      { box: [[-0.2, 0.15, -2.61], [0.2, 0.9, -1.0]] },
    ],
    maxTriangles: 20000,
    textureSize: 2048,
    mass: 0.7,
    description: 'Weathered buckboard freight wagon, empty, no horse; tongue to the front, its tip held just off the ground (5.2 m with the tongue).',
  },
  {
    name: 'safe',
    prompt: concept(
      'A heavy antique cast-iron floor safe from the 1880s: an upright box about 95 cm high, 65 cm wide and 60 cm deep with softly rounded edges, ' +
        'a stepped plinth at the base, standing on four small iron castor wheels. Painted black, worn to dull dark iron at the edges and corners. ' +
        'The single front door has a large recessed panel painted faded dark red, framed by a thin worn gold pinstripe border with simple curled corner flourishes ' +
        '(plain ornamental lines only: no letters, no words, no numbers, no emblem, no picture, no maker name). ' +
        'A round brass combination dial near the top centre of the door and a brass T-shaped handle beside it; two heavy hinges on the left edge. Plain black sides and top.',
    ),
    imageSize: { width: 1024, height: 1024 },
    pick: 0,
    fit: 'height',
    metres: 0.95,
    yaw: -90, // the door came out facing -X
    maxTriangles: 4000,
    textureSize: 1024,
    mass: 0.6,
    description: 'Antique cast-iron floor safe, black with a faded red door panel, dial and handle, on castors.',
  },
  {
    name: 'pump',
    prompt: concept(
      'An old farmyard cast-iron pitcher hand pump bolted on top of a short square timber post. ' +
        `The post is a thick square wooden post, about 15 cm square and 75 cm tall, standing upright on the ground, in ${WEATHERED}, with a flat top. ` +
        'On it the pump: a squat cylindrical cast-iron body with a flared rim and a cap, a short downturned spout sticking out to the front over empty air, ' +
        'and a long curved cast-iron lever handle rising up and back from the top, ending in a round knob. ' +
        'Dull black iron with patches of orange-brown rust and worn grey edges. Thick, sturdy parts.',
    ),
    imageSize: { width: 1024, height: 1536 },
    pick: 0,
    fit: 'height',
    metres: 1.3,
    yaw: 180, // the spout to the front
    // The post and the pump on it; the lever behind; the spout in front
    parts: [
      { box: [[-0.14, 0, -0.26], [0.14, 1.31, 0.06]] },
      { box: [[-0.12, 0.6, 0.06], [0.12, 1.1, 0.4]] },
      { box: [[-0.12, 0.8, -0.4], [0.12, 1.1, -0.26]] },
    ],
    maxTriangles: 5000,
    textureSize: 1024,
    mass: 0.06,
    description: 'Cast-iron pitcher hand pump on a short weathered timber post, spout to the front.',
  },
  {
    name: 'rocking_chair',
    prompt: concept(
      `A plain old porch rocking chair of the American frontier, unpainted, in ${WEATHERED}. ` +
        'A tall back of seven thick round vertical spindles between a curved top rail and the seat, flat armrests on thick turned posts, ' +
        'a solid plank seat, four sturdy legs joined by stretchers, standing on two long curved rockers running from front to back. ' +
        'Simple, sturdy and rustic: every part thick, nothing delicate.',
    ),
    imageSize: { width: 1024, height: 1024 },
    pick: 0,
    fit: 'height',
    metres: 1.0,
    yaw: 180, // the seat to the front
    // The seat, back and arms on their legs; each runner its own curved hull, so it rocks
    parts: [
      { box: [[-0.3, 0.12, -0.42], [0.3, 1.0, 0.42]] },
      { box: [[-0.3, 0, -0.42], [-0.15, 0.16, 0.42]] },
      { box: [[0.12, 0, -0.42], [0.3, 0.16, 0.42]] },
    ],
    maxTriangles: 8000,
    textureSize: 1024,
    mass: 0.012,
    description: 'Weathered unpainted wooden porch rocking chair with a slatted back and turned arm posts.',
  },
];
