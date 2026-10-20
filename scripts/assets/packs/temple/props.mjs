// Sun Temple's props (public/packs/temple/models): the bronze goddess on the statue base, bronze
// tripod cauldrons by the altar and on the votive column, terracotta amphorae by the stoa, the
// treasury and the tholos, and the two marble lions at the foot of the temple ramp. They rest until
// thrown and never break; everything that should break is built from pieces in src/demo/worlds/temple.
//
// The fields are the base list's (scripts/assets/props.mjs). All four go through Tripo P2 (the
// user's preferred image-to-3D model). The palettes follow DESIGN.md: bronze 0x8a6a3e with
// verdigris 0x5f9c86, terracotta 0xb5653a, marble warm white with an ochre patina.
// `pick`, `yaw` and `paintOut` were set by looking at assets-src/packs/temple/props (the concepts and
// the previews); after regenerating a prop, look again and redo them. `grade` is applied by
// props-post.py (run it after process-props.py).

import { concept } from '../../props.mjs';

export const generator = 'tripo';

// Tripo bakes the castings a flat olive-grey with no metal: warm the bare bronze toward 0x8a6a3e
// and give it some metalness, and turn the pale streaks into blue-green verdigris (props-post.py).
const bronzeGrade = {
  bronze: { hue: 34, sat: 1.3, satAdd: 0.08, satMax: 0.5, value: 1.1, metal: 0.6 },
  patina: { hue: 160, sat: 1.4, satAdd: 0.08, satMax: 0.45, value: 1.05, metal: 0.05 },
  mix: 0.75,
};

/** @type {import('../../props.mjs').Prop[]} */
export const props = [
  {
    name: 'statue',
    prompt: concept(
      'A life-size ancient Greek cast bronze statue of a standing goddess of wisdom and war, Classical style of the 5th century BC, ' +
        'about 2.4 m tall including its plinth. She stands calmly in a gentle contrapposto, facing forward, her weight on her right leg. ' +
        'She wears a long belted peplos that falls in deep straight vertical folds to her feet, an overfold at the waist, and a crested ' +
        'Corinthian helmet pushed back on top of her head so her calm face shows. Her raised right hand grips a long, sturdy spear held ' +
        'upright and close beside her right side, its butt resting on the plinth by her right foot and its leaf-shaped point a little ' +
        'above the helmet crest. Her lowered left hand rests on the rim of a large round shield (about 90 cm across) standing on edge on ' +
        'the plinth, leaning against her left leg, its outer face plain and smooth. She stands on a low square bronze plinth about ' +
        '15 cm high, part of the casting. Weathered cast bronze: dark brown bronze with pale blue-green verdigris streaks running down ' +
        'from the shoulders, the folds and the shield rim, a few worn brighter bronze edges. No inscription, no gilding, no jewellery.',
    ),
    imageSize: { width: 1024, height: 1536 },
    pick: 0,
    fit: 'height',
    metres: 2.4,
    yaw: 90, // the auto-alignment leaves her facing +X (spear and shield along the footprint's long side)
    maxTriangles: 20000,
    textureSize: 2048,
    grade: bronzeGrade,
    mass: 0.6,
    description: 'Bronze goddess with spear, helmet and shield on a low integral plinth, dark bronze with verdigris; 2.4 m.',
  },
  {
    name: 'tripod',
    prompt: concept(
      'An ancient Greek Geometric-period bronze tripod cauldron, a votive offering about 1.5 m tall: a deep round bronze cauldron ' +
        'about 70 cm across with a thick rolled rim, held up on three tall, straight, sturdy cast bronze legs (flat bars about 6 cm wide ' +
        'with ribbed faces) evenly spaced around it, standing vertically from small flat feet on the ground up to the rim, so the whole ' +
        'tripod is about 75 cm across. Two large upright ring handles stand on the rim opposite each other, each a thick round solid ' +
        'bronze ring about 35 cm across with a short strut to the rim, open in the middle. Weathered dark brown bronze with pale ' +
        'blue-green verdigris streaks and patches, worn brighter on the rims. Empty, no fire, no inscription.',
    ),
    imageSize: { width: 1024, height: 1536 },
    pick: 0,
    fit: 'height',
    metres: 1.5,
    yaw: -55, // the ring handles left and right, so both show from the front
    maxTriangles: 8000,
    textureSize: 1024,
    grade: bronzeGrade,
    mass: 0.08,
    description: 'Geometric bronze tripod cauldron on three straight legs with two ring handles; 1.5 m.',
  },
  {
    name: 'amphora',
    prompt: concept(
      'An ancient Greek terracotta storage amphora about 1.05 m tall, standing upright: a tall ovoid body, widest at the shoulder ' +
        'and tapering smoothly down to a short solid toe knob with a small flat end it stands on; a narrow cylindrical neck with a thick ' +
        'rounded rim; two strong vertical loop handles of round section from the top of the neck down to the shoulder, one on each side. ' +
        'Plain unpainted orange-buff fired clay, slightly mottled with paler dusty patches, with three thin dark brown painted bands ' +
        'around the shoulder and the widest part of the belly; a little worn and chipped at the rim. No figures, no pictures, no ' +
        'patterns besides the bands, no letters, no stamps.',
    ),
    imageSize: { width: 1024, height: 1536 },
    pick: 0,
    fit: 'height',
    metres: 1.05,
    yaw: 0,
    maxTriangles: 4000,
    textureSize: 1024,
    mass: 0.03,
    description: 'Plain terracotta storage amphora with a toe foot, two handles and three dark bands; 1.05 m.',
  },
  {
    name: 'lion',
    prompt: concept(
      'An Archaic Greek marble lion sculpture, sitting upright on its haunches on a low rectangular marble plinth about 1.9 m long, ' +
        '0.75 m wide and 20 cm high: its body runs along the plinth, chest high, front legs straight ' +
        'and together, hind legs folded under it, tail curled round its right haunch onto the plinth; its head held up and looking straight ' +
        'ahead along the plinth, mouth a little open, a heavy mane carved in stylised flame-shaped locks. Simple, strong, slightly ' +
        'stylised forms. Weathered white-grey marble with a warm ochre-gold patina in the hollows, grey lichen streaks running down, ' +
        'a few chipped edges and a chipped ear; the plinth plain and squared.',
      'medium grey', // white marble on white would lose its outline
    ),
    imageSize: { width: 1536, height: 1024 },
    pick: 0,
    fit: 'length',
    metres: 1.9,
    yaw: 0,
    maxTriangles: 14000,
    textureSize: 2048,
    mass: 2.5,
    description: 'Marble lion seated on its haunches on a rectangular plinth, weathered with an ochre patina; 1.9 m long, 2 m tall.',
  },
];
