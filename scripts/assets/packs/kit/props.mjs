// The player's kit (PACK=kit): the shoulder-fired launcher held in the first-person view, the
// rocket it fires, and the machine gun. All made up (no real weapon, no maker, nothing to read).
// Fields as in the base list (scripts/assets/props.mjs); they are view models, not props, so
// view-models.py turns the raw takes into public/packs/kit/models (no collider; the tube's or the
// barrel's axis along -Z, the origin on it; the muzzle and the launcher's rear or the gun's
// ejection port in index.json) instead of process-props.py.
//
//   PACK=kit FAL_KEY=... node scripts/assets/generate-props.mjs concept [--takes 2]
//   PACK=kit FAL_KEY=... node scripts/assets/generate-props.mjs 3d
//   PACK=kit ~/.local/bin/blender -b --factory-startup --python scripts/assets/packs/kit/view-models.py
//
// `pick` and `yaw` were set by looking at the takes in assets-src/packs/kit/props/raw. `mirror`: the
// take shows the other side (view-models.py mirrors it across its length).

import { concept } from '../../props.mjs';

export const generator = 'tripo';

/** @type {import('../../props.mjs').Prop[]} */
export const props = [
  {
    name: 'launcher',
    prompt: concept(
      'A fictional shoulder-fired rocket launcher of no real model or maker, lying level. A long straight steel launch tube, 1.1 m long and 9 cm across, ' +
        'painted a dull olive-drab green, the paint worn through to dark bare steel along the edges and where hands hold it, with scuffs and a little grime. ' +
        'A slightly thicker ribbed collar around the muzzle end, and at the rear end a short flared blast cone. ' +
        'Under the tube, a little behind its middle, a black pistol grip with a trigger and a trigger guard, and a short black front grip ahead of it. ' +
        'On the left side of the tube, above the pistol grip, a compact boxy optical sight on a steel bracket with a black rubber eyecup at its back, ' +
        'and a small folding front sight post on top near the muzzle. Thick, sturdy, well-proportioned parts, nothing thin or spindly. ' +
        'The muzzle points to the left of the picture; it is seen from its left side, a little from above. The tube is empty (no rocket in it). ' +
        'Plain paint: no markings, no stencils, no stickers.',
    ),
    imageSize: { width: 1536, height: 1024 },
    pick: 0, // take 1 was much the same, with a flatter sight
    tripo: { face_limit: 30000 },
    fit: 'length',
    metres: 1.1,
    // The takes were made with the muzzle 'to the right of the picture', which shows the launcher's
    // right side, and the sight was drawn on it: mirrored to the left, where the eye is. A new take
    // from this prompt needs no mirror (and likely yaw 180: its muzzle the other way)
    mirror: true,
    yaw: 0,
    maxTriangles: 16000,
    textureSize: 2048,
    mass: 0,
    description: 'Fictional shoulder-fired launcher: olive-drab tube, worn paint, pistol and front grips, optical sight on the left.',
  },
  {
    name: 'rocket',
    prompt: concept(
      'A fictional rocket for a shoulder-fired launcher, of no real model or maker, lying level: 0.75 m long. ' +
        'At the front a pointed ogive warhead 8.5 cm across, painted dull olive green with one thin pale yellow painted band and a small steel fuze tip; ' +
        'behind it a slimmer cylindrical rocket motor 5 cm across in dark gunmetal grey, ending in a round nozzle; at the tail four short, thick, ' +
        'swept-back stabilising fins in dark grey. The nose points to the right of the picture; it is seen from the side, a little from above. ' +
        'Slightly worn paint. Plain paint: no markings, no stencils, no text.',
    ),
    imageSize: { width: 1536, height: 1024 },
    pick: 1, // take 0 was as good; 1 has the cleaner flared nozzle (both have three fins, not four)
    tripo: { face_limit: 12000 },
    fit: 'length',
    metres: 0.75,
    yaw: 0,
    maxTriangles: 4000,
    textureSize: 1024,
    mass: 0,
    description: 'Fictional finned rocket: olive warhead with a pale yellow band, gunmetal motor, three fins.',
  },
  {
    name: 'gun',
    prompt: concept(
      'A fictional light machine gun of no real model or maker, lying level, 1 m long overall. From the front: a stout slotted muzzle brake on the end of a ' +
        'heavy steel barrel; the barrel inside a round ventilated barrel shroud, a steel tube 5 cm across and 35 cm long with rows of round cooling holes ' +
        'along it, and a simple front sight post standing on its front end; behind the shroud a long rectangular steel receiver with flat sides, a few ' +
        'rivets and a small charging handle on its left side; along the top of the receiver a flat accessory rail with a simple raised rear aperture sight ' +
        'with protective ears at its back end; under the receiver, ahead of the trigger, a large straight box magazine 20 cm long, angled a little forward; ' +
        'behind the magazine a black ribbed pistol grip with a trigger and a trigger guard; at the back a solid fixed stock with a straight top line, ' +
        'ending in a black rubber butt pad. The receiver, the shroud, the stock and the magazine are painted a dull olive-drab green, the paint worn through ' +
        'to dark bare steel along the edges and where hands hold it, with scuffs and a little grime; the barrel, the muzzle brake, the rail and the sights ' +
        'are dark gunmetal steel. Thick, sturdy, well-proportioned parts, nothing thin or spindly. The muzzle points to the left of the picture; it is seen ' +
        'from its left side, a little from above. Plain paint: no markings, no stencils, no stickers, no serial numbers.',
    ),
    imageSize: { width: 1536, height: 1024 },
    pick: 1, // take 0 was as good, but its flash hider's open prongs are harder for image-to-3D than 1's ported brake
    tripo: { face_limit: 30000 },
    fit: 'length',
    metres: 1.0,
    yaw: 0,
    // The ejection port's middle on the receiver's right side, in the finished frame (m; the origin
    // on the barrel's axis at the grip): Tripo made the port on the side the concept doesn't show,
    // and this was read off the previews. index.json's `eject`
    eject: [0.0235, 0.009, -0.185],
    // How far under the barrel's axis the magazine is cut from the receiver (m: its underside)
    magazine: 0.048,
    // Tripo's paint came out glossier than the launcher's (0.16 to 0.25, the rubber grip and butt pad
    // 0.32 to 0.37): remapped, [from, to], so the paint is the launcher's 0.33 to 0.40 and the rubber
    // stays rougher (0.55 to 0.62)
    roughnessRemap: [[0.16, 0.25, 0.37], [0.33, 0.40, 0.62]],
    maxTriangles: 24000,
    textureSize: 2048,
    mass: 0,
    description: 'Fictional light machine gun: olive-drab receiver, ventilated shroud and stock, ported muzzle brake, box magazine, rail with a rear aperture sight.',
  },
];
