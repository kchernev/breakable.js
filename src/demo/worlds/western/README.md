# Dust Town (`?world=western`)

A frontier main street at high noon: two rows of false-front wooden buildings with covered
boardwalks, a brick bank, an adobe chapel with its bell, a livery barn, a smithy, a water tower and a
windmill, with open desert and mesas beyond. Everything in the town breaks, the street too (packed
dirt and sand over earth: a rocket craters it, the gun digs into it); the desert and the mesas
don't. The town answers the gun as it does a rocket: the water tower spurts where it's shot, the
bell rings, signs swing, tumbleweeds hop, the doves and the hawk take off. The plan, the numbers
and the reasons are in `DESIGN.md`; the street, the gun and the town's answers to it are below.

## Files

| File | What it does |
|---|---|
| `meta.ts` | The picker card (order 2). |
| `index.ts` | The definition: the sky (Goegap lighting, a pure noon sky shown, the sun at 65°), the look (fill, grade, heat haze, the street's dust palette and sandy blast clouds), materials, `groundAt` (the street's bed on the street), `killBelow` just under it and the piece budget (`maxPieces` 9,400), sounds (by material, with landing crashes and pitches and a bullet's strike; footsteps by surface, the earth's down in a crater), dust and chip colours and amounts, and the reactions (to blasts, to the gun's rounds and bursts, to what lands) wired to `life.ts`. |
| `materials.ts` | The 17 breakable materials (siding, timber, stave, tin, adobe, brick, stone, glass, iron, bronze, signpaint and the hanging boards' hangboard, paint, hay, coals, and the street's sand and earth), the bales' straw drawn on a canvas with a normal map from it, and the coals' embers. |
| `frame.ts` | Building in a structure's own frame (x along its front, z back from it), turned onto the street. `wall()` lays courses between posts round holes, clipped under a roof line. `opening()` fills a hole with jambs, a head and a window, door (three boards a leaf, battens and a Z-brace, a knob) or batwings on hinges. `slope()` makes a roof slope of rafters with sheets on them. Timber gets ±6% tints. |
| `fronts.ts` | The false-front buildings (saloon, barber, hotel, store, sheriff's): sleepers, plank floor, siding walls, the false front with its cap and signboard, a gable or shed roof in tin, the boardwalk, an awning or the saloon's balcony, and the hanging sign (`hangSign`). Also what `life.ts` watches: each front, and the two-storey buildings' side and back walls (`WallWatch`). |
| `masonry.ts` | The brick bank (stone plinth, running-bond walls, barred windows, parapet, teller grille) and the adobe chapel (round vigas through the walls, buttresses, the bell gable with its arch, yoke and the bronze bell on a hinge). |
| `works.ts` | The livery barn, smithy (with the forge's coals), water tower (legs leaning in 4°, a `stave` tank; it says where the tank's water is) and windmill (its platform's corner is the hawk's perch), plus barrels (bellied staves, two hoops), crates, bales (three slabs and two strands of twine), hitching rails, troughs, benches, the barber's pole, telegraph poles (the hawk's other perches), the corral and the outhouse. |
| `interiors.ts` | A little inside each building: the bar with its foot rail, bottles and mirror, tables and stools, the store's counter and shelves stocked with tins, jars, crates and sacks, the sheriff's desk, stove and cell, the barber's chairs, the hotel desk. |
| `town.ts` | What stands where (DESIGN.md §1.2), the props placed clear of everything (each copy its own tint), and what `life.ts` needs from the built town. |
| `signs.ts` | The sign atlas drawn on a canvas (weathered boards, a pictogram, rows of brush marks that read as lettering but are not letters): a row per false-front sign, and over them the hanging boards, each where both its faces read (`hangFrame`). |
| `scenery.ts` | The street (`STREET`: where it breaks, its layers, `layStreet` for `build`, its slabs' look `streetSurface`) and the ground round it: the ground's fixed body, 4 m thick (a piece driven half a metre into a 1 m one went out of its bottom), its top at the street's bed under the street; the earth a crater shows past the slabs (the bed, the street's cut edges); the ground drawn in one shader (`dirt()`: dirt, a paler street, wheel ruts that merge into one track out of town, red earth and gravel further out) on a plane with the street cut out and on the street's slabs; mesas and tapered, notched buttes in banded sandstone (smooth shading, hard at ledges and the rim, normals bent by noise), scrub, rocks, cacti, telegraph poles, the outskirts (boot hill, a stock pen, a ruined adobe corral, a broken wheel) and a haze skirt round the horizon. |
| `life.ts` | Gusting wind (pale dust lifted off the street, the effects' wind, the wind's loop swelling), the windmill's wheel riding its gearbox and its clank quickening, the hanging signs swinging on their hinges (their chains drawn; a board shot apart hangs on by what's left under its chains), tumbleweed props rolled by the wind (steered past the wagon by the start and the chapel; one caught on something comes in again at the west) and hopping when shot, doves that flush and return, the hawk on the windmill, smoke off the forge, the bell (it rings and swings when shot; the alarm swings it as it tolls), dust slapped up where sections land and where things strike the street (its slabs too), the water tower's topple and the watched walls' fall. All it draws (the wheel, the chains, the birds) is made with the town, so the warm-up before play draws it. |
| `water.ts` | The water tower's water: the level in the tank, a hole spurting a thin stream (GPU droplets, as Brick Street's hydrant's are) where a round goes into its staves under the waterline, the splash and the wet patches on the dirt, and the spill when the tank bursts. |

About 7,850 pieces at load (the saloon 1,340, the hotel 1,150, the store 910, the livery 770, small
things 710, the sheriff's 640, the bank 565, the chapel 485, the barber 450, the street 272, the
interiors 190, the water tower 180, the smithy 95), and 12 props (two wagons, the safe, two pumps,
four rocking chairs, three tumbleweeds): 7,872 bodies with the props' welded parts. Every structure
stands on its own sleepers or footings (`ground: 0`), and what stands in the street (the hitching
rails, troughs, the barrels at the west entrance, some of the livery's hay) on its slabs; nothing is
`static`. Ten pieces hang on hinges from the start
(`stats.hanging`): the seven hanging signs, the saloon's two batwing leaves and the bell. They aren't
counted moving once they're at rest, so the HUD reads 3 moving standing: the tumbleweeds, which the
wind rolls (4 about two fifths of the time, while a gust swings the sign nearest the player further
than 10 cm). Four rockets along the saloon's front leave about 9,200–9,280 pieces (9,030–9,050
before the street broke). Past 9,400 (`maxPieces`: the count at load and about a minute of the gun at
a wall) rubble at rest shrinks away, what's out of sight first (the library's budget).

## How it's built and how it fails

- **Frame buildings.** The siding courses (0.45 m, three lap boards) stand between timber posts on
  the sleepers. Every siding piece of a wall shares its building's texture frame (a side wall's
  turned a quarter, so its x runs along the wall), so the laps run on across pieces and boards split
  along their length (`grain`). Floors stop 2 cm short of the front. The front and its false front
  are a free-standing stack, tied to the side walls at the corners and to the roof by two braces
  (`d.bond`). Siding's `support` is low (25), so a bay whose posts or head go comes down. A
  one-storey front's corner posts are bonded to the side walls' end boards on every course, so one
  rocket at the door takes its bay, not the front.
- **The fronts' fall** (`life.ts`, `updateWalls`). The library brings an undermined front down by
  itself, but straight down onto its stubs and porch. So each front is watched: once 60% of a
  two-storey front's ground-floor posts are gone (40% of a one-storey's), its porch posts are hit,
  and once those hits are in, its ties to the rest are cut (`d.unbond`, a puff of dust at each) and
  it's let go, with what its porch posts held (the balcony or awning: `porchBox` in `fronts.ts`), as
  one section turning out over its foot (`d.release`). It lands flat in the street in boards and
  panels (siding `strength` 1.5e3). Let go without its porch, the saloon's front stood up on the
  rubble in 5 runs of 9: a porch whose posts are hit can stay up, hung off the building (in the run
  looked into, the whole balcony still stood when the front went), and the balcony's end railings,
  2 cm off the front, stopped it turning within a few degrees. Two and four seconds on, what of the
  front still stands upright more than 2 m up on the rubble (a part the library let go straight
  down while the porch posts were being hit) is cut from what it came to rest joined to and pushed
  over the same way. In twelve runs of four rockets along the saloon it found such a part in nine;
  of the six with it switched off, one left a 2 m panel of front standing on the rubble at the west
  corner, and with it at most a course or two of siding (1–5 pieces, 2.5–3 m up) stays upright.
  A two-storey building's side and back walls are watched the same way (60% of a wall's ground
  floor): the floor band along it is hit, then it's let go turning out away from the building, and
  the roof, losing its plates, drops. A ground-floor bay blown out has the band over it hit.
- **Roofs** are rafters on the plates (`d.bond` at the feet and the ridge) with tin sheets lying on
  them face to face, bonded edge to edge. The tin bends (plastic) and comes off in sheets or whole
  slopes. Tin is heard at its real weight (`audible`): a sheet clatters where it strikes, a slope
  tearing loose crashes, and crashes again, lower, as it lands (`land`).
- **The bank** takes two or three rockets and comes apart in brick blocks. Its iron bars bend.
- **The chapel** crumbles in tan lumps and dust. The bell hangs on a hinge under its yoke; the alarm
  after a blast or a long burst swings it as it tolls, and a round into it rings it and swings it.
  Shoot the gable's shoulders or the yoke and the bell comes down with the yoke and rings as it lands
  (`bronze` impact sounds are `bell.toll`).
- **The water tower** (`updateTower`). Its legs carry it as columns, so two can hold the tank up,
  and a top cut loose settles on their stubs. `life.ts` watches the legs: when two are cut, the
  rest groan, and a moment later everything over the lowest joints is let go (`d.release`) turning
  over toward the cut legs. The tank is `stave` (weak joints), so it bursts into staves, and holds
  water (below: the town answers the gun).
- **The windmill** folds when its legs go. Its wheel is a visual mesh that follows the gearbox
  (smoothed between readbacks), spinning with the gusts; its clank quickens with them
  (`Voice.setRate`) and stops once the gearbox falls. The wheel is made with the town (it was made
  at the first frame, after the warm-up, and two pipelines were compiled the first time it came into
  view).
- **Hanging signs** are boards on hinges under their arms (`d.hinge`, `to: arm`): the wind leans
  them, blasts swing them, and they fall with the arm (and break where they land). Their chains are
  drawn, riding the boards. A round shatters a board (the first, at power 6); under each chain the
  biggest cell that can still be cut is hung again from the arm, swung away from the shot. They're
  `hangboard`, the signboards' `signpaint` without its grain and with its cells packed closer round
  the hole (`fragmentSize` 0.15): along the grain a round left a strip along the top (40% of the
  board, on average, over 400 cuts of the library's on the CPU), the next took it; now it blows out
  where it struck and leaves a piece at each chain, 70% of the board, and a sign takes three
  rounds or so (`phase-f/western-fix/node/rounds.mts` beside the scripts below).
- **Glass and hay** break where they land (`landing`): bottles off the shelves, panes, bales off the
  loft. The forge's coals glow while they lie in the hearth (`glow: 'standing'`) and smoke a little.
- **Round pieces** (the balcony's eight-sided balusters, vigas, poles) stop where they land: the
  library's rolling resistance (0.02). Two rockets into the balcony throw its 75 `paint` pieces
  (rails and balusters) into the street; 4–12 of them were turning on the ground 2 s after, one or
  none at 4–5 s, none from 6 s (three runs).

## The street

- **Where.** Between the boardwalks (their fascias at |z| 6.96, footings from 7) from the west end of
  town (x -45) to the chapel's front (x 23), and on along the chapel's south wall (z 2.4) to x 45,
  where it's the road (`STREET.areas`, two `addGround` stretches). The rails, troughs, pumps, wagons,
  the barrels at the west entrance and the player's start are on it; the boardwalks, the chapel's lot
  and the desert stay scenery. A strip 1 m wide before the chapel's door (x 23-24) stays fixed too.
- **Layers.** Packed dirt and sand 0.25 m (`sand`) over earth 0.95 m (`earth`) on the bed at -1.2
  (`BED`: `groundAt` there, the ground's fixed body's top under the street; `killBelow` -2), in 3 m
  slabs: 272 (136 a layer). A crater's floor is earth too (`bed: 'earth'`: it's drawn as the earth). The slabs' tops are drawn by `dirt()`, the same shader as the ground
  round them, each point by where on the street it was laid (`pieceFrame()` from its stretch's
  middle; the two stretches' lengths tell them apart): the paler street, the ruts and the churned
  middle run on across the slabs and into the road with no seam (six views before and after: the
  ground's mean colour within 0.5/255, nothing at the stretches' edges), and a clod keeps its bit of
  rut. Its sides and broken faces are `western_dirt_broken` (crumbled dirt), the earth
  `western_earth` (dug red-brown soil with stones), both made for this; past the slabs a crater
  shows the drawn bed and the street's cut edges (dirt over earth).
- **A rocket into it** (seven spots, from the player's height): a crater 5.1-8.2 m² open (2.5-3.2 m
  across), down to the bed in its middle in four (0.6-1 m in the other three), its rim a ragged star of
  packed dirt over the earth, a big cloud of the street's dust (`dustAmount` sand 2, earth 1.4) and
  a few clods thrown round it, which crumble where they land and clear in 6-8 s. Most of what a
  blast reaches sprays (`minBodySize` 0.5 and 0.4); what's small beyond its reach stands
  (`keepSmall`), so the rim is whole. Each crater leaves 43-118 more ground pieces (about 80). Rails
  and troughs in reach drop in; a wagon a metre or two off is thrown over beside it (props are
  thrown, never broken); the saloon's front falling into the street breaks no slab.
- **The player** walks down into a crater and out the far side without a stop (down to the earth's
  top, -0.25, walking through; on the bed in a deep one, out by a step up the earth's faces or a
  jump). Steps are dirt on the street and rubble on the earth and the bed (`footsteps.surface`).
- **The gun** digs it: a fresh slab gives way at the 3rd round, then a clod a round; 56 rounds 5 m
  ahead break something 51-52 times and leave a trench down to the earth (+114-135 pieces). A bullet
  into a crater's bed strikes the earth (`bullet.dirt`, a pock and clods): ten rounds into a fresh
  crater struck `earth` all the way down, the last two on the bed at -1.2.

## The gun here

42 rounds at one spot from the street, 6-14 m off, in two runs: the round the first piece gave way
at, and the sound each strike played.

| What | Gives way | Rounds that broke something | Sound |
|---|---|---|---|
| Siding (the fronts, side walls) | 2nd | 41 of 42: boards blow off, a stretch of wall comes down in panels | `bullet.wood` |
| Timber (posts, beams, the boardwalks) | 4th-7th | 27-29 | `bullet.wood` |
| Trim, signboards, the tank's staves, hay, the forge's coals | 1st | all | wood (staves at 0.85, signs 1.1, trim 1.2); hay `bullet.dirt` at 1.2; coals `bullet.brick` at 1.4 |
| Panes, bottles | 1st | all | `bullet.glass` |
| Adobe (the chapel) | 3rd | 36-39 of 42, in a cloud of dust | `bullet.dirt` at 0.9: a mud wall pocks as dirt does |
| Brick (the bank) | 4th | 24-33 | `bullet.brick` |
| Sandstone (plinths, lintels) | 5th | 12-31 | `bullet.concrete` |
| Iron (bars, the stove, the windmill) | 9th-16th | 15 | `bullet.metal` at 0.9 |
| Tin (the roofs) | 6th-9th | 1-6 of 16-30: dents and sparks, ricochets | `bullet.metal` at 1.25 |
| The bell | never (its yoke does: the bell falls) | | `bullet.metal` at 0.8, and it rings (`bell.shot`) |
| The street | 3rd | 39-52 of 42-56 | `bullet.dirt` (the earth at 0.85) |
| Props: wagons, the safe, pumps | never | dents and holes; the pumps ring and ricochet | `bullet.wood`, `bullet.metal` |
| Props: rocking chairs, tumbleweeds | never | skitter off; a tumbleweed hops at each round (12 m in 6 rounds, up to 1.1 m high) | `bullet.wood`, `bullet.dirt` at 1.2 |

Casings land in dirt and on boards: `casing.drop` at 0.08 (0.15 in the base pack). The chips and
dust are each material's colours (`chips`, `dust`); the street's dirt and earth have their own.
Every round played its strike. The fastest piece let go while firing went 9-17 m/s and the
farthest 6-27 m but once (below). Frame times firing at the hotel's side wall and into the street,
Brick Street at its brick wall and road at the same time (two runs each, vsync on, the GPU shared):
wall 20.7-21.2 ms a frame on average against 21.7-24.8, the street 19.7-23.7 against 25.4-26.4; the
worst frames 81-183 ms against 72-149. No pipelines are made after the card by a crater or by the
gun into the street.

Again this phase, with the town's answers to the gun (`firecmp.mjs`, 10 s held at the hotel's side
wall, then 10 s into the street; Brick Street run between; the machine at a load of 17-37 and the
GPU shared): the wall 25.7 and 37.3 ms a frame on average against 28.0 and 28.4, 43 and 124 frames
over 40 ms against 66 and 76, the worst 121-156 ms against 94-161; the street 25.8 and 27.9 against
22.9 and 25.6. 131-135 of 133-136 rounds at the siding broke something (+83-84 pieces). An earlier
pair at a load of 50-76 ran at 78-117 ms a frame in both worlds: not a measurement.

## The town answers the gun

`onShot` (each round that strikes) and `onBurst` (each burst, once it's let go) in `life.ts` and
`water.ts`. Each answer is bounded by what it is, not by the rounds: a burst of 70 sets off one of
most things, a few of the rest.

- **The water tower.** A round into the tank's staves under the waterline leaves a hole that
  spurts a thin stream out and down: GPU droplets (450 a second from the bottom of a full tank, fewer
  as its head falls) leaving at Torricelli's speed less a fifth (`JET`), the frame's droplets spread
  along the jet so it reads as a rope that frays as it falls. Where it comes down (found again four
  times a second, on the ground, the deck or what lies there) it splashes and throws a little spray,
  and a dark wet patch spreads over where it has come down, drying in the sun over a minute or two
  once it stops. The level falls with every hole (`DRAIN`: 0.07 m/s for each, times the root of the
  head over it): a hole at 6.9 m in a full tank lands 8.4 m out and runs about 40 s, slowing
  and falling short as it goes; six holes empty the tank down to the lowest in about 20 s (game time;
  a real tank would take hours). A round under the water throws a puff of spray back out where it
  went in (the staves raise no dust); one over the water leaves a dry hole. At most six streams run (a
  round within 0.3 m of one is into the same hole; a lower one takes the highest's place), and a tank
  shot through its bottom, with a third of its wall gone or brought down with the tower lets what's
  left go at once, over 1.5 s, and soaks the ground 4 m round. Sounds: `water.spurt` as a hole opens
  (2 voices, 0.15 s apart at least) and one `water.stream` loop from among where the streams come
  down, as loud as they run: 3.5 dB over the desert's bed from 9 m off.
- **The bell** rings where it's struck (`bell.shot`, at the toll's pitch: the same bell; 2 voices,
  0.25 s apart at least) and swings (0.35 m/s along the shot each round): 14 rounds from 20 m, 5 into
  it in a third of a second, rang it once (the next four came too soon) and swung it 50° before the
  next rounds cut its yoke and it fell, ringing as it landed.
- **Signs** swing on what's left of them (`Life.rehang`): a round shatters the board, and under each
  chain the biggest cell still big enough to cut again is hung again from the arm (one cell, or each
  half of a board shot in two on its own chain), swung 1.6 m/s away from the shot, with a creak. One
  round into a board's middle (three signs, face on) left 77% of the hotel's in two pieces, one on
  each chain, swinging 40-50° either way and still swinging 4 s on; the next round, at the bigger
  piece, left 35%, the third nothing. A round at the barber's top edge left 69%. A 5-round burst at
  the saloon's left one piece of 24% (the other four went through where the board had been).
- **Tumbleweeds** hop at a round (2.2-3.4 m/s up, from the ground and once in 0.3 s at most), and the
  round's own push carries them on: six rounds took one 12 m down the street, 1.1 m up at the top.
- **The doves** take off as a burst goes on: those within 8 m and 1.2 m more a round of the gun or
  of where its rounds strike (a blast's 40 m after 27 rounds), one flutter a flock. Three rounds into
  the street at the start stirred nothing; 28 at the saloon put its seven up and left the tank's and
  the gable's, 30-40 m off. They come back in 42-55 s, as after a blast.
- **The hawk** now sits on the windmill's platform (else a telegraph pole). A blast or the fourth
  round of a burst puts it up: it cries, climbs away from the noise to 30 m and circles the town at
  about 50 m, and 55-85 s after the last noise comes back down over the town from above, to 6 m
  over the perch on its street side ('down': the further off, the higher it aims), and drops onto
  it slowly from there ('in'), turning to face the street as it lands. Gliding straight at the perch
  it crossed the saloon's front 1-2 m over its false front and its last metres skimmed the
  windmill's boom and vane; now it comes no nearer than 9.5 m over anything in town on the way
  down, from any point of its circle, and never through the windmill's wheel, boom or vane (72
  ways down from round the circle, `phase-f/western-fix/node/hawk3.mts` on the town's heights;
  before, 0.4 m at worst).
  In the page: up at the first burst's 4th round, home 100 s after it, never under 11 m over what
  stands away from the windmill. It cries now and then while it's up, from where it is.
- **The alarm**: a burst of 2.5 s or more (35 rounds) within 45 m of the chapel brings it out as a
  blast does (three tolls 2-3 s on, at most once in 25 s, blasts and bursts together): 42 rounds into
  the chapel's front rang it.

Counted in the page (`H.tally`, the engine's `play` wrapped; scripts in
`scratch/phase-f/western/`): 70 rounds at one spot of the tank (16 struck; the
rest went out through the hole the first ones made, into the sky) played one `water.spurt` and one
`water.stream`, one stream at most, two flutters of doves and one hawk cry; 70 at the bell (28 struck
the bell and its gable) two `bell.shot`s (two more came too soon); 70 at the hotel's sign five creaks
(the wind's among them).

## Assets

All in `public/packs/western/` (see its `CREDITS.md`): the eight texture sets (two of them, the
street's broken dirt and earth, made for its craters) and the siding's paint mask, two Poly Haven
skies, four props (wagon, safe, pump, rocking chair), and 17 sounds (three of them, `bell.shot`,
`water.spurt` and `water.stream`, for the town's answers to the gun). The base pack adds brick,
concrete and sandstone textures, the iron, and the explosions, glass, metal, masonry, footstep and
gun sounds. The asset reports are in `assets-src/packs/western/*-report.md`, the
screenshots this was judged by are in `assets-src/packs/western/shots/`.

- **Sky.** Goegap lights the town: a real desert, whose sandy ground bounces warm light into the
  shade. Its photographed hills, though, stand up to 20° above the horizon, sharp behind the mesas,
  so the background is Qwantani Noon (pure sky, `sky.backgroundHdri`). The sun is raised to noon
  with `sky.elevation`; `look.fill` gives back the bounce the look was made with.
- **Siding paint.** Each building's colour tints where the siding's map still has paint
  (`tintMask`, `western_siding_paint` from `textures.py`, blurred 5 px), and a little (35%) on the
  bare boards between. The paints are a little deeper than they read: faded red saloon, mustard
  store, sage barber, dusty-blue hotel, bone sheriff's. Keep the red pale (0xc49a8a): a deep one
  (the saloon's was 0xb66f59) is darker than the grey wood between its flakes, and from across the
  street the flakes in their rows read as red brick.
- **Timber** is jittered across its map (`uvJitter: 1`), so equal panels show their own knots.
- **Splinter faces.** `inside: 0xffffff`, because the splinter map carries its own cream colour.
- **Tin** ridges are 7.6 cm at `uvScale 1.46`; its metalness is the map's.
- **Props** collide as welded parts (`parts` in `scripts/assets/packs/western/props.mjs`): the wagon's
  bed, a drum across each pair of wheels, its tongue; the pump's post, lever and spout; the
  rocking chair's seat and each runner (it rocks). The tumbleweeds are props made in `life.ts`
  (their twigs drawn in code, a 32-point ball for a collider).
- **Boardwalk steps** (`steps.boards`) are mixed from the dirt steps' take (`mix-sounds.mjs`): no
  generation of their own.
- **The street's** broken faces carry their own colour (`inside: 0xffffff` on `western_dirt_broken`);
  the earth's map is multiplied by `EARTH` (0xccc0b4) in its material and on the drawn bed.

## What to tune

- Light: `sky.sun.intensity` (3.7), `sky.elevation` (65°), `look.hemisphere.intensity` (0.17: higher
  washes out the noon shade), `sky.environment` (0.12) with `look.fill` (2.4), and `look.exposure`
  (1.0). At sun 4.0 and exposure 1.05 the street went nearly white. `look.grade` bleaches a little
  (saturation 0.92) and warms. `look.haze` (1.4 px from 60 m, under 8 m) shimmers the desert.
- The walls' fall: `updateWalls` in `life.ts` (the turn: 1.1 rad/s for fronts, 0.8 for side and back
  walls; the two looks after it for what still stands, `UPRIGHT` within 30°), the shares in
  `fronts.ts` (`watch(...)`: 60%, 40% for one-storey fronts), and `GAP`/`TIE`.
- The water tower: `updateTower` in `life.ts` (the turn, 0.5 rad/s), `stave` `strength` (250). Its
  water, in `water.ts`: how fast the level falls (`DRAIN`), how hard a hole spurts (`JET`), how many
  droplets a stream has (`RATE`), how many streams at once (`HOLES`), how fast a patch dries (`DRY`)
  and fades once the ground under it is blown away (`SINK`),
  and when the tank bursts (a third of its wall gone or a tenth of its floor, in `update`: a round
  low in the wall chips up to 3% of the floor's edge, and spurts).
- The town's answers to the gun, in `life.ts`: how far the doves are startled after so many rounds
  (`reach`: 8 m and 1.2 m a round, at most a blast's 40), the round the hawk goes up at (the 4th)
  and how long it stays up (55-85 s after the last noise, `hawkUp`), where it comes down to before
  it drops onto its perch (6 m over it, 3 m toward the street, in `updateHawk`), the burst that brings the alarm
  (2.5 s), the bell's swing (0.35 m/s a round), a re-hung sign's swing (1.6 m/s), a tumbleweed's hop
  (2.2-3.4 m/s); the new sounds' levels and spacing in `sounds.mjs` (`play`).
- How frail the buildings are: siding `support` (25) and timber `support` (60) in `materials.ts`.
  Higher and fronts hang on after their ground floor is gone. Lower and one rocket brings a whole
  front down.
- Debris: the library's (`maxSpeed` 40 m/s, rolling resistance 0.02); the farthest piece of a
  collapse lands 60–110 m from the centre, in the desert.
- Dust: `look.dustPalette` and `look.smoke` in `index.ts` (sand and dun), `dustAmount` per material
  (none for the tank's staves: its roof's boards dropping as the top staves go raised a cloud over
  it that read as smoke against the sky, and still did at a third).
  In the street: `life.ts`, `update` (a patch about every second, the streak on each gust); a puff
  grows to about three times the cube root of its share of the region, so about a puff per cubic
  metre keeps them low.
- Gusts: `gust(t)` in `life.ts` (0.3 to 1.4), which drives the wind, the wheel, the signs, the
  tumbleweeds and the dust. The signs' lean: `updateSigns` (a push across the face each readback).
- The street (`STREET` in `scenery.ts`, `sand` and `earth` in `materials.ts`): the slabs' size
  (`cell`, 3 m) against the sand's `reach` (0.75 of a blast's radius): when the reach passed half a
  slab's diagonal (1.7 m slabs at 0.85, 2.3 m at 0.65-0.85), a rocket took whole slabs and its
  crater came out square, along the seams; smaller slabs also cost more pieces at load (1.7 m: 770).
  The layers' depths (0.25 and 0.95) and the earth's `reach` (0.45) set how deep the middle goes;
  `minBodySize` how much sprays rather than flies as clods, and `dustAmount` the cloud.
- Doves, hawk and tumbleweeds: their counts and timings are in `Life`'s constructor and their
  update methods; the tumbleweeds' pull to the street's middle east of x 0 and north of z 1.5, and
  their 4 s catch (taken out only over 25 m from the player) in `updateWeeds`.

## Known issues

- Frames, the GPU shared with other agents' Chromes, Brick Street run between: four rockets along
  the saloon, the first blast's worst frame 33–117 ms (Brick Street's 33–83 ms), the collapse's
  worst 83–183 ms (100–133 ms), 22–133 frames over 40 ms in the 13 s from the first blast (16–103);
  four runs, five of Brick Street's. Standing, the median frame is Brick Street's, 16.7 ms, and the
  mean 22.8–24.2 ms against 21.1–23.8 (four loads each, alternated).
- This phase (the machine at a load of 13-76, the GPU shared, so slower than the numbers above for
  both worlds; `idle.mjs`, `collapse.mjs`, `firecmp.mjs`): standing at the start for 8 s, 23.2-36.9
  ms a frame on average (medians 18.4-33.1) against Brick Street's 22.2-27.4 (18.8-29.6), nine loads
  each in turns. What the world adds a frame standing (`Life.update`, the wind, the birds, the signs,
  the tank's water): 0.12 ms on average, 0.6 at most; the water's own 0.01. Four rockets along the
  saloon, three runs: 232, 198 and 178 pieces loose at +10 s, 7, 11 and 7 at +20, 5, 4 and 5 at +40
  (the three tumbleweeds and a swinging sign), as before (313-347, 9-32, 3-4); the front laid in the
  street in panels; nothing under the ground; the farthest piece 58-81 m out; 27.0-38.5 ms a frame
  on average from the first blast to +10 s, the worst 170-188 ms, against Brick Street's 36.1-108.6
  and 155-396 ms. No pipelines made after the card in any of them (in phase E each made two: the
  windmill's wheel).
- After a front is let go, the roof, its plates gone, stays up on its rafters over the open
  building, or its slopes come down, the end pairs of rafters often leaning in over the pile in a V;
  the side wall's first bay can stay on as boards. All rest on what holds them, so they stay. No
  front stood in the street's plane in 19 runs of four rockets along the saloon. In one more (the
  look-over switched off, but it would have moved only 4 pieces), the front and its balcony came to
  rest as one sloping slab across the porch's remains, its high end some 4.5 m up.
- The HUD's "moving" reads 3 at rest, not 0 (4 while the nearest sign swings): the tumbleweeds are
  props the wind keeps rolling.
- A collapse throws a board or two 60–110 m out into the desert, where it stays (nothing clears
  it). In one saloon collapse of thirteen, four light boards landed 123–137 m out; in six watched
  every 0.1 s, the fastest piece went 28–31 m/s and the farthest landed 96 m out, light boards a
  blast at the west corner kicked up and out. Nothing was seen under the street (looked for every
  0.5 s in nine collapses): the ground box is 4 m thick. With the 1 m box it had, 6 and 14 pieces of
  a saloon collapse went out through its bottom in two runs of three.
- A sign's chains follow its board a readback behind, smoothed: in a hard swing they can lag it by
  a centimetre or two.
- The wagons' wheels are welded drums: a wagon thrown over doesn't roll on them.
- The street's craters are the cut cells' flat faces: a rim of packed dirt 0.25 m straight down, the
  earth faceted under it, a bowl only at the scale of the cells. Now and then a crater's edge runs
  straight along a slab's seam for a metre or so.
- What a crater or the gun adds to the street stays standing: about 80 pieces a rocket, 114-135
  for 4 s of fire into the street (Brick Street's road 117-172). Seven rockets into the street took
  the world from 7,872 pieces to 8,563. Past 9,400 the budget takes rubble at rest back, but not what
  stands.
- The slabs bend the light by the dirt's normal map at one strength (the library's is a material's),
  where the drawn ground softens it to 0.4 in the ruts: up close the ruts on the street are a
  little grainier than out on the road. They're as dark, as smooth and in the same place.
- The two stretches of street share one material, and `pieceFrame()` measures from each one's
  middle, so its shader tells them apart by their lengths: a third stretch, or two of one length,
  would need another way (or their own material).
- The tin sheet the gun once juggled 47 m across town at 23 m/s (shot from inside the livery) isn't
  any more (the library's fix of 2026-10-17: a round raises a loose piece's speed along its way to
  its push, and doesn't add to it). Checked again with the same four 4 s bursts into the livery's and
  the smithy's roofs from inside: six sheets let go, four of them shot again while loose (one 12
  times, one 35 times as it lay in the line of fire), the fastest 7.8 m/s, the farthest 6.7 m from
  where it came loose (`tin.mjs`, `out/tin-1-end.png`).
- The tank's streams are drawn through the tower's legs, girts and ladder (they end only where they
  come down), and one landing on the deck doesn't run off its edge. A wet patch is a flat oval at the
  height the stream came down on; once the ground goes from under where the stream came down (a
  crater, a hole dug by the gun: looked for four times a second) it fades out in half a second and
  the stream wets a new one where it comes down now. A hole dug at one end of a patch takes all of it.
- The tank drains in game time (seconds, not hours), and a hole is where the round struck, however
  much of the stave the round blew away: a stave shot out leaves one thin stream, not a gush.
- A rocket into the tank bursts it, and its spill (1.5 s of droplets off the wall) is hidden in the
  blast's cloud; the soaked ground shows after.
- A piece of a sign hung again hangs on one chain at its end (each half of a board on its own): the
  hinge runs its length, so it hangs level, but only that end has a chain drawn.
- The hawk and the doves are figures of a few facets, made to be seen at a distance (the hawk on the
  windmill is about half a metre tall, 18 m from the start).
- Frames with the street (the GPU 56-99 % busy with other agents' Chromes): four rockets along the
  saloon, 83-145 frames over 40 ms from the first blast to +10 s, the worst 119-135 ms, against
  Brick Street's 108-111 and 83-138 ms run between; earlier with the GPU quieter, before the street:
  7-32 and 52-73 ms (Brick Street 4, 49 ms). Production builds before and after the street, served
  in turns to one Chrome with vsync off (four pairs): idle 3.4-4.5 ms a frame on average before,
  3.9-4.5 after; the collapse's worst 48-157 ms before, 52-97 after, 1-7 and 1-8 frames over 40 ms.
  Within the spread of runs.
