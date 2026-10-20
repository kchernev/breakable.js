# Dust Town: design

A frontier main street at high noon: two rows of false-front wooden buildings with covered
boardwalks, a brick bank, an adobe chapel with a bell, a water tower and a windmill, open desert
and mesas beyond. Everything in the town breaks. The desert, the mesas and the street's dirt don't.

This is the plan the builder and the asset makers follow. Numbers are targets: change them if a
screenshot says so, and keep this file in step.

## 0. Conventions

- Metres. **+x is east, along the street. +z is north.** The ground is flat at **y = 0**
  everywhere (`ground: 0`, `groundAt = () => 0`). Wheel ruts are drawn, not modelled.
- Looking east down the street, **+z (north) is on the right**.
- **Floor level is y = 0.40** for every building and boardwalk (raised off the dirt on sleepers).
- **Siding courses are 0.45 m** (3 lap boards of 15 cm). Wall heights are whole courses from the
  sill top at y = 0.30: one storey's eaves are at **3.90** (8 courses), two storeys' at **7.0**
  (7 courses, a 0.25 floor band, 7 courses, a 0.16 plate).
- Breakable part: x from -35 to +35, z from -25 to +25 (70 × 50 m). Piece target is **about 6,000**
  (budget table in §2.9), with a hard ceiling of 8,000. Log `d.stats.pieces` after each
  structure while building.

## 1. The place

### 1.1 Plan

```
 z
+25 .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .
          [windmill]                                                       (north: mesa line,
+20       (-28,+16)  [ N1 SALOON      ]   [N2]    [ N3 BANK  ]  [ N4 HOTEL  ]   300-480 m off)
+15        o stock    2 storeys, 12x12  barber    brick 10x10    2 st 10x11
           tank      -24..-12          -10.5..-4.5 -2..+8        +10..+20      [ ADOBE CHAPEL ]
+10 .......................................................................   x +24..+34
 +9.5  facades ===========  boardwalk + awning / balcony  ===================  z +2.5..+10.5
 +7.0  boardwalk edge, hitching rails, troughs                                 bell gable faces
       ~~~~~~~~~~~~~~~~~~~~~~~~ wheel ruts ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~  west (x = +24)
  0  P→ start (-33, 0, -2.5)          DIRT STREET (14 m)                       → the road east
       ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~   to the big butte
 -7.0  boardwalk edge, hitching rails, troughs                                  (+460, -30)
 -9.5  facades ===========                       (livery: no boardwalk)
-10       [ S1 GENERAL STORE ] [ S2 SHERIFF ]  [ S3 LIVERY BARN ] [S4 smithy]   [WATER TOWER]
-15        1 storey, 12x12      jail, 9x10      gable to street    +14..+20      (+27, -15)
            -24..-12            -10..-1          +1.5..+12.5        z -9.5..-15.5
-20                         [outhouse]           z -9.5..-23.5     [ corral +13..+24, -16..-24 ]
-25 .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .
    -35      -25       -15        -5   0    5        15        25        35   x
```

| Zone | Extent | Notes |
|---|---|---|
| Dirt street | \|z\| < 7.0, x -35 … +35, continues off both ends as a single wagon track | Two pairs of ruts at z = ±0.8 and ±2.3 (0.25 wide), hoof-churned strip down the middle |
| Boardwalks | 7.0 < \|z\| < 9.5 in front of each building except the livery | Deck top 0.40; a step down to the dirt at every alley |
| North row | facades at z = +9.5, fronts face -z | **Sunlit fronts**: the hero side |
| South row | facades at z = -9.5, fronts face +z | Fronts in shade under the awnings, sunlit backs |
| West entrance (player start) | x -35 … -25, open dirt | The open space the player starts in: a wagon, a hitching rail, the windmill to the right |
| East end | x +22 … +35 | The chapel closes the right half of the street; the road runs on east past it |

### 1.2 What stands where

| Id | Structure | x | z | Size W × D × H (m) | Notes |
|---|---|---|---|---|---|
| N1 | Saloon | -24.0 … -12.0 | +9.5 … +21.5 | 12 × 12 × 7.0 eaves; false front 9.0, stepped centre (4 m wide) to 9.9 | Balcony over the boardwalk at y 3.70; batwing doors at x = -18 |
| N2 | Barber | -10.5 … -4.5 | +9.5 … +17.5 | 6 × 8 × 3.9; false front 6.0 square | Shed roof sloping back; barber pole on the boardwalk post at x = -5.0 |
| N3 | Bank (brick) | -2.0 … +8.0 | +9.5 … +19.5 | 10 × 10 × 5.2; parapet 6.2 | Iron-barred windows; safe inside |
| N4 | Hotel | +10.0 … +20.0 | +9.5 … +20.5 | 10 × 11 × 7.0; false front 8.6 square with a heavy cornice | Two storeys, upper windows, hanging sign, rocking chairs on the boardwalk |
| C | Adobe chapel | +24.0 … +34.0 | +2.5 … +10.5 | 10 (x) × 8 (z) × 4.5; bell gable to 7.6 | Front (west) wall at x = +24 faces down the street. The **landmark at the end of the view** |
| S1 | General store | -24.0 … -12.0 | -9.5 … -21.5 | 12 × 12 × 3.9; false front 7.0, stepped | Two big display windows, barrels and crates on the boardwalk |
| S2 | Sheriff's office and jail | -10.0 … -1.0 | -9.5 … -19.5 | 9 × 10 × 3.9; false front 5.6 square | Cell at the back with an iron-barred window on the east side wall (seen from the alley) |
| S3 | Livery barn | +1.5 … +12.5 | -9.5 … -23.5 | 11 × 14; eaves 5.0, ridge 8.6 | Raw timber, **gable end to the street**, big door 3.5 × 3.8, hayloft door and hoist beam above |
| S4 | Blacksmith shed | +14.0 … +20.0 | -9.5 … -15.5 | 6 × 6 × 3.5 | Open-sided timber frame, tin shed roof, stone forge |
| WT | Water tower | centre +27.0 | -15.0 | 4.4 square deck at 6.3; tank Ø 4.0 × 3.2; top 11.2 | Tallest thing in town; seen over the south row down the street |
| WM | Windmill and stock tank | centre -28.0 | +16.0 | Tower 1.4 square × 8.0; wheel Ø 3.2 at 8.6 | Wheel faces west, into the wind: face-on from the start. Stock tank Ø 3.0 at (-25.5, +14.0) |
| — | Corral | +13 … +24 | -16 … -24 | Post and rail, 1.6 tall | Behind the smithy, beside the water tower |
| — | Outhouse | centre -6.0 | -22.5 | 1.2 × 1.2 × 2.3 | Behind the sheriff's |

### 1.3 The player, sight lines, landmarks

- **Start**: feet `(-33, 0, -2.5)`, look at `(+12, 3.5, +1)`. The view runs straight down the
  street. On the left is the store's shaded awning, on the right the saloon's sunlit balcony and the
  wagon in the foreground. At the end are the chapel's bell gable (right of centre), the water tower
  over the south row (left), and the big butte on the horizon in the gap between them.
- **East** (down the street): the bell gable; past the chapel the road runs out toward the butte at
  (+460, -30).
- **West** (behind the start): the road leaving town toward twin buttes at (-420, +60).
- **North, through the alleys** (x -12, -4.5 … -2, +8 … +10): the mesa line.
- **South, over the corral**: low ridges.
- Above the roofs from anywhere in the street you can see the water tower (11.2), the windmill
  (9.5), the saloon's stepped false front (9.9) and the chapel gable (7.6).

### 1.4 Distant scenery (unbreakable, `scenery()`)

All of it sits well inside the camera's far plane (600 m) and is fogged.

- **Ground**: one fixed physics box (1200 × 4 × 1200, top at y = 0, friction 0.9; 4 m thick, as a
  piece driven half a metre into a 1 m box went out of its bottom). It's drawn as
  three meshes:
  - The town lot and street (x ±60, z ±40) in `western_dirt` at 1 repeat per 4 m, paler in the
    street (tint 0xe6d6b8).
  - The ruts as thin strips at y = 0.003 in a darker, smoother version of the dirt. They bend into
    the livery door and join into one track east of the chapel.
  - The desert beyond in the same map, with TSL large-scale colour noise from 0xc9a77c (tan) to
    0xb07a52 (red earth) and scattered darker gravel patches.
- **Mesas and buttes**: about 10 extruded irregular polygons with steep cliff walls and a talus
  skirt at the foot, in one TSL material with horizontal strata by world y. The bands run from rust
  0xa95a36 to cream 0xd9b98c, with a darker cap rock and value noise so the bands aren't ruler
  straight.
  - **The big butte** on the street's axis at (+460, -30): 140 wide, 90 tall.
  - **Twin buttes** behind the start at (-420, +60): 60 and 45 tall.
  - **The north mesa line** from x -400 to +300 at z +300 … +480: 40–80 tall, flat tops.
  - **Low southern ridges** at z -350 … -480: 20–40 tall.
- **Mid-ground**, instanced and cheap, 40–300 m out:
  - ~300 sage and creosote shrubs (low-poly blobs, olive-grey 0x8b8a6a)
  - ~60 rocks
  - ~15 saguaro-like cacti (a cylinder with two bent arms)
  - telegraph poles beyond the town limits on both roads, every 45 m out to 350 m, with no wires
- **Horizon haze skirt**: an open cylinder of radius 540 m and height 50, drawn after the
  background, with `fog: false` and `depthWrite: false`. It's the fog colour, with alpha 0.9 at its
  foot fading to 0 at 45 m. It does two things:
  - It hides the photographed hills of the HDRI behind our own mesas, so nothing sharp and unfogged
    sits behind fogged mesas.
  - It gives the bleached, hot horizon the brief asks for: a colour. The shimmer over the desert is
    the look's heat haze (`look.haze`, §3.2).

## 2. How each kind of structure is built

### 2.1 Rules for every structure

1. **Pieces ≤ 2 m on a side.** The 2.4 m boardwalk planks across the walk are the one exception,
   since they are thin. Split long beams and rails into lengths that share their end faces exactly.
2. **Exact contact.** Compute every position from the same numbers (course heights, bay lines). No
   overlaps. Neighbouring buildings stand 6 cm apart, so they are separate structures.
3. **Wood grain and corrugations follow the map's v axis.** The library box-projects each piece
   in its own frame. Side faces (normals along local x or z) map v to **local y**. Top and bottom
   faces map v to **local z**.
   - Posts stand along local y, so their grain runs up the post.
   - Lay every horizontal beam, joist, rail and rafter long on **local y**, then rotate it into
     place (90° about z or x). Its grain then runs along it.
   - Floor and boardwalk planks lie long on **local z**.
   - Tin sheets lie with **local z down the slope**, so their ridges run down the roof.
4. **Siding lines up across pieces.** Give every siding piece of a wall the same `textureFrame`:
   the wall's corner at sill height, the wall's rotation. The lap lines then run continuously across
   courses and bays. One map tile is 6 boards = 0.90 m, so `uvScale = 1 / 0.9`.
5. **Tilted pieces only touch at edges and aren't bonded.** Use `d.bond(a, b, area)` for:
   - rafters to ridge pieces
   - kicker braces
   - the windmill's X-rods
   - stair stringers

   Better, where you can, give them a **seat**: a `prism` wedge with a flat bottom on the plate and a
   top at the rafter's angle, so both contacts are faces.
6. **Floors stop 2 cm short of the front wall**, as in Brick Street. A front and its false front
   are a free-standing stack, tied to the side walls only where those butt against its back at the
   corners. Undermine it and it peels off and falls into the street.
7. `static: true` is for nothing in the town. The ground carries the sleepers and footings.

### 2.2 False-front frame building (N1 saloon, N2 barber, N4 hotel, S1 store, S2 sheriff)

The frame is built from the ground up:

- **Sleepers.** `timber` beams 0.20 wide × 0.30 tall lie on the ground under every wall line and
  every 2 m across the plan, in lengths ≤ 2 m.
- **Floor deck.** `timber` panels about 2 × 2 × 0.10, top at 0.40, rest on the sleepers.
- **Corner posts and wall posts.** `timber` posts 0.16 × 0.16 stand at every corner and at bay lines
  ≤ 1.8 m apart. Each is a stack of lengths of 4 courses (1.80 m) standing on the perimeter
  sleeper.
- **Siding.** `siding` boards are 0.45 tall × 0.16 thick (the wall's thickness) and run between
  posts (bay minus post: about 1.6 m). Each course stands on the one below and is bonded at its ends
  to the posts. This gives a wall that:
  - **holds as a stack**: weight goes down the courses to the sleepers
  - **hangs from its posts**: sideways bonds, limited by `support`
  - **comes apart board by board** when shot: each piece reads as 3 boards
- **Openings.** Courses stop at the opening.
  - `timber` jambs 0.10 wide fill each side.
  - A `timber` head beam (0.16 tall) spans the top and carries the courses above. Shoot it and those
    courses sag and drop.
  - Windows have a frame (4 pieces), a sash bar or muntins (1–2), and 2–6 `glass` panes 3 cm thick,
    set back 5 cm.
  - Doors are 1–2 `siding` or `timber` leaves, bonded to a jamb.
  - Sills under windows are 2 courses (0.90).
- **Top plates.** `timber` 0.16 × 0.16 runs along the top of the side and back walls (rotated
  beams). The rafter seats stand on them.
- **False front.** The front wall carries on above the eaves in courses with its posts, up to the
  building's height. It ends in a `timber` cap: 0.30 deep, projecting 0.12, in ≤ 2 m pieces.
  - Shapes: **square** (N2, N4, S2); **stepped** (N1, S1), where the centre third rises 0.9 m more
    with its own cap; or **N4's heavier cornice**, a second, deeper cap course on 0.2 m `timber`
    brackets every 1.2 m.
  - Two **kicker braces** (`timber` 0.10 × 0.10, tilted at 45°) run from the back of the false front
    to the roof's first rafter pair, each with `d.bond` at both ends (area 0.02). They are what holds
    it against wind in reality. Here they keep it as one with the roof, so that when the wall below
    is shot out, the false front tips forward over the awning rather than dropping straight down.
- **Signboard.** `signpaint` boards 0.04 thick, about 0.9 tall and W − 1.0 long, in ≤ 2 m pieces,
  sit face to face on the false front's upper courses, bonded by contact. The painted pictogram and
  glyph rows come from the sign atlas (§3.5).
- **Roof.**
  - **Gable**, ridge front to back along z, pitch 18°, hidden behind the false front (N1, N4, S1,
    S2). Rafters are `timber` 0.08 × 0.16 on the bay lines (≤ 1.8 m apart), in ≤ 2 m lengths that
    share end faces. They have prism **seats** on the top plates and are `d.bond`ed to a `timber`
    ridge piece (prism) at the apex.
  - **Shed roof**, one slope falling to the back, for the narrow N2.
  - **Covering.** `tin` sheets 1.80 (across the rafters) × 1.50 (down the slope) × 0.03, with their
    joints on rafter centrelines so each sheet rests on two rafters. Sheets also bond edge to edge
    with their neighbours (coplanar faces), so a roof slope comes away as a crumpling sheet of tin.
- **Two storeys** (N1, N4). At y 3.45–3.70 a full `timber` floor band (panels ≤ 2 × 2 × 0.25)
  covers the plan, stopping 2 cm short of the front wall. The front wall has its own 0.25 band piece
  per bay at that level. Upper side and back walls stand on the band. A centre girder on two
  `timber` posts carries the band's middle.
- **Interior** (a little, 20–60 pieces, so shots through windows find things):
  - N1: a bar counter on the west wall (timber panels with a top board); a back bar with 24 bottles
    (`glass` 8-sided cylinders r 0.04 × 0.30, tinted amber 0xb07a2a or green 0x4a7a3a); a 2 × 1
    mirror pane (`glass`, tint 0xc8d0d0); 6 tables (a top and a post); a partition upstairs.
  - S1: counter, shelves, crates and sacks (hay material tinted 0xd8c8a8).
  - S2: a desk, a stove (`iron` box with a pipe in 4 cylinder lengths to the roof), and the cell (see
    2.4).
  - N2: two chairs.
  - N4: a desk and an upstairs partition with doors.

**Where it fails, and how it comes down.**

- One rocket at a front wall blows out 2–3 bays of boards.
- The head beam over a door or window goes, and the courses above hang from the posts until
  `support` gives. The section drops, and the false front leans out on its braces and falls into
  the street with its signboard.
- Shooting the awning posts brings the awning down onto the boardwalk.
- Shooting a corner post and the sleeper under it racks the whole side.
- Roofs come down as tin sheets, folding as they fall.

### 2.3 Boardwalk, awning, balcony

- **Footings and joists.** `timber` blocks 0.20 × 0.30 × 0.20 sit on the ground at the front edge,
  the middle and the facade, one row every 2 m. Joists (rotated beams 0.10 × 0.10, along x, ≤ 2 m)
  sit on them, top at 0.34.
- **Planks.** `timber` planks run across the walk (long on local z), 2.40 × 0.06 × 0.30. Give each
  plank a slight tint variation (0xf2ece2 … 0xd8ccb8) so each one reads. A fascia board (0.25 tall)
  runs along the front edge.
- **Awning.** `timber` posts 0.15 × 0.15 stand on the deck at z = ±7.15, every 2.4–3.0 m (on the
  building's bay lines), 2.8 tall in two lengths.
  - A header beam (rotated, ≤ 2 m) runs along their tops.
  - A ledger is face-bonded to the wall courses at the same height.
  - Joists run from header to ledger.
  - The roof is flat **plank** (`timber` boards 1.8 × 0.05 × 0.6), with a fascia.

  The awning is flat on purpose, so every piece bonds face to face. From the street it reads as an
  awning.
- **Saloon balcony.** Its posts run to 3.45, with the deck at 3.45–3.70 (joists and planks) level
  with the upper floor.
  - Railing: turned balusters (`timber` 8-sided cylinders r 0.035 × 0.85) every 0.30 m on a bottom
    rail, with a top rail, all painted bone white (tint 0xf2ead8).
  - Three openings onto it upstairs: two windows and a door.
- **Hitching rails and troughs** stand on the dirt just outside the boardwalk edge (z = ±6.6) (§5,
  §2.8).

### 2.4 Bank (N3): brick and stone

- **Plinth.** `stone` blocks (1.5 × 0.4 × 0.5) from 0 to 0.40, level with the boardwalks, with a
  stone stoop at the door.
- **Walls.** `brick` 0.40 thick, in courses 0.60 tall, blocks ≤ 1.6 long. Alternate courses are
  offset by half a block (a running bond at block scale), so cracks step diagonally. Walls run from
  0.40 to 5.20 and use per-wall `textureFrame` so the brick map runs across blocks.
  - Front: piers between the openings, a sill block under each window and a lintel over it (Brick
    Street's facade logic).
  - Corners: brick pilasters 0.6 wide projecting 0.08 (tint a shade darker, 0xd8b8a0).
- **Cornice and parapet.** A `stone` band at 5.20 (0.25 tall, projecting 0.20), a brick parapet to
  6.05, and `stone` coping (0.15) on top.
- **Door.** At the centre, 1.4 × 2.6. A stone lintel with a glass fanlight above. Two heavy `timber`
  leaves tinted dark green 0x4a5a48.
- **Barred windows.** Two, one each side of the door, 1.3 × 2.2, with:
  - `stone` sill (projecting 0.08) and lintel
  - a timber frame
  - 4 glass panes
  - **5 vertical `iron` bars** 0.035 square, each in two 1.1 lengths, standing on the stone sill
    and bonded by face to the lintel above
  - 2 flat cross bars, bonded to the uprights with `d.bond`

  Shot, the glass shatters first and the bars **bend inward** (iron is plastic). They tear only with
  a near hit.
- **Roof.** Hidden by the parapet. `timber` joists (rotated, in 5 lengths across the 9.2 m span,
  every 1.8 m) bear on the side walls' inner half, with `timber` deck panels on them.
- **Inside.**
  - A teller counter (timber) with an `iron` grille of thin bars: 12 bars and 2 rails.
  - A back partition.
  - **The safe** prop (`loose: true`) against the back wall at (+5.5, 0.40, +18.6).
- **Failure.** This is the strongest building in town. It takes two or three rockets to open, and
  it comes down in blocks with brick dust, not boards.

### 2.5 Adobe chapel (C)

- **Walls.** `adobe` 0.60 thick, courses 0.50 tall, blocks ≤ 1.4 long, staggered by half. They run
  from the ground up to the eaves at 4.5, then a 0.5 parapet. Stepped `adobe` buttresses
  (1.0 × 1.0 at the base, two steps) stand at the two west corners.
- **The bell gable (espadaña).** The west wall carries on up in the middle:
  - shoulders 6.0 wide up to 5.5
  - the centre 3.2 wide up to 7.3
  - a rounded cap: `prism` pieces with a five-point arc outline, to 7.6

  In the centre is an arched opening (span 1.1, springing at 5.9). Its 7 `adobe` voussoirs come from
  `arch(1.1, 0.35, 0.6, 7)`. Its jambs are the courses either side.

  **The bell.** A `bronze` hull of `frustum(0.30, 0.17, 0.48)` plus a lip ring, hanging under a
  `timber` yoke beam that spans the opening at the springing. The yoke is face-bonded to both
  jambs; the bell is bonded to the yoke with `d.bond(area 0.02)`. When the gable is hit the bell
  falls and rings as it lands (§7).
- **Door.** At x = 24, z = 6.5: 1.6 × 2.6. A projecting `timber` lintel (0.25 tall, 0.4 longer each
  side) and two plank leaves (tint dark 0x6a5040). Above it, a 0.6 square window with glass.
- **Side windows.** Three each side, small and deep: 0.6 × 0.9, sill at 1.8, timber lintel, glass
  set in the middle of the wall's thickness.
- **Roof.**
  - Six **vigas** across the 8 m span (along z) every 1.6 m. Each is an **8-sided `timber`
    cylinder r 0.13, turned so one flat faces down and one faces up**, so it bonds to the wall top
    under it and to the deck on it. Each viga is 5 lengths of 1.8 (8.0 plus 0.5 projecting through
    each wall), sharing end faces.
  - On the vigas: `timber` latilla panels (≤ 2 × 1.6 × 0.08), then `adobe` roof slabs (≤ 2 × 2 ×
    0.15).
  - Two `timber` canales (scuppers) through the north parapet.
- **Inside.** 8 pews (bench and back) and a table at the east end.
- **Failure.**
  - Adobe is weak sideways and strong pressed. Rockets carve big crumbly bites with lots of tan
    dust.
  - A gable whose shoulders are shot out topples whole, bell and all.
  - Vigas with their bearing wall gone swing down on their other end until the bonds give.

### 2.6 Livery barn (S3), raw timber

- **Walls.** Board-and-batten in `timber` (unpainted). The wall structure is the same as §2.2, but
  the courses are 0.60 tall with posts every 1.8 m. The eaves are at 5.0, and there's no boardwalk.
  Floor: packed dirt inside (no deck). The posts and courses stand on sleepers on the ground.
- **Gable end to the street (z = -9.5).** The gable's courses above the eaves are trapezoid `prism`
  pieces cut to the 33° roof line. The gable rises to 8.6.
  - At the bottom, a big double door 3.5 × 3.8, its leaves bonded open against the wall.
  - Above it, a 1.4 × 1.6 hayloft door.
  - At the apex, a hoist beam (a rotated `timber` 0.2 × 0.2, 1.2 out from the gable, bonded through
    to the ridge). It carries a short `iron` hook bar.
- **Hayloft floor** at 3.0. `timber` panels on beams, stopping short of the gable.
  - 12 hay bales up there and 10 on the ground floor.
  - Stalls: `timber` rails between posts, 3 per side.
- **Roof.** Gable with the ridge along z, steep (33°), `tin` on rafters, as in §2.2.
- **Failure.** Tall, light and open inside. A shot to the door posts brings the gable down onto the
  street in a fall of boards and hay.

### 2.7 Water tower (WT) and windmill (WM)

**Water tower** at (+27, -15):

- **Legs.** Four `timber` legs 0.30 × 0.30 at ±1.6, vertical, 6.0 tall in four 1.5 lengths.
- **Girts.** Rotated `timber` 0.16 × 0.16 girts join each pair of legs at every leg joint: four
  levels × four sides. Their end faces butt the leg sides.
- **Cap and deck.** At the top, 4 cap beams, joists and a 4.4 × 4.4 plank deck at 6.0–6.3.
- **Tank.** Ø 4.0 × 3.2. 16 `timber` staves around × 2 heights (`arcBlock(1.92, 2.0, a0, a1,
  1.6)`), with 3 hoops of 8 `iron` arc segments (`arcBlock(2.0, 2.03, …, 0.06)`) face-bonded to the
  staves. The tank floor is 4 quarter-disc `prism` panels inside the staves on the deck.
- **Roof.** A shallow cone of 8 wedge pieces (hull points: centre top and two rim points, at two
  thicknesses), bonded by hand to the staves under them.
- **Extras.** A ladder up one leg (2 rails, 18 rungs) and a hinged spout: a `timber` chute 1.6 long
  on `d.bond`.
- **Failure.** Shooting one leg makes the tower lean on its bonds. Two legs on one side gone and
  the whole top drops as one body (the library's whole-section drop), tips, and bursts on landing:
  staves, hoops and planks across the corral. **The tank is dry** (drought, and the library has no
  water).

**Windmill** at (-28, +16):

- **Tower.** Four vertical `timber` legs at ±0.7, 8.0 tall in 5 lengths. Girts at each joint.
  `iron` X-rods (0.025 thick) on alternate levels, each end held with `d.bond(area 0.004)`. A 1.6
  square platform at the top.
- **Head.** An `iron` gearbox (0.5 × 0.4 × 0.6) bonded on the platform.
  - A `tin` tail vane 1.6 × 0.9 on a 1.6 `iron` boom, bonded to the gearbox.
  - An `iron` pump rod down the centre in 5 lengths, to a `timber` pump stand.
  - **The wheel is not a piece.** It's a visual mesh (18 tin blades on two rings, Ø 3.2) that
    follows the gearbox piece's pose and spins (§7).
- **Stock tank.** Ø 3.0 × 0.7: 12 `timber` staves and a floor of 4 `prism` quarter panels.
- **Failure.** Shoot the legs and the tower folds. The head, with its wheel, crashes down.

### 2.8 Small breakables (code, no models)

| Thing | Built of | Pieces | How many, where |
|---|---|---|---|
| Barrel | 8 `timber` staves `arcBlock(0.26, 0.30, …, 0.86)`; 8-sided heads 0.03 thick, top and bottom, whose sides face-bond the staves' inner faces. Iron-banded look: tint the staves; no hoop pieces | 10 | 18: 3 on the store boardwalk at y 0.40: (-21, -8.3), (-20.3, -8.4), (-14, -8.4); 4 beside the saloon's boardwalk (-12.6 … -12.2, +7.8 … +8.6); 3 by the livery door; 3 at the smithy; 2 on the west entrance by the wagon; 3 behind the hotel |
| Crate | one `siding` box 0.6–0.9, tint 0xe8d8c0 (raw) | 1 | 30, in stacks of 2–4: store boardwalk, hotel side, behind the store |
| Hay bale | one `hay` box 1.0 × 0.45 × 0.5 | 1 | 22 in the livery, 6 in front of it at (+13, -7.5) |
| Hitching rail | 3 `timber` posts 0.12 × 1.0 (on the dirt), 2 rails 1.2 (rotated, end to end) | 5 | 8: in front of N1 at x -21.5 and -15.5, S1 at -18, S2 at -6, N4 at +15, N3 at +3, S3 at +3.5 (clear of its trough at +6 … +8), west entrance at -31 (z +6.6 or -6.6 by row) |
| Water trough | `timber`: bottom 2.0 × 0.06 × 0.6, 2 sides, 2 ends, 2 cross blocks | 7 | 4: (-18, ±6.2) on both sides, (+7, -6.4), (+18, +6.4) |
| Bench | `timber` seat and two legs | 3 | 3 on boardwalks: N2, S2, N4 |
| Barber pole | 6 `signpaint` 8-sided cylinders r 0.07 × 0.25, alternately tinted red 0xb03a2e and white, a cap, on an `iron` bracket bonded to the post | 8 | 1 at (-5.0, 1.6, +7.3) |
| Telegraph pole | 4 `timber` lengths r 0.11 (8-sided), a rotated crossarm 1.2, 2 green `glass` insulators | 7 | 2: (-34, -8.0) and (+33, -8.0) |
| Corral | `timber` posts 0.15 × 1.6 every 2.0, 2 rails per span | ~60 | §1.2 |
| Outhouse | `siding` boards, as §2.2, 1.2 × 1.2 × 2.3, plank door, shed roof in `timber` | ~24 | (-6.0, -22.5) |
| Hanging sign brackets | a rotated `timber` arm 1.2 out from a boardwalk post or facade, a `timber` knee brace, and the board (`hangboard`, 1.0 × 0.45 × 0.04) on a hinge under the arm, its chains drawn (§7) | 3 | 7: N1, N2, N4, S1, S2, S3, S4 |

### 2.9 Piece budget

| Structure | Target pieces | As built |
|---|---|---|
| N1 Saloon (with boardwalk, balcony) | 1,150 | 1,342 |
| N2 Barber | 380 | 452 |
| N3 Bank | 520 | 564 |
| N4 Hotel | 900 | 1,153 |
| S1 General store | 620 | 910 |
| S2 Sheriff and jail | 560 | 641 |
| S3 Livery barn | 650 | 769 |
| S4 Blacksmith shed (stone forge, anvil block) | 120 | 95 |
| C Adobe chapel | 480 | 486 |
| WT Water tower | 140 | 181 |
| WM Windmill and stock tank | 100 | 71 |
| Interiors (bar, stools, tables, counters, cell) | in the buildings | 189 |
| Small breakables (§2.8: barrels with hoops, bales in slabs) | 420 | 711 |
| Props | | 9 |
| **Total** | **≈ 6,040** (headroom to 8,000 for detail that screenshots ask for) | **7,573** |

### 2.10 Materials (12 draw calls; 14 as built, with `stave` and `coals`, §9)

The textures are in `packs/western/textures/` unless named as base (`textures/`). Use
`textured(set, { base: 'packs/western/textures/' })`. The splinter inside is
`inside('western_splinter', 2, { base })`.

| Name | From | Changes, and why |
|---|---|---|
| `siding` | `presets.wood` | `density 0.5`, `support 70` (thin nailed boards hang poorly), `compression 40`, `strength 8e3` (comes apart into boards once falling), `impact 12`, `fragmentSize 0.45`, `minSize 0.12`, `maxPieces 7` (a few long pieces, not crumbs), `grain` along u ×4 (boards split along their length), `dustSize 0.05`, `minBodySize 0.1`, `rubbleLife 25`. Surface `western_siding`, `uvScale 1/0.9`, per-building tint (§3.4) where the map has paint (`tintMask`: `western_siding_paint`). `inside 0xe0caa0`, splinter inside, `insideMap 0.2` |
| `timber` | `presets.wood` | `density 0.6`, `support 150`, `compression 60`, `strength 1.6e4`, `impact 22`, `fragmentSize 0.4`, `minSize 0.1`, `maxPieces 8`, `grain` along v ×4 (beams, posts and planks lie long on their texture frame's y), `dustSize 0.05`, `rubbleLife 40`. Surface `western_timber`, `uvScale 1`, `uvJitter 1` (each piece its own patch: knots don't line up across a deck). Splinter inside, `inside 0xe2cda8` |
| `tin` | `presets.metal` | `density 0.2` (about real: half a millimetre of iron over the 3 cm a sheet is drawn), `audible 0.001` (heard whatever it strikes), `support 400`, `strength 6e3` (tears off the rafters and flies), `impact 60`, `plastic { yieldStress 2.5e3, bend 1.8 }` (sheets fold, hang and crumple), `fragmentSize 0.8`, `minSize 0.45`, `maxPieces 3`, `minBodySize 0`, `friction 0.45`, `rubbleLife Infinity`. Surface `western_tin` with `metalMap: true` (its metalness the map's), `uvScale 1`. `inside 0x8c8a84`, `insideMap 0.6` |
| `adobe` | `presets.brick` | `density 1.6`, `support 22` (weak sideways), `compression 90`, `strength 1.0e4`, `impact 16`, `fragmentSize 0.3`, `minSize 0.12`, `dustSize 0.32` (lots of it goes to dust), `minBodySize 0.12`, `maxPieces 30` (crumbles in lumps, not cut blocks), `rubbleLife 30`. Surface `western_adobe` with `normalScale 0.45` (smoothed mud plaster), `uvScale 0.4`. `inside 0xb4916a`, `insideMap 0.7` (its own grain, darker: dried mud) |
| `brick` | `presets.brick` | `support 60`, `impact 35` (the bank is the fortress). Surface base `brick_wall_005` with `color 0xead2bc` (sun-faded, dusty), `uvScale 0.55`. Inside base `gen_brick_broken` at 1.6, `inside 0xc4a596` |
| `stone` | `presets.concrete` | Sandstone trim. Surface base `concrete_wall_008` with `color 0xe6d2ae`, `uvScale 0.5`. `inside 0xd8c4a0`, base `gen_concrete_broken` inside |
| `glass` | `presets.glass` | Old dusty panes: surface `color 0x7d8f8c`, `roughness 0.18`, `metalness 0.25`, `opacity 0.5`, writing depth (a blast's dust drifting over a front fades at its panes as at its walls). `landing 2`: bottles and panes break where they land |
| `iron` | `presets.metal` | Bars, hoops, rods, stove, gearbox. Surface base `gen_iron_painted` with `color 0x8a8a8a`, `uvScale 1`. `plastic { yieldStress 1.5e4, bend 1.4 }` (bank bars bend before they tear) |
| `bronze` | `presets.metal` | The bell, which never breaks: `density 8`, `impact 1e9`, `minSize 3`, `maxPieces 1`, no `plastic`. Surface plain `color 0xa0783c`, `metalness 1`, `roughness 0.35` |
| `signpaint` | `material()` | `density 0.5`, `support 80`, `strength 6e3`, `impact 10`, `fragmentSize 0.3`, `minSize 0.1`, `dustSize 0.04`, `maxPieces 6`, `grain` along u ×4. Surface: the sign atlas (§3.5), `uvScale` [1 / 7.2, 1 / 9.0] (a metre of board a metre of atlas). Splinter inside, `insideMap 0` |
| `hangboard` | `material()` | The hanging signs' boards: `signpaint` with no `grain` and `fragmentSize 0.15`, so a round blows out where it struck and leaves a piece at each chain (70% of the board; along the grain, a strip of 40%). The same atlas |
| `paint` | `presets.wood` | Painted trim: window frames, balusters, batwings, the barber's pole, barrel hoops (colour by tint). `density 0.5`, `strength 8e3`, `impact 10`, `fragmentSize 0.25`, `minSize 0.06`, `maxPieces 5`. Surface plain white, `roughness 0.78`. Splinter inside |
| `hay` | `material()` | `landing 5` (a bale off the loft bursts), `density 0.15`, `support 40`, `compression 20`, `strength 2e3`, `impact 6`, `fragmentSize 0.25`, `minSize 0.18`, `dustSize 0.4` (bursts into straw dust), `minBodySize 0.15`, `maxPieces 6`, `rubbleLife 15`. Surface `western_timber` with `color (1.7, 1.5, 0.85)` (dull straw; brighter burns out flat yellow), `uvScale 5` (the grain reads as straw). `inside 0xd8c070`, `insideMap 0.8` |
| `coals` | `material()` | The forge's bed of coals: `density 0.9`, `strength 3e3`, `impact 8`, small pieces. Black, with embers glowing through (noise on `pieceFrame()`, brightest on top, breathing), `glow: 'standing'`: dark once knocked out of the hearth |

**Dust colours** (`dust`; all of them taken toward the look's sandy `dustPalette`, and `dustAmount`
raises adobe's and hay's, and all but drops tin's, iron's, glass's and the bell's):

| Material | Colour |
|---|---|
| siding | 0xcbb89a |
| timber | 0xb8a080 |
| tin | 0x9a948a |
| adobe | 0xc9a57a |
| brick | 0xb08a70 |
| stone | 0xd0c0a0 |
| glass | 0xe8f0ee |
| signpaint, hangboard | 0xcbb89a |
| hay | 0xd8c27a |

**Chips** (`chips`):

| Material | Colour |
|---|---|
| siding | 0xd8cbb4 (paint flakes) |
| timber | 0x9a8466 |
| tin | 0x8a8a84 |
| adobe | 0xb08a60 |
| brick | 0x8a5a44 |
| stone | 0xc8b490 |
| glass | 0xd8ece6 |
| iron | 0x3a3a3a |
| bronze | 0x8a6a3a |
| signpaint, hangboard | 0xc9b89a |
| hay | 0xd8c070 |

`blastRadius`: the default 2.3 suits wooden buildings, which open wide enough. Raise it only if
the bank feels unbreakable.

## 3. Look

### 3.1 Sky

- **HDRI: Poly Haven `goegap`** (Greg Zaal, CC0).
  - It's clear desert at midday: deep dry blue sky, the sun at 46.6° (measured from the 1k file),
    and a warm sandy lower hemisphere that gives real desert bounce light.
  - It exists: the API lists it under `t=hdris`, and
    `https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/goegap_1k.hdr` returns 200 (1.36 MB).
  - Download it to `public/packs/western/hdri/goegap_1k.hdr` and use
    `sky.hdri = 'packs/western/hdri/goegap_1k.hdr'`.
  - Its photographed hills show just above the horizon. The haze skirt (§1.4) covers them.
- **Fallback:** `qwantani_noon_puresky` (sun at 49.7°, pale pure sky). Use it if goegap's horizon
  still shows through in screenshots. Its lower half is dark, so raise the hemisphere's ground fill
  if you switch.
- **Sun**: `azimuth: 1.30`, from the south (-z) a little east, **raised to 65°** (`sky.elevation`)
  (goegap's own sun stands at 47°, mid-afternoon, low enough to get under the 3.2 m awnings).
  - The north row's fronts take full sun; the awnings and the balcony shade the boardwalks and
    the lower fronts, with a sunlit strip along the edge.
  - The south row's fronts are in shade, with bright sunlit dirt in front of them.
  - From the start, the sun is up and to the left, out of frame.
- `sun: { color: 0xfff1dc, intensity: 3.7 }`
- `background: 1.05` (a clearer blue zenith), `environment: 0.12` with a fill light of 2.4 from the
  shaded side (`look.fill`: the light the sky's own sun gave from there while the sky was turned the
  wrong way, which the look was made with)
- `shadowRange: 55`, enough to cover the street from the middle.

### 3.2 Look (`look`)

| Setting | Value | Why |
|---|---|---|
| fog | `{ color: 0xd9c9ad, near: 70, far: 640 }` | Bleached warm haze: the mesas at 300–480 m are half gone into it |
| exposure | 1.05 | Bright but not blown; AgX keeps the sunlit paint pale and bleached |
| bloom | `{ strength: 0.22, radius: 0.35, threshold: 0.95 }` | Only glints off tin and glass |
| hemisphere | `{ sky: 0xbcd0e8, ground: 0xc2a07a, intensity: 0.17 }` | A little warm bounce into shaded fronts; more washes the noon shade out (shade on the dirt was 0.85 of sunlit at 0.5) |
| ao | 0.5 | |
| haze | `{ strength: 1.4, from: 60, height: 8 }` | The air over the hot desert shimmers: the far scrub and the mesas' feet waver, the town doesn't |
| dustPalette | `{ colors: [0xd8c4a0, 0xc9ae86, 0xe4d6bc, 0xbfa27c, 0xcdbb9a] }` | All dust is the street's sand and dun |
| smoke | `{ color: 0xd0b894 }` | A blast in the street throws up a cloud of its dirt, not brown smoke |

### 3.3 Mood touches (code)

These are cheap, and they matter more than any texture.

- **Dust that hangs**:
  - `effects.wind` set to a wind from the west, (1.2, 0, 0.3) at rest and up to (2.6, 0, 0.6) in
    gusts.
  - Every ~0.6 s, `effects.dustRegion` over a random 4 × 1 × 3 m patch of the street at 0–1.2 m,
    amount 3–6, colour 0xd6c19c. More in a gust (§7).
- **Tumbleweeds**: 3 props made in code: ~280 fine twigs (bent three-sided tubes, r 6–10 mm,
  packed toward the core, pale straw-grey outside and darker within) in one geometry, colliding as
  a ball of 32 points, each copy its own shade. The wind pushes them toward its speed each readback
  (`d.push`), so they roll east down the street, bump into what's there and hop now and then; past
  x = +45 they come back in at the west end. Blasts throw them.
- **Forge smoke**: a thin grey puff off the smithy's coals every half second or so
  (`effects.puff`), while the coals lie in the hearth.

### 3.4 Palette

| Use | Colours |
|---|---|
| Ground, dust, haze | Dirt 0xc9a77c, street 0xd3b994, haze 0xd9c9ad |
| Siding tints (multiply a pale, part-bare paint map) | Faded oxblood 0xc48a78 (saloon), mustard 0xd9bb7c (store), sage 0xa9b79f (barber), dusty blue 0xa7b5c0 (hotel), bone 0xf0e6d2 (sheriff), weathered grey 0xc9c3b8 (outhouse, crates) |
| Trim | Bone 0xf2ead8, dark green 0x5f6f58 (barber, bank doors), oxblood 0x8a4a3c |
| Timber | Untinted, with ±6 % per-piece tint variation, and each piece's own texture frame (moved up to 1 m, every other one turned half round) so knots don't line up across a deck |
| Tin | Per-sheet tint 0xf0f0f0 … 0xe6ddd2, one sheet in six toward the darker end; the map's streaks carry the rust |
| Adobe | 0xffffff and 0xf2e2cc |
| Brick | 0xead2bc |

### 3.5 Signs: an atlas drawn in code (no generation)

The `signpaint` surface is a 2048 × 1024 `CanvasTexture` with 8 cells (4 × 2). Each cell is a
weathered painted board:

- a background colour
- a 4-px border
- one pictogram in the middle: tankard (saloon), razor and comb (barber), coin stack (bank), bed
  (hotel), sack and barrel (store), six-point star (sheriff), horseshoe (livery), anvil (smithy)
- two rows of meaningless brush strokes either side, which read as lettering from the street but
  aren't letters

Add canvas noise and flaking (random light speckle) so it matches the siding's weathering.

Each sign piece's `textureFrame` is offset so its front face lands on its own cell. The front face
uses (x, y) in the piece's frame.

## 4. Textures to generate (6 sets, GPT Image 2.5)

All prompts use `tex()` and state the frame's real size. Make each paint layer pale and neutral, so
the per-piece tints give the colours.

| Set | What it is | Frame (real size) | Processing | Used by |
|---|---|---|---|---|
| `western_siding` | Horizontal lap siding (clapboard): boards 15 cm exposed, each lapping over the one below with a thin shadow line under its lower edge. Old chalky **off-white** paint, cracked and peeled from about half the surface, showing silver-grey sun-bleached wood with strong grain along the boards. Drip stains and nail heads. Boards perfectly straight and level | 1.0 × 1.0 m (about 6.5 boards), cut to **exactly 6 boards = 0.90 m** | **boards, custom**. Rotate 90°, then `lay_boards(…, 6)`. Wrap rows. Rotate back. Height: paint raised, bare wood with grain along the boards, a dark lap groove at each board's lower edge (asymmetric: lit top edge, shadowed underside) | `siding` surface, `uvScale 1/0.9`; crates; outhouse |
| `western_timber` | Rough-sawn, sun-bleached weathered timber surface, grey-brown to silver. **Grain running top to bottom.** Checks and cracks along the grain, a few knots, nail holes with rust stains, saw marks. No board gaps, no paint | 1.0 × 1.0 m | **generic** (`generic(a, rough=0.82, nz=0.92)`), with the overlap cut only, so the grain direction is kept | `timber` surface (posts, beams, decks, barn walls, barrels, troughs); `hay` (tinted, `uvScale 3`) |
| `western_tin` | Old corrugated galvanised iron roofing sheet. Dull grey zinc with a mottled bloom, patches of orange-brown rust heaviest along nail lines and the lower part, streaks running down the ridges. **Corrugations vertical**, 7.6 cm pitch | 1.0 × 1.0 m (13 ridges) | **custom**. Find the ridge period from the column profile (as `wood_painted` finds board gaps). Resample to exactly 13 periods across. Height = a cosine of the ridge phase (the true corrugation profile) plus fine rust relief. Metalness 0.85 where not rusty, 0.1 on rust. Roughness 0.45 zinc / 0.85 rust | `tin` surface, `metalMap: true`, `uvScale 1` |
| `western_adobe` | Adobe wall: hand-smoothed earthen mud plaster, warm tan-ochre, with fine shrinkage cracks, straw flecks, rain-eroded patches showing the mud bricks beneath (about 40 × 10 cm faces), and darker damp-stain tide marks at the bottom edge only faintly | 2.0 × 2.0 m | **generic** (`generic(a, overlap=128, rough=0.92, nz=0.9)`) | `adobe` surface, `uvScale 0.5`; its broken faces through `insideMap 0.7` |
| `western_dirt` | A packed, dry desert dirt road seen from straight above. Pale tan-ochre compacted earth, fine cracks, small pebbles and grit, faint hoof prints, scattered straw bits. No directional tracks | 4.0 × 4.0 m | **generic** (`generic(a, overlap=160, rough=0.95, nz=0.95)`) | Scenery ground (street, lot, desert), 1 repeat per 4 m |
| `western_splinter` | The inside of freshly broken old pine, straight on. Pale cream-yellow torn wood fibres and long splinters along the grain (top to bottom), darker weathered streaks at the edges, a few nail holes | 0.5 × 0.5 m | **generic** (`generic(a, rough=0.8, nz=0.9)`) | `insideTexture` of `siding`, `timber`, `signpaint` (`inside('western_splinter', 2, { base })`) |

Base textures reused (no cost):

- `brick_wall_005` and `gen_brick_broken` (bank)
- `concrete_wall_008` and `gen_concrete_broken` (sandstone trim, tinted)
- `gen_iron_painted` (iron)

**GPT Image budget (12):** 6 texture sets and 4 prop concepts = 10. That leaves **2 spares**, one
regeneration each for the two worst results. Look at the previews before spending one.

## 5. Props (4 Meshy models)

Props are thrown whole and never break. Their concepts use `concept()`: no lettering, no badges.

| Name | What | Real size (`fit`, `metres`) | Mass | Material (sounds) | How many, where |
|---|---|---|---|---|---|
| `wagon` | A weathered buckboard freight wagon: a grey sun-bleached plank box bed, a bench seat with an iron rail, four tall wooden spoked wheels with iron tyres (rear bigger), the tongue resting on the ground, no horse, no canvas | `length` 5.2 (with the tongue) | 0.7 | `timber` | 2: (-27.0, 0, +4.5) turned 20° off the street (foreground right at the start); (+9.5, 0, -4.8) along the street outside the livery |
| `safe` | A cast-iron floor safe: black with a faded dark-red panel and thin worn gold pinstripe border (no lettering, no emblem), a dial and a handle, on four small castor feet | `height` 0.95 | 0.6 | `iron` | 1: inside the bank against the back wall, (+5.5, 0.40, +18.6), `loose: true` |
| `pump` | A cast-iron pitcher hand pump on a short square weathered timber post, curved handle up, spout over nothing | `height` 1.3 | 0.06 | `iron` | 2: at the trough outside the livery (+5.6, 0, -6.2) and outside the saloon (-19.5, 0, +6.2), clear of the trough (x -19 … -17) and the rails |
| `rocking_chair` | A plain wooden porch rocking chair with spindle back, weathered unpainted wood | `height` 1.0 | 0.012 | `timber` | 4 on boardwalks (`loose: true`, y 0.40): hotel (+12.0, +8.6) and (+14.4, +8.6), sheriff's (-7.6, -8.6), barber (-9.6, +8.6) |

Place props as Brick Street does: test each prop's collider against standing pieces and skip any
that overlap. Face fronts to the street.

As built: Tripo P2, not Meshy. Each collides as convex parts welded together (`parts` in
`props.mjs`): the wagon's bed, a drum across each pair of wheels and its tongue (one hull had been a
wedge out to the tongue's tip); the pump's post and body, its lever, its spout; the rocking chair's
seat and back, and each runner, so it rocks. Each copy has a tint of its own (the livery's wagon
more bleached, the chairs from different years).

## 6. Sounds (13 new, 36 takes, 4 kept for redos)

Use `sound`, `fx` and `foley` from `../../sounds.mjs`. Every prompt says no music. The `negative`
for all of them is the default `NO`.

| Name | Intent of the prompt | Kind, space | Takes, s | `play` | Used by |
|---|---|---|---|---|---|
| `ambience.desert` | Hot, still desert at midday: a dry wind breathing over open ground, a sand hiss, a faint high insect drone (cicadas) far off. No birds, no traffic, no voices | loop, head | 2 × 45 | `bus: 'ambience'`, `volume 0.35`, `reverb 0` | Ambience, `high 0.6` |
| `sign.creak` | A wooden sign hanging from rusty iron hooks swinging in the wind: slow squeaks of rusty metal and a soft wooden knock | shot, world | 3 × 3 | `near 3`, `volume 0.45`, `voices 2`, `cooldown 2.5`, `spacing 6`, `reverb 0.2` | The hanging signs, on gusts (§7) |
| `windmill.loop` | An old farm windmill turning in a steady wind: a rhythmic clank of the pump rod, a squeak of the gearbox, a rattle of the tail vane, regular and repeating | loop, world | 2 × 12 | `near 4`, `volume 0.55`, `voices 1`, `reverb 0.25` | At the windmill head; stops when it falls |
| `hawk.cry` | A single red-tailed hawk's raspy, descending scream, far off over open desert, a little echo | shot, world | 3 × 4 | `near 30`, `rolloff 0.4`, `volume 0.5`, `voices 1`, `cooldown 20`, `reverb 0.6` | Played far away now and then (§7) |
| `bell.toll` | One strike of a small bronze mission bell outdoors: a clear bright clang, a long ringing decay | shot, world | 3 × 7 | `near 10`, `rolloff 0.6`, `volume 0.8`, `voices 3`, `reverb 0.5`, `pitch [0.97, 1.03]` | Alarm tolls after blasts; the `bronze` material's impacts |
| `birds.flush` | A small flock of doves suddenly taking off: a burst of wing flaps, fading away | shot, world | 2 × 3 | `near 6`, `volume 0.6`, `voices 2`, `cooldown 10` | Birds leaving the roofs after a blast |
| `wood.splinter` | Dry, sun-baked old pine boards and a post snapping: a sharp dry crack, splintering, nails tearing out | shot, world | 4 × 2 | `near 4`, `volume 0.75`, `voices 5`, `cooldown 0.05`, `spacing 2` | Break: `siding`, `timber`, `signpaint` |
| `timber.crash` | Heavy timbers and a pile of planks crashing down onto dry dirt: a deep wooden thud and the clatter of boards | shot, world | 3 × 3 | `bus 'debris'`, `near 6`, `volume 0.75`, `voices 3`, `priority 2` | Heavy impact and collapse: wood |
| `timber.creak` | An old wooden frame building straining: long groaning creaks of timber, nails squealing, boards cracking. Ominous | shot, world | 3 × 3 | `bus 'debris'`, `near 6`, `volume 0.6`, `voices 2`, `cooldown 1.5`, `spacing 10` | Strain: wood |
| `tin.impact` | A sheet of corrugated tin roofing landing flat on hard ground: a rattling metallic clatter with a wobbling boing | shot, world | 4 × 1.5 | `bus 'debris'`, `near 4`, `volume 0.5`, `voices 4`, `pitch [0.85, 1.15]` | Impact and debris: `tin` |
| `tin.crash` | A corrugated tin roof tearing loose and crashing down: loud rattling, sheets banging together, nails ripping | shot, world | 3 × 3 | `near 6`, `volume 0.8`, `voices 3`, `priority 2` | Break, heavy impact, collapse: `tin` |
| `adobe.break` | A thick adobe mud-brick wall breaking: a dull crumbling crunch, dry earth and dust pouring down | shot, world | 3 × 2.5 | `near 5`, `volume 0.75`, `voices 4` | Break: `adobe` |
| `steps.dirt` | Boots walking on dry packed dirt and grit at a steady pace, separate steps with short gaps | slice, head | 1 × 8 | `volume 0.3`, `voices 2`, `pitch [0.95, 1.05]`, `reverb 0.15` | Footsteps `hard` |
| `steps.boards` (as built) | Boots on a hollow boardwalk: mixed from the `steps.dirt` take (grit cut, a board's thump and knock raised, the hollow's short echoes), no generation | slice, head | 1 × 8 | as `steps.dirt` | Footsteps on `timber` that stands (`footsteps.surface`) |

**Takes:** 2+3+2+3+3+2+4+3+3+4+3+3+1 = **36** of 40. Keep 4 for `--redo` after `qa-sounds`.

**Sounds by material** (`audio.materials`):

| Material | Sounds |
|---|---|
| `siding`, `timber`, `signpaint` | `{ break: 'wood.splinter', impact: 'wood.impact', heavyImpact: 'timber.crash', debris: 'wood.impact', strain: 'timber.creak', collapse: 'timber.creak', land: 'timber.crash', settle: 'dust.settle' }` (`wood.impact` and `dust.settle` are base): a section let go groans, and crashes once as it lands. As built, `stave` at pitch 0.85, `signpaint` and `hangboard` 1.1, `paint` 1.2 (`MaterialSounds.pitch`) |
| `tin` | `{ break: 'tin.crash', impact: 'tin.impact', debris: 'tin.impact', strain: 'metal.bend', collapse: 'tin.crash', land: 'tin.crash', heavy: 0.02, pitch: { land: 0.85 } }`: a sheet clatters, a slope tears loose with a crash and lands with a lower one |
| `adobe` | `{ break: 'adobe.break', impact: 'brick.impact.small', heavyImpact: 'brick.impact.large', debris: 'brick.debris', strain: 'structure.creak', collapse: 'collapse.rumble', land: 'brick.impact.large', settle: 'dust.settle', pitch: { land: 0.8 } }`. Base masonry fits adobe's thud and grind |
| `brick` | `packMaterials.brick`, with `land: 'brick.impact.large'` |
| `stone` | `packMaterials.concrete` |
| `glass` | `packMaterials.glass` |
| `iron` | `packMaterials.metal` |
| `bronze` | `{ impact: 'bell.toll', heavyImpact: 'bell.toll', collapse: 'metal.impact.large' }` |
| `hay` | `{ debris: 'dust.settle' }` (soft; nearly silent is right) |
| `coals` (as built) | brick debris and small impacts at pitch 1.4: clinks |

- **Ambience:** `[{ sound: 'ambience.desert', high: 0.6 }, { sound: 'ambience.wind', high: 3.5 }]`
  (base wind for the rooftops; a gust swells it, §7).
- **Footsteps:** `{ hard: 'steps.dirt', rubble: 'steps.rubble', land: 'player.land' }`, and on standing
  timber (boardwalks, floors) `steps.boards`.
- **Base sounds reused as they are:**
  - explosions (near, far, debris)
  - glass, metal, brick and concrete
  - `wood.impact`, `collapse.rumble`, `structure.creak`, `dust.settle`
  - `steps.rubble`, `player.land`, `ambience.wind`, `fire.loop` (unused)
- **Not used here:** `ambience.city`, `alarm.car`, `siren.far`.
- **No music anywhere.** No piano, no guitar, no whistling.

## 7. Reactions (`onBlast`, `onImpact`, `update`)

1. **Gusts.** A slow wind value `w(t)`, the sum of three sines at 0.05–0.23 Hz, runs from 0.3 to
   1.4. It drives:
   - `effects.wind`
   - the windmill's spin, and the loop's volume and rate (`setVolume`, `setRate`: the clank
     quickens)
   - the hanging signs' lean, the tumbleweeds' roll
   - dust lifted from the street

   Each time `w` rises through 1.0, it lifts a long dust streak (`dustRegion` along 12 m of street
   upwind of the player, amount 10), creaks and pushes the two signs nearest the player
   (`sign.creak` at each) and swells the ambience's own `ambience.wind` loop (`rt.ambience`,
   `setVolume(1.7)` over 1.4 s, back over 1.6 s).
2. **Hanging signs.** Seven signboards hang under their brackets: `hangboard` pieces on hinges
   along the arms (`d.hinge(board, anchor, axis, { to: arm })`), their chains drawn riding the
   boards. The wind pushes each across its face every readback, buffeted (they lean a few degrees,
   up to 15 in a gust); blasts within 20 m push them away; one in a blast is thrown by it. When the
   arm falls the sign goes with it; when the arm breaks, it falls and breaks where it lands. A round
   shatters a board: under each chain the biggest cell that can still be cut hangs on from the arm,
   swung away from the shot, with a creak.
3. **The bell.** It hangs on a hinge along its yoke. On a blast within 45 m of the chapel, while it
   still hangs, schedule 3 tolls 1.7 s apart, starting 2–3 s after the blast: someone ringing the
   alarm, the bell swinging with each (`d.push`). They come at most once per 25 s.
   - Once the bell comes loose, its landings toll through the `bronze` material. In `onImpact`, a
     bronze piece faster than 3 m/s also gets `effects.impact` sparks.
   - After that the town is silent: no more alarms.
   - A round into the bell rings it (`bell.shot`, at the toll's pitch) and swings it; a burst of
     2.5 s or more within 45 m brings out the alarm as a blast does.
4. **Birds.** 12 doves as one instanced mesh (dark grey, two flapping quads each) perch on the
   saloon's ridge and the water tower's roof.
   - On any blast within 40 m: `birds.flush` at the flock. They fly off in a loose arc (simple
     steering toward a point 120 m away and 30 m up), circle, and come back after about 50 s if
     their perch still stands. Otherwise they settle on whatever's highest and still standing.
   - The gun: as a burst goes on, those within 8 m, and 1.2 m more a round, of the gun or of where
     its rounds strike (at most 40).
5. **Hawk.** It sits on the windmill's platform (else a telegraph pole). A blast, or the fourth round
   of a burst, puts it up crying: it climbs away from the noise and circles the town at about 50 m,
   crying every 35–80 s, and comes back down to its perch 55–85 s after the last noise: over the
   town from above to 6 m over the perch on its street side, then down onto it, clear of the
   false fronts and the windmill's wheel, boom and vane.
6. **Windmill.** The wheel mesh spins at `0.6 + 2.2 w` rad/s and follows the gearbox piece's pose.
   `windmill.loop` plays at the head.
   - When the gearbox isn't `'fixed'` any more: stop the loop (`stop(0.2)`). The wheel stops
     spinning and rides the gearbox down. Its landing clangs through the `iron` material.
7. **Dust kicks.** In `onImpact`, any loose piece or prop that strikes the ground (`other === null`)
   with `impulse > 2` throws up a puff: `effects.dust(at, min(1.5, impulse × 0.05), 0xcdb48e)`.
   Wagons, safes and falling false fronts raise dust from the street. Rate-limit this to 6 a second.
8. **Sparks.** In `onImpact`, `iron` and `bronze` faster than 4 m/s also get `effects.impact(at,
   [0, 1, 0], 0x6a5a50)`. (Tin is heard by its material, §6.)
9. **Tumbleweeds.** On a blast within 8 m (and out of its reach), a tumbleweed is pushed away from
   it (6–10 m/s, upward), and is rolled on by the wind again. East of x 0, and north of z 1.5 west
   of it, the wind's drift north gives way to a pull toward the street's middle: the chapel closes
   the street's north half at its east end (all three jammed against its front within a minute),
   and the wagon by the start stands from z 2.5 (those coming in again at the west drifted into it
   and stayed, 9 m from a player at the start). One that gains under 0.5 m east in 4 s is caught on
   something: once it's over 25 m from the player it comes in again at the west. A round makes one
   hop (2.2–3.4 m/s up) on top of the round's own push.
10. **Landings.** A section of 0.5 or more landing in the street (`'landed'`: a front, a roof slope,
   the tank) slaps up a sheet of street dust, bigger the heavier and faster.
11. **The water tower's water** (`water.ts`). A round into the tank's staves under the waterline
   leaves a hole that spurts a thin stream (Torricelli's speed, less a fifth) onto a wet patch, the
   level falling with every hole; six streams at most; the tank bursts and spills what's left once
   its bottom or a third of its wall goes, or it comes down.
12. **Out of town.** Nothing is taken out: the library holds what's thrown to 40 m/s and its steps
   to that, so the farthest board of a collapse lands 60–90 m out in the desert, and stays. (Until
   phase D the solver could fling a piece kilometres, and anything past |x| 70 or |z| 60 was taken
   out, with `destruction.maxSpeed` 35.)

## 8. Library requests

Every request this world made (heat haze, grain in wood fracture, hinges, pushing what rests,
footsteps by surface, `Voice.setRate`, cutting bonds and letting sections go, a speed cap, a
background sky and the sun's height, a warm-up, `audible` per material, glass that writes depth, the
loose pieces and their `'state'`, one breaking budget, rubble that wakes when its support goes) is
in the library or the demo now (`docs/changelog/phase-c/`), and this world uses each. Open:

1. **Prop parts on hinges.** A wagon's wheels are welded drums: thrown over, it doesn't roll on
   them. Wanted: a prop part held to the first by a hinge (`PropModel.parts[i].hinge: axis`), so
   wheels turn.
2. **A lighter weighing after a blast.** The first blast's worst frame here is the library's
   weighing (7–17 ms a call, a dozen calls in the second after it, as in Brick Street).

## 9. As built (changes from the plan above)

- **Sky.** Goegap still lights the town, but the background is `qwantani_noon_puresky` (also Poly
  Haven, CC0, `sky.backgroundHdri`), its sun turned onto the light's. Goegap's hills stood up to 20°
  high, sharp behind the mesas, and no haze skirt could hide them. The haze skirt is 150 m tall, and
  the fog reaches 640 m.
- **Light.** Sun 3.7 at 65° (`sky.elevation`) and exposure 1.0 (4.0 and 1.05 rendered the street
  nearly white), hemisphere fill 0.17, so noon shade is deep (shade on the dirt about 0.65 of
  sunlit, was 0.85) and the zenith a clear blue (background 1.05). Environment 0.12 with a fill of
  2.4 from the shaded side (the runtime team's retune once the sky was turned the right way: the
  look was made with the sky's sun lighting the shade). A grade (saturation 0.92, contrast 1.05,
  warm tint, vignette 0.1).
- **Support.** Siding `support` is 25 and timber `support` 60, not 70 and 150. At those values a
  bay hangs from its posts at a few percent of capacity, so fronts stayed up with their whole
  ground floor gone. Siding `strength` is 1.5e3 (5e3 landed a front as one 12 × 9 m sheet), so a
  fallen front lands in boards and panels. Siding `maxPieces` 4 and `minBodySize` 0.16, timber
  `maxPieces` 4 and `minBodySize` 0.12, both split along the grain: splinters are particles, so
  four rockets along the saloon leave 8,830–9,040 pieces (a blast's cells under `minBodySize` are
  particles wherever they are since phase D).
- **False fronts and roofs.** The first rafter pair stands 4 cm off the false front and is tied to
  it by two bonds (the kicker braces). The tin sheets stop 2 cm short of it. Face contact along the
  whole width had held undermined fronts up.
- **The water tower's topple** is scripted in `life.ts`: two legs can hold the tank, and a top cut
  loose settles on the stubs (checked again with the library's weighing that knows moments: it
  still does). Once two legs are cut, a moment later everything over the lowest joints is let go
  as one section turning over toward the cut legs at 0.5 rad/s (`d.release`). The tank, floor, roof
  and spout are `stave`, timber with weak joints (`strength` 250, `impact` 6), so it bursts into
  staves where it lands.
- **The water tower's legs** lean in 4°: each length is a hull whose faces run from its square at
  the foot to its square at the head, and the girts, the ladder's rails and rungs have their ends
  in the legs' faces (so they still bond face to face).
- **Iron** `minSize` is 0.45, so the gearbox and the stove don't splinter. The bars are thin anyway.
- **Hawk.** It cries 45 m out and 35 m up, as the sound report advises, not 120 m out.
- **Signs.** One atlas of 8 rows (7.2 × 0.9 m each), with lettering-like marks that are blobs,
  stems, waves, crescents and dots, never letters, and over them four rows of the hanging boards
  (1.0 × 0.45 m), two to a row, centred where a box's two faces see the same patch (u = 0 across the
  wrap, and the middle): `uvScale` [1/7.2, 1/9.0]. The hanging boards are pieces on hinges, their
  chains drawn.
- **Pieces.** About 7,570 at load (plan: 6,040; §2.9). The false fronts came out over budget, with
  boardwalk planks at 0.40 m and sheets up to 1.9 m; barrels with hoops and bales with twine add
  about 360. Idle frame times match Brick Street's on the same (shared) GPU, so the fronts kept
  their planks.
- **Two-storey fronts** (saloon, hotel). The upper storey's side walls stand 5 mm off the front
  and are tied to its corner posts on every other course (`d.bond`, 0.012 m²). The balcony's
  joists, deck and end rails stop 2 cm short of the floor band, its joists tied by 0.01 m² bonds;
  a two-storey awning's boards stop 2 cm short too. The library now brings an undermined front
  down by itself, but straight down onto its stubs and porch. `life.ts` watches each front's
  ground-floor posts: once 60% are gone, the porch's posts are hit, and once those hits are broken
  (half a second at least) the front's ties to the rest are cut (`d.unbond`) and it's let go as one
  section turning out over its foot at 1.1 rad/s (`d.release`), so it falls flat into the street.
  What its porch posts held (the balcony or awning) goes with it: with phase D's library a porch
  whose posts were hit could stay up, hung off the building, and the balcony's end railings stopped
  the front turning, so it stood up on the rubble in 5 runs of 9 (it lay in the street in 8 of 8
  with the porch). What of it came loose before was pushed into the same turn too; that made no
  difference to where those pieces lay (one or two of some 20 a run out in the street either
  way), so it went. What of the front still stands upright more than 2 m up on the rubble 2 s and
  4 s after the let-go (a part the library let go straight down while the porch posts were being
  hit) is cut loose and pushed over its foot: in twelve runs it found such a part in nine, and of
  the six with it off, one left a 2 m panel standing on the rubble. Before,
  the ties were cut by small hits (splintering at each), and a strip of front whose corner ties
  held could freeze standing as a 9 m stack of rubble boards (2 of 3 runs). With the library's
  freezing and waking rules and the let-go as one section, no strip of front stood in ten runs of
  four rockets along it; in some, a panel that broke loose early fell back into the building and
  lies against the roof's timbers, or the west side wall's first bay stays on as boards at rest
  (from outside, the side wall still standing).
- **Side and back walls** of the two-storey buildings are watched the same way: once 60% of a
  wall's ground floor (its courses and posts) is gone, the floor band along it is hit, then it's
  let go turning out away from the building (0.8 rad/s); the roof, losing its plates, drops.
  Without the turn, the upper storey dropped a few cm onto the ground floor's remains and stood
  there. A ground-floor bay blown out (60% of its pieces) has the band over it hit.
- **One-storey fronts** have their corner posts bonded to the side walls' end boards on every
  course (0.05 m² more), so one rocket at the door takes its bay and not the front, and are tipped
  into the street once 40% of their ground-floor posts are gone (three rockets along the store).
- **Timber texture frames.** Timber is jittered across its map (`uvJitter: 1`): equal panels had
  shown the same knots on a 1 m grid. Planks (boardwalk, awning, balcony) are laid as beams, long on
  their texture frame's y, so they split along their length. Awning roofs are boards 0.6 m wide,
  5 mm apart.
- **Siding paint.** A building's tint goes only where the siding's map still has paint (`tintMask`,
  a mask from `textures.py`), so the bare boards stay grey; the paints are a little deeper than the
  plan's to read the same from the street (saloon 0xc49a8a, store 0xd0ab5e, barber 0x95a689, hotel
  0x93a4b1, sheriff's 0xece0c7). The saloon's deeper 0xb66f59, darker than the bare wood between
  its flakes, read as red brick from across the street; the mask is blurred 5 px and lets 35% of the
  tint onto the bare wood too.
- **Barrels** have eight bellied staves (0.26 at the heads, 0.30 at the middle) and two hoops of
  eight `paint` segments each (dark tint). Iron hoops, thin and seven times denser than the staves,
  were flung by the solver; in phase D they weren't, but they stay whole and a blast threw 21-25 of
  160 over 15 m (the farthest 66-81 m, three runs), where paint ones break and land within 14 m.
- **Bales** are three slabs of one shade with two 8 mm twine strips between them (they show on
  the top and the ends, as a bale's two strings do). The `hay` surface is straw drawn on a canvas
  (outlined stalks along the piece's x, clumps lighter and darker) with a normal map from it; the
  timber map, tinted, had read as cardboard.
- **Doors** are three upright boards a leaf, with two battens and a Z-brace on the outer face, a
  shade lighter than the paint so they read in the porch's shade, and a brass knob.
- **Street dust** is paler than the dirt (0xeadcc4), a puff per cubic metre of its region so puffs
  stay about 4 m across and under 4 m high, and never on the player (the gust's streak runs on the
  far side of the street): bigger, browner puffs had read as smoke against the sky.
- **The water tower's roof** is 16 thin wedges, a few mm apart, tied by small bonds, so it lands
  in slices rather than rolling as one cone.
- **Scenery.** The three buttes narrow to their tops, with talus to a third of their height and
  notched tops. Mesas and buttes shade smoothly, hard only at a ledge's shelf and the cap rock's
  rim, and their normals are bent by noise (lumps and bands along the beds); flat facets had read
  as placeholders next to the textured town. The outskirts (40–80 m out) have boot hill, a stock pen, a ruined adobe corral and
  a broken wagon wheel.
- **Saloon interior.** Tables on four legs, nine stools, a dark top, kick board and panel strips
  on the bar, a brass foot rail, brighter bottles and mirror. Floors indoors are tinted 0xb8a890:
  the sky's light isn't shut out indoors. The store's twelve shelf boards carry tins (`paint`
  octagons), jars, small crates and sacks, about 40 pieces.
- **Tin sounds** come from the material (`audible 0.001`, §6): four rockets along the saloon
  played 52 sheet clatters and 5 crashes (the roof slopes tearing loose and landing), with 22
  sections landing (`'landed'`) in all.
- **Props** rest until woken (not `loose`), including the safe and the rocking chairs, and collide
  as welded parts (§5). The tumbleweeds are props too (§3.3).
- **Hinged pieces.** The seven hanging signs, the saloon's batwing leaves (2.5 cm off the jambs, so
  their edges turn clear) and the bell (one hull: waist, lip and a crown up to the hinge, whose
  slope lets it swing 35° each way under the yoke) hang on `d.hinge`. They're `stats.hanging` (10),
  not counted moving once at rest: standing, the HUD's 3 moving are the tumbleweeds.
- **Round shading.** Eight-sided pieces (vigas, telegraph poles, the barber's pole, balusters,
  bottles, tins, stools, the stove pipe, the anvil's stump) and the bell shade round (`smooth`).
- **The forge** has a bed of glowing `coals` (§2.10) that smoke a little (§3.3).
