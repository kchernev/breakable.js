// Neon Alley's props (public/packs/neon/models): scooters parked in groups, hawker carts, plastic
// crates and wheelie bins on the wet street. Same fields and pipeline as the base list (scripts/
// assets/props.mjs): a GPT Image 2.5 concept, Tripo P2 image-to-3D, then process-props.py in
// Blender (which also makes the `paint` tintable, so each copy takes its own colour in props.ts, and
// the `glow` an emissive map); plus two fields of this list's own that props-post.py applies after
// it (`blank`, `spokes`). The rebuild, in order:
//
//   python3 -I scripts/assets/packs/neon/crates.py              (crates and crate are built, no paid call)
//   PACK=neon FAL_KEY=… node scripts/assets/generate-props.mjs concept --only scooter,cart,bin
//   PACK=neon FAL_KEY=… node scripts/assets/generate-props.mjs 3d --only scooter,cart,bin
//   PACK=neon blender -b --factory-startup --python scripts/assets/process-props.py
//   python3 -I scripts/assets/packs/neon/props-post.py          (after every process-props.py run)
//   blender -b --factory-startup --python scripts/assets/packs/neon/props-night.py   (night previews)
//
// `pick`, `yaw`, `fit`, `paint`, `blank`, `spokes` and `glow` were set by looking at the raw files in
// assets-src/packs/neon/props/raw, the previews and the processed meshes; after regenerating a prop,
// look again and redo them (the UV rectangle in `blank` and the wheel fits in `spokes` belong to
// these particular raw models).

import { concept } from '../../props.mjs';

// The user's preferred image-to-3D model (cleaner than Meshy on their test hydrant)
export const generator = 'tripo';

/** @type {import('../../props.mjs').Prop[]} */
export const props = [
  {
    name: 'scooter',
    prompt: concept(
      'A small 125 cc step-through motor scooter of the kind parked in rows in East Asian city alleys: a smooth rounded front apron and leg shield, ' +
        'a flat floorboard, a long black vinyl seat over a rounded rear body, small 12-inch wheels with black tyres and plain grey steel rims, ' +
        'a round headlight in the handlebar cover, a small red tail light, two small round chrome mirrors on thin stalks, a short black exhaust on the right side. ' +
        'Body panels in faded pastel mint-green plastic with off-white trim, lightly scuffed. It stands upright on its centre stand, the front wheel pointing straight ahead. ' +
        'Plain panels: no stickers, no badges, no stripes, no lettering; a blank licence plate.',
    ),
    imageSize: { width: 1536, height: 1024 },
    pick: 0,
    fit: 'length',
    metres: 1.85,
    yaw: 0,
    paint: { hue: [95, 150], minSat: 0.02 }, // the faded mint panels (barely saturated: 0.1 to 0.15)
    blank: [[0.3936, 0.164, 0.4287, 0.2236]], // made-up lettering on the rear plate (its UV rectangle; props-post.py)
    maxTriangles: 14000,
    textureSize: 1024,
    mass: 0.11,
    description: 'Small step-through motor scooter, faded mint-green panels, on its centre stand.',
  },
  {
    name: 'cart',
    prompt: concept(
      'An East Asian street-food hawker cart, about 1.9 m long and 2.2 m tall to the top of its canopy: a waist-high wooden cabinet body with plain painted panels in faded red-brown, ' +
        'a brushed stainless-steel counter top with a round cooking well holding a wok, two lidded stainless-steel stock pots and a low steel rail along the counter edge. ' +
        'A pair of large spoked bicycle-type wheels on one axle at one end, two short wooden legs and a pair of push handles at the other end, so it stands level. ' +
        'Above it a small flat canopy of faded red canvas on four thin steel poles rising from the corners of the counter, with a plain cloth valance around its edge, ' +
        'and one bare round light bulb hanging under the middle of the canopy. Plain unprinted cloth and panels: no signs, no characters, no pictures.',
    ),
    imageSize: { width: 1024, height: 1024 },
    pick: 0,
    fit: 'height', // fitted to its 1.9 m length it stood only 1.8 m tall, the counter at hip height
    metres: 2.1,
    yaw: 90, // a long side (the one the concept shows) to the front; the handles to -x, the wheels to +x
    glow: [{ box: [[0.05, 1.54, -0.12], [0.3, 1.69, 0.12]], minLuma: 0.6, color: [1.0, 0.78, 0.5], strength: 6 }], // the bulb under the canopy
    // The two wheels (fitted to the processed mesh: they lean out 7°) get real spokes (props-post.py)
    spokes: [
      { centre: [0.54, 0.369, 0.572], axis: [0.009, 0.119, 0.993], radius: 0.29, hub: 0.045, count: 28, width: 0.007, depth: 0.08 },
      { centre: [0.527, 0.365, -0.569], axis: [-0.009, -0.12, 0.993], radius: 0.29, hub: 0.045, count: 28, width: 0.007, depth: 0.08 },
    ],
    maxTriangles: 16000,
    textureSize: 2048,
    mass: 0.16,
    description: 'Street-food hawker cart: wooden body, steel counter with wok and pots, two wheels, red canvas canopy.',
  },
  // The crates are built, not generated: crates.py writes their raw model.glb (no concept, no paid
  // call; Tripo's take on them is in raw/crates/rejected). Run it before generate-props.mjs 3d, which
  // skips a prop whose model.glb is there.
  {
    name: 'crates',
    fit: 'height',
    metres: 0.93,
    yaw: 90, // the row along x, a long side to the front
    paint: { hue: [340, 20], minSat: 0.3 }, // the red stack (the blue one keeps its colour)
    maxTriangles: 12000,
    textureSize: 1024,
    mass: 0.02,
    description: 'Two stacks of three plastic market crates end to end, one blue and one red, stacked by hand.',
  },
  {
    name: 'crate',
    fit: 'height',
    metres: 0.31,
    yaw: 0,
    paint: { hue: [340, 20], minSat: 0.3 },
    maxTriangles: 2000,
    textureSize: 1024,
    mass: 0.0015,
    description: 'One empty red plastic market crate, open top.',
  },
  {
    name: 'bin',
    prompt: concept(
      'A 240-litre wheeled plastic wheelie bin of the kind lined up in city back alleys: a tall, slightly tapered, dark green moulded plastic body with a flared top rim, ' +
        'a flat hinged lid, closed, with a thick handle bar across the back at the hinge, two solid black wheels on an axle at the bottom of the back, ' +
        'shallow vertical ribs moulded into the front. Slightly scuffed and dusty. Plain plastic: no markings, no numbers, no stickers, no lettering.',
    ),
    imageSize: { width: 1024, height: 1024 },
    pick: 0,
    fit: 'height',
    metres: 1.07,
    yaw: 0,
    paint: { hue: [85, 175], minSat: 0.15 },
    maxTriangles: 8000,
    textureSize: 1024,
    mass: 0.015,
    description: '240 L wheeled plastic bin, dark green, lid closed.',
  },
];
