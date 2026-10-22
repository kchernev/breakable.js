# Harbor Yard: design

A container yard on a quay, on a grey overcast morning. Sea fog over dark water, wet concrete,
faded containers stacked in blocks, a yellow gantry crane over them with a container hanging from
its ropes, a corrugated warehouse, three white fuel tanks in a bund, and a container ship far out
across the water. Everything breakable is steel, concrete or timber: it dents, bends, topples
and booms rather than crumbles.

This is the plan the builder and the asset makers follow. Numbers are starting points: tune
them by looking at the world.

---

## 1. The place

### Frame

- x is east (right as you look out to sea), y is up, z is south (toward the land). The sea is to
  the north (-z).
- Yard deck (the ground pieces stand on): y = 0. `ground: 0`.
- Quay edge: z = -30. North of it is water at y = -1.8, with the seabed (a fixed box) at y = -9,
  so debris that goes over the edge sinks out of reach.
- Breakable area: x from -35 to 35, z from -30 to 29 (70 x 59 m).

### Plan (metres; each character is about 2.5 m)

```
 z
-340  . . . . . . . . . . . [ container ship, beam-on, x -80..140 ] . . . . . . .   (dormant scenery)
-300  STS cranes x3 (x -150..-40)                    breakwater + lighthouse (x 120..400, z -200..-160)
      ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ water y -1.8 ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
 -30  ==kerb=====o========o========o========o========o========o========o=====  quay edge, bollards o
 -28  [Q] 2 x 20ft stacked at the quay edge (x -33.5..-27.4)
 -25      M3        crane rail A (z -21) ------------------------+      .  BUND ----------------+
 -21      ---------[L]=========[L]------------------------------+      .  | (T1)      (T2)      |
 -18  B1 r0..r4   |  B2 (under crane) |  B3 (20ft pairs)        |  L   .  |                     |
 -12  40ft along x|  40ft along x     |                         |  A   .  |       (T3)          |
  -7              |  hanging 40ft     |                         |  N   .  +---------------------+ z -10
  -6  ------------- truck lane (z -6.3..-1.8), yard tractor ---- |  E   .  BLOCK B: 20ft along z,
  -1  ---------[L]=========[L]---- crane rail B (z -1) ---------+      .  stepped 1-2-3-4-3-1 high
   3  pallets, drums, forklift         M1                           .     (x 12.5..29, z -5.5..0.6)
   8  +------------- WAREHOUSE (24 x 16) --------------+                .  40ft along z (z 1..13.2)
      |  roller door 1     roller door 2      door/win |  [office]      .                 M2
  16  |  racking run 1                                 |                .
  20  |  racking run 2                                 |    START  x    .  barriers x 11.8
  24  +------------------------------------------------+         (8, 24) .
  29
      x: -35        -20          -9    0    4.4   11.6     20         35
```

### What stands where

| Thing | Where (x, z) | Size | Notes |
|---|---|---|---|
| Quay kerb (capping) | x -35..35, z -30..-29.4 | 0.35 h x 0.6 deep, 1 m segments | concrete, painted faded yellow |
| Bollards (7) | x = -30, -20, ..., 30; z = -28.7 | 0.45 dia body, 0.6 cap, 0.7 tall | cast iron, 3 pieces each |
| Quay-edge pair (Q) | x -33.5..-27.4, z -27.6..-25.2 | 2 x 20ft stacked | there to be blown into the sea |
| Crane rails A and B | z = -21 and z = -1, x -35..6 | scenery strips (as built: pieces, `railBeams`) | end stops at x 6 (small steel blocks, breakable) |
| Block A, bay B1 | x -33.5..-21.3 | 40ft along x | heights by row r0..r4: 3, 2, 2, 1, 2 |
| Block A, bay B2 | x -20.9..-8.7 | 40ft along x | heights 2, 3, 0, 2, 1 (r2 empty: the crane's working slot) |
| Block A, bay B3 | x -8.3..4.0 | two 20ft per row (x halves) | heights [2,2] [2,1] [1,0] [2,1] [1,1] |
| Block A rows | centres z = -18.80, -16.06, -13.32, -10.58, -7.84 | 2.44 wide, 0.30 gaps | 0.40 gaps between bays |
| Gantry crane | centre x -14.8, legs x -20.8 and -8.8 on both rails | span 20 m (z), girders z -24..2, top 19.3 m | the landmark |
| Hanging 40ft | x -20.9..-8.7, z -11.80..-9.36, y 6.61..9.20 | on a spreader under the trolley | 1.4 m above B2 r3's 2-high stack |
| Truck lane | z -6.3..-1.8, x -35..4 | open | yard tractor at (-14, 0, -4), facing +x |
| North-south lane | x 4.4..11.6, z -29.4..29 | open, 7 m | the sight line from the start to the sea |
| Bund + tanks | bund x 13.5..34.5, z -26.5..-10 | wall 1.0 h x 0.3 | T1 (19, -20.5) r 3.5 h 8; T2 (28.5, -20.5) r 3.5 h 8; T3 (24, -13.5) r 2.5 h 6 |
| Block B line 1 | x centres 14.0 + 2.74 i (i 0..5), z -5.5..0.56 | 20ft along z | heights 1, 2, 3, 4, 3, 1 |
| Block B line 2 | same columns i 0..4, z 1.0..13.19 | 40ft along z | heights 1, 0, 2, 1, 1; two of them reefers (white, unit on the south end) |
| Warehouse | x -34..-10, z 8..24 | eaves 7.0, ridge 8.6 | roller doors on the north face; one half open |
| Site office | x -7..-1, z 11.5..13.9 | portable cabin 6 x 2.4 x 2.6 on blocks | windows north |
| Open 20ft | x -15.5..-9.4, z 3.2..5.6, along x | doors open to the east | cartons spilling out |
| Pallet area | x -33..-20, z 2..7 | | 3 empty-pallet stacks (8 high), 6 loaded pallets |
| Light masts | M1 (2.5, 3.5), M2 (32, 12), M3 (-26, -25) | 18 m pole + head with 4 floodlights | tall and thin: they topple well |
| Jersey barriers (8) | x 11.8, z 10..26 | 2 m each | concrete, red and white alternating |

### Start and sight lines

- Feet `[8, 0, 24]`, look `[0, 7, -20]`: standing at the south end of the north-south lane.
- Ahead the lane runs 54 m to the quay edge, and beyond it the water and the ship (centred x 30,
  so it fills the end of the lane). Left: the site office, the warehouse corner, the masts, the
  stacks of Block A with the crane standing over them, its hanging container against the sky.
  Right: Block B's stepped stack, the tanks behind it. Over the stacks to the left the far STS
  cranes show grey in the fog.
- Open ground for the player: x -6..12, z 14..29 and the lane.

### Distant scenery (procedural, instanced where repeated)

As built, all of it but the water stands as scenery until something reaches it, then breaks
(README, Round the yard): the deck in 12 m tiles that a blast lays breakable as the apron is, the
quay wall in 12 m lengths, the ship's hull in 10 m lengths, its bow, each box on its deck and its
house, each far crane, gantry, mast and shed, each box of the far stacks, the breakwater, the
lighthouse and the buoys.

- **Water**: a plane at y -1.8 out to 800 m. TSL: dark grey-green `0x2a383d`, roughness 0.12,
  slow moving normal ripples (two scrolling noise layers, ~3 m and ~0.6 m wavelengths), slightly
  transparent (opacity 0.88, no depth write) so what sinks fades out. It reflects the HDRI, which
  is most of its look.
- **Quay wall**: the vertical face below the edge (z -30, y -9..0), concrete with a dark wet band
  from y -2.4 to -1.6 (tide line), black cylindrical rubber fenders (0.8 dia, 2 m long, horizontal)
  every 10 m between the bollards, a recessed steel ladder at x -5 and x 22, and stone steps down
  to a landing at the west end (x -35..-31) so a player who drops in can walk out.
- **Container ship** (x -80..140, z -330, hull 220 x 32 m): black hull `0x1e2226` with a dull red
  band at the waterline, 12 m freeboard, deck stacks of instanced boxes 6 tiers high in the
  container palette, a white superstructure 22 m tall at the east end with a funnel. Fog makes it
  a grey-blue silhouette (that's the point).
- **Ship-to-shore cranes** (3) on the far quay at x -150, -100, -50, z -300: A-frame legs 45 m,
  booms raised to 75 m, faded red and white. Plain boxes, read as silhouettes.
- **Breakwater** from (120, -260) to (400, -160): low dark rock line, with a white lighthouse
  with a red band (14 m) at the end and a slow-blinking emissive lamp.
- **Buoys** (2): red at (-40, -95), green at (70, -120), bobbing in `update`.
- **Yard beyond** (south of z 35, and x beyond ±40): instanced container blocks (rows 1 to 5
  high, palette tints), two RTG crane silhouettes at z 80 and 140, 30 m light masts with lit heads,
  grey shed boxes, low hills far south. Fog takes all of it.
- **Ground**: the yard deck in `harbor_yard_concrete`, wetter (lower roughness, darker) in a
  noise mask of puddles; painted lines: yellow lane edges along the lanes, white bay stripes at the
  ends of the container rows (no numbers, no text), crane rails (steel strips on a concrete beam,
  flush; as built, pieces), drain grates every 20 m along the lanes, oil stains under the parked
  tractor.

### Piece budget (target ~6,000, ceiling 8,000)

| Group | Pieces |
|---|---|
| Containers (Block A 31, Block B 19, quay pair 2, open one 1: 53 boxes) | ~3,550 |
| Warehouse (frame, cladding, roof, doors, racking, loads) | ~950 |
| Gantry crane (incl. its hanging container) | ~500 |
| Tank farm (3 tanks, bund, pipes) | ~410 |
| Pallets and cartons outside | ~260 |
| Quay kerb and bollards | ~90 |
| Office, masts, barriers, rail stops | ~140 |
| **Total** | **~5,900** |

If the frame rate suffers, drop Block B line 2 first (-420), then B1's third tier.

---

## 2. How each thing is built

General rules (as Brick Street): no piece over ~2 m on a side; neighbours share faces exactly
(positions computed from the same numbers); nothing overlaps; tilted pieces that meet at an edge
get `d.bond(a, b, area)`. Each structure is built in its own local frame and placed by one
function, so bonds come out exact.

### Containers (the bulk of the world)

One function `container(d, { at, yaw, length: 6.058 | 12.192, height: 2.591 | 2.896, tint, doorsOpen? })`.
Local frame: x along the length (doors at +x), z across (W = 2.438), y up from the container's
bottom. c = 0.16 (frame section), t = 0.06 (skin), H = height.

| Part | Pieces (20ft / 40ft) | Box (local) |
|---|---|---|
| Corner posts | 8 / 8 | c x c, at the four corners, y 0..H, split at H/2 |
| Bottom side rails | 6 / 12 | z 0..c and W-c..W, y 0..c, x c..L-c in ≤2 m lengths |
| Floor | 3 / 6 | z c..W-c, y 0..c, same x splits (bonded to the rails' sides) |
| Bottom end rails | 2 / 2 | x 0..c and L-c..L, y 0..c, z c..W-c |
| Top side rails | 6 / 12 | as the bottom ones, y H-0.18..H-0.02 |
| Top end rails | 2 / 2 | y H-0.18..H-0.02 |
| Roof panels | 3 / 6 | z c..W-c, y H-0.08..H-0.02 (between the top rails, bonded to their sides) |
| Side walls | 12 / 24 | z 0.03..0.03+t (and mirrored), y c..H-0.18 in 2 rows, same x splits |
| Front end wall | 4 / 4 | x 0.03..0.03+t, z c..W-c, 2 x 2 |
| Doors | 4 / 4 | two leaves, 2 rows each, x L-0.03-t..L-0.03 |
| Locking bars | 4 / 4 | 0.04 x 0.04 rods 0.03 proud of the doors, full door height |
| **Total** | **54 / 84** | |

- **Stacking: only the corner posts touch.** The top rails and roof stop 2 cm under H while
  the posts go to H, so a container on top bears on the four posts below (four 0.16 x 0.16 bonds,
  the twistlocks) and nowhere else. Rows are 0.30 apart and bays 0.40, so stacks never bond to
  their neighbours: each stack stands and falls on its own.
- **Texture frame**: pass each piece the container's frame as its `texture` (world), so the
  corrugations run on across the panel seams and the doors' locking bars line up.
- **Variety**: tint per container from the palette (§3), the posts and rails 15% darker than the
  skin. Small random yaw (±1.5°) and offsets (±4 cm) per tier, keeping the posts overlapping by at
  least 10 cm in each direction (rotation about y keeps the post faces coplanar, so they still bond).
  Reefers: white `0xd6d8d2` with the south end wall replaced by a recessed unit (a dark grille panel
  in `steel`, two boxes for the fans).
- **How it should fail**:
  - A rocket on a side wall punches a hole: one or two panels torn off and folded (plastic), the
    stack stands.
  - A rocket at the foot of a stack takes out a bottom corner: what's above that corner has lost
    its footing, and the upper containers should tip and topple off the stack as whole, dented
    boxes, landing with a boom.
  - A container that lands hard folds at its seams (plastic joints yield) and tears a panel or two;
    it doesn't burst into confetti.
- **Tipping**. The library weighs structures by load paths, not moments, so a container left
  standing on the two posts of one end stays up. The world fixes this itself: it keeps a record of
  each container (its pieces, its four bottom posts, what's under each post). After a blast near a
  stack, and after each collapse event nearby (`d.on('collapse')`, subscribed in `build`), any
  container still standing that has lost both posts at one end or both on one side gets the
  strength of its remaining downward post bonds set to 0 (`bond.strength = 0`), so the next weighing
  drops it, with everything stacked on it, as one section held by plastic joints: it falls tipping
  toward its missing end. Weighing is pending for a moment after every blast and while a collapse
  cascades, so the check runs right then (in `onBlast` and in the collapse handler). See
  `libraryRequests` for the cleaner way.
- **Masses**: a 20ft weighs ~2.2 t empty. The pieces are thicker than real 2 mm skins, so the
  material's density is low (0.4); this gives ~2.3 for a 20ft and ~3.6 for a 40ft.

### Gantry crane

Centre xc = -14.8. All steel (`steel`, tint ochre) unless said.

- **Bogies** (8): two per leg, 1.6 x 0.9 x 1.0 boxes on the rail line, y 0..0.9; wheels are
  `cylinder(0.4, 0.12)` turned to lie along z against the bogie sides (their flat faces touch the
  bogie sides: they bond by themselves). 16 wheels.
- **Sill beams** (2 x 8): along x on each rail, x xc-6.7..xc+6.7, y 0.9..1.6, 0.9 deep, on the
  bogies.
- **Legs** (4 x 7): 0.9 x 0.9, y 1.6..15.0 in 7 lengths of 1.914 m, at x xc±6, z -21 and -1.
- **Mid ties** (2 x 6): along x between the legs of each side at y 8.0..8.5.
- **Portal beams** (2 x 7): along x on top of the legs, x xc-6.45..xc+6.45, y 15.0..16.0, 0.9 deep.
- **Main girders** (2 lattice trusses along z, at x xc±2.5, z -24..2, 13 panels of 2 m):
  bottom chord 0.4 x 0.4 at y 16.0..16.4 (sits on the portal beams: bonds by itself), top chord
  y 18.6..19.0, verticals 0.25 x 0.25 at each panel point (y 16.4..18.6), and one diagonal per
  panel, 0.2 x 0.2, tilted, in two halves that share an end face; the diagonal's ends are bonded to
  the chords with `d.bond(.., 0.04)`. 66 pieces per girder.
- **Cross ties** (42): along x between the girders at top and bottom chord level every 4 m, 3
  lengths each.
- **Walkway** (40): grating plates 0.9 wide along the outside of the west girder, hung from the
  bottom chord's outer face (bonded side to side), posts and a top rail.
- **Ladder** (47): up the north-west leg, two rails in 7 lengths and rungs every 0.4 m.
- **Trolley** (14): a deck of 3 x 3 plates over both girders at z -13.1..-8.1, y 19.0..19.3,
  a machinery house (4 boxes, paler) and two hoist drums (cylinders, bonded by hand).
- **Cab** (19): hangs under the trolley between the girders, x xc-1..xc+1, z -13..-11,
  y 13.3..15.8, on two hanger rods from the trolley deck: floor and roof plates, corner posts, a
  back panel, glass on three sides (`glass`), a dark seat block.
- **Hoist** (20 + 11): four ropes of `cable`, 0.05 x 0.05, from the trolley deck's underside
  (y 19.0) down to a headblock (y 9.6..10.2) at x xc±0.4, z -10.58±1.0, in 5 lengths of 1.76 m
  that share end faces; the headblock sits on a spreader (6 lengths along x at y 9.2..9.6, end
  beams across at each end), and the 40ft container hangs from the spreader's end beams by its four
  posts (post tops at 9.2 touch the end beams' undersides: bonded).
- **Lights**: 4 floodlights (`lamp`) under the bottom chords at the girder ends; a red obstruction
  light (`beacon`, 0.2 cube) on top of the trolley house.
- **How it stands**: everything reaches the ground through legs, sills and bogies. `steel`'s
  support is low on purpose (see the material), so `reinforce` sets every bond to carry what it
  carries as built and no more than 1.5 times that: cut a leg and the load the others now have to
  take tears them, and the crane comes down toward the cut leg as connected sections with plastic
  joints, folding as it falls.
- **How it should fail**:
  - A rocket into a leg low down: the leg buckles, that corner sags, then the girders drop that end
    and the crane goes over, bending at the portal and the girder panel points.
  - A rocket into the girders: a panel's chords and diagonals tear; the girder sags at the gap
    and the trolley may slide down it.
  - Hit the ropes: two of the four cut and the container drops onto B2 r3 (or into the gap at r2)
    with a boom. One rope cut: the container swings and tilts (plastic joints in the rope act as
    links).

### Warehouse

Portal-framed shed, x -34..-10, z 8..24. Frames at x = -34, -28, -22, -16, -10.

- **Plinth** (34): concrete dwarf wall 1.0 high, 0.25 thick, just outside the column line,
  in 2 m lengths, broken at the door openings.
- **Columns** (40): 0.35 (x) x 0.30 (z), y 0..7.0 in 4 lengths, at both long walls on every
  frame. **Gable wind posts** (30): at z 12, 16, 20 on both gables, up to the rafters.
- **Rafters** (40): from each column top up to the ridge (z 16, y 8.6), 0.30 x 0.45 section,
  tilted 11.3°, 4 lengths of 2.04 m sharing end faces; the foot bonded by hand to the column top,
  the two top lengths bonded by hand at the ridge.
- **Eaves beams** (24): along x on the column tops at both long walls.
- **Purlins** (96): 4 per slope, along x, tilted with the rafters and lying on them (their faces
  meet: bonded by themselves), 3 lengths per bay.
- **Roof sheets** (96): `cladding`, 2.0 x 2.04 x 0.05, tilted, on the purlins; 6 of them are
  `glass` rooflights. A ridge cap (prisms, 12) bonded by hand to both slopes.
- **Wall cladding** (~170): `cladding` sheets 1.5 wide x 2.0 tall x 0.06 in 3 rows from the
  plinth top (y 1.0) to the eaves (7.0), on the outer faces of the columns (bonded where they
  touch the columns, to each other at their edges, and to the plinth under the bottom row); gable
  triangles above the eaves as trapezoid prisms.
- **Roller doors** (2 x 33): 5 x 5 m openings at x -31..-26 and -21..-16 on the north wall.
  Curtain of `rollerDoor` in 3 columns x 8 rows of 0.625 m, guides (`steel`, 3 lengths each side),
  a hood box at the top. Door 2 is half open: curtain only from y 2.2 up, the bottom bar at 2.2.
- **Personnel door and windows** (25): a door at x -13, four windows (glass in steel frames,
  y 2.5..3.7) east of it.
- **Inside**: two runs of pallet racking along x at z 14 and z 19, x -32..-18: uprights
  (`steel`, blue `0x3a5a8a`) 4.5 m in 3 lengths, beams (orange `0xd06a2a`) at 3 levels; 8 loaded
  pallets on each run (pallet runners rest on the beams: bonded).
- **How it should fail**: a rocket through the cladding tears sheets off and folds them back (they
  are light and weakly held); hits on the roller doors buckle the slats inward. Cut two columns on a
  long wall and that bay's rafters drop their ends: the roof sags into the hole and peels. The
  roof is light, so most of the shed still stands after one or two rockets.

### Fuel tanks

`arcBlock` rings: shell 0.08 thick (inner r-0.08, outer r).

- **T1, T2**: r 3.5, 14 segments x 4 courses of 2.0 m (56), roof of 14 cone wedges (rise 0.6;
  the wedges share their radial faces; each bonded by hand to the shell segment under it), a
  straight ladder up the south side (2 rails x 4 + 23 rungs), a roof handrail (14 posts, 14 rails
  as straight chords), two roof vents (cylinders, hand-bonded), a pipe from the base to the bund's
  west wall (cylinders lying along x in 2 m lengths on small concrete blocks, 8) and a valve
  wheel. ~140 each.
- **T3**: r 2.5, 10 segments x 3 courses, 10 roof wedges, ladder, rail: ~90.
- **Banding**: white `0xdcdcd4`, the third course faded green-grey `0x6f8a70`.
- **Bund** (46): concrete wall 1.0 h x 0.3, 2 m lengths, and a steel step-over stile on the
  west side (8).
- **How it should fail**: a rocket opens a hole in the shell (a segment or two torn out, edges
  bent back); what's above sags into it. Enough of a course gone and the tank folds down on itself.
  A breach also sets off the tank (§7).

### Pallets and cartons

- **Pallet** (8 pieces, 1.2 x 0.8 x 0.144): 3 runners 1.2 x 0.1 x 0.1 along x, 5 top boards
  0.8 x 0.022 x 0.1 across them. `wood`.
- **Empty stacks**: 3 stacks of 8 at (-30, 4), (-28.6, 4) and (-22.5, 4), each pallet slightly
  off (±3 cm, ±2°).
- **Loaded pallet** (12): a pallet with 4 cartons (0.6 x 0.4 x 0.5, `cardboard`, tints from
  kraft brown to grey-white) in 2 x 2 on it.
- **Open container**: a 20ft without door leaves (they stand open as two loose leaves rotated
  100° against the side, not bonded), 2 loaded pallets inside and 6 cartons spilled out on the ground.

### Quay

- **Kerb**: 70 lengths of 1 m, 0.35 h x 0.6 deep, `concrete` tinted faded yellow `0xc9b25a`
  (every 6th a little greyer, worn). They stand on the ground.
- **Bollards**: `frustum(0.24, 0.2, 0.55)` body on a 0.8 x 0.08 x 0.8 base plate, a
  `frustum(0.2, 0.32, 0.12)` cap: `iron`. Heavy and stiff: a near hit knocks the head off into the
  water rather than breaking it.

### Masts, office, barriers

- **Light mast**: pole 0.35 x 0.35 in 9 lengths (to 18 m), a cross arm at the top (2 lengths),
  4 floodlights (`lamp`, 0.5 x 0.15 x 0.4) under the arm. `steel` galvanized `0x9a9c98`. A rocket
  at the foot and it falls like a tree.
- **Site office**: built like a 20ft (same function, with options): `cladding` skin tinted
  `0xd8dcd8`, 3 windows on the north side (glass, frames), a door, standing on 4 concrete blocks
  0.3 high, steel steps to the door.
- **Jersey barriers**: `prism([[-0.3,0],[0.3,0],[0.1,0.8],[-0.1,0.8]], 2.0)` turned along z,
  `concrete`, red `0xa8443a` and white `0xd8d6d0` alternating.

---

## 3. Materials

Start from the presets; what changes and why. All surfaces from the pack use
`{ base: 'packs/harbor/textures/' }`.

| Name | From | Changes (why) | Surface | Inside |
|---|---|---|---|---|
| `container` | `presets.metal` | density 0.4 (thick stand-ins for 2 mm skin: real tare); support 20 (so `reinforce` makes stacks carry what they carry as built, no more); impact 60 (falling boxes cave panels in); plastic `{ yieldStress: 6e3, bend: 0.9 }` (thin skin folds at seams, tears past ~50°); fragmentSize 0.7, minSize 0.35, maxPieces 4 (a blast tears flaps, not confetti); friction 0.45 (steel on steel slides) | `harbor_container`, uvScale 0.5, metalness 0.15, tinted per container | `0x6d6560` (raw steel and primer), insideMap 0.2 |
| `steel` | `presets.metal` | density 1.2 (box stand-ins for I and box sections); support 300, compression 60 (low, so losing a leg or column overloads the rest after `reinforce`); plastic `{ yieldStress: 1.5e4, bend: 1.0 }`; impact 150 | `harbor_steel_painted`, uvScale 1, tinted: crane `0xd0a848`, warehouse frame `0x5c6a72`, racking, masts | `0x8d939a` |
| `cable` | `presets.metal` | density 2.0; plastic `{ yieldStress: 500, bend: 3.0 }` (yields at once and almost never tears: rope pieces act as chain links); strength 6e4; minSize 0.5 (never cut into bits) | `harbor_steel_painted` tint `0x3a3a38`, roughness 0.4 | `0x8d939a` |
| `cladding` | `presets.metal` | density 0.3; support 60 (sheets peel off easily); impact 30; plastic `{ yieldStress: 3e3, bend: 1.4 }`; fragmentSize 0.5, minSize 0.25, maxPieces 5 | `harbor_container` at uvScale 0.7 (finer profile), tint grey-green `0x8f9a94` (roof `0x7c8288`) | `0x8a8e90` (galvanised) |
| `rollerDoor` | `presets.metal` | density 0.35; support 40; plastic `{ yieldStress: 3e3, bend: 1.6 }` (slats buckle in) | `harbor_roller_door`, uvScale 1, tint `0xa8acaa` | `0x9a9ea0` |
| `tank` | `presets.metal` | density 0.5 (8 mm shell drawn 8 cm thick); support 120; plastic `{ yieldStress: 8e3, bend: 1.0 }`; impact 80 | `harbor_steel_painted`, uvScale 0.5, tinted white / green band | `0x5a4a40` |
| `iron` | `presets.metal` | density 7; impact 400; plastic none (cast iron snaps, doesn't bend) | `harbor_steel_painted` tint `0x2c2e30` | `0x6a6a68` |
| `concrete` | `presets.concrete` | as Brick Street's | base `concrete_wall_008`, uvScale 0.4 | `gen_concrete_broken` (base) |
| `wood` | `presets.wood` | density 0.55; strength 1.2e4; fragmentSize 0.2 (boards snap into short lengths); minSize 0.06 | `harbor_pallet_wood`, uvScale 1 | `0xd8c09a` (fresh splinters) |
| `cardboard` | `material` | density 0.15, strength 4e3, support 60, impact 4, fragmentSize 0.25, minSize 0.12, dustSize 0.08, maxPieces 4 (light, tumble far) | plain kraft `0xa47c52`, roughness 0.95 | `0xb89a72`, insideMap 0 |
| `glass` | `presets.glass` | none | as Brick Street, a little greener `0x5d7a7c` | |
| `lamp` | as Brick Street's | emissiveIntensity 3 (daylight: just visibly on) | `0xfff2dc` | |
| `beacon` | as `lamp` | emissive `0xff2a1a`; its intensity is switched in `update` to blink | | |
| `drum` | `presets.metal` | for the drum props (friction, sounds); density ignored | plain | |

14 materials. Props: forklift and tractor use `steel`, drums `drum`, reels `wood`.

`dust`: container `0x8a7a6c` (rust flakes), steel `0x8a8070`, cladding `0x9a9e9c`, tank `0xc8c4bc`,
concrete `0xb4b0a8`, wood `0xc8b08a`, cardboard `0xb89a72`, glass `0xe0eef4`.
`chips`: container `0x7a5a4a`, steel `0x6a5a48`, cladding `0xa0a4a2`, tank `0xd8d4cc`, concrete
`0x9a968e`, wood `0xb89a6c`, cardboard `0xa47c52`, glass `0xd6eaf2`, iron `0x3a3a38`.

Container palette (tints over the pale texture; pick weighted): faded red `0xa0483a` and oxide
`0x7e3a30` (25%), blue `0x3e5f86` and navy `0x2e4258` (25%), green `0x4d6e52` (12%), teal
`0x3f6f6c` (6%), orange `0xc4733a` (12%), beige `0xb89a72` (5%), grey `0x9a9c98` and white
`0xd0d0c8` (15%). Never the crane's ochre.

---

## 4. Look

- **Sky**: Poly Haven `kloofendal_overcast_puresky` (1k, CC0; download to
  `public/packs/harbor/hdri/`). A grey-blue overcast with a soft bright patch where the sun is
  and a hazy horizon. (Fallback: `overcast_soil_puresky`, heavier and greyer.)
- `sky: { hdri: 'packs/harbor/hdri/kloofendal_overcast_puresky_1k.hdr', azimuth: 0.75,
  background: 0.8, environment: 0.75, sun: { color: 0xdfe6ee, intensity: 1.2 } }`: the bright patch
  ahead-right of the start view (east-north-east), low and cool. Shadows faint: overcast.
- **Fog**: `{ color: 0x9aa5ad, near: 10, far: 380 }`. The yard is clear (10% at 50 m), the ship
  at 330 m is 85% fog: a ghost. Match the colour to the HDRI's horizon once it's on screen.
- `exposure: 1.0`, `bloom: { strength: 0.25, radius: 0.5, threshold: 0.9 }` (lamps and the
  beacon glow a little, nothing else), `hemisphere: { sky: 0xb8c4cc, ground: 0x5a5c58,
  intensity: 0.55 }` (flat, even fill), `ao: 0.8` (dark slots between containers).
- **Sea fog breathing**: `update` moves the fog's far between 340 and 420 over ~70 s.
- **Palette**: wet concrete `0x7f817e` (darker in puddles), water `0x2a383d`, sky `0xa9b3ba`,
  crane ochre `0xd0a848`, tanks white, containers faded (above), warehouse grey-green.

---

## 5. Textures (5 sets, 1 in reserve)

Pack `harbor`, GPT Image 2.5, with `tex(...)` (state the frame's real size). All neutral and pale
where a tint will colour them.

| Set | What | Frame / tile | Processing | Used by |
|---|---|---|---|---|
| `harbor_container` | Shipping container side wall: corrugated steel sheet, trapezoidal vertical corrugations ~28 cm pitch (flat crests and valleys, ~4 cm deep), painted **light neutral grey** (to be tinted), faded and chalky, rust spots at dents and along a few corrugation edges, dirt streaks running down, scuffs, no markings or text. | 2 m x 2 m, 7 corrugations across; 1536 px | **custom `corrugated(a, n=7, axis='x')`**: find the period from the column profile (`period()`), resample so exactly 7 periods span the tile, wrap the seam (`wrap_cut`), then build the height from a synthetic trapezoid profile at that period plus 0.15 of the image's high-pass detail (so the corrugation reads strongly in the normal map); AO from the profile; roughness 0.55 paint, 0.8 rust; partly desaturate the paint (keep the rust's hue) and normalise it to ~0.7 albedo | `container` (surface), `cladding` (surface, finer) |
| `harbor_steel_painted` | Painted structural steel plate: pale neutral grey industrial paint, chipped at edges, rust blooms and short rust streaks, grime, a few scratches to bare metal. No bolts, no welds in rows. | 1 m x 1 m | `generic(rough=0.6)` | `steel`, `tank`, `iron`, `cable` |
| `harbor_yard_concrete` | Heavy-duty port pavement seen from above: 2 x 2 grey concrete slabs 4 m square with straight sawn joints, wet: darker damp patches, a few shallow puddles, oil stains, tyre scuffs, fine cracks. | frame 8 m, tile one slab joint to joint (4 m); 2048 px | **custom like `sidewalk`**: cut a slab joint to joint; roughness lower (0.25) where the image is darker/wet, 0.85 dry | scenery ground, and the slabs' tops (`slab`, `paving.ts`) |
| `harbor_pallet_wood` | Rough-sawn pallet timber: one wide plank surface, pale yellow-beige pine with saw marks, knots, grey weathering in places, dirt, a few nail heads. Grain running left to right. | 1 m x 1 m | `generic(rough=0.85)` | `wood` |
| `harbor_roller_door` | Galvanised steel roller shutter curtain: horizontal interlocking slats ~8 cm tall with a rounded profile, dull zinc grey, grime collected in the joints, faint dents. | 1 m x 1 m, 12 slats | **custom**: as `corrugated` along y (n=12) | `rollerDoor` |
| (reserve) | One set kept for a redo. | | | |

Broken faces reuse the base pack's `gen_concrete_broken`; metal's inside is a flat colour.

---

## 6. Props (4 Meshy models)

Concept with `concept(...)`, no text, logos or numbers (paint out any made-up badges).

| Name | What | Size | Mass | How many, where |
|---|---|---|---|---|
| `forklift` | Diesel counterbalance forklift, 3 t class: dull red-orange body, black overhead guard, mast lowered, forks down, solid black tyres, worn paint. | length 3.6 (with forks), w 1.25, h 2.2 | 4.5 | 2: (-18.5, 0, 4.5) facing the half-open door 2 (yaw π); (8, 0, -2) in the lane facing -z |
| `yard_tractor` | Terminal tractor (container yard shunting truck): short single-seat offset cab, flat rear deck with a fifth-wheel plate, big black tyres, faded white-grey cab, black chassis, exhaust stack. | length 5.6, w 2.55, h 3.2 | 8 | 2: (-14, 0, -4) in the truck lane facing +x; (20, 0, 18) south of Block B facing -x |
| `drum` | 205 L steel drum, two rolling hoops, closed top with bung caps, faded blue paint with rust and dents. | dia 0.58, h 0.88 | 0.12 | 22: 8 by the bund's west side (19..23, -9), 6 on the pallet area, 4 inside the open container's mouth, 4 along the warehouse east wall; 3 of them lying on their sides |
| `reel` | Wooden cable drum: two round plywood flanges, a timber barrel wound with black cable. | dia 1.4, w 1.0 | 0.5 | 4: two standing on their rims by door 1 at (-33, 6) and (-25, 6.5), one on the apron at (0, -25), one in the lane at (6, 8) |

Props stand where nothing else does (the Brick Street placement check).

---

## 7. Sounds

### New (pack `harbor`: 12 sounds, 34 takes, 6 spare for redos)

| Name | Kind / space | Takes | Prompt intent | Play | Used for |
|---|---|---|---|---|---|
| `ambience.harbor` | loop / head | 1 (45 s) | Container port on a calm grey morning: gulls calling far and near, water lapping on a concrete quay, a distant low machinery hum and engine idle, faint wind. No voices, no beeps. | volume 0.4, ambience bus | ambience, `high` 0.5 |
| `gulls.call` | shot / world | 3 (4 s) | One or two herring gulls crying overhead, outdoors, a little distant. | near 15, rolloff 0.6, volume 0.5, ambience bus, voices 2 | `update`: one every 8–20 s, 25–50 m from the player, 15–30 m up |
| `gulls.scatter` | shot / head | 2 (5 s) | A flock of gulls taking off at once in alarm: wing flaps and loud cries moving away. | volume 0.6, ambience bus, cooldown 25 | `onBlast` (§8) |
| `ship.horn` | shot / world | 2 (9 s) | A large ship's deep foghorn blowing one long blast far across a harbour, with a long echoing tail over water. | near 200, rolloff 0.3, volume 0.8, reverb 0.6, voices 1 | `update` every 90–160 s from the ship; once after a big collapse |
| `water.splash` | shot / world | 3 (4 s) | A heavy steel object falling into deep harbour water from a quay: a deep plunge and a spray falling back. | near 8, volume 0.9, pitch by mass | pieces going over the quay edge (§8) |
| `container.boom` | shot / world | 4 (3.5 s) | A steel shipping container dropped onto concrete: a huge hollow metallic boom with a ringing, booming resonance of the empty box. | near 8, rolloff 0.8, volume 0.85, voices 3, priority 2, debris bus | `container`, `tank` heavyImpact |
| `container.clang` | shot / world | 4 (2 s) | A loose corrugated steel panel hitting concrete: a sharp hollow sheet-metal clang and wobble. | near 4, volume 0.5, voices 4, pitch [0.85, 1.15], debris bus | `container`, `cladding`, `rollerDoor`, `tank` impact |
| `container.groan` | shot / world | 3 (4 s) | A stack of steel containers straining: deep metallic groans and creaks, a twist lock grinding. Slow. | near 8, volume 0.65, voices 2, cooldown 1.2, spacing 10, debris bus | `container`, `steel`, `tank` strain |
| `container.collapse` | shot / world | 3 (7 s) | A stack of shipping containers toppling over: tumbling hollow steel booms, scraping, crashing onto concrete, rolling to a stop. | near 12, rolloff 0.7, volume 1, voices 2, priority 3, cooldown 1.2, spacing 12, reverb 0.4 | `container`, `steel`, `tank` collapse |
| `chain.rattle` | shot / world | 3 (3 s) | Heavy steel chains and wire ropes rattling and clinking as they swing and drop. | near 5, volume 0.6, voices 2, cooldown 0.5 | `cable` impact/heavy/debris; crane hits (§8) |
| `sheet.tear` | shot / world | 3 (2.5 s) | Corrugated sheet metal being ripped and crumpled by a blast: a tearing screech, then flapping and crumpling. | near 5, volume 0.7, voices 3, cooldown 0.1, spacing 3 | `container`, `cladding`, `rollerDoor`, `tank` break |
| `drum.bonk` | shot / world | 3 (2 s) | An empty steel oil drum knocked over and rolling on concrete: a hollow resonant bong, then a rolling rumble. | near 4, volume 0.55, voices 3, pitch [0.9, 1.1], debris bus | `drum` props impact/heavyImpact |

Prompts end with `fx(...)` / `foley(...)` and the default negative (no music, voices, beeps).

### Material sounds

| Material | break | impact | heavyImpact | debris | strain | collapse | settle |
|---|---|---|---|---|---|---|---|
| container | sheet.tear | container.clang | container.boom | metal.impact.small | container.groan | container.collapse | |
| cladding, rollerDoor | sheet.tear | container.clang | metal.impact.large | metal.impact.small | metal.bend | metal.impact.large | |
| tank | sheet.tear | container.clang | container.boom | metal.impact.small | container.groan | container.collapse | |
| steel | metal.bend | metal.impact.small | metal.impact.large | metal.impact.small | container.groan | container.collapse | |
| cable | metal.bend | chain.rattle | chain.rattle | chain.rattle | | | |
| iron | metal.bend | metal.impact.small | metal.impact.large | | | | |
| drum | | drum.bonk | drum.bonk | | | | |
| concrete | `packMaterials.concrete` | | | | | | |
| wood | `packMaterials.wood` | | | | | | |
| cardboard | | wood.impact | wood.impact | | | | |
| glass, lamp, beacon | glass.shatter | glass.debris | | glass.debris | | | |

Base sounds reused: explosions (reverb down to 0.35: open water, no street canyon), concrete,
wood, glass, metal.*, dust.settle, fire.loop, siren.far, ambience.wind (`high` 3), footsteps
(steps.asphalt on the wet concrete is close enough).

---

## 8. Reactions

- **Gulls scatter** (`onBlast`): the first blast after 25 s of quiet plays `gulls.scatter` 0.3 s
  later; the overhead `gulls.call`s stop for 30 s, then come back one at a time.
- **Splashes** (`update`, every 0.1 s): any loose piece or prop whose position goes below y -1.6
  north of the quay edge plays `water.splash` once at the surface (volume and pitch by mass: a
  container deep and loud, a board light), and throws white spray (`effects.dust(at, mass, 0xdfe6e8)`)
  plus a ring of `effects.impact` chips in water grey. Each piece splashes once (a `WeakSet`).
- **Sparks** (`onImpact`): `steel`, `container`, `iron` pieces striking at > 6 m/s throw a few
  orange chips (`effects.impact(at, up, 0xffa040)`), at most 6 a second.
- **Crane**: the beacon blinks (1 s on, 1 s off) while its piece stands; once it has fallen it
  goes dark. A blast within 15 m of the trolley, or any impact of a `cable` piece, plays
  `chain.rattle` at the headblock (cooldown 2 s).
- **Fuel tanks**: a blast that throws loose any shell piece of a tank starts a hiss and `fire.loop`
  at the breach, dark smoke puffs (`effects.dust` `0x3a3634`, every 0.4 s for 40 s), and 1.5–3 s
  later a secondary blast once per tank: `destruction.explode` at the tank's centre (radius 4,
  speed 10), `effects.explosion(at, up, 1.8)`, `explosion.near`. It can set off the next tank only
  if that tank's shell is breached by it (no unbounded chains: each tank goes once).
- **Stacks tip** (`onBlast` and the collapse handler): the tipping rule in §2.
- **The ship answers**: when blasts add up (decaying noise as Brick Street's, > 10), the ship's
  horn sounds twice; past 18, `siren.far` comes in for 45 s.
- **Sea fog breathes** and the **buoys bob** (`update`).
