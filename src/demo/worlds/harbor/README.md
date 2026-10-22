# Harbor Yard

A container yard on a quay on a grey, foggy morning: stacks of faded 20 ft and 40 ft boxes, a
yellow gantry crane with a 40 ft box hanging from its ropes, a corrugated warehouse with racking
inside, three fuel tanks in a bund, light masts, pallets, drums and vehicles, and dark water beyond
with a container ship, the far quay's cranes and a lighthouse in the fog. The yard's paving breaks:
reinforced concrete slabs over crushed stone, which a rocket craters and the machine gun chews.
Round it everything stands as scenery until a round or a blast reaches it, then breaks as the yard
does: the deck round the apron, the quay wall, the ship, the far quay and its cranes, the
breakwater and its lighthouse, the buoys and the port behind the yard (Round the yard); only the
water and the sky don't. The yard answers the gun as it does a rocket: a fuel tank leaks from each
hole and, holed enough, catches fire; a drum leaks; the gulls on the bollards and the crane go up;
the open box's doors swing. `?world=harbor`.

The plan it was built from is `DESIGN.md`; where the build differs, this file says so.

## Files

| File | What |
|---|---|
| `index.ts` | The definition: sky and look, audio, and the reactions to blasts and to the gun (tipping stacks, splashes, tanks leaking and burning, drums leaking, the open box's doors, booms on landing, gulls, the ship's horn, the crane's beacon, sea fog) |
| `meta.ts` | The picker card (order 4) |
| `materials.ts` | The yard's 16 materials (14 drawn at load; `drum` is for props, `plate` for the ship once it wakes), and the dust and chip colours (the apron's too) |
| `ground.ts` | Where the quay ends and the water begins, the crane's rail beams, the roofs and drains, and the apron: its areas, depths and bed (`APRON`, `onApron`, `layApron`) |
| `paving.ts` | The pavement's look at a point on the deck (the drawn deck's and the slabs' alike), its painted lines, drains and oil, and the apron's two materials (`slab`, `gravel`) |
| `../../fire.ts` | A burning tank's flames and light (its smoke is the demo's puffs), and the leaks: a stream down from each hole, a pool spreading at its foot (`Leaks`); shared since Brick Street's cars burn too |
| `gulls.ts` | The gulls: perched on the bollards, the crane and the stacks, put up by a blast or the gun, wheeling over the harbour, back once it's quiet |
| `frame.ts` | A local frame for laying structures out from corner coordinates (so neighbours share faces exactly), and `weaken` (lighter-built joints) |
| `containers.ts` | The container builder, the yard's blocks, the quay pair and `jolt`, and `tipStacks` |
| `crane.ts` | The gantry crane, its trolley, cab, hoist and hanging box |
| `warehouse.ts` | The portal-framed shed, its doors, windows and racking |
| `tanks.ts` | The fuel tanks and the bund |
| `yard.ts` | Pallets, cartons, light masts, kerb, bollards, barriers, the crane rails' end stops, the site office |
| `props.ts` | Where the harbor pack's models stand, and the drums' paints |
| `scenery.ts` | The deck (its fixed body, the bed under the apron, the pavement drawn round it and in the world in 12 m tiles, `DormantGround`, each laid breakable as the apron is where a blast reaches it: `deckBed`; what a crater shows past the slabs), the crane's rail beams as pieces (`railBeams`), the water, and, each dormant until something reaches it (`dormantScenery`): the quay wall in 12 m lengths with its fenders and ladders, the container ship (its hull in 10 m lengths, the bow, the 552 boxes on its deck, the house), the far quay's three cranes on their dormant quay, the breakwater and its lighthouse, the buoys, the port beyond (box stacks, gantries, light masts, sheds) |

## How it's built

About 6,900 pieces and 33 props (6,907 bodies, counted from the code, not measured: the 6,835
measured, the forklifts and tractors two each, 261,600 vertices then, and the crane's rail beams'
72 since): the apron's slabs 816, containers 3,620 (54 boxes, 54 or 84 pieces each, the closed
doors' 212 bars `steel`), steel about 1,030 more (the crane, the shed's frame, racking, masts,
ladders, the rails), timber and cardboard 580, cladding and doors 330, tanks and their roofs 220,
concrete 205 (the rail beams' 40 with it). What stands round the yard adds no pieces until it
wakes (Round the yard).

- **The apron** (`ground.ts`, `Destruction.addGround`): the yard's paving from 4 m in from the
  quay's edge (z -26) to the far blocks (z 42), x -48 to 48, in five areas round the crane's two
  rail beams (x -36 to 8, 0.8 m wide: pieces of their own, below); the quay's edge strip with its
  kerb, bollards and the pair of boxes stays as it was. Each area is `slab` 0.3 m (reinforced
  concrete) over `gravel` 0.4 m (crushed stone), on the bed at -0.7 m (the deck's fixed body
  there; `groundAt` gives it on the apron). Slabs are the pavement's own 4 m: west and east of the beams they lie joint to joint
  with its map; between the beams the bands are 3.84 to 4.6 m deep. 408 slabs a layer, all mapped
  from one frame (x 0 on the quay's edge), so the map, its joints and its paint run on across them
  and across the drawn deck round them. Everything in the yard stands on them and bonds to them:
  a slab cratered under a stack's corner post drops it, and the stack tips (`tipStacks`).
  - `slab` is the library's `paving` with asphalt's reach (0.5: a rocket leaves a crater 2 to 7 m²
    open, through to the stone and mostly to the bed), cut in 24 by a blast, its chunks thrown out
    of the crater (`toss` 0.6) to land round the rim, out to 3 to 7 m, and `impact` 40: the
    crane's heaviest lengths strike it at 25 to 35 in most of its falls, which it takes, and at 42
    and 50 in two of seven, one of which cracked the slab it struck; the gun cracks a fresh slab in
    14 to 20 rounds. Its cells under 0.45 m aren't bodies (`minBodySize`): what a round cuts flies
    as grit, so a burst opens a pothole into the stone rather than leaving a heap of wedges
    standing, and a rocket's thin wedges go too, rather than landing on edge in its crater and round
    its rim, where the player walked over them. Its broken faces are `harbor_slab_broken`:
    fractured concrete with the bars of two mats of reinforcement in rows 0.065 and 0.235 m down
    (laid 1 m a tile from the slab's top, so the rows stay level on every upright break, and on a
    chunk however it lies).
  - `gravel` sprays: no cell of it under 1.2 m is a body (`minBodySize`), so what a blast reaches
    flies as grit, and what it doesn't stands round the pit (`keepSmall`). As bodies, its cells lay
    round a crater as blocks of stone, and filled it.
  - The deck's fixed body is the bed under the apron (the rail beams stand on it), round it the
    dormant deck's 12 m tiles (fixed boxes from 0 down to 12 m, so nothing slips under them from a
    crater; Round the yard) out to 240 m either way and 320 m back, and at 0 past them. Drawn: the
    bed (crushed stone) and the deck's edge all round (its slab over the stone), where a crater at
    the edge shows them.
- **The crane's rail beams** (`railBeams` in `scenery.ts`, laid on the apron's bed before the
  yard, so the crane stands on them): each a concrete beam from the bed up flush with the deck, in
  20 blocks of 2.2 m, darker than the rest (`concrete` tinted 0x5e605e), and on it a steel rail
  standing 7 cm in lengths of 2.05 m (`steel`), but under the crane's bogies, which stand on the
  beam: 40 blocks and 32 lengths of rail in all. They were fixed bodies, drawn as strips.
- **Containers** are bonded parts: corner posts in two halves, rails, floor, roof, wall panels in
  two rows, end wall, door leaves and locking bars. The bars are `steel`, 4.8 by 6 cm (8 kg), a
  little darker than the frame, on leaves set in 5 cm (so they stand inside the posts' faces): drawn
  true to size in the boxes' light sheet they'd weigh 1 kg, light enough for a box landing on one to
  press it into the deck (a light piece holds about 150 times its weight at `maxSpeed` 25). Top
  rails and the roof stop 2 cm under the post tops, so a box on another bears on the four posts and
  nowhere else; rows are 0.30 m apart and bays 0.40 m, so each stack stands and falls on its own.
  Every box gets a paint from the palette (frame 18% darker; no beige: corrugated, it read as a
  timber fence) and a texture offset of up to 300 m along its walls, which also picks how rusty it
  is (see Look). Each piece's texture frame
  is turned a quarter or a half about the vertical by the corner of the box it's at, so its faces
  toward the box's middle face +x or +z in it: the skin paints those as the inside (a vertical
  face's map doesn't change with the turn). `minSize` 0.45 keeps every panel and roof sheet under
  the cut size: a blast throws them whole.
- **Tipping.** The library's weighing tips a piece whose weight has moved off what it stands on,
  but a box on three posts still has its weight over them, and a corner post standing alone still
  carries. So `tipStacks` looks, for a moment after each blast and collapse, for boxes that have
  lost both corners at an end or a side (their own, or any under them), or a single corner with
  another box on them (one rocket at the foot of a 3- or 4-high stack). A corner is lost when its
  bottom post is gone or has moved over 5 cm from where it was built, or when the bottom side rail
  and end rail beside it are both gone. In a stack of three or more, the second box also goes when
  the bottom box has lost over 30% of its pieces (over the side it lost most from). The box goes
  with everything on it as one section (`d.release`), turning over its far foot at 1.2 rad/s and
  pushed 0.4 m/s toward the lost side (without the push the library's own turn leaves it leaning
  on the stack: tried, the top box stayed up for 20 s). For a single corner, the end of the box
  under it over that corner buckles first (`buckle`: its posts and panels let go whole with
  `d.loosen`, pushed out and tipping outward, its top rails and roof let drop), so the box has
  nothing under that end and goes lengthways, out of the row. One blast at the south foot of
  Block B's 4-high stack (21.1, 0.8, 0.75): the top box's middle came down from 10.2 m to 3.1 to
  7.0 m in 13 runs of 14 (onto the pile), and to 8.7 m in one (across the next stack, on its roof);
  0 to 97 pieces still loose 20 s after, 0 to 3 at 40 s.
- **The quay pair** stands on the kerb line (z -29.3 to -26.9); its upper box was landed badly,
  1.4 m out over the water. It bears on the lower box's seaward posts with its end rails, its
  middle past them, and is held by two hand bonds from its landward posts to the lower box's end
  rails (its twistlocks). `jolt` lets it go (`d.release`) once either box loses a piece (any
  rocket that touches the pair), tipping into the harbour over the lower box's seaward edge at
  2 rad/s and pushed out 1.5 m/s (its middle is only 0.18 m past the pivot: turned slowly, it
  stalled on the lower box's roof edge). Nothing freezes now with its middle out past what holds
  it, so the old watch that sent a stalled box over again is gone. One blast at (-24.5, 1.2,
  -29.5) puts it in the water (3 runs of 3: 48 or 49 of its 50 pieces).
- **The crane** reaches the ground only through its legs, bogies and sills. `steel`'s support is
  low, so after `reinforce` a cut leg overloads the others and the crane folds toward the cut.
  `steel` tears rather than shatters: `maxPieces` 2 and `minSize` 0.6 (a 0.9 m leg length is cut
  in two at most, nothing under 0.9 m is cut), so the plastic joints do the bending; broken faces
  are dark bare steel. Its lattice diagonals are prisms cut level at both ends, so they lie flat
  on the chords and bond by themselves. The hanging box's post tops bond to the spreader's end
  beams; two cut ropes drop it. Four rockets at the legs' feet, 1 s apart: the legs fold, and the
  girder truss with the trolley comes down onto Block A's stacks and rests across them, its top
  9.1 to 13.3 m up (11 runs): on the boxes it lies on, which don't give way under it (see Known
  issues).
- **The warehouse**: rafters are prisms with vertical cuts (they bond to each other and across the
  ridge), purlins and sheets are laid in the slope's plane on the rafters (they bond face to face),
  a ridge cap lies on both top rows. Wall sheets stand on a concrete plinth, on the columns' outer
  faces. The gable posts and rafter feet are bonded by hand. The portal frame (columns, rafters,
  eaves beams, purlins, gable posts) is `steel`, its members joined to each other at half strength
  (`weaken`: `Bond.strength` 0.5), so two blasts at the feet of two north columns (-22 and -16, 1,
  7.6) bring that bay's roof down: of the 57 roof pieces over the bay 9 stand, and 90 to 97 of the
  roof's 278 (3 runs; with the old `frame` material, steel at half the support, 9 and 95; joined
  at full strength, 9 to 17 and 110 to 112). The light masts and ladders are plain `steel` (a mast
  blown at its foot falls whole, as it did as `frame`).
- **Tanks** are courses of shell segments, each curved outside (9 flats, `segment` in tanks.ts,
  shaded smooth: `smooth: 0.5`) and flat inside, with cone roofs of plates (`roof`: each wedge in
  two, a ring plate outside half the radius and a wedge to the apex inside; the ring plates bonded
  by hand to the top course). `roof` cuts a plate in two at most, so it creases rather than sails
  off whole. Each tank keeps its courses (with where each was built) apart from its roof plates.
  The roof vents, the pipe, the bollards and the crane's wheels are shaded smooth too.
- **The open box**'s door leaves stand swung 110° out, 16 cm off the ground, held by a small bond
  to their posts. A blast within 12 m that leaves them standing hangs each on a hinge from its post
  (`d.hinge`, about the vertical) and pushes it away from the blast (`d.push`): they swing, and
  bang against the box. Their hinges are stiff (`drag` in index.ts: at each new pose a leaf loses
  0.05 m/s, pushed against its motion): a leaf blown open swings out and back and stops in about 3
  s, and then hangs at rest (`stats.hanging` 2, not counted as moving). On free hinges a leaf
  turned on at 0.03 to 0.08 rad/s for good (still at +40 s in 5 crane collapses of 5).
- **Props**: one drum model whose blue paint takes a tint per copy (`addProp({ tint })`: the
  model's blue, red, yellow, green and charcoal; rust and bare steel keep their colour), colliding
  as 16-sided prisms, so drums and reels roll (a lying drum pushed at 3 m/s rolls 3 m and slows).
  The forklifts collide as their body and their forks, the tractors as their chassis and their
  cab (`PropModel.colliders`): what lands on the forks or the deck lies there, not on a hull drawn
  from the mast or the cab roof. Each of the four has its shards (`<name>.shards.glb`): a blast's
  heart (within 0.85 of its radius) or enough rounds breaks it into them.

## Round the yard

What's round the yard (`scenery.ts`) stands as scenery until something reaches it
(`Destruction.addDormant`, through `DormantUnits` in `../../dormant.ts` and `DormantGround` in
`../../dormant-ground.ts`): drawn (instanced where it repeats), and solid as fixed bodies, until a
round or a blast reaches it; then its instances are hidden, its bodies taken out of the world, and
it's built as pieces (`awaken`), and what stood on it stands on its pieces. A blast wakes what's
dormant within 1.25 of its radius, a round the first thing dormant on its way (and goes on into
its pieces), and a piece that goes from under something dormant wakes it. `build()` makes it all
dormant (`dormantScenery`) once the yard is up.

- **The deck** round the apron (`deck`): 480 by 320 m in tiles of 12 m, but over the apron, each a
  fixed box from the deck's top to 12 m down, which rounds strike as the scenery it is. A blast
  reaching a tile lays it as the apron is laid (`slab` over `gravel` on the bed, mapped from the
  quay's edge as the apron is, so the paving runs on), cuts the drawn deck away over it, and walls
  its pit's sides with the crushed stone where it meets a tile still dormant; `groundAt` gives its
  bed there from then on (`deckBed`).
- **The quay wall** (`quayWall`): its face from 3 m under the deck up in 40 lengths of 12 m, each
  dormant. Woken, a length is blocks of `concrete` 2 m long, 1 m high and 0.6 m thick on a ledge
  (the lowest row wet and dark), with its fenders (`cable`, lying along the wall) and its ladder if
  it has one (`iron` stiles and rungs). Under it the rest of the wall stays a drawn face, and the
  ledge a fixed body.
- **The container ship** (`ship`): its hull under the water a fixed body, and above it 19 lengths of
  10 m, each dormant with the hatch covers over it. Woken, a length's sides are plating in rows
  drawn as the hull is (the red boot top 2.6 m up from the water, black, the pale strake under the
  deck edge, black to the deck), with a bulkhead at its fore end and one across its middle (and at
  the stern), the deck resting on them and the covers on it. They're `plate` (`materials.ts`): steel
  drawn 40 cm thick and light for it, bending before it tears, so a blast tears a hole in it (the
  plate it strikes cut up, the nearest thrown) and the rest stands. The bow wakes in six slices
  along it. Each of the 552 boxes on its deck (12 bays of 40 ft boxes, 12 across, 3 to 6 tiers) is
  dormant on its own and woken as the yard's boxes are (`container()`, in its instance's paint),
  standing on what's under it. The house aft wakes as `cladding`: its walls in storeys (the window
  bands dark), its roof, the bridge wings and the funnel.
- **The far quay** (`farQuay`): its three ship-to-shore cranes each dormant (their members fixed
  boxes; woken, `steel` in lengths of up to 3 m, the booms with them), on a quay of dormant ground
  in 10 m tiles that a blast lays breakable as the apron is (in 3 m slabs).
- **The breakwater** wakes as three courses of rock (`concrete` blocks of up to 4 m), and **its
  lighthouse** as seven courses of eight blocks each (the red band's red), its lantern a `lamp`
  and its cap concrete.
- **The buoys** wake as their body and top in `iron`, loose, to sink.
- **The port beyond** (`farYard`): each of its 651 boxes dormant and woken as the yard's are; the
  four rubber-tyred gantries and the six light masts woken as `steel` in lengths (a mast's head a
  `lamp`); the four far sheds and the near one as `cladding` walls round them and a roof (the near
  one's roof and doors with it).
- **What doesn't break**: the water and the sky.

## Look

- Sky: Poly Haven `kloofendal_overcast_puresky` (CC0), sun azimuth 0.75 at the HDRI's own
  elevation (23°: a grey morning; `sky.elevation` isn't needed), background 0.72.
- Fog `0x929ea8` from 6 to 340 m; `update` breathes its far end ±40 m over 70 s.
- Exposure 0.92, a cool grade (saturation 0.92, contrast 1.06, tint `0xeef2f6`, vignette 0.25),
  and screen-space reflections (rays to 30 m) for the puddles and the water. No heat haze: a cold
  morning.
- The pavement (`paving.ts`) is one function of a point on the deck, drawn on the deck round the
  apron (from its world position) and on the slabs' tops (from their map coordinates, which run in
  the apron's frame: where on the deck the slab was laid). It samples the 8 m concrete tile and
  turns or mirrors each tile at random (the slabs are symmetric, so joints still line up). The
  tile's own puddle and tyre track still dotted the yard on the 8 m grid from above, and (the
  roughness map under 0.3 there) were glossy wherever they fell, under the shed too, mirroring
  the sky as white patches. So the colour is divided by a blurred copy of itself (mip level 6,
  0.5 m texels: the grain stays, the blotches go; mixed at 0.85), and the map's roughness is held
  at 0.55 or more outside the wet patches (0.6 under a roof). Only the procedural wet patches
  shine: darker, glossy (0.07) and flat, so they mirror the yard. No normal map now, on the deck or
  the slabs: the library draws a slab's normals from its material's map with no way to flatten it
  in a puddle, and bumped puddles smeared the reflections; the dry pavement looks the same without
  it (the lower third of three views: mean brightness within 0.6 of 255 of before).
- Painted on the pavement (`markings`, `stains`), on a slab's top face only (its sides and broken
  faces are bare): the yellow lane edges, the white bay stripes, the drain grates (cast iron, a bar
  every 4 cm) and the oil under the vehicles, each pixel by how much of it the line covers (they
  thin out far off rather than flicker). Over the wet, as when they were strips on the deck: the
  water stands round them. They go with the chunks a blast throws and stay on the cells a bullet
  leaves. The yellow line that crossed the two rail beams as a strip is gone with the strips: the
  beams are concrete pieces now, and the lane's edge stops at each.
- Wet patches lie where water would: near the drain grates, along the crane rails and the lane
  edges, fewer elsewhere (a 0.012 noise), none under the shed or the office (`ROOFS`). Their edges
  dull through roughness 0.25 before the middle goes glossy.
- Concrete (`greyConcrete`, and the quay wall `0x8e9496`) takes 70% of the yellow out of the
  base pack's `concrete_wall_008`, which read olive in shade under the cool grade; the bund,
  plinth and office blocks are tinted `0xb4b8b8`. Each block shows its own patch of the map
  (`uvJitter: 1`), as do the steel members and the pallet boards.
- The crane rails are 7 cm lengths of `steel` (0x4a4c4e) on a darker concrete beam (x -36 to 8),
  both pieces (`railBeams`; the apron is laid round the beams); the bright worn head strip went
  with the drawn rails.
- The water is opaque, dark (roughness 0.13, `envMapIntensity` 0.3), with five travelling waves in
  its normals, each wave's crests bent by a slow noise, and a fine noise chop; each fades where it
  would be finer than a couple of pixels (it only shimmered). Its normals are computed in the
  world, so the plane's rotation is baked into its geometry (`transformNormalToView` takes the
  object's frame).
- The container skin (`containerSkin`): the map's own rust flecks go back to paint, and rust is
  put where it collects on a real box: runs down from under the top rail and patches along the
  bottom rail (procedural, from the height in the box: each box's texture frame has its floor at
  v = 0), plus the map's rust inside those bands. A slow noise along the walls, read through the
  box's random texture offset, makes some boxes nearly clean. The tint goes on the paint only
  (`tintMask`, per channel: the share of each channel that's paint, so a rust patch's edge blends
  into the box's colour rather than into the map's pale grey); the oxide (`0x5e3b26`) keeps its
  colour on any box. Inside (faces toward the box's middle, the roof's underside) is grey primer,
  untinted and unrusted; the floor's top (the only pieces 16 cm thick and over a metre each way,
  `pieceFrame().halfExtents`) is brown boards.
- Painted steel (`paintedSteel`): the map's chips and specks mostly painted over, normals at 0.25
  (the shed's frame and the masts had 0.15 as `frame`: side by side, no difference shows), metalness
  0.35, roughness 0.45, so the crane reads as enamel on plate. Crane ochre `0xd4a43a`. The trolley
  house is `0xb8b4a8` with a door and a louvre strip.
- The tanks (`tankPaint`): the map 85% painted over, dark seams between the 2 m courses, welds
  every 1.6 m staggered course to course, light rust streaks down from the roof edge (each tank's
  texture frame has its origin at the roof edge, so the paint knows the height under it); the
  white and the green band are tints on the paint only, as on the boxes. Roughness 0.62. The roof
  plates' undersides are dark unpainted steel (`pieceFrame().normal`), seen once the roof blows.
- Wall sheets on the shed and the office share one texture frame per wall, so the cladding's ribs
  and stains run on across sheets.
- Cartons carry a strip of tape along the top and down the ends, and darker edges (`cardboard` in
  materials.ts, from where on the carton a point is: `pieceFrame()`, so a burst carton's flaps
  keep their tape).
- Floodlights and the crane's beacon glow only while they stand (`glow: 'standing'`): knocked
  loose, they go dark.
- The glass writes depth (three's default), so the blast's dust fades against the windows as it
  does against the walls.
- Dust and smoke: a grey palette (`look.dustPalette`: four greys, each material's own colour at
  0.6) with the materials' real colours (`dust` in materials.ts: rust-flake brown for boxes, grey
  for steel, pale for tanks and concrete); steel and sheet raise little (`dustAmount`: boxes and
  steel 0.15, tanks 0.1, cladding 0.25). A rocket's cloud is grey smoke and grit (`look.smoke`:
  `0x8c8e8e`, density 0.85, life 0.7, size 0.8). A tank's roof blowing raises black smoke (the
  effects' smoke set to soot for that one explosion).
- The far yard's boxes use the container map projected in the world, with procedural
  corrugations in the normals; its blocks stand at x ≥ 72 and x ≤ -100 and at most 4 high, where
  the fog softens them. The one shed near the yard (x -71..-49, 15 m past the warehouse) is clad in
  the same corrugations, with a dark roof and a roller door in each face toward the yard; the
  others are plain, far off in the fog.
- The ship lies at z -215 with a 15.8 m freeboard, a flared dark bow, a red boot top (also round
  the bow), a pale rubbing strake, hatch covers under its bays, boxes drawn with the far yard's
  corrugated material, and a pale house with rows of windows and the bridge's, the funnel on the
  house's after half.
- The player keeps to the quay (`walkable`: z past the edge + 0.3); over the water `groundAt` is
  the water's surface, where a rocket fired at it goes off.

## Sound

The harbor pack (`public/packs/harbor/sounds/`) over the base pack. Materials as DESIGN section 7,
with pitches of their own (`MaterialSounds.pitch`): cladding and roller doors clang and tear higher
than a box's walls, a tank's shell lower, cast iron duller, the floodlights' panes higher,
cardboard's knock (`wood.impact`) lower. The world plays the rest itself:

- `container.boom` once when a box comes down whole (the `landed` event of a container section of
  20 pieces or more, or over a tonne), louder the faster; a heavy length of the crane (steel over
  4 t) booms at pitch 0.7. A loose panel only clangs: `heavyImpact` for `container` and `tank` is
  `container.clang`. The 4-high stack's topple plays 1 to 3 booms (8 runs), the crane's four-leg
  collapse 7 to 13, boxes and girders (9 runs). (Not `MaterialSounds.land`: it has no least size, so
  every two-panel section thrown by a blast would boom at half volume or more.)
- Footsteps by what's underfoot (`footsteps.surface`): `steps.metal` on boxes, the crane, the
  ship's plating, the tanks, the stiles, the office floor and the drums, whole or fallen;
  `steps.rubble` on any other rubble (concrete, timber, cardboard, glass), on the apron's crushed
  stone in a crater and on its bed;
  `steps.asphalt` (dry) on concrete pieces and under the shed's and the office's roofs (a pallet in
  the shed too); `steps.wet` on the deck elsewhere, the apron's slabs included.
- The machine gun's strikes (`MaterialSounds.bullet`, each material's): `bullet.metal` on every
  steel thing, higher the thinner (cladding and roller doors 1.2, a box's wall 1.1, the tanks' roofs
  1.05, a drum 1, structural steel 0.9, a tank's shell 0.85, wire rope 0.8, cast iron 0.75);
  `bullet.concrete` on concrete and the slabs, `bullet.dirt` on the crushed stone, `bullet.wood` on
  pallets and reels, `bullet.glass` on panes (the floodlights' and the beacon's at 1.25), and
  `bullet.dirt` at 1.2 on cartons (a soft thud; a carton gives way at the first round, so it never
  takes a mark). Off metal and stone, now and then a ricochet.
- `water.lap` from three points along the quay wall (started in `onStart`); `gulls.call` every 8
  to 20 s from a gull in the air (else somewhere overhead; quiet for 30 s after a blast or a
  round), `gulls.scatter` at the first blast or round after 25 s of quiet; `ship.horn` every 90 to
  160 s from the ship, and twice when the blasts and bursts add up, `siren.far` past more.
- `water.splash` for what goes over the edge (grouped within 3 m, volume and pitch by mass; chips
  under 0.03 only throw spray), `chain.rattle` at the hoist (blasts near it, rounds into the hanging
  box; `cable`'s own material sounds rattle on impacts), `fuel.ignite` as a tank catches, then
  `fire.loop` with the base `rocket.loop` at pitch 0.55 as its hiss (both stopped after 40 s).
- The leaks (phase F): `fuel.leak`, a loop of oil glugging out of a tank's hole and splattering
  (near 3 m), and `drum.leak`, a thinner trickle (near 2 m), one for each tank or drum leaking,
  three at most at once.

## Reactions

- A tank is breached by a blast: `onBlast` marks the tanks whose shell is within the radius + 0.5
  (and where the blast was), and a course segment of one that comes loose in the next 0.5 s sets it
  burning; debris from a neighbour dents but doesn't ignite. The gun's rounds set it burning too
  (`onShot`, below), as does a blast on the fuel a holed tank has spilt into the bund. The hole is
  where the torn segment nearest the blast (or the last round) was built, not where it has flown.
  It catches with a whoomph (`fuel.ignite`) and burns for 40 s (`fire.ts`): a
  flame at the hole (an orange cone, 1.2 m by 4, with a yellow one inside, torn into tongues by
  rising noise, swaying, its root faded in, three times over white so bloom takes it), drawn after
  the dust (`renderOrder` 1002), so it shows through the blast's cloud from the start, and adding
  nothing to the reflections' normal and shine buffers (`mrtNode`: its cone's own showed as a pale
  outline round the flame); a flickering
  orange point light at the newest fire; embers; and black smoke (`effects.puff`, `0x1c1a18`, 8 m
  across over 9 s) every 0.3 s from 3 m above and behind the flame, and from the open top once the
  roof has gone. 1.5 to 3 s after it catches, the roof lifts: a blast (speed 3) under the roof's
  apex, short of the shell's inner faces, lifts the plates and drops them back into and around
  the tank in a cloud of black smoke; the courses stay.
- Steel, containers and iron striking at over 6 m/s throw a few sparks (at most 6 a second).
- The open box's doors swing on their stiff hinges after a blast near them, and stop (above).
- What sinks is taken out of the world 3 m under the water (`destruction.killBelow`). Nothing else
  is cleaned up. The world's `runaways`, which took out what the solver used to fling, is gone: it
  removed nothing in the 7 collapses run with it. In 24 collapses (the crane 11, the 4-high stack
  13) nothing jumped further than `maxSpeed` allows, went over 60 m up or past 120 m from the
  yard's middle (the farthest 97 m), or sank into the deck; a piece sped up by 8 m/s or more
  between two poses (the solver team's count of flings) in 4 of them, once each.
- The crane's beacon blinks; the lighthouse flashes every 5 s; the buoys bob.
- **The gun** (`onShot`, each round that strikes something; `onBurst`, each burst once it ends):
  - **A tank** (a round into a shell segment from outside): each hole leaks (`fire.ts`, `Leaks`): a
    dark, glossy stream wanders down the shell from the hole to the bund's floor, its front running
    down at 2.5 m/s, its gloss running down it, and spreads a pool there (black, a faint oil film's
    colours at its thinning edge, a blob fixed in the world, so it creeps into the low spots as it
    grows: 1 m out from the hole in 14 s, 1.6 m at most), kept inside the bund's wall. A round within
    0.6 m of a running hole feeds it rather than opening another; four holes a tank at most. Each
    runs 75 s, then thins out over 2 s; one whose plate has gone from under the hole stops. A
    `fuel.leak` gurgle loop at the first hole, louder with each hole. The rounds into its shell add
    up (one each, six for a round that tears the shell, each fading over about 20 s): at 40 the
    fuel catches, as a blast's breach sets it alight (about 3 s of a burst held on it). Once it
    burns, new rounds open no more leaks. A blast on the fuel it has spilt (within its radius of a
    pool) sets it alight too, and throws the pools it reaches.
  - **A drum** (a round into its side or lower; one on top doesn't leak): a thinner stream down its
    side and a pool at its foot (0.35 m out in 5 s, 0.55 m at most), two holes a drum at most, 25 s
    each, and a `drum.leak` trickle. A drum the gun pushes or a blast throws takes its leaks with it
    (a new pool where its foot runs off the last); turned with the hole on top, it stops.
  - At most three leaks are heard at once (the oldest goes quiet for a new one), and the leaks share
    12 streams and 16 pools made up front: past them the oldest go to the newest holes. A burst of
    70 rounds swept along the eight drums by the bund and on onto the tanks (`spree.mjs`, two runs):
    9 and 11 streams, 11 and 14 pools, 6 and 7 leak loops started, 3 heard at once at most, one
    `gulls.scatter`.
  - **The gulls** (`gulls.ts`): ten perch on the quay's bollards, the crane's girders, the stacks'
    roofs and the light masts' heads, three always wheel over the water. A blast or a round (or a
    burst into the sky) puts the perched ones up, each a moment after the last, away from it, beating
    their wings, to wheel high over the harbour; `gulls.scatter` cries once after 25 s of quiet,
    `gulls.call` stays quiet for 30 s, and the calls come from a gull in the air. They head back
    25 to 50 s after the last noise and settle on their perches (one whose perch has gone wheels
    on): after a 14-round burst, 6 of the 10 were back at 60 s, all at 65. Two instanced meshes,
    their pipelines made at load.
  - **The yard** hears a burst as it does a blast, the less for its rounds (`noise`: 0.05 a round,
    a rocket 2.3): a 70-round burst counts as a rocket and a half, so the ship's horn answers about
    200 rounds in half a minute (no sooner than 40 s after it last sounded, as for blasts), the far
    siren about 400 (a 420-round burst, 30 s held: the siren once it ended). A burst opens the
    stacks' tipping window, as a blast does (a corner post the gun undermined).
  - A round into one of the open box's door leaves swings it on its stiff hinges (pushed 0.5 m/s
    along the round, while it swings slower than 2 m/s that way); one into the hanging box or its
    ropes rattles the ropes (`chain.rattle`, at most every 2 s); a floodlight or the beacon shot out
    throws sparks.
  - The rest of what the gun breaks still sends the library's events: a collapse it brings down
    opens the stacks' tipping window (`'collapse'`), and splashes go on as for a blast.

## Assets

- Textures (GPT Image 2.5, `scripts/assets/packs/harbor/textures.mjs` and `textures.py`): seven
  sets, `harbor_container` (with its rust mask), `harbor_cladding`, `harbor_steel_painted`,
  `harbor_yard_concrete`, `harbor_pallet_wood`, `harbor_roller_door`, `harbor_gravel` (the apron's
  crushed stone); `harbor_slab_broken`, the base pack's `gen_concrete_broken` raw with the
  reinforcement's bar ends painted in (`slab_broken`); the base pack's `concrete_wall_008` and
  `gen_concrete_broken`. Report: `assets-src/packs/harbor/textures-report.md`.
- Props (GPT Image 2.5 concepts, Tripo P2, `scripts/assets/packs/harbor/props.mjs`): forklift,
  yard_tractor, drum, reel. `process-props.py` makes the drum's paint tintable (`paint`), the drum
  and the reel 16-sided (`round`) and the vehicles two parts each (`parts`), then runs the pack's
  `finish-props.py`: the reel's needles cut off and its cable and plywood recoloured, a hole in the
  drum filled, both their colliders fitted again. 4.6 MB (the four recoloured drum copies, 2 MB,
  are gone). Report: `assets-src/packs/harbor/props-report.md`.
- Sounds (Stable Audio 3, `scripts/assets/packs/harbor/sounds.mjs`): 18 (phase F's three: the
  leaks and the fuel catching, `fuel.ignite` from the third of its takes). `sheet.tear` is cut at
  the rise into its rip (`onset`: its takes built up for 0.6 to 1 s); `steps.metal` keeps the 7
  slices that are steps (the 3 crunches that followed a step's clank are left out:
  `assets-src/packs/harbor/sounds/skip.json`). Report: `assets-src/packs/harbor/sounds-report.md`.
- HDRI: Poly Haven `kloofendal_overcast_puresky_1k` (CC0). Credits: `public/packs/harbor/CREDITS.md`;
  paid calls: `assets-src/packs/harbor/ledger.jsonl` (phase E one image, `harbor_gravel`, $0.25;
  phase F six sound takes, $0.23).

## Tuning

- Measured on the RTX 4090 here at 1280 × 720, the GPU shared with other agents' Chromes, one
  Chrome at a time, Harbor Yard and Brick Street in turn, in two sessions: a busy one (the
  machine's load 30 to 37) and a quieter one (10 to 24), quiet first below. Both stand: 0 loose
  for the 10 s after load, in every run (over 50 here).
- Load: every pipeline is made before the card (the demo's "Shaders…"), none after it. In the
  first 10 s after it, single frames of 70 to 150 ms come and go in both worlds, 0 or 1 over 100
  ms a run (the worst 36 to 147 ms in 7 runs; Brick Street 78 to 152 in 5), each of them the GPU
  (2 to 8 ms of CPU); once in 20 loads a frame of 634 ms. The card comes 1 to 2.5 s later than
  Brick Street's (8.6 to 10.7 s after the page opens, against 6.3 to 9.0).
- Idle, 4 to 10 s after the card: median 17 to 27 ms, 95th percentile 31 to 37 ms (Brick Street
  17 to 22 and 31 to 38); busy, 19.8 to 22.0 and 35 to 42 (24.3 to 26.5 and 36 to 37).
- The crane's four legs blown 1 s apart, to 10 s after the last (3 runs a session, Brick Street's
  four blasts along its x 10 to 22 front between them): the first blast's worst frame 59 to 102
  ms (Brick Street 52 to 149), busy 59 to 106 (44 to 131); the collapse's worst 82 to 181 ms (110
  to 158), busy 112 to 142 (139 to 181); 39 to 47 frames over 40 ms of 470 to 517 (52 to 99 of 415
  to 493), busy 62 to 122 of 356 to 450 (114 to 158 of 325 to 401); median 21 to 23 ms (24 to
  28), busy 27 to 36 (30 to 40). One blast at the 4-high stack: first 54 to 67 ms, busy 65 to
  112; worst 67 to 145 ms, busy 104 to 219; 10 to 43 frames over 40 ms, busy 34 to 82. Most of
  those long frames is the GPU (the solver with 150 to 500 loose pieces and the falling sections'
  joints).
- Coming to rest (loose, `stats.loose`, after the last blast): the crane +10 s 215 to 383, +20 s 0
  to 238, +40 s 0 to 2 (11 to 14 runs; twice the 2 were the door leaves, before their stiff hinges,
  once two lengths of steel). What's loose at +20 s is mostly the crane's north end, left leaning on
  Block A's stacks: it comes down in the next 20 s (the girders' top from 12.7 to 14.0 m to 9.1 to
  10.2). The 4-high stack +10 s 30 to 218, +20 s 0 to 97, +40 s 0 to 3 (12 to 14 runs); the shed's
  two columns 0 to 7 at +20 s, 0 or 1 at +40 s; the quay pair 0 at +10 s; a tank fire 0 at +20 s;
  the doors 0 to 2 at +10 s, 0 at +40 s (`stats.hanging` 2).
- The lighthouse blinks between 6 and 0.02, never 0: three counts a material's numbers in its
  pipeline key as zero or not, and switching keys cost a 78 to 91 ms frame twice every 5 s. The
  fire's light is never at 0 (0.01 when out); its flames are drawn from the start out of sight.
  The demo's `effects.warm()` stands in for the world's old warm-up of blasts, dust and sparks.
- Splashes are looked for ten times a second only while something moves (`loosePieces`).
- If it needs to be faster: drop Block B line 2 (`containers.ts`, about 420 pieces), or turn off
  `look.reflections`.
- **The apron and the gun** (phase E; display :104, the GPU shared with four or five other Chromes,
  some runs near its memory's end; the runs that ran out are left out). Harbor Yard before the apron
  served from a build of the code before it, in turns with the build now and Brick Street:
  - At load 6,835 pieces (6,019 before), 261,624 vertices (232,248); nothing loose for 10 s after
    load in any run (17 here); no pipeline made after the card through firing at 16 materials and
    a rocket into the apron.
  - Idle (5 s at the start of each collapse run): mean 26.4, 19.5, 24.8 ms before, 22.7, 19.2,
    24.8 now; Brick Street 22.4, 25.0, 23.1 between them.
  - The crane's four blasts, the first to +10 s (3 runs each): frames over 40 ms 116, 52, 85 of
    381, 470, 428 before; 138, 52, 120 of 361, 497, 367 now (Brick Street 143, 126, 108 of 322,
    380, 377); the worst 87, 91, 164 ms before, 186, 156, 203 now (Brick Street 166, 153, 100). The
    worst frames are the GPU's (their CPU 1 to 13 ms, before and now). The destruction's CPU over
    the 12 s of the collapse goes from 313 to 400 ms to 450 to 458 ms (2 runs each), most of it
    its weighing (74 to 101 to 135 to 159 ms: the slabs are 816 more pieces in the structure, and
    everything bonds to them), its worst call 21 to 26 ms either way.
  - Coming to rest: the crane +10 s 363, 94, 289 loose now (256, 96, 238 before), +20 s 219, 23,
    37 (53, 11, 266), +40 s 0 (0); the 4-high stack +10 s 297, 277, 198 (192), +20 s 77, 84, 28
    (81), +40 s 0 (0), its blast taking 32 to 36 apron pieces with it; the shed's two columns +10 s
    134 (133), +20 s 4 (6), +40 s 0 (0); the quay pair in the water, 0 loose at +10 s. Nothing past
    120 m, nothing under the bed. The farthest piece a light chip of container sheet 88 m from the
    yard's middle in one stack run (56 and 34 m in the others; before, 34 to 70 m).
  - A rocket's crater (a blast at the demo's 2.3 m just over the slabs, six spots in the open):
    1.4 to 2.1 m across (1.6 to 3.4 m² open), 0.7 m deep (to the bed); the apron's pieces +18 to
    +83 a crater, +70 and +117 for two rockets fired from the launcher. Brick Street's asphalt is
    1.6 to 2.9 m and +61 to +85. The chunks land round the rim; the stone sprays as grit.
  - The player through a crater (walking at it from 5 m): down 0.23 m and up over a chunk, out
    without a stop; through three overlapping ones, down 0.59 m and out over the chunks, no jump
    (the feet up at most 0.3 m in a frame).
  - The gun, 42 rounds (3 s) from 4-7 m, two runs where both are given: the middle of a slab
    cracks at round 14 (both), and 17 to 23 of the 42 break something (+84 to +98 pieces); at a
    joint between slabs round 15 to 17 (15 to 24, +63 to +121): a hole into the stone, chunks round
    it, bullet holes on them. Into a crater's stone, 39 of 42 from the first (`bullet.dirt`). A
    Jersey barrier 13 to 17 (its first at 11); a box's wall 3 to 4 (dents), a tank's shell 1 (at
    38), the crane's legs none; the shed's cladding 3 to 6 (from 9); a roller door 7 (from 3), a
    hole punched through its slats; a cast-iron bollard 3 of 36 (from 24: knocked off its base);
    panes, pallets and cartons at the first round (42 of 42 into a loaded pallet, +79 pieces, bits
    at up to 15 m/s landing within 3 m); props never broke then (a forklift doesn't move, a cable
    reel creeps at 0.1 m/s; they have their shards since: How it's built). The fastest piece a
    burst let go 18 m/s; the farthest came to 29 m from where it was struck (in the burst at the
    roller door; in the others within 11 m). Frames while firing: mean 17 to 31 ms, as standing on
    this GPU (17 to 26).
  - The slab's `minBodySize` 0.3 (after the independent check; a build without it and one with it,
    in turns): 10 s held at a fresh slab (141 rounds), 121 broke something without it, leaving a
    hole of 0.2 m² in a heap of wedges (+99 slab cells standing round it); with it 114, the slab cut
    through to the stone over 1.8 m² (the rounds then struck the stone, `bullet.dirt`), +155 pieces,
    most of them the stone's cells under the slab. At a joint +144 and +202; a 20 s sweep across
    the apron (285 rounds) +627 and +553, its holes potholes into the stone rather than wedges
    lying on the slabs. Rocket craters (seven spots each): 1.5 to 2.8 m² open without it, 1.8 to
    4.1 with it, 13 of the 14 to the bed (one with it only through the slab, 0.3 m), +15 to +148
    pieces either way, the chunks round the rim. Frames while firing the same (mean 17 to 19.5 ms).
- **The gun's answers, the craters, the budget** (phase F; display :104, port 5331's dev server,
  which served each edited file (checked with curl), the GPU and the machine shared with other
  agents' Chromes and jobs, the machine's load 5 to 70: frame times are Harbor Yard's next to
  Brick Street's loaded just before or after):
  - Craters, before and after (`craters.mjs`: a blast of 2.3 at the slabs in 14 open spots of the
    apron, 6 s to settle, then the player walked at each from four sides with W for 2.2 s): with
    `toss` 0.4 and 16 cells, 1 to 3 chunks lay in or over the hole in 12 of 14, 33 chunks stood
    over 0.45 m within 3 m of the middle (on edge round the rim), the farthest 2 to 4.2 m out, and
    the player stepped down into the crater in 35 of 56 walks (over the chunks at the deck's height
    in the rest); now none in the hole, 7 over 0.45 m (in 5 craters), the farthest 4.5 to 10 m out
    (two thirds past 3 m), and 53 of 56 walks went down in (the other three over a chunk lying
    across half of one hole). Open 2.8 to 4.8 m² (1.4 to 3.7 before), 2.5 to 3.5 m across, 10 of
    14 to the bed (13), +22 to +134 pieces a crater (+17 to +145). Tried on the way: `toss` 0.6 in
    16 cells (37 of 56 walks in, chunks over 0.45 m on the rim of 6 craters of 14), 0.75 in 16 (35
    of 40; chunks out to 22 m).
  - Craters from rockets (the independent check found the numbers above held for `demo.blast`
    only): a rocket fired as a player fires one (`demo.shoot` from 9 m off, standing) at the 14
    spots and 7 more in the open. With the slab's `minBodySize` 0.3, 68 of 84 walks went down in,
    and 2 of the 21 craters couldn't be entered from any side: a chunk over the hole, thin wedges on
    edge round the rim (25 chunks over 0.45 m within 3 m of the middle, in 15 craters). With 0.45,
    79 of 84 (52 of 56 at the 14 spots), every crater entered from two sides or more (17 of 21 from
    all four); a chunk's middle within 1.2 m of the crater's in 4 of 21, as before, but none that
    kept the player out; 10 over 0.45 m within 3 m (in 9). Open 2.1 to 6.9 m² (1.8 to 4.7), 16 of
    21 to the bed (17), the farthest chunk 3.2 to 6.9 m out (3.6 to 11.3), +17 to +100 pieces a
    crater (+40 to +127). `demo.blast` at 7 of the spots: 27 of 28. The gun's pothole is no worse:
    10 s held at a fresh slab in four spots, 14 to 22 of 127 to 140 rounds broke something (15 with
    0.3), +22 to +33 pieces (+30 to +34), holes 1.9 to 3.3 m² to the bed (1.8 to 2.05). The
    machine's load was 32 to 80 through these, which slowed the walks (5 to 9 m in the 2.6 s, 10 m
    at a light load) but not whether they went in. A rocket at (10, 20) from the south-east strikes
    the lane's barriers instead (left out).
  - Load (`stand.mjs`): 6,835 pieces, nothing loose in the 10 s after it, no errors or warnings, no
    pipeline made after the card; nor through the tank and drum check (`tank.mjs`: leaks, pools,
    the tank catching and its roof blowing, the gulls up). The gulls are two draws (and their
    shadows'); the leaks' 12 streams and 16 pools are culled out of sight until used.
  - Frames, idle 5 s at the start and the gun held 10 s (140 rounds, the view sweeping a little) at
    a box's side 5 m off and at the apron's slabs 6 m off, two runs each in turn with Brick Street
    held at its front (`frames.mjs`, the machine's load 20 to 50): idle mean 29.9 and 19.1 ms
    (Brick Street 21.4 and 32.3), the box 33.9 and 22.5, the apron 30.1 and 25.1 (Brick Street's
    front 30.1 and 24.4); the destruction's CPU while firing 0.5 to 1 ms a frame (Brick Street's
    2). The box: 10 of 140 rounds broke something, the first at about round 10, no pieces added
    (its panels come loose whole); the apron: the slab cracked at round 15 or 16, 24 to 35 rounds
    broke something, +44 and +54 pieces.
  - The crane's four blasts (`collapse.mjs`, the checks at +10, +20 and +40 s of the world's own
    time, five runs, two of Brick Street's x 10-22 front among them): loose at +10 s 306 to 403
    (Brick Street 700, 417), +20 s 59 to 289, three of five about 150 (216, 11), +40 s 0 in four
    and 31 in one (2, 0; the heap looked settled, not looked into further): it comes down as before,
    the girders onto Block A's stacks. Frames from the first blast to +10 s: mean 31.2 to 34.0 ms,
    worst 108 to 215, 99 to 121 over 40 ms (Brick Street 38.7 and 35.6, worst 125 and 81, 155 and
    138); a sixth run's (the machine at a load of 77: idle 59 ms) left out. Nothing sank, the
    farthest piece 93 to 97 m from the yard's middle, no pipeline made.
  - The slab's `impact` against the crane's fall (`girder.mjs`, seven falls, every strike of a
    heavy piece on a slab logged): the strongest 25.5, 26.7, 31.0, 31.2, 34.8, 42.5 and 49.8, all
    from lengths of the crane's steel (about 2 t); the 42.5 cracked the slab it struck (816 slabs
    to 824), the 49.8 didn't, no other slab broke.
  - The budget (`maxPieces` 8,300: the 6,835 at load and 1,500; `budget.mjs`): a session of the
    gun held 40 s sweeping the apron, four rockets into it and the crane's four blasts peaked at
    7,313 and 7,422 pieces in two runs, under the budget, so it took nothing. With it set to 7,000
    in the page, the same session peaked at 7,419 after the crane's fall and was back under it,
    6,983, 25 s later, with 604 pieces of rubble at rest against 1,020 in the run without a budget,
    while what stood stayed at 6,377 throughout.
- `destruction.maxSpeed` 25 (the library's default is 40): light container sheet thrown by a blast
  lands in the yard. At 40 the 4-high stack's topple threw pieces 76 to 112 m from the yard's
  middle (2 runs), at 25 34 to 70 m (9); the crane's fall 95 to 99 m against 91 to 97 (8). Nothing
  sank into the deck at either (at 25 a light piece holds about 150 times its weight before it's
  pressed into what it rests on, at 40 about 245).

## Checking it

Scripted from the page (`demo.blast`, `demo.shoot`, `demo.stats()`):

- The crane: `demo.blast` at its four leg feet, (-20.8 or -8.8, 2.5, -21 or -1), 1 s apart. The
  legs fold and the girders come down across Block A; 7 to 13 booms.
- The 4-high stack (Block B line 1, x 21.0 to 23.4, z -5.5 to 0.56): `demo.blast(21.1, 0.8, 0.75)`
  at its south foot. That point is in the 0.44 m gap between line 1 and line 2: a rocket can't
  reach it (fired from (32, 0, 9) it hits the reefer in line 2 at (26.3, 1.1, 4.5); fired along the
  gap from either end it flies on and goes off 16 m past it). A rocket has a clear line to its
  north foot: stand at (30, 0, -8) and `demo.shoot(22.2, 0.8, -5.52)`; it goes off at (22.0, 0.8,
  -5.6) and the top box comes down, toward the north, its middle to 2.1 to 2.6 m (three runs from
  there, one from (22.2, 0, -9)).
- The shed: `demo.blast(-22, 1, 7.6, 2.3, [0, 0, -1])` and `(-16, 1, 7.6, …)`, the north columns of
  frames -22 and -16: that bay's roof and most of the roof beside it come down.
- The quay pair: `demo.blast(-24.5, 1.2, -29.5)`: the upper box goes into the water (48 or 49 of
  its 50 pieces, 13 to 18 splashes).
- A tank: `demo.blast(15.2, 2.5, -20.5, 2.3, [-1, 0, 0])` on T1's west shell: it burns, and its roof
  blows 1.5 to 3 s later. With the gun: `demo.weapon('gun'); demo.look(11.5, 0, -16, 16.6, 2.6,
  -18); demo.fire(6)` (T1's south-west shell over the bund wall, clear of the pipe's block and the
  ladder): a stream runs down from the hole and a pool spreads at its foot on the open floor, with a
  gurgle. The wall hides the foot from outside it: look from the stile (x 13.5, z -14.8), which
  sees the stream and the pool whole (0.6 m out at +14 s). `demo.fire(40)` more and it catches
  (about 2 s into the burst).
- The drums: `demo.look(22.4, 0, -7.2, 21.16, 0.45, -8.43); demo.fire(2)` (the row by the bund):
  a trickle down the drum and a small pool.
- The gulls: any round or blast puts them up (watch the bollards at z -28.7, or the crane's
  girders); they come back to their perches 40 to 80 s after the last.
- The open box's doors: `demo.blast(-6, 1, 3.6, 2.3, [0, 0, 1])`: the leaves swing and stop in
  about 3 s (`stats.hanging` 2).
- The apron: `demo.blast(10, 0, 30, 2.3, [0, 1, 0])` (in the lane, south of the barriers) or a
  rocket at the slabs: an open crater down to the stone or the bed at -0.7, its chunks lying round
  it out to 10 m. Walk into it and out. `demo.weapon('gun'); demo.look(10, 0, 26, 10, 0, 20);
  demo.fire(42)`: the slab cracks at about round 15 and the rounds chew a hole into the stone
  (`bullet.concrete`, then `bullet.dirt`).

## Differs from the design

- Roller doors are 4.8 m wide (x -33.3..-28.5 and -21.3..-16.5), so the frames at x -28 and -22
  stand beside them, not in them. The personnel door and three windows are in the east gable.
- The cab hangs beside the hoist ropes (x -16.9..-15.4), not round them.
- No walkway handrails on the tank roofs, no hoist drums, no valve wheel; the pipe runs from T1 to
  the bund wall.
- The cladding uses `harbor_cladding` (its own set) instead of the container texture.
- One drum model tinted per copy, not one blue drum (and no recoloured copies).
- The distant scenery breaks (the design has it unbreakable): it stands as scenery until something
  reaches it (Round the yard). The crane rails are pieces, not strips.

## Known issues

- The crane's girder truss rests on top of Block A's stacks: rubble doesn't weigh on what it rests
  on, so the boxes under a girder of many tonnes don't crush.
- A toppled stack's top box can come to rest across the next stack's roof (8.7 m up, in 1 run of
  14) rather than on the pile; in 1 run of 14 it was still settling at +40 s (3 pieces loose, its
  middle 0.8 m lower than at +20 s).
- With all four of the shed's north columns blown (not the two in Checking it), the south eave's
  top row of roof sheets (6 m, with its purlins) comes to rest held at the east gable's rafter
  alone, 0.2 m over the eave beam (4 runs of 4): a section at rest stays where it froze, held at
  one end. From the yard it reads as the roof's edge on the wall.
- A player who flies out over the water and lands stands on its surface (`groundAt` is the
  surface, so rockets go off on it); walking back onto the quay works.
- The apron's cells round a crater stand flush, so a slab cracked by a blast or the gun shows no
  crack between its cells: it reads as whole until a cell of it goes.
- The pavement has no normal map now (deck and slabs alike; see Look): the joints and the grain
  are in its colour only. Up close and grazing, the damp edges of the puddles are smoother than
  they were.
- The gun at the ground under a stack's corner cracks the slab and drops the post into the hole,
  and the stack tips (as a rocket there does): heavy rounds into the paving next to a stack bring
  it down.
- What the gun and blasts break stays standing (the cells round a pothole or a crater): the budget
  (`maxPieces` 8,300) takes back rubble at rest, not what stands. Since the library's bite (phase
  F), 40 s of the gun swept over the apron adds about 140 pieces (+553 in a 20 s sweep before it).
- Wreckage landing on the apron hard enough cracks a slab where it lands: the crane's heaviest
  lengths strike at 25 to 35 in most falls, under the slab's `impact` 40, and over it in two of
  seven (42 and 50), one of which cracked a slab; a box's collapse never has. (In the other, a
  strike logged at 49.8 left the slab whole: not looked into.)
- A pool lies flat at the height of the floor where its stream reached it: a pothole the gun digs
  under one later leaves it over the hole (a blast throws the pools within 0.7 of its radius). It
  isn't drawn where the bund's wall stood, even once the gun has knocked the wall down.
- The bund's wall (1 m) hides a tank's foot, so its pool, from the yard outside it: it shows from
  the stile, from the tank's own side of the wall, or from up high. T3's north side is 0.7 m from
  the wall, and its pool there hardly shows from anywhere.
- A rocket's crater can still have a chunk lying across part of its hole (4 of 21 in the last
  measurement), but none has kept the player out of a crater from every side.
- A stream is a flat strip on the surface: on a drum's curve its band stands up to a centimetre
  off the steel at its sides. Every hole in a tank leaks, however high (there's no fuel level), each
  for its 75 s however many others the tank has.
- A drum's trickle is heard from where the drum was holed, even once the gun has pushed it along.
- The gulls fly through things (coming in to a perch, they can cut a stack's corner), and a gull
  close to the player is plainly a few shapes (an ellipsoid body, flat wings).

## Library requests

1. A least size (pieces or mass) for `MaterialSounds.land`, so a whole box booms and a two-panel
   section thrown by a blast doesn't (the world listens to `landed` itself until then).
2. Rubble weighing on what it rests on: a fallen crane girder should crush the boxes under it.
3. The weighing could know a box on three posts racks, and that a post alone doesn't carry a stack
   (what `tipStacks` does by hand).
4. Friction for a hinge (`d.hinge(..., { friction })`): a door leaf on a vertical hinge never stops
   by itself (what `drag` does by hand).
5. A way to scale a breakable material's normal map per pixel (a node for its strength, or the
   material's own `normalNode` let through): `FragmentMesh` draws the map at a fixed strength, so
   the slabs couldn't have flat puddles in a bumped pavement, and neither has a normal map now.
6. A node for broken faces' colour (as `colorNode` is for the outside): the bars' ends are painted
   into `harbor_slab_broken` at fixed depths, which works only because the slab's map runs from its
   top; a node could put them where a break crosses a bar.
7. The bed under a breakable ground could be the ground's own (laid by `addGround`, with the faces
   a crater at its edge shows), rather than each world splitting its ground body and drawing them.
8. A mark that's wet (the demo's `effects.decal` with a roughness of its own, and a size that can
   grow): the leaks' pools are flat meshes of the world's own, so they lie at the height their
   stream first reached and float over a pothole dug under them later, where a decal would lie on
   whatever is there.
9. Why a heavy strike over a slab's `impact` sometimes leaves it whole: in one crane fall of seven a
   strike of 49.8 on a slab (`impact` 40) broke nothing, where one of 42.5 in another cracked one,
   as do drops of 45.7 and 55.8 (`drop.mjs`).
