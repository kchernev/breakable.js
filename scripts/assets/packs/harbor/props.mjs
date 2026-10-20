// Harbor Yard's props (PACK=harbor): a forklift, a terminal tractor, an oil drum and a cable reel.
// Fields as in the base list (scripts/assets/props.mjs). One concept and one image-to-3D take each
// (the world's budget), so the prompts spell out what image-to-3D needs: thick parts rather than
// thin rails, tinted glass, plain paint with nothing to read.
//
//   PACK=harbor FAL_KEY=... node scripts/assets/generate-props.mjs concept|3d
//   PACK=harbor blender -b --factory-startup --python scripts/assets/process-props.py
//
// process-props.py runs finish-props.py after it: needles cut off the reel and its colours put back,
// a hole in the drum filled, and both their round colliders fitted again to the result. The drum's
// blue paint is tintable (`paint`): the world gives each copy its colour. The vehicles collide as
// two parts each (`parts`), so what lands on the forks or the deck lies there, not on a hull drawn
// from the mast or the cab.

import { concept } from '../../props.mjs';

// Tripo P2 (the user's preference; generate-props.mjs has its defaults)
export const generator = 'tripo';

/** @type {import('../../props.mjs').Prop[]} */
export const props = [
  {
    name: 'forklift',
    prompt: concept(
      'A diesel counterbalance forklift truck, 3-tonne class, of a generic industrial design (no particular maker), about 3.6 m long with its forks, ' +
        '1.25 m wide and 2.2 m tall. Compact body painted a dull, slightly faded red-orange, with a heavy rounded cast counterweight at the rear in the same colour. ' +
        'An open operator compartment with a black seat and a black steering wheel, no driver. Over it a black steel overhead guard on four thick square posts, ' +
        'its roof a few thick flat bars. At the front the mast fully lowered and upright: dark grey steel channels and carriage, and two long dark grey steel ' +
        'forks lowered almost to the ground, pointing straight ahead. A short exhaust pipe beside the guard. Big solid black rubber tyres, larger at the front, ' +
        'wheels straight. Worn paint with scuffs, chipped edges and a little grime. Plain paint: no decals, no warning stickers, no stripes.',
    ),
    imageSize: { width: 1536, height: 1024 },
    pick: 0,
    fit: 'height', // by length (3.6) it came out 1.99 tall; a real 3 t truck is ~2.15 at the guard
    metres: 2.1,
    yaw: 180, // the forks to the front
    maxTriangles: 20000,
    textureSize: 2048,
    mass: 4.5,
    // The body and mast; the forks, low in front of the mast
    parts: [
      { box: [[-0.75, -0.01, -0.75], [0.75, 2.2, 1.95]] },
      { box: [[-0.45, -0.01, -1.95], [0.45, 0.2, -0.6]] },
    ],
    description: 'Diesel counterbalance forklift (3 t class), faded red-orange, mast lowered, forks down.',
  },
  {
    name: 'yard_tractor',
    prompt: concept(
      'A terminal tractor, the short shunting truck that moves trailers around a container port, of a generic design (no particular maker): about 5.6 m long, ' +
        '2.5 m wide and 3.2 m tall at the cab roof. A narrow, tall, boxy single-seat cab offset to the left side, with large flat windows all round in dark tinted ' +
        'glass (no interior visible) and a small amber beacon on its roof; a vertical black exhaust stack beside the cab. Behind the cab a low flat steel deck ' +
        'with a round fifth-wheel coupling plate on a heavy lifting frame. Two axles with big black truck tyres, dual wheels at the rear, front wheels straight. ' +
        'Faded off-white to light grey painted cab, black chassis and bumper, dark grey steel deck. Used and weathered: grime, scuffs and a little rust at the edges. ' +
        'Plain paint: no decals, no stripes, no plates.',
      'medium grey', // a pale cab on white would lose its outline
    ),
    imageSize: { width: 1536, height: 1024 },
    pick: 0,
    fit: 'length',
    metres: 5.6,
    yaw: 180, // the cab to the front
    maxTriangles: 20000,
    textureSize: 2048,
    mass: 8,
    // The chassis and deck; the cab, tall at the front
    parts: [
      { box: [[-1.3, -0.01, -2.85], [1.3, 1.65, 2.85]] },
      { box: [[-1.3, 1.0, -2.85], [1.3, 3.4, -0.95]] },
    ],
    description: 'Terminal tractor (port shunting truck): offset single-seat cab, fifth-wheel deck, faded off-white.',
  },
  {
    name: 'drum',
    prompt: concept(
      'A standard 205-litre steel oil drum standing upright, 0.58 m across and 0.88 m tall: a closed-head drum with two raised rolling hoops around its middle ' +
        'third, a rolled rim at the top and bottom, and a flat lid with two small screw bung caps near its edge. Faded mid-blue paint, chalky and weathered, ' +
        'rust spots and short rust streaks at the rims and the hoops, two or three shallow dents in the side. No labels, no stencils, no hazard diamonds.',
    ),
    imageSize: { width: 1024, height: 1024 },
    pick: 0,
    tripo: { face_limit: 20000 },
    fit: 'height',
    metres: 0.88,
    yaw: 0,
    maxTriangles: 5000,
    textureSize: 1024,
    mass: 0.12,
    paint: { hue: [180, 240] },
    round: 'y',
    description: '205 L steel drum, faded blue with rust and dents; its paint takes a tint per copy.',
  },
  {
    name: 'reel',
    prompt: concept(
      'A wooden cable reel (a cable drum) standing upright on the rims of its two round flanges, its axle horizontal, seen three-quarter so one flange face ' +
        'and the cable between them both show: 1.4 m across and 1.0 m wide. Each flange a thick disc of weathered plywood braced by a few timber battens and ' +
        'bolts, with a round steel-lined arbor hole at its centre. Between them a barrel wound full with many neat turns of thick black rubber-sheathed cable, ' +
        'filling to a hand-width below the flange rims. Pale, grey-weathered wood with water stains and dirt. No labels, no stencils, no lettering.',
      'light grey',
    ),
    imageSize: { width: 1024, height: 1024 },
    pick: 0,
    tripo: { face_limit: 20000 },
    fit: 'height',
    metres: 1.4,
    yaw: 0,
    maxTriangles: 6000,
    textureSize: 1024,
    mass: 0.5,
    round: 'x',
    description: 'Wooden cable reel standing on its flanges, wound with black cable.',
  },
];
