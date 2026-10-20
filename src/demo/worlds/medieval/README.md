# Market Town

A medieval market town at golden hour (`?world=medieval`). A cobbled square in a U: half-timbered
houses on the west, the town wall with its gatehouse and a round tower on the north, the church
tower, E1 and the market hall on the east. The south lies open to the low sun, the road and the
fields. Stalls with striped awnings, a well, a market cross, barrels, carts and hay stand in the
square, whose cobbles break: a rocket leaves a crater in them, the machine gun chips them (see "The
square's ground" and "The machine gun here"). The plan and the numbers come from `DESIGN.md`. What
changed, and why, is listed below.

The player starts at (3, 0, 11) looking north through the lane between the stall rows at the gate.

## Files

| File | What |
|---|---|
| `meta.ts` | The picker card (order 1). |
| `index.ts` | The definition: sky, look, audio (with what a bullet sounds like on each material), dust and chips, the square's ground laid (its bed earth), no water, the piece budget, and the reactions to blasts and to the gun (bell, pigeons, market, hens, sparks, chimney smoke, swinging and creaking signs, windmill). |
| `materials.ts` | The 17 breakable materials (the town's 15, and the square's cobbles and earth). |
| `kit.ts` | Frames to build in, pieces placed with their maps laid the way each material wants (see below), bevelled boxes and prisms, polygon clipping, tint variation. |
| `masonry.ts` | Coursed walls in running bond with openings, round and pointed arches (voussoirs and fillers) and gables clipped to a roof; interlocking corners; the round tower's arc-block courses. |
| `timber.ts` | Frame walls (plates, posts, rails, braces, set-back plaster panels, windows, doors, shutters), floors of joists and boards, and the roof kit (wall plates, rafters, tile slabs, ridge pieces, gables). |
| `houses.ts` | One house from storeys, jetties, a stone or plinthed ground floor, a gable or eaves roof, and a chimney. |
| `town.ts` | W1, W2 (the tavern), W3, E1 with its pentice, the market hall, the stable; hanging signs (hung on hinges) and lanterns. |
| `church.ts` | The church tower (three stages, string courses with floors, belfry, battlements, pinnacles, the bell in its frame) and the nave. |
| `walls.ts` | The town wall, the stair to its walk, the gatehouse (arch, fill, guard chamber, portcullis, gate leaves) and the round tower with its cone. |
| `market.ts` | Stalls and their wares, the well, the cross, hay, crates, trestles, the coop, the woodpile, the trough, the pillory, the low wall, and the props. |
| `falls.ts` | Tall sections that come loose lean the way they were hit, and a tower falls on as loose blocks; jettied fronts left with no ground floor under them are let go (see "How it breaks"). |
| `scenery.ts` | The square's breakable ground (`SQUARE`, `groundAt`) and the looks its slabs share with the drawn cobbles; the ground's fixed bodies, the cobbles round the square and their dirt apron, what a crater shows past the slabs (its bed and the square's edges), the country (fields, hedgerows, hills, a ridge), dirt roads, trees and the wood, the south-west skyline, the windmill, the rest of the town, the haze band round the horizon; and `walkable`, which keeps the player out from among the scenery houses. |

## How it's built

Everything breakable is boxes and convex hulls placed in `Frame`s (a wall's or a roof's own u, v, w
axes) so neighbours share faces exactly and bond. Nothing is `static`. `reinforce()` (in the demo)
makes it stand as built.

- **Masonry.** One function builds a coursed wall with its openings. Courses are cut by the
  openings; an arch's voussoirs sit on the jambs, and a filler prism rises over each voussoir to the
  first course line above it; whole courses carry on above. Walls thicker than 2 m are cut through
  in slices. Corners take turns running through. Ashlar blocks are bevelled 3 cm (`kit.ts`), which
  is what makes the jointless limestone read as blocks, plus ±6 % tint per block. Voussoirs are
  bevelled the same way (`bevelledPrism`: three points a corner, each pulled 3 cm along two of its
  edges), lighter and darker in turn (0.97 and 0.85 of the stone, ±3 %), each built about the centre
  of its own curve so its map lies square to its soffit and joints. A round arch's keystone (1.0)
  rises 7 cm over the ring (its sides straight up, so the fillers either side still meet it face
  to face) and stands 5 cm proud of both wall faces. As plain wedges the arches read as one smooth
  pale band. Gables are courses clipped to the roof's underside planes.
- **The church is Gothic.** Its openings (the west door, window and lancet, the belfry's pairs, the
  nave's windows and its east window) are two-centred pointed arches (the library's `pointedArch`,
  radius the span), their halves meeting in a joint at the crown; their glass follows the voussoirs'
  soffits (`archHead`). The town's other arches (the gate, W1's shop front) stay round. The east
  window sits a course lower than before, so its taller head clears the wall top.
- **False bed joints.** The church, the nave and the gate piers are laid in 0.72–0.8 m courses
  (1.2–1.6 m blocks), which on a 20 m tower read as toy blocks. Limestone's surface draws a 1 cm dark
  line round each block at its mid-height (`pieceFrame()`: the block's own frame and box), on blocks
  0.65 m or taller and 0.3 m or more thick, so headstones and copings have none. The courses read at
  about 0.4 m with no more pieces; the line goes with a block when it falls, and a block lying on
  its side has none along its top.
- **The round tower** is 16 courses of 12 arc blocks, each course turned half a block. Each block's
  outer face is curved (hull points on the outer radius at a quarter, half and three quarters of its
  angle) and shaded round (`smooth`): flat, they stepped the outline in and out about 14 cm a course.
  The bell, the pots and jugs, the produce, the windlass, the bucket, the sacks and the heaps of hay
  are shaded round too; their broken faces stay flat.
- **Timber.** Frame walls have the oak 0.22 deep with plaster panels 0.03 back from its face, so
  each panel is in shadow at its edges. Timbers are turned so the oak map's grain runs along each
  one, braces included. Upper storeys stand 0.45 out on the joists of the floor below, and the front
  sole plate sits on the joists' ends, so a jettied front cantilevers.
- **Roofs.** The same kit everywhere: wall plates whose tops are the roof's underside, rafters about
  1.3 m apart in lengths up the slope, tile slabs 0.65 m up the slope on them with the tile map laid
  per slope (rows along the ridge), ridge pieces sharing the top slabs' end faces, and gables cut to
  the pitch. The rafters at each end sit on the gables' sloped tops. Each rafter is a bay of its own
  (see "How it breaks"): its own length of wall plate, its own column of slabs reaching halfway to
  the next rafter, and its own ridge piece, each 5 mm clear of the next bay's. A slab stands 5 mm
  clear of the slab below it too, so it bonds to its rafter alone; a ridge piece bonds to the near
  slope's top slab and stands 5 mm clear of the far one's. The rafters aren't pegged at the apex.
- **Maps.** Roof tiles use one map frame per slope (continuous across the slabs, rows along the
  ridge). Every block of ashlar or rubble, and every board, plaster panel, bale, bolt of cloth and
  iron fitting shows its own patch of its map (`uvJitter: 1`): one frame per wall repeated the
  rubble's stones every 2.5 m and the limewash's marks in a grid across the panels. Up close, a
  rubble block's edge can cut a stone in its map, which reads as coursed rubble. Oak is slid only
  along its grain, so the map's peg holes stay off the timbers.
- **Signs.** The four hanging signs are a board and its iron pictograms, let go as one section and
  hung from the start on a hinge (`d.hinge`) along the bracket 3 cm over the board (`sign()` in
  `town.ts`). From 7 s on, `update` gives one a small push now and then (a breeze: they sway up to
  about 5°), a blast within 6 m swings them away from it at 0.6 m/s for each metre nearer than 6, so
  does a round near one (see "Reactions"), and a sign falls with its bracket. The library counts a
  hung piece as moving only until it has hung still for 0.8 s, or swayed within 10 cm for 6 s (so
  the breeze waits), and its loose cap leaves what hangs: the world idles with nothing loose but in
  its first second (the 26 pieces of the signs, just hung), and a collapse anywhere leaves the signs
  be. Before, they stood bonded to their brackets until a blast came near: hung from the start they
  were loose for good, the smallest loose pieces in the town, and the cap took them in any big
  collapse.

### Pieces (as built)

| Structure | Pieces |
|---|---|
| W1 | 996 |
| W2 (tavern) | 646 |
| W3 | 785 |
| E1 | 603 |
| Market hall | 724 |
| Stable | 203 |
| Church tower | 631 |
| Nave (with pews, altar, headstones) | 1,078 |
| Town wall | 659 |
| Wall stair | 30 |
| Gatehouse | 342 |
| Round tower | 274 |
| Stalls (8, with awnings, valances, wares and sacks) | 491 |
| Well | 36 |
| Market cross | 15 |
| Yard (hay, crates, trestles, coop, woodpile, trough, pillory, low wall) | 87 |
| Lanterns | 45 |
| Signs, the tavern's lanterns, E1's pentice | 58 |
| Props (14 barrels and one lying on them, 3 handcarts, the hay wagon, 4 baskets) | 23 |
| The square's ground (cobbles over earth, 12 × 12 slabs a layer) | 288 |
| **Total** | **8,014** |

## Materials

| Name | From | What matters |
|---|---|---|
| limestone | concrete | **support 90**, **compression 60**, **strength 1.2e3**, impact 150, dustSize 0.1, maxPieces 14, minBodySize 0.1; `medieval_limestone` (1.5 m, a patch per block) tinted warm, with the false bed joint, insides `medieval_limestone_broken` |
| limestoneTower | concrete | the same look, support 45, **compression 12**: the church tower only (its arches too: an ashlar wall's voussoirs are its own stone, a rubble wall's limestone) |
| rubble | brick | support 30, compression 60, strength 1e3, impact 120, dustSize 0.1; `castle_wall_slates` (2.5 m, a patch per block), its odd pale stones repainted and its roughness at least 0.8 |
| rubbleTower | brick | the same look, **compression 10**: the round tower only |
| plaster | material | daub that crumbles (dustSize 0.07), **strength 600** (panels drop out of a frame that lands); `medieval_limewash` (2 m, its dark marks toned down) tinted by wash; insides `medieval_daub_broken` (1.25) |
| oak | wood | support 220, strength 2.2e4: frames fold before they part; splits along its grain (`grain` v, 4); `medieval_oak` (1 m) |
| boards | wood | splits along its planks (`grain` v, 3); `old_planks_02` (2 m) |
| tile | material | **support 70**, **reach 0.5**, impact 6, friction 0.55, dustSize 0.05, **landing 3**, maxPieces 6: a blast holes a roof (see "Roofs"), the slabs whose rafters went slide off, anything landing on a roof breaks it, and slabs and pots break where they land; Poly Haven `roof_09` (4 m, plain peg tiles), insides `gen_brick_broken`. Pots and jugs are tile too: a turned belly (16 sides) and a rim or neck |
| glass | glass | reach 2; a leaded diamond-quarry map drawn in code, tinted amber or pale green per window; it writes depth, so dust drifting over a window fades against it as over the wall |
| bronze | metal | the bell: never breaks (its oak frame does: see "The machine gun here") |
| iron | metal | portcullis, brackets, sign pictograms, finial; `gen_iron_painted` |
| cloth | material | awnings; `medieval_canvas` tinted by dye |
| hay | material | bales and heaps that burst to chaff; `medieval_hay` |
| produce | material | the stalls' cabbages, roots, apples: icospheres of 42 points, a little squashed and flat underneath, shaded round; plain colour by tint (±6 %), roughness 0.75, soft |
| lantern | material | amber emissive (0xffa040 at 2.5) inside an iron frame and cap, with bloom, lit only while it stands (`glow: 'standing'`); no real lights |
| cobbles | `groundPresets.cobbles` | the square's setts (0.25 m): the drawn cobbles' look and uvs (`cobbleSurface`), upright on a slab's sides, the well's shaft painted dark on the top; broken, the cobbles' own map in 0xc4b49c (`SETTS_BROKEN`), so a chunk is a lump of setts; impact 30, reach 0.45, at most 18 pieces a slab |
| earth | `groundPresets.earth` | packed sandy earth under them (0.85 m): `rocky_trail_02` greyed as the dirt apron, then paler and yellower (`earthSurface`), broken 0xc8b494 with the map's grain; impact 15, reach 0.34, clods crumble where they land |

The pack's textured maps are filtered at anisotropy 16 (`sharp`), so walls seen along their length
keep their stone.

## How it breaks

- **Towers.** With the design's compression (120) a tower stands on two blocks: pressed bonds
  carry far more than any load, so `reinforce()` never touches them. At 12 (`limestoneTower`) and 10
  (the round tower's rubble) the base bonds are reinforced to carry 1.5 times their load. Three rockets
  into the church tower's base bring it down. One or two do it for the round tower, whose door
  already leaves a gap.
- **Leaning.** The library turns a section over an edge only once what's left under it no longer
  reaches across its base, so an undermined tower still standing on the rest of its base sinks onto
  its stump and settles upright. `falls.ts` handles 'collapse' events for tall, tower-shaped
  masonry sections (at least 6 m high and 0.9 of their width). It tips them toward the last blast,
  or toward the clear way nearest it: CPU raycasts across the tower's width find what still stands
  in the way. Without that, the round tower leaned onto the town wall's end and stayed, and with
  this library still sinks onto its stump and settles upright, cone and all (two runs of two;
  the church tower falls without it, as it's blasted on two sides). The section
  turns about a point toward that side: its top starts at 9 m/s and is pushed on for 0.8 s (a
  force on each piece, then cleared), so it can't rock back, and the stump crumbles on that side
  (one small blast). When the push ends, the joints between a tower's pieces are cut
  (`d.unbond`): it goes on over as a stack of loose blocks and breaks up where it lands. Pushed
  over joined, the church tower's fall threw hundreds of its blocks out of the town in 3 of 16 runs
  (121–483 pieces past 120 m, the farthest 196–245 m), and in 3 of 6 with frames slowed to 67 ms
  (a busy GPU): blocks and sections of a few blocks still joined, at the speed limit (37–40 m/s),
  skimming out over the fields every way. Not pushed (`leanFalls` off) none did (six slowed runs),
  but then the round tower doesn't fall; a push of 0.4 s, or no stump blast, threw them as often.
  With the joints cut, none in 21 runs (11 of them slowed), the farthest 26–102 m, and the fall
  looks the same: the tower still goes over as a slab and breaks up as it lands.
  Timber sections of a storey or more lean the same way at a third of the speed, with no stump
  blast and their joints kept: without it the market hall's upper storey sank straight down onto
  its stumps. Long wall sections just drop.
- **Joints.** Masonry joints in a falling section are weak (strength about 1e3), so a falling
  wall breaks apart as it bends and lands and leaves a field of blocks. At the design's 3.5e4 a
  tower landed in one piece, lying on its side.
- **Walls stay stiff.** Low compression everywhere made one collapse cascade along the
  wall-gatehouse-wall chain: nearly every bond sits at its limit after reinforcing, and redistributed
  loads broke bonds 40 m away. Long rubble walls and the ashlar (`limestone`: the nave, the gate's
  piers and fill, copings) keep compression 60, so a breach stays a hole and the masonry over it
  hangs; only the church tower is 12. The nave's walls were 12 too, and one rocket at the base of
  its south wall brought down half its walls and most of its roof: the library hands the weight of
  what hangs over a hole to the piers beside it in the same weighing round as the bonds holding it
  break, so the piers gave way too, one after another along the wall. With phase D's library it
  still does (two runs of two: 469–470 of the walls' 563 pieces and 332 of the roof's 440 left
  standing). At 60 the same rocket leaves a hole with the wall standing over it; at a north
  buttress the wall over the hole falls with the three roof bays on it. Masonry `impact` is 150
  (limestone) and 120 (rubble), so falling timber and thrown stones break roofs but not walls.
- **Ashlar holds over a hole.** A block whose weight has moved off what it stands on (one over a
  hole) holds by its side bonds and its bed joints as levers, at what its material holds sideways
  (`support`). At the ashlar's first 45 the blocks over a blast at the base of the nave's south
  wall gave way round after round in two runs of five: once the wall over the hole and the roof
  over it (to 508 of the walls' 563 pieces and 368 of the roof's 440), once a bay of the roof (18
  pieces). At 90 (`limestone` only; the church tower's stays 45) the wall stands over the hole and
  the roof is whole (seven runs of seven), and the gatehouse's piers break as they did (one blast
  at a corner: a bite out of the pier, the arch standing). The library's `passHeldOnly` (a bond
  giving way passes on only what it holds) also kept the nave standing, but then one blast no longer
  brings the round tower down (none of three runs; nor at compression 5) and three at the church
  tower leave a column of it standing against the nave: not used.
- **Load paths.** The library sends weight toward the ground by the fewest bonds, not by
  stiffness, so a piece joining two parts that shouldn't be joined becomes a way round a hole, and
  its bonds, never reinforced for that, break in turn. Window glass stands 5 mm clear of its jambs
  and arch, on its sill alone: bonded to them, it joined the courses up a window's sides in one
  step, and a rocket that broke one of the nave's windows sent the wall's weight through the next
  ones, which gave way down the nave to the far gable. With the walls at compression 60 and phase
  D's library, bonded glass no longer takes the nave down, but a blast or a rocket at the middle
  south window still brought down the roof bay over it (15 pieces) in four runs of four, and none
  with the glass clear: it stays clear. The church tower's lower string course is flush on its
  east face: 0.12 proud, it reached 7 cm into the nave's west gable (5 cm off) and bonded to it,
  and the falling tower took the nave's west end and roof with it. Proud again, the nave now stood
  through the tower's fall (two runs of two, as flush), but the course overlaps the gable, which
  the library's rules forbid: it stays flush.
- **Roofs.** For the same reason each rafter is a bay of its own (see "How it's built"). Slabs
  bonded to each other once cleared nearly all of E1's roof with one rocket. With the slabs apart,
  slabs over two rafters, wall plates under several and the rafters pegged at the apex still sent
  the weight of a bay that lost its foot into its neighbours, which tipped off their own (bay by
  bay, a weighing round every 0.13 s): one real rocket on the nave's south slope left 32 of its 479
  roof pieces standing, and a blast on W3's roof took a whole slope. Now a blast takes the bays it
  reaches, from the eaves to the ridge on the slope it hits, a strip about 4 m wide (tile `reach`
  0.5 holes it; what stood on the rafters within its 2.5 m slides off after), and the other slope
  and the bays beside it stand. Of the roof pieces more than 4 m from the hit, 6 s later: the nave
  94–96 % (blasts at four places), a real rocket from the square on its south slope 98.5–100 %,
  W3 97.5 %, W1, W2, E1 and the hall all. Tile `support` 70 keeps a slab on its rafter. Joined again
  (no gaps between the bays, the slabs and the ridge), the same rocket left 9 % of the nave's roof
  beyond 4 m, a blast on W3's 46–52 % and on E1's 27 % (two runs each), and with the library's
  `passHeldOnly` on 16 %, 59 % and 56 %: the bays stay.
- **Tiles shatter where they land.** Tile's `landing` (3 m/s): a slab or a pot that strikes the
  ground, the scenery or what stands breaks there into at most 6 pieces (the library breaks
  `maxImpacts` landings a readback, taking turns by material, so tile isn't starved by the stone
  falling with it). After E1's roof rocket, of the slabs that came off whole only four lie whole on
  the cobbles (they slid down gently); the rest that stayed whole came to rest on the upper floor
  or the far slope.
- **Houses.** Two rockets at a jettied house's ground floor take it out, but the library's weighing
  leaves the upper front standing on its joists over the void (its weight never moves far enough
  off them to tip them: tried without help, the tavern's upper front hung there, 15 s on; with
  phase D's library, in one run of two).
  `falls.ts` keeps, for each jettied house, what carries its front on the ground floor (its oak
  posts, each cut at the rails, standing only while all its lengths do; a stone front's blocks) and
  its upper fronts with the front row of each jetty's joists and boards (`Kit.gather`/`collect`,
  `floor()`'s front row). 1.5 s after the last blast, once under 0.6 of those posts stand, or a run
  of 3 m of the front has none, what still stands of the upper fronts is let go as one section
  (`d.release`), moving out at 1.2 m/s with its top turning outward, and the front row of each
  jetty's floor as another section. They fall into the square and break up as they land. (The
  blasts crack some of these pieces: their cells are tracked through 'fracture' events and go with
  them. Let go with the jetty in one section, the front turned on the joists and jammed in the house;
  let go alone, it came to rest leaning on the jetty, which the library left standing as a shelf.)
  The tavern's front, its jetty and the front slope of its roof come down 1.5 s after the rockets,
  and 15 s on the house stands open to the square.
- **The market hall.** Two rockets at its front posts tip the upper storey into the square, its
  roof sliding onto the stalls. Plaster joints in a falling section are weak (strength 600), so
  panels drop out of the frame where it lands hard; 12 s on, its gable frame lies propped at an
  angle with some of its panels still in it.
- **Dust.** Dust sizes are small (limestone and rubble 0.1, plaster 0.07, tile 0.05), and every
  material raises well under the default (`dustAmount`: 0.3 for masonry, plaster and tile, 0.2 for
  timber, cloth and glass, 0.4 for hay; at 1 the clouds over falling sections hid the town for
  6–15 s). The blast's own cloud is drawn at 0.55 of its size (`look.smoke.scale`; the fireball and
  the flash stay full size), and it and all dust are blue greys (smoke 0x90a6c4; `look.dustPalette`
  0x9cb0c8, 0xa8bcd0 and 0x90a4bc, the materials' own colours only 0.15 over them). Dust is lit by
  the low orange sun with no sky to cool it: the default tans turned it rust, and cool greys at 0.4
  (0xaab0bc…) salmon. These read as stone dust in the evening light, a warm grey-brown. A rocket's
  hole in the town wall shows through the thinning cloud at 4 s and is clear at 8 s.
- **Loose pieces.** The church tower's fall peaks at 1,900–2,200 loose pieces, and the library
  freezes what has come to rest within seconds (its resting checks run every frame now): at most 5
  are loose at +20 s, none at +40 s (see "Checks"). The world's own loose cap (1,500: past it the
  smallest went), set when a couple of thousand pieces lay at rest for 15 s and more, is gone: the
  demo's 3,000 is never reached, so nothing loose vanishes (rubble at rest may: the piece budget,
  below). Four falls each way, interleaved with Brick Street's: frames over 40 ms 49–103 at 1,500
  and 43–101 at 3,000 (Brick Street 54–135), the worst 83–133 and 100–183 ms. Blocks break into at
  most 14 pieces (limestone), and chips under 10 cm are particles, not bodies.
- **The piece budget.** `maxPieces` 9,500 (`destruction`): the 8,014 built and 1,500 more, about
  what a minute of the gun at a brick wall adds. Past it the library shrinks rubble at rest away, out
  of the player's view first, the smallest and farthest first (`docs/changelog/phase-f/pile.md`); what stands,
  the props, what hangs and anything moving never go. Nothing loose goes: the loose cap stays the
  demo's 3,000. The church tower's fall peaks at 10,140–10,330 pieces, and 40 s on the budget has
  taken the town back to 9,500–9,610 (seven runs; without it, 9,916–10,056).

## The square's ground

The square's cobbles break (`Destruction.addGround`, laid first in `build()`; `SQUARE` in
`scenery.ts`): setts 0.25 m deep (`cobbles`) over 0.85 m of packed earth (`earth`), on the bed at
-1.1 m. It covers x -14.96 … 14.65, z -14 … 14.96: from the fronts of W1–W3 to E1, the church
tower and the hall's post pads, and from the gatehouse to the stable's front. That's the square and
the lane to the gate, with the stalls, the well, the cross, the pillory, the trough, the hay and the
hay wagon on it. The strip in front of the town wall, the alleys, the churchyard, the road out
through the low wall, the fields and the ground under every building stay fixed. Each layer is 12 ×
12 slabs of 2.47 × 2.41 m: 288 pieces in all.

- **It looks as the cobbles did.** One function draws the cobbles (`cobbleSurface`: the two turned
  lookups of the map, the worn and dusty patches) for the drawn cobbles round the square, from the
  world position, and for its slabs, from where on the square a point of them is (`pieceFrame()`
  plus the square's middle), so the setts stay on the chunks a blast throws. The slabs lay their
  normal map in the drawn cobbles' uvs (`COBBLE_MAP`: the same corner and 2.4 m tile). Shot from
  eight places along the square's edges, from the player's height and grazing, and against the
  build before the ground, the frames differ by 0.02–0.04 of 255 on average, and only where motes
  and chimney smoke drift: no seam, no line, no step. On a slab's sides the look stands upright
  (projected along the face), not smeared down it.
- **What a crater shows.** Its chunks' broken faces are the cobbles' own map, darker
  (`SETTS_BROKEN`): with the limestone's broken map they lay round a crater as pale boards. The
  earth is the trodden dirt paler and yellower, a sandy clay: as dark as the dirt, a crater in the
  low sun's shade was a black hole. Past the slabs a crater shows the bed (a plane at -1.1 in the
  earth's look) and, where the square ends against fixed ground, its edge (planes from the bed up:
  the setts in section for the top 0.25 m, earth under them).
- **What was laid on the ground.** The well's dark shaft was a disc 2 cm over the cobbles; it's
  painted on the slabs' top now, so it goes with them. The country mesh lay 3 cm under the cobbles
  everywhere: it's cut out under them (it would have lain across a crater). The drawn cobbles have
  a hole over the square. The dirt roads and the trees are outside it.
- **In the world.** The ground's fixed body is a box with its top at the bed, and four round the
  square with their top at 0 and their foot under the bed (nothing slips under them out of a
  crater). `groundAt` gives the bed on the square (`onSquare`), the land's height elsewhere;
  `killBelow` is 0.7 m under the bed.
- **What a pit strikes as.** Its floor is earth (the ground's `bed`, as it's drawn), and its sides
  where the square meets fixed ground are the layer at that height, as drawn there: the setts' top
  0.25 m as cobbles, earth under them. The south-east corner opened by hand (its last slab of each
  layer taken out): 8 rounds into the floor struck `earth` (`bullet.dirt`, a pock each), 3 into the
  east side 0.1 m down `cobbles`, 3 at 0.6 m down `earth`.
- **No water** (`water`: nowhere). Without it the demo guessed water where the player may not walk
  and the ground is under -0.5 m, which on the square is x 13.2–14.65, z 13.65–14.96 (1.96 m², by
  the scenery house south of the nave): a crater there opened onto water, and rounds into its floor
  went in unseen and unheard (8 of 8, and 6 of 6 into a hole the gun dug there). Now they strike
  the earth (8 of 8 and 6 of 6).
- **What stands on it** bonds to the slabs and goes with them. A rocket 1.4 m from the well's middle
  brings all of its 36 pieces down into the crater as a heap; one 2.2 m from the cross breaks its
  steps and slumps them (11 of its 15 pieces standing); one under a stall folds it into the hole;
  one beside the hay wagon shoves it aside. The barrels and carts drop into a crater.
- **Craters** (`demo.blast` at the rocket's 2.5 m, 0.15 m off the cobbles, at ten spots in the
  open, and five rockets fired from 8 m; rays down every 5 cm): 1.8–2.3 m across (2.4–4.2 m² open),
  0.75–0.94 m deep, but two of the 13 that struck the cobbles (a blast and a rocket) reached the
  bed at -1.1 m in a narrow spot (0.003 and 0.06 m²): its floor there is the bed's earth. The
  chunks lie round the rim (24–31 of them), the farthest 5.6–10.9 m out. Each adds 36–196 pieces,
  most of them 50–120 (cells standing round it, chunks at rest; the small ones clear in 20 s). Two
  rockets struck a stall's counter or wares first and left smaller holes (1.0–1.3 m²).
- **The player** walks down into a crater and out the far side without a stop (three craters, two
  of them both ways: down to -0.25 … -0.29, the feet up 0.23–0.25 m in a frame, the eye at most
  0.07–0.11 m a frame).
- **Under a falling building** the cobbles crack where heavy wreckage strikes them harder than
  their `impact` (30): in the church tower's fall the square's 288 ground pieces became 453–552
  (cells standing where their slabs were, so nothing shows), and the hall's and the tavern's blasts
  at their fronts crater the square's edge (288 to 344–363).
- **Sounds and steps.** The setts strike as stone (`stone.break`, `brick.impact.small`, `brick.debris`;
  no wall's `land`: a crater's chunks would each thud), the earth as Brick Street's does
  (`steps.rubble` lower, and no stone's sounds, so the gun pocks it as dirt). Footsteps:
  `steps.cobble` on the setts, `steps.rubble` on the earth and on the bed under them.

## The machine gun here

The gun fires 14 rounds a second at power 6 (`docs/changelog/phase-e/weapons.md`). What a bullet sounds like
on each material (`audio.materials`, `bullet`, at the material's pitch unless `pitch.bullet` says):

| Material | Strike | Kind (look) |
|---|---|---|
| limestone, limestoneTower | `bullet.concrete`: dressed stone snaps, as brick's dry crack didn't | concrete |
| rubble, rubbleTower | `bullet.concrete` at 0.88, as their other sounds | concrete |
| plaster | `bullet.dirt` at 1.1: a thud into clay | dirt |
| oak | `bullet.wood` at 0.92 | wood |
| boards | `bullet.wood` at 1.15 | wood |
| tile (roofs, pots) | `bullet.brick` at 1.15: fired clay | brick |
| glass | `bullet.glass` | glass |
| lantern | `bullet.glass` at 1.3 | glass |
| iron | `bullet.metal` at 1.25 | metal |
| bronze (the bell) | `bullet.metal` at 0.85 (it was picked as concrete) | metal |
| cloth, hay, produce | `bullet.dirt` at 1.3, 1.1, 1.25: soft thuds | dirt |
| cobbles | `bullet.concrete` | concrete |
| earth | `bullet.dirt` | dirt |

The chips and dust are the world's colours (cloth's chips now undyed linen, 0xcfc2a6: the awnings
are striped, the bolts every dye; madder red for every strike was wrong). Long bursts at each, square
on at 5–6 m (rounds to the first break at one spot, and what it did):

- **At the first round**: plaster panels, roof tiles (37 of 37 broke), pots, glass, cloth (an
  awning's strip), hay bales, produce. **Boards** (the gate's leaves) at the 2nd, then 17 of 18 and
  21 of 22; **oak** at the 2nd (the hall's front posts from inside it: 26 of 29 broke, and its front
  came down, 361–400 pieces loose at once); **iron** brackets at the 5th.
- **Stone holds a while, then goes**: the gatehouse's limestone blocks (1.3 m) first gave way at
  round 36, then 11–14 of 70 rounds broke something (a 20 s sweep along it: 75 of 279); the town
  wall's rubble (1.35 m) at round 31–32, 12–21 of 70. That's the material's `impact` (150 and 120,
  so falling timber doesn't break walls) and the blocks' size.
- **The towers fall to a long burst at their base**: 56 rounds at the church tower's south face (4
  broke something) and 70 at the round tower's (12–18) brought each down as rockets do (1,154–1,224
  and 842–894 pieces loose at once; the fastest piece 15–27 m/s; phase E). A tower the gun brings
  down now leans toward where its rounds broke it, as toward a blast (the gun's breaks are the
  `hit` that `leanFalls` turns it toward; before, it went toward the last rocket's blast or the
  clear way nearest a random one): one 70-round burst at a block of the church tower's west face
  from 5 m off (2 rounds broke something) brought it down onto the player and across the square,
  its blocks' middle 21 m south-west of where it stood, 7 pieces loose at +10 s, none at +20 s; the
  nave's west gable stood.
- **The bell** never breaks, and rings under the rounds (see "Reactions"): flying level with the
  belfry's west opening 12 m off, 140 rounds through it struck the bronze 71 times and it still hung.
  Its oak headstock over it breaks: of a 70-round burst at the headstock 3 struck the oak, and the
  bell came off and down onto the belfry floor, jangling as it came off and clanging as it landed.
  The rockets' fall of the tower throws it into the square (26 m out in the gun's fall above).
- **Props** never break: a barrel struck 30 times is nudged (0.3 m/s at most), the hay wagon not at
  all.
- **The square** (with the library's bite this phase, `docs/changelog/phase-f/pile.md`): 70 rounds at one
  spot of the cobbles 6 m ahead of the start: 40 broke something, 19 struck the setts and then 51
  the earth under them; a pothole 1.9 m² open and 0.99 m deep, its chunks thrown out round it (+66
  ground pieces standing, +34 at rest; +100 pieces in all). 70 more: 55 broke something, 2.6 m²
  open, down to the bed in a spot, +109 in all. Before the bite the setts' cells stood in the
  pothole as wedges (+141 for 70). Into a crater: its earth gives way at once (29 of 30), its floor
  is struck as earth (`bullet.dirt`, pocks), everywhere on the square (see "What a pit strikes as").
- Frame times while firing (the integration team's `fire.mjs`: 70 rounds at the gatehouse's
  limestone, then 20 s held while sweeping 0.6 rad across), now and with the build before the
  ground, one after the other on the shared GPU: standing 23.7 and 22.4 ms a frame on average,
  the burst 25.4 and 23.0, the sweep 20.3 and 28.0 (21 and 70 frames over 40 ms); the destruction's
  CPU 0.7–0.8 ms a frame firing, 14 ms at most; no piece over 20 m/s; no pipelines made after the
  card.

## Reactions (index.ts)

Sounds that wait (tolls, hens) are played with a `delay`: the engine weighs them when they start.

The town hears rockets (`onBlast`) and the machine gun: each round that strikes something
(`onShot`) and each burst as it ends (`onBurst`, which counts the rounds that struck nothing too).
How loud the gun is to it (`hear`): the rounds it has heard lately, each counting for less as the
seconds pass (it fades over about 10 s), eight of them (0.6 s of fire) as loud as a blast. A blast
or the gun startles the town (`startle`): the songbirds and the market go quiet, the louder the
quieter and the longer, and from three rounds on the pigeons go up and the hens complain. Heard
again while the town is quiet, it only deepens the hush and keeps it: a long burst sets off one
flock and one cackle, not one a round.

1. **The evening bell.** Six seconds after audio is allowed (`sound.running`), it tolls three
   times, 4 s apart.
2. **The bell answers hits.** A blast within 9 m of the bell or near the tower's base tolls it
   (1.2 - d / 12, clamped to 0.3 … 1), then 2–3 more swings, 1.7 s apart, each at 0.6 times the last.
   Blasts together swing it once: the strokes still waiting are stopped and the new ones start from
   the louder of the two. A hit on the nave hums it once at 0.35. **A round on the bell rings it**:
   `bell.ping` where it struck (a bright strike and the bronze's ring; the pack's cooldown of 0.45 s
   and two voices keep a burst on it to about two a second), and the first round of a run (none
   in the 3 s before) tolls it softly too (0.2), for its hum. Lying where it fell, it pings duller
   (0.6, pitch 0.85) and doesn't hum.
3. **The bell falls.** Its strokes still waiting are stopped, and it jangles once at pitch 0.92 as it
   comes off the headstock, 0.85 s after the last stroke heard began (the toll's cooldown). When it
   hits something, the bronze material plays `bell.clang`. On its first strike over 4 m/s it also
   plays `metal.impact.large` and `stone.impact.large` (the clang takes are thin), with bronze
   glints. After the rockets' fall of the tower it usually ends in the rubble in the square; shot off
   its headstock, on the belfry floor.
4. **Pigeons.** A blast, or the third round of a burst to strike something, plays `birds.scatter`
   above it (at least 11 m up), one flock in 5 s; rounds into the sky are heard when the burst ends,
   over the player. The songbird loop (`rt.ambience`) ducks to 0.15 for a blast or eight rounds (a
   single round 0.89, three 0.68) and comes back over 40 s, starting 20 s after the last blast or
   round.
5. **The market.** A blast or eight rounds fade the murmur out over 2 s (a single round takes it to
   0.875, three to 0.63). It comes back over 15 s once it has been quiet 20 s plus 100 s times how
   loud it was: 120 s after a blast or eight rounds, 32 s after a single round, 57 s after three.
   Both loops are the world's `audio.ambience` (their levels in `audio.settings`).
6. **Hens.** A blast, or a burst from its third round, within 30 m of the coop plays
   `chickens.startle` there 0.2–0.5 s later, and a round into the coop itself at once (once for
   blasts and rounds within 3 s).
7. **Sparks.** Iron or bronze striking at over 4 m/s throws orange chips.
8. **Chimney smoke.** A thin grey puff (`effects.puff`) rises from each chimney pot (W1, W3, E1)
   every 0.4 s while it stands.
9. **The signs** swing away from a blast within 6 m (see "Signs") and creak on their rings
   (`sign.creak`, louder the harder; one a sign in 0.8 s, two at once). Under the gun: a round on a
   sign's iron pictogram swings it (the round pushes what it strikes, if it's free to move), a round
   into its bracket swings it at 1.2 m/s, and one into the wall or a timber within 1.2 m of its board
   at up to 2 m/s, the nearer the harder; each creaks. A round on the board itself shoots it apart
   (boards go at the first round), and the sign drops off its rings in pieces. In the breeze: every
   0.6–1.8 s one of the four is picked, and if it still hangs from its bracket it gets a push of up
   to 0.25 m/s across its board (no creak).
10. **The windmill's sails** turn at 0.35 rad/s.

Sounds by material (`audio.materials`): the rubble walls share the limestone's at 0.88 of its pitch
(rougher, heavier), daub knocks as tile at 0.75, boards play the base wood at 1.15, iron fittings
the base metal at 1.25, the lanterns' panes glass at 1.3; bullets as "The machine gun here" says. A
falling section (or heavy piece) that lands plays its material's `land` sound once, louder and lower
the heavier: `stone.impact.large` for masonry, `timber.crack` for oak, `tile.clatter` for a slope of
slabs. Footsteps: `steps.cobble` on the ground and the square's setts, `steps.asphalt` on standing
stone (the wall walk, the stair, steps), the base `steps.rubble` on rubble, on the square's earth
and on its bed in a crater.

## Look

- **Sky:** Poly Haven `syferfontein_6d_clear_puresky_1k.hdr` (the design's alternative), azimuth
  -2.1, the sun light 10° up (`sky.elevation`: the HDRI's own sun is about 6° up, and the demo
  would raise the light to 14°), background 0.65, environment 0.24, sun 0xffa860 at 5.3.
  Kloppenheim 06 (the design's pick) is a pale blue sky with only a faint glow. Against it the
  square looked overcast. Syferfontein gives a deep blue sky away from the sun, a warm band on the
  horizon and a real disc. At background 0.85 and environment 0.35 the sky out-lit the sun and the
  square read as mid-afternoon: the light balance, not the grade, makes it golden hour. The glow
  and the light agree (the demo turns the sky right now): looking along the light's azimuth
  (-120°) from 12 m up, the sun's disc is on the crosshair, a few degrees under the light's 10°.
- Fog 0xcbb8a0 from 40 to 340 m: the wooded hill (about 220 m) and the ridge fade into a cool haze,
  the view from the wall walk has depth, and the town at 60 m from above is a little hazed. At 60 to
  420 m and a warmer 0xd9b48c the hill was flat and crisp. A band of the same haze stands round the
  horizon 450 m out (`haze`, following the eye: an open cylinder, transparent, no depth write, its
  opacity 0.85 at the horizon fading out by 8°), because the sky image is a clean deep blue down to
  the horizon away from the sun, which read as late afternoon. Exposure 0.95, bloom 0.22 / 0.5 / 1.0 (at 0.3 / 0.88 the view toward the sun was a milky wash),
  hemisphere 0x8a9cc0 / 0xa07040 at 0.2 (cool shade, warm bounce), AO 0.7, a warm grade
  (saturation 1.1, contrast 1.1, tint 0xffe0c0, vignette 0.22), pale motes (0.05, 0xfff0d0: at 0.1
  and darker they looked like dirt on the lens against the sky).
- **Cobbles:** two lookups of the map, turned against each other and mixed by a slow noise, so its
  2.4 m repeat doesn't show as a grid, plus dusty and worn patches; roughness at least 0.82 (toward
  the sun they glared white). The map's colour at 70 % saturation, times 0xf0dcc0 and 1.35, and its
  normals at 0.6: as it came (and at 0.9) the square read from above as a near-black slab and at
  street level as wet asphalt. From above its mean colour now matches the dirt apron's (about 112,
  80, 54 against 109, 88, 50). At their edges they give out raggedly into trodden dirt
  (`rocky_trail_02` at 35 % saturation), and the country round them has a dirt apron of the same;
  the roads too (rust red as they came).
- **Country:** one 760 m mesh, flat within 55 m of the town and rolling beyond, with the wooded
  hill (120, -190: 45 m high, 120 m across its foot, with an uneven outline and top and a lower
  shoulder to the east), the windmill hill and a ridge to the north. A hill is (1 - t²)² on a
  radius that wanders with the angle, not a cosine bell. Fields are strips in a turned grid, by
  hash: pasture and meadow about two in five (0x4c7a3c to 0x5e8a46), pale wheat 0xa8a068, stubble
  0xa09a78, a ploughed strip one in sixteen. The greens and straws are cool and grey on purpose: the
  sun (0xffa860) and the grade's tint turn them gold. At the first colours (wheat 0xb89a58,
  stubble 0xa8946a, plough one in six) the country read as desert. Each field has its own shade,
  mottled at two scales, with drill rows or furrows and the dirt map's grain; hedgerows narrow
  (about 1.3 m), ragged and only a little darker; grass round the town 0x587e40. `groundAt` is the
  same height function.
- **Trees:** five lumpy crowns a tree (a displaced icosahedron, smooth-shaded, darker underneath
  by its vertex colours), lighter on top, a shade darker for one in three. The wood is about 1,100
  trees in 90 clumps of 8–16 (crown size 1.0–1.8, their crowns 30 % broader and lower, in four dark
  cool greens), so the canopy closes into one dark mass; it casts no shadows (it is far past their
  range). As 260 evenly spread trees it read as polka dots on a bald mound. A hedge with five big
  trees stands on the south-west skyline about 110 m out, dark against the low sun.
- **The rest of the town** is merged meshes: wall and round towers (also in the physics world near
  the square, the towers as 16-sided hulls as drawn, not 7 m boxes), houses and tile roofs (in the
  physics world too, each storey a box and the roof a hull as drawn: debris from the church fell
  through the houses beside it and lay inside them, and rockets now stop at them). Houses
  of two storeys have their upper storeys jettied 0.4 m over the ground floor and eaves 0.5 m out
  (the roofs are two-sided, so the eaves' undersides show); the node material draws the framing and
  dark windows (most bays of 2.2 m upstairs, a door now and then below). Each drawn timber is a
  pixel soft at its edge and fades to its share of a pixel when thinner than one, so seen at a
  glance the framing no longer shimmers. Two rows along a street south-east of the stable and the
  hall, with a dirt lane between them, and the inner west row carried south to z 17 fill out the
  town seen from the wall walk. Up close they're boxes, so the player keeps 1.8 m from every scenery
  house (`walkable`), which closes the lanes between them: the street south-east of the stable, the
  alleys behind the west row, the nave and E1, and the east rows. The houses west of the square cast
  no shadows, because the low sun would throw them over it.

## Changes from the design

- The windmill hill moved from (-130, 160) to (-185, 95). It hid the low sun.
- The scenery round towers are squat (9.5 m, cone to 14 m), so from the wall walk the corner tower
  behind the breakable one doesn't pass for it. The east and west runs both end on one, and a stub
  of the south wall steps down from each (5.5 m to under a metre over about 9 m), so from above the open
  south reads as a wall long gone, not a box left open.
- Stalls face the lane with their 3 m counters along z, at x -6.1 … -4.5 and 6 … 7.6. Their awnings
  fall from 2.65 m to 2.0 m at the front posts, then droop a further 9 cm to their edge 0.45 m over
  the lane, with a scalloped valance of 0.25 m cloth pieces. Nearly flat awnings read as sticks from
  the lane. There is a fourth stall each side. Each sells something: fruit (a heaped tray between
  two baskets), roots (three heaped trays, sacks of grain behind), cloth (stacks of folded bolts),
  pots and jugs (on the counter and on the ground before it).
- The well's windlass is a drum (a wound-rope middle and two plain ends) with a crank outside the
  east post; a rope hangs from it to the bucket, half down the shaft.
- Headstones are round-headed or gabled, 0.6–0.9 m, leaning up to 0.12 m.
- W2 is narrower (z -4.75 … 1.95) with 5 cm verges, so its verge tiles clear W1's and W3's eaves.
  E1 is z -15.0 … -7.6 and 7.3 m deep, clear of the nave's buttresses and the wall. The nave starts
  at x 21.05, 5 cm off the tower, whose lower string course is flush on that side (see "Load paths").
- The church tower: stage 1 in 0.8 m courses, stage 2 in 0.72 m courses, the belfry in 0.75 m
  courses. Each string course holds a 0.25 m boards floor in a 0.15 m ledge on its inside. Belfry
  openings are 0.84 m wide, 15.0 – 16.5 m, with a 0.66 m central pier; the stage-2 lancet 0.6 m
  (both a fifth wider than the design's, which looked tiny on the tower). The bell hangs at (17.25, -2.75), in line
  with one opening on the west face and one on the north. Centred, it hid behind the piers.
- Gatehouse: the fill over the arch is in 0.75 m courses up to 6.6 m (the arch's crown is at 6.0).
  The chamber walls go to 11.1 m with doors from the wall walk, and merlons stand directly on them.
- The round tower's door: the first three courses stand unturned so its sides are straight. The
  turned courses above bridge it.
- Floors are joists on the plates below with boards between them, not decks resting on the plates.
- A 13th material, `rubbleTower` (see "How it breaks"), a 14th, `produce`, and a 15th,
  `limestoneTower`.
- The church's openings are pointed (the design kept to round arches for want of a pointed-arch
  helper); its east window is a course lower.
- The birds and the market are the world's `audio.ambience` loops, ducked through `rt.ambience`
  (the design started its own voices so it could duck them).
- The signs hang on hinges and swing in the breeze; the chimneys smoke.
- The square's cobbles break (phase E): setts over packed earth on a bed 1.1 m down, where the
  design had one fixed box with its top at 0 everywhere; `groundAt` gives the bed there.
- The town hears the gun (phase F), as it hears rockets: the design's reactions answered blasts
  only. The bell rings under a round (`bell.ping`, new) and the signs creak (`sign.creak`, new).

## Tuning

- How many rockets bring the church tower down: limestoneTower `compression` (lower: fewer).
- How much a falling wall breaks up: limestone and rubble `strength`, limestone `maxPieces` (a
  tower's joints are cut once it's pushed over).
- How hard tall sections tip: the speeds and the push in `falls.ts` (9 and 3 m/s at the top,
  0.9 and 0.4 rad/s² for 0.8 s, `PUSH`).
- How much ashlar holds over a hole: limestone `support` (90).
- Light: sky `environment` against `sun.intensity` (the balance), then `look.grade`; the sun's
  height, `sky.elevation` (10°).
- Roofs: tile `reach` (the hole) and `support` (how far round it slabs hang on); tile `landing`
  (how hard a slab must land to break).
- Dust: `dustAmount` per material, `look.smoke` (the blast's cloud) and `look.dustPalette`, and the
  materials' `dustSize`.
- Which signs a blast swings: those within 6 m of it (`onBlast`); the breeze: the push in `update`.
- The front release: `CARRIED` and `GAP` in `falls.ts`.
- How near the player comes to the scenery houses: `CLEAR` in `scenery.ts` (1.8 m).
- The square's ground: where it breaks (`SQUARE.area`), how big its slabs are (`cell`, 2.5 m: bigger
  are fewer pieces and blockier craters), how deep its layers (`depth`, `underDepth`; the bed is
  computed from them); a crater's size: cobbles' and earth's `reach`; what cracks a slab: their
  `impact` (it's also how many rounds a slab takes, so higher makes the gun weaker on it).
- What a bullet sounds like: `bullet` and `pitch.bullet` per material in `audio.materials`.
- How loud the gun is to the town: `hear` (eight rounds lately as loud as a blast, each fading over
  about 10 s); how quiet it goes and for how long: `startle` (the songbirds to 1 - 0.85 × loud, the
  market to 1 - loud; back 20 s, and 20 + 100 × loud s, after the last of it); from how loud the
  pigeons and the hens answer (0.3, three rounds).
- How a sign answers a round near it: within 1.2 m of its board, at up to 2 m/s, and 1.2 m/s into
  its bracket (`onShot`); its creak's level: `creak`.
- How often the bell rings under a burst: `bell.ping`'s cooldown (0.45 s) in the pack's list
  (`scripts/assets/packs/medieval/sounds.mjs`), and its hum's toll (0.2, once in 3 s) in `onShot`.
- When rubble starts to shrink away: `maxPieces` (9,500) in `destruction`.

## Checks

### Phase F: the town under the gun, and the fixes

On display :105, port 5331's dev server (no HMR; curl showed it serving the edited `index.ts` and
the new sounds), the GPU and the machine shared with other agents: the load average went from 11 to
81 through the checks, the GPU was 16–21 GB of its 24 GB full and 20–67 % busy; one run lost its GPU
device, one froze, five pages didn't load in 3 min (out of the GPU's memory) and five runs slowed to
70–840 ms a frame (all left out, and most run again). Frame times here are worse than in phase E's
checks for both worlds measured, Brick Street's too. Scripts, logs and screenshots: the session's scratchpad
`phase-f/medieval/` (`lib.mjs`, `helpers.js`, `reactions.mjs`, `signs.mjs`, `swing.mjs`, `bell.mjs`,
`reach.mjs`, `levels2.mjs`, `pit.mjs`, `se.mjs`, `crater.mjs`, `square.mjs`, `towergun.mjs`,
`collapse.mjs`, `fire.mjs`, `idle.mjs`; `out/`); the main screenshots in
`assets-src/packs/medieval/phase-f/`.

- Typecheck clean; `npm test` 216 of 218 (the two timing tests, `hulls of many points scale` and the
  resting checks' 2 ms a frame, failed with the machine at a load of about 80, as before); `npx vite
  build` to scratch builds. 8,014 pieces at load; no console errors or warnings at load or in any
  check (but the runs whose GPU device or memory failed).
- **The hush** (`reactions.mjs`, two runs, from the start): one round at the gatehouse took the
  songbirds to 0.89 and the market to 0.875 of their levels, no pigeons; two more 1.5 s later (three
  heard lately) to 0.69 and 0.64, and the pigeons went up; a 28-round burst took them to 0.15 and 0
  within 0.9 s, no second flock (the first had gone up 2 s before); a 70-round burst set off one
  flock; 10 rounds into the sky (none struck) set off one flock over the player and the hens (the
  coop 11 m off) as the burst ended. The market came back 120 s after the last round by the game's
  clock (in one run 120 s of the wall's; in the other, its frames slower, past 140). Every burst at
  the gatehouse in the firing runs below: one `birds.scatter` a burst.
- **The coop** (`reach.mjs`): a round into it from 5 m, `chickens.startle` at once; five more within
  3 s, no more (and the pigeons, for the burst).
- **The signs** (`signs.mjs`, two runs; `swing.mjs`, screenshots): W3's sign from 5 m along the
  street: a round into the wall 0.7 m from its board swung it 7 cm at the board's middle, one into
  its bracket 12 cm, one on its iron pictogram 12 cm, each with one `sign.creak`; a round on its
  board shot it apart (its 5 pieces dropped). `phase-f/02-sign-swing.jpg`.
- **The bell** (`bell.mjs`, flying level with the west opening 12 m off; three runs): a burst of 70
  struck the bronze 28–38 times: `bell.ping` 9 times with the pack's cooldown of 0.45 s (15–18 at
  0.25–0.3), the soft toll once (two voices at most, the pack's). 140 rounds and it still hung; a
  burst at its headstock brought it down onto the belfry floor (jangle, clang). Where it can be seen
  from on foot: rays from every walkable metre of the town (`reach.mjs`). `phase-f/03-bell.jpg`.
- **Levels** (`levels2.mjs`, the engine's output recorded): see
  `assets-src/packs/medieval/sounds-report.md`.
- **The water and the floor** (`pit.mjs`, `se.mjs`): see "What a pit strikes as" and "No water";
  `phase-f/04-pit.jpg` (the corner opened; with the old guess no mark on the floor, now 8 pocks;
  then the east side's earth).
- **Craters** (`crater.mjs`, two runs of five blasts and two to three rockets): see "Craters";
  `phase-f/05-craters.jpg`.
- **The gun into the square** (`square.mjs`) and **the gun at the church tower** (`towergun.mjs`):
  see "The machine gun here"; `phase-f/06-pothole.jpg`, `07-tower-gun.jpg`.
- **The church tower's fall** (four blasts at its base, as below; `collapse.mjs`), with Brick
  Street's four at the same time: it comes down into the square as before
  (`phase-f/08-tower-fall.jpg`). Loose at +10 / +20 / +40 s after the last blast: with the budget
  4–12, 0, 0–9 (four runs) and in the first three runs, with the machine at its busiest, 48–184, 0,
  0–3; without it (`maxPieces` off) 2–18, 0–9, 0–2 (five runs, three of them in turns with three
  with it); Brick Street 277–635, 69–117, 0–1. The peak 1,828–2,133 loose; the farthest piece 41–85
  m out. The worst frame in the second after the first blast 52–110 ms (2–9 over 40 ms), to +10 s
  78–206 ms (30–116 over 40 ms); Brick Street 52–65 (3–9) and 123–165 (76–154). With the budget the
  town is back to 9,500–9,609 pieces 40 s on (10,140–10,330 at most); without, 9,916–10,056
  (10,210–10,410 at most). The square's ground: 288 pieces to 453–614.
- **Frames while firing** (`fire.mjs`, phase E's check: standing 5 s, 70 rounds at the gatehouse's
  limestone 6 m off, then 20 s held while sweeping 0.6 rad across), Market Town then Brick Street's
  brick wall, in turns; ms a frame on average, frames over 40 ms in the sweep and its worst:

  | load | standing | burst | sweep | over 40 ms, worst |
  | --- | --- | --- | --- | --- |
  | about 20: Market Town / Brick Street | 30.3 / 32.0 | 34.6 / 34.1 | 52.7 / 35.3 | 158, 286 ms / 191, 157 ms |
  | about 70 | 59.0 / 70.6 | 76.9 / 91.0 | 63.6 / 73.5 | 189, 281 ms / 206, 227 ms |
  | about 30 | 46.8 / 31.5 | 30.8 / 34.0 | 32.4 / 26.4 | 137, 146 ms / 109, 124 ms |

  Rounds that broke something: the gatehouse 3–16 of 70 and 38–61 of 183–273 sweeping (Brick Street
  50–59 and 119–205); pieces added +104 to +188 (Brick Street +586 to +1,377); the fastest piece
  10.6 m/s. The destruction's CPU in the sweep 1.1–5 ms a frame on average, 19–124 ms at most (Brick
  Street 2.8–7.3, 17–67). The world's `onShot` took 0.018 ms a round on average, 0.2 ms at most (343
  rounds). No pipelines made after the card in any of them.
- **Idle**, vsync and the frame cap off, 8 s at the start, in turns: Market Town 8.9 and 14.6 ms a
  frame on average (median 7.4 and 13.0), Brick Street 15.4 and 17.8 (12.9 and 15.1).

### Phase E: the square's ground and the machine gun

On display :105, the GPU shared with other agents' Chromes (it was 15–22 GB of its 24 GB full; a
few runs ran out of its memory and are left out). "Before" is the build of the code before the
ground (the gun was already in it), "now" the build with it, served to the same Chrome by request
interception, run in turns. Scripts, logs and screenshots: the session's scratchpad
`phase-e/medieval/` (`lib.mjs`, `stand.mjs`, `seam.mjs`, `idle.mjs`, `crater.mjs`, `pit.mjs`,
`things.mjs`, `walk.mjs`, `side.mjs`, `collapse.mjs`, `probe2.mjs`, `gun.mjs`, `fire.mjs`,
`pipes.mjs`; `out/`, `out/collapse.jsonl`).

- Typecheck clean for this world, `npm test` and `npx vite build` pass. 8,014 pieces at load (288 of
  them the square's), 23 props, 455,592 vertices (+10,368); no console errors or warnings at load
  or in any check below but the runs out of GPU memory. After load: loose 26 at 0 and 0.5 s (the
  signs, just hung), then 0 every 0.5 s to 10 s; 7,988 standing and 26 hanging throughout.
- Idle, 8 s at the start, vsync and the frame cap off, four rounds: now 1.8–3.4 ms a frame on
  average (median 1.4–3.6), before 2.2–3.3 (2.0–3.6), Brick Street 2.7–3.5 (2.4–3.0) alongside.
- The church tower's fall (four blasts, as below), five runs now and five before: the worst frame
  in the second after the first blast 70–146 ms now (1–5 frames over 40 ms), 52–146 before (2–12);
  from the first blast to +10 s after the last the worst 78–167 ms now (7–107 over 40 ms), 108–248
  before (32–116); Brick Street's four blasts at the same time 69–90 and 88–118 ms (75–116 over 40
  ms). Loose at +10 / +20 / +40 s: now 0–10, 0, 0; before 1–92, 0–7, 0–2. The tower falls into the
  square as before; it cracks the square under it (above), 9,880–9,977 pieces after it against
  9,305–9,683.
- The other signature falls, loose at +10 / +20 / +40 s after the last blast, now against before
  (three or four runs each): the round tower 443–535, 29–422, 0 against 365–441, 49–213, 0; the tavern
  83–355, 0, 0–1 against 0–401, 0–2, 0; the hall 684–813, 40–270, 0 against 536–669, 3–95, 0. They
  come down as before (screenshots side by side). The hall's blasts at its front posts crater the
  square's edge, so more flies (912–950 loose at once against 822–872) and lands on the slabs;
  the library's resting pass isn't the limit (5–30 ms a second of its 2 ms a frame, either build):
  its pieces take longer to come to rest. The tavern's and the round tower's vary as much either
  way.
- The square's edges against the drawn cobbles, the craters, what stands on the square, walking
  into a crater, the gun: see "The square's ground" and "The machine gun here".
- Pipelines: none made after the card through a rocket into the square, 30 rounds into its crater,
  20 at a stall, a 70-round burst and a 20 s sweep.

### Phase D

Measured on display :105 with other agents' Chromes sharing the GPU, Brick Street run between
Market Town's runs (the same checks) for comparison; frame times are the page's frame intervals
(60 Hz, so 16.7, 33.3, 50 ...). Eight runs of the church tower's fall: four in each of two
sessions. Scripts, logs and screenshots: the session's scratchpad `phase-d/medieval/`
(`collapse.mjs`, `cases.mjs`, `sig.mjs`, `signs.mjs`, `walk.mjs`, `seq.mjs`, `ab.sh`). Before the
square's ground (7,726 pieces).

- Typecheck clean, `npm test` passes, `npx vite build` builds. 7,726 pieces with the 23 props; no
  console errors at load or in any check below. After load: `stats().loose` 26 at 0 and 0.5 s (the
  signs, just hung), then 0 every 0.5 s to 10 s (and to 30 s in the signs' check); 7,700 standing
  and 26 hanging throughout.
- Standing at the start, 5 s: frames mean 17–32 ms, median 16.7 in seven runs of eight (Brick
  Street 18–27, 16.7 in seven of eight; the run at 33.3 was on a busy GPU for both).
- The church tower brought down by four blasts at its base, 1 s apart (`demo.blast(14.6, 1, -4,
  2.5, [-1, 0, 0])`, the same at z -1, and `(16.5, 1, -5.4, 2.5, [0, 0, -1])`, the same at x 19.5),
  watched to +40 s after the last:
  - The worst frame in the second after the first blast: 50–67 ms (Brick Street's 33–117), 1–4
    frames over 40 ms (0–3).
  - From the first blast to +10 s: 16–62 frames over 40 ms, the worst 100–150 ms (Brick Street's
    four ground-floor blasts: 19–79, the worst 83–150).
  - Loose pieces peak at 1,907–2,176; 1–135 loose at +10 s, 0–5 at +20 s, 0 at +40 s (Brick
    Street 344–697, 6–257, 0).
  - Nothing past 120 m from the centre at any time, the farthest 49–102 m; 0–6 cells wholly under
    the ground at some moment (in one run four of them 1 m or more), none at +10 s.
  - The tower falls into the square and leaves a 15–16-piece stump; the nave keeps its west gable
    and its roof (434–455 roof pieces standing of 440, its cells counted), the 23 props are all
    there, and the signs hang (in one run of eight one came down with its bracket).
  - With every frame slowed to about 67 ms (a busy wait), five runs: 124–649 loose at +10 s, 0–1
    at +20 s, 0–5 at +40 s; none past 120 m, the farthest 36–83 m.
  - Three blasts (`demo.blast(14.8, 1, -3.5, 2.5, [-1, 0, 0])`, the same at z -0.5, and
    `(16.5, 1, -5.2, 2.5, [0, 0, -1])`) also bring it down, leaving a 15–21-piece stump; the nave
    keeps its roof (438–447).
- The other signature falls, two runs each, loose at +10 / +20 / +40 s after the last blast:
  - The round tower, one blast at its base (`demo.blast(-26, 1, -13.5, 2.5, [0.5, 0, 0.87])`):
    it falls onto W1's roof and the alley; 31–49 standing pieces of its 281 left, 1 above 7 m
    (four runs); 210–470, 1–137, 0 loose; the farthest 39 m.
  - The tavern, two blasts (`demo.blast(-15, 1, -2.5, 2.5, [1, 0, 0])` and the same at z 0.5):
    the ground floor goes at once, 1.5 s later the upper front and its jetty with the front slope
    of its roof, into the square; 13–14 of the upper front's 132 pieces left standing (four runs);
    2, 0, 0 loose; 1–8 cells a moment 5 cm or more under the cobbles, none 1 m. In two runs of six
    one piece landed past 120 m (122–127 m): where looked at, a 10 cm oak splinter the second blast
    threw at 34 m/s (Known issues).
  - The market hall, two blasts at its front posts (`demo.blast(14.6, 1, 10.6, 2.5, [-1, 0, 0])`
    and the same at z 6.4): the upper storey tips into the square, its roof onto the stalls;
    595–650, 13–34, 0 loose.
- The nave, one blast each: at the base of the south wall under its middle window (`demo.blast(29,
  1, 2.6, 2.5, [0, 0, 1])`) a hole with the wall standing over it and the roof whole (seven runs of
  seven); at the window (`(29.05, 3.8, 2.6)`, or a rocket from the churchyard) the window and the
  wall round it go, the wall over it and the roof stay (five runs); at the south buttress beside
  it (`(27.6, 1, 2.6)`) and at a north buttress (`(31.05, 1, -7.6, 2.5, [0, 0, -1])`) the wall over
  the hole falls with the roof bays on it (roof 386 and 383 of 440).
- Roofs, one blast or rocket each (see "Roofs"): a real rocket from the square on the nave's south
  slope holes it from the eaves to the ridge, the pieces that went 2.6 m from the hit at the median
  and 4 m at most, and leaves all of the roof beyond 4 m (four runs); W3 97.5 %, E1 100 %.
- The town wall, one rocket from the square (`demo.blast(12, 1.5, -16, 2.5, [0, 0, 1])`): a crater
  in its inner skin with the rubble at its foot, the wall standing; clear of dust at 8 s. The
  gatehouse, one blast at its east pier (`demo.blast(3.2, 1.2, -14, 2.5, [0, 0, 1])`): a bite out of
  the pier's corner, the arch and the chamber over it standing.
- The signs: in the breeze they sway up to 3.6–5.1° (their boards move 2 cm at most); a blast in
  the square 4 m out from the tavern's swings it out to 25°, down to 9° 4 s later, and they're
  still all hanging, none counted loose, 8 s on.
- Sounds in the tower's fall (the engine's plays counted, with audio allowed): the bell's strokes
  restart with each blast (4–5 `bell.toll`) and it jangles as it comes loose, `bell.clang` 1–5
  times as it lands; 71–316 `landed` events, with `stone.impact.large` heard 48–67 times,
  `tile.clatter` 5–16 and `timber.crack` 9–14; `birds.scatter` once a blast; the hens once or
  twice (the fourth blast comes 3 s after the first).
- Walking (W held for 4 s): east along the street south-east of the stable, the player stops at
  x 13.2 (where `walkable` ends); south from the churchyard at z 14; west behind the west row at
  x -23.2; west along the alley north of W1 to the round tower, x -27.0. Walking straight at a
  scenery tower, the player stops 3.61 m from its axis (its hull is 3.6 m at the foot).
- Screenshots: `assets-src/packs/medieval/phase-d/` (the start, from above, the tower's fall, after
  it from the square and from above, the nave after it, the fall as a sequence with and without
  the joints cut, the nave's roof and walls blasted, the roof joined, the tavern, the hall, the
  round tower, the town wall, the gate, the swinging sign); earlier ones in `review-3-fixes/`,
  `library-adoption/`, `shots/`, `review-1-fixes/` and `review-2-fixes/`.

## Known issues

- **The gun brings the towers down.** 56 rounds (4 s) at the church tower's base or 70 at the round
  tower's break enough of their base blocks (4 and 12) that they fall, as three rockets do; in phase
  F one 70-round burst at the church tower's west face (2 of its rounds broke a block) brought it
  down. They're built to go when about a third of a course does (`compression` 12 and 10). Stone
  holds a while first (30–36 rounds at one block before it first gives way: `impact` 150 and 120,
  which keeps falling timber from breaking walls); the materials aren't made tougher for the gun.
- **Wreckage cracks the square.** The church tower's blocks strike the cobbles harder than their
  `impact` (30) and crack slabs into cells that stand where they were (+182–264 ground pieces):
  nothing shows, but a fall leaves that many more pieces. A higher `impact` would keep them whole
  and make the gun weaker on the cobbles (it's what bullets measure a piece by).
- **The hall's fall settles slower.** Its blasts at the front posts crater the square's edge and
  more of it lands on the slabs: 40–270 pieces still loose 20 s on, against 3–95 before the ground
  (none at +40 s).
- **A crater's floor is dark in the low sun's shade**, with the blast's scorch over it; its faces
  are flat cells, and its chunks come to rest on their edge now and then (the library's). Under a
  long burst the chunks the gun's bite throws out lie round the pothole as a heap of pale broken
  setts (their broken faces are the cobbles' map, lighter: `SETTS_BROKEN`).
- **A sign's board goes at the first round**, as every board in town does (boards' `impact`): a
  round on the board shoots the sign apart, so it swings and creaks under the gun only to rounds on
  its iron pictograms, its bracket, or the wall and timbers within 1.2 m of it. A round beside it
  swings it 7 cm at the board's middle; one into its bracket or a pictogram 12 cm (about 25°).
- **From the square the bell is out of the gun's sight**: the belfry's openings are 15–16.5 m up,
  and their sills hide it. On foot it's in sight only from 43–54 m out to the west, past the
  houses (13 places on a 1 m grid of the town); flying (<kbd>F</kbd>) level with an opening, from
  anywhere in line with it.
- **The piece budget takes rubble back after the big falls.** The church tower's fall takes the
  town to 10,140–10,330 pieces, and 40 s on it's back to 9,500–9,610 (without the budget
  9,916–10,056: the small rubble clears itself), the budget's share shrunk away out of view first.
  From the square the pile looked the same at +10 s and +40 s.
- **The weighing works by fewest bonds and, by default, breaks all at once.** Weight goes to the
  ground by the fewest bonds, not by stiffness, and every bond over its limit breaks in the same
  round, the supports overloaded by what's about to fall among them. The world works round it
  (roof bays, glass clear of its frames, ashlar walls at compression 60 and support 90): undone
  one at a time with phase D's library, each still did harm (see "How it breaks"). The library's
  `passHeldOnly` keeps the nave standing, but a blast at the round tower's base no longer brings
  it down, and the church tower's fall leaves a column of it standing against the nave.
- **A tower pushed over joined is thrown out of the town now and then.** Landing as one section,
  hundreds of its blocks were shot along the ground at the speed limit, past 120 m (see "Leaning").
  The world cuts a tower's joints when its push ends; a library fix would let it land joined.
- Jettied fronts still need `releaseFronts`, and undermined towers `leanFalls`: the library's
  weighing leaves the one hanging over the void (the tavern's, in one run of two without it) and
  the other standing on part of its base (the round tower, two runs of two; see DESIGN.md §9).
- A blast throws its lightest cells at up to about 34 m/s, and now and then one lands over 120 m
  out: in two of six runs at the tavern, one piece 122–127 m out (the one looked at, a 10 cm oak
  splinter). It's the library's ("Still open" in `docs/changelog/phase-d/README.md`).
- For its first second the HUD reads 26 moving: the signs, hung at load, count as moving until
  they've hung still for 0.8 s.
- Up close, a rubble block's edge can cut a stone in its map (each block shows its own patch).
- The market hall's upper storey keeps some of its panels where it lands.
- Now and then a jettied front let go comes to rest leaning against its house instead of falling
  into the square (one run in five at the tavern; none in the four since).
- The scenery houses are boxes: the player is kept 1.8 m from them, but from the square and the
  wall walk the lanes between them can be seen into.
- The parapet's limestone coping reads as coarse sponge on its top up close (one `uvScale` per
  material).
