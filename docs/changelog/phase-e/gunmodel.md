# The gun's model

The machine gun the player holds: `public/packs/kit/models/gun.glb`, with its entry in
`public/packs/kit/models/index.json`. It's a made-up light machine gun (no real model or maker, no
markings, no text) in the launcher's worn olive-drab family: a ported muzzle brake on a steel
barrel, a ventilated round shroud with a front sight post, a flat-sided receiver with a charging
handle on its left and an ejection port on its right, a rail along the top with a rear aperture
sight between ears, a straight box magazine, a ribbed black pistol grip and a solid stock with a
rubber butt pad. Its magazine is a mesh of its own, so a reload can drop it.

In shape it's nearer an automatic rifle than a belt-fed machine gun: a fixed stock and a 20 cm box
magazine, with no bipod, carrying handle, drum or belt box. The brief allowed that ("a light machine
gun / assault weapon"). The prompt and a heavier look are under "Known issues".

Files changed: `scripts/assets/packs/kit/props.mjs` (the `gun` entry), `scripts/assets/packs/kit/view-models.py`
(the gun's axis, grip, ejection port, magazine and roughness), `assets-src/packs/kit/` (the takes,
the model, previews, the ledger), `public/packs/kit/models/gun.glb` and `index.json`'s `gun`,
`public/packs/kit/CREDITS.md`, and `tests/gun-model.test.ts`. The game loads the model through the
weapons team's code: `loadKit()` in `src/demo/launcher.ts` returns it as `kit.gun`, and `Gun` in
`src/demo/gun.ts` holds it (see `weapons.md`).

## The file

`gun.glb`, in the gun's frame (three.js): the barrel's axis along -Z, the muzzle that way, +Y up, +X
the gun's right side, metres, the origin on the barrel's axis above the middle of the pistol grip
(where it's held: what the view model turns about, as the launcher's). No collider, no mass.

```json
"gun": {
  "file": "gun.glb",
  "muzzle": [0.0, 0.0, -0.6961],
  "eject": [0.0235, 0.009, -0.185],
  "size": [0.0775, 0.3179, 0.9994],
  "triangles": 24332,
  "description": "..."
}
```

- `muzzle`: the barrel's axis at the face of the muzzle brake: where the flash goes and bullets
  start.
- `eject`: the middle of the ejection port, on the plane of the receiver's right face (the port is 6
  cm long, 2.6 cm high and 7 mm deep). Casings come out of it to +X and up. The player sees the
  gun's left side, so the casings appear from behind the receiver and arc out to the right.
- `size`: width, height, length. The muzzle is 0.696 m ahead of the origin, the butt 0.303 m behind.
- Nodes: `gun` (the gun, 23,883 triangles) and its child `magazine` (449 triangles), one material
  (colour, normal, and occlusion / roughness / metalness maps, 2048 px WebP). Two draw calls.
- The magazine's origin is the middle of its top, where it seats: in the gun's frame it's at
  (0.0007, -0.048, -0.2004), under the receiver ahead of the trigger. Moved down (-Y), it comes out
  of the magazine well; put back at that position, it's seated. Its top is open where it was cut,
  and so is the well with it out.

## Using it

`loadKit()` reads `index.json` and `gun.glb` and returns the gun as `kit.gun`, a `GunKit`
(`src/demo/gun.ts`): `{ model, muzzle, eject }`, with `model` as gun.glb's scene and the two points
as index.json gives them. If the file is missing or fails to load, `kit.gun` is undefined and `Gun`
draws a stand-in.

```ts
const kit = await loadKit();
const { model, muzzle, eject } = kit.gun!; // muzzle, eject: [x, y, z] in the gun's frame
const mag = model.getObjectByName('magazine')!; // seated at mag.position
mag.position.y -= 0.15; // out of the well; put back at the seated position for the next one
```

`Gun` does all of this. It makes a view model of `model` with the launcher's `viewModel()` (view
materials, the view layer, depth squeezed; the magazine is just another mesh in it). It holds the
model at `SCALE` 0.66 with the muzzle at `MUZZLE_AT` (0.19, -0.2, -0.76) in camera space, aimed at
`AIM_AT` (0, 0, -30). It puts the flash at `muzzle` and throws the casings from `eject`. In
`pose()` a reload tips the gun, drops the magazine 0.28 m and turns it out, then brings a full one
up from below and seats it.

## Making it again

```sh
PACK=kit FAL_KEY=… node scripts/assets/generate-props.mjs concept --only gun --takes 2
PACK=kit FAL_KEY=… node scripts/assets/generate-props.mjs 3d --only gun
PACK=kit ~/.local/bin/blender -b --factory-startup --python scripts/assets/packs/kit/view-models.py -- gun
```

The files already made are kept, so the first two commands cost nothing while `raw/gun/` is there.
view-models.py writes `gun.glb`, the `gun` entry of `index.json` (the launcher's and the rocket's are
kept) and the previews `assets-src/packs/kit/props/previews/gun.png` and `gun_back.png`. The same
inputs give the same files, byte for byte. After a rebuild, `npm test` checks the result
(`tests/gun-model.test.ts`, below). The fields the `gun` entry in `props.mjs` sets (the rest are as
in the base `props.mjs`):

- `prompt`: the concept (seen from its left side, a little from above: the side the player sees).
  `pick` 1 (take 0 was as good, but its flash hider's open prongs are harder for image-to-3D than
  take 1's ported brake), `generator` 'tripo' (the kit's), `tripo: { face_limit: 30000 }`.
- `fit` 'length', `metres` 1.0, `yaw` 0 (the take came with its muzzle that way).
- `eject: [x, y, z]`: the middle of the ejection port in the finished frame, read off the renders.
  Tripo put the port on the side the concept doesn't show, so a new take needs it read again.
- `magazine` (m, here 0.048): how far under the barrel's axis the magazine is cut from the
  receiver (at its underside). What hangs under that plane and is joined to the lowest point (the
  magazine's foot) is cut off; the grip and the trigger guard are separate pieces in the take. Leave
  it out and the gun is one mesh.
- `roughnessRemap: [[0.16, 0.25, 0.37], [0.33, 0.40, 0.62]]` (default none): the roughness channel
  is passed through these points, [from, to], with straight lines between them and the ends held.
  Tripo's take came out glossy: its paint at 0.16 to 0.25, its rubber grip and butt pad at 0.32 to
  0.37. This brings the paint to the launcher's range (0.33 to 0.40) and keeps the rubber rougher
  (0.55 to 0.62). A remap keeps the take's order and spread; the base `roughness: [min, max]`, which
  view-models.py still applies afterwards as a clamp, flattened about 95% of the gun to one value.
- `maxTriangles` 24000 (24,332 after the cut), `textureSize` 2048.

Besides what it does for the launcher (weld, decimate, square, scale, shade, shrink the maps, bake
the occlusion), view-models.py does this for the gun:

- It finds the barrel's axis from circles fitted to the face of the muzzle brake and to the shroud
  a quarter of the length back (clear of the front sight), and lays it along -Z.
- It slides the origin along the axis to the pistol grip. What hangs more than 0.15 m under the axis
  comes in two lumps, the magazine and the grip; the grip is the one behind.
- It remaps the roughness (`roughnessRemap`), cuts the magazine off (`magazine`), and exports the gun
  with its child.

That export is a copy of process-props.py's, so that it also takes children (process-props.py's
selects only the object). A test keeps the two sets of settings the same.

## Tests

`tests/gun-model.test.ts` reads `gun.glb` (its JSON and binary chunks) and `index.json`'s `gun`, and
checks what `gun.ts` relies on:

- `gun` is a root node at the file's origin, with a mesh and a child `magazine` that hangs below its
  origin and sits under the barrel ahead of the grip.
- `muzzle` is on the axis (x = y = 0), within 1 mm of the gun's front.
- `eject` is on the gun's right side: within 1.5 cm of it, over a hole at least 5 mm deep (the
  port), and with nothing of the gun in front of it to +X.
- `triangles` is the file's count, under 30,000, and the file is under 4 MB.
- view-models.py's glTF export settings are process-props.py's.

Against altered copies, it fails for a muzzle 1.6 cm off, a wrong triangle count, a `magazine` node
renamed, and an `eject` inside the receiver, in the air beside it, or on its side 4 to 10 cm from
the port's middle (ahead, behind, below). It still passes 2.6 cm above the middle, just over the
port's top edge. So it ties `eject` to the port, but not to the millimetre.

## Measured

- 24,332 triangles (budget ~30k), 2,127,336 bytes (budget ~4 MB). The maps: 285 KB colour, 169 KB
  normal, 450 KB occlusion / roughness / metalness. 1.0 m long, 7.8 cm wide, 32 cm high (front sight
  to the foot of the magazine).
- The raw take had its barrel level already: the brake's and the shroud's centres were within a
  millimetre in height. Shroud radius 2.6 cm.
- Baked occlusion, mean over the texels used: 0.61 (the launcher's 0.75). The dark islands in the
  map are hidden interior faces; the surfaces that show are near white.
- Roughness by part, 10th / 50th / 90th percentile (area-weighted over the surface). Grip 0.55 /
  0.59 / 0.62, butt pad 0.53 / 0.57 / 0.59, stock paint 0.35 / 0.38 / 0.40, receiver's left side
  0.33 / 0.36 / 0.39, magazine 0.35 / 0.37 / 0.42, brake 0.37 / 0.40 / 0.46; the whole gun 0.36 /
  0.40 / 0.56. The launcher's tube is 0.33 / 0.34 / 0.36 and its grips 0.39 / 0.49 / 0.51. Before
  the remap the whole gun was 0.36 / 0.36 / 0.37, with grip and paint the same.
- Albedo seen from the player's place (unlit renders of the colour map): 0.286 / 0.275 / 0.211
  (sRGB), against the launcher's 0.279 / 0.265 / 0.182. Metalness 0.019, against the launcher's
  0.032.
- In the game, the paint at Brick Street's start (in a building's shadow) is the same olive as the
  launcher's. The gun as a whole looks a little darker, because more of what shows is its black rail
  and rear sight and its flat sides face away from the sky. The masked brightness measurements
  don't settle it: the masks pick up moving dust and differ by up to 2x in pixels between runs, and
  the review measured the gun brighter. In sun it reads as olive, with its worn edges and its
  details (Dust Town, Sun Temple).
- Cost: two GPT Image 2.5 concepts ($0.041 each) and one Tripo P2 model ($1.20): $1.28, of a
  budget of four images and two models. The roughness remap was a rebuild, at no cost. Each call is
  in `assets-src/packs/kit/ledger.jsonl`.

## Checked

- Blender (Cycles and Eevee): both sides, the top, behind and to the left (where the eye is when
  it's held at the lower right), behind and to the right, the player's view, with the magazine
  pulled out, and under Brick Street's sky. It reads well from behind: the rear aperture sight and
  its ears, the rail, the charging handle, the shroud's holes, the front post, and the magazine and
  grip under it. After the remap: the roughness channel alone (stretched over 0.3 to 0.75) shows a
  rougher grip and butt pad and grime on the stock, where before it was one flat grey. Lit close-ups
  show the grip's ribs more matte; the paint looks much as before.
- In the game (`kit.gun`, `Gun`) on a virtual display, in all six worlds: it reads at noon, in
  shade, at golden hour, under overcast and at night. No console errors or warnings. Before the
  remap was published, two remaps (paint at 0.40 and at 0.48) were served in place of gun.glb by
  request interception and compared beside the launcher at Brick Street's start and in Dust Town.
  The difference in the game is small; the one in the launcher's range was kept. In an earlier
  check, the `muzzle` and `eject` points, marked in the game, sat on the brake's face and in the
  port.
- view-models.py rebuilt in a scratch copy of the tree: `gun.glb`, `launcher.glb` and `index.json`
  identical to the published ones, byte for byte.
- `npx tsc --noEmit -p .` clean; `npm test` 188 pass, `tests/gun-model.test.ts`'s 5 among them.
- Renders and screenshots:
  `scratch/phase-e/gunmodel/`
  (the first build) and `…/phase-e/gunmodel-fix/` (after the review: `shots/` for the remaps in
  Blender and in the game, `worlds/` for the six worlds, `mut/` for the test's altered copies).

## What each world should do

Nothing. The gun is part of the player's kit, the same in every world, like the launcher; no world
refers to the kit.

## Known issues

- It looks more like an automatic rifle than a machine gun (see the top). A heavier look needs a
  new take. Add a folded bipod under the front of the shroud, a carrying handle on the receiver, a
  visibly thicker barrel and a larger box magazine to the prompt; then make one concept and one
  Tripo model ($1.24; the budget has two images and one model left), rebuild, and read `eject` and `magazine` off
  the renders again. The test catches a stale `eject` or a lost magazine. `Gun`'s hold (`SCALE`,
  `MUZZLE_AT`) was tuned to this model and would need another look.
- The right side is Tripo's guess (the concept shows the left, the side the player sees). Its
  texture is softer, and the ejection port is the window Tripo put there.
- The front sight post and the rear sight's ears are thin, and a little soft at 2048 px.
- The magazine is cut where the receiver's underside is, so with it out the well is an open hole,
  and the magazine's top is open: fine for a drop, but a hollow box if looked into from above.
