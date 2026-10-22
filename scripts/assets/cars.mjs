// The cars that come apart, cut into their parts by scripts/assets/process-cars.py into
// public/models/cars/<name>.gltf (with its .bin and textures/) and index.json.
//
// Each comes from a Blender file (`blend`): the sedan, the taxi and the van are modelled by script
// (car_model.py, their designs in car_designs.py), each part its own object already named for it;
// the GT15 is a model of its own, its objects named for parts by `objects` (car_blend.py). Glass
// is never kept as faces: each pane is a glass piece of its own (index.json `glass`).
//
// (The older route, still in process-cars.py and split-cars.mjs but used by none of these: a prop
// of the pack cut into parts along `regions` and Hunyuan 3D's split of it, `split.parts` and
// `split.interior`.)
//
// `hinges`: where a door, the hood and the trunk lid turn when their latch goes (a point on the
// axis, and the axis). `boxes`: dark blocks inside (an engine under the hood, a floor in the trunk)
// for what's seen once they're off. `fuel`: where the tank is (a round there holes it). `mass`:
// the whole car (the props' units), shared out by `shares`.

export const cars = [
  {
    // A mid-size family sedan, modelled by script (car_model.py, its design in car_designs.py)
    name: 'sedan',
    mass: 1.4,
    blend: 'assets-src/cars/sedan/source/sedan.blend',
    scale: 1,
    turn: 0,
    objects: {},
    glass: 'glass',
    tint: 0xa9aeb4,
    tintMask: 'paint',
    hinges: {
      'door.fl': { at: [-0.86, 1.0, 0.6], axis: [0, 0, 1] },
      'door.rl': { at: [-0.88, -0.22, 0.6], axis: [0, 0, 1] },
      hood: { at: [0, 1.13, 0.95], axis: [1, 0, 0] },
      trunk: { at: [0, -1.87, 1.09], axis: [1, 0, 0] },
    },
    waist: 0.97,
    roof: 1.3,
    // Inside (car_insides.py): tan leather, an engine under the hood, a carpeted trunk
    cabin: {
      trim: 'tan',
      width: 1.5,
      floor: 0.3,
      seat_z: 0.44,
      seat_y: -0.12,
      front: [-0.38, 0.38],
      rear: -1.02,
      dash: { y: 0.62, top: 0.93, cowl: [0.98, 0.96] },
      wheel: [-0.38, 0.4, 0.84],
      console: [-0.08, 0.6],
      floor_y: [-1.15, 0.72],
      roof_y: [-1.05, 0.2],
      belt: 0.97,
      shelf: [-1.55, 1.04],
      // (Its fine body's lining: the flat stretches merged)
      lining_flat: 0.05,
    },
    engine: { box: [[-0.6, 1.25, 0.35], [0.6, 2.1, 0.82]] },
    trunk_box: [[-0.62, -2.28, 0.45], [0.62, -1.92, 0.95]],
    // (Its discs and calipers are its own)
    brakes: false,
    fuel: [0, -1.0, 0.3],
  },
  {
    // The yellow cab: a full-size sedan in a Crown Victoria's shape, modelled by script, its roof
    // sign a part of its own
    name: 'taxi',
    mass: 1.6,
    blend: 'assets-src/cars/taxi/source/taxi.blend',
    scale: 1,
    turn: 0,
    objects: {},
    glass: 'glass',
    tint: 0xf2b60f,
    tintMask: 'paint',
    hinges: {
      'door.fl': { at: [-0.93, 1.1, 0.65], axis: [0, 0, 1] },
      'door.rl': { at: [-0.93, -0.12, 0.65], axis: [0, 0, 1] },
      hood: { at: [0, 1.23, 1.0], axis: [1, 0, 0] },
      trunk: { at: [0, -1.6, 1.1], axis: [1, 0, 0] },
    },
    waist: 1.0,
    roof: 1.35,
    // Inside: black seats, the partition behind the front ones, the meter on the dash
    cabin: {
      trim: 'black',
      width: 1.6,
      floor: 0.32,
      seat_z: 0.45,
      seat_y: -0.05,
      front: [-0.4, 0.4],
      rear: -0.95,
      dash: { y: 0.78, top: 0.98, cowl: [1.1, 1.01] },
      wheel: [-0.4, 0.55, 0.88],
      console: [0.0, 0.75],
      floor_y: [-1.15, 0.9],
      roof_y: [-1.05, 0.45],
      belt: 1.0,
      partition: -0.42,
      shelf: [-1.4, 1.06],
      lining_flat: 0.05,
    },
    engine: { box: [[-0.65, 1.32, 0.38], [0.65, 2.3, 0.88]] },
    trunk_box: [[-0.7, -2.4, 0.48], [0.7, -1.7, 0.98]],
    brakes: false,
    fuel: [0, -1.7, 0.42],
  },
  {
    // The delivery van: a high-roof panel van, modelled by script: cab doors, a sliding door on its
    // right, two barn doors at the back, a short hood
    name: 'van',
    mass: 2.5,
    blend: 'assets-src/cars/van/source/van.blend',
    scale: 1,
    turn: 0,
    objects: {},
    glass: 'glass',
    tint: 0xf2f3f4,
    tintMask: 'paint',
    hinges: {
      'door.fl': { at: [-0.98, 1.32, 1.0], axis: [0, 0, 1] },
      'door.side': { at: [1.0, 0.5, 1.2], axis: [0, 0, 1] },
      'door.bl': { at: [-0.85, -2.74, 1.3], axis: [0, 0, 1] },
      hood: { at: [0, 1.82, 1.4], axis: [1, 0, 0] },
    },
    waist: 1.3,
    roof: 1.9,
    // Inside: a high cab, its wheel flatter, cloth seats; behind the bulkhead, the load space
    cabin: {
      trim: 'cloth',
      width: 1.85,
      floor: 0.6,
      seat_z: 0.88,
      seat_y: 0.62,
      front: [-0.48, 0.48],
      dash: { y: 1.3, top: 1.32, cowl: [1.76, 1.37], face: 0.38 },
      wheel: [-0.48, 1.06, 1.22],
      wheel_tilt: 0.75,
      floor_y: [0.5, 1.3],
      roof_y: [0.55, 0.98],
      belt: 1.28,
      cargo: [-2.62, 0.42],
      cargo_floor: 0.62,
      roof: 2.42,
      lining_flat: 0.05,
    },
    engine: { box: [[-0.6, 1.95, 0.6], [0.6, 2.55, 1.15]] },
    brakes: false,
    fuel: [-0.4, -0.6, 0.45],
  },
  {
    // The Ubix GT15, the sports car of the Nordschleife game (modelled in Blender: its file and
    // textures in assets-src/cars/gt15/source), mid-engined: the engine under its rear glass, a
    // trunk under its hood. Its parts are its own objects (`objects`), the hood cut out of its body
    name: 'gt15',
    mass: 1.45,
    blend: 'assets-src/cars/gt15/source/gt15.blend',
    scale: 2.5,
    turn: 180,
    objects: { doors: ['Doors'], 'bumper.f': ['bumper-f'], 'bumper.r': ['bumper-r'], 'trim.wing': ['spoiler'] },
    // Its paint white under each copy's tint, clear coated; its lights glowing, not blinding
    looks: {
      '1.Paint': { paint: true, color: 0xffffff, rough: 0.3, metal: 0.55, coat: 1, coat_rough: 0.03 },
      '12.White': { glow: 3 },
      '8.Red': { glow: 2 },
    },
    tyre: '7.TYRE',
    // Its subdivided surfaces cut down for the game, by role
    decimate: { body: 0.3, wheel: 0.22, bumper: 0.35, door: 0.45, trim: 0.4 },
    tint: 0x0098ff,
    tintMask: 'paint',
    regions: [{ name: 'hood', box: [[-0.6, 1.12, 0.6], [0.6, 2.3, 0.96]], facing: { axis: [0, 0, 1], min: 0.3 } }],
    hinges: {
      'door.fl': { at: [-0.95, 0.84, 0.6], axis: [0, 0, 1] },
      hood: { at: [0, 1.12, 0.84], axis: [1, 0, 0] },
    },
    waist: 0.85,
    roof: 1.15,
    cabin: {
      trim: 'sport',
      sport: true,
      width: 1.36,
      floor: 0.2,
      seat_z: 0.24,
      seat_y: -0.38,
      front: [-0.36, 0.36],
      dash: { y: 0.62, top: 0.8, cowl: [1.06, 0.82], face: 0.26 },
      wheel: [-0.36, 0.36, 0.66],
      wheel_tilt: 0.3,
      console: [-0.38, 0.62],
      floor_y: [-0.6, 0.5],
      roof_y: [-0.42, 0.32],
      belt: 0.86,
      bulkhead: -0.66,
      calipers: 'red_paint',
    },
    engine: { box: [[-0.55, -1.62, 0.3], [0.55, -0.72, 0.98]], v8: true, mid: true },
    trunk_box: [[-0.55, 1.18, 0.3], [0.55, 1.72, 0.7]],
    // (Its own discs are on its body)
    brakes: false,
    fuel: [0, -0.55, 0.32],
  },
];

/** How the car's mass is shared out: the body takes what the rest don't. */
export const shares = { door: 0.035, hood: 0.025, trunk: 0.02, wheel: 0.025, bumper: 0.012, trim: 0.008 };
