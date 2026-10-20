# Market Town: design

A medieval market town at golden hour. A cobbled square in a U: half-timbered houses on the west,
the town wall with its gatehouse and a round tower on the north, the church tower and a market
hall on the east. The south lies open toward the low sun. Stalls, a well, a market cross, carts,
barrels and hay stand in the square. The fields, a wooded hill and a windmill are hazy beyond.

This is the plan the builder and the asset makers follow. The numbers are starting points. Change
them when the screenshots say so, and write down what changed in the README.

## 0. Conventions

- Metres. x is east, y is up, z is **south** (+z). So north is -z, as in the sky's azimuth (radians
  from +x toward -z).
- The ground top is y = 0 everywhere inside the town (`ground: 0`). `groundAt` is 0 within 55 m of
  the origin and follows the scenery terrain beyond (§3).
- "Course" means a horizontal layer of masonry. "Running bond" means each course's joints sit halfway
  along the blocks of the course below.
- No piece is longer than about 2 m on a side. Split anything longer at a joint that a real building
  would have.
- Code layout (a suggestion): `meta.ts`, `index.ts`, `materials.ts`, `masonry.ts` (coursed walls with
  openings, arches, the round tower), `timber.ts` (frame walls, floors, jetties, roofs), `town.ts`
  (puts every building in place), `market.ts` (stalls, well, cross, crates, hay, props),
  `scenery.ts`, plus a `README.md`.

## 1. The place

### Plan (from above, north up)

```
 z
-24 ·                  fields / road north (scenery)
-20 ·   (ROUND           ┌──GATE──┐
-18 ·    TOWER)══════════│ arch   │══════════════════════════ wall ══ (wall continues as scenery)
-16 ·    c(-28,-17)  stair▁▁▁▁   │        │   ▫hay wagon      ┌──────────┐
-14 ·                     └────────┘                     │  E1      │
-12 ·  ┌──────────┐ cart                                 │ house    │
-10 ·  │  W1      │                                      │ (facade  │
 -8 ·  │ 3 storey │         ◯ well (-5,-6)               │  x=15)   │
 -6 ·  │ gable    │                       ✝ cross (6.5,-5)└──────────┘
 -4 ·  ├──────────┤                                      ┌──────┐┌────────────────────┐
 -2 ·  │  W2      │ barrels                              │CHURCH││   NAVE  x 21..37   │
  0 ·  │ tavern   │  ▭ ▭ ▭ stalls   lane    ▭ ▭ ▭ stalls │TOWER ││   z -6.5..2.5      │
  2 ·  ├──────────┤  (west row)    x≈-3..5  (east row)   └──────┘└────────────────────┘
  4 ·  │  W3      │                                      ┌────────────┐
  6 ·  │ gable    │                                      │ MARKET HALL│ open ground floor
  8 ·  │ (sunlit  │                                      │ x 14.5..24.5│ on oak posts
 10 ·  └─south────┘        ★ start (3, 0, 11)            └────────────┘
 12 ·        open south-west: road in, the low sun
 14 ·                                         ┌──stable──┐▫coop
 16 ·        ══ low wall ══ (gap = road)      └──────────┘
 20 ·   fields, the windmill hill far to the SW (scenery)
      x: -32      -24      -15        0         15        24        37
```

### Breakable structures

| Structure | x | z | Height | Notes |
|---|---|---|---|---|
| Open square (cobbles) | -15 … 15 | -13 … 14 | — | where the player stands and the stalls are |
| Town wall | -23.95 … -4.5 and 4.5 … 26 | -18 … -16 | wall walk 7.5, parapet 8.7, merlons 9.6 | two skins, 1.0 m each; joined to the gatehouse; 0.05 m clear of the round tower |
| Wall stair | -16.5 … -6 | -16 … -15 | 0 → 7.5 | 30 stone steps cantilevered from the inner face, up to the wall walk |
| Gatehouse | -4.5 … 4.5 | -20 … -14 | 11.0, merlons to 12.0 | passage 3.6 m wide, springing 3.6, crown 5.4; portcullis half raised; gate leaves open |
| Round tower | centre (-28, -17) | r 4.0 outside, 2.8 inside | 12.0, cone to 18.5 | conical tiled roof |
| W1 | -23.5 … -15 | -12.6 … -5.2 | eaves 8.4, ridge 13.7 | gable facing the square, rubble ground floor, two jetties |
| W2 (tavern) | -23.5 … -15 | -5.1 … 2.3 | eaves 5.7, ridge 11.1 | eaves facing the square, two storeys, jettied, hanging sign |
| W3 | -23.0 … -15 | 2.4 … 9.4 | eaves 5.7, ridge 12.3 | gable facing the square; its south side faces the sun and is detailed like a front |
| E1 | 15 … 22.5 | -15.2 … -7.5 | eaves 5.7, ridge 11.0 | eaves facing the square (facade on x = 15, facing west), rubble ground floor |
| Church tower | 15 … 21 | -5 … 1 | parapet 19.5, merlons 20.4, pinnacles 21.6 | west door, belfry with the bell |
| Nave | 21 … 37 | -6.5 … 2.5 | eaves 7.5, ridge 13.3 | three round-arched windows a side, buttresses, east gable |
| Market hall | 14.5 … 24.5 | 5 … 12 | eaves 6.2, ridge 12 | open ground floor on 12 oak posts, one framed storey above, gable facing the square |
| Stable | 4 … 12 | 15 … 19 | 2.6 at the front, 4.0 at the back | timber on a plinth, lean-to tile roof sloping toward the square |
| Low wall | -14 … 2 | 19 … 19.5 | 1.2 | rubble, a 3 m gap for the road at x -6 … -3 |
| Well | centre (-5, -6) | r 0.95 | posts to 2.3, roof to 2.9 | |
| Market cross | centre (6.5, -5) | 3 m square steps | 4.2 | |
| Stalls | west row: x -7.5 … -4.5 at z -1, 2.6, 6.2. East row: x 6 … 9 at z 1, 4.6, 8.2 | 3.0 × 1.6 each | awning 2.0 – 2.4 | counters face the lane |

Everything breakable fits in x -32 … 37 and z -21 … 20 (69 × 41 m).

### The start and the sight lines

- **Start:** feet `[3, 0, 11]`, looking at `[-1, 5, -16]`. The gatehouse is just left of centre. The
  lane between the stall rows (x about -3 … 5) stays clear, so the arch reads whole. Through the arch
  you see the road running on between fields. Check that nothing (the well, the cross, a cart)
  stands on the line from (3, 11) to (0, -16).
- On the left, the west row is in shade, with the sun's glow over its roofs. On the right, the church
  tower and E1 catch raking light on their west faces. Ahead, the wall and the gate are lit nearly
  head-on, and the crenellations throw short shadows down the wall.
- Looking back toward the south-west, the square opens onto the road, the low wall, the fields and
  the windmill hill, all dark against the bright hazy sky near the sun.
- From the square, the alley north of W1 (z -16 … -12.6) leads the eye to the round tower. Its cone
  shows over W1's roof.
- From the wall walk (up the stair) you look out over the fields and the wooded hill. Most of the
  countryside is behind the wall from the square, so climbing up is a reveal.

### Unbreakable scenery

- **Ground:** cobbles over the whole town (Poly Haven `cobblestone_floor_001`, 2.4 m tile). A dirt
  road goes out of the gate to the north and out of the south-west gap. In physics: one fixed box
  with its top at y = 0 and about 300 m across.
- **Terrain beyond the walls:** one mesh about 700 × 700 m. Its height is 0 for r < 55, then
  smoothstep(55, 130, r) × (gentle rolls of 3 – 8 m from a few sines), plus:
  - the **wooded hill** at (120, -190): 70 m high, radius 90, covered with instanced trees. From the
    square it shows over the wall and the roofs between E1 and the church tower (about 17° up).
  - the **windmill hill** at (-130, 160), toward the sun: 22 m high, radius 70. A post mill stands on
    top (a timber body and four sails, simple meshes). Its sails turn slowly in `update`.
  - a low ridge closing the north at z ≈ -300, 25 – 40 m high.
  Colour the fields in a patchwork: long strips in a rotated grid, picked by hash. Ripe wheat
  0xc8a050, stubble 0xb89a60, pasture 0x6f8a42 and ploughed earth 0x7a5a3c, with darker hedgerow
  lines along the strip edges. `groundAt` returns this same height function.
- **Trees:** about 250 instanced low-poly trees: a trunk, plus two or three squashed icosahedra.
  Dark green 0x3f5a2a, olive 0x5b6b33, and a few 0x8a7a3a. Most go on the wooded hill, the rest
  along hedgerows. A yew stands in the churchyard (28, 0, 7) and a lime tree outside the gate.
- **The rest of the town:** the wall carries on as scenery from x = 26 round behind the church
  (z up to +40) and from the round tower south behind the west row, with two more round towers. All
  of it uses the rubble textures. About 30 – 40 simple house shapes (a box and a gable prism, in
  plaster, timber and tile shades) fill the town beyond the breakable buildings. They stand mostly
  east and north-east, behind the church, and west behind the west row. **Keep the south-west
  sector (x < 0, z > 12) free of tall scenery.** The sun comes in that way. Scenery that would throw
  shadow into the square gets `castShadow = false`.

## 2. How it's built

Neighbours share faces exactly. Compute every position from the same numbers, and never let pieces
overlap. Tilted pieces that meet only at an edge get `d.bond(a, b, area)`. Don't use `static`
anywhere: everything should be possible to bring down. `reinforce()` (margin 1.5) makes the town
stand as built. So a structure gives way when its remaining bonds carry about 1.5 times their
as-built load. That happens after roughly a third of a course is gone under a tower, or after the
posts under one bay are cut.

### 2.1 Coursed masonry, and walls with openings (masonry.ts)

One function builds a straight wall: start, end, thickness, course height, material, block length,
and its openings. Each opening is a rectangle up to its springing line, with an optional round arch
on top. It makes:

1. **Courses** from the bottom up, in running bond. Even courses start with a whole block, odd ones
   with half a block. Use block lengths of 1.2 – 1.8 m. A leftover shorter than 0.4 m merges into
   its neighbour.
2. **Openings cut the courses:** in a course that crosses an opening's rectangle, that x interval is
   left out. Springing lines sit on course lines.
3. **Arches:** `arch(span, ring, depth, count)` with an odd count (7 for small openings, 11 for the
   gate), placed at the middle of the springing line. Slice it along the wall's depth in pieces of 2 m
   or less (the gate passage is 6 m deep, so 3 slices). The springing voussoirs' bottom faces are
   horizontal and sit on the jambs.
4. **Fillers (spandrels):** above each voussoir, a prism from its outer chord straight up to the
   first course line above the arch's crown. The outline is the chord's two points plus their two
   points on that line: two vertical sides, so it's always convex. Neighbouring fillers share their
   vertical sides. The outermost fillers' outer sides are at x = ±(span/2 + ring), where the jamb
   courses beside them end. Above the arch zone, whole courses carry on.
5. **Corners interlock:** where two walls meet, the walls take turns running through the corner by
   course. On even courses the N/S walls run the full width and the E/W walls fit between them. On
   odd courses it's the other way round. A tower doesn't come apart at its corners.
6. **Tint jitter per block:** ±6 % brightness and a little warmth shift, seeded. With jointless
   textures, this is what makes each block read as an ashlar block.

Ashlar (limestone): courses 0.75 m, blocks 1.2 – 1.6 m. Rubble: courses 0.6 m, blocks 1.2 – 1.8 m
(the texture carries the small stones).

**Town wall:** two skins, inner z -17 … -16 and outer -18 … -17. The skins share their middle face,
so they're bonded. Their courses are offset from each other by a quarter block. Ten rubble courses
reach 7.5 m (0.75 each). The walk is the top of the wall. The parapet is 1.2 m tall and 0.6 thick,
standing on the outer skin's outer edge (z -18 … -17.4), in pieces of about 1.8 m. Merlons are
1.0 wide and 0.9 tall, with 0.8 m crenels between. Limestone coping slabs (0.12 thick) go on top of
the parapet and the merlons.

How it fails: a rocket on the inner face takes out inner-skin blocks and the outer skin stands. A
second rocket breaches the wall. Masonry above a hole hangs only by its sideways bonds, which are
weak (rubble support 30). So the breach grows upward in a stepped V and the parapet over it falls.

**Wall stair:** 30 limestone steps, each 0.6 run × 0.25 rise × 1.0 out from the wall face
(z -16 … -15). Step *i* spans x from -6 - 0.35·i - 0.6 to -6 - 0.35·i, rising westward, and y from
0.25·i to 0.25·(i+1). Each step sits 0.25 m on the step below, so they share that face, and its back
face is against the wall. The player climbs it: each rise is under the 0.5 m ray, and the ground
probe reaches 1 m. It ends on the wall walk at x ≈ -16.5.

**Gatehouse:** 9 × 6 m, limestone at the arch, jambs and quoins, rubble elsewhere. If two materials
are too fiddly, all of it can be limestone. The piers are solid from y = 0 to 3.6: x ±1.8 … ±4.5,
the full 6 m deep, 1.35 × 0.72 × 2.0 blocks, five courses. The arch has span 3.6, ring 0.6 and 11
voussoirs in 3 depth slices. Fillers rise to y = 6.0, which closes the vault. Above that the
gatehouse is hollow: 1.2 m walls up to 11.0 in 0.72 m courses round a guard chamber, whose floor is
the fill. On top go a 0.6 m parapet and merlons.
- **Portcullis** (iron): 5 bars, 0.08 square and 2.4 long, plus 3 cross bars, all touching so they
  bond. It hangs in the arch's front face with its bottom at y = 3.0. Bond its top bar to the two
  front voussoirs above it with `d.bond`. It drops with a clang when the arch goes.
- **Gate leaves** (boards): two leaves, each 1.75 × 3.4 × 0.1 in two 1.7 m pieces, standing open
  against the passage walls just inside, bonded to the wall face.

**Round tower:** 16 rubble courses of 0.75 m, each with 12 `arcBlock(2.8, 4.0, a0, a0 + π/6, 0.75)`.
The outer arc is about 2.1 m. Turn each course by π/12 from the one below so the vertical joints
stagger. A door on the alley side (facing +x) leaves out the block nearest angle 0 in courses 0 – 2.
The staggered blocks above bridge it. On top:
- A ring of 12 oak wall-plate arc blocks, r 2.8 … 4.0, 0.25 tall.
- The **cone:** a shell 0.18 thick in 4 layers × 12 segments. Each segment is the hull of 8 points:
  inner and outer at the layer's bottom and top radii, at a0 and a1. Neighbours share their radial
  faces and the layers share their horizontal faces. The bottom radius is 4.4 (an overhang) at
  y = 12.25 and the apex is at 18.5. The top layer is a cone point (frustum top 0) in 12 wedges,
  plus an iron finial.
- **Floors** at y = 4.5 and 9.0: 12 board sectors whose outer chords meet the inner faces of the
  course they sit in (the same angles), bonded sideways.

It falls when its base loses about a third of a course: the cone and the upper courses come down
as a section and break on landing.

### 2.2 Timber frames (timber.ts)

All timbers are D = 0.22 deep. Their outer face is the wall plane, so they run from 0 to 0.22 into
the house. Each frame wall storey is made of:

- **Sole plate** (0.2 tall) on a rubble plinth (0.45 tall, 0.3 thick) or on the jetty joists. It's
  split at post centres into pieces of 2 m or less.
- **Posts** 0.22 wide at corners and 0.16 wide between, every 1.0 – 1.3 m on fronts and every
  1.6 – 2.4 m on hidden walls. They're split at the rails, so no piece is over 2 m.
- **Rails:** a sill rail at 0.85 m above the floor and a head rail at 2.0 m, between posts. On
  hidden walls there's one mid rail.
- **Top plate** (0.2 tall), split at post centres.
- **Infill panels** of lime plaster, 0.14 thick and set back 0.03 from the timbers' outer face
  (z 0.03 … 0.17). That makes them recessed and casts a shadow line. Their edges meet the timber
  faces, so they bond.
- **Braces**, the characteristic diagonals, in about one bay in three on fronts: a K or a pair of
  down-braces. A brace bay is three `prism` pieces made from the same corner points:
  - the brace, a parallelogram from (x0, y0) and (x0 + 0.18, y0) to (x1 - 0.18, y1) and (x1, y1);
  - the panel under it, a triangle (x0 + 0.18, y0), (x1, y0), (x1, y1);
  - the panel over it, a triangle (x0, y0), (x1 - 0.18, y1), (x0, y1).
  They share their sloped faces exactly. The brace is the full depth and the triangles are set back.
- **Windows** are bays between the rails left open. In each one goes either a leaded-glass pane
  (glass, 0.03 thick, centred at z 0.1, its edges meeting the timbers) or nothing, with dark rooms
  behind. Open shutters (boards, 0.04 thick) lie flat against the frame beside the opening, bonded
  to the posts' outer faces.
- **Doors:** plank doors (boards), 1.0 × 2.0, set back 0.05, in a bay with no sill rail.

Grain: the oak texture's grain runs along v. Build every timber with its long side along its local
y, and turn horizontal ones 90° about the wall's normal. Then the grain follows every beam.

**Jetties:** each upper storey on the front sits 0.45 m further out. Under it runs a row of jetty
joists (oak, 0.2 wide × 0.22 tall × 0.95 long), one under each upper post. They rest on the storey
below's top plate and stick out 0.45 past it. Their inner ends meet the floor deck's front edge. The
upper sole plate sits on their outer ends. That's how a jettied front stands: it cantilevers on
those joists, and it sags and peels into the square when the ground floor's front posts or head
plate go.

**Floors:** boards decks 0.08 thick, in panels of 2 m or less. Their ends rest on the front and back
top plates. Inside they hang from each other sideways, as Brick Street's slabs do. They stop 0.02
short of the side walls, so a side wall can peel away.

**Roofs**, on houses, the hall, the stable and the nave (all the same kit):
- **Wall plates:** prisms along the eaves. Each sits flat on the top plate, and its top is the
  roof's underside plane.
- **Rafters:** oak, 0.12 wide × 0.16 deep, every 1.0 – 1.2 m, in segments of 2 m or less along the
  slope. All of them are boxes turned by the pitch about the ridge line. So segments in a line share
  end faces, and every rafter's bottom face lies in the plate's sloped top. At the apex, bond each
  left and right pair by hand (`d.bond`, area 0.03).
- **Tile slabs:** 'tile', 1.3 (along the slope) × 1.3 (along the ridge) × 0.06, at the same rotation
  as the rafters and lying on them. Each row shares faces with its neighbours along the slope and
  along the ridge, and each slab bonds to the rafters under it. The eaves row overhangs 0.35. At the
  verges (gable ends) the slabs overhang 0.25.
- **Ridge:** one prism per 1.3 m. Its outline is the two top rows' end-face edges plus an apex
  0.12 above them, so it shares the end faces of the tile rows on both sides. Tint it darker.
- **Gables:** triangles with the timber kit (prism panels and posts cut by the slope). Their sloped
  top faces lie in the rafters' underside plane, so the end rafter bonds to them. A front gable can
  have its own 0.3 m jetty.
- **Pitch:** 52 – 56° on houses, 52° on the nave, 35° on the stable's lean-to.
- **Chimneys:** a rubble stack 0.9 × 0.7, from the ground inside the back half of the house to 1 m
  above the ridge. Leave out any deck, rafter or tile slab that would overlap it. On gable-front
  houses it can stand against the back gable outside instead.

How it fails: the oak frame is strong sideways (support 220). A rocket into a panel bays punches the
daub out and the frame stands, with holes through which you see the rooms. Cut two or three
ground-floor posts or the head plate, and the storey above has no path to the ground there. It sags
and folds down as a section, with its joints holding until it lands. The roof comes with it. Tiles
break when almost anything lands on them (impact 6), so falling stone from the tower punches through
the roofs below. Loose tile pieces slide down the slope (friction 0.55) and pour off the eaves.

### 2.3 The houses

| House | Storeys | Ground floor | Timber tint | Plaster wash | Details |
|---|---|---|---|---|---|
| W1 | 3 + gable attic | rubble, with a 2.2 m round-arched shop opening (limestone voussoirs) and a door | dark, tarred 0x4a3a2e | lime white 0xf3ead8 | two jetties toward the square plus a gable jetty; the chimney on its back gable; a hanging sign (key) |
| W2 | 2 | timber on a plinth, a wide shop window with a drop-down board counter | silver-grey 0x8a8070 | ochre 0xe8cf98 | the tavern: a tankard sign, two lanterns, a bench, barrels |
| W3 | 2 + gable attic | timber on a plinth | mid brown 0x6b5240 | pale pink 0xe9c9b8 | the south side is fully detailed and in the sun; a boot sign |
| E1 | 2 | rubble, with a door and two small windows | dark 0x4a3a2e | pale grey-green 0xd9dccb | a pentice (a small tiled canopy on brackets) over the ground floor; a loaf sign |
| Market hall | 1 on posts | open | mid brown | lime white | see below |
| Stable | 1 | timber on a plinth, an open front with half doors | silver-grey | lime white | hay inside and outside, the coop beside |

- **Hidden walls** (side walls against a neighbour, and backs) use the simple frame: posts every
  about 2 m, one mid rail and big panels. Fronts, W3's south side, W1's north side (on the alley) and
  the hall's sides get the full kit.
- **Neighbours** are separate structures, with 0.06 m gaps.
- **Plaster tints** are the house's wash ±3 % per panel. **Roof tints** per house: 0xffffff,
  0xe8c8b8 (weathered), 0xd8a890 (redder), 0xc8c0a0 (mossy). Jitter each slab ±4 %.
- **Market hall:** stone pads (limestone, 0.5 × 0.3 × 0.5) carry 12 oak posts (0.3 square, in two
  1.4 m segments) in three rows of four, at x 14.9, 19.5, 24.1 and z 5.3, 7.4, 9.6, 11.7. Beams
  0.3 × 0.3 run along z on each row, split at post centres. Knee braces from post to beam are tilted
  boxes bonded by hand at both ends. Floor decks sit on the beams. Above them is a framed storey,
  jettied 0.45 on the front and both sides, 2.9 tall, with a gable to the square. Under the hall go
  two trestle tables, barrels and crates. Shoot a post row and the floor above tilts and drops onto
  them.
- **Hanging signs:** an iron bracket (0.05 × 0.05 × 0.9) sticks out of a post at 3.2 m, bonded to its
  face. A board (0.6 × 0.45 × 0.04) hangs under its end, bonded by hand. The pictogram on the board
  (a key, a tankard, a boot, a loaf) is made of 2 – 4 small iron boxes on its face. No letters.
- **Lanterns** ('lantern', 0.2 × 0.3 × 0.2, emissive) on iron brackets: two at the tavern door, two
  in the gate passage, one at the church door and two on the hall. Seven in all, and no real lights.

### 2.4 The church

- **Tower:** 6 × 6 m, limestone walls 1.1 thick, 0.75 courses with interlocking corners (§2.1).
  - Stage 1 (0 – 8): the west door (span 1.6, springing 2.4, 7 voussoirs) and a small round-arched
    window above it at about 5 m.
  - A string course at 8.0: a band of blocks 0.25 tall that sticks out 0.12, its own course.
  - Stage 2 (8 – 14): one narrow window on the west face.
  - A string course at 14.0.
  - The belfry (14 – 19.5): on each face, two openings (span 0.7, sill 14.6, springing 16.0, 5
    voussoirs each) with a shared central pier 0.3 wide. Oak louvres (3 slats at 30°, bonded by hand
    to the jambs) fill the lower half of each.
  - A parapet (0.5 thick, 0.9 tall) and merlons to 20.4, with corner pinnacles: `frustum(0.35, 0.03,
    1.2, 4)` turned 45°, on 0.6 bases.
  - A timber floor at 8.0 and the belfry floor at 14.0. Each is beams resting on the walls' inner
    ledges (the course above steps back 0.1) and board decks.
- **Bell frame and bell** (the tower's heart), centred on the tower at (18, -2):
  - four oak posts, 0.2 square × 1.8, on the belfry floor at the corners of a 1.8 × 1.4 rectangle;
  - two head beams (0.2 × 0.2 × 1.8, along x) on the post pairs;
  - the headstock (0.3 × 0.3 × 1.4, along z) resting across both head beams at their middles, with
    its top at y = 16.3;
  - the **bell** ('bronze') hanging under the headstock. It's the convex hull of rings: r 0.56 at
    y 0, 0.53 at 0.1, 0.40 at 0.45, 0.30 at 0.8, and a flat top of r 0.26 at 0.88. Its top face
    touches the headstock's bottom at 16.0, so it's bonded hanging. It's seen through the belfry
    openings.
  - Keep a reference to the bell piece for the reactions (§7).
- **Nave:** walls 0.9 thick, 7.5 tall (10 limestone courses), three round-arched windows a side (span
  1.4, sill 2.5, springing 5.2, 9 voussoirs, leaded glass with amber and pale green quarries).
  Buttresses (1.0 out × 0.8 wide) between the bays step back once at 4.5 m. The east gable is coursed
  with sloped prism tops under the roof. The roof is the §2.2 kit at 52° with a ridge at 13.3. The
  nave's west end meets the tower's east face. Leave it a separate structure (a 0.05 gap): when the
  tower falls it should not drag the nave.
- **Inside:** six pews (boards), an altar block (limestone) and a floor of the cobble ground. Cheap,
  and seen through holes.
- **Churchyard** (x 25 … 36, z 3 … 12): eight headstones (limestone, 0.5 × 0.8 × 0.12, tilted a
  little) and the yew (scenery).

### 2.5 The market

- **Stall:** each one has
  - four oak posts, 0.1 square × 2.2 (the front pair) or 2.4 (the back pair);
  - two side beams on the post tops (tilted to follow the awning, bonded by hand);
  - a counter: boards, 3.0 × 0.9 × 0.06 at 0.9, on two trestles (boards, 0.08 × 0.84 × 0.8);
  - an awning: 3 'cloth' strips, 1.0 wide × 1.9 long × 0.03, tilted from the back posts' tops down to
    the front's, alternating two tints (stripes), bonded to the beams by hand;
  - two or three crates under or beside it, and a basket prop or two on the counter.
  That's about 16 pieces a stall.
- **Cloth colours:** madder red 0xa8402e, woad blue 0x3f5d8a, weld yellow 0xd2a845, undyed 0xe2d8c0
  and green 0x5d7a45. Each stall has one colour plus undyed.
- **Well** at (-5, -6):
  - two rubble courses (0.45) of 8 `arcBlock(0.65, 0.95, …)`, staggered;
  - a limestone coping ring (8 arc blocks, r 0.6 … 1.05, 0.12 tall);
  - two oak posts (0.15 square × 1.8) on the coping at ±0.8 in x, and a crossbeam on their tops;
  - a windlass, `cylinder(0.12, 1.3, 10)` on its side, bonded under the beam;
  - a bucket (boards, `frustum(0.18, 0.15, 0.3, 8)`) hanging from it by a bond;
  - a little gable roof of 2 tile slabs on 2 short rafters, bonded to the beam.
  A dark disc at y = 0.02 inside the ring (scenery) gives it depth.
- **Market cross** at (6.5, -5): three limestone steps (3.0, 2.2 and 1.4 square, 0.3 tall; the lower
  two in four quarters each), a socket stone (0.7 cube), an octagonal shaft (`cylinder(0.18, 1.6, 8)`
  in 2 segments), and a head (a small cross of three boxes).
- **Crates** (boards, 0.6 and 0.45 cubes, about 20). **Hay bales** ('hay', 1.0 × 0.5 × 0.45, about
  14): stacked 2 – 3 high by the stable, and a few by the hay wagon. **Chicken coop** (boards, a
  1.4 × 1.0 × 1.0 box with a one-slab lean-to roof) at (13.3, 0, 16).
- **Low wall:** rubble, 1.2 × 0.5, in 1.6 m blocks, two courses.

### 2.6 Piece budget (as built, before anything breaks)

| | Pieces |
|---|---|
| W1 620, W2 450, W3 480, E1 450, market hall 420, stable 150 | 2,570 |
| Church tower 450, nave walls 390, nave roof 280, inside and headstones 20 | 1,140 |
| Town wall (two skins, parapet, merlons, coping) 570, stair 30 | 600 |
| Gatehouse (with portcullis and leaves) | 270 |
| Round tower (with cone and floors) | 280 |
| Well, cross, stalls, crates, hay, coop, low wall | 200 |
| Signs, lanterns, pentice | 60 |
| **Total** | **≈ 5,100** |

That leaves room up to about 7,000 for detail the screenshots ask for: more frame members on
fronts, window boxes, a fourth stall each side, a woodpile. Don't go past 8,000. Log `d.stats.pieces`
by structure while building, and keep the counts in the README.

## 3. Materials (12; one draw call each)

Each material starts from a preset or from `material()`.

| Name | Start | Change, and why | Surface | Broken faces |
|---|---|---|---|---|
| limestone | `presets.concrete` | density 2.4; support 45 (lime joints hold little sideways); compression 120 (stone piles carry a lot pressed, but towers still fall once about a third of a course is gone); strength 3.5e4; impact 55; fragmentSize 0.42, minSize 0.15, dustSize 0.2, maxPieces 22; rubbleLife 20; uvScale 0.67 | `medieval_limestone` (1.5 m tile) | inside 0xe9e1cf, `medieval_limestone_broken` at 1.25 |
| rubble | `presets.brick` | density 2.2; support 30, compression 100 (rubble walls crumble more than ashlar); strength 2.4e4; impact 40; fragmentSize 0.32, minSize 0.12, dustSize 0.18, maxPieces 26; uvScale 0.4 | Poly Haven `castle_wall_slates` (2.5 m) | inside 0xb8ab94, `medieval_limestone_broken` at 1.25 |
| plaster | `material()` | density 1.1; support 25, compression 40; strength 6e3; impact 10; fragmentSize 0.22, minSize 0.09, dustSize 0.14 (daub turns to dust); minBodySize 0.08; maxPieces 14; rubbleLife 8; uvScale 0.5 | Poly Haven `medieval_wall_01` (2 m), tinted by wash | inside 0xb59a74, `medieval_daub_broken` at 1.6 |
| oak | `presets.wood` | density 0.75; support 220 (pegged joints: jetties cantilever); strength 2.2e4 (a falling frame folds before it parts); impact 28; fragmentSize 0.35, minSize 0.1, dustSize 0.06, minBodySize 0.06; maxPieces 8 (long splinters, not cubes); rubbleLife 30; uvScale 1 | `medieval_oak` (1 m), tinted per house | inside 0xc89a62, insideMap 0.5 |
| boards | `presets.wood` | density 0.6; support 120; strength 1.2e4; impact 14; fragmentSize 0.25; maxPieces 10; uvScale 1 | Poly Haven planks: pick from `brown_planks_04` / `old_planks_02` / `medieval_wood` by looking | inside 0xc7a27a |
| tile | `material()` | density 1.9; friction 0.55 (broken tiles slide off a 50° slope); support 18 (pegged tiles: a hole spreads a little, and big damage slides whole rows); compression 60; strength 4e3 (sections shatter on landing); impact 6 (anything falling on a roof breaks it); fragmentSize 0.18, minSize 0.07, dustSize 0.08, minBodySize 0.06; maxPieces 16; rubbleLife 10; uvScale 0.385 | Poly Haven `clay_roof_tiles_03` (2.6 m). Check the rows run along the ridge, and turn the slab's frame if not. | inside 0xc0704a, base `gen_brick_broken` at 2 |
| glass | `presets.glass` | reach 2 (small leaded panes); surface 0x4a5a44, opacity 0.7, roughness 0.15, with a diamond came lattice from a canvas texture made in code (like Brick Street's grating) | code | — |
| bronze | `presets.metal` | density 1.6 (the bell is a solid hull, so about 0.8 t); impact 1e5, strength 1e6, support 1e5, minSize 3 (never fractures), dustSize 0.01, no plastic; colour 0x9a7440, metalness 1, roughness 0.35 | plain | inside 0xc8a060 |
| iron | `presets.metal` | defaults, uvScale 1 | base `gen_iron_painted`, colour 0x8a8580 | inside 0x5a4a40 |
| cloth | `material()` | density 0.25; support 40; strength 2e3; impact 3; fragmentSize 0.3, minSize 0.25, dustSize 0.5 (shreds near a blast), minBodySize 0.2; maxPieces 4; rubbleLife 8; uvScale 1.5 | `medieval_canvas` (0.5 m), tinted per stall | insideMap 0.8 |
| hay | `material()` | density 0.15; support 20; strength 1.5e3; impact 2; fragmentSize 0.3, minSize 0.2, dustSize 0.6 (bursts to chaff); minBodySize 0.25; maxPieces 5; rubbleLife 12; uvScale 1.2 | `medieval_hay` (1 m) | inside 0xd8b860, insideMap 0.8 |
| lantern | as Brick Street's `lamp` | emissive 0xffb060, emissiveIntensity 4 | plain | 0xe8e0d0 |

**Dust:** limestone 0xd8cfbd, rubble 0xb5a894, plaster 0xe6dfcf, oak 0x9a8064, boards 0xa08a6a,
tile 0xc07a58, hay 0xd8c070, cloth 0xc8bca8, glass 0xe0eadc.

**Chips:** limestone 0xcfc3a8, rubble 0x8f8472, plaster 0xeee6d4, oak 0x6b5238, boards 0x8a6a48,
tile 0xb0583a, glass 0x9fb79a, hay 0xd2b25a, cloth 0xa8402e, iron 0x3a3632, bronze 0x9a7440,
lantern 0xffe0b0.

**blastRadius:** 2.5. Ashlar blocks are big, and a rocket should take two or three of them.

## 4. Look

- **HDRI:** Poly Haven `kloppenheim_06_puresky`, 1k, saved to
  `public/packs/medieval/hdri/kloppenheim_06_puresky_1k.hdr` and credited. It's a German evening sky:
  a sun near the horizon (about 5°) behind thin cloud, clouds lit gold, blue above. Measured: sun
  colour (1, 0.54, 0.19) and a warm horizon. Its peak is soft (about 54), so the image has no hard
  disc, and the directional light does the sun's work. Alternative: `syferfontein_6d_clear_puresky`,
  a clear hazy sky with a bright disc at 6°, if a visible sun with bloom reads better.
  `sky.ts` lifts the light to about 14° elevation, so shadows are about 4 × height long. The layout
  allows for that (the open south-west).
- **Sun azimuth:** -2.1. The direction to the sun is (-0.50, ·, +0.86), from the south-south-west,
  behind the player's left shoulder at the start. Its incidence is about 0.86 on the wall and gate,
  about 0.5 (raking) on the church's and E1's west faces, about 0.87 on W3's south side, and the
  west row's fronts are in shade. Tune between -1.8 (more raking on the east side, less shade from
  the west row) and -2.4.
- **Sky options:** `background` 0.9, `environment` 0.5, `sun: { color: 0xffc58a, intensity: 3.4 }`,
  `shadowRange` 50.
- **Fog:** colour 0xcfb59a (sample the HDRI's horizon away from the sun and match it), near 45, far
  330. The hills at 200 – 250 m are hazy and the far ridge is nearly gone.
- **Exposure** 1.0. **Bloom:** strength 0.3, radius 0.5, threshold 0.88. Sunlit limestone and the
  lanterns glow a little, nothing more.
- **Hemisphere:** sky 0xa9bcd8 (blue fill in the shadows), ground 0x9a7652 (warm bounce off the
  cobbles), intensity 0.4. **AO** radius 0.7.
- **Palette:**
  - honey limestone 0xd9c9a8;
  - buff-grey rubble;
  - limewash white, ochre, pink and pale green-grey;
  - oak from silver-grey to tarred dark brown;
  - terracotta roofs 0xb05a3a, some mossy;
  - in the shadows, blue-violet from the sky fill;
  - in the light, orange-gold;
  - the stalls' red, blue and yellow as the only saturated colours.

## 5. Textures

### Generated (GPT Image 2.5, `PACK=medieval`)

Use one take each unless it fails. In priority order, so `medieval_canvas` is the one to drop if
the image budget is short (make a woven pattern in code instead):

| Set | What | One tile | Processing | Used by |
|---|---|---|---|---|
| `medieval_oak` | Weathered oak beam faces seen straight on. Silver-grey to grey-brown. Deep straight grain running **top to bottom**. Drying checks and splits along the grain, flat adze facets, one or two old peg holes. No edges, no joints, no knots bigger than a coin. | 1 m × 1 m | custom: `generic` wrap and delight, then height from `gaussian_filter(highpass(L, 6), (3, 0.6))` along the grain (as `wood_painted` does) plus fine detail, roughness 0.78 | oak surface |
| `medieval_limestone` | A dressed face of warm honey-cream oolitic limestone (Cotswold-like). Fine diagonal tool marks, gentle colour variation, light weathering, a few lichen spots. **No joints, no block edges.** | 1.5 m × 1.5 m | `generic` (rough 0.82) | limestone surface |
| `medieval_limestone_broken` | Freshly fractured limestone: pale cream crystalline grain, conchoidal facets and steps, small fossil shell fragments, rock dust. No surface patina. | 0.8 m × 0.8 m | `generic` like `brick_broken` (highpass height at two scales) | limestone and rubble insides |
| `medieval_daub_broken` | Broken wattle-and-daub: brown-ochre clay mixed with chopped straw, crumbly lumps, hazel wattle rods woven through and showing in places, pores. | 0.8 m × 0.8 m | `generic`, rough 0.92 | plaster inside |
| `medieval_hay` | The side of a compressed straw bale: dense tangled golden straw, mostly lying horizontal, some paler and some greyer stalks, dry and sunlit-gold in colour but evenly lit. | 1 m × 1 m | `generic`, rough 0.9 | hay surface |
| `medieval_canvas` | Coarse undyed linen or hemp canvas: a visible plain weave, slight creases, faint water and dirt marks. Almost white, so tints colour it. | 0.5 m × 0.5 m | `generic`, rough 0.88 | cloth surface |

State the frame's real size in each prompt, as the base prompts do (`tex()` adds the tiling and
lighting rules).

### Free: Poly Haven (CC0, no generation)

Download the 1k `diff`, `nor_gl` and `arm` jpgs. Re-encode them as WebP
(`cwebp -q 90 -m 6 -sharp_yuv`), named `<set>_diff_1k.webp` and so on, into
`public/packs/medieval/textures/`, and credit them in `CREDITS.md`.

| Set | Tile (Poly Haven's dimensions) | Used by |
|---|---|---|
| `cobblestone_floor_001` | 2.4 m | the ground (scenery), repeated |
| `clay_roof_tiles_03` | 2.6 m | tile surface (plain clay peg tiles) |
| `castle_wall_slates` | 2.5 m | rubble surface (town wall, round tower, stone ground floors, well, chimneys) |
| `medieval_wall_01` | 2.0 m | plaster surface (rough white lime; tinted per wash) |
| one of `brown_planks_04` / `old_planks_02` / `medieval_wood` | see its info | boards surface (doors, shutters, stalls, floors, crates) |

Also reused from the base pack: `gen_brick_broken` (tile insides) and `gen_iron_painted` (iron).

## 6. Props (Meshy; 4 models)

Each is one concept image at 1536 × 1024 with the base `concept()` studio text, then image-to-3D.
Props rest until thrown and never break, so the things that should break (crates, hay, stall
counters) are pieces, not props.

| Name | What | Real size (fit) | Mass | How many, where | Sound material |
|---|---|---|---|---|---|
| `barrel` | An oak barrel with three iron hoops on each end, staves visible, closed head, a little weathered. | 0.9 m tall (height) | 0.14 | 14: five by the tavern (W2) front at x -14 … -12.5, z -3 … 1 (one resting on top of two); four under the market hall; three by the gate inside (-6, -14.5); two by a stall | boards |
| `handcart` | A two-wheeled wooden market handcart: a plank bed with low sides, two long handles, two big spoked wooden wheels with iron tyres, empty. | 2.4 m long with handles (length) | 0.12 | 3: (-9.5, -10) by W1; (11, 10.5) by the hall; (-2.5, 15.5) at the road gap | boards |
| `haywagon` | A four-wheeled wooden farm wagon heaped with loose golden hay, a short pole at the front, spoked wheels. No horse. | 4.2 m long (length) | 1.0 | 1 inside the gate at (9, -11), turned about -0.35 rad toward the gate; a second one outside the gate on the road if it looks right | boards |
| `basket` | A round wicker basket heaped with red and green apples. | 0.5 m across (length) | 0.015 | 10, on the stall counters (two each on five stalls) | boards |

Meshy `texture_prompt`s should repeat the materials: oak, iron hoops, wicker, hay, apples. Check the
previews for made-up markings (there should be none), then set `yaw` so the front faces -Z. The
handcart's and wagon's fronts are their handles and pole.

## 7. Sounds (Stable Audio; 13 sounds, 30 takes)

### New

Make these with `sound`, `fx` and `foley` from `../../sounds.mjs`. The `play` settings go into the
pack's `index.json`.

| Name | Kind / space | Takes × s | The prompt's intent | Play |
|---|---|---|---|---|
| `ambience.birds` | loop / head | 1 × 40 | A country town square on a summer evening: many songbirds (blackbirds, sparrows), swallows twittering overhead, a distant rooster once, a light breeze. Field recording, no voices, no traffic, no music. | bus ambience, volume 0.32, reverb 0 |
| `ambience.market` | loop / head | 1 × 40 | A busy open-air market heard from across a stone square: an indistinct crowd murmur with no clear words, a cart's wooden wheels, a horse's hooves on cobbles now and then, a far hammer on an anvil. No music, no modern sounds. Negative: add "clear speech, words, engines, traffic". | bus ambience, volume 0.22, reverb 0 |
| `bell.toll` | shot / world | 3 × 8 | One strike of a large bronze church bell in a stone tower, heard from the square below: a deep rich bong, shimmering overtones, a long slow hum. | near 25, rolloff 0.5, volume 1, voices 3, priority 4, cooldown 0.8, reverb 0.5, pitch [0.98, 1.02] |
| `bell.clang` | shot / world | 2 × 4 | A huge bronze bell crashing onto cobbles after falling from a tower: a loud harsh dissonant clang, cracked and rattling, a dull thud, then a short wobbling ring. | near 15, rolloff 0.6, volume 1, voices 2, priority 4, cooldown 0.4, reverb 0.45 |
| `stone.break` | shot / world | 3 × 2.5 | Big limestone blocks cracking and splitting: a deep sharp stony crack, then crunching and grinding stone, gritty crumbling. | near 5, volume 0.8, voices 4, cooldown 0.06, spacing 3 |
| `stone.impact.large` | shot / world | 3 × 3 | A heavy dressed stone block falling onto a cobbled square: a deep heavy thud, a stony crunch, a short rattle of chips. | bus debris, near 6, volume 0.8, voices 4, priority 2 |
| `timber.crack` | shot / world | 3 × 2.5 | A thick old oak beam of a timber-framed house snapping: a loud woody crack, fibrous splintering, a creak. | near 4, volume 0.75, voices 3, cooldown 0.08 |
| `timber.groan` | shot / world | 2 × 3.5 | An old timber-framed house straining before it falls: slow deep creaking and groaning of oak beams and wooden pegs, small pops, dust trickling. | bus debris, near 6, volume 0.6, voices 2, cooldown 1.5, spacing 10 |
| `tile.clatter` | shot / world | 3 × 3 | A run of clay roof tiles sliding down a steep roof and pouring off the edge: a rattling cascade of tiles clattering and smashing on cobbles. | bus debris, near 5, volume 0.75, voices 3, cooldown 0.3, spacing 6 |
| `tile.impact` | shot / world | 4 × 1.2 | One clay roof tile smashing on cobbles: a bright ceramic crack and a few tinkling shards (`foley`). | bus debris, near 2.5, volume 0.45, voices 5, pitch [0.85, 1.15] |
| `birds.scatter` | shot / world | 2 × 3.5 | A flock of pigeons startled off a rooftop: a sudden burst of many flapping wings taking off and flying away, a few alarmed coos. | near 10, rolloff 0.8, volume 0.7, voices 2, cooldown 5 |
| `chickens.startle` | shot / world | 2 × 4 | Startled hens in a yard: sudden loud squawking and cackling, flapping wings, then agitated clucking settling down. | near 4, volume 0.6, voices 1, cooldown 4, reverb 0.25 |
| `steps.cobble` | slice / head | 1 × 8 | Footsteps in leather boots on old cobblestones at a steady pace, separate steps with short gaps (`foley`). The lowest priority: if takes run short, use the base `steps.asphalt`. | volume 0.3, voices 2, pitch [0.95, 1.05], reverb 0.15 |

That's 30 takes, which leaves 10 for redoing the takes that QA flags. Listen especially to the market
murmur (there must be no intelligible words) and the bell (it must not sound like a synth).

### Per material (`audio.materials`)

| Material | break | impact | heavyImpact | debris | strain | collapse | settle |
|---|---|---|---|---|---|---|---|
| limestone | stone.break | brick.impact.small | stone.impact.large | brick.debris | structure.creak | collapse.rumble | dust.settle |
| rubble | stone.break | brick.impact.small | stone.impact.large | brick.debris | structure.creak | collapse.rumble | dust.settle |
| plaster | brick.break | brick.impact.small | — | brick.debris | — | — | dust.settle |
| oak | timber.crack | wood.impact | wood.impact | wood.impact | timber.groan | collapse.rumble | — |
| boards | the base `wood` (packMaterials.wood) | | | | | | |
| tile | tile.impact | tile.impact | tile.clatter | tile.impact | — | tile.clatter | — |
| glass | the base `glass` | | | | | | |
| iron | the base `metal` | | | | | | |
| bronze | — | bell.clang | bell.clang | — | — | — | — |
| cloth | — | — | — | — | — | — | — |
| hay | — | — | — | — | — | — | dust.settle |
| lantern | glass.shatter | glass.debris | — | glass.debris | — | — | — |

- **Ambience:** `ambience.wind` (base) with high 3.5, `ambience.birds` and `ambience.market`, the
  last two ducked through `rt.ambience` (see below).
- **Footsteps:** hard `steps.cobble` (or `steps.asphalt` if it isn't made), rubble `steps.rubble`,
  land `player.land`.
- **Overrides** in `audio.settings` if needed: `explosion.near` reverb 0.6, because the square is
  hard stone all round.

## 8. Reactions

All state is module-level, as Brick Street's alarm is. `build()` keeps references to the bell and
the coop's position.

1. **The evening bell.** About 6 s after load, if the bell still hangs, toll it three times, 4 s
   apart, at volume 0.8. It says where the tower is and sets the mood.
2. **The bell answers hits.** On a blast within 9 m of the bell, or within the tower's box grown by
   2 m, and the bell still `fixed`: toll it at the bell's position. The volume is 1.2 - d / 12,
   clamped to 0.3 … 1. Then toll 2 – 3 more times, 1.7 s apart, each at 0.6 times the last: the bell
   swinging. Blasts further away on the church (the nave) toll it once, quietly (0.35).
3. **The bell falls.** In `update`, the first time the bell's state isn't `fixed`, toll it once at
   pitch 0.92: a last jangle as it comes off the headstock. `onImpact`: if `e.piece` is the bell and
   `e.speed` > 1.5, the material sound plays `bell.clang`. Add `effects.dust(e.at, 0.4, 0xcfc3a8)`.
   On the first strike over 4 m/s, add `effects.impact(e.at, [0, 1, 0], 0xffc070)` for bronze
   glints. The bell lying in the square is the world's trophy.
4. **Pigeons.** On any blast, play `birds.scatter` above it at `[at.x, max(at.y + 3, 11), at.z]` (it
   has a 5 s cooldown). Duck the birds loop to 0.15 times its volume over 1 s. It comes back in a
   straight line over 40 s, starting 20 s after the last blast.
5. **The market goes quiet.** At the first blast, fade the market murmur out over 2 s. After 120 s
   with no blasts, start it again with `fadeIn` 15.
6. **Chickens.** A blast within 30 m of the coop (13.3, 0.5, 16) plays `chickens.startle` at the coop
   after 0.2 – 0.5 s.
7. **Sparks.** Iron or bronze striking at over 4 m/s (`onImpact`, by `e.piece.materialName`) sprays
   a few orange chips: `effects.impact(e.at, [0, 1, 0], 0xffb060)`.
8. **The windmill** on the south-west hill turns its sails at about 0.35 rad/s in `update`.

**The loops** are the demo's (`audio.ambience`): `rt.ambience.get(name)?.setVolume(level, time)`
ducks one and brings it back. Waiting sounds (tolls, hens) are played with a `delay`.

## 9. Library requests (not made: worked around here)

Done since: a start hook (`onStart`: nothing here needs it now, the loops being the demo's), and,
taken up, the ambience voices in the runtime (`rt.ambience`), the sun's `elevation`, a
pointed-arch helper (`pointedArch`), and resting checks fast enough for a big collapse (phase D:
the world's loose cap is gone). Still worked around:

- The weighing to bring down a jettied front whose ground floor is gone: its weight stays over the
  joists, so it hangs over the void. `falls.ts` (`releaseFronts`) lets it go with `d.release`.
- An undermined tower still standing on part of its base stays upright (the library turns a section
  over an edge only once what's left no longer reaches across its base). `falls.ts` (`leanFalls`)
  tips it toward the side that was hit.
- A tall section pushed over joined (a tower, by `leanFalls`) now and then lands and is shot along
  the ground at the speed limit, hundreds of its blocks past 120 m. `falls.ts` cuts a tower's
  joints once its push ends.
