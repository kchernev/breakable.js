# Breakable ground

The ground team's changes in this phase: a ground that breaks. A road, a square or a beach is laid
as slabs over a rectangle: a top layer (asphalt, cobbles, sand, paving) over an optional deeper
one (earth, gravel, rubble fill), resting on the world's fixed bed (its ground body, moved down to
the layers' bottom). A rocket into it leaves a crater, its chunks thrown up and out to land round
it; the gun chips it; the player walks down into a crater and out again. Brick Street's road is
laid this way, between the curbs along the row.

Files: `src/lib/ground.ts` (new: `Ground`, `groundPresets`, the slabs), `src/lib/destruction.ts`
(`addGround`, `groundAt`, `grounds`, `Piece.ground`, how blasts throw what they break out of a
ground, what bonds to a slab, what stands on a bed), `src/lib/index.ts` (exports),
`src/demo/player.ts` (footing, a pit's edge, the eye after a step), `src/demo/main.ts` (where a
bullet's chips and a crater's debris land, what a crater's floor is to the gun),
`tests/ground.test.ts` (new), and Brick Street's `index.ts`, `city.ts`, `materials.ts`,
`scenery.ts` and `README.md`.

**No world has to change anything.** Without `addGround` the library does as before (every change
in `destruction.ts` falls back to the flat `ground` when no ground is laid, and nothing is a
ground's piece; the tests and the six worlds' loads show it). A world adopts it as below.

## What it does

- **Slabs**: the area is cut into equal slabs nearest `cell` each way (Brick Street's 13 × 80 m road
  at 2.2 m: 6 × 36), one per layer. Neighbours share their faces exactly and every slab of a layer
  maps its textures in one frame (`textureFrame`, its box the whole layer's), so the layer stands
  seamless: the maps run on across the seams, no gaps, no faces over each other, no shading steps
  (the slabs and the drawn road they replaced, shot from one place in the same light: the slabs a
  few percent lighter in the shade, 67 against 63 of 255).
- **What holds a slab up**: what's under it, down to the bed, never what's beside it. The slabs
  bond to what's over and under them; their bonds sideways (to each other, or to a curb or a wall
  built before them) are cut once laid, and nothing bonds to their sides after (a piece of a
  ground bonds sideways only to pieces of the same ground: the cells of a slab hold each other).
  A piece standing on a slab (laid before or after it) bonds to it and goes when it goes. Each
  slab, and each cell cut from one where it stood, knows its ground (`piece.ground`). Inside a
  ground's area the ground is its bed (`d.groundAt(x, z)`): what lies on the bed is on the ground,
  a chunk hanging over a crater lower than the old ground isn't. A piece standing on the bed at
  the area's edge (a curb, its foot touching the area) is on the ground too.
- **A blast into it** breaks the slabs it reaches into cells (finer near it), as it does anything
  else, and leaves a pit down to what it reached (each material's `reach`). What it throws out of
  a ground (`piece.ground`) goes up and out of the crater along a cone, steeper from its middle
  (about 65°) than from its edge (40°), at `toss` (default 0.4) of the speed it throws anything
  else, so it lands round the rim: 2 to 5 m out, a few to 7 m. Rubble, wreckage or a car lying in
  a crater is thrown as it would be anywhere. The chunks go all at once, as soon as all the ground
  the blast reached is broken (it breaks nearest first, within the frame's 4 ms breaking budget:
  3 to 4 frames after the blast here, before the panes a road blast also reaches), and they pass
  through the crater's sides for a quarter of a second on the way out (`EJECT`). Thrown as each
  slab broke, they struck the next slab, not broken yet, and fell back in; thrown into the sides,
  they stopped dead against them and lay where they'd been: the crater was covered over. Cells too
  small to be bodies fly as particles (the demo's spray) and land on what's under them.
- **What stands round the crater** stays: cells beyond the blast's reach stand on what's under them;
  one left out over the pit is weighed like anything else (its material's `support` sideways: earth
  and sand hold nothing out, asphalt a little lip).
- **Rockets** strike the slabs as pieces; the gun's bullets too (`Destruction.shoot`: a fresh slab
  of asphalt takes about 35 rounds, the chunks after it a few each). A bullet into a crater's bed
  (no piece) is what the ground's lowest layer is (Brick Street's: dirt, a pock in the earth).
- **The player** finds the ground under the foot's breadth (the middle and four points 0.2 m round
  it, each no more than a step, 0.5 m, above the feet): standing on a rim until stepping off it,
  and not stood on what's over a step up beside it (a curb over a crater). Stepping up (onto a
  chunk, out of a crater) the feet go up at once and the eye eases up after them, most of the way
  in a tenth of a second. Down in a crater (more than a step under its ground's top), the ground's
  edge is a wall up to the ground beyond it (a curb, the road past where it breaks), met by the
  body's front as the crater's own sides are: it stops 0.35 m out. A jump gets out.

## How to use it

```ts
// build(d): the road between the curbs, asphalt over earth, its map running on into the drawn
// road beyond it
const road = d.addGround({
  material: 'asphalt',
  under: 'earth',
  area: [-40, -6.5, 40, 6.5],
  top: -0.15,
  depth: 0.3,
  underDepth: 0.9,
  cell: 2.2,
  textureFrame: { position: [-130, -0.15, 6.5] },
});
road.bed; // -1.35: where the world's ground body's top goes, and what groundAt gives in the area
```

`d.addGround(options): Ground` (a method of `Destruction`; `GroundOptions` and `Ground` are
exported):

| Option | Default | What it is |
|---|---|---|
| `material` | (required) | The top layer's material, a key of the Destruction's materials. |
| `under` | none | The layer under it. Without one the top layer lies on the bed. |
| `area` | (required) | `[x0, z0, x1, z1]`, world, seen from above. |
| `top` | the Destruction's `ground` | The surface's height. |
| `depth` | 0.3 | The top layer's depth (m). |
| `underDepth` | 0.6 | The layer under it's depth (m). |
| `cell` | 2 | About how wide a slab is (m): equal slabs nearest it each way. |
| `textureFrame` | the area's x0, z0 corner at `top` | Where the maps are laid from: on the top, u along +x and v along -z, at the material's `uvScale`. |
| `toss` | 0.4 | How hard a blast throws its chunks, a share of how hard it throws anything else. |
| `tint` | white | Colour multiplying the top layer's. |

`Ground`: `area`, `material`, `under` (null: none), `top`, `bed` (top - depth - underDepth),
`toss`, `slabs` (as laid, the top layer's first) and `contains(x, z, margin = 0)`. `d.grounds`
lists them; `d.groundAt(x, z)` is the bed inside one, else `ground`. `piece.ground` is the ground
a standing piece was laid as (a slab, or a cell cut from one), else null.

**Materials**: `groundPresets.asphalt`, `cobbles`, `sand`, `paving` (stone flags), `earth`,
`gravel` and `fill` (broken stone under paving), each `(options) => BreakableMaterial` like
`presets.*` (pass a `surface`). What sets them apart:

| | reach | impact | support | most cells a slab | bodies from | notes |
|---|---|---|---|---|---|---|
| `asphalt` | 0.5 | 30 | 10 | 12 | 0.1 m | chunks |
| `cobbles` | 0.45 | 30 | 4 | 18 | 0.1 m | sett-sized chunks |
| `sand` | 0.65 | 12 | 1 | 12 | 0.3 m | sprays; clears in 6 s |
| `paving` | 0.35 | 60 | 40 | 12 | 0.12 m | hard: a smaller crater |
| `earth` | 0.34 | 15 | 3 | 16 | 0.25 m | sprays; clods crumble where they land (`landing` 3) |
| `gravel` | 0.45 | 15 | 2 | 12 | 0.2 m | sprays |
| `fill` | 0.4 | 25 | 6 | 12 | 0.15 m | |

`reach` is how far a blast breaks it as a share of its radius: a crater's size. `impact` is over
what wreckage or a car landing on it strikes with (a car comes down at 15-25; four collapses into
Brick Street's road broke none of it), and it's what bullets measure a piece by (with the piece's
size, `bulletsToBreak`). Only asphalt over earth has been tried in a world; the others' numbers are
starting points.

## How a world adopts it

1. **Where**: only where the player can reach and shoot, and not under what must never go. Big
   cells (2-3 m) and two layers at most: each slab is a fixed body (next to nothing to the solver)
   but a piece, 36 vertices and a share of the broadphase. Brick Street's 80 × 13 m is 432 slabs.
   Each crater adds 60 to 85 pieces that stay (see Measurements): budget for the craters a play
   leaves, not only the slabs.
2. **Materials**: a top and, if the crater should go deeper than its top, an under. Start from
   `groundPresets`; give the top the surface the drawn ground had (the same texture set and colour,
   `uvScale` its repeat), an `inside` and `insideTexture` for what a break shows (Brick Street's
   asphalt shows `gen_concrete_broken` in a light grey: aggregate), and the under its own surface
   inside and out (both show in a crater). Sounds (`audio.materials`), `dust` and `chips` for each.
   Keep the under off stone's sound names if it's soil (`brick.*`, `concrete.*`): the weapons team's
   `materialKind` reads those first, and the gun then marks it as stone, not dirt.
3. **The bed**: move the world's fixed ground body under the area down to `ground.bed` (only there:
   Brick Street's road is a bed box the length of the street), and make the neighbours' bodies
   reach below the bed (Brick Street's sidewalk boxes are 2 m deep), so nothing slips under them
   from a crater. Lay the slabs where the drawn ground was, at its height, with `textureFrame` at
   the drawn ground's map origin, and take the drawn ground out over the area (a slab's top and a
   plane in the same place fight). Draw what a crater shows past the slabs where nothing else does:
   the bed (a plane at `bed`) and the sides of the pit where the area ends against scenery (a
   curb's face), in the under's look, from the bed up to the top.
4. **The same ground past the area** (a road past its breakable stretch): don't draw it as a plane
   in the same textures. The slabs are drawn by the library's `FragmentMesh` (its own tangent frame
   and lighting), and a plane beside them showed a seam, up to 12% lighter or darker in some light,
   the painted lines breaking. Lay it as the same layers in static pieces (`static: true`, never
   break or move), mapped in the slabs' frames: `textureFrame: ground.slabs[0].textureFrame` for the
   top, `ground.slabs[ground.slabs.length - 1].textureFrame` for the under (Brick Street's
   `roadEnds` in `scenery.ts`: four pieces, 90 × 13 m, on the bed). They are the ground's fixed
   body there too, and a crater at the end shows their faces: the top's edge over the under. They
   don't bond to the slabs' sides, so they hold none up.
5. **`groundAt`** gives `ground.bed` inside the area (Brick Street: `onRoad(x, z) ? ROAD.bed : …`).
   The player and the gun find the slabs as pieces above it; a rocket that hits nothing goes off
   on it. A world's `groundAt` is fixed in its definition, so compute the bed from the same numbers
   (`top - depth - underDepth`). Anything else that takes `groundAt` as a visual floor sees the bed:
   the demo's bullet chips land on what's under the strike (`floorUnder` in `main.ts`), and so does
   a crater's debris.
6. **Markings** (lane lines, crossings, parking bays): paint them in the top's surface from
   `pieceFrame()`: in the layer's frame its `position` is from the middle of the area (on the top,
   `position.y` is `halfExtents.y`; there `normal.y` is 1), so the paint stays on the chunks a blast
   throws and on the cells a bullet leaves (Brick Street's `roadSurface`: each pixel painted by how
   much of its breadth a line covers, so the lines thin out far off rather than vanish). Keep drawn
   markings only outside the area, or paint them on the static pieces past it.
   **Curbs**: a curb that shouldn't break stays scenery beside the area; draw its face down to the
   bed. A breakable curb is pieces standing on the bed at the area's edge (its foot on the bed,
   touching the area: within 2 mm of it), built before or after the ground: it stands on its own
   and doesn't bond to the slabs' sides, so neither holds the other up (a curb further out isn't on
   the bed as far as the library knows: it would need the world's `ground` there).
   **Decals laid on the ground** (drains, manholes, stains): paint them in the surface too, or make
   them thin pieces on a slab (they go with it); a flat mesh over the area floats over a crater.
   The effects' own marks (bullet holes, a blast's scorch) are fine: they go with the piece they're
   on, or are projected onto what's there.
7. **Footsteps**: `audio.footsteps.surface` gets the slab's material underfoot, and down on the bed
   `null` (at a height under the top layer, in the area). Give both a step of what they are (Brick
   Street: `steps.rubble` for `earth`, and for the bed under the road's top layer). The gun needs
   nothing: on a crater's bed the demo takes the ground's lowest layer (`under ?? material`) for
   what its bullets strike.
8. **`killBelow`** just under the bed (Brick Street's -2 m is 0.65 m under it).

Per world (not done: their teams' to try):

- Market Town: the cobbled square (`COBBLES`: 100 × 44 m; only the market's middle would do) as
  `cobbles` over `fill`; its cobble shader reads `positionWorld`, which would have to be
  `pieceFrame().position` (plus the layer's middle) to stay on the setts a blast throws.
- Dust Town: the street as `sand` over `earth` (no asphalt), its ground box 4 m deep already.
- Neon Alley: the alley's wet asphalt as `asphalt` with its own look (low roughness for the
  reflections, the puddle map in the surface).
- Harbor Yard: the yard's concrete as `paving` (concrete flags) over `fill`; not the quay's edge.
- Sun Temple: the paving round the temple as `paving` (marble) over `fill`.

## Measurements

On the RTX 4090 here, display :101, 1280 × 720, the GPU shared with other agents' Chromes (this
display ran at 25-50 fps). Scripts and screenshots:
`scratch/phase-e/ground/`
and, for the fixes after the review, `…/phase-e/ground-fix/` (`drive.mjs` runs a list of steps in
Chrome: each step's keys, then its wait, then its script; `out/`).

**Craters** (a blast at the demo's 2.3 m on Brick Street's road, as a rocket's: 0.15 m off the
surface; size as the diameter of the open area, depth the deepest point):

| | across | deep |
|---|---|---|
| first round: 10 spots | 1.72-2.36 m | 0.45-1.04 m |
| after the review: 8 spots (`cost.mjs`) | 1.64-2.86 m | 0.45-1.2 m |
| the reviewer's 10 spots | 1.58-2.26 m | 0.59-0.79 m |

Most of a crater's open area is the 0.3 m of asphalt gone, deeper where the earth went. A big cell
whose middle the blast reached goes whole, so a crater can go to the bed (1.2 m) anywhere: by the
curb with a car in reach (x -3, z -4.2) in both first-round runs, at (12, 4.5) after the review, and
a rocket mid-road at (0, 0.5) in the reviewer's. The pit's floor there is the drawn bed.

**What a crater costs**, counted by material 7 s after each blast (8 spots, `cost.mjs`): the
ground's pieces +61 to +85 a crater (asphalt +28 to +53, earth +15 to +49), its two meshes' vertices
+4.0k to +6.7k. Most of them are the cells left standing round it (four craters: standing ground
pieces 432 → 682, +62 a crater), the rest the chunks at rest round it (99 for the four at 7 s, 68
at 35 s: the small ones clear, `rubbleLife`; the rest stay). Ten craters took the reviewer's page
from 432 ground pieces to 1,109. A road blast near the row also shatters the panes it reaches
(-68 to -125 pieces of glass), so the page's total can go down: count the ground's own (the first
round's "19-22 pieces a crater" was that net total, and understated the ground's by about 3×).
Particles at their peak: 2.8-3.3k against a facade blast's 3.9k.

**Cost of the layer** (Brick Street with it and without it, the road then one fixed box as before,
loaded in turns; first round):

| | without | with |
|---|---|---|
| pieces at load (fixed bodies) | 7,119 | 7,551 (+432) |
| vertices drawn | 256,230 | 271,782 (+15,552) |
| draws | | +2 materials (asphalt, earth), +8 plain meshes (the road's two ends and their lines, the bed, the pit's four sides) |
| idle: 20 frames drawn back to back, ms a frame (best to median of 9 rounds), 4 loads each | 0.17-3.91 | 0.2-2.31 |
| idle: 20 solver steps back to back, ms a step (the same) | 0.31-3.76 | 0.31-2.76 |
| the player's CPU a frame | 0.056-0.067 ms | 0.061-0.074 ms (five rays down) |
| pipelines made after the card, a road blast, 40 rounds into the road | | none |

The idle timings are within the shared GPU's noise either way. After the review the road past the
stretch is four static pieces instead of two fixed boxes and six plain meshes (the planes, their
lines, the pit's end faces): 7,555 pieces at load, 271,926 vertices (+144), six fewer draws, drawn
by the two ground materials already there. Not timed again: four fixed bodies more.

**A collapse** (four blasts 1 s apart along the building at x 10-22, as `docs/changelog/phase-d`;
the first blast to +10 s; first round):

| | runs | frames over 40 ms | worst | mean frame | loose at +10 s | +20 s | road slabs broken | sunk into the road |
|---|---|---|---|---|---|---|---|---|
| without | 3 | 20-22 | 88-128 ms | 20.5-21.1 ms | 272-334 | 14-119 | | 0 |
| with (impact 300) | 3 | 9-28 | 57-104 ms | 19.9-23.4 ms | 260-300 | 6-106 | 0 | 0 |
| with (as now) | 2 | 8-26 | 73-101 ms | 19.6-21.8 ms | 290-295 | 80-158 | 0 | 0 |

The same within the noise. Its wreckage struck the road 0 and 4 times (the hardest 9.6, under
asphalt's 30).

**Breaking**: cutting a 2.2 m slab of asphalt into 12 cells takes 3-6 ms of CPU (building each
cell's collision hull 41%, the Voronoi cut 32%, bonding 9%), so a road blast's eight slabs take 3-4
frames of the 4 ms budget; its chunks fly then (76-158 ms after the blast at this display's frame
rate). Waiting for all the blast reached (a road blast also reaches 72 panes of the near facade),
they went 0.3-0.36 s after it. With 16 and 24 cells a slab the craters were much the same (0.64-0.88
m deep, 1.95-2.6 m across) from 40 cells a pair of slabs instead of 28.

**The player** (positions every frame, `…/ground-fix/out/pit/`, `step.mjs`): in a pit dug to the
bed in the corner of the curb and the stretch's end (x 39, z -5.6), walking at the end stops at x
39.56 (its face, found by the wall rays) and at the curb at z -6.14, 0.36 m out (before the fix:
-6.50, half the body in the wall); a jump at the curb, walking on, lands on the sidewalk (y 0) and
walks on. Walking out of a pit 0.3 m deep (a top slab out): the feet up 0.30 m in one frame, the
eye at most 0.12 m a frame at this display's 25 fps (0.30 m before the fix), at the eye again in
about 0.15 s. First round: walking along the road through a crater, down 0.36 m and up over a
chunk and out without a stop (`out/walk2/`).

**Sounds and strikes in a crater**: Brick Street's `footsteps.surface` gives `steps.rubble` on the
earth and on the bed (it gave `steps.asphalt`); 8 rounds into a crater's bed struck `dirt` (they
struck `concrete`), 8 into its side the asphalt (`concrete`).

**Debris**: a road blast's cells too small to be bodies flew from inside the road and, with no
floor of their own, lay on the effects' one ground (y 0) for 2-4 s: a line of chips across the
crater at eye level, 1.35 m over its floor. Now they land on what's under them
(`…/ground-fix/out/chips-before`, `chips-after`, `spray-ab-*.png`).

**The stretch's ends** (`…/ground-fix/out/seam-before`, `seam-after3`, `seam-along-zoom2.png`,
`seam-oblique-ab2.png`): the double yellow ran on into a plane's flat line with a step at x
±40; now one material and one frame on both sides, no step, and the lines carry on to the horizon
as they did on the drawn road (on the slabs they faded out sooner before the box filter).

**The gun**: 120 rounds at one spot of the road: the first slab gave way at round 65 (the spread
put them on two slabs), then a chunk every few rounds, leaving a pothole showing the aggregate
(`out/gun2/`). With asphalt's `impact` at 300, 90 rounds took a slab to 13% of what it could take.

**Screenshots** on Brick Street (`out/proof/`): a rocket into the road at 0.4 s and 0.9 s (a chunk
with the double yellow on it), the crater from the player's height and from above, the player
standing in it both ways; the intact road (`out/look1/`, `out/look2/`) and against the drawn road it
replaced (`out/ab-road/both.png`); after the review a rocket at the stretch's end and a pit's
corner there (`…/ground-fix/out/end/`), the gun into a crater's bed (`…/ground-fix/out/gunbed/`).

**Tests** (`tests/ground.test.ts`, node:test on the fake world; 10): the layer stands on its bed,
one texture frame, no sideways bonds; a slab whose under-layer goes falls in; a rocket's crater
(open within 0.6 m, 0.5-1 m deep, its rim at 2.2 m standing, chunks thrown up and not far, passing
through the sides while `EJECT` lasts and colliding with them after, the rest and a post on a slab
standing); a bigger blast down to the bed; a top layer alone on its bed; in a crater a chunk on the
bed comes to rest and one hanging over it doesn't; a curb on the bed at the area's edge stands on
its own, holds no slab up and isn't held by one; a brick lying in a crater is thrown as hard as one
outside, and not up out of it; the player in a pit by the curb stops a body's breadth from it,
isn't lifted by what's over a step beside it, and jumps out; walking out of a shallow crater the
feet step up in a frame and the eye at most 0.1 m a frame. `npm test`: 199 of 199; runs under a load
average of 21-28 (other agents) failed one to three tests in other files (a hull's build time,
the resting checks' 2 ms a frame, once a strike's sound), which passed alone and on other runs.

## For the other teams

- **Weapons**: bullets measure a piece by its material's `impact` and its size, and a ground's
  slabs are big (2.2 m: size 1.1). With asphalt's 30 a fresh slab takes about 35 rounds; the first
  break cuts the whole slab (3-6 ms, one frame) and the chunks after take a few each. A per-ground
  rule (a slab's size taken as its layer's depth, say) would make the first chip come sooner;
  `shoot` is yours, so it's left as it is. Chips of a strike land on what's under it
  (`floorUnder`), since `groundAt` is the bed under a breakable ground.
- **Effects** (`effects.ts`, the weapons team's): `impact()` has no floor, so its chips lie on the
  effects' one ground. `main.ts` sprays a crater's debris with `bullet()`'s look instead (chips and
  powder of what it is, dirt for earth, with a `floor`), which reads well but is smaller than a
  blast's chips elsewhere. An optional floor on `impact()` (as `bullet()`'s `look.floor`) would let
  it use the blast's look with `floorUnder(at, [0, 1, 0])`.
- **The doc pass** (`docs/making-a-world.md`, not ours): its `groundAt` line still reads "the
  ground's height". Suggested bullet for the world contract: "**Breakable ground** (optional):
  `d.addGround({ material, under, area, top, depth, underDepth, cell, textureFrame })` in `build`
  lays a road or a square as slabs on the world's fixed bed; inside the area `groundAt` must give
  the bed (`top - depth - underDepth`), and the world's ground body's top goes down to it there.
  See `docs/changelog/phase-e/ground.md`."
- **Brick Street** (to finish): the earth's texture is Market Town's (`rocky_trail_02`, Poly Haven
  CC0, greyed): copy it into Brick Street's pack (and its credit) if the packs should stand alone.
  The pit's sides by the curbs are plain planes; a curb that shows its concrete for its first 0.3
  m would read better (the stretch's ends do now: the static asphalt's edge).

## Not done, and known issues

- Ground pieces count toward the loose cap and the piece budget like any other, and a crater's
  stay: 60-85 pieces each, most of them cells left standing round it (a slab is cut into 12-16
  cells around the blast, and the ones out of its reach stand). Fewer cells a slab would cost less
  and make blockier craters; not tried.
- At a grazing view a seam between two slabs can show as a 1-pixel dark line: seen from 2.5 m at
  the player's height, at one seam (x -35.56), not from 1 m further or from above. The neighbour's
  side face, under the shared edge, ties the tops in depth there. It was there before the review
  (`…/ground-fix/out/seam-before/along-40.png`, row 649); ambient occlusion and shadows aren't it.
- Thin asphalt chunks often come to rest on their edge, standing up round the crater.
- A crater's earth faces are flat (Voronoi cells): a bowl only at the scale of the cells.
- `support` and `overGap` look at the ground per corner: unchanged without a ground, a little more
  work with one (a short list).
