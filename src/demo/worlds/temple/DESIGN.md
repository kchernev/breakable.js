# Sun Temple: design

A Doric sanctuary on a limestone promontory at midday, 62 m above the sea. A peripteral marble
temple faces east over its altar; a treasury stands north of it, a round tholos with a dome to the
south-west, the ruin of a stoa along the north edge. Cypresses and olives, dry grass and pale rock
underfoot. The sea is to the west and north with islands in the haze; dry hills inland to the
east and south. The sun is high in the south-south-east, so the east front is lit at a graze, the
south flank is in full sun, and the colonnade throws striped shadows onto the cella wall.

This is the plan the builder and the asset makers follow. Numbers are metres unless stated.

## 1. The place

### Frame and axes

- x is east, z is south (three.js: -z is north). y up. The plateau is flat at y = 0 over the whole
  breakable area: x -32..35, z -28..26 (67 × 54 m).
- Sea level is y = -62. Cliffs drop to the sea past x = -36 (west) and z = -32 (north). To the
  east and south the ground falls gently and rises again into inland hills.
- The player starts just inside the gate on the east side, at feet `[28, 0, 4]`, looking at
  `[-4, 5, -4]` (the temple, a little left of its middle). From there, left to right: the tholos
  far left (47 m), the bronze statue in front of its exedra (16 m), the temple's east front and
  south flank (30 m), the altar (15 m), the treasury behind it (32 m). Behind all of it the sea and
  the islands. Turning right shows the stoa ruin and the votive column against the sea.

### Plan

```
 z
-30 ......................... north cliff (z -32) ................................
        cyp     TREASURY (faces E)            STOA RUIN  o o o . o x o o o (z -20.5)
-24  .         [-3.8..7.8 × -24.8..-17.2]     back wall z -26.5 ........|
-18  olive                    pedestal         drums  capital       |  east return
                 fallen column                         * votive col (21,-12)
-12           ______________________________  lion                 |
 -6  cyp     |  TEMPLE  6 × 11 Doric        |=ramp=  ALTAR  tripod  |
  0  cyp     |  x -16.7..8.7, z -11.2..3.2  |  lion  (15.5,-4)      | PROPYLON (34, 4)
  6          |______________________________|         stelai        |  gate   <- player (28, 4)
 12      THOLOS (-21, 15)    olive          EXEDRA + STATUE (13, 9) |
 18      r 6.6                        olive          olive          |
 24  ............... temenos wall z 24 (south) ..........................|x 34
     x: -32        -16          -4           8          20          34
```

### What stands where (world coordinates)

| Thing | Where | Size | Notes |
|---|---|---|---|
| Temple (hero) | centre (-4, -4), long axis x, front east | lowest step 25.4 × 14.4; columns 6 × 11; ridge ≈ 10.5 high | Section 2.1 |
| Ramp to the temple | x 8.7..12.0, z -5.6..-2.4 | rises 0 → 1.05 | scenery, on the axis |
| Altar | centre (15.5, -4) | 2.4 (x) × 6.0 (z) × 1.3, a step on its west side | limestone core, marble crown |
| Lions (props) | (12.6, -8) and (12.6, 0), facing east | 1.9 long | flank the foot of the ramp |
| Tripods (props) | (15.5, -8.6), (15.5, 0.6), and on top of the votive column | 1.5 tall | ring when thrown |
| Votive column | (21, -12) | D 0.7, 8.4 tall, on a 1.4 square base block | a tripod on top |
| Treasury | centre (2, -21), long axis x, front east | stylobate 10.4 (x) × 6.4 (z); ridge ≈ 7.2 | Section 2.2 |
| Stoa ruin | column line z -20.5, x 13..32.2 (9 positions at 2.4) | platform x 11.8..33.6, z -27.2..-19.6 | Section 2.3 |
| Tholos | centre (-21, 15) | platform r 6.6; dome top ≈ 9.5 | Section 2.4 |
| Statue base + bronze statue (prop) | (13, 9), statue facing east-south-east | base 2.2 square, top at 2.1; statue 2.4 | the foreground landmark |
| Exedra | centred on the statue, r 3.5, the arc on the west side (90°..270°) | bench 0.5 high, 0.6 deep | limestone |
| Propylon (gate) | centre (34, 4), passage along x | 5.4 clear, 5 deep, ≈ 6 high | Section 2.5 |
| Temenos wall | east: x 34, z -19..24 (gap z 1..7 for the propylon); south: z 24, x -31..34 | 1.4 high, 0.6 thick | ruinous in places |
| Sacred way | paved strip from the propylon (34, 4) west to x 17, then to the altar and the ramp | 3 wide | scenery (limestone flags) |
| Stelai (4) | (26, 1.5), (26, 6.5), (21, 1.5), (21, 6.5) | slab 0.55 × 1.7 × 0.18 on a base | line the sacred way |
| Empty pedestals (2) | (10, -15.5), (-13, 13) | 1.0 square, 1.4 high | statues long gone |
| Amphorae (props, 7) | by the stoa (30.5, -23), (31.2, -23.6), (29.8, -24.1); by the treasury door (9.2, -19.4), (9.6, -22.8); by the altar (18, -6.5) lying; by the tholos door (-14, 17.5) | 1.05 tall | |

Fallen fragments (marble, lying on a facet so a face rests on the ground):

- North of the temple, a toppled column: 4 drums in a loose line along x at z -14, x -13..-9.5,
  and its capital (abacus down, echinus on it) at (-8.6, -14.3).
- South of the stoa where column k=4 (x 22.6) stood: 5 drums scattered over x 20..26, z -18..-15;
  one capital; 2 architrave beams flat at (24, -17.5) and (27, -16.8); one geison block.
- West of the tholos: 2 drums at (-29, 2) and (-27.5, 3.5).

Trees (x, z, height):

- Cypresses (16): gate pair (30.5, -0.5, 9.5), (30.5, 8.5, 10); tholos group (-30, 9, 10.5),
  (-31, 15, 9), (-29.5, 21, 11); (-10, 9, 9); treasury back (-6, -27, 10), (-1, -28, 8.5); along the
  south wall z 21.5 at x -6, 2, 10, 22 (heights 8..11); (35, -16, 9); west of the temple
  (-22, -8, 10.5), (-24, -2, 9); north-west cliff (-18, -26, 10).
- Olives (12): (4, 13), (19, 15), (25, 18), (-4, 16), (-12, 20), (-28, -14), (-22, -20), (-30, -2),
  (27, -8), (12, 19), (-8, -16), (24, 12).

### Unbreakable scenery (scenery())

- **Plateau**: a ground mesh of the dry grass texture (`temple_ground`, 4 m tile) mixed by noise
  with bare pale bedrock (Poly Haven `marble_rock_01` or `marble_cliff_03`, see 4), more rock near
  the cliff edges and where feet wear it (round the temple, along the sacred way). Physics: fixed
  boxes covering the plateau only (x -36..60, z -32..60, top at 0), not past the cliff edges.
- **Crepidomas** (the steps under the buildings): the temple's two lower steps (0..0.35 and
  0.35..0.70) are scenery boxes drawn with `temple_marble`; the top step (the stylobate) is static
  pieces (see 2.1). The treasury's lower step, the stoa's platform and the tholos's two lower round
  steps likewise (round ones: `world.addHull` of a 16-gon, drawn with 48 sides).
- **Cliffs** west and north: rough pale limestone faces (marble_cliff texture, triplanar or box
  UVs), ledges and screes, down to the sea. A fixed box at y -62 (the sea floor) catches what rolls
  off the edge.
- **Slopes and hills** east and south: the plateau falls to about -20 at 150 m and rises into
  rolling hills at 300..1000 m (dry ochre with dark macchia patches), mountains at 1.5 km in the
  haze. Instanced low olive clumps (unbreakable, simple blobs) on the south slope 60..250 m out.
- **Sea**: a plane at y -62 out to 8 km. TSL: deep blue `0x1b4a6e`, lighter turquoise
  `0x2f7f96` within 60 m of the cliff foot, a fresnel blend to the sky colour at grazing angles,
  slow moving normals (two scrolled noise layers), a sun glitter path, a thin foam band where the
  cliffs meet it.
- **Islands**: 5 low silhouettes at 800..1400 m to the W, NW and N, 60..220 m high (displaced
  cones and ridges, colour `0x8f948a`). The fog turns them into pale blue shapes.
- **groundAt(x, z)**: 0 on the plateau; the step heights inside each crepidoma outline (temple
  0.35 / 0.70, the stylobate itself is pieces); the ramp's slope; outside the plateau the terrain
  function the ground mesh is made from. Walls of scenery don't stop the player (only pieces do),
  so keep scenery that could be walked into low.

### Sight lines

- Start → temple: nothing taller than 1.5 m between x 12 and 27 near z -4..4 (the altar is 1.3,
  the lions 1.6, the stelai 1.9 off to the sides).
- The sea is visible over the west end of the temple roof (ridge 10.5, horizon at eye height
  across 10 km).
- Keep the south half of the forecourt (x 0..30, z 5..22) open: it is where the player walks and
  fires from. Trees there stand singly.

## 2. How each structure is built and how it breaks

General rules for all of it (from Brick Street and the library):

- Every piece ≤ about 2.2 m on a side (exceptions named below). Neighbours share faces exactly:
  compute every position from the same numbers; never overlap.
- Loads go down through pressed bonds (horizontal faces); spans hang on sideways bonds. Beams and
  lintels join only over a support (a column axis, a wall), never mid-span.
- Tilted pieces bond only where faces are coplanar and opposite. Cut tilted timbers as prisms so
  their feet are horizontal and their heads vertical (then they bond by face); bond by hand
  (`d.bond`) only where nothing else works (olive limbs, dome pieces, the open door leaf, shields).
- Per-piece `tint` for variety: marble blocks ±4% warm/cool (`0xffffff`, `0xf6f0e6`, `0xfbf8f2`,
  `0xefe9de`), limestone ±6%.
- Static pieces: the stylobates and platform slabs only. They never break and hold up what stands
  on them.

### 2.1 Temple (Doric, peripteral, 6 × 11 columns)

Local frame: origin at the temple centre (-4, 0, -4), x along the long axis (east +), z across.
Column axes at x = -11 + 2.2 i (i 0..10) and z = -5.5 + 2.2 j (j 0..5); interaxial 2.2.

Heights:

| Part | y from | y to | Notes |
|---|---|---|---|
| Bottom step (scenery) | 0 | 0.35 | outline ±12.7 × ±7.2 |
| Middle step (scenery) | 0.35 | 0.70 | ±12.25 × ±6.75 |
| Stylobate (static slabs) | 0.70 | 1.05 | ±11.8 × ±6.3 |
| Column shaft: 8 drums of 0.6 | 1.05 | 5.85 | radius 0.50 at the foot to 0.40 at the top |
| Echinus | 5.85 | 6.17 | frustum r 0.40 → 0.62 |
| Abacus | 6.17 | 6.39 | box 1.30 × 0.22 × 1.30 |
| Architrave | 6.39 | 7.24 | 1.0 deep, two beams of 0.5 side by side |
| Frieze | 7.24 | 7.94 | triglyphs and metopes in front, backers behind |
| Geison (cornice) | 7.94 | 8.29 | 1.45 deep, overhangs 0.45 |
| Wall plate | 8.29 | 8.59 | timber |
| Ridge (tile top) | | ≈ 10.45 | pitch 15° |

**Stylobate**: 66 static slabs 0.35 thick, joints halfway between column axes (x joints at
±1.1, ±3.3, ±5.5, ±7.7, ±9.9; z joints at 0, ±2.2, ±4.4), so every column stands in the middle of
a slab. It is also the cella floor.

**Columns** (30 around + 4 in antis): drums are `frustum` with 20 sides (the 20 flutes, read as
facets in raking light), each drum's top polygon the next one's bottom (same sides, same start
angle) so they bond face to face. Taper linear: drum k from r = 0.5 - 0.0125 k to 0.5 - 0.0125 (k+1).
Echinus a 20-sided frustum flaring out; the square abacus on it. 10 pieces a column. Turn each
column's polygon by a random multiple of 18° so the facets don't line up across the facade.

**Architrave**: two beams side by side (outer v 0..+0.5 from the axis line outward, inner -0.5..0),
each 0.85 tall, spanning column axis to column axis (2.2 long). Corners: the long sides run to the
corner, ending in an end block 0.5 × 0.85 × 1.0 (x from the corner axis outward); the short sides'
beams fit between the long sides' inner faces and join over their column axes (end spans 1.7).
The east architrave carries 6 bronze shields (discs r 0.45, 0.06 thick, 16 sides) on the outer
face over each column axis, bonded by hand (area 0.03).

**Frieze**: front layer 0.4 deep: triglyphs 0.44 wide (proud of the metopes by 0.05, so a dark
line of shadow down each side), metopes 0.66 wide and recessed (0.35 deep). A triglyph over every
column axis and every mid-span; a corner triglyph at each corner (belonging to the long side, 0.44
along it, 0.4 deep), the end metope next to it widened to fill (≈ 0.94). Backers 0.6 deep behind,
2.2 long, joined over the axes; the short sides' frieze fits between the long sides' (as the
architrave). Triglyph tint `0xb9c3c9` (the ghost of their old blue paint), metopes plain.

**Geison**: blocks 1.1 long, 0.35 tall, 1.45 deep (v -0.5..+0.95), sitting on the frieze and
overhanging 0.45. Joins every 1.1 (over axes and mid-spans): a cantilever held by its pressed bond
on the frieze.

**Ambulatory ceiling** (the shaded walk between columns and cella): marble beams 0.3 wide × 0.45
tall every 1.1 along the sides, from the architrave's inner strip (v -0.5..-0.3: the frieze backers
stand on v -0.3..+0.1, leaving it free) to a 0.3 ledge on the cella wall (the cella attic is
thinner, see below), at y 7.24..7.69. Lids 0.12 thick across each pair of beams (1.1 × 2.0). The
porch ends the same way across x.

**Cella**: outer walls x ±8.6 × z ±3.5, 0.7 thick, isodomic limestone. Base course of orthostates
(0.95 tall, 1.8 long), then 9 courses 0.582 tall of blocks 0.9 long, alternate courses offset by
half a block (running bond), up to 7.24. Cross walls at x 5.1..5.8 (east, with the door) and
-5.8..-5.1 (west, solid). The long walls run on as antae to x ±8.6. The porches (pronaos east,
opisthodomos west) have 2 columns in antis each at x ±8.1, z ±1.15, carrying a two-beam architrave
from anta to anta (joins over the columns). Attic: 2 courses 0.525 tall and only 0.4 thick (the
inner part, z ±2.8..3.2) from 7.24 to 8.29 (level with the geison top, so the tie beams rest on
both), leaving the 0.3 ledge for the ceiling beams. Marble
anta capitals (1 block each). The top courses stop where the in-antis architrave starts.

**Door** (east cross wall): opening 2.0 × 4.0 at z -1..1, marble frame (2 jambs in 2 pieces each,
1 lintel 2.6 long: an allowed exception), two bronze leaves (1.0 × 1.95 × 0.12, two pieces per
leaf, stacked). South leaf closed (bonds to its jamb by face); north leaf open 75° inward, bonded
by hand to its jamb (area 0.04). The player can walk in. Inside: the cult statue's base (marble,
2.2 × 1.4 × 1.2 in 3 pieces) at x -4, empty, and an offering table.

**Roof** (timber and terracotta):

- Wall plates: timber 0.3 × 0.3 along both long sides on the geison (z ±5.3..±5.9), 2.2 long.
- Tie beams every 2.2 (at the column axes, 11), between the wall plates (z -5.3..5.3) in 6
  lengths, resting on the cella attic tops; a king post on each, its top cut to the rafter slope.
- Rafters every 1.1 (21 pairs), 0.22 wide × 0.25 deep, 3 segments a side: the foot cut
  horizontal (sits on the wall plate), the head cut vertical at z 0 (the pair bond face to face),
  the middle a plain tilted box. Same rotation for the whole slope, so segments share end faces.
- Tiles: panels 1.1 (x) × 0.733 (up the slope) × 0.08, 22 columns × 9 rows a slope. Panel joints
  along x sit on rafter centrelines, so every panel rests on two half-rafters. Each panel is two
  real tiles wide and one course long. All panels of a slope use one `textureFrame` (the slope's
  eave corner, rotated with the slope) so the tile pattern runs across them.
- Ridge caps: 22 terracotta prisms whose two lower faces lie on the top rows of both slopes
  (bonded by face to both).
- Antefixes: 22 a side, every 1.1 along the eaves: thin terracotta plates 0.28 × 0.32 × 0.05,
  turned with the slope so their back face lies on the bottom row's end face.
- Pediments (both ends): the tympanum on the end geison, set back 0.5 from its front, 0.5 thick,
  in 2 courses of prism blocks about 2 m long, their top faces coplanar with the rafter tops so the
  end tile panels bond to them. Raking cornice: tilted marble blocks 1.1 long along each slope
  edge, projecting 0.45. Acroteria: a marble palmette prism at each apex and a block at each corner
  (6).

**How it falls**:

- A rocket on a column takes out 2..4 drums. The drums above and the capital lose their way down
  and drop. The entablature over the column now hangs on sideways bonds to the neighbouring spans
  (marble `support` is low), which cannot carry two spans of beams, frieze, geison and roof: that
  section drops whole, its joints break on landing, the architrave beams crack in two on the
  stylobate, tiles slide off and burst. Neighbouring spans stay, ragged-ended.
- A corner column brings down the corner of the pediment: raking cornice, acroterion, the end
  tiles: the best-looking fall in the world. Aim for it in testing.
- Drums falling from a column roll and stay whole (marble `minSize` 0.32: a drum's size, 0.75, is
  under 2.5 × minSize, so it doesn't shatter on landing); long beams do crack on landing.
- The cella walls lose blocks in running bond: a hole wider than two blocks lets the courses over
  it come down in a V. The attic and the ceiling beams on the ledge go with them.
- The roof: tiles hang on each other's side faces (`support` 18, a tile can barely hang off one
  neighbour), so a blast on the roof tears a ragged hole and tiles keep slipping from its edges for
  a moment after. Losing the cella attic drops the tie beams and king posts; the rafters then hang
  on the wall plates and give way.

### 2.2 Treasury (Doric, distyle in antis)

Local frame at (2, 0, -21), long axis x, front east. Steps: one scenery step 0..0.3, a static
stylobate 0.3..0.6 (outline 10.4 × 6.4, about 15 slabs). Walls 0.6 thick of limestone blocks
0.75 × 0.5, 9 courses to 5.1; side walls x -5.2..5.2 at z ±(2.6..3.2), back wall at x -5.2..-4.6,
front cross wall at x 2.8..3.4 with a door 1.4 × 3.0 (marble frame, two bronze leaves closed), the
side walls running on as antae to x 5.2. Two columns in antis (D 0.8, 6 drums of 0.62 + echinus +
abacus, top at 5.1) at x 4.8, z ±1.0. Entablature as the temple's at 0.8 scale (architrave 0.65,
frieze 0.55 with triglyphs 0.36 / metopes 0.54 at a 1.8 rhythm over the in-antis columns, geison
0.28). Roof: timber plates, 5 tie beams with king posts, rafters every 1.1, tile panels 1.1 ×
0.733 (10 columns × 5 rows a slope), ridge caps, antefixes, pediments with acroteria. A blast at
the door takes the front wall; the porch roof and pediment then hang only on the antae and come
down onto the steps.

### 2.3 Stoa ruin (`ruin` material, weaker than `marble`)

Platform: static slabs 0.3 thick (2.4 × 3.8, two rows) under the column line and the back wall.
Columns as the temple's (8 drums + capital). State by position k (x = 13 + 2.4 k):

| k | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
|---|---|---|---|---|---|---|---|---|---|
| | full | full | full | 2 drums | gone (drums lie south of it) | full | full | 4 drums | 1 drum |

Entablature only over k0..k2 (architrave two beams a span, frieze with two metopes missing so the
sky shows through, one geison block) and over k5..k6 (architrave and one geison block, no frieze).
Spans 2.4 (an allowed exception). Back wall at z -26.8..-26.2 from x 11.8 to 33.6, limestone 0.9 ×
0.5 × 0.6, its height varying block by block between 2 and 8 courses (taller toward the east end,
a ragged top from a smooth noise, never a single block standing on a gap); an east return wall at
x 33..33.6 to the column line, 3..6 courses. The ruin is the easy target: `ruin` has half the
marble's support, so a near miss brings a standing span down and the tall end of the wall topples
in a sheet.

### 2.4 Tholos (round, Doric, domed)

Centre (-21, 0, 15). Steps: two scenery round steps (r 6.6 at 0..0.3, r 6.2 at 0.3..0.6), the top
step static (r 5.8, 0.6..0.9: 20 `arcBlock`s from r 2.0 to 5.8 and a 20-sided centre disc).

| Part | Shape | y | Pieces |
|---|---|---|---|
| Columns: 12 on r 4.9, D 0.8 | 5 drums 0.68 + echinus 0.24 + abacus 0.18 (16 sides) | 0.9..4.72 | 84 |
| Architrave | `arcBlock` r 4.45..5.35, 30° each, joints over columns | 4.72..5.27 | 12 |
| Frieze | arcBlocks r 4.75..5.35: triglyph 5°, metope 10° alternating | 5.27..5.77 | 48 |
| Cornice | arcBlocks r 4.6..5.8, 30° | 5.77..6.07 | 12 |
| Ceiling | arcBlocks r 3.2..4.75 (on the wall's outer strip and the architrave's inner) | 5.27..5.52 | 12 |
| Roof ring | terracotta wedges r 3.2..4.75: flat bottom at 5.52, top sloping from 6.27 (inner) to 5.77 (outer) | | 24 |
| Cella wall | arcBlocks r 2.9..3.5, 16 a course (22.5°), alternate courses turned 11.25°, 7 courses of 0.624 | 0.9..5.27 | 112 |
| Drum above the roof | arcBlocks r 2.9..3.2, 2 courses of 0.5 | 5.27..6.27 | 32 |
| Dome | `domePiece` sphere centre y 6.27, ρ 2.9..3.2: latitudes 0..22.5 (16), 22.5..45 (16), 45..67.5 (8), a cap, a marble finial | 6.27..9.5 | 42 |

The door faces east: one block gap (22.5°) in courses 0..4 (3.1 high), a 45° lintel block in
course 5. Inside, a small round altar (one 16-sided cylinder). Dome pieces only share faces
approximately: bond each by hand to its ring neighbours (area 0.08) and to the one or two pieces
under it (0.12), the lowest ring to the drum course (0.15). A hit on the dome punches a hole and
the cap drops through; undermining the cella wall drops the dome's side over the hole; a column
taken out drops two arc spans of entablature, the ceiling over them and their roof wedges.

### 2.5 Propylon, temenos wall, altar, small things

- **Propylon**: two side walls (limestone, 5.0 along x, 0.6 thick, 9 courses to 4.4) at z 0.8..1.4
  and 6.6..7.2 around x 34; a porch of 2 Doric columns (D 0.8, as the treasury's) in antis on the
  west face (x 31.9) facing the sanctuary; architrave, frieze and geison across; a small gable roof
  along x (6 rows × 5 columns of tile panels a slope on 3 rafter pairs and the side walls) with a
  pediment on the west face. About 200 pieces.
- **Temenos wall**: limestone blocks 1.2 × 0.45 × 0.6, 3 courses and a coping of slabs 1.2 × 0.12
  × 0.7. Leave out 15% of the top course and coping in runs of 1..3 blocks (an old wall), never
  leaving a block on a gap.
- **Altar**: limestone core blocks 1.2 × 0.65 × 1.2 in 2 courses (x 2, z 5), a marble base
  moulding (0.2) and crown course (0.25, overhanging 0.08) in 1.2 lengths, a step (prothesis) of 6
  blocks 0.8 × 0.3 × 1.0 on the west side. About 40 pieces.
- **Statue base**: marble, a step (4 slabs 1.1 × 0.35 × 1.1), a die 1.4 × 1.5 × 1.4 in 2 courses of
  2 halves, a crown 1.6 × 0.25 × 1.6. The statue (prop) stands on the crown at y 2.1.
- **Exedra**: limestone, a semicircular bench: 2 courses of 12 `arcBlock`s (r 3.2..3.8, 15°) and
  seat slabs on top (12, r 3.15..3.85), end blocks with a scroll-less square arm each.
- **Votive column**: a base block 1.4 × 0.4 × 1.4, 10 drums 0.75 (D 0.7, 16 sides), echinus,
  abacus 0.95 square: top at 8.4. A tripod (prop) on top. Thin and tall: a hit anywhere on the
  shaft brings the top down and the tripod with it.
- **Stelai**: a base block 0.8 × 0.35 × 0.45, the slab 0.55 × 1.7 × 0.18, a gable prism top.
- **Empty pedestals**: a step, a die in 2 pieces, a crown.
- **Fallen fragments**: as listed in 1. Drums lie rotated so a facet faces down exactly at y 0.

### 2.6 Trees

- **Cypress** (6 pieces): a trunk frustum (12 sides, r 0.2 → 0.17, 0..1.0), then the crown as
  stacked 10-sided frusta with a flame profile: radii 0.55 (y 1.0), 0.85 (2.5), 0.9 (4.5),
  0.75 (6.5), 0.5 (8.0), 0 at the top (a cone), heights scaled to the tree's height and radii
  jittered ±10% per tree (the same polygon start angle all the way up, so the frusta bond).
  A blast near the foot drops the whole crown as a section that topples and breaks on landing.
- **Olive** (9 pieces): a trunk frustum (r 0.35 → 0.28, 1.2 tall), 2 limbs (tilted 25..35°,
  frusta r 0.2 → 0.14, 1.5 long, bonded by hand to the trunk's top, area 0.05), 6 crown blobs
  (hulls of 14 random points on an ellipsoid 1.2..1.8 wide, 0.9..1.2 tall) round the limb tops,
  kept 0.05 apart and bonded by hand to their limb (0.08) and to their neighbours (0.04). Crown
  centre 3.0..3.8 high, crown 5..6 wide. Blasts strip blobs; the trunk stands.
- Tints: cypress foliage `0x5c7a4c`..`0x4a6640` over the foliage texture (dark green); olive
  foliage `0xc8d0b4`..`0xb4bea0` (silvery grey-green); trunks `0x8a8070` (olive), `0x6e5a48`
  (cypress).

### Piece budget

| Structure | Pieces (about) |
|---|---|
| Temple | 2,250 (columns 340, stylobate 66 static, architrave 76, frieze 152, geison 66, ceiling 128, cella 620, door and shields 15, roof 740, inside 5, interior extras 40) |
| Treasury | 800 |
| Stoa ruin | 310 |
| Tholos | 400 |
| Propylon and temenos wall | 460 |
| Altar, statue base, exedra, votive column, stelai, pedestals, fragments | 160 |
| Trees (16 cypresses, 12 olives) | 205 |
| **Total** | **≈ 4,600..5,000** (about 120 of them static) |

Count with `demo.stats().pieces` after building. If it comes out well under 5,000, spend the rest
on the temple first (an interior colonnade of 2 × 4 small columns in the naos, ≈ 70), then more
olives. Do not go over 6,000: the roof's tiles multiply when they shatter.

### Materials (BreakableMaterial)

Textures: `textured(set, { base: 'packs/temple/textures/' })`, `inside(set, uvScale, { base })`.

| Name | Start from | Change | Why |
|---|---|---|---|
| `marble` | `presets.concrete` | density 2.7, support 45, compression 300, strength 9e3, impact 40, fragmentSize 0.45, minSize 0.32, dustSize 0.34, maxPieces 22, minBodySize 0.1, friction 0.6, rubbleLife 25; surface `temple_marble` (color `0xf4efe4`, normalScale 0.8), uvScale 0.83 (1.2 m tile); inside `0xf6f2ea`, insideTexture `temple_marble_broken` at 1.67 | Dry-laid blocks with only clamps and dowels: carries huge loads pressed, very little hanging, so spans fall when undermined. Low joint strength so a falling column comes apart drum by drum. minSize 0.32 keeps drums whole when they land (they roll) and makes marble break into chunky angular blocks; the heart of a blast turns to a white dust plume. |
| `ruin` | `marble` | support 22, compression 200, strength 6e3, impact 25; surface colour `0xeadcc2` (older, ochre patina) | The stoa ruin: loose, cracked, easier to topple. |
| `limestone` | `presets.brick` | density 2.2, support 40, compression 120, strength 1.2e4, impact 30, fragmentSize 0.36, minSize 0.14, dustSize 0.22, maxPieces 24, friction 0.75, rubbleLife 15; surface `temple_limestone`, uvScale 0.67 (1.5 m tile); inside `0xd8c49c`, insideTexture `temple_marble_broken` at 1.4 | Porous poros: softer, crumbles and dusts more than marble; blocks break on hard landings (unlike drums). |
| `terracotta` | `material()` | density 1.9, friction 0.7, support 18, compression 40, strength 3e3, impact 4, shatter true, reach 1.4, fragmentSize 0.28, minSize 0.07, dustSize 0.1, minBodySize 0.12, maxPieces 12, rubbleLife 8; surface `temple_roof_tiles` (normalScale 1.2), uvScale 0.4545 (2.2 m tile); inside `0xc4724a`, insideMap 0.2 | Thin fired clay: bursts into tile-sized shards at once, a little further from a blast than stone (reach), and breaks under any heavy chunk. Hangs weakly on its neighbours, so roofs tear and slide. |
| `timber` | `presets.wood` | density 0.65, support 150, impact 25; surface Poly Haven `roof_planks` (or `brown_planks_03`) tinted `0x9a7a5a`, uvScale 1 | Old cedar rafters; they show once the tiles are gone. |
| `bronze` | `presets.metal` | density 8.5, impact 150, plastic { yieldStress 1.5e4, bend 1.4 }, minSize 0.5; surface a TSL node: bronze `0x8a6a3e` (metalness 0.9, roughness 0.4) and verdigris `0x5f9c86` (metalness 0.1, roughness 0.8) mixed by world-space noise, streaks running down; inside `0xc89a5a` | Doors and shields bend, dent and ring rather than break. Also the material the bronze props are placed with (for their sounds). |
| `foliage` | `material()` | density 0.25, support 80, compression 20, strength 2.5e3, impact 3, fragmentSize 0.5, minSize 0.3, dustSize 0.45, minBodySize 0.35, maxPieces 5, friction 0.9, rubbleLife 8; surface `temple_foliage` (roughness 0.9), uvScale 1; inside `0x3d5228`, insideMap 0.5 | Leaf masses: burst into clumps and a cloud of leaves at the blast's heart. Tints make cypress and olive. |
| `bark` | `presets.wood` | density 0.8, support 200, strength 2e4, impact 30, fragmentSize 0.25, minSize 0.1; surface Poly Haven `bark_willow_02` (check; else plain `0x7a6e60`), uvScale 1.5; inside `0xd8c49a` | Green wood: tough, snaps rather than crumbles. |

Eight materials (eight draw calls). Dust and chips:

| Material | dust | chips |
|---|---|---|
| marble | `0xf2eee6` | `0xf4f0e6` |
| ruin | `0xe6dcc8` | `0xe2d4b8` |
| limestone | `0xd8c8a4` | `0xcdb88e` |
| terracotta | `0xc08060` | `0xb0532e` |
| timber | `0x9a7a58` | `0x8a6a48` |
| bronze | `0x8a7a5a` | `0x8a6a3a` |
| foliage | `0x7a8a50` | `0x56703a` |
| bark | `0x8a7458` | `0x6a5a48` |

`blastRadius`: 2.4 (a column and a half; marble pieces are big).

## 3. Look

- **Sky**: Poly Haven `pizzo_pernice_puresky` (CC0; checked in the API, and measured: the sun is
  53° up, the zenith a deep blue, a pale haze band and a few small clouds on the horizon). Download
  the 1k `.hdr` to `public/packs/temple/hdri/pizzo_pernice_puresky_1k.hdr`. Alternative if it reads
  too grey: `qwantani_noon_puresky` (sun 50°, darker blue).
- `sky: { hdri: 'packs/temple/hdri/pizzo_pernice_puresky_1k.hdr', azimuth: -1.25, background: 0.95,
  environment: 0.6, sun: { color: 0xfff3e0, intensity: 3.6 }, shadowRange: 55 }`.
  Azimuth -1.25 puts the sun in the south-south-east (toward +x 0.32, +z 0.95): from the start the
  sun is behind the player's left shoulder, the east front is lit at a graze (every drum lit on its
  south side, dark on its north), the south flank is in full sun and its columns stripe the cella
  wall with shadow.
- **Fog**: `{ color: 0xc9d6e2, near: 90, far: 1500 }`: the islands at 0.8..1.4 km and the inland
  mountains read as pale blue shapes; the sanctuary itself is crisp.
- **Exposure** 0.95 (sunlit marble is near white; keep detail in it).
- **Bloom** `{ strength: 0.18, radius: 0.45, threshold: 0.96 }`: only the sea's glitter and the
  brightest marble edges.
- **Hemisphere** `{ sky: 0xb8cde4, ground: 0xc9a674, intensity: 0.5 }`: warm ochre light bounced
  from the ground into the shadows under the cornices and in the porches: the Mediterranean look,
  shadows deep but never black.
- **AO** radius 0.9 (bigger forms than Brick Street: flutes, cornices, porches).
- **Palette**: marble warm white `0xf4efe4` (shadows cool `0x8a96a8`), limestone cream-ochre
  `0xd8c8a4`, terracotta `0xb5653a` / `0x8e4a2c`, bronze `0x8a6a3e` with verdigris `0x5f9c86`,
  dry grass `0xc4a86a`, bedrock `0xd6cfc0`, cypress `0x2f4a26`, olive leaves `0x8a9670`, sea
  `0x1b4a6e`, sky deep blue to pale haze at the horizon.

## 4. Textures

Six generated sets (GPT Image 2.5, one take each to start), in `scripts/assets/packs/temple/
textures.mjs` with `tex()`, processed by `scripts/assets/packs/temple/textures.py`. All prompts:
no joints unless stated, no carving, no text.

| Set | What | Frame (real size) | Processing | Used by |
|---|---|---|---|---|
| `temple_marble` | Weathered white Pentelic marble of an ancient temple: warm white with faint grey veins, honey-ochre patina stains and streaks, fine pitting and erosion, small chips, a few dark lichen specks. | 1.2 × 1.2 m | `generic(a, rough=0.55, ao_amount=0.4, nz=0.95)` | `marble`, `ruin` surfaces; the scenery steps |
| `temple_marble_broken` | Freshly fractured white marble: sugary, crystalline, glinting grains, conchoidal facets and sharp ridges, pure white with faint grey. | 0.6 × 0.6 m | `generic(a, rough=0.5, nz=0.9)` | `marble`, `ruin` inside; `limestone` inside (tinted ochre) |
| `temple_limestone` | Ancient poros limestone block face: pale cream-ochre porous stone, small holes, fossil shell fragments, faint claw-chisel marks, soft weathering, warm ochre and grey patches. | 1.5 × 1.5 m | `generic(a, rough=0.88, nz=0.92)` | `limestone` surface; sacred-way flags (scenery) |
| `temple_roof_tiles` | Ancient Greek terracotta roof from straight above: flat pan tiles in straight rows down the slope, each joint covered by a ridged cover tile running top to bottom, sun-faded orange-red and ochre clay, dust, pale lichen spots, a few darker tiles. 5 tile columns across and 4 courses down, each tile 0.55 wide and 0.733 long, a regular grid. | 2.75 × 2.93 m (ask 1024 × 1088 or the nearest size) | custom `roof_tiles`: find the cover-tile ridges (column profile peaks, as `sidewalk()` finds joints) and the course lines (row profile), crop exactly 4 columns × 3 courses (2.2 × 2.2 m) from joint to joint away from the edges, resize to 1024²; height from the cover-tile ridges plus the course steps plus highpass detail; rough 0.8 | `terracotta` surface (uvScale 1/2.2) |
| `temple_ground` | Dry Mediterranean hilltop ground from straight above: sun-bleached straw-yellow dry grass tufts and wild thyme, patches of pale grey-white limestone bedrock and scree, pebbles, ochre dusty soil. | 4 × 4 m | `generic(a, rough=0.95, nz=0.9)` | scenery ground (plateau and slopes) |
| `temple_foliage` | Dense evergreen Mediterranean foliage filling the frame, close up: small narrow grey-green leaves with silvery undersides and fine twigs, deep gaps of shade between clumps, light and fairly neutral in colour (tinted per tree). | 1 × 1 m | `generic(a, rough=0.9, ao_amount=0.8, nz=0.85)` | `foliage` surface |

Free CC0 sets from Poly Haven (no budget; download the 1k diff, nor_gl and arm maps, convert to
`<set>_diff_1k.webp`, `<set>_nor_gl_1k.webp`, `<set>_arm_1k.webp` in `public/packs/temple/textures/`
and credit them): `marble_rock_01` or `marble_cliff_03` (bedrock patches, cliffs, scenery rocks),
`roof_planks` or `brown_planks_03` (`timber`), `bark_willow_02` (`bark`; look at it first).

Budget: 6 of the 12 GPT Image 2.5 images. Look at each raw and its previews before spending a
redo.

## 5. Props (Meshy 7.1, at most 4)

Concepts with `concept()` from the base props.mjs, `scripts/assets/packs/temple/props.mjs`. Generate
in this order; if one fails or the budget runs short, drop from the bottom.

| Name | What | Size (fit) | Mass | How many, where | Material |
|---|---|---|---|---|---|
| `statue` | Weathered bronze statue of a standing goddess in a long draped peplos, a crested helmet pushed back, right hand holding an upright spear, left hand resting on a round shield standing at her side, on a low integral bronze plinth; dark bronze with green verdigris streaks. No inscription. | height 2.4 | 0.6 | 1, on the statue base (13, 2.1, 9), facing east-south-east | `bronze` |
| `tripod` | Ancient Greek bronze tripod cauldron: a deep round cauldron on three tall straight legs, two upright ring handles; weathered bronze with green patina. | height 1.5 | 0.08 | 3: by the altar (15.5, 0, -8.6), (15.5, 0, 0.6); on the votive column's abacus (21, 8.4, -12) | `bronze` |
| `amphora` | Ancient Greek terracotta storage amphora: tall, pointed foot, two handles, plain unpainted orange-buff clay with a few dark bands, no figures, no letters. | height 1.05 | 0.03 | 7 (see 1) | `terracotta` |
| `lion` | Archaic marble lion seated on its haunches, weathered white-grey marble with ochre patina, on a rectangular marble plinth. | length 1.9 | 2.5 | 2, flanking the foot of the ramp (12.6, 0, -8), (12.6, 0, 0), facing east | `marble` |

4 concept images (of the 12) and 4 Meshy generations. Set `yaw` so each front faces -Z, then turn
it in placement. Props don't break: they are thrown whole and make their material's sounds.

## 6. Sounds

`scripts/assets/packs/temple/sounds.mjs` (with `sound`, `fx`, `foley`). 12 new sounds, 34 takes,
leaving 6 for redos (≤ 40).

| Name | Intent of the prompt | Kind, space, length, takes | play | Used by |
|---|---|---|---|---|
| `ambience.cicadas` | Dense chorus of cicadas in olive trees on a hot Mediterranean midday, pulsing rhythmic buzzing, a light warm breeze. Field recording. | loop, head, 45 s, 2 | bus ambience, volume 0.32, voices 1, reverb 0 | played by the world itself (see 7) |
| `ambience.coast` | Warm breeze over a rocky hilltop above the sea: soft gusts through dry grass, the distant wash of waves breaking on cliffs far below, very open. | loop, head, 45 s, 2 | bus ambience, volume 0.3, voices 1, reverb 0 | `audio.ambience` (high 1.4) |
| `marble.break` | A large marble block cracking apart: a sharp, hard, bright crack of stone splitting, chunks breaking away, a short crumble of grit. | shot, world, 2.5 s, 4 | near 5, volume 0.75, voices 5, cooldown 0.06, spacing 2 | `marble`, `ruin` break |
| `marble.impact.large` | A heavy marble column drum falling and slamming onto stone paving: a deep weighty thud with a hard bright clack of stone on stone, a short roll and grind. | shot, world, 3 s, 4 | bus debris, near 6, volume 0.85, voices 4, priority 3, pitch [0.85, 1.08] | `marble`, `ruin` heavyImpact |
| `stone.grind` | Massive stone blocks grinding and shifting under load: a deep low scrape of stone on stone, a creak, grit trickling. Slow, ominous. | shot, world, 3 s, 3 | bus debris, near 6, volume 0.55, voices 2, cooldown 1.5, spacing 10 | `marble`, `ruin`, `limestone` strain |
| `collapse.marble` | An ancient stone colonnade toppling: heavy column drums and beams crashing down one after another, deep thuds and cracks, rolling grinding stone, a rumble fading out. | shot, world, 7 s, 3 | near 12, rolloff 0.7, volume 1, voices 3, priority 3, cooldown 1.2, spacing 10, reverb 0.5 | `marble`, `ruin` collapse |
| `tile.shatter` | Terracotta roof tiles breaking: a sharp ceramic crack and crash of fired clay shattering, shards clattering; brittle and dry, not glass. | shot, world, 2 s, 4 | near 4, volume 0.65, voices 5, pitch [0.9, 1.12] | `terracotta` break, heavyImpact |
| `tile.debris` | Broken terracotta shards sliding off a roof and dropping onto stone: dry ceramic clinks and rattles. | shot, world, 2 s, 3 | bus debris, near 3, volume 0.45, voices 4, pitch [0.9, 1.15] | `terracotta` impact, debris |
| `bronze.clang` | A heavy bronze shield or door falling flat onto stone: a loud resonant clang with a long shimmering ring, a little bell-like. | shot, world, 3.5 s, 3 | bus debris, near 6, volume 0.6, voices 3, priority 2 | `bronze` heavyImpact, collapse |
| `foliage.break` | A tree branch snapping and a leafy crown thrashing: a crisp wooden crack, then a rush of rustling leaves and twigs. | shot, world, 2 s, 3 | near 4, volume 0.55, voices 3, cooldown 0.2 | `foliage` break; `bark` break |
| `birds.scatter` | A flock of jackdaws and pigeons bursting into flight from a stone building: a flurry of wingbeats and sharp alarmed calls, flying off into the distance. Negative: music, human voices, speech. | shot, world, 4 s, 2 | near 10, volume 0.6, voices 1, cooldown 25, spacing 100, reverb 0.3 | reaction (see 7) |
| `steps.gravel` | Footsteps in boots on dry stony ground and gravel with dry grass, steady pace, separate crunching steps. | slice, head, 8 s, 1 | volume 0.32, voices 2, pitch [0.95, 1.05], reverb 0.1 | `footsteps.hard` |

Which sounds each material makes (`audio.materials`), base-pack sounds reused where they fit:

| Material | break | impact | heavyImpact | debris | strain | collapse | settle |
|---|---|---|---|---|---|---|---|
| marble, ruin | marble.break | brick.impact.small | marble.impact.large | brick.debris | stone.grind | collapse.marble | dust.settle |
| limestone | concrete.break | brick.impact.small | concrete.impact | brick.debris | stone.grind | collapse.rumble | dust.settle |
| terracotta | tile.shatter | tile.debris | tile.shatter | tile.debris | | | |
| timber | wood.break | wood.impact | wood.impact | wood.impact | structure.creak | | |
| bronze | metal.bend | metal.impact.small | bronze.clang | | metal.bend | bronze.clang | |
| foliage | foliage.break | | | | | | |
| bark | foliage.break | wood.impact | wood.impact | | | | |

`audio.settings`: `brick.impact.small: { pitch: [1.0, 1.3] }` (stone chips on stone ring brighter
than brick on asphalt). Ambience: `[{ sound: 'ambience.coast', high: 1.4 }, { sound:
'ambience.wind', volume: 0.6, high: 3 }]`. Footsteps: `{ hard: 'steps.gravel' }` (rubble and land
from the base pack).

## 7. Reactions

- **The cicadas fall silent.** `ambience.cicadas` is in `audio.ambience`, and the world reaches
  its voice through `rt.ambience`: on a blast, `setVolume(0, 0.25)`; after 15..30 s of quiet, back
  up over 10 s. A second blast while they're coming back silences them again. The single most
  telling sound in the place.
- **Birds burst from the roofs.** On a blast within 25 m of the temple, treasury or tholos, play
  `birds.scatter` at that building's ridge (temple (-4, 10.5, -4), treasury (2, 7.2, -21), tholos
  (-21, 9.5, 15)), at most once every 40 s. With it, a flock: about 20 dark specks (one instanced
  mesh of small flapping quads, the world's own, under the scene) rising from that ridge and
  wheeling off out over the sea, gone after 8 s.
- **The bay answers.** A blast of radius ≥ 2, or a section of more than 30 pieces coming down,
  plays `explosion.far` 400 m out over the sea to the west, at (-400, -40, -60), volume 0.35: the
  engine's speed of sound delays it about 1.2 s, its air dulls it. An echo off the water and the
  islands.
- **Drums puff where they land.** On an impact of a `marble`/`ruin` piece heavier than 0.6 with
  speed > 3: `effects.dust(at, 0.3, 0xf2eee6)`, a white puff in the sun.
- **Bronze rings.** A tripod or the statue thrown and striking at speed > 2 plays `bronze.clang`
  with pitch 1.15..1.3 (the cauldron rings higher) besides the material's sounds; at most once a
  second per prop.
- **Splashes.** A loose piece that falls past y -60 (off the north or west cliff) makes a white
  puff on the sea at its x, z: `effects.dust([x, -61.5, z], volume, 0xffffff)`.

## 8. Library changes we wanted

All made in the library since (per-material pitch, `rt.ambience`, bond tolerance for the dome,
`WorldDefinition.destruction`, `killBelow`, `uvScale` pairs, the player's wall check against the
scenery). The world uses them, but the `uvScale` pairs: the tile map was laid on a square grid.
`README.md` lists what's still open.
