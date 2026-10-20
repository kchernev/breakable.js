# Rendering and props: what changed

The render team's changes in this phase: how pieces are drawn (`src/lib/fragment-mesh.ts`), the
look fields of `BreakableMaterial` (`src/lib/materials.ts`), props (`src/lib/prop-mesh.ts`,
`src/lib/prop-pack.ts`), shapes (`src/lib/shapes.ts`), the prop pipeline
(`scripts/assets/process-props.py`) and the base pack's colliders (`public/models/index.json`). In
`src/lib/destruction.ts`, small edits only: `Piece.state` tells the meshes when it changes,
`PieceOptions.smooth`, `PieceOptions.textureFrame` taking a piece's `Piece.textureFrame`,
`PropOptions.tint`, `PropModel.tint` and `tintMask`, and the code that makes a piece's faces and
texture coordinates moved from there to `fragment-mesh.ts` (`drawFaces`).

Tests (no GPU): `tests/render.test.ts` (new: piece records and when they're uploaded, texture
coordinates of cells, `uvScale` pairs, `uvJitter`, `smooth`, a piece made again from its
`textureFrame`, prop tints), `tests/props.test.ts` (the base pack's colliders, a copy's tint),
`tests/shapes.test.ts` (the pointed arch), `tests/process-props.test.ts` (new: `process-props.py`'s
colliders, `round` about each axis and `standing`, fitted by the script's own functions in Blender in
the background; skipped where there's no Blender: `BLENDER`, or `~/.local/bin/blender`). They give
the fake world a body buffer, so the Destruction draws (nothing is compiled or uploaded). What needs
a GPU was checked in the browser on Brick Street, Dust Town, Neon Alley and Harbor Yard (and all six
worlds load and take a blast).

## What every world sees differently (defaults)

- **The base pack's colliders are the 12 points Destruction collides a prop as.**
  `process-props.py` wrote 24, and `Destruction` (whose `maxHullVertices` is 12) picked 12 of
  them itself, spread out but not knowing which carry the prop: the sedan, the van and the hydrant
  stood on one ground point. The new ones (written with `--colliders`, the GLBs untouched) stand
  on four:

  | prop | before (the library's pick of 24) | now (12 written) |
  | --- | --- | --- |
  | taxi | 3 ground points, 76% of the hull, worst vertex 46 cm out | 4, 79%, 32 cm |
  | sedan | 1, 75%, 48 cm | 4, 78%, 32 cm |
  | van | 1, 81%, 66 cm | 4, 83%, 40 cm |
  | hydrant | 1, 70%, 7 cm | 4, 82%, 4 cm |
  | trashcan | 5, 85%, 8 cm | 6, 84%, 6 cm |
  | mailbox | 4, 92%, 10 cm | 4, 92%, 5 cm |

  Checked in Brick Street: sedans thrown by a blast landed on their wheels. A world pack's colliders change only when it runs `process-props.py` again (or
  `--colliders`).
- **A pack's `finish-props.py` runs after `process-props.py`** (see below). Harbor Yard's does, so
  `PACK=harbor ... process-props.py` now also runs Harbor's finishing pass (it reprocesses the drum
  and the reel from their raw takes itself, so nothing is applied twice; `--no-finish` skips it).
  Not with `--colliders`, which leaves the models as they are (Harbor's pass would export them
  again).
- Otherwise pieces are drawn as before: the vertex layout and the attribute names (`pieceInfo`,
  `tint`) are the same, so Neon Alley's and Harbor Yard's workarounds that read them keep working
  until they move to the accessors below. New: one storage buffer per world, 64 bytes per body slot
  (3.8 MB at the demo's 60,000), read only by materials that use the accessors or `glow`. Until such
  a material is drawn, nothing of it is uploaded or queued (no world's is yet: checked in all six,
  no update ranges after blasts); once one is, only the records that change go up each frame.
  `Piece.state` is a getter and setter now (used as before), and `Piece.texture` a `TextureFrame`
  (a `Pose` with the piece's box and `smooth`; Sun Temple's `levers.ts` reads it as before). Frame
  times, the six worlds loaded and blasted one after another: medians 16.7–19 ms (Brick Street
  17.7, standing).
- **Glass is drawn as each world's surface says.** For a while in this phase `FragmentMesh` forced
  `depthWrite` on for transparent surfaces; it no longer touches it, so every world's glass looks as
  it did before the phase. Glass that writes depth is now a choice in the world's material (see
  "Glass and the dust behind it" below).

## New, and what it replaces

All of these are off by default. The node accessors work in a breakable material's surface nodes
(`colorNode`, `emissiveNode`, `roughnessNode`, ...): they read the piece the FragmentMesh is drawing
(outside one they give the defaults noted).

### `pieceState()`: whether a piece stands, in its material

```ts
import { pieceState } from '../../../lib/index.ts';
const { standing, loose, rubble, broken } = pieceState(); // floats, 1 or 0
m.emissiveNode = color(0xff3060).mul(4).mul(standing).mul(broken.oneMinus());
```

`standing`: fixed (part of a structure); `loose`: moving; `rubble`: come to rest; `broken`: 1 on
the piece's broken faces. Each piece has a record per body slot (its state, texture frame and box),
shared by a world's meshes and uploaded only where it changed; `Piece.state` updates it whenever it
changes (any code that sets it). Replaces in Neon Alley `glow.ts` what keeps its value `x` at 0 on
pieces that no longer stand (`update()` darkening those that came loose, `watch()` darkening cells
that aren't fixed) and `outside()` (`broken.oneMinus()`). What stays Neon's own: `x` as the
per-piece switch and its flicker (`Glow.light` lights some `lamp` pieces and not the curtained
windows beside them, which share the material: `buildings.ts` `windowsLit()`), the lightbox atlas
offsets, copying those to a broken piece's cells (`watch()`), and knowing which lit pieces fell
(`standing`, `lost`) for the street's reactions.

### `BreakableMaterial.glow: 'standing'`

Default: unset (the surface glows as drawn, loose or not). With `'standing'`, the surface's
emission (its `emissive`, `emissiveMap`, `emissiveIntensity` or `emissiveNode`) shows only while the
piece stands and never on its broken faces: a neon tube or a lit window goes dark once knocked
loose, and its cells stay lit while they stand.

```ts
neon: material({ ..., glow: 'standing', surface: lit }) // lit.emissiveNode = pieceTint().mul(7).mul(power)
```

It has no per-piece on and off: every standing piece of the material glows. In Neon Alley's
`materials.ts` it replaces the `glow.outside()` factor in `emitting()`, `lampSurface()`,
`lanternSurface()` and `lightboxSurface()`, and `v.x` no longer has to drop to 0 when a piece comes
loose; but keep multiplying by `v.x`, or the curtained windows (the `lamp` pieces never `light()`ed)
light up. Or give the curtains a material that doesn't glow; then `v.x` is needed only where
something flickers. Brick Street's `lamp` could take it too.

### `pieceTint()`

The piece's tint (`PieceOptions.tint`) as a node (white outside a FragmentMesh). Replaces
`attribute('tint')` in Neon Alley's `materials.ts` (`tint()`) and Harbor Yard's `materials.ts`.

### `BreakableMaterial.tintMask`: tint only the paint

Default: unset (the tint colours the whole surface, as before). A float node, or a texture whose
red channel says (at the surface's texture coordinates), how much of the piece's tint each point
takes: 1 all of it, 0 none (the surface's own colour).

```ts
// Harbor Yard's container skin: rust keeps its colour on any paint
m.colorNode = vec4(mix(paint, oxide, rust), 1); // no more oxide.div(tint)
container: presets.metal({ ..., surface: m, tintMask: rust.oneMinus() })
// Dust Town's siding: a mask of where the paint is (say from textures.py, or a node on the map)
siding: presets.wood({ ..., tintMask: texture('western_siding_paint', false, base) })
```

Replaces the tint divided back out in Harbor Yard's `containerSkin()` and `tankPaint()`
(`materials.ts`) and Neon Alley's `awningSurface()` (its white bands: `tintMask: stripe`),
and lets Dust Town's painted planks keep bare wood where the paint is worn (`materials.ts`
`siding`; its map needs a mask: where the paint is).

### `pieceFrame()`: where on its piece a point is

```ts
const { position, normal, halfExtents } = pieceFrame(); // vec3s, in the piece's texture frame
// A drafted margin 2 cm wide round each face of a block, and on its cells where they show its faces
const gap = halfExtents.sub(position.abs()).add(normal.abs().mul(10)); // the face's own axis left out
const margin = smoothstep(0, 0.02, gap.x.min(gap.y).min(gap.z));
// A drum's 20 flutes, round the frame's y (cylinder() is upright in its frame)
const flutes = position.z.atan(position.x).mul(20).cos();
// A roof plate's underside or a box's inside, darker
const under = normal.y.lessThan(0);
```

All three are in the piece's texture frame (its own frame unless `PieceOptions.textureFrame` gives
another): `position` (m) from the centre of the piece's box as built, so a box's faces lie at
±`halfExtents`; `normal` the face's (smooth where `smooth` is set); `halfExtents` half the box's
size. The cells of a broken piece keep their piece's frame and box, so a margin stays on the
block's edges and a triglyph's grooves on its face. Keep the frame aligned with the block to use
them: a turned frame turns the box (use `uvJitter`, which only moves it, rather than a jittered
`textureFrame` with a random yaw). Replaces Sun Temple's `boxFace()`, `edgeDistance()`, `drafted()`
and `triglyph()` (`materials.ts`), which read `positionGeometry` and so work only on unbroken boxes
(`onBox`), and gives the drums' flutes; Harbor Yard's roof plates and container insides
(`normal`); Neon Alley's lanterns' centres (`lanternSurface()`: `position.xz` instead of the glow
values' `yz`).

### `PieceOptions.smooth`: curved pieces shade round

Default 0 (flat faces, as before). An angle (radians): faces of the piece meeting at less than it
are shaded as one smooth surface (each corner's normal the angle-weighted mean of the faces round
it within the angle). A 16-sided drum's sides meet at 22.5°, its ends at 90°: `smooth: 0.5` rounds
it and keeps the rims sharp. Its cells keep it; their broken faces stay flat.

```ts
d.addConvex({ material: 'tank', points: segment(...), position, tint, textureFrame, smooth: 0.5 });
d.addConvex({ material: 'drum', points: cylinder(0.45, 0.6, 20), position, smooth: 0.5 });
```

For Harbor Yard's tank shells (`tanks.ts`) and Sun Temple's drums. Where a break cuts a face in
the middle, the new corner takes that face's own normal, so a cell's edge on the cut shades a
little flatter than the whole drum did.

### `uvScale` as `[u, v]`

`uvScale: number | [number, number]`: repeats per metre along u and v, for maps whose tile isn't
square (Sun Temple's roof tiles). A number works as before. `insideTexture.uvScale` stays a number
(the broken faces' maps are scaled relative to the surface's, on each axis).

### `BreakableMaterial.uvJitter`: same-sized blocks show different patches

Default 0. How far each piece's texture frame is moved at random along its own axes, as a share of
a tile (0–1): `uvJitter: 1` gives every block its own patch of the map. A piece's cells keep its
frame, so a crack doesn't shift the map. It draws on the Destruction's seeded random, so with a
jittered material the fracture patterns after it differ from before (they're as repeatable).

```ts
limestone: presets.concrete({ ..., uvScale: 1 / 1.5, uvJitter: 1 })
```

Replaces Sun Temple's `Kit.frame()` (`kit.ts`) and Market Town's `Kit.laid()` 'jitter' and
`rise()` (`kit.ts`), which move each piece's `textureFrame` by hand. Market Town's false bed joint
(drawn where the map's v is 0) moves with the map: draw it from `pieceFrame().position.y` instead
(mid-height of blocks of a course or more).

### `Piece.textureFrame`: a piece made again keeps its look

`piece.textureFrame` is the piece's texture frame where it is now (world), with its box as built
and its `smooth`. `PieceOptions.textureFrame` takes it as it is (a `TextureFrame`: a `Pose`, with
`box` and `smooth` optional): a frame with a `box` isn't jittered again, `pieceFrame()` measures from
that box, and the piece takes its `smooth` (unless the options give one). A plain `Pose` works as
before (jittered with `uvJitter`, its box the new piece's own).

```ts
// Sun Temple's levers.ts remake(): instead of building { position, rotation } from p.texture
const textureFrame = p.textureFrame;
d.removePiece(p);
for (const [c, loose] of parts) d.addConvex({ material, points: corners(c), tint, textureFrame, loose });
```

A world that makes pieces again by hand (a part that comes loose whole, the shards of a tile)
needs it before it takes up `uvJitter`, `pieceFrame()` or `smooth`: the frame built by hand from
`p.texture` has no box, so with `uvJitter` the map jumps (by up to a tile), each part gets a box of
its own (margins and flutes recentred on it) and the smoothing is lost. Where: Sun Temple's
`levers.ts` `remake()` and `index.ts` `shatterTile()`, Market Town's `shards.ts`. The library's own
breaks did this already.

### Ambient occlusion from the arm map

`FragmentMesh` now takes a surface's `aoMap` on the piece's own faces, not its broken ones (three
would have darkened those with the outside's map), at the same texture coordinates as the other
maps (so with `uvScale` pairs and `uvJitter`). Not done: `textured()` in `src/demo/textures.ts` (not
this team's file) doesn't set one. For every textured world to get it, add there
`aoMap: arm` to the `MeshStandardNodeMaterial` (the `_arm` map's red channel is occlusion; an
`ao` option for its `aoMapIntensity` if a set's is too strong). Checked in the browser with a
brick wall given the arm map as `aoMap`, `uvScale: [0.5, 1]` and `uvJitter: 1`, blasted.

### Glass and the dust behind it

Dust Town's request: panes cut bright shapes out of a blast's dust. The draw order was already
right (breakable glass at `renderOrder` 0, the particles at 1000): the trouble is depth. The puffs'
soft edges fade where they meet what's in the depth buffer, and a pane with `depthWrite: false`
isn't in it, so dust drifting over a facade fades against the wall but not over the windows, which
show as sharp, brighter window-shaped patches. The fix is the glass surface's own setting: leave
`depthWrite` at three's default (true), as `presets.glass()`'s surface does. `FragmentMesh` draws it
as the surface says (it doesn't override it). Checked in this phase on Dust Town's bank: the
patches go with the glass's depth on.

```ts
glass: presets.glass({ surface: new THREE.MeshStandardNodeMaterial({ color: 0x74837f, transparent: true, opacity: 0.66 }) }) // no depthWrite: false
```

Screen-space reflections then start on a pane, not on the room behind it. What it costs: dust or
rain behind a pane (in the room) isn't seen through it, and overlapping shards hide each other
instead of blending (they're small and brief). With depth on, Brick Street, Neon Alley and Harbor
Yard looked the same from their start (faint differences along the window outlines). Every world's
breakable glass sets `depthWrite: false` today: `nyc/materials.ts`, `western/materials.ts`,
`neon/materials.ts`, `harbor/materials.ts`, `medieval/materials.ts`. `docs/making-a-world.md`'s
'How it looks' could say this (its owner's file); `BreakableMaterial.surface`'s comment does.

### Props: a tint per copy (`addProp({ tint })`)

`PropOptions.tint`: the colour multiplying this copy (default: its model's `tint`, else white). On
a model with `tintMask: 'alpha'` it goes only where the colour map's alpha says, which
`process-props.py`'s `paint` writes; on others it multiplies the whole model. Each copy's tint is
kept through throws and when other copies go.

```ts
for (const tint of [undefined, 0x96483c, 0xbf9d48, 0x4b7352]) d.addProp({ model: models.drum, material: 'drum', position, tint });
```

`PropModel.tint` and `PropModel.tintMask` come from the pack's `index.json` (`loadPropPack`).
Replaces Harbor Yard's four baked drum colours (`finish-props.py` `finish_drum`: `drum_red`,
`drum_yellow`, `drum_green`, `drum_black`, ~2 MB) and Neon Alley's recoloured scooters, crates and
bins (`props-post.py` `variants`). Checked: four sedans from one GLB (the model's own navy, red,
white, yellow), glass, tyres and chrome untouched, thrown and landed with their colours.

### `process-props.py`: new per-prop fields (in `props.mjs`) and flags

- `scale: [x, y, z]` (three.js axes): stretches the model after it's fitted to `metres`.
- `roughness: [min, max]`, `metalness: [min, max]`: keep the metal/rough map (or the material's
  values) within these.
- `paint: { hue: [from, to], minSat }`: makes the paint tintable per copy. The texels whose hue is
  in range (degrees, through 360 when from > to; soft over 10°) and saturation over `minSat`
  (default 0.25) turn grey, keeping their light and dark, and the colour map's alpha says how much
  each is paint. `index.json` gets `tintMask: 'alpha'` and `tint` (hex: the paint's colour, so a
  copy without a tint looks as the model did). E.g. Harbor's blue drum: `paint: { hue: [180, 240] }`.
- `glow: [{ box: [[x0, y0, z0], [x1, y1, z1]], minLuma, color, strength }]`: an emissive map, as
  Neon Alley's `props-post.py` `glow` makes (same fields): texels of the triangles whose centre is
  in a box (three.js frame, m), brighter than `minLuma`, glow in `color` (`[r, g, b]`, or `'map'`
  for their own colour, the default) at `strength` (`KHR_materials_emissive_strength`). PropMesh
  draws it (it always kept a model's emissive map: three's loader gives it, PropMesh copies it); a
  vending machine can be a prop now. A raw model's own emissive map is kept (named
  `<prop>_emissive`; none of the raw models made so far has one).
- `round: 'x' | 'y' | 'z'`: the collider is a hexagonal prism round the circle the prop turns on
  (a drum standing: `'y'`; a cable reel on its side: `'x'`; a wheel facing the front: `'z'`), a
  face down, so it rests on a face without sinking. Without it: what it stands on (the lowest points
  nearest its footprint's four corners), its top, then the points that keep the hull closest to the
  model. Both are Harbor Yard's `finish-props.py` colliders (`hexagonal_prism`, `standing`), which
  it can now drop (Harbor's handles only `'x'` and `'y'`; `'z'` is new, and tested).
- `--colliders`: only fit the colliders again, to the GLBs as they are (`index.json` rewritten).
  The pack's `finish-props.py` isn't run with it (it may rework the models: Harbor's exports the
  drum and the reel again). So a pack that fits colliders there gets `process-props.py`'s own with
  `--colliders`: Harbor Yard's drum and reel would stand on a `standing` hull until its
  `props.mjs` gives them `round`.
- A pack's own last step: `scripts/assets/packs/<id>/finish-props.py` runs after
  `process-props.py` (as `__main__`, with the same arguments), with `pp`: `process-props.py`'s
  globals (its helpers and settings: `pp['process']`, `pp['collider']`, `pp['OUT']`, ...). It no
  longer needs to load the script minus its last line: `process-props.py` ends with
  `if __name__ == '__main__': main()`, so loading it under another name doesn't run it (Harbor's
  current loader still works). `--no-finish` skips it, and so does `--colliders`.

Checked on scratch copies (not the packs): the sedan with `paint` (its paint 44% of the texels, the
mask clean on the islands), the taxi with a `glow` box on its roof sign (glowing in the demo),
`scale`, the `roughness` limit, and a finish hook given `pp`.

### `pointedArch(span, thickness, depth, count = 10, radius = span)` (shapes)

The voussoirs of a two-centred (Gothic) arch: each half a ring of `radius` (the span: equilateral;
toward span / 2 blunter; over the span a lancet) centred on the springing line, `count` wedges in
all (made even: the halves meet in a vertical joint at the crown, since a keystone across the point
couldn't be convex), from the left springing to the right. Each comes with `outer`, the corners of
its outer face (x, y), left to right, to fit the fill over it. Place them at the middle of the
springing line, as `arch()`'s.

```ts
for (const v of pointedArch(2, 0.4, 0.5, 8)) d.addConvex({ material: 'limestone', points: v.points, position: [x, spring, z], rotation });
```

For Market Town's Gothic openings (its DESIGN.md requests). Tested: on two piers it stands, each
voussoir bonded to the next, the springers to the piers, the halves in a vertical joint at the
crown.

## Compound colliders

`solver.md` didn't exist when this phase finished, so `process-props.py` still writes
one convex collider per prop. Once the solver team defines compound colliders there, `collider()`
in `process-props.py` is where a prop's parts would be fitted (one `standing` or `round` hull per
part).

## What a world must change

Nothing: all of the above is off by default except the base pack's colliders. To adopt:

- Every world with breakable glass (all but Sun Temple): drop `depthWrite: false` from its surface
  (Dust Town's dust over panes most of all; its glass can then go back to a clearer opacity).
- Neon Alley: `glow: 'standing'` on `neon`, `lightbox`, `lamp`, `lantern`; `pieceTint()` for
  `tint()`; `pieceFrame().position` for the lanterns' centres; `tintMask` for the awnings. `Glow`
  then no longer darkens what came loose or broken faces, but keeps `x` as the per-piece switch (the
  curtained windows) and the flicker, the atlas offsets and their copying to cells, and what it
  tracks for the reactions. Vending machines and scooters as props (`glow`, `paint` +
  `addProp({ tint })`).
- Harbor Yard: `tintMask` for the container skin and the tanks; `smooth` on the tank shells;
  `pieceFrame().normal` for the roof plates' undersides; the drum's `paint` and `round: 'y'`, the
  reel's `round: 'x'` in `props.mjs`, then `addProp({ tint })` for the drum colours (and drop
  `finish_drum` and the colliders from `finish-props.py`).
- Sun Temple: first `p.textureFrame` as the `textureFrame` of what `levers.ts` `remake()` and
  `index.ts` `shatterTile()` make again (else the next items break there); then `uvJitter` instead
  of `Kit.frame()`, `uvScale: [u, v]` for the roof tiles, `pieceFrame()` for `drafted()` and
  `triglyph()`, `smooth` and flutes for the drums.
- Market Town: first `piece.textureFrame` for the shards in `shards.ts`; then `uvJitter` instead of
  `Kit.laid()` 'jitter' (the false bed joint from `pieceFrame().position.y`), `pointedArch` where it
  wants Gothic openings.
- Dust Town: a paint mask and `tintMask` for the siding.
- `src/demo/textures.ts` (its owner): `aoMap: arm` in `textured()`.
